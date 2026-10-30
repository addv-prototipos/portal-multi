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
en `stitch/gobierno-funcionalidades/NOTAS.md` — **reubicado a
`.trash/stitch/gobierno-funcionalidades/NOTAS.md` (punto 414,
2026-10-23)**: el usuario confirmó que, con el diseño ya implementado y
estable, puede salir del área activa del repo; sigue existiendo íntegro
ahí para consulta, ya no en la raíz. Esta nota reemplaza la anterior
("se mantiene como referencia viva... aunque ya esté implementado") —
si una sesión futura necesita el catálogo completo de las 12 reglas de
dependencia, está en esa ruta dentro de `.trash/`, no se perdió nada.

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

**`marcaLookfeelHabilitado` ya NO gatea el ticket de impresión (punto
387, 2026-10-10)**: desde el punto 368 y hasta el punto 387,
"Marca e identidad visual" y "Ticket de impresión" compartían el MISMO
flag — varias notas de este archivo y comentarios en código viejo (ya
corregidos en el punto 387, pero por si queda alguno sin tocar en el
futuro) decían literalmente "mismo flag que Ticket de impresión". Ahora
son dos flags independientes: `marcaLookfeelHabilitado` solo gatea
logo/colores/tema del sitio (`marca-tema-card` en `/admin`,
`marca_logo_url`/`tema_json`); `ticketImpresionHabilitado` (columna
`ticket_impresion_habilitado`, regla de dependencia 13: requiere Ventas)
gatea las 5 rutas de `/api/admin/configuraciones/ticket*` y la tarjeta
`ticket-config-card`. Si una sesión futura encuentra código o docs que
asuma que apagar "Marca propia" también apaga el ticket (o viceversa),
es un rastro de ANTES del punto 387 — corregirlo, no asumir que sigue
siendo así.

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

