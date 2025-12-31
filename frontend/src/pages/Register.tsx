import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ALLOWED_DOMAIN, isAllowedEmail, normalizeEmail } from "../services/auth";

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

export default function Register() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

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
    if (!senha || senha.trim().length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== senha2) {
      setErro("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, senha }),
      });

      const data = await resp.json().catch(() => ({} as any));
      if (!resp.ok) {
        const msg = data?.detail || data?.error || "Falha ao cadastrar.";
        throw new Error(msg);
      }

      setOkMsg("Cadastro enviado para aprovação. Você receberá um e-mail quando for aprovado.");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err: any) {
      setErro(err?.message || "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow p-6">
          <h1 className="text-2xl font-semibold">Criar cadastro</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Restrito para contas corporativas ({ALLOWED_DOMAIN}). O acesso depende de aprovação do administrador.
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

            <div>
              <label className="block text-sm text-zinc-300 mb-1">Confirmar senha</label>
              <input
                value={senha2}
                onChange={(e) => setSenha2(e.target.value)}
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
              {loading ? "Enviando..." : "Enviar cadastro"}
            </button>

            <div className="text-sm text-zinc-400">
              Já tem conta?{" "}
              <Link to="/login" className="text-zinc-100 hover:underline">
                Entrar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
