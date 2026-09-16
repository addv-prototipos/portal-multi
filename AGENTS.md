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
o estado del proyecto, actualizar siempre `PROJECT_STATE.md`, `CLAUDE.md`,
`pendientes.html`
**Pendientes con check (2026-09-16, punto 302):** `pendientes.html` tiene columna `Hecho` + pestana `Historico` con `localStorage` (`portalClarvo_pendientes_checks_v1`). Al marcar desaparece del Listado/buscador/filtros y pasa al Historico local. Cuando el usuario diga "revisa pendientes", leer `localStorage` (boton `Copiar estado`) y, si hay cambios, consolidar a `Completado` permanente en el repo (`pendientes.html` pill verde + `PROJECT_STATE.md`). No requiere prompt por pendiente.
 y este archivo antes de cerrar el trabajo. Si la sesión
tiene acceso de escritura a Claude Mem, registrar también ahí la
decisión/estado para que futuras sesiones de Claude y Codex puedan
coordinarse sin depender del historial del chat. Si solo hay acceso de lectura
a Claude Mem, dejar constancia explícita en estos archivos. Esta regla se
ejecuta junto con el protocolo `addv-web-app`: analizar primero, proponer un
segmento acotado, esperar confirmación explícita del usuario e implementar solo
el segmento aprobado, manteniendo el piso obligatorio de
UX/accesibilidad/rendimiento/seguridad/Docker/pruebas/calidad.

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
- **Cero emojis en todo el diseño (2026-09-10, directiva general del
  proyecto)**: ningún emoji real (📧🖨️✅❌⏳🔴 etc.) en HTML/CSS/JS de
  producción, correos, ni en propuestas/mockups/Artifacts de diseño —
  regla ya venía aplicándose caso por caso desde 2026-08-31 (ver
  PROJECT_STATE.md puntos 165, 188-189, 261), ahora es directiva
  persistente para CUALQUIER trabajo futuro, sin excepción y sin que
  haga falta pedirla de nuevo. Todo indicador visual (estatus, acción,
  alerta) se construye con los **SVG inline ya existentes en el sitio**
  (mismo estilo feather-like de `admin.js`/`admin.html`/`portal.js`) o,
  si es solo un punto de color, con un `<span>` `border-radius:50%` +
  `background` (ver `.inicio-donut-dot`/`.inv-calculo-base-dot` en
  `admin.css`) — nunca un carácter Unicode tipo "●"/"✓" ni un emoji real.
  Al homologar con un mockup/imagen de referencia que sí trae emojis o
  íconos de una librería externa (Font Awesome, etc.), replicar la FORMA
  visual con los SVG propios del sitio, respetando además el set de
  íconos ya en uso salvo que el usuario pida explícitamente cambiarlos.
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
- **PENDIENTE — Gestor de facturación desactivable (ver PROJECT_STATE.md punto 269, 2026-09-10)**: switch para desactivar el gestor de facturación; al estar OFF: definir reglas de envío (qué correos se suprimen/encolan), retirar el link de cliente y servir página "no encontrada/desactivado" (404 vs. mantenimiento del punto 222), y definir qué hacer con envíos/tickets existentes (bloqueo de `POST /api/tickets` vs. solo ocultar UI, destino de pendientes). Sin analizar modelo (`gestor_facturacion_activo` por tenant en `control_tenants.tenants`), UX en `/control` ni guards en `backend/server.js`/`frontend/nginx.conf` — cero código tocado, en espera de confirmación del alcance (tenant vs. global, qué flujos abarca).
- **PENDIENTE — Script de despliegue + empaquetado (ver PROJECT_STATE.md punto 270, 2026-09-10)**: generar script de despliegue y empaquetado. Sin analizar destino (VPS `docker compose` vs. Swarm `docker-stack.yml`), pasos del script (`build --no-cache`/`up -d --force-recreate` + `ensureSchema` + `/api/health`), qué se empaqueta (`.zip` de entrega vs. imágenes `portalManager-*` vía registry/`docker save`), versionado, manejo de `.env`/secretos ni rollback — cero código tocado, en espera de confirmación del alcance.

