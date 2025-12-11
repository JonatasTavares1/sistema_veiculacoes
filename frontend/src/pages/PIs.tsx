// src/pages/PIs.tsx
import { useEffect, useMemo, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

type PIItem = {
  id: number
  numero_pi: string
  tipo_pi: "Matriz" | "Normal" | "CS" | "Abatimento" | "Veiculação" | string
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
  _statusEntregaAgg?: "Pendente" | "Parcial" | "Entregue"
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
      entregue?: boolean | string | number | null
      status_entrega?: string | null
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
  entregue?: boolean | string | number | null
  status_entrega?: string | null
}

type EntregaAPI = {
  id?: number
  pi_id?: number
  veiculacao_id?: number | string | null
  status?: string | null // "Entregue", "Pendente", etc.
  entregue?: boolean | number | string | null // 1/0, true/false, "1"/"0"
}

type AnexoMap = Record<number, { pi: boolean; proposta: boolean }>

const DEFAULT_EXECUTIVOS = [
  "Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio",
  "Flavio de Paula", "Lorena Fernandes", "Henri Marques", "Caio Bruno",
  "Flavia Cabral", "Paula Caroline", "Leila Santos", "Jessica Ribeiro",
  "Paula Campos",
]
const DIRETORIAS = ["Governo Federal", "Governo Estadual", "Rafael Augusto"]

// ===== helpers =====
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
function BRtoISODate(s?: string | null) {
  if (!s) return ""
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim())
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return s.trim()
  return ""
}
function ISOtoBRDate(s?: string | null) {
  if (!s) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return s || ""
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
function YMtoBRMonth(s?: string | null) {
  if (!s) return ""
  const m = /^(\d{4})-(\d{2})$/.exec(s.trim())
  if (m) return `${m[2]}/${m[1]}`
  const m2 = /^(\d{2})\/(\d{4})$/.exec(s.trim())
  if (m2) return s.trim()
  return ""
}

async function getJSON<T>(url: string): Promise<T> {
  const sep = url.includes("?") ? "&" : "?"
  const r = await fetch(`${url}${sep}_ts=${Date.now()}`, { cache: "no-store" })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}
async function putJSON<T>(url: string, body: any): Promise<T> {
  const sep = url.includes("?") ? "&" : "?"
  const r = await fetch(`${url}${sep}_ts=${Date.now()}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
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
  const sep = url.includes("?") ? "&" : "?"
  const r = await fetch(`${url}${sep}_ts=${Date.now()}`, { method: "DELETE", cache: "no-store" })
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

function coalesceValor(v?: { valor?: number|null; valor_liquido?: number|null; valor_bruto?: number|null }) {
  if (!v) return null
  return v.valor_liquido ?? v.valor ?? v.valor_bruto ?? null
}

// >>>>>>> FIX PRINCIPAL: helpers tolerantes
const normalize = (s?: any) => String(s ?? "").trim().toLowerCase()

function truthy(val: any): boolean {
  const t = normalize(val)
  return (
    val === true ||
    val === 1 ||
    t === "1" ||
    t === "true" ||
    t === "y" || t === "yes" ||
    t === "sim" || t === "s" ||
    t === "ok" ||
    t === "feito" || t === "feita" ||
    t === "done" ||
    t === "finalizado" || t === "finalizada" ||
    t === "concluido" || t === "concluído" ||
    t === "concluida" || t === "concluída"
  )
}

function statusEntregue(status?: string | null): boolean {
  const t = normalize(status)
  return (
    t === "entregue" ||
    t === "entregado" ||
    t === "concluido" || t === "concluído" ||
    t === "concluida" || t === "concluída" ||
    t === "finalizado" || t === "finalizada" ||
    t === "realizado" || t === "realizada" ||
    t === "comprovado" || t === "comprovada" ||
    t === "ok"
  )
}

function isDelivered(v: { entregue?: any; status_entrega?: any } | null | undefined) {
  if (!v) return false
  return truthy(v.entregue) || statusEntregue(v.status_entrega)
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
        entregue: (v as any)?.entregue ?? null,
        status_entrega: (v as any)?.status_entrega ?? null,
      })
    }
  }
  return out
}

function normalizeTipo(tipo: string) {
  return (tipo || "").toLowerCase()
}
function mostraPIMatriz(tipo: string) {
  const t = normalizeTipo(tipo)
  return t === "cs" || t === "abatimento" || t === "veiculação" || t === "veiculacao"
}

function buildArquivoUrl(pi: PIItem, qual: "pi" | "proposta") {
  return `${API}/pis/${pi.id}/arquivo?tipo=${qual}&modo=download`
}

export default function PIs() {
  const [lista, setLista] = useState<PIItem[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [anexos, setAnexos] = useState<AnexoMap>({})

  // filtros
  const [busca, setBusca] = useState("")
  const [tipo, setTipo] = useState<"Todos" | "Matriz" | "Normal" | "CS" | "Abatimento" | "Veiculação">("Todos")
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
  const [selectedPiMeta, setSelectedPiMeta] = useState<PIItem | null>(null)
  const [statusEntregaAgg, setStatusEntregaAgg] = useState<"Pendente" | "Parcial" | "Entregue">("Pendente")

  // editor
  const [editOpen, setEditOpen] = useState(false)
  const [editDraft, setEditDraft] = useState<PIItem | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set())
  const [view, setView] = useState<"table" | "cards">("table")

  async function carregar() {
    setLoading(true); setErro(null)
    try {
      const pis = await getJSON<PIItem[]>(`${API}/pis`)
      const arr = Array.isArray(pis) ? pis : []
      setLista(arr)

      // executivos
      const exsFromApi = await getJSON<string[]>(`${API}/executivos`).catch(() => [])
      const exsFromData = Array.from(new Set(arr.map(p => (p.executivo || "").trim()).filter(Boolean)))
      const merged = Array.from(new Set([...(Array.isArray(exsFromApi) ? exsFromApi : []), ...DEFAULT_EXECUTIVOS, ...exsFromData]))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
      setExecutivos(merged)

      // anexos por PI
      const map: AnexoMap = {}
      await Promise.all(
        arr.map(async (p) => {
          try {
            const lista = await getJSON<Array<{ tipo: string }>>(`${API}/pis/${p.id}/arquivos`)
            const tipos = new Set((lista || []).map(a => (a.tipo || "").toLowerCase()))
            map[p.id] = { pi: tipos.has("pi_pdf"), proposta: tipos.has("proposta_pdf") }
          } catch {
            map[p.id] = { pi: false, proposta: false }
          }
        })
      )
      setAnexos(map)
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

      const okTipo =
        tipo === "Todos" ||
        p.tipo_pi === tipo ||
        (tipo === "Veiculação" && normalizeTipo(p.tipo_pi) === "veiculação") ||
        (tipo === "Veiculação" && normalizeTipo(p.tipo_pi) === "veiculacao")

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
      "PI Matriz": (mostraPIMatriz(pi.tipo_pi)) ? (pi.numero_pi_matriz || "") : "",
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
    const ws = xlsx.utils.json_to_sheet(rows, { header: Object.keys(rows[0] || {}) })
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

  // >>>>>> busca entregas
  async function carregarEntregasPorPI(pi_id: number): Promise<EntregaAPI[]> {
    try {
      const e1 = await getJSON<EntregaAPI[]>(`${API}/pis/${pi_id}/entregas`)
      if (Array.isArray(e1)) return e1
    } catch (_) {}
    try {
      const e2 = await getJSON<EntregaAPI[]>(`${API}/entregas?pi_id=${encodeURIComponent(String(pi_id))}`)
      if (Array.isArray(e2)) return e2
    } catch (_) {}
    return []
  }

  // >>>>>> merge com fallback por PI
  function mesclarEntregas(veicsIn: VeiculacaoRow[], entregas: EntregaAPI[]) {
    if (!entregas?.length) return { rows: veicsIn, piLevelDelivered: false }

    const deliveredById = new Set<number>()
    let piLevelDelivered = false

    for (const e of entregas) {
      const isOk = truthy(e?.entregue) || statusEntregue(e?.status || undefined)
      if (!isOk) continue

      const raw = (e as any)?.veiculacao_id
      if (raw === null || raw === undefined || raw === "" || Number.isNaN(Number(raw))) {
        // entrega marcada no nível do PI
        piLevelDelivered = true
      } else {
        const idNum = Number(raw)
        if (Number.isFinite(idNum)) deliveredById.add(idNum)
      }
    }

    let rows = veicsIn.map(v =>
      deliveredById.has(Number(v.id))
        ? { ...v, entregue: true, status_entrega: "Entregue" }
        : v
    )

    if (piLevelDelivered) {
      rows = rows.map(v => ({ ...v, entregue: true, status_entrega: "Entregue" }))
    }

    return { rows, piLevelDelivered }
  }

  async function abrirDetalhesPorId(pi_id: number) {
    setDetalheLoading(true)
    setVeics([])
    setVeicsError(null)
    setSelectedPiMeta(lista.find(p => p.id === pi_id) || null)
    setStatusEntregaAgg("Pendente")

    try {
      const det = await getJSON<PiDetalhe>(`${API}/pis/${pi_id}/detalhe`)
      setDetalhePI(det)

      const viaEndpoints = await carregarVeiculacoesPorPI(pi_id, det?.numero_pi)
      const viaDetalhe = flattenVeicsFromDetalhe(det)
      let rows = (viaEndpoints.length ? viaEndpoints : viaDetalhe)

      // merge de entregas (quando existir)
      const entregas = await carregarEntregasPorPI(pi_id).catch(() => [])
      if (entregas.length) {
        const merged = mesclarEntregas(rows, entregas)
        rows = merged.rows

        // Se veio entrega em nível de PI, o agregado já é Entregue
        if (merged.piLevelDelivered) {
          setVeics(rows)
          setStatusEntregaAgg("Entregue")
          setSelectedPiMeta(prev => prev ? { ...prev, _statusEntregaAgg: "Entregue" } : prev)
          setDetalheLoading(false)
          return
        }
      }

      setVeics(rows)
      if (rows.length === 0) setVeicsError(null)

      // agregado padrão (ou reavaliado se houve entregas por item)
      const allDelivered = rows.length > 0 && rows.every(r => isDelivered(r))
      const anyDelivered = rows.some(r => isDelivered(r))
      const agg: "Pendente" | "Parcial" | "Entregue" =
        allDelivered ? "Entregue" : (anyDelivered ? "Parcial" : "Pendente")
      setStatusEntregaAgg(agg)
      setSelectedPiMeta(prev => prev ? { ...prev, _statusEntregaAgg: agg } : prev)
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
    setStatusEntregaAgg("Pendente")
  }

  // editor
  function abrirEditor(pi: PIItem) {
    setEditError(null)
    setEditDraft({
      ...pi,
      data_emissao: parseISODateToBR(pi.data_emissao),
      mes_venda: YMtoBRMonth(pi.mes_venda || "") || pi.mes_venda || "",
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
  function normalizaDataEmissaoParaAPI(s?: string | null) {
    if (!s) return null
    const t = s.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return ISOtoBRDate(t)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return t
    return t
  }
  function normalizaMesVendaParaAPI(s?: string | null) {
    if (!s) return null
    const t = s.trim()
    if (/^\d{4}-\d{2}$/.test(t)) return YMtoBRMonth(t)
    if (/^\d{2}\/\d{4}$/.test(t)) return t
    return t
  }
  async function salvarEditor() {
    if (!editDraft) return
    setSavingEdit(true); setEditError(null)
    try {
      const payload: any = {
        numero_pi: editDraft.numero_pi?.trim(),
        tipo_pi: editDraft.tipo_pi,
        numero_pi_matriz: (mostraPIMatriz(editDraft.tipo_pi)) ? (editDraft.numero_pi_matriz || null) : null,
        numero_pi_normal: (normalizeTipo(editDraft.tipo_pi) === "cs") ? (editDraft.numero_pi_normal || null) : null,
        nome_anunciante: editDraft.nome_anunciante || null,
        nome_agencia: editDraft.nome_agencia || null,
        cnpj_agencia: editDraft.cnpj_agencia || null,
        data_emissao: normalizaDataEmissaoParaAPI(editDraft.data_emissao),
        valor_bruto: trataNumero(String(editDraft.valor_bruto ?? "")),
        valor_liquido: trataNumero(String(editDraft.valor_liquido ?? "")),
        uf_cliente: editDraft.uf_cliente || null,
        canal: editDraft.canal || null,
        nome_campanha: editDraft.nome_campanha || null,
        diretoria: editDraft.diretoria || null,
        executivo: editDraft.executivo || null,
        dia_venda: (editDraft.dia_venda ?? "") as any || null,
        mes_venda: normalizaMesVendaParaAPI(editDraft.mes_venda),
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">PIs Cadastrados</h1>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button
            onClick={() => setView(v => v === "table" ? "cards" : "table")}
            className="px-4 md:px-5 py-2.5 md:py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-base md:text-lg hover:bg-slate-50"
            title="Alternar visualização"
          >
            {view === "table" ? "🗂️ Ver como Cards" : "📋 Ver como Tabela"}
          </button>
          <button
            onClick={exportarXLSX}
            className="px-4 md:px-5 py-2.5 md:py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-base md:text-lg hover:bg-slate-50"
            title="Exportar para Excel"
          >
            📤 Exportar XLSX
          </button>
          <button
            onClick={carregar}
            className="px-4 md:px-5 py-2.5 md:py-3 rounded-2xl bg-red-600 text-white text-base md:text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 md:gap-4">
          <div className="xl:col-span-2">
            <label className="block text-base md:text-xl font-semibold text-slate-800 mb-2">Buscar</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="PI, cliente, agência ou CNPJ"
              className="w-full rounded-xl border border-slate-300 px-3 md:px-4 py-2.5 md:py-3 text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-base md:text-xl font-semibold text-slate-800 mb-2">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
              className="w-full rounded-xl border border-slate-300 px-3 md:px-4 py-2.5 md:py-3 text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              {["Todos", "Matriz", "Normal", "CS", "Abatimento", "Veiculação"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-base md:text-xl font-semibold text-slate-800 mb-2">Diretoria</label>
            <select
              value={diretoria}
              onChange={(e) => setDiretoria(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 md:px-4 py-2.5 md:py-3 text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option>Todos</option>
              {DIRETORIAS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-base md:text-xl font-semibold text-slate-800 mb-2">Executivo</label>
            <select
              value={executivo}
              onChange={(e) => setExecutivo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 md:px-4 py-2.5 md:py-3 text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option>Todos</option>
              {executivos.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>

          <div className="xl:col-span-2">
            <label className="block text-base md:text-xl font-semibold text-slate-800 mb-2">Venda</label>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              <div>
                <div className="text-xs md:text-sm text-slate-600 mb-1">Mês</div>
                <input
                  type="month"
                  value={mesVendaFiltro}
                  onChange={(e) => setMesVendaFiltro(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-2.5 md:px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                />
              </div>
              <div>
                <div className="text-xs md:text-sm text-slate-600 mb-1">Dia — De</div>
                <input
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={diaVendaDe}
                  onChange={(e) => setDiaVendaDe(e.target.value)}
                  placeholder="1"
                  className="w-full rounded-xl border border-slate-300 px-2.5 md:px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                />
              </div>
              <div>
                <div className="text-xs md:text-sm text-slate-600 mb-1">Dia — Até</div>
                <input
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={diaVendaAte}
                  onChange={(e) => setDiaVendaAte(e.target.value)}
                  placeholder="31"
                  className="w-full rounded-xl border border-slate-300 px-2.5 md:px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
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
        ) : view === "table" ? (
          <div className="overflow-hidden rounded-2xl border border-red-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-white border-b border-red-100">
              <div className="text-slate-700">{filtrada.length} registro(s)</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-red-200">
                <thead className="bg-gradient-to-r from-red-700 to-red-600 text-white sticky top-0">
                  <tr>
                    {[
                      "ID","PI","Tipo de PI","PI Matriz","Cliente","Agência","Data de Emissão",
                      "Valor Total","Valor Líquido","Praça","Meio","Campanha",
                      "Diretoria","Executivo","Data da Venda","Arquivos","Ações"
                    ].map(h => (
                      <th key={h} className="px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {filtrada.map((pi, idx) => {
                    const dataVenda = (pi.dia_venda && pi.mes_venda) ? `${pi.dia_venda}/${pi.mes_venda}` : ""
                    const piMatriz = (mostraPIMatriz(pi.tipo_pi)) ? (pi.numero_pi_matriz || "") : ""
                    //const excluindo = deletingIds.has(pi.id)
                    const urlPI = buildArquivoUrl(pi, "pi")
                    const urlProp = buildArquivoUrl(pi, "proposta")
                    const temPi = anexos[pi.id]?.pi ?? false
                    const temProp = anexos[pi.id]?.proposta ?? false
                    return (
                      <tr
                        key={pi.id}
                        className={["transition", idx % 2 === 0 ? "bg-white" : "bg-red-50/40", "hover:bg-red-50"].join(" ")}
                      >
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-900 text-sm md:text-base font-medium">{pi.id}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-900 text-sm md:text-base font-medium">
                          <span className="font-mono">{pi.numero_pi}</span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">{pi.tipo_pi}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base"><span className="font-mono">{piMatriz}</span></td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">
                          <div className="truncate max-w-[220px]">{pi.nome_anunciante || "—"}</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">
                          <div className="truncate max-w-[220px]">{pi.nome_agencia || "—"}</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-700 text-xs md:text-sm">
                          {parseISODateToBR(pi.data_emissao) || "—"}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-900 text-sm md:text-base font-semibold">{fmtMoney(pi.valor_bruto)}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-900 text-sm md:text-base font-semibold">{fmtMoney(pi.valor_liquido)}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2.5 md:px-3 py-1 text-[10px] md:text-xs font-semibold">
                            {pi.uf_cliente || "—"}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">{pi.canal || "—"}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base"><div className="truncate max-w-[260px]">{pi.nome_campanha || "—"}</div></td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">{pi.diretoria || "—"}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">{pi.executivo || "—"}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">{dataVenda || "—"}</td>

                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={temPi ? urlPI : undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`px-3 py-1.5 rounded-xl border text-sm ${
                                temPi
                                  ? "border-slate-300 text-slate-700 hover:bg-slate-50"
                                  : "border-slate-200 text-slate-400 cursor-not-allowed pointer-events-none"
                              }`}
                              title={temPi ? "Baixar PI (PDF)" : "Sem PI anexado"}
                            >
                              📄 PI
                            </a>
                            <a
                              href={temProp ? urlProp : undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`px-3 py-1.5 rounded-xl border text-sm ${
                                temProp
                                  ? "border-slate-300 text-slate-700 hover:bg-slate-50"
                                  : "border-slate-200 text-slate-400 cursor-not-allowed pointer-events-none"
                              }`}
                              title={temProp ? "Baixar Proposta (PDF)" : "Sem Proposta anexada"}
                            >
                              📎 Proposta
                            </a>
                          </div>
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4">
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
                              disabled={deletingIds.has(pi.id)}
                              className="px-3 py-1.5 rounded-xl border border-red-300 text-red-700 text-sm hover:bg-red-50 disabled:opacity-60"
                              title="Excluir PI"
                            >
                              {deletingIds.has(pi.id) ? "⏳ Excluindo…" : "🗑️ Excluir"}
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
          // GRID DE CARDS
          <div className="space-y-3">
            <div className="text-slate-700">{filtrada.length} registro(s)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-5">
              {filtrada.map((pi) => {
                const piMatriz = (mostraPIMatriz(pi.tipo_pi)) ? (pi.numero_pi_matriz || "") : ""
                const dataVenda = (pi.dia_venda && pi.mes_venda) ? `${pi.dia_venda}/${pi.mes_venda}` : ""
                const excluindo = deletingIds.has(pi.id)
                const urlPI = buildArquivoUrl(pi, "pi")
                const urlProp = buildArquivoUrl(pi, "proposta")
                const temPi = anexos[pi.id]?.pi ?? false
                const temProp = anexos[pi.id]?.proposta ?? false
                return (
                  <div key={pi.id} className="rounded-2xl border border-red-200 bg-white shadow-sm hover:shadow-md transition overflow-hidden">
                    <div className="px-5 py-4 border-b border-red-100 bg-gradient-to-r from-white to-red-50/30">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] md:text-xs uppercase tracking-wide text-red-700 font-semibold">PI</div>
                          <div className="font-mono text-lg md:text-xl font-extrabold text-slate-900 truncate">{pi.numero_pi}</div>
                          {piMatriz && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              Matriz: <span className="font-mono">{piMatriz}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] md:text-xs text-slate-500">Valor Líquido</div>
                          <div className="text-base md:text-lg font-bold text-slate-900">{fmtMoney(pi.valor_liquido)}</div>
                          <div className="text-[10px] md:text-xs text-slate-500 mt-1">Valor Total</div>
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
                        {dataVenda && <> | Venda: <span className="font-medium text-slate-800">{dataVenda}</span></>}
                      </div>

                      <div className="pt-2 flex flex-wrap gap-2">
                        <a
                          href={temPi ? urlPI : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`px-3 py-1.5 rounded-xl border text-sm ${
                            temPi ? "border-slate-300 text-slate-700 hover:bg-white" : "border-slate-200 text-slate-400 cursor-not-allowed pointer-events-none"
                          }`}
                          title={temPi ? "Baixar PI (PDF)" : "Sem PI anexado"}
                        >
                          📄 PI
                        </a>
                        <a
                          href={temProp ? urlProp : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`px-3 py-1.5 rounded-xl border text-sm ${
                            temProp ? "border-slate-300 text-slate-700 hover:bg-white" : "border-slate-200 text-slate-400 cursor-not-allowed pointer-events-none"
                          }`}
                          title={temProp ? "Baixar Proposta (PDF)" : "Sem Proposta anexada"}
                        >
                          📎 Proposta
                        </a>
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

      {/* Detalhe */}
      {detalhePI && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={fecharDetalhes} />
          <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-4 md:p-6 border-b flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs md:text-sm uppercase tracking-wide text-red-700 font-semibold">Detalhe do PI</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono truncate text-2xl md:text-3xl font-extrabold text-slate-900">{detalhePI.numero_pi}</span>
                  {statusEntregaAgg === "Entregue" && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-semibold">
                      ✓ Entregue
                    </span>
                  )}
                  {statusEntregaAgg === "Parcial" && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-xs font-semibold">
                      • Parcial
                    </span>
                  )}
                  {statusEntregaAgg === "Pendente" && (
                    <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2.5 py-1 text-xs font-semibold">
                      • Pendente
                    </span>
                  )}
                </div>
                <div className="text-slate-600 mt-1 truncate">
                  {detalhePI.anunciante || "—"} • {detalhePI.campanha || "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => abrirDetalhesPorId(detalhePI.id)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  title="Recarregar detalhe"
                >
                  ↻ Atualizar
                </button>
                <button
                  onClick={fecharDetalhes}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  ✖ Fechar
                </button>
              </div>
            </div>

            <div className="p-4 md:p-6 space-y-6">
              {selectedPiMeta && (
                <div className="rounded-2xl border border-slate-200">
                  <div className="px-4 py-3 border-b bg-slate-50 font-semibold">Informações do PI</div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <InfoRow label="Tipo" value={selectedPiMeta.tipo_pi} />
                    <InfoRow label="PI Matriz" value={mostraPIMatriz(selectedPiMeta.tipo_pi) ? (selectedPiMeta.numero_pi_matriz || "—") : "—"} mono />
                    <InfoRow label="PI Normal (CS)" value={normalizeTipo(selectedPiMeta.tipo_pi) === "cs" ? (selectedPiMeta.numero_pi_normal || "—") : "—"} mono />
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

                  <div className="px-4 pb-4">
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={anexos[selectedPiMeta.id]?.pi ? buildArquivoUrl(selectedPiMeta, "pi") : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3 py-1.5 rounded-xl border text-sm ${
                          anexos[selectedPiMeta.id]?.pi
                            ? "border-slate-300 text-slate-700 hover:bg-slate-50"
                            : "border-slate-200 text-slate-400 cursor-not-allowed pointer-events-none"
                        }`}
                      >
                        📄 Baixar PI (PDF)
                      </a>
                      <a
                        href={anexos[selectedPiMeta.id]?.proposta ? buildArquivoUrl(selectedPiMeta, "proposta") : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3 py-1.5 rounded-xl border text-sm ${
                          anexos[selectedPiMeta.id]?.proposta
                            ? "border-slate-300 text-slate-700 hover:bg-slate-50"
                            : "border-slate-200 text-slate-400 cursor-not-allowed pointer-events-none"
                        }`}
                      >
                        📎 Baixar Proposta (PDF)
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-4">
                <div>
                  <div className="text-sm text-slate-500">Total do PI</div>
                  <div className="text-2xl font-bold">{fmtMoney(detalhePI.total_pi)}</div>
                </div>
                <div className="ml-auto">
                  {statusEntregaAgg === "Entregue" && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-sm font-semibold">
                      ✓ Todas veiculações entregues
                    </span>
                  )}
                  {statusEntregaAgg === "Parcial" && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-sm font-semibold">
                      • Entrega parcial
                    </span>
                  )}
                  {statusEntregaAgg === "Pendente" && (
                    <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 border border-red-200 px-3 py-1 text-sm font-semibold">
                      • Entregas pendentes
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b bg-slate-50 font-semibold">Veiculações cadastradas</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-red-600/90 text-white">
                        {["Produto", "Veiculação", "Janela", "Qtde", "Valor", "Entrega"].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-sm font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detalheLoading ? (
                        <tr><td className="px-4 py-3 text-slate-600" colSpan={6}>Carregando…</td></tr>
                      ) : veicsError ? (
                        <tr><td className="px-4 py-3 text-red-700" colSpan={6}>{veicsError}</td></tr>
                      ) : veics.length === 0 ? (
                        <tr><td className="px-4 py-3 text-slate-600" colSpan={6}>Sem veiculações.</td></tr>
                      ) : veics.map((v) => {
                          const ok = isDelivered(v)
                          return (
                            <tr key={v.id} className="border-b last:border-none">
                              <td className="px-4 py-2 font-semibold">{v.produto_nome || "—"}</td>
                              <td className="px-4 py-2">{[v.canal, v.formato].filter(Boolean).join(" • ") || "—"}</td>
                              <td className="px-4 py-2 text-sm">
                                {parseISODateToBR(v.data_inicio)} — {parseISODateToBR(v.data_fim)}
                              </td>
                              <td className="px-4 py-2">{v.quantidade ?? "—"}</td>
                              <td className="px-4 py-2">{fmtMoney(v.valor ?? 0)}</td>
                              <td className="px-4 py-2">
                                {ok ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-semibold">
                                    ✓ Entregue
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-xs font-semibold">
                                    Pendente
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor */}
      {editOpen && editDraft && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharEditor} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-4 md:p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-xs md:text-sm uppercase tracking-wide text-red-700 font-semibold">Editar PI</div>
                <div className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900">
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

            <div className="p-4 md:p-6 space-y-6">
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
                    value={editDraft.tipo_pi as any}
                    onChange={(e) => campo("tipo_pi", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {["Matriz", "Normal", "CS", "Abatimento", "Veiculação"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {mostraPIMatriz(editDraft.tipo_pi) && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">PI Matriz</label>
                    <input
                      value={editDraft.numero_pi_matriz || ""}
                      onChange={(e) => campo("numero_pi_matriz", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                      placeholder="Ex: 12345"
                    />
                  </div>
                )}

                {normalizeTipo(editDraft.tipo_pi) === "cs" && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">PI Normal (CS)</label>
                    <input
                      value={editDraft.numero_pi_normal || ""}
                      onChange={(e) => campo("numero_pi_normal", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                      placeholder="Ex: 67890"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Agência</label>
                  <input
                    value={editDraft.nome_agencia || ""}
                    onChange={(e) => campo("nome_agencia", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">CNPJ da Agência</label>
                  <input
                    value={editDraft.cnpj_agencia || ""}
                    onChange={(e) => campo("cnpj_agencia", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Anunciante</label>
                  <input
                    value={editDraft.nome_anunciante || ""}
                    onChange={(e) => campo("nome_anunciante", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Campanha</label>
                  <input
                    value={editDraft.nome_campanha || ""}
                    onChange={(e) => campo("nome_campanha", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Data de Emissão</label>
                  <input
                    type="date"
                    value={BRtoISODate(editDraft.data_emissao) || ""}
                    onChange={(e) => campo("data_emissao", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    Salva como <code>dd/MM/yyyy</code>.
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Valor Total (R$)</label>
                  <input
                    inputMode="decimal"
                    value={editDraft.valor_bruto ?? ""}
                    onChange={(e) => campo("valor_bruto", e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Valor Líquido (R$)</label>
                  <input
                    inputMode="decimal"
                    value={editDraft.valor_liquido ?? ""}
                    onChange={(e) => campo("valor_liquido", e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Praça (UF)</label>
                  <input
                    value={editDraft.uf_cliente || ""}
                    onChange={(e) => campo("uf_cliente", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    placeholder="Ex: SP"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Meio</label>
                  <input
                    value={editDraft.canal || ""}
                    onChange={(e) => campo("canal", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Diretoria</label>
                  <select
                    value={editDraft.diretoria || ""}
                    onChange={(e) => campo("diretoria", e.target.value || null)}
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
                    onChange={(e) => campo("executivo", e.target.value || null)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">—</option>
                    {executivos.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Dia da Venda</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={
                      editDraft.dia_venda === null || editDraft.dia_venda === undefined || editDraft.dia_venda === ""
                        ? ""
                        : Number(editDraft.dia_venda)
                    }
                    onChange={(e) => campo("dia_venda", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Mês da Venda</label>
                  <input
                    type="month"
                    value={mesToYM(editDraft.mes_venda || "") || ""}
                    onChange={(e) => campo("mes_venda", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                  <div className="text-xs text-slate-500 mt-1">Salva como <code>MM/YYYY</code>.</div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Observações</label>
                  <textarea
                    value={editDraft.observacoes || ""}
                    onChange={(e) => campo("observacoes", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 min-h-[100px]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={salvarEditor}
                  disabled={savingEdit}
                  className="px-5 md:px-6 py-2.5 md:py-3 rounded-2xl bg-red-600 text-white text-base md:text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {savingEdit ? "Salvando..." : "Salvar alterações"}
                </button>
                <button
                  onClick={fecharEditor}
                  className="px-5 md:px-6 py-2.5 md:py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-base md:text-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

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
