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
mkdir -p /config/cache/models
mkdir -p /app/backend/data/cache/models

# If /config/cache/models is empty or missing Xenova model, copy pre-baked model from /app/models
if [ -d "/app/models/Xenova" ] || [ -d "/app/models" ]; then
    if [ ! -d "/config/cache/models/Xenova" ]; then
        echo "[Slip] Seeding pre-baked embedding models into /config/cache/models..."
        cp -r /app/models/* /config/cache/models/ 2>/dev/null || true
        echo "[Slip] Embedding models seeded successfully into /config/cache/models."
    fi
fi

# Fix directory ownership for Unraid / persistent storage
chown -R "${PUID}:${PGID}" /config /app/backend/data 2>/dev/null || true

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
