# CLAUDE.md — Portal de Facturación ADDV

Contexto operativo persistente para cualquier sesión de Claude que trabaje
en este repo. Para el historial de decisiones y el estado detallado del
proyecto, ver `PROJECT_STATE.md` (fuente de verdad más completa que este
archivo). Para instrucciones de instalación/operación, ver `README.md`.

## Protocolo de trabajo

Este proyecto opera bajo el protocolo `addv-web-app` (skill de Claude Code):
sitio corporativo/reputacional, flujo obligatorio **Analizar → Proponer →
Confirmar → Implementar** — no asumir requisitos ambiguos, no implementar
sin aprobación explícita del segmento, piso no negociable de UX/accesibilidad/
rendimiento/seguridad/Docker/pruebas unitarias/calidad de código. Mantener
siempre actualizados `PROJECT_STATE.md`, este archivo y `README.md`.

Regla persistente de coordinación entre agentes: después de cualquier cambio
relevante de código, arquitectura, operación, pruebas, decisiones de producto
o estado del proyecto, actualizar siempre `PROJECT_STATE.md` y `CLAUDE.md`
antes de cerrar el trabajo. Si la sesión tiene acceso de escritura a
Claude Mem, registrar también ahí la decisión/estado para que futuras
sesiones de Claude y Codex puedan coordinarse sin depender del historial del
chat. Si solo hay acceso de lectura a Claude Mem, dejar constancia explícita
en estos archivos.

**Constancia (2026-08-12)**: esta sesión de Claude verificó el catálogo de
herramientas MCP de Claude Mem disponibles (`mcp__plugin_claude-mem_mcp-search__*`)
y confirmó que solo expone lectura/consulta (`search`, `get_observations`,
`timeline`, `list_corpora`, `build_corpus`, `prime_corpus`, `query_corpus`)
— ninguna herramienta de escritura/registro manual de observaciones.
Los segmentos 8 y 9 (MySQL HA/Swarm y app de control `/control`) quedan
documentados aquí, en `PROJECT_STATE.md` (puntos 95-96) y `README.md` para
que Codex u otra sesión de Claude puedan continuar sin depender de este
chat. El registro automático en Claude Mem de esta sesión (si ocurre) pasa
por el hook de cierre de sesión, no por una llamada manual de esta sesión.

Esta regla se ejecuta junto con el protocolo
`addv-web-app`: analizar primero, proponer un segmento acotado, esperar
confirmación explícita del usuario e implementar solo el segmento aprobado,
manteniendo el piso obligatorio de UX/accesibilidad/rendimiento/seguridad/
Docker/pruebas/calidad.

## Stack

Node.js 20 + Express 4, MySQL 8 (`mysql2/promise`, SQL crudo, sin ORM),
Nginx sirviendo frontend estático (HTML/CSS/JS vanilla, sin build step),
todo sobre Docker/Docker Compose. Ver README para la lista completa de
dependencias. Prefijo de contenedores: `pfacturacion-*` (renombrado desde
`fiscal-uploads-*`, ver PROJECT_STATE.md punto 98 — nombre viejo de una
etapa anterior del proyecto, cosmético, sin efecto en comportamiento).

**Tres servicios de aplicación, tres directorios de build separados**
(segmento 9b, ver PROJECT_STATE.md punto 99): `backend/` (portal de
cliente + panel `/admin` por tenant), `control/` (app de control
`/control`, cross-tenant, en su PROPIO contenedor por seguridad —
credencial MySQL angosta `control_app`, sin acceso a ninguna base
`tenant_*`, auth solo `ADMIN_USERS`), `frontend/` (nginx, sirve estático
+ reenvía `/api/*` a `backend` y `/api/control/*` a `control` vía
plantilla `nginx.conf.template` con `envsubst`, así `control` puede vivir
en otro servidor cambiando `CONTROL_UPSTREAM_HOST`/`PORT`). NO copies
código entre `backend/` y `control/` en producción — son contextos de
build de Docker separados, código pequeño compartido se duplica a
propósito (mismo patrón que el frontend sin bundler).

## Comandos frecuentes

```bash
# Levantar todo el stack
docker compose up -d --build

# Health check
curl http://localhost/api/health

# Pruebas unitarias (mockeadas, sin DB real)
cd backend && npm test          # o: npx jest test/unit
cd control && npm test          # app de control, contenedor/paquete aparte

# Pruebas de integración (supertest, sin DB real)
npx jest test/integration

# Regresión contra MySQL real (requiere el stack levantado)
docker compose exec backend node scripts/verificar-mysql.js

# MySQL HA (segmento 8, docker-stack.yml/Swarm — ver README, sección
# "MySQL en alta disponibilidad") — enganchar/verificar/promover réplica:
node backend/scripts/configure-replica.js
node backend/scripts/verify-replication.js
node backend/scripts/promote-replica.js

# node --check en cualquier archivo tocado, antes de dar un cambio por bueno
node --check backend/ruta/al/archivo.js
```