- **SSH desde esta máquina Windows: el cliente de Git Bash puede fallar
  en silencio** (punto 442, 2026-10-29): `/usr/bin/ssh` dentro de Git
  Bash (OpenSSH_9.7p1/OpenSSL) tiene un bug real firmando con la
  extensión `publickey-hostbound@openssh.com` que un sshd reciente
  negocia por default — el servidor acepta la llave ("Server accepts
  key") pero el cliente nunca manda la firma ("we did not send a
  packet, disable method") y el acceso SSH parece completamente roto
  ("Permission denied (publickey,password)") sin ningún mensaje de
  error claro, aunque la llave/permisos/config del servidor estén
  perfectos. Diagnóstico: `ssh -vvv` muestra exactamente esa secuencia.
  **Fix**: usar el OpenSSH nativo de Windows en su lugar —
  `/c/Windows/System32/OpenSSH/ssh.exe` (mismos flags `-i`) — funciona
  sin el bug. Detalle completo en memoria
  (`project_ssh_gitbash_hostbound_bug.md`).
- **Garage (`dxflrs/garage`): nunca copiar el `command:` de MinIO**
  (punto 442, 2026-10-29): la imagen no trae `ENTRYPOINT` (solo
  `CMD=[/garage server]`) — un `command:` en compose/stack REEMPLAZA el
  CMD completo. `garage server` NO acepta argumentos (ni ruta de datos
  ni `--console-address`, eso es sintaxis de MinIO) — todo lo lee de
  `garage.toml` ya montado. Un `command: server /data --console-address
  ":9001"` (arrastrado por error de la migración MinIO→Garage, punto
  415) revienta con `error: Found argument '/data' which wasn't
  expected`. El comando correcto es `/garage server` a secas.
- **`control_tenants.tenants` no se crea sola en un servidor 100% nuevo**
  (punto 442, 2026-10-29): ni `backend` ni `control` la crean al
  arrancar — requiere correr `asegurarControlYPrivilegios()`
  (`backend/scripts/lib/controlDb.js`, normalmente invocada por
  `provisionar-tenant.js`) una sola vez a mano. Como `scripts/` está
  excluido a propósito de la imagen de producción del backend
  (`.dockerignore`), hay que montarla desde el host en un contenedor
  temporal (ej. un servicio Swarm efímero con `--entrypoint node` y
  `--mount type=bind,src=<host>/backend/scripts,dst=/scripts,readonly`)
  — nunca meter `scripts/` a la imagen real solo para este paso único.
- **`TRUST_PROXY_HOPS` depende de cuántos nginx hay delante, no de un
  default fijo** (puntos 327 y 442): con nginx del HOST (fuera de
  Docker, con certbot) delante del contenedor `frontend`, son 2 saltos
  reales (host nginx + frontend nginx), no 1 — mismo criterio en
  cualquier VPS de un solo nodo con ese patrón (`yt.addv.com.mx`,
  `clarvo.mx`). Con el valor equivocado, `admin_auditoria` registra la
  IP del proxy, no la del cliente real. Verificar la topología real
  (cuántos reverse proxies hay antes de llegar a Express) antes de
  asumir que el default de `docker-compose.yml` (pensado para un solo
  nginx local) aplica igual en un VPS real.
- **Rebuild que no se refleja**: `docker compose build <servicio>` a
  veces no recoge cambios de archivo — usar `--no-cache` seguido de
  `up -d --force-recreate <servicio>` cuando un cambio no aparece al
  probar.
- **`docker compose restart <servicio>` nunca re-lee `env_file`/`.env`**
  (punto 403, hallazgo M-11, 2026-10-16): solo reinicia el proceso
  dentro del contenedor YA existente — un cambio en una variable que
  viene de `env_file:` (o de la interpolación `${VAR}` del `.env` host)
  necesita `up -d --force-recreate <servicio>` (o un rebuild real) para
  tomar efecto. Confirmado real al probar la persistencia de
  `admin-users.env`: `restart` seguía viendo el valor viejo, `--force-recreate`
  sí vio el nuevo.
- **La extensión de Chrome para navegación automatizada NO puede abrir
  `file://`** (punto en curso, 2026-10-16): cualquier intento de
  `navigate` a una ruta `file:///...` devuelve "Can't interact with
  browser-internal or unparseable URLs", sin importar desde qué pestaña
  se navegue — es una restricción de la extensión, no algo que se pueda
  activar desde esta sesión. Afecta sobre todo a `pendientes.html`
  (vive en el repo, nunca servido por nginx, se abre siempre como
  archivo local) — su `localStorage` de checks NO es legible por
  automatización; si se necesita leerlo, pedirle al usuario el botón
  "Copiar estado" y que pegue el resultado, nunca intentar navegar ahí
  directo.
- **Después de recrear `backend`, `frontend` (nginx) puede quedar
  apuntando a la IP vieja del contenedor** (observado repetidamente
  2026-10-15/16, no es un bug de esta sesión): nginx resuelve el nombre
  "backend" a una IP de Docker una sola vez y no siempre la refresca
  tras un `--force-recreate` de ese servicio — síntoma: `/api/health`
  responde la página de `mantenimiento.html` (502/503) aunque
  `docker compose ps` muestre `backend` como `healthy`. Fix de un paso:
  `docker compose restart frontend` después de recrear `backend`.
- **Scripts de `hostinger/` horneados en la imagen**: el backend de
  producción construye desde `hostinger/backend` sin bind mount (solo
  `uploads` es volumen) — un cambio en `hostinger/backend/scripts/*` (p. ej.
  `sembrar-prod.js`) NO llega al contenedor con `./sembrar.sh` (que solo
  hace `exec` sobre la imagen ya construida): reconstruir primero
  (`hostinger/actualizar.sh` lo hace, o `docker compose build backend` +
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
  `#confirm-modal-overlay`/`#scanner-modal-overlay`, ambos en 70, y
  desde el punto 419 también `#control-confirm-modal-overlay` de
  `/control`, mismo valor). El bug no es "este modal ya está roto" sino
  "este CAMINO de apertura es nuevo" — `confirmarAccion()` de
  `control.js` llevaba meses sin el fix porque nunca se había disparado
  desde DENTRO de otro modal (siempre desde la lista de tenants) hasta
  que la pestaña "Usuarios" del modal "Editar empresa" la invocó por
  primera vez. Si se agrega un modal de confirmación nuevo (en
  cualquiera de las 3 apps) y se dispara desde dentro de otro modal ya
  abierto, aplicar el mismo `z-index: 70` desde el inicio — no asumir
  que "ya está resuelto" porque otros casos en el mismo archivo ya lo
  están.
- **Pruebas de responsive**: replicar el `@media` real y su breakpoint
  exacto en el arnés de prueba — angostar solo `body{max-width}` no
  cambia `window.innerWidth` y no dispara el `@media` real.
- **Playwright en este entorno: chromium NO instalado + transiciones a
  medio camino** (punto 400, 2026-10-14): los binarios de chromium no
  existen aquí — usar `--channel msedge` (Edge del sistema) en el CLI, o
  `chromium.launch({ channel: 'msedge' })` en scripts con
  `playwright-core` instalado en un temporal FUERA del repo (nunca en el
  `node_modules` del proyecto). Y al capturar pantallas justo después de
  un clic, esperar ~400 ms: cualquier `transition` de 150 ms dispara el
  screenshot a medio camino y un estado a medio pintar se confunde con
  un bug de estilos (falso positivo de `aria-pressed`/colores).
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
- **Primer cifrado reversible del repo: `control/utils/accesoMinio.js`**
  (punto 390, 2026-10-12) — hasta ahora TODO lo que el proyecto cifraba
  era un hash irreversible de login (`crypto.scrypt`). "Accesos — MinIO"
  necesitaba guardar un password que el operador pudiera volver a VER
  (bloc de notas, no autenticación), así que es AES-256-GCM con una clave
  nueva (`CONTROL_VAULT_KEY`, 32 bytes hex) que vive SOLO en el `.env` del
  servidor, nunca en la BD — si se necesita otro campo reversible en el
  futuro (otro servicio, otra credencial), replicar este patrón
  (`cifrar`/`descifrar` con IV aleatorio por valor, formato guardado
  `iv:tag:cifrado` en hex) en vez de reinventar uno nuevo o, peor,
  reusar `scrypt` para algo que necesita volver a leerse. **No es un
  vault vivo y la decisión fue explícita del usuario**: editar este
  registro NUNCA rota la contraseña real de ningún servicio ni cambia
  cómo `backend/` se autentica — eso sigue siendo el `.env` real. Antes
  de replicar este patrón para otro servicio, confirmar con el usuario
  si de verdad quiere "solo un bloc de notas" (como aquí) o algo que de
  verdad sincronice — son decisiones de producto distintas, no asumir.
- **Relajar un candado de estado en `control/` tiene un espejo en
  `backend/` que también hay que tocar** (punto 389, 2026-10-12): el
  borrado definitivo de un tenant vive en 2 capas —
  `eliminarTenantDefinitivo()` en `control/utils/tenantLifecycle.js`
  decide SI se puede borrar (gate de estado), pero el borrado físico real
  (DROP DATABASE + MinIO + DELETE de las 3 tablas) lo ejecuta
  `backend/server.js:POST /internal/eliminar-tenant/:slug`, que hace su
  PROPIA verificación atómica de estado (a propósito, "nunca confía en lo
  que ya revisó control" — ver comentario en el archivo). Al ampliar los
  estados permitidos para eliminar (baja → baja+provisioning), el
  candado de `control/` se relajó pero el de `backend/` seguía
  hardcodeado a `estado !== 'baja'` en 2 sitios (el check inicial Y el
  `DELETE ... AND estado = 'baja'` final) — sin tocar ambos, un borrado
  desde "provisioning" habría pasado el check de `control/` y reventado
  con 409 al llegar al backend. Antes de dar por "ya relajado" cualquier
  candado de estado de ciclo de vida de tenant, buscar su espejo en el
  endpoint interno correspondiente de `backend/server.js`
  (`grep -n "estado !== '" backend/server.js`).
- **Mismo gotcha, variante "formatear para mostrar" (punto 388,
  2026-10-12)**: `frontend/admin.js:formatearFechaSoloDia()` hace
  `new Date(fechaISO)` + `toLocaleDateString` — para una columna `DATE`
  pura (`suscripcion_expira_en`, `rango_inicio`/`rango_fin` de Cortes,
  `vigenciaHasta` de Promociones) eso interpreta "2026-11-04" como
  medianoche UTC y la repinta en la zona LOCAL del navegador — con
  México en UTC−6 el día mostrado se corre uno hacia atrás ("04 nov
  2026" en BD se veía "03 nov 2026" en pantalla, reproducido real en
  Docker). No es solo un gotcha de ventanas "hoy/mes": cualquier
  `new Date('YYYY-MM-DD')` + formateo en zona local tiene el mismo
  riesgo, sea para calcular un rango o solo para pintar una fecha en la
  UI. Fix aplicado SOLO en el uso que tocaba ese punto
  (`formatearFechaSoloDiaSinTZ()`, aritmética de texto sin `Date`,
  usada en `micuentaSuscripcionVence`) — los otros 2 usos de
  `formatearFechaSoloDia()` (Cortes/Reportes, Promociones) **siguen con
  el bug sin corregir**, fuera de alcance de esa sesión a propósito. Si
  una sesión futura toca cualquiera de esos 2 sitios, aplicar el mismo
  fix ahí (o migrar `formatearFechaSoloDia()` completo a la variante sin
  `Date`, con aprobación explícita primero — cambia el formato de salida
  de los 3 usos a la vez).
- **nginx intercepta 502/503/504 globalmente** (`error_page 502 503 504`
  → `mantenimiento.html`) — cualquier error real de la API debe responder
  **500**, nunca 502/503/504, o se disfraza de "sitio caído".
- **ExcelJS no lee `.xls` real** (punto 394, 2026-10-13): ExcelJS (ya
  usado en el proyecto para exportar plantillas/reportes) solo entiende
  XLSX/OOXML — un `.xls` binario viejo (Excel 97-2003, OLE2/BIFF8) con
  esa extensión aceptada pero parseado con ExcelJS simplemente truena.
  Para leer `.xls` real se agregó SheetJS (`xlsx` en npm) SOLO en la rama
  de lectura (`listarHojasXLS`/`parsearArchivoXLS` en
  `backend/utils/inventarioImportacion.js`) — ExcelJS sigue siendo la
  librería para todo lo que el sitio YA escribía. **Trampa de npm**: el
  paquete `xlsx` publicado en el registro de npm está fijo en 0.18.5
  (SheetJS dejó de publicar ahí) y esa versión trae 2 CVE altas
  (prototype pollution, ReDoS) sin fix vía `npm audit fix` — la propia
  documentación de SheetJS recomienda instalar el tarball oficial
  parcheado directo de su CDN
  (`npm install https://cdn.sheetjs.com/xlsx-<version>/xlsx-<version>.tgz`)
  en vez del nombre del paquete a secas. Si se vuelve a tocar esta
  dependencia (actualizarla, reinstalar node_modules desde cero en otra
  máquina), confirmar con `npm audit` que sigue siendo la version del CDN
  y no la del registro — `npm install` sin el URL completo reinstala la
  0.18.5 vulnerable silenciosamente.
- **`Cache-Control: public, max-age=N` en un endpoint cuyo estado puede
  cambiar por un toggle de usuario es una trampa** (punto 375,
  2026-10-07): `GET /api/tema/:slug`/`GET /api/tema-base` cacheaban
  `max-age=300` mientras el portal de clientes estaba activo —
  reproducido con Playwright headed (misma pestaña reutilizada, como un
  usuario real): pausar → reactivar (vuelve a cachearse 300s) → pausar
  de nuevo DENTRO de esa ventana ya no mostraba el aviso, porque el
  navegador servía el `fetch` viejo sin volver a pedirlo. Una pestaña
  nueva sí lo mostraba — confirma que era caché del navegador, no lógica
  de pausado. Fix: `no-store` siempre, sin condicional por estado — si
  el dato puede cambiar por acción del propio usuario/admin en caliente,
  no se cachea client-side con `max-age`, punto. El servidor ya cachea
  internamente donde hace falta (`tenantContext.js`, 45s).
- **CSP y `blob:`/`data:`**: `default-src 'self'` NO cubre esos schemes
  para `img-src`/`frame-src` — declararlos explícitos
  (`img-src 'self' data: blob:`, `frame-src 'self' blob:`) si se usan
  imágenes/iframes con blob URLs.
- **Whitelist de extensiones estáticas en nginx**: `frontend/nginx.conf.template`
  (y su espejo `hostinger/frontend/nginx.conf.template`) tiene un `location`
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
- **`error_page 404` nunca a nivel `server{}` global si hay rutas
  `/api/*` proxyadas en el mismo server** (punto 376, 2026-10-07):
  `error_page` + `proxy_intercept_errors on` reescribe CUALQUIER
  respuesta con ese status que pase por ese server, incluida la de un
  proxy_pass — un 404 JSON real de `requiereFeature()` o de cualquier
  endpoint quedaría reescrito a HTML, rompiendo cualquier `fetch` del
  frontend que espere `res.json()` en un 404. La página 404 con
  identidad Clarvo (`frontend/404-clarvo.html`) se enganchó DENTRO del
  único `location` que hoy emite un 404 real sin pasar por un proxy (el
  catch-all `^/(?<tenant_slug>...)/.+$ { return 404; }`, mismo
  anti-enumeración de tenants), nunca en el bloque `server{}` — mismo
  criterio que ya aplica `requiereFeature()` en el backend (nunca tocar
  una superficie más ancha de la necesaria). Sin `=` en `error_page`: el
  status code se mantiene en 404 real, nunca se reescribe a 200.
- **Tests que mockean `ensureSchema.js`/`controlDb.js`: derivar las
  fixtures de la lista de columnas real, nunca copiarla a mano** (punto
  407, 2026-10-19 — N-02 de `sonar_1.1.html`): `COLUMNAS_NUEVAS`/
  `COLUMNAS_PLANES_NUEVAS` (`control/scripts/ensureSchema.js`) ya se
  desincronizaron 2 veces de la copia manual en
  `test/unit/ensureSchema.test.js` (conteos `toHaveBeenCalledTimes(N)`
  hardcodeados) — cada columna nueva agregada en una sesión posterior
  rompía el test en silencio hasta que alguien corría la suite. Fix
  aplicado: ambas constantes se exportan desde `ensureSchema.js` y el
  test las importa para construir `TODAS_LAS_COLUMNAS` y los conteos
  esperados en tiempo de ejecución — ninguna columna nueva debe volver a
  romper este test. Si se escribe un test nuevo sobre una función que
  itera un array de columnas/definiciones para migrar un esquema, aplicar
  el mismo patrón desde el inicio (exportar el array, nunca duplicarlo).
- **Dos fuentes distintas de 413 en las rutas de logo/favicon — no
  confundirlas al escribir un test de tamaño** (punto 408, 2026-10-19,
  M-05): (1) el límite del body parser (`express.json({limit:...})`,
  ahora 2mb global + 30mb scoped a `/internal/marca-logo` y
  `/internal/favicon`, `backend/server.js`) rechaza por tamaño del BODY
  JSON crudo (la cadena base64 + overhead); (2) el candado de negocio
  `IMAGEN_MAX_MB`/`IMAGEN_MAX_MB_MAX` (`backend/utils/ajustesGlobales.js`,
  default 2MB) rechaza por tamaño del BUFFER ya decodificado, con su
  propio 413 (`server.js:787` y hermanos). Un buffer de imagen de prueba
  que coincida por casualidad con el límite del body parser (ej. ambos en
  "2") puede disparar el candado de negocio en vez del que se quiere
  probar — al generar un payload de prueba para una ruta de imagen,
  calcular aparte: tamaño DECODIFICADO (contra `IMAGEN_MAX_MB`) vs tamaño
  del BODY JSON/base64 (contra el límite del parser), nunca asumir que
  son el mismo número.
- **`control/server.js` tiene un rate limiter GLOBAL sin prefijo de
  ruta** (`adminCredencialesLimiter`, `app.use(adminCredencialesLimiter)`
  sin path, M-05/sonar.html) — cuenta CUALQUIER respuesta no-2xx de
  CUALQUIER ruta contra un presupuesto compartido de 50 por IP/15min, y
  `control/test/integration/control.test.js` hace `require('../../server')`
  una sola vez al inicio del archivo, así que ese presupuesto se comparte
  entre TODOS los tests del archivo. Agregar un puñado de tests nuevos
  que esperan una respuesta de error (400/401/403/404) puede agotar ese
  presupuesto en silencio y tumbar con 429 tests completamente ajenos más
  abajo en el mismo archivo (reproducido real, punto 410: 3 tests 400 del
  candado de Turnstile rompieron las pruebas de `/health` del final).
  Fix: para un bloque de tests que vaya a provocar varias respuestas de
  error, aislar su propia `app` con `jest.resetModules()` +
  `require('../../server')` fresco dentro de CADA test (mismo patrón ya
  usado en `docsEnabled.test.js`), nunca reusar la `app` compartida del
  resto del archivo.
- **Patrón para integrar un servicio anti-bot/captcha externo (Cloudflare
  Turnstile, punto 410, M-06)**: falla CERRADO sin la llave real — sin
  `TURNSTILE_SECRET_KEY` configurado, `control/utils/turnstile.js`
  rechaza el onboarding en vez de omitir la verificación (decisión
  explícita del usuario, no asumir "fail open" para no romper flujos sin
  configurar). El default de desarrollo usa las llaves PÚBLICAS DE PRUEBA
  que el propio proveedor documenta (`1x00000000000000000000AA`/
  `1x0000000000000000000000000000000AA` para Turnstile, siempre
  aprueban) — nunca un secreto real hardcodeado, y SOLO en
  `docker-compose.yml` (desarrollo), nunca en `hostinger/`. El token del
  widget se verifica en el paso donde de verdad importa (la operación
  sensible/cara), no en el primer paso de un wizard multi-paso: los
  tokens de este tipo de servicio son de un solo uso y expiran en
  minutos, así que pedirlo al INICIO de un flujo largo lo invalida antes
  de que el usuario llegue al final. Replicar este mismo criterio
  (fail-closed + llaves de prueba públicas solo en dev + verificar en el
  paso sensible, no en el primero) si se integra otro servicio similar en
  el futuro.
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
  integrado en `hostinger/actualizar.sh`.
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
- **Detección de "página de portal de cliente" por path: la raíz pelada
  `/` cuenta como 0 segmentos** (punto 375, 2026-10-07):
  `frontend/theme.js:paginaEsPortalCliente()` partía
  `window.location.pathname` y solo reconocía rutas con nombre
  (`/login`, `/dashboard`, etc.) — nginx sirve `login.html` tanto en
  `/login` como en la raíz `/` (su `location /` catch-all), pero `/` no
  tiene ningún segmento nombrado que matchear. Cualquier lógica nueva que
  distinga "página de cliente" por path debe tratar explícitamente el
  caso de 0 segmentos, no solo iterar sobre nombres conocidos.
- **Dos tablas de flags globales que NO son la misma cosa**: un flag de
  **tenant** siempre vive en `control_tenants.tenants` (columna propia);
  un flag de **sitio base** (sin tenant) vive en `configuracion_global`
  dentro de la tabla `configuracion` del propio `backend`, vía
  `backend/utils/config.js` (`getConfiguracionGlobal`/
  `setConfiguracionGlobal`) — **nunca** en
  `control_tenants.ajustes_globales` (esa tabla es solo para el máximo de
  imagen global del punto 370, clave/valor sin relación). Confundir las
  dos al verificar el estado de un flag de sitio base da un resultado
  "limpio" falso — ver punto 375.
- **`ordenesCache` ya NO es "todas las ventas"** (punto 380, 2026-10-08):
  desde que `GET /api/admin/ordenes-compra` se paginó server-side,
  `frontend/admin.js:ordenesCache` es solo la PÁGINA actual de Ventas
  (25 filas por defecto). Cuentas por cobrar/Resumen financiero NUNCA
  deben leer `ordenesCache` para sus KPIs — tienen su propia fuente,
  `cxcBaseCache` (pendientes + cobradas recientes, tope 500,
  `cargarCxcBase()`), que alimenta `calcularMetricasCxc()` sin cambiarla.
  El histórico paginable sin tope de "Cobradas" vive aparte en
  `cxcCobradasCache`/`cargarCxcCobradasPagina()`. Antes de reusar
  cualquiera de estas 3 variables en código nuevo, confirmar cuál es:
  página de Ventas, agregado acotado de CxC, o histórico paginado de
  Cobradas — son 3 cosas distintas a propósito, nunca intercambiables.
  Mismo criterio aplica a cualquier vista futura que necesite "todo el
  histórico sin límite" (nunca un solo fetch sin paginar) vs. "un
  agregado financiero" (nunca necesita el dataset completo si se puede
  calcular con SQL, ver `resumenCxc` en el mismo endpoint).
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
  feather-like ya usados en el sitio o un `<span>` circular de color. Esto
  incluye glifos Unicode de señalización usados como texto crudo
  (`✕`/`✓`/`⚠`/`⏳`/`⟳`/`✗`, etc.), no solo emojis de color — hallazgo
  m-15 (`sonar_1.1.html`, punto 409) encontró 70 de estos en 7 archivos
  del frontend, todos ya migrados a SVG inline. `frontend/admin.js` ya
  define `ICONO_PENDIENTE_ALERTA` (triángulo de alerta) e
  `ICONO_PENDIENTE_RELOJ` (reloj) para los badges de "pendiente de
  sincronizar" del modo offline — reusar esos antes de volver a escribir
  un glifo o un `<svg>` nuevo para ese mismo significado.
- **`backend/` y `control/` son builds de Docker separados** — nunca
  copiar código entre ellos en producción; código pequeño compartido se
  duplica a propósito (mismo patrón que el frontend sin bundler).
- **`hostinger/`** (paquete de despliegue para `yt.addv.com.mx`, el
  server de pruebas real del usuario alojado en Hostinger — carpeta
  renombrada de `prod/` a `hostinger/` el 2026-10-28, petición explícita
  del usuario, "que quede registrado en el proyecto"; `.gitignore` ya
  trae la entrada `hostinger/` para que nunca se trackeé por accidente)
  **NO es parte del producto, es la herramienta de despliegue** (decisión
  del usuario, 2026-10-22, punto 412 de PROJECT_STATE.md): se reescribe
  con cada actualización y puede borrarse y regenerarse completa.
  Sincronizarlo por CONTENIDO tras cualquier sesión relevante, nunca
  `git add`. Un desfase contra su fuente **nunca se cuenta como hallazgo
  del producto** en auditorías (métricas, quality gate, code smells) —
  es un paso del proceso de deploy, no deuda de código. **La ruta
  REMOTA en el VPS sigue siendo `/root/clarvo/prod/`** (sin renombrar —
  ese es un cambio aparte, en el servidor en vivo, nunca asumido ni
  hecho sin pedirlo explícito) — no confundir el nombre de la carpeta
  LOCAL (ahora `hostinger/`) con la ruta remota (sigue `prod/`) al armar
  cualquier comando de despliegue.
- **Credenciales angostas cross-tenant** (`control_app`): sin
  `REFERENCES`/`DELETE` en tablas de otros tenants — usar soft-delete en
  vez de FK/DELETE físico en cualquier tabla cross-tenant. **El alcance es
  más amplio de lo que suena** (punto 433, bug real encontrado probando
  en vivo, no en revisión de código): `control_app` no tiene `DELETE` en
  NINGUNA tabla, ni siquiera las propias de `control_tenants` como
  `ajustes_globales` (confirmado: `grep -rn "DELETE FROM" control/` da
  cero resultados en todo el código existente — nadie lo había
  necesitado hasta este punto). Un `DELETE FROM ajustes_globales WHERE
  clave=?` para implementar "borrar este ajuste" truena en runtime con
  `DELETE command denied to user 'control_app'` — nunca se detecta con
  `node --check` ni con tests que mockeen el pool. Patrón correcto para
  "sin valor" en una tabla clave/valor: guardar cadena vacía (`''`) en
  vez de borrar la fila, y que el getter trate `''` igual que "la fila no
  existe" (ver `ajustesGlobales.js:getValorTexto/setValorTexto`). Antes
  de escribir cualquier `DELETE FROM` nuevo en `control/`, asumir que
  fallará y usar soft-delete/valor vacío en su lugar — no es una
  excepción rara, es la regla por defecto en este servicio.
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
- **Contraste WCAG en JS: nunca le quites el `#` al hex antes de medir
  luminancia** (punto 373, 2026-10-06): `luminancia(hex)` lee los canales
  con `hex.slice(1,3)/(3,5)/(5,7)` — asume el `#` en la posición 0 (mismo
  patrón en `backend/utils/tenantTema.js`, `control/utils/tenantTema.js`
  y `frontend/marcaTemaEditor.js`). Un `contraste(a,b)` que hace
  `a.replace('#','')` ANTES de llamar a `luminancia()` corre los índices
  un lugar y calcula un contraste completamente distinto al real — bug
  real en `marcaTemaEditor.js`: con los colores base default, el aviso
  "en vivo" del cliente marcaba inválido un par que en realidad pasaba
  AA. El backend nunca tuvo el bug (nunca quita el `#`); solo la
  validación duplicada del cliente divergió en silencio. Al escribir o
  copiar esta fórmula en un archivo nuevo: o se mantiene el `#` en el hex
  SIEMPRE hasta `luminancia()`, o se cambia `luminancia()` para aceptar
  ambos formatos — nunca asumir que "ya está probado en otro archivo" sin
  correr el cálculo contra un par conocido (ej. `#0F6E5D` vs `#ffffff`
  ≈ 5.8:1, debe pasar AA de 3:1) o un E2E real que ejercite el aviso.
- **`theme.js` es el chokepoint del frontend para "esta página debe
  comportarse distinto según el tenant"** (punto 374, 2026-10-06): ya se
  carga en las 6 páginas del portal de cliente (login/dashboard/tickets/
  csf/restablecer/mi-cuenta) y en `/admin`, vía `GET /api/tema/:slug`
  (público). Un override de página completa (ej. "portal desactivado")
  se agrega AHÍ, nunca repitiendo el chequeo en cada script de página —
  mismo principio que `requireUserAuth` del lado del backend. Al agregar
  un override así: (1) nunca aplicarlo a `/admin` aunque `theme.js`
  también corra ahí (ver `RUTAS_PORTAL_CLIENTE` vs
  `RUTAS_PAGINA_MULTITENANT`, listas separadas a propósito); (2) revisar
  si la página nueva ya estaba en la lista de detección de slug — `theme.js`
  tenía a `mi-cuenta.html` cargando el script pero faltaba en
  `RUTAS_PAGINA_MULTITENANT`, así que nunca pintaba tema ahí (gap
  preexistente, cerrado al agregar este override porque lo necesitaba
  directamente) — al tocar `theme.js`, verificar que la lista de rutas
  cubra TODAS las páginas que de verdad cargan el script, no solo las que
  "deberían".
- **Exponer un dato del tenant solo cuando de verdad hace falta, no
  siempre "por si acaso"** (mismo punto 374): `GET /api/tema/:slug` ya
  tenía el precedente de no exponer `contacto_email` en crudo (solo un
  booleano, `tieneAclaraciones`) — al necesitar el correo real para la
  página de portal desactivado, se agregó un campo NUEVO
  (`contactoEmailPortalApagado`) que solo trae el valor cuando
  `portalClientesHabilitado` es `false`; con el portal activo sigue
  `null`. Antes de ampliar un endpoint público existente para que
  devuelva un dato que antes ocultaba a propósito, preguntarse si el caso
  de uso nuevo requiere SIEMPRE ese dato o solo en un estado específico —
  condicionar la exposición en vez de aflojar el campo para todos los
  casos.
- Antes de dar por "no disponible" una skill/herramienta mencionada por
  el usuario: revisar el catálogo de skills activas, luego `D:\cc`,
  luego el repositorio oficial — nunca asumir su función.
- **Unicidad de `usuarios.email`: acotada a `perfil='cliente'`, nunca
  global** (punto 377, 2026-10-07, decisión explícita del usuario): dos
  cuentas `perfil='cliente'` NUNCA pueden compartir correo, pero una
  cuenta admin (`administrador`/`fiscal`/`ventas`/`inventario`) SÍ puede
  compartir correo con una cuenta cliente — el lado admin nunca usa
  correo para login (usa `rfc` como nombre de usuario,
  `backend/utils/auth.js:194`, ya acotado a esos 4 perfiles). Cualquier
  query nueva sobre `usuarios` que busque/valide por `email` debe decidir
  conscientemente su alcance: candado de duplicado (`PUT /api/mi-cuenta`),
  login del portal de clientes (`POST /api/auth/login`), desplegable de
  Ventas (`GET /api/admin/correos-registrados`) y el check de "cliente ya
  registrado" en `POST /api/admin/ordenes-compra` SIEMPRE llevan
  `AND perfil = 'cliente'` — omitirlo en login es especialmente grave: un
  correo compartido puede traer la fila ADMIN en vez de la CLIENTE (orden
  de MySQL no garantizado) y el cliente real recibe "contraseña
  incorrecta" con su contraseña correcta (bug real, reproducido y
  corregido en el punto 377). **Pendiente, fuera de alcance a propósito**:
  `POST /api/auth/recuperar` sigue sin este filtro (`LIMIT 1` liso) — con
  un correo compartido admin/cliente, el token de recuperación se genera
  para una sola de las 2 filas, no determinístico cuál; resolverlo
  requiere decidir cuál cuenta debe ganar o pedir que se especifique, no
  es un one-liner.
