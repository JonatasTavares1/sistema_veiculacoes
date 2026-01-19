// src/pages/CadastroPI.tsx
import { useEffect, useMemo, useState } from "react"
import { apiGet, apiPost, apiRequest } from "../services/api"

// ====== Tipos ======
// eslint-disable-next-line @typescript-eslint/no-type-alias
type TipoPI = "Matriz" | "Normal" | "CS" | "Abatimento" | "Veiculação"
// eslint-disable-next-line @typescript-eslint/no-type-alias
type PISimple = { numero_pi: string; nome_campanha?: string | null }

// eslint-disable-next-line @typescript-eslint/no-type-alias
type VeicDraft = {
  data_inicio?: string // yyyy-mm-dd
  data_fim?: string // yyyy-mm-dd
  dias?: number | null // ✅ quantidade de dias
  desconto?: number | null // em %
  valor_liquido?: number | null // informado
}

// eslint-disable-next-line @typescript-eslint/no-type-alias
type ProdutoDraft = {
  produto_id?: number | null
  nome: string
  valor_unitario?: number | null // ✅ puxa do catálogo ao escolher
  veiculacoes: VeicDraft[]
}

// ====== Tipos do Catálogo (mesmos campos da tela Produtos.tsx) ======
type Modalidade = "DIA" | "SPOT" | "CPM" | "PACOTE"
type ProdutoCatalogo = {
  id: number
  nome: string
  descricao?: string | null
  categoria?: string | null
  modalidade_preco?: Modalidade | null
  unidade_rotulo?: string | null
  base_segundos?: number | null
  valor_unitario?: number | null
}

/*function norm(v?: string | null) {
  return (v || "").toLowerCase().trim()
}*/

// ====== Constantes UI ======
const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
  "EX (Exterior)",
]

