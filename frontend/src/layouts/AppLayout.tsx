// src/layouts/AppLayout.tsx
import { useMemo, useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import Header from "../components/Header"
import { clearSession, getUser } from "../services/auth"

function norm(v?: string | null) {
  return (v || "").toLowerCase().trim()
}

export default function AppLayout() {
  const [open, setOpen] = useState(true)
  const navigate = useNavigate()
  const user = getUser()
  const role = norm(user?.role)

  function handleLogout() {
    clearSession()
    navigate("/login", { replace: true })
  }

  const items = useMemo(() => {
    // ACL:
    // admin: tudo
    // executivo: PI, Cadastrar PI, Matrizes (dele), Veiculações, Entregas, Produtos (read-only), Executivos (read-only), Meu Perfil
    // opec: Veiculações, Entregas, Financeiro
    // financeiro: Financeiro apenas

    if (role === "financeiro") {
      return [{ to: "/faturamentos", label: "Financeiro" }]
    }

    if (role === "opec") {
      return [
        { to: "/veiculacoes", label: "Veiculações" },
        { to: "/entregas", label: "Entregas" },
        { to: "/faturamentos", label: "Financeiro" },
      ]
    }

    if (role === "executivo") {
      return [
        { to: "/meu-perfil", label: "Meu Perfil" },
        { to: "/pis", label: "PIs" },
        { to: "/pis/cadastro", label: "Cadastrar PI" },
        { to: "/matrizes", label: "Matrizes" },
        { to: "/veiculacoes", label: "Veiculações" },
        { to: "/entregas", label: "Entregas" },
        { to: "/produtos", label: "Produtos (somente leitura)" },
        { to: "/executivos", label: "Executivos (somente leitura)" },
      ]
    }

    if (role === "admin") {
      const base = [
        { to: "/admin/usuarios", label: "Admin • Usuários" },
        { to: "/pis", label: "PIs" },
        { to: "/pis/cadastro", label: "Cadastrar PI" },
        { to: "/matrizes", label: "Matrizes" },
        { to: "/vendas", label: "Vendas" },
        { to: "/veiculacoes", label: "Veiculações" },
        { to: "/entregas", label: "Entregas" },
        { to: "/faturamentos", label: "Financeiro" },
        { to: "/produtos", label: "Produtos" },
        { to: "/agencias", label: "Agências" },
        { to: "/anunciantes", label: "Anunciantes" },
        { to: "/executivos", label: "Executivos" },
      ]
      return base
    }

    // ✅ fallback seguro: role desconhecido não ganha menu “admin”
    return [{ to: "/pis", label: "PIs" }]
  }, [role])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        onToggleSidebar={() => setOpen((v) => !v)}
        rightSlot={
          <div className="flex items-center gap-3">
            {user?.email && (
              <span className="hidden md:inline text-sm text-white/85">
                {user.email}
              </span>
            )}

            <button
              onClick={handleLogout}
              className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-semibold transition"
              title="Sair"
            >
              Sair
            </button>
          </div>
        }
      />

      <div className="flex w-full">
        <div className="sticky top-[80px] h-[calc(100vh-80px)]">
          <Sidebar open={open} items={items} />
        </div>

        <main className="flex-1 p-4 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
