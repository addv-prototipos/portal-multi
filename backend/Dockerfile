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

# Usuario sin privilegios para ejecutar la aplicacion. Hasta la auditoria
# sonar_1.3.html (hallazgo m-11) este contenedor arrancaba como root y
# cedia el control via su-exec dentro de un docker-entrypoint.sh, porque
# el bind mount `./uploads:/app/uploads` (docker-compose.yml) podia tener
# un dueno distinto al del contenedor. Ese bind mount era config muerta
# desde el segmento 5 (los 5 multer() de server.js usan memoryStorage,
# UPLOAD_DIR solo hace un mkdirSync inofensivo al arrancar) y se retiro
# en el mismo punto — sin bind mount que ajustar, el contenedor arranca
# directo como appuser, sin su-exec ni entrypoint aparte.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

RUN mkdir -p /app/uploads && \
    chown -R appuser:appgroup /usr/src/app /app/uploads
USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
