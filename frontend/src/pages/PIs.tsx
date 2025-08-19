// src/pages/PIs.tsx
import type { useEffect, useMemo, useState } from "react"

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

/** Tipagens para o detalhe (Produtos & Veiculações) */
type VeiculacaoOut = {
  id: number
  canal?: string | null
  formato?: string | null
  data_inicio?: string | null // ISO
  data_fim?: string | null    // ISO
  quantidade?: number | null
  valor?: number | null
}
type ProdutoOut = {
  id: number
  nome: string
  descricao?: string | null
  total_produto: number
  veiculacoes: VeiculacaoOut[]
}
type PiDetalheOut = {
  id: number
  numero_pi: string
  anunciante?: string | null
  campanha?: string | null
  emissao?: string | null // ISO
  total_pi: number        // soma dos valores das veiculações
  produtos: ProdutoOut[]
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
  return s
}
function formatISO(iso?: string | null) {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch {
    return iso
  }
}
// normaliza "mes_venda" para "YYYY-MM" (aceita "MM/AAAA" ou "YYYY-MM")
function mesToYM(s?: string | null): string {
  if (!s) return ""
  const t = s.trim()
  const m1 = /^(\d{2})\/(\d{4})$/.exec(t) // MM/AAAA
  if (m1) return `${m1[2]}-${m1[1]}`
  const m2 = /^(\d{4})-(\d{2})$/.exec(t) // YYYY-MM
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

export default function PIs() {
  const [lista, setLista] = useState<PIItem[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // filtros
  const [busca, setBusca] = useState("")
  const [tipo, setTipo] = useState<"Todos" | "Matriz" | "Normal" | "CS" | "Abatimento">("Todos")
  const [diretoria, setDiretoria] = useState<string>("Todos")
  const [executivo, setExecutivo] = useState<string>("Todos")
  const [mesVendaFiltro, setMesVendaFiltro] = useState<string>("") // YYYY-MM (input month)
  const [diaVendaDe, setDiaVendaDe] = useState<string>("")         // 1..31
  const [diaVendaAte, setDiaVendaAte] = useState<string>("")       // 1..31

  const [executivos, setExecutivos] = useState<string[]>([...DEFAULT_EXECUTIVOS])

  // detalhe (painel de leitura)
  const [detalhePI, setDetalhePI] = useState<PIItem | null>(null)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [saldoInfo, setSaldoInfo] = useState<{ valor_abatido: number, saldo_restante: number } | null>(null)
  const [filhos, setFilhos] = useState<PIItem[]>([])
  const [detalheProdutos, setDetalheProdutos] = useState<PiDetalheOut | null>(null)
  const [erroDetalheProdutos, setErroDetalheProdutos] = useState<string | null>(null)

  // editor inline (painel de edição)
  const [editOpen, setEditOpen] = useState(false)
  const [editDraft, setEditDraft] = useState<PIItem | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  async function carregar() {
    setLoading(true); setErro(null)
    try {
      const pis = await getJSON<PIItem[]>(`${API}/pis`)
      setLista(Array.isArray(pis) ? pis : [])

      // executivos
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
    const ymFiltro = mesVendaFiltro // YYYY-MM

    // parse bounds (se só um preencher, vira igualdade)
    const deNum = diaVendaDe ? Math.max(1, Math.min(31, parseInt(diaVendaDe, 10))) : null
    const ateNum = diaVendaAte ? Math.max(1, Math.min(31, parseInt(diaVendaAte, 10))) : null
    const haveDiaFiltro = deNum != null || ateNum != null
    const minDia = deNum ?? ateNum ?? null
    const maxDia = ateNum ?? deNum ?? null

    return lista.filter(p => {
      // texto
      const okBusca =
        !q ||
        (p.numero_pi || "").toLowerCase().includes(q) ||
        (p.nome_anunciante || "").toLowerCase().includes(q) ||
        (p.nome_agencia || "").toLowerCase().includes(q) ||
        (p.cnpj_agencia || "").toLowerCase().includes(q)

      // tipo / diretoria / executivo
      const okTipo = (tipo === "Todos") || (p.tipo_pi === tipo)
      const okDir = (diretoria === "Todos") || ((p.diretoria || "") === diretoria)
      const okExec = (executivo === "Todos") || ((p.executivo || "") === executivo)

      // mês/ano da venda
      const okMes = !ymFiltro || (mesToYM(p.mes_venda) === ymFiltro)

      // dia da venda (range inclusivo)
      let okDia = true
      if (haveDiaFiltro) {
        const diaRaw = p.dia_venda
        const dia = Number(String(diaRaw ?? "").trim())
        if (!Number.isFinite(dia)) {
          okDia = false
        } else {
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

  async function abrirDetalhes(pi: PIItem) {
    setDetalhePI(pi)
    setLoadingDetalhe(true)
    setSaldoInfo(null)
    setFilhos([])
    setDetalheProdutos(null)
    setErroDetalheProdutos(null)
    try {
      // ---- Produtos & Veiculações (novo) ----
      getJSON<PiDetalheOut>(`${API}/pis/numero/${encodeURIComponent(pi.numero_pi)}/detalhe`)
        .then((det) => setDetalheProdutos(det))
        .catch((e) => setErroDetalheProdutos(e?.message || "Não foi possível carregar os produtos/veiculações."))

      // ---- Vínculos (sem depender de rotas extras) ----
      if (pi.tipo_pi === "Matriz") {
        // saldo: /pis/{numero_pi}/saldo (conforme seu back)
        const saldoResp = await getJSON<{ numero_pi_matriz: string, saldo_restante: number }>(
          `${API}/pis/${encodeURIComponent(pi.numero_pi)}/saldo`
        ).catch(() => ({ numero_pi_matriz: pi.numero_pi, saldo_restante: 0 }))

        // lista abatimentos a partir de /pis e filtragem local
        const all = await getJSON<PIItem[]>(`${API}/pis`).catch(() => [] as PIItem[])
        const abats = all.filter(x => x.tipo_pi === "Abatimento" && (x.numero_pi_matriz || "") === pi.numero_pi)
        const valor_abatido = abats.reduce((acc, it) => acc + (it.valor_bruto || 0), 0)
        setSaldoInfo({ valor_abatido, saldo_restante: saldoResp.saldo_restante })
        setFilhos(abats)
      } else if (pi.tipo_pi === "Normal") {
        // CS vinculados: filtra localmente
        const all = await getJSON<PIItem[]>(`${API}/pis`).catch(() => [] as PIItem[])
        const cs = all.filter(x => x.tipo_pi === "CS" && (x.numero_pi_normal || "") === pi.numero_pi)
        setFilhos(cs)
      } else {
        setFilhos([])
      }
    } finally {
      setLoadingDetalhe(false)
    }
  }
  function fecharDetalhes() {
    setDetalhePI(null)
    setSaldoInfo(null)
    setFilhos([])
    setDetalheProdutos(null)
    setErroDetalheProdutos(null)
  }

  // ------- Editor inline --------
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

  function validaDraft(d: PIItem): string | null {
    if (!d.numero_pi?.trim()) return "Número do PI é obrigatório."
    const tp = (d.tipo_pi || "").trim()
    if (!tp) return "Tipo do PI é obrigatório."
    if (tp === "CS" && !(d.numero_pi_normal || "").trim()) return "PI Normal é obrigatório para CS."
    if (tp === "Abatimento" && !(d.numero_pi_matriz || "").trim()) return "PI Matriz é obrigatório para Abatimento."
    return null
  }

  async function salvarEditor() {
    if (!editDraft) return
    const msg = validaDraft(editDraft)
    if (msg) { setEditError(msg); return }
    setSavingEdit(true); setEditError(null)
    try {
      const payload: any = {
        numero_pi: editDraft.numero_pi?.trim(),
        tipo_pi: editDraft.tipo_pi,
        numero_pi_matriz: (editDraft.tipo_pi === "Abatimento") ? (editDraft.numero_pi_matriz || null) : null,
        numero_pi_normal: (editDraft.tipo_pi === "CS") ? (editDraft.numero_pi_normal || null) : null,
        nome_anunciante: editDraft.nome_anunciante || null,
        nome_agencia: editDraft.nome_agencia || null,
        data_emissao: (editDraft.data_emissao || "").trim() || null, // dd/mm/aaaa também funciona
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

      const atualizado = await putJSON<PIItem>(`${API}/pis/${editDraft.id}`, payload)

      fecharEditor()
      await carregar()
      if (detalhePI && detalhePI.id === atualizado.id) {
        const ref = (await getJSON<PIItem[]>(`${API}/pis`)).find(p => p.id === atualizado.id)
        if (ref) abrirDetalhes(ref)
      }
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
                  onChange={(e) => setMesVendaFiltro(e.target.value)} // YYYY-MM
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
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-semibold">
                            {pi.uf_cliente || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-800 text-base">{pi.canal || "—"}</td>
                        <td className="px-6 py-4 text-slate-800 text-base">
                          <div className="truncate max-w-[260px]">{pi.nome_campanha || "—"}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-800 text-base">{pi.diretoria || "—"}</td>
                        <td className="px-6 py-4 text-slate-800 text-base">{pi.executivo || "—"}</td>
                        <td className="px-6 py-4 text-slate-800 text-base">{dataVenda || "—"}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => abrirDetalhes(pi)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Ver detalhes e vínculos"
                            >
                              🔎 Detalhes
                            </button>
                            <button
                              onClick={() => abrirEditor(pi)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Editar na mesma página"
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

      {/* Painel de detalhes (leitura) */}
      {detalhePI && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={fecharDetalhes} />
          <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">
                    Detalhe do PI
                  </div>
                  <div className="mt-1 text-3xl font-extrabold text-slate-900">
                    <span className="font-mono">{detalhePI.numero_pi}</span> — {detalhePI.tipo_pi}
                  </div>
                  {detalhePI.tipo_pi === "CS" && detalhePI.numero_pi_normal && (
                    <div className="mt-1 text-slate-600">
                      Vinculado ao PI Normal: <span className="font-mono">{detalhePI.numero_pi_normal}</span>
                    </div>
                  )}
                  {detalhePI.tipo_pi === "Abatimento" && detalhePI.numero_pi_matriz && (
                    <div className="mt-1 text-slate-600">
                      Vinculado à Matriz: <span className="font-mono">{detalhePI.numero_pi_matriz}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { fecharDetalhes(); abrirEditor(detalhePI) }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={fecharDetalhes}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    ✖ Fechar
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Resumo topo */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Cliente</div>
                  <div className="text-lg font-semibold">{detalhePI.nome_anunciante || "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Agência</div>
                  <div className="text-lg font-semibold">{detalhePI.nome_agencia || "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Emissão</div>
                  <div className="text-lg font-semibold">{parseISODateToBR(detalhePI.data_emissao) || "—"}</div>
                </div>
              </section>

              {/* Chips de totais */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-800 px-3 py-1 text-sm font-semibold border border-neutral-200">
                  Bruto: {fmtMoney(detalhePI.valor_bruto)}
                </span>
                <span className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-800 px-3 py-1 text-sm font-semibold border border-neutral-200">
                  Líquido: {fmtMoney(detalhePI.valor_liquido)}
                </span>
                <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-3 py-1 text-sm font-semibold border border-red-200">
                  Total de Veiculações: {detalheProdutos ? fmtMoney(detalheProdutos.total_pi) : (erroDetalheProdutos ? "—" : "Carregando…")}
                </span>
              </div>

              {/* Blocos de vínculos (Matriz / Normal) */}
              {detalhePI.tipo_pi === "Matriz" && (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-3 py-1 text-sm font-semibold">
                      Saldo: {saldoInfo ? fmtMoney(saldoInfo.saldo_restante) : (loadingDetalhe ? "Carregando…" : "—")}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-3 py-1 text-sm font-semibold">
                      Abatido: {saldoInfo ? fmtMoney(saldoInfo.valor_abatido) : (loadingDetalhe ? "Carregando…" : "—")}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200">
                    <div className="px-4 py-3 border-b bg-slate-50 font-semibold">Abatimentos</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-red-600/90 text-white">
                            {["PI", "Valor", "Emissão", "Obs."].map(h => (
                              <th key={h} className="px-4 py-2 text-left text-sm font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {loadingDetalhe ? (
                            <tr><td className="px-4 py-3 text-slate-600" colSpan={4}>Carregando…</td></tr>
                          ) : filhos.length === 0 ? (
                            <tr><td className="px-4 py-3 text-slate-600" colSpan={4}>Nenhum abatimento.</td></tr>
                          ) : filhos.map(f => (
                            <tr key={f.id} className="border-b last:border-none">
                              <td className="px-4 py-2 font-mono">{f.numero_pi}</td>
                              <td className="px-4 py-2">{fmtMoney(f.valor_bruto)}</td>
                              <td className="px-4 py-2 text-sm">{parseISODateToBR(f.data_emissao) || "—"}</td>
                              <td className="px-4 py-2 text-sm">{f.observacoes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {detalhePI.tipo_pi === "Normal" && (
                <section className="space-y-4">
                  <div className="rounded-2xl border border-slate-200">
                    <div className="px-4 py-3 border-b bg-slate-50 font-semibold">CS vinculados</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-red-600/90 text-white">
                            {["PI CS", "Valor", "Emissão", "Obs."].map(h => (
                              <th key={h} className="px-4 py-2 text-left text-sm font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {loadingDetalhe ? (
                            <tr><td className="px-4 py-3 text-slate-600" colSpan={4}>Carregando…</td></tr>
                          ) : filhos.length === 0 ? (
                            <tr><td className="px-4 py-3 text-slate-600" colSpan={4}>Nenhum CS vinculado.</td></tr>
                          ) : filhos.map(cs => (
                            <tr key={cs.id} className="border-b last:border-none">
                              <td className="px-4 py-2 font-mono">{cs.numero_pi}</td>
                              <td className="px-4 py-2">{fmtMoney(cs.valor_bruto)}</td>
                              <td className="px-4 py-2 text-sm">{parseISODateToBR(cs.data_emissao) || "—"}</td>
                              <td className="px-4 py-2 text-sm">{cs.observacoes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {(detalhePI.tipo_pi === "CS" || detalhePI.tipo_pi === "Abatimento") && (
                <section className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Vínculo</div>
                  {detalhePI.tipo_pi === "CS" ? (
                    <div className="mt-1">
                      PI Normal: <span className="font-mono">{detalhePI.numero_pi_normal || "—"}</span>
                    </div>
                  ) : (
                    <div className="mt-1">
                      PI Matriz: <span className="font-mono">{detalhePI.numero_pi_matriz || "—"}</span>
                    </div>
                  )}
                </section>
              )}

              {/* ====== NOVO: Produtos & Veiculações ====== */}
              <section className="space-y-4">
                <h3 className="text-xl font-semibold">Produtos &amp; Veiculações</h3>

                {erroDetalheProdutos && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
                    {erroDetalheProdutos}
                  </div>
                )}

                {!erroDetalheProdutos && !detalheProdutos && (
                  <div className="text-slate-600">Carregando produtos…</div>
                )}

                {detalheProdutos && detalheProdutos.produtos.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 p-6 text-slate-600">
                    Nenhum produto vinculado a este PI.
                  </div>
                )}

                {detalheProdutos && detalheProdutos.produtos.map((produto) => (
                  <article key={produto.id} className="bg-neutral-50 border border-neutral-200 rounded-2xl overflow-hidden">
                    <header className="flex items-center justify-between p-4">
                      <div>
                        <h4 className="text-lg font-bold text-slate-900">{produto.nome}</h4>
                        {produto.descricao && <p className="text-slate-600 text-sm">{produto.descricao}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-slate-500 text-xs uppercase">Total do Produto</div>
                        <div className="text-lg font-bold">{fmtMoney(produto.total_produto)}</div>
                      </div>
                    </header>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-200/60">
                          <tr className="text-left">
                            <th className="px-4 py-3 border-b border-neutral-300">ID</th>
                            <th className="px-4 py-3 border-b border-neutral-300">Canal</th>
                            <th className="px-4 py-3 border-b border-neutral-300">Formato</th>
                            <th className="px-4 py-3 border-b border-neutral-300">Início</th>
                            <th className="px-4 py-3 border-b border-neutral-300">Fim</th>
                            <th className="px-4 py-3 border-b border-neutral-300">Qtd</th>
                            <th className="px-4 py-3 border-b border-neutral-300 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...produto.veiculacoes]
                            .sort((a, b) => {
                              const ai = a.data_inicio ? new Date(a.data_inicio).getTime() : 0
                              const bi = b.data_inicio ? new Date(b.data_inicio).getTime() : 0
                              return ai - bi
                            })
                            .map(v => (
                              <tr key={v.id} className="odd:bg-white even:bg-neutral-100/60">
                                <td className="px-4 py-2">{v.id}</td>
                                <td className="px-4 py-2">{v.canal || "—"}</td>
                                <td className="px-4 py-2">{v.formato || "—"}</td>
                                <td className="px-4 py-2">{formatISO(v.data_inicio)}</td>
                                <td className="px-4 py-2">{formatISO(v.data_fim)}</td>
                                <td className="px-4 py-2">{v.quantidade ?? "—"}</td>
                                <td className="px-4 py-2 text-right font-medium">{fmtMoney(v.valor)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Painel de EDIÇÃO inline */}
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

                {/* Vínculos dinâmicos */}
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Cliente (Anunciante)</label>
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
