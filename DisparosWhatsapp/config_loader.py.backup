import json
import os
from typing import Any, Dict

from dotenv import load_dotenv


def carregar_config(caminho_config: str) -> Dict[str, Any]:
    with open(caminho_config, "r", encoding="utf-8") as f:
        config = json.load(f)

    if "message_template" not in config:
        raise ValueError("config.json precisa conter 'message_template'.")

    if "delay_seconds" not in config:
        raise ValueError("config.json precisa conter 'delay_seconds'.")

    if "request_timeout_seconds" not in config:
        config["request_timeout_seconds"] = 30

    if "batch_size" not in config:
        config["batch_size"] = 0

    if "batch_pause_seconds" not in config:
        config["batch_pause_seconds"] = 0

    if "batch_plan" not in config:
        config["batch_plan"] = []

    if "only_business_hours" not in config:
        config["only_business_hours"] = False

    return config


def carregar_env() -> Dict[str, str]:
    load_dotenv()

    base_url = os.getenv("ZAPI_BASE_URL", "").strip().rstrip("/")
    instance_id = os.getenv("ZAPI_INSTANCE_ID", "").strip()
    token = os.getenv("ZAPI_TOKEN", "").strip()
    client_token = os.getenv("ZAPI_CLIENT_TOKEN", "").strip()

    faltando = [
        nome
        for nome, valor in {
            "ZAPI_BASE_URL": base_url,
            "ZAPI_INSTANCE_ID": instance_id,
            "ZAPI_TOKEN": token,
        }.items()
        if not valor
    ]
    if faltando:
        raise ValueError(f"Variáveis de ambiente ausentes: {', '.join(faltando)}")

    zapi_send_text_url = f"{base_url}/instances/{instance_id}/token/{token}/send-text"

    return {
        "ZAPI_SEND_TEXT_URL": zapi_send_text_url,
        "ZAPI_CLIENT_TOKEN": client_token,
    }
