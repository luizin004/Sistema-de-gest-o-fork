import re
from dataclasses import dataclass
from typing import Iterable

import pandas as pd

from lead_processor import remover_acentos
from telefone_utils import normalizar_telefone_para_filtro


@dataclass(frozen=True)
class RegraFiltro:
    campo: str
    operador: str
    valor: str


def _normalizar_valor(campo: str, valor: str) -> str:
    v = str(valor or "").strip()
    if not v:
        return ""

    if campo == "telefone":
        return normalizar_telefone_para_filtro(v)

    v = remover_acentos(v).lower().strip()
    v = re.sub(r"\s+", " ", v)
    return v


def _serie_normalizada(df: pd.DataFrame, campo: str) -> pd.Series:
    s = df.get(campo, pd.Series([], dtype=str)).fillna("").astype(str)

    if campo == "telefone":
        return s.map(normalizar_telefone_para_filtro)

    s = s.map(remover_acentos).str.lower().str.strip()
    s = s.str.replace(r"\s+", " ", regex=True)
    return s


def aplicar_filtros(df: pd.DataFrame, regras: Iterable[RegraFiltro]) -> pd.DataFrame:
    regras_list = [r for r in regras if (r.valor or "").strip()]
    if df is None or df.empty or not regras_list:
        return df

    mask = pd.Series(True, index=df.index)

    for r in regras_list:
        campo = r.campo
        operador = (r.operador or "").strip().lower()
        valor_norm = _normalizar_valor(campo, r.valor)
        if not valor_norm:
            continue

        serie = _serie_normalizada(df, campo)

        if operador == "igual":
            mask = mask & (serie == valor_norm)
        elif operador == "contem":
            mask = mask & serie.str.contains(re.escape(valor_norm), na=False)
        else:
            mask = mask & (serie == valor_norm)

    return df.loc[mask].copy()
