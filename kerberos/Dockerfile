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
# (solo GET, ver utils/dockerClient.js) — en Docker Desktop (Windows/Mac)
# el socket montado pertenece al grupo "root" visto desde dentro del
# contenedor, así que appuser necesita pertenecer a ese grupo para poder
# leerlo. root:0 es universal entre hosts (mismo criterio documentado en
# imágenes oficiales que exponen el socket de Docker).
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && addgroup appuser root

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

RUN chown -R appuser:appgroup /usr/src/app
USER appuser

EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4100/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
