// ===========================================================
// lib/redirect.ts - Utilitários de Redirecionamento Seguro
// ===========================================================

/**
 * Valida e sanitiza o parâmetro `next` de redirecionamento
 * 
 * Regras de segurança:
 * - Deve começar com `/`
 * - Não pode conter `//` (evita redirect para outro domínio)
 * - Não pode conter `@` (evita ataques de URL confusão)
 * 
 * @param next - Parâmetro next da query string
 * @param fallback - URL padrão se next for inválido
 * @returns URL segura para redirecionamento
 */
export function safeNext(next: unknown, fallback = '/minha-conta'): string {
  // Deve ser string
  if (typeof next !== 'string') {
    return fallback;
  }

  const trimmed = next.trim();

  // Deve começar com /
  if (!trimmed.startsWith('/')) {
    return fallback;
  }

  // Não pode ter // (evita redirect para outro domínio como //evil.com)
  if (trimmed.includes('//')) {
    return fallback;
  }

  // Não pode ter @ (evita ataques como /user@evil.com)
  if (trimmed.includes('@')) {
    return fallback;
  }

  // Não pode começar com /\ (Windows path confusion)
  if (trimmed.startsWith('/\\')) {
    return fallback;
  }

  return trimmed;
}

/**
 * Extrai mensagem de sucesso da query string
 */
export function getSuccessMessage(query: Record<string, unknown>): string | null {
  if (query.registered === '1') {
    return 'Conta criada com sucesso! Faça login para continuar.';
  }
  if (query.reset === '1') {
    return 'Senha redefinida com sucesso! Faça login com sua nova senha.';
  }
  return null;
}
