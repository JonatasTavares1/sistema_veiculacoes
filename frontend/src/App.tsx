import { Route, Routes } from "react-router-dom"
import AppLayout from "./layouts/AppLayout"
import CadastroPI from "./pages/CadastroPI"

// Telas placeholder — troque depois
function Home() { return <div className="p-6">Bem-vindo 👋</div> }
function PIs() { return <div className="p-6">Lista de PIs</div> }
function Matrizes() { return <div className="p-6">Matrizes & Saldos</div> }
function Veiculacoes() { return <div className="p-6">Veiculações</div> }
function Entregas() { return <div className="p-6">Entregas</div> }
function Produtos() { return <div className="p-6">Produtos</div> }
function Agencias() { return <div className="p-6">Agências</div> }
function Anunciantes() { return <div className="p-6">Anunciantes</div> }
function Executivos() { return <div className="p-6">Executivos</div> }
function NotFound() { return <div className="p-6">Página não encontrada.</div> }

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pis" element={<PIs />} />
        <Route path="/pis/cadastro" element={<CadastroPI />} />
        <Route path="/matrizes" element={<Matrizes />} />
        <Route path="/veiculacoes" element={<Veiculacoes />} />
        <Route path="/entregas" element={<Entregas />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/agencias" element={<Agencias />} />
        <Route path="/anunciantes" element={<Anunciantes />} />
        <Route path="/executivos" element={<Executivos />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  )
}
