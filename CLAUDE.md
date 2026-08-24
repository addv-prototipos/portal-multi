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
- **Gráficas BI en "Resumen financiero" (ver PROJECT_STATE.md punto 117,
  2026-08-20)**: análisis de datos reales → propuesta en markdown →
  aprobación explícita del usuario → implementación, protocolo
  `addv-web-app`. 5 gráficas nuevas (distribución de gastos por
  categoría, ventas facturadas vs sin facturar, balance acumulado,
  proyección de ventas a 2 meses con mínimo de 3 meses reales para
  mostrarse, top 5 proveedores de gasto), todas SVG/CSS puro sin
  librería externa. `GET /api/admin/resumen-financiero` extendido con
  `gastos_por_categoria`/`top_proveedores`/`proyeccion_ventas`. Jest
  552/552. Validado con datos reales de la siembra del punto 115 vía
  `curl` y **en navegador real** (Claude in Chrome, tras reconectar la
  extensión): las 5 tarjetas confirmadas visualmente contra los datos
  reales, sin errores de consola. Commit `d0b0ada`. **Rediseño de
  paleta (mismo día, punto 117)**: la paleta original de 10 colores
  arcoíris para las categorías de gasto no tenía relación con la
  identidad del panel — reemplazada por una rampa derivada de la marca
  (navy/verde/terracota ya establecidos) y luego suavizada a tonos
  pastel a pedido explícito del usuario, con espacio + `stroke-linecap:
  round` entre segmentos de dona y borde sutil en los puntos de leyenda
  para que los pasteles no pierdan definición. Las 5 tarjetas ganaron
  íconos de encabezado reutilizando los mismos badges/semántica de las
  KPI (`inicio-stat-icono-*`), sin colores nuevos inventados. Se
  investigó y descartó como bug real el "texto en negro" que reportó el
  usuario — verificado en navegador limpio que la leyenda siempre fue
  gris/oscuro neutro, el efecto venía de algo del lado de su navegador.
  Validado visualmente en navegador real. Commit `3289675`, pusheado a
  `fact`. **Rediseño de layout + modal de detalle (mismo día, punto
  117)**: a pedido del usuario ("se ve desperdiciado mucho espacio" +
  "que al dar click se abra en popup"), se corrigió la causa raíz del
  vacío en la barra mensual (`flex: 1` en una sola columna estirándose a
  ~900px — ahora `flex: 0 0 64px` + `justify-content: center`), las
  donas pasaron de apiladas a lado a lado (dona + leyenda), las 2
  gráficas dispersas (Balance acumulado/Proyección) se reagruparon
  juntas en vez de cada una emparejada con una dona densa, y "Top
  proveedores" topó sus barras a `max-width: 640px` (antes se estiraban
  a todo el ancho de pantalla). Nueva funcionalidad: botón "expandir" en
  las 6 tarjetas abre un modal grande (mismo patrón que "Gestionar" de
  tickets) que REUBICA el contenido ya renderizado (mismo elemento del
  DOM, sin duplicar lógica de render) y lo regresa al cerrar. **Bug real
  encontrado y corregido durante la validación**: excepción de JS al
  cargar (`els.btnResumenFinDetalleCerrar` null) rompía toda la vista —
  causa real: caché de disco del navegador sirviendo HTML viejo contra
  JS nuevo (mismo gotcha ya documentado, manifestación distinta —
  excepción en vez de vista vieja). `Ctrl+Shift+R` lo resolvió. Validado
  en navegador real (barra, donas y modal de detalle probados en 2
  tarjetas), sin errores de consola. Commit `1fd0dbd`, pusheado a `fact`.
- **Tarjeta "Utilidad neta del mes (ventas totales vs gastos)" (ver
  PROJECT_STATE.md punto 118, 2026-08-20, IMPLEMENTADO)**: usuario pidió
  una tarjeta nueva con gráfico para "Resumen financiero" — total
  vendido SIN importar si está facturado, el IVA cobrado en esas ventas,
  y la utilidad neta comparada contra gastos — propuesta documentada
  primero (protocolo `addv-web-app`), nombre y segmento confirmados
  explícitamente por el usuario ("Sí, implementa todo el segmento"), e
  implementado el mismo día. Corrige dos límites reales del KPI
  "Balance ventas vs gastos" existente (Facturado−Gastos, punto 114):
  (1) solo cuenta ventas ya facturadas, (2) no separa el IVA antes de
  restar gastos. **Backend**: `GET /api/admin/resumen-financiero`
  extendido — el query KPI de ventas ahora también suma
  `SUM(o.cantidad) AS subtotal` (sin join a `tickets`, una sola consulta)
  y `mes_actual` devuelve `subtotal_ventas`/`iva_ventas`/`utilidad_neta`
  (redondeo a 2 decimales contra polvo flotante); `total_vendido` no se
  duplica porque ya es `mes_actual.ventas`. **Frontend**: tarjeta
  full-width tras los 4 KPIs con número grande verde/rojo, nota visible
  del límite honesto ("IVA cobrado en ventas, no cifra fiscal" — los
  gastos solo tienen el booleano `iva_incluido`), barras apiladas CSS
  puro (Subtotal #719FD4 + IVA #C0D3EB vs Gastos gris, ancho fijo 48px,
  lección del punto 117), leyenda de 4 filas, empty state, y modal de
  detalle vía el mecanismo genérico `data-detalle-contenido`. **Tests**:
  mocks con `subtotal` + aserciones nuevas (utilidad 2800 ≠ balance 1800
  demuestra que cuenta ventas sin facturar; solo-gastos → −500).
  `node --check` limpio, Jest **552/552 (33 suites)**, resumen
  financiero 6/6. Sin cambios de esquema. **Rebuild hecho contra el
  stack real** (`--no-cache` + `--force-recreate` backend+frontend,
  lección del punto 109): health OK, HTML nuevo servido y API validada
  con datos reales (iva_ventas = ventas − subtotal exacto; utilidad
  −12,879.46 ≠ balance −37,308.46). Pendiente solo la revisión visual
  del usuario (`http://localhost:8088/admin`, `admin:admin`). Constancia
  para Claude Mem: esta sesión siguió teniendo
   solo herramientas de LECTURA de Claude Mem, así que el registro vive en
   PROJECT_STATE.md/CLAUDE.md/AGENTS.md (+ `cmem.md`).
