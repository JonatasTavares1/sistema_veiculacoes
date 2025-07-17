import customtkinter as ctk
from tkinter import filedialog, messagebox
from controllers.veiculacao_controller import listar_veiculacoes
import csv
import os

class ExportarView(ctk.CTkFrame):
    def __init__(self, master):
        super().__init__(master)

        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("green")

        ctk.CTkLabel(self, text="Exportar Veiculações para CSV", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=20)

        ctk.CTkButton(self, text="Exportar como CSV", command=self.exportar_csv).pack(pady=10)

        self.resultado_label = ctk.CTkLabel(self, text="", wraplength=450)
        self.resultado_label.pack(pady=20)

        self.lista = ctk.CTkTextbox(self, width=450, height=200)
        self.lista.pack()
        self.atualizar_lista()

    def atualizar_lista(self):
        self.lista.delete("1.0", "end")
        veiculacoes = listar_veiculacoes()
        for v in veiculacoes:
            valor_total = (v.produto.valor_unitario * v.quantidade) - v.desconto_aplicado
            linha = (
                f"{v.id} | Produto: {v.produto.nome} | PI: {v.pi.numero_pi} | "
                f"Qtd: {v.quantidade} | Total: R$ {valor_total:.2f} | Data: {v.data_veiculacao}\n"
            )
            self.lista.insert("end", linha)

    def exportar_csv(self):
        caminho = filedialog.asksaveasfilename(defaultextension=".csv", filetypes=[("CSV files", "*.csv")])
        if not caminho:
            return

        veiculacoes = listar_veiculacoes()
        try:
            with open(caminho, mode="w", newline="", encoding="utf-8") as file:
                writer = csv.writer(file)
                writer.writerow(["ID", "Produto", "PI", "Quantidade", "Desconto", "Valor Total", "Data"])

                for v in veiculacoes:
                    valor_total = (v.produto.valor_unitario * v.quantidade) - v.desconto_aplicado
                    writer.writerow([
                        v.id,
                        v.produto.nome,
                        v.pi.numero_pi,
                        v.quantidade,
                        f"{v.desconto_aplicado:.2f}",
                        f"{valor_total:.2f}",
                        v.data_veiculacao
                    ])

            self.resultado_label.configure(text=f"Arquivo exportado para:\n{os.path.abspath(caminho)} ✅")
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao exportar: {e}")
