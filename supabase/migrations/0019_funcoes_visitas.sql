-- ============================================================================
-- Estatísticas de visitas: quem entrou na loja/produtos, de onde (rede) e localização aproximada (IP)
-- ============================================================================

-- pg_net: chamadas HTTP assíncronas a partir do banco (localização do IP em freeipapi.com)
CREATE EXTENSION IF NOT EXISTS pg_net;
--> statement-breakpoint

-- Registra uma visita. O IP é lido dos cabeçalhos da requisição no servidor (não vem do navegador).
-- Visitas do próprio vendedor não contam; repetições do mesmo visitante na mesma página em 30 min são ignoradas.
CREATE OR REPLACE FUNCTION public.fertex_registrar_visita(
  p_vendedor_id uuid DEFAULT NULL,
  p_produto_id uuid DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_visitante text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text;
  v_vendedor uuid := p_vendedor_id;
  v_origem text := lower(coalesce(p_origem, 'direto'));
  v_visitante text := nullif(left(trim(p_visitante), 64), '');
BEGIN
  -- Vendedores navegando (inclusive a própria loja) não entram nas estatísticas
  IF EXISTS (SELECT 1 FROM public.fertex_profiles WHERE id = auth.uid() AND perfil = 'vendedor') THEN
    RETURN;
  END IF;

  v_ip := coalesce(v_headers ->> 'cf-connecting-ip', trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)));
  IF v_ip IS NOT NULL AND v_ip !~ '^[0-9a-fA-F:.]{3,45}$' THEN
    v_ip := NULL;
  END IF;

  IF p_produto_id IS NOT NULL THEN
    SELECT vendedor_id INTO v_vendedor FROM public.fertex_produtos WHERE id = p_produto_id AND ativo AND excluido_em IS NULL;
    IF NOT FOUND THEN RETURN; END IF;
  ELSIF v_vendedor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.fertex_profiles WHERE id = v_vendedor AND perfil = 'vendedor') THEN
    RETURN;
  END IF;

  IF v_origem NOT IN ('instagram', 'facebook', 'whatsapp', 'direto', 'outro') THEN
    v_origem := 'outro';
  END IF;

  -- Mesmo visitante, mesma página, nos últimos 30 minutos: não conta de novo
  IF EXISTS (
    SELECT 1 FROM public.fertex_visitas
    WHERE criado_em > now() - interval '30 minutes'
      AND produto_id IS NOT DISTINCT FROM p_produto_id
      AND vendedor_id IS NOT DISTINCT FROM v_vendedor
      AND ((v_visitante IS NOT NULL AND visitante = v_visitante) OR (v_visitante IS NULL AND ip = v_ip))
  ) THEN
    RETURN;
  END IF;

  -- Proteção simples contra abuso: no máximo 300 visitas por IP por hora
  IF v_ip IS NOT NULL AND (
    SELECT count(*) FROM public.fertex_visitas WHERE ip = v_ip AND criado_em > now() - interval '1 hour'
  ) >= 300 THEN
    RETURN;
  END IF;

  INSERT INTO public.fertex_visitas (vendedor_id, produto_id, origem, referrer, visitante, ip)
  VALUES (v_vendedor, p_produto_id, v_origem, nullif(left(p_referrer, 300), ''), v_visitante, v_ip);

  -- Localização: consulta cada IP uma única vez (resultado guardado em fertex_ip_geo)
  IF v_ip IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.fertex_ip_geo WHERE ip = v_ip) THEN
    INSERT INTO public.fertex_ip_geo (ip, request_id, tentativas)
    VALUES (v_ip, net.http_get('https://free.freeipapi.com/api/v1/json/' || v_ip, timeout_milliseconds := 5000), 1)
    ON CONFLICT (ip) DO NOTHING;
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_registrar_visita(uuid, uuid, text, text, text) FROM public;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_registrar_visita(uuid, uuid, text, text, text) TO anon, authenticated;
--> statement-breakpoint

-- Processa as respostas de localização já recebidas e refaz as que falharam (até 3 tentativas)
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
REVOKE ALL ON FUNCTION public.fertex_resolver_localizacoes() FROM public, anon, authenticated;
--> statement-breakpoint

-- Estatísticas de visitas do vendedor logado (inclui as visitas da loja geral)
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
  )
  SELECT jsonb_build_object(
    'inicio', v_inicio,
    'fim', v_hoje,
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
REVOKE ALL ON FUNCTION public.fertex_estatisticas_visitas(int) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_estatisticas_visitas(int) TO authenticated;
