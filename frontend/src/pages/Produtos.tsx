// src/pages/Produtos.tsx
import { useEffect, useMemo, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

type Modalidade = "DIA" | "SPOT" | "CPM" | "PACOTE"

type Produto = {
  id: number
  nome: string
  descricao?: string | null
  categoria?: string | null
  modalidade_preco?: Modalidade | null
  unidade_rotulo?: string | null
  base_segundos?: number | null
  valor_unitario?: number | null
}

/* ========= Helpers com timeout e logs ========= */
function withTimeout(ms: number) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  return { signal: c.signal, cancel: () => clearTimeout(t) }
}

async function getJSON<T>(url: string): Promise<T> {
  const { signal, cancel } = withTimeout(15000)
  try {
    console.log("[GET]", url)
    const r = await fetch(url, { signal })
    console.log("[GET][resp]", r.status, r.statusText)
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    return await r.json()
  } catch (e: any) {
    console.error("[GET][err]", url, e?.message || e)
    if (e?.name === "AbortError") throw new Error("Tempo excedido (15s) ao buscar produtos.")
    throw e
  } finally {
    cancel()
  }
}
async function postJSON<T>(url: string, body: any): Promise<T> {
  const { signal, cancel } = withTimeout(15000)
  try {
    console.log("[POST]", url, body)
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    })
    console.log("[POST][resp]", r.status, r.statusText)
    if (!r.ok) {
      let msg = `${r.status} ${r.statusText}`
      try {
        const t = await r.json()
        if (t?.detail) msg += ` - ${typeof t.detail === "string" ? t.detail : JSON.stringify(t.detail)}`
      } catch {}
      throw new Error(msg)
    }
    return await r.json()
  } catch (e: any) {
    console.error("[POST][err]", url, e?.message || e)
    if (e?.name === "AbortError") throw new Error("Tempo excedido (15s) ao salvar.")
    throw e
  } finally {
    cancel()
  }
}
async function putJSON<T>(url: string, body: any): Promise<T> {
  const { signal, cancel } = withTimeout(15000)
  try {
    console.log("[PUT]", url, body)
    const r = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    })
    console.log("[PUT][resp]", r.status, r.statusText)
    if (!r.ok) {
      let msg = `${r.status} ${r.statusText}`
      try {
        const t = await r.json()
        if (t?.detail) msg += ` - ${typeof t.detail === "string" ? t.detail : JSON.stringify(t.detail)}`
      } catch {}
      throw new Error(msg)
    }
    return await r.json()
  } catch (e: any) {
    console.error("[PUT][err]", url, e?.message || e)
    if (e?.name === "AbortError") throw new Error("Tempo excedido (15s) ao salvar.")
    throw e
  } finally {
    cancel()
  }
}
async function del(url: string): Promise<void> {
  const { signal, cancel } = withTimeout(15000)
  try {
    console.log("[DEL]", url)
    const r = await fetch(url, { method: "DELETE", signal })
    console.log("[DEL][resp]", r.status, r.statusText)
    if (!r.ok) {
      let msg = `${r.status} ${r.statusText}`
      try {
        const t = await r.json()
        if (t?.detail) msg += ` - ${typeof t.detail === "string" ? t.detail : JSON.stringify(t.detail)}`
      } catch {}
      throw new Error(msg)
    }
  } catch (e: any) {
    console.error("[DEL][err]", url, e?.message || e)
    if (e?.name === "AbortError") throw new Error("Tempo excedido (15s) ao excluir.")
    throw e
  } finally {
    cancel()
  }
}

