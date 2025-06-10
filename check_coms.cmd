@echo off
setlocal enabledelayedexpansion
title Monitor de Portas COM

:repeat
CLS
color 0A
echo.
echo ========================================
echo       MONITORAMENTO DE PORTAS COM
echo ========================================
echo.

echo Detectando portas disponíveis...
echo.

mode | find "COM" | find /v "COM1:" | find /v "COM2:" | find /v "COM3:" > %temp%\temp.txt

set "PortasEncontradas=0"
for /f "tokens=4* delims=: " %%i in (%temp%\temp.txt) do (
    echo  [!PortasEncontradas!] PORTA: %%i %%j
    set /a PortasEncontradas+=1
)

if !PortasEncontradas! EQU 0 (
    echo.
    echo  * Nenhuma porta COM relevante detectada *
)

del %temp%\temp.txt
echo.
echo ========================================
echo  Atualizando a cada 3 segundos... 
echo  Pressione CTRL+C para sair
echo ========================================
echo.
timeout 3 > nul
goto repeat
endlocal
exit