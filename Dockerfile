FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN AUTH_DATABASE_URL='postgresql://build:build@localhost:5432/build?schema=auth' npm run auth:db:generate \
  && npm run build

FROM node:22-alpine AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node

# SERVICE is set by ci-deploy for gateway or an internal microservice.
CMD ["sh", "-c", "node dist/apps/${SERVICE:-gateway}/src/main.js"]
