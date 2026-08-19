# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS api-build
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm install
COPY api/ ./
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache postgresql-client
COPY --from=api-build /app/api/node_modules ./node_modules
COPY --from=api-build /app/api/dist ./dist
COPY --from=api-build /app/api/generated ./generated
COPY --from=api-build /app/api/prisma ./prisma
COPY --from=api-build /app/api/prisma.config.ts ./prisma.config.ts
COPY --from=api-build /app/api/src ./src
COPY --from=api-build /app/api/tsconfig.json ./tsconfig.json
COPY --from=api-build /app/api/package.json ./package.json
COPY --from=frontend-build /app/frontend/dist ./public
RUN mkdir -p /app/uploads/coats-of-arms

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
