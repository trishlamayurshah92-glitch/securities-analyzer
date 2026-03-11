# Stage 1: Build everything
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY frontend/package.json frontend/

RUN npm ci

COPY tsconfig.base.json ./
COPY packages/ packages/
COPY frontend/ frontend/

RUN npm run build -w @stockwatch/shared
RUN npm run build -w @stockwatch/server
RUN cd frontend && npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN npm ci --omit=dev

COPY --from=build /app/packages/shared/dist packages/shared/dist/
COPY --from=build /app/packages/server/dist packages/server/dist/
COPY --from=build /app/frontend/dist frontend/dist/
COPY watchlist.json ./

EXPOSE 8001
ENTRYPOINT ["node", "packages/server/dist/web/app.js"]
