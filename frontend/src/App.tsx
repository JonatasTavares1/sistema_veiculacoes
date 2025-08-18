// src/App.tsx
import { Route, Routes } from "react-router-dom"
import AppLayout from "./layouts/AppLayout"
import CadastroPI from "./pages/CadastroPI"
import Matrizes from "./pages/Matrizes"
import Executivos from "./pages/Executivos"
import Anunciantes from "./pages/Anunciantes"
import Agencias from "./pages/Agencias"
import PIs from "./pages/PIs"   
function Home() {
  return <div className="p-6 text-2xl">Bem-vindo 👋</div>
}

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/pis" element={<PIs />} />
        <Route path="/" element={<Home />} />
        <Route path="/pis/cadastro" element={<CadastroPI />} />
        <Route path="/matrizes" element={<Matrizes />} />
        <Route path="/executivos" element={<Executivos />} />
        <Route path="/anunciantes" element={<Anunciantes />} />
        <Route path="/agencias" element={<Agencias />} />
        <Route path="*" element={<div className="p-6 text-xl">Página não encontrada.</div>} />
      </Routes>
    </AppLayout>
  )
}
