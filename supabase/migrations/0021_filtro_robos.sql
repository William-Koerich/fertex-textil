-- ============================================================================
-- Filtra robôs das estatísticas de visitas.
-- Quando um link é compartilhado, servidores do Facebook/Instagram/WhatsApp (EUA, Suécia, Irlanda),
-- Amazon, Google etc. abrem a página para montar a prévia ou checar o link. Esses acessos vinham
-- aparecendo como visitas de outros países. Agora guardamos a rede dona do IP (ASN) e ignoramos datacenters.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fertex_rede_de_robo(p_asn int, p_org text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(p_asn, 0) IN (
      32934, 63293, 54115,            -- Facebook / Meta (inclui robôs do WhatsApp e Instagram)
      16509, 14618, 8987,             -- Amazon AWS
      15169, 396982, 19527, 36040,    -- Google / Google Cloud
      8075, 8068, 8069,               -- Microsoft / Azure
      13238,                          -- Yandex
      14061, 16276, 24940, 63949,     -- DigitalOcean, OVH, Hetzner, Linode
      20473, 31898, 45102, 132203,    -- Vultr, Oracle Cloud, Alibaba, Tencent
      396507, 212238, 9009, 60781     -- Emerald Onion, Datacamp, M247, Leaseweb
    )
    OR coalesce(p_org, '') ~* '(amazon|google|microsoft|azure|facebook|meta platforms|digitalocean|ovh|hetzner|linode|vultr|oracle|alibaba|tencent|leaseweb|contabo|scaleway|datacamp|hostinger|choopa)';
  -- Não entram: Cloudflare, Akamai e Fastly (usados pela "Retransmissão Privada" do iPhone = pessoas reais)
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fertex_resolver_localizacoes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.fertex_ip_geo g
  SET cidade = nullif(r.content::jsonb ->> 'cityName', ''),
      regiao = nullif(r.content::jsonb ->> 'regionName', ''),
      regiao_sigla = nullif(r.content::jsonb ->> 'regionCode', ''),
      pais = nullif(r.content::jsonb ->> 'countryName', ''),
      pais_sigla = nullif(r.content::jsonb ->> 'countryCode', ''),
      asn = nullif(r.content::jsonb ->> 'asn', '')::int,
      asn_org = nullif(r.content::jsonb ->> 'asnOrganization', ''),
      robo = public.fertex_rede_de_robo(nullif(r.content::jsonb ->> 'asn', '')::int, r.content::jsonb ->> 'asnOrganization'),
      request_id = NULL,
      atualizado_em = now()
  FROM net._http_response r
  WHERE r.id = g.request_id
    AND r.status_code = 200
    AND r.content LIKE '{%';

  -- Falhou, expirou ou não respondeu em 10 minutos: tenta de novo
  UPDATE public.fertex_ip_geo g
  SET request_id = net.http_get('https://free.freeipapi.com/api/v1/json/' || g.ip, timeout_milliseconds := 5000),
      tentativas = g.tentativas + 1,
      atualizado_em = now()
  WHERE g.request_id IS NOT NULL
    AND g.tentativas < 3
    AND g.atualizado_em < now() - interval '1 minute'
    AND (
      EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = g.request_id AND (r.status_code IS DISTINCT FROM 200 OR r.timed_out))
      OR (NOT EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = g.request_id) AND g.atualizado_em < now() - interval '10 minutes')
    );
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fertex_estatisticas_visitas(p_dias int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tz text := 'America/Sao_Paulo';
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_inicio date;
  v_resultado jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.fertex_profiles WHERE id = v_uid AND perfil = 'vendedor') THEN
    RAISE EXCEPTION 'Apenas vendedores têm acesso às estatísticas.';
  END IF;
  IF p_dias NOT BETWEEN 1 AND 366 THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;
  v_inicio := v_hoje - (p_dias - 1);

  PERFORM public.fertex_resolver_localizacoes();
  -- Retenção: visitas com mais de 1 ano são apagadas
  DELETE FROM public.fertex_visitas WHERE criado_em < now() - interval '365 days';

  WITH v AS (
    SELECT vi.*, (vi.criado_em AT TIME ZONE v_tz)::date AS dia,
           g.cidade, g.regiao_sigla, g.pais, g.pais_sigla, (g.request_id IS NOT NULL) AS localizando
    FROM public.fertex_visitas vi
    LEFT JOIN public.fertex_ip_geo g ON g.ip = vi.ip
    WHERE (vi.vendedor_id = v_uid OR vi.vendedor_id IS NULL)
      AND vi.criado_em >= (v_inicio::timestamp AT TIME ZONE v_tz)
      AND NOT coalesce(g.robo, false)
  )
  SELECT jsonb_build_object(
    'inicio', v_inicio,
    'fim', v_hoje,
    'robos', (
      SELECT count(*) FROM public.fertex_visitas vi JOIN public.fertex_ip_geo g ON g.ip = vi.ip
      WHERE g.robo AND (vi.vendedor_id = v_uid OR vi.vendedor_id IS NULL)
        AND vi.criado_em >= (v_inicio::timestamp AT TIME ZONE v_tz)
    ),
    'visitas', (SELECT count(*) FROM v),
    'visitantes', (SELECT count(DISTINCT coalesce(visitante, ip)) FROM v),
    'cidades', (SELECT count(DISTINCT cidade) FROM v WHERE cidade IS NOT NULL),
    'localizando', (SELECT count(*) FROM v WHERE localizando),
    'serie', (
      SELECT jsonb_agg(jsonb_build_object('dia', d.dia::date, 'visitas', coalesce(s.n, 0)) ORDER BY d.dia)
      FROM generate_series(v_inicio, v_hoje, interval '1 day') AS d(dia)
      LEFT JOIN (SELECT dia, count(*) AS n FROM v GROUP BY dia) s ON s.dia = d.dia::date
    ),
    'origens', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('origem', origem, 'visitas', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT origem, count(*) AS n FROM v GROUP BY origem) o
    ),
    'locais', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('cidade', cidade, 'regiao', regiao_sigla, 'pais', pais, 'pais_sigla', pais_sigla, 'visitas', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (
        SELECT cidade, regiao_sigla, pais, pais_sigla, count(*) AS n FROM v WHERE cidade IS NOT NULL OR pais IS NOT NULL
        GROUP BY 1, 2, 3, 4 ORDER BY n DESC LIMIT 10
      ) l
    ),
    'produtos', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('produto_id', p.id, 'nome', p.nome, 'visitas', x.n) ORDER BY x.n DESC), '[]'::jsonb)
      FROM (SELECT produto_id, count(*) AS n FROM v WHERE produto_id IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10) x
      JOIN public.fertex_produtos p ON p.id = x.produto_id AND p.vendedor_id = v_uid
    ),
    'ultimas', (
      SELECT coalesce(jsonb_agg(u ORDER BY u.criado_em DESC), '[]'::jsonb)
      FROM (
        SELECT v.criado_em, v.origem, v.cidade, v.regiao_sigla AS regiao, v.pais, v.pais_sigla, v.localizando,
               p.nome AS produto,
               -- IP mascarado (LGPD: o suficiente para identificar a rede, sem expor o endereço completo)
               CASE
                 WHEN v.ip ~ '^\d+\.\d+\.\d+\.\d+$' THEN regexp_replace(v.ip, '\.\d+$', '.xxx')
                 WHEN v.ip LIKE '%:%' THEN array_to_string((string_to_array(v.ip, ':'))[1:3], ':') || ':…'
               END AS ip
        FROM v LEFT JOIN public.fertex_produtos p ON p.id = v.produto_id
        ORDER BY v.criado_em DESC
        LIMIT 50
      ) u
    )
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;
--> statement-breakpoint
-- IPs já localizados antes desta migration: consulta de novo para obter a rede (ASN)
UPDATE public.fertex_ip_geo
SET request_id = net.http_get('https://free.freeipapi.com/api/v1/json/' || ip, timeout_milliseconds := 5000),
    tentativas = 1,
    atualizado_em = now()
WHERE asn IS NULL AND request_id IS NULL;
