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

// detalhe do PI (cabeçalho/total + opcionalmente produtos/veiculações)
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

// veiculações (vêm de GET /pis/{pi_id}/veiculacoes ou de /veiculacoes?pi_id= / numero_pi=)
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

// --- helpers para fallback das veiculações vindas no /detalhe ---
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

  // editor PI básico
  const [editOpen, setEditOpen] = useState(false)
  const [editDraft, setEditDraft] = useState<PIItem | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

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
        ws[cell] = { t: "s", v: (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
      })
    })

    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, "PIs")
    const now = new Date()
    const stamp = now.toISOString().slice(0,19).replace(/[:T]/g,"-")
    xlsx.writeFile(wb, `pis_${stamp}.xlsx`)
  }

  // --- nova função util: tenta vários endpoints conhecidos da "view de veiculações" ---
  async function carregarVeiculacoesPorPI(pi_id: number, numero_pi?: string): Promise<VeiculacaoRow[]> {
    // 1) endpoint específico do PI
    try {
      const v1 = await getJSON<VeiculacaoRow[]>(`${API}/pis/${pi_id}/veiculacoes`)
      if (Array.isArray(v1) && v1.length) {
        return v1.filter(r => r.pi_id === pi_id || r.numero_pi === numero_pi)
      }
    } catch (_) { /* segue o fluxo */ }

    // 2) endpoint geral filtrando por pi_id
    try {
      const v2 = await getJSON<VeiculacaoRow[]>(`${API}/veiculacoes?pi_id=${encodeURIComponent(String(pi_id))}`)
      if (Array.isArray(v2) && v2.length) {
        return v2.filter(r => r.pi_id === pi_id)
      }
    } catch (_) { /* segue o fluxo */ }

    // 3) endpoint geral filtrando por numero_pi (algumas telas usam esse param)
    if (numero_pi) {
      try {
        const v3 = await getJSON<VeiculacaoRow[]>(`${API}/veiculacoes?numero_pi=${encodeURIComponent(numero_pi)}`)
        if (Array.isArray(v3) && v3.length) {
          return v3.filter(r => r.numero_pi === numero_pi)
        }
      } catch (_) { /* segue o fluxo */ }
    }

    // 4) sem sorte — devolve vazio pra cair no fallback do /detalhe
    return []
  }

  // detalhe: carrega cabeçalho e tenta veiculações pelos endpoints; se nada, usa as do /detalhe
  async function abrirDetalhesPorId(pi_id: number) {
    setDetalheLoading(true)
    setVeics([])
    setVeicsError(null)
    try {
      const det = await getJSON<PiDetalhe>(`${API}/pis/${pi_id}/detalhe`)
      setDetalhePI(det)

      // tenta puxar como a "view de veiculações" faz
      const viaEndpoints = await carregarVeiculacoesPorPI(pi_id, det?.numero_pi)

      // se ainda vier vazio, usa as do /detalhe (produtos->veiculacoes)
      const viaDetalhe = flattenVeicsFromDetalhe(det)
      const rows = (viaEndpoints.length ? viaEndpoints : viaDetalhe)

      setVeics(rows)
      if (rows.length === 0) setVeicsError(null) // sem erro, só sem dados
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
  }

  // ------- Editor PI básico (mantém) --------
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

  return (
    <div className="space-y-8">
      {/* Título + ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">PIs Cadastrados</h1>
        <div className="flex items-center gap-3">
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

      {/* Lista */}
      <section>
        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : erro ? (
          <div className="p-4 text-red-700 text-lg">{erro}</div>
        ) : filtrada.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nenhum PI encontrado.
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
                              onClick={() => abrirDetalhesPorId(pi.id)}
                              className="px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-700 text-sm hover:bg-emerald-50"
                              title="Ver veiculações deste PI"
                            >
                              📅 Veiculações
                            </button>
                            <button
                              onClick={() => abrirEditor(pi)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Editar dados do PI"
                            >
                              ✏️ Editar
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
        )}
      </section>

      {/* Painel de detalhes (somente leitura) */}
      {detalhePI && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={fecharDetalhes} />
          <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">Detalhe do PI</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">
                  <span className="font-mono">{detalhePI.numero_pi}</span>
                </div>
                <div className="text-slate-600 mt-1">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Número do PI</label>
                  <input
                    value={editDraft.numero_pi || ""}
                    onChange={(e) => campo("numero_pi", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de PI</label>
                  <select
                    value={editDraft.tipo_pi}
                    onChange={(e) => campo("tipo_pi", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {["Matriz", "Normal", "CS", "Abatimento"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">PI Matriz (para Abatimento)</label>
                  <input
                    value={editDraft.numero_pi_matriz || ""}
                    onChange={(e) => campo("numero_pi_matriz", e.target.value)}
                    disabled={editDraft.tipo_pi !== "Abatimento"}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">PI Normal (para CS)</label>
                  <input
                    value={editDraft.numero_pi_normal || ""}
                    onChange={(e) => campo("numero_pi_normal", e.target.value)}
                    disabled={editDraft.tipo_pi !== "CS"}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Cliente</label>
                  <input
                    value={editDraft.nome_anunciante || ""}
                    onChange={(e) => campo("nome_anunciante", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Agência</label>
                  <input
                    value={editDraft.nome_agencia || ""}
                    onChange={(e) => campo("nome_agencia", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Data de Emissão (dd/mm/aaaa)</label>
                  <input
                    value={editDraft.data_emissao || ""}
                    onChange={(e) => campo("data_emissao", e.target.value)}
                    placeholder="dd/mm/aaaa"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Valor Bruto (R$)</label>
                  <input
                    value={String(editDraft.valor_bruto ?? "")}
                    onChange={(e) => campo("valor_bruto" as any, e.target.value as any)}
                    placeholder="1000,00"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Valor Líquido (R$)</label>
                  <input
                    value={String(editDraft.valor_liquido ?? "")}
                    onChange={(e) => campo("valor_liquido" as any, e.target.value as any)}
                    placeholder="900,00"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Praça (UF do Cliente)</label>
                  <input
                    value={editDraft.uf_cliente || ""}
                    onChange={(e) => campo("uf_cliente", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Meio (Canal)</label>
                  <input
                    value={editDraft.canal || ""}
                    onChange={(e) => campo("canal", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Campanha</label>
                  <input
                    value={editDraft.nome_campanha || ""}
                    onChange={(e) => campo("nome_campanha", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Diretoria</label>
                  <select
                    value={editDraft.diretoria || ""}
                    onChange={(e) => campo("diretoria", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">—</option>
                    {DIRETORIAS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Executivo</label>
                  <select
                    value={editDraft.executivo || ""}
                    onChange={(e) => campo("executivo", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">—</option>
                    {executivos.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Dia da Venda</label>
                  <input
                    value={String(editDraft.dia_venda ?? "")}
                    onChange={(e) => campo("dia_venda" as any, e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Mês/Ano da Venda (mm/aaaa)</label>
                  <input
                    value={editDraft.mes_venda || ""}
                    onChange={(e) => campo("mes_venda", e.target.value)}
                    placeholder="07/2025"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Observações</label>
                  <textarea
                    value={editDraft.observacoes || ""}
                    onChange={(e) => campo("observacoes", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 min-h-[90px]"
                  />
                </div>
              </div>

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
