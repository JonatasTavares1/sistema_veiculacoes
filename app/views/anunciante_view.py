import customtkinter as ctk
from tkinter import messagebox
from datetime import datetime
from controllers.anunciante_controller import criar_anunciante, listar_anunciantes, buscar_cnpj_na_web

EXECUTIVOS = [
    "Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio", "Flavio de Paula",
    "Lorena Fernandes", "Henri Marques", "Caio Bruno", "Flavia Cabral", "Paula Caroline",
    "Leila Santos", "Jessica Ribeiro", "Paula Campos"
]

class AnuncianteView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        ctk.CTkLabel(self, text="Cadastro de Anunciante", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=10)

        self.nome_entry = ctk.CTkEntry(self, placeholder_text="Nome do Anunciante")
        self.nome_entry.pack(pady=5, fill="x", padx=20)

        self.razao_entry = ctk.CTkEntry(self, placeholder_text="Razão Social")
        self.razao_entry.pack(pady=5, fill="x", padx=20)

        self.cnpj_entry = ctk.CTkEntry(self, placeholder_text="CNPJ")
        self.cnpj_entry.pack(pady=5, fill="x", padx=20)
        self.cnpj_entry.bind("<FocusOut>", self.preencher_dados_por_cnpj)
        self.cnpj_entry.bind("<Return>", self.preencher_dados_por_cnpj)

        self.uf_entry = ctk.CTkEntry(self, placeholder_text="UF")
        self.uf_entry.pack(pady=5, fill="x", padx=20)

        self.email_entry = ctk.CTkEntry(self, placeholder_text="Email do Anunciante")
        self.email_entry.pack(pady=5, fill="x", padx=20)

        self.executivo_combo = ctk.CTkComboBox(self, values=EXECUTIVOS)
        self.executivo_combo.set("Selecione o Executivo")
        self.executivo_combo.pack(pady=5, padx=20)

        ctk.CTkButton(self, text="Cadastrar Anunciante", command=self.cadastrar).pack(pady=10)

        ctk.CTkLabel(self, text="Anunciantes cadastrados:", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=10)
        self.lista = ctk.CTkTextbox(self, width=600, height=220)
        self.lista.pack(padx=20, pady=10)
        self.atualizar_lista()

    def preencher_dados_por_cnpj(self, event=None):
        cnpj = self.cnpj_entry.get().strip()
        if not cnpj:
            return

        dados = buscar_cnpj_na_web(cnpj)
        if dados:
            self.nome_entry.delete(0, "end")
            self.nome_entry.insert(0, dados.get("nome_fantasia", ""))

            self.razao_entry.delete(0, "end")
            self.razao_entry.insert(0, dados.get("razao_social", ""))

            self.uf_entry.delete(0, "end")
            self.uf_entry.insert(0, dados.get("uf", ""))

            messagebox.showinfo("Info", "Dados preenchidos automaticamente pelo CNPJ.")
        else:
            messagebox.showwarning("Aviso", "CNPJ não encontrado na base da Receita.")

    def cadastrar(self):
        nome = self.nome_entry.get().strip()
        razao = self.razao_entry.get().strip()
        cnpj = self.cnpj_entry.get().strip()
        uf = self.uf_entry.get().strip()
        email = self.email_entry.get().strip()
        executivo = self.executivo_combo.get()

        if not nome or not cnpj or executivo == "Selecione o Executivo":
            messagebox.showerror("Erro", "Nome, CNPJ e Executivo são obrigatórios.")
            return

        if "." not in cnpj or "-" not in cnpj:
            messagebox.showerror("Erro", "O CNPJ deve conter ponto (.) e traço (-).")
            return

        if email and "@" not in email:
            messagebox.showerror("Erro", "Email inválido.")
            return

        data_cadastro = datetime.now().strftime("%d/%m/%Y")

        try:
            criar_anunciante(nome, razao, cnpj, uf, executivo, email, data_cadastro)
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
        self.email_entry.delete(0, "end")
        self.executivo_combo.set("Selecione o Executivo")

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")
        for a in listar_anunciantes():
            self.lista.insert(
                "end",
                f"{a.nome_anunciante} | {a.cnpj_anunciante} | {a.uf_cliente} | {a.executivo} | {a.email_anunciante} | {a.data_cadastro}\n"
            )