## Convenciones establecidas

- Nombres de variables/funciones y comentarios en **español**.
- Tablas nuevas en MySQL: `CREATE TABLE IF NOT EXISTS` con el esquema
  completo + revisión de `INFORMATION_SCHEMA.COLUMNS` antes de cualquier
  `ALTER TABLE ADD COLUMN` (para que `ensureSchema()` sea seguro de
  re-correr). Ver `backend/db.js`.
- Fechas: objetos `Date` de JS al escribir, `dateStrings: true` al leer
  (el frontend siempre recibe `"YYYY-MM-DD HH:MM:SS"` en UTC).
- Contraseñas con `crypto.scrypt` nativo — sin dependencias de compilación
  nativa.
- Sesión de cliente: cookie httpOnly firmada con HMAC, sin tabla de
  sesiones. Admin: HTTP Basic Auth de 3 niveles (ver `backend/utils/auth.js`).
- Todas las páginas del frontend reutilizan `style.css` como base; los
  demás `.css` son extensiones, no reemplazos.
- Después de cualquier cambio: `node --check` en los `.js` tocados +
  suite Jest existente sin regresiones + actualizar `PROJECT_STATE.md`.
- Antes de dar por "no disponible" una skill/herramienta mencionada por el
  usuario: revisar el catálogo de skills activas, luego `D:\cc`, luego el
  repositorio oficial — nunca asumir su función.

## Arquitectura en migración: multi-tenant

El proyecto está migrando de single-tenant a multi-tenant (>1000 usuarios,
múltiples empresas cliente, cada una con BD MySQL dedicada y URLs
`/<slug>` y `/<slug>/admin`). Plan completo de 9 segmentos, decisiones de
arquitectura ya aprobadas y su justificación: **`PROJECT_STATE.md`, punto
88** (arranque + segmento 1) **y punto 89** (segmento 2). Estado:

- Segmento 1 (BD de control + script de aprovisionamiento,
  `backend/scripts/provisionar-tenant.js` + `backend/utils/tenant.js`):
  hecho.
- Segmento 2 (`backend/db.js` refactorizado a registro de pools por
  tenant + proxy `AsyncLocalStorage` + `ensureSchema(db)` parametrizado):
  hecho. `pool.query(...)` en cualquier archivo existente sigue
  funcionando sin cambios — el proxy cae al pool por defecto porque nada
  establece todavía un contexto de tenant.
- Segmento 3 (`backend/utils/tenantContext.js` — middleware que resuelve
  `req.tenant` desde el encabezado `X-Tenant-Slug`; sesión de cliente con
  clave HMAC derivada por tenant vía HKDF en `authUsuario.js`; realm de
  Basic Auth con slug en `auth.js`): hecho. Montado globalmente en
  `server.js`, justo después de `cookieParser()`.
- Segmento 4 (`frontend/nginx.conf` con 3 `location` nuevas por regex
  para `/<slug>/admin`, `/<slug>/(dashboard|tickets|login|csf)` y
  `/<slug>/api/*`; frontend tenant-aware en `portal.js`/`login.js`/
  `admin.js`/`app.js`; assets locales pasados a rutas absolutas):
  hecho.
- Segmento 5 (`backend/utils/storage.js` — almacenamiento migrado de
  disco local a MinIO/S3, servicio `minio` en `docker-compose.yml`,
  22 call sites de `fs.*` reemplazados en `server.js`): hecho. **Este es
  el primer segmento que cambia comportamiento real para el tráfico de
  hoy** (no solo para un tenant futuro) — no se pudo probar contra MinIO
  real en el entorno donde se construyó (sin Docker daemon disponible),
  así que antes de confiar esto en producción hay que levantar el stack
  y probar subir/bajar/borrar archivos de verdad. Ver PROJECT_STATE.md
  punto 92, sección "Pendiente antes de producción".
- Segmento 6 (`backend/scripts/cutover-tenant-piloto.js` — runbook/script
  para convertir la BD de un solo tenant en el primer tenant real; no
  destructivo, verificado paso a paso, corte de tráfico real deliberadamente
  manual): hecho, pero **nunca ejecutado** — no hay MySQL/MinIO real en
  este entorno. El usuario debe correrlo él mismo cuando esté listo (ver
  PROJECT_STATE.md punto 93), idealmente contra una copia/backup primero.
