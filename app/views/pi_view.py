import customtkinter as ctk
from tkinter import messagebox
from controllers.pi_controller import criar_pi, listar_pis
from datetime import datetime

class PIView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        # Título
        ctk.CTkLabel(self, text="Cadastro de Pedido de Inserção", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=15)

        # Campos principais
        self.numero_entry = ctk.CTkEntry(self, placeholder_text="Número do PI")
        self.numero_entry.pack(pady=5)

        self.cliente_entry = ctk.CTkEntry(self, placeholder_text="Cliente")
        self.cliente_entry.pack(pady=5)

        self.data_entry = ctk.CTkEntry(self, placeholder_text="Data de Emissão (dd/mm/aaaa)")
        self.data_entry.pack(pady=5)

        self.obs_entry = ctk.CTkEntry(self, placeholder_text="Observações")
        self.obs_entry.pack(pady=5)

        # Campos adicionais
        self.tipo_entry = ctk.CTkEntry(self, placeholder_text="Tipo")
        self.tipo_entry.pack(pady=5)

        self.praca_entry = ctk.CTkEntry(self, placeholder_text="Praça")
        self.praca_entry.pack(pady=5)

        self.meio_entry = ctk.CTkEntry(self, placeholder_text="Meio")
        self.meio_entry.pack(pady=5)

        self.colocacao_entry = ctk.CTkEntry(self, placeholder_text="Colocação")
        self.colocacao_entry.pack(pady=5)

        self.formato_entry = ctk.CTkEntry(self, placeholder_text="Formato")
        self.formato_entry.pack(pady=5)

        self.executivo_entry = ctk.CTkEntry(self, placeholder_text="Executivo")
        self.executivo_entry.pack(pady=5)

        self.diretoria_entry = ctk.CTkEntry(self, placeholder_text="Diretoria")
        self.diretoria_entry.pack(pady=5)

        self.valor_bruto_entry = ctk.CTkEntry(self, placeholder_text="Valor Bruto (ex: 999.90)")
        self.valor_bruto_entry.pack(pady=5)

        # Botão de cadastro
        ctk.CTkButton(self, text="Cadastrar PI", command=self.cadastrar_pi).pack(pady=15)

        # Lista de PIs
        ctk.CTkLabel(self, text="PIs cadastrados:", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=10)
        self.lista_pis = ctk.CTkTextbox(self, width=550, height=200)
        self.lista_pis.pack()
        self.atualizar_lista()

    def cadastrar_pi(self):
        try:
            numero = self.numero_entry.get()
            cliente = self.cliente_entry.get()
            data_str = self.data_entry.get()
            observacoes = self.obs_entry.get()

            tipo = self.tipo_entry.get()
            praca = self.praca_entry.get()
            meio = self.meio_entry.get()
            colocacao = self.colocacao_entry.get()
            formato = self.formato_entry.get()

            executivo = self.executivo_entry.get()
            diretoria = self.diretoria_entry.get()

            valor_bruto = float(self.valor_bruto_entry.get().replace(",", ".") or 0)

            if not numero or not cliente or not data_str:
                messagebox.showerror("Erro", "Preencha os campos obrigatórios.")
                return

            data_emissao = datetime.strptime(data_str, "%d/%m/%Y").date()

            # Criando o PI
            criar_pi(
                numero_pi=numero,
                cliente=cliente,
                data_emissao=data_emissao,
                observacoes=observacoes,
                tipo=tipo,
                praca=praca,
                meio=meio,
                colocacao=colocacao,
                formato=formato,
                executivo=executivo,
                diretoria=diretoria,
                valor_bruto=valor_bruto
            )

            messagebox.showinfo("Sucesso", "PI cadastrada com sucesso!")
            self.limpar_campos()
            self.atualizar_lista()

        except ValueError:
            messagebox.showerror("Erro", "Preencha os valores corretamente.")
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao cadastrar PI: {e}")

    def limpar_campos(self):
        for widget in self.winfo_children():
            if isinstance(widget, ctk.CTkEntry):
                widget.delete(0, "end")

    def atualizar_lista(self):
        self.lista_pis.delete("1.0", "end")
        for pi in listar_pis():
            self.lista_pis.insert(
                "end",
                f"{pi.id} | {pi.numero_pi} | {pi.cliente} | {pi.data_emissao.strftime('%d/%m/%Y')} | R$ {pi.valor_bruto:.2f}\n"
            )
