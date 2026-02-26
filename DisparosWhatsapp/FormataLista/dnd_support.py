import re
import tkinter as tk
from pathlib import Path
from typing import Callable, Optional

try:
    from tkinterdnd2 import DND_FILES, TkinterDnD

    DND_DISPONIVEL = True
    BaseTk = TkinterDnD.Tk
except Exception:
    DND_FILES = None
    TkinterDnD = None
    DND_DISPONIVEL = False
    BaseTk = tk.Tk


def extrair_primeiro_arquivo_drop(data: str) -> Optional[str]:
    s = (data or "").strip()
    if not s:
        return None

    if s.startswith("{"):
        m = re.match(r"^\{([^}]*)\}", s)
        if m:
            s = m.group(1)

    s = s.strip().strip('"').strip("'")

    if s.lower().startswith("file://"):
        s = s[7:]
        if s.startswith("/") and len(s) > 2 and s[2] == ":":
            s = s[1:]

    return s.split()[0]


def habilitar_drop_arquivos(widget: tk.Widget, on_path: Callable[[str], None]) -> bool:
    if not DND_DISPONIVEL:
        return False

    def _on_drop(event: object) -> None:
        data = getattr(event, "data", "")
        caminho = extrair_primeiro_arquivo_drop(str(data))
        if not caminho:
            return
        on_path(str(Path(caminho)))

    widget.drop_target_register(DND_FILES)
    widget.dnd_bind("<<Drop>>", _on_drop)
    return True
