/**
 * Imagem de compartilhamento (Vercel Edge Function).
 *   /api/og?produto=<id>                 card 1200×630 do produto (prévia no WhatsApp/Facebook)
 *   /api/og?vendedor=<id>                card da loja do vendedor
 *   /api/og                              card da loja geral
 *   &formato=story                       versão 1080×1920 para Stories do Instagram
 */
import { createElement } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ImageResponse } from '@vercel/og'
import {
  buscarProduto,
  contarProdutos,
  nomeDoVendedor,
  precoPor,
  produtosDoVendedor,
  textoCores,
  textoMinimo,
} from '../edge/dados'
import type { ProdutoPublico } from '../edge/dados'

export const config = { runtime: 'edge' }

const COR = { marca: '#4f46e5', marcaEscura: '#3730a3', texto: '#0f172a', suave: '#475569', fundo: '#f8fafc', whatsapp: '#1f8a4c' }

type Filho = ReactNode | ReactNode[]
/** Elemento com display:flex (exigência do gerador de imagens para divs com vários filhos) */
const box = (style: CSSProperties, ...filhos: Filho[]) => createElement('div', { style: { display: 'flex', ...style } }, ...filhos)
const img = (src: string, style: CSSProperties) => createElement('img', { src, style })

const cortar = (t: string, max: number) => (t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t)

