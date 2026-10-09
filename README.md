# Fertex Vendas

PWA de vendas (acelerador de vendas básico), mobile-first e em português. Vendedores cadastram produtos e acompanham vendas e resultados; compradores navegam pela loja, montam o carrinho e fazem pedidos.

**Stack:** React 19 + Vite + TypeScript · Tailwind CSS 4 · React Router · Supabase (Auth, Postgres, Storage) · Drizzle (schema e migrations) · vite-plugin-pwa · Recharts

## Funcionalidades

| Perfil | Telas |
|---|---|
| **Vendedor** | **Pedidos recebidos**: pedidos do WhatsApp aguardando, com **Marcar como vendido** (baixa o estoque) ou **Cancelar** · **Perfil**: nome, WhatsApp e link da loja (copiar/compartilhar) · **Painel**: faturamento total, do mês, vendas, ticket médio, estoque baixo, gráfico diário e top 5, com filtro de 7/30/90 dias · **Produtos**: lista com busca, criar/editar com foto, ativar/desativar, excluir e **registrar venda** · **Vendas**: tabela por item vendido, com filtro por período e produto e total no rodapé; também permite registrar vendas diretas |
| **Visitante (sem login)** | **Loja** e **detalhe do produto** públicos, incluindo o link de um vendedor (`/loja?vendedor=<id>`), e **carrinho**. O login só é pedido na hora de enviar o pedido, e o carrinho é mantido depois do login |
| **Comprador** | Tudo o que o visitante faz, mais **enviar o pedido pelo WhatsApp** (com observação) e **Meus pedidos**: situação de cada pedido, botão para falar no WhatsApp e cancelar o pedido |

Além disso: sessão persistente, rotas protegidas por perfil, tema claro/escuro/sistema, app instalável, funcionamento offline do app shell, aviso de nova versão e estados de carregamento, vazio e erro em todas as telas.

## Estrutura

```
db/schema.ts                 Schema Drizzle (tabelas, índices, checks e policies de RLS)
drizzle.config.ts            Configuração do drizzle-kit (só gerencia objetos fertex_*)
supabase/migrations/         Migrations SQL (geradas pelo Drizzle + customizadas)
  0000_schema.sql            Tabelas, RLS e policies
  0001_auth_perfil.sql       Trigger que cria o perfil no cadastro
  0002_storage_produtos.sql  Bucket de fotos e policies do Storage
  0003_finalizar_compra.sql  RPC transacional de checkout
  0004_vendas_vendedor.sql   RPC da tela de vendas
  0005_dashboard_vendedor.sql RPC do painel
  0006_venda_manual.sql      Origem do pedido (loja/manual) e nome do cliente
  0007_registrar_venda.sql   RPC de venda registrada pelo vendedor
  0008_pedido_whatsapp.sql   WhatsApp no perfil, observação/conclusão no pedido, vitrine pública
  0009_funcoes_whatsapp.sql  RPCs do pedido pelo WhatsApp (enviar, concluir, cancelar, listar)
  0010_unidade_exclusao.sql  Unidade de medida (produto e item vendido) e exclusão de produto com vendas
  0011_funcoes_unidade.sql   Trigger da unidade no item e RPCs atualizadas
  0012_dashboard_unidade.sql Painel com unidade de medida
  0013_quantidade_minima.sql Quantidade mínima por pedido no produto
  0014_pedido_minimo.sql     Pedido pelo WhatsApp valida o mínimo; checkout direto desativado
scripts/seed.ts              Dados de exemplo
src/
  contexts/                  Auth, carrinho, tema, toasts
  lib/                       Cliente Supabase, acesso a dados, formatação pt-BR, PWA
  components/                Layout, UI, PWA (instalar, atualizar, offline)
  features/auth|vendedor|comprador/   Telas
public/icons/                Ícones do PWA (192, 512 e maskable)
```

Todos os objetos do banco usam o prefixo `fertex` (`fertex_profiles`, `fertex_produtos`, `fertex_pedidos`, `fertex_itens_pedido`, funções `fertex_*` e bucket `fertex-produtos`). Assim o app pode dividir um projeto Supabase com outros sistemas sem conflito.

## 1. Criar o projeto no Supabase

