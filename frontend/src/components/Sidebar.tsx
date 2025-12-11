import { useEffect, useMemo, useState } from "react"
import { NavLink } from "react-router-dom"

type Item  = { to: string; label: string }
type Props = { open: boolean; items: Item[] }
type Group = { title: string; items: Item[] }

const LABEL_OVERRIDES: Record<string, string> = {
  pis: "Busca de PI",
  produtos: "Produto",
}
const norm = (s: string) => s.trim().toLowerCase()
const displayLabel = (original: string) => LABEL_OVERRIDES[norm(original)] ?? original

function buildGroups(allItems: Item[]): Group[] {
  // Apenas estes três itens devem aparecer no menu
  const allowed = new Set<string>(["executivos", "agências", "anunciantes", "agencias"])

  const filtered = allItems.filter(i => allowed.has(norm(i.label)))

  const byLabel = new Map(filtered.map(i => [norm(i.label), i]))
  const take = (label: string) => {
    const key = norm(label)
    const v = byLabel.get(key)
    if (v) byLabel.delete(key)
    return v
  }

  // Ordem explícita no grupo
  const comercialOrder = ["Executivos", "Agências", "Anunciantes"]

  const comercialItems = comercialOrder.map(take).filter(Boolean) as Item[]

  const groups: Group[] = []
  if (comercialItems.length) {
    groups.push({ title: "Comercial", items: comercialItems })
  }
  return groups
}

export default function Sidebar({ open, items }: Props) {
  const groups = useMemo(() => buildGroups(items || []), [items])
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    () => Object.fromEntries(groups.map(g => [g.title, true]))
  )

  useEffect(() => {
    if (!open) {
      setExpanded(prev =>
        Object.fromEntries(Object.keys(prev).map(k => [k, false])),
      )
    }
  }, [open])

  const toggle = (title: string) =>
    setExpanded(prev => ({ ...prev, [title]: !prev[title] }))

  return (
    <aside
      className={[
        "relative z-20 text-white shadow-2xl",
        "bg-gradient-to-b from-red-700 via-red-700 to-red-800",
        "transition-all duration-300",
        open ? "w-80" : "w-24",
        "min-h-[calc(100vh-80px)]",
        "flex flex-col",
      ].join(" ")}
      role="navigation"
      aria-label="Menu lateral"
    >
      {/* topo (fixo) */}
      <div className="px-5 py-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black">
            PI
          </div>
          <div className={open ? "block" : "hidden"}>
            <div className="text-2xl font-semibold leading-none">Menu</div>
            <div className="text-sm text-white/85 mt-1">Navegação</div>
          </div>
        </div>
      </div>

      {/* corpo com SCROLL */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scroll">
        <nav className="p-3 space-y-3">
          {groups.map(group => {
            const isOpen = !!expanded[group.title]
            return (
              <section key={group.title} className="select-none">
                {/* Cabeçalho do grupo (um pouco maior) */}
                <button
                  type="button"
                  onClick={() => toggle(group.title)}
                  aria-expanded={isOpen}
                  className={[
                    "w-full flex items-center justify-between px-2 py-1",
                    "text-white/90",
                    open
                      ? "text-lg font-bold uppercase tracking-wider"
                      : "text-[11px] uppercase",
                    "hover:text-white transition-colors",
                  ].join(" ")}
                  title={open ? group.title : undefined}
                >
                  <span className={open ? "block" : "hidden"}>
                    {group.title}
                  </span>
                  <span
                    aria-hidden
                    className={[
                      "transition-transform",
                      open ? (isOpen ? "rotate-0" : "-rotate-90") : "hidden",
                    ].join(" ")}
                  >
                    ▾
                  </span>
                  {!open && (
                    <span className="w-6 h-1.5 bg-white/30 rounded-full" />
                  )}
                </button>

                {/* Lista (aparece/some; scroll fica no container pai) */}
                <div className={isOpen && open ? "block" : "hidden"}>
                  <ul className="mt-1">
                    {group.items.map(item => {
                      const shownLabel = displayLabel(item.label)
                      return (
                        <li
                          key={`${group.title}-${item.to}`}
                          className="mb-2 last:mb-0"
                        >
                          <NavLink
                            to={item.to}
                            end={item.to === "/"}
                            className={({ isActive }) =>
                              [
                                "group flex items-center rounded-xl px-4 py-3",
                                "text-[17px] font-medium",
                                "transition-colors",
                                isActive
                                  ? "bg-white/20 ring-1 ring-white/20 shadow-inner"
                                  : "hover:bg-white/10",
                              ].join(" ")
                            }
                            title={shownLabel}
                          >
                            {({ isActive }) => (
                              <>
                                <span
                                  className={[
                                    "mr-4 h-8 w-1.5 rounded-full transition-all",
                                    isActive
                                      ? "bg-white"
                                      : "bg-white/30 group-hover:bg-white/50",
                                  ].join(" ")}
                                />
                                <span
                                  className={[
                                    "inline-flex h-9 w-9 items-center justify-center rounded-xl text-2xl",
                                    isActive
                                      ? "bg-white/25"
                                      : "bg-white/10 group-hover:bg-white/20",
                                  ].join(" ")}
                                  aria-hidden
                                >
                                  •
                                </span>
                                <span
                                  className={
                                    (open ? "ml-4 block" : "ml-0 hidden") +
                                    " truncate"
                                  }
                                >
                                  {shownLabel}
                                </span>
                              </>
                            )}
                          </NavLink>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </section>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
