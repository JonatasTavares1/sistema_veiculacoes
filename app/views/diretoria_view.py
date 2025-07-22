import customtkinter as ctk
from tkinter import messagebox
from controllers.pi_controller import listar_pis_por_diretoria

class DiretoriaView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        # Título
        ctk.CTkLabel(self, text="Vendas por Diretoria", font=ctk.CTkFont(size=24, weight="bold")).pack(pady=15)

        # Filtro por Mês
        ctk.CTkLabel(self, text="Selecione o mês:", font=ctk.CTkFont(size=14)).pack(pady=5)
        self.mes_combobox = ctk.CTkComboBox(self, values=["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                                                          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
                                            width=250)
        self.mes_combobox.set("Selecione um mês")
        self.mes_combobox.pack(pady=10)

        # Campo de Entrada para Diretoria
        ctk.CTkLabel(self, text="Digite o nome da Diretoria:", font=ctk.CTkFont(size=14)).pack(pady=5)
        self.diretoria_entry = ctk.CTkEntry(self, placeholder_text="Nome da Diretoria", width=250)
        self.diretoria_entry.pack(pady=10)

        # Botão para buscar PIs da Diretoria
        ctk.CTkButton(self, text="Buscar Vendas por Diretoria", command=self.buscar_vendas_diretoria).pack(pady=15)

        # Lista de PIs encontrados da Diretoria
        self.lista_pis_diretoria = ctk.CTkTextbox(self, width=550, height=300)
        self.lista_pis_diretoria.pack(pady=15)

    def buscar_vendas_diretoria(self):
        # Limpar lista anterior
        self.lista_pis_diretoria.delete("1.0", "end")

        # Recuperar o nome da diretoria da entrada
        diretoria = self.diretoria_entry.get().strip()
        mes = self.mes_combobox.get()

        if not diretoria:
            messagebox.showerror("Erro", "Por favor, insira o nome de uma diretoria.")
            return

        # Verificar se o mês foi selecionado
        if mes == "Selecione um mês":
            messagebox.showerror("Erro", "Por favor, selecione um mês.")
            return

        # Buscar PIs da diretoria
        pis_diretoria = listar_pis_por_diretoria(diretoria)

        if pis_diretoria:
            for pi in pis_diretoria:
                # Mostrar PI e vendas filtrados
                self.lista_pis_diretoria.insert("end", f"{pi.id} | {pi.numero_pi} | {pi.cliente} | {pi.data_emissao} | "
                                                      f"R$ {pi.valor_total:.2f}\n")
        else:
            self.lista_pis_diretoria.insert("end", "Nenhum PI encontrado para essa diretoria.")

