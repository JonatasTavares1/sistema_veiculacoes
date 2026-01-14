// src/pages/Executivos.tsx
import { useEffect, useMemo, useState } from "react"
import { apiGet, apiPut } from "../services/api"
import { getUser } from "../services/auth"

type TipoRegistro = "Agência" | "Anunciante"

type Linha = {
  ID: number
  Nome: string
  "Razão Social": string
  CNPJ?: string
  CPF?: string
  Documento?: string
  UF: string
  Executivo: string
}

/* -------------------- helpers doc (CPF/CNPJ) -------------------- */
function digits(s: string) {
  return (s || "").replace(/\D+/g, "")
}

function isDocKey(key: string) {
  return /^(cnpj|cpf|documento)$/i.test(key.trim())
}

function formatCPF(d: string) {
  const v = digits(d).slice(0, 11)
  if (v.length !== 11) return d || ""
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`
}
function formatCNPJ(d: string) {
  const v = digits(d).slice(0, 14)
  if (v.length !== 14) return d || ""
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`
}
function formatDocDisplay(v?: string | null) {
  const d = digits(v || "")
  if (d.length === 11) return formatCPF(d)
  if (d.length === 14) return formatCNPJ(d)
  return v || ""
}

// formatação progressiva para inputs
function formatCPFPartial(v: string) {
  const d = digits(v).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}
function formatCNPJPartial(v: string) {
  const d = digits(v).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}
function formatDocPartial(v: string) {
  const d = digits(v)
  if (d.length <= 11) return formatCPFPartial(v)
  return formatCNPJPartial(v)
}

function norm(v?: string | null) {
  return (v || "").toLowerCase().trim()
}

