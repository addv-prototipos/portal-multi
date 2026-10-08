# AGENTS.md — Portal de Facturación ADDV (Clarvo)

Contexto operativo persistente para cualquier sesión de Codex que trabaje
en este repo. Este archivo es el **master prompt** para Codex — reglas,
protocolo, stack, convenciones y estado arquitectónico de alto nivel. NO
es el historial de features: para eso existen `PROJECT_STATE.md` (fuente
de verdad punto por punto, ~325+ entradas), `cmem.md` (respaldo manual
estilo claude-mem de las sesiones de Claude) y Claude Mem (observaciones
automáticas cross-sesión, solo lectura desde Codex). Para instrucciones de
instalación/operación, ver `README.md`.

**Si necesitas el detalle de una feature/bug pasado**: busca primero en
`PROJECT_STATE.md` por número de punto o palabra clave. Este archivo solo
debe crecer con reglas **nuevas y persistentes** (convenciones, gotchas,
decisiones de arquitectura), nunca con narrativa de "qué se hizo hoy" —
esa va a `PROJECT_STATE.md`.

## Protocolo de trabajo

Este proyecto opera bajo el protocolo `addv-web-app` (skill de Codex):
sitio corporativo/reputacional, flujo obligatorio **Analizar → Proponer →
Confirmar → Implementar** — no asumir requisitos ambiguos, no implementar
sin aprobación explícita del segmento, piso no negociable de UX/accesibilidad/
rendimiento/seguridad/Docker/pruebas unitarias/calidad de código. Mantener
siempre actualizados `PROJECT_STATE.md`, este archivo y `README.md`.

## Gobernanza de funcionalidades: todo módulo se mapea en Control (no negociable)

Decisión del usuario, 2026-10-01 — esta regla no se omite por ningún
motivo, en ninguna sesión futura (Claude o Codex).

Cualquier funcionalidad, módulo, submenú o pestaña — **existente o
nueva** — del portal de cliente o del panel admin (Ventas, Gastos,
Inventarios, Auditoría, Proveedores, Reportes y sus sub-pestañas
("Por reporte"/"Cortes"/"Eliminados"/"Estado del inventario"), Cuentas
por cobrar, Resumen financiero, Sucursales, Marca propia, Facturación,
el portal de clientes mismo, y cualquier superficie futura) DEBE quedar
activable/desactivable desde `/control`. `/control` es quien gobierna el
onboarding del cliente que compra Clarvo, su configuración inicial y
cualquier upscale futuro — ninguna funcionalidad puede quedar fuera de
ese punto único de gobierno.

**"Mapeado en Control" significa, en concreto** (patrón ya implementado
en el punto 347, Fase 0-1 — replicar exacto, nunca reinventar):
1. Columna/flag en `control_tenants.tenants` (o en el catálogo `planes`).
2. Expuesta en el SELECT de `tenantContext.js` (backend) + equivalente
   de `control`.
3. `requiereFeature()` en CADA ruta del módulo — 404, nunca 403, y
   SIEMPRE antes de `requireAdminAuth`/`requireUserAuth` (el 404 no
   puede depender de tener credenciales válidas).
4. Toggle visible en `/control` para prenderla/apagarla por tenant o
   por plan.
5. Si el módulo depende de otro (ej. Proveedores depende de Inventarios
   o Gastos), la regla de dependencia (bloqueo/cascada/auto-activación/
   advertencia/checkbox-inhabilitado) se documenta y valida con el mismo
   criterio que el catálogo ya diseñado en
   `stitch/gobierno-funcionalidades/NOTAS.md`.

**Alcance: retroactivo y obligatorio, no solo hacia adelante.** Cubre
TAMBIÉN los módulos ya existentes, no solo los nuevos — ver histórico en
`PROJECT_STATE.md` punto 348.

