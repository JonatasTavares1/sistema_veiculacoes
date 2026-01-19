// C:\Users\danie\sistema_veiculacoes\frontend\src\pages\MeuPerfilExecutivo.tsx
import { useEffect, useMemo, useState } from "react"
import { getUser } from "../services/auth"
import { apiGet } from "../services/api"

type CarteiraResp = {
  executivo: string
  mes: number
  ano: number
  kpis: { total_pis: number; valor_bruto: number; valor_liquido: number }
  top_anunciantes: { label: string; valor: number }[]
  top_agencias: { label: string; valor: number }[]
  pis: {
    id: number
    numero_pi: string
    tipo_pi: string
    nome_anunciante?: string | null
    nome_agencia?: string | null
    valor_liquido?: number | null
    data_emissao?: string | null
  }[]
}

type MeExecutivoResp = {
  executivo: string
  carteira: { agencias: number; anunciantes: number }
  email?: string
  ativo?: boolean
}

type CarteiraListResp = {
  executivo: string
  total: number
  limit: number
  offset: number
  items: {
    id: number
    nome: string
    cnpj?: string | null
    uf?: string | null
    executivo?: string | null
  }[]
}

type ViewMode = "pis" | "top_agencias" | "top_anunciantes" | "carteira_agencias" | "carteira_anunciantes"

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ")
}

function moeda(v: number) {
  const n = Number(v || 0)
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
  } catch {
    return `R$ ${n.toFixed(2)}`
  }
}

function normStr(v?: string | null) {
  return (v || "").toString().trim()
}

function badgeTipo(tipo?: string | null) {
  const t = (tipo || "").toLowerCase()
  if (t.includes("matriz")) return "bg-red-500/15 text-red-200 border-red-500/25"
  if (t.includes("cs")) return "bg-amber-500/15 text-amber-200 border-amber-500/25"
  if (t.includes("abat")) return "bg-purple-500/15 text-purple-200 border-purple-500/25"
  return "bg-zinc-500/15 text-zinc-200 border-zinc-500/25"
}

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const a = parts[0]?.[0] || ""
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (a + b).toUpperCase() || "?"
}

function safeMonth(m: number) {
  const mm = Math.min(12, Math.max(1, Number(m || 1)))
  return mm
}

function safeYear(y: number) {
  const yy = Math.min(2100, Math.max(2000, Number(y || new Date().getFullYear())))
  return yy
}

