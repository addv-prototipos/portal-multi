# cmem — memoria de sesión (estilo claude-mem)

Registro manual de esta conversación, en el mismo formato que usa
claude-mem (observaciones con ID/hora/tipo/título), para que quede
sincronizado en git y cualquier sesión futura (Claude o Codex/opencode)
tenga contexto sin depender del historial del chat.

Leyenda: 🎯sesión ●bugfix ◆feature ↻refactor ✓cambio ○hallazgo ⚖decisión

Formato: `ID  HORA  TIPO  TÍTULO`

## 2026-08-18 — Rediseño de login (cliente + admin)

C001 14:54 🎯 Sesión: retomar segmento "Look & Feel" (punto 105, sin
verificar) y luego pivotar a un pedido nuevo: rediseño visual del login.

C002 14:58 ⚖ Usuario pide aplicar un mock (imagen pegada) al login de
cliente Y admin, fiel a la imagen salvo: sin botón Google, sin
"Recuérdame".

C003 15:10 ○ Hallazgo: login/admin ya tienen hooks dinámicos de marca
(`theme.js` reemplaza `.brand-name`/`.brand-mark` con la marca/logo del
tenant) — cualquier rediseño tiene que respetarlos.

C004 15:15 ⚖ Decisión (confirmada con el usuario): mantener RFC como
campo de acceso del cliente (no cambiar a correo, es lógica de negocio,
no diseño). Mismo copy de marketing en el panel izquierdo de admin que
en cliente. Marca/decoración: usar ADDV real + hooks dinámicos.

C005 15:20 ⚖ Decisión: convención nueva para imágenes del proyecto — el
prompt de generación (ChatGPT) siempre incluye la ruta de guardado
dentro del texto del prompt.

C006 15:30 ◆ Primera implementación: layout split-screen (`.auth-shell`
en `frontend/auth.css`) en `login.html`/`admin.html`. Marca "CLARVO"
(placeholder inicial de la imagen pegada), paleta verde base sin tocar.

C007 15:35 ⚖ Decisión: sin enlace "¿Olvidaste tu contraseña?" — no
existe flujo de recuperación de contraseña en la app, agregarlo solo
visualmente habría quedado roto. Queda pendiente como feature aparte.

C008 16:20 ○ Usuario aporta la carpeta `stitch/` (código real
`stitch/code.html` + `stitch/DESIGN.md`, fuente de diseño autoritativa,
más detallada que el mock pegado). Marca ADDV real dos tonos, paleta
azul institucional + eléctrico, tipografía Inter/Source Serif 4 ya
usada en el proyecto.

C009 16:35 ↻ Reimplementación fiel a `stitch/code.html`: wordmark
ADD+V dos tonos, paleta azul/eléctrico escopeada SOLO a `.auth-shell`
(variables CSS locales, no toca `:root` de `style.css` — el resto del
sitio sigue verde). Gráfico decorativo hecho con SVG inline (sin
depender de imagen generada).

C010 16:50 ⚖ Usuario pide volver a la marca "CLARVO" del mock original
(no ADDV split) + reemplazar el SVG inline por una imagen PNG real
(`login-decoracion-marca.png`, generada por el usuario con el prompt
dado). Aclaración clave: "CLARVO es el diseño por defecto del plan
base; la personalización real (logo, paleta, tipografías) para el
siguiente plan es el segmento Look & Feel vía /control."

C011 17:05 ●bugfix Imagen aportada por el usuario tenía typo en el
nombre (`ogin-decoracion-marca.png`, sin la "l") y estaba en
`frontend/` directo en vez de `frontend/assets/`. Renombrada y movida.

C012 17:07 ✓ Se crea `frontend/assets/` como carpeta convencional para
imágenes del proyecto (assets nuevos van ahí, referenciados como
`/assets/<archivo>`).

C013 17:10 ●bugfix `frontend/Dockerfile` nunca copiaba `theme.js` al
build de nginx (bug preexistente del segmento 105 — el tema
personalizado nunca se hubiera cargado en un contenedor real). Se
agregó `theme.js` + `COPY assets/` al Dockerfile.

C014 17:15 ⚖ Usuario pide sustituir el bloque de texto CLARVO/"Portal
de Facturación"/"by ADDV" por una imagen `branding.png` (aportada por
el usuario en `frontend/assets/`). Se implementa como `<img>` — trade-
off documentado: esta franja específica del login pierde el reemplazo
dinámico de marca de `theme.js` (un tenant personalizado no repinta
esta imagen; sí sigue funcionando en el resto de páginas).

C015 17:12 ●bugfix Real, no exclusivo del login: en `frontend/style.css`
la regla base de inputs (`.field input[type="text"|"email"], select,
textarea`) nunca incluyó `password`/`tel`/`url`/`number`/`date` — el
campo contraseña se veía con el borde/padding por defecto del navegador
hasta que el usuario clickeaba el ícono del ojo (que cambia
`type="password"` a `type="text"`, ahí sí matcheaba la regla). Corregido
agregando los tipos faltantes al selector base; el `padding-right` que
le deja espacio al botón del ojo se separó a una regla aparte con la
misma especificidad pero DESPUÉS en el archivo (si no, el shorthand
`padding: 11px 12px` del selector base lo pisa).

C016 17:20 ✓ Documentación: `PROJECT_STATE.md` punto 106 y `CLAUDE.md`
actualizados con el detalle completo del segmento (decisiones, bugs
corregidos, qué quedó sin probar).

