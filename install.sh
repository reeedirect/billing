#!/bin/bash

echo "电费余额查询系统 - 安装脚本"
echo "=============================="

echo ""
echo "1. 检查Node.js环境..."
if ! command -v node &> /dev/null; then
    echo "错误：未检测到Node.js，请先安装Node.js"
    echo "下载地址：https://nodejs.org/"
    exit 1
else
    echo "Node.js已安装: $(node --version)"
fi

echo ""
echo "2. 安装项目依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "错误：依赖安装失败"
    exit 1
else
    echo "依赖安装完成"
fi

echo ""
echo "3. 启动服务器..."
echo "正在启动电费查询系统..."
echo "请在浏览器中访问: http://localhost:3000"
echo ""
echo "按Ctrl+C停止服务器"
echo ""
npm start
