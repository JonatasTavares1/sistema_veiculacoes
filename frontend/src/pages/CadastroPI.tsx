// src/pages/CadastroPI.tsx
import { useEffect, useMemo, useState } from "react"

// ====== Tipos ======
type TipoPI = "Matriz" | "Normal" | "CS" | "Abatimento"
type PISimple = { numero_pi: string; nome_campanha?: string | null }

type VeicDraft = {
  canal?: string
  formato?: string
  data_inicio?: string // yyyy-mm-dd
  data_fim?: string    // yyyy-mm-dd
  quantidade?: number | null
  valor?: number | null
}

type ProdutoDraft = {
  nome: string
  bruto_str: string
  desconto_str: string
  liquido_str: string
  veiculacoes: VeicDraft[]
}

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

function fmtMoney(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "R$ 0,00"
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
/** Aceita "1.234,56", "1234,56", "1234.56" e retorna número JS */
function parseMoney(input: string): number | null {
  const t = (input ?? "").toString().trim().replace(/\s+/g, "")
  if (!t) return null
  if (t.includes(",")) {
    const norm = t.replace(/\./g, "").replace(",", ".")
    const n = Number(norm)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
function parsePercent(input: string): number | null {
  const t = (input ?? "").toString().trim().replace("%","").replace(",", ".")
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}
function nearEq(a: number, b: number, tol = 0.01) {
  return Math.abs(a - b) <= tol
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

  // ===== Produtos & Veiculações
  const [opcoesProdutoNome, setOpcoesProdutoNome] = useState<string[]>([])
  const [produtos, setProdutos] = useState<ProdutoDraft[]>([])

  // ===== UX
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // ===== Loads iniciais
  useEffect(() => {
    (async () => {
      try {
        const mats = await getJSON<PISimple[]>(`${API}/matrizes/ativos`).catch(() => getJSON<PISimple[]>(`${API}/pis/matriz/ativos`))
        setMatrizesAtivas(mats || [])
      } catch {}
      try {
        const norms = await getJSON<PISimple[]>(`${API}/pis/normal/ativos`)
        setNormaisAtivos(norms || [])
      } catch {}
      try {
        const ex = await getJSON<string[]>(`${API}/executivos`)
        if (Array.isArray(ex) && ex.length) { setExecutivos(ex); setExecutivo(ex[0]) }
      } catch {}
      // nomes de produtos (catálogo)
      try {
        const list = await getJSON<any[]>(`${API}/produtos`)
        const nomes = (Array.isArray(list) ? list : []).map((p:any) => String(p.nome || "")).filter(Boolean)
        setOpcoesProdutoNome(Array.from(new Set(nomes)))
      } catch {
        try {
          const nomes = await getJSON<string[]>(`${API}/produtos/opcoes-nome`)
          setOpcoesProdutoNome(Array.isArray(nomes) ? nomes : [])
        } catch {}
      }
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

  // ===== Produtos & Veiculações - helpers
  function addProduto() {
    setProdutos(prev => [...prev, { nome: "", bruto_str: "", desconto_str: "", liquido_str: "", veiculacoes: [] }])
  }
  function rmProduto(idx: number) {
    setProdutos(prev => prev.filter((_, i) => i !== idx))
  }
  function setProduto(idx: number, patch: Partial<ProdutoDraft>) {
    setProdutos(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }
  function addVeic(idx: number) {
    setProdutos(prev => prev.map((p, i) =>
      i === idx ? { ...p, veiculacoes: [...p.veiculacoes, { canal: "", formato: "", data_inicio: "", data_fim: "", quantidade: null, valor: null }] } : p
    ))
  }
  function rmVeic(idx: number, vIdx: number) {
    setProdutos(prev => prev.map((p, i) =>
      i === idx ? { ...p, veiculacoes: p.veiculacoes.filter((_, j) => j !== vIdx) } : p
    ))
  }
  function setVeic(idx: number, vIdx: number, patch: Partial<VeicDraft>) {
    setProdutos(prev => prev.map((p, i) =>
      i === idx ? { ...p, veiculacoes: p.veiculacoes.map((v, j) => j === vIdx ? { ...v, ...patch } : v) } : p
    ))
  }

  function numbersFromDraft(p: ProdutoDraft) {
    const b = parseMoney(p.bruto_str ?? "")
    const d = parsePercent(p.desconto_str ?? "")
    const lInf = parseMoney(p.liquido_str ?? "")
    const lCalc = (b != null && d != null) ? Number((b * (1 - d / 100)).toFixed(2)) : null
    const mismatch = (lInf != null && lCalc != null) ? !nearEq(lInf, lCalc) : false
    return { b, d, lInf, lCalc, mismatch }
  }

  // Totais dos produtos
  const { somaBrutoProdutos, somaLiquidoProdutos, liquidoCalcProdutos, algumMismatch } = useMemo(() => {
    let b = 0, l = 0, lc = 0, mis = false
    for (const p of produtos) {
      const { b: pb, lInf, lCalc, mismatch } = numbersFromDraft(p)
      b += pb ?? 0
      l += lInf ?? (lCalc ?? 0)
      lc += lCalc ?? 0
      if (mismatch) mis = true
    }
    return { somaBrutoProdutos: b, somaLiquidoProdutos: l, liquidoCalcProdutos: lc, algumMismatch: mis }
  }, [produtos])

  // ===== Regras de envio
  const podeEnviar = useMemo(() => {
    if (!numeroPI.trim()) return false
    if (tipoPI === "CS" && !numeroPINormal) return false
    if (tipoPI === "Abatimento" && !numeroPIMatriz) return false
    // precisa ter ao menos 1 produto
    if (produtos.length === 0) return false
    // todos os produtos precisam bater líqu. informado x calculado
    if (algumMismatch) return false
    // PI precisa ter bruto e líquido informados
    const vb = parseMoney(valorBruto); const vl = parseMoney(valorLiquido)
    if (vb == null || vl == null) return false
    // somatórios dos produtos precisam bater com PI
    if (!nearEq(vb, somaBrutoProdutos) || !nearEq(vl, somaLiquidoProdutos)) return false
    return true
  }, [numeroPI, tipoPI, numeroPINormal, numeroPIMatriz, produtos, algumMismatch, valorBruto, valorLiquido, somaBrutoProdutos, somaLiquidoProdutos])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro(null); setMsg(null)
    try {
      // validações explícitas (para mensagens mais claras)
      if (produtos.length === 0) throw new Error("Adicione ao menos um produto.")
      const diverg = produtos
        .map((p, i) => ({ i, nome: p.nome || `Produto ${i+1}`, ...numbersFromDraft(p) }))
        .filter(x => x.mismatch)
      if (diverg.length) {
        const lista = diverg.map(x => `• ${x.nome}: Líquido informado ${fmtMoney(x.lInf!)} ≠ calculado ${fmtMoney(x.lCalc!)}`).join("\n")
        throw new Error(`Ajuste os valores dos produtos:\n${lista}`)
      }

      const vb = parseMoney(valorBruto); const vl = parseMoney(valorLiquido)
      if (vb == null || vl == null) throw new Error("Informe o Valor Bruto e o Valor Líquido do PI.")
      if (!nearEq(vb, somaBrutoProdutos) || !nearEq(vl, somaLiquidoProdutos)) {
        throw new Error(
          `Os totais dos produtos não batem com o PI.\n` +
          `• Bruto do PI: ${fmtMoney(vb)} | Soma dos produtos: ${fmtMoney(somaBrutoProdutos)}\n` +
          `• Líquido do PI: ${fmtMoney(vl)} | Soma dos produtos: ${fmtMoney(somaLiquidoProdutos)}`
        )
      }

      // 1) cria o PI
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
        valor_bruto: Number(vb.toFixed(2)),
        valor_liquido: Number(vl.toFixed(2)),
        observacoes: (observacoes || "").trim(),
      }
      if (tipoPI === "Abatimento") payload.numero_pi_matriz = numeroPIMatriz
      if (tipoPI === "CS") payload.numero_pi_normal = numeroPINormal

      const pi = await postJSON<any>(`${API}/pis`, payload)

      // 2) cria veiculações (opcional) — sem vincular produto_id (apenas nome)
      const chamadas: Promise<any>[] = []
      for (const p of produtos) {
        for (const v of p.veiculacoes) {
          const body: any = {
            numero_pi: pi.numero_pi,
            produto_nome: (p.nome || "").trim() || undefined,
            canal: (v.canal || "").trim() || undefined,
            formato: (v.formato || "").trim() || undefined,
            data_inicio: (v.data_inicio || "").trim() || undefined,
            data_fim: (v.data_fim || "").trim() || undefined,
            quantidade: v.quantidade == null ? undefined : Number(v.quantidade),
            valor: v.valor == null ? undefined : Number(v.valor),
          }
          chamadas.push(postJSON(`${API}/veiculacoes`, body))
        }
      }
      if (chamadas.length) await Promise.all(chamadas)

      setMsg(`PI criada: ${pi.numero_pi} (${pi.tipo_pi})`)
      setNumeroPI("")
      setProdutos([])
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

        {/* >>> Produtos & Veiculações (agora abaixo do período da venda) <<< */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Produtos & Veiculações</h2>
            <button
              type="button"
              onClick={addProduto}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              ➕ Adicionar produto
            </button>
          </div>

          {produtos.length === 0 ? (
            <div className="text-slate-600">Nenhum produto adicionado.</div>
          ) : (
            <div className="space-y-6">
              {produtos.map((p, idx) => {
                const { b, d, lInf, lCalc, mismatch } = numbersFromDraft(p)
                return (
                  <div key={idx} className="rounded-xl border border-slate-200">
                    {/* Cabeçalho do produto */}
                    <div className="flex items-start justify-between px-4 py-3 border-b bg-slate-50 gap-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Produto</label>
                          <input
                            list="produtos-list"
                            value={p.nome}
                            onChange={(e) => setProduto(idx, { nome: e.target.value })}
                            placeholder="Digite ou escolha"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2"
                          />
                          <datalist id="produtos-list">
                            {opcoesProdutoNome.map(n => <option key={n} value={n} />)}
                          </datalist>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Valor Bruto</label>
                          <input
                            value={p.bruto_str}
                            onChange={(e) => setProduto(idx, { bruto_str: e.target.value })}
                            placeholder="Ex.: 10.000,00"
                            inputMode="decimal"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Desconto (%)</label>
                          <input
                            value={p.desconto_str}
                            onChange={(e) => setProduto(idx, { desconto_str: e.target.value })}
                            placeholder="Ex.: 15,5"
                            inputMode="decimal"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Valor Líquido</label>
                          <input
                            value={p.liquido_str}
                            onChange={(e) => setProduto(idx, { liquido_str: e.target.value })}
                            placeholder="Ex.: 8.450,00"
                            inputMode="decimal"
                            className={[
                              "w-full rounded-xl border px-3 py-2",
                              mismatch ? "border-red-400 bg-red-50/40" : "border-slate-300"
                            ].join(" ")}
                          />
                          <div className="text-xs mt-1">
                            {b != null && d != null ? (
                              mismatch ? (
                                <span className="text-red-700">
                                  ⚠ Líquido calculado: <strong>{fmtMoney(lCalc!)}</strong> (ajuste %/valores)
                                </span>
                              ) : (
                                <span className="text-green-700">
                                  ✓ Bate com o cálculo: <strong>{fmtMoney(lCalc!)}</strong>
                                </span>
                              )
                            ) : (
                              <span className="text-slate-500">Informe Bruto e % para calcular conferência.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pl-1">
                        <button
                          type="button"
                          onClick={() => rmProduto(idx)}
                          className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          ✖ Remover
                        </button>
                      </div>
                    </div>

                    {/* Veiculações do produto */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-slate-600">Veiculações deste produto</div>
                        <button
                          type="button"
                          onClick={() => addVeic(idx)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          ➕ Adicionar veiculação
                        </button>
                      </div>

                      {p.veiculacoes.length === 0 ? (
                        <div className="text-slate-500 text-sm">Nenhuma veiculação.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead>
                              <tr className="bg-red-600/90 text-white">
                                {["Canal","Formato","Início","Fim","Qtd","Valor","Ações"].map(h => (
                                  <th key={h} className="px-3 py-2 text-left text-sm font-semibold">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {p.veiculacoes.map((v, vIdx) => (
                                <tr key={vIdx} className="border-b last:border-0">
                                  <td className="px-3 py-2">
                                    <select
                                      value={v.canal || ""}
                                      onChange={(e) => setVeic(idx, vIdx, { canal: e.target.value })}
                                      className="rounded-lg border border-slate-300 px-2 py-1"
                                    >
                                      <option value="">—</option>
                                      {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      value={v.formato || ""}
                                      onChange={(e) => setVeic(idx, vIdx, { formato: e.target.value })}
                                      placeholder="ex: 970x250"
                                      className="rounded-lg border border-slate-300 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="date"
                                      value={v.data_inicio || ""}
                                      onChange={(e) => setVeic(idx, vIdx, { data_inicio: e.target.value })}
                                      className="rounded-lg border border-slate-300 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="date"
                                      value={v.data_fim || ""}
                                      onChange={(e) => setVeic(idx, vIdx, { data_fim: e.target.value })}
                                      className="rounded-lg border border-slate-300 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={v.quantidade ?? ""}
                                      onChange={(e) => setVeic(idx, vIdx, { quantidade: e.target.value === "" ? null : Number(e.target.value) })}
                                      className="w-24 rounded-lg border border-slate-300 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min={0}
                                      value={v.valor ?? ""}
                                      onChange={(e) => setVeic(idx, vIdx, { valor: e.target.value === "" ? null : Number(e.target.value) })}
                                      className="w-32 rounded-lg border border-slate-300 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      onClick={() => rmVeic(idx, vIdx)}
                                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                                    >
                                      Remover
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Totais e conferência geral */}
              <div className="flex flex-col items-end gap-1 text-lg">
                <div>Total Bruto (soma dos produtos): <span className="ml-2 font-semibold">{fmtMoney(somaBrutoProdutos)}</span></div>
                <div className="flex items-center gap-2">
                  <div>Total Líquido (soma dos produtos): <span className="ml-2 font-semibold">{fmtMoney(somaLiquidoProdutos)}</span></div>
                  {!nearEq(somaLiquidoProdutos, liquidoCalcProdutos) && (
                    <span className="text-xs text-amber-700">
                      (pelo cálculo seria {fmtMoney(liquidoCalcProdutos)} — confira %)
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  Os totais acima devem bater com os campos “Valor Bruto” e “Valor Líquido” do PI <strong>abaixo</strong>.
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Responsáveis & Valores do PI (devem bater com os totais dos produtos) */}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Bruto (PI)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="ex: 1.234,56"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                value={valorBruto}
                onChange={(e) => setValorBruto(e.target.value)}
              />
              {valorBruto && !nearEq(parseMoney(valorBruto) ?? NaN, somaBrutoProdutos) && (
                <div className="text-xs text-amber-700 mt-1">
                  Soma dos produtos: <strong>{fmtMoney(somaBrutoProdutos)}</strong>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Líquido (PI)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="ex: 1.000,00"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                value={valorLiquido}
                onChange={(e) => setValorLiquido(e.target.value)}
              />
              {valorLiquido && !nearEq(parseMoney(valorLiquido) ?? NaN, somaLiquidoProdutos) && (
                <div className="text-xs text-amber-700 mt-1">
                  Soma dos produtos: <strong>{fmtMoney(somaLiquidoProdutos)}</strong>
                </div>
              )}
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações (opcional)</label>
              <input
                type="text" placeholder="Escreva observações gerais"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
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
          {msg && <span className="text-green-700 whitespace-pre-line">{msg}</span>}
          {erro && <span className="text-red-700 whitespace-pre-line">{erro}</span>}
        </div>
      </form>
    </div>
  )
}