function CarteiraListTable(props: {
  title: string
  subtitle: string
  data: CarteiraListResp | null
  loading: boolean
  offset: number
  limit: number
  onPrev: () => void
  onNext: () => void
}) {
  const { title, subtitle, data, loading, offset, limit, onPrev, onNext } = props

  const total = data?.total ?? 0
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + (data?.items?.length || 0), total)
  const canPrev = offset > 0
  const canNext = offset + limit < total

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="p-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-lg font-bold text-zinc-100">{title}</div>
          <div className="text-sm text-zinc-500">{subtitle}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-zinc-400">
            {total > 0 ? (
              <>
                Mostrando <span className="font-semibold text-zinc-200">{from}</span>–
                <span className="font-semibold text-zinc-200">{to}</span> de{" "}
                <span className="font-semibold text-zinc-200">{total}</span>
              </>
            ) : (
              "Sem registros."
            )}
          </div>

          <button
            onClick={onPrev}
            disabled={!canPrev || loading}
            className={cx(
              "rounded-2xl border px-3 py-2 text-sm font-semibold transition outline-none focus:ring-2 focus:ring-red-500/35",
              canPrev && !loading
                ? "border-zinc-800 bg-zinc-950/35 text-zinc-100 hover:bg-zinc-950/55"
                : "border-zinc-900 bg-zinc-950/15 text-zinc-500 cursor-not-allowed"
            )}
            title="Página anterior"
          >
            ←
          </button>

          <button
            onClick={onNext}
            disabled={!canNext || loading}
            className={cx(
              "rounded-2xl border px-3 py-2 text-sm font-semibold transition outline-none focus:ring-2 focus:ring-red-500/35",
              canNext && !loading
                ? "border-zinc-800 bg-zinc-950/35 text-zinc-100 hover:bg-zinc-950/55"
                : "border-zinc-900 bg-zinc-950/15 text-zinc-500 cursor-not-allowed"
            )}
            title="Próxima página"
          >
            →
          </button>
        </div>
      </div>

      <div className="overflow-auto custom-scroll">
        <table className="min-w-full text-sm">
          <thead className="bg-red-600 text-white sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Nome</th>
              <th className="px-4 py-3 text-left font-semibold">CNPJ</th>
              <th className="px-4 py-3 text-left font-semibold">UF</th>
            </tr>
          </thead>
          <tbody>
            {!data || data.items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={3}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              data.items.map((it) => (
                <tr key={it.id} className="border-t border-zinc-800 hover:bg-zinc-950/25 transition">
                  <td className="px-4 py-3 text-zinc-100 font-semibold">{it.nome || "-"}</td>
                  <td className="px-4 py-3 text-zinc-200 font-mono">{it.cnpj || "-"}</td>
                  <td className="px-4 py-3 text-zinc-200">{it.uf || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-zinc-800/80 bg-zinc-950/20 px-5 py-4">
        <div className="text-xs text-zinc-500">Dica: use a busca para localizar rapidamente por nome.</div>
      </div>
    </div>
  )
}

export default function MeuPerfilExecutivo() {
  const me = getUser()

  const now = useMemo(() => new Date(), [])
  const [mes, setMes] = useState<number>(now.getMonth() + 1)
  const [ano, setAno] = useState<number>(now.getFullYear())

  const [resumo, setResumo] = useState<MeExecutivoResp | null>(null)
  const [carteira, setCarteira] = useState<CarteiraResp | null>(null)

  const [view, setView] = useState<ViewMode>("pis")

  // Carteira real (listas)
  const [q, setQ] = useState("")
  const [agencias, setAgencias] = useState<CarteiraListResp | null>(null)
  const [anunciantes, setAnunciantes] = useState<CarteiraListResp | null>(null)
  const [limit, setLimit] = useState(50)
  const [offsetAg, setOffsetAg] = useState(0)
  const [offsetAn, setOffsetAn] = useState(0)

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const tituloPeriodo = useMemo(() => {
    const mm = String(safeMonth(mes)).padStart(2, "0")
    return `${mm}/${safeYear(ano)}`
  }, [mes, ano])

  const topAgencias = useMemo(() => carteira?.top_agencias || [], [carteira])
  const topAnunciantes = useMemo(() => carteira?.top_anunciantes || [], [carteira])
  const listaPIs = useMemo(() => carteira?.pis || [], [carteira])

  const totalTopAgencias = useMemo(() => topAgencias.reduce((acc, x) => acc + Number(x.valor || 0), 0), [topAgencias])
  const totalTopAnunciantes = useMemo(
    () => topAnunciantes.reduce((acc, x) => acc + Number(x.valor || 0), 0),
    [topAnunciantes]
  )

  const execNome = useMemo(() => resumo?.executivo || "", [resumo])
  const execAvatar = useMemo(() => initials(execNome), [execNome])

  const totalCarteiraAg = resumo?.carteira?.agencias ?? 0
  const totalCarteiraAn = resumo?.carteira?.anunciantes ?? 0

  const tabItems = useMemo(
    () => [
      { key: "pis" as const, label: "PIs do período", desc: "Listagem e detalhes" },
      { key: "top_agencias" as const, label: "Top Agências", desc: "Ranking por valor" },
      { key: "top_anunciantes" as const, label: "Top Anunciantes", desc: "Ranking por valor" },
      { key: "carteira_agencias" as const, label: `Carteira Agências (${totalCarteiraAg})`, desc: "Lista completa" },
      {
        key: "carteira_anunciantes" as const,
        label: `Carteira Anunciantes (${totalCarteiraAn})`,
        desc: "Lista completa",
      },
    ],
    [totalCarteiraAg, totalCarteiraAn]
  )

  async function carregarBase() {
    const r1 = await apiGet<MeExecutivoResp>("/me/executivo")
    const r2 = await apiGet<CarteiraResp>(`/me/carteira?mes=${safeMonth(mes)}&ano=${safeYear(ano)}&top_n=10`)
    setResumo(r1)
    setCarteira(r2)
  }

  async function carregarCarteiraAgencias(nextOffset = offsetAg, nextQ = q) {
    const qs = new URLSearchParams()
    if (nextQ?.trim()) qs.set("q", nextQ.trim())
    qs.set("limit", String(limit))
    qs.set("offset", String(nextOffset))
    const r = await apiGet<CarteiraListResp>(`/me/carteira/agencias?${qs.toString()}`)
    setAgencias(r)
  }

  async function carregarCarteiraAnunciantes(nextOffset = offsetAn, nextQ = q) {
    const qs = new URLSearchParams()
    if (nextQ?.trim()) qs.set("q", nextQ.trim())
    qs.set("limit", String(limit))
    qs.set("offset", String(nextOffset))
    const r = await apiGet<CarteiraListResp>(`/me/carteira/anunciantes?${qs.toString()}`)
    setAnunciantes(r)
  }

  async function carregarTudo() {
    setLoading(true)
    setErro(null)
    try {
      await carregarBase()
      if (view === "carteira_agencias") await carregarCarteiraAgencias(offsetAg, q)
      if (view === "carteira_anunciantes") await carregarCarteiraAnunciantes(offsetAn, q)
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar dados.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    setErro(null)
    carregarBase()
      .catch((e: any) => setErro(e?.message || "Erro ao carregar perfil do executivo."))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, ano])

  useEffect(() => {
    if (!me) return

    if (view === "carteira_agencias") {
      setOffsetAg(0)
      setAgencias(null)
      setLoading(true)
      setErro(null)
      carregarCarteiraAgencias(0, q)
        .catch((e: any) => setErro(e?.message || "Erro ao carregar carteira de agências."))
        .finally(() => setLoading(false))
    }

    if (view === "carteira_anunciantes") {
      setOffsetAn(0)
      setAnunciantes(null)
      setLoading(true)
      setErro(null)
      carregarCarteiraAnunciantes(0, q)
        .catch((e: any) => setErro(e?.message || "Erro ao carregar carteira de anunciantes."))
        .finally(() => setLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  if (!me) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-900/60 bg-red-950/35 px-4 py-3 text-red-100">
          Você precisa estar logado.
        </div>
      </div>
    )
  }

  const tabBtnBase =
    "px-4 py-2 rounded-2xl text-sm font-semibold transition outline-none focus:ring-2 focus:ring-red-500/35"
  const tabBtnActive = "bg-red-600 text-white shadow shadow-red-600/20"
  const tabBtnIdle = "bg-zinc-950/30 text-zinc-200 hover:bg-zinc-950/45"
  const card = "rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur"
  const inputBase =
    "rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/35"

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className={cx(card, "px-5 py-5")}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-[260px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
              Perfil do Executivo
              <span className="h-1 w-1 rounded-full bg-red-200/80" />
              <span className="text-red-100/80">Período {tituloPeriodo}</span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl border border-zinc-800 bg-zinc-950/50 flex items-center justify-center">
                <span className="text-zinc-100 font-extrabold">{execAvatar}</span>
              </div>

              <div>
                <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight leading-tight">Meu Perfil</h1>
                <p className="text-sm text-zinc-400 mt-0.5">Carteira, visão mensal e desempenho consolidado.</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-3">
                <div className="text-xs text-zinc-500">Executivo</div>
                <div className="text-lg font-bold text-zinc-100">{resumo?.executivo || "-"}</div>
                <div className="text-xs text-zinc-400 mt-1">{me?.email}</div>
              </div>

              <div className="flex gap-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-3">
                  <div className="text-xs text-zinc-500">Agências</div>
                  <div className="text-lg font-extrabold text-zinc-100">{totalCarteiraAg}</div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-3">
                  <div className="text-xs text-zinc-500">Anunciantes</div>
                  <div className="text-lg font-extrabold text-zinc-100">{totalCarteiraAn}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={mes} onChange={(e) => setMes(safeMonth(Number(e.target.value)))} className={inputBase}>
              {Array.from({ length: 12 }).map((_, i) => {
                const v = i + 1
                return (
                  <option key={v} value={v}>
                    Mês {v}
                  </option>
                )
              })}
            </select>

            <input
              value={ano}
              onChange={(e) => setAno(safeYear(Number(e.target.value)))}
              type="number"
              min={2000}
              max={2100}
              className={cx(inputBase, "w-28")}
            />

            <button
              onClick={carregarTudo}
              className="rounded-2xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 active:scale-[0.99] transition outline-none focus:ring-2 focus:ring-red-500/35"
            >
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-400">Carregando...</div>
      ) : erro ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/35 px-4 py-3 text-red-100">{erro}</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className={cx(card, "p-5 hover:bg-zinc-900/55 transition")}>
              <div className="text-sm text-zinc-400">Total de PIs</div>
              <div className="mt-2 text-4xl font-extrabold text-zinc-100">{carteira?.kpis?.total_pis ?? 0}</div>
              <div className="mt-2 text-xs text-zinc-500">Contagem no período selecionado</div>
            </div>

            <div className={cx(card, "p-5 hover:bg-zinc-900/55 transition")}>
              <div className="text-sm text-zinc-400">Valor bruto</div>
              <div className="mt-2 text-3xl font-extrabold text-zinc-100">{moeda(carteira?.kpis?.valor_bruto ?? 0)}</div>
              <div className="mt-2 text-xs text-zinc-500">Soma do bruto no período</div>
            </div>

            <div className={cx(card, "p-5 hover:bg-zinc-900/55 transition")}>
              <div className="text-sm text-zinc-400">Valor líquido</div>
              <div className="mt-2 text-3xl font-extrabold text-zinc-100">
                {moeda(carteira?.kpis?.valor_liquido ?? 0)}
              </div>
              <div className="mt-2 text-xs text-zinc-500">Soma do líquido no período</div>
            </div>
          </div>

          {/* Tabs */}
          <div className={cx(card, "p-2")}>
            <div className="flex flex-wrap gap-2">
              {tabItems.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  className={cx(tabBtnBase, view === t.key ? tabBtnActive : tabBtnIdle)}
                  title={t.desc}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Busca (somente carteiras completas) */}
          {(view === "carteira_agencias" || view === "carteira_anunciantes") && (
            <div className={cx(card, "p-4")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-zinc-100">
                    {view === "carteira_agencias" ? "Carteira de Agências" : "Carteira de Anunciantes"}
                  </div>
                  <div className="text-sm text-zinc-500">Lista completa de atendimento (busca e paginação).</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Buscar por nome..."
                      className={cx(inputBase, "w-[260px] pr-10")}
                    />
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                      ⌕
                    </div>
                  </div>

                  <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={cx(inputBase, "w-[150px]")}>
                    {[25, 50, 100, 150, 200].map((n) => (
                      <option key={n} value={n}>
                        {n} / página
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={async () => {
                      setLoading(true)
                      setErro(null)
                      try {
                        if (view === "carteira_agencias") {
                          setOffsetAg(0)
                          await carregarCarteiraAgencias(0, q)
                        } else {
                          setOffsetAn(0)
                          await carregarCarteiraAnunciantes(0, q)
                        }
                      } catch (e: any) {
                        setErro(e?.message || "Erro ao buscar carteira.")
                      } finally {
                        setLoading(false)
                      }
                    }}
                    className="rounded-2xl bg-zinc-950/40 border border-zinc-800 px-4 py-2.5 text-zinc-100 hover:bg-zinc-950/55 transition outline-none focus:ring-2 focus:ring-red-500/35"
                  >
                    Buscar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Conteúdo */}
          {view === "pis" ? (
            <div className={cx(card, "overflow-hidden")}>
              <div className="p-5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-bold text-zinc-100">PIs do período</div>
                  <div className="text-sm text-zinc-500">Listagem (até 200 registros)</div>
                </div>
                <div className="text-xs text-zinc-400">
                  Exibindo: <span className="font-semibold text-zinc-200">{listaPIs.length}</span>
                </div>
              </div>

              <div className="overflow-auto custom-scroll">
                <table className="min-w-full text-sm">
                  <thead className="bg-red-600 text-white sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">PI</th>
                      <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                      <th className="px-4 py-3 text-left font-semibold">Anunciante</th>
                      <th className="px-4 py-3 text-left font-semibold">Agência</th>
                      <th className="px-4 py-3 text-left font-semibold">Líquido</th>
                      <th className="px-4 py-3 text-left font-semibold">Emissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaPIs.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-zinc-500" colSpan={6}>
                          Nenhum PI encontrado para o período.
                        </td>
                      </tr>
                    ) : (
                      listaPIs.map((p) => (
                        <tr key={p.id} className="border-t border-zinc-800 hover:bg-zinc-950/25 transition">
                          <td className="px-4 py-3 font-mono text-zinc-100">{p.numero_pi}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cx(
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                                badgeTipo(p.tipo_pi)
                              )}
                            >
                              {normStr(p.tipo_pi) || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-200">{p.nome_anunciante || "-"}</td>
                          <td className="px-4 py-3 text-zinc-200">{p.nome_agencia || "-"}</td>
                          <td className="px-4 py-3 text-zinc-100 font-semibold">{moeda(Number(p.valor_liquido || 0))}</td>
                          <td className="px-4 py-3 text-zinc-400">{p.data_emissao || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-zinc-800/80 bg-zinc-950/20 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                  <div>Dica: use as abas “Carteira” para ver a lista completa de atendimento.</div>
                  <div className="text-zinc-400">
                    Período: <span className="font-semibold text-zinc-200">{tituloPeriodo}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : view === "top_agencias" ? (
            <div className={cx(card, "overflow-hidden")}>
              <div className="p-5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-bold text-zinc-100">Top Agências (Top 10)</div>
                  <div className="text-sm text-zinc-500">Ranking por valor no período {tituloPeriodo}</div>
                </div>
                <div className="text-sm text-zinc-300">
                  Total Top: <span className="font-extrabold text-zinc-100">{moeda(totalTopAgencias)}</span>
                </div>
              </div>

              <div className="overflow-auto custom-scroll">
                <table className="min-w-full text-sm">
                  <thead className="bg-red-600 text-white sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">#</th>
                      <th className="px-4 py-3 text-left font-semibold">Agência</th>
                      <th className="px-4 py-3 text-left font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAgencias.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-zinc-500" colSpan={3}>
                          Sem dados de agências no período.
                        </td>
                      </tr>
                    ) : (
                      topAgencias.map((x, idx) => (
                        <tr key={`${x.label}-${idx}`} className="border-t border-zinc-800 hover:bg-zinc-950/25 transition">
                          <td className="px-4 py-3 text-zinc-300 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 text-zinc-100 font-semibold">{x.label}</td>
                          <td className="px-4 py-3 text-zinc-100">{moeda(Number(x.valor || 0))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : view === "top_anunciantes" ? (
            <div className={cx(card, "overflow-hidden")}>
              <div className="p-5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-bold text-zinc-100">Top Anunciantes (Top 10)</div>
                  <div className="text-sm text-zinc-500">Ranking por valor no período {tituloPeriodo}</div>
                </div>
                <div className="text-sm text-zinc-300">
                  Total Top: <span className="font-extrabold text-zinc-100">{moeda(totalTopAnunciantes)}</span>
                </div>
              </div>

              <div className="overflow-auto custom-scroll">
                <table className="min-w-full text-sm">
                  <thead className="bg-red-600 text-white sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">#</th>
                      <th className="px-4 py-3 text-left font-semibold">Anunciante</th>
                      <th className="px-4 py-3 text-left font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAnunciantes.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-zinc-500" colSpan={3}>
                          Sem dados de anunciantes no período.
                        </td>
                      </tr>
                    ) : (
                      topAnunciantes.map((x, idx) => (
                        <tr key={`${x.label}-${idx}`} className="border-t border-zinc-800 hover:bg-zinc-950/25 transition">
                          <td className="px-4 py-3 text-zinc-300 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 text-zinc-100 font-semibold">{x.label}</td>
                          <td className="px-4 py-3 text-zinc-100">{moeda(Number(x.valor || 0))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : view === "carteira_agencias" ? (
            <CarteiraListTable
              title="Carteira de Agências"
              subtitle="Lista completa de agências sob atendimento"
              data={agencias}
              loading={loading}
              offset={offsetAg}
              limit={limit}
              onPrev={async () => {
                const next = Math.max(0, offsetAg - limit)
                setOffsetAg(next)
                setLoading(true)
                setErro(null)
                try {
                  await carregarCarteiraAgencias(next, q)
                } catch (e: any) {
                  setErro(e?.message || "Erro ao paginar.")
                } finally {
                  setLoading(false)
                }
              }}
              onNext={async () => {
                const total = agencias?.total ?? 0
                const next = offsetAg + limit
                if (next >= total) return
                setOffsetAg(next)
                setLoading(true)
                setErro(null)
                try {
                  await carregarCarteiraAgencias(next, q)
                } catch (e: any) {
                  setErro(e?.message || "Erro ao paginar.")
                } finally {
                  setLoading(false)
                }
              }}
            />
          ) : (
            <CarteiraListTable
              title="Carteira de Anunciantes"
              subtitle="Lista completa de anunciantes sob atendimento"
              data={anunciantes}
              loading={loading}
              offset={offsetAn}
              limit={limit}
              onPrev={async () => {
                const next = Math.max(0, offsetAn - limit)
                setOffsetAn(next)
                setLoading(true)
                setErro(null)
                try {
                  await carregarCarteiraAnunciantes(next, q)
                } catch (e: any) {
                  setErro(e?.message || "Erro ao paginar.")
                } finally {
                  setLoading(false)
                }
              }}
              onNext={async () => {
                const total = anunciantes?.total ?? 0
                const next = offsetAn + limit
                if (next >= total) return
                setOffsetAn(next)
                setLoading(true)
                setErro(null)
                try {
                  await carregarCarteiraAnunciantes(next, q)
                } catch (e: any) {
                  setErro(e?.message || "Erro ao paginar.")
                } finally {
                  setLoading(false)
                }
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
