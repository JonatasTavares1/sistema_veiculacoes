// src/pages/Faturamentos.tsx
import { useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { apiGet, apiPut, apiPost, apiDelete, apiDownloadBlob } from "../services/api"

type FatAnexo = {
  id: number
  tipo: string
  filename: string
  path: string
  mime?: string | null
  size?: number | null
  uploaded_at: string
}

type PIResumo = {
  id: number
  numero_pi?: string | null
  tipo_pi?: string | null
  numero_pi_matriz?: string | null
  numero_pi_normal?: string | null

  nome_anunciante?: string | null
  razao_social_anunciante?: string | null
  cnpj_anunciante?: string | null

  nome_agencia?: string | null
  razao_social_agencia?: string | null
  cnpj_agencia?: string | null

  nome_campanha?: string | null

  executivo?: string | null
  diretoria?: string | null
  uf_cliente?: string | null
  canal?: string | null

  valor_bruto?: number | null
  valor_liquido?: number | null

  vencimento?: string | null
  data_emissao?: string | null
}

type Faturamento = {
  id: number
  entrega_id: number
  status: string
  enviado_em: string
  em_faturamento_em?: string | null
  faturado_em?: string | null
  pago_em?: string | null
  nf_numero?: string | null
  observacao?: string | null
  anexos: FatAnexo[]
  pi?: PIResumo | null
}

const STATUS_OPTS = ["ENVIADO", "EM_FATURAMENTO", "FATURADO", "PAGO"] as const

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ")
}

function isoToBR(iso?: string | null) {
  if (!iso) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return iso.slice(0, 10).split("-").reverse().join("/")
}

function moneyBR(v?: number | null) {
  if (v === null || v === undefined) return "—"
  try {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  } catch {
    return String(v)
  }
}