- **Puntos 276-277 (ver PROJECT_STATE.md, 2026-09-10, IMPLEMENTADOS Y VALIDADOS contra Docker/MySQL reales y en navegador real)**: 2 mockups de `stitch/` homologados. "Estado del inventario" (Reportes) gana 4ta KPI honesta ("Salud del catálogo"), banner de capital inmovilizado real, tabs Top5/Bottom5, matriz de riesgo con "Gestionar" real, export/imprimir; fix aparte, la fila de pestañas de Reportes ya no deja una fila vacía debajo (Imprimir/CSV viven junto a las pestañas). Inventarios (vista principal) reagrupa sus 10 KPIs en 2 secciones + tab "Servicios" real + 2 columnas nuevas (Nivel de stock/Valuación) + chips de stock + "Reordenar" (abre Entrada real) + export Kardex consolidado — descartado sin construir: conciliación CFDI, "Valuación PEPS" (es promedio ponderado), Clave SAT por producto. Extensión same-day: imagen placeholder real + efecto lupa (elemento flotante compartido, position:fixed) en Inventarios y sugerencias de producto de Ventas. Jest backend 912/912. Sin commit/push todavía.

- **Punto 278 (ver PROJECT_STATE.md, 2026-09-10, IMPLEMENTADO Y VALIDADO por HTTP contra Docker/MySQL reales)**: rediseño gráfico de Inventarios fiel a la referencia aprobada — pills de conteo dentro de cada pestaña (Activos/Papelera/Servicios, cacheadas por vista sin pedir nada nuevo al servidor), texto fijo "Base de cálculo: Existencia física × Costo Promedio (D5)" junto a los tabs, etiquetas de sección con ícono + texto honesto a la derecha ("Valuación: promedio ponderado (D5)"), círculo decorativo en las 3 tarjetas de "Salud financiera y existencias", pie con divisor real ("Costo prom: $X · Total: Y pz") en "Valor del inventario" (nuevo campo `costo_promedio_ponderado` en `GET /inventarios/dashboard`, mismo cálculo que "Estado del inventario"), grid de riesgo a 5 columnas real (`#inv-kpi-riesgo-grid`, sin hueco vacío), tarjetas "Bajo mínimo"/"Sin existencia" tintadas ámbar/rojo con link "Ver productos →", "Sin movimiento"/"Mermas del mes" con texto honesto condicional (0 real → "Catálogo con alta rotación"/"Sin mermas registradas este mes"), "Por vencer" con caption+"Ver lista →" separados, franja de Servicios con 2 íconos circulares + nota honesta "No generan existencias ni costeo de almacén" + link real "Administrar servicios →" (abre la pestaña Servicios). Íconos: mismos SVG inline del sitio, sin librería nueva (respeta el pedido explícito del usuario de no cambiar el set de íconos). Jest backend 912/912 (test de dashboard actualizado con el campo nuevo). Validado por HTTP tras rebuild `--no-cache`+`--force-recreate` backend+frontend: HTML/JS/CSS nuevos confirmados en lo servido, `costo_promedio_ponderado` real (1831.34 = 957790/523). **Sin herramienta de navegador esta sesión** — falta confirmación visual con clics reales. **Commiteado y pusheado** (`f588d42` → `fact/master`).

- **Punto 280 (ver PROJECT_STATE.md, 2026-09-10, IMPLEMENTADO Y VALIDADO por HTTP contra Docker real)**: 5 bugs reales de responsivo/móvil reportados con capturas reales de celular ("todo se encima" + cámara del escáner sin abrir). Causa raíz real: `aplicarLayoutDashboard()` (Modo dashboard) aplicaba ancho/alto de escritorio como estilo en línea sin condición de viewport — le gana a cualquier `@media`; fix con guard `window.innerWidth <= 900` + reaplicación en `resize`. Limpiado el parche manual que el usuario ya había guardado a mano (`DELETE preferencias-dashboard`, a pedido explícito). 2 bugs más del mismo patrón "lista duplicada sin actualizar": F5 no restauraba Proveedores/Configuraciones (mapa hardcodeado desactualizado, ahora `mapaNavPorVista()` única fuente de verdad); `mostrarMenuMovil()` no ocultaba Cuentas por cobrar/Inventarios. Features nuevas: back físico del celular = botón "Menú" (`history.pushState`+`popstate`, solo móvil); en Inicio (Fiscal) móvil, "Solicitudes por estatus" va primero. Escáner de código de barras: la cámara no abre por HTTP plano en LAN (`192.168.x.x`) — `navigator.mediaDevices` no existe fuera de HTTPS/localhost, no es un permiso que pedir; mensaje de error corregido para explicar la causa real. Jest backend 912/912 (sin cambios de backend). Validado por HTTP tras rebuild `--no-cache`+`--force-recreate` frontend. **Sin herramienta de navegador ni acceso al celular real esta sesión** — falta confirmación del usuario en su dispositivo. Sin commit/push todavía.