- Segmento 7 (`backend/utils/adminAuditoria.js`, rate limits tenant-aware,
  anti-enumeración de tenants, limpieza de `X-Tenant-Slug` en nginx,
  cabeceras de seguridad y `Cache-Control: no-store` para API): hecho.
  Cierra el hueco documentado de auditoría de `ADMIN_USERS` como acceso
  super/global y endurece el borde multi-tenant sin agregar una UI nueva
  de consulta de auditoría.
- Segmento 8 (`docker-stack.yml` para Docker Swarm, MySQL primario/réplica
  por GTID vía `mysql/conf/*.cnf`, scripts
  `backend/scripts/configure-replica.js` / `promote-replica.js` /
  `verify-replication.js`): hecho, con dos decisiones de alcance ya
  tomadas — failover **manual** (no automático) y lecturas **solo en el
  primario** (réplica es standby, no escalado de lecturas). Ver
  PROJECT_STATE.md punto 95. **Nunca desplegado contra un clúster Swarm ni
  MySQL replicando de verdad** — antes de producción, levantar un clúster
  de prueba y validar los 3 scripts contra infraestructura real, incluido
  un failover simulado.
- Segmento 9 (FINAL — `/control`, app cross-tenant para gestionar el
  ciclo de vida de tenants ya existentes: suspender/reactivar/dar de
  baja): hecho. Solo perfil `'super'`. **No incluye crear tenants
  nuevos** — eso sigue siendo el script CLI `provisionar-tenant.js`
  (requiere root de MySQL). Ver PROJECT_STATE.md punto 96. Con este
  segmento, el plan de 9 segmentos de migración a multi-tenant quedó
  completo.
- Segmento 9b: `/control` movido a su propio contenedor (`control/`,
  directorio y build de Docker separados de `backend/`) — pedido
  explícito del usuario, por seguridad (credencial MySQL angosta
  `control_app`, sin acceso a `tenant_*`) y portabilidad
  (`CONTROL_UPSTREAM_HOST`/`PORT` en nginx, puede vivir en otro
  servidor). Auth de `/control` ahora es SOLO `ADMIN_USERS` (sin
  `fallback_admin`/`perfil_bd`, que solo aplican a `/admin`).
  Invalidación de caché entre contenedores vía
  `POST /internal/cache-tenant/invalidar` en backend (secreto
  compartido `INTERNAL_CACHE_SECRET`) — validado en vivo: efecto
  inmediato, no hasta 45s después. Ver PROJECT_STATE.md punto 99.
- **Segunda validación del segmento 9b, con clics reales en navegador**
  (extensión Claude in Chrome, ver PROJECT_STATE.md punto 100): confirmó
  `/admin` y `/control` de punta a punta (login, suspender/reactivar con
  modal + toast + tabla actualizándose sola). Encontró y corrigió un bug
  chico: `frontend/control.html` seguía mencionando "la cuenta de
  respaldo" en el texto de ayuda del login, ya no aplica (`/control` solo
  acepta `ADMIN_USERS`).
- Segmento 9c (alta de empresa nueva desde `/control`, ver
  PROJECT_STATE.md punto 101): `POST /api/control/tenants` en
  `control/server.js` + `control/utils/tenantIntake.js` guardan la
  solicitud con `estado='provisioning'` (sin tocar la decisión de
  seguridad del segmento 1: CREATE DATABASE + GRANT siguen siendo solo
  del script CLI `backend/scripts/provisionar-tenant.js`, que ahora
  detecta esas filas y las completa en vez de rechazarlas como "ya
  existe"). Campos fiscales opcionales (7 columnas nullable nuevas en
  `tenants`, pre-llenado de la config fiscal del tenant al aprovisionar
  vía `aplicarConfiguracionFiscalEnProcesoHijo`). Modal "Nueva empresa"
  en `frontend/control.html`/`control.js`. **Validado contra Docker/
  MySQL reales (2026-08-13)**: 201/400/409 del intake, flujo completo
  provisioning → activo con pre-llenado fiscal, ciclo de vida 404/200.
  Bug encontrado y corregido en la rama 9c de
  `backend/scripts/provisionar-tenant.js`: los procesos hijo usaban
  `fila.db_host` ('mysql', nombre Docker) en vez de `dbHost` del env —
  desde el host no resolvía (ENOTFOUND). **Validación E2E en navegador
  real (Playwright, 2026-08-13)**: `e2e/tests/control-alta-empresa.spec.ts`
  (login /control → modal → captura con fiscales → fila "Provisionando" +
  rechazo de slug duplicado) y `e2e/tests/contexto-urls.spec.ts` (el slug
  define las URLs `/e2e9c…` y `/e2e9c…/admin`, API tenant-aware resuelve
  contra la BD del tenant, slug inexistente 404) — 7/7 passed, dos
  tenants reales aprovisionados y validados de punta a punta. El slug
  activo vive en `e2e/.slug-e2e.txt` (gitignored) para coordinar
  captura → aprovisionamiento CLI → validación de URLs. No avanzar sin
  aprobación explícita del usuario, mismo protocolo `addv-web-app`.
