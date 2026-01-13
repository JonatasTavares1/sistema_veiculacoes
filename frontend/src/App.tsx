// src/App.tsx
import { Navigate, Route, Routes } from "react-router-dom"

import AppLayout from "./layouts/AppLayout"

import CadastroPI from "./pages/CadastroPI"
import Matrizes from "./pages/Matrizes"
import Executivos from "./pages/Executivos"
import Anunciantes from "./pages/Anunciantes"
import Agencias from "./pages/Agencias"
import PIs from "./pages/PIs"
import Produtos from "./pages/Produtos"
import Veiculacoes from "./pages/Veiculacoes"
import Entregas from "./pages/Entregas"

// ✅ NOVO: Vendas
import Vendas from "./pages/Vendas"

// ✅ faturamentos
import Faturamentos from "./pages/Faturamentos"

import Login from "./pages/Login"
import ProtectedRoute from "./routes/ProtectedRoute"

import Register from "./pages/Register"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import AdminUsers from "./pages/AdminUsers"

// ✅ NOVO: Meu Perfil
import MeuPerfilExecutivo from "./pages/MeuPerfilExecutivo"

function Home() {
  return <div className="p-6 text-2xl">Bem-vindo</div>
}

function NotFound() {
  return <div className="p-6 text-xl">Página não encontrada.</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/pis" replace />} />

      {/* Públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Register />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/reset-senha" element={<ResetPassword />} />

      {/* Protegidas */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<Home />} />

        {/* ✅ Meu Perfil (Executivo) */}
        <Route
          path="/meu-perfil"
          element={
            <ProtectedRoute requiredRole={["executivo", "admin"]}>
              <MeuPerfilExecutivo />
            </ProtectedRoute>
          }
        />

        <Route path="/entregas" element={<Entregas />} />
        <Route path="/veiculacoes" element={<Veiculacoes />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/pis" element={<PIs />} />
        <Route path="/pis/cadastro" element={<CadastroPI />} />
        <Route path="/matrizes" element={<Matrizes />} />
        <Route path="/executivos" element={<Executivos />} />
        <Route path="/anunciantes" element={<Anunciantes />} />
        <Route path="/agencias" element={<Agencias />} />

        {/* ✅ Vendas */}
        <Route path="/vendas" element={<Vendas />} />

        {/* ✅ Financeiro */}
        <Route
          path="/faturamentos"
          element={
            <ProtectedRoute requiredRole="financeiro">
              <Faturamentos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/usuarios"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUsers />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
