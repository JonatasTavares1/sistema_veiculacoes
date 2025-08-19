// src/pages/Veiculacoes.tsx
import { useEffect, useMemo, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

type RowAgenda = {
  id: number
  produto_id: number
  pi_id: number
  numero_pi: string
  cliente?: string | null
  campanha?: string | null
  canal?: string | null
  formato?: string | null
  data_inicio?: string | null // ISO/Date
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
async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

export default function Veiculacoes() {
  const [inicio, setInicio] = useState<string>(() => new Date().toISOString().slice(0,10))
  const [fim, setFim] = useState<string>(() => new Date().toISOString().slice(0,10))
  const [canal, setCanal] = useState("")
  const [formato, setFormato] = useState("")
  const [executivo, setExecutivo] = useState("Todos")
  const [diretoria, setDiretoria] = useState("Todos")
  const [uf, setUF] = useState("")

  const [executivos, setExecutivos] = useState<string[]>([...DEFAULT_EXECUTIVOS])

  const [rows, setRows] = useState<RowAgenda[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    setLoading(true); setErro(null)
    try {
      const qs = new URLSearchParams()
      if (inicio) qs.set("inicio", inicio)
      if (fim) qs.set("fim", fim)
      if (canal.trim()) qs.set("canal", canal.trim())
      if (formato.trim()) qs.set("formato", formato.trim())
      if (executivo !== "Todos" && executivo.trim()) qs.set("executivo", executivo)
      if (diretoria !== "Todos" && diretoria.trim()) qs.set("diretoria", diretoria)
      if (uf.trim()) qs.set("uf_cliente", uf.trim())

      const data = await getJSON<RowAgenda[]>(`${API}/veiculacoes/agenda?${qs.toString()}`)
      setRows(Array.isArray(data) ? data : [])

      // tentar puxar executivos da API (se existir)
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
  // recarregar quando mudar filtros principais
  useEffect(() => { carregar() }, [inicio, fim, canal, formato, executivo, diretoria, uf])

  const totalLinhas = rows.length
  const totalValor = useMemo(() => rows.reduce((acc, r) => acc + (r.valor || 0), 0), [rows])
  const totalQtd = useMemo(() => rows.reduce((acc, r) => acc + (r.quantidade || 0), 0), [rows])

  async function exportarXLSX() {
    const mapped = rows.map(r => ({
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
    xlsx.writeFile(wb, `agenda_veiculacoes_${stamp}.xlsx`)
  }

  return (
    <div className="space-y-8">
      {/* Título + resumo */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900">Veiculações — Agenda</h1>
          <div className="mt-2 text-slate-600">
            {totalLinhas} item(ns) • Quantidade: <span className="font-semibold">{totalQtd}</span> • Valor total: <span className="font-semibold">{fmtMoney(totalValor)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportarXLSX}
            className="px-5 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-lg hover:bg-slate-50"
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
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Início</label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Fim</label>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Canal</label>
            <input
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              placeholder="Ex.: TV, Rádio…"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Formato</label>
            <input
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
              placeholder="Ex.: 30s, Post…"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
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
          <div className="xl:col-span-2">
            <label className="block text-xl font-semibold text-slate-800 mb-2">UF do Cliente</label>
            <input
              value={uf}
              onChange={(e) => setUF(e.target.value)}
              placeholder="Ex.: SP, RJ"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
        </div>
      </section>

      {/* Tabela */}
      <section>
        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : erro ? (
          <div className="p-4 text-red-700 text-lg">{erro}</div>
        ) : rows.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nada para veicular no período.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-red-200 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-red-100">
              <div className="text-slate-700">{rows.length} item(ns) • {fmtMoney(totalValor)}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-red-200">
                <thead className="bg-gradient-to-r from-red-700 to-red-600 text-white sticky top-0">
                  <tr>
                    {[
                      "PI","Cliente","Campanha","Produto","Canal","Formato",
                      "Início","Fim","Qtde","Valor","Executivo","Diretoria","UF"
                    ].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {rows.map((r, idx) => (
                    <tr key={r.id} className={["transition", idx % 2 === 0 ? "bg-white" : "bg-red-50/40", "hover:bg-red-50"].join(" ")}>
                      <td className="px-4 py-3 font-mono text-slate-900">{r.numero_pi}</td>
                      <td className="px-4 py-3 text-slate-800">{r.cliente || "—"}</td>
                      <td className="px-4 py-3 text-slate-800"><div className="truncate max-w-[260px]">{r.campanha || "—"}</div></td>
                      <td className="px-4 py-3 text-slate-800"><div className="truncate max-w-[220px]">{r.produto_nome || "—"}</div></td>
                      <td className="px-4 py-3 text-slate-800">{r.canal || "—"}</td>
                      <td className="px-4 py-3 text-slate-800">{r.formato || "—"}</td>
                      <td className="px-4 py-3 text-slate-700 text-sm">{parseISODateToBR(r.data_inicio) || "—"}</td>
                      <td className="px-4 py-3 text-slate-700 text-sm">{parseISODateToBR(r.data_fim) || "—"}</td>
                      <td className="px-4 py-3 text-slate-800">{r.quantidade ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-900 font-semibold">{fmtMoney(r.valor)}</td>
                      <td className="px-4 py-3 text-slate-800">{r.executivo || "—"}</td>
                      <td className="px-4 py-3 text-slate-800">{r.diretoria || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-semibold">
                          {r.uf_cliente || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-3 text-right font-semibold" colSpan={8}>Totais</td>
                    <td className="px-4 py-3 font-semibold">{totalQtd}</td>
                    <td className="px-4 py-3 font-semibold">{fmtMoney(totalValor)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
