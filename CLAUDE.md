# CLAUDE.md — Portal de Facturación ADDV (Clarvo)

Contexto operativo persistente para cualquier sesión de Claude que trabaje
en este repo. Este archivo es el **master prompt** — reglas, protocolo,
stack, convenciones y estado arquitectónico de alto nivel. NO es el
historial de features: para eso existen `PROJECT_STATE.md` (fuente de
verdad punto por punto, ~325+ entradas), `cmem.md` (respaldo manual estilo
claude-mem de esta misma conversación) y Claude Mem
(`mcp__plugin_claude-mem_mcp-search__*`, observaciones automáticas
cross-sesión). Para instrucciones de instalación/operación, ver
`README.md`.

**Si necesitas el detalle de una feature/bug pasado**: busca primero en
`PROJECT_STATE.md` por número de punto o palabra clave; si no aparece o
falta contexto de decisión, consulta Claude Mem (`mem-search` o
`get_observations`) y `cmem.md`. Este archivo solo debe crecer con reglas
**nuevas y persistentes** (convenciones, gotchas, decisiones de
arquitectura), nunca con narrativa de "qué se hizo hoy" — esa va a
`PROJECT_STATE.md`.

## Protocolo de trabajo

Este proyecto opera bajo el protocolo `addv-web-app` (skill de Claude Code,
`~/.claude/skills/addv-web-app/SKILL.md`, global — actualizada 2026-08-31
desde su repo propio `github.com/antonioprado-sketch/addv-web-app`): sitio
corporativo/reputacional, flujo obligatorio de **8 pasos** — Analizar →
Revisar impacto → Criticar y mejorar el requerimiento → Propuesta visual
(antes/después) → Confirmar → Implementar → Probar (unitarias **y**
funcionales) → Asegurar (nada sensible en el frontend, todo cifrado en
tránsito/reposo) — no asumir requisitos ambiguos, no implementar sin
aprobación explícita del segmento, piso no negociable de UX/accesibilidad/
rendimiento/seguridad/Docker/pruebas/calidad de código. Mantener siempre
actualizados `PROJECT_STATE.md`, este archivo, `README.md` y
`pendientes.html`.

**Herramientas de eficiencia instaladas para este protocolo** (ver la
skill `addv-web-app`, sección "Herramientas complementarias"):
`agent-skills` (24 skills de vercel-labs/addyosmani, symlinkeadas en
`.agents/skills/` — gitignored, estado de entorno local, no código del
sitio) y `prompt-master` (`~/.claude/skills/prompt-master`, solo se activa
si se pide explícitamente redactar/mejorar un prompt).

## Reglas persistentes de coordinación

- Después de cualquier cambio relevante de código, arquitectura,
  operación, pruebas, decisiones de producto o estado del proyecto:
  actualizar siempre `PROJECT_STATE.md`, `CLAUDE.md`, `pendientes.html` y
  `AGENTS.md` antes de cerrar el trabajo. Si la sesión tiene acceso de
  escritura a Claude Mem, registrar también ahí la decisión/estado para
  que futuras sesiones de Claude y Codex se coordinen sin depender del
  historial del chat; si solo hay acceso de lectura, dejar constancia
  explícita en estos archivos (Claude Mem, confirmado 2026-08-12, solo
  expone lectura/consulta vía MCP — el registro automático pasa por el
  hook de cierre de sesión, no por llamada manual).
- `pendientes.html` tiene columna `Hecho` + pestaña `Histórico` con
  `localStorage` (`portalClarvo_pendientes_checks_v1`). Al marcar,
  desaparece del listado/buscador/filtros y pasa al histórico local.
  Cuando el usuario diga "revisa pendientes": leer ese `localStorage`
  (botón "Copiar estado") y, si hay cambios, consolidar a "Completado"
  permanente en el repo (pill verde en `pendientes.html` + `PROJECT_STATE.md`).
  No requiere confirmación por pendiente individual.
- Toda vista/feature nueva aplica a **tenant y sitio base por igual**,
  salvo que se indique explícitamente lo contrario.
- Todo cambio de diseño visual (nuevo o ajuste) lleva **propuesta
  antes/después** (markdown o Artifact) antes de implementar, sin que el
  usuario tenga que pedirlo cada vez.
- Esta regla se ejecuta junto con el protocolo `addv-web-app`: analizar
  primero, proponer un segmento acotado, esperar confirmación explícita
  del usuario, implementar solo el segmento aprobado, manteniendo el piso
  obligatorio de UX/accesibilidad/rendimiento/seguridad/Docker/pruebas/
  calidad.

