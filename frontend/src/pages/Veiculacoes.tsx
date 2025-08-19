// src/pages/Veiculacoes.tsx
import { useEffect, useMemo, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

// --- Tipos ---
type ProdutoLite = {
  id: number
  nome: string
  valor_unitario?: number | null
}
type PIRef = {
  id: number
  numero_pi: string
}
type Veiculacao = {
  id: number
  produto_id: number
  pi_id: number
  data_inicio?: string | null
  data_fim?: string | null
  quantidade?: number | null
  valor_unitario?: number | null
  desconto?: number | null // fração (0..1)
  valor_total?: number | null
  produto_nome?: string | null
  numero_pi?: string | null
}

// --- HTTP helpers (com erro detalhado do FastAPI) ---
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

// --- Formatação / parsing ---
function fmtBRL(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "—"
  try {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  } catch { return String(v) }
}
function fmtPercentFromFraction(fr?: number | null | undefined) {
  if (fr == null) return "—"
  const pct = fr * 100
  return `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
}
// "1.234,56" -> 1234.56 | "" -> null
function parseNumeroBRL(txt: string): number | null {
  const t = (txt || "").trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}
// Aceita "10", "10%", "0,1" e retorna número (não converto pra fração; backend normaliza)
function parseDesconto(txt: string): number | null {
  const t = (txt || "").trim().replace("%", "")
  if (!t) return null
  const n = Number(t.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

// --- Export helpers ---
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

export default function Veiculacoes() {
  // dados base pra selects
  const [produtos, setProdutos] = useState<ProdutoLite[]>([])
  const [pis, setPis] = useState<PIRef[]>([])

  // listagem
  const [lista, setLista] = useState<Veiculacao[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // filtros
  const [filtroProdutoId, setFiltroProdutoId] = useState<number | "">("")
  const [filtroPiId, setFiltroPiId] = useState<number | "">("")
  const [busca, setBusca] = useState("")

  // cadastro
  const [novoProdutoId, setNovoProdutoId] = useState<number | "">("")
  const [novoPiId, setNovoPiId] = useState<number | "">("")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [qtdTxt, setQtdTxt] = useState("")
  const [vuTxt, setVuTxt] = useState("") // se vazio -> backend usa valor do produto
  const [descTxt, setDescTxt] = useState("") // em % ou fração

  const [salvando, setSalvando] = useState(false)

  // edição (modal)
  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<Veiculacao | null>(null)
  const [editProdutoId, setEditProdutoId] = useState<number | "">("")
  const [editPiId, setEditPiId] = useState<number | "">("")
  const [editDataInicio, setEditDataInicio] = useState("")
  const [editDataFim, setEditDataFim] = useState("")
  const [editQtdTxt, setEditQtdTxt] = useState("")
  const [editVuTxt, setEditVuTxt] = useState("")
  const [editDescTxt, setEditDescTxt] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // --- carregamento inicial ---
  async function carregarTabelas() {
    setLoading(true); setErro(null)
    try {
      const [prods, pisResp, veics] = await Promise.all([
        getJSON<ProdutoLite[]>(`${API}/produtos`),
        getJSON<any[]>(`${API}/pis`),    // pega id/numero_pi
        getJSON<Veiculacao[]>(`${API}/veiculacoes`),
      ])
      setProdutos(Array.isArray(prods) ? prods : [])
      setPis(
        (Array.isArray(pisResp) ? pisResp : [])
          .map((p: any) => ({ id: p.id, numero_pi: p.numero_pi }))
          .filter((p: PIRef) => !!p.numero_pi)
          .sort((a: PIRef, b: PIRef) => b.numero_pi.localeCompare(a.numero_pi))
      )
      setLista(Array.isArray(veics) ? veics : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar dados.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { carregarTabelas() }, [])

  // auto-preencher valor unitário ao escolher produto no cadastro/edição (se vazio)
  useEffect(() => {
    if (novoProdutoId && !vuTxt) {
      const p = produtos.find(x => x.id === novoProdutoId)
      if (p?.valor_unitario != null) {
        setVuTxt(p.valor_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      }
    }
  }, [novoProdutoId, produtos]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editOpen && editProdutoId && !editVuTxt) {
      const p = produtos.find(x => x.id === editProdutoId)
      if (p?.valor_unitario != null) {
        setEditVuTxt(p.valor_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      }
    }
  }, [editOpen, editProdutoId, produtos]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- lista filtrada (local) ---
  const filtrada = useMemo(() => {
    let base = [...lista]
    if (filtroProdutoId) base = base.filter(v => v.produto_id === filtroProdutoId)
    if (filtroPiId) base = base.filter(v => v.pi_id === filtroPiId)
    const q = busca.trim().toLowerCase()
    if (q) {
      base = base.filter(v =>
        (v.produto_nome || "").toLowerCase().includes(q) ||
        (v.numero_pi || "").toLowerCase().includes(q)
      )
    }
    return base
  }, [lista, filtroProdutoId, filtroPiId, busca])

  // --- ações ---
  async function salvarNovo() {
    if (!novoProdutoId || !novoPiId) { alert("Selecione Produto e PI."); return }
    const qtd = Number((qtdTxt || "0").replace(/\D+/g, "")) // inteiro
    if (!Number.isFinite(qtd) || qtd < 0) { alert("Quantidade inválida."); return }

    const valor_unitario = parseNumeroBRL(vuTxt) // null => backend usa do produto
    if (valor_unitario != null && valor_unitario < 0) { alert("Valor unitário não pode ser negativo."); return }

    const desconto = parseDesconto(descTxt) // pode ser 10 (10%) ou 0,1 — backend normaliza

    setSalvando(true)
    try {
      await postJSON<Veiculacao>(`${API}/veiculacoes`, {
        produto_id: Number(novoProdutoId),
        pi_id: Number(novoPiId),
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        quantidade: qtd,
        valor_unitario, // null ok
        desconto,       // null ok
      })
      // limpa formulário
      setNovoProdutoId(""); setNovoPiId("")
      setDataInicio(""); setDataFim("")
      setQtdTxt(""); setVuTxt(""); setDescTxt("")
      await carregarTabelas()
      alert("Veiculação cadastrada com sucesso!")
    } catch (e: any) {
      alert(e?.message || "Erro ao cadastrar veiculação.")
    } finally {
      setSalvando(false)
    }
  }

  function abrirEdicao(v: Veiculacao) {
    setEdit(v)
    setEditProdutoId(v.produto_id)
    setEditPiId(v.pi_id)
    setEditDataInicio(v.data_inicio || "")
    setEditDataFim(v.data_fim || "")
    setEditQtdTxt(String(v.quantidade ?? ""))
    setEditVuTxt(
      v.valor_unitario == null ? "" :
      v.valor_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    )
    setEditDescTxt(
      v.desconto == null ? "" :
      (v.desconto * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })
    )
    setEditError(null)
    setEditOpen(true)
  }
  function fecharEdicao() {
    setEditOpen(false); setEdit(null); setEditError(null)
  }
  async function salvarEdicao() {
    if (!edit) return
    const quantidade = Number((editQtdTxt || "0").replace(/\D+/g, ""))
    if (!Number.isFinite(quantidade) || quantidade < 0) { setEditError("Quantidade inválida."); return }
    const valor_unitario = parseNumeroBRL(editVuTxt)
    if (valor_unitario != null && valor_unitario < 0) { setEditError("Valor unitário não pode ser negativo."); return }
    const desconto = parseDesconto(editDescTxt)

    setEditSaving(true)
    try {
      const upd = await putJSON<Veiculacao>(`${API}/veiculacoes/${edit.id}`, {
        produto_id: editProdutoId || undefined,
        pi_id: editPiId || undefined,
        data_inicio: editDataInicio || null,
        data_fim: editDataFim || null,
        quantidade,
        valor_unitario, // null -> backend usa do produto
        desconto,       // null/number (backend normaliza)
      })
      setLista(prev => prev.map(x => x.id === upd.id ? upd : x))
      fecharEdicao()
    } catch (e: any) {
      setEditError(e?.message || "Erro ao salvar edição.")
    } finally {
      setEditSaving(false)
    }
  }

  async function excluir(v: Veiculacao) {
    if (!confirm(`Excluir veiculação #${v.id} (${v.produto_nome} @ ${v.numero_pi})?`)) return
    try {
      await delJSON(`${API}/veiculacoes/${v.id}`)
      setLista(prev => prev.filter(x => x.id !== v.id))
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir veiculação.")
    }
  }

  // --- export ---
  async function exportarPlanilha(rows: Veiculacao[]) {
    if (!rows?.length) { alert("Nada para exportar."); return }
    const data = rows.map(v => ({
      ID: v.id,
      Produto: v.produto_nome || v.produto_id,
      "PI Nº": v.numero_pi || v.pi_id,
      "Início": v.data_inicio || "",
      "Fim": v.data_fim || "",
      Quantidade: v.quantidade ?? 0,
      "V. Unitário (R$)": v.valor_unitario ?? "",
      "Desconto (%)": v.desconto != null ? v.desconto * 100 : "",
      "Total (R$)": v.valor_total ?? "",
    }))
    const nomeArq = `veiculacoes_${new Date().toISOString().slice(0,10)}.xlsx`
    try {
      const XLSX = await import("xlsx")
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Veiculações")
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
        <h1 className="text-4xl font-extrabold text-slate-900">Veiculações</h1>
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
            onClick={carregarTabelas}
            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Cadastro */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Nova veiculação</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Produto</label>
            <select
              value={novoProdutoId}
              onChange={(e) => setNovoProdutoId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Selecione…</option>
              {produtos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome} {p.valor_unitario != null ? `— ${fmtBRL(p.valor_unitario)}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">PI</label>
            <select
              value={novoPiId}
              onChange={(e) => setNovoPiId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Selecione…</option>
              {pis.map(pi => (
                <option key={pi.id} value={pi.id}>{pi.numero_pi}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Quantidade</label>
            <input
              value={qtdTxt}
              onChange={(e) => setQtdTxt(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Valor Unitário (R$)</label>
            <input
              value={vuTxt}
              onChange={(e) => setVuTxt(e.target.value)}
              placeholder="(vazio = usar do produto)"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Desconto</label>
            <input
              value={descTxt}
              onChange={(e) => setDescTxt(e.target.value)}
              placeholder="Ex.: 10 ou 10% ou 0,1"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={salvarNovo}
            disabled={salvando}
            className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Cadastrar Veiculação"}
          </button>
        </div>
      </section>

      {/* Filtros de busca */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Produto</label>
            <select
              value={filtroProdutoId}
              onChange={(e) => setFiltroProdutoId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Todos</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">PI</label>
            <select
              value={filtroPiId}
              onChange={(e) => setFiltroPiId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Todos</option>
              {pis.map(pi => <option key={pi.id} value={pi.id}>{pi.numero_pi}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xl font-semibold text-slate-800 mb-2">Buscar</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Produto, número do PI..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={carregarTabelas}
              className="w-full px-5 py-3 rounded-2xl border border-slate-300 text-slate-700 text-lg hover:bg-slate-50"
            >
              Recarregar
            </button>
          </div>
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold text-slate-900">Veiculações cadastradas</h2>
          <div className="text-slate-600 text-base">{filtrada.length} registro(s)</div>
        </div>

        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : filtrada.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nenhuma veiculação encontrada.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-red-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-red-200">
                <thead className="bg-gradient-to-r from-red-700 to-red-600 text-white sticky top-0">
                  <tr>
                    {["ID","Produto","PI","Período","Qtd","V. Unitário","Desc.","Total","Ações"].map(h => (
                      <th key={h} className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {filtrada.map((v, idx) => (
                    <tr
                      key={v.id}
                      className={[
                        "transition",
                        idx % 2 === 0 ? "bg-white" : "bg-red-50/40",
                        "hover:bg-red-50"
                      ].join(" ")}
                    >
                      <td className="px-6 py-4 text-slate-900 text-base font-medium">{v.id}</td>
                      <td className="px-6 py-4 text-slate-900 text-base font-medium">
                        <div className="truncate">{v.produto_nome || v.produto_id}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-900 text-base font-medium">
                        <span className="font-mono">{v.numero_pi || v.pi_id}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-800 text-base">
                        <div className="truncate">
                          {(v.data_inicio || "—")} <span className="text-slate-400">→</span> {(v.data_fim || "—")}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-800 text-base">{v.quantidade ?? 0}</td>
                      <td className="px-6 py-4 text-slate-900 text-base font-semibold">{fmtBRL(v.valor_unitario ?? null)}</td>
                      <td className="px-6 py-4 text-slate-800 text-base">{fmtPercentFromFraction(v.desconto)}</td>
                      <td className="px-6 py-4 text-slate-900 text-base font-semibold">{fmtBRL(v.valor_total ?? null)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => abrirEdicao(v)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                            title="Editar"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => excluir(v)}
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
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">Editar Veiculação</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">
                  #{edit.id} — {edit.produto_nome} <span className="text-slate-500">em</span> <span className="font-mono">{edit.numero_pi}</span>
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Produto</label>
                  <select
                    value={editProdutoId}
                    onChange={(e) => setEditProdutoId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">—</option>
                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">PI</label>
                  <select
                    value={editPiId}
                    onChange={(e) => setEditPiId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">—</option>
                    {pis.map(pi => <option key={pi.id} value={pi.id}>{pi.numero_pi}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Início</label>
                    <input
                      type="date"
                      value={editDataInicio}
                      onChange={(e) => setEditDataInicio(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Fim</label>
                    <input
                      type="date"
                      value={editDataFim}
                      onChange={(e) => setEditDataFim(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Quantidade</label>
                  <input
                    value={editQtdTxt}
                    onChange={(e) => setEditQtdTxt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Valor Unitário (R$)</label>
                  <input
                    value={editVuTxt}
                    onChange={(e) => setEditVuTxt(e.target.value)}
                    placeholder="(vazio = usar do produto)"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Desconto</label>
                  <input
                    value={editDescTxt}
                    onChange={(e) => setEditDescTxt(e.target.value)}
                    placeholder="Ex.: 10 ou 10% ou 0,1"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
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
