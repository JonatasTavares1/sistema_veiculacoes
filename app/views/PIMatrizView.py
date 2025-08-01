import customtkinter as ctk
from tkinter import messagebox, filedialog
from controllers.pi_matriz_controller import listar_pis_matriz, listar_abatimentos, calcular_saldo_matriz
from openpyxl import Workbook

class PIMatrizView(ctk.CTkFrame):
    def __init__(self, master=None):
        super().__init__(master)
        self.configure(fg_color="#1a1a1a")

        self.entry_export = ctk.CTkEntry(self, placeholder_text="Digite o número do PI MATRIZ para exportar")
        self.entry_export.pack(pady=(15, 5), padx=20, fill="x")

        btn_exportar = ctk.CTkButton(
            self,
            text="🧾 Exportar PI MATRIZ e Abatimentos",
            fg_color="#cc0000",
            hover_color="#990000",
            text_color="white",
            font=ctk.CTkFont(size=15, weight="bold"),
            command=self.exportar_excel
        )
        btn_exportar.pack(pady=(5, 15), padx=20)

        atualizar_btn = ctk.CTkButton(
            self,
            text="🔄 Atualizar Lista",
            fg_color="red",
            hover_color="#b30000",
            text_color="white",
            command=self.atualizar_lista
        )
        atualizar_btn.pack(pady=5)

        self.scroll_frame = ctk.CTkScrollableFrame(
            self,
            width=1000,
            height=600,
            fg_color="#2a2a2a",
            scrollbar_button_color="red",
            scrollbar_button_hover_color="#b30000"
        )
        self.scroll_frame.pack(padx=20, pady=15, fill="both", expand=True)

        self.matriz_frames = []
        self.atualizar_lista()

    def atualizar_lista(self):
        for frame in self.matriz_frames:
            frame.destroy()
        self.matriz_frames.clear()

        pis_matriz = listar_pis_matriz()
        if not pis_matriz:
            msg = ctk.CTkLabel(
                self.scroll_frame,
                text="⚠️ Nenhum PI MATRIZ encontrado.",
                font=ctk.CTkFont(size=16),
                text_color="white"
            )
            msg.pack(pady=10)
            self.matriz_frames.append(msg)
            return

        for pi in pis_matriz:
            frame_pi = ctk.CTkFrame(self.scroll_frame, fg_color="#333333", corner_radius=10)
            frame_pi.pack(fill="x", pady=10, padx=10)

            header_text = (
                f"🔴 PI MATRIZ: {pi.numero_pi} | Campanha: {pi.nome_campanha or '---'} | "
                f"Anunciante: {pi.nome_anunciante or '---'} | "
                f"Valor Bruto: R$ {pi.valor_bruto or 0:.2f} | "
                f"Valor Líquido: R$ {pi.valor_liquido or 0:.2f} | "
                f"Saldo: R$ {calcular_saldo_matriz(pi.numero_pi):.2f}"
            )

            toggle_button = ctk.CTkButton(
                frame_pi,
                text=header_text,
                font=ctk.CTkFont(size=14),
                fg_color="#444",
                hover_color="#b30000",
                anchor="w",
                text_color="white"
            )
            toggle_button.pack(fill="x")

            detalhes_frame = ctk.CTkFrame(frame_pi, fg_color="#252525")
            detalhes_frame.pack(fill="x", pady=5, padx=10)
            detalhes_frame.pack_forget()

            def toggle_detalhes(f=detalhes_frame):
                if f.winfo_ismapped():
                    f.pack_forget()
                else:
                    f.pack(fill="x", pady=5, padx=10)

            toggle_button.configure(command=toggle_detalhes)

            filhos = listar_abatimentos(pi.numero_pi)
            if not filhos:
                label_vazio = ctk.CTkLabel(
                    detalhes_frame,
                    text="🔕 Nenhum abatimento vinculado.",
                    text_color="gray",
                    font=ctk.CTkFont(size=13)
                )
                label_vazio.pack(anchor="w", padx=10, pady=5)
            else:
                for filho in filhos:
                    numero_pi = filho.numero_pi
                    anunciante = filho.nome_anunciante or '---'
                    campanha = filho.nome_campanha or '---'
                    emissao = filho.data_emissao.strftime('%d/%m/%Y') if filho.data_emissao else '---'
                    dia = filho.dia_venda.zfill(2) if filho.dia_venda else '--'
                    mes = filho.mes_venda.zfill(2) if filho.mes_venda else '--'
                    venda = f"{dia}/{mes}"
                    valor_liquido = f"R$ {filho.valor_liquido or 0:.2f}"

                    texto = (
                        f"🔹 Campanha: {campanha} | "
                        f"PI Abatimento: {numero_pi} | "
                        f"Anunciante: {anunciante} | "
                        f"Emissão: {emissao} | "
                        f"Venda: {venda} | "
                        f"Valor Líquido: {valor_liquido}"
                    )

                    pi_label = ctk.CTkLabel(
                        detalhes_frame,
                        text=texto,
                        font=ctk.CTkFont(size=13),
                        text_color="white",
                        anchor="w"
                    )
                    pi_label.pack(anchor="w", padx=10, pady=2)

            self.matriz_frames.append(frame_pi)

    def exportar_excel(self):
        numero_pi = self.entry_export.get().strip()
        if not numero_pi:
            messagebox.showwarning("Aviso", "Digite o número do PI MATRIZ para exportar.")
            return

        pis_matriz = listar_pis_matriz()
        pi = next((p for p in pis_matriz if str(p.numero_pi) == numero_pi), None)

        if not pi:
            messagebox.showerror("Erro", f"PI MATRIZ {numero_pi} não encontrado.")
            return

        filhos = listar_abatimentos(pi.numero_pi)

        path = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel Files", "*.xlsx")],
            title="Salvar Arquivo Excel",
            initialfile=f"PI_MATRIZ_{numero_pi}.xlsx"
        )
        if not path:
            return

        wb = Workbook()
        ws = wb.active
        ws.title = "PI Exportado"

        # Seção: Dados do PI MATRIZ
        ws.append(["DADOS DO PI MATRIZ"])
        ws.append(["Número", "Campanha", "Anunciante", "Valor Bruto", "Valor Líquido", "Saldo Restante"])
        ws.append([
            pi.numero_pi,
            pi.nome_campanha,
            pi.nome_anunciante,
            pi.valor_bruto,
            pi.valor_liquido,
            calcular_saldo_matriz(pi.numero_pi)
        ])

        # Espaço antes do próximo bloco
        ws.append([])

        # Seção: Abatimentos vinculados
        ws.append(["Abatimentos Vinculados"])
        ws.append(["Número", "Campanha", "Anunciante", "Data Emissão", "Data da Venda", "Valor Líquido"])
        for filho in filhos:
            ws.append([
                filho.numero_pi,
                filho.nome_campanha,
                filho.nome_anunciante,
                filho.data_emissao.strftime('%d/%m/%Y') if filho.data_emissao else '---',
                f"{filho.dia_venda.zfill(2)}/{filho.mes_venda.zfill(2)}" if filho.dia_venda and filho.mes_venda else "--/--",
                filho.valor_liquido
            ])

        try:
            wb.save(path)
            messagebox.showinfo("Sucesso", f"Arquivo exportado com sucesso para:\n{path}")
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao salvar o arquivo:\n{str(e)}")