C017 17:25 ⚖ Usuario pide commit. Working tree tenía mezclados los
cambios de HOY (login) con cambios previos sin comitear del segmento
Look & Feel (backend/control, marcados como "sin verificar, no avanzar
sin aprobación"). Se preguntó alcance del commit; antes de resolver,
usuario informa que **opencode ya hizo el commit y el push** — todo
(login + Look & Feel) quedó en un solo commit `0d96dd7`, pusheado a
`fact` (remote `ADDVportalFact.git`, rama `master`), no a `origin`.

C018 17:28 ○ Estado git verificado: working tree limpio, rama local
`main` 4 commits por delante de `origin/main`. Remote `fact` es el
repo real de publicación (`git push fact main:master`); `origin`
(`portal-multi.git`) no es el destino de publicación — no asumirlo sin
verificar. El `master` remoto de `fact` fue reemplazado por force push
el 2026-08-18 (53 commits previos quedaron huérfanos ahí); la rama
`prototipo` del remote sigue intacta. Esto lo documentó opencode en
`PROJECT_STATE.md` punto 107 / `CLAUDE.md` / `AGENTS.md` / `README.md`.

## Pendiente (heredado de la documentación, no de esta sesión)

- Sin correr Playwright/E2E contra el stack Docker real para el login
  nuevo, ni revisión visual con la extensión Claude in Chrome (no se
  pudo conectar en ningún momento de la sesión).
- Segmento Look & Feel (punto 105) sigue sin pruebas `control/`
  (`tenantTema.test.js` solo existe en `backend/`) y sin validación
  contra Docker/MySQL/MinIO reales.
- El enlace "¿Olvidaste tu contraseña?" quedó fuera del login nuevo a
  propósito — si se quiere, es una feature aparte (flujo de
  recuperación de contraseña no existe hoy).

## 2026-08-19 — Módulo "Gastos" (S3: pruebas + documentación)

C019 10:00 ⚖ Sesión previa implementó el módulo "Gastos" (S1 backend +
S2 frontend, ver `PROJECT_STATE.md` punto 109) bajo el protocolo
`addv-web-app` con aprobación explícita del usuario. Esta sesión
completó el S3 (pruebas + docs).

C020 10:05 ✓ S3 pruebas: `backend/test/unit/gastos.test.js` (5) y
`backend/test/integration/gastos.test.js` (24, mocks de `db`,
`nodemailer` y `utils/storage`, helper `mockUsuarioAdministrativo`,
buffers PDF/ZIP reales por firma binaria).

C021 10:10 ●bugfix Real encontrado por la suite de integración: la
respuesta del GET lista usaba `por_pagina` cuando la variable local es
`porPagina` (ReferenceError → 500 en cada GET de gastos). Fix de una
línea en `backend/server.js:3919`.

C022 10:15 ✓ Se corrigió de paso la falla PREEXISTENTE de
`tema.test.js` (typo `marcaLogoUrl` vs `marcaLoGoUrl` — el servidor
devuelve `marcaLoGoUrl`, igual que espera la línea 114 del mismo test).
Documentada en el punto 108 (516/517). Suite completa: **546/546**
(32 suites), sin regresiones.

C023 10:20 ✓ Documentación actualizada: `PROJECT_STATE.md` punto 109,
`US.md` (US-066/US-067, sección nueva "Panel — Vista Gastos"),
`AGENTS.md`, `CLAUDE.md`.

C024 10:25 ○ Pendiente de validación real (misma regla que el segmento
5): flujo completo de gastos contra MySQL+MinIO reales y revisión
visual en navegador — el CHECK `chk_gastos_categoria` y la migración
de la tabla `gastos` deben confirmarse con
`backend/scripts/verificar-mysql.js`.

## 2026-08-19 — Validación real del módulo "Gastos" (Docker/MySQL/MinIO)

C025 11:00 ✓ Stack Docker arriba (backend 2h desactualizado). Se hizo
`docker compose build --no-cache backend` + `up -d` (gotcha del punto
108) y se validó el módulo Gastos contra MySQL+MinIO REALES:
`verificar-mysql.js` 256/262 (6 fallas preexistentes ajenas —
corregidas después, C029). Tabla `gastos` + CHECK `chk_gastos_categoria`
confirmados en `INFORMATION_SCHEMA`.

C026 11:05 ✓ Ciclo de vida completo por API (admin:admin vía nginx
8088): alta → lista+resumen → comprobante PDF en MinIO
(`_default/comprobantes/<uuid>.pdf`) → descarga con nombre original →
edición a sin factura BORRA el archivo de MinIO → comprobante a gasto
sin factura rechazado (400) → papelera (archivo conservado, resumen
null) → restaurar → permanente rechazado en activo (404) → papelera +
permanente borra fila y archivo. `admin_auditoria` registra todo
(actor/mecanismo/perfil/ruta/estatus/IP).

C027 11:10 ✓ Docs actualizadas: `PROJECT_STATE.md` punto 109 (sección
"Validado contra MySQL+MinIO reales"), `AGENTS.md`, `CLAUDE.md`.
Pendiente único: revisión visual de la vista Gastos en navegador
real.

## 2026-08-19 — Preparación de la revisión visual de la vista Gastos

C028 12:00 ✓ Se preparó el entorno para que el usuario pruebe la vista
Gastos en navegador real (URL `http://localhost:8088/admin`,
`admin:admin`). Gotchas descubiertos en el camino (documentados en
`PROJECT_STATE.md` punto 110): (1) `docker compose build --no-cache
frontend` + `up -d frontend` NO recreó el contenedor — siguió
sirviendo el `admin.html` viejo (la imagen nueva sí tenía el botón);
fix `docker compose up -d --force-recreate frontend`. (2) El
`--force-recreate` reseteó el mapeo a `80:80` (compose usa
`${FRONTEND_PORT:-80}`); se fijó `FRONTEND_PORT=8088` en `.env` y se
recreó. Se sembraron 3 gastos de prueba vía API real (2 activos, 1 en
papelera, uno con comprobante PDF) para que la vista no esté vacía.
Un script Playwright temporal de capturas se descartó al detectarse el
gotcha del contenedor — el usuario hará la revisión manual. Docs
actualizadas: `PROJECT_STATE.md` (punto 110), `AGENTS.md`, `CLAUDE.md`,
`README.md` (sección "Vista Gastos", tabla de perfiles con la columna
Gastos, conteo de endpoints 45→56, `FRONTEND_PORT` default 80),
`.env` (FRONTEND_PORT=8088). Pendiente: revisión visual del usuario.

## 2026-08-19 — Revisión visual aprobada — módulo Gastos cerrado

C030 13:30 ✓ El usuario revisó la vista Gastos en navegador real
(`http://localhost:8088/admin`) y la **aprobó**. Módulo Gastos cerrado:
backend + frontend + pruebas (Jest 546/546) + regresión contra MySQL
real (verificar-mysql.js 305/305) + revisión visual. Docs actualizadas
(AGENTS.md, CLAUDE.md, PROJECT_STATE punto 110).

## 2026-08-19 — Corrección de verificar-mysql.js (305/305)

C029 13:00 ✓ Las 6 fallas "preexistentes" del script de regresión eran
bugs del propio script, no del producto: 5 por `numero_compra` que no
cabía en `VARCHAR(20)` (prefijo largo `__prueba_regresion__`) y 1 por
`tipo_persona` que moría por longitud antes del CHECK. Fix: prefijo
corto `NUM_COMPRA_PRUEBA='PRGR'` + limpieza idempotente + valor
`'invalido'` para disparar el CHECK. Al destapar los bloques se
encontraron 2 fallas más ocultas: el desfase de 1s (ms vs redondeo de
MySQL; fix `setMilliseconds(0)` igual que el endpoint, punto 102) y el
test histórico de `sanitizeText()` que quedó obsoleto (el escape de "/"
ya se quitó de `validate.js`). Resultado: `verificar-mysql.js` 305/305
(2 corridas contra MySQL real, idempotente) + Jest 546/546. Backend
reconstruido (`--no-cache` + `--force-recreate`). Docs: `PROJECT_STATE`
punto 111, `AGENTS.md`, `CLAUDE.md`. Commit del módulo Gastos hecho
(`7113deb`). Pendiente: commit del fix y push a `fact`.

## 2026-08-19 — Renombrado "Orden de compra" → "Ventas"

C031 14:30 ✓ El usuario pidió cambiar el nombre de "Orden de compra" a
"Ventas" en el menú. Se analizó impacto/regresiones y se presentó
propuesta; el usuario aprobó la **Opción B (todo el texto visible)** +
"todo a 'venta'" (No. Compra → No. Venta; asunto del correo `VENTA —
OC-000001` conservando el prefijo `OC-`). Se renombró TODO el texto
visible al usuario (admin.html/admin.js, tickets.html/tickets.js,
dashboard.html, server.js correos y mensajes API, reportes.js labels
del Markdown/CSV/email) y se actualizaron los tests que asertaban el
texto viejo (`tickets.test.js` y `reportes.test.js`). NO se tocaron
identificadores (tabla `ordenes_compra`, columnas `numero_compra`/etc.,
config `ordenes_compra_habilitado`, endpoints `/api/admin/ordenes-compra`,
IDs/classes, prefijo `OC-`). Docs: PROJECT_STATE punto 112, README, US,
CLAUDE. Validación: node --check + Jest 546/546 OK; commit `a34c877`
pusheado a `fact` (`main:master`). Rebuild backend+frontend
(`--no-cache` + `--force-recreate`, 2026-08-19) verificado por HTTP:
health OK, `/admin` sirve "Ventas" sin restos de "Orden de compra", y
`/tickets` sirve "Verifica tu venta"/"No. Venta"; `FRONTEND_PORT=8088`
conservado. Pendiente: revisión visual del usuario.

## 2026-08-20 — Siembra final, auditoría OWASP, gráficas BI, rediseños

C032 13:00 ✓ Cierre de la siembra de datos de demostración en pausa
(punto 115): fix de esquema (`ensureSchema()` corrido a mano contra
`tenant_pruebaadmin`/`tenant_piloto9c`, `provisionar-tenant.js` no
sirve para tenants ya `activo`), `pruebaadmin`+`piloto9c` completados.
Bug real encontrado: `POST /api/registro` guarda `body.rfc` tal cual,
no el RFC extraído del PDF — deja `registros.rfc` NULL si no se manda
el campo explícitamente. Commit `b9fe406`.

C033 14:00 ◆ Auditoría de seguridad OWASP Top 10, sitio completo, 3
dominios en paralelo (backend/control, frontend, Docker/infra) — a
pedido explícito del usuario, autorización previa para corregir sin
esperar confirmación. Corregidos: timing attacks (`X-Internal-Secret` y
login, `crypto.timingSafeEqual`), rate limit en endpoints públicos de
búsqueda de RFC, password root de MySQL expuesto en `docker
inspect`/`top`, puertos MySQL/MinIO abiertos a `0.0.0.0`, falta
`.dockerignore` en `control/`, falta `no-new-privileges`, mockup con
CDN externo expuesto en el build público del frontend. Pendiente sin
corregir: `nodemailer@6.10.1` vulnerable (requiere SMTP real para
migrar con confianza — ver [[project_smtp_pruebas_reales]] en la
memoria de Claude Code). Bug real de paso: typo `marcaLoGoUrl` rompía
`POST /api/admin/ordenes-compra` con 500 en tenants con logo. Commit
`b9fe406` (mismo commit que C032, ambos segmentos se hicieron juntos).

C034 15:00 ◆ Gráficas de Business Intelligence en "Resumen financiero":
análisis → propuesta en markdown → aprobación explícita del usuario
("sí, adelante con las 5, mes actual") → implementación. 5 gráficas:
distribución de gastos por categoría, ventas facturadas vs sin
facturar, balance acumulado, proyección de ventas (mínimo 3 meses
reales), top 5 proveedores de gasto. `GET /api/admin/resumen-financiero`
extendido. Jest 552/552. Validado en navegador real. Commit `d0b0ada`.

C035 16:00 ✓ Rediseño de paleta: la paleta original de las donas era
arcoíris (10 colores sin relación con la marca) — el usuario reportó
"tanto color y las letras negras rompen la identidad". Investigado: el
texto de la leyenda SIEMPRE fue gris neutro (verificado en navegador
limpio) — el efecto de texto coloreado del lado del usuario no era un
bug de esta vista. Corregido lo real: paleta reemplazada por rampa
navy/verde/terracota de la marca, luego suavizada a pastel a pedido de
seguimiento del usuario. Commit `3289675`.

C036 17:00 ↻ Rediseño de layout + modal de detalle: el usuario reportó
"se ve desperdiciado mucho espacio". Causa raíz real: `flex:1` en una
sola columna de la barra mensual estirándose a ~900px vacíos.
Corregido + donas reordenadas lado a lado (antes apiladas con hueco
enorme label↔monto) + tarjetas dispersas (Balance/Proyección)
reagrupadas juntas en vez de cada una emparejada con una dona densa +
"Top proveedores" topado a 640px (el usuario reportó "está muy largo
este elemento"). Nueva funcionalidad pedida: botón "expandir" en las 6
tarjetas abre un modal grande reubicando el contenido ya renderizado
(mismo elemento del DOM, sin duplicar lógica de render). Bug real
encontrado en la validación: excepción JS rompía toda la vista por un
desfase de caché del navegador (HTML viejo servido contra JS nuevo) —
mismo gotcha de siempre, manifestación nueva (excepción, no vista
vieja). `Ctrl+Shift+R` lo resolvió. Commit `1fd0dbd`.

C037 18:00 ⚖ **PROPUESTA PENDIENTE — NO implementada a propósito.**
Usuario pidió tarjeta nueva con gráfico: total vendido SIN importar si
está facturado, IVA cobrado en esas ventas, y utilidad neta comparada
contra gastos — pero pidió analizar y documentar primero, sin
ejecutar (protocolo `addv-web-app`, detenido después de "proponer").
Corrige dos huecos reales del KPI "Balance ventas vs gastos" existente
(Facturado−Gastos): (1) solo cuenta ventas ya facturadas, (2) no
separa el IVA antes de restar gastos. Datos ya existen sin tocar
esquema (`ordenes_compra.cantidad`/`iva_porcentaje`/`total`, por fila).
Cálculo: `utilidad_neta = SUM(cantidad) de TODAS las ventas del mes −
gastos_del_mes` (neto de IVA, no `SUM(total)`). Límite honesto: no hay
IVA de gastos desglosado en el esquema (solo booleano), así que es
"IVA cobrado en ventas", no una cifra fiscal. Nombre propuesto (a
confirmar, para no confundir con el KPI existente): "Utilidad neta del
mes (ventas totales vs gastos)". Visual: barra apilada Subtotal+IVA vs
barra Gastos, mismo patrón que "Ventas vs Facturado vs Gastos",
full-width, justo después de los 4 KPIs. Detalle completo en
`PROJECT_STATE.md` punto 118 y `CLAUDE.md`. **Nota sobre esta
entrada**: el usuario pidió guardar la propuesta en Claude Mem
("cmem") — esta sesión solo tuvo herramientas de LECTURA de Claude Mem
disponibles (`mcp__plugin_claude-mem_mcp-search__*`), ninguna de
escritura/registro manual, así que esta entrada en `cmem.md` (el
registro manual en git, no el Claude Mem real) es el sustituto
acordado — si una sesión futura sí tiene acceso de escritura al Claude
 Mem real, debería registrar esta decisión ahí también antes de
implementar. No tocar código sin aprobación explícita del usuario.

C038 ◆ **Tarjeta "Utilidad neta del mes (ventas totales vs gastos)"
IMPLEMENTADA** (continuación de C037, mismo día): el usuario confirmó el
nombre propuesto y dio luz verde ("Sí, implementa todo el segmento").
Backend: `GET /api/admin/resumen-financiero` extendido — el query KPI de
ventas ahora suma también `SUM(o.cantidad) AS subtotal` (sin join a
tickets, una sola consulta) y `mes_actual` devuelve `subtotal_ventas`/
`iva_ventas`/`utilidad_neta` (redondeo a 2 decimales); `total_vendido`
no se duplica porque ya es `mes_actual.ventas`. Frontend: tarjeta
full-width tras los 4 KPIs — número grande verde/rojo, nota visible del
límite honesto ("IVA cobrado en ventas, no cifra fiscal"), barras
apiladas CSS puro (Subtotal #719FD4 + IVA #C0D3EB vs Gastos gris, ancho
fijo 48px, lección del punto 117), leyenda de 4 filas, empty state,
modal de detalle vía mecanismo genérico `data-detalle-contenido`.
Tests: mocks con `subtotal`, aserciones nuevas (utilidad 2800 ≠ balance
1800 demuestra que cuenta ventas sin facturar; solo-gastos → −500).
`node --check` limpio, Jest **552/552 (33 suites)**, resumen financiero
6/6. Sin cambios de esquema. Rebuild backend+frontend (`--no-cache` +
`--force-recreate`, lección del punto 109) verificado por HTTP: health
OK, HTML nuevo servido y API validada contra MySQL real (utilidad
−12,879.46 ≠ balance −37,308.46 con los datos sembrados). Pendiente
solo revisión visual del usuario (`http://localhost:8088/admin`).
Esta sesión siguió
con solo lectura de Claude Mem — registro vivo en PROJECT_STATE.md punto
118, CLAUDE.md y AGENTS.md.

### C039 — Modo dashboard personalizable en Resumen financiero (2026-08-20)
IMPLEMENTADO Y VALIDADO contra Docker/MySQL reales. Usuario pidió
reordenar/redimensionar tarjetas con layout por perfil restaurándose en
cada ingreso; propuesta + cuestionario (solo esta vista, persistencia
servidor, guardado automático) + confirmación explícita. Vanilla sin
librerías: 11 elementos hijos directos de un tablero CSS Grid de 12
columnas (`#resumen-fin-tablero`, `data-dashboard-id`); el drag NUNCA
mueve nodos del DOM (solo `style.order`/`style.gridColumn`, visual con
`transform`) para no romper `abrirDetalleGrafica()`; teclado completo
(↑/↓ posición, ←/→ ancho, Esc). Backend: tabla `preferencias_dashboard`
(UNIQUE usuario+vista, JSON, SIN FK a usuarios — cuentas super no están
ahí) + GET/PUT/DELETE `/api/admin/preferencias-dashboard/:vista`
(whitelist cerrada de IDs, span 3..12, rechazo en bloque, upsert,
normalización de layouts viejos); auditoría vía middleware global.
Guardado automático debounce 800ms + toast; "Restablecer" solo con layout
guardado; <900px ignora ancho custom conservando orden. Jest **560/560
(34 suites)**. Validado: rebuild + health OK + HTML nuevo (11 IDs) +
tabla real + ciclo API completo (null→PUT→GET→400s→404→401→DELETE) +
auditoría automática. Pendiente revisión visual del usuario
(`http://localhost:8088/admin`). Detalle completo: PROJECT_STATE.md punto
119. Claude Mem: sesión con solo lectura — registro en
PROJECT_STATE.md/CLAUDE.md/AGENTS.md/cmem.md.

## 2026-08-21 — Auditoría de docs, fixes de Resumen financiero, Reportes (auditoría B/C/D) y rediseño de Ventas (aprobado, pendiente)

C040 13:33 ○ Usuario pidió "revisa la documentación" — auditoría de
consistencia de CLAUDE.md/PROJECT_STATE.md/README.md vía agente en
paralelo. Hallazgos: título del README (línea 1) sigue sin mencionar
multi-tenant aunque el contenido sí lo cubre; README no documentaba 3
features ya hechas (Utilidad neta punto 118, gráficas BI punto 117,
Look & Feel punto 105); `FRONTEND_PORT` documentado con 3 valores
distintos (80 tabla / 8080 ejemplos / 8088 real); sección "Pendiente"
de PROJECT_STATE.md contradecía puntos posteriores del mismo archivo
(marca y `/control` en navegador ya hechos, listados como pendientes).
Ningún comando/script roto. Documentado (punto 120), sin corregir
todavía a esa hora — corregido después (C041, título+puertos README).

C041 14:35 ●bugfix Bug real en "Resumen financiero" reportado por el
usuario con captura: barra "Gastos" desalineada en "Utilidad neta del
mes". Causa raíz: `.resumen-fin-chart-body` usaba
`align-items:flex-end` — alineaba el fondo de la COLUMNA completa
(barra+etiqueta), no el de la barra; una etiqueta de 2 líneas ("Ventas
totales") corría la columna vecina de 1 línea ("Gastos") hacia abajo.
Fix de 1 línea (`flex-start`, la caja de la barra siempre es 200px fija
en ambas). De paso: 4ta barra "Sin facturar" en "Ventas vs Facturado vs
Gastos" (dato derivado en cliente, sin backend nuevo; color `#E4A97E`
REUTILIZADO de la dona vecina, validado con el script de la skill
`dataviz`). 3 rondas de ajuste en vivo pedidas por el usuario viendo
capturas: Gastos movido junto a Ventas, gráfica alineada al fondo de la
tarjeta (`margin-top:auto` en `#resumen-fin-chart-contenido`, id único).
Jest 560/560. Commits `bf9a9f6`→`f7b26d4` (incluye también el fix de
README de C040 y limpieza de `stitch/` que hizo el usuario mismo).
Detalle: PROJECT_STATE.md puntos 120-121.

C042 15:00 ◆ Rediseño de "Lectura de reportes" para auditorías —
protocolo completo (análisis del modelo de datos real → propuesta con
4 puntos base + 4 ideas opcionales A-D en markdown → usuario aprobó
base+A). Hallazgo clave: `reporte_items.accion` YA distinguía
'eliminado' (borrado real) de NULL (fotografía activa) pero se
mostraba mezclado en un badge dentro de una sola tabla. Implementado:
cabecera "Detalle" (antes "Estatus"), 2 tablas separadas
("Movimientos"/"Eliminados", export CSV/Excel propio cada una,
`accion=activo|eliminado` nuevo en `/items`/`/exportar`), botón
"Eliminar reporte" reforzado en frontend a solo admin/super (backend
ya lo exigía), KPIs de auditoría (idea A: histórico + tendencia
mensual, endpoint nuevo `/reportes/estadisticas`, tarjetas cuadradas
230×230px tras 3 rondas de ajuste en vivo del usuario — texto+número
+40%, luego -30%, título fijo arriba-izquierda, resto centrado en
espacio sobrante). Bug real: `.map(renderFilaReporteItem)` pasaba el
índice del array como 2do argumento (columna de más en Movimientos) —
corregido antes de probar. Jest 560/560. Ajustes post-push pedidos por
el usuario: "Configuraciones globales" fijado al final del sidebar
(ancla permanente), número centrado (no todo el contenido) en KPIs de
Inicio y Resumen financiero. Commits `fa0906e`. **Regla nueva del
usuario, guardada en memoria persistente de Claude Code**: todo cambio
de diseño visual (nuevo o ajuste) siempre lleva propuesta antes/después
en markdown antes de implementar, sin que se pida cada vez. Detalle:
PROJECT_STATE.md punto 122.

C043 16:30 ◆ Ideas B+C+D de Reportes, las 3 implementadas en orden a
pedido del usuario ("comienza con todos en orden"), cada una con
propuesta antes/después + skills/justificación antes de implementar.
**B** — pestaña "Todo lo eliminado": ledger cruzado de TODOS los
reportes, columna "Reporte de origen", export propio (`/reportes/
eliminados`, `/reportes/eliminados-exportar` — ruta con guión a
propósito para no competir en forma con `/reportes/:id/exportar`).
**C** — "Generado por" en el resumen: cruza `admin_auditoria`
(segmento 7, `control_tenants`) por ruta (`POST /reportes/enviar` o
`DELETE /ordenes-compra/:id`) + ventana de 5s contra
`fecha_generacion`, mejor esfuerzo, nunca bloquea sin match
(`/reportes/:id/generado-por`). **D** — botón "Ver historial" por
identificador: modal con la línea de tiempo completa de ese folio/No.
venta en todos los reportes (`/reportes/timeline/:tipo/:identificador`).
2 bugs reales encontrados y corregidos en la validación: el mismo bug
de índice-como-argumento reapareció en la tabla Movimientos al
extenderse la función para aceptar el flag de origen (corregido), y el
modal de historial desbordaba horizontalmente con descripciones largas
(faltaba `flex:1;min-width:0` en `.reportes-timeline-detalle`). Sin
cambios de esquema en ninguna de las 3. Jest 560/560 en todo el
segmento. Commit `15de641`, push a `fact`. Con esto, las 4 ideas
propuestas para Reportes quedan completas (A ya estaba de C042, ahora
B+C+D). Detalle: PROJECT_STATE.md puntos 123-125.

C044 18:45 ⚖ **PROPUESTA APROBADA, NO IMPLEMENTADA A PROPÓSITO** —
rediseño de la vista "Ventas", mobile-first. Usuario pidió explícitamente
documentar todo antes de implementar por si se acababan los créditos de
la sesión. Recorrido largo de decisión: (1) usuario pidió rediseño
mobile-first para registrar ventas desde el celular → análisis del
estado real (más rico de lo documentado en README: hay un builder de
productos individuales que componen el concepto final, toggle tipo de
cliente registrado/nuevo — no solo un campo de texto simple) →
propuesta de 3 alternativas (wizard móvil / acordeón / hoja modal) →
usuario aprobó **A** (wizard de 3 pasos SOLO en móvil <900px, reusa el
patrón de csf.html, desktop sin cambios). (2) Usuario pidió ADEMÁS
rediseñar la versión de escritorio, porque el layout actual (formulario
sticky al lado de la tabla) "se le hace incómodo" — su idea: formulario
a botón+modal (como "Gestionar" de Tickets) y tabla a ancho completo
con filtros (concepto/fechas/rango de total). Se le hizo una crítica
constructiva pedida explícitamente ("cuestiona mi diseño, critícalo"):
el modal tal cual rompería el flujo actual de "registrar varias ventas
seguidas sin volver a subir" (documentado así en el README) — se
propuso que el modal NO se cierre solo al guardar, se limpie y quede
abierto listo para la siguiente venta. Esto además UNIFICA el punto 1 y
2: un solo modal para las 2 plataformas — en escritorio se ve como
formulario normal (reusa `.ticket-modal`, 820px); en móvil el MISMO
modal se vuelve pantalla completa y adentro se activa el wizard de 3
pasos de (1). Usuario aprobó. (3) Usuario pidió un ajuste más: el toast
de confirmación "muchas veces no se nota" — pidió una confirmación
INLINE dentro del modal: palomita animada (trazo SVG) en **cyan de
marca `#05DBF2`** (el mismo cyan del ítem activo del sidebar,
reutilizado — no inventado) + "Guardado con éxito", ~1.3s total,
`prefers-reduced-motion` respetado (palomita ya completa sin animar,
mismo criterio que `mantenimiento.html`). Propuesta visual mostrada,
usuario aprobó todo el conjunto. Filtros de la tabla (concepto/fechas/
total): 100% client-side, `GET /ordenes-compra` ya trae todo sin
paginar — sin cambios de backend. **Nada de esto está implementado —
es la especificación completa aprobada**, documentada en
PROJECT_STATE.md punto 126 (detalle línea por línea, incluyendo
checklist de "cero funcionalidad perdida") y CLAUDE.md, para que
cualquier sesión futura la implemente sin rederivar el diseño. 4 ideas
de funcionalidad nueva OFRECIDAS y SIN decidir (productos frecuentes,
buscador de cliente por nombre/RFC, compartir por WhatsApp, borrador
local `localStorage`) — preguntar antes de tocar cualquiera si se
retoma esta sesión. Sin commit — es solo documentación, no hay código
que commitear todavía. Esta sesión siguió con solo herramientas de
LECTURA de Claude Mem — este registro en `cmem.md` es el sustituto
acordado (mismo criterio que C037).

C045 09:15 ◆ Parte web del rediseño de "Ventas" (C044), IMPLEMENTADA Y
VALIDADA. Formulario de sticky-lateral a modal (`#orden-registrar-
modal-overlay`, reusa `.ticket-modal`) + botón "+ Registrar venta",
tabla a ancho completo con filtros nuevos 100% client-side (concepto/
fechas/total, `ordenesCache` + `aplicarFiltrosOrdenes()`, sin cambios
de backend), palomita animada cyan `#05DBF2` en vez de toast al
guardar (modal se queda abierto, se limpia solo). Jest 560/560,
validado en navegador real: 2 ventas de prueba registradas de punta a
punta con IVA correcto, filtros confirmados con datos reales, toast
confirmado ausente, cero errores de consola. Falta el wizard móvil de
3 pasos (punto 2 de C044) — sin commit/push, se cierra junto con esa
parte. Detalle: PROJECT_STATE.md punto 126 (subsección "Parte web").

C046 09:40 ◆ Menú de navegación móvil del panel admin, rediseñado e
IMPLEMENTADO. Usuario reportó que el menú no funcionaba en celular (fila
horizontal con scroll, tap targets bajo 44px) y propuso una grilla
simétrica de botones cuadrados con íconos en el home. Se cuestionó la
propuesta antes de implementar: usar "Inicio" como botón de regreso no
sirve porque el perfil `administrador` no tiene esa vista — se propuso
en su lugar un botón neutral **"Menú"** en la barra superior que
siempre reabre la grilla completa, sin importar el perfil. Usuario
aprobó ("si por favor"). Botón `#btn-menu-movil` + grilla
`#admin-menu-movil` (9 tarjetas, mismas vistas/íconos del sidebar,
ocultas/mostradas en espejo exacto de `RESTRICCIONES_PERFIL`);
`.admin-sidebar-nav` (la fila vieja) reemplazada por completo en móvil.
Jest 560/560, `node --check` limpio. Validado en navegador real con un
viewport móvil genuino de 390×844 simulado vía `<style>` temporal
inyectado (el iframe se descartó porque las cabeceras `frame-ancestors`/
`X-Frame-Options` del punto 116 lo bloquearon — confirma que ese
endurecimiento de seguridad funciona): grilla correcta, navegación
oculta la grilla, "Menú" la reabre desde cualquier vista, cero errores
de consola. Sin commit/push todavía. Detalle: PROJECT_STATE.md punto
127.

C047 10:20 ● Fix de overflow/desalineación en móvil — Resumen
financiero, Inicio, Gastos (KPIs a 1 columna en vez de 2 entre
480-900px, que recortaba números largos) + filtros de Gastos
(`.gastos-filtros` pasa de `flex-wrap` a apilado 100% ancho, mismo
patrón que Ventas/Reportes). Cero cambios en escritorio. Jest 560/560,
validado en navegador real. Gotcha documentado: angostar solo
`body{max-width}` no dispara los `@media` reales — hay que replicar
las reglas del breakpoint manualmente en el arnés de prueba. Sin
commit/push todavía. Detalle: PROJECT_STATE.md punto 128.

C048 10:45 ◆ Wizard móvil de Ventas COMPLETO (cierra el punto 2
pendiente de C044/C045) — 3 pasos (Cliente→Productos→Confirmar en ese
momento), reusa `.steps` de csf.html. De paso, a pedido del usuario,
se ocultaron Fecha/IVA/Cantidad(MXN) del formulario (auto-calculados,
redundantes con la tabla) en escritorio Y móvil, sustituidos por un
mini-resumen "Subtotal · IVA" junto al Total. Jest 560/560, validado
en navegador real ambos tamaños con guardado real contra la API
(escritorio $232, móvil $522, ambos correctos). Segmento "Rediseño de
Ventas" (C044) queda 100% completo. Sin commit/push todavía. Detalle:
PROJECT_STATE.md punto 129.

C049 20:35 ◆ Correo opcional + método de entrega (correo/imprimir) +
ticket de impresión en Ventas. Único cambio de esquema:
`ordenes_compra.email` de NOT NULL a NULL. Wizard reordenado a
Productos→Confirmar→Entrega (correo hasta el final, junto al toggle
correo/imprimir — imprimir oculta Tipo de cliente+Correo). Ticket
reusa el parser de productos ya existente, imprime la MISMA página vía
`@media print` (no ventana nueva — se bloquea seguido tras un fetch
async). Disponible desde 3 entradas: automático al guardar, ícono de
fila, botón en "Ver venta". Modal nuevo "Asignar correo" para ventas
sin correo, con aviso de si tiene constancia. De paso, mensaje suelto
del usuario: también se ocultó "Concepto de venta" (repetía la tabla
de productos). Pruebas nuevas `ordenes-compra.test.js` (no había
cobertura antes), 7 casos. Jest 567/567. Validado contra Docker/MySQL
reales y en navegador real ambos tamaños (`window.print` interceptado
para no bloquear la automatización, confirmado que se dispara con el
ticket correcto). Sin commit/push todavía. Detalle: PROJECT_STATE.md
punto 130.

C050 21:15 ● Fix de la lista de productos capturados en el wizard de
Ventas, solo móvil. Usuario: "sale desacomodado" debajo de "+ Agregar
producto". Causa: la tabla ya tenía `.admin-table` así que se apilaba
sola por debajo de 760px, pero sin `data-label` en sus `<td>` — se
apilaba SIN etiquetas (5 valores sueltos). Fix solo móvil: tarjeta
compacta de 2 líneas que reusa tal cual el texto de
`textoProductoOrden()`, escritorio sin cambios. Gotcha de metodología:
el primer intento de reproducir el bug dio falso negativo — el arnés
de prueba solo mirroreaba el breakpoint de 900px, la tabla usa 760px
(distinto, no estaba replicado). Jest 567/567, validado en navegador
real. Sin commit/push todavía. Detalle: PROJECT_STATE.md punto 131.

C051 21:50 ⚖ Modo fuera de línea para Ventas/Gastos — DISEÑO APROBADO,
NADA IMPLEMENTADO. Usuario pidió instalabilidad PWA primero → CANCELADA
explícitamente antes de tocar código ("cancela el requerimiento y borra
la petición"). Pidió en su lugar offline con sync al reconectar +
"máxima seguridad/cifrado" + franja roja/verde. Petición original
inviable tal cual: folios AUTO_INCREMENT, validación fiscal en vivo,
login que necesita BD, riesgo de pérdida silenciosa subiendo archivos
offline, "cifrado en el navegador" que no protege nada si la llave
también vive ahí (de paso, documentado que el panel admin ya guarda
usuario:contraseña en sessionStorage en base64 — preexistente, no de
este segmento). 3 rondas de crítica/refinamiento del usuario hasta un
alcance realista: SOLO Ventas y Gastos, sin archivos, sin login
offline. Folio se asigna al sincronizar (orden real de llegada); correo
no necesita cola nueva (ya vive dentro del guardado real); archivos no
aplican (comprobante ya es acción separada); Ventas difiere la
validación de constancia al sync (si falla se corrige a mano). Usuario
confirmó: imprimir deshabilitado sin conexión (correo sí), sync 100%
automático al reconectar, tablas en solo lectura sin conexión.
Documentado en US.md (US-073/074/075) y PROJECT_STATE.md punto 132.
Implementación queda para después, a pedido explícito del usuario.

C052 14:45 ◆ Modo fuera de línea para Ventas/Gastos — IMPLEMENTADO Y
VALIDADO (a pedido explícito: "comienza a aplicar los cambios"). 100%
frontend, sin cambios de backend. `frontend/offline.js` nuevo (genérico):
IndexedDB (cola pendientes_ordenes/gastos), detección de conexión real
(ping a /api/health, no solo el evento `online` del navegador — evita
falso positivo de wifi sin internet), reintento cada 10s si sigue
offline. Franja `#conexion-banner` roja/verde con fade-out. Ventas:
`btnRegistrarOrden` encola si offline, "Imprimir ticket" se deshabilita
solo (folio real no existe todavía); filas pendientes con total estimado
mezcladas arriba de la lista real. Gastos: mismo patrón, solo intercepta
CREAR (no editar), comprobante se avisa que se adjunta después. Sync por
tipo en orden de creación, un fallo no detiene a los demás (error real
del backend mostrado, botones Reintentar/Descartar). Logout con cola
pendiente pide confirmación antes de limpiar. Agregado al Dockerfile
(mismo gotcha del punto 106). Jest 567/567. Validado en navegador real
de punta a punta simulando online/offline reales (no mock superficial):
online sin regresión, offline (banner, imprimir deshabilitado, venta+
gasto encolados correctos), reconexión (sync automático, folio/id real
confirmado por API), camino de falla (Reintentar/Descartar funcionando),
mismo recorrido en móvil 390×844. Bug chico encontrado y corregido:
botones se envolvían en 2 líneas (white-space:nowrap). Limitación
aceptada a propósito: la caché de lectura offline es solo en memoria de
la pestaña (la cola de pendientes sí sobrevive un reload, vive en
IndexedDB). Detalle: PROJECT_STATE.md punto 132 (subsección
"IMPLEMENTACIÓN"), US.md US-073/074/075 marcadas IMPLEMENTADA. Sin
commit/push todavía.

C053 15:05 ◆ Rediseño del ticket de correo de Ventas con la marca
CLARVO — IMPLEMENTADO Y VALIDADO. Propuesta visual primero (Artifact
con antes/después renderizado + tabla de cambios), aprobada con
"excelente trabajo, si aplícalo". Logo: sin logo de tenant y marca por
defecto → logo real de CLARVO (`/assets/branding.png`) en vez de caja
de texto verde; tenant con su propia marca sigue viendo su texto.
Paleta verde/beige → navy `#03285B` + cian `#05DBF2` (mismos tokens del
login/panel, no inventados), franja degradada navy→azul→cian arriba de
la tarjeta (mismo degradado del isotipo real), fondo suave navy detrás
del TOTAL. Pie de página "CLARVO by ADDV" cuando la marca es la de por
defecto. Sin cambios de estructura. Jest 567/567. Validado con la
salida REAL de la función (extraída y renderizada en un Artifact
aparte) y con un envío SMTP real (este entorno ya tiene SMTP
configurado — venta de prueba registrada, correo enviado sin errores).
Detalle: PROJECT_STATE.md punto 133. Sin commit/push todavía.

C054 15:25 ● Corrección el mismo día: el logo SÍ llegó roto en el
correo real ("sale rota la imagen"). Causa: `detectarUrlPortal()` arma
la URL del logo desde el header Host de la petición — todas las
pruebas de la sesión pegaron con `localhost:8088`, URL que nadie fuera
de esta máquina puede resolver. Mismo punto ciego preexistente del
logo de tenant, nunca antes probado contra un correo real. Usuario
eligió explícitamente "incrustado" sobre "solo URL" al preguntarle.
Fix: el logo de CLARVO por defecto ahora viaja DENTRO del correo como
adjunto CID en vez de un <img src=URL> — funciona sin importar si el
servidor es alcanzable públicamente. Copia nueva del PNG en
backend/assets/ (backend no comparte filesystem con el contenedor
frontend), cacheada en memoria. Logo de tenant sin tocar. Verificado
dentro del contenedor real (PNG correcto, MIME real renderizado con
nodemailer streamTransport confirma Content-ID/Content-Type
correctos) y CONFIRMADO por el usuario contra un correo real de
verdad ("ya llegó bien"). Jest 567/567. Detalle: PROJECT_STATE.md
punto 133 (subsección "CORRECCIÓN").

C055 08:52 ● Sidebar de /admin se perdía en scroll largo + "Cerrar
sesión" a veces invisible: `.admin-sidebar` se estiraba al alto de
`.admin-content` en vez de quedar acotado al viewport. Sticky no
bastó (usuario lo probó, se seguía perdiendo) → `position:fixed;
height:100vh` (sticky solo en móvil <900px, ahí es barra horizontal).
Cifras de "Utilidad neta mensual"/"Proyección de ventas" se encimaban
en meses consecutivos que suben/bajan juntos (alternar por paridad de
índice solo resuelve zigzag) → `calcularEtiquetasLejos()` nueva:
compara ancho de texto estimado contra espacio real entre puntos,
aleja la cifra solo si hace falta. INCIDENTE: otra herramienta
(claude-flow/ruflo) corriendo en paralelo sobre el mismo directorio
desplegó `admin.js` a medio editar de este lado (llamada sin el 2do
parámetro de la función nueva) → TypeError al abrir Resumen
financiero → todo lo que rendereaba después en la misma cadena
quedaba en blanco (Proyección, donas, top proveedores) → catch
genérico lo etiquetó mal como "No se pudo conectar con el servidor"
(era JS roto, no red — confirmado con curl + logs backend/nginx 24h
limpios). Corregido completando el wire-up + redeploy; 0 excepciones
tras recorrer las 9 vistas con listener de error + reload real.
Auditoría de lo que la otra herramienta cambió (a pedido del usuario):
commit `7b7abba` ya en main con Swagger + credenciales API por tenant
— 2 hallazgos sin corregir (API key aceptada por `?api_key=` en URL,
CSP con unsafe-inline/unsafe-eval en rutas de Swagger, acotado). CxC
(punto 138) sigue sin commitear pese a decir "no implementar sin
confirmación" en su propia documentación — anotado para quien retome.
Jest 584/584 (sin cambios backend). Detalle: PROJECT_STATE.md punto
140.

C056 09:14 ● Usuario mandó captura mostrando que el fix de C055 no
bastó: "$264.6k" seguía cortándose a "$26" en Proyección de ventas.
Causa: primer/último punto usan text-anchor distinto (start/end vs
middle), el cálculo de colisión por ancho de texto no los medía igual.
Abandoné calcularEtiquetasLejos() por completo → etiquetado selectivo
(calcularIndicesClave): solo primero/último(+último real si hay
proyección)/máximo/mínimo llevan cifra, máximo 4-5 por tarjeta pase lo
que pase con la serie; el resto son puntos discretos
(punto-fantasma, gris semi-transparente) con su valor por hover nativo
(title, ya existía). Propuesta visual con Artifact (antes/después
reproduciendo el bug exacto de la captura) aprobada ("me agrada tu
propuesta... aplícala") antes de tocar código. Elimina la clase de bug
entera, no un caso puntual. Validado en navegador real, tarjeta normal
y modal expandido, ambas limpias. Jest 584/584. Detalle:
PROJECT_STATE.md punto 140 (subsección "Rediseño final").

C057 09:31 ✓ Commit f1b395a → fact/master: sidebar fijo + cifras
selectivas (C055/C056) + trabajo en curso de la otra herramienta
(Swagger, credenciales API por tenant, inicio de CxC). Borrado
e2e/tests/temp-resumen2.spec.ts (script de depuración suelto, sin
relación con ningún segmento documentado, quedó fuera del commit
original a propósito y luego el usuario pidió borrarlo).

C058 09:42 ●bugfix Corregido hallazgo #1 del audit de seguridad (C055):
`?api_key=` por query string ya no se acepta como mecanismo de auth
(quedaba expuesta en logs de acceso/historial del navegador/Referer).
Quitado de las 2 capas de `requireAdminAuth()` en `backend/utils/
auth.js` que lo leían. También limpiado de lo que se le enseña al
usuario: descripción del esquema `apiKey` en `backend/utils/
swagger.js` ahora dice explícitamente que NO se acepta por query
string, y el ejemplo `curl ?api_key=` que el modal "Credenciales API"
de `/control` mostraba (`frontend/control.js`) se quitó — solo header
y cookie de aquí en adelante. Sin tests que cubrieran esto antes (cero
regresión posible). Jest 584/584, `node --check` limpio en los 3
archivos, rebuild+redeploy de backend/control/frontend contra Docker
real, health OK. Hallazgo #2 (CSP unsafe-inline/unsafe-eval en rutas
de Swagger) sigue pendiente, sin tocar. Detalle: PROJECT_STATE.md
punto 140.

C059 10:05 ●bugfix Corregido hallazgo #2 del audit de seguridad (C055):
CSP de /api/docs y /api/control/docs traía 'unsafe-inline' 'unsafe-eval'
en script-src sin necesitarlo. Investigué el HTML real de
swagger-ui-express (generateHTML() en su node_modules): los 3 <script>
son src= externos del mismo origen, nunca inline — script-src 'self'
ya los permite. El único new Function() del bundle (grep directo al
.js de swagger-ui-dist) es fallback de globalThis, inalcanzable en
navegadores modernos — tampoco hace falta unsafe-eval. style-src
conserva unsafe-inline a propósito (bloques <style> literales, riesgo
bajo). Falso positivo detectado y descartado en el camino: un curl -I
inicial pareció mostrar 'default-src none' compitiendo con mi CSP —
era el paquete `send` (dentro de express.static/swagger-ui-express)
poniendo 'none' en SU PROPIA página de redirect 301 autogenerada, sin
contenido que necesite permisos; la página real (200) siempre tuvo la
CSP correcta, confirmado por curl a los 4 assets en backend y control,
los 8 con 200. Sin validación visual en navegador real esta vez
(extensión Claude in Chrome desconectada) — pendiente que el usuario
confirme /api/docs y /api/control/docs cuando pueda. Jest 584/584,
rebuild+redeploy backend/control contra Docker real, health OK.
Detalle: PROJECT_STATE.md punto 140.

C060 10:18 ✓ Usuario confirmó visualmente: "ya lo revisé, se ve bien"
— /api/docs pinta correctamente en navegador real con la CSP
endurecida de C059 (sin unsafe-inline/unsafe-eval en script-src).
Cierra el pendiente de validación visual que había quedado abierto.
Detalle: PROJECT_STATE.md punto 140.

C061 10:40 ●bugfix Revisé el punto 138 (Cuentas por cobrar) a pedido
del usuario — código ya escrito por la otra herramienta pese a que su
doc dice "cero código tocado". Bug de datos real y grave, confirmado
contra la BD real: 207 de 212 ventas históricas quedaron "pagada" con
monto_cobrado=$0 (la migración nunca hizo backfill). Fix: UPDATE
idempotente en db.js fuera del bloque "columna nueva" (para que sí
corriera contra la BD ya migrada) — verificado 212/212 correctas
después, fecha_cobro poblado desde creado_en. Agregados 11 tests Jest
al endpoint /cobro y a la validación de estado_pago (antes: cero
cobertura Jest, solo un Playwright feliz-camino que no tocaba datos
históricos). Agregada validación de vencimiento futuro en el backend
(aceptaba fechas pasadas). Limpiado código muerto en admin.js
(_cargarOrdenesOriginal/_cargarOrdenesConCxc sin usar). Agregado
filtro "Estado de pago" en Ventas (corregí mi propio hallazgo previo:
el badge inline ya existía, solo faltaba el filtro). Jest 595/595 (36
suites), validado contra Docker/MySQL reales y en navegador real (0
errores de consola, filtro y vista CxC funcionando con datos reales).
Las 4 preguntas de diseño originales del punto 138 siguen sin
respuesta explícita del usuario. Detalle: PROJECT_STATE.md punto 138.

C062 11:30 ◆ Pulido visual Cuentas por cobrar + Ventas — sin emojis, icono
factura (punto 141). A pedido explícito "no usamos emojis, retira los
de CxC y mantén el diseño como Resumen financiero" + confirmación A+B.
Analicé impacto, propuse mapeo emoji→SVG (tabla $/x-circle/clock/
check-circle) y esperé confirmación — usuario aprobó con matiz: badge
Pagada solo texto, icono junto a OC como factura. Implementado:
admin.html:986-989 KPIs 💰🔴⏳✅→SVG 18×18 tintados (mismo set que Resumen),
admin.html:886-887 toggle ✅/⏳→solo texto, admin.js:5023 icono OC ✅→
factura SVG 14×14 doc, admin.js:5030/7988 badges 🔴/⏳/✅→solo texto
(Vencida/Pendiente/Pagada, color por estatus-*), admin.css:1263
.orden-facturado-icono inline-flex. Jest 595/595, rebuild frontend y
verificación HTTP (/admin 200 sin emojis con SVG, /admin.js con factura).
Detalle: PROJECT_STATE.md punto 141. Sin cambios de esquema/API.

## 2026-08-24 — Tipografía unificada a Inter y hover homologado

C063 2026-08-24 ◆ Tipografía unificada a Inter en toda la app (a pedido:
"mismo tipo de letra que tiene el menú derecho"). `frontend/style.css`
`@import` reducido a solo Inter; `:root` `--font-body` y `--font-display`
ambas Inter (`--font-display: var(--font-body)` alias para no romper
referencias ni el sistema de temas por tenant); `frontend/mantenimiento.html`
replicado. Cero mezcla serif/sans en ningún CSS/HTML nuevo — aplica a
control y lado del cliente (portal/login/csf/tickets/dashboard) por igual.
Docs persistentes actualizados: `CLAUDE.md`, `AGENTS.md` (convención en
"Convenciones establecidas"), `PROJECT_STATE.md` (nueva sección
"Convención persistente de tipografía") y este `cmem.md`. TenantTema
congelado en esta default. Verificación `node --check` y grep.

C064 2026-08-24 ◆ Hover homologado en todo el sitio/apps (a pedido:
"Resumen financiero se ve muy simple vs Tickets/Constancias").
`frontend/admin.css:1617` `.admin-table tbody tr:hover` era el patrón de
referencia (`background: var(--color-accent-soft)`). Se agregó bloque
"Hover unificado" en `frontend/admin.css` (tarjetas Inicio/Resumen/Reportes/
Configuraciones/Gastos) con `background: var(--color-accent-soft)` +
`border-color: var(--color-accent)` + `transition 0.15s ease` (reduce-motion
respeta). `frontend/portal.css` `.tile:hover` homologado al mismo fondo
suave. Aplica a admin, control (reusa admin.css) y portal cliente.
Documentado en `CLAUDE.md`, `AGENTS.md` y `PROJECT_STATE.md` (nueva sección
"Convención persistente de hover"). Rebuild y push posteriores.

## 2026-09-12/13 — Esqueleto de carga, centros de conocimiento y arquitectura del menú

C065 2026-09-12/13 ◆ Esqueleto de carga (shimmer tipo Facebook) en todo
el sitio, punto 289. Pedido: que "esperar" nunca se sienta como "no
puedo conectar" — usó las palabras "usa tus mejores habilidades UX UI,
critícalo y dame mejoras". Protocolo completo: auditoría con `Explore`
(cero skeleton/spinner previo, tablas vacías sin aviso, KPIs en `$0.00`
hardcodeados, el error de red solo dispara por fetch rechazado no por
lentitud), Artifact con propuesta antes/después (3 escenarios reales,
botón "Reproducir" por lado) publicado y aprobado con 3 decisiones del
usuario: 3 superficies en un solo segmento, sin mínimo de tiempo
artificial, mismo texto de error reubicado dentro del bloque. Implementado:
`frontend/skeleton.js` nuevo (compartido, patrón `theme.js`) +
`.sk`/`.sk-cargando`/`.sk-retry-inline` en `style.css`. 15/17 tablas de
`/admin` + 2 de `/control` + 1 del portal cliente (2 descartadas, pueblan
un `<select>`). Un solo toggle de clase por vista cubre todos los KPIs
(`.inicio-stat-numero` reusada en todo el sitio). Esqueleto de shell
nuevo durante verificación de sesión guardada al recargar (reemplaza
parpadeo de login). 2 bugs reales propios encontrados y corregidos en la
misma sesión (`cargarEstadisticasReportes` dejaba el shimmer prendido
para siempre con serie vacía; `cargarCxc` no propagaba el fallo de
`cargarOrdenes()`). Jest backend 946/946 sin cambios. Validado con clics
reales en navegador (Claude in Chrome) contra Docker/MySQL reales:
shimmer capturado en vivo en Ventas, `/control` sin errores de consola.
Detalle completo: `PROJECT_STATE.md` punto 289, `CLAUDE.md` punto 289.
Sin commit/push.

C066 2026-09-12/13 ◆ Suspender/activar usuario en /admin (sitio base y
tenant), punto 290. Pedido: botón y funcionalidad de suspender/activar
en "Usuarios". Protocolo completo: auditoría (`Explore`) confirmó cero
columna de estado en `usuarios`, "Eliminar" permanente sin papelera.
Propuesta antes/después (Artifact) aprobada con las 3 recomendaciones
tal cual ("si implementa por favor con todas las recomendaciones y
confirmo"): 4 perfiles incluidos, auto-suspensión bloqueada, cuenta
suspendida sigue contando contra cuota. Reuso exacto del patrón ya
construido para tenants en `/control` (mismos 2 SVG pausa/check, mismas
clases `.estatus-activo`/`.estatus-suspendido` sin usar hasta ahora) —
cero componente nuevo. Backend: columna `usuarios.activo` (migración
idempotente), `verificarUsuarioAdministrativo()`+`requireAdminAuth()`
403 "cuenta suspendida" solo DESPUÉS de contraseña correcta (nunca
antes, anti-enumeración), `POST /api/auth/login` simétrico, `GET
/api/auth/me` expone `suspendido` (en vivo, mismo mecanismo que ya
forzaba cambio de contraseña obligatorio), endpoint nuevo `PUT
/api/admin/usuarios/:id/estado` con el mismo candado de auto-eliminar
adaptado a auto-suspender. Frontend: badge+botón en `renderUsuarios()`
(admin.js), `portal.js`/`login.js` cortan sesión de cliente suspendido
vía sessionStorage+logout. 2 bugs reales propios evitados/corregidos en
el camino (no reportados por nadie, encontrados armando el feature):
login de admin enmascaraba cualquier error no-401 con un texto
genérico fijo (el 403 nuevo se habría perdido) — corregido antes de
shippear; `!fila.activo` directo habría marcado como suspendidas ~22
filas mockeadas sin ese campo en tests ya existentes — cambiado a
comparación explícita `=== 0/false`. Fragilidad de test preexistente
expuesta: `auth-usuario.test.js` ya usaba las 20 peticiones completas
del `authLimiter` compartido sin margen — subido a 30. 16 tests nuevos,
Jest backend 958/958. Validado con clics reales en navegador (Claude in
Chrome) contra Docker/MySQL reales: badge Activo↔Suspendido y botón
pausa↔check confirmados en una fila real, modal con RFC real
interpolado, cero errores de consola. Detalle completo:
`PROJECT_STATE.md` punto 290, `CLAUDE.md` punto 290. Sin commit/push.

C067 2026-09-13 ✓ Centro de conocimiento de /admin puesto al día, punto
293. Pedido: "actualiza los centro de conocimiento de todos los
aplicativos, como control y admin del tenant y el sitio base sin
tenant, con todos los cambios realizados". Auditoría contra el sidebar
real encontró 2 vistas completas sin categoría en el manual: "Mi
Cuenta" (283) y "Auditoría" (244/286) — agregadas con sus mismos
íconos SVG reales. "Usuarios y perfiles" ganó 2 pasos sobre suspender/
activar (290). Resto de categorías ya al día, sin cambios. Cero
backend. Validado con clics reales en navegador tras rebuild frontend,
cero errores de consola. **Sin tocar**: `/control` no tiene ningún
Centro de conocimiento (el pedido lo mencionaba como si existiera) —
construirlo es función nueva, no actualización; preguntado al usuario
antes de tocar código ahí. Detalle: `PROJECT_STATE.md`/`CLAUDE.md`
punto 293. Sin commit/push.

C068 2026-09-13 ◆ Centro de conocimiento nuevo para /control, punto
294. Cierra el hueco del punto 293 — preguntado vía `AskUserQuestion`
si construir uno nuevo en /control (no existía) o dejarlo pendiente;
el usuario eligió construirlo. Reuso literal del componente de /admin
(`control.html` ya carga `admin.css`, cero CSS nuevo) — 3 categorías
reales (Empresas/Sucursales/Super Admins), sin "Primeros pasos" a
propósito (simplificación consciente, solo 3 vistas cross-tenant).
Botones + modal en `control.html`, funciones portadas de `admin.js` a
`control.js` sin la parte de recorrido guiado (no aplica). Cero
backend. Validado con clics reales en navegador: 3 categorías con
íconos reales, buscador resaltando en vivo, atajo de topbar, tabla de
tenants intacta al cerrar, cero errores de consola. Detalle:
`PROJECT_STATE.md`/`CLAUDE.md` punto 294. Sin commit/push.

C069 2026-09-13 ◆ Arquitectura de información: menú lateral + Configuraciones
globales, punto 295. Pedido: auditoría profunda con mejores skills UX +
investigación real en internet, propuesta visual antes/después por
mejora, sin implementar hasta confirmar — confirmado en la misma
conversación. Investigación: 6 principios de IA para dashboards
(GoodData), NN/g (etiquetas mutuamente excluyentes), Ley de Miller vía
Shopify Polaris (máx ~7 accesos), guías de settings pages (Eleken).
Hallazgos reales: 14 vistas en lista plana, 3 colisiones de nombre
vista↔tarjeta de config (Ventas/Inventarios/Reportes), Centro de
conocimiento ya agrupaba por tema en otro orden que el sidebar.
Propuesta validada con mockup interactivo por los 4 perfiles ANTES de
implementar — los 5 grupos coinciden con RESTRICCIONES_PERFIL ya
existente. Implementado: sidebar en 5 secciones (Facturación/Ventas y
gastos/Finanzas/Catálogo/Administración) + Inicio suelto + Cuenta al
fondo, encabezados que se auto-ocultan (GRUPOS_SIDEBAR_NAV); Config
globales en 3 secciones (Fiscal/Comunicación/Módulos) + 4 renombres
para cerrar las colisiones (Módulo Ventas/Inventarios/Auditoría,
Notificación de reportes). Cero backend, cero permiso tocado. Validado
con clics reales: grupo parcial (Administración con 1/2 visible) y
grupo total confirmados sin título huérfano, buscador de config
filtrando en vivo, cero errores de consola. Detalle:
`PROJECT_STATE.md`/`CLAUDE.md` punto 295. Sin commit/push.

C070 2026-09-13 ◆ Grupos del sidebar colapsables + scrollbar delgada,
punto 296. Pedido con captura: colapsar los 6 encabezados del punto
295 + quitar la barra de scroll ancha del navegador sin perder scroll.
Crítica antes de implementar (Artifact interactivo, aprobado con las 3
recomendaciones): en vez de colapso 100% manual, el grupo de la vista
activa se abre solo, resto colapsado por defecto; aperturas manuales
se recuerdan por cuenta (localStorage, mismo patrón que
claveOnboarding). Scrollbar delgada tipo overlay (macOS-style) en vez
de removida del todo — nunca esconde que hay más contenido.
aplicarEstadoGruposSidebar() nuevo, llamado desde
cambiarVistaPrincipal(), clic en Configuraciones globales, y
showDashboard(). Cero backend. Validado con clics reales: sidebar cabe
sin scroll colapsado, 2 grupos abiertos a la vez sin conflicto (uno
manual + uno automático), persistencia confirmada tras F5 real, cero
errores de consola. Detalle: `PROJECT_STATE.md`/`CLAUDE.md` punto 296.
Sin commit/push.

## 2026-09-17 — Incidente real de producción: crash-loop en el VPS

C072 2026-09-17 ● Incidente real de producción: backend en crash-loop
tras `actualizar.sh` en el VPS real (`yt.addv.com.mx`), punto 316.
Usuario corrió `actualizar.sh` tras el fix del punto 314 — backend
quedó `unhealthy`, frontend nunca arrancó (`depends_on:
service_healthy`). Logs: `ER_ACCESS_DENIED_ERROR` para user `app` de
MySQL, 20 reintentos y muere. Causa: `.env` (`MYSQL_PASSWORD`)
desincronizado del password real que MySQL tenía grabado — MySQL solo
aplica credenciales en la primera inicialización del volumen, una
edición de `.env` después de eso queda huérfana en silencio.
Diagnóstico en vivo, con vuelta de tuerca real: el primer `ALTER USER`
se corrió con un `MYSQL_PASSWORD` que el usuario había pegado EN UN
TURNO ANTERIOR de la conversación — siguió fallando, porque el `.env`
real había cambiado desde entonces. `docker inspect` del contenedor
backend (env congelado al crearse) + un `grep .env` fresco confirmaron
el valor vigente real; `ALTER USER 'app'@'%' IDENTIFIED BY '<correcto>'`
con root (password root sacado de `docker inspect` del contenedor
MySQL) + `--force-recreate backend` lo resolvió. Login de super
funcionó de inmediato después — el síntoma "no me deja entrar" NO era
`ADMIN_USERS`, era el proceso completo caído. Prevención: preflight
nuevo en `prod/actualizar.sh` (Paso 0.5) — prueba `SELECT 1` contra
MySQL real ANTES de reconstruir imágenes, aborta con el `ALTER USER`
exacto ya armado si falla, en vez de gastar el build + timeout del
healthcheck para descubrirlo después. Runbook de 6 pasos documentado en
`PROJECT_STATE.md` punto 316 para cualquier sesión futura con el mismo
síntoma. De paso: página de mantenimiento 3D (CSS puro) creada en
`ops/mantenimiento-host/index.html` (fuera de `prod/`, sobrevive
cualquier borrado de esa carpeta) para reemplazar el 502 default de
nginx del host — instrucciones de enganche manual dadas, sin confirmar
si ya se aplicó. Detalle: `PROJECT_STATE.md`/`CLAUDE.md` punto 316. Sin
commit/push (cambios en `prod/actualizar.sh`, que no viaja a git de la
misma forma — confirmar con el usuario si se sincroniza al repo o solo
vive en el VPS).

## 2026-09-13 — SMTP: acordeón estricto de 3 subsecciones

C071 2026-09-13 ◆ SMTP: acordeón estricto de 3 subsecciones +
autoguardado, punto 297. Pedido: "Correo electrónico (SMTP)"/
"Plantillas de correo"/"Enviar correo de prueba" colapsables, solo 1
abierta a la vez. 2 rondas de crítica (Artifact interactivo): la 1ra
cuestionó el estricto (2 flujos reales rotos, configurar→probar y
editar plantilla→probar); el usuario confirmó estricto de todas formas
+ pidió autoguardado en SMTP. Hallazgo real que cambió el análisis: PUT
/api/admin/config/smtp no admite guardado parcial (13 campos siempre
juntos, conexión+5 plantillas, sanitizeText convierte undefined→'') —
el acordeón estricto en realidad MITIGA el riesgo (nunca hay campos de
conexión y una plantilla sin guardar visibles a la vez). Veredicto
delegado por el usuario ("1 botón o 2 si viola buenas prácticas"): 1
solo botón (2 sería affordance redundante con el autoguardado).
guardarConfigSmtpCompleta(modo) unifica botón/autosave sobre el mismo
payload de 13 campos; autosave dispara en 'change', gateado por
validarCamposSmtp() (misma validación que ya exigía el botón),
indicador "Guardando…/Guardado ✓" en el encabezado. Botón relocalizado
a "Guardar plantilla" dentro de Plantillas. Acordeón viejo inerte de
esta tarjeta (btn-toggle-smtp, pointer-events:none desde que
Configuraciones pasó a sidebar+seleccionarSeccionConfig) eliminado.
Cero backend, Jest 958/958 sin cambios. Validado con clics/JS reales en
navegador contra Docker real: estricto confirmado (abrir Plantillas
cierra Conexión sola), autoguardado disparado por change→GET confirma
persistido→revertido sin rastro, botón reubicado con preview intacta,
cero errores de consola. Detalle: `PROJECT_STATE.md`/`CLAUDE.md` punto
297. Sin commit/push.

## 2026-09-18/19 — Corte del día, quién registró la venta, perfil "Inventario", sync de prod/

C073 🎯 Sesión larga: restyle de "Corte del día" en Ventas (chips de
rango rápido + fix de espacio desperdiciado), columna "creado_por" para
saber quién registró cada venta (sin exponerla en Ventas), perfil de
panel nuevo "Inventario", cierre de un bug real de "Forzar cambio de
contraseña" que nunca aplicaba al login de /admin, sync completo de
`prod/`, y reubicación de la página de mantenimiento 3D.

C074 ↻ Punto 318: restyle de "Corte del día" — chips Hoy/Ayer/Esta
semana/Este mes/Mes anterior (1 clic llena Desde/Hasta, campos siguen
editables), tooltip en vez de texto de ayuda ocupando una columna
angosta, resultado agrupado en "Ventas del periodo"/"Facturación y
cobro" con color semántico, botón "Descargar CSV" nuevo (100% cliente).

C075 ● Punto 319: el restyle de arriba dejaba una banda vacía en el
modal — causa real: `.ticket-modal-body` (flex, pensada para
"contenido + sidebar" de OTROS modales) trataba filtros/resultados como
2 columnas desparejas. Primer intento de fix (`.corte-modal-body
{display:block}`) no se veía — empate de especificidad CSS contra
`.ticket-modal-body` declarada después en el archivo; fix real: selector
de 2 clases (gana sin importar el orden).

C076 ◆ Punto 320: `ordenes_compra.creado_por` — quién registró la venta,
NUNCA visible en Ventas (GET explícito sin esa columna + destructuring
defensivo, un test de defensa en profundidad atrapó un `...orden` spread
que la habría dejado pasar). Prioridad real pedida 2 veces por el
usuario: nombre (Mi Cuenta) → correo → JAMÁS el "rfc" (que para
administrador/fiscal/ventas/inventario es solo un nombre de usuario de
login, nunca un RFC fiscal real). Reutiliza la misma query de auth (sin
query extra). Propaga a "Atendido por" en 4 sitios de reportes.

C077 ◆ Punto 321: perfil de panel nuevo "Inventario" — un solo módulo.
"Inicio" para este perfil ES "Estado del inventario" (reparentado en
vivo desde Reportes, cero duplicación de HTML/lógica). 38 rutas de
`/api/admin/inventarios/*` ganan el perfil nuevo (23 rutas de otros
módulos intactas). Addendum mismo día: el usuario pidió Mi Cuenta de
vuelta (agregada) y reportó que "Forzar cambio de contraseña" no hacía
nada — bug real confirmado: el checkbox sí guardaba el flag en BD, pero
el login de /admin (Basic Auth) nunca lo consultaba, solo el login del
portal de cliente. Afectaba a los 4 perfiles de panel por igual. Fix:
`GET /api/admin/login` expone el flag real, 3er panel en la pantalla de
login lo intercepta y reusa `PUT /admin/mi-cuenta/password` (ya existía).

C078 ✓ Punto 322: sync de `prod/` — 15 archivos con drift real (todo lo
de arriba + un hallazgo aparte: el fix de `tipo_persona` de una sesión
anterior tampoco había llegado nunca a `prod/`). Preflight de
credenciales MySQL del punto 316 confirmado intacto. Validado con
`npm install`+`npx jest` DENTRO de `prod/backend` (no solo copiar) —
1040/1040. `prod.zip` regenerado.

C079 ✓ Punto 323: página de mantenimiento 3D (punto 316) reubicada de
`ops/mantenimiento-host/` a `unavailable/`, al mismo nivel que `prod/`
(pedido explícito del usuario). Sin cambios de fondo, solo rutas.

Jest backend 1040/1040 en todo lo anterior. Sin herramienta de navegador
en ninguna parte de esta sesión — falta confirmación visual del usuario
para el modal de Corte del día, "Inicio" del perfil Inventario, y la
pantalla nueva de cambio de contraseña obligatorio. Sin commit/push
todavía (puntos 318-321); el commit de "Corte del día" original y su
addendum de cascada sí se habían commiteado/pusheado en un turno
anterior de esta misma sesión (`5f6d530`). Detalle línea por línea en
PROJECT_STATE.md puntos 318-323.

## 2026-09-25 — Rebrand a Clarvo, logout inmediato y recorrido del perfil Inventario

Nota de backfill (2026-10-09): las sesiones del 2026-09-25 al 2026-10-09
no habían quedado registradas aquí (solo existían los sueltos C080 y
C081, que además estaban sin encabezado de fecha). Este bloque se
reconstruyó desde `PROJECT_STATE.md`, `git log` y los timestamps de
Claude Mem (horas locales, UTC-6). Los IDs C082+ se asignaron en orden
cronológico del backfill, por eso aparecen antes que C080/C081.

C082 11:42 ○ Rebrand "Portal de Facturación ADDV" → "Clarvo" en toda la
documentación (README/CLAUDE/AGENTS/PROJECT_STATE) y se documentaron los
módulos que faltaban (commit `ea90cdf`). Sesión corta, 11:00-12:43.

C083 11:15 ◆ Punto 290: logout inmediato al suspender un usuario del panel
— antes, suspender no cerraba la sesión viva que ya tenía abierta
(commit `5b0b136`).

C084 11:57 ● Punto 325: recorrido guiado + "Primeros pasos" para el perfil
Inventario del panel (commit `5c37ddb`).

## 2026-09-27 — Riel colapsable del panel, trust proxy y siembra (puntos 326-329)

C085 16:00 ● Punto 326: F5 en "Inicio" de /admin dejaba tarjetas y tabla en
0 — `init()` no llamaba a `cargarInicio()` cuando la vista guardada era
justo la activa por defecto. Fix solo frontend, validado por curl.

C086 16:00 ● Punto 327: `TRUST_PROXY_HOPS` — número de saltos de `trust
proxy` configurable para que la auditoría guarde la IP real del cliente y
no la del proxy (default 1; pendiente de confirmar en prod).

C087 16:05 ◆ Punto 329: sidebar de /admin colapsable a solo íconos (riel
256↔72px, toggle flotante, monograma, tooltips, persistencia en
localStorage), solo escritorio. Mismo día: reescritura de `CLAUDE.md` y
`AGENTS.md` como master prompts sin narrativa histórica, con la sección
"Gotchas operativos recurrentes" extraída (1.ª entrada del punto 328, cero
código) y `sembrar-demo.js` reescrito con escenario de escuela privada de
8 meses + cierre mensual/corte del día/eliminados (2.ª entrada del punto
328). Sesión sin commit ese día (los commits salen el 09-28).

## 2026-09-28 — Riel 2ª vuelta, correos con puerto, plantilla de correo y campana de /admin (puntos 330-337)

C080 ✓ Punto 336: consistencia visual de acciones en `/admin` — usuario
mostró 2 imágenes (par de iconos ✔ vs par de botones de texto
"Gestionar"/"Eliminar" ✘) y pidió auditar TODO el proyecto. Análisis
encontró 6 puntos con texto en vez del ícono ya establecido en
Usuarios/Órdenes (`btn-icono-accion`): Documentos, Tickets, panel
Categorías de Gastos (ese además con emoji real ✏️/🗑️), panel Categorías
de Inventario (mismo bloque duplicado), Inicio→Recientes y
Inventario→Matriz de estado (ambos "Gestionar" suelto sin par). Aprobados
los 6, con instrucción explícita del usuario: "sin emojis, todo deben ser
iconos". Implementado reutilizando el factory `botonAccionInv()` +
constantes `ICONO_*` que YA existían en el archivo (sección Inventarios)
en vez de crear un tercer sistema paralelo — solo se agregó `ICONO_OJO`
nuevo. Efecto colateral bueno: se pudo borrar CSS muerto de los botones
de texto viejos (`.btn-ver`/`.btn-eliminar`/etc.) apenas dejaron de
usarse en ninguna parte (confirmado por grep antes de borrar).

Durante la verificación final salió un 7mo caso NO pedido explícitamente
pero de la misma familia: el botón toggle "✏️ Categorías" (Gastos e
Inventario) tenía el mismo emoji en su texto visible, más 2 strings de
copy que lo citaban — se corrigieron también, coherente con el "todo
deben ser iconos" recién reforzado por el usuario. Barrido más amplio
confirmó que ✓/✕/→/⚠ regados por el resto del sitio (cerrar modal,
autoguardado, navegación) son un patrón previo ya consistente y NO es lo
que el usuario señaló — se dejó intacto, solo anotado como hallazgo.

Validado: `node --check` en los 2 archivos, Jest backend 1040/1040 (no
toca backend, corrida por disciplina), rebuild `--no-cache` +
`force-recreate` del contenedor `frontend`, `curl` contra el contenedor
real confirmando 0 emojis servidos. Falta: clic real en navegador (sin
herramienta de navegador en esta sesión) y commit/push (no pedido
todavía). Detalle completo en PROJECT_STATE.md punto 336.

C088 21:22 ◆ Puntos 330-333: 2ª vuelta del riel colapsado — el contenido
aprovecha el espacio al colapsar (`.admin-main` con ancho máx. 1584px,
Opción A, en las 14 vistas), fix del "hueco" real entre riel y contenido
(`.admin-content` seguía con `margin-left:256px` con el riel en 72px;
luego `margin:0` en `.admin-main` para que todo el sobrante vaya al borde
derecho) y ancho adaptativo con `min(calc(100vw - var(--sidebar-w) - 88px),
1960px)` en vez de 72/256 fijos, para cualquier monitor. Validado con
computed-style real.

C089 15:48 ✓ Punto 334: los correos salían sin puerto — nginx usaba
`Host $host` en 3 `proxy_set_header`, cambiado a `$http_host` para que
`detectarUrlPortal()` detecte el ambiente (bug que solo se veía en el
contenedor real, no en local).

C090 15:48 ● Puntos 335 y 337 (commit `9835fb0`): plantilla editable del
correo de "confirmación de venta" en Plantillas de correo, y campana de
notificaciones en el topbar de /admin — tickets nuevos, alertas de
inventario y avisos de configuración, sondeo cada 60s reusando 3 endpoints
ya existentes.

## 2026-09-29 — Auditoría UX/UI, CSF protegido, Ventas con folio y animación de activación (puntos 338-344)

C091 09:37 ◆ Punto 338: el popup emergente "Tickets sin correo de
contador" quedó solo para el perfil fiscal (commit `5aab3e7`).

C092 10:27 ● Punto 339: reglas escalonadas de aviso de expiración de
productos + navegación dentro de la campana de notificaciones, validado
en Docker real vía Chrome (commit `08fe8af`).

C093 12:57 ◆ Punto 340: corrección de los 3 hallazgos de la auditoría
UX/UI (commit `c91c099`).

C094 13:10 ◆ Punto 341: `csf.html` (formulario de alta/CSF) exige sesión,
ya no es de acceso público (commit `6b39edb`).

C095 16:44 ● Punto 342: método de pago + folio de conciliación en Ventas
(commit `065aa21`); a las 17:45, centro de conocimiento del propio punto
342 y confirmación nginx del punto 323 (`78c109b`). Pendientes marcados
entonces: probar en Docker real y confirmación visual.

C096 17:38 ● Punto 343: animación de progreso al activar un tenant desde
`/control` (commit `c93d01a`).

C097 20:01 ◆ Punto 344: aviso de servidor lento/caído + Fase 1 de la BD
dedicada de `/control` (punto 305) (commit `ebda369`); a las 20:20,
columna de Acciones en Tickets y margen simétrico de `.admin-main`
(`87f29f7`).

## 2026-09-30 — Papelera en /control y las 5 fases del gobierno de funcionalidades (puntos 345-347)

C098 12:57 ● Punto 345: papelera de empresas en `/control` + punto 346:
rediseño de Ventas dentro de Configuraciones (commit `f1d9f10`); 13:11
README de la BD dedicada de control, folio de conciliación y papelera
(`7ac96dc`); 14:32 vista dedicada "Papelera" (`fdba0f9`).

C099 20:29 ◆ Punto 347 Fases 0-1: gobierno de funcionalidades por tenant
desde `/control` — flags en `tenants`/`planes` y `requiereFeature()`
insertado ruta por ruta (commit `4d34dad`).

C100 21:39 ● Punto 347 Fases 2-5: catálogo de planes, asignación de plan
y cuota de disco en `/control` (commit `9a4aaee`); 22:12 cuota de disco
en más subidas + auditoría cross-tenant en `/control` (`599823f`). Al
cerrar el día, Fase 5 (cierre) quedó pendiente y de ahí salió la regla
permanente del punto 348.

## 2026-10-01 — Regla de gobernanza, separación de reportes y reglas 8-9 (puntos 348-351)

C081 ⚖ Punto 348: regla permanente de gobernanza de funcionalidades,
pedida por el usuario tras cerrar el punto 347 (Fases 0-5 de "gobierno
de funcionalidades por tenant"). Investigué antes de escribir nada:
encontré `stitch/gobierno-funcionalidades/` (NOTAS.md + 2 prototipos
HTML), trabajo de OTRA sesión sobre este mismo punto 347 — mucho más
amplio que lo que yo implementé: asistente de 4 pasos + 10 reglas de
dependencia (bloqueo/cascada/auto-activación/advertencia) cubriendo
Ventas, Gastos, Inventarios, Auditoría, Proveedores, Reportes (4
sub-pestañas), Cuentas por cobrar y Resumen financiero — diseño ya
aprobado por el usuario, pero sin código real todavía. Reporté el
hallazgo ANTES de redactar la regla final, porque cambiaba por completo
el alcance de lo pedido ("todo mapeado sin excepción" encajaba con eso,
no con mis 4 flags). Usé /prompt-master (pedido explícito del usuario)
para aplicar disciplina de redacción de regla persistente (verbos
precisos, MUST sobre should, mecanismo concreto verificable en vez de
declaración de intención) al bloque final de CLAUDE.md.

3 preguntas via AskUserQuestion (máximo de prompt-master, las 3 usadas):
(1) ¿retomar stitch/ ya o como punto aparte? → punto aparte después. (2)
¿regla hacia adelante o también retroactiva sobre módulos existentes? →
**retroactiva y obligatoria — bloquea todo trabajo nuevo hasta mapear
los módulos existentes**, decisión fuerte del usuario. (3) ¿"portal de
proveedores" es superficie separada? → no, confirmado: vive junto con el
portal de clientes dentro del mismo ecosistema admin.

Escrito en CLAUDE.md (sección nueva, antes de "Reglas persistentes de
coordinación" para máxima visibilidad al cargar el archivo) + punto 348
en PROJECT_STATE.md (resumen operativo + deuda pendiente módulo por
módulo + 3 preguntas abiertas de `stitch/NOTAS.md` sin confirmar aún) +
fila nueva en pendientes.html marcada "BLOQUEANTE — sin empezar"
(pill-amber, única fila con esa semántica en el archivo). Claude Mem: sin
acceso de escritura manual confirmado desde el 2026-08-12 (ver CLAUDE.md)
— estos 3 archivos son el registro durable, el hook de cierre de sesión
se encarga del resto.

Incidental: corregí un emoji real (⚠️) en frontend/control.html, ya
señalado como pendiente en stitch/NOTAS.md ("fuera de alcance de esa
tarea, pendiente de corregir cuando se edite esa pantalla") — como yo sí
edité control.html hoy (Fase 3 del punto 347), lo arreglé de paso:
reemplazado por el mismo SVG de alerta (feather-style) ya usado en el
resto del sitio para warnings, nunca un carácter Unicode ni emoji. `node
--check` limpio, balance de tags de control.html/pendientes.html
verificado antes y después. Sin commit/push todavía — nada implementado
en código real además del fix del emoji, que es parte del mismo commit
pendiente.

C101 16:15 ◆ Separa "Corte del día" de "Reporte por rango" (cada uno con
su propio flag de Reportes, evitando que apagar una pestaña rompiera el
botón de la otra) + pareja columna de Acciones en las tablas que les
faltaba (commit `c260363`).

C102 19:53 ◆ Puntos 349-351: diseño aprobado del asistente de 4 pasos en
`/control` para el gobierno de funcionalidades, con las 3 preguntas
abiertas resueltas (regla 7 = advertencia, regla 8 = banner antes de
editar el plan, regla 9 = suspensión automática al bajar `max_usuarios`,
catálogo llevado a 12 reglas) y Fases 6-7 en curso — commit `31059c7`.

## 2026-10-02 — Mi Cuenta, login RFC-o-correo, gating consistente e Inicio con KPIs reales (puntos 352-362)

C103 13:32 ● Puntos 353-355: "Mi Cuenta" en el portal de cliente
(segmento 1), login con RFC o correo (segmento 2, con auditoría de
impacto antes de implementar, como pidió el usuario) y tratamiento de
escritorio de `mi-cuenta.html` — 2 columnas desde 880px en vez de la
columna angosta de 480px (commits `3303044`, `9d9eea8`).

C104 16:18 ◆ Punto 356: el usuario apagó Facturación en `/control` para
`t1` y encontró 6 inconsistencias reales — gating extendido a
notificaciones, campana y precargas (`4d38483`, `cb8fe60`, `efd7044`).
Mismo bloque: punto 359, `.webp` no estaba en la whitelist de extensiones
estáticas de nginx y se servía 404 en tenants (`dad3e83`).

C105 17:24 ● Puntos 357-358: regla persistente de Playwright (toda prueba
funcional E2E contra Docker+MySQL y toda propuesta visual con capturas,
decisión explícita del usuario) + card "Tu perfil" en el dashboard para
capturar el nombre en el primer login, elegida entre 4 prototipos HTML en
`prototipos/onboarding/` (`f0d981d`).

C106 17:47 ◆ Puntos 360-362: "Gestión de crédito" como página propia de
Mi Cuenta con CxC e historial real de abonos (`0041b90`), resumen de
tickets movido de Inicio a Reportes → "Estado de tickets" (`19cf042`) e
Inicio rediseñado con 4 KPIs reales + auditoría de esqueleto de carga en
todo el sitio (`d781cf4`). Cerrado de paso el punto 352: la deuda
retroactiva del mapeo de módulos del punto 348 se comprobó YA
implementada en `31059c7`, solo faltaba el registro.

## 2026-10-03 — /control con iconografía, sidebar reordenado y siembra de prod (puntos 363-367)

C107 08:34 ● Punto 363: iconografía clara en `/control` (Super Admins,
Planes) y Papelera reubicada dentro de Empresas (`c57fe13`); 09:47 puntos
364-365: reorden de categorías del sidebar + atajo global "Registrar
venta" en header/móvil y limpieza del toolbar de Ventas que lo duplicaba
(`d5ef27a`), con propuesta antes/después aprobada.

C108 10-03 tarde * Puntos 366-367: siembra de producción a 9 meses/`favorable` y
cambio inmediato a 8 meses/`normal` +10%/mes con efectos de
mercadotecnia, validada por SQL espejo contra Docker/MySQL reales para
preparar `yt.addv.com.mx`. Vive en `prod/` (untracked a propósito), por
eso no aparece en el historial de commits.

## 2026-10-04 — Stepper de cantidad y logo de ticket (puntos 368-369)

C109 10:33 ● Punto 368: stepper +/- de cantidad en Ventas con
auto-agregar/auto-sumar al escanear, validado con Playwright real contra
Docker/MySQL; punto 369: logo y plantilla de la impresión del ticket en
Configuraciones (commit `deb56dd`).

## 2026-10-05 — Sesión mínima: inicio del fix de zona horaria

C110 11:35 ○ Solo 5 observaciones: arranque del punto 371 (KPIs de
Inicio anclados a medianoche UTC en vez de la medianoche local del
tenant); se cerró recién el 10-06.

## 2026-10-06 — Tamaño de imagen global, zona horaria, bloqueo por existencia y marca autoservicio (puntos 370-374)

C111 12:33 ◆ Punto 370: tamaño máximo de imagen configurable desde
`/control` como un solo valor GLOBAL de plataforma (antes repartido en
variables de entorno) — tabla `ajustes_globales`, con el gotcha de que el
límite de `express.json()` tiene que escalar junto con él. Punto 371:
fix real de la tarjeta "Ventas hoy", que desaparecía a partir de las
18:00 con México en UTC-6 (commit `c2c7a07`); 13:27 bloquear producto sin
existencia al buscar/escanear (`7da28c4`); 13:34 `pendientes.html` sin
DOCTYPE/charset, los acentos se veían rotos (`40f07cc`).

C112 19:19 ● Punto 373: marca e identidad visual autoservicio desde
`/admin` además de `/control`, con componente compartido (`3c5a2c1`);
21:01 punto 374: página "Portal de clientes desactivado" con identidad
Clarvo en lugar de dejar las 6 páginas del portal en blanco
(`5d8c7df`).

## 2026-10-07 — Pausa real del portal, 404 Clarvo y 4 hallazgos del portal (puntos 375-377)

C113 13:20 ◆ Punto 375: el switch "Portal de clientes" pasó de
decorativo a control real de autoservicio en Mi Cuenta, aplicable por
tenant y a la vez al sitio base — con el gotcha de que la raíz `/` no
tiene segmentos nombrados y `paginaEsPortalCliente()` no la reconocía
(`c4508f3`); 13:45 punto 376: página 404 con identidad Clarvo + redirect
a clarvo.mx y seed de 11 meses (`6f40d31`).

C114 19:28 ● Punto 377: 4 hallazgos reales del portal de clientes — el
correo real no aparecía en el desplegable de Ventas, "Mi cuenta"
bloqueaba guardar, crédito quedó fuera del Home, y emoji + `%` fijo en
Home (`2b45b3d`). De ahí salió la regla persistente de unicidad de
`usuarios.email` acotada a `perfil='cliente'`.

## 2026-10-08 — Pausa de Facturación, campana del portal, histórico visible y submenú de Reportes (puntos 378-380 + UI de la tarde)

C115 09:40 ● Punto 378: pausa de autoservicio "Facturación" desde
Configuraciones con el mismo patrón de dos capas del punto 375 + fix de
404 de assets estáticos (`a562b78`); 11:23 punto 379: campana de
notificaciones del portal de cliente con vigencia, archivar, eliminar y
relanzar (`2fcde30`).

C116 17:09 ◆ Punto 380: el histórico nunca se esconde — "archivar" en
cierre mensual pasa a "Papelera" en la pestaña Eliminados, el filtro por
defecto es "Todos los periodos" y Ventas/Gastos/Cuentas por cobrar
ganan paginación server-side real; además candado de traslape para que
no se pueda cerrar el mismo mes dos veces (`cf4d753`).

C117 18:32 ○ Pulido de la tarde sin punto propio (tampoco lo tenía en
PROJECT_STATE hasta hoy): flechitas nativas del stepper de Cantidad y
breakpoint móvil que lo aplastaba a ~27px (`0eee910`), "Promociones"
faltante en el menú grid de íconos móvil (`4e22654`), submenú anidado de
"Reportes" en el sidebar de escritorio reemplazando las pestañas
horizontales (`e583d46`) con sus 2 fixes — íconos y riel colapsado
(`c604ed8`), línea cian con el submenú colapsado (`9eb1918`) — y barra
superior del panel siempre visible, fixed con acento cian al hacer
scroll (`0f6546b`).

## 2026-10-09 — Suscripción por tenant, paridad de /control, venta mínima y sincronización de docs (puntos 381-385)

C118 11:09 ◆ Puntos 381/382/384: suscripción por tenant en `/control`,
paridad de sidebar/header en `/control` (riel colapsable por defecto +
título de sección visible) y venta mínima / punto de equilibrio dentro de
"Utilidad neta del mes" (commit `5a9f642`). El punto 383 quedó sin usar:
la numeración lo salta.

C119 ✓ Sesión actual: sincronización de documentación — `US.md`
(colisión de numeración de la sección 27 corregida: US-082/083/084 →
US-112/113/114; US-093 y US-094 actualizadas al punto 380 y al submenú
de Reportes; sección 28 nueva con US-115 a US-120), `market.md` (punto
de equilibrio en el beneficio 1, histórico visible en el 11, 2 frases
gancho nuevas), `cmem.md` (este backfill) y punto 385 en
`PROJECT_STATE.md`. Revisión del servidor de Claude Mem incluida: worker
y Chroma sanos, 18,118 observaciones de este proyecto al día.
