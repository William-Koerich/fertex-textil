/** Erro com mensagem já pronta para o usuário (em português). */
export class AppError extends Error {}

export const MSG_SEM_CONEXAO = 'Não foi possível conectar ao servidor. Verifique sua internet.'

const porCodigo: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).',
  weak_password: 'Senha fraca. Use pelo menos 6 caracteres.',
  email_address_invalid: 'E-mail inválido.',
  over_email_send_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  signup_disabled: 'Novos cadastros estão desativados no momento.',
  // Postgres
  '23503': 'Este registro está vinculado a outros dados e não pode ser excluído.',
  '23505': 'Já existe um registro com esses dados.',
  '42501': 'Você não tem permissão para realizar esta ação.',
}

/** Converte erros do Supabase/rede em mensagens amigáveis em português. */
export function mensagemErro(err: unknown, padrao = 'Ocorreu um erro inesperado. Tente novamente.'): string {
  if (!err) return padrao
  if (err instanceof AppError) return err.message
  if (typeof navigator !== 'undefined' && !navigator.onLine) return MSG_SEM_CONEXAO
  const e = err as { code?: string; message?: string; name?: string }
  if (e.code && porCodigo[e.code]) return porCodigo[e.code]
  const msg = e.message ?? String(err)
  if (/failed to fetch|network|load failed/i.test(msg)) return MSG_SEM_CONEXAO
  if (/maximum allowed size|payload too large/i.test(msg)) return 'A foto é muito grande (máximo 5 MB).'
  if (/mime type/i.test(msg)) return 'Formato de imagem não suportado. Use JPG, PNG ou WebP.'
  if (/invalid login credentials/i.test(msg)) return porCodigo.invalid_credentials
  if (/already registered/i.test(msg)) return porCodigo.user_already_exists
  // Erros lançados pelas nossas funções SQL (RAISE EXCEPTION) já vêm em português
  if (e.code === 'P0001' && msg) return msg
  return padrao
}
