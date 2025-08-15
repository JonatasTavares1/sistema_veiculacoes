import { useState } from "react"
import Header from "../components/Header"
import Sidebar from "../components/Sidebar"

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
      <Header onToggleSidebar={() => setOpen((v) => !v)} />

      <div className="mx-auto max-w-7xl flex">
        <Sidebar open={open} items={items} />
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  )
}
