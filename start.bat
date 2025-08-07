@echo off
chcp 65001 >nul
title Electricity Bill Inquiry System
echo.
echo ============================================
echo      Electricity Bill Inquiry System
echo                for C14-418
echo ============================================
echo.

REM Check Node.js environment
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: Node.js environment not detected
    echo.
    echo 📥 Please install Node.js first:
    echo    https://nodejs.org/
    echo.
    echo 💡 It is recommended to download the LTS version, suitable for most users
    echo.
    pause
    exit /b 1
)

REM Show Node.js version
for /f "tokens=*" %%v in ('node --version 2^>nul') do set nodeversion=%%v
echo ✅ Node.js environment is ready %nodeversion%
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing project dependencies...
    echo.
    npm install
    if errorlevel 1 (
        echo.
        echo ❌ Dependency installation failed, please check your network connection
        pause
        exit /b 1
    )
    echo.
    echo ✅ Dependency installation completed
    echo.
)

REM Stop any running services
echo 🔄 Checking and stopping any running services...
taskkill /f /im node.exe /fi "WINDOWTITLE eq Electricity Bill Inquiry System*" 2>nul >nul
timeout /t 1 /nobreak >nul

echo.
echo 🚀 Starting Electricity Bill Inquiry System...
echo.
echo 📋 Info:
echo    - Target Room: C14-418
echo    - Query Interval: Once every hour
echo    - Data Storage: Local SQLite Database
echo.
echo 🌐 Access URLs:
echo    - Primary URL: http://localhost:3000
echo    - Secondary URL: http://127.0.0.1:3000
echo.
echo 💡 Tips:
echo    - If the port is occupied, the system will automatically select another port
echo    - The first startup takes a few minutes to initialize
echo    - Press Ctrl+C to stop the service
echo.
echo ============================================
echo.

REM Start the server
node server.js

REM If the server exits unexpectedly
echo.
echo ⚠️  The server has stopped running
echo.
pause
