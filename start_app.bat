@echo off
TITLE Cost Tracker App
echo =====================================================
echo    Starting Cost Tracker Application
echo =====================================================

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

REM Check if node_modules exists, if not install dependencies
if not exist "node_modules\" (
    echo [1/3] Installing dependencies...
    call npm install
) else (
    echo [1/3] Dependencies already installed.
)

REM Check if dist folder exists, if not build the project
if not exist "dist\" (
    echo [2/3] Building the application...
    call npm run build
) else (
    echo [2/3] Build folder exists. Skipping build.
    echo      (To force rebuild, delete the 'dist' folder)
)

echo [3/3] Starting the server...
echo.
echo Application will run at: http://localhost:3000
echo Check the browser window.
echo.

REM Start the server in production mode
set NODE_ENV=production
start "" "http://localhost:3000"
call npm start

pause
