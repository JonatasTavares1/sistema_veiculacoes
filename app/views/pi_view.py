import customtkinter as ctk
from tkinter import messagebox
from controllers.pi_controller import criar_pi, listar_pis
from datetime import datetime

class PIView(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Cadastro de PI")
        self.geometry("600x800")
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("green")

        ctk.CTkLabel(self, text="Cadastro de Pedido de Inserção", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=10)

        self.numero_entry = ctk.CTkEntry(self, placeholder_text="Número do PI")
        self.numero_entry.pack(pady=5)

        self.cliente_entry = ctk.CTkEntry(self, placeholder_text="Cliente")
        self.cliente_entry.pack(pady=5)

        self.data_entry = ctk.CTkEntry(self, placeholder_text="Data de Emissão (dd/mm/aaaa)")
        self.data_entry.pack(pady=5)

        self.tipo_entry = ctk.CTkEntry(self, placeholder_text="Tipo de PI")
        self.tipo_entry.pack(pady=5)

        self.praca_entry = ctk.CTkEntry(self, placeholder_text="Praça")
        self.praca_entry.pack(pady=5)

        self.meio_entry = ctk.CTkEntry(self, placeholder_text="Meio")
        self.meio_entry.pack(pady=5)

        self.peca_entry = ctk.CTkEntry(self, placeholder_text="Peça Publicitária")
        self.peca_entry.pack(pady=5)

        self.colocacao_entry = ctk.CTkEntry(self, placeholder_text="Colocação")
        self.colocacao_entry.pack(pady=5)

        self.formato_entry = ctk.CTkEntry(self, placeholder_text="Formato")
        self.formato_entry.pack(pady=5)

        self.valor_unitario_entry = ctk.CTkEntry(self, placeholder_text="Valor Unitário")
        self.valor_unitario_entry.pack(pady=5)

        self.total_entry = ctk.CTkEntry(self, placeholder_text="Valor Total")
        self.total_entry.pack(pady=5)

        self.obs_entry = ctk.CTkEntry(self, placeholder_text="Observações")
        self.obs_entry.pack(pady=5)

        ctk.CTkButton(self, text="Cadastrar PI", command=self.cadastrar_pi).pack(pady=10)

        ctk.CTkLabel(self, text="PIs cadastradas:").pack(pady=10)
        self.lista_pis = ctk.CTkTextbox(self, width=550, height=200)
        self.lista_pis.pack()
        self.atualizar_lista()

    def cadastrar_pi(self):
        try:
            numero = self.numero_entry.get()
            cliente = self.cliente_entry.get()
            data_str = self.data_entry.get()
            tipo = self.tipo_entry.get()
            praca = self.praca_entry.get()
            meio = self.meio_entry.get()
            peca = self.peca_entry.get()
            colocacao = self.colocacao_entry.get()
            formato = self.formato_entry.get()
            valor_unitario = float(self.valor_unitario_entry.get().replace(",", "."))
            valor_total = float(self.total_entry.get().replace(",", "."))
            observacoes = self.obs_entry.get()

            if not numero or not cliente or not data_str:
                messagebox.showerror("Erro", "Preencha os campos obrigatórios.")
                return

            data_emissao = datetime.strptime(data_str, "%d/%m/%Y").date()

            criar_pi(
                numero, cliente, data_emissao, observacoes,
                tipo, praca, meio, peca, colocacao, formato,
                valor_unitario, valor_total
            )

            messagebox.showinfo("Sucesso", "PI cadastrada com sucesso!")
            self.limpar_campos()
            self.atualizar_lista()

        except ValueError as e:
            messagebox.showerror("Erro", f"Erro de valor: {e}")
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao cadastrar PI: {e}")

    def limpar_campos(self):
        for campo in [
            self.numero_entry, self.cliente_entry, self.data_entry,
            self.tipo_entry, self.praca_entry, self.meio_entry,
            self.peca_entry, self.colocacao_entry, self.formato_entry,
            self.valor_unitario_entry, self.total_entry, self.obs_entry
        ]:
            campo.delete(0, "end")

    def atualizar_lista(self):
        self.lista_pis.delete("1.0", "end")
        for pi in listar_pis():
            self.lista_pis.insert("end", f"{pi.id} | {pi.numero_pi} | {pi.cliente} | {pi.data_emissao} | {pi.tipo}\n")
