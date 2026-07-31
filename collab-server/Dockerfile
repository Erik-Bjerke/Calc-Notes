# Numori collaborative sync service — small standalone image.
FROM node:24.18.1-alpine AS base

WORKDIR /app

COPY collab-server/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY collab-server/ ./

FROM node:24.18.1-alpine AS production
WORKDIR /app
COPY --from=base /app /app

RUN addgroup -g 1001 -S nodejs && adduser -S collab -u 1001
RUN chown -R collab:nodejs /app
USER collab

EXPOSE 3030
ENV NODE_ENV=production
CMD ["node", "index.mjs"]
