#!/bin/sh
set -e

# Default Unraid PUID/PGID (nobody:users)
PUID=${PUID:-99}
PGID=${PGID:-100}

echo "[Slip] Starting with PUID: ${PUID}, PGID: ${PGID}"

# Create group if it doesn't exist (Debian groupadd vs Alpine addgroup)
if ! getent group slipgroup >/dev/null 2>&1; then
    if command -v groupadd >/dev/null 2>&1; then
        groupadd -g "$PGID" slipgroup 2>/dev/null || true
    else
        addgroup -g "$PGID" slipgroup 2>/dev/null || true
    fi
fi

# Create user if it doesn't exist (Debian useradd vs Alpine adduser)
if ! getent passwd slipuser >/dev/null 2>&1; then
    if command -v useradd >/dev/null 2>&1; then
        useradd -u "$PUID" -g "$PGID" -s /bin/sh -M -N slipuser 2>/dev/null || true
    else
        adduser -u "$PUID" -G slipgroup -s /bin/sh -D -H slipuser 2>/dev/null || true
    fi
fi

# Ensure storage directories exist
mkdir -p /config/cache
mkdir -p /app/backend/data/cache
mkdir -p /app/models

# Fix directory ownership for Unraid / persistent storage
chown -R "${PUID}:${PGID}" /config /app/backend/data /app/models 2>/dev/null || true

# Execute process as specified user/group using gosu or su-exec
if [ "$(id -u)" = "0" ]; then
    if command -v gosu >/dev/null 2>&1; then
        exec gosu "${PUID}:${PGID}" "$@"
    elif command -v su-exec >/dev/null 2>&1; then
        exec su-exec "${PUID}:${PGID}" "$@"
    else
        exec su -s /bin/sh slipuser -c "$*"
    fi
else
    exec "$@"
fi
