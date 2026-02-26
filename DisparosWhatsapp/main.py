import argparse
import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import pandas as pd
import requests

from csv_utils import ler_csv_contatos
from config_loader import carregar_config, carregar_env
from integrations import processar_contato
from job_timing import wait_until_business_hours
from log_utils import configurar_logger


class _DummyStore:
    def get(self, _job_id: str):
        return None


def _validar_csv_entrada(caminho_csv: str) -> None:
    if not os.path.exists(caminho_csv):
        raise FileNotFoundError(
            f"Arquivo CSV não encontrado: '{caminho_csv}'. "
            "Coloque o arquivo na pasta do projeto ou informe um caminho válido em --input."
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Disparo WhatsApp (Z-API) + Webhook via CSV"
    )
    parser.add_argument("--input", default="contatos.csv", help="CSV de entrada")
    parser.add_argument(
        "--output", default="relatorio_final.csv", help="CSV de saída"
    )
    parser.add_argument("--config", default="config.json", help="Arquivo de configuração")
    parser.add_argument("--log", default="execucao.log", help="Arquivo de log")
    parser.add_argument("--batch-size", type=int, default=None, help="Tamanho do lote")
    parser.add_argument(
        "--batch-pause-seconds",
        type=int,
        default=None,
        help="Pausa entre lotes (segundos)",
    )
    args = parser.parse_args()

    logger = configurar_logger(args.log)

    try:
        config = carregar_config(args.config)
        env = carregar_env()
        _validar_csv_entrada(args.input)
    except Exception as e:
        logger.error("Falha ao iniciar: %s", str(e))
        raise

    df = ler_csv_contatos(args.input)

    colunas_necessarias = {"nome", "telefone", "cidade"}
    faltando = colunas_necessarias - set(df.columns)
    if faltando:
        raise ValueError(f"CSV precisa conter as colunas: {', '.join(sorted(faltando))}")

    df["status"] = ""

    delay = int(config["delay_seconds"])
    timeout = int(config["request_timeout_seconds"])
    template_msg = str(config["message_template"])
    zapi_client_token = str(env.get("ZAPI_CLIENT_TOKEN", "")).strip() or None

    batch_size = int(args.batch_size) if args.batch_size is not None else int(config.get("batch_size", 0))
    batch_pause_seconds = (
        int(args.batch_pause_seconds)
        if args.batch_pause_seconds is not None
        else int(config.get("batch_pause_seconds", 0))
    )

    use_business_hours = bool(config.get("only_business_hours", False))

    with requests.Session() as session:
        with ThreadPoolExecutor(max_workers=2) as executor:
            total = len(df)
            start = 0
            while start < total:
                end = total if batch_size <= 0 else min(start + batch_size, total)

                for pos in range(start, end):
                    if use_business_hours:
                        wait_until_business_hours(
                            store=_DummyStore(),
                            job_id="cli",
                            logger=logger,
                        )
                    row = df.iloc[pos]
                    status, _motivo = processar_contato(
                        dados=row.to_dict(),
                        template_msg=template_msg,
                        zapi_url=env["ZAPI_SEND_TEXT_URL"],
                        zapi_client_token=zapi_client_token,
                        timeout=timeout,
                        session=session,
                        executor=executor,
                        logger=logger,
                    )

                    df.at[df.index[pos], "status"] = status

                    if pos < total - 1 and delay > 0:
                        time.sleep(delay)

                start = end
                if start < total and batch_pause_seconds > 0:
                    logger.info("Pausa entre lotes: %s segundos", batch_pause_seconds)
                    time.sleep(batch_pause_seconds)

    df.to_csv(args.output, index=False, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
