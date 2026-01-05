// src/pages/Matrizes.tsx
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { apiGet } from "../services/api"

type PIMatriz = {
  numero_pi: string
  nome_campanha?: string | null
  valor_bruto?: number | null
  executivo?: string | null
  diretoria?: string | null
  saldo_restante?: number | null // pode vir pronto da API (ou não)
}

type Abatimento = {
  id: number
  numero_pi: string
  valor_bruto?: number | null
  data_emissao?: string | null
  observacoes?: string | null
}

function currencyBRL(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—"
  try {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  } catch {
    return String(v)
  }
}

function parseISODateToBR(s?: string | null) {
  if (!s) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  return s
}

export default function Matrizes() {
  const [dados, setDados] = useState<PIMatriz[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // filtros
  const [busca, setBusca] = useState("")
  const [diretoria, setDiretoria] = useState<string>("")
  const [executivo, setExecutivo] = useState<string>("")

  // quando a API não manda saldo, buscamos individualmente
  const [saldoMap, setSaldoMap] = useState<Record<string, number>>({})

  // detalhes (drawer)
  const [detOpen, setDetOpen] = useState(false)
  const [detPI, setDetPI] = useState<PIMatriz | null>(null)
  const [detLoading, setDetLoading] = useState(false)
  const [detSaldo, setDetSaldo] = useState<number | null>(null)
  const [detAbats, setDetAbats] = useState<Abatimento[] | null>(null)

  // carrega TODAS as matrizes
  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      // 1) tenta endpoint direto /matrizes
      let res: PIMatriz[] | null = null
      try {
        res = await apiGet<PIMatriz[]>("/matrizes")
      } catch {
        // 2) fallback: /pis/matriz/ativos
        const simples = await apiGet<
          { numero_pi: string; nome_campanha?: string | null }[]
        >("/pis/matriz/ativos")
        res = (Array.isArray(simples) ? simples : []).map((s) => ({
          numero_pi: s.numero_pi,
          nome_campanha: s.nome_campanha ?? null,
        }))
      }

      setDados(Array.isArray(res) ? res : [])
      setSaldoMap({})
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar matrizes.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // completar saldos quando não vierem prontos
  useEffect(() => {
    const semSaldo = dados.filter((d) => d.saldo_restante == null)
    if (!semSaldo.length) return

    let cancelled = false

    ;(async () => {
      for (const item of semSaldo) {
        const num = item.numero_pi
        if (!num) continue
        if (saldoMap[num] != null) continue

        try {
          // seu router: GET /pis/{numero_pi}/saldo
          const r = await apiGet<{ saldo_restante: number }>(
            `/pis/${encodeURIComponent(num)}/saldo`
          )
          if (cancelled) return

          const s =
            typeof (r as any)?.saldo_restante === "number"
              ? (r as any).saldo_restante
              : 0

          setSaldoMap((prev) => ({ ...prev, [num]: s }))
        } catch {
          // silencioso
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados])

  // listas derivadas para filtros
  const executivos = useMemo(() => {
    const set = new Set(
      dados.map((d) => (d.executivo || "").trim()).filter(Boolean)
    )
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [dados])

  const diretorias = useMemo(() => {
    const set = new Set(
      dados.map((d) => (d.diretoria || "").trim()).filter(Boolean)
    )
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [dados])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let base = dados.map((d) => ({
      ...d,
      _saldo: d.saldo_restante ?? saldoMap[d.numero_pi] ?? null,
    }))

    if (q) {
      base = base.filter(
        (d) =>
          d.numero_pi.toLowerCase().includes(q) ||
          (d.nome_campanha || "").toLowerCase().includes(q) ||
          (d.executivo || "").toLowerCase().includes(q)
      )
    }
    if (executivo) {
      base = base.filter((d) => (d.executivo || "") === executivo)
    }
    if (diretoria) {
      base = base.filter((d) => (d.diretoria || "") === diretoria)
    }

    // ordenação fixa: maior saldo primeiro, depois número desc
    base.sort((a: any, b: any) => {
      const sa = a._saldo ?? -Infinity
      const sb = b._saldo ?? -Infinity
      if (sb !== sa) return sb - sa
      return String(b.numero_pi).localeCompare(String(a.numero_pi))
    })

    return base
  }, [dados, busca, executivo, diretoria, saldoMap])

  // -------- Drawer de Detalhes --------
  async function abrirDetalhes(pi: PIMatriz) {
    setDetOpen(true)
    setDetPI(pi)
    setDetSaldo(null)
    setDetAbats(null)
    setDetLoading(true)

    try {
      // saldo – rota do seu router
      try {
        const r = await apiGet<{ saldo_restante: number }>(
          `/pis/${encodeURIComponent(pi.numero_pi)}/saldo`
        )
        setDetSaldo(typeof (r as any)?.saldo_restante === "number" ? (r as any).saldo_restante : null)
      } catch {
        setDetSaldo(null)
      }

      // abatimentos – tenta rota; se não existir, apenas oculta a lista
      try {
        const ab = await apiGet<Abatimento[]>(
          `/matrizes/${encodeURIComponent(pi.numero_pi)}/abatimentos`
        )
        setDetAbats(Array.isArray(ab) ? ab : [])
      } catch {
        setDetAbats(null)
      }
    } finally {
      setDetLoading(false)
    }
  }

  function fecharDetalhes() {
    setDetOpen(false)
    setDetPI(null)
    setDetSaldo(null)
    setDetAbats(null)
    setDetLoading(false)
  }

  return (
    <div className="space-y-8">
      {/* Título + ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">
          Matrizes &amp; Saldos
        </h1>
        <div className="flex items-center gap-3">
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xl font-semibold text-slate-800 mb-2">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Número do PI, campanha ou executivo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">
              Executivo
            </label>
            <select
              value={executivo}
              onChange={(e) => setExecutivo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Todos</option>
              {executivos.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">
              Diretoria
            </label>
            <select
              value={diretoria}
              onChange={(e) => setDiretoria(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Todas</option>
              {diretorias.map((dr) => (
                <option key={dr} value={dr}>
                  {dr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Lista */}
      <section>
        {loading && (
          <div className="text-slate-600 text-lg">Carregando matrizes…</div>
        )}
        {erro && <div className="text-red-700 text-lg">{erro}</div>}

        {!loading && !erro && (
          <>
            {lista.length === 0 ? (
              <div className="text-slate-600 text-lg">
                Nenhum matriz encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
                {lista.map((pi: any) => {
                  const saldo =
                    pi.saldo_restante ?? (saldoMap[pi.numero_pi] ?? null)

                  return (
                    <div
                      key={pi.numero_pi}
                      className="rounded-3xl border border-red-200 bg-white shadow-sm hover:shadow-md transition p-6"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">
                            PI MATRIZ
                          </div>
                          <div className="mt-1 text-3xl font-extrabold text-slate-900">
                            {pi.numero_pi}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-500">Saldo</div>
                          <div className="text-3xl font-black text-red-700">
                            {currencyBRL(saldo)}
                          </div>
                        </div>
                      </div>

                      {pi.nome_campanha && (
                        <div className="mt-3 text-xl text-slate-800">
                          {pi.nome_campanha}
                        </div>
                      )}

                      <div className="mt-2 text-base text-slate-700">
                        {pi.executivo ? (
                          <span>
                            Executivo:{" "}
                            <strong className="text-slate-900">
                              {pi.executivo}
                            </strong>
                          </span>
                        ) : null}
                        {pi.diretoria ? (
                          <span className="ml-4">
                            Diretoria:{" "}
                            <strong className="text-slate-900">
                              {pi.diretoria}
                            </strong>
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Link
                          to={`/pis/cadastro?tipo=Abatimento&numero_pi_matriz=${encodeURIComponent(
                            pi.numero_pi
                          )}`}
                          className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition"
                        >
                          Criar Abatimento
                        </Link>
                        <button
                          onClick={() => abrirDetalhes(pi)}
                          className="px-5 py-3 rounded-2xl border border-slate-300 text-slate-700 text-lg hover:bg-slate-50"
                          title="Ver detalhes"
                        >
                          🔎 Detalhes
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* Drawer de Detalhes */}
      {detOpen && detPI && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={fecharDetalhes}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">
                    Detalhe da Matriz
                  </div>
                  <div className="mt-1 text-3xl font-extrabold text-slate-900">
                    <span className="font-mono">{detPI.numero_pi}</span>
                  </div>
                  {detPI.nome_campanha && (
                    <div className="mt-1 text-slate-700">
                      {detPI.nome_campanha}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(detPI.numero_pi)
                        .catch(() => {})
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Copiar PI
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
              {/* Resumo */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Saldo</div>
                  <div className="text-2xl font-black text-red-700">
                    {detLoading ? "Carregando…" : currencyBRL(detSaldo)}
                  </div>
                </div>

                {typeof detPI.valor_bruto === "number" && (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-sm text-slate-500">
                      Valor Bruto da Matriz
                    </div>
                    <div className="text-2xl font-semibold">
                      {currencyBRL(detPI.valor_bruto)}
                    </div>
                  </div>
                )}
              </section>

              {/* Abatimentos (se a rota existir) */}
              {detAbats !== null && (
                <section className="space-y-4">
                  <div className="rounded-2xl border border-slate-200">
                    <div className="px-4 py-3 border-b bg-slate-50 font-semibold flex items-center justify-between">
                      <span>Abatimentos</span>
                      <Link
                        to={`/pis/cadastro?tipo=Abatimento&numero_pi_matriz=${encodeURIComponent(
                          detPI.numero_pi
                        )}`}
                        className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                      >
                        + Novo Abatimento
                      </Link>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-red-600/90 text-white">
                            {["PI", "Valor", "Emissão", "Obs."].map((h) => (
                              <th
                                key={h}
                                className="px-4 py-2 text-left text-sm font-semibold"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {detLoading ? (
                            <tr>
                              <td
                                className="px-4 py-3 text-slate-600"
                                colSpan={4}
                              >
                                Carregando…
                              </td>
                            </tr>
                          ) : detAbats.length === 0 ? (
                            <tr>
                              <td
                                className="px-4 py-3 text-slate-600"
                                colSpan={4}
                              >
                                Nenhum abatimento.
                              </td>
                            </tr>
                          ) : (
                            detAbats.map((f) => (
                              <tr
                                key={f.id}
                                className="border-b last:border-none"
                              >
                                <td className="px-4 py-2 font-mono">
                                  {f.numero_pi}
                                </td>
                                <td className="px-4 py-2">
                                  {currencyBRL(f.valor_bruto ?? null)}
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  {parseISODateToBR(f.data_emissao) || "—"}
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  {f.observacoes || "—"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {/* CTA */}
              <div>
                <Link
                  to={`/pis/cadastro?tipo=Abatimento&numero_pi_matriz=${encodeURIComponent(
                    detPI.numero_pi
                  )}`}
                  className="inline-block px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition"
                >
                  Criar Abatimento
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
