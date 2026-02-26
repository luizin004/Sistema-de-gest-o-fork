from __future__ import annotations

import time
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from business_hours import (
    BusinessHoursConfig,
    next_business_time,
    seconds_until_next_business_time,
)
from job_store import JobStore


def sleep_with_stop_check(
    store: JobStore,
    job_id: str,
    seconds: int,
    step_seconds: int = 2,
) -> bool:
    remaining = int(seconds)
    if remaining <= 0:
        return True

    step = int(step_seconds)
    if step <= 0:
        step = 1

    while remaining > 0:
        job = store.get(job_id)
        if job and bool(getattr(job, "stop_requested", False)):
            return False

        chunk = step if remaining > step else remaining
        time.sleep(chunk)
        remaining -= chunk

    return True


def wait_until_business_hours(
    store: JobStore,
    job_id: str,
    logger,
    cfg: Optional[BusinessHoursConfig] = None,
) -> bool:
    effective_cfg = cfg or BusinessHoursConfig()

    while True:
        job = store.get(job_id)
        if job and bool(getattr(job, "stop_requested", False)):
            return False

        now = datetime.now(ZoneInfo(effective_cfg.tz_name))
        seconds = seconds_until_next_business_time(now, effective_cfg)
        if seconds <= 0:
            logger.info("Dentro do horário comercial. Retomando execução")
            return True

        target = next_business_time(now, effective_cfg)
        logger.info(
            "Fora do horário comercial. Aguardando até %s (%s segundos)",
            target.isoformat(),
            seconds,
        )

        ok = sleep_with_stop_check(store=store, job_id=job_id, seconds=seconds)
        if not ok:
            return False
