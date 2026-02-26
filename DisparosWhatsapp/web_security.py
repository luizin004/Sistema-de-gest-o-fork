import os

from fastapi import HTTPException, Request


def get_env_api_key() -> str:
    return os.getenv("API_KEY", "").strip()


def check_api_key(request: Request) -> None:
    api_key = get_env_api_key()
    if not api_key:
        return

    sent = request.headers.get("x-api-key", "").strip()
    if sent != api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "*").strip()
    if raw == "*":
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]
