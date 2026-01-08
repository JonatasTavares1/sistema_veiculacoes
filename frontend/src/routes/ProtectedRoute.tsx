// src/routes/ProtectedRoute.tsx
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

  if (requiredRole) {
    const user = getUser()
    const role = user?.role || ""

    if (!hasRole(role, requiredRole)) {
      return <Navigate to="/pis" replace />
    }
  }

  return <>{children}</>
}
