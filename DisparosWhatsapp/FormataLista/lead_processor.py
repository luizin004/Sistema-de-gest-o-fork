import csv
import locale
import re
import unicodedata
from dataclasses import dataclass
from typing import Optional

import pandas as pd

from FormataLista.telefone_utils import TelefoneFormatoConfig, formatar_telefone_configuravel


def remover_acentos(texto: object) -> str:
    if texto is None:
        return ""
    s = str(texto)
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", s) if not unicodedata.combining(ch)
    )


def normalizar_header(col: object) -> str:
    s = remover_acentos(col).strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def detectar_separador_csv(caminho: str) -> str:
    try:
        with open(caminho, "r", encoding="utf-8", errors="ignore", newline="") as f:
            amostra = f.read(8192)
        dialect = csv.Sniffer().sniff(amostra, delimiters=[",", ";", "\t", "|"])
        return dialect.delimiter
    except Exception:
        return ";"


def separador_padrao_excel() -> str:
    try:
        locale.setlocale(locale.LC_ALL, "")
        decimal = locale.localeconv().get("decimal_point", ".")
        return ";" if decimal == "," else ","
    except Exception:
        return ";"


def ler_csv_flexivel(caminho: str, sep: str) -> pd.DataFrame:
    try:
        return pd.read_csv(
            caminho,
            sep=sep,
            engine="python",
            dtype=str,
            keep_default_na=False,
            encoding="utf-8-sig",
        )
    except Exception:
        return pd.read_csv(
            caminho,
            sep=sep,
            engine="python",
            dtype=str,
            keep_default_na=False,
            encoding="latin-1",
        )


def ler_excel_flexivel(caminho: str) -> pd.DataFrame:
    ext = caminho.lower().rsplit(".", 1)[-1]
    engine = None
    if ext in ("xlsx", "xlsm", "xltx", "xltm"):
        engine = "openpyxl"
    elif ext == "xls":
        engine = "xlrd"

    try:
        return pd.read_excel(
            caminho,
            engine=engine,
            sheet_name=0,
            dtype=str,
            keep_default_na=False,
        )
    except ImportError as e:
        raise ImportError(
            "Para importar planilhas, instale o engine do Excel: "
            "'openpyxl' (xlsx) e/ou 'xlrd' (xls)."
        ) from e


def _melhor_coluna(headers_norm: list[str], candidatos: list[str]) -> Optional[int]:
    cand_norm = [normalizar_header(c) for c in candidatos]
    melhor_idx: Optional[int] = None
    melhor_score = 0

    for i, h in enumerate(headers_norm):
        score = 0
        for c in cand_norm:
            if h == c:
                score = max(score, 100)
            elif c in h:
                score = max(score, 80)
            elif c in h.split():
                score = max(score, 60)
        if score > melhor_score:
            melhor_score = score
            melhor_idx = i

    return melhor_idx if melhor_score >= 60 else None


@dataclass(frozen=True)
class ColunasMapeadas:
    nome: str
    telefone: str
    indicante: str


def identificar_colunas(df: pd.DataFrame) -> Optional[ColunasMapeadas]:
    cols = list(df.columns)
    cols_norm = [normalizar_header(c) for c in cols]

    idx_nome = _melhor_coluna(
        cols_norm,
        ["nome", "name", "contato", "cliente", "lead", "prospect", "responsavel"],
    )
    idx_tel = _melhor_coluna(
        cols_norm,
        [
            "telefone",
            "celular",
            "fone",
            "tel",
            "whatsapp",
            "numero",
            "mobile",
            "phone",
        ],
    )
    idx_indicante = _melhor_coluna(
        cols_norm,
        ["indicante", "indicacao", "quem indicou", "referencia", "origem"],
    )

    if idx_nome is None or idx_tel is None or idx_indicante is None:
        return None

    return ColunasMapeadas(nome=cols[idx_nome], telefone=cols[idx_tel], indicante=cols[idx_indicante])


def formatar_nome(nome: object) -> str:
    s = remover_acentos(nome)
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return ""
    partes = [p for p in s.split(" ") if p]
    if len(partes) == 1:
        return partes[0]
    return f"{partes[0]} {partes[-1]}"


def formatar_primeiro_nome(nome: object) -> str:
    s = remover_acentos(nome)
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return ""
    primeiro = s.split(" ", 1)[0].strip().lower()
    return (primeiro[:1].upper() + primeiro[1:]) if primeiro else ""


def formatar_indicante(indicante: object) -> str:
    s = remover_acentos(indicante)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def processar_leads(
    df: pd.DataFrame,
    colunas: ColunasMapeadas,
    telefone_config: Optional[TelefoneFormatoConfig] = None,
    apenas_primeiro_nome: bool = False,
) -> pd.DataFrame:
    out = pd.DataFrame()
    cfg = telefone_config or TelefoneFormatoConfig()
    nome_fn = formatar_primeiro_nome if apenas_primeiro_nome else formatar_nome
    out["nome"] = df[colunas.nome].map(nome_fn)
    out["telefone"] = df[colunas.telefone].map(lambda v: formatar_telefone_configuravel(v, cfg))
    out["indicante"] = df[colunas.indicante].map(formatar_indicante)

    out = out.fillna("")
    out["nome"] = out["nome"].map(remover_acentos)
    out["telefone"] = out["telefone"].map(remover_acentos)
    out["indicante"] = out["indicante"].map(remover_acentos)

    return out
