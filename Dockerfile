FROM node:20-alpine

WORKDIR /app

# better-sqlite3 is a native module — install build toolchain so it compiles on
# musl/alpine when no prebuilt binary is available.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --production

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
