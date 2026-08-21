#!/usr/bin/env bash

# Slip 1-Shot Development Environment Manager
# Usage: ./dev.sh [start|stop|restart|status|logs]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/.dev.pid"
LOG_DIR="$ROOT_DIR/.logs"

BACKEND_PORT=3000
FRONTEND_PORT=5173

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

mkdir -p "$LOG_DIR"

stop_servers() {
    echo -e "${YELLOW}Stopping all Slip instances...${NC}"

    # 1. Kill any processes actively listening on backend/frontend ports
    for pid in $(lsof -ti :$BACKEND_PORT -ti :$FRONTEND_PORT 2>/dev/null); do
        if [ -n "$pid" ]; then
            kill -9 "$pid" 2>/dev/null || true
        fi
    done

    # 2. Kill recorded runner PIDs if present
    if [ -f "$PID_FILE" ]; then
        for pid in $(cat "$PID_FILE" 2>/dev/null); do
            if [ -n "$pid" ]; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        done
        rm -f "$PID_FILE"
    fi

    # 3. Kill any lingering dev watchers tied to this workspace
    pkill -9 -f "Slip/backend" 2>/dev/null || true
    pkill -9 -f "Slip/frontend" 2>/dev/null || true

    # Wait for ports to be completely freed
    FREED=false
    for i in {1..15}; do
        if ! lsof -ti :$BACKEND_PORT -ti :$FRONTEND_PORT >/dev/null 2>&1; then
            FREED=true
            break
        fi
        sleep 0.2
    done

    if [ "$FREED" = true ]; then
        echo -e "${GREEN}✓ All Slip instances stopped. Ports $BACKEND_PORT and $FRONTEND_PORT are free.${NC}"
    else
        echo -e "${RED}Warning: Some processes could not be stopped immediately.${NC}"
    fi
}

start_servers() {
    # Ensure any stale instances are stopped first
    stop_servers > /dev/null 2>&1

    echo -e "${BLUE}Starting Slip development environment...${NC}"

    # Clear old logs
    > "$LOG_DIR/backend.log"
    > "$LOG_DIR/frontend.log"

    # Start Backend
    echo -e "  → Starting Backend API (Port $BACKEND_PORT)..."
    (
        cd "$ROOT_DIR/backend" || exit 1
        npm run dev > "$LOG_DIR/backend.log" 2>&1
    ) &
    BACKEND_PID=$!

    # Start Frontend
    echo -e "  → Starting Frontend UI (Port $FRONTEND_PORT)..."
    (
        cd "$ROOT_DIR/frontend" || exit 1
        npm run dev > "$LOG_DIR/frontend.log" 2>&1
    ) &
    FRONTEND_PID=$!

    # Record background runner PIDs
    echo "$BACKEND_PID" > "$PID_FILE"
    echo "$FRONTEND_PID" >> "$PID_FILE"

    echo -e "${YELLOW}Waiting for servers to become ready...${NC}"

    # Wait for backend
    BACKEND_READY=false
    for i in {1..20}; do
        if lsof -ti :$BACKEND_PORT >/dev/null 2>&1; then
            BACKEND_READY=true
            break
        fi
        sleep 0.5
    done

    # Wait for frontend
    FRONTEND_READY=false
    for i in {1..20}; do
        if lsof -ti :$FRONTEND_PORT >/dev/null 2>&1; then
            FRONTEND_READY=true
            break
        fi
        sleep 0.5
    done

    if [ "$BACKEND_READY" = true ] && [ "$FRONTEND_READY" = true ]; then
        echo -e "\n${GREEN}===============================================${NC}"
        echo -e "${GREEN}  ✓ Slip is live and running in 1 shot!       ${NC}"
        echo -e "${GREEN}===============================================${NC}"
        echo -e "  📱 ${BLUE}Frontend UI:${NC}  http://localhost:$FRONTEND_PORT"
        echo -e "  ⚙️  ${BLUE}Backend API:${NC}  http://localhost:$BACKEND_PORT"
        echo -e "  📄 ${BLUE}Logs:${NC}         $LOG_DIR/backend.log & frontend.log"
        echo -e "\nTo stop at any time, run: ${YELLOW}./dev.sh stop${NC} or ${YELLOW}npm run stop${NC}\n"
    else
        echo -e "\n${RED}⚠️ Startup encountered an issue. Checking logs:${NC}"
        [ "$BACKEND_READY" = false ] && echo -e "${RED}Backend failed to bind to port $BACKEND_PORT. Last logs:${NC}" && tail -n 10 "$LOG_DIR/backend.log"
        [ "$FRONTEND_READY" = false ] && echo -e "${RED}Frontend failed to bind to port $FRONTEND_PORT. Last logs:${NC}" && tail -n 10 "$LOG_DIR/frontend.log"
    fi
}

check_status() {
    echo -e "${BLUE}=== Slip Development Status ===${NC}"
    
    BACKEND_PID=$(lsof -ti :$BACKEND_PORT 2>/dev/null || true)
    FRONTEND_PID=$(lsof -ti :$FRONTEND_PORT 2>/dev/null || true)

    if [ -n "$BACKEND_PID" ]; then
        echo -e "  Backend API  (Port $BACKEND_PORT): ${GREEN}● RUNNING${NC} (PID: $BACKEND_PID)"
    else
        echo -e "  Backend API  (Port $BACKEND_PORT): ${RED}○ STOPPED${NC}"
    fi

    if [ -n "$FRONTEND_PID" ]; then
        echo -e "  Frontend UI  (Port $FRONTEND_PORT): ${GREEN}● RUNNING${NC} (PID: $FRONTEND_PID)"
    else
        echo -e "  Frontend UI  (Port $FRONTEND_PORT): ${RED}○ STOPPED${NC}"
    fi
}

tail_logs() {
    echo -e "${BLUE}Tailing Slip logs (Ctrl+C to exit)...${NC}"
    tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
}

case "$1" in
    start|up|run)
        start_servers
        ;;
    stop|down|kill)
        stop_servers
        ;;
    restart)
        stop_servers
        sleep 1
        start_servers
        ;;
    status)
        check_status
        ;;
    logs)
        tail_logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo "   or: npm run dev | npm run stop | npm run restart | npm run status"
        exit 1
        ;;
esac
