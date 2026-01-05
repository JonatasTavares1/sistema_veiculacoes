// src/pages/AdminUsers.tsx
import { useEffect, useState } from "react"
import { getUser } from "../services/auth"
import { apiGet, apiPost } from "../services/api"

type PendingUser = {
  id: number
  email: string
  role: string
  is_approved: boolean
}

export default function AdminUsers() {
  const [lista, setLista] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const me = getUser()

  async function carregar() {
    setLoading(true)
    setErro(null)

    try {
      const data = await apiGet<PendingUser[]>(`/admin/users/pending`)
      setLista(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }

  async function aprovar(userId: number) {
    if (!confirm("Aprovar este usuário?")) return

    try {
      await apiPost(`/admin/users/${userId}/approve`, { role: "user" })
      alert("Usuário aprovado. O e-mail de confirmação foi enviado (ou simulado no console).")
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
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          Acesso restrito ao administrador.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-slate-900">Usuários pendentes</h1>
        <button
          onClick={carregar}
          className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-slate-600">Carregando...</div>
      ) : erro ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">{erro}</div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-slate-600">
          Nenhum usuário pendente.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full">
            <thead className="bg-red-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">E-mail</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3 font-mono">{u.id}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => aprovar(u.id)}
                      className="px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                      Aprovar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
