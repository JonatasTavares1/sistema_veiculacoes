import customtkinter as ctk
from controllers.pi_controller import listar_pis

class PIsCadastradosView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        # Título
        ctk.CTkLabel(self, text="PIs Cadastrados", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=15)

        # Lista de PIs Cadastrados
        ctk.CTkLabel(self, text="PIs cadastrados:", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=10)
        
        # Caixa de texto para exibição dos PIs
        self.lista_pis = ctk.CTkTextbox(self, width=550, height=300)
        self.lista_pis.pack(pady=15)
        
        self.atualizar_lista()

    def atualizar_lista(self):
        """ Atualiza a lista de PIs cadastrados na tela """
        self.lista_pis.delete("1.0", "end")
        for pi in listar_pis():
            self.lista_pis.insert("end", f"{pi.id} | {pi.numero_pi} | {pi.cliente} | {pi.data_emissao} | R$ {pi.valor_total:.2f}\n")
