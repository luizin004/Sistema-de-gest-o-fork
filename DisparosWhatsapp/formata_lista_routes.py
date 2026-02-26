import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'FormataLista'))

from lead_processor import (
    detectar_separador_csv,
    identificar_colunas,
    ler_csv_flexivel,
    ler_excel_flexivel,
    processar_leads,
    separador_padrao_excel,
)
from lead_filters import aplicar_filtros, RegraFiltro
from telefone_utils import TelefoneFormatoConfig
from smart_column_detector import identificar_colunas_inteligente
from web_security import check_api_key


class TelefoneConfig(BaseModel):
    incluir_ddi: bool = False
    incluir_ddd: bool = True
    incluir_nono_digito: Optional[bool] = None


class FiltroConfig(BaseModel):
    campo: str
    operador: str
    valor: str


class ProcessarRequest(BaseModel):
    telefone_config: TelefoneConfig
    apenas_primeiro_nome: bool = False
    filtros: list[FiltroConfig] = []


def build_formata_lista_router(base_dir: str) -> APIRouter:
    router = APIRouter(prefix="/api/formata-lista")
    
    temp_storage: Dict[str, Dict[str, Any]] = {}

    @router.post("/upload")
    async def upload_arquivo(request: Request, file: UploadFile = File(...)) -> JSONResponse:
        check_api_key(request)

        ext = Path(file.filename or "").suffix.lower()
        if ext not in (".csv", ".xlsx", ".xls"):
            raise HTTPException(
                status_code=400,
                detail="Arquivo deve ser .csv, .xlsx ou .xls"
            )

        content = await file.read()
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        temp_file.write(content)
        temp_file.close()
        
        try:
            if ext == ".csv":
                sep = detectar_separador_csv(temp_file.name)
                df = ler_csv_flexivel(temp_file.name, sep)
            else:
                df = ler_excel_flexivel(temp_file.name)
                sep = ""
        except Exception as e:
            os.unlink(temp_file.name)
            raise HTTPException(
                status_code=400,
                detail=f"Erro ao ler arquivo: {str(e)}"
            )

        # Tenta primeiro com o detector inteligente (analisa conteúdo)
        colunas_dict = identificar_colunas_inteligente(df)
        
        # Se falhar, tenta o método antigo (apenas por nome)
        if not colunas_dict:
            colunas_obj = identificar_colunas(df)
            if colunas_obj:
                colunas_dict = {
                    "nome": colunas_obj.nome,
                    "telefone": colunas_obj.telefone,
                    "indicante": colunas_obj.indicante
                }
        
        if not colunas_dict:
            os.unlink(temp_file.name)
            raise HTTPException(
                status_code=400,
                detail="Não foi possível identificar as colunas (nome, telefone, indicante). Verifique se o arquivo contém pelo menos colunas de nome e telefone."
            )
        
        # Converte dict para objeto ColunasMapeadas para compatibilidade
        from lead_processor import ColunasMapeadas
        colunas = ColunasMapeadas(
            nome=colunas_dict["nome"],
            telefone=colunas_dict["telefone"],
            indicante=colunas_dict["indicante"]
        )

        session_id = os.path.basename(temp_file.name)
        temp_storage[session_id] = {
            "df": df,
            "colunas": colunas,
            "temp_path": temp_file.name,
            "separador": sep,
            "filename": file.filename
        }

        preview = df.head(10).to_dict(orient="records")
        
        return JSONResponse({
            "session_id": session_id,
            "filename": file.filename,
            "total_linhas": len(df),
            "colunas_detectadas": {
                "nome": colunas.nome,
                "telefone": colunas.telefone,
                "indicante": colunas.indicante
            },
            "separador": sep if sep else "Excel",
            "preview": preview
        })

    @router.post("/processar/{session_id}")
    async def processar_arquivo(
        session_id: str,
        request: Request,
        config: ProcessarRequest
    ) -> FileResponse:
        check_api_key(request)

        if session_id not in temp_storage:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")

        data = temp_storage[session_id]
        df = data["df"]
        colunas = data["colunas"]

        try:
            print(f"[DEBUG] Colunas detectadas: nome={colunas.nome}, telefone={colunas.telefone}, indicante={colunas.indicante}")
            print(f"[DEBUG] Primeiras linhas do DataFrame:")
            print(df.head(3))
            print(f"[DEBUG] Valores da coluna telefone: {df[colunas.telefone].head(3).tolist()}")
            
            tel_config = TelefoneFormatoConfig(
                incluir_ddi=config.telefone_config.incluir_ddi,
                incluir_ddd=config.telefone_config.incluir_ddd,
                incluir_nono_digito=config.telefone_config.incluir_nono_digito
            )

            df_processado = processar_leads(
                df,
                colunas,
                telefone_config=tel_config,
                apenas_primeiro_nome=config.apenas_primeiro_nome
            )
            
            print(f"[DEBUG] DataFrame processado:")
            print(df_processado.head(3))

            if config.filtros:
                regras = [
                    RegraFiltro(
                        campo=f.campo,
                        operador=f.operador,
                        valor=f.valor
                    )
                    for f in config.filtros
                ]
                df_processado = aplicar_filtros(df_processado, regras)

            output_path = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=".csv",
                mode="w",
                encoding="utf-8-sig"
            )
            output_path.close()

            sep_saida = separador_padrao_excel()
            df_processado.to_csv(
                output_path.name,
                index=False,
                sep=sep_saida,
                encoding="utf-8-sig"
            )

            return FileResponse(
                output_path.name,
                filename="leads_formatado.csv",
                media_type="text/csv"
            )

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Erro ao processar: {str(e)}"
            )

    @router.delete("/session/{session_id}")
    async def limpar_sessao(session_id: str, request: Request) -> JSONResponse:
        check_api_key(request)

        if session_id in temp_storage:
            data = temp_storage[session_id]
            if os.path.exists(data["temp_path"]):
                os.unlink(data["temp_path"])
            del temp_storage[session_id]
        
        return JSONResponse({"status": "ok"})

    return router
