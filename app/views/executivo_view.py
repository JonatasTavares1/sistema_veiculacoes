import customtkinter as ctk
from tkinter import messagebox
from tkinter import ttk
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
                                                          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
                                            width=250)
        self.mes_combobox.set("Selecione um mês")
        self.mes_combobox.pack(pady=10)

        # Campo de Entrada para Executivo
        ctk.CTkLabel(self, text="Digite o nome do Executivo:", font=ctk.CTkFont(size=14)).pack(pady=5)
        self.executivo_entry = ctk.CTkEntry(self, placeholder_text="Nome do Executivo", width=250)
        self.executivo_entry.pack(pady=10)

        # Botão para buscar PIs do Executivo
        ctk.CTkButton(self, text="Buscar Vendas por Executivo", command=self.buscar_vendas_exec).pack(pady=15)

        # Lista de PIs encontrados do Executivo
        self.lista_pis_exec = ctk.CTkTextbox(self, width=550, height=300)
        self.lista_pis_exec.pack(pady=15)

    def buscar_vendas_exec(self):
        # Limpar lista anterior
        self.lista_pis_exec.delete("1.0", "end")

        # Recuperar o nome do executivo da entrada
        executivo = self.executivo_entry.get().strip()
        mes = self.mes_combobox.get()

        if not executivo:
            messagebox.showerror("Erro", "Por favor, insira o nome de um executivo.")
            return

        # Verificar se o mês foi selecionado
        if mes == "Selecione um mês":
            messagebox.showerror("Erro", "Por favor, selecione um mês.")
            return

        # Buscar PIs do executivo
        pis_exec = listar_pis_por_executivo(executivo)

        if pis_exec:
            for pi in pis_exec:
                # Mostrar PI e vendas filtrados
                self.lista_pis_exec.insert("end", f"{pi.id} | {pi.numero_pi} | {pi.cliente} | {pi.data_emissao} | "
                                                  f"R$ {pi.valor_total:.2f}\n")
        else:
            self.lista_pis_exec.insert("end", "Nenhum PI encontrado para esse executivo.")
