// src/pages/DetalhesPi.tsx
import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { apiGet } from "../services/api"

// ===== Tipos =====
type PI = {
  id: number
  numero_pi: string
  tipo_pi: string

  numero_pi_matriz?: string | null
  numero_pi_normal?: string | null

  nome_anunciante?: string | null
  razao_social_anunciante?: string | null
  cnpj_anunciante?: string | null
  uf_cliente?: string | null

  nome_agencia?: string | null
  razao_social_agencia?: string | null
  cnpj_agencia?: string | null
  uf_agencia?: string | null

  nome_campanha?: string | null
  perfil?: string | null
  subperfil?: string | null

  data_venda?: string | null
  vencimento?: string | null
  data_emissao?: string | null

  executivo?: string | null
  diretoria?: string | null
  canal?: string | null

  valor_bruto?: number | null
  valor_liquido?: number | null

  observacoes?: string | null
  eh_matriz?: boolean | null
}

type Veiculacao = {
  id: number
  produto_id?: number | null
  produto_nome?: string | null
  pi_id?: number | null
  numero_pi?: string | null

  data_inicio?: string | null
  data_fim?: string | null

  quantidade?: number | null
  valor_bruto?: number | null
  desconto?: number | null
  valor_liquido?: number | null
}

type Entrega = {
  id: number
  veiculacao_id?: number | null
  status?: string | null // ou etapa
  etapa?: string | null

  // alguns projetos usam datas por etapa
  created_at?: string | null
  updated_at?: string | null

  // se teu schema tiver campos tipo: prazo, responsavel, obs etc, pode adicionar aqui
  observacao?: string | null

  // infos resolvidas (se seu EntregaOut já retorna)
  numero_pi?: string | null
  produto_nome?: string | null
  campanha?: string | null
  cliente?: string | null
  canal?: string | null
}

type FaturamentoAnexo = {
  id: number
  tipo: string
  filename: string
  path: string
  mime?: string | null
  size?: number | null
  uploaded_at: string
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

  anexos?: FaturamentoAnexo[]
}

type PIVeiculacaoResumo = {
  status: "NAO_INICIADO" | "EM_VEICULACAO" | "FINALIZADO"
  em_veiculacao: boolean
  possui_veiculacao: boolean
  data_inicio_min?: string | null
  data_fim_max?: string | null
}

type PIDetalhesTotais = {
  veiculacoes_total: number
  veiculacoes_bruto: number
  veiculacoes_liquido: number

  faturamentos_total: number
  faturamentos_por_status: Record<string, number>

  entregas_total: number
  entregas_por_status: Record<string, number>
}

type PIDetalhesPayload = {
  pi: PI
  veiculacoes: Veiculacao[]
  entregas: Entrega[]
  faturamentos: Faturamento[]
  veiculacao: PIVeiculacaoResumo
  totais: PIDetalhesTotais
}

