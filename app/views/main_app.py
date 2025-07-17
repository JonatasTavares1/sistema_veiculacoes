import customtkinter as ctk
from app.views.produto_view import ProdutoView
from app.views.pi_view import PIView
from app.views.veiculacao_view import VeiculacaoView
from app.views.consulta_veiculacao_view import ConsultaVeiculacaoView
from app.views.exportar_view import ExportarView

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
