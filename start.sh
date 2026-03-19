#!/bin/bash
echo ">> INITIALIZING CIPHER CHAT SYSTEM..."
echo ">> Starting backend on port 8000..."
cd backend && pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo ">> Starting frontend on port 5173..."
cd ../frontend && npm install && npm run dev &
FRONTEND_PID=$!
echo ">> SYSTEM ONLINE. Access: http://localhost:5173"
echo ">> Press Ctrl+C to shutdown"
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
