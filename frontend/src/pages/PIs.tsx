// src/pages/PIs.tsx
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiDelete, apiDownloadBlob, apiGet, apiPut } from "../services/api"

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

  // data_venda (YYYY-MM-DD ou DD/MM/YYYY se o back aceitar)
  data_venda?: string | null

  valor_bruto?: number | null
  valor_liquido?: number | null
  uf_cliente?: string | null
  canal?: string | null
  nome_campanha?: string | null
  diretoria?: string | null
  executivo?: string | null
  observacoes?: string | null
}

type AnexoMap = Record<number, { pi: boolean; proposta: boolean }>

const DEFAULT_EXECUTIVOS = [
  "Rafale e Francio",
  "Rafael Rodrigo",
  "Rodrigo da Silva",
  "Juliana Madazio",
  "Flavio de Paula",
  "Lorena Fernandes",
  "Henri Marques",
  "Caio Bruno",
  "Flavia Cabral",
  "Paula Caroline",
  "Leila Santos",
  "Jessica Ribeiro",
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

// normaliza data para ISO (YYYY-MM-DD) aceitando ISO ou BR
function normalizeToISODate(s?: string | null) {
  if (!s) return ""
  const t = String(s).trim()
  if (!t) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const br = BRtoISODate(t)
  return br || ""
}

function normalizeTipo(tipo: string) {
  return (tipo || "").toLowerCase()
}

function mostraPIMatriz(tipo: string) {
  const t = normalizeTipo(tipo)
  return t === "cs" || t === "abatimento" || t === "veiculação" || t === "veiculacao"
}

async function baixarArquivo(pi: PIItem, qual: "pi" | "proposta") {
  const endpoint = `/pis/${pi.id}/arquivo?tipo=${qual}&modo=download`
  const resp: any = await apiDownloadBlob(endpoint)
  const blob: Blob = resp instanceof Blob ? resp : await resp.blob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${qual}_${pi.numero_pi || pi.id}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function PIs() {
  const navigate = useNavigate()

  const [lista, setLista] = useState<PIItem[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [anexos, setAnexos] = useState<AnexoMap>({})

  // filtros
  const [busca, setBusca] = useState("")
  const [tipo, setTipo] = useState<"Todos" | "Matriz" | "Normal" | "CS" | "Abatimento" | "Veiculação">("Todos")
  const [diretoria, setDiretoria] = useState<string>("Todos")
  const [executivo, setExecutivo] = useState<string>("Todos")

  // filtro por intervalo de data_venda
  const [dataVendaDe, setDataVendaDe] = useState<string>("") // YYYY-MM-DD
  const [dataVendaAte, setDataVendaAte] = useState<string>("") // YYYY-MM-DD

  const [executivos, setExecutivos] = useState<string[]>([...DEFAULT_EXECUTIVOS])

  // editor
  const [editOpen, setEditOpen] = useState(false)
  const [editDraft, setEditDraft] = useState<PIItem | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set())
  const [view, setView] = useState<"table" | "cards">("table")

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      const pis = await apiGet<PIItem[]>("/pis")
      const arr = Array.isArray(pis) ? pis : []
      setLista(arr)

      // executivos
      const exsFromApi = await apiGet<string[]>("/executivos").catch(() => [])
      const exsFromData = Array.from(new Set(arr.map((p) => (p.executivo || "").trim()).filter(Boolean)))
      const merged = Array.from(
        new Set([...(Array.isArray(exsFromApi) ? exsFromApi : []), ...DEFAULT_EXECUTIVOS, ...exsFromData])
      )
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
      setExecutivos(merged)

      // anexos por PI
      const map: AnexoMap = {}
      await Promise.all(
        arr.map(async (p) => {
          try {
            const listaArquivos = await apiGet<Array<{ tipo: string }>>(`/pis/${p.id}/arquivos`)
            const tipos = new Set((listaArquivos || []).map((a) => (a.tipo || "").toLowerCase()))
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

  useEffect(() => {
    carregar()
  }, [])

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()

    // intervalo data_venda
    const deISO = dataVendaDe ? normalizeToISODate(dataVendaDe) : ""
    const ateISO = dataVendaAte ? normalizeToISODate(dataVendaAte) : ""
    const haveDataVendaFiltro = !!deISO || !!ateISO

    return lista.filter((p) => {
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

      const okDir = diretoria === "Todos" || (p.diretoria || "") === diretoria
      const okExec = executivo === "Todos" || (p.executivo || "") === executivo

      let okDataVenda = true
      if (haveDataVendaFiltro) {
        const pv = normalizeToISODate(p.data_venda || "")
        if (!pv) okDataVenda = false
        else {
          if (deISO && pv < deISO) okDataVenda = false
          if (ateISO && pv > ateISO) okDataVenda = false
        }
      }

      return okBusca && okTipo && okDir && okExec && okDataVenda
    })
  }, [lista, busca, tipo, diretoria, executivo, dataVendaDe, dataVendaAte])

  async function exportarXLSX() {
    const rows = filtrada.map((pi) => ({
      ID: pi.id,
      PI: pi.numero_pi,
      "Tipo de PI": pi.tipo_pi,
      "PI Matriz": mostraPIMatriz(pi.tipo_pi) ? pi.numero_pi_matriz || "" : "",
      Cliente: pi.nome_anunciante || "",
      Agência: pi.nome_agencia || "",
      "CNPJ Agência": pi.cnpj_agencia || "",
      "Data de Emissão": parseISODateToBR(pi.data_emissao),
      "Valor Total (R$)": pi.valor_bruto ?? 0,
      "Valor Líquido (R$)": pi.valor_liquido ?? 0,
      Praça: pi.uf_cliente || "",
      Meio: pi.canal || "",
      Campanha: pi.nome_campanha || "",
      Diretoria: pi.diretoria || "",
      Executivo: pi.executivo || "",
      "Data da Venda": parseISODateToBR(pi.data_venda),
      Observações: pi.observacoes || "",
    }))

    const xlsx = await import("xlsx")
    const ws = xlsx.utils.json_to_sheet(rows, { header: Object.keys(rows[0] || {}) })

    const colMoney = ["Valor Total (R$)", "Valor Líquido (R$)"]
    rows.forEach((r, i) => {
      colMoney.forEach((k) => {
        const cell = xlsx.utils.encode_cell({ r: i + 1, c: Object.keys(rows[0]).indexOf(k) })
        const v = r[k as keyof typeof r] as number
        ;(ws as any)[cell] = {
          t: "s",
          v: (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        }
      })
    })

    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, "PIs")

    const now = new Date()
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-")
    xlsx.writeFile(wb, `pis_${stamp}.xlsx`)
  }

  // editor
  function abrirEditor(pi: PIItem) {
    setEditError(null)
    setEditDraft({
      ...pi,
      data_emissao: parseISODateToBR(pi.data_emissao),
      data_venda: pi.data_venda || null,
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return ISOtoBRDate(t) // mantém seu padrão atual
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return t
    return t
  }

  function normalizaDataVendaParaAPI(s?: string | null) {
    if (!s) return null
    const t = String(s).trim()
    if (!t) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
    const iso = BRtoISODate(t)
    return iso || t
  }

  async function salvarEditor() {
    if (!editDraft) return
    setSavingEdit(true)
    setEditError(null)
    try {
      const payload: any = {
        numero_pi: editDraft.numero_pi?.trim(),
        tipo_pi: editDraft.tipo_pi,
        numero_pi_matriz: mostraPIMatriz(editDraft.tipo_pi) ? editDraft.numero_pi_matriz || null : null,
        numero_pi_normal: normalizeTipo(editDraft.tipo_pi) === "cs" ? editDraft.numero_pi_normal || null : null,
        nome_anunciante: editDraft.nome_anunciante || null,
        nome_agencia: editDraft.nome_agencia || null,
        cnpj_agencia: editDraft.cnpj_agencia || null,
        data_emissao: normalizaDataEmissaoParaAPI(editDraft.data_emissao),
        data_venda: normalizaDataVendaParaAPI(editDraft.data_venda),
        valor_bruto: trataNumero(String(editDraft.valor_bruto ?? "")),
        valor_liquido: trataNumero(String(editDraft.valor_liquido ?? "")),
        uf_cliente: editDraft.uf_cliente || null,
        canal: editDraft.canal || null,
        nome_campanha: editDraft.nome_campanha || null,
        diretoria: editDraft.diretoria || null,
        executivo: editDraft.executivo || null,
        observacoes: editDraft.observacoes || null,
      }

      await apiPut<PIItem>(`/pis/${editDraft.id}`, payload)
      fecharEditor()
      await carregar()
    } catch (e: any) {
      setEditError(e?.message || "Falha ao salvar.")
    } finally {
      setSavingEdit(false)
    }
  }

  async function excluirPI(pi: PIItem) {
    if (!confirm(`Excluir PI ${pi.numero_pi} (#${pi.id})? Esta ação não pode ser desfeita.`)) return
    setDeletingIds((prev) => new Set(prev).add(pi.id))
    try {
      await apiDelete(`/pis/${pi.id}`)
      setLista((prev) => prev.filter((x) => x.id !== pi.id))
      if (editDraft?.id === pi.id) fecharEditor()
      alert("PI excluído com sucesso.")
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir PI.")
    } finally {
      setDeletingIds((prev) => {
        const n = new Set(prev)
        n.delete(pi.id)
        return n
      })
    }
  }

  // navega para a página de detalhes
  function irParaDetalhes(piId: number) {
    navigate(`/pis/${piId}`)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">PIs Cadastrados</h1>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button
            onClick={() => setView((v) => (v === "table" ? "cards" : "table"))}
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
              {["Todos", "Matriz", "Normal", "CS", "Abatimento", "Veiculação"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
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
              {DIRETORIAS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
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
              {executivos.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          </div>

          {/* Data da Venda (intervalo) */}
          <div className="xl:col-span-2">
            <label className="block text-base md:text-xl font-semibold text-slate-800 mb-2">Data da Venda</label>
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <div>
                <div className="text-xs md:text-sm text-slate-600 mb-1">De</div>
                <input
                  type="date"
                  value={dataVendaDe}
                  onChange={(e) => setDataVendaDe(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-2.5 md:px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                />
              </div>
              <div>
                <div className="text-xs md:text-sm text-slate-600 mb-1">Até</div>
                <input
                  type="date"
                  value={dataVendaAte}
                  onChange={(e) => setDataVendaAte(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-2.5 md:px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                />
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Filtra usando <code>data_venda</code>.
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
                      "ID",
                      "PI",
                      "Tipo de PI",
                      "PI Matriz",
                      "Cliente",
                      "Agência",
                      "Data de Emissão",
                      "Valor Total",
                      "Valor Líquido",
                      "Praça",
                      "Meio",
                      "Campanha",
                      "Diretoria",
                      "Executivo",
                      "Data da Venda",
                      "Arquivos",
                      "Ações",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-red-100">
                  {filtrada.map((pi, idx) => {
                    const dataVenda = parseISODateToBR(pi.data_venda) || ""
                    const piMatriz = mostraPIMatriz(pi.tipo_pi) ? pi.numero_pi_matriz || "" : ""
                    const temPi = anexos[pi.id]?.pi ?? false
                    const temProp = anexos[pi.id]?.proposta ?? false

                    return (
                      <tr
                        key={pi.id}
                        className={["transition", idx % 2 === 0 ? "bg-white" : "bg-red-50/40", "hover:bg-red-50"].join(
                          " "
                        )}
                      >
                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-900 text-sm md:text-base font-medium">
                          {pi.id}
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-900 text-sm md:text-base font-medium">
                          <span className="font-mono">{pi.numero_pi}</span>
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">{pi.tipo_pi}</td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">
                          <span className="font-mono">{piMatriz}</span>
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">
                          <div className="truncate max-w-[220px]">{pi.nome_anunciante || "—"}</div>
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">
                          <div className="truncate max-w-[220px]">{pi.nome_agencia || "—"}</div>
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-700 text-xs md:text-sm">
                          {parseISODateToBR(pi.data_emissao) || "—"}
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-900 text-sm md:text-base font-semibold">
                          {fmtMoney(pi.valor_bruto)}
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-900 text-sm md:text-base font-semibold">
                          {fmtMoney(pi.valor_liquido)}
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2.5 md:px-3 py-1 text-[10px] md:text-xs font-semibold">
                            {pi.uf_cliente || "—"}
                          </span>
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">
                          {pi.canal || "—"}
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">
                          <div className="truncate max-w-[260px]">{pi.nome_campanha || "—"}</div>
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">
                          {pi.diretoria || "—"}
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">
                          {pi.executivo || "—"}
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4 text-slate-800 text-sm md:text-base">
                          {dataVenda || "—"}
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => baixarArquivo(pi, "pi")}
                              disabled={!temPi}
                              className={`px-3 py-1.5 rounded-xl border text-sm ${
                                temPi
                                  ? "border-slate-300 text-slate-700 hover:bg-slate-50"
                                  : "border-slate-200 text-slate-400 cursor-not-allowed"
                              }`}
                              title={temPi ? "Baixar PI (PDF)" : "Sem PI anexado"}
                            >
                              📄 PI
                            </button>

                            <button
                              type="button"
                              onClick={() => baixarArquivo(pi, "proposta")}
                              disabled={!temProp}
                              className={`px-3 py-1.5 rounded-xl border text-sm ${
                                temProp
                                  ? "border-slate-300 text-slate-700 hover:bg-slate-50"
                                  : "border-slate-200 text-slate-400 cursor-not-allowed"
                              }`}
                              title={temProp ? "Baixar Proposta (PDF)" : "Sem Proposta anexada"}
                            >
                              📎 Proposta
                            </button>
                          </div>
                        </td>

                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => irParaDetalhes(pi.id)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Ir para detalhes do PI"
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
                const piMatriz = mostraPIMatriz(pi.tipo_pi) ? pi.numero_pi_matriz || "" : ""
                const dataVenda = parseISODateToBR(pi.data_venda) || ""
                const excluindo = deletingIds.has(pi.id)
                const temPi = anexos[pi.id]?.pi ?? false
                const temProp = anexos[pi.id]?.proposta ?? false

                return (
                  <div
                    key={pi.id}
                    className="rounded-2xl border border-red-200 bg-white shadow-sm hover:shadow-md transition overflow-hidden"
                  >
                    <div className="px-5 py-4 border-b border-red-100 bg-gradient-to-r from-white to-red-50/30">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] md:text-xs uppercase tracking-wide text-red-700 font-semibold">PI</div>
                          <div className="font-mono text-lg md:text-xl font-extrabold text-slate-900 truncate">
                            {pi.numero_pi}
                          </div>
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
                        <span
                          className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-2.5 py-1 border border-slate-200"
                          title="Praça"
                        >
                          {pi.uf_cliente || "—"}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full bg-blue-50 text-blue-800 px-2.5 py-1 border border-blue-200"
                          title="Meio"
                        >
                          {pi.canal || "—"}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-1 border border-emerald-200"
                          title="Diretoria"
                        >
                          {pi.diretoria || "—"}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full bg-purple-50 text-purple-800 px-2.5 py-1 border border-purple-200"
                          title="Executivo"
                        >
                          {pi.executivo || "—"}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600">
                        Emissão:{" "}
                        <span className="font-medium text-slate-800">{parseISODateToBR(pi.data_emissao) || "—"}</span>
                        {dataVenda && (
                          <>
                            {" "}
                            | Venda: <span className="font-medium text-slate-800">{dataVenda}</span>
                          </>
                        )}
                      </div>

                      <div className="pt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => baixarArquivo(pi, "pi")}
                          disabled={!temPi}
                          className={`px-3 py-1.5 rounded-xl border text-sm ${
                            temPi
                              ? "border-slate-300 text-slate-700 hover:bg-white"
                              : "border-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                          title={temPi ? "Baixar PI (PDF)" : "Sem PI anexado"}
                        >
                          📄 PI
                        </button>

                        <button
                          type="button"
                          onClick={() => baixarArquivo(pi, "proposta")}
                          disabled={!temProp}
                          className={`px-3 py-1.5 rounded-xl border text-sm ${
                            temProp
                              ? "border-slate-300 text-slate-700 hover:bg-white"
                              : "border-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                          title={temProp ? "Baixar Proposta (PDF)" : "Sem Proposta anexada"}
                        >
                          📎 Proposta
                        </button>
                      </div>
                    </div>

                    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                      <button
                        onClick={() => irParaDetalhes(pi.id)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-white"
                        title="Ir para detalhes do PI"
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
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">{editError}</div>
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
                    {["Matriz", "Normal", "CS", "Abatimento", "Veiculação"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Data da Venda</label>
                  <input
                    type="date"
                    value={normalizeToISODate(editDraft.data_venda) || ""}
                    onChange={(e) => campo("data_venda", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    Salva como <code>YYYY-MM-DD</code> em <code>data_venda</code>.
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
                    {DIRETORIAS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
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
                    {executivos.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
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