/* ========= Página ========= */
export default function Produtos() {
  const [lista, setLista] = useState<Produto[]>([])
  const [busca, setBusca] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // editor
  const [open, setOpen] = useState(false)
  const [modo, setModo] = useState<"create" | "edit">("create")
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Produto>({
    id: 0,
    nome: "",
    descricao: "",
    categoria: "",
    modalidade_preco: "PACOTE",
    unidade_rotulo: "",
    base_segundos: null,
    valor_unitario: null,
  })

  function campo<K extends keyof Produto>(k: K, v: Produto[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function carregar() {
    setLoading(true); setErro(null)
    try {
      const q = busca.trim() ? `?termo=${encodeURIComponent(busca.trim())}` : ""
      const rows = await getJSON<Produto[]>(`${API}/produtos${q}`)
      setLista(rows || [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar")
    } finally { setLoading(false) }
  }
  useEffect(() => { carregar() }, [])
  useEffect(() => { const t = setTimeout(carregar, 300); return () => clearTimeout(t) }, [busca])

  const filtrada = useMemo(() => lista, [lista])

  function novo() {
    setModo("create"); setEditId(null)
    setForm({
      id: 0,
      nome: "",
      descricao: "",
      categoria: "",
      modalidade_preco: "PACOTE",
      unidade_rotulo: "",
      base_segundos: null,
      valor_unitario: null,
    })
    setOpen(true)
  }
  function editar(p: Produto) {
    setModo("edit"); setEditId(p.id)
    setForm({ ...p, modalidade_preco: (p.modalidade_preco || "PACOTE") as Modalidade })
    setOpen(true)
  }

  async function salvar() {
    if (saving) return
    const payload = {
      nome: (form.nome || "").trim(),
      descricao: form.descricao || null,
      categoria: form.categoria || null,
      modalidade_preco: form.modalidade_preco || null,
      unidade_rotulo: form.unidade_rotulo || null,
      base_segundos: form.base_segundos ?? null,
      valor_unitario: form.valor_unitario ?? null,
    }
    if (!payload.nome) { alert("Informe o nome do produto."); return }

    setSaving(true)
    try {
      if (modo === "create") {
        await postJSON<Produto>(`${API}/produtos`, payload)
      } else if (editId != null) {
        await putJSON<Produto>(`${API}/produtos/${editId}`, payload)
      }
      setOpen(false)
      await carregar()
    } catch (e: any) {
      alert(e?.message || "Falha ao salvar")
    } finally {
      setSaving(false)
    }
  }

  async function remover(id: number) {
    if (!confirm("Excluir produto?")) return
    try {
      await del(`${API}/produtos/${id}`)
      await carregar()
    } catch (e: any) {
      alert(e?.message || "Falha ao excluir")
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Produtos (Catálogo)</h1>
        <div className="flex gap-2">
          <button onClick={novo} className="px-5 py-3 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700">➕ Novo</button>
          <button onClick={carregar} className="px-5 py-3 rounded-2xl bg-red-600 text-white hover:bg-red-700">Atualizar</button>
        </div>
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <label className="block text-xl font-semibold text-slate-800 mb-2">Buscar</label>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome ou categoria"
          className="w-full rounded-xl border px-4 py-3"
        />
      </section>

      <section>
        {loading ? <div className="p-4">Carregando…</div> :
          erro ? <div className="p-4 text-red-700">{erro}</div> :
            filtrada.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed text-center text-slate-600">Nenhum produto.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y">
                    <thead className="bg-gradient-to-r from-red-700 to-red-600 text-white">
                      <tr>
                        {["ID", "Nome", "Categoria", "Modalidade", "Unidade", "Base (seg)", "Valor unitário", "Ações"].map(h => (
                          <th key={h} className="px-6 py-3 text-left text-sm font-semibold uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filtrada.map((p, idx) => (
                        <tr key={p.id} className={idx % 2 ? "bg-red-50/40" : "bg-white"}>
                          <td className="px-6 py-3">{p.id}</td>
                          <td className="px-6 py-3">{p.nome}</td>
                          <td className="px-6 py-3">{p.categoria || "—"}</td>
                          <td className="px-6 py-3">{p.modalidade_preco || "—"}</td>
                          <td className="px-6 py-3">{p.unidade_rotulo || "—"}</td>
                          <td className="px-6 py-3">{p.base_segundos ?? "—"}</td>
                          <td className="px-6 py-3">
                            {p.valor_unitario != null
                              ? p.valor_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                              : "—"}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => editar(p)} className="px-3 py-1.5 rounded-xl border">✏️</button>
                              <button onClick={() => remover(p.id)} className="px-3 py-1.5 rounded-xl border">🗑️</button>
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

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white overflow-y-auto shadow-2xl">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="text-2xl font-bold">{modo === "create" ? "Novo produto" : "Editar produto"}</div>
              <button className="px-3 py-1.5 rounded-lg border" onClick={() => setOpen(false)}>✖ Fechar</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Nome</label>
                <input value={form.nome} onChange={e => campo("nome", e.target.value)} className="w-full rounded-xl border px-3 py-2" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Categoria</label>
                  <input value={form.categoria || ""} onChange={e => campo("categoria", e.target.value)} className="w-full rounded-xl border px-3 py-2" placeholder="PORTAL, PAINEL, RÁDIO…" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Modalidade</label>
                  <select value={form.modalidade_preco || "PACOTE"} onChange={e => campo("modalidade_preco", e.target.value as Modalidade)} className="w-full rounded-xl border px-3 py-2">
                    {["DIA", "SPOT", "CPM", "PACOTE"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Unidade (rótulo)</label>
                  <input placeholder="dia, spot, mil imp., pacote…" value={form.unidade_rotulo || ""} onChange={e => campo("unidade_rotulo", e.target.value)} className="w-full rounded-xl border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Base segundos (SPOT)</label>
                  <input type="number" min={0} value={form.base_segundos ?? ""} onChange={e => campo("base_segundos", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-xl border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Valor unitário</label>
                  <input type="number" min={0} step="0.01" value={form.valor_unitario ?? ""} onChange={e => campo("valor_unitario", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-xl border px-3 py-2" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Descrição</label>
                <input value={form.descricao || ""} onChange={e => campo("descricao", e.target.value)} className="w-full rounded-xl border px-3 py-2" />
              </div>

              <div className="pt-2">
                <button onClick={salvar} disabled={saving} className="px-6 py-3 rounded-2xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                  {saving ? "Salvando..." : (modo === "create" ? "Criar produto" : "Salvar alterações")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