// ===== download helper (sem abrir nova aba) =====
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename || "arquivo"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// backend salva "uploads/..." e o FastAPI monta app.mount("/uploads", ...)
// em vez de <a href>, baixamos via fetch com Bearer (apiDownloadBlob)
function normalizeUploadRelPath(path?: string | null) {
  if (!path) return ""
  const p = String(path).replace(/\\/g, "/").replace(/^\.?\//, "")
  if (p.startsWith("uploads/")) return `/${p}`
  if (p.startsWith("/uploads/")) return p
  return `/uploads/${p}`
}

/**
 * Tenta descobrir o "role" do usuário lendo localStorage, sem depender de um formato específico.
 * Se você quiser forçar UI de admin só pra testar:
 *   localStorage.setItem("force_admin_ui", "1")
 */
function getRoleFromStorage(): string {
  try {
    const force = localStorage.getItem("force_admin_ui")
    if (force === "1") return "admin"

    const candidates = [
      "role",
      "user",
      "auth_user",
      "me",
      "current_user",
      "session",
      "auth",
      "usuario",
      "user_data",
    ]

    // 1) chaves conhecidas
    for (const k of candidates) {
      const v = localStorage.getItem(k)
      if (!v) continue

      // se for string direta
      if (k === "role") return String(v).toLowerCase().trim()

      // tenta JSON
      try {
        const obj: any = JSON.parse(v)
        const r =
          obj?.role ||
          obj?.user?.role ||
          obj?.usuario?.role ||
          obj?.data?.role ||
          obj?.profile?.role
        if (r) return String(r).toLowerCase().trim()
      } catch {
        // ignore
      }
    }

    // 2) varre tudo e tenta achar um JSON com "role"
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      if (raw.length < 2) continue

      try {
        const obj: any = JSON.parse(raw)
        const r =
          obj?.role ||
          obj?.user?.role ||
          obj?.usuario?.role ||
          obj?.data?.role ||
          obj?.profile?.role
        if (r) return String(r).toLowerCase().trim()
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return ""
}

async function tryGetMeRole(): Promise<string> {
  const endpoints = ["/me", "/auth/me", "/users/me"]
  for (const ep of endpoints) {
    try {
      const me: any = await apiGet(ep)
      const r = (me?.role || me?.user?.role || "").toString().toLowerCase().trim()
      if (r) return r
    } catch {
      // tenta próximo
    }
  }
  return ""
}

export default function Faturamentos() {
  const location = useLocation()

  const [lista, setLista] = useState<Faturamento[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [busca, setBusca] = useState("")
  const [statusFiltro, setStatusFiltro] = useState<string>("")

  const piIdFromUrl = useMemo(() => {
    const qs = new URLSearchParams(location.search)
    const v = qs.get("pi_id")
    if (!v) return ""
    const n = Number(v)
    return Number.isFinite(n) ? String(n) : ""
  }, [location.search])

  const [gerando, setGerando] = useState(false)

  // role / admin UI
  const [role, setRole] = useState<string>("")
  const isAdmin = useMemo(() => (role || "").toLowerCase().trim() === "admin", [role])

  // upload modal
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFatId, setUploadFatId] = useState<number | null>(null)
  const [uploadTipo, setUploadTipo] = useState<string>("OPEC")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadSaving, setUploadSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // download state
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  // actions menu / edit modal
  const [actionsOpenId, setActionsOpenId] = useState<number | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editFatId, setEditFatId] = useState<number | null>(null)
  const [editStatus, setEditStatus] = useState<string>("ENVIADO")
  const [editNF, setEditNF] = useState<string>("")
  const [editObs, setEditObs] = useState<string>("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      const qs = new URLSearchParams()
      if (statusFiltro) qs.set("status", statusFiltro)
      if (piIdFromUrl) qs.set("pi_id", piIdFromUrl)

      const url = qs.toString() ? `/faturamentos?${qs.toString()}` : `/faturamentos`
      const data = await apiGet<Faturamento[]>(url)
      setLista(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar faturamentos.")
    } finally {
      setLoading(false)
    }
  }

  // carrega role uma vez
  useEffect(() => {
    const rLocal = getRoleFromStorage()
    if (rLocal) setRole(rLocal)

    // tenta buscar do backend (se existir endpoint), mas não quebra nada
    ;(async () => {
      const r = await tryGetMeRole()
      if (r) setRole(r)
    })()
  }, [])

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFiltro, piIdFromUrl])

  // fecha menu de ações ao clicar fora / esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActionsOpenId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return lista
    return lista.filter(f => {
      const pi = f.pi || null
      const blob =
        `${f.id} ${f.entrega_id} ${f.status} ${f.nf_numero || ""} ${f.observacao || ""} ` +
        (pi
          ? `${pi.numero_pi || ""} ${pi.nome_anunciante || ""} ${pi.razao_social_anunciante || ""} ` +
            `${pi.nome_agencia || ""} ${pi.nome_campanha || ""} ${pi.executivo || ""} ${pi.diretoria || ""}`
          : "") +
        " " +
        (f.anexos || []).map(a => `${a.tipo} ${a.filename}`).join(" ")
      return blob.toLowerCase().includes(q)
    })
  }, [lista, busca])

  async function gerarDoPI() {
    if (!piIdFromUrl) return
    setGerando(true)
    try {
      await apiPost(`/faturamentos/gerar?pi_id=${encodeURIComponent(piIdFromUrl)}`, {})
      await carregar()
    } catch (e: any) {
      alert(e?.message || "Falha ao gerar faturamentos do PI.")
    } finally {
      setGerando(false)
    }
  }

  async function mudarStatus(fat: Faturamento, status: string) {
    const obs = prompt("Observação (opcional):", fat.observacao || "")
    if (obs === null) return

    let nfNumero: string | null = fat.nf_numero || null
    if (status === "FATURADO" || status === "PAGO") {
      const nf = prompt("NF número (opcional):", fat.nf_numero || "")
      if (nf === null) return
      nfNumero = (nf || "").trim() || null
    }

    try {
      const upd = await apiPut<Faturamento>(`/faturamentos/${fat.id}/status`, {
        status,
        nf_numero: nfNumero,
        observacao: (obs || "").trim() || null,
      })
      setLista(prev => prev.map(x => (x.id === upd.id ? upd : x)))
    } catch (e: any) {
      alert(e?.message || "Erro ao atualizar status.")
    }
  }

  function abrirUpload(fatId: number) {
    setUploadOpen(true)
    setUploadFatId(fatId)
    setUploadTipo("OPEC")
    setUploadFile(null)
    setUploadError(null)
  }

  function fecharUpload() {
    if (uploadSaving) return
    setUploadOpen(false)
    setUploadFatId(null)
    setUploadError(null)
  }

  async function enviarAnexo() {
    if (!uploadFatId) return
    if (!uploadTipo) {
      setUploadError("Selecione o tipo.")
      return
    }
    if (!uploadFile) {
      setUploadError("Selecione um arquivo.")
      return
    }

    setUploadSaving(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append("tipo", uploadTipo)
      form.append("file", uploadFile)

      await apiPost(`/faturamentos/${uploadFatId}/anexos`, form as any)

      await carregar()
      fecharUpload()
      alert("Anexo enviado.")
    } catch (e: any) {
      setUploadError(e?.message || "Falha ao enviar anexo.")
    } finally {
      setUploadSaving(false)
    }
  }

  async function baixarAnexo(a: FatAnexo) {
    const rel = normalizeUploadRelPath(a.path)
    if (!rel) {
      alert("Path do anexo inválido.")
      return
    }

    setDownloadingId(a.id)
    try {
      const blob = await apiDownloadBlob(rel)
      const filename = a.filename || `anexo_${a.id}`
      triggerDownload(blob, filename)
    } catch (e: any) {
      alert(e?.message || "Falha ao baixar arquivo.")
    } finally {
      setDownloadingId(null)
    }
  }

  // ======= ADMIN: editar / apagar =======

  function abrirEditar(f: Faturamento) {
    if (!isAdmin) return
    setActionsOpenId(null)

    setEditOpen(true)
    setEditFatId(f.id)
    setEditStatus((f.status || "ENVIADO").toUpperCase())
    setEditNF((f.nf_numero || "").toString())
    setEditObs((f.observacao || "").toString())
    setEditError(null)
  }

  function fecharEditar() {
    if (editSaving) return
    setEditOpen(false)
    setEditFatId(null)
    setEditError(null)
  }

  async function salvarEditar() {
    if (!isAdmin) return
    if (!editFatId) return

    const st = (editStatus || "").toUpperCase().trim()
    if (!STATUS_OPTS.includes(st as any)) {
      setEditError("Status inválido.")
      return
    }

    setEditSaving(true)
    setEditError(null)
    try {
      // Reaproveita endpoint existente
      const upd = await apiPut<Faturamento>(`/faturamentos/${editFatId}/status`, {
        status: st,
        nf_numero: (editNF || "").trim() || null,
        observacao: (editObs || "").trim() || null,
      })

      setLista(prev => prev.map(x => (x.id === upd.id ? upd : x)))
      fecharEditar()
      alert("Faturamento atualizado.")
    } catch (e: any) {
      setEditError(e?.message || "Falha ao salvar.")
    } finally {
      setEditSaving(false)
    }
  }

  async function apagarFaturamento(f: Faturamento) {
    if (!isAdmin) return
    setActionsOpenId(null)

    const ok = window.confirm(
      `Tem certeza que deseja APAGAR este faturamento?\n\nPI: ${f.pi?.numero_pi || "—"}\nFAT: #${f.id}\nEntrega: #${f.entrega_id}\n\nIsso é irreversível.`
    )
    if (!ok) return

    setDeletingId(f.id)
    try {
      // ⚠️ Precisa existir no backend: DELETE /faturamentos/{id}
      await apiDelete(`/faturamentos/${f.id}`)
      setLista(prev => prev.filter(x => x.id !== f.id))
      alert("Faturamento apagado.")
    } catch (e: any) {
      alert(
        e?.message ||
          "Falha ao apagar. Verifique se seu backend possui DELETE /faturamentos/{id} (somente admin)."
      )
    } finally {
      setDeletingId(null)
    }
  }

  const showEmptyGenerate = !loading && !erro && filtrados.length === 0 && !!piIdFromUrl

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl font-extrabold text-slate-900">Financeiro • Faturamentos</h1>
          {piIdFromUrl ? (
            <div className="mt-2 text-sm text-slate-600">
              Filtrando por <b>PI ID #{piIdFromUrl}</b> (vindo de Entregas).
            </div>
          ) : null}

          {/* debug discreto (não aparece visualmente pesado) */}
          <div className="mt-1 text-[11px] text-slate-400">
            role: {(role || "—").toString()}
            {isAdmin ? " (admin)" : ""}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {piIdFromUrl ? (
            <button
              onClick={gerarDoPI}
              disabled={gerando}
              className="px-5 py-3 rounded-2xl bg-emerald-600 text-white text-lg font-semibold hover:bg-emerald-700 disabled:opacity-60"
              title="Gerar faturamentos a partir das entregas do PI"
            >
              {gerando ? "Gerando..." : "Gerar do PI"}
            </button>
          ) : null}

          <button
            onClick={carregar}
            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Atualizar
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xl font-semibold text-slate-800 mb-2">Buscar</label>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="PI, cliente, agência, campanha, status, anexo…"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Status</label>
            <select
              value={statusFiltro}
              onChange={e => setStatusFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Todos</option>
              {STATUS_OPTS.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : erro ? (
          <div className="p-4 text-red-700 text-lg">{erro}</div>
        ) : showEmptyGenerate ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-700 bg-white">
            <div className="text-lg font-semibold">Nenhum faturamento encontrado para este PI.</div>
            <div className="mt-2 text-sm text-slate-600">
              Normalmente isso acontece quando os registros de faturamento ainda não foram gerados a partir das entregas.
            </div>
            <div className="mt-5">
              <button
                onClick={gerarDoPI}
                disabled={gerando}
                className="px-6 py-3 rounded-2xl bg-emerald-600 text-white text-lg font-semibold hover:bg-emerald-700 disabled:opacity-60"
              >
                {gerando ? "Gerando..." : "Gerar faturamentos do PI agora"}
              </button>
            </div>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nenhum faturamento encontrado.
          </div>
        ) : (
          filtrados.map(f => {
            const pi = f.pi || null
            const titulo = pi?.numero_pi ? `PI ${pi.numero_pi}` : `FAT #${f.id}`
            const cliente = pi?.nome_anunciante || pi?.razao_social_anunciante || "—"
            const agencia = pi?.nome_agencia || pi?.razao_social_agencia || "—"
            const campanha = pi?.nome_campanha || "—"

            return (
              <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* Card com cara de PI */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-lg font-bold text-slate-900">{titulo}</span>

                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700">
                        FAT #{f.id}
                      </span>

                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700">
                        Entrega #{f.entrega_id}
                      </span>

                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border border-slate-200 bg-amber-50 text-amber-800">
                        {String(f.status || "").toUpperCase()}
                      </span>

                      {pi?.tipo_pi ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border border-slate-200 bg-indigo-50 text-indigo-800">
                          {pi.tipo_pi}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700">
                      <div>
                        <b>Cliente:</b> {cliente}
                      </div>
                      <div>
                        <b>Agência:</b> {agencia}
                      </div>
                      <div className="md:col-span-2">
                        <b>Campanha:</b> {campanha}
                      </div>

                      <div>
                        <b>Executivo:</b> {pi?.executivo || "—"}
                      </div>
                      <div>
                        <b>Diretoria:</b> {pi?.diretoria || "—"}
                      </div>

                      <div>
                        <b>UF:</b> {pi?.uf_cliente || "—"}{" "}
                        {pi?.canal ? (
                          <>
                            • <b>Canal:</b> {pi.canal}
                          </>
                        ) : null}
                      </div>

                      <div>
                        <b>Valor Líquido:</b> {moneyBR(pi?.valor_liquido)}{" "}
                        {pi?.valor_bruto != null ? (
                          <span className="text-slate-500">
                            • <b>Bruto:</b> {moneyBR(pi.valor_bruto)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Status do faturamento */}
                    <div className="mt-3 text-sm text-slate-600">
                      <div>
                        <b>Enviado:</b> {isoToBR(f.enviado_em)}
                        {f.em_faturamento_em ? (
                          <span>
                            {" "}
                            • <b>Em faturamento:</b> {isoToBR(f.em_faturamento_em)}
                          </span>
                        ) : null}
                        {f.faturado_em ? (
                          <span>
                            {" "}
                            • <b>Faturado:</b> {isoToBR(f.faturado_em)}
                          </span>
                        ) : null}
                        {f.pago_em ? (
                          <span>
                            {" "}
                            • <b>Pago:</b> {isoToBR(f.pago_em)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1">
                        <b>NF:</b> {f.nf_numero || "—"} • <b>Obs:</b> {f.observacao || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => abrirUpload(f.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      📎 Anexar arquivo
                    </button>

                    {STATUS_OPTS.map(s => (
                      <button
                        key={s}
                        onClick={() => mudarStatus(f, s)}
                        className={classNames(
                          "px-3 py-2 rounded-xl border text-sm hover:bg-slate-50",
                          String(f.status || "").toUpperCase() === s
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-slate-300 text-slate-700"
                        )}
                      >
                        {s}
                      </button>
                    ))}

                    {/* ✅ ADMIN: menu de ações (editar/apagar) */}
                    {isAdmin ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActionsOpenId(prev => (prev === f.id ? null : f.id))}
                          className="px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                          title="Ações (admin)"
                          disabled={deletingId === f.id}
                        >
                          ⋯ Ações
                        </button>

                        {actionsOpenId === f.id ? (
                          <div
                            className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-20"
                            onMouseLeave={() => setActionsOpenId(null)}
                          >
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-800"
                              onClick={() => abrirEditar(f)}
                            >
                              ✏️ Editar
                            </button>

                            <button
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-700 disabled:opacity-60"
                              onClick={() => apagarFaturamento(f)}
                              disabled={deletingId === f.id}
                            >
                              {deletingId === f.id ? "⏳ Apagando..." : "🗑️ Apagar"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-semibold text-slate-700 mb-2">Anexos</div>
                  {f.anexos?.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {f.anexos.map(a => (
                        <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                          <div className="text-xs text-slate-500">{a.tipo}</div>
                          <div className="text-sm font-semibold text-slate-900 truncate" title={a.filename}>
                            {a.filename}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">Enviado: {isoToBR(a.uploaded_at)}</div>

                          <button
                            type="button"
                            onClick={() => baixarAnexo(a)}
                            disabled={downloadingId === a.id}
                            className="mt-2 inline-flex text-sm font-semibold text-red-700 hover:text-red-800 disabled:opacity-60"
                            title="Baixar anexo"
                          >
                            {downloadingId === a.id ? "Baixando..." : "⬇️ Baixar"}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">Sem anexos.</div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </section>

      {/* Modal upload */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharUpload} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">Enviar Anexo</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">FAT #{uploadFatId}</div>
              </div>
              <button
                onClick={fecharUpload}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                disabled={uploadSaving}
              >
                ✖ Fechar
              </button>
            </div>

            <div className="p-6 space-y-6">
              {uploadError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
                  {uploadError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo</label>
                <select
                  value={uploadTipo}
                  onChange={e => setUploadTipo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="OPEC">OPEC</option>
                  <option value="NF">NF</option>
                  <option value="COMPROVANTE_PAGAMENTO">COMPROVANTE_PAGAMENTO</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Arquivo</label>
                <input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="w-full" />
              </div>

              <div className="pt-2">
                <button
                  onClick={enviarAnexo}
                  disabled={uploadSaving}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 text-white text-lg font-semibold hover:bg-emerald-700 disabled:opacity-60"
                >
                  {uploadSaving ? "Enviando..." : "Enviar"}
                </button>
              </div>

              <div className="text-xs text-slate-500">
                * Regras: OPEC envia tipo OPEC. NF e Comprovante: Financeiro. Admin pode tudo.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal editar (ADMIN) */}
      {editOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharEditar} />
          <div className="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">Editar Faturamento</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">FAT #{editFatId}</div>
              </div>
              <button
                onClick={fecharEditar}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                disabled={editSaving}
              >
                ✖ Fechar
              </button>
            </div>

            <div className="p-6 space-y-5">
              {!isAdmin ? (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
                  Sem permissão (somente admin).
                </div>
              ) : null}

              {editError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  disabled={editSaving || !isAdmin}
                >
                  {STATUS_OPTS.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-slate-500">
                  * Ao salvar, o backend deve ajustar as datas (enviado/em faturamento/faturado/pago) conforme sua regra.
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">NF (opcional)</label>
                <input
                  value={editNF}
                  onChange={e => setEditNF(e.target.value)}
                  placeholder="Ex: 12345"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                  disabled={editSaving || !isAdmin}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Observação (opcional)</label>
                <textarea
                  value={editObs}
                  onChange={e => setEditObs(e.target.value)}
                  placeholder="Observações do faturamento…"
                  className="w-full min-h-[110px] rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                  disabled={editSaving || !isAdmin}
                />
              </div>

              <div className="pt-1 flex items-center justify-end gap-3">
                <button
                  onClick={fecharEditar}
                  disabled={editSaving}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarEditar}
                  disabled={editSaving || !isAdmin}
                  className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {editSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>

              <div className="text-[11px] text-slate-400">
                Endpoint usado: PUT /faturamentos/{`{id}`}/status (status, nf_numero, observacao).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
