# ---------- Etapa de dependencias ----------
FROM node:20-alpine AS deps
WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# ---------- Etapa final ----------
FROM node:20-alpine AS final
WORKDIR /usr/src/app

ENV NODE_ENV=production

# Este contenedor lee /var/run/docker.sock para listar contenedores/logs
# (solo GET, ver utils/dockerClient.js). El grupo DUEÑO de ese socket
# varía según el host: en Docker Desktop (Windows/Mac, donde se probó
# primero) el socket montado pertenece a "root" (GID 0) visto desde
# dentro del contenedor — appuser en ese grupo bastaba ahí. Pero en un
# Linux real (producción, Vultr) el socket es root:docker con GID 999
# (`ls -la /var/run/docker.sock` → "root docker"), un grupo DISTINTO —
# bug real encontrado en producción: "EACCES /var/run/docker.sock" con
# appuser solo en root(0). Fix: ARG configurable (999 es el default real
# de Debian/Ubuntu, confirmado en el VPS de producción) — se crea un
# grupo adicional con ese GID y appuser se agrega a AMBOS, cubriendo los
# 2 hosts sin romper ninguno. Si el GID del grupo "docker" de un host
# futuro fuera distinto, pasar --build-arg DOCKER_GID=<valor real>.
ARG DOCKER_GID=999
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && addgroup appuser root && \
    EXISTING_GROUP="$(getent group ${DOCKER_GID} | cut -d: -f1)" && \
    if [ -z "$EXISTING_GROUP" ]; then addgroup -g ${DOCKER_GID} dockerhost && addgroup appuser dockerhost; else addgroup appuser "$EXISTING_GROUP"; fi

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

RUN chown -R appuser:appgroup /usr/src/app
USER appuser

EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4100/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
