# CLAUDE.md — Portal de Facturación ADDV

Contexto operativo persistente para cualquier sesión de Claude que trabaje
en este repo. Para el historial de decisiones y el estado detallado del
proyecto, ver `PROJECT_STATE.md` (fuente de verdad más completa que este
archivo). Para instrucciones de instalación/operación, ver `README.md`.

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
actualizados `PROJECT_STATE.md`, este archivo y `README.md`. (Versión
anterior de esta nota, ya superada por la actualización de la skill: el
flujo de 4 pasos "Analizar → Proponer → Confirmar → Implementar" con la
regla aparte de "refinar un requerimiento" — esos 5 bloques quedaron
formalizados como los pasos 2-4 del flujo de 8 pasos, no hace falta
invocarlos por separado.)

**Herramientas de eficiencia instaladas para este protocolo (2026-08-31,
ver la skill `addv-web-app` sección "Herramientas complementarias")**:
`agent-skills` (24 skills de vercel-labs/addyosmani, symlinkeadas en
`.agents/skills/` — gitignored, igual que `skills-lock.json`, ambos son
estado del entorno local, no código del sitio) y `prompt-master` (clonado
en `~/.claude/skills/prompt-master`, solo se activa si se pide
explícitamente redactar/mejorar un prompt). Ambas revisadas antes de
instalar (paquete/repo sin `eval`/scripts sospechosos) por la regla
anti-hackeo del propio protocolo.

**Revisión de `/control` (UI + funcionalidad) — parte mecánica COMPLETA
(2026-08-31, ver PROJECT_STATE.md punto 164, con permiso explícito del
usuario para ejecutar sin confirmar cada paso)**: auditoría `Explore`
relanzada y recogida; modales "Nueva empresa"/"Editar empresa" pasaron
de `.modal-ancho` (560px, 1 col) a `.control-modal-ancha` (820px, 2 col
en los campos base — mismo patrón que `.ticket-modal` de `/admin`, ver
detalle de por qué el diseño final difiere del esbozado originalmente
en el punto 163); `backdrop-filter: blur(4px)` agregado a
`.modal-overlay` en `style.css` (aplica a `/admin` y `/control`); 3
fixes de accesibilidad/consistencia de bajo riesgo (click-fuera y
Escape en el modal de confirmación + los otros 4 modales, aria-label
diferenciado en los 3 botones "Copiar" de Credenciales API). Jest
`control/` 117/117, validado contra Docker real por HTTP (rebuild
`--no-cache`+`--force-recreate`). **Pendiente, son decisión de producto,
NO tocado — documentado en un Artifact (antes/después) para el usuario**:
selector de tipografía muerto en Identidad visual, falta reset de
password/perfil de usuario de sucursal en la UI, endpoint de marca sin
uso desde la UI, y falta de test unitario propio en `control/` para
`tenantTema.js`/`apiCredenciales.js`. **Commiteado** (`65940cc` +
`08a3ea7`), sin push.

**Modal "Registrar venta" (/admin) — 3 mejoras de UI (2026-08-31, ver
PROJECT_STATE.md punto 165)**: a partir de una captura del usuario,
propuesta antes/después aprobada completa — emoji 📧/🖨️ del toggle
"¿Cómo se entrega?" reemplazados por SVG (único lugar del panel que
aún usaba emoji real, inconsistente con Cuentas por cobrar); encabezados
de sección discretos (Producto/Pago y entrega/Cliente, solo ≥901px,
cero campos movidos); grid de 2 columnas en escritorio
(`.orden-wizard-grid`, CSS puro, el wizard móvil de 3 pasos no cambia).
Jest 781/781 backend, 117/117 control. Validado por HTTP contra Docker
real. **Fix del mismo día**: el grid de 2 columnas encimaba el campo
Slug (único con layout compuesto, input+switch) — pasado a ancho
completo (`.control-form-grid-full`), Logo se reacomoda junto a Correo.
**Ese fix no era la causa real** (usuario confirmó seguía encimado) —
diagnosticado con un script Playwright desechable (login real +
getBoundingClientRect contra Docker, borrado al terminar): el switch
ES un `<label>` dentro de `.field`, así que `.field label {
display:block }` (style.css) le ganaba en especificidad a
`.control-switch { display:inline-flex }` (admin.css), colapsando el
track a 0px y dejando su círculo (`::after` absoluto) flotando sobre
el texto — bug preexistente desde el segmento "Edición" (punto 104),
sin relación con el ancho de columna. Fix real: `.field .control-switch`
(más específico). Validado empíricamente con el mismo script + captura
real tras rebuild. Control Jest 117/117. Sin commit/push todavía.

**"Configuraciones globales" (/admin) como ventana emergente (2026-08-31,
ver PROJECT_STATE.md punto 166)**: de 6 tarjetas plegables independientes
(vista de página) a un modal con barra lateral + buscador, una sección a
la vez — mismos permisos por perfil, mismo HTML/lógica de guardado de
cada sección, solo cambia el contenedor. Los 6 botones de acordeón viejos
se dejaron en el DOM pero inertes (`pointer-events:none`) en vez de
borrarlos, para no arriesgar sus handlers ni el badge de estado de SMTP.
Móvil: lista → toca → contenido con flecha de regreso. Jest 781/781.
Validado por HTTP contra Docker real, sin clics en navegador real (sin
extensión de automatización disponible). **Bug real corregido el mismo
día** (reportado por el usuario: "no puedo configurar nada"): la regla
global `[hidden] { display: none !important; }` de `style.css` le
ganaba a la regla CSS que intentaba forzar visible la sección activa —
como el botón viejo que le quitaba `hidden` a `.admin-config-body`
quedó inerte, nada volvía a mostrarla nunca. Fix: `seleccionarSeccionConfig()`
quita/pone `hidden` por JS directamente. Jest 781/781, rebuild y
validado por HTTP de nuevo. **Confirmado por el usuario en navegador
real** ("ya lo revisé, ya funciona"). Sin commit/push todavía.

