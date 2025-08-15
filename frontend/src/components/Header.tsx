import { Link } from "react-router-dom"

type Props = {
  onToggleSidebar: () => void
}

export default function Header({ onToggleSidebar }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-red-600 text-white shadow">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1"
            title="Mostrar/ocultar menu"
          >
            ☰
          </button>
          <Link to="/" className="font-semibold">
            Sistema de Veiculações
          </Link>
        </div>

        <div className="text-xs sm:text-sm opacity-90">
          API: {import.meta.env.VITE_API_URL || "http://localhost:8000"}
        </div>
      </div>
    </header>
  )
}
