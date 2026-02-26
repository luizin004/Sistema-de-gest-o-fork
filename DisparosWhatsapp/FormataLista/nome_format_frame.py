import tkinter as tk


class NomeFormatoFrame(tk.LabelFrame):
    def __init__(self, master: tk.Misc) -> None:
        super().__init__(master, text="Formato do Nome")

        self.formato_var = tk.StringVar(value="Primeiro e último")

        lbl = tk.Label(self, text="Como salvar o nome:")
        lbl.grid(row=0, column=0, sticky="w")

        op = tk.OptionMenu(
            self,
            self.formato_var,
            "Primeiro e último",
            "Apenas primeiro nome",
        )
        op.config(width=20)
        op.grid(row=0, column=1, padx=(10, 0), sticky="w")

        self.grid_columnconfigure(0, weight=1)

    def apenas_primeiro_nome(self) -> bool:
        raw = (self.formato_var.get() or "").strip().lower()
        return raw == "apenas primeiro nome"

    def reset(self) -> None:
        self.formato_var.set("Primeiro e último")