**Bug real de seguridad/aislamiento multi-tenant — "/<slug>" sin página
caía al sitio sin tenant — ENCONTRADO Y CORREGIDO (2026-09-01, ver
PROJECT_STATE.md punto 178)**: reportado por el usuario ("me redirecciona
al principal sin tenant... no respeta el slug"). Auditoría completa
confirmó login/registro/cross-tenant-nav/admin fallback correctos — el
bug real era en `frontend/nginx.conf.template`: visitar SOLO `/<slug>`
(sin página) no matcheaba ningún `location` multi-tenant, caía al
catch-all y servía `login.html` SIN cambiar la URL — la barra seguía
mostrando `/<slug>` pero `login.js` (`segmentos.length >= 2`) no
detectaba tenant, autenticando contra la BD base. Con el mismo RFC en 2
tenants, el login succedía contra la empresa equivocada. Fix: nuevo
`location` regex que redirige 302 `/<slug>` → `/<slug>/login`, usando
`$proxy_x_forwarded_proto://$http_host` (no `$scheme://$host`, que pierde
el puerto en Docker). Validado en Docker/navegador real. Hallazgo
secundario sin corregir (no es el bug reportado, no hay fuga de datos):
cookie de sesión de cliente compartida entre tenants (mismo nombre/path),
se pisa entre pestañas de distintos tenants. Sin commit/push.

**Campos reducidos para `tipo=servicio` + carga masiva solo-producto
(2026-09-01, ver PROJECT_STATE.md punto 179, IMPLEMENTADO Y VALIDADO
contra Docker/MySQL reales — Jest backend 807/807, control 119/119)**:
protocolo completo (crítica + propuesta visual antes/después
en Artifact + confirmación, con el usuario ajustando el alcance dos veces
en vivo). Un `tipo=servicio` en Inventarios ahora solo pide/muestra 10 de
los 14 campos del formulario — código de barras/stock mínimo/stock
máximo/punto de reorden quedan `NULL` sin importar lo que mande el body
(forzado en `validarCuerpoProducto()` del lado del servidor, no solo
oculto en el modal) y la unidad de medida se restringe a una unidad
nueva, "Hora", **entera** (horas enteras, sin decimales — invierte la
duda que había quedado abierta en el registro anterior de este mismo
pendiente). La carga masiva CSV/XLSX (§34 de `inventarios.md`) pasó a
ser SOLO para productos — un servicio siempre se da de alta a mano;
una fila `tipo=servicio` en el CSV/XLSX se rechaza completa
(`INV_IMPORT_SERVICIO_NO_PERMITIDO`), tenía su propio INSERT/UPDATE que
NO pasaba por la validación del formulario web. Migración idempotente
en `ensureSchema()` (backfill de servicios ya existentes, solo en
tenants de prueba hoy). De paso, registrado como pendiente futuro (solo
documentado, sin implementar, ver punto 180) el alta de proveedores como
entidad propia en vez de texto libre.

**Refinamientos de UX del mismo punto 179, mismo día**: el usuario
reportó con captura que no veía el cambio — causa real era el
contenedor `frontend` corriendo 3h viejo, sin rebuild; corregido
(rebuild+recreate backend+frontend) y confirmado por `curl` real (no
Jest mockeado) contra Docker/MySQL: `POST /productos` con
`tipo=servicio` + código de barras/stock a propósito → guardó con esos
4 campos en `NULL` y unidad forzada a "Hora". Tras eso, 3 ajustes de
copy (placeholders "Nombre"/"SKU" según tipo, leyenda del toggle de 4
líneas a 1, botón "Guardar producto" → "Guardar") y un fundido de
opacidad de 150ms para los 4 campos que se ocultan (`.inv-campo-
colapsable`, respeta `prefers-reduced-motion`, sin animar al abrir el
modal) — se descartó la técnica de `grid-template-rows` del Artifact
original por ser ambigua en un grid de 2 columnas real sin forma de
confirmarla sin navegador. El modal ya era responsivo antes de esto
(94vw + scroll + 1 columna <560px), sin cambios ahí. **Sin herramienta
de navegador disponible esta sesión** — la animación se validó por
lectura de código + despliegue confirmado por curl, NO con clics
reales; pedir al usuario que confirme visualmente. Confirmado con
`ToolSearch` (2 veces) que la extensión de Chrome NO está conectada en
esta sesión de Claude Code CLI — el usuario la tiene abierta en otra
sesión suya en paralelo, no se puede tomar prestada entre sesiones.

**2 ajustes más el mismo día (ver PROJECT_STATE.md punto 179), a partir
de 2 capturas nuevas del usuario**: modal "Nuevo producto" ensanchado de
640px a 820px (`.inv-producto-modal-ancho`, mismo ancho que
`.ticket-modal` de Tickets, sin tocar `.gastos-modal` base que usa
Gastos); y **bug real corregido**: "Productos activos" del dashboard de
Inventarios contaba también servicios (única de las 7 consultas sin
`tipo='producto'`, las otras 6 ya excluían servicios de forma
estructural vía `existencias`/`movimientos_inventario`, que un servicio
nunca puebla) — tarjeta nueva independiente "Servicios activos" (8va,
llena el hueco de la fila 2). Validado por curl contra Docker/MySQL
reales: base 12/0, servicio de prueba → 12/1, borrado → 12/0. Jest
807/807. **Confirmado por el usuario en navegador real** ("ya lo
revisé, ya funciona"). **Ajuste final**: ícono de "Servicios activos"
(maletín → persona, mismo estilo feather del sitio, "los servicios son
dados por personas") — también confirmado en navegador real. Punto 179
completo queda implementado y validado de punta a punta.

**Switch "Solamente servicios" (ver PROJECT_STATE.md punto 182) — EN
CURSO, PAUSADO a medio implementar**: backend completo (config
`inv_solo_servicios` mismo mecanismo que `inventario_activo`, guards en
alta de producto/carga masiva/PUT de configuración, bloque `servicios`
en el reporte "Estado del inventario" desde `orden_productos`). Falta
TODO el JS de `admin.js` (cargar/guardar el switch, ocultar tarjetas/
botones, renderizar el bloque de servicios) — el HTML ya tiene las
clases/ids listos. Interrumpido dos veces por bugs más urgentes
reportados por el usuario. Retomar el JS antes de darlo por completo.

**2 bugs reales en Resumen financiero, encontrados por diagnóstico y
corregidos (ver PROJECT_STATE.md punto 183, 2026-09-02) — Jest backend
809/809, validado con simulación real contra Docker/MySQL**: (1)
proyección de ventas daba $0/$0 porque el mes en curso (parcial) se
trataba como mes cerrado al calcular la tendencia — fix la excluye de
la tendencia sin tocar la barra real parcial en la gráfica; (2) mucho
más grave — "facturado" se leía en VIVO de un `EXISTS` contra
`tickets`, y en cuanto la retención automática borra el ticket (efímero
a propósito), la venta olvidaba haber sido facturada PARA SIEMPRE, en
esta gráfica, la insignia de Ventas, el Corte del día, Y el guard
anti-doble-factura. Fix: columna permanente `facturado_en` en
`ordenes_compra`, se fija una sola vez al subir el ZIP de la factura,
nunca se borra. Backfill honesto: solo recupera lo que el ticket
TODAVÍA existente permita — lo ya purgado antes del fix quedó perdido
para siempre (sin vínculo posible vía el archivo de auditoría). En este
entorno de prueba (`tickets_retencion_dias=1` día) el backfill recuperó
0 filas — confirmado por SQL directo que las 130 órdenes de
abril-agosto tienen 0 tickets ligados, ninguno purgable.

**3er fix chico el mismo día**: `total_gastos` (columna real de
`reportes`, siempre bien calculada por `guardarReporte()`) faltaba en
el `SELECT` de `GET /admin/reportes` — el selector de "Lectura de
reportes" solo mostraba tickets/ventas, nunca gastos, aunque cada
cierre mensual sí los archiva. Fix de una línea en cada lado (backend +
`option.textContent` en `admin.js`). Validado por HTTP real: los 5
cortes ya sembrados muestran 13/13/14/9/18 gastos. **Commiteado y
pusheado** (`5dcb910`+`5e6a458` → `fact/master`).

**4to fix, más grande — selector "Periodo" en Ventas/Gastos construido
a medias, nunca terminado**: el usuario reportó "no veo el reporte de
los gastos, en la sección de gastos" — con `archivado_en IS NULL` por
defecto, cerrar un mes deja la vista activa vacía sin forma de ver lo
archivado. El backend (`GET /api/admin/periodos-archivados`) y buena
parte del JS (listeners, reset, disable en papelera) ya existían de
antes, pero el `<select>` NUNCA se agregó al HTML (`els.xxxFiltroPeriodo`
resolvía `null`, toda esa lógica ya escrita nunca se activaba) y
`cargarOrdenes()`/`cargarGastos()` tampoco mandaban el valor al
backend. Fix: 2 `<select>` agregados a los paneles de filtros
existentes + wiring completo. Validado por HTTP real:
`?periodo=2026-08` trae 32 ventas/18 gastos archivados de agosto. Jest
backend 809/809. Sin commit/push todavía.

**Punto 184 (mismo día)**: leyenda de "Ventas vs Facturado vs Gastos"
ahora es filtro clicable — pero SOLO dentro de la ventana emergente (en
la tarjeta chica sigue solo informativa). Clic oculta/muestra esa serie
en todos los meses, con animación (fundido+colapso, respeta reduce-
motion), accesible por teclado. Protocolo completo: crítica + demo
interactiva en Artifact + confirmación explícita ("confirmo me
encanta"). Gancho: la misma clase que ya usa `abrirDetalleGrafica()`
para el contenedor movido al modal, sin estado nuevo. No se guarda qué
ocultaste entre aperturas (reset automático al cerrar). Jest backend
809/809 (100% frontend). Sin herramienta de navegador esta sesión —
validado por despliegue vía curl, falta confirmación visual del
usuario.

**Bug reportado, SIN REPRODUCIR — acceso a tenant con `ADMIN_USERS`
(2026-09-02, ver PROJECT_STATE.md punto 185)**: usuario reporta que
`admin:admin` (confirmado idéntico dentro del contenedor real) no lo
deja "entrar a un tenant" siendo super usuario. Revisión de
`backend/utils/auth.js` no encontró restricción de tenant en el
mecanismo `ADMIN_USERS` (perfil `super`, sin gate por slug) — no se
pudo reproducir por falta de URL/síntoma exacto, pedido dos veces sin
respuesta. **Retomar pidiendo eso primero**, sin asumir causa. De paso,
se sembraron ~5 meses de datos demo reales en los 2 únicos tenants
activos (`pruebaadmin`, `piloto9c` — los otros 5 registrados en la BD
de control quedaron a medias en `provisioning` de E2E viejos, se
dejaron intactos) vía `sembrar-demo.js --confirmar` + `ensureSchema()`
apuntando `DB_NAME` a cada tenant dentro del contenedor `backend`
(mismo patrón del punto 115) — misma semilla de PRNG, cifras idénticas
en ambos a propósito (143 ventas/93 tickets/67 gastos/115 líneas de
inventario, abr-ago 2026). **El usuario avisó que va a correr `docker
compose down -v`** (reset completo de MySQL+MinIO, incluida la BD de
control con el registro de tenants) para probar desde cero — sin
confirmar si ya se ejecutó al momento de este commit; si se corrió,
las 2 siembras de arriba y los 7 tenants registrados ya no existen,
hay que reprovisionar antes de retomar el diagnóstico del bug.
**Actualización mismo día — bug real encontrado y CORREGIDO**: el
usuario confirmó el diseño esperado (`ADMIN_USERS` entra a todos los
`/admin` de tenant+sin tenant+el único `/control` global; NO debe
existir `/control` por tenant). Las 2 primeras partes ya funcionaban
(validado por curl real). La 3ra tenía un bug real, misma clase que el
punto 178: `/<slug>/control` (y cualquier `/<slug>/<algo-no-
reconocido>`) devolvía 200 con `login.html` en silencio en vez de 404
— `'control'` no está en `RUTAS_PAGINA_MULTITENANT` de `login.js`, así
que `TENANT_SLUG` quedaba `null` y autenticaba contra la base SIN
tenant con la URL mostrando el slug. Fix en
`frontend/nginx.conf.template`: nuevo `location` con regex que
devuelve 404 para `/<slug>/.+` no reconocido, colocado DESPUÉS de los
4 locations de tenant existentes para no interceptarlos. Validado por
curl tras rebuild `--no-cache`+`--force-recreate`: 404 en las rutas
basura, cero regresión en admin/login/api/control (9 rutas probadas).
Detalle completo en PROJECT_STATE.md punto 185. Sin commit/push
todavía.

**Puntos 188-189 (2026-09-02, IMPLEMENTADOS Y COMMITEADOS/PUSHEADOS —
`94d019e` → `fact/master`)**: (188) apagar "Inventario activo" ya no deja
"Solamente servicios" en un estado confuso — el switch se muestra apagado
mientras Inventario está inactivo (cosmético, no se persiste) y se restaura
al reactivar, sin resurrección sorpresa; guard nuevo en el backend
(`PUT .../inv_solo_servicios` responde 400 `INV_MODULO_INACTIVO` si
`inventario_activo` está apagado — antes solo la UI lo evitaba, la API
directa lo dejaba pasar). Jest backend 815/815. (189) los 4 íconos de
acción por tenant en `/control` corregidos — "Dar de baja" (rojo) dejó de
ser una palomita (leía "confirmado"), "Credenciales API" dejó de ser un
candado (leía "bloqueo"), "Suspender" dejó de ser un ecualizador de audio;
ahora X/llave/pausa respectivamente, reordenados (Editar/Credenciales
primero, separador, Suspender-Reactivar/Dar de baja al final). Validado
contra Docker real por curl tras rebuild `--no-cache`+`--force-recreate`
del frontend y confirmado por el usuario en navegador real. Ver
PROJECT_STATE.md puntos 188-189 para el detalle completo.

**Punto 190 (2026-09-03, IMPLEMENTADO Y VALIDADO contra Docker/MySQL
reales y en navegador real)**: nuevo perfil de usuario "Ventas" — acceso
solo a Ventas/Cuentas por cobrar/Gastos, nada más. Crítica real aplicada
antes de implementar: Ventas depende de 3 datos ajenos a esas 3 pantallas
(IVA%/zona horaria de Configuraciones, buscador de productos de
Inventarios, "Corte del día" que usa el mismo endpoint que Reportes) —
se dio acceso de SOLO LECTURA a esos 3 puntos sin abrir las secciones
completas. 24 rutas backend ampliadas (`requireAdminArea`), CHECK
`chk_usuarios_perfil` migrado (bug real encontrado contra MySQL real:
sin la migración, crear el usuario daba 500 pese a que la capa de
aplicación ya lo aceptaba), login (`verificarUsuarioAdministrativo`)
ampliado, `PUT /config/global` deliberadamente SIN tocar (sin escritura
para este perfil). Frontend: `RESTRICCIONES_PERFIL.ventas`, badge verde
reutilizado, 3 selects de perfil, fila nueva en "Perfiles y roles de
acceso". Jest backend 823/823. Ver PROJECT_STATE.md punto 190 para el
detalle línea por línea. Sin commit/push todavía.

**Punto 191 (2026-09-03, IMPLEMENTADO Y VALIDADO en navegador real)**:
Fase 1 de la auditoría UX "que nadie necesite un manual" (Fases 2 y 3
propuestas pero SIN implementar, pendientes de confirmación aparte).
Tooltips en 5 campos fiscales sin explicar (Régimen fiscal, Razón
Social, Clave SAT, Tipo de persona, Uso de CFDI) — 100% reuso de
`.campo-ayuda`/`data-tooltip`, cero JS nuevo. Botón "?" de ayuda por
vista (Ventas/Cuentas por cobrar/Gastos), contenido 100% frontend
(`AYUDA_VISTAS`), mismo estilo visual que la ayuda de Inventarios.
Estados vacíos reales (Ventas/CxC/Gastos) con ícono+guía+botón de
acción. Bug real corregido de paso: Gastos no distinguía "vacío de
verdad" de "tu filtro no encontró nada" (Ventas/CxC ya lo hacían) —
ahora tiene sus 3 estados propios. Ver PROJECT_STATE.md punto 191.
Cambios 100% frontend, sin tocar backend. **Commiteada y pusheada**
(`d785d07` → `fact/master`, 2026-09-03).

**Punto 192 (2026-09-03, IMPLEMENTADO Y VALIDADO contra Docker real y en
navegador real)**: Fase 2 — checklist "Primeros pasos" + recorrido de
bienvenida. 100% frontend, cero endpoint nuevo — 3-4 pasos por perfil
(fiscal/administrador/ventas) derivados de datos ya cargados + banderas
de evento en `localStorage` (`onboarding_v1_<tenant>_<usuario>`, "por
cuenta" no por sesión, confirmado por el usuario). Tour con spotlight
real (`getBoundingClientRect()`, no coordenadas fijas) sobre 3 elementos
por perfil, solo escritorio, una vez en la vida de la cuenta. **4 bugs
reales encontrados y corregidos validando en navegador real** (ninguno
detectable con `node --check`): globo del tour se salía de pantalla
apuntando a un objetivo alto (el sidebar completo, la heurística
arriba/abajo no aplica) — fix, objetivos con `rect.height > 120` se
colocan al lado; paso "Inventarios" del checklist mostraba estado viejo
hasta la siguiente interacción porque el dato llega async — fix, hook en
`aplicarVisibilidadInventarios()`; la tarjeta del checklist se quedaba
en el contenedor de la sesión anterior si otra cuenta con OTRO perfil
iniciaba sesión en la MISMA pestaña — fix, se reparenta al contenedor
correcto en cada render; selector del tour de "ventas" apuntaba al botón
de GUARDAR dentro del modal en vez del botón real del toolbar — fix de
selector (`#btn-abrir-orden-modal`). Validado con 3 cuentas de prueba
temporales por perfil, creadas y borradas en la misma sesión, sin dejar
residuos. Jest backend 823/823 (sin cambios de backend). Ver
PROJECT_STATE.md punto 192 para el detalle línea por línea.
**Commiteada y pusheada** (`e32be42` → `fact/master`, 2026-09-03).

**Punto 193 (2026-09-03, IMPLEMENTADO Y VALIDADO contra Docker real y en
navegador real)**: Fase 3 — paridad de tooltips en `/control` (cierra las
3 fases de la auditoría UX del punto 191). Alcance acotado a propósito
(solo tooltips — `/control` no tiene vistas tipo Ventas/CxC/Gastos, así
que "ayuda por vista"/estados vacíos con guía no aplican). **Hallazgo
real**: el componente `[data-tooltip]` ya vivía en `style.css`
(compartido), pero el JS que lo activa solo existía en `admin.js` —
`/control` nunca tuvo NINGÚN tooltip funcionando. Portado tal cual a
`control.js` (`inicializarTooltips()`, sin adaptar). 4 campos fiscales
sin explicar en "Nueva empresa"/"Editar empresa" (Razón Social, Régimen
fiscal, Tipo de persona, Clave SAT — mismos 4 de la Fase 1 en `/admin`)
ganan el ícono "?", con texto ADAPTADO al contexto real (un operador
tecleando a mano al dar de alta, no el dueño del tenant con su CSF ya
autocompletada). Validado en navegador real: 8 íconos (4 campos × 2
modales), tooltip abre con el texto correcto, cero errores de consola.
Jest control 119/119 (sin cambios de backend). Ver PROJECT_STATE.md
punto 193. Sin commit/push todavía.

**Punto 194 (2026-09-03, IMPLEMENTADO Y VALIDADO por HTTP contra Docker
real)**: Fase 4 — portal de cliente (login/registro, CSF, tickets,
dashboard), cierra las 4 fases de la auditoría UX del punto 191. 7
hallazgos de una auditoría async (`Explore`): RFC sin explicar en
login/registro, "Uso de CFDI" sin explicar (dashboard+tickets), badges
de estatus del dashboard sin explicar significado/acción (tooltip
dinámico por estatus en `dashboard.js`), estado vacío del dashboard
como una sola línea reemplazado por `.solicitudes-empty-rica`
(ícono+guía+botón, mismo patrón que `.admin-empty-rica` del punto 191),
hint de formato en "Hora" de tickets, hint de por-qué en "Verifica tu
venta", hint de qué hacer si no se tiene la CSF. 100% reuso de
`.campo-ayuda`/`data-tooltip`, cero componente nuevo. Detalle único:
`login.html` es la ÚNICA página del portal sin `portal.js` — el
componente de tooltips se duplicó ahí (idéntico a
`portal.js`/`admin.js`/`control.js`), mismo criterio de duplicación ya
usado en el resto de ese archivo. Cero cambios de backend. Jest backend
823/823 (sin cambios). Validado por HTTP tras rebuild `--no-cache`+
`--force-recreate` frontend (el primer rebuild no recogió `login.js`,
mismo gotcha de siempre): los 7 textos confirmados en el HTML servido.
**Sin herramienta de navegador esta sesión** — falta confirmación
visual del usuario. Ver PROJECT_STATE.md punto 194. **Commiteado y
pusheado** (`4b75fea` → `fact/master`).

**Punto 195 (2026-09-03, IMPLEMENTADO Y VALIDADO por HTTP contra Docker
real)**: Fase 5 — `/control`, extiende la Fase 3/punto 193 (que había
quedado acotada a solo tooltips fiscales). 8 hallazgos de una auditoría
async: estados vacíos de tenants y sucursales (x2) eran texto plano →
`.admin-empty-rica` con la misma distinción vacío-real vs filtro-sin-
resultados ya usada en Ventas/Gastos; cero ayuda por vista → se portó
`AYUDA_VISTAS`/modal de admin.js con entradas "empresas"/"sucursales";
tooltip nuevo en "Estado" (Suspender vs Dar de baja — corregido de la
propuesta original: ambos son igual de reversibles vía "Reactivar",
sin el paso intermedio que el Artifact sugería, verificado contra
`control.js:400`); badge de estatus gana tooltip por estado
(`TOOLTIP_ESTADO`); select "Perfil" de sucursales gana `field-hint`;
subtítulo de "Credenciales API" (ya existía pero sin explicar el
propósito) aclara que son para integraciones externas, no el login del
operador; campo "Notas" gana `field-hint` de visibilidad interna. 100%
reuso de componentes de `admin.css`/`admin.js`, cero CSS nuevo. Jest
control 119/119 (sin cambios de backend). Validado por HTTP tras
rebuild `--no-cache`+`--force-recreate` frontend: los 8 hallazgos
confirmados en el HTML/JS servido. **Sin herramienta de navegador esta
sesión** — falta confirmación visual del usuario. Con esto, las 5 fases
de la auditoría UX completa quedan implementadas. Ver PROJECT_STATE.md
punto 195. **Commiteado y pusheado** (`f8ca6b3` → `fact/master`).

**Punto 196 (2026-09-03, IMPLEMENTADO Y VALIDADO por HTTP contra Docker
real)**: Centro de conocimiento — manual completo de `/admin`, pedido
explícito del usuario pidiendo React/Next y ubicación dentro de
Configuraciones globales. Protocolo completo (impacto+crítica+Artifact
con demo interactivo antes/después+cuestionario) con **2 correcciones
confirmadas por el usuario**: (1) vanilla JS/CSS en vez de React/Next
— rompía el principio "sin build step" del sitio y exigía un 4º
servicio Docker con runtime Node para contenido estático; las mismas
animaciones (entrada escalonada, resaltado de búsqueda) se lograron con
CSS + JS puro, cero dependencia nueva; (2) ícono fijo en el sidebar en
vez de dentro de Configuraciones globales — esa vista está oculta por
completo para el perfil "Ventas" (`admin.js:1441-1444`), así que ahí el
manual habría quedado inaccesible para ese perfil. 13 categorías (todas
las vistas reales de `/admin`, incluidas Inicio/Tickets/Constancias del
perfil Fiscal que la propuesta inicial no cubría) en
`CONOCIMIENTO_CATEGORIAS`, mismo shell que "Configuraciones globales"
(`.config-modal-sidebar`/`-main` reusados) pero con clase de nav item
propia (`.conocimiento-nav-item`) para no engancharse a los listeners
globales del modal de Configuraciones. Cero cambio de backend. Jest
backend 823/823 (sin cambios). Validado por HTTP tras rebuild
`--no-cache`+`--force-recreate` frontend. **Sin herramienta de
navegador esta sesión** — falta confirmación visual del usuario, en
particular la animación de entrada por paso. Ver PROJECT_STATE.md
punto 196. **Commiteado y pusheado** (`28875ed` → `fact/master`).

**Punto 197 (2026-09-03, IMPLEMENTADO Y VALIDADO contra Docker real)**:
auditoría de seguridad estilo pentest (6 auditorías paralelas, solo
lectura) + parches en 3 fases, las 3 aprobadas y aplicadas completas.
Resultado: cero inyección explotable, cero fuga cross-tenant, cero IDOR
— 13 hallazgos reales, ninguno crítico. Alta: `nodemailer` desactualizado
(`^6.9.14`→`^9.1.1`, el plan viejo de "subir a v9" se quedaba corto —
el rango vulnerable llega hasta 9.0.0 inclusive; sin SMTP real en este
entorno para probar un envío de punta a punta). Medias: timing leak en
`verificarCredencialApi()` (reordenado, mismo patrón que sus 3 funciones
hermanas), PII completa expuesta en `/api/registro/buscar`/`:email` (el
`/buscar` recortado a 5 campos reales en vez de a booleano puro — la vista
previa de "reemplazar constancia" sí los necesita, verificado en
`app.js` antes de aplicar; la ruta legacy `:email`, sin llamador real,
sí a booleano), CSRF latente vía cookie `api_key` opcional (eliminada,
solo header `X-API-Key`), bug de autorización que bloqueaba a "Ventas"
de `correos-registrados`, `qs`/`uuid` vulnerables vía `express`/`exceljs`
(resueltos con `overrides` en `package.json` en vez de downgrade de
`exceljs`, verificado con smoke test real de lectura/escritura `.xlsx`).
Bajas: retención automática de tickets ahora sí itera tenants reales
(`ejecutarLimpiezaParaTodos()`, mismo patrón que `cierreMensual.js`, 3
tests nuevos), `CORS_ORIGIN` — **el fix real estaba en
`docker-compose.yml`/`docker-stack.yml`** (ambos inyectaban
`${CORS_ORIGIN:-*}` a nivel Compose, el código nunca veía la variable
vacía; encontrado validando contra Docker real cuando el header seguía
saliendo `*` tras el primer rebuild), `access_log off` para
`/restablecer` (token de un solo uso en la URL), CSP completa en
`nginx.conf.template` para las 8 páginas estáticas (inventario real
primero: cero script/handler inline tras mover los 4 que había a
`theme.js`/`admin.js`/`login.js`/`restablecer.js` — `script-src 'self'`
sin `unsafe-inline`; `mantenimiento.html` con su propia CSP más
permisiva; las 3 rutas `/api/*` re-declaran los otros 5 headers sin la
CSP nueva para no duplicarla sobre la de Swagger, verificado por curl).
Jest backend 826/826, control 119/119, `npm audit` 0 vulnerabilidades en
ambos, `nginx -t` limpio, rebuild `--no-cache`+`--force-recreate` de los
3 servicios. **Sin herramienta de navegador esta sesión** — falta
confirmación visual de que la CSP no rompa nada, y un envío SMTP real
cuando el usuario lo configure. Ver PROJECT_STATE.md punto 197.

**Punto 198 (2026-09-03/04, retest de la auditoría del punto 197)**:
usuario pidió repetir el diagnóstico para ver cómo salían los resultados
tras los parches. **1 fix real encontrado incompleto**: el punto 197
había quitado la auth por cookie `api_key` solo de la rama "4b" de
`requireAdminAuth()` (`backend/utils/auth.js`) — la rama "0" (corre antes
de exigir Basic) seguía leyendo `req.cookies.api_key` sin cambios, mismo
riesgo de CSRF que se daba por cerrado. Corregido, ambas ramas ahora solo
header `X-API-Key`. Jest backend 826/826, rebuild `--no-cache`+
`--force-recreate` de `backend`. Resto de los 13 hallazgos del punto 197
CONFIRMADOS sin regresión (verificado por 3 agentes que terminaron antes
de que la sesión tocara su límite de cuota + lectura directa del resto).
Ver PROJECT_STATE.md punto 198.

**Punto 199 (2026-09-04, IMPLEMENTADO Y VALIDADO por HTTP contra Docker
real)**: guía Gmail paso a paso (verificación en 2 pasos + contraseña de
aplicación), a raíz de una duda del usuario sobre por qué solo Gmail
corporativo parecía funcionar — no era el código (`crearTransportador()`
es genérico), es política de Google desde 2022, igual para cuenta
personal o de empresa. 5 pasos con links reales, fuente única
(`GUIA_SMTP_GMAIL` + `CORREO_SOPORTE_TEMPORAL='soporte@addv.mx'` en
`admin.js`) reusada en 2 lugares: el Centro de conocimiento
("Configuraciones globales") y un toggle nuevo dentro de la tarjeta SMTP
de `/admin` (reemplaza el aviso estático `.smtp-aviso-gmail`).
`renderPasoTarjeta()` extraída como función compartida, ahora soporta
`p.enlace` opcional — URLs siempre constantes fijas del código, nunca
dato de usuario. Cero backend. Jest 826/826 sin cambios. Validado por
HTTP tras rebuild `--no-cache`+`--force-recreate` frontend. **Sin
herramienta de navegador esta sesión** — falta confirmación visual.
`soporte@addv.mx` es temporal, cambiar cuando haya canal definitivo. Ver
PROJECT_STATE.md punto 199.

**Punto 200 (2026-09-04, IMPLEMENTADO Y VALIDADO por HTTP contra Docker
real)**: botón "Ver el recorrido de nuevo" en el Centro de conocimiento
(categoría "Primeros pasos") — el recorrido guiado del punto 192 solo se
disparaba una vez en la vida de la cuenta, sin forma de repetirlo.
Refactor: `construirYMostrarTour()` extraída de
`iniciarTourBienvenidaSiAplica()`, reusada por la nueva
`reiniciarTourBienvenidaManual()` (ignora el estado "ya visto" a
propósito, conserva la restricción de escritorio con aviso vía
`showToast()`, cierra el Centro de conocimiento antes de arrancar).
`renderPasoTarjeta()` ganó `p.accion` (botón real, delegación de eventos
en `els.conocimientoMainBody`, nunca `onclick` inline — mantiene la CSP
del punto 197). De paso, confirmado por HTTP que la guía SMTP del punto
199 sigue desplegada correctamente — el usuario no la veía por caché de
navegador o por no haber expandido la tarjeta SMTP, no por un problema
de código. Jest backend 826/826 sin cambios. **Sin herramienta de
navegador esta sesión** — falta confirmación visual. Ver PROJECT_STATE.md
punto 200.

**Punto 201 (2026-09-04, IMPLEMENTADO Y VALIDADO por HTTP contra Docker
real)**: perfil "administrador" ahora ve "Inicio" — pedido directo del
usuario. No bastaba con agregar `'inicio'` a
`RESTRICCIONES_PERFIL.administrador` en `admin.js`: esa vista carga vía
`GET /api/admin/tickets`, que en el backend exigía
`requireAdminArea('fiscal')` exclusivo — se amplió a `('fiscal',
'administrador')`. **Encontrado y cerrado de paso**: "Ver todas" y
"Gestionar" en Inicio llevan a acciones/vistas que siguen siendo
exclusivas de fiscal (Tickets completo, aceptar/facturar un ticket) —
se ocultan específicamente para administrador para no ofrecer botones
que el servidor rechazaría con 403; fiscal sin cambios. 3 tests nuevos
en `admin.test.js` (el endpoint no tenía ninguno antes — gap
preexistente, no introducido aquí). Jest backend 829/829. Validado por
HTTP tras rebuild `--no-cache`+`--force-recreate` backend+frontend.
**Sin herramienta de navegador esta sesión** — falta confirmación
visual. **Corrección same-day**: faltaba actualizar la tabla estática
"Perfiles y roles de acceso" en `admin.html` (usuario lo notó con
captura) — fila Administrador/columna Inicio a "✓". Ver PROJECT_STATE.md
punto 201.

**Punto 202 (2026-09-04, IMPLEMENTADO Y VALIDADO contra Docker/MySQL
reales, con el catálogo REAL del SAT ya sincronizado)**: automatización
del catálogo "Clave de Producto o Servicio" del SAT en el campo "Clave
SAT" de Configuraciones fiscales — pedido original del usuario
(automatizar `pys.sat.gob.mx/PyS/catPyS.aspx` sin salir del portal).
Se descartó scraping en vivo a favor de catálogo local + sincronización
manual, mismo patrón de `usoCfdi.js`. Implementado primero con catálogo
de ejemplo; el usuario confirmó la fuente real esa misma sesión
(`github.com/phpcfdi/resources-sat-pys`) pidiendo analizarla ANTES de
aplicar — esa investigación encontró que ese repo solo tiene la
taxonomía hasta 6 dígitos (el propio README dice "una clase no contiene
hijos"), sin las claves reales de 8 dígitos. Se ubicó la fuente correcta
en la misma organización confiable: `github.com/phpcfdi/resources-sat-
catalogs`, tabla `cfdi_40_productos_servicios` (52,513 claves reales,
Unlicense), publicada como dump SQL de SQLite, no JSON/CSV.
`backend/utils/catalogoTexto.js` ganó un parser de dumps SQL de INSERTs
(por posición de columna, con comillas escapadas `''`→`'`) sin tocar el
contrato de seguridad existente (`CLAVE_PROD_SERV_SYNC_URL` sigue siendo
la ÚNICA fuente de la URL, nunca la petición HTTP) — a diferencia de
`USO_CFDI_SYNC_URL`, esta variable SÍ tiene un valor por defecto en
`docker-compose.yml`/`docker-stack.yml` porque el usuario mismo verificó
y aprobó esa URL exacta. Sincronización sigue siendo 100% manual (botón
"Actualizar catálogo SAT"). Frontend: `#config-clave-sat` pasó a
`<input type="hidden">` (mismo id/contrato de guardado, sin tocar la
validación de 8 dígitos) con un combobox nuevo delante
(`#config-clave-sat-buscador`) que busca por texto o clave contra
`GET /api/admin/catalogo-clave-sat/buscar`, mismo lenguaje visual que el
buscador de productos de Inventarios en Ventas. Escribir 8 dígitos a
mano sigue funcionando siempre como captura manual directa (fallback
aprobado), con link de respaldo a `pys.sat.gob.mx` si no hay resultados.
Tooltip del campo corregido de paso (describía otro catálogo del SAT,
"Actividades económicas", por error). Jest backend **852/852** (47
suites), control 119/119, sin regresión. Validado con la sincronización
REAL disparada por HTTP (52,513 claves en ~2.3s) y búsquedas reales
confirmadas (`43211508` → "Computadores personales", "contabilidad" →
11 resultados). **Sin herramienta de navegador esta sesión** — falta
confirmación visual del combobox (clicks/teclado), aunque sigue el mismo
patrón ya validado visualmente en Ventas/Inventarios. El usuario se
ausentó a media sesión autorizando modo automático para completar este
segmento ya aprobado. Ver PROJECT_STATE.md punto 202 para el detalle
línea por línea.

**Puntos 203-205 (2026-09-04, IMPLEMENTADOS con Jest 864/864, SIN validar
contra Docker/MySQL real ni en navegador esta sesión, sin commit/push)**:
(203) layout por defecto de "Resumen financiero" congelado al orden/anchos
que el usuario ya tenía acomodado (antes "Restablecer" regresaba a un
default de fábrica desactualizado) — reordenado en `admin.html` y en
`DASHBOARD_TARJETAS`/`DASHBOARD_SPAN_DEFECTO` de `admin.js`, sin afectar a
quien ya tiene `preferencias_dashboard` guardado. (204)
`backend/scripts/sembrar-demo.js` a ventana de 6 meses (antes 5) + garantía
de +12% mes-contra-mes en el total facturado de cada mes cerrado
(`CRECIMIENTO_MINIMO_MES`), para que la proyección de ventas de Resumen
financiero (solo extrapola 3 meses cerrados) nunca se clave en $0 por un
trimestre plano del PRNG. (205) extracción automática del `Total` del CFDI
real (XML dentro del ZIP de factura) para negocios "solo facturas" sin
inventario/Ventas — `extraerTotalFacturaDeZip()` nueva en
`backend/utils/validate.js` (zlib nativo + regex sobre el XML, sin
dependencia nueva, mismo criterio que `esZipValido`), columnas
`tickets.monto_factura`/`monto_factura_origen` (CHECK
`xml`/`manual`), captura manual solo si la extracción falla
(400 `FACTURA_MONTO_REQUERIDO`) — un XML leído nunca se deja pisar por un
valor manual. Frontend revela el campo manual in-place sin cerrar el modal
ni perder el archivo. 22 tests (12+2 unit + 8 integración). Ver
PROJECT_STATE.md puntos 203-205 para el detalle línea por línea.

**Punto 205, validado contra Docker/MySQL reales (2026-09-05) — BUG REAL
ENCONTRADO Y CORREGIDO**: `extraerTotalCfdi()` nunca leía el Total de un
CFDI real — todo CFDI real trae `<?xml version="1.0" encoding="UTF-8"?>`
antes de `<cfdi:Comprobante>`, y el código buscaba el primer `">"` del
texto para acotar la etiqueta raíz, que es el cierre de esa declaración,
no el de `<cfdi:Comprobante>`. Los 12 tests unitarios originales no tenían
ningún caso con esa declaración (gap real de cobertura) — pese a 864
tests en verde, la extracción jamás hubiera funcionado con un CFDI real.
Fix de una línea (despojar `<?xml ...?>`/BOM antes de buscar `">"`). Jest
866/866. Confirmado por HTTP real contra 3 tickets reales
(`portal_facturacion`): XML con Total real → `origen:"xml"`; XML sin
Total + manual → `origen:"manual"`; XML con Total + manual enviado igual
→ gana el XML (`1450`, no `1.00`). Tickets de prueba restaurados a su
estado original. Falta aún: confirmación visual en navegador.

**Addendum al punto 205 (2026-09-05, encontrado validando el punto
208)**: el aviso de campo "Captura el monto de la factura (mayor a
$0)" nunca se mostraba — `setFieldError()` recibía el id YA prefijado
con "error-" (`'error-ticket-modal-monto-manual'`), pero la función ya
antepone ese prefijo sola; `getElementById` nunca encontraba el
elemento, sin excepción. La validación sí bloqueaba subir el archivo,
solo el aviso visual fallaba. No se detectó antes porque esa sesión
solo probó este flujo por `curl` (backend), nunca con un clic real de
navegador. Corregido junto con el mismo bug del punto 208.

**Punto 206 (2026-09-05, IMPLEMENTADO Y VALIDADO por HTTP contra Docker
real)**: Centro de conocimiento (`/admin`) puesto al día — 3 vacíos
encontrados auditando `CONOCIMIENTO_CATEGORIAS` contra el código real:
"Tickets" no mencionaba la extracción automática del Total del CFDI
(punto 205), "Inicio" seguía diciendo "pantalla del perfil Fiscal" pese
a que Administrador también la ve desde el punto 201 (solo lectura, sin
"Ver todas"/"Gestionar"), y "Configuraciones globales" no mencionaba el
buscador del catálogo real del SAT (punto 202). Los 3 cerrados, 100%
texto, cero UI/endpoint nuevo. `/control` y el portal de cliente
confirmados sin nada nuevo que documentar esta sesión. Ver
PROJECT_STATE.md punto 206.

**Punto 207 (2026-09-05, IMPLEMENTADO Y VALIDADO en navegador real contra
Docker/MySQL reales)**: cierra el pendiente de redirección automática a
"Configuraciones fiscales" cuando faltan datos (2026-09-04). Bug real
encontrado en el análisis: el aviso se mostraba también al perfil
`ventas`, que no tiene NINGÚN acceso a "Configuraciones globales" — un
aviso sin ninguna acción posible, que además habría roto la navegación
automática. Fix: `puedeCompletarDatosFiscales()` nueva gatea el aviso
por perfil (mismo mapa `RESTRICCIONES_PERFIL`); el único botón del modal
pasó de "Entendido" (solo cerraba) a "Ir a completar" (cierra, abre
Configuraciones globales, selecciona la tarjeta fiscal, foco+scroll en
"Subir constancia"); sigue reapareciendo cada login hasta completarse
(mismo criterio que el checklist "Primeros pasos"). Cero backend. Jest
866/866. Validado con clics reales en Docker/MySQL reales: navegación +
foco exacto confirmados con perfil `super`; con un usuario `ventas`
temporal real, el aviso NO aparece pese a datos fiscales realmente
vacíos — entorno restaurado exactamente a su estado previo al terminar.
Ver PROJECT_STATE.md punto 207.

**Punto 208 (2026-09-05, IMPLEMENTADO Y VALIDADO contra Docker/MySQL
reales y en navegador real)**: generador de etiquetas de código de
barras para productos de Inventarios (cierra el pendiente del punto
167). 1 producto a la vez desde el menú "⋮" ya existente; código +
nombre + precio; térmica 40×30mm o carta 24/hoja. Code128 generado en
el servidor con `bwip-js` (MIT, sin dependencias, sin `canvas`) —
decisión explícita del usuario de no vendorizar una librería de
checksum/character-set no trivial en el frontend. Endpoint nuevo
`GET /api/admin/inventarios/productos/:id/codigo-barras.svg`, mismo
gate que el resto de Inventarios. Frontend reutiliza el patrón
`#ticket-imprimir`/`#corte-imprimir` (contenedor imprimible hijo de
`<body>`). 6 tests nuevos, Jest backend 872/872.

**2 bugs reales encontrados y corregidos validando, ninguno detectable
sin Docker/navegador reales**: (1) CSP `img-src` sin `blob:` — regresión
preexistente del punto 197 que ya rompía en silencio las miniaturas de
producto del punto 159 (nadie lo notó porque ningún producto de la demo
tiene imagen subida); fix `img-src 'self' data: blob:` en
`nginx.conf.template`. (2) `setFieldError()` recibía el id YA prefijado
con "error-" en 2 modales de esta misma sesión (el de etiqueta nuevo, y
el de monto manual de factura del punto 205) — la función ya antepone
ese prefijo sola, así que el mensaje de error de campo nunca se
mostraba (la validación sí bloqueaba la acción, solo el aviso visual
fallaba); 6 call sites corregidos. Ver PROJECT_STATE.md punto 208 (y
la nota agregada al punto 205 original) para el detalle línea por
línea.

**Centro de conocimiento actualizado el mismo día (punto 208)**: paso
nuevo "Imprimir etiqueta de código de barras" en la categoría
"Inventarios" del manual — menú "⋮" → "Imprimir etiqueta", formatos
térmica/carta, código o SKU de respaldo sin captura manual. 100%
texto. Validado por HTTP tras rebuild frontend.

**Punto 209 (2026-09-05, IMPLEMENTADO Y VALIDADO — Jest backend 872/872
sin cambios, CONFIRMADO por el usuario en navegador real)**: preview
del ticket antes de imprimir en Ventas. La
palomita "Guardado con éxito" y `window.print()` se disparaban casi al
mismo tiempo al guardar con "imprimir" (competían visualmente) — ahora
la secuencia es estricta: palomita completa (~1.3s) → se oculta sola →
se abre un preview del ticket (`#ticket-preview-modal-overlay`, reusa
las clases `.ticket-imprimir-*` ya existentes, ahora visibles en
pantalla) → botón "Imprimir" ahí es el único que llama a
`window.print()` real. Los 3 disparadores (guardar+imprimir, ícono de
fila, "Ver venta") pasan por el mismo preview, a pedido explícito del
usuario tras confirmar el diseño. De paso, se quitó el único emoji
🖨️ real que quedaba en el panel (botón "Imprimir ticket" de "Ver
venta"). Validado por HTTP (modal/funciones confirmadas en lo
servido) y **confirmado por el usuario en navegador real** ("todo
bien") — la extensión de Chrome no estaba conectada esta sesión de
Claude Code, la verificación de clics reales la hizo el usuario.
**Commiteado y pusheado** (`88779e5` → `fact/master`). Ver
PROJECT_STATE.md punto 209.

**Punto 210 (2026-09-05, IMPLEMENTADO — Jest backend 872/872 sin
cambios, SIN clics reales en navegador esta sesión, extensión de Chrome
desconectada)**: atajo al Centro de conocimiento en la barra de sesión.
Usuario pidió una lupa junto al RFC — 4 ajustes aprobados sobre el
pedido original: ícono de libro (mismo que el botón del menú lateral)
en vez de lupa (una lupa promete búsqueda, no un manual); ancla a
`.admin-header` misma, nunca a `#brand-fiscal-info` (se oculta si
faltan datos fiscales); la duplicación con el botón del menú lateral se
acepta a propósito (mismo tooltip/destino); mejora agregada: este atajo
enfoca el buscador interno del modal al abrir (`abrirConocimiento()`
ganó el parámetro `enfocarBuscador`). Botón nuevo
`#btn-abrir-conocimiento-topbar` + clase `.admin-header-ayuda`. Visible
para los 4 perfiles. **Ajuste mismo día**: el usuario preguntó "¿sabrá
el usuario qué es el botón?" — riesgo real (ícono sin texto, tooltip
hover-only, sin pista en móvil al tap) — agregado como 4to paso del
recorrido guiado de bienvenida (punto 192), `TOUR_PASO_AYUDA`
compartido por los 3 perfiles con tour. Validado por HTTP — falta
confirmación visual con clics reales. Ver PROJECT_STATE.md punto 210.

**Punto 211 (2026-09-05, IMPLEMENTADO Y VALIDADO por HTTP contra Docker
real)**: quitado el aviso "¿Usas la cuenta admin o alguna de
ADMIN_USERS?..." del login de `/admin` — a pedido del usuario. Vivía
solo en `frontend/admin.html`; `/control` tiene su propio aviso
distinto, sin tocar. Jest backend 872/872 (sin cambios, HTML estático).
Ver PROJECT_STATE.md punto 211.

**Punto 212 (2026-09-05, IMPLEMENTADO Y VALIDADO por HTTP contra Docker
real)**: cambio de logo de marca ("CLARVO — Tu negocio bajo control by
ADDV", reemplaza "Portal de Facturación"). Aplicado a `/admin` y
`/control` (login hero + sidebar, según contraste de fondo —
`logoLight.png` en claro, `logoDark.png` en oscuro/navy; el panel NO
tiene modo oscuro real, esto es solo selección por fondo) y a la
mayoría de los correos (`backend/utils/correoMarca.js`, parámetro
`usarLogoLegacy` nuevo). Excluido a propósito (logo viejo
`branding.png`/`branding_bgo.png` sin tocar): portal de cliente
completo (login/dashboard/tickets/csf) y la invitación por correo
cuando `perfil==='cliente'`. **Decisión propia sin pedirse
explícitamente**: `restablecer.html` también se dejó con el logo
viejo (comparte el mismo encabezado que `login.html`) — avisar al
usuario por si prefiere lo contrario. Favicon nuevo agregado en las 8
páginas del sitio (nunca existió ninguno antes), sin excepción. Jest
backend 872/872. **Actualización mismo día**: SMTP configurado por el
usuario y validado con 5/6 envíos reales a `antonio.prado@addv.mx` sin
errores, confirmado visualmente por el usuario. Entorno de prueba
restaurado por completo (config temporal, ticket y venta de prueba,
cuentas de prueba). Sin clics reales en navegador (extensión
desconectada). Ver PROJECT_STATE.md punto 212.

**Punto 213 (2026-09-05, IMPLEMENTADO Y VALIDADO contra Docker real)**:
reemplazo global "Portal de Facturación" → "Portal Clarvo tu negocio en
orden" — 8 `<title>` (SEO incluido), 4 textos visibles, 5 `alt` de
imagen sobre el logo viejo del portal de cliente, 6 correos (prosa
reescrita, no solo sustitución de frase — el pie de plataforma ahora
dice siempre "Portal Clarvo tu negocio en orden", estilo "Powered by",
sin importar si el tenant tiene marca propia), título de Swagger.
Excepción respetada: `email.js` → `DEFAULTS_SMTP.cuerpo_cliente` (el
cuerpo de "factura lista" editable en Configuraciones SMTP) sin tocar.
Jest backend 872/872. Validado por HTTP tras rebuild + un envío real de
"recuperar contraseña" con el asunto/cuerpo nuevos, sin errores.
**Commiteado y pusheado** (`06faa3a` → `fact/master`). **Confirmado con
clics reales en navegador**: `/admin`, `/control`, `/login` (logo viejo
intacto, título nuevo) y `/api/docs` (título de Swagger). Ver
PROJECT_STATE.md punto 213.

**Punto 253 (2026-09-08, auditoría de código sin commitear encontrado en
el working tree, sin protocolo previo — ver PROJECT_STATE.md punto
253)**: puntos 208 (CSF → redirige directo al dashboard) y 241 (alta con
Constancia en el registro, prellenado RFC/tipo persona) aparecían
"PENDIENTE, sin analizar ni implementar" en `PROJECT_STATE.md` pero ya
tenían código real sin commit en 8 archivos + 2 specs Playwright nuevas
— mismo patrón de otra herramienta trabajando en paralelo sin avisar
(puntos 113/140/158). Auditados y corregidos 2 bugs reales: radios
"Tipo de persona" del registro quedaban clicables sin que esa selección
fuera a ningún lado (ni `/api/auth/registro` ni `/api/registro` la
leen, y el segundo exige archivo) — ahora el grupo empieza oculto y
`disabled`, solo se revela de solo-lectura si el PDF trae el dato; y
emoji 📄 nuevo en `login.html` reemplazado por el SVG ya usado en el
dropzone vecino ([[feedback_sin_emojis_en_mockups]]). `.env.example`
tenía un typo (".cla" sobrante) que esta sesión no pudo tocar — el
archivo está bloqueado por la política de permisos para dotfiles,
pendiente que el usuario lo corrija a mano. Jest backend 902/902 sin
regresión. **Actualización, misma sesión — validado contra Docker/MySQL
reales**: rebuild `--no-cache`+`--force-recreate` backend+frontend,
las 2 specs E2E ya escritas (`csf-208.spec.ts`/`registro-241.spec.ts`)
corridas contra el stack real vía Playwright/Chromium — **4/4 passed**,
confirma que el fix del radio (oculto/disabled hasta detectar el dato)
no rompe el flujo real. Extensión Claude in Chrome seguía sin conectar.
**Commiteado y pusheado.**

**Punto 252 (2026-09-07, IMPLEMENTADO Y VALIDADO contra Docker/MySQL
reales — cierra el punto 213 original de este archivo)**: fecha de
expiración opcional en Inventarios (por producto, no por lote — el
esquema no tiene concepto de lotes), aplica a tenant y sitio base. Solo
aviso, nunca bloquea Ventas — indicador "Por vencer" (9na tarjeta del
tablero, único `<button>` real de las 9) cuenta juntos vencidos+próximos
30 días (`UMBRAL_POR_VENCER_DIAS`, misma constante en el conteo del
dashboard y el filtro `?vencimiento=por_vencer` de `GET /productos`, para
que nunca se desincronicen), clic abre modal con la lista (badges
reusados de Cuentas por cobrar). Fuera de alcance a propósito: la carga
masiva CSV/XLSX no incluye el campo. Jest backend 902/902 (6 tests
nuevos). Validado con 5 productos de prueba reales contra Docker/MySQL
(dashboard contó 2, filtro trajo esos 2, servicio ignoró el campo,
formato inválido rechazado) — entorno restaurado. Sin herramienta de
navegador esta sesión — falta confirmación visual. Ver PROJECT_STATE.md
punto 252.

**Punto 251 (2026-09-07, IMPLEMENTADO Y VALIDADO de punta a punta contra
Docker/MySQL reales)**: botón "Activar" en `/control` para completar el
aprovisionamiento físico de un tenant en "Provisionando" — SIN root de
MySQL. Hallazgo clave (validado antes de codificar): el usuario de
aplicación `app` (credenciales ya montadas en `backend`) ya tenía un
`GRANT ALL PRIVILEGES ON tenant\_%.*` tipo comodín (otorgado una sola vez
por el CLI `provisionar-tenant.js`) — con eso puede crear cualquier
`tenant_<slug>` y aplicarle el esquema sin root. Endpoint interno nuevo
`POST /internal/activar-tenant/:slug` en backend (mismo patrón de
`/internal/renombrar-slug`); `activarTenant()` nueva en
`control/utils/tenantLifecycle.js` (verifica estado ANTES del paso
físico, para nunca marcar "activo" si la creación de la BD falla); ruta
`POST /api/control/tenants/:slug/activar`. El CLI sigue como respaldo si
el privilegio llegara a faltar. Jest backend 897/897, control 125/125.
Validado con un tenant de prueba real (`activartest`): intake → activar
→ 23 tablas reales confirmadas por SQL → `/activartest/admin` responde
200 → limpiado. Sin herramienta de navegador esta sesión — falta
confirmación visual. Ver PROJECT_STATE.md punto 251.

**Punto 248 (2026-09-07, IMPLEMENTADO Y VALIDADO por curl+inspección del
build real)**: slug clicable en la tabla de empresas de `/control`,
directo a `/<slug>/admin` — solo si el tenant está `activo`, dominio
100% dinámico (`window.location.origin`, nunca hardcodeado), tooltip real
vía `data-tooltip` con la URL completa. Confirmado por el usuario: el
link no agrega acceso nuevo — `ADMIN_USERS`/cuenta `admin` ya entran a
cualquier `/<slug>/admin` (punto 185). `.control-slug-link` en
`admin.css`. Falta confirmación visual (sin navegador esta sesión, y sin
tenant `activo` real para ejercitarlo). Ver PROJECT_STATE.md punto 248.

**Punto 227 (2026-09-07, IMPLEMENTADO Y VALIDADO contra Docker/MySQL
reales)**: descuento opcional por porcentaje en Ventas (admin y sitio
base), aplicado antes del IVA, reflejado en ticket/correo/modal "Ver
venta". `cantidad` en `ordenes_compra` pasa a guardar el subtotal ya NETO
(con descuento aplicado) — preserva el invariante `total =
cantidad×(1+iva%)` que ya usan Resumen financiero/Cuentas por
cobrar/facturación, cero cambios ahí. 2 columnas nuevas
(`descuento_porcentaje`/`descuento_monto`, solo para reconstruir la línea
en ticket/correo/detalle por suma exacta, nunca división). **Bug real
encontrado validando contra MySQL real** (no detectable con mocks): 100%
de descuento viola el CHECK real `chk_ordenes_compra_cantidad (cantidad >
0)` — rango ajustado a "mayor a 0 y MENOR a 100" en las 3 capas. Jest
backend 891/891 (6 tests nuevos). Centro de conocimiento (Ventas) al día.
Sin herramienta de navegador esta sesión — falta confirmación visual. Ver
PROJECT_STATE.md punto 227.

**Punto 215 (2026-09-07, IMPLEMENTADO Y VALIDADO por HTTP contra Docker
real)**: homologación de "Correo de contacto de la empresa" — el sitio
base (sin tenant) ahora también lo edita desde `/admin` › Configuraciones
globales › Configuración Reportes › "Contacto con clientes", igual que un
tenant real (punto 186/170), con 2 diferencias confirmadas por el
usuario: opcional en el sitio base (obligatorio en tenant) y la burbuja
"Solicitar aclaraciones" del portal ahora también aparece en el sitio
base (antes cortaba de raíz sin `TENANT_SLUG`). `contacto_email_cliente`
nuevo en la config local (`backend/utils/config.js`, mismo patrón que
`correo_reportes`); `PUT /api/admin/config/contacto-cliente` bifurca por
`req.tenant`; endpoint público nuevo `GET /api/aclaraciones/disponible`
(booleano nomás) para que el sitio base sepa si pintar la burbuja sin el
mecanismo de `/api/tema/:slug` que solo aplica a tenants; `POST
/api/aclaraciones` ya no exige tenant. Jest backend 886/886. Validado por
curl contra Docker real (ciclo completo, entorno restaurado a vacío al
terminar) — **no se pudo probar el camino CON tenant en vivo** (sin
tenants activos en este entorno ahora mismo; esa rama de código no
cambió de lógica y sigue cubierta por los tests existentes). Sin
herramienta de navegador esta sesión — falta confirmación visual. Ver
PROJECT_STATE.md punto 215.

**Nota sobre punto 137 (Swagger + credenciales API por tenant)**: la
entrada de más abajo lo describe como "solo anotado, pendiente de
análisis" — quedó desactualizada. Confirmado en esta sesión (2026-09-07)
que ya está implementado por completo (otra herramienta lo agregó en
paralelo, ver incidente del punto 140) y endurecido en las auditorías de
seguridad de los puntos 197/198: Swagger real en `/api/docs`, credenciales
por tenant (`api_credenciales`, gestionadas 100% desde `/control`,
aisladas por `tenant_slug`) y el SUPER con par de credenciales global ya
existente vía `ADMIN_USERS` (funciona contra cualquier tenant sin nada
nuevo que construir). Único hueco real encontrado: `control/` no tiene
test unitario propio para `apiCredenciales.js` (tampoco para
`tenantTema.js`, mismo hueco ya anotado en el punto 164) — sigue sin
cerrarse, pendiente para una sesión futura si se decide cerrarlo.

**Punto 214 (2026-09-05, IMPLEMENTADO Y VALIDADO contra Docker real y con
clics reales en navegador)**: "Plantillas de correo" — el mecanismo que
antes solo existía para `cuerpo_cliente` (factura lista) se extendió a
los 5 correos que comparten el cascarón `construirCorreoBase()`
(invitación, recuperar contraseña, aviso al contador, factura lista,
reporte) — 5 pestañas, texto editable por plantilla, vista previa REAL
en `<iframe srcdoc>` (llama al mismo `construirCorreoBase()` real vía
`POST /api/admin/config/smtp/preview`, gate solo-`super`), botón
"Restablecer esta plantilla". Branding (logo/colores/estructura) sigue
sin ser editable por diseño — el admin solo manda texto, nunca toca el
cascarón. Asuntos quedan fijos a propósito. Excluidos con justificación:
ticket de venta (cascarón propio, texto con instrucciones funcionales) y
aclaraciones (contenido dinámico del cliente, sin plantilla que editar).
Jest backend 877/877. Validado por HTTP (preview real, envío real de
recuperar-contraseña sin errores) y con clics reales en navegador (5
pestañas, preview en vivo, restablecer, guardar, cero errores de
consola). Limitación cosmética conocida y aceptada: el logo CID no
renderiza dentro de un `<iframe>` de navegador (sí en un correo real,
ver punto 133) — el resto del cascarón se ve idéntico. **Commiteado y
pusheado** (`a61758c` → `fact/master`). **Ajuste mismo día**: el usuario
reportó con captura que el modal "Configuraciones globales" (compartido
con el Centro de conocimiento, `.config-modal`) se veía amontonado con
las 5 pestañas de plantillas — `max-width` 900px→1180px, alto
680px→780px. Confirmado en navegador real tras rebuild. Ver
PROJECT_STATE.md punto 214.

Regla persistente de coordinación entre agentes: después de cualquier cambio
relevante de código, arquitectura, operación, pruebas, decisiones de producto
o estado del proyecto, actualizar siempre `PROJECT_STATE.md` y `CLAUDE.md`
antes de cerrar el trabajo. Si la sesión tiene acceso de escritura a
Claude Mem, registrar también ahí la decisión/estado para que futuras
sesiones de Claude y Codex puedan coordinarse sin depender del historial del
chat. Si solo hay acceso de lectura a Claude Mem, dejar constancia explícita
en estos archivos.

**Constancia (2026-08-12)**: esta sesión de Claude verificó el catálogo de
herramientas MCP de Claude Mem disponibles (`mcp__plugin_claude-mem_mcp-search__*`)
y confirmó que solo expone lectura/consulta (`search`, `get_observations`,
`timeline`, `list_corpora`, `build_corpus`, `prime_corpus`, `query_corpus`)
— ninguna herramienta de escritura/registro manual de observaciones.
Los segmentos 8 y 9 (MySQL HA/Swarm y app de control `/control`) quedan
documentados aquí, en `PROJECT_STATE.md` (puntos 95-96) y `README.md` para
que Codex u otra sesión de Claude puedan continuar sin depender de este
chat. El registro automático en Claude Mem de esta sesión (si ocurre) pasa
por el hook de cierre de sesión, no por una llamada manual de esta sesión.

Esta regla se ejecuta junto con el protocolo
`addv-web-app`: analizar primero, proponer un segmento acotado, esperar
confirmación explícita del usuario e implementar solo el segmento aprobado,
manteniendo el piso obligatorio de UX/accesibilidad/rendimiento/seguridad/
Docker/pruebas/calidad.

## Stack

Node.js 20 + Express 4, MySQL 8 (`mysql2/promise`, SQL crudo, sin ORM),
Nginx sirviendo frontend estático (HTML/CSS/JS vanilla, sin build step),
todo sobre Docker/Docker Compose. Ver README para la lista completa de
dependencias. Prefijo de contenedores: `portalManager-*` (renombrado
desde `pfacturacion-*`, que a su vez venía de `fiscal-uploads-*` — ver
PROJECT_STATE.md puntos 98 y 156, ambos cosméticos, sin efecto en
comportamiento).

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
- Segmento 8 (`docker-stack.yml` para Docker Swarm, MySQL primario/réplica
  por GTID vía `mysql/conf/*.cnf`, scripts
  `backend/scripts/configure-replica.js` / `promote-replica.js` /
  `verify-replication.js`): hecho, con dos decisiones de alcance ya
  tomadas — failover **manual** (no automático) y lecturas **solo en el
  primario** (réplica es standby, no escalado de lecturas). Ver
  PROJECT_STATE.md punto 95. **Nunca desplegado contra un clúster Swarm ni
  MySQL replicando de verdad** — antes de producción, levantar un clúster
  de prueba y validar los 3 scripts contra infraestructura real, incluido
  un failover simulado.
- Segmento 9 (FINAL — `/control`, app cross-tenant para gestionar el
  ciclo de vida de tenants ya existentes: suspender/reactivar/dar de
  baja): hecho. Solo perfil `'super'`. **No incluye crear tenants
  nuevos** — eso sigue siendo el script CLI `provisionar-tenant.js`
  (requiere root de MySQL). Ver PROJECT_STATE.md punto 96. Con este
  segmento, el plan de 9 segmentos de migración a multi-tenant quedó
  completo.
- Segmento 9b: `/control` movido a su propio contenedor (`control/`,
  directorio y build de Docker separados de `backend/`) — pedido
  explícito del usuario, por seguridad (credencial MySQL angosta
  `control_app`, sin acceso a `tenant_*`) y portabilidad
  (`CONTROL_UPSTREAM_HOST`/`PORT` en nginx, puede vivir en otro
  servidor). Auth de `/control` ahora es SOLO `ADMIN_USERS` (sin
  `fallback_admin`/`perfil_bd`, que solo aplican a `/admin`).
  Invalidación de caché entre contenedores vía
  `POST /internal/cache-tenant/invalidar` en backend (secreto
  compartido `INTERNAL_CACHE_SECRET`) — validado en vivo: efecto
  inmediato, no hasta 45s después. Ver PROJECT_STATE.md punto 99.
- **Segunda validación del segmento 9b, con clics reales en navegador**
  (extensión Claude in Chrome, ver PROJECT_STATE.md punto 100): confirmó
  `/admin` y `/control` de punta a punta (login, suspender/reactivar con
  modal + toast + tabla actualizándose sola). Encontró y corrigió un bug
  chico: `frontend/control.html` seguía mencionando "la cuenta de
  respaldo" en el texto de ayuda del login, ya no aplica (`/control` solo
  acepta `ADMIN_USERS`).
- Segmento 9c (alta de empresa nueva desde `/control`, ver
  PROJECT_STATE.md punto 101): `POST /api/control/tenants` en
  `control/server.js` + `control/utils/tenantIntake.js` guardan la
  solicitud con `estado='provisioning'` (sin tocar la decisión de
  seguridad del segmento 1: CREATE DATABASE + GRANT siguen siendo solo
  del script CLI `backend/scripts/provisionar-tenant.js`, que ahora
  detecta esas filas y las completa en vez de rechazarlas como "ya
  existe"). Campos fiscales opcionales (7 columnas nullable nuevas en
  `tenants`, pre-llenado de la config fiscal del tenant al aprovisionar
  vía `aplicarConfiguracionFiscalEnProcesoHijo`). Modal "Nueva empresa"
  en `frontend/control.html`/`control.js`. **Validado contra Docker/
  MySQL reales (2026-08-13)**: 201/400/409 del intake, flujo completo
  provisioning → activo con pre-llenado fiscal, ciclo de vida 404/200.
  Bug encontrado y corregido en la rama 9c de
  `backend/scripts/provisionar-tenant.js`: los procesos hijo usaban
  `fila.db_host` ('mysql', nombre Docker) en vez de `dbHost` del env —
  desde el host no resolvía (ENOTFOUND). **Validación E2E en navegador
  real (Playwright, 2026-08-13)**: `e2e/tests/control-alta-empresa.spec.ts`
  (login /control → modal → captura con fiscales → fila "Provisionando" +
  rechazo de slug duplicado) y `e2e/tests/contexto-urls.spec.ts` (el slug
  define las URLs `/e2e9c…` y `/e2e9c…/admin`, API tenant-aware resuelve
  contra la BD del tenant, slug inexistente 404) — 7/7 passed, dos
  tenants reales aprovisionados y validados de punta a punta. El slug
  activo vive en `e2e/.slug-e2e.txt` (gitignored) para coordinar
  captura → aprovisionamiento CLI → validación de URLs. No avanzar sin
  aprobación explícita del usuario, mismo protocolo `addv-web-app`.
- **Validación E2E funcional del flujo completo en el tenant real
  `piloto9c` (Playwright headed, 2026-08-13, ver PROJECT_STATE.md punto
  102)**: `e2e/tests/flujo-facturacion-piloto9c.spec.ts` (5 tests seriales:
  registro+CSF → venta → ticket → factura ZIP → descarga del
  cliente), **5/5 passed** contra el stack Docker real. Encontró y
  corrigió **dos bugs de producción**:
  1. **ALS/multer (multi-tenant)**: el AsyncLocalStorage de
     `ejecutarComoTenant` no se propaga de forma confiable al callback de
     multer/busboy → `pool.query` caía a veces a `portal_facturacion`
     (registros huérfanos, `COMPRA_NO_ENCONTRADA` intermitentes). Fix:
     `req.poolTenant` en `backend/utils/tenantContext.js` + helpers
     `reanudarContextoTenant`/`subirConTenant` en `backend/server.js` que
     envuelven los 4 call sites de multer (tickets, registro,
     constancia-compania, factura).
  2. **Desfase de 1 segundo en ventas**: `new Date()` con
     milisegundos → `Intl.DateTimeFormat` trunca la hora mostrada pero
     MySQL redondea la guardada → la validación del ticket fallaba ~50%
     de las veces con datos correctos. Fix: `ahora.setMilliseconds(0)`
     antes del INSERT/respuesta en `POST /api/admin/ordenes-compra`.
  Suite Jest 388/388, y la suite E2E es idempotente (limpia tickets
  residuales en `beforeAll` y cierra el modal de notificación si aparece).
  No avanzar sin aprobación explícita del usuario, mismo protocolo
  `addv-web-app`.
- **Segmento "Marca" (ver PROJECT_STATE.md punto 103)**: hecho y validado
  contra Docker/MySQL reales (2026-08-13). Campo `marca` (VARCHAR 255) +
  `marca_logo_url` (VARCHAR 500) en `control_tenants.tenants` (solo vía
  `control/scripts/ensureSchema.js`); logo en MinIO bajo key
  `marca/<slug>/logo` (sin extensión, ContentType del objeto), subido por
  el control vía `POST/DELETE /internal/marca-logo/:slug` (secreto
  `X-Internal-Secret`, NO expuesto por nginx) y servido por
  `GET /api/marca-logo/:slug` (público a propósito — va en correos —,
  `Cache-Control: public, max-age=86400`). Los 7 "ADDV" incrustados en
  correos del backend quedaron mapeados a `MARCA_DEFECTO='ADDV'` +
  `marcaDelTenant(req)` en `backend/server.js` (tickets, órdenes de
  compra, invitación, ticket nuevo al contador, factura lista, plantilla
  default de `backend/utils/email.js`); `req.tenant.marca`/`marcaLoGoUrl`
  llegan desde `tenantContext.js`. API de control:
  `PUT /api/control/tenants/:slug/marca` (`{marca?, logoBase64?,
  quitarLogo?}`, 400/404/502, evento `marca_actualizada` + invalidación
  de caché) en `control/utils/tenantMarca.js`; el intake 9c acepta
  `marca`+`logoBase64` (sube el logo antes de crear la fila; huérfano en
  MinIO si el alta falla, aceptado). UI: campo Marca + logo en el modal
  de alta y botón "Editar marca" por fila en `/control`; etiqueta
  "Slug (Contexto URL único)". Límites `express.json` en 4mb (backend y
  control) para el base64; `MAX_MARCA_LOGO_MB=2` (env en ambos).
  Verificación: backend Jest 482/482 (28 suites), control 67/67 (6
  suites), E2E piloto9c 5/5, flujo real (subir/GET/borrar logo contra
  MinIO real, invitación con la marca del tenant hasta SMTP).
  No avanzar sin aprobación explícita del usuario, mismo protocolo
  `addv-web-app`.
- **Segmento "Edición" (ver PROJECT_STATE.md punto 104)**: hecho y
  **validado contra Docker/MySQL/MinIO reales (2026-08-14)**: rebuild
  del stack; renombrado de slug con 4 archivos reales + logo (migración
  íntegra verificada byte a byte, prefijo viejo vacío, db_name
  conservado, auditoría `slug_cambiado`, URLs 200/404); spec E2E NUEVO
  `e2e/tests/control-editar-empresa.spec.ts` (2/2) y suite E2E completa
  14/14. Detalle de la validación: el checkbox del switch "Cambiar
  slug" está oculto visualmente — se interactúa con su label.
  Edición completa de una empresa existente desde `/control`: botón
  "Editar" por fila → modal con los MISMOS campos que el alta + slug
  en solo lectura, habilitable solo con el switch "Cambiar slug
  (avanzado)" (CSS `.control-switch` en `frontend/admin.css`; el modal
  viejo "Editar marca" del punto 103 quedó reemplazado). API:
  `PUT /api/control/tenants/:slug`
  (`control/utils/tenantEdicion.js`, 200/400/404/409/502). Cambiar slug
  dispara ANTES la migración de TODOS los archivos del tenant en MinIO
  vía endpoint interno `POST /internal/renombrar-slug` en
  `backend/server.js` (secreto `X-Internal-Secret`, NO expuesto por
  nginx; copia verificada por conteo → 502 sin borrar nada si no cuadra;
  helpers `copiarArchivo`/`eliminarPrefijo` nuevos en
  `backend/utils/storage.js`). La BD física NO se renombra (`db_name` se
  conserva; solo en `provisioning` se regenera con el slug nuevo);
  `storage_prefix` sí cambia. nginx no necesita recarga (rutas regex del
  segmento 4); el control invalida la caché del backend para ambos
  slugs. Auditoría `datos_actualizados`/`slug_cambiado` en
  `tenant_eventos`. Bug corregido en la revisión: el toast de éxito
  comparaba el slug después de `cerrarEdicion()` (habría dicho siempre
  "el slug cambió") — se captura el slug anterior antes de cerrar el
  modal. Suites al día: backend 492/492 (28 suites), control 88/88 (7
  suites), E2E completa 14/14. No avanzar sin aprobación explícita del
  usuario, mismo protocolo `addv-web-app`.
- **Segmento "Look & Feel" (ver PROJECT_STATE.md punto 105)**: identidad
  visual (tema) por empresa desde `/control` — paleta de colores,
  tipografías (catálogo cerrado de 8 fuentes Google Fonts, nunca texto
  libre), radio de esquinas y favicon propio, sobre el diseño base ADDV.
  Columna nueva `tema_json` (TEXT NULL) en `control_tenants.tenants`;
  validación DUPLICADA `backend/utils/tenantTema.js` /
  `control/utils/tenantTema.js` (mismo principio que `tenantMarca.js`),
  incluido contraste **WCAG 2.1 AA real** sobre 9 pares fondo/texto (400
  si no cumple). Favicon con el mismo patrón que el logo de marca:
  `POST`/`DELETE /internal/favicon/:slug` en `backend/server.js`
  (`X-Internal-Secret`, no expuesto por nginx), MinIO
  `marca/<slug>/favicon`, público en `GET /api/favicon/:slug` (cache
  24h); el renombrado de slug del segmento 104 ya lo migra. API:
  `PUT /api/control/tenants/:slug/tema` (200/400/404/502) y pública
  `GET /api/tema/:slug` (siempre 200, cache 5 min) que arma
  `{marca, marcaLoGoUrl, tema, variables, fuentesGoogle}`. Frontend:
  script nuevo `frontend/theme.js` (cargado después de `style.css` en
  las 6 páginas del portal, pinta CSS variables en runtime, degradación
  elegante si falla) y sección colapsable "Identidad visual" con vista
  previa en vivo dentro del modal de edición de `/control`.
  **Sin verificar en esta revisión** (sesión sin autorización para
  correr `node --check`/Jest): faltan pruebas en `control/` (no hay
  `tenantTema.test.js` ahí, solo en `backend/`) y validación contra
  Docker/MySQL/MinIO reales, mismo patrón pendiente que los segmentos
  103/104 antes de este punto. Se corrigió un mojibake (encoding roto,
  cosmético) en un comentario de `control/scripts/ensureSchema.js`
  durante esta revisión. No avanzar sin aprobación explícita del
  usuario, mismo protocolo `addv-web-app`.
- **Siembra de datos de demostración, COMPLETA (ver PROJECT_STATE.md
  punto 115)**: flujo real end-to-end por HTTP (registro cliente → CSF →
  venta → ticket → factura/gastos) contra Docker vivo, para tener datos
  de muestra reales de cara a una demo. Conteos finales verificados por
  SQL directo: "Sin contexto" (`portal_facturacion`) 7 clientes/14
  ventas/14 tickets/10 gastos; tenant `pruebaadmin` 4 clientes/8 ventas/8
  tickets (5 listo/2 pendiente/1 en_curso)/7 gastos; tenant `piloto9c` 4
  clientes nuevos + 1 preexistente de E2E/8 ventas/8 tickets (misma
  distribución 5/2/1)/7 gastos. **Hallazgo resuelto**: los tenants
  `pruebaadmin`/`piloto9c` no tenían la tabla `gastos` porque
  `ensureSchema()` nunca corre contra tenants ya aprovisionados, solo
  contra el pool por defecto — se aplicó corriendo `ensureSchema()`
  directo dentro del contenedor `backend` con `DB_NAME` apuntando a cada
  tenant (`provisionar-tenant.js` no sirve para esto: rechaza re-correr
  contra un tenant ya `activo`). **Bug real encontrado en el camino** (no
  del script de siembra, del endpoint): `POST /api/registro` guarda en
  `registros.rfc` el valor que mande el formulario (`body.rfc`), no el
  RFC extraído del PDF ni el de la sesión — subir la CSF sin mandar
  explícitamente el campo `rfc` deja `registros.rfc` en NULL de forma
  silenciosa (200 OK, el campo es opcional a propósito) y rompe
  después `POST /api/tickets` con `SIN_CONSTANCIA` porque ese endpoint
  busca por `rfc` exacto. Documentado en el punto 115 para que cualquier
  integración futura contra `POST /api/registro` no repita el error.
- **Auditoría de seguridad OWASP Top 10, sitio completo (ver
  PROJECT_STATE.md punto 116, 2026-08-20)**: a pedido explícito del
  usuario, 3 auditorías en paralelo (`backend/`+`control/`, `frontend/`,
  Docker/infra) contra Docker/MySQL/MinIO reales, con autorización previa
  para corregir sin esperar confirmación (no para commitear/pushear).
  Jest backend 551/551, control 88/88 tras las correcciones. Corregidos:
  timing attacks en `X-Internal-Secret` y en login (cliente+admin,
  `crypto.timingSafeEqual`), enumeración sin rate limit en
  `GET /api/registro/buscar`/`:email`, password root de MySQL expuesto en
  texto plano vía healthcheck (`docker inspect`/`docker top`), puertos
  MySQL/MinIO console publicados a `0.0.0.0` (ahora solo `127.0.0.1`),
  falta de `.dockerignore` en `control/` (riesgo de `.env` local
  copiado a la imagen), falta `no-new-privileges` (CIS Docker Benchmark)
  en los 5+6 servicios de compose/stack, mockup con CDN Tailwind sin SRI
  expuesto en el build público del frontend (reubicado fuera de
  `frontend/assets/`), cabeceras `server_tokens off`/HSTS condicional en
  nginx, `.gitignore`/`.env.example`/README con advertencias reforzadas.
  **RESUELTO, ver punto 197**: `nodemailer@6.10.1` vulnerable
  (CRLF/SMTP injection, SSRF vía opción `raw`) — requería salto de major
  a v9 con prueba de envío SMTP real antes de mergear, fuera del alcance
  de un fix seguro sin esa validación. **Bug real de producto encontrado
  y corregido de paso** (no de seguridad): typo `marcaLoGoUrl` en
  `POST /api/admin/ordenes-compra` (`backend/server.js`) causaba
  `ReferenceError`/500 al crear una venta en cualquier tenant con logo de
  marca configurado (la venta ya quedaba insertada, pero el admin recibía
  500 y el correo de confirmación nunca salía). Todo el detalle línea por
  línea, incluidos los hallazgos "ya conocidos" y las recomendaciones no
  aplicadas (segmentar la red plana de Docker), en el punto 116. No se
  hizo ningún commit/push — todo en el working tree para revisión del
  usuario.
- **Gráficas BI en "Resumen financiero" (ver PROJECT_STATE.md punto 117,
  2026-08-20)**: análisis de datos reales → propuesta en markdown →
  aprobación explícita del usuario → implementación, protocolo
  `addv-web-app`. 5 gráficas nuevas (distribución de gastos por
  categoría, ventas facturadas vs sin facturar, balance acumulado,
  proyección de ventas a 2 meses con mínimo de 3 meses reales para
  mostrarse, top 5 proveedores de gasto), todas SVG/CSS puro sin
  librería externa. `GET /api/admin/resumen-financiero` extendido con
  `gastos_por_categoria`/`top_proveedores`/`proyeccion_ventas`. Jest
  552/552. Validado con datos reales de la siembra del punto 115 vía
  `curl` y **en navegador real** (Claude in Chrome, tras reconectar la
  extensión): las 5 tarjetas confirmadas visualmente contra los datos
  reales, sin errores de consola. Commit `d0b0ada`. **Rediseño de
  paleta (mismo día, punto 117)**: la paleta original de 10 colores
  arcoíris para las categorías de gasto no tenía relación con la
  identidad del panel — reemplazada por una rampa derivada de la marca
  (navy/verde/terracota ya establecidos) y luego suavizada a tonos
  pastel a pedido explícito del usuario, con espacio + `stroke-linecap:
  round` entre segmentos de dona y borde sutil en los puntos de leyenda
  para que los pasteles no pierdan definición. Las 5 tarjetas ganaron
  íconos de encabezado reutilizando los mismos badges/semántica de las
  KPI (`inicio-stat-icono-*`), sin colores nuevos inventados. Se
  investigó y descartó como bug real el "texto en negro" que reportó el
  usuario — verificado en navegador limpio que la leyenda siempre fue
  gris/oscuro neutro, el efecto venía de algo del lado de su navegador.
  Validado visualmente en navegador real. Commit `3289675`, pusheado a
  `fact`. **Rediseño de layout + modal de detalle (mismo día, punto
  117)**: a pedido del usuario ("se ve desperdiciado mucho espacio" +
  "que al dar click se abra en popup"), se corrigió la causa raíz del
  vacío en la barra mensual (`flex: 1` en una sola columna estirándose a
  ~900px — ahora `flex: 0 0 64px` + `justify-content: center`), las
  donas pasaron de apiladas a lado a lado (dona + leyenda), las 2
  gráficas dispersas (Balance acumulado/Proyección) se reagruparon
  juntas en vez de cada una emparejada con una dona densa, y "Top
  proveedores" topó sus barras a `max-width: 640px` (antes se estiraban
  a todo el ancho de pantalla). Nueva funcionalidad: botón "expandir" en
  las 6 tarjetas abre un modal grande (mismo patrón que "Gestionar" de
  tickets) que REUBICA el contenido ya renderizado (mismo elemento del
  DOM, sin duplicar lógica de render) y lo regresa al cerrar. **Bug real
  encontrado y corregido durante la validación**: excepción de JS al
  cargar (`els.btnResumenFinDetalleCerrar` null) rompía toda la vista —
  causa real: caché de disco del navegador sirviendo HTML viejo contra
  JS nuevo (mismo gotcha ya documentado, manifestación distinta —
  excepción en vez de vista vieja). `Ctrl+Shift+R` lo resolvió. Validado
  en navegador real (barra, donas y modal de detalle probados en 2
  tarjetas), sin errores de consola. Commit `1fd0dbd`, pusheado a `fact`.
- **Tarjeta "Utilidad neta del mes (ventas totales vs gastos)" (ver
  PROJECT_STATE.md punto 118, 2026-08-20, IMPLEMENTADO)**: usuario pidió
  una tarjeta nueva con gráfico para "Resumen financiero" — total
  vendido SIN importar si está facturado, el IVA cobrado en esas ventas,
  y la utilidad neta comparada contra gastos — propuesta documentada
  primero (protocolo `addv-web-app`), nombre y segmento confirmados
  explícitamente por el usuario ("Sí, implementa todo el segmento"), e
  implementado el mismo día. Corrige dos límites reales del KPI
  "Balance ventas vs gastos" existente (Facturado−Gastos, punto 114):
  (1) solo cuenta ventas ya facturadas, (2) no separa el IVA antes de
  restar gastos. **Backend**: `GET /api/admin/resumen-financiero`
  extendido — el query KPI de ventas ahora también suma
  `SUM(o.cantidad) AS subtotal` (sin join a `tickets`, una sola consulta)
  y `mes_actual` devuelve `subtotal_ventas`/`iva_ventas`/`utilidad_neta`
  (redondeo a 2 decimales contra polvo flotante); `total_vendido` no se
  duplica porque ya es `mes_actual.ventas`. **Frontend**: tarjeta
  full-width tras los 4 KPIs con número grande verde/rojo, nota visible
  del límite honesto ("IVA cobrado en ventas, no cifra fiscal" — los
  gastos solo tienen el booleano `iva_incluido`), barras apiladas CSS
  puro (Subtotal #719FD4 + IVA #C0D3EB vs Gastos gris, ancho fijo 48px,
  lección del punto 117), leyenda de 4 filas, empty state, y modal de
  detalle vía el mecanismo genérico `data-detalle-contenido`. **Tests**:
  mocks con `subtotal` + aserciones nuevas (utilidad 2800 ≠ balance 1800
  demuestra que cuenta ventas sin facturar; solo-gastos → −500).
  `node --check` limpio, Jest **552/552 (33 suites)**, resumen
  financiero 6/6. Sin cambios de esquema. **Rebuild hecho contra el
  stack real** (`--no-cache` + `--force-recreate` backend+frontend,
  lección del punto 109): health OK, HTML nuevo servido y API validada
  con datos reales (iva_ventas = ventas − subtotal exacto; utilidad
  −12,879.46 ≠ balance −37,308.46). Pendiente solo la revisión visual
  del usuario (`http://localhost:8088/admin`, `admin:admin`). Constancia
  para Claude Mem: esta sesión siguió teniendo
   solo herramientas de LECTURA de Claude Mem, así que el registro vive en
   PROJECT_STATE.md/CLAUDE.md/AGENTS.md (+ `cmem.md`).
- **Modo dashboard personalizable en Resumen financiero (ver
  PROJECT_STATE.md punto 119, 2026-08-20, IMPLEMENTADO Y VALIDADO)**:
  usuario pidió reordenar/redimensionar las tarjetas de la vista y que el
  layout se guarde por perfil restaurándose en cada ingreso — propuesta +
  decisiones capturadas por cuestionario (solo esta vista, persistencia
  servidor, guardado automático) + confirmación explícita ("Sí, implementa
  todo el segmento"). **Vanilla sin librerías**: los 11 elementos (4 KPIs
  + 7 tarjetas) son hijos directos de un tablero CSS Grid de 12 columnas
  (`#resumen-fin-tablero`, `data-dashboard-id` en cada uno; se aplanaron
  los KPIs fuera de su wrapper y se quitaron los dos `.resumen-fin-grid`)
  y el drag NUNCA mueve nodos del DOM — solo `style.order`/
  `style.gridColumn`, movimiento visual con `transform` — para no romper
  `abrirDetalleGrafica()` (el modal devuelve cada contenido a su padre
  original). Teclado completo como alternativa WCAG AA (↑/↓ posición,
  ←/→ ancho, Esc sale). Backend: tabla `preferencias_dashboard`
  (UNIQUE usuario+vista, layout_json JSON, SIN FK a usuarios a propósito —
  cuentas super/respaldo no están en `usuarios`) + `GET/PUT/DELETE
  /api/admin/preferencias-dashboard/:vista` con whitelist cerrada de IDs,
  span entero 3..12, rechazo EN BLOQUE de layouts inválidos, upsert y
  normalización de layouts viejos contra la whitelist vigente; auditoría
  cubierta por el middleware global existente. Guardado automático con
  debounce 800ms + toast; botón "Restablecer" solo visible con layout
  guardado; <900px se ignora el ancho custom pero se conserva el orden.
  Jest **560/560 (34 suites)** (8 tests nuevos). Validado contra
  Docker/MySQL reales: rebuild, health OK, HTML nuevo servido (11 IDs),
  tabla real creada, ciclo API completo por HTTP (null→PUT→GET→400s→404→
  401→DELETE) y auditoría automática verificada. Pendiente solo revisión
  visual del usuario. Claude Mem: esta sesión siguió con herramientas de
  solo lectura — registro en PROJECT_STATE.md/CLAUDE.md/AGENTS.md/cmem.md.
- **Fix de alineación + tarjeta "Sin facturar" en Resumen financiero (ver
  PROJECT_STATE.md punto 121, 2026-08-21, IMPLEMENTADO Y VALIDADO en
  navegador real)**: causa raíz del bug "barra Gastos movida/chueca" en
  "Utilidad neta del mes" — `.resumen-fin-chart-body` alineaba columnas
  por `flex-end`, así que una etiqueta de 2 líneas ("Ventas totales")
  corría hacia abajo la columna con etiqueta de 1 línea ("Gastos"); fix
  de 1 línea (`align-items: flex-start`, la caja de la barra siempre es
  200px fija en ambas). 4ta barra "Sin facturar" en "Ventas vs Facturado
  vs Gastos" — dato derivado en cliente (`ventas - facturado`, cero
  cambios de backend), color `#E4A97E` REUTILIZADO del que ya existe
  para el mismo concepto en la dona vecina (regla de la skill `dataviz`:
  "color sigue a la entidad"), validado con el validador oficial de
  paleta. Reordenada junto a "Facturado" y gap de Utilidad neta reducido
  a pedido del usuario en vivo durante la prueba. **Bug preexistente no
  relacionado, encontrado y corregido de paso**: refrescar el navegador
  en cualquier vista distinta de "Inicio" siempre regresaba a Inicio —
  ahora `sessionStorage` (`admin_vista_actual`) persiste la vista y la
  restaura solo en refresh de sesión ya activa (nunca en login nuevo,
  que sigue forzando "Inicio"). Validado en navegador real (Claude in
  Chrome): zoom a pixel confirmando mismo fondo en ambas barras, 4
  barras en orden correcto en tarjeta normal y modal expandido, refresh
  en "Resumen financiero" mantuvo la vista con datos, login nuevo
  aterrizó en Inicio con datos reales, sin errores de consola. **2
  ajustes finales tras revisar captura de pantalla**: orden final
  Ventas/Gastos/Facturado/Sin facturar (Gastos movido junto a Ventas), y
  fix de alineación vertical entre "Utilidad neta" y "Ventas vs
  Facturado vs Gastos" (`.resumen-fin-chart-card` a flex column +
  `#resumen-fin-chart-contenido { margin-top: auto }`, id único, no
  toca la tarjeta vecina) — ambas tarjetas comparten línea base tras
  validar con zoom a pixel. Sin commit/push — working tree para
  revisión del usuario.
- **"Ventas con inventario activo v2" — Segmento A (varias líneas de
  inventario por venta) — CÓDIGO COMPLETO, Jest 707/707, VALIDACIÓN
  CONTRA DOCKER INTERRUMPIDA (ver PROJECT_STATE.md punto 151,
  2026-08-25/26)**: tabla nueva `orden_productos` (sin FK, mismo
  criterio que el resto del proyecto), `POST/GET/DELETE
  /api/admin/ordenes-compra` extendidos para aceptar/devolver
  `productos_inventario` (array, todo-o-nada con reversión
  `devolucion_cliente` si una línea falla), campos legacy
  `producto_id`/`producto_cantidad` intactos y sin regresión. Frontend:
  bloque manual de "Registrar venta" se oculta por completo con
  inventario activo (ya no coexisten), precio autocompletado editable,
  "+ Agregar producto" reutilizado, badge "Inventario" en la tabla.
  **Bloqueado por infraestructura, no por código**: el contenedor
  `pfacturacion-minio` (creado 2026-08-20, antes de esta sesión) quedó
  con `NetworkMode` legacy fuera de `portalfac_fiscal-net` — el backend
  no lo resuelve por DNS y entra en ciclo de reinicio
  (`ENOTFOUND minio`). Siguiente sesión: `docker compose rm -sf minio`
  + `docker compose up -d minio` para que Compose lo recree en la red
  correcta, luego terminar de validar por HTTP/navegador (detalle
  completo en el punto 151). Sin commit/push. Segmento B (catálogo
  cifrado en local para vender offline con inventario activo) sigue sin
  empezar, depende de A.
- **Rediseño de "Ventas" — APROBADO POR EL USUARIO, PENDIENTE DE
  IMPLEMENTAR (ver PROJECT_STATE.md punto 126, 2026-08-21)**: NADA
  implementado todavía — es la especificación completa ya aprobada
  (protocolo `addv-web-app` completo, con 2 rondas de crítica del
  propio usuario a su idea y ajustes ya resueltos), documentada para
  que cualquier sesión futura la implemente sin rederivar el diseño.
  Resumen: (1) formulario "Registrar venta" pasa de sticky-lateral a
  botón + modal (reusa `.ticket-modal`, 820px, mismo patrón que
  "Gestionar" de Tickets), tabla a ancho completo; (2) un solo modal
  para escritorio Y móvil — en móvil (<900px) se vuelve pantalla
  completa con wizard de 3 pasos (Cliente → Productos → Confirmar,
  reusa el patrón de 3 pasos ya validado en `csf.html`); (3) el modal
  NO se cierra solo al guardar — se limpia y se queda abierto (corrige
  a propósito la pérdida del flujo de "varias ventas seguidas" que un
  modal ingenuo rompería); (4) confirmación de guardado INLINE dentro
  del modal (no toast, "muchas veces no se nota") — palomita animada en
  cyan de marca `#05DBF2` (mismo cyan del ítem activo del sidebar,
  reutilizado) con trazo SVG + "Guardado con éxito", ~1.3s total,
  respeta `prefers-reduced-motion`; (5) filtros nuevos (concepto,
  rango de fechas, rango de total) 100% client-side, sin backend —
  `GET /api/admin/ordenes-compra` ya trae todo sin paginar, mismo
  patrón que el buscador de Constancias. Cero funcionalidad perdida
  (checklist completo en PROJECT_STATE.md). 4 ideas opcionales
  ofrecidas y SIN decidir (productos frecuentes, buscador de cliente
  por nombre/RFC, compartir por WhatsApp, borrador local) — preguntar
  antes de tocar cualquiera si se retoma. **Parte web IMPLEMENTADA Y
  VALIDADA (2026-08-22)**: formulario movido de sticky a modal
  (`#orden-registrar-modal-overlay`, reusa `.ticket-modal`), botón
  "+ Registrar venta", tabla a ancho completo con filtros nuevos
  (`.ordenes-filtros`, 100% client-side, `ordenesCache` +
  `aplicarFiltrosOrdenes()`, sin cambios de backend), palomita animada
  cyan `#05DBF2` en vez de toast (`mostrarExitoRegistrarOrden()`, modal
  se queda abierto y se limpia solo tras guardar). Jest 560/560,
  validado en navegador real (2 ventas de prueba registradas de punta a
  punta, filtros confirmados con datos reales, toast confirmado
  ausente). **Falta el wizard móvil de 3 pasos (punto 2)** — sin
  commit/push todavía, se hace junto con la parte móvil. Ver el punto
  126 completo para el detalle línea por línea antes de continuar.
- **Menú de navegación móvil del panel admin rediseñado — IMPLEMENTADO
  Y VALIDADO (ver PROJECT_STATE.md punto 127, 2026-08-22)**: la fila
  horizontal con scroll lateral (`.admin-sidebar-nav` forzada en móvil)
  no funcionaba bien (tap targets bajo 44px) — usuario pidió una
  grilla simétrica de botones cuadrados con íconos en el home, solo
  móvil. Crítica aplicada antes de implementar: "Inicio" como botón de
  regreso no sirve porque `administrador` no tiene esa vista — se usó
  en su lugar un botón neutral **"Menú"** en la barra superior que
  siempre reabre la grilla completa (independiente del perfil),
  aprobado con "si por favor". Botón `#btn-menu-movil` + grilla
  `#admin-menu-movil` (9 tarjetas `.admin-menu-movil-btn`, mismas
  vistas/íconos del sidebar de escritorio, ocultas/mostradas en espejo
  exacto de `RESTRICCIONES_PERFIL` vía `aplicarRestriccionesPerfil()`).
  `.admin-sidebar-nav` pasa a `display:none` en móvil, reemplazada por
  completo. Jest 560/560, `node --check` limpio, llaves CSS 643/643.
  **Validado en navegador real** con un viewport móvil genuino de
  390×844 simulado vía `<style>` temporal inyectado (el iframe se
  descartó porque `frame-ancestors`/`X-Frame-Options` del punto 116 lo
  bloqueó — confirma que ese endurecimiento funciona): grilla 2
  columnas correcta con los 9 íconos, navegación a "Ventas" oculta la
  grilla, botón "Menú" la reabre desde cualquier vista, cero errores de
  consola. Sin commit/push todavía.
- **Fix de overflow/desalineación en móvil — Resumen financiero,
  Inicio, Gastos (ver PROJECT_STATE.md punto 128, 2026-08-22)**:
  usuario reportó KPIs con texto recortado (2 columnas entre 480-900px
  con números largos) en Resumen financiero/Inicio/Gastos, y filtros
  de Gastos desalineados en móvil (único filtro que aún usaba
  `flex-wrap` con `min-width` en vez del patrón grid ya establecido en
  Ventas/Reportes). Propuesta antes/después aprobada. Fix: KPIs
  (`.inicio-stats-grid`, `.resumen-fin-tablero`) a 1 columna directo
  debajo de 900px (sin nivel intermedio de 2); `.gastos-filtros` con
  `@media (max-width: 900px)` nuevo que apila los 7 campos a 100% de
  ancho. Cero cambios en escritorio. Jest 560/560, validado en
  navegador real. **Gotcha de metodología de prueba documentado en el
  punto 128**: angostar solo `body { max-width }` no dispara los
  `@media` reales (`window.innerWidth` no cambia) — hay que replicar
  las reglas del breakpoint manualmente en el arnés de prueba. Sin
  commit/push todavía.
- **Simplificación del formulario de Ventas + wizard móvil de 3 pasos
  — COMPLETA (ver PROJECT_STATE.md punto 129, 2026-08-22)**: cierra el
  punto 2 pendiente del punto 126 (wizard Cliente→Productos→Confirmar,
  reusa `.steps` de `csf.html`, cero componente nuevo) y de paso oculta
  3 campos que no aportan visualmente (Fecha de venta, IVA, "Cantidad
  MXN" agregada — NO la de piezas por producto, esa sigue editable) a
  pedido del usuario, aplicado a escritorio Y móvil (un solo
  formulario). Los 3 campos ocultos se quedan en el DOM (siguen
  recibiendo su valor por JS, cero cambio de comportamiento) —
  sustituidos por un mini-resumen chico "Subtotal $X · IVA $Y" arriba
  del Total (reusa `.field-hint`, sin CSS nuevo). DOM sin reordenar
  (escritorio se ve igual que siempre); en móvil cada paso ocupa el
  mismo lugar vía `display:none`/`.is-active`. Botón "Registrar venta"
  vive fuera del wizard (se muestra/oculta por JS con
  `matchMedia('900px')`, nunca se mueve de sitio en el DOM). Validación
  por paso: "Siguiente" exige correo (paso 1) o ≥1 producto (paso 2).
  Modal a pantalla completa en móvil (`.orden-registrar-modal`, no
  toca otros usos de `.ticket-modal`). Jest 560/560. **Validado en
  navegador real de punta a punta en ambos tamaños, con guardado real
  contra la API en cada uno** (escritorio: $200+$32 IVA=$232; móvil:
  $450+$72 IVA=$522, ambos confirmados por `GET /ordenes-compra`).
  Bloqueo de "Siguiente" sin correo/sin productos confirmado, "Atrás"
  conserva datos. Cero errores de consola. Con esto el segmento
  "Rediseño de Ventas" del punto 126 queda 100% completo. Sin
  commit/push todavía.
- **Correo opcional + método de entrega (correo/imprimir) + ticket de
  impresión en Ventas (ver PROJECT_STATE.md punto 130, 2026-08-22,
  IMPLEMENTADO Y VALIDADO en escritorio Y móvil)**: usuario pidió mover
  el correo al final del wizard, agregar "¿por correo o se imprime?", y
  un ticket de impresión SIEMPRE disponible junto a Reenviar/Eliminar.
  De paso ocultó también "Concepto de venta" (repetía la tabla de
  productos, mismo criterio que Fecha/IVA/Cantidad del punto 129).
  **Único cambio de esquema**: `ordenes_compra.email` de `NOT NULL` a
  `NULL`. Backend: `POST /ordenes-compra` acepta correo vacío (salta
  validación/constancia/envío); `POST /:id/reenviar-correo` ahora
  guarda un correo nuevo cuando la venta no tenía uno y devuelve
  `tiene_constancia`. Wizard reordenado a Productos→Confirmar→Entrega
  (correo hasta el final, junto al toggle "Enviar por correo"/
  "Imprimir ticket" — elegir imprimir oculta Tipo de cliente+Correo
  por completo). Ticket de impresión (`imprimirTicketOrden()`) reusa el
  parser ya existente de productos (cero dato nuevo del backend) e
  imprime la MISMA página vía `@media print` en vez de ventana nueva —
  decisión explícita: `window.open()+print()` se bloquea seguido tras
  un fetch async, sobre todo en móvil. Disponible desde 3 entradas:
  automático al guardar (si "imprimir"), ícono en la fila, botón en el
  modal "Ver venta". Modal nuevo "Asignar correo" para reenviar sobre
  ventas sin correo. Pruebas nuevas: `ordenes-compra.test.js` (no había
  cobertura antes), 7 casos. Jest backend 567/567. Validado contra
  Docker/MySQL reales (migración confirmada, ciclo completo por curl) y
  en navegador real ambos tamaños, con `window.print` interceptado
  durante la prueba para confirmar que se dispara en el momento
  correcto con el ticket ya armado, sin bloquear la automatización. Sin
  commit/push todavía.
- **Fix de la lista de productos capturados en Ventas, solo móvil (ver
  PROJECT_STATE.md punto 131, 2026-08-22)**: usuario reportó "sale
  desacomodado" debajo de "+ Agregar producto" en móvil (escritorio
  bien). Causa: la tabla ya tenía `.admin-table` así que se apilaba
  sola por debajo de 760px, pero sus `<td>` nunca tuvieron
  `data-label` — se apilaba SIN etiquetas (5 valores sueltos, no se
  sabía cuál era cuál). Fix, solo móvil: tarjeta compacta de 2 líneas
  (`.orden-productos-lista-movil`) que reusa tal cual el texto que ya
  arma `textoProductoOrden()` — cero formato nuevo. Escritorio no
  cambió (misma tabla de siempre). **Gotcha de metodología**: el primer
  intento de reproducir el bug dio un falso resultado porque el arnés
  de prueba solo mirroreaba el breakpoint de 900px — la tabla usa 760px,
  un breakpoint distinto que no estaba replicado (mismo patrón de
  gotcha del punto 128, con otro breakpoint). Jest 567/567 (sin cambios
  de backend), validado en navegador real (nombre largo, botón quitar,
  escritorio sin cambios). Sin commit/push todavía.
- **Modo fuera de línea para Ventas y Gastos — IMPLEMENTADO Y VALIDADO
  (ver PROJECT_STATE.md punto 132 y US.md US-073/074/075,
  2026-08-22/23)**: usuario pidió primero instalabilidad PWA (analizada,
  CANCELADA antes de tocar código) y luego modo offline con sync al
  reconectar + "máxima seguridad/cifrado" + franja de estado. Petición
  original inviable tal cual (folios `AUTO_INCREMENT`, validación
  fiscal en vivo, login que requiere BD, riesgo de pérdida silenciosa
  subiendo archivos offline, "cifrado en el navegador" que no protege
  nada si la llave vive ahí mismo — de paso, documentado que el panel
  admin YA guarda usuario:contraseña en `sessionStorage` en base64, no
  cifrado, preexistente). 3 rondas de crítica/refinamiento hasta un
  alcance realista: **solo Ventas y Gastos**, sin archivos, sin login
  offline, folio asignado al sincronizar (orden real de llegada),
  correo sin cola nueva (ya vive en el guardado real existente), Ventas
  difiere la validación de constancia al sync.
  - **`frontend/offline.js`** (nuevo, genérico): IndexedDB
    (`pendientes_ordenes`/`pendientes_gastos`), detección de conexión
    real (no solo el evento `online` — se confirma con ping a
    `/api/health`, reintento cada 10s si sigue "offline"), API pequeña
    que `admin.js` conecta con manejadores concretos por tipo. Agregado
    al `COPY` de `frontend/Dockerfile` (mismo gotcha del punto 106).
  - **Franja de estado** (`#conexion-banner`): roja "Sin conexión a
    internet" / verde "Sincronizando datos…", fade-out al terminar,
    z-index por encima de los modales.
  - **Ventas**: `btnRegistrarOrden` encola en vez de `fetch` si
    offline; "Imprimir ticket" se deshabilita solo al quedarse sin
    conexión (con bloqueo defensivo extra en el handler). Filas
    pendientes (badge ámbar/rojo, total estimado, botones
    Reintentar/Descartar) se mezclan arriba de la lista real sin
    esperar al servidor.
  - **Gastos**: mismo patrón, solo intercepta CREAR (nunca editar);
    comprobante seleccionado se avisa que hay que adjuntarlo después
    (mismo mensaje que ya existía para cuando la subida fallaba).
  - **Sync**: por tipo, en orden de creación, un fallo no detiene a
    los demás (se marca con el error real del backend y sigue).
    Logout con cola pendiente pide confirmación antes de limpiarla.
  - **Verificación**: `node --check` limpio, CSS balanceado
    (689/689), Jest backend **567/567** (100% frontend, sin cambios de
    backend). Validado en navegador real de punta a punta —
    online sin regresión, offline (banner, imprimir deshabilitado,
    venta+gasto encolados con total/monto correcto), reconexión (sync
    automático, folio/id real confirmado contra la API), camino de
    falla (error real mostrado, Reintentar/Descartar funcionando), y
    mismo recorrido en móvil (390×844). **Bug chico encontrado y
    corregido**: botones Reintentar/Descartar se envolvían en 2 líneas
    — `white-space: nowrap`. Limitación aceptada a propósito: la
    lista de lectura offline es solo caché en memoria de la pestaña
    (no sobrevive un reload sin haber cargado antes esa vista) — la
    cola de pendientes por crear sí sobrevive un reload (IndexedDB).
    Sin commit/push todavía.
- **Auditoría + correcciones de Cuentas por cobrar, punto 138 (ver
  PROJECT_STATE.md, 2026-08-24, a pedido explícito del usuario)**:
  revisión del código que la otra herramienta ya había escrito para
  este punto (pese a que su propia documentación decía "cero código
  tocado"). Bug de datos real y grave confirmado contra la BD real:
  la migración de `monto_cobrado` nunca hizo backfill — **207 de 212
  ventas históricas** quedaron "pagada" con `monto_cobrado=$0`.
  Corregido con un `UPDATE` idempotente en `db.js` (self-limiting,
  fuera del bloque "columna nueva" para que sí corriera contra la BD
  ya migrada). Agregados 11 tests Jest nuevos al endpoint `/cobro` y
  a la validación de `estado_pago` (antes: cero cobertura, solo un
  Playwright feliz-camino que no tocaba datos históricos). Agregada
  validación de fecha de vencimiento futura (backend la aceptaba en
  el pasado). Limpiado código muerto en `admin.js`. Agregado filtro
  "Estado de pago" en Ventas (el badge inline ya existía). Jest
  **595/595 (36 suites)**, validado contra Docker/MySQL reales —
  backfill confirmado por SQL directo (212/212 correctas), filtro y
  vista CxC probados en navegador real sin errores de consola. Las 4
  preguntas de diseño de la propuesta original siguen sin respuesta
  explícita del usuario.
- **Sidebar fijo + cifras sin encimarse en Resumen financiero (ver
  PROJECT_STATE.md punto 140, 2026-08-24, IMPLEMENTADO Y VALIDADO)**:
  `.admin-sidebar` pasó de flex-child (se estiraba al alto de
  `.admin-content`, se perdía en vistas largas junto con "Cerrar
  sesión") a `position:fixed; height:100vh` en escritorio (sticky solo
  en móvil <900px). `calcularEtiquetasLejos()` nueva en `admin.js`
  reemplaza el alternar por paridad de índice (solo servía en zigzag)
  por comparación real de ancho de texto vs. espacio entre puntos —
  arregla el encimado en rachas de meses consecutivos subiendo/bajando
  juntos. **Incidente de coordinación documentado**: otra herramienta
  (claude-flow/ruflo) corriendo en paralelo sobre el mismo working tree
  desplegó `admin.js` a medio editar de este lado, causando
  `TypeError` al abrir Resumen financiero y dejando en blanco todo lo
  que renderea después en la cadena — mal etiquetado como "No se pudo
  conectar con el servidor" (era JS roto, no red). Ver punto 140 para
  la auditoría completa de lo que esa herramienta cambió (Swagger +
  credenciales API por tenant ya en `main`; 2 hallazgos de seguridad
  YA CORREGIDOS — #1: `?api_key=` por URL ya no se acepta, solo
  header/cookie (`backend/utils/auth.js`); #2: CSP de `/api/docs`/
  `/api/control/docs` sin `unsafe-inline`/`unsafe-eval` en script-src
  (sus `<script>` son todos `src=` externos del mismo origen, nunca
  inline; el único `new Function()` del bundle es un fallback de
  `globalThis` inalcanzable en navegadores modernos) — style-src
  conserva `unsafe-inline` a propósito (bloques `<style>` literales del
  HTML, riesgo bajo) — **confirmado visualmente por el usuario**
  ("se ve bien"). Cuentas por cobrar sin commitear pese a su
  propia nota de "no implementar sin
  confirmación"). **Rediseño final el mismo
  día**: `calcularEtiquetasLejos()` (colisión por ancho de texto) se
  abandonó por completo — el primer/último punto usan `text-anchor`
  distinto a los del medio, así que ni ese cálculo los medía bien
  (captura real del usuario: "$264.6k" cortado a "$26"). Reemplazada
  por **etiquetado selectivo** (`calcularIndicesClave()`): solo
  primero/último(+último real si hay proyección)/máximo/mínimo llevan
  cifra en el trazo — nunca más de 4-5 por tarjeta sin importar cuántos
  meses traiga la serie; el resto son puntos discretos
  (`.resumen-fin-linea-punto-fantasma`) con su valor disponible por
  `title` nativo al pasar el mouse. Propuesta visual (Artifact
  antes/después reproduciendo el bug real) aprobada antes de
  implementar. Elimina la clase de bug entera en vez de parchar el
  caso puntual. Validado en navegador real, tarjeta normal y modal
  expandido.
- **Categorías de gastos editables desde el popup de "Registrar gasto"
  (ver PROJECT_STATE.md punto 135, 2026-08-23, COMPLETA e IMPLEMENTADA Y
  VALIDADA)**: la lista cerrada de categorías (CHECK de MySQL +
  diccionario duplicado en `admin.js`) pasó a tabla editable
  `categorias_gastos` (slug estable, etiqueta, `activa`, `protegida`,
  `orden`); renombrar y agregar confirmados por el usuario ("Ambas"), y
  categoría nueva sin color propio usa el gris de "Otro" en la dona de
  Resumen financiero (fallback ya existente, sin cambios ahí). Backend:
  `backend/utils/gastos.js` reescrito (CRUD + `generarSlugCategoria()` +
  `reactivarCategoriaGasto()`, agregada tras preguntar al usuario porque
  desactivar sin poder reactivar era una puerta de un solo sentido) + 5
  endpoints en `server.js`. Panel "✏️ Categorías" inline en el modal de
  Registrar gasto (renombrar en línea, borrar solo si 0 gastos, "Otro"
  protegida, reactivar si inactiva, "+ Agregar"). **2 bugs reales
  encontrados y corregidos en la validación contra Docker/navegador
  reales, ninguno detectable con `node --check`/Jest mockeado**: (1)
  dependencia circular `db.js`↔`utils/gastos.js` dejaba `pool`
  `undefined` en gastos.js (500 en los 5 endpoints nuevos) — fix:
  `require('../db')` perezoso dentro de cada función
  (`obtenerPool()`); (2) `#confirm-modal-overlay` compartía
  `z-index:50` con el resto de `.modal-overlay` — al confirmar desde
  DENTRO de otro modal ya abierto (Eliminar categoría desde Registrar
  gasto; mismo riesgo preexistente con "Quitar comprobante" desde el
  detalle de un gasto) el diálogo quedaba invisible detrás del modal
  padre — fix: `#confirm-modal-overlay { z-index: 70; }` en `style.css`.
  Jest backend **584/584 (36 suites)**, validado de punta a punta contra
  Docker/MySQL reales por `curl` y en navegador real (Claude in Chrome:
  crear/renombrar/eliminar/reactivar categoría, registrar un gasto con
  categoría nueva, limpieza completa verificada por SQL de vuelta al
  estado base). Sin commit/push todavía.
- **Datos de prueba históricos para reportes + serie mensual de ~6 meses
  en Resumen financiero (ver PROJECT_STATE.md punto 134, 2026-08-23,
  VALIDADO CONTRA DOCKER REAL)**: usuario pidió histórico para
  validar las tarjetas (balance acumulado/proyección). Dos causas de raíz
  encontradas: retención a 5 días que purgaba todo lo viejo (subida a
  **365** por decisión del usuario) y la gráfica del Resumen recortada al
  mes en curso por diseño (`server.js`: nueva `inicioSerie` = mes actual
  −5, solo para las queries de la serie; KPIs intactos). Siembra vía
  script nuevo `backend/scripts/sembrar-datos-prueba.js` (determinista,
  transaccional, anti-doble-siembra): **175 ventas** (ids 94..268) +
  **85 tickets 'listo' vinculados** (ids 82..166, imagen placeholder sin
  MinIO) + **86 gastos marcados** (nota `'Dato de prueba (validacion de
  reportes)'`), ventana mar–jul completos + ago 1–22; KPIs/tendencias/
  distribución/listas YA reflejan los datos contra la API viva. Cuando la
  sesión paralela terminó "Categorías editables" (suite 584/584), se
  corrió el rebuild único y quedó verificado por HTTP: serie de 6 llaves
  mar–ago + proyección activa (Sep ≈ 342,850 / Oct ≈ 376,521). SQL de
  limpieza impreso por el script.     Sin commit/push todavía.
- **Código de barras por cámara — Segmento A IMPLEMENTADO Y VALIDADO en
  navegador real (ver PROJECT_STATE.md punto 159, 2026-08-29)**:
  `frontend/scanner.js` (nuevo, compartido Ventas+Inventarios) —
  `BarcodeDetector` nativo primero, `html5-qrcode` vendorizado
  (`frontend/assets/vendor/`, nunca CDN) como respaldo para iOS. Cero
  endpoint nuevo — reusa 100% la búsqueda/campo ya existentes. Bug real
  corregido (mismo patrón del punto 135): el modal del escáner quedaba
  detrás del modal padre por z-index empatado — fix en `style.css`
  (`#scanner-modal-overlay { z-index: 70; }`). Jest backend 764/764 (sin
  cambios de backend). **Segmento B (imagen principal de producto) — TAMBIÉN
  IMPLEMENTADO Y VALIDADO contra Docker/MySQL/MinIO reales (2026-08-30)**:
  `sharp` nuevo en backend (resize+WebP, firma binaria reusa
  `detectRealImageMimeType()` ya existente), 3 columnas en `productos`,
  `utils/inventarioImagen.js` (límite de dimensión 8000×8000 ANTES de
  decodificar + timeout 10s, nombre de archivo FIJO por producto en
  MinIO — reemplazar sobreescribe, sin huérfanos), 3 endpoints
  `/api/admin/inventarios/productos/:id/imagen` (igual que el
  comprobante de Gastos: subir es petición aparte después de crear el
  producto). Bug real corregido en la validación: `<img src>` no manda
  `Authorization` (Basic Auth manual, sin diálogo nativo cacheable) —
  fix `cargarImagenAutenticada()` en `admin.js` (fetch con header →
  blob URL), aplicado a tabla de Inventarios/sugerencias de Ventas/
  preview del modal. Jest backend 781/781 (45 suites). **Fix de
  regresión el mismo día** (reportado por el usuario con captura): la
  miniatura vivía dentro de la celda "Nombre" de una tabla
  `table-layout:fixed` sin ancho explícito, apretando el texto a 3-4
  líneas — columna "Imagen" propia (48px) separada en `admin.html`/
  `admin.js`/`admin.css`, propuesta antes/después aprobada primero (skill
  `impeccable`, sin correr su crítica dual-agente completa por ser un
  fix acotado). Con esto el punto 159 completo queda implementado.
  Pendiente real: probar con celular físico contra HTTPS real (aquí solo
  se validó el camino de error del Segmento A, sin cámara física). Sin
  commit/push todavía.
- **Cabeceras ajustables en todas las tablas + acciones de Inventarios
  compactas — IMPLEMENTADO Y VALIDADO en navegador real (ver
  PROJECT_STATE.md punto 160, 2026-08-30)**: el mecanismo de
  ocultar/mostrar + redimensionar columnas (`crearControladorColumnas()`,
  ya usado en Constancias/Ventas/Gastos) se conectó a las 4 tablas que
  faltaban — Tickets, Cuentas por cobrar, Usuarios, Inventarios — sin
  reescribirlo, cada una con su botón "Columnas" y claves de
  `localStorage` propias. En Inventarios, además, los 5 íconos de acción
  (ya del tamaño correcto, `.btn-icono-accion`) bajaron a 2 visibles
  (Entrada/Salida) + un menú "⋮" nuevo (`crearMenuAccionesInv()`) para
  Historial/Editar/Eliminar. Propuesta antes/después aprobada primero.
  Validado en navegador real: ocultar columna, redimensionar arrastrando,
  y el menú "⋮" abriendo/cerrando y disparando la acción real. Jest
  backend 781/781 (sin cambios de backend). Sin commit/push todavía.
- **Homologación de marca CLARVO en los 6 correos de salida —
  IMPLEMENTADA Y VALIDADA contra Docker/MySQL/SMTP reales (ver
  PROJECT_STATE.md punto 161, 2026-08-31)**: auditoría a pedido del
  usuario — de 6 correos, solo la confirmación de venta (punto 133)
  tenía diseño; propuesta visual (Artifact con mockups antes/después)
  aprobada con "sí a todas tus recomendaciones". `construirCorreoBase()`
  nuevo en `backend/server.js` (mismo lenguaje visual del ticket —
  `filaCorreoTabla()` extraído del ticket sin cambiarlo) aplicado a
  invitación al portal, recuperación de contraseña, aviso al contador y
  factura lista (esta última envuelve el texto libre del admin tal
  cual, gana botón nuevo "Entrar al Portal"). El reporte automático
  queda fuera a propósito (interno, con adjunto). Color de la franja/
  botón lee `tema_json.colores.accentDark`/`accent` del tenant (Look &
  Feel, punto 105 — cero UI nueva en `/control`), navy/cyan CLARVO de
  respaldo. Requirió exponer `temaJson` crudo en `req.tenant`
  (`tenantContext.js`). **Bug propio corregido en la validación**: la
  primera versión bloqueaba la respuesta con un `await` síncrono antes
  de mandar el correo, rompiendo el patrón fire-and-forget que ya tenían
  estas 4 rutas (Jest lo encontró: 201→500) — fix, todo el cómputo se
  movió dentro de un IIFE async en el mismo `.catch()` de siempre. Jest
  backend 781/781, control 117/117. Validado con el SMTP real de este
  entorno (Gmail): invitación y recuperación de contraseña enviadas de
  punta a punta sin errores, cuenta de prueba borrada después. Aviso al
  contador/factura lista comparten el mismo código ya confirmado, sin
  forzar su flujo completo (constancia+venta+ZIP) por costo/beneficio.
  **Extensión same-day**: el usuario vio los 6 correos reales (probados
  todos de punta a punta contra su Gmail) y pidió homologar también el
  reporte automático (#6), que se había dejado en texto plano a
  propósito. `construirCorreoBase()` y piezas relacionadas se
  extrajeron de `server.js` a `backend/utils/correoMarca.js` (única
  fuente de verdad, sin dependencia circular) para que `utils/
  reportes.js` (usado también en segundo plano por `cierreMensual.js`/
  `ticketsCleanup.js`, sin `req`) las reutilizara.
  `generarYEnviarReporte()` gana parámetros opcionales de marca/logo/
  color — sin ellos (llamadores en segundo plano) cae a CLARVO por
  defecto. Bug propio corregido: la primera versión duplicaba el fetch
  de `getConfiguracionGlobal()` en las 2 rutas con `req`, cuando la
  función ya lo hacía internamente — el `pool.query` de más corrió la
  cola de mocks de Jest y tumbó 3 tests de inventario sin relación con
  correos. Jest 781/781 de nuevo, control 117/117. Validado con un
  envío real del reporte automático a la misma cuenta Gmail. Sin
  commit/push todavía.
- **PENDIENTE — Generador de etiquetas de código de barras para productos
de Inventarios (2026-08-31, ver PROJECT_STATE.md punto 167, SOLO
REGISTRADO)**: petición textual — plantilla de etiqueta con el código de
barras de productos YA existentes en Inventarios, con opción de formato
de impresión (impresora térmica de rollo, o una hoja tamaño carta con
varias etiquetas). Instrucción explícita del usuario: nada de analizar/
criticar/implementar en esta sesión — la siguiente retoma el protocolo
completo (analizar, revisar impacto, criticar y mejorar el
requerimiento, propuesta visual, confirmar) antes de tocar código. Ver
el punto 167 para las preguntas de diseño abiertas.

**"Corte del día" en Ventas — IMPLEMENTADO Y VALIDADO en navegador real
(ver PROJECT_STATE.md punto 168, 2026-08-31/09-01)**: botón "Corte del
día" junto a "+ Registrar venta" — reporte de consulta bajo demanda,
rango de fechas libre (desde-hasta), SOLO ventas, pantalla + imprimir
(sin correo), sí persiste en "Lectura de reportes" (todo decidido por
el usuario tras el Artifact de propuesta A/B). `POST /api/admin/
reportes/corte` reusa `guardarReporte()`/`generarContenidoMD()` ya
existentes en `utils/reportes.js` con `tipo:'corte'` nuevo (migración de
`chk_reportes_tipo`) — no duplica la infraestructura de `/reportes/
enviar`. Imprimir reusa el patrón `@media print` de un solo elemento
visible del ticket de venta (punto 130), `#corte-imprimir` hijo directo
de `<body>`. Jest backend 786/786 (45 suites, 5 tests nuevos). Validado
contra Docker/MySQL reales por curl y en navegador real (Claude in
Chrome) con datos reales y estado vacío, sin errores de consola.
**El usuario avisó al aprobar este segmento que deja el equipo** — ver
memoria persistente `project_handoff_equipo.md`: documentar con doble
cuidado de aquí en adelante, sin asumir que habrá alguien disponible
para resolver ambigüedades futuras. **Commiteado y pusheado**
(`664b36e` → `fact/master`).

**"Lectura de reportes" reorganizada por segmento + pestaña "Cortes"
(ver PROJECT_STATE.md punto 169, 2026-09-01)**: auditoría UX/UI/CX a
partir de 2 capturas del usuario (Artifact con 4 hallazgos + antes/
después, aprobado "Opción A, orden así, textos bien"). Las 3 tarjetas
de auditoría (`#reportes-kpi-grid`) que antes se veían en las 4
pestañas por igual ahora viven SOLO dentro de "Todo lo eliminado"
(carga perezosa, mismo patrón que "Estado del inventario"); letrero de
una línea (`#reportes-tab-caption`) bajo las pestañas, cambia por
segmento; pestaña "Cortes" nueva — los cortes de ventas (punto 168) ya
no aparecen en el selector de "Por reporte", tienen su propia lista +
detalle simplificado (reusa `renderFilaReporteItem()`, sin duplicar
lógica). Columna `reportes.total_monto` (DECIMAL NULL, solo cortes) vía
`guardarReporte({..., totalMonto})` para mostrar el Total $ en la lista
sin abrir cada uno. Bug propio corregido en el camino: `rango_fin` de
un corte se guardaba con el límite exclusivo de la consulta (mostraría
"01 sep – 02 sep" para un corte de un solo día) — se ajusta 1 segundo
antes solo para mostrar/Markdown, sin tocar qué ventas entran al corte.
Jest backend 787/787 (45 suites). Validado contra Docker/MySQL reales y
en navegador real (Claude in Chrome): las 4 pestañas, caption por
segmento, Cortes con datos reales y ciclo completo de eliminar, KPIs
solo en su pestaña, cero errores de consola. Pregunta 4 de la propuesta
(simplificar el lenguaje de las tarjetas de auditoría) quedó sin
resolver — nadie la confirmó, se dejó el texto tal cual. Sin
commit/push todavía.

**"Lectura de reportes" — espaciado suelto en toda la sección (ver
PROJECT_STATE.md punto 171, 2026-09-01, IMPLEMENTADO Y VALIDADO)**:
extiende el fix del punto 169 (tarjetas 230×230px de "Estado del
inventario") a TODO el encabezado, a pedido del usuario. Causa raíz
medida EN VIVO en el navegador (no estimada): `.lectura-reportes-header`
usa `display:flex` con un solo hijo, lo que rompe el colapso de
márgenes normal y deja 40px de hueco donde el resto del panel usa
~22px — fix de una línea (quitar su `margin-bottom` propio). Tarjetas
de "Estado del inventario" con override por id (`#inv-estado-kpi-grid`)
para alto natural en vez del cuadrado heredado de `.reportes-kpi-grid`
— "Todo lo eliminado" queda intacto (230×230px, justificado ahí por la
gráfica). Medido antes→después: 40px→22px, 230px→122px de alto de
tarjeta. 100% CSS, sin tocar HTML/JS. Corrección de proceso durante la
propuesta: el primer borrador del Artifact usó emoji como placeholder
de los íconos — el usuario recordó que el sitio tiene política de cero
emojis (también aplica a mockups), corregido a los SVG reales antes de
aprobar — ver memoria persistente `feedback_sin_emojis_en_mockups.md`.
Jest backend 787/787, validado contra Docker/MySQL reales y en
navegador real, cero errores de consola. Sin commit/push todavía.

**"Lectura de reportes" — letrero pegado al subtítulo (ver
PROJECT_STATE.md punto 172, 2026-09-01)**: reorden a pedido del usuario
(subtítulo→letrero→pestañas→contenido, antes el letrero vivía debajo de
las pestañas partiendo los 2 textos) + guión largo quitado del
subtítulo del encabezado. 100% HTML/CSS, medido en vivo (22px parejo en
las 3 transiciones), 4 pestañas siguen funcionando. Sin commit/push.

**Bug real en "Registrar venta" — desbordaba al agregar el primer
producto (ver PROJECT_STATE.md punto 173, 2026-09-01, reportado por el
usuario con captura, ENCONTRADO Y CORREGIDO)**: `.admin-table`
(`min-width:760px`, pensada para tablas grandes con columnas
arrastrables) se heredaba en la tabla chica de productos del modal —
dentro del grid de 2 columnas del wizard, forzaba su columna a 760px y
aplastaba la vecina a ~175px, desbordando el modal (scrollbar
horizontal, campos ilegibles). Un primer intento de fix
(`min-width:0`) generó un bug DISTINTO (texto envuelto letra por letra,
por `table-layout:fixed` heredado sin sentido en una tabla sin anchos
de columna definidos). Fix real: `table-layout:auto` +
`min-width:320px`, selector de 2 clases para ganarle a `.admin-table`
sin depender del orden del archivo. Validado en navegador real: sin
overflow, columnas parejas, Total correcto. Jest backend 787/787. Sin
commit/push.

**Títulos de página homologados a 24px/700 (ver PROJECT_STATE.md punto
174, 2026-09-01)**: `.admin-toolbar h1` y `.lectura-reportes-titulo`
pasan de 20px/600 a 24px/700, igualando `.inicio-bienvenida h1`
(Inicio/Resumen financiero). Medido en vivo antes de tocar nada — la
premisa literal del usuario no cuadraba (Resumen financiero ya era
igual a Inicio, Ventas era más chico no más grande) pero sí había una
inconsistencia real (2 sistemas de tamaño de título coexistiendo).
Efecto secundario encontrado y corregido: "Cuentas por cobrar" tenía
el título duplicado (uno en cada sistema, antes disimulado por el
tamaño distinto) — se quitó el `<h1>` redundante de la barra de
herramientas. Jest backend 787/787, validado en navegador real, cero
errores de consola. **Commiteado y pusheado** (`c831b36` →
`fact/master`, junto con los puntos 171-173).

**Cantidad entera vs. decimal según la unidad de medida — Ventas (ver
PROJECT_STATE.md punto 175, 2026-09-01)**: columna nueva
`unidades_medida.permite_decimales` (16 unidades clasificadas: conteo
—pieza/caja/paquete/bolsa/par/juego/rollo/tarima— exige entero, medida
continua —kilogramo/gramo/litro/mililitro/metro/cm/m2/m3— admite
decimales). Validación centralizada DENTRO de `registrarMovimiento()`
(un solo choke-point, cubre venta/entrada/ajuste por igual, sin
duplicar la regla por llamador). Error nuevo
`INV_CANTIDAD_DEBE_SER_ENTERA` (400). `/productos/buscar` expone la
unidad del producto — el campo "Cantidad" de Ventas ajusta su
`step`/etiqueta al seleccionar (antes fijo en "piezas" siempre, sin
ninguna validación real, para cualquier producto). 7 tests nuevos (6
unit + 1 integración), Jest backend 794/794. Validado contra
Docker/MySQL reales y en navegador real: producto en Litro con
decimales acepta, producto en Pieza con decimales rechaza (cliente Y
servidor), Pieza con entero acepta, cero errores de consola.
**Commiteado y pusheado** (`3aeb1b8` → `fact/master`).

**Bug real del punto 175 — el campo seguía dejando escribir un decimal
a mano (ver PROJECT_STATE.md punto 176, 2026-09-01, ENCONTRADO Y
CORREGIDO, reportado por el usuario con captura)**: el fix anterior
solo tocaba `step`, que jamás bloquea escribir/pegar un "." a mano (eso
solo lo checa el navegador al hacer submit de un `<form>` real, no
aplica a este modal) — la validación al presionar "+ Agregar producto"
seguía atrapándolo al final, pero el campo dejaba VERSE con el decimal
hasta ese punto. Fix: listener de `input` en vivo que corta cualquier
cosa después de un "." apenas aparece, para productos de unidad de
conteo — mientras se teclea, no hasta el submit. De paso, `min` también
se ajusta junto con `step` (antes fijo en 0.001) y `autocomplete="off"`
explícito. **Gotcha de esta sesión, no del código**: probar con
`.value =` (setter nativo) en vez de teclas reales da resultados sin
sentido — un `<input type="number">` sanea silenciosamente a "" un
valor intermedio inválido ("3.") cuando se asigna así, algo que NO pasa
con tecleo real (hay que probar con el tool `computer`, teclas reales
vía CDP, para una prueba fiel). 100% frontend, Jest backend 794/794
(sin cambios, corrido por sanidad). Validado en navegador real con
tecleo real: "3.001" en un producto Pieza nunca deja aparecer el punto,
"12" entra sin perder dígitos, venta de 12 piezas se agrega correcto
($1,800.00), cero errores de consola. **Commiteado y pusheado**
(`3ebcd09` → `fact/master`).

**Bug real de layout — "Precio unitario"/"Cantidad" desparejos en
Ventas (ver PROJECT_STATE.md punto 177, 2026-09-01, ENCONTRADO Y
CORREGIDO, reportado por el usuario con una captura marcada a mano)**:
sin relación con los puntos 175/176 (esos sí estaban correctos) — un
desajuste de layout preexistente en `.orden-productos-captura-fila`
(grid de 2 columnas): solo "Cantidad" tenía el texto
`#orden-inventario-disponible-hint` ("Disponible: N") debajo de su
input, "Precio unitario" no tenía nada equivalente, así que las 2
columnas no emparejaban en altura. Fix: el hint sale de la fila de 2
columnas, ahora a ancho completo debajo de ambas (semánticamente
correcto — describe al producto, no es exclusivo de "Cantidad"). El
error de validación por campo se queda dentro de su columna a
propósito (condicional, no causaba el desajuste). 100% HTML, Jest
backend 794/794 (sin cambios). Validado en navegador real: diferencia
de altura entre columnas 0px (antes había desnivel real, medido con
`getBoundingClientRect()`), "+ Agregar producto" sigue funcionando,
cero errores de consola. Sin commit/push todavía.

**Correo de contacto de empresa + burbuja "Solicitar aclaraciones" —
IMPLEMENTADO Y VALIDADO contra Docker/MySQL reales y en navegador real
(2026-09-01, ver PROJECT_STATE.md punto 170)**: correo de contacto
(`contacto_email`) pasó de opcional a obligatorio en alta/edición de
empresa en `/control` (`normalizarDatosBase()`, compartida por
`tenantIntake.js`/`tenantEdicion.js`), expuesto en `req.tenant.
contactoEmail`. Burbuja flotante "Solicitar aclaraciones" nueva
(`frontend/aclaraciones.js`, inyectada en dashboard/tickets/csf del
portal de cliente) → modal con RFC de sesión pre-llenado + Nombre +
Teléfono + Detalle → `POST /api/aclaraciones` (backend, `requireUserAuth`)
arma el correo con `construirCorreoBase()` (mismo lenguaje del punto 161)
y lo manda AL CORREO DE CONTACTO DEL TENANT, esperando el envío (`await`,
no fire-and-forget como el resto de correos de la app — aquí no hay fila
de BD de respaldo si falla). Sin persistencia en BD (decisión explícita
del usuario). Folio = timestamp+RFC. `GET /api/tema/:slug` gana el
booleano público `tieneAclaraciones` para que el frontend sepa si pintar
la burbuja. **Bug real corregido en la validación**: el error de envío
fallido usaba 502, que `nginx.conf.template` intercepta globalmente
(`error_page 502 503 504 =503 /mantenimiento.html`) y disfraza de "sitio
caído" — cambiado a 500. Jest backend 804/804, control 119/119. Sin
commit/push todavía.

**"Proveedores" nuevo en el sidebar de `/admin` — solo placeholder "en
construcción" (ver PROJECT_STATE.md punto 181, 2026-09-02, IMPLEMENTADO Y
VALIDADO en navegador real)**: segmento acotado a propósito (protocolo
completo, propuesta visual antes/después aprobada primero) — botón nuevo
tras "Reportes"/antes de "Configuraciones globales" en sidebar+menú
móvil, ícono caja, vista placeholder puro (ícono navy/cyan con pulso +
texto, respeta `prefers-reduced-motion`), cero CRUD/endpoint todavía.
Mismo criterio de visibilidad que Gastos (`administrador`+super, no
`fiscal`). **Bug real de despliegue, no de código, encontrado y
corregido en la validación**: el contenedor `portalManager-frontend` se
reconstruyó a medio camino de esta sesión, sirviendo un `admin.js` con
el botón agregado a `els`/`navPorVista` pero SIN el listener de clic
(agregado en un edit posterior) — el botón se veía y parecía clicable
pero no hacía nada, sin error de consola (mismo patrón de "deploy
parcial" ya documentado, no un bug de lógica). Fix: rebuild `--no-cache`
+ `up -d --force-recreate frontend`. Conecta con el pendiente ya
registrado del punto 180 (proveedores como entidad propia en vez de
texto libre) — ese sigue sin implementar, es la ronda de refinamiento
que falta. Jest backend 807/807, control 119/119. Sin commit/push
todavía.

**Reset completo del entorno local + correo de contacto de clientes en
"Configuración Reportes" + fix de "Perfiles y roles de acceso" (ver
PROJECT_STATE.md punto 186, 2026-09-02, IMPLEMENTADO Y VALIDADO en
navegador real)**: `docker compose down -v` + `up -d --build` a pedido
del usuario, reaprovisionamiento de `pruebaadmin`/`piloto9c` +
`sembrar-demo.js` (margen positivo confirmado los 5 meses). **2 bugs
reales de infraestructura, sin relación con código de la app**: (1)
`control_app` no existe en un volumen nuevo hasta correr el bootstrap de
`asegurarControlYPrivilegios()` a mano; (2) reaprovisionar con
`DB_HOST=127.0.0.1` (necesario desde el host) dejó ese mismo valor
grabado en `control_tenants.tenants.db_host`, que el backend necesita
como `mysql` — corregido con `UPDATE` + restart de `backend` (limpia el
pool de tenant cacheado en memoria). Feature: "Correo de contacto de la
empresa" (`contacto_email`, antes solo editable en `/control`) ahora
también en `/admin` › Configuraciones globales › Configuración
Reportes, subsección aparte "Contacto con clientes" (propio botón de
guardado, no se mezcla con "correo_reportes" — conceptos distintos).
Escribe el MISMO dato que `/control` vía `obtenerPoolControl()`, sin
duplicar; oculto en el sitio base. Modal "Perfiles y roles de acceso"
corregido (le faltaban 6 de 12 columnas) y ampliado a 1180px. Jest
backend 811/811. Commiteado y pusheado.

**Cierre del punto 182 — switch "Solamente servicios" en Inventarios (ver
PROJECT_STATE.md punto 187, 2026-09-02, IMPLEMENTADO Y VALIDADO en
navegador real)**: el backend ya estaba completo desde el punto 182;
faltaba todo el frontend (confirmado por auditoría de código, no por
memoria). Protocolo completo: crítica + propuesta visual antes/después +
4 decisiones de diseño confirmadas por el usuario antes de implementar.
**Hueco real de seguridad cerrado de paso**: el guard de alta solo
bloqueaba CREAR un producto físico — reactivar uno archivado vía
"Editar" (`estado:'activo'`) se saltaba el guard por completo. Segundo
guard agregado, evaluado en alta Y edición, validado real contra
Docker/MySQL (`PUT` reactivando → 400; mismo `PUT` sin reactivar → 200).
Frontend: switch grisado si "Inventario activo" está apagado, mensaje
400 real inline (no toast), 7 tarjetas de producto del dashboard
ocultas dejando 2 de servicio (una nueva: "Servicios sin ventas 90d"),
bloque `servicios` del reporte "Estado del inventario" conectado
(el backend ya lo devolvía sin que nada lo leyera), botón "Importar
catálogo" oculto, modal de alta fijo en "Nuevo servicio" solo al DAR DE
ALTA (editar un producto existente conserva su tipo real). Decisión:
productos archivados siguen visibles en la tabla (el switch solo
restringe alta nueva). Validado de punta a punta en navegador real
contra `pruebaadmin` (bloqueo con 12 productos activos, archivado de
esos 12, activación exitosa, alta de servicio real, dashboard/reportes
correctos, hueco de reactivación confirmado por curl) — datos de
prueba limpiados al final, tenant quedó igual que antes. Jest backend
813/813 (4 tests nuevos). Sin commit/push todavía.

**Pendiente registrado (ver PROJECT_STATE.md punto 137)**: Swagger para
  los servicios API + credenciales de acceso por empresa dadas de alta en
  `/control` — cada tenant accede solo a sus APIs; el SUPER admin con un
  par de credenciales global. Solo anotado: requiere análisis y
  confirmación antes de implementarse.
- **3 pendientes más registrados (ver PROJECT_STATE.md punto 150,
  2026-08-25), solo anotados**: (1) tipo de cambio para productos en
  moneda extranjera en Inventarios, con histórico de cada tipo de cambio
  aplicado desde el alta del producto — detalle completo y preguntas de
  diseño abiertas en `inventarios.md` §57; (2) regla de negocio: una
  venta con Cuenta por Cobrar pendiente no debería poder facturarse
  todavía — hoy no existe esa validación, alcance sin definir; (3)
  asociar tenants como sucursales del mismo negocio con usuarios de
  acceso compartidos — surgió del requerimiento de multi-inventario
  offline (una tienda = un tenant). **Retomado e IMPLEMENTADO el
  2026-08-26, ver bullet de §58 más abajo.**
- **Tipo de cambio para productos en moneda extranjera (§57,
  IMPLEMENTADO 2026-08-26)**: retomado el pendiente de arriba —
  `productos.moneda` (MXN/USD, por producto), tipo de cambio automático
  (Banxico SIE, `BANXICO_TOKEN` en `.env`, degrada a captura manual sin
  bloquear si falta el token o el servicio cae) con opción de
  sobreescribir, histórico dentro de `movimientos_inventario`
  (`moneda_original`/`tipo_cambio`/`costo_original`, nullable) — el
  importador masivo (§34) sigue MXN-only a propósito. `costo_unitario`
  en pesos sigue siendo lo único que alimenta el costeo promedio
  ponderado (D5), sin cambios en esa lógica; solo se calcula distinto
  para un producto USD (`costoOriginal × tipoCambio`, validado ANTES de
  abrir la transacción en `registrarMovimiento()` para no romper el
  contrato "sin tocar la BD" que ya cubrían los tests existentes).
  Jest backend 716/716. **Commiteado y pusheado** (`2245311` →
  `fact/master`) y **validado contra Docker/MySQL reales (2026-08-26)**:
  esquema confirmado, degradación sin `BANXICO_TOKEN` en vivo, flujo USD
  real (462.5 = 25×18.5 exacto), MXN sin regresión, errores 400 reales,
  `verificar-inventario.js` 19/19. Detalle completo en PROJECT_STATE.md
  punto 152. Pendiente real: probar el camino automático con un
  `BANXICO_TOKEN` real cuando exista.
- **Asociar tenants como sucursales (§58, IMPLEMENTADO Y VALIDADO
  2026-08-26)**: retomado el pendiente de arriba — un grupo asocia
  varios tenants del mismo negocio; usuarios compartidos (tabla nueva
  `usuarios_sucursal` en la BD de control, NO en `usuarios` de cada
  tenant) entran a `/admin` de CUALQUIER sucursal del grupo con la misma
  contraseña; cada tenant sigue con su BD/inventario/ventas 100%
  aislados — solo se comparte el login. Verificación **en vivo** vía
  `obtenerPoolControl()` (la conexión que el backend YA mantiene para
  resolver tenants por slug) — se descartó el fan-out de credenciales
  propuesto inicialmente al confirmar que esa conexión ya existía, cero
  llamada HTTP nueva entre servicios. `auth.js` gana un 5º nivel en
  `requireAdminAuth()`; switcher de sucursales en el sidebar de
  `/admin`; vista nueva "Sucursales" en `/control`. Jest backend
  728/728, control 117/117. **Bug real encontrado y corregido validando
  contra Docker/MySQL reales** (imposible de detectar sin MySQL real):
  el diseño original usaba `FOREIGN KEY`/`DELETE` — control entró en
  crash-loop (`ER_TABLEACCESS_DENIED_ERROR`) porque `control_app`
  (credencial angosta, segmento 9b) no tiene privilegio `REFERENCES` ni
  `DELETE`. Rediseñado a soft-delete sin FK (mismo patrón que
  `api_credenciales.revocarCredencialApi()`) en vez de ampliar
  privilegios de una credencial deliberadamente angosta. Validación E2E
  real completa: la MISMA credencial autenticó contra 2 tenants
  distintos (`piloto9c`+`pruebaadmin`) sin mezclar sus datos, switcher
  correcto en ambas direcciones, revocación de acceso instantánea al
  eliminar el grupo. Detalle completo en PROJECT_STATE.md punto 153. Sin
  commit/push todavía.

- **Maduración del requerimiento de Inventarios (`inventarios.md`) — EN
  CURSO, solo análisis/documentación (ver PROJECT_STATE.md punto 136,
  2026-08-23)**: agregada Sección 0 "Alcance v1 y decisiones cerradas"
  (prevalece sobre el resto del doc). Decisiones con el usuario: D1 sin
  variantes en v1; D2 multi-almacén preparado (almacen_id NOT NULL +
  "ALM-1" auto) pero UI con uno; D3 sin ubicaciones; D4 negativos
  prohibidos; D5 costeo promedio ponderado; D6 existencias derivadas del
  libro de movimientos; D7 solo perfiles existentes en v1. **D8
  CERRADA**: Ventas integra vía `producto_id` nullable +
  interruptor GLOBAL `ventas_afectan_inventario` (igual para todos los
  tenants — primera config global de plataforma, candidato BD de
  control); switch activo = autocompletado/código de barras en venta +
  salida automática validando stock; inactivo = Inventarios oculto y
  Ventas como hoy. **D9**: importador masivo CSV/XLSX entra en v1
  (§34 reescrito: wizard 6 pasos, mapeo por sinónimos, campo `extra`
  JSON para columnas no mapeadas, upsert por SKU, existencias iniciales
  → entradas 'inventario inicial', chunks async, MinIO + auditoría).
  §0.5 agregada: concurrencia (FOR UPDATE anti-sobrevende, atomicidad
  movimiento+saldo), DECIMAL(12,3)/(12,2), libro append-only,
  conciliación saldos↔kardex, errores INV_*. §0.6 agregada: config
  GLOBAL de plataforma (`configuracion_global` en BD de control,
  `ventas_afectan_inventario` default '0', switch solo para perfil
  plataforma en Configuraciones globales, caché TTL ≤60 s) — patrón
  base del punto 137.
  **Actualización:** la fase de solo-análisis terminó; implementación en
  curso — ver el bullet de abajo con el estado real por segmento
  (1-5 hechos y validados, 6 en adelante pendiente).
- **Inventarios — IMPLEMENTACIÓN EN CURSO (ver PROJECT_STATE.md puntos
  138-142)**: Segmentos 1-4 (motor de existencias, CRUD+historial de
  movimientos backend, frontend completo, integración D8 con Ventas)
  hechos, validados contra Docker/MySQL/MinIO/navegador reales, **y ya
  commiteados y pusheados a `fact/master`**. **Segmento 5 — motor + API
  del importador masivo CSV/XLSX (`inventarios.md` §34, 2026-08-25,
  detalle completo en PROJECT_STATE.md punto 142)**: hecho y validado
  contra Docker/MySQL/MinIO reales por `curl` (auto-mapeo en 3 niveles,
  perfiles de mapeo completo/parcial, plantilla CSV/XLSX 100% mapeo,
  re-importación sin duplicar stock, guardia `INV_EXTRA_CLAVE_PROHIBIDA`
  — con un bug real corregido ahí mismo: `__proto__` no disparaba la
  guardia porque `normalizarCabecera()` le quitaba los guiones bajos
  antes de compararla —, firma binaria/gate de módulo). Jest backend
  693/693. **Ya commiteado y pusheado** (`65c9eec` → `fact/master`, tras
  confirmación explícita). **Segmento 6 — wizard de 6 pasos en el
  frontend (2026-08-25, PROJECT_STATE.md punto 143)**: hecho y validado
  en navegador real de punta a punta (Claude in Chrome) — subir CSV con
  sinónimos → auto-mapeo con badges → validación → confirmación →
  ejecución → resultado, con datos reales. 2 bugs reales encontrados y
  corregidos en la validación: botón "Siguiente" no cambiaba de texto al
  avanzar de paso (bug de frontend, `finally` pisaba el label nuevo), y
  el upsert por SKU del Segmento 5 no revivía productos en papelera
  (`eliminado_en` nunca se limpiaba al actualizar — bug del motor, no
  del frontend, solo visible probando el flujo completo con datos
  reales). Jest backend 693/693. Con esto §34 completo (motor+API+wizard)
  queda funcionalmente terminado. **Ya commiteado y pusheado** (`d813206`
  → `fact/master`, tras confirmación explícita).
- **Inventarios — Segmento 8: Ayuda y diccionario de datos (2026-08-25,
  §56, PROJECT_STATE.md punto 144)**: hecho y validado en navegador real.
  Implementado como MODAL (no página/ruta propia — confirmado con el
  usuario antes de codificar: este panel es un SPA de un solo HTML sin
  ruteo real), abrible desde el sidebar de Inventarios y desde un ícono
  "?" por campo dentro del wizard de importación (paso 3) SIN cerrar el
  wizard — validado en vivo: el ícono "?" de "SKU" abrió la ayuda encima
  del wizard en curso, y al cerrarla el wizard seguía intacto en el mismo
  paso con el archivo ya subido. `backend/utils/inventarioCampos.js`
  ganó `explicacion_simple`/`ejemplo_valido`/`ejemplo_invalido_comun` en
  los 20 campos + `CONCEPTOS_AYUDA` (10 entradas: existencia, historial
  de movimientos, entrada/salida/ajuste, costo promedio, y mecánica de
  importación) + `GET /api/admin/inventarios/diccionario`. Jest backend
  702/702 (41 suites). Con esto el plan completo de `inventarios.md`
  (segmentos 1-8) queda funcionalmente terminado — pendiente real, no
  bloqueante: tooltips de ayuda en "Crear producto" (3ra entrada de
  §56.2, deliberadamente pospuesta, confirmado con el usuario).
- **Tooltips de "Resumen financiero" pasados al componente estilizado
  (2026-08-25, PROJECT_STATE.md punto 145)**: a pedido del usuario, 3
  puntos que usaban el tooltip nativo del navegador (2 puntos de gráfica
  de línea + nombre de proveedor truncado) pasaron a `data-tooltip` (el
  mismo componente ya usado en Tickets/Constancias). Validado
  visualmente en navegador real. Cero cambios de backend.
- **Camino asíncrono >500 filas del importador, validado en vivo
  (2026-08-25, PROJECT_STATE.md punto 146)**: CSV real de 520 filas
  contra Docker/MySQL/MinIO reales — `POST .../ejecutar` respondió 202
  de inmediato, completó en <2s, 520 productos + 494 movimientos con
  conteos matemáticamente exactos verificados por SQL. Sin bugs
  encontrados.
- **Entrada 3 de §56.2 — tooltips en "Crear producto" (2026-08-25,
  PROJECT_STATE.md punto 147)**: cierra el último pendiente del plan de
  `inventarios.md`. Los 14 campos del formulario ganan el mismo ícono
  "?" ya construido para el wizard de importación (clase renombrada de
  `.inv-import-mapeo-ayuda` a `.inv-campo-ayuda`, ahora genérica) —
  hover muestra la explicación corta, click abre la ayuda completa
  encima del formulario sin cerrarlo. `aplicarTooltipsCampoAyuda(raiz)`
  nueva, reutilizada también por el wizard (que de regalo ganó el mismo
  hover corto). Sin cambios de backend. Validado en navegador real: 14
  íconos con tooltip poblado, click en SKU abrió la ayuda sin perder el
  formulario. Jest backend 702/702. **Con esto, el plan completo de
  `inventarios.md` (segmentos 1-8, las 3 entradas de §56.2 incluidas)
  queda 100% implementado y validado.**
- **Unificación de TODOS los tooltips del sitio (2026-08-25,
  PROJECT_STATE.md punto 148)**: a pedido explícito del usuario ("que
  todo el sitio tenga el mismo tooltip, que no se vea sencillo"),
  auditoría completa de `frontend/` + `control/` (sin `node_modules`).
  9 spots más con `title` nativo corregidos (barras de "Ventas vs
  Facturado vs Gastos", segmentos de "Utilidad neta del mes", barra de
  "Eliminados por mes", celda de vista previa del wizard, botones
  "Verificar integridad"/"Ayuda") + un bug sutil en los 15 íconos "?" ya
  construidos (llevaban `title` Y `data-tooltip` a la vez — se quitó el
  `title` duplicado). **Segundo componente de tooltip totalmente
  distinto encontrado y consolidado**: `.tooltip-trigger`/
  `.tooltip-popover` (CSS puro, con toggle táctil a mano en JS), usado
  en un solo lugar (ícono de "Correo de quien va a facturar" en SMTP) —
  migrado al mismo `data-tooltip`, clase renombrada de
  `.inv-campo-ayuda` a `.campo-ayuda` (genérica) y movida a `style.css`
  (compartida). El único `title` que se dejó intacto a propósito: el
  `<iframe>` de vista previa (accesibilidad, no es un tooltip visual).
  Validado en navegador real: el ícono de SMTP ya muestra el mismo
  globo oscuro que el resto del sitio (antes era un popover blanco
  distinto). Jest backend 702/702 (sin cambios). **Con esto, todo
  tooltip visible del sitio usa exactamente el mismo componente
  estilizado, sin excepción.** **Commiteado y pusheado** (`f88a429` →
  `fact/master`).
- **3 rediseños de UI en Usuarios/Configuraciones globales (2026-08-25,
  PROJECT_STATE.md punto 149)**: (1) "Habilitar Ventas" e "Inventario
  activo" se mueven de "Usuarios" a "Configuraciones globales" (mismos
  ids, cero cambio de API — Fiscal sigue sin verlas, Administrador las
  gana agregando los 2 ids a su `tarjetasConfigPermitidas` en
  `admin.js`); "Configuraciones globales" pasa de 4 a 6 tarjetas, 3
  filas parejas. (2) "Perfiles y roles de acceso" pasa de tarjeta
  acordeón de ancho completo a un ícono junto a "9 usuarios" que abre la
  misma tabla en una ventana emergente (instrucción directa con captura
  anotada del usuario). (3) Modal "Crear usuario" rediseñado en 2
  columnas igual que "Gestionar ticket" (`.ticket-modal`, 820px en vez
  de 380px de una sola columna). Validado en navegador real los 3, Jest
  702/702, cero cambios de backend. **SIN COMMITEAR** — pedir
  confirmación explícita antes de commit/push, mismo protocolo
  `addv-web-app`.

- **Rediseño del ticket de correo de Ventas con la marca CLARVO (ver
  PROJECT_STATE.md punto 133, 2026-08-23, IMPLEMENTADO Y VALIDADO)**:
  usuario pidió recolorear `construirCorreoOrdenCompra`
  (`backend/server.js`) con colores de marca + logo real — propuesta
  visual (Artifact con antes/después renderizado) aprobada primero,
  regla persistente del usuario. Logo: sin logo de tenant configurado
  y marca por defecto → logo real de CLARVO (`/assets/branding.png`,
  mismo archivo del login) en vez de caja de texto verde; un tenant
  con su propio nombre sigue viendo SU texto, nunca el logo de CLARVO.
  Paleta: verde `#0F6E5D`/beige `#F0EFEA` → navy `#03285B` + cian
  `#05DBF2`, los MISMOS tokens ya usados en login/panel (no valores
  nuevos); franja degradada navy→azul→cian arriba de la tarjeta (mismo
  degradado del isotipo real de CLARVO); fondo suave navy detrás del
  TOTAL. Pie de página dice "CLARVO by ADDV" cuando la marca es la de
  por defecto (`MARCA_DEFECTO` en sí no cambió). Sin cambios de
  estructura HTML ni de texto plano. Jest backend 567/567. Validado
  con la salida REAL de la función (extraída a un script aislado,
  renderizada, publicada como Artifact para inspección visual — logo
  roto solo en el Artifact por no alcanzar `localhost` desde ese
  sandbox, confirmado con `curl` que la ruta real sí responde 200) y
  con un **envío SMTP real** (este entorno ya tiene SMTP configurado
  de verdad — venta de prueba registrada, correo enviado sin errores
  en los logs). **CORRECCIÓN el mismo día**: el logo SÍ llegó roto en
  el correo real (usuario reportó "sale rota la imagen") — la
  suposición de que la URL absoluta cargaría en producción era
  correcta en teoría pero irrelevante en la práctica: TODAS las
  pruebas de esta sesión pegaron con `Host: localhost:8088`
  (`detectarUrlPortal()` arma la URL del logo desde ese header), y
  "localhost" no lo puede resolver nadie fuera de esta máquina — ni
  Gmail ni el destinatario. Mismo punto ciego que ya tenía el logo de
  un TENANT (mecanismo de URL absoluta compartido), nunca antes
  probado contra un correo real. **Fix, con el usuario eligiendo
  explícitamente "incrustado" sobre "solo URL"**: el logo de CLARVO
  por defecto ahora viaja DENTRO del correo como adjunto CID
  (`logoTicketHtml()` regresa `{html, adjunto}`,
  `construirCorreoOrdenCompra()` regresa `adjuntos: []`,
  `enviarCorreoOrdenCompra()` los pasa a `enviarCorreo()` — que ya
  soportaba adjuntos, sin cambios ahí). Copia nueva del PNG en
  `backend/assets/branding.png` (el backend no comparte filesystem con
  el contenedor frontend), cacheada en memoria, con fallback al texto
  si no se puede leer. El logo de un TENANT no se tocó. Verificado
  dentro del contenedor real: PNG copiado correctamente (433174 bytes,
  firma válida), MIME real renderizado con
  `nodemailer.createTransport({streamTransport:true})` confirma
  `Content-ID`/`Content-Type: image/png` correctos. **Confirmado por
  el usuario contra un correo real** ("ya llegó bien"). Sin
  commit/push todavía.
- **"Lectura de reportes" rediseñada para auditorías (ver
   PROJECT_STATE.md punto 122, 2026-08-21, IMPLEMENTADO Y VALIDADO)**:
   `reporte_items.accion` ya distinguía "eliminado" (borrado real) de
   `NULL` (fotografía activa) pero se mostraba mezclado — ahora 2 tablas
   separadas ("Movimientos"/"Eliminados", acento rojo), export CSV/Excel
   independiente por tabla (`accion=activo|eliminado` en
   `/exportar`/`/items`), cabecera "Detalle" con badges de color
   reutilizados de Tickets/Ventas, KPIs de auditoría arriba (histórico +
   tendencia mensual, endpoint nuevo `GET /api/admin/reportes/estadisticas`),
   y refuerzo frontend de que "Eliminar reporte" es solo admin/super
   (backend ya lo exigía). Sin cambios de esquema. Jest 560/560, validado
   en navegador real con datos reales de la siembra. **Ajuste de diseño
   en vivo** tras revisar la captura: las 3 tarjetas KPI son cuadradas
   fijas de 230×230px (no estiradas), centradas, con texto+número +40%
   en las 2 numéricas — mismo gotcha de especificidad CSS que el punto
   121 (`.resumen-fin-chart-body` ya fija `min-height:220px`; hubo que
   usar id, no clase, para ganar). Título de las 3 tarjetas fijo arriba
   a la izquierda, resto (número/nota/barra) centrado en el espacio
   sobrante vía `margin-top/bottom:auto`. Commit `f7b26d4`, push a
   `fact`. **Regla nueva del usuario, guardada en memoria persistente**:
   todo cambio de diseño visual (nuevo o ajuste) siempre lleva propuesta
   antes/después en markdown antes de implementar, sin que se pida cada
   vez. Después del push: "Configuraciones globales" movido al final del
   sidebar (ancla fija, comentario en el HTML para vistas nuevas), y
   número centrado (no todo el contenido) en los KPIs de "Inicio" y
   "Resumen financiero", mismo criterio que Reportes. Commit `fa0906e`,
   push a `fact`. **B+C+D del punto 122 implementadas y validadas**: B —
   pestaña "Todo lo eliminado" (ledger cruzado de todos los reportes,
   endpoints `/reportes/eliminados` y `/reportes/eliminados-exportar`,
   columna "Reporte de origen"); C — "Generado por" en el resumen del
   reporte, cruzando `admin_auditoria` (segmento 7) por ruta+ventana de
   5s (`/reportes/:id/generado-por`), mejor esfuerzo, nunca bloquea; D —
   botón "Ver historial" por identificador, modal con su timeline en
   todos los reportes (`/reportes/timeline/:tipo/:identificador`). 2 bugs
   reales encontrados y corregidos en el camino: `map(renderFilaReporteItem)`
   pasaba el índice del array como segundo argumento (columna de más en
   Movimientos), y el timeline desbordaba con descripciones largas
   (faltaba `flex:1;min-width:0`). Sin cambios de esquema. Jest 560/560.
   Sin commit/push todavía este segmento (B+C+D).
- **Cuentas por cobrar (ver PROJECT_STATE.md puntos 138 y 141, 2026-08-24, IMPLEMENTADO Y VALIDADO)**: venta por defecto `pagada` + opción `pendiente` con vencimiento/notas, nueva vista "Cuentas por cobrar" entre Ventas y Gastos (4 KPIs: Por cobrar/Vencidas/Por vencer/Cobrado mes, con icono SVG 18×18 tintado igual que Resumen financiero: $/x-circle/clock/check-circle). Toggle Pagada/Pendiente en modal Registrar venta (solo texto), tabla con badges solo texto `Pendiente`/`Vencida`/`Pagada` (sin emojis), factura junto a `OC-000001` como SVG de documento (no ✅). Modelo `ordenes_compra.estado_pago ENUM('pagada','pendiente')` + `fecha_vencimiento/monto_cobrado/fecha_cobro/notas_cobro`, backfill histórico corregido (207/212), endpoint `PUT /:id/cobro`, filtros client-side. **Pulido 2026-08-24 (punto 141)**: retirados todos los emojis de KPIs/badges/toggle y reemplazados por SVG — verificado `node --check` + Jest 595/595 + rebuild frontend `GET /admin` 200 sin emojis.
- **Regla: no facturar con saldo pendiente por cobrar (ver PROJECT_STATE.md
  punto 154, 2026-08-27, IMPLEMENTADO, Jest 730/730, sin validar contra
  Docker real todavía)**: `POST /api/tickets` rechaza (código
  `PAGO_PENDIENTE`) la solicitud de factura de un cliente si la orden
  ligada tiene `ordenes_compra.estado_pago = 'pendiente'`. Bloqueo
  deliberadamente solo ahí (no en `POST /api/admin/tickets/:id/factura`)
  porque `estado_pago` solo avanza `pendiente -> pagada`, nunca al revés
  (`PUT /:id/cobro`) — un ticket que llegó a crearse no puede quedar
  ligado después a una venta que "regresa" a pendiente. **Ojo con el
  nombre**: `tickets.estatus = 'pendiente'` (estado de la SOLICITUD, sin
  relación con dinero) y `ordenes_compra.estado_pago = 'pendiente'`
  (falta COBRAR esa venta) son columnas distintas que comparten texto
  literal — esta regla usa solo la segunda, no confundir con la primera
  en trabajo futuro.
- **Datos de demo (wipe + reseed) + "Estado del inventario" en Reportes
  (ver PROJECT_STATE.md punto 155, 2026-08-27, IMPLEMENTADO Y VALIDADO
  contra Docker/MySQL reales y en navegador real)**: `backend/scripts/
  sembrar-demo.js` (nuevo, reemplaza y borra a `sembrar-datos-prueba.js`/
  `poblar-tony.js`) borra+resiembra TODO lo transaccional de
  `portal_facturacion` (config/usuarios intactos), requiere
  `--confirmar`, determinista. Endpoint nuevo `GET
  /api/admin/inventarios/reportes/estado` (gate `requireInventarioActivo`)
  + 3ra pestaña "Estado del inventario" en Reportes (4 gráficas: más
  vendido/menos movido, rotación con línea de promedio, valor por
  categoría, cobertura). Jest backend **739/739**. **2 hallazgos para no
  repetir**: (1) este panel **NO tiene modo oscuro** — cero
  `data-theme`/`prefers-color-scheme` en `frontend/*.css`, no confundir
  con el tema-por-tenant (otro sistema, congelado); (2) si los clics del
  tool `computer` de Claude in Chrome no disparan nada en este panel
  (login atorado en "Entrando…", sidebar sin reaccionar), es un problema
  de la herramienta de automatización, no de `admin.js` — probar
  `document.getElementById(id).click()` vía `javascript_tool` como
  rodeo, ya confirmado que sí dispara los listeners reales sin errores.
- **Recuperar contraseña — cliente y admin/fiscal (ver PROJECT_STATE.md
  punto 157, 2026-08-27, IMPLEMENTADO, Jest 747/747, ciclo completo
  validado contra MySQL real — SMTP real sin probar, sin salida a
  internet en esta sesión)**: `POST /api/auth/recuperar` +
  `POST /api/auth/restablecer` en `backend/server.js`, token de un solo
  uso (sha256, 30 min) en 2 columnas nuevas de `usuarios`. **Alcance real,
  no "para todos" pese al pedido original** — solo cliente +
  administrador/fiscal (tabla `usuarios`) son recuperables; la cuenta de
  respaldo `admin`, `ADMIN_USERS`, `/control` y los usuarios de sucursal
  compartidos NO tienen forma de recuperación por correo (sin BD/sin
  correo propio, ver el punto 157 completo para el detalle exacto). Página
  nueva `frontend/restablecer.html`/`.js` — agregado a los 5 arreglos
  `RUTAS_PAGINA_MULTITENANT` duplicados y a `nginx.conf.template` (mismo
  patrón de `dashboard|tickets|login|csf`). **Bug corregido de paso,
  aprobado por el usuario**: `detectarUrlPortal()` no incluía el slug del
  tenant — afectaba también al correo de invitación existente
  (`enviarInvitacionPortal`), no solo a esta función nueva. **Cuenta de
  prueba con password real cambiada durante la validación**: `FREDY`
  (`aprado13@gmail.com`, perfil fiscal) quedó con password `NuevaClave9`.
- **Auditoría de consistencia de documentación (ver PROJECT_STATE.md
  punto 120, 2026-08-21)**: a pedido explícito del usuario ("revisa la
  documentación"), revisión de salud de los 3 entregables obligatorios
  del protocolo, sin implementar corrección todavía (solo diagnóstico).
  Hallazgos: título/línea 1 del README sigue sin mencionar multi-tenant
  aunque el contenido interno sí lo cubre; README no documenta 3
  features ya hechas (tarjeta "Utilidad neta del mes" punto 118,
  gráficas BI punto 117, "Look & Feel" punto 105); `FRONTEND_PORT`
  documentado con 3 valores distintos entre README/`.env` real (`80`
  en la tabla, `8080` en ejemplos, `8088` real desde el punto 109); la
  sección "Pendiente antes de producción" de `PROJECT_STATE.md` (líneas
  6877-6944) contradice puntos posteriores del mismo archivo (dice
  "marca no implementada" cuando el punto 103 ya la hizo, dice "falta
  probar /control en navegador" cuando el punto 100 ya lo hizo).
  Confirmado vigente y sin resolver en ese momento: `nodemailer`
  vulnerable (punto 116, resuelto después en el punto 197), Swarm
  multi-nodo real nunca probado (95/97), `/control` en dos
  servidores físicos nunca probado (99), red Docker sin segmentar
  (116). Ningún comando/script de este archivo está roto — todos
  verificados. No avanzar con la corrección sin aprobación explícita
  del usuario, mismo protocolo `addv-web-app`.
- **Vista "Resumen financiero" (ver PROJECT_STATE.md punto 114)**: a
  partir del mockup `stitch/stitch_portal_financiero`, vista nueva y
  propia (no dentro de "Inicio", que es del perfil `fiscal`) para el
  perfil `administrador` (+ super) — 4 KPIs del mes (Total facturado,
  Total gastos, "Balance ventas vs gastos" y "Ventas sin facturar",
  renombrados desde "IVA Neto"/"Tickets Pendientes" del mockup por no
  tener respaldo fiscal/de datos real) + gráfica en barras CSS que
  arranca en el mes actual hacia adelante y omite meses sin actividad.
  Endpoint `GET /api/admin/resumen-financiero`
  (`requireAdminArea('administrador')`). Jest 551/551, validado contra
  Docker/MySQL reales y en navegador real (Claude in Chrome). **Bug
  preexistente encontrado y corregido de paso** (no causado por este
  segmento): perfil `fiscal` veía el botón "Ventas" porque
  `aplicarVisibilidadOrdenesCompra()` (toggle "Habilitar Ventas") pisaba
  `hidden` sin considerar el perfil — ahora `ventasHabilitadaGlobalmente`
  se combina dentro de `aplicarRestriccionesPerfil()`, única fuente de
  verdad.
- **Diagnóstico post-opencode (ver PROJECT_STATE.md punto 113)**: otra
  herramienta de IA (opencode) trabajó este mismo repo y agregó 6 commits
  (módulo "Gastos", fix de `verificar-mysql.js`, renombrado "Orden de
  compra"→"Ventas") ya en `fact/master`. Auditados: `node --check` limpio,
  backend Jest 546/546. Único hallazgo real: `control/`
  `ensureSchema.test.js` desactualizado (le faltaba la columna
  `tema_json` del segmento 105) — no es bug de opencode, corregido en
  esta sesión, `control/` Jest vuelve a 88/88.
- **Rediseño de login (cliente y admin), ver PROJECT_STATE.md punto
  106**: split-screen fiel a un mock aportado por el usuario (carpeta
  `stitch/` en la raíz, no borrar). Paleta propia contenida en
  `.auth-shell` (`frontend/auth.css`, variables CSS locales, no toca el
  verde base de `style.css`). Marca por defecto "CLARVO" como imagen
  estática (`frontend/assets/branding.png` + `login-decoracion-marca.png`,
  aportadas por el usuario) — pierde el reemplazo dinámico de marca de
  `theme.js` solo en esta franja. Bug real corregido en `style.css`:
  faltaban `password`/`tel`/`url`/`number`/`date` en el selector base de
  `.field input`. `frontend/Dockerfile` corregido: le faltaba copiar
  `theme.js` (bug preexistente del segmento 105) y la carpeta `assets/`.
  Sin probar contra Docker real ni Playwright en esta sesión.
- **Primera corrida real contra Docker (punto 97 de PROJECT_STATE.md,
  IMPORTANTE leer antes de tocar `nginx.conf`/`Dockerfile`/`*.cnf`
  otra vez)**: encontró y corrigió 4 bugs que ningún `node --check` podía
  detectar — regex de tenant en `nginx.conf` sin comillas (rompía el
  arranque de nginx desde el segmento 4), `control.html`/`control.js`
  faltaban en `frontend/Dockerfile`, `read_only`/`super_read_only`
  estáticos en `replica.cnf` bloqueaban el bootstrap del contenedor
  réplica (movido a `SET PERSIST` en tiempo de ejecución), y el
  `HEALTHCHECK` del frontend usaba `localhost` (resolvía a IPv6 donde
  nginx no escuchaba) en vez de `127.0.0.1`. Ciclo de vida completo de
  `/control` y replicación GTID real validados end-to-end contra
  contenedores reales. Sigue sin probar: Docker Swarm multi-nodo real.
- **Todavía no hay ningún tenant real dado de alta** — nada de esto
  recibe tráfico real hoy.
- **Remotes git (ver PROJECT_STATE.md punto 107)**: `origin` apunta a
  `portal-multi.git` y `fact` a `addv-prototipos/ADDVportalFact.git` (actualizado 2026-09-01, antes `antonioprado-sketch/ADDVportalFact.git` — el repo donde se
  publica el trabajo real). Publicar = `git push fact main:master` (la
  rama local es `main`; el master remoto fue reemplazado por force push
  el 2026-08-18, los 53 commits previos quedaron huérfanos, la rama
  `prototipo` del remote sigue intacta). No asumir `origin` como destino
  de publicación sin verificar antes.
- **Rediseño de `/admin` y del portal de cliente fiel a `stitch/`, ver
  PROJECT_STATE.md punto 108**: sidebar navy en el admin (mockup
  `panel_admin_...`), modal "Gestionar" de tickets en 2 columnas (mockup
  `detalle_de_solicitud`), vista "Inicio" nueva con estatísticas/dona
  reales de tickets (mockup `dashboard_portal_addv_...`, ahora primera en
  el sidebar, con "Tickets" en segunda posición), y la misma paleta navy
  + logo claro (`frontend/assets/branding_bgo.png`) en la barra superior
  del portal de cliente. Validado en vivo contra Docker/MySQL/MinIO
  reales y con la extensión Claude in Chrome — no solo `node --check`.
  Dos tenants de prueba viven en el volumen de MySQL de quien haya
  corrido esta sesión (`pruebaadmin`, `piloto9c`) para esa validación —
  no son tenants reales, se pueden dar de baja o ignorar. **Gotcha de
  Docker/navegador para la próxima sesión**: un `docker compose build
  <servicio>` normal a veces no recoge cambios de archivo (usar
  `--no-cache` + `up -d --force-recreate` si un rebuild no se refleja al
  probar) y el navegador cachea HTML/CSS en disco tras el rebuild (forzar
  `Ctrl+Shift+R`). Sigue vigente: **todavía no hay ningún tenant real de
  producción dado de alta** — nada de esto recibe tráfico real hoy.
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

- **Cierre mensual archivado Ventas+Gastos + retención solo-Tickets (ver
  PROJECT_STATE.md punto 158) — IMPLEMENTADO, VALIDADO CONTRA
  DOCKER/MySQL REAL, 4 bugs corregidos en total, Jest 764/764**:
  retención
  `tickets_retencion_dias` queda solo tickets; Ventas/Gastos se archivan
  (no se borran) al día 1 hacia Reportes (`tipo='cierre_mensual'`,
  `accion='archivado'`), con `archivado_en`+`periodo_archivado` en ambas
  tablas. Listados filtran por defecto `archivado_en IS NULL`; Resumen
  financiero incluye archivados (Opción A). Dual: base ADDV sin slug +
  cada tenant activo (`ejecutarCierresMensualesParaTodos()`,
  `backend/utils/cierreMensual.js`). Implementado por una sesión paralela
  sin confirmación explícita de las 2 decisiones abiertas del plan
  (bugs 158 mismo patrón que el incidente del punto 140) — auditado y
  corregido después: el gate de "es día 1" ahora respeta la
  `zona_horaria` real de CADA DB (`esDia1EnZona()`/`fechaLocal()`, antes
  hardcodeado a America/Mexico_City vía ventana UTC fija), "Lectura de
  reportes" ahora reconoce `tipo_registro='gasto'` (antes se mostraba
  como "Ventas", faltaba en los 2 selects de filtro), y se agregó
  `test/unit/cierreMensual.test.js` (antes cero cobertura del módulo).
  Validado contra Docker/MySQL real (2026-08-29): encontró 2 bugs más,
  ambos solo visibles con infraestructura real — `ejecutarComoTenant()`
  recibía el slug crudo en vez del pool real del tenant (`pool.query is
  not a function`, cierre mensual de CUALQUIER tenant estaba roto de
  raíz, fix vía `obtenerPoolTenant()`), y el filtro "Gastos" de Reportes
  no filtraba nada (whitelist de `tipo_registro` en 4 endpoints sin
  `'gasto'`). Cierre real de julio 2026 probado end-to-end (29
  ventas + 11 gastos archivados, correo real, resumen financiero
  intacto).

Las tres superficies de la app: portal de cliente (sin prefijo o
`/<slug>/...`), panel admin por tenant (`/admin` o `/<slug>/admin`), y
app de control cross-tenant super-only (`/control`, segmento 9). El plan
de migración a multi-tenant de 9 segmentos está completo — cualquier
trabajo nuevo sobre esta arquitectura es evolución posterior, no un
segmento pendiente del plan original; sigue el mismo protocolo
`addv-web-app` de analizar-proponer-confirmar-implementar de todas
formas.

## Limitaciones conocidas de entornos de generación sin Docker/MySQL real

Ver la sección "Limitaciones de ESTE entorno de generación" en
`PROJECT_STATE.md` — en general: sin acceso a un MySQL/Docker corriendo,
la validación se limita a `node --check`, pruebas unitarias con mocks, y
trazado manual de queries. Cualquier cambio de esquema/queries debe
confirmarse corriendo `backend/scripts/verificar-mysql.js` contra MySQL
real antes de producción.
