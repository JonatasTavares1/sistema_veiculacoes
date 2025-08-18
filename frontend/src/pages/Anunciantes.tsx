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
  cnpj_anunciante: string // pode conter CPF ou CNPJ
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

// ---------- Utils: CPF/CNPJ ----------
function digits(s: string) { return (s || "").replace(/\D+/g, "") }
function allSame(s: string) { return /^(\d)\1+$/.test(s) }

function formatCPF(cpf: string) {
  const d = digits(cpf).slice(0, 11).padEnd(11, "_")
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}
function formatCNPJ(cnpj: string) {
  const d = digits(cnpj).slice(0, 14).padEnd(14, "_")
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
function validateCPF(v: string) {
  const d = digits(v)
  if (d.length !== 11 || allSame(d)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i)
  let rest = (sum * 10) % 11; if (rest === 10) rest = 0
  if (rest !== parseInt(d[9], 10)) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i)
  rest = (sum * 10) % 11; if (rest === 10) rest = 0
  return rest === parseInt(d[10], 10)
}
function validateCNPJ(v: string) {
  const d = digits(v)
  if (d.length !== 14 || allSame(d)) return false
  const calc = (len: number) => {
    const weights = len === 12
      ? [5,4,3,2,9,8,7,6,5,4,3,2]
      : [6,5,4,3,2,9,8,7,6,5,4,3,2]
    let sum = 0
    for (let i = 0; i < weights.length; i++) sum += parseInt(d[i], 10) * weights[i]
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  const dig1 = calc(12)
  const dig2 = calc(13)
  return dig1 === parseInt(d[12], 10) && dig2 === parseInt(d[13], 10)
}
function emailValido(e: string) { return !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }

export default function Anunciantes() {
  // form
  const [nome, setNome] = useState("")
  const [razao, setRazao] = useState("")
  const [doc, setDoc] = useState("") // CPF ou CNPJ
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
  const [buscandoDoc, setBuscandoDoc] = useState(false)

  // filtros
  const [busca, setBusca] = useState("")

  // status do documento
  const docInfo = useMemo(() => {
    const d = digits(doc)
    if (d.length === 11) return { tipo: "CPF" as const, valido: validateCPF(d), format: formatCPF }
    if (d.length === 14) return { tipo: "CNPJ" as const, valido: validateCNPJ(d), format: formatCNPJ }
    return { tipo: d.length <= 11 ? ("CPF" as const) : ("CNPJ" as const), valido: false, format: d.length <= 11 ? formatCPF : formatCNPJ }
  }, [doc])

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

  // auto preenche apenas quando for CNPJ válido
  async function autoPreencherPorDocumento() {
    const d = digits(doc)
    if (!(d.length === 14 && validateCNPJ(d))) {
      alert("Auto-preenchimento disponível apenas para CNPJ válido.")
      return
    }
    setBuscandoDoc(true)
    setErro(null)
    try {
      let data: any | null = null
      try {
        data = await getJSON<any>(`${API}/anunciantes/cnpj/${d}`)
      } catch {
        const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`)
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
        alert("Documento não encontrado.")
      }
    } catch {
      alert("Erro ao consultar documento.")
    } finally {
      setBuscandoDoc(false)
    }
  }

  function validar(): string | null {
    const d = digits(doc)
    const cpfOk = d.length === 11 && validateCPF(d)
    const cnpjOk = d.length === 14 && validateCNPJ(d)
    if (!nome.trim()) return "Nome é obrigatório."
    if (!cpfOk && !cnpjOk) return "Informe um CPF (11) ou CNPJ (14) válido."
    if (!executivo || executivo === "Selecione o Executivo") return "Executivo é obrigatório."
    if (!emailValido(email)) return "Email inválido."
    return null
  }

  async function salvar() {
    const msg = validar()
    if (msg) { alert(msg); return }
    setSalvando(true); setErro(null)
    try {
      const docFmt = docInfo.tipo === "CPF" ? formatCPF(doc) : formatCNPJ(doc)
      const body = {
        nome_anunciante: nome.trim(),
        razao_social_anunciante: razao.trim(),
        cnpj_anunciante: docFmt.trim(), // campo legado, pode conter CPF ou CNPJ
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

  // lista filtrada
  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return lista
    return lista.filter(a =>
      a.nome_anunciante.toLowerCase().includes(q) ||
      (a.cnpj_anunciante || "").toLowerCase().includes(q) ||
      (a.executivo || "").toLowerCase().includes(q)
    )
  }, [lista, busca])

  // ✅ Exporta XLSX a partir da lista filtrada
  async function exportarXLSX() {
    try {
      const xlsx = await import("xlsx")
      const dados = filtrada.map(a => ({
        Nome: a.nome_anunciante,
        Documento: a.cnpj_anunciante,
        UF: a.uf_cliente || "",
        Executivo: a.executivo,
        Email: a.email_anunciante || "",
        DataCadastro: a.data_cadastro || "",
      }))
      const wb = xlsx.utils.book_new()
      const ws = xlsx.utils.json_to_sheet(dados)
      xlsx.utils.book_append_sheet(wb, ws, "Anunciantes")
      const hoje = new Date().toISOString().slice(0,10)
      xlsx.writeFile(wb, `anunciantes_${hoje}.xlsx`)
    } catch (err) {
      alert("Não foi possível exportar. Instale a dependência com:\n\nnpm i xlsx")
    }
  }

  return (
    <div className="space-y-8">
      {/* Título + ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Cadastro de Anunciante</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={exportarXLSX}
            className="px-5 py-3 rounded-2xl bg-white border border-red-300 text-red-700 text-lg font-semibold hover:bg-red-50 transition shadow-sm"
          >
            📁 Exportar Excel
          </button>
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

          <div className="lg:col-span-2">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xl font-semibold text-slate-800 mb-2">CPF ou CNPJ</label>
                <input
                  value={doc}
                  onChange={(e) => setDoc(e.target.value)}
                  onBlur={() => {
                    const d = digits(doc)
                    if (d.length === 11 && validateCPF(d)) setDoc(formatCPF(d))
                    else if (d.length === 14 && validateCNPJ(d)) setDoc(formatCNPJ(d))
                  }}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                  placeholder="Digite CPF (11) ou CNPJ (14)"
                />
                <div className="mt-1 text-sm">
                  <span className={[
                    "inline-flex items-center rounded-full px-2.5 py-0.5",
                    docInfo.valido
                      ? "bg-green-100 text-green-800 border border-green-200"
                      : digits(doc).length ? "bg-red-100 text-red-800 border border-red-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                  ].join(" ")}>
                    {docInfo.tipo} {digits(doc).length ? (docInfo.valido ? "válido" : "inválido") : ""}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={autoPreencherPorDocumento}
                disabled={buscandoDoc || !(docInfo.tipo === "CNPJ" && docInfo.valido)}
                className="h-[52px] px-5 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
                title="Buscar dados (apenas CNPJ válido)"
              >
                {buscandoDoc ? "Buscando..." : "🔍 Doc"}
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
            <div className="text-slate-600 text-base">{filtrada.length} registro(s)</div>
            <button
              onClick={exportarXLSX}
              className="px-4 py-2 rounded-xl bg-white border border-red-300 text-red-700 text-base font-medium hover:bg-red-50 transition"
            >
              📁 Exportar Excel
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : (
          <>
            {filtrada.length === 0 ? (
              <div className="p-4 text-slate-600 text-lg">Nenhum anunciante cadastrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="bg-red-600/90 text-white">
                      {["Nome", "Documento", "UF", "Executivo", "Email", "Data de Cadastro"].map(h => (
                        <th key={h} className="px-4 py-3 text-base font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrada.map((a) => (
                      <tr key={a.id} className="border-b last:border-none hover:bg-red-50">
                        <td className="px-4 py-3 text-base text-slate-800">{a.nome_anunciante}</td>
                        <td className="px-4 py-3 text-base text-slate-800">{a.cnpj_anunciante}</td>
                        <td className="px-4 py-3 text-base text-slate-800">{a.uf_cliente || ""}</td>
                        <td className="px-4 py-3 text-base text-slate-800">{a.executivo}</td>
                        <td className="px-4 py-3 text-base text-slate-800">{a.email_anunciante || ""}</td>
                        <td className="px-4 py-3 text-base text-slate-800">{a.data_cadastro || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