- **Validación E2E funcional del flujo completo en el tenant real
  `piloto9c` (Playwright headed, 2026-08-13, ver PROJECT_STATE.md punto
  102)**: `e2e/tests/flujo-facturacion-piloto9c.spec.ts` (5 tests seriales:
  registro+CSF → orden de compra → ticket → factura ZIP → descarga del
  cliente), **5/5 passed** contra el stack Docker real. Encontró y
  corrigió **dos bugs de producción**:
  1. **ALS/multer (multi-tenant)**: el AsyncLocalStorage de
     `ejecutarComoTenant` no se propaga de forma confiable al callback de
     multer/busboy → `pool.query` caía a veces a `portal_facturacion`
     (registros huérfanos, `COMPRA_NO_ENCONTRADA` intermitentes). Fix:
     `req.poolTenant` en `backend/utils/tenantContext.js` + helpers
     `reanudarContextoTenant`/`subirConTenant` en `backend/server.js` que
     envuelven los 4 call sites de multer (tickets, registro,
     constancia-compania, factura).
  2. **Desfase de 1 segundo en órdenes de compra**: `new Date()` con
     milisegundos → `Intl.DateTimeFormat` trunca la hora mostrada pero
     MySQL redondea la guardada → la validación del ticket fallaba ~50%
     de las veces con datos correctos. Fix: `ahora.setMilliseconds(0)`
     antes del INSERT/respuesta en `POST /api/admin/ordenes-compra`.
  Suite Jest 388/388, y la suite E2E es idempotente (limpia tickets
  residuales en `beforeAll` y cierra el modal de notificación si aparece).
  No avanzar sin aprobación explícita del usuario, mismo protocolo
  `addv-web-app`.
- **Primera corrida real contra Docker (punto 97 de PROJECT_STATE.md,
  IMPORTANTE leer antes de tocar `nginx.conf`/`Dockerfile`/`*.cnf`
  otra vez)**: encontró y corrigió 4 bugs que ningún `node --check` podía
  detectar — regex de tenant en `nginx.conf` sin comillas (rompía el
  arranque de nginx desde el segmento 4), `control.html`/`control.js`
  faltaban en `frontend/Dockerfile`, `read_only`/`super_read_only`
  estáticos en `replica.cnf` bloqueaban el bootstrap del contenedor
  réplica (movido a `SET PERSIST` en tiempo de ejecución), y el
  `HEALTHCHECK` del frontend usaba `localhost` (resolvía a IPv6 donde
  nginx no escuchaba) en vez de `127.0.0.1`. Ciclo de vida completo de
  `/control` y replicación GTID real validados end-to-end contra
  contenedores reales. Sigue sin probar: Docker Swarm multi-nodo real.
- **Todavía no hay ningún tenant real dado de alta** — nada de esto
  recibe tráfico real hoy.

Las tres superficies de la app: portal de cliente (sin prefijo o
`/<slug>/...`), panel admin por tenant (`/admin` o `/<slug>/admin`), y
app de control cross-tenant super-only (`/control`, segmento 9). El plan
de migración a multi-tenant de 9 segmentos está completo — cualquier
trabajo nuevo sobre esta arquitectura es evolución posterior, no un
segmento pendiente del plan original; sigue el mismo protocolo
`addv-web-app` de analizar-proponer-confirmar-implementar de todas
formas.

## Limitaciones conocidas de entornos de generación sin Docker/MySQL real

Ver la sección "Limitaciones de ESTE entorno de generación" en
`PROJECT_STATE.md` — en general: sin acceso a un MySQL/Docker corriendo,
la validación se limita a `node --check`, pruebas unitarias con mocks, y
trazado manual de queries. Cualquier cambio de esquema/queries debe
confirmarse corriendo `backend/scripts/verificar-mysql.js` contra MySQL
real antes de producción.
