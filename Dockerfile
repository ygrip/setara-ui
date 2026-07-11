FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_SETARA_API_BASE_URL=http://localhost:8080
ARG VITE_SETARA_WS_BASE_URL=ws://localhost:8080
ARG VITE_BUILD_SHA=dev
ENV VITE_SETARA_API_BASE_URL=$VITE_SETARA_API_BASE_URL
ENV VITE_SETARA_WS_BASE_URL=$VITE_SETARA_WS_BASE_URL
ENV VITE_BUILD_SHA=$VITE_BUILD_SHA
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json

# Run as non-root
USER node

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=10s \
  CMD wget -q -O /dev/null http://localhost:3000/ || exit 1
CMD ["node", "build"]
