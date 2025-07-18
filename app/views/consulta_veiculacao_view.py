import customtkinter as ctk
from controllers.veiculacao_controller import listar_veiculacoes

class ConsultaVeiculacaoView(ctk.CTkFrame):
    def __init__(self, master):
        super().__init__(master)
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")

        

        # Título
        titulo = ctk.CTkLabel(self, text="📋 Veiculações Cadastradas", font=ctk.CTkFont(size=24, weight="bold"))
        titulo.pack(pady=(0, 15))

        # Caixa com Scroll
        self.text_frame = ctk.CTkFrame(self)
        self.text_frame.pack(fill="both", expand=True)

        self.lista = ctk.CTkTextbox(self.text_frame, width=700, height=400, wrap="none", corner_radius=8)
        self.lista.pack(side="left", fill="both", expand=True)

        self.scrollbar = ctk.CTkScrollbar(self.text_frame, orientation="vertical", command=self.lista.yview)
        self.scrollbar.pack(side="right", fill="y")

        self.lista.configure(yscrollcommand=self.scrollbar.set)

        # Botão Atualizar
        ctk.CTkButton(self, text="🔄 Atualizar Lista", command=self.atualizar_lista).pack(pady=15)

        self.atualizar_lista()

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")
        veiculacoes = listar_veiculacoes()

        if not veiculacoes:
            self.lista.insert("end", "Nenhuma veiculação encontrada.\n")
            return

        for v in veiculacoes:
            valor_total = (v.produto.valor_unitario * v.quantidade) - v.desconto_aplicado
            linha = (
                f"🆔 ID: {v.id}\n"
                f"📦 Produto: {v.produto.nome}\n"
                f"🧾 PI: {v.pi.numero_pi}\n"
                f"🔢 Quantidade: {v.quantidade}\n"
                f"💸 Desconto: R$ {v.desconto_aplicado:.2f}\n"
                f"💰 Total: R$ {valor_total:.2f}\n"
                f"📅 Data: {v.data_veiculacao}\n"
                f"{'-'*60}\n"
            )
            self.lista.insert("end", linha)
