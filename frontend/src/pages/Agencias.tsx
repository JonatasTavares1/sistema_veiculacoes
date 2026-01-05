// src/pages/Agencias.tsx
import { useEffect, useMemo, useState } from "react"
import { apiGet, apiPost, apiPut } from "../services/api"

/*const API = import.meta.env.VITE_API_URL || "http://localhost:8000"*/

// ✅ Fallback local de executivos (sempre disponível)
const DEFAULT_EXECUTIVOS = [
  "Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio",
  "Flavio de Paula", "Lorena Fernandes", "Caio Bruno", "Flavia Cabral",
  "Carol Carvalho", "Leila Santos", "Jessica Ribeiro",
  "Paula Campos", "Janaina Orlani"
]

type Agencia = {
  id: number
  nome_agencia: string
  razao_social_agencia?: string | null
  cnpj_agencia: string
  uf_agencia?: string | null
  executivo: string
  email_agencia?: string | null
  data_cadastro?: string | null

  // 🔥 Campos extras já existentes
  grupo_empresarial?: string | null
  codinome?: string | null
  site?: string | null
  linkedin?: string | null
  instagram?: string | null

  // 🧩 Novos campos (iguais aos de Anunciantes)
  endereco?: string | null
  logradouro?: string | null
  bairro?: string | null
  cep?: string | null
  segmento?: string | null
  subsegmento?: string | null
  telefone_socio1?: string | null
  telefone_socio2?: string | null
}

// -------- Constantes / Utils --------
const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
]
function digits(s: string) { return (s || "").replace(/\D+/g, "") }
function emailOk(e: string) { return !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }

// ---- CNPJ (parcial para input) ----
function formatCNPJPartial(v: string) {
  const d = digits(v).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

// ✅ CNPJ de exibição (tabela/export)
function formatCNPJDisplay(v?: string | null) {
  const d = digits(v || "")
  if (d.length === 14) {
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }
  if (!d) return ""
  return formatCNPJPartial(d)
}

// ---- Normalizador simples de URL ----
function normalizeUrl(u?: string | null): string | null {
  if (!u) return null
  const t = u.trim()
  if (!t) return null
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(t)) return t
  return `https://${t}`
}