**Estado real al 2026-10-02 (punto 352, CERRADO)**: Ventas, Gastos,
Inventarios, Auditoría, Proveedores, Reportes (4 sub-pestañas), Cuentas
por cobrar y Resumen financiero **ya están mapeados** con los 5
elementos obligatorios de arriba — el commit `31059c7` lo implementó de
hecho aunque su mensaje decía lo contrario, desincronizando esta
documentación del código real por un día. Verificar siempre el código
(`grep -c "requiereFeature("`, columnas de `ensureSchema.js`) antes de
asumir que algo "sigue pendiente" solo porque lo dice un commit message o
este archivo — exactamente el error que originó el punto 352. Validado
con Playwright real contra Docker/MySQL reales (`admin-plan-gating.spec.ts`
+ `control-planes-wizard.spec.ts`, 5/5). Catálogo de 12 reglas de
dependencia completo en `stitch/gobierno-funcionalidades/NOTAS.md`
(referencia viva del diseño, ya implementado).

**Mismo error, variante nueva (punto 369, 2026-10-04)**: "Marca propia /
Look & Feel" (switch real del wizard de `/control`) se dio por
no-implementado porque se grepeó `marca_propia` — el nombre real es
`marcaLookfeelHabilitado` (columna `marca_lookfeel_habilitado`, punto
244, ya gatea `marca_logo_url`/`tema_json`, 1177 tests detrás). Al
buscar si un flag "ya existe", grepear el NOMBRE REAL en código, nunca
solo la frase en español de la UI.

## Reglas persistentes de coordinación

- **Playwright para pruebas funcionales y propuestas visuales** (decisión
  del usuario, 2026-10-02): toda prueba funcional se ejecuta con
  Playwright (E2E real contra Docker+MySQL reales), y toda propuesta
  visual antes/después se muestra al usuario mediante capturas de
  Playwright — nunca solo descripción en texto ni mockups estáticos.
- Después de cualquier cambio relevante de código, arquitectura,
  operación, pruebas, decisiones de producto o estado del proyecto:
  actualizar siempre `PROJECT_STATE.md`, `CLAUDE.md`, `pendientes.html` y
  este archivo antes de cerrar el trabajo. Si la sesión tiene acceso de
  escritura a Claude Mem, registrar también ahí la decisión/estado para
  que futuras sesiones de Claude y Codex se coordinen sin depender del
  historial del chat; si solo hay acceso de lectura, dejar constancia
  explícita en estos archivos.
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
- **Scripts de `prod/` horneados en la imagen**: el backend de
  producción construye desde `prod/backend` sin bind mount (solo
  `uploads` es volumen) — un cambio en `prod/backend/scripts/*` (p. ej.
  `sembrar-prod.js`) NO llega al contenedor con `./sembrar.sh` (que solo
  hace `exec` sobre la imagen ya construida): reconstruir primero
  (`prod/actualizar.sh` lo hace, o `docker compose build backend` +
  recreate) o se ejecutará el script viejo (punto 366). El flujo
  histórico no lo notaba porque `./actualizar.sh` (rebuild) corre ANTES
  de `./sembrar.sh`; además el seed es determinista (misma semilla →
  mismos datos), así que re-correr la versión vieja regenera
  exactamente los mismos datos y el síntoma es "sigue todo igual" sin
  ningún error. Chequeo en el VPS: comparar `grep -c "<marca nueva>"`
  en el archivo de disco contra el mismo grep sobre
  `/usr/src/app/scripts/sembrar-prod.js` dentro del contenedor — disco
  con matches y contenedor en 0 = falta rebuild.
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
- **Fechas "hoy/mes" por zona horaria** (punto 371, 2026-10-05): nunca
  construir la ventana local con `Date.UTC(...)` ni usar
  `toISOString().slice(0,10)`/`CURDATE()` como si fueran la fecha del
  tenant — con México en UTC−6 la ventana "hoy" se corre 6 h y **toda
  venta registrada a partir de las 18:00 desaparece de la tarjeta "Ventas
  hoy"**. Fuente de verdad: `backend/utils/limitesPeriodo.js`, con dos
  familias — `instantes.*` (Date UTC de medianoche local) para columnas
  `DATETIME` en UTC (`fecha_compra`, `creado_en`) y `fechas.*`
  (`'YYYY-MM-DD'`) para columnas `DATE` (`gastos.fecha`); elegir la
  equivocada desplaza el día o el inicio del mes. Detalle y 5 sitios
  hermanos aún sin corregir (que requieren aprobación): `PROJECT_STATE.md`
  punto 371.
