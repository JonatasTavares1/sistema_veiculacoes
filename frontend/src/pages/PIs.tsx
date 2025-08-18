// src/pages/PIs.tsx
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

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

const DEFAULT_EXECUTIVOS = [
  "Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio",
  "Flavio de Paula", "Lorena Fernandes", "Henri Marques", "Caio Bruno",
  "Flavia Cabral", "Paula Caroline", "Leila Santos", "Jessica Ribeiro",
  "Paula Campos",
]
const DIRETORIAS = ["Governo Federal", "Governo Estadual", "Rafael Augusto"]

function digits(s: string) { return (s || "").replace(/\D+/g, "") }
function fmtMoney(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "R$ 0,00"
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function parseISODateToBR(s?: string | null) {
  if (!s) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  return s
}
async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
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

  const [executivos, setExecutivos] = useState<string[]>([...DEFAULT_EXECUTIVOS])

  // detalhe
  const [detalhePI, setDetalhePI] = useState<PIItem | null>(null)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [saldoInfo, setSaldoInfo] = useState<{ valor_abatido: number, saldo_restante: number } | null>(null)
  const [filhos, setFilhos] = useState<PIItem[]>([]) // abatimentos (para Matriz) ou CS (para Normal)

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

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
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

      return okBusca && okTipo && okDir && okExec
    })
  }, [lista, busca, tipo, diretoria, executivo])

  async function exportarXLSX() {
    const rows = filtrada.map((pi) => ({
      "ID": pi.id,
      "PI": pi.numero_pi,
      "Tipo de PI": pi.tipo_pi,
      "PI Matriz": (pi.tipo_pi === "CS" || pi.tipo_pi === "Abatimento") ? (pi.numero_pi_matriz || "") : "",
      "Cliente": pi.nome_anunciante || "",
      "Agência": pi.nome_agencia || "",
      "CNPJ Agência": pi.cnpj_agencia || "",
      "Data de Emissão": parseISODateToBR(pi.data_emissao),
      "Valor Total (R$)": (pi.valor_bruto ?? 0),
      "Valor Líquido (R$)": (pi.valor_liquido ?? 0),
      "Praça": pi.uf_cliente || "",
      "Meio": pi.canal || "",
      "Campanha": pi.nome_campanha || "",
      "Diretoria": pi.diretoria || "",
      "Executivo": pi.executivo || "",
      "Data da Venda": (pi.dia_venda && pi.mes_venda) ? `${pi.dia_venda}/${pi.mes_venda}` : "",
      "Observações": pi.observacoes || "",
    }))

    const xlsx = await import("xlsx")
    const ws = xlsx.utils.json_to_sheet(rows, {
      header: Object.keys(rows[0] || {}),
    })
    // formata moeda em string pt-BR
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

  async function abrirDetalhes(pi: PIItem) {
    setDetalhePI(pi)
    setLoadingDetalhe(true)
    setSaldoInfo(null)
    setFilhos([])
    try {
      if (pi.tipo_pi === "Matriz") {
        // saldo + abatimentos via rotas de matrizes
        const [saldo, abats] = await Promise.all([
          getJSON<{ valor_abatido: number, saldo_restante: number }>(`${API}/matrizes/${encodeURIComponent(pi.numero_pi)}/saldo`),
          getJSON<PIItem[]>(`${API}/matrizes/${encodeURIComponent(pi.numero_pi)}/abatimentos`)
        ])
        setSaldoInfo(saldo)
        setFilhos(abats || [])
      } else if (pi.tipo_pi === "Normal") {
        // CS vinculados derivados da lista já carregada
        const cs = lista.filter(x => x.tipo_pi === "CS" && (x.numero_pi_normal || "") === pi.numero_pi)
        setFilhos(cs)
      } else {
        // CS ou Abatimento: só mostra vínculo (pai)
        setFilhos([])
      }
    } catch {
      // silencioso
    } finally {
      setLoadingDetalhe(false)
    }
  }
  function fecharDetalhes() {
    setDetalhePI(null)
    setSaldoInfo(null)
    setFilhos([])
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
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
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
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-semibold">
                            {pi.uf_cliente || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-800 text-base">{pi.canal || "—"}</td>
                        <td className="px-6 py-4 text-slate-800 text-base">
                          <div className="truncate max-w-[260px]">{pi.nome_campanha || "—"}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-800 text-base">{pi.diretoria || "—"}</td>
                        <td className="px-6 py-4 text-slate-800 text-base">{pi.executivo || "—"}</td>
                        <td className="px-6 py-4 text-slate-800 text-base">{dataVenda || "—"}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => abrirDetalhes(pi)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Ver detalhes e vínculos"
                            >
                              🔎 Detalhes
                            </button>
                            <Link
                              to={`/pis/cadastro?numero_pi=${encodeURIComponent(pi.numero_pi)}`}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Abrir no cadastro (pré-preencher futuramente)"
                            >
                              ✏️ Editar
                            </Link>
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

      {/* Painel de detalhes */}
      {detalhePI && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharDetalhes} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">
                    Detalhe do PI
                  </div>
                  <div className="mt-1 text-3xl font-extrabold text-slate-900">
                    <span className="font-mono">{detalhePI.numero_pi}</span> — {detalhePI.tipo_pi}
                  </div>
                  {detalhePI.tipo_pi === "CS" && detalhePI.numero_pi_normal && (
                    <div className="mt-1 text-slate-600">
                      Vinculado ao PI Normal: <span className="font-mono">{detalhePI.numero_pi_normal}</span>
                    </div>
                  )}
                  {detalhePI.tipo_pi === "Abatimento" && detalhePI.numero_pi_matriz && (
                    <div className="mt-1 text-slate-600">
                      Vinculado à Matriz: <span className="font-mono">{detalhePI.numero_pi_matriz}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={fecharDetalhes}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  ✖ Fechar
                </button>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Resumo */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Cliente</div>
                  <div className="text-lg font-semibold">{detalhePI.nome_anunciante || "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Agência</div>
                  <div className="text-lg font-semibold">{detalhePI.nome_agencia || "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Data de Emissão</div>
                  <div className="text-lg font-semibold">{parseISODateToBR(detalhePI.data_emissao) || "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Valores</div>
                  <div className="text-lg font-semibold">
                    {fmtMoney(detalhePI.valor_bruto)} <span className="text-slate-500">bruto</span> • {fmtMoney(detalhePI.valor_liquido)} <span className="text-slate-500">líquido</span>
                  </div>
                </div>
              </section>

              {/* Cards específicos por tipo */}
              {detalhePI.tipo_pi === "Matriz" && (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-3 py-1 text-sm font-semibold">
                      Saldo: {saldoInfo ? fmtMoney(saldoInfo.saldo_restante) : (loadingDetalhe ? "Carregando…" : "—")}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-3 py-1 text-sm font-semibold">
                      Abatido: {saldoInfo ? fmtMoney(saldoInfo.valor_abatido) : (loadingDetalhe ? "Carregando…" : "—")}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200">
                    <div className="px-4 py-3 border-b bg-slate-50 font-semibold">Abatimentos</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-red-600/90 text-white">
                            {["PI", "Valor", "Emissão", "Obs."].map(h => (
                              <th key={h} className="px-4 py-2 text-left text-sm font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {loadingDetalhe ? (
                            <tr><td className="px-4 py-3 text-slate-600" colSpan={4}>Carregando…</td></tr>
                          ) : filhos.length === 0 ? (
                            <tr><td className="px-4 py-3 text-slate-600" colSpan={4}>Nenhum abatimento.</td></tr>
                          ) : filhos.map(f => (
                            <tr key={f.id} className="border-b last:border-none">
                              <td className="px-4 py-2 font-mono">{f.numero_pi}</td>
                              <td className="px-4 py-2">{fmtMoney(f.valor_bruto)}</td>
                              <td className="px-4 py-2 text-sm">{parseISODateToBR(f.data_emissao) || "—"}</td>
                              <td className="px-4 py-2 text-sm">{f.observacoes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {detalhePI.tipo_pi === "Normal" && (
                <section className="space-y-4">
                  <div className="rounded-2xl border border-slate-200">
                    <div className="px-4 py-3 border-b bg-slate-50 font-semibold">CS vinculados</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-red-600/90 text-white">
                            {["PI CS", "Valor", "Emissão", "Obs."].map(h => (
                              <th key={h} className="px-4 py-2 text-left text-sm font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {loadingDetalhe ? (
                            <tr><td className="px-4 py-3 text-slate-600" colSpan={4}>Carregando…</td></tr>
                          ) : filhos.length === 0 ? (
                            <tr><td className="px-4 py-3 text-slate-600" colSpan={4}>Nenhum CS vinculado.</td></tr>
                          ) : filhos.map(cs => (
                            <tr key={cs.id} className="border-b last:border-none">
                              <td className="px-4 py-2 font-mono">{cs.numero_pi}</td>
                              <td className="px-4 py-2">{fmtMoney(cs.valor_bruto)}</td>
                              <td className="px-4 py-2 text-sm">{parseISODateToBR(cs.data_emissao) || "—"}</td>
                              <td className="px-4 py-2 text-sm">{cs.observacoes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {(detalhePI.tipo_pi === "CS" || detalhePI.tipo_pi === "Abatimento") && (
                <section className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Vínculo</div>
                  {detalhePI.tipo_pi === "CS" ? (
                    <div className="mt-1">
                      PI Normal: <span className="font-mono">{detalhePI.numero_pi_normal || "—"}</span>
                    </div>
                  ) : (
                    <div className="mt-1">
                      PI Matriz: <span className="font-mono">{detalhePI.numero_pi_matriz || "—"}</span>
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
