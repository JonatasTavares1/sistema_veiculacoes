import customtkinter as ctk
from tkinter import messagebox, filedialog
from controllers.executivo_controller import listar_executivos, buscar_por_executivo
import pandas as pd

class ExecutivoView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.executivo_selecionado = None
        self.tipo = ctk.StringVar(value="Agência")
        self.resultados_atuais = []  # Armazena os resultados da última busca

        # Título
        ctk.CTkLabel(self, text="🔎 Buscar por Executivo", font=ctk.CTkFont(size=22, weight="bold")).grid(row=0, column=0, columnspan=4, pady=(20, 10))

        # Dropdown de Executivos
        self.executivos = listar_executivos()
        self.executivo_dropdown = ctk.CTkOptionMenu(self, values=self.executivos, width=300, command=self.definir_executivo)
        self.executivo_dropdown.grid(row=1, column=0, padx=(20, 10), pady=10, sticky="ew")

        # Seletor de tipo (Agência ou Anunciante)
        self.tipo_dropdown = ctk.CTkOptionMenu(self, values=["Agência", "Anunciante"], variable=self.tipo)
        self.tipo_dropdown.grid(row=1, column=1, padx=(10, 10), pady=10)

        # Botão de Buscar
        ctk.CTkButton(self, text="Buscar", command=self.buscar).grid(row=1, column=2, padx=(10, 10), pady=10)

        # Botão de Exportar Excel
        ctk.CTkButton(self, text="📁 Exportar Excel", command=self.exportar_para_excel).grid(row=1, column=3, padx=(10, 20), pady=10)

        # Tabela
        self.tabela_frame = ctk.CTkScrollableFrame(self)
        self.tabela_frame.grid(row=2, column=0, columnspan=4, padx=20, pady=20, sticky="nsew")

    def definir_executivo(self, nome):
        self.executivo_selecionado = nome

    def buscar(self):
        if not self.executivo_selecionado:
            messagebox.showwarning("Atenção", "Selecione um executivo.")
            return

        for widget in self.tabela_frame.winfo_children():
            widget.destroy()

        self.resultados_atuais = buscar_por_executivo(self.executivo_selecionado, self.tipo.get())

        if not self.resultados_atuais:
            ctk.CTkLabel(self.tabela_frame, text="Nenhum resultado encontrado.").pack(pady=10)
            return

        # Cabeçalho
        colunas = self.resultados_atuais[0].keys()
        header_frame = ctk.CTkFrame(self.tabela_frame)
        header_frame.pack(fill="x", padx=5, pady=(0, 5))
        for col in colunas:
            ctk.CTkLabel(header_frame, text=col, width=150, anchor="w").pack(side="left", padx=5)

        # Dados
        for item in self.resultados_atuais:
            row_frame = ctk.CTkFrame(self.tabela_frame)
            row_frame.pack(fill="x", padx=5, pady=2)
            for val in item.values():
                ctk.CTkLabel(row_frame, text=str(val), width=150, anchor="w").pack(side="left", padx=5)

    def exportar_para_excel(self):
        if not self.resultados_atuais:
            messagebox.showwarning("Atenção", "Nenhum dado para exportar.")
            return

        df = pd.DataFrame(self.resultados_atuais)
        tipo_str = self.tipo.get().lower()
        nome_arquivo = f"{self.executivo_selecionado}_{tipo_str}.xlsx".replace(" ", "_")

        caminho = filedialog.asksaveasfilename(defaultextension=".xlsx", initialfile=nome_arquivo,
                                               filetypes=[("Excel files", "*.xlsx")])
        if caminho:
            try:
                df.to_excel(caminho, index=False)
                messagebox.showinfo("Sucesso", f"Arquivo salvo com sucesso em:\n{caminho}")
            except Exception as e:
                messagebox.showerror("Erro", f"Erro ao salvar o arquivo:\n{e}")
