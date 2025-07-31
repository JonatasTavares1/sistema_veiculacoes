import customtkinter as ctk
from tkinter import messagebox
from controllers.pi_matriz_controller import listar_pis_matriz, listar_pis_vinculados, calcular_saldo_matriz


class PIMatrizView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.configure(fg_color="#1a1a1a")  # fundo escuro

        # Título principal
        ctk.CTkLabel(
            self,
            text="🔗 VISUALIZAÇÃO DE PIs MATRIZ",
            font=ctk.CTkFont(size=24, weight="bold"),
            text_color="white"
        ).pack(pady=(20, 5))

        # Botão de atualizar
        ctk.CTkButton(
            self,
            text="🔄 Atualizar Lista",
            fg_color="#cc0000",
            hover_color="#990000",
            text_color="white",
            command=self.atualizar_lista,
            corner_radius=8
        ).pack(pady=5)

        # Área de exibição com scroll
        self.lista = ctk.CTkTextbox(
            self,
            width=1100,
            height=600,
            font=ctk.CTkFont(size=14),
            text_color="#ffffff",
            fg_color="#2a2a2a",
            scrollbar_button_color="red",
            scrollbar_button_hover_color="#b30000"
        )
        self.lista.pack(padx=20, pady=15, fill="both", expand=True)

        self.atualizar_lista()

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")

        pis_matriz = listar_pis_matriz()
        if not pis_matriz:
            self.lista.insert("end", "⚠️ Nenhum PI do tipo MATRIZ encontrado.\n")
            return

        for pi in pis_matriz:
            filhos = listar_pis_vinculados(pi.numero_pi)
            saldo = calcular_saldo_matriz(pi.numero_pi)

            self.lista.insert("end", "\n🟥══════════════════════════════════════════════════════════════════════════════════════════════\n")
            self.lista.insert("end", f"🔴 PI MATRIZ: {pi.numero_pi} | 📢 CAMPANHA: {pi.nome_campanha or '---'}\n")
            self.lista.insert("end", f"👤 Anunciante: {pi.nome_anunciante or '---'} | CNPJ: {pi.cnpj_anunciante or '---'}\n")
            self.lista.insert("end", f"🏢 Diretoria: {pi.diretoria or '---'} | 👔 Executivo: {pi.executivo or '---'}\n")
            self.lista.insert("end", f"📅 Emissão: {pi.data_emissao.strftime('%d/%m/%Y') if pi.data_emissao else '---'}\n")
            self.lista.insert("end", f"💰 Valor Bruto: R$ {pi.valor_bruto or 0:.2f} | 💸 Líquido: R$ {pi.valor_liquido or 0:.2f} | 📉 Saldo: R$ {saldo:.2f}\n")
            self.lista.insert("end", f"🔗 PIs Vinculados ({len(filhos)}):\n")

            if filhos:
                for filho in filhos:
                    self.lista.insert("end", f"   • PI CS: {filho.numero_pi} | Valor: R$ {filho.valor_bruto or 0:.2f} | Campanha: {filho.nome_campanha or '---'}\n")
            else:
                self.lista.insert("end", "   ⚠️ Nenhum PI CS vinculado.\n")

            self.lista.insert("end", "🟥══════════════════════════════════════════════════════════════════════════════════════════════\n")