// ===== Helpers =====
function fmtMoney(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "R$ 0,00"
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtDateBR(value?: string | null) {
  if (!value) return "—"
  const s = String(value)
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return s
  return d.toLocaleDateString("pt-BR")
}

function normTxt(v?: string | null) {
  const t = (v ?? "").toString().trim()
  return t ? t : "—"
}

function onlyDigits(s?: string | null) {
  return (s || "").replace(/\D/g, "")
}

function fmtCNPJ(v?: string | null) {
  const d = onlyDigits(v)
  if (d.length !== 14) return v || "—"
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function badgeFaturamento(st?: string | null) {
  const s = (st || "").toUpperCase()
  if (s === "PAGO") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (s === "FATURADO") return "bg-sky-50 text-sky-700 border-sky-200"
  if (s === "EM_FATURAMENTO") return "bg-amber-50 text-amber-700 border-amber-200"
  if (s === "ENVIADO") return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function badgeVeiculacao(status?: string | null) {
  const s = (status || "").toUpperCase()
  if (s === "EM_VEICULACAO") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (s === "FINALIZADO") return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-amber-50 text-amber-700 border-amber-200" // NAO_INICIADO
}

function labelVeiculacao(status?: string | null) {
  const s = (status || "").toUpperCase()
  if (s === "EM_VEICULACAO") return "VEICULANDO"
  if (s === "FINALIZADO") return "VEICULADO"
  return "NÃO INICIADO"
}

function badgeEsteira(st?: string | null) {
  const s = (st || "—").toUpperCase()
  // Ajuste conforme seus status reais:
  if (s.includes("APROV")) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (s.includes("PEND")) return "bg-amber-50 text-amber-700 border-amber-200"
  if (s.includes("PRODU")) return "bg-sky-50 text-sky-700 border-sky-200"
  if (s.includes("PUBLIC") || s.includes("ENTREG")) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

export default function DetalhesPI() {
  const params = useParams()
  const id = params.id ? Number(params.id) : NaN

  const [pi, setPi] = useState<PI | null>(null)
  const [veics, setVeics] = useState<Veiculacao[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [fats, setFats] = useState<Faturamento[]>([])
  const [totais, setTotais] = useState<PIDetalhesTotais | null>(null)
  const [resumoVeic, setResumoVeic] = useState<PIVeiculacaoResumo | null>(null)

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregarTudo(piId: number) {
    const payload = await apiGet<PIDetalhesPayload>(`/pis/${piId}/detalhes`)
    return payload
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setErro(null)

      setPi(null)
      setVeics([])
      setEntregas([])
      setFats([])
      setTotais(null)
      setResumoVeic(null)

      try {
        if (!Number.isFinite(id) || id <= 0) throw new Error("ID inválido na URL.")

        const payload = await carregarTudo(id)

        setPi(payload.pi)
        setVeics(Array.isArray(payload.veiculacoes) ? payload.veiculacoes : [])
        setEntregas(Array.isArray(payload.entregas) ? payload.entregas : [])
        setFats(Array.isArray(payload.faturamentos) ? payload.faturamentos : [])
        setTotais(payload.totais || null)
        setResumoVeic(payload.veiculacao || null)
      } catch (e: any) {
        setErro(e?.message || "Erro ao carregar detalhes do PI.")
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const veicsPorProduto = useMemo(() => {
    const map = new Map<string, Veiculacao[]>()
    for (const v of veics) {
      const key = (v.produto_nome || "Produto não informado").trim() || "Produto não informado"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(v)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
  }, [veics])

  const resumoTotais = totais || {
    veiculacoes_total: veics.length,
    veiculacoes_bruto: 0,
    veiculacoes_liquido: 0,
    faturamentos_total: fats.length,
    faturamentos_por_status: {},
    entregas_total: entregas.length,
    entregas_por_status: {},
  }

  const statusVeic = resumoVeic?.status || "NAO_INICIADO"

  // ===== UI =====
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-slate-700">Carregando detalhes do PI…</div>
        </div>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Detalhes do PI</h1>
          <Link to="/pis" className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50">
            ← Voltar
          </Link>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="font-semibold text-red-800">Erro</div>
          <div className="text-red-700 mt-1 whitespace-pre-line">{erro}</div>
        </div>
      </div>
    )
  }

  if (!pi) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Detalhes do PI</h1>
          <Link to="/pis" className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50">
            ← Voltar
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-700">PI não encontrado.</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Detalhes do PI</h1>
          <div className="text-slate-600 mt-1 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{pi.numero_pi}</span>
            <span className="text-slate-400">•</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700 border border-red-200">
              {pi.tipo_pi}
            </span>

            {/* ✅ Status veiculação */}
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold border ${badgeVeiculacao(statusVeic)}`}>
              {labelVeiculacao(statusVeic)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/pis" className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50">
            ← Voltar
          </Link>

          <button type="button" disabled className="px-4 py-2 rounded-xl border border-slate-300 text-slate-400 cursor-not-allowed">
            Exportar (em breve)
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* ✅ Status de Veiculação (resumo) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Status de Veiculação</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Situação</div>
              <div className="mt-1">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${badgeVeiculacao(statusVeic)}`}>
                  {labelVeiculacao(statusVeic)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Possui veiculações?</div>
              <div className="text-lg font-semibold text-slate-900">{resumoVeic?.possui_veiculacao ? "Sim" : "Não"}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Início (mín.)</div>
              <div className="text-lg font-semibold text-slate-900">{fmtDateBR(resumoVeic?.data_inicio_min || null)}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Fim (máx.)</div>
              <div className="text-lg font-semibold text-slate-900">{fmtDateBR(resumoVeic?.data_fim_max || null)}</div>
            </div>
          </div>
        </section>

        {/* Identificação */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Identificação</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Número</div>
              <div className="text-lg font-semibold text-slate-900">{pi.numero_pi}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Tipo</div>
              <div className="text-lg font-semibold text-slate-900">{pi.tipo_pi}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Vínculo PI Matriz</div>
              <div className="text-base font-semibold text-slate-900">{normTxt(pi.numero_pi_matriz)}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Vínculo PI Normal</div>
              <div className="text-base font-semibold text-slate-900">{normTxt(pi.numero_pi_normal)}</div>
            </div>
          </div>
        </section>

        {/* Anunciante */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Anunciante</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-slate-500">Nome</div>
              <div className="text-slate-900 font-medium">{normTxt(pi.nome_anunciante)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Razão Social</div>
              <div className="text-slate-900 font-medium">{normTxt(pi.razao_social_anunciante)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">CNPJ</div>
              <div className="text-slate-900 font-medium">{fmtCNPJ(pi.cnpj_anunciante)}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">UF</div>
              <div className="text-slate-900 font-medium">{normTxt(pi.uf_cliente)}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Perfil</div>
              <div className="text-slate-900 font-medium">{normTxt(pi.perfil)}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Subperfil</div>
              <div className="text-slate-900 font-medium">{normTxt(pi.subperfil)}</div>
            </div>
          </div>
        </section>

        {/* Agência */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Agência</h2>

          {pi.nome_agencia || pi.cnpj_agencia || pi.razao_social_agencia ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-slate-500">Nome</div>
                <div className="text-slate-900 font-medium">{normTxt(pi.nome_agencia)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Razão Social</div>
                <div className="text-slate-900 font-medium">{normTxt(pi.razao_social_agencia)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">CNPJ</div>
                <div className="text-slate-900 font-medium">{fmtCNPJ(pi.cnpj_agencia)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">UF</div>
                <div className="text-slate-900 font-medium">{normTxt(pi.uf_agencia)}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">Este PI não possui agência cadastrada.</div>
          )}
        </section>

        {/* Totais consolidados */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Totais do PI</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Veiculações</div>
              <div className="text-lg font-semibold text-slate-900">{resumoTotais.veiculacoes_total ?? veics.length}</div>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="text-xs text-red-700">Bruto (veiculações)</div>
              <div className="text-lg font-semibold text-slate-900">{fmtMoney(resumoTotais.veiculacoes_bruto)}</div>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="text-xs text-red-700">Líquido (veiculações)</div>
              <div className="text-lg font-semibold text-slate-900">{fmtMoney(resumoTotais.veiculacoes_liquido)}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Esteira (Entregas)</div>
              <div className="text-lg font-semibold text-slate-900">{resumoTotais.entregas_total ?? entregas.length}</div>
            </div>
          </div>
        </section>

        {/* Veiculações */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Veiculações</h2>
            <div className="text-sm text-slate-600">
              {resumoTotais.veiculacoes_total ? (
                <>
                  <span className="mr-3">
                    Total Bruto: <span className="font-semibold text-slate-900">{fmtMoney(resumoTotais.veiculacoes_bruto)}</span>
                  </span>
                  <span>
                    Total Líquido: <span className="font-semibold text-slate-900">{fmtMoney(resumoTotais.veiculacoes_liquido)}</span>
                  </span>
                </>
              ) : (
                <span>Nenhuma veiculação encontrada.</span>
              )}
            </div>
          </div>

          {veics.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">Nenhuma veiculação vinculada a este PI.</div>
          ) : (
            <div className="space-y-6">
              {veicsPorProduto.map(([produtoNome, rows]) => (
                <div key={produtoNome} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b">
                    <div className="font-semibold text-slate-900">{produtoNome}</div>
                    <div className="text-xs text-slate-500">Veiculações: {rows.length}</div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-red-600/90 text-white">
                          {["Início", "Fim", "Dias", "Bruto", "Desc %", "Líquido"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-sm font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((v) => (
                          <tr key={v.id} className="border-b last:border-0">
                            <td className="px-3 py-2 text-sm text-slate-900">{fmtDateBR(v.data_inicio)}</td>
                            <td className="px-3 py-2 text-sm text-slate-900">{fmtDateBR(v.data_fim)}</td>
                            <td className="px-3 py-2 text-sm text-slate-900">{v.quantidade ?? "—"}</td>
                            <td className="px-3 py-2 text-sm text-slate-900">{fmtMoney(v.valor_bruto)}</td>
                            <td className="px-3 py-2 text-sm text-slate-900">
                              {v.desconto != null ? `${Number(v.desconto).toFixed(1).replace(".", ",")}%` : "—"}
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-900">{fmtMoney(v.valor_liquido)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ✅ Esteira de Produção */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Esteira de Produção (Entregas)</h2>
            <div className="text-sm text-slate-600">
              Total: <span className="font-semibold text-slate-900">{resumoTotais.entregas_total ?? entregas.length}</span>
            </div>
          </div>

          {/* resumo por status */}
          {Object.keys(resumoTotais.entregas_por_status || {}).length ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(resumoTotais.entregas_por_status || {}).map(([st, qtd]) => (
                <span key={st} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border ${badgeEsteira(st)}`}>
                  {st}: {qtd}
                </span>
              ))}
            </div>
          ) : null}

          {entregas.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
              Nenhuma entrega registrada para este PI (a esteira ainda não começou).
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {["Etapa/Status", "Produto", "Atualizado", "Obs"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-sm font-semibold text-slate-700">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entregas.map((e) => {
                    const st = (e.status || e.etapa || "—").toUpperCase()
                    return (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="px-3 py-2 text-sm">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${badgeEsteira(st)}`}>
                            {st}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-900">{normTxt(e.produto_nome)}</td>
                        <td className="px-3 py-2 text-sm text-slate-900">{fmtDateBR(e.updated_at || e.created_at || null)}</td>
                        <td className="px-3 py-2 text-sm text-slate-900 max-w-[520px]">
                          <div className="truncate" title={e.observacao || ""}>
                            {normTxt(e.observacao)}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Financeiro (Faturamentos) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Financeiro (Faturamentos)</h2>
            <div className="text-sm text-slate-600">
              Total: <span className="font-semibold text-slate-900">{resumoTotais.faturamentos_total ?? fats.length}</span>
            </div>
          </div>

          {fats.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">Nenhum faturamento vinculado a este PI.</div>
          ) : (
            <div className="space-y-4">
              {/* resumo por status */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(resumoTotais.faturamentos_por_status || {}).map(([st, qtd]) => (
                  <span key={st} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border ${badgeFaturamento(st)}`}>
                    {st}: {qtd}
                  </span>
                ))}
              </div>

              {/* tabela */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      {["Status", "Enviado", "NF", "Obs", "Anexos"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-sm font-semibold text-slate-700">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fats.map((f) => (
                      <tr key={f.id} className="border-b last:border-0">
                        <td className="px-3 py-2 text-sm">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${badgeFaturamento(f.status)}`}>
                            {f.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-900">{fmtDateBR(f.enviado_em)}</td>
                        <td className="px-3 py-2 text-sm text-slate-900">{normTxt(f.nf_numero)}</td>
                        <td className="px-3 py-2 text-sm text-slate-900 max-w-[420px]">
                          <div className="truncate" title={f.observacao || ""}>
                            {normTxt(f.observacao)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-900">
                          {(f.anexos || []).length ? (
                            <div className="flex flex-col gap-1">
                              {(f.anexos || []).map((a) => (
                                <a
                                  key={a.id}
                                  href={a.path}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-red-700 hover:underline"
                                  title={a.filename}
                                >
                                  <span className="font-semibold">{a.tipo}</span>: {a.filename}
                                </a>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ✅ DICA: se você quiser “linha do tempo” do faturamento (esteira do financeiro),
                  dá pra mostrar as datas: em_faturamento_em / faturado_em / pago_em em um modal,
                  ou uma coluna extra na tabela. */}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
