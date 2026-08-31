@echo off
setlocal
set "NODE_BIN=C:\Users\jhu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "PNPM_CMD=C:\Users\jhu\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
set "PATH=%NODE_BIN%;%PATH%"
set "CI=true"
set "NODE_USE_SYSTEM_CA=1"
start "" http://localhost:3000/
call "%PNPM_CMD%" dev
pause
