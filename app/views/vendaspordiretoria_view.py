import customtkinter as ctk
from tkinter import messagebox, filedialog
from controllers.pi_controller import listar_pis_por_diretoria
import pandas as pd
from datetime import datetime
import matplotlib.pyplot as plt

MESES = {
    "Janeiro": 1, "Fevereiro": 2, "Março": 3, "Abril": 4,
    "Maio": 5, "Junho": 6, "Julho": 7, "Agosto": 8,
    "Setembro": 9, "Outubro": 10, "Novembro": 11, "Dezembro": 12
}

DIRETORIAS = [
    "Governo Federal", "Governo Estadual", "Rafael Augusto"
]

class VendasDiretoriaView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)
        self.pis_encontrados = []

        ctk.CTkLabel(self, text="📈 Vendas por Diretoria", font=ctk.CTkFont(size=24, weight="bold")).pack(pady=15)

        # Filtros
        filtros_frame = ctk.CTkFrame(self)
        filtros_frame.pack(pady=10)

        self.diretoria_cb = ctk.CTkComboBox(filtros_frame, values=DIRETORIAS, width=200)
        self.diretoria_cb.set("Selecione a Diretoria")
        self.diretoria_cb.grid(row=0, column=0, padx=10, pady=5)

        self.mes_cb = ctk.CTkComboBox(filtros_frame, values=list(MESES.keys()), width=140)
        self.mes_cb.set("Mês")
        self.mes_cb.grid(row=0, column=1, padx=10, pady=5)

        self.ano_entry = ctk.CTkEntry(filtros_frame, placeholder_text="Ano", width=100)
        self.ano_entry.grid(row=0, column=2, padx=10, pady=5)

        self.dia_ini_entry = ctk.CTkEntry(filtros_frame, placeholder_text="Dia Início", width=100)
        self.dia_ini_entry.grid(row=0, column=3, padx=10, pady=5)

        self.dia_fim_entry = ctk.CTkEntry(filtros_frame, placeholder_text="Dia Fim", width=100)
        self.dia_fim_entry.grid(row=0, column=4, padx=10, pady=5)

        ctk.CTkButton(filtros_frame, text="Buscar", command=self.buscar_pis).grid(row=0, column=5, padx=10, pady=5)

        # Botões
        botoes_frame = ctk.CTkFrame(self)
        botoes_frame.pack(pady=10)

        ctk.CTkButton(botoes_frame, text="Exportar para Excel", command=self.exportar_excel).pack(side="left", padx=20)
        ctk.CTkButton(botoes_frame, text="Ver Gráfico", command=self.gerar_grafico).pack(side="left", padx=20)

    def buscar_pis(self):
        diretoria = self.diretoria_cb.get()
        mes = self.mes_cb.get()
        ano = self.ano_entry.get()
        dia_inicio = self.dia_ini_entry.get()
        dia_fim = self.dia_fim_entry.get()

        if not (diretoria and mes and ano and dia_inicio and dia_fim):
            messagebox.showwarning("Campos obrigatórios", "Preencha todos os filtros.")
            return

        try:
            mes_num = MESES[mes]
            ano_int = int(ano)
            dia_ini = int(dia_inicio)
            dia_fim = int(dia_fim)
        except:
            messagebox.showerror("Erro", "Verifique os valores de mês, ano e dias.")
            return

        self.pis_encontrados = listar_pis_por_diretoria(
            diretoria, mes_num, ano_int, dia_ini, dia_fim
        )

        if not self.pis_encontrados:
            messagebox.showinfo("Nenhum resultado", "Nenhum PI encontrado para os filtros selecionados.")
        else:
            messagebox.showinfo("Busca concluída", f"{len(self.pis_encontrados)} PI(s) encontrados.")

    def exportar_excel(self):
        if not self.pis_encontrados:
            messagebox.showwarning("Sem dados", "Realize uma busca primeiro.")
            return

        caminho = filedialog.asksaveasfilename(defaultextension=".xlsx", filetypes=[("Excel", "*.xlsx")])
        if not caminho:
            return

        df = pd.DataFrame(self.pis_encontrados)
        df.to_excel(caminho, index=False)
        messagebox.showinfo("Exportado", f"Arquivo salvo em: {caminho}")

    def gerar_grafico(self):
        if not self.pis_encontrados:
            messagebox.showwarning("Sem dados", "Realize uma busca primeiro.")
            return

        df = pd.DataFrame(self.pis_encontrados)
        if "dia_venda" not in df.columns or "valor_bruto" not in df.columns:
            messagebox.showerror("Erro", "Dados insuficientes para gerar gráfico.")
            return

        df_grouped = df.groupby("dia_venda")["valor_bruto"].sum().reset_index()

        plt.figure(figsize=(10, 5))
        plt.bar(df_grouped["dia_venda"], df_grouped["valor_bruto"], color="skyblue")
        plt.title("Valor Bruto por Dia")
        plt.xlabel("Dia da Venda")
        plt.ylabel("Valor Bruto (R$)")
        plt.grid(True)
        plt.tight_layout()
        plt.show()
