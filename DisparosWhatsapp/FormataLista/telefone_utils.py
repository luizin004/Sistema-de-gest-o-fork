import re
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class TelefoneFormatoConfig:
    incluir_ddi: bool = False
    incluir_ddd: bool = True
    incluir_nono_digito: Optional[bool] = None


def _apenas_digitos(valor: object) -> str:
    return re.sub(r"\D+", "", str(valor or "")).strip()


def _remover_ddi55_se_fizer_sentido(digitos: str) -> str:
    # Só remove DDI se começar com "55" E o restante tiver tamanho válido E não começar com DDD brasileiro comum
    if digitos.startswith("55") and len(digitos[2:]) in (8, 9, 10, 11):
        # Verificar se não é um DDD brasileiro (11-99) seguido do número
        resto = digitos[2:]
        if len(resto) >= 2:
            # Se os primeiros 2 dígitos do resto formam um DDD brasileiro (11-99), não remover
            if 11 <= int(resto[:2]) <= 99:
                return digitos
        return digitos[2:]
    return digitos


def normalizar_telefone_base(telefone: object) -> str:
    tel = _apenas_digitos(telefone)
    print(f"[DEBUG telefone_utils] Telefone original: {telefone}, Apenas dígitos: {tel}")
    tel = _remover_ddi55_se_fizer_sentido(tel)
    print(f"[DEBUG telefone_utils] Após remover DDI: {tel}, Tamanho: {len(tel)}")

    if len(tel) > 11:
        tel = tel[-11:]

    if len(tel) not in (10, 11):
        print(f"[DEBUG telefone_utils] Telefone rejeitado - tamanho inválido: {len(tel)}")
        return ""

    print(f"[DEBUG telefone_utils] Telefone normalizado: {tel}")
    return tel


def _aplicar_nono_digito(tel_com_ddd: str, incluir_nono_digito: Optional[bool]) -> str:
    if incluir_nono_digito is None:
        return tel_com_ddd

    if incluir_nono_digito:
        if len(tel_com_ddd) == 11:
            return tel_com_ddd
        if len(tel_com_ddd) == 10:
            return f"{tel_com_ddd[:2]}9{tel_com_ddd[2:]}"
        return ""

    if len(tel_com_ddd) == 10:
        return tel_com_ddd

    if len(tel_com_ddd) == 11:
        if tel_com_ddd[2:3] == "9":
            return f"{tel_com_ddd[:2]}{tel_com_ddd[3:]}"
        return tel_com_ddd

    return ""


def formatar_telefone_configuravel(telefone: object, config: TelefoneFormatoConfig) -> str:
    tel = normalizar_telefone_base(telefone)
    if not tel:
        return ""

    tel = _aplicar_nono_digito(tel, config.incluir_nono_digito)
    if not tel:
        return ""

    if not config.incluir_ddd:
        tel = tel[2:]

    if config.incluir_ddi:
        tel = f"55{tel}"

    return tel


def normalizar_telefone_para_filtro(telefone: object) -> str:
    tel = _apenas_digitos(telefone)
    tel = _remover_ddi55_se_fizer_sentido(tel)

    if len(tel) > 11:
        tel = tel[-11:]

    return tel
