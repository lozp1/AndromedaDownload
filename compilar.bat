@echo off
title Compilador Andromeda Download Suite
echo ========================================================
echo   ANDROMEDA DOWNLOAD SUITE - COMPILADOR AUTOMATICO .EXE
echo ========================================================
echo.
echo [1/2] Compilando frontend Angular...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Fallo al compilar el frontend de Angular.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] Compilando ejecutable nativo Rust Tokio Tauri (Modo Release)...
call cargo build --manifest-path src-tauri/Cargo.toml --release
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Fallo al compilar el binario nativo en Rust.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo   COMPILACION COMPLETADA CON EXITO!
echo   Ejecutable generado en:
echo   src-tauri\target\release\andromeda_download.exe
echo ========================================================
echo.
pause
