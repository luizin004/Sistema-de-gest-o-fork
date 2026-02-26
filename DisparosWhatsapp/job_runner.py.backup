import os
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Dict, Optional

import requests
from csv_utils import ler_csv_contatos
from config_loader import carregar_config, carregar_env
from integrations import processar_contato
from job_timing import sleep_with_stop_check, wait_until_business_hours
from job_utils import coalesce_bool, coalesce_int, normalizar_batch_plan
from job_store import JobStore
from log_utils import configurar_logger

def run_job(
    store: JobStore,
    base_dir: str,
    job_id: str,
    message_template: Optional[str],
    delay_seconds: Optional[int],
    request_timeout_seconds: Optional[int],
    batch_size: Optional[int],
    batch_pause_seconds: Optional[int],
    batch_plan: Optional[list[Dict[str, Any]]],
    only_business_hours: Optional[bool],
) -> None:
    config = carregar_config(os.path.join(base_dir, "config.json"))
    env = carregar_env()
    job = store.get(job_id)
    if not job:
        return
    template = (message_template or "").strip() or str(config["message_template"])
    delay = coalesce_int(delay_seconds, int(config["delay_seconds"]))
    timeout = coalesce_int(request_timeout_seconds, int(config["request_timeout_seconds"]))
    zapi_client_token = str(env.get("ZAPI_CLIENT_TOKEN", "")).strip() or None
    use_business_hours = coalesce_bool(only_business_hours, bool(config.get("only_business_hours", False)))
    disparo_tipo = (job.disparo_tipo or "manual").strip().lower()

    cfg_batch_size = coalesce_int(config.get("batch_size"), 0)
    cfg_batch_pause = coalesce_int(config.get("batch_pause_seconds"), 0)
    effective_batch_size = coalesce_int(batch_size, cfg_batch_size)
    effective_batch_pause = coalesce_int(batch_pause_seconds, cfg_batch_pause)
    effective_batch_plan = normalizar_batch_plan(batch_plan)
    if effective_batch_plan is None:
        effective_batch_plan = normalizar_batch_plan(config.get("batch_plan")) or []

    logger = configurar_logger(job.log_path, logger_name=f"job_{job_id}")
    store.atualizar(job_id, status="running", started_at=datetime.utcnow().isoformat())
    try:
        df = ler_csv_contatos(job.input_csv_path)
    except Exception as e:
        store.atualizar(job_id, status="erro", last_error=str(e), finished_at=datetime.utcnow().isoformat())
        logger.error("Falha ao ler CSV: %s", str(e))
        return

    colunas_necessarias = {"nome", "telefone", "cidade"}
    if disparo_tipo in {"aniversario", "limpeza", "clareamento"}:
        colunas_necessarias = {"nome", "telefone", "data"}
    faltando = colunas_necessarias - set(df.columns)
    if faltando:
        msg = f"CSV precisa conter as colunas: {', '.join(sorted(faltando))}"
        store.atualizar(job_id, status="erro", last_error=msg, finished_at=datetime.utcnow().isoformat())
        logger.error(msg)
        return

    df["status"] = ""
    def _stop_and_save() -> None:
        df.to_csv(job.report_csv_path, index=False, encoding="utf-8")
        store.atualizar(job_id, status="stopped", finished_at=datetime.utcnow().isoformat())
        logger.info("Transmissão interrompida pelo usuário")

    try:
        with requests.Session() as session:
            with ThreadPoolExecutor(max_workers=2) as executor:
                total = len(df)
                store.atualizar(job_id, total=int(total))

                start = 0
                batch_idx = 0
                while start < total:
                    if effective_batch_plan:
                        spec = effective_batch_plan[min(batch_idx, len(effective_batch_plan) - 1)]
                        size = int(spec.get("size", effective_batch_size) or effective_batch_size)
                        pause = int(spec.get("pause_seconds", effective_batch_pause) or effective_batch_pause)
                    else:
                        size = int(effective_batch_size)
                        pause = int(effective_batch_pause)

                    end = total if size <= 0 else min(start + size, total)

                    for pos in range(start, end):
                        job_state = store.get(job_id)
                        if job_state and bool(getattr(job_state, "stop_requested", False)):
                            _stop_and_save()
                            return

                        if use_business_hours:
                            ok = wait_until_business_hours(store=store, job_id=job_id, logger=logger)
                            if not ok:
                                _stop_and_save()
                                return

                        row = df.iloc[pos]
                        status, _motivo = processar_contato(
                            dados=row.to_dict(),
                            template_msg=template,
                            zapi_url=env["ZAPI_SEND_TEXT_URL"],
                            zapi_client_token=zapi_client_token,
                            timeout=timeout,
                            session=session,
                            executor=executor,
                            logger=logger,
                        )

                        df.at[df.index[pos], "status"] = status
                        store.incrementar(job_id, processed=1)

                        if status == "sucesso":
                            store.incrementar(job_id, success=1)
                        else:
                            store.incrementar(job_id, error=1)

                        if pos < end - 1 and delay > 0:
                            ok = sleep_with_stop_check(store=store, job_id=job_id, seconds=delay)
                            if not ok:
                                _stop_and_save()
                                return

                    start = end
                    batch_idx += 1
                    if start < total and pause > 0:
                        logger.info("Pausa entre lotes: %s segundos", pause)
                        ok = sleep_with_stop_check(store=store, job_id=job_id, seconds=pause)
                        if not ok:
                            _stop_and_save()
                            return

        df.to_csv(job.report_csv_path, index=False, encoding="utf-8")
        store.atualizar(job_id, status="done", finished_at=datetime.utcnow().isoformat())

    except Exception as e:
        store.atualizar(job_id, status="erro", last_error=str(e), finished_at=datetime.utcnow().isoformat())
        logger.error("Falha durante execução do job: %s", str(e))

def start_job_thread(
    store: JobStore,
    base_dir: str,
    job_id: str,
    message_template: Optional[str],
    delay_seconds: Optional[int],
    request_timeout_seconds: Optional[int],
    batch_size: Optional[int],
    batch_pause_seconds: Optional[int],
    batch_plan: Optional[list[Dict[str, Any]]] = None,
    only_business_hours: Optional[bool] = None,
) -> None:
    t = threading.Thread(
        target=run_job,
        args=(
            store,
            base_dir,
            job_id,
            message_template,
            delay_seconds,
            request_timeout_seconds,
            batch_size,
            batch_pause_seconds,
            batch_plan,
            only_business_hours,
        ),
        daemon=True,
    )
    t.start()
