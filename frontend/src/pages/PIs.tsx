// src/pages/PIs.tsx
import { useEffect, useMemo, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

type PIItem = {
  id: number
  numero_pi: string
  tipo_pi: "Matriz" | "Normal" | "CS" | "Abatimento" | string
  numero_pi_matriz?: string | null
  numero_pi_normal?: string | null
  nome_anunciante?: string | null
  nome_agencia?: string | null
  cnpj_agencia?: string | null
  data_emissao?: string | null
  valor_bruto?: number | null
  valor_liquido?: number | null
  uf_cliente?: string | null
  canal?: string | null
  nome_campanha?: string | null
  diretoria?: string | null
  executivo?: string | null
  dia_venda?: string | number | null
  mes_venda?: string | null
  observacoes?: string | null
}

type PiDetalhe = {
  id: number
  numero_pi: string
  anunciante?: string | null
  campanha?: string | null
  emissao?: string | null
  total_pi: number
  produtos?: Array<{
    id: number
    nome: string
    descricao?: string | null
    total_produto: number
    veiculacoes: Array<{
      id: number
      canal?: string | null
      formato?: string | null
      data_inicio?: string | null
      data_fim?: string | null
      quantidade?: number | null
      valor?: number | null
      valor_liquido?: number | null
      valor_bruto?: number | null
      desconto?: number | null
    }>
  }>
}

type VeiculacaoRow = {
  id: number
  produto_id: number
  pi_id: number
  numero_pi: string
  cliente?: string | null
  campanha?: string | null
  canal?: string | null
  formato?: string | null
  data_inicio?: string | null
  data_fim?: string | null
  quantidade?: number | null
  valor?: number | null
  produto_nome?: string | null
  executivo?: string | null
  diretoria?: string | null
  uf_cliente?: string | null
}

const DEFAULT_EXECUTIVOS = [
  "Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio",
  "Flavio de Paula", "Lorena Fernandes", "Henri Marques", "Caio Bruno",
  "Flavia Cabral", "Paula Caroline", "Leila Santos", "Jessica Ribeiro",
  "Paula Campos",
]
const DIRETORIAS = ["Governo Federal", "Governo Estadual", "Rafael Augusto"]

// ===== helpers de formatação =====
function fmtMoney(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "R$ 0,00"
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function parseISODateToBR(s?: string | null) {
  if (!s) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  return s
}
function mesToYM(s?: string | null): string {
  if (!s) return ""
  const t = s.trim()
  const m1 = /^(\d{2})\/(\d{4})$/.exec(t)
  if (m1) return `${m1[2]}-${m1[1]}`
  const m2 = /^(\d{4})-(\d{2})$/.exec(t)
  if (m2) return t
  return ""
}

// ===== http =====
async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
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
      const t = await r.json()
      if (t?.detail) msg += ` - ${typeof t.detail === "string" ? t.detail : JSON.stringify(t.detail)}`
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

// ===== helpers veiculações/PI =====
function coalesceValor(v?: { valor?: number|null; valor_liquido?: number|null; valor_bruto?: number|null }) {
  if (!v) return null
  return v.valor_liquido ?? v.valor ?? v.valor_bruto ?? null
}
function flattenVeicsFromDetalhe(det: PiDetalhe | null): VeiculacaoRow[] {
  if (!det?.produtos || det.produtos.length === 0) return []
  const out: VeiculacaoRow[] = []
  for (const p of det.produtos) {
    for (const v of (p.veiculacoes || [])) {
      out.push({
        id: v.id,
        produto_id: p.id,
        pi_id: det.id,
        numero_pi: det.numero_pi,
        cliente: det.anunciante || null,
        campanha: det.campanha || null,
        canal: v.canal || null,
        formato: v.formato || null,
        data_inicio: v.data_inicio || null,
        data_fim: v.data_fim || null,
        quantidade: v.quantidade ?? null,
        valor: coalesceValor(v),
        produto_nome: p.nome || null,
        executivo: null,
        diretoria: null,
        uf_cliente: null,
      })
    }
  }
  return out
}

// ===================== Componente =====================
export default function PIs() {
  const [lista, setLista] = useState<PIItem[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // filtros
  const [busca, setBusca] = useState("")
  const [tipo, setTipo] = useState<"Todos" | "Matriz" | "Normal" | "CS" | "Abatimento">("Todos")
  const [diretoria, setDiretoria] = useState<string>("Todos")
  const [executivo, setExecutivo] = useState<string>("Todos")
  const [mesVendaFiltro, setMesVendaFiltro] = useState<string>("")
  const [diaVendaDe, setDiaVendaDe] = useState<string>("")
  const [diaVendaAte, setDiaVendaAte] = useState<string>("")

  const [executivos, setExecutivos] = useState<string[]>([...DEFAULT_EXECUTIVOS])

  // detalhe
  const [detalhePI, setDetalhePI] = useState<PiDetalhe | null>(null)
  const [detalheLoading, setDetalheLoading] = useState(false)
  const [veics, setVeics] = useState<VeiculacaoRow[]>([])
  const [veicsError, setVeicsError] = useState<string | null>(null)
  const [selectedPiMeta, setSelectedPiMeta] = useState<PIItem | null>(null) // <-- meta completo do PI

  // editor PI básico
  const [editOpen, setEditOpen] = useState(false)
  const [editDraft, setEditDraft] = useState<PIItem | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // ids sendo excluídos
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set())

  // view: tabela ou cards
  const [view, setView] = useState<"table" | "cards">("table")

  async function carregar() {
    setLoading(true); setErro(null)
    try {
      const pis = await getJSON<PIItem[]>(`${API}/pis`)
      setLista(Array.isArray(pis) ? pis : [])

      const exsFromApi = await getJSON<string[]>(`${API}/executivos`).catch(() => [])
      const exsFromData = Array.from(new Set(pis.map(p => (p.executivo || "").trim()).filter(Boolean)))
      const merged = Array.from(new Set([...(Array.isArray(exsFromApi) ? exsFromApi : []), ...DEFAULT_EXECUTIVOS, ...exsFromData]))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
      setExecutivos(merged)
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar PIs.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { carregar() }, [])

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const ymFiltro = mesVendaFiltro
    const deNum = diaVendaDe ? Math.max(1, Math.min(31, parseInt(diaVendaDe, 10))) : null
    const ateNum = diaVendaAte ? Math.max(1, Math.min(31, parseInt(diaVendaAte, 10))) : null
    const haveDiaFiltro = deNum != null || ateNum != null
    const minDia = deNum ?? ateNum ?? null
    const maxDia = ateNum ?? deNum ?? null

    return lista.filter(p => {
      const okBusca =
        !q ||
        (p.numero_pi || "").toLowerCase().includes(q) ||
        (p.nome_anunciante || "").toLowerCase().includes(q) ||
        (p.nome_agencia || "").toLowerCase().includes(q) ||
        (p.cnpj_agencia || "").toLowerCase().includes(q)

      const okTipo = (tipo === "Todos") || (p.tipo_pi === tipo)
      const okDir = (diretoria === "Todos") || ((p.diretoria || "") === diretoria)
      const okExec = (executivo === "Todos") || ((p.executivo || "") === executivo)
      const okMes = !ymFiltro || (mesToYM(p.mes_venda) === ymFiltro)

      let okDia = true
      if (haveDiaFiltro) {
        const diaRaw = p.dia_venda
        const dia = Number(String(diaRaw ?? "").trim())
        if (!Number.isFinite(dia)) okDia = false
        else {
          if (minDia != null && dia < minDia) okDia = false
          if (maxDia != null && dia > maxDia) okDia = false
        }
      }
      return okBusca && okTipo && okDir && okExec && okMes && okDia
    })
  }, [lista, busca, tipo, diretoria, executivo, mesVendaFiltro, diaVendaDe, diaVendaAte])

  async function exportarXLSX() {
    const rows = filtrada.map((pi) => ({
      ID: pi.id,
      PI: pi.numero_pi,
      "Tipo de PI": pi.tipo_pi,
      "PI Matriz": (pi.tipo_pi === "CS" || pi.tipo_pi === "Abatimento") ? (pi.numero_pi_matriz || "") : "",
      Cliente: pi.nome_anunciante || "",
      "Agência": pi.nome_agencia || "",
      "CNPJ Agência": pi.cnpj_agencia || "",
      "Data de Emissão": parseISODateToBR(pi.data_emissao),
      "Valor Total (R$)": (pi.valor_bruto ?? 0),
      "Valor Líquido (R$)": (pi.valor_liquido ?? 0),
      "Praça": pi.uf_cliente || "",
      Meio: pi.canal || "",
      Campanha: pi.nome_campanha || "",
      Diretoria: pi.diretoria || "",
      Executivo: pi.executivo || "",
      "Data da Venda": (pi.dia_venda && pi.mes_venda) ? `${pi.dia_venda}/${pi.mes_venda}` : "",
      Observações: pi.observacoes || "",
    }))

    const xlsx = await import("xlsx")
    const ws = xlsx.utils.json_to_sheet(rows, {
      header: Object.keys(rows[0] || {}),
    })
    const colMoney = ["Valor Total (R$)", "Valor Líquido (R$)"]
    rows.forEach((r, i) => {
      colMoney.forEach((k) => {
        const cell = xlsx.utils.encode_cell({ r: i + 1, c: Object.keys(rows[0]).indexOf(k) })
        const v = r[k as keyof typeof r] as number
        ;(ws as any)[cell] = { t: "s", v: (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
      })
    })

    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, "PIs")
    const now = new Date()
    const stamp = now.toISOString().slice(0,19).replace(/[:T]/g,"-")
    xlsx.writeFile(wb, `pis_${stamp}.xlsx`)
  }

  async function carregarVeiculacoesPorPI(pi_id: number, numero_pi?: string): Promise<VeiculacaoRow[]> {
    try {
      const v1 = await getJSON<VeiculacaoRow[]>(`${API}/pis/${pi_id}/veiculacoes`)
      if (Array.isArray(v1) && v1.length) {
        return v1.filter(r => r.pi_id === pi_id || r.numero_pi === numero_pi)
      }
    } catch (_) {}

    try {
      const v2 = await getJSON<VeiculacaoRow[]>(`${API}/veiculacoes?pi_id=${encodeURIComponent(String(pi_id))}`)
      if (Array.isArray(v2) && v2.length) {
        return v2.filter(r => r.pi_id === pi_id)
      }
    } catch (_) {}

    if (numero_pi) {
      try {
        const v3 = await getJSON<VeiculacaoRow[]>(`${API}/veiculacoes?numero_pi=${encodeURIComponent(numero_pi)}`)
        if (Array.isArray(v3) && v3.length) {
          return v3.filter(r => r.numero_pi === numero_pi)
        }
      } catch (_) {}
    }
    return []
  }

  async function abrirDetalhesPorId(pi_id: number) {
    setDetalheLoading(true)
    setVeics([])
    setVeicsError(null)
    // pegue o meta completo do PI da lista atual
    setSelectedPiMeta(lista.find(p => p.id === pi_id) || null)

    try {
      const det = await getJSON<PiDetalhe>(`${API}/pis/${pi_id}/detalhe`)
      setDetalhePI(det)
      const viaEndpoints = await carregarVeiculacoesPorPI(pi_id, det?.numero_pi)
      const viaDetalhe = flattenVeicsFromDetalhe(det)
      const rows = (viaEndpoints.length ? viaEndpoints : viaDetalhe)
      setVeics(rows)
      if (rows.length === 0) setVeicsError(null)
    } catch (e: any) {
      setDetalhePI(null)
      setVeics([])
      setVeicsError(e?.message || "Falha ao carregar veiculações.")
    } finally {
      setDetalheLoading(false)
    }
  }
  function fecharDetalhes() {
    setDetalhePI(null)
    setVeics([])
    setVeicsError(null)
    setSelectedPiMeta(null)
  }

  // editor
  function abrirEditor(pi: PIItem) {
    setEditError(null)
    setEditDraft({
      ...pi,
      data_emissao: parseISODateToBR(pi.data_emissao),
    })
    setEditOpen(true)
  }
  function fecharEditor() {
    setEditOpen(false)
    setEditDraft(null)
    setEditError(null)
  }
  function campo(k: keyof PIItem, v: any) {
    if (!editDraft) return
    setEditDraft({ ...editDraft, [k]: v })
  }
  function trataNumero(s: string): number | null {
    const t = (s || "").trim()
    if (!t) return null
    const n = Number(t.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  async function salvarEditor() {
    if (!editDraft) return
    setSavingEdit(true); setEditError(null)
    try {
      const payload: any = {
        numero_pi: editDraft.numero_pi?.trim(),
        tipo_pi: editDraft.tipo_pi,
        numero_pi_matriz: (editDraft.tipo_pi === "Abatimento") ? (editDraft.numero_pi_matriz || null) : null,
        numero_pi_normal: (editDraft.tipo_pi === "CS") ? (editDraft.numero_pi_normal || null) : null,
        nome_anunciante: editDraft.nome_anunciante || null,
        nome_agencia: editDraft.nome_agencia || null,
        data_emissao: (editDraft.data_emissao || "").trim() || null,
        valor_bruto: trataNumero(String(editDraft.valor_bruto ?? "")),
        valor_liquido: trataNumero(String(editDraft.valor_liquido ?? "")),
        uf_cliente: editDraft.uf_cliente || null,
        canal: editDraft.canal || null,
        nome_campanha: editDraft.nome_campanha || null,
        diretoria: editDraft.diretoria || null,
        executivo: editDraft.executivo || null,
        dia_venda: (editDraft.dia_venda ?? "") as any || null,
        mes_venda: editDraft.mes_venda || null,
        observacoes: editDraft.observacoes || null,
      }
      await putJSON<PIItem>(`${API}/pis/${editDraft.id}`, payload)
      fecharEditor()
      await carregar()
      if (detalhePI && detalhePI.id === editDraft.id) abrirDetalhesPorId(editDraft.id)
    } catch (e: any) {
      setEditError(e?.message || "Falha ao salvar.")
    } finally {
      setSavingEdit(false)
    }
  }

  async function excluirPI(pi: PIItem) {
    if (!confirm(`Excluir PI ${pi.numero_pi} (#${pi.id})? Esta ação não pode ser desfeita.`)) return
    setDeletingIds(prev => new Set(prev).add(pi.id))
    try {
      await delJSON(`${API}/pis/${pi.id}`)
      setLista(prev => prev.filter(x => x.id !== pi.id))
      if (detalhePI?.id === pi.id) fecharDetalhes()
      if (editDraft?.id === pi.id) fecharEditor()
      alert("PI excluído com sucesso.")
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir PI.")
    } finally {
      setDeletingIds(prev => {
        const n = new Set(prev); n.delete(pi.id); return n
      })
    }
  }

  // ===== render =====
  return (
    <div className="space-y-8">
      {/* Título + ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">PIs Cadastrados</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView(v => v === "table" ? "cards" : "table")}
            className="px-5 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-lg hover:bg-slate-50"
            title="Alternar visualização"
          >
            {view === "table" ? "🗂️ Ver como Cards" : "📋 Ver como Tabela"}
          </button>
          <button
            onClick={exportarXLSX}
            className="px-5 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-lg hover:bg-slate-50"
            title="Exportar para Excel"
          >
            📤 Exportar XLSX
          </button>
          <button
            onClick={carregar}
            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 xl:grid-cols-6 gap-4">
          <div className="xl:col-span-2">
            <label className="block text-xl font-semibold text-slate-800 mb-2">Buscar</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="PI, cliente, agência ou CNPJ"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              {["Todos", "Matriz", "Normal", "CS", "Abatimento"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Diretoria</label>
            <select
              value={diretoria}
              onChange={(e) => setDiretoria(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option>Todos</option>
              {DIRETORIAS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Executivo</label>
            <select
              value={executivo}
              onChange={(e) => setExecutivo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option>Todos</option>
              {executivos.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>

          {/* BLOCO ÚNICO: Venda (mês + dia de/até) */}
          <div className="xl:col-span-2">
            <label className="block text-xl font-semibold text-slate-800 mb-2">Venda</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-sm text-slate-600 mb-1">Mês</div>
                <input
                  type="month"
                  value={mesVendaFiltro}
                  onChange={(e) => setMesVendaFiltro(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                />
              </div>
              <div>
                <div className="text-sm text-slate-600 mb-1">Dia — De</div>
                <input
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={diaVendaDe}
                  onChange={(e) => setDiaVendaDe(e.target.value)}
                  placeholder="1"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                />
              </div>
              <div>
                <div className="text-sm text-slate-600 mb-1">Dia — Até</div>
                <input
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={diaVendaAte}
                  onChange={(e) => setDiaVendaAte(e.target.value)}
                  placeholder="31"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lista (Tabela ou Cards) */}
      <section>
        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : erro ? (
          <div className="p-4 text-red-700 text-lg">{erro}</div>
        ) : filtrada.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nenhum PI encontrado.
          </div>
        ) : view === "table" ? (
          <div className="overflow-hidden rounded-2xl border border-red-200 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-red-100">
              <div className="text-slate-700">{filtrada.length} registro(s)</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-red-200">
                <thead className="bg-gradient-to-r from-red-700 to-red-600 text-white sticky top-0">
                  <tr>
                    {[
                      "ID","PI","Tipo de PI","PI Matriz","Cliente","Agência","Data de Emissão",
                      "Valor Total","Valor Líquido","Praça","Meio","Campanha",
                      "Diretoria","Executivo","Data da Venda","Ações"
                    ].map(h => (
                      <th key={h} className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {filtrada.map((pi, idx) => {
                    const dataVenda = (pi.dia_venda && pi.mes_venda) ? `${pi.dia_venda}/${pi.mes_venda}` : ""
                    const piMatriz = (pi.tipo_pi === "CS" || pi.tipo_pi === "Abatimento") ? (pi.numero_pi_matriz || "") : ""
                    const excluindo = deletingIds.has(pi.id)
                    return (
                      <tr
                        key={pi.id}
                        className={["transition", idx % 2 === 0 ? "bg-white" : "bg-red-50/40", "hover:bg-red-50"].join(" ")}
                      >
                        <td className="px-6 py-4 text-slate-900 text-base font-medium">{pi.id}</td>
                        <td className="px-6 py-4 text-slate-900 text-base font-medium">
                          <span className="font-mono">{pi.numero_pi}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-800 text-base">{pi.tipo_pi}</td>
                        <td className="px-6 py-4 text-slate-800 text-base"><span className="font-mono">{piMatriz}</span></td>
                        <td className="px-6 py-4 text-slate-800 text-base">
                          <div className="truncate">{pi.nome_anunciante || "—"}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-800 text-base">
                          <div className="truncate">{pi.nome_agencia || "—"}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-700 text-sm">
                          {parseISODateToBR(pi.data_emissao) || "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-900 text-base font-semibold">{fmtMoney(pi.valor_bruto)}</td>
                        <td className="px-6 py-4 text-slate-900 text-base font-semibold">{fmtMoney(pi.valor_liquido)}</td>
                        <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-semibold">
                          {pi.uf_cliente || "—"}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-800 text-base">{pi.canal || "—"}</td>
                        <td className="px-6 py-4 text-slate-800 text-base"><div className="truncate max-w-[260px]">{pi.nome_campanha || "—"}</div></td>
                        <td className="px-6 py-4 text-slate-800 text-base">{pi.diretoria || "—"}</td>
                        <td className="px-6 py-4 text-slate-800 text-base">{pi.executivo || "—"}</td>
                        <td className="px-6 py-4 text-slate-800 text-base">{dataVenda || "—"}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => abrirDetalhesPorId(pi.id)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Ver detalhes do PI"
                            >
                              🔎 Detalhes
                            </button>
                            <button
                              onClick={() => abrirEditor(pi)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Editar dados do PI"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => excluirPI(pi)}
                              disabled={excluindo}
                              className="px-3 py-1.5 rounded-xl border border-red-300 text-red-700 text-sm hover:bg-red-50 disabled:opacity-60"
                              title="Excluir PI"
                            >
                              {excluindo ? "⏳ Excluindo…" : "🗑️ Excluir"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // ====== GRID DE CARDS ======
          <div className="space-y-3">
            <div className="text-slate-700">{filtrada.length} registro(s)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {filtrada.map((pi) => {
                const piMatriz = (pi.tipo_pi === "CS" || pi.tipo_pi === "Abatimento") ? (pi.numero_pi_matriz || "") : ""
                const dataVenda = (pi.dia_venda && pi.mes_venda) ? `${pi.dia_venda}/${pi.mes_venda}` : ""
                const excluindo = deletingIds.has(pi.id)
                return (
                  <div
                    key={pi.id}
                    className="rounded-2xl border border-red-200 bg-white shadow-sm hover:shadow-md transition overflow-hidden"
                  >
                    <div className="px-5 py-4 border-b border-red-100 bg-gradient-to-r from-white to-red-50/30">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wide text-red-700 font-semibold">PI</div>
                          <div className="font-mono text-xl font-extrabold text-slate-900 truncate">{pi.numero_pi}</div>
                          {piMatriz && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              Matriz: <span className="font-mono">{piMatriz}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Valor Líquido</div>
                          <div className="text-lg font-bold text-slate-900">{fmtMoney(pi.valor_liquido)}</div>
                          <div className="text-xs text-slate-500 mt-1">Valor Total</div>
                          <div className="text-sm font-semibold text-slate-900">{fmtMoney(pi.valor_bruto)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-4 space-y-2">
                      <div className="text-sm">
                        <span className="text-slate-500">Cliente:</span>{" "}
                        <span className="font-medium text-slate-900">{pi.nome_anunciante || "—"}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-500">Campanha:</span>{" "}
                        <span className="font-medium text-slate-900">{pi.nome_campanha || "—"}</span>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex items-center rounded-full bg-red-50 text-red-800 px-2.5 py-1 border border-red-200">
                          {pi.tipo_pi}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-2.5 py-1 border border-slate-200" title="Praça">
                          {pi.uf_cliente || "—"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-800 px-2.5 py-1 border border-blue-200" title="Meio">
                          {pi.canal || "—"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-1 border border-emerald-200" title="Diretoria">
                          {pi.diretoria || "—"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-purple-50 text-purple-800 px-2.5 py-1 border border-purple-200" title="Executivo">
                          {pi.executivo || "—"}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600">
                        Emissão: <span className="font-medium text-slate-800">{parseISODateToBR(pi.data_emissao) || "—"}</span>
                        {dataVenda && (
                          <>
                            {" "}| Venda: <span className="font-medium text-slate-800">{dataVenda}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                      <button
                        onClick={() => abrirDetalhesPorId(pi.id)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-white"
                        title="Ver detalhes do PI"
                      >
                        🔎 Detalhes
                      </button>
                      <button
                        onClick={() => abrirEditor(pi)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-white"
                        title="Editar dados do PI"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => excluirPI(pi)}
                        disabled={excluindo}
                        className="px-3 py-1.5 rounded-xl border border-red-300 text-red-700 text-sm hover:bg-white disabled:opacity-60"
                        title="Excluir PI"
                      >
                        {excluindo ? "⏳ Excluindo…" : "🗑️ Excluir"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Painel de detalhes (todas as informações) */}
      {detalhePI && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={fecharDetalhes} />
          <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">Detalhe do PI</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">
                  <span className="font-mono truncate">{detalhePI.numero_pi}</span>
                </div>
                <div className="text-slate-600 mt-1 truncate">
                  {detalhePI.anunciante || "—"} • {detalhePI.campanha || "—"}
                </div>
              </div>
              <button
                onClick={fecharDetalhes}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                ✖ Fechar
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações completas do PI */}
              {selectedPiMeta && (
                <div className="rounded-2xl border border-slate-200">
                  <div className="px-4 py-3 border-b bg-slate-50 font-semibold">Informações do PI</div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <InfoRow label="Tipo" value={selectedPiMeta.tipo_pi} />
                    <InfoRow label="PI Matriz" value={(selectedPiMeta.tipo_pi === "CS" || selectedPiMeta.tipo_pi === "Abatimento") ? (selectedPiMeta.numero_pi_matriz || "—") : "—"} mono />
                    <InfoRow label="PI Normal (CS)" value={selectedPiMeta.tipo_pi === "CS" ? (selectedPiMeta.numero_pi_normal || "—") : "—"} mono />
                    <InfoRow label="Agência" value={selectedPiMeta.nome_agencia || "—"} />
                    <InfoRow label="CNPJ Agência" value={selectedPiMeta.cnpj_agencia || "—"} mono />
                    <InfoRow label="Data de Emissão" value={parseISODateToBR(selectedPiMeta.data_emissao) || "—"} />
                    <InfoRow label="Valor Líquido" value={fmtMoney(selectedPiMeta.valor_liquido)} />
                    <InfoRow label="Valor Total" value={fmtMoney(selectedPiMeta.valor_bruto)} />
                    <InfoRow label="Praça" value={selectedPiMeta.uf_cliente || "—"} />
                    <InfoRow label="Meio" value={selectedPiMeta.canal || "—"} />
                    <InfoRow label="Campanha" value={selectedPiMeta.nome_campanha || "—"} />
                    <InfoRow label="Diretoria" value={selectedPiMeta.diretoria || "—"} />
                    <InfoRow label="Executivo" value={selectedPiMeta.executivo || "—"} />
                    <InfoRow label="Data da Venda" value={(selectedPiMeta.dia_venda && selectedPiMeta.mes_venda) ? `${selectedPiMeta.dia_venda}/${selectedPiMeta.mes_venda}` : "—"} />
                    <InfoRow label="Observações" value={selectedPiMeta.observacoes || "—"} full />
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm text-slate-500">Total do PI</div>
                <div className="text-2xl font-bold">{fmtMoney(detalhePI.total_pi)}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b bg-slate-50 font-semibold">Veiculações cadastradas</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-red-600/90 text-white">
                        {["Produto", "Veiculação", "Janela", "Qtde", "Valor"].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-sm font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detalheLoading ? (
                        <tr><td className="px-4 py-3 text-slate-600" colSpan={5}>Carregando…</td></tr>
                      ) : veicsError ? (
                        <tr><td className="px-4 py-3 text-red-700" colSpan={5}>{veicsError}</td></tr>
                      ) : veics.length === 0 ? (
                        <tr><td className="px-4 py-3 text-slate-600" colSpan={5}>Sem veiculações.</td></tr>
                      ) : veics.map((v) => (
                        <tr key={v.id} className="border-b last:border-none">
                          <td className="px-4 py-2 font-semibold">{v.produto_nome || "—"}</td>
                          <td className="px-4 py-2">{[v.canal, v.formato].filter(Boolean).join(" • ") || "—"}</td>
                          <td className="px-4 py-2 text-sm">
                            {parseISODateToBR(v.data_inicio)} — {parseISODateToBR(v.data_fim)}
                          </td>
                          <td className="px-4 py-2">{v.quantidade ?? "—"}</td>
                          <td className="px-4 py-2">{fmtMoney(v.valor ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Painel de edição PI (básico) */}
      {editOpen && editDraft && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharEditor} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">Editar PI</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">
                  <span className="font-mono">{editDraft.numero_pi}</span>
                </div>
              </div>
              <button
                onClick={fecharEditor}
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

              {/* ...seus campos do editor... */}

              <div className="pt-2">
                <button
                  onClick={salvarEditor}
                  disabled={savingEdit}
                  className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {savingEdit ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

/** Sub-componente para linhas de informação do PI */
function InfoRow({ label, value, mono = false, full = false }: { label: string; value: any; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-slate-900 ${mono ? "font-mono" : "font-medium"}`}>
        {String(value ?? "—")}
      </div>
    </div>
  )
}
