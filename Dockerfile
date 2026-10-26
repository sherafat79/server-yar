# ---------- build ----------
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter web build \
 && pnpm --filter @serveryar/server build \
 && pnpm --filter @serveryar/server deploy --prod --legacy /out

# ---------- runtime ----------
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends iputils-ping ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /data && chown node:node /data
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/web/dist ./web
ENV NODE_ENV=production \
    WEB_DIST=/app/web \
    DATABASE_PATH=/data/serveryar.db \
    PORT=8080 \
    TZ=Asia/Tehran
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
