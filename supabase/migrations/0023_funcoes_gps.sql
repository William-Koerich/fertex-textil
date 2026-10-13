-- ============================================================================
-- Localização exata (GPS) dos visitantes que autorizam no navegador
-- ============================================================================
-- Localização do aparelho (GPS), enviada só quando o visitante autoriza no navegador.
-- Guardada arredondada a 3 casas decimais (~100 m): o bairro, não o endereço exato.
CREATE OR REPLACE FUNCTION public.fertex_registrar_localizacao(
  p_visitante text,
  p_lat double precision,
  p_lon double precision,
  p_precisao double precision DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_visitante text := nullif(left(trim(p_visitante), 64), '');
  v_lat double precision := round(p_lat::numeric, 3)::double precision;
  v_lon double precision := round(p_lon::numeric, 3)::double precision;
BEGIN
  IF v_visitante IS NULL OR p_lat IS NULL OR p_lon IS NULL
     OR p_lat NOT BETWEEN -90 AND 90 OR p_lon NOT BETWEEN -180 AND 180 THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.fertex_profiles WHERE id = auth.uid() AND perfil = 'vendedor') THEN
    RETURN;
  END IF;

  UPDATE public.fertex_visitas
  SET lat = v_lat, lon = v_lon, precisao_m = least(round(p_precisao)::int, 100000)
  WHERE visitante = v_visitante AND criado_em > now() - interval '30 minutes' AND lat IS NULL;

  -- Endereço (bairro/cidade) da coordenada: consultado uma vez no OpenStreetMap
  IF NOT EXISTS (SELECT 1 FROM public.fertex_geo_coordenadas WHERE lat = v_lat AND lon = v_lon) THEN
    INSERT INTO public.fertex_geo_coordenadas (lat, lon, request_id, tentativas)
    VALUES (v_lat, v_lon, net.http_get('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=pt-BR&lat=' || v_lat || '&lon=' || v_lon, headers := jsonb_build_object('User-Agent', 'FertexVendas/1.0 (https://fertex-textil.vercel.app)'), timeout_milliseconds := 8000), 1)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_registrar_localizacao(text, double precision, double precision, double precision) FROM public;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_registrar_localizacao(text, double precision, double precision, double precision) TO anon, authenticated;
--> statement-breakpoint
-- Nova visita herda a posição do mesmo visitante (últimos 30 min)
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
  v_gps record;
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

  -- Se este visitante autorizou a localização nos últimos 30 min, a nova visita herda a posição
  SELECT lat, lon, precisao_m INTO v_gps FROM public.fertex_visitas
  WHERE v_visitante IS NOT NULL AND visitante = v_visitante AND lat IS NOT NULL AND criado_em > now() - interval '30 minutes'
  ORDER BY criado_em DESC LIMIT 1;

  INSERT INTO public.fertex_visitas (vendedor_id, produto_id, origem, referrer, visitante, ip, lat, lon, precisao_m)
  VALUES (v_vendedor, p_produto_id, v_origem, nullif(left(p_referrer, 300), ''), v_visitante, v_ip, v_gps.lat, v_gps.lon, v_gps.precisao_m);

  -- Localização: consulta cada IP uma única vez (resultado guardado em fertex_ip_geo)
  IF v_ip IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.fertex_ip_geo WHERE ip = v_ip) THEN
    INSERT INTO public.fertex_ip_geo (ip, request_id, tentativas)
    VALUES (v_ip, net.http_get('https://free.freeipapi.com/api/v1/json/' || v_ip, timeout_milliseconds := 5000), 1)
    ON CONFLICT (ip) DO NOTHING;
  END IF;
END;
$$;
--> statement-breakpoint
-- Também resolve o endereço das coordenadas de GPS
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

  -- Endereços das coordenadas de GPS (OpenStreetMap / Nominatim)
  UPDATE public.fertex_geo_coordenadas c
  SET bairro = coalesce(a ->> 'suburb', a ->> 'neighbourhood', a ->> 'quarter', a ->> 'city_district'),
      cidade = coalesce(a ->> 'city', a ->> 'town', a ->> 'village', a ->> 'municipality'),
      uf = nullif(split_part(a ->> 'ISO3166-2-lvl4', '-', 2), ''),
      pais_sigla = upper(a ->> 'country_code'),
      request_id = NULL,
      atualizado_em = now()
  FROM (
    SELECT r.id, (r.content::jsonb -> 'address') AS a
    FROM net._http_response r WHERE r.status_code = 200 AND r.content LIKE '{%'
  ) x
  WHERE x.id = c.request_id;

  UPDATE public.fertex_geo_coordenadas c
  SET request_id = net.http_get('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=pt-BR&lat=' || c.lat || '&lon=' || c.lon, headers := jsonb_build_object('User-Agent', 'FertexVendas/1.0 (https://fertex-textil.vercel.app)'), timeout_milliseconds := 8000),
      tentativas = c.tentativas + 1,
      atualizado_em = now()
  WHERE c.request_id IS NOT NULL
    AND c.tentativas < 3
    AND c.atualizado_em < now() - interval '1 minute'
    AND (
      EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = c.request_id AND (r.status_code IS DISTINCT FROM 200 OR r.timed_out))
      OR (NOT EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = c.request_id) AND c.atualizado_em < now() - interval '10 minutes')
    );
END;
$$;
--> statement-breakpoint
-- Estatísticas: GPS (bairro/cidade) com prioridade sobre o IP
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
    -- Localização: GPS (se a pessoa autorizou) tem prioridade sobre a cidade aproximada do IP
    SELECT vi.*, (vi.criado_em AT TIME ZONE v_tz)::date AS dia,
           coalesce(c.cidade, g.cidade) AS cidade,
           CASE WHEN c.cidade IS NOT NULL THEN c.uf ELSE g.regiao_sigla END AS regiao_sigla,
           CASE WHEN c.cidade IS NOT NULL THEN NULL ELSE g.pais END AS pais,
           coalesce(c.pais_sigla, g.pais_sigla) AS pais_sigla,
           c.bairro,
           CASE WHEN vi.lat IS NOT NULL THEN 'gps' ELSE 'ip' END AS fonte,
           (g.request_id IS NOT NULL OR c.request_id IS NOT NULL) AS localizando
    FROM public.fertex_visitas vi
    LEFT JOIN public.fertex_ip_geo g ON g.ip = vi.ip
    LEFT JOIN public.fertex_geo_coordenadas c ON c.lat = vi.lat AND c.lon = vi.lon
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
    'com_gps', (SELECT count(*) FROM v WHERE fonte = 'gps'),
    'bairros', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('bairro', bairro, 'cidade', cidade, 'regiao', regiao_sigla, 'visitas', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (
        SELECT bairro, cidade, regiao_sigla, count(*) AS n FROM v WHERE fonte = 'gps' AND bairro IS NOT NULL
        GROUP BY 1, 2, 3 ORDER BY n DESC LIMIT 10
      ) b
    ),
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
        SELECT cidade, regiao_sigla, max(pais) AS pais, pais_sigla, count(*) AS n FROM v WHERE cidade IS NOT NULL OR pais_sigla IS NOT NULL
        GROUP BY cidade, regiao_sigla, pais_sigla ORDER BY n DESC LIMIT 10
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
               v.bairro, v.fonte, v.lat, v.lon,
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