const PERFIS = ["Privado", "Governo estadual", "Governo federal", "Privado - Gestão Executiva"]
const SUBPERFIS = [
  "Privado",
  "Governo estadual",
  "GDF - DETRAN",
  "Sistema S Federal",
  "Governo Federal",
  "GDF - TERRACAP",
  "Sistema S Regional",
  "CLDF",
  "GDF - SECOM",
  "GDF - BRB",
  "Governo Estadual - RJ",
  "Privado - PATROCINIO",
  "Privado - Ambipar",
  "Governo Federal - PATROCINIO",
  "Privado - BYD",
  "Privado - Gestao Executiva",
  "Gestao Executiva - PATROCINIO",
]
const EXECUTIVOS_FALLBACK = [
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
    const normed = t.replace(/\./g, "").replace(",", ".")
    const n = Number(normed)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
function nearEq(a: number, b: number, tol = 0.01) {
  return Math.abs(a - b) <= tol
}

function calcBrutoUnitDias(valorUnit: number | null | undefined, dias: number | null | undefined) {
  const u = valorUnit ?? 0
  const d = dias ?? 0
  return Number((u * d).toFixed(2))
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
  const [perfilAnunciante, setPerfilAnunciante] = useState("Privado")
  const [subperfilAnunciante, setSubperfilAnunciante] = useState("Privado")

  // ===== Datas & Período de venda
  const [mesVenda, setMesVenda] = useState("") // "07/2025"
  const [diaVenda, setDiaVenda] = useState("") // "23"
  const [vencimento, setVencimento] = useState<string>("") // yyyy-mm-dd
  const [dataEmissao, setDataEmissao] = useState<string>("") // yyyy-mm-dd

  // ===== Responsáveis & Valores
  const [executivos, setExecutivos] = useState<string[]>(EXECUTIVOS_FALLBACK)
  const [executivo, setExecutivo] = useState(EXECUTIVOS_FALLBACK[0])
  const [diretoria, setDiretoria] = useState(DIRETORIAS[0])

  // ✅ agora os campos do PI viram "somatório" (read-only) mas mantive string p/ compatibilidade visual
  const [valorBruto, setValorBruto] = useState<string>("")
  const [valorLiquido, setValorLiquido] = useState<string>("")
  const [observacoes, setObservacoes] = useState<string>("")

  // ===== Produtos & Veiculações
  // (Agora: escolhe o produto e já leva o valor_unitario)
  const [produtos, setProdutos] = useState<ProdutoDraft[]>([])

  // Estado do autocomplete por produto (idx)
  const [produtoOpenIdx, setProdutoOpenIdx] = useState<number | null>(null)
  const [produtoOptions, setProdutoOptions] = useState<Record<number, ProdutoCatalogo[]>>({})
  const [produtoLoading, setProdutoLoading] = useState<Record<number, boolean>>({})
  const [produtoErro, setProdutoErro] = useState<Record<number, string | null>>({})

  async function buscarProdutosParaIdx(idx: number, termo: string) {
    const q = (termo || "").trim()

    if (!q) {
      setProdutoOptions((prev) => ({ ...prev, [idx]: [] }))
      setProdutoErro((prev) => ({ ...prev, [idx]: null }))
      setProdutoLoading((prev) => ({ ...prev, [idx]: false }))
      return
    }

    setProdutoLoading((prev) => ({ ...prev, [idx]: true }))
    setProdutoErro((prev) => ({ ...prev, [idx]: null }))

    try {
      const rows = await apiGet<ProdutoCatalogo[]>(`/produtos?termo=${encodeURIComponent(q)}`)
      setProdutoOptions((prev) => ({ ...prev, [idx]: Array.isArray(rows) ? rows : [] }))
    } catch (e: any) {
      setProdutoErro((prev) => ({ ...prev, [idx]: e?.message || "Erro ao buscar produtos" }))
      setProdutoOptions((prev) => ({ ...prev, [idx]: [] }))
    } finally {
      setProdutoLoading((prev) => ({ ...prev, [idx]: false }))
    }
  }

  // Debounce de busca por produto (quando nome muda)
  useEffect(() => {
    const timers: number[] = []
    produtos.forEach((p, idx) => {
      const termo = p.nome || ""
      const t = window.setTimeout(() => {
        buscarProdutosParaIdx(idx, termo)
      }, 300)
      timers.push(t)
    })
    return () => timers.forEach((t) => clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos.map((p) => p.nome).join("|")])

  // ===== Anexos (PI e Proposta)
  const [arquivoPi, setArquivoPi] = useState<File | null>(null)
  const [arquivoProposta, setArquivoProposta] = useState<File | null>(null)

  // ===== UX
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // ===== Loads iniciais
  useEffect(() => {
    ;(async () => {
      try {
        const mats = await apiGet<PISimple[]>("/pis/matriz/ativos")
        setMatrizesAtivas(mats || [])
      } catch {
        // ignore
      }

      try {
        const norms = await apiGet<PISimple[]>("/pis/normal/ativos")
        setNormaisAtivas(norms || [])
      } catch {
        // ignore
      }

      try {
        const ex = await apiGet<string[]>("/executivos")
        if (Array.isArray(ex) && ex.length) setExecutivos(ex)
      } catch {
        // ignore
      }
    })()
  }, [])

  // sincroniza executivo default quando a lista chegar/alterar
  useEffect(() => {
    if (executivos.length) setExecutivo(executivos[0])
  }, [executivos])

  // alterna seções condicionais
  useEffect(() => {
    setErro(null)
    setMsg(null)
    if (tipoPI !== "Abatimento" && tipoPI !== "Veiculação") setNumeroPIMatriz("")
    if (tipoPI !== "CS") setNumeroPINormal("")
  }, [tipoPI])

  // ===== Buscar por CNPJ (BD -> BrasilAPI fallback)
  async function buscarAnunciante() {
    const cnpj = onlyDigits(cnpjAnunciante)
    if (!cnpj) return setErro("Informe o CNPJ do anunciante.")
    setErro(null)
    setMsg(null)
    try {
      const reg = await apiGet<any>(`/anunciantes/cnpj/${cnpj}`)
      setNomeAnunciante(reg?.nome_anunciante || "")
      setRazaoAnunciante(reg?.razao_social_anunciante || "")
      setUfCliente(reg?.uf_cliente || "DF")
      setMsg("Anunciante carregado do cadastro.")
    } catch {
      try {
        const br = await apiGet<any>(`/anunciantes/cnpj/${cnpj}/consulta`)
        setNomeAnunciante(br?.nome_fantasia || br?.razao_social || "")
        setRazaoAnunciante(br?.razao_social || "")
        setUfCliente(br?.uf || br?.estado || "DF")
        setMsg("Pré-preenchido via BrasilAPI.")
      } catch {
        setErro("Não encontrado na base nem na BrasilAPI.")
      }
    }
  }

  async function buscarAgencia() {
    const cnpj = onlyDigits(cnpjAgencia)
    if (!cnpj) return setErro("Informe o CNPJ da agência.")
    setErro(null)
    setMsg(null)
    try {
      const reg = await apiGet<any>(`/agencias/cnpj/${cnpj}`)
      setNomeAgencia(reg?.nome_agencia || "")
      setRazaoAgencia(reg?.razao_social_agencia || "")
      setUfAgencia(reg?.uf_agencia || "DF")
      setMsg("Agência carregada do cadastro.")
    } catch {
      try {
        const br = await apiGet<any>(`/agencias/cnpj/${cnpj}/consulta`)
        setNomeAgencia(br?.nome_fantasia || br?.razao_social || "")
        setRazaoAgencia(br?.razao_social || "")
        setUfAgencia(br?.uf || br?.estado || "DF")
        setMsg("Pré-preenchido via BrasilAPI.")
      } catch {
        setErro("Não encontrada na base nem na BrasilAPI.")
      }
    }
  }

  // ===== Produtos & Veiculações - helpers
  function setVeic(idx: number, vIdx: number, patch: Partial<VeicDraft>) {
    setProdutos((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p
        const novo = { ...p }
        novo.veiculacoes = p.veiculacoes.map((v, j) => {
          if (j !== vIdx) return v
          return { ...v, ...patch }
        })
        return novo
      })
    )
  }

  function addProduto() {
    setProdutos((prev) => [...prev, { nome: "", produto_id: null, valor_unitario: null, veiculacoes: [] }])
  }

  function rmProduto(idx: number) {
    setProdutos((prev) => prev.filter((_, i) => i !== idx))
    setProdutoOptions((prev) => {
      const copy = { ...prev }
      delete copy[idx]
      return copy
    })
    setProdutoLoading((prev) => {
      const copy = { ...prev }
      delete copy[idx]
      return copy
    })
    setProdutoErro((prev) => {
      const copy = { ...prev }
      delete copy[idx]
      return copy
    })
    setProdutoOpenIdx((cur) => (cur === idx ? null : cur))
  }

  function setProduto(idx: number, patch: Partial<ProdutoDraft>) {
    setProdutos((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }

  function addVeic(idx: number) {
    setProdutos((prev) =>
      prev.map((p, i) =>
        i === idx
          ? {
              ...p,
              veiculacoes: [
                ...p.veiculacoes,
                {
                  data_inicio: "",
                  data_fim: "",
                  dias: null,
                  desconto: 0,
                  valor_liquido: null,
                },
              ],
            }
          : p
      )
    )
  }

  function rmVeic(idx: number, vIdx: number) {
    setProdutos((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, veiculacoes: p.veiculacoes.filter((_, j) => j !== vIdx) } : p))
    )
  }

  // ===== Cálculos por VEICULAÇÃO (unitário * dias) =====
  function brutoDaVeic(prod: ProdutoDraft, v: VeicDraft) {
    return calcBrutoUnitDias(prod.valor_unitario ?? 0, v.dias ?? 0)
  }
  function liquidoCalcDaVeic(prod: ProdutoDraft, v: VeicDraft) {
    const bruto = brutoDaVeic(prod, v)
    const desc = v.desconto ?? 0
    return Number((bruto * (1 - desc / 100)).toFixed(2))
  }

  // Totais a partir das VEICULAÇÕES
  const { somaBrutoVeics, somaLiquidoVeics, liquidoCalcVeics } = useMemo(() => {
    let b = 0
    let l = 0
    let lc = 0
    for (const p of produtos) {
      for (const v of p.veiculacoes) {
        const bruto = brutoDaVeic(p, v)
        const lcalc = liquidoCalcDaVeic(p, v)
        b += bruto
        lc += lcalc
        // se informou líquido, soma o informado; senão soma o calculado
        l += v.valor_liquido != null ? Number(v.valor_liquido) : lcalc
      }
    }
    return {
      somaBrutoVeics: Number(b.toFixed(2)),
      somaLiquidoVeics: Number(l.toFixed(2)),
      liquidoCalcVeics: Number(lc.toFixed(2)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos])

  // mantém campos do PI sincronizados (read-only visual)
  useEffect(() => {
    setValorBruto(somaBrutoVeics ? somaBrutoVeics.toFixed(2).replace(".", ",") : "")
    setValorLiquido(somaLiquidoVeics ? somaLiquidoVeics.toFixed(2).replace(".", ",") : "")
  }, [somaBrutoVeics, somaLiquidoVeics])

  // ===== Regras de envio
  const podeEnviar = useMemo(() => {
    if (!numeroPI.trim()) return false
    if (tipoPI === "CS" && !numeroPINormal) return false
    if ((tipoPI === "Abatimento" || tipoPI === "Veiculação") && !numeroPIMatriz) return false

    // precisa ter ao menos 1 produto
    if (produtos.length === 0) return false

    // precisa ter ao menos 1 veiculação
    const totalVeics = produtos.reduce((acc, p) => acc + p.veiculacoes.length, 0)
    if (totalVeics === 0) return false

    // cada produto selecionado deve ter valor_unitario
    const algumSemUnit = produtos.some((p) => !p.nome.trim() || p.valor_unitario == null)
    if (algumSemUnit) return false

    // veiculação: dias obrigatório e líquido obrigatório
    const veicInvalida = produtos.some((p) =>
      p.veiculacoes.some(
        (v) =>
          v.dias == null ||
          v.dias <= 0 ||
          v.valor_liquido == null ||
          v.valor_liquido < 0 ||
          (v.desconto != null && (v.desconto < 0 || v.desconto > 100))
      )
    )
    if (veicInvalida) return false

    // mês de venda (se informado) precisa estar em MM/AAAA
    if (mesVenda && !/^\d{2}\/\d{4}$/.test(mesVenda)) return false

    return true
  }, [numeroPI, tipoPI, numeroPINormal, numeroPIMatriz, produtos, mesVenda])

  // ===== Upload de anexos após criar PI
  async function uploadAnexos(pi: { id: number; numero_pi: string }) {
    const uploads: string[] = []
    const falhas: string[] = []

    if (!arquivoPi && !arquivoProposta) return uploads

    try {
      const fd = new FormData()
      if (arquivoPi) fd.append("arquivo_pi", arquivoPi, arquivoPi.name)
      if (arquivoProposta) fd.append("proposta", arquivoProposta, arquivoProposta.name)

      await apiRequest("POST", `/pis/${pi.id}/arquivos`, fd)

      if (arquivoPi) uploads.push("PI (PDF)")
      if (arquivoProposta) uploads.push("Proposta (PDF)")
    } catch (e: any) {
      falhas.push(e?.message || String(e))
    }

    if (falhas.length) setErro(`Falha ao enviar anexos:\n- ${falhas.join("\n- ")}`)
    return uploads
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    setMsg(null)

    try {
      // validações explícitas
      if (produtos.length === 0) throw new Error("Adicione ao menos um produto.")
      const totalVeics = produtos.reduce((acc, p) => acc + p.veiculacoes.length, 0)
      if (totalVeics === 0) throw new Error("Adicione ao menos uma veiculação.")

      const algumSemUnit = produtos.some((p) => !p.nome.trim() || p.valor_unitario == null)
      if (algumSemUnit) throw new Error("Selecione um produto do catálogo (com valor unitário) para cada item.")

      const veicInvalida = produtos.some((p) =>
        p.veiculacoes.some(
          (v) =>
            v.dias == null ||
            v.dias <= 0 ||
            v.valor_liquido == null ||
            v.valor_liquido < 0 ||
            (v.desconto != null && (v.desconto < 0 || v.desconto > 100))
        )
      )
      if (veicInvalida) throw new Error("Preencha Dias, % Desconto (0–100) e Valor Líquido em todas as veiculações.")

      if (mesVenda && !/^\d{2}\/\d{4}$/.test(mesVenda)) throw new Error("Mês da venda deve estar no formato MM/AAAA.")

      // 1) cria o PI (valores agora são somatórios)
      const payload: any = {
        numero_pi: numeroPI.trim(),
        tipo_pi: tipoPI,

        ...(tipoPI === "CS" ? { numero_pi_normal: numeroPINormal } : {}),
        ...(tipoPI === "Abatimento" || tipoPI === "Veiculação" ? { numero_pi_matriz: numeroPIMatriz } : {}),

        nome_anunciante: nomeAnunciante || undefined,
        razao_social_anunciante: razaoAnunciante || undefined,
        cnpj_anunciante: onlyDigits(cnpjAnunciante) || undefined,
        uf_cliente: ufCliente || undefined,

        nome_agencia: temAgencia ? (nomeAgencia || undefined) : undefined,
        razao_social_agencia: temAgencia ? (razaoAgencia || undefined) : undefined,
        cnpj_agencia: temAgencia ? (onlyDigits(cnpjAgencia) || undefined) : undefined,
        uf_agencia: temAgencia ? (ufAgencia || undefined) : undefined,

        nome_campanha: nomeCampanha || undefined,
        perfil_anunciante: perfilAnunciante || undefined,
        subperfil_anunciante: subperfilAnunciante || undefined,

        mes_venda: mesVenda || undefined,
        dia_venda: diaVenda || undefined,
        vencimento: vencimento || undefined,
        data_emissao: dataEmissao || undefined,

        executivo: executivo || undefined,
        diretoria: diretoria || undefined,

        valor_bruto: Number(somaBrutoVeics.toFixed(2)),
        valor_liquido: Number(somaLiquidoVeics.toFixed(2)),
        observacoes: (observacoes || "").trim(),
      }

      const pi = await apiPost<any>("/pis", payload)

      // 2) cria veiculações — bruto = unitário * dias; líquido vem do campo; desconto vem do campo
      const chamadas: Promise<any>[] = []
      for (const p of produtos) {
        for (const v of p.veiculacoes) {
          const bruto = brutoDaVeic(p, v)
          const body: any = {
            numero_pi: pi.numero_pi,
            produto_id: p.produto_id ?? undefined, // ✅ preferencial
            produto_nome: (p.nome || "").trim() || undefined, // fallback

            data_inicio: (v.data_inicio || "").trim() || undefined,
            data_fim: (v.data_fim || "").trim() || undefined,

            // ⚠️ backend ainda espera "quantidade" -> enviamos dias como quantidade
            quantidade: v.dias == null ? undefined : Number(v.dias),

            valor_bruto: Number(bruto.toFixed(2)),
            desconto: v.desconto == null ? 0 : Number(v.desconto),
            valor_liquido: v.valor_liquido == null ? undefined : Number(v.valor_liquido),
          }
          chamadas.push(apiPost("/veiculacoes", body))
        }
      }
      if (chamadas.length) await Promise.all(chamadas)

      // 3) envia anexos
      const anexosOk = await uploadAnexos(pi)

      setMsg(`PI criada: ${pi.numero_pi} (${pi.tipo_pi})` + (anexosOk.length ? `\nAnexos enviados: ${anexosOk.join(", ")}` : ""))

      // Reset
      setTipoPI("Normal")
      setNumeroPI("")
      setNumeroPIMatriz("")
      setNumeroPINormal("")
      setCnpjAnunciante("")
      setNomeAnunciante("")
      setRazaoAnunciante("")
      setUfCliente("DF")
      setTemAgencia(true)
      setCnpjAgencia("")
      setNomeAgencia("")
      setRazaoAgencia("")
      setUfAgencia("DF")
      setNomeCampanha("")
      setPerfilAnunciante("Privado")
      setSubperfilAnunciante("Privado")
      setMesVenda("")
      setDiaVenda("")
      setVencimento("")
      setDataEmissao("")
      setExecutivo(executivos[0] ?? EXECUTIVOS_FALLBACK[0])
      setDiretoria(DIRETORIAS[0])
      setValorBruto("")
      setValorLiquido("")
      setObservacoes("")
      setProdutos([])
      setProdutoOpenIdx(null)
      setProdutoOptions({})
      setProdutoLoading({})
      setProdutoErro({})
      setArquivoPi(null)
      setArquivoProposta(null)
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
                {(["Matriz", "Normal", "CS", "Abatimento", "Veiculação"] as const).map((tipo) => {
                  const selected = tipoPI === tipo
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setTipoPI(tipo)}
                      className={[
                        "px-3 py-2 rounded-full border text-sm transition",
                        selected ? "bg-red-600 text-white border-red-600 shadow" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50",
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
          {(tipoPI === "Abatimento" || tipoPI === "Veiculação") && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Vincular a PI Matriz ({tipoPI})</label>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                  value={numeroPIMatriz}
                  onChange={(e) => setNumeroPIMatriz(e.target.value)}
                >
                  <option value="">-- escolha --</option>
                  {matrizesAtivas.map((m) => (
                    <option key={m.numero_pi} value={m.numero_pi}>
                      {m.numero_pi}
                      {m.nome_campanha ? ` — ${m.nome_campanha}` : ""}
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
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                value={numeroPINormal}
                onChange={(e) => setNumeroPINormal(e.target.value)}
              >
                <option value="">-- escolha --</option>
                {normaisAtivos.map((n) => (
                  <option key={n.numero_pi} value={n.numero_pi}>
                    {n.numero_pi}
                    {n.nome_campanha ? ` — ${n.nome_campanha}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* Informações do Anunciante */}
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
                <button type="button" onClick={buscarAnunciante} className="px-3 py-2 rounded-xl border border-red-600 text-red-700 hover:bg-red-50 transition">
                  Buscar
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Anunciante</label>
              <input type="text" className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500" value={nomeAnunciante} onChange={(e) => setNomeAnunciante(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social</label>
              <input type="text" className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500" value={razaoAnunciante} onChange={(e) => setRazaoAnunciante(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">UF do Cliente</label>
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500" value={ufCliente} onChange={(e) => setUfCliente(e.target.value)}>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Agência */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Agência (opcional)</h2>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={temAgencia} onChange={(e) => setTemAgencia(e.target.checked)} className="h-4 w-4 accent-red-600" />
              Possui agência?
            </label>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${temAgencia ? "" : "opacity-60 pointer-events-none"}`}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ da Agência</label>
              <div className="flex gap-2">
                <input type="text" className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500" placeholder="Somente números" value={cnpjAgencia} onChange={(e) => setCnpjAgencia(e.target.value)} />
                <button type="button" onClick={buscarAgencia} className="px-3 py-2 rounded-xl border border-red-600 text-red-700 hover:bg-red-50 transition">
                  Buscar
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Agência</label>
              <input type="text" className="w-full rounded-xl border border-slate-300 px-3 py-2" value={nomeAgencia} onChange={(e) => setNomeAgencia(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social da Agência</label>
              <input type="text" className="w-full rounded-xl border border-slate-300 px-3 py-2" value={razaoAgencia} onChange={(e) => setRazaoAgencia(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">UF da Agência</label>
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={ufAgencia} onChange={(e) => setUfAgencia(e.target.value)}>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
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
              <input type="text" className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500" value={nomeCampanha} onChange={(e) => setNomeCampanha(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Perfil do Anunciante</label>
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={perfilAnunciante} onChange={(e) => setPerfilAnunciante(e.target.value)}>
                {PERFIS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Subperfil do Anunciante</label>
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={subperfilAnunciante} onChange={(e) => setSubperfilAnunciante(e.target.value)}>
                {SUBPERFIS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
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
              <input type="text" placeholder="07/2025" className="w-full rounded-xl border border-slate-300 px-3 py-2" value={mesVenda} onChange={(e) => setMesVenda(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dia da Venda (DD)</label>
              <input type="text" placeholder="23" className="w-full rounded-xl border border-slate-300 px-3 py-2" value={diaVenda} onChange={(e) => setDiaVenda(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento</label>
              <input type="date" className="w-full rounded-xl border border-slate-300 px-3 py-2" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de Emissão</label>
              <input type="date" className="w-full rounded-xl border border-slate-300 px-3 py-2" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
            </div>
          </div>
        </section>

        {/* >>> Produtos & Veiculações <<< */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Produtos & Veiculações</h2>
            <button type="button" onClick={addProduto} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50">
              ➕ Adicionar produto
            </button>
          </div>

          {produtos.length === 0 ? (
            <div className="text-slate-600">Nenhum produto adicionado.</div>
          ) : (
            <div className="space-y-6">
              {produtos.map((p, idx) => {
                const opts = produtoOptions[idx] || []
                const isLoading = Boolean(produtoLoading[idx])
                const err = produtoErro[idx]
                const showDropdown = produtoOpenIdx === idx

                return (
                  <div key={idx} className="rounded-xl border border-slate-200">
                    {/* Cabeçalho do produto */}
                    <div className="flex items-start justify-between px-4 py-3 border-b bg-slate-50 gap-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-3">
                        <div className="md:col-span-3">
                          <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Produto</label>

                            <input
                              value={p.nome}
                              onChange={(e) => {
                                // se o usuário editar "na mão", a gente limpa o valor unitário até selecionar do dropdown
                                setProduto(idx, { nome: e.target.value, produto_id: null, valor_unitario: null })
                                setProdutoOpenIdx(idx)
                              }}
                              onFocus={() => setProdutoOpenIdx(idx)}
                              onBlur={() => {
                                setTimeout(() => {
                                  setProdutoOpenIdx((cur) => (cur === idx ? null : cur))
                                }, 150)
                              }}
                              placeholder="Digite para buscar no catálogo..."
                              className="w-full rounded-xl border border-slate-300 px-3 py-2"
                            />

                            {/* Dropdown (lista que desce) */}
                            {showDropdown && (
                              <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                                <div className="px-3 py-2 text-xs text-slate-500 border-b bg-slate-50 flex items-center justify-between">
                                  <span>{isLoading ? "Buscando..." : `Resultados: ${opts.length}`}</span>
                                  {err && <span className="text-red-600">{err}</span>}
                                </div>

                                <div className="max-h-64 overflow-y-auto">
                                  {opts.length === 0 ? (
                                    <div className="px-3 py-3 text-sm text-slate-600">{p.nome?.trim() ? "Nenhum produto encontrado." : "Digite para buscar."}</div>
                                  ) : (
                                    opts.map((opt) => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()} // evita blur antes do click
                                        onClick={() => {
                                          setProduto(idx, {
                                            produto_id: opt.id,
                                            nome: opt.nome,
                                            valor_unitario: opt.valor_unitario ?? null,
                                          })
                                          setProdutoOpenIdx(null)
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-red-50"
                                      >
                                        <div className="font-medium text-slate-900">{opt.nome}</div>
                                        <div className="text-xs text-slate-600">
                                          {opt.categoria ? <span className="mr-2">Categoria: {opt.categoria}</span> : null}
                                          {opt.modalidade_preco ? <span className="mr-2">Modalidade: {opt.modalidade_preco}</span> : null}
                                          {opt.valor_unitario != null ? (
                                            <span className="mr-2">Valor unitário: {opt.valor_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                                          ) : (
                                            <span className="mr-2 text-amber-700">Sem valor unitário (cadastre no catálogo)</span>
                                          )}
                                        </div>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {p.nome?.trim() && !isLoading && !err && opts.length === 0 && (
                            <div className="text-xs text-slate-500 mt-1">
                              Dica: o catálogo busca por <strong>nome/categoria</strong>. Se não aparecer, confirme se o backend aceita <code>?termo=</code>.
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Valor unitário (do catálogo)</label>
                          <div className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white">
                            {p.valor_unitario == null ? <span className="text-slate-500">Selecione um produto para carregar o valor unitário.</span> : <span className="font-semibold text-slate-900">{fmtMoney(p.valor_unitario)}</span>}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            O valor bruto da veiculação será: <strong>valor unitário × dias</strong>.
                          </div>
                        </div>
                      </div>

                      <div className="pl-1">
                        <button type="button" onClick={() => rmProduto(idx)} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
                          ✖ Remover
                        </button>
                      </div>
                    </div>

                    {/* Veiculações do produto */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-slate-600">Veiculações deste produto</div>
                        <button type="button" onClick={() => addVeic(idx)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
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
                                {["Início", "Fim", "Dias", "Bruto (auto)", "Desc %", "Líquido", "Ações"].map((h) => (
                                  <th key={h} className="px-3 py-2 text-left text-sm font-semibold">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {p.veiculacoes.map((v, vIdx) => {
                                const bruto = brutoDaVeic(p, v)
                                const lCalc = liquidoCalcDaVeic(p, v)
                                const mismatch = v.valor_liquido != null && p.valor_unitario != null && v.dias != null ? !nearEq(Number(v.valor_liquido), lCalc) : false

                                return (
                                  <tr key={vIdx} className="border-b last:border-0 align-top">
                                    <td className="px-3 py-2">
                                      <input type="date" value={v.data_inicio || ""} onChange={(e) => setVeic(idx, vIdx, { data_inicio: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1" />
                                    </td>

                                    <td className="px-3 py-2">
                                      <input type="date" value={v.data_fim || ""} onChange={(e) => setVeic(idx, vIdx, { data_fim: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1" />
                                    </td>

                                    {/* Dias */}
                                    <td className="px-3 py-2">
                                      <input type="number" min={0} value={v.dias ?? ""} onChange={(e) => setVeic(idx, vIdx, { dias: e.target.value === "" ? null : Number(e.target.value) })} className="w-24 rounded-lg border border-slate-300 px-2 py-1" />
                                    </td>

                                    {/* Bruto auto */}
                                    <td className="px-3 py-2">
                                      <div className="w-36 rounded-lg border border-slate-300 px-2 py-1 bg-slate-50 text-slate-900">{p.valor_unitario == null || v.dias == null ? <span className="text-slate-500">—</span> : fmtMoney(bruto)}</div>
                                      <div className="text-xs text-slate-500 mt-1">{p.valor_unitario != null ? `Unit: ${fmtMoney(p.valor_unitario)}` : "Selecione produto"}</div>
                                    </td>

                                    {/* Desconto % */}
                                    <td className="px-3 py-2">
                                      <input type="number" step="0.1" min={0} max={100} value={v.desconto ?? 0} onChange={(e) => setVeic(idx, vIdx, { desconto: e.target.value === "" ? null : Number(e.target.value) })} className="w-24 rounded-lg border border-slate-300 px-2 py-1" />
                                    </td>

                                    {/* Líquido */}
                                    <td className="px-3 py-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={v.valor_liquido ?? ""}
                                        onChange={(e) => setVeic(idx, vIdx, { valor_liquido: e.target.value === "" ? null : Number(e.target.value) })}
                                        className={["w-32 rounded-lg border px-2 py-1", mismatch ? "border-red-400 bg-red-50/40" : "border-slate-300"].join(" ")}
                                      />
                                      <div className="text-xs mt-1">
                                        {p.valor_unitario != null && v.dias != null ? (
                                          mismatch ? (
                                            <span className="text-amber-700">
                                              Cálculo sugere: <strong>{fmtMoney(lCalc)}</strong> (confira desconto)
                                            </span>
                                          ) : (
                                            <span className="text-green-700">
                                              ✓ confere com cálculo: <strong>{fmtMoney(lCalc)}</strong>
                                            </span>
                                          )
                                        ) : (
                                          <span className="text-slate-500">Selecione produto e informe dias.</span>
                                        )}
                                      </div>
                                    </td>

                                    <td className="px-3 py-2">
                                      <button type="button" onClick={() => rmVeic(idx, vIdx)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
                                        Remover
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
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
                <div>
                  Total Bruto (auto): <span className="ml-2 font-semibold">{fmtMoney(somaBrutoVeics)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    Total Líquido (soma informada): <span className="ml-2 font-semibold">{fmtMoney(somaLiquidoVeics)}</span>
                  </div>
                  {!nearEq(somaLiquidoVeics, liquidoCalcVeics) && <span className="text-xs text-amber-700">(pelo cálculo seria {fmtMoney(liquidoCalcVeics)} — confira descontos)</span>}
                </div>
                <div className="text-xs text-slate-500">No envio, o PI será salvo com os totais acima.</div>
              </div>
            </div>
          )}
        </section>

        {/* Responsáveis & Valores do PI */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Responsáveis e Valores</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Executivo Responsável</label>
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500" value={executivo} onChange={(e) => setExecutivo(e.target.value)}>
                {executivos.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Diretoria</label>
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={diretoria} onChange={(e) => setDiretoria(e.target.value)}>
                {DIRETORIAS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* ✅ agora são read-only (calculados do bloco de veiculações) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Bruto (PI) — automático</label>
              <input type="text" readOnly className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 text-slate-900" value={valorBruto ? `R$ ${valorBruto}` : ""} onChange={(e) => setValorBruto(e.target.value)} />
              <div className="text-xs text-slate-500 mt-1">Somatório de (valor unitário × dias).</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Líquido (PI) — automático</label>
              <input type="text" readOnly className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 text-slate-900" value={valorLiquido ? `R$ ${valorLiquido}` : ""} onChange={(e) => setValorLiquido(e.target.value)} />
              <div className="text-xs text-slate-500 mt-1">Somatório dos líquidos informados em cada veiculação.</div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações (opcional)</label>
              <input type="text" placeholder="Escreva observações gerais" className="w-full rounded-xl border border-slate-300 px-3 py-2" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </div>
        </section>

        {/* Anexos */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Anexos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PDF do PI</label>
              <input type="file" accept="application/pdf" onChange={(e) => setArquivoPi(e.target.files && e.target.files[0] ? e.target.files[0] : null)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
              <div className="text-xs text-slate-500 mt-1">{arquivoPi?.name}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Proposta (PDF)</label>
              <input type="file" accept="application/pdf" onChange={(e) => setArquivoProposta(e.target.files && e.target.files[0] ? e.target.files[0] : null)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
              <div className="text-xs text-slate-500 mt-1">{arquivoProposta?.name}</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Os arquivos são enviados após o PI ser criado. Endpoint usado: <code>/pis/&#123;pi_id&#125;/arquivos</code> com campos <code>arquivo_pi</code> e <code>proposta</code>.
          </p>
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
