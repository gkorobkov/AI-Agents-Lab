@echo off
setlocal EnableExtensions

set "QUIET=0"
set "NO_INCREMENT=0"
set "SHOW_HELP=0"
set "SET_VERSION="

:parse_args
if "%~1"=="" goto parse_done
if /i "%~1"=="--set-version" goto set_version
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

:set_version
if "%~2"=="" (
    echo ERROR: --set-version requires a version value.
    exit /b 1
)
set "SET_VERSION=%~2"
if "%SET_VERSION:~0,2%"=="--" (
    echo ERROR: --set-version requires a version value before other options.
    exit /b 1
)
shift
shift
goto parse_args

:parse_done
if "%SHOW_HELP%"=="1" (
    call :print_help
    exit /b 0
)

set ROOT=%~dp0
set UI_SRC=%ROOT%ui\index.html
set UI_DIR=%ROOT%ui

if "%QUIET%"=="0" echo Build root: %ROOT%

rem Update APP_VERSION and local asset URLs together; no extra script file is needed.
node -e "const fs=require('fs');try{const file=process.env.UI_SRC;const original=fs.readFileSync(file,'utf8');const pattern=/(APP_VERSION = \x27)([^\x27\r\n]*)(\x27)/;const match=original.match(pattern);if(!match)throw new Error('APP_VERSION declaration not found');let version=process.env.SET_VERSION||match[2];if(!/^[a-z0-9][a-z0-9._+-]*$/i.test(version))throw new Error('Version must start with a letter or digit and contain only letters, digits, dots, underscores, pluses or hyphens');if(!process.env.SET_VERSION&&process.env.NO_INCREMENT!=='1'){if(!/^(?:\d+\.){0,3}\d+$/.test(version))throw new Error('Automatic increment requires 1 to 4 numeric parts; use --set-version or --no-increment');const parts=version.split('.');parts[parts.length-1]=String(BigInt(parts[parts.length-1])+1n);version=parts.join('.');}let html=original.replace(pattern,(_,prefix,old,suffix)=>prefix+version+suffix);html=html.replace(/(<(?:script|link)\b[^>]*?\b(?:src|href)=\x22)(?![a-z]+:|\/)([^\x22?]+\.(?:css|js))(?:\?[^\x22]*)?(\x22)/gi,(_,prefix,asset,suffix)=>prefix+asset+'?v='+encodeURIComponent(version)+suffix);if(html!==original)fs.writeFileSync(file,html,'utf8');if(process.env.QUIET!=='1'){if(process.env.SET_VERSION)console.log('[SET] APP_VERSION assigned explicitly');else if(process.env.NO_INCREMENT==='1')console.log('[SKIP] Version increment disabled');console.log('[OK] Version: v'+version);}}catch(error){console.error('ERROR: '+error.message);process.exitCode=1;}"
if errorlevel 1 (
    echo ERROR: Failed to prepare UI version and assets.
    exit /b 1
)

rem Version local assets in every deployed HTML page, including iframe pages.
node -e "const fs=require('fs'),path=require('path');try{const version=fs.readFileSync(process.env.UI_SRC,'utf8').match(/APP_VERSION = \x27([^\x27\r\n]+)\x27/)[1];for(const name of fs.readdirSync(process.env.UI_DIR)){if(!name.endsWith('.html'))continue;const file=path.join(process.env.UI_DIR,name),html=fs.readFileSync(file,'utf8');const updated=html.replace(/(<(?:script|link)\b[^>]*?\b(?:src|href)=\x22)(?![a-z]+:|\/)([^\x22?]+\.(?:css|js))(?:\?[^\x22]*)?(\x22)/gi,(_,prefix,asset,suffix)=>prefix+asset+'?v='+encodeURIComponent(version)+suffix);if(updated!==html)fs.writeFileSync(file,updated,'utf8');}}catch(error){console.error('ERROR: '+error.message);process.exitCode=1;}"
if errorlevel 1 (
    echo ERROR: Failed to version UI page assets.
    exit /b 1
)

if "%QUIET%"=="0" (
    echo [OK] UI prepared in .\ui\
    for %%f in ("%UI_DIR%\*") do echo     .\ui\%%~nxf
)
exit /b 0

:print_help
    echo Usage: ui-build.cmd [options]
    echo.
    echo Options:
    echo   --set-version VALUE         Set APP_VERSION without incrementing.
    echo   --quiet, -q                 Quiet mode; suppress build logs.
    echo   --no-increment              Build without updating APP_VERSION.
    echo   --skip-version              Alias for --no-increment.
    echo   --no-version-bump           Alias for --no-increment.
    echo   --help, -h, /?              Show this help text.
    echo.
    echo Requires Node.js.
    echo.
    echo Version rule:
    echo   Explicit versions accept letters, digits, dots, underscores, pluses and hyphens.
    echo   Automatic increment accepts 1 to 4 dot-separated numeric parts.
    echo   Examples: 1, 1.2, 1.2.3, 1.2.3.4
    echo   On increment, only the final segment is increased.
    echo   Local CSS and JS URLs use APP_VERSION as their cache version.
    echo   --no-increment preserves APP_VERSION and refreshes asset URLs.
    echo   --set-version overrides --no-increment and skips automatic increment.
    echo   Examples: 1 -^> 2; 1.2 -^> 1.3; 1.2.3 -^> 1.2.4; 1.2.3.4 -^> 1.2.3.5
    echo.
    echo Examples:
    echo   ui-build.cmd
    echo   ui-build.cmd --set-version 2.0.0
    echo   ui-build.cmd --set-version 2.0.0-rc.1
    echo   ui-build.cmd --quiet
    echo   ui-build.cmd --no-increment
    echo   ui-build.cmd --skip-version --quiet
    echo   ui-build.cmd --help
    exit /b 0

