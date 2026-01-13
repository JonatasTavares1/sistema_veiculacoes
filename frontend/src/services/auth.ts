// src/services/auth.ts
export const TOKEN_KEY = "auth_token"
export const USER_KEY = "auth_user"

// Configure aqui o domínio permitido (ou use .env)
export const ALLOWED_DOMAIN =
  (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN as string) || "@metropoles.com"

export type AuthUser = {
  id?: number | string
  email: string
  role?: string
  nome?: string
}

export function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase()
}

export function isAllowedEmail(email: string) {
  const normalized = normalizeEmail(email)
  return normalized.includes("@") && normalized.endsWith(ALLOWED_DOMAIN)
}

/**
 * Salva sessão:
 * - remember=true  -> localStorage (persiste após fechar navegador)
 * - remember=false -> sessionStorage (expira ao fechar navegador)
 *
 * Importante: limpa o outro storage para não ficar ambíguo.
 */
export function setSession(token: string, user: AuthUser, remember: boolean = true) {
  const safeUser: AuthUser = { ...user, email: normalizeEmail(user?.email) }

  try {
    const target = remember ? localStorage : sessionStorage
    const other = remember ? sessionStorage : localStorage

    // limpa o outro storage
    other.removeItem(TOKEN_KEY)
    other.removeItem(USER_KEY)

    target.setItem(TOKEN_KEY, token)
    target.setItem(USER_KEY, JSON.stringify(safeUser))
  } catch {
    // ignore
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // ignore
  }
}

/** Prioriza sessionStorage e cai para localStorage */
export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** Prioriza sessionStorage e cai para localStorage */
export function getUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    if (!parsed?.email) return null
    return { ...parsed, email: normalizeEmail(parsed.email) }
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return Boolean(getToken())
}

export function hasRole(role: string) {
  const u = getUser()
  const r = (u?.role || "").toLowerCase()
  return r === String(role || "").toLowerCase()
}
