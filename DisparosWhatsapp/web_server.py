import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api_routes import build_api_router
from formata_lista_routes import build_formata_lista_router
from job_store import JobStore
from web_security import cors_origins


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(title="Sistema de Formatação e Disparos WhatsApp")

_cors_origins = cors_origins()
_allow_credentials = not (len(_cors_origins) == 1 and _cors_origins[0] == "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = JobStore(BASE_DIR)
app.include_router(build_api_router(store=store, base_dir=BASE_DIR))
app.include_router(build_formata_lista_router(base_dir=BASE_DIR))

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index() -> FileResponse:
    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.exists(index_path):
        raise HTTPException(status_code=500, detail="UI não encontrada")
    return FileResponse(index_path, media_type="text/html")