- **Punto 282 (ver PROJECT_STATE.md, 2026-09-10, IMPLEMENTADO Y VALIDADO por HTTP contra Docker/MySQL reales)**: eliminada por completo la "Cuenta de respaldo admin" (tarjeta de cambio de contraseña en la vista "Usuarios", pedido explícito con captura) — mecanismo #2 de `requireAdminAuth()`, contraseña propia en MySQL independiente de `ADMIN_USERS`. Eliminado de punta a punta: `verificarCuentaRespaldoAdmin()`, la rama del mecanismo, `requireUsuarioAdminExacto()`, los 2 endpoints `GET`/`PUT /api/admin/config/admin-password`, el seed en `ensureSchema()`, la tarjeta HTML/CSS/JS completa, y la fila huérfana en la tabla real (`DELETE` directo). `ADMIN_USERS` intacto — `admin:admin` por defecto sigue funcionando. Además: la tabla "Perfiles y roles de acceso" ya no muestra la fila "Super" y el botón que la abre ahora gatea por perfil `administrador` o `super` (antes por `usuarioSesionActual === 'admin'`; corrección same-day: "super" también debe verla al no tener restricciones). De paso, 3 tooltips nuevos (`data-tooltip`, mecanismo existente) en "Catálogo (§0.3)"/"En ALM-1 (D2)"/"Existencia × costo promedio (D5)" de Inventarios, lenguaje simple para emprendedores (porción acotada del punto 279, pendiente en su alcance completo). Jest backend 908/908. Validado por HTTP tras rebuild `--no-cache`+`--force-recreate`. **Sin herramienta de navegador esta sesión** — falta confirmación visual. Sin commit/push todavía.

- **Punto 272 — Clarvo Site Market, refinado con crítica arquitectónica
  (ver PROJECT_STATE.md, 2026-09-10, sin código tocado)**: 10 huecos
  reales encontrados en el pendiente original (SSO descrito como
  "credenciales anotadas" — riesgo de credencial cruda; correo-llave sin
  relación con `usuarios` por tenant; sin regla de fusión correo/Gmail;
  hueco fiscal — ADDV sin autofacturarse sus propios cobros de Stripe;
  ambigüedad de si "Control BD independiente" es tabla nueva en el
  `control` ya existente o servicio aparte; MinIO-por-producto tratado
  como gratis cuando hoy cada backend lee su storage de env vars al
  arrancar; dominio-sin-slug rompe el ruteo actual 100% regex de slug;
  gate de suspensión bespoke por producto en vez de un contrato único;
  migración de tenants existentes sin ruta; Fase 1 original demasiado
  amplia). 4 decisiones confirmadas por el usuario: SSO = ticket firmado
  reusando el patrón `X-Internal-Secret` ya probado (segmentos
  99/103/104, punto 153); ADDV SÍ se autofactura (CFDI) cada cobro de
  Stripe; Fase 1 = modelo de datos + SSO + gracia/suspensión + UI A+B en
  `/control` TODO junto, EXCEPTO Stripe real (queda para fase
  posterior); migración = auto-crear comprador maestro desde
  `tenants.contacto_email`. Siguen sin resolver: alcance exacto de
  "Control BD independiente", mecanismo real de MinIO-por-producto,
  regla de fusión de cuenta, ruteo de dominio propio sin slug —
  quedan para cuando se redacte el plan completo de Fase 1 con
  protocolo `addv-web-app`. Sin commit/push.

- **Punto 283 — Segmento "Mi Cuenta" (ver PROJECT_STATE.md, 2026-09-10,
  IMPLEMENTADO Y VALIDADO por HTTP contra Docker/MySQL reales)**: a
  partir del mockup `stitch/code.html` — auditoría dato-real-vs-inventado
  encontró ~70% sin respaldo (2FA, sesiones con IP, suscripción/Stripe,
  autofactura CFDI, toggle de portal público) — NO construido, ni como
  placeholder, a pedido explícito del usuario. Implementado solo lo
  real: nombre/teléfono/correo propios (columna `nombre` nueva en
  `usuarios`) + cambio de contraseña propio (verifica la actual) para
  cualquier perfil; identidad de empresa (razón social/RFC/zona
  horaria/URL del tenant/conteo de operadores, espejo de solo lectura)
  solo para administrador/super. Solo el mecanismo `perfil_bd` de
  `requireAdminAuth()` tiene fila editable — `ADMIN_USERS`/credenciales
  API/sucursal compartida responden `editable:false`/403. 3 endpoints
  nuevos (`GET`/`PUT /api/admin/mi-cuenta`, `PUT .../password`). Vista
  nueva en el sidebar, CSS 100% primitivas ya existentes del sitio. 11
  tests nuevos, Jest backend 919/919. Validado de punta a punta contra
  Docker/MySQL reales con una cuenta de prueba temporal (creada y
  borrada sin residuo). Sin herramienta de navegador esta sesión — falta
  confirmación visual. Sin commit/push.

