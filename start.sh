#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "============================================"
echo "  新能源电网在线计算与分析平台"
echo "  http://localhost:5173"
echo "============================================"
echo ""

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "[错误] 根目录 node_modules 不存在，请先运行 npm install"
    exit 1
fi

cleanup() {
    echo ""
    echo "正在停止服务..."
    kill $SERVER_PID 2>/dev/null
    kill $CLIENT_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
    wait $CLIENT_PID 2>/dev/null
    echo "服务已停止."
    exit 0
}
trap cleanup SIGINT SIGTERM

# 启动后端
echo "[1/2] 启动后端服务 (端口 3000)..."
cd "$ROOT_DIR/server"
npx tsx watch src/index.ts &
SERVER_PID=$!

# 启动前端
echo "[2/2] 启动前端服务 (端口 5173)..."
cd "$ROOT_DIR/client"
npx vite --host &
CLIENT_PID=$!

sleep 3

# 尝试打开浏览器
if command -v start &>/dev/null; then
    start http://localhost:5173
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:5173
elif command -v open &>/dev/null; then
    open http://localhost:5173
fi

echo ""
echo "后端: http://localhost:3000"
echo "前端: http://localhost:5173"
echo "按 Ctrl+C 停止所有服务"
echo ""

wait
