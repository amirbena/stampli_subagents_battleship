@echo off
REM .run\run.cmd - Fast local run (Windows cmd shim)
REM Delegates to run.ps1 so double-click / `run` works the same as on macOS/Linux.
REM Starts Postgres + Redis as containers, then backend + frontend natively.
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
exit /b %ERRORLEVEL%