- **Extensión visual de "Mi Cuenta" + Punto 247 auditado/corregido (ver
  PROJECT_STATE.md, 2026-09-10)**: Mi Cuenta ganó 6 piezas más fieles al
  mockup original (2FA, sesiones, notificaciones, suscripción,
  facturación de Clarvo, banner/footer Market), todas marcadas
  "Próximamente" y deshabilitadas — nunca afirman un estado activo
  falso; identidad visual 100% tokens reales del sitio (navy `#03285B`/
  cyan `#05DBF2`). Aparte, el pendiente 247 (Super Admins desde
  `/control`, implementado en paralelo por otra sesión sin validar) fue
  auditado, probado contra Docker real, y corregido: montaje de `.env`
  apuntaba a una ruta que no existe en la imagen de `control`
  (`EACCES`), y el patrón temporal+`rename()` falla siempre en un bind
  mount de un solo archivo (`EBUSY`) — reemplazado por escritura
  directa + `.env.bak`. 42 tests nuevos, Jest control 167/167. Validado
  de punta a punta con un super admin de prueba temporal, restaurado al
  baseline. Ver PROJECT_STATE.md puntos 283 (addendum) y 284.

- **Anotación al punto 244 (ver PROJECT_STATE.md, 2026-09-10, solo
  registrada)**: asociado a planes (271/272) + número de usuarios
  permitidos por tenant (distinto de la cuota de almacenamiento del
  punto 250). Sin analizar ni implementar. Mismo día: mapeo contra
  `CLARVO_Planes.md` + propuesta visual (Artifact, matriz módulo×plan
  sin precios) — 6 hallazgos reales (auditoría sin pantalla,
  automatizaciones inexistentes, varias features ya construidas sin
  gate por plan, dashboard/reportes sin 2 versiones reales, cuotas sin
  enforcement, "soporte prioritario" no es software). Solo
  mapeo/propuesta, cero código tocado.

- **Punto 244 — piezas sueltas del mapeo con `CLARVO_Planes.md` (ver
  PROJECT_STATE.md, 2026-09-11, IMPLEMENTADO Y VALIDADO contra
  Docker/MySQL reales)**: Auditoría consultable (vista nueva en
  `/admin`, `GET /api/admin/auditoria`, siempre acotada al tenant);
  switch real `marca_lookfeel_habilitado` (marca/Look&Feel siguen como
  upscale, ahora con gate real); cuota real `max_usuarios` por tenant,
  enforced en `POST`/`PUT /api/admin/usuarios` (400
  `CUOTA_USUARIOS_EXCEDIDA`, solo administrador/fiscal/ventas). Offline
  y recorrido guiado confirmados como CORE (nunca se gatean);
  "Dashboard/Reportes básico vs avanzado" diferido, solo documentado;
  Automatizaciones y Soporte prioritario eliminados del alcance. 16
  tests nuevos, Jest backend 935/935, control 173/173. Validado contra
  Docker/MySQL reales con el tenant real `abarroteslulu`, restaurado a
  su estado original. Pendiente real: el catálogo de PLANES en sí
  sigue sin existir (ligado a 271/272). Sin herramienta de navegador
  esta sesión.

- **Punto 285 — "Registrar venta" más ancho + "Sin ticket" por defecto +
  radios en Configuraciones globales (ver PROJECT_STATE.md, 2026-09-11,
  IMPLEMENTADO Y VALIDADO contra Docker/MySQL reales)**: modal
  820px→920px en escritorio (clase propia, no toca `.ticket-modal`
  compartida); toggle de entrega de 2 a 3 estados (`ordenMetodoEntrega`),
  "Sin ticket" = sin correo, sin imprimir, solo confirma; radios reales
  en Configuraciones globales → Ventas para elegir el default, mismo
  autoguardado que "Habilitar Ventas" — backend `entrega_venta_default`
  nuevo (default `'sinticket'`), mismo candado de perfil que
  `ordenes_compra_habilitado`. 6 tests nuevos, Jest backend 941/941. Sin
  herramienta de navegador esta sesión. **Bug corregido el mismo día**:
  el ancho 920px nunca se veía (empate de especificidad CSS con
  `.ticket-modal`, que ganaba por orden de cascada) — fix con selector
  combinado `.ticket-modal.orden-registrar-modal { max-width: 1012px }`
  (2 clases, gana sin depender del orden; +10% sobre 920px a pedido del
  usuario).