## Gotchas operativos recurrentes (leer antes de tocar Docker/nginx/CSP/tests)

- **Rebuild que no se refleja**: `docker compose build <servicio>` a
  veces no recoge cambios de archivo — usar `--no-cache` seguido de
  `up -d --force-recreate <servicio>` cuando un cambio no aparece al
  probar.
- **Caché de navegador**: tras un rebuild de frontend, forzar
  `Ctrl+Shift+R` — el navegador sirve HTML/CSS viejo desde disco.
- **Modales anidados**: un modal de confirmación/escáner abierto DESDE
  otro modal ya abierto puede quedar invisible si comparten
  `z-index` — dar más z-index al hijo (patrón ya resuelto en
  `#confirm-modal-overlay`/`#scanner-modal-overlay`, ambos en 70).
- **Pruebas de responsive**: replicar el `@media` real y su breakpoint
  exacto en el arnés de prueba — angostar solo `body{max-width}` no
  cambia `window.innerWidth` y no dispara el `@media` real.
- **`setFieldError(id)`** ya antepone `"error-"` internamente — nunca
  volver a prefijarlo en el call site (bug repetido varias veces).
- **nginx intercepta 502/503/504 globalmente** (`error_page 502 503 504`
  → `mantenimiento.html`) — cualquier error real de la API debe responder
  **500**, nunca 502/503/504, o se disfraza de "sitio caído".
- **CSP y `blob:`/`data:`**: `default-src 'self'` NO cubre esos schemes
  para `img-src`/`frame-src` — declararlos explícitos
  (`img-src 'self' data: blob:`, `frame-src 'self' blob:`) si se usan
  imágenes/iframes con blob URLs.
- **`ensureSchema()` corre en cada restart/deploy** — cualquier backfill o
  valor forzado debe ser CONDICIONAL (solo si el dato está en un estado
  viejo conocido), nunca incondicional, o revierte en silencio datos
  legítimos ya guardados en producción.
- **Desincronización MySQL/`.env`**: MySQL solo aplica las credenciales
  de `.env` en la PRIMERA inicialización del volumen — editar `.env`
  después desincroniza contra el password real ya grabado. Runbook en
  memoria `project_mysql_credential_desync_prod.md`; preflight ya
  integrado en `prod/actualizar.sh`.
- **`db_host` mal grabado**: correr un script de aprovisionamiento con
  `DB_HOST=127.0.0.1` desde el host graba ese valor en
  `control_tenants.tenants.db_host` — el backend (dentro de Docker)
  necesita `mysql`, no `127.0.0.1` (bug recurrente, corregir con
  `UPDATE` + restart de `backend`).
- **Tooltip único**: todo el sitio usa un solo componente
  (`[data-tooltip]`/`.campo-ayuda`, `inicializarTooltips()`) — sin build
  step, se duplica manualmente por archivo (`admin.js`/`control.js`/
  `login.js`). Portar ahí, nunca reinventar un popover nuevo.
- **Botón de acción con ícono (fila de tabla)**: patrón único —
  `.btn-icono-accion`/`.btn-icono-accion-peligro` (30x30, SVG feather,
  `data-tooltip`+`aria-label`) + contenedor `admin-row-actions
  admin-row-actions-iconos` (la 2da clase es la que mantiene la fila
  horizontal en móvil, no apilada). `frontend/admin.js` ya trae un
  factory reutilizable, `botonAccionInv({tooltip, peligro, icono,
  onClick})`, con las constantes `ICONO_EDITAR`/`ICONO_PAPELERA`/
  `ICONO_RESTAURAR`/`ICONO_OJO`/etc. ya definidas — reusar eso antes de
  escribir un `<svg>` a mano o inventar un cuarto sistema de botones-ícono
  (`frontend/control.js` tiene el equivalente propio, `crearBotonAccion`,
  por ser build de Docker separado — no mezclar entre archivos). Nunca un
  botón de texto completo ("Gestionar"/"Editar"/"Eliminar") como acción de
  fila — ver PROJECT_STATE.md punto 336.
- **Cero emojis** en producción, correos y también en
  propuestas/mockups/Artifacts de diseño — sustituir por los SVG
  feather-like ya usados en el sitio o un `<span>` circular de color.
- **`backend/` y `control/` son builds de Docker separados** — nunca
  copiar código entre ellos en producción; código pequeño compartido se
  duplica a propósito (mismo patrón que el frontend sin bundler).
