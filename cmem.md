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
CLAUDE. Validación: node --check + Jest pendientes antes del commit.
