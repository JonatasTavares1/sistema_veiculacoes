# app/views/executivo_view.py
import customtkinter as ctk
from controllers.executivo_controller import listar_executivos, buscar_por_executivo

class ExecutivoView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.grid(row=0, column=0, sticky="nsew", padx=20, pady=20)

        ctk.CTkLabel(self, text="🔎 Consulta por Executivo", font=ctk.CTkFont(size=22, weight="bold")).grid(row=0, column=0, columnspan=2, pady=10)

        self.executivo_combo = ctk.CTkComboBox(self, values=listar_executivos(), width=300)
        self.executivo_combo.grid(row=1, column=0, pady=10, sticky="w")

        ctk.CTkButton(self, text="Buscar", command=self.buscar_dados).grid(row=1, column=1, padx=10)

        self.resultado_texto = ctk.CTkTextbox(self, width=700, height=400)
        self.resultado_texto.grid(row=2, column=0, columnspan=2, pady=20)

    def buscar_dados(self):
        nome = self.executivo_combo.get()
        agencias, anunciantes = buscar_por_executivo(nome)

        self.resultado_texto.delete("1.0", "end")
        self.resultado_texto.insert("end", f"👨‍💼 Executivo: {nome}\n\n")

        self.resultado_texto.insert("end", "🏢 Agências:\n")
        if agencias:
            for a in agencias:
                self.resultado_texto.insert("end", f" - {a.nome_agencia} | CNPJ: {a.cnpj_agencia} | UF: {a.uf_agencia}\n")
        else:
            self.resultado_texto.insert("end", " - Nenhuma agência vinculada.\n")

        self.resultado_texto.insert("end", "\n🧾 Anunciantes:\n")
        if anunciantes:
            for an in anunciantes:
                self.resultado_texto.insert("end", f" - {an.nome_anunciante} | CNPJ: {an.cnpj_anunciante} | UF: {an.uf_cliente}\n")
        else:
            self.resultado_texto.insert("end", " - Nenhum anunciante vinculado.\n")
