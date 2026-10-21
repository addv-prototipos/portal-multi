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
#
# Hallazgo m-11 (sonar_1.1.html, 2026-10-19), verificado contra el
# contenedor real (`docker exec portalManager-backend ps aux`): el
# proceso node YA corre como "appuser" (PID 1 = appuser, nunca root) —
# docker-entrypoint.sh hace el su-exec al final. Lo que el análisis
# estático detecta es la AUSENCIA de un `USER appuser` en este Dockerfile
# — eso es a propósito, NO un descuido: `./uploads:/app/uploads`
# (docker-compose.yml y prod/docker-compose.prod.yml) es un bind mount
# real, cuyo dueño en el host puede no coincidir con appuser dentro del
# contenedor. Un `USER appuser` aquí arrancaría el contenedor YA como
# appuser, y el `chown -R appuser:appgroup "$UPLOAD_DIR"` de
# docker-entrypoint.sh fallaría (sin privilegios para tomar dueño de un
# directorio que no es suyo) — el patrón correcto para "arranca como root
# solo para preparar el entorno, corre como no-root" es ESTE (su-exec
# dentro del entrypoint), no el `USER` estático del Dockerfile. No
# "arreglar" agregando `USER appuser` sin antes resolver de otra forma el
# chown del bind mount.
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
