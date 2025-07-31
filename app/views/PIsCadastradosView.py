import customtkinter as ctk
from controllers.pi_controller import listar_pis
import pandas as pd
from tkinter import filedialog


class PIsCadastradosView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        ctk.CTkLabel(self, text="📄 PIs Cadastrados", font=ctk.CTkFont(size=22, weight="bold")).pack(pady=15)
        ctk.CTkLabel(self, text="Lista completa dos pedidos de inserção registrados no sistema:",
                     font=ctk.CTkFont(size=16)).pack(pady=5)

        # 🔎 Campo de busca + filtros adicionais
        filtros_frame = ctk.CTkFrame(self)
        filtros_frame.pack(pady=5)

        self.entrada_busca = ctk.CTkEntry(filtros_frame, placeholder_text="Buscar por PI, cliente, agência ou CNPJ", width=350)
        self.entrada_busca.grid(row=0, column=0, padx=(0, 10))

        self.combo_tipo = ctk.CTkComboBox(filtros_frame, values=["Todos", "Matriz", "CS", "Normal"])
        self.combo_tipo.set("Todos")
        self.combo_tipo.grid(row=0, column=1, padx=5)

        self.combo_diretoria = ctk.CTkComboBox(filtros_frame, values=["Todos", "Governo Federal", "Governo Estadual", "Rafael Augusto"])
        self.combo_diretoria.set("Todos")
        self.combo_diretoria.grid(row=0, column=2, padx=5)

        self.combo_executivo = ctk.CTkComboBox(filtros_frame, values=[
            "Todos", "Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio", "Flavio de Paula",
            "Lorena Fernandes", "Henri Marques", "Caio Bruno", "Flavia Cabral", "Paula Caroline",
            "Leila Santos", "Jessica Ribeiro", "Paula Campos"
        ])
        self.combo_executivo.set("Todos")
        self.combo_executivo.grid(row=0, column=3, padx=5)

        botao_buscar = ctk.CTkButton(filtros_frame, text="🔍 Buscar", command=self.buscar_pis)
        botao_buscar.grid(row=0, column=4, padx=(10, 0))

        # Botões
        ctk.CTkButton(self, text="🔄 Atualizar Lista", command=self.atualizar_lista).pack(pady=5)
        ctk.CTkButton(self, text="📤 Exportar XLS", command=self.exportar_para_excel).pack(pady=5)

        # Scroll da tabela
        self.tabela_scroll = ctk.CTkScrollableFrame(self, width=1600, height=500, orientation="horizontal", corner_radius=8)
        self.tabela_scroll.pack(pady=15, padx=10, fill="both", expand=True)

        self.headers = [
            "ID", "PI", "Tipo de PI", "PI Matriz", "Cliente", "Agência", "Data de Emissão",
            "Valor Total (R$)", "Valor Líquido (R$)", "Praça", "Meio", "Campanha", "Diretoria",
            "Executivo", "Data da Venda"
        ]
        header_font = ctk.CTkFont(size=15, weight="bold")

        for col, header in enumerate(self.headers):
            label = ctk.CTkLabel(self.tabela_scroll, text=header, font=header_font, anchor="w", padx=8)
            label.grid(row=0, column=col * 2, sticky="nsew", pady=(0, 8), padx=(4, 2))
            self.tabela_scroll.grid_columnconfigure(col * 2, weight=1)

            if col < len(self.headers) - 1:
                separator = ctk.CTkFrame(self.tabela_scroll, width=2, height=30, fg_color="#444")
                separator.grid(row=0, column=col * 2 + 1, sticky="ns", padx=0, pady=(0, 8))

        self.linhas_pi = []
        self.lista_exibida = []
        self.atualizar_lista()

    def atualizar_lista(self):
        self.lista_exibida = listar_pis()
        self.mostrar_pis(self.lista_exibida)

    def buscar_pis(self):
        termo = self.entrada_busca.get().lower()
        tipo_pi = self.combo_tipo.get()
        diretoria = self.combo_diretoria.get()
        executivo = self.combo_executivo.get()

        resultados = []
        for pi in listar_pis():
            if (
                (termo in str(pi.numero_pi).lower()
                 or termo in (pi.nome_anunciante or "").lower()
                 or termo in (pi.nome_agencia or "").lower()
                 or termo in (pi.cnpj_agencia or "").lower())
                and (tipo_pi == "Todos" or pi.tipo_pi == tipo_pi)
                and (diretoria == "Todos" or pi.diretoria == diretoria)
                and (executivo == "Todos" or pi.executivo == executivo)
            ):
                resultados.append(pi)

        self.lista_exibida = resultados
        self.mostrar_pis(resultados)

    def mostrar_pis(self, lista_pis):
        for linha in self.linhas_pi:
            for widget in linha:
                widget.destroy()
        self.linhas_pi.clear()

        for i, pi in enumerate(lista_pis, start=1):
            linha_widgets = []
            valores = [
                pi.id,
                pi.numero_pi,
                pi.tipo_pi,
                pi.numero_pi_matriz if pi.tipo_pi == "CS" else "",
                pi.nome_anunciante,
                pi.nome_agencia or "",
                pi.data_emissao.strftime("%d/%m/%Y") if pi.data_emissao else "",
                f"{pi.valor_bruto:.2f}".replace('.', ',') if pi.valor_bruto else "0,00",
                f"{pi.valor_liquido:.2f}".replace('.', ',') if pi.valor_liquido else "0,00",
                pi.uf_cliente or "",
                pi.canal or "",
                pi.nome_campanha or "",
                pi.diretoria or "",
                pi.executivo or "",
                f"{pi.dia_venda}/{pi.mes_venda}" if pi.dia_venda and pi.mes_venda else ""
            ]
            for j, valor in enumerate(valores):
                cell = ctk.CTkLabel(self.tabela_scroll, text=str(valor), anchor="w", padx=8)
                cell.grid(row=i, column=j * 2, sticky="nsew", pady=4, padx=(4, 2))
                linha_widgets.append(cell)

                if j < len(valores) - 1:
                    separator = ctk.CTkFrame(self.tabela_scroll, width=2, height=30, fg_color="#333")
                    separator.grid(row=i, column=j * 2 + 1, sticky="ns", padx=0)
                    linha_widgets.append(separator)

            self.linhas_pi.append(linha_widgets)

    def exportar_para_excel(self):
        if not self.lista_exibida:
            return

        dados = []
        for pi in self.lista_exibida:
            dados.append({
                "ID": pi.id,
                "PI": pi.numero_pi,
                "Tipo de PI": pi.tipo_pi,
                "PI Matriz": pi.numero_pi_matriz if pi.tipo_pi == "CS" else "",
                "Cliente": pi.nome_anunciante,
                "Agência": pi.nome_agencia,
                "CNPJ Agência": pi.cnpj_agencia,
                "Data de Emissão": pi.data_emissao.strftime("%d/%m/%Y") if pi.data_emissao else "",
                "Valor Bruto (R$)": f"{pi.valor_bruto:.2f}".replace('.', ',') if pi.valor_bruto else "0,00",
                "Valor Líquido (R$)": f"{pi.valor_liquido:.2f}".replace('.', ',') if pi.valor_liquido else "0,00",
                "Praça": pi.uf_cliente or "",
                "Canal": pi.canal or "",
                "Campanha": pi.nome_campanha or "",
                "Diretoria": pi.diretoria or "",
                "Executivo": pi.executivo or "",
                "Data da Venda": f"{pi.dia_venda}/{pi.mes_venda}" if pi.dia_venda and pi.mes_venda else "",
                "Observações": getattr(pi, "observacoes", "")
            })

        df = pd.DataFrame(dados)
        caminho = filedialog.asksaveasfilename(defaultextension=".xlsx", filetypes=[("Planilha Excel", "*.xlsx")])
        if caminho:
            df.to_excel(caminho, index=False)
