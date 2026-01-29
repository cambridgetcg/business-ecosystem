FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY shared/ ./shared/
COPY gateway/ ./gateway/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ecosystem/gateway build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/gateway/dist ./dist
COPY --from=builder /app/gateway/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "dist/index.js"]
