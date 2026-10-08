/**
 * Dados de exemplo: 1 vendedor, 1 comprador, 10 produtos com foto e vendas nos últimos 60 dias.
 * Uso: npm run db:seed   (pode rodar mais de uma vez: recria os dados de demonstração)
 *
 * Requer no .env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 * Os usuários são criados direto no banco (já confirmados). As fotos são enviadas ao Storage
 * autenticando como o vendedor, respeitando as mesmas regras de segurança do app.
 */
import 'dotenv/config'
import { deflateSync } from 'node:zlib'
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'

const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL: URL_SB, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY } = process.env
if (!DATABASE_URL || !URL_SB || !KEY) throw new Error('Configure DATABASE_URL e as variáveis NEXT_PUBLIC_SUPABASE_* no .env')

const SENHA = 'fertex123'
const VENDEDOR = { email: 'vendedor@fertex.demo', nome: 'Ana Souza', perfil: 'vendedor' }
const COMPRADOR = { email: 'comprador@fertex.demo', nome: 'Bruno Lima', perfil: 'comprador' }
const BUCKET = 'fertex-produtos'

type Padrao = 'listras' | 'xadrez' | 'poa' | 'liso' | 'diagonal'
const PRODUTOS: {
  nome: string
  descricao: string
  preco: number
  estoqueFinal: number
  categoria: string
  cores: [string, string]
  padrao: Padrao
}[] = [
  { nome: 'Tecido Linho Natural', descricao: 'Linho 100% natural, 1,40 m de largura. Preço por metro.', preco: 59.9, estoqueFinal: 38, categoria: 'Tecidos', cores: ['#d6c7a8', '#c9b892'], padrao: 'liso' },
  { nome: 'Tricoline Estampada Poá', descricao: 'Tricoline 100% algodão com estampa de poá. 1,50 m de largura. Preço por metro.', preco: 32.5, estoqueFinal: 55, categoria: 'Tecidos', cores: ['#1e3a8a', '#f8fafc'], padrao: 'poa' },
  { nome: 'Malha Algodão Penteado 30.1', descricao: 'Malha meia-malha fio 30.1 penteado, ideal para camisetas. Vendida por kg.', preco: 44.9, estoqueFinal: 30, categoria: 'Malhas', cores: ['#0f766e', '#115e59'], padrao: 'diagonal' },
  { nome: 'Moletom Flanelado Cinza Mescla', descricao: 'Moletom 3 cabos flanelado, toque macio. Vendido por kg.', preco: 54, estoqueFinal: 4, categoria: 'Malhas', cores: ['#9ca3af', '#6b7280'], padrao: 'diagonal' },
  { nome: 'Jeans Índigo 12oz', descricao: 'Denim 100% algodão, 12 oz, tingimento índigo. 1,60 m de largura.', preco: 49.9, estoqueFinal: 22, categoria: 'Tecidos', cores: ['#1e3a5f', '#2c5282'], padrao: 'diagonal' },
  { nome: 'Linha de Costura Poliéster 120', descricao: 'Cone com 2.000 jardas, alta resistência. Diversas cores.', preco: 6.5, estoqueFinal: 180, categoria: 'Linhas e fios', cores: ['#dc2626', '#fca5a5'], padrao: 'listras' },
  { nome: 'Kit Botões de Madeira (50 un.)', descricao: 'Botões de madeira natural, 4 furos, 15 mm.', preco: 18.9, estoqueFinal: 3, categoria: 'Aviamentos', cores: ['#92400e', '#b45309'], padrao: 'poa' },
  { nome: 'Zíper Invisível 40 cm', descricao: 'Zíper invisível para vestidos e saias. Diversas cores.', preco: 4.2, estoqueFinal: 140, categoria: 'Aviamentos', cores: ['#111827', '#374151'], padrao: 'listras' },
  { nome: 'Toalha de Banho Fio Penteado', descricao: 'Toalha 70 × 140 cm, 500 g/m², 100% algodão fio penteado.', preco: 39.9, estoqueFinal: 0, categoria: 'Cama, mesa e banho', cores: ['#e0f2fe', '#7dd3fc'], padrao: 'xadrez' },
  { nome: 'Jogo de Lençol Percal 200 Fios', descricao: 'Jogo casal com 4 peças, percal 200 fios, 100% algodão.', preco: 149.9, estoqueFinal: 12, categoria: 'Cama, mesa e banho', cores: ['#f5f5f4', '#d6d3d1'], padrao: 'xadrez' },
]

