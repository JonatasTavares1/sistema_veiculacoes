// src/layouts/AppLayout.tsx
import { useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import Header from "../components/Header"
import { clearSession, getUser } from "../services/auth"

export default function AppLayout() {
  const [open, setOpen] = useState(true)
  const navigate = useNavigate()

  const user = getUser()

  function handleLogout() {
    clearSession()
    navigate("/login", { replace: true })
  }

  const items = [
    { to: "/pis", label: "PIs" },
    { to: "/pis/cadastro", label: "Cadastrar PI" },
    { to: "/matrizes", label: "Matrizes" },
    { to: "/veiculacoes", label: "Veiculações" },
    { to: "/entregas", label: "Entregas" },
    { to: "/produtos", label: "Produtos" },
    { to: "/agencias", label: "Agências" },
    { to: "/anunciantes", label: "Anunciantes" },
    { to: "/executivos", label: "Executivos" },
  ]

  // Item extra para admin (opcional)
  if (user?.role === "admin") {
    items.unshift({ to: "/admin/usuarios", label: "Admin • Usuários" })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header fixo (vermelho) */}
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

      {/* LAYOUT EM LINHA: sidebar à esquerda, conteúdo à direita */}
      <div className="flex w-full">
        {/* Wrapper sticky pra sidebar ficar colada na lateral abaixo do header */}
        <div className="sticky top-[80px] h-[calc(100vh-80px)]">
          <Sidebar open={open} items={items} />
        </div>

        {/* Área de conteúdo */}
        <main className="flex-1 p-4 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
