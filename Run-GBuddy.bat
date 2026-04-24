@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed. Please install Node.js LTS first.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

echo Building G-Buddy...
call npm.cmd run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo Starting G-Buddy on http://localhost:3000
echo Waiting for server to start...

start "" npm.cmd run start

:: Poll until server is ready, then open browser
setlocal enabledelayedexpansion
set /a attempts=0
set /a max_attempts=60

:poll_loop
if !attempts! geq !max_attempts! (
  echo Server failed to start after 2 minutes.
  pause
  exit /b 1
)

echo Checking if server is ready... (attempt !attempts!)
curl -s -o nul http://localhost:3000
if errorlevel 0 (
  echo Server is ready! Opening browser...
  start "" http://localhost:3000
  goto :done
)

set /a attempts=!attempts!+1
timeout /t 2 /nobreak
goto poll_loop

:done
echo G-Buddy is running!