export default function Executivos() {
  const user = getUser()
  const role = norm(user?.role)
  const isAdmin = role === "admin"

  const [tipo, setTipo] = useState<TipoRegistro>("Agência")
  const [executivos, setExecutivos] = useState<string[]>([])
  const [executivoSel, setExecutivoSel] = useState<string>("")

  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [editAberto, setEditAberto] = useState(false)
  const [editOriginal, setEditOriginal] = useState<Linha | null>(null)
  const [editCampos, setEditCampos] = useState<Record<string, string>>({})

  useEffect(() => {
    ;(async () => {
      try {
        setErro(null)
        // backend permite: executivo + admin
        const nomes = await apiGet<string[]>("/executivos")

        const uniq = Array.from(new Set((nomes || []) as any))
          .filter(Boolean)
          .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"))

        setExecutivos(uniq as string[])
      } catch (e: any) {
        setErro(e?.message || "Erro ao carregar executivos.")
      }
    })()
  }, [])

  async function buscar() {
    if (!isAdmin) return

    if (!executivoSel) {
      alert("Selecione um executivo.")
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const params = new URLSearchParams({ tipo, executivo: executivoSel })
      // backend: ADMIN only
      const dados = await apiGet<Linha[]>(`/executivos/busca?${params.toString()}`)
      setLinhas(Array.isArray(dados) ? dados : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao buscar.")
    } finally {
      setLoading(false)
    }
  }

  async function verTodos() {
    if (!isAdmin) return

    setLoading(true)
    setErro(null)
    try {
      const params = new URLSearchParams({ tipo })
      // backend: ADMIN only
      const dados = await apiGet<Linha[]>(`/executivos/busca?${params.toString()}`)
      setLinhas(Array.isArray(dados) ? dados : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar lista.")
    } finally {
      setLoading(false)
    }
  }

  function exportarCSV() {
    if (!linhas.length) {
      alert("Nenhum dado para exportar.")
      return
    }
    const cols = Object.keys(linhas[0])
    const header = cols.join(";")
    const body = linhas
      .map((l) =>
        cols
          .map((c) => {
            let v = (l as any)[c] ?? ""
            if (isDocKey(c)) v = formatDocDisplay(String(v))
            const s = String(v).replaceAll('"', '""')
            return `"${s}"`
          })
          .join(";")
      )
      .join("\n")

    const csv = header + "\n" + body

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const nome = `${(executivoSel || "todos").replace(/\s+/g, "_")}_${tipo.toLowerCase()}.csv`
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = nome
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function abrirEdicao(item: Linha) {
    if (!isAdmin) return
    setEditOriginal(item)
    const { ID, ...rest } = item
    const campos: Record<string, string> = {}
    Object.entries(rest).forEach(([k, v]) => {
      campos[k] = isDocKey(k) ? formatDocPartial(String(v ?? "")) : String(v ?? "")
    })
    setEditCampos(campos)
    setEditAberto(true)
  }

  async function salvarEdicao() {
    if (!isAdmin) {
      alert("Seu perfil não tem permissão para editar.")
      return
    }
    if (!editOriginal) return
    try {
      // backend: ADMIN only
      await apiPut(`/executivos/editar`, {
        tipo,
        item_id: editOriginal.ID,
        novos_dados: editCampos,
      })

      setLinhas((prev) =>
        prev.map((l) =>
          l.ID === editOriginal.ID ? ({ ID: l.ID, ...editCampos } as any as Linha) : l
        )
      )
      setEditAberto(false)
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar edição.")
    }
  }

  function excluir() {
    alert("Exclusão desabilitada nesta tela (controle do Admin).")
  }

  const colunas = useMemo(
    () => (linhas[0] ? [...Object.keys(linhas[0]), ...(isAdmin ? ["Ações"] : [])] : []),
    [linhas, isAdmin]
  )

  return (
    <div className="space-y-8">
      {/* Título */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold text-slate-900">Busca por Executivo</h1>
          {!isAdmin && (
            <div className="text-sm text-slate-600">
              Modo: <span className="font-semibold">somente leitura</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportarCSV}
            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Aviso ACL */}
      {!isAdmin && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="font-semibold">Acesso restrito</div>
          <div className="text-sm mt-1">
            Esta tela de consulta detalhada (IDs e registros) é liberada apenas para <b>Admin</b>.
          </div>
        </section>
      )}

      {/* Filtros */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xl font-semibold text-slate-800 mb-2">
              Executivo
            </label>
            <select
              value={executivoSel}
              onChange={(e) => setExecutivoSel(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Selecione...</option>
              {executivos.map((nome, i) => (
                <option key={`${nome}-${i}`} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">
              Tipo
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoRegistro)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option>Agência</option>
              <option>Anunciante</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={buscar}
              disabled={!isAdmin}
              className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm w-full disabled:opacity-60"
            >
              Buscar
            </button>
            <button
              onClick={verTodos}
              disabled={!isAdmin}
              className="px-5 py-3 rounded-2xl border border-slate-300 text-slate-700 text-lg hover:bg-slate-50 w-full disabled:opacity-60"
            >
              Ver Todos
            </button>
          </div>
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-2xl border border-slate-200 bg-white p-2 md:p-4 shadow-sm">
        {loading && <div className="p-4 text-slate-600 text-lg">Carregando…</div>}
        {erro && <div className="p-4 text-red-700 text-lg">{erro}</div>}

        {!loading && !erro && (
          <>
            {linhas.length === 0 ? (
              <div className="p-4 text-slate-600 text-lg">Nenhum resultado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="bg-red-600/90 text-white">
                      {colunas.map((c) => (
                        <th key={c} className="px-4 py-3 text-base font-semibold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((linha) => (
                      <tr key={linha.ID} className="border-b last:border-none hover:bg-red-50">
                        {Object.entries(linha).map(([k, v]) => (
                          <td key={k} className="px-4 py-3 text-slate-800 text-base">
                            {isDocKey(k) ? formatDocDisplay(String(v)) : String(v ?? "")}
                          </td>
                        ))}

                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => abrirEdicao(linha)}
                                className="h-10 px-4 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                                title="Editar"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => excluir()}
                                className="h-10 px-4 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                                title="Excluir"
                              >
                                🗑️ Excluir
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* Modal de edição: somente admin */}
      {isAdmin && editAberto && editOriginal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Editar Registro</h2>
              <button
                onClick={() => setEditAberto(false)}
                className="h-10 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-600">ID: {editOriginal.ID}</div>
              {Object.keys(editCampos).map((campo) => (
                <div key={campo}>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    {campo}
                  </label>
                  <input
                    value={editCampos[campo]}
                    onChange={(e) =>
                      setEditCampos((prev) => ({
                        ...prev,
                        [campo]: isDocKey(campo) ? formatDocPartial(e.target.value) : e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
                  />
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditAberto(false)}
                className="h-11 px-5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEdicao}
                className="h-11 px-6 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