1. Em [supabase.com](https://supabase.com), crie um projeto e guarde a senha do banco.
2. **Project Settings → API**: copie a **Project URL** e a **Publishable key** (`sb_publishable_...`).
3. **Connect → Session pooler**: copie a connection string (porta 5432). Ela vai no `DATABASE_URL`.
4. **Authentication → Sign In / Providers → Email**:
   - para testar sem precisar abrir e-mails, desative **Confirm email**. Com a opção ativa o app também funciona: depois do cadastro ele mostra "Confirme seu e-mail";
   - mantenha **Allow new users to sign up** ativado.
5. **Authentication → URL Configuration**: em **Site URL**, coloque a URL de produção (por exemplo `https://seu-app.vercel.app`) e adicione `http://localhost:5173` em **Redirect URLs**.

## 2. Configurar o `.env`

```bash
cp .env.example .env
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
DATABASE_URL=postgresql://postgres.SEU-PROJETO:SENHA@aws-0-REGIAO.pooler.supabase.com:5432/postgres?sslmode=require
```

- Só variáveis com prefixo `NEXT_PUBLIC_` vão para o front-end (`envPrefix` no `vite.config.ts`). O `DATABASE_URL` é usado apenas pelos scripts de migration e seed e **nunca** entra no bundle.
- Caracteres especiais na senha precisam ser codificados na URL (`@` vira `%40`, `#` vira `%23`).
- O `.env` está no `.gitignore`. Nunca faça commit dele.

## 3. Rodar as migrations

```bash
npm install
npm run db:migrate
```

O comando aplica, em ordem, os arquivos de `supabase/migrations` e registra o que foi aplicado em `drizzle.fertex_migrations`.

**Sem Node, pelo painel:** abra o **SQL Editor** e rode o conteúdo de cada arquivo `0000` → `0005`, na ordem. As linhas `--> statement-breakpoint` são comentários SQL e podem ficar.

**Para alterar o schema:** edite `db/schema.ts` e rode `npm run db:generate` para criar a migration. Para funções, triggers ou Storage, use `npx drizzle-kit generate --custom --name nome`. Depois aplique com `npm run db:migrate`. Não use `drizzle-kit push`: o banco pode ser compartilhado.

## 4. Dados de exemplo (opcional)

```bash
npm run db:seed
```

Cria 1 vendedor, 1 comprador, 10 produtos com foto (alguns com estoque baixo e um esgotado) e 32 pedidos espalhados nos últimos 60 dias. Pode ser rodado de novo: recria só os dados de demonstração.

| Perfil | E-mail | Senha |
|---|---|---|
| Vendedor | `vendedor@fertex.demo` | `fertex123` |
| Comprador | `comprador@fertex.demo` | `fertex123` |

## 5. Rodar localmente

```bash
npm run dev       # http://localhost:5173
```

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos (`tsc -b`) + build de produção em `dist/` |
| `npm run preview` | Serve o build em http://localhost:4173 (use para testar o PWA) |
| `npm run db:generate` | Gera migration a partir de `db/schema.ts` |
| `npm run db:migrate` | Aplica as migrations pendentes |
| `npm run db:seed` | Cria os dados de exemplo |

O service worker só é registrado no build. Para testar instalação, cache offline e o aviso de nova versão, rode `npm run build && npm run preview`. No Chrome, **DevTools → Application → Manifest/Service workers** mostra o estado. Para simular a falta de conexão, use **Network → Offline**.

## 6. Publicar

### Vercel

1. Importe o repositório em [vercel.com/new](https://vercel.com/new). O `vercel.json` já define build, saída, rewrite de SPA e cabeçalhos do service worker.
2. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. O `DATABASE_URL` não é necessário no deploy.
3. Faça o deploy e coloque a URL gerada em **Site URL** no Supabase (passo 1.5).

CLI: `npx vercel` e depois `npx vercel --prod`.

### Netlify

1. Em [app.netlify.com](https://app.netlify.com), use **Add new site → Import an existing project**. O `netlify.toml` já configura o build (`npm run build`, pasta `dist`), o redirect de SPA e os cabeçalhos.
2. Em **Site configuration → Environment variables**, adicione as duas variáveis `NEXT_PUBLIC_*`.
3. Faça o deploy e atualize a **Site URL** no Supabase.

CLI: `npx netlify deploy --build` e depois `npx netlify deploy --build --prod`.

O PWA só é instalável em HTTPS (ou `localhost`). Vercel e Netlify já servem com HTTPS.

## Segurança (RLS)

Row Level Security está ativo em todas as tabelas `fertex_*`. A chave publicável só dá acesso ao que as policies abaixo permitem.

| Tabela | Regra |
|---|---|
| `fertex_profiles` | cada usuário lê só o próprio perfil e só pode alterar nele **nome e WhatsApp**; a criação é feita pelo trigger de cadastro. Visitantes veem apenas o nome dos vendedores que têm produtos ativos (`fertex_vendedores_publicos`) |
| `fertex_produtos` | qualquer pessoa, **mesmo sem login**, lê os produtos **ativos**; só vendedores criam, e cada um só edita/exclui os próprios (e vê os próprios inativos) |
| `fertex_pedidos` | o comprador vê apenas os próprios pedidos; ninguém insere direto |
| `fertex_itens_pedido` | o vendedor vê só os itens dos próprios produtos; o comprador vê os itens dos próprios pedidos |
| Storage `fertex-produtos` | leitura pública das fotos; cada vendedor só grava/apaga na pasta `{seu id}/`; até 5 MB, só JPG/PNG/WebP |

- **Checkout direto** (`fertex_finalizar_compra`, mantido no banco mas **sem permissão de execução** desde a migration 0014; a tela usa o pedido pelo WhatsApp): uma transação trava as linhas dos produtos (`FOR UPDATE`), valida disponibilidade e estoque, grava o pedido e os itens com o **preço do banco** e baixa o estoque. Duas compras simultâneas da última unidade resultam em uma venda e um erro de "estoque insuficiente". O estoque nunca fica negativo.
- **Pedido pelo WhatsApp** (`fertex_enviar_pedido_whatsapp`): o comprador logado envia o carrinho. A função valida disponibilidade e estoque, exige que o vendedor tenha WhatsApp cadastrado e cria **um pedido por vendedor** com status `pendente`, **sem baixar o estoque**. O app abre o WhatsApp do vendedor (`wa.me`) com a mensagem pronta: itens, total, nome e observação. Depois de combinar, o vendedor clica em **Marcar como vendido** (`fertex_concluir_pedido`), que trava os produtos, confere o estoque, baixa o estoque e conclui a venda (ela entra no painel e em "Produtos vendidos" na data da conclusão). Também pode clicar em **Cancelar** (`fertex_cancelar_pedido`, permitido também ao comprador enquanto o pedido estiver pendente).
- **Venda direta** (`fertex_registrar_venda`): o vendedor registra uma venda feita fora do app (balcão, WhatsApp…), com quantidade, preço unitário (preenchido com o preço atual) e nome do cliente opcional. A função trava o produto, confere que ele é do próprio vendedor e que há estoque, cria o pedido com origem `manual` e baixa o estoque. A venda aparece em "Produtos vendidos" com o selo "Venda direta" e entra no painel.
- **Vendas e painel** (`fertex_vendas_vendedor`, `fertex_dashboard_vendedor`): funções `security definer` sempre filtradas por `auth.uid()`. Elas expõem ao vendedor só o nome do comprador e a data dos pedidos dos próprios produtos.
- **Excluir produto:** um produto sem vendas é apagado do banco, junto com a foto. Um produto com vendas é marcado como excluído (`excluido_em`): sai da lista do vendedor e da loja e não pode mais ser vendido, mas as vendas continuam no painel, em "Produtos vendidos" e nos pedidos do comprador.
- **Unidade de medida** (kg, litro, saco, unidade, caixa, rolo, metro): é obrigatória no cadastro, e preço e estoque usam essa unidade (por exemplo, "R$ 27,00/kg" e "50 kg disponíveis"). Cada item vendido guarda a unidade do momento da venda (trigger `fertex_itens_unidade`), então mudar a unidade do produto depois não altera o histórico. As quantidades são números inteiros.
- **Quantidade mínima por pedido** (opcional, na unidade do produto, ex.: 200 kg): aparece na loja e no detalhe ("Pedido mínimo: 200 kg"). Ao adicionar ao carrinho, o produto já entra com o mínimo, e a quantidade não pode ficar abaixo dele. Se o estoque estiver abaixo do mínimo, o produto aparece como indisponível. A função `fertex_enviar_pedido_whatsapp` também recusa pedidos abaixo do mínimo, então não dá para contornar pela API. A venda direta registrada pelo vendedor não exige o mínimo.

## Observações

- Datas e totais por dia usam o fuso `America/Sao_Paulo`. Valores aparecem em R$ no formato pt-BR.
- O carrinho fica salvo no aparelho, separado por usuário. Ao abrir o carrinho, preço e estoque são conferidos de novo.
- "Estoque baixo" significa 5 unidades ou menos (`ESTOQUE_BAIXO` em `src/lib/produtos.ts`).
- O Lighthouse removeu a categoria "PWA" na versão 12. A instalabilidade pode ser conferida em **DevTools → Application → Manifest**. Nas categorias atuais, o build marca Performance 97, Acessibilidade, Boas práticas e SEO 100.
