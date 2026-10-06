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

## Gobernanza de funcionalidades: todo módulo se mapea en Control (no negociable)

Decisión del usuario, 2026-10-01 — esta regla no se omite por ningún
motivo, en ninguna sesión futura.

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
   advertencia) se documenta y valida con el mismo criterio que el
   catálogo ya diseñado en `stitch/gobierno-funcionalidades/NOTAS.md`.

**Proveedores**: no es una superficie/app separada — vive dentro del
mismo ecosistema admin/portal de clientes (confirmado por el usuario,
2026-10-01). Si en el futuro gana una vía de acceso propia (tipo portal,
login propio), le aplica esta misma regla de mapeo en Control desde el
momento en que se construya esa vía.

**Alcance: retroactivo y obligatorio, no solo hacia adelante.** El
usuario decidió explícitamente (2026-10-01) que esta regla cubre TAMBIÉN
los módulos ya existentes, no solo los nuevos — ver histórico en
`PROJECT_STATE.md` punto 348.

**Estado real al 2026-10-02 (punto 352, CERRADO):** la deuda retroactiva
del punto 348 — Ventas, Gastos, Inventarios, Auditoría, Proveedores,
Reportes (y sus 4 sub-pestañas), Cuentas por cobrar y Resumen
financiero — **ya está mapeada en Control**, con los 5 elementos
obligatorios de arriba completos para los 8 módulos (esquema en
`control_tenants.tenants`, `tenantContext.js`, `requiereFeature()` en
106 sitios de `backend/server.js`, asistente de 4 pasos con las 11
reglas de dependencia en `frontend/control.js`, ocultamiento de
menú/tarjetas por plan en `frontend/admin.js`). Validado con Playwright
real contra Docker/MySQL reales
(`e2e/tests/admin-plan-gating.spec.ts` + `control-planes-wizard.spec.ts`,
5/5 en verde, 2026-10-02). El commit `31059c7` implementó esto de hecho
aunque su mensaje y la documentación de esa sesión decían lo contrario
("aún sin implementar") — **esta nota queda aquí precisamente para que
ninguna sesión futura repita ese desfase**: antes de asumir que algo
"sigue pendiente" por lo que dice un commit message o este archivo,
revisar el código real (`grep -c "requiereFeature("`, columnas de
`ensureSchema.js`, etc.) como se hizo en el punto 352. Catálogo de
reglas de dependencia: 12 en total (11 del asistente + regla 9 de
suspensión automática a nivel de asignación de plan) — detalle completo
en `stitch/gobierno-funcionalidades/NOTAS.md`, que se mantiene como
referencia viva del diseño aunque ya esté implementado.

**Mismo error, variante nueva (punto 369, 2026-10-04)**: una sesión dio
por no-implementado el flag "Marca propia / Look & Feel" (el switch ya
real en el wizard de planes de `/control`) porque grepeó el string
`marca_propia` — el nombre real en código es `marcaLookfeelHabilitado`
(columna `marca_lookfeel_habilitado`, punto 244, ya gatea
`marca_logo_url`/`tema_json` con endpoints reales y 1177 tests detrás).
Lección: cuando se busque si un flag de gobernanza "ya existe", `grep`
por el NOMBRE REAL en código (`grep -rn marcaLookfeel`), nunca solo por
la frase en español que usó el usuario o la UI de `/control` — el label
visible y el identificador interno no siempre coinciden.

**Ventanas "hoy/mes" en queries: nunca usar `Date.UTC` ni `toISOString()`
(punto 371, 2026-10-05)**: `limitesDia()`/`limitesMes()` construían el
día local con `Date.UTC(...)`, anclando "hoy" a medianoche **UTC** — con
México en UTC−6 la ventana se corría 6 h y **todo lo ocurrido a partir de
las 18:00 hora local quedaba fuera de la tarjeta "Ventas hoy"** (reproducido
en navegador: $0.00 tras registrar una venta). Ahora la fuente de verdad es
`backend/utils/limitesPeriodo.js`, que devuelve **dos familias y hay que
usar la correcta según el tipo de columna**:
- `instantes.*` (Date UTC de medianoche local) → columnas `DATETIME`
  guardadas en UTC (`fecha_compra`, `creado_en`).
