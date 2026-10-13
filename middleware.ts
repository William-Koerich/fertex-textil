/**
 * Vercel Routing Middleware: prévia bonita dos links (Open Graph) para Facebook, Instagram, WhatsApp etc.
 *
 * O app é uma SPA: os robôs dessas redes não executam JavaScript, então o título/descrição/imagem
 * precisam estar no HTML. Quando um robô acessa /loja ou /loja/<produto>, injetamos as meta tags
 * do produto/loja no index.html. Visitantes humanos recebem o site normal (sem atraso extra).
 */
import { buscarProduto, contarProdutos, nomeDoVendedor, precoPor, produtosDoVendedor, textoCores, textoMinimo } from './edge/dados'

export const config = { matcher: ['/', '/loja', '/loja/:path*'] }

const ROBOS = /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|pinterest|skypeuripreview|googlebot|bingbot|applebot|embedly|vkshare|redditbot/i

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

interface Meta {
  titulo: string
  descricao: string
  imagem: string
  /** omitidos quando a imagem é a foto original (tamanho desconhecido) */
  largura?: number
  altura?: number
  tipo: 'website' | 'product'
  extras?: string
}

function tags(m: Meta, url: string) {
  return [
    `<title>${esc(m.titulo)}</title>`,
    `<meta name="description" content="${esc(m.descricao)}" />`,
    `<meta property="og:site_name" content="Fertex Vendas" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:type" content="${m.tipo}" />`,
    `<meta property="og:title" content="${esc(m.titulo)}" />`,
    `<meta property="og:description" content="${esc(m.descricao)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(m.imagem)}" />`,
    `<meta property="og:image:secure_url" content="${esc(m.imagem)}" />`,
    m.largura ? `<meta property="og:image:width" content="${m.largura}" />` : '',
    m.altura ? `<meta property="og:image:height" content="${m.altura}" />` : '',
    `<meta property="og:image:alt" content="${esc(m.titulo)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.titulo)}" />`,
    `<meta name="twitter:description" content="${esc(m.descricao)}" />`,
    `<meta name="twitter:image" content="${esc(m.imagem)}" />`,
    m.extras ?? '',
  ]
    .filter(Boolean)
    .join('\n    ')
}

export async function montarMeta(url: URL, userAgent: string): Promise<Meta> {
  // WhatsApp costuma ignorar imagens pesadas: para ele usamos a foto (JPG) em vez do card gerado (PNG)
  const whatsapp = /whatsapp/i.test(userAgent)
  const og = (q: string) => `${url.origin}/api/og${q}`
  const produtoId = url.pathname.match(/^\/loja\/([^/]+)/)?.[1]

  if (produtoId) {
    const p = await buscarProduto(produtoId)
    if (p) {
      const vendedor = await nomeDoVendedor(p.vendedor_id)
      const partes = [textoMinimo(p), textoCores(p.cores) && `Cores: ${textoCores(p.cores)}`, vendedor && `Vendido por ${vendedor}`]
      return {
        titulo: `${p.nome} · ${precoPor(p)}`,
        descricao: [...partes.filter(Boolean), 'Faça seu pedido pelo WhatsApp.'].join(' · '),
        imagem: whatsapp && p.foto_url ? p.foto_url : og(`?produto=${p.id}`),
        ...(whatsapp && p.foto_url ? {} : { largura: 1200, altura: 630 }),
        tipo: 'product',
        extras: `<meta property="product:price:amount" content="${p.preco.toFixed(2)}" />\n    <meta property="product:price:currency" content="BRL" />`,
      }
    }
  }

  const vendedorId = url.searchParams.get('vendedor')
  const [nome, total, lista] = await Promise.all([nomeDoVendedor(vendedorId), contarProdutos(vendedorId), produtosDoVendedor(vendedorId, 1)])
  const titulo = nome ? `Loja de ${nome} · Fertex Vendas` : 'Fertex Vendas · Catálogo e pedidos pelo WhatsApp'
  const foto = lista[0]?.foto_url
  return {
    titulo,
    descricao: `${total} ${total === 1 ? 'produto disponível' : 'produtos disponíveis'}. Veja o catálogo e faça seu pedido pelo WhatsApp.`,
    imagem: whatsapp && foto ? foto : og(nome && vendedorId ? `?vendedor=${vendedorId}` : ''),
    ...(whatsapp && foto ? {} : { largura: 1200, altura: 630 }),
    tipo: 'website',
  }
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const ua = request.headers.get('user-agent') ?? ''
  if (request.method !== 'GET' || !ROBOS.test(ua)) return undefined // segue o fluxo normal

  try {
    const url = new URL(request.url)
    const [resposta, meta] = await Promise.all([fetch(new URL('/index.html', url)), montarMeta(url, ua)])
    if (!resposta.ok) return undefined
    const html = (await resposta.text()).replace(/<!-- og:inicio[\s\S]*?<!-- og:fim -->/, tags(meta, url.toString()))
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=600' },
    })
  } catch {
    return undefined
  }
}
