import csv
from typing import Any, Optional

import pandas as pd


def normalizar_nome_coluna(nome: Any) -> str:
    return str(nome).replace("\ufeff", "").strip().lower()


def ler_csv_contatos(caminho_csv: str) -> pd.DataFrame:
    with open(caminho_csv, "r", encoding="utf-8-sig", errors="replace", newline="") as f:
        amostra = f.read(4096)

    sep: Optional[str] = None
    try:
        sep = csv.Sniffer().sniff(amostra, delimiters=[",", ";", "\t", "|"]).delimiter
    except Exception:
        sep = None

    read_kwargs = {
        "dtype": str,
        "keep_default_na": False,
        "encoding": "utf-8-sig",
    }

    if sep is None:
        df = pd.read_csv(caminho_csv, sep=None, engine="python", **read_kwargs)
    else:
        df = pd.read_csv(caminho_csv, sep=sep, **read_kwargs)

    df.columns = [normalizar_nome_coluna(c) for c in df.columns]
    return df
