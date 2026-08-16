# ==============================================================================
# Stage 1: Build Frontend Single Page App
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Build Backend TypeScript Server
# ==============================================================================
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

# Install build tools for native dependencies (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY backend/ ./
RUN npm run build

# ==============================================================================
# Stage 3: Production Runtime Container
# ==============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime utilities: su-exec (for PUID/PGID), shadow (for useradd), wget (healthcheck)
RUN apk add --no-cache su-exec shadow wget

# Install production backend dependencies (compiling native better-sqlite3)
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN apk add --no-cache --virtual .build-deps python3 make g++ && \
    (npm ci --omit=dev --legacy-peer-deps || npm install --omit=dev --legacy-peer-deps) && \
    apk del .build-deps

WORKDIR /app

# Copy compiled backend & frontend assets
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Unraid and Docker environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DB_PATH=/config/bookmarks.db \
    CACHE_DIR=/config/cache \
    FRONTEND_DIST=/app/frontend/dist \
    PUID=99 \
    PGID=100

# Persistent storage volume for SQLite DB and cached thumbnails
VOLUME ["/config"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "backend/dist/server.js"]
