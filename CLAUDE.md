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
  registro+CSF → venta → ticket → factura ZIP → descarga del
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
  2. **Desfase de 1 segundo en ventas**: `new Date()` con
     milisegundos → `Intl.DateTimeFormat` trunca la hora mostrada pero
     MySQL redondea la guardada → la validación del ticket fallaba ~50%
     de las veces con datos correctos. Fix: `ahora.setMilliseconds(0)`
     antes del INSERT/respuesta en `POST /api/admin/ordenes-compra`.
  Suite Jest 388/388, y la suite E2E es idempotente (limpia tickets
  residuales en `beforeAll` y cierra el modal de notificación si aparece).
  No avanzar sin aprobación explícita del usuario, mismo protocolo
  `addv-web-app`.
- **Segmento "Marca" (ver PROJECT_STATE.md punto 103)**: hecho y validado
  contra Docker/MySQL reales (2026-08-13). Campo `marca` (VARCHAR 255) +
  `marca_logo_url` (VARCHAR 500) en `control_tenants.tenants` (solo vía
  `control/scripts/ensureSchema.js`); logo en MinIO bajo key
  `marca/<slug>/logo` (sin extensión, ContentType del objeto), subido por
  el control vía `POST/DELETE /internal/marca-logo/:slug` (secreto
  `X-Internal-Secret`, NO expuesto por nginx) y servido por
  `GET /api/marca-logo/:slug` (público a propósito — va en correos —,
  `Cache-Control: public, max-age=86400`). Los 7 "ADDV" incrustados en
  correos del backend quedaron mapeados a `MARCA_DEFECTO='ADDV'` +
  `marcaDelTenant(req)` en `backend/server.js` (tickets, órdenes de
  compra, invitación, ticket nuevo al contador, factura lista, plantilla
  default de `backend/utils/email.js`); `req.tenant.marca`/`marcaLoGoUrl`
  llegan desde `tenantContext.js`. API de control:
  `PUT /api/control/tenants/:slug/marca` (`{marca?, logoBase64?,
  quitarLogo?}`, 400/404/502, evento `marca_actualizada` + invalidación
  de caché) en `control/utils/tenantMarca.js`; el intake 9c acepta
  `marca`+`logoBase64` (sube el logo antes de crear la fila; huérfano en
  MinIO si el alta falla, aceptado). UI: campo Marca + logo en el modal
  de alta y botón "Editar marca" por fila en `/control`; etiqueta
  "Slug (Contexto URL único)". Límites `express.json` en 4mb (backend y
  control) para el base64; `MAX_MARCA_LOGO_MB=2` (env en ambos).
  Verificación: backend Jest 482/482 (28 suites), control 67/67 (6
  suites), E2E piloto9c 5/5, flujo real (subir/GET/borrar logo contra
  MinIO real, invitación con la marca del tenant hasta SMTP).
  No avanzar sin aprobación explícita del usuario, mismo protocolo
  `addv-web-app`.