- `fechas.*` (`'YYYY-MM-DD'` de calendario local) → columnas `DATE`
  (`gastos.fecha`). Meter un `Date` ahí desplazaría el inicio del mes.
Zona del tenant vía `ZONAS_HORARIAS_MEXICO` con **2 pasadas** (solo
`America/Tijuana` tiene DST). Atajo para no recaer: `toISOString().slice(0,10)`
y `CURDATE()`/`DATE_FORMAT(...,'%Y-%m')` con `NOW()` son **fechas UTC o del
servidor**, no del tenant. Ver `PROJECT_STATE.md` punto 371 (incluye la
lista de 5 sitios hermanos aún sin corregir, que requieren aprobación).

**Pruebas funcionales, siempre, sin excepción** (ya es piso no negociable
del protocolo `addv-web-app` global — esto solo lo precisa para este
proyecto): "funcional" significa uno de dos — (a) Playwright/E2E real
contra Docker+MySQL reales, o (b) confirmación explícita del usuario con
clics reales en navegador. Jest + supertest sobre BD mockeada (el patrón
usado en todo este repo hasta hoy) cuenta como prueba de
**integración**, nunca como sustituto del paso 8 del protocolo.

## Reglas persistentes de coordinación

- **Playwright para pruebas funcionales y propuestas visuales** (decisión
  del usuario, 2026-10-02): toda prueba funcional se ejecuta con
  Playwright (E2E real contra Docker+MySQL reales), y toda propuesta
  visual antes/después se muestra al usuario mediante capturas de
  Playwright — nunca solo descripción en texto ni mockups estáticos.
  Esto aplica a cualquier cambio de UI/UX, no solo a los segmentos
  nuevos.
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
- **Página HTML/JS nueva del frontend que da 404 aunque nginx esté bien
  configurado**: `frontend/Dockerfile` enumera cada archivo a mano en su
  `COPY` (no copia el directorio completo) — toda página nueva
  (`.html`/`.js`) debe agregarse a esa lista o nunca llega a la imagen,
  sin importar que `nginx.conf.template` y `portal.js`
  (`RUTAS_PAGINA_MULTITENANT`) estén correctos (confirmado con
  `mi-cuenta.html`, punto 353).
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
  anclar la ventana local con `Date.UTC(...)` ni usar
  `toISOString().slice(0,10)`/`CURDATE()` como si fueran la fecha del
  tenant — con México en UTC−6 la ventana "hoy" se corre 6 h y toda venta
  de las 18:00 en adelante desaparece de "Ventas hoy". Fuente de verdad:
  `backend/utils/limitesPeriodo.js` con dos familias (`instantes.*` para
  columnas `DATETIME` en UTC, `fechas.*` `'YYYY-MM-DD'` para columnas
  `DATE`); ver la nota completa arriba y `PROJECT_STATE.md` punto 371
  (incluye 5 sitios hermanos aún sin corregir, requieren aprobación).
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
  asset (ej. un formato de imagen que nunca se había usado) que NO esté
  en esa lista cae al catch-all anti-enumeración de tenants
  (`^/(?<tenant_slug>...)/.+$` → `return 404;`, el primer segmento del
  path se confunde con un slug) y sirve 404 plano en vez de la imagen,
  aunque el archivo exista en el contenedor y nginx esté bien
  configurado en todo lo demás (bug descubierto con `branding.webp`,
  punto 358 — `.webp` nunca había estado en la lista porque nunca se
  había usado ese formato en el sitio). Antes de dar un asset por "mal
  servido", revisar esta lista además de nginx.conf/Dockerfile/caché de
  navegador.
