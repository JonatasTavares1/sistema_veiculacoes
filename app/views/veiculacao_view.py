import customtkinter as ctk
from tkinter import messagebox
from controllers.veiculacao_controller import criar_veiculacao, listar_veiculacoes, excluir_veiculacao
from controllers.produto_controller import listar_produtos
from controllers.pi_controller import listar_pis


class VeiculacaoView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.fonte_titulo = ctk.CTkFont(family="Arial", size=22, weight="bold")
        self.fonte_label = ctk.CTkFont(family="Arial", size=13)
        self.fonte_botao = ctk.CTkFont(family="Arial", size=14)
        self.fonte_header = ctk.CTkFont(family="Arial", size=14, weight="bold")

        # Título
        ctk.CTkLabel(self, text="Controle de Veiculações", font=self.fonte_titulo).pack(pady=(10, 15))

        # FORMULÁRIO
        form_frame = ctk.CTkFrame(self)
        form_frame.pack(pady=10)

        # PI
        ctk.CTkLabel(form_frame, text="PI", font=self.fonte_label).grid(row=0, column=0, sticky="w", padx=5, pady=2)
        self.pis = listar_pis()
        self.pi_combobox = ctk.CTkComboBox(form_frame, values=[pi.numero_pi for pi in self.pis], width=250)
        self.pi_combobox.grid(row=1, column=0, padx=5, pady=5)

        # Produto
        ctk.CTkLabel(form_frame, text="Produto", font=self.fonte_label).grid(row=0, column=1, sticky="w", padx=5, pady=2)
        self.produtos = listar_produtos()
        self.produto_combobox = ctk.CTkComboBox(form_frame, values=[p.nome for p in self.produtos], width=250)
        self.produto_combobox.grid(row=1, column=1, padx=5, pady=5)

        # Data Início
        ctk.CTkLabel(form_frame, text="Data Início Veiculação", font=self.fonte_label).grid(row=2, column=0, sticky="w", padx=5, pady=2)
        self.data_inicio_entry = ctk.CTkEntry(form_frame, placeholder_text="dd/mm/aaaa", width=250)
        self.data_inicio_entry.grid(row=3, column=0, padx=5, pady=5)

        # Data Fim
        ctk.CTkLabel(form_frame, text="Data Fim Veiculação", font=self.fonte_label).grid(row=2, column=1, sticky="w", padx=5, pady=2)
        self.data_fim_entry = ctk.CTkEntry(form_frame, placeholder_text="dd/mm/aaaa", width=250)
        self.data_fim_entry.grid(row=3, column=1, padx=5, pady=5)

        # Botão Adicionar
        ctk.CTkButton(
            form_frame, text="➕ Adicionar Veiculação", command=self.adicionar_veiculacao,
            font=self.fonte_botao, height=40
        ).grid(row=4, column=0, columnspan=2, padx=5, pady=10)

        # TABELA DE VEICULAÇÕES
        ctk.CTkLabel(self, text="Veiculações Registradas", font=self.fonte_header).pack(pady=(20, 5))

        self.scrollable_frame = ctk.CTkScrollableFrame(self, width=800, height=300, fg_color="#1e1e1e")
        self.scrollable_frame.pack(padx=10, pady=10, fill="both", expand=True)

        headers = ["PI", "PRODUTO", "INÍCIO", "FIM", "AÇÃO"]
        widths = [150, 250, 120, 120, 80]

        for i, (h, w) in enumerate(zip(headers, widths)):
            label = ctk.CTkLabel(
                self.scrollable_frame, text=h, width=w, anchor="center",
                font=self.fonte_header, fg_color="#444444",
                text_color="white", height=40, corner_radius=6
            )
            label.grid(row=0, column=i, padx=6, pady=(0, 6), sticky="w")

        self.linhas_widgets = []
        self.atualizar_tabela()

    def adicionar_veiculacao(self):
        pi_numero = self.pi_combobox.get()
        produto_nome = self.produto_combobox.get()
        data_inicio = self.data_inicio_entry.get()
        data_fim = self.data_fim_entry.get()

        if not pi_numero or not produto_nome or not data_inicio or not data_fim:
            messagebox.showerror("Erro", "Preencha todos os campos.")
            return

        try:
            # Procura os objetos selecionados
            pi_obj = next((pi for pi in self.pis if pi.numero_pi == pi_numero), None)
            produto_obj = next((p for p in self.produtos if p.nome == produto_nome), None)

            if not pi_obj or not produto_obj:
                raise ValueError("Produto ou PI inválido.")

            criar_veiculacao(produto_obj.id, data_inicio, data_fim, pi_obj.numero_pi)
            messagebox.showinfo("Sucesso", "Veiculação adicionada com sucesso!")

            self.data_inicio_entry.delete(0, "end")
            self.data_fim_entry.delete(0, "end")
            self.atualizar_tabela()
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao adicionar veiculação: {e}")

    def atualizar_tabela(self):
        for linha in self.linhas_widgets:
            for widget in linha:
                widget.destroy()
        self.linhas_widgets.clear()

        veiculacoes = listar_veiculacoes()

        for i, v in enumerate(veiculacoes, start=1):
            bg = "#2a2a2a" if i % 2 == 0 else "#1f1f1f"
            widgets = []

            campos = [v.pi.numero_pi, v.produto.nome, v.data_inicio, v.data_fim]
            larguras = [150, 250, 120, 120]

            for j, (valor, w) in enumerate(zip(campos, larguras)):
                label = ctk.CTkLabel(
                    self.scrollable_frame, text=valor, width=w, anchor="w",
                    font=self.fonte_label, text_color="#ffffff",
                    fg_color=bg, corner_radius=6
                )
                label.grid(row=i, column=j, padx=6, pady=3, sticky="w")
                widgets.append(label)

            excluir_btn = ctk.CTkButton(
                self.scrollable_frame, text="🗑️", width=40, height=28,
                font=self.fonte_botao, fg_color="#cc0000",
                hover_color="#ff1a1a", text_color="white",
                corner_radius=6, command=lambda vid=v.id: self.excluir_veiculacao(vid)
            )
            excluir_btn.grid(row=i, column=4, padx=6, pady=3, sticky="w")
            widgets.append(excluir_btn)

            self.linhas_widgets.append(widgets)

    def excluir_veiculacao(self, veiculacao_id):
        if messagebox.askyesno("Confirmação", "Deseja realmente excluir esta veiculação?"):
            try:
                excluir_veiculacao(veiculacao_id)
                messagebox.showinfo("Sucesso", "Veiculação excluída com sucesso!")
                self.atualizar_tabela()
            except Exception as e:
                messagebox.showerror("Erro", f"Erro ao excluir veiculação: {e}")
