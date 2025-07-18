import customtkinter as ctk
from tkinter import messagebox
from datetime import datetime
from controllers.entrega_controller import criar_entrega, listar_entregas, entregas_pendentes
from controllers.produto_controller import listar_produtos
from controllers.pi_controller import listar_pis


class EntregaView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)

        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("green")

        # Título
        ctk.CTkLabel(self, text="📦 Controle de Entregas", font=ctk.CTkFont(size=22, weight="bold")).pack(pady=10)

        # ========== FORMULÁRIO DE CADASTRO ==========

        # Produto
        self.produtos = listar_produtos()
        self.produto_var = ctk.StringVar()
        self.produto_combo = ctk.CTkComboBox(
            self,
            width=400,
            values=[f"{p.id} - {p.nome}" for p in self.produtos],
            variable=self.produto_var
        )
        self.produto_combo.set("Selecione o produto")
        self.produto_combo.pack(pady=6)

        # PI
        self.pis = listar_pis()
        self.pi_var = ctk.StringVar()
        self.pi_combo = ctk.CTkComboBox(
            self,
            width=400,
            values=[f"{pi.id} - {pi.numero_pi}" for pi in self.pis],
            variable=self.pi_var
        )
        self.pi_combo.set("Selecione o PI")
        self.pi_combo.pack(pady=6)

        # Data da entrega
        self.data_entry = ctk.CTkEntry(self, placeholder_text="Data da entrega (dd/mm/aaaa)", width=400)
        self.data_entry.pack(pady=6)

        # Motivo (caso não entregue)
        self.motivo_entry = ctk.CTkEntry(self, placeholder_text="Motivo (se não entregue)", width=400)
        self.motivo_entry.pack(pady=6)

        # Botão de cadastro
        ctk.CTkButton(self, text="➕ Cadastrar Entrega", command=self.cadastrar_entrega, height=40).pack(pady=10)

        # ========== ALERTAS DE PENDENTES ==========
        ctk.CTkLabel(self, text="⚠️ Alertas de Entregas Não Realizadas:", font=ctk.CTkFont(size=16)).pack(pady=(10, 4))

        self.alerta_box = ctk.CTkTextbox(self, width=700, height=100, corner_radius=8, text_color="orange")
        self.alerta_box.pack(pady=(0, 15))

        # ========== LISTAGEM DE ENTREGAS ==========
        ctk.CTkLabel(self, text="📋 Entregas Registradas:", font=ctk.CTkFont(size=16)).pack(pady=(10, 4))

        self.lista = ctk.CTkTextbox(self, width=700, height=220, corner_radius=8)
        self.lista.pack()

        # Carrega dados
        self.atualizar_alertas()
        self.atualizar_lista()

    def cadastrar_entrega(self):
        try:
            produto_id = int(self.produto_var.get().split(" - ")[0])
            pi_id = int(self.pi_var.get().split(" - ")[0])
            data = datetime.strptime(self.data_entry.get(), "%d/%m/%Y").date()
            motivo = self.motivo_entry.get().strip()

            foi_entregue = "Não" if motivo else "Sim"

            criar_entrega(produto_id, pi_id, data, foi_entregue, motivo)
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
            self.lista.insert("end", f"📦 Produto ID {e.produto_id} | PI ID {e.pi_id} | Data: {data_str} | {status}\n")

    def atualizar_alertas(self):
        self.alerta_box.delete("1.0", "end")
        pendentes = entregas_pendentes()

        if not pendentes:
            self.alerta_box.insert("end", "✅ Tudo certo! Nenhuma entrega pendente.\n")
            return

        for p in pendentes:
            data_str = p.data_entrega.strftime("%d/%m/%Y")
            self.alerta_box.insert(
                "end",
                f"🔔 Entrega PENDENTE - Produto ID {p.produto_id}, PI ID {p.pi_id}, Data: {data_str}\n"
            )

    def limpar_campos(self):
        self.produto_combo.set("Selecione o produto")
        self.pi_combo.set("Selecione o PI")
        self.data_entry.delete(0, "end")
        self.motivo_entry.delete(0, "end")
