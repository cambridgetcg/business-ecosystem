#!/bin/bash
set -e

APP_NAME=$1
LAYER=$2

if [ -z "$APP_NAME" ] || [ -z "$LAYER" ]; then
  echo "Usage: ./scripts/init-app.sh <app-name> <layer>"
  echo "Example: ./scripts/init-app.sh accounting foundational"
  exit 1
fi

APP_DIR="$LAYER/$APP_NAME"

if [ ! -d "$APP_DIR" ]; then
  echo "Error: Directory $APP_DIR does not exist"
  exit 1
fi

cd "$APP_DIR"

echo "Initializing $APP_NAME in $LAYER..."

cat > package.json << PKGEOF
{
  "name": "@ecosystem/$APP_NAME",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "fastify": "^4.26.0",
    "zod": "^3.22.0",
    "drizzle-orm": "^0.29.0",
    "pg": "^8.11.0",
    "tsyringe": "^4.8.0",
    "reflect-metadata": "^0.2.0",
    "pino": "^8.19.0",
    "@t3-oss/env-core": "^0.9.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/pg": "^8.11.0",
    "typescript": "^5.4.0",
    "tsup": "^8.0.0",
    "tsx": "^4.7.0",
    "vitest": "^1.3.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^6.0.0",
    "testcontainers": "^10.7.0",
    "drizzle-kit": "^0.20.0"
  }
}
PKGEOF

cat > tsconfig.json << 'TSEOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
TSEOF

mkdir -p src/{domain/{entities,value-objects,events,services},application/{commands,queries,handlers},infrastructure/{persistence,messaging,external},api/rest}
mkdir -p tests/{unit,integration,e2e}
mkdir -p migrations

cat > src/index.ts << 'ENTRYEOF'
import 'reflect-metadata';
import { buildApp } from './api/rest/app.js';
import { env } from './env.js';

const start = async (): Promise<void> => {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`Server running on http://localhost:${env.PORT}`);
};

start().catch(console.error);
ENTRYEOF

cat > src/env.ts << 'ENVEOF'
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  },
  runtimeEnv: process.env,
});
ENVEOF

mkdir -p src/api/rest
cat > src/api/rest/app.ts << 'APPEOF'
import Fastify from 'fastify';
import { env } from '../../env.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
APPEOF

cat > Dockerfile << DOCKEREOF
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
DOCKEREOF

cat > .env.example << ENVEXEOF
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/$APP_NAME
LOG_LEVEL=info
ENVEXEOF

cat > vitest.config.ts << 'VITESTEOF'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
VITESTEOF

echo "Initialized $APP_NAME"
echo "Next steps:"
echo "  1. cd $APP_DIR"
echo "  2. pnpm install"
echo "  3. Define domain entities in src/domain/entities/"
