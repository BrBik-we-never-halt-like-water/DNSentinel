# Debian-glibc base (not alpine/musl). Two reasons this is more robust than node:20-alpine:
#   1. better-sqlite3 ships glibc prebuilt binaries, so the normal install path needs no
#      compiler at all (fast, no source build).
#   2. If a prebuilt is ever missing and it must compile, node-gyp fetches headers from the
#      OFFICIAL nodejs.org/dist — not the flaky unofficial-builds.nodejs.org host that a
#      musl/alpine build depends on (that fetch is what broke the original Dockerfile).
FROM node:20-slim

WORKDIR /app

# Toolchain is a *fallback* for the rare case a prebuilt binary isn't available; the glibc
# prebuilt path normally skips it entirely.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# npm ci = reproducible install straight from the lockfile; --omit=dev skips devDeps.
RUN npm ci --omit=dev

COPY . .

# Persistent data (SQLite DB: users, history, alerts). Mount a volume here so it
# survives container restarts:  docker run -v dnsentinel_data:/app/data ...
ENV DB_PATH=/app/data/dnsentinel.db
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
