# ─── Stage 1: Build ───
FROM node:22-slim AS builder

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Copy dependency manifests first (for Docker cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/racing-shop/package.json ./artifacts/racing-shop/
COPY scripts/package.json ./scripts/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the API server (esbuild bundles everything into a single file)
RUN pnpm --filter @workspace/api-server build

# ─── Stage 2: Production ───
FROM node:22-slim

WORKDIR /app

# Copy only the bundled output (single file, no node_modules needed)
COPY --from=builder /app/artifacts/api-server/dist/index.js ./index.js

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "index.js"]