// ---- CEP e Telefone (mesmos de Anunciantes) ----
function formatCepPartial(v: string) {
  const d = digits(v).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0,5)}-${d.slice(5)}`
}
function formatPhoneBR(v: string) {
  const d = digits(v).slice(0, 11)
  if (!d) return ""
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// ---- Export helpers ----
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
  return "\uFEFF" + head + "\n" + body
}

// ---- deep clean ----
function deepClean<T = any>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === "string") {
    const t = obj.trim()
    return (t === "" ? null : t) as unknown as T
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClean(item)) as unknown as T
  }

  if (typeof obj === "object") {
    const out: any = {}
    for (const [k, v] of Object.entries(obj as any)) {
      out[k] = deepClean(v as any)
    }
    return out as T
  }

  return obj
}

// Tipos locais para os blocos dinâmicos (contatos / executivos)
type ContatoEmpresa = {
  nome: string
  cargo: string
  email: string
  telefone: string
}
type ExecutivoResponsavel = {
  executivo: string
  pracaUf: string
  observacao: string
}

// ===================== Componente =====================
export default function Agencias() {
  // ================= FORM PRINCIPAL =================

  // 2ª fileira: Nome Empresarial / Título do Estabelecimento
  const [razao, setRazao] = useState("")
  const [nome, setNome] = useState("")

  // 1ª fileira: CNPJ
  const [cnpj, setCnpj] = useState("")
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)

  // 3ª fileira: Codinome / Grupo Empresarial
  const [codinome, setCodinome] = useState("")
  const [grupoEmpresarial, setGrupoEmpresarial] = useState("")

  // 4ª fileira: Logradouro / Número / Complemento / CEP
  const [logradouro, setLogradouro] = useState("")
  const [numero, setNumero] = useState("")
  const [endereco, setEndereco] = useState("") // complemento / observações
  const [cep, setCep] = useState("")

  // 5ª fileira: Bairro / Município / UF / Endereço completo oficial no site
  const [bairro, setBairro] = useState("")
  const [municipio, setMunicipio] = useState("")
  const [uf, setUf] = useState("DF")
  const [enderecoCompletoSite, setEnderecoCompletoSite] = useState("")

  // 6ª fileira: E-mail (cartão CNPJ) / Telefone (cartão CNPJ) / Segmento / Subsegmento
  const [email, setEmail] = useState("")          // E-mail no cartão CNPJ
  const [telefoneSocio1, setTelefoneSocio1] = useState("") // Telefone no cartão CNPJ
  const [segmento, setSegmento] = useState("")
  const [subsegmento, setSubsegmento] = useState("")

  // 7ª fileira: Site / Instagram / LinkedIn / Extensão de e-mail
  const [site, setSite] = useState("")
  const [instagram, setInstagram] = useState("")
  const [linkedin, setLinkedin] = useState("")
  const [extensaoEmail, setExtensaoEmail] = useState("")

  // 8ª fileira: E-mail geral do site / Telefone geral do site
  const [emailGeralSite, setEmailGeralSite] = useState("")
  const [telefoneGeralSite, setTelefoneGeralSite] = useState("")

  // 9ª fileira: Contatos da empresa (dinâmico)
  const [contatos, setContatos] = useState<ContatoEmpresa[]>([
    { nome: "", cargo: "", email: "", telefone: "" },
  ])

  // 10ª fileira: Executivos responsáveis (dinâmico)
  const [executivosAtendimento, setExecutivosAtendimento] = useState<ExecutivoResponsavel[]>([
    { executivo: "", pracaUf: "DF", observacao: "" },
  ])

  // dados
  const [executivos, setExecutivos] = useState<string[]>([...DEFAULT_EXECUTIVOS])
  const [lista, setLista] = useState<Agencia[]>([])

  // ui
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // filtros
  const [busca, setBusca] = useState("")

  // editor
  const [editOpen, setEditOpen] = useState(false)
  const [editItem, setEditItem] = useState<Agencia | null>(null)
  const [editErro, setEditErro] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  async function carregar() {
    setLoading(true); setErro(null)
    try {
      const [exs, ags] = await Promise.all([
        // protegida (leva Bearer). Se sua rota /executivos for pública, troque para: apiGet(..., { auth: false })
        apiGet<string[]>("/executivos").catch(() => []),
        apiGet<Agencia[]>("/agencias"),
      ])

      const mergedExecs = Array.from(
        new Set([...(Array.isArray(exs) ? exs : []), ...DEFAULT_EXECUTIVOS]),
      ).sort((a, b) => a.localeCompare(b, "pt-BR"))

      setExecutivos(mergedExecs)
      setLista(Array.isArray(ags) ? ags : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar dados.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { carregar() }, [])

  async function autoPreencherPorCNPJ() {
    const num = digits(cnpj)
    if (num.length !== 14) {
      alert("Informe um CNPJ válido (14 dígitos).")
      return
    }
    setBuscandoCNPJ(true)
    setErro(null)
    try {
      let data: any | null = null
      try {
        // rota interna (protegida)
        data = await apiGet<any>(`/agencias/cnpj/${num}`)
      } catch {
        // fallback público
        const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${num}`)
        if (r.ok) data = await r.json()
      }

      if (data) {
        const nomeFantasia = data.nome_fantasia || data.fantasia || ""
        const razaoSocial  = data.razao_social || data.nome || ""
        const ufApi        = data.uf || data.estado || ""
        const logradouroApi =
          data.logradouro ||
          (data.descricao_tipo_logradouro && data.descricao_logradouro
            ? `${data.descricao_tipo_logradouro} ${data.descricao_logradouro}`
            : "")
        const bairroApi    = data.bairro || ""
        const cepApi       = data.cep || ""
        const municipioApi = data.municipio || data.municipio_descricao || data.cidade || ""

        if (nomeFantasia) setNome(nomeFantasia)
        if (razaoSocial) setRazao(razaoSocial)
        if (ufApi && UFS.includes(ufApi)) setUf(ufApi)
        if (logradouroApi) setLogradouro(logradouroApi)
        if (bairroApi) setBairro(bairroApi)
        if (cepApi) setCep(formatCepPartial(cepApi))
        if (municipioApi) setMunicipio(municipioApi)

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
    if (!cnpj.trim()) return "CNPJ é obrigatório."
    const dig = digits(cnpj)
    if (dig.length !== 14) return "O CNPJ deve conter 14 dígitos."
    if (!razao.trim()) return "Nome empresarial é obrigatório."
    if (!nome.trim()) return "Nome de fantasia é obrigatório."

    const principalExec = executivosAtendimento.find(
      (e) => e.executivo && e.executivo.trim(),
    )
    if (!principalExec) return "Executivo responsável é obrigatório."

    if (!emailOk(email)) return "Email do cartão CNPJ inválido."
    return null
  }

  async function salvar() {
    const msg = validar()
    if (msg) { alert(msg); return }

    const principalExec = executivosAtendimento.find(
      (e) => e.executivo && e.executivo.trim(),
    )!

    setSalvando(true); setErro(null)
    try {
      const raw = {
        // Nome fantasia e razão social
        nome_agencia: nome,
        razao_social_agencia: razao,

        // CNPJ
        cnpj_agencia: formatCNPJPartial(cnpj),

        // Localização básica
        uf_agencia: uf,

        // Responsável principal
        executivo: principalExec.executivo,
        email_agencia: email,

        // extras
        grupo_empresarial: grupoEmpresarial,
        codinome,
        site: normalizeUrl(site),
        linkedin: normalizeUrl(linkedin),
        instagram: normalizeUrl(instagram),

        // novos (endereços/segmento/telefones já existentes no backend)
        endereco,              // complemento / observações
        logradouro,
        bairro,
        cep: formatCepPartial(cep),
        segmento,
        subsegmento,
        telefone_socio1: formatPhoneBR(telefoneSocio1),
        telefone_socio2: formatPhoneBR(telefoneGeralSite), // telefone geral aproveitado

        // ⚠️ Campos VISUAIS novos que ainda NÃO estão mapeados no modelo:
        // numero, municipio, enderecoCompletoSite, extensaoEmail, emailGeralSite,
        // contatos, executivosAtendimento
      }
      const body = deepClean(raw)

      await apiPost("/agencias", body)

      // reset
      setCnpj("")
      setRazao("")
      setNome("")
      setCodinome("")
      setGrupoEmpresarial("")
      setLogradouro("")
      setNumero("")
      setEndereco("")
      setCep("")
      setBairro("")
      setMunicipio("")
      setUf("DF")
      setEnderecoCompletoSite("")
      setEmail("")
      setTelefoneSocio1("")
      setSegmento("")
      setSubsegmento("")
      setSite("")
      setInstagram("")
      setLinkedin("")
      setExtensaoEmail("")
      setEmailGeralSite("")
      setTelefoneGeralSite("")
      setContatos([{ nome: "", cargo: "", email: "", telefone: "" }])
      setExecutivosAtendimento([{ executivo: "", pracaUf: "DF", observacao: "" }])

      await carregar()
      alert("Agência cadastrada com sucesso!")
    } catch (e: any) {
      setErro(e?.message || "Erro ao cadastrar agência.")
    } finally {
      setSalvando(false)
    }
  }

  // Exportar
  async function exportarPlanilha(rows: Agencia[]) {
    if (!rows?.length) { alert("Nada para exportar."); return }
    const data = rows.map(a => ({
      Nome: a.nome_agencia,
      "Razão Social": a.razao_social_agencia || "",
      CNPJ: formatCNPJDisplay(a.cnpj_agencia),
      UF: a.uf_agencia || "",
      Executivo: a.executivo || "",
      Email: a.email_agencia || "",
      "Grupo Empresarial": a.grupo_empresarial || "",
      Codinome: a.codinome || "",
      Site: a.site || "",
      LinkedIn: a.linkedin || "",
      Instagram: a.instagram || "",
      Endereço: a.endereco || "",
      Logradouro: a.logradouro || "",
      Bairro: a.bairro || "",
      CEP: a.cep || "",
      Segmento: a.segmento || "",
      "Subsegmento": a.subsegmento || "",
      "Telefone Sócio 1": a.telefone_socio1 || "",
      "Telefone Sócio 2": a.telefone_socio2 || "",
      "Data de Cadastro": a.data_cadastro || "",
    }))
    const nomeArq = `agencias_${new Date().toISOString().slice(0,10)}.xlsx`
    try {
      const XLSX = await import("xlsx")
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Agências")
      XLSX.writeFile(wb, nomeArq)
    } catch {
      const csv = jsonToCSV(data)
      downloadBlob(csv, nomeArq.replace(/\.xlsx$/, ".csv"), "text/csv;charset=utf-8;")
      alert("Exportei em CSV (fallback). Para .xlsx nativo, instale a lib 'xlsx'.")
    }
  }

  // Filtro
  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const qDigits = digits(q)
    if (!q) return lista
    return lista.filter(a => {
      const cnpjDigits = digits(a.cnpj_agencia || "")
      const inText = (s?: string | null) => (s || "").toLowerCase().includes(q)
      const inUrl = (u?: string | null) => (u || "").toLowerCase().includes(q)
      return (
        a.nome_agencia.toLowerCase().includes(q) ||
        inText(a.razao_social_agencia) ||
        inText(a.codinome) ||
        inText(a.grupo_empresarial) ||
        inText(a.endereco) ||
        inText(a.logradouro) ||
        inText(a.bairro) ||
        inText(a.cep) ||
        inText(a.segmento) ||
        inText(a.subsegmento) ||
        inText(a.telefone_socio1) ||
        inText(a.telefone_socio2) ||
        (a.cnpj_agencia || "").toLowerCase().includes(q) ||
        (qDigits && cnpjDigits.includes(qDigits)) ||
        (a.executivo || "").toLowerCase().includes(q) ||
        (a.email_agencia || "").toLowerCase().includes(q) ||
        inUrl(a.site) || inUrl(a.linkedin) || inUrl(a.instagram)
      )
    })
  }, [lista, busca])

  // ------- Editor -------
  function abrirEditor(a: Agencia) {
    setEditErro(null)
    setEditItem({
      ...a,
      razao_social_agencia: a.razao_social_agencia || "",
      email_agencia: a.email_agencia || "",
      uf_agencia: a.uf_agencia || "DF",
      cnpj_agencia: formatCNPJPartial(a.cnpj_agencia || ""),
      executivo: a.executivo || "",

      grupo_empresarial: a.grupo_empresarial || "",
      codinome: a.codinome || "",
      site: a.site || "",
      linkedin: a.linkedin || "",
      instagram: a.instagram || "",

      // novos
      endereco: a.endereco || "",
      logradouro: a.logradouro || "",
      bairro: a.bairro || "",
      cep: a.cep || "",
      segmento: a.segmento || "",
      subsegmento: a.subsegmento || "",
      telefone_socio1: a.telefone_socio1 || "",
      telefone_socio2: a.telefone_socio2 || "",
    })
    setEditOpen(true)
  }
  function fecharEditor() {
    setEditOpen(false)
    setEditItem(null)
    setEditErro(null)
  }
  function campoEdit<K extends keyof Agencia>(k: K, v: Agencia[K]) {
    if (!editItem) return
    setEditItem({ ...editItem, [k]: v })
  }
  async function salvarEdicao() {
    if (!editItem) return
    if (!editItem.nome_agencia?.trim()) { setEditErro("Nome é obrigatório."); return }
    const dig = digits(editItem.cnpj_agencia || "")
    if (dig.length !== 14) { setEditErro("O CNPJ deve conter 14 dígitos."); return }
    if (!editItem.executivo?.trim()) { setEditErro("Executivo é obrigatório."); return }
    if (!emailOk(editItem.email_agencia || "")) { setEditErro("Email inválido."); return }

    setSavingEdit(true); setEditErro(null)
    try {
      const raw = {
        nome_agencia: editItem.nome_agencia,
        razao_social_agencia: editItem.razao_social_agencia ?? "",
        cnpj_agencia: editItem.cnpj_agencia,
        uf_agencia: editItem.uf_agencia || "",
        executivo: editItem.executivo,
        email_agencia: editItem.email_agencia ?? "",

        grupo_empresarial: editItem.grupo_empresarial ?? "",
        codinome: editItem.codinome ?? "",
        site: normalizeUrl(editItem.site || ""),
        linkedin: normalizeUrl(editItem.linkedin || ""),
        instagram: normalizeUrl(editItem.instagram || ""),

        // novos
        endereco: editItem.endereco ?? "",
        logradouro: editItem.logradouro ?? "",
        bairro: editItem.bairro ?? "",
        cep: formatCepPartial(editItem.cep || ""),
        segmento: editItem.segmento ?? "",
        subsegmento: editItem.subsegmento ?? "",
        telefone_socio1: formatPhoneBR(editItem.telefone_socio1 || ""),
        telefone_socio2: formatPhoneBR(editItem.telefone_socio2 || ""),
      }
      const body = deepClean(raw)

      await apiPut(`/agencias/${editItem.id}`, body)

      fecharEditor()
      await carregar()
    } catch (e: any) {
      setEditErro(e?.message || "Falha ao salvar edição.")
    } finally {
      setSavingEdit(false)
    }
  }

  // Badge de link
  const LinkPill = ({ href, label }: { href?: string | null, label: string }) => {
    if (!href) return null
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 text-xs font-semibold transition"
        title={href}
      >
        {label}
      </a>
    )
  }

  // Helpers para linhas dinâmicas
  function addContato() {
    setContatos(prev => [...prev, { nome: "", cargo: "", email: "", telefone: "" }])
  }
  function updateContato(index: number, field: keyof ContatoEmpresa, value: string) {
    setContatos(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  function addExecutivoAtendimento() {
    setExecutivosAtendimento(prev => [
      ...prev,
      { executivo: "", pracaUf: "DF", observacao: "" },
    ])
  }
  function updateExecutivoAtendimento(
    index: number,
    field: keyof ExecutivoResponsavel,
    value: string,
  ) {
    setExecutivosAtendimento(prev =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    )
  }

  // ===================== UI =====================
  return (
    <div className="space-y-8">
      {/* Título */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Cadastro de Agência</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={carregar}
            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Formulário na ordem que você pediu */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {erro && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
            {erro}
          </div>
        )}

        <div className="space-y-6">
          {/* GRID PRINCIPAL */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
            {/* 1ª fileira: apenas CNPJ (campo menor) */}
            <div className="xl:col-span-4">
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                CNPJ
              </label>
              <div className="flex flex-col xl:flex-row xl:items-end gap-3">
                <input
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCNPJPartial(e.target.value))}
                  onBlur={() => setCnpj(formatCNPJPartial(cnpj))}
                  className="w-full xl:w-[320px] h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                             focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                  placeholder="12.345.678/0001-90"
                />
                <button
                  type="button"
                  onClick={autoPreencherPorCNPJ}
                  disabled={buscandoCNPJ || digits(cnpj).length !== 14}
                  className="h-[52px] px-5 rounded-2xl bg-red-600 text-white text-lg font-semibold 
                             hover:bg-red-700 disabled:opacity-60"
                  title="Buscar dados pelo CNPJ"
                >
                  {buscandoCNPJ ? "Buscando..." : "🔍 CNPJ"}
                </button>
              </div>
            </div>

            {/* 2ª fileira: Nome Empresarial, Título do Estabelecimento */}
            <div className="xl:col-span-2">
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Nome Empresarial
              </label>
              <input
                value={razao}
                onChange={(e) => setRazao(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Razão social no CNPJ"
              />
            </div>
            <div className="xl:col-span-2">
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Título do Estabelecimento (Nome de Fantasia)
              </label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Nome fantasia / como aparece no mercado"
              />
            </div>

            {/* 3ª fileira: Codinome, Grupo Empresarial */}
            <div className="xl:col-span-2">
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Codinome
              </label>
              <input
                value={codinome}
                onChange={(e) => setCodinome(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Identificador curto (interno)"
              />
            </div>
            <div className="xl:col-span-2">
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Grupo Empresarial
              </label>
              <input
                value={grupoEmpresarial}
                onChange={(e) => setGrupoEmpresarial(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Ex.: Grupo ACME"
              />
            </div>
          </div>

          {/* Divisória */}
          <hr className="border-t border-slate-200" />

          {/* 4ª e 5ª fileiras - Endereço */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
            {/* 4ª fileira: Logradouro, Número, Complemento, CEP */}
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Logradouro
              </label>
              <input
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Rua / Avenida"
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Número
              </label>
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Ex.: 123"
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Complemento
              </label>
              <input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Sala, bloco, torre, etc."
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                CEP
              </label>
              <input
                value={cep}
                onChange={(e) => setCep(formatCepPartial(e.target.value))}
                onBlur={() => setCep(formatCepPartial(cep))}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="00000-000"
                inputMode="numeric"
              />
            </div>

            {/* 5ª fileira: Bairro/Distrito, Município, UF, Endereço completo oficial no site */}
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Bairro / Distrito
              </label>
              <input
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Ex.: Centro"
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Município
              </label>
              <input
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Cidade"
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                UF
              </label>
              <select
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
              >
                {UFS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Endereço completo oficial no site
              </label>
              <input
                value={enderecoCompletoSite}
                onChange={(e) => setEnderecoCompletoSite(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Como aparece no site oficial"
              />
            </div>
          </div>

          {/* Divisória */}
          <hr className="border-t border-slate-200" />

          {/* 6ª, 7ª e 8ª fileiras */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
            {/* 6ª fileira: E-mail / Telefone (cartão CNPJ) / Segmento / Subsegmento */}
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                E-mail (cartão CNPJ)
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="E-mail fiscal / oficial"
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Telefone (cartão CNPJ)
              </label>
              <input
                value={telefoneSocio1}
                onChange={(e) => setTelefoneSocio1(formatPhoneBR(e.target.value))}
                onBlur={() => setTelefoneSocio1(formatPhoneBR(telefoneSocio1))}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="(11) 90000-0000"
                inputMode="tel"
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Segmento de atuação
              </label>
              <input
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Ex.: Varejo, Tecnologia, Saúde..."
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Subsegmento de atuação
              </label>
              <input
                value={subsegmento}
                onChange={(e) => setSubsegmento(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Ex.: Supermercado, SaaS, Hospital..."
              />
            </div>

            {/* 7ª fileira: Site / Instagram / LinkedIn / Extensão de e-mail */}
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Site
              </label>
              <input
                value={site}
                onChange={(e) => setSite(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="ex.: agencia.com.br"
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Instagram
              </label>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="ex.: instagram.com/agencia"
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                LinkedIn
              </label>
              <input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="ex.: linkedin.com/company/agencia"
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Extensão de e-mail
              </label>
              <input
                value={extensaoEmail}
                onChange={(e) => setExtensaoEmail(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="ex.: @agencia.com.br"
              />
            </div>

            {/* 8ª fileira: E-mail geral do site / Telefone geral do site */}
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                E-mail de contato geral no site
              </label>
              <input
                value={emailGeralSite}
                onChange={(e) => setEmailGeralSite(e.target.value)}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="contato@agencia.com.br"
              />
            </div>
            <div>
              <label className="block text-xl font-semibold text-slate-800 mb-2">
                Telefone de contato geral no site
              </label>
              <input
                value={telefoneGeralSite}
                onChange={(e) => setTelefoneGeralSite(formatPhoneBR(e.target.value))}
                onBlur={() => setTelefoneGeralSite(formatPhoneBR(telefoneGeralSite))}
                className="w-full h-[52px] rounded-xl border border-slate-300 px-4 text-lg 
                           focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="(11) 90000-0000"
                inputMode="tel"
              />
            </div>
          </div>

          {/* Divisória */}
          <hr className="border-t border-slate-200" />

          {/* 9ª fileira: Contatos da empresa (lista dinâmica) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                Contatos da empresa
              </h2>
              <button
                type="button"
                onClick={addContato}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold 
                           hover:bg-red-700"
              >
                + Adicionar contato
              </button>
            </div>

            {contatos.map((cont, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 xl:grid-cols-4 gap-4 border border-slate-200 rounded-2xl p-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Contato {idx + 1} - Nome
                  </label>
                  <input
                    value={cont.nome}
                    onChange={(e) => updateContato(idx, "nome", e.target.value)}
                    className="w-full h-[44px] rounded-xl border border-slate-300 px-3 text-base 
                               focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Cargo
                  </label>
                  <input
                    value={cont.cargo}
                    onChange={(e) => updateContato(idx, "cargo", e.target.value)}
                    className="w-full h-[44px] rounded-xl border border-slate-300 px-3 text-base 
                               focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
                    placeholder="Cargo na empresa"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    E-mail
                  </label>
                  <input
                    value={cont.email}
                    onChange={(e) => updateContato(idx, "email", e.target.value)}
                    className="w-full h-[44px] rounded-xl border border-slate-300 px-3 text-base 
                               focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Telefone
                  </label>
                  <input
                    value={cont.telefone}
                    onChange={(e) =>
                      updateContato(idx, "telefone", formatPhoneBR(e.target.value))
                    }
                    onBlur={(e) =>
                      updateContato(idx, "telefone", formatPhoneBR(e.target.value))
                    }
                    className="w-full h-[44px] rounded-xl border border-slate-300 px-3 text-base 
                               focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
                    placeholder="(11) 90000-0000"
                    inputMode="tel"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Divisória */}
          <hr className="border-t border-slate-200" />

          {/* 10ª fileira: Executivos responsáveis (lista dinâmica) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                Executivo(s) responsável(eis) pelo atendimento
              </h2>
              <button
                type="button"
                onClick={addExecutivoAtendimento}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold 
                           hover:bg-red-700"
              >
                + Adicionar executivo
              </button>
            </div>

            {executivosAtendimento.map((exResp, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 xl:grid-cols-3 gap-4 border border-slate-200 rounded-2xl p-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Executivo {idx + 1}
                  </label>
                  <select
                    value={exResp.executivo}
                    onChange={(e) =>
                      updateExecutivoAtendimento(idx, "executivo", e.target.value)
                    }
                    className="w-full h-[44px] rounded-xl border border-slate-300 px-3 text-base 
                               focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
                  >
                    <option value="">Selecione o Executivo</option>
                    {executivos.map(ex => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Praças (UF) de atuação
                  </label>
                  <input
                    value={exResp.pracaUf}
                    onChange={(e) =>
                      updateExecutivoAtendimento(idx, "pracaUf", e.target.value)
                    }
                    className="w-full h-[44px] rounded-xl border border-slate-300 px-3 text-base 
                               focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
                    placeholder="Ex.: DF, GO, RJ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Observação
                  </label>
                  <input
                    value={exResp.observacao}
                    onChange={(e) =>
                      updateExecutivoAtendimento(idx, "observacao", e.target.value)
                    }
                    className="w-full h-[44px] rounded-xl border border-slate-300 px-3 text-base 
                               focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
                    placeholder="Informações adicionais do executivo"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Botão salvar */}
          <div className="pt-2">
            <button
              onClick={salvar}
              disabled={salvando}
              className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold 
                         hover:bg-red-700 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Cadastrar Agência"}
            </button>
          </div>
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold text-slate-900">Agências cadastradas</h2>
          <div className="flex items-center gap-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, codinome, CNPJ, executivo, grupo, localidade, segmento..."
              className="w-80 rounded-xl border border-slate-300 px-4 py-2.5 text-base 
                         focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
            <button
              onClick={() => exportarPlanilha(filtrada)}
              disabled={!filtrada.length}
              className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold 
                         hover:bg-red-700 disabled:opacity-60"
              title="Exportar para Excel"
            >
              ⬇️ Exportar Excel
            </button>
            <div className="text-slate-600 text-base">
              {filtrada.length} registro(s)
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : filtrada.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nenhuma agência cadastrada.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-red-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-red-200">
                <thead className="bg-gradient-to-r from-red-700 to-red-600 text-white sticky top-0">
                  <tr>
                    {[
                      "Nome / Razão",
                      "Codinome",
                      "Grupo",
                      "CNPJ",
                      "UF",
                      "Segmento",
                      "Localidade",
                      "Contato",
                      "Redes",
                      "Cadastro",
                      "Ações",
                    ].map(h => (
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
                        "hover:bg-red-50",
                      ].join(" ")}
                    >
                      <td className="px-6 py-4 text-slate-900 text-base font-medium">
                        <div className="flex flex-col">
                          <span className="truncate">{a.nome_agencia}</span>
                          {a.razao_social_agencia ? (
                            <span className="text-sm text-slate-500 truncate">
                              {a.razao_social_agencia}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-800 text-base">
                        {a.codinome ? (
                          <span className="font-mono">{a.codinome}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-slate-800 text-base">
                        {a.grupo_empresarial || (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-slate-800 text-base">
                        <span className="font-mono">
                          {formatCNPJDisplay(a.cnpj_agencia)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-semibold">
                          {a.uf_agencia || "—"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-800 text-base">
                        <div className="flex flex-col">
                          <span className="truncate">{a.segmento || "—"}</span>
                          {a.subsegmento ? (
                            <span className="text-sm text-slate-500 truncate">
                              {a.subsegmento}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-800 text-base">
                        <div className="flex flex-col">
                          <span className="truncate">
                            {a.logradouro || a.endereco || "—"}
                          </span>
                          <span className="text-sm text-slate-500 truncate">
                            {a.bairro ? `${a.bairro} • ` : ""}
                            {a.cep || ""}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-800 text-base">
                        <div className="flex flex-col gap-1">
                          {a.email_agencia ? (
                            <a
                              href={`mailto:${a.email_agencia}`}
                              className="underline decoration-red-300 hover:decoration-red-500 break-all"
                            >
                              {a.email_agencia}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {a.telefone_socio1 ? (
                            <span className="text-sm text-slate-700">
                              {a.telefone_socio1}
                            </span>
                          ) : null}
                          {a.telefone_socio2 ? (
                            <span className="text-sm text-slate-700">
                              {a.telefone_socio2}
                            </span>
                          ) : null}
                          {a.site ? (
                            <a
                              href={a.site}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-red-700 underline decoration-red-300 hover:decoration-red-500 break-all"
                            >
                              {a.site}
                            </a>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <LinkPill href={a.linkedin} label="LinkedIn" />
                          <LinkPill href={a.instagram} label="Instagram" />
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-700 text-sm">
                        {a.data_cadastro || "—"}
                      </td>

                      <td className="px-6 py-4">
                        <button
                          onClick={() => abrirEditor(a)}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                          title="Editar"
                        >
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Modal de EDIÇÃO */}
      {editOpen && editItem && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharEditor} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">
                  Editar Agência
                </div>
                <div className="mt-1 text-2xl font-extrabold text-slate-900">
                  {editItem.nome_agencia}
                </div>
              </div>
              <button
                onClick={fecharEditor}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                ✖ Fechar
              </button>
            </div>

            <div className="p-6 space-y-5">
              {editErro && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
                  {editErro}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Nome
                  </label>
                  <input
                    value={editItem.nome_agencia || ""}
                    onChange={(e) => campoEdit("nome_agencia", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Razão Social
                  </label>
                  <input
                    value={editItem.razao_social_agencia || ""}
                    onChange={(e) => campoEdit("razao_social_agencia", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Codinome
                  </label>
                  <input
                    value={editItem.codinome || ""}
                    onChange={(e) => campoEdit("codinome", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    placeholder="Identificador curto (único)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Grupo Empresarial
                  </label>
                  <input
                    value={editItem.grupo_empresarial || ""}
                    onChange={(e) => campoEdit("grupo_empresarial", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    CNPJ
                  </label>
                  <input
                    value={editItem.cnpj_agencia || ""}
                    onChange={(e) =>
                      campoEdit("cnpj_agencia", formatCNPJPartial(e.target.value))
                    }
                    onBlur={() =>
                      campoEdit(
                        "cnpj_agencia",
                        formatCNPJPartial(editItem.cnpj_agencia || ""),
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    UF
                  </label>
                  <select
                    value={editItem.uf_agencia || "DF"}
                    onChange={(e) => campoEdit("uf_agencia", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {UFS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Executivo
                  </label>
                  <select
                    value={editItem.executivo || ""}
                    onChange={(e) => campoEdit("executivo", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">— Selecione —</option>
                    {executivos.map(ex => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    value={editItem.email_agencia || ""}
                    onChange={(e) => campoEdit("email_agencia", e.target.value)}
                    placeholder="contato@agencia.com.br"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                {/* Redes / Sites */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Site
                  </label>
                  <input
                    value={editItem.site || ""}
                    onChange={(e) => campoEdit("site", e.target.value)}
                    placeholder="ex.: agencia.com.br"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    LinkedIn
                  </label>
                  <input
                    value={editItem.linkedin || ""}
                    onChange={(e) => campoEdit("linkedin", e.target.value)}
                    placeholder="ex.: linkedin.com/company/agencia"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Instagram
                  </label>
                  <input
                    value={editItem.instagram || ""}
                    onChange={(e) => campoEdit("instagram", e.target.value)}
                    placeholder="ex.: instagram.com/agencia"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                {/* 🧩 Novos campos */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Endereço (complemento/observações)
                  </label>
                  <input
                    value={editItem.endereco || ""}
                    onChange={(e) => campoEdit("endereco", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Logradouro
                  </label>
                  <input
                    value={editItem.logradouro || ""}
                    onChange={(e) => campoEdit("logradouro", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    placeholder="Ex.: Rua/Av. e número"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Bairro
                  </label>
                  <input
                    value={editItem.bairro || ""}
                    onChange={(e) => campoEdit("bairro", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    CEP
                  </label>
                  <input
                    value={editItem.cep || ""}
                    onChange={(e) =>
                      campoEdit("cep", formatCepPartial(e.target.value))
                    }
                    onBlur={() =>
                      campoEdit("cep", formatCepPartial(editItem.cep || ""))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Segmento
                  </label>
                  <input
                    value={editItem.segmento || ""}
                    onChange={(e) => campoEdit("segmento", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    placeholder="Ex.: Varejo, Tecnologia, Saúde..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Subsegmento
                  </label>
                  <input
                    value={editItem.subsegmento || ""}
                    onChange={(e) => campoEdit("subsegmento", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    placeholder="Ex.: Supermercado, SaaS, Hospital..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Telefone Sócio 1
                  </label>
                  <input
                    value={editItem.telefone_socio1 || ""}
                    onChange={(e) =>
                      campoEdit(
                        "telefone_socio1",
                        formatPhoneBR(e.target.value),
                      )
                    }
                    onBlur={() =>
                      campoEdit(
                        "telefone_socio1",
                        formatPhoneBR(editItem.telefone_socio1 || ""),
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    placeholder="(11) 90000-0000"
                    inputMode="tel"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Telefone Sócio 2
                  </label>
                  <input
                    value={editItem.telefone_socio2 || ""}
                    onChange={(e) =>
                      campoEdit(
                        "telefone_socio2",
                        formatPhoneBR(e.target.value),
                      )
                    }
                    onBlur={() =>
                      campoEdit(
                        "telefone_socio2",
                        formatPhoneBR(editItem.telefone_socio2 || ""),
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    placeholder="(11) 90000-0000"
                    inputMode="tel"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={salvarEdicao}
                  disabled={savingEdit}
                  className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {savingEdit ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
