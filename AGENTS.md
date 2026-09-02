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
- **Tipografía unificada (2026-08-24)**: toda la app usa **una sola
  familia tipográfica — Inter** (la misma del menú lateral del panel
  admin, `.admin-sidebar-nav .admin-vista-btn`). `style.css` define
  `--font-body` y `--font-display` ambas como `Inter` (`--font-display`
  es alias de `--font-body`); `mantenimiento.html` replica el mismo par.
  No se mezcla serif/sans ni se introducen otras familias en ningún
  CSS/HTML nuevo — aplica a **control** (`/control`) y **lado del
  cliente** (portal, login, csf, tickets, dashboard) por igual. El
  sistema de temas por tenant (`backend/utils/tenantTema.js`,
  `control/utils/tenantTema.js`) queda congelado en esta default; si se
  reactiva, debe respetar esta regla.
- **Hover unificado (2026-08-24)**: el `hover` de **Resumen financiero**
  era muy simple frente a **Tickets/Constancias** (`admin.css:1617`
  `.admin-table tbody tr:hover { background: var(--color-accent-soft) }`).
  Se homologó en **todo el sitio y apps** (admin, control, portal cliente,
  reportes y resúmenes) al mismo lenguaje: `background: var(--color-accent-soft)` +
  `border-color: var(--color-accent)` + `transition 0.15s ease` (ver
  `admin.css` bloque "Hover unificado" y `portal.css` `.tile:hover`). Aplica a
  tarjetas de Inicio/Resumen/Reportes/Configuraciones/Gastos y tiles del portal.
  Respeta `prefers-reduced-motion: reduce`.
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
- **Tarjeta "Utilidad neta del mes (ventas totales vs gastos)" (ver
  PROJECT_STATE.md punto 118)** (2026-08-20): nueva tarjeta full-width en
  la vista "Resumen financiero" (tras los 4 KPIs) — número grande
  verde/rojo + barras apiladas CSS puro (Subtotal+IVA vs Gastos) con
  modal de detalle. Cuenta TODAS las ventas del mes (facturadas o no) y
  compara el neto sin IVA contra gastos; nota visible de que el IVA es
  "cobrado en ventas", no cifra fiscal. Backend: `GET
  /api/admin/resumen-financiero` devuelve `subtotal_ventas`/
  `iva_ventas`/`utilidad_neta` en `mes_actual` (sin join a tickets, sin
  cambio de esquema). `node --check` limpio, Jest **552/552 (33
  suites)**, resumen financiero 6/6. Rebuild backend+frontend
  (`--no-cache` + `--force-recreate`) verificado por HTTP: health OK,
  HTML nuevo servido y API validada contra MySQL real (utilidad
  −12,879.46 ≠ balance −37,308.46 con los datos sembrados).
  Pendiente solo revisión visual del usuario (`http://localhost:8088/admin`).
- **Modo dashboard personalizable en Resumen financiero (ver
  PROJECT_STATE.md punto 119)** (2026-08-20): reordenar/redimensionar las
  11 tarjetas de la vista con drag/resize y layout guardado POR USUARIO en
  el servidor, restaurándose en cada ingreso. Vanilla sin librerías: los
  elementos son hijos directos de un tablero CSS Grid de 12 columnas y el
  drag NUNCA mueve nodos del DOM (solo `order`/`grid-column`) para no
  romper `abrirDetalleGrafica()`; teclado completo como alternativa (↑/↓
  posición, ←/→ ancho, Esc). Backend: tabla `preferencias_dashboard`
  (UNIQUE usuario+vista, JSON, SIN FK a usuarios — las cuentas super no
  están ahí) + `GET/PUT/DELETE /api/admin/preferencias-dashboard/:vista`
  con whitelist cerrada de IDs y span 3..12 (rechazo en bloque de layouts
  inválidos); auditoría cubierta por el middleware global. Jest
  **560/560 (34 suites)**. Validado contra Docker/MySQL reales: ciclo API
  completo por HTTP (null→PUT→GET→400s→404→401→DELETE) + tabla real +
  auditoría automática. Pendiente solo revisión visual del usuario.
- **Remotes git (ver PROJECT_STATE.md punto 107)**: `origin` apunta a
  `portal-multi.git` y `fact` a `addv-prototipos/ADDVportalFact.git` (actualizado 2026-09-01, antes `antonioprado-sketch/ADDVportalFact.git` — el repo donde se publica el trabajo real). Publicar = `git push fact main:master` (la rama local es `main`; el master remoto fue reemplazado por force push el 2026-08-18, los 53 commits previos quedaron huérfanos, la rama `prototipo` del remote sigue intacta). No asumir `origin` como destino de publicación sin verificar antes.
- **Datos de prueba históricos + serie mensual de ~6 meses (ver
   PROJECT_STATE.md punto 134, 2026-08-23)**: BD sembrada con 175 ventas +
   85 tickets 'listo' + 86 gastos marcados (mar–ago, script reproducible
   `backend/scripts/sembrar-datos-prueba.js`); retención de tickets subida
   a 365 días; `server.js` amplía la serie del Resumen financiero a ~6
   meses (`inicioSerie`). Rebuild del backend ejecutado y verificado por
   HTTP (serie mar–ago + proyección Sep/Oct activa) una vez que la sesión
   paralela completó "Categorías editables" con la suite en verde
   (584/584).
- **PENDIENTE — Cuentas por cobrar (ver PROJECT_STATE.md punto 138, 2026-08-24)**: a pedido del usuario, toda venta es por defecto "pagada" + opción "pendiente de pago" gestionada en nueva vista "Cuentas por cobrar" (no existe). Propuesta UX/UI documentada, en espera de confirmación explícita — **cero código tocado**. Ventas: radio Pagada (default verde) / Pendiente (ámbar) en el modal que revela Vencimiento + Notas; CxC entre Ventas y Gastos con 4 KPIs y tabla con badges ⏳/🔴/✅ + Registrar cobro (abonos, `monto <= saldo`). Modelo propuesto `estado_pago/monto_cobrado/fecha_vencimiento`. No avanzar sin aprobación.
- **PENDIENTE — Cierre mensual archivado Ventas+Gastos + retención solo-Tickets (ver PROJECT_STATE.md punto 158, 2026-08-28)**: retención `tickets_retencion_dias` queda solo tickets; Ventas/Gastos se archivan (no se borran) al día 1 02:00 `zona_horaria` hacia Reportes (`tipo='cierre_mensual'`, `accion='archivado'`), con `archivado_en`+`periodo_archivado` en ambas tablas. Listados filtran por defecto `archivado_en IS NULL`; Resumen financiero incluye archivados (Opción A). Aplica dual: base ADDV sin slug + cada tenant activo (job itera `control.tenants` vía `ejecutarComoTenant`, `PREFIJO_DEFECTO` corregido). Fases 1-5 documentadas, cero código tocado, en espera de confirmación explícita de hora y alcance de pendientes.

No avanzar al segmento 8 sin aprobación explícita del usuario, por el
mismo protocolo `addv-web-app`.

## Limitaciones conocidas de entornos de generación sin Docker/MySQL real

Ver la sección "Limitaciones de ESTE entorno de generación" en
`PROJECT_STATE.md` — en general: sin acceso a un MySQL/Docker corriendo,
la validación se limita a `node --check`, pruebas unitarias con mocks, y
trazado manual de queries. Cualquier cambio de esquema/queries debe
confirmarse corriendo `backend/scripts/verificar-mysql.js` contra MySQL
real antes de producción.
