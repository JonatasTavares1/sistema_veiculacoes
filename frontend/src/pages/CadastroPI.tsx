import { useEffect, useMemo, useState } from "react";

// 🔧 Ajuste essa constante conforme seu backend
const API_BASE = "http://localhost:8000";

export default function CadastroPI() {
  const [tipoPI, setTipoPI] = useState("Normal"); // "Matriz" | "Normal" | "CS" | "Abatimento"

  // Identificação
  const [numeroPI, setNumeroPI] = useState("");

  // Vinculações
  const [piMatrizOptions, setPiMatrizOptions] = useState([]); // [{value,label}]
  const [piNormalOptions, setPiNormalOptions] = useState([]);
  const [piMatrizSelecionado, setPiMatrizSelecionado] = useState("");
  const [piNormalSelecionado, setPiNormalSelecionado] = useState("");

  // Anunciante / Agência / Campanha
  const [anuncianteCNPJ, setAnuncianteCNPJ] = useState("");
  const [anuncianteNome, setAnuncianteNome] = useState("");
  const [agenciaCNPJ, setAgenciaCNPJ] = useState("");
  const [agenciaNome, setAgenciaNome] = useState("");
  const [nomeCampanha, setNomeCampanha] = useState("");

  // Datas
  const [dataVenda, setDataVenda] = useState(""); // YYYY-MM-DD
  const [dataEmissao, setDataEmissao] = useState("");
  const [vencimento, setVencimento] = useState("");

  // Valores
  const [valorBruto, setValorBruto] = useState("");
  const [valorLiquido, setValorLiquido] = useState("");

  // Observações
  const [observacoes, setObservacoes] = useState("");

  // Mensagens
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const precisaSelecionarMatriz = useMemo(() => tipoPI === "CS", [tipoPI]);
  const precisaSelecionarNormal = useMemo(() => tipoPI === "Abatimento", [tipoPI]);

  // Carrega listas condicionais
  useEffect(() => {
    async function carregarMatrizes() {
      try {
        const r = await fetch(`${API_BASE}/pis/matriz/ativos`); // ajuste a rota se necessário
        if (!r.ok) throw new Error("Falha ao carregar PIs Matriz");
        const data = await r.json();
        // Esperado: array de objetos com {numero_pi, nome_campanha}
        const opts = data.map((pi) => ({
          value: String(pi.numero_pi),
          label: pi.nome_campanha ? `${pi.numero_pi} — ${pi.nome_campanha}` : String(pi.numero_pi),
        }));
        setPiMatrizOptions(opts);
      } catch (e) {
        console.error(e);
        setPiMatrizOptions([]);
      }
    }

    async function carregarNormais() {
      try {
        const r = await fetch(`${API_BASE}/pis/normais/ativos`); // ajuste a rota se necessário
        if (!r.ok) throw new Error("Falha ao carregar PIs Normais");
        const data = await r.json();
        const opts = data.map((pi) => ({
          value: String(pi.numero_pi),
          label: pi.nome_campanha ? `${pi.numero_pi} — ${pi.nome_campanha}` : String(pi.numero_pi),
        }));
        setPiNormalOptions(opts);
      } catch (e) {
        console.error(e);
        setPiNormalOptions([]);
      }
    }

    if (precisaSelecionarMatriz) {
      carregarMatrizes();
      setPiNormalSelecionado("");
    } else if (precisaSelecionarNormal) {
      carregarNormais();
      setPiMatrizSelecionado("");
    } else {
      setPiMatrizSelecionado("");
      setPiNormalSelecionado("");
    }
  }, [precisaSelecionarMatriz, precisaSelecionarNormal]);

  function validarCampos() {
    setErro("");

    if (!numeroPI.trim()) return "Informe o número do PI.";

    if (precisaSelecionarMatriz && !piMatrizSelecionado)
      return "Selecione o PI Matriz para um PI do tipo CS.";

    if (precisaSelecionarNormal && !piNormalSelecionado)
      return "Selecione o PI Normal para um Abatimento.";

    if (!anuncianteCNPJ.trim() || !anuncianteNome.trim())
      return "Informe CNPJ e Razão Social do Anunciante.";

    if (!agenciaCNPJ.trim() || !agenciaNome.trim())
      return "Informe CNPJ e Razão Social da Agência.";

    if (!nomeCampanha.trim()) return "Informe o nome da campanha.";

    if (!dataVenda || !dataEmissao) return "Informe data da venda e data de emissão.";

    if (!valorBruto || isNaN(Number(valorBruto))) return "Informe o valor bruto (número).";

    if (!valorLiquido || isNaN(Number(valorLiquido))) return "Informe o valor líquido (número).";

    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setOk("");
    const msg = validarCampos();
    if (msg) {
      setErro(msg);
      return;
    }

    const payload = {
      numero_pi: numeroPI,
      tipo_pi: tipoPI, // "Matriz" | "Normal" | "CS" | "Abatimento"
      pi_matriz_vinculado: precisaSelecionarMatriz ? piMatrizSelecionado : null,
      pi_normal_vinculado: precisaSelecionarNormal ? piNormalSelecionado : null,
      anunciante_cnpj: anuncianteCNPJ,
      anunciante_nome: anuncianteNome,
      agencia_cnpj: agenciaCNPJ,
      agencia_nome: agenciaNome,
      nome_campanha: nomeCampanha,
      data_venda: dataVenda,
      data_emissao: dataEmissao,
      vencimento: vencimento || null,
      valor_bruto: Number(valorBruto),
      valor_liquido: Number(valorLiquido),
      observacoes,
    };

    try {
      setSalvando(true);
      const r = await fetch(`${API_BASE}/pis`, {
        method: "POST", // ajuste para a rota correta do seu controller
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "Erro ao salvar PI");
      }
      setOk("PI cadastrado com sucesso.");
      setErro("");
      // opcional: limpar formulário
      // resetForm();
    } catch (e) {
      console.error(e);
      setErro(e.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  function resetForm() {
    setNumeroPI("");
    setTipoPI("Normal");
    setPiMatrizSelecionado("");
    setPiNormalSelecionado("");
    setAnuncianteCNPJ("");
    setAnuncianteNome("");
    setAgenciaCNPJ("");
    setAgenciaNome("");
    setNomeCampanha("");
    setDataVenda("");
    setDataEmissao("");
    setVencimento("");
    setValorBruto("");
    setValorLiquido("");
    setObservacoes("");
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Cadastro de Pedido de Inserção</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Seção: Identificação */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Identificação</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Número do PI</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="Digite o número do PI"
                value={numeroPI}
                onChange={(e) => setNumeroPI(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Tipo de PI</label>
              <div className="flex flex-wrap gap-4">
                {["Matriz", "Normal", "CS", "Abatimento"].map((tipo) => (
                  <label key={tipo} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tipoPI"
                      value={tipo}
                      checked={tipoPI === tipo}
                      onChange={() => setTipoPI(tipo)}
                    />
                    {tipo}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Seção: Vinculação condicional */}
        {(precisaSelecionarMatriz || precisaSelecionarNormal) && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Vinculação</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {precisaSelecionarMatriz && (
                <div>
                  <label className="block font-medium mb-1">Vincular a PI Matriz (para CS)</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={piMatrizSelecionado}
                    onChange={(e) => setPiMatrizSelecionado(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {piMatrizOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {precisaSelecionarNormal && (
                <div>
                  <label className="block font-medium mb-1">Vincular a PI Normal (para Abatimento)</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={piNormalSelecionado}
                    onChange={(e) => setPiNormalSelecionado(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {piNormalOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Seção: Anunciante */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Anunciante</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">CNPJ</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="00.000.000/0000-00"
                value={anuncianteCNPJ}
                onChange={(e) => setAnuncianteCNPJ(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Razão Social</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="Nome do Anunciante"
                value={anuncianteNome}
                onChange={(e) => setAnuncianteNome(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Seção: Agência */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Agência</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">CNPJ</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="00.000.000/0000-00"
                value={agenciaCNPJ}
                onChange={(e) => setAgenciaCNPJ(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Razão Social</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="Nome da Agência"
                value={agenciaNome}
                onChange={(e) => setAgenciaNome(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Seção: Campanha */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Campanha</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block font-medium mb-1">Nome da Campanha</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="Ex.: Campanha Dia dos Pais"
                value={nomeCampanha}
                onChange={(e) => setNomeCampanha(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Seção: Datas */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Datas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium mb-1">Data da Venda</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={dataVenda}
                onChange={(e) => setDataVenda(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Data de Emissão</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Vencimento (opcional)</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Seção: Valores */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Valores</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Valor Bruto</label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded px-3 py-2"
                placeholder="0,00"
                value={valorBruto}
                onChange={(e) => setValorBruto(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Valor Líquido</label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded px-3 py-2"
                placeholder="0,00"
                value={valorLiquido}
                onChange={(e) => setValorLiquido(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Seção: Observações */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Observações</h2>
          <textarea
            className="w-full border rounded px-3 py-2 min-h-[100px]"
            placeholder="Observações adicionais..."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </section>

        {/* Mensagens */}
        {erro && <div className="text-red-600 font-medium">{erro}</div>}
        {ok && <div className="text-green-700 font-medium">{ok}</div>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="bg-blue-600 disabled:opacity-60 text-white font-semibold px-6 py-2 rounded hover:bg-blue-700 transition"
          >
            {salvando ? "Salvando..." : "Cadastrar PI"}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="border font-semibold px-6 py-2 rounded hover:bg-gray-50 transition"
          >
            Limpar
          </button>
        </div>
      </form>
    </div>
  );
}