- **Máximo de imagen = un solo valor global, en BD, no en env** (punto
  370, 2026-10-06): tabla `ajustes_globales` (clave/valor, en
  `control_tenants`, clave `imagen_max_mb`, default 2, rango 1-20) es la
  única fuente de verdad para producto/foto de ticket/logo de
  ticket/logo de marca/favicon. `control/utils/ajustesGlobales.js`
  lee/escribe; `backend/utils/ajustesGlobales.js` solo LEE, vía
  `obtenerPoolControl()` con caché de 45s — nunca HTTP a `control` para
  esto. `MAX_FILE_SIZE_MB` sigue viva sin tocar para subidas NO imagen
  (CSF PDF, comprobante de Gastos, factura ZIP, CSV/XLSX). **Gotcha ya
  corregido, no repetir**: el límite de `express.json()` (backend Y
  control, ambos `30mb`) debe escalar junto con `IMAGEN_MAX_MB_MAX` (hoy
  20 en `backend/utils/ajustesGlobales.js`) — un archivo de 20 MB en
  base64 pesa ~27.4 MB de texto, y sin este margen el body se rechaza
  antes de llegar a la validación de tamaño real.
- **Contraste WCAG en JS: nunca quitar el `#` al hex antes de medir
  luminancia** (punto 373, 2026-10-06): `luminancia(hex)` lee los canales
  con `hex.slice(1,3)/(3,5)/(5,7)` — asume el `#` en posición 0 (mismo
  patrón en `backend/utils/tenantTema.js`, `control/utils/tenantTema.js`
  y el nuevo `frontend/marcaTemaEditor.js`). Un `contraste(a,b)` que hace
  `a.replace('#','')` ANTES de llamar a `luminancia()` corre los índices
  un lugar y calcula un contraste distinto al real — bug real encontrado
  en `marcaTemaEditor.js`: el aviso "en vivo" marcaba inválido un par que
  sí pasaba AA. El backend nunca tuvo el bug; solo la validación
  duplicada del cliente divergió en silencio. Verificar con un par
  conocido (`#0F6E5D` vs `#ffffff` ≈ 5.8:1) o un E2E real, nunca asumir
  que copiar la fórmula de otro archivo ya la deja correcta.
- **`theme.js` es el chokepoint del frontend para comportamiento por
  tenant** (punto 374, 2026-10-06): un override de página completa (ej.
  "portal desactivado") se agrega ahí, no repetido en cada script —
  mismo principio que `requireUserAuth` en el backend. Al tocarlo:
  nunca aplicar un override de portal de cliente a `/admin` aunque
  `theme.js` también corra ahí (`RUTAS_PORTAL_CLIENTE` vs
  `RUTAS_PAGINA_MULTITENANT`, listas separadas a propósito); y verificar
  que la lista de rutas cubra TODAS las páginas que de verdad cargan el
  script — `mi-cuenta.html` ya lo cargaba pero faltaba en la lista,
  nunca pintaba tema ahí (gap preexistente, cerrado al necesitarlo
  directo). Exponer un dato antes oculto (ej. correo real de contacto)
  solo cuando el caso de uso lo necesita de verdad — condicionar la
  exposición al estado relevante, no aflojar el campo para todos.
- **Detección de "página de portal de cliente" por path: la raíz pelada
  `/` cuenta como 0 segmentos** (punto 375, 2026-10-07):
  `paginaEsPortalCliente()` en `theme.js` partía el pathname y solo
  reconocía rutas con nombre (`/login`, etc.) — nginx sirve `login.html`
  tanto en `/login` como en la raíz `/` (catch-all), pero `/` no tiene
  ningún segmento nombrado. Cualquier chequeo nuevo por path debe cubrir
  explícitamente el caso de 0 segmentos.