- **Segmento "Edición" (ver PROJECT_STATE.md punto 104)**: hecho y
  **validado contra Docker/MySQL/MinIO reales (2026-08-14)**: rebuild
  del stack; renombrado de slug con 4 archivos reales + logo (migración
  íntegra verificada byte a byte, prefijo viejo vacío, db_name
  conservado, auditoría `slug_cambiado`, URLs 200/404); spec E2E NUEVO
  `e2e/tests/control-editar-empresa.spec.ts` (2/2) y suite E2E completa
  14/14. Detalle de la validación: el checkbox del switch "Cambiar
  slug" está oculto visualmente — se interactúa con su label.
  Edición completa de una empresa existente desde `/control`: botón
  "Editar" por fila → modal con los MISMOS campos que el alta + slug
  en solo lectura, habilitable solo con el switch "Cambiar slug
  (avanzado)" (CSS `.control-switch` en `frontend/admin.css`; el modal
  viejo "Editar marca" del punto 103 quedó reemplazado). API:
  `PUT /api/control/tenants/:slug`
  (`control/utils/tenantEdicion.js`, 200/400/404/409/502). Cambiar slug
  dispara ANTES la migración de TODOS los archivos del tenant en MinIO
  vía endpoint interno `POST /internal/renombrar-slug` en
  `backend/server.js` (secreto `X-Internal-Secret`, NO expuesto por
  nginx; copia verificada por conteo → 502 sin borrar nada si no cuadra;
  helpers `copiarArchivo`/`eliminarPrefijo` nuevos en
  `backend/utils/storage.js`). La BD física NO se renombra (`db_name` se
  conserva; solo en `provisioning` se regenera con el slug nuevo);
  `storage_prefix` sí cambia. nginx no necesita recarga (rutas regex del
  segmento 4); el control invalida la caché del backend para ambos
  slugs. Auditoría `datos_actualizados`/`slug_cambiado` en
  `tenant_eventos`. Bug corregido en la revisión: el toast de éxito
  comparaba el slug después de `cerrarEdicion()` (habría dicho siempre
  "el slug cambió") — se captura el slug anterior antes de cerrar el
  modal. Suites al día: backend 492/492 (28 suites), control 88/88 (7
  suites), E2E completa 14/14. No avanzar sin aprobación explícita del
  usuario, mismo protocolo `addv-web-app`.
- **Segmento "Look & Feel" (ver PROJECT_STATE.md punto 105)**: identidad
  visual (tema) por empresa desde `/control` — paleta de colores,
  tipografías (catálogo cerrado de 8 fuentes Google Fonts, nunca texto
  libre), radio de esquinas y favicon propio, sobre el diseño base ADDV.
  Columna nueva `tema_json` (TEXT NULL) en `control_tenants.tenants`;
  validación DUPLICADA `backend/utils/tenantTema.js` /
  `control/utils/tenantTema.js` (mismo principio que `tenantMarca.js`),
  incluido contraste **WCAG 2.1 AA real** sobre 9 pares fondo/texto (400
  si no cumple). Favicon con el mismo patrón que el logo de marca:
  `POST`/`DELETE /internal/favicon/:slug` en `backend/server.js`
  (`X-Internal-Secret`, no expuesto por nginx), MinIO
  `marca/<slug>/favicon`, público en `GET /api/favicon/:slug` (cache
  24h); el renombrado de slug del segmento 104 ya lo migra. API:
  `PUT /api/control/tenants/:slug/tema` (200/400/404/502) y pública
  `GET /api/tema/:slug` (siempre 200, cache 5 min) que arma
  `{marca, marcaLoGoUrl, tema, variables, fuentesGoogle}`. Frontend:
  script nuevo `frontend/theme.js` (cargado después de `style.css` en
  las 6 páginas del portal, pinta CSS variables en runtime, degradación
  elegante si falla) y sección colapsable "Identidad visual" con vista
  previa en vivo dentro del modal de edición de `/control`.
  **Sin verificar en esta revisión** (sesión sin autorización para
  correr `node --check`/Jest): faltan pruebas en `control/` (no hay
  `tenantTema.test.js` ahí, solo en `backend/`) y validación contra
  Docker/MySQL/MinIO reales, mismo patrón pendiente que los segmentos
  103/104 antes de este punto. Se corrigió un mojibake (encoding roto,
  cosmético) en un comentario de `control/scripts/ensureSchema.js`
  durante esta revisión. No avanzar sin aprobación explícita del
  usuario, mismo protocolo `addv-web-app`.
