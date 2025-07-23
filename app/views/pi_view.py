import customtkinter as ctk
from tkinter import messagebox
from controllers.pi_controller import criar_pi, listar_pis
from datetime import datetime

class PIView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.pack(fill="both", expand=True)

        ctk.CTkLabel(self, text="Cadastro de Pedido de Inserção", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=15)

        # Scrollable container para evitar corte de tela
        self.scrollable_frame = ctk.CTkScrollableFrame(self, width=800, height=600)
        self.scrollable_frame.pack(padx=10, pady=10, fill="both", expand=True)

        # Função auxiliar para criar entradas com margem padronizada
        def criar_entry(parent, placeholder):
            entry = ctk.CTkEntry(parent, placeholder_text=placeholder)
            entry.pack(pady=4, padx=20, fill="x")
            return entry

        # Identificação
        self.numero_entry = criar_entry(self.scrollable_frame, "Número do PI")
        self.pi_matriz_entry = criar_entry(self.scrollable_frame, "PI Matriz")

        # Anunciante
        ctk.CTkLabel(self.scrollable_frame, text="Informações do Anunciante", font=ctk.CTkFont(weight="bold")).pack(pady=(10, 2))
        self.nome_anunciante_entry = criar_entry(self.scrollable_frame, "Nome do Anunciante")
        self.razao_anunciante_entry = criar_entry(self.scrollable_frame, "Razão Social do Anunciante")
        self.cnpj_anunciante_entry = criar_entry(self.scrollable_frame, "CNPJ do Anunciante")
        self.uf_cliente_entry = criar_entry(self.scrollable_frame, "UF do Cliente")

        # Agência
        ctk.CTkLabel(self.scrollable_frame, text="Informações da Agência", font=ctk.CTkFont(weight="bold")).pack(pady=(10, 2))
        self.nome_agencia_entry = criar_entry(self.scrollable_frame, "Nome da Agência")
        self.razao_agencia_entry = criar_entry(self.scrollable_frame, "Razão Social da Agência")
        self.cnpj_agencia_entry = criar_entry(self.scrollable_frame, "CNPJ da Agência")
        self.uf_agencia_entry = criar_entry(self.scrollable_frame, "UF da Agência")

        # Campanha
        ctk.CTkLabel(self.scrollable_frame, text="Dados da Campanha", font=ctk.CTkFont(weight="bold")).pack(pady=(10, 2))
        self.nome_campanha_entry = criar_entry(self.scrollable_frame, "Nome da Campanha")
        self.canal_entry = criar_entry(self.scrollable_frame, "Canal")
        self.perfil_entry = criar_entry(self.scrollable_frame, "Perfil do Anunciante")
        self.subperfil_entry = criar_entry(self.scrollable_frame, "Subperfil do Anunciante")

        # Datas
        ctk.CTkLabel(self.scrollable_frame, text="Datas e Período de Venda", font=ctk.CTkFont(weight="bold")).pack(pady=(10, 2))
        self.mes_venda_entry = criar_entry(self.scrollable_frame, "Mês da Venda (ex: 07/2025)")
        self.dia_venda_entry = criar_entry(self.scrollable_frame, "Dia da Venda (ex: 23)")
        self.vencimento_entry = criar_entry(self.scrollable_frame, "Vencimento (dd/mm/aaaa)")
        self.data_emissao_entry = criar_entry(self.scrollable_frame, "Data de Emissão (dd/mm/aaaa)")

        # Responsáveis e valores
        ctk.CTkLabel(self.scrollable_frame, text="Responsáveis e Valores", font=ctk.CTkFont(weight="bold")).pack(pady=(10, 2))
        self.executivo_entry = criar_entry(self.scrollable_frame, "Executivo")
        self.diretoria_entry = criar_entry(self.scrollable_frame, "Diretoria")
        self.valor_bruto_entry = criar_entry(self.scrollable_frame, "Valor Bruto (ex: 1000.00)")
        self.valor_liquido_entry = criar_entry(self.scrollable_frame, "Valor Líquido (ex: 900.00)")
        self.obs_entry = criar_entry(self.scrollable_frame, "Observações")

        # Botão de cadastro
        ctk.CTkButton(self.scrollable_frame, text="Cadastrar PI", command=self.cadastrar_pi).pack(pady=20)

        # Lista de PIs
        ctk.CTkLabel(self.scrollable_frame, text="PIs cadastrados:", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=10)
        self.lista_pis = ctk.CTkTextbox(self.scrollable_frame, width=700, height=200)
        self.lista_pis.pack()
        self.atualizar_lista()

    def cadastrar_pi(self):
        try:
            numero = self.numero_entry.get()
            pi_matriz = self.pi_matriz_entry.get()
            nome_anunciante = self.nome_anunciante_entry.get()
            razao_anunciante = self.razao_anunciante_entry.get()
            cnpj_anunciante = self.cnpj_anunciante_entry.get()
            uf_cliente = self.uf_cliente_entry.get()

            nome_agencia = self.nome_agencia_entry.get()
            razao_agencia = self.razao_agencia_entry.get()
            cnpj_agencia = self.cnpj_agencia_entry.get()
            uf_agencia = self.uf_agencia_entry.get()

            nome_campanha = self.nome_campanha_entry.get()
            canal = self.canal_entry.get()
            perfil = self.perfil_entry.get()
            subperfil = self.subperfil_entry.get()

            mes_venda = self.mes_venda_entry.get()
            dia_venda = self.dia_venda_entry.get()
            vencimento = datetime.strptime(self.vencimento_entry.get(), "%d/%m/%Y").date()
            data_emissao = datetime.strptime(self.data_emissao_entry.get(), "%d/%m/%Y").date()

            executivo = self.executivo_entry.get()
            diretoria = self.diretoria_entry.get()

            valor_bruto = float(self.valor_bruto_entry.get().replace(",", "."))
            valor_liquido = float(self.valor_liquido_entry.get().replace(",", "."))

            observacoes = self.obs_entry.get()

            if not numero or not nome_anunciante or not razao_anunciante or not cnpj_anunciante:
                messagebox.showerror("Erro", "Preencha os campos obrigatórios.")
                return

            criar_pi(
                numero_pi=numero,
                pi_matriz=pi_matriz,
                nome_anunciante=nome_anunciante,
                razao_social_anunciante=razao_anunciante,
                cnpj_anunciante=cnpj_anunciante,
                uf_cliente=uf_cliente,
                executivo=executivo,
                diretoria=diretoria,
                nome_campanha=nome_campanha,
                nome_agencia=nome_agencia,
                razao_social_agencia=razao_agencia,
                cnpj_agencia=cnpj_agencia,
                uf_agencia=uf_agencia,
                mes_venda=mes_venda,
                dia_venda=dia_venda,
                canal=canal,
                perfil_anunciante=perfil,
                subperfil_anunciante=subperfil,
                valor_bruto=valor_bruto,
                valor_liquido=valor_liquido,
                vencimento=vencimento,
                data_emissao=data_emissao,
                observacoes=observacoes
            )

            messagebox.showinfo("Sucesso", "PI cadastrada com sucesso!")
            self.limpar_campos()
            self.atualizar_lista()

        except ValueError:
            messagebox.showerror("Erro", "Preencha os valores corretamente.")
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao cadastrar PI: {e}")

    def limpar_campos(self):
        for widget in self.scrollable_frame.winfo_children():
            if isinstance(widget, ctk.CTkEntry):
                widget.delete(0, "end")

    def atualizar_lista(self):
        self.lista_pis.delete("1.0", "end")
        for pi in listar_pis():
            self.lista_pis.insert(
                "end",
                f"{pi.numero_pi} | {pi.nome_anunciante} | {pi.nome_campanha} | R$ {pi.valor_bruto:.2f} | {pi.data_emissao.strftime('%d/%m/%Y')}\n"
            )