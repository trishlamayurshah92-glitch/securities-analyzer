#!/bin/bash

# Kill any processes on ports 8001 and 5173
echo "Stopping existing servers..."
netstat -ano 2>/dev/null | grep -E ":8001|:5173" | awk '{print $NF}' | sort -u | grep -v "^0$" | xargs -I{} taskkill //PID {} //F 2>/dev/null

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start backend in background
echo "Starting backend..."
cd "$SCRIPT_DIR" && npm run dev &

# Start frontend in background
echo "Starting frontend..."
cd "$SCRIPT_DIR/frontend" && npm run dev &

echo ""
echo "Servers starting..."
echo "  Backend:  http://localhost:8001"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

wait
