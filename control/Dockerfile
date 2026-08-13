# ---------- Etapa de dependencias ----------
FROM node:20-alpine AS deps
WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# ---------- Etapa final ----------
FROM node:20-alpine AS final
WORKDIR /usr/src/app

ENV NODE_ENV=production

# Usuario sin privilegios — a diferencia de backend, este servicio no
# tiene ningún bind mount que ajustar (sin uploads), así que corre
# directamente como appuser, sin necesitar su-exec ni un entrypoint
# aparte que arranque como root primero.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

RUN chown -R appuser:appgroup /usr/src/app
USER appuser

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
