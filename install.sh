#!/usr/bin/env bash
# ==============================================================================
# Slip Universal One-Line Installer (macOS & Linux)
# Usage:
#   curl -fsSL https://get.slip.so | bash
#   curl -fsSL https://raw.githubusercontent.com/<user>/Slip/main/install.sh | bash
# Options via flags:
#   curl -fsSL ... | bash -s -- --dir /custom/path --port 4000
# ==============================================================================
set -euo pipefail

REPO="${SLIP_REPO:-akshaybhandare/Slip}"
DEFAULT_DIR="${HOME}/.slip"
BIN_DIR="${HOME}/.local/bin"
DEFAULT_PORT="3000"

# ANSI Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# Parse Command-line Arguments
CUSTOM_DIR=""
CUSTOM_PORT=""
NON_INTERACTIVE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir|-d)
      CUSTOM_DIR="$2"; shift 2 ;;
    --port|-p)
      CUSTOM_PORT="$2"; shift 2 ;;
    -y|--yes|--non-interactive)
      NON_INTERACTIVE=true; shift ;;
    *)
      shift ;;
  esac
done

echo -e "${CYAN}"
cat << "EOF"
   ____  ___      
  / __/ / (_)___  
 _\ \  / / / __ \ 
/___/ /_/_/ .___/ 
         /_/      
 A lightning-fast, self-hosted visual bookmark archive
EOF
echo -e "${NC}"

# 1. Determine Target Installation Path
if [ -n "$CUSTOM_DIR" ]; then
  SLIP_DIR="$CUSTOM_DIR"
elif [ -n "${SLIP_DIR:-}" ]; then
  SLIP_DIR="$SLIP_DIR"
elif [ -t 0 ] && [ "$NON_INTERACTIVE" = false ]; then
  echo -e "${BOLD}Where would you like to install Slip?${NC}"
  read -p "Install path [${DEFAULT_DIR}]: " USER_INPUT_DIR </dev/tty
  SLIP_DIR="${USER_INPUT_DIR:-$DEFAULT_DIR}"
else
  SLIP_DIR="$DEFAULT_DIR"
fi

# Expand tilde in path if user entered ~/path
SLIP_DIR="${SLIP_DIR/#\~/$HOME}"
PORT="${CUSTOM_PORT:-${PORT:-$DEFAULT_PORT}}"

# 2. Detect Operating System & CPU Architecture
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "${OS}" in
  linux*)  PLATFORM="linux" ;;
  darwin*) PLATFORM="darwin" ;;
  *) echo -e "${RED}❌ Unsupported operating system: ${OS}${NC}"; exit 1 ;;
esac

ARCH="$(uname -m)"
case "${ARCH}" in
  x86_64|amd64) TARGET_ARCH="x64" ;;
  arm64|aarch64) TARGET_ARCH="arm64" ;;
  *) echo -e "${RED}❌ Unsupported CPU architecture: ${ARCH}${NC}"; exit 1 ;;
esac

echo -e "📦 Target OS & Arch: ${CYAN}${PLATFORM}-${TARGET_ARCH}${NC}"
echo -e "📁 Target Directory: ${CYAN}${SLIP_DIR}${NC}"
echo -e "🌐 Target Web Port:  ${CYAN}${PORT}${NC}\n"

# 3. Create Required Directory Hierarchy
mkdir -p "${SLIP_DIR}/bin" "${SLIP_DIR}/data/cache" "${SLIP_DIR}/logs" "${BIN_DIR}"

# 4. Fetch and Extract Precompiled Release Package
ARCHIVE_NAME="slip-${PLATFORM}-${TARGET_ARCH}.tar.gz"
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ARCHIVE_NAME}"

echo -e "⬇️  Downloading Slip standalone bundle..."
TEMP_ARCHIVE="/tmp/${ARCHIVE_NAME}"

if curl -fsSL -L -o "${TEMP_ARCHIVE}" "${DOWNLOAD_URL}" 2>/dev/null; then
  tar -xzf "${TEMP_ARCHIVE}" -C "${SLIP_DIR}/bin"
  rm -f "${TEMP_ARCHIVE}"