async function carregarFonte(peso: 400 | 700): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${peso}`)).text()
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
    return url ? await (await fetch(url)).arrayBuffer() : null
  } catch {
    return null
  }
}

/** Baixa a foto e embute como data URI (se falhar, o card sai sem foto em vez de quebrar) */
async function fotoDataUri(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const tipo = r.headers.get('content-type') ?? 'image/jpeg'
    if (!/image\/(jpeg|png)/.test(tipo)) return null
    const bytes = new Uint8Array(await r.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return `data:${tipo};base64,${btoa(bin)}`
  } catch {
    return null
  }
}

const logo = (tam: number) =>
  box(
    { alignItems: 'center', gap: tam * 0.35 },
    box(
      { width: tam, height: tam, borderRadius: tam * 0.22, background: COR.marca, alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: tam * 0.62, fontWeight: 700 },
      'F',
    ),
    box({ fontSize: tam * 0.55, fontWeight: 700, color: COR.texto }, 'Fertex', box({ color: COR.marca, marginLeft: tam * 0.18 }, 'Vendas')),
  )

const chip = (texto: string, tam: number) =>
  box({ background: '#eef2ff', color: COR.marcaEscura, borderRadius: 999, padding: `${tam * 0.35}px ${tam * 0.8}px`, fontSize: tam, fontWeight: 700 }, texto)

const botaoWhatsapp = (tam: number, texto = 'Faça seu pedido pelo WhatsApp') =>
  box({ background: COR.whatsapp, color: 'white', borderRadius: tam * 0.6, padding: `${tam * 0.55}px ${tam * 1.1}px`, fontSize: tam, fontWeight: 700 }, texto)

const semFoto = (tam: number) =>
  box({ width: '100%', height: '100%', background: '#e0e7ff', alignItems: 'center', justifyContent: 'center', color: COR.marca, fontSize: tam, fontWeight: 700 }, 'F')

function cardProduto(p: ProdutoPublico, foto: string | null, vendedor: string | null) {
  const minimo = textoMinimo(p)
  const cores = textoCores(p.cores)
  return box(
    { width: 1200, height: 630, background: 'white', fontFamily: 'Inter' },
    box({ width: 560, height: 630, flexShrink: 0 }, foto ? img(foto, { width: 560, height: 630, objectFit: 'cover' }) : semFoto(200)),
    box(
      { flexDirection: 'column', justifyContent: 'space-between', padding: '48px 52px', flex: 1 },
      logo(44),
      box(
        { flexDirection: 'column', gap: 14 },
        box({ fontSize: 22, color: COR.suave, textTransform: 'uppercase', letterSpacing: 2 }, cortar(p.categoria, 30)),
        box({ fontSize: 48, fontWeight: 700, color: COR.texto, lineHeight: 1.15 }, cortar(p.nome, 60)),
        box({ fontSize: 60, fontWeight: 700, color: COR.marca, marginTop: 6 }, precoPor(p)),
        box({ flexWrap: 'wrap', gap: 10, marginTop: 6 }, ...(minimo ? [chip(minimo, 22)] : []), ...(cores ? [chip(`Cores: ${cores}`, 22)] : [])),
      ),
      box(
        { flexDirection: 'column', gap: 14 },
        botaoWhatsapp(26),
        ...(vendedor ? [box({ fontSize: 22, color: COR.suave }, `Loja de ${vendedor}`)] : []),
      ),
    ),
  )
}

function cardLoja(titulo: string, total: number, fotos: string[]) {
  const grade = fotos.slice(0, 4)
  return box(
    { width: 1200, height: 630, background: COR.fundo, fontFamily: 'Inter' },
    box(
      { flexDirection: 'column', justifyContent: 'space-between', padding: '56px 56px', width: 620, background: 'white' },
      logo(48),
      box(
        { flexDirection: 'column', gap: 18 },
        box({ fontSize: 64, fontWeight: 700, color: COR.texto, lineHeight: 1.1 }, cortar(titulo, 40)),
        box({ fontSize: 30, color: COR.suave }, `${total} ${total === 1 ? 'produto disponível' : 'produtos disponíveis'}`),
      ),
      botaoWhatsapp(28, 'Veja os produtos e peça pelo WhatsApp'),
    ),
    box(
      { flexWrap: 'wrap', width: 580, height: 630, gap: 8, padding: 8, background: '#e0e7ff' },
      ...(grade.length
        ? grade.map((f) => img(f, { width: grade.length === 1 ? 564 : 278, height: grade.length <= 2 ? 614 : 303, objectFit: 'cover', borderRadius: 18 }))
        : [box({ width: 564, height: 614, alignItems: 'center', justifyContent: 'center', color: COR.marca, fontSize: 220, fontWeight: 700 }, 'F')]),
    ),
  )
}

function storyProduto(p: ProdutoPublico, foto: string | null, vendedor: string | null) {
  const minimo = textoMinimo(p)
  const cores = textoCores(p.cores, 6)
  return box(
    { width: 1080, height: 1920, flexDirection: 'column', background: 'white', fontFamily: 'Inter' },
    box({ width: 1080, height: 960, flexShrink: 0 }, foto ? img(foto, { width: 1080, height: 960, objectFit: 'cover' }) : semFoto(360)),
    // margem inferior maior: o Instagram desenha os próprios botões na parte de baixo dos Stories
    box(
      { flexDirection: 'column', justifyContent: 'space-between', padding: '60px 72px 170px', flex: 1, gap: 40 },
      box(
        { flexDirection: 'column', gap: 22 },
        box({ fontSize: 34, color: COR.suave, textTransform: 'uppercase', letterSpacing: 3 }, cortar(p.categoria, 30)),
        box({ fontSize: 76, fontWeight: 700, color: COR.texto, lineHeight: 1.1 }, cortar(p.nome, 50)),
        box({ fontSize: 96, fontWeight: 700, color: COR.marca }, precoPor(p)),
        box({ flexWrap: 'wrap', gap: 14 }, ...(minimo ? [chip(minimo, 34)] : []), ...(cores ? [chip(`Cores: ${cores}`, 34)] : [])),
      ),
      box(
        { flexDirection: 'column', gap: 28, alignItems: 'flex-start' },
        botaoWhatsapp(40, 'Toque no link e faça seu pedido'),
        box({ alignItems: 'center', gap: 24 }, logo(64), ...(vendedor ? [box({ fontSize: 34, color: COR.suave }, `· ${vendedor}`)] : [])),
      ),
    ),
  )
}

function storyLoja(titulo: string, total: number, fotos: string[]) {
  const grade = fotos.slice(0, 4)
  return box(
    { width: 1080, height: 1920, flexDirection: 'column', background: 'white', fontFamily: 'Inter' },
    box(
      { flexWrap: 'wrap', width: 1080, height: 1080, gap: 10, padding: 10, background: '#e0e7ff' },
      ...(grade.length
        ? grade.map((f) => img(f, { width: grade.length === 1 ? 1060 : 525, height: grade.length <= 2 ? 1060 : 525, objectFit: 'cover', borderRadius: 24 }))
        : [box({ width: 1060, height: 1060, alignItems: 'center', justifyContent: 'center', color: COR.marca, fontSize: 400, fontWeight: 700 }, 'F')]),
    ),
    box(
      { flexDirection: 'column', justifyContent: 'space-between', padding: '72px 72px 96px', flex: 1 },
      box(
        { flexDirection: 'column', gap: 20 },
        box({ fontSize: 88, fontWeight: 700, color: COR.texto, lineHeight: 1.1 }, cortar(titulo, 40)),
        box({ fontSize: 44, color: COR.suave }, `${total} ${total === 1 ? 'produto disponível' : 'produtos disponíveis'}`),
      ),
      box({ flexDirection: 'column', gap: 32, alignItems: 'flex-start' }, botaoWhatsapp(40, 'Toque no link e faça seu pedido'), logo(64)),
    ),
  )
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url)
  const story = searchParams.get('formato') === 'story'
  const produtoId = searchParams.get('produto')
  const vendedorId = searchParams.get('vendedor')
  const [regular, negrito] = await Promise.all([carregarFonte(400), carregarFonte(700)])
  const fonts = [
    ...(regular ? [{ name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const }] : []),
    ...(negrito ? [{ name: 'Inter', data: negrito, weight: 700 as const, style: 'normal' as const }] : []),
  ]

  let elemento
  const produto = produtoId ? await buscarProduto(produtoId) : null
  if (produto) {
    const [foto, vendedor] = await Promise.all([fotoDataUri(produto.foto_url), nomeDoVendedor(produto.vendedor_id)])
    elemento = story ? storyProduto(produto, foto, vendedor) : cardProduto(produto, foto, vendedor)
  } else {
    const [nome, lista, total] = await Promise.all([nomeDoVendedor(vendedorId), produtosDoVendedor(vendedorId, 8), contarProdutos(vendedorId)])
    const fotos = (await Promise.all(lista.map((p) => fotoDataUri(p.foto_url)))).filter((f): f is string => !!f)
    const titulo = nome ? `Loja de ${nome}` : 'Catálogo Fertex'
    elemento = story ? storyLoja(titulo, total, fotos) : cardLoja(titulo, total, fotos)
  }

  return new ImageResponse(elemento, {
    width: story ? 1080 : 1200,
    height: story ? 1920 : 630,
    ...(fonts.length ? { fonts } : {}),
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