- **Siembra de datos de demostración, COMPLETA (ver PROJECT_STATE.md
  punto 115)**: flujo real end-to-end por HTTP (registro cliente → CSF →
  venta → ticket → factura/gastos) contra Docker vivo, para tener datos
  de muestra reales de cara a una demo. Conteos finales verificados por
  SQL directo: "Sin contexto" (`portal_facturacion`) 7 clientes/14
  ventas/14 tickets/10 gastos; tenant `pruebaadmin` 4 clientes/8 ventas/8
  tickets (5 listo/2 pendiente/1 en_curso)/7 gastos; tenant `piloto9c` 4
  clientes nuevos + 1 preexistente de E2E/8 ventas/8 tickets (misma
  distribución 5/2/1)/7 gastos. **Hallazgo resuelto**: los tenants
  `pruebaadmin`/`piloto9c` no tenían la tabla `gastos` porque
  `ensureSchema()` nunca corre contra tenants ya aprovisionados, solo
  contra el pool por defecto — se aplicó corriendo `ensureSchema()`
  directo dentro del contenedor `backend` con `DB_NAME` apuntando a cada
  tenant (`provisionar-tenant.js` no sirve para esto: rechaza re-correr
  contra un tenant ya `activo`). **Bug real encontrado en el camino** (no
  del script de siembra, del endpoint): `POST /api/registro` guarda en
  `registros.rfc` el valor que mande el formulario (`body.rfc`), no el
  RFC extraído del PDF ni el de la sesión — subir la CSF sin mandar
  explícitamente el campo `rfc` deja `registros.rfc` en NULL de forma
  silenciosa (200 OK, el campo es opcional a propósito) y rompe
  después `POST /api/tickets` con `SIN_CONSTANCIA` porque ese endpoint
  busca por `rfc` exacto. Documentado en el punto 115 para que cualquier
  integración futura contra `POST /api/registro` no repita el error.
- **Auditoría de seguridad OWASP Top 10, sitio completo (ver
  PROJECT_STATE.md punto 116, 2026-08-20)**: a pedido explícito del
  usuario, 3 auditorías en paralelo (`backend/`+`control/`, `frontend/`,
  Docker/infra) contra Docker/MySQL/MinIO reales, con autorización previa
  para corregir sin esperar confirmación (no para commitear/pushear).
  Jest backend 551/551, control 88/88 tras las correcciones. Corregidos:
  timing attacks en `X-Internal-Secret` y en login (cliente+admin,
  `crypto.timingSafeEqual`), enumeración sin rate limit en
  `GET /api/registro/buscar`/`:email`, password root de MySQL expuesto en
  texto plano vía healthcheck (`docker inspect`/`docker top`), puertos
  MySQL/MinIO console publicados a `0.0.0.0` (ahora solo `127.0.0.1`),
  falta de `.dockerignore` en `control/` (riesgo de `.env` local
  copiado a la imagen), falta `no-new-privileges` (CIS Docker Benchmark)
  en los 5+6 servicios de compose/stack, mockup con CDN Tailwind sin SRI
  expuesto en el build público del frontend (reubicado fuera de
  `frontend/assets/`), cabeceras `server_tokens off`/HSTS condicional en
  nginx, `.gitignore`/`.env.example`/README con advertencias reforzadas.
  **Pendiente (alto, no corregido)**: `nodemailer@6.10.1` vulnerable
  (CRLF/SMTP injection, SSRF vía opción `raw`) — requiere salto de major
  a v9 con prueba de envío SMTP real antes de mergear, fuera del alcance
  de un fix seguro sin esa validación. **Bug real de producto encontrado
  y corregido de paso** (no de seguridad): typo `marcaLoGoUrl` en
  `POST /api/admin/ordenes-compra` (`backend/server.js`) causaba
  `ReferenceError`/500 al crear una venta en cualquier tenant con logo de
  marca configurado (la venta ya quedaba insertada, pero el admin recibía
  500 y el correo de confirmación nunca salía). Todo el detalle línea por
  línea, incluidos los hallazgos "ya conocidos" y las recomendaciones no
  aplicadas (segmentar la red plana de Docker), en el punto 116. No se
  hizo ningún commit/push — todo en el working tree para revisión del
  usuario.