- **`ensureSchema()` corre en cada restart/deploy** — cualquier backfill o
  valor forzado debe ser CONDICIONAL (solo si el dato está en un estado
  viejo conocido), nunca incondicional, o revierte en silencio datos
  legítimos ya guardados en producción. **Esto SOLO aplica al pool base**
  (`ensureSchema()` sin argumento, server.js arranque) — las bases
  `tenant_*` de tenants YA aprovisionados **nunca** se vuelven a migrar
  solas: `ensureSchema(poolTenant)` solo se invoca una vez, desde
  `/internal/activar-tenant/:slug`, al momento del aprovisionamiento
  (confirmado dos veces — `suspendido_motivo` en Fase 6/7 del punto 350,
  y la tabla `abonos` del punto 359). Cualquier tabla/columna nueva
  agregada a `ensureSchema()` en una sesión posterior a que un tenant ya
  exista **no aparece en su base** hasta reinvocar ese mismo endpoint
  interno (idempotente, `CREATE TABLE IF NOT EXISTS`/`CREATE DATABASE IF
  NOT EXISTS` de por medio) con `X-Internal-Secret` —
  `docker compose exec backend sh -c 'node -e "require(\"http\").request({host:\"localhost\",port:4000,path:\"/internal/activar-tenant/<slug>\",method:\"POST\",headers:{\"X-Internal-Secret\":process.env.INTERNAL_CACHE_SECRET}}, r=>{let b=\"\";r.on(\"data\",d=>b+=d);r.on(\"end\",()=>console.log(r.statusCode,b));}).end()"'`
  — en local basta correrlo contra cada tenant de prueba (`t1`, etc.)
  después de tocar el esquema; **en producción real, con tenants activos
  de verdad, esto es un paso de deploy obligatorio** (reinvocar por cada
  slug, o un script de migración masiva) que `docker compose up` por sí
  solo NO cubre — no asumir que un rebuild/restart normal ya propagó un
  cambio de esquema a los tenants existentes.
- **Desincronización MySQL/`.env`**: MySQL solo aplica las credenciales
  de `.env` en la PRIMERA inicialización del volumen — editar `.env`
  después desincroniza contra el password real ya grabado. Runbook en
  memoria `project_mysql_credential_desync_prod.md`; preflight ya
  integrado en `prod/actualizar.sh`.
- **Candado de feature-flag por tenant**: `backend/utils/requiereFeature.js`
  (punto 347) — responde **404, nunca 403**, un tenant sin el módulo se
  comporta como si la ruta no existiera (mismo criterio que la
  anti-enumeración de tenants). `server.js` NO tiene routers modulares por
  feature (son rutas sueltas en un solo archivo) — el candado se inserta
  ruta por ruta, nunca con un `app.use(prefijo, ...)` único. **Siempre
  ANTES de `requireAdminAuth`/`requireUserAuth`** en la cadena de
  middlewares, nunca después — si no, el 404 solo se ve con credenciales
  válidas, revelando que el módulo existe a quien no las tiene. Portal de
  clientes se gatea en un solo punto (`requireUserAuth`, cubre todas las
  rutas de sesión de cliente de un jalón) + el endpoint de login aparte
  (nace la sesión antes de que exista `requireUserAuth` que la proteja).
  **Backend-only no es suficiente**: el 404 evita que la ruta responda,
  pero el frontend también debe ocultar la entrada (tile/botón/campo) que
  llevaría ahí — si no, el usuario ve un control que simplemente no hace
  nada al usarlo (mismo criterio que `planPermite()` ya aplica en
  `admin.js`, extendido a `dashboard.js`/`portal.js`/`login.js` en el
  punto 356). Antes de dar un módulo por "ya gateado", revisar las 3
  capas: ruta bloqueada (`requiereFeature`), menú/tile oculto, y
  cualquier formulario de alta que capture datos específicos de ese
  módulo (ver el siguiente punto, RFC/Facturación).
  **Nunca compartir una ruta entre dos superficies con flags de gobierno
  distintos**: cada pestaña de Reportes tiene su propio flag (punto
  349-350) que apaga esa pestaña sin tocar el módulo del que depende —
  si la ruta que la alimenta también sirve a OTRA vista (ej. un botón
  dentro de Ventas/Gastos), apagar la pestaña de Reportes rompe esa otra
  vista de encima. Caso real detectado (no corregido, fuera de alcance
  de la sesión que lo encontró, punto 361): `POST /api/admin/reportes/corte`
  sirve a la vez el botón "Corte del día" de Ventas y "Reporte por
  rango" de Reportes → Cortes, con AMBOS flags (`ventasHabilitado` +
  `reportesCortesHabilitado`) en la misma ruta — apagar solo "Cortes" en
  /control rompería "Corte del día" en Ventas. El patrón correcto (ya
  usado para "Estado de tickets", que a propósito NO reutiliza
  `GET /api/admin/tickets`) es una ruta dedicada por pestaña cuando hay
  riesgo de compartirla con otra vista.
