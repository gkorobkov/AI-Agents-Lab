@echo off
setlocal EnableExtensions

set "QUIET=0"
set "NO_INCREMENT=0"
set "SHOW_HELP=0"

:parse_args
if "%~1"=="" goto parse_done
if /i "%~1"=="--quiet" (set "QUIET=1" & shift & goto parse_args)
if /i "%~1"=="-q"      (set "QUIET=1" & shift & goto parse_args)
if /i "%~1"=="--no-increment" (set "NO_INCREMENT=1" & shift & goto parse_args)
if /i "%~1"=="--skip-version" (set "NO_INCREMENT=1" & shift & goto parse_args)
if /i "%~1"=="--no-version-bump" (set "NO_INCREMENT=1" & shift & goto parse_args)
if /i "%~1"=="/no-increment" (set "NO_INCREMENT=1" & shift & goto parse_args)
if /i "%~1"=="/skip-version" (set "NO_INCREMENT=1" & shift & goto parse_args)
if /i "%~1"=="--help" (set "SHOW_HELP=1" & shift & goto parse_args)
if /i "%~1"=="-h"     (set "SHOW_HELP=1" & shift & goto parse_args)
if /i "%~1"=="/?"     (set "SHOW_HELP=1" & shift & goto parse_args)
echo ERROR: Unknown option: %~1
call :print_help
exit /b 1

:parse_done
if "%SHOW_HELP%"=="1" (
    call :print_help
    exit /b 0
)

set ROOT=%~dp0
set BUILD_DIR=%ROOT%.build
set UI_SRC=%ROOT%ui\index.html
set UI_DIR=%ROOT%ui
set UI_DST=%BUILD_DIR%\ui

if "%QUIET%"=="0" echo Build root: %ROOT%

if not exist "%UI_DST%" mkdir "%UI_DST%"

rem Update APP_VERSION and local asset URLs together; no extra script file is needed.
node -e "const fs=require('fs');try{const file=process.env.UI_SRC;const original=fs.readFileSync(file,'utf8');const pattern=/(APP_VERSION = \x27)((?:\d+\.){0,3}\d+)(\x27)/;const match=original.match(pattern);if(!match)throw new Error('APP_VERSION must be 1 to 4 dot-separated numeric parts');let version=match[2];if(process.env.NO_INCREMENT!=='1'){const parts=version.split('.');parts[parts.length-1]=String(BigInt(parts[parts.length-1])+1n);version=parts.join('.');}let html=original.replace(pattern,(_,prefix,old,suffix)=>prefix+version+suffix);html=html.replace(/(<(?:script|link)\b[^>]*?\b(?:src|href)=\x22)(?![a-z]+:|\/)([^\x22?]+\.(?:css|js))(?:\?[^\x22]*)?(\x22)/gi,(_,prefix,asset,suffix)=>prefix+asset+'?v='+version+suffix);if(html!==original)fs.writeFileSync(file,html,'utf8');if(process.env.QUIET!=='1'){if(process.env.NO_INCREMENT==='1')console.log('[SKIP] Version increment disabled');console.log('[OK] Version: v'+version);}}catch(error){console.error('ERROR: '+error.message);process.exitCode=1;}"
if errorlevel 1 (
    echo ERROR: Failed to prepare UI version and assets.
    exit /b 1
)

xcopy /Y /Q /E /I "%UI_DIR%\*" "%UI_DST%\" >nul
if errorlevel 1 (
    echo ERROR: Failed to copy UI files
    exit /b 1
)

if "%QUIET%"=="0" (
    echo [OK] Copying .\ui\* --^> .\.build\ui\
    for %%f in ("%UI_DIR%\*") do echo     .\ui\%%~nxf
)
exit /b 0

:print_help
    echo Usage: ui-build.cmd [options]
    echo.
    echo Options:
    echo   --quiet, -q                 Quiet mode; suppress build logs.
    echo   --no-increment              Build without updating APP_VERSION.
    echo   --skip-version              Alias for --no-increment.
    echo   --no-version-bump           Alias for --no-increment.
    echo   --help, -h, /?              Show this help text.
    echo.
    echo Requires Node.js.
    echo.
    echo Version rule:
    echo   APP_VERSION accepts 1 to 4 dot-separated numeric parts.
    echo   Examples: 1, 1.2, 1.2.3, 1.2.3.4
    echo   On increment, only the final segment is increased.
    echo   Local CSS and JS URLs use APP_VERSION as their cache version.
    echo   --no-increment keeps these URLs unchanged.
    echo   Examples: 1 -> 2; 1.2 -> 1.3; 1.2.3 -> 1.2.4; 1.2.3.4 -> 1.2.3.5
    echo.
    echo Examples:
    echo   ui-build.cmd
    echo   ui-build.cmd --quiet
    echo   ui-build.cmd --no-increment
    echo   ui-build.cmd --skip-version --quiet
    echo   ui-build.cmd --help
    exit /b 0

