import os
from typing import Any, Dict

import pandas as pd
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from csv_utils import ler_csv_contatos
from csv_formatter import format_dataframe_for_tipo
from job_runner import start_job_thread
from job_utils import coalesce_bool
from job_store import JobStore
from supabase_client import get_supabase_client
from web_security import check_api_key


def build_api_router(store: JobStore, base_dir: str) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.post("/upload")
    async def upload_csv(request: Request, file: UploadFile = File(...)) -> JSONResponse:
        check_api_key(request)

        disparo_tipo = (request.query_params.get("tipo") or "manual").strip().lower()
        job = store.criar_job(file.filename, disparo_tipo)
        content = await file.read()

        with open(job.input_csv_path, "wb") as f:
            f.write(content)

        try:
            df = ler_csv_contatos(job.input_csv_path)
        except Exception as e:
            store.atualizar(job.job_id, status="erro", last_error=str(e))
            raise HTTPException(status_code=400, detail=f"CSV inválido: {str(e)}")

        if disparo_tipo in {"aniversario", "limpeza", "clareamento"}:
            try:
                df = format_dataframe_for_tipo(df, disparo_tipo)
            except ValueError as e:
                store.atualizar(job.job_id, status="erro", last_error=str(e))
                raise HTTPException(status_code=400, detail=str(e))
            df.to_csv(job.input_csv_path, index=False, encoding="utf-8-sig")

        colunas_necessarias = {"nome", "telefone", "cidade"}
        if disparo_tipo in {"aniversario", "limpeza", "clareamento"}:
            colunas_necessarias = {"nome", "telefone", "data"}

        faltando = colunas_necessarias - set(df.columns)
        if faltando:
            store.atualizar(
                job.job_id, status="erro", last_error="colunas obrigatórias ausentes"
            )
            raise HTTPException(
                status_code=400,
                detail=f"CSV precisa conter as colunas: {', '.join(sorted(faltando))}",
            )

        store.atualizar(job.job_id, status="uploaded", total=int(len(df)))

        preview = df.head(5).to_dict(orient="records")
        return JSONResponse(
            {
                "job_id": job.job_id,
                "total": len(df),
                "columns": list(df.columns),
                "preview": preview,
            }
        )

    @router.post("/import-clientes")
    async def import_clientes(request: Request, file: UploadFile = File(...)) -> JSONResponse:
        """
        Recebe um CSV e insere na tabela 'disparos' do Supabase.
        - Campos esperados no CSV após formatação: nome, telefone, data (quando tipo requer data)
        - Para tipo:
            * aniversario  -> grava em data_nascimento
            * limpeza      -> grava em data_limpeza
            * clareamento  -> grava em data_clareamento
        """
        check_api_key(request)

        disparo_tipo = (request.query_params.get("tipo") or "").strip().lower()
        if disparo_tipo not in {"aniversario", "limpeza", "clareamento"}:
            raise HTTPException(status_code=400, detail="tipo inválido; use aniversario, limpeza ou clareamento")

        content = await file.read()
        temp_path = os.path.join(base_dir, f"_temp_import_{file.filename}")
        with open(temp_path, "wb") as f:
            f.write(content)

        try:
            df = ler_csv_contatos(temp_path)
            df = format_dataframe_for_tipo(df, disparo_tipo)
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise HTTPException(status_code=400, detail=f"CSV inválido ou incompleto: {str(e)}")

        # Validação de colunas
        colunas_necessarias = {"nome", "telefone", "data"}
        faltando = colunas_necessarias - set(df.columns)
        if faltando:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise HTTPException(
                status_code=400,
                detail=f"CSV precisa conter as colunas: {', '.join(sorted(faltando))}",
            )

        # Mapeia data -> campo correto
        data_field = {
            "aniversario": "data_nascimento",
            "limpeza": "data_limpeza",
            "clareamento": "data_clareamento",
        }[disparo_tipo]

        # Monta payload para Supabase
        records = []
        for _, row in df.iterrows():
            payload = {
                "nome": str(row["nome"]).strip(),
                "telefone": str(row["telefone"]).strip(),
                data_field: str(row["data"]).strip(),
            }
            records.append(payload)

        # Insere em Supabase
        supabase = get_supabase_client()
        try:
            result = supabase.table("disparos").insert(records).execute()
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise HTTPException(status_code=500, detail=f"Erro ao inserir no Supabase: {str(e)}")

        if os.path.exists(temp_path):
            os.remove(temp_path)

        return JSONResponse({"inserted": len(records), "status": "ok"})

    @router.post("/start")
    async def start_job(request: Request) -> JSONResponse:
        check_api_key(request)

        payload: Dict[str, Any] = await request.json()
        job_id = str(payload.get("job_id", "")).strip()
        if not job_id:
            raise HTTPException(status_code=400, detail="job_id é obrigatório")

        job = store.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="job_id não encontrado")

        if job.status in {"running"}:
            raise HTTPException(status_code=409, detail="job já está em execução")

        store.atualizar(job_id, stop_requested=False)

        message_template = payload.get("message_template")
        delay_seconds = payload.get("delay_seconds")
        request_timeout_seconds = payload.get("request_timeout_seconds")
        batch_size = payload.get("batch_size")
        batch_pause_seconds = payload.get("batch_pause_seconds")
        batch_plan = payload.get("batch_plan")
        only_business_hours = payload.get("only_business_hours")

        if message_template is not None:
            message_template = str(message_template)
        if delay_seconds is not None:
            delay_seconds = int(delay_seconds)
        if request_timeout_seconds is not None:
            request_timeout_seconds = int(request_timeout_seconds)
        if batch_size is not None:
            batch_size = int(batch_size)
        if batch_pause_seconds is not None:
            batch_pause_seconds = int(batch_pause_seconds)

        if only_business_hours is not None:
            only_business_hours = coalesce_bool(only_business_hours, False)

        start_job_thread(
            store=store,
            base_dir=base_dir,
            job_id=job_id,
            message_template=message_template,
            delay_seconds=delay_seconds,
            request_timeout_seconds=request_timeout_seconds,
            batch_size=batch_size,
            batch_pause_seconds=batch_pause_seconds,
            batch_plan=batch_plan,
            only_business_hours=only_business_hours,
        )

        return JSONResponse({"job_id": job_id, "status": "running"})

    @router.post("/stop/{job_id}")
    async def stop_job(job_id: str, request: Request) -> JSONResponse:
        check_api_key(request)

        job = store.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="job_id não encontrado")

        if job.status not in {"running"}:
            return JSONResponse({"job_id": job_id, "status": job.status, "stop_requested": False})

        ok = store.solicitar_parada(job_id)
        return JSONResponse({"job_id": job_id, "status": job.status, "stop_requested": bool(ok)})

    @router.get("/status/{job_id}")
    def status_job(job_id: str, request: Request) -> JSONResponse:
        check_api_key(request)

        job = store.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="job_id não encontrado")

        pct = 0
        if job.total > 0:
            pct = int((job.processed / job.total) * 100)

        return JSONResponse(
            {
                "job_id": job.job_id,
                "status": job.status,
                "stop_requested": bool(getattr(job, "stop_requested", False)),
                "created_at": job.created_at,
                "started_at": job.started_at,
                "finished_at": job.finished_at,
                "total": job.total,
                "processed": job.processed,
                "success": job.success,
                "error": job.error,
                "percent": pct,
                "last_error": job.last_error,
            }
        )

    @router.get("/report/{job_id}")
    def download_report(job_id: str, request: Request) -> FileResponse:
        check_api_key(request)

        job = store.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="job_id não encontrado")

        if not os.path.exists(job.report_csv_path):
            raise HTTPException(status_code=404, detail="relatório ainda não disponível")

        return FileResponse(job.report_csv_path, filename="relatorio_final.csv")

    @router.get("/log/{job_id}")
    def download_log(job_id: str, request: Request) -> FileResponse:
        check_api_key(request)

        job = store.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="job_id não encontrado")

        if not os.path.exists(job.log_path):
            raise HTTPException(status_code=404, detail="log ainda não disponível")

        return FileResponse(job.log_path, filename="execucao.log")

    @router.get("/jobs")
    def list_jobs(request: Request) -> JSONResponse:
        check_api_key(request)
        return JSONResponse(store.listar())

    return router
