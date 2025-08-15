// src/layouts/AppLayout.tsx
import { useState } from "react"
import Sidebar from "../components/Sidebar"
import Header from "../components/Header"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  const items = [
    { to: "/", label: "Início" },
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header fixo (vermelho) */}
      <Header onToggleSidebar={() => setOpen((v) => !v)} />

      {/* LAYOUT EM LINHA: sidebar à esquerda, conteúdo à direita */}
      <div className="flex w-full">
        {/* Wrapper sticky pra sidebar ficar colada na lateral abaixo do header */}
        <div className="sticky top-[56px] h-[calc(100vh-56px)]">
          <Sidebar open={open} items={items} />
        </div>

        {/* Área de conteúdo */}
        <main className="flex-1 p-4 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