- **Máximo de imagen = un solo valor global, en BD, no en env** (punto
  370, 2026-10-06): `ajustes_globales` (tabla clave/valor en
  `control_tenants`, clave `imagen_max_mb`, default 2, rango 1-20) es la
  única fuente de verdad para el tamaño máximo de producto/foto de
  ticket/logo de ticket/logo de marca/favicon — reemplazó
  `MAX_FILE_SIZE_MB`/`MAX_MARCA_LOGO_MB` para esos 5 puntos de subida.
  `control/utils/ajustesGlobales.js` lee/escribe (vive en `control/`,
  dueño del dato); `backend/utils/ajustesGlobales.js` solo LEE, vía
  `obtenerPoolControl()` con caché de 45s (mismo patrón que
  `tenantContext.js`) — nunca llamar a `control` por HTTP para esto.
  `MAX_FILE_SIZE_MB` sigue viva y sin tocar para subidas NO imagen (CSF
  PDF, comprobante de Gastos, factura ZIP, importador CSV/XLSX) — un
  cambio futuro al máximo de imagen nunca debe tocar esa variable ni esas
  rutas. **Gotcha real ya corregido, no repetir**: subir el máximo de
  imagen sin subir también el límite de `express.json()` (backend Y
  control, ambos en `30mb`) revienta en un rechazo de body silencioso
  bastante antes del límite configurado — un archivo de 20 MB en base64
  pesa ~27.4 MB de texto. Si `IMAGEN_MAX_MB_MAX` (hoy 20, en
  `backend/utils/ajustesGlobales.js`) sube alguna vez, ese límite de body
  en ambos `server.js` debe subir con él (base64 × ~1.37 + margen).