- **Modo dashboard personalizable en Resumen financiero (ver
  PROJECT_STATE.md punto 119, 2026-08-20, IMPLEMENTADO Y VALIDADO)**:
  usuario pidió reordenar/redimensionar las tarjetas de la vista y que el
  layout se guarde por perfil restaurándose en cada ingreso — propuesta +
  decisiones capturadas por cuestionario (solo esta vista, persistencia
  servidor, guardado automático) + confirmación explícita ("Sí, implementa
  todo el segmento"). **Vanilla sin librerías**: los 11 elementos (4 KPIs
  + 7 tarjetas) son hijos directos de un tablero CSS Grid de 12 columnas
  (`#resumen-fin-tablero`, `data-dashboard-id` en cada uno; se aplanaron
  los KPIs fuera de su wrapper y se quitaron los dos `.resumen-fin-grid`)
  y el drag NUNCA mueve nodos del DOM — solo `style.order`/
  `style.gridColumn`, movimiento visual con `transform` — para no romper
  `abrirDetalleGrafica()` (el modal devuelve cada contenido a su padre
  original). Teclado completo como alternativa WCAG AA (↑/↓ posición,
  ←/→ ancho, Esc sale). Backend: tabla `preferencias_dashboard`
  (UNIQUE usuario+vista, layout_json JSON, SIN FK a usuarios a propósito —
  cuentas super/respaldo no están en `usuarios`) + `GET/PUT/DELETE
  /api/admin/preferencias-dashboard/:vista` con whitelist cerrada de IDs,
  span entero 3..12, rechazo EN BLOQUE de layouts inválidos, upsert y
  normalización de layouts viejos contra la whitelist vigente; auditoría
  cubierta por el middleware global existente. Guardado automático con
  debounce 800ms + toast; botón "Restablecer" solo visible con layout
  guardado; <900px se ignora el ancho custom pero se conserva el orden.
  Jest **560/560 (34 suites)** (8 tests nuevos). Validado contra
  Docker/MySQL reales: rebuild, health OK, HTML nuevo servido (11 IDs),
  tabla real creada, ciclo API completo por HTTP (null→PUT→GET→400s→404→
  401→DELETE) y auditoría automática verificada. Pendiente solo revisión
  visual del usuario. Claude Mem: esta sesión siguió con herramientas de
  solo lectura — registro en PROJECT_STATE.md/CLAUDE.md/AGENTS.md/cmem.md.
- **Fix de alineación + tarjeta "Sin facturar" en Resumen financiero (ver
  PROJECT_STATE.md punto 121, 2026-08-21, IMPLEMENTADO Y VALIDADO en
  navegador real)**: causa raíz del bug "barra Gastos movida/chueca" en
  "Utilidad neta del mes" — `.resumen-fin-chart-body` alineaba columnas
  por `flex-end`, así que una etiqueta de 2 líneas ("Ventas totales")
  corría hacia abajo la columna con etiqueta de 1 línea ("Gastos"); fix
  de 1 línea (`align-items: flex-start`, la caja de la barra siempre es
  200px fija en ambas). 4ta barra "Sin facturar" en "Ventas vs Facturado
  vs Gastos" — dato derivado en cliente (`ventas - facturado`, cero
  cambios de backend), color `#E4A97E` REUTILIZADO del que ya existe
  para el mismo concepto en la dona vecina (regla de la skill `dataviz`:
  "color sigue a la entidad"), validado con el validador oficial de
  paleta. Reordenada junto a "Facturado" y gap de Utilidad neta reducido
  a pedido del usuario en vivo durante la prueba. **Bug preexistente no
  relacionado, encontrado y corregido de paso**: refrescar el navegador
  en cualquier vista distinta de "Inicio" siempre regresaba a Inicio —
  ahora `sessionStorage` (`admin_vista_actual`) persiste la vista y la
  restaura solo en refresh de sesión ya activa (nunca en login nuevo,
  que sigue forzando "Inicio"). Validado en navegador real (Claude in
  Chrome): zoom a pixel confirmando mismo fondo en ambas barras, 4
  barras en orden correcto en tarjeta normal y modal expandido, refresh
  en "Resumen financiero" mantuvo la vista con datos, login nuevo
  aterrizó en Inicio con datos reales, sin errores de consola. **2
  ajustes finales tras revisar captura de pantalla**: orden final
  Ventas/Gastos/Facturado/Sin facturar (Gastos movido junto a Ventas), y
  fix de alineación vertical entre "Utilidad neta" y "Ventas vs
  Facturado vs Gastos" (`.resumen-fin-chart-card` a flex column +
  `#resumen-fin-chart-contenido { margin-top: auto }`, id único, no
  toca la tarjeta vecina) — ambas tarjetas comparten línea base tras
  validar con zoom a pixel. Sin commit/push — working tree para
  revisión del usuario.