- **Flag de tenant vs. flag de sitio base: dos tablas distintas, nunca
  intercambiables** (punto 375): un flag de tenant vive en
  `control_tenants.tenants` (columna propia); un flag de sitio base vive
  en `configuracion_global` dentro de `configuracion`
  (`backend/utils/config.js`) — **nunca** en
  `control_tenants.ajustes_globales` (esa tabla es solo el máximo de
  imagen del punto 370). Verificar la tabla correcta antes de dar un
  estado por "limpio".
- **nginx intercepta 502/503/504 globalmente** (`error_page 502 503 504`
  → `mantenimiento.html`) — cualquier error real de la API debe responder
  **500**, nunca 502/503/504, o se disfraza de "sitio caído".
- **CSP y `blob:`/`data:`**: `default-src 'self'` NO cubre esos schemes
  para `img-src`/`frame-src` — declararlos explícitos
  (`img-src 'self' data: blob:`, `frame-src 'self' blob:`) si se usan
  imágenes/iframes con blob URLs.
- **Whitelist de extensiones estáticas en nginx**: `frontend/nginx.conf.template`
  (y su espejo `prod/frontend/nginx.conf.template`) tiene un `location`
  con regex explícito de extensiones cacheables
  (`\.(?:svg|png|jpg|jpeg|webp|woff2?)$`) — cualquier extensión nueva de
  asset que NO esté en esa lista cae al catch-all anti-enumeración de
  tenants (`return 404;`, el primer segmento del path se confunde con un
  slug) y sirve 404 plano aunque el archivo exista en el contenedor.
  Antes de dar un asset por "mal servido", revisar esta lista además de
  nginx.conf/Dockerfile/caché de navegador.
- **`ensureSchema()` corre en cada restart/deploy** — cualquier backfill o
  valor forzado debe ser CONDICIONAL (solo si el dato está en un estado
  viejo conocido), nunca incondicional, o revierte en silencio datos
  legítimos ya guardados en producción. **Esto SOLO aplica al pool base**
  — las bases `tenant_*` de tenants YA aprovisionados nunca se vuelven a
  migrar solas: `ensureSchema(poolTenant)` solo se invoca una vez, desde
  `/internal/activar-tenant/:slug`, al momento del aprovisionamiento.
  Cualquier tabla/columna nueva agregada a `ensureSchema()` no aparece en
  la base de un tenant ya existente hasta reinvocar ese endpoint con
  `X-Internal-Secret` (idempotente) — en producción real con tenants
  activos, esto es un paso de deploy obligatorio que un `docker compose
  up` normal no cubre.
- **Candado de feature-flag por tenant**: `backend/utils/requiereFeature.js`
  (punto 347) — responde **404, nunca 403**, un tenant sin el módulo se
  comporta como si la ruta no existiera (mismo criterio que la
  anti-enumeración de tenants). `server.js` NO tiene routers modulares por
  feature (son rutas sueltas en un solo archivo) — el candado se inserta
  ruta por ruta, nunca con un `app.use(prefijo, ...)` único. **Siempre
  ANTES de `requireAdminAuth`/`requireUserAuth`** en la cadena de
  middlewares, nunca después — si no, el 404 solo se ve con credenciales
  válidas, revelando que el módulo existe a quien no las tiene.
  **Backend-only no es suficiente**: el frontend también debe ocultar la
  entrada (tile/botón/campo) que llevaría ahí. Antes de dar un módulo por
  "ya gateado", revisar las 3 capas: ruta bloqueada (`requiereFeature`),
  menú/tile oculto, y cualquier formulario de alta que capture datos
  específicos de ese módulo.
  **Nunca compartir una ruta entre dos superficies con flags de gobierno
  distintos**: cada pestaña de Reportes tiene su propio flag que apaga
  esa pestaña sin tocar el módulo del que depende — si la ruta que la
  alimenta también sirve a OTRA vista (ej. un botón dentro de
  Ventas/Gastos), apagar la pestaña de Reportes rompe esa otra vista de
  encima. Caso real detectado (no corregido, fuera de alcance, punto
  361): `POST /api/admin/reportes/corte` sirve a la vez el botón "Corte
  del día" de Ventas y "Reporte por rango" de Reportes → Cortes, con
  AMBOS flags en la misma ruta. El patrón correcto (ya usado para
  "Estado de tickets", que a propósito NO reutiliza
  `GET /api/admin/tickets`) es una ruta dedicada por pestaña cuando hay
  riesgo de compartirla con otra vista.
