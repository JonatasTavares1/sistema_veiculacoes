import customtkinter as ctk
from tkinter import messagebox
from controllers.produto_controller import criar_produto, listar_produtos

class ProdutoView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        

        # Título
        ctk.CTkLabel(self, text="🛒 Cadastro de Produtos", font=ctk.CTkFont(size=22, weight="bold")).pack(pady=(0, 15))

        # Entradas
        self.nome_entry = ctk.CTkEntry(self, placeholder_text="Nome do produto", width=400)
        self.nome_entry.pack(pady=5)

        self.desc_entry = ctk.CTkEntry(self, placeholder_text="Descrição", width=400)
        self.desc_entry.pack(pady=5)

        self.valor_entry = ctk.CTkEntry(self, placeholder_text="Valor unitário (ex: 199.90)", width=400)
        self.valor_entry.pack(pady=5)

        # Botão cadastrar
        ctk.CTkButton(self, text="➕ Cadastrar Produto", command=self.cadastrar_produto, height=40).pack(pady=15)

        # Lista de produtos
        ctk.CTkLabel(self, text="📋 Produtos cadastrados:", font=ctk.CTkFont(size=16)).pack(pady=(10, 5))

        self.text_frame = ctk.CTkFrame(self)
        self.text_frame.pack()

        self.lista_produtos = ctk.CTkTextbox(self.text_frame, width=500, height=250, wrap="none", corner_radius=8)
        self.lista_produtos.pack(side="left", fill="both", expand=True)

        self.scrollbar = ctk.CTkScrollbar(self.text_frame, orientation="vertical", command=self.lista_produtos.yview)
        self.scrollbar.pack(side="right", fill="y")

        self.lista_produtos.configure(yscrollcommand=self.scrollbar.set)

        self.atualizar_lista()

    def cadastrar_produto(self):
        nome = self.nome_entry.get().strip()
        descricao = self.desc_entry.get().strip()
        valor_str = self.valor_entry.get().replace(",", ".")

        if not nome or not valor_str:
            messagebox.showerror("Erro", "Preencha o nome e o valor.")
            return
        try:
            valor = float(valor_str)
            criar_produto(nome, descricao, valor)
            messagebox.showinfo("Sucesso", "Produto cadastrado com sucesso!")
            self.nome_entry.delete(0, "end")
            self.desc_entry.delete(0, "end")
            self.valor_entry.delete(0, "end")
            self.atualizar_lista()
        except ValueError:
            messagebox.showerror("Erro", "Valor inválido. Use ponto (.) como separador decimal.")

    def atualizar_lista(self):
        self.lista_produtos.delete("1.0", "end")
        produtos = listar_produtos()
        if not produtos:
            self.lista_produtos.insert("end", "Nenhum produto cadastrado.\n")
            return
        for p in produtos:
            self.lista_produtos.insert("end", f"🆔 {p.id} | {p.nome} | R$ {p.valor_unitario:.2f}\n")
