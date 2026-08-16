#!/bin/sh
set -e

# Default Unraid PUID/PGID (nobody:users)
PUID=${PUID:-99}
PGID=${PGID:-100}

echo "[Slip] Starting with PUID: ${PUID}, PGID: ${PGID}"

# Create group if it doesn't exist
if ! getent group slipgroup >/dev/null 2>&1; then
    addgroup -g "$PGID" slipgroup 2>/dev/null || true
fi

# Create user if it doesn't exist
if ! getent passwd slipuser >/dev/null 2>&1; then
    adduser -u "$PUID" -G slipgroup -s /bin/sh -D -H slipuser 2>/dev/null || true
fi

# Ensure storage directories exist
mkdir -p /config/cache
mkdir -p /app/backend/data/cache

# Fix directory ownership for Unraid storage
chown -R "${PUID}:${PGID}" /config /app/backend/data 2>/dev/null || true

# Execute process as specified user/group
if [ "$(id -u)" = "0" ]; then
    exec su-exec "${PUID}:${PGID}" "$@"
else
    exec "$@"
fi
