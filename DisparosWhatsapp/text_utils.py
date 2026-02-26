import math
import re
from typing import Any, Dict


def limpar_telefone(valor: Any) -> str:
    if valor is None:
        return ""
    texto = str(valor)
    return re.sub(r"\D+", "", texto)


class _SafeDict(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def _valor_para_str(valor: Any) -> str:
    if valor is None:
        return ""
    if isinstance(valor, float) and math.isnan(valor):
        return ""
    return str(valor)


def renderizar_mensagem(template: str, dados: Dict[str, Any]) -> str:
    dados_str = {str(k): _valor_para_str(v) for k, v in dados.items()}
    return template.format_map(_SafeDict(dados_str))