- **`prod/`** (espejo de deploy para `yt.addv.com.mx`) es manual y
  untracked — sincronizar por CONTENIDO tras cualquier sesión relevante,
  nunca `git add`.
- **Credenciales angostas cross-tenant** (`control_app`): sin
  `REFERENCES`/`DELETE` en tablas de otros tenants — usar soft-delete en
  vez de FK/DELETE físico en cualquier tabla cross-tenant.
- **Inputs numéricos**: asignar `.value =` a un `<input type="number">`
  sanea silenciosamente valores intermedios inválidos (efecto que NO
  ocurre con tecleo real) — validar con tecleo real (CDP/`computer`
  tool), nunca con asignación directa.
- Antes de dar por "no disponible" una skill/herramienta mencionada por
  el usuario: revisar el catálogo de skills activas, luego `D:\cc`,
  luego el repositorio oficial — nunca asumir su función.

## Stack

Node.js 20 + Express 4, MySQL 8 (`mysql2/promise`, SQL crudo, sin ORM),
Nginx sirviendo frontend estático (HTML/CSS/JS vanilla, sin build step),
todo sobre Docker/Docker Compose. Ver README para la lista completa de
dependencias. Prefijo de contenedores: `portalManager-*`.

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
  sesiones. Admin: HTTP Basic Auth de varios niveles (ver
  `backend/utils/auth.js`).
- Todas las páginas del frontend reutilizan `style.css` como base; los
  demás `.css` son extensiones, no reemplazos.
- **Tipografía unificada**: toda la app usa **una sola familia
  tipográfica — Inter** (`--font-body`/`--font-display` en `style.css`,
  `--font-display` alias de `--font-body`; `mantenimiento.html` replica el
  mismo par). No se mezcla serif/sans ni se introducen otras familias en
  ningún CSS/HTML nuevo — aplica a `/control` y al lado del cliente
  (portal, login, csf, tickets, dashboard) por igual. El sistema de temas
  por tenant (`backend/utils/tenantTema.js`, `control/utils/tenantTema.js`)
  queda congelado en esta default; si se reactiva, debe respetar esta
  regla.
- **Hover unificado**: mismo lenguaje en todo el sitio y apps —
  `background: var(--color-accent-soft)` + `border-color: var(--color-accent)`
  + `transition 0.15s ease` (ver `admin.css` bloque "Hover unificado" y
  `portal.css` `.tile:hover`). Respeta `prefers-reduced-motion: reduce`.