- **Punto 286 — Switch "Mostrar Auditoría" (ver PROJECT_STATE.md,
  2026-09-11, IMPLEMENTADO Y VALIDADO por HTTP contra Docker real)**:
  tarjeta nueva en Configuraciones globales, oculta el menú "Auditoría"
  (punto 244) si está apagado — `auditoria_habilitada` nuevo en
  `config.js` (default `true`), mismo candado de perfil que
  `entrega_venta_default`. Gatea el botón del sidebar/menú móvil Y
  `GET /api/admin/auditoria` server-side (403 si apagado, no solo
  ocultar UI). La tabla `admin_auditoria` sigue registrando todo acceso
  sin importar el switch. 8 tests nuevos, Jest backend 946/946.
  Validado de punta a punta por curl (200/403/200). Sin herramienta de
  navegador esta sesión.

- **Punto 287 — Bug real de impresión térmica, rollo en blanco (ver
  PROJECT_STATE.md, 2026-09-11, CORREGIDO por análisis de código, SIN
  validar contra impresora física)**: usuario reportó con captura real
  (driver "POS-58") que el ticket imprimía con mucho espacio en blanco
  después del texto. El alto dinámico ya existía (punto 209) pero medía
  mal — las reglas de ancho 58mm/tipografía compacta vivían solo dentro
  de `@media print`, la medición (fuera de ese contexto) usaba
  ancho/letra de pantalla normales, calculando un alto muy por debajo
  del real; el driver probablemente rechazaba ese tamaño chico y caía a
  su papel por default. Fix: esas reglas se movieron a una declaración
  incondicional de `#ticket-imprimir` (fuera de `@media print`). Cero
  backend. **Sin impresora física ni navegador con hardware en esta
  sesión** — falta que el usuario lo pruebe en su equipo; si sigue
  quedando blanco, revisar el largo de papel configurado en el driver
  del sistema operativo.

- **Punto 288 — 3 bugs reales corregidos + logo/footer en el ticket (ver
  PROJECT_STATE.md, 2026-09-11)**: (1) "Imprimir etiqueta" de Inventarios
  mostraba el ticket de venta viejo — 2 bloques `@media print` en
  `admin.css` con listas de excepciones desincronizadas, fix: misma
  lista en ambos. (2) Logo CLARVO + "Visítanos https://clarvo.mx"
  agregados solo al ticket de venta (`construirHtmlTicket()`,
  `admin.js`). (3) Switch "Mostrar Auditoría" (punto 286) no aparecía —
  `CONFIG_SECCIONES` en `admin.js` le faltaba la entrada de Auditoría,
  agregada. Cero backend, Jest 946/946 sin cambios. Sin herramienta de
  navegador esta sesión.

- **Punto 289 — Esqueleto de carga (shimmer tipo Facebook) en todo el
  sitio (ver PROJECT_STATE.md, 2026-09-12/13, IMPLEMENTADO Y VALIDADO en
  navegador real contra Docker/MySQL reales)**: pedido explícito del
  usuario — que "esperar" nunca se sienta como "no puedo conectar".
  Auditoría de código confirmó cero skeleton/spinner previo; tablas
  nacían vacías, KPIs en `$0.00`/`0` reales, el error de red solo
  disparaba por `fetch` rechazado (no por lentitud). Propuesta visual
  antes/después (Artifact interactivo, 3 escenarios reales) aprobada con
  3 decisiones: las 3 superficies en un solo segmento, sin mínimo de
  tiempo artificial, mismo texto de error reubicado dentro del bloque
  que falló. `frontend/skeleton.js` nuevo (compartido, mismo patrón que
  `theme.js`) + componente `.sk`/`.sk-cargando`/`.sk-retry-inline` único
  en `style.css` (anima solo `background-position`, respeta
  `prefers-reduced-motion`). Aplicado a 15/17 tablas de `/admin` + 2 de
  `/control` + 1 del portal cliente (2 descartadas a propósito: pueblan
  un `<select>`, no una tabla). Un solo `classList.toggle('sk-cargando')`
  por vista cubre TODOS los KPIs de esa vista porque `.inicio-stat-numero`
  es una sola clase reusada en todo el sitio. Esqueleto de shell
  (sidebar+KPIs) nuevo durante la verificación de sesión guardada al
  recargar `/admin`/`/control` — reemplaza el parpadeo de login. **2
  bugs reales encontrados y corregidos en esta misma sesión**:
  `cargarEstadisticasReportes` dejaba el shimmer prendido para siempre
  si la serie venía vacía (return a medio camino, antes de apagarlo);
  `cargarCxc` no propagaba el fallo de `cargarOrdenes()`, mostrando CxC
  vacía en silencio en vez de un error real (CxC nunca había tenido su
  propio elemento de error — hueco cerrado de paso). Jest backend
  946/946 sin cambios (100% frontend). Validado con clics reales en
  navegador (Claude in Chrome): shimmer de Ventas capturado en vivo
  resolviendo a 183 ventas reales, `/control` con login y tabla reales,
  cero errores de consola. Sin commit/push todavía.

