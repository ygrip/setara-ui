FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_SETARA_API_BASE_URL=http://localhost:8080
ARG VITE_SETARA_WS_BASE_URL=ws://localhost:8080
ENV VITE_SETARA_API_BASE_URL=$VITE_SETARA_API_BASE_URL
ENV VITE_SETARA_WS_BASE_URL=$VITE_SETARA_WS_BASE_URL
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "build"]
