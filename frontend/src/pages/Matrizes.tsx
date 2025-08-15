// src/pages/Matrizes.tsx
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

type PIMatriz = {
  numero_pi: string
  nome_campanha?: string | null
  valor_bruto?: number | null
  executivo?: string | null
  diretoria?: string | null
  saldo_restante?: number | null // pode vir pronto da API (ou não)
}

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

function currencyBRL(v: number | null | undefined) {
  if (v == null) return "—"
  try {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  } catch {
    return String(v)
  }
}

export default function Matrizes() {
  const [dados, setDados] = useState<PIMatriz[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // filtros/controle
  const [busca, setBusca] = useState("")
  const [ordenarPor, setOrdenarPor] = useState<"saldo" | "numero">("saldo")
  const [diretoria, setDiretoria] = useState<string>("")
  const [executivo, setExecutivo] = useState<string>("")

  // quando a API não manda saldo, buscamos individualmente
  const [saldoMap, setSaldoMap] = useState<Record<string, number>>({})

  // carrega TODAS as matrizes
  async function carregar() {
    setLoading(true); setErro(null)
    try {
      // sem "order" pra não depender de implementação do backend
      const res = await getJSON<PIMatriz[]>(`${API}/matrizes`)
      setDados(Array.isArray(res) ? res : [])
      setSaldoMap({})
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar matrizes.")
    } finally {
      setLoading(false)
    }
  }

  // carrega ao montar
  useEffect(() => { carregar() }, [])

  // completar saldos quando não vierem prontos
  useEffect(() => {
    const semSaldo = dados.filter(d => d.saldo_restante == null)
    if (!semSaldo.length) return
    ;(async () => {
      for (const item of semSaldo) {
        const num = item.numero_pi
        if (saldoMap[num] != null) continue
        try {
          const r = await getJSON<{ saldo_restante: number }>(
            `${API}/matrizes/${encodeURIComponent(num)}/saldo`
          )
          if (typeof r?.saldo_restante === "number") {
            setSaldoMap(prev => ({ ...prev, [num]: r.saldo_restante }))
          } else {
            setSaldoMap(prev => ({ ...prev, [num]: 0 }))
          }
        } catch {
          // silencioso
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados])

  // listas derivadas para filtros
  const executivos = useMemo(() => {
    const set = new Set(
      dados
        .map(d => (d.executivo || "").trim())
        .filter(Boolean)
    )
    return Array.from(set).sort()
  }, [dados])

  const diretorias = useMemo(() => {
    const set = new Set(
      dados
        .map(d => (d.diretoria || "").trim())
        .filter(Boolean)
    )
    return Array.from(set).sort()
  }, [dados])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let base = dados.map(d => ({
      ...d,
      _saldo: d.saldo_restante ?? saldoMap[d.numero_pi] ?? null
    }))

    if (q) {
      base = base.filter(d =>
        d.numero_pi.toLowerCase().includes(q) ||
        (d.nome_campanha || "").toLowerCase().includes(q) ||
        (d.executivo || "").toLowerCase().includes(q)
      )
    }
    if (executivo) {
      base = base.filter(d => (d.executivo || "") === executivo)
    }
    if (diretoria) {
      base = base.filter(d => (d.diretoria || "") === diretoria)
    }

    base.sort((a, b) => {
      if (ordenarPor === "numero") {
        return b.numero_pi.localeCompare(a.numero_pi)
      } else {
        const sa = a._saldo ?? -Infinity
        const sb = b._saldo ?? -Infinity
        if (sb !== sa) return sb - sa
        return b.numero_pi.localeCompare(a.numero_pi)
      }
    })

    return base
  }, [dados, busca, executivo, diretoria, ordenarPor, saldoMap])

  return (
    <div className="space-y-8">
      {/* Título + ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Matrizes &amp; Saldos</h1>
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
              {executivos.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
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
              {diretorias.map(dr => (
                <option key={dr} value={dr}>{dr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ordenação */}
        <div className="mt-4">
          <label className="block text-xl font-semibold text-slate-800 mb-2">
            Ordenar por
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { k: "saldo", label: "Maior saldo" },
              { k: "numero", label: "Número (desc)" },
            ].map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => setOrdenarPor(opt.k as any)}
                className={[
                  "px-4 py-2 rounded-full border text-base",
                  ordenarPor === opt.k
                    ? "bg-red-600 text-white border-red-600 shadow"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Lista */}
      <section>
        {loading && (
          <div className="text-slate-600 text-lg">Carregando matrizes…</div>
        )}
        {erro && (
          <div className="text-red-700 text-lg">{erro}</div>
        )}

        {!loading && !erro && (
          <>
            {lista.length === 0 ? (
              <div className="text-slate-600 text-lg">Nenhuma matriz encontrada.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
                {lista.map((pi) => {
                  const saldo = pi.saldo_restante ?? (saldoMap[pi.numero_pi] ?? null)
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
                            <strong className="text-slate-900">{pi.executivo}</strong>
                          </span>
                        ) : null}
                        {pi.diretoria ? (
                          <span className="ml-4">
                            Diretoria:{" "}
                            <strong className="text-slate-900">{pi.diretoria}</strong>
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Link
                          to={`/pis/cadastro?tipo=Abatimento&numero_pi_matriz=${encodeURIComponent(pi.numero_pi)}`}
                          className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition"
                        >
                          Criar Abatimento
                        </Link>
                        <button
                          className="px-5 py-3 rounded-2xl border border-slate-300 text-slate-700 text-lg hover:bg-slate-50"
                          disabled
                          title="Em breve"
                        >
                          Detalhes
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
    </div>
  )
}