- **Rediseño de "Ventas" — APROBADO POR EL USUARIO, PENDIENTE DE
  IMPLEMENTAR (ver PROJECT_STATE.md punto 126, 2026-08-21)**: NADA
  implementado todavía — es la especificación completa ya aprobada
  (protocolo `addv-web-app` completo, con 2 rondas de crítica del
  propio usuario a su idea y ajustes ya resueltos), documentada para
  que cualquier sesión futura la implemente sin rederivar el diseño.
  Resumen: (1) formulario "Registrar venta" pasa de sticky-lateral a
  botón + modal (reusa `.ticket-modal`, 820px, mismo patrón que
  "Gestionar" de Tickets), tabla a ancho completo; (2) un solo modal
  para escritorio Y móvil — en móvil (<900px) se vuelve pantalla
  completa con wizard de 3 pasos (Cliente → Productos → Confirmar,
  reusa el patrón de 3 pasos ya validado en `csf.html`); (3) el modal
  NO se cierra solo al guardar — se limpia y se queda abierto (corrige
  a propósito la pérdida del flujo de "varias ventas seguidas" que un
  modal ingenuo rompería); (4) confirmación de guardado INLINE dentro
  del modal (no toast, "muchas veces no se nota") — palomita animada en
  cyan de marca `#05DBF2` (mismo cyan del ítem activo del sidebar,
  reutilizado) con trazo SVG + "Guardado con éxito", ~1.3s total,
  respeta `prefers-reduced-motion`; (5) filtros nuevos (concepto,
  rango de fechas, rango de total) 100% client-side, sin backend —
  `GET /api/admin/ordenes-compra` ya trae todo sin paginar, mismo
  patrón que el buscador de Constancias. Cero funcionalidad perdida
  (checklist completo en PROJECT_STATE.md). 4 ideas opcionales
  ofrecidas y SIN decidir (productos frecuentes, buscador de cliente
  por nombre/RFC, compartir por WhatsApp, borrador local) — preguntar
  antes de tocar cualquiera si se retoma. **Parte web IMPLEMENTADA Y
  VALIDADA (2026-08-22)**: formulario movido de sticky a modal
  (`#orden-registrar-modal-overlay`, reusa `.ticket-modal`), botón
  "+ Registrar venta", tabla a ancho completo con filtros nuevos
  (`.ordenes-filtros`, 100% client-side, `ordenesCache` +
  `aplicarFiltrosOrdenes()`, sin cambios de backend), palomita animada
  cyan `#05DBF2` en vez de toast (`mostrarExitoRegistrarOrden()`, modal
  se queda abierto y se limpia solo tras guardar). Jest 560/560,
  validado en navegador real (2 ventas de prueba registradas de punta a
  punta, filtros confirmados con datos reales, toast confirmado
  ausente). **Falta el wizard móvil de 3 pasos (punto 2)** — sin
  commit/push todavía, se hace junto con la parte móvil. Ver el punto
  126 completo para el detalle línea por línea antes de continuar.
- **Menú de navegación móvil del panel admin rediseñado — IMPLEMENTADO
  Y VALIDADO (ver PROJECT_STATE.md punto 127, 2026-08-22)**: la fila
  horizontal con scroll lateral (`.admin-sidebar-nav` forzada en móvil)
  no funcionaba bien (tap targets bajo 44px) — usuario pidió una
  grilla simétrica de botones cuadrados con íconos en el home, solo
  móvil. Crítica aplicada antes de implementar: "Inicio" como botón de
  regreso no sirve porque `administrador` no tiene esa vista — se usó
  en su lugar un botón neutral **"Menú"** en la barra superior que
  siempre reabre la grilla completa (independiente del perfil),
  aprobado con "si por favor". Botón `#btn-menu-movil` + grilla
  `#admin-menu-movil` (9 tarjetas `.admin-menu-movil-btn`, mismas
  vistas/íconos del sidebar de escritorio, ocultas/mostradas en espejo
  exacto de `RESTRICCIONES_PERFIL` vía `aplicarRestriccionesPerfil()`).
  `.admin-sidebar-nav` pasa a `display:none` en móvil, reemplazada por
  completo. Jest 560/560, `node --check` limpio, llaves CSS 643/643.
  **Validado en navegador real** con un viewport móvil genuino de
  390×844 simulado vía `<style>` temporal inyectado (el iframe se
  descartó porque `frame-ancestors`/`X-Frame-Options` del punto 116 lo
  bloqueó — confirma que ese endurecimiento funciona): grilla 2
  columnas correcta con los 9 íconos, navegación a "Ventas" oculta la
  grilla, botón "Menú" la reabre desde cualquier vista, cero errores de
  consola. Sin commit/push todavía.
- **Fix de overflow/desalineación en móvil — Resumen financiero,
  Inicio, Gastos (ver PROJECT_STATE.md punto 128, 2026-08-22)**:
  usuario reportó KPIs con texto recortado (2 columnas entre 480-900px
  con números largos) en Resumen financiero/Inicio/Gastos, y filtros
  de Gastos desalineados en móvil (único filtro que aún usaba
  `flex-wrap` con `min-width` en vez del patrón grid ya establecido en
  Ventas/Reportes). Propuesta antes/después aprobada. Fix: KPIs
  (`.inicio-stats-grid`, `.resumen-fin-tablero`) a 1 columna directo
  debajo de 900px (sin nivel intermedio de 2); `.gastos-filtros` con
  `@media (max-width: 900px)` nuevo que apila los 7 campos a 100% de
  ancho. Cero cambios en escritorio. Jest 560/560, validado en
  navegador real. **Gotcha de metodología de prueba documentado en el
  punto 128**: angostar solo `body { max-width }` no dispara los
  `@media` reales (`window.innerWidth` no cambia) — hay que replicar
  las reglas del breakpoint manualmente en el arnés de prueba. Sin
  commit/push todavía.
