// src/services/auth.ts
export const TOKEN_KEY = "auth_token";
export const USER_KEY = "auth_user";

// Configure aqui o domínio permitido (ou use .env)
export const ALLOWED_DOMAIN =
  (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN as string) || "@metropoles.com";

export type AuthUser = {
  id?: number | string;
  email: string;
  role?: string;
  nome?: string;
};

export function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function isAllowedEmail(email: string) {
  const normalized = normalizeEmail(email);
  return normalized.includes("@") && normalized.endsWith(ALLOWED_DOMAIN);
}

export function setSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getToken());
}
