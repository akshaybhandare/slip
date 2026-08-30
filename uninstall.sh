#!/usr/bin/env bash
# ==============================================================================
# Slip Universal Uninstaller (macOS & Linux)
# Usage:
#   curl -fsSL https://get.slip.so/uninstall.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/<user>/Slip/main/uninstall.sh | bash
#   ./uninstall.sh [--purge] [--dir /custom/path] [-y]
# ==============================================================================
set -euo pipefail

DEFAULT_DIR="${HOME}/.slip"
BIN_LINK="${HOME}/.local/bin/slip"
PURGE_DATA=false
CUSTOM_DIR=""
ASSUME_YES=false

# ANSI Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

while [[ $# -gt 0 ]]; do
  case $1 in
    --purge)
      PURGE_DATA=true; shift ;;
    --dir|-d)
      CUSTOM_DIR="$2"; shift 2 ;;
    -y|--yes)
      ASSUME_YES=true; shift ;;
    *)
      shift ;;
  esac
done

if [ -n "$CUSTOM_DIR" ]; then
  SLIP_DIR="$CUSTOM_DIR"
elif [ -n "${SLIP_DIR:-}" ]; then
  SLIP_DIR="$SLIP_DIR"
else
  SLIP_DIR="$DEFAULT_DIR"
fi

SLIP_DIR="${SLIP_DIR/#\~/$HOME}"

echo -e "${YELLOW}"
echo "======================================================"
echo "🗑️  Slip Uninstaller"
echo "Target directory: ${SLIP_DIR}"
echo "======================================================"
echo -e "${NC}"

# 1. Stop Running Background Instance
PID_FILE="${SLIP_DIR}/.slip.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo -e "🛑 Stopping running Slip process (PID: ${PID})..."
    kill -TERM "$PID" 2>/dev/null || true
    sleep 1
    # Check if still alive
    if kill -0 "$PID" 2>/dev/null; then
      sleep 1
      kill -9 "$PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PID_FILE"
fi

# 2. Remove CLI Symlink
if [ -L "$BIN_LINK" ] || [ -f "$BIN_LINK" ]; then
  echo -e "🧹 Removing CLI symlink: ${BIN_LINK}"
  rm -f "$BIN_LINK"
fi

# 3. Handle Data Preservation Prompt
if [ -d "${SLIP_DIR}/data" ] && [ "$PURGE_DATA" = false ] && [ "$ASSUME_YES" = false ] && [ -t 0 ]; then
  echo -e "\n${BOLD}Database & Bookmark Protection:${NC}"
  read -p "Do you want to KEEP your database & bookmarks in ${SLIP_DIR}/data? [Y/n]: " KEEP_ANSWER </dev/tty
  KEEP_ANSWER="${KEEP_ANSWER:-Y}"
  if [[ "$KEEP_ANSWER" =~ ^[Nn] ]]; then
    PURGE_DATA=true
  fi
fi

# 4. Remove Files
if [ "$PURGE_DATA" = true ]; then
  echo -e "🔥 Completely removing ${SLIP_DIR}..."
  rm -rf "${SLIP_DIR}"
  echo -e "\n${GREEN}✓ Slip and all associated data have been completely eradicated.${NC}\n"
else
  echo -e "🧹 Removing binaries, logs, and configuration..."
  rm -rf "${SLIP_DIR}/bin" "${SLIP_DIR}/source" "${SLIP_DIR}/logs" "${SLIP_DIR}/slip.env" "${SLIP_DIR}/.slip.pid"
  echo -e "\n${GREEN}✓ Slip application uninstalled.${NC}"
  echo -e "${YELLOW}ℹ️  Your database & bookmarks were preserved at:${NC} ${BOLD}${SLIP_DIR}/data${NC}"
  echo -e "   (To permanently delete data, run: rm -rf ${SLIP_DIR})\n"
fi
