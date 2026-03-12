# Stage 1: Build everything
FROM node:20-alpine AS build
WORKDIR /app

# Accept VITE vars as build args so Vite bakes them into the frontend bundle
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

# Copy manifests first so npm ci is cached independently of source changes
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY frontend/package.json frontend/

RUN npm ci

# Copy source
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY frontend/ frontend/

# Build shared first, then server (server's tsc -b depends on shared dist)
RUN npm run build -w @stockwatch/shared
RUN npm run build -w @stockwatch/server
RUN cd frontend && npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Copy manifests
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# Install production deps — npm creates node_modules/@stockwatch/shared symlink
# pointing to ../../packages/shared. Copy shared fully (not just dist) so the
# symlink target is a valid package at both install-time and runtime.
RUN npm ci --omit=dev

# Copy the generated Prisma client from the build stage (prisma generate ran there).
# Without this, PrismaClient throws at import time because the generated files are
# not recreated by npm ci --omit=dev (prisma CLI is a devDependency).
COPY --from=build /app/node_modules/.prisma node_modules/.prisma/

COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist/
COPY --from=build /app/packages/server/dist packages/server/dist/
COPY --from=build /app/frontend/dist frontend/dist/
COPY watchlist.json ./

EXPOSE 8001
ENTRYPOINT ["node", "/app/packages/server/dist/web/app.js"]