// ---------- Imagens PNG geradas (padrões de tecido) ----------
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (tipo: string, dados: Buffer) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(dados.length)
  const td = Buffer.concat([Buffer.from(tipo), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

function gerarPng(padrao: Padrao, [c1, c2]: [string, string], tam = 480): Buffer {
  const a = hex(c1)
  const b = hex(c2)
  const linhas: Buffer[] = []
  for (let y = 0; y < tam; y++) {
    const linha = Buffer.alloc(1 + tam * 3)
    for (let x = 0; x < tam; x++) {
      let usaB: boolean
      switch (padrao) {
        case 'listras': usaB = Math.floor(y / 24) % 2 === 0; break
        case 'xadrez': usaB = (Math.floor(x / 40) + Math.floor(y / 40)) % 2 === 0; break
        case 'poa': { const dx = (x % 48) - 24, dy = (y % 48) - 24; usaB = dx * dx + dy * dy < 90; break }
        case 'diagonal': usaB = Math.floor((x + y) / 6) % 2 === 0; break
        default: usaB = (x * 7 + y * 13) % 17 === 0 // trama sutil
      }
      // leve ruído para parecer tecido
      const ruido = ((x * 31 + y * 17) % 7) - 3
      const cor = usaB ? b : a
      linha[1 + x * 3] = Math.max(0, Math.min(255, cor[0] + ruido))
      linha[2 + x * 3] = Math.max(0, Math.min(255, cor[1] + ruido))
      linha[3 + x * 3] = Math.max(0, Math.min(255, cor[2] + ruido))
    }
    linhas.push(linha)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(tam, 0)
  ihdr.writeUInt32BE(tam, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(linhas), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- Gerador pseudoaleatório determinístico ----------
let semente = 42
const rand = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const inteiro = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

async function main() {
  const sql = postgres(DATABASE_URL!, { max: 1, onnotice: () => {} })
  const sb = createClient(URL_SB!, KEY!, { auth: { persistSession: false } })

  try {
    // 1) Remove dados demo anteriores (fotos no Storage + usuários; o resto cai em cascata)
    const antigo = await sql`select id from auth.users where email = ${VENDEDOR.email}`
    if (antigo.length) {
      const { error } = await sb.auth.signInWithPassword({ email: VENDEDOR.email, password: SENHA })
      if (!error) {
        const { data: arquivos } = await sb.storage.from(BUCKET).list(antigo[0].id, { limit: 1000 })
        if (arquivos?.length) await sb.storage.from(BUCKET).remove(arquivos.map((a) => `${antigo[0].id}/${a.name}`))
        await sb.auth.signOut()
      }
    }
    await sql`
      delete from public.fertex_itens_pedido where pedido_id in (
        select p.id from public.fertex_pedidos p join auth.users u on u.id = p.comprador_id
        where u.email in (${VENDEDOR.email}, ${COMPRADOR.email}))`
    await sql`
      delete from public.fertex_itens_pedido where vendedor_id in (select id from auth.users where email = ${VENDEDOR.email})`
    await sql`delete from auth.users where email in (${VENDEDOR.email}, ${COMPRADOR.email})`
    console.log('• dados demo anteriores removidos')

    // 2) Usuários (o trigger fertex_on_auth_user_created cria os perfis)
    const ids: Record<string, string> = {}
    for (const u of [VENDEDOR, COMPRADOR]) {
      const [{ id }] = await sql`
        insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
          confirmation_token, recovery_token, email_change, email_change_token_new)
        values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', ${u.email},
          extensions.crypt(${SENHA}, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          ${sql.json({ nome: u.nome, fertex_perfil: u.perfil })}, now() - interval '70 days', now(), '', '', '', '')
        returning id`
      await sql`
        insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        values (${id}, ${id}, ${sql.json({ sub: id, email: u.email, email_verified: true })}, 'email', now(), now(), now())`
      ids[u.perfil] = id
    }
    console.log(`• usuários criados: ${VENDEDOR.email} e ${COMPRADOR.email} (senha: ${SENHA})`)

    // 3) Fotos: envia como o vendedor (pasta {vendedor_id}/)
    const { error: errLogin } = await sb.auth.signInWithPassword({ email: VENDEDOR.email, password: SENHA })
    if (errLogin) throw errLogin
    const fotos: string[] = []
    for (const [i, p] of PRODUTOS.entries()) {
      const caminho = `${ids.vendedor}/seed-${i + 1}.png`
      const { error } = await sb.storage.from(BUCKET).upload(caminho, gerarPng(p.padrao, p.cores), {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: true,
      })
      if (error) throw error
      fotos.push(sb.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl)
    }
    await sb.auth.signOut()
    console.log('• 10 fotos enviadas ao Storage')

    // 4) Produtos (estoque final já descontando as vendas abaixo)
    const produtos = await sql<{ id: string; preco: string }[]>`
      insert into public.fertex_produtos ${sql(
        PRODUTOS.map((p, i) => ({
          vendedor_id: ids.vendedor,
          nome: p.nome,
          descricao: p.descricao,
          preco: p.preco,
          estoque: p.estoqueFinal,
          categoria: p.categoria,
          foto_url: fotos[i],
          ativo: true,
          criado_em: new Date(Date.now() - 65 * 864e5),
        })),
      )}
      returning id, preco`

    // 5) Pedidos concluídos espalhados nos últimos 60 dias (mais frequentes nas últimas semanas)
    let totalPedidos = 0
    let totalItens = 0
    for (let n = 0; n < 32; n++) {
      const diasAtras = Math.floor(60 * rand() ** 1.6)
      const data = new Date(Date.now() - diasAtras * 864e5)
      data.setHours(inteiro(9, 20), inteiro(0, 59), 0, 0)
      if (data > new Date()) data.setTime(Date.now() - inteiro(5, 120) * 60e3)

      const escolhidos = new Set<number>()
      const qtdItens = inteiro(1, 3)
      while (escolhidos.size < qtdItens) escolhidos.add(inteiro(0, PRODUTOS.length - 1))
      const itens = [...escolhidos].map((i) => ({
        produto: produtos[i],
        quantidade: PRODUTOS[i].preco < 10 ? inteiro(2, 10) : inteiro(1, 4),
      }))
      const total = itens.reduce((s, it) => s + Number(it.produto.preco) * it.quantidade, 0)

      await sql.begin(async (tx) => {
        const [{ id: pedidoId }] = await tx`
          insert into public.fertex_pedidos (comprador_id, total, status, criado_em)
          values (${ids.comprador}, ${total.toFixed(2)}, 'concluido', ${data}) returning id`
        await tx`
          insert into public.fertex_itens_pedido ${tx(
            itens.map((it) => ({
              pedido_id: pedidoId,
              produto_id: it.produto.id,
              vendedor_id: ids.vendedor,
              quantidade: it.quantidade,
              preco_unitario: it.produto.preco,
            })),
          )}`
      })
      totalPedidos++
      totalItens += itens.length
    }
    console.log(`• ${totalPedidos} pedidos com ${totalItens} itens criados`)
    console.log('\nPronto! Entre no app com:')
    console.log(`  Vendedor:  ${VENDEDOR.email} / ${SENHA}`)
    console.log(`  Comprador: ${COMPRADOR.email} / ${SENHA}`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha no seed:', e.message ?? e)
  process.exit(1)
})
