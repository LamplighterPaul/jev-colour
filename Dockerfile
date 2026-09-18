FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY server.js jev.js palette.js ./
COPY public ./public
# The daily spend counter lives here; mount a volume at /data to keep it across deploys.
RUN mkdir -p /data && chown node:node /data
ENV USAGE_FILE=/data/usage.json
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/up || exit 1
CMD ["node", "server.js"]
