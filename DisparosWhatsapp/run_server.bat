@echo off
setlocal

REM Inicia o servidor FastAPI (Uvicorn) a partir da pasta deste script
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Porta opcional: run_server.bat 8001
set "HOST=127.0.0.1"
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8000"

REM Ativa virtualenv se existir
if exist ".venv\Scripts\activate.bat" (
  call ".venv\Scripts\activate.bat"
) else if exist "venv\Scripts\activate.bat" (
  call "venv\Scripts\activate.bat"
)

echo ----------------------------------------
echo Subindo servidor em http://%HOST%:%PORT%
echo (CTRL+C para parar)
echo ----------------------------------------

python -m uvicorn web_server:app --host %HOST% --port %PORT%

echo.
echo Servidor finalizado.
pause