- **Tarjeta nueva en Configuraciones (`/admin`): 3 registros obligatorios
  en `frontend/admin.js`, no solo el HTML** (punto 378, 2026-10-08): el
  nav `.config-modal-nav-item[data-tarjeta="..."]` solo funciona si la
  tarjeta está en los 3 — `CONFIG_SECCIONES` (si falta, el clic en el nav
  no hace NADA: `seleccionarSeccionConfig()` retorna temprano, la tarjeta
  queda oculta para siempre aunque el HTML esté perfecto),
  `GRUPOS_CONFIG_NAV` (oculta el título del grupo si ninguna tarjeta hija
  es visible) y `tarjetasConfigPermitidas` por perfil en
  `RESTRICCIONES_PERFIL` (qué perfiles la ven). Bug real: se escribió el
  HTML completo de `facturacion-toggle-card` sin las 2 primeras entradas
  — el E2E nuevo lo atrapó (`toBeVisible()` fallando con "hidden"), no la
  inspección visual. **Además**: una tarjeta que es ELLA MISMA el
  interruptor de un flag (ej. "Habilitar Facturación") nunca debe tener
  entrada en `PLAN_GATE_TARJETA_CONFIG` con ese mismo flag — si
  `global-config-card` se oculta cuando `facturacionHabilitada` es falso,
  una tarjeta nueva que también dependiera de ese flag para su propia
  visibilidad se escondería a sí misma en cuanto el admin la apagara, sin
  forma de volver a encenderla desde la UI (mismo motivo por el que
  "Portal de clientes" vive en Mi Cuenta en vez de dentro de
  `global-config-card`, punto 375).
- **Vista nueva del sidebar de `/admin`: mismo patrón de 3 registros que
  las tarjetas de Configuraciones, pero en su propio sistema** (punto
  379, 2026-10-08): una vista nueva (botón del sidebar + contenedor
  `#vista-X`) necesita `mapaNavPorVista()` (dispatch de
  `cambiarVistaPrincipal`), `GRUPOS_SIDEBAR_NAV` (oculta el título del
  grupo si ninguna vista hija es visible) y `vistasPermitidas` por perfil
  en `RESTRICCIONES_PERFIL` — además de las 2 líneas en
  `cambiarVistaPrincipal()` (toggle de clase `is-active` + `hidden`) y el
  `if (vista === 'X') cargarX();` del loader. Es un sistema HERMANO del
  de tarjetas de Configuraciones (CONFIG_SECCIONES/GRUPOS_CONFIG_NAV/
  tarjetasConfigPermitidas), nunca el mismo — no confundir cuál checklist
  aplica según si lo nuevo es una vista del sidebar o una tarjeta dentro
  del modal de Configuraciones.
- **Pestaña nueva del modal de edición de `/control` (`cambiarTabEditar`)**:
  el array `TABS` en `frontend/control.js` es la única fuente de verdad —
  agregar el panel HTML sin sumar la clave ahí dejaría la pestaña
  seleccionable pero su panel nunca visible (mismo bug-shape que
  `CONFIG_SECCIONES`/`mapaNavPorVista` de `/admin`, punto 378-379, versión
  `/control`). Una pestaña que es INDEPENDIENTE del form general
  (`#control-form-editar`) — como "Identidad visual" y ahora "Suscripción"
  (punto 381) — necesita su PROPIO botón de guardar + su PROPIO
  `PUT`/endpoint, nunca agregarse al submit compartido: mezclar los dos
  patrones (campos que viajan en el submit general de "Guardar cambios" +
  campos que se guardan solos) en una misma pestaña confunde al operador
  sobre qué botón persiste qué.
- **`.algo[hidden]{display:none}` explícito es obligatorio en cualquier
  clase nueva con `display` distinto de `none`** (punto 379): el
  atributo HTML `hidden` se cancela si una regla de la hoja de estilo del
  AUTOR (no la del user-agent) le da `display` a esa clase con la MISMA
  especificidad — mismo principio ya aplicado en `admin.css` para
  `.admin-notif-dot`/`.admin-notif-empty`. Bug real atrapado antes de
  probar en vivo: `.portal-notif-wrap { display: inline-flex; }` sin su
  `[hidden]` explícito habría dejado la campana del portal de cliente
  SIEMPRE visible sin importar el atributo `hidden` en el DOM.
- **Carpeta `calidad/` (punto 414, 2026-10-23)**: los informes tipo
  SonarQube/auditoría (`eval.html`, `sonar.html`, `sonar_1.1.html`,
  `sonar_1.2.html`) viven ahí, no en la raíz — moverlos con `git mv` no
  rompe nada: ningún script los abre por ruta, solo se citan como texto
  en comentarios (`// Hallazgo M-XX (sonar.html)...`). Un informe nuevo
  de esta familia se crea directo dentro de `calidad/`, no en la raíz.
