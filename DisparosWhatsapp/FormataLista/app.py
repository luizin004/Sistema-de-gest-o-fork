import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox
from typing import Optional

import pandas as pd

from dnd_support import BaseTk, DND_DISPONIVEL, habilitar_drop_arquivos
from filter_ui import FiltrosFrame
from lead_filters import aplicar_filtros
from lead_processor import (
    detectar_separador_csv,
    identificar_colunas,
    ler_csv_flexivel,
    ler_excel_flexivel,
    processar_leads,
    separador_padrao_excel,
)
from nome_format_frame import NomeFormatoFrame
from telefone_format_frame import TelefoneFormatoFrame


class App(BaseTk):
    def __init__(self) -> None:
        super().__init__()

        self.title("Processador de Leads (CSV)")
        self.geometry("760x460")
        self.minsize(700, 380)

        self.df: Optional[pd.DataFrame] = None
        self.colunas = None
        self.caminho_csv: Optional[str] = None
        self.sep_entrada: str = ";"

        frame = tk.Frame(self, padx=12, pady=12)
        frame.pack(fill="both", expand=True)

        btn_importar = tk.Button(frame, text="Importar", width=18, command=self.importar_csv)
        btn_importar.grid(row=0, column=0, sticky="w")

        btn_salvar = tk.Button(frame, text="Salvar Filtrado", width=18, command=self.salvar_filtrado)
        btn_salvar.grid(row=0, column=1, padx=(10, 0), sticky="w")

        btn_resetar = tk.Button(frame, text="Resetar", width=18, command=self.resetar)
        btn_resetar.grid(row=0, column=2, padx=(10, 0), sticky="w")

        drop_text = (
            "Arraste e solte um arquivo .csv/.xlsx/.xls aqui"
            if DND_DISPONIVEL
            else "(Para arrastar e soltar: instale tkinterdnd2)"
        )
        self.drop_label = tk.Label(
            frame,
            text=drop_text,
            relief="groove",
            padx=10,
            pady=14,
            anchor="center",
        )
        self.drop_label.grid(row=1, column=0, columnspan=3, pady=(12, 0), sticky="we")

        habilitar_drop_arquivos(self.drop_label, self._on_drop_path)

        self.telefone_frame = TelefoneFormatoFrame(frame)
        self.telefone_frame.grid(row=2, column=0, columnspan=3, pady=(12, 0), sticky="we")

        self.nome_frame = NomeFormatoFrame(frame)
        self.nome_frame.grid(row=3, column=0, columnspan=3, pady=(12, 0), sticky="we")

        self.filtros_frame = FiltrosFrame(frame)
        self.filtros_frame.grid(row=4, column=0, columnspan=3, pady=(12, 0), sticky="we")

        self.status_var = tk.StringVar(value="Selecione um arquivo para começar.")
        lbl_status = tk.Label(frame, textvariable=self.status_var, anchor="w", justify="left", wraplength=660)
        lbl_status.grid(row=5, column=0, columnspan=3, pady=(14, 0), sticky="we")

        frame.grid_columnconfigure(0, weight=1)
        frame.grid_columnconfigure(1, weight=1)
        frame.grid_columnconfigure(2, weight=1)

        self.resetar()

    def importar_csv(self) -> None:
        caminho = filedialog.askopenfilename(
            title="Selecione o arquivo",
            filetypes=[
                ("CSV", "*.csv"),
                ("Excel", "*.xlsx;*.xls"),
                ("Todos os arquivos", "*.*"),
            ],
        )
        if not caminho:
            return

        self.importar_csv_caminho(caminho)

    def _on_drop_path(self, caminho: str) -> None:
        ext = Path(caminho).suffix.lower()
        if ext not in (".csv", ".xlsx", ".xls"):
            messagebox.showwarning("Atenção", "Solte apenas arquivos .csv, .xlsx ou .xls")
            return
        self.importar_csv_caminho(caminho)

    def importar_csv_caminho(self, caminho: str) -> None:
        if not caminho:
            return

        ext = Path(caminho).suffix.lower()
        if ext not in (".csv", ".xlsx", ".xls"):
            messagebox.showwarning("Atenção", "Selecione um arquivo .csv, .xlsx ou .xls")
            return

        try:
            if ext == ".csv":
                self.sep_entrada = detectar_separador_csv(caminho)
                df = ler_csv_flexivel(caminho, self.sep_entrada)
            else:
                self.sep_entrada = ""
                df = ler_excel_flexivel(caminho)
        except ImportError as e:
            messagebox.showerror("Dependência faltando", f"Não foi possível ler a planilha.\n\nDetalhes: {e}")
            return
        except Exception as e:
            messagebox.showerror("Erro ao ler arquivo", f"Não foi possível ler o arquivo.\n\nDetalhes: {e}")
            return

        colunas = identificar_colunas(df)
        if not colunas:
            msg = (
                "Não consegui identificar automaticamente as colunas de Nome, Telefone e Cidade.\n\n"
                "Dica: renomeie as colunas do CSV para algo como 'nome', 'telefone', 'cidade' (ou variações) e tente novamente."
            )
            messagebox.showerror("Colunas não identificadas", msg)
            return

        self.df = df
        self.colunas = colunas
        self.caminho_csv = caminho

        self.status_var.set(
            f"Arquivo carregado: {Path(caminho).name}\n"
            f"Colunas detectadas -> Nome: '{colunas.nome}', Telefone: '{colunas.telefone}', Cidade: '{colunas.cidade}'\n"
            f"Separador detectado: '{self.sep_entrada}'"
        )

    def salvar_filtrado(self) -> None:
        if self.df is None or self.colunas is None:
            messagebox.showwarning("Atenção", "Importe um arquivo antes de salvar.")
            return

        caminho_saida = filedialog.asksaveasfilename(
            title="Salvar CSV filtrado",
            defaultextension=".csv",
            filetypes=[("CSV", "*.csv")],
            initialfile="leads_filtrado.csv",
        )
        if not caminho_saida:
            return

        try:
            cfg = self.telefone_frame.config_atual()
            apenas_primeiro = False
            if hasattr(self, "nome_frame"):
                apenas_primeiro = bool(self.nome_frame.apenas_primeiro_nome())
            out = processar_leads(
                self.df,
                self.colunas,
                telefone_config=cfg,
                apenas_primeiro_nome=apenas_primeiro,
            )
            regras = self.filtros_frame.regras()
            out = aplicar_filtros(out, regras)
            sep_saida = separador_padrao_excel()
            out.to_csv(caminho_saida, index=False, sep=sep_saida, encoding="utf-8-sig")
        except Exception as e:
            messagebox.showerror("Erro ao salvar", f"Não foi possível salvar o arquivo.\n\nDetalhes: {e}")
            return

        self.status_var.set(
            f"Processamento concluído!\n"
            f"Salvo em: {caminho_saida}\n"
            f"Linhas exportadas: {len(out)}\n"
            f"Separador de saída (Excel): '{sep_saida}'\n"
            f"Colunas finais: nome, telefone, cidade"
        )

    def resetar(self) -> None:
        self.df = None
        self.colunas = None
        self.caminho_csv = None
        self.sep_entrada = ";"
        if hasattr(self, "filtros_frame"):
            self.filtros_frame.reset()
        if hasattr(self, "nome_frame"):
            self.nome_frame.reset()
        if hasattr(self, "telefone_frame"):
            self.telefone_frame.reset()
        self.status_var.set("Selecione um arquivo para começar.")
