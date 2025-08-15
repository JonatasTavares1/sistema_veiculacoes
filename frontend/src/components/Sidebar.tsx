import { NavLink } from "react-router-dom"

type Item = { to: string; label: string }
type Props = { open: boolean; items: Item[] }

export default function Sidebar({ open, items }: Props) {
  return (
    <aside
      className={[
        "relative z-20", // garante que fica acima do main
        "text-white shadow-2xl",
        "bg-gradient-to-b from-red-700 via-red-700 to-red-800",
        "transition-all duration-300",
        open ? "w-96" : "w-24",
        "min-h-[calc(100vh-80px)]" // <-- header 80px
      ].join(" ")}
      role="navigation"
      aria-label="Menu lateral"
    >
      {/* Branding / topo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center text-4xl font-black">
            PI
          </div>
          <div className={open ? "block" : "hidden"}>
            <div className="text-3xl font-semibold leading-none">Menu</div>
            <div className="text-lg text-white/85 mt-1">Navegação</div>
          </div>
        </div>
      </div>

      {/* Itens */}
      <nav className="p-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              [
                "group flex items-center rounded-2xl px-5 py-4 mb-2",
                "text-2xl font-semibold",
                "transition-colors",
                isActive
                  ? "bg-white/20 ring-1 ring-white/20 shadow-inner"
                  : "hover:bg-white/10"
              ].join(" ")
            }
            title={item.label}
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    "mr-5 h-10 w-2 rounded-full transition-all",
                    isActive ? "bg-white" : "bg-white/30 group-hover:bg-white/50"
                  ].join(" ")}
                />
                <span
                  className={[
                    "inline-flex h-12 w-12 items-center justify-center rounded-2xl text-3xl",
                    isActive ? "bg-white/25" : "bg-white/10 group-hover:bg-white/20"
                  ].join(" ")}
                >
                  •
                </span>
                <span className={(open ? "ml-5 block" : "ml-0 hidden") + " truncate"}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
