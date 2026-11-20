@echo off
setlocal EnableExtensions

if /i "%~1"=="--help" goto help
if /i "%~1"=="-h" goto help
if /i "%~1"=="/?" goto help

rem Dependencies: launch each in the background, in declaration order.
rem Add further dependency launches here before starting the UI.
set "ENV_FILE=%~dp0.env"
if not exist "%ENV_FILE%" (
    echo ERROR: .env file not found.
    exit /b 1
)
set "PROXY_SCRIPT="
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if /i "%%A"=="PROXY_SCRIPT" set "PROXY_SCRIPT=%%~B"
)
if not defined PROXY_SCRIPT (
    echo ERROR: PROXY_SCRIPT not set in .env.
    exit /b 1
)
if not exist "%PROXY_SCRIPT%" (
    echo ERROR: Proxy startup script not found: "%PROXY_SCRIPT%"
    exit /b 1
)
for %%I in ("%PROXY_SCRIPT%") do set "PROXY_DIR=%%~dpI"
echo Starting proxy in the background...
start "" /b /d "%PROXY_DIR%" "%ComSpec%" /d /c call "%PROXY_SCRIPT%"
if errorlevel 1 exit /b 1

rem Application: start immediately, without waiting for dependency readiness.
call "%~dp0ui-start.cmd" %*
exit /b %errorlevel%

:help
echo Usage: proj-start.cmd [port]
echo.
echo Starts the proxy first, then the UI without waiting for the proxy to be ready.
echo Optional port is forwarded to ui-start.cmd.
echo Proxy launcher path is read from PROXY_SCRIPT in the adjacent .env file.
echo.
echo Examples:
echo   proj-start.cmd
echo   proj-start.cmd 18743
exit /b 0
