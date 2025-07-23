import customtkinter as ctk
from tkinter import messagebox
from controllers.anunciante_controller import criar_anunciante, listar_anunciantes

class AnuncianteView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        ctk.CTkLabel(self, text="Cadastro de Anunciante", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=10)

        # Entradas de dados
        self.nome_entry = ctk.CTkEntry(self, placeholder_text="Nome do Anunciante")
        self.nome_entry.pack(pady=5, fill="x", padx=20)

        self.razao_entry = ctk.CTkEntry(self, placeholder_text="Razão Social")
        self.razao_entry.pack(pady=5, fill="x", padx=20)

        self.cnpj_entry = ctk.CTkEntry(self, placeholder_text="CNPJ")
        self.cnpj_entry.pack(pady=5, fill="x", padx=20)

        self.uf_entry = ctk.CTkEntry(self, placeholder_text="UF")
        self.uf_entry.pack(pady=5, fill="x", padx=20)

        # Botão para cadastrar
        ctk.CTkButton(self, text="Cadastrar Anunciante", command=self.cadastrar).pack(pady=10)

        # Lista de anunciantes
        ctk.CTkLabel(self, text="Anunciantes cadastrados:", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=10)
        self.lista = ctk.CTkTextbox(self, width=500, height=200)
        self.lista.pack(padx=20, pady=10)
        self.atualizar_lista()

    def cadastrar(self):
        nome = self.nome_entry.get()
        razao = self.razao_entry.get()
        cnpj = self.cnpj_entry.get()
        uf = self.uf_entry.get()

        if not nome or not cnpj:
            messagebox.showerror("Erro", "Nome e CNPJ são obrigatórios.")
            return

        try:
            criar_anunciante(nome, razao, cnpj, uf)
            messagebox.showinfo("Sucesso", "Anunciante cadastrado com sucesso!")
            self.limpar_campos()
            self.atualizar_lista()
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao cadastrar anunciante: {e}")

    def limpar_campos(self):
        self.nome_entry.delete(0, "end")
        self.razao_entry.delete(0, "end")
        self.cnpj_entry.delete(0, "end")
        self.uf_entry.delete(0, "end")

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")
        for a in listar_anunciantes():
            self.lista.insert("end", f"{a.nome_anunciante} | {a.cnpj_anunciante} | {a.uf_cliente}\n")
