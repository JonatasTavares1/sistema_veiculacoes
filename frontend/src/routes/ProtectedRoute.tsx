import React from "react"
import { Navigate, useLocation } from "react-router-dom"
import { getUser, isAuthenticated } from "../services/auth"

type RoleLike = string | string[]

function norm(v?: string | null) {
  return (v || "").toLowerCase().trim()
}

function hasRole(userRole: string, required?: RoleLike) {
  if (!required) return true

  const r = norm(userRole)

  // ✅ admin sempre pode tudo
  if (r === "admin") return true

  if (Array.isArray(required)) {
    return required.map(norm).includes(r)
  }

  return r === norm(required)
}

function getDefaultDeniedRedirect(role?: string) {
  const r = norm(role)

  // Ajuste fino: cada role cai numa "home" natural
  if (r === "executivo") return "/meu-perfil" // quando criarmos
  if (r === "financeiro") return "/faturamentos"
  return "/pis"
}

export default function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode
  requiredRole?: RoleLike
}) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const user = getUser()
  const role = user?.role || ""

  if (requiredRole && !hasRole(role, requiredRole)) {
    return <Navigate to={getDefaultDeniedRedirect(role)} replace />
  }

  return <>{children}</>
}
