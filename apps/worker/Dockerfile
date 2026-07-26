FROM node:24-alpine AS build
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run prisma:generate \
  && npm run build -w @pulseflow/contracts \
  && npm run build -w @pulseflow/database \
  && npm run build -w @pulseflow/worker

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache dumb-init
COPY --from=build --chown=node:node /app /app
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/worker/dist/main.js"]
