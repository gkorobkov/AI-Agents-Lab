@echo off
setlocal EnableExtensions

if /i "%~1"=="--help" goto help
if /i "%~1"=="-h" goto help
if /i "%~1"=="/?" goto help

call "%~dp0ui-build.cmd" %*
if errorlevel 1 exit /b 1
call "%~dp0ui-deploy.cmd"
exit /b 0

:help
    echo Usage: ui-build-deploy.cmd [options]
    echo.
    echo Forwarded to ui-build.cmd:
    echo   --quiet, -q
    echo   --set-version VALUE
    echo   --no-increment
    echo   --skip-version
    echo   --no-version-bump
    echo   --help, -h, /?
    echo.
    echo Examples:
    echo   ui-build-deploy.cmd
    echo   ui-build-deploy.cmd --quiet
    echo   ui-build-deploy.cmd --no-increment
    echo   ui-build-deploy.cmd --skip-version --quiet
    echo   ui-build-deploy.cmd --help
    exit /b 0