- **Punto 290 — Suspender/activar usuario en /admin, sitio base y tenant
  (ver PROJECT_STATE.md, 2026-09-12/13, IMPLEMENTADO Y VALIDADO en
  navegador real contra Docker/MySQL reales)**: aplica a los 4 perfiles
  (cliente/ventas/fiscal/administrador). Columna `usuarios.activo`
  (migración idempotente) + reuso EXACTO del patrón/íconos ya usados
  para suspender un tenant en `/control` (mismos 2 SVG, mismas clases
  `.estatus-activo`/`.estatus-suspendido` ya existentes sin usar).
  Revocación real: admin/fiscal/ventas se corta en la siguiente petición
  (Basic Auth revalida cada vez) — el 403 "cuenta suspendida" solo sale
  DESPUÉS de contraseña correcta, nunca antes. Cliente: login nuevo
  rechazado + sesión ya abierta se corta en su siguiente `GET
  /api/auth/me` (mismo mecanismo que ya forzaba el cambio de contraseña
  obligatorio). Endpoint nuevo `PUT /api/admin/usuarios/:id/estado` con
  el mismo candado que ya existía para "no puedes eliminar tu propia
  cuenta", adaptado a suspender (sí puedes reactivarte a ti mismo).
  Cuota de usuarios: una cuenta suspendida sigue contando (decisión
  confirmada). **Bug real propio evitado**: el login de `/admin` mostraba
  un texto genérico fijo para cualquier error no-401 — el 403 nuevo se
  habría enmascarado; corregido para mostrar el error real. **Regresión
  real propia corregida**: usar `!fila.activo` directo habría marcado
  como suspendidas las ~22 filas mockeadas sin ese campo en tests ya
  existentes — cambiado a comparación explícita `=== 0/false`.
  **Fragilidad de test preexistente expuesta y corregida**: el archivo
  de tests de auth ya usaba las 20 peticiones completas del `authLimiter`
  compartido (login+registro+recuperar+restablecer) sin margen — subido
  a 30. Jest backend 958/958 (16 tests nuevos). Validado con clics
  reales en navegador: badge Activo↔Suspendido y botón pausa↔check
  confirmados en una fila real, cero errores de consola.

- **Punto 293 — Centro de conocimiento de /admin puesto al día (ver
  PROJECT_STATE.md, 2026-09-13, IMPLEMENTADO Y VALIDADO en navegador
  real)**: `CONOCIMIENTO_CATEGORIAS` tenía 13 categorías, el sidebar
  real ya tiene 14 vistas — faltaban "Mi Cuenta" (punto 283) y
  "Auditoría" (puntos 244/286) por completo, agregadas con sus mismos
  íconos reales. "Usuarios y perfiles" ganó 2 pasos sobre el punto 290
  (suspender/reactivar, cuenta suspendida sigue contando contra cuota).
  Resto de categorías revisadas y ya estaban al día. Cero backend.
  **`/control` no tiene ningún Centro de conocimiento** (el pedido
  original lo mencionaba como si ya existiera) — construirlo sería
  función nueva, no actualización; queda preguntado al usuario antes de
  tocar código ahí.

- **Punto 294 — Centro de conocimiento nuevo para /control (ver
  PROJECT_STATE.md, 2026-09-13, IMPLEMENTADO Y VALIDADO en navegador
  real)**: cierra el hueco del punto 293 — `/control` no tenía ningún
  manual; preguntado por `AskUserQuestion`, el usuario eligió
  construirlo. Reuso literal del componente ya validado en `/admin`
  (`control.html` ya carga `admin.css`, cero CSS nuevo) con contenido
  propio para sus 3 vistas reales: Empresas (ciclo de vida completo,
  slug clicable, credenciales API), Sucursales (usuarios compartidos
  entre tenants del grupo), Super Admins (gestión de `ADMIN_USERS` sin
  reiniciar, distinto de un usuario de panel normal). Sin categoría
  "Primeros pasos" a propósito (simplificación consciente, solo 3
  vistas cross-tenant). Cero backend. Validado con clics reales en
  navegador: 3 categorías, buscador resaltando en vivo, atajo de
  topbar, tabla real de tenants intacta al cerrar, cero errores de
  consola.

