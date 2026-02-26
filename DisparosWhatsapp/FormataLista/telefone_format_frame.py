import tkinter as tk

from telefone_utils import TelefoneFormatoConfig


class TelefoneFormatoFrame(tk.LabelFrame):
    def __init__(self, master: tk.Misc) -> None:
        super().__init__(master, text="Formato do Telefone")

        self.incluir_55_var = tk.BooleanVar(value=False)
        self.incluir_ddd_var = tk.BooleanVar(value=True)
        self.nono_var = tk.StringVar(value="auto")

        chk_55 = tk.Checkbutton(self, text="Incluir 55 (DDI)", variable=self.incluir_55_var)
        chk_55.grid(row=0, column=0, sticky="w")

        chk_ddd = tk.Checkbutton(self, text="Incluir DDD", variable=self.incluir_ddd_var)
        chk_ddd.grid(row=0, column=1, padx=(12, 0), sticky="w")

        lbl_nono = tk.Label(self, text="Nono dígito (9):")
        lbl_nono.grid(row=0, column=2, padx=(12, 0), sticky="e")

        op = tk.OptionMenu(self, self.nono_var, "auto", "incluir", "remover")
        op.config(width=9)
        op.grid(row=0, column=3, padx=(8, 0), sticky="w")

        self.grid_columnconfigure(0, weight=1)

    def config_atual(self) -> TelefoneFormatoConfig:
        nono_raw = (self.nono_var.get() or "auto").strip().lower()
        incluir_nono = None
        if nono_raw == "incluir":
            incluir_nono = True
        elif nono_raw == "remover":
            incluir_nono = False

        return TelefoneFormatoConfig(
            incluir_ddi=bool(self.incluir_55_var.get()),
            incluir_ddd=bool(self.incluir_ddd_var.get()),
            incluir_nono_digito=incluir_nono,
        )

    def reset(self) -> None:
        self.incluir_55_var.set(False)
        self.incluir_ddd_var.set(True)
        self.nono_var.set("auto")
