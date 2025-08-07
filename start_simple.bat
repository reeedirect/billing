@echo off
chcp 65001 >nul
echo 启动电费查询系统...
echo.

REM 检查Node.js是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo 未检测到Node.js，正在尝试启动...
    echo 如果启动失败，请先安装Node.js: https://nodejs.org/
    echo.
)

echo 启动服务器 (自动检测端口)
echo 默认地址: http://localhost:3000
echo 如果端口被占用，系统会自动选择其他端口
echo 按Ctrl+C停止服务
echo.

node server.js

pause
