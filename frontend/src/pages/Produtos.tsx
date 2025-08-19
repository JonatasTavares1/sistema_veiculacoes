// src/pages/Produtos.tsx
import { useEffect, useMemo, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

type ProdutoItem = {
  id: number
  nome: string
  descricao?: string | null
  valor_unitario?: number | null
}

function fmtMoney(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "R$ 0,00"
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}
async function postJSON<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try { const t = await r.json(); if (t?.detail) msg += ` - ${t.detail}` } catch {}
    throw new Error(msg)
  }
  return r.json()
}
async function putJSON<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try { const t = await r.json(); if (t?.detail) msg += ` - ${t.detail}` } catch {}
    throw new Error(msg)
  }
  return r.json()
}
async function del(url: string): Promise<void> {
  const r = await fetch(url, { method: "DELETE" })
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try { const t = await r.json(); if (t?.detail) msg += ` - ${t.detail}` } catch {}
    throw new Error(msg)
  }
}
function trataNumeroBR(s: string): number | null {
  const t = (s || "").trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}
function toBR(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return ""
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Produtos() {
  const [lista, setLista] = useState<ProdutoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [busca, setBusca] = useState("")

  // editor
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [editId, setEditId] = useState<number | null>(null)
  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")
  const [valorUnitario, setValorUnitario] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function carregar() {
    setLoading(true); setErro(null)
    try {
      const data = await getJSON<ProdutoItem[]>(`${API}/produtos`)
      setLista(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar produtos.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { carregar() }, [])

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista.filter(p =>
      !q ||
      p.nome.toLowerCase().includes(q) ||
      (p.descricao || "").toLowerCase().includes(q)
    )
  }, [lista, busca])

  function abrirCreate() {
    setMode("create")
    setEditId(null)
    setNome("")
    setDescricao("")
    setValorUnitario("")
    setFormError(null)
    setDrawerOpen(true)
  }
  async function abrirEdit(id: number) {
    setMode("edit")
    setEditId(id)
    setFormError(null)
    setSaving(false)
    try {
      const det = await getJSON<ProdutoItem>(`${API}/produtos/${id}`)
      setNome(det.nome || "")
      setDescricao(det.descricao || "")
      setValorUnitario(toBR(det.valor_unitario ?? null))
      setDrawerOpen(true)
    } catch (e: any) {
      setErro(e?.message || "Falha ao abrir produto.")
    }
  }
  function fecharDrawer() {
    setDrawerOpen(false)
    setFormError(null)
  }

  async function salvar() {
    setFormError(null)
    if (!nome.trim()) { setFormError("Informe o nome do produto."); return }
    const vu = trataNumeroBR(valorUnitario)
    if (vu != null && vu < 0) { setFormError("Valor unitário inválido."); return }

    setSaving(true)
    try {
      const body = {
        nome: nome.trim(),
        descricao: (descricao || "").trim() || null,
        valor_unitario: vu ?? null,
      }
      if (mode === "create") {
        await postJSON<ProdutoItem>(`${API}/produtos`, body)
      } else if (mode === "edit" && editId != null) {
        await putJSON<ProdutoItem>(`${API}/produtos/${editId}`, body)
      }
      fecharDrawer()
      await carregar()
    } catch (e: any) {
      setFormError(e?.message || "Falha ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  async function remover(id: number) {
    if (!confirm("Confirmar exclusão do produto?")) return
    try {
      await del(`${API}/produtos/${id}`)
      await carregar()
    } catch (e: any) {
      alert(e?.message || "Falha ao excluir.")
    }
  }

  async function exportarXLSX() {
    const rows = filtrada.map((p) => ({
      "ID": p.id,
      "Nome": p.nome,
      "Descrição": p.descricao || "",
      "Valor Unitário (R$)": p.valor_unitario ?? 0,
    }))
    const xlsx = await import("xlsx")
    const ws = xlsx.utils.json_to_sheet(rows, {
      header: Object.keys(rows[0] || {}),
    })
    const moneyCol = "Valor Unitário (R$)"
    rows.forEach((r, i) => {
      const cell = xlsx.utils.encode_cell({ r: i + 1, c: Object.keys(rows[0]).indexOf(moneyCol) })
      const v = r[moneyCol as keyof typeof r] as number
      ;(ws as any)[cell] = { t: "s", v: (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
    })
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, "Produtos")
    const now = new Date()
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-")
    xlsx.writeFile(wb, `produtos_${stamp}.xlsx`)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Produtos (Catálogo)</h1>
        <div className="flex items-center gap-3">
          <button onClick={exportarXLSX} className="px-5 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-lg hover:bg-slate-50">
            📤 Exportar XLSX
          </button>
          <button onClick={carregar} className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm">
            Atualizar
          </button>
          <button onClick={abrirCreate} className="px-5 py-3 rounded-2xl bg-emerald-600 text-white text-lg font-semibold hover:bg-emerald-700 transition shadow-sm">
            ➕ Novo Produto
          </button>
        </div>
      </div>

      {/* Filtros */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Buscar</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou descrição"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
        </div>
      </section>

      {/* Lista */}
      <section>
        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : erro ? (
          <div className="p-4 text-red-700 text-lg">{erro}</div>
        ) : filtrada.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nenhum produto encontrado.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-red-200 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-red-100">
              <div className="text-slate-700">{filtrada.length} registro(s)</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-red-200">
                <thead className="bg-gradient-to-r from-red-700 to-red-600 text-white sticky top-0">
                  <tr>
                    {["ID","Produto","Descrição","Valor Unitário","Ações"].map(h => (
                      <th key={h} className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {filtrada.map((p, idx) => (
                    <tr key={p.id} className={["transition", idx % 2 === 0 ? "bg-white" : "bg-red-50/40", "hover:bg-red-50"].join(" ")}>
                      <td className="px-6 py-4 text-slate-900 text-base font-medium">{p.id}</td>
                      <td className="px-6 py-4 text-slate-800 text-base">{p.nome}</td>
                      <td className="px-6 py-4 text-slate-800 text-base"><div className="max-w-[360px] truncate">{p.descricao || "—"}</div></td>
                      <td className="px-6 py-4 text-slate-900 text-base font-semibold">{fmtMoney(p.valor_unitario)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => abrirEdit(p.id)} className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50">✏️ Editar</button>
                          <button onClick={() => remover(p.id)} className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50">🗑️ Excluir</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharDrawer} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">
                  {mode === "create" ? "Novo Produto" : "Editar Produto"}
                </div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">
                  {mode === "create" ? "Criar" : "Atualizar"}
                </div>
              </div>
              <button onClick={fecharDrawer} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">✖ Fechar</button>
            </div>

            <div className="p-6 space-y-6">
              {formError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">{formError}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nome</label>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição (opcional)</label>
                  <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Valor Unitário (R$)</label>
                  <input
                    value={valorUnitario}
                    onChange={(e) => setValorUnitario(e.target.value)}
                    placeholder="ex: 1.234,56"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button onClick={salvar} disabled={saving} className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60">
                  {saving ? "Salvando..." : (mode === "create" ? "Criar produto" : "Salvar alterações")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