- **Playwright: overlay/popup asíncrono que aparece en cualquier
  momento** (punto 362) — un check puntual tipo
  `if (await locator.isVisible().catch(() => false)) await locator.click()`
  solo cubre el instante en que se ejecuta; si el overlay llega por un
  fetch que resuelve después (ej. "Tickets nuevos por facturar"), puede
  aparecer entre ese check y el siguiente clic y quedar bloqueando el
  resto del test sin que nada lo vuelva a cerrar. Usar
  `page.addLocatorHandler(locator, handler)` para overlays con esta
  condición de carrera — Playwright lo descarta solo, automáticamente,
  justo antes de cualquier acción que quedaría bloqueada, sin importar
  cuándo aparezca.
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
  ocurre con tecleo real) — validar con tecleo real, nunca con
  asignación directa.
- Antes de dar por "no disponible" una skill/herramienta mencionada por
  el usuario: revisar el catálogo de skills activas, luego `D:\cc`,
  luego el repositorio oficial — nunca asumir su función.
- **Unicidad de `usuarios.email`: acotada a `perfil='cliente'`, nunca
  global** (punto 377): dos cuentas cliente nunca comparten correo, pero
  un admin (`administrador`/`fiscal`/`ventas`/`inventario`) sí puede
  compartir correo con un cliente — admin nunca usa correo para login
  (usa `rfc` como usuario). Toda query sobre `usuarios` por `email` debe
  llevar `AND perfil = 'cliente'` cuando es del lado cliente (candado de
  `PUT /api/mi-cuenta`, login `POST /api/auth/login`, desplegable de
  Ventas, check de "cliente ya registrado" en ordenes-compra) — omitirlo
  en login es grave: puede traer la fila ADMIN en vez de la CLIENTE
  (orden de MySQL no garantizado) y el cliente recibe "contraseña
  incorrecta" con su contraseña correcta (bug real, corregido en el punto
  377). Pendiente a propósito: `POST /api/auth/recuperar` sigue sin este
  filtro.
- **Tarjeta nueva en Configuraciones (`/admin`): 3 registros obligatorios
  en `frontend/admin.js`** (punto 378): el nav
  `.config-modal-nav-item[data-tarjeta="..."]` solo funciona si la
  tarjeta está en `CONFIG_SECCIONES` (si falta, el clic no hace nada —
  tarjeta oculta para siempre aunque el HTML esté perfecto),
  `GRUPOS_CONFIG_NAV` (oculta el título del grupo si ninguna hija es
  visible) y `tarjetasConfigPermitidas` por perfil en
  `RESTRICCIONES_PERFIL`. Además: una tarjeta que ES ELLA MISMA el
  interruptor de un flag nunca debe tener entrada en
  `PLAN_GATE_TARJETA_CONFIG` con ese mismo flag — se escondería a sí
  misma al apagarse, sin forma de volver a encenderla desde la UI (mismo
  motivo por el que "Portal de clientes" vive en Mi Cuenta en vez de
  dentro de `global-config-card`, punto 375).

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
  conexión ahora" en SMTP: SVG feather-like, nunca ⚡). Al homologar con
  un mockup que sí trae emojis/íconos de librería externa (Font Awesome,
  etc.), replicar la FORMA visual con los SVG propios del sitio,
  respetando el set de íconos ya en uso salvo que el usuario pida
  explícitamente cambiarlos.
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
