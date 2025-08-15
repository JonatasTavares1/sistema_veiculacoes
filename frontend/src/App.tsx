import { Route, Routes } from "react-router-dom"
import AppLayout from "./layouts/AppLayout"
import CadastroPI from "./pages/CadastroPI"
import Matrizes from "./pages/Matrizes"

function Home() { return <div className="p-6">Bem-vindo 👋</div> }

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pis/cadastro" element={<CadastroPI />} />
        <Route path="/matrizes" element={<Matrizes />} />
        <Route path="*" element={<div className="p-6">Página não encontrada.</div>} />
      </Routes>
    </AppLayout>
  )
}
