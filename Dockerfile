# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: Production runner ──
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache ffmpeg zip

ENV NODE_ENV=production

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy drizzle migrations (needed at runtime for DB setup)
COPY --from=builder /app/drizzle ./drizzle

# Create persistent data directories
RUN mkdir -p /data /downloads /plugins

VOLUME ["/data", "/downloads", "/plugins"]

ENV DATABASE_URL=file:/data/archiver.db
ENV SHARE_LOCATION=/downloads
ENV PLUGINS_DIR=/plugins
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
