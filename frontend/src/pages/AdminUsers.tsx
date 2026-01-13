// src/pages/AdminUsers.tsx
import { useEffect, useMemo, useState } from "react"
import { getUser } from "../services/auth"
import { apiGet, apiPost } from "../services/api"

type PendingUser = {
  id: number
  email: string
  role: string
  is_approved: boolean
  executivo_nome?: string | null
}

type ApprovePayload = {
  role: string
  executivo_nome?: string | null
}

export default function AdminUsers() {
  const [lista, setLista] = useState<PendingUser[]>([])
  const [executivos, setExecutivos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // controles por usuário
  const [roleSel, setRoleSel] = useState<Record<number, string>>({})
  const [execSel, setExecSel] = useState<Record<number, string>>({})

  const me = getUser()

  const rolesDisponiveis = useMemo(() => ["user", "executivo", "financeiro", "admin"], [])

  async function carregar() {
    setLoading(true)
    setErro(null)

    try {
      const [pend, execs] = await Promise.all([
        apiGet<PendingUser[]>(`/admin/users/pending`),
        apiGet<string[]>(`/executivos`), // seu endpoint já retorna List[str]
      ])

      const pendArr = Array.isArray(pend) ? pend : []
      const execArr = Array.isArray(execs) ? execs.filter(Boolean) : []

      setLista(pendArr)
      setExecutivos(execArr)

      // inicializa selects
      const rolesInit: Record<number, string> = {}
      const execInit: Record<number, string> = {}

      pendArr.forEach((u) => {
        rolesInit[u.id] = (u.role || "user").toLowerCase()
        execInit[u.id] = (u.executivo_nome || "").trim()
      })

      setRoleSel(rolesInit)
      setExecSel(execInit)
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }

  async function aprovar(userId: number) {
    const role = (roleSel[userId] || "user").toLowerCase()
    const executivo_nome = (execSel[userId] || "").trim()

    if (role === "executivo" && !executivo_nome) {
      alert("Selecione o executivo para vincular ao usuário.")
      return
    }

    if (!confirm(`Aprovar este usuário como "${role}"?`)) return

    const payload: ApprovePayload = { role }
    if (role === "executivo") payload.executivo_nome = executivo_nome

    try {
      await apiPost(`/admin/users/${userId}/approve`, payload)
      alert("Usuário aprovado e notificado por e-mail.")
      await carregar()
    } catch (e: any) {
      alert(e?.message || "Erro ao aprovar.")
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  // segurança básica de UI
  if (me?.role !== "admin") {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-900/60 bg-red-950/35 px-4 py-3 text-red-100">
          Acesso restrito ao administrador.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-zinc-100">Usuários pendentes</h1>
        <button onClick={carregar} className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700">
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-zinc-400">Carregando...</div>
      ) : erro ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/35 px-4 py-3 text-red-100">{erro}</div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-8 text-zinc-400">
          Nenhum usuário pendente.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <table className="min-w-full">
            <thead className="bg-red-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">E-mail</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Executivo (se aplicável)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => {
                const role = (roleSel[u.id] || "user").toLowerCase()
                const precisaExec = role === "executivo"

                return (
                  <tr key={u.id} className="border-t border-zinc-800">
                    <td className="px-4 py-3 font-mono text-zinc-100">{u.id}</td>
                    <td className="px-4 py-3 text-zinc-200">{u.email}</td>

                    <td className="px-4 py-3">
                      <select
                        value={roleSel[u.id] || "user"}
                        onChange={(e) => {
                          const v = e.target.value
                          setRoleSel((prev) => ({ ...prev, [u.id]: v }))
                          // se mudou para algo diferente de executivo, limpa seleção
                          if (v !== "executivo") setExecSel((prev) => ({ ...prev, [u.id]: "" }))
                        }}
                        className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-zinc-100"
                      >
                        {rolesDisponiveis.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={execSel[u.id] || ""}
                        onChange={(e) => setExecSel((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        disabled={!precisaExec}
                        className={`rounded-xl border px-3 py-2 ${
                          precisaExec
                            ? "border-zinc-800 bg-zinc-950/40 text-zinc-100"
                            : "border-zinc-900 bg-zinc-950/20 text-zinc-500 cursor-not-allowed"
                        }`}
                      >
                        <option value="">{precisaExec ? "Selecione..." : "—"}</option>
                        {executivos.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>

                      {precisaExec && executivos.length === 0 ? (
                        <div className="text-xs text-zinc-500 mt-1">
                          Nenhum executivo encontrado em /executivos (cadastre em Agências/Anunciantes ou ajuste endpoint).
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => aprovar(u.id)}
                        className="px-3 py-1.5 rounded-xl border border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/10"
                      >
                        Aprovar
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
  )
}
