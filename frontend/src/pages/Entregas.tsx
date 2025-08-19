// src/pages/Entregas.tsx
import { useEffect, useMemo, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

// ===== Tipos =====
type EntregaStatus = "Sim" | "Não" | "pendente"

type Entrega = {
  id: number
  veiculacao_id: number
  data_entrega: string // ISO yyyy-mm-dd (backend já envia assim)
  foi_entregue: EntregaStatus
  motivo?: string | null
}

type VeicMini = {
  id: number
  produto_nome?: string | null
  numero_pi?: string | null
}

// ===== Helpers HTTP (com mensagens de erro do FastAPI) =====
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
      const j = await r.json()
      if (j?.detail) msg += ` - ${typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)}`
    } catch {
      const t = await r.text().catch(() => "")
      if (t) msg += ` - ${t}`
    }
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
      const j = await r.json()
      if (j?.detail) msg += ` - ${typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)}`
    } catch {
      const t = await r.text().catch(() => "")
      if (t) msg += ` - ${t}`
    }
    throw new Error(msg)
  }
  return r.json()
}
async function delJSON(url: string): Promise<void> {
  const r = await fetch(url, { method: "DELETE" })
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try {
      const j = await r.json()
      if (j?.detail) msg += ` - ${typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)}`
    } catch {
      const t = await r.text().catch(() => "")
      if (t) msg += ` - ${t}`
    }
    throw new Error(msg)
  }
}

// ===== Helpers UI =====
function isoToBR(iso?: string) {
  if (!iso) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return iso
}
function brToISO(br?: string) {
  if (!br) return ""
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return br
}

function badgeClasses(status: EntregaStatus) {
  if (status === "Sim") return "bg-green-100 text-green-800"
  if (status === "Não") return "bg-red-100 text-red-800"
  return "bg-amber-100 text-amber-900"
}

// ===== Export helpers (xlsx ou CSV) =====
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

