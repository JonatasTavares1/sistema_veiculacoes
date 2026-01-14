// src/pages/Entregas.tsx
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiGet, apiPost, apiPut, apiDelete } from "../services/api"

// ===== Tipos (sem status) =====
type Entrega = {
  id: number
  veiculacao_id: number
  data_entrega: string // ISO yyyy-mm-dd
  motivo?: string | null
}

type VeicFull = {
  id: number
  pi_id?: number | null
  numero_pi?: string | null
  produto_nome?: string | null
  cliente?: string | null
  campanha?: string | null
  canal?: string | null
  formato?: string | null
  data_inicio?: string | null
  data_fim?: string | null
}

type EntregaStatus = "Sim" | "Não" | "pendente"

// ======================== Persistência Local (PI entregue) ========================
// (MESMA CHAVE usada em Veiculacoes.tsx)
const LS_KEY_PI_DELIV = "pis_entregas_v1"
type PIDelivery = { status: EntregaStatus; ts: string; data?: string | null; motivo?: string | null }

function loadPIDeliveries(): Record<string, PIDelivery> {
  try {
    const raw = localStorage.getItem(LS_KEY_PI_DELIV)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, PIDelivery>
    return parsed || {}
  } catch {
    return {}
  }
}
function savePIDeliveries(map: Record<string, PIDelivery>) {
  try {
    localStorage.setItem(LS_KEY_PI_DELIV, JSON.stringify(map))
  } catch {}
}

// chave ROBUSTA (igual Veiculacoes)
function piKeyFromVeic(v: VeicFull) {
  const n = (v.numero_pi ?? "").toString().trim()
  if (n) return `PI#${n}`
  if (typeof v.pi_id === "number" && !Number.isNaN(v.pi_id)) return `PIID#${v.pi_id}`
  return `VEIC#${v.id}`
}

// ===== Helpers UI =====
function isoToBR(iso?: string) {
  if (!iso) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return iso
}
function parseISODateToBR(s?: string | null) {
  if (!s) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return s.slice(0, 10).split("-").reverse().join("/")
}
function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ")
}
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
function chipCanal(c?: string | null) {
  const key = (c || "").toUpperCase()
  const klass = CANAL_COLORS[key] || "bg-slate-100 text-slate-800 border-slate-200"
  return ["inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border", klass].join(" ")
}

// ===== Export helpers (xlsx/CSV) =====
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

