from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional, Tuple

import requests

from text_utils import limpar_telefone, renderizar_mensagem


def enviar_zapi(
    session: requests.Session,
    url: str,
    telefone: str,
    mensagem: str,
    timeout: int,
    client_token: Optional[str],
) -> Tuple[bool, str]:
    payload = {"phone": telefone, "message": mensagem}
    try:
        headers = {}
        if client_token:
            headers["Client-Token"] = client_token
        resp = session.post(url, json=payload, timeout=timeout, headers=headers or None)
        if 200 <= resp.status_code < 300:
            return True, f"HTTP {resp.status_code}"
        return False, f"HTTP {resp.status_code} | {resp.text[:500]}"
    except requests.RequestException as e:
        return False, str(e)


def processar_contato(
    dados: Dict[str, Any],
    template_msg: str,
    zapi_url: str,
    zapi_client_token: Optional[str],
    timeout: int,
    session: requests.Session,
    executor: ThreadPoolExecutor,
    logger,
) -> Tuple[str, str]:
    telefone_limpo = limpar_telefone(dados.get("telefone"))

    if not telefone_limpo:
        logger.error(
            "Telefone inválido | nome=%s | telefone=%s",
            dados.get("nome"),
            dados.get("telefone"),
        )
        return "erro", "telefone inválido"

    dados_msg = dict(dados)
    dados_msg["telefone_limpo"] = telefone_limpo

    mensagem = renderizar_mensagem(template_msg, dados_msg)

    futuro_zapi = executor.submit(
        enviar_zapi, session, zapi_url, telefone_limpo, mensagem, timeout, zapi_client_token
    )

    ok_zapi, detalhe_zapi = futuro_zapi.result()

    if ok_zapi:
        logger.info(
            "Sucesso | nome=%s | telefone=%s | cidade=%s | zapi=%s",
            dados.get("nome"),
            telefone_limpo,
            dados.get("cidade"),
            detalhe_zapi,
        )
        return "sucesso", ""

    logger.error(
        "Erro | nome=%s | telefone=%s | cidade=%s | zapi_ok=%s (%s)",
        dados.get("nome"),
        telefone_limpo,
        dados.get("cidade"),
        ok_zapi,
        detalhe_zapi,
    )
    return "erro", "falha ao enviar mensagem"