- **RFC solo si Facturación está activa**: con `facturacion_habilitada`
  apagada, ningún flujo de alta de cliente (`POST /api/auth/registro`,
  `POST /api/admin/usuarios`) pide RFC — genera un identificador interno
  con `generarIdentificadorSinFiscalUnico()` (`backend/server.js`,
  formato `SINFISCAL-<16 hex>`, nunca coincide con `isValidRFCRequerido()`
  a propósito). `usuarios.rfc` **sigue `NOT NULL`+`UNIQUE` sin tocar
  esquema** — decouplar la sesión de un RFC real tocaría 19+ usos de
  `req.userRfc` (folio de tickets, "Solicitar aclaraciones", Mi Cuenta),
  mucho más riesgo que generar un valor interno. **Cualquier pantalla que
  muestre "RFC" a un humano debe filtrar con
  `isValidRFCRequerido()`/`tieneRfcReal()` primero** — nunca mostrar el
  identificador interno tal cual (header del portal, "Solicitar
  aclaraciones", tabla de usuarios). Editar un cliente con Facturación
  apagada **conserva** el RFC/identificador que ya tenga — nunca lo
  regenera ni lo borra.
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
- **Orden de reglas CSS con la misma especificidad**: un selector sin
  media query y el MISMO selector dentro de un `@media` tienen la misma
  especificidad — gana el que aparece DESPUÉS en el archivo, sin
  importar cuál "se ve" más específico al leerlo. Bug real (punto 365):
  `.admin-movil-cta { display: inline-flex; }` vivía dentro de un
  `@media(max-width:900px)` que aparecía ANTES en `admin.css` que la
  regla base `.admin-movil-cta { display: none; }` — la base (posterior)
  ganaba siempre, botón invisible en móvil pese a `hidden=false` en el
  DOM. Al agregar un override mobile-only para una clase nueva, verificar
  que el `@media` quede DESPUÉS de la regla base en el archivo, o usar
  `grep -n` para confirmar el orden real antes de dar el CSS por bueno.
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
- **Identidad de marca Clarvo = navy/cian, verificada contra el logo real
  (no contra una variable CSS)** — decisión del usuario, 2026-10-02, no
  negociable y sin excepción por superficie. Al proponer o tocar
  CUALQUIER color de marca/acento en mockups, Artifacts o código real de
  este proyecto: la fuente de verdad es `frontend/assets/logoDark.png` /
  `logoLight.png` (leer la imagen directo, o samplear píxeles con
  PIL/similar) — nunca asumir que una variable `--color-accent` existente
  ya es correcta SIN revisar si algo la sobreescribe. Verificado por
  muestreo de píxeles del logo: navy ≈ `#011339` (familia de
  `--color-accent:#03285B`/`--color-accent-dark:#0B1320`), cian
  ≈ `#00DBFC`/`#00E1FC` (familia de `#05DBF2`).
  **Estado real verificado 2026-10-02 (corrección de un error propio de
  esta misma sesión — ver abajo): el portal de cliente YA cumple.**
  `frontend/style.css` define `--color-accent:#0F6E5D` (verde) en
  `:root`, pero **`frontend/portal.css` (`.portal-body`) y
  `frontend/auth.css` (`.auth-body`/`.auth-shell`) ya redefinen esas
  variables a navy/cian institucional** — mismo patrón de scope que usa
  `admin.css` con `.admin-body`. `dashboard.html`/`tickets.html`/
  `csf.html` llevan `<body class="portal-body">`, `login.html`/
  `restablecer.html` llevan `<body class="auth-body">` — los 5 renderizan
  correctamente en marca HOY, no es deuda pendiente. El verde `:root` de
  `style.css` es vestigial: solo se renderiza sin override en
  `mantenimiento.html` (y en el prototipo no construido
  `mi-cuenta-propuesta-visual.html`, que de todas formas ya usa navy a
  propósito). **Error propio de esta sesión, ya corregido**: una primera
  pasada documentó "todo el portal de cliente está fuera de marca" sin
  haber revisado `portal.css`/`auth.css`, solo `style.css` — quedó
  grabado así brevemente en esta sección, en la memoria de usuario
  (`feedback_paleta_admin_control_navy.md`) y en `pendientes.html`; los
  tres ya están corregidos. **Lección que sí se queda**: antes de
  calificar algo como "fuera de marca", revisar si una hoja de estilo
  posterior (`portal.css`/`auth.css`/`admin.css`) sobreescribe el token
  con scope — un `grep` de `--color-accent` en `style.css` sin revisar
  los demás `.css` del mismo elemento es una verificación incompleta, no
  una verificación. Páginas/código **nuevos** del portal de cliente deben
  seguir exactamente el mismo patrón (`class="portal-body"` +
  `<link rel="stylesheet" href="/portal.css">`), nunca inventar un scope
  nuevo ni copiar literalmente las variables `:root` de `style.css`.
  Historial completo de ambas correcciones (la de 2026-10-01 sobre
  admin/control, y la de 2026-10-02 sobre el portal de cliente) en la
  memoria `feedback_paleta_admin_control_navy.md`.
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
