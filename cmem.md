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
