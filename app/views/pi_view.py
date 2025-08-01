import customtkinter as ctk
from tkinter import messagebox
from controllers.pi_controller import criar_pi, listar_pis_matriz_ativos, calcular_saldo_restante
from controllers.anunciante_controller import buscar_anunciante_por_cnpj
from controllers.agencia_controller import buscar_agencia_por_cnpj
from datetime import datetime


class PIView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        # ========= ESTILO =========
        self.font_titulo_pagina = ctk.CTkFont(size=22, weight="bold")
        self.font_secao = ctk.CTkFont(size=18, weight="bold")
        self.font_label = ctk.CTkFont(size=14, weight="bold")
        self.font_input = ctk.CTkFont(size=15)

        # ========= TÍTULO =========
        ctk.CTkLabel(
            self,
            text="Cadastro de Pedido de Inserção",
            font=self.font_titulo_pagina
        ).pack(pady=15)

        # ========= CONTAINER ROLÁVEL =========
        self.scrollable_frame = ctk.CTkScrollableFrame(self, width=930, height=700)
        self.scrollable_frame.pack(padx=10, pady=10, fill="both", expand=True)

        # ========= HELPERS =========
        def titulo_secao(texto):
            ctk.CTkLabel(
                self.scrollable_frame, text=texto,
                font=self.font_secao, anchor="w"
            ).pack(pady=(18, 8), padx=20, fill="x")

        def criar_label(texto):
            ctk.CTkLabel(
                self.scrollable_frame, text=texto,
                font=self.font_label, anchor="w"
            ).pack(pady=(8, 0), padx=20, fill="x")

        def criar_entry(titulo):
            criar_label(titulo)
            e = ctk.CTkEntry(self.scrollable_frame, height=40, font=self.font_input)
            e.pack(pady=(0, 8), padx=20, fill="x")
            return e

        def criar_combo(titulo, values, default="Selecione"):
            criar_label(titulo)
            cb = ctk.CTkComboBox(self.scrollable_frame, values=values, height=40, font=self.font_input)
            cb.set(default)
            cb.pack(pady=(0, 8), padx=20, fill="x")
            return cb

        def criar_combo_uf(titulo, default="DF"):
            ufs = [
                "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
                "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
                "EX (Exterior)"
            ]
            criar_label(titulo)
            cb = ctk.CTkComboBox(self.scrollable_frame, values=ufs, height=40, font=self.font_input)
            cb.set(default if default in ufs else "DF")
            cb.pack(pady=(0, 8), padx=20, fill="x")
            return cb

        # ========= CAMPOS =========

        # Número do PI
        titulo_secao("Identificação")
        self.numero_entry = criar_entry("Número do PI")

        # Tipo de PI
        criar_label("Tipo de PI")
        self.tipo_pi_segmented = ctk.CTkSegmentedButton(
            self.scrollable_frame,
            values=["Matriz", "CS", "Normal"],
            command=self.alternar_visibilidade_matriz,
            width=420
        )
        self.tipo_pi_segmented.set("Normal")
        self.tipo_pi_segmented.pack(pady=(2, 10), padx=20, anchor="w")

        # Seleção de PI Matriz (só habilita quando for CS)
        criar_label("PI Matriz (habilita ao selecionar 'CS' no Tipo de PI)")
        self.combo_pi_matriz = ctk.CTkComboBox(self.scrollable_frame, values=[], height=40, font=self.font_input)
        self.combo_pi_matriz.set("Selecione o PI Matriz")
        self.combo_pi_matriz.configure(state="disabled")
        self.combo_pi_matriz.pack(pady=(0, 10), padx=20, fill="x")

        # Anunciante
        titulo_secao("Informações do Anunciante")
        self.cnpj_anunciante_entry = criar_entry("CNPJ do Anunciante")
        self.nome_anunciante_entry = criar_entry("Nome do Anunciante")
        self.razao_anunciante_entry = criar_entry("Razão Social do Anunciante")
        self.uf_cliente_entry = criar_combo_uf("UF do Cliente (use EX para Exterior)", default="DF")

        ctk.CTkButton(
            self.scrollable_frame,
            text="🔍 Buscar Anunciante",
            command=self.preencher_anunciante,
            height=42
        ).pack(pady=(2, 14), padx=20, anchor="w")

        # Agência (sem título chamativo; apenas campos)
        self.agencia_var = ctk.BooleanVar(value=True)
        self.checkbox_agencia = ctk.CTkCheckBox(
            self.scrollable_frame,
            text=" Possui Agência? (desmarque se não houver)",
            variable=self.agencia_var,
            command=self.alternar_agencia,
            font=self.font_label
        )
        self.checkbox_agencia.pack(pady=(2, 8), padx=20, anchor="w")

        self.cnpj_agencia_entry = criar_entry("CNPJ da Agência")
        self.nome_agencia_entry = criar_entry("Nome da Agência")
        self.razao_agencia_entry = criar_entry("Razão Social da Agência")
        self.uf_agencia_entry = criar_combo_uf("UF da Agência", default="DF")

        self.botao_buscar_agencia = ctk.CTkButton(
            self.scrollable_frame,
            text="🔍 Buscar Agência",
            command=self.preencher_agencia,
            height=42
        )
        self.botao_buscar_agencia.pack(pady=(2, 14), padx=20, anchor="w")
        self.alternar_agencia()  # aplica estado inicial de acordo com o checkbox

        # Campanha
        titulo_secao("Dados da Campanha")
        self.nome_campanha_entry = criar_entry("Nome da Campanha")
        self.canal_entry = criar_combo(
            "Canal (Meio)",
            [
                "SITE", "YOUTUBE", "INSTAGRAM", "FACEBOOK", "TIKTOK", "TWITTER", "DOOH",
                "GOOGLE", "PROGRAMMATIC", "RADIO", "PORTAL", "REVISTA", "JORNAL",
                "INFLUENCIADOR", "TV", "OUTROS"
            ],
            default="Selecione"
        )
        self.perfil_entry = criar_combo(
            "Perfil do Anunciante",
            ["Privado", "Governo estadual", "Governo federal"],
            default="Selecione"
        )
        self.subperfil_entry = criar_combo(
            "Subperfil do Anunciante",
            [
                "Privado", "Governo estadual", "GDF - DETRAN", "Sistema S Federal", "Governo Federal",
                "GDF - TERRACAP", "Sistema S Regional", "CLDF", "GDF - SECOM", "GDF - BRB",
                "Governo Estadual - RJ", "Privado - PATROCINIO", "Privado - Ambipar",
                "Governo Federal - PATROCINIO", "Privado - BYD", "Privado - Gestao Executiva",
                "Gestao Executiva - PATROCINIO"
            ],
            default="Selecione"
        )

        # Datas
        titulo_secao("Datas e Período de Venda")
        self.mes_venda_entry = criar_entry("Mês da Venda (ex: 07/2025)")
        self.dia_venda_entry = criar_entry("Dia da Venda (ex: 23)")
        self.vencimento_entry = criar_entry("Vencimento (dd/mm/aaaa)")
        self.data_emissao_entry = criar_entry("Data de Emissão (dd/mm/aaaa)")

        # Responsáveis e Valores
        titulo_secao("Responsáveis e Valores")
        self.executivo_entry = criar_combo(
            "Executivo Responsável",
            [
                "Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio",
                "Flavio de Paula", "Lorena Fernandes", "Henri Marques", "Caio Bruno",
                "Flavia Cabral", "Paula Caroline", "Leila Santos", "Jessica Ribeiro",
                "Paula Campos"
            ],
            default="Selecione"
        )
        self.diretoria_entry = criar_combo(
            "Diretoria",
            ["Governo Federal", "Governo Estadual", "Rafael Augusto"],
            default="Selecione"
        )
        self.valor_bruto_entry = criar_entry("Valor Bruto (ex: 1000.00)")
        self.valor_liquido_entry = criar_entry("Valor Líquido (ex: 900.00)")
        self.obs_entry = criar_entry("Observações (opcional)")

        # Botão salvar
        ctk.CTkButton(
            self.scrollable_frame,
            text="💾 Cadastrar PI",
            command=self.cadastrar_pi,
            height=46
        ).pack(pady=20, padx=20, anchor="w")

    # =================== LÓGICA ===================

    def alternar_visibilidade_matriz(self, *args):
        """Habilita a seleção de PI Matriz apenas quando Tipo de PI == 'CS'."""
        tipo = self.tipo_pi_segmented.get()
        if tipo == "CS":
            self.preencher_pis_matriz()
            self.combo_pi_matriz.configure(state="normal")
            self.combo_pi_matriz.focus()
            self.combo_pi_matriz.event_generate("<Button-1>")
        else:
            self.combo_pi_matriz.set("Selecione o PI Matriz")
            self.combo_pi_matriz.configure(state="disabled")

    def preencher_pis_matriz(self):
        """Preenche a ComboBox com PIs Matriz que ainda possuem saldo."""
        pis_matriz_disponiveis = [
            pi for pi in listar_pis_matriz_ativos()
            if calcular_saldo_restante(pi.numero_pi) > 0
        ]
        self.combo_pi_matriz.configure(values=[pi.numero_pi for pi in pis_matriz_disponiveis])

    def alternar_agencia(self):
        """Habilita/desabilita campos da Agência conforme o checkbox 'Possui Agência?'."""
        estado = "normal" if self.agencia_var.get() else "disabled"
        for widget in (self.cnpj_agencia_entry, self.nome_agencia_entry, self.razao_agencia_entry, self.uf_agencia_entry, self.botao_buscar_agencia):
            widget.configure(state=estado)

    def preencher_anunciante(self):
        """Busca dados do anunciante pelo CNPJ e preenche os campos."""
        cnpj = self.cnpj_anunciante_entry.get().strip()
        if not cnpj:
            messagebox.showwarning("Aviso", "Digite o CNPJ do anunciante.")
            return
        anunciante = buscar_anunciante_por_cnpj(cnpj)
        if anunciante:
            self.nome_anunciante_entry.delete(0, "end")
            self.nome_anunciante_entry.insert(0, anunciante.nome_anunciante)
            self.razao_anunciante_entry.delete(0, "end")
            self.razao_anunciante_entry.insert(0, anunciante.razao_social_anunciante)
            self.uf_cliente_entry.set(getattr(anunciante, "uf_cliente", "DF"))
        else:
            messagebox.showinfo("Não encontrado", "Anunciante não encontrado.")

    def preencher_agencia(self):
        """Busca dados da agência pelo CNPJ e preenche os campos."""
        cnpj = self.cnpj_agencia_entry.get().strip()
        if not cnpj:
            messagebox.showwarning("Aviso", "Digite o CNPJ da agência.")
            return
        agencia = buscar_agencia_por_cnpj(cnpj)
        if agencia:
            self.nome_agencia_entry.delete(0, "end")
            self.nome_agencia_entry.insert(0, agencia.nome_agencia)
            self.razao_agencia_entry.delete(0, "end")
            self.razao_agencia_entry.insert(0, agencia.razao_social_agencia)
            self.uf_agencia_entry.set(getattr(agencia, "uf_agencia", "DF"))
        else:
            messagebox.showinfo("Não encontrado", "Agência não encontrada.")

    def cadastrar_pi(self):
        """Coleta os dados do formulário e chama o controller para criar o PI."""
        try:
            tipo_pi = self.tipo_pi_segmented.get()
            numero_pi_matriz = None
            if tipo_pi == "CS" and self.combo_pi_matriz.get() != "Selecione o PI Matriz":
                numero_pi_matriz = self.combo_pi_matriz.get()

            # Converte 'EX (Exterior)' para 'EX'
            uf_cliente_val = self.uf_cliente_entry.get()
            uf_agencia_val = self.uf_agencia_entry.get()
            uf_cliente_val = "EX" if uf_cliente_val.startswith("EX") else uf_cliente_val
            uf_agencia_val = "EX" if uf_agencia_val.startswith("EX") else uf_agencia_val

            criar_pi(
                numero_pi=self.numero_entry.get().strip(),
                tipo_pi=tipo_pi,
                numero_pi_matriz=numero_pi_matriz,
                nome_anunciante=self.nome_anunciante_entry.get().strip(),
                razao_social_anunciante=self.razao_anunciante_entry.get().strip(),
                cnpj_anunciante=self.cnpj_anunciante_entry.get().strip(),
                uf_cliente=uf_cliente_val,
                executivo=self.executivo_entry.get().strip(),
                diretoria=self.diretoria_entry.get().strip(),
                nome_campanha=self.nome_campanha_entry.get().strip(),
                nome_agencia=self.nome_agencia_entry.get().strip(),
                razao_social_agencia=self.razao_agencia_entry.get().strip(),
                cnpj_agencia=self.cnpj_agencia_entry.get().strip(),
                uf_agencia=uf_agencia_val,
                mes_venda=self.mes_venda_entry.get().strip(),
                dia_venda=self.dia_venda_entry.get().strip(),
                canal=self.canal_entry.get().strip(),
                perfil_anunciante=self.perfil_entry.get().strip(),
                subperfil_anunciante=self.subperfil_entry.get().strip(),
                valor_bruto=float(self.valor_bruto_entry.get().replace(",", ".").strip()),
                valor_liquido=float(self.valor_liquido_entry.get().replace(",", ".").strip()),
                vencimento=datetime.strptime(self.vencimento_entry.get().strip(), "%d/%m/%Y").date(),
                data_emissao=datetime.strptime(self.data_emissao_entry.get().strip(), "%d/%m/%Y").date(),
                observacoes=self.obs_entry.get().strip()
            )
            messagebox.showinfo("Sucesso", "PI cadastrado com sucesso!")
            self.limpar_campos()
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao cadastrar PI: {e}")

    def limpar_campos(self):
        """Limpa todas as entradas e reseta seleções."""
        for widget in self.scrollable_frame.winfo_children():
            if isinstance(widget, ctk.CTkEntry):
                widget.delete(0, "end")
            elif isinstance(widget, ctk.CTkComboBox):
                if widget is self.uf_cliente_entry or widget is self.uf_agencia_entry:
                    widget.set("DF")
                elif widget is self.combo_pi_matriz:
                    widget.set("Selecione o PI Matriz")
                    widget.configure(state="disabled")
                else:
                    widget.set("Selecione")
        self.tipo_pi_segmented.set("Normal")
        self.alternar_visibilidade_matriz()