else
  echo -e "${YELLOW}⚠️  No precompiled GitHub release binary found for ${ARCHIVE_NAME}.${NC}"
  echo -e "⚙️  Falling back to direct source clone and build..."

  if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required for source fallback. Install from https://nodejs.org${NC}"
    exit 1
  fi

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/backend/package.json" ] && [ -f "$SCRIPT_DIR/frontend/package.json" ]; then
    echo "📁 Copying local workspace source to ${SLIP_DIR}/source..."
    mkdir -p "${SLIP_DIR}/source"
    cp -r "$SCRIPT_DIR/backend" "${SLIP_DIR}/source/"
    cp -r "$SCRIPT_DIR/frontend" "${SLIP_DIR}/source/"
    rm -rf "${SLIP_DIR}/source/backend/node_modules" "${SLIP_DIR}/source/frontend/node_modules"
  elif [ ! -d "${SLIP_DIR}/source" ]; then
    git clone --depth 1 "https://github.com/${REPO}.git" "${SLIP_DIR}/source" --quiet
  else
    git -C "${SLIP_DIR}/source" pull --quiet
  fi

  (
    cd "${SLIP_DIR}/source/backend"
    npm install --legacy-peer-deps --quiet
    npm run build --quiet
    npm prune --omit=dev --quiet
  )
  (
    cd "${SLIP_DIR}/source/frontend"
    npm install --legacy-peer-deps --quiet
    npm run build --quiet
  )

  # Copy compiled files to bin
  mkdir -p "${SLIP_DIR}/bin/backend" "${SLIP_DIR}/bin/frontend-dist"
  cp -r "${SLIP_DIR}/source/backend/dist" "${SLIP_DIR}/bin/backend/"
  cp -r "${SLIP_DIR}/source/backend/node_modules" "${SLIP_DIR}/bin/backend/"
  cp -r "${SLIP_DIR}/source/backend/package.json" "${SLIP_DIR}/bin/backend/"
  cp -r "${SLIP_DIR}/source/frontend/dist/"* "${SLIP_DIR}/bin/frontend-dist/"
fi

# Ensure executable wrapper
WRAPPER="${SLIP_DIR}/bin/slip"
if [ ! -f "$WRAPPER" ]; then
  cat <<'EOF' > "$WRAPPER"
#!/usr/bin/env bash
SLIP_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SLIP_BASE_DIR="$(dirname "$SLIP_SCRIPT_DIR")"
export SLIP_DIR="${SLIP_DIR:-$SLIP_BASE_DIR}"

if [ -d "$SLIP_SCRIPT_DIR/frontend-dist" ]; then
  export FRONTEND_DIST="$SLIP_SCRIPT_DIR/frontend-dist"
fi

if [ -f "$SLIP_SCRIPT_DIR/backend/dist/cli.js" ]; then
  exec node "$SLIP_SCRIPT_DIR/backend/dist/cli.js" "$@"
elif [ -f "$SLIP_SCRIPT_DIR/dist/cli.js" ]; then
  exec node "$SLIP_SCRIPT_DIR/dist/cli.js" "$@"
elif [ -f "$SLIP_SCRIPT_DIR/slip-bin" ]; then
  exec "$SLIP_SCRIPT_DIR/slip-bin" "$@"
fi
EOF
  chmod +x "$WRAPPER"
fi

# 5. Create slip.env Configuration File if Not Exists
ENV_FILE="${SLIP_DIR}/slip.env"
if [ ! -f "$ENV_FILE" ]; then
  SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s%N)
  cat <<EOF > "$ENV_FILE"
SLIP_DIR=${SLIP_DIR}
PORT=${PORT}
HOST=0.0.0.0
DB_PATH=${SLIP_DIR}/data/bookmarks.db
CACHE_DIR=${SLIP_DIR}/data/cache
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
EOF
fi

# 6. Link to User PATH
ln -sf "${SLIP_DIR}/bin/slip" "${BIN_DIR}/slip"

# 7. Start Slip in Background Daemon Mode
echo -e "🚀 Starting Slip..."
"${SLIP_DIR}/bin/slip" start -d -p "${PORT}"

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}✨ Slip installed successfully!${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "🌐 Web Interface:     ${CYAN}http://localhost:${PORT}${NC}"
echo -e "📁 Data Directory:    ${YELLOW}${SLIP_DIR}/data${NC}"
echo -e "⚙️  Configuration:     ${YELLOW}${SLIP_DIR}/slip.env${NC}"
echo -e "📋 Live Logs:         ${YELLOW}${SLIP_DIR}/logs/slip.log${NC}"
echo -e "\n💡 Manage Slip anywhere using the CLI:"
echo -e "   ${CYAN}slip status${NC}      Check server status"
echo -e "   ${CYAN}slip stop${NC}        Stop background server"
echo -e "   ${CYAN}slip start -d${NC}    Start server as daemon"
echo -e "   ${CYAN}slip logs${NC}        View live application logs"
echo -e "   ${CYAN}slip uninstall${NC}   Uninstall cleanly with data protection"

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo -e "\n${YELLOW}ℹ️  Add ~/.local/bin to your PATH to run 'slip' without full path:${NC}"
  echo "   export PATH=\"\$HOME/.local/bin:\$PATH\""
fi
echo ""