- **Vista "Resumen financiero" (ver PROJECT_STATE.md punto 114)**: a
  partir del mockup `stitch/stitch_portal_financiero`, vista nueva y
  propia (no dentro de "Inicio", que es del perfil `fiscal`) para el
  perfil `administrador` (+ super) — 4 KPIs del mes (Total facturado,
  Total gastos, "Balance ventas vs gastos" y "Ventas sin facturar",
  renombrados desde "IVA Neto"/"Tickets Pendientes" del mockup por no
  tener respaldo fiscal/de datos real) + gráfica en barras CSS que
  arranca en el mes actual hacia adelante y omite meses sin actividad.
  Endpoint `GET /api/admin/resumen-financiero`
  (`requireAdminArea('administrador')`). Jest 551/551, validado contra
  Docker/MySQL reales y en navegador real (Claude in Chrome). **Bug
  preexistente encontrado y corregido de paso** (no causado por este
  segmento): perfil `fiscal` veía el botón "Ventas" porque
  `aplicarVisibilidadOrdenesCompra()` (toggle "Habilitar Ventas") pisaba
  `hidden` sin considerar el perfil — ahora `ventasHabilitadaGlobalmente`
  se combina dentro de `aplicarRestriccionesPerfil()`, única fuente de
  verdad.
