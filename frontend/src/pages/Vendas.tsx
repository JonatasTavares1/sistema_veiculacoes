import { useEffect, useMemo, useState } from "react"
import { apiGet, apiPost } from "../services/api"

const monthOptions = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Fev" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Abr" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Ago" },
  { value: 9, label: "Set" },
  { value: 10, label: "Out" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dez" },
]

type PainelLinha = {
  executivo: string
  diretoria?: string | null
  vendido_liquido: number
  meta: number
  pct_atingido: number
  restante: number
  status: "atingiu" | "andamento" | "abaixo" | "—" | string
  qtd_pis?: number
}

type TopItem = {
  total: number
  qtd_pis: number
  anunciante?: string
  agencia?: string
  campanha?: string
  canal?: string
  tipo_pi?: string
}

type PainelOut = {
  mes: number | null
  ano: number | null
  total_vendido: number
  qtd_pis: number
  ticket_medio: number
  qtd_anunciantes: number
  qtd_agencias: number
  total_metas: number
  pct_medio: number
  ranking: PainelLinha[]
  por_diretoria: { diretoria: string; total: number; qtd_pis: number }[]
  top_anunciantes: TopItem[]
  top_agencias: TopItem[]
  top_campanhas: TopItem[]
  top_canais: TopItem[]
  top_tipos_pi: TopItem[]
}

type DetalheItem = {
  id: number
  numero_pi: string
  tipo_pi: string
  eh_matriz: boolean
  nome_anunciante?: string | null
  diretoria?: string | null
  valor_bruto: number
  valor_liquido: number
  data_emissao?: string | null
}

type DetalheOut = {
  executivo: string
  mes: number | null
  ano: number | null
  total_vendido: number
  itens: DetalheItem[]
}

// /executivos pode devolver [{nome:"..."}, ...] ou ["..."]
type ExecOption = { value: string; label: string }

// /me (ajuste conforme seu backend devolve)
type MeOut = {
  email?: string
  role?: string
  nome?: string
  executivo?: string
}

function fmtBRL(v: number) {
  try {
    return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  } catch {
    return `R$ ${v}`
  }
}

function badgeClass(status: string) {
  const s = (status || "").toLowerCase()
  if (s === "atingiu") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
  if (s === "andamento") return "border-amber-500/40 bg-amber-500/15 text-amber-200"
  if (s === "abaixo") return "border-rose-500/40 bg-rose-500/15 text-rose-200"
  return "border-zinc-700 bg-zinc-900/40 text-zinc-200"
}

function cardShell() {
  return "rounded-2xl border border-zinc-800 bg-zinc-950/70 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
}

function labelFromTopItem(it: TopItem) {
  return it.anunciante || it.agencia || it.campanha || it.canal || it.tipo_pi || "N/A"
}

function norm(v?: string | null) {
  return String(v || "").toLowerCase().trim()
}