// ==================== Página ====================
export default function Entregas() {
  const navigate = useNavigate()

  // base
  const [veics, setVeics] = useState<VeicFull[]>([])
  const [veicMap, setVeicMap] = useState<Record<number, VeicFull>>({})

  // lista bruta de entregas (por veiculação)
  const [lista, setLista] = useState<Entrega[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // busca
  const [busca, setBusca] = useState("")

  // ===== cadastro (por PI) =====
  const [novoPINum, setNovoPINum] = useState<string>("")
  const [novaData, setNovaData] = useState("") // YYYY-MM-DD
  const [novoMotivo, setNovoMotivo] = useState("")
  const [salvando, setSalvando] = useState(false)

  // edição (modal)
  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<Entrega | null>(null)
  const [editVeicId, setEditVeicId] = useState<number | "">("")
  const [editData, setEditData] = useState("")
  const [editMotivo, setEditMotivo] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // expansão por PI
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const togglePI = (pi: string) =>
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(pi)) n.delete(pi)
      else n.add(pi)
      return n
    })

  // ===========================
  // ✅ MODAL: Enviar para Faturamento (OPEC)
  // ===========================
  const [sendOpen, setSendOpen] = useState(false)
  const [sendEntregaId, setSendEntregaId] = useState<number | null>(null)
  const [sendPiId, setSendPiId] = useState<number | null>(null)
  const [sendPiNumero, setSendPiNumero] = useState<string>("")
  const [sendEnviadoEm, setSendEnviadoEm] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [sendFiles, setSendFiles] = useState<File[]>([])
  const [sendSaving, setSendSaving] = useState(false)
  const [sendUploading, setSendUploading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendUploadError, setSendUploadError] = useState<string | null>(null)

  function abrirModalEnviarFaturamento(opts: { entregaId: number; piId?: number | null; piNumero?: string | null }) {
    setSendOpen(true)
    setSendEntregaId(opts.entregaId)
    setSendPiId(opts.piId ?? null)
    setSendPiNumero((opts.piNumero || "").toString())
    setSendEnviadoEm(new Date().toISOString().slice(0, 10))
    setSendFiles([])
    setSendError(null)
    setSendUploadError(null)
    setSendSaving(false)
    setSendUploading(false)
  }

  function fecharModalEnviarFaturamento() {
    if (sendSaving || sendUploading) return
    setSendOpen(false)
    setSendEntregaId(null)
    setSendPiId(null)
    setSendPiNumero("")
    setSendFiles([])
    setSendError(null)
    setSendUploadError(null)
    setSendSaving(false)
    setSendUploading(false)
  }

  async function uploadOpecAnexos(faturamentoId: number, files: File[]) {
    if (!files.length) return
    for (const file of files) {
      const form = new FormData()
      form.append("tipo", "OPEC")
      form.append("file", file)
      await apiPost(`/faturamentos/${faturamentoId}/anexos`, form as any)
    }
  }

  async function confirmarEnviarFaturamento() {
    if (!sendEntregaId) {
      setSendError("Entrega inválida.")
      return
    }

    setSendSaving(true)
    setSendError(null)
    setSendUploadError(null)

    try {
      const resp = await apiPost<any>(`/entregas/${sendEntregaId}/enviar-faturamento`, {})
      const fatId = Number(resp?.faturamento_id || 0)
      if (!fatId) throw new Error("Não consegui obter o faturamento_id.")

      if (sendFiles.length) {
        setSendUploading(true)
        try {
          await uploadOpecAnexos(fatId, sendFiles)
        } catch (e: any) {
          setSendUploadError(e?.message || "Falha ao enviar anexos.")
        } finally {
          setSendUploading(false)
        }
      }

      alert("Enviado para faturamento. O card já deve aparecer no Financeiro.")

      if (!sendUploadError) {
        fecharModalEnviarFaturamento()
        if (sendPiId) navigate(`/faturamentos?pi_id=${encodeURIComponent(String(sendPiId))}`)
        else navigate(`/faturamentos`)
      }
    } catch (e: any) {
      setSendError(e?.message || "Erro ao enviar para faturamento.")
    } finally {
      setSendSaving(false)
    }
  }

  // ===== Carregamentos =====
  async function carregarVeiculacoes() {
    try {
      const vs = await apiGet<any[]>(`/veiculacoes`)
      const rows: VeicFull[] = (Array.isArray(vs) ? vs : []).map(v => ({
        id: v.id,
        pi_id: v.pi_id ?? null,
        numero_pi: v.numero_pi || v.pi?.numero_pi || null,
        produto_nome: v.produto_nome || v.produto || null,
        cliente: v.cliente ?? v.anunciante ?? v.pi?.cliente ?? v.pi?.anunciante ?? null,
        campanha: v.campanha ?? null,
        canal: v.canal ?? null,
        formato: v.formato ?? null,
        data_inicio: v.data_inicio ?? null,
        data_fim: v.data_fim ?? null,
      }))
      setVeics(rows)
      const map: Record<number, VeicFull> = {}
      rows.forEach(v => {
        map[v.id] = v
      })
      setVeicMap(map)
    } catch (e: any) {
      console.warn("Falha ao carregar veiculações:", e?.message)
    }
  }

  async function carregarEntregas() {
    setLoading(true)
    setErro(null)
    try {
      const es = await apiGet<any[]>(`/entregas`)
      const normalized: Entrega[] = (Array.isArray(es) ? es : []).map((x: any) => ({
        id: x.id,
        veiculacao_id: x.veiculacao_id,
        data_entrega: x.data_entrega,
        motivo: x.motivo ?? null,
      }))
      setLista(normalized)
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar entregas.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarVeiculacoes()
    carregarEntregas()
  }, [])

  // ===== Opções de PI (únicos) para o select de "Nova entrega" =====
  const piOptions = useMemo(() => {
    const seen = new Map<string, string>() // numero_pi -> label
    for (const v of veics) {
      const pi = (v.numero_pi || "—").toString()
      if (!seen.has(pi)) {
        const label = [pi, v.cliente, v.campanha].filter(Boolean).join(" • ")
        seen.set(pi, label)
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR", { numeric: true }))
      .map(([pi, label]) => ({ pi, label }))
  }, [veics])

  // ===== Índice: última entrega por veiculação =====
  const ultimaEntregaPorVeic = useMemo(() => {
    const map = new Map<number, Entrega>()
    for (const e of lista) {
      const cur = map.get(e.veiculacao_id)
      if (!cur) {
        map.set(e.veiculacao_id, e)
        continue
      }
      const a = (cur.data_entrega || "") + `#${String(cur.id).padStart(8, "0")}`
      const b = (e.data_entrega || "") + `#${String(e.id).padStart(8, "0")}`
      if (b > a) map.set(e.veiculacao_id, e)
    }
    return map
  }, [lista])

  // ===== Agrupamento por PI =====
  type GrupoPI = {
    pi: string
    header: { cliente?: string | null; campanha?: string | null }
    itens: Array<{ veic: VeicFull; entrega?: Entrega | null }>
  }

  const gruposPI = useMemo<GrupoPI[]>(() => {
    const byPI = new Map<string, GrupoPI>()
    for (const v of veics) {
      const pi = (v.numero_pi || "—").toString()
      if (!byPI.has(pi)) {
        byPI.set(pi, {
          pi,
          header: { cliente: v.cliente ?? null, campanha: v.campanha ?? null },
          itens: [],
        })
      }
      const g = byPI.get(pi)!
      const entrega = ultimaEntregaPorVeic.get(v.id) || null
      g.itens.push({ veic: v, entrega })
    }

    const q = busca.trim().toLowerCase()
    const arr: GrupoPI[] = []
    for (const g of byPI.values()) {
      if (q) {
        const blob =
          `${g.pi} ${g.header.cliente || ""} ${g.header.campanha || ""} ` +
          g.itens.map(it => `${it.veic.produto_nome || ""} ${it.entrega?.motivo || ""}`).join(" ")
        if (!blob.toLowerCase().includes(q)) continue
      }
      arr.push(g)
    }

    arr.sort((a, b) => a.pi.localeCompare(b.pi, "pt-BR", { numeric: true }))
    return arr
  }, [veics, ultimaEntregaPorVeic, busca])

  // ========================
  // ✅ Sync localStorage (pis_entregas_v1) com base nas entregas existentes
  // - Sim: todas as veiculações do PI têm entrega
  // - pendente: algumas têm entrega
  // - remove: nenhuma tem entrega
  // ========================
  function syncLocalPIDeliveries() {
    const current = loadPIDeliveries()
    const next: Record<string, PIDelivery> = { ...current }

    // agrupa veics por PI string para calcular completeness
    const byPI = new Map<string, VeicFull[]>()
    for (const v of veics) {
      const piStr = (v.numero_pi || "—").toString()
      if (!byPI.has(piStr)) byPI.set(piStr, [])
      byPI.get(piStr)!.push(v)
    }

    for (const [piStr, veicsDoPI] of byPI.entries()) {
      if (!veicsDoPI.length) continue

      const veicsComEntrega = veicsDoPI.filter(v => !!ultimaEntregaPorVeic.get(v.id))
      const hasAny = veicsComEntrega.length > 0
      const hasAll = veicsComEntrega.length === veicsDoPI.length

      const key = piKeyFromVeic(veicsDoPI[0])
      if (!hasAny) {
        // não existe entrega -> remove marcação local (para não “ficar preso” como entregue)
        if (next[key]) delete next[key]
        continue
      }

      // pega a entrega mais recente do PI (para data/motivo)
      let last: Entrega | null = null
      for (const v of veicsComEntrega) {
        const e = ultimaEntregaPorVeic.get(v.id) || null
        if (!e) continue
        if (!last) last = e
        else {
          const a = (last.data_entrega || "") + `#${String(last.id).padStart(8, "0")}`
          const b = (e.data_entrega || "") + `#${String(e.id).padStart(8, "0")}`
          if (b > a) last = e
        }
      }

      next[key] = {
        status: hasAll ? "Sim" : "pendente",
        ts: new Date().toISOString(),
        data: last?.data_entrega ?? null,
        motivo: last?.motivo ?? null,
      }
    }

    savePIDeliveries(next)
  }

  useEffect(() => {
    // só sincroniza quando já temos veics/lista processados
    if (!veics.length) return
    syncLocalPIDeliveries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veics, lista, ultimaEntregaPorVeic])

  // ===== Ações =====
  async function salvarNova() {
    if (!novoPINum) {
      alert("Selecione o PI.")
      return
    }
    if (!novaData) {
      alert("Informe a data de entrega.")
      return
    }
    setSalvando(true)
    try {
      const firstOfPI = veics.find(v => (v.numero_pi || "—").toString() === novoPINum && v.pi_id != null)

      if (firstOfPI?.pi_id != null) {
        let ok = false
        try {
          await apiPost(`/entregas_pi`, {
            pi_id: firstOfPI.pi_id,
            data_entrega: novaData,
            motivo: (novoMotivo || "").trim() || null,
          })
          ok = true
        } catch {
          await apiPost(`/entregas/pi`, {
            pi_id: firstOfPI.pi_id,
            data_entrega: novaData,
            motivo: (novoMotivo || "").trim() || null,
          })
          ok = true
        }

        if (ok) {
          setNovoPINum("")
          setNovaData("")
          setNovoMotivo("")
          await carregarEntregas()
          alert("Entrega do PI cadastrada com sucesso!")
          setSalvando(false)
          return
        }
      }

      const veicsDoPI = veics.filter(v => (v.numero_pi || "—").toString() === novoPINum)
      if (!veicsDoPI.length) throw new Error("PI selecionado não possui veiculações.")

      await Promise.all(
        veicsDoPI.map(v =>
          apiPost(`/entregas`, {
            veiculacao_id: v.id,
            data_entrega: novaData,
            motivo: (novoMotivo || "").trim() || null,
          })
        )
      )

      setNovoPINum("")
      setNovaData("")
      setNovoMotivo("")
      await carregarEntregas()
      alert("Entrega registrada para cada veiculação do PI (fallback).")
    } catch (e: any) {
      alert(e?.message || "Erro ao cadastrar entrega do PI.")
    } finally {
      setSalvando(false)
    }
  }

  function abrirEdicao(e: Entrega) {
    setEdit(e)
    setEditVeicId(e.veiculacao_id)
    setEditData(e.data_entrega || "")
    setEditMotivo(e.motivo || "")
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
    if (!editData) {
      setEditError("Data é obrigatória.")
      return
    }
    setEditSaving(true)
    try {
      const upd = await apiPut<any>(`/entregas/${edit.id}`, {
        veiculacao_id: editVeicId || undefined,
        data_entrega: editData,
        motivo: editMotivo || null,
      })
      const normalized: Entrega = {
        id: upd.id,
        veiculacao_id: upd.veiculacao_id,
        data_entrega: upd.data_entrega,
        motivo: upd.motivo ?? null,
      }
      setLista(prev => prev.map(x => (x.id === normalized.id ? normalized : x)))
      fecharEdicao()
    } catch (e: any) {
      setEditError(e?.message || "Erro ao salvar edição.")
    } finally {
      setEditSaving(false)
    }
  }

  async function atualizarMotivoQuick(e: Entrega) {
    const novo = prompt("Motivo (pode ficar vazio):", e.motivo || "")
    if (novo === null) return
    try {
      const path = `/entregas/${e.id}/motivo?motivo=${encodeURIComponent(novo)}`
      const upd = await apiPut<any>(path, {})
      const normalized: Entrega = {
        id: upd.id,
        veiculacao_id: upd.veiculacao_id,
        data_entrega: upd.data_entrega,
        motivo: upd.motivo ?? null,
      }
      setLista(prev => prev.map(x => (x.id === normalized.id ? normalized : x)))
    } catch (err: any) {
      alert(err?.message || "Falha ao atualizar motivo.")
    }
  }

  async function excluir(e: Entrega) {
    if (!confirm(`Excluir entrega #${e.id} de ${isoToBR(e.data_entrega)}?`)) return
    try {
      await apiDelete(`/entregas/${e.id}`)
      setLista(prev => prev.filter(x => x.id !== e.id))
    } catch (err: any) {
      alert(err?.message || "Erro ao excluir entrega.")
    }
  }

  // ===== Entrega por PI (modal existente — cria 1 por veiculação do PI) =====
  const [piModalOpen, setPiModalOpen] = useState(false)
  const [piModalPI, setPiModalPI] = useState<string | null>(null)
  const [piModalData, setPiModalData] = useState(() => new Date().toISOString().slice(0, 10))
  const [piModalMotivo, setPiModalMotivo] = useState("")
  const [piModalSaving, setPiModalSaving] = useState(false)
  const [piModalError, setPiModalError] = useState<string | null>(null)

  function abrirEntregaPI(pi: string) {
    setPiModalPI(pi)
    setPiModalData(new Date().toISOString().slice(0, 10))
    setPiModalMotivo("")
    setPiModalError(null)
    setPiModalOpen(true)
  }
  function fecharEntregaPI() {
    setPiModalOpen(false)
    setPiModalPI(null)
    setPiModalError(null)
  }

  async function salvarEntregaPI() {
    if (!piModalPI) return
    const grupo = gruposPI.find(g => g.pi === piModalPI)
    if (!grupo) {
      setPiModalError("PI não encontrado.")
      return
    }
    const veicsDoPI = grupo.itens.map(i => i.veic)
    if (!veicsDoPI.length) {
      setPiModalError("Este PI não possui veiculações.")
      return
    }
    setPiModalSaving(true)
    setPiModalError(null)
    try {
      await Promise.all(
        veicsDoPI.map(v =>
          apiPost(`/entregas`, {
            veiculacao_id: v.id,
            data_entrega: piModalData,
            motivo: piModalMotivo || null,
          })
        )
      )
      await carregarEntregas()
      fecharEntregaPI()
    } catch (e: any) {
      setPiModalError(e?.message || "Falha ao registrar entrega do PI.")
    } finally {
      setPiModalSaving(false)
    }
  }

  // ===== Export =====
  async function exportarPlanilha(rows: Entrega[]) {
    if (!rows?.length) {
      alert("Nada para exportar.")
      return
    }
    const data = rows.map(e => {
      const v = veicMap[e.veiculacao_id]
      return {
        ID: e.id,
        "Veiculação #": e.veiculacao_id,
        Produto: v?.produto_nome || "",
        "PI Nº": v?.numero_pi || "",
        "Data (ISO)": e.data_entrega || "",
        "Data (BR)": isoToBR(e.data_entrega || ""),
        Motivo: e.motivo || "",
      }
    })
    const nomeArq = `entregas_${new Date().toISOString().slice(0, 10)}.xlsx`
    try {
      const XLSX = await import("xlsx")
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Entregas")
      XLSX.writeFile(wb, nomeArq)
    } catch {
      const csv = jsonToCSV(data)
      downloadBlob(csv, nomeArq.replace(/\.xlsx$/, ".csv"), "text/csv;charset=utf-8;")
      alert("Exportei em CSV (fallback). Para .xlsx nativo, instale a lib 'xlsx'.")
    }
  }

  // ===== Render =====
  return (
    <div className="space-y-8">
      {/* Título + ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Entregas (por PI)</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => exportarPlanilha(lista)}
            disabled={!lista.length}
            className="px-5 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-lg hover:bg-slate-50 disabled:opacity-60"
            title="Exportar para Excel"
          >
            📤 Exportar XLSX
          </button>
          <button
            type="button"
            onClick={() => {
              carregarVeiculacoes()
              carregarEntregas()
            }}
            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Cadastro (por PI) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Nova entrega (PI)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div className="lg:col-span-2">
            <label className="block text-xl font-semibold text-slate-800 mb-2">PI</label>
            <select
              value={novoPINum}
              onChange={e => setNovoPINum(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Selecione…</option>
              {piOptions.map(({ pi, label }) => (
                <option key={pi} value={pi}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Data</label>
            <input
              type="date"
              value={novaData}
              onChange={e => setNovaData(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>

          <div className="lg:col-span-4">
            <label className="block text-xl font-semibold text-slate-800 mb-2">Motivo (opcional)</label>
            <input
              value={novoMotivo}
              onChange={e => setNovoMotivo(e.target.value)}
              placeholder="Ex.: Cliente solicitou reagendamento…"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={salvarNova}
            disabled={salvando}
            className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Cadastrar Entrega do PI"}
          </button>
        </div>
      </section>

      {/* Filtro simples */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-xl font-semibold text-slate-800 mb-2">Buscar</label>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Nº do PI, Produto, Cliente, Motivo…"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
        />
      </section>

      {/* Lista por PI (cards) */}
      <section className="space-y-6">
        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : erro ? (
          <div className="p-4 text-red-700 text-lg">{erro}</div>
        ) : gruposPI.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nenhuma entrega encontrada.
          </div>
        ) : (
          gruposPI.map(g => {
            const isOpen = expanded.has(g.pi)
            const veicsDoPI = g.itens.map(i => i.veic)
            const allComData = veicsDoPI.length > 0 && g.itens.every(i => !!i.entrega?.data_entrega)

            const firstWithPiId = g.itens.find(i => i.veic.pi_id != null)?.veic
            const piIdForFinance = firstWithPiId?.pi_id ?? null

            const firstEntrega = g.itens.find(i => !!i.entrega)?.entrega || null

            return (
              <div
                key={g.pi}
                className={classNames(
                  "rounded-2xl border bg-white shadow-sm overflow-hidden transition",
                  allComData ? "border-emerald-300 ring-2 ring-emerald-300" : "border-slate-200"
                )}
              >
                <div
                  className={classNames(
                    "px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b",
                    allComData ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-lg font-bold text-slate-900">PI {g.pi}</span>
                      {(g.header.cliente || g.header.campanha) && (
                        <span className="text-slate-800 font-medium truncate max-w-[60ch]">
                          {g.header.cliente || "—"}
                          {g.header.campanha ? <span className="text-slate-500"> • {g.header.campanha}</span> : null}
                        </span>
                      )}
                      {allComData && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-semibold border border-emerald-200">
                          ✅ PI com entregas registradas
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      <b>{g.itens.length}</b> veiculação(ões)
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!firstEntrega) {
                          alert("Ainda não existe entrega registrada para este PI. Registre uma entrega primeiro.")
                          return
                        }
                        abrirModalEnviarFaturamento({
                          entregaId: firstEntrega.id,
                          piId: piIdForFinance,
                          piNumero: g.pi,
                        })
                      }}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                      title="Enviar para o Financeiro (abre modal para anexos)"
                    >
                      💳 Faturamento
                    </button>

                    <button
                      type="button"
                      onClick={() => abrirEntregaPI(g.pi)}
                      className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      📦 Registrar entrega do PI
                    </button>

                    <button
                      type="button"
                      onClick={() => togglePI(g.pi)}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      {isOpen ? "Recolher" : "Ver veiculações"}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="p-4">
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                      {g.itens.map(({ veic, entrega }) => (
                        <div key={veic.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate">{veic.produto_nome || "—"}</div>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                {veic.canal && <span className={chipCanal(veic.canal)}>{veic.canal}</span>}
                                {veic.formato && (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-2 py-0.5 font-semibold border border-slate-200">
                                    {veic.formato}
                                  </span>
                                )}
                                {(veic.data_inicio || veic.data_fim) && (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-2 py-0.5 font-semibold border border-slate-200">
                                    {parseISODateToBR(veic.data_inicio)} → {parseISODateToBR(veic.data_fim)}
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 text-sm text-slate-700">
                                <div>
                                  <b>Última entrega:</b> {entrega?.data_entrega ? isoToBR(entrega.data_entrega) : "—"}
                                </div>
                                {entrega?.motivo && (
                                  <div className="text-slate-500 truncate" title={entrega.motivo}>
                                    <b>Motivo:</b> {entrega.motivo}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="text-right">
                              {entrega && (
                                <div className="flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => abrirEdicao(entrega)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                                  >
                                    ✏️ Editar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => atualizarMotivoQuick(entrega)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                                  >
                                    📝 Motivo
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => excluir(entrega)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                                  >
                                    🗑️ Excluir
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      abrirModalEnviarFaturamento({
                                        entregaId: entrega.id,
                                        piId: veic.pi_id ?? null,
                                        piNumero: veic.numero_pi ?? g.pi,
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
                                  >
                                    💰 Enviar p/ Faturamento
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </section>

      {/* Modal de edição */}
      {editOpen && edit && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharEdicao} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">Editar Entrega</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">
                  #{edit.id} • {isoToBR(edit.data_entrega)}
                </div>
              </div>
              <button
                type="button"
                onClick={fecharEdicao}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                ✖ Fechar
              </button>
            </div>

            <div className="p-6 space-y-6">
              {editError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">{editError}</div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Veiculação</label>
                  <select
                    value={editVeicId}
                    onChange={e => setEditVeicId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">—</option>
                    {veics.map(v => (
                      <option key={v.id} value={v.id}>
                        #{v.id} — {v.produto_nome || "Produto"} • PI {v.numero_pi || "—"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={editData}
                    onChange={e => setEditData(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Motivo</label>
                  <input
                    value={editMotivo}
                    onChange={e => setEditMotivo(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
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

      {/* Modal: entrega do PI */}
      {piModalOpen && piModalPI && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => !piModalSaving && fecharEntregaPI()} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">Entrega do PI</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">{piModalPI}</div>
              </div>
              <button
                type="button"
                onClick={fecharEntregaPI}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                disabled={piModalSaving}
              >
                ✖ Fechar
              </button>
            </div>

            <div className="p-6 space-y-6">
              {piModalError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">{piModalError}</div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Data da entrega</label>
                <input
                  type="date"
                  value={piModalData}
                  onChange={e => setPiModalData(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Motivo / Observação (opcional)</label>
                <textarea
                  value={piModalMotivo}
                  onChange={e => setPiModalMotivo(e.target.value)}
                  placeholder="Ex.: campanha concluída conforme plano…"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  rows={3}
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={salvarEntregaPI}
                  disabled={piModalSaving}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 text-white text-lg font-semibold hover:bg-emerald-700 disabled:opacity-60"
                >
                  {piModalSaving ? "Salvando..." : "Registrar entrega do PI"}
                </button>
              </div>

              <div className="text-xs text-slate-500">
                * Se a sua API por PI não existir, este botão cria um registro de entrega para <b>cada veiculação</b> deste PI (fallback).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal: Enviar para Faturamento (OPEC) */}
      {sendOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharModalEnviarFaturamento} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">Enviar para Faturamento</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">
                  PI {sendPiNumero || "—"}{" "}
                  <span className="text-sm font-semibold text-slate-600">• Entrega #{sendEntregaId ?? "—"}</span>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  Aqui a OPEC anexa os documentos e envia para o Financeiro iniciar a esteira.
                </div>
              </div>

              <button
                type="button"
                onClick={fecharModalEnviarFaturamento}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                disabled={sendSaving || sendUploading}
              >
                ✖ Fechar
              </button>
            </div>

            <div className="p-6 space-y-5">
              {sendError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">{sendError}</div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Data do envio para o faturamento</label>
                <input
                  type="date"
                  value={sendEnviadoEm}
                  onChange={e => setSendEnviadoEm(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  disabled={sendSaving || sendUploading}
                />
                <div className="mt-1 text-xs text-slate-500">(Visual. O backend já marca o horário do envio.)</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Anexos (OPEC)</div>
                    <div className="text-xs text-slate-600">Relatório, prints, PDFs, etc.</div>
                  </div>

                  <label className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">
                    📎 Selecionar
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        if (!files.length) return
                        setSendFiles((prev) => {
                          const merged = [...prev, ...files]
                          const uniq = new Map<string, File>()
                          for (const f of merged) {
                            uniq.set(`${f.name}#${f.size}#${f.lastModified}`, f)
                          }
                          return Array.from(uniq.values())
                        })
                        setSendUploadError(null)
                        e.currentTarget.value = ""
                      }}
                      disabled={sendSaving || sendUploading}
                    />
                  </label>
                </div>

                {sendUploadError && (
                  <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
                    {sendUploadError}
                  </div>
                )}

                {sendFiles.length ? (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-slate-700">
                      <b>{sendFiles.length}</b> arquivo(s) selecionado(s)
                    </div>

                    <ul className="text-sm text-slate-700 space-y-1">
                      {sendFiles.map((f, idx) => (
                        <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center justify-between gap-3">
                          <span className="truncate">
                            {f.name} <span className="text-xs text-slate-500">({Math.ceil(f.size / 1024)} KB)</span>
                          </span>
                          <button
                            type="button"
                            className="px-2 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-white text-xs"
                            onClick={() => setSendFiles((prev) => prev.filter((_, i) => i !== idx))}
                            disabled={sendSaving || sendUploading}
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-600">Nenhum anexo selecionado.</div>
                )}
              </div>

              <div className="pt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={confirmarEnviarFaturamento}
                  disabled={sendSaving || sendUploading}
                  className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {sendSaving ? "Enviando..." : sendUploading ? "Enviando anexos..." : "Confirmar e enviar"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (sendPiId) navigate(`/faturamentos?pi_id=${encodeURIComponent(String(sendPiId))}`)
                    else navigate(`/faturamentos`)
                  }}
                  className="px-6 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-lg font-semibold hover:bg-slate-50"
                  disabled={sendSaving || sendUploading}
                  title="Abrir a tela do Financeiro"
                >
                  Ir para Financeiro
                </button>
              </div>

              <div className="text-xs text-slate-500">
                * Neste modal a OPEC envia anexos como <b>OPEC</b>. NF e Comprovante ficam para o Financeiro.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