- **Cero emojis en todo el diseño** (directiva persistente, sin
  excepción y sin que haga falta pedirla de nuevo): ningún emoji real en
  HTML/CSS/JS de producción, correos, ni en propuestas/mockups/Artifacts
  de diseño. Todo indicador visual (estatus, acción, alerta) se construye
  con los SVG inline ya existentes en el sitio (estilo feather-like de
  `admin.js`/`admin.html`/`portal.js`) o, si es solo un punto de color,
  con un `<span>` `border-radius:50%` + `background` — nunca un carácter
  Unicode tipo "●"/"✓" ni un emoji real (incluye el rayo de "Verificar
  conexión ahora" en SMTP: SVG feather-like, nunca ⚡). Al homologar con un
  mockup que sí trae emojis/íconos de librería externa (Font Awesome, etc.), replicar
  la FORMA visual con los SVG propios del sitio, respetando el set de
  íconos ya en uso salvo que el usuario pida explícitamente cambiarlos.
- Después de cualquier cambio: `node --check` en los `.js` tocados +
  suite Jest existente sin regresiones + actualizar `PROJECT_STATE.md`.
- Antes de dar por "no disponible" una skill/herramienta mencionada por el
  usuario: revisar el catálogo de skills activas, luego `D:\cc`, luego el
  repositorio oficial — nunca asumir su función.

## Arquitectura en migración: multi-tenant

El proyecto migró de single-tenant a multi-tenant (>1000 usuarios,
múltiples empresas cliente, cada una con BD MySQL dedicada y URLs
`/<slug>` y `/<slug>/admin`). Plan completo de 9 segmentos, decisiones de
arquitectura ya aprobadas y su justificación: **`PROJECT_STATE.md`, punto
88** (arranque + segmento 1) **y punto 89** (segmento 2). El plan de 9
segmentos está **completo** — cualquier trabajo nuevo sobre esta
arquitectura es evolución posterior, no un segmento pendiente. Estado por
segmento:

- **Segmento 1** — BD de control + script de aprovisionamiento
  (`backend/scripts/provisionar-tenant.js` + `backend/utils/tenant.js`):
  hecho.
- **Segmento 2** — `backend/db.js` refactorizado a registro de pools por
  tenant + proxy `AsyncLocalStorage` + `ensureSchema(db)` parametrizado:
  hecho. `pool.query(...)` en código existente sigue funcionando sin
  cambios.
- **Segmento 3** — `backend/utils/tenantContext.js` (middleware que
  resuelve `req.tenant` desde `X-Tenant-Slug`; sesión de cliente con
  clave HMAC derivada por tenant vía HKDF en `authUsuario.js`; realm de
  Basic Auth con slug en `auth.js`): hecho.
- **Segmento 4** — `frontend/nginx.conf` con `location` por regex para
  `/<slug>/admin`, `/<slug>/(dashboard|tickets|login|csf)` y
  `/<slug>/api/*`; frontend tenant-aware; assets locales a rutas
  absolutas: hecho.
- **Segmento 5** — `backend/utils/storage.js`, almacenamiento migrado a
  MinIO/S3: hecho, validado contra MinIO real en segmentos posteriores
  (ver PROJECT_STATE.md punto 92 y validaciones de los puntos 138+).
- **Segmento 6** — `backend/scripts/cutover-tenant-piloto.js` (runbook
  para convertir la BD de un solo tenant en el primer tenant real): hecho,
  pero **nunca ejecutado en producción real** — el usuario debe correrlo
  él mismo, idealmente contra una copia/backup primero (PROJECT_STATE.md
  punto 93).
- **Segmento 7** — `backend/utils/adminAuditoria.js`, rate limits
  tenant-aware, anti-enumeración de tenants, cabeceras de seguridad,
  `Cache-Control: no-store`: hecho.
- **Segmento 8** — `docker-stack.yml` (Swarm), MySQL primario/réplica por
  GTID, scripts `configure-replica.js`/`promote-replica.js`/
  `verify-replication.js`: hecho, failover **manual** y lecturas **solo
  en el primario** (decisión de alcance, PROJECT_STATE.md punto 95).
  **Nunca desplegado contra un clúster Swarm real** — validar antes de
  producción, incluido un failover simulado.
- **Segmento 9** (FINAL) — `/control`, app cross-tenant para
  suspender/reactivar/dar de baja tenants existentes, solo perfil
  `'super'`: hecho. No incluye crear tenants nuevos (sigue siendo el CLI
  `provisionar-tenant.js`, requiere root de MySQL).
- **Segmento 9b** — `/control` movido a su propio contenedor
  (`control/`), auth solo `ADMIN_USERS`, invalidación de caché entre
  contenedores vía `POST /internal/cache-tenant/invalidar`
  (`INTERNAL_CACHE_SECRET`): hecho y validado con clics reales en
  navegador (PROJECT_STATE.md puntos 99-100).
- **Segmento 9c** — alta de empresa nueva desde `/control`
  (`POST /api/control/tenants`, estado `provisioning` → el CLI completa
  el aprovisionamiento físico): hecho, validado E2E con Playwright real
  (PROJECT_STATE.md puntos 101-102).

Las tres superficies de la app: portal de cliente (sin prefijo o
`/<slug>/...`), panel admin por tenant (`/admin` o `/<slug>/admin`), y
app de control cross-tenant super-only (`/control`, segmento 9). Todo
trabajo nuevo sobre esta arquitectura sigue el mismo protocolo
`addv-web-app` de analizar-proponer-confirmar-implementar.

**Aún sin validar contra infraestructura real de producción**: Docker
Swarm multi-nodo real (segmento 8), `/control` repartido en dos
servidores físicos distintos (segmento 9b), y el cutover real del
segmento 6. **Todavía no hay ningún tenant de producción real dado de
alta con tráfico real** salvo lo que el propio usuario haya provisionado
fuera de estas sesiones — confirmar estado actual en `PROJECT_STATE.md`
antes de asumir esto.

## Limitaciones conocidas de entornos de generación sin Docker/MySQL real

Ver la sección "Limitaciones de ESTE entorno de generación" en
`PROJECT_STATE.md` — en general: sin acceso a un MySQL/Docker corriendo,
la validación se limita a `node --check`, pruebas unitarias con mocks, y
trazado manual de queries. Cualquier cambio de esquema/queries debe
confirmarse corriendo `backend/scripts/verificar-mysql.js` contra MySQL
real antes de producción.
