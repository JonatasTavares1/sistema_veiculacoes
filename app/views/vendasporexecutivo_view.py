import customtkinter as ctk
from tkinter import messagebox
from controllers.pi_controller import listar_pis_por_executivo
from datetime import datetime

class ExecutivoView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        # Título
        ctk.CTkLabel(self, text="Vendas por Executivo", font=ctk.CTkFont(size=24, weight="bold")).pack(pady=15)

        # Filtro por Mês
        ctk.CTkLabel(self, text="Selecione o mês:", font=ctk.CTkFont(size=14)).pack(pady=5)
        self.mes_combobox = ctk.CTkComboBox(self, values=["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                                                          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"], width=250)
        self.mes_combobox.set("Selecione um mês")
        self.mes_combobox.pack(pady=10)

        # Filtro por Ano
        ctk.CTkLabel(self, text="Selecione o ano:", font=ctk.CTkFont(size=14)).pack(pady=5)
        self.ano_combobox = ctk.CTkComboBox(self, values=["2023", "2024", "2025", "2026"], width=250)
        self.ano_combobox.set("Selecione o ano")
        self.ano_combobox.pack(pady=10)

        # Filtro por Executivo (lista de executivos fornecida)
        ctk.CTkLabel(self, text="Selecione o Executivo:", font=ctk.CTkFont(size=14)).pack(pady=5)
        self.executivo_combobox = ctk.CTkComboBox(self, values=[
            "Rafale e Francio", "Rafael Rodrigo", "Rodrigo da Silva", "Juliana Madazio", "Flavio de Paula", 
            "Lorena Fernandes", "Henri Marques", "Caio Bruno", "Flavia Cabral", "Paula Caroline", 
            "Leila Santos", "Jessica Ribeiro", "Paula Campos"
        ], width=250)
        self.executivo_combobox.set("Selecione o Executivo")
        self.executivo_combobox.pack(pady=10)

        # Filtro por Diretoria (lista de diretorias fornecida)
        ctk.CTkLabel(self, text="Selecione a Diretoria:", font=ctk.CTkFont(size=14)).pack(pady=5)
        self.diretoria_combobox = ctk.CTkComboBox(self, values=["Governo Federal", "Governo Estadual", "Rafael Augusto"], width=250)
        self.diretoria_combobox.set("Selecione a Diretoria")
        self.diretoria_combobox.pack(pady=10)

        # Botão para buscar PIs do Executivo
        ctk.CTkButton(self, text="Buscar Vendas por Executivo", command=self.buscar_vendas_exec).pack(pady=15)

        # Tabela para mostrar os PIs encontrados do Executivo
        self.tabela_frame = ctk.CTkFrame(self)
        self.tabela_frame.pack(pady=15)

        # Criar tabela com cabeçalhos
        self.criar_tabela()

        # Exibir valor total e quantidade
        self.resultados_label = ctk.CTkLabel(self, text="Valor Total: R$ 0.00 | Quantidade de PIs: 0", font=ctk.CTkFont(size=14))
        self.resultados_label.pack(pady=10)

    def buscar_vendas_exec(self):
        # Limpar tabela anterior
        for widget in self.tabela_frame.winfo_children():
            widget.destroy()

        # Recuperar os dados do filtro
        mes = self.mes_combobox.get()
        ano = self.ano_combobox.get()
        executivo = self.executivo_combobox.get()
        diretoria = self.diretoria_combobox.get()

        # Verificar se todos os filtros foram selecionados
        if mes == "Selecione um mês" or ano == "Selecione o ano" or executivo == "Selecione o Executivo" or diretoria == "Selecione a Diretoria":
            messagebox.showerror("Erro", "Por favor, selecione todos os filtros.")
            return

        # Buscar PIs do executivo
        pis_exec = listar_pis_por_executivo(executivo)

        if pis_exec:
            total_valor = 0
            for pi in pis_exec:
                self.adicionar_linha_tabela(pi)
                total_valor += pi.valor_total

            # Atualizar informações de valor total e quantidade de PIs
            quantidade_pis = len(pis_exec)
            self.resultados_label.config(text=f"Valor Total: R$ {total_valor:.2f} | Quantidade de PIs: {quantidade_pis}")
        else:
            messagebox.showinfo("Informação", "Nenhum PI encontrado para esse executivo.")

    def criar_tabela(self):
        # Criando o cabeçalho da tabela
        cabecalho = ["ID", "Número PI", "Cliente", "Data Emissão", "Valor Total"]
        for i, texto in enumerate(cabecalho):
            ctk.CTkLabel(self.tabela_frame, text=texto, font=ctk.CTkFont(size=12, weight="bold")).grid(row=0, column=i, padx=5, pady=5)

    def adicionar_linha_tabela(self, pi):
        # Adicionando uma linha na tabela
        ctk.CTkLabel(self.tabela_frame, text=pi.id).grid(row=self.tabela_frame.grid_size()[1], column=0, padx=5, pady=5)
        ctk.CTkLabel(self.tabela_frame, text=pi.numero_pi).grid(row=self.tabela_frame.grid_size()[1], column=1, padx=5, pady=5)
        ctk.CTkLabel(self.tabela_frame, text=pi.cliente).grid(row=self.tabela_frame.grid_size()[1], column=2, padx=5, pady=5)
        ctk.CTkLabel(self.tabela_frame, text=pi.data_emissao).grid(row=self.tabela_frame.grid_size()[1], column=3, padx=5, pady=5)
        ctk.CTkLabel(self.tabela_frame, text=f"R$ {pi.valor_total:.2f}").grid(row=self.tabela_frame.grid_size()[1], column=4, padx=5, pady=5)
