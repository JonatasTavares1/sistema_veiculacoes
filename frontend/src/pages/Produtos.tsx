// src/pages/Produtos.tsx
import { useEffect, useMemo, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

type Produto = {
  id: number
  nome: string
  descricao?: string | null
  valor_unitario?: number | null
}

// -------- helpers HTTP --------
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
    try {
      const j = await r.json()
      if (j?.detail) msg += ` - ${typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)}`
    } catch {
      const t = await r.text().catch(() => "")
      if (t) msg += ` - ${t}`
    }
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
    try {
      const j = await r.json()
      if (j?.detail) msg += ` - ${typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)}`
    } catch {
      const t = await r.text().catch(() => "")
      if (t) msg += ` - ${t}`
    }
    throw new Error(msg)
  }
  return r.json()
}
async function delJSON(url: string): Promise<void> {
  const r = await fetch(url, { method: "DELETE" })
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try {
      const j = await r.json()
      if (j?.detail) msg += ` - ${typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)}`
    } catch {
      const t = await r.text().catch(() => "")
      if (t) msg += ` - ${t}`
    }
    throw new Error(msg)
  }
}

// -------- format helpers --------
function fmtBRL(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "—"
  try {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  } catch {
    return String(v)
  }
}
// "1.234,56" -> 1234.56 | "" -> null
function parseNumeroBRL(txt: string): number | null {
  const t = (txt || "").trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

// ---- Export helpers (xlsx se possível; fallback CSV) ----
function downloadBlob(content: string | Blob, filename: string, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
function csvEscape(v: any) {
  const s = (v ?? "").toString().replace(/"/g, '""')
  return `"${s}"`
}
function jsonToCSV(rows: Record<string, any>[]) {
  if (!rows.length) return ""
  const headers = Object.keys(rows[0])
  const head = headers.map(csvEscape).join(";")
  const body = rows.map(r => headers.map(h => csvEscape(r[h])).join(";")).join("\n")
  return "\uFEFF" + head + "\n" + body // BOM p/ Excel PT-BR
}

export default function Produtos() {
  // form (criação)
  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")
  const [valorTxt, setValorTxt] = useState("") // string pt-BR

  // dados
  const [lista, setLista] = useState<Produto[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // busca (servidor + client)
  const [busca, setBusca] = useState("")       // manda como ?termo= (nome, ilike)
  const [filtroDesc, setFiltroDesc] = useState("") // filtro local na descrição

  // edição (modal)
  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<Produto | null>(null)
  const [editNome, setEditNome] = useState("")
  const [editDescricao, setEditDescricao] = useState("")
  const [editValorTxt, setEditValorTxt] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // ------- carregar listagem -------
  async function carregar(term?: string) {
    setLoading(true); setErro(null)
    try {
      const qs = term ? `?${new URLSearchParams({ termo: term }).toString()}` : ""
      const itens = await getJSON<Produto[]>(`${API}/produtos${qs}`)
      setLista(Array.isArray(itens) ? itens : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar produtos.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { carregar() }, [])

  // ------- computado (filtro local por descrição) -------
  const filtrada = useMemo(() => {
    const f = filtroDesc.trim().toLowerCase()
    if (!f) return lista
    return lista.filter(p => (p.descricao || "").toLowerCase().includes(f))
  }, [lista, filtroDesc])

  // ------- ações de busca -------
  function onBuscar() { carregar(busca.trim() || undefined) }
  function onVerTodos() {
    setBusca("")
    carregar()
  }

  // ------- cadastro -------
  async function salvarNovo() {
    if (!nome.trim()) { alert("Nome é obrigatório."); return }
    const valor = parseNumeroBRL(valorTxt)
    if (valor != null && valor < 0) { alert("Valor não pode ser negativo."); return }

    setSalvando(true); setErro(null)
    try {
      const body = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        valor_unitario: valor,
      }
      await postJSON(`${API}/produtos`, body)
      setNome(""); setDescricao(""); setValorTxt("")
      await carregar(busca.trim() || undefined)
      alert("Produto cadastrado com sucesso!")
    } catch (e: any) {
      setErro(e?.message || "Erro ao cadastrar produto.")
    } finally {
      setSalvando(false)
    }
  }

  // ------- edição -------
  function abrirEdicao(p: Produto) {
    setEdit(p)
    setEditNome(p.nome || "")
    setEditDescricao(p.descricao || "")
    setEditValorTxt(
      p.valor_unitario == null
        ? ""
        : p.valor_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    )
    setEditError(null)
    setEditOpen(true)
  }
  function fecharEdicao() {
    setEditOpen(false)
    setEdit(null)
    setEditError(null)
  }
  async function salvarEdicao() {
    if (!edit) return
    if (!editNome.trim()) { setEditError("Nome é obrigatório."); return }
    const valor = parseNumeroBRL(editValorTxt)
    if (valor != null && valor < 0) { setEditError("Valor não pode ser negativo."); return }

    setEditSaving(true); setEditError(null)
    try {
      const body = {
        nome: editNome.trim(),               // ProdutoUpdate permite nome opcional
        descricao: editDescricao.trim() || null,
        valor_unitario: valor,
      }
      const upd = await putJSON<Produto>(`${API}/produtos/${edit.id}`, body)
      // atualiza local
      setLista(prev => prev.map(x => x.id === upd.id ? upd : x))
      fecharEdicao()
    } catch (e: any) {
      setEditError(e?.message || "Erro ao salvar.")
    } finally {
      setEditSaving(false)
    }
  }

  // ------- exclusão -------
  async function excluir(p: Produto) {
    if (!confirm(`Excluir o produto "${p.nome}"?`)) return
    try {
      await delJSON(`${API}/produtos/${p.id}`)
      setLista(prev => prev.filter(x => x.id !== p.id))
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir produto.")
    }
  }

  // ------- export -------
  async function exportarPlanilha(rows: Produto[]) {
    if (!rows?.length) { alert("Nada para exportar."); return }
    const data = rows.map(p => ({
      ID: p.id,
      Nome: p.nome,
      Descrição: p.descricao || "",
      "Valor Unitário (R$)": p.valor_unitario ?? "",
    }))
    const nomeArq = `produtos_${new Date().toISOString().slice(0,10)}.xlsx`
    try {
      const XLSX = await import("xlsx")
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Produtos")
      XLSX.writeFile(wb, nomeArq)
    } catch {
      const csv = jsonToCSV(data)
      downloadBlob(csv, nomeArq.replace(/\.xlsx$/, ".csv"), "text/csv;charset=utf-8;")
      alert("Exportei em CSV (fallback). Para .xlsx nativo, instale a lib 'xlsx'.")
    }
  }

  return (
    <div className="space-y-8">
      {/* Título + ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Produtos</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportarPlanilha(filtrada)}
            disabled={!filtrada.length}
            className="px-5 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-lg hover:bg-slate-50 disabled:opacity-60"
            title="Exportar para Excel"
          >
            📤 Exportar XLSX
          </button>
          <button
            onClick={() => carregar(busca.trim() || undefined)}
            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Formulário de cadastro */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {erro && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">{erro}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Nome do Produto</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
              placeholder="Ex.: Mídia TV 30s"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Valor Unitário (R$)</label>
            <input
              value={valorTxt}
              onChange={(e) => setValorTxt(e.target.value)}
              placeholder="1.000,00"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
              placeholder="(opcional)"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={salvarNovo}
            disabled={salvando}
            className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Cadastrar Produto"}
          </button>
        </div>
      </section>

      {/* Filtros de busca */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xl font-semibold text-slate-800 mb-2">Buscar por nome (servidor)</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onBuscar() }}
              placeholder="Digite o nome e pressione Enter"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Filtrar por descrição (local)</label>
            <input
              value={filtroDesc}
              onChange={(e) => setFiltroDesc(e.target.value)}
              placeholder="Trecho da descrição"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={onBuscar}
              className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm w-full"
            >
              Buscar
            </button>
            <button
              onClick={onVerTodos}
              className="px-5 py-3 rounded-2xl border border-slate-300 text-slate-700 text-lg hover:bg-slate-50 w-full"
            >
              Ver Todos
            </button>
          </div>
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold text-slate-900">Produtos cadastrados</h2>
          <div className="text-slate-600 text-base">{filtrada.length} registro(s)</div>
        </div>

        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : filtrada.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nenhum produto encontrado.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-red-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-red-200">
                <thead className="bg-gradient-to-r from-red-700 to-red-600 text-white sticky top-0">
                  <tr>
                    {["ID", "Nome", "Valor Unitário", "Descrição", "Ações"].map(h => (
                      <th key={h} className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {filtrada.map((p, idx) => (
                    <tr
                      key={p.id}
                      className={[
                        "transition",
                        idx % 2 === 0 ? "bg-white" : "bg-red-50/40",
                        "hover:bg-red-50"
                      ].join(" ")}
                    >
                      <td className="px-6 py-4 text-slate-900 text-base font-medium">{p.id}</td>
                      <td className="px-6 py-4 text-slate-900 text-base font-medium">
                        <div className="truncate">{p.nome}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-900 text-base font-semibold">
                        {fmtBRL(p.valor_unitario ?? null)}
                      </td>
                      <td className="px-6 py-4 text-slate-800 text-base">
                        <div className="truncate max-w-[420px]">{p.descricao || "—"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => abrirEdicao(p)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                            title="Editar"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => excluir(p)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                            title="Excluir"
                          >
                            🗑️ Excluir
                          </button>
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

      {/* Modal de edição */}
      {editOpen && edit && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharEdicao} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">Editar Produto</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">
                  <span className="truncate">{edit.nome}</span>
                </div>
              </div>
              <button
                onClick={fecharEdicao}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                ✖ Fechar
              </button>
            </div>

            <div className="p-6 space-y-6">
              {editError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nome</label>
                  <input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Valor Unitário (R$)</label>
                  <input
                    value={editValorTxt}
                    onChange={(e) => setEditValorTxt(e.target.value)}
                    placeholder="1.000,00"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição</label>
                  <textarea
                    value={editDescricao}
                    onChange={(e) => setEditDescricao(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 min-h-[90px]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={salvarEdicao}
                  disabled={editSaving}
                  className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {editSaving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
