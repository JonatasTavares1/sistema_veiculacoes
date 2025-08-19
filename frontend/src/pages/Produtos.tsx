// src/pages/Produtos.tsx
import { useEffect, useMemo, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

type ProdutoListItem = {
  id: number
  pi_id: number
  numero_pi?: string | null
  nome: string
  descricao?: string | null
  veiculacoes: number
  total_produto: number
}

type VeiculacaoItem = {
  id?: number
  canal?: string | null
  formato?: string | null
  data_inicio?: string | null // yyyy-mm-dd
  data_fim?: string | null    // yyyy-mm-dd
  quantidade?: number | null
  valor?: number | null
}

type ProdutoDetalhe = {
  id: number
  nome: string
  descricao?: string | null
  total_produto: number
  veiculacoes: VeiculacaoItem[]
}

type PedidoCriacao = {
  numero_pi?: string | null
  pi_id?: number | null
  nome: string
  descricao?: string | null
  veiculacoes: VeiculacaoItem[]
}

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
async function postJSON<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try {
      const t = await r.json()
      if (t?.detail) msg += ` - ${typeof t.detail === "string" ? t.detail : JSON.stringify(t.detail)}`
    } catch {}
    throw new Error(msg)
  }
  return r.json()
}
async function putJSON<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try {
      const t = await r.json()
      if (t?.detail) msg += ` - ${typeof t.detail === "string" ? t.detail : JSON.stringify(t.detail)}`
    } catch {}
    throw new Error(msg)
  }
  return r.json()
}
async function del(url: string): Promise<void> {
  const r = await fetch(url, { method: "DELETE" })
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try {
      const t = await r.json()
      if (t?.detail) msg += ` - ${typeof t.detail === "string" ? t.detail : JSON.stringify(t.detail)}`
    } catch {}
    throw new Error(msg)
  }
}

