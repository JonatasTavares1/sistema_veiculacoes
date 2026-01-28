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

// ✅ Vendas (admin only)
import Vendas from "./pages/Vendas"

// ✅ Financeiro
import Faturamentos from "./pages/Faturamentos"

import Login from "./pages/Login"
import ProtectedRoute from "./routes/ProtectedRoute"

import Register from "./pages/Register"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import AdminUsers from "./pages/AdminUsers"

// ✅ Meu Perfil (Executivo)
import MeuPerfilExecutivo from "./pages/MeuPerfilExecutivo"
import { getUser } from "./services/auth"
import DetalhesPI from "./pages/DetalhesPI"
function Home() {
  const me = getUser()
  const role = (me?.role || "").toLowerCase()

  // Redirect por perfil (rota "home" não é conteúdo, só um hub)
  if (role === "admin") return <Navigate to="/admin/usuarios" replace />
  if (role === "financeiro") return <Navigate to="/faturamentos" replace />
  if (role === "opec") return <Navigate to="/faturamentos" replace />
  if (role === "executivo") return <Navigate to="/pis" replace />

  return <div className="p-6 text-2xl text-zinc-200">Bem-vindo</div>
}

function NotFound() {
  return <div className="p-6 text-xl text-zinc-200">Página não encontrada.</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />

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

        {/* =====================
            PERFIL (Executivo + Admin)
            ===================== */}
        <Route
          path="/meu-perfil"
          element={
            <ProtectedRoute requiredRole={["executivo", "admin"]}>
              <MeuPerfilExecutivo />
            </ProtectedRoute>
          }
        />

        {/* =====================
            VEICULAÇÕES + ENTREGAS
            Executivo + Opec + Admin
            ===================== */}
        <Route
          path="/veiculacoes"
          element={
            <ProtectedRoute requiredRole={["executivo", "opec", "admin"]}>
              <Veiculacoes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/entregas"
          element={
            <ProtectedRoute requiredRole={["executivo", "opec", "admin"]}>
              <Entregas />
            </ProtectedRoute>
          }
        />

        {/* =====================
            FINANCEIRO
            Financeiro + Opec + Admin
            ===================== */}
        <Route
          path="/faturamentos"
          element={
            <ProtectedRoute requiredRole={["financeiro", "opec", "admin"]}>
              <Faturamentos />
            </ProtectedRoute>
          }
        />

        {/* =====================
            PI
            Executivo + Admin
            ===================== */}
        <Route
          path="/pis"
          element={
            <ProtectedRoute requiredRole={["executivo", "admin"]}>
              <PIs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pis/cadastro"
          element={
            <ProtectedRoute requiredRole={["executivo", "admin"]}>
              <CadastroPI />
            </ProtectedRoute>
          }
        />

        {/* =====================
            MATRIZES
            Executivo + Admin
            (executivo deve ver só as vinculadas — isso é no backend)
            ===================== */}
        <Route
          path="/matrizes"
          element={
            <ProtectedRoute requiredRole={["executivo", "admin"]}>
              <Matrizes />
            </ProtectedRoute>
          }
        />

        {/* =====================
            PRODUTOS
            Executivo vê (somente leitura) + Admin
            (bloqueio de escrita é no backend + UI escondendo botões)
            ===================== */}
        <Route
          path="/produtos"
          element={
            <ProtectedRoute requiredRole={["executivo", "admin"]}>
              <Produtos />
            </ProtectedRoute>
          }
        />

        {/* =====================
            EXECUTIVOS
            Executivo vê (somente leitura) + Admin
            (busca detalhada/edição admin only no backend)
            ===================== */}
        <Route
          path="/executivos"
          element={
            <ProtectedRoute requiredRole={["executivo", "admin"]}>
              <Executivos />
            </ProtectedRoute>
          }
        />

        {/* =====================
            ADMIN ONLY
            ===================== */}
        <Route
          path="/admin/usuarios"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUsers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/anunciantes"
          element={
            <ProtectedRoute requiredRole="admin">
              <Anunciantes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/agencias"
          element={
            <ProtectedRoute requiredRole="admin">
              <Agencias />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vendas"
          element={
            <ProtectedRoute requiredRole="admin">
              <Vendas />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    <Route path="/pis/:id" element={<DetalhesPI />} />
    </Routes>
    
  )
}
