@echo off
setlocal EnableExtensions

set "QUIET=0"
set "NO_INCREMENT=0"
set "SHOW_HELP=0"

:parse_args
if "%~1"=="" goto parse_done
if /i "%~1"=="--quiet" set "QUIET=1" & shift & goto parse_args
if /i "%~1"=="-q"      set "QUIET=1" & shift & goto parse_args
if /i "%~1"=="--no-increment" set "NO_INCREMENT=1" & shift & goto parse_args
if /i "%~1"=="--skip-version" set "NO_INCREMENT=1" & shift & goto parse_args
if /i "%~1"=="--no-version-bump" set "NO_INCREMENT=1" & shift & goto parse_args
if /i "%~1"=="/no-increment" set "NO_INCREMENT=1" & shift & goto parse_args
if /i "%~1"=="/skip-version" set "NO_INCREMENT=1" & shift & goto parse_args
if /i "%~1"=="--help" set "SHOW_HELP=1" & shift & goto parse_args
if /i "%~1"=="-h"     set "SHOW_HELP=1" & shift & goto parse_args
if /i "%~1"=="/?"     set "SHOW_HELP=1" & shift & goto parse_args
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

if "%NO_INCREMENT%"=="1" (
    if "%QUIET%"=="0" (
        echo [SKIP] Version increment disabled
        echo [SKIP] Option: --no-increment
    )
    set "APP_VER="
    for /f "delims=" %%v in ('powershell -NoProfile -Command "$c=[IO.File]::ReadAllText('%UI_SRC%'); if ($c -match 'APP_VERSION = ''((?:\d+\.){0,3}\d+)''') { $Matches[1] } else { throw 'APP_VERSION must be 1 to 4 dot-separated numeric parts' }"') do set "APP_VER=%%v"
) else (
    for /f "delims=" %%v in ('powershell -NoProfile -Command "$f='%UI_SRC%'; $c=[IO.File]::ReadAllText($f); if ($c -match 'APP_VERSION = ''((?:\d+\.){0,3}\d+)''') { $parts = $Matches[1].Split('.'); $last = $parts.Length - 1; $parts[$last] = ([int]$parts[$last] + 1); $ver = $parts -join '.'; $new = 'APP_VERSION = ''' + $ver + ''''; $old = 'APP_VERSION = ''' + $Matches[1] + ''''; [IO.File]::WriteAllText($f,$c.Replace($old,$new)); $ver } else { throw 'APP_VERSION must be 1 to 4 dot-separated numeric parts' }"') do set APP_VER=%%v
    if errorlevel 1 (
        echo ERROR: Failed to increment APP_VERSION
        exit /b 1
    )
)

if "%QUIET%"=="0" echo [OK] Version: v%APP_VER%

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
    echo Version rule:
    echo   APP_VERSION accepts 1 to 4 dot-separated numeric parts.
    echo   Examples: 1, 1.2, 1.2.3, 1.2.3.4
    echo   On increment, only the final segment is increased.
    echo   Examples: 1 -> 2; 1.2 -> 1.3; 1.2.3 -> 1.2.4; 1.2.3.4 -> 1.2.3.5
    echo.
    echo Examples:
    echo   ui-build.cmd
    echo   ui-build.cmd --quiet
    echo   ui-build.cmd --no-increment
    echo   ui-build.cmd --skip-version --quiet
    echo   ui-build.cmd --help
    exit /b 0