export default function Entregas() {
  // base
  const [veics, setVeics] = useState<VeicMini[]>([])
  const [veicMap, setVeicMap] = useState<Record<number, VeicMini>>({})

  // lista
  const [lista, setLista] = useState<Entrega[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // filtros
  const [somentePendentes, setSomentePendentes] = useState(false)
  const [veicFiltro, setVeicFiltro] = useState<number | "">("")
  const [statusFiltro, setStatusFiltro] = useState<"" | EntregaStatus>("")
  const [busca, setBusca] = useState("")

  // cadastro
  const [novoVeicId, setNovoVeicId] = useState<number | "">("")
  const [novaData, setNovaData] = useState("") // input date YYYY-MM-DD
  const [novoStatus, setNovoStatus] = useState<EntregaStatus>("pendente")
  const [novoMotivo, setNovoMotivo] = useState("")
  const [salvando, setSalvando] = useState(false)

  // edição (modal)
  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<Entrega | null>(null)
  const [editVeicId, setEditVeicId] = useState<number | "">("")
  const [editData, setEditData] = useState("")
  const [editStatus, setEditStatus] = useState<EntregaStatus>("pendente")
  const [editMotivo, setEditMotivo] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // ===== Carregamentos =====
  async function carregarVeiculacoes() {
    try {
      const vs = await getJSON<any[]>(`${API}/veiculacoes`)
      const rows: VeicMini[] = (Array.isArray(vs) ? vs : []).map(v => ({
        id: v.id,
        produto_nome: v.produto_nome || undefined,
        numero_pi: v.numero_pi || undefined,
      }))
      setVeics(rows)
      const map: Record<number, VeicMini> = {}
      rows.forEach(v => { map[v.id] = v })
      setVeicMap(map)
    } catch (e: any) {
      // só pra exibir nomes bonitinhos; se falhar, seguimos com IDs
      console.warn("Falha ao carregar veiculações:", e?.message)
    }
  }

  async function carregarEntregas() {
    setLoading(true); setErro(null)
    try {
      const url = somentePendentes ? `${API}/entregas/pendentes` : `${API}/entregas`
      const es = await getJSON<Entrega[]>(url)
      setLista(Array.isArray(es) ? es : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar entregas.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarVeiculacoes(); }, [])
  useEffect(() => { carregarEntregas(); }, [somentePendentes])

  // ===== Filtrada local =====
  const filtrada = useMemo(() => {
    let base = [...lista]
    if (veicFiltro) base = base.filter(e => e.veiculacao_id === veicFiltro)
    if (statusFiltro) base = base.filter(e => e.foi_entregue === statusFiltro)
    const q = busca.trim().toLowerCase()
    if (q) {
      base = base.filter(e => {
        const v = veicMap[e.veiculacao_id]
        const prod = (v?.produto_nome || "").toLowerCase()
        const pi = (v?.numero_pi || "").toLowerCase()
        const motivo = (e.motivo || "").toLowerCase()
        return prod.includes(q) || pi.includes(q) || motivo.includes(q) || String(e.veiculacao_id).includes(q)
      })
    }
    // ordenar por data desc (mais recentes primeiro), depois ID desc
    base.sort((a, b) => {
      const ad = a.data_entrega || ""
      const bd = b.data_entrega || ""
      if (ad !== bd) return bd.localeCompare(ad)
      return b.id - a.id
    })
    return base
  }, [lista, veicFiltro, statusFiltro, busca, veicMap])

  // ===== Ações =====
  async function salvarNova() {
    if (!novoVeicId) { alert("Selecione a veiculação."); return }
    if (!novaData) { alert("Informe a data de entrega."); return }
    setSalvando(true)
    try {
      await postJSON(`${API}/entregas`, {
        veiculacao_id: Number(novoVeicId),
        data_entrega: novaData,            // ISO ok
        foi_entregue: novoStatus,
        motivo: (novoMotivo || "").trim(),
      })
      // limpa form
      setNovoVeicId(""); setNovaData(""); setNovoStatus("pendente"); setNovoMotivo("")
      await carregarEntregas()
      alert("Entrega cadastrada com sucesso!")
    } catch (e: any) {
      alert(e?.message || "Erro ao cadastrar entrega.")
    } finally {
      setSalvando(false)
    }
  }

  function abrirEdicao(e: Entrega) {
    setEdit(e)
    setEditVeicId(e.veiculacao_id)
    setEditData(e.data_entrega || "")
    setEditStatus(e.foi_entregue)
    setEditMotivo(e.motivo || "")
    setEditError(null)
    setEditOpen(true)
  }
  function fecharEdicao() {
    setEditOpen(false); setEdit(null); setEditError(null)
  }

  async function salvarEdicao() {
    if (!edit) return
    if (!editData) { setEditError("Data é obrigatória."); return }
    setEditSaving(true)
    try {
      const upd = await putJSON<Entrega>(`${API}/entregas/${edit.id}`, {
        veiculacao_id: editVeicId || undefined,
        data_entrega: editData,
        foi_entregue: editStatus,
        motivo: editMotivo,
      })
      setLista(prev => prev.map(x => x.id === upd.id ? upd : x))
      fecharEdicao()
    } catch (e: any) {
      setEditError(e?.message || "Erro ao salvar edição.")
    } finally {
      setEditSaving(false)
    }
  }

  async function marcarEntregue(e: Entrega) {
    try {
      const upd = await putJSON<Entrega>(`${API}/entregas/${e.id}/entregue`, {})
      setLista(prev => prev.map(x => x.id === upd.id ? upd : x))
    } catch (err: any) {
      alert(err?.message || "Falha ao marcar como entregue.")
    }
  }

  async function atualizarMotivoQuick(e: Entrega) {
    const novo = prompt("Motivo (pode ficar vazio):", e.motivo || "")
    if (novo === null) return
    try {
      // parâmetro 'motivo' como query string
      const url = `${API}/entregas/${e.id}/motivo?motivo=${encodeURIComponent(novo)}`
      const r = await fetch(url, { method: "PUT" })
      if (!r.ok) {
        let msg = `${r.status} ${r.statusText}`
        try {
          const j = await r.json()
          if (j?.detail) msg += ` - ${typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)}`
        } catch { /* no-op */ }
        throw new Error(msg)
      }
      const upd: Entrega = await r.json()
      setLista(prev => prev.map(x => x.id === upd.id ? upd : x))
    } catch (err: any) {
      alert(err?.message || "Falha ao atualizar motivo.")
    }
  }

  async function excluir(e: Entrega) {
    if (!confirm(`Excluir entrega #${e.id} de ${isoToBR(e.data_entrega)}?`)) return
    try {
      await delJSON(`${API}/entregas/${e.id}`)
      setLista(prev => prev.filter(x => x.id !== e.id))
    } catch (err: any) {
      alert(err?.message || "Erro ao excluir entrega.")
    }
  }

  // ===== Export =====
  async function exportarPlanilha(rows: Entrega[]) {
    if (!rows?.length) { alert("Nada para exportar."); return }
    const data = rows.map(e => {
      const v = veicMap[e.veiculacao_id]
      return {
        ID: e.id,
        "Veiculação #": e.veiculacao_id,
        Produto: v?.produto_nome || "",
        "PI Nº": v?.numero_pi || "",
        "Data (ISO)": e.data_entrega || "",
        "Data (BR)": isoToBR(e.data_entrega || ""),
        Status: e.foi_entregue,
        Motivo: e.motivo || "",
      }
    })
    const nomeArq = `entregas_${new Date().toISOString().slice(0,10)}.xlsx`
    try {
      const XLSX = await import("xlsx")
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Entregas")
      XLSX.writeFile(wb, nomeArq)
    } catch {
      const csv = jsonToCSV(data)
      downloadBlob(csv, nomeArq.replace(/\.xlsx$/, ".csv"), "text/csv;charset=utf-8;")
      alert("Exportei em CSV (fallback). Para .xlsx nativo, instale a lib 'xlsx'.")
    }
  }

  return (
    <div className="space-y-8">
      {/* Título + ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Entregas</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportarPlanilha(filtrada)}
            disabled={!filtrada.length}
            className="px-5 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-lg hover:bg-slate-50 disabled:opacity-60"
            title="Exportar para Excel"
          >
            📤 Exportar XLSX
          </button>
          <button
            onClick={carregarEntregas}
            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 transition shadow-sm"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Cadastro */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Nova entrega</h2>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div className="lg:col-span-2">
            <label className="block text-xl font-semibold text-slate-800 mb-2">Veiculação</label>
            <select
              value={novoVeicId}
              onChange={(e) => setNovoVeicId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Selecione…</option>
              {veics.map(v => (
                <option key={v.id} value={v.id}>
                  #{v.id} — {v.produto_nome || "Produto"} • PI {v.numero_pi || "—"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Data</label>
            <input
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Status</label>
            <select
              value={novoStatus}
              onChange={(e) => setNovoStatus(e.target.value as EntregaStatus)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="pendente">pendente</option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </div>

          <div className="lg:col-span-4">
            <label className="block text-xl font-semibold text-slate-800 mb-2">Motivo (opcional)</label>
            <input
              value={novoMotivo}
              onChange={(e) => setNovoMotivo(e.target.value)}
              placeholder="Ex.: Cliente solicitou reagendamento…"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={salvarNova}
            disabled={salvando}
            className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Cadastrar Entrega"}
          </button>
        </div>
      </section>

      {/* Filtros */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xl font-semibold text-slate-800 mb-2">Buscar</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Produto, nº do PI, motivo, ID da veiculação…"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Veiculação</label>
            <select
              value={veicFiltro}
              onChange={(e) => setVeicFiltro(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Todas</option>
              {veics.map(v => (
                <option key={v.id} value={v.id}>
                  #{v.id} — {v.produto_nome || "Produto"} • PI {v.numero_pi || "—"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xl font-semibold text-slate-800 mb-2">Status</label>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value as any)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500"
            >
              <option value="">Todos</option>
              <option value="pendente">pendente</option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-lg text-slate-800">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={somentePendentes}
                onChange={(e) => setSomentePendentes(e.target.checked)}
              />
              <span>Somente pendentes (API)</span>
            </label>
          </div>
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold text-slate-900">Entregas cadastradas</h2>
          <div className="text-slate-600 text-base">{filtrada.length} registro(s)</div>
        </div>

        {loading ? (
          <div className="p-4 text-slate-600 text-lg">Carregando…</div>
        ) : erro ? (
          <div className="p-4 text-red-700 text-lg">{erro}</div>
        ) : filtrada.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
            Nenhuma entrega encontrada.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-red-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-red-200">
                <thead className="bg-gradient-to-r from-red-700 to-red-600 text-white sticky top-0">
                  <tr>
                    {["ID","Veiculação","Data","Status","Motivo","Ações"].map(h => (
                      <th key={h} className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {filtrada.map((e, idx) => {
                    const v = veicMap[e.veiculacao_id]
                    return (
                      <tr
                        key={e.id}
                        className={[
                          "transition",
                          idx % 2 === 0 ? "bg-white" : "bg-red-50/40",
                          "hover:bg-red-50"
                        ].join(" ")}
                      >
                        <td className="px-6 py-4 text-slate-900 text-base font-medium">{e.id}</td>
                        <td className="px-6 py-4 text-slate-900 text-base font-medium">
                          <div className="flex flex-col">
                            <span>#{e.veiculacao_id} — {v?.produto_nome || "Produto"}</span>
                            <span className="text-sm text-slate-500">PI {v?.numero_pi || "—"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-800 text-base">{isoToBR(e.data_entrega)}</td>
                        <td className="px-6 py-4 text-slate-800 text-base">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(e.foi_entregue)}`}>
                            {e.foi_entregue}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-800 text-base">
                          <div className="truncate max-w-[320px]" title={e.motivo || ""}>{e.motivo || "—"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => abrirEdicao(e)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Editar"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => atualizarMotivoQuick(e)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Editar motivo"
                            >
                              📝 Motivo
                            </button>
                            {e.foi_entregue !== "Sim" && (
                              <button
                                onClick={() => marcarEntregue(e)}
                                className="px-3 py-1.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                                title="Marcar como entregue"
                              >
                                ✅ Entregue
                              </button>
                            )}
                            <button
                              onClick={() => excluir(e)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                              title="Excluir"
                            >
                              🗑️ Excluir
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
        )}
      </section>

      {/* Modal de edição */}
      {editOpen && edit && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={fecharEdicao} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide text-red-700 font-semibold">Editar Entrega</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">
                  #{edit.id} • {isoToBR(edit.data_entrega)}
                </div>
              </div>
              <button
                onClick={fecharEdicao}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                ✖ Fechar
              </button>
            </div>

            <div className="p-6 space-y-6">
              {editError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Veiculação</label>
                  <select
                    value={editVeicId}
                    onChange={(e) => setEditVeicId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">—</option>
                    {veics.map(v => (
                      <option key={v.id} value={v.id}>
                        #{v.id} — {v.produto_nome || "Produto"} • PI {v.numero_pi || "—"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={editData}
                    onChange={(e) => setEditData(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as EntregaStatus)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="pendente">pendente</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Motivo</label>
                  <input
                    value={editMotivo}
                    onChange={(e) => setEditMotivo(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={salvarEdicao}
                  disabled={editSaving}
                  className="px-6 py-3 rounded-2xl bg-red-600 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {editSaving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
