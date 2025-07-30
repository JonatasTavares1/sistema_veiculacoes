import customtkinter as ctk
from tkinter import messagebox
from controllers.pi_matriz_controller import listar_pis_matriz, listar_pis_vinculados, calcular_saldo_matriz

class PIMatrizView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.configure(fg_color="#1a1a1a")  # Fundo escuro

        # Título
        titulo = ctk.CTkLabel(
            self,
            text="🔗 Visualização de PIs Matriz",
            font=ctk.CTkFont(size=22, weight="bold"),
            text_color="white"
        )
        titulo.pack(pady=15)

        # Botão atualizar
        atualizar_btn = ctk.CTkButton(
            self,
            text="🔄 Atualizar Lista",
            fg_color="red",
            hover_color="#b30000",
            text_color="white",
            command=self.atualizar_lista,
            corner_radius=8
        )
        atualizar_btn.pack(pady=5)

        # Caixa scrollável para lista
        self.lista = ctk.CTkTextbox(
            self,
            width=1000,
            height=600,
            font=ctk.CTkFont(size=14),
            text_color="#ffffff",
            fg_color="#2a2a2a",
            scrollbar_button_color="red",
            scrollbar_button_hover_color="#b30000"
        )
        self.lista.pack(padx=20, pady=15, fill="both", expand=True)

        self.atualizar_lista()

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")

        pis_matriz = listar_pis_matriz()
        if not pis_matriz:
            self.lista.insert("end", "⚠️ Nenhum PI do tipo MATRIZ encontrado.\n")
            return

        for pi in pis_matriz:
            filhos = listar_pis_vinculados(pi.numero_pi)
            saldo = calcular_saldo_matriz(pi.numero_pi)

            self.lista.insert(
                "end",
                f"🔴 PI MATRIZ: {pi.numero_pi}\n"
                f"📢 Campanha: {pi.nome_campanha or '---'}\n"
                f"💰 Valor Bruto: R$ {pi.valor_bruto or 0:.2f}\n"
                f"📉 Saldo Restante: R$ {saldo:.2f}\n"
                f"🧩 PIs Vinculados: {len(filhos)}\n"
                "----------------------------------------------\n"
            )
