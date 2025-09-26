// src/pages/Veiculacoes.tsx
import { useEffect, useMemo, useRef, useState } from "react"

// ======================== Config/Util ========================
const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

// se você criar o endpoint /veiculacoes/:id/status no backend, mude para true
const HAS_STATUS_ENDPOINT = false

type RowAgenda = {
  id: number
  produto_id: number
  pi_id: number
  numero_pi: string
  cliente?: string | null
  campanha?: string | null
  canal?: string | null
  formato?: string | null
  data_inicio?: string | null // ISO 'yyyy-mm-dd' (ou 'yyyy-mm-ddTHH:MM:SS')
  data_fim?: string | null
  quantidade?: number | null
  valor?: number | null
  produto_nome?: string | null
  executivo?: string | null
  diretoria?: string | null
  uf_cliente?: string | null
  em_veiculacao?: boolean | null
  status_atualizado_em?: string | null
}

const DEFAULT_EXECUTIVOS = [
  "Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio",
  "Flavio de Paula", "Lorena Fernandes", "Henri Marques", "Caio Bruno",
  "Flavia Cabral", "Paula Caroline", "Leila Santos", "Jessica Ribeiro", "Paula Campos",
]
const DIRETORIAS = ["Governo Federal", "Governo Estadual", "Rafael Augusto"]

