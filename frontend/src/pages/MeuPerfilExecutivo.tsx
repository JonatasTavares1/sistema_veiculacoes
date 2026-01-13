// frontend/src/pages/MeuPerfilExecutivo.tsx
import React, { useEffect, useMemo, useState } from "react"
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

function moeda(v: number) {
  const n = Number(v || 0)
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
  } catch {
    return `R$ ${n.toFixed(2)}`
  }
}

export default function MeuPerfilExecutivo() {
  const me = getUser()

  const now = useMemo(() => new Date(), [])
  const [mes, setMes] = useState<number>(now.getMonth() + 1)
  const [ano, setAno] = useState<number>(now.getFullYear())

  const [resumo, setResumo] = useState<MeExecutivoResp | null>(null)
  const [carteira, setCarteira] = useState<CarteiraResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      const r1 = await apiGet<MeExecutivoResp>("/me/executivo")
      const r2 = await apiGet<CarteiraResp>(`/me/carteira?mes=${mes}&ano=${ano}&top_n=10`)
      setResumo(r1)
      setCarteira(r2)
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar perfil do executivo.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, ano])

  if (!me) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-900/60 bg-red-950/35 px-4 py-3 text-red-100">
          Você precisa estar logado.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-100">Meu Perfil (Executivo)</h1>
          <p className="text-sm text-zinc-400 mt-1">Carteira, vendas e visão mensal do seu desempenho.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-zinc-100"
          >
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
            onChange={(e) => setAno(Number(e.target.value))}
            type="number"
            min={2000}
            max={2100}
            className="w-28 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-zinc-100"
          />

          <button onClick={carregar} className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700">
            Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-400">Carregando...</div>
      ) : erro ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/35 px-4 py-3 text-red-100">{erro}</div>
      ) : (
        <>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm text-zinc-400">Executivo</div>
                <div className="text-xl font-bold text-zinc-100">{resumo?.executivo || "-"}</div>
                <div className="text-sm text-zinc-400 mt-1">{me?.email}</div>
              </div>

              <div className="flex gap-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
                  <div className="text-xs text-zinc-500">Agências</div>
                  <div className="text-lg font-extrabold text-zinc-100">{resumo?.carteira?.agencias ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
                  <div className="text-xs text-zinc-500">Anunciantes</div>
                  <div className="text-lg font-extrabold text-zinc-100">{resumo?.carteira?.anunciantes ?? 0}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="text-sm text-zinc-400">Total de PIs</div>
              <div className="text-3xl font-extrabold text-zinc-100">{carteira?.kpis?.total_pis ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="text-sm text-zinc-400">Valor bruto</div>
              <div className="text-3xl font-extrabold text-zinc-100">{moeda(carteira?.kpis?.valor_bruto ?? 0)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="text-sm text-zinc-400">Valor líquido</div>
              <div className="text-3xl font-extrabold text-zinc-100">{moeda(carteira?.kpis?.valor_liquido ?? 0)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="text-lg font-bold text-zinc-100">Top Anunciantes</div>
              <div className="mt-3 space-y-2">
                {(carteira?.top_anunciantes || []).length === 0 ? (
                  <div className="text-sm text-zinc-500">Sem dados no período.</div>
                ) : (
                  (carteira?.top_anunciantes || []).map((x) => (
                    <div
                      key={x.label}
                      className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2"
                    >
                      <div className="text-sm text-zinc-200">{x.label}</div>
                      <div className="text-sm font-semibold text-zinc-100">{moeda(x.valor)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="text-lg font-bold text-zinc-100">Top Agências</div>
              <div className="mt-3 space-y-2">
                {(carteira?.top_agencias || []).length === 0 ? (
                  <div className="text-sm text-zinc-500">Sem dados no período.</div>
                ) : (
                  (carteira?.top_agencias || []).map((x) => (
                    <div
                      key={x.label}
                      className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2"
                    >
                      <div className="text-sm text-zinc-200">{x.label}</div>
                      <div className="text-sm font-semibold text-zinc-100">{moeda(x.valor)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <div className="text-lg font-bold text-zinc-100">PIs do período</div>
              <div className="text-sm text-zinc-500">Até 200 registros</div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-600 text-white">
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
                  {(carteira?.pis || []).length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-zinc-500" colSpan={6}>
                        Nenhum PI encontrado para o período.
                      </td>
                    </tr>
                  ) : (
                    (carteira?.pis || []).map((p) => (
                      <tr key={p.id} className="border-t border-zinc-800">
                        <td className="px-4 py-3 font-mono text-zinc-100">{p.numero_pi}</td>
                        <td className="px-4 py-3 text-zinc-200">{p.tipo_pi}</td>
                        <td className="px-4 py-3 text-zinc-200">{p.nome_anunciante || "-"}</td>
                        <td className="px-4 py-3 text-zinc-200">{p.nome_agencia || "-"}</td>
                        <td className="px-4 py-3 text-zinc-200">{moeda(Number(p.valor_liquido || 0))}</td>
                        <td className="px-4 py-3 text-zinc-400">{p.data_emissao || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
