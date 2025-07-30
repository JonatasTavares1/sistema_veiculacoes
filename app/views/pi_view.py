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

        ctk.CTkLabel(self, text="Cadastro de Pedido de Inserção", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=15)
        self.scrollable_frame = ctk.CTkScrollableFrame(self, width=800, height=600)
        self.scrollable_frame.pack(padx=10, pady=10, fill="both", expand=True)

        def criar_entry(parent, placeholder):
            entry = ctk.CTkEntry(parent, placeholder_text=placeholder)
            entry.pack(pady=4, padx=20, fill="x")
            return entry

        def criar_combo(parent, values, placeholder="Selecione"):
            combo = ctk.CTkComboBox(parent, values=values)
            combo.set(placeholder)
            combo.pack(pady=4, padx=20, fill="x")
            return combo

        self.numero_entry = criar_entry(self.scrollable_frame, "Número do PI")

        # Tipo de PI
        ctk.CTkLabel(self.scrollable_frame, text="Tipo de PI", font=ctk.CTkFont(weight="bold")).pack(pady=(10, 2))
        self.tipo_pi_segmented = ctk.CTkSegmentedButton(
            self.scrollable_frame,
            values=["Matriz", "CS", "Normal"],
            command=self.alternar_visibilidade_matriz,
            width=300
        )
        self.tipo_pi_segmented.set("Normal")
        self.tipo_pi_segmented.pack(pady=4, padx=20)

        # Seleção de PI Matriz
        self.label_pi_matriz = ctk.CTkLabel(self.scrollable_frame, text="Selecione o PI Matriz que deseja vincular", font=ctk.CTkFont(weight="bold"))
        self.label_pi_matriz.pack(pady=(4, 2))
        self.combo_pi_matriz = criar_combo(self.scrollable_frame, values=[], placeholder="Selecione o PI Matriz")
        self.combo_pi_matriz.configure(state="disabled")

        # Anunciante
        ctk.CTkLabel(self.scrollable_frame, text="Informações do Anunciante", font=ctk.CTkFont(weight="bold")).pack(pady=(10, 2))
        self.cnpj_anunciante_entry = criar_entry(self.scrollable_frame, "CNPJ do Anunciante")
        self.nome_anunciante_entry = criar_entry(self.scrollable_frame, "Nome do Anunciante")
        self.razao_anunciante_entry = criar_entry(self.scrollable_frame, "Razão Social do Anunciante")
        self.uf_cliente_entry = criar_entry(self.scrollable_frame, "UF do Cliente")

        ctk.CTkButton(
            self.scrollable_frame,
            text="🔍 Buscar Anunciante",
            command=self.preencher_anunciante,
            fg_color="#cc0000",
            hover_color="#990000",
            text_color="white"
        ).pack(pady=(0, 10))

        # Agência
        ctk.CTkLabel(self.scrollable_frame, text="Informações da Agência", font=ctk.CTkFont(weight="bold")).pack(pady=(10, 2))
        self.agencia_var = ctk.BooleanVar(value=True)
        self.checkbox_agencia = ctk.CTkCheckBox(self.scrollable_frame, text=" Possui Agência?", variable=self.agencia_var, command=self.alternar_agencia)
        self.checkbox_agencia.pack(pady=(0, 5), padx=20)

        self.cnpj_agencia_entry = criar_entry(self.scrollable_frame, "CNPJ da Agência")
        self.nome_agencia_entry = criar_entry(self.scrollable_frame, "Nome da Agência")
        self.razao_agencia_entry = criar_entry(self.scrollable_frame, "Razão Social da Agência")
        self.uf_agencia_entry = criar_entry(self.scrollable_frame, "UF da Agência")

        self.botao_buscar_agencia = ctk.CTkButton(
            self.scrollable_frame,
            text="🔍 Buscar Agência",
            command=self.preencher_agencia,
            fg_color="#cc0000",
            hover_color="#990000",
            text_color="white"
        )
        self.botao_buscar_agencia.pack(pady=(0, 10))
        self.alternar_agencia()

        # Campanha
        ctk.CTkLabel(self.scrollable_frame, text="Dados da Campanha", font=ctk.CTkFont(weight="bold")).pack(pady=(10, 2))
        self.nome_campanha_entry = criar_entry(self.scrollable_frame, "Nome da Campanha")
        self.canal_entry = criar_combo(
            self.scrollable_frame,
            ["SITE", "YOUTUBE", "INSTAGRAM", "FACEBOOK", "TIKTOK", "TWITTER", "DOOH", "GOOGLE", "PROGRAMMATIC",
             "RADIO", "PORTAL", "REVISTA", "JORNAL", "INFLUENCIADOR", "TV", "OUTROS"],
            "Selecione o Canal"
        )
        self.perfil_entry = criar_combo(self.scrollable_frame, ["Privado", "Governo estadual", "Governo federal"], "Selecione o Perfil")
        self.subperfil_entry = criar_combo(
            self.scrollable_frame,
            ["Privado", "Governo estadual", "GDF - DETRAN", "Sistema S Federal", "Governo Federal",
             "GDF - TERRACAP", "Sistema S Regional", "CLDF", "GDF - SECOM", "GDF - BRB",
             "Governo Estadual - RJ", "Privado - PATROCINIO", "Privado - Ambipar", "Governo Federal - PATROCINIO",
             "Privado - BYD", "Privado - Gestao Executiva", "Gestao Executiva - PATROCINIO"],
            "Selecione o Subperfil"
        )

        # Datas
        ctk.CTkLabel(self.scrollable_frame, text="Datas e Período de Venda", font=ctk.CTkFont(weight="bold")).pack(pady=(10, 2))
        self.mes_venda_entry = criar_entry(self.scrollable_frame, "Mês da Venda (ex: 07/2025)")
        self.dia_venda_entry = criar_entry(self.scrollable_frame, "Dia da Venda (ex: 23)")
        self.vencimento_entry = criar_entry(self.scrollable_frame, "Vencimento (dd/mm/aaaa)")
        self.data_emissao_entry = criar_entry(self.scrollable_frame, "Data de Emissão (dd/mm/aaaa)")

        # Responsáveis
        ctk.CTkLabel(self.scrollable_frame, text="Responsáveis e Valores", font=ctk.CTkFont(weight="bold")).pack(pady=(10, 2))
        self.executivo_entry = criar_combo(
            self.scrollable_frame,
            ["Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio", "Flavio de Paula",
             "Lorena Fernandes", "Henri Marques", "Caio Bruno", "Flavia Cabral", "Paula Caroline",
             "Leila Santos", "Jessica Ribeiro", "Paula Campos"],
            "Selecione o Executivo"
        )
        self.diretoria_entry = criar_combo(self.scrollable_frame, ["Governo Federal", "Governo Estadual", "Rafael Augusto"], "Selecione a Diretoria")
        self.valor_bruto_entry = criar_entry(self.scrollable_frame, "Valor Bruto (ex: 1000.00)")
        self.valor_liquido_entry = criar_entry(self.scrollable_frame, "Valor Líquido (ex: 900.00)")
        self.obs_entry = criar_entry(self.scrollable_frame, "Observações")

        ctk.CTkButton(
            self.scrollable_frame,
            text="💾 Cadastrar PI",
            command=self.cadastrar_pi,
            fg_color="#cc0000",
            hover_color="#990000",
            text_color="white"
        ).pack(pady=20)

    def alternar_visibilidade_matriz(self, *args):
        tipo = self.tipo_pi_segmented.get()
        if tipo == "CS":
            self.preencher_pis_matriz()
            self.combo_pi_matriz.configure(state="normal")
            self.label_pi_matriz.configure(text_color="white")
        else:
            self.combo_pi_matriz.set("Selecione o PI Matriz")
            self.combo_pi_matriz.configure(state="disabled")
            self.label_pi_matriz.configure(text_color="gray")

    def preencher_pis_matriz(self):
        pis_matriz_disponiveis = [
            pi for pi in listar_pis_matriz_ativos()
            if calcular_saldo_restante(pi.numero_pi) > 0
        ]
        self.combo_pi_matriz.configure(values=[pi.numero_pi for pi in pis_matriz_disponiveis])

    def alternar_agencia(self):
        estado = "normal" if self.agencia_var.get() else "disabled"
        self.cnpj_agencia_entry.configure(state=estado)
        self.nome_agencia_entry.configure(state=estado)
        self.razao_agencia_entry.configure(state=estado)
        self.uf_agencia_entry.configure(state=estado)
        self.botao_buscar_agencia.configure(state=estado)

    def preencher_anunciante(self):
        cnpj = self.cnpj_anunciante_entry.get()
        if not cnpj:
            messagebox.showwarning("Aviso", "Digite o CNPJ do anunciante.")
            return
        anunciante = buscar_anunciante_por_cnpj(cnpj)
        if anunciante:
            self.nome_anunciante_entry.delete(0, "end")
            self.nome_anunciante_entry.insert(0, anunciante.nome_anunciante)
            self.razao_anunciante_entry.delete(0, "end")
            self.razao_anunciante_entry.insert(0, anunciante.razao_social_anunciante)
            self.uf_cliente_entry.delete(0, "end")
            self.uf_cliente_entry.insert(0, anunciante.uf_cliente)
        else:
            messagebox.showinfo("Não encontrado", "Anunciante não encontrado.")

    def preencher_agencia(self):
        cnpj = self.cnpj_agencia_entry.get()
        if not cnpj:
            messagebox.showwarning("Aviso", "Digite o CNPJ da agência.")
            return
        agencia = buscar_agencia_por_cnpj(cnpj)
        if agencia:
            self.nome_agencia_entry.delete(0, "end")
            self.nome_agencia_entry.insert(0, agencia.nome_agencia)
            self.razao_agencia_entry.delete(0, "end")
            self.razao_agencia_entry.insert(0, agencia.razao_social_agencia)
            self.uf_agencia_entry.delete(0, "end")
            self.uf_agencia_entry.insert(0, agencia.uf_agencia)
        else:
            messagebox.showinfo("Não encontrado", "Agência não encontrada.")

    def cadastrar_pi(self):
        try:
            tipo_pi = self.tipo_pi_segmented.get()
            numero_pi_matriz = None
            if tipo_pi == "CS" and self.combo_pi_matriz.get() != "Selecione o PI Matriz":
                numero_pi_matriz = self.combo_pi_matriz.get()

            criar_pi(
                numero_pi=self.numero_entry.get(),
                tipo_pi=tipo_pi,
                numero_pi_matriz=numero_pi_matriz,
                nome_anunciante=self.nome_anunciante_entry.get(),
                razao_social_anunciante=self.razao_anunciante_entry.get(),
                cnpj_anunciante=self.cnpj_anunciante_entry.get(),
                uf_cliente=self.uf_cliente_entry.get(),
                executivo=self.executivo_entry.get(),
                diretoria=self.diretoria_entry.get(),
                nome_campanha=self.nome_campanha_entry.get(),
                nome_agencia=self.nome_agencia_entry.get(),
                razao_social_agencia=self.razao_agencia_entry.get(),
                cnpj_agencia=self.cnpj_agencia_entry.get(),
                uf_agencia=self.uf_agencia_entry.get(),
                mes_venda=self.mes_venda_entry.get(),
                dia_venda=self.dia_venda_entry.get(),
                canal=self.canal_entry.get(),
                perfil_anunciante=self.perfil_entry.get(),
                subperfil_anunciante=self.subperfil_entry.get(),
                valor_bruto=float(self.valor_bruto_entry.get().replace(",", ".")),
                valor_liquido=float(self.valor_liquido_entry.get().replace(",", ".")),
                vencimento=datetime.strptime(self.vencimento_entry.get(), "%d/%m/%Y").date(),
                data_emissao=datetime.strptime(self.data_emissao_entry.get(), "%d/%m/%Y").date(),
                eh_matriz=(tipo_pi == "Matriz"),
                observacoes=self.obs_entry.get()
            )
            messagebox.showinfo("Sucesso", "PI cadastrado com sucesso!")
            self.limpar_campos()
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao cadastrar PI: {e}")

    def limpar_campos(self):
        for widget in self.scrollable_frame.winfo_children():
            if isinstance(widget, ctk.CTkEntry):
                widget.delete(0, "end")
            elif isinstance(widget, ctk.CTkComboBox):
                widget.set("Selecione")
        self.tipo_pi_segmented.set("Normal")
        self.alternar_visibilidade_matriz()
