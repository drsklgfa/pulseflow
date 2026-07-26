FROM node:24-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:3333/api/v1
ARG VITE_DEMO_MODE=false
ARG VITE_BASE_PATH=/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
ENV VITE_BASE_PATH=$VITE_BASE_PATH

COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build -w @pulseflow/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