- **Simplificación del formulario de Ventas + wizard móvil de 3 pasos
  — COMPLETA (ver PROJECT_STATE.md punto 129, 2026-08-22)**: cierra el
  punto 2 pendiente del punto 126 (wizard Cliente→Productos→Confirmar,
  reusa `.steps` de `csf.html`, cero componente nuevo) y de paso oculta
  3 campos que no aportan visualmente (Fecha de venta, IVA, "Cantidad
  MXN" agregada — NO la de piezas por producto, esa sigue editable) a
  pedido del usuario, aplicado a escritorio Y móvil (un solo
  formulario). Los 3 campos ocultos se quedan en el DOM (siguen
  recibiendo su valor por JS, cero cambio de comportamiento) —
  sustituidos por un mini-resumen chico "Subtotal $X · IVA $Y" arriba
  del Total (reusa `.field-hint`, sin CSS nuevo). DOM sin reordenar
  (escritorio se ve igual que siempre); en móvil cada paso ocupa el
  mismo lugar vía `display:none`/`.is-active`. Botón "Registrar venta"
  vive fuera del wizard (se muestra/oculta por JS con
  `matchMedia('900px')`, nunca se mueve de sitio en el DOM). Validación
  por paso: "Siguiente" exige correo (paso 1) o ≥1 producto (paso 2).
  Modal a pantalla completa en móvil (`.orden-registrar-modal`, no
  toca otros usos de `.ticket-modal`). Jest 560/560. **Validado en
  navegador real de punta a punta en ambos tamaños, con guardado real
  contra la API en cada uno** (escritorio: $200+$32 IVA=$232; móvil:
  $450+$72 IVA=$522, ambos confirmados por `GET /ordenes-compra`).
  Bloqueo de "Siguiente" sin correo/sin productos confirmado, "Atrás"
  conserva datos. Cero errores de consola. Con esto el segmento
  "Rediseño de Ventas" del punto 126 queda 100% completo. Sin
  commit/push todavía.
- **Correo opcional + método de entrega (correo/imprimir) + ticket de
  impresión en Ventas (ver PROJECT_STATE.md punto 130, 2026-08-22,
  IMPLEMENTADO Y VALIDADO en escritorio Y móvil)**: usuario pidió mover
  el correo al final del wizard, agregar "¿por correo o se imprime?", y
  un ticket de impresión SIEMPRE disponible junto a Reenviar/Eliminar.
  De paso ocultó también "Concepto de venta" (repetía la tabla de
  productos, mismo criterio que Fecha/IVA/Cantidad del punto 129).
  **Único cambio de esquema**: `ordenes_compra.email` de `NOT NULL` a
  `NULL`. Backend: `POST /ordenes-compra` acepta correo vacío (salta
  validación/constancia/envío); `POST /:id/reenviar-correo` ahora
  guarda un correo nuevo cuando la venta no tenía uno y devuelve
  `tiene_constancia`. Wizard reordenado a Productos→Confirmar→Entrega
  (correo hasta el final, junto al toggle "Enviar por correo"/
  "Imprimir ticket" — elegir imprimir oculta Tipo de cliente+Correo
  por completo). Ticket de impresión (`imprimirTicketOrden()`) reusa el
  parser ya existente de productos (cero dato nuevo del backend) e
  imprime la MISMA página vía `@media print` en vez de ventana nueva —
  decisión explícita: `window.open()+print()` se bloquea seguido tras
  un fetch async, sobre todo en móvil. Disponible desde 3 entradas:
  automático al guardar (si "imprimir"), ícono en la fila, botón en el
  modal "Ver venta". Modal nuevo "Asignar correo" para reenviar sobre
  ventas sin correo. Pruebas nuevas: `ordenes-compra.test.js` (no había
  cobertura antes), 7 casos. Jest backend 567/567. Validado contra
  Docker/MySQL reales (migración confirmada, ciclo completo por curl) y
  en navegador real ambos tamaños, con `window.print` interceptado
  durante la prueba para confirmar que se dispara en el momento
  correcto con el ticket ya armado, sin bloquear la automatización. Sin
  commit/push todavía.
- **Fix de la lista de productos capturados en Ventas, solo móvil (ver
  PROJECT_STATE.md punto 131, 2026-08-22)**: usuario reportó "sale
  desacomodado" debajo de "+ Agregar producto" en móvil (escritorio
  bien). Causa: la tabla ya tenía `.admin-table` así que se apilaba
  sola por debajo de 760px, pero sus `<td>` nunca tuvieron
  `data-label` — se apilaba SIN etiquetas (5 valores sueltos, no se
  sabía cuál era cuál). Fix, solo móvil: tarjeta compacta de 2 líneas
  (`.orden-productos-lista-movil`) que reusa tal cual el texto que ya
  arma `textoProductoOrden()` — cero formato nuevo. Escritorio no
  cambió (misma tabla de siempre). **Gotcha de metodología**: el primer
  intento de reproducir el bug dio un falso resultado porque el arnés
  de prueba solo mirroreaba el breakpoint de 900px — la tabla usa 760px,
  un breakpoint distinto que no estaba replicado (mismo patrón de
  gotcha del punto 128, con otro breakpoint). Jest 567/567 (sin cambios
  de backend), validado en navegador real (nombre largo, botón quitar,
  escritorio sin cambios). Sin commit/push todavía.
