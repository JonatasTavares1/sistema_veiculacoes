// src/pages/CadastroPI.tsx
import { useEffect, useMemo, useState } from "react"

// ====== Tipos ======
type TipoPI = "Matriz" | "Normal" | "CS" | "Abatimento"
type PISimple = { numero_pi: string; nome_campanha?: string | null }

// ====== HTTP helpers (sem axios) ======
const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}
async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let detail = await r.text()
    try { detail = (await r.json()).detail ?? detail } catch {}
    throw new Error(detail || `Erro ${r.status}`)
  }
  return r.json()
}

// ====== Constantes UI ======
const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO","EX (Exterior)"
]
const CANAIS = [
  "SITE","YOUTUBE","INSTAGRAM","FACEBOOK","TIKTOK","TWITTER","DOOH",
  "GOOGLE","PROGRAMMATIC","RADIO","PORTAL","REVISTA","JORNAL","INFLUENCIADOR","TV","OUTROS"
]
const PERFIS = ["Privado", "Governo estadual", "Governo federal"]
const SUBPERFIS = [
  "Privado","Governo estadual","GDF - DETRAN","Sistema S Federal","Governo Federal",
  "GDF - TERRACAP","Sistema S Regional","CLDF","GDF - SECOM","GDF - BRB",
  "Governo Estadual - RJ","Privado - PATROCINIO","Privado - Ambipar",
  "Governo Federal - PATROCINIO","Privado - BYD","Privado - Gestao Executiva","Gestao Executiva - PATROCINIO"
]
const EXECUTIVOS_FALLBACK = [
  "Rafale e Francio","Rafael Rodrigo","Rodrigo da Silva","Juliana Madazio",
  "Flavio de Paula","Lorena Fernandes","Henri Marques","Caio Bruno",
  "Flavia Cabral","Paula Caroline","Leila Santos","Jessica Ribeiro","Paula Campos"
]
const DIRETORIAS = ["Governo Federal", "Governo Estadual", "Rafael Augusto"]

// ====== Helpers de formatação/parsing ======
const onlyDigits = (s: string) => (s || "").replace(/\D/g, "")

