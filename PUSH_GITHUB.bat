@echo off
echo ========================================
echo   Push para GitHub - Brumadinho Sistema
echo ========================================
echo.
echo Aguarde...
echo.

git remote add origin https://github.com/luizin004/brumadinho-sistema.git
git branch -M main
git push -u origin main

echo.
echo ========================================
echo   Push concluido!
echo ========================================
echo.
echo Acesse: https://github.com/luizin004/brumadinho-sistema
echo.
pause
