import { useEffect, useMemo, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

type TipoRegistro = "Agência" | "Anunciante"

// Estrutura de cada linha da tabela (seguindo o controller Python)
type Linha = {
  ID: number
  Nome: string
  "Razão Social": string
  CNPJ: string
  UF: string
  Executivo: string
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
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

async function putJSON<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

export default function Executivos() {
  // filtros
  const [tipo, setTipo] = useState<TipoRegistro>("Agência")
  const [executivos, setExecutivos] = useState<string[]>([])
  const [executivoSel, setExecutivoSel] = useState<string>("")

  // dados
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // edição (modal)
  const [editAberto, setEditAberto] = useState(false)
  const [editOriginal, setEditOriginal] = useState<Linha | null>(null)
  const [editCampos, setEditCampos] = useState<Record<string, string>>({})

  // carregar lista de executivos (combina Agências e Anunciantes no backend)
  useEffect(() => {
    (async () => {
      try {
        setErro(null)
        const nomes = await getJSON<string[]>(`${API}/executivos`)
        setExecutivos(Array.isArray(nomes) ? nomes : [])
      } catch (e: any) {
        setErro(e?.message || "Erro ao carregar executivos.")
      }
    })()
  }, [])

  // buscar por executivo
  async function buscar() {
    if (!executivoSel) {
      alert("Selecione um executivo.")
      return
    }
    setLoading(true)
    setErro(null)
    try {
      // supondo endpoint GET /executivos/busca?tipo=Agência&executivo=Nome
      const params = new URLSearchParams({ tipo, executivo: executivoSel })
      const dados = await getJSON<Linha[]>(`${API}/executivos/busca?${params.toString()}`)
      setLinhas(Array.isArray(dados) ? dados : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao buscar.")
    } finally {
      setLoading(false)
    }
  }

  // ver todos (sem filtrar por executivo)
  async function verTodos() {
    setLoading(true)
    setErro(null)
    try {
      const params = new URLSearchParams({ tipo })
      const dados = await getJSON<Linha[]>(`${API}/executivos/busca?${params.toString()}`)
      setLinhas(Array.isArray(dados) ? dados : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar lista.")
    } finally {
      setLoading(false)
    }
  }

  // exportar CSV (sem libs externas)
  function exportarCSV() {
    if (!linhas.length) {
      alert("Nenhum dado para exportar.")
      return
    }
    const cols = Object.keys(linhas[0])
    const csv = [
      cols.join(";"),
      ...linhas.map(l =>
        cols.map(c => {
          const v = (l as any)[c] ?? ""
          const s = String(v).replaceAll('"', '""')
          return `"${s}"`
        }).join(";")
      )
    ].join("\n")

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

  // abrir modal de edição
  function abrirEdicao(item: Linha) {
    setEditOriginal(item)
    const { ID, ...rest } = item
    const campos: Record<string, string> = {}
    Object.entries(rest).forEach(([k, v]) => (campos[k] = String(v ?? "")))
    setEditCampos(campos)
    setEditAberto(true)
  }

  // salvar edição
  async function salvarEdicao() {
    if (!editOriginal) return
    try {
      // Ex.: PUT /executivos/editar (ajuste conforme seu backend)
      await putJSON(`${API}/executivos/editar`, {
        tipo,
        item_id: editOriginal.ID,
        novos_dados: editCampos,
      })

      // refletir no estado local
      setLinhas(prev =>
        prev.map(l =>
          l.ID === editOriginal.ID ? ({ ID: l.ID, ...editCampos } as any as Linha) : l
        )
      )
      setEditAberto(false)
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar edição.")
    }
  }

  // excluir (simulado, como no Tkinter)
  function excluir(item: Linha) {
    if (!confirm(`Deseja excluir o registro:\n${JSON.stringify(item, null, 2)} ?`)) return
    // Aqui só removemos da tela (simulado). Se criar endpoint, chame-o antes.
    setLinhas(prev => prev.filter(l => l.ID !== item.ID))
    alert("Registro removido (simulado).")
  }

  const colunas = useMemo(() => (linhas[0] ? [...Object.keys(linhas[0]), "Ações"] : []), [linhas])

  return (
    <div className="space-y-8">
      {/* Título */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Busca por Executivo</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={exportarCSV}
            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Exportar CSV
          </button>
        </div>
      </div>

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
              {executivos.map((nome) => (
                <option key={nome} value={nome}>
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
              className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm w-full"
            >
              Buscar
            </button>
            <button
              onClick={verTodos}
              className="px-5 py-3 rounded-2xl border border-slate-300 text-slate-700 text-lg hover:bg-slate-50 w-full"
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
                            {String(v ?? "")}
                          </td>
                        ))}
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
                              onClick={() => excluir(linha)}
                              className="h-10 px-4 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Excluir"
                            >
                              🗑️ Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* Modal de edição */}
      {editAberto && editOriginal && (
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
                      setEditCampos((prev) => ({ ...prev, [campo]: e.target.value }))
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