- **Diagnóstico post-opencode (ver PROJECT_STATE.md punto 113)**: otra
  herramienta de IA (opencode) trabajó este mismo repo y agregó 6 commits
  (módulo "Gastos", fix de `verificar-mysql.js`, renombrado "Orden de
  compra"→"Ventas") ya en `fact/master`. Auditados: `node --check` limpio,
  backend Jest 546/546. Único hallazgo real: `control/`
  `ensureSchema.test.js` desactualizado (le faltaba la columna
  `tema_json` del segmento 105) — no es bug de opencode, corregido en
  esta sesión, `control/` Jest vuelve a 88/88.
- **Rediseño de login (cliente y admin), ver PROJECT_STATE.md punto
  106**: split-screen fiel a un mock aportado por el usuario (carpeta
  `stitch/` en la raíz, no borrar). Paleta propia contenida en
  `.auth-shell` (`frontend/auth.css`, variables CSS locales, no toca el
  verde base de `style.css`). Marca por defecto "CLARVO" como imagen
  estática (`frontend/assets/branding.png` + `login-decoracion-marca.png`,
  aportadas por el usuario) — pierde el reemplazo dinámico de marca de
  `theme.js` solo en esta franja. Bug real corregido en `style.css`:
  faltaban `password`/`tel`/`url`/`number`/`date` en el selector base de
  `.field input`. `frontend/Dockerfile` corregido: le faltaba copiar
  `theme.js` (bug preexistente del segmento 105) y la carpeta `assets/`.
  Sin probar contra Docker real ni Playwright en esta sesión.
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
- **Remotes git (ver PROJECT_STATE.md punto 107)**: `origin` apunta a
  `portal-multi.git` y `fact` a `ADDVportalFact.git` (el repo donde se
  publica el trabajo real). Publicar = `git push fact main:master` (la
  rama local es `main`; el master remoto fue reemplazado por force push
  el 2026-08-18, los 53 commits previos quedaron huérfanos, la rama
  `prototipo` del remote sigue intacta). No asumir `origin` como destino
  de publicación sin verificar antes.
- **Rediseño de `/admin` y del portal de cliente fiel a `stitch/`, ver
  PROJECT_STATE.md punto 108**: sidebar navy en el admin (mockup
  `panel_admin_...`), modal "Gestionar" de tickets en 2 columnas (mockup
  `detalle_de_solicitud`), vista "Inicio" nueva con estatísticas/dona
  reales de tickets (mockup `dashboard_portal_addv_...`, ahora primera en
  el sidebar, con "Tickets" en segunda posición), y la misma paleta navy
  + logo claro (`frontend/assets/branding_bgo.png`) en la barra superior
  del portal de cliente. Validado en vivo contra Docker/MySQL/MinIO
  reales y con la extensión Claude in Chrome — no solo `node --check`.
  Dos tenants de prueba viven en el volumen de MySQL de quien haya
  corrido esta sesión (`pruebaadmin`, `piloto9c`) para esa validación —
  no son tenants reales, se pueden dar de baja o ignorar. **Gotcha de
  Docker/navegador para la próxima sesión**: un `docker compose build
  <servicio>` normal a veces no recoge cambios de archivo (usar
  `--no-cache` + `up -d --force-recreate` si un rebuild no se refleja al
  probar) y el navegador cachea HTML/CSS en disco tras el rebuild (forzar
  `Ctrl+Shift+R`). Sigue vigente: **todavía no hay ningún tenant real de
  producción dado de alta** — nada de esto recibe tráfico real hoy.
- **Módulo "Gastos" (ver PROJECT_STATE.md punto 109)**: control
  administrativo de gastos de la operación — solo perfil `administrador`.
  Categorías en lista CERRADA en código (`backend/utils/gastos.js`),
  tabla `gastos` en `backend/db.js` con CHECK `chk_gastos_categoria`,
  comprobante opcional PDF/ZIP en MinIO (carpeta `comprobantes`).
  Backend: CRUD + papelera (restaurar/permanente) + comprobante
  (subir/descargar/quitar) en `backend/server.js` bajo
  `/api/admin/gastos`. Frontend: vista "Gastos" en `frontend/admin.js`/
  `admin.html`/`admin.css` (botón `#btn-vista-gastos` en el sidebar entre
  Órdenes y Usuarios, KPIs + filtros + tabla con columnas ocultables +
  modales de alta/edición/detalle). `node --check` + Jest **546/546**
  (32 suites); se corrigió de paso la falla preexistente de
  `tema.test.js` (typo `marcaLogoUrl` → alineado al servidor
  `marcaLoGoUrl`). **Validado contra MySQL+MinIO reales (2026-08-19)**:
  tabla `gastos` + CHECK `chk_gastos_categoria` en MySQL real, ciclo
  completo por API (alta → lista+resumen → comprobante PDF en MinIO →
  descarga → edición a sin factura borra el archivo → papelera/
  restaurar/permanente, auditoría `admin_auditoria` registra todo);
  verificar-mysql.js 305/305 (las 6 fallas preexistentes de `numero_compra`
  y `tipo_persona` quedaron corregidas — ver punto 111). Rebuild
  del frontend para la revisión visual (2026-08-19): `docker compose
  build --no-cache frontend` + `up -d frontend` NO recreó el contenedor
  (seguía sirviendo `admin.html` viejo — hubo que `docker compose up -d
  --force-recreate frontend`); el recreate además reseteó el mapeo de
  puertos a `80:80`, así que quedó fijado `FRONTEND_PORT=8088` en `.env`
  para volver a `http://localhost:8088`. Se sembraron 3 gastos de prueba
  por API (2 activos, 1 en papelera, uno con comprobante PDF) para la
  revisión manual. **Revisión visual APROBADA por el usuario (2026-08-19)**:
  `http://localhost:8088/admin` (`admin:admin`).
- **Renombrado "Orden de compra" → "Ventas" (ver PROJECT_STATE.md punto 112)**
  (2026-08-19): solo texto visible al usuario (panel admin, portal del
  cliente, correos y reportes); identificadores intactos a propósito (tabla
  `ordenes_compra`, columnas `numero_compra`/etc., endpoint
  `/api/admin/ordenes-compra`, config `ordenes_compra_habilitado`, IDs/classes
  y prefijo `OC-000001`). Tests al día (`tickets.test.js`,
  `reportes.test.js`) + `node --check` + Jest **546/546**. Rebuild
  backend+frontend (`--no-cache` + `--force-recreate`) verificado por HTTP
  (health OK, `/admin` y `/tickets` sirven el nuevo texto);
  `FRONTEND_PORT=8088` conservado. Commit `a34c877` pusheado a `fact`.

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
