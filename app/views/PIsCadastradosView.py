import customtkinter as ctk
from controllers.pi_controller import listar_pis


class PIsCadastradosView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        # Título
        ctk.CTkLabel(self, text="📄 PIs Cadastrados", font=ctk.CTkFont(size=22, weight="bold")).pack(pady=15)
        ctk.CTkLabel(self, text="Lista completa dos pedidos de inserção registrados no sistema:",
                     font=ctk.CTkFont(size=16)).pack(pady=5)

        # 🔎 Campo de busca + botão
        busca_frame = ctk.CTkFrame(self)
        busca_frame.pack(pady=5)

        self.entrada_busca = ctk.CTkEntry(busca_frame, placeholder_text="Buscar por número do PI ou cliente", width=300)
        self.entrada_busca.pack(side="left", padx=(0, 10))

        botao_buscar = ctk.CTkButton(busca_frame, text="🔍 Buscar", command=self.buscar_pis)
        botao_buscar.pack(side="left")

        # 🔄 Botão de Atualizar
        self.atualizar_btn = ctk.CTkButton(self, text="🔄 Atualizar Lista", command=self.atualizar_lista)
        self.atualizar_btn.pack(pady=5)

        # Tabela
        self.tabela_frame = ctk.CTkScrollableFrame(self, width=1400, height=500, corner_radius=8)
        self.tabela_frame.pack(pady=15, padx=10, fill="both", expand=True)

        # Cabeçalhos
        self.headers = [
            "ID", "PI", "Cliente", "Data de Emissão", "Valor Total (R$)", "Valor Líquido (R$)", 
            "Praça", "Meio", "Colocação", "Diretoria", "Executivo",
            "Data da Venda", "Produto"
        ]
        header_font = ctk.CTkFont(size=15, weight="bold")

        for col, header in enumerate(self.headers):
            header_label = ctk.CTkLabel(
                self.tabela_frame,
                text=header,
                font=header_font,
                anchor="w",
                padx=8
            )
            header_label.grid(row=0, column=col * 2, sticky="nsew", pady=(0, 8), padx=(4, 2))
            self.tabela_frame.grid_columnconfigure(col * 2, weight=1)

            if col < len(self.headers) - 1:
                separator = ctk.CTkFrame(self.tabela_frame, width=2, height=30, fg_color="#444")
                separator.grid(row=0, column=col * 2 + 1, sticky="ns", padx=0, pady=(0, 8))

        # Inicializa lista
        self.linhas_pi = []
        self.atualizar_lista()

    def atualizar_lista(self):
        self.mostrar_pis(listar_pis())

    def buscar_pis(self):
        termo = self.entrada_busca.get().lower()
        resultados = []
        for pi in listar_pis():
            if termo in str(pi.numero_pi).lower() or termo in str(pi.nome_anunciante).lower():
                resultados.append(pi)
        self.mostrar_pis(resultados)

    def mostrar_pis(self, lista_pis):
        # Limpa as linhas existentes
        for linha in self.linhas_pi:
            for widget in linha:
                widget.destroy()
        self.linhas_pi.clear()

        for i, pi in enumerate(lista_pis, start=1):
            linha_widgets = []
            valores = [
                pi.id,
                pi.numero_pi,
                pi.nome_anunciante,
                pi.data_emissao.strftime("%d/%m/%Y") if pi.data_emissao else "",
                f"{pi.valor_bruto:.2f}".replace('.', ',') if pi.valor_bruto else "0,00",
                f"{pi.valor_liquido:.2f}".replace('.', ',') if pi.valor_liquido else "0,00",
                pi.uf_cliente or "",
                pi.canal or "",
                pi.nome_campanha or "",
                pi.diretoria or "",
                pi.executivo or "",
                f"{pi.dia_venda}/{pi.mes_venda}" if pi.dia_venda and pi.mes_venda else "",
            ]
            for j, valor in enumerate(valores):
                cell = ctk.CTkLabel(
                    self.tabela_frame,
                    text=str(valor),
                    anchor="w",
                    padx=8
                )
                cell.grid(row=i, column=j * 2, sticky="nsew", pady=4, padx=(4, 2))
                linha_widgets.append(cell)

                if j < len(valores) - 1:
                    separator = ctk.CTkFrame(self.tabela_frame, width=2, height=30, fg_color="#333")
                    separator.grid(row=i, column=j * 2 + 1, sticky="ns", padx=0)
                    linha_widgets.append(separator)

            self.linhas_pi.append(linha_widgets)
