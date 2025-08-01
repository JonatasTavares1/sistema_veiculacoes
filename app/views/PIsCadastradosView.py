import customtkinter as ctk
from controllers.pi_controller import listar_pis
import pandas as pd
from tkinter import filedialog, messagebox
import tkinter as tk  # necessário para Canvas e Scrollbar
from datetime import datetime


class PIsCadastradosView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        ctk.CTkLabel(self, text="📄 PIs Cadastrados", font=ctk.CTkFont(size=22, weight="bold")).pack(pady=15)
        ctk.CTkLabel(self, text="Lista completa dos pedidos de inserção registrados no sistema:",
                     font=ctk.CTkFont(size=16)).pack(pady=5)

        # 🔎 Filtros
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

        # Botões principais
        ctk.CTkButton(self, text="🔄 Atualizar Lista", command=self.atualizar_lista).pack(pady=5)
        ctk.CTkButton(self, text="📤 Exportar XLS", command=self.exportar_para_excel).pack(pady=5)

        # Container com rolagem dupla
        container = ctk.CTkFrame(self)
        container.pack(fill="both", expand=True, padx=10, pady=15)

        self.canvas = tk.Canvas(container, bg="#1a1a1a", highlightthickness=0)
        self.canvas.pack(side="left", fill="both", expand=True)

        scrollbar_y = tk.Scrollbar(container, orient="vertical", command=self.canvas.yview)
        scrollbar_y.pack(side="right", fill="y")

        scrollbar_x = tk.Scrollbar(self, orient="horizontal", command=self.canvas.xview)
        scrollbar_x.pack(fill="x")

        self.canvas.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)

        self.tabela_scroll = ctk.CTkFrame(self.canvas)
        self.tabela_scroll.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.create_window((0, 0), window=self.tabela_scroll, anchor="nw")

        # Cabeçalhos (inclui coluna Editar)
        self.headers = [
            "ID", "PI", "Tipo de PI", "PI Matriz", "Cliente", "Agência", "Data de Emissão",
            "Valor Total (R$)", "Valor Líquido (R$)", "Praça", "Meio", "Campanha", "Diretoria",
            "Executivo", "Data da Venda", "Editar"
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
        # Limpa linhas anteriores
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

            # células de dados
            for j, valor in enumerate(valores):
                cell = ctk.CTkLabel(self.tabela_scroll, text=str(valor), anchor="w", padx=8)
                cell.grid(row=i, column=j * 2, sticky="nsew", pady=4, padx=(4, 2))
                linha_widgets.append(cell)

                # separadores
                separator = ctk.CTkFrame(self.tabela_scroll, width=2, height=30, fg_color="#333")
                separator.grid(row=i, column=j * 2 + 1, sticky="ns", padx=0)
                linha_widgets.append(separator)

            # botão Editar (última coluna)
            btn = ctk.CTkButton(self.tabela_scroll, text="✏️ Editar", width=90,
                                command=lambda p=pi: self.abrir_modal_edicao(p))
            btn.grid(row=i, column=len(valores) * 2, sticky="nsew", pady=4, padx=(4, 2))
            linha_widgets.append(btn)

            # separador após o botão
            if True:
                separator = ctk.CTkFrame(self.tabela_scroll, width=2, height=30, fg_color="#333")
                separator.grid(row=i, column=len(valores) * 2 + 1, sticky="ns", padx=0)
                linha_widgets.append(separator)

            self.linhas_pi.append(linha_widgets)

    def abrir_modal_edicao(self, pi):
        """Abre janela modal para editar campos do PI."""
        modal = ctk.CTkToplevel(self)
        modal.title(f"Editar PI #{pi.numero_pi}")
        modal.geometry("700x700")
        modal.grab_set()

        scroll = ctk.CTkScrollableFrame(modal, width=660, height=620)
        scroll.pack(padx=10, pady=10, fill="both", expand=True)

        def label_input(texto):
            ctk.CTkLabel(scroll, text=texto, anchor="w").pack(pady=(10, 0), padx=14, fill="x")

        def entry_inicial(valor=""):
            e = ctk.CTkEntry(scroll, height=35, font=ctk.CTkFont(size=14))
            e.pack(pady=(0, 6), padx=14, fill="x")
            if valor is not None:
                e.insert(0, str(valor))
            return e

        def combo_inicial(values, valor=None):
            ctk.CTkLabel(scroll, text="", anchor="w")  # apenas para manter espaçamento uniforme
            cb = ctk.CTkComboBox(scroll, values=values, height=35, font=ctk.CTkFont(size=14))
            cb.set(valor if valor in values else (valor or "Selecione"))
            cb.pack(pady=(0, 6), padx=14, fill="x")
            return cb

        # Campos editáveis
        label_input("Número do PI")
        numero_pi_e = entry_inicial(pi.numero_pi)

        label_input("Tipo de PI")
        tipo_pi_cb = ctk.CTkComboBox(scroll, values=["Matriz", "CS", "Normal"], height=35, font=ctk.CTkFont(size=14))
        tipo_pi_cb.set(pi.tipo_pi or "Normal")
        tipo_pi_cb.pack(pady=(0, 6), padx=14, fill="x")

        label_input("PI Matriz (preencher somente se CS)")
        numero_pi_matriz_e = entry_inicial(pi.numero_pi_matriz if getattr(pi, "tipo_pi", "") == "CS" else "")

        label_input("Cliente (Nome do Anunciante)")
        nome_anunciante_e = entry_inicial(pi.nome_anunciante)

        label_input("Agência")
        nome_agencia_e = entry_inicial(pi.nome_agencia or "")

        label_input("Data de Emissão (dd/mm/aaaa)")
        data_emissao_e = entry_inicial(pi.data_emissao.strftime("%d/%m/%Y") if pi.data_emissao else "")

        label_input("Valor Bruto (R$)")
        valor_bruto_e = entry_inicial(f"{pi.valor_bruto:.2f}".replace('.', ',') if pi.valor_bruto else "")

        label_input("Valor Líquido (R$)")
        valor_liquido_e = entry_inicial(f"{pi.valor_liquido:.2f}".replace('.', ',') if pi.valor_liquido else "")

        label_input("Praça (UF do Cliente)")
        uf_cliente_e = entry_inicial(pi.uf_cliente or "")

        label_input("Meio (Canal)")
        canal_e = entry_inicial(pi.canal or "")

        label_input("Campanha")
        nome_campanha_e = entry_inicial(pi.nome_campanha or "")

        label_input("Diretoria")
        diretoria_cb = ctk.CTkComboBox(scroll, values=["Governo Federal", "Governo Estadual", "Rafael Augusto"],
                                       height=35, font=ctk.CTkFont(size=14))
        diretoria_cb.set(pi.diretoria or "Governo Federal")
        diretoria_cb.pack(pady=(0, 6), padx=14, fill="x")

        label_input("Executivo")
        executivo_cb = ctk.CTkComboBox(scroll, values=[
            "Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio", "Flavio de Paula",
            "Lorena Fernandes", "Henri Marques", "Caio Bruno", "Flavia Cabral", "Paula Caroline",
            "Leila Santos", "Jessica Ribeiro", "Paula Campos"
        ], height=35, font=ctk.CTkFont(size=14))
        executivo_cb.set(pi.executivo or "Rafale e Francio")
        executivo_cb.pack(pady=(0, 6), padx=14, fill="x")

        label_input("Data da Venda (dia/mes_ano) — preencha os dois abaixo")
        label_input("Dia da Venda (ex: 23)")
        dia_venda_e = entry_inicial(pi.dia_venda or "")
        label_input("Mês/Ano da Venda (ex: 07/2025)")
        mes_venda_e = entry_inicial(pi.mes_venda or "")

        label_input("Observações")
        observacoes_e = entry_inicial(getattr(pi, "observacoes", ""))

        def salvar():
            # Validações leves + conversões
            try:
                data_emissao_val = None
                if data_emissao_e.get().strip():
                    data_emissao_val = datetime.strptime(data_emissao_e.get().strip(), "%d/%m/%Y").date()

                valor_bruto_val = None
                if valor_bruto_e.get().strip():
                    valor_bruto_val = float(valor_bruto_e.get().replace(",", ".").strip())

                valor_liquido_val = None
                if valor_liquido_e.get().strip():
                    valor_liquido_val = float(valor_liquido_e.get().replace(",", ".").strip())

                # tentativa de atualizar via controller
                try:
                    from controllers.pi_controller import atualizar_pi
                except Exception:
                    atualizar_pi = None

                if atualizar_pi is None:
                    messagebox.showwarning(
                        "Recurso indisponível",
                        "A função 'atualizar_pi' não foi encontrada em controllers.pi_controller.\n"
                        "Implemente-a para persistir as edições."
                    )
                    return

                # Monta payload de atualização (ajuste os nomes conforme seu modelo/controller)
                payload = {
                    "numero_pi": numero_pi_e.get().strip(),
                    "tipo_pi": tipo_pi_cb.get().strip(),
                    "numero_pi_matriz": numero_pi_matriz_e.get().strip() or None,
                    "nome_anunciante": nome_anunciante_e.get().strip(),
                    "nome_agencia": nome_agencia_e.get().strip() or None,
                    "data_emissao": data_emissao_val,
                    "valor_bruto": valor_bruto_val,
                    "valor_liquido": valor_liquido_val,
                    "uf_cliente": uf_cliente_e.get().strip() or None,
                    "canal": canal_e.get().strip() or None,
                    "nome_campanha": nome_campanha_e.get().strip() or None,
                    "diretoria": diretoria_cb.get().strip() or None,
                    "executivo": executivo_cb.get().strip() or None,
                    "dia_venda": dia_venda_e.get().strip() or None,
                    "mes_venda": mes_venda_e.get().strip() or None,
                    "observacoes": observacoes_e.get().strip() or None,
                }

                # Chama o update
                atualizar_pi(pi.id, **payload)
                messagebox.showinfo("Sucesso", "PI atualizado com sucesso!")
                modal.destroy()
                self.atualizar_lista()

            except Exception as e:
                messagebox.showerror("Erro", f"Não foi possível salvar as alterações:\n{e}")

        botoes_frame = ctk.CTkFrame(modal)
        botoes_frame.pack(pady=(0, 12))

        ctk.CTkButton(botoes_frame, text="💾 Salvar", command=salvar).pack(side="left", padx=8)
        ctk.CTkButton(botoes_frame, text="✖ Fechar", fg_color="#444", hover_color="#333", command=modal.destroy).pack(side="left", padx=8)

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
                "CNPJ Agência": getattr(pi, "cnpj_agencia", ""),
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
