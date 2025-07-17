import customtkinter as ctk
from tkinter import messagebox
from controllers.pi_controller import criar_pi, listar_pis
from datetime import datetime

class PIView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("green")

        ctk.CTkLabel(self, text="Cadastro de Pedido de Inserção", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=10)

        # Número PI
        self.numero_entry = ctk.CTkEntry(self, placeholder_text="Número do PI")
        self.numero_entry.pack(pady=5)

        # Cliente
        self.cliente_entry = ctk.CTkEntry(self, placeholder_text="Cliente")
        self.cliente_entry.pack(pady=5)

        # Data de Emissão
        self.data_entry = ctk.CTkEntry(self, placeholder_text="Data de Emissão (dd/mm/aaaa)")
        self.data_entry.pack(pady=5)

        # Observações
        self.obs_entry = ctk.CTkEntry(self, placeholder_text="Observações")
        self.obs_entry.pack(pady=5)

        # Botão
        ctk.CTkButton(self, text="Cadastrar PI", command=self.cadastrar_pi).pack(pady=10)

        # Lista
        ctk.CTkLabel(self, text="PIs cadastrados:").pack(pady=10)
        self.lista_pis = ctk.CTkTextbox(self, width=450, height=220)
        self.lista_pis.pack()
        self.atualizar_lista()

    def cadastrar_pi(self):
        numero = self.numero_entry.get()
        cliente = self.cliente_entry.get()
        data_str = self.data_entry.get()
        observacoes = self.obs_entry.get()

        if not numero or not cliente or not data_str:
            messagebox.showerror("Erro", "Preencha todos os campos obrigatórios.")
            return

        try:
            data = datetime.strptime(data_str, "%d/%m/%Y").date()
            criar_pi(numero, cliente, data, observacoes)
            messagebox.showinfo("Sucesso", "PI cadastrada com sucesso!")
            self.numero_entry.delete(0, "end")
            self.cliente_entry.delete(0, "end")
            self.data_entry.delete(0, "end")
            self.obs_entry.delete(0, "end")
            self.atualizar_lista()
        except ValueError:
            messagebox.showerror("Erro", "Data inválida. Use o formato dd/mm/aaaa.")

    def atualizar_lista(self):
        self.lista_pis.delete("1.0", "end")
        pis = listar_pis()
        for pi in pis:
            self.lista_pis.insert("end", f"{pi.id} | {pi.numero_pi} | {pi.cliente} | {pi.data_emissao}\n")
