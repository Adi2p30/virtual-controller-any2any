@echo off
REM start.bat  Windows launcher for the controller bridge.
REM
REM Creates a venv if needed, installs deps, and runs the bridge against the
REM server. Pass extra args through, e.g.:
REM     start.bat --server http://192.168.1.20:3000 --verbose
setlocal
cd /d "%~dp0"

if "%PYTHON%"=="" set PYTHON=python

if not exist ".venv" (
  echo creating venv...
  %PYTHON% -m venv .venv
)

".venv\Scripts\python.exe" -m pip install -q -r requirements.txt

echo starting windows bridge...
".venv\Scripts\python.exe" bridge.py --platform windows %*
endlocal
