import { useEffect, useMemo, useState } from "react"
import { NavLink } from "react-router-dom"
import { getUser } from "../services/auth"

type Item = { to: string; label: string }
type Props = { open: boolean; items: Item[] }
type Group = { title: string; items: Item[] }

const LABEL_OVERRIDES: Record<string, string> = {
  pis: "Busca de PI",
  produtos: "Produto",
}

const norm = (s: string) => s.trim().toLowerCase()
const displayLabel = (original: string) => LABEL_OVERRIDES[norm(original)] ?? original

function canSeeMeuPerfil(role?: string | null) {
  const r = norm(role || "")
  return r === "executivo" || r === "admin"
}

function withMeuPerfil(allItems: Item[]) {
  const user = getUser()
  if (!canSeeMeuPerfil(user?.role)) return allItems

  const exists = allItems.some(
    (i) => norm(i.to) === "/meu-perfil" || norm(i.label) === "meu perfil"
  )
  if (exists) return allItems

  return [{ to: "/meu-perfil", label: "Meu Perfil" }, ...(allItems || [])]
}

function buildGroups(allItems: Item[]): Group[] {
  const byLabel = new Map(allItems.map((i) => [norm(i.label), i]))
  const take = (label: string) => {
    const v = byLabel.get(norm(label))
    if (v) byLabel.delete(norm(label))
    return v
  }

  const comercialOrder = [
    "Meu Perfil",
    "PIs",
    "Cadastrar PI",
    "Matrizes",
    "Executivos",
    "Agências",
    "Anunciantes",
    "Produtos",
    "Vendas",
  ]

  const opecOrder = ["Veiculações", "Entregas"]

  const comercialItems = comercialOrder.map(take).filter(Boolean) as Item[]
  const opecItems = opecOrder.map(take).filter(Boolean) as Item[]
  const leftovers = Array.from(byLabel.values())

  const groups: Group[] = []
  if (comercialItems.length) groups.push({ title: "Comercial", items: comercialItems })
  if (opecItems.length) groups.push({ title: "OPEC", items: opecItems })
  if (leftovers.length) groups.push({ title: "Outros", items: leftovers })

  return groups
}

export default function Sidebar({ open, items }: Props) {
  const enrichedItems = useMemo(() => withMeuPerfil(items || []), [items])
  const groups = useMemo(() => buildGroups(enrichedItems || []), [enrichedItems])

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.title, true]))
  )

  useEffect(() => {
    if (!open) {
      setExpanded((prev) =>
        Object.fromEntries(Object.keys(prev).map((k) => [k, false]))
      )
    }
  }, [open])

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev }
      for (const g of groups) {
        if (typeof next[g.title] !== "boolean") next[g.title] = true
      }
      return next
    })
  }, [groups])

  const toggle = (title: string) =>
    setExpanded((prev) => ({ ...prev, [title]: !prev[title] }))

  return (
    <aside
      className={[
        "relative z-20 text-white shadow-2xl",
        "bg-gradient-to-b from-red-700 via-red-700 to-red-800",
        "transition-all duration-300",
        open ? "w-80" : "w-24",
        "min-h-[calc(100vh-80px)]",
        "flex flex-col",
        "overflow-hidden", // 🔒 evita scroll no container externo
      ].join(" ")}
      role="navigation"
      aria-label="Menu lateral"
    >
      {/* HEADER FIXO */}
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

      {/* ✅ ÁREA COM SCROLL */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 custom-scroll">
        <nav className="p-3 space-y-3">
          {groups.map((group) => {
            const isOpen = !!expanded[group.title]
            return (
              <section key={group.title} className="select-none">
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
                >
                  <span className={open ? "block" : "hidden"}>{group.title}</span>
                  <span
                    aria-hidden
                    className={[
                      "transition-transform",
                      open ? (isOpen ? "rotate-0" : "-rotate-90") : "hidden",
                    ].join(" ")}
                  >
                    ▾
                  </span>
                  {!open && <span className="w-6 h-1.5 bg-white/30 rounded-full" />}
                </button>

                {isOpen && open && (
                  <ul className="mt-1">
                    {group.items.map((item) => {
                      const shownLabel = displayLabel(item.label)
                      return (
                        <li key={`${group.title}-${item.to}`} className="mb-2 last:mb-0">
                          <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              [
                                "group flex items-center rounded-xl px-4 py-3",
                                "text-[17px] font-medium transition-colors",
                                isActive
                                  ? "bg-white/20 ring-1 ring-white/20 shadow-inner"
                                  : "hover:bg-white/10",
                              ].join(" ")
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span
                                  className={[
                                    "mr-4 h-8 w-1.5 rounded-full",
                                    isActive ? "bg-white" : "bg-white/30",
                                  ].join(" ")}
                                />
                                <span className={open ? "ml-2 block truncate" : "hidden"}>
                                  {shownLabel}
                                </span>
                              </>
                            )}
                          </NavLink>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