- **`uploads/` (carpeta raíz) era un bind mount vestigial, ya movido a
  `.trash/` (punto 414)**: desde el segmento 5 (MinIO), los 5 `multer(...)`
  de `backend/server.js` usan `memoryStorage` — `UPLOAD_DIR`/
  `TICKETS_UPLOAD_DIR`/`FACTURAS_UPLOAD_DIR` solo hacían `mkdirSync` al
  arrancar, ningún handler leía/escribía ahí. `docker-compose.yml` y
  `hostinger/docker-compose.prod.yml` **siguen** con el bind mount
  `./uploads:/app/uploads` y `UPLOAD_DIR=/app/uploads` sin tocar (fuera de
  alcance de este punto, no se editó infraestructura) — Docker recrea la
  carpeta vacía en el host si no existe, así que no rompe `docker compose
  up`, pero es config muerta que una sesión futura puede retirar con
  aprobación explícita. La carpeta `webp/` (punto 400, módulo de
  compresión aislado y nunca integrado a Clarvo) y un `test-results/`
  suelto en la raíz (artefacto de Playwright corrido desde el directorio
  equivocado, duplica `e2e/test-results/` que sí está en `.gitignore`)
  también se movieron a `.trash/` en el mismo punto.
- **El servicio de almacenamiento S3 en `docker-compose.yml` ya NO es
  MinIO — es Garage (punto 415, 2026-10-23)**: las 3 vías gratuitas de
  MinIO (quay.io, bitnami, binario directo de dl.min.io) cerraron el
  mismo día. `backend/utils/storage.js` no cambió — mismas variables
  `MINIO_*`, solo se agregó `MINIO_REGION=garage` (Garage SÍ valida
  región, a diferencia de MinIO). Garage no crea el bucket vía S3
  `CreateBucket` — lo hace el servicio one-shot `garage-init`
  (`docker/garage-init/`, solo REST contra el puerto admin 3903, nunca
  el binario/RPC) antes de que `backend` arranque. Solo se tocó
  `docker-compose.yml` (desarrollo local) — `hostinger/` sigue con su MinIO
  tal cual, fuera de alcance a propósito.
- **`control/server.js:iniciar()` tenía un bug de orden invisible hasta
  un wipe 100% de Docker (punto 415)**: `asegurarColumnasCicloVidaTenant()`
  corría ANTES que `asegurarTablasSucursales()`, pero la primera hace un
  `UPDATE` sobre `tenants.grupo_sucursal_id`, columna que crea la
  segunda. Todo ambiente existente ya tenía esa columna de una corrida
  anterior, así que ningún `docker compose up` normal lo disparaba —
  solo una base `control_tenants` 100% nueva lo expone. Ya corregido
  (orden invertido); si se agrega una función nueva a `ensureSchema.js`
  que dependa de una columna de OTRA función, verificar el orden real de
  llamadas en `iniciar()`, no asumir que "ya existe" porque siempre
  existió en los ambientes de prueba usados hasta ahora.
- **`mysql-control` no publica puerto al host** (a propósito, aislado en
  `fiscal-net`) — si `backend/scripts/provisionar-tenant.js` necesita
  correrse desde el host después de un wipe completo (el README todavía
  documenta la arquitectura vieja de una sola instancia compartida), usar
  un `docker-compose.override.yml` temporal con
  `ports: ["127.0.0.1:3307:3306"]` solo en `mysql-control`, correr el
  script con `DB_HOST=127.0.0.1 DB_PORT=3307`, y borrar el override +
  recrear `mysql-control` al terminar — nunca dejar ese puerto expuesto
  de forma permanente sin que el usuario lo pida explícito.
- **Bloqueo por suscripción (punto 417): `adminPerfil === 'super'` NO es
  lo mismo que "el super admin real"** — `api_credencial`/`api_clave`
  (acceso tenant-scoped) también reciben `adminPerfil = 'super'`, pero
  SÍ deben bloquearse si la suscripción está vencida; solo
  `adminMecanismo === 'admin_users'` (el mismo mecanismo que usa
  `/control`) es el super admin real que nunca se bloquea. Filtrar por
  `adminPerfil` ahí habría dejado pasar cualquier credencial API de un
  tenant moroso. Ver `backend/utils/auth.js:finalizarAutenticacionAdmin`.
  Regla no-retroactiva: `suscripcion_estatus = NULL` ("sin configurar")
  nunca bloquea — todo tenant existente antes de este punto tiene ese
  valor, bloquear ahí habría apagado la administración de cada cliente
  activo el día del despliegue.
- **Insertar una columna nueva EN MEDIO de un `UPDATE ... SET` rompe
  cualquier test que indexe los parámetros por posición** (patrón ya
  usado en `tenantSuscripcion.js` antes del punto 417) — al agregar
  columnas a un `UPDATE` con tests que hacen
  `pool.query.mock.calls[1][1][N]`, agregarlas siempre al FINAL de la
  lista de columnas/params, nunca intercaladas, o hay que tocar cada
  test existente que referencia un índice.

- **`PUT /api/admin/usuarios/:id/password` ya NO pide la contraseña del
  operador** (punto 418, 2026-10-23 — reemplaza el Hallazgo M-09
  anterior): decisión explícita del usuario, confunde resetear la
  contraseña de OTRO usuario pidiendo la PROPIA. El control
  compensatorio es la bitácora de auditoría de `/api/admin`
  (`adminAuditoria.js`), sin cambios. `PUT /api/admin/mi-cuenta/password`
  (cambiar TU PROPIA contraseña) nunca tuvo este problema y sigue
  exigiendo la actual — no confundir ambas rutas al tocar password
  flows en el futuro.
- **"Cuenta raíz/maestra" (`usuarios.es_cuenta_raiz`, punto 418)**:
  única por tenant/sitio base, solo perfil `administrador` puede
  serlo, exclusiva (marcar una nueva desmarca la anterior en el mismo
  endpoint). Es quien ve "Datos de pago" en Mi Cuenta — `admin_users`
  (super real, sin fila en `usuarios`) también lo ve siempre, mismo
  criterio que su acceso total ya documentado. Backfill de la columna
  nueva es CONDICIONAL (solo al crear la columna, nunca en cada
  restart) — mismo gotcha de `ensureSchema()` ya documentado abajo para
  cualquier columna nueva que necesite un valor inicial no trivial.

- **Vista del SPA sin botón en el sidebar** (`#vista-metodo-pago`, punto
  418): no toda vista necesita entrada en `mapaNavPorVista`/
  `GRUPOS_SIDEBAR_NAV` (puntos 378-379) — si solo se entra desde un botón
  específico (ej. "Actualizar método de pago" en Mi Cuenta), basta con
  agregar su `els.vistaX.hidden = vista !== 'x';` dentro de
  `cambiarVistaPrincipal()` (sin togglear ningún botón de nav que no
  existe) y cablear el botón de origen para llamar
  `cambiarVistaPrincipal('x')` directamente.
- **Nunca inventar un monto en una pantalla de pago, ni siquiera en un
  mock** (punto 418, Deck A2): el precio mostrado en "Actualizar método
  de pago" viene de `control_tenants.planes.precio_mensual/anual` (dato
  real), expuesto en `GET /api/admin/mi-cuenta` como
  `empresa.suscripcion.precioMensual/precioAnual` — si el plan no tiene
  precio capturado, se muestra "Sin definir", nunca un número de
  relleno.

- **El "toast" ya NO es flotante** (punto 423, 2026-10-24): `showToast()`
  en `admin.js`/`control.js`/`login.js`/`portal.js`/`app.js` inserta el
  mismo nodo `#toast`/`#control-toast` dentro del contenido afectado
  (`contenedorAvisoActivo()`: modal abierto > vista activa > panel de
  auth > `<main>` > `body`) en vez de flotar fijo. Ningún call site de
  `showToast(mensaje, esError)` cambió — si se agrega un `.js` nuevo con
  su propio toast, replicar `contenedorAvisoActivo()` ahí (duplicar, no
  importar) en vez de volver a un `position:fixed`. Fase 2 pendiente
  (generalizar la palomita de éxito de "Registrar venta"/"Cobro CxC" a
  cada guardado del sitio) — el usuario todavía no elige entre las 6
  propuestas del segundo Artifact; no asumir que ya se hizo.
- **Consecuencia del punto anterior: `showToast()` ANTES de cerrar el
  modal lo oculta sin que nadie lo vea** (punto 434, 2026-10-27): como el
  toast nace DENTRO de `.modal-overlay:not([hidden]) .modal` cuando hay
  un modal abierto, el patrón `showToast(...); cerrarXModal();` inserta
  el toast como hijo del modal y lo oculta un instante después al
  ocultar ese mismo modal — el usuario ve el modal cerrarse sin ningún
  mensaje (bug real reportado por el usuario en Planes de `/control`,
  encontrado también en Super Admins, y en Tickets/Usuarios/Producto de
  `admin.js`, 8 sitios en total). Orden correcto: cerrar el modal
  PRIMERO, mostrar el toast DESPUÉS — con el modal ya oculto,
  `contenedorAvisoActivo()` cae a la vista activa detrás de él, que sigue
  visible. Si el mensaje del toast lee una variable que la propia función
  de cierre resetea (`editandoId`, `usuarioActual`, etc. — pasa en
  Planes y en "Cambiar contraseña"), capturar el mensaje en una constante
  ANTES de cerrar, no después. Cualquier flujo nuevo de
  guardar-y-cerrar-modal: grepear `showToast(` seguido de un cierre de
  modal antes de dar el orden por bueno.

- **Un bloqueo de plan/negocio nunca se pinta igual que un error de
  campo** (punto 424, 2026-10-25): `.field-error` (clase compartida de
  todo el sitio) es para "corrige este dato" — un `codigo` propio en la
  respuesta 400 (ej. `CUOTA_USUARIOS_EXCEDIDA`) que señala un límite de
  plan/suscripción se redibuja como banner independiente
  (`.field-error.aviso-cuota` en `admin.css`, mismo lenguaje que
  `.micuenta-banner-market`: `--color-warn`/`--color-warn-soft`, nunca
  `--color-error`) con CTA real, nunca texto plano en el mismo contenedor
  que un typo de RFC. Patrón: `mostrarAvisoCuotaUsuarios()` en
  `frontend/admin.js` (Crear/Editar usuario) — replicar la misma idea
  (detectar `data.codigo`, banner propio + CTA a la sección relevante de
  Mi Cuenta, foco automático vía `tabindex="-1"` + `.focus()`) para
  cualquier otro 400 futuro que sea un límite de plan y no un error de
  formulario.

- **Anti-enumeración de tenants: una sola excepción deliberada**
  (punto 422, 2026-10-24): `backend/utils/tenantContext.js` responde
  SIEMPRE el mismo 404 "Tenant no encontrado" para cualquier `estado !=
  'activo'` (incluido un slug que nunca existió) — salvo
  `estado === 'suspendido'`, que desde este punto devuelve 403
  `TENANT_SUSPENDIDO` con mensaje explícito (decisión consciente del
  usuario, acepta el leak de "este slug fue cliente real" porque
  `suspendido` **solo** lo pone `/control`, siempre por irregularidades
  — nunca un estado que el propio tenant pueda alcanzar). `baja` y
  `provisioning` siguen 100% detrás del 404 genérico — si se necesita
  distinguir OTRO estado en el futuro, es una decisión nueva, no asumir
  que "ya se abrió la puerta" a mostrar cualquier estado.

- **Stripe: los planes NUNCA viven como Product/Price en el catálogo de
  Stripe** (punto 425, 2026-10-26/27): cada Checkout Session
  (`control/utils/stripePagos.js:crearCheckoutSession`) arma el precio al
  vuelo con `price_data`/`product_data` inline, usando el precio real
  resuelto de `control_tenants.planes` (`resolverPlanPorClave()`) —
  Stripe genera un Product/Price efímero por sesión (puede aparecer
  listado en el Dashboard) pero NUNCA es la fuente de verdad ni algo
  reusable/editable ahí. Cambiar un precio en `/control` se refleja en el
  siguiente Checkout sin tocar Stripe. Excepción real: los **cupones**
  (`control/utils/stripeConfig.js`) sí son objetos reales de Stripe
  (`stripe.coupons.create()`/`stripe.promotionCodes.create()`) — por eso
  "Reporte de cupones" tiene que cruzar contra la API en vez de leer solo
  la BD local. No confundir ambos mecanismos al tocar código de pagos.
  **Segunda excepción real (punto 440)**: `stripe.subscriptionItems.create()`/
  `subscriptions.create()` (llamadas directas, fuera de un Checkout
  Session — usadas para upscale/subir de plan sobre una Subscription ya
  activa) NO soportan `product_data` inline, exigen un `product` ya
  existente — ver el gotcha dedicado más abajo. El Checkout Session del
  onboarding sigue 100% efímero como describe este punto, sin cambios.
- **`payment_method_types` ya no se acepta al crear un Checkout Session**
  (confirmado real contra Stripe, 2026-10-26, ver `DOCS/confStripe.html`
  paso 5): Stripe gobierna 100% los métodos de pago habilitados desde el
  Dashboard (Settings → Payment methods) — pasar ese parámetro revienta
  con `StripeInvalidRequestError`. `control/utils/stripeConfig.js:
  metodosPagoInfo()` es deliberadamente solo texto + link al Dashboard,
  nunca un estado real controlable por API (sí añade `modo`
  prueba/producción y `webhookConfigurado`, ambos leídos de variables de
  entorno del propio proceso — gratis, reales, nunca inventados).
