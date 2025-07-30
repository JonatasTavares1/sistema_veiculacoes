import customtkinter as ctk
from app.views.produto_view import ProdutoView
from app.views.pi_view import PIView
from app.views.veiculacao_view import VeiculacaoView
from app.views.consulta_veiculacao_view import ConsultaVeiculacaoView
from app.views.exportar_view import ExportarView
from app.views.entrega_view import EntregaView
from app.views.PIsCadastradosView import PIsCadastradosView
from app.views.vendasporexecutivo_view import ExecutivoView as VendasExecutivoView
from app.views.vendaspordiretoria_view import VendasDiretoriaView
from app.views.anunciante_view import AnuncianteView
from app.views.agencia_view import AgenciaView
from app.views.executivo_view import ExecutivoView
from app.views.PIMatrizView import PIMatrizView

class MainApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Sistema de Veiculações")
        self.geometry("900x600")
        ctk.set_appearance_mode("dark")
        self.configure(fg_color="black")  # fundo principal escuro

        # Sidebar com tema escuro (padrão)
        self.sidebar = ctk.CTkFrame(self, width=200, corner_radius=0)
        self.sidebar.pack(side="left", fill="y")

        # Container principal
        self.container = ctk.CTkFrame(self)
        self.container.pack(side="right", fill="both", expand=True)

        # Título da sidebar
        ctk.CTkLabel(
            self.sidebar,
            text="Menu",
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color="white"
        ).pack(pady=20)

        # Lista de botões e comandos
        botoes = [
            ("Produtos", self.mostrar_produto),
            ("PIs", self.mostrar_pi),
            ("Veiculações", self.mostrar_veiculacao),
            ("Consulta de Veiculações", self.mostrar_consulta),
            ("Exportar CSV", self.mostrar_exportar),
            ("Controle de Entregas", self.mostrar_entregas),
            ("PIs Cadastrados", self.mostrar_pis_cadastrados),
            ("Vendas por Executivo", self.mostrar_vendas_exec),
            ("Vendas por Diretoria", self.mostrar_vendas_diretoria),
            ("Cadastrar Anunciante", self.mostrar_anunciante),
            ("Cadastrar Agência", self.mostrar_agencia),
            ("Carteira De Executivos", self.mostrar_executivo_view),
            ("PIs Matriz", self.mostrar_pis_matriz)
        ]

        for texto, comando in botoes:
            ctk.CTkButton(
                self.sidebar,
                text=texto,
                command=comando,
                text_color="white",
                fg_color="#cc0000",       # vermelho
                hover_color="#990000",    # vermelho escuro ao passar o mouse
                corner_radius=6
            ).pack(pady=5, fill="x", padx=10)

        self.tela_atual = None
        self.mostrar_produto()

    def limpar_container(self):
        if self.tela_atual:
            self.tela_atual.destroy()
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

    def mostrar_entregas(self):
        self.limpar_container()
        self.tela_atual = EntregaView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_pis_cadastrados(self):
        self.limpar_container()
        self.tela_atual = PIsCadastradosView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_vendas_exec(self):
        self.limpar_container()
        self.tela_atual = VendasExecutivoView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_vendas_diretoria(self):
        self.limpar_container()
        self.tela_atual = VendasDiretoriaView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_anunciante(self):
        self.limpar_container()
        self.tela_atual = AnuncianteView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_agencia(self):
        self.limpar_container()
        self.tela_atual = AgenciaView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_executivo_view(self):
        self.limpar_container()
        self.tela_atual = ExecutivoView(self.container)
        self.tela_atual.pack(fill="both", expand=True)

    def mostrar_pis_matriz(self):
        self.limpar_container()
        self.tela_atual = PIMatrizView(self.container)
        self.tela_atual.pack(fill="both", expand=True)