- **Punto 295 — Arquitectura de información: menú lateral y
  Configuraciones globales (ver PROJECT_STATE.md, 2026-09-13,
  IMPLEMENTADO Y VALIDADO en navegador real)**: investigación real de
  UX (6 principios de IA para dashboards, NN/g, Ley de Miller, guías de
  settings pages) antes de proponer nada. 14 vistas del sidebar
  reagrupadas en 5 secciones (Facturación/Ventas y gastos/Finanzas/
  Catálogo/Administración) + Inicio suelto + Cuenta al fondo — grupos
  validados contra los 4 perfiles reales ANTES de implementar,
  coinciden con `RESTRICCIONES_PERFIL` ya existente. Configuraciones
  globales reagrupada en Fiscal/Comunicación/Módulos, con 4 renombres
  para cerrar colisiones de nombre reales entre una vista del menú y
  una tarjeta de configuración ("Ventas"/"Inventarios"/"Reportes").
  Cero backend, cero permiso tocado — 100% reordenamiento visual.
  Validado con clics reales: grupos se auto-ocultan sin dejar títulos
  huérfanos (caso parcial y caso total probados), buscador de
  Configuraciones filtrando en vivo, cero errores de consola.

- **Punto 296 — Grupos del sidebar colapsables + scrollbar delgada (ver
  PROJECT_STATE.md, 2026-09-13, IMPLEMENTADO Y VALIDADO en navegador
  real)**: crítica aplicada al pedido literal (colapso 100% manual) —
  mejora confirmada: el grupo de la vista activa se abre solo, el resto
  empieza colapsado; aperturas manuales se recuerdan por cuenta
  (`localStorage`). Scrollbar nativa ancha reemplazada por una delgada
  tipo overlay (visible solo al interactuar), nunca oculta del todo.
  Cero backend. Validado con clics reales: 2 grupos abiertos a la vez
  (uno manual + uno automático) sin conflicto, persistencia tras F5
  real, cero errores de consola.

- **Punto 297 — SMTP: acordeón estricto + autoguardado (ver
  PROJECT_STATE.md, 2026-09-13, IMPLEMENTADO Y VALIDADO en navegador
  real)**: "Correo electrónico (SMTP)"/"Plantillas de correo"/"Enviar
  correo de prueba" pasan a acordeón estricto (solo 1 abierta, mismo
  `grid-template-rows` del punto 296). Hallazgo real: `PUT
  /api/admin/config/smtp` no admite guardado parcial (13 campos
  siempre juntos) — el acordeón estricto mitiga el riesgo en vez de
  agravarlo. "Correo electrónico (SMTP)" autoguarda sola (`change`,
  misma validación del botón, indicador en el encabezado); único botón
  "Guardar" relocalizado a "Plantillas de correo" (2 botones se
  descartó por affordance redundante). Acordeón viejo e inerte de esta
  tarjeta eliminado. Cero backend, Jest 958/958 sin cambios. Validado
  con clics/JS reales: acordeón estricto confirmado, autoguardado
  persistido de verdad (`GET /api/admin/config/smtp`), botón reubicado,
  cero errores de consola. Sin commit/push todavía.

- **Punto 298 — "Servicio en paquete": 2do cobro válido para
  tipo=servicio (ver PROJECT_STATE.md, 2026-09-15, IMPLEMENTADO — SIN
  validar contra Docker/MySQL real ni en navegador esta sesión)**: en
  vez de sembrar la unidad "srv" pedida tal cual, se reusa "Paquete"
  (ya sembrada, sin uso por ningún servicio hasta hoy) — evita 2
  conceptos casi idénticos en el catálogo. Bug real evitado antes de
  shippear: el backfill de `ensureSchema()` forzaba TODO servicio a
  "Hora" en cada restart — corregido a condicional para no revertir en
  silencio un servicio guardado como "Paquete". Backend valida
  `unidad_id` contra una whitelist de 2 (`Hora`/`Paquete`, antes lo
  ignoraba siempre). Selector del modal con copy propio ("Por hora"/
  "Precio fijo (paquete de servicio)") + hint dinámico. Jest backend
  960/960 (+2). Sin commit/push todavía.