export default function Vendas() {
  const now = new Date()
  const [mes, setMes] = useState<number>(now.getMonth() + 1)
  const [ano, setAno] = useState<number>(now.getFullYear())

  const [executivo, setExecutivo] = useState<string>("")
  const [diretoria, setDiretoria] = useState<string>("")
  const [tipoPI, setTipoPI] = useState<string>("")

  const [view, setView] = useState<"cards" | "tabela">("cards")

  const [loading, setLoading] = useState(false)
  const [painel, setPainel] = useState<PainelOut | null>(null)

  const [selectedExec, setSelectedExec] = useState<string>("")
  const [detalhe, setDetalhe] = useState<DetalheOut | null>(null)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)

  const [execOptions, setExecOptions] = useState<ExecOption[]>([])
  const [loadingExecs, setLoadingExecs] = useState(false)

  // Auth gate
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Meta modal
  const [metaOpen, setMetaOpen] = useState(false)
  const [metaEscopo, setMetaEscopo] = useState<"EXECUTIVO" | "DIRETORIA">("EXECUTIVO")
  const [metaChave, setMetaChave] = useState<string>("")
  const [metaValor, setMetaValor] = useState<number>(0)
  const [savingMeta, setSavingMeta] = useState(false)

  const diretoriasOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of painel?.ranking || []) {
      if (r.diretoria) set.add(String(r.diretoria))
    }
    return ["", ...Array.from(set).sort()]
  }, [painel])

  const tipoOptions = useMemo(() => {
    return ["", "Normal", "Matriz", "CS", "Abatimento", "Veiculação"]
  }, [])

  const qPainel = useMemo(() => {
    const qs = new URLSearchParams()
    qs.set("mes", String(mes))
    qs.set("ano", String(ano))
    if (executivo.trim()) qs.set("executivo", executivo.trim())
    if (diretoria.trim()) qs.set("diretoria", diretoria.trim())
    if (tipoPI.trim()) qs.set("tipo_pi", tipoPI.trim())
    qs.set("top_n", "10")
    return `?${qs.toString()}`
  }, [mes, ano, executivo, diretoria, tipoPI])

  async function checarAdmin() {
    setCheckingAuth(true)
    try {
      const me = await apiGet<MeOut>("/me")
      const role = norm(me?.role)
      setIsAdmin(role === "admin")
    } catch {
      setIsAdmin(false)
    } finally {
      setCheckingAuth(false)
    }
  }

  async function carregarExecutivos() {
    setLoadingExecs(true)
    try {
      const data: any = await apiGet<any>("/executivos")

      let list: string[] = []
      if (Array.isArray(data)) {
        if (data.length && typeof data[0] === "string") {
          list = data as string[]
        } else {
          list = (data as any[])
            .map(x => x?.nome ?? x?.executivo ?? x?.name ?? x?.email ?? "")
            .filter(Boolean)
        }
      } else if (data?.items && Array.isArray(data.items)) {
        list = data.items
          .map((x: any) => x?.nome ?? x?.executivo ?? x?.name ?? "")
          .filter(Boolean)
      }

      const opts = Array.from(new Set(list.map(s => String(s).trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map(v => ({ value: v, label: v }))

      setExecOptions([{ value: "", label: "Todos" }, ...opts])
    } catch {
      setExecOptions([{ value: "", label: "Todos" }])
    } finally {
      setLoadingExecs(false)
    }
  }

  async function carregarPainel() {
    // Gate hard: não chama API se não for admin
    if (!isAdmin) return

    setLoading(true)
    setPainel(null)
    setSelectedExec("")
    setDetalhe(null)

    try {
      const data = await apiGet<PainelOut>(`/vendas/resumo${qPainel}`)
      setPainel(data)
    } catch (e: any) {
      // Se for 403, não alerta como "erro", é esperado para não-admin (mas aqui já gateamos)
      const msg = String(e?.message || e || "")
      if (!msg.includes("403")) {
        alert(`Falha ao carregar resumo: ${e?.message || e}`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function carregarDetalhe(execName: string) {
    if (!execName) return
    if (!isAdmin) return

    setSelectedExec(execName)
    setDetalhe(null)
    setLoadingDetalhe(true)

    try {
      const qs = new URLSearchParams()
      qs.set("mes", String(mes))
      qs.set("ano", String(ano))
      qs.set("executivo", execName)
      if (tipoPI.trim()) qs.set("tipo_pi", tipoPI.trim())

      const data = await apiGet<DetalheOut>(`/vendas/executivo/pis?${qs.toString()}`)
      setDetalhe(data)
    } catch (e: any) {
      const msg = String(e?.message || e || "")
      if (!msg.includes("403")) {
        alert(`Falha ao carregar PIs do executivo: ${e?.message || e}`)
      }
    } finally {
      setLoadingDetalhe(false)
    }
  }

  function limparFiltros() {
    setExecutivo("")
    setDiretoria("")
    setTipoPI("")
  }

  function abrirMeta() {
    setMetaEscopo("EXECUTIVO")
    setMetaChave(executivo.trim() || "")
    setMetaValor(0)
    setMetaOpen(true)
  }

  async function salvarMeta() {
    if (!isAdmin) return

    if (!metaChave.trim()) {
      alert("Selecione um nome para a meta (executivo/diretoria).")
      return
    }
    setSavingMeta(true)
    try {
      const payload = {
        mes,
        ano,
        escopo: metaEscopo,
        chave: metaChave.trim(),
        valor_meta: Number(metaValor || 0),
      }
      const resp: any = await apiPost("/vendas/metas", payload)
      if (!resp?.ok) {
        alert(resp?.error || "Falha ao salvar meta.")
        return
      }
      setMetaOpen(false)
      await carregarPainel()
    } catch (e: any) {
      alert(`Falha ao salvar meta: ${e?.message || e}`)
    } finally {
      setSavingMeta(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      await checarAdmin()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // só carrega dados se for admin
    if (!checkingAuth && isAdmin) {
      carregarExecutivos()
      carregarPainel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth, isAdmin])

  const metaOptions = useMemo(() => {
    if (metaEscopo === "EXECUTIVO") {
      return execOptions.filter(o => o.value !== "").map(o => o.value)
    }
    return diretoriasOptions.filter(v => v)
  }, [metaEscopo, execOptions, diretoriasOptions])

  // ========= UI: Bloqueio elegante =========
  if (checkingAuth) {
    return (
      <div className="p-6 text-zinc-100">
        <div className={cardShell() + " p-6"}>
          <div className="text-sm text-zinc-400">Verificando permissões...</div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-zinc-100">
        <div className={cardShell() + " p-6"}>
          <h1 className="text-xl font-bold">Vendas</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Acesso restrito. Esta página é exclusiva para administradores.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 text-zinc-100">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendas • Painel da Empresa</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Visão geral do período: ranking, top anunciantes/agências e detalhe por PI.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={abrirMeta}
            className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950/70 hover:bg-zinc-900 text-sm font-semibold"
          >
            Definir meta
          </button>

          <button
            onClick={() => setView("cards")}
            className={[
              "px-3 py-2 rounded-xl border text-sm font-semibold",
              view === "cards" ? "border-zinc-300 bg-zinc-800" : "border-zinc-800 bg-zinc-950/70",
            ].join(" ")}
          >
            Cards
          </button>
          <button
            onClick={() => setView("tabela")}
            className={[
              "px-3 py-2 rounded-xl border text-sm font-semibold",
              view === "tabela" ? "border-zinc-300 bg-zinc-800" : "border-zinc-800 bg-zinc-950/70",
            ].join(" ")}
          >
            Tabela
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className={"mt-5 " + cardShell()}>
        <div className="p-4 md:p-5 border-b border-zinc-800">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-semibold">Filtros</div>
            <div className="flex items-center gap-2">
              <button
                onClick={limparFiltros}
                className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950/70 hover:bg-zinc-900 text-sm"
              >
                Limpar
              </button>
              <button
                onClick={carregarPainel}
                className="px-4 py-2 rounded-xl bg-white text-zinc-900 font-semibold hover:bg-zinc-100 text-sm"
              >
                Aplicar
              </button>
            </div>
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            Dica: clique em um executivo no ranking para abrir o detalhe por PI.
          </div>
        </div>

        <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Período */}
          <div className="md:col-span-3">
            <label className="text-xs text-zinc-400">Mês</label>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2"
            >
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-xs text-zinc-400">Ano</label>
            <input
              type="number"
              min={2000}
              max={2100}
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2"
            />
          </div>

          {/* Executivo */}
          <div className="md:col-span-6">
            <label className="text-xs text-zinc-400">
              Executivo {loadingExecs ? "(carregando...)" : ""}
            </label>

            {execOptions.length > 1 ? (
              <select
                value={executivo}
                onChange={e => setExecutivo(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2"
              >
                {execOptions.map(opt => (
                  <option key={opt.value || "__all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={executivo}
                onChange={e => setExecutivo(e.target.value)}
                placeholder="Filtrar executivo"
                className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2"
              />
            )}
          </div>

          {/* Diretoria */}
          <div className="md:col-span-6">
            <label className="text-xs text-zinc-400">Diretoria</label>
            {diretoriasOptions.length > 1 ? (
              <select
                value={diretoria}
                onChange={e => setDiretoria(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2"
              >
                <option value="">Todas</option>
                {diretoriasOptions
                  .filter(v => v)
                  .map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                value={diretoria}
                onChange={e => setDiretoria(e.target.value)}
                placeholder="Diretoria"
                className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2"
              />
            )}
          </div>

          {/* Tipo PI */}
          <div className="md:col-span-6">
            <label className="text-xs text-zinc-400">Tipo de PI</label>
            <select
              value={tipoPI}
              onChange={e => setTipoPI(e.target.value)}
              className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2"
            >
              <option value="">Todos</option>
              {tipoOptions
                .filter(v => v)
                .map(v => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className={cardShell() + " p-5"}>
          <div className="text-xs text-zinc-400">Total vendido (líquido)</div>
          <div className="text-2xl font-bold mt-1">{fmtBRL(painel?.total_vendido || 0)}</div>
          <div className="text-xs text-zinc-500 mt-2">
            PIs: {painel?.qtd_pis ?? 0} • Ticket: {fmtBRL(painel?.ticket_medio || 0)}
          </div>
        </div>

        <div className={cardShell() + " p-5"}>
          <div className="text-xs text-zinc-400">Anunciantes / Agências</div>
          <div className="text-2xl font-bold mt-1">
            {painel?.qtd_anunciantes ?? 0} / {painel?.qtd_agencias ?? 0}
          </div>
          <div className="text-xs text-zinc-500 mt-2">Únicos no período</div>
        </div>

        <div className={cardShell() + " p-5"}>
          <div className="text-xs text-zinc-400">Total metas</div>
          <div className="text-2xl font-bold mt-1">{fmtBRL(painel?.total_metas || 0)}</div>
          <div className="text-xs text-zinc-500 mt-2">Metas por executivo/diretoria</div>
        </div>

        <div className={cardShell() + " p-5"}>
          <div className="text-xs text-zinc-400">% médio atingido</div>
          <div className="text-2xl font-bold mt-1">{(painel?.pct_medio || 0).toFixed(2)}%</div>
          <div className="text-xs text-zinc-500 mt-2">Apenas onde há meta</div>
        </div>
      </div>

      {/* TOPs */}
      {painel && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            { title: "Top Anunciantes", items: painel.top_anunciantes },
            { title: "Top Agências", items: painel.top_agencias },
            { title: "Top Campanhas", items: painel.top_campanhas },
            { title: "Top Canais", items: painel.top_canais },
            { title: "Top Tipos PI", items: painel.top_tipos_pi },
          ].map(box => (
            <div key={box.title} className={cardShell() + " p-4"}>
              <div className="font-semibold text-sm">{box.title}</div>
              <div className="mt-3 space-y-2">
                {(box.items || []).slice(0, 8).map((it, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-3">
                    <div className="text-xs text-zinc-200 truncate max-w-[160px]">
                      {idx + 1}. {labelFromTopItem(it)}
                    </div>
                    <div className="text-xs text-zinc-400">{fmtBRL(it.total)}</div>
                  </div>
                ))}
                {(!box.items || box.items.length === 0) && (
                  <div className="text-xs text-zinc-500">Sem dados.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ranking */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ranking por Executivo</h2>
          {loading && <span className="text-sm text-zinc-400">Carregando...</span>}
        </div>

        {!painel && !loading && <div className="mt-3 text-sm text-zinc-400">Sem dados.</div>}

        {painel && view === "cards" && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {painel.ranking.map(r => (
              <button
                key={`${r.executivo}-${r.diretoria || ""}`}
                onClick={() => carregarDetalhe(r.executivo)}
                className={[
                  "text-left p-5 rounded-2xl border transition",
                  "bg-zinc-950/70 hover:bg-zinc-900",
                  selectedExec === r.executivo ? "border-zinc-200" : "border-zinc-800",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold truncate">{r.executivo}</div>
                  <span className={["text-xs px-2 py-1 rounded-full border", badgeClass(r.status)].join(" ")}>
                    {r.status}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 mt-1">{r.diretoria || "—"}</div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-zinc-500">Vendido</div>
                    <div className="font-semibold">{fmtBRL(r.vendido_liquido)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Meta</div>
                    <div className="font-semibold">{fmtBRL(r.meta)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">% atingido</div>
                    <div className="font-semibold">{r.pct_atingido.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Restante</div>
                    <div className="font-semibold">{fmtBRL(r.restante)}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {painel && view === "tabela" && (
          <div className={"mt-3 overflow-auto " + cardShell()}>
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-zinc-950/80">
                <tr className="text-zinc-300">
                  <th className="p-4 text-left">Executivo</th>
                  <th className="p-4 text-left">Diretoria</th>
                  <th className="p-4 text-right">Vendido</th>
                  <th className="p-4 text-right">Meta</th>
                  <th className="p-4 text-right">% Atingido</th>
                  <th className="p-4 text-right">Restante</th>
                  <th className="p-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {painel.ranking.map(r => (
                  <tr
                    key={`${r.executivo}-${r.diretoria || ""}`}
                    className={[
                      "border-t border-zinc-800 hover:bg-zinc-900/60 cursor-pointer",
                      selectedExec === r.executivo ? "bg-zinc-900/40" : "",
                    ].join(" ")}
                    onClick={() => carregarDetalhe(r.executivo)}
                  >
                    <td className="p-4">{r.executivo}</td>
                    <td className="p-4">{r.diretoria || "—"}</td>
                    <td className="p-4 text-right">{fmtBRL(r.vendido_liquido)}</td>
                    <td className="p-4 text-right">{fmtBRL(r.meta)}</td>
                    <td className="p-4 text-right">{r.pct_atingido.toFixed(2)}%</td>
                    <td className="p-4 text-right">{fmtBRL(r.restante)}</td>
                    <td className="p-4">
                      <span className={["text-xs px-2 py-1 rounded-full border", badgeClass(r.status)].join(" ")}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detalhe */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Detalhe por PI</h2>
        <p className="text-sm text-zinc-400 mt-1">Selecionado: {selectedExec ? selectedExec : "nenhum"}</p>

        {loadingDetalhe && <div className="mt-3 text-sm text-zinc-400">Carregando PIs...</div>}

        {!loadingDetalhe && selectedExec && !detalhe && (
          <div className="mt-3 text-sm text-zinc-400">Sem detalhe carregado ainda.</div>
        )}

        {detalhe && (
          <div className="mt-3 space-y-3">
            <div className={cardShell() + " p-5 flex items-center justify-between flex-wrap gap-3"}>
              <div>
                <div className="text-xs text-zinc-500">Executivo</div>
                <div className="text-lg font-semibold">{detalhe.executivo}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  Período: {String(detalhe.mes ?? mes).padStart(2, "0")}/{detalhe.ano ?? ano}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-zinc-500">Total vendido (líquido)</div>
                <div className="text-xl font-bold">{fmtBRL(detalhe.total_vendido)}</div>
              </div>
            </div>

            <div className={cardShell() + " overflow-auto"}>
              <table className="min-w-[1150px] w-full text-sm">
                <thead className="bg-zinc-950/80">
                  <tr className="text-zinc-300">
                    <th className="p-4 text-left">PI</th>
                    <th className="p-4 text-left">Tipo</th>
                    <th className="p-4 text-left">Matriz?</th>
                    <th className="p-4 text-left">Anunciante</th>
                    <th className="p-4 text-left">Diretoria</th>
                    <th className="p-4 text-right">Bruto</th>
                    <th className="p-4 text-right">Líquido</th>
                    <th className="p-4 text-left">Emissão</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhe.itens.map(it => (
                    <tr key={it.id} className="border-t border-zinc-800 hover:bg-zinc-900/60">
                      <td className="p-4">{it.numero_pi}</td>
                      <td className="p-4">{it.tipo_pi}</td>
                      <td className="p-4">{it.eh_matriz ? "Sim" : "Não"}</td>
                      <td className="p-4">{it.nome_anunciante || "—"}</td>
                      <td className="p-4">{it.diretoria || "—"}</td>
                      <td className="p-4 text-right">{fmtBRL(it.valor_bruto)}</td>
                      <td className="p-4 text-right">{fmtBRL(it.valor_liquido)}</td>
                      <td className="p-4">{it.data_emissao || "—"}</td>
                    </tr>
                  ))}

                  {detalhe.itens.length === 0 && (
                    <tr>
                      <td className="p-4 text-zinc-400" colSpan={8}>
                        Nenhum PI encontrado para este executivo no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Meta */}
      {metaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={cardShell() + " w-full max-w-lg"}>
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div className="font-semibold">Definir meta</div>
              <button
                onClick={() => setMetaOpen(false)}
                className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950/70 hover:bg-zinc-900 text-sm"
              >
                Fechar
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-zinc-400">Escopo</label>
                <select
                  value={metaEscopo}
                  onChange={e => {
                    const v = e.target.value === "DIRETORIA" ? "DIRETORIA" : "EXECUTIVO"
                    setMetaEscopo(v)
                    setMetaChave("")
                  }}
                  className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2"
                >
                  <option value="EXECUTIVO">Executivo</option>
                  <option value="DIRETORIA">Diretoria</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400">
                  {metaEscopo === "EXECUTIVO" ? "Executivo" : "Diretoria"}
                </label>
                <select
                  value={metaChave}
                  onChange={e => setMetaChave(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2"
                >
                  <option value="">Selecione</option>
                  {metaOptions.map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400">Valor da meta (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={metaValor}
                  onChange={e => setMetaValor(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setMetaOpen(false)}
                  className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950/70 hover:bg-zinc-900 text-sm"
                >
                  Cancelar
                </button>
                <button
                  disabled={savingMeta}
                  onClick={salvarMeta}
                  className="px-4 py-2 rounded-xl bg-white text-zinc-900 font-semibold hover:bg-zinc-100 text-sm disabled:opacity-60"
                >
                  {savingMeta ? "Salvando..." : "Salvar meta"}
                </button>
              </div>

              <div className="text-xs text-zinc-500">
                Período da meta: {String(mes).padStart(2, "0")}/{ano}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
