@echo off
title FullHouse Inversiones C.A - Iniciando...
cd /d "%~dp0"

echo ========================================================
echo   FullHouse Inversiones C.A - Sistema de Inventario y POS
echo ========================================================
echo.
echo Iniciando aplicacion local en modo ventana independiente...
echo.

set "INDEX_PATH=%~dp0index.html"
set "EDGE_PATH1=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE_PATH2=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE_PATH1%" (
    start "" "%EDGE_PATH1%" --app="file:///%INDEX_PATH%" --allow-file-access-from-files --start-maximized
    exit
)

if exist "%EDGE_PATH2%" (
    start "" "%EDGE_PATH2%" --app="file:///%INDEX_PATH%" --allow-file-access-from-files --start-maximized
    exit
)

:: Si no se encuentra Edge en rutas habituales, abrir con el navegador predeterminado
start "" "%INDEX_PATH%"
exit
