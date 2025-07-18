import customtkinter as ctk
from tkinter import messagebox
from datetime import datetime
from controllers.entrega_controller import criar_entrega, listar_entregas, entregas_pendentes
from controllers.veiculacao_controller import listar_veiculacoes


class EntregaView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)

        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("green")

        # Título
        ctk.CTkLabel(self, text="📦 Controle de Entregas", font=ctk.CTkFont(size=22, weight="bold")).pack(pady=10)

        # ========== FORMULÁRIO DE CADASTRO ==========

        # Seleção da veiculação
        self.veiculacoes = listar_veiculacoes()
        self.veiculacao_var = ctk.StringVar()
        self.veiculacao_combo = ctk.CTkComboBox(
            self,
            width=600,
            values=[f"{v.id} - Produto: {v.produto.nome}, PI: {v.pi.numero_pi}, Data: {v.data_veiculacao.strftime('%d/%m/%Y')}" for v in self.veiculacoes],
            variable=self.veiculacao_var
        )
        self.veiculacao_combo.set("Selecione a veiculação")
        self.veiculacao_combo.pack(pady=8)

        # Data da entrega
        self.data_entry = ctk.CTkEntry(self, placeholder_text="Data da entrega (dd/mm/aaaa)", width=600)
        self.data_entry.pack(pady=6)

        # Motivo (caso não entregue)
        self.motivo_entry = ctk.CTkEntry(self, placeholder_text="Motivo (se não entregue)", width=600)
        self.motivo_entry.pack(pady=6)

        # Botão de cadastro
        ctk.CTkButton(self, text="➕ Registrar Entrega", command=self.cadastrar_entrega, height=40).pack(pady=10)

        # ========== ALERTAS DE PENDENTES ==========
        ctk.CTkLabel(self, text="⚠️ Entregas Pendentes:", font=ctk.CTkFont(size=16)).pack(pady=(10, 4))

        self.alerta_box = ctk.CTkTextbox(self, width=700, height=100, corner_radius=8, text_color="orange")
        self.alerta_box.pack(pady=(0, 15))

        # ========== LISTAGEM DE ENTREGAS ==========
        ctk.CTkLabel(self, text="📋 Histórico de Entregas:", font=ctk.CTkFont(size=16)).pack(pady=(10, 4))

        self.lista = ctk.CTkTextbox(self, width=700, height=220, corner_radius=8)
        self.lista.pack()

        # Carrega dados
        self.atualizar_alertas()
        self.atualizar_lista()

    def cadastrar_entrega(self):
        try:
            veiculacao_id = int(self.veiculacao_var.get().split(" - ")[0])
            data = datetime.strptime(self.data_entry.get(), "%d/%m/%Y").date()
            motivo = self.motivo_entry.get().strip()

            foi_entregue = "Não" if motivo else "Sim"

            criar_entrega(veiculacao_id, data, foi_entregue, motivo)
            messagebox.showinfo("Sucesso", "Entrega registrada com sucesso!")
            self.limpar_campos()
            self.atualizar_lista()
            self.atualizar_alertas()

        except ValueError:
            messagebox.showerror("Erro", "Preencha todos os campos corretamente.")
        except Exception as e:
            messagebox.showerror("Erro inesperado", f"Ocorreu um erro: {e}")

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")
        entregas = listar_entregas()

        if not entregas:
            self.lista.insert("end", "Nenhuma entrega registrada.\n")
            return

        for e in entregas:
            status = "✅ Entregue" if e.foi_entregue == "Sim" else f"❌ NÃO entregue - Motivo: {e.motivo or 'Não informado'}"
            data_str = e.data_entrega.strftime("%d/%m/%Y")
            produto = e.veiculacao.produto.nome
            pi = e.veiculacao.pi.numero_pi
            self.lista.insert("end", f"📦 Produto: {produto} | PI: {pi} | Data: {data_str} | {status}\n")

    def atualizar_alertas(self):
        self.alerta_box.delete("1.0", "end")
        pendentes = entregas_pendentes()

        if not pendentes:
            self.alerta_box.insert("end", "✅ Tudo certo! Nenhuma entrega pendente.\n")
            return

        hoje = datetime.now().date()
        total = len(pendentes)
        self.alerta_box.insert("end", f"🚨 {total} entrega(s) PENDENTE(S) encontradas!\n\n")

        for p in pendentes:
            data_entrega = p.data_entrega
            atraso_dias = (hoje - data_entrega).days
            produto = p.veiculacao.produto.nome
            pi = p.veiculacao.pi.numero_pi

            self.alerta_box.insert(
                "end",
                f"🔔 Produto: {produto} | PI: {pi} | Prevista para: {data_entrega.strftime('%d/%m/%Y')} "
                f"→ ⏳ {atraso_dias} dia(s) de atraso\n"
            )

        self.alerta_box.insert("end", "\n⚠️ Acesse a seção de entregas para atualizar o status.")

    def limpar_campos(self):
        self.veiculacao_combo.set("Selecione a veiculação")
        self.data_entry.delete(0, "end")
        self.motivo_entry.delete(0, "end")
