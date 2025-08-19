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

type VeicDraft = {
  id?: number
  canal?: string
  formato?: string
  data_inicio?: string | null
  data_fim?: string | null
  quantidade?: number | null
  valor?: number | null
}
type ProdutoDraft = {
  id?: number
  nome: string
  descricao?: string | null
  veiculacoes: VeicDraft[]
}
type PiDetalhe = {
  id: number
  numero_pi: string
  anunciante?: string | null
  campanha?: string | null
  emissao?: string | null
  total_pi: number
  produtos: Array<{
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
    }>
  }>
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
async function postJSON<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
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
  const [mesVendaFiltro, setMesVendaFiltro] = useState<string>("")
  const [diaVendaDe, setDiaVendaDe] = useState<string>("")
  const [diaVendaAte, setDiaVendaAte] = useState<string>("")

  const [executivos, setExecutivos] = useState<string[]>([...DEFAULT_EXECUTIVOS])

  // detalhe
  const [detalhePI, setDetalhePI] = useState<PiDetalhe | null>(null)
  const [detalheLoading, setDetalheLoading] = useState(false)

  // editor PI básico (como já tinha)
  const [editOpen, setEditOpen] = useState(false)
  const [editDraft, setEditDraft] = useState<PIItem | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // editor de Produtos & Veiculações (NOVO)
  const [pvOpen, setPvOpen] = useState(false)
  const [pvPiId, setPvPiId] = useState<number | null>(null)
  const [pvProdutos, setPvProdutos] = useState<ProdutoDraft[]>([])
  const [pvSaving, setPvSaving] = useState(false)
  const [pvError, setPvError] = useState<string | null>(null)
  const [produtoNomes, setProdutoNomes] = useState<string[]>([])

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

  // carregar opções de nomes de produto (autocomplete)
  async function carregarNomesProdutos() {
    try {
      const nomes = await getJSON<string[]>(`${API}/produtos/opcoes-nome`)
      setProdutoNomes(nomes || [])
    } catch {
      setProdutoNomes([])
    }
  }
  useEffect(() => { carregarNomesProdutos() }, [])

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

  // detalhe carregando /pis/{id}/detalhe
  async function abrirDetalhesPorId(pi_id: number) {
    setDetalheLoading(true)
    try {
      const det = await getJSON<PiDetalhe>(`${API}/pis/${pi_id}/detalhe`)
      setDetalhePI(det)
    } catch {
      setDetalhePI(null)
    } finally {
      setDetalheLoading(false)
    }
  }
  function fecharDetalhes() {
    setDetalhePI(null)
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

  // ------- Editor Produtos & Veiculações (NOVO) -------
  async function abrirPv(pi_id: number) {
    setPvError(null)
    setPvPiId(pi_id)
    // carrega do detalhe
    try {
      const det = await getJSON<PiDetalhe>(`${API}/pis/${pi_id}/detalhe`)
      const drafts: ProdutoDraft[] = (det.produtos || []).map(p => ({
        id: p.id,
        nome: p.nome,
        descricao: p.descricao || null,
        veiculacoes: (p.veiculacoes || []).map(v => ({
          id: v.id,
          canal: v.canal || "",
          formato: v.formato || "",
          data_inicio: v.data_inicio ? String(v.data_inicio) : "",
          data_fim: v.data_fim ? String(v.data_fim) : "",
          quantidade: v.quantidade ?? null,
          valor: v.valor ?? null,
        }))
      }))
      setPvProdutos(drafts)
      setPvOpen(true)
    } catch (e: any) {
      setPvError(e?.message || "Falha ao abrir Produtos & Veiculações.")
      setPvProdutos([])
      setPvOpen(true)
    }
  }
  function fecharPv() {
    setPvOpen(false)
    setPvPiId(null)
    setPvProdutos([])
    setPvError(null)
  }
  function addProduto() {
    setPvProdutos(p => [...p, { nome: "", descricao: "", veiculacoes: [] }])
  }
  function rmProduto(idx: number) {
    setPvProdutos(p => p.filter((_, i) => i !== idx))
  }
  function setProduto(idx: number, patch: Partial<ProdutoDraft>) {
    setPvProdutos(p => p.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }
  function addVeic(pIdx: number) {
    setPvProdutos(p => p.map((it, i) => i === pIdx ? {
      ...it,
      veiculacoes: [...it.veiculacoes, { canal: "", formato: "", data_inicio: "", data_fim: "", quantidade: null, valor: null }]
    } : it))
  }
  function rmVeic(pIdx: number, vIdx: number) {
    setPvProdutos(p => p.map((it, i) => i === pIdx ? {
      ...it,
      veiculacoes: it.veiculacoes.filter((_, j) => j !== vIdx)
    } : it))
  }
  function setVeic(pIdx: number, vIdx: number, patch: Partial<VeicDraft>) {
    setPvProdutos(p => p.map((it, i) => i === pIdx ? {
      ...it,
      veiculacoes: it.veiculacoes.map((v, j) => j === vIdx ? { ...v, ...patch } : v)
    } : it))
  }
  function parseMoney(s: string): number | null {
    const t = (s || "").trim()
    if (!t) return null
    const n = Number(t.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  async function salvarPv() {
    if (!pvPiId) return
    // valida simples
    for (const p of pvProdutos) {
      if (!p.nome.trim()) { setPvError("Produto sem nome."); return }
    }
    setPvSaving(true); setPvError(null)
    try {
      const payload = { produtos: pvProdutos }
      const det = await putJSON<PiDetalhe>(`${API}/pis/${pvPiId}/produtos/sync`, payload)
      // atualiza tela
      await carregar()
      if (detalhePI && detalhePI.id === pvPiId) setDetalhePI(det)
      fecharPv()
    } catch (e: any) {
      setPvError(e?.message || "Falha ao salvar Produtos & Veiculações.")
    } finally {
      setPvSaving(false)
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
                              title="Ver detalhes (+ produtos & veiculações)"
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
                              onClick={() => abrirPv(pi.id)}
                              className="px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-700 text-sm hover:bg-emerald-50"
                              title="Produtos & Veiculações (registrar/editar)"
                            >
                              🧩 Produtos & Veiculações
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
                <div className="px-4 py-3 border-b bg-slate-50 font-semibold">Produtos & Veiculações</div>
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
                      ) : detalhePI.produtos.length === 0 ? (
                        <tr><td className="px-4 py-3 text-slate-600" colSpan={5}>Sem produtos.</td></tr>
                      ) : detalhePI.produtos.flatMap((p) => {
                        if (p.veiculacoes.length === 0) {
                          return (
                            <tr key={`p-${p.id}`} className="border-b">
                              <td className="px-4 py-2 font-semibold">{p.nome}</td>
                              <td className="px-4 py-2 text-slate-600">—</td>
                              <td className="px-4 py-2 text-sm text-slate-600">—</td>
                              <td className="px-4 py-2">—</td>
                              <td className="px-4 py-2">—</td>
                            </tr>
                          )
                        }
                        return p.veiculacoes.map((v, idx) => (
                          <tr key={`p-${p.id}-v-${v.id}`} className="border-b last:border-none">
                            {idx === 0 && (
                              <td className="px-4 py-2 font-semibold" rowSpan={p.veiculacoes.length}>{p.nome}</td>
                            )}
                            <td className="px-4 py-2">{[v.canal, v.formato].filter(Boolean).join(" • ") || "—"}</td>
                            <td className="px-4 py-2 text-sm">
                              {parseISODateToBR(v.data_inicio)} — {parseISODateToBR(v.data_fim)}
                            </td>
                            <td className="px-4 py-2">{v.quantidade ?? "—"}</td>
                            <td className="px-4 py-2">{fmtMoney(v.valor ?? 0)}</td>
                          </tr>
                        ))
                      })}
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

      {/* Painel Produtos & Veiculações (editor principal do novo fluxo) */}
      {pvOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharPv} />
          <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-emerald-700 font-semibold">Produtos & Veiculações</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-900">
                  {pvPiId ? <>PI <span className="font-mono">#{pvPiId}</span></> : "PI"}
                </div>
              </div>
              <button
                onClick={fecharPv}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                ✖ Fechar
              </button>
            </div>

            <div className="p-6 space-y-6">
              {pvError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
                  {pvError}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Produtos deste PI</div>
                <button
                  onClick={addProduto}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  ➕ Adicionar produto
                </button>
              </div>

              {/* lista de produtos */}
              <div className="space-y-6">
                {pvProdutos.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-slate-600">
                    Nenhum produto. Clique em <b>Adicionar produto</b>.
                  </div>
                )}

                {pvProdutos.map((p, pIdx) => (
                  <div key={pIdx} className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                      <div className="font-semibold">
                        Produto #{pIdx + 1} {p.id ? <span className="text-slate-500">• ID {p.id}</span> : null}
                      </div>
                      <button
                        onClick={() => rmProduto(pIdx)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        Remover
                      </button>
                    </div>

                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Nome do produto
                          </label>
                          <input
                            list="produto-nomes"
                            value={p.nome}
                            onChange={(e) => setProduto(pIdx, { nome: e.target.value })}
                            placeholder="Digite ou escolha um produto existente"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2"
                          />
                          <datalist id="produto-nomes">
                            {produtoNomes.map((n) => <option key={n} value={n} />)}
                          </datalist>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Descrição (opcional)
                          </label>
                          <input
                            value={p.descricao || ""}
                            onChange={(e) => setProduto(pIdx, { descricao: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2"
                          />
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">Veiculações</div>
                          <button
                            onClick={() => addVeic(pIdx)}
                            className="px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          >
                            ➕ Adicionar veiculação
                          </button>
                        </div>

                        {p.veiculacoes.length === 0 ? (
                          <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-slate-600">
                            Nenhuma veiculação.
                          </div>
                        ) : (
                          <div className="mt-2 overflow-x-auto">
                            <table className="min-w-full">
                              <thead>
                                <tr className="bg-emerald-600/90 text-white">
                                  {["Canal", "Formato", "Início", "Fim", "Qtd", "Valor", ""].map(h => (
                                    <th key={h} className="px-3 py-2 text-left text-sm font-semibold">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {p.veiculacoes.map((v, vIdx) => (
                                  <tr key={vIdx} className="border-b last:border-none">
                                    <td className="px-3 py-2">
                                      <input
                                        value={v.canal || ""}
                                        onChange={(e) => setVeic(pIdx, vIdx, { canal: e.target.value })}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        value={v.formato || ""}
                                        onChange={(e) => setVeic(pIdx, vIdx, { formato: e.target.value })}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        value={v.data_inicio || ""}
                                        onChange={(e) => setVeic(pIdx, vIdx, { data_inicio: e.target.value })}
                                        placeholder="dd/mm/aaaa ou yyyy-mm-dd"
                                        className="w-full rounded-md border border-slate-300 px-2 py-1"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        value={v.data_fim || ""}
                                        onChange={(e) => setVeic(pIdx, vIdx, { data_fim: e.target.value })}
                                        placeholder="dd/mm/aaaa ou yyyy-mm-dd"
                                        className="w-full rounded-md border border-slate-300 px-2 py-1"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="number"
                                        value={String(v.quantidade ?? "")}
                                        onChange={(e) => setVeic(pIdx, vIdx, { quantidade: Number(e.target.value || "0") || null })}
                                        className="w-24 rounded-md border border-slate-300 px-2 py-1"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        value={String(v.valor ?? "")}
                                        onChange={(e) => setVeic(pIdx, vIdx, { valor: parseMoney(e.target.value) })}
                                        placeholder="1000,00"
                                        className="w-40 rounded-md border border-slate-300 px-2 py-1"
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <button
                                        onClick={() => rmVeic(pIdx, vIdx)}
                                        className="px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                                      >
                                        Remover
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  onClick={salvarPv}
                  disabled={pvSaving}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 text-white text-lg font-semibold hover:bg-emerald-700 disabled:opacity-60"
                >
                  {pvSaving ? "Salvando..." : "Salvar Produtos & Veiculações"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
