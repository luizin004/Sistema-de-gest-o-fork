@echo off
echo ========================================
echo   Sistema Integrado - Inicializacao
echo ========================================
echo.

echo [1/2] Iniciando Backend Python (porta 8000)...
cd DisparosWhatsapp
start "Backend Python" cmd /k "python -m uvicorn web_server:app --host 127.0.0.1 --port 8000"
timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Frontend React (porta 8080)...
cd ..\data-post-orchestrator-main
start "Frontend React" cmd /k "npm run dev"

echo.
echo ========================================
echo   Sistema iniciado com sucesso!
echo ========================================
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:8080
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
