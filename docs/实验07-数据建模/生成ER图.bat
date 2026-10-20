@echo off
REM ============================================================
REM  Campus Commission System - ER Diagram Generator
REM  ASCII ONLY on purpose: cmd.exe mis-decodes UTF-8 batch files.
REM  The Chinese output filename is matched with a wildcard so this
REM  file itself contains no non-ASCII bytes.
REM ============================================================
title Generate ER Diagram
cd /d "%~dp0"

echo ============================================
echo   Campus Commission ER Diagram Generator
echo ============================================
echo.

set "PYEXE="
where python >nul 2>nul && set "PYEXE=python"
if not defined PYEXE (
  where py >nul 2>nul && set "PYEXE=py"
)
if not defined PYEXE (
  set "PYEXE=C:\Users\%USERNAME%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
)

echo Using Python: %PYEXE%
"%PYEXE%" -c "import PIL" 2>nul
if errorlevel 1 (
  echo [INFO] Pillow missing, installing...
  "%PYEXE%" -m pip install pillow
  echo.
)

echo Generating ER diagram...
echo.
"%PYEXE%" build_er_new.py

echo.
set "OUTFILE="
for %%F in ("03_*.png") do set "OUTFILE=%%F"
if defined OUTFILE (
  echo [OK] Generated: %OUTFILE%
  start "" "%OUTFILE%"
) else (
  echo [FAIL] Image not generated. Send the error above to the AI assistant.
)
echo.
pause
