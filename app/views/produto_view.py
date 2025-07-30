import customtkinter as ctk
from tkinter import messagebox
from controllers.produto_controller import criar_produto, listar_produtos, excluir_produto

class ProdutoView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        ctk.set_appearance_mode("dark")

        # ========== FONTES ==========
        self.fonte_titulo = ctk.CTkFont(family="Arial", size=22, weight="bold")
        self.fonte_header = ctk.CTkFont(family="Arial", size=14, weight="bold")
        self.fonte_label = ctk.CTkFont(family="Arial", size=13)
        self.fonte_botao = ctk.CTkFont(family="Arial", size=14)

        # ========== TÍTULO ==========
        ctk.CTkLabel(self, text="Cadastro de Produtos", font=self.fonte_titulo).pack(pady=(10, 15))

        # ========== ENTRADAS ==========
        self.nome_entry = ctk.CTkEntry(
            self, placeholder_text="Nome do produto", width=400, font=self.fonte_label
        )
        self.nome_entry.pack(pady=5)

        self.valor_entry = ctk.CTkEntry(
            self, placeholder_text="Valor unitário (ex: 199,90)", width=400, font=self.fonte_label
        )
        self.valor_entry.pack(pady=5)

        ctk.CTkButton(
            self, text="➕ Cadastrar Produto", command=self.cadastrar_produto,
            height=40, font=self.fonte_botao,
            fg_color="#cc0000", hover_color="#990000", text_color="white"
        ).pack(pady=15)

        # ========== SUBTÍTULO E BOTÃO ==========
        ctk.CTkLabel(self, text="Produtos Cadastrados", font=self.fonte_header).pack(pady=(20, 8))

        ctk.CTkButton(
            self, text="🔄 Atualizar Lista", command=self.atualizar_tabela, font=self.fonte_botao,
            fg_color="#cc0000", hover_color="#990000", text_color="white"
        ).pack(pady=(0, 10))

        # ========== SCROLLABLE TABELA ==========
        self.scrollable_frame = ctk.CTkScrollableFrame(self, width=700, height=350)
        self.scrollable_frame.pack(padx=10, pady=10, fill="both", expand=True)

        # ========== CABEÇALHO ==========
        headers = ["ID", "NOME", "VALOR DO PRODUTO", "AÇÃO"]
        widths = [50, 300, 150, 120]

        for i, (h, w) in enumerate(zip(headers, widths)):
            label = ctk.CTkLabel(
                self.scrollable_frame, text=h, width=w, anchor="center",
                font=self.fonte_header, fg_color="#444", text_color="white",
                height=40, corner_radius=6
            )
            label.grid(row=0, column=i, padx=6, pady=(0, 6), sticky="w")

        self.linhas_widgets = []
        self.atualizar_tabela()

    def atualizar_tabela(self):
        for linha in self.linhas_widgets:
            for widget in linha:
                widget.destroy()
        self.linhas_widgets.clear()

        produtos = listar_produtos()

        for i, p in enumerate(produtos, start=1):
            bg = "#2a2a2a" if i % 2 == 0 else "#1f1f1f"
            linha_widgets = []

            id_label = ctk.CTkLabel(
                self.scrollable_frame, text=str(p.id), width=50, anchor="w",
                font=self.fonte_label, text_color="#e6e6e6",
                fg_color=bg, corner_radius=6
            )
            id_label.grid(row=i + 1, column=0, padx=6, pady=3, sticky="w")
            linha_widgets.append(id_label)

            nome_label = ctk.CTkLabel(
                self.scrollable_frame, text=p.nome, width=300, anchor="w",
                font=self.fonte_label, text_color="white",
                fg_color=bg, corner_radius=6
            )
            nome_label.grid(row=i + 1, column=1, padx=6, pady=3, sticky="w")
            linha_widgets.append(nome_label)

            valor_label = ctk.CTkLabel(
                self.scrollable_frame, text=f"R$ {p.valor_unitario}", width=150, anchor="w",
                font=self.fonte_label, text_color="#b3ffb3",
                fg_color=bg, corner_radius=6
            )
            valor_label.grid(row=i + 1, column=2, padx=6, pady=3, sticky="w")
            linha_widgets.append(valor_label)

            excluir_btn = ctk.CTkButton(
                self.scrollable_frame, text="🗑️", width=40, height=28,
                font=self.fonte_botao, fg_color="#cc0000", hover_color="#990000",
                text_color="white", corner_radius=6,
                command=lambda pid=p.id: self.excluir_produto(pid)
            )
            excluir_btn.grid(row=i + 1, column=3, padx=6, pady=3, sticky="w")
            linha_widgets.append(excluir_btn)

            self.linhas_widgets.append(linha_widgets)

    def cadastrar_produto(self):
        nome = self.nome_entry.get().strip()
        valor = self.valor_entry.get().strip()

        if not nome or not valor:
            messagebox.showerror("Erro", "Preencha o nome e o valor.")
            return

        try:
            criar_produto(nome, "", valor)
            messagebox.showinfo("Sucesso", "Produto cadastrado com sucesso!")
            self.nome_entry.delete(0, "end")
            self.valor_entry.delete(0, "end")
            self.atualizar_tabela()
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao cadastrar produto: {e}")

    def excluir_produto(self, produto_id):
        if messagebox.askyesno("Confirmação", "Tem certeza que deseja excluir este produto?"):
            try:
                excluir_produto(produto_id)
                self.atualizar_tabela()
                messagebox.showinfo("Sucesso", "Produto excluído com sucesso!")
            except Exception as e:
                messagebox.showerror("Erro", f"Erro ao excluir produto: {e}")
