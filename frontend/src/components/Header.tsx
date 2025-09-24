// src/components/Header.tsx
import { Link } from "react-router-dom"

type Props = { onToggleSidebar: () => void }

export default function Header({ onToggleSidebar }: Props) {
  return (
    // 80px de altura
    <header className="sticky top-0 z-30 h-20 bg-gradient-to-r from-red-700 via-red-700 to-red-800 text-white shadow">
      <div className="h-full w-full px-6 flex items-center justify-between">
        {/* Esquerda: menu + brand */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3 text-2xl leading-none"
            title="Mostrar/ocultar menu"
            aria-label="Mostrar/ocultar menu lateral"
          >
            ☰
          </button>

          <Link
            to="/"
            className="font-extrabold text-3xl tracking-wide hover:opacity-95 transition-opacity"
          >
            Sistema para veiculos de Comunicação
            
          </Link>
        </div>

        {/* Direita: info da API + avatar */}
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-base opacity-90">
            API: {import.meta.env.VITE_API_URL || "http://localhost:8000"}
          </span>

          <div
            className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-base font-semibold"
            title="Usuário"
          >
            U
          </div>
        </div>
      </div>
    </header>
  )
}
