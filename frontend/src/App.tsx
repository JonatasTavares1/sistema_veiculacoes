// src/App.tsx
import { Route, Routes } from "react-router-dom";
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

function Home() {
  return <div className="p-6 text-2xl">Bem-vindo</div>;
}

function NotFound() {
  return <div className="p-6 text-xl">Página não encontrada.</div>;
}

export default function App() {
  return (
    <Routes>
      {/* Pública */}
      <Route path="/Login" element={<Login />} />

      {/* Protegida */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/entregas" element={<Entregas />} />
                <Route path="/veiculacoes" element={<Veiculacoes />} />
                <Route path="/produtos" element={<Produtos />} />
                <Route path="/pis" element={<PIs />} />
                <Route path="/" element={<Home />} />
                <Route path="/pis/cadastro" element={<CadastroPI />} />
                <Route path="/matrizes" element={<Matrizes />} />
                <Route path="/executivos" element={<Executivos />} />
                <Route path="/anunciantes" element={<Anunciantes />} />
                <Route path="/agencias" element={<Agencias />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}