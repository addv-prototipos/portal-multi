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