const CANAL_COLORS: Record<string, string> = {
  TV: "bg-purple-100 text-purple-800 border-purple-200",
  RADIO: "bg-amber-100 text-amber-800 border-amber-200",
  DOOH: "bg-teal-100 text-teal-800 border-teal-200",
  SITE: "bg-blue-100 text-blue-800 border-blue-200",
  PORTAL: "bg-blue-100 text-blue-800 border-blue-200",
  INSTAGRAM: "bg-pink-100 text-pink-800 border-pink-200",
  FACEBOOK: "bg-blue-100 text-blue-800 border-blue-200",
  YOUTUBE: "bg-red-100 text-red-800 border-red-200",
  TIKTOK: "bg-zinc-900 text-white border-zinc-800",
  JORNAL: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REVISTA: "bg-rose-100 text-rose-800 border-rose-200",
  PROGRAMMATIC: "bg-indigo-100 text-indigo-800 border-indigo-200",
  OUTROS: "bg-slate-100 text-slate-800 border-slate-200",
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ")
}
function fmtMoney(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "R$ 0,00"
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function parseISODateToBR(s?: string | null) {
  if (!s) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  return s.slice(0, 10).split("-").reverse().join("/")
}
function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const da = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${da}`
}
function dateOnly(s?: string | null) {
  if (!s) return ""
  return s.slice(0, 10)
}
function withinRangeInclusive(nowISO: string, startISO?: string | null, endISO?: string | null) {
  const now = dateOnly(nowISO)
  const s = dateOnly(startISO)
  const e = dateOnly(endISO)
  if (s && now < s) return false
  if (e && now > e) return false
  return true
}
async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}
async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let detail = await r.text()
    try { detail = (await r.json()).detail ?? detail } catch {}
    throw new Error(detail || `Erro ${r.status}`)
  }
  return r.json()
}
async function putJSON<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let detail = await r.text()
    try { detail = (await r.json()).detail ?? detail } catch {}
    throw new Error(detail || `Erro ${r.status}`)
  }
  return r.json()
}

// ======================== Agrupamento ========================
type GrupoPI = {
  numero_pi: string
  header: RowAgenda
  itens: RowAgenda[]
  totalValor: number
  totalQtd: number
}

// ======================== Status persistente ========================
const LS_KEY = "veiculacoes_status_v1"
type LocalStatus = { on: boolean; ts: string }
function loadStatuses(): Record<string, LocalStatus> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, LocalStatus>
    return parsed || {}
  } catch { return {} }
}
function saveStatuses(map: Record<string, LocalStatus>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)) } catch {}
}

// ======================== Página ========================
export default function Veiculacoes() {
  // -------- Filtros
  const [inicio, setInicio] = useState(() => todayISO())
  const [fim, setFim] = useState(() => todayISO())
  const [canal, setCanal] = useState("")
  const [formato, setFormato] = useState("")
  const [executivo, setExecutivo] = useState("Todos")
  const [diretoria, setDiretoria] = useState("Todos")
  const [uf, setUF] = useState("")
  const [buscaGlobal, setBuscaGlobal] = useState("")
  const [executivos, setExecutivos] = useState<string[]>([...DEFAULT_EXECUTIVOS])

  // -------- Dados base
  const [rows, setRows] = useState<RowAgenda[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // -------- UI
  const [compact, setCompact] = useState(false)
  const [showOnlyOn, setShowOnlyOn] = useState(false)
  const [showOnlyOff, setShowOnlyOff] = useState(false)
  const [ignorarPeriodo, setIgnorarPeriodo] = useState(true)

  // expansão por PI
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  function expandAll(keys: string[]) { setExpanded(new Set(keys)) }
  function collapseAll() { setExpanded(new Set()) }
  function togglePI(key: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key); else n.add(key)
      return n
    })
  }

  // -------- "Veiculando" (check) — estado e persistência
  const [statusMap, setStatusMap] = useState<Record<string, LocalStatus>>(() => loadStatuses())
  function resolveOn(r: RowAgenda): boolean {
    const fromApi = r.em_veiculacao
    if (typeof fromApi === "boolean") return fromApi
    const local = statusMap[String(r.id)]
    return local?.on ?? false
  }
  function setOn(id: number, on: boolean) {
    const ts = new Date().toISOString()
    setStatusMap(prev => {
      const next = { ...prev, [String(id)]: { on, ts } }
      saveStatuses(next)
      return next
    })
    if (HAS_STATUS_ENDPOINT) {
      postJSON(`${API}/veiculacoes/${id}/status`, { em_veiculacao: on, atualizado_em: ts }).catch(() => {})
    }
  }
  function bulkSetOn(ids: number[], on: boolean) {
    const ts = new Date().toISOString()
    setStatusMap(prev => {
      const next = { ...prev }
      ids.forEach(id => { next[String(id)] = { on, ts } })
      saveStatuses(next)
      return next
    })
    if (HAS_STATUS_ENDPOINT) {
      ids.forEach(id => postJSON(`${API}/veiculacoes/${id}/status`, { em_veiculacao: on, atualizado_em: ts }).catch(() => {}))
    }
  }

  // -------- Carregamento
  async function carregar() {
    setLoading(true); setErro(null)
    try {
      let data: RowAgenda[] = []

      if (ignorarPeriodo) {
        const all = await getJSON<any[]>(`${API}/veiculacoes`)
        data = (all || []).map(v => ({
          id: v.id,
          produto_id: v.produto_id,
          pi_id: v.pi_id,
          numero_pi: v.numero_pi || (v.pi?.numero_pi ?? ""),
          cliente: v.cliente ?? null,
          campanha: v.campanha ?? null,
          canal: v.canal ?? null,
          formato: v.formato ?? null,
          data_inicio: v.data_inicio ?? null,
          data_fim: v.data_fim ?? null,
          quantidade: v.quantidade ?? null,
          valor: (typeof v.valor_liquido === "number" ? v.valor_liquido :
                  typeof v.valor_bruto === "number" ? v.valor_bruto : null),
          produto_nome: v.produto_nome ?? null,
          executivo: v.executivo ?? null,
          diretoria: v.diretoria ?? null,
          uf_cliente: v.uf_cliente ?? null,
          em_veiculacao: v.em_veiculacao ?? null,
          status_atualizado_em: null,
        }))
      } else {
        const qs = new URLSearchParams()
        if (inicio) qs.set("inicio", inicio)
        if (fim) qs.set("fim", fim)
        if (canal.trim()) qs.set("canal", canal.trim())
        if (formato.trim()) qs.set("formato", formato.trim())
        if (executivo !== "Todos" && executivo.trim()) qs.set("executivo", executivo)
        if (diretoria !== "Todos" && diretoria.trim()) qs.set("diretoria", diretoria)
        if (uf.trim()) qs.set("uf_cliente", uf.trim())
        data = await getJSON<RowAgenda[]>(`${API}/veiculacoes/agenda?${qs.toString()}`)
      }

      setRows(Array.isArray(data) ? data : [])

      const exsFromApi = await getJSON<string[]>(`${API}/executivos`).catch(() => [])
      const merged = Array.from(new Set([...(Array.isArray(exsFromApi) ? exsFromApi : []), ...DEFAULT_EXECUTIVOS]))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
      setExecutivos(merged)
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar agenda.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { carregar() }, [])
  useEffect(() => { carregar() }, [ignorarPeriodo, inicio, fim, canal, formato, executivo, diretoria, uf])

  // -------- Busca Global (debounced)
  const [debouncedBusca, setDebouncedBusca] = useState("")
  const buscaRef = useRef<number | null>(null)
  useEffect(() => {
    if (buscaRef.current != null) window.clearTimeout(buscaRef.current)
    buscaRef.current = window.setTimeout(() => setDebouncedBusca(buscaGlobal.trim().toLowerCase()), 250)
    return () => { if (buscaRef.current != null) window.clearTimeout(buscaRef.current) }
  }, [buscaGlobal])

  const nowISO = todayISO()
  const _within = (start?: string | null, end?: string | null) =>
    ignorarPeriodo ? true : withinRangeInclusive(nowISO, start, end)

  // -------- Agrupamento por PI + estado expandido
  const grupos = useMemo(() => {
    let filtered = rows.filter(r => {
      if (debouncedBusca) {
        const blob = [
          r.numero_pi, r.cliente, r.campanha, r.produto_nome, r.canal, r.formato, r.executivo, r.diretoria, r.uf_cliente,
          parseISODateToBR(r.data_inicio), parseISODateToBR(r.data_fim),
        ].join(" ").toLowerCase()
        if (!blob.includes(debouncedBusca)) return false
      }
      return true
    })

    filtered = filtered.filter(r => {
      const markedOn = resolveOn(r)
      if (showOnlyOn && !markedOn) return false
      if (showOnlyOff && markedOn) return false
      return true
    })

    const byPI = new Map<string, GrupoPI>()
    for (const r of filtered) {
      const key = r.numero_pi
      if (!byPI.has(key)) {
        byPI.set(key, { numero_pi: key, header: r, itens: [], totalValor: 0, totalQtd: 0 })
      }
      const g = byPI.get(key)!
      g.itens.push(r)
      g.totalValor += r.valor || 0
      g.totalQtd += r.quantidade || 0
    }
    const arr = Array.from(byPI.values())
    arr.sort((a, b) => a.numero_pi.localeCompare(b.numero_pi, "pt-BR", { numeric: true }))
    for (const g of arr) {
      g.itens.sort((a, b) => dateOnly(a.data_inicio).localeCompare(dateOnly(b.data_inicio)))
    }
    return arr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, debouncedBusca, showOnlyOn, showOnlyOff, statusMap])

  // Totais gerais
  const totalLinhas = useMemo(() => grupos.reduce((acc, g) => acc + g.itens.length, 0), [grupos])
  const totalValor = useMemo(() => grupos.reduce((acc, g) => acc + g.totalValor, 0), [grupos])
  const totalQtd = useMemo(() => grupos.reduce((acc, g) => acc + g.totalQtd, 0), [grupos])

  // KPIs
  const kpis = useMemo(() => {
    let shouldOn = 0, markedOn = 0, mismatchShouldButOff = 0, mismatchOutButOn = 0
    for (const g of grupos) {
      for (const r of g.itens) {
        const should = _within(r.data_inicio, r.data_fim)
        const on = resolveOn(r)
        if (should) shouldOn++
        if (on) markedOn++
        if (should && !on) mismatchShouldButOff++
        if (!should && on) mismatchOutButOn++
      }
    }
    return { shouldOn, markedOn, mismatchShouldButOff, mismatchOutButOn }
  }, [grupos, nowISO, statusMap, ignorarPeriodo])

  // ======================== Export XLSX (todos / por PI) ========================
  async function exportarXLSX(allRows: RowAgenda[], nomeArquivo: string) {
    const mapped = allRows.map(r => ({
      "PI": r.numero_pi,
      "Cliente": r.cliente || "",
      "Campanha": r.campanha || "",
      "Produto": r.produto_nome || "",
      "Canal": r.canal || "",
      "Formato": r.formato || "",
      "Início": parseISODateToBR(r.data_inicio),
      "Fim": parseISODateToBR(r.data_fim),
      "Quantidade": r.quantidade ?? 0,
      "Valor (R$)": r.valor ?? 0,
      "Executivo": r.executivo || "",
      "Diretoria": r.diretoria || "",
      "UF": r.uf_cliente || "",
      "Veiculando": resolveOn(r) ? "SIM" : "NÃO",
    }))

    const xlsx = await import("xlsx")
    const ws = xlsx.utils.json_to_sheet(mapped, { header: Object.keys(mapped[0] || {}) })
    const moneyCol = "Valor (R$)"
    mapped.forEach((r, i) => {
      const cell = xlsx.utils.encode_cell({ r: i + 1, c: Object.keys(mapped[0]).indexOf(moneyCol) })
      const v = r[moneyCol as keyof typeof r] as number
      ;(ws as any)[cell] = { t: "s", v: (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
    })
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, "Agenda")
    const now = new Date()
    const stamp = now.toISOString().slice(0,19).replace(/[:T]/g,"-")
    const finalName = `${nomeArquivo}_${stamp}.xlsx`
    xlsx.writeFile(wb, finalName)
  }
  function exportarTudo() {
    exportarXLSX(grupos.flatMap(g => g.itens), "agenda_veiculacoes")
  }
  function exportarPI(g: GrupoPI) {
    exportarXLSX(g.itens, `agenda_${g.numero_pi}`)
  }

  // ======================== Entrega / Finalização ========================
  const [entregaOpen, setEntregaOpen] = useState(false)
  const [entregaLoading, setEntregaLoading] = useState(false)
  const [entregaErro, setEntregaErro] = useState<string | null>(null)
  const [entregaData, setEntregaData] = useState<string>(() => todayISO())
  const [entregaMotivo, setEntregaMotivo] = useState<string>("")
  const [entregaFinalizar, setEntregaFinalizar] = useState<boolean>(true)
  const [entregaAlvo, setEntregaAlvo] = useState<RowAgenda | null>(null)

  function abrirEntrega(v: RowAgenda, autoFinalizar: boolean) {
    setEntregaAlvo(v)
    setEntregaData(todayISO())
    setEntregaMotivo("")
    setEntregaFinalizar(autoFinalizar)
    setEntregaErro(null)
    setEntregaOpen(true)
  }

  async function registrarEntrega(veic: RowAgenda, finalizarTambem: boolean) {
    setEntregaLoading(true); setEntregaErro(null)
    try {
      // 1) cria entrega
      await postJSON(`${API}/entregas`, {
        veiculacao_id: veic.id,
        pi_id: veic.pi_id,
        data_entrega: entregaData || todayISO(),
        foi_entregue: "entregue",
        motivo: entregaMotivo || null,
      })

      // 2) finaliza (opcional): tenta setar data_fim = hoje e desligar ON
      if (finalizarTambem) {
        try {
          await putJSON(`${API}/veiculacoes/${veic.id}`, { data_fim: todayISO() })
        } catch { /* se não der, ao menos marcamos OFF */ }
        setOn(veic.id, false)
      }

      setEntregaOpen(false)
      await carregar()
    } catch (e: any) {
      setEntregaErro(e?.message || "Falha ao registrar entrega.")
    } finally {
      setEntregaLoading(false)
    }
  }

  async function finalizarSomente(veic: RowAgenda) {
    try {
      await putJSON(`${API}/veiculacoes/${veic.id}`, { data_fim: todayISO() })
    } catch { /* ignora erro do PUT */ }
    setOn(veic.id, false)
    await carregar()
  }

  // -------- UI helpers
  function chipCanal(c?: string | null) {
    const key = (c || "").toUpperCase()
    const klass = CANAL_COLORS[key] || "bg-slate-100 text-slate-800 border-slate-200"
    return classNames("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border", klass)
  }
  function statusBadge(r: RowAgenda) {
    const should = _within(r.data_inicio, r.data_fim)
    const on = resolveOn(r)
    if (should && on) return <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-xs font-semibold">✅ Veiculando</span>
    if (should && !on) return <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 text-xs font-semibold">⚠ Deveria estar no ar</span>
    if (!should && on) return <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-semibold">⏳ Fora do período (ON)</span>
    return <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 text-xs font-semibold">⛔ Off</span>
  }

  // ======================== Render ========================
  return (
    <div className="space-y-8">
      {/* Título + resumo */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900">Veiculações — Agenda</h1>
          <div className="mt-2 text-slate-600 flex flex-wrap gap-3">
            <span>{totalLinhas} item(ns)</span>
            <span>• Quantidade: <span className="font-semibold">{totalQtd}</span></span>
            <span>• Valor total: <span className="font-semibold">{fmtMoney(totalValor)}</span></span>
          </div>
          {/* KPIs de status */}
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-1 border border-emerald-200">
              No período (devem estar ON): <b className="ml-1">{kpis.shouldOn}</b>
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-800 px-2.5 py-1 border border-blue-200">
              Marcados ON: <b className="ml-1">{kpis.markedOn}</b>
            </span>
            {kpis.mismatchShouldButOff > 0 && (
              <span className="inline-flex items-center rounded-full bg-red-50 text-red-800 px-2.5 py-1 border border-red-200">
                Devem estar ON, mas OFF: <b className="ml-1">{kpis.mismatchShouldButOff}</b>
              </span>
            )}
            {kpis.mismatchOutButOn > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 px-2.5 py-1 border border-amber-200">
                Fora do período, mas ON: <b className="ml-1">{kpis.mismatchOutButOn}</b>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={exportarTudo}
            className="px-5 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-lg hover:bg-slate-50"
          >
            📤 Exportar XLSX
          </button>
          <button
            onClick={() => expandAll(grupos.map(g => g.numero_pi))}
            className="px-4 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Expandir todos
          </button>
          <button
            onClick={collapseAll}
            className="px-4 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Recolher todos
          </button>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 border border-slate-300 rounded-2xl px-3 py-2 bg-white">
            <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} className="h-4 w-4 accent-red-600" />
            modo compacto
          </label>
        </div>
      </div>

      {/* Filtros */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 xl:grid-cols-9 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Início</label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              disabled={ignorarPeriodo}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Fim</label>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              disabled={ignorarPeriodo}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Canal</label>
            <input
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              placeholder="Ex.: TV, Rádio…"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Formato</label>
            <input
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
              placeholder="Ex.: 30s, Post…"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Diretoria</label>
            <select
              value={diretoria}
              onChange={(e) => setDiretoria(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option>Todos</option>
              {DIRETORIAS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Executivo</label>
            <select
              value={executivo}
              onChange={(e) => setExecutivo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option>Todos</option>
              {executivos.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">UF do Cliente</label>
            <input
              value={uf}
              onChange={(e) => setUF(e.target.value)}
              placeholder="Ex.: SP, RJ"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
          <div className="xl:col-span-2">
            <label className="block text-sm font-semibold text-slate-800 mb-1">Busca (qualquer campo)</label>
            <input
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
              placeholder="PI, cliente, campanha, produto, canal…"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
        </div>

        {/* Subfiltros por status + Ignorar período */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showOnlyOn}
              onChange={(e) => { setShowOnlyOn(e.target.checked); if (e.target.checked) setShowOnlyOff(false) }}
              className="h-4 w-4 accent-emerald-600"
            />
            Mostrar apenas <span className="font-semibold text-emerald-700">veiculando (ON)</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showOnlyOff}
              onChange={(e) => { setShowOnlyOff(e.target.checked); if (e.target.checked) setShowOnlyOn(false) }}
              className="h-4 w-4 accent-red-600"
            />
            Mostrar apenas <span className="font-semibold text-red-700">não veiculando (OFF)</span>
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={ignorarPeriodo}
              onChange={(e) => setIgnorarPeriodo(e.target.checked)}
              className="h-4 w-4 accent-slate-700"
            />
            Ignorar período (trazer todas as veiculações)
          </label>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={carregar}
              className="px-4 py-2 rounded-2xl bg-red-600 text-white font-semibold hover:bg-red-700 transition shadow-sm"
            >
              Atualizar
            </button>
          </div>
        </div>
      </section>

      {/* Cards por PI */}
      <section>
        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : erro ? (
          <div className="p-4 text-red-700 text-lg">{erro}</div>
        ) : grupos.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nada para veicular no período.
          </div>
        ) : (
          <div className="space-y-6">
            {grupos.map((g) => {
              const isOpen = expanded.has(g.numero_pi)
              return (
                <div key={g.numero_pi} className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
                  {/* Cabeçalho do PI */}
                  <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-red-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg font-bold text-slate-900">{g.numero_pi}</span>
                        <span className="inline-flex items-center rounded-full bg-red-50 text-red-800 px-2.5 py-1 text-xs font-semibold border border-red-200">
                          {g.header.uf_cliente || "—"}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-700 truncate">
                        <span className="font-medium">{g.header.cliente || "—"}</span>
                        {g.header.campanha ? <span className="text-slate-500"> — {g.header.campanha}</span> : null}
                      </div>
                      {/* Totais do PI */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-2.5 py-0.5 border border-slate-200">Qtde: <b className="ml-1">{g.totalQtd}</b></span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-2.5 py-0.5 border border-slate-200">Valor: <b className="ml-1">{fmtMoney(g.totalValor)}</b></span>
                        <span className="inline-flex items-center rounded-full bg-slate-50 text-slate-700 px-2.5 py-0.5 border border-slate-200">Veiculações: <b className="ml-1">{g.itens.length}</b></span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => exportarPI(g)}
                        className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        Exportar PI
                      </button>
                      <button
                        onClick={() => marcarTodasPI(g, true)}
                        className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        Marcar todos ON
                      </button>
                      <button
                        onClick={() => marcarTodasPI(g, false)}
                        className="px-3 py-2 rounded-xl bg-slate-700 text-white hover:bg-slate-800"
                      >
                        Marcar todos OFF
                      </button>
                      <button
                        onClick={() => marcarSomenteNoPeriodoPI(g)}
                        className="px-3 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700"
                      >
                        ON só no período
                      </button>
                      <button
                        onClick={() => togglePI(g.numero_pi)}
                        className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        {isOpen ? "Recolher" : "Expandir"}
                      </button>
                    </div>
                  </div>

                  {/* Grid de veiculações (mini-cards) */}
                  {isOpen && (
                    <div className={classNames("p-4", compact && "p-3")}>
                      <div className={classNames("grid gap-4", compact ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3")}>
                        {g.itens.map((r, idx) => {
                          const on = resolveOn(r)
                          const should = _within(r.data_inicio, r.data_fim)
                          return (
                            <div
                              key={r.id}
                              className={classNames(
                                "rounded-xl border bg-white shadow-sm overflow-hidden transition",
                                idx % 2 ? "border-red-100" : "border-slate-200",
                                !on && should && "ring-2 ring-red-200",
                                on && !should && "ring-2 ring-amber-200"
                              )}
                            >
                              <div className={classNames("p-4", compact && "p-3")}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium text-slate-900 truncate">
                                      {r.produto_nome || "—"}
                                    </div>

                                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                      {r.canal && (
                                        <span className={chipCanal(r.canal)} title="Canal">
                                          {r.canal}
                                        </span>
                                      )}
                                      {r.formato && (
                                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-2 py-0.5 font-semibold border border-slate-200" title="Formato">
                                          {r.formato}
                                        </span>
                                      )}
                                      {(r.data_inicio || r.data_fim) && (
                                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-2 py-0.5 font-semibold border border-slate-200" title="Período">
                                          {parseISODateToBR(r.data_inicio)} → {parseISODateToBR(r.data_fim)}
                                        </span>
                                      )}
                                      {typeof r.quantidade === "number" && (
                                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-2 py-0.5 font-semibold border border-slate-200" title="Quantidade">
                                          Qtde {r.quantidade}
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {statusBadge(r)}
                                      {(r.executivo || r.diretoria) && (
                                        <span className="text-xs text-slate-500">
                                          {r.executivo || "—"} • {r.diretoria || "—"}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-slate-900 font-semibold">{fmtMoney(r.valor)}</div>
                                    <label className="mt-2 inline-flex items-center gap-2 text-xs">
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        onChange={(e) => setOn(r.id, e.target.checked)}
                                        className="h-4 w-4 accent-emerald-600"
                                        title="Marcar como veiculando"
                                      />
                                      {on ? <span className="text-emerald-700 font-semibold">ON</span> : <span className="text-slate-600">OFF</span>}
                                    </label>
                                  </div>
                                </div>

                                {/* Ações rápidas */}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => abrirEntrega(r, false)}
                                    className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                                    title="Registrar entrega"
                                  >
                                    📦 Registrar entrega
                                  </button>
                                  <button
                                    onClick={() => abrirEntrega(r, true)}
                                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                    title="Registrar entrega e finalizar"
                                  >
                                    ✅ Entrega + finalizar
                                  </button>
                                  <button
                                    onClick={() => finalizarSomente(r)}
                                    className="px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900"
                                    title="Finalizar (encerrar hoje)"
                                  >
                                    ⛔ Finalizar
                                  </button>
                                </div>

                                {/* Alertas de coerência */}
                                {should && !on && (
                                  <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                                    Esta veiculação está dentro do período <b>e deveria estar no ar</b>, mas está marcada como OFF.
                                  </div>
                                )}
                                {!should && on && (
                                  <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                                    Esta veiculação está <b>fora do período</b>, mas foi marcada como ON.
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Rodapé do card (totais do PI) */}
                      <div className={classNames("mt-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-end gap-4", compact && "py-2")}>
                        <div className="text-slate-700 text-sm">Totais do PI</div>
                        <div className="text-slate-800 font-semibold">Qtde: {g.totalQtd}</div>
                        <div className="text-slate-800 font-semibold">Valor: {fmtMoney(g.totalValor)}</div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ===== Modal de Entrega ===== */}
      {entregaOpen && entregaAlvo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => !entregaLoading && setEntregaOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Registrar entrega {entregaFinalizar ? " + finalizar" : ""}</h3>
              <button
                onClick={() => !entregaLoading && setEntregaOpen(false)}
                className="text-slate-500 hover:text-slate-700"
                aria-label="Fechar"
              >✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-slate-700">
                <div><b>PI:</b> {entregaAlvo.numero_pi}</div>
                <div><b>Produto:</b> {entregaAlvo.produto_nome || "—"}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Data da entrega</label>
                <input
                  type="date"
                  value={entregaData}
                  onChange={(e) => setEntregaData(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Motivo / Observação (opcional)</label>
                <textarea
                  value={entregaMotivo}
                  onChange={(e) => setEntregaMotivo(e.target.value)}
                  placeholder="Ex.: campanha concluída, material veiculado conforme plano…"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500"
                  rows={3}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={entregaFinalizar}
                  onChange={(e) => setEntregaFinalizar(e.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
                Finalizar veiculação após registrar entrega (fecha com data de hoje)
              </label>

              {entregaErro && (
                <div className="rounded-lg bg-red-50 text-red-800 border border-red-200 px-3 py-2 text-sm">
                  {entregaErro}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setEntregaOpen(false)}
                disabled={entregaLoading}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => entregaAlvo && registrarEntrega(entregaAlvo, entregaFinalizar)}
                disabled={entregaLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {entregaLoading ? "Salvando..." : (entregaFinalizar ? "Registrar + Finalizar" : "Registrar entrega")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
