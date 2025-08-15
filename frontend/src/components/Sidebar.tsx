import { NavLink } from "react-router-dom"

type Item = { to: string; label: string }
type Props = { open: boolean; items: Item[] }

export default function Sidebar({ open, items }: Props) {
  return (
    <aside
      className={[
        "transition-all duration-200",
        open ? "w-60" : "w-16",
        "bg-white border-r border-slate-200 min-h-[calc(100vh-56px)]"
      ].join(" ")}
    >
      <nav className="p-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm mb-1",
                isActive
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "text-slate-700 hover:bg-slate-50"
              ].join(" ")
            }
            title={item.label}
          >
            <span className="inline-block w-4 text-center">•</span>
            <span className={open ? "block" : "hidden"}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
