// src/App.tsx
import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";

import CadastroPI from "./pages/CadastroPI";
import Matrizes from "./pages/Matrizes";
import Executivos from "./pages/Executivos";
import Anunciantes from "./pages/Anunciantes";
import Agencias from "./pages/Agencias";
import PIs from "./pages/PIs";
import Produtos from "./pages/Produtos";
import Veiculacoes from "./pages/Veiculacoes";
import Entregas from "./pages/Entregas";

import Login from "./pages/Login";
import ProtectedRoute from "./routes/ProtectedRoute";

// novas páginas (crie esses arquivos depois; por enquanto pode deixar placeholders)
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminUsers from "./pages/AdminUsers";

function Home() {
  return <div className="p-6 text-2xl">Bem-vindo</div>;
}

function NotFound() {
  return <div className="p-6 text-xl">Página não encontrada.</div>;
}

export default function App() {
  return (
    <Routes>
      {/* Redirect inicial (opcional) */}
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

        <Route path="/entregas" element={<Entregas />} />
        <Route path="/veiculacoes" element={<Veiculacoes />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/pis" element={<PIs />} />
        <Route path="/pis/cadastro" element={<CadastroPI />} />
        <Route path="/matrizes" element={<Matrizes />} />
        <Route path="/executivos" element={<Executivos />} />
        <Route path="/anunciantes" element={<Anunciantes />} />
        <Route path="/agencias" element={<Agencias />} />

        {/* Admin (proteção por role será feita no ProtectedRoute) */}
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

      {/* Fallback final */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