- **`stripe.promotionCodes.create()` ya no acepta `coupon: id` plano** —
  la forma real (confirmada leyendo
  `node_modules/stripe/cjs/resources/PromotionCodes.d.ts` de la versión
  instalada, nunca asumida de memoria/docs viejas) es anidada:
  `promotion: { type: 'coupon', coupon: id }`. Mismo criterio al LEER:
  `listarCodigosDescuento()` lee `p.promotion.coupon`, nunca `p.coupon`.
  Si la librería `stripe` se actualiza alguna vez, volver a verificar
  contra el `.d.ts` real antes de asumir que la forma sigue igual.
- **Sin `stripe listen` corriendo, el webhook de pago NUNCA llega en
  local** (punto 430, 2026-10-27): Stripe no puede alcanzar
  `localhost`/`127.0.0.1` desde sus servidores — un pago real completado
  en Checkout test se queda para siempre en `pago_estado='pendiente'`
  (confirmado real: el modal del sitio quedó en "Casi listo, falta
  confirmar tu pago" indefinidamente pese a que Stripe ya marcaba
  `payment_status:'paid'`). Esto NO es un bug del código — es que nadie
  reenvía el evento. Dos formas de probar el flujo completo en local:
  (1) correr `stripe listen --forward-to localhost:8088/api/control/webhooks/stripe`
  ANTES de pagar (recibe eventos nuevos en tiempo real); (2) si el pago ya
  se hizo sin listener activo, recuperar el evento real
  (`GET https://api.stripe.com/v1/events?type=checkout.session.completed`,
  buscar por el `cs_test_...` de la sesión) y reenviarlo firmado a mano
  con `stripe.webhooks.generateTestHeaderString({payload, secret})` +
  POST directo al puerto interno de `control` (4001, no el 8088 de
  nginx) en `/api/control/webhooks/stripe` — nunca fabricar el evento
  con `stripe trigger` genérico, usa datos reales de la sesión real.
  `stripe events resend <id>` (CLI) es la vía oficial si el CLI está
  instalado y logueado; el POST firmado a mano es el respaldo cuando no.
- **`127.0.0.1` y `localhost` son orígenes DISTINTOS para CORS/CSP,
  aunque sea la misma máquina** (punto 430, 2026-10-27): el sitio
  público en local a veces corre en una forma, a veces en la otra —
  mezclarlos entre `ONBOARDING_CORS_ORIGIN`/`PUBLIC_APP_BASE_URL`
  (`portalFac/.env`) y la URL real que el navegador usa rompe el
  onboarding con "No se pudo conectar" (sin ningún error de CORS visible
  en consola si el mismatch es solo de host, no de CSP). Estandarizado a
  `localhost` en los 3 lugares (los 2 de `portalFac/.env` +
  `clarvo-Site/.env`) — si se vuelve a tocar esta config, los 3 deben
  usar la MISMA forma, nunca mezclar.
- **El wizard de onboarding público: "Pagar" DEBE ser el último paso,
  nunca uno intermedio** (punto 430, 2026-10-27): el webhook de Stripe
  confirma el pago en 1-3 segundos — si quedan pasos de captura de datos
  DESPUÉS de pagar (como estaba antes: Pago era el paso 2 de 5),
  `convertirBorrador()` casi siempre falla por falta de datos cuando el
  webhook llega, Y el evento de Stripe queda marcado "ya procesado"
  ANTES de intentar la conversión — sin ningún reintento automático
  posible, ni siquiera reenviando el mismo evento a mano. Reproducido
  real 2 veces. El orden correcto, ya implementado
  (`clarvo-Site/OnboardingModal.tsx`): Plan → Empresa → Config →
  Credenciales → Pago (último) → Completado. Cualquier campo nuevo que
  el wizard necesite capturar debe ir ANTES del paso de pago, nunca
  después.
- **El resume-from-URL tras volver de Stripe NUNCA debe usar
  `obtenerBorrador()` para el caso de éxito** (punto 430, 2026-10-27):
  esa función exige `estado='activo'` en el servidor — en cuanto el
  webhook convierte el borrador (`estado='convertido'`), carrera real
  contra la misma carga de la página de éxito (~1-3s ambos), ese fetch
  da 404 y el visitante que SÍ pagó ve el sitio normal sin ningún
  mensaje. `estadoPago()`/`obtenerEstadoPago()` nunca exige ese estado
  (a propósito) — es la única fuente confiable para
  `paso==='completado'`. Si se agrega otro paso de retorno que dependa
  de leer el borrador YA convertido, usar `estadoPago()`, nunca
  `obtenerBorrador()`.
- **`stripe.subscriptionItems.create()`/`subscriptions.create()` NO
  aceptan `price_data.product_data` inline** (punto 440, 2026-10-28,
  confirmado real contra la API de prueba) — a diferencia de un Checkout
  Session (`line_items[].price_data.product_data`, que SÍ lo soporta y
  es como está hecho el plan del onboarding), estas 2 llamadas directas
  exigen un `product` ya existente (ID de un Product real). Patrón: crear
  el Product una sola vez (lazy, la primera vez que se necesita) y
  cachear su id — `funcionalidades_upscale.stripe_product_id` para
  upscale, `ajustes_globales` clave `stripe_product_id_plan` para cambios
  de plan — el PRECIO sigue siendo ad-hoc en cada operación, solo el
  contenedor se persiste, por requisito de la API, no por elección de
  diseño. Si se agrega un tercer caso que toque Subscription Items
  directamente (no vía Checkout), aplicar el mismo patrón desde el
  inicio — `product_data` ahí truena con
  `Received unknown parameter: ... [price_data][product_data]`.
- **Una acción de retención/upsell nunca tiene sentido en la fila de un
  tenant que YA cancela, si esa acción no toca `cancel_at_period_end`**
  (punto 440, encontrado por el usuario revisando el reporte, no por mí):
  "Subir plan" en el reporte de cancelaciones cobraba una mejora real en
  Stripe sin reactivar nada — el tenant pagaba por algo que de todas
  formas se cancela en el corte. Vino de copiar el botón del mockup
  equivocado (D2 era para "tenants cerca de su límite", no para
  cancelaciones). Reemplazado por "Enviar propuesta de retención"
  (correo manual, visible solo si `suscripcion_descuento_retencion_usado=0`).
  Antes de poner un botón de upsell en una fila de "ya se fue", preguntar
  primero si esa acción de verdad revierte la salida — si no, no
  pertenece ahí.
- **`invoice.subscription` ya NO existe en la versión de API de Stripe
  que trae el SDK instalado — CRÍTICO, bug real encontrado hasta probar
  una renovación de verdad (punto 440, addendum 2)**: el id de la
  Subscription de una Invoice vive ahora en
  `invoice.parent.subscription_details.subscription`. El webhook
  `invoice.payment_succeeded` leía el campo viejo, resolvía `undefined`,
  no encontraba el tenant y retornaba SIN actualizar nada —
  **respondiendo 200 igual, sin ningún error**. En producción esto
  habría significado: Stripe cobra bien cada corte, pero
  `suscripcion_expira_en` se queda congelada para siempre en la fecha
  del primer cobro, en completo silencio. Fix:
  `webhooksSuscripcion.js:resolverSubscriptionIdDeInvoice()` lee el
  campo nuevo primero, cae al viejo como fallback. `lines[0].period`
  SÍ sigue en su lugar de siempre (no se movió) — solo `subscription` se
  reestructuró. Si se lee cualquier otro campo "de nivel superior" de
  un objeto Invoice en código nuevo, verificar primero contra un objeto
  real (`stripe.invoices.retrieve()`) si también migró a vivir bajo
  `invoice.parent.*` — no asumir que la forma de hace unos puntos sigue
  igual. Solo se detectó probando una renovación real completa (Test
  Clock avanzado + webhook real entregado) — ni `node --check` ni mocks
  lo hubieran atrapado nunca.
- **Nunca cobrar en Stripe antes de correr la validación local que podría
  rechazar el cambio** (punto 440): un flujo que (a) cobra una proración
  real y (b) después aplica el cambio en la BD local con su propia
  validación, puede cobrar dinero real por un cambio que la validación
  rechaza después — bug real encontrado subiendo de plan (D1): el cargo
  a Stripe pasaba ANTES de que `tenantEdicion.js:resolverPlanYFunciones`
  revisara el tope de disco por tenant, así que un rechazo dejaba al
  tenant cobrado sin el plan nuevo. Fix: correr (duplicada a propósito,
  nunca tocar la función compartida con `/control`) la misma validación
  ANTES de tocar Stripe. Antes de escribir cualquier flujo nuevo que
  cobre y después aplique un cambio con su propia validación interna,
  invertir el orden: validar primero, cobrar después.
- **`tenantEdicion.js:actualizarDatosTenant` fija `disco_cuota_mb`/
  `max_usuarios` al valor BASE del plan nuevo al reasignar plan — pisa
  cualquier upscale que el tenant ya hubiera comprado y pagado por
  separado** (punto 440, bug preexistente desde que existe el upscale de
  disco, punto 433 — nunca antes expuesto porque nadie había comprado un
  upscale Y cambiado de plan en la misma sesión hasta que D1 lo hizo
  posible desde Mi Cuenta). Afecta TAMBIÉN el camino manual de `/control`
  → "Editar empresa" → cambiar plan, no solo D1 — **sigue sin corregirse
  ahí**, fuera de alcance a propósito (cambiar una función tan compartida
  necesita aprobación explícita). El fix en D1
  (`control/utils/upgradePlan.js:confirmarSubirPlan`) re-suma
  `disco_upscale_mb`/`usuarios_upscale` DESPUÉS de llamar a
  `actualizarDatosTenant()`, nunca antes. Si se toca el flujo de
  `/control` para esto en el futuro, replicar el mismo re-sumado ahí.
- **Un Promotion Code de Stripe nunca "desaparece" al eliminar su
  Coupon** (punto 427, 2026-10-27): `stripe.coupons.del()` invalida el
  código para siempre, pero `stripe.promotionCodes.list()` lo sigue
  devolviendo indefinidamente con `coupon.deleted===true` y sus demás
  campos (`percent_off`/`amount_off`/etc.) en `null` — confirmado real
  al probar, se veía como una fila fantasma "$0" en la tabla de
  `/control`. `listarCodigosDescuento()`
  (`control/utils/stripeConfig.js`) filtra `coupon.deleted` antes de
  mapear — cualquier código nuevo que lea esta lista debe mantener ese
  filtro, no asumir que "eliminado" significa "ya no aparece en
  `.list()`".
- **"Editar" un cupón de Stripe = archivar el viejo y crear uno nuevo,
  nunca una edición in-place** (punto 427): ni `Coupons.update()`
  (solo metadata) ni `PromotionCodes.update()` (solo
  `active`/`metadata`/`restrictions`) permiten tocar
  valor/código/vigencia — confirmado en el `.d.ts` real. El patrón
  implementado (`reemplazarCodigoDescuento()`) archiva el código viejo
  **antes** de crear el nuevo, nunca después — Stripe exige que el
  texto del código sea único solo entre códigos ACTIVOS, así que
  reutilizar el mismo código (el caso típico al editar) chocaría si el
  nuevo se creara primero. Si crear el nuevo falla, reintentar
  reactivar el viejo (no dejar al operador sin ningún código vigente).
  Replicar este orden (archivar→crear, nunca crear→archivar) en
  cualquier flujo futuro de "reemplazar" un objeto de Stripe con
  restricción de unicidad.
- **`<a class="btn ...">` no se ve como botón solo con las clases —
  falta un reset** (punto 426, 2026-10-27): `.btn`/`.btn-secondary` en
  `style.css` nunca definieron `text-decoration` ni `display` propio, así
  que un `<a>` con esas clases conserva el subrayado azul de fábrica del
  navegador (bug real encontrado en "Abrir Dashboard de Stripe", se veía
  como texto plano pese a llevar `btn btn-secondary`). Fix aplicado como
  regla global (`a.btn { text-decoration:none; display:inline-flex;
  align-items:center; justify-content:center; gap:8px; }`, cerca de
  `.btn-secondary:hover` en `style.css`) — cubre las 3 apps, no solo el
  sitio donde se encontró. Si se agrega un `<a>` nuevo con clases `.btn*`
  en cualquier app, ya no hace falta convertirlo a `<button>` para que se
  vea bien — pero si la acción no navega a otra URL (ej. abre algo con
  JS), seguir prefiriendo `<button>` real, no `<a href="#">`.
