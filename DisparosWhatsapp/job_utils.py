from __future__ import annotations

from typing import Any, Dict, Optional


def coalesce_int(value: Any, default: int) -> int:
    if value is None:
        return int(default)
    return int(value)


def coalesce_bool(value: Any, default: bool) -> bool:
    if value is None:
        return bool(default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "sim", "on"}
    return bool(value)


def normalizar_batch_plan(value: Any) -> Optional[list[Dict[str, Any]]]:
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError("batch_plan precisa ser uma lista")

    plan: list[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("batch_plan precisa conter objetos")
        size = item.get("size")
        pause = item.get("pause_seconds")
        if size is None:
            raise ValueError("batch_plan: 'size' é obrigatório")
        plan.append(
            {
                "size": int(size),
                "pause_seconds": int(pause) if pause is not None else 0,
            }
        )

    return plan