function trataNumeroBR(s: string): number | null {
  const t = (s || "").trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

export default function Produtos() {
  const [lista, setLista] = useState<ProdutoListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // filtros
  const [busca, setBusca] = useState("")
  const [piNumeroFiltro, setPiNumeroFiltro] = useState("")

  // editor (criar/editar)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [editId, setEditId] = useState<number | null>(null)
  const [numeroPIInput, setNumeroPIInput] = useState("") // usado no create
  const [produtoNome, setProdutoNome] = useState("")
  const [produtoDesc, setProdutoDesc] = useState<string>("")
  const [veics, setVeics] = useState<VeiculacaoItem[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [opcoesNomes, setOpcoesNomes] = useState<string[]>([])

  async function carregar() {
    setLoading(true); setErro(null)
    try {
      const qs = new URLSearchParams()
      if (piNumeroFiltro.trim()) qs.set("pi_numero", piNumeroFiltro.trim())
      const data = await getJSON<ProdutoListItem[]>(`${API}/produtos${qs.toString() ? `?${qs}` : ""}`)
      setLista(Array.isArray(data) ? data : [])
      const nomes = await getJSON<string[]>(`${API}/produtos/opcoes-nome`).catch(() => [])
      setOpcoesNomes(nomes || [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar produtos.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { carregar() }, [])
  useEffect(() => { carregar() }, [piNumeroFiltro])

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista.filter(p =>
      !q ||
      p.nome.toLowerCase().includes(q) ||
      (p.numero_pi || "").toLowerCase().includes(q)
    )
  }, [lista, busca])

  // Editor helpers
  function addVeic() {
    setVeics(v => [...v, { canal: "", formato: "", data_inicio: "", data_fim: "", quantidade: null, valor: null }])
  }
  function updVeic(i: number, patch: Partial<VeiculacaoItem>) {
    setVeics(v => v.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }
  function delVeic(i: number) {
    setVeics(v => v.filter((_, idx) => idx !== i))
  }

  function abrirCreate() {
    setMode("create")
    setEditId(null)
    setNumeroPIInput("")
    setProdutoNome("")
    setProdutoDesc("")
    setVeics([])
    setFormError(null)
    setDrawerOpen(true)
  }

  async function abrirEdit(produtoId: number) {
    setMode("edit")
    setEditId(produtoId)
    setNumeroPIInput("") // não usa em edição
    setFormError(null)
    setSaving(false)
    try {
      const det = await getJSON<ProdutoDetalhe>(`${API}/produtos/${produtoId}/detalhe`)
      setProdutoNome(det.nome || "")
      setProdutoDesc(det.descricao || "")
      const rows = (det.veiculacoes || []).map(v => ({
        id: v.id,
        canal: v.canal || "",
        formato: v.formato || "",
        data_inicio: (v.data_inicio || "").slice(0, 10), // yyyy-mm-dd
        data_fim: (v.data_fim || "").slice(0, 10),
        quantidade: v.quantidade ?? null,
        valor: v.valor ?? null,
      }))
      setVeics(rows)
      setDrawerOpen(true)
    } catch (e: any) {
      setErro(e?.message || "Falha ao abrir produto.")
    }
  }

  function fecharDrawer() {
    setDrawerOpen(false)
    setFormError(null)
  }

  async function salvar() {
    setFormError(null)
    if (!produtoNome.trim()) { setFormError("Informe o nome do produto."); return }
    if (mode === "create" && !numeroPIInput.trim()) { setFormError("Informe o número do PI para vincular."); return }

    setSaving(true)
    try {
      const payloadVeics: VeiculacaoItem[] = veics.map(v => ({
        id: v.id,
        canal: (v.canal || "").trim() || null,
        formato: (v.formato || "").trim() || null,
        data_inicio: (v.data_inicio || "").trim() || null, // input date -> yyyy-mm-dd
        data_fim: (v.data_fim || "").trim() || null,
        quantidade: v.quantidade == null ? null : Number(v.quantidade),
        valor: v.valor == null ? null : Number(v.valor),
      }))

      if (mode === "create") {
        const body: PedidoCriacao = {
          numero_pi: numeroPIInput.trim(),
          nome: produtoNome.trim(),
          descricao: produtoDesc || null,
          veiculacoes: payloadVeics,
        }
        await postJSON<ProdutoDetalhe>(`${API}/produtos`, body)
      } else if (mode === "edit" && editId != null) {
        const body = {
          nome: produtoNome.trim(),
          descricao: produtoDesc || null,
          veiculacoes: payloadVeics,
        }
        await putJSON<ProdutoDetalhe>(`${API}/produtos/${editId}`, body)
      }
      fecharDrawer()
      await carregar()
    } catch (e: any) {
      setFormError(e?.message || "Falha ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  async function remover(produtoId: number) {
    if (!confirm("Confirmar exclusão do produto e suas veiculações?")) return
    try {
      await del(`${API}/produtos/${produtoId}`)
      await carregar()
    } catch (e: any) {
      alert(e?.message || "Falha ao excluir.")
    }
  }

  async function exportarXLSX() {
    const rows = filtrada.map((p) => ({
      "Produto ID": p.id,
      "PI": p.numero_pi || "",
      "Nome do Produto": p.nome,
      "Descrição": p.descricao || "",
      "Veiculações (qtd)": p.veiculacoes,
      "Total do Produto (R$)": p.total_produto,
    }))

    const xlsx = await import("xlsx")
    const ws = xlsx.utils.json_to_sheet(rows, {
      header: Object.keys(rows[0] || {}),
    })
    const moneyCol = "Total do Produto (R$)"
    rows.forEach((r, i) => {
      const cell = xlsx.utils.encode_cell({ r: i + 1, c: Object.keys(rows[0]).indexOf(moneyCol) })
      const v = r[moneyCol as keyof typeof r] as number
      // formatar como texto BRL
      ;(ws as any)[cell] = { t: "s", v: (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
    })
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, "Produtos")
    const now = new Date()
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-")
    xlsx.writeFile(wb, `produtos_${stamp}.xlsx`)
  }

  return (
    <div className="space-y-8">
      {/* Título + ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Produtos</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={exportarXLSX}
            className="px-5 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-lg hover:bg-slate-50"
          >
            📤 Exportar XLSX
          </button>
          <button
            onClick={carregar}
            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Atualizar
          </button>
          <button
            onClick={abrirCreate}
            className="px-5 py-3 rounded-2xl bg-emerald-600 text-white text-lg font-semibold hover:bg-emerald-700 transition shadow-sm"
          >
            ➕ Novo Produto
          </button>
        </div>
      </div>

      {/* Filtros */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Buscar</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome do produto ou PI"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Filtrar por Nº do PI</label>
            <input
              value={piNumeroFiltro}
              onChange={(e) => setPiNumeroFiltro(e.target.value)}
              placeholder="Ex.: 12345"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
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
            Nenhum produto encontrado.
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
                    {["ID","PI","Produto","Descrição","Veiculações","Total (R$)","Ações"].map(h => (
                      <th key={h} className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {filtrada.map((p, idx) => (
                    <tr key={p.id} className={["transition", idx % 2 === 0 ? "bg-white" : "bg-red-50/40", "hover:bg-red-50"].join(" ")}>
                      <td className="px-6 py-4 text-slate-900 text-base font-medium">{p.id}</td>
                      <td className="px-6 py-4 text-slate-900 text-base font-medium"><span className="font-mono">{p.numero_pi || "—"}</span></td>
                      <td className="px-6 py-4 text-slate-800 text-base">{p.nome}</td>
                      <td className="px-6 py-4 text-slate-800 text-base"><div className="max-w-[360px] truncate">{p.descricao || "—"}</div></td>
                      <td className="px-6 py-4 text-slate-800 text-base">{p.veiculacoes}</td>
                      <td className="px-6 py-4 text-slate-900 text-base font-semibold">{fmtMoney(p.total_produto)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => abrirEdit(p.id)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                            title="Editar produto e veiculações"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => remover(p.id)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                            title="Excluir produto"
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
          </div>
        )}
      </section>

      {/* Drawer de Criação/Edição */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharDrawer} />
          <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">
                  {mode === "create" ? "Novo Produto" : "Editar Produto"}
                </div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">
                  {mode === "create" ? "Criar" : "Atualizar"}
                </div>
              </div>
              <button
                onClick={fecharDrawer}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                ✖ Fechar
              </button>
            </div>

            <div className="p-6 space-y-6">
              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mode === "create" && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Número do PI (vincular)</label>
                    <input
                      value={numeroPIInput}
                      onChange={(e) => setNumeroPIInput(e.target.value)}
                      placeholder="Ex.: 123456"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                    <div className="text-xs text-slate-500 mt-1">
                      Dica: o PI precisa existir. Você também pode criar o produto direto pelo cadastro do PI.
                    </div>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Produto</label>
                  <input
                    list="opcoes-produtos"
                    value={produtoNome}
                    onChange={(e) => setProdutoNome(e.target.value)}
                    placeholder="Digite ou escolha"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                  <datalist id="opcoes-produtos">
                    {opcoesNomes.map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição (opcional)</label>
                  <input
                    value={produtoDesc}
                    onChange={(e) => setProdutoDesc(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              {/* Veiculações */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">Veiculações</div>
                  <button
                    onClick={addVeic}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                  >
                    ➕ Adicionar veiculação
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Canal","Formato","Início","Fim","Qtde","Valor (R$)",""].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {veics.length === 0 ? (
                        <tr><td className="px-3 py-3 text-slate-600" colSpan={7}>Nenhuma veiculação. Adicione acima.</td></tr>
                      ) : veics.map((v, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2"><input value={v.canal || ""} onChange={e => updVeic(i, { canal: e.target.value })} className="w-36 rounded border border-slate-300 px-2 py-1" /></td>
                          <td className="px-3 py-2"><input value={v.formato || ""} onChange={e => updVeic(i, { formato: e.target.value })} className="w-36 rounded border border-slate-300 px-2 py-1" /></td>
                          <td className="px-3 py-2"><input type="date" value={v.data_inicio || ""} onChange={e => updVeic(i, { data_inicio: e.target.value })} className="rounded border border-slate-300 px-2 py-1" /></td>
                          <td className="px-3 py-2"><input type="date" value={v.data_fim || ""} onChange={e => updVeic(i, { data_fim: e.target.value })} className="rounded border border-slate-300 px-2 py-1" /></td>
                          <td className="px-3 py-2"><input type="number" min={0} value={v.quantidade ?? ""} onChange={e => updVeic(i, { quantidade: e.target.value ? Number(e.target.value) : null })} className="w-24 rounded border border-slate-300 px-2 py-1" /></td>
                          <td className="px-3 py-2"><input inputMode="decimal" placeholder="0,00" value={v.valor ?? ""} onChange={e => {
                            const n = trataNumeroBR(e.target.value)
                            updVeic(i, { valor: n })
                          }} className="w-32 rounded border border-slate-300 px-2 py-1" /></td>
                          <td className="px-3 py-2">
                            <button onClick={() => delVeic(i)} className="px-2 py-1 rounded border border-slate-300 text-slate-700 text-sm hover:bg-slate-50">Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={salvar}
                  disabled={saving}
                  className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : (mode === "create" ? "Criar produto" : "Salvar alterações")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
