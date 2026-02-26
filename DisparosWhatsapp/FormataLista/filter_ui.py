import tkinter as tk
from typing import List

from lead_filters import RegraFiltro


class FiltrosFrame(tk.Frame):
    def __init__(self, master: tk.Misc) -> None:
        super().__init__(master)

        self._regras: List[RegraFiltro] = []

        self.campo_var = tk.StringVar(value="cidade")
        self.operador_var = tk.StringVar(value="igual")
        self.valor_var = tk.StringVar(value="")

        lbl = tk.Label(self, text="Filtros (aplicados no CSV final):")
        lbl.grid(row=0, column=0, columnspan=4, sticky="w")

        campo = tk.OptionMenu(self, self.campo_var, "cidade", "nome", "telefone")
        campo.config(width=10)
        campo.grid(row=1, column=0, sticky="w")

        op = tk.OptionMenu(self, self.operador_var, "igual", "contem")
        op.config(width=8)
        op.grid(row=1, column=1, padx=(8, 0), sticky="w")

        entry = tk.Entry(self, textvariable=self.valor_var, width=34)
        entry.grid(row=1, column=2, padx=(8, 0), sticky="we")

        btn_add = tk.Button(self, text="Adicionar", width=10, command=self._adicionar)
        btn_add.grid(row=1, column=3, padx=(8, 0), sticky="e")

        self.lista = tk.Listbox(self, height=4)
        self.lista.grid(row=2, column=0, columnspan=3, pady=(8, 0), sticky="we")

        btn_rem = tk.Button(self, text="Remover", width=10, command=self._remover)
        btn_rem.grid(row=2, column=3, padx=(8, 0), pady=(8, 0), sticky="ne")

        btn_clear = tk.Button(self, text="Limpar", width=10, command=self.reset)
        btn_clear.grid(row=3, column=3, padx=(8, 0), pady=(6, 0), sticky="ne")

        self.grid_columnconfigure(2, weight=1)

    def _adicionar(self) -> None:
        valor = (self.valor_var.get() or "").strip()
        if not valor:
            return

        regra = RegraFiltro(
            campo=(self.campo_var.get() or "cidade").strip(),
            operador=(self.operador_var.get() or "igual").strip(),
            valor=valor,
        )
        self._regras.append(regra)
        self.lista.insert(tk.END, f"{regra.campo} {regra.operador} {regra.valor}")
        self.valor_var.set("")

    def _remover(self) -> None:
        sel = list(self.lista.curselection())
        if not sel:
            return
        idx = sel[0]
        self.lista.delete(idx)
        if 0 <= idx < len(self._regras):
            self._regras.pop(idx)

    def regras(self) -> List[RegraFiltro]:
        return list(self._regras)

    def reset(self) -> None:
        self._regras = []
        self.lista.delete(0, tk.END)
        self.valor_var.set("")
