#!/bin/bash
echo ""
echo "  ██████╗██╗██████╗ ██╗  ██╗███████╗██████╗"
echo " ██╔════╝██║██╔══██╗██║  ██║██╔════╝██╔══██╗"
echo " ██║     ██║██████╔╝███████║█████╗  ██████╔╝"
echo " ██║     ██║██╔═══╝ ██╔══██║██╔══╝  ██╔══██╗"
echo " ╚██████╗██║██║     ██║  ██║███████╗██║  ██║"
echo "  ╚═════╝╚═╝╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝"
echo ""

DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill old processes on these ports
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo ">> Запуск бэкенда на порту 8000..."
cd "$DIR/backend"
source venv/bin/activate 2>/dev/null || (python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt)
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo ">> Запуск фронтенда на порту 5173..."
cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

sleep 2
echo ""
echo ">> СИСТЕМА ЗАПУЩЕНА"
echo ">> Открой: http://localhost:5173"
echo ">> Нажми Ctrl+C для остановки"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
