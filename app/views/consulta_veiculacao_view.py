import customtkinter as ctk
from controllers.veiculacao_controller import listar_veiculacoes

class ConsultaVeiculacaoView(ctk.CTkFrame):
    def __init__(self, master):
        super().__init__(master)

        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")

        ctk.CTkLabel(self, text="Veiculações Cadastradas", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=10)

        self.lista = ctk.CTkTextbox(self, width=600, height=400)
        self.lista.pack(pady=10)

        ctk.CTkButton(self, text="Atualizar", command=self.atualizar_lista).pack(pady=10)

        self.atualizar_lista()

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")
        veiculacoes = listar_veiculacoes()
        for v in veiculacoes:
            valor_total = (v.produto.valor_unitario * v.quantidade) - v.desconto_aplicado
            linha = (
                f"ID {v.id} | Produto: {v.produto.nome} | PI: {v.pi.numero_pi} | "
                f"Qtd: {v.quantidade} | Desconto: R$ {v.desconto_aplicado:.2f} | "
                f"Total: R$ {valor_total:.2f} | Data: {v.data_veiculacao}\n"
            )
            self.lista.insert("end", linha)