- **Modo fuera de línea para Ventas y Gastos — IMPLEMENTADO Y VALIDADO
  (ver PROJECT_STATE.md punto 132 y US.md US-073/074/075,
  2026-08-22/23)**: usuario pidió primero instalabilidad PWA (analizada,
  CANCELADA antes de tocar código) y luego modo offline con sync al
  reconectar + "máxima seguridad/cifrado" + franja de estado. Petición
  original inviable tal cual (folios `AUTO_INCREMENT`, validación
  fiscal en vivo, login que requiere BD, riesgo de pérdida silenciosa
  subiendo archivos offline, "cifrado en el navegador" que no protege
  nada si la llave vive ahí mismo — de paso, documentado que el panel
  admin YA guarda usuario:contraseña en `sessionStorage` en base64, no
  cifrado, preexistente). 3 rondas de crítica/refinamiento hasta un
  alcance realista: **solo Ventas y Gastos**, sin archivos, sin login
  offline, folio asignado al sincronizar (orden real de llegada),
  correo sin cola nueva (ya vive en el guardado real existente), Ventas
  difiere la validación de constancia al sync.
  - **`frontend/offline.js`** (nuevo, genérico): IndexedDB
    (`pendientes_ordenes`/`pendientes_gastos`), detección de conexión
    real (no solo el evento `online` — se confirma con ping a
    `/api/health`, reintento cada 10s si sigue "offline"), API pequeña
    que `admin.js` conecta con manejadores concretos por tipo. Agregado
    al `COPY` de `frontend/Dockerfile` (mismo gotcha del punto 106).
  - **Franja de estado** (`#conexion-banner`): roja "Sin conexión a
    internet" / verde "Sincronizando datos…", fade-out al terminar,
    z-index por encima de los modales.
  - **Ventas**: `btnRegistrarOrden` encola en vez de `fetch` si
    offline; "Imprimir ticket" se deshabilita solo al quedarse sin
    conexión (con bloqueo defensivo extra en el handler). Filas
    pendientes (badge ámbar/rojo, total estimado, botones
    Reintentar/Descartar) se mezclan arriba de la lista real sin
    esperar al servidor.
  - **Gastos**: mismo patrón, solo intercepta CREAR (nunca editar);
    comprobante seleccionado se avisa que hay que adjuntarlo después
    (mismo mensaje que ya existía para cuando la subida fallaba).
  - **Sync**: por tipo, en orden de creación, un fallo no detiene a
    los demás (se marca con el error real del backend y sigue).
    Logout con cola pendiente pide confirmación antes de limpiarla.
  - **Verificación**: `node --check` limpio, CSS balanceado
    (689/689), Jest backend **567/567** (100% frontend, sin cambios de
    backend). Validado en navegador real de punta a punta —
    online sin regresión, offline (banner, imprimir deshabilitado,
    venta+gasto encolados con total/monto correcto), reconexión (sync
    automático, folio/id real confirmado contra la API), camino de
    falla (error real mostrado, Reintentar/Descartar funcionando), y
    mismo recorrido en móvil (390×844). **Bug chico encontrado y
    corregido**: botones Reintentar/Descartar se envolvían en 2 líneas
    — `white-space: nowrap`. Limitación aceptada a propósito: la
    lista de lectura offline es solo caché en memoria de la pestaña
    (no sobrevive un reload sin haber cargado antes esa vista) — la
    cola de pendientes por crear sí sobrevive un reload (IndexedDB).
    Sin commit/push todavía.
