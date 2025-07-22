import customtkinter as ctk
from app.views.produto_view import ProdutoView
from app.views.pi_view import PIView
from app.views.veiculacao_view import VeiculacaoView
from app.views.consulta_veiculacao_view import ConsultaVeiculacaoView
from app.views.exportar_view import ExportarView
from app.views.entrega_view import EntregaView  # ⬅️ Importa nova view
from app.views.PIsCadastradosView import PIsCadastradosView
from app.views.executivo_view import ExecutivoView  # Importando a tela de Vendas por Executivo
from app.views.diretoria_view import DiretoriaView  # Importando a tela de Vendas por Diretoria


class MainApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Sistema de Veiculações")
        self.geometry("900x600")
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.sidebar = ctk.CTkFrame(self, width=200, corner_radius=0)
        self.sidebar.pack(side="left", fill="y")

        self.container = ctk.CTkFrame(self)
        self.container.pack(side="right", fill="both", expand=True)

        ctk.CTkLabel(self.sidebar, text="Menu", font=ctk.CTkFont(size=18, weight="bold")).pack(pady=20)

        ctk.CTkButton(self.sidebar, text="Produtos", command=self.mostrar_produto).pack(pady=5, fill="x", padx=10)
        ctk.CTkButton(self.sidebar, text="PIs", command=self.mostrar_pi).pack(pady=5, fill="x", padx=10)
        ctk.CTkButton(self.sidebar, text="Veiculações", command=self.mostrar_veiculacao).pack(pady=5, fill="x", padx=10)
        ctk.CTkButton(self.sidebar, text="Consulta", command=self.mostrar_consulta).pack(pady=5, fill="x", padx=10)
        ctk.CTkButton(self.sidebar, text="Exportar CSV", command=self.mostrar_exportar).pack(pady=5, fill="x", padx=10)
        ctk.CTkButton(self.sidebar, text="Controle de Entregas", command=self.mostrar_entregas).pack(pady=5, fill="x", padx=10)  # ⬅️ Novo botão
        ctk.CTkButton(self.sidebar, text="PIs Cadastrados", command=self.mostrar_pis_cadastrados).pack(pady=5, fill="x", padx=10)
        ctk.CTkButton(self.sidebar, text="Vendas por Executivo", command=self.mostrar_vendas_exec).pack(pady=5, fill="x", padx=10)
        ctk.CTkButton(self.sidebar, text="Vendas por Diretoria", command=self.mostrar_vendas_diretoria).pack(pady=5, fill="x", padx=10)


        # Inicializa a tela atual como None
        self.tela_atual = None
        self.mostrar_produto()  # Exibe a primeira tela ao iniciar a aplicação

    def mostrar_pis_cadastrados(self):
        self.limpar_container()
        self.tela_atual = PIsCadastradosView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_entregas(self):
        self.limpar_container()
        self.tela_atual = EntregaView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def limpar_container(self):
        if self.tela_atual:
            self.tela_atual.destroy()  # Limpa a tela atual
            self.tela_atual = None

    def mostrar_produto(self):
        self.limpar_container()
        self.tela_atual = ProdutoView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_pi(self):
        self.limpar_container()
        self.tela_atual = PIView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_veiculacao(self):
        self.limpar_container()
        self.tela_atual = VeiculacaoView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_consulta(self):
        self.limpar_container()
        self.tela_atual = ConsultaVeiculacaoView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_exportar(self):
        self.limpar_container()
        self.tela_atual = ExportarView(self.container)
        self.tela_atual.pack(fill="both", expand=True)


    # Função para mostrar a tela de Vendas por Executivo
    def mostrar_vendas_exec(self):
        self.limpar_container()
        self.tela_atual = ExecutivoView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    # Função para mostrar a tela de Vendas por Diretoria
    def mostrar_vendas_diretoria(self):
        self.limpar_container()
        self.tela_atual = DiretoriaView(self.container)
        self.tela_atual.pack(fill="both", expand=True)