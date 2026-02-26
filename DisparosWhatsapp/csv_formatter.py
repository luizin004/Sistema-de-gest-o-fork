import pandas as pd
from typing import Optional
from datetime import datetime
from dateutil import parser

from FormataLista.lead_processor import identificar_colunas, ColunasMapeadas, normalizar_header, formatar_primeiro_nome
from FormataLista.smart_column_detector import identificar_colunas_inteligente
from FormataLista.telefone_utils import TelefoneFormatoConfig, formatar_telefone_configuravel

DATE_CANDIDATES = {
    "aniversario": [
        "datadenascimento",
        "datanascimento",
        "nascimento",
        "aniversario",
        "birth",
        "birthday",
        "data aniversário",
        "data nasc",
        "dt nasc",
    ],
    "limpeza": [
        "datalimpeza",
        "limpeza",
        "ultima limpeza",
        "data limpeza",
        "dt limpeza",
    ],
    "clareamento": [
        "dataclareamento",
        "clareamento",
        "data clareamento",
        "dt clareamento",
    ],
}


def _detect_name_phone(df: pd.DataFrame) -> ColunasMapeadas:
    cols_dict = identificar_colunas_inteligente(df)
    if cols_dict:
        return ColunasMapeadas(
            nome=cols_dict["nome"],
            telefone=cols_dict["telefone"],
            indicante=cols_dict.get("indicante", cols_dict["nome"]),
        )

    colunas = identificar_colunas(df)
    if not colunas:
        raise ValueError("Não foi possível identificar colunas de nome e telefone")
    return colunas


def _normalize_date(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""

    try:
        dt = parser.parse(text, dayfirst=True, yearfirst=False)
    except Exception:
        try:
            dt = parser.parse(text, dayfirst=False, yearfirst=True)
        except Exception:
            return ""

    return dt.strftime("%Y-%m-%d")


def _detect_date_column(df: pd.DataFrame, tipo: str) -> Optional[str]:
    candidates = DATE_CANDIDATES.get(tipo, [])
    normalized_cols = {normalizar_header(col): col for col in df.columns}

    for cand in candidates:
        norm = normalizar_header(cand)
        for col_norm, original in normalized_cols.items():
            if norm == col_norm or norm in col_norm:
                return original

    # fallback: pick column with best date parse ratio
    best_col = None
    best_score = 0.0
    for col in df.columns:
        series = df[col].dropna().head(30)
        if series.empty:
            continue
        success = 0
        for value in series:
            if _normalize_date(value):
                success += 1
        score = success / len(series)
        if score > best_score:
            best_score = score
            best_col = col

    if best_score >= 0.4:
        return best_col
    return None


def format_dataframe_for_tipo(df: pd.DataFrame, tipo: Optional[str]) -> pd.DataFrame:
    tipo_normalized = (tipo or "").strip().lower()

    if tipo_normalized not in DATE_CANDIDATES:
        return df

    colunas = _detect_name_phone(df)
    data_col = _detect_date_column(df, tipo_normalized)
    if not data_col:
        raise ValueError("Não foi possível identificar a coluna de data necessária para este disparo")

    telefone_cfg = TelefoneFormatoConfig(
        incluir_ddi=False,
        incluir_ddd=True,
        incluir_nono_digito=True,
    )

    formatted = pd.DataFrame()
    formatted["nome"] = df[colunas.nome].map(formatar_primeiro_nome).fillna("")
    formatted["telefone"] = df[colunas.telefone].map(
        lambda v: formatar_telefone_configuravel(v, telefone_cfg)
    )
    formatted["data"] = df[data_col].map(_normalize_date)

    formatted = formatted.fillna("")
    formatted = formatted[(formatted["nome"] != "") & (formatted["telefone"] != "") & (formatted["data"] != "")]
    formatted = formatted.drop_duplicates()

    return formatted.reset_index(drop=True)