- **Accesos → Garage (S3), no MinIO** (punto 426, 2026-10-27): el bloc de
  notas de credenciales en `/control` (`frontend/control.html`,
  `control/utils/accesoMinio.js`) seguía 100% rotulado "MinIO" pese al
  reemplazo por Garage del punto 415 — ya corregido a "Garage (S3)" /
  "Access Key ID" / "Secret Access Key" / "Abrir endpoint" (Garage no
  trae panel web propio, a diferencia de MinIO con su consola en el
  puerto 9001). Cambio **solo de rótulos visibles** — IDs del DOM
  (`accesos-minio-*`) y claves de `ajustes_globales`
  (`minio_url`/`minio_usuario`/`minio_password_cifrado`/`minio_notas`)
  se conservan tal cual a propósito, cero migración de esquema. Si se
  toca este archivo otra vez, no renombrar esas claves internas sin
  decisión explícita — son invisibles para el operador.
- **Un "Eliminar" definitivo en `control/` casi nunca puede ser un
  `DELETE` físico real** (punto 432, 2026-10-27): `control_app` (la
  credencial de BD de `control/`) no tiene privilegio `DELETE` ni
  `REFERENCES` — a propósito, hardening del segmento 9b, confirmado en
  `control/scripts/ensureSchema.js:268-272` (mismo motivo documentado ya
  para `grupos_sucursal`/`orden_productos`/`api_credenciales`). Antes de
  implementar un botón "Eliminar" nuevo en cualquier tabla de
  `control_tenants`, grepear ese comentario primero — si aplica, la
  única vía sin ampliar privilegios de MySQL (cambio de seguridad, pide
  confirmación explícita del usuario, no se asume) es un SEGUNDO
  soft-delete propio de esa tabla (columna `eliminado_en DATETIME NULL`,
  independiente de `activo`) que la deje invisible PARA SIEMPRE en todas
  las vistas, incluida cualquier "incluir archivados". Patrón real
  aplicado en `planes.js:eliminarPlan()`: 2 candados en orden (1) debe
  estar ya archivado (`activo=0`) — mismo criterio de fricción
  intencional que `stripeConfig.js:eliminarCodigoDescuento()` (Eliminar
  nunca convive con Archivar en la misma fila, solo con Reactivar); (2)
  `total_tenants === 0`, bloqueando con `codigo:'tiene_empresas'` →
  **409** (no 400 genérico) para que el frontend distinga ese caso de un
  error de validación.
- **Capacidad real de Garage: correcta, pero en este entorno (Docker
  Desktop + WSL2 en Windows) NO coincide con el disco real de Windows —
  no es un bug, es la VM** (punto 433, addendum, 2026-10-27): el admin
  API de Garage (`dataPartition.total`/`available`) reporta las
  estadísticas REALES del filesystem ext4 dentro de la VM de WSL2
  (`docker-desktop`), que vive en un disco virtual (vhdx) separado —
  confirmado real: ese vhdx pesaba 38.1 GB en disco (sparse, poco
  usado), pero el ext4 que Garage ve adentro reporta ~1007 GB
  total/~945 GB libres, mientras los discos C:/D: de Windows tenían
  36.9/43.8 GB libres reales. **La lectura de Garage es honesta sobre SU
  PROPIO filesystem** — el desfase es 100% la capa de virtualización de
  Docker Desktop en Windows, no un error de cálculo. En producción (VPS
  Linux real, sin WSL2 de por medio) este mismo mecanismo SÍ refleja el
  disco físico real del servidor — no hay nada que corregir ahí. Si una
  sesión futura ve "el disponible no cuadra" en un entorno Windows de
  desarrollo, esto es la explicación antes de asumir que el código está
  mal — sí revisar primero que la fórmula use el dato real de Garage y
  no una resta contra lo "comprometido" (ese SÍ fue un bug real, ya
  corregido, ver el punto completo). **Superado por el addendum 2 de
  abajo**: el usuario pidió (con razón) el número del disco real del
  host, no el de la VM de Garage — ya implementado.
- **Capacidad total de disco: fuente primaria es el HOST real, no
  Garage** (punto 433, addendum 2, 2026-10-27, reemplaza el criterio del
  punto anterior): `control/utils/hostDiscoCapacidad.js` lee
  `fs.statfsSync('/hostdisk')` contra un bind mount de solo lectura de
  una carpeta VACÍA (`C:/ProgramData/clarvo-disk-probe` por defecto,
  `HOST_DISK_PROBE_PATH` configurable — ver `docker-compose.yml`,
  servicio `control`) — `statfsSync` reporta el filesystem COMPLETO
  donde vive esa carpeta, nunca su contenido, así que el mount no expone
  ningún archivo real del host. Verificado real contra
  `Get-PSDrive`/`docker run` antes de implementar: coincide exacto con
  el disco de Windows. `discoCapacidad.js:resolverCapacidadTotal()`
  prueba host → Garage (fallback) → caché, en ese orden —
  `resumen.capacidadFuente` ahora es `'host'|'garage'|'cache'|'sin_datos'`.
  **Si se agrega una tercera fuente a un campo que ya tenía un check
  `fuente === 'garage'` en algún lado, revisar TODOS los sitios con ese
  mismo check** — el bug real de este addendum fue exactamente eso: el
  cálculo de `disponibleMb` seguía comparando solo contra `'garage'`,
  así que con `fuente === 'host'` caía al número por promesas equivocado
  otra vez (mismo bug-shape que el addendum 1, en la rama nueva).
- **Primera llamada interna en sentido backend→control** (punto 433,
  2026-10-27): hasta entonces TODAS las llamadas `/internal/*` entre los
  2 servicios eran control→backend (`notificarBackend.js`:
  `notificarInvalidacionCache`/`activarTenantFisico`/`enviarCorreoBase`).
  La compra de upscale desde Mi Cuenta necesitó el sentido contrario (el
  admin del tenant está autenticado en `backend`, pero el catálogo/
  Stripe/`disco_cuota_mb` viven en `control`) — mismo mecanismo exacto
  (`INTERNAL_CACHE_SECRET` compartido, `secretoInternoValido()`
  duplicado en los 2 `server.js`, nunca importado entre servicios), solo
  invertido. Si se necesita otra llamada backend→control en el futuro,
  replicar este patrón (`CONTROL_INTERNAL_URL` en `docker-compose.yml`,
  default `http://control:4001`) en vez de inventar uno nuevo.
- **Un campo "preparado pero nunca conectado" puede llevar meses en el
  código sin que nadie lo note** (punto 433): `inventarioImagen.js:guardarImagenProducto()`
  ya regresaba `pesoBytes` desde antes de este punto — ningún call site
  lo usaba. Al construir el uso incremental de disco (punto 433), ese
  campo ya estaba listo para conectarse, cero cambio de firma necesario.
  Antes de agregar un campo "para después" a un valor de retorno, dejar
  un comentario corto explicando para qué es — si no, una sesión futura
  tiene que adivinar o re-derivarlo desde cero (en este caso se dedujo
  bien, pero no siempre es tan obvio).
- **Uso de disco incremental (punto 433): solo SUMA, nunca resta** —
  `backend/utils/discoUso.js:ajustarUsoDisco()` se conectó en los 3
  puntos ya gateados por cuota (punto 347: foto de ticket, CSF, imagen
  de producto) pero SOLO en el camino de subida nueva. Reemplazar o
  borrar una imagen de producto no resta el tamaño del archivo viejo —
  no hay ninguna columna que guarde cuánto pesaba un archivo ya subido
  para poder restarlo después. El caché (`disco_bytes_usados_cache`)
  puede ir quedando por encima del uso real con el tiempo; el botón
  "Recalcular" de /control (que antes era la ÚNICA fuente del dato)
  ahora es la reconciliación periódica que lo corrige — sigue siendo
  necesario, no quedó obsoleto. Si una sesión futura necesita exactitud
  real en cada operación, el camino es un `HeadObjectCommand` contra la
  key vieja antes de sobrescribirla (no implementado a propósito, para
  no completar algo sin aprobación explícita del costo que agrega).