/** Aceita "1.234,56", "1234,56", "1234.56" e retorna número JS */
function parseMoney(input: string): number | null {
  const t = (input ?? "").toString().trim().replace(/\s+/g, "")
  if (!t) return null
  // se tem vírgula, trata como decimal pt-BR (remove milhares ".", troca vírgula por ".")
  if (t.includes(",")) {
    const norm = t.replace(/\./g, "").replace(",", ".")
    const n = Number(norm)
    return Number.isFinite(n) ? n : null
  }
  // sem vírgula: tenta número normal (pode ter . como decimal)
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export default function CadastroPI() {
  // ===== Identificação
  const [tipoPI, setTipoPI] = useState<TipoPI>("Normal")
  const [numeroPI, setNumeroPI] = useState("")

  // vínculos
  const [matrizesAtivas, setMatrizesAtivas] = useState<PISimple[]>([])
  const [normaisAtivos, setNormaisAtivos] = useState<PISimple[]>([])
  const [numeroPIMatriz, setNumeroPIMatriz] = useState("")
  const [numeroPINormal, setNumeroPINormal] = useState("")

  // ===== Anunciante
  const [cnpjAnunciante, setCnpjAnunciante] = useState("")
  const [nomeAnunciante, setNomeAnunciante] = useState("")
  const [razaoAnunciante, setRazaoAnunciante] = useState("")
  const [ufCliente, setUfCliente] = useState("DF")

  // ===== Agência (opcional)
  const [temAgencia, setTemAgencia] = useState(true)
  const [cnpjAgencia, setCnpjAgencia] = useState("")
  const [nomeAgencia, setNomeAgencia] = useState("")
  const [razaoAgencia, setRazaoAgencia] = useState("")
  const [ufAgencia, setUfAgencia] = useState("DF")

  // ===== Campanha
  const [nomeCampanha, setNomeCampanha] = useState("")
  const [canal, setCanal] = useState("SITE")
  const [perfilAnunciante, setPerfilAnunciante] = useState("Privado")
  const [subperfilAnunciante, setSubperfilAnunciante] = useState("Privado")

  // ===== Datas & Período de venda
  const [mesVenda, setMesVenda] = useState("") // "07/2025"
  const [diaVenda, setDiaVenda] = useState("") // "23"
  const [vencimento, setVencimento] = useState<string>("")   // yyyy-mm-dd
  const [dataEmissao, setDataEmissao] = useState<string>("") // yyyy-mm-dd

  // ===== Responsáveis & Valores
  const [executivos, setExecutivos] = useState<string[]>(EXECUTIVOS_FALLBACK)
  const [executivo, setExecutivo] = useState(EXECUTIVOS_FALLBACK[0])
  const [diretoria, setDiretoria] = useState(DIRETORIAS[0])
  const [valorBruto, setValorBruto] = useState<string>("")
  const [valorLiquido, setValorLiquido] = useState<string>("")
  const [observacoes, setObservacoes] = useState<string>("")

  // ===== UX
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // ===== Loads iniciais
  useEffect(() => {
    (async () => {
      try {
        const mats = await getJSON<PISimple[]>(`${API}/matrizes/ativos`)
        setMatrizesAtivas(mats || [])
      } catch (e) { console.warn("Falha matrizes:", e) }
      try {
        const norms = await getJSON<PISimple[]>(`${API}/pis/normal/ativos`)
        setNormaisAtivos(norms || [])
      } catch (e) { console.warn("Falha normais:", e) }
      try {
        const ex = await getJSON<string[]>(`${API}/executivos`)
        if (Array.isArray(ex) && ex.length) { setExecutivos(ex); setExecutivo(ex[0]) }
      } catch { /* fallback já setado */ }
    })()
  }, [])

  // alterna seções condicionais
  useEffect(() => {
    setErro(null); setMsg(null)
    if (tipoPI !== "Abatimento") setNumeroPIMatriz("")
    if (tipoPI !== "CS") setNumeroPINormal("")
  }, [tipoPI])

  // ===== Buscar por CNPJ (BD -> BrasilAPI fallback)
  async function buscarAnunciante() {
    const cnpj = onlyDigits(cnpjAnunciante)
    if (!cnpj) return setErro("Informe o CNPJ do anunciante.")
    setErro(null); setMsg(null)
    try {
      const reg = await getJSON<any>(`${API}/anunciantes/cnpj/${cnpj}`)
      setNomeAnunciante(reg?.nome_anunciante || "")
      setRazaoAnunciante(reg?.razao_social_anunciante || "")
      setUfCliente(reg?.uf_cliente || "DF")
      setMsg("Anunciante carregado do cadastro.")
    } catch {
      try {
        const br = await getJSON<any>(`${API}/anunciantes/cnpj/${cnpj}/consulta`)
        setNomeAnunciante(br?.nome_fantasia || br?.razao_social || "")
        setRazaoAnunciante(br?.razao_social || "")
        setUfCliente(br?.uf || br?.estado || "DF")
        setMsg("Pré-preenchido via BrasilAPI.")
      } catch { setErro("Não encontrado na base nem na BrasilAPI.") }
    }
  }
  async function buscarAgencia() {
    const cnpj = onlyDigits(cnpjAgencia)
    if (!cnpj) return setErro("Informe o CNPJ da agência.")
    setErro(null); setMsg(null)
    try {
      const reg = await getJSON<any>(`${API}/agencias/cnpj/${cnpj}`)
      setNomeAgencia(reg?.nome_agencia || "")
      setRazaoAgencia(reg?.razao_social_agencia || "")
      setUfAgencia(reg?.uf_agencia || "DF")
      setMsg("Agência carregada do cadastro.")
    } catch {
      try {
        const br = await getJSON<any>(`${API}/agencias/cnpj/${cnpj}/consulta`)
        setNomeAgencia(br?.nome_fantasia || br?.razao_social || "")
        setRazaoAgencia(br?.razao_social || "")
        setUfAgencia(br?.uf || br?.estado || "DF")
        setMsg("Pré-preenchido via BrasilAPI.")
      } catch { setErro("Não encontrada na base nem na BrasilAPI.") }
    }
  }

  // ===== Regras de envio
  const podeEnviar = useMemo(() => {
    if (!numeroPI.trim()) return false
    if (tipoPI === "Abatimento") {
      if (!numeroPIMatriz) return false
      const v = parseMoney(valorBruto)
      if (!v || v <= 0) return false
    }
    if (tipoPI === "CS" && !numeroPINormal) return false
    return true
  }, [numeroPI, tipoPI, numeroPIMatriz, numeroPINormal, valorBruto])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro(null); setMsg(null)
    try {
      const vb = parseMoney(valorBruto)
      const vl = parseMoney(valorLiquido)

      const payload: any = {
        numero_pi: numeroPI.trim(),
        tipo_pi: tipoPI,
        // anunciante
        nome_anunciante: nomeAnunciante || undefined,
        razao_social_anunciante: razaoAnunciante || undefined,
        cnpj_anunciante: onlyDigits(cnpjAnunciante) || undefined,
        uf_cliente: ufCliente || undefined,
        // agência
        nome_agencia: temAgencia ? (nomeAgencia || undefined) : undefined,
        razao_social_agencia: temAgencia ? (razaoAgencia || undefined) : undefined,
        cnpj_agencia: temAgencia ? (onlyDigits(cnpjAgencia) || undefined) : undefined,
        uf_agencia: temAgencia ? (ufAgencia || undefined) : undefined,
        // campanha
        nome_campanha: nomeCampanha || undefined,
        canal: canal || undefined,
        perfil_anunciante: perfilAnunciante || undefined,
        subperfil_anunciante: subperfilAnunciante || undefined,
        // datas
        mes_venda: mesVenda || undefined,
        dia_venda: diaVenda || undefined,
        vencimento: vencimento || undefined,      // yyyy-mm-dd ok
        data_emissao: dataEmissao || undefined,  // yyyy-mm-dd ok
        // responsáveis e valores
        executivo: executivo || undefined,
        diretoria: diretoria || undefined,
        valor_bruto: vb ?? undefined,
        valor_liquido: vl ?? undefined,
        observacoes: (observacoes || "").trim(),
      }
      if (tipoPI === "Abatimento") payload.numero_pi_matriz = numeroPIMatriz
      if (tipoPI === "CS") payload.numero_pi_normal = numeroPINormal

      console.debug("POST /pis payload =>", payload)

      const res = await postJSON<any>(`${API}/pis`, payload)
      setMsg(`PI criada: ${res.numero_pi} (${res.tipo_pi})`)
      setNumeroPI("")
      // mantém demais campos para cadastros em sequência
    } catch (err: any) {
      setErro(err?.message || "Erro ao cadastrar PI.")
    } finally {
      setLoading(false)
    }
  }

  // ===== UI
  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Cadastro de Pedido de Inserção</h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700 border border-red-200">
          <span className="h-2 w-2 rounded-full bg-red-600" /> modo cadastro
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Identificação */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Identificação</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Número do PI</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                placeholder="Digite o número do PI"
                value={numeroPI}
                onChange={(e) => setNumeroPI(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de PI</label>
              <div className="flex flex-wrap gap-2">
                {(["Matriz","Normal","CS","Abatimento"] as const).map((tipo) => {
                  const selected = tipoPI === tipo
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setTipoPI(tipo)}
                      className={[
                        "px-3 py-2 rounded-full border text-sm transition",
                        selected
                          ? "bg-red-600 text-white border-red-600 shadow"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      ].join(" ")}
                    >
                      {tipo}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* vínculos condicionais */}
          {tipoPI === "Abatimento" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Vincular a PI Matriz (com saldo)</label>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                  value={numeroPIMatriz}
                  onChange={(e) => setNumeroPIMatriz(e.target.value)}
                >
                  <option value="">-- escolha --</option>
                  {matrizesAtivas.map((m) => (
                    <option key={m.numero_pi} value={m.numero_pi}>
                      {m.numero_pi}{m.nome_campanha ? ` — ${m.nome_campanha}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tipoPI === "CS" && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Vincular a PI Normal</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={numeroPINormal}
                onChange={(e) => setNumeroPINormal(e.target.value)}
              >
                <option value="">-- escolha --</option>
                {normaisAtivos.map((n) => (
                  <option key={n.numero_pi} value={n.numero_pi}>
                    {n.numero_pi}{n.nome_campanha ? ` — ${n.nome_campanha}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* Anunciante */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Informações do Anunciante</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ do Anunciante</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                  placeholder="Somente números"
                  value={cnpjAnunciante}
                  onChange={(e) => setCnpjAnunciante(e.target.value)}
                />
                <button
                  type="button"
                  onClick={buscarAnunciante}
                  className="px-3 py-2 rounded-xl border border-red-600 text-red-700 hover:bg-red-50 transition"
                >
                  Buscar
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Anunciante</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={nomeAnunciante}
                onChange={(e) => setNomeAnunciante(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={razaoAnunciante}
                onChange={(e) => setRazaoAnunciante(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">UF do Cliente</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={ufCliente}
                onChange={(e) => setUfCliente(e.target.value)}
              >
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Agência */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Agência (opcional)</h2>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={temAgencia}
                onChange={(e) => setTemAgencia(e.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
              Possui agência?
            </label>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${temAgencia ? "" : "opacity-60 pointer-events-none"}`}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ da Agência</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                  placeholder="Somente números"
                  value={cnpjAgencia}
                  onChange={(e) => setCnpjAgencia(e.target.value)}
                />
                <button
                  type="button"
                  onClick={buscarAgencia}
                  className="px-3 py-2 rounded-xl border border-red-600 text-red-700 hover:bg-red-50 transition"
                >
                  Buscar
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Agência</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={nomeAgencia}
                onChange={(e) => setNomeAgencia(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social da Agência</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={razaoAgencia}
                onChange={(e) => setRazaoAgencia(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">UF da Agência</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={ufAgencia}
                onChange={(e) => setUfAgencia(e.target.value)}
              >
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Campanha */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Dados da Campanha</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Campanha</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={nomeCampanha}
                onChange={(e) => setNomeCampanha(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Canal (Meio)</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={canal}
                onChange={(e) => setCanal(e.target.value)}
              >
                {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Perfil do Anunciante</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={perfilAnunciante}
                onChange={(e) => setPerfilAnunciante(e.target.value)}
              >
                {PERFIS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Subperfil do Anunciante</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={subperfilAnunciante}
                onChange={(e) => setSubperfilAnunciante(e.target.value)}
              >
                {SUBPERFIS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Datas & Período de Venda */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Datas e Período de Venda</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mês da Venda (MM/AAAA)</label>
              <input
                type="text" placeholder="07/2025"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={mesVenda}
                onChange={(e) => setMesVenda(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dia da Venda (DD)</label>
              <input
                type="text" placeholder="23"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={diaVenda}
                onChange={(e) => setDiaVenda(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento</label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de Emissão</label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Responsáveis & Valores */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Responsáveis e Valores</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Executivo Responsável</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={executivo}
                onChange={(e) => setExecutivo(e.target.value)}
              >
                {executivos.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Diretoria</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={diretoria}
                onChange={(e) => setDiretoria(e.target.value)}
              >
                {DIRETORIAS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Bruto</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder={tipoPI === "Abatimento" ? "Obrigatório para Abatimento" : "ex: 1.234,56"}
                className={[
                  "w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-4",
                  "focus:ring-red-100",
                  tipoPI === "Abatimento" ? "border-red-400" : "border-slate-300"
                ].join(" ")}
                value={valorBruto}
                onChange={(e) => setValorBruto(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Líquido (opcional)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="ex: 1.000,00"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={valorLiquido}
                onChange={(e) => setValorLiquido(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações (opcional)</label>
              <input
                type="text" placeholder="Escreva observações gerais"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Ações */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!podeEnviar || loading}
            className="bg-red-600 text-white font-semibold px-6 py-2 rounded-xl hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm"
          >
            {loading ? "Cadastrando..." : "Cadastrar PI"}
          </button>
          {msg && <span className="text-green-700">{msg}</span>}
          {erro && <span className="text-red-700">{erro}</span>}
        </div>
      </form>
    </div>
  )
}
