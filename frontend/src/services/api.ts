// src/services/api.ts
import { clearSession, getToken } from "./auth";

const API_BASE =
  (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

type RequestOptions = RequestInit & {
  auth?: boolean; // default true
};

// ✅ IMPORTANTE: como você usa Bearer Token, NÃO use include por padrão.
// Isso evita quebrar CORS quando o backend responde com ACAO: *
const DEFAULT_CREDENTIALS: RequestCredentials = "omit";

function withTs(path: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}ts=${Date.now()}`;
}

function joinUrl(base: string, path: string) {
  const b = (base || "").replace(/\/+$/, "");
  const p = (path || "").startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function buildHeaders(extra?: HeadersInit, auth: boolean = true, body?: any) {
  const h = new Headers(extra || {});

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isForm && !h.has("Content-Type")) {
    h.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getToken();
    if (token) h.set("Authorization", `Bearer ${token}`);
  }

  return h;
}

async function handle401(resp: Response) {
  if (resp.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Não autorizado. Faça login novamente.");
  }
}

async function parseError(resp: Response) {
  let msg = `${resp.status} ${resp.statusText}`;
  const ct = resp.headers.get("content-type") || "";

  try {
    if (ct.includes("application/json")) {
      const j: any = await resp.json();
      if (j?.detail) {
        msg += ` - ${
          typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)
        }`;
      } else if (j?.error) {
        msg += ` - ${j.error}`;
      }
    } else {
      const t = await resp.text();
      if (t) msg += ` - ${t}`;
    }
  } catch {
    // ignore
  }

  return msg;
}

export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: any,
  opts?: RequestOptions
): Promise<T> {
  const auth = opts?.auth ?? true;

  const url = joinUrl(API_BASE, withTs(path));

  const resp = await fetch(url, {
    ...opts,
    method,
    headers: buildHeaders(opts?.headers, auth, body),
    cache: opts?.cache ?? "no-store",

    // ✅ omit por padrão (CORS ok com ACAO: *)
    credentials: opts?.credentials ?? DEFAULT_CREDENTIALS,

    body:
      method === "GET" || method === "DELETE"
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body ?? {}),
  });

  await handle401(resp);

  if (!resp.ok) {
    throw new Error(await parseError(resp));
  }

  if (resp.status === 204) return {} as T;

  const ct = resp.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await resp.json()) as T;
  return (await resp.text()) as T;
}

export async function apiDownloadBlob(
  path: string,
  opts?: RequestOptions
): Promise<Blob> {
  const auth = opts?.auth ?? true;
  const url = joinUrl(API_BASE, withTs(path));

  const resp = await fetch(url, {
    ...opts,
    method: "GET",
    headers: buildHeaders(opts?.headers, auth),
    cache: opts?.cache ?? "no-store",
    credentials: opts?.credentials ?? DEFAULT_CREDENTIALS,
  });

  await handle401(resp);

  if (!resp.ok) {
    throw new Error(await parseError(resp));
  }

  return await resp.blob();
}

export const apiGet = <T>(path: string, opts?: RequestOptions) =>
  apiRequest<T>("GET", path, undefined, opts);

export const apiPost = <T>(path: string, body?: any, opts?: RequestOptions) =>
  apiRequest<T>("POST", path, body, opts);

export const apiPut = <T>(path: string, body?: any, opts?: RequestOptions) =>
  apiRequest<T>("PUT", path, body, opts);

export const apiDelete = <T>(path: string, opts?: RequestOptions) =>
  apiRequest<T>("DELETE", path, undefined, opts);