- **Auditoría + correcciones de Cuentas por cobrar, punto 138 (ver
  PROJECT_STATE.md, 2026-08-24, a pedido explícito del usuario)**:
  revisión del código que la otra herramienta ya había escrito para
  este punto (pese a que su propia documentación decía "cero código
  tocado"). Bug de datos real y grave confirmado contra la BD real:
  la migración de `monto_cobrado` nunca hizo backfill — **207 de 212
  ventas históricas** quedaron "pagada" con `monto_cobrado=$0`.
  Corregido con un `UPDATE` idempotente en `db.js` (self-limiting,
  fuera del bloque "columna nueva" para que sí corriera contra la BD
  ya migrada). Agregados 11 tests Jest nuevos al endpoint `/cobro` y
  a la validación de `estado_pago` (antes: cero cobertura, solo un
  Playwright feliz-camino que no tocaba datos históricos). Agregada
  validación de fecha de vencimiento futura (backend la aceptaba en
  el pasado). Limpiado código muerto en `admin.js`. Agregado filtro
  "Estado de pago" en Ventas (el badge inline ya existía). Jest
  **595/595 (36 suites)**, validado contra Docker/MySQL reales —
  backfill confirmado por SQL directo (212/212 correctas), filtro y
  vista CxC probados en navegador real sin errores de consola. Las 4
  preguntas de diseño de la propuesta original siguen sin respuesta
  explícita del usuario.
- **Sidebar fijo + cifras sin encimarse en Resumen financiero (ver
  PROJECT_STATE.md punto 140, 2026-08-24, IMPLEMENTADO Y VALIDADO)**:
  `.admin-sidebar` pasó de flex-child (se estiraba al alto de
  `.admin-content`, se perdía en vistas largas junto con "Cerrar
  sesión") a `position:fixed; height:100vh` en escritorio (sticky solo
  en móvil <900px). `calcularEtiquetasLejos()` nueva en `admin.js`
  reemplaza el alternar por paridad de índice (solo servía en zigzag)
  por comparación real de ancho de texto vs. espacio entre puntos —
  arregla el encimado en rachas de meses consecutivos subiendo/bajando
  juntos. **Incidente de coordinación documentado**: otra herramienta
  (claude-flow/ruflo) corriendo en paralelo sobre el mismo working tree
  desplegó `admin.js` a medio editar de este lado, causando
  `TypeError` al abrir Resumen financiero y dejando en blanco todo lo
  que renderea después en la cadena — mal etiquetado como "No se pudo
  conectar con el servidor" (era JS roto, no red). Ver punto 140 para
  la auditoría completa de lo que esa herramienta cambió (Swagger +
  credenciales API por tenant ya en `main`; 2 hallazgos de seguridad
  YA CORREGIDOS — #1: `?api_key=` por URL ya no se acepta, solo
  header/cookie (`backend/utils/auth.js`); #2: CSP de `/api/docs`/
  `/api/control/docs` sin `unsafe-inline`/`unsafe-eval` en script-src
  (sus `<script>` son todos `src=` externos del mismo origen, nunca
  inline; el único `new Function()` del bundle es un fallback de
  `globalThis` inalcanzable en navegadores modernos) — style-src
  conserva `unsafe-inline` a propósito (bloques `<style>` literales del
  HTML, riesgo bajo) — **confirmado visualmente por el usuario**
  ("se ve bien"). Cuentas por cobrar sin commitear pese a su
  propia nota de "no implementar sin
  confirmación"). **Rediseño final el mismo
  día**: `calcularEtiquetasLejos()` (colisión por ancho de texto) se
  abandonó por completo — el primer/último punto usan `text-anchor`
  distinto a los del medio, así que ni ese cálculo los medía bien
  (captura real del usuario: "$264.6k" cortado a "$26"). Reemplazada
  por **etiquetado selectivo** (`calcularIndicesClave()`): solo
  primero/último(+último real si hay proyección)/máximo/mínimo llevan
  cifra en el trazo — nunca más de 4-5 por tarjeta sin importar cuántos
  meses traiga la serie; el resto son puntos discretos
  (`.resumen-fin-linea-punto-fantasma`) con su valor disponible por
  `title` nativo al pasar el mouse. Propuesta visual (Artifact
  antes/después reproduciendo el bug real) aprobada antes de
  implementar. Elimina la clase de bug entera en vez de parchar el
  caso puntual. Validado en navegador real, tarjeta normal y modal
  expandido.
- **Categorías de gastos editables desde el popup de "Registrar gasto"
  (ver PROJECT_STATE.md punto 135, 2026-08-23, COMPLETA e IMPLEMENTADA Y
  VALIDADA)**: la lista cerrada de categorías (CHECK de MySQL +
  diccionario duplicado en `admin.js`) pasó a tabla editable
  `categorias_gastos` (slug estable, etiqueta, `activa`, `protegida`,
  `orden`); renombrar y agregar confirmados por el usuario ("Ambas"), y
  categoría nueva sin color propio usa el gris de "Otro" en la dona de
  Resumen financiero (fallback ya existente, sin cambios ahí). Backend:
  `backend/utils/gastos.js` reescrito (CRUD + `generarSlugCategoria()` +
  `reactivarCategoriaGasto()`, agregada tras preguntar al usuario porque
  desactivar sin poder reactivar era una puerta de un solo sentido) + 5
  endpoints en `server.js`. Panel "✏️ Categorías" inline en el modal de
  Registrar gasto (renombrar en línea, borrar solo si 0 gastos, "Otro"
  protegida, reactivar si inactiva, "+ Agregar"). **2 bugs reales
  encontrados y corregidos en la validación contra Docker/navegador
  reales, ninguno detectable con `node --check`/Jest mockeado**: (1)
  dependencia circular `db.js`↔`utils/gastos.js` dejaba `pool`
  `undefined` en gastos.js (500 en los 5 endpoints nuevos) — fix:
  `require('../db')` perezoso dentro de cada función
  (`obtenerPool()`); (2) `#confirm-modal-overlay` compartía
  `z-index:50` con el resto de `.modal-overlay` — al confirmar desde
  DENTRO de otro modal ya abierto (Eliminar categoría desde Registrar
  gasto; mismo riesgo preexistente con "Quitar comprobante" desde el
  detalle de un gasto) el diálogo quedaba invisible detrás del modal
  padre — fix: `#confirm-modal-overlay { z-index: 70; }` en `style.css`.
  Jest backend **584/584 (36 suites)**, validado de punta a punta contra
  Docker/MySQL reales por `curl` y en navegador real (Claude in Chrome:
  crear/renombrar/eliminar/reactivar categoría, registrar un gasto con
  categoría nueva, limpieza completa verificada por SQL de vuelta al
  estado base). Sin commit/push todavía.
- **Datos de prueba históricos para reportes + serie mensual de ~6 meses
  en Resumen financiero (ver PROJECT_STATE.md punto 134, 2026-08-23,
  VALIDADO CONTRA DOCKER REAL)**: usuario pidió histórico para
  validar las tarjetas (balance acumulado/proyección). Dos causas de raíz
  encontradas: retención a 5 días que purgaba todo lo viejo (subida a
  **365** por decisión del usuario) y la gráfica del Resumen recortada al
  mes en curso por diseño (`server.js`: nueva `inicioSerie` = mes actual
  −5, solo para las queries de la serie; KPIs intactos). Siembra vía
  script nuevo `backend/scripts/sembrar-datos-prueba.js` (determinista,
  transaccional, anti-doble-siembra): **175 ventas** (ids 94..268) +
  **85 tickets 'listo' vinculados** (ids 82..166, imagen placeholder sin
  MinIO) + **86 gastos marcados** (nota `'Dato de prueba (validacion de
  reportes)'`), ventana mar–jul completos + ago 1–22; KPIs/tendencias/
  distribución/listas YA reflejan los datos contra la API viva. Cuando la
  sesión paralela terminó "Categorías editables" (suite 584/584), se
  corrió el rebuild único y quedó verificado por HTTP: serie de 6 llaves
  mar–ago + proyección activa (Sep ≈ 342,850 / Oct ≈ 376,521). SQL de
  limpieza impreso por el script.     Sin commit/push todavía.
- **Pendiente registrado (ver PROJECT_STATE.md punto 137)**: Swagger para
  los servicios API + credenciales de acceso por empresa dadas de alta en
  `/control` — cada tenant accede solo a sus APIs; el SUPER admin con un
  par de credenciales global. Solo anotado: requiere análisis y
  confirmación antes de implementarse.

- **Maduración del requerimiento de Inventarios (`inventarios.md`) — EN
  CURSO, solo análisis/documentación (ver PROJECT_STATE.md punto 136,
  2026-08-23)**: agregada Sección 0 "Alcance v1 y decisiones cerradas"
  (prevalece sobre el resto del doc). Decisiones con el usuario: D1 sin
  variantes en v1; D2 multi-almacén preparado (almacen_id NOT NULL +
  "ALM-1" auto) pero UI con uno; D3 sin ubicaciones; D4 negativos
  prohibidos; D5 costeo promedio ponderado; D6 existencias derivadas del
  libro de movimientos; D7 solo perfiles existentes en v1. **D8
  CERRADA**: Ventas integra vía `producto_id` nullable +
  interruptor GLOBAL `ventas_afectan_inventario` (igual para todos los
  tenants — primera config global de plataforma, candidato BD de
  control); switch activo = autocompletado/código de barras en venta +
  salida automática validando stock; inactivo = Inventarios oculto y
  Ventas como hoy. **D9**: importador masivo CSV/XLSX entra en v1
  (§34 reescrito: wizard 6 pasos, mapeo por sinónimos, campo `extra`
  JSON para columnas no mapeadas, upsert por SKU, existencias iniciales
  → entradas 'inventario inicial', chunks async, MinIO + auditoría).
  §0.5 agregada: concurrencia (FOR UPDATE anti-sobrevende, atomicidad
  movimiento+saldo), DECIMAL(12,3)/(12,2), libro append-only,
  conciliación saldos↔kardex, errores INV_*. §0.6 agregada: config
  GLOBAL de plataforma (`configuracion_global` en BD de control,
  `ventas_afectan_inventario` default '0', switch solo para perfil
  plataforma en Configuraciones globales, caché TTL ≤60 s) — patrón
  base del punto 137.
  NADA implementado todavía.

- **Rediseño del ticket de correo de Ventas con la marca CLARVO (ver
  PROJECT_STATE.md punto 133, 2026-08-23, IMPLEMENTADO Y VALIDADO)**:
  usuario pidió recolorear `construirCorreoOrdenCompra`
  (`backend/server.js`) con colores de marca + logo real — propuesta
  visual (Artifact con antes/después renderizado) aprobada primero,
  regla persistente del usuario. Logo: sin logo de tenant configurado
  y marca por defecto → logo real de CLARVO (`/assets/branding.png`,
  mismo archivo del login) en vez de caja de texto verde; un tenant
  con su propio nombre sigue viendo SU texto, nunca el logo de CLARVO.
  Paleta: verde `#0F6E5D`/beige `#F0EFEA` → navy `#03285B` + cian
  `#05DBF2`, los MISMOS tokens ya usados en login/panel (no valores
  nuevos); franja degradada navy→azul→cian arriba de la tarjeta (mismo
  degradado del isotipo real de CLARVO); fondo suave navy detrás del
  TOTAL. Pie de página dice "CLARVO by ADDV" cuando la marca es la de
  por defecto (`MARCA_DEFECTO` en sí no cambió). Sin cambios de
  estructura HTML ni de texto plano. Jest backend 567/567. Validado
  con la salida REAL de la función (extraída a un script aislado,
  renderizada, publicada como Artifact para inspección visual — logo
  roto solo en el Artifact por no alcanzar `localhost` desde ese
  sandbox, confirmado con `curl` que la ruta real sí responde 200) y
  con un **envío SMTP real** (este entorno ya tiene SMTP configurado
  de verdad — venta de prueba registrada, correo enviado sin errores
  en los logs). **CORRECCIÓN el mismo día**: el logo SÍ llegó roto en
  el correo real (usuario reportó "sale rota la imagen") — la
  suposición de que la URL absoluta cargaría en producción era
  correcta en teoría pero irrelevante en la práctica: TODAS las
  pruebas de esta sesión pegaron con `Host: localhost:8088`
  (`detectarUrlPortal()` arma la URL del logo desde ese header), y
  "localhost" no lo puede resolver nadie fuera de esta máquina — ni
  Gmail ni el destinatario. Mismo punto ciego que ya tenía el logo de
  un TENANT (mecanismo de URL absoluta compartido), nunca antes
  probado contra un correo real. **Fix, con el usuario eligiendo
  explícitamente "incrustado" sobre "solo URL"**: el logo de CLARVO
  por defecto ahora viaja DENTRO del correo como adjunto CID
  (`logoTicketHtml()` regresa `{html, adjunto}`,
  `construirCorreoOrdenCompra()` regresa `adjuntos: []`,
  `enviarCorreoOrdenCompra()` los pasa a `enviarCorreo()` — que ya
  soportaba adjuntos, sin cambios ahí). Copia nueva del PNG en
  `backend/assets/branding.png` (el backend no comparte filesystem con
  el contenedor frontend), cacheada en memoria, con fallback al texto
  si no se puede leer. El logo de un TENANT no se tocó. Verificado
  dentro del contenedor real: PNG copiado correctamente (433174 bytes,
  firma válida), MIME real renderizado con
  `nodemailer.createTransport({streamTransport:true})` confirma
  `Content-ID`/`Content-Type: image/png` correctos. **Confirmado por
  el usuario contra un correo real** ("ya llegó bien"). Sin
  commit/push todavía.
- **"Lectura de reportes" rediseñada para auditorías (ver
   PROJECT_STATE.md punto 122, 2026-08-21, IMPLEMENTADO Y VALIDADO)**:
   `reporte_items.accion` ya distinguía "eliminado" (borrado real) de
   `NULL` (fotografía activa) pero se mostraba mezclado — ahora 2 tablas
   separadas ("Movimientos"/"Eliminados", acento rojo), export CSV/Excel
   independiente por tabla (`accion=activo|eliminado` en
   `/exportar`/`/items`), cabecera "Detalle" con badges de color
   reutilizados de Tickets/Ventas, KPIs de auditoría arriba (histórico +
   tendencia mensual, endpoint nuevo `GET /api/admin/reportes/estadisticas`),
   y refuerzo frontend de que "Eliminar reporte" es solo admin/super
   (backend ya lo exigía). Sin cambios de esquema. Jest 560/560, validado
   en navegador real con datos reales de la siembra. **Ajuste de diseño
   en vivo** tras revisar la captura: las 3 tarjetas KPI son cuadradas
   fijas de 230×230px (no estiradas), centradas, con texto+número +40%
   en las 2 numéricas — mismo gotcha de especificidad CSS que el punto
   121 (`.resumen-fin-chart-body` ya fija `min-height:220px`; hubo que
   usar id, no clase, para ganar). Título de las 3 tarjetas fijo arriba
   a la izquierda, resto (número/nota/barra) centrado en el espacio
   sobrante vía `margin-top/bottom:auto`. Commit `f7b26d4`, push a
   `fact`. **Regla nueva del usuario, guardada en memoria persistente**:
   todo cambio de diseño visual (nuevo o ajuste) siempre lleva propuesta
   antes/después en markdown antes de implementar, sin que se pida cada
   vez. Después del push: "Configuraciones globales" movido al final del
   sidebar (ancla fija, comentario en el HTML para vistas nuevas), y
   número centrado (no todo el contenido) en los KPIs de "Inicio" y
   "Resumen financiero", mismo criterio que Reportes. Commit `fa0906e`,
   push a `fact`. **B+C+D del punto 122 implementadas y validadas**: B —
   pestaña "Todo lo eliminado" (ledger cruzado de todos los reportes,
   endpoints `/reportes/eliminados` y `/reportes/eliminados-exportar`,
   columna "Reporte de origen"); C — "Generado por" en el resumen del
   reporte, cruzando `admin_auditoria` (segmento 7) por ruta+ventana de
   5s (`/reportes/:id/generado-por`), mejor esfuerzo, nunca bloquea; D —
   botón "Ver historial" por identificador, modal con su timeline en
   todos los reportes (`/reportes/timeline/:tipo/:identificador`). 2 bugs
   reales encontrados y corregidos en el camino: `map(renderFilaReporteItem)`
   pasaba el índice del array como segundo argumento (columna de más en
   Movimientos), y el timeline desbordaba con descripciones largas
   (faltaba `flex:1;min-width:0`). Sin cambios de esquema. Jest 560/560.
   Sin commit/push todavía este segmento (B+C+D).
- **PENDIENTE — Cuentas por cobrar (ver PROJECT_STATE.md punto 138, 2026-08-24, PROPUESTA NO IMPLEMENTADA)**: a pedido del usuario, venta por defecto "pagada" + opción "pendiente de pago" gestionada en nueva vista "Cuentas por cobrar" (inexistente hoy). Propuesta UX/UI documentada y en espera de confirmación explícita — **cero código tocado**. Modal "Registrar venta": radio Pagada (default verde) / Pendiente de pago (ámbar) que al elegir Pendiente revela Vencimiento + Notas de cobro; nueva vista entre Ventas y Gastos con 4 KPIs (Por cobrar/Vencidas/Por vencer/Cobrado mes), tabla con badges ⏳/🔴/✅ y acciones Ver venta / Registrar cobro (abonos parciales, `monto <= saldo`) / Recordatorio, filtros client-side. Modelo propuesto: `ordenes_compra.estado_pago ENUM('pagada','pendiente') DEFAULT 'pagada'` + `fecha_vencimiento/monto_cobrado/fecha_cobro/notas_cobro`, saldo derivado. API propuesta `PUT /:id/cobro`. Pendiente confirmar: posición del toggle en wizard, vencimiento obligatorio, abonos parciales en v1.
- **Auditoría de consistencia de documentación (ver PROJECT_STATE.md
  punto 120, 2026-08-21)**: a pedido explícito del usuario ("revisa la
  documentación"), revisión de salud de los 3 entregables obligatorios
  del protocolo, sin implementar corrección todavía (solo diagnóstico).
  Hallazgos: título/línea 1 del README sigue sin mencionar multi-tenant
  aunque el contenido interno sí lo cubre; README no documenta 3
  features ya hechas (tarjeta "Utilidad neta del mes" punto 118,
  gráficas BI punto 117, "Look & Feel" punto 105); `FRONTEND_PORT`
  documentado con 3 valores distintos entre README/`.env` real (`80`
  en la tabla, `8080` en ejemplos, `8088` real desde el punto 109); la
  sección "Pendiente antes de producción" de `PROJECT_STATE.md` (líneas
  6877-6944) contradice puntos posteriores del mismo archivo (dice
  "marca no implementada" cuando el punto 103 ya la hizo, dice "falta
  probar /control en navegador" cuando el punto 100 ya lo hizo).
  Confirmado vigente y sin resolver: `nodemailer` vulnerable (punto
  116), Swarm multi-nodo real nunca probado (95/97), `/control` en dos
  servidores físicos nunca probado (99), red Docker sin segmentar
  (116). Ningún comando/script de este archivo está roto — todos
  verificados. No avanzar con la corrección sin aprobación explícita
  del usuario, mismo protocolo `addv-web-app`.
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
