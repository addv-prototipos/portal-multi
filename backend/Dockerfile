# ---------- Etapa de dependencias ----------
FROM node:20-alpine AS deps
WORKDIR /usr/src/app

# A diferencia de better-sqlite3 (version anterior), mysql2 es JS puro y no
# necesita herramientas de compilacion nativas (python3/make/g++).
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# ---------- Etapa final ----------
FROM node:20-alpine AS final
WORKDIR /usr/src/app

ENV NODE_ENV=production

# Usuario sin privilegios para ejecutar la aplicacion, y su-exec para poder
# arrancar como root (solo para fijar permisos del bind mount de uploads) y
# luego ceder el control a ese usuario sin privilegios.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    apk add --no-cache su-exec

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

RUN mkdir -p /app/uploads && \
    chown -R appuser:appgroup /usr/src/app /app/uploads && \
    chmod +x docker-entrypoint.sh

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
