import customtkinter as ctk
from tkinter import messagebox
from controllers.agencia_controller import criar_agencia, listar_agencias

class AgenciaView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        ctk.CTkLabel(self, text="Cadastro de Agência", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=10)

        # Entradas
        self.nome_entry = ctk.CTkEntry(self, placeholder_text="Nome da Agência")
        self.nome_entry.pack(pady=5, fill="x", padx=20)

        self.razao_entry = ctk.CTkEntry(self, placeholder_text="Razão Social")
        self.razao_entry.pack(pady=5, fill="x", padx=20)

        self.cnpj_entry = ctk.CTkEntry(self, placeholder_text="CNPJ")
        self.cnpj_entry.pack(pady=5, fill="x", padx=20)

        self.uf_entry = ctk.CTkEntry(self, placeholder_text="UF")
        self.uf_entry.pack(pady=5, fill="x", padx=20)

        # Botão de cadastro
        ctk.CTkButton(self, text="Cadastrar Agência", command=self.cadastrar).pack(pady=10)

        # Lista de agências
        ctk.CTkLabel(self, text="Agências cadastradas:", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=10)
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
            criar_agencia(nome, razao, cnpj, uf)
            messagebox.showinfo("Sucesso", "Agência cadastrada com sucesso!")
            self.limpar_campos()
            self.atualizar_lista()
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao cadastrar agência: {e}")

    def limpar_campos(self):
        self.nome_entry.delete(0, "end")
        self.razao_entry.delete(0, "end")
        self.cnpj_entry.delete(0, "end")
        self.uf_entry.delete(0, "end")

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")
        for a in listar_agencias():
            self.lista.insert("end", f"{a.nome} | {a.cnpj} | {a.uf}\n")