- **Punto 299 — Restyle "confGlo" de SMTP + "Verificar conexión ahora"
  (ver PROJECT_STATE.md, 2026-09-15, IMPLEMENTADO Y VALIDADO por HTTP
  contra Docker real)**: mockup `stitch/confGlo` — sidebar ya coincidía
  exacto con lo real (puntos 295-297); la sección "conexión" se
  reagrupó en 3 subsecciones tituladas. 3 decisiones vía
  `AskUserQuestion`: timestamp "Última verificación exitosa" construido
  de verdad (campo nuevo `ultima_verificacion_en`, sin `ALTER TABLE`);
  handshake ligero nuevo `POST /api/admin/config/smtp/verificar`
  (`nodemailer .verify()`) AGREGADO junto al "Enviar prueba" completo
  ya existente (ambos actualizan el mismo timestamp); se mantuvo el
  autoguardado sin botón de footer del punto 297. **Bug real
  encontrado validando por HTTP**: ambos endpoints devolvían 502, que
  `nginx.conf.template` intercepta globalmente y disfraza de "sitio
  caído" — mismo patrón ya corregido en `/api/aclaraciones` (punto
  170) — corregidos a 500. Jest backend 969/969 (+9). Sin herramienta
  de navegador esta sesión — falta confirmación visual. **Commiteado y
  pusheado** (`c942ccb` → `fact/master`).

- **Punto 300 — Paquete `prod/` puesto al día + `actualizar.sh` nuevo
  (ver PROJECT_STATE.md, 2026-09-15, mismo día)**: el paquete de
  despliegue VPS `yt.addv.com.mx` (`prod/`, untracked a propósito,
  nunca `git add`) tenía semanas de drift de contenido (sus 2 variantes
  intencionales — `docker-compose.prod.yml` sin `control`,
  `nginx.conf.template` propio — ya estaban correctas, el drift real
  era en el código espejo de `backend/`/`frontend/`; faltaba por
  completo `frontend/skeleton.js` del punto 289). Sincronizado por
  contenido (nunca por estructura), sin tocar `sembrar-prod.js` (único
  archivo propio de `prod/`). Script nuevo `prod/actualizar.sh`
  (reconstruye solo backend+frontend, nunca nginx del host/certbot/
  `.env`, complementa a `deploy.sh` que es solo para el primer
  despliegue) + README actualizado + `prod.zip` regenerado (sin `.env`
  real ni `node_modules`, verificado). **Sin acceso SSH al VPS real
  desde esta sesión** — falta que el usuario copie el paquete y corra
  `sudo ./actualizar.sh` él mismo.

- **Punto 301 — Checkbox "No volver a mostrar" en tickets sin contador
  (solo super) + interruptor maestro "Notificaciones" (ver
  PROJECT_STATE.md, 2026-09-16, IMPLEMENTADO — Jest backend 976/976, SIN
  Docker/MySQL/navegador real esta sesión)**: pedido explícito del
  usuario, protocolo completo con propuesta antes/después (Artifact, 4
  decisiones confirmadas). El popup "Tickets sin correo de contador" ya
  existía (fiscal+super) — gana checkbox visible SOLO para `super`
  (fiscal sigue viéndolo siempre). Persistencia en `localStorage` por
  cuenta+tenant (cuentas `ADMIN_USERS` no tienen fila en `usuarios`, sin
  dónde guardarlo en servidor). Interruptor maestro nuevo
  `notif_tickets_permite_ocultar` (`backend/utils/config.js`, mismo
  candado admin/super que `auditoria_habilitada`) en tarjeta nueva
  "Notificaciones" de Configuraciones globales (grupo Comunicación) —
  apagarlo NO oculta el popup completo, oculta el checkbox y hace que
  cualquier silenciado guardado se ignore (control de cumplimiento).
  `GET /api/admin/tickets/pendientes-sin-contador` devuelve `permiteOcultar`
  en la misma respuesta para evitar una carrera real con
  `cargarConfigGlobal()` (llamada sin `await` en `showDashboard()`). 7
  tests nuevos, Jest 976/976 (era 969). `node --check` limpio, CSS
  balanceado. Falta validar contra Docker/MySQL/navegador real. Sin
  commit/push.

No avanzar al segmento 8 sin aprobación explícita del usuario, por el
mismo protocolo `addv-web-app`.

## Limitaciones conocidas de entornos de generación sin Docker/MySQL real

Ver la sección "Limitaciones de ESTE entorno de generación" en
`PROJECT_STATE.md` — en general: sin acceso a un MySQL/Docker corriendo,
la validación se limita a `node --check`, pruebas unitarias con mocks, y
trazado manual de queries. Cualquier cambio de esquema/queries debe
confirmarse corriendo `backend/scripts/verificar-mysql.js` contra MySQL
real antes de producción.
