import customtkinter as ctk
from tkinter import messagebox
from controllers.pi_matriz_controller import listar_pis_matriz, listar_pis_vinculados, calcular_saldo_matriz

class PIMatrizView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        ctk.CTkLabel(self, text="🔗 Visualização de PIs Matriz", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=10)

        self.lista = ctk.CTkTextbox(self, width=900, height=600)
        self.lista.pack(padx=20, pady=10)

        self.atualizar_lista()

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")
        for pi in listar_pis_matriz():
            filhos = listar_pis_vinculados(pi.numero_pi)
            saldo = calcular_saldo_matriz(pi.numero_pi)
            self.lista.insert(
                "end",
                f"🔸 Matriz: {pi.numero_pi} | Campanha: {pi.nome_campanha or '---'} | Valor: R$ {pi.valor_bruto or 0:.2f} | "
                f"Saldo: R$ {saldo:.2f} | PIs Vinculados: {len(filhos)}\n"
            )
