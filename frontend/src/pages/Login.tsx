// src/pages/Login.tsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ALLOWED_DOMAIN,
  isAllowedEmail,
  normalizeEmail,
  setSession,
  type AuthUser,
} from "../services/auth";

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

type LoginResponse = {
  token: string;
  user: AuthUser;
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation() as any;

  const emailOk = useMemo(() => {
    if (!email) return true;
    return isAllowedEmail(email);
  }, [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const normalized = normalizeEmail(email);

    if (!isAllowedEmail(normalized)) {
      setErro(`Acesso permitido apenas para e-mails ${ALLOWED_DOMAIN}`);
      return;
    }

    if (!senha || senha.trim().length < 4) {
      setErro("Informe a senha.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, senha }),
      });

      const data = (await resp.json()) as any;

      if (!resp.ok) {
        const msg = data?.error || data?.detail || "Falha no login";
        throw new Error(msg);
      }

      const parsed = data as LoginResponse;
      if (!parsed?.token) throw new Error("Resposta inválida do servidor.");

      setSession(parsed.token, parsed.user);

      const dest = location?.state?.from?.pathname || "/";
      navigate(dest, { replace: true });
    } catch (err: any) {
      setErro(err?.message || "Erro no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow p-6">
          <h1 className="text-2xl font-semibold">Acessar sistema</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Restrito para contas corporativas ({ALLOWED_DOMAIN})
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-zinc-300 mb-1">E-mail</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder={`seu.nome${ALLOWED_DOMAIN}`}
                className={[
                  "w-full rounded-xl bg-zinc-950 border px-3 py-2 outline-none",
                  emailOk ? "border-zinc-800 focus:border-red-600" : "border-red-600",
                ].join(" ")}
                required
              />
              {!emailOk && (
                <p className="text-xs text-red-400 mt-1">
                  Use um e-mail que termine com {ALLOWED_DOMAIN}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-zinc-300 mb-1">Senha</label>
              <input
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                type="password"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-red-600"
                required
              />
            </div>

            {erro && (
              <div className="rounded-xl border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 font-semibold"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <p className="text-xs text-zinc-500">
              Dica: se o backend ainda não tiver `/auth/login`, eu te passo o backend assim que você colar o trecho do servidor.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}