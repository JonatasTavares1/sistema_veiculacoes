// src/pages/AdminUsers.tsx
import { useEffect, useMemo, useState } from "react"
import { getUser } from "../services/auth"
import { apiGet, apiPost } from "../services/api"

type AdminUser = {
  id: number
  email: string
  role: string
  is_approved: boolean
  status?: string | null
  executivo_nome?: string | null
  ativo?: boolean | null
  created_at?: string | null
}

type ApprovePayload = {
  role: string
  executivo_nome?: string | null
}

type UpdatePayload = {
  role?: string
  executivo_nome?: string | null
  ativo?: boolean
  is_approved?: boolean
}

type Tab = "pendentes" | "usuarios"

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ")
}

// ✅ Helper que estava faltando (resolve "Cannot find name 'normStr'")
function normStr(v: any) {
  return (v ?? "").toString().trim()
}

export default function AdminUsers() {
  const me = getUser()

  const [tab, setTab] = useState<Tab>("pendentes")

  const [pendentes, setPendentes] = useState<AdminUser[]>([])
  const [usuarios, setUsuarios] = useState<AdminUser[]>([])
  const [executivos, setExecutivos] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // controles por usuário (inline edit)
  const [roleSel, setRoleSel] = useState<Record<number, string>>({})
  const [execSel, setExecSel] = useState<Record<number, string>>({})
  const [ativoSel, setAtivoSel] = useState<Record<number, boolean>>({})

  // filtros / busca
  const [q, setQ] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [onlyApproved, setOnlyApproved] = useState<boolean | "all">("all")

  // UX: salva por linha
  const [savingId, setSavingId] = useState<number | null>(null)

  // ✅ AQUI: inclui opec
  const rolesDisponiveis = useMemo(() => ["user", "executivo", "opec", "financeiro", "admin"], [])

  function initEdits(rows: AdminUser[]) {
    const rolesInit: Record<number, string> = {}
    const execInit: Record<number, string> = {}
    const ativoInit: Record<number, boolean> = {}

    rows.forEach((u) => {
      rolesInit[u.id] = (u.role || "user").toLowerCase()
      execInit[u.id] = normStr(u.executivo_nome)
      ativoInit[u.id] = u.ativo === null || u.ativo === undefined ? true : Boolean(u.ativo)
    })

    setRoleSel((prev) => ({ ...prev, ...rolesInit }))
    setExecSel((prev) => ({ ...prev, ...execInit }))
    setAtivoSel((prev) => ({ ...prev, ...ativoInit }))
  }

  async function carregarTudo() {
    setLoading(true)
    setErro(null)

    try {
      const [pend, users, execs] = await Promise.all([
        apiGet<AdminUser[]>(`/admin/users/pending`),
        apiGet<AdminUser[]>(`/admin/users`),
        apiGet<string[]>(`/executivos`),
      ])

      const pendArr = Array.isArray(pend) ? pend : []
      const userArr = Array.isArray(users) ? users : []
      const execArr = Array.isArray(execs) ? execs.filter(Boolean) : []

      setPendentes(pendArr)
      setUsuarios(userArr)
      setExecutivos(execArr)

      initEdits([...pendArr, ...userArr])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }

  async function carregarPendentes() {
    setLoading(true)
    setErro(null)
    try {
      const pend = await apiGet<AdminUser[]>(`/admin/users/pending`)
      const pendArr = Array.isArray(pend) ? pend : []
      setPendentes(pendArr)
      initEdits(pendArr)
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar pendentes.")
    } finally {
      setLoading(false)
    }
  }

  async function carregarUsuarios() {
    setLoading(true)
    setErro(null)
    try {
      const users = await apiGet<AdminUser[]>(`/admin/users`)
      const userArr = Array.isArray(users) ? users : []
      setUsuarios(userArr)
      initEdits(userArr)
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar usuários.")
    } finally {
      setLoading(false)
    }
  }

  async function aprovar(userId: number) {
    const role = (roleSel[userId] || "user").toLowerCase()
    const executivo_nome = normStr(execSel[userId])

    if (role === "executivo" && !executivo_nome) {
      alert("Selecione o executivo para vincular ao usuário.")
      return
    }

    if (!confirm(`Aprovar este usuário como "${role}"?`)) return

    const payload: ApprovePayload = { role }
    if (role === "executivo") payload.executivo_nome = executivo_nome

    try {
      setSavingId(userId)
      await apiPost(`/admin/users/${userId}/approve`, payload)
      alert("Usuário aprovado.")
      await carregarTudo()
    } catch (e: any) {
      alert(e?.message || "Erro ao aprovar.")
    } finally {
      setSavingId(null)
    }
  }

  function getDirty(userId: number, original?: AdminUser | null) {
    const role = (roleSel[userId] || original?.role || "user").toLowerCase()
    const executivo_nome = normStr(execSel[userId] ?? original?.executivo_nome ?? "")
    const ativo = ativoSel[userId] ?? (original?.ativo ?? true)

    const out: UpdatePayload = {}

    if (!original || role !== (original.role || "user").toLowerCase()) out.role = role

    // executivo_nome só é válido quando role=executivo; caso contrário, salva null para “desvincular”
    if (role === "executivo") {
      if (!original || executivo_nome !== normStr(original.executivo_nome)) out.executivo_nome = executivo_nome
    } else {
      if (!original || normStr(original.executivo_nome) !== "") out.executivo_nome = null
    }

    if (!original || Boolean(ativo) !== Boolean(original.ativo ?? true)) out.ativo = Boolean(ativo)

    return { role, executivo_nome, ativo, payload: out }
  }

  async function salvar(user: AdminUser) {
    const { role, executivo_nome, payload } = getDirty(user.id, user)

    if (role === "executivo" && !executivo_nome) {
      alert("Para role 'executivo', selecione o nome do executivo.")
      return
    }

    if (Object.keys(payload).length === 0) {
      alert("Nenhuma alteração para salvar.")
      return
    }

    try {
      setSavingId(user.id)
      await apiPost(`/admin/users/${user.id}/update`, payload)
      alert("Alterações salvas.")
      await carregarUsuarios()
      await carregarPendentes()
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar.")
    } finally {
      setSavingId(null)
    }
  }

  async function revogarAprovacao(user: AdminUser) {
    if (!confirm(`Revogar aprovação de ${user.email}?`)) return
    try {
      setSavingId(user.id)
      await apiPost(`/admin/users/${user.id}/update`, { is_approved: false } as UpdatePayload)
      alert("Aprovação revogada.")
      await carregarTudo()
    } catch (e: any) {
      alert(e?.message || "Erro ao revogar.")
    } finally {
      setSavingId(null)
    }
  }

  useEffect(() => {
    carregarTudo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const card = "rounded-3xl border border-zinc-800 bg-zinc-900/40"
  const input =
    "rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/35"
  const tabBtn =
    "px-4 py-2 rounded-2xl text-sm font-semibold transition outline-none focus:ring-2 focus:ring-red-500/35"
  const tabOn = "bg-red-600 text-white shadow shadow-red-600/20"
  const tabOff = "bg-zinc-950/30 text-zinc-200 hover:bg-zinc-950/45"

  const pendCount = pendentes.length
  const usersCount = usuarios.length

  const usuariosFiltrados = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return usuarios.filter((u) => {
      if (roleFilter !== "all" && (u.role || "").toLowerCase() !== roleFilter) return false
      if (onlyApproved !== "all") {
        const ok = Boolean(u.is_approved) === Boolean(onlyApproved)
        if (!ok) return false
      }
      if (!qq) return true
      const hay = `${u.email} ${u.role} ${u.executivo_nome || ""}`.toLowerCase()
      return hay.includes(qq)
    })
  }, [usuarios, q, roleFilter, onlyApproved])

  return (
    <div className="p-6 space-y-4">
      {/* Header + Tabs */}
      <div className={cx(card, "p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
              Administração
              <span className="h-1 w-1 rounded-full bg-red-200/80" />
              <span className="text-red-100/80">Usuários e permissões</span>
            </div>

            <h1 className="mt-3 text-3xl font-extrabold text-zinc-100 tracking-tight">Admin Users</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Aprove usuários pendentes e gerencie usuários existentes (role, vínculo de executivo e status).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={carregarTudo}
              className="rounded-2xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700"
            >
              Atualizar tudo
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setTab("pendentes")} className={cx(tabBtn, tab === "pendentes" ? tabOn : tabOff)}>
            Pendentes ({pendCount})
          </button>
          <button onClick={() => setTab("usuarios")} className={cx(tabBtn, tab === "usuarios" ? tabOn : tabOff)}>
            Usuários ({usersCount})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-400">Carregando...</div>
      ) : erro ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/35 px-4 py-3 text-red-100">{erro}</div>
      ) : tab === "pendentes" ? (
        pendentes.length === 0 ? (
          <div className={cx(card, "px-5 py-8 text-zinc-400")}>Nenhum usuário pendente.</div>
        ) : (
          <div className={cx(card, "overflow-hidden")}>
            <div className="p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-zinc-100">Usuários pendentes</div>
                <div className="text-sm text-zinc-500">Aprovação e vínculo com executivo (quando aplicável).</div>
              </div>

              <button
                onClick={carregarPendentes}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/35 px-4 py-2.5 text-zinc-100 hover:bg-zinc-950/55"
              >
                Recarregar pendentes
              </button>
            </div>

            <div className="overflow-auto custom-scroll">
              <table className="min-w-full">
                <thead className="bg-red-600 text-white sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">E-mail</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Executivo (se aplicável)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((u) => {
                    const role = (roleSel[u.id] || "user").toLowerCase()
                    const precisaExec = role === "executivo"
                    const isSaving = savingId === u.id

                    return (
                      <tr key={u.id} className="border-t border-zinc-800 hover:bg-zinc-950/25 transition">
                        <td className="px-4 py-3 font-mono text-zinc-100">{u.id}</td>
                        <td className="px-4 py-3 text-zinc-200">{u.email}</td>

                        <td className="px-4 py-3">
                          <select
                            value={roleSel[u.id] || "user"}
                            onChange={(e) => {
                              const v = e.target.value
                              setRoleSel((prev) => ({ ...prev, [u.id]: v }))
                              if (v !== "executivo") setExecSel((prev) => ({ ...prev, [u.id]: "" }))
                            }}
                            className={cx(input, "px-3 py-2 rounded-xl")}
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
                            className={cx(
                              "rounded-xl border px-3 py-2",
                              precisaExec
                                ? "border-zinc-800 bg-zinc-950/40 text-zinc-100"
                                : "border-zinc-900 bg-zinc-950/20 text-zinc-500 cursor-not-allowed"
                            )}
                          >
                            <option value="">{precisaExec ? "Selecione..." : "—"}</option>
                            {executivos.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>

                          {precisaExec && executivos.length === 0 ? (
                            <div className="text-xs text-zinc-500 mt-1">Nenhum executivo encontrado em /executivos.</div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3">
                          <button
                            onClick={() => aprovar(u.id)}
                            disabled={isSaving}
                            className={cx(
                              "px-3 py-2 rounded-xl border text-sm font-semibold transition",
                              isSaving
                                ? "border-zinc-800 text-zinc-500 cursor-not-allowed"
                                : "border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/10"
                            )}
                          >
                            {isSaving ? "Processando..." : "Aprovar"}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <>
          {/* Filtros */}
          <div className={cx(card, "p-4")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-zinc-100">Usuários existentes</div>
                <div className="text-sm text-zinc-500">Edite role, vínculo de executivo, ativo e aprovação.</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por email/nome/role..."
                  className={cx(input, "w-[280px]")}
                />

                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={input}>
                  <option value="all">Todas roles</option>
                  {rolesDisponiveis.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <select
                  value={onlyApproved === "all" ? "all" : onlyApproved ? "true" : "false"}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === "all") setOnlyApproved("all")
                    else setOnlyApproved(v === "true")
                  }}
                  className={input}
                >
                  <option value="all">Aprovados e não aprovados</option>
                  <option value="true">Somente aprovados</option>
                  <option value="false">Somente não aprovados</option>
                </select>

                <button
                  onClick={carregarUsuarios}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/35 px-4 py-2.5 text-zinc-100 hover:bg-zinc-950/55"
                >
                  Recarregar usuários
                </button>
              </div>
            </div>
          </div>

          {/* Tabela usuários */}
          {usuariosFiltrados.length === 0 ? (
            <div className={cx(card, "px-5 py-8 text-zinc-400")}>Nenhum usuário encontrado com os filtros.</div>
          ) : (
            <div className={cx(card, "overflow-hidden")}>
              <div className="overflow-auto custom-scroll">
                <table className="min-w-full">
                  <thead className="bg-red-600 text-white sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">E-mail</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Executivo</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Ativo</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Aprovado</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.map((u) => {
                      const role = (roleSel[u.id] || (u.role || "user")).toLowerCase()
                      const precisaExec = role === "executivo"
                      const isSaving = savingId === u.id

                      return (
                        <tr key={u.id} className="border-t border-zinc-800 hover:bg-zinc-950/25 transition">
                          <td className="px-4 py-3 font-mono text-zinc-100">{u.id}</td>
                          <td className="px-4 py-3 text-zinc-200">{u.email}</td>

                          <td className="px-4 py-3">
                            <select
                              value={roleSel[u.id] || (u.role || "user")}
                              onChange={(e) => {
                                const v = e.target.value
                                setRoleSel((prev) => ({ ...prev, [u.id]: v }))
                                if (v !== "executivo") setExecSel((prev) => ({ ...prev, [u.id]: "" }))
                              }}
                              className={cx(input, "px-3 py-2 rounded-xl")}
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
                              value={execSel[u.id] ?? normStr(u.executivo_nome)}
                              onChange={(e) => setExecSel((prev) => ({ ...prev, [u.id]: e.target.value }))}
                              disabled={!precisaExec}
                              className={cx(
                                "rounded-xl border px-3 py-2",
                                precisaExec
                                  ? "border-zinc-800 bg-zinc-950/40 text-zinc-100"
                                  : "border-zinc-900 bg-zinc-950/20 text-zinc-500 cursor-not-allowed"
                              )}
                            >
                              <option value="">{precisaExec ? "Selecione..." : "—"}</option>
                              {executivos.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-4 py-3">
                            <button
                              onClick={() =>
                                setAtivoSel((prev) => ({ ...prev, [u.id]: !(prev[u.id] ?? (u.ativo ?? true)) }))
                              }
                              className={cx(
                                "px-3 py-2 rounded-xl border text-sm font-semibold transition",
                                (ativoSel[u.id] ?? (u.ativo ?? true))
                                  ? "border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10"
                                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-950/35"
                              )}
                              title="Alternar ativo"
                            >
                              {(ativoSel[u.id] ?? (u.ativo ?? true)) ? "Ativo" : "Inativo"}
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={cx(
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                                u.is_approved
                                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                                  : "border-amber-500/25 bg-amber-500/10 text-amber-200"
                              )}
                            >
                              {u.is_approved ? "Aprovado" : "Não aprovado"}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => salvar(u)}
                                disabled={isSaving}
                                className={cx(
                                  "px-3 py-2 rounded-xl border text-sm font-semibold transition",
                                  isSaving
                                    ? "border-zinc-800 text-zinc-500 cursor-not-allowed"
                                    : "border-red-500/40 text-red-100 hover:bg-red-500/10"
                                )}
                              >
                                {isSaving ? "Salvando..." : "Salvar"}
                              </button>

                              {u.is_approved ? (
                                <button
                                  onClick={() => revogarAprovacao(u)}
                                  disabled={isSaving}
                                  className={cx(
                                    "px-3 py-2 rounded-xl border text-sm font-semibold transition",
                                    isSaving
                                      ? "border-zinc-800 text-zinc-500 cursor-not-allowed"
                                      : "border-zinc-700 text-zinc-200 hover:bg-zinc-950/35"
                                  )}
                                >
                                  Revogar
                                </button>
                              ) : (
                                <button
                                  onClick={() => aprovar(u.id)}
                                  disabled={isSaving}
                                  className={cx(
                                    "px-3 py-2 rounded-xl border text-sm font-semibold transition",
                                    isSaving
                                      ? "border-zinc-800 text-zinc-500 cursor-not-allowed"
                                      : "border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/10"
                                  )}
                                >
                                  Aprovar
                                </button>
                              )}
                            </div>

                            {role === "executivo" && !normStr(execSel[u.id] ?? u.executivo_nome) ? (
                              <div className="mt-2 text-xs text-amber-200/90">
                                Para role <span className="font-semibold">executivo</span>, selecione um executivo.
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-zinc-800/80 bg-zinc-950/20 px-5 py-4">
                <div className="text-xs text-zinc-500">
                  Observação: esta tela assume os endpoints{" "}
                  <span className="font-mono text-zinc-300">GET /admin/users</span> e{" "}
                  <span className="font-mono text-zinc-300">POST /admin/users/:id/update</span>. Se sua API for diferente,
                  ajuste as rotas no topo.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
