# ==============================================================================
# Stage 1: Build Frontend Single Page App
# ==============================================================================
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Build Backend TypeScript Server
# ==============================================================================
FROM node:20-bookworm-slim AS backend-builder
WORKDIR /app/backend

# Install build tools for native dependencies (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY backend/ ./
RUN npm run build

# ==============================================================================
# Stage 3: Production Runtime Container
# ==============================================================================
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Install runtime utilities: gosu (for PUID/PGID), wget (healthcheck), ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends gosu wget ca-certificates && rm -rf /var/lib/apt/lists/*

# Install production backend dependencies (compiling native better-sqlite3 and glibc onnxruntime)
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && \
    (npm ci --omit=dev --legacy-peer-deps || npm install --omit=dev --legacy-peer-deps) && \
    apt-get purge -y --auto-remove python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled backend & frontend assets
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
COPY slip.config.json ./slip.config.json
RUN chmod +x ./docker-entrypoint.sh

# Pre-download default embedding model for 100% offline runtime into image seed cache
RUN mkdir -p /app/models && \
    (node -e "import('@huggingface/transformers').then(async m => { m.env.cacheDir = '/app/models'; await m.pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { dtype: 'fp32' }); });" || true)

# Unraid and Docker environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DB_PATH=/config/bookmarks.db \
    CACHE_DIR=/config/cache \
    MODELS_DIR=/config/cache/models \
    FRONTEND_DIST=/app/frontend/dist \
    PUID=99 \
    PGID=100

# Persistent storage volume for SQLite DB and cached thumbnails & models
VOLUME ["/config"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "backend/dist/server.js"]