- **`funcionalidades_upscale` (catálogo de /control → "Upscale y
  Stripe") existía desde antes, sin conectar a ningún tenant — primer
  uso real en el punto 433**: antes de construir una pantalla nueva para
  "vender algo encima del plan base", revisar si esta tabla/UI ya cubre
  el caso (CRUD completo: nombre, tipo_cobro recurrente/único, precios).
  El patrón para conectarla a un efecto real del sistema es agregar UNA
  columna nullable con ese efecto (ej. `disco_mb`, punto 433) — nunca
  construir un catálogo paralelo. La asignación real a un tenant
  específico (cuál funcionalidad, cuánto, cobrado cómo) es una tabla
  aparte (`tenant_upscales_activos`), el catálogo nunca sabe quién lo
  compró.
- **Agregar hijos (ícono/texto) dentro de un `.campo-ayuda`/botón con
  delegación por `classList.contains` exacto rompe el clic en silencio**
  (punto 438, 2026-10-28): 3 listeners en `admin.js` (modal de ayuda de
  inventario) hacían `e.target.classList.contains('campo-ayuda')` — al
  meter un `<svg>` + texto "Ayuda" DENTRO del botón (rediseño del
  componente), un clic sobre esos hijos vuelve `e.target` el hijo, nunca
  el botón, y el check exacto deja de matchear. Mismo bug-shape que el
  toast del punto 434 (ahí era orden de cierre, aquí es contenido
  anidado) — siempre `.closest('.campo-ayuda')`, nunca `e.target`
  directo, en cualquier delegación sobre un elemento que pueda ganar
  hijos después. `theme.js` es el único script que se carga en las 6
  páginas con `.campo-ayuda` sin excepción — comportamiento de UI global
  no ligado a tenant se agrupa ahí en vez de duplicarlo 5 veces (ver
  bloque de descubribilidad del halo, mismo punto). **Nota de
  verificación**: el clic sintético de la extensión de Chrome en esta
  sesión no disparó ningún evento observable por `document` en fase de
  captura (ni por coordenadas ni por referencia) — confirmado que es
  limitación de la herramienta, no del código, disparando el mismo
  evento a mano con `dispatchEvent(new PointerEvent('pointerdown'))`
  (funcionó al instante) y con `.focus()` programático (equivalente a
  Tab real, también funcionó). Si una sesión futura ve un clic que "no
  hace nada" solo en pruebas automatizadas de Chrome, probar primero con
  `dispatchEvent` manual antes de asumir que el código está roto.
- **`setInterval` de polling corto (≤5s) NUNCA debe compartir rate
  limiter con tráfico de escritura/uso general** (punto 441,
  2026-10-29): bug real en vivo — `GET estado-pago` (onboarding, 5s)
  compartía `onboardingPublicLimiter` (40/15min) con las rutas de
  escritura del wizard, lo topaba a los ~3 min, el 429 quedaba
  silencioso en el frontend (`catch` sin mostrar error, pensado para
  fallos de red transitorios) — la UI se congelaba para siempre sin
  avisar nada, aunque el backend ya tuviera todo confirmado. Mismo
  bug-shape encontrado en `admin.js:pollImportacionEjecucion` (2s,
  compartía `adminApiLimiter` 600/15min con TODO lo demás del admin).
  Fix: limiter propio y holgado por cada ruta de polling
  (`onboardingEstadoPagoLimiter` 300/15min, `importPollingLimiter`
  1200/15min), calculado contra intervalo × duración máxima esperada de
  espera. Cualquier endpoint nuevo pensado para `setInterval` corto:
  nunca reusar un limiter de escritura, calcular el suyo propio desde
  el día uno.
- **SMTP default de plataforma (punto 443, 2026-10-29)**: todo
  tenant/sitio base sin su propia conexión SMTP completa ya cae en el
  default configurado en `/control` → Accesos → SMTP, en vez de fallar
  al enviar correos. Cadena real: `control/utils/accesoSmtp.js`
  (storage + AES-256-GCM, igual que MinIO) → `POST /internal/smtp-default`
  (nuevo, mismo secreto `X-Internal-Secret` que el resto de `/internal/*`)
  → `backend/utils/smtpDefault.js` (cacheado 45s, mismo patrón que
  `ajustesGlobales.js`) → `backend/utils/email.js:resolverConfigConexion()`
  (nunca mezcla host propio con password default: o el juego completo es
  propio, o el juego completo es el default). `configSmtpParaMostrar()`
  ahora es **async** (antes síncrona) y expone `usandoDefault` — cualquier
  caller nuevo debe `await`. En `/admin`, `usandoDefault=true` oculta el
  header+body de la sección "conexion" del acordeón SMTP
  (`#smtp-acc-header-conexion`/`#smtp-acc-body-conexion`, IDs nuevos) y
  muestra `#smtp-default-banner` (verde, "Correo electrónico ya
  configurado" + link "Usar mi propio correo en su lugar", solo revela el
  formulario localmente, no guarda nada todavía). Con conexión propia
  guardada (`configurado=true`), aparece `#smtp-revertir-franja` →
  `POST /api/admin/config/smtp/revertir` (nuevo, llama a
  `limpiarConexionSmtp()`) borra host/usuario/password propios y regresa a
  `usandoDefault=true`. "Correo de quien va a facturar" y "Plantillas de
  correo" **nunca** se ocultan — son independientes de la conexión SMTP,
  a propósito fuera del acordeón que se oculta. **`CONTROL_VAULT_KEY`
  estaba vacía en `.env`** desde que existe (ningún "Accesos" —ni MinIO ni
  SMTP— pudo cifrar/descifrar nada hasta ahora) — se generó y sembró en
  esta sesión; si otra sesión ve `"CONTROL_VAULT_KEY no está configurada"`
  en un entorno nuevo, generar con
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  y `up -d --force-recreate control` (nunca `restart`, no relee `.env`).
  `/control` → Accesos → SMTP ahora replica la MISMA richness visual que
  `/admin` (acordeón, 3 subsecciones con puntos de color, franja
  "Verificar conexión ahora" con timestamp) reusando las clases
  `.smtp-*` de `admin.css` (control.html ya enlaza `admin.css`, cero CSS
  duplicado) — la única pieza NO replicada a propósito es la guía
  "¿Cómo configuro Gmail paso a paso?" colapsable (vive como un array de
  datos grande en `admin.js`, de poco valor para el operador de
  `/control`, que no es quien configura su propio Gmail).
- **Ocultar la SECCIÓN completa de un grupo de pestañas por plan no es lo
  mismo que filtrar CADA pestaña por su propio flag** (punto 444,
  2026-10-29): `reportesPlanVisible()` en `frontend/admin.js` solo decide
  si el bloque "Reportes" del sidebar se oculta entero (las 5 flags en
  0) — un plan con solo 1 de 5 flags activo (ej. Solicita, solo
  `reportesEstadoTicketsHabilitado`) mostraba igual las 5 pestañas, el
  backend ya las rechazaba con 404 (`requiereFeature()` bien gateado en
  las 5 rutas) pero la UI ofrecía 4 controles muertos — mismo bug-shape
  que "backend-only no es suficiente" ya documentado arriba para
  cualquier módulo, aplicado aquí a pestañas DENTRO de un módulo ya
  visible, no solo al módulo completo. Patrón correcto, ya aplicado
  (`PESTANAS_REPORTES` con propiedad `flag` por entrada +
  `pestanaReportesVisible(clave)` que combina perfil Y plan +
  `primeraPestanaReportesVisible()` para nunca aterrizar en una pestaña
  que el plan no incluye): si un módulo futuro tiene sub-pestañas con
  flags de plan INDEPENDIENTES entre sí (no todo-o-nada), replicar este
  patrón desde el día uno — nunca asumir que ocultar el contenedor basta.
  Validado real con 3 tenants (1/5, 5/5 y 3/5 flags, este último con un
  subconjunto que NO arranca en la primera pestaña declarada, para
  probar que el fallback de pestaña default también elige bien).
- **Un switch "autoservicio por tenant" (`inventario_activo` y
  cualquier futuro equivalente) nunca debe defaultear apagado si el
  PLAN ya lo paga** (punto 446, 2026-10-29, pedido explícito del
  usuario): `backend/utils/inventarioConfig.js` tenía
  `inventario_activo` con default fijo `'0'` — un tenant con plan
  Domina/Crece/Controla (que SÍ incluye Inventarios) seguía sin poder
  usar el módulo hasta que un admin entraba a Configuraciones y lo
  prendía a mano, aunque ya lo estuviera pagando. Fix:
  `obtenerValorConfig()`/`inventarioActivo()`/`obtenerConfigInventario()`
  ganaron `{ planIncluyeInventarios = true }` — sin fila guardada en
  `configuracion`, el default es `'1'` si el plan lo incluye (o no hay
  `req.tenant`, sitio base, siempre tratado como que lo incluye) y
  `'0'` si no. Una fila YA guardada (el admin tocó el switch, en
  cualquier sentido) **siempre gana** — cero backfill/migración
  necesaria, el nuevo default solo aplica donde nunca se había tocado
  nada. Si se agrega otro switch "autoservicio por tenant" en el
  futuro que dependa de un flag de plan (mismo patrón que
  `ventasHabilitadaGlobalmente`/`auditoriaHabilitadaGlobalmente`),
  replicar este criterio — el usuario fue explícito: si ya pagó el
  módulo, debe estar prendido desde el día uno, no requerir un paso
  manual extra.
- **Asignar un perfil (`ventas`/`inventario`/`fiscal`) a un usuario no
  valida por sí sola que el PLAN del tenant incluya el módulo de ese
  perfil — resuelto en el ORIGEN (alta de usuarios), no parchando el
  checklist/tour** (punto 444/446/447, 2026-10-29): el formulario de
  alta no filtraba la lista de perfiles por los flags del plan — se
  podía crear un usuario perfil "inventario" en un tenant Solicita (sin
  Inventarios) sin ningún aviso; `aplicarRestriccionesPerfil()` ocultaba
  bien el sidebar, pero el checklist "Primeros pasos" y el recorrido
  guiado (`ONBOARDING_TOUR_PASOS`) mostraban pasos muertos ("Da de alta
  tu primer producto") para un módulo inexistente en su sidebar.
  **Decisión explícita del usuario, vía `AskUserQuestion`** (de 3
  propuestas ofrecidas — ocultar checklist/tour, mensaje genérico,
  filtrar pasos individuales — ninguna fue la elegida): en vez de
  parchar el síntoma en el checklist/tour, se oculta la opción de
  perfil en el ORIGEN. `perfilPlanVisible(perfil)` (fiscal→
  `facturacionHabilitada`, inventario→`inventariosHabilitado`, ventas→
  ANY de `ventasHabilitado`/`cxcHabilitado`/`gastosHabilitado`,
  administrador/cliente siempre visibles) +
  `aplicarPerfilesDisponiblesPorPlan()` oculta (`option.hidden`, nunca
  quita) las opciones no disponibles en los 2 selects de perfil
  (`crear-usuario-perfil`/`editar-usuario-perfil`) — llamada en
  `showDashboard()` y de nuevo al abrir cada modal. Un usuario YA creado
  con un perfil que el plan dejó de incluir conserva su perfil al
  editar (nunca se le fuerza un cambio), solo deja de poder RE-elegirse
  desde ese select. Si se agrega un perfil nuevo en el futuro con un
  módulo de plan asociado, replicar este patrón — filtrar en el origen
  (quién puede asignarse qué) es más robusto que intentar cubrir cada
  superficie downstream (checklist, tour, cualquier futura) una por una.
- **El recorrido guiado necesita el sidebar completamente expandido,
  nunca solo el grupo de la vista activa** (punto 447, 2026-10-29,
  pedido explícito del usuario con captura): `aplicarEstadoGruposSidebar()`
  solo auto-expande el grupo de la vista ACTIVA — un paso del tour
  apuntando a un botón dentro de un grupo colapsado (ej. "GESTIÓN DE
  FACTURAS" mientras el usuario está en "Inicio") deja ese paso
  señalando un elemento invisible. Fix:
  `expandirTodosLosGruposSidebarParaTour()` (nueva), llamada al inicio
  de `construirYMostrarTour()` — fuerza `aria-expanded="true"` +
  `data-colapsado="false"` en TODOS los grupos, sin tocar los overrides
  de `localStorage` (el usuario puede recolapsar después normalmente,
  esto es solo el estado visual mientras dura el tour). Si se agrega un
  spotlight/tour nuevo en cualquier otra pantalla con secciones
  colapsables, aplicar el mismo criterio desde el día uno.
- **2 overlays de bienvenida compitiendo a la vez = uno tapa al otro con
  su propio blur** (punto 447, 2026-10-29, bug real reportado con
  captura): el aviso "Falta configurar los datos fiscales"
  (`mostrarAvisoFiscalSiFalta()`, perfil fiscal con RFC/Clave SAT
  vacíos) se disparaba en el MISMO login que el recorrido guiado —
  ambos son `modal-overlay` de pantalla completa, el del aviso fiscal
  se montaba encima y dejaba el globo del tour invisible. Mismo
  bug-shape que el toast del punto 434 (2 piezas de UI de "bienvenida"
  nunca antes habían coincidido en el tiempo hasta que ambas condiciones
  se dieron juntas). Fix: `mostrarAvisoFiscalSiFalta()` revisa
  `els.onboardingTourOverlay.hidden` — si el tour está abierto, difiere
  (`avisoFiscalPendienteTrasTour = true`) en vez de mostrar;
  `cerrarTourBienvenida()` (dispara con "Saltar" o al terminar el último
  paso) revisa esa bandera y muestra el aviso justo después. Sin tour
  (perfil sin recorrido, ya visto, o móvil <900px), se muestra de
  inmediato como siempre — "la prioridad es el tour", decisión explícita
  del usuario. Si se agrega otro overlay de "primera vez" en el futuro,
  revisar contra este mismo riesgo (2 modales de bienvenida en el mismo
  login) antes de darlo por aislado.
- **Antes de implementar una feature "nueva" que suena a algo ya
  construido en una sesión anterior, confirmar código real primero**
  (punto 449, 2026-10-29): el usuario pidió "implementar" cancelación de
  suscripción con persuasión — resultó que el backend COMPLETO
  (`control/utils/cancelacionSuscripcion.js`, rutas
  `/api/admin/mi-cuenta/suscripcion/*`) y el frontend completo
  (`frontend/admin.js`, modal de 3 pasos) ya existían desde el punto 440,
  solo faltaba lo que de verdad se pidió: mover el trigger de Mi Cuenta a
  Configuraciones y agregar 2 pantallas de fricción al final. Si se
  hubiera reimplementado desde cero sin este grep previo, se habría
  duplicado lógica real contra Stripe ya probada. Mismo principio que el
  punto 352 ("antes de asumir que algo sigue pendiente, revisar el
  código real"), aplicado aquí a una feature completa, no solo un flag.
- **Doble fricción de confirmación (escribir palabra + código generado):
  100% client-side, nunca se le pide al backend validar** (punto 449):
  `#cancelacion-paso-confirmar` (escribir "cancelar") +
  `#cancelacion-paso-codigo` (código de 6 caracteres,
  `generarCodigoCancelacion()`, alfabeto sin 0/O/1/I/L, regenerado cada
  vez que se entra al paso — nunca reusado) solo habilitan el botón
  siguiente por comparación exacta en el navegador — el candado real ya
  es `exigirAdminRaizConTenant()` del lado del servidor. Mismo criterio
  que "escribe el nombre del repo para borrarlo" de GitHub: la fricción
  es para la INTENCIÓN del humano, no para la autorización (eso ya está
  resuelto aparte). Replicar este patrón (nunca mandar la palabra/código
  tecleado al backend) en cualquier confirmación de doble fricción
  futura — el backend no necesita saberlo, solo necesita el candado real
  que ya tenía antes de agregar la fricción.
- **Mover un botón de un card a otro: el modal/overlay que abre casi
  nunca necesita moverse** (punto 449): `#cancelacion-modal-overlay` ya
  vivía como overlay independiente al final del `<body>`, sin relación
  de anidamiento con el botón que lo abría — mover "Cancelar
  suscripción" de Mi Cuenta a Configuraciones fue solo cambiar QUIÉN
  dispara `abrirModalCancelacion()` (nuevo `#btn-config-cancelar-suscripcion`
  en vez de `#btn-micuenta-cancelar-suscripcion`, eliminado), cero
  cambios al modal en sí. Antes de mover un modal completo al reubicar
  su trigger, confirmar primero si el modal ya es un overlay top-level
  independiente (patrón de todos los modales de este archivo) — casi
  siempre lo es.
- **Punto 450 (29-30 oct 2026, CERRADO)**: trabajo recuperado tras un cierre
  abrupto del IDE a mitad de sesión; pasó `node --check` + suite Jest, y
  el 30 oct se completó la verificación funcional con clics reales
  (Playwright + msedge) que había quedado pendiente — un reinicio de la
  PC cortó esa verificación a medio FLOW 4 (reactivar suscripción), se
  retomó en la sesión siguiente y se cerró: overlay "¿Seguro que quieres
  irte?" con texto dinámico correcto, clic real en "Cambié de opinión,
  reactivar cobro" → toast real → llamada real a Stripe test mode
  (`cancel_at_period_end:false`) → UI revertida sola (desaparece aviso,
  reaparece "Cancelar suscripción"). Detalle completo de los 5 sub-puntos
  verificados en `PROJECT_STATE.md` punto 450.
  - **Cualquier conteo "cuántos operadores cuentan contra la cuota" debe
    replicar EXACTO el filtro de `PERFILES_CUOTA`, nunca escribirse a mano
    de nuevo**: `GET /api/admin/mi-cuenta` contaba `totalOperadores` con
    `WHERE perfil IN ('administrador','fiscal','ventas')` sin `activo=1` y
    sin `'inventario'` — desalineado con `PERFILES_CUOTA` (creación/edición
    de usuarios, puntos 418/444). Bug real: un tenant con `maxUsuarios=1`
    podía mostrar 4 operadores activos sin bloqueo. Fix:
    `WHERE activo = 1 AND perfil IN ('administrador', 'fiscal', 'ventas',
    'inventario')`. Cualquier `COUNT(*)` nuevo sobre `usuarios` que se
    muestre como "cuenta contra tu cuota" debe copiar este mismo filtro,
    nunca redefinirlo a ojo. **Mismo bug, 2 sitios más que SÍ bloquean
    (no solo muestran), encontrados y corregidos en la sesión de
    recuperación**: `POST /api/admin/usuarios` (`PERFILES_CUOTA`) no
    filtraba `activo=1` en su `COUNT(*)`; `PUT /api/admin/usuarios/:id`
    (`PERFILES_CUOTA_EDIT`) ni filtraba `activo=1` NI incluía
    `'inventario'` en el array — editar una cuenta a ese perfil se
    saltaba la cuota por completo. Ambos ya alineados a los mismos 4
    perfiles + `activo=1`, con tests nuevos en
    `backend/test/integration/cuotaUsuarios.test.js` que verifican el SQL
    real por regex, no solo el resultado.
  - **El catálogo de upscale (`funcionalidades_upscale`) solo permite UN
    recurso por fila**: `control/utils/upscale.js:normalizarDatos()` fija
    el recurso elegido (disco/usuarios, columnas `disco_mb`/
    `usuarios_otorgados`) y limpia el otro a `null` siempre — nunca los dos
    a la vez. Si se agrega un tercer tipo de recurso al catálogo en el
    futuro, mantener el mismo criterio "uno a la vez, limpiar los demás".
  - **Columna "Plan" de `/control` depende de que `listarTenants()` traiga
    `disco_upscale_mb`/`usuarios_upscale` en el SELECT**
    (`control/utils/tenantLifecycle.js`) — si se agrega otro upscale
    comprado a futuro que deba mostrarse ahí, agregarlo también a ese
    SELECT, o el chip nuevo nunca aparece aunque la tabla `tenant_upscales_activos`
    ya tenga el dato.
  - **Reactivar una suscripción cancelada nunca crea una Subscription
    nueva**: `reactivarSuscripcion()` solo hace
    `stripe.subscriptions.update(id, {cancel_at_period_end:false})` sobre
    la MISMA Subscription + `UPDATE tenants SET suscripcion_cancelar_al_corte
    = 0` — reversa exacta de la cancelación del punto 440/449, nunca tocar
    precio/plan al reactivar.
  - **Tercer caso del mismo bug-shape de "2 overlays de bienvenida
    compiten"** (ya documentado en el punto 447 para el aviso fiscal vs.
    el tour): el aviso "te quedan N días para que se cancele tu
    suscripción" también se difiere si el tour está abierto
    (`avisoSuscripcionPorVencerTextoPendiente`) y se muestra justo al
    cerrarlo — cualquier overlay de "primera vez"/aviso urgente nuevo debe
    revisarse contra este mismo riesgo antes de darlo por aislado.
- **`geoip-lite@2.0.3`: el warning `EBADENGINE` al instalar es ruido, no un
  paquete roto** (punto 452, 2026-10-30): declara `engines: {"node":
  ">=24.0.0"}` pero el proyecto corre Node 20 en Docker — probado real en
  un contenedor `node:20-alpine` antes de decidir: `npm install` solo
  emite el warning, `geoip.lookup()` funciona idéntico en Node 20.20.2.
  Es la única versión de `geoip-lite` sin el CVE real de `ip-address`
  (XSS/SSRF/ReDoS, 6 avisos) — la versión anterior compatible con Node 10
  (`1.4.10`) depende de `ip-address@5.x`, sin fix en esa rama mayor, y
  **no aplica el patrón de `overrides` ya usado en este proyecto para
  `qs`/`uuid`** (ver abajo) porque el salto a la versión parcheada de
  `ip-address` es de 5 versiones mayores con API incompatible — habría
  roto `geoip-lite` en silencio. Si se actualiza esta dependencia en el
  futuro, repetir la prueba real en `node:20-alpine` antes de asumir que
  un `engines` más alto significa que de verdad no corre en Node 20.
- **Traducir región ISO 3166-2 de `geoip-lite` a nombre de estado
  mexicano requiere mapa propio** (punto 452): `geoip-lite` solo da el
  código corto (ej. `"MIC"`), nunca el nombre completo — `backend/utils/geoIp.js`/
  `control/utils/geoIp.js` (duplicado, mismo criterio de siempre) traen
  un mapa de las 32 entradas. Fuera de México se muestra `"Ciudad, País"`
  sin intentar traducir subdivisiones de otros países — no extender ese
  mapa a otros países sin que se pida.
- **Dockerfile: la ruta que `mkdir`/`chown` prepara DEBE ser exactamente
  la misma que `UPLOAD_DIR` (o cualquier env var de ruta) resuelve en
  runtime, nunca una derivada de `WORKDIR` por comodidad** (punto 454,
  2026-10-30): al retirar el bind mount `./uploads` y pasar a
  `USER appuser` directo en `backend/Dockerfile`, el `RUN mkdir -p`
  preparó `/usr/src/app/uploads` (bajo `WORKDIR`) mientras
  `docker-compose.yml` seguía con `UPLOAD_DIR: /app/uploads` (ruta
  DISTINTA, fuera del `WORKDIR`) — el contenedor reventó real con
  `EACCES: permission denied, mkdir '/app/uploads'` en cuanto arrancó
  como `appuser` no-root (ya no hay un paso previo como root que pueda
  crear esa carpeta en caliente). Solo se detectó al reconstruir
  `frontend` y que Docker recreara `backend` en cascada — un
  `docker build` + `docker run --entrypoint whoami` aislado (sin pasar
  por el `CMD` real) NO lo atrapa, porque nunca ejecuta el
  `fs.mkdirSync(UPLOAD_DIR)` real de `server.js`. Antes de dar por
  bueno un cambio de Dockerfile que toca `USER`/permisos de carpetas,
  levantar el contenedor con su `CMD` real (`docker compose up`) y
  confirmar que la app arranca limpio — nunca solo verificar el usuario
  del proceso con un comando sustituto.
- **`geoip-lite@2.0.3` vs `1.4.10`: el patrón de `overrides` para forzar
  una dependencia transitiva parcheada NO siempre aplica** (punto 454,
  sonar_1.3.html N-06): `geoip-lite@1.4.10` depende de `ip-address@5.x`
  (vulnerable, 6 CVEs reales) — a diferencia del precedente ya usado en
  este proyecto para `qs`/`uuid` (forzar la versión parcheada dentro del
  mismo árbol de dependencias de un paquete de primer nivel sin tocar su
  versión declarada), aquí el fix real de `ip-address` vive en la rama
  10.x — un salto de 5 versiones MAYORES con API incompatible que
  habría roto `geoip-lite` en silencio si se forzaba vía `overrides`. El
  criterio correcto cuando el patrón de `overrides` no aplica: usar la
  versión del paquete de primer nivel que YA trae el fix integrado
  (`geoip-lite@2.0.3`), aunque declare un `engines` más exigente — ver
  el gotcha de arriba sobre `EBADENGINE` siendo solo advertencia en
  Node 20.
- **Un archivo suelto (`docker-stack.yml`, `.env`, etc.) empacado junto a
  directorios en el mismo `tar` puede NO sobreescribirse en el servidor
  aunque `tar tzf` confirme que está en el paquete** (punto 455,
  2026-10-30, **downtime real en producción**): `/opt/clarvo/docker-stack.yml`
  en Vultr quedó desactualizado desde el 28 de octubre (con un servicio
  `minio:` real que ya no debería existir desde el punto 415) pese a que
  el `tar` de esta sesión (y probablemente los de los puntos 442/451/453
  también) sí lo incluía — causa raíz no confirmada (posible interacción
  de `bsdtar`/Git Bash en Windows con un archivo suelto junto a
  directorios en el mismo `tar`), nunca reproducida a propósito para no
  arriesgar otro incidente. Efecto real: un `docker stack deploy -c
  docker-stack.yml clarvo` con el archivo viejo tumbó `backend` y
  `mysql-primary` a 0/1 (downtime real, breve) y creó un servicio
  `minio` huérfano. **Regla nueva, aplica a cualquier despliegue futuro
  con un archivo suelto en el paquete `tar`**: después de extraer en el
  servidor, verificar SIEMPRE con `md5sum`/`diff` contra el archivo
  local — un `grep` de una línea esperada NO basta (ese `grep` pasó en
  este incidente real, apuntando a una línea que coincidía por
  casualidad con un offset distinto del archivo viejo). Si el archivo es
  crítico para el servicio, hacer `scp` del archivo individual aparte,
  nunca confiar solo en el `tar` del paquete completo.
- **`docker stack deploy` nunca purga solo un servicio que ya no está en
  el YAML** (punto 455): hace falta `--prune` en el comando, o
  `docker service rm <nombre>` a mano después — un servicio eliminado
  del `docker-stack.yml` sigue corriendo indefinidamente si no se hace
  ninguna de las dos cosas.
- **Para probar un endpoint de `/admin` con `curl` directo (Basic Auth),
  la ruta real es `/<slug>/api/admin/...` con `-u usuario:password` —
  nunca `X-Tenant-Slug` por header contra `/api/admin/...` a secas, y
  el login real es `GET /api/admin/login` (no `POST`)** (punto 456,
  2026-10-30): probado real contra el stack local — `curl -u ... -H
  "X-Tenant-Slug: prueba-cancel-8" http://localhost:8088/api/admin/...`
  da 401 siempre (el header no resuelve el tenant para esta ruta); el
  formato que sí funciona es
  `curl -u usuario:pass http://localhost:8088/<slug>/api/admin/...`
  (nginx resuelve el tenant por el PATH, igual que en el navegador).
  Antes de asumir que Basic Auth "no funciona" contra una ruta de
  `/admin`, verificar primero el formato real de la URL.

## Stack

Node.js 20 + Express 4, MySQL 8 (`mysql2/promise`, SQL crudo, sin ORM),
Nginx sirviendo frontend estático (HTML/CSS/JS vanilla, sin build step),
todo sobre Docker/Docker Compose. Ver README para la lista completa de
dependencias. Prefijo de contenedores: `clrv-*` (proyecto Docker Compose "clarvo-app", antes "portalManager-*"/"portalfac", renombrado punto 436).

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
- **`.env` y `.env.example` (y cualquier variante `.env.*`) NUNCA van al
  repositorio** — regla global decidida por el usuario, 2026-10-19: ambos
  están en `.gitignore` sin excepciones; `.env.example` se quitó del índice
  y del árbol de `origin/main` (commit `4fc96b2`), aunque el archivo sigue
  en disco local y su contenido viejo permanece en el historial de 4 commits
  previos (sin secretos reales: solo `changeme_*`/`admin:admin`). Si algún
  día aparece trackeado de nuevo: `git rm --cached <archivo>` + commit,
  nunca `git rm` (eso lo borraría también del disco). Ver `PROJECT_STATE.md`
  punto 405.
- **`.env.example` tiene 7 secciones por dominio, con índice y tag de
  severidad al inicio** (punto 406, 2026-10-19, híbrido A+C elegido por el
  usuario entre 3 propuestas de IA): `01 Core` (REQUERIDO, arranque local
  mínimo) → `02 Seguridad y sesiones` → `03 Almacenamiento/MinIO` →
  `04 Red/CORS` → `05 App de control y multi-tenant` →
  `06 Alta disponibilidad MySQL/Swarm` (AVANZADO) → `07 Integraciones
  externas` (OPCIONAL). Una variable nueva se agrega a la sección de su
  dominio, nunca al final del archivo — y el índice de arriba se actualiza
  en el mismo cambio. Severidad = variable descomentada (activa hoy) es
  REQUERIDO; comentada es OPCIONAL (override de un default razonable) o
  AVANZADO (depende de una arquitectura aún sin efecto, ej. Swarm o
  multi-tenant por URL) — nunca marcar REQUERIDO algo que hoy vive
  comentado. Drift conocido sin corregir entre este archivo y
  `README.md` (contradicción de `ADMIN_USERS`/M-11, variables en una
  fuente que no están en la otra): ver punto 406, pendiente de decisión
  del usuario, no asumir cuál es la fuente de verdad.
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
- **`--color-positive`/`--color-positive-soft` NO son variables CSS reales
  de este proyecto** (punto 384, 2026-10-09): el "verde positivo" del
  sitio (`#1FAE6B`/soft `#E4F6ED`) se pinta con el hex directo en cada
  sitio que lo usa (ver `.resumen-fin-utilidad-valor.es-positiva`),
  nunca con una custom property reutilizable — a diferencia de
  `--color-error`/`--color-warn`, que sí están definidas en
  `style.css:root`. `var(--color-positive)` sin un `, #1FAE6B` de
  fallback resuelve a nada (color inválido = atributo ignorado = sin
  color = invisible), bug real reproducido en el velocímetro/bullet
  chart de "Venta mínima" (arco verde y franja "Cubierto" invisibles).
  Al escribir código nuevo que necesite el verde positivo: usar el hex
  directo, igual que el resto del archivo — nunca asumir que existe una
  variable solo porque las otras 2 (error/warn) sí.

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
