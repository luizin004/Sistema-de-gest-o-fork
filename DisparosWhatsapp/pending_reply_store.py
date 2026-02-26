import json
import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class PendingReplyEntry:
    phone: str
    webhook_url: str
    sent_at_epoch: float
    sent_at_iso: str
    contact_payload: Dict[str, Any]
    job_id: Optional[str] = None


class PendingReplyStore:
    def __init__(self, base_dir: str, filename: str = "pending_replies.json") -> None:
        self._lock = threading.Lock()
        self._path = os.path.join(base_dir, "data", filename)
        os.makedirs(os.path.dirname(self._path), exist_ok=True)

    def register(
        self,
        phone: str,
        webhook_url: str,
        contact_payload: Dict[str, Any],
        sent_at_iso: str,
        job_id: Optional[str] = None,
    ) -> None:
        if not phone:
            return

        entry = {
            "phone": str(phone),
            "webhook_url": str(webhook_url),
            "sent_at_epoch": float(time.time()),
            "sent_at_iso": str(sent_at_iso),
            "contact_payload": dict(contact_payload),
            "job_id": str(job_id) if job_id is not None else None,
        }

        with self._lock:
            data = self._read_all_unlocked()
            data[str(phone)] = entry
            self._write_all_unlocked(data)

    def consume_if_eligible(
        self, phone: str, window_seconds: int
    ) -> Optional[PendingReplyEntry]:
        if not phone:
            return None

        now = time.time()

        with self._lock:
            data = self._read_all_unlocked()
            raw = data.get(str(phone))
            if not isinstance(raw, dict):
                return None

            try:
                sent_at = float(raw.get("sent_at_epoch", 0.0))
            except (TypeError, ValueError):
                sent_at = 0.0

            if window_seconds > 0 and (now - sent_at) > float(window_seconds):
                return None

            data.pop(str(phone), None)
            self._write_all_unlocked(data)

            return PendingReplyEntry(
                phone=str(raw.get("phone", phone)),
                webhook_url=str(raw.get("webhook_url", "")),
                sent_at_epoch=sent_at,
                sent_at_iso=str(raw.get("sent_at_iso", "")),
                contact_payload=dict(raw.get("contact_payload") or {}),
                job_id=str(raw.get("job_id")) if raw.get("job_id") is not None else None,
            )

    def _read_all_unlocked(self) -> Dict[str, Any]:
        if not os.path.exists(self._path):
            return {}
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return dict(data) if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _write_all_unlocked(self, data: Dict[str, Any]) -> None:
        tmp = self._path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, self._path)
