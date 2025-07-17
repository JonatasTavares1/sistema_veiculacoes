import customtkinter as ctk
from tkinter import messagebox
from controllers.produto_controller import criar_produto, listar_produtos

class ProdutoView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.titulo = ctk.CTkLabel(self, text="Cadastro de Produtos", font=ctk.CTkFont(size=20, weight="bold"))
        self.titulo.pack(pady=10)

        self.nome_entry = ctk.CTkEntry(self, placeholder_text="Nome do produto")
        self.nome_entry.pack(pady=5)

        self.desc_entry = ctk.CTkEntry(self, placeholder_text="Descrição")
        self.desc_entry.pack(pady=5)

        self.valor_entry = ctk.CTkEntry(self, placeholder_text="Valor unitário (ex: 199.90)")
        self.valor_entry.pack(pady=5)

        self.botao_cadastrar = ctk.CTkButton(self, text="Cadastrar", command=self.cadastrar_produto)
        self.botao_cadastrar.pack(pady=10)

        self.lista_label = ctk.CTkLabel(self, text="Produtos cadastrados:")
        self.lista_label.pack(pady=10)

        self.lista_produtos = ctk.CTkTextbox(self, width=450, height=200)
        self.lista_produtos.pack()
        self.atualizar_lista()

    def cadastrar_produto(self):
        nome = self.nome_entry.get()
        descricao = self.desc_entry.get()
        valor_str = self.valor_entry.get().replace(",", ".")

        if not nome or not valor_str:
            messagebox.showerror("Erro", "Preencha o nome e o valor.")
            return
        try:
            valor = float(valor_str)
            criar_produto(nome, descricao, valor)
            messagebox.showinfo("Sucesso", "Produto cadastrado!")
            self.nome_entry.delete(0, "end")
            self.desc_entry.delete(0, "end")
            self.valor_entry.delete(0, "end")
            self.atualizar_lista()
        except ValueError:
            messagebox.showerror("Erro", "Valor inválido.")

    def atualizar_lista(self):
        self.lista_produtos.delete("1.0", "end")
        produtos = listar_produtos()
        for p in produtos:
            self.lista_produtos.insert("end", f"{p.id} - {p.nome} | R$ {p.valor_unitario:.2f}\n")
