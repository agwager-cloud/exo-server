# Game server for the home server (replaces Render). This repo is the server on its own; it builds to build/.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/build build
USER node
EXPOSE 3000
CMD ["node", "build/index.js"]
