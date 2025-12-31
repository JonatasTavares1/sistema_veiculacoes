import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ALLOWED_DOMAIN, isAllowedEmail, normalizeEmail } from "../services/auth";

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailOk = useMemo(() => {
    if (!email) return true;
    return isAllowedEmail(email);
  }, [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOkMsg(null);

    const normalized = normalizeEmail(email);

    if (!isAllowedEmail(normalized)) {
      setErro(`Acesso permitido apenas para e-mails ${ALLOWED_DOMAIN}`);
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });

      // não depende de ok/nok para não vazar informação
      await resp.json().catch(() => ({}));
      setOkMsg("Se este e-mail estiver habilitado, enviaremos instruções de redefinição.");
    } catch (err: any) {
      setOkMsg("Se este e-mail estiver habilitado, enviaremos instruções de redefinição.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow p-6">
          <h1 className="text-2xl font-semibold">Recuperar senha</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Vamos enviar um link de redefinição para o seu e-mail corporativo ({ALLOWED_DOMAIN}).
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

            {erro && (
              <div className="rounded-xl border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {erro}
              </div>
            )}
            {okMsg && (
              <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
                {okMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 font-semibold"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </button>

            <div className="text-sm text-zinc-400 flex items-center justify-between">
              <Link to="/login" className="text-zinc-100 hover:underline">
                Voltar para login
              </Link>
              <Link to="/register" className="text-zinc-100 hover:underline">
                Criar cadastro
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
