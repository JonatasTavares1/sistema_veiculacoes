import customtkinter as ctk
from tkinter import messagebox
from controllers.veiculacao_controller import criar_veiculacao, listar_veiculacoes
from controllers.produto_controller import listar_produtos
from controllers.pi_controller import listar_pis
from datetime import datetime

class VeiculacaoView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")

        ctk.CTkLabel(self, text="Cadastro de Veiculação", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=10)

        # Produto
        self.produtos = listar_produtos()
        self.produto_var = ctk.StringVar()
        self.produto_combo = ctk.CTkComboBox(self, values=[f"{p.id} - {p.nome}" for p in self.produtos],
                                             variable=self.produto_var)
        self.produto_combo.pack(pady=5)
        self.produto_combo.set("Selecione o produto")

        # PI
        self.pis = listar_pis()
        self.pi_var = ctk.StringVar()
        self.pi_combo = ctk.CTkComboBox(self, values=[f"{pi.id} - {pi.numero_pi}" for pi in self.pis],
                                        variable=self.pi_var)
        self.pi_combo.pack(pady=5)
        self.pi_combo.set("Selecione o PI")

        # Quantidade
        self.qtd_entry = ctk.CTkEntry(self, placeholder_text="Quantidade")
        self.qtd_entry.pack(pady=5)

        # Desconto
        self.desc_entry = ctk.CTkEntry(self, placeholder_text="Desconto (em reais)")
        self.desc_entry.pack(pady=5)

        # Data
        self.data_entry = ctk.CTkEntry(self, placeholder_text="Data da veiculação (dd/mm/aaaa)")
        self.data_entry.pack(pady=5)

        # Botão
        ctk.CTkButton(self, text="Cadastrar Veiculação", command=self.cadastrar).pack(pady=10)

        # Lista
        ctk.CTkLabel(self, text="Veiculações cadastradas:").pack(pady=10)
        self.lista = ctk.CTkTextbox(self, width=550, height=200)
        self.lista.pack()
        self.atualizar_lista()

    def cadastrar(self):
        try:
            produto_id = int(self.produto_var.get().split(" - ")[0])
            pi_id = int(self.pi_var.get().split(" - ")[0])
            quantidade = int(self.qtd_entry.get())
            desconto = float(self.desc_entry.get())
            data = datetime.strptime(self.data_entry.get(), "%d/%m/%Y").date()

            criar_veiculacao(produto_id, quantidade, desconto, data, pi_id)
            messagebox.showinfo("Sucesso", "Veiculação cadastrada com sucesso!")

            self.qtd_entry.delete(0, "end")
            self.desc_entry.delete(0, "end")
            self.data_entry.delete(0, "end")
            self.atualizar_lista()

        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao cadastrar: {e}")

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")
        veiculacoes = listar_veiculacoes()
        for v in veiculacoes:
            valor_total = (v.produto.valor_unitario * v.quantidade) - v.desconto_aplicado
            self.lista.insert("end", f"{v.id} | Produto: {v.produto.nome} | PI: {v.pi.numero_pi} | "
                                     f"Qtd: {v.quantidade} | R$ {valor_total:.2f} | Data: {v.data_veiculacao}\n")
