# AGENTS.md — Portal de Facturación ADDV

Contexto operativo persistente para cualquier sesión de Codex que trabaje
en este repo. Para el historial de decisiones y el estado detallado del
proyecto, ver `PROJECT_STATE.md` (fuente de verdad más completa que este
archivo). Para instrucciones de instalación/operación, ver `README.md`.

## Protocolo de trabajo

Este proyecto opera bajo el protocolo `addv-web-app` (skill de Codex):
sitio corporativo/reputacional, flujo obligatorio **Analizar → Proponer →
Confirmar → Implementar** — no asumir requisitos ambiguos, no implementar
sin aprobación explícita del segmento, piso no negociable de UX/accesibilidad/
rendimiento/seguridad/Docker/pruebas unitarias/calidad de código. Mantener
siempre actualizados `PROJECT_STATE.md`, este archivo y `README.md`.

Regla persistente de coordinación entre agentes: después de cualquier cambio
relevante de código, arquitectura, operación, pruebas, decisiones de producto
o estado del proyecto, actualizar siempre `PROJECT_STATE.md`, `CLAUDE.md` y
este archivo antes de cerrar el trabajo. Si la sesión tiene acceso de escritura
a Claude Mem, registrar también ahí la decisión/estado para que futuras
sesiones de Claude y Codex puedan coordinarse sin depender del historial del
chat. Si solo hay acceso de lectura a Claude Mem, dejar constancia explícita
en estos archivos. Esta regla se ejecuta junto con el protocolo
`addv-web-app`: analizar primero, proponer un segmento acotado, esperar
confirmación explícita del usuario e implementar solo el segmento aprobado,
manteniendo el piso obligatorio de UX/accesibilidad/rendimiento/seguridad/
Docker/pruebas/calidad.

## Stack

Node.js 20 + Express 4, MySQL 8 (`mysql2/promise`, SQL crudo, sin ORM),
Nginx sirviendo frontend estático (HTML/CSS/JS vanilla, sin build step),
todo sobre Docker/Docker Compose. Ver README para la lista completa de
dependencias.

## Comandos frecuentes

