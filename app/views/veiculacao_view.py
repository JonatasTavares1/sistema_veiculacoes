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
        self.configure(padx=30, pady=20)

        ctk.CTkLabel(self, text="📡 Cadastro de Veiculação", font=ctk.CTkFont(size=22, weight="bold")).pack(pady=10)

        # Produto
        self.produtos = listar_produtos()
        self.produto_var = ctk.StringVar()
        self.produto_combo = ctk.CTkComboBox(self, width=400, values=[f"{p.id} - {p.nome}" for p in self.produtos],
                                             variable=self.produto_var)
        self.produto_combo.pack(pady=6)
        self.produto_combo.set("Selecione o produto")

        # PI
        self.pis = listar_pis()
        self.pi_var = ctk.StringVar()
        self.pi_combo = ctk.CTkComboBox(self, width=400, values=[f"{pi.id} - {pi.numero_pi}" for pi in self.pis],
                                        variable=self.pi_var)
        self.pi_combo.pack(pady=6)
        self.pi_combo.set("Selecione o PI")

        # Quantidade
        self.qtd_entry = ctk.CTkEntry(self, placeholder_text="Quantidade", width=400)
        self.qtd_entry.pack(pady=6)

        # Desconto
        self.desc_entry = ctk.CTkEntry(self, placeholder_text="Desconto (em reais)", width=400)
        self.desc_entry.pack(pady=6)

        # Data
        self.data_entry = ctk.CTkEntry(self, placeholder_text="Data da veiculação (dd/mm/aaaa)", width=400)
        self.data_entry.pack(pady=6)

        # Botão de cadastro
        ctk.CTkButton(self, text="💾 Cadastrar Veiculação", command=self.cadastrar, height=40).pack(pady=12)

        # Título da lista
        ctk.CTkLabel(self, text="🧾 Veiculações cadastradas:", font=ctk.CTkFont(size=16)).pack(pady=(15, 5))

        # Lista com scroll
        self.text_frame = ctk.CTkFrame(self)
        self.text_frame.pack()

        self.lista = ctk.CTkTextbox(self.text_frame, width=560, height=230, corner_radius=8)
        self.lista.pack(side="left", fill="both", expand=True)

        self.scrollbar = ctk.CTkScrollbar(self.text_frame, orientation="vertical", command=self.lista.yview)
        self.scrollbar.pack(side="right", fill="y")
        self.lista.configure(yscrollcommand=self.scrollbar.set)

        self.atualizar_lista()

    def cadastrar(self):
        try:
            produto_id = int(self.produto_var.get().split(" - ")[0])
            pi_id = int(self.pi_var.get().split(" - ")[0])
            quantidade = int(self.qtd_entry.get())
            desconto = float(self.desc_entry.get().replace(",", "."))
            data = datetime.strptime(self.data_entry.get(), "%d/%m/%Y").date()

            criar_veiculacao(produto_id, quantidade, desconto, data, pi_id)
            messagebox.showinfo("✅ Sucesso", "Veiculação cadastrada com sucesso!")

            self.qtd_entry.delete(0, "end")
            self.desc_entry.delete(0, "end")
            self.data_entry.delete(0, "end")
            self.atualizar_lista()

        except ValueError:
            messagebox.showerror("Erro", "Preencha todos os campos corretamente.")
        except Exception as e:
            messagebox.showerror("Erro inesperado", f"Erro ao cadastrar: {e}")

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")
        veiculacoes = listar_veiculacoes()
        if not veiculacoes:
            self.lista.insert("end", "Nenhuma veiculação cadastrada.\n")
            return

        for v in veiculacoes:
            valor_total = (v.produto.valor_unitario * v.quantidade) - v.desconto_aplicado
            self.lista.insert(
                "end",
                f"📌 ID {v.id} | Produto: {v.produto.nome} | PI: {v.pi.numero_pi} | "
                f"Qtd: {v.quantidade} | R$ {valor_total:.2f} | Data: {v.data_veiculacao.strftime('%d/%m/%Y')}\n"
            )
