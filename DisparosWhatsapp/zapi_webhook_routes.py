import os
import time
from typing import Any, Dict, Optional

import requests
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from pending_reply_store import PendingReplyStore
from text_utils import limpar_telefone


def _extract_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _find_value_by_keys(payload: Any, keys: set[str]) -> str:
    stack = [payload]
    while stack:
        cur = stack.pop()
        if isinstance(cur, dict):
            for k, v in cur.items():
                if str(k).lower() in keys:
                    s = _extract_str(v)
                    if s:
                        return s
                if isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(cur, list):
            for item in cur:
                if isinstance(item, (dict, list)):
                    stack.append(item)
    return ""


def _extract_phone(payload: Dict[str, Any]) -> str:
    candidate = _find_value_by_keys(
        payload,
        {
            "phone",
            "from",
            "sender",
            "senderphone",
            "phonenumber",
            "number",
            "chatid",
            "jid",
            "remotejid",
        },
    )
    cleaned = limpar_telefone(candidate)
    return cleaned


def _extract_message_text(payload: Dict[str, Any]) -> str:
    candidate = _find_value_by_keys(
        payload,
        {
            "text",
            "message",
            "body",
            "content",
            "caption",
        },
    )
    return candidate


def _get_inbound_secret_from_request(request: Request) -> str:
    header = request.headers.get("x-webhook-secret", "").strip()
    if header:
        return header
    return request.query_params.get("secret", "").strip()


def build_zapi_webhook_router(
    pending_store: PendingReplyStore,
) -> APIRouter:
    router = APIRouter(prefix="/webhook/zapi")

    @router.post("/received")
    async def received(request: Request) -> JSONResponse:
        expected = os.getenv("WEBHOOK_INBOUND_SECRET", "").strip()
        if expected:
            sent = _get_inbound_secret_from_request(request)
            if sent != expected:
                return JSONResponse({"ok": False, "error": "unauthorized"}, status_code=401)

        try:
            body: Dict[str, Any] = await request.json()
        except Exception:
            return JSONResponse({"ok": True, "ignored": "invalid_json"})

        phone = _extract_phone(body)
        if not phone:
            return JSONResponse({"ok": True, "ignored": "no_phone"})

        try:
            window_seconds = int(os.getenv("REPLY_WINDOW_SECONDS", "86400") or "86400")
        except ValueError:
            window_seconds = 86400

        entry = pending_store.consume_if_eligible(phone=phone, window_seconds=window_seconds)
        if not entry:
            return JSONResponse({"ok": True, "ignored": "not_pending"})

        webhook_url = (entry.webhook_url or "").strip()
        if not webhook_url:
            return JSONResponse({"ok": True, "ignored": "no_webhook_url"})

        reply_text = _extract_message_text(body)
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        outgoing = dict(entry.contact_payload)
        outgoing["reply"] = {
            "received_at": now_iso,
            "text": reply_text,
            "from_phone": phone,
            "raw": body,
        }

        try:
            timeout = int(os.getenv("REPLY_WEBHOOK_TIMEOUT_SECONDS", "30") or "30")
        except ValueError:
            timeout = 30

        def _post() -> int:
            resp = requests.post(webhook_url, json=outgoing, timeout=timeout)
            return int(resp.status_code)

        try:
            status_code = await run_in_threadpool(_post)
        except Exception as e:
            return JSONResponse({"ok": True, "webhook_ok": False, "error": str(e)[:500]})

        return JSONResponse({"ok": True, "webhook_ok": 200 <= status_code < 300, "webhook_status": status_code})

    return router
