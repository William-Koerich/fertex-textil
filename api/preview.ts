/**
 * HTML com as meta tags de prévia (título, descrição, imagem) para robôs do WhatsApp, Facebook etc.
 * O vercel.json só reescreve para cá quando o user-agent é de um robô; visitantes recebem o site normal.
 *   /loja/<id>          → /api/preview?produto=<id>
 *   /loja?vendedor=<id> → /api/preview?vendedor=<id>
 *   /                    → /api/preview
 */
import { montarMeta, tags } from '../edge/preview'

export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  const pedido = new URL(req.url)
  const produto = pedido.searchParams.get('produto')
  // Reconstrói a URL original (a que foi compartilhada) para og:url e para a montagem das meta tags
  const original = new URL(produto ? `/loja/${produto}` : '/loja', pedido.origin)
  for (const [k, v] of pedido.searchParams) if (k !== 'produto') original.searchParams.set(k, v)

  const ua = req.headers.get('user-agent') ?? ''
  const [resposta, meta] = await Promise.all([fetch(new URL('/index.html', pedido.origin)), montarMeta(original, ua)])
  const base = resposta.ok ? await resposta.text() : '<!doctype html><html lang="pt-BR"><head><!-- og:inicio --><!-- og:fim --></head><body></body></html>'
  const html = base.replace(/<!-- og:inicio[\s\S]*?<!-- og:fim -->/, tags(meta, original.toString()))
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=600' },
  })
}
