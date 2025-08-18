// src/pages/Anunciantes.tsx
import { useEffect, useMemo, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

// ✅ Fallback local de executivos
const DEFAULT_EXECUTIVOS = [
  "Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio",
  "Flavio de Paula", "Lorena Fernandes", "Henri Marques", "Caio Bruno",
  "Flavia Cabral", "Paula Caroline", "Leila Santos", "Jessica Ribeiro",
  "Paula Campos",
]

type Anunciante = {
  id: number
  nome_anunciante: string
  razao_social_anunciante?: string | null
  cnpj_anunciante: string            // aqui pode vir CPF ou CNPJ
  uf_cliente?: string | null
  executivo: string
  email_anunciante?: string | null
  data_cadastro?: string | null
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}
async function postJSON<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => "")
    throw new Error(`${r.status} ${r.statusText}${t ? " - " + t : ""}`)
  }
  return r.json()
}

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
]

function digits(s: string) { return (s || "").replace(/\D+/g, "") }
function emailOk(e: string) { return !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }

// ---- Formatação progressiva CPF/CNPJ (sem padding/underscore) ----
function formatCpfPartial(v: string) {
  const d = digits(v).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}
function formatCnpjPartial(v: string) {
  const d = digits(v).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
function formatDocPartial(v: string) {
  const d = digits(v)
  if (d.length <= 11) return formatCpfPartial(v)      // até 11 vai no padrão CPF
  return formatCnpjPartial(v)                          // acima de 11, CNPJ
}
function normalizeDocForSave(v: string) {
  // Mantém com pontuação (frontend envia assim), backend só armazena string.
  // Se quiser enviar só dígitos: return digits(v)
  return formatDocPartial(v)
}

// ---- Export helpers (xlsx se possível; fallback CSV) ----
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

export default function Anunciantes() {
  // form
  const [nome, setNome] = useState("")
  const [razao, setRazao] = useState("")
  const [doc, setDoc] = useState("")           // CPF ou CNPJ
  const [uf, setUf] = useState("DF")
  const [email, setEmail] = useState("")
  const [executivo, setExecutivo] = useState("")

  // dados
  const [executivos, setExecutivos] = useState<string[]>([...DEFAULT_EXECUTIVOS])
  const [lista, setLista] = useState<Anunciante[]>([])

  // ui
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)

  // filtros
  const [busca, setBusca] = useState("")

  async function carregar() {
    setLoading(true); setErro(null)
    try {
      const [exs, ans] = await Promise.all([
        getJSON<string[]>(`${API}/executivos`).catch(() => []),
        getJSON<Anunciante[]>(`${API}/anunciantes`)
      ])
      const mergedExecs = Array.from(
        new Set([...(Array.isArray(exs) ? exs : []), ...DEFAULT_EXECUTIVOS])
      ).sort((a, b) => a.localeCompare(b, "pt-BR"))
      setExecutivos(mergedExecs)
      setLista(Array.isArray(ans) ? ans : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar dados.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { carregar() }, [])

  // auto-preencher SÓ para CNPJ (14 dígitos)
  async function autoPreencherPorCNPJ() {
    const num = digits(doc)
    if (num.length !== 14) {
      alert("Para preencher automático, informe um CNPJ (14 dígitos).")
      return
    }
    setBuscandoCNPJ(true)
    setErro(null)
    try {
      let data: any | null = null
      try {
        data = await getJSON<any>(`${API}/anunciantes/cnpj/${num}`)
      } catch {
        const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${num}`)
        if (r.ok) data = await r.json()
      }
      if (data) {
        const nomeFantasia = data.nome_fantasia || data.fantasia || ""
        const razaoSocial  = data.razao_social || data.nome || ""
        const ufApi        = data.uf || data.estado || ""
        if (nomeFantasia) setNome(nomeFantasia)
        if (razaoSocial) setRazao(razaoSocial)
        if (ufApi && UFS.includes(ufApi)) setUf(ufApi)
        alert("Dados preenchidos automaticamente pelo CNPJ.")
      } else {
        alert("CNPJ não encontrado.")
      }
    } catch {
      alert("Erro ao consultar CNPJ.")
    } finally {
      setBuscandoCNPJ(false)
    }
  }

  function validar(): string | null {
    if (!nome.trim()) return "Nome é obrigatório."
    const d = digits(doc)
    if (!(d.length === 11 || d.length === 14)) {
      return "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)."
    }
    if (!executivo || executivo === "Selecione o Executivo") return "Executivo é obrigatório."
    if (!emailOk(email)) return "Email inválido."
    return null
  }

  async function salvar() {
    const msg = validar()
    if (msg) { alert(msg); return }
    setSalvando(true); setErro(null)
    try {
      const body = {
        nome_anunciante: nome.trim(),
        razao_social_anunciante: razao.trim(),
        cnpj_anunciante: normalizeDocForSave(doc), // aceita CPF ou CNPJ
        uf_cliente: uf,
        executivo,
        email_anunciante: email.trim() || null,
      }
      await postJSON(`${API}/anunciantes`, body)
      setNome(""); setRazao(""); setDoc(""); setUf("DF"); setEmail(""); setExecutivo("")
      await carregar()
      alert("Anunciante cadastrado com sucesso!")
    } catch (e: any) {
      setErro(e?.message || "Erro ao cadastrar anunciante.")
    } finally {
      setSalvando(false)
    }
  }

  // ---- Exportar Excel / CSV ----
  async function exportarPlanilha(rows: Anunciante[]) {
    if (!rows?.length) { alert("Nada para exportar."); return }
    const data = rows.map(a => ({
      Nome: a.nome_anunciante,
      "Razão Social": a.razao_social_anunciante || "",
      Documento: a.cnpj_anunciante,
      UF: a.uf_cliente || "",
      Executivo: a.executivo || "",
      Email: a.email_anunciante || "",
      "Data de Cadastro": a.data_cadastro || "",
    }))
    const nomeArq = `anunciantes_${new Date().toISOString().slice(0,10)}.xlsx`

    try {
      const XLSX = await import("xlsx")
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Anunciantes")
      XLSX.writeFile(wb, nomeArq)
    } catch {
      const csv = jsonToCSV(data)
      downloadBlob(csv, nomeArq.replace(/\.xlsx$/, ".csv"), "text/csv;charset=utf-8;")
      alert("Exportei em CSV (fallback). Para .xlsx nativo, instale a lib 'xlsx'.")
    }
  }

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return lista
    return lista.filter(a =>
      a.nome_anunciante.toLowerCase().includes(q) ||
      (a.cnpj_anunciante || "").toLowerCase().includes(q) ||
      (a.executivo || "").toLowerCase().includes(q)
    )
  }, [lista, busca])

  // máscara de exibição na tabela (garante pontuação correta)
  function maskDocDisplay(v: string) { return formatDocPartial(v) }

  return (
    <div className="space-y-8">
      {/* Título */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Cadastro de Anunciante</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={carregar}
            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Formulário */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {erro && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">{erro}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Nome do Anunciante</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
              placeholder="Ex.: ACME Ltda"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Razão Social</label>
            <input
              value={razao}
              onChange={(e) => setRazao(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
              placeholder="Ex.: ACME Indústria e Comércio LTDA"
            />
          </div>

          <div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xl font-semibold text-slate-800 mb-2">Documento (CPF ou CNPJ)</label>
                <input
                  value={doc}
                  onChange={(e) => setDoc(formatDocPartial(e.target.value))}
                  onBlur={() => setDoc(formatDocPartial(doc))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                  placeholder="CPF: 000.000.000-00  •  CNPJ: 00.000.000/0000-00"
                />
              </div>
              <button
                type="button"
                onClick={autoPreencherPorCNPJ}
                disabled={buscandoCNPJ || digits(doc).length !== 14}
                className="h-[52px] px-5 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
                title="Buscar dados pelo CNPJ"
              >
                {buscandoCNPJ ? "Buscando..." : "🔍 CNPJ"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">UF</label>
            <select
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
              placeholder="contato@empresa.com.br"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Executivo Responsável</label>
            <select
              value={executivo}
              onChange={(e) => setExecutivo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Selecione o Executivo</option>
              {executivos.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={salvar}
            disabled={salvando}
            className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Cadastrar Anunciante"}
          </button>
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold text-slate-900">Anunciantes cadastrados</h2>
          <div className="flex items-center gap-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, documento ou executivo"
              className="w-72 rounded-xl border border-slate-300 px-4 py-2.5 text-base focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
            <button
              onClick={() => exportarPlanilha(filtrada)}
              disabled={!filtrada.length}
              className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
              title="Exportar para Excel"
            >
              ⬇️ Exportar Excel
            </button>
            <div className="text-slate-600 text-base">{filtrada.length} registro(s)</div>
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : filtrada.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nenhum anunciante cadastrado.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-red-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-red-200">
                <thead className="bg-gradient-to-r from-red-700 to-red-600 text-white sticky top-0">
                  <tr>
                    {["Nome", "Documento", "UF", "Executivo", "Email", "Data de Cadastro"].map(h => (
                      <th
                        key={h}
                        className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {filtrada.map((a, idx) => (
                    <tr
                      key={a.id}
                      className={[
                        "transition",
                        idx % 2 === 0 ? "bg-white" : "bg-red-50/40",
                        "hover:bg-red-50"
                      ].join(" ")}
                    >
                      <td className="px-6 py-4 text-slate-900 text-base font-medium">
                        <div className="flex flex-col">
                          <span className="truncate">{a.nome_anunciante}</span>
                          {a.razao_social_anunciante ? (
                            <span className="text-sm text-slate-500 truncate">{a.razao_social_anunciante}</span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-800 text-base">
                        <span className="font-mono">{maskDocDisplay(a.cnpj_anunciante)}</span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-semibold">
                          {a.uf_cliente || "—"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-800 text-base">
                        <div className="truncate">{a.executivo || "—"}</div>
                      </td>

                      <td className="px-6 py-4 text-slate-800 text-base">
                        {a.email_anunciante ? (
                          <a
                            href={`mailto:${a.email_anunciante}`}
                            className="underline decoration-red-300 hover:decoration-red-500 break-all"
                          >
                            {a.email_anunciante}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-slate-700 text-sm">
                        {a.data_cadastro || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