```bash
# Levantar todo el stack
docker compose up -d --build

# Health check
curl http://localhost/api/health

# Pruebas unitarias (mockeadas, sin DB real)
cd backend && npm test          # o: npx jest test/unit

# Pruebas de integración (supertest, sin DB real)
npx jest test/integration

# Regresión contra MySQL real (requiere el stack levantado)
docker compose exec backend node scripts/verificar-mysql.js

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
- Segmento 9c (`control/utils/tenantIntake.js` + `POST /api/control/tenants`
  + modal "Nueva empresa" en `/control`): hecho. Captura la solicitud de
  alta con `estado='provisioning'` — el alta física (CREATE DATABASE +
  GRANT) sigue siendo exclusiva de `backend/scripts/provisionar-tenant.js`
  (root de MySQL), que ahora completa esas filas en vez de rechazarlas.
  Pre-llenado de config fiscal opcional al aprovisionar
  (`aplicarConfiguracionFiscalEnProcesoHijo`). Ver PROJECT_STATE.md
  punto 101. Validado contra Docker/MySQL reales: captura UI →
  provisioning CLI → fila `activo` con pre-llenado fiscal, ciclo de
  vida 404/200, y E2E en navegador real (Playwright, 7/7 passed).
- **Bugs de producción encontrados y corregidos con la E2E del flujo
  completo en `piloto9c` (ver PROJECT_STATE.md punto 102)**: (1) el
  AsyncLocalStorage de `ejecutarComoTenant` NO se propaga de forma
  confiable al callback de multer/busboy (carrera: `pool.query` caía a
  veces a `portal_facturacion` aunque `req.tenant` estuviera bien) —
  fix: `req.poolTenant` en `tenantContext.js` + helpers
  `reanudarContextoTenant`/`subirConTenant` envolviendo los 4 call sites
  de multer en `server.js` (tickets, registro, constancia-compania,
  factura); (2) desfase de 1 segundo en `POST /api/admin/ordenes-compra`
  (Intl trunca ms, MySQL redondea → COMPRA_NO_ENCONTRADA intermitente) —
fix: `ahora.setMilliseconds(0)`. Ambos validados: Jest 388/388 + E2E
   5/5 passed contra Docker/MySQL reales.
- **Segmento "Marca" (ver PROJECT_STATE.md punto 103)**: hecho y validado
  contra Docker/MySQL reales. Campo `marca` (VARCHAR 255) + `marca_logo_url`
  (VARCHAR 500) en `control_tenants.tenants` (solo vía
  `control/scripts/ensureSchema.js`); logo opcional en MinIO bajo key
  `marca/<slug>/logo` subido por el control vía endpoint interno
  `POST/DELETE /internal/marca-logo/:slug` (secreto `X-Internal-Secret`,
  NO expuesto por nginx) y servido por `GET /api/marca-logo/:slug` (público,
  cache 86400). Los 7 "ADDV" incrustados en correos del backend quedaron
  mapeados a `MARCA_DEFECTO='ADDV'` + `marcaDelTenant(req)` en `server.js`;
  `req.tenant.marca`/`marcaLoGoUrl` llegan desde `tenantContext.js`.
  API: `PUT /api/control/tenants/:slug/marca` (`{marca?, logoBase64?,
  quitarLogo?}`) en `control/utils/tenantMarca.js`; el intake 9c acepta
  `marca`+`logoBase64`. UI: campo Marca + logo en el modal de alta y
  botón "Editar marca" por fila en `/control`; etiqueta renombrada a
  "Slug (Contexto URL único)". Verificado: backend Jest 482/482, control
  67/67, E2E piloto9c 5/5, y flujo real (subir/GET/borrar logo contra
  MinIO real, marca en correo de invitación hasta SMTP). Límites
  `express.json` de backend y control en 4mb (base64 del logo).
- **Segmento "Edición" (ver PROJECT_STATE.md punto 104)**: hecho y
  **validado contra Docker/MySQL/MinIO reales (2026-08-14)**: rebuild
  del stack; renombrado de slug con 4 archivos reales + logo (migración
  íntegra verificada byte a byte, prefijo viejo vacío, db_name
  conservado, auditoría `slug_cambiado`, URLs 200/404); spec E2E NUEVO
  `e2e/tests/control-editar-empresa.spec.ts` (2/2) y suite E2E completa
  14/14. Detalle encontrado en la validación: el checkbox del switch
  "Cambiar slug" está oculto visualmente — se interactúa con su label.
  Edición completa de una empresa existente desde `/control`:
  botón "Editar" por fila → modal con los MISMOS campos que el alta +
  slug en solo lectura habilitable solo con el switch "Cambiar slug
  (avanzado)" (CSS `.control-switch` en `frontend/admin.css`). API:
  `PUT /api/control/tenants/:slug` (`control/utils/tenantEdicion.js`)
  con `slug` opcional — cambiar slug dispara ANTES la migración de
  TODOS los archivos del tenant en MinIO vía endpoint interno
  `POST /internal/renombrar-slug` (backend, secreto `X-Internal-Secret`,
  NO expuesto por nginx; verificado por conteo, 502 sin borrar nada si
  no cuadra; helpers `copiarArchivo`/`eliminarPrefijo` en
  `backend/utils/storage.js`). La BD física NO se renombra (`db_name` se
  conserva; solo en `provisioning` se regenera); `storage_prefix` sí.
  nginx no necesita recarga (rutas regex del segmento 4); el control
  invalida la caché del backend para ambos slugs. Auditoría
  `datos_actualizados`/`slug_cambiado` en `tenant_eventos`. Bug de
  sesión anterior corregido: el toast comparaba el slug después de
  `cerrarEdicion()` (siempre habría dicho "el slug cambió"). Suites al
  día: backend 492/492 (28 suites), control 88/88 (7 suites).
- **Todavía no hay ningún tenant real dado de alta** — nada de esto
  recibe tráfico real hoy.
- **Remotes git (ver PROJECT_STATE.md punto 107)**: `origin` apunta a
  `portal-multi.git` y `fact` a `ADDVportalFact.git` (el repo donde se
  publica el trabajo real). Publicar = `git push fact main:master` (la
  rama local es `main`; el master remoto fue reemplazado por force push
  el 2026-08-18, los 53 commits previos quedaron huérfanos, la rama
  `prototipo` del remote sigue intacta). No asumir `origin` como destino
  de publicación sin verificar antes.

No avanzar al segmento 8 sin aprobación explícita del usuario, por el
mismo protocolo `addv-web-app`.

## Limitaciones conocidas de entornos de generación sin Docker/MySQL real

Ver la sección "Limitaciones de ESTE entorno de generación" en
`PROJECT_STATE.md` — en general: sin acceso a un MySQL/Docker corriendo,
la validación se limita a `node --check`, pruebas unitarias con mocks, y
trazado manual de queries. Cualquier cambio de esquema/queries debe
confirmarse corriendo `backend/scripts/verificar-mysql.js` contra MySQL
real antes de producción.
