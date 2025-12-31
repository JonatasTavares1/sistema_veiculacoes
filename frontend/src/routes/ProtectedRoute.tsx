// src/routes/ProtectedRoute.tsx
import React from "react"
import { Navigate, useLocation } from "react-router-dom"
import { getUser, isAuthenticated } from "../services/auth"

export default function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode
  requiredRole?: string
}) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole) {
    const user = getUser()
    const role = (user?.role || "").toLowerCase()
    if (role !== requiredRole.toLowerCase()) {
      // se não tiver permissão, manda para uma rota segura
      return <Navigate to="/pis" replace />
    }
  }

  return <>{children}</>
}
