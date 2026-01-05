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

import logoNegativa from "../assets/logo-negativa_.png";
import logoSvg from "../assets/logo.svg";

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

type LoginResponse = {
  token: string;
  user: AuthUser;
};

function IconMail(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 7.5C4 6.119 5.119 5 6.5 5h11C18.881 5 20 6.119 20 7.5v9c0 1.381-1.119 2.5-2.5 2.5h-11C5.119 19 4 17.881 4 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M6 8l6 4.2L18 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7.5 10.5V8.6a4.5 4.5 0 0 1 9 0v1.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.8 10.5h10.4c.994 0 1.8.806 1.8 1.8v5.9c0 .994-.806 1.8-1.8 1.8H6.8A1.8 1.8 0 0 1 5 18.2v-5.9c0-.994.806-1.8 1.8-1.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function IconEye(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function IconEyeOff(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 4.5 21 19.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.1 7.1C3.6 9 2.5 12 2.5 12s3.5 7 9.5 7c2 0 3.7-.6 5.1-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden">
      {/* background: glow + vinheta + grain */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-64 -left-64 h-[820px] w-[820px] rounded-full bg-red-600/20 blur-3xl" />
        <div className="absolute -bottom-72 -right-64 h-[900px] w-[900px] rounded-full bg-red-700/12 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff12,transparent_48%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(0,0,0,0.75))]" />
        <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22 x=%220%22 y=%220%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.35%22/%3E%3C/svg%3E')]" />
      </div>

      <div className="relative min-h-screen grid place-items-center p-6">
        <div className="w-full max-w-md">
          {/* LOGO (mais impactante) */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-x-0 -top-10 h-36 bg-red-600/25 blur-3xl rounded-full" />
              <img
                src={logoNegativa}
                alt="Metrópoles"
                className="relative h-36 sm:h-40 w-auto select-none drop-shadow-[0_18px_40px_rgba(0,0,0,0.75)]"
                draggable={false}
              />
            </div>
          </div>

          {/* CARD premium (sheen no topo) */}
          <div className="relative rounded-2xl border border-zinc-800/90 bg-zinc-900/60 shadow-[0_30px_90px_-60px_rgba(0,0,0,0.95)] backdrop-blur p-6 overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 -top-20 h-40 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_55%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-600/45 to-transparent" />

            <div className="flex justify-between items-start gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Acessar sistema
                </h1>
                <p className="text-sm text-zinc-400 mt-1">
                  Restrito para contas corporativas ({ALLOWED_DOMAIN})
                </p>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full border border-red-600/30 bg-red-600/10 px-3 py-1 text-xs text-red-200">
                <img
                  src={logoSvg}
                  alt=""
                  className="h-3.5 w-3.5 opacity-90"
                  draggable={false}
                />
                Ambiente seguro
              </span>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {/* EMAIL */}
              <div>
                <label className="block text-sm mb-1 text-zinc-200">E-mail</label>

                <div
                  className={[
                    "flex items-center gap-2 rounded-xl border px-3 py-2",
                    "bg-zinc-950/55",
                    "transition-all",
                    "focus-within:ring-4 focus-within:ring-red-600/10",
                    emailOk
                      ? "border-zinc-800 focus-within:border-red-600/70"
                      : "border-red-600/70",
                  ].join(" ")}
                >
                  <IconMail className="h-4 w-4 text-zinc-500" />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder={`seu.nome${ALLOWED_DOMAIN}`}
                    className="w-full bg-transparent outline-none placeholder:text-zinc-600"
                    autoComplete="email"
                    required
                  />
                </div>

                {!emailOk && (
                  <p className="text-xs text-red-300 mt-1">
                    Use um e-mail que termine com {ALLOWED_DOMAIN}
                  </p>
                )}
              </div>

              {/* SENHA */}
              <div>
                <label className="block text-sm mb-1 text-zinc-200">Senha</label>

                <div className="flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 bg-zinc-950/55 transition-all focus-within:border-red-600/70 focus-within:ring-4 focus-within:ring-red-600/10">
                  <IconLock className="h-4 w-4 text-zinc-500" />
                  <input
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    type={showPass ? "text" : "password"}
                    className="w-full bg-transparent outline-none placeholder:text-zinc-600"
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="inline-flex items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-900/55 px-2 py-1 transition-colors"
                    aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                    title={showPass ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPass ? (
                      <IconEyeOff className="h-4 w-4 text-zinc-200" />
                    ) : (
                      <IconEye className="h-4 w-4 text-zinc-200" />
                    )}
                  </button>
                </div>
              </div>

              {/* ERRO */}
              {erro && (
                <div className="rounded-xl border border-red-900/70 bg-red-950/35 px-3 py-2 text-sm text-red-100">
                  {erro}
                </div>
              )}

              {/* CTA premium */}
              <button
                type="submit"
                disabled={loading}
                className={[
                  "w-full rounded-xl py-2.5 font-semibold",
                  "text-white",
                  "bg-gradient-to-r from-red-600 to-red-700",
                  "hover:from-red-500 hover:to-red-700",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  "transition-all",
                  "shadow-[0_18px_46px_-26px_rgba(220,38,38,0.95)]",
                ].join(" ")}
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              {/* LINKS */}
              <div className="flex justify-between text-sm mt-3">
                <button
                  type="button"
                  onClick={() => navigate("/cadastro")}
                  className="text-zinc-300 hover:text-white underline underline-offset-4 decoration-zinc-700 hover:decoration-zinc-300 transition-colors"
                >
                  Criar conta
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/esqueci-senha")}
                  className="text-zinc-300 hover:text-white underline underline-offset-4 decoration-zinc-700 hover:decoration-zinc-300 transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>

              {/* rodapé */}
              <div className="pt-4 mt-2 border-t border-zinc-800/70">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Ao acessar, você concorda com as políticas internas de segurança e
                  uso aceitável. Se precisar de acesso, solicite ao administrador.
                </p>
              </div>
            </form>
          </div>

          <div className="mt-5 text-center text-xs text-zinc-600">
            <span className="text-zinc-500">Dica:</span> use seu e-mail corporativo e
            senha cadastrada.
          </div>
        </div>
      </div>
    </div>
  );
}
