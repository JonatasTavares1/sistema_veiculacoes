import customtkinter as ctk
from tkinter import messagebox, filedialog
from controllers.executivo_controller import listar_executivos, buscar_por_executivo, editar_registro
import pandas as pd

class ExecutivoView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.grid_rowconfigure(6, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.executivo_selecionado = None
        self.tipo = ctk.StringVar(value="Agência")
        self.resultados_atuais = []

        # Título
        ctk.CTkLabel(self, text="🔎 Buscar por Executivo", font=ctk.CTkFont(size=22, weight="bold")).grid(
            row=0, column=0, columnspan=5, pady=(20, 10)
        )

        # Filtros
        self.executivos = listar_executivos()
        self.executivo_dropdown = ctk.CTkOptionMenu(self, values=self.executivos, width=300, command=self.definir_executivo)
        self.executivo_dropdown.grid(row=1, column=0, padx=10, pady=10, sticky="ew")

        self.tipo_dropdown = ctk.CTkOptionMenu(self, values=["Agência", "Anunciante"], variable=self.tipo)
        self.tipo_dropdown.grid(row=1, column=1, padx=10, pady=10)

        ctk.CTkButton(self, text="🔍 Buscar", command=self.buscar).grid(row=1, column=2, padx=10, pady=10)
        ctk.CTkButton(self, text="📁 Exportar Excel", command=self.exportar_para_excel).grid(row=1, column=3, padx=10, pady=10)

        # Botão Ver Todos
        ctk.CTkButton(self, text="👁 Ver Todos", command=self.ver_todos).grid(
            row=2, column=0, columnspan=5, padx=20, pady=(0, 10)
        )

        # Tabela de resultados
        self.tabela_frame = ctk.CTkScrollableFrame(self, height=400)
        self.tabela_frame.grid(row=6, column=0, columnspan=5, padx=20, pady=20, sticky="nsew")

    def definir_executivo(self, nome):
        self.executivo_selecionado = nome

    def buscar(self):
        if not self.executivo_selecionado:
            messagebox.showwarning("Atenção", "Selecione um executivo.")
            return
        self.exibir_resultados(buscar_por_executivo(self.executivo_selecionado, self.tipo.get()))

    def ver_todos(self):
        self.exibir_resultados(buscar_por_executivo(None, self.tipo.get()))

    def exibir_resultados(self, resultados):
        for widget in self.tabela_frame.winfo_children():
            widget.destroy()

        self.resultados_atuais = resultados

        if not self.resultados_atuais:
            ctk.CTkLabel(self.tabela_frame, text="Nenhum resultado encontrado.").grid(row=0, column=0, pady=10)
            return

        colunas = list(self.resultados_atuais[0].keys()) + ["Ações"]

        for idx, col in enumerate(colunas):
            ctk.CTkLabel(self.tabela_frame, text=col, text_color="white", width=150, anchor="w", font=ctk.CTkFont(weight="bold")).grid(row=0, column=idx, padx=5, pady=5, sticky="w")

        for r_idx, item in enumerate(self.resultados_atuais, start=1):
            for c_idx, (key, val) in enumerate(item.items()):
                ctk.CTkLabel(self.tabela_frame, text=str(val), width=150, anchor="w").grid(row=r_idx, column=c_idx, padx=5, pady=2, sticky="w")

            botoes_frame = ctk.CTkFrame(self.tabela_frame, fg_color="transparent")
            botoes_frame.grid(row=r_idx, column=len(colunas)-1, padx=5, pady=2, sticky="w")

            ctk.CTkButton(botoes_frame, text="✏️", width=40, command=lambda i=item: self.editar(i)).pack(side="left", padx=2)
            ctk.CTkButton(botoes_frame, text="🗑️", width=40, command=lambda i=item: self.excluir(i)).pack(side="left", padx=2)

    def exportar_para_excel(self):
        if not self.resultados_atuais:
            messagebox.showwarning("Atenção", "Nenhum dado para exportar.")
            return

        df = pd.DataFrame(self.resultados_atuais)
        tipo_str = self.tipo.get().lower()
        nome_arquivo = f"{self.executivo_selecionado or 'todos'}_{tipo_str}.xlsx".replace(" ", "_")

        caminho = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            initialfile=nome_arquivo,
            filetypes=[("Excel files", "*.xlsx")]
        )
        if caminho:
            try:
                df.to_excel(caminho, index=False)
                messagebox.showinfo("Sucesso", f"Arquivo salvo com sucesso em:\n{caminho}")
            except Exception as e:
                messagebox.showerror("Erro", f"Erro ao salvar o arquivo:\n{e}")

    def editar(self, item):
        popup = ctk.CTkToplevel(self)
        popup.title("Editar Registro")
        popup.geometry("500x400")

        campos = {}
        for i, (chave, valor) in enumerate(item.items()):
            if chave == "ID": continue
            ctk.CTkLabel(popup, text=chave).grid(row=i, column=0, padx=10, pady=10, sticky="w")
            entrada = ctk.CTkEntry(popup, width=300)
            entrada.insert(0, str(valor))
            entrada.grid(row=i, column=1, padx=10, pady=10, sticky="w")
            campos[chave] = entrada

        def salvar():
            novos_dados = {chave: campos[chave].get() for chave in campos}
            sucesso = editar_registro(self.tipo.get(), item["ID"], novos_dados)
            if sucesso:
                messagebox.showinfo("Sucesso", "Registro atualizado com sucesso!")
                popup.destroy()
                self.buscar()
            else:
                messagebox.showerror("Erro", "Erro ao atualizar o registro.")

        ctk.CTkButton(popup, text="Salvar", command=salvar).grid(row=len(campos)+1, column=0, columnspan=2, pady=20)

    def excluir(self, item):
        confirm = messagebox.askyesno("Confirmar exclusão", f"Deseja excluir o registro:\n{item}?")
        if confirm:
            messagebox.showinfo("Remoção", f"Registro removido com sucesso (simulado).")
