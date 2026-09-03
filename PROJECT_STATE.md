# Estado del proyecto — Portal de Facturación

> Este documento existe para que cualquier instancia de Claude (o cualquier
> desarrollador humano) pueda retomar este proyecto sin depender del
> historial completo de la conversación. Si estás leyendo esto al inicio de
> una sesión nueva: este archivo + el código fuente son la fuente de verdad,
> no el resumen de un chat. Actualízalo cuando hagas cambios importantes.

## Regla persistente de coordinación entre agentes

Después de cualquier cambio relevante de código, arquitectura, operación,
pruebas, decisiones de producto o estado del proyecto, actualizar siempre
`PROJECT_STATE.md` y `CLAUDE.md` antes de cerrar el trabajo. Si la sesión
tiene acceso de escritura a Claude Mem, registrar también ahí la
decisión/estado para que futuras sesiones de Claude y Codex puedan
coordinarse sin depender del historial del chat. Si solo hay acceso de lectura
a Claude Mem, dejar constancia explícita en estos archivos. Esta regla se
ejecuta junto con el protocolo `addv-web-app`: analizar primero, proponer un
segmento acotado, esperar confirmación explícita del usuario e implementar
solo el segmento aprobado, manteniendo el piso obligatorio de UX/accesibilidad/
rendimiento/seguridad/Docker/pruebas/calidad.

## Convención persistente de tipografía (2026-08-24)

Toda la app usa **una sola familia tipográfica — Inter**, la misma del menú
lateral del panel admin (`.admin-sidebar-nav .admin-vista-btn`). `frontend/
style.css` define `--font-body` y `--font-display` ambas como `Inter`
(`--font-display` es alias de `--font-body`); `frontend/mantenimiento.html`
replica el mismo par. No se mezcla serif/sans ni se introducen otras familias
en ningún CSS/HTML nuevo — aplica a **control** (`/control`) y **lado del
cliente** (portal, login, csf, tickets, dashboard) por igual. El sistema de
temas por tenant (`backend/utils/tenantTema.js`, `control/utils/tenantTema.js`,
catálogo de 8 fuentes) queda congelado en esta default; si se reactiva, debe
respetar esta regla. Documentado también en `CLAUDE.md`, `AGENTS.md` y
`cmem.md`.

## Convención persistente de hover (2026-08-24)

El `hover` de **Resumen financiero** era muy simple frente a **Tickets/
Constancias** (`frontend/admin.css:1617` `tbody tr:hover { background:
var(--color-accent-soft) }`). Se homologó en **todo el sitio y apps**
(admin, control, portal cliente, reportes) al mismo lenguaje:
`background: var(--color-accent-soft)` + `border-color: var(--color-accent)` +
`transition 0.15s ease` (ver `frontend/admin.css` bloque "Hover unificado" y
`frontend/portal.css` `.tile:hover`). Aplica a tarjetas de Inicio, Resumen
financiero (KPIs, gráficas, donas), Reportes (KPIs, subtablas), Configuraciones
y Gastos, más tiles del portal del cliente. Respeta `prefers-reduced-motion`.
Todo cambio futuro de hover debe respetar este lenguaje.

## Qué es esto

App web para que clientes suban su Constancia de Situación Fiscal (PDF) y
generen solicitudes de factura a partir de tickets de venta (foto). Tiene
cuentas de usuario (login por RFC + contraseña), un panel de administración
separado (Basic Auth), y todo corre en Docker (Nginx + Node/Express + MySQL).

## Cómo llegamos aquí (orden cronológico de decisiones grandes)

1. **Base**: formulario público de carga de constancia + panel admin, sobre
   SQLite (`better-sqlite3`).
2. Se agregó extracción automática de datos del PDF (nombre/razón social,
   régimen fiscal, código postal) — con varias iteraciones porque el texto
   extraído del PDF real del SAT no sigue el orden visual (el valor del
   nombre queda *antes* de su propia etiqueta, con ruido tipo "IdCIF" de por
   medio). Ver `backend/utils/pdfExtract.js` para la lógica final, que:
   - Busca el valor en la ventana entre "Registro Federal de
     Contribuyentes" y "Nombre, Denominación o Razón Social".
   - Descarta ruido conocido (IdCIF, leyendas de "valida tu información
     fiscal", líneas de puros dígitos).
   - Une líneas consecutivas para nombres/razones sociales largas que se
     parten en varios renglones.
   - **Si algo similar vuelve a fallar**, pide al usuario el fragmento de
     texto exacto de esa zona del PDF — así se ajustó todo lo anterior, no
     hay forma de adivinarlo sin un ejemplo real.
3. **Migración completa SQLite → MySQL** (`mysql2/promise`, pool de
   conexiones). Motivo: robustez/concurrencia para producción. Esto reescribió
   `db.js` y prácticamente todo `server.js` a async/await. El contrato de la
   API (rutas y forma de las respuestas) se mantuvo idéntico a propósito, así
   que el frontend existente no necesitó cambios en ese momento.
4. **Sistema de cuentas de usuario** (login por RFC + contraseña, separado
   del admin): páginas nuevas `login.html`, `dashboard.html`, `tickets.html`,
   con lógica compartida en `portal.js`. Se agregaron las tablas `usuarios` y
   `tickets`.
5. **Corrección de bug de login en celular**: la cookie de sesión tenía
   `secure: true` atado a `NODE_ENV=production`, y `docker-compose.yml`
   siempre pone esa variable en producción sin importar si hay HTTPS real.
   Sobre HTTP plano (típico en celular por LAN), el navegador rechazaba
   guardar la cookie. Ahora `secure` depende de `COOKIE_SECURE` (variable de
   entorno explícita, default `false`).
6. **Gestión de contraseñas desde el admin**: generar contraseña automática
   + copiar al portapapeles + checkbox "forzar cambio en el siguiente login"
   → flujo de cambio de contraseña obligatorio dentro de `login.html` que se
   activa solo, se puede evitar navegando directo a `dashboard.html` (
   `portal.js` también lo verifica), y se apaga solo al completarse.
7. **Envío de correo (SMTP)**: nuevo módulo `backend/utils/email.js`
   (`nodemailer`), configurable desde el admin (nueva tarjeta plegable
   "Correo electrónico (SMTP)", pensada para Gmail con STARTTLS/587 por
   defecto). La contraseña SMTP se guarda en la tabla `configuracion`
   (reutilizando el mismo patrón clave-valor que `campos_obligatorios` y
   `uso_cfdi_catalogo` — sin tabla nueva) y **nunca se devuelve al
   frontend** una vez guardada. Incluye una sección de "enviar correo de
   prueba" con destinatario/asunto/cuerpo. *Importante: `enviarCorreo()` en
   sí nunca se ha ejecutado contra un servidor SMTP real desde este
   entorno — solo se probó la lógica de guardar/leer/enmascarar la
   configuración. Antes de confiar en esto, usa el botón "Enviar prueba"
   del panel con credenciales reales.*
8. **Retención (borrado automático) de tickets**: nuevo módulo
   `backend/utils/ticketsCleanup.js` — un `setInterval` dentro del propio
   proceso de Node (una vez al arrancar, luego cada hora) borra tickets
   (imagen + factura + fila) más viejos que los días configurados por el
   admin (`configuracion` clave `tickets_retencion_dias`, con `0`/vacío =
   desactivado). El cliente ve un aviso del retiro programado en
   `dashboard.html`/`tickets.html` (leído de un endpoint público). El
   nombre del proyecto en el README se actualizó a "Portal de Facturación ADDV".
9. **Notificaciones por correo (ticket nuevo / factura lista)** — ver punto
   10, que documenta el diseño FINAL después de una corrección a mitad de
   implementación; no hace falta leer un diseño intermedio que ya no existe.
10. **CORRECCIÓN IMPORTANTE — "Correo de quien va a facturar" pasó de ser
    un campo por cliente a un valor GLOBAL.** Primer intento: se implementó
    como un campo más del formulario de constancia (columna
    `registros.correo_contador`, uno distinto por RFC). El usuario pidió
    corregirlo: ahora es un **único valor global** que el administrador
    configura dentro de la tarjeta SMTP (`backend/utils/email.js`, campo
    `correo_contador` de esa configuración — reutiliza la tabla
    `configuracion`, no una columna de `registros`). Cambios que esto
    implicó:
    - Se quitó el campo del formulario público (`index.html`/`app.js`) y de
      la config de "campos obligatorios" (ya no aplica: no hay nada que
      capturar por registro).
    - La columna `registros.correo_contador` **se dejó en la base de
      datos** (con un comentario marcándola obsoleta) en vez de un `DROP
      COLUMN` — decisión deliberada por seguridad, consistente con nunca
      remover columnas en este proyecto. No se lee ni se escribe desde
      ningún lado ya.
    - El tooltip (`.tooltip-trigger`/`.tooltip-popover`, definido en
      `style.css`) se movió con el campo a `admin.html`, dentro de
      `smtp-config-body` — funciona ahí sin duplicar CSS porque
      `admin.html` ya carga `style.css`.
    - `notificarNuevoTicketAlContador()` en `server.js` ahora lee
      `getConfigSmtp().correo_contador` en vez de hacer un `SELECT` por
      RFC contra `registros`.
    - `GET /api/admin/tickets/pendientes-sin-contador` se simplificó: ya
      no es una subconsulta por RFC — si el correo global está
      configurado, la lista sale vacía (se asume que todo se notifica ahí);
      si no, salen **todos** los tickets pendientes.
    - **Encontré y corregí un bug real durante esta corrección**: el
      script `verificar-mysql.js` seguía probando la lógica VIEJA (por
      RFC) después de haber cambiado el endpoint — quedó código colgante
      referenciando variables que ya no existían. Se reescribió la prueba
      para validar el comportamiento global real (con/sin el correo
      configurado), con su propio guardado/restaurado de la configuración
      SMTP real, igual que las demás pruebas de SMTP.
    - El correo de "factura lista" (`registros.email`, al cliente) **no
      cambió** — ese sigue siendo por RFC/cliente a propósito, es el mismo
      "correo para recibir facturas" de siempre.
    *Importante: al igual que con SMTP, el envío de correos nunca se ha
    probado contra un servidor real desde este entorno — sí se probó a
    fondo la lógica de borrado automático (con un ticket con fecha
    manipulada a 100 días atrás) y la consulta de "pendientes por
    notificar" en ambos estados (configurado/sin configurar), ambas contra
    MySQL real vía `verificar-mysql.js`.*
11. **Plantilla configurable del correo "factura lista" al cliente**:
    dentro de la misma tarjeta SMTP, dos campos nuevos —
    `asunto_cliente`/`cuerpo_cliente` (mismo patrón de guardado que los
    demás campos SMTP, tabla `configuracion`) — con soporte de variables
    `{folio}` y `{rfc}` sustituidas al enviar (`aplicarPlantilla()` en
    `backend/utils/email.js`, exportada y con `DEFAULTS_SMTP` también
    exportado para que `notificarFacturaListaAlCliente()` en `server.js`
    tenga un texto de respaldo razonable si nunca se personaliza — así el
    correo funciona desde el primer arranque sin que el admin tenga que
    tocar nada). Si el admin deja los campos vacíos y guarda, vuelve a
    usar el default automáticamente (el fallback usa `||`, y una cadena
    vacía es falsy en JS — comportamiento intencional, no un descuido).
    Usa `sanitizeTextoLibre` (no `sanitizeText`) para no HTML-escapar el
    contenido, igual que el correo de prueba. Probado con 6 casos de
    `aplicarPlantilla()` en aislamiento, más un round-trip completo contra
    MySQL real en `verificar-mysql.js` (guardar plantilla personalizada →
    leerla de vuelta → sustituir variables).
12. **El asunto del correo al cliente dejó de ser configurable.** El
    usuario pidió simplificarlo: se quitó el campo `asunto_cliente` por
    completo (de `DEFAULTS_SMTP`, de `setConfigSmtp`, del endpoint, y del
    campo en `admin.html`/`admin.js`) — ya **no** existe ni como columna
    del objeto de configuración ni como input en el formulario. El asunto
    ahora es una constante fija en `server.js`
    (`ASUNTO_FACTURA_LISTA = 'Factura lista — Folio {folio}'`), todavía
    procesada con `aplicarPlantilla()` para sustituir `{folio}`, pero sin
    depender de nada guardado en la base de datos. El **cuerpo** del
    correo sigue siendo configurable exactamente igual que antes — solo
    se quitó el asunto. Al corregir la prueba de regresión encontré una
    aserción propia que habría dado un falso negativo en una base de
    datos real con un `asunto_cliente` guardado de antes de este cambio
    (dato histórico inofensivo, no un bug) — la cambié para verificar la
    forma estática de `DEFAULTS_SMTP` en vez del objeto de configuración
    en tiempo de ejecución, que sí puede arrastrar campos viejos sin usar.
13. **Se quitaron "Uso de CFDI" e "Indicaciones de facturación" del
    formulario de constancia (`index.html`)** — el usuario los pidió fuera
    del segmento "subir constancia" específicamente. Importante: **"Uso de
    CFDI" también lo usa el flujo de tickets** (`tickets.html`, con la
    MISMA bandera de configuración `camposObligatorios.uso_cfdi`) — antes
    de tocar nada, mapeé con grep dónde se usaba cada campo para no romper
    esa otra pantalla. Resultado:
    - `uso_cfdi` se quitó del formulario e INSERT/UPDATE de constancia,
      pero **se dejó en `CAMPOS_CONFIGURABLES`** porque tickets todavía lo
      necesita — solo se reescribió el checkbox del admin a "Uso de CFDI
      (al subir tickets)" para dejar claro que ya no es sobre la
      constancia.
    - `indicaciones` no tenía ningún otro uso — se quitó por completo de
      `CAMPOS_CONFIGURABLES` (backend y frontend admin), no solo del form.
    - En el `UPDATE` de un registro existente, estas dos columnas se
      quitaron del `SET` **por completo** (no se les puso `null`) — así
      un cliente que reemplaza su archivo no pierde el valor histórico que
      ya tenía ahí de antes de este cambio. En el `INSERT` de un registro
      nuevo, simplemente no se incluyen (quedan `NULL` por default).
    - Las columnas `uso_cfdi`/`indicaciones` de la tabla de administración
      (vista Constancias) **se dejaron visibles a propósito**, para poder
      seguir consultando el valor de registros viejos — con una nota en
      el README aclarando que en registros nuevos siempre saldrán vacías.
    - **Encontré otro bug real de regresión al hacer esto**: una prueba en
      `verificar-mysql.js` llamaba `setCamposObligatorios({ rfc: true,
      indicaciones: true })` y esperaba que `indicaciones` se reflejara —
      como ya no está en `CAMPOS_CONFIGURABLES`, esa prueba habría fallado
      sola. La corregí para usar `uso_cfdi` en su lugar, y agregué una
      prueba nueva que confirma que `indicaciones` ahora se ignora
      silenciosamente al guardarse (para que si esto se rompe otra vez, se
      note de inmediato).
14. **Se agregaron "Tipo de pago" y "Comentarios" al formulario de subir
    ticket (`tickets.html`, NO `index.html`** — el usuario dijo "index"
    pero se refería a esta pantalla; si en el futuro alguien vuelve a decir
    "index" para algo de tickets, probablemente quiere decir
    `tickets.html`). Ambos opcionales, sin toggle de obligatorio/opcional
    (a diferencia de Uso de CFDI, que si tiene uno) — el usuario no lo
    pidió, así que no se agregó esa complejidad extra.
    - `tipo_pago`: dropdown con 4 slugs fijos en `tickets` (`efectivo`,
      `transferencia`, `tarjeta_debito`, `tarjeta_credito`), validados con
      un `CHECK` en la base de datos Y en el backend (doble validación,
      patrón ya establecido en todo el proyecto). Las etiquetas en
      español ("Pago en efectivo", etc.) están definidas en DOS lugares
      que deben mantenerse sincronizados manualmente: `TIPOS_PAGO` en
      `server.js` y `TIPOS_PAGO_INFO` en `admin.js` (no hay endpoint
      dedicado para esto, a diferencia del catálogo de Uso de CFDI, ya
      que son 4 opciones fijas que no se sincronizan con nada externo).
    - `comentarios`: texto libre, sin restricciones más allá de longitud.
    - Se muestran en el modal de gestión de tickets del admin (tipo de
      pago en la línea de metadatos junto con RFC/Uso de CFDI; comentarios
      en su propio recuadro, solo visible si el ticket tiene alguno) — NO
      se agregaron como columnas nuevas en la tabla del admin, a propósito,
      para no volverla más ancha de lo necesario.
    - Extendí `verificar-mysql.js`: el INSERT de prueba del ticket ahora
      incluye ambos campos, y se agregó una prueba dedicada para el
      `CHECK` de `tipo_pago` (rechaza un valor inválido, acepta `NULL`).
15. **Rediseño UX del modal de gestión de ticket** (respuesta a queja
    directa: "los comentarios pasan desapercibidos" y la línea de
    RFC/Uso de CFDI/tipo de pago/archivo era difícil de leer). Cambios:
    - La línea corrida con separadores " · " se reemplazó por una
      cuadrícula `<dl>` de pares etiqueta/valor (`.ticket-modal-info-grid`
      en `admin.css`) — 2 columnas en desktop, 1 columna en pantallas
      angostas (`<380px`), con "Documento" siempre a ancho completo
      porque los nombres de archivo pueden ser largos.
    - Los comentarios pasaron de un párrafo más a un recuadro con borde
      izquierdo de color, ícono de burbuja de diálogo, y etiqueta en
      mayúsculas ("COMENTARIOS DEL CLIENTE") — mismo patrón visual de
      "callout" que ya se usa en el aviso de Gmail dentro de la
      configuración SMTP, por consistencia.
    - **Verificación real, no solo razonamiento sobre CSS**: encontré que
      `wkhtmltoimage` está disponible en este entorno — renderé el HTML +
      CSS real del proyecto (no una recreación aproximada) a una imagen
      y la revisé antes de dar el cambio por bueno. Vale la pena recordar
      esta posibilidad para futuros ajustes visuales en este proyecto, en
      vez de solo razonar sobre las reglas CSS sin verificación visual.
16. **Se quitaron las columnas "Uso de CFDI" e "Indicaciones" de la tabla
    de Constancias del admin** (encabezado, celdas, checkboxes del
    selector "Columnas a mostrar", anchos y reglas de ocultar/mostrar en
    CSS), además del `SELECT` de `GET /api/admin/registros` en el backend
    (ya no tiene sentido traer esos datos si nada los muestra). **Antes de
    tocar nada, verifiqué explícitamente con grep que `data-col="uso_cfdi"`
    en el encabezado de esa tabla NO se comparte con la tabla de Tickets**
    (esa usa un `<th>` plano sin `data-col`, completamente independiente)
    — así que esto no afectó en nada la columna de Uso de CFDI que sigue
    viva ahí, ni el checkbox "Uso de CFDI (al subir tickets)" de
    campos-obligatorios (ese sigue controlando el requisito en tickets, no
    se tocó). Las columnas de la base de datos (`registros.uso_cfdi`,
    `registros.indicaciones`) siguen intactas — solo se dejó de
    consultarlas y mostrarlas en cualquier parte de la app.
17. **Sistema de perfiles de usuario (cliente/administrador/fiscal) +
    autenticación de admin de tres niveles.** Este es el cambio de mayor
    riesgo de seguridad hecho hasta ahora en el proyecto — toca
    `requireAdminAuth`, el middleware que protege TODAS las rutas
    `/api/admin/*`. Documentación detallada porque cualquiera que retome
    esto necesita entender exactamente qué cambió y por qué.

    **Diseño**: `usuarios` (antes solo "clientes con RFC") ahora tiene una
    columna `perfil` ENUM-como-CHECK (`cliente` | `administrador` |
    `fiscal`), default `'cliente'` para no romper cuentas existentes. El
    campo `rfc` se ensanchó a VARCHAR(50) porque para perfiles
    administrador/fiscal funciona como nombre de usuario libre, no
    necesariamente un RFC real.

    **`requireAdminAuth()` en `backend/utils/auth.js` ahora prueba TRES
    mecanismos en orden, con éxito en cualquiera de los tres**:
    1. `ADMIN_USERS` (variable de entorno) — **sin ningún cambio**, por
       instrucción explícita del usuario ("síguelo dejando"). Comparación
       con `crypto.timingSafeEqual`, tal como ya estaba.
    2. Cuenta de respaldo `"admin"` — un hash guardado en la tabla
       `configuracion` (clave `admin_fallback_password_hash`), sembrado
       por `ensureSchema()` en `db.js` con `hashPassword('admin')` la
       primera vez que arranca el backend. Cambiable desde la UI
       (`PUT /api/admin/config/admin-password`). Esta regla es EXCLUSIVA
       del nombre de usuario `admin` exacto (comparación de string, no de
       prefijo/patrón) — un usuario "administrador2" no la hereda.
    3. Cualquier fila en `usuarios` con `perfil IN ('administrador',
       'fiscal')`, autenticada con su `rfc` (como nombre de usuario) +
       `password_hash` (verificado con `verifyPassword`, scrypt +
       `timingSafeEqual` — mismo mecanismo que el login de clientes).
       **La exclusión de "cliente" pasa en la consulta SQL misma**
       (`WHERE perfil IN (...)`), no en una capa posterior — así que ni
       siquiera un bug en el código que llama a esta función podría dejar
       pasar a un cliente por accidente.

    Los tres mecanismos son estrictamente ADITIVOS — ninguno reemplaza a
    otro, y fallar en uno cae al siguiente sin filtrar información sobre
    cuál falló (el mensaje de error final es genérico en todos los casos).

    **Decisión de scope que tomé sin que se pidiera explícitamente**:
    "administrador" y "fiscal" tienen exactamente los mismos permisos
    (ambos simplemente pasan `requireAdminAuth`) — no hay diferenciación
    de qué puede hacer cada uno todavía. El campo `perfil` queda
    disponible (`req.adminPerfil` en cada request autenticada) para que
    sea fácil agregar esa diferenciación después sin rediseñar nada, pero
    no construí ningún sistema de permisos granular porque no se pidió y
    habría sido alcance no solicitado. Documentado también en el README.

    **La vista "Usuarios" del admin ahora tiene**:
    - Filtro por perfil + insignia de color por fila.
    - Botón "+ Crear usuario" → único punto de alta para perfiles
      administrador/fiscal (no hay registro público para esos perfiles, a
      propósito). El formulario cambia dinámicamente: para "Cliente" pide
      RFC validado + teléfono obligatorio; para administrador/fiscal pide
      un nombre de usuario libre (regex `[A-Za-z0-9._-]+`, sin teléfono).
    - Tarjeta plegable para cambiar la contraseña de la cuenta de
      respaldo "admin" (mismo patrón de generar/copiar/reglas que ya
      existía para restablecer contraseñas de otros usuarios).

    **Bug que encontré y corregí yo mismo antes de terminar**: escribí
    toda la lógica de los dos modales nuevos usando `setFieldError(id,
    msg)`, asumiendo que existía en `admin.js` porque SÍ existe en
    `app.js`/`login.js` con la misma firma — pero nunca se había portado a
    `admin.js`. Lo detecté revisando el archivo antes de dar el trabajo
    por terminado (no fue el usuario quien lo encontró) y agregué la
    función faltante, replicando exactamente la misma convención
    (`error-<id>` + clase `.has-error` en el `.field` contenedor).

    **Pruebas**: además de `node --check` en todo, probé en aislamiento
    (sin DB) el ciclo completo de hash/verificación de la cuenta "admin"
    con `hashPassword`/`verifyPassword` directamente (contraseña correcta,
    incorrecta, sensibilidad a mayúsculas, cambio de contraseña invalida
    la anterior). Extendí `verificar-mysql.js` con pruebas contra MySQL
    real: el CHECK de `perfil`, crear administrador/fiscal, que el filtro
    por perfil no mezcle cuentas, y — la prueba más importante de
    seguridad — reproduje la consulta EXACTA que usa
    `verificarUsuarioAdministrativo()` para confirmar que un cliente
    real (`RFC_PRUEBA_USUARIO`) es rechazado aunque se le pase su
    contraseña correcta, precisamente porque la consulta lo excluye a
    nivel SQL.

    **No pude probar (limitación de este entorno, no del código)**: el
    flujo HTTP completo end-to-end (mandar un header `Authorization:
    Basic ...` real contra el servidor corriendo) — no hay forma de
    levantar el backend + MySQL aquí. Lo que sí probé es cada pieza de
    lógica por separado (hash/verify en aislamiento, consultas SQL contra
    MySQL real). Antes de confiar esto en producción, probar manualmente
    los tres mecanismos de login al panel: (1) con las credenciales de
    `ADMIN_USERS`, (2) con `admin`/`admin` recién instalado, y (3) creando
    un usuario "administrador" desde la UI e iniciando sesión con él.
18. **Reorganización visual: "Configuraciones globales" como cuarta
    pestaña.** Cambio puramente de frontend, sin tocar backend ni
    funcionalidad — el usuario lo pidió explícitamente así ("este cambio
    solamente es en el front end"). Las tarjetas "Configuración del
    formulario público" y "Correo electrónico (SMTP)" vivían dentro de
    `vista-constancias`; se movieron (con un script Python, no a mano, para
    no arriesgar una transcripción incorrecta de ~180 líneas de HTML) a un
    nuevo `<div id="vista-configuraciones">`, con su propio botón en el
    selector de vistas junto a "Usuarios". `cambiarVistaPrincipal()` en
    `admin.js` ahora maneja 4 vistas en vez de 3. El `<select>` de tipo de
    pago en `tickets.html` y todo lo demás no se tocó.
    - **Carga de datos**: `cargarConfigCampos()`/`cargarInfoUsoCfdi()`
      seguían llamándose en `showDashboard()` (carga inmediata al entrar
      al panel, sin importar la pestaña activa) — decidí **no** quitar eso
      para no arriesgar una regresión funcional, y además agregué que
      también se recarguen cada vez que se abre la pestaña
      "Configuraciones globales" (mismo patrón que Tickets/Usuarios), para
      que los datos siempre estén frescos si algo cambió desde otro lado.
      Es una llamada de red extra e inofensiva, no un cambio de
      comportamiento.
    - El botón "Configuraciones globales" tiene una etiqueta más larga que
      los demás — le agregué `flex-wrap` al contenedor del selector de
      vistas y una regla de mobile que hace que los 4 botones se
      distribuyan en una cuadrícula 2x2 en pantallas angostas, en vez de
      desbordarse. Lo verifiqué renderizando con `wkhtmltoimage` a 750px
      (escritorio) y 380px (celular) por separado — importante notar que
      `wkhtmltoimage --width` fija el viewport para toda la página, así
      que para probar una media query hay que generar un archivo/render
      separado por cada ancho, no un solo archivo con contenedores de
      distintos anchos (eso no dispara la media query real).
19. **Botón "Volver al tablero" unificado entre `index.html` y
    `tickets.html`.** Antes eran dos implementaciones distintas: en
    `index.html` un enlace de texto (`.app-header-sesion`) posicionado
    absoluto dentro del header, oculto por defecto y mostrado solo con
    sesión activa; en `tickets.html` otro enlace de texto
    (`.portal-volver`) siempre visible, colocado arriba de la tarjeta
    (fuera del header). Mismo destino (`dashboard.html`), mismo texto,
    pero visualmente casi invisibles (gris tenue, sin fondo) y en
    posiciones distintas — de ahí la queja de inconsistencia/poca
    visibilidad. Se unificaron en un solo componente compartido,
    `.btn-volver-tablero` en `style.css` (que ambas páginas ya cargan):
    forma de chip con fondo `--color-accent-soft`, ícono de flecha, y
    estado de foco visible para accesibilidad de teclado. En
    `tickets.html` se movió el enlace de "arriba de la tarjeta" al
    header, junto a las demás acciones de sesión, para que ambas páginas
    lo muestren en la misma posición. Se quitó el CSS muerto de
    `.portal-volver` en `portal.css` (confirmé con grep que no quedaba
    ninguna referencia antes de borrarlo). El toggle de visibilidad de
    `index.html` (oculto sin sesión, visible con sesión) no se tocó — solo
    cambió la apariencia visual, no el comportamiento de cuándo se muestra.
    **Verificación**: como no pude "ver" las imágenes renderizadas
    directamente en este turno (el visor no mostró contenido, a pesar de
    que el archivo se generó correctamente), verifiqué con muestreo de
    píxeles por código (`PIL`/Pillow) que el color de fondo del botón en
    ambos headers coincidiera exactamente con `--color-accent-soft`
    (`#E4EFEC` = RGB 228,239,236) y el texto con `--color-accent-dark`
    (`#0B5548` = RGB 11,85,72) — coincidencia exacta en ambos casos. Útil
    recordar esta técnica alternativa si el visor de imágenes vuelve a
    fallar en una sesión futura.
20. **`index.html` ahora muestra la barra de sesión completa (RFC +
    "Cerrar sesión"), no solo el botón "Volver al tablero".** Faltaba
    llevar la consistencia hasta el final: el botón ya se había unificado
    (punto 19), pero seguía sin el RFC ni el logout que sí tiene
    `tickets.html`. Cambios:
    - `index.html` ahora carga `portal.css` y `portal.js` (mismo patrón
      que `tickets.html`/`dashboard.html`: `<script src="portal.js">`
      antes del script propio de la página).
    - El header cambió de `class="app-header"` (propio, centrado, con el
      link posicionado absoluto) a `class="portal-header"` — el mismo
      componente que ya usaban dashboard/tickets. Como consecuencia,
      `.app-header`/`.app-header-sesion` en `style.css` quedaron
      completamente muertos (confirmé con grep que ningún HTML los usa ya)
      y los borré.
    - **Importante — decisión deliberada que hay que respetar si se toca
      esto de nuevo**: `index.html` NO llama a `Portal.requireSession()`
      (la función de `portal.js` que redirige a `login.html` si no hay
      sesión). Esa función es la correcta para dashboard/tickets, que
      SIEMPRE requieren sesión — pero `index.html` es la única página que
      debe seguir funcionando tanto CON sesión (RFC bloqueado, barra
      visible) COMO SIN sesión (acceso público, formulario normal), por
      retrocompatibilidad. `app.js` sigue teniendo su propia lógica de
      detección de sesión que NO redirige (`sesionData && sesionData.rfc`
      dentro de `init()`), y ahí es donde ahora también se llena
      `#portal-user-label` con el RFC — reutilizando el mismo id que usa
      `requireSession()` en las otras páginas, pero llenado a mano en vez
      de por esa función, precisamente para no heredar el redirect. Cargar
      `portal.js` en `index.html` es seguro de todas formas porque su
      único efecto automático al cargar (`DOMContentLoaded`) es conectar
      `#btn-logout` si existe y mostrar el aviso de retención si existe
      `#aviso-retencion` (que `index.html` no tiene, así que no hace nada
      ahí) — nunca llama a `requireSession()` por su cuenta.
    - **Verificación por muestreo de píxeles** (misma técnica del punto
      19): confirmé que el bloque de header de `index.html` CON sesión y
      el de `tickets.html` tienen exactamente la misma altura (71px) y
      exactamente el mismo conteo de píxeles del color del botón (627 en
      ambos) — coinciden pixel por pixel, no solo "se ven parecidos". El
      header SIN sesión tiene 0 píxeles de ese color, confirmando que la
      barra desaparece por completo (no deja un hueco vacío) cuando no hay
      sesión.
21. **Aviso emergente en `tickets.html` si el RFC no tiene constancia
    subida.** Nuevo endpoint `GET /api/registro/existe` (protegido,
    `requireUserAuth`) — a propósito NO reutilicé el endpoint público
    existente `GET /api/registro/buscar` (que también podría haber
    servido para esto, pasándole el RFC de la sesión como query param):
    ese es público, no requiere sesión, y devuelve los DATOS COMPLETOS del
    registro si existe (nombre, tipo de persona, email, etc.) — usarlo
    aquí habría expuesto más información de la necesaria para una simple
    pregunta sí/no. El endpoint nuevo solo responde `{ existe: boolean }`,
    consultando por `req.userRfc` (nunca un RFC arbitrario de query param).
    - En `tickets.js`, la llamada a este endpoint es "fire-and-forget" (sin
      `await` en el punto de llamada dentro de `init()`) — no bloquea la
      carga del catálogo de Uso de CFDI ni el resto del formulario.
    - El modal (`#sin-constancia-overlay`) tiene un botón primario "Subir
      constancia" (va a `index.html`) y uno secundario "Continuar sin
      subirla" — es un aviso, no un bloqueo duro. El usuario pidió
      explícitamente un "pop up con el botón", no impedir subir el ticket.
    - Si la consulta al endpoint falla (red caída, etc.), simplemente no
      se muestra el aviso — nunca se bloquea el flujo de subir el ticket
      por un fallo de esta verificación secundaria.
    - Ícono reutilizable nuevo: `.modal-icono-aviso` en `style.css`
      (insignia circular con los colores de "warn"), pensado para
      cualquier futuro modal informativo/de advertencia, no solo este.
    - **Pruebas**: extendí `verificar-mysql.js` con un caso dedicado que
      cubre las 3 situaciones reales — RFC con constancia activa
      (`existe=true`), RFC sin ninguna (`existe=false`), y un caso que
      casi se me pasa pero sí verifiqué: una constancia con **borrado
      lógico** (`eliminado_en` no nulo) ya NO debe contar como existente,
      porque la consulta real del endpoint filtra `AND eliminado_en IS
      NULL` — probé explícitamente ese caso, no solo los dos obvios.
    - Verificación visual del modal por muestreo de píxeles (misma técnica
      de los puntos 19-20): confirmé que el círculo del ícono tiene el
      color exacto de `--color-warn-soft` y que el botón primario tiene el
      color exacto de `--color-accent`.
22. **`index.html` renombrado a `csf.html`** (Constancia de Situación
    Fiscal). Antes de tocar nada, mapeé con grep TODAS las dependencias
    reales en todo el repo (HTML, JS, `nginx.conf`, `Dockerfile`,
    `docker-compose.yml`, `.env.example`, `backend/`) — no asumí que solo
    eran los `href` obvios. Hallazgo clave que simplificó todo: el `index`
    real de nginx **ya era `login.html`**, no `index.html` — así que la
    ruta `/` nunca dependió de este archivo y no hubo que tocar esa
    directiva. Cambios:
    - Archivo físico: `index.html` → `csf.html` (mismo contenido, solo el
      nombre).
    - Enlaces actualizados: `dashboard.html` (tile "Subir constancia") y
      `tickets.html` (botón del modal "sin constancia" del punto 21) — eran
      las ÚNICAS dos referencias `href="index.html"` en todo el frontend
      (confirmé con grep que no había una tercera).
    - `frontend/Dockerfile`: el `COPY` listaba `index.html` explícitamente
      por nombre (no un wildcard) — se actualizó a `csf.html`.
    - `nginx.conf`: se agregó `location = /csf { try_files /csf.html
      =404; }` (mismo patrón que `/dashboard`, `/tickets`, `/login`,
      `/admin`, que ya existían), y un `location = /index.html { return
      301 /csf.html; }` para que un enlace o marcador viejo a la URL
      anterior no devuelva 404 sino que redirija.
    - Ningún archivo JS tiene lógica dependiente del nombre del archivo
      (verifiqué que no hay `window.location.pathname` ni comparaciones
      contra `'index.html'` en ningún script) — el rename fue seguro
      precisamente porque nada dependía del nombre más que los `href`
      estáticos ya mencionados.
    - **Cómo probé el cambio sin poder levantar nginx/Docker aquí**:
      1. Validador estructural de `nginx.conf` escrito a mano en Python
         (cuenta llaves, confirma que cada directiva termina en `;`/`{`/`}`)
         — intenté instalar `nginx`/`crossplane` (parser oficial de F5)
         primero, pero el entorno no tiene acceso de red a esos paquetes;
         quedó documentado el intento por si en una sesión futura sí hay
         acceso y vale la pena usar la herramienta real en vez de la
         validación manual.
      2. Simulé la lógica de `try_files` en Python para cada ruta relevante
         (`/`, `/csf`, `/csf.html`, `/dashboard`, `/tickets`, `/admin`,
         y el redirect de `/index.html`), confirmando contra los archivos
         reales en disco cuál resolvería cada una.
      3. Confirmé que cada archivo listado en el `COPY` del Dockerfile
         existe de verdad en `frontend/`, y que ningún `.html`/`.js`/`.css`
         real se quedó fuera de esa lista (comparación en ambas direcciones,
         no solo "los que están sí existen").
      4. Cross-check de IDs `app.js` ↔ `csf.html` (el mismo chequeo que ya
         se usa en todo este proyecto), para confirmar que renombrar el
         archivo no rompió nada del lado del contenido interno.
    - Documentación actualizada en el README: nota dedicada sobre el
      rename (con la ruta `/csf` y el redirect), más el pie de nota en cada
      punto que menciona `csf.html` aclarando el nombre anterior — para que
      alguien buscando "index.html" en el README todavía lo encuentre.
23. **CORRECCIÓN DE UN ERROR DE DISEÑO REAL, reportado por el usuario:**
    el punto 21 (aviso de "sin constancia" en tickets.html) se implementó
    como una advertencia SOLO en el frontend, con un botón "Continuar sin
    subirla" — y **el backend nunca validaba esta regla**. El resultado:
    cerrar el modal (o llamar la API directo, con curl/Postman/etc.) sí
    dejaba subir un ticket sin constancia, exactamente como reportó el
    usuario. Esto fue un descuido mío: implementé la parte visible
    (el aviso) sin completar la parte que realmente importa (la
    validación autoritativa del lado del servidor) — lección para no
    repetir en futuras "reglas de negocio": si algo debe prevenir una
    acción, la comprobación real vive en el backend, y el frontend es
    solo una ayuda de UX que nunca es la única barrera.
    - **Arreglo real**: `POST /api/tickets` en `server.js` ahora consulta
      `SELECT id FROM registros WHERE rfc = ? AND eliminado_en IS NULL
      LIMIT 1` (req.userRfc) ANTES de aceptar el archivo, y rechaza con
      400 si no hay ninguna fila — esto es lo que de verdad impide subir
      el ticket, sin importar qué haga la interfaz.
    - **Frontend rediseñado para ser coherente con el bloqueo real**: se
      quitó el botón "Continuar sin subirla" y el cierre haciendo clic
      afuera del modal — ahora las únicas dos salidas son "Subir
      constancia" (navega a `csf.html`) o "Volver al tablero"; no hay
      forma de "descartar" el aviso y seguir en la página. Además, se
      deshabilita todo el formulario (`uso_cfdi`, `tipo_pago`,
      `comentarios`, el input de archivo, el botón de enviar) mientras no
      haya constancia — pensado específicamente para navegación por
      teclado, que podría saltarse el modal con Tab si el overlay fuera
      la única barrera.
    - **Bug adicional que encontré yo mismo al revisar esto a fondo**:
      arrastrar y soltar un archivo (`drop` event) sobre el dropzone NO
      pasa por el `<input type="file">` deshabilitado — es un evento
      aparte sobre el propio `<div>` del dropzone. Si solo hubiera
      deshabilitado el input, alguien podía arrastrar una imagen
      directamente y saltarse el bloqueo del lado del cliente (aunque el
      backend lo habría rechazado de todas formas). Agregué un candado
      explícito (`dropzoneDeshabilitado()`) que se revisa en los tres
      puntos de entrada: clic, teclado (Enter/Espacio), y arrastrar-soltar.
    - **Pruebas**: extendí `verificar-mysql.js` con una prueba que
      reproduce la consulta EXACTA que ahora usa `POST /api/tickets`
      contra dos RFC de prueba (uno con constancia, uno sin ella),
      confirmando que la regla de negocio real (no solo el endpoint
      informativo `GET /api/registro/existe`) se comporta correctamente.
24. **Segunda corrección al mismo punto 23**: el usuario notó que cuando
    `POST /api/tickets` rechaza la subida en el momento de enviar (no al
    cargar la página — ej. si `verificarConstancia()` falló por una
    desconexión momentánea, o la constancia se borró entre que cargó la
    página y que envió el ticket), el error solo se mostraba como un
    `showToast()` genérico — un mensaje que desaparece solo, sin botón de
    acción. Faltaba el mismo modal con "Subir constancia" en ESE momento
    también, no solo al cargar la página.
    - **Arreglo**: el error 400 de `POST /api/tickets` cuando falta la
      constancia ahora incluye un campo `codigo: 'SIN_CONSTANCIA'` (además
      del mensaje de texto) — un identificador estable que el frontend
      puede revisar de forma confiable, en vez de intentar reconocer el
      error comparando el texto exacto del mensaje (frágil: se rompería
      si el texto cambia de redacción en el futuro).
    - En `tickets.js`, el manejador de la respuesta del envío
      (`xhr.onload`) ahora revisa `data.codigo === 'SIN_CONSTANCIA'`: si
      coincide, muestra el MISMO modal bloqueante (`sinConstanciaOverlay`)
      y deshabilita el formulario (`bloquearFormularioTicket()`) — el
      mismo camino de código que ya usa `verificarConstancia()` al cargar
      la página, no una copia separada. Cualquier OTRO error (413 por
      tamaño, 400 por tipo de archivo inválido, 500, etc.) sigue usando el
      toast genérico — el modal es específico de este caso.
    - **Probado en aislamiento**: 5 casos (éxito 201, error con
      `codigo: SIN_CONSTANCIA`, otro error 400 sin ese código, JSON
      malformado, error 413) confirmando que cada uno cae en la rama
      correcta (modal vs. toast vs. éxito).
25. **Eliminar tickets del lado del administrador** — se implementó
    replicando EXACTAMENTE el mismo patrón de tres niveles que ya existía
    para constancias (borrado lógico → papelera → restaurar → borrado
    físico), en vez de inventar un mecanismo nuevo, para que la UX sea
    consistente entre las dos tablas del panel.
    - Columna `eliminado_en DATETIME NULL` agregada a `tickets` (migración
      segura). `GET /api/tickets` (lista del propio cliente) y
      `GET /api/admin/tickets/pendientes-sin-contador` ahora excluyen
      tickets eliminados — encontré esto último revisando qué otras
      consultas debían respetar la nueva columna, no era obvio a primera
      vista.
    - `GET /api/admin/tickets` acepta `?papelera=true`, combinable con
      `?estatus=` (mismo patrón de query params que ya usa
      `GET /api/admin/registros`).
    - Tres endpoints nuevos, calcados de los de registros:
      `DELETE /api/admin/tickets/:id` (lógico),
      `POST /api/admin/tickets/:id/restaurar`,
      `DELETE /api/admin/tickets/:id/permanente` (borra imagen + factura
      del disco, si existían, más la fila).
    - Frontend: nuevo `state.vistaTickets` — **deliberadamente separado**
      del `state.vista` que ya usan las constancias, porque son dos tablas
      independientes con su propio toggle Activos/Papelera; reutilizar la
      misma variable de estado habría mezclado ambas vistas por error.
      `renderTickets()` ahora muestra "Gestionar"+"Eliminar" en Activos, o
      "Restaurar"+"Eliminar permanentemente" en Papelera — mismo patrón de
      `contenedorAcciones` (div envolvente) que ya usa `renderTabla()`
      para registros.
    - **Verifiqué antes de escribir CSS nuevo** que `.btn-restaurar`,
      `.btn-eliminar`, `.btn-eliminar-permanente` ya existían en
      `admin.css`, pero escritos como `.admin-table .btn-eliminar` (con
      `.admin-table` como ancestro requerido) — confirmé que
      `tickets-table` sí tiene la clase `admin-table` además de la suya
      propia, así que los estilos se heredan sin tocar CSS. Lo verifiqué
      con muestreo de píxeles (mismo método de turnos anteriores):
      confirmé que el color de error/peligro aparece correctamente en la
      vista de papelera renderizada con el HTML/CSS real del proyecto.
    - **Pruebas**: extendí `verificar-mysql.js` reutilizando el ticket de
      prueba que ya había pasado por todo el flujo de estatus (con Uso de
      CFDI, tipo de pago, comentarios y factura) — confirma borrado
      lógico → desaparece de activos → aparece en papelera → restaurar →
      vuelve a activos → un segundo intento de eliminar no tiene efecto
      (`affectedRows = 0`) → borrado físico → la fila ya no existe en
      absoluto.
26. **Eliminar usuarios + correo obligatorio con invitación al portal.**
    Dos pedidos en el mismo mensaje, implementados juntos.

    **Eliminar usuarios**: a diferencia de constancias/tickets,
    DELIBERADAMENTE **no** repliqué el patrón de papelera aquí — decidí un
    borrado directo (con confirmación) en vez de lógico. Razón: una cuenta
    de usuario no tiene ningún archivo que preservar (a diferencia de una
    constancia o la imagen de un ticket), y si el administrador se
    equivoca, recrear la cuenta es trivial y no pierde nada — las
    constancias/tickets de esa persona están ligadas por RFC, no por el id
    de la fila en `usuarios`, así que sobreviven intactas a la eliminación
    de la cuenta. Esto es una decisión de diseño distinta a los dos
    patrones anteriores, tomada a propósito, no un descuido de
    consistencia.
    - `DELETE /api/admin/usuarios/:id` con un candado de seguridad: si el
      RFC de la cuenta a borrar coincide con `req.adminUser` (el
      RFC/usuario con el que el propio admin autenticado inició sesión,
      ver `requireAdminAuth` en `auth.js`), se rechaza — evita que alguien
      se elimine a sí mismo por accidente y quede fuera del panel. La
      cuenta de respaldo "admin" no vive en esta tabla, así que nunca
      puede colisionar con este chequeo de todas formas.

    **Correo obligatorio + invitación**: se agregó `email VARCHAR(200)
    NULL` a `usuarios` (nullable a propósito, para no romper cuentas
    creadas antes de este cambio — pero el formulario "Crear usuario" SÍ
    lo exige como obligatorio para CUALQUIER perfil, no solo clientes,
    ya que ahora es el dato con el que se envía la invitación).
    - Nueva función `enviarInvitacionPortal()` en `server.js`, junto a las
      demás funciones de notificación (`notificarNuevoTicketAlContador`,
      etc.) — mismo patrón fire-and-forget ya establecido: si el SMTP no
      está configurado o el envío falla, la cuenta se crea de todas
      formas, el error solo se registra en logs, nunca bloquea la
      creación de la cuenta.
    - El cuerpo del correo incluye el usuario (RFC/nombre de usuario) y la
      **contraseña temporal en texto plano** — decisión consciente, no
      descuido: esta app no tiene un flujo de recuperación de contraseña
      por correo, así que es la forma más práctica de entregar
      credenciales sin depender de un canal aparte (verbal/teléfono). El
      asunto y cuerpo son fijos (no configurables), a diferencia del
      correo de "factura lista" que sí tiene cuerpo personalizable —
      no se justificaba agregar otra plantilla configurable para un caso
      de uso tan puntual.
    - Frontend: el campo de correo en "Crear usuario" es visible e
      igual de obligatorio sin importar el perfil elegido (a diferencia
      del teléfono, que solo aplica a "Cliente") — no necesitó lógica
      condicional en `actualizarCamposSegunPerfil()`.
    - Columna "Correo" agregada a la tabla de Usuarios del admin.
    - **Pruebas**: extendí `verificar-mysql.js` con el flujo de crear una
      cuenta con correo (confirma que se guarda) + eliminarla (confirma
      que la fila desaparece) + el candado de auto-eliminación (simulado
      con la misma comparación de RFCs que usa el endpoint real). También
      agregué una prueba a la creación de usuario ya existente confirmando
      que una cuenta creada SIN correo (compatibilidad con datos previos)
      queda con `email = NULL`, no con una cadena vacía ni un error.
27. **Enlace al portal en la invitación, con auto-detección de URL** —
    pedido explícito: que el correo de invitación incluya un link a la
    parte del cliente, "contemplando los contextos de la URL". Decisión
    de diseño: en vez de una variable de entorno fija (`APP_URL` o
    similar, que alguien tendría que recordar configurar y mantener
    sincronizada si cambia el dominio), la URL se **detecta de la propia
    petición HTTP** del administrador al crear el usuario —
    `${req.protocol}://${req.get('host')}` — así funciona automáticamente
    en desarrollo local, accediendo por IP de red local, o en producción
    con dominio real y HTTPS, sin configurar nada aparte.
    - Requiere `app.set('trust proxy', true)` en `server.js` para que
      `req.protocol` respete `X-Forwarded-Proto` en vez de siempre ver
      "http" (que es lo que percibe el backend en el salto interno nginx
      → backend, sin importar qué protocolo usó el cliente real). Confirmé
      que esto es seguro en este proyecto porque el backend **nunca**
      expone su puerto al host (ver `docker-compose.yml` — solo
      `frontend` tiene `ports:`), así que nginx es la única fuente posible
      de peticiones; no hay riesgo de que un cliente externo falsifique
      esos encabezados directamente contra el backend.
    - **Efecto colateral beneficioso que noté al revisar esto**:
      `trust proxy` también corrige el `keyGenerator` por defecto de
      `express-rate-limit` (que usa `req.ip`) — sin esto, todas las
      peticiones a través de nginx aparecían con la misma IP interna del
      contenedor ante el limitador de tasa, así que el límite de intentos
      se compartía incorrectamente entre TODOS los clientes reales en vez
      de aplicarse por IP real de cada uno. No fue el objetivo de este
      cambio, pero es una mejora real que vino gratis.
    - **Bug real que encontré y corregí de paso, revisando la cadena
      completa de proxies**: el `nginx.conf` del contenedor `frontend`
      reenviaba `X-Forwarded-Proto` como `$scheme` (el protocolo de SU
      PROPIA conexión entrante). Esto es correcto para el caso simple
      (cliente → este nginx directamente), pero el propio README ya
      documentaba un despliegue de producción con un Nginx ADICIONAL en
      el host, donde HTTPS termina — ese nginx-del-host habla HTTP plano
      hacia el contenedor `frontend` en `127.0.0.1:8080`, así que el
      `$scheme` que vería el nginx-de-Docker sería siempre "http", sin
      importar que el cliente real haya usado HTTPS. El backend habría
      recibido "http" en `X-Forwarded-Proto` incluso en un sitio HTTPS
      real, generando enlaces `http://` rotos/inseguros en el correo de
      invitación. Arreglado con un `map` en `nginx.conf`
      (`$proxy_x_forwarded_proto`) que reenvía el valor ya puesto por un
      proxy anterior si existe, y solo cae de vuelta a `$scheme` cuando no
      hay ninguno (desarrollo local, sin ese nginx adicional). Documentado
      también en el README, junto al snippet de nginx de producción.
    - El enlace apunta específicamente a `/login` (la parte del cliente,
      como se pidió) — no es distinto según el perfil de la cuenta
      invitada; un administrador/fiscal entra al panel por Basic Auth en
      `/admin`, acceso que no depende de esta invitación.
    - Manejo de caso borde: si `req.get('host')` viniera vacío por
      cualquier razón, se omite la línea del enlace en el correo en vez de
      mandar una URL rota tipo `undefined://undefined/login`.
    - **Pruebas**: agregué un bloque a `verificar-mysql.js` (lógica pura,
      sin depender de la base de datos, pero incluida ahí para que "correr
      el script" siga siendo la forma de verificar todo de una sola vez)
      cubriendo los 4 contextos reales: localhost con puerto, IP de red
      local, dominio real con HTTPS sin puerto, y el caso borde sin host
      detectado.
28. **Corrección al punto 27: el enlace de invitación ahora es
    consciente del perfil.** En el punto anterior, dejé anotado en el
    propio código un razonamiento de "el enlace siempre va a /login,
    porque así se pidió explícitamente" — el usuario volvió específicamente
    a corregir esto para el perfil "fiscal", pero apliqué la misma
    lógica también a "administrador" (mismo mecanismo de acceso: HTTP
    Basic Auth en `/admin`, no el login de RFC+contraseña en `/login`) en
    vez de arreglarlo solo para el caso puntual que se mencionó — dejar
    "administrador" apuntando a un lugar por donde esa cuenta no entra
    habría sido el mismo bug sin corregir del todo.
    - `cliente` → `${urlPortal}/login` (portal público).
    - `administrador` / `fiscal` → `${urlPortal}/admin` (panel, mismo
      mecanismo de acceso para ambos).
    - Verifiqué explícitamente (revisando `admin.js`) que `/admin` muestra
      una pantalla de login propia dentro de la página (`admin-login-screen`),
      no un popup nativo de Basic Auth del navegador — así que es un
      destino de enlace razonable y no una experiencia rara al hacer clic.
    - Se agregó también una etiqueta distinta en el cuerpo del correo
      ("Portal:" vs. "Panel de administración:") para que quede claro qué
      es el enlace, no solo a dónde apunta.
    - La detección de la URL base (protocolo + dominio) no cambió — sigue
      viniendo de la petición del administrador, tal como en el punto 27;
      lo único que cambió es la RUTA final según el perfil.
    - **Pruebas**: extendí el mismo bloque de `verificar-mysql.js` del
      punto 27 con 3 casos nuevos (cliente → /login, fiscal → /admin,
      administrador → /admin) en vez de crear un bloque de pruebas
      aparte, ya que es una extensión directa de la misma lógica.
29. **Mismo mecanismo de auto-detección de URL, ahora en el aviso de
    "nuevo ticket para facturar"** (el correo que recibe el contador
    cuando un cliente sube un ticket — `notificarNuevoTicketAlContador`).
    Antes solo decía "ingresa al panel de administración" sin ningún
    enlace; ahora incluye `${urlPortal}/admin`, con la misma lógica de
    detección de los puntos 27-28 (protocolo + host de la petición que
    subió el ticket — en este caso la del CLIENTE, no la de un
    administrador, pero el dominio detectado es el mismo de todas formas,
    ya que todos pasan por el mismo nginx).
    - **Refactor**: como esta es la segunda vez que se repite
      `req.get('host') ? \`${req.protocol}://${req.get('host')}\` : ''`
      en dos lugares distintos del archivo, lo extraje a una función
      compartida `detectarUrlPortal(req)`, definida junto a `generarFolio`
      cerca del inicio del archivo, y actualicé ambos llamadores
      (`POST /api/admin/usuarios` y `POST /api/tickets`) para usarla en
      vez de repetir la expresión. Evita que una futura corrección a esta
      lógica (ej. si algún día hace falta ajustar cómo se detecta el host)
      se tenga que hacer en dos lugares y arriesgue quedar inconsistente.
    - **Pruebas**: extendí el mismo bloque de `verificar-mysql.js` de los
      puntos 27-28 con los casos de este aviso (dominio real, localhost, y
      el caso borde sin host detectado) — mismo patrón, sin bloque nuevo.
30. **Bug real en `extraerNombreRazonSocial` (persona moral), encontrado
    sin necesitar un PDF de muestra — solo revisando la lógica a fondo.**
    El usuario reportó que persona moral volvía a tener "el mismo error
    del inicio" (tomaba otro campo) y pidió unificar para que física y
    moral usaran la misma función. Ya usaban la misma función — el
    problema NO era falta de unificación, sino un respaldo interno mal
    condicionado dentro de ella.
    - **La causa raíz**: el "último respaldo" de la función (unir
      "Nombre (s)" + "Primer Apellido" + "Segundo Apellido") es un
      concepto EXCLUSIVO de persona física — persona moral no tiene esos
      campos. Pero antes de este fix, ese respaldo se activaba para
      CUALQUIER documento en cuanto las estrategias anteriores no
      encontraban nada, usando un patrón de "Nombre" muy suelto
      (`/Nombre\s*\(?s?\)?\s*:?/i`) que tomaba la PRIMERA aparición de esa
      palabra en TODO el texto. En una constancia de persona moral, eso
      podía enganchar con cualquier campo que empezara con "Nombre" (ej.
      "Nombre Comercial") y devolver SU valor en vez de la razón social
      real — exactamente "tomaba otro campo".
    - **Cómo lo confirmé sin un PDF real**: construí un texto sintético
      que reproduce el patrón exacto (un "Nombre" suelto no relacionado
      apareciendo ANTES en el documento que la razón social real, que a
      su vez aparece justo antes de su propia etiqueta, como ya
      documentaba el código). Antes del fix, devolvía el campo
      equivocado; después, el correcto — confirmando la causa raíz antes
      de dar el cambio por bueno, en vez de solo razonar sobre el código
      sin verificar.
    - **El fix**: el respaldo de Nombre+Apellidos ahora exige encontrar la
      etiqueta "Primer Apellido" primero (señal inequívoca de persona
      física) antes de intentar nada — así nunca se activa para persona
      moral. Encontré un SEGUNDO bug relacionado al probar más a fondo:
      incluso en persona física, si había un "Nombre Comercial" antes en
      el texto, el "Nombre" suelto tomaba ESE en vez del "Nombre (s)"
      real — corregido buscando el "Nombre" más CERCANO a "Primer
      Apellido" (no el primero del documento).
    - **Mejora adicional, no solo el fix mínimo**: agregué una nueva
      "Estrategia 2" — buscar hacia atrás directamente desde la propia
      etiqueta del nombre, sin necesitar la etiqueta del RFC como ancla —
      para cubrir documentos donde el RFC no se detecta o aparece
      DESPUÉS del nombre (la "estrategia principal" original solo
      funciona si el RFC aparece antes). Esto usa el mismo principio ya
      documentado en el código ("el valor va antes de su propia
      etiqueta"), solo que sin depender de una segunda etiqueta. Sin esta
      estrategia, el caso del bug reportado habría quedado en `null` en
      vez de encontrar la razón social real — lo confirmé probando antes
      y después de agregarla.
    - **Ambos tipos de persona siguen usando la MISMA función** (ya
      lo hacían, y sigue siendo así) — no se crearon rutas de código
      separadas ni un parámetro de "tipo de persona" para bifurcar la
      lógica; las reglas de posicionamiento son universales, y el único
      respaldo que SÍ es específico de un tipo (física) ahora se
      autodetecta correctamente en vez de asumirse.
    - **Pruebas**: 7 casos agregados a `verificar-mysql.js` (sin depender
      de MySQL, pero incluidos ahí para que "correr el script" siga
      cubriendo todo) — el caso exacto del bug reportado, la estrategia
      principal (moral), nombre largo partido en líneas (moral), los 3
      campos de física, física con "Nombre Comercial" de por medio, el
      caso original ya documentado en el código (ruido IdCIF), y un texto
      sin ningún campo reconocible (debe devolver `null`, nunca inventar
      un valor). Los 7 pasan.
    - Si esto vuelve a fallar con un PDF real específico, sigue aplicando
      la nota ya escrita en este mismo documento desde el principio: pedir
      el fragmento de texto exacto extraído de esa zona del PDF — no hay
      forma de ajustar esto a ciegas sin un ejemplo real, y adivinar
      arriesga romper lo que ya funciona para el otro tipo de persona.
31. **Segunda corrección al punto 30 — esta vez con datos reales del
    usuario, no una suposición mía.** El fix del punto 30 no resolvió el
    problema; el usuario reportó el resultado incorrecto EXACTO que
    seguía dando: `"VALIDA TU INFORMACIÓN FISCAL CONSTANCIA DE SITUACIÓN
    FISCAL Lugar y Fecha de Emisión"`, cuando debía ser `"AGILE
    DEVELOPMENT AND DESIGN + VALUE"`. Con ese dato concreto encontré dos
    causas reales, ninguna relacionada con "física vs. moral" en sí:
    1. **Encabezados del documento sin filtrar**: "Constancia de
       Situación Fiscal", "Lugar y Fecha de Emisión" y "Cédula de
       Identificación Fiscal" (el título del documento y encabezados
       fijos del SAT) no estaban en la lista `FRASES_INSTRUCCION` — así
       que cuando la razón social real no se lograba capturar (ver punto
       2), estas frases sí calificaban como "línea válida de nombre"
       (solo letras/espacios/acentos) y se colaban en su lugar.
    2. **El "+" no era un carácter permitido**: `PATRON_LINEA_DE_NOMBRE`
       no incluía `+`, y el nombre real reportado ("AGILE DEVELOPMENT AND
       DESIGN + VALUE") sí lo tiene — así que la línea con el nombre
       correcto se rechazaba por completo en cualquier estrategia,
       dejando que el encabezado del documento (causa 1) ganara por
       default.
    - **Honestidad sobre lo que sí y no pude verificar**: reconstruí DOS
      variantes sintéticas (RFC antes del nombre, y sin RFC antes — para
      forzar la Estrategia 2 del punto 30) usando las frases EXACTAS que
      el usuario reportó, y ambas reproducían el resultado incorrecto
      antes del fix y el correcto después. Pero no tengo el texto crudo
      completo extraído del PDF real — reconstruí el layout más plausible
      a partir del resultado final, no lo verifiqué contra el texto
      original línea por línea. Si el layout real es distinto en algún
      detalle que no cubrí, podría no estar 100% resuelto.
    - Agregué también `'datos de identificacion del contribuyente'` y
      `'datos de ubicacion'` a la lista de encabezados a ignorar —
      encabezados de sección típicos del mismo documento que no se habían
      reportado como problema todavía, pero es razonable esperar que
      causen el mismo tipo de falla si aparecen sueltos cerca de la
      etiqueta del nombre. Riesgo bajo: son frases muy específicas, poco
      probable que coincidan con una razón social real.
    - **Pruebas**: 3 casos nuevos agregados a `verificar-mysql.js`
      (además de los 7 del punto 30) usando las frases exactas
      reportadas — los dos layouts reconstruidos, y un caso "solo
      encabezado, sin nombre real en ningún lado" que confirma que ahora
      devuelve `null` en vez de inventar un valor con el encabezado. 10
      casos en total, todos pasan.
    - **Si esto sigue sin resolverse**: la próxima vez hace falta pedir
      el texto crudo completo extraído del PDF (no solo el resultado
      incorrecto) — con eso se puede reproducir con precisión exacta en
      vez de reconstruir el layout más probable a partir del síntoma.
32. **Tercera corrección — rediseño completo por instrucción explícita
    del usuario, no otra suposición mía.** El fix del punto 31 tampoco
    resolvió el problema. Esta vez el usuario no dio otro síntoma para
    reconstruir — dio la REGLA exacta a seguir: "el dato se encuentra
    después de Registro Federal de Contribuyentes y antes de Nombre,
    denominación o razón social... usa la misma regla tanto para persona
    física como moral, ubícalos entre esos dos textos, almacénalos sin
    saltos de línea". Implementé esa regla literalmente en vez de seguir
    afinando heurísticas de línea por línea.

    **Rediseño**: se eliminó por completo la validación de "qué caracteres
    se ven como un nombre" (`PATRON_LINEA_DE_NOMBRE`/
    `esLineaDeNombreValida`, ya código muerto, lo borré) — esa lista
    cerrada de caracteres permitidos fue la raíz del bug del "+" en el
    punto 31, y es un patrón de fragilidad recurrente (cualquier símbolo
    nuevo en un nombre real puede volver a romperlo). En su lugar, la
    nueva función `aplanarValorEntreEtiquetas()` toma TODO el bloque
    entre las dos etiquetas, descarta líneas que se sepa que son ruido
    (positivo: "esto sí es ruido conocido"), y une el resto sin saltos de
    línea — filtrando por lo que se CONOCE que es basura, no por una
    lista de lo que "parece" un nombre válido.

    **Bug que encontré y corregí YO MISMO antes de dar el cambio por
    bueno** (el usuario no lo reportó — lo até al correr mi propia batería
    de pruebas de los turnos 30-31 contra el código nuevo): al quitar la
    validación de caracteres, las etiquetas "Primer Apellido:"/"Segundo
    Apellido:" (que antes se descartaban porque el ":" no era un carácter
    permitido) empezaron a colarse en el resultado de persona física,
    duplicando apellidos y arrastrando el texto de la etiqueta misma.
    Corregido agregando esas etiquetas a `LINEAS_RUIDO`.

    **Segundo bug que encontré yo mismo, más sutil**: al aplicar la
    "regla explícita" (todo lo que hay entre dos límites) a los
    RESPALDOS (que solo tienen UN límite claro, no dos — ej. buscar hacia
    atrás desde la etiqueta del nombre sin el RFC como ancla), la función
    empezaba a arrastrar contenido de campos completamente no
    relacionados, porque ya no había ninguna condición de "parada" — solo
    filtraba ruido y unía todo el resto de una ventana de 10 líneas.
    Diseñé una segunda función, `aplanarConParadaEnRuido()`, que SÍ se
    detiene en la primera línea vacía/de ruido tras empezar a recolectar
    — usada solo en los respaldos, nunca en la estrategia principal
    (que sigue usando `aplanarValorEntreEtiquetas`, sin parada, porque ahí
    SÍ hay dos límites claros que acotan correctamente el bloque).

    **Tercer bug, el más sutil de los tres**: la primera versión de
    `aplanarConParadaEnRuido()` rompía 3 pruebas que ya pasaban, porque el
    bloque de texto justo antes de una etiqueta casi siempre trae una
    línea vacía pegada (por el propio salto de línea antes de la
    etiqueta) — y mi lógica de "parar en la primera línea vacía/ruido" se
    detenía ahí mismo, en la primera línea, sin llegar nunca al contenido
    real. Lo diagnostiqué imprimiendo el texto y las líneas exactas en
    vez de seguir razonando en abstracto — encontré la línea vacía
    sobrante de inmediato así. Arreglado con una fase de "saltar
    ruido/vacíos iniciales" ANTES de empezar a recolectar (mismo patrón
    de dos fases que ya tenía la función original `buscarValorMultilinea`
    de los turnos anteriores, que había perdido sin querer al reescribir
    todo de cero).

    **Pruebas**: batería completa de 14 casos (los 10 de los puntos 30-31
    más 2 nuevos de este turno — orden invertido de etiquetas, y un
    simulacro de documento completo combinando título + RFC + IdCIF +
    nombre con "+" + régimen/fecha/estatus después) corrida DESPUÉS de
    cada uno de los tres bugs que encontré, no solo al final — así fue
    como los atrapé a tiempo en vez de entregar otra regresión. Los 14
    pasan al final. Se agregaron los 2 casos nuevos a
    `verificar-mysql.js`.
33. **Validación: el RFC de la constancia debe coincidir con el RFC de la
    sesión/formulario (relación 1 a 1).** Pedido explícito, y NO otro bug
    de extracción — esta vez es una regla de negocio nueva: extraer
    también el RFC real impreso en el PDF y compararlo contra un RFC de
    referencia, rechazando la carga si no coinciden.
    - Nueva función `extraerRFC()` en `pdfExtract.js` — busca el patrón
      distintivo de un RFC (`AAAA######AAA`, 3-4 letras + 6 dígitos + 3
      alfanuméricos) primero en una ventana alrededor de la etiqueta
      "Registro Federal de Contribuyentes" (para no coincidir por error
      con otro texto parecido en el resto del documento), con respaldo de
      búsqueda global si no se encuentra ahí.
    - `POST /api/registro` es una ruta PÚBLICA (funciona con y sin sesión
      — ver `csf.html`), así que no podía usar `requireUserAuth` (que
      exige sesión y rechaza si no hay una). Se agregó
      `obtenerRfcSesionOpcional(req)` en `authUsuario.js` — mismo
      mecanismo de verificación de cookie que `requireUserAuth`, pero
      nunca bloquea: devuelve el RFC si hay sesión válida, o `null` si
      no. La sesión (si existe) tiene prioridad sobre el RFC del
      formulario como "RFC de referencia" — en la práctica ya coinciden
      de todas formas, porque el frontend bloquea el campo del formulario
      al RFC de la sesión cuando hay una.
    - **A diferencia de nombre/régimen/código postal (que son de mejor
      esfuerzo y NUNCA bloquean la carga), esta validación SÍ bloquea** —
      pero solo cuando AMBOS valores (el RFC de la constancia y el de
      referencia) se pudieron determinar y son distintos. Si falta
      cualquiera de los dos (acceso anónimo sin RFC en el formulario, o
      no se pudo leer el RFC del PDF), no hay nada que comparar y la
      carga continúa igual que antes — mismo principio de no castigar al
      usuario por una limitación de la extracción, aplicado aquí a una
      regla que sí puede bloquear en el caso positivo.
    - El mensaje de error incluye ambos RFC para que quede claro por qué
      se rechazó. No hizo falta tocar el frontend — `app.js` ya muestra
      cualquier `data.error` genérico vía `showToast()`, confirmé esto
      revisando el código antes de dar el trabajo por terminado en vez de
      asumirlo.
    - **Pruebas**: 10 casos (4 de `extraerRFC()`, 4 de la lógica de
      bloqueo/no-bloqueo, 2 de la detección de sesión opcional —
      incluyendo un token de sesión REAL creado con `crearTokenSesion()`,
      no solo simulado) agregados a `verificar-mysql.js`.
    - **Incidente operativo durante este turno**: el entorno de
      generación se reinició a la mitad del trabajo — `/home/claude/app`
      quedó completamente vacío entre dos llamadas a herramientas, sin
      ningún aviso previo. Se recuperó restaurando el `.zip` ya empaquetado
      del turno anterior (en `/mnt/user-data/outputs/`, que sí sobrevivió
      el reinicio) y reaplicando manualmente los cambios de este turno,
      que ya estaban diseñados y probados antes del reinicio (no hubo que
      resolver nada de nuevo, solo reconstruir mecánicamente). **Lección
      para el futuro**: si algo similar vuelve a pasar, revisar primero
      si `/mnt/user-data/outputs/` conserva un `.zip` reciente antes de
      asumir que hay que reconstruir todo desde el historial de la
      conversación — es mucho más confiable y rápido.
34. **"Tipo de pago" y "comentarios" (tickets) ahora configurables como
    obligatorio/opcional**, con la misma regla que ya usaba "uso_cfdi" —
    pedido explícito: "agrega los campos de tickets para colocar cuales
    son obligatorios y cuales no, como se hace en la regla de constancia
    de situación fiscal". Cambios:
    - `CAMPOS_CONFIGURABLES`/`DEFAULTS` en `config.js`: se agregaron
      `tipo_pago` y `comentarios`, ambos con default `false` (opcional,
      mismo comportamiento que ya tenían antes de este cambio).
    - `POST /api/tickets`: se agregaron los dos checks de obligatoriedad,
      mismo patrón que el check ya existente de `uso_cfdi`.
    - Frontend: se agregaron los checkboxes correspondientes en
      "Configuraciones globales", y se renombró el encabezado de esa
      tarjeta de "Configuración del formulario público" a "Campos
      obligatorios de los formularios" — ya no describe solo un
      formulario (ahora cubre constancia Y tickets), así que el nombre
      anterior había dejado de ser preciso.
    - `tickets.html`/`tickets.js`: se agregaron los atributos `id`/
      `data-field` a las marcas de "Tipo de pago" y "Comentarios" (antes
      eran "(opcional)" fijo, sin poder actualizarse dinámicamente según
      la configuración), más las variables de estado, la validación en el
      envío, y la aplicación del estado al cargar la configuración — mismo
      patrón que ya usaba `uso_cfdi`.
    - **Pruebas**: se completaron en este turno (habían quedado
      pendientes por una interrupción de herramientas la vez pasada) —
      6 casos de la lógica de validación en aislamiento, más pruebas
      reales contra MySQL de `setCamposObligatorios()`/
      `getCamposObligatorios()` guardando y leyendo ambos campos nuevos.
35. **Bug real corregido: login fallaba con "RFC o contraseña
    incorrectos" para cuentas administrador/fiscal con contraseña
    autogenerada.** Reportado por el usuario probando la funcionalidad de
    los puntos 26-29. La causa NO era la generación de la contraseña ni
    el hasheo (ambos correctos, confirmado con una simulación end-to-end
    real usando `hashPassword`/`verifyPassword`) — estaba en
    `POST /api/auth/login`: truncaba el campo de usuario a 13 caracteres
    (`sanitizeText(body.rfc, 13)`, el máximo de un RFC real) antes de
    comparar contra la base de datos. Cualquier cuenta administrador/
    fiscal con un nombre de usuario más largo que eso quedaba truncada
    ANTES de la comparación, así que nunca coincidía con el valor completo
    guardado — sin importar que la contraseña fuera perfectamente
    correcta. Una cuenta "cliente" normal (RFC real, siempre ≤13
    caracteres) nunca se vio afectada.
    - Encontré DOS problemas más relacionados al seguir investigando la
      misma ruta completa (no me quedé con el primer hallazgo): el input
      HTML de `login.html` tenía `maxlength="13"` — el navegador ni
      siquiera dejaba escribir un usuario más largo, sin importar lo que
      dijera el JS; y `validarRFC()` en `login.js` solo aceptaba el
      patrón exacto de un RFC real, rechazando cualquier nombre de
      usuario de administrador/fiscal del lado del cliente antes de
      siquiera enviarlo.
    - **Arreglo en los tres niveles**: `sanitizeText(body.rfc, 13)` →
      `sanitizeText(body.rfc, 50)` en el backend (mismo límite que ya
      usaba `POST /api/admin/usuarios`, consistente con el ancho real de
      la columna); `maxlength="13"` → `maxlength="50"` en el HTML; nueva
      función `validarUsuarioLogin()` en `login.js` que acepta RFC real O
      un nombre de usuario libre — **sin tocar** `validarRFC()`, que se
      dejó intacta y se sigue usando tal cual para el registro público
      (exclusivo de clientes con RFC real, no debía volverse permisivo).
    - También se amplió la etiqueta del campo de "RFC" a "RFC o usuario"
      en el formulario de login, para que no sea confuso para una cuenta
      administrador/fiscal.
    - **Verificación real antes de tocar código**: antes de asumir la
      causa, escribí una simulación end-to-end usando las funciones reales
      (`hashPassword`/`verifyPassword`) para 4 escenarios — cliente con
      RFC de 13 y de 12 caracteres (ambos funcionan, confirmando que el
      bug NO afecta clientes), administrador con usuario largo (falla,
      reproduciendo el bug exacto), y contraseña incorrecta como control
      negativo. Solo después de confirmar la causa con esta prueba
      implementé el fix.
    - **Pruebas de regresión reales contra MySQL** (no solo simuladas):
      crea una cuenta con un usuario de 47 caracteres, reproduce el bug
      exacto con el límite viejo (falla), confirma que funciona con el
      límite nuevo, prueba una contraseña realmente incorrecta como
      control negativo, y confirma por separado que una cuenta cliente
      normal (RFC de 12 caracteres) sigue funcionando sin cambios.
    - **Decisión de diseño que tomé y documento explícitamente**: no
      restringí `/api/auth/login` a que solo acepte perfil "cliente" (que
      habría sido otra forma válida de "arreglar" esto, symétrica con
      cómo el panel de administración excluye "cliente"). Decidí en
      cambio ampliar el límite para que CUALQUIER cuenta pueda iniciar
      sesión ahí con su usuario completo, porque el reporte era "no puedo
      entrar", no "quiero restringir el acceso" — agregar una restricción
      no pedida habría sido alcance extra no solicitado, y de paso más
      arriesgado (podría romper algo si alguna cuenta ya dependía de
      poder entrar por ahí).
36. **La factura de un ticket ahora solo se acepta como archivo `.zip`.**
    Pedido explícito: un CFDI real siempre se entrega como el par PDF +
    XML juntos, y un `<input type="file">` normal no permite adjuntar dos
    archivos a la vez — se piden comprimidos en un solo ZIP. Antes de
    este cambio, `uploadFactura` (multer) **no tenía ningún `fileFilter`
    en absoluto** — aceptaba cualquier tipo de archivo sin restricción.
    - Nuevo `esZipValido(buffer)` en `validate.js`, mismo patrón ya
      establecido para PDF/imágenes: acepta las tres firmas binarias
      reales de un ZIP (`PK\x03\x04` normal, `PK\x05\x06` vacío,
      `PK\x07\x08` dividido/spanned) — se aceptan las tres para no
      rechazar un ZIP real y válido por una variante poco común.
    - `uploadFactura` ahora tiene `fileFilter` (extensión `.zip` +
      MIME declarado) como primer filtro rápido, y el handler verifica el
      **contenido real** con `esZipValido()` después — mismo patrón de
      dos capas que ya usan la constancia (PDF) y los tickets (imagen):
      el filtro de multer es solo para una respuesta rápida con buena UX,
      la verificación de contenido es la que realmente importa, porque
      el MIME/extensión que declara el navegador se puede falsificar.
    - El archivo se guarda siempre con extensión `.zip` y
      `factura_mime = 'application/zip'` **fijos** — ya no se confía en
      `path.extname(req.file.originalname)` ni en `req.file.mimetype`
      (ninguno de los dos es contenido verificado) para decidir cómo
      se guarda, aunque ya se haya confirmado el contenido real arriba.
    - Frontend: `accept=".zip"` en el input + nota explicando el porqué
      (PDF+XML juntos), y una validación rápida de extensión del lado
      del cliente en `admin.js` (solo UX — la validación real y
      autoritativa sigue siendo la del backend).
    - **Retrocompatibilidad**: facturas subidas ANTES de este cambio (en
      PDF, JPG o PNG, que era lo que se aceptaba antes, sin ninguna
      restricción real) siguen intactas, visibles y descargables — el
      endpoint de descarga (`ticket.factura_mime || 'application/octet-stream'`)
      no cambió, así que sirve cualquier tipo ya guardado correctamente;
      la restricción nueva solo aplica a subidas/reemplazos nuevos.
    - **Pruebas**: 9 casos para `esZipValido()` en `verificar-mysql.js`
      (lógica pura, sin depender de MySQL, pero incluida ahí por el mismo
      motivo de siempre) — las tres firmas válidas, un PDF real rechazado
      aunque se le cambie la extensión a `.zip` (confirma que la
      verificación es de contenido, no de extensión), una imagen y texto
      plano rechazados, y los casos borde (buffer corto, vacío, `null`)
      sin lanzar error. Probé la lógica copiada directamente en un script
      aislado antes de integrarla (el paquete `validator` de npm no está
      instalado en este entorno, así que no pude requerir el módulo
      completo `validate.js` para probarlo — mismo patrón de prueba ya
      usado en turnos anteriores para casos similares).
37. **Dentro del ZIP de la factura, ahora también se valida que traiga un
    PDF y un XML** (no solo que el contenedor sea un ZIP válido, que ya
    se resolvió en el punto 36). Pedido explícito de seguimiento al mismo
    punto.
    - **Decisión de diseño clave**: implementé un lector del directorio
      central del formato ZIP directamente con `Buffer` (`encontrarEOCD`
      + `listarArchivosEnZip` en `validate.js`), en vez de agregar una
      librería de ZIP como dependencia nueva — el formato del directorio
      central es lo bastante simple (firmas fijas + campos de longitud
      variable) como para leerlo a mano, siguiendo el mismo estilo que ya
      usa este archivo para las firmas binarias de PDF/imagen. Solo LEE
      los nombres de archivo (no descomprime nada, no verifica CRC), que
      es todo lo que hace falta para esta validación.
    - `zipContienePdfYXml(buffer)` devuelve `{ tienePdf, tieneXml, valido }`
      — no solo un booleano — para poder darle al administrador un mensaje
      de error específico según qué es lo que falta, en vez de uno
      genérico.
    - **Cómo verifiqué el parser sin poder instalar dependencias en este
      entorno**: en vez de conformarme con probar solo mi propio código
      contra sí mismo, generé ZIPs REALES con la herramienta `zip` del
      sistema (que sí está disponible aquí — la misma que uso para
      empaquetar el `.zip` final de cada turno) y confirmé con `unzip -l`
      exactamente qué contenía cada uno antes de pasárselos a mi parser —
      PDF+XML juntos, solo uno de los dos, con un archivo extra, dentro de
      una carpeta, y un ZIP realmente vacío. Los 6 casos coincidieron
      exactamente con lo que reportaba `unzip -l` como verdad de
      referencia. También probé un ZIP truncado a la mitad (sin EOCD) y
      confirmé que no lanza error, solo devuelve una lista vacía.
    - **Para las pruebas en `verificar-mysql.js`** (que corre en el
      entorno real del usuario, no en este sandbox), no quise depender de
      que la herramienta `zip` esté instalada en esa máquina — así que
      escribí un `construirZipDePrueba(nombresArchivos)` que arma un ZIP
      mínimo válido directamente en JavaScript (método "stored", sin
      comprimir nada, con CRC en 0 — el parser no valida el CRC, así que
      no hace falta contenido real ni compresión de verdad). Verifiqué
      ese constructor también con el `zip`/`unzip` real del sistema antes
      de confiar en él para las pruebas — generó un ZIP que `unzip -l`
      reconoce perfectamente.
    - 8 casos agregados al bloque de pruebas de ZIP ya existente: PDF+XML
      (válido), solo PDF, solo XML, con archivo extra no relacionado (no
      debe afectar), dentro de una carpeta (ruta con "/"), ZIP realmente
      vacío, ZIP con solo un archivo no relacionado, y extensiones en
      mayúsculas (`.PDF`/`.XML`, confirma que la comparación no distingue
      mayúsculas/minúsculas).
    - El mensaje de error en `POST /api/admin/tickets/:id/factura` es
      específico según qué falta ("no se encontró ningún PDF", "ningún
      XML", o "ni PDF ni XML"), no un mensaje genérico de "ZIP inválido".
38. **Funcionalidad grande y nueva: "Orden de compra" (nuevo segmento del
    admin) + IVA y zona horaria configurables.** Pedido explícito con
    varias partes que dependen entre sí: la zona horaria es "crucial"
    para auto-generar la fecha de la orden, y el IVA de configuración
    global alimenta el cálculo del total — así que se implementaron
    juntos, en el orden que el propio pedido sugería.

    **Base de datos**: tabla nueva `ordenes_compra` (fecha_compra,
    concepto, cantidad, iva_porcentaje, total, email, con `eliminado_en`
    ya incluido desde el principio por si se agrega borrado lógico
    después, aunque no se pidió todavía). `CHECK` constraints:
    `cantidad > 0` e `iva_porcentaje` entre 0 y 100 — la misma validación
    que ya existe en la app, pero también a nivel de base de datos, como
    ya es la convención en este proyecto (ver tickets.tipo_pago,
    usuarios.perfil).

    **Configuración global (IVA + zona horaria)** en `config.js`, mismo
    patrón que `campos_obligatorios` (JSON bajo una clave en la tabla
    `configuracion`):
    - `ZONAS_HORARIAS_MEXICO`: catálogo fijo de 11 identificadores IANA
      reales (no texto libre) — Ciudad de México, Monterrey, Matamoros,
      Mérida, Cancún, Chihuahua, Ojinaga, Mazatlán, Bahía de Banderas,
      Hermosillo (sin horario de verano) y Tijuana. Cubre las distintas
      zonas horarias que reconoce la Ley de Husos Horarios de México.
    - `formatearFechaHoraMexico(fecha, zona)`: usa `Intl.DateTimeFormat`
      (integrado en Node, sin dependencias nuevas) para dar formato
      `dd/mmm/aaaa` (mes abreviado en español, sin punto) y `HH:mm:ss`
      (24 horas). Usé `hourCycle: 'h23'` en vez de `hour12: false` a
      propósito — evita un bug conocido de algunos motores ICU donde la
      medianoche se muestra como "24:00:00" en vez de "00:00:00"; lo
      confirmé con una prueba específica de medianoche antes de dar la
      función por buena, no solo de memoria.
    - Probé la función con 5 casos ANTES de integrarla al resto del
      código: formato correcto, que dos zonas horarias distintas sí den
      horas distintas (confirma que de verdad usa la zona horaria, no
      solo la ignora), que una zona horaria inválida no lance error (cae
      al default), y el caso de medianoche ya mencionado.

    **Backend (`server.js`)**: endpoints de configuración
    (`GET`/`PUT /api/admin/config/global`,
    `GET /api/admin/config/zonas-horarias`), de apoyo
    (`GET /api/admin/correos-registrados` — correos distintos de
    constancias activas, para el desplegable) y de la orden en sí
    (`POST`/`GET /api/admin/ordenes-compra`).
    - El IVA se **"fotografía"** en cada orden al crearla (se guarda el
      valor usado, no una referencia al valor global) — decisión
      deliberada, mismo principio ya usado para el correo de invitación
      y otros "snapshots" en este proyecto: un cambio futuro al IVA
      global no debe alterar retroactivamente órdenes ya creadas. Lo
      verifiqué explícitamente en las pruebas (ver abajo), no solo lo
      asumí por diseño.
    - El correo del desplegable se revalida en el backend contra
      `registros.email` (con `eliminado_en IS NULL`) — nunca se confía
      en que el navegador solo mande una opción que sí estaba en el
      desplegable.
    - **Bug propio que encontré y corregí antes de que llegara a
      producción**: un `str_replace` al insertar el nuevo bloque de
      endpoints borró accidentalmente el comentario de encabezado
      `// ---------- Administración de tickets ----------` que seguía
      justo después. Lo detecté revisando el resultado con `grep`
      inmediatamente después del cambio (no asumí que el reemplazo había
      salido bien) y lo corregí antes de seguir — mencionado aquí porque
      es exactamente el tipo de error silencioso que un `str_replace`
      mal delimitado puede introducir sin que la sintaxis del archivo se
      vea afectada (`node --check` sigue pasando aunque falte un
      comentario).

    **Frontend**: botón "Orden de compra" junto a "Tickets" en la barra
    de vistas del admin. La vista tiene el formulario (fecha auto-generada
    mostrada como texto informativo, no editable; concepto con contador
    de caracteres en vivo; cantidad; IVA de solo lectura tomado de la
    configuración; total con vista previa en vivo mientras se captura la
    cantidad, con la nota "esta es la cantidad que se va a facturar";
    correo por desplegable) y una tabla con las órdenes ya registradas
    debajo. En "Configuraciones globales" se agregó una tarjeta plegable
    más para IVA (número, 0-100) y zona horaria (desplegable poblado
    desde el catálogo del backend).
    - La tarjeta del formulario de la orden reutiliza la clase
      `.admin-config-card` (mismo fondo/borde/sombra que las tarjetas
      plegables) pero SIN el botón de plegar, ya que es el propósito
      principal de esa pantalla — se agregó una clase nueva
      (`.orden-form-body`) en vez de forzar el patrón plegable a un caso
      donde no aplica.
    - Verifiqué visualmente el formulario renderizado (mismo método de
      turnos anteriores: `wkhtmltoimage` + muestreo de píxeles, ya que el
      visor de imágenes de este entorno no mostró el archivo) — confirmé
      que el botón primario, el total destacado y el campo de fecha
      auto-generada tienen los colores de fondo esperados antes de dar el
      formulario por terminado.

    **Pruebas**: extendí `verificar-mysql.js` con dos bloques nuevos —
    configuración global (guardar/leer, rechazo de IVA fuera de rango,
    rechazo de zona horaria fuera del catálogo, formato de fecha/hora) y
    el flujo completo de una orden de compra con un registro de prueba
    dedicado (correo aparece en el desplegable, cálculo del total exacto,
    inserción y consulta, **la prueba explícita de que el IVA guardado no
    cambia si el IVA global cambia después**, y el rechazo a nivel de
    base de datos de cantidad negativa e IVA fuera de rango). **Encontré
    y corregí un error en mi propia prueba** antes de darla por buena: usé
    `nombre_razon_social` como nombre de columna en el INSERT de prueba,
    cuando la columna real en `registros` se llama solo `nombre` — lo
    detecté revisando el esquema real en `db.js` en vez de asumir el
    nombre de la columna de memoria.
39. **Se quitó del README toda la documentación de migración desde
    SQLite** (pedido explícito: "se queda como base MySQL"). Se eliminó
    la sección completa "🔁 Migrar datos desde SQLite", el aviso al
    inicio del documento que anunciaba el cambio de motor con enlace a
    esa sección, el enlace roto que quedaba en la nota de
    retrocompatibilidad de PDF/JPG/PNG, y la línea del árbol de archivos
    que mencionaba `scripts/migrar-sqlite-a-mysql.js`. Se dejaron intactas
    las (pocas) menciones de "SQLite" que son solo comparaciones técnicas
    de contexto (ej. "MySQL, a diferencia de SQLite, sí soporta múltiples
    conexiones concurrentes...") — esas no son parte de una instrucción de
    migración, así que no aplicaba quitarlas.
    - **Alcance deliberadamente limitado a la documentación**: el pedido
      fue específicamente "elimina del readme", así que el script
      `backend/scripts/migrar-sqlite-a-mysql.js` en sí NO se borró del
      proyecto — sigue existiendo como utilidad, solo que ya no aparece
      documentado en el README. Si en algún momento se quiere borrar
      también el archivo (no solo la mención), eso sería una decisión
      aparte, no incluida en este cambio.
40. **Orden de compra: formulario y lista lado a lado en pantallas
    anchas**, en vez de apiladas verticalmente. Pedido explícito de UX:
    antes había que desplazarse hasta abajo para ver la lista después de
    llenar el formulario.
    - Nuevo contenedor `.orden-compra-layout` (CSS Grid,
      `minmax(300px, 380px) 1fr`) envolviendo la tarjeta del formulario y
      una nueva columna para la lista — el formulario tiene ancho fijo
      (pocos campos, no necesita más espacio), la lista toma el resto
      (la tabla tiene 6 columnas, sí lo necesita).
    - **Decisión de UX agregada, no solo lo mínimo pedido**: el formulario
      queda con `position: sticky` mientras se hace scroll por una lista
      larga de órdenes — así se puede registrar varias órdenes seguidas
      sin tener que volver a subir manualmente cada vez.
    - Se agregó un encabezado "Órdenes registradas" a la columna de la
      lista (antes no tenía título propio, ya que visualmente quedaba
      claro por estar justo debajo del formulario — al ponerla al lado,
      sí hacía falta un título para que la columna se entienda por sí
      sola).
    - **Responsivo**: por debajo de 900px de ancho (breakpoint elegido
      porque una tabla de 6 columnas no cabe razonablemente al lado de un
      formulario en una pantalla más angosta que eso — consistente con
      cómo ya se decidieron otros breakpoints de este mismo archivo CSS),
      se colapsa a una sola columna, formulario primero.
    - **Verificación visual**: rendericé la vista a 1100px (ancho típico
      de escritorio) y confirmé por muestreo de píxeles que había
      contenido en la mitad izquierda Y en la mitad derecha de la imagen
      dentro del mismo rango vertical temprano — si siguiera apilado, la
      mitad derecha estaría vacía ahí, ya que la tabla solo aparecería
      mucho más abajo, después de todo el formulario. También intenté
      verificar el colapso a una columna en 700px con el mismo método,
      pero el resultado no fue concluyente (un formulario de una sola
      columna también ocupa ambas mitades de la imagen, así que esa
      prueba en particular no distingue entre los dos casos) — no forcé
      una conclusión con una prueba que no la sustentaba; en su lugar, me
      apoyé en que la regla CSS en sí (`@media (max-width: 900px)`) es un
      patrón estándar ya usado y probado varias veces en este mismo
      archivo, sin lógica personalizada de por medio que pudiera fallar
      de forma sutil (a diferencia de, por ejemplo, el parser de ZIP o el
      formateo de zona horaria de turnos anteriores, que sí ameritaban
      pruebas exhaustivas por ser lógica propia).
41. **Correo electrónico obligatorio en el registro público de
    `login.html`**, usando la MISMA columna y validación que ya usa el
    alta de usuarios desde el admin (`usuarios.email`, `isValidEmail`).
    Pedido explícito: "este campo debe ser el mismo que usa en el
    administrador en la gestión de usuarios" — no se creó un campo o una
    columna nueva, se reutilizó exactamente la que ya existía desde el
    punto 27 (invitación al crear usuario desde el panel).
    - Se quitó la nota "tu correo se captura después, al subir tu
      constancia" del subtítulo del formulario — ya no es cierta, el
      correo ahora se pide en el registro mismo.
    - Frontend (`login.js`): se agregó `validarEmail()` con el MISMO
      patrón de regex ya usado en `app.js` (constancia) — se repite el
      código en vez de compartir un archivo porque cada página HTML se
      sirve de forma independiente, sin un bundler que junte módulos
      comunes entre páginas (arquitectura ya establecida en todo este
      proyecto, no es una decisión nueva de este punto).
    - Backend (`server.js`, `POST /api/auth/registro`): el correo ahora
      es obligatorio y se valida con `isValidEmail()` — exactamente la
      misma función que ya usa `POST /api/admin/usuarios`. **A propósito
      NO se agregó una restricción de unicidad sobre el correo** — el
      alta desde el panel tampoco la tiene (solo el RFC es `UNIQUE`), así
      que agregarla aquí habría hecho que ambos caminos para crear una
      cuenta de cliente se comportaran de forma distinta entre sí, en vez
      de coherente.
    - **Pruebas**: agregué un caso a `verificar-mysql.js` que reproduce
      el INSERT que ahora hace `POST /api/auth/registro` (con correo) y
      confirma que queda en la misma columna que ya prueba el caso de
      "alta con correo" del panel (punto 27), y que el perfil por defecto
      sigue siendo "cliente" sin que agregar el correo lo haya alterado.
42. **Reporte de "no veo el campo de correo" + simplificar el login a
    solo RFC.**
    - **Primero verifiqué que el punto 41 sí estuviera aplicado**, antes
      de asumir que hacía falta corregir algo: confirmé con `grep` que
      `registro-email` existe tanto en el proyecto en disco como DENTRO
      del `.zip` ya entregado previamente (los descomprimí a una carpeta
      aparte para comparar), y descarté que hubiera CSS o JS ocultando el
      campo (nada con `display: none` ni lógica condicional relacionada).
      Con el código confirmado correcto en el propio entregable, la
      explicación más probable es una construcción vieja del contenedor
      Docker sin `--build`, o caché del navegador — se lo expliqué al
      usuario en vez de "arreglar" código que ya estaba bien.
    - **Login solo por RFC**: se quitó la flexibilidad de aceptar también
      un nombre de usuario libre en `login.html` — pedido explícito
      ("solo se puede acceder por RFC"). Esto **revierte parcialmente**
      una decisión de un punto anterior (34/35: ampliar el login para que
      cuentas administrador/fiscal pudieran entrar también por esta
      pantalla) — decisión consciente, no un descuido: `/admin` (HTTP
      Basic Auth) sigue siendo su acceso previsto y no se tocó, así que
      esas cuentas no se quedan sin poder entrar, solo se les deja de
      ofrecer una ruta alterna por el portal de clientes que nunca fue
      su acceso principal.
    - Se quitó `validarUsuarioLogin()` de `login.js` (quedaba como código
      muerto tras el cambio) y se volvió a usar `validarRFC()` para el
      login, con el mensaje de error correspondiente. Se redujo
      `maxlength` del campo de 50 a 13 (el máximo real de un RFC), para
      que coincida con lo que el campo ahora sí acepta.
    - **A propósito NO se revirtió** el límite de 50 caracteres en el
      backend (`POST /api/auth/login`) — dejarlo así es inofensivo (no
      obliga a nadie a usar un valor no-RFC, solo evita truncar lo que
      sea que llegue) y evita reabrir el bug original del punto 35 para
      cualquier otro cliente que hable directo con la API en vez de pasar
      por este formulario. Se actualizó el comentario del endpoint para
      explicar esta distinción entre "qué acepta el backend" y "qué deja
      capturar el formulario público" en vez de dejar un comentario
      desactualizado.
43. **Orden de compra: al seleccionar el correo, se muestran RFC y
    nombre/razón social asociados, de solo lectura.** Pedido explícito
    como medida de confirmación, no un campo capturable.
    - Backend: se simplificó y enriqueció `GET /api/admin/correos-registrados`
      — antes hacía `SELECT DISTINCT email` y devolvía solo un arreglo de
      strings; ahora hace `SELECT email, rfc, nombre` (sin `DISTINCT`,
      innecesario porque `registros.email` ya es `UNIQUE`) y devuelve
      objetos completos. Es un cambio de forma de la respuesta, así que
      también actualicé el frontend que la consume para no dejarlo
      esperando el formato viejo.
    - Frontend: se guarda la lista completa en una caché de módulo
      (`correosRegistradosCache`) al cargar el desplegable, para no tener
      que pedirle al servidor los datos de nuevo cada vez que cambia la
      selección — un simple `.find()` local basta. El bloque de RFC/nombre
      empieza oculto (`hidden`) y solo aparece cuando hay una selección
      válida; se oculta de nuevo si se deja en blanco o si el formulario
      se limpia tras registrar una orden.
    - Maneja el caso borde de un registro cuyo nombre no se pudo extraer
      del PDF (`nombre = ''`, ver la extracción de mejor esfuerzo de
      turnos anteriores) — se muestra "—" en vez de dejar el texto vacío,
      mismo criterio ya usado en el resto del panel para datos faltantes.
    - **Pruebas**: extendí el bloque ya existente del flujo de orden de
      compra en `verificar-mysql.js` para confirmar que el RFC y el
      nombre que trae la fila de `registros` coinciden exactamente con
      los que se insertaron en el registro de prueba.
    - **Verificación visual**: renderizé el bloque de solo lectura con
      `wkhtmltoimage` y confirmé por muestreo de píxeles que el color de
      fondo esperado (el mismo que ya usan los demás campos automáticos
      de esta pantalla — fecha, IVA) está presente.
44. **Editar usuarios desde el admin.** Pedido explícito: agregar la
    opción de editar en la gestión de usuarios.
    - Backend: `PUT /api/admin/usuarios/:id`, reutilizando LITERALMENTE
      las mismas reglas de validación que ya usa
      `POST /api/admin/usuarios` (perfil válido, RFC/nombre de usuario
      según el perfil, teléfono obligatorio solo para cliente, correo
      obligatorio y válido) — copiado a propósito en vez de intentar
      compartir una función entre ambos endpoints, para no acoplar dos
      rutas que además difieren en un punto importante (edición no toca
      contraseña, no envía invitación).
    - La contraseña **no se toca desde este endpoint** — se mantiene
      separado del flujo ya existente de "Restablecer contraseña", para
      no mezclar dos responsabilidades distintas en un mismo formulario.
    - **Protección nueva, mismo espíritu que ya protege la eliminación**:
      un administrador no puede bajar su propio perfil a "cliente"
      mientras tiene la sesión iniciada con esa cuenta (perdería el
      acceso al panel a mitad de sesión) — comparando `req.adminUser`
      contra el RFC de la cuenta que se está editando, igual que ya hace
      `DELETE /api/admin/usuarios/:id`. Sí puede editar sus propios datos
      sin tocar el perfil, y sí puede bajar el perfil de OTRAS cuentas
      administrador/fiscal libremente — la protección es específica a
      "te vas a quitar el acceso a ti mismo", no una regla general contra
      bajar perfiles.
    - **Decisión que dejé fuera a propósito, no un olvido**: no protegí
      contra que un administrador cambie su PROPIO RFC/nombre de usuario
      mientras tiene la sesión iniciada — a diferencia del perfil, esto
      no bloquea el acceso de inmediato (HTTP Basic Auth no tiene sesión
      server-side; el navegador seguiría mandando las credenciales viejas
      hasta que falle una petición y vuelva a pedirlas), así que el
      "riesgo" es más una molestia menor (tener que volver a escribir la
      contraseña) que un bloqueo real como el de bajar el propio perfil.
    - Frontend: modal "Editar usuario" — mismos campos que "Crear
      usuario" (perfil, RFC/nombre de usuario, correo, teléfono) con el
      mismo comportamiento dinámico de etiqueta/placeholder según el
      perfil elegido, pero SIN campos de contraseña. Prellenado con los
      datos actuales de la fila al abrirse. Botón "Editar" nuevo en cada
      fila de la tabla, antes de "Restablecer contraseña".
    - **Pruebas**: probé la lógica de validación completa en aislamiento
      (6 casos, incluyendo dos intentos fallidos de construcción de
      prueba que corregí al revisar por qué fallaban — el primer intento
      no aislaba correctamente la protección de auto-degradación del
      chequeo de formato de RFC, ambos aplican en cascada en el código
      real también). Extendí `verificar-mysql.js` con el flujo completo
      contra MySQL real: UPDATE de correo/teléfono, detección de conflicto
      de RFC con otra cuenta existente, y los tres casos de la protección
      de auto-degradación.
    - **Verificación visual**: renderizé el modal completo con
      `wkhtmltoimage` y confirmé por muestreo de píxeles que el botón
      primario "Guardar cambios" tiene el color esperado.
45. **Cabeceras ajustables (mostrar/ocultar columnas + redimensionar) en
    "Órdenes registradas"**, igual que ya existía en "Registros
    recibidos". Pedido explícito: replicar una funcionalidad ya
    existente en otra tabla.
    - **Decisión de refactor, no solo copiar y pegar**: la lógica
      original estaba escrita directamente contra los elementos de la
      tabla de Constancias (`els.tableWrap`, `els.btnColumns`, etc.) — son
      ~90 líneas entre mostrar/ocultar columnas, posicionar el panel
      dentro de la pantalla, y arrastrar para redimensionar (con soporte
      táctil). En vez de duplicar todo ese bloque con nombres
      renombrados (que habría dejado dos copias casi idénticas para
      mantener sincronizadas a futuro), lo extraje a una función
      reutilizable `crearControladorColumnas(config)` que recibe sus
      propios elementos, lista de columnas y claves de `localStorage` —
      la tabla de Constancias se refactorizó para usar la misma función
      (en vez de dejarla con su código viejo y solo la de Órdenes con el
      nuevo), así ambas comparten una sola implementación mantenida en un
      solo lugar.
    - Columnas de Órdenes: Fecha, Concepto, Cantidad, IVA, Total, Correo
      — mismo patrón HTML (`data-col` + `<span class="col-resizer">` en
      cada `<th>`, `data-col` también en cada `<td>` correspondiente).
    - Preferencias guardadas por separado de Constancias
      (`admin_ordenes_columnas_visibles` /
      `admin_ordenes_anchos_columnas`, distintas de
      `admin_columnas_visibles` / `admin_anchos_columnas`) — ajustar una
      tabla no afecta a la otra.
    - **Bug de especificidad CSS que encontré y corregí antes de
      terminar**: la regla `.admin-table th:last-child { width: 210px;
      }` existía para fijar el ancho de la columna de acciones al final
      de la tabla de Constancias (un `<th></th>` vacío) — pero la tabla
      de Órdenes no tiene columna de acciones, así que su ÚLTIMA columna
      real ("Correo") heredaba ese mismo ancho de 210px en vez de los
      190px que ya tenía definidos explícitamente, por tener la misma
      especificidad CSS y venir declarada después. Corregido con una
      regla más específica (`.ordenes-table th:last-child { width:
      190px; }`) que solo aplica a esa tabla.
    - **Bug propio que encontré y corregí al revisar mi propio diff**: al
      extraer la función reutilizable, el `showDashboard()` que inicializa
      las preferencias guardadas al iniciar sesión seguía llamando a las
      funciones viejas por su nombre corto (`aplicarColumnasVisibles(...)`
      en vez de `controladorColumnasConstancias.aplicarColumnasVisibles(...)`)
      — ya no existían como funciones sueltas tras moverlas dentro de la
      fábrica. Lo detecté con `grep` buscando referencias a los nombres
      viejos después del refactor, no solo confiando en que `node --check`
      (que no habría detectado este error, ya que sigue siendo JS
      sintácticamente válido — solo fallaría en tiempo de ejecución en el
      navegador) lo hubiera atrapado.
    - **Pruebas**: verifiqué en aislamiento que las 4 claves de
      `localStorage` de ambas tablas son todas distintas entre sí (no se
      pisan), que la única columna compartida entre ambos catálogos
      ("correo") es segura porque cada tabla tiene su propio elemento
      contenedor como ancestro CSS, y la lógica de "visible por defecto"
      del selector de columnas.
    - **Verificación visual**: renderizé la tabla de Órdenes con el botón
      "Columnas" y los tiradores de redimensión con `wkhtmltoimage` para
      confirmar que el HTML/CSS nuevo no tiene errores visuales obvios.
46. **"Configuraciones globales" reorganizada estilo dashboard.** Pedido
    explícito: las tres tarjetas (Campos obligatorios, IVA y zona
    horaria, Correo SMTP) ocupaban todo el ancho una debajo de otra,
    incluso las dos más simples/compactas.
    - Envolví las tres en un nuevo contenedor `.config-dashboard-grid`
      (CSS Grid, `repeat(2, 1fr)`, con `@media (max-width: 760px)`
      colapsando a una columna). "Campos obligatorios" e "IVA y zona
      horaria" quedan lado a lado en pantallas anchas; "Correo SMTP" se
      marca con una clase `.config-card-full-width`
      (`grid-column: 1 / -1`) para seguir ocupando todo el ancho, ya que
      tiene mucho más contenido (7+ campos, más dos sub-secciones
      anidadas: plantilla del correo al cliente, y enviar prueba) — meterla
      en una columna angosta se habría visto apretado en vez de mejorar
      el aprovechamiento del espacio.
    - Cambio puramente de HTML/CSS: los tres botones de plegar/desplegar
      (`btn-toggle-config`, `btn-toggle-global-config`, `btn-toggle-smtp`)
      y el resto de la lógica en `admin.js` no se tocaron — siguen
      referenciando los mismos ids de siempre, solo ahora viven dentro
      de un contenedor de cuadrícula en vez de directamente en la vista.
    - Anulé el `margin-bottom` individual de cada tarjeta dentro de la
      cuadrícula (el espaciado entre tarjetas ahora lo da el `gap` del
      grid) para no terminar con un espacio doble entre ellas.
    - **Hallazgo importante de esta sesión, documentado para no repetir
      el error**: intenté verificar el layout de cuadrícula con
      `wkhtmltoimage` (el método ya usado en turnos anteriores para
      verificación visual) renderizando a 1100px y 600px de ancho para
      comparar — ambos dieron la MISMA altura total, lo cual no tenía
      sentido si el grid en verdad colapsaba a una columna en el angosto.
      Antes de concluir que el CSS estaba mal, hice una prueba mínima
      aislada (un `display: grid` con dos `<div>` de 50px cada uno) y
      confirmé que el resultado se apiló (altura ~100px) en vez de
      quedar lado a lado (~50px) — **`wkhtmltoimage` en este entorno NO
      soporta CSS Grid** (es un motor WebKit muy antiguo, sin soporte
      moderno). Esto invalida cualquier verificación visual de layouts
      basados en `display: grid` hecha con esta herramienta en turnos
      anteriores también (ej. el de "Orden de compra" lado a lado) — en
      esos casos usé un método de verificación distinto (muestreo de
      píxeles en dos mitades) que no dependía de que el Grid se
      renderizara correctamente, así que esos resultados siguen siendo
      válidos, pero para ESTE cambio no había una forma confiable de
      verificar visualmente con las herramientas de este entorno. Me
      apoyé en cambio en que la sintaxis CSS usada (`display: grid`,
      `grid-template-columns`, `@media`) es estándar, bien soportada en
      cualquier navegador real, y sin lógica personalizada de por medio
      que pudiera fallar de forma sutil — mismo criterio que ya usé para
      el `@media (max-width: 900px)` de "Orden de compra".
47. **"No. Compra" (identificador único) + correo de confirmación con
    diseño de ticket, enviado al registrar una orden de compra.** Pedido
    grande con varias partes explícitas: campo identificador nuevo,
    correo automático con todos los datos + URL de login auto-detectada
    + mensaje cordial explicando los siguientes pasos, diseño tipo ticket
    físico, y un logo parametrizado (simple por ahora).

    **"No. Compra"**: columna `numero_compra` nueva en `ordenes_compra`
    (`UNIQUE`, `NOT NULL`), con migración segura para instalaciones que
    ya tuvieran la tabla de un turno anterior (se agrega nullable,
    se rellenan las filas existentes con un valor generado a partir de su
    propio id, y solo entonces se vuelve `NOT NULL` + `UNIQUE` — en ese
    orden, para nunca dejar una columna obligatoria sin valor a mitad de
    la migración). Se genera con el mismo patrón de dos pasos que ya usa
    el folio de tickets: insertar con un valor temporal ("TEMP"), generar
    el número real a partir del id autoincremental (`generarNumeroCompra()`,
    formato `OC-000001`), y actualizar la fila.

    **Correo con diseño de ticket**: hasta ahora todos los correos de
    esta app eran de texto plano — se amplió `enviarCorreo()` en
    `utils/email.js` para aceptar un `html` opcional, siempre junto con
    la versión de texto (nunca solo HTML, por accesibilidad y
    entregabilidad — un cliente de correo sin soporte de HTML, o con el
    filtro de spam más estricto, necesita esa parte de texto plano).
    - El HTML usa **tablas con estilos inline** (no CSS moderno como
      flexbox/grid) — es el estándar real para HTML de correos, ya que
      muchos clientes (sobre todo Outlook de escritorio) tienen soporte
      muy limitado de CSS moderno, a diferencia de un navegador normal.
    - Diseño: bordes punteados (`border: 1px dashed`) simulando el
      recibo, montos en fuente monoespaciada (`Courier New`), el total
      destacado con más tamaño/color, separadores punteados entre
      secciones — pensado para que se identifique de un vistazo como un
      comprobante.
    - El mensaje cordial explica: que con esos datos ya puede solicitar
      su factura, que guarde el correo (foto o captura), y que **además**
      de esos datos se le pedirá la imagen del ticket de compra al
      solicitarla en el portal — tal como se pidió explícitamente.
    - El botón de acceso usa `detectarUrlPortal(req)` (ya existente desde
      turnos anteriores) + `/login` — mismo mecanismo de auto-detección
      de URL que ya usan la invitación al crear usuario y el aviso de
      nuevo ticket al contador, así que "calcúlala automáticamente" ya
      estaba resuelto de antes; solo hacía falta reutilizarlo aquí.
    - **Seguridad**: agregué `escapeHtmlCorreo()` para escapar el
      concepto y el correo antes de insertarlos en el HTML — ambos datos
      vienen de lo que captura el administrador, así que sin escapar
      podrían romper el HTML del correo o (en el peor caso) inyectar
      contenido. Lo probé explícitamente con un concepto que incluía
      `<script>` y `&` antes de dar la función por buena.

    **Logo parametrizado**: se agregó `logo_url` a la configuración
    global (`null` por defecto) — el campo y la lógica para usarlo
    (`logoTicketHtml()`) ya existen y están listos, pero **a propósito
    no se agregó una pantalla en el panel para configurarlo todavía**
    (tal como se pidió: "esta función la llenaremos después"). Mientras
    tanto, sin logo configurado, se genera un logo de texto simple
    ("ADDV" en una caja de color) directamente en código — no depende de
    alojar ni servir ninguna imagen, así que funciona sin configuración
    adicional de ningún tipo.

    **Pruebas**: probé en aislamiento (7 casos) la construcción del
    correo — incluyendo el escape de HTML mencionado arriba, que un
    concepto con `<script>` no rompe el HTML pero sí se preserva tal
    cual en la versión de texto plano (donde no aplica el escape, ya que
    ahí no se interpreta como HTML — encontré y corregí una prueba mía
    mal planteada que asumía lo contrario), que sin `urlPortal` detectado
    se omite el botón en vez de dejar un enlace roto, y que el logo
    cambia correctamente entre el generado por código y uno real si se
    configura `logoUrl`. Extendí el bloque de "Órdenes de compra" en
    `verificar-mysql.js` con el flujo completo del número de compra
    (formato, relleno de ceros, persistencia tras el UPDATE, rechazo de
    un número repetido) y con `logo_url` (valor por defecto, guardar uno
    válido, y que un valor vacío lo deje en `null` de nuevo) — tuve que
    corregir también los dos INSERT de prueba que ya existían de un turno
    anterior para las pruebas de `CHECK`, ya que ahora `numero_compra` es
    `NOT NULL` y esos INSERT no lo incluían.

    **Verificación visual**: a diferencia del cambio anterior (la
    cuadrícula de "Configuraciones globales", donde `wkhtmltoimage`
    resultó no soportar CSS Grid), este correo usa tablas con estilos
    inline — un patrón mucho más antiguo y universalmente soportado —
    así que sí pude verificar con confianza: generé el HTML real con los
    mismos datos de prueba, lo rendericé, y confirmé por muestreo de
    píxeles que el logo (arriba), el botón de acceso (más abajo) y el
    texto destacado del total aparecen con los colores esperados en las
    posiciones esperadas.
48. **`tickets.html` ahora exige verificar la compra (No. Compra, Fecha,
    Hora, Total) contra una orden de compra real antes de aceptar el
    ticket.** Pedido con varias partes explícitas: mismos formatos y
    validaciones que "Orden de compra", los cuatro obligatorios,
    reacomodo con buenas prácticas UX/UI y responsivo, y una validación
    cruzada contra `ordenes_compra` con un mensaje de error específico.

    **Campos nuevos** en una caja destacada "Verifica tu compra", antes
    de los campos ya existentes (Uso de CFDI, tipo de pago, comentarios)
    — en una cuadrícula de dos columnas (No. Compra + Total, Fecha +
    Hora), agrupando los pares que conceptualmente van juntos en vez de
    apilar los cuatro uno debajo del otro (mejor uso del espacio, ya que
    son valores cortos) — colapsa a una columna por debajo de 360px de
    ancho, donde dos columnas dejarían muy poco espacio para escribir
    "OC-000001" o "24/jul/2026" cómodamente.

    **Validación (backend, autoritativa)** en `POST /api/tickets`:
    - Formato exigido, MISMAS reglas que ya usa "Orden de compra": No.
      Compra no vacío, fecha `dd/mmm/aaaa`, hora `HH:mm:ss`, total
      numérico mayor a cero.
    - Busca la orden por `numero_compra` en `ordenes_compra`
      (`eliminado_en IS NULL`). Si no existe, o si existe pero
      fecha/hora/total no coinciden, se rechaza con el **mismo mensaje
      genérico** en ambos casos ("No se encuentra registrada la compra
      para facturar.") — decisión deliberada, no un descuido: no revelar
      cuál de los cuatro datos está mal evita que alguien vaya adivinando
      una combinación válida campo por campo.
    - La comparación de fecha/hora usa `formatearFechaHoraMexico()` con
      la zona horaria ACTUALMENTE configurada, sobre el valor crudo (UTC)
      guardado en `ordenes_compra.fecha_compra` — exactamente el mismo
      cálculo que ya se usa para mostrarle esos datos al cliente en el
      correo de confirmación, así que lo que compara el backend es
      literalmente lo mismo que el cliente vio ahí.
    - Tolerancia de medio centavo (`< 0.005`) en la comparación del
      total, para no fallar por un redondeo de punto flotante
      legítimo, sin abrir la puerta a que un total genuinamente distinto
      pase la validación.

    **Vínculo nuevo, no pedido explícitamente pero de valor claro**: se
    agregó `tickets.orden_compra_id` (referencia simple, sin `FOREIGN
    KEY` — mismo criterio ya establecido en esta app para vincular tablas
    por dato de negocio en vez de una constraint real, ver
    registros/tickets vinculados por RFC) — queda guardado qué orden de
    compra corresponde a cada ticket ya aceptado, útil para cuando se
    quiera mostrar esa relación en el panel más adelante. Es una
    extensión de bajo riesgo (columna nullable, no cambia ningún
    comportamiento existente) que se sigue directamente de la validación
    ya pedida — encontrar la orden es parte del propio flujo, guardarla
    es solo no descartar ese resultado.

    **Frontend (`tickets.js`)**: validación de formato duplicada del
    lado del cliente (mismas expresiones regulares que el backend, para
    dar retroalimentación inmediata sin esperar al servidor — el backend
    sigue siendo la validación real). El nuevo código de error
    `COMPRA_NO_ENCONTRADA` se maneja de forma específica: se muestra
    junto a los campos de verificación (no solo un toast genérico que
    desaparece solo) y hace scroll automático hasta ahí, para que quede
    claro qué parte del formulario corregir. Los 4 campos nuevos también
    se deshabilitan correctamente cuando el formulario ya está bloqueado
    por falta de constancia (se me había pasado por alto al principio,
    lo agregué al revisar `bloquearFormularioTicket()` con más cuidado).

    **Pruebas**: 11 casos en aislamiento (formato de los 4 campos,
    coincidencia exacta, coincidencia con un dato incorrecto, y la
    tolerancia de redondeo del total). Extendí `verificar-mysql.js` con
    el flujo completo contra MySQL real: crea una orden de compra de
    prueba, confirma que se encuentra por su número, que coincide
    correctamente con sus propios datos formateados con
    `formatearFechaHoraMexico()`, que falla con un total o fecha
    incorrectos aunque el número de compra sí exista, y que un número de
    compra inexistente simplemente no encuentra nada — limpiando la
    orden de prueba al terminar.
49. **Bug real reportado: en `tickets.html`, una fecha con formato
    perfecto ("24/jul/2026") siempre se rechazaba** como "formato
    incorrecto", sin importar qué tan bien escrita estuviera. Investigué
    antes de asumir la causa más obvia (algo del copiar/pegar, caracteres
    invisibles) — encontré la causa real revisando el propio código, no
    adivinando.

    **Causa raíz**: `POST /api/tickets` leía `fecha_compra` con
    `sanitizeText()`, la misma función ya usada para RFC, nombres, etc.
    Esa función aplica `validator.escape()` — pensada para texto que se
    va a insertar dentro de una página HTML propia (evita XSS ahí) — y
    esa función **convierte "/" en la entidad HTML "&#x2F;"**. Entonces
    "24/jul/2026" se convertía internamente en "24&#x2F;jul&#x2F;2026"
    ANTES de que la expresión regular del formato la evaluara — la fecha
    nunca iba a coincidir, sin importar qué tan bien escrita estuviera.
    **Lo confirmé instalando temporalmente el paquete `validator` en este
    entorno** (no estaba instalado, ya que `node_modules` no se incluye
    en el proyecto) específicamente para probar `validator.escape("24/jul/2026")`
    de forma aislada y ver el resultado real, en vez de solo inferirlo de
    la documentación del paquete — confirmé el bug exacto, apliqué la
    corrección, y **desinstalé `validator` y borré `node_modules` por
    completo al terminar**, para no dejar dependencias temporales de
    prueba en el proyecto entregado.

    **Corrección** (dos partes):
    1. Se cambió `fecha_compra` y `hora_compra` (por consistencia, aunque
       solo la fecha tenía el problema — el colón ":" no se escapa) para
       leerse con `sanitizeTextoLibre()` en vez de `sanitizeText()` —
       misma función que ya usa el asunto/cuerpo de un correo por la
       misma razón (no debe escaparse texto que no se va a insertar en
       una página HTML propia).
    2. Además, se cambió la validación de un `test()` anclado
       (`^...$`, exige que TODA la cadena coincida exactamente) a una
       **extracción** (`.match()` sin anclar, encuentra el patrón válido
       DENTRO del texto capturado) — más tolerante a espacios extra
       alrededor (típico al copiar y pegar) y, como beneficio adicional,
       tolera que alguien pegue una fecha y hora combinadas en un solo
       campo (ver el punto siguiente).

    **Mejora de UX relacionada, encontrada en el camino**: el correo de
    confirmación de la orden de compra mostraba "Fecha" como un solo
    renglón con la fecha Y la hora juntas ("24/jul/2026 09:30:45"), pero
    el formulario de `tickets.html` las pide como dos campos SEPARADOS
    ("Fecha" y "Hora"). Aunque no era la causa del bug reportado (el
    cliente típicamente reportaría "me dice que el formato es
    incorrecto" al copiar solo la fecha exacta, que es justo lo que pasó
    aquí), es una fuente de confusión real y relacionada — si alguien
    copiara el valor completo de "Fecha" del correo (fecha+hora juntas) y
    lo pegara en el campo "Fecha" del formulario, tampoco habría
    coincidido. Se separó en dos renglones ("Fecha" y "Hora"), tanto en
    el HTML como en el texto plano del correo, para que cada valor quepa
    exactamente en su campo correspondiente sin necesidad de separarlos
    manualmente. También se actualizó el texto del mensaje cordial para
    mencionar que se pedirá "cada uno en su propio campo".

    **Pruebas**: agregué una prueba de regresión específica en
    `verificar-mysql.js` contra las funciones REALES de `utils/validate.js`
    (no simuladas) que: (a) confirma que el bug existía con
    `sanitizeText()` — para que quede documentado en el propio código de
    pruebas, no solo en este archivo —, (b) confirma que con
    `sanitizeTextoLibre()` (la corrección real) la misma fecha exacta del
    reporte sí se reconoce, y (c) confirma la tolerancia nueva a espacios
    extra y a una fecha+hora pegadas juntas.
50. **Ícono ✅ de "ya facturado" en Órdenes de compra + no se puede
    volver a facturar la misma orden.** Pedido explícito con criterio de
    "ya facturado" definido por el usuario: No. Compra + el campo fecha
    del admin.

    **Definición de "facturado"**: una orden se considera facturada si
    existe un ticket vinculado a ella (`tickets.orden_compra_id`, columna
    agregada en el punto 48 para exactamente este propósito) cuya
    factura ya se subió (`estatus = 'listo'`). No hizo falta agregar un
    campo nuevo — el vínculo y el estado ya existían de antes, esto solo
    los combina. Se usa una subconsulta `EXISTS` en vez de un `JOIN` con
    `GROUP BY` (más simple de leer, y MySQL la optimiza bien para "existe
    al menos una fila que cumpla").

    **Backend**: `GET /api/admin/ordenes-compra` ahora incluye
    `facturado: true/false` por cada orden. `POST /api/tickets` rechaza
    (después de confirmar que la orden existe y coincide en fecha/hora/
    total — ver punto 48) si ya hay un ticket "listo" vinculado a esa
    orden, con `codigo: 'COMPRA_YA_FACTURADA'` y el mensaje exacto
    pedido: "Esa compra ya fue facturada."

    **Frontend (admin)**: ícono ✅ (el emoji Unicode real, no un SVG ni
    una librería de íconos — es lo más simple que cumple el pedido y se
    ve igual en cualquier navegador moderno) junto al No. Compra cuando
    `facturado === true`. El tooltip usa el atributo `title` nativo del
    navegador ("Orden de compra facturado") — no hace falta JavaScript
    adicional para el tooltip en sí, el navegador ya lo maneja.

    **Frontend (tickets.js)**: el nuevo código `COMPRA_YA_FACTURADA` se
    maneja igual que `COMPRA_NO_ENCONTRADA` — se muestra junto a los
    campos de verificación con scroll automático, cumpliendo el "mensaje
    en pantalla" pedido.

    **Pruebas**: extendí `verificar-mysql.js` con el flujo completo
    contra MySQL real — crea una orden y un ticket vinculado, confirma
    que sin ningún ticket "listo" no aparece como facturada, que con un
    ticket vinculado pero "pendiente" TAMPOCO aparece como facturada
    (caso importante: un ticket en trámite no debe bloquear ni marcar la
    orden todavía), que en cuanto ese ticket pasa a "listo" sí aparece
    como facturada, y que el mismo query que usaría un segundo intento de
    ticket lo detectaría correctamente.

    **Verificación visual**: dado que este ícono depende de que el
    navegador tenga fuentes de emoji a color instaladas, y
    `wkhtmltoimage` (el motor WebKit antiguo ya usado en turnos
    anteriores) no es representativo para verificar renderizado de
    emojis, no intenté forzar una verificación visual con esa
    herramienta — habría sido una prueba de poco valor real. Me apoyé en
    que un emoji Unicode estándar dentro de un `<span>` con `title` es un
    patrón universalmente soportado, sin lógica personalizada de por
    medio.
51. **Tres ajustes de UX sobre lo del punto anterior.** Pedido explícito
    de tres partes.
    - **Ícono ✅ movido a la izquierda** del No. Compra (antes iba a la
      derecha). Cambio de HTML/CSS puro (orden del `<span>` dentro de la
      celda, `margin-right` en vez de `margin-left`) — ninguna lógica de
      por medio que pudiera romperse.
    - **Ventana emergente en vez de texto inline** para "No se encuentra
      registrada la compra para facturar." y "Esa compra ya fue
      facturada." en `tickets.html`. Nuevo modal reutilizable
      (`verificacion-compra-overlay`), mismo patrón visual ya establecido
      para "sin constancia" — un solo modal con título/mensaje
      dinámicos en vez de dos modales casi idénticos, ya que
      conceptualmente ambos casos son "no podemos continuar con esta
      compra", solo cambia el motivo. Se agregó, más allá de repetir el
      mensaje exacto pedido, una segunda línea de orientación (qué
      revisar en cada caso) — buena práctica de UX: un error debe decir
      qué pasó Y qué hacer al respecto, no solo qué pasó. Accesibilidad:
      cerrable con el botón "Entendido", la tecla Escape, o clic fuera
      del recuadro; al cerrarse, el foco vuelve al campo "No. Compra"
      para que el cliente pueda corregir de inmediato en vez de tener que
      volver a ubicar el campo con el mouse. Se eliminó el elemento
      `error-verificacion-compra` (HTML, CSS y JS) que quedó sin uso al
      reemplazarlo por el modal, en vez de dejarlo como código muerto.
    - **Tooltip de razón social en "Correo"** de la tabla de órdenes:
      reutiliza la misma caché (`correosRegistradosCache`) ya cargada
      para el desplegable del formulario — no se pidió el dato de nuevo
      al servidor. Usa el atributo `title` nativo, mismo criterio ya
      aplicado al ícono de facturado.
      - **Bug de condición de carrera que encontré y corregí en el
        camino**: `cambiarVistaPrincipal('ordenes')` y el botón
        "Actualizar" disparaban `cargarCorreosRegistrados()` y
        `cargarOrdenes()` en paralelo, sin esperar uno a otro — la tabla
        podía terminar de pintarse ANTES de que la caché de correos
        tuviera datos, dejando el tooltip vacío en la primera carga
        (aunque un segundo refresco ya lo mostraría bien, por quedar la
        caché ya poblada). Se corrigió encadenando ambas llamadas
        (`await cargarCorreosRegistrados()` antes de `cargarOrdenes()`)
        en los dos lugares donde se disparaban. Lo encontré revisando el
        orden de las llamadas al implementar el tooltip, no fue
        reportado como bug — una consecuencia directa de construir esta
        funcionalidad con cuidado, no un hallazgo pedido aparte.
52. **Reenviar correo de orden de compra + formato automático de dinero
    con comas de miles.** Pedido de dos partes independientes.

    **Reenviar correo**: `POST /api/admin/ordenes-compra/:id/reenviar-correo`,
    reutilizando literalmente `enviarCorreoOrdenCompra()` (ya existía
    desde el punto 47) — arma los mismos datos que el envío original
    (fecha/hora reformateadas con la zona horaria ACTUAL, no la vigente
    cuando se creó la orden, mismo criterio que ya usa el listado de la
    tabla) y los manda al mismo correo asociado. A diferencia del envío
    original (fire-and-forget, ya que ahí la acción principal —crear la
    orden— ya había tenido éxito de todas formas), este SÍ se espera y se
    reporta de vuelta, porque aquí reenviar el correo ES la acción
    principal — un fallo silencioso no tendría sentido.
    - Nueva columna de acción en la tabla (antes no tenía ninguna),
      siguiendo el mismo patrón ya establecido en Constancias/Tickets/
      Usuarios (celda vacía en el template, luego
      `document.createElement` + `addEventListener` para el botón, en
      vez de un `onclick` inline).
    - **Ajuste de CSS necesario**: como ahora "correo" ya no es la última
      columna de la tabla (el nuevo botón de acción sí lo es), quité el
      override de especificidad que había agregado en el punto 45 para
      mantener el ancho de "correo" — ya no hacía falta, y dejarlo
      habría sido una regla muerta y confusa para el futuro.

    **Formato de dinero**: función reutilizable
    `formatearCampoDinero(input)` que engancha un listener de `input` a
    un campo, reformateando con comas de miles en cada tecla y
    **conservando la posición del cursor** (contando cuántos dígitos
    había antes del cursor en el valor original, y recolocándolo tras esa
    misma cantidad de dígitos en el valor ya formateado) — sin esto, el
    cursor saltaría al final en cada tecla, haciendo prácticamente imposible
    editar un número por en medio en vez de solo al final.
    - Aplicado a los dos campos de dinero reales de la app: "Cantidad" en
      Orden de compra (admin) y "Total" en la verificación de compra
      (`tickets.html`) — ambos cambiados de `type="number"` (que
      rechaza comas de plano) a `type="text"` con `inputmode="decimal"`
      (mantiene el teclado numérico en móvil sin la limitación).
    - `obtenerValorNumerico(input)` despoja las comas antes de convertir
      a número — se actualizaron TODOS los lugares que antes leían estos
      campos con `Number(input.value)` directo (la vista previa del
      total, la validación al enviar el formulario, y el envío mismo al
      backend) para usar esta función en su lugar; un campo con comas
      sin despojar habría hecho que `Number("1,000")` diera `NaN`.
    - Se repitió el mismo código en `admin.js` y `tickets.js` (no se
      comparte un archivo entre páginas, arquitectura ya establecida en
      todo este proyecto).
    - **Pruebas**: probé la función de formateo en aislamiento (15 casos:
      miles, millones, decimales truncados a 2 lugares, ceros a la
      izquierda, múltiples puntos decimales, texto mezclado de un
      copiar/pegar incorrecto, reformatear un valor que YA viene con
      comas —importante, ya que el listener se dispara en cada tecla
      sobre el valor ya formateado—) y la lógica de restauración del
      cursor por separado (8 casos: escribir al final, insertar y borrar
      dígitos en medio de un número ya con comas, agregar decimales).
      **Encontré y corregí un error en mi propia prueba** del cursor
      antes de darla por buena — mi primera expectativa para "borrar un
      dígito en medio" estaba mal calculada a mano; lo detecté
      revisando el resultado real contra el algoritmo paso a paso, no
      solo confiando en la primera cifra que escribí.
    - No se agregó al script de regresión de MySQL — es lógica
      puramente de frontend, sin ninguna contraparte en el backend que
      probar contra una base de datos real.
53. **Misma regla de comas de miles extendida a los "Total" que solo se
    muestran** (no se escriben) — vista previa del total en "Registrar
    orden de compra" y la columna "Total" en "Órdenes registradas".
    Pedido explícito de continuar el punto anterior.
    - Nueva función `formatearMoneda(valor)`, más simple que
      `formatearCampoDinero()` del punto 52 (esta última existe para
      manejar el cursor de un campo que se está escribiendo; para un
      valor de solo lectura no hace falta nada de eso, solo
      `toLocaleString('en-US', { minimumFractionDigits: 2,
      maximumFractionDigits: 2 })`).
    - A propósito **no se aplicó a "Cantidad"** en la tabla de órdenes
      registradas ni en ningún otro monto (ej. el correo de
      confirmación) — el pedido fue específicamente sobre los campos de
      "Total", no una regla general para todo monto en la aplicación.
    - **Pruebas**: 6 casos para `formatearMoneda()` en aislamiento
      (miles, millones, decimales, sin comas para montos pequeños, monto
      exacto sin decimales originales, cero) y 4 casos más probando el
      flujo completo (cálculo del total con IVA + formateo juntos, mismo
      camino que sigue `actualizarTotalPreviewOrden()` en la app real).
54. **Bug real de layout: "Orden de compra" se desbalanceaba hacia la
    derecha al ensanchar columnas de la tabla.** Investigué la causa
    técnica antes de "arreglar a ciegas" con márgenes/paddings al tanteo
    (que habría sido la manera fácil pero incorrecta de "resolver" el
    síntoma sin atacar la causa real).

    **Causa raíz**: el "desbordamiento" (*blowout*) clásico de CSS
    Grid. `.orden-compra-layout` usa `grid-template-columns: minmax(300px,
    380px) 1fr` — por especificación de CSS, una celda de grid **nunca se
    encoge por debajo del ancho natural de su contenido**, aunque su
    columna esté definida como `1fr` (flexible), a menos que se le ponga
    explícitamente `min-width: 0`. La tabla de la derecha tiene columnas
    redimensionables (ver punto 45) — en cuanto el administrador
    ensanchaba una columna arrastrando su encabezado, el ancho natural de
    la tabla podía superar el espacio de `1fr` disponible, y sin esa
    regla, TODA la cuadrícula (formulario + lista) se empujaba hacia la
    derecha en vez de quedarse dentro de `.admin-main` (que sí está
    centrado, `margin: 0 auto`). El margen izquierdo nunca se movía —
    lo que describía el usuario como "todo se va a la derecha" era en
    realidad el borde DERECHO extendiéndose más allá del contenedor
    centrado, dando la sensación de que el conjunto ya no estaba
    balanceado.

    **Corrección**: `min-width: 0` en `.orden-compra-columna-lista` (la
    celda de grid que contiene la tabla), tanto en el layout de dos
    columnas como en el colapsado de una sola columna (el mismo problema
    aplica igual con `1fr` de una sola columna). Con esto, la celda sí
    se encoge al espacio real disponible, y es la propia tabla — que ya
    tenía `overflow-x: auto` desde que se le agregaron columnas
    ajustables — la que gana una barra de desplazamiento horizontal
    contenida dentro de sí misma, en vez de desbalancear toda la página.
    - **A propósito no se agregó un ancho MÁXIMO al redimensionado de
      columnas** (solo existe un mínimo, `ANCHO_MIN_COLUMNA = 70`) — no
      hacía falta para resolver el bug reportado: con `min-width: 0` en
      su lugar, una columna arbitrariamente ancha ya no rompe el layout,
      simplemente activa el scroll horizontal de la tabla, que es un
      patrón de UX estándar y esperado para tablas anchas.
    - **Verificación limitada por la misma razón ya documentada en el
      punto 46**: `wkhtmltoimage` no soporta CSS Grid en este entorno,
      así que no pude verificar visualmente el resultado con las
      herramientas disponibles. En su lugar, confirmé con `grep` que el
      selector CSS nuevo coincide EXACTAMENTE con la clase real usada en
      el HTML, y que `.orden-compra-columna-lista` es hija DIRECTA de
      `.orden-compra-layout` (no un descendiente anidado, donde
      `min-width: 0` no tendría ningún efecto sobre el cálculo de la
      pista de grid) — para al menos descartar un error de selector, ya
      que `min-width: 0` es la corrección estándar y bien documentada
      para este problema específico de CSS Grid, sin lógica personalizada
      de por medio que pudiera fallar de forma sutil.
55. **Tres pedidos en un mismo turno: espacio en Órdenes registradas +
    columna de acciones visible, descargar/reemplazar la factura ZIP en
    tickets, y extender la retención automática a órdenes de compra.**

    **Espacio y columna de acciones visible** (continuación directa del
    punto 54): el `min-width: 0` del punto anterior arregló el
    desbordamiento, pero como efecto secundario dejó la tabla más
    apretada de lo esperado — el botón "Reenviar correo" (agregado en el
    punto 52) quedaba fuera de la vista sin ningún aviso al hacer scroll.
    Dos correcciones:
    - `.admin-main` ensanchado de 1100px a 1400px — más espacio en TODO
      el sitio, no solo en "Orden de compra", tal como se pidió.
    - **Columna de acciones fija (`position: sticky; right: 0`)** en las
      CUATRO tablas del panel (Constancias, Tickets, Usuarios, Órdenes)
      — no solo en Órdenes, ya que el mismo problema de raíz (un botón
      que puede quedar fuera de la vista al hacer scroll horizontal en
      una tabla ancha) aplica igual a las otras tres. Con sombra a la
      izquierda como señal VISUAL de contenido oculto — cumpliendo
      explícitamente "no texto" — en vez de, por ejemplo, un mensaje de
      aviso. Fondo explícito en los estados normal/hover de la celda fija
      (la tabla no tiene rayado alterno, así que no hacía falta
      contemplar eso) para que no se transparente el contenido
      desplazándose por debajo.
      **⚠️ Revertido en el punto 56** — el usuario aclaró que no quería
      la columna fija (se encimaba con otros componentes); lo que sí
      resolvía el problema era el ensanchado de arriba.

    **Descargar/reemplazar la factura**: nuevo
    `GET /api/admin/tickets/:id/factura` (mismo patrón que ya existía
    para el cliente, con auth de administrador en vez de cookie de
    usuario). En el modal de gestión, si el ticket ya tiene una factura,
    aparece "Factura actual: [nombre]" con botón de descarga, y el
    campo/botón de subir cambia automáticamente su texto a "Reemplazar
    factura" — el backend YA soportaba reemplazar (borra la factura
    anterior al subir una nueva, desde el punto de la implementación
    original), solo faltaba que la interfaz lo comunicara con claridad
    en vez de dejarlo implícito.
    - Corregí en el camino que `setSubiendoFacturaLoading()` restauraba
      SIEMPRE el texto "Subir factura..." al terminar de cargar, sin
      importar si el ticket ya tenía una factura — con el nuevo texto
      dinámico ("Reemplazar factura..."), hacía falta que esa función
      supiera cuál de los dos textos restaurar.

    **Retención extendida a órdenes de compra**: `limpiarOrdenesVencidas()`
    nueva en `ticketsCleanup.js`, usando la MISMA configuración de días
    (`getRetencionTicketsDias()`) que ya usa `limpiarTicketsVencidos()`
    — un solo número que el administrador configura una vez, aplicado a
    ambos. A diferencia de un ticket, una orden no tiene archivos en
    disco, así que un `DELETE` en lote basta (no hace falta procesarlas
    una por una). Se registra la última limpieza de cada una por
    separado (`ordenes_compra_ultima_limpieza` vs
    `tickets_ultima_limpieza`, mismo mecanismo, claves distintas) para
    poder mostrar información específica de cada una — pedido explícito:
    "agrega también esa información en el UI de borrado de tickets".
    - La tarjeta se renombró a "Borrado automático de tickets **y
      órdenes de compra**" y el texto explicativo dice explícitamente que
      aplica a ambos, en vez de dejarlo como un detalle escondido en el
      código que el administrador no tendría forma de saber solo viendo
      la interfaz.
    - El job periódico (antes `ejecutarLimpiezaTickets`, renombrado a
      `ejecutarLimpiezaAutomatica`) ahora llama a las dos limpiezas, cada
      una en su propio `try/catch` — un error limpiando órdenes no debe
      impedir que se sigan limpiando tickets, y viceversa.
    - **Pruebas**: extendí el bloque de prueba de retención YA
      existente para tickets (reutilizando la misma retención de 5 días
      ya activa en ese bloque, en vez de un bloque nuevo separado con su
      propio setup/teardown) — crea una orden vieja (100 días) y una
      reciente, confirma que `limpiarOrdenesVencidas()` borra solo la
      vencida.
56. **Corrección al punto 55: se revirtió la columna de acciones fija
    (sticky).** El usuario aclaró que no quería que quedara fija — se
    encimaba con otros componentes — sino que se desplazara con el resto
    de la tabla, igual que las cabeceras redimensionables. Lo que sí
    resolvía el problema, según confirmó el propio usuario, era
    simplemente el espacio adicional (`.admin-main` a 1400px).
    - **Hallazgo al retomar este punto**: al revisar el estado actual del
      código para hacer la reversión, encontré que el bloque CSS de la
      columna fija (`position: sticky` + sus reglas de fondo/z-index
      asociadas en las cuatro tablas) **ya no estaba presente** en
      `admin.css`, aunque sí lo confirmé dentro del `.zip` entregado al
      final del turno anterior. El resto de los cambios de ese mismo
      turno (el ancho de 1400px, el botón de descargar/reemplazar
      factura, la retención extendida a órdenes) seguían intactos. No
      pude determinar con certeza la causa exacta (algo similar ya había
      pasado antes en este proyecto, documentado en el punto 33) — lo
      relevante es que **verifiqué el estado real del archivo antes de
      actuar**, en vez de asumir que hacía falta escribir código de
      reversión que quizás ya no aplicaba. Confirmé con varias búsquedas
      dirigidas (no solo una) que ningún rastro de la columna fija
      seguía presente, y que el resto de las funcionalidades de los
      últimos turnos sí seguían ahí, antes de dar el problema por
      resuelto sin haber escrito una sola línea de código nueva en este
      punto — solo corregí la documentación (README y este archivo) para
      que reflejara la decisión final correctamente.
57. **Auditoría general de calidad de código + investigación de
    intermitencia del servidor en Docker.** Pedido de dos partes: revisar
    todo el proyecto en busca de malas prácticas/redundancias, y
    diagnosticar por qué el servidor se sentía intermitente en
    producción — sin agregar una segunda instancia ni balanceo de carga
    (explícitamente para después).

    ### Intermitencia — causas concretas encontradas

    Investigué antes de "arreglar a ciegas" con reinicios manuales o
    aumentar recursos sin entender la causa. Encontré varios problemas
    reales, cada uno un candidato razonable para explicar cortes
    intermitentes sin patrón aparente:

    1. **El health check era falso** (`GET /api/health` solo confirmaba
       "el proceso contestó", nunca tocaba la base de datos). Un
       orquestador (Docker, o cualquier balanceador futuro) vería el
       contenedor como saludable aunque el pool de MySQL estuviera
       agotado o desconectado — el peor tipo de falso positivo, porque
       oculta el problema en vez de dar una señal clara. **Corrección**:
       ahora hace `SELECT 1` con un timeout de 2s (usando
       `Promise.race`, para no quedarse colgado si MySQL responde lento
       en vez de estar francamente caído). Probé la lógica en aislamiento
       con 3 escenarios: DB accesible, DB caída, y DB colgada (confirmé
       que el timeout sí gana la carrera y no se queda esperando para
       siempre).
    2. **No existía apagado ordenado (*graceful shutdown*)** — nada
       manejaba `SIGTERM`/`SIGINT`. Cuando Docker reinicia un
       contenedor (un despliegue, un límite de memoria que lo tumba,
       `docker-compose restart`), Node por default no deja de aceptar
       conexiones ni espera a que las peticiones en curso terminen — las
       corta de golpe. Alguien subiendo un archivo justo en ese momento
       recibiría un error sin relación aparente con nada que hizo mal —
       exactamente el perfil de "intermitencia sin explicación".
       **Corrección**: nueva función `apagarOrdenadamente()` — deja de
       aceptar peticiones nuevas, espera (con límite de 10s) a que
       terminen las que ya estaban en curso, cierra el pool de MySQL
       limpiamente, y solo entonces sale. Con protección contra procesar
       la señal dos veces si llega repetida. Probé la lógica completa en
       aislamiento (mockeando `server.close`/`pool.end`) con 5 casos:
       cierre normal, señal duplicada, timeout forzado si tarda
       demasiado, y que un fallo al cerrar el pool no deje el proceso
       colgado.
    3. **Sin `uncaughtException`/`unhandledRejection` globales.** Las
       rutas ya estaban cubiertas por `asyncHandler` (confirmé que
       captura y reporta errores correctamente antes de asumir que hacía
       falta tocarlo), y los envíos "fire-and-forget" (correos) ya
       tenían su propio `.catch()` en cada caso — verifiqué esto último
       con un `grep` de TODAS las llamadas a `enviarCorreo*`/
       `notificarNuevoTicketAlContador`, no solo lo asumí. Pero sin una
       red de seguridad global, cualquier error verdaderamente
       inesperado que escapara de esas dos coberturas tumbaría el
       proceso con un mensaje ambiguo — y en Node 20+, una promesa
       rechazada sin atrapar hace crashear el proceso por default.
       **Corrección**: ambos manejadores agregados, con log claro antes
       de cerrar (se opta por cerrar y dejar que `restart:
       unless-stopped` levante una instancia limpia, no por intentar
       seguir sirviendo tráfico con un estado posiblemente corrupto).
    4. **`depends_on` del frontend no esperaba a que el backend
       estuviera REALMENTE listo** — el Dockerfile del backend ya traía
       un `HEALTHCHECK` definido (desde hace varios turnos), pero
       `docker-compose.yml` nunca lo usaba: la sintaxis corta
       (`depends_on: - backend`) solo espera a que el CONTENEDOR
       arranque, no a que pase su healthcheck. Cambiado a
       `condition: service_healthy` — mismo patrón que ya se usaba
       correctamente para que el backend esperara a MySQL.
    5. **Sin límites de memoria en ningún contenedor.** Un pico de
       memoria en cualquiera de los tres servicios podía dejar sin RAM
       al host completo, y el OOM killer del sistema operativo puede
       matar el proceso equivocado (a veces ni el que causó el
       problema) — se ve como caídas random e inexplicables.
       Agregado `mem_limit` a los tres (mysql: 1g, backend: 512m,
       frontend: 128m) — así el contenedor problemático es el que se
       reinicia, de forma contenida, no el host entero.
    6. **Pool de MySQL sin keepalive.** Una conexión inactiva por un
       rato puede quedar "muerta" (el otro lado la cerró en silencio)
       sin que `mysql2` se entere hasta que se intenta usar — esa
       consulta en particular falla, sin relación aparente con nada.
       Agregado `enableKeepAlive: true`, `keepAliveInitialDelay: 10000`,
       y `connectTimeout: 10000` (para que un intento de conexión que no
       puede completarse falle rápido y deje reintentar, en vez de
       quedarse esperando más de lo razonable).
    7. **nginx abría una conexión TCP nueva a cada petición** hacia el
       backend (sin `keepalive` de upstream). Agregado un bloque
       `upstream backend_upstream { server backend:4000; keepalive 16;
       }` + `proxy_set_header Connection "";` (necesario para que el
       keepalive realmente se use — nginx reenvía el `Connection` del
       cliente al backend por default, lo que impediría reusar la
       conexión). Es una optimización de una sola instancia, no
       balanceo de carga — no se agregó un segundo `server` dentro del
       `upstream`, tal como se pidió explícitamente dejar para después.
    8. `stop_grace_period: 15s` en el backend, para darle tiempo de
       sobra al límite interno de 10s del apagado ordenado antes de que
       Docker mande `SIGKILL` de todas formas.

    ### Auditoría de calidad de código

    - Revisé imports sin usar en TODO el backend (`server.js` y los 7
      módulos de `utils/`) con un script que cuenta ocurrencias de cada
      nombre importado — no encontré ninguno; el backend ya venía
      disciplinado en eso.
    - Revisé funciones/constantes EXPORTADAS pero nunca usadas fuera de
      su propio archivo (con `grep` en todo `backend/`, no solo en
      `server.js`, para no dar un falso negativo). Encontré y limpié 3:
      `listarArchivosEnZip` (validate.js), `COOKIE_NOMBRE`
      (authUsuario.js), `REGIMENES_FISCALES` (pdfExtract.js) — las tres
      se quedan funcionando igual internamente, solo se quitó su
      exposición pública innecesaria (superficie de API más pequeña, más
      fácil de razonar sobre qué depende de qué).
    - **Hallazgo más sustancial**: el checklist de reglas de contraseña
      (`.password-reglas` y sus variantes) y el campo de mostrar/ocultar
      contraseña (`.password-field`, `.btn-toggle-pass`) estaban
      duplicados BYTE POR BYTE entre `admin.css` y `auth.css` — incluso
      un comentario en `auth.css` ya decía literalmente "reutilizado...
      en la vista de admin", reconociendo que era compartido, pero nunca
      se había consolidado. Confirmé que las 5 páginas HTML ya cargan
      `style.css` PRIMERO (antes de su hoja específica), así que lo moví
      ahí — una sola copia sirve a ambas, sin ningún cambio visual (usé
      un `sed` de rango de líneas para la eliminación en `auth.css`
      después de que un primer intento con `str_replace` no encontró
      coincidencia exacta, probablemente por algún carácter invisible —
      lo detecté por el error explícito de la herramienta, no lo ignoré
      ni asumí que había funcionado).
      Verifiqué el balance de llaves en las 4 hojas de estilo después, y
      que ambas páginas (`admin.html`, `login.html`) siguen referenciando
      las mismas clases sin cambios.
    - Revisé los índices de la base de datos contra las columnas más
      usadas en cláusulas `WHERE` (conteo real sobre `server.js`, no una
      suposición) — la cobertura ya era sólida (RFC y folio con `UNIQUE`,
      `id` siempre como llave primaria, `estatus`/`eliminado_en`/
      `orden_compra_id` ya indexados donde se filtran). El único caso sin
      índice (`usuarios.email`) resultó no necesitarlo: nunca se usa en
      una cláusula `WHERE`, solo se guarda y se muestra.
58. **Tooltips personalizados en toda la app, reemplazando el atributo
    `title` nativo.** El usuario preguntó qué opciones de librería
    existían para tooltips con mejores gráficos — le presenté 3 opciones
    (personalizado sin dependencias, Tippy.js vía CDN, Floating UI) con
    mi recomendación explicada, y usé la herramienta de elicitación para
    que eligiera en vez de asumir — eligió la opción personalizada, para
    aplicarse en todas las zonas que ya usaban tooltip.

    **Encontré los 5 usos reales** con `grep` en todo el frontend (no
    solo los que recordaba de memoria): el enlace "Ver vista previa" en
    Constancias, el ícono ✅ de "facturado" en Órdenes, la razón social
    al pasar el cursor sobre el correo en Órdenes, el badge "Cambio
    pendiente" en Usuarios, y el botón de descargar factura en el
    tablero del cliente — cuatro en `admin.js`, uno en `dashboard.js`.

    **Decisión técnica importante, no solo estética**: antes de escribir
    el componente, revisé si un tooltip 100% CSS (con
    `content: attr(data-tooltip)` en un `::after`) bastaría — y
    encontré un problema real: CUATRO de los cinco usos están dentro de
    `.admin-table-wrap`, que tiene `overflow-x: auto`. Por una
    particularidad real de la especificación de CSS, cuando un eje tiene
    un valor de overflow distinto de `visible`, el OTRO eje deja de ser
    `visible` también (se vuelve `auto`) — así que un tooltip CSS puro
    ahí se habría recortado verticalmente en vez de mostrarse completo.
    Por eso el componente usa un poco de JavaScript propio (sigue siendo
    "sin librerías externas", la opción elegida) que crea el elemento del
    tooltip como hijo de `document.body` (no del elemento que lo activa)
    y lo posiciona con `getBoundingClientRect()` — así nunca queda
    recortado por ningún contenedor con scroll.
    - Un solo elemento de tooltip se crea y se reutiliza (no uno nuevo
      por cada hover), y usa delegación de eventos sobre `document`
      (`mouseover`/`mouseout`/`focusin`/`focusout`) — así funciona
      automáticamente con filas de tabla agregadas dinámicamente
      después, sin tener que volver a conectar nada por cada fila nueva.
    - Se voltea a mostrarse ABAJO del elemento (con la flecha invertida)
      si no cabe arriba — verificado con pruebas de la lógica de
      posicionamiento en aislamiento (4 casos: caso normal, volteo por
      cercanía al borde superior, y que no se salga por los bordes
      izquierdo/derecho de la pantalla).
    - Doble `requestAnimationFrame` al mostrarlo: el primero asegura que
      el navegador ya calculó el tamaño real del tooltip con el texto
      nuevo (necesario para que `getBoundingClientRect()` en el
      posicionamiento sea correcto), el segundo aplica la clase que
      dispara la animación de aparición — sin esto, la animación podría
      no dispararse de forma confiable, o la primera posición calculada
      podría estar basada en el tamaño del tooltip con el texto
      ANTERIOR todavía puesto.
    - Se cierra automáticamente si la página hace scroll mientras está
      abierto, para no dejarlo flotando en una posición que ya no
      corresponde a nada.
    - **Un solo componente para dos aplicaciones separadas**: el CSS vive
      en `style.css` (cargado por las 5 páginas). El JavaScript se
      agregó una vez en `admin.js` (panel de administración) y una vez
      en `portal.js` — este último ya era el script compartido entre
      `dashboard.html` y `tickets.html` (confirmé el orden de carga de
      los `<script>` en ambas páginas antes de asumir que bastaba con
      ponerlo ahí una sola vez), así que no hizo falta duplicarlo
      también en `dashboard.js`.
    - **Verificación visual**: dado que este componente usa
      `position: fixed` calculado con JavaScript (no CSS Grid), sí se
      pudo verificar con `wkhtmltoimage` sin la limitación ya conocida de
      turnos anteriores — confirmé que el color de fondo del tooltip
      (`--color-ink`) se renderiza correctamente.
59. **Bug real reportado: en `csf.html` y `tickets.html`, el botón
    "Cerrar sesión" se cortaba en vista de celular.** Investigué la causa
    antes de agregar CSS al tanteo.

    **Causa raíz**: `.portal-header-actions` (el contenedor de "Volver al
    tablero" + el RFC + "Cerrar sesión" — tres elementos en ese
    encabezado, contra solo dos en `dashboard.html`, que no tiene
    "Volver al tablero" por ser ya el tablero mismo) tenía `display:
    flex` sin `flex-wrap` — los tres elementos intentaban caber en una
    sola fila sin poder pasar a una segunda línea, y en una pantalla de
    celular no había espacio suficiente para los tres juntos.

    **Corrección**:
    - `flex-wrap: wrap` en `.portal-header-actions` — red de seguridad
      real: si no caben los tres en una fila, pasan a una segunda en vez
      de recortarse.
    - Además, por debajo de 480px, "Volver al tablero" se reduce a solo
      su ícono — el texto se oculta VISUALMENTE (con la técnica estándar
      de recorte a 1x1px, no con `display: none`), así que sigue
      disponible para lectores de pantalla. Esto le deja más espacio al
      botón que de verdad importa en ese encabezado: "Cerrar sesión".
    - El botón de solo ícono se dimensionó a un mínimo de 38x38px, para
      seguir siendo un objetivo táctil razonable en celular (no solo lo
      más angosto posible).
    - El RFC (`.portal-user-label`) se deja encoger con `text-overflow:
      ellipsis` en vez de forzar su ancho completo — un RFC de persona
      moral es más corto que "Volver al tablero", así que priorizar los
      botones (las acciones reales) sobre esta etiqueta informativa tiene
      más sentido.
    - Aplicado en `portal.css` (compartido por `csf.html`, `tickets.html`
      y `dashboard.html`), así que el mismo ajuste también deja el
      encabezado del tablero un poco más cómodo en celular, aunque ahí
      el problema reportado no aplicaba con la misma severidad (dos
      elementos, no tres).

    **Verificación visual**: renderizé el encabezado real de
    `tickets.html` a 360px (ancho típico de celular) y a 1000px, y
    confirmé por muestreo de píxeles que a 360px no queda ningún
    contenido pegado al borde derecho de la pantalla (margen de fondo
    limpio en los últimos 15px, en varias alturas distintas), y que el
    borde del botón "Cerrar sesión" sí está presente y visible dentro de
    los límites — no
    solo confirmé que "no había nada cortado", sino que también el
    contenido esperado sí aparece (para descartar el falso positivo de
    que el botón simplemente no se hubiera renderizado).
60. **Instrucción permanente nueva**: a partir de este turno, aplicar
    siempre las mejores prácticas de UX/UI en el frontend sin que haga
    falta pedirlo cada vez — ya era el criterio seguido de facto en
    turnos anteriores, pero ahora es explícito para el resto de esta
    conversación.
61. **Interruptor "Habilitar Orden de compra" en Configuraciones
    globales.** Pedido con criterios de aceptación explícitos y
    específicos por parte del usuario — implementado tal cual, sin
    reinterpretarlos.

    **Encendido (el valor por defecto, `true`)**: todo funciona
    exactamente igual que antes de este punto — sin ningún cambio de
    comportamiento para quien no toque el interruptor.

    **Apagado**: en el admin, el botón "Orden de compra" desaparece del
    menú (`aplicarVisibilidadOrdenesCompra()`, aplicado tanto al guardar
    el interruptor como al iniciar sesión — antes de este ajuste el
    botón solo se hubiera actualizado la próxima vez que se abriera
    "Configuraciones globales", lo cual no bastaba). En
    `tickets.html`, la sección "Verifica tu compra" se oculta por
    completo, y sus cuatro campos (No. Compra, fecha, hora, total) dejan
    de ser obligatorios — se pueden enviar sin ellos. Esto último se
    implementó en DOS capas, no solo una:
    - Frontend (`tickets.js`): la sección se oculta, y toda su
      validación (formato + envío en el `FormData`) se salta cuando el
      interruptor está apagado.
    - Backend (`POST /api/tickets`): reestructuré el bloque completo de
      verificación (que antes vivía directamente en el cuerpo de la
      ruta) para envolverlo en un `if (configGlobalTicket.ordenes_compra_habilitado)`,
      con una variable `ordenCompraId` declarada AFUERA del bloque
      (queda en `null` si está apagado) para que el `INSERT` final
      pudiera seguir funcionando sin importar cuál rama se haya tomado.
      **Esto es lo que de verdad importa**: si solo se hubiera ocultado
      la sección en el frontend sin tocar el backend, alguien podría
      seguir mandando la petición sin esos campos por fuera de la
      interfaz (con curl, por ejemplo) y el servidor los seguiría
      exigiendo de todas formas — el pedido explícitamente decía "se
      puede enviar la petición sin estos campos", así que la validación
      real tenía que aflojarse en el servidor, no solo esconderse en la
      pantalla.

    **Plomería nueva para que ambos lados supieran el estado del
    interruptor**:
    - `ordenes_compra_habilitado` se agregó a la configuración global ya
      existente (`config.js`, junto a IVA/zona horaria/logo) — mismo
      patrón, un booleano más en el mismo JSON.
    - El endpoint PÚBLICO `GET /api/config/campos-obligatorios` (que
      `tickets.html` ya consultaba para "campos obligatorios") se
      extendió para incluir también este booleano — evita un segundo
      endpoint solo para esto, ya que el frontend de todas formas ya
      hacía esa petición al cargar la página.
    - El endpoint de administrador `PUT /api/admin/config/global` acepta
      el nuevo campo igual que los demás (mismo patrón `!== undefined`
      que ya usaban IVA/zona horaria/logo, así que un booleano `false`
      explícito SÍ se procesa — no se confunde con "no se mandó").

    **Componente de switch nuevo**: no existía ningún interruptor
    visual en el proyecto (solo checkboxes planos) — construí uno
    reutilizable en `style.css` (input real oculto visualmente pero
    accesible por teclado/lector de pantalla, con transición suave de
    posición y color) en vez de usar un checkbox simple, ya que el
    pedido específicamente decía "el objeto switch" — coincide con la
    nueva instrucción permanente de UX/UI del punto 60.

    **Pruebas**: probé la lógica condicional completa de
    `POST /api/tickets` en aislamiento (4 casos: rechazo con el
    interruptor encendido y datos faltantes/completos, aceptación con el
    interruptor apagado sin importar si los datos son basura o están
    ausentes). Extendí `verificar-mysql.js` con el guardar/leer del
    booleano contra MySQL real, y una simulación equivalente del mismo
    comportamiento condicional del endpoint.
62. **Tarjeta renombrada a "Configuraciones fiscales" + 3 campos nuevos
    (RFC Compañía, Código SAT, link de códigos SAT) + info en la barra
    de sesión + aviso al iniciar sesión si faltan.** Pedido con
    criterios de aceptación explícitos — implementado tal cual.

    **Los 3 campos, todos opcionales pero validados si se capturan**:
    - `rfc_compania`: reutiliza `isValidRFC()` (ya existente en
      `validate.js`, usada en toda la app) — la misma función YA trataba
      una cadena vacía como válida (pensada originalmente para la
      constancia, donde el RFC es opcional), así que encajó sin tener
      que escribir una regla de "opcional" aparte.
    - `codigo_sat`: `^\d{8}$` exactos, tal como se pidió.
    - `link_codigos_sat`: se valida con el constructor `URL()` nativo de
      Node (envuelto en try/catch) en vez de una expresión regular a
      mano — más confiable para detectar una URL real, y de paso
      confirma que el protocolo sea `http`/`https` (no `javascript:` ni
      otro esquema inesperado).
    - Probé las 13 combinaciones de validación (incluyendo los tres
      casos vacíos = válidos) instalando temporalmente `validator`
      en este entorno, ya que `isValidRFC()` depende de él — lo
      desinstalé y borré `node_modules` al terminar, mismo cuidado que
      en el punto 49.

    **Barra de sesión**: nuevo `<span>` junto a "Administración",
    mostrando `RFC - CódigoSAT` — pero SOLO si ambos están capturados
    (`aplicarInfoFiscalBarra()`). Con cualquiera de los dos vacío, no se
    muestra nada extra — decidí esto explícitamente para no dejar un
    texto a medias como "OC-000001 -" colgando sin su segunda mitad, que
    se vería como un error visual más que como información útil.

    **Aviso al iniciar sesión**: nuevo modal (mismo patrón visual ya
    establecido, reutilizando `.modal-overlay`/`.modal`/
    `.modal-icono-aviso` de `style.css`) que aparece si falta el RFC y/o
    el Código SAT. **Decisión de diseño importante, no pedida
    explícitamente pero necesaria para que la funcionalidad no resultara
    molesta**: el aviso SOLO se dispara al iniciar sesión (login o
    restaurar sesión guardada), no cada vez que se abre la tarjeta
    "Configuraciones fiscales" — si apareciera también ahí, sería
    redundante justo cuando el administrador ya está viendo los campos
    para corregirlos. Implementado con una bandera opcional
    (`{ verificarFiscalFaltante: true }`) que solo se pasa desde
    `showDashboard()`, no desde el otro lugar donde ya se llamaba
    `cargarConfigGlobal()` (al abrir esa tarjeta).

    **Pruebas**: extendí `verificar-mysql.js` con guardar/leer los 3
    campos contra MySQL real (válidos e inválidos para cada uno), y una
    simulación de la lógica "¿se muestra la info en la barra de sesión?"
    con los 3 casos relevantes (ambos presentes, solo uno, ninguno).
63. **Cuatro pedidos en un mismo turno: link de códigos SAT como
    hipervínculo editable, "Registrar orden de compra" colapsable, ícono
    de notas internas en la lista de tickets, y quién hizo el último
    cambio de estatus.**

    **Link como hipervínculo + botón "Editar"**: nuevo
    `aplicarVistaLinkCodigosSat()` — con un valor guardado, se muestra
    como `<a>` real (clicable, abre en pestaña nueva) más un botón
    "Editar"; el `<input>` se oculta hasta que se presiona ese botón. Sin
    ningún valor guardado, no hay nada que enseñar como enlace, así que
    se deja el campo de texto visible directamente. Se aplica tanto al
    cargar la configuración como justo después de guardar (para que, si
    ya hay un valor, vuelva al modo vista sin que haga falta recargar la
    página). Sin un botón "Cancelar" explícito — no se pidió, y si el
    administrador entra a modo edición y no guarda, la próxima vez que
    se abra esa tarjeta simplemente se vuelve a cargar el valor real
    guardado, sin quedar "atorado" en modo edición.

    **"Registrar orden de compra" colapsable**: reutiliza el MISMO
    componente visual ya usado en las tarjetas de "Configuraciones
    globales" (`.admin-config-toggle`/`.admin-config-body`/
    `.admin-config-chevron`) — convertí el `<h2>` del título en un botón
    con flecha. A diferencia de esas tarjetas (que empiezan cerradas),
    esta empieza ABIERTA por defecto — es la acción principal de la
    pantalla, y el pedido fue "poder cerrarlo", no que empezara cerrado.
    La preferencia se recuerda con `localStorage`, mismo criterio ya
    usado para columnas visibles/anchos de tabla.

    **Ícono de notas internas en la lista de tickets**: nueva columna
    "Notas" — solo muestra el ícono cuando `notas_admin` tiene contenido
    real (no una celda vacía con un ícono apagado). Al hacer clic, abre
    el MISMO modal que "Gestionar" (`abrirTicketModal(t)`) — tal como se
    pidió explícitamente ("que abra la ventana como el botón
    gestionar"), en vez de construir una segunda ventana emergente
    aparte solo para mostrar el texto.

    **Quién hizo el último cambio de estatus**: nueva columna
    `tickets.actualizado_por`, con migración para instalaciones
    existentes. Se guarda con `req.adminUser` (ya lo pone
    `requireAdminAuth`, sin importar por cuál de los tres mecanismos de
    autenticación haya entrado el administrador — verifiqué esto
    revisando `auth.js` antes de asumirlo) en **los dos** lugares que
    cambian el estatus de un ticket: el endpoint de estatus/notas, Y el
    de subir factura (que también marca "listo" — si solo se hubiera
    actualizado en el primero, subir una factura habría dejado el
    "actualizado_por" desactualizado con el cambio anterior). Se muestra
    en la lista (debajo de la fecha, en la misma celda "Actualizado" —
    no una columna aparte, ya que es información relacionada) y también
    en el modal de gestión, como un dato más de solo lectura.

    **Pruebas**: probé la lógica de mostrar/ocultar el link en
    aislamiento (3 casos: con valor, vacío, `null`). Extendí
    `verificar-mysql.js` con "actualizado_por" contra MySQL real —
    reproduciendo los dos `UPDATE` reales (cambio de estatus/notas, y
    subida de factura) para confirmar que AMBOS actualizan el campo
    correctamente, no solo el primero.
64. **Continuación directa del punto 63: columna "Asignado a" junto a
    "Estatus", con filtro por usuario, manteniendo "actualizado por"
    donde ya estaba por temas de auditoría.** El usuario aclaró que
    quería el dato en DOS lugares con propósitos distintos — no
    reemplazar uno por el otro.

    **Nueva columna "Asignado a"**, justo después de "Estatus" — mismo
    valor (`actualizado_por`), pero pensada para escanear la tabla
    rápido y, sobre todo, para el nuevo filtro. La columna "Actualizado"
    (fecha + "por X") se dejó exactamente como estaba — ahí el valor
    tiene sentido junto a la fecha exacta, como registro de auditoría de
    cuándo y quién, no solo de quién.

    **Filtro "Usuario"**: nuevo desplegable junto al de "Estatus" (mismo
    estilo, mismo patrón de recarga al cambiar). Sus opciones NO salen de
    la lista completa de cuentas administrativas — vienen de un nuevo
    endpoint (`GET /api/admin/tickets/usuarios-actualizado-por`) que
    consulta los valores DISTINTOS que de verdad existen en
    `actualizado_por` entre los tickets activos. Decisión deliberada: una
    cuenta que nunca ha tocado un ticket no aparecería en el filtro (no
    tendría sentido ofrecer una opción que siempre regresa cero
    resultados), y una cuenta ya borrada que SÍ modificó algo en el
    pasado sigue apareciendo (el dato vive en el propio ticket, no
    depende de que la cuenta todavía exista).
    - `GET /api/admin/tickets` ahora acepta `?actualizado_por=...` como
      tercer filtro combinable (junto a `?estatus=` y `?papelera=`).
    - Al repoblar el desplegable, se conserva la selección actual si
      sigue siendo una opción válida — para no perder un filtro activo
      si la función se vuelve a llamar.

    **Pruebas**: extendí el mismo bloque de `verificar-mysql.js` del
    punto 63 con el query de usuarios distintos (confirma que el usuario
    de prueba aparece), el filtro por usuario (encuentra el ticket
    correcto), y que filtrar por un usuario que nunca ha modificado nada
    no regresa resultados.
65. **Renombrar "Código SAT" a "Clave SAT", subir la constancia de la
    compañía para autocompletar RFC/régimen fiscal/tipo de persona, y
    reemplazar el campo manual "RFC Compañía".** Pedido con varias
    partes que se entrelazan — implementado en el orden que el usuario
    describió, sin reinterpretar el alcance.

    **Renombrar Código SAT → Clave SAT**: cambié tanto la ETIQUETA
    visible como el nombre de la propiedad interna (`codigo_sat` →
    `clave_sat`), no solo el texto — para que el nombre nuevo sea
    consistente en todo el código, no solo en la pantalla. Agregué
    **compatibilidad hacia atrás**: `getConfiguracionGlobal()` lee el
    nombre nuevo si existe, y si no, cae de vuelta al nombre viejo — un
    valor ya guardado antes de este cambio no se pierde. Probé esto
    específicamente contra MySQL real (insertando un blob de
    configuración con el nombre viejo directamente, sin pasar por
    `setConfiguracionGlobal()`, para simular una instalación de antes de
    este cambio).

    **Botón "Subir constancia de situación fiscal"**, debajo del
    interruptor de Orden de compra: reutiliza literalmente las mismas
    funciones de extracción de PDF que ya usaba `POST /api/registro`
    (`extraerTextoPdf`, `pareceConstanciaFiscal`, `extraerRFC`,
    `extraerRegimenesFiscales`) en un nuevo endpoint
    (`POST /api/admin/config/constancia-compania`) — no se reimplementó
    nada de la extracción, solo se reutilizó donde escriben los
    resultados. Diferencia deliberada con el flujo de un cliente: ahí el
    RFC es "de mejor esfuerzo" (nunca bloquea, porque ya se captura aparte
    en el formulario); aquí el RFC ES el dato que se busca, así que si no
    se pudo identificar, se rechaza con un error — guardar una
    configuración fiscal sin RFC no tendría sentido para lo que pide este
    botón.

    **"RFC Compañía" se eliminó como campo manual** — el RFC ahora se
    escribe SOLO desde la extracción de la constancia (`rfc_compania`
    sigue existiendo como valor de configuración internamente, ya que la
    barra de sesión lo sigue necesitando, pero ya no hay ningún `<input>`
    de texto libre para escribirlo a mano; `setConfiguracionGlobal()`
    conserva la validación de formato como red de seguridad, sin importar
    quién intente escribirlo).

    **Campo "Régimen fiscal" nuevo**, en el lugar donde vivía "RFC
    Compañía" — una caja de solo lectura (no un `<input>`, porque puede
    traer más de un régimen a la vez — un contribuyente puede tener
    varios activos) que se llena con lo que haya encontrado
    `extraerRegimenesFiscales()`, cada uno con su clave, ej. "612 -
    Personas Físicas con Actividades Empresariales y Profesionales".

    **Persona Física / Persona Moral calculado del régimen**: nueva
    `determinarTipoPersonaPorRegimen()` en `pdfExtract.js`. **Fui
    deliberadamente transparente sobre una simplificación real** en vez
    de aparentar precisión legal que no tengo: según el catálogo oficial
    `c_RegimenFiscal` del SAT, los códigos `601`, `603`, `609`, `620`,
    `623` y `628` son EXCLUSIVOS de Persona Moral (una persona física
    nunca puede estar dada de alta en ninguno) — ese es el criterio
    confiable que se usa. El resto de los códigos son de Persona Física,
    O aplican a AMBOS tipos según el catálogo oficial (`610`, `622`,
    `624`, `626`, `629`, `630` — notablemente RESICO, el 626, aplica a
    ambos) — para esos casos ambiguos, sin ningún código exclusivo de
    moral presente, se asume Persona Física por ser el caso más común.
    Esto queda documentado tanto en el comentario del código como en el
    README, para que quede claro que es una simplificación práctica útil
    para la mayoría de los casos, no un dictamen fiscal exacto para el
    pequeño número de códigos verdaderamente ambiguos.

    **Barra de sesión con tercer segmento**: ahora arma `RFC - Clave SAT
    - Persona Física/Moral` — el tercer segmento es opcional (solo
    aparece si ya se calculó, es decir, si la constancia trajo al menos
    un régimen reconocido), para no dejar un tercer guión colgando sin
    nada después si todavía no se ha subido ninguna constancia con
    régimen legible.

    **Pruebas**: extendí el mismo bloque de `verificar-mysql.js` de los
    puntos 62/63 — Clave SAT (nombre nuevo + compatibilidad con el
    nombre viejo), régimen fiscal (guardar/leer), y la clasificación de
    tipo de persona contra la función REAL (no simulada) con los
    regímenes 612 (física) y 601 (moral) como casos representativos.
    También probé `determinarTipoPersonaPorRegimen()` en aislamiento
    puro (8 casos, incluyendo extremo a extremo con texto de PDF
    simulado) antes de integrarla al endpoint.
66. **Regla adicional de Persona Física/Moral por razón social, para
    desempatar RESICO y otros regímenes ambiguos.** El usuario mismo
    señaló el caso: 626 (RESICO) por sí solo no dice nada, ya que aplica
    tanto a personas físicas como morales según el catálogo del SAT.
    Propuso la regla él mismo (nombre propio = Física, si no = Moral) —
    **antes de implementarla, le presenté la regla en prosa con 4
    ejemplos de cada caso y esperé su confirmación explícita** en vez de
    escribir el código directamente a partir de una instrucción todavía
    sin validar por él; confirmó que era correcta en su siguiente
    mensaje, y ahí sí se implementó.

    **Diseño de la regla** (`determinarTipoPersonaPorNombre()` en
    `pdfExtract.js`): dos señales sobre la razón social ya extraída —
    (1) terminaciones legales que por ley SOLO puede traer una persona
    moral (`S.A. DE C.V.`, `S. DE R.L. DE C.V.`, `S.C.`, `A.C.`,
    `S.A.P.I. DE C.V.`, `S.A.B. DE C.V.`, `S.A.S.`, entre otras —
    evaluadas con `\b` de límite de palabra sobre el texto sin puntos,
    para no confundir abreviaturas de 2 letras como "sc"/"ac" con parte
    de otra palabra), y (2) palabras típicamente corporativas (`GRUPO`,
    `CORPORATIVO`, `COMERCIALIZADORA`, `CONSTRUCTORA`, `CONSULTORES`,
    etc.) como reforzante cuando no hay terminación legal explícita en el
    texto extraído. Sin ninguna de las dos, si el texto se ve como un
    nombre corto (2 a 5 palabras) se asume Persona Física; si no es
    concluyente (vacío, una sola palabra, texto inusualmente largo), la
    función regresa `null` en vez de forzar una respuesta.

    **Función combinada** (`determinarTipoPersona(regimenes, razonSocial)`):
    orden de prioridad explícito — un régimen con código EXCLUSIVO de
    moral (601/603/609/620/623/628) siempre gana primero, sin necesidad
    de ver el nombre; si el régimen no fue concluyente, se usa la razón
    social como desempate; si tampoco eso concluye nada, se regresa al
    resultado general del régimen (Física por default, o `null` si no
    hubo ningún régimen reconocido). El endpoint
    `POST /api/admin/config/constancia-compania` (del punto 65) se
    actualizó para usar esta función combinada en vez de la que solo veía
    el régimen — ahora también extrae la razón social con
    `extraerNombreRazonSocial()` (ya existente, reutilizada tal cual) y
    se la pasa como segunda señal.
    - **Limpieza en el camino**: `determinarTipoPersonaPorRegimen()` ya
      no se usaba directamente en `server.js` tras este cambio (quedó
      reemplazada por la combinada) — quité ese import específico de
      `server.js` en vez de dejarlo colgado sin uso; la función en sí
      se queda en `pdfExtract.js`, sigue exportada, y la sigue usando
      internamente `determinarTipoPersona()`.

    **Pruebas**: probé la regla por nombre en aislamiento con los 8
    ejemplos exactos que le presenté al usuario para su validación
    (todos correctos), más 7 casos límite adicionales (vacío, `null`,
    sin puntos, una sola palabra, texto muy largo, apellido compuesto
    "DE LA"). Probé la función combinada con 7 casos, incluyendo
    específicamente el caso que motivó todo esto (RESICO + nombre propio
    → Física, RESICO + razón social con S.A. DE C.V. → Moral) y que un
    régimen exclusivo de moral gana incluso si la razón social pareciera
    un nombre propio. Extendí también `verificar-mysql.js` con los mismos
    casos representativos contra las funciones reales.
67. **Campo "Razón Social" nuevo, debajo de "Régimen fiscal" en
    Configuraciones fiscales.** Continuación directa del punto 65/66 —
    el usuario pidió específicamente reutilizar
    `extraerNombreRazonSocial()` (la función ya existente y ya depurada,
    usada en `csf.html`) "para no cometer el mismo error de lectura".

    **Ya estaba resuelto a medias**: el endpoint
    `POST /api/admin/config/constancia-compania` YA extraía la razón
    social desde el punto 66 (la necesitaba como segunda señal para
    `determinarTipoPersona()`), pero nunca la guardaba en la
    configuración ni la mostraba en ningún lado — solo la usaba de paso
    para el cálculo y la descartaba. Este punto fue, en esencia, dejar de
    tirar un dato que ya se estaba leyendo correctamente.

    - `config.js`: nuevo campo `razon_social_compania` (mismo patrón que
      `regimen_fiscal_compania` — string, vacío por defecto, sin
      validación de formato más allá de recortar espacios, ya que es
      texto libre).
    - `server.js`: una sola línea agregada al `setConfiguracionGlobal()`
      del endpoint (`razon_social_compania: razonSocial`) — la variable
      `razonSocial` ya existía en ese punto del código.
    - Frontend: caja de solo lectura idéntica en estilo a "Régimen
      fiscal" (mismo componente `.admin-config-readonly-box`, reutilizado
      tal cual), colocada justo debajo como se pidió — con su propia
      función `aplicarRazonSocialCompaniaBox()`, gemela de
      `aplicarRegimenFiscalCompaniaBox()`, llamada en los mismos dos
      lugares (`cargarConfigGlobal()` y después de subir la constancia).

    **Pruebas**: extendí el mismo bloque de `verificar-mysql.js` de los
    puntos 65/66/67 con `setConfiguracionGlobal()` guardando y leyendo la
    razón social correctamente, restaurando el valor real al terminar
    junto con los demás campos fiscales de la compañía.
68. **Tercera señal para Física/Moral, con la MÁXIMA prioridad: los
    campos que trae el propio documento.** El usuario reportó que la
    regla seguía fallando en la práctica (régimen + razón social, del
    punto 66, no bastaban) y propuso él mismo una señal más directa:
    "Primer Apellido"/"Segundo Apellido" en el texto → Física; "Régimen
    Capital"/"Nombre Comercial" → Moral — basada en que el propio formato
    de la constancia del SAT usa campos DISTINTOS según el tipo de
    contribuyente (una persona moral no tiene apellidos; una persona
    física no tiene régimen de capital ni nombre comercial).

    **Por qué esta señal es más confiable que las otras dos**: el régimen
    fiscal y la razón social son señales INDIRECTAS (se infiere el tipo
    de persona a partir de otro dato) — esta nueva señal en cambio lee
    DIRECTAMENTE la estructura del formulario que ya llenó el SAT, así
    que se le dio la prioridad más alta de las tres: si es concluyente,
    gana siempre, incluso sobre un régimen con código exclusivo de moral
    o sobre una razón social que parezca contradecirla.

    **Implementación**: `determinarTipoPersonaPorCamposDocumento(texto)`
    en `pdfExtract.js` — búsqueda simple de las 4 frases clave sobre el
    texto ya normalizado (minúsculas, sin acentos). `determinarTipoPersona()`
    ahora recibe un tercer parámetro (el texto completo del PDF) y
    consulta esta señal PRIMERO, antes de las otras dos ya existentes —
    el orden de prioridad completo quedó: campos del documento → régimen
    exclusivo de moral → razón social → default a Física. El endpoint
    `POST /api/admin/config/constancia-compania` ya tenía el texto
    completo del PDF disponible en una variable (`textoPdf`), así que
    solo hizo falta pasarlo como argumento adicional, sin releer nada.

    **Pruebas**: probé la señal nueva en aislamiento (6 casos: cada una
    de las 4 frases clave por separado, sin ninguna, y con acentos para
    confirmar que la normalización los quita correctamente) y la función
    combinada completa con los casos de PRIORIDAD que más importaban —
    campos del documento diciendo Física ganando sobre un régimen 601
    (exclusivo de moral), y campos del documento diciendo Moral ganando
    sobre una razón social que parecía un nombre propio — 10 casos en
    total, todos pasando antes de integrar el cambio al endpoint real.
    Extendí también `verificar-mysql.js` con los mismos casos
    representativos contra las funciones reales.
69. **Bug real reportado con un PDF real: la constancia de la propia
    ADDV (persona moral) se clasificaba como persona física.** El
    usuario subió el PDF real como evidencia — lo diagnostiqué contra el
    archivo real en vez de adivinar la causa.

    **Diagnóstico**: instalé temporalmente `pdf-parse` en este entorno
    (no estaba disponible) específicamente para correr
    `extraerTextoPdf()` — la misma función real del backend — contra el
    PDF que subió el usuario, y revisar el texto EXTRAÍDO tal cual,
    carácter por carácter, en vez de asumir cómo se vería. Encontré la
    causa exacta: el extractor de texto de este PDF (una tabla con
    celdas de etiqueta/valor) concatena celdas adyacentes SIN insertar
    ningún espacio entre ellas — la etiqueta real "Régimen Capital:" se
    extraía literalmente como `"RégimenCapital:"`, y "Denominación/Razón
    Social:" como `"Denominación/RazónSocial:"`. La señal por campos del
    documento (agregada en el punto 68, la de mayor prioridad) buscaba
    la frase con un espacio FIJO de por medio (`'regimen capital'`) —
    nunca la encontraba, y el código caía silenciosamente a las
    siguientes señales. Para esta constancia en particular, ninguna de
    las otras dos era concluyente tampoco: el régimen es 626 (RESICO, no
    exclusivo de moral) y la razón social real
    ("AGILE DEVELOPMENT AND DESIGN + VALUE,") tiene 6 "palabras" al
    separarla por espacios (el "+" cuenta como una más), fuera del rango
    de 2-5 que activa la regla de "nombre propio" — así que el resultado
    terminaba cayendo al valor por DEFECTO de
    `determinarTipoPersonaPorRegimen()`, que es Física.

    **Corrección**: cambié la búsqueda de `.includes('regimen capital')`
    (espacio literal fijo) a una expresión regular con `\s*` (cero o más
    espacios) — `/regimen\s*capital/` — tolerante a que las palabras
    vengan pegadas. Mismo cambio para las otras tres frases clave
    ("primer apellido", "segundo apellido", "nombre comercial").

    **Verificación contra el archivo real, no solo casos inventados**:
    antes de dar la corrección por buena, corrí el flujo COMPLETO
    (`extraerTextoPdf` → `extraerRFC` → `extraerNombreRazonSocial` →
    `extraerRegimenesFiscales` → `determinarTipoPersona`) contra el PDF
    real subido, confirmando que el resultado final ahora es `moral` —
    no solo probé la
    función aislada con un ejemplo construido a mano, sino el mismo
    camino exacto que recorre el endpoint real, con el mismo archivo que
    reportó el problema. Como antes, desinstalé `pdf-parse` y borré
    `node_modules` al terminar de diagnosticar.

    **Pruebas**: agregué a `verificar-mysql.js` el caso exacto sin
    espacio ("RégimenCapital:SOCIEDADANONIMADECAPITALVARIABLE",
    "PrimerApellido:RAMIREZ") y el caso real completo reconstruido con
    el texto tal cual lo extrae `pdf-parse` de esa constancia (incluyendo
    las etiquetas pegadas), confirmando que ahora resuelve correctamente
    a Persona Moral.
70. **Dos pedidos en un mismo turno: comparar los datos de compra
    capturados contra la foto del ticket en el admin, y "Otro" como tipo
    de pago con especificación.**

    **"Otro" en tipo de pago**: nueva opción en el catálogo `TIPOS_PAGO`
    (backend) y en el dropdown de `tickets.html`, con un campo de texto
    que aparece solo al elegirla (y se limpia si el cliente cambia de
    opinión). Obligatorio especificar algo si se elige "Otro", sin
    importar si "tipo de pago" en general está configurado como opcional
    — "Otro" sin ningún detalle no le sirve de nada al administrador.
    - Nueva columna `tickets.tipo_pago_otro`, con migración.
    - **Encontré y corregí un problema real en la migración de la
      restricción CHECK existente**: el patrón ya usado en este proyecto
      para migraciones de restricciones ("agregar solo si no existe")
      sirve para restricciones NUEVAS, pero no para MODIFICAR una que ya
      existe — una instalación ya desplegada con la restricción vieja
      (sin "otro") se habría quedado así para siempre, y cualquier
      ticket con `tipo_pago="otro"` habría fallado con un error de CHECK
      sin explicación aparente para quien lo viera. La corrección: leer
      la definición REAL de la restricción existente
      (`INFORMATION_SCHEMA.CHECK_CONSTRAINTS`, columna `CHECK_CLAUSE`) y,
      si no incluye "otro" todavía, hacer `DROP CHECK` + volver a crearla
      con el valor nuevo.
    - En el modal de gestión del admin, si el tipo de pago es "otro", se
      muestra directamente lo que escribió el cliente (ej. "Vale de
      despensa") en vez de solo la palabra genérica "Otro" — es la parte
      que de verdad le sirve al administrador.

    **Comparar los datos de compra contra la foto**: nueva caja en el
    modal de gestión del ticket, colocada deliberadamente JUSTO ARRIBA de
    la foto (no en la cuadrícula de datos general) para poder cotejar
    visualmente uno contra el otro sin desplazarse — el pedido fue
    explícito en esto ("para comparar con el de la foto"). Muestra No.
    Compra, Fecha, Hora y Total.
    - En vez de guardar una copia separada de estos datos en cada ticket
      (duplicando información), `GET /api/admin/tickets` hace un
      `LEFT JOIN` con `ordenes_compra` a través de `orden_compra_id` ya
      existente — la orden de compra ES la fuente de verdad de estos
      datos, así que solo hacía falta traerlos, no guardarlos de nuevo.
    - La fecha/hora de la orden se formatea con la MISMA zona horaria
      configurada actualmente (mismo patrón ya usado en todos lados de
      este proyecto), para que el administrador vea exactamente la misma
      fecha/hora que el cliente capturó.
    - La caja se oculta por completo (no se muestra vacía) cuando el
      ticket no tiene ninguna orden vinculada — ya sea porque se subió
      con "Orden de compra" desactivada, o porque es un ticket de antes
      de que existiera esa funcionalidad.

    **Pruebas**: extendí `verificar-mysql.js` con `tipo_pago="otro"`
    contra la restricción CHECK real (confirma que ya la acepta) y su
    especificación guardada correctamente; y con el mismo `LEFT JOIN`
    exacto que usa el endpoint real, confirmando que un ticket vinculado
    trae el No. Compra y Total correctos, y que uno sin orden vinculada
    trae esos campos en `null` (lo que hace que la caja se oculte).
    También probé la lógica de "qué texto de tipo de pago mostrar" y
    "cuándo mostrar la caja de comparación" en aislamiento antes de
    integrarlas al modal real.
71. **Feature enorme, la más grande de todo el proyecto hasta ahora:
    "Reportes" completo — configuración, generación automática antes de
    borrar por retención, envío manual, y una vista de lectura con
    filtros y exportación.** Se implementó en dos turnos consecutivos por
    su tamaño (backend primero, luego frontend), con checkpoints
    explícitos hacia el usuario en cada corte.

    **Dos tablas nuevas**: `reportes` (una fila por corrida — automática
    o manual —, con el Markdown COMPLETO ya armado guardado ahí mismo,
    para poder reenviarlo o descargarlo sin reconstruirlo) y
    `reporte_items` (un registro por cada ticket/orden capturado, con
    `ON DELETE CASCADE` hacia su reporte — probado explícitamente que se
    borran solos al borrar el reporte). Nuevo campo de configuración
    `correo_reportes`.

    **Motor central** (`utils/reportes.js`, nuevo): `generarContenidoMD()`
    arma el Markdown (resumen + tabla de tickets + tabla de órdenes),
    escapando el carácter `|` dentro de una celda para no romper la
    tabla — probado explícitamente con un valor real que lo contenía.
    `generarYEnviarReporte()` es el punto de entrada único: genera,
    guarda (Markdown + items estructurados), y manda el correo SI hay uno
    configurado — un fallo al enviar el correo NO impide que el reporte
    ya se haya guardado. Agregué soporte de adjuntos a `enviarCorreo()`
    (no existía) para poder mandar el `.md` como archivo adjunto real,
    no solo como texto pegado en el cuerpo.

    **El requisito central del pedido — generar el reporte ANTES de
    borrar**: reestructuré `ticketsCleanup.js` por completo, separando
    "obtener los vencidos" de "borrarlos" (antes eran un solo paso). La
    nueva `ejecutarLimpiezaConReporte()` encadena los tres pasos en
    orden estricto: obtener tickets Y órdenes vencidos (sin borrar nada
    todavía) → generar y guardar UN SOLO reporte combinado con ambos →
    solo entonces borrar. Si no hay nada vencido de ningún tipo, no se
    genera ningún reporte (uno vacío no le serviría a nadie). Mantuve
    `limpiarTicketsVencidos()`/`limpiarOrdenesVencidas()` como funciones
    independientes (ya no las llama `server.js`, pero las pruebas
    existentes que ya las usaban directamente se siguieron pasando sin
    tocarlas, ya que conservé la misma forma de retorno).

    **Envío manual** (`POST /api/admin/reportes/enviar`): a diferencia
    del automático (captura justo lo que está por borrarse), este
    captura los tickets/órdenes ACTIVOS creados en lo que va del mes
    calendario actual — decisión de diseño para que el botón "Enviar
    reporte" sirva como un "reporte del mes" bajo demanda, sin depender
    de que algo esté por vencer.

    **Exportación real**: agregué `exceljs` como dependencia nueva
    (instalé temporalmente para probarlo, confirmé con Python que el
    `.xlsx` generado es un ZIP válido de verdad, no un CSV disfrazado) —
    `generarExcelBuffer()` para Excel real, `generarCSV()` con BOM de
    UTF-8 al inicio (para que Excel en Windows no corrompa acentos al
    abrir el CSV directamente — un problema real y común, no un detalle
    menor) y escape correcto de comillas/comas.

    **Frontend**: botones "Configuración Reportes" y "Leer MD" junto a
    "Configuraciones globales", tal como se pidió. La vista de lectura
    se diseñó con la instrucción explícita de "buena UX/UI" en mente:
    selector de reporte con etiqueta legible (fecha + tipo + totales),
    tarjeta de resumen, fila de 4 filtros combinables (con debounce en
    el de texto), tabla de resultados, y un modal para el Markdown
    completo con su propio botón de descarga. Las exportaciones no son
    un `<a href>` simple — el endpoint está protegido, así que se piden
    con `fetch()` (mandando el header de autenticación) y el archivo se
    "descarga" creando una URL temporal a partir del blob de la
    respuesta, mismo patrón ya usado para descargar la factura/imagen de
    un ticket en este mismo panel.

    **Pruebas**: sin MySQL disponible en este entorno de generación
    (igual que en todo este proyecto), probé exhaustivamente lo que sí
    se puede probar aquí — `generarContenidoMD()`, `generarCSV()`,
    `generarExcelBuffer()`, las funciones de conversión ticket/orden →
    item de reporte, y el cálculo del rango del mes en curso — todo
    contra las funciones REALES (instalando temporalmente `mysql2`,
    `validator`, `exceljs` y `nodemailer` para poder cargar los módulos
    reales, no reimplementaciones simplificadas), verificando además con
    Python que el `.xlsx` generado es un ZIP válido de verdad. Extendí
    `verificar-mysql.js` con un bloque completo nuevo que sí corre contra
    MySQL real en tu entorno: `ejecutarLimpiezaConReporte()` de extremo a
    extremo (genera el reporte, confirma que el ticket/orden quedan
    guardados en `reportes`/`reporte_items` con los datos correctos, que
    el borrado ocurre DESPUÉS, que `ON DELETE CASCADE` limpia los items
    automáticamente, y que sin nada vencido no se genera nada), más
    `correo_reportes` y las tres funciones de generación de contenido.
72. **Bug real reportado en "Enviar reporte", más subir/visualizar un
    archivo `.md` en "Leer MD".**

    **El bug**: "Enviar reporte" mostraba un error y no enviaba nada.
    Revisé el endpoint completo a fondo buscando un fallo real de
    lógica/sintaxis antes de asumir nada — la causa resultó ser una
    decisión de diseño equivocada del punto 71, no un error de código:
    el endpoint devolvía un status HTTP de error (400) cuando no había
    un correo de reportes configurado, aunque el reporte SÍ se hubiera
    generado y guardado con éxito (ya disponible para consultarse en
    "Leer MD"). El frontend, al ver cualquier respuesta con `!res.ok`,
    lo mostraba como "no se pudo enviar el reporte" — un mensaje que no
    reflejaba lo que en realidad había pasado.

    **Corrección**: "sin correo configurado" dejó de ser un error HTTP
    — ahora el endpoint siempre responde 200 si el reporte se generó y
    guardó correctamente, con `correoEnviado: true/false` indicando si
    además se mandó por correo. El frontend distingue los dos casos con
    un mensaje de éxito distinto para cada uno ("Reporte generado y
    enviado a..." vs "Reporte generado y guardado — configura un correo
    de reportes arriba para también enviarlo por correo"). Solo se
    conserva como error real (502) el caso en que SÍ había un correo
    configurado pero el envío en sí falló (ej. SMTP roto) — ahí el
    reporte también ya se guardó, pero el intento explícito de enviarlo
    de verdad no se cumplió, así que sí amerita un aviso de error.
    Probé la lógica de las tres respuestas posibles en aislamiento antes
    de aplicar el cambio.

    **Subir un archivo `.md`**: nuevo campo de archivo junto al selector
    de reportes en "Leer MD", con un separador visual "o" entre ambos
    caminos. Se lee con `FileReader` directamente en el navegador (sin
    mandar nada al servidor — es solo texto plano) y se muestra en el
    MISMO modal que ya usa "Ver Markdown completo", reutilizando esa
    interfaz en vez de construir una segunda. El título del modal y el
    nombre del archivo al descargar cambian según se esté viendo un
    reporte guardado o uno subido.
73. **El bug del punto 72 seguía sin resolverse: 500 real ("Ocurrió un
    error interno").** La corrección anterior (no tratar "sin correo
    configurado" como error) era correcta pero no era la causa real de
    ESTE error — un 500 genuino significa una excepción sin manejar, no
    una de mis respuestas de error controladas (400/502), así que
    revisé el endpoint de punta a punta buscando la causa real en vez de
    reaplicar el mismo diagnóstico.

    **La causa real**: `reporte_items.rfc` se había declarado como
    `VARCHAR(13)` — dimensionado pensando solo en un RFC. Pero para una
    ORDEN de compra, ese mismo campo guarda el **correo** del cliente
    (una orden no tiene su propio RFC guardado, ver el punto 71), y un
    correo normal excede 13 caracteres con facilidad. MySQL en modo
    estricto (el que usa por defecto) rechaza el `INSERT` completo con
    un error de "dato demasiado largo" en vez de truncarlo en silencio
    — eso es lo que tumbaba el endpoint con un 500.

    **Autocrítica honesta sobre por qué esto no se detectó antes**: la
    prueba que ya existía en `verificar-mysql.js` desde el punto 71 SÍ
    usaba un correo de prueba de más de 13 caracteres (`EMAIL_PRUEBA`,
    29 caracteres) — es decir, esa prueba SÍ habría detectado este bug
    exacto de haberse podido correr contra MySQL real. El problema es
    que este entorno de generación no tiene MySQL disponible (ver
    "Limitaciones de este entorno" más abajo, ya documentado desde hace
    varios turnos) — solo pude validar sintaxis (`node --check`) y
    lógica pura sin base de datos, nunca la restricción real de tamaño
    de columna contra un `INSERT` real. Este es exactamente el tipo de
    bug que ese hueco de cobertura no puede atrapar, y por eso
    `verificar-mysql.js` existe para correrse en tu entorno.

    **Corrección**: se ensanchó `rfc` a `VARCHAR(200)` (mismo tamaño que
    ya usa `ordenes_compra.email`, ya que ahí es de donde sale ese
    valor para una orden). Agregué una **migración** para instalaciones
    donde la tabla ya se había creado con el tamaño viejo (muy probable
    en este caso, ya que el usuario ya había intentado usar la función)
    — revisa el tamaño real de la columna en
    `INFORMATION_SCHEMA.COLUMNS` y la ensancha con `ALTER TABLE ...
    MODIFY COLUMN` si todavía tiene el tamaño insuficiente. Revisé
    también las demás columnas de `reporte_items` (`identificador`,
    `estatus_o_concepto`, `monto`) contra sus columnas de origen
    (`folio`/`numero_compra`, `estatus`/`concepto`, `total`) para
    confirmar que no hubiera más discrepancias del mismo tipo — no las
    hay.

    **Nota aparte**: en el camino de escribir el comentario explicativo
    de este cambio, escribí por error un comentario con sintaxis de
    JavaScript (`//`) DENTRO de la cadena SQL del `CREATE TABLE` —
    hubiera roto la sentencia SQL por completo. Lo detecté y corregí de
    inmediato (moviendo la explicación a un comentario de JS normal,
    fuera de la cadena SQL) antes de seguir adelante, verificando con
    `node --check` después del arreglo.

    **Pruebas**: agregué una prueba explícita en el mismo bloque de
    `verificar-mysql.js` del punto 71, confirmando específicamente que
    el correo completo de prueba (con su longitud real, mayor a 13
    caracteres) se guarda SIN truncarse en `reporte_items.rfc`.
74. **El mismo error 500 seguía apareciendo después de la corrección del
    punto 73 — el usuario pidió verificar de nuevo.** La corrección
    anterior era real y necesaria, pero no era la causa completa. Releí
    `utils/reportes.js` completo, línea por línea, sin asumir que ya
    había encontrado todo el problema.

    **La causa real, esta vez**: el pool de MySQL de este proyecto usa
    `dateStrings: true` (configurado así desde hace muchos turnos atrás,
    documentado en un comentario en `db.js`) — cualquier columna
    DATETIME llega a JavaScript como **texto plano**
    ("2026-07-15 14:00:00"), no como un objeto `Date`. `generarContenidoMD()`
    pasaba `fecha_registro` de cada ticket/orden DIRECTAMENTE a
    `formatearFechaHoraMexico()`, que usa `Intl.DateTimeFormat`
    internamente — y esa API, al recibir un string en vez de un
    Date/timestamp, no lo interpreta como fecha: lo intenta convertir a
    número (`NaN`) y lanza `RangeError: Invalid time value`. Confirmé
    esto reproduciendo el error exacto en una prueba aislada antes de
    tocar nada, y también confirmé que el código VIEJO (sin la
    conversión) sí fallaba con ese mismo error, para no quedarme con la
    duda de si en realidad era otra cosa.

    **Por qué esto SÍ se le habría escapado a mis pruebas anteriores en
    aislamiento**: las pruebas de `generarContenidoMD()`/`generarCSV()`/
    `generarExcelBuffer()` que ya existían en `verificar-mysql.js` usaban
    `new Date()` directamente para `fecha_registro` en sus datos de
    prueba — un Date real, no un string — así que esa prueba en
    particular jamás iba a toparse con este bug, sin importar cuántas
    veces se corriera. La ÚNICA prueba que sí lo habría atrapado era
    `ejecutarLimpiezaConReporte()` contra MySQL real (que trae filas
    reales, con fechas como texto de verdad) — pero esa, como ya se
    documentó, no se pudo ejecutar en este entorno de generación por no
    tener MySQL disponible.

    **Corrección**: nueva función `aFechaSegura(valor)` en
    `reportes.js` — conviene un valor que puede llegar como string de
    MySQL O como Date real (o `null`/inválido) a un Date real de forma
    segura, sin lanzar nunca una excepción (regresa `null` si no se
    puede). Se aplicó en los CUATRO lugares donde `reportes.js` recibe
    una fecha que podría venir de una fila real de MySQL:
    `fecha_registro` de cada ticket/orden dentro de
    `generarContenidoMD()`, los parámetros `rangoInicio`/`rangoFin` de
    esa misma función, y `fecha_registro` dentro de `itemsAFilas()`
    (usada por la exportación a CSV/Excel) — este último ya tenía un
    intento de conversión (`new Date(item.fecha_registro)`), pero sin el
    patrón explícito de forzar UTC ya establecido en el resto del
    proyecto, así que se unificó también por consistencia y
    confiabilidad entre entornos, no solo porque fallara.

    **Pruebas**: agregué a `verificar-mysql.js` una prueba de
    `aFechaSegura()` en aislamiento (4 casos: string de MySQL, Date
    real, `null`, texto inválido) y, más importante, una prueba de
    extremo a extremo con datos EXACTAMENTE como MySQL los devuelve de
    verdad (fechas como texto plano) pasados a `generarContenidoMD()`,
    confirmando que ya no lanza ninguna excepción y que las fechas se
    formatean correctamente en el resultado.
75. **En "Leer MD": se quitó "subir archivo .md" (ya no hacía falta) y
    se agregó "Eliminar reporte" en su lugar.** Pedido directo y
    acotado — quité limpiamente todo rastro del campo de subida
    (HTML, CSS, DOM refs, el listener de `FileReader`) en vez de solo
    ocultarlo, y confirmé con un `grep` que no quedó ninguna referencia
    colgante en ningún archivo del frontend antes de seguir.

    **Nuevo endpoint** `DELETE /api/admin/reportes/:id` — un `DELETE`
    simple sobre la tabla `reportes`; sus items en `reporte_items` se
    borran solos gracias al `ON DELETE CASCADE` que ya existía desde que
    se creó la tabla (punto 71) — no hizo falta escribir ninguna lógica
    de borrado en cascada a mano. Devuelve 404 si el `affectedRows` del
    `DELETE` es 0 (el reporte ya no existía).

    **Frontend**: nuevo botón "Eliminar reporte" junto a "Ver Markdown
    completo", habilitado/deshabilitado en los mismos dos lugares donde
    ya se controlaba ese otro botón. Reutiliza el modal de confirmación
    GENÉRICO que ya usa el resto del panel (`abrirConfirmacion()`) en
    vez de construir uno nuevo — a diferencia de constancias/tickets,
    "Reportes" no tiene papelera, así que el mensaje de confirmación lo
    deja claro: es un borrado permanente. Al confirmar, se limpia la
    vista y se vuelve a cargar la lista de reportes para que el
    eliminado ya no aparezca en el selector.

    **Pruebas**: agregué a `verificar-mysql.js` una prueba que reproduce
    exactamente la lógica del endpoint (crear un reporte de prueba,
    borrarlo y confirmar `affectedRows = 1`, volver a borrar el mismo id
    y confirmar `affectedRows = 0` — la misma condición que usa el
    endpoint real para decidir cuándo responder 404). El comportamiento
    de `ON DELETE CASCADE` en sí ya estaba cubierto desde el punto 71, no
    hizo falta repetirlo.
76. **Reorganización de "Reportes" + campo "quién atendió el ticket" en
    el contenido del reporte.**

    **"Configuración Reportes" pasó de ser un botón/vista separado a
    ser una tarjeta más dentro de "Configuraciones globales"**, justo
    después de "Correo electrónico (SMTP)" como se pidió — quité el
    botón de navegación y el contenedor de vista independientes por
    completo (no solo los oculté), confirmando con búsquedas que no
    quedó ningún rastro colgante. Se carga junto con el resto de
    "Configuraciones globales" (`cargarConfigReportes()` ahora se llama
    desde el mismo bloque que ya cargaba `cargarConfigCampos()`/
    `cargarInfoUsoCfdi()`/`cargarConfigGlobal()`), en vez de tener su
    propio disparador de carga separado.

    **"Leer MD" se renombró a "Reportes"** — cambio de solo el texto
    visible del botón, sin tocar ningún id interno (`btn-vista-lectura-
    reportes`, `vista-lectura-reportes` se quedaron igual), para no
    arriesgar romper nada innecesariamente por un cambio puramente de
    etiqueta.

    **Campo "Atendido por" en el contenido del reporte** — mismo valor
    que ya existía (`tickets.actualizado_por`, el usuario de la sesión
    que hizo el último cambio de estatus/notas de un ticket, agregado en
    el punto 63), ahora también capturado dentro de cada reporte
    generado:
    - Nueva columna `reporte_items.atendido_por`, con migración para
      instalaciones existentes. Se queda `NULL` para una orden de
      compra (ese concepto no aplica ahí).
    - Se incluye tanto en el reporte automático (antes del borrado) como
      en el manual — un solo cambio en `ticketAItemReporte()`
      (`ticketsCleanup.js`) y en el mapeo de tickets del endpoint manual
      (`server.js`) cubrió ambos casos, ya que los dos alimentan la
      misma función central `generarYEnviarReporte()`.
    - Nueva columna "Atendido por" en la tabla de tickets del Markdown
      (no en la de órdenes, ya que no aplica ahí), en los encabezados de
      exportación CSV/Excel, y en la tabla de "Reportes" del panel.

    **Dos errores de sintaxis cometidos y corregidos en este mismo
    turno**: por segunda vez en este proyecto, escribí un comentario con
    sintaxis de JavaScript (`//`) dentro de una cadena SQL de
    `CREATE TABLE` — esta vez me pasó dos veces seguidas al agregar la
    columna `atendido_por`. Ambas veces lo detecté de inmediato (antes
    de seguir con el resto del cambio) y lo corregí moviendo la
    explicación a un comentario de JS normal, fuera de la cadena SQL,
    verificando con `node --check` después de cada corrección.

    **Pruebas**: extendí el ticket de prueba que ya usa el bloque de
    `verificar-mysql.js` de los puntos 71-75 con un `actualizado_por` de
    prueba, y agregué aserciones confirmando que ese valor llega
    correctamente hasta `reporte_items.atendido_por` y hasta el
    Markdown generado. También extendí la prueba de
    `generarContenidoMD()`/`generarCSV()` con un item que trae
    `atendido_por`, confirmando que ambas salidas incluyen la columna.
    Probé todo esto en aislamiento (instalando temporalmente las
    dependencias necesarias) antes de dar el cambio por terminado.
77. **Tres pedidos en un mismo turno: filtro de Estatus en Reportes,
    renombrar "Estatus o concepto" a "Estatus", y las 4 tarjetas de
    "Configuraciones globales" del mismo tamaño.**

    **Filtro "Estatus"**: nuevo desplegable en "Lectura de reportes"
    (Pendiente/En curso/Cancelado/Listo/Todos) — filtra sobre la columna
    compartida `estatus_o_concepto`, así que en la práctica solo
    empareja tickets (el concepto libre de una orden no coincidiría con
    uno de esos cuatro valores exactos). Se agregó tanto a
    `GET .../items` como a `GET .../exportar`, con la MISMA validación
    de valores permitidos en los dos, para que exportar respete
    exactamente el mismo filtro que se está viendo en pantalla — mismo
    criterio ya establecido con los otros filtros de esta vista. Se
    resetea correctamente al cambiar de reporte o al limpiar filtros
    (agregado en los 3 lugares donde ya se reseteaban los demás
    filtros, no solo en uno).

    **"Estatus o concepto" → "Estatus"**: cambio de solo texto/etiqueta
    en 3 lugares que tenían que quedar consistentes entre sí — el
    encabezado de la tabla en el panel, el `data-label` de la celda (que
    controla la etiqueta que se ve en la vista de celular, donde las
    columnas se apilan), y el encabezado compartido de exportación
    CSV/Excel (`ENCABEZADOS_EXPORTACION` en `reportes.js`).

    **Las 4 tarjetas del mismo tamaño**: encontré la causa real antes
    de tocar nada — no era solo que "Correo electrónico (SMTP)" tuviera
    la clase de ancho completo (`config-card-full-width`, que forzaba
    esa tarjeta a ocupar las 2 columnas de la cuadrícula y empujaba lo
    siguiente a una fila nueva), sino que además "Configuración
    Reportes" era la ÚNICA de las 4 que empezaba **expandida** por
    defecto (`aria-expanded="true"` y sin el atributo `hidden` en su
    cuerpo) mientras las otras 3 empiezan colapsadas — confirmé esto
    revisando el atributo `hidden` real de cada una, no solo
    `aria-expanded`, ya que ambos tienen que estar en el mismo estado
    para que el colapso funcione de verdad. Corregí las dos causas:
    quité la clase de ancho completo de SMTP, e hice que Reportes
    también empiece colapsada — así las 4 arrancan con la misma altura
    (solo su encabezado) en la cuadrícula 2x2 ya existente
    (`grid-template-columns: repeat(2, 1fr)`), formando el "segmento de
    4 ventanas bien acomodadas" pedido. Quité también la regla CSS
    `.config-card-full-width` por completo, ya que después de este
    cambio no la usa ningún elemento.

    **Verificación visual**: rendericé las 4 tarjetas colapsadas con
    `wkhtmltoimage` antes de dar el cambio por terminado, confirmando
    que se ven como una cuadrícula 2x2 pareja — 2 tarjetas por fila, la
    misma altura entre sí.

    **Pruebas**: extendí el bloque de `verificar-mysql.js` de los
    puntos 71-76 con el filtro de estatus, reproduciendo el mismo query
    exacto que usan los endpoints reales — confirma que filtrar por
    "listo" encuentra el ticket de prueba (que sí tiene ese estatus, ya
    insertado con ese valor desde antes) y que filtrar por "cancelado"
    no lo encuentra.

    **Un cuarto bug encontrado (y corregido) al verificar el `.zip` ya
    empaquetado, no antes**: hice un `grep` de "Estatus o Concepto"
    sobre el `.zip` final para confirmar que el renombre había quedado
    consistente en todos lados, y SÍ apareció una referencia que se me
    había pasado: `generarExcelBuffer()` decidía el ANCHO de cada
    columna comparando el título contra el texto viejo
    (`titulo === 'Estatus o Concepto' ? 32 : 20`) — después del
    renombre, esa comparación ya nunca coincidía, así que la columna se
    quedaba con el ancho angosto por defecto (20) a pesar de que sigue
    necesitando ser ancha (también guarda el concepto, texto libre, de
    una orden de compra). Corregí la comparación al texto nuevo, y antes
    de dar el arreglo por bueno probé leyendo el `.xlsx` ya generado de
    vuelta con `exceljs` — en el camino descubrí que la propiedad
    `.header` de una columna NO se preserva al releer un workbook ya
    escrito (es una propiedad de solo escritura para definir columnas,
    no de lectura) — así que el valor real hay que leerlo de la celda
    de la fila 1 (`getRow(1).getCell(4).value`), no de `columna.header`.
    Agregué esta prueba corregida a `verificar-mysql.js`.

78. **Rediseño de UX/UI de la vista "Usuarios" — pedido abierto ("se ve
    muy grande y desacomodado"), sin una lista de cambios específica.**
    Antes de tocar nada, revisé el HTML/CSS/JS real de esta vista para
    diagnosticar la causa concreta, en vez de adivinar.

    **Diagnóstico**: cada fila tenía TRES botones de texto completo
    ("Editar", "Restablecer contraseña", "Eliminar") — el segundo por sí
    solo ya hacía la columna de acciones más ancha que cualquier otra
    columna de la tabla, y con 6 columnas en total (RFC/usuario, Perfil,
    Correo, Teléfono, Registrado, Acciones), la tabla se sentía pesada y
    desbalanceada.

    **Corrección 1 — íconos compactos con tooltip**: los tres botones de
    texto se reemplazaron por íconos de 30×30px con `data-tooltip` (el
    mismo sistema de tooltips ya construido, con entrega delegada sobre
    `document`, así que los íconos generados dinámicamente por fila ya
    funcionan sin cablear nada extra) — mismo patrón ya usado para el
    ícono de nota interna en la lista de tickets. El de Eliminar tiene
    un tono rojo desde antes de pasar el cursor (no solo al hacer
    hover), para que su naturaleza destructiva sea evidente de un
    vistazo. En celular, donde la tabla se convierte en tarjetas
    apiladas, agregué una clase modificadora
    (`admin-row-actions-iconos`) para que estos íconos compactos sigan
    en una sola fila en vez de apilarse verticalmente como los botones
    de texto completo de las otras tablas (que sí necesitan apilarse,
    por ser más anchos) — evité `:has()` a propósito por compatibilidad
    de navegador más amplia, usando una clase explícita en su lugar.

    **Corrección 2 — columnas combinadas**: "Correo" y "Teléfono" se
    combinaron en una sola columna "Contacto" (correo arriba, teléfono
    abajo en tono más apagado, ya que el correo es el dato de contacto
    principal) — reduce la tabla de 6 a 5 columnas, y evita dos columnas
    casi siempre parcialmente vacías (no todo usuario captura teléfono)
    ocupando su propio espacio fijo cada una.

    Cambio puramente de frontend (HTML/CSS/JS) — ninguna lógica de
    backend ni de datos cambió, así que no hizo falta tocar
    `verificar-mysql.js` para este punto. Verifiqué el resultado
    renderizando la vista completa con `wkhtmltoimage` antes de dar el
    cambio por terminado.

79. **Auditoría fresca de Docker/confiabilidad, pedida porque "continúan
    las intermitencias del servicio".** No había una lista de síntomas
    específica — revisé de nuevo, desde cero, `docker-compose.yml`,
    ambos `Dockerfile`, `nginx.conf`, `docker-entrypoint.sh`, el pool de
    MySQL y la secuencia de arranque del backend, sin asumir que las
    mejoras ya hechas en el punto 57 (hace muchos turnos) seguían siendo
    suficientes — el hecho de que el usuario reportara que SEGUÍAN
    pasando era la señal de que faltaba algo, no de que hubiera que
    repetir el mismo diagnóstico de antes.

    **El hallazgo real, con más peso que todo lo demás revisado**: en
    `iniciar()`, `ejecutarLimpiezaAutomatica()` corría con `await` ANTES
    de `app.listen()` — es decir, el servidor no empezaba a aceptar NADA
    de tráfico hasta que esa limpieza terminara. Y esa función (desde el
    punto 71) puede disparar `generarYEnviarReporte()`, que a su vez
    manda un correo real por SMTP. El transportador de nodemailer no
    tenía ningún timeout explícito configurado — sus valores por
    defecto suman varios MINUTOS entre conexión/saludo/socket. Con un
    host SMTP lento, mal configurado, o que dejó de responder (pasa con
    cierta frecuencia con proveedores de correo), CADA reinicio del
    backend — no solo el primero: cualquier redeploy, o el propio límite
    de memoria tumbándolo — se quedaba sin aceptar tráfico durante ese
    tiempo completo. Esto es EXACTAMENTE el tipo de "intermitencia" que
    el usuario describe: no un fallo constante, sino ventanas
    recurrentes de indisponibilidad cada vez que el contenedor se
    reinicia por cualquier motivo.

    **Corrección 1**: se movió `ejecutarLimpiezaAutomatica()` para que
    corra DESPUÉS de `app.listen()`, sin `await` (la función ya tenía su
    propio try/catch interno desde que se escribió, así que llamarla sin
    esperarla no deja una promesa rechazada sin manejar — lo confirmé
    releyendo su código antes de asumirlo). El servidor ahora acepta
    tráfico normal de inmediato después de `ensureSchema()`, mientras la
    limpieza (y el correo, si aplica) corre en segundo plano.

    **Corrección 2**: se agregaron `connectionTimeout`/`greetingTimeout`/
    `socketTimeout` explícitos (10s/10s/20s) al transportador SMTP en
    `utils/email.js` — antes no había ninguno, dependiendo por completo
    de los valores por defecto de nodemailer.

    **Corrección 3**: se subió el límite de memoria del backend de 512m
    a 768m en `docker-compose.yml`. Revisé `package.json` y confirmé que
    `exceljs` y `pdf-parse` — ambas con picos de memoria conocidos al
    procesar archivos grandes — se agregaron DESPUÉS de que ese límite
    se fijó por primera vez (en el punto 57); un límite ya desactualizado
    para lo que la app hace ahora puede causar el mismo tipo de reinicio
    por OOM que el límite en sí mismo busca evitar.

    **Revisado y descartado como causa** (documentado para no
    reinvestigarlo si se vuelve a preguntar): el orden `ensureSchema()`
    antes de `app.listen()` en sí mismo está bien — confirmé que
    `app.listen()` nunca se llama antes de que el esquema esté listo, así
    que no hay ventana donde el health check pasara prematuramente. El
    reintento de conexión inicial a MySQL (`esperarConexion()`, ya
    existente) también sigue siendo correcto. `nginx.conf` (timeouts,
    upstream con keepalive, manejo de X-Forwarded-Proto) se revisó
    completo y no encontré nada que corregir ahí.

    **Pruebas**: cambio de configuración de arranque/infraestructura, no
    de lógica de negocio por endpoint — no aplica una prueba nueva en
    `verificar-mysql.js` de la forma en que las demás funcionalidades sí
    la tienen. Verifiqué en cambio, leyendo el código con cuidado, que
    `ejecutarLimpiezaAutomatica()` sigue capturando sus propios errores
    internamente (necesario para que sea seguro llamarla sin `await`), y
    que la variable `server` (usada después por el apagado ordenado) y
    `intervaloLimpieza` (usada después por `clearInterval()`) se siguen
    asignando correctamente tras la reordenación.

80. **Filtros de "Reportes" desproporcionados — pedido de análisis
    abierto, sin lista de síntomas específica.** Revisé el HTML/CSS real
    en vez de adivinar la causa a partir de la descripción.

    **La causa exacta, y es autocrítica**: cuando agregué el filtro
    "Estatus" (punto 77), la cuadrícula de filtros se quedó fija en
    `grid-template-columns: repeat(4, 1fr)` — correcta para los 4 campos
    que había ANTES de agregar Estatus, pero con Estatus ya son 5
    campos (Tipo de registro, Estatus, RFC/correo, Desde, Hasta) en una
    cuadrícula de 4 columnas: el quinto ("Hasta") quedaba solo en una
    fila nueva, con 3 espacios vacíos al lado — exactamente la
    "desproporción" reportada. No ajusté la cuadrícula en aquel
    momento al agregar el campo nuevo.

    **Corrección**: en vez de simplemente cambiar el número de columnas
    (lo que solo hubiera pospuesto el mismo problema si se agrega un
    filtro más en el futuro), agrupé "Desde" y "Hasta" en un solo campo
    visual **"Rango de fechas"**, con los dos `<input type="date">` uno
    junto al otro dentro de la misma celda de la cuadrícula, separados
    por un guión — el patrón ya esperado para filtros de fecha
    "desde/hasta" en la mayoría de las interfaces, y de paso resuelve el
    conteo: vuelven a ser exactamente 4 campos para 4 columnas. Los dos
    `<input>` conservan sus mismos `id` de siempre
    (`filtro-reporte-fecha-desde`/`filtro-reporte-fecha-hasta`), solo
    cambió su envoltorio HTML — confirmé con una comparación de `id`s
    entre `admin.html` y `admin.js` que no quedó ninguna referencia
    rota, así que no hizo falta tocar nada de JavaScript.

    Verifiqué el resultado renderizando la sección de filtros con
    `wkhtmltoimage` antes de dar el cambio por terminado. Cambio
    puramente de HTML/CSS — no aplica una prueba nueva en
    `verificar-mysql.js`.

81. **Auto-guardado en el interruptor "Habilitar Orden de compra".**
    Antes, este interruptor solo se persistía como parte del botón
    "Guardar cambios" general de la tarjeta "Configuraciones fiscales"
    (junto con IVA, zona horaria, Clave SAT y el link) — un interruptor
    ya es una acción completa y deliberada al hacer clic, así que
    depender de un segundo paso (encontrar y presionar "Guardar
    cambios") era fricción innecesaria, a diferencia de campos de texto
    donde sí tiene sentido esperar a que la persona termine de escribir.

    **Implementación**: nuevo listener de `change` sobre el checkbox
    que llama a `PUT /api/admin/config/global` mandando SOLO
    `ordenes_compra_habilitado` — el endpoint ya soportaba
    actualizaciones parciales desde que se construyó (patrón
    `!== undefined` en `setConfiguracionGlobal()`), así que no hizo
    falta ningún cambio de backend. Mientras se guarda, el checkbox se
    deshabilita (evita un segundo clic a medio guardar) y aparece
    "Guardando…" en un indicador de texto nuevo, en línea, junto a la
    descripción del interruptor — separado del toast general a
    propósito, porque un toast que aparece en una esquina de la pantalla
    es más fácil de pasar por alto que un mensaje justo junto al control
    que se acaba de tocar. Si el guardado falla, el checkbox **vuelve a
    su valor anterior** (revertir es obligatorio aquí: dejarlo mostrando
    un estado que en realidad nunca se guardó haría que la próxima vez
    que se cargue la configuración real "se revierta solo" sin
    explicación aparente) y el mensaje de error se queda visible hasta
    el próximo intento (a diferencia del de éxito, que se desvanece
    solo después de un momento).

    El botón "Guardar cambios" general de la tarjeta se dejó tal cual
    — sigue mandando el valor actual del interruptor junto con el resto
    de los campos, lo cual es inofensivo (ya estaría guardando el mismo
    valor que el auto-guardado ya persistió).

    **Pruebas**: probé en aislamiento la lógica de los dos flujos
    (éxito: se queda con el valor nuevo, estado "guardado"; error: se
    revierte al valor anterior, estado "error") antes de integrarla al
    handler real. Verifiqué también, renderizando el interruptor con
    `wkhtmltoimage`, que el nuevo texto de ayuda e indicador no rompen
    el diseño visual ya establecido del componente.

82. **Página de mantenimiento en nginx (robot arreglando un servidor,
    "En breve volveremos") + nginx apuntando a localhost en el puerto
    80.**

    **`mantenimiento.html` (nuevo)**: ilustración SVG dibujada a mano
    dentro del propio archivo (sin depender de ninguna imagen externa,
    para que la página funcione incluso sin conexión a internet — justo
    el escenario en el que más falta hace) — un robot con una llave de
    tuercas junto a un rack de servidor, con la llave animada (rotación
    sutil) y unas chispas parpadeando, ambas desactivadas si
    `prefers-reduced-motion` está activo. Reutilicé las mismas
    variables de color de `style.css` (copiadas dentro del `<style>` de
    la página, ya que es un archivo standalone que nginx sirve
    directamente, sin pasar por el resto de la app) para que no se
    sienta como una pantalla de error genérica ajena al sitio. Un script
    sin dependencias consulta `/api/health` cada pocos segundos
    (creciendo el intervalo en cada intento fallido, hasta un tope de
    20s, para no bombardear un servicio que ya está teniendo problemas)
    y recarga la página sola en cuanto vuelve a responder, más un botón
    "Reintentar ahora" para quien no quiera esperar.

    **Verificación real, no solo visual**: instalé `nginx-light`
    temporalmente en este entorno (con acceso a los repos de Ubuntu) y
    corrí `nginx -t` contra la configuración real — primero falló
    porque `map` no es válido fuera de un bloque `http {}` (el archivo
    está pensado para incluirse dentro del `http {}` de nginx, no para
    correr solo), así que envolví el archivo en un `http {}` mínimo para
    probarlo tal como se usa de verdad. Fui más allá de solo validar
    sintaxis: levanté una instancia real de nginx con el `upstream`
    apuntando a un puerto donde deliberadamente no había nada
    escuchando (simulando "backend caído"), y confirmé con `curl`:
    - `/api/health` → **503** + el HTML de mantenimiento con "En breve
      volveremos" en el cuerpo.
    - `/login.html` (página estática) → **200** normal — confirma que
      las páginas estáticas siguen funcionando sin depender del backend,
      tal como se documentó.
    - `/mantenimiento.html` visitada directamente → **200** normal.

    Nota honesta sobre el alcance real: la página de
    mantenimiento cubre las peticiones a `/api/` que fallan por el
    backend, no "todo el sitio" — nginx sirve las páginas HTML/CSS/JS
    directamente desde su propio disco, así que alguien que visite el
    sitio de cero durante una caída del backend sigue viendo la página
    normal (ej. login), y son las llamadas a la API DENTRO de esa
    página las que mostrarían el problema. Lo documenté así de claro en
    el README en vez de dar a entender que existe un "modo mantenimiento
    total" que no es lo que esta implementación realmente hace.

    **nginx apuntando a localhost puerto 80**: `server_name localhost;`
    explícito (antes `_`, un comodín genérico) en `nginx.conf`, y el
    mapeo de puertos en `docker-compose.yml` cambió de
    `${FRONTEND_PORT:-8080}:80` a `${FRONTEND_PORT:-80}:80` — para
    entrar directo a `http://localhost` sin agregar ningún puerto a la
    URL. **Implicación real que no dejé sin resolver**: el
    despliegue a producción ya documentado en el README (Nginx del host
    + dominio real + HTTPS) necesita el puerto 80 del host para SÍ
    MISMO — con el cambio de default, ambos nginx competirían por el
    mismo puerto. Actualicé tanto el README (el paso de configurar
    variables ahora indica agregar `FRONTEND_PORT=8080` si se va a
    seguir ese flujo de producción) como `.env.example` (el valor por
    defecto ahí también pasó a 80, ya que es el archivo que la gente en
    realidad copia con `cp .env.example .env`, y dejarlo en 8080 ahí
    hubiera anulado el cambio del default en `docker-compose.yml` sin
    que nadie lo notara).

83. **Restricción de acceso por perfil en admin.html — feature grande,
    implementada en dos turnos.**

    **Backend**: `requireAdminAuth()` (auth.js) ya asignaba
    `req.adminPerfil`, pero le daba el valor `'administrador'` tanto a
    ADMIN_USERS como a la cuenta de respaldo `admin` — los mezclaba con
    el sistema de perfiles granular que se creó después. Les asigné un
    perfil nuevo, `'super'`, que NO aparece en el mapa de restricciones
    del frontend (lo que ahí significa "sin restricciones") — decisión
    deliberada para no romper el mecanismo de acceso original de
    ninguna instalación que ya dependiera de ADMIN_USERS. Antes de hacer
    el cambio, confirmé con un `grep` que `req.adminPerfil` no se usaba
    en ningún otro lado de `server.js`, para no romper nada existente
    sin darme cuenta. `GET /api/admin/login` ahora también devuelve el
    `perfil` en la respuesta.

    **Un hallazgo que simplificó el trabajo**: releí la consulta que ya
    usa el mecanismo #3 de `requireAdminAuth()`
    (`WHERE rfc = ? AND perfil IN ('administrador', 'fiscal')`) y
    confirmé que el perfil "cliente" YA estaba bloqueado del panel a
    nivel de SQL, desde antes de este turno — no hizo falta construir
    nada nuevo para ese requisito específico del pedido, solo
    documentarlo con claridad.

    **Frontend**: mapa `RESTRICCIONES_PERFIL` con las vistas y tarjetas
    exactas pedidas para "administrador" y "fiscal", más una función
    `aplicarRestriccionesPerfil()` que oculta (no solo deshabilita)
    botones de navegación y tarjetas de "Configuraciones globales"
    según el perfil — con redirección automática si la vista por
    defecto del panel (Constancias) queda oculta para ese perfil.
    Encontré y corregí una colisión de nombres en el camino: ya existía
    una variable `usuarioActual` para otro propósito completamente
    distinto (el modal de restablecer contraseña de un usuario) —
    renombré la mía a `usuarioSesionActual` antes de que causara un
    error de "ya declarado".

    **Tabla "Perfiles y roles de acceso"**: nueva tarjeta colapsable
    dentro de "Usuarios", justo debajo de "Cuenta de respaldo admin",
    visible solo para el usuario `admin` exacto — igual que esa otra
    tarjeta (ni siquiera otras cuentas "super" la ven). Diseñada para
    escanearse de un vistazo: perfiles como filas, áreas del panel como
    columnas, símbolos ✓/— en vez de texto para la respuesta principal,
    con el detalle fino (qué tarjetas específicas dentro de
    "Configuraciones globales") como texto secundario más pequeño,
    subordinado al símbolo. La fila de "Cliente" usa `colspan` para una
    sola celda explicativa ("sin acceso al panel"), ya que ese perfil
    es cualitativamente distinto a los otros tres (no es "acceso
    parcial", es "ningún acceso"). Verifiqué el renderizado con
    `wkhtmltoimage` + análisis de distribución de color (confirmando
    que los tonos de acento/badge sí se aplicaron) antes de darlo por
    terminado.

    **Aclaración de seguridad que documenté explícitamente, sin
    dejarla pasar por alto**: esta restricción es a nivel de
    INTERFAZ — oculta botones/tarjetas del HTML, no agrega una segunda
    capa de autorización en el backend. Un perfil "administrador" o
    "fiscal" que conociera la URL exacta de un endpoint fuera de su
    alcance técnicamente podría seguir llamándolo de forma directa, ya
    que `requireAdminAuth` valida que la sesión sea válida, no todavía
    que el perfil tenga permiso sobre ESE endpoint en particular. Lo
    dejé explícito en el README (con un aviso, no enterrado en un
    detalle técnico menor) para no dar una falsa sensación de
    seguridad completa — añadir autorización por perfil en cada
    endpoint del backend es un cambio más grande, que no se pidió en
    este turno y que no asumí por mi cuenta.

    **Pruebas**: probé primero en aislamiento (fuera del repo) la
    lógica exacta del mapa de restricciones para los 3 perfiles, antes
    de integrarla. Extendí después `verificar-mysql.js` con la MISMA
    lógica reproducida ahí (para que quede como regresión permanente,
    no solo una prueba de un solo uso), confirmando que cada perfil ve
    exactamente el subconjunto de vistas/tarjetas documentado —ni una
    de más ni una de menos— y que "Cuenta de respaldo admin"/la tabla
    de perfiles distinguen correctamente al usuario `admin` exacto de
    cualquier otra cuenta "super".

84. **Segunda capa de autorización en el backend — pedido explícito de
    seguimiento al punto 83 ("implementa esa segunda capa como
    siguiente paso"), la tarea más grande de auditoría de este proyecto
    hasta ahora.**

    **Middlewares nuevos** (`auth.js`): `requireAdminArea(...perfiles)`
    — "super" siempre pasa; el resto se compara contra la lista de
    perfiles permitidos de esa ruta en particular, respondiendo 403 (no
    401 — la sesión ya es válida) si no coincide.
    `requireUsuarioAdminExacto` — para las dos rutas de "Cuenta de
    respaldo admin", exige `req.adminUser === 'admin'` literal, ni
    siquiera para otra cuenta "super" con nombre distinto.

    **Auditoría completa de los 46 endpoints de `/api/admin/*`, uno por
    uno**: antes de tocar nada, revisé en el FRONTEND real (no
    adivinando por el nombre de la ruta) en qué vista/tarjeta se usa
    cada endpoint, para categorizarlo en la misma área que ya usa la
    interfaz. En el camino encontré 3
    endpoints en formato de una sola línea
    (`app.post('/ruta', ..., (req, res) => {` todo junto) que mi primer
    script de inserción automatizada no detectó, porque busca el patrón
    multi-línea que usa el resto del archivo — `constancia-compania`,
    `catalogos/uso-cfdi/actualizar`, y `POST tickets/:id/factura` (los
    dos últimos con lógica de `upload.single()` invocada a mano dentro
    del handler). Los convertí a formato multi-línea para poder
    insertarles el middleware de la misma forma que al resto, en vez de
    tratarlos como casos aparte con una sintaxis distinta.

    **Un caso genuinamente especial que encontré en el camino**: `PUT
    /api/admin/config/global` guarda campos de DOS tarjetas con
    permisos distintos — la mayoría (IVA, zona horaria, etc.)
    pertenecen a "Configuraciones fiscales" (administrador + fiscal),
    pero `correo_reportes` pertenece a "Configuración Reportes" (solo
    administrador). Un solo `requireAdminArea()` no puede expresar eso
    — le agregué al handler una verificación adicional a nivel de
    CAMPO: si el cuerpo de la petición trae `correo_reportes`, se exige
    perfil administrador o super, sin importar que el resto de los
    campos de esa misma ruta sí acepten también a fiscal.

    **Verificación estructural antes de dar el trabajo por completo**:
    escribí un script que cuenta cuántos endpoints de `/api/admin/*`
    existen de verdad (con un regex que sí cubre tanto el formato
    multi-línea como el de una sola línea) contra cuántas inserciones
    de `requireAdminArea`/`requireUsuarioAdminExacto` quedaron en el
    archivo — confirmé 46 endpoints totales, 45 con su middleware de
    autorización, y exactamente 1 sin ninguno (`GET /api/admin/login`,
    correcto: es el propio chequeo de sesión, no tendría sentido
    "autorizar" antes de saber quién es).

    **Ajuste necesario en el frontend, sin el cual esto habría roto
    cosas silenciosamente**: `showDashboard()` y sus dos puntos de
    llamada (login y restauración de sesión) ya precargaban varias
    vistas de forma incondicional al iniciar sesión — `cargarConfigCampos()`,
    `cargarInfoUsoCfdi()`, `revisarTicketsPendientesSinContador()`, y
    `cargarRegistros()` (Constancias, la vista por defecto). Las cuatro
    son del área "fiscal" en el backend — con la nueva restricción, un
    perfil "administrador" habría recibido un 403 de fondo cada vez que
    iniciara sesión, sin que hiciera nada para provocarlo (silencioso
    porque esas llamadas ya fallan sin mostrar error, pero seguía siendo
    una petición innecesaria contra una ruta a la que ya no tiene
    acceso). Las condicioné a `perfilActual !== 'administrador'`.

    **Pruebas**: probé primero en aislamiento la lógica de ambos
    middlewares y la verificación de campo de `correo_reportes`, antes
    de integrarlos. Extendí después `verificar-mysql.js` importando las
    funciones REALES de `auth.js` (no una reproducción de su lógica,
    como si hice para el bloque del punto 83) — confirmando "super"
    pasa cualquier área, un perfil incluido pasa, uno no incluido se
    rechaza con 403, un área compartida deja pasar a ambos perfiles
    permitidos, y el caso de campo de `correo_reportes` se comporta
    exactamente como se documentó.

85. **Investigación a fondo pedida porque "el sistema deja de
    responder", con 429 apareciendo en consola — encontré la causa
    real, distinta de lo que ya se había revisado en los puntos 57 y
    79.** El usuario ya había subido la memoria del contenedor sin
    resultado, lo cual era una pista importante: descartaba un problema
    de recursos y apuntaba a algo puramente de configuración/código.

    **La causa real**: `adminLimiter` (50 solicitudes / 15 minutos,
    pensado para frenar fuerza bruta contra la contraseña del login) se
    aplicaba por igual a los otros 45 endpoints del panel — es decir, a
    cada clic normal de una sesión YA autenticada, no solo al intento
    de inicio de sesión. Hice el cálculo exacto antes de asumir nada:
    solo cargar el panel al iniciar sesión ya dispara 6 peticiones en
    paralelo (config fiscal, campos obligatorios, catálogo de Uso de
    CFDI, notificación de tickets pendientes, la tabla de Constancias),
    y navegar una vez por las 5 vistas principales agrega 12 más — 18
    peticiones en una sola sesión normal, lo que agota el límite de 50
    en apenas 2-3 recargas de página. Después de eso, CUALQUIER llamada
    del panel devuelve 429 durante el resto de esa ventana de 15
    minutos — exactamente el síntoma reportado. Reconstruir el
    contenedor "arreglaba" esto de forma temporal solo porque reinicia
    el contador en memoria de `express-rate-limit`, no porque el
    contenedor se hubiera caído de verdad — confirmé esto revisando que
    `/api/health` (lo que de verdad usa el healthcheck de Docker para
    decidir si el contenedor está sano) nunca tuvo ningún límite
    aplicado, así que Docker nunca lo habría marcado como no
    saludable por esta causa.

    **Corrección**: separé el límite en dos — `adminLoginLimiter`
    (50/15 min, exclusivo de `GET /api/admin/login`) y
    `adminApiLimiter` (2000/15 min, en los otros 45 endpoints, todos ya
    protegidos por una sesión válida vía `requireAdminAuth` — la
    protección real contra acceso no autorizado sigue siendo la
    autenticación, no un límite de solicitudes pensado para otra cosa).
    Hice el reemplazo de forma sistemática con un script (45
    ocurrencias de `adminLimiter,` → `adminApiLimiter,`, dejando
    aparte la del login), y confirmé después con un `grep` que no
    quedó ninguna referencia a la variable vieja (que ya no existe,
    habría lanzado un `ReferenceError` en tiempo de ejecución si se me
    hubiera pasado alguna).

    **Un segundo hallazgo real en el camino, al hacer la prueba
    funcional**: instalé `express`/`express-rate-limit` temporalmente
    para probar el cambio contra el paquete real (60 peticiones
    seguidas, más de las 50 que el límite viejo permitía) — la prueba
    pasó, pero `express-rate-limit` lanzó su propia advertencia:
    `app.set('trust proxy', true)` es una configuración "permisiva" que
    le permite a cualquier cliente mandar su propio encabezado
    `X-Forwarded-For` falso y evadir los límites por IP (incluyendo el
    de fuerza bruta del login). Lo corregí a `app.set('trust proxy',
    1)` — confiar exactamente en UN salto, el contenedor de nginx, el
    único proxy real que existe delante del backend en este
    `docker-compose.yml` — y repetí la misma prueba funcional
    confirmando que la advertencia ya no aparece y que el
    comportamiento sigue siendo correcto. No es la causa del problema
    original, pero es una brecha de seguridad real que no dejé pasar
    solo porque no era lo que se preguntó.

    **Pruebas**: instalé `express`/`express-rate-limit` temporalmente
    (como ya hice en turnos anteriores con `nginx`/`exceljs` para
    otros cambios de infraestructura) y levanté un servidor mínimo real
    con la configuración nueva, confirmando con 60 peticiones seguidas
    que las 60 pasan (antes se habrían cortado en la número 51) — antes
    y después del arreglo de `trust proxy`, para verificar ambos
    cambios de forma independiente. Cambio de configuración de
    infraestructura, no de lógica de negocio por endpoint — no aplica
    una prueba nueva en `verificar-mysql.js` de la forma en que las
    demás funcionalidades sí la tienen.

86. **Mover el interruptor "Habilitar Orden de compra" de "Configuraciones
    fiscales" a "Usuarios", y restringirlo al perfil Administrador.**
    Pedido acotado y claro — "Orden de compra" ya era un área exclusiva
    de Administrador desde el punto 83 (Fiscal no ve esa vista), pero el
    interruptor que la activa/desactiva seguía viviendo dentro de
    "Configuraciones fiscales", una tarjeta que SÍ ve Fiscal — una
    inconsistencia real: Fiscal no podía navegar a "Orden de compra",
    pero técnicamente sí veía y podía tocar el control que decide si esa
    función existe para todos.

    **Frontend**: moví el `<label class="switch-toggle">` completo
    (checkbox, hint, e indicador de autoguardado) a una tarjeta nueva y
    propia, "Orden de compra", al inicio de la vista "Usuarios" —
    colapsada por defecto, mismo patrón visual que "Cuenta de respaldo
    admin" y "Perfiles y roles de acceso" que ya viven ahí. A diferencia
    de esas dos (que además exigen el usuario "admin" exacto), esta
    tarjeta nueva no necesita ninguna restricción PROPIA aparte —
    "Usuarios" en sí ya es exclusiva de administrador + super desde el
    punto 83, así que Fiscal nunca llega a verla por el simple hecho de
    no poder navegar a esa vista en absoluto.

    **Backend**: `ordenes_compra_habilitado` se manda por el mismo
    endpoint compartido `PUT /api/admin/config/global` que ya tenía el
    caso especial de `correo_reportes` (punto 84) — le agregué la MISMA
    verificación de nivel de campo, reutilizando exactamente el patrón
    ya establecido en vez de inventar uno nuevo: si el cuerpo trae
    `ordenes_compra_habilitado`, se exige perfil `administrador` o
    `super`, aunque ese mismo perfil `fiscal` conserve acceso al resto
    de los campos de esa ruta (IVA, zona horaria, Clave SAT, link).

    **Pruebas**: probé la lógica de campo en aislamiento (fiscal
    rechazado, administrador y super permitidos) antes de integrarla, y
    extendí el mismo bloque de `verificar-mysql.js` del punto 84 con
    los tres casos equivalentes para `ordenes_compra_habilitado`.
    Verifiqué también, renderizando la tarjeta movida con
    `wkhtmltoimage`, que el cambio de ubicación no rompió nada visual.

87. **UX/UI puro: poner "Orden de compra" y "Cuenta de respaldo admin"
    (vista "Usuarios") al mismo nivel, una junto a la otra.** Pedido
    acotado explícitamente a solo diseño — "el resto se queda igual
    dentro del botón de usuarios". Sin cambios de lógica ni de backend
    en este punto.

    Envolví ambas tarjetas (y solo esas dos — "Perfiles y roles de
    acceso", con una tabla ancha adentro que sí necesita todo el ancho
    disponible, se queda fuera de la cuadrícula, en su propia fila
    completa por debajo) en un contenedor `.usuarios-tarjetas-compactas`
    con exactamente el mismo patrón de cuadrícula de 2 columnas ya usado
    en "Configuraciones globales" (`repeat(2, 1fr)`, colapsando a una
    columna en el mismo breakpoint de 760px) — reutilizar un patrón ya
    establecido en vez de inventar uno nuevo. Ningún id de elemento
    cambió, solo su envoltorio HTML, así que no hizo falta tocar nada de
    JavaScript — confirmé esto con la misma comparación automática de
    ids entre `admin.html` y `admin.js` ya usada en cambios de layout
    anteriores. Verifiqué el resultado renderizando el bloque completo
    con `wkhtmltoimage`, y además revisé programáticamente que ambas
    mitades de la imagen (izquierda y derecha) tuvieran contenido
    distinto cerca de la parte superior — confirmando que de verdad
    quedaron una junto a la otra, no una debajo de la otra con la mitad
    derecha en blanco.

88. **Arranque de la migración a multi-tenant (segmento 1 de 9) — el
    cambio de mayor alcance planeado hasta ahora en este proyecto.** El
    negocio va a crecer a >1000 usuarios repartidos en múltiples empresas
    cliente independientes, con URLs tipo `midominio.com/cliente1`
    (portal del cliente) y `midominio.com/cliente1/admin` (panel admin de
    esa empresa), cada una con sus datos completamente segmentados. Antes
    de tocar código se hizo un análisis completo del repo (protocolo
    `addv-web-app`, ya activo en este proyecto) y se diseñó un plan de 9
    segmentos, aprobado explícitamente por el usuario junto con 4
    decisiones de arquitectura clave:

    1. **Aislamiento de datos**: BD MySQL dedicada por tenant
       (`tenant_<slug>`) — no una sola BD compartida con columna
       `tenant_id`. Blast radius mínimo por diseño: un bug de query nunca
       puede mezclar datos entre empresas.
    2. **Orquestación HA**: Docker Swarm (no Kubernetes) — evoluciona el
       `docker-compose.yml` actual a un stack file, sin cambiar de
       ecosistema.
    3. **Datos actuales**: la BD `portal_facturacion` de hoy se migrará
       (segmento 6, todavía no hecho) como el PRIMER tenant real, no se
       descarta.
    4. **Credencial de BD/MinIO**: COMPARTIDA entre todos los tenants (un
       solo usuario `app`, un solo secreto) en vez de una credencial por
       tenant — decisión consciente que prioriza "dar de alta un cliente
       nunca debe requerir redeploy del backend" sobre aislamiento
       máximo de credenciales. Documentado como riesgo aceptado: si esa
       credencial se filtra, expone todas las BDs de tenant (mitigación:
       rotación periódica obligatoria como política).

    Los otros 5 segmentos (routing por tenant en nginx/backend, capa de
    datos multi-pool con `AsyncLocalStorage`, auth con clave HMAC
    derivada por tenant, MySQL HA + MinIO para uploads, endurecimiento de
    seguridad multi-tenant, stack de Swarm) están diseñados pero **no
    implementados todavía** — se ejecutan uno por uno, cada uno con su
    propia aprobación, para no arriesgar un cambio "big bang" en una app
    reputacional en producción. El diseño completo de la futura "app de
    control" (para dar de alta empresas desde una UI) también quedó
    especificado, pero es fase 2 explícita — no se construye en este plan.

    **Hallazgo clave que condicionó todo el diseño**: `pool` en
    `backend/db.js` es un singleton de módulo, capturado por referencia en
    6 archivos `utils/*` y ~150 call sites de `server.js`. El plan evita
    reescribir esos 150+ sitios usando un proxy de `pool` basado en
    `AsyncLocalStorage` (segmento 2, pendiente) — el código existente
    seguirá funcionando literalmente sin cambios.

    **Lo único implementado en este segmento** (sin tocar `server.js`,
    `db.js` ni ningún archivo existente — 100% código nuevo, aditivo):
    - `backend/utils/tenant.js`: reglas de slug compartidas
      (`SLUG_REGEX`, `SLUGS_RESERVADOS`, `validarSlug()`,
      `nombreDbTenant()`) — única fuente de verdad que reutilizará
      también el middleware de resolución de tenant del segmento 3, para
      que las dos partes del sistema nunca acepten/rechacen slugs
      distintos entre sí.
    - `backend/scripts/provisionar-tenant.js`: script de aprovisionamiento
      idempotente — asegura la BD `control_tenants` y sus tablas
      (`tenants`, `tenant_eventos`) y el `GRANT` amplio del usuario `app`
      sobre `` `tenant\_%` `` en cada corrida, valida el slug, rechaza
      altas duplicadas, crea la BD física `tenant_<slug>`, y le aplica el
      esquema completo de la app **reutilizando `ensureSchema()` de
      `db.js` sin modificarlo** — se invoca en un proceso hijo con
      `DB_NAME` apuntando a la base nueva (ese módulo fija su pool a un
      solo `DB_NAME` al cargarse). Este es un paso temporal a propósito:
      el segmento 2 parametriza `ensureSchema(pool)` para poder llamarlo
      in-process contra cualquier tenant sin un proceso hijo. Requiere
      credenciales de ROOT de MySQL — a propósito NUNCA se corre dentro
      del contenedor `backend` (que nunca las tiene montadas), se corre
      desde el host contra el puerto ya expuesto en `docker-compose.yml`.
    - `backend/test/unit/tenant.test.js`: 26 casos cubriendo
      `validarSlug()` (formato, longitud, cada slug reservado uno por
      uno) y `nombreDbTenant()` — toda la suite existente (275 pruebas,
      11 archivos) sigue en verde, cero regresiones, porque este segmento
      no tocó ningún archivo preexistente.

    **Importante para quien retome esto**: correr
    `provisionar-tenant.js` hoy prepara la base de datos de un tenant
    nuevo (crea `tenant_<slug>` con el esquema completo), pero **todavía
    no lo hace alcanzable por ninguna URL real** — el backend en
    ejecución sigue sirviendo un solo tenant fijo por `DB_NAME`, y nginx
    no resuelve `/<slug>/...` todavía. Eso llega en los segmentos 3 y 4.
    No se corrió este script contra ningún MySQL real desde este entorno
    (misma limitación que el resto del proyecto — ver la sección
    siguiente); solo se validó con `node --check` y la suite Jest.

89. **Segmento 2 de 9 del plan multi-tenant: `backend/db.js` refactorizado
    a registro de pools + proxy `AsyncLocalStorage`, `ensureSchema(db)`
    parametrizado.** Sin tocar `server.js` ni ningún archivo `utils/*`
    todavía (eso es el segmento 3) — el objetivo de este segmento era
    exclusivamente que `db.js` pudiera soportar múltiples pools SIN que el
    comportamiento actual (un solo tenant fijo por `DB_NAME`) cambiara en
    lo más mínimo, porque hoy nada establece todavía un contexto de tenant.

    **Cambios en `backend/db.js`**:
    - `pool` (la exportación que usan los ~150 call sites de `server.js` y
      los 6 archivos `utils/*`) dejó de ser el objeto de `mysql2` en sí
      mismo y pasó a ser un **`Proxy`** que delega cada `.query()`/
      `.execute()`/`.getConnection()`/`.end()`/etc. al pool "activo" en el
      contexto async actual (`AsyncLocalStorage`, variable `almacenTenant`),
      o al **pool por defecto** (la misma configuración fija por `DB_NAME`
      de siempre) si no hay ningún contexto establecido — que es el caso de
      TODO el código hoy. Resultado: `const { pool } = require('../db');
      pool.query(...)` sigue funcionando exactamente igual en cualquier
      archivo existente, sin tocar ni una línea de esos ~150 call sites.
    - `ejecutarComoTenant(tenantPool, fn)`: envuelve `fn` en
      `almacenTenant.run({ pool: tenantPool }, fn)` — esto es lo que el
      middleware de resolución de tenant (segmento 3, todavía no escrito)
      usará para que, durante una request, `pool.query(...)` resuelva al
      pool del tenant correcto sin que el código de la ruta sepa que existe
      multi-tenant.
    - `obtenerPoolTenant({ slug, host, port, user, password, database })`:
      registro de pools por tenant (`Map`), creación perezosa. Incluye
      cap LRU (`TENANT_POOL_MAX`, default 200 — evictúa el pool menos usado
      recientemente antes de crear uno nuevo al llegar al máximo) y un
      reaper (`setInterval` cada 5 min, `.unref()` para no mantener vivo el
      proceso por sí solo) que cierra pools inactivos por más de
      `TENANT_POOL_TTL_MS` (default 45 min). `TENANT_POOL_CONNECTION_LIMIT`
      (default 5) por tenant — deliberadamente más bajo que el `10` del
      pool por defecto de siempre, porque con cientos de tenants no se
      puede mantener un pool grande permanentemente abierto por cada uno
      (MySQL 8 trae `max_connections=151` por defecto). Fórmula documentada
      en el propio archivo para dimensionar estas variables frente al
      `max_connections` real del servidor.
    - `cerrarPoolTenant(slug)` / `purgarPoolsInactivos()` /
      `cerrarTodosLosPoolsTenant()`: expuestas (no solo como callbacks
      internos del reaper) porque también son útiles llamarlas a mano — la
      última, en particular, es candidata a integrarse al apagado ordenado
      de `server.js` (SIGTERM/SIGINT) en el segmento 3, junto con
      `pool.end()`, que ya existe ahí.
    - `obtenerPoolControl()`: pool fijo (no perezoso como los de tenant,
      pero sí de creación diferida al primer uso) para la BD de control
      `control_tenants` — con `connectionLimit: 5`. Todavía sin ningún
      consumidor real (ni `provisionar-tenant.js` del segmento 1 lo usa —
      ese script maneja su propia conexión root aparte — ni el backend en
      ejecución la consulta todavía); queda listo para cuando el segmento 3
      necesite resolver un slug contra esta tabla, y para la futura app de
      control (segmento 9).
    - `ensureSchema(db = pool)`: recibe el pool contra el que crear/migrar
      el esquema, con default = el proxy exportado (o sea, sigue
      resolviendo al pool por defecto si se llama sin argumentos, como
      hacen HOY los tres únicos llamadores existentes —
      `server.js`, `scripts/verificar-mysql.js`,
      `scripts/migrar-sqlite-a-mysql.js` — los tres siguen funcionando sin
      cambios). Todas las sentencias SQL de dentro (creación de tablas,
      migraciones `ALTER TABLE`/`INFORMATION_SCHEMA`, siembra de la cuenta
      `admin`) quedaron **exactamente iguales**, solo se renombró la
      variable `pool` → `db` (el parámetro) en cada una de las llamadas —
      cambio mecánico, sin tocar ninguna consulta.
    - `esperarConexion(db = pool, ...)`: mismo patrón, recibe el pool a
      esperar.

    **Por qué NO se usó inyección de dependencias explícita** (pasar
    `pool` como parámetro a cada función de los 6 archivos `utils/*` y a
    cada uno de los ~150 call sites de `server.js`) en vez del proxy de
    `AsyncLocalStorage`: es un refactor mecánico de superficie mucho mayor,
    con alto riesgo de que un call site se quede sin actualizar — que aquí
    sería el peor tipo de bug posible (una query de un tenant ejecutándose
    contra la base de datos de otro). El proxy concentra el riesgo en un
    solo archivo, bien probado, y dijo el código existente sin tocarlo.

    **Pruebas**: `backend/test/unit/db-multitenant.test.js`, 17 casos
    nuevos — mockeando `mysql2/promise` (no `db.js`, a diferencia del resto
    de la suite) para poder inspeccionar cuántos pools se crean/cierran sin
    MySQL real. Cubre: el pool por defecto se sigue creando exactamente una
    vez al cargar el módulo; `pool` sin contexto de tenant delega al pool
    por defecto; `obtenerPoolTenant` crea/reutiliza/diferencia por slug;
    `cerrarPoolTenant` cierra y permite recrear; el TTL cierra pools viejos
    y conserva los recientes (con `Date.now()` mockeado, sin esperas
    reales); el cap LRU evictúa el menos usado al llegar al máximo;
    `cerrarTodosLosPoolsTenant` cierra todo; `ejecutarComoTenant` aísla
    correctamente el contexto — incluyendo un caso de dos tenants resueltos
    en **paralelo** (`Promise.all`) que confirma que sus queries nunca se
    cruzan, la prueba más importante de seguridad de este segmento;
    `obtenerPoolControl` es perezoso y reutilizable; y `ensureSchema()`
    usa el pool por defecto sin argumentos pero el pool explícito que se le
    pase si se le da uno. Suite completa del proyecto: **367 pruebas, 18
    archivos, 0 regresiones** (350 antes de este segmento + 17 nuevas).

    **No se corrió nada de esto contra MySQL real** desde este entorno
    (misma limitación de siempre) — la validación fue `node --check` +
    toda la suite Jest (que mockea MySQL). El código de `ensureSchema()`
    en sí no cambió ninguna sentencia SQL, solo el nombre de la variable
    que la ejecuta, así que el riesgo de regresión de esquema es mínimo,
    pero **correr `backend/scripts/verificar-mysql.js` contra MySQL real
    sigue pendiente** antes de considerar este segmento verificado end to
    end.

90. **Segmento 3 de 9 del plan multi-tenant: middleware de resolución de
    tenant + sesión de cliente y Basic Auth de admin conscientes de
    tenant.** Este es el primer segmento que toca `server.js` (los
    segmentos 1-2 no lo tocaron). Contrato acordado en el diseño
    aprobado: a partir del segmento 4 (todavía no escrito), nginx
    reescribirá `/<slug>/api/*` → `/api/*` agregando el encabezado
    `X-Tenant-Slug: <slug>` — el backend nunca ve el prefijo en la URL,
    solo ese encabezado. **Mientras el segmento 4 no exista, NINGÚN
    tráfico real trae ese encabezado**, así que todo lo de este segmento
    queda completamente implementado y probado, pero sin ningún efecto
    observable en producción todavía — se probó poniendo el encabezado a
    mano (simulando lo que hará nginx), como preveía el plan
    ("probado bajo un prefijo fijo /piloto/\* antes de generalizar").

    **`backend/utils/tenantContext.js` (archivo nuevo)**:
    `resolverTenantMiddleware(req, res, next)` — si no hay encabezado
    `X-Tenant-Slug`, es un no-op (`return next()` inmediato, primera
    línea de la función: esto es lo que garantiza cero cambio de
    comportamiento para el tráfico real de hoy). Si lo hay: normaliza a
    minúsculas, valida el formato con `validarSlug()` (`utils/tenant.js`,
    del segmento 1 — 400 si es inválido o reservado), resuelve la fila
    contra la BD de control vía `obtenerPoolControl()` (`db.js`, del
    segmento 2 — 404 si no existe o no está `activo`), expone
    `req.tenant = { id, slug, nombreEmpresa }`, obtiene su pool con
    `obtenerPoolTenant()` y corre el resto del pipeline dentro de
    `ejecutarComoTenant()` (ambos también del segmento 2). Incluye una
    **caché en memoria con TTL** (`TENANT_CACHE_TTL_MS`, default 45s) para
    no golpear la BD de control en cada request — consistencia eventual
    entre réplicas, ya aceptada como riesgo en el diseño del plan (la
    alternativa, un bus de invalidación tipo Redis/pub-sub, no existe
    todavía en este stack). `invalidarCacheTenant(slug?)` exportada para
    cuando la futura app de control (segmento 9) necesite invalidar tras
    dar de alta/suspender un tenant.
    - Montado en `server.js` con `app.use(resolverTenantMiddleware)`
      justo después de `app.use(cookieParser())` — antes de CUALQUIER
      ruta, para que rate limiters, `requireUserAuth`, `requireAdminAuth`
      y las rutas mismas puedan usar `req.tenant`.

    **`backend/utils/authUsuario.js` — sesión de cliente consciente de
    tenant**:
    - El payload del token pasa de `{rfc, exp}` a `{rfc, tid, exp}`
      (`tid` = slug del tenant, o `null` sin tenant).
    - **La firma HMAC ya no usa el secreto maestro (`SESSION_SECRET`)
      directamente cuando hay tenant** — `claveParaTenant(slug)` deriva
      una subclave de 32 bytes con `crypto.hkdfSync('sha256',
      SESSION_SECRET, '', slug, 32)` (HKDF real, RFC 5869, nativo de
      Node). Un token firmado para "cliente1" **falla la verificación de
      FIRMA** contra "cliente2" — no solo el chequeo del campo `tid` (que
      también se verifica, como defensa en profundidad adicional, nunca
      como el único mecanismo). Sin tenant, se sigue firmando con
      `SESSION_SECRET` tal cual — idéntico a antes de este segmento.
    - `crearTokenSesion(rfc, tenantSlug = null)`,
      `verificarTokenSesion(token, tenantSlugEsperado = null)`,
      `establecerCookieSesion(res, rfc, tenantSlug = null)`,
      `limpiarCookieSesion(res, tenantSlug = null)`,
      `requireUserAuth`/`obtenerRfcSesionOpcional` (leen `req.tenant`
      internamente) — todas retrocompatibles vía parámetro opcional con
      default `null`: cualquier llamador existente que no pase tenant
      obtiene EXACTAMENTE el comportamiento de antes.
    - `establecerCookieSesion` acota la cookie con `path: '/<slug>'`
      cuando hay tenant (antes siempre `path: '/'`) — el navegador ni
      siquiera ADJUNTA la cookie de "cliente1" en peticiones a
      "/cliente2/..." (defensa adicional a nivel de navegador, gratis,
      encima de la clave de firma distinta). `limpiarCookieSesion` usa el
      mismo path al limpiar — un `clearCookie` con un path que no
      coincide con el que se usó al ponerla no borra nada.
    - 3 call sites actualizados en `server.js` (`POST /api/auth/registro`,
      `POST /api/auth/login`, `POST /api/auth/logout`) para pasar
      `req.tenant ? req.tenant.slug : null`.

    **`backend/utils/auth.js` — realm de Basic Auth con slug**:
    `requireAdminAuth` calcula `realm = req.tenant ? 'Administracion-' +
    req.tenant.slug : 'Administracion'` una vez al inicio y lo usa en
    los dos `WWW-Authenticate` que ya existían. Motivo: con dominio único
    compartido entre tenants, los navegadores cachean credenciales Basic
    por *origin+realm*, no por *path* — sin esto, el navegador podría
    reintentar en silencio credenciales de "cliente1" contra
    "/cliente2/admin". **`ADMIN_USERS` NO cambió** — sigue siendo un
    mecanismo de acceso "super" global, ahora explícitamente documentado
    como acceso de soporte de plataforma (no de una empresa en particular)
    en el propio código; el plan ya anotaba esto como un riesgo nuevo
    introducido por ir multi-tenant, con auditoría de su uso como mejora
    pendiente para el segmento 7 (seguridad), no bloqueante para este.

    **`server.js` — apagado ordenado**: `cerrarTodosLosPoolsTenant()`
    (segmento 2) se agregó junto a `pool.end()` en
    `apagarOrdenadamente()`, para que un SIGTERM/SIGINT cierre también
    cualquier pool de tenant que hubiera quedado activo, no solo el pool
    por defecto.

    **Por qué esto NO cambia nada observable en producción todavía**:
    ninguna petición real trae `X-Tenant-Slug` (nginx sigue sin tocarse),
    así que `resolverTenantMiddleware` siempre toma la rama `return
    next()` inmediata, `req.tenant` siempre queda `undefined`, y todas
    las funciones de `authUsuario.js`/`auth.js` reciben `tenantSlug`/
    `req.tenant` como `null`/`undefined` — el mismo camino de código que
    corría antes de este segmento, con los mismos resultados.

    **Pruebas**: 28 pruebas nuevas/extendidas.
    - `backend/test/unit/tenantContext.test.js` (12 casos, nuevo):
      no-op sin encabezado; 400 por formato inválido o slug reservado;
      404 si no existe/no está activo; resolución exitosa (verifica
      `req.tenant`, los argumentos exactos a `obtenerPoolTenant`, y que
      `ejecutarComoTenant` envuelve a `next`); normalización a
      minúsculas; 503 si falla la consulta a la BD de control; caché con
      TTL (una segunda resolución no vuelve a consultar) e invalidación
      (por slug y completa).
    - `backend/test/unit/authUsuario.test.js` (11 casos nuevos, extendido,
      no un archivo aparte): token sin tenant se sigue verificando igual
      (compatibilidad); token de un tenant se verifica correctamente
      contra ese mismo tenant; **se rechaza contra otro tenant** (la
      prueba de seguridad central de este segmento); se rechaza mezclar
      con/sin tenant; **no basta con falsificar el campo `tid`** del
      payload porque la firma se calculó con la clave del tenant
      original (confirma que la defensa real es la clave derivada, no
      el campo); dos tenants producen firmas distintas para el mismo
      RFC; `requireUserAuth` acepta con el tenant correcto y rechaza con
      uno distinto; cookie con `path` acotado al establecer/limpiar.
    - `backend/test/unit/auth.test.js` (2 casos nuevos, extendido): realm
      sin tenant (idéntico a antes) vs. con tenant (incluye el slug).
    - `backend/test/integration/multitenant.test.js` (6 casos, nuevo,
      end-to-end con supertest sobre rutas reales): sin encabezado se
      comporta igual que antes de este segmento; tenant inexistente →
      404 antes de llegar a la ruta; login bajo un tenant válido →
      cookie con `Path=/<slug>`; **una sesión de "cliente1" es
      rechazada (401) al usarla bajo "cliente2"** pero **sí es válida al
      volver a usarla bajo "cliente1"** (confirma que el rechazo es
      específico al tenant, no un rechazo general roto); `/api/admin/login`
      incluye el slug en el realm bajo un tenant resuelto. Nota técnica:
      este archivo mockea `../../db` por completo (como el resto de la
      suite de integración), así que no re-prueba el enrutamiento REAL a
      un pool por tenant (eso ya lo cubre `db-multitenant.test.js` contra
      el módulo real) — prueba la capa de encima: middleware +
      sesión/Basic Auth funcionando de punta a punta a través de rutas
      reales.
    - Suite completa del proyecto: **395 pruebas, 20 archivos, 0
      regresiones** (367 antes de este segmento + 28 nuevas/extendidas).

    **No se corrió nada de esto contra MySQL real ni contra nginx real**
    desde este entorno (misma limitación de siempre) — la validación fue
    `node --check` + toda la suite Jest (que mockea MySQL). El código de
    `ensureSchema()`/las rutas existentes no cambió su lógica de negocio,
    solo se agregó el parámetro de tenant en los puntos exactos
    documentados arriba.

91. **Segmento 4 de 9 del plan multi-tenant: `frontend/nginx.conf`
    genérico por tipo de ruta + frontend tenant-aware.** Este es el
    segmento que hace real, por primera vez, el contrato acordado desde
    el segmento 3: nginx ahora SÍ agrega el encabezado `X-Tenant-Slug`
    cuando la URL tiene forma `/<slug>/admin`, `/<slug>/(dashboard|
    tickets|login|csf)` o `/<slug>/api/*`. **Aun así, sigue sin haber
    ningún tenant real dado de alta** (eso es el segmento 6) — así que en
    la práctica nadie visita todavía esas URLs; las rutas SIN prefijo de
    siempre (`/admin`, `/login`, etc.) siguen intactas y son las únicas
    que reciben tráfico real hoy.

    **`frontend/nginx.conf`**:
    - 3 `location` nuevas, con regex `^/(?<tenant_slug>[a-z0-9][a-z0-9-]
      {0,48})/...$` (deliberadamente más permisivo que
      `backend/utils/tenant.js:validarSlug()` — nginx solo captura un
      candidato razonable, el backend es la validación autoritativa,
      ya construida en el segmento 3): una para `/<slug>/admin`, una
      para `/<slug>/(dashboard|tickets|login|csf)` (mismo `try_files`
      que las rutas sin prefijo, sirviendo el mismo HTML de siempre), y
      una para `/<slug>/api/*` — un `proxy_pass` casi idéntico al de
      `location /api/` de siempre, con `proxy_set_header X-Tenant-Slug
      $tenant_slug` agregado y `$resto_api$is_args$args` para reconstruir
      la URL completa hacia el backend (patrón nginx estándar para
      preservar el query string en un `proxy_pass` con URI dentro de un
      `location` con regex — un `location` regex NO hace esto solo, a
      diferencia de un `location` de prefijo simple).
    - `location /api/` (la de siempre, sin tenant) ganó el modificador
      `^~` — fuerza a nginx a NUNCA evaluar las nuevas `location` con
      regex para cualquier ruta que empiece literalmente con `/api/`.
      Medida de defensa en profundidad: con el diseño actual del regex
      no hay una colisión real posible (`/api/algo` no puede matchear el
      patrón `/<tenant>/api/...` porque después de capturar "api" como
      tenant, el regex exige que seguido venga literalmente "/api/" otra
      vez), pero deja la garantía explícita en la configuración en vez de
      depender de razonar sobre el orden de evaluación de `location`
      cada vez que alguien toque este archivo en el futuro.
    - **Validado sin nginx real disponible en este entorno** (mismo caso
      que el punto 22 de este archivo): balance de llaves, que cada
      directiva termine en `;`/`{`/`}`, que los 3 regex nuevos compilen
      (Node `RegExp`, misma sintaxis de named captures que PCRE), y una
      simulación en Node de la resolución de ruta para ~24 casos (rutas
      sin tenant de siempre, rutas con tenant, assets estáticos,
      mayúsculas/guion-inicial inválidos cayendo al fallback, y
      `/api/api/algo` sin confundirse) — todos resolvieron al destino
      esperado. **Recomendado correr `nginx -t` real (o `docker compose
      up`) antes de confiar esto en producción** — no se pudo hacer aquí
      porque no hay Docker Engine corriendo en este entorno (el CLI de
      Docker está instalado pero el daemon no, ver intento documentado).

    **Frontend tenant-aware**: la detección de tenant vive en 3 archivos
    (duplicada, no importada — mismo patrón ya establecido en este
    proyecto para `API_BASE`, sin build step que permita compartir
    módulos): `portal.js`, `login.js` (única página que no carga
    `portal.js`) y `admin.js` (panel independiente del portal de
    cliente). `app.js` (csf.html) simplemente lee `window.Portal.API_BASE`
    porque `csf.html` ya carga `portal.js` primero.
    - `detectarTenantSlug()`: si `location.pathname` tiene ≥2 segmentos y
      el segundo es uno de `admin|dashboard|tickets|login|csf`, el primer
      segmento es el slug — MISMO contrato exacto que los regex de
      `nginx.conf` de arriba (si algún día uno cambia, el otro debe
      cambiar con él).
    - `API_BASE` pasa a ser `/<slug>/api` con tenant, `/api` sin tenant
      (idéntico a antes).
    - `urlPagina(pagina)` centraliza la construcción de URLs internas
      (`/<slug>/dashboard` vs. `/dashboard`) — reemplaza los 9
      `window.location.href = 'dashboard.html'`/`'login.html'` que había
      repartidos en `login.js` (×4), `portal.js` (×4) y `dashboard.js`/
      `tickets.js` (×1 cada uno), todos hardcodeados hoy.
    - **Enlaces estáticos** (`<a href="dashboard.html">` en `dashboard.html`
      ×2, `csf.html` ×1, `tickets.html` ×3): en vez de tocar cada `<a>` a
      mano o agregarles un `id`, `portal.js` los reescribe en
      `DOMContentLoaded` — cualquier `<a href="*.html">` cuyo nombre base
      coincida con una página conocida se reescribe con `urlPagina()`.
      Ningún archivo HTML necesitó cambiar sus enlaces.
    - **Bug real que se habría introducido sin revisar esto a fondo**:
      los 5 HTML principales cargan su CSS/JS con rutas RELATIVAS
      (`href="style.css"`, `src="admin.js"`, sin `/` inicial). Bajo
      `/cliente1/admin` (dos segmentos), el navegador resuelve
      `"admin.js"` relativo al "directorio" `/cliente1/` → pediría
      `/cliente1/admin.js`, que no existe — la página cargaría sin CSS
      ni JS. **Arreglo**: los 9 `<link>`/`<script>` de assets locales en
      `admin.html`, `dashboard.html`, `csf.html`, `tickets.html`,
      `login.html` pasaron a rutas absolutas (`/style.css`, `/admin.js`,
      etc.) — los assets no son distintos por tenant, así que una ruta
      absoluta es correcta en ambos casos (con y sin prefijo) sin
      necesitar ninguna `location` nueva en nginx para resolverlos.
      Confirmado en la simulación de rutas de arriba
      (`/cliente1/style.css` → 404, pero la app ya nunca genera esa URL).

    **Pruebas**: no hay harness de pruebas de frontend en este proyecto
    (`e2e/` con Playwright existe pero solo tiene una prueba "smoke" de
    que el harness responde — ningún flujo funcional real todavía se
    prueba ahí, y no hay servidor/navegador disponible en este entorno
    para correrlas de todas formas). Validación aplicada: `node --check`
    en los 6 archivos `.js` tocados (sintaxis válida — `node --check` no
    ejecuta código de navegador, solo lo parsea, así que sirve igual para
    JS que usa `window`/`document`), más la simulación de rutas de nginx
    ya descrita, más una revisión manual línea por línea de que cada
    `window.location.href`/`<a href>` que apuntaba a otra página del
    portal quedó cubierto (9 sitios de `window.location.href`, 6 enlaces
    `<a>`, ambos grupos confirmados con grep antes y después del cambio).
    La suite Jest del backend (395 pruebas) no se ve afectada por este
    segmento — no se tocó ningún archivo de `backend/`.

92. **Segmento 5 de 9 del plan multi-tenant: almacenamiento de archivos
    migrado de disco local a MinIO (self-hosted, compatible con S3).**
    El de mayor riesgo real hasta ahora: a diferencia de los segmentos
    1-4 (aditivos, cero cambio de comportamiento observable), este SÍ
    cambia el camino de datos de subir/bajar/borrar constancias fiscales,
    imágenes de ticket y facturas — para TODO el tráfico de hoy, no solo
    para un tenant futuro. Se hizo bajo decisión explícita del usuario
    tras plantearle la alternativa de construirlo aislado y sin conectar
    (ver el intercambio en la conversación) — **no hay Docker/MinIO real
    corriendo en este entorno para probarlo end-to-end**, algo que no
    aplicaba a ningún segmento anterior.

    **`backend/utils/storage.js` (archivo nuevo)** — abstracción sobre
    `@aws-sdk/client-s3` (SDK oficial de AWS, compatible con cualquier
    backend S3 incluyendo MinIO vía `forcePathStyle: true`):
    - `guardarArchivo`/`existeArchivo`/`eliminarArchivo`/
      `enviarArchivoARespuesta`/`asegurarBucket` — un bucket único
      compartido (`MINIO_BUCKET`, decisión de aislamiento lógico por
      prefijo ya tomada en el plan, no física), con keys
      `<prefijo>/<archivo>` (constancias) o
      `<prefijo>/tickets|facturas/<archivo>` — calcado de la estructura
      de carpetas que ya existía en disco.
    - `prefijoTenant(req)` = `req.tenant.slug` si hay tenant resuelto, o
      `PREFIJO_DEFECTO` ('_default', nunca puede colisionar con un slug
      real — el guion bajo no es válido en `SLUG_REGEX`) si no —
      mismo tenant único de siempre para todo el tráfico real hoy.
    - `eliminarArchivo` ya NO necesita comprobar existencia primero
      (`DeleteObject` de S3/MinIO es idempotente, a diferencia de
      `fs.unlinkSync`) — simplificación real que quitó varios
      `if (existsSync) try { unlink } catch` de `server.js`.
    - `asegurarBucket()`: crea el bucket si no existe, mismo espíritu
      idempotente que `ensureSchema()` — se llama una vez al arrancar
      (`iniciar()` en `server.js`), nunca en el camino de una request.

    **`backend/server.js`**: los 22 sitios de `fs.writeFileSync`/
    `existsSync`/`unlinkSync`/`createReadStream` que manejaban subida
    (constancia, imagen de ticket, factura), descarga (cliente y admin) y
    borrado (lógico-a-permanente y reemplazo) se reemplazaron por sus
    equivalentes de `storage.js`, cada uno con `storage.prefijoTenant(req)`
    resuelto en el punto de uso. La creación de `UPLOAD_DIR`/
    `TICKETS_UPLOAD_DIR`/`FACTURAS_UPLOAD_DIR` (mkdir al arrancar) se dejó
    **sin tocar a propósito** — es inofensiva, y quitarla implica tocar
    también el bind mount de `docker-compose.yml` y el chown/entrypoint
    que dependen de él; queda marcada como VESTIGIAL en el código y como
    limpieza de infraestructura pendiente (ver más abajo), no confundir
    con que el almacenamiento siga viviendo ahí.

    **`backend/utils/ticketsCleanup.js`**: `eliminarTickets`/
    `limpiarTicketsVencidos`/`ejecutarLimpiezaConReporte` perdieron los
    parámetros `ticketsUploadDir`/`facturasUploadDir` (ya sin sentido con
    S3) — **cambio de firma**, actualizado en sus 2 llamadores
    (`server.js`, `scripts/verificar-mysql.js`). Esta limpieza corre
    desde un `setInterval`, FUERA de cualquier request HTTP — no hay
    `req.tenant` que leer, así que usa `storage.PREFIJO_DEFECTO` a
    propósito. Iterar la limpieza sobre todos los tenants reales queda
    pendiente (ya anotado desde el segmento 2 como extensión futura de
    este mismo mecanismo — no es responsabilidad de un segmento que solo
    migra el almacenamiento).

    **Dependencia nueva**: `@aws-sdk/client-s3` (instalada de verdad vía
    `npm install`, versión resuelta `^3.1108.0` en `package.json` y
    `package-lock.json` — sí hay acceso a la red de npm desde este
    entorno, a diferencia de Docker Hub). `npm audit` reporta 3
    vulnerabilidades preexistentes (nodemailer, uuid vía exceljs) — **no
    las introdujo este cambio**, confirmado comparando antes/después;
    quedan como pendiente aparte, fuera de alcance de este segmento
    (arreglarlas implica upgrades con breaking changes que necesitan su
    propia revisión).

    **`docker-compose.yml`**: servicio `minio` nuevo (imagen
    `minio/minio:latest` — **sin pin a un tag `RELEASE.<fecha>`
    específico, a diferencia de `mysql:8.0`/`nginx:1.27-alpine`**: no se
    pudo verificar cuál es el tag estable actual desde este entorno, sin
    acceso a Docker Hub — pendiente fijar un tag real antes de
    producción), API S3 (9000) sin publicar al host (mismo principio que
    el backend — solo alcanzable por la red interna), consola de
    administración (9001) publicada para inspección en desarrollo,
    volumen `minio_data`, healthcheck con `mc ready local` (patrón
    oficialmente documentado por MinIO). `backend` gana
    `depends_on: minio (service_healthy)` y las variables
    `MINIO_ENDPOINT`/`MINIO_BUCKET`/`MINIO_ROOT_USER`/
    `MINIO_ROOT_PASSWORD`. **Validado con `docker compose config`** (el
    daemon de Docker no está corriendo en este entorno — el CLI de Docker
    sí está instalado, y `config` no necesita el daemon, solo parsea/
    renderiza el YAML): confirma que el archivo es válido, resuelve
    variables de entorno, `depends_on`, healthcheck y volúmenes
    correctamente — la validación más fuerte disponible aquí, pero
    **no reemplaza levantar el stack de verdad**.

    **Pruebas**: `backend/test/unit/storage.test.js` (15 casos, nuevo) —
    mockea `@aws-sdk/client-s3` por completo (clases `FakeCommand` que
    capturan el `input` real pasado a cada comando) para verificar
    exactamente qué se envía a S3/MinIO en cada operación, sin necesitar
    un servidor real: construcción de keys, `PutObjectCommand`/
    `HeadObjectCommand`/`DeleteObjectCommand`/`GetObjectCommand` con los
    parámetros correctos, los 3 casos de error de `existeArchivo` (404
    por `httpStatusCode`, `name: 'NotFound'`, `name: 'NoSuchKey'` — las
    tres formas reales en que el SDK v3 puede reportar "no existe") vs.
    relanzar cualquier otro error, y `asegurarBucket()` en sus 3 caminos
    (ya existe / no existe y se crea / error real se relanza sin
    intentar crear). Se actualizaron `test/unit/ticketsCleanup.test.js`,
    `test/integration/tickets.test.js` y `test/integration/csf-publico.test.js`
    para mockear `utils/storage.js` en vez de `fs` (mismo patrón: mocks
    con implementación resuelta por defecto, sin cola por test). Suite
    completa: **410 pruebas, 21 archivos, 0 regresiones** (395 antes +
    15 nuevas).

    **Pendiente antes de producción** (a diferencia de los segmentos
    1-4, este SÍ lo necesita para confiar en que funciona de verdad):
    1. Levantar el stack completo (`docker compose up`) y probar en un
       navegador real: subir constancia, subir ticket, admin sube
       factura, todas las descargas (cliente y admin), borrado lógico y
       permanente, reemplazo de constancia — nada de esto se ejecutó
       contra MinIO real.
    2. Fijar `minio/minio` a un tag `RELEASE.<fecha>` real en vez de
       `latest`.
    3. Decidir si limpiar la infraestructura vestigial de disco local
       (bind mount `./uploads` en `docker-compose.yml`, `UPLOAD_DIR` y
       su `mkdir` en `server.js`, el chown/entrypoint que depende del
       bind mount) en un segmento aparte, o dejarla indefinidamente
       (inofensiva, pero confunde a quien lea el código sin este
       contexto).
    4. Revisar las 3 vulnerabilidades preexistentes de `npm audit`
       (nodemailer, uuid/exceljs) — requieren upgrades con breaking
       changes, fuera de alcance de este segmento.

93. **Segmento 6 de 9 del plan multi-tenant: cutover del tenant piloto —
    entregado como RUNBOOK/SCRIPT, no como ejecución real.** A diferencia
    de todos los segmentos anteriores, este consiste en migrar datos de
    PRODUCCIÓN reales (la BD/archivos que ya usa el proyecto tal como
    está desplegado hoy) — no hay tal base de datos real en este entorno
    (no hay MySQL/MinIO corriendo), así que no había nada que "cortar"
    todavía. Lo que se construyó es la herramienta para que el usuario lo
    haga él mismo cuando esté listo, con las mismas garantías de
    seguridad (no destructivo, verificado paso a paso) que el resto del
    proyecto.

    **`backend/scripts/cutover-tenant-piloto.js` (nuevo)**: convierte la
    BD de un solo tenant (`DB_NAME`, por defecto `portal_facturacion`) en
    el primer tenant real (`tenant_<slug>`). 5 pasos, cada uno verificado
    antes de seguir al siguiente:
    1. Asegura BD de control + registra el tenant (`estado='provisioning'`).
    2. Crea `tenant_<slug>` y le aplica el esquema canónico
       (`ensureSchema()` en proceso hijo — mismo patrón que
       `provisionar-tenant.js`).
    3. Copia los DATOS de las 7 tablas, una por una, en el orden que
       respeta sus dependencias de llave foránea (`reportes` antes que
       `reporte_items`) — **`copiarDatosTabla()` nunca usa `INSERT ...
       SELECT *`**, siempre enumera las columnas del DESTINO
       (`INFORMATION_SCHEMA.COLUMNS`) y las usa explícitamente en ambos
       lados del `INSERT`/`SELECT`: si el origen tuviera una columna de
       más o de menos que el esquema canónico recién creado, el error
       sale como un SQL claro (columna inexistente) en vez de una copia
       silenciosamente desalineada por posición. Verifica
       `COUNT(*)` origen vs. destino en cada tabla antes de continuar.
    4. Copia los archivos en MinIO: **gracias al segmento 5, esto ya es
       una operación S3→S3 dentro del mismo bucket** (mover del prefijo
       `_default` al prefijo del tenant, `storage.copiarPrefijo()`), no
       una copia desde disco local como preveía el diseño original del
       plan antes de que existiera `storage.js` — el propio orden de los
       segmentos (5 antes que 6) simplificó este paso. Verifica el
       conteo de objetos antes/después.
    5. Marca el tenant como `activo`.
    - **NO ES DESTRUCTIVO por diseño**: el origen (BD y prefijo
      `_default` en MinIO) nunca se modifica, solo se lee — si algo falla
      a mitad de camino, el tráfico real (que sigue sirviéndose del
      origen) no se ve afectado en absoluto.
    - **El corte de tráfico real es deliberadamente un paso manual
      aparte**, NO automatizado: el script termina imprimiendo los
      siguientes pasos (smoke test en `/<slug>/...`, el snippet exacto de
      redirecciones 301 a agregar a mano en `frontend/nginx.conf` — ya
      con el slug real sustituido, listo para copiar/pegar — y el
      recordatorio de recargar nginx). Automatizar el corte de tráfico
      en sí (reconfigurar/reiniciar el backend en producción) se
      consideró demasiado riesgoso para dejarlo sin supervisión humana
      directa, consistente con el protocolo `addv-web-app` de este
      proyecto.
    - **Reutiliza `provisionar-tenant.js`**: se extrajo la lógica
      compartida (conexión root, bootstrap de la BD de control,
      `registrarEvento`, correr `ensureSchema()` en proceso hijo) a
      `backend/scripts/lib/controlDb.js` — `provisionar-tenant.js` se
      actualizó para usar este módulo compartido en vez de tener su
      propia copia (mismo comportamiento, sin duplicación). Se
      generalizó `registrarEvento()` para recibir el `actor` como
      parámetro (antes tenía el nombre del script hardcodeado), ya que
      ahora dos scripts distintos lo llaman.

    **Pruebas**: `backend/test/unit/cutover-tenant-piloto.test.js` (10
    casos, nuevo) — prueba `copiarDatosTabla()` con un objeto `root`
    (conexión mysql2) mockeado a mano pasado como parámetro explícito (no
    hace falta mockear ningún módulo): copia exitosa con verificación de
    conteo, error claro si la tabla no existe en el destino, error si el
    conteo no coincide. También `leerArgumentos()` (normalización de
    slug, `--origen-db=`/`--contacto-email=`, default de `DB_NAME` del
    entorno) y `TABLAS_EN_ORDEN` (las 7 tablas correctas, sin duplicados,
    `reportes` antes que `reporte_items`). El script en sí, como
    `provisionar-tenant.js`, sigue el patrón `require.main === module`
    de `server.js` para que `require()`-arlo desde un test no dispare
    `main()` contra MySQL real. Suite completa: **424 pruebas, 22
    archivos, 0 regresiones** (410 antes + 14 nuevas — 10 del cutover +
    4 de `storage.js` para `copiarPrefijo`/`contarObjetosPrefijo`, que en
    realidad se agregaron como parte de este mismo segmento aunque viven
    en el archivo de pruebas de `storage.js` del segmento 5).

    **No se corrió nada de esto contra MySQL/MinIO reales** — es, por
    naturaleza, imposible de probar end-to-end sin la infraestructura real
    del usuario. Antes de usar este script contra datos de producción de
    verdad: probarlo primero contra una copia/backup, no contra el
    original, pese a que fue diseñado para no ser destructivo.

94. **Segmento 7 de 9 del plan multi-tenant: endurecimiento de seguridad
    multi-tenant — cerrado/documentado en esta sesión.** Al retomar el
    proyecto, el código ya contenía trabajo marcado como "segmento 7" en
    `server.js`, `tenantContext.js`, `adminAuditoria.js` y `nginx.conf`,
    pero el estado persistente seguía diciendo "no avanzar al segmento 7".
    Con aprobación explícita del usuario, se verificó el alcance existente y
    se cerró formalmente el segmento en la documentación.

    **Qué cubre el segmento 7**:
    - `backend/utils/adminAuditoria.js`: nueva auditoría administrativa en
      la BD de control (`control_tenants.admin_auditoria`) para registrar
      actor, mecanismo (`admin_users`/`fallback_admin`/`perfil_bd`), perfil,
      tenant, método, ruta, estatus e IP. Se crea de forma idempotente con
      `asegurarTablaAuditoria()` al arrancar el backend. El registro desde
      `server.js` es fire-and-forget: un fallo de auditoría no bloquea ni
      tumba la petición real.
    - `server.js`: los rate limiters usan clave `tenant + IP` cuando hay
      tenant resuelto, evitando throttling cruzado entre empresas detrás de
      una misma IP/NAT. Además, los logins tienen un límite agregado por
      tenant para reducir fuerza bruta distribuida, y todo `/api/admin/*`
      queda cubierto por un limiter de credenciales fallidas, no solo
      `GET /api/admin/login`.
    - `tenantContext.js`: la respuesta 404 para un slug válido pero no
      existente paga un costo artificial comparable a `scrypt`, para reducir
      enumeración de tenants por temporización.
    - `server.js`: todas las respuestas bajo `/api` envían
      `Cache-Control: no-store`, defensa en profundidad para futuros proxies
      o CDN compartidos.
    - `frontend/nginx.conf`: nginx limpia explícitamente `X-Tenant-Slug` en
      la API sin tenant (`/api/...`) y solo lo fija desde la URL capturada en
      `/<slug>/api/...`, cerrando el bypass en el que un cliente podía mandar
      manualmente ese encabezado contra rutas sin prefijo. También agrega
      cabeceras de defensa (`X-Content-Type-Options`, `X-Frame-Options`,
      `Referrer-Policy`, `Permissions-Policy`). CSP queda fuera a propósito:
      requiere inventariar scripts/estilos inline y validación visual real.

    **Decisión de alcance**: no se agregó UI para consultar
    `admin_auditoria`. Para este segmento, el objetivo era cerrar el hueco
    de trazabilidad y endurecer el borde multi-tenant; una pantalla de
    consulta/auditoría operativa puede diseñarse después como segmento
    independiente si se necesita.

    **Pruebas ejecutadas en esta sesión**:
    `npm test -- --runTestsByPath test/unit/adminAuditoria.test.js
    test/unit/tenantContext.test.js test/unit/auth.test.js
    test/integration/admin.test.js test/integration/multitenant.test.js`
    desde `backend/`: **5 suites, 68 pruebas, 0 fallas**. La salida incluye
    varios `console.error` esperados por pruebas que simulan errores de MySQL
    o fire-and-forget; Jest terminó con código de salida 0. Después se corrió
    la suite completa con `npm test`: **23 suites, 434 pruebas, 0 fallas**,
    también con código de salida 0.

    **Limitación vigente**: no se corrió contra MySQL/MinIO reales ni contra
    nginx levantado con Docker en este entorno. Antes de producción sigue
    pendiente levantar el stack real y ejecutar `verificar-mysql.js`, además
    de smoke tests por navegador para rutas con y sin tenant.

95. **Segmento 8 de 9 del plan multi-tenant: MySQL en alta disponibilidad
    (primario/réplica) + `docker-stack.yml` para Docker Swarm — construido
    en esta sesión, con aprobación explícita del usuario para el segmento
    y dos decisiones de alcance resueltas antes de implementar**:

    - **Failover: manual, no automático.** Se decidió no agregar un
      orquestador de failover (ej. MySQL Orchestrator) al stack — más
      complejidad operativa y una pieza imposible de probar contra
      infraestructura real desde este entorno. `promote-replica.js` lo
      hace explícito y a demanda.
    - **Lecturas: solo en el primario.** La réplica es standby de
      HA/respaldo, no un recurso de escalado de lecturas — se evita el
      riesgo de leer datos desactualizados por lag de replicación en un
      sitio de facturación/fiscal. `backend/db.js`/`server.js` NO se
      tocaron: `DB_HOST` sigue siendo el único host de conexión.

    **Qué se agregó** (100% código/config nuevo, aditivo — no se tocó
    ningún archivo de la app existente salvo `.env.example` y `README.md`):
    - `mysql/conf/primary.cnf` / `mysql/conf/replica.cnf`: configuración de
      replicación por GTID (no coordenadas de binlog manuales) —
      `gtid_mode=ON`, `enforce-gtid-consistency=ON`, `server-id` distinto
      en cada nodo, `read_only`/`super_read_only=ON` en la réplica (bloquea
      escrituras accidentales ahí, incluso con privilegio SUPER).
    - `docker-stack.yml`: variante de producción de `docker-compose.yml`
      para `docker stack deploy` sobre un clúster Swarm — servicios
      `mysql-primary`/`mysql-replica` fijados por `node.labels.mysql-role`
      a nodos específicos (los volúmenes de MySQL son locales por nodo, sin
      almacenamiento de red — el encabezado del archivo documenta esa
      compensación explícitamente), `backend`/`frontend` usan `image:` en
      vez de `build:` (Swarm no construye imágenes) vía
      `BACKEND_IMAGE`/`FRONTEND_IMAGE`. `backend` se deja en 1 réplica a
      propósito: escalarlo requiere primero resolver el bind mount local de
      `UPLOAD_DIR` (staging temporal antes de MinIO), fuera del alcance de
      este segmento.
    - `backend/scripts/configure-replica.js`: idempotente — crea/rota el
      usuario de replicación (privilegio único `REPLICATION SLAVE`, sin
      acceso a datos) y engancha la réplica al primario con
      `SOURCE_AUTO_POSITION=1`.
    - `backend/scripts/promote-replica.js`: failover manual — rechaza
      promover si hay retraso de replicación o errores pendientes sin
      resolver, salvo `--force`; imprime los pasos manuales siguientes
      (redirigir `DB_HOST`, evitar split-brain con el primario viejo,
      reconstruirlo después como réplica).
    - `backend/scripts/verify-replication.js`: solo lectura, código de
      salida 0/1 según salud de la replicación — pensado para monitoreo
      externo periódico.
    - `.env.example`: documentadas `MYSQL_REPLICATION_USER`/
      `MYSQL_REPLICATION_PASSWORD`.
    - `README.md`: nueva sección "MySQL en alta disponibilidad — Docker
      Swarm" con el procedimiento completo paso a paso; sección
      multi-tenant actualizada de "segmentos 1-6" a "segmentos 1-8".

    **Pruebas**: `configure-replica.test.js`, `promote-replica.test.js`,
    `verify-replication.test.js` (28 pruebas nuevas, lógica pura con
    conexiones mockeadas a mano, mismo patrón que
    `cutover-tenant-piloto.test.js` — nunca se mockeó ningún módulo, las
    funciones reciben la conexión como parámetro explícito). Suite completa
    corrida después: **26 suites, 462 pruebas, 0 fallas**, código de salida
    0. `node --check` limpio en los 3 scripts nuevos.

    **Limitación vigente — la más importante de este segmento**: nunca se
    desplegó contra un clúster Docker Swarm real ni contra dos instancias
    de MySQL replicando de verdad (sin Docker en este entorno). Todo el
    diseño de replicación (GTID, `CHANGE REPLICATION SOURCE TO`,
    `SHOW REPLICA STATUS`) se validó por lectura cuidadosa de la
    documentación oficial de MySQL 8.0, no por ejecución. **Antes de
    producción**: levantar un clúster Swarm de prueba (2 nodos como
    mínimo), correr `configure-replica.js` de verdad, forzar un failover de
    prueba con `promote-replica.js`, y confirmar que `verify-replication.js`
    reporta correctamente tanto el estado sano como cada tipo de falla
    simulada (detener el primario, desconectar la red entre nodos, etc.).

    No avanzar al segmento 9 (app de control para dar de alta empresas
    desde una UI, fase 2 explícita del plan original) sin aprobación
    explícita del usuario — mismo protocolo `addv-web-app` de siempre.

96. **Segmento 9 de 9 (FINAL) del plan multi-tenant: app de control
    `/control` — construido en esta sesión, con aprobación explícita del
    usuario y 3 decisiones de alcance resueltas antes de implementar**.
    Con esto, el plan de migración a multi-tenant de 9 segmentos queda
    **completo**.

    **Decisiones confirmadas**:
    - **Sin auto-creación de tenants**: `/control` solo gestiona empresas
      YA existentes (`control_tenants.tenants`). Dar de alta una empresa
      nueva sigue siendo el script CLI `provisionar-tenant.js`, corrido a
      mano con `MYSQL_ROOT_PASSWORD` — el contenedor backend NUNCA gana
      esa credencial por este segmento (preserva la separación del
      segmento 1).
    - **Acceso solo perfil `'super'`** (`requireAdminArea()` sin
      argumentos) — ningún usuario `perfil_bd` (administrador/fiscal de
      una empresa específica) puede entrar a `/control`.
    - **Reactivar usa el mismo flujo** desde `suspendido` o `baja` — sin
      paso manual aparte para `baja`. Se reutiliza la columna `activado_en`
      ya existente (no se agregó `reactivado_en`) — `tenant_eventos` ya
      guarda el historial completo de transiciones si hace falta
      distinguir activación inicial de reactivación después.

    **Qué se agregó** (100% código nuevo, aditivo):
    - `backend/scripts/lib/controlDb.js`: `asegurarColumnasCicloVidaTenant()`
      — agrega la columna `baja_en` a `tenants` de forma idempotente
      (guarda `INFORMATION_SCHEMA.COLUMNS`, mismo patrón que
      `ensureSchema()`), corre con el pool de app normal, sin root. También
      se exportó `registrarEvento()` para reutilizarlo fuera de los
      scripts CLI.
    - `backend/utils/tenantLifecycle.js`: `listarTenants()`,
      `obtenerTenantPorSlug()`, `suspenderTenant()`, `reactivarTenant()`,
      `darDeBajaTenant()`. Cada transición usa `UPDATE ... WHERE slug=?
      AND estado IN (...)` atómico (no SELECT-luego-UPDATE, evita
      condiciones de carrera), registra un evento en `tenant_eventos`, e
      invalida la caché de resolución de tenant
      (`invalidarCacheTenant()`). `darDeBajaTenant()` es no-destructivo
      por diseño: nunca toca la base de datos `tenant_<slug>` ni su
      storage en MinIO, solo cambia `estado`.
    - `backend/server.js`: 4 rutas nuevas bajo `/api/control/*` (`GET
      /tenants`, `POST /tenants/:slug/{suspender,reactivar,baja}`), todas
      con `requireAdminAuth` + `requireAdminArea()` (solo super) +
      `adminApiLimiter`. Se agregó también el par
      `adminCredencialesLimiter` + middleware de auditoría para
      `/api/control` (mismo patrón que `/api/admin` del segmento 7, que
      NO cubría esta ruta automáticamente — hueco cerrado explícitamente).
      Arranque: `asegurarColumnasCicloVidaTenant()` se invoca en
      `iniciar()`, junto a `asegurarTablaAuditoria()`.
    - `frontend/control.html` + `frontend/control.js` (nuevos, planos, sin
      subcarpeta): página de un solo propósito — tabla de tenants con
      buscador, filtro por estado, y acciones por fila (Suspender/
      Reactivar/Dar de baja) según el estado actual, cada una con
      confirmación previa. Reutiliza `style.css`+`admin.css` completos
      (login gate, modal de confirmación, `.admin-table`,
      `.admin-row-actions`, `.btn-restaurar`/`.btn-eliminar`/
      `.btn-eliminar-permanente`) — sin CSS nuevo salvo 4 clases
      `.estatus-{provisioning,activo,suspendido,baja}` agregadas a
      `admin.css`, mismo patrón que `.estatus-badge` existente. Sesión
      separada (`sessionStorage` clave `control_credenciales`, distinta de
      `admin_credenciales`) — nunca se mezclan. Sin ruta de login
      dedicada: `GET /api/control/tenants` sirve como sonda de
      credenciales (ya exige auth+perfil super).
    - `frontend/nginx.conf`: un solo `location = /control` nuevo (página
      estática). La API se sirve bajo `/api/control/*`, ya cubierta por el
      `location ^~ /api/` existente (blanquea `X-Tenant-Slug`, prioridad
      sobre las rutas regex de tenant) — sin bloque de proxy nuevo, para
      no duplicar una fuente de configuración sin beneficio.

    **Diferido explícitamente** (fuera de alcance de este segmento, por
    decisión del usuario): panel de solo lectura para `admin_auditoria`
    (segmento 7) dentro de `/control` — `listarAuditoria()` sigue sin UI,
    sería un pedido aparte si se necesita después.

    **Pruebas**: `tenantLifecycle.test.js` (10), `controlDb.test.js` (2,
    cubre `asegurarColumnasCicloVidaTenant`), `control.test.js` de
    integración (12, incluye 401/403 por perfil, y 200/404/409 por cada
    transición) — 24 pruebas nuevas. Suite completa corrida después: **29
    suites, 486 pruebas, 0 fallas**, código de salida 0 (subió desde el
    baseline de 26 suites/462 pruebas del segmento 8). `node --check`
    limpio en los 6 archivos `.js` tocados/nuevos.

    **Limitación vigente**: igual que los segmentos 5 y 8, nunca se probó
    contra Docker/MySQL/navegador reales en este entorno. Antes de
    producción: smoke test manual completo de `/control` (login, listar,
    suspender, reactivar desde suspendido, reactivar desde baja, dar de
    baja, filtro por estado y búsqueda), y confirmar visualmente que los
    badges de estado y el modal de confirmación se ven bien en escritorio
    y móvil.

    **Con este segmento, el plan de 9 segmentos de migración a
    multi-tenant queda completo.** Quedan pendientes de producción real
    (nunca ejecutados contra infraestructura real desde este entorno, ver
    "Pendiente / recomendado antes de producción" más abajo): el cutover
    del tenant piloto (segmento 6), la validación de MinIO real (segmento
    5), y la validación de MySQL HA/Swarm real (segmento 8). La "app de
    control" para dar de alta empresas desde una UI (auto-creación) sigue
    siendo fase 2 explícita, no construida — decisión consciente de este
    segmento, ver arriba.

97. **Primera corrida real contra Docker de verdad en esta máquina — 4
    bugs reales encontrados y corregidos.** El usuario confirmó tener
    Docker Desktop instalado localmente y pidió correr la suite completa
    incluyendo Docker. Hasta este punto, absolutamente nada de
    `docker-compose.yml`/`docker-stack.yml`/`nginx.conf` se había
    ejecutado nunca contra un motor Docker real (ver la sección de
    "Limitaciones de ESTE entorno" más abajo) — solo se había validado por
    lectura cuidadosa. Levantar el stack de verdad encontró 4 bugs reales
    que ningún `node --check` ni prueba unitaria podía detectar:

    - **(a) `frontend/nginx.conf` — las 3 rutas regex de tenant
      (segmento 4) nunca funcionaron.** `location ~ ^/(?<tenant_slug>...)
      [a-z0-9-]{0,48})/admin$ { ... }` sin comillas: el tokenizador de
      configuración de nginx trata `{`/`}` como delimitadores de bloque
      incluso pegados a otro texto sin espacio, así que `{0,48}` cortaba
      el patrón a la mitad antes de llegar a `pcre2_compile()` — nginx
      fallaba al arrancar con "missing closing parenthesis". El
      `frontend` completo nunca podía levantar con este archivo desde que
      se escribió en el segmento 4. Corregido envolviendo los 3 patrones
      entre comillas dobles.
    - **(b) `frontend/Dockerfile` no copiaba `control.html`/`control.js`
      a la imagen (segmento 9).** La línea `COPY` lista los archivos del
      frontend uno por uno; al crear la app de control se me olvidó
      agregarlos ahí — `/control` respondía 404 aunque
      `location = /control` en nginx.conf estuviera bien. Corregido
      agregando ambos archivos al `COPY`.
    - **(c) `mysql/conf/replica.cnf` con `read_only`/`super_read_only`
      estáticos rompía el arranque del contenedor réplica desde el primer
      boot (segmento 8).** La imagen oficial de MySQL necesita escribir
      durante su bootstrap inicial (crear la BD/usuario de
      `MYSQL_DATABASE`/`MYSQL_USER`) la primera vez que arranca con un
      datadir vacío; con `super_read_only=ON` ya activo en ese momento
      (por venir en el `.cnf` montado desde el arranque), ese bootstrap
      fallaba con "server is running with the --super-read-only option" y
      el contenedor nunca llegaba a arrancar — esto habría roto
      `docker-stack.yml` en el primerísimo despliegue real. Corregido:
      se quitó de `replica.cnf` y ahora `configure-replica.js` activa
      ambas variables con `SET PERSIST` (no `SET GLOBAL`) DESPUÉS de
      enganchar la réplica — aplica de inmediato y sobrevive un reinicio
      del contenedor (queda en `mysqld-auto.cnf` del datadir), sin
      bloquear el primer arranque. `promote-replica.js` también pasó de
      `SET GLOBAL` a `SET PERSIST` al apagar ambas variables, por
      simetría y para que un reinicio del nodo recién promovido no vuelva
      a dejarlo en solo-lectura por accidente.
    - **(d) `frontend/Dockerfile`: el `HEALTHCHECK` usaba
      `http://localhost/`, que dentro del contenedor resuelve primero a
      la IPv6 de loopback (`::1`) — donde nginx no escuchaba (el
      `listen 80;` de este `nginx.conf` es solo IPv4 aquí) — así que el
      healthcheck fallaba con "Connection refused" y el contenedor
      quedaba marcado "unhealthy" indefinidamente, aunque el sitio
      respondiera perfecto por IPv4 (confirmado con `curl` desde el host
      y `wget http://127.0.0.1/` desde dentro del contenedor, ambos 200).
      Corregido a `http://127.0.0.1/` explícito, evitando la ambigüedad
      de resolución de "localhost".

    **Validación end-to-end realizada tras las correcciones** (todo
    contra infraestructura real, no mocks):
    - `docker compose up -d --build`: los 4 servicios (`mysql`, `minio`,
      `backend`, `frontend`) terminan **healthy**. `nginx -t` pasa dentro
      del contenedor.
    - Se aprovisionó un tenant de prueba real (`pruebasegmento9`) con
      `provisionar-tenant.js` contra el MySQL real del stack (esto
      también fue la primera vez que ese script corrió contra Docker de
      verdad — sin problemas).
    - Ciclo de vida completo de `/control` (segmento 9) probado contra el
      backend/MySQL reales vía `curl`: login, listar, suspender (200),
      suspender de nuevo (409 correcto), reactivar desde suspendido
      (200), dar de baja (200), reactivar desde baja (200, confirma la
      decisión #3), slug inexistente (404 correcto). Confirmado en
      `control_tenants.admin_auditoria` y `.tenant_eventos` (consultados
      directamente) que cada acción quedó registrada con actor/
      mecanismo/perfil/ruta/estatus correctos, incluyendo los intentos
      fallidos (404/409).
    - `verify-replication.js`/`configure-replica.js`/`promote-replica.js`
      (segmento 8) probados con dos contenedores MySQL desechables reales
      (`mysql-primary-test`/`mysql-replica-test`, con `primary.cnf`/
      `replica.cnf` copiados vía `docker cp` — el bind mount normal desde
      Windows hace que MySQL rechace el `.cnf` por "world-writable",
      particularidad de Docker Desktop en Windows, no relevante en un
      host Linux real). Confirmado con datos reales: escritura en el
      primario se replica a la réplica (`SELECT` en la réplica la
      muestra), la réplica rechaza escrituras directas
      (`super_read_only`), `verify-replication.js` reporta 0s de
      retraso, `promote-replica.js` promueve la réplica a escribible, y
      tras reiniciar ese contenedor (ya promovido) sigue escribible —
      confirma que `SET PERSIST` sobrevive un reinicio real, no solo en
      teoría.
    - `backend/scripts/verificar-mysql.js` corrido por primera vez contra
      MySQL real (`docker compose exec backend ...`) — **255/262
      pruebas pasaron**. Las 7 fallas son bugs del propio script de
      prueba (nunca antes ejecutado, ver más abajo), no del código de la
      app: `limpiarDatosDePrueba()` sí corrió y limpió todo correctamente
      pese a las fallas (confirmado sin datos de prueba residuales tras
      la corrida).
      - `PREFIJO_PRUEBA = '__prueba_regresion__'` (21 caracteres) se usa
        para construir varios `numero_compra` de prueba
        (`${PREFIJO_PRUEBA}-TICKET-VERIF`, etc.) contra una columna
        `VARCHAR(20)` — el valor de prueba nunca cupo, MySQL lo rechaza
        con `ER_DATA_TOO_LONG` antes de que la prueba pueda verificar lo
        que de verdad quería probar (4 fallas).
      - La prueba del `CHECK` en `tipo_persona` usa el valor de prueba
        `'no_es_un_tipo_valido'` (21 caracteres) contra una columna
        `VARCHAR(10)` — MySQL rechaza por longitud (`ER_DATA_TOO_LONG`)
        antes de siquiera evaluar el `CHECK`, así que la prueba ve el
        código de error "equivocado" aunque el INSERT sí se rechazó como
        se esperaba (1 falla).
      - La prueba de la plantilla de correo por defecto asume una base de
        datos SMTP sin personalizar — pero esta es una base de datos real
        con configuración ya guardada de uso anterior, así que
        `cuerpo_cliente` legítimamente ya no es el default (1 falla, dato
        de la prueba desactualizado respecto a una BD real y usada, no un
        bug de la app).
      - **No se corrigieron estos 7 casos en esta sesión** — son bugs del
        script de pruebas, no bloquean nada de segmentos 8/9, y
        corregirlos (acortar los valores de prueba, o hacer la prueba de
        plantilla tolerante a un valor ya personalizado) es un cambio
        acotado aparte, fuera del pedido original de esta sesión.
    - Suite completa de Jest corrida de nuevo tras todas las correcciones:
      **29 suites, 487 pruebas, 0 fallas** (subió en 1 por la prueba
      nueva de `activarSoloLecturaPersistente`).

    **Quedó corriendo en esta máquina, sin apagar**: el stack completo
    (`docker compose up`, servicios `mysql`/`minio`/`backend`/`frontend`,
    healthy) y el tenant de prueba `pruebasegmento9` (estado `activo` al
    cierre de esta sesión, con eventos de suspensión/reactivación/baja/
    reactivación en su historial de `tenant_eventos` por las pruebas de
    arriba). Decisión de si apagar el stack o borrar el tenant de prueba
    queda para el usuario — no se tocó nada de eso al cerrar la sesión.

    **Con estas 4 correcciones, las advertencias de "nunca probado contra
    Docker real" de los segmentos 4, 8 y 9 quedan resueltas para el flujo
    de un solo nodo** (`docker compose`). Sigue sin probarse: un clúster
    Docker Swarm real multi-nodo (`docker-stack.yml`, colocación por
    `node.labels`) — las pruebas de replicación de arriba usaron
    contenedores sueltos, no Swarm, así que la orquentación/colocación de
    Swarm en sí sigue sin validar contra infraestructura real.

98. **Renombrado el prefijo de los contenedores: `fiscal-uploads-*` →
    `pfacturacion-*`.** Pedido explícito del usuario, solo cosmético (el
    nombre viejo venía de una etapa anterior del proyecto, antes de que se
    formalizara como "Portal de Facturación ADDV") — no cambia
    comportamiento, solo el `container_name:`/`image:` visible en
    `docker ps`/Docker Desktop. Tocado en 3 archivos:
    - `docker-compose.yml`: los 4 `container_name:` (mysql/minio/backend/
      frontend).
    - `docker-stack.yml`: los defaults `BACKEND_IMAGE`/`FRONTEND_IMAGE`.
    - `README.md`: los comandos de ejemplo `docker build -t ...`.

    Los nombres de red/volumen (`fiscal-net`, `mysql_data`, `minio_data`)
    **no se tocaron** — no se pidieron, y cambiarlos sin necesidad
    hubiera invalidado los volúmenes ya existentes en cualquier
    instalación corriendo (el nombre del volumen es lo que Docker usa
    para encontrar los datos ya guardados). Aplicado en caliente contra
    el stack real que quedó corriendo de la sesión anterior
    (`docker compose up -d`, recrea los 4 contenedores con el nombre
    nuevo) — confirmado healthy los 4, con los datos y el tenant de
    prueba `pruebasegmento9` intactos (mismos volúmenes, solo cambió el
    nombre del contenedor).

99. **Segmento 9b: `/control` separado a su propio contenedor** — pedido
    explícito del usuario, por seguridad (menor superficie de ataque,
    credencial de BD propia y angosta) y para poder desplegarlo en un
    servidor distinto si hace falta. Se investigó primero con un agente
    Explore las dependencias reales de `requireAdminAuth` antes de
    diseñar el corte (ver decisiones abajo), y se validó **contra
    infraestructura Docker real**, no solo con mocks.

    **Decisiones confirmadas con el usuario**:
    - **Auth de `/control` aislado: SOLO `ADMIN_USERS`.** Los mecanismos
      `fallback_admin`/`perfil_bd` (que viven en la BD del tenant por
      defecto, no en `control_tenants`) se quedan exclusivamente para
      `/admin` — no se replican en `/control`. Los usuarios normales de
      cliente/admin siguen gestionándose exactamente donde ya se
      gestionan hoy (pantalla "Usuarios" del panel `/admin`), sin ningún
      cambio ahí.
    - **Invalidación de caché cruzada vía llamada interna**:
      `POST /internal/cache-tenant/invalidar` en `backend` (protegido por
      `INTERNAL_CACHE_SECRET` compartido), llamado por `control`
      fire-and-forget justo después de cada transición — **validado en
      vivo**: 200 antes de suspender, 404 inmediatamente después (sin
      esperar los ~45s de TTL de la caché de tenant).
    - **Nginx apunta a `/control` por variable de entorno**
      (`CONTROL_UPSTREAM_HOST`/`CONTROL_UPSTREAM_PORT`), usando el
      soporte nativo de plantillas de la imagen oficial de nginx
      (`nginx.conf.template` en `/etc/nginx/templates/`, `envsubst`
      automático) — así `/control` puede vivir en la misma red Docker o
      en un servidor completamente distinto, solo cambiando esa
      variable, sin reconstruir la imagen del frontend.

    **Qué se movió/creó**:
    - Nuevo directorio `control/` (hermano de `backend/`/`frontend/`,
      contexto de build de Docker aparte): `server.js`, `db.js`,
      `utils/auth.js` (solo `ADMIN_USERS`), `utils/tenantLifecycle.js`
      (movido desde `backend/`, ahora notifica al backend en vez de
      invalidar una caché local), `utils/notificarBackend.js` (nuevo),
      `utils/adminAuditoria.js` (copia), `scripts/ensureSchema.js`
      (columna `baja_en`, duplicado de `backend/scripts/lib/controlDb.js`
      porque son contextos de build separados — mismo principio ya usado
      en este proyecto para JS de frontend sin bundler compartido),
      `Dockerfile` propio (más liviano que el de `backend`: sin
      multer/pdf-parse/exceljs/AWS SDK/nodemailer/cookie-parser, ninguno
      de los cuales necesita), `package.json` propio.
    - `backend/server.js`: se retiraron las 4 rutas `/api/control/*`, el
      middleware de auditoría montado ahí, y el helper
      `manejarTransicionTenant`. Se agregó
      `POST /internal/cache-tenant/invalidar` (protegido por secreto
      compartido, no expuesto por nginx).
    - `backend/utils/tenantLifecycle.js` eliminado (vive en `control/`).
    - `backend/scripts/lib/controlDb.js`: `asegurarControlYPrivilegios()`
      gana un bloque nuevo, condicional a que se le pase
      `controlAppPassword` (para no romper instalaciones que aún no
      desplegaron `/control`) — crea/rota el usuario MySQL
      `control_app` con `GRANT SELECT, INSERT, UPDATE, CREATE, ALTER ON
      control_tenants.*` — **deliberadamente sin `DELETE` y sin ningún
      privilegio sobre `tenant_*`**, a diferencia del usuario `app`
      compartido (que sí tiene `ALL PRIVILEGES` sobre cualquier
      `tenant_*`, ver segmento 1). `asegurarColumnasCicloVidaTenant`
      también se eliminó de aquí (duplicada en `control/`).
    - `frontend/nginx.conf` → `frontend/nginx.conf.template` (+
      `frontend/Dockerfile` copia a `/etc/nginx/templates/` en vez de
      `conf.d/` directo) — nuevo `upstream control_upstream` y
      `location ^~ /api/control/` (más específico que
      `location ^~ /api/`, nginx prioriza el prefijo más largo sin
      importar el orden de declaración).
    - `docker-compose.yml`/`docker-stack.yml`: nuevo servicio `control`;
      `backend` gana `INTERNAL_CACHE_SECRET`; `frontend` gana
      `CONTROL_UPSTREAM_HOST`/`PORT` + `depends_on: control`.
    - `.env.example`: `CONTROL_APP_PASSWORD`, `INTERNAL_CACHE_SECRET`,
      `CONTROL_UPSTREAM_HOST`/`PORT` documentadas.

    **Validación contra Docker real** (mismo entorno del punto 97-98):
    - `docker compose up -d --build` con los 5 servicios — todos
      **healthy**, `nginx -t` limpio (confirma que el `envsubst` de la
      plantilla funcionó bien).
    - Verificado con conexiones MySQL directas: `control_app` puede leer
      `control_tenants.tenants` pero recibe `Access denied` contra
      `tenant_pruebasegmento9` **y** contra `portal_facturacion` (la BD
      del tenant por defecto, donde vive `fallback_admin`/`perfil_bd`) —
      confirma el aislamiento real, no solo teórico.
    - Ciclo de vida completo (suspender/reactivar/baja/reactivar desde
      baja/404 en slug inexistente) probado de nuevo contra el servicio
      YA separado, con la caché del backend invalidándose de inmediato
      (no hasta 45s después). Auditoría verificada en
      `control_tenants.admin_auditoria`, escrita con la credencial
      angosta `control_app` (confirma que sus privilegios `INSERT`/
      `CREATE` sobre esa tabla alcanzan).
    - Suite completa: `control/` **4 suites, 33 pruebas**; `backend/`
      **28 suites, 470 pruebas** (bajó desde 487 porque 22 pruebas se
      movieron a `control/`; suben 5 nuevas ahí por el endpoint interno y
      la credencial `control_app`) — 0 fallas en ambas.

    **Quedó corriendo en esta máquina**: los 5 servicios, healthy, y un
    archivo `.env` nuevo en la raíz del proyecto con
    `CONTROL_APP_PASSWORD`/`INTERNAL_CACHE_SECRET` de PRUEBA (no
    producción) — cámbialos antes de desplegar de verdad, igual que
    cualquier otro secreto de este archivo.

    **Limitación vigente**: igual que segmentos anteriores, no se probó
    `/control` en un servidor genuinamente distinto (solo mismo host,
    mismo docker-compose) — el mecanismo (`CONTROL_UPSTREAM_HOST`/
    `BACKEND_INTERNAL_URL` apuntando a una URL real) está construido para
    eso pero no hay un segundo servidor disponible en este entorno para
    confirmarlo de punta a punta.

100. **Segunda pasada de validación del segmento 9b — ahora con clics
    reales en navegador** (pedido explícito del usuario: pruebas +
    Docker + extensión Claude in Chrome, sin preguntar antes de cada
    paso). Todo lo anterior (punto 99) se había validado por `curl`; esta
    vez se usó la extensión del navegador (ya conectada por el usuario)
    para confirmar la UI de verdad, con clics.

    - `npm test` en `backend/` y `control/` corridos de nuevo: **470 y 33
      pruebas, 0 fallas**, sin cambios respecto al punto 99.
    - Stack de Docker: ya estaba arriba de la sesión anterior — 5
      servicios healthy confirmados de nuevo.
    - **Bug encontrado y corregido**: `frontend/control.html` seguía
      mencionando "la cuenta de respaldo" en el texto de ayuda del login
      — mensaje que dejó de ser cierto en el segmento 9b (`/control` solo
      acepta `ADMIN_USERS` desde que quedó aislado en su propio
      contenedor). Corregido el texto, reconstruido `frontend`, y
      confirmado visualmente en el navegador que el mensaje nuevo se ve
      bien tras un hard-reload (el navegador tenía la versión vieja en
      caché — buen recordatorio de que un cambio en HTML estático puede
      no verse de inmediato sin refrescar fuerte).
    - **Flujo completo probado con clics reales** (no `curl`) en
      `/admin` y `/control`, usando la extensión Claude in Chrome:
      - `/admin`: login con `admin`/`admin`, panel carga con datos
        reales.
      - `/control`: login, tabla de tenants carga
        (`pruebasegmento9`, activo), clic en "Suspender" → modal de
        confirmación → confirmar → badge cambia a "Suspendido", aparece
        toast "Listo: ...", tabla se actualiza sola sin recargar. Mismo
        flujo para "Reactivar" → vuelve a "Activo". Tenant quedó en su
        estado original (`activo`) al terminar.
      - `docker logs` de `backend` y `control` revisados tras las
        acciones: sin errores — confirma que la llamada interna de
        invalidación de caché (punto 99) corrió limpia también desde
        clics reales de UI, no solo desde `curl`.
    - Nota operativa (no un bug): al automatizar los clics, un primer
      intento de enviar el formulario de login de `/control` no disparó
      ninguna petición de red — el elemento tenía una referencia de
      accesibilidad obsoleta tras un hard-reload previo. Volver a
      localizar el botón con `find` justo antes de cada clic (en vez de
      reusar referencias de una captura de pantalla anterior) lo
      resolvió. Sin relación con el código de la app — es una
      particularidad de automatizar el navegador contra una SPA
      recién recargada, dejarlo anotado por si se repite en una futura
      sesión.

101. **Segmento 9c — alta de empresa nueva desde `/control` (intake con
    `estado='provisioning'` + pre-llenado fiscal al aprovisionar)**.
    Extiende el segmento 9 (`/control` gestionaba ciclo de vida de
    tenants ya existentes pero **no** creaba ninguno) sin tocar la
    decisión de seguridad del segmento 1: el alta física de un tenant
    (CREATE DATABASE + esquema + GRANT) sigue siendo exclusiva del
    script CLI `backend/scripts/provisionar-tenant.js`, que requiere
    root de MySQL — el contenedor `control` sigue con su credencial
    angosta `control_app` (SELECT/INSERT/UPDATE/CREATE/ALTER solo sobre
    `control_tenants.*`). Lo nuevo es la **captura de la intención de
    alta** desde la UI de `/control`: guarda la fila con
    `estado='provisioning'` (no `activo`), y el script CLI la detecta,
    la completa y la pasa a `activo` en vez de rechazarla como "ya
    existe". Diseño aprobado por el usuario el 2026-08-13 (decisión
    #1739 en Claude Mem, única fuente previa de este diseño).

    **Archivos tocados:**
    - `control/utils/tenantIntake.js` (NUEVO): `crearTenantIntake()`
      — valida (nombre empresa obligatorio ≤255, slug vía
      `validarSlug`, email de contacto opcional, fiscal opcional vía
      `normalizarYValidarDatosFiscales`), verifica duplicados
      (`SELECT id` + catch de `ER_DUP_ENTRY` contra la UNIQUE KEY para
      la condición de carrera), deriva infraestructura
      (`db_host = TENANT_DB_HOST || CONTROL_DB_HOST || 'mysql'`,
      `db_user = TENANT_DB_USER || 'app'`, `db_name`/`storage_prefix`
      desde el slug — mismos criterios que el script CLI, para que el
      script complete la fila sin recalcular nada), INSERT con
      `estado='provisioning'`, y registra evento
      `alta_solicitada` en `tenant_eventos`. Error tipado
      `ErrorIntakeTenant` con `codigo='slug_existe'` (→409) vs
      `'validacion'` (→400).
    - `control/server.js`: ruta nueva `POST /api/control/tenants`
      (201 en éxito, 400/409 con el motivo, 401 si no es `ADMIN_USERS`
      super — misma protección que el resto de `/control`).
    - `frontend/control.html` + `frontend/control.js` +
      `frontend/admin.css`: botón "Nueva empresa" y modal de intake
      con preview en vivo de las URLs (`/<slug>` y `/<slug>/admin`),
      validación en cliente con los mismos mensajes que el servidor,
      sección fiscal plegable (los 7 campos de
      `control/scripts/ensureSchema.js`) — todos opcionales, y el
      texto de ayuda lo dice explícitamente porque el intake es
      especulativo (la empresa no tiene BD propia todavía). Clase
      `.modal-ancho` (560px, scroll interno) como extensión de
      `style.css`, no reemplazo.
    - `backend/scripts/lib/controlDb.js`:
      `aplicarConfiguracionFiscalEnProcesoHijo()` — al aprovisionar,
      si la fila trae datos fiscales, los inyecta al proceso hijo de
      `provisionar-tenant.js` vía variable de entorno
      `DATOS_FISCALES_INTENTO` (JSON) para que el tenant nazca con su
      config fiscal pre-llenada en vez de vacía.
    - `backend/scripts/provisionar-tenant.js` (REESCRITO): conserva la
      rama CLI tradicional (crear desde cero), y agrega la rama de
      intake — si el slug ya existe en `estado='provisioning'`, usa la
      fila (nombre/contacto/fiscal vienen de ahí, los flags de CLI son
      opcionales en esa rama), la completa (afinaciones y fecha) y la
      pasa a `activo`. `CREATE DATABASE IF NOT EXISTS` compartido por
      ambas ramas. `db_host`/`db_user`/`db_name`/`storage_prefix` se
      leen de la fila, no se recalculan.
    - `control/scripts/ensureSchema.js` (ya del 9b, sin cambios de
      lógica aquí): `COLUMNAS_NUEVAS` pasó de 1 columna (`baja_en`) a
      8 — las 7 fiscales (`rfc_compania VARCHAR(13)`,
      `razon_social_compania VARCHAR(255)`,
      `regimen_fiscal_compania VARCHAR(255)`,
      `tipo_persona_compania ENUM('fisica','moral')`,
      `clave_sat VARCHAR(8)`, `link_codigos_sat VARCHAR(500)`,
      `correo_reportes VARCHAR(200)` — todas NULL, mismos
      nombres/tipos que en la BD de cada tenant para que el
      pre-llenado sea copia directa sin mapear nombres).
    - `.env.example` y `docker-compose.yml`: `TENANT_DB_HOST` y
      `TENANT_DB_USER` documentados y pasados al servicio `control`
      (solo si los tenants viven en una instancia MySQL distinta a la
      del control; por defecto heredan `CONTROL_DB_HOST`/'app').

    **Pruebas** (sin Docker/MySQL real en este entorno — limitación
    vigente, ver sección siguiente):
    - `control/test/unit/tenantIntake.test.js` (NUEVO, 11 pruebas):
      validación de cada campo, duplicado → 409, carrera →
      ER_DUP_ENTRY → 409, derivación de db_host/db_user desde env,
      fiscal opcional, evento `alta_solicitada`.
    - `control/test/integration/control.test.js`: 5 pruebas nuevas de
      POST /tenants (201 con datos mínimos, 400 por validación, 409
      por duplicado, 401 sin auth, 201 con fiscal completo). Se
      corrigió 1 aserción preexistente: la auditoría escribe en el
      pool aun en respuestas 400 (fire-and-forget).
    - `control/test/unit/ensureSchema.test.js`: los 2 tests existentes
      solo contemplaban `baja_en`; se reescribieron para las 8
      columnas + 1 nuevo caso "agrega solo las que faltan" (3
      pruebas).
    - `backend/test/unit/controlDb.test.js`: pruebas nuevas de
      `aplicarConfiguracionFiscalEnProcesoHijo` (mock de
      `child_process`).
    - Resultado: **control 5 suites / 50 pruebas, backend 28 suites /
      472 pruebas — 0 fallas** (antes del 9c: 33 y 470). `node
      --check` limpio en todos los `.js` tocados.

    **Pendiente antes de producción** (igual que el resto del 9b/9c,
    no hay MySQL real aquí): validar contra Docker real el flujo
    completo UI → fila `provisioning` → `provisionar-tenant.js` →
    tenant `activo` con config fiscal pre-llenada (el 9b ya dejó el
    stack validado, falta el alta nueva), y probar el modal en
    navegador real (escritorio y móvil).

    **VALIDADO contra Docker/MySQL reales el 2026-08-13** (misma sesión
    que escribió este punto — Docker Desktop estaba disponible, se
    levantó el stack completo):
    - Intake por API real: `POST /api/control/tenants` → 201 con
      fila `provisioning` completa (datos derivados db_name/prefix,
      fiscales capturados). 409 por slug duplicado, 400 por email
      inválido / nombre faltante / clave SAT no-8-dígitos, 401 sin
      auth — todos contra la instancia real.
    - **Bug encontrado y corregido (rama 9c de provisionar-tenant.js)**:
      el script corría desde el HOST con `DB_HOST=localhost`, pero la
      rama 9c pasaba `fila.db_host` ('mysql', nombre de servicio
      Docker, correcto para los contenedores pero irresoluble desde
      el host) a los procesos hijo de `ensureSchema` y del pre-llenado
      fiscal → `getaddrinfo ENOTFOUND mysql`. Fix: ambos procesos hijo
      usan `dbHost`/`appUser` del env del script (la misma instancia a
      la que root se conectó); `fila.db_name` se conserva. La rama CLI
      tradicional no cambió (con `fila=null` ya usaba `dbHost`).
    - Flujo completo real: fila `provisioning` → script detecta la
      solicitud → crea `tenant_piloto9c` con esquema → pre-llena
      `configuracion_global` con los 7 campos fiscales del intake →
      fila pasa a `activo` con `activado_en`. Eventos registrados:
      `alta_solicitada` (admin) → `alta_fallida` (del intento con el
      bug, antes del fix) → `alta_completada`.
    - Ciclo de vida del tenant nuevo validado vía `/piloto9c/api/*`
      (la ruta que nginx reescribe con `X-Tenant-Slug`, no el header a
      mano — nginx lo limpia del cliente, segmento 7): suspendido →
      404, reactivado → 200, slug inexistente → 404.
    - Wiring del modal verificado (46 `getElementById` del JS todos
      presentes en el HTML, sin ids duplicados). Suites: control
      50/50, backend 472/472 después del fix.
    - Estado final limpio: `piloto9c` queda `activo`, stack 5/5
      healthy.

    **Validación E2E en navegador real (Playwright, 2026-08-13, misma
    sesión)** — cierra el pendiente del modal en navegador real:
    - `e2e/tests/control-alta-empresa.spec.ts` (NUEVO): login en
      `/control` (admin/admin) → botón "Nueva empresa" → preview en vivo
      de URLs (`/<slug>` y `/<slug>/admin`) → captura con los 7 campos
      fiscales (sección plegable) → 201 cierra el modal y muestra toast →
      fila "Provisionando" en la tabla. Segundo test: slug duplicado →
      409 y el modal permanece abierto con el mensaje.
    - `e2e/tests/contexto-urls.spec.ts` (NUEVO): el slug capturado define
      las URLs reales — `/e2e9c…/login` y `/e2e9c…/admin` responden 200,
      la API tenant-aware bajo `/e2e9c…/api/*` resuelve contra la BD del
      tenant (Basic Auth `admin:admin` contra `admin_fallback_password_hash`
      sembrada por el script → 200 `{ok, usuario:"admin", perfil:"super"}`),
      y un slug inexistente da 404. El slug activo se guarda en
      `e2e/.slug-e2e.txt` (ignorado por git) para que el aprovisionamiento
      CLI y la validación de URLs usen el mismo tenant.
    - Flujo completo repetido con un segundo tenant (`e2e9c60170151`):
      captura UI → `provisionar-tenant.js` → `activo` → contexto de URLs
      validado (4/4). El primer tenant de la suite quedó `activo` también
      (`e2e9c59931917`, aprovisionado y validado).
    - Suite E2E completa: **7/7 passed** (smoke + captura + duplicado +
      4 de contexto de URLs). Suites unitarias sin regresión: control
      50/50, backend 472/472.

102. **Validación E2E funcional del flujo completo de facturación en el
    tenant real `piloto9c` + DOS bugs de producción reales encontrados y
    corregidos** (Playwright headed, 2026-08-13, stack Docker real):
    - `e2e/tests/flujo-facturacion-piloto9c.spec.ts` (NUEVO): 5 tests
      seriales del ciclo completo — cliente se registra y sube su CSF
      (`constancia-grande.pdf` con indicadores SAT) → admin crea la orden
      de compra → cliente sube ticket (imagen + No. compra/fecha/hora/
      total, uso CFDI, tipo pago, comentarios) → folio TK-… pendiente →
      admin sube el ZIP de la factura (PDF+XML) → ticket "Listo" → el
      cliente ve "Listo" en su dashboard y descarga la factura. Corre en
      navegador real (`--headed`), con `test.slow()`, contexto de
      navegador separado para cliente (cookie de sesión) y admin (Basic
      Auth). Fixtures reales en `e2e/fixtures/`.
    - **BUG 1 (producción, multi-tenant): el AsyncLocalStorage de
      `ejecutarComoTenant` no se propaga de forma confiable al callback
      de multer/busboy.** El stream del request lo crea el HTTP server
      fuera del `almacenTenant.run(...)`, así que `almacenTenant.getStore()`
      a veces devuelve `undefined` y `pool.query` cae al pool por defecto
      (`portal_facturacion`) aunque `req.tenant` esté bien resuelto. Es
      una carrera (se invertía entre restarts) que explicaba los registros
      huérfanos en la BD de control y los `COMPRA_NO_ENCONTRADA`
      intermitentes (la orden se buscaba en la BD equivocada). Afectaba
      las 4 rutas con multer: `POST /api/tickets`, `POST /api/registro`,
      `POST /api/admin/config/constancia-compania`,
      `POST /api/admin/tickets/:id/factura`. **Fix**: el middleware
      `resolverTenantMiddleware` (`backend/utils/tenantContext.js`) ahora
      guarda `req.poolTenant = tenantPool` ANTES de `ejecutarComoTenant`;
      en `backend/server.js` los helpers `reanudarContextoTenant(req, fn)`
      (re-entra al contexto del pool si existe) y `subirConTenant(
      multerUpload, campo, req, res, cb)` (envuelve el callback de multer)
      hacen que los 4 call sites se ejecuten SIEMPRE dentro del contexto
      del tenant correcto.
    - **BUG 2 (producción, todos los tenants): desfase de 1 segundo entre
      la hora que se muestra al crear una orden de compra y la que se
      guarda.** `new Date()` lleva milisegundos: `Intl.DateTimeFormat`
      (trunca) mostraba `17:43:16` en la respuesta/correo, pero MySQL
      (redondea DATETIME sin fracción) guardaba `23:43:17` UTC (= 17:43:17
      CDMX) → la validación del ticket (comparación exacta de hora contra
      la orden, `COMPRA_NO_ENCONTRADA`) fallaba ~50% de las veces según
      los ms, incluso con datos correctos — afectaba también a usuarios
      reales que teclearan la hora del correo de confirmación. **Fix**:
      `ahora.setMilliseconds(0)` antes del INSERT y de la respuesta en
      `POST /api/admin/ordenes-compra` — BD, respuesta y correo usan el
      mismo segundo exacto, determinista.
    - **Robustez del spec E2E**: `beforeAll` limpia tickets residuales de
      corridas anteriores vía API admin (borrado permanente), y el helper
      `cerrarNotifTickets(page)` cierra el modal "Tickets nuevos por
      facturar" (que bloquea la UI) si aparece al entrar al panel.
    - Verificación: `node --check` en los archivos tocados, suite Jest
      backend 388/388 (20 suites, `npx jest test/unit`), experimento de
      5 órdenes seguidas vía API (hora de respuesta = hora en BD en los 5
      casos), y **suite E2E completa 5/5 passed** (16.7s). Estado final
      en BD: ticket TK-000005 `listo` con `factura.zip`, orden
      OC-000011, todo en `tenant_piloto9c` — cero filas e2e en
      `portal_facturacion` (datos reales intactos).
    - Nota: `e2e/debug-select.js` y `e2e/diag-orden.js` (artefactos de
      diagnóstico del BUG 1) se eliminaron.

103. **Segmento "Marca": el nombre con el que cada empresa quiere ser
    reconocida en los correos del portal (en vez del genérico "ADDV") +
    logo opcional + etiqueta "Slug (Contexto URL único)"** (aprobado por el
    usuario 2026-08-13, instrucción textual: "agrega control otro campo que
    se llame MARCA, este es con el que quieren ser reconocidos con su logo
    o texto, deja la opción para cargar logo, pero sino cargan logo, Sea el
    nombre en texto y nosotros generamos el logo"; y "al texto Slug
    (identificador único) modificalo por Slug (Contexto URL único)"):
    - **Modelo de datos**: columnas `marca VARCHAR(255) NULL` y
      `marca_logo_url VARCHAR(500) NULL` en `control_tenants.tenants`,
      agregadas por `control/scripts/ensureSchema.js` (única fuente del
      esquema de control; `backend/scripts/lib/controlDb.js` no se tocó,
      mismo patrón que las columnas del 9c). El logo se guarda en MinIO
      con key `marca/<slug>/logo` (sin extensión; ContentType del objeto),
      y en la fila solo la ruta pública relativa `/api/marca-logo/<slug>`.
    - **Flujo del logo (el control no tiene SDK S3 ni multer)**: navegador
      → base64 JSON → control → `POST /internal/marca-logo/:slug` del
      backend (protegido con `X-Internal-Secret`/`INTERNAL_CACHE_SECRET`,
      NO expuesto por nginx; valida magic bytes PNG/JPEG/WEBP y
      `MAX_MARCA_LOGO_MB=2`, configurable vía env en ambos contenedores) →
      MinIO → el backend devuelve la ruta pública que se guarda en la fila.
      `DELETE /internal/marca-logo/:slug` borra el archivo ("quitar logo").
      `GET /api/marca-logo/:slug` es público a propósito (el logo va en
      correos) con `Cache-Control: public, max-age=86400`. Límites de
      `express.json` subidos a 4mb en backend y control (el base64 de un
      logo de 2MB pesa ~2.7MB).
    - **Mapeo de los 7 "ADDV" incrustados en correos del backend**
      (`backend/server.js`): constante `MARCA_DEFECTO='ADDV'` + helper
      `marcaDelTenant(req)` = `(req.tenant && req.tenant.marca) ||
      'ADDV'`; `req.tenant.marca`/`marcaLoGoUrl` llegan vía
      `resolverTenantPorSlug` (`backend/utils/tenantContext.js`). Puntos
      mapeados: `logoTicketHtml(logoUrl, marca)` (tickets), correo de
      orden de compra (`construirCorreoOrdenCompra`, footer con marca;
      prioridad de logo: `marcaLoGoUrl` del tenant convertido a absoluto
      con `detectarUrlPortal(req)` > `configGlobal.logo_url`), invitación
      al portal (`enviarInvitacionPortal`, asunto + cuerpo), aviso de
      ticket nuevo al contador (`notificarNuevoTicketAlContador`), aviso
      de factura lista al cliente (`notificarFacturaListaAlCliente`), y la
      plantilla default de `backend/utils/email.js` (`{folio}`, `{rfc}`,
      `{marca}`).
    - **API de control**: `PUT /api/control/tenants/:slug/marca` con
      `{ marca?, logoBase64?, quitarLogo? }` (400 validación / 404 slug /
      502 backend rechazó el logo); registra evento `marca_actualizada`
      en `tenant_eventos` e invalida la caché del backend
      (`notificarInvalidacionCache`). El intake del 9c
      (`POST /api/control/tenants`) acepta ahora `marca` y `logoBase64`
      (sube el logo ANTES de crear la fila; si el alta falla queda un
      archivo huérfano en MinIO, aceptado como inofensivo).
      Implementación: `control/utils/tenantMarca.js` (NUEVO) +
      `tenantIntake.js`.
    - **Frontend** (`frontend/control.html`/`control.js`/`admin.css`):
      etiqueta renombrada "Slug (Contexto URL único)"; campo Marca + input
      de logo (máx 2MB, JPG/PNG/WEBP) en el modal de "Nueva empresa";
      botón "Editar marca" por fila → modal propio con nombre + logo
      actual + reemplazo/quitado.
    - **Pruebas**: backend `test/integration/internal.test.js` (mock de
      storage; POST/DELETE/GET del logo: 403/200/400/404, Content-Type y
      cache); control `test/unit/tenantMarca.test.js` (8 casos),
      `test/unit/tenantIntake.test.js` (marca + rutas de logo),
      `test/integration/control.test.js` (PUT marca 200/400/404/401;
      intake 201 con logo, 400 logo grande — 2.5MB: el base64 de 3MB
      exactos toca el límite de 4mb de express y daría 413 antes de la
      validación propia — y 400 no-imagen). `ensureSchema.test.js`
      actualizado (11 columnas).
    - **Verificación real contra el stack Docker (2026-08-13)**: rebuild
      de backend/control/frontend; columnas presentes en MySQL real;
      PUT marca+logo → fila actualizada + objeto `marca/<slug>/logo` en
      MinIO (70B, Content-Type image/png) + GET público 200 con cache;
      quitarLogo → archivo borrado de MinIO y 404; alta de usuario bajo
      el tenant con `X-Tenant-Slug` → invitación llega hasta SMTP (no
      configurado, error esperado) con la marca real resuelta. Suites:
      **backend 482/482 (28 suites), control 67/67 (6 suites), E2E
      `flujo-facturacion-piloto9c` 5/5** (18.8s) — sin regresiones.
104. **Segmento "Edición": editar TODOS los datos de una empresa existente
    desde /control, incluido el cambio opcional de slug** (aprobado por el
    usuario 2026-08-13 — instrucción textual: "agrega edición de empresa
    para modificar sus datos, se habilita con un switch avanzado para
    cambiar el slug y que este no afecte la facturación actual") — 
    reemplaza al modal "Editar marca" del segmento 103 (ahora un botón
    "Editar" por fila que abre el modal de edición completa):
    - **Modelo de datos**: sin columnas nuevas; reutiliza las del 9c y
      103. El slug sigue siendo la identidad pública (URLs `/<slug>/...`,
      prefijo de archivos en MinIO, clave de resolución del backend).
    - **Migración de archivos al cambiar el slug** (endpoint interno
      NUEVO `POST /internal/renombrar-slug` en `backend/server.js`,
      protegido con `X-Internal-Secret`/`INTERNAL_CACHE_SECRET`, NO
      expuesto por nginx): copia TODOS los objetos del prefijo
      `/<slug_viejo>/` al nuevo (verificado por conteo — si el destino
      no tiene tantos objetos como el origen, responde 502 SIN borrar
      nada), mueve el logo de marca (`marca/<slug_viejo>/logo` →
      `marca/<slug_nuevo>/logo` si existe) y solo entonces borra lo
      viejo. Helpers NUEVOS en `backend/utils/storage.js`:
      `copiarArchivo()` (CopyObjectCommand) y `eliminarPrefijo()`
      (listado paginado + DeleteObject por objeto). nginx NO necesita
      recargarse (rutas de tenant por regex dinámicas del segmento 4); el
      control invalida la caché de resolución del backend para ambos
      slugs (viejo queda 404, nuevo responde ya).
    - **La BD física del tenant NO se renombra**: `db_name` se conserva
      tal cual en tenants ya aprovisionados (el backend se conecta por el
      `db_name` guardado en la fila); solo en estado `provisioning` (BD
      aún no creada) se regenera con el slug nuevo
      (`nombreDbTenant(slugNuevo)`) para que `provisionar-tenant.js`
      cree la BD con el nombre correcto. El `storage_prefix` SÍ cambia
      siempre al slug nuevo.
    - **API de control**: NUEVO `PUT /api/control/tenants/:slug`
      (`control/server.js` + `control/utils/tenantEdicion.js` NUEVO).
      Acepta los MISMOS campos que el alta (nombreEmpresa obligatorio,
      contactoEmail, notas, fiscales, marca, logoBase64, quitarLogo) más
      `slug` opcional — solo se aplica si el operador lo habilitó
      explícitamente (switch en la UI). Orden: validar → slug duplicado
      (409) → migrar archivos en el backend ANTES de tocar la fila (502
      si el backend la rechaza) → subir/borrar logo al slug FINAL →
      UPDATE → evento de auditoría `datos_actualizados`/`slug_cambiado`
      en `tenant_eventos` → invalidar caché del backend. Reutiliza
      `normalizarDatosBase` (ahora exportado por `tenantIntake.js`) y
      `subirLogoAlBackend`/`borrarLogoDelBackend` (ahora exportado por
      `tenantMarca.js`). El slug del tenant solo cambia si el switch está
      activado (si no, se ignora aunque venga distinto).
    - **Frontend** (`frontend/control.html`/`control.js`/`admin.css`): el
      modal "Editar marca" se reemplaza por el modal "Editar empresa"
      (mismos campos que el alta + slug en solo lectura). El slug se
      habilita con el switch "Cambiar slug (avanzado)" (CSS nuevo
      `.control-switch` en admin.css); al activarlo se muestra una
      advertencia de migración irreversible; al desactivarlo se revierte
      al slug actual. Toast distinto si el slug cambió ("las URLs
      antiguas ya no responden"). Botón por fila renombrado de
      "Editar marca" a "Editar" (`.btn-editar` en admin.css).
    - **Pruebas**: backend `test/unit/storage.test.js` (copiarArchivo +
      eliminarPrefijo con paginación, 3 casos) e
      `test/integration/internal.test.js` (renombrar-slug:
      403/400/200/502 sin borrar nada si el conteo no cuadra, 6 casos);
      control `test/unit/tenantEdicion.test.js` NUEVO (13 casos: campos
      completos, slug con migración antes del UPDATE, db_name conservado
      en activo / regenerado en provisioning, 409 duplicado, 400
      validación, 404 inexistente, 502 backend caído/rechaza, logo al
      slug final, quitarLogo, logo grande, invalidación de caché que
      falla no rompe la edición) e `test/integration/control.test.js`
      (PUT edición: 200/400/404/409/502/401).
    - **Bug encontrado durante la revisión post-interrupción**: en
      `frontend/control.js` el toast de éxito comparaba `slugFinal` contra
      `slugActualEdicion` DESPUÉS de `cerrarEdicion()` (que lo pone en
      null) — siempre habría mostrado "el slug cambió". Fix: capturar
      `slugAnterior` antes de cerrar el modal.
    - **Pendiente antes de producción**: el flujo completo (renombrar
      slug contra MinIO real, edición contra MySQL real y E2E en
      navegador) NO se ha probado con el stack Docker levantado todavía.
    - **Suites al día**: **backend 492/492 (28 suites), control 88/88
      (7 suites)** — sin regresiones.
    - **Validación real contra el stack Docker (2026-08-14)**: rebuild
      de backend/control/frontend. Verificado de punta a punta:
      1) **Renombrado por API con archivos reales**: tenant de prueba
      `e2e-migracion-origen` creado vía intake 9c → aprovisionado por
      CLI → 4 archivos subidos a MinIO bajo `e2e-migracion-origen/`
      (constancias, `tickets/`, `facturas/`) + logo
      `marca/e2e-migracion-origen/logo` → `PUT /api/control/tenants`
      con slug `e2e-migracion-destino` + marca + logo nuevo →
      `200`; prefijo nuevo con los 4 archivos y contenido íntegro
      verificado byte a byte (`mc cat`), prefijo viejo vacío, logo
      movido, `db_name` conservado y `storage_prefix` actualizado en
      la fila, evento `slug_cambiado` en `tenant_eventos`, API del
      slug nuevo 200 / del viejo 404, `GET /api/marca-logo` nuevo 200
      / viejo 404.
      2) **Renombrado por la UI (Playwright)**: spec NUEVO
      `e2e/tests/control-editar-empresa.spec.ts` (2 tests seriales:
      editar datos sin slug → guardar con toast; switch "Cambiar slug
      (avanzado)" → migración + URLs nuevas activas + restauración del
      slug original por API al final para que la suite sea
      re-ejecutable — el slug actual se lee de la fila, no se asume).
      Encontró un detalle de la UI: el checkbox del switch está oculto
      visualmente (opacity 0) y el test debe clickar el label
      `label.control-switch[for=...]`, no el checkbox.
      3) **Suite E2E completa 14/14 passed** (24.8s): los 2 nuevos +
      smoke + control-alta-empresa 2/2 + contexto-urls 4/4 +
      flujo-facturacion-piloto9c 5/5. Durante la corrida se reactivó
      el tenant `e2e9c60170151` que había quedado suspendido por una
      prueba de la sesión anterior (estado residual en BD, no
      regresión), y se aprovisionaron los slugs capturados por
      control-alta-empresa con el paso CLI manual del harness.
      **El segmento queda validado contra Docker/MySQL/MinIO reales.**

105. **Segmento "Look & Feel": identidad visual (tema) personalizada por
    empresa desde `/control`** — cada tenant puede tener su propia
    paleta de colores, tipografías y radio de esquinas sobre el diseño
    base ADDV, más un favicon propio, sin tocar ningún CSS de
    componente:
    - **Modelo de datos**: columna NUEVA `tema_json` (`TEXT NULL`) en
      `control_tenants.tenants` vía `control/scripts/ensureSchema.js`.
      `NULL` = identidad base ADDV (la que define `frontend/style.css`);
      el JSON solo trae las claves que el tenant personaliza — las
      ausentes las cubre el diseño base. `TEXT` (no JSON nativo) para
      que la lectura no dependa de la versión de MySQL, mismo patrón que
      el resto de columnas de control.
    - **Validación duplicada backend/control** (mismo principio que
      `tenantMarca.js` con la firma de imagen — `control/` es un
      contexto de build aparte, no puede importar `backend/utils/`):
      `backend/utils/tenantTema.js` (fuente de verdad, con
      `parsearTemaDesdeFila`/`temaAVariables`/`fuentesAUrlGoogle`) y
      `control/utils/tenantTema.js` (`normalizarTema` + cálculo de
      contraste, catálogo de fuentes/radios idéntico a mano — hay que
      mantenerlos sincronizados si cambia el catálogo). Reglas: colores
      hex de 6 dígitos de una lista cerrada de 12 claves (`bg`,
      `surface`, `border`, `ink`, `inkSoft`, `accent`, `accentDark`,
      `accentSoft`, `warn`, `warnSoft`, `error`, `errorSoft`);
      tipografías solo de un catálogo cerrado de 8 fuentes de Google
      Fonts (nunca texto libre, para no arriesgar inyección en el
      `<link>` dinámico); radio `sm`/`md`/`lg`; contraste **WCAG 2.1 AA
      real** calculado sobre 9 pares fondo/texto (4.5:1 texto normal,
      3:1 botones/enlaces) — si un par no cumple, se rechaza con 400
      antes de guardar.
    - **Favicon**: mismo patrón que el logo de marca (segmento 103) pero
      con endpoints propios — `POST`/`DELETE /internal/favicon/:slug`
      en `backend/server.js` (protegidos con `X-Internal-Secret`, NO
      expuestos por nginx), archivo en MinIO bajo
      `marca/<slug>/favicon`, servido público en
      `GET /api/favicon/:slug` (cache 24h). `control/utils/tenantTema.js`
      reenvía el favicon al backend por HTTP (`subirFaviconAlBackend`/
      `borrarFaviconDelBackend`), igual que el logo. El renombrado de
      slug (`POST /internal/renombrar-slug`, segmento 104) ahora también
      migra el favicon si existe (`faviconMovido` en la respuesta) y
      `tenantEdicion.js` reescribe la ruta del favicon dentro de
      `tema_json` al slug nuevo.
    - **API de control**: NUEVO `PUT /api/control/tenants/:slug/tema`
      (`control/server.js` + `control/utils/tenantTema.js`). Body:
      `{ tema, faviconBase64?, quitarFavicon? }` o
      `{ restablecer: true }` (vuelve a `NULL` = diseño base y borra el
      favicon si tenía). 200/400 (validación, incluido contraste)/404
      (slug inexistente)/502 (backend rechazó el favicon). Cada cambio
      queda en `tenant_eventos` (`tema_actualizado`) e invalida la caché
      de resolución del backend (mismo mecanismo que marca/edición).
    - **API pública**: NUEVO `GET /api/tema/:slug` en
      `backend/server.js` — siempre 200 (o 404 solo si el slug tiene
      formato inválido; no distingue "tenant sin tema" de "tenant
      inexistente", igual que el logo de marca). Devuelve
      `{ marca, marcaLoGoUrl, tema, variables, fuentesGoogle }` listo
      para pintar. Cache corto (5 min, vs. 24h del logo) porque un
      cambio de identidad debe propagarse pronto. `resolverTenantPorSlug`
      ahora también trae `tema_json` en el SELECT.
    - **Frontend**: script NUEVO `frontend/theme.js`, cargado DESPUÉS de
      `style.css` en las 6 páginas del portal (login, dashboard, tickets,
      csf, admin, control) — pinta las CSS variables del tema sobre
      `:root`, carga los `<link>` de Google Fonts que falten, reemplaza
      `.brand-name`/`.brand-mark` con la marca/logo del tenant y el
      `<link rel="icon">` con el favicon. En páginas sin tenant (`/admin`
      sin slug, `/control`) no hace nada — degradación elegante también
      si el `fetch` falla o el tenant no tiene tema: el portal se ve con
      el diseño base ADDV, nunca rompe la página. Clase CSS nueva
      `.brand-mark-img` en `frontend/style.css`.
    - **UI de edición** (`frontend/control.html`/`control.js`/
      `admin.css`): sección colapsable "Identidad visual (personalizada)"
      dentro del modal "Editar empresa" del segmento 104 — 12 selectores
      de color, 3 selects de tipografía/radio, campo de favicon (máx.
      2 MB, mismo límite que el logo), vista previa en vivo (tarjeta de
      ejemplo que se repinta con cada cambio, sin esperar al guardado) y
      botón "Restablecer al diseño ADDV". El tema solo se envía al
      backend si el operador tocó algo (`temaModificado`); se guarda al
      slug FINAL (si el operador también cambió el slug en el mismo
      guardado, la migración de archivos ya corrió antes). Validación de
      contraste duplicada una tercera vez en `control.js` (mismos 9
      pares) para dar el error antes de intentar guardar.
    - **Pruebas**: `backend/test/unit/tenantTema.test.js` (normalización,
      contraste AA, `temaAVariables`/`fuentesAUrlGoogle`) y
      `backend/test/integration/tema.test.js` (`GET /api/tema/:slug` y
      los endpoints internos de favicon) + el caso de favicon agregado a
      `backend/test/integration/internal.test.js` (renombrar-slug).
      **Falta contraparte en `control/`**: no hay
      `control/test/unit/tenantTema.test.js` ni cobertura de integración
      para `PUT /api/control/tenants/:slug/tema` en
      `control/test/integration/control.test.js` — pendiente antes de
      dar el segmento por cerrado.
    - **Bug encontrado y corregido en esta revisión**: comentario con
      mojibake (encoding roto) en `control/scripts/ensureSchema.js`
      alrededor de la columna `marca` — cosmético (no afectaba
      ejecución), corregido a UTF-8 correcto.
    - **Sin verificar en esta sesión**: no se corrió `node --check` ni
      la suite Jest de `backend/`/`control/` sobre estos archivos (no
      autorizado en la sesión que hizo esta revisión), ni se probó
      contra Docker/MySQL/MinIO reales. Antes de dar el segmento por
      válido: correr ambas suites, agregar las pruebas de `control/`
      que faltan, y repetir el patrón de validación real en Docker de
      los segmentos 103/104 (subir/quitar favicon contra MinIO real,
      guardar tema contra MySQL real, ver el tema aplicado en un tenant
      real en el navegador).
106. **Rediseño de login (cliente y admin): split-screen fiel a
    `stitch/code.html`/`stitch/DESIGN.md`** (mock aportado por el
    usuario, carpeta `stitch/` en la raíz — no se borra, queda como
    referencia de diseño) — pedido explícito, mismo protocolo
    analizar-proponer-confirmar-implementar (2026-08-18):
    - **Layout**: `.auth-shell` nuevo en `frontend/auth.css` — panel de
      marca a la izquierda (`.auth-hero`) + tarjeta de formulario a la
      derecha (`.auth-card`), en vez de la card centrada de antes.
      Responsive: se apila en `≤860px`. Aplicado en `frontend/login.html`
      (login/registro/cambio de contraseña, mismos IDs y lógica, solo
      cambió el marcado alrededor) y `frontend/admin.html` (pantalla de
      acceso de `/admin`, ahora carga también `auth.css`).
    - **Paleta propia, contenida**: `.auth-shell` redefine
      `--color-accent`/`--color-ink`/`--color-border`/`--shadow-card`
      etc. como variables LOCALES (no toca `:root` en `style.css`) — los
      componentes existentes (`.btn-primary`, `.field input`, focus
      rings) se repintan solos vía cascada de variables CSS sin duplicar
      reglas. El resto del sitio (dashboard, tickets, csf, admin panel)
      conserva la paleta verde base intacta.
    - **Marca por defecto = CLARVO**: decisión explícita del usuario —
      "CLARVO" es el diseño/marca por defecto del plan base; la
      personalización real (logo, paleta, tipografías) para el
      siguiente plan sigue siendo el segmento "Look & Feel" (punto 105)
      vía `/control`. El lockup CLARVO/"Portal de Facturación"/"by ADDV"
      terminó como una imagen estática (`frontend/assets/branding.png`,
      subida por el usuario) en vez de texto — **por diseño pierde el
      reemplazo dinámico de `.brand-name`/`.brand-mark` que hace
      `theme.js` en esta franja específica** (un tenant con marca
      personalizada vía segmento 103 no repinta este bloque; sí sigue
      funcionando en el resto de páginas). Gráfico decorativo del panel
      izquierdo: `frontend/assets/login-decoracion-marca.png` (imagen
      aportada por el usuario, no generada por IA en el repo).
    - **`frontend/Dockerfile` corregido**: el `COPY` explícito de
      archivos nunca incluyó `theme.js` — bug preexistente del segmento
      105, el tema personalizado nunca se hubiera cargado en un
      contenedor real. Se agregó `theme.js` a la lista y un `COPY
      assets/ .../assets/` nuevo para los PNG. **Sin probar contra un
      build de Docker real en esta sesión** — antes de confiar esto en
      producción, reconstruir la imagen `frontend` y confirmar que
      `/theme.js` y `/assets/*.png` responden 200.
    - **Bug real encontrado y corregido (no exclusivo del login)**: en
      `frontend/style.css`, la regla base de inputs
      (`.field input[type="text"], input[type="email"], select,
      textarea`) nunca incluyó `password`/`tel`/`url`/`number`/`date` —
      cualquier campo contraseña del sitio (login, registro, cambio de
      contraseña, admin, `/control`) se veía con el borde/padding por
      defecto del navegador hasta que el usuario tocaba el ícono del
      ojo (que cambia `type="password"` a `type="text"`, matcheando
      recién ahí la regla). Se agregaron los tipos faltantes al
      selector base; el padding-right que le deja espacio al botón del
      ojo se separó a una regla aparte con la misma especificidad pero
      DESPUÉS en el archivo (si no, el `padding: 11px 12px` del
      selector base lo pisa y el texto queda debajo del ícono).
    - **Explícitamente omitido** (confirmado con el usuario): sin botón
      "Continuar con Google", sin checkbox "Recuérdame", sin enlace
      "¿Olvidaste tu contraseña?" (no existe flujo de recuperación de
      contraseña en la app — agregar el enlace sin el flujo real habría
      quedado roto). El campo de acceso del cliente sigue siendo RFC,
      no correo (el mock traía "Correo electrónico" pero cambiar el
      mecanismo de login es una decisión de negocio fuera de alcance de
      "aplicar el diseño").
    - **Sin verificar en esta sesión**: sin corrida de Playwright/E2E
      contra el stack Docker real, ni revisión visual con la extensión
      Claude in Chrome (no se pudo conectar). Validado solo sirviendo
      `frontend/` con un server estático simple y confirmación manual
      del usuario en navegador. `node --check` limpio en los `.js`
      tocados (`login.js`, `admin.js`, `theme.js` — ninguno cambió,
      solo se revalidó que siguen sirviendo bien con el HTML/CSS nuevo).
107. **Push del repo local a `ADDVportalFact` (master) — remotes git**
    (2026-08-18): el repo local tenía un solo remote `origin` apuntando a
    `https://github.com/antonioprado-sketch/portal-multi.git`, con la rama
    local `main`. Por pedido explícito del usuario se agregó el remote
    `fact` apuntando a `https://github.com/addv-prototipos/ADDVportalFact.git`
     (actualizado 2026-09-01 — antes `antonioprado-sketch/ADDVportalFact.git`) y se publicó el historial completo (`main` → `master` del remote):
    - **El master remoto tenía 53 commits con historial INDEPENDIENTE**
      (proyecto previo del usuario, ramas `master` y `prototipo`), sin
      ninguna relación de ancestría con este repo local — el push normal
      fue rechazado ("fetch first"). Con aprobación explícita del
      usuario se hizo **force push** (`git push fact main:master
      --force`): el `master` remoto quedó reemplazado por el historial
      local (7 commits, del 6d6cd68 al 0d96dd7). Los 53 commits del
      master anterior quedaron huérfanos (sigue existiendo la rama
      `prototipo` del remote, intacta).
    - **Estado de remotes actual** (`git remote -v`): `origin` =
      `portal-multi.git` (sin cambios) y `fact` = `ADDVportalFact.git`
      (nuevo). Rama local por defecto sigue siendo `main`; el flujo de
      publicación de aquí en adelante es `git push fact main:master`.
    - **Documentación** (este punto + `CLAUDE.md` + `AGENTS.md` +
      `README.md`) actualizada para que cualquier sesión futura conozca
      el remote correcto en vez de asumir `origin`.
108. **Rediseño de `/admin` y del portal de cliente fiel a los mockups de
    `stitch/` (2026-08-18/19)**: sesión con acceso real a Docker/MySQL/
    MinIO/navegador (extensión Claude in Chrome) — todo validado en vivo,
    no solo `node --check`. Trabajo por pedidos sucesivos del usuario,
    todos implementados y confirmados visualmente antes de cerrar:
    - **Sidebar del panel admin** (`frontend/admin.html`/`admin.css`):
      reestructurado de header+tabs horizontales a sidebar fijo tipo
      `stitch/panel_admin_portal_addv_fiel_al_mockup`, íconos SVG
      copiados literal del mockup. Paleta azul institucional (`#03285B`
      navy / `#05DBF2` cian) igual a la ya usada en el login (punto 106,
      `auth.css .auth-shell`) — variables CSS redefinidas en `.admin-body`
      (no en `.admin-dashboard`: los modales son hermanos de
      `#admin-dashboard` en el HTML, no hijos, así que el scope tenía que
      ser el `<body>` para que los modales también heredaran la paleta).
      Fondo del área de contenido usa `var(--color-bg)` (el beige cálido
      de marca, `#F6F4EF`), no un gris frío nuevo — corregido después de
      que el usuario notara la inconsistencia contra el resto del sitio.
    - **Logo**: `frontend/assets/branding_bgo.png` (variante clara del
      logo, texto blanco, subida por el usuario) para fondos oscuros —
      sidebar del admin y barra superior del portal de cliente. Sin
      tarjeta blanca de por medio (a diferencia de un intento inicial con
      `branding.png`, que trae texto oscuro y quedaba ilegible sobre
      navy). `branding.png` (oscuro) se sigue usando donde el fondo es
      claro (login).
    - **Bug real encontrado y corregido**: `.admin-content` con
      `display:flex; flex-direction:column` rompía el `margin:0 auto` de
      `.admin-main` (el auto-margin en flex encoge al contenido en vez de
      estirar), y la barra de herramientas de Constancias (con el botón
      "Columnas") se salía del viewport sin hacer wrap — el usuario lo
      reportó como "ya no están los filtros de columnas". Fix: quitar el
      `display:flex` innecesario de `.admin-content` (no hacía falta,
      apilar header+main ya es el comportamiento por defecto de bloques).
    - **Modal "Gestionar" de tickets** (`#ticket-modal-overlay`)
      rediseñado fiel a `stitch/detalle_de_solicitud`: modal ancho
      (820px) en 2 columnas — información de la solicitud + ticket
      adjunto a la izquierda, estatus + factura en tarjetas a la derecha
      — con un badge de estatus junto al título (reutiliza
      `ESTATUS_INFO`, ya existente). Mismos campos/funciones de siempre
      (RFC, Uso de CFDI, tipo de pago, comentarios del cliente, datos de
      compra, imagen con zoom, cambiar estatus, notas internas, subir
      factura) — ningún dato ni endpoint nuevo, solo reordenados.
    - **Vista "Inicio" nueva** (primera en el sidebar, junto con mover
      "Tickets" a segunda posición — pedido explícito): fiel a
      `stitch/dashboard_portal_addv_fiel_al_mockup` — bienvenida, 4
      tarjetas de estatísticas (Solicitudes totales / En proceso /
      Completadas / Rechazadas, mapeadas 1:1 a los 4 `estatus` reales de
      tickets: pendiente+en_curso / listo / cancelado), tabla de
      "Solicitudes recientes" (últimos 5 tickets, botón "Gestionar" abre
      el mismo modal de siempre) y una dona SVG de 3 segmentos con
      porcentajes reales. Todo calculado en el cliente a partir del MISMO
      endpoint `GET /admin/tickets` que ya usa la vista Tickets — sin
      endpoint nuevo. La tendencia "vs mes anterior" de cada tarjeta es
      real (compara `creado_en` del mes calendario actual contra el
      anterior); si no hay datos del mes anterior se muestra el conteo
      del mes en curso en vez de inventar un porcentaje. "Inicio" es
      ahora la vista por defecto al iniciar sesión (antes era
      Constancias) — `cambiarVistaPrincipal('constancias')` en el reset
      de logout y la precarga post-login se cambiaron a `'inicio'`.
      Permitida para perfiles `super`/`fiscal` (agregada a
      `RESTRICCIONES_PERFIL.fiscal.vistasPermitidas`); el perfil
      `administrador` no la ve porque tampoco ve Tickets (misma regla de
      negocio ya existente, la vista es 100% derivada de datos de
      tickets).
    - **Portal de cliente** (`dashboard.html`/`tickets.html`/`csf.html` +
      `portal.css`): misma paleta navy que el admin, escopada a
      `.portal-body` (no toca `/control`, que sigue en verde). Barra
      superior (`.portal-header`) en navy con el logo `branding_bgo.png`
      (agrandado de 26px a 42px de alto tras feedback del usuario de que
      se veía chico). `csf.html` no tenía la clase `.portal-body` en el
      `<body>` (bug preexistente, sin relación) — se agregó para que
      heredara la paleta igual que las otras dos páginas.
    - **Validado en vivo contra Docker/MySQL/MinIO reales**: stack
      levantado con `docker compose up`, dos tenants de prueba
      aprovisionados (`pruebaadmin`, `piloto9c`) para probar login de
      admin/cliente con datos reales (incluyendo tickets insertados a
      mano para ver Inicio con números != 0). **Bug de entorno
      encontrado y corregido, no de código**: `provisionar-tenant.js`
      corrido desde el host con `DB_HOST=127.0.0.1` guarda ese mismo
      valor como `db_host` del tenant en `control_tenants.tenants` — pero
      el backend (dentro de Docker) necesita `db_host='mysql'` para
      conectar. Se corrigió a mano con `UPDATE` para ambos tenants de
      prueba; si se vuelve a provisionar un tenant desde el host, revisar
      ese valor antes de asumir que el backend podrá conectarse.
      **Gotcha de esta sesión, anotarlo para la próxima**: un
      `docker compose build <servicio>` normal a veces NO recoge cambios
      de archivos aunque el contenido cambió (visto en este entorno
      Windows/Docker Desktop) — si un rebuild no se refleja al probar
      (verificar con `curl` al archivo estático servido), usar
      `docker compose build --no-cache <servicio>` seguido de
      `up -d --force-recreate <servicio>`. Además, el navegador cachea en
      disco el HTML/CSS servido — tras cualquier rebuild, forzar
      recarga dura (`Ctrl+Shift+R`) antes de concluir que un cambio no
      se aplicó.
    - Suite E2E de Playwright corrida contra el stack real (`--workers=1`,
      `E2E_BASE_URL` con `127.0.0.1` en vez de `localhost` — el Chromium
      de Playwright en este entorno resuelve `localhost` a IPv6 y se
      cuelga): la mayoría de las fallas encontradas eran huecos de
      fixtures del entorno (tenant `piloto9c` sin constancia fiscal
      subida, alta de empresa vía `/control` sin completar con el CLI,
      `e2e/.slug-e2e.txt` con un slug viejo de otra sesión) — no
      regresiones del reskin. Jest de backend: 516/517 sin cambios (la
      única falla, `tema.test.js` con typo `marcaLogoUrl`/`marcaLoGoUrl`,
      es preexistente y no relacionada).
    - **Skill global `addv-web-app`** (`~/.claude/skills/addv-web-app/
      SKILL.md`, fuera de este repo, afecta todos los proyectos del
      usuario bajo este protocolo) actualizada con las lecciones de esta
      sesión (caché de build/navegador arriba), `caveman` confirmado
      activo, e `impeccable` movida de "no instalada" a skill nativa
      activa en la tabla de fases de diseño/UI.
    - Commit `26ebdc6` (rediseño sidebar+modal+paleta+logo, sin la vista
      Inicio todavía) publicado a `fact main:master`. La vista Inicio +
      reorden del sidebar de este mismo punto se documentan aquí pero
      quedan para el próximo commit.

109. **Módulo "Gastos" — control administrativo de gastos de la operación**
    (2026-08-19): aprobado por el usuario con análisis previo (protocolo
    `addv-web-app`), implementado en 3 segmentos y verificado con
    `node --check` + suite Jest sin regresiones. Es una herramienta de
    control financiero operativo, **no** un sistema contable.
    - **Decisiones aprobadas**: solo perfil `administrador` (ni fiscal ni
      super por `ADMIN_USERS` — `requireAdminArea('administrador')`);
      monto único + flag `iva_incluido`; categorías en lista **cerrada**
      en código (`renta, nomina, software, hosting, servicios, papeleria,
      combustible, viaticos, publicidad, otro`); recurrente solo sí/no;
      papelera (borrado lógico + restaurar + eliminar permanente);
      comprobante **opcional** PDF (factura) o ZIP (par PDF+XML de CFDI,
      mismo criterio que tickets) en MinIO bajo carpeta `comprobantes`.
    - **S1 backend**: `backend/utils/gastos.js` (categorías + etiquetas +
      `categoriaValida()` + `clausulaCheckCategoria()` — la lista cerrada
      vive en UN solo lugar); tabla `gastos` en `backend/db.js` con CHECK
      `chk_gastos_categoria` (migración "actualizar si quedó
      desactualizado" como `chk_tickets_tipo_pago`); exports de MIME/
      extensiones de comprobante en `backend/utils/validate.js`;
      endpoints en `backend/server.js` (`adminApiLimiter` +
      `requireAdminAuth` + `requireAdminArea('administrador')` +
      `asyncHandler`): `GET /api/admin/gastos` (filtros `papelera`,
      `fecha_desde/hasta`, `categoria`, `tiene_factura`, `recurrente`,
      `busqueda`, paginación `pagina`/`por_pagina` 5..100) que devuelve
      `{total, pagina, por_pagina, gastos[], resumen:{mes_actual,
      con_factura, sin_factura, mes_anterior, cantidad}|null}` — el
      resumen de KPIs solo cuando NO es papelera; `POST /api/admin/gastos`
      (201 con `{ok, id}`); `PUT /:id` (si pasa a sin factura borra el
      comprobante del storage); `DELETE /:id` (papelera), `POST
      /:id/restaurar`, `DELETE /:id/permanente` (borra fila + comprobante);
      `POST /:id/comprobante` (multipart campo `comprobante`, multer en
      memoria `MAX_FILE_SIZE_BYTES`, verificación real por firma binaria
      vía `detectRealMimeType`/`esZipValido` — un archivo renombrado se
      rechaza con 400 aunque pase el filtro de extensión), `GET
      /:id/comprobante` (binario, nombre original) y `DELETE
      /:id/comprobante`. Booleans normalizados (`tiene_factura` etc.),
      `monto` Number, `fecha` "YYYY-MM-DD".
    - **S2 frontend** (`frontend/admin.html`/`admin.js`/`admin.css`):
      botón `#btn-vista-gastos` en el sidebar (entre Órdenes y Usuarios);
      vista `#vista-gastos` con toggle Activos/Papelera, 4 KPIs
      (`inicio-stats-grid` reusado: Total mes, Con factura, Sin factura,
      vs mes anterior — `es-positiva` cuando el gasto BAJA), filtros,
      tabla con columnas ocultables (persisten en `localStorage`) y
      paginación, columna Factura con link al PDF/ZIP o badge
      "Con factura"/"Sin factura"; modal de alta/edición y modal de
      detalle (2 columnas, descarga/quitado de comprobante); acciones de
      papelera (mover/restaurar/eliminar permanente) con
      `abrirConfirmacion`; `RESTRICCIONES_PERFIL.administrador` ya
      incluye `'gastos'` (el perfil fiscal nunca ve el botón ni puede
      llamar a la API).
    - **Bug real encontrado y corregido por la suite**: `res.json` de la
      lista usaba `por_pagina` cuando la variable local es `porPagina`
      (ReferenceError → 500 en cada GET). Detectado por
      `test/integration/gastos.test.js`, fix de una línea.
    - **Corrección de test preexistente**: `tema.test.js` tenía el typo
      `marcaLogoUrl` (esperado) contra `marcaLoGoUrl` (lo que el servidor
      realmente devuelve, y lo que la línea 114 del mismo test ya
      esperaba) — falla preexistente documentada en el punto 108
      (516/517); alineado el test al servidor y quedó 546/546.
    - **Suites al día**: backend Jest **546/546** (32 suites) — se
      agregaron `test/unit/gastos.test.js` (5) y
      `test/integration/gastos.test.js` (24, con mocks de
      `../../db`, `nodemailer` y `../../utils/storage`, helper
      `mockUsuarioAdministrativo`, buffers PDF/ZIP reales por firma).
    - **Validado contra MySQL+MinIO reales (2026-08-19)**: stack Docker
      levantado; `docker compose build --no-cache backend` + `up -d`
      (gotcha del punto 108: el build normal no siempre recoge cambios).
      `backend/scripts/verificar-mysql.js`: 256/262 (las 6 fallas eran
      PREEXISTENTES y ajenas a Gastos — `numero_compra` más largo que la
      columna en la prueba y un CHECK de tipo_persona que muere por
      `ER_DATA_TOO_LONG` antes del CHECK; el script no cubre gastos).
      Corregidas después (punto 111).
      Tabla `gastos` + CHECK `chk_gastos_categoria` confirmados vía
      `INFORMATION_SCHEMA` en MySQL real. Ciclo de vida completo por API
      (usuario `admin:admin` vía nginx en `127.0.0.1:8088`):
      POST alta (201, id=1) → GET lista con `resumen` (mes_actual/
      con_factura correctos) → subir comprobante PDF (80 bytes reales) →
      GET descarga (200, `Content-Type: application/pdf`,
      `Content-Disposition` con nombre original) → archivo verificado en
      MinIO bajo `_default/comprobantes/<uuid>.pdf` → PUT a "sin factura"
      BORRA el archivo de MinIO (directorio queda vacío) → POST
      comprobante a gasto sin factura rechazado (400 "Un gasto marcado
      sin factura no puede tener comprobante.") → papelera (activos total
      0 / papelera total 1, `resumen: null`, archivo CONSERVADO en
      MinIO) → restaurar (vuelve a activos) → permanente rechazado en
      activo (404 "Gasto no encontrado en la papelera.") → papelera +
      permanente borra fila Y archivo (MinIO vacío, fila id=1 en 0).
      Auditoría: `control_tenants.admin_auditoria` registra cada request
      de gastos con actor/mecanismo/perfil/tenant_slug/ruta/estatus/IP.
      La API y la lógica quedaron validadas; la revisión visual en
      navegador real se preparó en el punto 110 y **sigue pendiente de
      revisión por el usuario**.

110. **Revisión visual del módulo "Gastos" — preparación del entorno y
     gotchas de operación (2026-08-19)**: sesión dedicada a dejar la
     vista Gastos lista para que el usuario la pruebe en navegador real.
     - **Gotcha descubierto (validación de `docker compose`)**: tras
       `docker compose build --no-cache frontend`, el `docker compose
       up -d frontend` normal NO recreó el contenedor — el running
       container siguió sirviendo el `admin.html` viejo (verificado:
       la imagen nueva SÍ tenía `#btn-vista-gastos`, el contenedor no).
       Fix: `docker compose up -d --force-recreate frontend`. Moraleja
       para futuras sesiones: `build` + `up -d` no garantiza que el
       contenedor en curso se actualice; verificar el HTML servido
       (curl) y, si sigue viejo, forzar recreate.
     - **El `--force-recreate` reseteó el mapeo de puertos**: el
       contenedor frontend pasó de `8088:80` a `80:80` (el compose usa
       `${FRONTEND_PORT:-80}:80` y esta sesión no tenía la variable
       exportada). Se fijó `FRONTEND_PORT=8088` en `.env` (raíz) para
       que `docker compose up` siempre exponga el puerto conocido de
       las pruebas/docs, y se recreó el contenedor: vuelve a
       `8088:80` y sirve el `admin.html` con el botón Gastos.
     - **Datos sembrados para la revisión manual** (vía API real,
       `admin:admin` en `http://127.0.0.1:8088`): 2 gastos activos
       (*Renta del local* con comprobante PDF descargable y *Servicio
       de hosting*) + 1 en papelera (*Papelería y consumibles*). Los
       KPIs de la vista muestran los $2,300 reales del mes.
- **Revisión visual en curso por el usuario**: URL
        `http://localhost:8088/admin` (login `admin:admin`). Qué probar:
        KPIs, filtros/búsqueda, columnas ocultables, modal de detalle
        (descarga del comprobante), modal de alta/edición y toggle
        Activos/Papelera. Un script Playwright temporal de capturas se
        descartó al detectarse el gotcha del contenedor (se prefirió la
        revisión manual del usuario). El `.env` quedó así:
        `CONTROL_APP_PASSWORD`, `INTERNAL_CACHE_SECRET`,
        `FRONTEND_PORT=8088`. **Revisión visual APROBADA por el usuario
        (2026-08-19)**: módulo Gastos cerrado — backend + frontend +
        pruebas (Jest 546/546) + regresión real (verificar-mysql.js
        305/305) + revisión visual en navegador real.

111. **Corrección de `verificar-mysql.js` — 305/305 pruebas (2026-08-19)**:
    las 6 fallas "preexistentes ajenas" del script de regresión eran
    **bugs del propio script**, no del producto, y quedaron corregidas
    contra MySQL real (Docker/MySQL, backend reconstruido con `--no-cache`
    + `--force-recreate`, gotcha del punto 110).
    - **5 fallas `numero_compra` (ER_DATA_TOO_LONG)**: `ordenes_compra.
      numero_compra` es `VARCHAR(20)` pero los valores de prueba usaban el
      prefijo largo `__prueba_regresion__` (19 chars) → los INSERTs
      fallaban por longitud. Fix: prefijo propio corto `NUM_COMPRA_PRUEBA
      = 'PRGR'` (valores de 12–19 chars) + limpieza nueva en
      `limpiarDatosDePrueba()` (`DELETE ... WHERE numero_compra LIKE
      'PRGR-%'`, idempotente entre corridas). Corregidos los 8 sitios
      (TICKET-VERIF, FACTURADO, REENVIO, RETEN-VIEJA/RECIENTE, REPORTE,
      OC-invalida-1/2, el SELECT `-NO-EXISTE` y el check del Markdown de
      reportes).
    - **1 falla `tipo_persona` (ER_DATA_TOO_LONG)**: el test insertaba
      `'no_es_un_tipo_valido'` (19 chars) que moría por longitud del
      `VARCHAR(10)` ANTES de que el CHECK `chk_tipo_persona` evaluara.
      Fix: valor `'invalido'` (8 chars) — ahora el CHECK dispara
      `ER_CHECK_CONSTRAINT_VIOLATED` como esperaba la prueba.
    - **2 fallas ocultas destapadas al arreglar las anteriores** (todo el
      bloque de "Verificación de compra" abortaba antes y nunca se
      ejercitaba): (a) el **desfase de 1 segundo** documentado en el
      punto 102 se reproducía aquí — el script insertaba `new Date()` con
      ms y MySQL redondea el DATETIME, haciendo intermitente la
      comparación de los 4 datos; fix igual que el endpoint:
      `ahoraOrdenTicket.setMilliseconds(0)` (también en FACTURADO y
      REENVIO); (b) el test "BUG CONFIRMADO con sanitizeText()" quedó
      **obsoleto**: el escape de "/" que corrompía la fecha se quitó de
      `sanitizeText()` (fix de doble escape, ver comentario en
      `backend/utils/validate.js`), así que la corrupción ya no existe —
      se actualizó la aserción a "histórico, ya no aplica".
    - **Resultado**: `verificar-mysql.js` **305/305** (2 corridas
      consecutivas contra MySQL real, idempotente) + Jest **546/546** sin
      regresiones. Los números de compra de prueba ahora caben en la
      columna real, que ya es coherente con el `sanitizeText(…, 20)` del
      endpoint.

112. **Renombrado de la etiqueta "Orden de compra" a "Ventas" en toda la UI**
    (2026-08-19): pedido del usuario ("cambiar el nombre de Orden de compra a
    Ventas en el menú"). Alcance aprobado por el usuario: **Opción B** — todo
    el texto visible, incluyendo correos y el portal del cliente, con **"todo
    a 'venta'"** (No. Compra → No. Venta; asunto del correo `VENTA —
    OC-000001`, conservando el prefijo `OC-`).
    - **SÍ se renombró** (solo texto visible al usuario): menú y vista del
      panel (`admin.html`/`admin.js`: "Ventas", "Ventas registradas",
      "Registrar venta", toasts "Venta registrada correctamente."/"Venta no
      encontrada.", "Venta facturada", "Venta eliminada.", switch "Habilitar
      Ventas", "Borrado automático de tickets y ventas", modal "Información de
      la venta", "No. Venta", "Fecha de venta"); portal del cliente
      (`tickets.html`/`tickets.js`: "Sube tu ticket de venta", "Verifica tu
      venta", "No. Venta", "El número de venta es obligatorio.", "Esa venta ya
      fue facturada.", "No se encuentra registrada la venta para facturar.");
      tile del tablero ("Subir tickets de venta"); correos (`server.js`:
      cabecera "Venta", asunto `VENTA — OC-000001` y `Confirmación de venta —
      OC-000001`, "registramos tu venta", "ticket de venta"); labels de
      reportes (`reportes.js`: "## Ventas", "No. Venta", "Fecha de venta",
      asunto "Reporte de tickets y ventas", tipo 'Ventas' en CSV/Excel);
      mensajes de error API ("La fecha/hora de venta debe tener el formato…").
    - **NO se renombró** (identificadores, a propósito): tabla
      `ordenes_compra`, columnas `numero_compra`/`fecha_compra`/etc., config
      `ordenes_compra_habilitado`, endpoints `/api/admin/ordenes-compra`, IDs
      y clases (`btn-vista-ordenes`, `.orden-*`, `ticket-numero-compra`), y el
      prefijo `OC-000001` (lo aserta `verificar-mysql.js`; la E2E interactúa
      solo por IDs). Los comentarios internos y logs del backend se dejaron
      como estaban (no son texto visible).
    - **Tests actualizados al nuevo texto**: `/número de venta es
      obligatorio/` en `test/integration/tickets.test.js` (el mensaje del
      endpoint cambió), y `**Ventas:** 1` / `_Sin ventas en este reporte._` en
      `test/unit/reportes.test.js` (los labels del Markdown cambiaron).
    - **Validación**: `node --check` en los `.js` tocados + Jest completo sin
      regresiones (ver el commit). No afecta esquema ni queries; una corrida
      de `verificar-mysql.js` es opcional (no aserta labels, solo prefijos e
      identificadores). **Rebuild del stack (2026-08-19)**: `docker compose
      build --no-cache backend frontend` + `up -d --force-recreate backend
      frontend` (mismo gotcha del punto 110: `up -d` solo NO recrea el
      contenedor) — verificado por HTTP: `/api/health` OK, `/admin` sirve
      "Ventas"/"Ventas registradas" sin restos de "Orden de compra"/"No.
      Compra", `/tickets` sirve "Verifica tu venta"/"No. Venta".
      `FRONTEND_PORT=8088` en `.env` conservado. Pendiente: revisión visual
      del usuario.

113. **Diagnóstico post-opencode y corrección de la única regresión real
    encontrada (2026-08-19)**: el usuario reportó que otra herramienta de
    IA (opencode) trabajó en este mismo repo y se quedó sin créditos a
    mitad de tarea; pidió una auditoría y diagnóstico honesto antes de
    tocar documentación. Auditoría hecha sobre los 6 commits de opencode
    (`7113deb`..`81ad13c`, ya en `fact/master`: módulo "Gastos" —punto
    109/110—, fix de `verificar-mysql.js` —punto 111—, renombrado "Orden
    de compra"→"Ventas" —punto 112—):
    - `git diff --stat f0ca81c..81ad13c` (2654 líneas, 17 archivos) +
      `node --check` en cada `.js` tocado: limpio, sin errores de sintaxis.
    - Backend Jest: **546/546** (32 suites) — sin regresiones.
    - **`control/` Jest: 3 fallas reales** en
      `control/test/unit/ensureSchema.test.js`
      (`asegurarColumnasCicloVidaTenant`), las tres por
      `toHaveBeenCalledTimes` desfasado en +1. **No es bug de opencode** —
      opencode nunca tocó `control/` (fuera del diff --stat). Causa real:
      el test quedó desactualizado desde el segmento "Look & Feel" (punto
      105), que agregó la columna `tema_json` a
      `control/scripts/ensureSchema.js` sin actualizar este test — el
      propio punto 105 ya lo advertía ("faltan pruebas en `control/`").
      Fix: agregada `tema_json` a la lista de columnas esperadas y
      ajustados los conteos/índices en las 3 pruebas. `control/` Jest
      vuelve a **88/88** (7 suites).
    - Contenedores Docker corriendo (`pfacturacion-backend`/`-frontend`,
      creados 2026-08-19 15:01, después del código de `a34c877`)
      confirmados al día con `HEAD` (`81ad13c` es un commit solo de
      documentación) — `curl /api/health` OK, `/admin` 200.
    - **Diagnóstico final entregado al usuario**: el trabajo de opencode
      está íntegro y verificado (Gastos, rename Ventas, fix de
      `verificar-mysql.js`) salvo por este único test desactualizado en
      `control/`, ya corregido en esta sesión. No se encontraron bugs de
      producto nuevos. Pendiente de aprobación del usuario: commitear y
      pushear el fix del test.

114. **Vista "Resumen financiero" (2026-08-19)**: a partir del mockup
    `stitch/stitch_portal_financiero` (sidebar "CLARVO" con KPIs
    financieros + gráfica "Ventas vs Facturación vs Gastos"), agregada
    como vista nueva y propia — no dentro de "Inicio" — tras detectar que
    "Inicio" es del dominio del perfil `fiscal` (`RESTRICCIONES_PERFIL.
    fiscal.vistasPermitidas` no incluye `ordenes` ni `gastos`) mientras
    que el resumen financiero (Ventas+Gastos) es el dominio del perfil
    `administrador` (bloqueado de "Inicio" hasta ahora). Mezclarlo en
    "Inicio" habría expuesto datos de Gastos al perfil `fiscal`, que no
    tiene permiso de verlos.
    - **Alcance recortado del mockup tras análisis + confirmación del
      usuario**: se omitió "Estado SAT" (dependía de una "meta mensual"
      que no existe en la app) y se renombraron dos tarjetas para no
      afirmar cifras fiscales que el esquema actual no respalda —
      "IVA Neto (A Favor)" → **"Balance ventas vs gastos"** (Facturado −
      Gastos; `gastos` no guarda desglose de IVA, solo el booleano
      `iva_incluido`) y "Tickets Pendientes" → **"Ventas sin facturar"**
      (Ventas totales − Facturado).
    - **4 KPIs del mes en curso** (con tendencia % vs mes anterior en
      Total facturado y Total gastos, sin inventar tendencia si el mes
      anterior fue $0): Total facturado, Total gastos, Balance ventas vs
      gastos, Ventas sin facturar.
    - **Gráfica "Ventas vs Facturado vs Gastos"** en barras CSS puras
      (sin librería, mismo criterio que el resto del frontend sin build
      step), agrupada en SQL con `DATE_FORMAT(…, '%Y-%m')`. **Ajustada a
      pedido del usuario tras la primera revisión visual**: en vez de una
      ventana fija de 6 meses hacia atrás con meses en $0 rellenados, la
      ventana arranca en el mes en curso hacia adelante y **omite
      cualquier mes sin ventas ni gastos** (un mes solo aparece si
      `GROUP BY` le devuelve al menos una fila en alguna de las dos
      tablas) — evita ensuciar la gráfica con meses en cero de antes de
      que el negocio empezara a usar el sistema.
    - **Backend**: `GET /api/admin/resumen-financiero` en `server.js`,
      mismo gate `requireAdminArea('administrador')` que Gastos/Ventas
      (administrador + super implícito). Reutiliza el criterio de
      "facturado" ya existente (`EXISTS` de un ticket vinculado en
      estatus `'listo'`, mismo que el ícono de la tabla de Ventas).
      Helper nuevo `ultimosMeses(zonaHoraria, cantidadMeses)` junto a
      `limitesMes()`. Nunca manda filas sueltas de `ordenes_compra` ni de
      `gastos` al frontend, solo agregados.
    - **Frontend**: botón nuevo `btn-vista-resumen-financiero` en el
      sidebar (justo antes de "Ventas"), vista `vista-resumen-financiero`
      reutilizando las clases `.inicio-stats-grid`/`.inicio-stat-card` ya
      existentes para las 4 tarjetas + sección nueva `.resumen-fin-chart-*`
      para la gráfica. Agregado a `RESTRICCIONES_PERFIL.administrador.
      vistasPermitidas` (primera entrada — administrador ahora aterriza
      aquí en vez de en "Ventas") e insertado antes de `ordenes` en
      `navPorVista` para que el redirect automático de perfil restringido
      lo elija primero.
    - **Pruebas**: `backend/test/integration/resumenFinanciero.test.js`
      nuevo (401 sin credenciales, 403 perfil `fiscal`, KPIs + serie de 6
      meses con datos, serie en 0 sin omitir meses). Jest backend
      **550/550** (33 suites) sin regresiones.
    - **Validado contra Docker/MySQL reales (2026-08-19)**: rebuild
      `--no-cache` + `--force-recreate` de backend y frontend,
      `FRONTEND_PORT=8088` conservado; `curl` al endpoint con
      `admin:admin` devolvió agregados reales coherentes con los datos de
      prueba ya sembrados en el volumen (gastos $2,300, ventas $1,102 sin
      facturar). Verificado también con la extensión Claude in Chrome
      (navegador real): las 4 tarjetas y las 6 barras de la gráfica se
      renderizan con esos mismos valores. El gating por perfil
      (`administrador` ve la vista, `fiscal` no) se verificó por revisión
      de código contra el mismo patrón ya probado en vivo para Ventas/
      Gastos (punto 108) — no se creó un usuario `fiscal` de prueba en
      esta sesión para una verificación en vivo adicional.
    - **Ajuste post-revisión visual (mismo día)**: usuario pidió no
      mostrar meses vacíos y arrancar la ventana en el mes actual hacia
      adelante (no hacia atrás). Se quitó el helper `ultimosMeses()`
      (zero-fill de 6 meses) por `etiquetaMes(llave)` + dos consultas
      `GROUP BY DATE_FORMAT(…, '%Y-%m')` con `WHERE fecha >= inicio del
      mes actual`, uniendo las llaves de mes presentes en ventas o gastos
      (un mes con actividad en solo una de las dos tablas sí aparece; un
      mes sin ninguna fila en ninguna, no). Los KPIs del mes actual/
      tendencia se separaron a su propia consulta agregada (ya no dependen
      de la serie de la gráfica). Jest backend **551/551** (34 suites,
      `resumenFinanciero.test.js` con 5 pruebas). Validado de nuevo
      contra Docker/MySQL reales y en navegador real: con los mismos
      datos de prueba (ventas $1,102 en agosto, gastos $2,300 en agosto,
      nada en meses anteriores), la gráfica ahora solo muestra la barra
      de "Ago".
    - **Bug real encontrado por el usuario tras la revisión visual (mismo
      día): perfil `fiscal` veía el botón "Ventas" en el menú**, aunque
      `RESTRICCIONES_PERFIL.fiscal.vistasPermitidas` nunca incluyó
      `ordenes`. Causa raíz: **preexistente, no introducida por el
      segmento "Resumen financiero"** — `aplicarVisibilidadOrdenesCompra()`
      (el interruptor "Habilitar Ventas" de Configuraciones globales)
      pisaba `els.btnVistaOrdenes.hidden` de forma incondicional según
      solo el toggle global, sin considerar el perfil; como
      `cargarConfigGlobal()` se precarga siempre después de
      `aplicarRestriccionesPerfil()` (ver `showDashboard()`), el toggle
      (habilitado por defecto) siempre ganaba la carrera y reaparecía el
      botón para cualquier perfil, incluido `fiscal`. Fix: variable de
      módulo `ventasHabilitadaGlobalmente`, combinada dentro de
      `aplicarRestriccionesPerfil()` (única fuente de verdad para
      `btn-vista-ordenes`); `aplicarVisibilidadOrdenesCompra()` ahora solo
      actualiza esa variable y reinvoca `aplicarRestriccionesPerfil()` en
      vez de tocar `hidden` directamente. **Validado en navegador real**
      con 3 cuentas de prueba creadas y borradas en la misma sesión
      (`fiscaltest1`/perfil fiscal, `admintest1`/perfil administrador,
      y `admin`/super): fiscal ya no ve Ventas/Gastos/Resumen financiero/
      Usuarios/Reportes; administrador aterriza en "Resumen financiero" y
      ve Resumen financiero/Ventas/Gastos/Usuarios/Configuraciones/
      Reportes sin Inicio/Tickets/Constancias; super ve todo. `node
      --check` limpio, Jest backend 551/551 sin regresiones (este bug es
      puramente de frontend, sin pruebas Jest que lo cubran — la
      verificación fue en navegador real).

115. **Siembra de datos de demostración / pruebas de humo funcionales
    (2026-08-19, COMPLETA 2026-08-20)**: el usuario
    pidió datos de muestra reales (30 ventas, gastos, solicitudes de
    factura de clientes distintos) repartidos entre multi-tenant y el
    contexto sin slug (`portal_facturacion`, el que usa localmente), para
    poder hacer una demo del producto. En vez de insertar filas
    directamente en MySQL, se ejercitó el flujo real end-to-end por HTTP
    contra el stack Docker vivo (`http://localhost:8088`): registro de
    cliente (`POST /api/auth/registro`) → subida de CSF real con PDF
    generado con `pdfkit` que sí pasa `pareceConstanciaFiscal()` (mismo
    generador que ya usan las fixtures de `e2e/fixtures/generar-csf.js`,
    parametrizado por RFC) → alta de venta como admin
    (`POST /api/admin/ordenes-compra`) → subida de ticket como el cliente
    con los 4 campos de verificación (No. Venta/fecha/hora/total) → avance
    a `listo` (factura ZIP real con PDF+XML, reutilizando
    `e2e/fixtures/factura.zip`), `en_curso` o `cancelado` según una
    distribución ~60/25/10/5. Gastos con fecha real (algunos en el mes
    anterior a propósito, para que la tendencia % de "Resumen financiero"
    tenga un punto de comparación). Script:
    `seed-demo.js` en el scratchpad de la sesión (no se commiteó al
    repo — es una herramienta de una sola vez, no un artefacto del
    producto; si se necesita repetir la siembra, hay que regenerarlo con
    la misma lógica descrita aquí).
    - **Progreso real al momento de la pausa**:
      - **"Sin contexto" (`portal_facturacion`)**: completo — 7 clientes,
        14 ventas (OC-000061 a OC-000074), 14 tickets (8 `listo`, 4
        `pendiente`, 1 `en_curso`, 1 `cancelado`), 10 gastos.
      - **Tenant `pruebaadmin`**: parcial — 4 clientes, 8 ventas
        (OC-000001 a OC-000008), 8 tickets (5 `listo`, 2 `pendiente`, 1
        `en_curso`). **Gastos falló a la mitad** (ver hallazgo abajo) —
        0 de 7 gastos planeados se crearon.
      - **Tenant `piloto9c`**: sin empezar.
    - **Hallazgo real (bloqueador, sin resolver todavía)**: crear un gasto
      en el tenant `pruebaadmin` responde `500` —
      `Table 'tenant_pruebaadmin.gastos' doesn't exist` (confirmado en
      logs del contenedor backend). Causa raíz: **exactamente la
      limitación ya documentada en CLAUDE.md** — `ensureSchema()` solo
      corre automáticamente contra el pool POR DEFECTO al arrancar el
      backend, nunca contra tenants ya aprovisionados; el módulo "Gastos"
      (con su tabla nueva) se agregó en una sesión posterior a cuando
      `pruebaadmin`/`piloto9c` se aprovisionaron por primera vez, así que
      ninguno de los dos tiene la tabla `gastos` (ni probablemente
      `tema_json` en `tenants` si aplicara ahí, aunque esa sí es de
      `control_tenants`, no de cada tenant). **Nunca se había topado en
      la práctica hasta ahora** porque nadie había intentado usar Gastos
      contra un tenant real todavía. Fix pendiente (no aplicado, sesión
      pausada antes de ejecutarlo): re-correr
      `backend/scripts/provisionar-tenant.js pruebaadmin` y
      `... piloto9c` (idempotente, ya documentado como seguro de
      re-correr) para que `ensureSchema()` se aplique también ahí.
    - **Otros ajustes hechos sobre la marcha al script de siembra** (para
      referencia si se regenera): `POST /api/tickets` solo devuelve
      `{ok, folio, mensaje}` (sin `id`) — el `id` numérico que piden
      `/estatus` y `/factura` se busca después en `GET /api/admin/tickets`
      por folio; `POST /api/admin/gastos` tampoco repite los campos
      enviados en la respuesta; el limitador `submitLimiter` (30
      peticiones/15 min, `POST /api/registro` + `POST /api/tickets`
      combinados, por `tenant+IP`) se agotó durante las corridas de
      prueba del script y hubo que reiniciar el contenedor backend para
      vaciar el estado en memoria del limitador antes de la corrida real
      — confirma que el limitador funciona correctamente bajo uso
      intensivo real, no es un bug.
    - **Fix de esquema aplicado (2026-08-20)**: `provisionar-tenant.js`
      rechaza re-correr contra un tenant `activo` (por diseño — solo
      completa filas en `provisioning`), así que el fix real fue invocar
      `ensureSchema()` directo dentro del contenedor `backend`, pisando
      solo `DB_NAME` (que ya trae `DB_HOST`/`DB_USER`/`DB_PASSWORD`
      correctos del entorno del contenedor):
      `docker compose exec -e DB_NAME=tenant_<slug> backend node -e
      "require('./db').ensureSchema()..."`. Confirmado con
      `SHOW TABLES LIKE 'gastos'` contra MySQL real: tabla `gastos`
      presente en `tenant_pruebaadmin` y `tenant_piloto9c`.
    - **Siembra terminada (2026-08-20)**: `pruebaadmin` recibió sus 7
      gastos pendientes (`POST /pruebaadmin/api/admin/gastos`, Basic
      `admin:admin`) — categorías nómina/software/hosting/papelería/
      combustible/publicidad/servicios, 2 en julio y 5 en agosto (mismo
      criterio de "punto de comparación" que el resto de la siembra).
      `piloto9c` se sembró desde cero, mismo patrón que `pruebaadmin`: 4
      clientes (`GARC800101AB1`/`LOMH850315XY2`/`PEMJ900722QW3`/
      `RODA750210ZZ4`, RFCs sintéticos pero con formato válido) → CSF con
      PDF `pdfkit` parametrizado por RFC (misma lógica de
      `e2e/fixtures/generar-csf.js`, copiada al script de siembra sin
      tocar el fixture del repo) → 8 ventas (`OC-000007` a `OC-000014` —
      arrancan en 7 porque el tenant ya tenía 6 filas de pruebas E2E
      previas, soft-eliminadas por la suite `e2e/tests/
      flujo-facturacion-piloto9c.spec.ts` del punto 102 — no son de esta
      siembra) repartidas 2 por cliente → 8 tickets (`TK-000007` a
      `TK-000014`) con los 4 campos de verificación exactos tomados de la
      respuesta de cada venta → distribución final 5 `listo` (factura ZIP
      real subida)/2 `pendiente` (sin tocar)/1 `en_curso`, igual que
      `pruebaadmin` → 7 gastos (renta/nómina/hosting/viáticos/papelería/
      otro, 2 en julio y 5 en agosto). Script final:
      `seed-demo-2.js` en el scratchpad de la sesión (no se commiteó,
      mismo criterio que `seed-demo.js` de la sesión anterior).
    - **Bug real encontrado y corregido durante la siembra (no del script,
      del producto/documentación del propio flujo)**: la primera pasada
      de subida de CSF para los 4 clientes de `piloto9c` NO mandó el
      campo `rfc` del formulario (solo `tipo_persona`/`email`/`archivo`,
      como sugería la descripción original de la tarea) — `POST
      /api/registro` en `backend/server.js` (~línea 1724 y el INSERT en
      ~línea 1946) guarda en `registros.rfc` el valor de `body.rfc`
      (`rfcRaw`) tal cual lo mandó el formulario, **no** el RFC extraído
      del PDF (`extraerRFC(textoPdf)`, que solo se usa para VALIDAR que
      coincida con la referencia, nunca para guardarse) ni el RFC de la
      sesión. Con el campo `rfc` ausente, los 4 registros quedaron con
      `registros.rfc = NULL` — silencioso (`POST /api/registro` respondió
      200 igual, porque el campo es opcional a propósito para constancias
      sin RFC capturado) hasta que `POST /api/tickets` intentó el primer
      ticket, que revisa `SELECT id FROM registros WHERE rfc = ?
      [req.userRfc]` (server.js ~línea 1049) para confirmar que existe
      constancia activa antes de aceptar un ticket — con `rfc` NULL en la
      fila, ese `SELECT` nunca encuentra nada y el ticket se habría
      rechazado con `SIN_CONSTANCIA` aunque el cliente sí hubiera subido
      su CSF. Se detectó ANTES de llegar a esa etapa (revisando
      `registros.rfc` por SQL directo como parte de la verificación
      intermedia) y se corrigió re-subiendo la CSF de los 4 con
      `rfc=<RFC del cliente>` + `confirmar_reemplazo=true` antes de
      continuar con las ventas/tickets. No es un bug nuevo de esta
      sesión — es una característica existente del endpoint (RFC de
      constancia opcional, ver comentario "el nombre/razón social ya no
      se captura..." en el mismo bloque) mal aprovechada por la
      instrucción original de la tarea de siembra, que omitía ese campo;
      queda documentado aquí para que una futura siembra/integración que
      use `POST /api/registro` programáticamente no repita el mismo
      error silencioso.
    - **Conteos finales verificados por SQL directo (2026-08-20)**:
      `tenant_pruebaadmin.gastos` = 7;
      `tenant_piloto9c.gastos` = 7,
      `tenant_piloto9c.registros` (activos) = 5 (4 nuevos + 1 preexistente
      de la suite E2E del punto 102, RFC `AAMA850101HDF`),
      `tenant_piloto9c.ordenes_compra` (activas) = 8,
      `tenant_piloto9c.tickets` (activos) = 8 con `estatus`: 5 `listo` /
      2 `pendiente` / 1 `en_curso`. `docker compose logs backend
      --since 20m` sin errores nuevos (el único `500` de
      `tenant_pruebaadmin.gastos doesn't exist` en el log pertenece a la
      corrida fallida de la sesión anterior, antes del fix de esquema).
      Con esto, la siembra de datos de demostración del punto 115 queda
      completa: "sin contexto" (14/14/10), `pruebaadmin` (8/8/7),
      `piloto9c` (8/8/7 sobre su propia numeración de folios).

116. **Auditoría de seguridad OWASP Top 10 2021, sitio completo
    (2026-08-20)**: a pedido explícito del usuario, con autorización
    previa para corregir vulnerabilidades reales sin esperar confirmación
    (no así para commitear/pushear — eso queda para revisión del
    usuario). Tres auditorías en paralelo, un dominio cada una:
    `backend/`+`control/`, `frontend/`, y Docker/infraestructura. Todas
    verificadas contra Docker/MySQL/MinIO reales (stack ya levantado por
    la siembra del punto 115); ningún commit/push hecho por ninguna de
    las tres. Jest backend **551/551** (33 suites) y control **88/88**
    después de todas las correcciones.

    - **[MEDIO] Timing attack en `X-Internal-Secret`** (`backend/server.js`,
      6 endpoints `/internal/*`: cache-tenant/invalidar, marca-logo
      POST/DELETE, favicon POST/DELETE, renombrar-slug): comparaban el
      secreto compartido con `!==` directo — medible por temporización
      desde la red interna de Docker. Corregido: nueva función
      `secretoInternoValido(req)` con `crypto.timingSafeEqual`, mismo
      patrón que `timingSafeEqualStrings` ya usado en `requireAdminAuth`.
    - **[MEDIO] Enumeración de cuentas por temporización en login**
      (`POST /api/auth/login` en `backend/server.js` y
      `verificarUsuarioAdministrativo` en `backend/utils/auth.js`):
      corto-circuitaban con `if (!usuario) return ...` ANTES de llamar
      `verifyPassword` (scrypt, el paso costoso) cuando el RFC/usuario no
      existía — diferencia de tiempo medible entre "no existe" y "existe,
      password incorrecta", pese al mensaje de error ya genérico.
      Corregido: `verifyPassword` se llama SIEMPRE, contra el hash real o
      un hash de relleno (`HASH_RELLENO_LOGIN`/`HASH_RELLENO_ADMIN`,
      generado una vez al arrancar) — mismo principio que
      `costoArtificialComparable()` ya aplica a slugs de tenant
      inexistentes en `tenantContext.js`.
    - **[MEDIO] Enumeración masiva de RFC/nombre sin límite de tasa**
      (`GET /api/registro/buscar` y `GET /api/registro/:email`, públicas
      por diseño — el formulario necesita avisar "ya existe una
      constancia" antes de reemplazar — pero sin `submitLimiter` a
      diferencia de `POST /api/registro`): permitían raspar en masa qué
      RFC/nombre corresponde a qué correo. Corregido: agregado
      `submitLimiter` (30/15min por tenant+IP, ya existente) a ambas.
    - **[ALTO, PENDIENTE] `nodemailer@6.10.1` vulnerable** (`backend/`):
      `npm audit` reporta 8 avisos en versiones `<=9.0.0`, incluida
      inyección de comandos SMTP, inyección CRLF en cabeceras, y
      SSRF/lectura arbitraria de archivos vía la opción `raw` a nivel de
      mensaje (bypass de `disableFileAccess`/`disableUrlAccess`). NO
      corregido — el fix real es un salto de major (v6→v9, cambios de
      API) que `npm audit fix --force` confirma como *breaking change*, y
      esta sesión nunca ha enviado un correo real contra SMTP verdadero
      (ver "Limitaciones de ESTE entorno" más abajo) para poder validar la
      migración con confianza. **Pendiente**: rama aparte, actualizar a
      `nodemailer@9.x`, correr `email.test.js` + una prueba real de envío
      (botón "Enviar prueba" del panel admin) antes de mergear.
      Informativo de paso: `uuid <11.1.1` transitivo vía `exceljs`
      (moderado, pero el proyecto no usa la API afectada — bajo impacto
      real). `control/`: `npm audit` → 0 vulnerabilidades.
    - **[MEDIO] Password root de MySQL expuesto en texto plano vía
      `docker inspect`/`docker top`** (`docker-compose.yml`,
      `docker-stack.yml`): el healthcheck usaba `-p${MYSQL_ROOT_PASSWORD}`
      como argumento de línea de comandos — visible en el array
      `Healthcheck.Test` y en el argv del proceso para cualquiera con
      acceso al host Docker. Corregido: `MYSQL_PWD="$$MYSQL_ROOT_PASSWORD"
      mysqladmin ping ...` (variable de entorno, no argumento CLI).
      Verificado: `docker compose config` ya no muestra la contraseña
      literal; `pfacturacion-mysql` healthy tras recrear.
    - **[MEDIO] Puertos de MySQL/MinIO console publicados a
      `0.0.0.0`** (`docker-compose.yml`): `MYSQL_PORT` (3306) y
      `MINIO_CONSOLE_PORT` (9001) eran alcanzables desde la LAN/Internet,
      no solo desde el host. Corregido a `127.0.0.1:${VAR}:PUERTO` —
      siguen accesibles desde la misma máquina, ya no desde afuera.
    - **[MEDIO] Falta `.dockerignore` en `control/`**: a diferencia de
      `backend/`. El Dockerfile hace `COPY --from=deps .../node_modules`
      y LUEGO `COPY . .` — sin `.dockerignore`, el `node_modules` local
      del host (Windows, con `devDependencies`/binarios no-Linux) podía
      sobrescribir silenciosamente el `node_modules` limpio de la etapa
      `deps`, y un `.env` local se habría copiado a la imagen. Creado
      `control/.dockerignore` (mismo patrón que `backend/`) y
      `frontend/.dockerignore` (menor riesgo, reduce contexto de build).
      Verificado: contexto de build de `control` bajó a 5.29kB.
    - **[BAJO] `no-new-privileges` ausente** (CIS Docker Benchmark 5.25):
      agregado `security_opt: [no-new-privileges:true]` a los 5 servicios
      de `docker-compose.yml` y los 6 de `docker-stack.yml`. Verificado
      en `backend` (el más sensible por el patrón
      root→`chown`→`su-exec`→`appuser` del entrypoint): `docker exec
      pfacturacion-backend ps aux` confirma PID 1 (`node server.js`)
      corriendo como `appuser`, no root — el flag no rompe el drop de
      privilegios.
    - **[BAJO] Defaults inseguros sin advertencia suficiente**:
      `ADMIN_USERS=admin:admin` en `.env.example`/`README.md` no tenía la
      marca "IMPORTANTE"/"cámbialo en producción" que sí tienen
      `MYSQL_ROOT_PASSWORD`/`MYSQL_PASSWORD`/`MINIO_ROOT_PASSWORD`, pese a
      controlar acceso a `/admin` y `/control` (perfil `super`).
      Corregido en ambos archivos, más un banner de advertencia agregado
      al inicio de `docker-compose.yml`.
    - **[BAJO] `.gitignore` incompleto**: no cubría variantes de `.env`
      (`.env.local`, `.env.production`, etc.) ni certificados/llaves
      (`*.pem`, `*.key`, `*.crt`, `*.p12`, `*.pfx`). Agregado `.env.*` con
      excepción explícita `!.env.example`, más los patrones de
      certificados. Confirmado: ningún archivo de esos patrones estuvo
      trackeado nunca en el historial de git.
    - **[MEDIO] Mockup con CDN externo expuesto en build público del
      frontend**: `frontend/assets/stitch_portal_de_facturaci_n/code.html`
      (carpeta sin trackear, agregada en una sesión de diseño reciente)
      quedaba dentro de `frontend/assets/`, que `frontend/Dockerfile`
      copia entera al root público de nginx — el mockup carga
      `https://cdn.tailwindcss.com` sin Subresource Integrity y habría
      quedado accesible en `/assets/stitch_portal_de_facturaci_n/code.html`
      en cualquier despliegue real. Corregido: reubicado a
      `stitch/stitch_portal_de_facturaci_n/`, junto a sus hermanas (mismo
      patrón que `dashboard_portal_addv_fiel_al_mockup/` etc.) — carpeta
      que NO se copia al contenedor.
    - **[BAJO] Cabeceras de seguridad faltantes en nginx**
      (`frontend/nginx.conf.template`): agregado `server_tokens off;`
      (oculta versión de nginx) y `Strict-Transport-Security` condicional
      (vía `map` sobre `$proxy_x_forwarded_proto`, mismo criterio que ya
      usa el archivo para otros headers dependientes de HTTPS real — sin
      efecto hoy en `http://localhost`, listo para cuando haya HTTPS real
      en el nginx del host). CSP sigue sin agregarse a propósito — el
      propio archivo ya documenta esa ausencia como decisión deliberada
      (requeriría inventariar cada script/estilo inline sin poder
      probarlo en navegador real desde este entorno).
    - **[BAJO] XSS defensivo, no explotable**: `frontend/admin.js`
      (vista "Resumen financiero", etiqueta de mes del gráfico) insertaba
      `m.mes` en `innerHTML` sin `escapeHtml()`, a diferencia de
      prácticamente todo el resto del archivo — el valor siempre viene de
      `etiquetaMes()` en el servidor (`Intl.DateTimeFormat`, sin ruta de
      entrada de usuario), así que no era explotable hoy. Corregido de
      todas formas por consistencia con el resto del código.
    - **Bug real de producto encontrado y corregido (no de seguridad)**:
      `backend/server.js` (~línea 3719, dentro de
      `POST /api/admin/ordenes-compra`) referenciaba la variable
      `marcaLoGoUrl` (capital G, nunca declarada en ese scope) dentro del
      template literal del logo del correo de confirmación, en vez de la
      constante local correcta `marcaLogoUrl` (minúscula, sí declarada
      línea arriba desde `req.tenant.marcaLogoUrl`). Para cualquier
      tenant con logo de marca configurado (ver segmento "Marca", punto
      103), esto lanzaba un `ReferenceError` síncrono al construir los
      argumentos de `enviarCorreoOrdenCompra(...)` — la venta ya había
      quedado insertada en la BD (el INSERT ocurre antes), pero la
      respuesta al admin era `500` en vez de `201`, y el correo de
      confirmación nunca se enviaba. Corregido con el fix de una sola
      palabra; verificado con `node --check` + Jest backend 551/551.
    - **Revisado sin hallazgos** (ver detalle completo en el historial de
      la sesión si hace falta): inyección SQL (placeholders `?` en todo
      `pool.query`/`db.query`, ningún template literal con datos de
      `req.*` interpolado directo en SQL), control de acceso en las ~57
      rutas `/api/admin/*` + 8 de `control/` (todas con
      `requireAdminAuth`+`requireAdminArea` consistente), aislamiento
      multi-tenant (proxy `AsyncLocalStorage` de `backend/db.js`), subida
      de archivos (firma binaria real verificada en PDF/imagen/ZIP/
      comprobante, sin path traversal posible en keys de MinIO —
      `crypto.randomUUID()`), SSRF (`USO_CFDI_SYNC_URL`/
      `BACKEND_INTERNAL_URL` solo de variables de entorno, nunca de
      `req.*`), `/internal/*` no alcanzable desde nginx público
      (confirmado: ningún `location` en `nginx.conf.template` matchea
      `/internal/`), cookies de sesión (httpOnly, ningún `.js` del
      frontend lee `document.cookie`), XSS (los ~40 usos de
      `innerHTML`/`insertAdjacentHTML` del frontend ya pasan por
      `escapeHtml()` salvo el caso defensivo de arriba), clickjacking
      (`X-Frame-Options: DENY` ya presente), credenciales admin nunca
      logueadas ni en URLs, `control/Dockerfile` ya no-root,
      `backend/Dockerfile` ya usa el patrón `su-exec` correcto,
      imágenes base con tag fijo (salvo `minio:latest`, ya conocido).
    - **Ya documentado, no reportado como hallazgo nuevo**: ausencia de
      CSP real, credencial MySQL de aplicación compartida entre tenants,
      `SESSION_SECRET` aleatorio si no se define, `CORS_ORIGIN=*` por
      defecto, `minio:latest` sin pin, MySQL HA/Swarm nunca probado en
      clúster real — todos ya señalados en "Pendiente antes de
      producción"/"Limitaciones de ESTE entorno" más abajo.
    - **Pendiente/recomendación no aplicada**: segmentar la red plana
      única (`fiscal-net` en compose, overlay única en
      `docker-stack.yml`) en una red "pública" (frontend↔backend/control)
      y una "de datos" (backend/control↔mysql/minio) — reduciría la
      superficie si un contenedor se compromete, pero es un cambio
      estructural con riesgo real de romper conectividad que no pudo
      validarse a fondo solo con `curl`/`docker compose ps` en el tiempo
      disponible.
    - **Archivos modificados**: `.env.example`, `.gitignore`, `README.md`,
      `backend/server.js`, `backend/utils/auth.js`, `docker-compose.yml`,
      `docker-stack.yml`, `frontend/admin.js`,
      `frontend/nginx.conf.template`; nuevos `control/.dockerignore`,
      `frontend/.dockerignore`; reubicado
      `frontend/assets/stitch_portal_de_facturaci_n/` →
      `stitch/stitch_portal_de_facturaci_n/`. Stack completo verificado
      `healthy` tras recrear `mysql`/`minio`/`backend`/`control`/
      `frontend` (headers de seguridad confirmados por `curl -I`, backend
      corriendo como `appuser` no-root, datos de la siembra del punto 115
      intactos). Nada commiteado — todo queda en el working tree para
      revisión del usuario antes de decidir qué mergear/pushear.

117. **Gráficas de Business Intelligence en "Resumen financiero"
    (2026-08-20)**: a partir de un análisis previo de qué datos reales
    respaldan cada gráfica (sin inventar métricas — mismo criterio que ya
    forzó el renombrado de "IVA Neto"/"Tickets Pendientes" en el punto
    114), propuesta en markdown presentada y aprobada explícitamente por
    el usuario ("sí, adelante con las 5, mes actual") antes de
    implementar, protocolo `addv-web-app`. 5 gráficas nuevas agregadas a
    la vista ya existente, todas en SVG/CSS puro sin librería externa
    (mismo criterio que el resto del frontend sin build step, y
    consistente con el fix de seguridad del punto 116 que quitó el único
    CDN externo del sitio):
    - **Distribución de gastos por categoría** (dona dinámica, mes
      actual): `GROUP BY categoria` sobre `gastos`, las 10 categorías de
      la lista cerrada (`backend/utils/gastos.js`) con color fijo por
      categoría (para que el mismo color siempre represente la misma
      categoría entre cargas).
    - **Ventas facturadas vs sin facturar** (dona, 2 segmentos): mismo
      dato que ya existía como KPI de texto ("Ventas sin facturar"),
      ahora también como proporción visual.
    - **Balance acumulado** (línea, Facturado − Gastos sumado mes a mes
      sobre `serie_mensual`): muestra tendencia en el tiempo, no solo el
      corte del mes — implementada como gráfica de línea propia (SVG
      `polyline` + puntos), NO superpuesta sobre la barra existente de
      Ventas/Facturado/Gastos como decía la propuesta original (ajuste
      de implementación: superponerla sobre barras CSS de altura
      variable habría requerido convertir esa gráfica entera a SVG,
      cambio innecesariamente grande para el mismo resultado visual).
    - **Proyección de ventas** (línea sólida + tramo punteado): estimación
      estadística simple (promedio del delta mes a mes de los últimos 3
      meses reales, extendido 2 meses hacia adelante, piso en 0) — NUNCA
      se muestra con menos de 3 meses reales de histórico (mismo
      principio que `calcularTendencia()`, no inventar con datos
      insuficientes). Etiquetada explícitamente en la UI como estimación,
      no pronóstico financiero.
    - **Top 5 proveedores de gasto** (barras horizontales, mes actual):
      `GROUP BY proveedor` sobre `gastos` (excluye proveedor vacío/nulo)
      — dato accionable real, columna que ya se capturaba desde el alta
      de gasto sin usarse en ningún reporte hasta ahora.
    - Backend: `GET /api/admin/resumen-financiero`
      (`backend/server.js`) extendido con 3 campos nuevos en la
      respuesta (`gastos_por_categoria`, `top_proveedores`,
      `proyeccion_ventas`), 2 queries SQL nuevas (agregadas, nunca se
      manda una fila suelta de `gastos` al frontend, mismo criterio que
      el resto del endpoint) + cálculo de la proyección en JS a partir de
      la serie ya construida. Frontend: 5 tarjetas nuevas en
      `frontend/admin.html` dentro de `#vista-resumen-financiero`, CSS en
      `frontend/admin.css` (`.resumen-fin-grid`, `.resumen-fin-line-*`,
      `.resumen-fin-donut-*` — dona generalizada a N segmentos dinámicos
      vía `renderDonutGenerico()`, a diferencia de la dona de 3 círculos
      fijos que ya existía en "Inicio"), lógica en `frontend/admin.js`.
    - Tests: `backend/test/integration/resumenFinanciero.test.js`
      extendido (mocks de las 2 queries nuevas en los tests existentes +
      2 tests nuevos: campos vacíos sin actividad, y proyección con 3+
      meses reales de crecimiento constante). Jest backend **552/552**
      (33 suites). `node --check` limpio en `server.js`/`admin.js`,
      balance de llaves verificado en `admin.css`, cruce
      `getElementById()`↔`id=` sin IDs nuevos huérfanos.
    - **Validado contra Docker/MySQL reales**: rebuild + redeploy de
      `backend` y `frontend` (el código no está montado por volumen,
      necesita rebuild de imagen); `GET /api/admin/resumen-financiero`
      contra los datos reales de la siembra del punto 115 devuelve las 7
      categorías de gasto de `pruebaadmin`/`portal_facturacion` y sus 5
      proveedores reales (AWS, Imprenta Rápida, Office Depot, Gasolinera
      Pemex, Telmex), y `proyeccion_ventas: null` correctamente (solo 1
      mes de datos reales, menos de los 3 que exige la proyección). HTML
      servido por el contenedor `frontend` confirmado con las 5 tarjetas
      nuevas (sin problema de caché de build).
    - **Validado en navegador real (Claude in Chrome, 2026-08-20, misma
      sesión — la extensión no conectaba al principio, el usuario la
      reconectó y reinició Chrome)**: login admin (`admin:admin`,
      Chrome traía autocompletado un correo distinto que dio 401 —no es
      bug, era la credencial equivocada) → vista "Resumen financiero" →
      las 5 tarjetas nuevas confirmadas visualmente contra los datos
      reales de la siembra: dona "Distribución de gastos por categoría"
      (7 categorías, porcentajes suman 100%: 19+19+18+17+12+11+4), dona
      "Ventas facturadas vs sin facturar" (69%+31%=100%), "Top
      proveedores de gasto" (5 barras proporcionales, AWS más larga,
      montos exactos), "Balance acumulado" y "Proyección de ventas"
      correctamente en su estado "insuficientes datos" (un solo punto,
      sin línea ni proyección — solo hay 1 mes de histórico real, se
      necesitan 3). Sin errores en consola del navegador. Con esto, el
      segmento de gráficas BI queda completamente cerrado. Commit
      `d0b0ada` (ya hecho antes de esta validación visual, a pedido
      explícito del usuario).
    - **Rediseño de paleta (2026-08-20, mismo día, a pedido del usuario
      tras ver la vista en producción)**: la paleta original de las 10
      categorías de gasto usaba 10 colores arcoíris sin relación con la
      identidad del panel (navy `#03285B` + verde `#1FAE6B` "facturado" +
      terracota `#B4530C` "warn") — rompía la coherencia visual. Se
      investigó primero si el "texto en negro" que reportó el usuario en
      su captura era un bug real: verificado en navegador limpio (Claude
      in Chrome) que el texto de la leyenda SIEMPRE fue gris/oscuro
      neutro uniforme, nunca coloreado por categoría — la captura del
      usuario reflejaba algo del lado de su navegador (extensión), no un
      bug de esta vista; documentado así para no perseguir un fantasma.
      El problema real (paleta arcoíris) sí se corrigió, en dos pasadas:
      1) Paleta reemplazada por una rampa derivada de la marca (azules
      navy + 1 verde + 1 terracota + 1 gris neutro, en vez de 10 matices
      sin relación). 2) A pedido explícito de seguimiento del usuario
      ("usa colores en tonos claros y pasteles" para las gráficas
      circulares), la rampa se suavizó a tonos pastel manteniendo la
      MISMA familia de matices (no una paleta pastel genérica) — ver
      `RESUMEN_FIN_COLORES_CATEGORIA`/`RESUMEN_FIN_COLOR_FACTURADO`/
      `RESUMEN_FIN_COLOR_SIN_FACTURAR` en `frontend/admin.js`. Se agregó
      un pequeño espacio + `stroke-linecap: round` entre segmentos de
      dona (`renderDonutGenerico`) porque tonos pastel contiguos se
      fusionan sin separación visual, y un borde sutil
      (`box-shadow: inset`) a los puntos de leyenda en `admin.css`
      porque un pastel muy claro pierde definición contra fondo blanco.
      Además, coherencia con el resto del dashboard: las 5 tarjetas
      ganaron un ícono de encabezado en un badge de color (mismo patrón
      ya usado en las tarjetas KPI — `inicio-stat-icono-*`), reutilizando
      exactamente los mismos tokens/semántica ya establecidos (verde
      "completadas" para tarjetas de ventas, rojo/rosa "rechazadas" para
      tarjetas de gastos, navy "total" para balance) — ningún color
      nuevo inventado fuera de lo ya existente en el sistema. También se
      agregó una nota honesta ("Necesitas al menos 2 meses con actividad
      para ver la tendencia") en "Balance acumulado" cuando hay menos de
      2 meses de histórico, en vez de dejar un punto flotando sin
      contexto (mismo criterio ya usado en "Proyección de ventas").
      **Validado en navegador real** (Claude in Chrome): las 5 tarjetas
      confirmadas visualmente con la paleta pastel + íconos, sin errores
      de consola, montos/porcentajes intactos. Commit `3289675`,
      pusheado a `fact` a pedido del usuario.
    - **Rediseño de layout + modal de detalle grande (2026-08-20, mismo
      día, a pedido del usuario: "se ve desperdiciado mucho espacio" +
      "agrega la funcionalidad que cuando dé click a una gráfica se abra
      en popup")**:
      - **Barra "Ventas vs Facturado vs Gastos"**: la causa raíz del
        espacio vacío era `.resumen-fin-chart-columna { flex: 1 }` —
        con 1-2 meses de historial, una sola columna flex creciendo para
        llenar los ~900px de la tarjeta dejaba las barras (delgadas)
        aisladas en medio de un vacío enorme. Corregido a
        `flex: 0 0 64px` (ancho fijo por mes) + contenedor con
        `justify-content: center` (antes `space-around`) — con pocos
        meses el grupo de barras se ve compacto y centrado en vez de
        esparcido; `overflow-x: auto` agregado por si acaso a futuro hay
        más meses que ancho disponible.
      - **Donas (categorías / facturadas vs sin facturar)**: rediseñadas
        de apiladas (dona arriba, leyenda abajo a todo el ancho de la
        tarjeta — dejaba un vacío enorme entre la etiqueta y el monto)
        a lado a lado (`.resumen-fin-donut-body`, flex row, dona
        izquierda + leyenda derecha, con breakpoint a apilado en
        pantallas angostas) — mismo patrón visual que un dashboard
        dona+leyenda convencional, mucho mejor uso del ancho.
      - **Reordenamiento**: las 2 donas (densas, con datos reales ricos)
        ahora van juntas en la primera fila secundaria; "Balance
        acumulado" y "Proyección de ventas" (ambas dispersas con solo
        1-2 meses de historial) se movieron a la segunda fila, juntas
        entre sí — antes cada gráfica dispersa estaba emparejada con una
        dona densa, generando un desbalance visual marcado (un lado
        lleno, el otro casi vacío) que agravaba la sensación de
        desperdicio.
      - **Gráficas de línea dispersas**: altura de `.resumen-fin-line-svg`
        reducida de 130px a 100px — con 1-2 puntos reales, menos alto
        vacío sin apretar la lectura si la serie crece más adelante.
      - **"Top proveedores de gasto"**: las barras se estiraban a todo
        el ancho de la tarjeta (que ocupa toda la pantalla) — con solo 5
        proveedores, una barra de +1500px de largo no aporta nada,
        solo se ve "muy largo" (reporte directo del usuario con
        captura). Corregido con `max-width: 640px` en la lista.
      - **Modal de detalle grande al hacer click** (nueva funcionalidad,
        mismo patrón visual que el modal "Gestionar" de tickets —
        `.modal-overlay` + `.modal`, cierre por botón/click fuera/
        Escape): cada una de las 6 tarjetas (barra, 2 donas, 2 líneas,
        proveedores) tiene un botón "expandir" (⤢) en su encabezado. En
        vez de duplicar la lógica de render para una "versión grande"
        (que arrastraría el riesgo de que ambas versiones se
        desincronicen), `abrirDetalleGrafica()` en `admin.js` REUBICA el
        mismo contenedor ya renderizado (con sus datos reales, mismo
        elemento del DOM) dentro del modal, agrega la clase
        `resumen-fin-detalle-contenido-grande` (agranda dona/línea/barra
        vía CSS) y lo regresa a su posición original al cerrar — cero
        duplicación de código, imposible que la versión grande muestre
        datos distintos a la chica. El ícono del encabezado del modal se
        clona del icono ya presente en el header de la tarjeta (una sola
        fuente de verdad, sin mapear colores/iconos por separado).
      - **Bug real encontrado y corregido durante la validación** (no
        de este segmento en sí, de un gotcha ya documentado): al probar
        en navegador, `els.btnResumenFinDetalleCerrar.addEventListener`
        tronaba con `TypeError: Cannot read properties of null` — la
        excepción rompía la carga completa de `admin.js` (nada de la
        vista funcionaba, ni siquiera cambiar de pestaña). Diagnóstico
        confirmado inspeccionando el DOM vivo del navegador
        (`document.getElementById(...)` real): el HTML sin recargar
        seguía siendo el de ANTES del rebuild (caché de disco del
        navegador), mientras el `admin.js` sí era el nuevo — el
        desfase entre un HTML viejo sin el modal nuevo y un JS nuevo que
        ya lo esperaba causaba el `null`. Mismo gotcha ya anotado en
        CLAUDE.md ("el navegador cachea HTML/CSS en disco tras el
        rebuild") pero esta vez con una manifestación distinta y más
        confusa (excepción de JS, no una vista vieja) — vale la pena
        que quede registrado así para reconocerlo más rápido la próxima
        vez. `Ctrl+Shift+R` lo resolvió; consola limpia después.
      - **Validado en navegador real** (Claude in Chrome): barra
        centrada, donas lado a lado, tarjetas dispersas agrupadas,
        proveedores con ancho topado, y el modal de detalle probado en
        2 tarjetas distintas (dona de categorías y barra) — abre con los
        datos reales agrandados, cierra y el contenido regresa
        exactamente a su tarjeta original, sin errores de consola.
        `node --check` limpio, sin IDs duplicados/huérfanos. Commit
        `1fd0dbd`, pusheado a `fact`.

118. **IMPLEMENTADO y validado con Jest (2026-08-20)**: tarjeta nueva con gráfico para
    "Resumen financiero", pedida así por el usuario: *"quiero una nueva
    tarjeta del balance de ventas vs gastos, pero con gráfico, donde
    ponga el total vendido sin importar si esta facturado o no y la
    cantidad que es de iva, para saber el total que se vendio y cuanto
    es lo que nos quedó de utilidad comparado con los gastos"* — con
    instrucción explícita de NO ejecutar todavía, solo analizar y
    documentar (protocolo `addv-web-app`: analizar → proponer →
    confirmar → implementar, aquí detenido después de "proponer" a
    propósito). El usuario pidió que esto quede registrado en Claude Mem
    ("cmem") además de `PROJECT_STATE.md` — **esta sesión solo tiene
    herramientas de LECTURA de Claude Mem disponibles**
    (`mcp__plugin_claude-mem_mcp-search__*`: `search`, `get_observations`,
    `timeline`, `list_corpora`, `build_corpus`, `prime_corpus`,
    `query_corpus`, etc. — ninguna de escritura/registro manual, mismo
    hallazgo ya dejado como constancia en CLAUDE.md el 2026-08-12), así
    que el análisis completo se deja aquí y en CLAUDE.md como la fuente
    de verdad — si una sesión futura sí tiene acceso de escritura a
    Claude Mem, debe registrar ahí también esta decisión antes de
    implementar.

    - **Por qué el usuario lo pide (contexto de negocio)**: el KPI
      "Balance ventas vs gastos" que ya existe (Facturado − Gastos, ver
      punto 114) tiene dos limitaciones que lo alejan de una "utilidad"
      real: (1) solo cuenta ventas que YA tienen un ticket en estatus
      `listo` (ver `ordenes_compra`/`tickets` join en el endpoint) — una
      venta real que todavía no se facturó no cuenta, aunque el dinero
      ya haya entrado; (2) `total` incluye el IVA cobrado al cliente, que
      no es ingreso de la empresa (se traslada al SAT), así que restarle
      gastos a una cifra que todavía trae IVA adentro sobreestima la
      utilidad real. La tarjeta nueva corrige ambos puntos: cuenta TODAS
      las ventas del mes (facturadas o no) y separa el IVA antes de
      comparar contra gastos.
    - **Datos reales disponibles (nada que inventar)**: `ordenes_compra`
      ya guarda, por fila, `cantidad` (subtotal antes de IVA),
      `iva_porcentaje` y `total` (`cantidad * (1 + iva_porcentaje/100)`,
      ver `POST /api/admin/ordenes-compra` en `backend/server.js`) — o
      sea que el subtotal y el IVA de cada venta YA están ahí, no hace
      falta ningún cambio de esquema. `gastos.monto` (suma mensual) ya
      se calcula en el endpoint actual, reutilizable tal cual.
    - **Límite honesto que hay que declarar en la tarjeta** (mismo
      criterio que ya se aplicó en el punto 114 al renombrar "IVA Neto"):
      `gastos` NO desglosa su propio IVA — solo tiene el booleano
      `iva_incluido` (sí/no), sin monto ni porcentaje. Por eso esta
      tarjeta calcula "IVA cobrado en ventas" (un dato real y preciso),
      **no** un "IVA neto a pagar/por acreditar" tipo declaración fiscal
      — eso requeriría desglosar el IVA de cada gasto, que el esquema
      actual no guarda. El nombre de la tarjeta y sus etiquetas deben
      dejar esto claro para no aparentar una cifra fiscal que no es.
    - **Cálculo propuesto** (todo agregado en SQL, mismo criterio de
      privacidad que el resto del endpoint — nunca se manda una fila
      suelta de `ordenes_compra` al frontend):
      - `subtotal_ventas = SUM(cantidad)` de TODAS las ventas del mes
        (sin filtrar por ticket/factura).
      - `total_vendido = SUM(total)` (con IVA incluido) de esas mismas
        filas.
      - `iva_ventas = total_vendido − subtotal_ventas`.
      - `utilidad_neta = subtotal_ventas − gastos_del_mes` (compara
        ingreso NETO de IVA contra gastos — la resta correcta desde el
        punto de vista contable; el "Balance ventas vs gastos" actual,
        que compara `facturado − gastos`, se conserva sin tocar, son dos
        preguntas distintas y complementarias, no un reemplazo).
    - **Nombre de la tarjeta — decisión pendiente de confirmar con el
      usuario**: dado que ya existe un KPI llamado "Balance ventas vs
      gastos" (Facturado − Gastos, otra cifra distinta), poner el mismo
      nombre a la tarjeta nueva confundiría cuál número es "el real".
      Propuesta de nombre distintivo: **"Utilidad neta del mes (ventas
      totales vs gastos)"** — a confirmar o ajustar con el usuario antes
      de implementar.
    - **Propuesta visual** (gráfica de barras, mismo lenguaje visual que
      "Ventas vs Facturado vs Gastos" ya existente — reutiliza el mismo
      patrón CSS/JS de barras, solo con series distintas, para no
      introducir un tipo de gráfica nuevo sin necesidad):
      ```
      ┌─────────────────────────────────────────────────────┐
      │ 🧾 Utilidad neta del mes (ventas totales vs gastos)   │
      │                                                        │
      │  Utilidad neta: $XX,XXX.XX   (verde si +, rojo si −)  │
      │                                                        │
      │   ┌──────┐                                             │
      │   │ IVA  │  ┌──────┐                                   │
      │   ├──────┤  │Gastos│                                   │
      │   │Subto-│  │      │                                   │
      │   │ tal  │  │      │                                   │
      │   └──────┘  └──────┘                                   │
      │   Ventas      Gastos                                   │
      │   totales                                               │
      │                                                        │
      │  ● Subtotal (neto)      $XX,XXX.XX                     │
      │  ● IVA cobrado          $X,XXX.XX                       │
      │  ● Ventas totales       $XX,XXX.XX                      │
      │  ● Gastos               $XX,XXX.XX                      │
      └─────────────────────────────────────────────────────┘
      ```
      Barra "Ventas totales" apilada (Subtotal + IVA, mismos tonos
      pastel navy/gris ya establecidos) junto a una barra sólida
      "Gastos" (mismo tono ya usado) — 2 columnas, mismo ancho fijo que
      ya se corrigió en el punto 117 (no repetir el problema de espacio
      desperdiciado con `flex:1`). Leyenda con 4 filas debajo, mismo
      patrón que las leyendas de dona ya existentes.
    - **Placement propuesto**: tarjeta completa (ancho completo),
      inmediatamente después de las 4 tarjetas KPI y antes de la barra
      "Ventas vs Facturado vs Gastos" — es arguably la pregunta más
      importante de toda la vista ("¿ganamos dinero este mes de verdad?"),
      merece estar arriba, no entre las tarjetas secundarias de
      desglose.
    - **Implementación (2026-08-20, aprobada por el usuario con el nombre
      "Utilidad neta del mes (ventas totales vs gastos)" y luz verde
      "implementa todo el segmento")**:
      - **Backend** (`backend/server.js`, `GET /api/admin/resumen-financiero`):
        en vez de un query aparte se extendió el query KPI de ventas ya
        existente con `COALESCE(SUM(CASE ... THEN o.cantidad END), 0) AS
        subtotal` (misma tabla, misma ventana de fechas, SIN join a
        `tickets` igual que lo prometido — una consulta menos por request).
        La respuesta ahora incluye en `mes_actual`: `subtotal_ventas`,
        `iva_ventas` (= ventas − subtotal, redondeado a 2 decimales contra
        polvo de punto flotante, mismo criterio que la proyección) y
        `utilidad_neta` (= subtotal − gastos, ídem). `total_vendido` NO se
        duplicó como llave nueva porque ya existe: es `mes_actual.ventas`.
      - **Frontend**: tarjeta full-width (`admin.html`) inmediatamente
        después de `#resumen-fin-kpis-wrap` y antes de "Ventas vs
        Facturado vs Gastos", con número grande (`#resumen-fin-utilidad-valor`,
        verde si + / rojo si − / neutro si 0), nota visible del límite
        honesto ("El IVA mostrado es el cobrado en ventas, no una cifra
        fiscal"), barras apiladas CSS puro (`renderResumenFinUtilidad` en
        `admin.js`: columna "Ventas totales" con Subtotal #719FD4 abajo +
        IVA cobrado #C0D3EB arriba — paleta pastel navy ya establecida —,
        columna "Gastos" sólida en el mismo gris `var(--color-border)` de
        la gráfica principal; ancho fijo 48px, lección del punto 117),
        leyenda de 4 filas y empty state cuando no hay ventas ni gastos.
        El modal de detalle funciona con el mecanismo genérico
        `data-detalle-contenido`/`abrirDetalleGrafica()` sin código extra.
        CSS nuevo en `admin.css` bajo el comentario "tarjeta Utilidad
        neta (punto 118)".
      - **Tests** (`backend/test/integration/resumenFinanciero.test.js`):
        mocks del query KPI actualizados con `subtotal`; aserciones nuevas:
        caso principal demuestra que `utilidad_neta` (2800) difiere de
        `balance` (1800) — cuenta las ventas sin facturar; caso "solo
        gastos" verifica utilidad negativa (−500); caso sin actividad
        verifica todo en 0.
      - **Validación**: `node --check` limpio en `server.js`, `admin.js` y
        el test; Jest completo **552/552 (33 suites)** sin regresiones;
        suite de resumen financiero **6/6**. Sin cambios de esquema de BD.
      - **Rebuild + validación contra el stack real (2026-08-20)**:
        `docker compose build --no-cache backend frontend` +
        `up -d --force-recreate backend frontend` (lección del punto 109:
        sin `--force-recreate` el contenedor no se reemplaza). Health OK,
        `/admin` sirve el HTML con la tarjeta nueva, y la API respondió
        contra MySQL real con los datos sembrados: `subtotal_ventas`
        120,929.31 / `iva_ventas` 19,348.70 (= ventas − subtotal, exacto) /
        `utilidad_neta` −12,879.46, claramente distinto de `balance`
        −37,308.46 (Facturado − Gastos) — la diferencia son las ventas sin
        facturar, tal como debe ser. Queda pendiente SOLO la revisión
        visual del usuario en el navegador (`http://localhost:8088/admin`,
        `admin:admin`).

119. **IMPLEMENTADO Y VALIDADO — "Modo dashboard" personalizable en
    Resumen financiero (2026-08-20)**: usuario pidió poder reorganizar las
    tarjetas arrastrándolas (drag/move), redimensionarlas (resize) y que la
    configuración se guarde para su perfil, restaurándose cada vez que
    entre al modo dashboard. Propuesta presentada en markdown (protocolo
    `addv-web-app`), decisiones tomadas por el usuario vía cuestionario
    (alcance SOLO "Resumen financiero" — 11 elementos: 4 KPIs + 7 tarjetas;
    persistencia SERVIDOR por usuario; guardado AUTOMÁTICO con debounce +
    botón "Restablecer") y confirmación explícita recibida ("Sí, implementa
    todo el segmento").

    - **Diseño técnico**: vanilla SIN dependencias externas (Pointer
      Events + CSS Grid de 12 columnas; GridStack.js descartado por romper
      la convención "sin librerías" del frontend y porque su motor
      reparenta DOM). Decisión clave anti-regresión: el drag NO mueve
      nodos del DOM — solo cambia `style.order`/`style.gridColumn` — para
      no romper `abrirDetalleGrafica()` (el modal reubica el contenido ya
      renderizado y lo regresa a su padre original). El movimiento visual
      durante el drag usa `transform` con transiciones desactivadas en la
      tarjeta arrastrada.
    - **Backend**: tabla `preferencias_dashboard` (usuario VARCHAR(100),
      vista VARCHAR(50), layout_json JSON, actualizado_en, UNIQUE(usuario,
      vista)) en `backend/db.js` — SIN FK a usuarios a propósito: las
      cuentas super (ADMIN_USERS / respaldo "admin") no existen en la
      tabla usuarios y también deben poder guardar layout. Endpoints
      `GET/PUT/DELETE /api/admin/preferencias-dashboard/:vista` en
      `backend/server.js` (`adminApiLimiter` + `requireAdminAuth` +
      `requireAdminArea('administrador')`): validación whitelist cerrada
      de los 11 IDs conocidos + span entero 3..12 + rechazo EN BLOQUE de
      layouts parciales/inválidos; GET normaliza layouts viejos contra la
      whitelist vigente; PUT hace upsert (`ON DUPLICATE KEY UPDATE`);
      DELETE vuelve al layout por defecto. La auditoría de PUT/DELETE
      queda cubierta por el middleware global existente (verificado:
      filas en `admin_auditoria` con actor/mecanismo).
    - **Frontend** (`admin.html`/`admin.js`/`admin.css`): los 11 elementos
      son ahora hijos directos de UN tablero unificado
      `#resumen-fin-tablero` (cuadrícula 12 columnas; se aplanaron los
      KPIs fuera de su wrapper y se quitaron los dos `.resumen-fin-grid`)
      con `data-dashboard-id` en cada uno; el layout por defecto replica
      el aspecto original (KPIs a 3 columnas, pares a 6, grandes a 12).
      Barra de controles: botón "Modo dashboard" (aria-pressed), botón
      "Restablecer" (visible solo si hay layout guardado) y ayuda
      contextual. En modo ON: contorno punteado por tarjeta, handle ⠿ de
      arrastre junto al botón expandir (headers BI) o a la derecha
      (KPIs), handle ◢ de resize en la esquina inferior derecha,
      tarjetas enfocables con alternativa de teclado completa (↑/↓
      posición, ←/→ ancho, Esc sale — WCAG 2.1 AA). Guardado automático
      con debounce 800ms + toast "Layout guardado."; carga de preferencias
      en paralelo a los datos al entrar a la vista. Bajo 900px se ignora
      el ANCHO personalizado (KPIs a 2 por fila, resto apilado) pero el
      ORDEN personalizado sí se conserva.
    - **Pruebas**: suite nueva `backend/test/integration/
      preferenciasDashboard.test.js` (8 tests: 401, 403 fiscal, 404 vista
      desconocida, GET sin preferencia, PUT válido persiste JSON
      serializado, 6 casos de PUT inválido → 400 sin escribir BD, GET
      normaliza layout viejo con elemento fuera de whitelist → null,
      DELETE). Jest total **560/560 (34 suites)**. `node --check` limpio
      en server.js/db.js/admin.js; llaves CSS balanceadas (589/589); IDs
      cruzados HTML↔JS verificados.
    - **Validado contra Docker/MySQL reales (2026-08-20)**: rebuild
      backend+frontend (`--no-cache` + `--force-recreate`), health OK;
      `/admin` sirve el HTML nuevo (11 `data-dashboard-id`); tabla
      `preferencias_dashboard` creada en MySQL real con esquema correcto
      (columna JSON + UNIQUE); ciclo API completo verificado por HTTP:
      GET inicial `{layout:null}` → PUT válido 200 → GET devuelve el
      layout → PUT inválidos 400 (span fuera de rango, id inventado) →
      vista desconocida 404 → sin auth 401 → DELETE ok → GET null;
      auditoría registró PUT/DELETE automáticamente. **Pendiente solo la
      revisión visual del usuario** (`http://localhost:8088/admin`,
      `admin:admin`): activar Modo dashboard, arrastrar/redimensionar
      tarjetas, verificar que el modal de detalle sigue funcionando tras
      un drag, recargar para confirmar restauración, y probar teclado.

120. **Auditoría de consistencia de documentación (2026-08-21, a pedido
    explícito del usuario — "revisa la documentación")**: revisión de
    salud/consistencia de los 3 entregables obligatorios del protocolo
    (`CLAUDE.md`, `PROJECT_STATE.md`, `README.md`), sin implementar
    ningún cambio (solo diagnóstico, documentado aquí para retomar
    cuando el usuario confirme el segmento de corrección). Hallazgos:
    - **Título/framing del README desactualizado**: la línea 1 sigue
      diciendo "Portal de Facturación ADDV — Carga de Constancia de
      Situación Fiscal" (nombre de la etapa single-tenant original). El
      contenido interno SÍ cubre multi-tenant, `/control` (líneas
      757-878), `docker-stack.yml`/MySQL HA Swarm (líneas 292-337) y
      slugs (líneas 691-710) — no es una laguna de contenido, solo de
      título/encabezado.
    - **Gaps reales en README**: no documenta 3 features ya
      implementadas y validadas — tarjeta "Utilidad neta del mes"
      (punto 118), gráficas BI de "Resumen financiero" (punto 117), ni
      el segmento "Look & Feel" (tema/favicon por tenant, punto 105);
      ninguna búsqueda de "Look & Feel"/"Identidad visual"/`theme.js`
      dio resultado en el archivo.
    - **Inconsistencia `FRONTEND_PORT`**: la tabla de variables de
      entorno del README (línea 67) documenta el valor por defecto
      como `80`; la sección "Despliegue local" y varios ejemplos
      posteriores (líneas 105, 369, 677) usan `http://localhost:8080`
      sin explicar el salto; y el `.env` real de este repo tiene
      `FRONTEND_PORT=8088` (fijado en el punto 109) — tres valores
      distintos sin reconciliar en la documentación.
    - **Sección "Pendiente / recomendado antes de producción" de este
      mismo archivo (líneas 6877-6944) desactualizada respecto a
      puntos posteriores del propio `PROJECT_STATE.md`**: el ítem 6
      (líneas 6912-6944) dice que los "parámetros de marca" son "solo
      diagnóstico, no implementado todavía" — falso, el segmento
      "Marca" (punto 103) ya está hecho y validado contra Docker/MySQL/
      MinIO reales; el ítem del segmento 9 (líneas 6886-6890) dice que
      falta "probarlo desde un navegador real" — falso, el punto 100 ya
      validó `/control` con clics reales en Chrome. Esa sección sigue
      sin corregirse (queda como parte del segmento de corrección
      pendiente de aprobación, no tocada en esta auditoría).
    - **Deuda técnica pendiente real, vigente, confirmada por esta
      auditoría** (no contradicha por ningún punto posterior):
      `nodemailer@6.10.1` vulnerable (CRLF/SSRF vía opción `raw`),
      requiere salto de major a v9 con prueba SMTP real antes de
      mergear (punto 116); Docker Swarm multi-nodo real nunca probado
      (puntos 95/97); despliegue de `/control` en dos servidores
      físicos distintos nunca probado (punto 99); segmentación de la
      red plana de Docker no aplicada (punto 116, recomendación no
      tomada).
    - **Comandos/scripts verificados, ninguno roto**: todos los scripts
      citados en `CLAUDE.md` bajo "Comandos frecuentes" existen tal
      cual se nombran (`backend/scripts/{verificar-mysql,
      configure-replica,verify-replication,promote-replica,
      provisionar-tenant,cutover-tenant-piloto}.js`, `control/server.js`,
      `docker-stack.yml`).
    - **Nada de esto se corrigió todavía** — el usuario pidió documentar
      y esperar. Próximo paso, solo con aprobación explícita: corregir
      título/framing del README, agregar las 3 features faltantes,
      reconciliar `FRONTEND_PORT`, y actualizar la sección "Pendiente"
      de este archivo para que deje de contradecir los puntos 100/103.

121. **Fix de alineación de barras + tarjeta "Sin facturar" en Resumen
    financiero, IMPLEMENTADO Y VALIDADO en navegador real (2026-08-21)**:
    a pedido del usuario con capturas de pantalla, protocolo
    `addv-web-app` completo (análisis con causa raíz + propuesta en
    markdown con skills usadas/justificación + validación de paleta con
    `dataviz` + aprobación explícita "Sí, implementa todo el segmento").
    - **Bug real corregido — barra "Gastos" desalineada en "Utilidad
      neta del mes"**: causa raíz, no síntoma — `.resumen-fin-chart-body`
      (clase compartida por las 2 gráficas de barras de esta vista)
      usaba `align-items: flex-end`; como cada columna es
      `flex-direction: column` sin `justify-content`, su alto total
      dependía de cuántas líneas ocupara la etiqueta de abajo ("Ventas
      totales" envuelve a 2 líneas, "Gastos" a 1), y `flex-end` alineaba
      el fondo de la COLUMNA completa (barra+etiqueta), no el de la
      barra — la columna con etiqueta más corta quedaba corrida hacia
      abajo. Fix de 1 línea: `align-items: flex-start` — como la caja de
      la barra siempre mide 200px fijo en ambas columnas, alinear por el
      top garantiza el mismo fondo sin importar el wrap de la etiqueta.
      Válido para las 2 únicas instancias que usan esa clase (verificado
      por grep antes de tocarla).
    - **Feature nueva — 4ta barra "Sin facturar" en "Ventas vs Facturado
      vs Gastos"**: dato derivado en el cliente (`ventas - facturado`
      por mes, mismo cálculo que ya usa el backend para el KPI
      `ventas_sin_facturar`) — **cero cambios de backend/API/esquema**.
      Color: `#E4A97E`, REUTILIZADO del que ya existe para el mismo
      concepto en la dona vecina "Ventas facturadas vs sin facturar"
      (`RESUMEN_FIN_COLOR_SIN_FACTURAR`) — no se inventó un color nuevo;
      validado con el script oficial de la skill `dataviz`
      (`scripts/validate_palette.js`): separación CVD y umbral de
      visión normal en PASS contra los 3 colores existentes de la
      gráfica (navy/verde/gris); el FAIL de banda de luminosidad/croma
      es de los colores de marca YA aprobados en producción (punto
      117), fuera de alcance de este cambio; el WARN de contraste vs.
      fondo blanco está mitigado porque la gráfica ya tiene leyenda +
      tooltip + `aria-label` por barra (excepción explícita que permite
      la skill cuando hay codificación secundaria).
    - **2 ajustes de orden/espaciado pedidos en vivo durante la
      implementación** (mensajes del usuario mientras se validaba en
      navegador): la barra "Sin facturar" se reordenó para quedar junto
      a "Facturado" (Ventas, Facturado, Sin facturar, Gastos — agrupa
      visualmente las dos partidas que suman Ventas), y el `gap` entre
      "Ventas totales"/"Gastos" en la tarjeta de Utilidad neta se redujo
      de 28px (heredado de la gráfica mensual, pensado para separar
      MESES) a 14px por id propio (`#resumen-fin-utilidad-body`), para
      que las 2 únicas columnas se lean como un par comparativo directo,
      no como categorías separadas.
    - **Archivos tocados**: `frontend/admin.css` (align-items fix +
      modificador `.resumen-fin-chart-columna--4` para ensanchar solo
      esta gráfica de 4 barras, normal 64→82px y vista expandida en
      modal 100→124px, sin tocar el ancho de la gráfica de Utilidad
      neta que comparte la clase base; color de barra y dot de leyenda
      nuevos; gap reducido de Utilidad neta), `frontend/admin.html`
      (4to `<li>` de leyenda), `frontend/admin.js` (4to `<span>` en el
      loop de render + `Math.max(0, ...)` defensivo + `aria-label`
      actualizado).
    - **Validado en navegador real (Claude in Chrome)**: rebuild
      `--no-cache` + `--force-recreate` del frontend en cada iteración;
      zoom a pixel sobre ambas barras de Utilidad neta confirmando el
      mismo fondo exacto (bug resuelto); las 4 barras visibles y en el
      orden correcto tanto en la tarjeta normal como en el modal
      "expandir" (ambas vistas probadas); sin errores de consola.
    - **`node --check` limpio** en `admin.js` en cada edición; llaves
      CSS balanceadas (593/593 antes de esta ronda). Sin cambios de
      backend, sin tests Jest nuevos requeridos (endpoint no tocado).
    - **Bug preexistente NO relacionado, encontrado durante la
      validación manual y corregido de paso** (reportado por el usuario
      a mitad de la prueba): al refrescar el navegador estando en
      cualquier vista del panel que no fuera "Inicio", la SPA siempre
      regresaba a "Inicio" en vez de quedarse donde estaba — causa raíz:
      `init()` (la función que revalida la sesión guardada en cada
      carga de página) llamaba `showDashboard()` pero nunca explícitaba
      qué vista mostrar, así que quedaba lo que el HTML trae por defecto
      (Inicio visible) sin importar la vista anterior. Fix: nueva clave
      `admin_vista_actual` en `sessionStorage` (mismo criterio que
      `SESSION_KEY`, se descarta sola al cerrar la pestaña) —
      `cambiarVistaPrincipal(vista)` la persiste en cada navegación;
      `init()` la restaura al validar la sesión, PERO solo si el botón
      de esa vista sigue visible para el perfil actual (reutiliza el
      mismo mecanismo de `boton.hidden` que ya aplica
      `aplicarRestriccionesPerfil()`); el submit de login (`#form-login`)
      la resetea explícitamente a `'inicio'` ANTES de `showDashboard()`,
      para que un login nuevo en la misma pestaña (con una vista vieja
      todavía guardada de una sesión anterior) siempre aterrice en
      Inicio — cumpliendo el pedido explícito del usuario de que
      "Inicio" siga siendo la landing page justo después de iniciar
      sesión, y que solo el REFRESH de una sesión ya activa recuerde la
      vista. Validado en navegador real: refresh estando en "Resumen
      financiero" mantuvo esa vista con sus datos cargados; login nuevo
      después de cerrar sesión aterrizó en Inicio con datos reales
      (15/6/8/1). Sin cambios de backend.
    - **2 ajustes finales pedidos tras revisar la captura de pantalla**:
      (1) orden final de las 4 barras: Ventas, **Gastos** (movido junto a
      Ventas, a pedido explícito), Facturado, Sin facturar — Gastos ya
      no queda al extremo derecho separado de Ventas por 2 barras. (2)
      **Alineación vertical entre las 2 tarjetas de gráfica de barras**:
      como ambas tarjetas se estiran a la misma altura (grid, stretch
      por defecto) pero "Ventas vs Facturado vs Gastos" no tiene número
      grande ni nota arriba (a diferencia de su vecina "Utilidad neta
      del mes"), su gráfica quedaba pegada arriba con un hueco en blanco
      abajo — las barras de las 2 tarjetas no compartían la misma línea
      base visual. Fix: `.resumen-fin-chart-card` pasó a `display:flex;
      flex-direction:column` y `#resumen-fin-chart-contenido` (id único,
      no afecta a la tarjeta de Utilidad neta) recibió `margin-top:auto`
      para empujarse al fondo de la tarjeta, moviendo el hueco de abajo
      hacia arriba. Validado en navegador real con zoom a pixel: las
      barras de ambas tarjetas comparten exactamente la misma línea
      base. Sin errores de consola.
    - **No se hizo commit/push** — cambios en el working tree para
      revisión del usuario, mismo criterio que el resto de segmentos de
      esta sesión.

122. **"Lectura de reportes" rediseñada para auditorías, IMPLEMENTADO Y
    VALIDADO en navegador real (2026-08-21)**: pedido explícito del
    usuario, protocolo `addv-web-app` completo (análisis del modelo de
    datos real → propuesta en markdown con 4 puntos base + 4 ideas
    opcionales A-D → usuario aprobó base + idea A → implementación).
    - **Hallazgo clave del análisis**: `reporte_items.accion` YA existía
      (`'eliminado'` = el ticket/venta se borró de verdad; `NULL` = solo
      una fotografía de algo que seguía activo) pero se mostraba como un
      badge chiquito MEZCLADO en una sola tabla — de ahí el pedido de
      separarlo. Permisos: las 5 rutas de `/admin/reportes` YA estaban
      `requireAdminArea('administrador')` (solo administrador+super
      llegan; `fiscal` ni ve el botón en el sidebar) — el pedido de
      "eliminar solo admin+super" ya se cumplía en el backend; se
      reforzó también en frontend (`puedeEliminarReporte()`, oculta el
      botón, no solo lo deshabilita).
    - **Cabecera "Detalle"** reemplaza "Estatus" en ambas tablas nuevas
      (el filtro dropdown "Estatus" se queda igual, sigue filtrando el
      enum real de tickets). El "Detalle" de un ticket ahora usa el
      MISMO sistema de badges de color que Tickets/Ventas
      (`ESTATUS_BADGE_CLASE` en `admin.js`) en vez de texto plano; el
      concepto de una venta (texto libre, sin enum) se queda como texto.
    - **2 tablas separadas** dentro de un reporte seleccionado:
      "Movimientos del periodo" (`accion IS NULL`, informativo) y
      "Eliminados" (`accion = 'eliminado'`, acento rojo a la izquierda,
      evidencia real de auditoría) — división client-side del mismo
      fetch (`renderReporteItems` filtra por `item.accion`, sin
      duplicar la petición). Cada tabla con su propio conteo y sus
      propios botones "Exportar CSV"/"Exportar Excel", que SÍ viajan
      con un nuevo parámetro `accion=activo|eliminado` a
      `GET /api/admin/reportes/:id/exportar` (y el mismo filtro se
      agregó a `GET /api/admin/reportes/:id/items` por consistencia) —
      un archivo exportado nunca mezcla las dos categorías.
    - **Idea A implementada — KPIs de auditoría** arriba de la vista:
      "Eliminados (histórico)" y "Movimientos (histórico)" (tarjetas
      `.inicio-stat-card` reutilizadas) + tarjeta "Eliminados por mes"
      (barras CSS de 1 sola serie, mismas clases `.resumen-fin-chart-*`
      que Resumen financiero, color `var(--color-error)` — el mismo
      rojo que ya usaba el badge "Eliminado", para que el color siga
      significando lo mismo en toda la vista). Endpoint nuevo
      `GET /api/admin/reportes/estadisticas` (cruza TODOS los reportes,
      no uno seleccionado — vista panorámica): `SUM(CASE WHEN accion=…)`
      para los totales, serie mensual de los últimos 6 meses agrupada
      por `creado_en` (cuándo se registró la eliminación, no la fecha
      original del ticket/venta).
    - **Archivos**: `backend/server.js` (filtro `accion` en 2 rutas +
      endpoint `estadisticas` nuevo, sin cambios de esquema — reutiliza
      columnas existentes), `frontend/admin.html` (KPI grid + 2 tablas
      reemplazando la única tabla vieja), `frontend/admin.css` (grid de
      KPIs, color de barra, tarjetas `.lectura-reportes-subtabla`),
      `frontend/admin.js` (refs nuevas, split de render, export por
      tabla, `cargarEstadisticasReportes()`, chequeo de perfil).
    - **Verificación**: `node --check` limpio en los 3 archivos, llaves
      CSS balanceadas (610/610), cross-check de IDs nuevos JS↔HTML sin
      huérfanos, IDs viejos confirmados sin referencias residuales. Jest
      backend **560/560 (34 suites)**, sin regresión — el endpoint de
      items/exportar solo ganó un parámetro opcional, comportamiento
      previo intacto sin `accion` en la query. Validado en navegador
      real (Claude in Chrome) con datos reales de la siembra: KPIs
      cargando (21 eliminados / 31 movimientos históricos), un reporte
      manual de snapshot mostrando 31 movimientos / 0 eliminados, y un
      reporte de "Eliminar venta" mostrando 0 movimientos / 1 eliminado
      (OC-000060) — exactamente la separación pedida. Export CSV
      probado sin error de consola. Sin commit/push — working tree para
      revisión del usuario.
    - **Ajuste de diseño de las tarjetas KPI, pedido en vivo tras la
      validación**: 3 iteraciones rápidas del usuario viendo la captura
      real. Resultado final: las 3 tarjetas (Eliminados/Movimientos/
      Eliminados por mes) son **cuadradas de 230×230px fijos** (no
      `1fr` estirado — así se ven simétricas entre sí sin depender del
      ancho de la fila), centradas vertical y horizontalmente (flex +
      `justify-content:center` + `text-align:center`), con el texto y
      el número de las 2 tarjetas numéricas **+40% sobre el tamaño base**
      (título 13→18px, número 30→42px, nota 12→17px) — la barra de
      tendencia se dejó a su proporción normal, solo se ajustó el
      presupuesto vertical de su tarjeta (`min-height`/altura de barra
      reescaladas para caber en el cuadro de 230px). **Lección
      reafirmada de especificidad CSS** (misma causa que el bug de
      alineación del punto 121): `.resumen-fin-chart-body` ya fija
      `min-height:220px` para la gráfica mensual grande — un override
      por clase con la misma especificidad pierde por orden en la hoja
      de estilos; hubo que usar `#reportes-kpi-chart-body` (por id) para
      que sí ganara. Validado en navegador real: 3 cuadros idénticos,
      sin huecos, texto grande y centrado, sin errores de consola.
      **Último ajuste**: texto/número de las 2 tarjetas numéricas
      reducido 30% sobre ese +40% (título 13px, número 29px, nota 12px)
      — tamaño de tarjeta (230×230px) sin tocar. Título "Eliminados por
      mes" también reducido en la misma proporción (16→11px), mismo
      gotcha de especificidad (`.resumen-fin-chart-card h2` vs clase
      propia, misma especificidad — resuelto con `#reportes-kpi-grid`
      antepuesto). Validado en navegador real, sin errores de consola.
      **Ajustes finales de layout** (con propuesta antes/después en
      markdown, aprobada explícitamente): título de las 3 tarjetas fijo
      arriba a la izquierda (se quitó `justify-content:center` de la
      tarjeta), resto del contenido (número+nota / la barra) centrado
      en el espacio sobrante vía `margin-top/bottom:auto` en esos
      elementos específicos — sin el conflicto de la vez anterior porque
      ya no compite con el centrado de la tarjeta completa. Validado en
      navegador real, sin errores de consola. **Regla nueva del usuario,
      guardada en memoria persistente**: todo cambio de diseño visual
      (nuevo o ajuste) siempre lleva propuesta antes/después en
      markdown antes de implementar, sin que se pida cada vez.
    - **Commit + push**: todo lo de este punto (121+122) más limpieza de
      mockups `stitch/` ya sin uso (hecha por el usuario) y actualización
      de README (título, puertos) — commit `f7b26d4`, push a `fact`
      (`bf9a9f6..f7b26d4`).
    - **2 ajustes más pedidos tras el push, con propuesta antes/después
      aprobada**: (1) "Configuraciones globales" movido al final del
      sidebar (después de "Reportes"), con comentario en el HTML de que
      cualquier vista nueva se agrega ANTES de ese botón, nunca después
      — ancla fija a propósito. (2) Número centrado (no todo el
      contenido, solo el número) en las 4 tarjetas KPI de "Inicio" y las
      4 de "Resumen financiero" — mismo pedido que ya se había hecho en
      Reportes, aplicado ahora también aquí, scoped por contenedor
      (`.inicio-stats-grid`/`.resumen-fin-tablero`) para no afectar las
      demás vistas que reutilizan la misma clase base
      `.inicio-stat-numero`. Validado en navegador real ambos, sin
      errores de consola. Commit `fa0906e`, push a `fact`
      (`f7b26d4..fa0906e`).

123. **Idea B de Reportes — ledger cruzado de eliminados, IMPLEMENTADO Y
    VALIDADO en navegador real (2026-08-21)**: pedido explícito del
    usuario ("comienza con todos en orden"), protocolo `addv-web-app`
    completo (propuesta con antes/después en markdown + skills +
    justificación → aprobado → implementado). Primera de las 3 ideas
    opcionales del punto 122 (B/C/D); C y D quedan pendientes.
    - **Qué es**: nueva pestaña "Todo lo eliminado" junto a "Por
      reporte" (toggle `.view-toggle`, mismo patrón ya usado en Tickets/
      Gastos/Constancias) — cruza TODOS los reportes en una sola tabla
      filtrable (mismos filtros que ya existían: tipo, estatus, RFC/
      correo, rango de fechas), con una columna nueva "Reporte de
      origen" (de qué reporte viene cada eliminado) y export CSV/Excel
      propio.
    - **Backend**: 2 rutas nuevas, `GET /api/admin/reportes/eliminados`
      y `GET /api/admin/reportes/eliminados-exportar` (ruta con guión,
      NO anidada como `/eliminados/:algo`, a propósito — para no competir
      en forma con `GET /reportes/:id/exportar`, que Express matchearía
      primero si el shape de la URL fuera igual). JOIN `reporte_items` +
      `reportes` filtrando `accion='eliminado'`, sin tocar esquema.
      `generarCSV`/`generarExcelBuffer` (`backend/utils/reportes.js`)
      ahora aceptan un 3er parámetro opcional `{incluirOrigen}` que
      agrega la columna "Reporte de origen" — retrocompatible, las
      llamadas existentes (exportación de un solo reporte) no lo pasan
      y siguen igual.
    - **Bug real encontrado y corregido en el camino** (no reportado por
      el usuario, encontrado al revisar el propio código antes de
      probar): `movimientos.map(renderFilaReporteItem)` en `admin.js`
      pasaba el índice del array como segundo argumento de la función
      (comportamiento nativo de `Array.map`), y como la función se
      extendió para aceptar `(item, conOrigen)`, cualquier fila con
      índice > 0 habría mostrado una columna "Reporte de origen" vacía
      de más en la tabla "Movimientos" (que no debería tenerla). Se
      corrigió a `.map((item) => renderFilaReporteItem(item, false))`
      antes de llegar a probarlo en navegador.
    - **Verificación**: `node --check` limpio en los 3 archivos
      tocados, cross-check de IDs nuevos JS↔HTML sin huérfanos, Jest
      backend **560/560 (34 suites)**, sin regresión. Validado en
      navegador real: pestaña nueva carga 21 eliminados (coincide con
      el KPI histórico), filtro por tipo "Tickets" → 0 resultados
      (correcto, en esta siembra todos los eliminados son ventas),
      "Limpiar filtros" y export CSV probados sin error de consola, y
      "Por reporte" se confirmó intacto (mismo comportamiento de
      siempre) al volver a esa pestaña. Sin commit/push todavía.

124. **Idea C de Reportes — quién generó el reporte, IMPLEMENTADO Y
    VALIDADO en navegador real (2026-08-21)**: cruza `admin_auditoria`
    (`control_tenants`, segmento 7) con `reportes.fecha_generacion` —
    no había columna `generado_por` en `reportes` (nadie lo pidió
    cuando se diseñó esa tabla). Endpoint nuevo
    `GET /api/admin/reportes/:id/generado-por`: si `tipo='automatico'`
    responde `{actor: null, motivo: 'automatico'}` sin ni siquiera
    intentar el cruce (un cron no tiene sesión de admin, por
    definición); si es manual, busca en `admin_auditoria` la mutación
    (`POST /reportes/enviar` o `DELETE /ordenes-compra/:id`, filtrada
    también por `tenant_slug`) más cercana en el tiempo a
    `fecha_generacion` dentro de una ventana de 5 segundos — mejor
    esfuerzo, responde `null`/"Sin coincidencia" sin bloquear si no
    encuentra nada (ej. instalaciones de antes del segmento 7). Nuevo
    campo "Generado por" en el resumen del reporte seleccionado,
    cargado aparte (no viene en la lista) con guardia contra condición
    de carrera (si cambias de reporte mientras la petición sigue en
    vuelo, no pisa el resumen del nuevo). Sin cambios de esquema. Jest
    backend 560/560. Validado en navegador real con datos reales de
    esta sesión: un reporte manual de snapshot y uno de "Eliminar
    venta" resolvieron correctamente a "admin (super)" — la propia
    sesión que los generó al probar B. Sin errores de consola.

125. **Idea D de Reportes — timeline por identificador, IMPLEMENTADO Y
    VALIDADO en navegador real (2026-08-21)**: última de las 3 ideas
    opcionales del punto 122 — con esto, B+C+D quedan completas.
    - **Qué es**: botón "Ver historial" (ícono de reloj) junto al
      identificador en las 3 tablas (Movimientos, Eliminados, ledger
      cruzado) — abre un modal con TODAS las veces que ese folio/No. de
      venta apareció en cualquier reporte, del más antiguo al más
      reciente, cada entrada con badge "Activo"/"Eliminado" y su
      detalle. Un solo `addEventListener('click')` delegado en
      `document` cubre las 3 tablas (generadas y regeneradas
      dinámicamente) sin re-engancharse cada vez.
    - **Backend**: ruta nueva
      `GET /api/admin/reportes/timeline/:tipoRegistro/:identificador` —
      JOIN `reporte_items`+`reportes` por `tipo_registro`+`identificador`
      exactos, ordenado por `fecha_generacion` ASC. Sin cambios de
      esquema.
    - **Bug real encontrado y corregido durante la validación en
      navegador** (no antes): con una descripción larga ("Servicio de
      mantenimiento vehicular"), la fila del timeline desbordaba
      horizontalmente el modal — `.reportes-timeline-detalle` no tenía
      `flex:1; min-width:0` (necesario para que un hijo flex respete el
      ancho del contenedor en vez de forzarlo a crecer con su
      contenido). Corregido, texto envuelve a varias líneas.
    - **Verificación**: `node --check` limpio en los 3 archivos,
      cross-check de IDs sin huérfanos, llaves CSS balanceadas
      (625/625), Jest backend **560/560 (34 suites)**. Validado en
      navegador real: un ticket con una sola aparición (badge
      "Activo") y una venta eliminada (badge "Eliminado") ambos
      correctos, sin errores de consola.
    - **Segmento completo (B+C+D)**: sin commit/push todavía.

126. **Rediseño de la vista "Ventas" — APROBADO POR EL USUARIO, PENDIENTE
    DE IMPLEMENTAR (2026-08-21)**: protocolo `addv-web-app` completo
    (revisión del estado real → propuesta con 3 alternativas + skills/
    justificación → usuario aprobó, pidió además rediseñar la versión
    web → crítica constructiva del propio usuario a su idea + ajuste
    propuesto → usuario aprobó ese ajuste + pidió una mejora más sobre
    la notificación de guardado → propuesta visual → **usuario aprobó
    todo, pidió documentar antes de implementar** por si se corta la
    sesión). Nada de esto está implementado todavía — es la
    especificación completa aprobada, para que cualquier sesión futura
    (esta u otra) pueda implementarla sin tener que rederivar el diseño
    ni volver a preguntar.
    - **Estado real actual de "Ventas"** (verificado en código antes de
      proponer, para no perder nada): formulario expandible/colapsable
      con memoria de preferencia + captura por **productos
      individuales** (concepto+precio+cantidad se agregan a una lista,
      el "Concepto" final de la venta se compone solo a partir de esa
      lista) + toggle "Tipo de cliente" (Cliente ya registrado / Cliente
      nuevo) + selector de correo con RFC/razón social de solo lectura
      (verificación visual) + IVA/Total calculados en vivo (foto del
      IVA global al momento de guardar, no retroactivo) + tabla lateral
      sticky con columnas ajustables/ocultables (mismo mecanismo que
      Constancias) + ícono ✅ "ya facturado" + tooltip de razón social
      en el correo + botón "Reenviar correo" + botón "Eliminar" + modal
      de detalle de venta (`#orden-modal-overlay`, YA EXISTE, separado
      del formulario de registrar) + correo de confirmación tipo
      ticket. La tabla YA tiene fallback de tarjetas apiladas en móvil
      (`data-label` + CSS genérica de `.admin-table` a los 760px,
      mecanismo compartido con toda la app) — no partía de cero.
      `GET /api/admin/ordenes-compra` ya trae la lista COMPLETA sin
      paginar (sin filtros de query) — clave para el punto de filtros
      más abajo.
    - **1. Formulario → botón + modal** (ya no sticky en la barra
      lateral): botón **"+ Registrar venta"** en la toolbar (junto a
      "Columnas"/"Actualizar") abre un modal reutilizando el patrón
      `.ticket-modal` ya existente (max-width 820px, mismo lenguaje
      visual que "Gestionar" de Tickets) — no un componente nuevo desde
      cero. "Ventas registradas" pasa a ocupar el ancho completo del
      panel.
    - **2. Un solo modal para las 2 plataformas**: en escritorio (≥900px)
      el modal muestra el formulario en una columna, tal cual sus
      campos actuales. En móvil (<900px) el MISMO modal se vuelve
      pantalla completa y adentro se activa un **wizard de 3 pasos**
      (reutilizando el patrón de 3 pasos YA validado en `csf.html` del
      portal de cliente, no un patrón nuevo): **① Cliente** (tipo de
      cliente + correo/RFC/nombre verificado) → **② Productos**
      (agregar productos, tarjetas en vez de tabla, subtotal visible) →
      **③ Confirmar** (resumen completo, IVA, total grande, botón
      Registrar). Puntos de progreso arriba, "Atrás"/"Siguiente" entre
      pasos. Un solo componente que mantener, no dos.
    - **3. El modal NO se cierra solo al guardar**: se limpia y se
      queda abierto, listo para la siguiente venta — corrige a
      propósito la pérdida del flujo actual de "registrar varias
      ventas seguidas sin volver a subir" (documentado así en el
      README de hoy) que un modal ingenuo rompería. Botón "✕"/"Cerrar"
      explícito para cuando ya se terminó de capturar.
    - **4. Confirmación de guardado INLINE, no toast** (ajuste pedido
      explícitamente porque "el toast muchas veces no se nota"): al
      guardar con éxito, el formulario se desvanece (`opacity`) y en su
      lugar aparece, DENTRO del mismo modal, una palomita (✓) que se
      "dibuja" con una animación de trazo SVG (`stroke-dashoffset`) en
      **cyan de marca `#05DBF2`** (el mismo cyan ya usado para el ítem
      activo del sidebar — reutilizado, no inventado) + texto "Guardado
      con éxito" debajo. Dura ~600ms dibujándose + ~700ms visible +
      fade out — corto pero imposible de no ver, porque aparece justo
      donde ya está la vista puesta. Respeta
      `prefers-reduced-motion` (palomita ya completa, sin animar el
      trazo — mismo criterio que `mantenimiento.html`). Solo
      `opacity`/`transform`/trazo SVG, nada que dispare layout.
      Después del fade, el formulario se limpia para la siguiente
      venta (retoma el punto 3).
    - **5. Filtros nuevos en "Ventas registradas"**: buscar por
      concepto (texto), rango de fechas, rango de total — **100% en el
      cliente (JS), sin cambios de backend**, ya que la lista completa
      se trae de una sola vez sin paginar; mismo patrón ya establecido
      del buscador de Constancias (`admin-search-input` +
      `normalizar()`), extendido con 2 filtros de rango nuevos.
    - **6. Cero funcionalidad perdida** (checklist explícito para
      cuando se implemente): line-items de productos, toggle tipo de
      cliente, verificación de correo/RFC/nombre, cálculo de IVA/Total
      con foto no retroactiva, ícono ✅ facturado, tooltip de razón
      social, reenviar correo, eliminar venta, modal de detalle
      (`#orden-modal-overlay`, sigue siendo un modal aparte del nuevo
      "Registrar venta"), columnas ajustables/ocultables de la tabla.
    - **Skills a usar al implementar**: `frontend-design-direction` +
      `impeccable` (el wizard y el modal no deben sentirse genéricos),
      `low-impact-motion` (checkmark + fade, solo transform/opacity),
      `accessibility-review` + `web-performance-accessibility`
      (checklist final, objetivo táctil ≥44px real en el wizard móvil,
      no solo al límite como hoy), `ux-copy` (texto de cada paso del
      wizard y del mensaje de éxito).
    - **4 ideas de funcionalidad nueva OFRECIDAS, sin decidir todavía**
      (el usuario dijo explícitamente "ya te digo si las implementamos
      o guardamos para después" — preguntar antes de tocar cualquiera
      de estas si se retoma esta sesión):
      1. Productos frecuentes — mini-catálogo reutilizable (un tap
         llena concepto+precio en vez de reescribir cada vez).
      2. Buscador de cliente por nombre/RFC (no solo el desplegable de
         correos actual) — mejor si el catálogo de clientes crece.
      3. Compartir el resumen de la venta por WhatsApp, además del
         correo.
      4. Borrador local (`localStorage`) por si se pierde la conexión a
         medio capturar una venta en campo.
    - **Nada implementado todavía** — este punto es la especificación
      completa aprobada, no un resumen de trabajo hecho. Antes de
      implementar: confirmar con el usuario si alguna de las 4 ideas
      opcionales entra en este mismo segmento o se queda para después
      (seguía sin respuesta cuando se documentó esto). Mismo protocolo
      `addv-web-app` de siempre para el resto de sesiones — no saltarse
      la validación en navegador real ni el registro en Jest al
      implementar.
    - **Parte web (puntos 1, 3, 4, 5 de la lista de arriba)
      IMPLEMENTADA Y VALIDADA en navegador real (2026-08-22)** — a
      pedido explícito del usuario ("comienza los cambios aprobados,
      primero para web"). El wizard móvil de 3 pasos (punto 2, dentro
      del mismo modal) queda para la siguiente ronda, sin tocar todavía.
      - **HTML**: el formulario completo se movió tal cual (mismos
        campos, mismos ids) de `.orden-compra-columna-form` (sticky) a
        un modal nuevo `#orden-registrar-modal-overlay` (reusa
        `.ticket-modal`, 820px, mismo patrón que "Gestionar" de
        Tickets). Se quitó el botón/chevron de colapsar (ya no aplica,
        el modal abierto/cerrado ES el show/hide). Botón nuevo
        **"+ Registrar venta"** en la toolbar. Barra de filtros nueva
        `.ordenes-filtros` (Concepto/Rango de fechas/Rango de total)
        arriba de la tabla, que ahora es de ancho completo (ya no
        compite con el formulario). Overlay de éxito
        `#orden-form-exito` (palomita SVG + texto) dentro del mismo
        modal, oculto por defecto.
      - **CSS**: se eliminó `.orden-compra-layout` (grid sticky de 2
        columnas) y su media query — ya no aplica. Nuevo: `.ordenes-
        filtros` (mismo lenguaje visual que `.lectura-reportes-
        filtros`, reutiliza `.lectura-reportes-rango-fechas`/
        `-acciones` tal cual, ya eran genéricas). Animación de la
        palomita: `stroke-dasharray`/`stroke-dashoffset` en el círculo
        (176, circunferencia real de r=28) y el check (40, con margen
        sobre el largo real del trazo ~35), cyan `#05DBF2` (reutilizado
        del sidebar activo, no inventado), ~650ms de dibujo + fade de
        texto a los 500ms; `prefers-reduced-motion` deja todo estático
        sin animar (mismo criterio que `mantenimiento.html`).
      - **JS**: `abrirOrdenRegistrarModal()`/`cerrarOrdenRegistrarModal()`
        nuevas (reemplazan el toggle con `localStorage` de antes —
        ya no aplica, el modal recuerda su propio estado abierto/
        cerrado por sí solo, siempre limpio al abrir). El handler de
        "Registrar" ya NO usa `showToast()` (pedido explícito: "el
        toast muchas veces no se nota") — llama a
        `mostrarExitoRegistrarOrden()`, que oculta el formulario, muestra
        la palomita, y a los 1300ms limpia el formulario y lo vuelve a
        mostrar CON EL MODAL TODAVÍA ABIERTO (foco en el primer campo,
        listo para la siguiente venta) — corrige a propósito la pérdida
        del flujo de "varias ventas seguidas" que un modal ingenuo
        habría roto. Filtros: `ordenesCache` nuevo (la respuesta cruda
        de `GET /ordenes-compra` ya no se renderiza directo, se guarda
        ahí) + `aplicarFiltrosOrdenes()` (concepto con `normalizar()`,
        mismo helper ya usado en Constancias; fechas comparando el
        prefijo `YYYY-MM-DD` de `fecha_compra`; total con `Number()`)
        — **sin cambios de backend**, ya que `GET /ordenes-compra`
        siempre trajo la lista completa sin paginar. Distingue "No hay
        ventas registradas todavía" (cache vacío) de "Ninguna venta
        coincide con los filtros" (cache con datos, filtro sin match).
      - **Verificación**: `node --check` limpio, cross-check de IDs sin
        huérfanos (se confirmó que `btn-toggle-orden-form`/
        `ordenFormChevron`/`.orden-compra-layout` no quedaron
        referenciados en ningún lado), llaves CSS balanceadas
        (637/637), Jest backend **560/560** (sin cambios de backend en
        este segmento, se corrió para confirmar cero regresión). 
        Validado en navegador real (Claude in Chrome): filtro de
        concepto instantáneo (16→4 ventas), filtro de rango de total
        instantáneo (0 en ≥20000, 3 en ≥15000 — confirma que sí filtra,
        no solo que no rompe), **2 ventas registradas de prueba de
        punta a punta** (incluida validación fiscal completa: producto
        → concepto compuesto → correo → IVA 16% aplicado correctamente
        — $100×2+16%=$232.00) confirmando que el modal se queda abierto
        y el formulario se limpia solo tras cada una, sin volver a abrir
        nada a mano; confirmado que el toast YA NO aparece en este flujo
        (`document.getElementById('toast').hidden === true` tras
        registrar). Sin errores de consola en ningún paso. Sin commit/
        push todavía — pendiente de la parte móvil (wizard, punto 2)
        antes de cerrar el segmento completo.

127. **Rediseño del menú de navegación móvil del panel admin —
    IMPLEMENTADO Y VALIDADO en navegador real (2026-08-22)**: usuario
    reportó "en la versión móvil no funciona el menú" — el `.admin-
    sidebar-nav` de escritorio, forzado a fila horizontal con scroll
    lateral por la media query de `admin.css`, quedaba con texto 12.5px
    y tap targets por debajo de los 44px mínimos de accesibilidad.
    Usuario propuso una grilla de botones cuadrados con íconos en el
    home, simétrica, dejando en la barra superior la opción de volver
    siempre al inicio — pidió explícitamente que se cuestionara y
    mejorara la propuesta antes de implementar. Crítica aplicada: usar
    "Inicio" como botón de regreso no funciona para el perfil
    `administrador` (no tiene acceso a la vista Inicio, ver
    `RESTRICCIONES_PERFIL` en `admin.js`) — se propuso en su lugar un
    botón neutral **"Menú"** en la barra superior que siempre reabre la
    grilla completa de íconos (no una vista fija), independiente del
    perfil. Usuario aprobó con "si por favor".
    - **HTML** (`frontend/admin.html`): botón `#btn-menu-movil` ("Menú"
      + ícono de grilla) agregado junto al logo del sidebar, visible
      solo en móvil. Grilla nueva `#admin-menu-movil` (oculta por
      defecto, `hidden`) como primer hijo de `.admin-main`, con 9
      botones `.admin-menu-movil-btn` (`data-vista` = inicio, tickets,
      constancias, resumen-financiero, ordenes, gastos, usuarios,
      lectura-reportes, configuraciones — mismas 9 vistas del sidebar
      de escritorio, mismos íconos SVG ya usados ahí).
    - **CSS** (`frontend/admin.css`): `.btn-menu-movil` oculto en
      escritorio, visible solo dentro de la media query `max-width:
      900px` (mismo breakpoint ya establecido). Dentro de esa misma
      media query, `.admin-sidebar-nav` (la fila de scroll horizontal
      vieja) pasa a `display: none` — se reemplaza por completo, no
      convive con la grilla nueva. `.admin-menu-movil` es un grid de 2
      columnas (`repeat(2, 1fr)`, `gap: 14px`, `max-width: 420px`)
      **sin gatear con media query** (solo el atributo `hidden` la
      controla) porque solo debe existir/usarse en móvil de todos
      modos vía JS. Tarjetas `.admin-menu-movil-btn` cuadradas
      (`aspect-ratio: 1/1`), mismo lenguaje visual que el resto del
      panel (fondo blanco, borde suave, `box-shadow: var(--shadow-
      card)`), tap target generoso (bien por encima de 44px).
    - **JS** (`frontend/admin.js`): `aplicarRestriccionesPerfil()`
      extendido para ocultar/mostrar cada `.admin-menu-movil-btn` en
      espejo exacto de su equivalente de escritorio (mismo `permitida`
      por perfil + config de Ventas habilitada/deshabilitada — una sola
      fuente de verdad, sin duplicar la lógica de permisos).
      `cambiarVistaPrincipal(vista)` ahora oculta `#admin-menu-movil`
      al entrar a cualquier vista (para que no quede debajo). Nueva
      `mostrarMenuMovil()` oculta todas las vistas y muestra la grilla;
      enlazada al click de `#btn-menu-movil` y, por delegación, cada
      `.admin-menu-movil-btn` llama a `cambiarVistaPrincipal(dataset.
      vista)` al hacer click.
    - **Verificación**: `node --check` limpio, llaves CSS balanceadas
      (643/643), Jest **560/560** (sin cambios de backend), rebuild de
      `frontend` (`--no-cache` + `--force-recreate`, mismo gotcha ya
      documentado) con health check 200 OK.
    - **Validación en navegador real (Claude in Chrome)** — con la
      limitación ya conocida de este entorno (`resize_window` no
      cambia el viewport real de la pestaña, zoom por teclado
      bloqueado por la extensión): se generó un viewport móvil
      genuino de 390×844 vía un `<style>` temporal inyectado (copia
      sin `@media` de las mismas reglas de `admin.css`, luego
      removido) en vez de un iframe (el iframe fue bloqueado por las
      cabeceras `frame-ancestors`/`X-Frame-Options` del endurecimiento
      de seguridad del punto 116 — confirma que esa protección
      funciona). Confirmado visualmente: barra superior con "Menú" +
      cerrar sesión, grilla 2 columnas con los 9 íconos correctos:
      Inicio, Tickets, Constancias, Resumen financiero, Ventas,
      Gastos, Usuarios, Reportes, Configuraciones (el 9no queda solo
      en su fila, esperado y sin problema visual). Click en "Ventas"
      navega correctamente y oculta la grilla; click en "Menú" desde
      esa vista reabre la grilla completa — el patrón de "regreso a
      casa siempre disponible" pedido por el usuario funciona tal como
      se diseñó. Cero errores de consola en todo el flujo. Sin commit/
      push todavía.

128. **Fix de overflow/desalineación en móvil — Resumen financiero,
    Inicio y Gastos (KPIs) + filtros de Gastos — IMPLEMENTADO Y
    VALIDADO (2026-08-22)**: usuario reportó "cuando sea la primera
    vez [sin layout de dashboard guardado], los elementos todos deben
    estar a lo ancho al maximo para que no se encimen y no se salga el
    texto" en Resumen financiero, y "en la opción de gastos estan los
    elementos del filtros todos desalineados", ambos para móvil.
    Propuesta antes/después mostrada primero (regla persistente del
    usuario), aprobada con "si por favor".
    - **Causa raíz 1 (KPIs)**: `.inicio-stats-grid` (compartida por
      Inicio y Gastos) y la regla de KPIs de `.resumen-fin-tablero`
      forzaban 2 columnas entre 480-900px de ancho — con números
      largos ($96,500.31, $133,808.77) el texto se recortaba contra el
      borde de la tarjeta. Reproducido y confirmado con zoom en
      navegador real antes del fix.
    - **Fix 1** (`frontend/admin.css`): ambas reglas simplificadas a 1
      columna (ancho completo) directo debajo de 900px, sin nivel
      intermedio de 2 — se quitó el breakpoint duplicado de 480px en
      `.inicio-stats-grid` (ya no hacía falta) y la línea
      `[data-dashboard-id^="kpi-"] { grid-column: span 6 }` de
      `.resumen-fin-tablero` (el orden personalizado del modo
      dashboard se sigue conservando, solo se ignora el ancho, mismo
      criterio que ya existía).
    - **Causa raíz 2 (filtros de Gastos)**: `.gastos-filtros` era el
      único filtro del panel que seguía usando `flex-wrap` con
      `min-width` distinto por campo (150px selects/fechas, 200px
      búsqueda) en vez del patrón CSS Grid ya establecido en
      `.ordenes-filtros`/`.lectura-reportes-filtros` — en móvil el
      wrap quedaba ragged/zigzag y "Limpiar filtros" descolgado.
    - **Fix 2**: nueva regla `@media (max-width: 900px)` en
      `.gastos-filtros` que apila los 7 campos (Categoría, Factura,
      Recurrente, Desde, Hasta, Buscar, Limpiar filtros) a 100% de
      ancho, uno debajo del otro — alineación garantizada sin
      depender de cálculos de `min-width` en flexbox. Cero cambios en
      escritorio (>900px) en ningún caso.
    - **Verificación**: llaves CSS balanceadas (643/643 antes y
      después del fix neto), Jest backend **560/560** (sin cambios de
      backend), rebuild de `frontend` (`docker compose build frontend`
      + `up -d frontend`, health 200 OK).
    - **Validado en navegador real (Claude in Chrome)** con la misma
      técnica de viewport móvil genuino (390×844, `<style>` temporal
      sin `@media`) del punto 127. **Nota metodológica para la próxima
      sesión**: la primera pasada de validación dio un falso negativo
      — el arnés de prueba solo fijaba `body { max-width: 390px }`
      visualmente, pero `window.innerWidth` seguía en el ancho real
      del navegador (1440px), así que los `@media (max-width: 900px)`
      REALES nunca se disparaban y se veía el layout de escritorio sin
      querer. Hay que replicar las reglas del `@media` manualmente
      (sin `@media`, con `!important`) en el `<style>` de prueba, no
      solo angostar el `body` — mismo patrón ya usado en el punto 127,
      pero esta vez se omitió por error y se corrigió a medias
      pruebas. Una vez corregido: KPIs de Resumen financiero y Gastos
      confirmados a ancho completo sin recorte de texto (zoom
      confirmado), filtros de Gastos confirmados apilados y alineados
      campo por campo hasta "Limpiar filtros". **Nota adicional**: la
      herramienta de captura de pantalla del navegador devolvió 2
      capturas en blanco durante esta validación (`Page.captureScreenshot`
      no dio timeout esa vez, pero la imagen vino vacía) — confirmado
      con `elementFromPoint`/`getBoundingClientRect` por JS que el
      contenido SÍ estaba ahí (glitch de captura, no bug real); si una
      captura sale en blanco en sesiones futuras, verificar por DOM
      antes de asumir que es un problema de layout. Sin commit/push
      todavía.

129. **Simplificación del formulario de "Registrar venta" + wizard móvil
    de 3 pasos (punto 2 pendiente del punto 126) — IMPLEMENTADO Y
    VALIDADO (2026-08-22)**: usuario pidió continuar con el wizard móvil
    y, de paso, ocultar 3 campos que "no aportan visualmente": Fecha de
    venta, IVA, y Cantidad — pidió que se cuestionara/mejorara la
    propuesta antes de implementar (protocolo `addv-web-app`).
    - **Ambigüedad resuelta ANTES de tocar código**: había dos campos
      "Cantidad" — el de piezas por producto (editable, obligatorio,
      NO se toca) y el agregado en pesos "Cantidad (MXN)" (readonly,
      autogenerado). Se confirmó con el usuario que se refería al
      segundo. Aclarado explícitamente en el análisis para no romper
      la captura de productos.
    - **Decisiones confirmadas por el usuario** (cuestionario): (1)
      dejar un mini-resumen chico "Subtotal $X · IVA $Y" arriba del
      Total en vez de quitar todo rastro — para poder verificar el
      cálculo antes de guardar, no solo después; (2) la simplificación
      aplica a AMBOS, escritorio y móvil, no solo al wizard — un solo
      formulario, no dos versiones divergentes.
    - **Qué se ocultó** (`frontend/admin.html`): los 3 bloques
      (`.field hidden`) de Fecha de venta, Cantidad (MXN) e IVA — los
      inputs/textos se QUEDAN en el DOM (Fecha e IVA son de solo
      escritura desde JS, Cantidad-MXN la sigue leyendo la validación
      del envío), cero cambio de comportamiento, solo visual. Se
      confirmó grepeando `admin.js` que ninguno de los 3 se lee de
      vuelta salvo `#orden-cantidad` (ya cubierto). El dato sigue
      disponible en la tabla de productos agregados y en "Ver venta"
      (modal de detalle) después de guardar.
    - **Mini-resumen**: `actualizarTotalPreviewOrden()` ahora también
      escribe `#orden-mini-resumen` (reusa la clase `.field-hint`, cero
      CSS nuevo) — el IVA mostrado se calcula como `total - cantidad`
      (no independiente) para que nunca se desfase 1 centavo contra el
      Total ya redondeado.
    - **Wizard de 3 pasos, solo móvil (<900px)** — reusa el componente
      `.steps`/`.step`/`.step-dot` YA VALIDADO en `csf.html`, cero
      componente nuevo. Orden: Cliente → Productos → Confirmar (mismo
      orden ya aprobado en el punto 126). El DOM NO se reordenó — el
      orden de escritorio se queda igual que siempre (Productos,
      Confirmar, Cliente al final); en móvil cada `.orden-wizard-paso`
      ocupa el mismo lugar exclusivamente vía `display:none`/`.is-active`
      dentro de `@media(max-width:900px)`, así que la posición en el DOM
      no afecta el orden visual del wizard. En escritorio esa media
      query no aplica — los 3 bloques se ven todos juntos, una sola
      página, como siempre.
    - **Validación por paso** (`frontend/admin.js`): "Siguiente" desde
      Cliente exige correo válido (`validarPasoClienteOrden()`, función
      nueva compartida con el handler de envío final — antes esa
      validación estaba duplicada inline, ahora una sola fuente de
      verdad); "Siguiente" desde Productos exige al menos 1 producto
      agregado. El botón "Registrar venta" NO vive dentro del paso 3 en
      el DOM (evita romper el orden de escritorio) — se oculta/muestra
      por JS (`ordenRegistrarBtnRow.hidden`) leyendo
      `window.matchMedia('(max-width:900px)')`, así en escritorio
      siempre está visible sin importar el "paso" interno.
    - **Modal a pantalla completa en móvil**: clase nueva
      `.orden-registrar-modal` (no toca otros usos de `.ticket-modal`
      en Tickets/Gastos/etc.) — `width/height:100vw/100vh`, sin
      `border-radius`, `overlay` sin padding, solo dentro de
      `@media(max-width:900px)`.
    - **Verificación**: `node --check` limpio, CSS balanceado (654/654),
      9 ids nuevos verificados sin duplicados, Jest backend **560/560**
      (sin cambios de backend). Rebuild de `frontend`, health 200 OK.
    - **Validado en navegador real (Claude in Chrome)**, escritorio Y
      móvil, con guardado real de punta a punta en ambos: escritorio —
      formulario sin los 3 bloques ocultos, mini-resumen visible
      ("Subtotal $200.00 · IVA $32.00" → Total $232.00, matemática
      correcta), venta guardada y confirmada por API. Móvil — mismo
      arnés de viewport genuino (390×844) del punto 128, con un ajuste
      nuevo necesario: como `esVistaMovilOrden()` lee
      `window.matchMedia` real (no el `body.max-width` inyectado), hubo
      que además sobreescribir temporalmente `window.matchMedia` en el
      arnés de prueba para que la lógica JS del wizard coincidiera con
      el CSS forzado — documentado aquí para la próxima sesión que
      pruebe algo con lógica JS condicionada por `matchMedia`. Con eso:
      wizard completo probado paso a paso — bloqueo de "Siguiente" sin
      correo (paso 1) y sin productos (paso 2) confirmados, "Atrás"
      conserva los datos capturados, paso 3 muestra el mini-resumen y
      Total correctos (Subtotal $450.00 · IVA $72.00 → $522.00), y el
      guardado real desde el paso 3 se confirmó contra la API
      (`GET /api/admin/ordenes-compra`, venta con concepto/cantidad/
      total exactos). Cero errores de consola en todo el recorrido
      (ambos tamaños). Con esto, el punto 2 pendiente del punto 126
      queda completo — el segmento "Rediseño de Ventas" del punto 126
      queda 100% implementado y validado. Sin commit/push todavía.

130. **Correo opcional + método de entrega (correo/imprimir) + ticket de
    impresión en Ventas — IMPLEMENTADO Y VALIDADO en navegador real,
    escritorio Y móvil (2026-08-22)**: usuario pidió mover el correo al
    final del wizard, agregar la elección "por correo o se imprime", y
    generar un ticket de impresión SIEMPRE disponible (no solo al elegir
    imprimir) junto a Reenviar/Eliminar. Protocolo `addv-web-app`
    completo: crítica + análisis de impacto + propuesta visual → 2
    rondas de aclaración del usuario (interpretación de "correo opcional"
    y del reordenamiento del wizard) → confirmado → implementado. En
    paralelo, el usuario pidió (mensaje suelto durante la implementación)
    ocultar también "Concepto de venta o servicio" del formulario, por
    repetir la tabla de productos — aplicado con el mismo criterio ya
    usado para Fecha/IVA/Cantidad(MXN): campo oculto, el textarea se
    queda en el DOM (sigue siendo el valor real que se manda al
    backend).
    - **Cambio de esquema**: `ordenes_compra.email` pasa de `NOT NULL` a
      `NULL` (`backend/db.js`, migración con `INFORMATION_SCHEMA.COLUMNS`
      antes de alterar, mismo patrón cuidadoso ya establecido). Único
      cambio de base de datos de todo el segmento.
    - **Backend** (`backend/server.js`): `POST /api/admin/ordenes-compra`
      acepta `email` vacío — salta la validación de formato, la
      verificación de constancia fiscal, y el envío del correo de
      confirmación (antes incondicional). `POST
      /:id/reenviar-correo` ahora acepta `{email}` en el body: si la
      venta YA tiene correo, se ignora (comportamiento de siempre); si
      NO tiene, ese correo se vuelve obligatorio, se guarda en la venta
      (`UPDATE`), se revisa si corresponde a una constancia activa
      (`tiene_constancia`, informativo — no bloquea) y se manda ahí.
    - **Wizard reordenado**: Productos → Confirmar → Entrega (antes
      Cliente → Productos → Confirmar) — el correo se pide hasta el
      último paso, junto con la nueva elección "¿Cómo se entrega?"
      (Enviar por correo / Imprimir ticket, reusa `.view-toggle`). El
      DOM no se reordenó (el paso "Entrega" sigue siendo el último hijo
      físico, como ya era "Cliente") — solo cambiaron los atributos
      `data-paso`/`data-step`, mismo mecanismo del punto 129. Elegir
      "Imprimir" oculta por completo Tipo de cliente + Correo
      (`#orden-entrega-correo-wrap`) y muestra un aviso de qué va a
      pasar; `validarPasoClienteOrden()` se salta entera cuando el
      método es "imprimir". El correo enviado al backend es `''` en ese
      caso (el propio POST ya lo interpreta como "sin correo").
    - **Ticket de impresión** (`frontend/admin.js`,
      `imprimirTicketOrden()`): reutiliza el parser YA existente
      (`parsearProductoDeLinea`, el mismo que arma la tabla de
      productos del modal "Ver venta") — cero dato nuevo del backend,
      cero riesgo de esquema para esto. Se imprime la MISMA página con
      una hoja de estilos `@media print` (`#ticket-imprimir`, hijo
      directo de `<body>`) en vez de abrir una ventana nueva —
      decisión explícita tras cuestionar la propuesta original: `window.
      open()+print()` se bloquea seguido por el navegador cuando ocurre
      después de un `fetch` async (pierde el gesto de usuario), sobre
      todo en móvil; imprimir la página actual da la misma vista previa
      nativa del navegador sin ese riesgo. Disponible desde 3 entradas
      (mismo componente): automático al guardar si el método fue
      "imprimir", ícono nuevo en la fila de la tabla, y botón "🖨️
      Imprimir ticket" en la tarjeta "Acciones" del modal "Ver venta"
      (junto a Reenviar correo/Eliminar, donde pidió el usuario).
    - **Modal "Asignar correo"** (`#orden-asignar-correo-overlay`,
      nuevo, patrón `.modal` simple): se abre desde el ícono/botón
      "Reenviar correo" cuando la venta no tiene uno guardado — pide un
      correo, lo manda al mismo endpoint de reenvío (que ahora lo
      guarda), y el toast de éxito indica si ese correo ya tiene
      constancia fiscal asignada o no.
    - **Tabla y modal de detalle**: columna "Correo" y
      `#orden-modal-correo` muestran "Sin correo" cuando aplica; tooltip
      de la fila indica "Venta registrada sin correo (se imprimió el
      ticket)"; el ícono de reenviar cambia su título a "Asignar correo
      y enviar" en esas filas.
    - **Pruebas nuevas**: `backend/test/integration/ordenes-compra.test.js`
      (no existía cobertura de Jest para estos endpoints antes de este
      segmento) — 7 casos: registrar con/sin correo, correo inválido,
      correo sin constancia, reenviar con correo existente (ignora
      body), reenviar sin correo (lo exige/guarda/devuelve
      `tiene_constancia`), reenviar sin correo y sin body → 400. Jest
      backend **567/567** (35 suites, +1 suite/+7 tests).
      `node --check` limpio en `server.js`/`db.js`/`admin.js`, CSS
      balanceado (664/664), ids nuevos verificados sin duplicados.
    - **Validado contra Docker/MySQL reales**: rebuild de
      `backend`+`frontend` (`--no-cache` no fue necesario, `build`
      normal detectó los cambios), migración de esquema confirmada
      (`IS_NULLABLE = 'YES'` verificado con una consulta directa desde
      dentro del contenedor), ciclo completo por `curl`: venta sin
      correo (`email: null` en la respuesta) → asignar correo vía
      reenviar-correo (`tiene_constancia: false`, guardado confirmado
      en una segunda consulta).
    - **Validado en navegador real (Claude in Chrome), escritorio Y
      móvil** (mismo arnés de viewport genuino de los puntos 127-129,
      con `window.matchMedia` sobreescrito para que la lógica JS del
      wizard coincida con el CSS forzado): en escritorio, formulario sin
      el bloque "Concepto de venta" ni los otros 3 ya ocultos, toggle
      "¿Cómo se entrega?" funcionando (oculta/muestra Tipo de
      cliente+Correo en vivo); en móvil, recorrido completo del wizard
      Productos→Confirmar→Entrega, elegido "Imprimir ticket", math
      correcta en cada paso. **`window.print` se sobrescribió
      temporalmente durante la prueba** (para no bloquear la
      automatización con el diálogo real de impresión del SO) y se
      confirmó que se llamó en el momento correcto con el HTML del
      ticket ya armado — mismo patrón para las 3 entradas (automático,
      ícono de fila, botón del modal). Ciclo completo de "Asignar
      correo" probado en vivo sobre una venta real sin correo (creada
      en la misma sesión de prueba): modal, guardado, toast con
      `tiene_constancia`, tabla y modal de detalle actualizados. Cero
      errores de consola en todo el recorrido (ambos tamaños). Sin
      commit/push todavía.

131. **Fix de la lista de productos capturados en el wizard de Ventas,
    solo móvil — IMPLEMENTADO Y VALIDADO (2026-08-22)**: usuario reportó
    "sale desacomodado" el elemento debajo de "+ Agregar producto",
    aclarando que solo pasa en móvil (en escritorio está bien). Pidió
    propuesta visual antes de tocar código (regla persistente del
    usuario).
    - **Causa raíz**: la tabla de productos capturados
      (`.orden-productos-tabla`, 4 columnas + botón quitar) ya tenía la
      clase `.admin-table`, así que por debajo de 760px el CSS general
      la apila en bloques (mismo mecanismo que ya usan Tickets/Gastos/
      la tabla de Ventas) — pero sus `<td>` nunca tuvieron atributos
      `data-label`, así que se apilaba SIN etiquetas: 5 valores sueltos
      uno debajo del otro (concepto, precio, cantidad, subtotal, "✕")
      sin decir cuál era cuál. **Nota de metodología para la próxima
      sesión**: la primera reproducción de este bug con el arnés de
      prueba dio un falso resultado (mostraba scroll horizontal en vez
      del apilado sin etiquetas) porque el arnés solo mirroreaba el
      breakpoint de 900px (sidebar/wizard) — la tabla usa un breakpoint
      DISTINTO (760px, `.admin-table` en general) que no estaba
      replicado; hubo que agregar esas reglas también, mismo patrón de
      gotcha ya documentado en el punto 128 pero con un breakpoint
      diferente al de esa vez.
    - **Fix, SOLO móvil (<760px)**: en vez de agregar simplemente
      `data-label` (que habría dejado 5 líneas apiladas por producto,
      ocupando mucho alto si hay varios), se reemplaza la tabla por una
      lista de tarjetas compactas de 2 líneas
      (`.orden-productos-lista-movil`, nueva) — línea 1 reutiliza
      TAL CUAL el texto que ya arma `textoProductoOrden()` ("N x
      Concepto ($X.XX c/u)", el mismo que ya se ve en "Concepto de
      venta"), línea 2 muestra "N pza(s)" + subtotal + botón quitar.
      Cero formato nuevo, cero dato nuevo. La tabla de escritorio
      (`.orden-productos-tabla-escritorio`, misma tabla de siempre, solo
      con esa clase agregada para poder ocultarla en móvil) no cambió
      en absoluto — ambas estructuras se renderizan siempre desde
      `recalcularOrdenDesdeProductos()` (mismo array de productos, dos
      vistas) y CSS decide cuál se ve según el ancho.
    - **Verificación**: `node --check` limpio, CSS balanceado
      (675/675), Jest backend 567/567 (cambio 100% frontend, sin
      impacto esperado ni real). Rebuild de `frontend`, health 200 OK.
    - **Validado en navegador real** con el arnés corregido (900px +
      760px mirroreados): 2 productos de prueba (uno con nombre largo,
      confirmó que envuelve bien sin romper el layout), botón "✕" de la
      tarjeta nueva probado (quita el producto correcto, recalcula
      total). Escritorio confirmado sin cambios (tabla normal de 4
      columnas). Cero errores de consola. Sin commit/push todavía.

132. **Modo fuera de línea para Ventas y Gastos — DISEÑO APROBADO E
    IMPLEMENTADO, ver subsección "IMPLEMENTACIÓN" al final de este punto
    (2026-08-22/23)**: usuario pidió instalabilidad tipo PWA
    primero (analizada, CANCELADA explícitamente por el usuario antes de
    tocar ningún archivo — ver el mensaje "cancela el requerimiento y
    borra la petición", nada se llegó a implementar de eso). En su lugar
    pidió modo fuera de línea con sincronización al reconectar, "los más
    altos estándares de seguridad, cifrado y ofuscamiento" y una franja
    de estado (roja sin conexión / verde sincronizando). Protocolo
    `addv-web-app` completo: la primera versión de la petición era
    inviable tal cual para este sistema — 3 rondas de crítica +
    refinamiento con el usuario hasta llegar a un alcance realista.
    **Nada de esto está implementado todavía** — es la especificación
    completa ya aprobada, documentada en `US.md` (US-073/US-074/US-075)
    y aquí para que cualquier sesión futura la implemente sin
    rederivar el diseño.
    - **Por qué la petición original no era viable tal cual** (razones
      que el usuario aceptó y usó para acotar el alcance):
      1. Los folios (`OC-000082`, `TK-000079`) los asigna
         `AUTO_INCREMENT` de MySQL al momento de guardar — no se pueden
         generar en el navegador sin arriesgar choques/reordenamientos
         al sincronizar.
      2. Ventas valida en vivo contra la base de datos (correo con
         constancia activa) — un dato que puede estar desactualizado si
         se cachea offline.
      3. El login (scrypt contra la BD) no puede pasar sin conexión —
         solo se puede mantener viva una sesión YA iniciada.
      4. Subir archivos offline (fotos de tickets, comprobantes,
         constancias) es el riesgo más alto — los navegadores pueden
         desalojar `IndexedDB` sin avisar si el dispositivo anda corto
         de espacio, perdiendo el archivo del cliente en silencio.
      5. "Cifrado/ofuscación en el navegador" es engañoso tal como se
         pidió: la llave para descifrar tendría que vivir también en el
         navegador (no hay servidor offline que la resguarde), así que
         no protege de un atacante con acceso al dispositivo — no es
         cifrado real, es falsa confianza. Se documentó también, de
         paso, que el panel admin YA guarda usuario:contraseña en
         `sessionStorage` codificado en base64 (no cifrado, reversible
         al instante) para el Basic Auth actual — diseño preexistente,
         no algo nuevo de este segmento, pero relevante para calibrar
         qué tan realista es hablar de "máxima seguridad" en el
         navegador.
    - **Alcance final aprobado** (tras 2 rondas de refinamiento del
      usuario), que resuelve o evita cada uno de los 5 puntos de
      arriba:
      - **Solo Ventas y Gastos** del panel admin — nada de Tickets, ni
        portal de cliente, ni subir archivos, ni login offline.
      - **Folios**: sin número mientras esté offline — fila
        "Pendiente de sincronizar" en la tabla; el servidor asigna el
        folio real en el orden en que le lleguen las peticiones al
        reconectar (el usuario aceptó explícitamente este
        comportamiento: "los folios se generan conforme lleguen las
        peticiones al servidor").
      - **Correo**: no hace falta ninguna cola de correo nueva — el
        envío YA vive dentro del mismo guardado en el servidor
        (fire-and-forget, código ya existente); diferir el guardado
        completo hasta reconectar basta para que "el correo se mande
        hasta que ya esté en la base de datos" tal como pidió el
        usuario.
      - **Archivos**: se resuelve solo, sin diseño nuevo — el
        comprobante de un gasto YA es una acción SEPARADA del alta
        (`POST /gastos` primero, `POST /gastos/:id/comprobante`
        después, patrón ya construido) y Ventas nunca sube archivos —
        así que "crear offline" nunca necesita adjuntar nada.
      - **Validación fiscal en vivo**: Gastos no depende de ningún dato
        dinámico del servidor al capturar (categoría es lista cerrada
        ya conocida en el navegador) — cero riesgo. Ventas sí valida
        constancia contra la BD, pero esa validación también se
        difiere al momento de sincronizar — el usuario aceptó
        explícitamente que si falla ahí, "se corrige a posteriori" (esa
        venta puntual se marca con el error, no bloquea ni descarta
        las demás).
      - **Login offline**: sigue sin resolverse, a propósito — fuera de
        alcance, la sesión ya activa del admin es la que permite seguir
        capturando.
      - **Cifrado**: bajo este alcance solo se guarda texto de negocio
        (producto/precio/monto/categoría), no contraseñas ni archivos
        — se recomendó NO agregar cifrado del lado del cliente (no
        resuelve nada real, ver punto 5 de arriba) y confiar en el
        aislamiento por origen que ya da el navegador (nadie fuera de
        este sitio puede leer esos datos), limpiando el
        almacenamiento local al cerrar sesión.
    - **Decisiones de UX ya confirmadas por el usuario** (3 preguntas
      de la última ronda de refinamiento):
      1. "Imprimir ticket" queda DESHABILITADO sin conexión (no hay
         folio real que imprimir todavía) — SÍ se puede elegir "Enviar
         por correo" y guardar, sin problema.
      2. Disparo de sincronización 100% automático al recuperar
         conexión (no se pidió botón manual "Sincronizar ahora").
      3. Las tablas de Ventas/Gastos siguen mostrando la última lista
         conocida (solo lectura) mientras no hay conexión, no solo la
         capacidad de crear.
    - **Piezas técnicas previstas** (para cuando se implemente,
      ninguna construida todavía):
      - Almacenamiento local: `IndexedDB` (no `localStorage` — más
        espacio, no bloquea el hilo principal), limitado a la cola de
        Ventas/Gastos pendientes + la última lista de lectura de cada
        vista; se limpia al cerrar sesión.
      - Franja de estado fija arriba: roja "Sin conexión a internet"
        (mientras `navigator.onLine`/eventos `online`/`offline`
        indiquen que no hay red — conviene además un ping real a
        `/api/health` antes de dar por buena la reconexión, para no
        disparar una sincronización que falle de inmediato por un
        falso positivo de "hay red pero no hay internet real"), verde
        "Sincronizando datos…" mientras se procesa la cola en el orden
        en que se creó, desaparece sola (fade-out) al terminar —
        mismo criterio de animación ya usado en el resto del panel
        (transform/opacity, respeta `prefers-reduced-motion`).
      - Distinto del mecanismo YA EXISTENTE de `mantenimiento.html`
        (página completa cuando el BACKEND responde 502/503/504) — este
        es para cuando el DISPOSITIVO del usuario se queda sin red, el
        resto del sitio sigue usable, no se reemplaza por una pantalla
        completa. No confundir ambos al implementar.
      - Cada fila "Pendiente de sincronizar" necesita un estado visible
        si falla al sincronizar (no desaparece ni se descarta sola —
        se queda visible con el error para corregir a mano, ver punto
        de validación de Ventas arriba).
    - **No avanzar con la implementación sin aprobación explícita del
      usuario** — este punto documenta el diseño ya aprobado, mismo
      protocolo `addv-web-app` de siempre; el mensaje que cerró esta
      ronda de refinamiento pidió documentar todo primero y dejó la
      implementación para después ("después podemos proceder a los
      cambios").

    ---
    **IMPLEMENTACIÓN (2026-08-23)** — a pedido explícito del usuario
    ("comienza a aplicar los cambios"), se implementó el diseño de
    arriba TAL CUAL fue aprobado, sin desviaciones de alcance.

    - **Archivo nuevo `frontend/offline.js`**: módulo genérico y
      reusable, sin conocer nada de "ventas"/"gastos" en concreto —
      IndexedDB (`portalfac_offline`, stores `pendientes_ordenes`/
      `pendientes_gastos`), detección de conexión real (no solo el
      evento `online` del navegador, que puede dar falso positivo con
      un wifi sin internet real — se confirma con un ping a
      `/api/health`, público, mismo endpoint que ya usa
      `mantenimiento.html`), reintento cada 10s mientras el estado
      conocido sea "offline" (por si el evento nunca llega), y una API
      pequeña (`agregarPendiente`, `listarPendientes`,
      `eliminarPendiente`, `marcarError`, `reintentarUno`,
      `registrarManejadorSync`, `onCambioEstado`, `onCambioCola`,
      `onSincronizacionCompleta`, `limpiarTodo`) que `admin.js` usa sin
      duplicar lógica de IndexedDB. Se agregó al `COPY` del
      `frontend/Dockerfile` (mismo gotcha ya documentado en el punto
      106 — un archivo JS nuevo que no se copia a la imagen falla en
      silencio hasta que se prueba de verdad).
    - **Franja de estado** (`#conexion-banner`, admin.html/admin.css):
      fija arriba de TODO (z-index por encima de los modales), roja
      "Sin conexión a internet" / verde "Sincronizando datos…",
      desaparece con fade-out al terminar. `admin.js` la controla desde
      `OfflineQueue.onCambioEstado()`.
    - **Ventas** (`frontend/admin.js`): `btnRegistrarOrden` encola en
      vez de hacer `fetch` cuando `OfflineQueue.isOffline()`; el botón
      "🖨️ Imprimir ticket" del paso "Entrega" se deshabilita
      automáticamente al quedarse sin conexión (con tooltip explicando
      por qué) y se re-habilita al volver — con un bloqueo defensivo
      adicional dentro del propio handler de guardado, por si acaso.
      `cargarOrdenes()`/`aplicarFiltrosOrdenes()` se volvieron
      conscientes de offline: sin conexión no intentan la petición
      (usan la última `ordenesCache` ya cargada en memoria), y SIEMPRE
      mezclan lo pendiente de la cola arriba de la lista real
      (`ordenPendienteAVista()`, con un total ESTIMADO client-side,
      nunca el real hasta que el servidor lo confirme). Fila pendiente
      (`filaOrdenPendiente()`): badge ámbar "Pendiente de sincronizar"
      o rojo "No se pudo sincronizar" + el mensaje de error real del
      servidor, botones "Descartar" (siempre) y "Reintentar" (solo si
      ya falló una vez).
    - **Gastos**: mismo patrón exacto (`guardarGasto()` solo intercepta
      la rama de CREAR, nunca editar — offline no aplica a editar un
      gasto que ya existe de verdad; el comprobante, si se seleccionó
      uno, se avisa que hay que adjuntarlo después, ya conectado, mismo
      mensaje que ya usaba el flujo existente cuando la subida fallaba
      pero el gasto sí se guardó). `gastosResumenActual`/
      `gastosTotalActual` nuevos (cachean lo último cargado, para poder
      re-renderizar con la cola mezclada sin volver a pedirle nada al
      servidor). Las pendientes NUNCA se mezclan en la vista "Papelera"
      (no tiene sentido ahí).
    - **Sincronización**: `admin.js` registra un manejador por tipo
      (`OfflineQueue.registrarManejadorSync('ordenes'|'gastos', ...)`)
      que hace el `POST` real de siempre; al recuperar conexión de
      verdad, la cola se procesa EN ORDEN DE CREACIÓN, un fallo en uno
      no detiene a los demás (se marca con `marcarError` y sigue). Al
      terminar de sincronizar un tipo, se recarga esa lista
      (`onSincronizacionCompleta`) para reemplazar las filas pendientes
      por las reales con folio.
    - **Cerrar sesión con cola pendiente**: si hay algo sin sincronizar
      al hacer clic en "Cerrar sesión", se avisa con `window.confirm()`
      antes de limpiar la cola (perderla en silencio sería peor que un
      diálogo nativo un poco menos pulido que el resto de la UI — se
      documenta la inconsistencia de estilo a propósito, es una
      decisión consciente por seguridad de datos, no un descuido).
    - **Verificación**: `node --check` limpio en `admin.js`/
      `offline.js`, CSS balanceado (689/689), Jest backend **567/567**
      (sin cambios de backend en este segmento — todo el mecanismo es
      100% frontend). Rebuild de `frontend`, health 200 OK.
    - **Validado en navegador real de punta a punta (Claude in
      Chrome)**, simulando offline/online real (se sobrescribió
      `navigator.onLine` + se dispararon los eventos `online`/`offline`
      reales del navegador, no un mock superficial):
      1. Venta online normal (sin tocar nada de esto) — confirmado sin
         regresión, guardó con folio real de siempre.
      2. Offline: banner rojo confirmado, "Imprimir ticket" confirmado
         deshabilitado, venta capturada offline con correo
         seleccionado → fila "⏳ Pendiente de sincronizar" con total
         estimado correcto, gasto capturado offline → misma fila
         pendiente con categoría/monto correctos.
      3. Reconexión: banner desaparece, ambos registros confirmados
         reales contra la API (`GET /ordenes-compra`/`GET /gastos`) con
         folio/id real y el monto exacto que se había estimado offline.
      4. Cola vacía confirmada después de sincronizar
         (`listarPendientes` → `[]` para ambos tipos).
      5. Camino de falla: un gasto con categoría inválida encolado a
         propósito → al reconectar, fila roja "⚠ No se pudo
         sincronizar" con el mensaje real del backend, botones
         "Reintentar" (repite el mismo error, no crashea) y "Descartar"
         (limpia la cola) confirmados funcionando.
      6. Mismo recorrido repetido en viewport móvil genuino (390×844,
         mismo arnés de los puntos 127-131) — banner y fila pendiente
         confirmados sin romper el layout responsive.
      Cero errores de consola en todo el recorrido. **Bug chico
      encontrado y corregido en el camino**: los botones "Reintentar"/
      "Descartar" se envolvían mal en 2 líneas dentro de la celda de
      acciones — CSS `white-space: nowrap` en `.pendiente-sync-acciones
      .btn`.
    - **Limitación conocida, aceptada a propósito** (no es un bug):
      el "último conocido" que se muestra offline es la caché EN
      MEMORIA de la pestaña actual — si se recarga la página estando
      offline sin haber visitado antes esa vista, se ve vacía hasta
      reconectar (no hay persistencia de la lista de LECTURA en
      IndexedDB, solo de la cola de pendientes por crear, que sí
      sobrevive un reload). Ampliar esto a un caché de lectura
      persistente es una mejora futura razonable si hace falta, no se
      construyó en este segmento por mantener el alcance acotado a lo
      aprobado.
    - **Sin commit/push todavía** — pendiente de decisión del usuario.

133. **Rediseño del ticket de correo de Ventas con la marca CLARVO —
    IMPLEMENTADO Y VALIDADO (2026-08-23)**: usuario pidió recolorear el
    correo de confirmación de venta (`construirCorreoOrdenCompra`,
    `backend/server.js`) con los colores de marca y el logo real de
    CLARVO, con propuesta visual antes de aplicar (regla persistente
    del usuario). Se publicó un Artifact con el antes/después
    renderizado lado a lado + tabla de cambios exacta, aprobado con
    "excelente trabajo, si aplícalo".
    - **Logo** (`logoTicketHtml`): cuando no hay logo de tenant
      configurado, si la marca es la de por defecto (`MARCA_DEFECTO`,
      ningún tenant la sobreescribió) ahora usa el logo REAL de CLARVO
      (`${urlPortal}/assets/branding.png`, el mismo archivo que ya
      sirve el login) en vez de una caja de texto verde genérica. Un
      tenant con su propio nombre de marca (sin logo todavía) sigue
      viendo SU texto, nunca el logo de CLARVO — se agregó el parámetro
      `urlPortal` a la función para poder construir la URL absoluta.
    - **Paleta**: verde `#0F6E5D`/beige `#F0EFEA` → navy `#03285B` +
      cian `#05DBF2` de marca, los MISMOS tokens ya usados en
      `auth.css`/login/sidebar del panel (`--color-accent`,
      `--auth-electric`), no valores inventados nuevos. Franja
      degradada navy→azul→cian (`#03285B`→`#2F6FED`→`#05DBF2`) nueva
      arriba de la tarjeta — mismo degradado que ya tiene el isotipo
      real de CLARVO. Fondo suave `#E7ECF3` detrás de la fila "TOTAL A
      FACTURAR" (mismo tono que las tarjetas KPI del panel) para que
      el número que importa se distinga de un vistazo.
    - **Pie de página**: cuando la marca es la de por defecto, muestra
      "CLARVO by ADDV" en vez de solo "ADDV" (`MARCA_DEFECTO` en sí NO
      se tocó — sigue siendo `'ADDV'`, usado igual en los otros 6
      correos que lo referencian; solo este template en particular
      muestra el nombre completo en su pie de página).
    - **Sin cambios de estructura**: mismo esquema de tabla HTML,
      mismo texto plano equivalente, mismo comportamiento para
      tenants con su propio logo/marca — solo colores + logo de
      respaldo.
    - **Verificación**: `node --check` limpio, Jest backend **567/567**
      (sin tests que dependieran de los colores viejos — verificado
      que las coincidencias de `#0F6E5D` en la suite eran de un test
      no relacionado, `tema.test.js`). Rebuild de `backend`, health
      200 OK.
    - **Validado con la salida REAL de la función** (no solo el
      mockup): se extrajeron las funciones tal cual quedaron en
      `server.js` a un script aislado, se renderizaron con datos
      reales, y se publicó como Artifact para inspección visual — la
      franja degradada, el resaltado navy del total y el botón se ven
      exactamente como en la propuesta aprobada (el logo salió roto
      SOLO en el Artifact por no poder alcanzar `localhost:8088` desde
      ese sandbox — confirmado con `curl` que la ruta real
      `/assets/branding.png` responde 200 `image/png`). **Validado con
      un envío SMTP real**: este entorno ya tiene SMTP configurado de
      verdad (`smtp.gmail.com`/`notificaciones@addv.mx`) — se registró
      una venta real de prueba y el correo se envió sin ningún error en
      los logs del backend.
    - **CORRECCIÓN — el logo SÍ llegó roto en el correo real
      (2026-08-23, mismo día)**: la suposición de arriba ("en un correo
      real sí carga") era incorrecta — el usuario recibió el correo de
      prueba y reportó la imagen rota. Causa raíz real:
      `detectarUrlPortal(req)` arma la URL del logo a partir del header
      `Host` de la petición entrante — en TODAS las pruebas de esta
      sesión (curl o navegador) ese header fue `localhost:8088`, así
      que el `<img src="http://localhost:8088/assets/branding.png">`
      del correo era una URL que solo esta máquina puede resolver — ni
      Gmail ni el dispositivo del destinatario pueden llegar a
      "localhost" de otra computadora. El mismo punto ciego ya existía
      de antes para el logo de marca de un TENANT (usa el mismo
      mecanismo de URL absoluta), no es nuevo de este segmento, pero
      nunca se había probado contra un correo real hasta ahora.
      **Fix, con confirmación explícita del usuario** (URL vs.
      incrustado — eligió incrustado): el logo de CLARVO por defecto
      ahora viaja DENTRO del correo como adjunto embebido (CID) en vez
      de un `<img src="URL">` — funciona sin importar si el servidor es
      alcanzable públicamente, y es más confiable en general (varios
      clientes de correo bloquean imágenes remotas por defecto de
      cualquier forma). `logoTicketHtml()` ahora regresa `{html,
      adjunto}` en vez de solo el HTML; `construirCorreoOrdenCompra()`
      regresa `adjuntos: []` (con el logo si aplica) que
      `enviarCorreoOrdenCompra()` pasa a `enviarCorreo()` (que ya
      soportaba `adjuntos`/`attachments` de antes, sin cambios ahí).
      Copia propia del PNG en `backend/assets/branding.png` (nueva —
      el backend no tiene acceso al filesystem del contenedor
      frontend, así que se duplica a propósito, mismo criterio ya
      usado para otro código pequeño compartido entre `backend/` y
      `control/`), cacheada en memoria tras la primera lectura
      (`obtenerLogoClarvoBuffer()`), con manejo de error si el archivo
      no se puede leer (cae al texto de respaldo en vez de tronar el
      correo). El logo de un TENANT (`logoUrl` desde `/control`) NO se
      tocó — sigue siendo una URL absoluta, eso no fue lo que se
      reportó roto.
      **Verificación**: `node --check` limpio, Jest **567/567**.
      Confirmado dentro del contenedor real: el PNG se copió
      correctamente a la imagen (`433174` bytes, firma PNG válida),
      y se renderizó el MIME real del correo con
      `nodemailer.createTransport({streamTransport:true})` — contiene
      `Content-ID: <logo-clarvo-addv>` y `Content-Type: image/png`
      con el adjunto de 433174 bytes, exactamente lo que un cliente de
      correo espera para mostrar una imagen incrustada. **Confirmado
      por el usuario contra un correo real** ("ya llegó bien") tras un
      segundo envío de prueba real vía SMTP. Sin commit/push todavía.

134. **Datos de prueba históricos para validar reportes (ventas + gastos +
    tickets) y serie mensual de ~6 meses en Resumen financiero —
    VALIDADO CONTRA DOCKER REAL (2026-08-23)**: usuario pidió
    sembrar 5 meses de datos pasados ("quiero datos de 6 meses en la
    tarjeta de balance acumulado… para probar las tarjetas, como
    proyección de ventas") porque los reportes no mostraban nada del
    pasado. Análisis previo encontró DOS causas reales de que no hubiera
    historial:
    - **Retención activa a 5 días** (`tickets_retencion_dias=5`): el job
      horario (`ejecutarLimpiezaConReporte`) borra toda venta/ticket con
      `creado_en` mayor a 5 días — por eso solo existían órdenes desde
      el 2026-08-19. Decisión del usuario: **subirla a 365 días** (SQL
      directo, revertible desde Configuraciones globales).
    - **La gráfica del Resumen financiero recortaba la serie al mes en
      curso por diseño** (`fecha_compra >= inicio`): aunque existieran
      meses pasados, la API solo regresaba "Ago" y la proyección quedaba
      en null (requiere ≥3 llaves). Fix en `server.js` (~4 líneas):
      nueva constante `inicioSerie` = primer día del mes hace 5 meses,
      usada SOLO por las 2 queries de la serie — KPIs del mes actual/
      anterior intactos. Comentarios actualizados.
    - **Siembra**: script nuevo `backend/scripts/sembrar-datos-prueba.js`
      (PRNG determinista con semilla fija, transaccional, se niega a
      correr si ya hay gastos con la nota marcadora). Ejecutado dentro
      del contenedor contra `portal_facturacion`: **175 ventas**
      (ids 94..268), **85 tickets 'listo' vinculados** (ids 82..166,
      ~45% de las ventas, para que Facturado/Sin facturar tenga forma;
      imagen placeholder — NO hay archivo en MinIO) y **86 gastos**
      (renta+2 nóminas fijas/mes + variables de la lista cerrada con
      proveedores plausibles, notas `'Dato de prueba (validacion de
      reportes)'`). Ventana: mar–jul completos + ago 1–22. Totales
      mensuales verificados por SQL: ventas 191k–309k, gastos 54k–189k.
    - **Validado contra la API viva (build VIEJO)**: KPIs del mes,
      tendencias (+113% facturado, +46% gastos vs julio), distribución
      por 10 categorías y top proveedores ya reflejan la siembra; listas
      de Ventas/Gastos muestran el histórico completo.
    - **Cierre**: cuando la sesión paralela completó "Categorías
      editables" (suite en verde: **584/584, 36 suites**), se corrió el
      rebuild único acordado (`docker compose up -d --build backend`).
      Verificado por HTTP contra MySQL real: health OK,
      `serie_mensual` devuelve las **6 llaves mar–ago** con los totales
      exactos del SQL de verificación, y `proyeccion_ventas` ya activa
      (**Sep ≈ 342,850 / Oct ≈ 376,521**). El mismo deploy dejó vivo el
      backend de categorías editables (su UI de frontend depende del
      rebuild de frontend de esa sesión).
    - SQL de limpieza cuando ya no se necesiten: rangos impresos por el
      propio script (`ordenes_compra` 94..268, `tickets` 82..166,
      `gastos` por nota). Sin commit/push todavía.

135. **Categorías de gastos editables desde el propio popup de "Registrar
    gasto" — COMPLETA e IMPLEMENTADA Y VALIDADA (2026-08-23)**: usuario
    pidió poder editar/agregar categorías en el mismo popup; protocolo
    completo — análisis de impacto (las categorías eran una lista CERRADA
    en 3 capas: CHECK de MySQL `chk_gastos_categoria`, validación
    backend, diccionario duplicado en `admin.js`), crítica propia (4
    puntos: renombrar vs. agregar tienen riesgo distinto porque agregar
    exige quitar el CHECK; una categoría con gastos existentes nunca debe
    ser hard-delete, solo desactivarse — mismo principio de borrado suave
    que tickets/constancias/reportes; "otro" debe quedar protegida como
    respaldo de color/etiqueta; una categoría nueva no tiene color propio
    en la dona de Resumen financiero) + propuesta visual (Artifact con
    mockup antes/después del panel colapsado/expandido) + 2 preguntas
    de alcance confirmadas explícitamente por el usuario: **"Ambas"**
    (renombrar Y agregar, no solo una) y **"gris de Otro"** (categoría
    nueva sin color propio en la dona, usa el fallback ya existente de
    `RESUMEN_FIN_COLORES_CATEGORIA['otro']`, cero cambio necesario ahí).
    - **Esquema**: `categorias_gastos` (tabla nueva, `slug` UNIQUE,
      `etiqueta`, `activa`, `protegida`, `orden`) reemplaza la lista
      cerrada; `ensureSchema()` en `db.js` migra (DROP del CHECK viejo si
      existe) y siembra idempotente desde `CATEGORIAS_SEED`/
      `ETIQUETAS_SEED` (10 categorías originales, "otro" con
      `protegida=1`). La columna `gastos.categoria` (VARCHAR) NO cambia
      — los slugs son estables para siempre, cero migración de datos
      existentes.
    - **Backend** (`backend/utils/gastos.js`, reescrito por completo):
      `listarCategoriasGastos()` (con `tieneGastos` calculado por
      `EXISTS` contra `gastos`), `categoriaGastoExiste()`,
      `crearCategoriaGasto()` (slug generado de la etiqueta —
      `generarSlugCategoria()`: minúsculas, sin acentos, `[a-z0-9_]`,
      recortado a 50 — con sufijo numérico automático en colisión),
      `renombrarCategoriaGasto()` (nunca toca el slug, solo `etiqueta`;
      rechaza la protegida), `eliminarCategoriaGasto()` (con gastos →
      desactiva; sin gastos → borra de verdad; rechaza la protegida),
      `reactivarCategoriaGasto()` (agregada tras una pregunta explícita
      al usuario — sin esto, desactivar era una puerta de un solo
      sentido, inconsistente con el resto de la app). 4+1 endpoints
      nuevos en `server.js` bajo `/api/admin/gastos/categorias`
      (GET/POST, PUT/DELETE `:id`, POST `:id/reactivar`), todos
      `requireAdminArea('administrador')`. `validarCuerpoGasto()` pasó a
      `async` (ahora valida contra la tabla, no una función síncrona).
    - **Bug real encontrado y corregido durante la validación en Docker
      (no detectable con `node --check` ni Jest con mocks)**: dependencia
      circular — `db.js` importa `utils/gastos.js` (para leer
      `CATEGORIAS_SEED` al sembrar) ANTES de terminar de armar su propio
      `module.exports`, y `gastos.js` hacía
      `const { pool } = require('../db')` a nivel de módulo — capturaba
      el `pool` de esa versión a medio construir (`undefined`) para
      siempre. Toda request a los endpoints nuevos tiraba 500
      (`TypeError: Cannot read properties of undefined (reading
      'query')`). Fix: `require('../db')` perezoso dentro de cada
      función (`obtenerPool()`), que en runtime real siempre cae a la
      versión ya completa desde la caché de `require()` — los mocks de
      Jest no exponen este tipo de bug porque no hay ciclo real ahí.
    - **Bug real de UI encontrado y corregido durante la validación en
      navegador (preexistente, no introducido por este segmento)**: el
      modal de confirmación genérico (`#confirm-modal-overlay`,
      reutilizado por Eliminar/Restaurar/etc. en toda la app) y los
      demás `.modal-overlay` comparten `z-index: 50` sin diferenciación
      — cuando se abre DESDE DENTRO de otro modal ya abierto (el caso
      nuevo de "Eliminar categoría" desde el popup de Registrar gasto,
      y ya existía el mismo riesgo latente con "Quitar comprobante"
      desde el detalle de un gasto), gana visualmente el que aparece
      más abajo en el DOM — no el que se abrió después — dejando el
      diálogo de confirmación invisible detrás del modal padre (el clic
      en "Eliminar" no hacía nada visible, aunque el elemento sí existía
      en el DOM). Fix de una línea:
      `#confirm-modal-overlay { z-index: 70; }` en `style.css`.
    - **Frontend** (`admin.html`/`admin.js`/`admin.css`): el diccionario
      estático `CATEGORIAS_GASTOS` de `admin.js` se eliminó — reemplazado
      por `state.categoriasGastos` (cargado de
      `GET /api/admin/gastos/categorias` al entrar a la vista Gastos, en
      paralelo/antes de `cargarGastos()`, mismo patrón ya usado para la
      caché de correos de Ventas). Selector de alta (`#gastos-modal-
      categoria`) filtra a solo `activa` (con excepción: si se edita un
      gasto cuya categoría ya se desactivó, se agrega igual para no
      perder el valor); filtro de la tabla lista TODAS (activas e
      inactivas, con sufijo "(inactiva)") porque un gasto viejo puede
      seguir usándola. Botón "✏️ Categorías" junto al select expande un
      panel inline (el campo pasa a las 2 columnas del grid del modal
      mientras está abierto) con: fila por categoría (renombrar en línea
      con Guardar/Cancelar; ícono de borrar SOLO si `tieneGastos` es
      falso; "Otro" se muestra con badge "Protegida" sin íconos; fila
      "Reactivar" en categorías inactivas), e input+botón "+ Agregar"
      al final (Enter también agrega). Delegación de eventos sobre la
      lista (se re-renderiza completa en cada cambio, no hay diffing).
    - **Pruebas**: `backend/test/unit/gastos.test.js` reescrito por
      completo (probaba exports que ya no existen: `CATEGORIAS_GASTOS`,
      `categoriaValida`, `clausulaCheckCategoria` — ahora prueba
      `generarSlugCategoria()` y la semilla); 5 tests de
      `test/integration/gastos.test.js` parcheados (`validarCuerpoGasto`
      ahora hace una consulta async extra, `categoriaGastoExiste`, que
      había que insertar en la posición correcta de cada mock);
      `backend/test/integration/gastos-categorias.test.js` NUEVO (14
      tests: los 5 endpoints, incluida protegida/con-gastos/sin-gastos/
      reactivar/404/403). Jest backend **584/584 (36 suites)**.
    - **Validado contra Docker/MySQL reales de punta a punta**: rebuild
      `--no-cache` + `--force-recreate` (2 veces, la segunda tras el fix
      de la dependencia circular); ciclo completo por `curl` (crear con
      colisión de slug → renombrar → eliminar sin gastos → rechazo de
      renombrar/eliminar la protegida → desactivar con gastos →
      reactivar), verificado en la tabla real. **Validado en navegador
      real (Claude in Chrome)**: login, apertura del panel, crear
      categoría (Enter y clic), renombrar en línea, eliminar (confirmó
      el fix de z-index), registrar un gasto completo usando una
      categoría recién creada (aparece correcta en la tabla), papelera →
      eliminar permanente, limpieza completa de los datos de prueba
      (tabla `gastos` y `categorias_gastos` verificadas de vuelta al
      estado base: 101 filas totales = 99 activos + 2 en papelera
       preexistentes, 10 categorías, "renta" activa). Cero errores de
       consola. Sin commit/push todavía — pendiente de instrucción
       explícita del usuario, mismo protocolo `addv-web-app`.

136. **Maduración del requerimiento del módulo Inventarios
    (`inventarios.md`) — EN CURSO (2026-08-23)**: trabajo exclusivamente
    de análisis/documentación (el usuario lo marcó así: "todo este es
    análisis de requerimientos y madurarlo para después ejecutar la
    estrategia"; NADA implementado todavía). El documento base era una
    visión amplia de 55 secciones sin carácter ejecutable; se agregó la
    **Sección 0 "Alcance v1 y decisiones cerradas"** que prevalece sobre
    el resto y cierra las decisiones madre con el usuario:
    - **D1** producto simple como unidad mínima en v1 — SIN variantes ni
      atributos configurables (fase 2). **D2** multi-almacén preparado no
      operativo: `almacen_id NOT NULL` desde el día uno + almacén
      auto-provisionado "ALM-1", UI solo lectura. **D3** ubicaciones fuera
      de v1 (`ubicacion_nota` VARCHAR libre). **D4** inventario negativo
      prohibido en v1. **D5** costeo promedio ponderado móvil.
      **D6** `existencias(producto_id, almacen_id)` UNIQUE derivada del
      libro append-only de movimientos. **D7** roles v1 = perfiles
      existentes (operador de almacén/compras → fase 2).
    - **D8 CERRADA** (misma sesión, tras análisis con el usuario):
      integración Ventas vía columna nullable `producto_id` +
      interruptor GLOBAL de plataforma `ventas_afectan_inventario` en
      Configuraciones globales — decisión explícita: la regla es igual
      para TODOS los tenants, no cambia por tenant (primera config
      global fuera de las `configuracion` por tenant; candidato natural:
      BD de control). Switch activo: autocompletado de producto
      (nombre/SKU) + lectura por código de barras con fallback manual,
      salida automática por venta validando stock disponible. Switch
      inactivo: Inventarios oculto, Ventas como hoy, datos conservados.
      §22 reescrito como US-INV-025; §49 corregido (premisa falsa
      señalada). Limitación honesta v1: venta de línea única, sin
      carrito multi-producto.
    - **D9**: importador masivo ENTRA en v1 (era out-of-scope del primer
      borrador de la Sección 0; el usuario lo pidió explícitamente para
      migrar desde su sistema actual). Reescrito §34 completo: wizard de
      6 pasos (subir → hoja/vista previa → mapear cabeceras → validar →
      ejecutar → resultado), auto-mapeo por diccionario de sinónimos con
      sugerencia preseleccionada/editable, campo `extra` (JSON) que
      conserva columnas no mapeadas, upsert por SKU (actualiza campos
      presentes, vacíos nunca borran), existencias iniciales en el mismo
      archivo generando entradas 'inventario inicial' transaccionales,
      chunks de 500 filas con async+polling >500, firma binaria,
      archivo original archivado en MinIO
      `inventarios/<slug>/imports/<id>/`, tablas nuevas
      `imp_importaciones`/`imp_importacion_errores`, API de 5 endpoints
      bajo `/api/admin/inventarios/importaciones`, criterios de
      aceptación medibles. Dependencia técnica recomendada: exceljs +
      csv-parse (puras JS, sin compilación nativa) — confirmar al
      implementar.
    - **§0.5 agregado (bloque 3 del plan)**: concurrencia e integridad
      numérica — atomicidad movimiento+saldo en UNA transacción,
      `SELECT ... FOR UPDATE` anti-sobrevende (timeout ~5 s →
      INV_CONCURRENCIA reintentable), DECIMAL(12,3) cantidades /
      DECIMAL(12,2) montos (FLOAT/DOUBLE prohibidos), libro append-only
      con existencia_anterior/posterior por movimiento, conciliación
      saldos↔kardex vía script `verificar-inventario.js` + botón admin
      (corrección SOLO con movimiento compensatorio AJU-), códigos de
      error INV_* y pruebas obligatorias de concurrencia/conciliación
      dentro del DoD v1.
    - **§0.6 agregada (bloque final)**: mecanismo de configuración GLOBAL
      de plataforma — tabla `configuracion_global` en la BD de control
      (`control_tenants`), fuente única sin réplicas por tenant, regla
      "global O por tenant, jamás ambas", clave inicial
      `ventas_afectan_inventario` default '0', switch editable SOLO por
      perfil plataforma desde Configuraciones globales con aviso de
      alcance total (admins de empresa solo lectura; /control solo
      lectura), caché backend TTL ≤ 60 s sin reinicio, auditoría de cada
      cambio en el plano de control. Queda como patrón base para el
      punto 137 (credenciales de APIs).

137. **Pendiente registrado: credenciales de acceso a las APIs por
    empresa + Swagger — SOLO ANOTADO, sin analizar ni implementar
    (2026-08-23)**: el usuario pidió dejar constancia como trabajo
    futuro:
    - Documentar los servicios API con **Swagger/OpenAPI**.
    - Mecanismo de **login y password POR EMPRESA**, dado de alta desde
      la app de control (`/control`): cada empresa/tenant recibe
      credenciales propias para acceder a SUS APIs, de modo que los
      servicios no queden expuestos sin autenticación específica.
    - El **SUPER admin accede a todas las empresas con las MISMAS
      credenciales** (par global).
    - Decisiones abiertas para cuando se analice: dónde viven las
      credenciales (BD de control vs BD del tenant), hash con scrypt
      (convención del repo), rotación/revocación, rate limiting por
      credencial, registro en auditoría, middleware Express de
      validación, qué endpoints quedan cubiertos y relación con la
      futura "API pública" (fase 5 del roadmap de inventarios).
       Requerirá el flujo completo Analizar→Proponer→Confirmar antes de
       implementarse.

138. **PENDIENTE — Cuentas por cobrar: venta pagada por defecto +
     opción "pendiente de pago" + nueva vista "Cuentas por cobrar" —
     PROPUESTA UX/UI, NO IMPLEMENTAR hasta confirmación explícita
     (2026-08-24)**: pedido del usuario: *"cuando se dé una venta, por
     defecto es cuenta pagada, pero también está la opción pendiente de
     pago, esta debe ser gestionada en una sección de cuentas por
     cobrar, esta no existe, genera tu mejor propuesta UX UI, dame la
     propuesta visual antes de implementar y espera por mi respuesta"*.
     Protocolo `addv-web-app`: Analizar→Proponer detenido aquí, a la
     espera de Confirmar. **Cero código tocado**.

     **Análisis del estado real**: `ordenes_compra` (ventas) hoy NO
     tiene estado de pago — toda venta se asume cobrada al registrarla
     (el `total` se calcula con la foto de `iva_porcentaje` del momento,
     ver punto 112). Ventas ya alimenta "Resumen financiero" (Facturado,
     Ventas sin facturar, Utilidad neta) con el criterio
     `EXISTS tickets.listos`, pero NO distingue si el dinero ya entró o
     quedó a crédito. Inventarios v1 (`inventarios.md:22` §22 D8) usa
     `producto_id` nullable + switch global `ventas_afectan_inventario`;
     el nuevo `estado_pago` debe ser independiente de ese switch
     (también hay ventas de servicios sin stock que pueden quedar a
     crédito).

     **Modelo de datos propuesto (sin migrar aún)**: `ordenes_compra`
     + columnas `estado_pago ENUM('pagada','pendiente') NOT NULL DEFAULT
     'pagada'`, `fecha_vencimiento DATE NULL`, `monto_cobrado
     DECIMAL(12,2) NOT NULL DEFAULT 0`, `fecha_cobro DATETIME NULL`,
     `notas_cobro TEXT NULL`, `saldo = total - monto_cobrado` derivado
     (no columna). Migración idempotente vía
     `INFORMATION_SCHEMA.COLUMNS` antes de `ALTER`, mismo patrón que
     `email NULL` del punto 130. `monto_cobrado` permite abonos
     parciales sin tabla de pagos extra en v1; un pago total pone
     `estado_pago='pagada'` y `fecha_cobro=NOW()`. Auditoría automática
     vía middleware existente + `admin_auditoria` (segmento 7).

     **Propuesta visual — 1) Ventas: modal "Registrar venta"**
     ```
     ┌─ Registrar venta ───────────────────────────┐
     │ Productos  [tabla/tarjetas ya existente]   │
     │ Total: $1,232.00                            │
     │ ──────────────────────────────────────────  │
     │ Estado de pago                              │
     │  (●) Pagada  ( ) Pendiente de pago          │ ← default Pagada
     │  [si Pendiente →]                           │
     │  Vencimiento [____/__/__]  (date)           │
     │  Notas de cobro [........................]  │
     │ ──────────────────────────────────────────  │
     │ Entrega: (●) Enviar por correo  ( ) Imprimir│
     │ [Registrar venta]                           │
     └────────────────────────────────────────────┘
     ```
     - Toggle radio de 2 opciones (no switch), accesible por teclado,
       color verde (`--color-success-soft`) para Pagada / ámbar
       (`--color-warn-soft`) para Pendiente, mismo lenguaje que
       `estatus-pendiente` vs `estatus-listo` de Tickets.
     - Por defecto **Pagada** (una columna menos, un clic menos en el
       flujo más común). Cambiar a Pendiente revela `fecha_vencimiento`
       + `notas_cobro` con transición `height/opacity` (solo
       `transform`/`opacity`, respeta `prefers-reduced-motion`).
     - Validación: Pendiente exige `fecha_vencimiento` futura (no
       pasada) si se captura; opcional pero recomendada.

     **Propuesta visual — 2) Nueva vista "Cuentas por cobrar"**
      Sidebar: entre **Ventas** y **Gastos** (`#btn-vista-cxc`,
      ícono SVG monedas (mismo set que Resumen financiero), mismo
      `admin-sidebar-nav` navy). Solo perfil
     `administrador`+`super` (igual que Ventas/Gastos, ver punto 114
     `RESTRICCIONES_PERFIL`).

     ```
     ┌─ Cuentas por cobrar ────────────────────────┐
     │ [Activos: Pendientes] [Cobradas]            │
     │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
     │ │Por     │ │Vencidas│ │Por     │ │Cobrado ││
     │ │cobrar  │ │  2     │ │vencer  │ │ mes    ││
     │ │$12,430 │ │$3,200  │ │$9,230  │ │$8,100  ││
     │ └────────┘ └────────┘ └────────┘ └────────┘│
     │ Filtros: [Cliente/correo] [Vencimiento] [  ]│
     │ Tabla: No.Venta | Cliente | Total | Cobrado  │
     │        | Saldo  | Vencimiento | Estado | ●   │
     │        | OC-000082 | ana@... | $1,232 | $0   │
      │        | $1,232 | 2026-09-10 | Pendiente  │
     │        | [Ver venta] [Registrar cobro] [Recordatorio]│
     │ Modal "Registrar cobro":                     │
     │  Saldo $1,232  [Monto a cobrar $____]        │
     │  [Cobro parcial] [Cobro total]  [Guardar]    │
     └────────────────────────────────────────────┘
      ```
      - 4 KPIs del mes: Por cobrar (suma saldos pendientes), Vencidas
        (`fecha_vencimiento < hoy`), Por vencer, Cobrado del mes
        (`estado_pago='pagada' AND fecha_cobro en mes`). Reusa
        `.inicio-stats-grid` (ya usado en Inicio/Gastos/Resumen) + icono
        SVG 18×18 por KPI (mismo set que Resumen financiero: $/x-circle/
        clock/check-circle, tintados por `inicio-stat-icono-*`).
      - Tabla reutiliza `.admin-table` + columnas ocultables (mismo
        controlador `crearControladorColumnas`) + toggle
        Activos(pendientes)/Cobradas (papelera semántica pero sin
        borrado físico — es estado de la venta). Badge `Pendiente`
        (ámbar) / `Vencida` (rojo) / `Pagada` (verde) — solo texto, sin
        emojis, color por `estatus-pendiente|cancelado|listo` (punto
        141).
     - Acciones por fila: Ver venta (abre `#orden-modal-overlay`
       existente), **Registrar cobro** (modal simple con monto, valida
       `monto <= saldo`, crea abono → actualiza `monto_cobrado`,
       si `saldo==0` pasa a `pagada`), Recordatorio (copia texto con
       datos de la venta, sin enviar correo automático en v1 para no
       agregar SMTP nuevo sin confirmar).
     - Filtros 100% client-side (igual que Ventas p.126), sin backend
       nuevo para listar — `GET /api/admin/ordenes-compra` ya trae
       todo; CxC solo filtra `estado_pago='pendiente'` en cliente.
       Export CSV/Excel propio con mismo patrón de reportes.

     **Impacto en vistas existentes**:
     - Ventas registradas: columna "Estado pago" + filtro, badge inline.
       Offline (`frontend/offline.js`): `estado_pago` serializado en la
       cola; imprimir deshabilitado para pendiente sin folio igual que
       hoy.
     - Resumen financiero: KPI nuevo "Por cobrar" opcional en la tira de
       4 (no cambia gráfica existente, solo dato derivado).
     - Reportes: `reporte_items` no cambia; el export de CxC es
       independiente.

     **API propuesta (no creada)**: `GET /api/admin/ordenes-compra`
     ya sirve el campo nuevo; `PUT /api/admin/ordenes-compra/:id/cobro`
     (`{monto, notas}`) con `requireAdminArea('administrador')` +
     `adminApiLimiter`. Validación `monto >0 && monto <= saldo`.

      **Decisión pendiente del usuario**: confirmar o ajustar (1) toggle
      Pagada/Pendiente en el paso Entrega del wizard (¿junto a Entrega o
      como 4º paso? Propuesta: junto a Entrega, no nuevo paso), (2)
      posición exacta de "Cuentas por cobrar" en el sidebar y KPIs, (3)
      si vencimiento es obligatorio o solo sugerido, (4) si abonos
      parciales entran en v1 o solo cobro total. **No avanzar a
      implementación sin respuesta explícita**.

     **Auditoría + correcciones sobre el código YA EXISTENTE en el
     working tree (2026-08-24, a pedido explícito del usuario:
     "revisa el punto 138")**: pese a que este punto dice "cero código
     tocado", la otra herramienta SÍ había implementado la mayor parte
     (schema en `db.js`, endpoint `PUT .../cobro`, vista completa
     `Cuentas por cobrar` en `admin.js`/`admin.html`, integración con
     `offline.js`) y la migración ya había corrido contra la BD real.
     Coincide bien con lo documentado arriba (KPIs, filtros, tabla,
     modal de cobro, endpoint con queries parametrizadas). Se encontró
     y corrigió, con datos reales:
     - **Bug de datos real, confirmado contra la BD real, el más
       grave**: la migración agrega `monto_cobrado DEFAULT 0` pero
       nunca hace backfill para las ventas que ya existían — **207 de
       212 ventas reales** quedaron con `estado_pago='pagada'` pero
       `monto_cobrado=$0`. La pestaña "Cobradas" de CxC habría
       mostrado $0 cobrado en casi todo el historial. Fix: backfill
       `UPDATE ordenes_compra SET monto_cobrado = total, fecha_cobro =
       COALESCE(fecha_cobro, creado_en) WHERE estado_pago = 'pagada'
       AND monto_cobrado = 0` en `db.js`, fuera del bloque
       `if (!nombresCxc.includes(...))` (esa rama solo corre la
       primera vez que se crea la columna, no habría arreglado una BD
       donde ya existía) — self-limiting, después del primer backfill
       ninguna fila real vuelve a cumplir la condición. Verificado
       contra Docker real: 212/212 ventas correctas después (antes
       207 rotas), `fecha_cobro` poblado desde `creado_en`.
     - **Cero pruebas Jest** para el endpoint `/cobro` ni para la
       validación de `estado_pago`/`fecha_vencimiento` del POST — solo
       había un spec de Playwright (feliz camino, venta nueva, no
       tocaba datos históricos, por eso no atrapó el bug de arriba).
       Se agregaron 11 tests nuevos a
       `backend/test/integration/ordenes-compra.test.js` (venta
       pendiente con vencimiento futuro, vencimiento pasado, estado
       inválido cae a pagada, y 8 casos del endpoint `/cobro`: auth
       401/403, monto inválido, venta inexistente, ya pagada, excede
       saldo, cobro parcial, cobro total).
     - **Validación faltante**: la propuesta pedía "vencimiento
       futuro, opcional pero recomendada" — el backend aceptaba
       fechas pasadas. Agregado el rechazo (400) en
       `POST /api/admin/ordenes-compra`.
     - **Código muerto** en `admin.js`: dos variables
       (`_cargarOrdenesOriginal`/`_cargarOrdenesConCxc`) se definían y
       nunca se usaban, justo antes del monkey-patch real de
       `cargarOrdenes` que sí hace el trabajo — limpiado a una sola
       versión clara.
     - **Columna "Estado pago" en Ventas**: ya existía como badge
       inline en la celda "No. Venta" (corrección a mi propio hallazgo
       anterior, que decía que faltaba por completo) — se le agregó el
       filtro que sí faltaba (`#ordenes-filtro-estado-pago`: Todas/
       Pagada/Pendiente/Vencida), 100% cliente, mismo patrón que el
       resto de filtros de Ventas.
     - Jest backend **595/595 (36 suites)**, `node --check` limpio en
       los 3 archivos. Validado contra Docker/MySQL reales: backfill
       confirmado por SQL directo, filtro nuevo probado en navegador
       real (4 pendientes correctas), vista Cuentas por cobrar sin
       errores de consola, KPI "Cobrado mes" ahora refleja el
       histórico real ($309,411.17) en vez de casi cero.
     - Las 4 preguntas de diseño abiertas de arriba (toggle en el
       wizard, posición en sidebar, vencimiento obligatorio u
       opcional, abonos parciales en v1) siguen **sin respuesta
       explícita del usuario** — esta revisión corrigió calidad/datos
       del código ya escrito, no reemplaza esa confirmación pendiente.

139. **App de control — misma identidad de marca que /admin + mejora UI
     (2026-08-24, APLICADO)**: a pedido del usuario, `/control` no tenía
     identidad de marca (login `FX` + header blanco fino, tabla con 3
     botones de texto por fila que la ensanchaban) vs `/admin` ya con
     sidebar navy `#03285B` + `branding_bgo.png` + `auth-shell` split
     CLARVO. Crítica aplicada antes de implementar: clonar el sidebar
     1:1 con 9 items habría sido ruido (control es 1 vista, no 8) — se
     aplicó **misma marca, shell adaptado**.
     - `frontend/control.html:1`: agregado `auth.css`, login migrado de
       card centrada `FX` a `auth-shell` split-screen (mismo
       `branding.png` + `login-decoracion-marca.png` + `© Clarvo
       Control by ADDV`, id `auth-anio-control`), dashboard envuelto en
       `admin-dashboard` con `admin-sidebar` navy + `branding_bgo.png`
       (`alt="Clarvo Control by ADDV"`), 1 nav `Empresas` + menú móvil
       `admin-menu-movil` con 1 card, mismos tokens `admin-body`.
       **PENDIENTE branding**: imagen debe decir literal
       "Clarvo Control by ADDV" — anotado aquí y en `control.html:1`
       (`alt` ya dice eso); temporal se reutiliza `branding.png`/
       `branding_bgo.png` de `/admin` hasta entregar PNG final con ese
       texto. Sidebar no inventa vistas falsas.
     - `frontend/control.js:1`: acciones de tabla de texto → íconos
       compactos 30×30 `btn-icono-accion` con `data-tooltip` (mismo
       patrón que Usuarios `PROJECT_STATE.md:78`), `crearBotonAccion`
       ahora genera SVG + tooltip; handler menú móvil + año.
     - Validado `node --check frontend/control.js` + `docker compose
       build --no-cache frontend` + `up -d --force-recreate frontend`:
       `GET /control` 200 con `branding_bgo.png` + `admin-sidebar`, sin
       `FX`. Pendiente solo entrega de PNG "Clarvo Control by ADDV"
       para reemplazar `branding*.png` sin tocar código.

140. **Sidebar fijo (nunca se pierde en scroll) + cifras visibles y sin
     encimarse en las gráficas de Resumen financiero — IMPLEMENTADO Y
     VALIDADO (2026-08-24)**: dos pedidos del usuario con captura de
     pantalla real como evidencia — (1) el sidebar de `/admin` se perdía
     al hacer scroll largo (Resumen financiero) y "Cerrar sesión" a
     veces no aparecía; (2) las cifras que el punto 135^ (sesión previa)
     agregó a "Utilidad neta mensual"/"Proyección de ventas" se
     encimaban entre meses vecinos.
     - **Sidebar**: `.admin-sidebar` pasó de flex-child normal (se
       estiraba al alto de `.admin-content`, así que en vistas largas su
       parte de arriba —logo, nav, y el footer "Cerrar sesión"— quedaba
       muy por debajo del viewport visible) a `position: fixed; top:0;
       left:0; height:100vh` — el usuario pidió explícitamente que el
       scroll quede "embebido" del lado derecho, no en el menú. Un primer
       intento con `position: sticky` no bastó (el usuario lo probó y
       reportó que el menú se seguía perdiendo) — `fixed` lo saca del
       todo del flujo del documento, sin ambigüedad. `.admin-content`
       gana `margin-left: 256px` para no quedar tapado. En móvil
       (`<900px`, donde el sidebar ya es una barra horizontal angosta)
       vuelve a `position: sticky` normal — `fixed` ahí rompería el
       layout apilado. Ajuste ya existente de `top` cuando la franja de
       "sin conexión" está visible, replicado para el nuevo `fixed`.
     - **Cifras encimadas**: el primer fix (alternar cerca/lejos del
       punto por paridad de índice par/impar) solo resuelve el caso
       zigzag — falla cuando varios meses seguidos suben o bajan juntos
       (ej. Ago→Sep→Oct en Proyección, exactamente lo que el usuario
       capturó). Reemplazado por `calcularEtiquetasLejos()`
       (`frontend/admin.js`): compara el ANCHO DE TEXTO estimado (por
       cantidad de caracteres — SVG no permite medir el ancho real antes
       de insertar) contra el espacio horizontal real entre puntos
       consecutivos; si dos cifras vecinas no caben una junto a otra, la
       segunda se aleja más de su punto (offset mayor), y si la anterior
       ya se alejó, esta se queda cerca — nunca alterna a ciegas. Halo
       `paint-order:stroke` del color de superficie detrás de cada cifra
       (`.resumen-fin-linea-etiqueta-valor`), para legibilidad si de
       todos modos queda cerca de otra o del trazo.
     - **Incidente real durante la implementación, documentado para que
       no se repita**: otra sesión/herramienta (claude-flow/ruflo, ver
       `.claude-flow/`/`.agents/`/`.mcp.json` sin trackear en el repo)
       estuvo corriendo en paralelo sobre el MISMO directorio de trabajo,
       construyendo/desplegando su propia feature (Cuentas por cobrar,
       punto 138) con `docker build` propio. En algún momento su build
       capturó `frontend/admin.js` a medio editar de este lado —
       `calcularEtiquetasLejos()` ya exigía un segundo parámetro
       (`textos`) pero una de las dos llamadas (`renderResumenFinProyeccion`)
       todavía no se lo mandaba — y lo desplegó así. Efecto: al abrir
       Resumen financiero, esa función tronaba
       (`TypeError: Cannot read properties of undefined (reading
       'length')`), y como `renderResumenFinanciero()` llama a los
       renders uno tras otro sin try/catch individual, todo lo que viene
       DESPUÉS en esa cadena se quedaba en blanco (Proyección, Distribución
       de gastos, Ventas facturadas vs sin facturar, Top proveedores) — el
       catch de más afuera atrapa la excepción y la etiqueta mal como
       *"No se pudo conectar con el servidor"* (no es de red, es JS roto;
       ese texto es compartido por 46 bloques `catch` distintos en
       `admin.js`, cualquier excepción ahí cae en el mismo mensaje
       genérico). La API nunca dejó de responder bien — confirmado por
       `curl` con datos reales en todo momento. Se corrigió terminando el
       wire-up pendiente y volviendo a desplegar; confirmado con un
       listener de `error`/`unhandledrejection` instalado por JS +
       recorrido de las 9 vistas principales (incluida "Cuentas por
       cobrar") con reload de página real — cero excepciones. Logs de
       backend/nginx de las últimas 24h también limpios (cero 500, cero
       error real de servidor) — refuerza que el mensaje "No se pudo
       conectar" que el usuario vio repetido no era de red.
     - **Auditoría de lo que la otra herramienta cambió**, revisada a
       pedido del usuario antes de continuar (ver también punto 137/138):
       commit `7b7abba` ya en `main` agrega Swagger (`/api/docs`,
       `/api/control/docs`) + credenciales API por tenant
       (`api_credenciales` en la BD de control, Basic o `X-API-Key` por
       header/cookie, resuelve a `perfil:'super'` acotado al tenant,
       scrypt + timing-safe + defensa dummy-hash contra oráculo de
       existencia). **Hallazgo 1 CORREGIDO (2026-08-24, a pedido del
       usuario)**: `?api_key=` en la URL ya no se acepta como mecanismo
       de auth — quedaba expuesta en logs de acceso/historial del
       navegador/header Referer. Quitado de `requireAdminAuth()`
       (`backend/utils/auth.js`, las 2 capas 0 y 4b que lo leían) y de
       toda mención pública: descripción del esquema `apiKey` en
       `backend/utils/swagger.js` actualizada para decir explícitamente
       que NO se acepta por query string, y el ejemplo `curl` de query
       que el modal "Credenciales API" de `/control` mostraba al admin
       (`frontend/control.js`) se quitó — ahora solo enseña header y
       cookie. Sigue funcionando exactamente igual por header/cookie (no
       había tests que cubrieran esto — cero regresión posible ahí).
       **Hallazgo 2 CORREGIDO (mismo día)**: la CSP de `/api/docs` y
       `/api/control/docs` traía `'unsafe-inline' 'unsafe-eval'` en
       `script-src` sin necesitarlo — se investigó el HTML real que
       genera `swagger-ui-express` (`generateHTML()` en su
       `node_modules`): sus 3 `<script>` son todos `src=` externos del
       mismo origen (`swagger-ui-bundle.js`/`standalone-preset.js`/
       `init.js`, servidos por la misma ruta), nunca código inline —
       `script-src 'self'` ya los permite sin `'unsafe-inline'`. El
       único `new Function("return this")()` del bundle (grep directo
       al `.js` de `swagger-ui-dist`) es un fallback de `globalThis`
       para navegadores sin esa API — inalcanzable en la práctica, así
       que tampoco hace falta `'unsafe-eval'`. `style-src` SÍ conserva
       `'unsafe-inline'` (el HTML trae bloques `<style>` literales,
       riesgo bajo comparado con script). CSP final: `script-src 'self'
       https:; style-src 'self' https: 'unsafe-inline'`. Un `curl -I`
       inicial pareció mostrar dos CSP distintas (`default-src 'none'`
       + la nueva) — investigado y descartado como falso positivo: es
       el paquete `send` (usado por `express.static` dentro de
       `swagger-ui-express`) poniendo `'none'` en su PROPIA página de
       redirect 301 autogenerada (`/api/docs` → `/api/docs/`, sin
       contenido que necesite permisos) — la página real (200) siempre
       tuvo la CSP correcta, confirmado con `curl` a los 4 assets
       (`swagger-ui-bundle.js`/`standalone-preset.js`/`init.js`/`.css`)
       en backend Y control, los 4 con 200 y content-type correcto.
       **Confirmado visualmente por el usuario (mismo día)**: revisó
       `/api/docs` en su propio navegador, "se ve bien" — Swagger UI
       pinta correctamente con la CSP endurecida, sin bloqueos.
       Jest 584/584, `node --check` limpio, rebuild + redeploy de
       backend/control contra Docker real, health OK.
       Aparte, el punto 138 (Cuentas por cobrar) sigue **sin commitear**
       en el working tree (schema `estado_pago`/`monto_cobrado`/etc. en
       `ordenes_compra`, endpoint `PUT /api/admin/ordenes-compra/:id/cobro`,
       vista nueva) pese a que el punto 138 dice "NO IMPLEMENTAR hasta
       confirmación explícita, cero código tocado" — la documentación
       quedó desalineada con el working tree real; anotado aquí para que
       quien retome sepa que ya hay código (no probado por esta sesión)
       antes de asumir que sigue en fase de propuesta.
     - Jest backend 584/584 sin cambios (segmento 100% frontend).

      **Rediseño final del mismo día — cifras selectivas en vez de
      colisión-por-ancho, IMPLEMENTADO Y VALIDADO**: el fix de
      `calcularEtiquetasLejos()` de arriba resolvió el caso que causó el
      incidente, pero el usuario mandó una captura mostrando que
      "Proyección de ventas" seguía viéndose mal — la cifra de Marzo
      cortada a "$26" porque el primer/último punto usan alineación de
      texto (`text-anchor: start/end`) distinta a los del medio
      (`middle`), y el cálculo de colisión por ancho de texto no los
      medía igual. Propuesta visual (Artifact con antes/después real,
      reproduciendo el bug exacto de la captura) presentada y aprobada
      ("me agrada tu propuesta... aplícala") antes de tocar código —
      mismo protocolo. **Se abandonó por completo la colisión-por-ancho**
      (`calcularEtiquetasLejos()` eliminada) a favor de **etiquetado
      selectivo**, la práctica estándar en gráficas de línea con varios
      puntos: `calcularIndicesClave(valores, cantidadReal)` nueva en
      `admin.js` marca solo primero, último (+ último REAL si hay
      proyección, para no perder el punto donde arranca el pronóstico),
      máximo y mínimo — nunca más de 4-5 cifras por tarjeta sin importar
      cuántos meses traiga la serie. Los puntos que no son clave se
      quedan como círculo pequeño semi-transparente
      (`.resumen-fin-linea-punto-fantasma`, `fill:var(--color-ink-soft);
      opacity:.55`) SIN cifra pegada — su valor exacto sigue disponible
      con el `<title>` nativo del navegador al pasar el mouse (ya
      existía en el círculo, no se tocó). Elimina la clase de bug entera
      en vez de parchar el caso puntual: con como máximo 4-5 etiquetas
      nunca adyacentes por diseño, no hay cálculo de colisión que
      mantener. Validado en navegador real (login + click a Resumen
      financiero + zoom a la gráfica + expandida en el modal grande):
      ambas tarjetas limpias, sin cortes ni encimados, puntos fantasma
      visibles pero discretos. Jest backend 584/584 (sin cambios,
      segmento 100% frontend). **Commiteado y pusheado** (`f1b395a` →
      `fact/master`, junto con el trabajo en curso de la otra
      herramienta — ver arriba). Limpieza aparte: se borró
      `e2e/tests/temp-resumen2.spec.ts`, un script de depuración suelto
      (nombre "temp", sin relación con ningún segmento documentado) que
      había quedado sin commitear en el working tree.

 141. **Pulido visual Cuentas por cobrar + Ventas — sin emojis, icono
      factura (2026-08-24, IMPLEMENTADO Y VALIDADO)**: a pedido explícito
      *"en el proyecto no usamos emojis, por favor retira los que están
      en Cuentas por cobrar y mantén el diseño como los iconos de la
      sección Resumen financiero"* + confirmación A+B (limpiar también
      Ventas, factura junto a OC como documento). Protocolo Analizar →
      Proponer → Confirmar cumplido: se analizó impacto, se propuso tabla
      de mapeo de emojis → SVG y se esperó el "en A y B por favor, ...
      solo deja el texto, pero la que está al lado de la orden de compra
      OC esa cámbiala por una que imite una factura".
      - `frontend/admin.html:986-989` — 4 KPIs de CxC: `💰`/`🔴`/`⏳`/`✅`
        dentro de `span.inicio-stat-icono` → reemplazados por SVG
        `18×18` `stroke="currentColor"` con la MISMA paleta que Resumen
        financiero: Por cobrar `$` (`M12 1v22…`, `inicio-stat-icono-total`
        azul), Vencidas `circle-x` (`M10 14l2…`, `rechazadas` rojo), Por
        vencer `clock` (`M12 8v4…`, `proceso` ámbar), Cobrado mes
        `check-circle` (`M9 12l2…`, `completadas` verde). Sin clases
        nuevas, sin CSS nuevo en tarjetas.
      - `frontend/admin.html:886-887` — toggle Estado de pago del modal
        Registrar venta: `✅ Pagada`/`⏳ Pendiente de pago` → solo texto
        `Pagada`/`Pendiente de pago` (el `view-toggle-btn.is-active` ya
        comunica estado).
      - `frontend/admin.js:5023-5025` — `iconoFacturado` junto a
        `OC-000001`: `✅` → factura SVG `14×14` (doc con doblez + 2
        líneas, `M14 2H7a2… M14 2v6h6`), `aria-label="Venta facturada"`,
        tooltip intacto.
      - `frontend/admin.js:5030` y `7988` — badges Estado:
        `🔴 Vencida`/`⏳ Pendiente`/`✅ Pagada` → `Vencida`/`Pendiente`/
        `Pagada` solo texto dentro de `estatus-badge
        estatus-cancelado|pendiente|listo` (color ya distingue).
      - `frontend/admin.css:1263` — `.orden-facturado-icono` ahora
        `display:inline-flex; color:var(--color-ink-soft)` para centrar el
        SVG 14px (antes emoji heredaba color, SVG necesita alineación
        explícita).
      - `node --check` limpio en `admin.js`/`server.js`, Jest
        **595/595 (36 suites)** sin regresiones, `docker compose build
        frontend` + `up -d --force-recreate frontend` verificado por HTTP:
        `GET /admin` 200 sin emojis pero con SVG en
        `inicio-stat-icono-total`, `GET /admin.js` con factura SVG y badges
        limpios. `FRONTEND_PORT=8088` conservado. No se tocó esquema/API.

 142. **Importador masivo CSV/XLSX — Segmento 5: motor + API backend
      (2026-08-25, `inventarios.md` §34, decisión D9). IMPLEMENTADO Y
      VALIDADO contra Docker/MySQL/MinIO reales. SIN COMMITEAR TODAVÍA
      (working tree) — pendiente confirmación del usuario para
      commit/push.** Continúa el trabajo de Inventarios (segmentos 1-4 ya
      commiteados y pusheados en sesiones previas: motor de existencias,
      CRUD+kardex, frontend, integración D8 con Ventas). Este segmento es
      SOLO backend — el wizard de 6 pasos del frontend (paso 1 subir → 2
      hoja/vista previa → 3 mapear → 4 validación → 5 ejecutar → 6
      resultado) es el **Segmento 6, siguiente, todavía sin empezar**.
      Antes de implementar: se leyó completo el §34 de `inventarios.md`
      (mapeo en 3 niveles + regla de prioridad 34.3.1, perfiles de mapeo
      guardados 34.3.2, presets de sistema origen 34.3.3, plantilla
      descargable 34.3.4, campo `extra` + guardia anti-prototype-pollution
      34.4, validación completa 34.5, upsert 34.6, existencias iniciales
      34.7, chunks >500 filas 34.8, seguridad/retención/auditoría 34.9,
      API 34.10, modelo de datos 34.11).

      **Archivos nuevos**:
      - `backend/utils/inventarioCampos.js` — catálogo ÚNICO de los 20
        campos importables (campo, obligatorio, sinónimos) + presets de
        sistema origen (`contpaqi`/`aspel`/`excel_generico`/`otro`, como
        reordenamiento del MISMO diccionario, sin sinónimos inventados sin
        verificar). Módulo fuente a propósito para que la página de ayuda
        del Segmento 8 (§56) lo reutilice sin duplicar la lista.
      - `backend/utils/inventarioImportacion.js` — el motor: normalización
        de cabeceras, Levenshtein/similitud, `sugerirMapeoCompleto()`
        (campo-céntrico: recorre CAMPOS_IMPORTABLES, no cabeceras, así "un
        campo recibe a lo más una columna" sale gratis de la estructura),
        `firmaCabeceras()` (hash del set ORDENADO, orden de columnas no
        importa), parseo CSV (`csv-parse`, delimitador autodetectado
        `,`/`;`/tab/`|`, encoding UTF-8 con reintento Latin-1) y XLSX
        (`exceljs`, detección de fila de encabezados por densidad de
        celdas no vacías entre las primeras 10 filas — heurística simple,
        no NLP), `parsearNumeroTolerante()` (coma/punto decimal y de
        miles), `validarFilasImportacion()` (SKU vacío/duplicado, unidad
        desconocida sin crear implícita, existencia negativa, números
        inválidos, guardia `INV_EXTRA_CLAVE_PROHIBIDA`, modo
        tolerante/estricto), `ejecutarFilasImportacion()` (upsert por SKU
        + existencia inicial), CRUD de perfiles de mapeo (coincidencia
        completa Y parcial), `generarPlantillaCSV`/`XLSX` (con validación
        de celda por columna vía `exceljs` dataValidation), `errores.csv`
        con protección OWASP CSV Injection (`protegerCeldaCSV`, apóstrofo
        antes de `= + - @` tab/CR — anticipa §35, reutilizable ahí).
      - `backend/test/unit/inventarioImportacion.test.js` — 39 pruebas
        nuevas (mapeo en 3 niveles, prioridad de perfil, firma
        order-independent, parseo CSV, números tolerantes, validación
        completa, guardia extra, plantilla).

      **Archivos modificados**:
      - `backend/db.js` — 3 tablas nuevas: `imp_importaciones` (una fila
        por corrida, `storage_key` a MinIO, `mapeo_json`, contadores,
        `estado` con CHECK), `imp_importacion_errores` (FK CASCADE),
        `inv_perfiles_mapeo`. `productos.extra` (JSON) ya existía desde el
        segmento 1 (anticipado).
      - `backend/utils/validate.js` — `ALLOWED_IMPORTACION_MIME_TYPES`/
        `_EXTENSIONS` + `esCSVValido()` (rechaza por byte NUL, firma
        binaria real — "nunca confiar en la extensión", §34.9; XLSX
        reutiliza `esZipValido()` ya existente).
      - `backend/server.js` — uploader `uploadImportacion` (multer,
        memoria); helpers `streamABuffer`/`carpetaImportacion`/
        `releerArchivoImportacion` (relee el original desde MinIO en CADA
        llamada a `PUT /mapeo` y `POST /ejecutar` — el archivo archivado
        en §34.9 existe justo para esto, "auditoría y reprocesamiento": ni
        el mapeo ni las filas validadas se duplican en MySQL); 9 rutas
        nuevas bajo `/api/admin/inventarios/importaciones*` +
        `/perfiles-mapeo*` (`requireInventarioActivo`, mismo patrón que el
        resto del módulo). `formatearProducto()` (del segmento 2) ganó el
        campo `extra` en su respuesta — omisión preexistente detectada
        durante la validación de este segmento, no algo que este segmento
        rompiera; se corrigió porque bloqueaba el criterio de aceptación
        "columnas no mapeadas consultables en el detalle del producto".

      **Decisiones de diseño no explícitas en el documento (documentadas
      aquí para que no se rederiven)**:
      1. **Reprocesamiento en vez de persistir filas validadas**: el
         archivo original se relee de MinIO en cada paso (mapeo/ejecutar)
         en vez de guardar las filas parseadas en MySQL — más simple,
         nunca diverge del archivo real, y el §34.9 ya exigía archivar el
         original "para auditoría y reprocesamiento".
      2. **Reintento = reprocesar TODO el set de filas válidas**, sin
         marca de progreso por fila — es naturalmente idempotente (upsert
         por SKU + guardia anti-doble-stock-inicial), así que
         "completa lo faltante" (criterio de aceptación) sale gratis sin
         tracking adicional.
      3. **Atomicidad producto+entrada por COMPENSACIÓN**, no transacción
         SQL única — mismo patrón ya establecido en el segmento 4 (D8
         Ventas): `registrarMovimiento()` abre/cierra su propia
         transacción, así que si falla se revierte el producto a mano
         (DELETE si era nuevo, restaurar snapshot si era un UPDATE).
      4. **"1 importación activa por tenant" se interpreta como
         `estado='ejecutando'` solamente** (no bloquea subir/mapear un
         borrador nuevo mientras otro sigue sin ejecutar) — evita un
         candado permanente si el usuario abandona un borrador con error.
      5. **Categorías SÍ se auto-crean por nombre** durante la ejecución
         (a diferencia de unidades, que el documento prohíbe crear
         implícitas explícitamente) — el documento no lo prohíbe para
         categorías y es el comportamiento esperable de una migración.
      6. **Presets de sistema origen NO inventan sinónimos nuevos** sin
         verificar contra un archivo real de CONTPAQi/Aspel — reordenan el
         MISMO diccionario ya escrito en el documento. Es una limitación
         consciente: la mejora real de auto-mapeo viene del diccionario
         amplio + plantilla + fuzzy match, el preset es solo "ayuda de
         arranque" como el propio documento lo describe.
      7. **Job asíncrono >500 filas**: sin librería de colas — `res.status(202)`
         inmediato + `reanudarContextoTenant(req, fn)` (mismo helper que ya
         resuelve el bug de ALS/multer documentado en el punto 102) para
         que el procesamiento en segundo plano escriba en la BD del
         tenant correcto. **No probado en vivo en esta sesión** (crear un
         CSV de 501+ filas no se justificó dado el tiempo disponible) —
         validado por revisión de código y porque reutiliza la MISMA
         función `ejecutarFilasImportacion()` ya probada en el camino
         síncrono; queda como pendiente de validación en vivo si se
         quiere blindar del todo.

      **Bug real encontrado y corregido en la validación (no visible con
      Jest mockeado)**: `CLAVES_EXTRA_PROHIBIDAS.has(col.normalizada)`
      nunca disparaba para una cabecera literal `__proto__` — la propia
      `normalizarCabecera()` recorta guiones bajos al inicio/fin
      (`"__proto__"` → `"proto"`) ANTES de la comparación, así que la
      clave peligrosa nunca llegaba a coincidir con la lista prohibida.
      Fix: comparación adicional contra una versión ligera
      (`trim().toLowerCase()`, sin el recorte de guiones) guardada como
      `col.claveParaVerificarProhibicion`. Encontrado por un test unitario
      que fallaba (`filasOk` era 1 en vez de 0), no por inspección visual.

      **Validación real contra Docker/MySQL/MinIO (2026-08-25, vía
      `curl`, sesión sin acceso a Claude in Chrome en este tramo)**:
      rebuild `--no-cache` + `force-recreate` backend, `verificar-mysql.js`
      305/305, `verificar-inventario.js` 19/19, Jest backend 693/693 (39
      suites, 39 pruebas nuevas). Smoke test end-to-end real: plantilla
      CSV/XLSX descargada y confirmada (CSV con cabeceras exactas + 2
      ejemplos; XLSX con `dataValidation` por columna); CSV con cabeceras
      en sinónimos + delimitador `;` autodetectado → auto-mapeo 6/6 sin
      intervención manual; plantilla XLSX descargada → auto-mapeo 20/20
      (100%, criterio de aceptación de 34.3.4); perfil de mapeo guardado
      → segunda importación con la MISMA firma llegó pre-mapeada 100%
      (`coincidenciaCompleta:true`) y una tercera con firma DISTINTA pero
      2 columnas en común llegó pre-mapeada PARCIAL
      (`coincidenciaCompleta:false`); ejecución real creó 2 productos con
      existencia/categoría/unidad correctas; **re-importar el MISMO
      archivo NO duplicó stock** (`existencias_iniciales_ignoradas:2`,
      disponible se mantuvo en 15/8, no saltó a 30/16 — criterio de
      aceptación crítico de 34.6 confirmado con datos reales, no solo
      mock); fila con SKU vacío rechazada y visible en `errores.csv`
      exportado; firma binaria falsa (bytes NUL disfrazados de `.csv`)
      rechazada con 400; gate `INV_MODULO_INACTIVO` (403) confirmado con
      el módulo apagado. **Limpieza completa tras la prueba**: productos
      de prueba a papelera (tienen movimientos, no se pueden purgar
      permanentemente — mismo criterio §38 ya documentado), filas de
      `imp_importaciones`/`imp_importacion_errores`/`inv_perfiles_mapeo`
      de prueba borradas por SQL directo, archivos de MinIO bajo
      `_default/inventarios/imports/*` borrados y confirmados en 0,
      `inventario_activo` regresado a `'0'`.

      **Pendiente explícito para la siguiente sesión**: (1) Segmento 6 —
      wizard de 6 pasos en el frontend, todavía sin ningún código; (2)
      validar en vivo el camino asíncrono >500 filas; (3) commit + push
      de este segmento 5 (working tree, sin commitear) — pedir
      confirmación explícita del usuario primero, mismo protocolo
      `addv-web-app`.

      **Actualización — el segmento 5 SÍ se commiteó y pusheó** (commit
      `65c9eec` → `fact/master`) tras confirmación explícita del usuario.
      Ver el punto 143 para el segmento 6 (wizard frontend), completado
      en la misma sesión.

 143. **Importador masivo CSV/XLSX — Segmento 6: wizard de 6 pasos en el
      frontend (2026-08-25, `inventarios.md` §34.2). IMPLEMENTADO Y
      VALIDADO en navegador real de punta a punta.** Continúa el
      Segmento 5 (motor + API, punto 142, ya commiteado en `65c9eec`).

      **Archivos modificados** (sin archivos nuevos — todo dentro de los
      3 archivos ya establecidos del panel admin):
      - `frontend/admin.html` — modal `#inv-importacion-modal-overlay`
        (reusa `.modal-overlay`/`.gastos-modal-header`, patrón ya
        establecido) con indicador de progreso de 6 pasos siempre
        visible (`<ol class="inv-import-progreso">`, a diferencia del
        wizard de Ventas que solo existe en móvil — 34.2 lo pide como
        flujo permanente), botón "Importar catálogo" nuevo en la
        barra de Inventarios.
      - `frontend/admin.css` — `.inv-importacion-modal`/
        `.inv-import-progreso`/`.inv-import-mapeo-tabla`/etc., más
        `.btn-link` (nuevo, genérico — botón de texto sin fondo para
        las plantillas descargables, reusable a futuro) y
        `.estatus-neutro` (badge gris "Sin mapear", falta que tenía la
        familia `.estatus-badge` existente).
      - `frontend/admin.js` — ~650 líneas: `INV_IMPORT_CAMPOS` (catálogo
        de 20 campos duplicado a propósito, mismo criterio que el
        diccionario de categorías de Gastos — backend/frontend no
        comparten build), estado `estadoImport` de todo el wizard,
        `sugerirMapeoCompleto`-consumer (`renderMapeoTablaImport`,
        `manejarCambioMapeoImport` — "un campo recibe a lo más una
        columna" reforzado también en el cliente al reasignar),
        subida multipart (`subirArchivoImport`), validación
        (`validarImportacion`), ejecución con polling cada 2s para el
        camino asíncrono >500 filas (`ejecutarImportacionUI`/
        `pollImportacionEjecucion`), descarga de plantilla/errores
        (mismo patrón fetch+blob+`<a download>` que
        `descargarComprobante()`).
      - `backend/server.js` — pequeño complemento al Segmento 5:
        `PUT .../mapeo` ahora calcula `productosNuevosEstimado`/
        `productosActualizarEstimado` (cuenta SKUs ya existentes) para
        que el paso 5 muestre la confirmación explícita que pide 34.2
        ("Se importarán X productos nuevos y se actualizarán Y
        existentes") antes de ejecutar.

      **2 bugs reales encontrados y corregidos en la validación visual
      (ninguno detectable con `node --check`/Jest mockeado)**:
      1. El botón "Siguiente" no cambiaba de texto al pasar del paso 1
         al 2 — el bloque `finally` de `subirArchivoImport()` restauraba
         el label VIEJO ("Subir y continuar") justo después de que
         `irAPasoImport(2)` ya había puesto el correcto
         ("Continuar al mapeo"), porque `finally` corre después de
         cualquier `return` dentro del `try`. Fix: el `finally` llama a
         `actualizarBotonSiguienteImport()` (que deriva el label del
         paso ACTUAL) en vez de restaurar un texto capturado al inicio
         de la función.
      2. **El upsert por SKU (motor del segmento 5) no revivía productos
         en papelera**: `uq_productos_sku` no distingue `eliminado_en`,
         así que re-importar un SKU que estaba en la papelera SÍ lo
         encontraba y actualizaba sus campos, pero nunca limpiaba
         `eliminado_en` — el producto quedaba con datos frescos pero
         seguía invisible en "Activos". Encontrado al importar dos
         productos de prueba que habían quedado en papelera de una
         sesión anterior: el resultado decía "2 actualizados" pero el
         contador de "Productos activos" no subió. Fix en
         `backend/utils/inventarioImportacion.js`
         (`procesarFilaImportacion`): si `productoExistente.eliminado_en`
         no es null, el UPDATE agrega `eliminado_en = NULL`. Este bug
         vive en el motor del Segmento 5, no en el frontend — se
         corrigió aquí porque solo se hizo evidente al probar el flujo
         completo con datos reales en vez de un archivo siempre-nuevo.

      **Validación real de punta a punta en navegador (Claude in Chrome,
      tras un tramo de la sesión sin conexión — reconectada a petición
      del usuario)**: login → Inventarios → "Importar catálogo" → CSV
      con cabeceras en sinónimos y delimitador `;` real → auto-mapeo
      visible con badges correctos (Reconocido/Exacto) y cobertura
      "3/3 obligatorios · 3/17 opcionales" → validación "2 de 2 fila(s)
      válida(s), sin errores" → confirmación "se importarán 0 nuevos,
      se actualizarán 2 existentes" → ejecución → resultado → **verificado
      por API que los 2 productos salieron de la papelera con su
      existencia intacta (15/8)** tras el fix del bug #2 → consola sin
      errores. **Gotcha de metodología, ya documentado en el proyecto,
      reencontrado aquí**: tras el primer rebuild de `frontend`, el botón
      "Importar catálogo" no existía en el DOM pese a estar en el HTML
      servido — caché de disco del navegador con el HTML viejo,
      `Ctrl+Shift+R` lo resolvió (mismo patrón que puntos 108/117).
      Limpieza tras la prueba: productos de prueba devueltos a papelera,
      `imp_importaciones`/`imp_importacion_errores`/`inv_perfiles_mapeo`
      vaciadas, archivos de MinIO borrados y confirmados en 0,
      `inventario_activo` regresado a `'0'`. Jest backend 693/693,
      `verificar-mysql.js` 305/305, `verificar-inventario.js` 19/19.

      **Nota de UX no bloqueante, no corregida por tiempo**: la barra de
      navegación del wizard (Cancelar/Atrás/Siguiente) no tiene posición
      fija al fondo del modal — en un paso con tabla larga (paso 3, 20
      filas de mapeo) el usuario tiene que hacer scroll hasta el fondo
      del modal para verla, en vez de quedar anclada. Funciona
      correctamente (confirmado con clics reales), solo no es la
      experiencia ideal — candidato a pulido visual futuro con su propia
      propuesta antes/después, no se tocó en este segmento.

      **Con esto, el segmento "Importador masivo CSV/XLSX" (§34 completo:
      motor, API y wizard) queda funcionalmente completo**, salvo: (1) el
      camino asíncrono >500 filas nunca se probó en vivo (solo por
      revisión de código, ver punto 142), y (2) la página de ayuda §56
      (Segmento 8, diccionario de datos) sigue sin código.

      **Actualización — el segmento 6 SÍ se commiteó y pusheó** (commit
      `d813206` → `fact/master`) tras confirmación explícita. Ver el
      punto 144 para el Segmento 8 (página de ayuda §56).

 144. **Segmento 8 — Ayuda y diccionario de datos de Inventarios
      (2026-08-25, `inventarios.md` §56). IMPLEMENTADO Y VALIDADO en
      navegador real.** Cierra el plan original de `inventarios.md`
      salvo la validación en vivo del camino asíncrono >500 filas (punto
      142) — no bloqueante, documentado como pendiente.

      **2 desviaciones de diseño confirmadas con el usuario ANTES de
      implementar** (protocolo `addv-web-app`, pregunta explícita):
      1. El doc pide una página con ruta propia
         (`/<slug>/admin/inventarios/ayuda`). Este panel admin es un SPA
         de un solo HTML sin ruteo real (todas las vistas son divs que
         se muestran/ocultan) — se implementó como **modal** en vez de
         vista/ruta, mismo patrón que el resto del panel, sin tocar
         nginx. El deep-linking (`#campo-sku`) se resuelve con scroll +
         foco dentro del modal, no con un fragmento de URL real.
      2. De los 3 puntos de entrada del doc (sidebar, ícono `?` en el
         wizard, tooltip en "Crear producto"), se implementaron **solo
         los 2 primeros** — el tercero (20 tooltips más en un formulario
         ya construido) queda pendiente, valor menor frente a los otros
         dos.

      **Archivos modificados** (sin archivos nuevos en backend — todo
      dentro de `inventarioCampos.js`, ya existente desde el segmento 5):
      - `backend/utils/inventarioCampos.js` — cada uno de los 20 campos
        de `CAMPOS_IMPORTABLES` ganó `etiqueta`/`explicacion_simple`/
        `ejemplo_valido`/`ejemplo_invalido_comun` (los 3 campos
        exclusivos de la ayuda que pide §56.1, sobre los metadatos
        técnicos que ya usaba el wizard). Array nuevo `CONCEPTOS_AYUDA`
        (10 entradas) para los conceptos operativos de los grupos 2 y 3
        de §56.3 que NO son columnas mapeables (existencia disponible,
        historial de movimientos, entrada, salida, ajuste, costo
        promedio, fila de encabezados, mapeo de cabeceras, datos extra,
        perfil de mapeo guardado) — separado a propósito de
        `CAMPOS_IMPORTABLES` para no complicar `sugerirMapeoCompleto()`
        con conceptos que el wizard de mapeo no necesita. Función nueva
        `obtenerDiccionarioInventario()` combina ambos arreglos con un
        `id`/`grupo` uniforme (ancla estable `#campo-<id>`, §56.4
        "deep-linking real"). `costo_promedio` se agregó como concepto
        propio (no solo sinónimo) para que el ejemplo literal del doc
        ("buscar 'costo' encuentra costo, costo_unitario, costo_promedio
        y ultimo_costo") funcione — costo_unitario/ultimo_costo viven
        como sinónimos DENTRO de la tarjeta "costo" (no son tarjetas
        aparte), así que buscar "costo" devuelve 2 tarjetas relevantes
        (costo, costo_promedio), no 4 — decisión de diseño razonada, no
        un déficit: el usuario ve los 4 términos igual, 2 como tarjetas
        y 2 como sinónimos listados dentro de la tarjeta "costo".
      - `backend/server.js` — `GET /api/admin/inventarios/diccionario`
        (sin `requireInventarioActivo` a propósito, mismo criterio que
        `/configuracion` — ayuda a entender el módulo antes de
        activarlo; no depende del tenant, cacheable en el cliente).
      - `backend/test/unit/inventarioCampos.test.js` (nuevo) — 9 pruebas:
        metadatos completos en los 20 campos y los 10 conceptos, el
        criterio de aceptación literal de §56.6 ("todo campo mapeable
        tiene su tarjeta, verificado contra la misma fuente, no a
        mano"), sin ids duplicados, y el caso de búsqueda "costo".
      - `frontend/admin.html` — modal `#inv-ayuda-modal-overlay` (buscador,
        tabla de contenido sticky en escritorio/`<select>` de salto en
        móvil — mismo breakpoint 900px que el resto del panel, lección de
        los puntos 128/131), botón "?" nuevo en la barra de Inventarios
        (entrada 1), botón "?" agregado dinámicamente en cada fila del
        wizard de mapeo (entrada 2, `frontend/admin.js`).
      - `frontend/admin.css` — `.inv-ayuda-*` (modal, tarjetas, TOC
        sticky, badges Obligatorio/Opcional reusando `.estatus-badge`
        existente — "nunca un color inventado", §56.4) y
        `.inv-import-mapeo-ayuda` (el círculo "?" por fila del wizard).
      - `frontend/admin.js` — `obtenerDiccionarioInv()` (fetch +
        cache en memoria de la sesión de pestaña), `renderAyudaInventario()`
        (agrupa por catalogo/existencias/importacion), `filtrarAyudaInventario()`
        (búsqueda client-side sobre un `data-buscable` precalculado por
        tarjeta — etiqueta + explicación + sinónimos, coincidencia
        parcial), `abrirAyudaInventario(anclaId)` (abre el modal ENCIMA
        de cualquier otro modal abierto sin cerrarlo — scroll + foco +
        resaltado temporal de 2s a la tarjeta, respeta
        `prefers-reduced-motion`).

      **Validado en navegador real (Claude in Chrome)**: `GET
      /diccionario` por API confirma 30 entradas (20 catálogo + 10
      conceptos) en 3 grupos; modal abierto desde el sidebar muestra las
      3 secciones con tarjetas completas (badge Obligatorio, ✓/✗,
      sinónimos reconocidos); buscador "costo" → "2 resultado(s)"
      correctos; **el ícono "?" de la fila "SKU" dentro del wizard de
      importación (paso 3, en curso) abrió el modal de ayuda ENCIMA del
      wizard sin cerrarlo, con scroll automático a la tarjeta "SKU /
      Clave"** — al cerrar la ayuda, el wizard seguía exactamente en el
      mismo paso 3 con el archivo ya subido, confirmando §56.4 "nunca
      bloquea el flujo de trabajo". Consola sin errores. Jest backend
      **702/702 (41 suites)**, `verificar-mysql.js` 305/305. Limpieza:
      fila de importación de prueba (subida hasta el paso 3, nunca
      ejecutada) borrada de `imp_importaciones` + MinIO,
      `inventario_activo` regresado a `'0'`.

      **Con esto, el plan completo de `inventarios.md` (segmentos 1-8)
      queda funcionalmente terminado.** Pendiente real, no bloqueante:
      (1) el camino asíncrono >500 filas del importador nunca se probó
      en vivo (punto 142), y (2) tooltips de ayuda en el formulario
      "Crear producto" (entrada 3 de §56.2, deliberadamente pospuesta).
      Sin commitear al cierre de este punto — pedir confirmación
      explícita antes de commit/push, mismo protocolo `addv-web-app`.

 145. **Tooltips de "Resumen financiero" pasados al componente estilizado
      del panel (2026-08-25, IMPLEMENTADO Y VALIDADO)**: a pedido del
      usuario ("los tooltips de resumen financiero siguen simples, no
      como los de tickets o constancias") — 3 puntos usaban el tooltip
      NATIVO del navegador (globo gris sin estilo) en vez del componente
      `.tooltip-personalizado` ya establecido (`inicializarTooltips()`,
      activado por el atributo `data-tooltip`, usado en el resto del
      panel desde antes de este segmento): los puntos de la gráfica
      "Balance acumulado" y "Proyección de ventas" (`<title>` SVG hijo
      del `<circle>`) y el nombre de proveedor truncado en "Top
      proveedores de gasto" (atributo `title` HTML). Fix: se reemplazan
      los 3 por `data-tooltip` en `frontend/admin.js`
      (`renderResumenFinUtilidadMensual`/`renderResumenFinProyeccion`/
      `renderResumenFinProveedores`); el nombre de proveedor gana
      `tabindex="0"` para que también sea alcanzable por teclado (el
      sistema de tooltips ya escucha `focusin`/`focusout`, no solo
      mouse). Cero cambios de backend. Validado en navegador real: el
      atributo `data-tooltip` se genera con el texto correcto y, al
      disparar el hover, aparece el mismo globo oscuro estilizado que ya
      usan Tickets/Constancias (confirmado visualmente sobre "Prestaciones
      de per..." → "Prestaciones de personal"). Jest backend 702/702
      (sin cambios, segmento 100% frontend). Sin commitear.

 146. **Validación en vivo del camino asíncrono >500 filas del importador
      (2026-08-25, cierra el pendiente del punto 142)**: CSV real de 520
      filas (`sku,nombre,unidad_base,precio,existencia_inicial`, 100%
      mapeo exacto) subido y ejecutado contra Docker/MySQL/MinIO reales
      por API. `POST .../ejecutar` respondió **202 Accepted** con
      `estado:"ejecutando"` de inmediato (no bloqueó la petición); el
      primer poll de `GET .../:id` (2s después) ya mostró
      `estado:"completada", progreso:100` — el job en segundo plano
      (`reanudarContextoTenant` + `ejecutarFilasImportacion`) procesó las
      520 filas en menos de 2 segundos. Verificado contra MySQL real con
      SQL directo: **520 productos creados, 494 movimientos de tipo
      "inventario_inicial"** (las 26 filas con `existencia_inicial=0`,
      múltiplos de 20 en el generador de datos, correctamente NO generan
      movimiento — regla ya existente, confirmada aquí con datos reales)
      y **suma total de existencias = 4940**, que coincide exactamente
      con la suma matemática esperada (26 bloques de 0+1+...+19=190 cada
      uno). Sin bugs encontrados — el diseño del segmento 5 (job
      asíncrono vía `res.status(202)` + reentrada al contexto del tenant)
      se sostuvo tal cual bajo carga real. Limpieza: 520 productos + sus
      movimientos/existencias borrados por SQL directo (tenían
      movimientos, no elegibles para el borrado permanente normal del
      panel — §38), `imp_importaciones` vaciada, MinIO confirmado en 0,
      `inventario_activo` regresado a `'0'`. `verificar-mysql.js`
      305/305, `verificar-inventario.js` 19/19.

      **Con esto, el único pendiente real que quedaba del plan de
      `inventarios.md` (segmentos 1-8) es la entrada 3 de §56.2 (tooltips
      en "Crear producto"), deliberadamente pospuesta.** Ver el punto
      147: se implementó a pedido del usuario el mismo día.

 147. **Entrada 3 de §56.2 — tooltips en "Crear producto" (2026-08-25,
      IMPLEMENTADO Y VALIDADO)**: a pedido explícito del usuario, cierra
      el último pendiente del plan de `inventarios.md`. Los 14 campos
      del formulario "Crear/Editar producto" (Tipo, Nombre, SKU, Código
      de barras, Categoría, Unidad de medida, Costo, Precio, Stock
      mínimo/máximo, Punto de reorden, Estado, Proveedor principal,
      Notas) ganan un ícono "?" junto a su etiqueta — reusa el MISMO
      componente ya construido para el wizard de importación (segmento
      8, entrada 2), renombrado de `.inv-import-mapeo-ayuda` a
      `.inv-campo-ayuda` (genérico, ya no es solo del wizard) en
      `frontend/admin.css`/`admin.js`. Consolida en un solo control las
      2 conductas que pide el doc por separado ("tooltip corto" +
      "enlace Ver más"): hover muestra `explicacion_simple` vía
      `data-tooltip` (mismo componente estilizado del punto 145), click
      abre la ayuda completa en esa ancla sin cerrar el formulario en
      curso — mismo patrón "apilar modal sobre modal" ya validado en el
      wizard. Función nueva `aplicarTooltipsCampoAyuda(raiz)` (genérica,
      recibe cualquier contenedor) puebla los `data-tooltip` desde el
      diccionario cacheado — se llama tanto en `abrirProductoModal()`
      como en `renderMapeoTablaImport()` (el wizard ganó de regalo el
      mismo hover corto que antes solo tenía el click). Sin cambios de
      backend ni de esquema. Validado en navegador real: los 14 íconos
      visibles con su tooltip poblado correctamente (confirmado con SKU:
      texto completo de `explicacion_simple`); click en el ícono de SKU
      abrió la ayuda ENCIMA del formulario "Nuevo producto" sin cerrarlo
      (formulario intacto al cerrar la ayuda, campo Nombre conservó su
      valor). Consola sin errores. Jest backend 702/702 (sin cambios).
      **Con esto, el plan completo de `inventarios.md` (segmentos 1-8,
      incluidas las 3 entradas de §56.2) queda 100% implementado y
      validado.**

 148. **Unificación de TODOS los tooltips del sitio (2026-08-25,
      IMPLEMENTADO Y VALIDADO)**: a pedido explícito del usuario tras el
      fix puntual del punto 145 ("quiero que revises los tooltips de
      resumen financiero y de TODO el sitio... que no se vea sencillo"),
      auditoría completa de `frontend/*.html`/`*.js` y `control/`
      (excluyendo `node_modules`) buscando cualquier tooltip nativo del
      navegador (atributo `title`) o cualquier componente de tooltip
      DISTINTO al estilizado `.tooltip-personalizado`/`data-tooltip` ya
      establecido (`inicializarTooltips()`, definido en paralelo en
      `admin.js` y `portal.js` — este último ya usado correctamente por
      Tickets/Constancias/Dashboard desde antes, confirmado sin cambios).

      **9 spots reales encontrados y corregidos** (más allá de los 3 ya
      arreglados en el punto 145), todos en `admin.js`/`admin.html`:
      - Gráfica "Ventas vs Facturado vs Gastos": las 4 barras (Ventas/
        Gastos/Facturado/Sin facturar) usaban `title` nativo.
      - Tarjeta "Utilidad neta del mes": los 3 segmentos apilados (IVA/
        Subtotal/Gastos) usaban `title` nativo.
      - "Eliminados por mes" (vista Lectura de reportes): la barra usaba
        `title` nativo.
      - Celda de vista previa del wizard de importación
        (`.inv-import-mapeo-preview`, columna truncada): `title` nativo.
      - Botón "Verificar integridad" (Inventarios) y botón de abrir la
        ayuda (Inventarios): `title` nativo, redundante con su
        `aria-label`.
      - **Los 15 íconos "?" ya construidos en los puntos 144/147**
        (wizard + "Crear producto") tenían un bug sutil: llevaban A LA
        VEZ `title="Ver ayuda de este campo"` (nativo, genérico) Y
        `data-tooltip` (estilizado, poblado dinámicamente con la
        explicación real) — el navegador podía mostrar el globo GRIS
        nativo antes de que el JS aplicara el estilizado, o ambos en
        conflicto. Se quitó el `title` duplicado; el `aria-label` ya
        cubre accesibilidad.

      **Segundo componente de tooltip completamente distinto,
      encontrado y consolidado**: `.tooltip-trigger`/`.tooltip-popover`
      en `style.css` — un sistema CSS-puro (con `:hover`/`:focus-visible`
      + una clase `.is-active` alternada por JS para "tocar" en móvil),
      visualmente parecido (burbuja oscura con flecha) pero
      IMPLEMENTADO DISTINTO y usado en un solo lugar de todo el sitio:
      el ícono de información junto a "Correo de quien va a facturar"
      (Configuraciones globales → SMTP). Consolidado al mismo componente
      `data-tooltip` (reutilizando el ícono "?" ya construido,
      renombrado de `.inv-campo-ayuda` a `.campo-ayuda` — genérico,
      movido de `admin.css` a `style.css` por ser compartido entre
      Inventarios y Configuraciones globales). El toggle táctil a mano
      (11 líneas de JS en `admin.js`) se volvió código muerto y se
      eliminó — el sistema unificado ya cubre `focusin`/`focusout`
      (un tap en un `<button>` dispara foco en la gran mayoría de
      navegadores móviles), cubriendo el mismo caso sin JS dedicado.
      El bloque CSS viejo (~65 líneas) se reemplazó por el
      `.campo-ayuda` compartido.

      **2 spots verificados como correctos y sin tocar** (comentario
      desactualizado nada más, código ya migrado antes de esta sesión):
      `.orden-facturado-icono` (ícono de venta facturada) y
      `.orden-correo-con-tooltip` (celda de correo en Ventas) ya usaban
      `data-tooltip` — solo el comentario en `admin.css` seguía diciendo
      "tooltip nativo del navegador", corregido para reflejar la
      realidad.

      **1 uso de `title` dejado intacto a propósito**: el `<iframe>` de
      vista previa de documentos (`#preview-frame`) — es metadata de
      accesibilidad para lectores de pantalla (describe el propósito del
      iframe embebido), no un tooltip visual al pasar el mouse; no aplica
      el mismo criterio.

      Validado en navegador real: el ícono de "Correo de quien va a
      facturar" muestra el mismo globo oscuro estilizado que el resto
      del sitio (antes era un popover blanco con flecha, visualmente
      distinto); las barras de "Ventas vs Facturado vs Gastos" y
      "Eliminados por mes" (Lectura de reportes) confirmadas con
      `data-tooltip` poblado correctamente por API/DOM. Consola sin
      errores en todo el recorrido. Balance de `<div>`/`<button>`/
      `<label>` y llaves CSS verificado en los 3 archivos tocados
      (`admin.html`/`admin.css`/`style.css`). Jest backend 702/702 (sin
      cambios, segmento 100% frontend). Con esto, **todo tooltip visible
      del sitio (panel admin + portal de cliente) usa exactamente el
      mismo componente estilizado, sin excepción documentada.**
      **Commiteado y pusheado** (`f88a429` → `fact/master`).

 149. **3 rediseños de UI en la vista "Usuarios"/"Configuraciones
      globales" (2026-08-25, a pedido explícito del usuario, con
      propuesta visual — Artifacts — para los 2 primeros antes de
      implementar; el 3ro llegó con instrucción directa + captura
      anotada). Cero cambios de backend en los 3.**

      1. **"Habilitar Ventas" e "Inventario activo" se mueven de
         "Usuarios" a "Configuraciones globales"** (propuesta previa vía
         Artifact, aprobada al pedir "muévelo... falta mover el modal de
         inventarios y ventas... sigue respetando sus roles de acceso").
         Mismos ids (`ordenes-toggle-card`/`inv-toggle-card`,
         `config-ordenes-habilitado`/`config-inventario-activo`) — pura
         reubicación de HTML, cero cambio de lógica de guardado/API.
         Acceso: se agregaron ambos ids a
         `administrador.tarjetasConfigPermitidas` y a la lista de "6
         tarjetas" gateadas en `aplicarRestriccionesPerfil()`
         (`admin.js`) — **Fiscal sigue sin verlas** (su array no se
         tocó), Super/admin-fallback las ve como siempre
         (`sinRestricciones`). "Configuraciones globales" pasa de 4 a 6
         tarjetas (3 filas parejas, sin huérfana). "Usuarios" queda solo
         con "Cuenta de respaldo admin" — se quitó la cuadrícula
         `.usuarios-tarjetas-compactas` (ya no tenía sentido con un solo
         elemento adentro).
      2. **"Perfiles y roles de acceso" pasa de tarjeta acordeón de
         ancho completo a un ícono junto al conteo de usuarios que abre
         la misma tabla en una ventana emergente** (instrucción directa
         del usuario con captura anotada, reemplaza una propuesta previa
         de badge "Solo lectura" que quedó descartada). Nuevo botón
         `#btn-perfiles-acceso-abrir` (ícono, `data-tooltip`) junto a
         `#usuarios-count`; nuevo modal `#perfiles-acceso-overlay`
         (`.gastos-modal .gastos-detalle-modal`, 760px) con el mismo
         contenido/tabla de siempre. Sigue siendo visible solo para el
         usuario `"admin"` exacto (`esUsuarioAdminExacto`, sin cambios en
         esa regla).
      3. **Modal "Crear usuario" rediseñado en 2 columnas, mismo patrón
         que "Gestionar ticket"** (`.ticket-modal`, 820px) — pasa de
         `max-width:380px` en una sola columna larga a
         `.ticket-modal-main` (Perfil/RFC/Correo/Teléfono) +
         `.ticket-modal-sidebar` (tarjeta "Contraseña": generar
         automática, campo+reglas, forzar cambio). Gana un botón de
         cierre "✕" en el header que no tenía antes (mismo patrón que el
         resto de modales de este estilo). Mismos ids en todos los
         campos — cero cambio de la lógica de validación/envío.

      **Validado en navegador real las 3** (Claude in Chrome — los
      screenshots fallaron un tramo de la sesión por un bug de la
      extensión, `window.innerWidth` reportaba 0, resuelto solo tras
      recargar): "Usuarios" con una sola tarjeta limpia, "Configuraciones
      globales" con 6 tarjetas en 3 filas parejas, el ícono de perfiles
      abre el modal con la tabla completa, "Crear usuario" en 2 columnas
      con "Generar automática" funcionando en la barra lateral angosta.
      Consola sin errores en los 3. Jest backend 702/702 (sin cambios).
      **Nota de infraestructura, no relacionada con el código**: un
      `docker compose up` de rutina chocó con el puerto 9001 porque OTRO
      proyecto del mismo servidor (`appprestamos-minio`) ya lo tenía
      tomado — se resolvió con `--no-deps` en vez de tocar el contenedor
      ajeno; MinIO de este proyecto no se necesitaba para validar estos
      3 cambios (ninguno toca almacenamiento de archivos). Sin
      commitear — pedir confirmación explícita antes de commit/push,
      mismo protocolo `addv-web-app`.

150. **3 pendientes de funcionalidad registrados — SOLO ANOTADOS, sin
     analizar ni implementar (2026-08-25)**:
     - **Tipo de cambio para productos en moneda extranjera
       (Inventarios)**: el usuario pidió poder activar/desactivar el uso
       de tipo de cambio para aplicar a los productos, con histórico de
       cada tipo de cambio usado desde que el producto entró al
       inventario por primera vez (para poder reconstruir el costo real
       en pesos de cualquier entrada pasada). Documentado a detalle,
       con las preguntas de diseño todavía abiertas (alcance del
       interruptor, fuente del tipo de cambio, relación con el costeo
       promedio ponderado D5), en `inventarios.md` **§57** y en la tabla
       de pendientes §0.4.1 de ese mismo documento — ahí vive el detalle
       completo, este punto es solo el puntero.
     - **Regla de negocio: una Cuenta por Cobrar (venta con
       `estado_pago='pendiente'`) no se debería poder facturar todavía**
       — el usuario señaló que hoy no existe esa validación. Sin
       analizar el alcance exacto (¿bloquear el botón de facturar en la
       UI, o también en el backend? ¿aplica a `estado_pago='pendiente'`
       solamente o también a "vencida"? ¿qué mensaje ve el admin al
       intentarlo?) ni dónde vive hoy el flujo de "facturar" una venta
       para saber qué tocar exactamente. Pendiente de una ronda de
       Analizar → Proponer → Confirmar antes de tocar código, mismo
       protocolo `addv-web-app`. Relacionado con Cuentas por Cobrar,
       puntos 138/141 de este mismo archivo.
     - **Asociar tenants como sucursales de un mismo negocio, con
       usuarios de acceso compartidos** — surgió al madurar el
       requerimiento de "Ventas con inventario activo" (propuesta v2,
       mismo día): el catálogo cifrado local para vender offline asume
       una sola tienda activa; varias tiendas del mismo negocio se dan
       de alta como tenants separados (sin mezclar inventario/BD), y
       ahora se pide poder asociarlos entre sí para que el mismo usuario
       inicie sesión en todas las sucursales asociadas. Choca con el
       aislamiento por tenant ya establecido (BD/credenciales/pool
       separados) — preguntas de diseño abiertas documentadas en
       `inventarios.md` **§58** (qué significa "asociar" en términos de
       datos, dónde vive el usuario compartido, alcance de la
       auditoría cruzada, quién puede asociar/desasociar). Sin analizar
       a fondo, mismo protocolo `addv-web-app`.

151. **"Ventas con inventario activo v2" — Segmento A (varias líneas de
     inventario por venta), CÓDIGO COMPLETO, tests 707/707, VALIDACIÓN
     CONTRA DOCKER REAL INTERRUMPIDA por un problema de infraestructura
     no relacionado (2026-08-25/26)**. Contexto: se maduró con el usuario
     el requerimiento de unificar el bloque manual y el vínculo de
     inventario del modal "Registrar venta" (propuesta con 2 rondas,
     Artifact `propuesta-ventas-inventario.html` con antes/después) — el
     usuario decidió explícitamente (1) permitir **varias** líneas de
     inventario por venta (reabre P1, antes "línea única") y (2) para el
     modo offline con inventario, una idea nueva de catálogo cifrado en
     local (Segmento B, todavía sin tocar, depende de que A exista
     primero). Este punto documenta el estado de **Segmento A solamente**.

     **Backend**:
     - Tabla nueva `orden_productos` (`backend/db.js`, junto al bloque
       `producto_id`/`producto_cantidad` de `ordenes_compra`): una fila
       por producto de INVENTARIO vinculado a una venta —
       `orden_id, producto_id, cantidad, creado_en`. Sin
       `CONSTRAINT FOREIGN KEY` (mismo criterio ya usado ahí: `productos`
       se crea después en el mismo `ensureSchema()`). Las columnas
       legacy `ordenes_compra.producto_id`/`producto_cantidad` NO se
       borran ni se migran — quedan congeladas para el historial de
       ventas de una sola línea y ya no se vuelven a escribir. Las
       líneas MANUALES (sin producto de catálogo) siguen sin guardarse
       estructuradas, igual que siempre — solo viven en el texto de
       `concepto` (decisión deliberada para no ampliar el alcance del
       segmento: la propuesta original sugería una tabla que también
       guardara líneas manuales, se simplificó a solo lo que necesita
       trazabilidad de stock real).
     - `POST /api/admin/ordenes-compra` (`backend/server.js`): acepta el
       campo NUEVO `productos_inventario` (array `[{producto_id,
       cantidad}]`) — si llega y tiene al menos 1 elemento, manda sobre
       los campos legacy `producto_id`/`producto_cantidad` (que se dejan
       en `NULL` para esa venta). Si NO llega, el código legacy de una
       sola línea sigue exactamente igual (cero riesgo de regresión,
       los tests viejos de `producto_id` singular no se tocaron).
       Valida: producto entero, cantidad > 0, máximo 50 líneas, mismo
       producto no puede repetirse en 2 líneas de la misma venta.
       Descuento de stock: `registrarMovimiento()` abre su propia
       transacción POR LÍNEA (no hay transacción compartida entre
       productos distintos — no se tocó ese motor, es compartido con
       Inventarios §0.5 y está fuera del alcance de este segmento);
       "todo o nada" se logra a mano — si la línea N falla (sin stock),
       se revierten con un compensatorio `devolucion_cliente` las líneas
       1..N-1 que sí alcanzaron a descontarse (mismo patrón que ya usa
       "eliminar venta" desde D8) y se borra la fila de la venta.
     - `GET /api/admin/ordenes-compra`: segunda consulta (`orden_productos`
       LEFT JOIN `productos`) agrupada en JS por `orden_id`, expuesta
       como `productos_inventario: [{producto_id, cantidad, sku,
       nombre}]` en cada fila — SQL crudo simple, sin `JSON_ARRAYAGG`
       (mismo criterio del resto del proyecto).
     - `DELETE /api/admin/ordenes-compra/:id`: el reingreso automático
       existente (columna legacy) se mantiene intacto; se agregó un
       segundo bloque que recorre `orden_productos` y reingresa cada
       línea con el mismo patrón `devolucion_cliente` — si cualquier
       línea no se puede reingresar, la venta NO se borra (409), igual
       que el caso legacy. `orden_productos` se limpia con un
       `DELETE ... WHERE orden_id = ?` antes del `DELETE` final de la
       venta.
     - **Tests nuevos** en `backend/test/integration/ordenes-compra.test.js`
       (11 casos): POST con 2 líneas (éxito), POST todo-o-nada (2da
       línea sin stock → revierte la 1ra y borra la venta), POST
       producto repetido (400 sin tocar inventario), GET con
       `productos_inventario`, DELETE con varias líneas (reingresa cada
       una). Los 3 tests DELETE legacy que llegan hasta el `DELETE`
       final se actualizaron para mockear las 2 consultas nuevas
       (`SELECT`/`DELETE` de `orden_productos`) que ahora corren siempre
       — sin esto habrían quedado rotos por el cambio, no por un bug.

     **Frontend** (`frontend/admin.html`/`admin.js`/`admin.css`): el
     bloque manual (Concepto/Precio/Cantidad) ahora tiene
     `id="orden-productos-captura-manual"` y se OCULTA POR COMPLETO
     cuando Inventarios está activo (`aplicarVisibilidadInventarioEnVentas()`,
     ya no coexisten); el bloque de inventario ganó un campo "Precio
     unitario" nuevo (autocompletado desde el catálogo al seleccionar,
     editable, badge "AUTO") y "Unidades vendidas" se renombró a
     "Cantidad (piezas)" + botón "+ Agregar producto" propio. Cada
     producto agregado cae en la MISMA lista/tabla que antes solo recibía
     líneas manuales (`productosOrdenActual` en `admin.js`, con un campo
     nuevo `producto_id` en el objeto de línea) — se reutilizó
     `recalcularOrdenDesdeProductos()`/`textoProductoOrden()` sin
     tocarlos, solo se agregó un badge "Inventario" (`.line-badge-inv`)
     junto al nombre en las líneas que vienen del catálogo. Un mismo
     producto no se puede agregar 2 veces (mismo criterio que el
     backend, error inline). El envío ahora manda
     `productos_inventario` (array) en vez de los campos legacy
     singulares. El bloqueo de modo offline con inventario vinculado
     (punto 132) se preservó tal cual, solo migrado a revisar la lista
     completa (`productosOrdenActual.some(p => p.producto_id)`) en vez
     de una sola variable — sigue sin poder encolarse offline una venta
     con producto de inventario (eso es exactamente lo que resuelve el
     Segmento B, todavía no implementado).

     **Verificación hecha**: `node --check` limpio en los 3 `.js`
     tocados, CSS balanceado (807/807 llaves), **Jest backend 707/707
     (40 suites)** — sin regresiones en el resto de la suite.

     **Verificación INTERRUMPIDA (pendiente para la próxima sesión)**:
     se rehicieron las imágenes (`docker compose build backend frontend`)
     y al recrear los contenedores, `ensureSchema()` corrió limpio contra
     MySQL real (log: "Esquema de MySQL listo" — confirma que la tabla
     `orden_productos` se creó bien), PERO el backend quedó en ciclo de
     reinicio con `Error: getaddrinfo ENOTFOUND minio`. Diagnóstico:
     **no es un bug de este segmento** — el contenedor `pfacturacion-minio`
     tiene fecha de creación 2026-08-20 (mucho antes de esta sesión) y
     quedó con `NetworkMode` legacy apuntando al nombre de red en vez de
     estar conectado como el resto de contenedores
     (`docker network inspect portalfac_fiscal-net` no lo lista entre
     sus miembros, aunque `docker compose ps`/`docker ps` lo reportan
     "healthy" — el propio MinIO responde, pero no está en la red donde
     el backend lo busca por nombre DNS). Deriva/drift de infraestructura
     preexistente, no causado por ningún cambio de código de esta
     sesión (Segmento A no toca `storage.js` ni MinIO en absoluto).
     **Siguiente paso concreto para retomar**: `docker compose rm -sf
     minio` (con el servicio detenido primero, para no perder el volumen
     con nombre `minio_data` que persiste aparte) y
     `docker compose up -d minio` para que Compose lo recree con la
     red correcta; si con eso no basta, revisar si quedó algún
     `docker run` manual viejo por fuera de compose para ese nombre de
     contenedor. Una vez el backend arranque sano (`curl
     http://localhost:8088/api/health` → 200), falta la validación real
     pendiente: POST con `productos_inventario` de 2+ líneas (caso éxito
     y caso todo-o-nada), GET mostrando el array, DELETE con reingreso
     multi-línea, y la prueba en navegador real del modal "Registrar
     venta" ya unificado (bloque manual oculto con inventario activo,
     buscador con precio auto-completado, botón "+ Agregar producto",
     badge "Inventario" en la tabla).

     **Sin commit/push todavía** — pedir confirmación explícita antes,
     mismo protocolo `addv-web-app`. **Segmento B** (catálogo cifrado en
     local para vender offline con inventario activo) sigue sin
     empezar, correctamente secuenciado después de A. Los 2 pendientes
     de arquitectura que surgieron de esta misma conversación (tipo de
     cambio §57, asociar tenants como sucursales §58) ya quedaron
     registrados en el punto 150 de este mismo archivo y en
     `inventarios.md` — no requieren nada más en este cierre.

152. **Tipo de cambio para productos en moneda extranjera — §57,
     IMPLEMENTADO (2026-08-26)**: retomado el pendiente del punto 150 —
     4 preguntas cerradas vía cuestionario (alcance por producto, fuente
     automática con sobreescritura, solo USD, histórico dentro de
     `movimientos_inventario`) y confirmado explícitamente por el
     usuario ("Sí, implementa todo el segmento"), protocolo
     `addv-web-app` completo.
     - **Esquema**: `productos.moneda` VARCHAR(3) NOT NULL DEFAULT
       'MXN' + CHECK; `movimientos_inventario.moneda_original`/
       `.tipo_cambio`/`.costo_original` (las 3 nullable) + CHECK.
     - **Backend**: `backend/utils/tipoCambio.js` nuevo —
       `obtenerTipoCambioUSD()` contra Banxico SIE (serie `SF43718`,
       requiere `BANXICO_TOKEN` en `.env`, gratis), caché en memoria
       por fecha, nunca lanza — sin token o con el servicio caído
       degrada a `fuente: 'manual_requerido'`/`'banxico_caducado'`, el
       usuario captura a mano sin que nada se bloquee.
       `registrarMovimiento()` (`utils/inventario.js`) acepta
       `costoOriginal`/`tipoCambio` — valida forma ANTES de abrir la
       transacción (mismo criterio que el resto de la función, para no
       romper el contrato "sin tocar la BD" que ya probaban los tests
       existentes), decide DENTRO de la transacción cuál costo aplica
       según la moneda REAL del producto ya con la fila bloqueada, y
       calcula `costo = costoOriginal × tipoCambio` — error nuevo
       `INV_TIPO_CAMBIO_INVALIDO`. Endpoint nuevo
       `GET /api/admin/tipo-cambio/usd`; `POST/PUT /productos`
       aceptan/devuelven `moneda`; `POST /entradas` acepta
       `costo_original`/`tipo_cambio`; kardex expone las 3 columnas
       nuevas.
     - **Frontend**: selector "Moneda" en "Crear/editar producto"; en
       el modal de movimiento, un producto USD con dirección entrada
       sustituye "Costo unitario (MXN)" por "Costo en USD" + "Tipo de
       cambio" (precargado del día, editable, vista previa "= $X MXN"
       en vivo); historial de movimientos muestra el costo con tooltip
       de desglose USD × TC = MXN cuando aplica (componente unificado
       del sitio, punto 148).
     - **Diccionario de datos (§56)**: 3 tarjetas nuevas (`moneda`,
       `tipo_cambio`, `costo_original`), grupo nuevo "Moneda
       extranjera" — fuera de `CAMPOS_IMPORTABLES` a propósito (el
       importador masivo §34 sigue MXN-only, decisión de alcance
       explícita), pero con el mismo ícono `?` en los formularios.
     - **Pruebas**: Jest backend **716/716**. Nuevos: validación de
       forma de `costoOriginal`/`tipoCambio` sin tocar la BD, conversión
       USD→MXN en el camino feliz (+ caso "producto MXN ignora esos
       campos si llegaran por error"), y suite completa de
       `tipoCambio.js` (sin token, respuesta válida con caché, HTTP
       no-ok, "N/E" sin dato publicado el fin de semana, caché vencido
       de un día para otro → `banxico_caducado`, con `jest.setSystemTime`).
     - **Commiteado y pusheado** (`2245311` → `fact/master`, junto con
       el Segmento A arrastrado de la sesión anterior, confirmado
       explícitamente por el usuario).
     - **Validado contra Docker/MySQL reales (2026-08-26)**: rebuild
       `--no-cache` + `--force-recreate` backend/frontend, esquema
       confirmado por `INFORMATION_SCHEMA` (columna + 2 CHECK), sin
       `BANXICO_TOKEN` configurado → `GET /tipo-cambio/usd` degrada a
       `manual_requerido` en vivo tal como diseñado. Flujo HTTP
       completo: producto USD real (costo_original=25, tipo_cambio=18.5)
       → `costo_promedio=462.5` exacto, kardex expone el desglose;
       producto MXN sin regresión (costo_unitario directo,
       `monedaOriginal:null`); los 2 errores (`INV_CANTIDAD_INVALIDA`,
       `INV_TIPO_CAMBIO_INVALIDO`) confirmados con HTTP 400 reales.
       `scripts/verificar-inventario.js` **19/19** contra MySQL real
       (concurrencia, idempotencia, conciliación, D11) — cero regresión
       en `registrarMovimiento()`. Datos de prueba limpiados. Pendiente
       real: probar el camino AUTOMÁTICO con un `BANXICO_TOKEN` real
       (solo se validó por código + la degradación manual en vivo).

153. **Asociar tenants como sucursales — §58, IMPLEMENTADO Y VALIDADO
     (2026-08-26)**: retomado el pendiente del punto 150 — 6 preguntas
     cerradas vía cuestionario, incluido un fork de arquitectura con 3
     alternativas evaluadas (credenciales replicadas por fan-out /
     verificación en vivo / sesión cross-tenant real), y confirmado
     explícitamente por el usuario ("Implementar ahora"), protocolo
     `addv-web-app` completo.
     - **Decisiones cerradas**: solo se comparte el LOGIN (BD/inventario/
       ventas de cada tenant 100% aislados, sin cambios); usuario
       compartido vive en tabla nueva de la BD de control
       (`usuarios_sucursal`), no en la tabla `usuarios` de cada tenant;
       todos los usuarios de un grupo ven todas las sucursales asociadas
       sin distinción; solo `/control` (super) asocia/desasocia y
       administra usuarios compartidos; auditoría sin cambios (sigue por
       tenant); mecanismo de verificación **en vivo** vía
       `obtenerPoolControl()` — la conexión que el backend YA mantiene
       abierta para resolver cualquier tenant por slug — descartando el
       fan-out inicialmente propuesto una vez confirmado que esa
       conexión ya existía (cero llamada HTTP nueva entre servicios).
     - **Esquema (BD de control)**: `grupos_sucursal`
       (id/nombre/activo/fechas) + `tenants.grupo_sucursal_id` (NULL, un
       tenant en máximo 1 grupo) + `usuarios_sucursal`
       (grupo_sucursal_id/usuario/password_hash scrypt/perfil/activo).
     - **Backend**: `tenantContext.js` expone
       `req.tenant.grupoSucursalId`; `auth.js` gana un 5º nivel en
       `requireAdminAuth()` — verifica contra `usuarios_sucursal` con
       hash de relleno timing-safe, igual que los otros 4 niveles.
       Endpoint nuevo `GET /api/admin/sucursales-hermanas` para el
       switcher.
     - **Control**: `utils/sucursales.js` nuevo (CRUD grupos + usuarios
       compartidos, asociación todo-o-nada, invalidación de caché por
       tenant afectado, auditoría en `tenant_eventos`). API REST
       `/api/control/grupos-sucursal[...]`.
     - **Frontend**: `/control` gana vista "Sucursales" (tabla de
       grupos + modal con checklist de tenants y panel de usuarios
       embebido); `/admin` gana switcher de sucursales en el sidebar
       (navegación real `<a href>` a `/<slug>/admin`, solo visible con
       ≥2 sucursales en el grupo).
     - **Pruebas**: Jest backend **728/728** (12 nuevos), Jest control
       **117/117** (34 nuevos).
     - **Bug real encontrado y corregido validando contra Docker/MySQL
       reales** (imposible de detectar sin MySQL real): el diseño
       original usaba `FOREIGN KEY`/`ON DELETE CASCADE` y
       `DELETE FROM` — control entró en crash-loop
       (`ER_TABLEACCESS_DENIED_ERROR: REFERENCES command denied`) porque
       el usuario MySQL `control_app` (credencial angosta, decisión de
       seguridad del segmento 9b) solo tiene
       `SELECT/INSERT/UPDATE/CREATE/ALTER` — sin `REFERENCES` (no puede
       crear FK) ni `DELETE` (no puede borrar filas). Rediseñado a
       **soft-delete sin FK** (`activo = 0` + soltar tenants a mano +
       desactivar usuarios a mano, ya que no hay `ON DELETE CASCADE`
       posible) en vez de ampliar los privilegios de una credencial
       deliberadamente angosta — mismo patrón ya usado en
       `api_credenciales.revocarCredencialApi()` y en `orden_productos`
       (sin FK por diseño). Botón "Eliminar usuario" removido de la UI
       (queda solo Activar/Desactivar) por el mismo motivo.
     - **Validación E2E real completa por HTTP**: grupo creado
       asociando 2 tenants activos reales (`piloto9c`+`pruebaadmin`),
       usuario compartido dado de alta, la MISMA credencial autenticó
       contra los DOS paneles `/admin` distintos (cada uno devolviendo
       su propia lista de usuarios — aislamiento de datos confirmado
       intacto), password incorrecta → 401 real, switcher de
       sucursales correcto en ambas direcciones, eliminar grupo →
       credencial revocada de inmediato en ambos tenants (invalidación
       de caché en tiempo real, sin esperar el TTL de 45s), estado
       final verificado por SQL directo (tenants sueltos, grupo y
       usuario desactivados, cero filas borradas). Con esto, los 2
       pendientes de arquitectura del punto 150 (§57 tipo de cambio,
       §58 sucursales) quedan ambos implementados y validados.

154. **Regla de negocio: no facturar ventas con saldo pendiente por cobrar
     (2026-08-27, IMPLEMENTADO Y VALIDADO con Jest)**: cierra el pendiente
     #2 del punto 150. A pedido explícito del usuario, si un cliente
     intenta solicitar la factura (subir ticket) de una venta ligada a una
     orden de compra con `estado_pago = 'pendiente'` (Cuentas por cobrar,
     punto 138), el backend rechaza la solicitud con un mensaje claro en
     vez de aceptarla.
     - **Alcance decidido con el usuario** (analizado y confirmado antes de
       implementar, protocolo `addv-web-app`): el bloqueo va SOLO en el
       punto donde el cliente solicita la factura (`POST /api/tickets`),
       no en `POST /api/admin/tickets/:id/factura` (donde el admin sube la
       factura ya generada). Razón, confirmada revisando
       `PUT /api/admin/ordenes-compra/:id/cobro` (línea ~4457): `estado_pago`
       solo avanza `pendiente -> pagada`, nunca al revés — si un ticket
       llegó a crearse es porque en ese momento la venta ya estaba pagada,
       y no hay forma de que una orden "regrese" a pendiente después. No
       existe el hueco de "admin factura algo que nunca debió pedirse".
     - **Aclaración de nombres importante para no confundir en trabajo
       futuro** (el usuario pidió dejarlo registrado explícitamente): hay
       DOS columnas distintas que usan el mismo texto literal `'pendiente'`
       y significan cosas distintas — `tickets.estatus = 'pendiente'` es el
       estado de la SOLICITUD (el ticket todavía no se atiende/factura, sin
       relación con dinero) vs. `ordenes_compra.estado_pago = 'pendiente'`
       es el estado del COBRO (falta dinero por cobrar de esa venta, sin
       relación con si ya se facturó o no). Esta regla nueva usa
       exclusivamente la segunda columna (`estado_pago`); no tocar ni
       confundir con `tickets.estatus`.
     - **Backend**: 1 check nuevo en `POST /api/tickets`
       (`backend/server.js`, dentro del bloque que solo corre con "Ventas"
       — `ordenes_compra_habilitado` — activo), justo después de validar
       que fecha/hora/total coinciden con la orden y ANTES de la consulta
       de "ya facturada" (ahorra una consulta si aplica). Código de error
       nuevo `PAGO_PENDIENTE`, mismo patrón que `SIN_CONSTANCIA`/
       `COMPRA_NO_ENCONTRADA`/`COMPRA_YA_FACTURADA`.
     - **Frontend**: `tickets.js` gana el `else if` correspondiente,
       reutilizando `abrirModalVerificacionCompra()` ya existente — cero
       componente nuevo.
     - **Pruebas**: 2 casos nuevos en `tickets.test.js` (orden pendiente →
       400/`PAGO_PENDIENTE` sin llegar a insertar el ticket; orden pagada →
       201, sin regresión). Jest backend **730/730 (42 suites)**.
     - **Sin validar contra Docker/MySQL reales todavía** en esta sesión —
       pendiente antes de dar por cerrado en producción, mismo patrón que
       otros segmentos recientes.
     - Sin commit/push todavía.

155. **Datos de demo (wipe + reseed) + "Estado del inventario" en Reportes
     (2026-08-27, IMPLEMENTADO Y VALIDADO contra Docker/MySQL reales y en
     navegador real)**: a pedido del usuario, para poder validar correos
     reales contra un estado de datos limpio — protocolo `addv-web-app`
     completo (análisis de impacto + crítica de la petición + propuesta
     visual vía Artifact + preguntas de una sola respuesta antes de
     implementar).
     - **Alcance confirmado con el usuario**: solo `portal_facturacion`
       (BD sin tenant), NO los tenants de prueba. "Cuentas" = cuentas por
       cobrar (`ordenes_compra.estado_pago`), NO `usuarios` (se hubiera
       perdido el acceso al panel). Se incluyeron las 4 gráficas (las 2
       pedidas + 2 ideas opcionales ofrecidas en la propuesta: valor por
       categoría, cobertura de inventario). Se dejaron 2 RFC de prueba con
       correo real para pruebas manuales posteriores de envío de correo.
     - **`backend/scripts/sembrar-demo.js` (nuevo)**: reemplaza a
       `sembrar-datos-prueba.js` (punto 134) y `poblar-tony.js` — ambos
       hacían siembras parecidas sin borrar antes ni tocar inventario a la
       vez; quedaron eliminados (`git rm`). Borra (`DELETE`, no `TRUNCATE`
       por los FK de inventario) + resetea `AUTO_INCREMENT` de
       registros/tickets/ordenes_compra/orden_productos/gastos/
       movimientos_inventario/existencias/productos/reportes/
       reporte_items/imp_*, sin tocar config
       (configuracion/usuarios/categorias_*/unidades_medida/
       conversiones_unidad/almacenes/inv_perfiles_mapeo/
       preferencias_dashboard). Requiere `--confirmar` explícito
       (destructivo). Determinista (PRNG con semilla fija) — corrido con
       `SEMILLA_PRNG=20240401` tras probar varias semillas hasta que los
       6 meses de utilidad neta dieran positivos (26.8%-79.8% de margen,
       verificado por SQL directo: `subtotal_ventas - gastos` por mes,
       misma fórmula que la tarjeta "Utilidad neta del mes" del punto
       118). 12 productos en 4 categorías con **popularidad deliberadamente
       desigual** (`peso` por producto en el catálogo del script — algunos
       en 0, dead stock real, nunca se venden) para que existan un top-5 y
       un bottom-5 claros en la gráfica nueva. 2 registros (constancias)
       con RFC `XAXX010101000`→`aprado13@gmail.com` (con historial de
       ventas/tickets) y `XEXX010101000`→`aprado13+demo2@gmail.com`
       (limpio) — **ninguna fila de la siembra dispara correos reales**
       (INSERT directos a la base, no pasan por los endpoints); las
       constancias no tienen archivo real en MinIO (placeholder).
     - **Backend — endpoint nuevo** `GET
       /api/admin/inventarios/reportes/estado`
       (`requireAdminArea('administrador')` + `requireInventarioActivo`,
       mismo patrón que `/inventarios/dashboard` — vive bajo
       `/inventarios/*` y no `/reportes/*` porque lee exclusivamente
       tablas de ese dominio y necesita ese gate, aunque el frontend lo
       muestre dentro de "Reportes"). 4 queries (ventana fija 90 días),
       una de ellas COMPARTIDA entre el KPI de rotación y las 4 gráficas
       (una sola fuente de verdad, mismo criterio que `utilidad_neta` en
       `/resumen-financiero`). Rotación = aproximación honesta (unidades
       vendidas 90d ÷ existencia actual, `GREATEST(...,1)` contra
       división entre cero) — documentada como tal en el JSON y en el
       frontend, NO es rotación de inventario contable real (necesitaría
       existencia promedio del periodo, dato que este esquema no guarda).
       Cobertura en días bucketizada riesgo(<7)/saludable(7-60)/
       sobrestock(>60 o sin ventas). SQL inline en `server.js`, sin util
       nuevo (mismo criterio que `/resumen-financiero` e
       `/inventarios/dashboard`).
     - **Frontend**: 3ra pestaña "Estado del inventario" en Reportes
       (`view-toggle-btn`, junto a "Por reporte"/"Todo lo eliminado"),
       fetch perezoso al primer clic (mismo patrón que "Todo lo
       eliminado"). 3 KPI + 4 tarjetas reusando componentes existentes al
       máximo: `renderDonutGenerico()` tal cual para el donut de
       categoría, lista de barras modelada en `renderResumenFinProveedores`
       para los rankings. Único pedazo de UI genuinamente nuevo: línea
       punteada vertical de "promedio del catálogo" sobre la gráfica de
       rotación — sin precedente en el código (confirmado, no supuesto);
       resuelto con columnas de grid FIJAS (no `minmax`) solo en esa
       lista + un `calc()` en CSS, para no tener que medir el DOM en JS.
       Paleta nueva azul `#3D6FB4`/ámbar `#C97A2E` (claro) —
       `#5B8FD6`/`#BC7433` (oscuro, sin uso actual — ver corrección de
       diseño abajo) validada con el script oficial de la skill `dataviz`
       (contraste + daltonismo). Verde "saludable"/categorías del donut
       reusan tonos ya existentes en el panel (`#1FAE6B` y la paleta
       pastel de `RESUMEN_FIN_COLORES_CATEGORIA`), nunca inventados de
       cero.
     - **Corrección de diseño importante encontrada durante el proceso**:
       el plan inicial (subagente Plan) asumió un sistema de modo oscuro
       inexistente en este código — verificado por grep, **CERO**
       ocurrencias de `data-theme`/`prefers-color-scheme` en
       `frontend/*.css`. El "tema por tenant" (paleta elegida en
       `/control`) es un sistema totalmente distinto y congelado (punto
       23-35 de este archivo). La implementación real usa una sola
       paleta, sin bloques de tema oscuro nuevos — **para trabajo futuro:
       no asumir que existe modo oscuro en este panel**.
     - **Pruebas**: archivo nuevo
       `backend/test/integration/inventarioReportesEstado.test.js` (9
       casos: 401/403 perfil/403 módulo inactivo, datos reales con
       `rotacion_promedio_catalogo` consistente contra el array de
       rotación, estado vacío sin NaN/Infinity, proxy de rotación con
       existencia=0, bordes exactos de cobertura en 7 y 60 días, guarda de
       regresión de la ventana de 90 días). Jest backend **739/739 (43
       suites)**.
     - **Validado contra Docker/MySQL reales**: rebuild `--no-cache` +
       `--force-recreate` backend+frontend; `curl` al endpoint nuevo con
       los datos reales ya sembrados (números coherentes, KPI de rotación
       = línea punteada de la gráfica). **Gotcha de infraestructura NO
       relacionado con el código**: el contenedor `pfacturacion-minio` no
       pudo recrearse en el puerto 9001 por defecto — otro proyecto sin
       relación (`appprestamos-minio`, contenedor de otro proyecto en la
       misma máquina) ya lo tenía ocupado en `0.0.0.0:9000-9001`. Resuelto
       pasando `MINIO_CONSOLE_PORT=9012` como variable de entorno inline
       al `docker compose up` (sin tocar `.env`, sin permiso de lectura
       sobre ese archivo en esta sesión) — **si se recrea el contenedor
       `minio` de portalFac otra vez sin esa variable, va a volver a
       fallar por el mismo conflicto de puerto** hasta que alguien fije
       `MINIO_CONSOLE_PORT` de forma permanente en `.env`.
     - **Validado en navegador real** (Claude in Chrome): login, sidebar,
       las 4 gráficas y los 3 KPI confirmados visualmente con datos reales
       (top 5/bottom 5 correctos según el `peso` sembrado, línea de
       rotación alineada con zoom a pixel, donut y cobertura correctos),
       cero errores de JS. **Gotcha de la herramienta de automatización de
       navegador (no del código)**: los clics sintéticos del tool
       `computer` (`left_click`, por coordenada Y por `ref`) no
       disparaban los `addEventListener` reales de la página en esta
       sesión (login se quedó en "Entrando…" indefinidamente con la
       petición en `pending`; clics al sidebar no cambiaban de vista) —
       confirmado que el bug era de la herramienta, no de `admin.js`,
       ejecutando `document.getElementById(...).click()` vía
       `javascript_tool`, que sí disparó los mismos listeners
       correctamente y sin errores. Si una sesión futura ve "los clics no
       hacen nada" en este panel, probar ese mismo rodeo antes de asumir
       un bug de la app.
     - Sin commit/push todavía.

156. **Renombrado el prefijo de los contenedores: `pfacturacion-*` →
     `portalManager-*` (2026-08-27).** Pedido explícito del usuario, solo
     cosmético (mismo criterio que el punto 98, que hizo el rename
     anterior `fiscal-uploads-*` → `pfacturacion-*`) — no cambia
     comportamiento, solo el `container_name:`/`image:` visible en
     `docker ps`/Docker Desktop. Tocado en 4 archivos:
     - `docker-compose.yml`: los 5 `container_name:`
       (mysql/minio/backend/control/frontend).
     - `docker-stack.yml`: los 3 `image:` por defecto
       (`BACKEND_IMAGE`/`CONTROL_IMAGE`/`FRONTEND_IMAGE`) — nunca
       desplegado contra Swarm real, cambio solo por consistencia.
     - `README.md`: los 2 `docker build -t` de ejemplo en la sección de
       Swarm.
     - `CLAUDE.md`: la línea que documenta el prefijo actual.
     - Los mensajes históricos de este archivo (puntos 92/97/98/108/109/
       151/155, etc.) que mencionan `pfacturacion-*` se dejan tal cual —
       son registro de lo que era cierto en ese momento, no se reescribe
       historia.
     - Aplicado contra Docker real: `docker compose up -d
       --force-recreate` en los 5 servicios, verificado por `docker ps`
       (los 5 contenedores con el nombre nuevo) y `curl
       http://localhost:8088/api/health` (200 OK) después del recreate.
     - Sin commit/push todavía.

157. **Recuperar contraseña — cliente y admin/fiscal (2026-08-27,
     IMPLEMENTADO Y VALIDADO contra MySQL real; SMTP real NO disponible en
     esta sesión).** Pedido explícito del usuario ("tanto el cliente como
     el portal administrador... tanto el tenant como el individual"),
     protocolo `addv-web-app` completo: mapeo exhaustivo del sistema de
     auth actual (subagente Explore) + análisis de impacto/crítica +
     propuesta visual vía Artifact + preguntas de una sola respuesta antes
     de implementar.
     - **Alcance real, confirmado con el usuario** (no todo es
       recuperable — está en el propio código, no es interpretación):
       SOLO cliente + administrador/fiscal creados en "Usuarios" (misma
       tabla `usuarios`) son recuperables por correo. Fuera de alcance a
       propósito, sin excepción posible: la cuenta de respaldo `admin`
       (compartida, sin correo propio, vive en `configuracion`),
       `ADMIN_USERS` (variable de entorno/Docker Compose, no BD),
       `/control` (100% `ADMIN_USERS`, sin excepción) y los usuarios de
       sucursal compartidos (BD control, `usuarios_sucursal` sin columna
       de correo hoy). La app ya les dice hoy dónde ir a cada uno (mensaje
       actualizado en el login de `/admin`).
     - **Diseño**: un solo backend sirve cliente y admin/fiscal a la vez
       (misma tabla `usuarios`, la columna `rfc` ya se usaba como "usuario"
       para ambos). Token de un solo uso: 32 bytes de entropía real
       (`crypto.randomBytes`), se guarda HASHEADO (sha256, no scrypt —
       no hace falta, ya trae 256 bits de aleatoriedad) en 2 columnas
       nuevas `usuarios.reset_token_hash`/`reset_token_expira` (nullable,
       migración segura de re-correr). Expira en 30 minutos. Mensaje de
       respuesta SIEMPRE genérico exista o no la cuenta (anti-enumeración,
       mismo principio que ya usa `POST /api/auth/login` con
       `HASH_RELLENO_LOGIN` — aquí con un `hashPassword()` de costo
       artificial equivalente).
     - **Backend** (`backend/server.js`): `POST /api/auth/recuperar`
       (identificador → correo o RFC/usuario, busca en `usuarios`, genera
       token, envía correo) y `POST /api/auth/restablecer` (token+password
       → valida hash+expira, actualiza `password_hash`, limpia el token —
       un solo uso —, devuelve `perfil` para que el frontend sepa a dónde
       mandar al usuario después). Ambos con `authLimiter` +
       `tenantAggregateAuthLimiter` (mismo limitador que el login real).
       `enviarCorreoRecuperacion()` nueva, mismo patrón que
       `enviarInvitacionPortal` (ruta de destino según perfil).
     - **Bug real corregido de paso, aprobado explícitamente por el
       usuario** (mismo código compartido): `detectarUrlPortal(req)`
       (`backend/server.js:1104`) nunca incluía el slug del tenant en la
       URL — armaba `protocolo://host` en vez de `protocolo://host/<slug>`
       — así que en una instalación CON tenant, el link del correo de
       INVITACIÓN existente (`enviarInvitacionPortal`, ver también
       notificación de ticket nuevo y correos de venta — 5 llamadores en
       total) llegaba roto. Corregido una sola vez en la función
       compartida: si `req.tenant` existe, antepone `/${req.tenant.slug}`.
       Las URLs con slug ya funcionaban de punta a punta (nginx +
       `resolverTenantMiddleware`, segmento 4) — solo faltaba que el
       backend las armara así.
     - **Frontend**: `login.html`/`login.js` gana un 4º panel
       "Recuperar acceso" (mismo patrón `.auth-panel`/`is-active` que ya
       usan login/registro/cambiar-password) con link "¿Olvidaste tu
       contraseña?" en el panel de login. `admin.html`/`admin.js` gana un
       link equivalente + panel inline (con `hidden`, esa pantalla no
       tenía el sistema de paneles de login.html) — mensaje honesto sobre
       qué cuentas SÍ aplican. Página nueva `restablecer.html`/
       `restablecer.js` (mismo patrón visual que login.html, detección de
       tenant propia) — lee `?token=` de la URL, formulario de nueva
       contraseña con las mismas reglas visuales ya usadas en
       registro/cambio forzado, y redirige a `/login` o `/admin` (con
       slug si aplica) según el `perfil` que devuelve el backend. 3 clases
       CSS nuevas en `auth.css` (`.auth-forgot-link`, `.auth-back-link`,
       `.auth-hint`, `.auth-success-icon`), reusando el resto de
       componentes existentes.
     - **Multi-tenant "gratis"**: mismo patrón de rutas que
       `dashboard|tickets|login|csf` (segmento 4) — `restablecer` agregado
       al regex de `nginx.conf.template` (con y sin slug) y a los 5
       arreglos `RUTAS_PAGINA_MULTITENANT` duplicados
       (`login.js`/`admin.js`/`portal.js`/`theme.js`/`restablecer.js`,
       mismo patrón de duplicación deliberada ya usado en este proyecto).
       `frontend/Dockerfile` actualizado con los 2 archivos nuevos.
     - **Pruebas**: 8 casos nuevos en
       `backend/test/integration/auth-usuario.test.js` (identificador
       vacío, cuenta inexistente/sin correo — mismo mensaje genérico sin
       generar token —, cuenta con correo sí genera y guarda el token,
       token ausente/inválido/expirado, contraseña débil, token válido
       actualiza y limpia). Jest backend **747/747 (43 suites)**.
     - **Validado contra Docker/MySQL reales, ciclo completo por HTTP**:
       columnas nuevas confirmadas por `INFORMATION_SCHEMA`; `recuperar`
       con cuenta inexistente responde genérico sin tocar más que 1
       SELECT; `recuperar` con la cuenta real `FREDY`/`aprado13@gmail.com`
       (perfil `fiscal`) generó y guardó el token correctamente en
       `usuarios.reset_token_hash` (confirmado por SQL directo) — el
       INTENTO de envío real falló (`No se pudo conectar con
       smtp.gmail.com:587`, log limpio y claro, exactamente el
       comportamiento esperado del código) **porque este entorno de
       generación no tiene salida a internet hacia Gmail**, no por un bug;
       ciclo completo verificado con un token fabricado directamente en
       MySQL (equivalente a "recibir el correo"): `restablecer` actualizó
       la contraseña, `login` con la contraseña nueva funcionó, y un
       segundo intento con el MISMO token fue rechazado (un solo uso,
       confirmado). **Nota importante para el usuario**: la contraseña
       real de la cuenta `FREDY` (`aprado13@gmail.com`, perfil fiscal)
       quedó en `NuevaClave9` tras esta prueba.
     - **Sin validar en navegador real** — la extensión Claude in Chrome
       se desconectó a mitad de la validación de esta sesión y no volvió a
       conectar; verificado en su lugar por `curl` que las 3 páginas
       (`/login`, `/admin`, `/restablecer`, con y sin slug) sirven el
       marcado esperado (200, IDs de los elementos nuevos presentes).
       Pendiente: clic real en los 3 flujos (abrir el panel, enviar el
       formulario, ver la pantalla de éxito) y un envío SMTP real de
       punta a punta cuando haya salida a internet disponible.
      - Sin commit/push todavía.

  158. **Cierre mensual archivado (Ventas + Gastos) y retención solo-Tickets
      — IMPLEMENTADO (Fases 1-4), 2 bugs corregidos en auditoría posterior,
      Jest 762/762, SIN VALIDAR contra MySQL real todavía.** Documentado
      abajo como plan original (2026-08-28); implementado el mismo día por
      una sesión paralela (commits `ebd9c6d`/`cf21e4b`/`0327fd9`, ya
      pusheados a `fact/master`) sin pasar por la confirmación explícita
      de esta sesión sobre las 2 decisiones abiertas del final de este
      punto — mismo patrón de incidente que el punto 140. Auditoría
      posterior (2026-08-29) encontró y corrigió 2 bugs reales, ninguno
      detectable con `node --check`:
      - **Zona horaria ignorada de facto**: `periodoMesAnterior(zonaHoraria)`
        recibía el parámetro pero nunca lo usaba (calculaba sobre UTC
        crudo); el gate de disparo en `server.js` estaba hardcodeado a una
        ventana fija 07:00-09:00 UTC asumiendo siempre
        `America/Mexico_City`, ignorando `configuracion_global.zona_horaria`
        por tenant — con esto, un tenant en otra zona de
        `ZONAS_HORARIAS_MEXICO` (`utils/config.js`, UTC-6 a UTC-8) podía
        cerrar el mes equivocado o en la hora local equivocada. Fix:
        `fechaLocal()`/`esDia1EnZona()` nuevas en `cierreMensual.js`
        (`Intl.DateTimeFormat` con `timeZone`), gate real movido DENTRO de
        `ejecutarCierreMensualParaDB()` (decide "es día 1" con LA zona de
        esa DB, no la de quien llama); `server.js` solo conserva un
        pre-filtro amplio UTC día 1-2 (ahorra consultas el resto del mes,
        cubre sin riesgo el rango de offsets de las 11 zonas mexicanas
        soportadas).
      - **Frontend "Lectura de reportes" no reconocía `tipo_registro='gasto'`**
        (nuevo en este punto): una fila de gasto archivado se etiquetaba
        como "Ventas" (`admin.js` `renderFilaReporteItem`/
        `abrirTimelineItem`, ternario `ticket`/`Ventas` sin caso `gasto`)
        y el filtro "Tipo de registro" no tenía la opción "Gastos" en
        ninguno de los 2 selects (`admin.html`, reporte normal + ledger
        "Todo lo eliminado"). Fix: mapa `TIPO_REGISTRO_ETIQUETA` y opción
        `gasto` agregada en ambos selects.
      - **Cero pruebas unitarias para `cierreMensual.js`** (idempotencia,
        archivado, cálculo de fechas por zona, iteración multi-tenant) —
        el commit original solo ajustó las de `ticketsCleanup`. Agregado
        `test/unit/cierreMensual.test.js`, 15 casos nuevos.
      - Las 2 decisiones que quedaron "pendientes de confirmación
        explícita" al final de este punto (hora fija vs configurable,
        ventas `pendiente` incluidas en el cierre) se resolvieron en el
        código con los valores por defecto ya propuestos aquí mismo (hora
        fija 02:00 por zona, sí incluidas) — sin que el usuario las
        confirmara palabra por palabra; si alguna no es la deseada, es un
        ajuste chico sobre lo ya construido, no un rediseño.

      **VALIDADO CONTRA DOCKER/MySQL REAL (2026-08-29)** — 2 bugs más
      encontrados y corregidos, ninguno detectable con `node --check` ni
      Jest mockeado:
      - **Cierre mensual multi-tenant roto de raíz**: `ejecutarComoTenant(
        pool, fn)` (`db.js`) espera un OBJETO pool (mete `{pool}` en el
        AsyncLocalStorage), no un slug — `ejecutarCierresMensualesParaTodos()`
        le pasaba el slug crudo. Contra MySQL real: `pool.query is not a
        function` en CADA tenant (la base ADDV sí funcionaba, por no pasar
        por `ejecutarComoTenant`). Sin este fix, ningún tenant real habría
        podido cerrar un mes jamás. Fix: construir el pool real con
        `obtenerPoolTenant({slug, host: db_host, user: db_user,
        database: db_name, ...})` antes de `ejecutarComoTenant()` — mismo
        patrón que `tenantContext.js:resolverTenantMiddleware()`. La
        query a `control.tenants` ahora trae `db_host`/`db_name`/
        `db_user` además de `slug`.
      - **Filtro "Gastos" en Reportes no filtraba nada**: el whitelist de
        `tipo_registro` en los 4 endpoints (`/reportes/:id/items`,
        `/reportes/:id/exportar`, ledger cruzado `/reportes/items`,
        `/reportes/timeline/:tipo/:id`) solo aceptaba
        `['ticket', 'orden_compra']` — `gasto` se ignoraba en silencio
        (la query corría sin el `AND tipo_registro = ?`). Agregado
        `'gasto'` a los 4.
      - Confirmado por HTTP/SQL directos contra el stack real: esquema
        migrado limpio; cierre real de julio 2026 archivó exacto 29
        ventas + 11 gastos con correo real enviado y reporte
        `cierre_mensual` guardado; idempotencia (reintento no duplica);
        `resumen-financiero` intacto tras archivar (Opción A); filtros
        `?periodo=`/`incluirArchivadas`/`periodos-archivados` correctos;
        filtro "Gastos" en Reportes ya filtra 11/29 exacto; multi-tenant
        real (`piloto9c`+`pruebaadmin`, tras `ensureSchema()` manual en
        cada uno — mismo gap ya documentado en el punto 115, no nuevo de
        este punto) corre sin error; gate automático confirmado sin
        disparar fuera de día 1. Jest 764/764 (2 tests nuevos en
        `admin.test.js` para el whitelist, mocks de
        `cierreMensual.test.js` corregidos para reflejar el pool real —
        antes mockeaban mal y no habrían atrapado el bug del pool).

      Plan original (documentado 2026-08-28, antes de la implementación
      paralela) — se conserva íntegro abajo como referencia de las
      decisiones de diseño ya tomadas:

      A pedido del usuario, la retención por días
      deja de borrar Ventas/Gastos y el cierre de mes los archiva hacia
      Reportes, preservando métricas. Aplica **dual: base ADDV sin tenant
      (`portal_facturacion` / `PREFIJO_DEFECTO`) + cada tenant activo
      (`control.tenants`)** — pedido explícito "tanto el tenant como el
      individual".
      - **Estado hoy (crítica, `backend/utils/ticketsCleanup.js:7`,
        `backend/utils/config.js:68`, `backend/server.js:3233`,
        `frontend/admin.html:438`):** una sola clave
        `tickets_retencion_dias` → un solo input "Días antes de eliminar
        un ticket o venta" → borra ambos por `creado_en < NOW() - dias`
        cada hora (`ejecutarLimpiezaConReporte()` genera un reporte
        `tipo='automatico'` con tickets+ventas vencidas y hace `DELETE`
        de ambos). Ventas no tienen archivos, solo filas; el borrado es
        `DELETE FROM ordenes_compra WHERE id IN (?)`. Reportes hoy solo
        guarda `ticket`+`orden_compra` (`reportes.js:56`, `db.js:1201`
        `chk_reportes_tipo IN ('automatico','manual')`,
        `db.js:1240` `chk_reporte_items_tipo_registro IN
        ('ticket','orden_compra')`); Gastos no entra a reportes.
        `resumen-financiero` (`server.js:4678`, KPIs `4729`, serie 6 meses
        `4743`) lee directo de `ordenes_compra`/`gastos` con
        `eliminado_en IS NULL` — si se borra/archiva filtrando, las
        métricas colapsan.
      - **"Archivar" definido (corrección del gap):** NO es `DELETE` ni
        reutilizar `eliminado_en` (papelera). Es `archivado_en DATETIME
        NULL` + `periodo_archivado CHAR(7) NULL ('YYYY-MM')` en
        `ordenes_compra` y `gastos` (índice por periodo), + ampliación de
        `reporte_items.tipo_registro` a `('ticket','orden_compra','gasto')`
        y `reportes.tipo` a `('automatico','manual','cierre_mensual')`,
        con `accion='archivado'` en `reporte_items` (no `'eliminado'`).
        Comprobantes de Gastos en MinIO se conservan. Todo con guard
        `INFORMATION_SCHEMA` como `db.js`.
      - **Cierre mensual automático:** día 1 02:00 en
        `configuracion_global.zona_horaria` (`config.js:103`), guard
        `ultimo_cierre_mensual` por DB para idempotencia + reintento
        horario ese día 1 si el proceso estuvo caído. Snapshot del mes
        anterior calendario completo:
        `WHERE archivado_en IS NULL AND
        DATE_FORMAT(fecha_compra|fecha,'%Y-%m')=mesAnterior` →
        `generarYEnviarReporte({tipo:'cierre_mensual', items:
        [...ventas.map(ordenAItemReporte), ...gastos.map(gastoAItemReporte)],
        rangoInicio/rangoFin: mes anterior})` con `generarContenidoMD`
        tabla Gastos nueva (`reportes.js`) →
        `UPDATE ... SET archivado_en=NOW(),
        periodo_archivado=mesAnterior`. Incluye todo el mes, sin excluir
        por `estado_pago` ni comprobante; papelera (`eliminado_en IS NOT
        NULL`) siempre excluida. Venta pendiente archivada sigue cobrable
        desde vista archivada (se ampliará
        `PUT /api/admin/ordenes-compra/:id/cobro`).
      - **Visibilidad:** `GET /api/admin/ordenes-compra` y
        `GET /api/admin/gastos` filtran por defecto
        `archivado_en IS NULL` (operativo del mes en curso). Param
        `?periodo=YYYY-MM` | `?incluirArchivadas=true` para histórico.
        `GET /api/admin/reportes` lista `cierre_mensual` junto a los
        otros; "Lectura de reportes" muestra 3 tablas cuando aplica.
      - **Métricas preservadas — Opción A elegida:** `GET
        /api/admin/resumen-financiero` sigue agregando sobre
        `ordenes_compra`/`gastos` **incluyendo archivados** en serie 6
        meses, KPIs históricos y `top_proveedores`/`gastos_por_categoria`.
        El Reporte es evidencia/descarga, no nueva fuente de SUMs — evita
        doble verdad y reescribir 4 queries a `UNION reporte_items`.
        Opción B (UNION) queda como fase 2 si se exige.
      - **Multi-tenant dual:** `ticketsCleanup.js:62` hoy usa
        `PREFIJO_DEFECTO` porque el `setInterval` no tiene `req.tenant`.
        El nuevo job `ejecutarCierresMensualesParaTodos()` iterará
        `control.tenants` activos vía `obtenerPoolControl()` + base ADDV,
        con `ejecutarComoTenant(slug, ...)` por cada DB (su `pool` y
        `storage_prefix`), paginado 5 concurrentes para N>1000.
        `tickets_retencion_dias`, `ultimo_cierre_mensual` y
        `configuracion_global` ya viven por DB, así que retención/hora son
        por empresa sin clave global.
      - **Plan de ejecución (segmentos secuenciales, con confirmación
        explícita antes de cada uno, `node --check` + Jest + `verificar-
        mysql.js` + E2E contra Docker real):**
        Fase 1 — Desacople retención (sin migración, reversible):
        `ticketsCleanup.js` deja de borrar órdenes, copy
        `admin.html:438`/`admin.js:2956` a "solo ticket", `US.md:324`.
        Fase 2 — Esquema archivo + ampliación Reportes (`db.js`
        `ensureSchema`, `reportes.js` tabla Gastos).
        Fase 3 — Listados + Resumen compatible (`server.js` filtros
        `periodo`, `resumen-financiero` incluye archivados, frontend
        toggle Mes actual/periodo).
        Fase 4 — Job cierre mensual tenant-aware (`cierreMensual.js`,
        `server.js` cron día 1 02:00 + guard por DB, iteración paginada).
        Fase 5 — Docs + rollout (`PROJECT_STATE.md`/`README.md`/`US.md`,
        `sembrar-datos-prueba.js`, `docker compose up --build`).
      - **Criterios de aceptación:** retención no borra ventas/gastos
        (F1); cierre genera `cierre_mensual` y marca `periodo_archivado`
        en cada DB (F4); listados operativos solo mes en curso, histórico
        vía periodo (F3); serie 6 meses y `utilidad_neta` no caen tras
        archivar (F3/F4).
      - **Estado real de estas 2 decisiones: ver el bloque de auditoría al
        inicio de este mismo punto 158** — se implementaron con los
        valores propuestos (hora fija, ventas `pendiente` incluidas) sin
        pasar por esta confirmación explícita.

  159. **Pendiente registrado — cámara para código de barras (alta en
      Inventarios + búsqueda en Ventas) e imágenes de producto
      (2026-08-29), solo anotado, cero código tocado:** a pedido del
      usuario, se investigó por qué no aparece "subir imágenes" ni
      "lector de código de barras" en Inventarios/Ventas. Confirmado por
      grep en todo el repo, no es una regresión — nunca se construyó:
      - **Código de barras**: existe SOLO como campo de texto manual
        (`productos.codigo_barras`, alta/edición en `frontend/admin.html`
        `#inv-modal-codigo-barras`, búsqueda exacta en Ventas
        `server.js:6361`, sinónimo del importador masivo
        `inventarioCampos.js`). Nunca hubo lectura por cámara — cero
        referencia en el repo a `BarcodeDetector`, `getUserMedia` ni
        ninguna librería de escaneo (zxing/quagga/html5-qrcode). Falta
        agregar: (1) en Inventarios, botón "Escanear" en el alta/edición
        de producto que abra la cámara del celular y rellene
        `codigo_barras` automáticamente; (2) en Ventas, lector de código
        de barras desde la cámara del celular para buscar/agregar un
        producto al vuelo (hoy solo se busca por texto). **Confirmado con
        el usuario (2026-08-29): cámara del celular como lector, sin
        hardware dedicado, al menos en esta primera fase.** Requiere
        HTTPS (`getUserMedia` no funciona en HTTP salvo `localhost`) y
        decidir si vía `BarcodeDetector` nativo (Chrome/Edge Android, sin
        librería, sin soporte en iOS Safari) o una librería JS pura
        (funciona en todos, pesa más) — análisis pendiente antes de
        proponer segmento.
      - **Imágenes de producto**: D10 en `inventarios.md` (§6) tiene la
        especificación COMPLETA ya escrita (gate por control + tenant,
        3 límites, pipeline de redimensionado/WebP, tabla
        `producto_imagenes`, endpoints `POST/DELETE/PUT
        /productos/:id/imagenes*`) pero es solo documento — cero tabla,
        cero endpoint, cero UI construida todavía. No es un bug, es un
        segmento de `inventarios.md` nunca empezado. Retomar D10 tal cual
        ya está especificado cuando se confirme el segmento.
      - Sin análisis de alcance/segmento todavía — solo el hallazgo y el
        pendiente anotados aquí, protocolo `addv-web-app` de
        Analizar→Proponer→Confirmar antes de tocar código.

      **Refinamiento + Segmento A — IMPLEMENTADO Y VALIDADO en navegador
      real (2026-08-29)**: propuesta con análisis de impacto, crítica,
      requerimiento mejorado, recomendación y mockup visual (Artifact)
      presentada y aprobada por el usuario ("Segmento A primero"). Esta
      sesión estableció además una regla persistente nueva para CUALQUIER
      refinamiento de requerimiento futuro (no solo este): impacto +
      crítica + mejora + recomendación + propuesta visual antes de
      confirmar — ya incorporada a la skill global `addv-web-app`
      (`~/.claude/skills/addv-web-app/SKILL.md`, paso 1 del flujo
      obligatorio) y a este `CLAUDE.md`.
      - **Hallazgo que cambió el alcance**: Ventas YA reconocía un lector
        físico USB/Bluetooth (coincidencia exacta se autoselecciona sin
        clic, `admin.js` `buscarProductosInventarioOrden()`) — cero
        código nuevo necesario para ese camino. Cámara por celular
        confirmada como el camino a construir de todas formas (decisión
        explícita del usuario), sin que compita con el lector físico.
      - **`frontend/scanner.js` (nuevo)**: componente compartido entre
        Ventas e Inventarios. Decodificación progresiva: `BarcodeDetector`
        nativo primero (Chrome/Edge Android, cero KB); si no está
        disponible, carga perezosa de `html5-qrcode` (v2.3.8, Apache-2.0,
        vendorizado en `frontend/assets/vendor/html5-qrcode.min.js` —
        revisado antes de usarse: sin `eval`, único `new Function()` es
        el mismo patrón benigno de detección de `globalThis` ya
        documentado en el punto 140, cero llamada a dominio externo).
        Nunca por CDN, mismo criterio que el resto del sitio. Cero
        endpoint nuevo — el valor decodificado se inyecta como si se
        hubiera tecleado, reusando 100% la lógica ya existente en ambos
        flujos.
      - **UI**: modal compartido `#scanner-modal-overlay` en
        `admin.html` (visor con marco navy + línea de barrido cian,
        estados de error/retry, respeta `prefers-reduced-motion`), botón
        "Escanear" (SVG, no emoji — el sitio ya los quitó de la UI en el
        punto 141) junto al buscador de producto en Ventas
        (`#btn-orden-inventario-escanear`) y junto al campo "Código de
        barras" en el alta/edición de Inventarios
        (`#btn-inv-modal-escanear`).
      - **Bug real encontrado y corregido en la validación en navegador
        real, mismo patrón que el punto 135**: `#scanner-modal-overlay`
        compartía `z-index:50` con el resto de `.modal-overlay` — al
        abrirse desde DENTRO de otro modal ya abierto (Registrar venta,
        Nuevo producto — el único uso real de este botón) quedaba
        invisible detrás del modal padre. Fix: `#scanner-modal-overlay {
        z-index: 70; }` en `style.css`, mismo valor ya usado por
        `#confirm-modal-overlay` para el mismo problema.
      - **Validado en navegador real (Claude in Chrome)**: botón visible
        y bien alineado en los 2 flujos; modal abre encima del modal
        padre tras el fix (confirmado con `getComputedStyle` real:
        z-index 70 vs 50 del padre); sin cámara física en este entorno,
        el camino de error se dispara con gracia ("No se pudo iniciar la
        cámara. Escribe el código a mano o usa un lector físico." +
        botón "Reintentar", sin crash); Reintentar funciona; Escape
        cierra y limpia el estado; cero errores de consola en todo el
        flujo. **Gotcha de la herramienta de automatización, no del
        código** (mismo patrón ya documentado en el punto 155): el tool
        `computer` de Claude in Chrome no disparaba los clics de
        navegación del sidebar en este entorno — rodeo confirmado:
        `document.getElementById(id).click()` vía `javascript_tool` sí
        dispara los listeners reales.
      - **Pendiente real, no bloqueante**: no se pudo probar el camino
        feliz completo (decodificar un código de verdad) por no haber
        cámara física en este entorno de validación — probar con un
        celular real contra un despliegue con HTTPS antes de dar el
        segmento por cerrado en producción. `node --check` limpio, CSS
        balanceado (`admin.css` 846/846, `style.css` 140/140), Jest
        backend 764/764 (sin cambios de backend, segmento 100%
        frontend). Sin commit/push todavía.
      - **Segmento B — Imagen principal de producto — IMPLEMENTADO Y
        VALIDADO contra Docker/MySQL/MinIO real (2026-08-30)**: recorte
        de D10/US-INV-002 — solo 1 imagen por producto en v1 (galería
        US-INV-003 y el gate control+tenant de la spec completa quedan
        para cuando haya tenants reales con costo de almacenamiento que
        justifique esa complejidad; sí se conservan las 2 protecciones
        de seguridad no negociables: límite de dimensión 8000×8000px
        antes de decodificar y timeout duro de 10s por imagen).
        - **Backend**: dependencia nueva `sharp` (procesamiento de
          imagen — resize + WebP, sin librería de firma binaria nueva
          porque ya existía `detectRealImageMimeType()` en
          `utils/validate.js`, reusada tal cual). 3 columnas nuevas en
          `productos` (`imagen_key`/`imagen_thumb_key`/
          `imagen_actualizada_en`, migración guardada por
          INFORMATION_SCHEMA). `utils/inventarioImagen.js` nuevo:
          `procesarImagenProducto()` (valida firma → límite de
          dimensión ANTES de decodificar → 1200px + miniatura 300×300,
          ambas WebP q80, timeout 10s vía `Promise.race`) +
          `guardarImagenProducto()`/`eliminarImagenProducto()` (MinIO,
          nombre de archivo FIJO por producto — `principal.webp`/
          `thumb_principal.webp` — así reemplazar sobreescribe la misma
          key sin dejar huérfanos, a diferencia de una galería con
          nombres uuid). 3 endpoints nuevos bajo
          `/api/admin/inventarios/productos/:id/imagen` (POST/GET/
          DELETE, mismo patrón de auth que el resto de Inventarios);
          igual que el comprobante de Gastos, subir una imagen es una
          petición APARTE después de crear el producto (nunca en el
          mismo POST de alta) — por eso la UI solo la muestra editando.
          `formatearProducto()` y `/productos/buscar` (usado por
          Ventas) extendidos con `imagen_url`/`imagen_thumb_url`,
          con `?t=<timestamp>` de cache-busting (necesario porque la
          key de MinIO es fija y se sobreescribe).
        - **Frontend**: sección "Imagen del producto" (dropzone +
          drag&drop, mismo componente `.dropzone` ya en `style.css`)
          en el modal de edición de Inventarios — oculta al dar de alta
          (sin id todavía). Miniatura en la tabla de Inventarios y en
          las sugerencias de búsqueda de Ventas.
        - **Bug real encontrado y corregido en la validación en
          navegador real, no detectable de otra forma**: un
          `<img src="...">` normal NUNCA manda el header
          `Authorization` (este panel usa Basic Auth manual vía
          `fetch()`, sin diálogo nativo del navegador que el browser
          pueda cachear) — las miniaturas se veían como huecos vacíos
          pese a que la API devolvía todo bien. Fix:
          `cargarImagenAutenticada()` nueva en `admin.js` — trae el
          archivo con `fetch()` + header, lo convierte a blob URL
          (cacheado por URL exacta) y recién ahí llena `img.src`.
          Aplicado a la tabla de Inventarios, las sugerencias de Ventas
          y el preview del modal de edición.
        - **Validado de punta a punta contra Docker/MySQL/MinIO
          reales**: `npm install sharp` compiló bien dentro de la
          imagen Alpine (sin agregar herramientas de build); subida
          real de una foto (1600×900 → WebP 1200×675 + thumb WebP
          300×300 confirmados con `sharp().metadata()`), columnas
          reales en MySQL, rechazo real de un archivo no-imagen
          (`INV_IMAGEN_TIPO_INVALIDO`), borrado real, y en navegador
          real (Claude in Chrome): miniatura visible en la tabla de
          Inventarios, preview en el modal de edición, "Quitar imagen"
          alternando dropzone↔preview sin reabrir el modal, y
          miniatura visible en la sugerencia de búsqueda de Ventas —
          los 3 puntos que antes se veían vacíos por el bug de arriba.
        - Jest backend **781/781 (45 suites)**, 17 tests nuevos (10
          integración de la capa HTTP con el pipeline mockeado + 7
          unitarios del pipeline real de `sharp` contra imágenes reales
          generadas en el propio test, sin mockear `sharp`). `node
          --check` limpio, CSS balanceado.
        - **Fix de regresión visual encontrado y corregido el mismo día
          (reportado por el usuario con captura real)**: la miniatura se
          había metido DENTRO de la celda "Nombre" de `.inv-table`, una
          tabla `table-layout: fixed` (`admin.css:1600-1605`) que nunca
          tuvo ancho explícito por columna — dependía de adivinar el
          ancho a partir del texto corto del encabezado, no del
          contenido real. Con el thumbnail compitiendo por ese mismo
          presupuesto ya ajustado, nombres largos se partían en 3-4
          líneas ("Cable UTP Cat6 305m" → 4 líneas). Propuesta
          antes/después (Artifact) presentada y aprobada antes de
          tocar código, usando la skill `impeccable` (sin correr su
          flujo completo de crítica dual-agente — ese es para auditar
          una superficie entera, no una regresión de CSS puntual y
          acotada). Fix: columna "Imagen" propia y fija (48px,
          `th.inv-th-imagen`) separada de "Nombre" en
          `admin.html`/`admin.js`, que recupera su ancho completo.
          Validado en navegador real: nombres antes en 4 líneas ahora en
          máximo 2, imagen real sigue cargando bien en su celda nueva
          (`cargarImagenAutenticada()` intacto), cero errores de
          consola. Jest backend 781/781 sin cambios (100% frontend).
        - Con esto, el requerimiento del punto 159 (código de barras +
          imágenes) queda completo: Segmento A (cámara) + Segmento B
          (imagen principal) + el fix de columna. Sin commit/push
          todavía.

  160. **Cabeceras ajustables en todas las tablas + acciones de
      Inventarios compactas — IMPLEMENTADO Y VALIDADO en navegador real
      (2026-08-30)**: pedido explícito del usuario, propuesta
      antes/después (Artifact) aprobada primero.
      - **Ajuste de cabeceras generalizado**: el mecanismo ya existía
        (`crearControladorColumnas()` en `admin.js` — botón "Columnas"
        para ocultar/mostrar + arrastrar el borde de cada encabezado
        para redimensionar, con memoria en `localStorage`) en
        Constancias/Ventas/Gastos. Se conectó, SIN reescribir la
        función, a las 4 tablas que faltaban: Tickets, Cuentas por
        cobrar, Usuarios e Inventarios — cada una con su botón "Columnas"
        propio, su lista `COLUMNAS_TABLA_X` y sus claves de
        `localStorage` separadas para no mezclar preferencias entre
        tablas. Cada `<th>` ganó `data-col`/`<span class="col-resizer">`
        y cada `<td>` generado por JS ganó su `data-col` correspondiente
        (el selector CSS `.admin-table-wrap.hide-X [data-col="X"]` que
        ya existía es genérico — reutiliza automáticamente claves
        repetidas entre tablas como "rfc"/"categoria"/"estado", sin
        duplicar reglas). En Inventarios, la columna "Imagen" (punto
        159, Segmento B) queda deliberadamente FUERA del sistema — es
        fija de 48px, sin texto que ocultar ni ancho que negociar.
      - **Acciones de Inventarios, de 5 botones a 2 + menú "⋮"**: los 5
        íconos (Entrada/Salida/Historial/Editar/Eliminar) ya usaban el
        mismo componente compacto de 30×30px que Usuarios
        (`.btn-icono-accion`) — el problema no era el tamaño, era la
        cantidad forzando ~200px de columna. Quedan visibles Entrada y
        Salida (uso diario en D8); Historial/Editar/Eliminar se agrupan
        en un menú "⋮" nuevo y reutilizable
        (`crearMenuAccionesInv()`/`.inv-acciones-menu*` en
        `admin.js`/`admin.css`) — cierra con Escape o clic afuera, igual
        que los demás popovers del panel. Los casos de papelera/servicio
        (que ya tenían solo 2 botones) quedan intactos, sin tocar.
      - **Validado en navegador real (Claude in Chrome)** en las 4
        tablas: botón "Columnas" abre el panel correcto por tabla
        (8/7/4/8 checkboxes respectivamente), ocultar una columna
        (`hide-uso` en Tickets) la oculta de verdad, arrastrar el borde
        de un encabezado cambia su ancho en vivo (Folio 110→170px), el
        menú "⋮" de Inventarios abre con los 3 ítems correctos y
        "Editar producto" dispara la acción real y cierra el menú solo.
        Cero errores de consola en todo el recorrido.
      - `node --check` limpio, CSS balanceado (`admin.css` 882/882),
        HTML balanceado (114/114 `<th>`, el conteo ingenuo con
        `<thead>` daba un falso 132/114). Jest backend 781/781 (sin
        cambios de backend, segmento 100% frontend). Sin commit/push
        todavía.

  161. **Homologación de marca CLARVO en los 6 correos de salida —
      IMPLEMENTADO Y VALIDADO contra Docker/MySQL/SMTP reales
      (2026-08-31)**: auditoría a pedido del usuario ("revisa todas las
      plantillas de correos de salida") — de los 6 correos que manda
      `enviarCorreo()`, solo la confirmación de venta (punto 133) tenía
      diseño real; invitación/aviso al contador/factura lista eran texto
      plano puro, y recuperación de contraseña tenía HTML mínimo (Arial
      genérico, sin logo real). Propuesta visual (Artifact con mockups
      "antes" reales de cada plantilla + "después" homologado) aprobada
      con "Sí, implementa todo el segmento y sí a todas tus
      recomendaciones".
      - **`construirCorreoBase()` nuevo** (`backend/server.js`, junto a
        `construirCorreoOrdenCompra`): mismo lenguaje visual del ticket
        de venta (logo, franja degradada, tarjeta punteada, botón) para
        cualquier correo de cara a cliente/tercero externo. `filaTicket`
        (closure local del ticket) se extrajo a `filaCorreoTabla()` a
        nivel de módulo, compartida por ambos — el ticket queda
        BYTE-IDÉNTICO (cero cambio visual), solo deja de duplicar el
        markup.
      - **4 correos migrados** a `construirCorreoBase()`: invitación al
        portal, recuperación de contraseña, aviso al contador de nuevo
        ticket, y factura lista — esta última envuelve el texto LIBRE
        del admin (`cuerpo_cliente`) tal cual, sin reescribirlo, y gana
        un botón "Entrar al Portal" que antes no existía (aprobado en la
        propuesta, pregunta 2). El reporte automático
        (`utils/reportes.js`) se dejó FUERA a propósito — tráfico
        interno con adjunto Markdown, no representa la marca frente a
        nadie externo (pregunta 1).
      - **Parametrización desde `/control` sin UI nueva**: el color de
        la franja/botón lee `tema_json.colores.accentDark`/`accent` del
        tenant (Look & Feel, punto 105 — ya editable hoy desde
        `/control`, ya validado con contraste WCAG AA), con navy/cyan de
        CLARVO como respaldo si el tenant no personalizó su tema
        (pregunta 3). Requirió exponer `temaJson` (crudo, sin parsear)
        en `req.tenant` desde `utils/tenantContext.js` — antes se leía
        de la fila de MySQL pero nunca se pasaba al resto de la
        petición.
      - **Bug propio encontrado y corregido en la validación**: la
        primera versión hacía `await getConfiguracionGlobal()`
        SÍNCRONO dentro del handler antes de llamar a la función de
        correo — rompía el patrón "fire-and-forget" que ya tenían las 4
        rutas (invitación, recuperación, ticket nuevo, factura lista) y
        tumbaba la respuesta con 500 si esa consulta fallaba/no estaba
        mockeada (encontrado por Jest: `admin.test.js` "POST crea un
        cliente válido" pasó de 201 a 500). Fix: todo el cómputo
        (`getConfiguracionGlobal` + `logoUrlDelTenant` +
        `coloresCorreoTenant`) se movió DENTRO de un IIFE async
        envuelto en el mismo `.catch()` que ya tenían — nunca bloquea
        la respuesta, igual que antes.
      - Jest backend **781/781** (test de `tenantContext.js` actualizado
        con el campo `temaJson: null` nuevo), control 117/117 (sin
        cambios). Rebuild real de `backend` (`docker compose build` +
        `up -d --force-recreate`), validado con el SMTP real ya
        configurado en este entorno (Gmail, `notificaciones@addv.mx`):
        invitación de un usuario de prueba y recuperación de contraseña
        enviadas de punta a punta sin errores en los logs del
        contenedor; cuenta de prueba borrada después
        (`GOMJ800101AB1`). Aviso al contador y factura lista comparten
        exactamente el mismo `construirCorreoBase()`/patrón IIFE ya
        confirmado en los otros dos — no se forzó su flujo completo
        (constancia + venta + ticket + ZIP de factura) por costo/tiempo
        frente al beneficio marginal, dado que la suite Jest completa
        (incluida la nueva cobertura del punto 158) sigue en verde. **Los
        6 correos se probaron enviándolos de verdad, todos en el mismo
        recorrido, a una cuenta Gmail real del usuario** (venta,
        invitación, recuperación, aviso al contador, factura lista y
        reporte automático — este último antes de la extensión de abajo
        —, con datos de prueba insertados/creados vía API y SQL directo,
        y borrados por completo al terminar, incluida la restauración de
        `correo_contador`/`correo_reportes` a sus valores reales).
      - **Extensión same-day: el reporte automático (#6) también se
        homologó**, a pedido del usuario tras ver el correo real sin
        diseño ("puedes revisarlo por favor?" + confirmó homologar en
        vez de dejarlo como estaba). `construirCorreoBase()` y sus
        piezas (`MARCA_DEFECTO`, `escapeHtmlCorreo`, `logoTicketHtml`,
        `filaCorreoTabla`) se **extrajeron de `server.js` a un módulo
        nuevo `backend/utils/correoMarca.js`** (única fuente de verdad),
        porque `utils/reportes.js` (usado también por `cierreMensual.js`
        y `ticketsCleanup.js`, ninguno con acceso a `req`) necesitaba las
        mismas piezas sin crear una dependencia circular con `server.js`.
        `generarYEnviarReporte()` gana parámetros opcionales
        `marca`/`urlPortal`/`marcaLogoUrlTenant`/`colorPrimario`/
        `colorAccent` — los 2 llamadores con `req` real (`POST
        /api/admin/reportes/enviar`, `DELETE /ordenes-compra/:id`) los
        resuelven del tenant; los 2 llamadores en segundo plano
        (`cierreMensual.js`, `ticketsCleanup.js`) se dejan sin tocar —
        sin esos parámetros, cae a marca/logo/color CLARVO por defecto,
        nunca se rompe. El adjunto `.md` del reporte se conserva igual,
        ahora junto al adjunto CID del logo. **Bug propio corregido en
        la validación** (mismo patrón de fragilidad del punto 161
        original): la primera versión hacía un `getConfiguracionGlobal()`
        EXTRA y redundante directo en los 2 handlers de `server.js` antes
        de llamar a `generarYEnviarReporte()` (que YA hace su propio
        fetch de configGlobal internamente) — el `pool.query` de más
        corrió la cola de mocks de Jest y tumbó 3 tests de
        `ordenes-compra.test.js` que no tienen nada que ver con correos
        (aserciones de `registrarMovimiento`/reingreso de inventario
        leyendo datos mockeados para la llamada equivocada). Fix: se
        quitó el fetch redundante — `generarYEnviarReporte()` ahora
        resuelve `logoUrl` internamente con el `configGlobal` que ya
        tenía, recibiendo solo `marcaLogoUrlTenant` (crudo, sin
        prefijo) + `urlPortal` en vez de una URL ya armada. Jest backend
        **781/781** de nuevo, control 117/117. Rebuild real,
        **validado con un envío real del reporte automático** a la
        misma cuenta Gmail (correo_reportes temporal, restaurado
        después, reporte de prueba borrado). **Commiteado y pusheado**
        (`b6f4fe2` → `fact/master`).

  162. **Skill `addv-web-app` actualizada + herramientas de eficiencia
      instaladas (2026-08-31)**: a pedido del usuario, la skill global
      `~/.claude/skills/addv-web-app/SKILL.md` se reemplazó con la
      versión más reciente de su repo propio
      (`github.com/antonioprado-sketch/addv-web-app`, antes vivía en otra
      ruta) — flujo obligatorio pasó de 4 a **8 pasos explícitos**
      (Analizar → Revisar impacto → Criticar y mejorar → Propuesta visual
      → Confirmar → Implementar → Probar → Asegurar), formalizando lo que
      antes era una regla aparte solo para "refinar un requerimiento".
      Estándares nuevos como bullets propios (antes implícitos): "nada
      sensible en el frontend" y "cifrado siempre" (tránsito+reposo);
      "pruebas unitarias" pasó a "pruebas unitarias **y** funcionales".
      Tabla nueva de origen/repositorio de cada skill nativa, y 2
      herramientas de eficiencia nuevas en la lista (`agent-skills`,
      `prompt-master`), ambas instaladas la misma sesión tras revisar su
      código/contenido primero (regla anti-hackeo del propio protocolo):
      `agent-skills` vía el CLI oficial `skills` de vercel-labs
      (`npm view skills` confirmó MIT, sin `eval` ni pipe-a-shell, solo
      fetch a GitHub/su registro) — 24 skills symlinkeadas a Claude Code
      en `.agents/skills/`; `prompt-master` clonado directo a
      `~/.claude/skills/prompt-master` (repo revisado antes: solo
      Markdown, sin scripts). `.agents/` ya estaba en `.gitignore`
      (de un incidente previo, ver punto 140); se agregó
      `skills-lock.json` (manifiesto del CLI `skills`, creado en la raíz
      del repo por correr `npx` desde aquí) al mismo criterio — estado
      del entorno local, no código del sitio. Ambas skills (global +
      este proyecto) documentadas en `CLAUDE.md`. Sin cambios de código
      de la aplicación en este punto — solo tooling/documentación.

  163. **PENDIENTE — Revisión completa de `/control` (UI + funcionalidad),
      EN CURSO, sin implementar nada todavía (2026-08-31)**: petición del
      usuario, pausada a media sesión para retomar en la siguiente.
      Petición textual: revisar toda la funcionalidad de `/control`
      (identificar algo que se haya pasado por alto), mejorar la UI,
      proponer mejoras adicionales, y arreglar un bug concreto de
      diseño con captura de pantalla — el modal "Editar empresa" sale
      muy chico (comparado con el resto de la página, casi vacío
      alrededor). Pide aplicar el mismo patrón que ya usa `/admin`
      (modal "Gestionar ticket", `.ticket-modal`, 820px/94vw, 2
      columnas) tanto en `/admin` como en `/control`, y agregar fondo
      con blur (`backdrop-filter`) a los modales de ambas apps.
      **Confirmado durante el análisis, antes de la pausa** (sin tocar
      código — la skill `addv-web-app` actualizada del punto 162 exige
      propuesta visual + confirmación explícita antes de implementar):
      - Los 3 modales de `/control` (`Nueva empresa`, `Editar empresa`,
        `Credenciales API` — `frontend/control.html` líneas ~294, ~422,
        ~676) usan la clase `.modal-ancho` (`frontend/admin.css:3471`,
        `max-width: 560px`, una sola columna) en vez de `.ticket-modal`
        (`admin.css:2938`, `max-width: 820px`, 2 columnas) que ya usa
        `/admin` para su modal más grande — `control.html` YA importa
        `admin.css` (línea 10), así que `.ticket-modal` ya está
        disponible ahí sin agregar nada, es cuestión de cambiar de
        clase y reestructurar el HTML interno a 2 columnas.
      - El modal "Editar empresa" es el más largo con diferencia:
        identidad (nombre/marca/logo/slug) + contacto (email/notas) +
        DOS secciones colapsables largas apiladas debajo — "Datos
        fiscales" (6 campos) e "Identidad visual" (12 colores +
        tipografía + favicon + vista previa en vivo, segmento Look &
        Feel del punto 105). Propuesta de diseño esbozada (sin
        implementar): columna izquierda = identidad+contacto (siempre
        visible), columna derecha = las 2 secciones colapsables
        (avanzado/opcional) — reduce el scroll vertical sin esconder
        nada. El modal de "Nueva empresa" tiene la misma estructura
        pero sin la sección de tema (solo aplica a tenants ya
        existentes). El de "Credenciales API" es distinto — flujo
        lineal (lista → generar → revelar secretos + ejemplos curl),
        no se presta a 2 columnas igual de natural; candidato a solo
        ensancharse (~640-680px) y limpiar los estilos inline que tiene
        hoy (`style="..."` sueltos en el HTML, código smell aparte del
        tamaño).
      - **Blur de fondo es funcionalidad NUEVA**, no existe hoy: cero
        usos de `backdrop-filter` en todo `frontend/*.css` (verificado
        por grep). Se agregaría a `.modal-overlay` en `style.css`
        (compartida por admin y control), con fallback/degradación
        elegante en navegadores sin soporte (el `rgba()` de fondo ya
        existente sigue funcionando solo, el blur es una mejora
        progresiva encima).
      - **Agente `Explore` en segundo plano lanzado** para auditar
        `control/server.js` (rutas backend) vs `frontend/control.js`
        (llamadas del frontend) vs `control/test/**` — busca endpoints
        sin usar desde la UI, botones que llaman a algo que no existe,
        flujos a medio terminar, accesibilidad, e inconsistencias entre
        `/admin` y `/control`. **La sesión se pausó antes de que este
        agente terminara/se recogiera su resultado** — la siguiente
        sesión debe relanzarlo si no sigue corriendo (no se guardó su
        salida en ningún archivo del proyecto).
      **Siguiente sesión**: recoger/relanzar la auditoría funcional,
      armar la propuesta visual completa (Artifact con antes/después
      del modal + blur + cualquier hallazgo de la auditoría), esperar
      confirmación explícita del usuario antes de tocar código — nada
      de esto está implementado, es 100% análisis hasta este punto.

  164. **Revisión de `/control` (punto 163) retomada y su parte mecánica
      COMPLETA, IMPLEMENTADA Y VALIDADA (2026-08-31)**: el usuario dio
      permiso explícito de ejecutar sin esperar confirmación en cada
      paso ("tienes permiso de ejecutar todo lo que requieras") al
      salir, pidiendo dejar la propuesta visual abierta en el navegador
      para revisar al volver. Se relanzó el agente `Explore` de
      auditoría (control/server.js vs frontend/control.js vs tests) —
      resultado completo en las categorías A-G (endpoints sin usar,
      botones/UI, flujos a medio terminar, cobertura de tests,
      inconsistencias visuales, accesibilidad, funcionalidad sin UI).
      **Implementado solo lo mecánico/sin decisión de producto de por
      medio** (los hallazgos que sí son decisión de producto se dejaron
      documentados sin tocar, ver abajo):
      - Modales "Nueva empresa" y "Editar empresa": clase nueva
        `.control-modal-ancha` (`admin.css`, mismo tamaño que
        `.ticket-modal` — 820px/94vw/2 col via `.control-form-grid`
        nuevo, breakpoint a 1 columna <760px) reemplaza `.modal-ancho`
        en esos 2 modales (`control.html`). **Diseño real distinto al
        esbozado en el punto 163**: en vez de partir el modal en
        "columna fija + columna con las 2 secciones colapsables", se
        pusieron en grid de 2 columnas solo los campos base (Nombre/
        Marca, Logo/Slug, Correo/Notas) y las secciones colapsables
        (Datos fiscales, Identidad visual) se dejaron a ancho completo
        debajo — más simple de implementar y sin riesgo, porque
        `.tema-grid-colores` (`auto-fill, minmax(140px,1fr)`) y
        `.tema-fila-selects` (`auto-fit, minmax(160px,1fr)`) YA eran
        grids responsivos: con el modal más ancho pasan solas de ~3 a
        ~5 columnas por fila sin tocar una sola regla de esas 2 clases.
        Modal "Credenciales API" se dejó en `.modal-ancho` (560px) a
        propósito — no estaba en el alcance ya escrito del punto 163
        (que solo nombra Nueva/Editar empresa) y su flujo es lineal, no
        de 2 columnas.
      - `backdrop-filter: blur(4px)` (+ prefijo `-webkit-`) en
        `.modal-overlay` (`style.css`) — un solo punto de cambio,
        aplica a `/admin` y `/control` por igual, tal cual pedido.
      - 3 hallazgos de accesibilidad/consistencia de la auditoría,
        de bajo riesgo, corregidos de paso: click-fuera-para-cerrar en
        `#control-confirm-modal-overlay` (era el único modal de
        `/control` sin ese comportamiento, mismo patrón que los otros
        4); Escape genérico nuevo en `control.js` que cierra el overlay
        visible de los 5 (`admin.js` ya lo tenía en los suyos,
        `/control` no tenía ninguno); `aria-label` diferenciado en los
        3 botones "Copiar" del modal de credenciales (antes los 3
        decían solo "Copiar", ambiguo para lector de pantalla).
      - `node --check` limpio en `control.js`, Jest `control/`
        **117/117 (8 suites)** sin regresión (cero cambios de backend).
        Rebuild real del frontend (`--no-cache` + `--force-recreate`,
        gotcha ya conocido del punto 108) y **validado por HTTP contra
        el contenedor real**: `admin.css`/`control.html`/`control.js`
        sirviendo las 3 clases/funciones nuevas. Sin clics en navegador
        real en esta sesión (sin extensión de automatización
        disponible) — se abrió `http://localhost:8088/control` en el
        navegador del usuario para que lo revise al volver.
      **Dejado sin tocar, documentado en un Artifact (antes/después +
      tabla de hallazgos) para que el usuario decida al volver** — son
      decisiones de producto, no bugs mecánicos:
      1. Selector de tipografía en "Identidad visual" no hace nada (la
         fuente elegida nunca se aplica, congelada a Inter desde el
         punto de la regla 2026-08-24) — ¿quitar el selector o
         reactivar la funcionalidad real?
      2. Usuario de sucursal (§58): el backend
         (`actualizarUsuarioSucursal`) ya soporta cambiar password/
         perfil, la UI solo expone activar/desactivar — ¿agregar el
         campo?
      3. Endpoint `PUT /tenants/:slug/marca` sin ningún uso desde la
         UI real (solo tests/Swagger, la edición real pasa por el PUT
         general) — ¿dejarlo documentado como acceso directo por API o
         retirarlo?
      4. Sin test unitario propio en `control/` para `tenantTema.js`
         (contraste WCAG AA) ni `apiCredenciales.js` (hash/rotación de
         credenciales) — ¿prioridad para la siguiente sesión?
      **Commiteado** (a pedido explícito del usuario, mismo día):
      `65940cc` (modales + blur + accesibilidad) y `08a3ea7` (limpieza
      de `archivoPrueba.txt` + `.swarm/` a `.gitignore`). Sin push.

  165. **Modal "Registrar venta" (/admin) — 3 mejoras de UI IMPLEMENTADAS
      Y VALIDADAS contra Docker real (2026-08-31)**: usuario compartió
      captura del modal (con inventario activo) pidiendo propuesta de
      mejora. Propuesta en Artifact (antes/después) con 3 cambios
      independientes, aprobados los 3 ("Me encanta tu propuesta,
      aplicala"):
      - **A — Emoji → SVG**: el toggle "¿Cómo se entrega?" era el único
        lugar del panel que todavía usaba emoji (📧/🖨️) como ícono real
        de UI — inconsistente con Cuentas por cobrar (punto 141), que ya
        los había quitado en todos lados. Reemplazados por 2 SVG inline
        (`currentColor`, heredan el color activo/inactivo del toggle sin
        CSS nuevo por estado).
      - **B — Encabezados de sección** (`.orden-seccion-label`, solo
        ≥901px): "Producto" / "Pago y entrega" / "Cliente" — puramente
        visuales, cero campos movidos de posición relativa. Colocado el
        de "Cliente" como primer hijo de `#orden-entrega-correo-wrap`
        para que se oculte solo junto con esa sección cuando el método
        de entrega es "Imprimir" (sin JS nuevo, efecto gratis de la
        lógica que ya existía).
      - **C — Grid de 2 columnas en escritorio**: nuevo wrapper
        `.orden-wizard-grid` alrededor de los 3 `.orden-wizard-paso`
        (Producto+Total apilados a la izquierda vía `grid-row`, Pago/
        Entrega/Cliente a la derecha con `grid-row: 1 / span 2`) — el
        modal ya media 820px (`.ticket-modal`) y se usaba en 1 sola
        columna de punta a punta. El wrapper es puro CSS (`display:grid`
        solo dentro de `@media (min-width: 901px)`); en móvil sigue
        `display:block` normal y el wizard de 3 pasos de siempre
        (`admin.js` selecciona `.orden-wizard-paso` por clase, sin
        asumir el padre) sigue funcionando sin ningún cambio de JS.
      Jest backend 781/781, control 117/117 (ningún cambio de backend).
      Rebuild `--no-cache`+`--force-recreate` y validado por HTTP contra
      el contenedor real (las 3 clases nuevas confirmadas en el HTML/CSS
      servidos). Sin clics en navegador real en esta sesión (sin
      extensión de automatización disponible). Sin commit/push todavía.

  166. **"Configuraciones globales" (/admin) rediseñada como ventana
      emergente — IMPLEMENTADA, VALIDADA POR HTTP contra Docker real
      (2026-08-31)**: a partir de 2 capturas del usuario (la vista actual
      de 6 tarjetas plegables + el modal de Configuración de Claude como
      referencia de patrón), propuesta antes/después en Artifact aprobada
      completa ("Sí, implementa todo el segmento"). Pasa de ser una vista
      más del sidebar (6 `.admin-config-card` independientes, cualquier
      combinación podía quedar abierta a la vez) a un modal con barra
      lateral minimalista + buscador — una sección visible a la vez.
      **Cero cambio de contenido**: las 6 secciones (Campos obligatorios,
      Configuraciones fiscales, Correo SMTP, Configuración Reportes,
      Ventas, Inventarios) conservan su HTML/ids/lógica de guardado
      intactos, solo cambia el contenedor que decide cuál se ve — mismos
      permisos por perfil de siempre (`tarjetasConfigPermitidas`, Fiscal
      solo ve 2 de las 6, Administrador ve otras 4, SMTP solo perfil
      super) ahora también deciden qué aparece en la barra lateral del
      modal (misma fuente de verdad, un solo `forEach` en
      `aplicarRestriccionesPerfil()` sin duplicar la lista).
      **Decisión técnica clave para minimizar riesgo**: en vez de borrar
      los 6 botones `.admin-config-toggle` (acordeón viejo) y sus 6
      `addEventListener` dispersos por todo `admin.js`, se dejaron intactos
      en el DOM pero inertes (`pointer-events: none` + chevron oculto por
      CSS, solo dentro de `.config-modal-main-body`) — cero riesgo de
      romper el badge de estado de SMTP (`smtp-estado-badge`, vive dentro
      de ese mismo botón) ni ninguno de los 6 handlers ya probados.
      `cargarConfigSmtp()` antes solo se disparaba al abrir su acordeón
      (gesto que ya no existe) — se agregó a la carga eager de
      `abrirConfigModal()` junto con los otros 4 `cargar*` que ya se
      disparaban al entrar a la vista. Móvil: lista primero (con
      buscador), al tocar una sección se reemplaza por su contenido con
      flecha "← Volver" (mismo criterio que el menú de `/control`) — CSS
      puro (`.is-oculta-movil`, sin JS de matchMedia/resize). Buscador
      v1 filtra solo por nombre de sección (no por contenido de campos).
      Sección que se ve al abrir = la primera visible para el perfil de
      quien entra (nunca hardcodeada). Cambios de `admin.js`: nuevo
      bloque "Modal Configuraciones globales" (`CONFIG_SECCIONES`,
      `seleccionarSeccionConfig`, `filtrarNavConfig`, `abrirConfigModal`/
      `cerrarConfigModal`), quitado el caso `'configuraciones'` de
      `cambiarVistaPrincipal()` (ya no es una vista — evita el bug de
      "todas las vistas ocultas" si `sessionStorage` tuviera guardado ese
      valor viejo, por eso también se quitó de `botonesPorVista` en el
      restore de sesión), el botón del sidebar y el ícono del launcher
      móvil ahora llaman a `abrirConfigModal()` en vez de
      `cambiarVistaPrincipal('configuraciones')`. HTML: `id` del
      contenedor renombrado de `vista-configuraciones` a
      `config-modal-overlay` (mismo patrón `*-modal-overlay` del resto
      del sitio); `role="tab"` del botón del sidebar cambiado a
      `aria-haspopup="dialog"` (ya no participa del sistema de tabs de
      vistas). Jest backend **781/781** (sin cambios de backend).
      Rebuild `--no-cache`+`--force-recreate` y validado por HTTP contra
      el contenedor real (los 6 nav items, las clases CSS nuevas y las 3
      referencias a `abrirConfigModal` confirmadas en lo servido; el
      `id="vista-configuraciones"` viejo confirmado ausente). **Sin
      clics en navegador real en esta sesión** (sin extensión de
      automatización disponible, mismo aviso que los puntos 164/165) —
      pendiente que el usuario lo confirme visualmente. Sin commit/push
      todavía.
      **Bug real reportado por el usuario y corregido el mismo día**: al
      probar en vivo, ningún campo de ninguna sección era interactuable
      ("no puedo configurar nada") — causa raíz: `style.css` tiene una
      regla global `[hidden] { display: none !important; }` (a propósito,
      para que `hidden` siempre gane sin importar otro `display` — ver el
      comentario ahí mismo) que le ganaba a la regla CSS de este punto
      que intentaba forzar visible `.admin-config-body` de la sección
      activa; como el botón viejo que le quitaba el atributo `hidden` a
      esa caja quedó inerte a propósito (`pointer-events:none`), nada
      volvía a quitárselo nunca, así que TODAS las secciones se quedaban
      con su contenido real oculto para siempre — solo se veía el título
      de la sección activa, cero campos. Fix: `seleccionarSeccionConfig()`
      ahora quita/pone `hidden` en `.admin-config-body` por JS
      directamente (mismo mecanismo exacto que ya usaba el acordeón
      viejo), la regla CSS quedó solo cosmética (padding/borde). Jest
      781/781 de nuevo, rebuild y validado por HTTP contra el contenedor
      real (JS servido con el fix, CSS viejo confirmado ausente).
      **Confirmado por el usuario en navegador real** ("ya lo revisé, ya
      funciona"). Sin commit/push todavía.
      **Ícono de "Cuentas por cobrar" mejorado el mismo día**: usuario
      reportó que el ícono (tarjeta con una moneda) no comunicaba
      "pendiente por cobrar". Reemplazado por "documento + reloj"
      (geometría de Lucide `file-clock`, MIT, adaptada al stroke-width
      1.6-1.7 ya usado en el resto de íconos del sidebar) en los 2 únicos
      lugares donde vivía (sidebar de escritorio y grid del menú móvil).
      Validado por HTTP contra el contenedor real tras rebuild. Sin
      commit/push todavía.
      **Fix del campo Slug encimado en "Editar empresa" (mismo día,
      reportado por el usuario con captura)**: el grid de 2 columnas del
      punto 164 no consideró que Slug es el único de los 6 campos con
      layout compuesto (input + switch "Cambiar slug (avanzado)",
      `.control-slug-fila`) — necesita ~420px, media columna solo daba
      ~380px, se encimaba. Fix: clase nueva `.control-form-grid-full`
      (`grid-column: 1 / -1`) en Slug y Notas (ambos a ancho completo,
      su propia fila); Logo se reacomoda junto a Correo de contacto.
      "Nueva empresa" no tenía el bug (su slug no lleva switch) y no se
      tocó. Propuesta antes/después en Artifact aprobada antes de
      implementar. Control Jest 117/117, validado por HTTP contra Docker
      real tras rebuild.
      **Ese primer fix NO era la causa real — el usuario lo confirmó
      seguía encimado incluso en incógnito.** Se armó un script Playwright
      desechable (`e2e/diag-slug.js`, login real + abrir "Editar empresa"
      + `getBoundingClientRect`/`getComputedStyle` de cada pieza contra
      el contenedor real, borrado al terminar) para medir el layout de
      verdad en vez de seguir adivinando por lectura de código — reveló
      la causa real: `.field label { display: block; }` (`style.css`)
      le gana en especificidad a `.control-switch { display: inline-flex; }`
      (`admin.css`) porque el switch ES un `<label>` dentro de un
      `.field` — el switch perdía su layout flex por completo, su
      track (`.control-switch-track`) colapsaba a **0px de ancho** (un
      `<span>` sin `display` explícito es `inline`, ignora `width/height`
      fuera de un contexto flex) y el círculo del toggle (`::after`,
      `position:absolute`) quedaba flotando encima del texto de al lado
      — el encimado real, sin ninguna relación con el ancho de columna.
      Este bug existía desde que se creó el switch (segmento "Edición",
      punto 104), la corrección de ancho completo de arriba nunca lo iba
      a arreglar. Fix real: `.field .control-switch` (especificidad
      mayor, no depende del orden de las hojas de estilo) fuerza
      `display: inline-flex` a pesar de `.field label`. **Validado
      empíricamente con el mismo script Playwright tras el rebuild**:
      track ahora mide 40px reales, sin overlap con el input ni con el
      texto (coordenadas antes/después comparadas) — captura de pantalla
      real confirmó el switch limpio. Control Jest 117/117.
      **Commiteado y pusheado** (`c65b6a4` → `fact/master`).

  167. **PENDIENTE — Generador de etiquetas de código de barras para
      productos de Inventarios (2026-08-31, solo registrado, SIN
      analizar/criticar/implementar todavía)**: petición textual del
      usuario — generar la plantilla de etiqueta con el código de barras
      de cada producto YA dado de alta en Inventarios (no altas nuevas,
      son productos existentes), y que el usuario pueda elegir el
      formato de impresión al generarla: impresora térmica (rollo de
      etiquetas, formato angosto) o una hoja tamaño carta (varias
      etiquetas por hoja, para impresora normal). Sin decidir todavía: qué
      simbología de código de barras usar (los productos ya tienen un
      campo `codigo_barras`/SKU del motor de Inventarios — confirmar
      cuál se usa y si ya es compatible con una simbología estándar
      tipo Code128/EAN antes de generar el gráfico), tamaño exacto de
      etiqueta térmica (depende del modelo de impresora del cliente,
      no asumido), cuántas etiquetas por hoja carta y con qué
      márgenes, si permite elegir 1 producto o un lote/selección
      múltiple, si arrastra también nombre/precio en la etiqueta o solo
      el código, y si esto vive dentro de la vista "Inventarios" o como
      herramienta aparte. **Siguiente sesión**: aplicar el protocolo
      completo (analizar código real de Inventarios, revisar impacto,
      criticar y mejorar el requerimiento con las preguntas de arriba,
      propuesta visual antes/después, esperar confirmación explícita)
      antes de tocar código — instrucción explícita del usuario de NO
      implementar nada en esta sesión.
  168. **"Corte del día" en Ventas — IMPLEMENTADO Y VALIDADO en
      navegador real (2026-08-31/09-01)**: usuario pidió un botón para
      "hacer el corte del día o varios días", manual, con selector de
      días, que genera un reporte de lo vendido. Protocolo completo
      aplicado — Artifact con antes/después + 2 alternativas (Opción A:
      reporte de consulta repetible, sin marcar nada; Opción B: corte de
      caja real, exclusivo, marcando las ventas incluidas) — usuario
      eligió explícitamente, por preguntas separadas: **Opción A**,
      rango de fechas libre (desde-hasta, no "últimos N días"), **solo
      Ventas** (sin Gastos/CxC), salida **pantalla + imprimir** (sin
      correo), y **sí persiste** en "Lectura de reportes". Al aprobar,
      el usuario avisó que deja el equipo — ver memoria persistente
      `project_handoff_equipo.md`, documentar con doble cuidado de aquí
      en adelante.
      - **Backend**: `POST /api/admin/reportes/corte`
        (`requireAdminArea('administrador')`, mismo candado que el
        resto de Ventas) — recibe `{desde, hasta}` (YYYY-MM-DD),
        valida rango, consulta `ordenes_compra` en `[desde, hasta+1día)`
        (incluye archivadas por cierre mensual a propósito — mismo
        criterio que `/resumen-financiero`: es histórico de lo vendido,
        no una lista de pendientes), calcula subtotal/IVA/total/
        facturado/sin-facturar/cobrado/pendiente-de-cobro en JS a partir
        de una sola consulta (mismo patrón `EXISTS ticket estatus=
        'listo'` que ya usa el listado de Ventas), y persiste vía
        `guardarReporte()` (ya existía en `utils/reportes.js`, no manda
        correo) con `tipo:'corte'` — reutiliza la infraestructura de
        reportes existente en vez de duplicarla (la crítica del paso 3
        del protocolo señaló que `/reportes/enviar` ya existía pero
        fijo a "desde inicio de mes" + tickets+ventas + correo siempre;
        el corte necesitaba algo distinto, no un reporte nuevo desde
        cero). Migración de `chk_reportes_tipo` (CHECK constraint) para
        aceptar `'corte'`, con rama de migración para instalaciones que
        ya tenían `'cierre_mensual'` pero no `'corte'`.
      - **Frontend**: botón "Corte del día" junto a "+ Registrar venta"
        en Ventas; modal con desde/hasta + resultado (grid de 8 cifras)
        + "Imprimir" (mismo patrón `@media print` de un solo elemento
        visible que el ticket de venta del punto 130 — `#corte-imprimir`,
        hijo directo de `<body>`, sin ventana nueva). "Lectura de
        reportes" reconoce el tipo `'corte'` con su propia etiqueta
        ("Corte de ventas") en los 3 lugares donde se mostraba
        "Automático"/"Manual"/"Cierre mensual".
      - **Pruebas**: 5 tests nuevos en
        `test/integration/ordenes-compra.test.js` (400 sin fechas, 400
        desde>hasta, 403 perfil fiscal, cálculo correcto con 2 ventas
        mixtas — una pagada+facturada, otra pendiente+sin facturar —,
        rango vacío). Jest backend **786/786 (45 suites)**.
      - **Validado contra Docker/MySQL reales**: rebuild `--no-cache` +
        `--force-recreate` backend+frontend, ciclo completo por curl
        (2 ventas de prueba, corte con cifras exactas, aparece en
        `GET /reportes` con `tipo:'corte'`), limpieza de los datos de
        prueba después. **Validado en navegador real** (Claude in
        Chrome): login, abrir modal, generar corte vacío (empty state
        correcto) y con datos reales (cifras exactas: $125 subtotal/$20
        IVA/$145 total/$58 cobrado/$87 pendiente), botón Imprimir
        confirmado que llena `#corte-imprimir` y llama a `window.print()`
        (interceptado en la prueba, sin bloquear), aparece en "Lectura
        de reportes" con la etiqueta "Corte de ventas", cero errores de
        consola. **Gotcha de esta sesión, no del código**: el primer
        intento de login vía el tool `computer` (clicks/screenshot)
        dejó el botón en "Entrando…" indefinidamente y las screenshots
        empezaron a fallar con timeout de CDP — mismo síntoma que el
        punto 155 (rodeo ya documentado: usar `javascript_tool` con
        `.click()` directo funciona limpio). Datos de prueba limpiados
        al terminar (ventas OC-000168/169/170/171 y sus reportes de
        corte). **Commiteado y pusheado** (`664b36e` → `fact/master`).
  169. **"Lectura de reportes" reorganizada por segmento + pestaña
      "Cortes" — IMPLEMENTADO Y VALIDADO en navegador real
      (2026-09-01)**: a partir de 2 capturas del usuario (pestañas
      "Por reporte/Todo lo eliminado/Estado del inventario" + las 3
      tarjetas de auditoría de arriba), pidió que todo se agrupe por
      segmento (nada fuera de su pestaña), una pestaña "Cortes" nueva, y
      auditoría UX/UI/CX pensada para un dueño de negocio sin formación
      en sistemas. Protocolo completo — Artifact con 4 hallazgos +
      antes/después + decisión A/B — aprobado con "Opción A, orden así,
      textos bien" (pregunta 4, simplificar jerga de las tarjetas, se
      dejó sin resolver — sigue como "Movimientos (histórico)"/
      "fotografías de registros..." tal cual, nadie lo confirmó).
      - **Hallazgo #1 corregido**: las 3 tarjetas de auditoría
        (`#reportes-kpi-grid`) vivían ANTES del switch de pestañas — se
        veían en las 4 sin importar cuál estuviera activa. Se movieron
        DENTRO de "Todo lo eliminado" (única dueña real de esos datos) y
        su carga (`cargarEstadisticasReportes()`) pasó de dispararse
        siempre al entrar a la vista, a perezosa (una sola vez, al
        entrar por primera vez a esa pestaña — mismo patrón
        `invEstadoCargado` que ya usaba "Estado del inventario").
      - **Hallazgo #2 corregido**: letrero de una línea
        (`#reportes-tab-caption`, reusa `.panel-subtitle`) bajo las 4
        pestañas, cambia de texto según cuál esté activa.
      - **Hallazgo #3 corregido — pestaña "Cortes" nueva**: los cortes de
        ventas (punto 168) ya NO aparecen en el selector de "Por
        reporte" (`cargarListaReportes()` los filtra) — tienen su propia
        lista (`GET /admin/reportes` ya devuelve todo, se filtra en
        cliente por `tipo==='corte'`) con Generado/Rango cubierto/
        Ventas/Total, click → detalle. El detalle de un corte es MÁS
        SIMPLE que el de "Por reporte" a propósito (una sola tabla de
        ventas, sin split Movimientos/Eliminados) porque un corte nunca
        borra nada — reusa `renderFilaReporteItem()` tal cual (cero
        duplicación de lógica de fila) y el botón "Ver historial" de
        cada fila ya funciona solo (delegado a nivel documento, no hace
        falta enganche nuevo). Exportar CSV/Excel y Eliminar reusan los
        endpoints genéricos `/reportes/:id/exportar` y
        `DELETE /reportes/:id` que ya existían, sin cambios ahí.
      - **Opción A (decisión del usuario)**: columna nueva
        `reportes.total_monto` (DECIMAL NULL, solo se llena para
        `tipo='corte'`, vía `guardarReporte({..., totalMonto})` —
        parámetro nuevo, NULL por defecto para todos los demás tipos)
        para que la lista de Cortes muestre el Total $ sin abrir cada
        uno. Migración + CREATE TABLE actualizados en `db.js`.
      - **Bug propio corregido en el camino, no reportado por el
        usuario**: `rango_fin` de un corte se guardaba con el límite
        EXCLUSIVO real de la consulta (el día siguiente a "hasta") — un
        corte de un solo día se habría mostrado como "01 sep – 02 sep"
        en la lista nueva. Nunca se notó antes porque ningún lugar
        mostraba `rango_fin` a un humano hasta esta pestaña. Fix: se
        guarda 1 segundo antes (23:59:59 de "hasta") solo para
        mostrar/Markdown, la consulta real ya había corrido con el
        límite exclusivo correcto — cero impacto en qué ventas entran al
        corte, sí en cómo se ve la fecha. Validado en vivo: rango de un
        corte de un solo día se ve "01 sep 2026 – 01 sep 2026", correcto.
      - **Pruebas**: 2 tests nuevos (`totalMonto` se guarda/es NULL en
        `test/unit/reportes.test.js`; aserción `totalMonto: 348` agregada
        al test existente del endpoint de corte). Jest backend
        **787/787 (45 suites)**.
      - **Validado contra Docker/MySQL reales**: rebuild `--no-cache` +
        `--force-recreate`, columna `total_monto` confirmada en MySQL
        real, corte generado por curl con rango de un día mostrando
        fechas correctas (`rango_fin` = 23:59:59 del mismo día).
        **Validado en navegador real** (Claude in Chrome, vía
        `javascript_tool` desde el login para evitar el gotcha del punto
        155): las 4 pestañas en el orden aprobado, caption correcto por
        pestaña, "Por reporte" ya sin cortes en su selector, "Cortes"
        mostrando el corte real ($116.00, rango correcto), detalle con
        la venta real renderizada, "Todo lo eliminado" con las 3
        tarjetas ahí y solo ahí, ciclo completo de "Eliminar este corte"
        (modal de confirmación → eliminado → lista vacía), cero errores
        de consola en toda la sesión. Datos de prueba limpiados al
        terminar (ventas OC-000172/173, el corte de prueba se borró
        desde la propia UI como parte de la validación). Sin
        commit/push todavía.
  170. **Correo de contacto de la empresa (alta en `/control`) + burbuja
      "Solicitar aclaraciones" en el portal del cliente — IMPLEMENTADO Y
      VALIDADO contra Docker/MySQL reales y en navegador real (2026-09-01)**:
      retomado el pendiente de arriba con el protocolo completo. Antes de
      implementar se resolvieron las 4 preguntas de diseño que habían
      quedado abiertas, vía `AskUserQuestion`: **sin persistencia en BD**
      (el correo ES el único registro), destino **el correo de contacto
      del tenant** (no el de CLARVO), **sin vista nueva en `/admin`** (solo
      llega por correo), y **sí reutiliza `construirCorreoBase()`** (mismo
      lenguaje visual homologado del punto 161).
      - **Segmento A — correo de contacto obligatorio**: el campo
        `contacto_email` YA EXISTÍA en `control_tenants.tenants` (columna
        nullable) con UI ya construida en `/control` pero sin validación
        real — pasó de opcional a **obligatorio** en `normalizarDatosBase()`
        (`control/utils/tenantIntake.js`, reutilizada tal cual por
        `tenantEdicion.js` — el alta Y la edición quedan cubiertas con un
        solo cambio). Frontend: asterisco + `field-hint` con ejemplo
        (`contacto@miempresa.com`) en los 2 modales de `/control`
        (alta/editar), validación bloqueante en JS espejo de la del
        backend. `req.tenant.contactoEmail` expuesto en
        `backend/utils/tenantContext.js` (columna agregada al SELECT del
        segmento 3) para que cualquier ruta del backend lo use sin
        resolver el tenant de nuevo.
      - **Segmento B — burbuja "Solicitar aclaraciones"**: `POST
        /api/aclaraciones` (`backend/server.js`, `requireUserAuth` +
        `submitLimiter`) — a diferencia del resto de correos de esta app
        (fire-and-forget con `.catch()`, porque siempre hay una fila de
        BD de respaldo si el envío falla), este SÍ espera (`await`) el
        envío y responde con el error real si falla, precisamente porque
        aquí no hay ninguna fila de respaldo — un fallo silencioso
        perdería la solicitud sin dejar rastro. RFC tomado de la sesión
        (`req.userRfc`), nunca del body (blindado contra que alguien
        mande un RFC ajeno). "Número = ID + RFC" (requerimiento textual,
        sin fila autoincremental posible sin persistencia): se arma con
        `Date.now().toString(36).toUpperCase()-RFC`. 404 si el tenant no
        tiene `contactoEmail` configurado (tenants viejos que nunca lo
        llenaron). `GET /api/tema/:slug` (público, ya consumido por
        `theme.js` en las 3 páginas del portal) ganó el booleano
        `tieneAclaraciones` para que el frontend sepa si pintar la
        burbuja, sin exponer el correo real. Frontend: `frontend/
        aclaraciones.js` (nuevo, self-contained como `theme.js`/
        `offline.js`) se inyecta en `dashboard.html`/`tickets.html`/
        `csf.html` (las 3 páginas autenticadas del portal de cliente, no
        `/admin` ni `/control`) — burbuja fija inferior-derecha, modal
        reutilizando `.modal-overlay`/`.modal`/`.field` de `style.css`
        (no el `.ticket-modal` de admin, que es de otra app), vista de
        éxito con folio o error inline sin perder los datos capturados.
      - **Bug real encontrado y corregido en la validación contra Docker
        real (no detectable con Jest mockeado)**: el primer borrador
        devolvía `502` cuando el envío de correo fallaba — pero
        `frontend/nginx.conf.template` tiene `proxy_intercept_errors on`
        + `error_page 502 503 504 =503 /mantenimiento.html` en los 3
        `location` de API (líneas 218-219, 243-244, 296-297), pensado
        para una caída real del backend — intercepta CUALQUIER 502 de
        cualquier endpoint y lo reemplaza por la página estática de
        mantenimiento, disfrazando un fallo de aplicación (SMTP mal
        configurado) de "sitio caído completo". Cambiado a `500` (fuera
        de esa lista), confirmado en navegador real: el modal ahora
        muestra el mensaje real ("No se pudo enviar tu solicitud...")
        en vez de redirigir a mantenimiento.
      - **Validado de punta a punta contra Docker/MySQL reales y en
        navegador real (Claude in Chrome)**: login real en `piloto9c`
        (cuenta demo `GARC800101AB1`, password de prueba fijado para la
        validación), burbuja visible en dashboard Y tickets, modal abre
        con RFC pre-llenado y foco en Nombre, envío real dispara el
        pipeline completo (tenant→sesión→validación→plantilla de
        correo→intento de envío SMTP) y responde 500 con mensaje claro
        sin perder los datos capturados (SMTP no está configurado para
        ese tenant en este entorno — gap de infraestructura del entorno
        de prueba, no del código; el armado del correo en sí —
        destinatario/asunto/HTML con nombre/teléfono/detalle escapados —
        ya está cubierto por Jest con SMTP mockeado). Cero errores de
        consola. Jest backend **804/804 (46 suites)**, control 119/119
        sin cambios. Sin commit/push todavía.
  171. **"Lectura de reportes" — espaciado suelto corregido en TODA la
      sección (encabezado + tarjetas de Estado del inventario) —
      IMPLEMENTADO Y VALIDADO en navegador real (2026-09-01)**: a
      partir de 2 capturas del usuario ("desperdiciamos espacio con
      esas leyendas"), pidió extender el fix del punto 169 (tarjetas
      230×230px) a TODA la sección, no solo las tarjetas. Protocolo
      completo — Artifact con causa raíz MEDIDA EN VIVO (JS en el
      navegador, no estimada) + antes/después, corregido una vez por
      pedido del usuario para usar los SVG reales de las 3 tarjetas
      (política de cero emojis del sitio, que también aplica a los
      mockups — ver memoria persistente
      `feedback_sin_emojis_en_mockups.md`) en vez de emoji placeholder
      que se habían colado en el primer borrador. Aprobado tal cual.
      - **Causa #1 — encabezado**: `.lectura-reportes-header` usa
        `display:flex` con un solo hijo adentro (vestigio de un botón a
        la derecha que nunca se agregó) — eso rompe el colapso de
        márgenes normal entre el subtítulo (22px) y el contenedor
        (18px propios), dejando 40px reales medidos en el navegador en
        vez de los ~22px que usa el resto del panel (Ventas, CxC,
        Gastos). Fix: se quita el `margin-bottom:18px` del contenedor —
        el subtítulo ya aporta su propio margen, igual que en las demás
        vistas. Afecta a las 4 pestañas por igual (el hueco era del
        encabezado completo).
      - **Causa #2 — tarjetas**: mismo hallazgo del punto 169
        (`#inv-estado-kpi-grid` heredaba el cuadrado 230×230px de
        `.reportes-kpi-grid`, pensado para una fila que en "Todo lo
        eliminado" sí incluye una gráfica) — ahora tiene su propio
        override por id (`grid-template-columns:1fr` en vez de 230px
        fijo, alto natural en vez de forzado, con su propio breakpoint
        móvil espejo del original) sin tocar la clase compartida.
        "Todo lo eliminado" se queda exactamente igual (230×230px,
        justificado ahí por la gráfica "Eliminados por mes").
      - **Medido en vivo, antes → después**: hueco encabezado→pestañas
        40px → **22px**; alto de las 3 tarjetas de inventario 230px →
        **122px** (las 3 iguales, se estiran a la que tiene más texto).
        ~126px menos de alto total antes de llegar a las gráficas de
        abajo, sin perder ni reordenar ningún contenido.
      - Cambio 100% CSS (`admin.css`), sin tocar HTML ni JS. Jest
        backend 787/787 (sin cambios ahí, corrido por sanidad). Validado
        contra Docker real (rebuild `--no-cache` + `--force-recreate`
        frontend) y en navegador real (Claude in Chrome): mediciones
        confirmadas exactas contra lo prometido en la propuesta, "Todo
        lo eliminado" confirmado intacto (230×230px sin cambios), cero
        errores de consola. Sin commit/push todavía.
  172. **"Lectura de reportes" — letrero pegado al subtítulo, pestañas
      abajo (2026-09-01, IMPLEMENTADO Y VALIDADO)**: a pedido del
      usuario (2 capturas: pestañas vs. letrero "para que no parezca
      separado los textos"), se reordena el bloque — antes
      subtítulo→pestañas→letrero, ahora subtítulo→letrero→pestañas→
      contenido — para que las 2 líneas de texto (subtítulo del
      encabezado + letrero de la pestaña activa) se lean como un solo
      bloque, con las pestañas como frontera clara antes del contenido
      interactivo. Clase nueva `.lectura-reportes-tabs` (además de
      `.view-toggle`, compartida por 11+ lugares del panel, sin tocar
      su margen general) para el espacio antes del contenido. De paso,
      a pedido explícito ("elimina —"), se quitó el guión largo del
      subtítulo del encabezado ("...expórtalos — pensado para
      auditorías..." → "...expórtalos. Pensado para auditorías...").
      Medido en vivo: subtítulo→letrero 22px (mismo ritmo que el resto
      del panel), letrero→pestañas 22px, pestañas→contenido 22px — las
      4 pestañas siguen cambiando de contenido correctamente tras el
      reorden. Cambio 100% HTML/CSS. Jest backend 787/787 (sin
      cambios). Sin commit/push todavía.
  173. **Bug real — "Registrar venta" desbordaba horizontalmente al
      agregar el primer producto (2026-09-01, ENCONTRADO Y CORREGIDO,
      reportado por el usuario con captura)**: `.admin-table` fija
      `min-width: 760px` (pensada para las tablas grandes con columnas
      arrastrables de Ventas/Tickets/etc., que sí tienen esa función) —
      la tabla chica de productos dentro del modal "Registrar venta"
      (`.orden-productos-tabla-escritorio`, 5 columnas, sin resize) la
      hereda sin necesitarla. Ya existía un override
      `.orden-productos-tabla { min-width: 0; }` en el archivo, pero
      **nunca ganaba** — misma especificidad que `.admin-table` pero
      declarado ANTES en la hoja de estilos, así que `.admin-table`
      (declarado después) se lo comía por orden de cascada. Efecto
      real, solo visible AL AGREGAR el primer producto (antes de eso la
      tabla ni existe en el DOM): dentro de `.orden-wizard-grid` (2
      columnas `1fr 1fr` en escritorio), la tabla forzaba su columna a
      760px y la columna vecina ("Pago y entrega"/"Cliente") se
      aplastaba a ~175px, desbordando el modal completo — scrollbar
      horizontal, campos del lado derecho ilegibles/cortados. Fix en 2
      pasos (el primero, `min-width:0` con más especificidad, generó
      un bug DISTINTO — la tabla colapsó tanto que el texto del
      producto se envolvía letra por letra, porque `table-layout:fixed`
      -heredado también de `.admin-table`, pensado para anchos de
      columna guardados por JS que esta tabla no tiene- repartía el
      ancho en 5 franjas iguales sin sentido): (1)
      `.orden-productos-tabla.orden-productos-tabla-escritorio` (2
      clases, gana sin depender del orden del archivo) con
      `table-layout: auto` (deja que cada columna respete su
      contenido real) + `min-width: 320px` (piso razonable, ni 0 ni
      760px). Validado en navegador real tras el fix real: sin
      scrollbar horizontal (`modal.scrollWidth === modal.clientWidth`),
      2 columnas parejas, tabla de productos legible, Total calculado
      correcto ($2,146.00 = $1,850 × 1.16 IVA). Cambio 100% CSS,
      cero riesgo a otras tablas (selector de 2 clases, solo afecta
      este elemento exacto). Jest backend 787/787. Sin commit/push
      todavía.
  174. **Títulos de página homologados a 24px/700 en todo el panel
      (2026-09-01, IMPLEMENTADO Y VALIDADO)**: usuario reportó, con 3
      capturas, que algunos títulos ("Resumen financiero", "Ventas") se
      veían más grandes que "¡Bienvenido, admin!" (Inicio) y pidió
      homologarlos. **Medido en vivo antes de tocar nada** (la premisa
      literal no cuadraba): Inicio y "Resumen financiero" YA eran
      idénticos (24px/700, `.inicio-bienvenida h1`); "Ventas"/"Tickets"
      eran en realidad más CHICOS (20px/600, `.admin-toolbar h1`), no
      más grandes — probablemente las capturas se veían distintas por
      zoom del navegador al pegarlas, no por CSS real. Encontrado el
      patrón real: 2 sistemas de título coexistiendo (24px para el
      bloque de bienvenida de Inicio/Resumen financiero/CxC/Gastos,
      20px para la barra `.admin-toolbar` de Ventas/Tickets/
      Constancias/Usuarios/Cuentas por cobrar/"Lectura de reportes").
      Usuario confirmó explícitamente subir todo a 24px como Inicio.
      Fix: `.admin-toolbar h1` y `.lectura-reportes-titulo` (h2 propio)
      pasan de 20px/600(sin peso) a 24px/700, igualando
      `.inicio-bienvenida h1`. **Efecto secundario real encontrado y
      corregido de paso**: "Cuentas por cobrar" tenía el título
      DUPLICADO (un `<h1>` en `.inicio-bienvenida` arriba + OTRO
      `<h1>` idéntico dentro de `.admin-toolbar-title`, junto al
      toggle Pendientes/Cobradas) — antes disimulado porque uno era
      24px y el otro 20px, ahora que ambos quedan en 24px/700 se veían
      dos títulos idénticos apilados. Se quitó el `<h1>` redundante de
      la barra de herramientas (el de arriba ya cumple esa función),
      dejando solo el view-toggle ahí. Verificado que Inicio/Resumen
      financiero/Gastos no tienen ese mismo problema (un solo `<h1>`
      cada uno). Cambio 100% HTML/CSS. **Gotcha de esta sesión**: el
      primer screenshot después del rebuild seguía mostrando el título
      duplicado — el HTML servido por curl ya estaba correcto, era
      caché de disco del navegador en esta misma pestaña (gotcha ya
      documentado varias veces en este archivo); un reload con
      query-string nuevo lo confirmó corregido. Jest backend 787/787,
      validado en navegador real (Ventas, Cuentas por cobrar), cero
      errores de consola. **Commiteado y pusheado** (`c831b36` →
      `fact/master`, junto con los puntos 171-173).
  175. **Cantidad entera vs. decimal según la unidad de medida — Ventas
      (2026-09-01, IMPLEMENTADO Y VALIDADO)**: usuario pidió que la
      cantidad capturada al vender un producto de inventario respete su
      unidad de medida — de conteo (piezas, bultos, costales, cajas)
      exige entero; de medida continua (litros, gramos, kilos) admite
      decimales. Antes `#orden-inventario-unidades` aceptaba decimales
      para CUALQUIER producto sin importar su unidad (`step="0.001"`
      fijo) — ninguna validación real, ni en frontend ni en backend.
      - **Columna nueva** `unidades_medida.permite_decimales` (TINYINT,
        default 1) — `UNIDADES_SEED` en `utils/inventario.js` ahora
        clasifica las 16 unidades: conteo (Pieza/Caja/Paquete/Bolsa/Par/
        Juego/Rollo/Tarima) = 0, medida continua (Kilogramo/Gramo/
        Litro/Mililitro/Metro/Centímetro/Metro cuadrado/Metro cúbico) =
        1. Migración + backfill idempotente por nombre en `db.js` (las
        instalaciones que ya tenían las 16 unidades sembradas con el
        default se corrigen a la clasificación real).
      - **Un solo choke-point**: la validación vive DENTRO de
        `registrarMovimiento()` (con el producto ya bloqueado, así se
        conoce su unidad real) — cubre venta, entrada, ajuste por
        igual, sin duplicar la regla por cada llamador. Error nuevo
        `INV_CANTIDAD_DEBE_SER_ENTERA` (400) agregado a los 3 mapas de
        status HTTP que ya traducían errores de `registrarMovimiento()`.
      - **Frontend**: `/productos/buscar` (usado por el buscador de
        Ventas) ahora expone `unidad_nombre`/`unidad_abreviatura`/
        `permite_decimales` por producto — al seleccionar uno, el campo
        "Cantidad" ajusta su `step` (1 vs 0.001) y su etiqueta muestra
        la unidad real (antes fija en "piezas" sin importar el
        producto) — ej. "Cantidad (L)" para un producto en litros.
        Validación duplicada en cliente (mismo criterio que el backend)
        para no esperar el viaje de ida y vuelta con un error evitable.
      - **Pruebas**: 6 tests nuevos en `test/unit/inventario.test.js`
        (rechazo/aceptación cruzando unidad de conteo/continua × venta/
        entrada, incluido el ejemplo textual del usuario — "Costal") +
        1 test de integración en `test/integration/ordenes-compra.test.js`
        confirmando que el error llega como 400 (no 409) hasta la
        respuesta HTTP de Ventas. Jest backend **794/794 (45 suites)**.
      - **Validado contra Docker/MySQL reales**: columna y backfill
        confirmados en MySQL real (las 16 unidades con la clasificación
        correcta), ciclo completo por curl (producto en Litro + entrada
        decimal + venta decimal → aceptado; producto en Pieza + entrada/
        venta con decimales → `INV_CANTIDAD_DEBE_SER_ENTERA`; Pieza con
        entero → aceptado). **Validado en navegador real** (Claude in
        Chrome): label y `step` cambian al seleccionar cada producto,
        error inline en cliente para Pieza+decimales sin llegar al
        servidor, ambos productos agregados correctamente a la lista de
        la venta con sus subtotales exactos, cero errores de consola.
        Datos de prueba limpiados al terminar. **Commiteado y pusheado**
        (`3aeb1b8` → `fact/master`).
  176. **Bug real del punto 175 — el campo seguía dejando escribir un
      decimal a mano (2026-09-01, ENCONTRADO Y CORREGIDO, reportado por
      el usuario con captura: "Cantidad (pz)" mostrando "3.001")**: el
      fix del punto 175 solo cambiaba el atributo `step` del input —
      eso únicamente ajusta el incremento de las flechitas nativas del
      `<input type="number">`, **nunca** bloquea escribir o pegar un
      "." a mano (el navegador solo checa `step`/`min` al hacer submit
      de un `<form>` real, y este modal no usa uno) — la validación de
      "+ Agregar producto" seguía atrapándolo al final, pero el campo
      mismo dejaba verse/quedarse con el decimal hasta ese punto,
      justo lo que reportó el usuario.
      - **Fix**: listener de `input` en vivo sobre
        `#orden-inventario-unidades` — para un producto de unidad de
        conteo, cada tecla corta cualquier cosa después de un "."
        apenas aparece (mientras se teclea, no hasta el submit). De
        paso, `min` del campo también se ajusta junto con `step` (antes
        se quedaba fijo en 0.001 sin importar la unidad) y
        `autocomplete="off"` explícito (el campo no lo tenía, así que
        el navegador podía sugerir un valor decimal recordado de otro
        producto).
      - **Gotcha de esta sesión, no del código**: la primera prueba con
        tecleo simulado (sobreescribiendo `.value` con el setter nativo
        en vez de teclas reales) dio resultados sin sentido ("001") —
        un `<input type="number">` sanea silenciosamente a "" cualquier
        valor intermedio inválido (ej. "3.") cuando se asigna por
        `.value`, algo que NO pasa con tecleo real de teclado (el
        navegador sí deja ver el estado intermedio). Repetido con el
        tool `computer` (teclas reales vía CDP) para una prueba fiel —
        confirmó el fix: "3.001" tecleado en un producto Pieza nunca
        deja aparecer el punto, y "12" tecleado normal entra sin perder
        ningún dígito.
      - Cambio 100% frontend (`admin.js`), sin tocar backend (que ya
        rechazaba correctamente desde el punto 175 — esto cierra el
        hueco de que el campo lo mostrara ANTES de rechazarlo). Jest
        backend 794/794 (sin cambios, corrido por sanidad). Validado
        contra Docker real y en navegador real (Claude in Chrome, con
        tecleo real vía el tool `computer`): decimal bloqueado en vivo
        para Pieza, "+ Agregar producto" con 12 piezas entra
        correctamente ($1,800.00 = 12 × $150), cero errores de consola.
        Datos de prueba limpiados. **Commiteado y pusheado** (`3ebcd09`
        → `fact/master`).
  177. **Bug real de layout — "Precio unitario"/"Cantidad" desparejos
      en Ventas (2026-09-01, ENCONTRADO Y CORREGIDO, reportado por el
      usuario con una captura marcada a mano con línea roja)**: el
      primer reporte de "este elemento sigue desajustándose" no se
      pudo reproducir a simple vista (probado con tecleo real, sin
      encontrar nada raro) — el usuario mandó una SEGUNDA captura
      marcando el desajuste exacto con una línea roja, que sí lo hizo
      evidente: dentro de `.orden-productos-captura-fila` (grid de 2
      columnas, Precio unitario | Cantidad), SOLO la columna "Cantidad"
      tenía el texto `#orden-inventario-disponible-hint` ("Disponible:
      17") debajo de su input — "Precio unitario" no tenía nada
      equivalente, así que esa columna terminaba más arriba y las 2
      columnas no emparejaban en altura. No relacionado a los puntos
      175/176 (que sí estaban correctos) — un desajuste de layout
      preexistente, sin relación con la regla de enteros/decimales,
      que quedó más visible al estar mirando de cerca este mismo
      bloque.
      - **Fix**: el hint sale de la fila de 2 columnas — ahora vive
        debajo de AMBAS, a lo ancho completo (semánticamente correcto
        también: describe al producto seleccionado, no es exclusivo de
        la columna Cantidad). El error de validación por campo
        (`#error-orden-inventario-unidades`) se queda DENTRO de la
        columna Cantidad a propósito (un error debe anclarse a su
        campo, y es condicional/oculto por defecto — no causaba el
        desajuste en el estado normal).
      - Cambio 100% HTML (`admin.html`), sin CSS ni JS. Jest backend
        794/794 (sin cambios, corrido por sanidad). Validado contra
        Docker real y en navegador real: diferencia de altura entre
        ambas columnas medida en 0px (antes tenían un desnivel real,
        confirmado con `getBoundingClientRect()`), "Disponible: 17"
        ahora a ancho completo debajo de las 2 columnas, "+ Agregar
        producto" sigue funcionando igual, cero errores de consola.
        Sin commit/push todavía.
  178. **Bug real de seguridad/aislamiento multi-tenant — "/<slug>" sin
      página caía silenciosamente al sitio SIN tenant (2026-09-01,
      ENCONTRADO Y CORREGIDO, reportado por el usuario: "cuando entro por
      medio del contexto Slug, me redirecciona al principal sin tenant...
      puedo tener el mismo RFC en diferentes empresas, pero al
      direccionarme siempre a un sitio sin tenant, no respeta el slug")**:
      auditoría completa a pedido explícito del usuario. Antes de
      encontrar el bug real, se probaron y confirmaron CORRECTOS (contra
      Docker/MySQL reales, navegador real, mismo RFC registrado en 2
      tenants distintos con contraseñas distintas): login normal
      (`/<slug>/login`), registro con el mismo RFC en 2 tenants
      simultáneos (aislamiento de BD perfecto, cero mezcla), navegación
      cruzada mientras hay sesión de OTRO tenant (rebota correctamente al
      login DEL SLUG ACTUAL, nunca al sitio sin tenant),
      `admin`/`ADMIN_USERS` fallback en `/<slug>/admin` (scoping de BD
      correcto), y los links de "Ir a iniciar sesión" de
      `restablecer.html` (ya eran tenant-aware vía JS pese a que el HTML
      estático de respaldo dice `href="/login"` sin slug). **Causa raíz
      real**, en `frontend/nginx.conf.template`: los 2 `location` regex
      del segmento 4 (multi-tenant) solo cubren `/<slug>/admin` y
      `/<slug>/(dashboard|tickets|login|csf|restablecer)` — visitar
      **solo** `/<slug>` (sin página después, ej. un favorito guardado a
      la raíz del tenant, o alguien escribiendo la URL "obvia") no
      matchea ninguno de los dos, ni el `location = /login` de arriba
      (ese es exacto, sin slug) — cae al catch-all `location /` de más
      abajo, que sirve `login.html` vía `try_files` **sin cambiar la
      URL**. La barra de direcciones sigue mostrando `/<slug>` (parece
      estar en el contexto del tenant) pero el HTML servido es el mismo
      de siempre, y como esta ruta NO tiene forma `/<slug>/algo`,
      `frontend/login.js` (con la misma `RUTAS_PAGINA_MULTITENANT` +
      `segmentos.length >= 2` que usan `portal.js`/`admin.js`/
      `theme.js`/`aclaraciones.js`/`restablecer.js`, las 6 copias
      duplicadas a propósito del mismo patrón) no detecta ningún
      tenant — el formulario de login que VISUALMENTE parece del tenant
      en realidad autentica contra la BD base sin tenant
      (`portal_facturacion`). Si el RFC no existe ahí: "RFC o contraseña
      incorrectos" con credenciales que sí son válidas en el tenant real
      (confusión pura). Si el MISMO RFC sí existe en ambos — el escenario
      exacto que describió el usuario —, el login succede contra la
      empresa EQUIVOCADA y el JS redirige a `/dashboard` sin slug: el
      "sitio sin tenant" que reportó. **Reproducido en vivo antes de
      corregir**: `http://localhost:8088/piloto9c` sirve el login sin
      detectar tenant (confirmado con `window.Portal` inexistente y
      fallo de login con credenciales reales de `piloto9c`); tras el fix,
      el mismo login funciona. **Fix**: nuevo `location` regex
      `^/(?<tenant_slug>[a-z0-9][a-z0-9-]{0,48})/?$` (con o sin `/`
      final) que **redirige 302** a `/<slug>/login` — mismo criterio que
      ya usa `/` a secas (index `login.html`), pero explícito en la URL
      para que la detección de tenant SIEMPRE tenga 2 segmentos. **Bug
      propio encontrado y corregido en la validación**: la primera
      versión usaba `return 302 /$tenant_slug/login` (path absoluto) —
      nginx arma el `Location` con `$scheme://$host`, y `$host` NUNCA
      incluye el puerto; en este entorno de desarrollo (Docker mapeado a
      `:8088`) el navegador terminaba redirigido a `:80` (nada
      escuchando ahí), confirmado con `curl -D-`. Fix real:
      `$proxy_x_forwarded_proto://$http_host/$tenant_slug/login`
      (reutiliza el `map` que ya define este archivo para
      `X-Forwarded-Proto`, mismo criterio que `detectarUrlPortal` en el
      backend — respeta HTTPS real detrás del segundo nginx en
      producción). Validado contra Docker real: `/piloto9c` y
      `/pruebaadmin` → 302 con `Location` correcto (puerto incluido);
      las 8 rutas reservadas sin slug (`/`, `/login`, `/admin`,
      `/control`, `/dashboard`, `/tickets`, `/csf`, `/restablecer`)
      siguen en 200 sin regresión (ganan por `location =`, máxima
      prioridad de nginx, sin importar el nuevo regex); un slug
      inventado (`/totally-random-slug`) también redirige — consistente
      con el criterio ya documentado de que nginx nunca valida
      existencia de tenant, eso lo hace el backend. Validado en
      navegador real de punta a punta: `/piloto9c` → redirige a
      `/piloto9c/login` → login con RFC real de `piloto9c` → aterriza en
      `/piloto9c/dashboard`. Jest backend 804/804, control 119/119 (sin
      cambios, cambio 100% nginx). **Hallazgo secundario, NO corregido
      (fuera de alcance de este bug puntual, documentado para revisión
      futura)**: la cookie de sesión de cliente (`sesion_usuario`) usa el
      mismo nombre y `path=/` para TODOS los tenants — iniciar sesión en
      el tenant B en una pestaña SOBREESCRIBE la cookie de una sesión ya
      abierta en el tenant A en otra pestaña (confirmado en vivo: volver
      a la pestaña de A tras loguearse en B fuerza un 401 y redirige a
      `/A/login`, sin pérdida de datos pero con un logout silencioso e
      inesperado). No es el bug reportado (el redirect SÍ respeta el
      slug correcto en ese caso) y la firma del token igual se verifica
      contra el tenant correcto (HKDF por slug, segmento 3) — así que no
      hay fuga de datos entre tenants, solo una sesión que se pisa entre
      pestañas de distintos tenants. Cookies con nombre/path por tenant
      quedan como mejora futura, no bloqueante. Sin commit/push todavía.

  179. **Campos reducidos para `tipo=servicio` en Inventarios + carga
      masiva solo-producto (2026-09-01, ver `inventarios.md` §55,
      IMPLEMENTADO Y VALIDADO — Jest backend 807/807, control 119/119)**:
      protocolo completo (crítica del requerimiento + propuesta visual
      antes/después en Artifact + confirmación explícita del usuario, que
      además ajustó el alcance dos veces en vivo). Con `tipo=servicio`
      solo se piden/muestran 10 de los 14 campos —
      `nombre`/`sku`/`categoria`/`unidad_base` (fija en "Hora", nueva
      unidad del catálogo, la única con `permite_decimales=0` para este
      caso: **horas ENTERAS**, resuelve invirtiendo la duda que había
      quedado abierta)/`moneda`/`costo`/`precio`/`estado`/
      `proveedor_principal`/`notas`. `codigo_barras`/`stock_minimo`/
      `stock_maximo`/`punto_reorden` (los 4, el usuario sacó también
      `punto_reorden` de la lista original en la segunda ronda) quedan
      `NULL` sin importar lo que mande el body — forzado en
      `validarCuerpoProducto()` del lado del servidor (no solo oculto en
      el modal), así que tampoco se puede colar por API directa.
      **La carga masiva CSV/XLSX (§34) pasó a ser SOLO para
      `tipo=producto`** (pedido explícito del usuario, "los servicios sí
      o sí se configuran manualmente") — tiene su propio `INSERT`/
      `UPDATE` que NO pasaba por `validarCuerpoProducto()`, así que sin
      este ajuste el invariante de arriba no habría sido real por esa
      vía; una fila `tipo=servicio` se rechaza completa
      (`INV_IMPORT_SERVICIO_NO_PERMITIDO`), la plantilla CSV/XLSX ya no
      trae ejemplo de servicio ni lo ofrece en el desplegable de "tipo",
      y `inventarioCampos.js` (diccionario de ayuda del wizard) quedó
      anotado explícitamente. Migración idempotente en `ensureSchema()`
      (backfill de los 4 campos a NULL + unidad forzada a "Hora" para
      cualquier servicio que ya exista — nada en producción real hoy,
      solo tenants de prueba). 5 tests nuevos (2 en
      `test/integration/inventarios.test.js` para
      `validarCuerpoProducto`, 1 en `test/unit/inventarioImportacion.test.js`
      para el rechazo de la carga masiva, más el ajuste del ejemplo de
      plantilla a 2 filas producto-only). **Validado contra Docker/MySQL
      reales el mismo día** (usuario reportó con captura que no veía el
      cambio): causa real era el contenedor `frontend` corriendo la
      versión vieja (3h sin rebuild) — rebuild + `up -d --force-recreate`
      backend+frontend, y confirmado por curl real (no mockeado):
      `POST /productos` con `tipo=servicio` mandando código de barras/
      stock/unidad a propósito → la fila quedó con esos 4 campos en
      `NULL` y `unidad_id=17` ("Hora", recién sembrada), producto de
      prueba borrado después. **3 refinamientos de UX el mismo día, tras
      ver la captura real del usuario**: (1) placeholders de "Nombre"/
      "SKU" cambian de ejemplo según el tipo (`Ej. Consultoría fiscal`/
      `Ej. SERV-CONS-01` en servicio, en vez de mantener el ejemplo de
      tornillo); (2) la leyenda bajo el toggle "Tipo" pasó de 4 líneas a
      1 corta por tipo (el detalle completo sigue en el ícono "?"
      vecino, que no había cambiado); (3) botón "Guardar producto" →
      simplemente "Guardar" en alta (edición conserva "Guardar
      cambios", sin pedir eso). **Colapso animado de los 4 campos**
      (pedido explícito, "ajusta el tamaño de la ventana... responsivas
      a celular también"): se descartó la técnica de `grid-template-rows`
      del Artifact de propuesta (ambigua en un grid de 2 columnas real —
      el campo vecino en la misma fila puede sostener alto el track vía
      `align-items:stretch`, sin forma de confirmarlo sin navegador esta
      sesión) por un fundido de opacidad simple (150ms, clase
      `.inv-campo-colapsable`/`.inv-campo-saliendo` en `admin.css`,
      `hidden` real se pone/quita justo antes/después del fundido, nunca
      junto — `colapsarCampoInv()` en `admin.js`) — no elimina el
      reacomodo de layout, pero un campo ya invisible no se percibe como
      brinco; respeta `prefers-reduced-motion`; sin animación al abrir
      el modal (`animar` solo en los clics del toggle, no en
      `abrirProductoModal()`, para no parpadear al abrir). El modal
      (`.gastos-modal`) ya era responsivo antes de este punto (94vw +
      `max-height:calc(100vh-40px)` con scroll + grid a 1 columna
      <560px) — sin cambios ahí, mismo comportamiento en escritorio y
      celular. **Pendiente real**: la animación del fundido se validó
      solo por lectura de código + despliegue confirmado por curl (JS/
      CSS servidos), NO con clics reales en navegador — sin herramienta
      de navegador disponible en esta sesión (a diferencia de sesiones
      anteriores con la extensión Claude in Chrome). Jest backend
      807/807 (sin cambios de backend en esta ronda). **Extensión
      confirmada NO disponible en esta sesión de Claude Code CLI**
      (`ToolSearch` corrido 2 veces, cero resultado) — el usuario la
      tiene conectada en OTRA sesión suya en paralelo, imposible de
      tomar prestada entre sesiones distintas.

      **2 ajustes más el mismo día, a partir de 2 capturas nuevas del
      usuario**: (1) modal "Nuevo producto"/"Editar producto" ensanchado
      de 640px a 820px (clase nueva `.inv-producto-modal-ancho`, mismo
      ancho que `.ticket-modal` de Tickets — NO se tocó `.gastos-modal`
      base, que se queda en 640px para el popup de Gastos); (2) **bug
      real encontrado y corregido**: la tarjeta "Productos activos" del
      dashboard de Inventarios (`GET /inventarios/dashboard`) contaba
      TODOS los productos activos sin filtrar `tipo`, servicios
      incluidos — era la única de las 7 consultas del dashboard sin el
      filtro `tipo='producto'` que ya tenían las otras 6 (esas nunca
      contaban servicios de todos modos, porque `existencias`/
      `movimientos_inventario` nunca tienen filas de un servicio, D11 —
      exclusión estructural, no por filtro explícito). Corregido
      agregando `AND tipo = 'producto'`; tarjeta nueva e independiente
      "Servicios activos" (8va tarjeta, llena el hueco de la fila 2 en
      `#inv-kpis-wrap` — el grid ya era de 4 columnas, sin cambios de
      layout). **Validado en Docker/MySQL reales por curl**: estado base
      `productos_activos:12, servicios_activos:0` (coincide con la
      captura real del usuario); servicio de prueba creado →
      `servicios_activos:1` sin mover `productos_activos`; borrado
      después, contador de vuelta a 0. Jest backend 807/807 (test de
      Dashboard actualizado para diferenciar las 2 consultas — antes
      compartían el mismo mock por prefijo de SQL, ahora habría fallado
      con la clave nueva `servicios_activos` sin distinguir).
      **Confirmado por el usuario en navegador real** ("ya lo revisé, ya
      funciona") — modal ancho, fundido de los 4 campos, placeholders/
      leyenda/botón "Guardar" y la tarjeta "Servicios activos" todos
      validados con clics reales, no solo por curl. **Ajuste final el
      mismo día**: ícono de "Servicios activos" (maletín) cambiado a una
      persona (círculo + hombros, mismo estilo feather del resto del
      sitio) — pedido explícito del usuario, "los servicios son dados
      por personas". Rebuild frontend, confirmado servido y **validado
      por el usuario en navegador real** de nuevo. Con esto el punto 179
      completo (feature + los 3 refinamientos + el bug del dashboard +
      el ícono) queda implementado y validado de punta a punta. Sin
      commit/push todavía.

  180. **PENDIENTE — alta de proveedores como entidad propia en
      Inventarios (registrado 2026-09-01, ver `inventarios.md`,
      SOLO documentado, sin implementar)**: hoy `proveedor_principal` es
      texto libre por producto, sin FK — pedido explícito del usuario de
      anotar como mejora futura un catálogo de proveedores real
      (habilitaría, por ejemplo, filtrar/reportar por proveedor sin
      depender de que el texto se escriba idéntico cada vez). Sin
      preguntas de diseño resueltas todavía — seguir el protocolo
      `addv-web-app` completo antes de tocar código, mismo patrón que el
      punto 167.

  181. **"Proveedores" nuevo en el sidebar de `/admin` — solo placeholder
      "en construcción", IMPLEMENTADO Y VALIDADO en navegador real
      (2026-09-02)**: pedido explícito del usuario — segmento acotado a
      propósito, deja el CRUD real (que se conecta con el pendiente del
      punto 180) para una ronda de refinamiento aparte. Protocolo
      `addv-web-app` completo: propuesta visual antes/después en Artifact
      (mockup del sidebar actual vs. con el botón nuevo + vista de
      construcción) aprobada explícitamente ("Sí, implementa todo el
      segmento") antes de tocar código.
      - **Botón nuevo** `#btn-vista-proveedores` en `admin-sidebar-nav`
        (`frontend/admin.html`) — después de "Reportes", antes de
        "Configuraciones globales" (esa última siempre al final, regla
        ya establecida desde el punto 122). Espejo exacto en la grilla
        de íconos del menú móvil (`#admin-menu-movil`,
        `data-vista="proveedores"`), mismo patrón que el resto de las 10
        vistas — un solo botón nuevo por superficie, sin lista de
        restricciones aparte que mantener sincronizada.
      - **Ícono**: caja/paquete (`stroke-width:2`, 24×24), mismo lenguaje
        visual que los demás íconos del sidebar — evoca proveedor/insumo
        sin usar emoji (política del sitio, también aplica a mockups —
        ver memoria persistente `feedback_sin_emojis_en_mockups.md`).
      - **Vista destino** `#vista-proveedores`: placeholder puro, cero
        tabla/formulario/endpoint nuevo. Ícono en caja navy+cyan con
        animación de pulso (`@keyframes en-construccion-pulso`, solo
        `transform`/`box-shadow`, respeta `prefers-reduced-motion`) +
        texto "Proveedores está en construcción" + 3 puntos animados.
      - **Visibilidad**: mismo criterio que "Gastos" —
        `RESTRICCIONES_PERFIL.administrador.vistasPermitidas` gana
        `'proveedores'` (perfil `fiscal` no la ve); perfil `super` sin
        restricciones, la ve siempre. Cableado en `admin.js`:
        `els.btnVistaProveedores`/`els.vistaProveedores`, entrada en
        `navPorVista` (dentro de `aplicarRestriccionesPerfil()`), toggle
        de `is-active`/`hidden` en `cambiarVistaPrincipal()`, oculta
        también en `mostrarMenuMovil()` (mismo patrón que las demás
        vistas de negocio), y su propio listener de clic.
      - **Bug real encontrado y corregido en la validación (no era del
        código, era de despliegue)**: el usuario reportó "no me deja dar
        clic, no veo mi animación" — el HTML servido por el contenedor
        `portalManager-frontend` ya traía el botón nuevo (visible,
        clicable en apariencia) pero el `admin.js` servido era una
        versión A MEDIO CAMINO de esta sesión (el contenedor se había
        reconstruido entre dos de los `Edit` de esta sesión, capturando
        los cambios de `els`/`navPorVista` pero NO los de
        `cambiarVistaPrincipal()`/el listener de clic, agregados
        después) — el botón existía en el DOM pero sin ningún
        `addEventListener` atado, así que un clic (real o programático
        vía `btn.click()`) no hacía absolutamente nada, sin lanzar
        ningún error de consola. Diagnosticado confirmando con `curl`
        que el HTML/JS servido por HTTP coincidía con el archivo en
        disco (no coincidía) y descartando con Claude in Chrome que
        otro botón (p. ej. "Ventas") sí respondía normal — deploy
        parcial, no bug de lógica. Fix: `docker compose build --no-cache
        frontend` + `up -d --force-recreate frontend` (mismo comando ya
        documentado como gotcha en el punto 108/109), sin tocar código
        de nuevo. Validado en navegador real (Claude in Chrome) tras el
        rebuild: clic selecciona el botón (cyan), vista placeholder con
        animación visible, cero errores de consola. Jest backend
        807/807, control 119/119 (sin cambios de backend/control). Sin
        commit/push todavía.

  182. **Switch "Solamente servicios" en Inventarios — EN CURSO, PAUSADO
      a medio implementar (2026-09-02)**: pedido del usuario con
      protocolo completo (crítica + demo interactiva en Artifact + 4
      recomendaciones confirmadas explícitamente: ranking de servicios
      por cantidad no por ingreso exacto, switch por empresa junto a
      "Inventario activo" — no config de plataforma como
      `ventas_afectan_inventario` —, bloqueo si ya hay productos activos,
      la regla "si tienen ambas se conservan todos los indicadores"
      depende solo del estado del switch). **Backend completo**: config
      nueva `inv_solo_servicios` (`backend/utils/inventarioConfig.js`,
      mismo mecanismo que `inventario_activo`) + guard en el `PUT` de
      configuración (rechaza encenderlo con productos activos,
      `INV_HAY_PRODUCTOS_ACTIVOS`) + guard en `validarCuerpoProducto()`
      (rechaza alta de `tipo=producto` con el switch activo,
      `INV_SOLO_SERVICIOS_ACTIVO`, solo en creación — no en edición de
      uno inactivo/archivado que ya existiera) + bloqueo completo de la
      carga masiva (`INV_SOLO_SERVICIOS_ACTIVO` desde el primer paso,
      antes de subir el archivo) + `GET /inventarios/reportes/estado`
      extendido con bloque `servicios` (top/bottom 5 por cantidad
      vendida 90 días desde `orden_productos` — única fuente real, ya
      que un servicio nunca genera `movimientos_inventario`, D11 —
      ingreso estimado con precio ACTUAL, documentado como
      aproximación). **Frontend a medio terminar**: HTML listo (switch
      en "Configuraciones globales", clases `.inv-kpi-solo-producto`/
      `.inv-estado-solo-producto` en las 7+4 tarjetas/secciones que
      dejan de aplicar, bloque nuevo `#inv-estado-servicios-kpi-grid`/
      `#inv-estado-servicios-grid` para el reemplazo, campo Tipo del
      modal con hint fijo `#inv-modal-tipo-fijo-hint`) — **falta todo el
      JS de `admin.js`** (cargar/guardar el switch, ocultar/mostrar
      según su estado, renderizar el bloque de servicios del reporte).
      Interrumpido dos veces por bugs reales más urgentes reportados por
      el usuario (puntos 183 de abajo) — retomar el JS antes de dar esto
      por completo. Sin `node --check` corrido sobre HTML nuevo desde la
      pausa, sin rebuild/deploy, sin Jest nuevo para esta parte
      específica. Sin commit/push.

  183. **2 bugs reales en "Resumen financiero", encontrados por
      diagnóstico contra Docker/MySQL reales y corregidos (2026-09-02,
      reportados por el usuario con capturas tras el cierre mensual de
      agosto) — Jest backend 809/809**:
      1. **Proyección de ventas (Oct/Nov) mostraba $0/$0**: el mes EN
         CURSO (parcial, apenas empieza) se trataba como un mes cerrado
         más al calcular la tendencia de los "últimos 3 meses" —
         comparar "2 días de septiembre" contra meses completos hundía
         la proyección a cero de forma artificial, más notorio justo
         después de cualquier cierre de mes (que es exactamente cuándo
         el usuario lo reportó). Fix en `GET /resumen-financiero`
         (`backend/server.js`): la tendencia usa solo `mesesCerrados`
         (excluye el mes en curso); las ETIQUETAS de la proyección
         siguen ancladas al último mes con CUALQUIER dato (igual que
         siempre, puede ser el mes en curso) para no romper el
         contrato visible de "los 2 meses después de hoy"; el desfase
         real entre el último mes cerrado y el mes proyectado se
         compensa en el multiplicador de la tendencia. La barra real
         del mes en curso en `serie_mensual` NO se toca — sigue
         mostrando su dato parcial, correcto. Test nuevo en
         `test/integration/resumenFinanciero.test.js` que arma 3 meses
         cerrados + 1 mes en curso con valor bajo (usando la fecha real
         del sistema, no una fija) y confirma que la proyección sigue
         la tendencia de los cerrados. **Nota**: con los datos de
         prueba actuales (Jun→Jul→Ago genuinamente a la baja: 344k→
         221k→128k) la proyección corregida SIGUE dando $0/$0 para
         Oct/Nov — es matemáticamente correcto dado ese declive real de
         meses YA cerrados, no queda ningún artefacto del mes parcial.
      2. **"Facturado" desaparecía del histórico — bug más grave, no
         solo de la gráfica**: se calculaba en VIVO con
         `EXISTS(SELECT ticket WHERE estatus='listo')` — en cuanto la
         retención automática BORRA el ticket (`tickets_retencion_dias`,
         diseñado para ser efímero), la venta "olvidaba" haber sido
         facturada para siempre, en CUALQUIER consulta. Confirmado
         contra la BD real: `tickets_retencion_dias=1` día en este
         entorno, **0 tickets** ligados a ninguna de las 24+30+29+29+24
         órdenes de abril-agosto (todos ya purgados) — coincide exacto
         con por qué "Facturado" se veía en ~$0 en las 6 barras.
         Afectaba: esta gráfica, la insignia "✓ facturado" por fila en
         Ventas (`GET /ordenes-compra`), el "Corte del día", Y el guard
         anti-doble-factura (`POST /tickets`, `COMPRA_YA_FACTURADA` —
         dejaba re-facturar una venta ya facturada si su ticket viejo ya
         se había purgado). Fix: columna nueva `facturado_en DATETIME
         NULL` en `ordenes_compra` (hecho histórico PERMANENTE, nunca se
         borra) — se fija UNA SOLA VEZ en
         `POST /admin/tickets/:id/factura` (con `COALESCE`, no se pisa
         si ya tenía fecha de una factura reemplazada), los 5 lugares
         que antes preguntaban al ticket en vivo ahora leen
         `facturado_en IS NOT NULL`. Migración con backfill idempotente
         en `ensureSchema()` — **límite honesto documentado en el
         propio comentario del código**: solo recupera lo que el
         ticket TODAVÍA existente permita (JOIN a `tickets` con
         `estatus='listo'`); lo ya purgado antes de este fix quedó
         perdido para siempre (el archivo de auditoría de tickets
         purgados, `reporte_items`, no guarda el id de la orden de
         compra, solo el folio del ticket — sin vínculo posible). En
         este entorno el backfill recuperó 0 filas (consistente con
         los 0 tickets confirmados arriba). **Validado con una
         simulación real contra Docker/MySQL** (a pedido explícito del
         usuario, "haremos simulaciones para validar tus correcciones"):
         se fijó `facturado_en` a mano en una orden real de agosto SIN
         ningún ticket ligado (demuestra independencia total del
         ticket), confirmado que la insignia de Ventas y el total
         "Facturado" de agosto en Resumen financiero lo reflejaron
         correctamente ($2,774.64), revertido después para dejar la BD
         de vuelta a su estado base. Test nuevo en
         `test/integration/tickets.test.js` para el guard
         `COMPRA_YA_FACTURADA` vía `facturado_en` (antes sin cobertura
         dedicada). Rebuild `--no-cache`+`--force-recreate` backend,
         validado por HTTP real.
      3. **`total_gastos` faltaba en la lista de "Lectura de reportes"**
         (mismo día, reportado por el usuario tras ver los 5 cortes
         mensuales recién generados): la columna `total_gastos` de
         `reportes` existe y `guardarReporte()` (`backend/utils/
         reportes.js`) siempre la calcula bien — el `SELECT` explícito
         de `GET /admin/reportes` (`backend/server.js`) simplemente
         nunca la pedía, así que el selector de reportes en el frontend
         solo mostraba "(N tickets, N ventas)", sin gastos, aunque cada
         cierre mensual sí archiva gastos (13-18 por mes en la siembra
         de prueba). El detalle de cada reporte (tabla "Movimientos") sí
         los mostraba bien — el hueco era solo en el resumen de la
         lista. Fix de una línea en cada lado: columna agregada al
         `SELECT`, `option.textContent` del selector
         (`frontend/admin.js`) ahora incluye "N gastos". Validado por
         HTTP real: los 5 cortes muestran 13/13/14/9/18 gastos
         respectivamente. Jest backend 809/809 (sin test dedicado, sin
         asserts previos sobre esos campos exactos). **Commiteado y
         pusheado** (`5dcb910`+`5e6a458` → `fact/master`).
      4. **Selector "Periodo" en Ventas/Gastos — construido a medias,
         nunca terminado (mismo día, reportado por el usuario: "no veo
         el reporte de los gastos, en la sección de gastos")**: el
         backend (`GET /api/admin/periodos-archivados`,
         `?periodo=YYYY-MM` en ambos listados) y BUENA parte del JS
         (event listeners, disable en papelera, reset de filtros — todos
         ya con guardas `if (els.xxxFiltroPeriodo)`) ya existían de una
         sesión anterior — pero los `<select>` nunca se agregaron al
         HTML (`els.ordenesFiltroPeriodo`/`els.gastosFiltroPeriodo`
         resolvían a `null`, así que TODA esa lógica ya escrita nunca se
         activaba) y `cargarOrdenes()`/`cargarGastos()` tampoco leían su
         valor para mandarlo al backend. Con `archivado_en IS NULL` por
         defecto, cerrar un mes (punto 183 de arriba) dejaba la vista
         activa de Ventas/Gastos vacía sin ninguna forma de ver lo
         archivado — exactamente el síntoma reportado. Fix: 2
         `<select id="ordenes-filtro-periodo">`/`<select id="gastos-
         filtro-periodo">` agregados a sus paneles de filtros existentes
         (mismo patrón `.field` que "Estado de pago"/"Categoría"), los 2
         `els` agregados, `periodo` sumado a los `params` de ambos
         `cargar*()`, y `cargarPeriodosArchivados()` llamado al entrar a
         cada vista (antes solo se llamaba desde dentro de un listener
         que nunca se registraba). Validado por HTTP real:
         `?periodo=2026-08` trae los 32 ventas/18 gastos archivados de
         agosto; sin periodo sigue en 0 (mes actual, correcto). Jest
         backend 809/809. Sin commit/push todavía.

  184. **Leyenda como filtro en "Ventas vs Facturado vs Gastos" — SOLO
      dentro de la ventana emergente (2026-09-02, protocolo completo:
      crítica + demo interactiva en Artifact + confirmación explícita
      del usuario, "confirmo me encanta")**: dar clic en un ítem de la
      leyenda (Ventas/Gastos/Facturado/Sin facturar) oculta/muestra esa
      serie en TODOS los meses a la vez, con animación (fundido +
      colapso vertical, 220-300ms, `cubic-bezier` con rebote sutil,
      respeta `prefers-reduced-motion`); en la tarjeta chica del
      dashboard la leyenda se queda solo informativa, igual que
      siempre. Gancho de activación: la MISMA clase
      `resumen-fin-detalle-contenido-grande` que `abrirDetalleGrafica()`
      ya le pone al contenedor movido al modal — sin estado nuevo, la
      interactividad se detecta con `li.closest(...)` en cada clic. 2
      decisiones confirmadas por el usuario en la demo: ocultar las 4 a
      la vez deja la gráfica en blanco (reversible con un clic, sin
      botón "Mostrar todo" extra) y el estado NO se guarda entre
      aperturas del modal (`resetearLeyendaFiltroChart()` en
      `cerrarDetalleGrafica()`, siempre arranca con las 4 visibles).
      Accesible: cada `<li>` gana `role="button"`/`tabindex="0"`/
      `aria-pressed`, funciona con Enter/Espacio además de clic, foco
      visible. HTML: 4to `data-serie` en los `<li>` de la leyenda +
      clase `resumen-fin-chart-leyenda-filtrable` (para no afectar la
      leyenda de "Utilidad neta del mes", que comparte la clase base
      `.resumen-fin-chart-leyenda` pero son segmentos apilados de la
      MISMA barra, no series independientes — filtrarla no aplicaría
      igual, fuera de alcance a propósito). Jest backend 809/809 (sin
      cambios de backend, 100% frontend). Validado por despliegue
      confirmado vía curl (JS/CSS/HTML servidos) — sin herramienta de
      navegador esta sesión, falta que el usuario lo confirme en vivo.
      Sin commit/push todavía.

  185. **Bug reportado por el usuario, SIN REPRODUCIR TODAVÍA — "no me
      deja entrar a un tenant con la cuenta del admin, que es super
      usuario" (2026-09-02)**: usuario usa la credencial `admin:admin` de
      `ADMIN_USERS` (confirmado idéntica dentro del contenedor real vía
      `docker compose exec backend printenv ADMIN_USERS` → `admin:admin`,
      coincide con `.env.example`). Revisión de `backend/utils/auth.js`
      (`requireAdminAuth()`) no encontró ninguna restricción de tenant
      para el mecanismo 1 (`ADMIN_USERS` → perfil `super`, `checkCredentials()`
      se evalúa ANTES de cualquier lógica de tenant/perfil) — en teoría
      debería entrar a `/<slug>/admin` de cualquier tenant sin
      distinción. **Sin poder confirmar la causa real**: la sesión pidió
      2 veces la URL exacta y el síntoma exacto (401 de nuevo / 404 /
      pantalla en blanco / entra pero con datos de otro tenant) y el
      usuario no lo precisó, pasó a pedir datos de prueba en su lugar.
      Hipótesis sin descartar para la próxima sesión: (a) rate-limit
      (`adminLoginLimiter`/`tenantAggregateAuthLimiter` en `server.js`,
      ambos por tenant+IP, si hubo muchos intentos previos de prueba);
      (b) resolución de tenant en `nginx.conf.template`/`tenantContext.js`
      fallando para el slug específico que probó (404 antes de llegar al
      middleware de auth); (c) confusión de UI — el switcher de
      sucursales (§58) es un mecanismo DISTINTO (`usuarios_sucursal`,
      perfil ligado a `grupoSucursalId`) que no aplica a `ADMIN_USERS`.
      **Retomar pidiendo la URL exacta + captura del error antes que
      nada** — no se tocó código de auth en este punto.
      **De paso, mientras se aclaraba lo anterior**: se generaron ~5
      meses de datos de demo reales en los 2 tenants activos que existen
      hoy (`pruebaadmin`→`tenant_pruebaadmin`, `piloto9c`→
      `tenant_piloto9c`, confirmados por `SELECT slug, db_name, estado
      FROM tenants` contra la BD de control — los otros 5 tenants
      registrados, `e2e9c00212093`/`e2e9c00416557`/`e2e9c51585451`/
      `e2e9c51709395`/`test170`, quedaron atorados en
      `estado='provisioning'` de corridas E2E viejas, sin admin
      funcional, se dejaron sin tocar). Mecanismo: `ensureSchema(pool)` +
      `node scripts/sembrar-demo.js --confirmar` (el mismo script del
      punto 155/158, sin cambios) corridos DOS VECES dentro del
      contenedor `backend`, cada vez con `docker compose exec -e
      DB_NAME=tenant_<slug> backend ...` para apuntar el pool por
      defecto a la BD de ese tenant en vez de `portal_facturacion` —
      mismo patrón ya usado en el punto 115. Misma semilla de PRNG fija
      → **los 2 tenants quedaron con cifras idénticas** (143 ventas / 93
      tickets / 67 gastos / 115 líneas de inventario cada uno, abr-ago
      2026) — es el comportamiento esperado del script (determinista),
      no un bug. `portal_facturacion` (sin tenant) ya tenía su propia
      resiembra de esta misma mañana (punto 183/184, sin tocar de
      nuevo aquí).
      **Al cierre de este punto, el usuario avisó que va a correr
      `docker compose down -v` para "probar desde cero"** — esto borra
      el volumen de MySQL completo (las 2 siembras de arriba + la BD de
      control con el registro de los 7 tenants) y el de MinIO (logos,
      comprobantes, CSFs); un reset así requiere volver a
      `provisionar-tenant.js` cada tenant que se quiera recuperar. Sin
      ejecutar todavía al momento de escribir esto — pendiente confirmar
      si lo corrió el usuario mismo o si lo corre esta sesión, y
      retomar el diagnóstico del bug de arriba una vez que el entorno
      esté estable de nuevo (un reset de infraestructura a medio camino
      podría confundirse con el síntoma original si no se distingue con
      cuidado).

      **Actualización, mismo día — bug real encontrado y CORREGIDO**:
      el usuario aclaró el diseño esperado (`ADMIN_USERS` debe entrar a
      TODOS los `/admin` de tenant + sin tenant + el único `/control`
      global; NO debe existir `/control` por tenant, porque control
      configura a los tenants). Verificado con pruebas reales que las 2
      primeras partes YA funcionaban (`curl -u admin:admin` con tenant
      en la URL → `perfil:"super"` 200 en `pruebaadmin` Y `piloto9c`;
      `control/utils/auth.js` es una copia aparte, SOLO `ADMIN_USERS`,
      sin concepto de tenant) y que nginx no tiene ninguna ruta
      `/<slug>/control` — coincide con lo pedido. **Pero se encontró un
      bug real de la 3ra parte, MISMA clase que el ya corregido en el
      punto 178**: `curl http://localhost:8088/pruebaadmin/control` →
      HTTP 200, servía `login.html` en silencio (sin 404, sin redirect).
      El fix del punto 178 solo cubrió `/<slug>` solo (sin nada
      después); `/<slug>/control` (y cualquier `/<slug>/<algo-no-
      reconocido>`, no solo "control") caía al catch-all porque
      `'control'` no está en `RUTAS_PAGINA_MULTITENANT` de
      `frontend/login.js` — `TENANT_SLUG` quedaba `null` y el login se
      autenticaba contra la base SIN tenant, con la URL mostrando
      `/<slug>/control` como si fuera del tenant. Fix: nuevo
      `location ~ "^/(?<tenant_slug>[a-z0-9][a-z0-9-]{0,48})/.+$"` en
      `frontend/nginx.conf.template` que devuelve 404 — colocado
      DESPUÉS de los 4 locations con regex de tenant ya existentes
      (admin/página de tenant/slug-solo/api-de-tenant, nginx evalúa
      regex en el orden del archivo, primero que matchea gana) para no
      interceptar ninguna ruta válida. Validado por curl real tras
      rebuild `--no-cache`+`--force-recreate` del frontend: `/pruebaadmin/
      control` y `/pruebaadmin/algo-inventado` → 404; `/control` (global),
      `/pruebaadmin/admin`, `/pruebaadmin/login`, `/pruebaadmin` (302 a
      login), `/pruebaadmin/api/health`, `/pruebaadmin/api/admin/login`
      (admin:admin → super), `/piloto9c/api/admin/login` (admin:admin →
      super), `/admin` sin tenant — los 9 sin cambios, cero regresión.
      Sin commit/push todavía.

  186. **Reset completo del entorno local + reaprovisionamiento + correo
      de contacto de clientes en "Configuración Reportes" + fix de la
      tabla "Perfiles y roles de acceso" (2026-09-02)**: a pedido del
      usuario, `docker compose down -v` (borró MySQL+MinIO completos,
      incluidos los 7 tenants registrados) + `up -d --build` desde cero.
      **Bug real de primer arranque encontrado y corregido**: en un
      volumen nuevo, `control_app` (usuario MySQL angosto del segmento
      9b) no existe hasta correr el bootstrap de
      `asegurarControlYPrivilegios()` (mismo mecanismo de
      `provisionar-tenant.js`) — el contenedor `control` entraba en
      crash-loop (`ER_ACCESS_DENIED_ERROR`) hasta correrlo a mano una
      vez contra el puerto 3306 expuesto. Reaprovisionados
      `pruebaadmin`/`piloto9c` vía `provisionar-tenant.js` +
      `sembrar-demo.js --confirmar` (mismo script/semilla del punto
      155/158/185 — cifras idénticas en ambos a propósito). Margen
      positivo verificado por SQL directo los 5 meses (abr–ago 2026:
      +$177,299 / +$156,164 / +$55,722 / +$175,353 / +$90,564).
      **Segundo bug real, encontrado validando la feature de abajo**: el
      reaprovisionamiento se corrió con `DB_HOST=127.0.0.1` (necesario
      para que el script raíz conecte desde el host) — pero ese mismo
      valor quedó grabado como `tenants.db_host` en `control_tenants`,
      que el backend usa DESDE DENTRO del contenedor para armar el pool
      de cada tenant (`obtenerPoolTenant()`, cacheado por slug para
      siempre en memoria) — cualquier ruta admin de esos 2 tenants daba
      `ECONNREFUSED 127.0.0.1:3306`. Fix: `UPDATE control_tenants.tenants
      SET db_host='mysql'` + restart de `backend` (única forma de
      invalidar el pool ya cacheado, no hay un evict expuesto para
      esto). **Feature nueva**: "Correo de contacto de la empresa"
      (`contacto_email`) — hasta ahora solo editable desde `/control`
      (punto 170) — ahora también desde `/admin` › Configuraciones
      globales › Configuración Reportes, en una subsección aparte
      ("Contacto con clientes", con su propio botón de guardado) para
      no mezclarse con "correo_reportes" (concepto distinto: uno es el
      envío interno en Markdown antes del borrado, el otro es a dónde
      llegan las aclaraciones de un cliente sobre sus movimientos).
      Escribe directo en `control_tenants.tenants.contacto_email` vía
      `obtenerPoolControl()` (mismo pool que ya usa
      `admin_auditoria`) — sin duplicar el dato, con
      `invalidarCacheTenant()` in-process tras guardar (no hace falta el
      salto HTTP `/internal/cache-tenant/invalidar` que usa `/control`
      porque este escritor vive en el mismo proceso que la caché).
      `GET /api/admin/config/global` gana `tenant_activo`/
      `contacto_email_cliente` de solo lectura; `PUT
      /api/admin/config/contacto-cliente` nuevo, mismas reglas que
      `normalizarDatosBase()` de `/control` (obligatorio, formato
      válido), mismo perfil permitido que `correo_reportes`
      (administrador/super, fiscal bloqueado). Oculto por completo en
      el sitio base (sin fila en `control_tenants`). Propuesta
      antes/después en Artifact aprobada antes de implementar (regla
      persistente del usuario).

      **Segundo pedido, mismo día**: modal
      "Perfiles y roles de acceso" (`/admin` › Usuarios) desactualizado
      — solo tenía 6 de las 12 columnas reales (faltaban Inicio,
      Resumen financiero, Cuentas por cobrar, Gastos, Inventarios,
      Proveedores) y el detalle de "Administrador" en Configuraciones
      globales no mencionaba "Ventas"/"Inventarios" (sí las tiene,
      confirmado contra `RESTRICCIONES_PERFIL` en `admin.js`). Modal
      ampliado 760px→1180px (`.perfiles-acceso-modal-ancho`, mismo
      patrón que `.inv-kardex-modal`) + tabla reconstruida con las 12
      columnas reales + `min-width:1100px` con scroll horizontal de
      respaldo (`.tabla-perfiles-wrap`, ya lo tenía). Ambos cambios
      validados de punta a punta en navegador real (Claude in Chrome)
      contra Docker/MySQL reales, incluido el ciclo de guardado real del
      correo de contacto (confirmado el mismo dato en
      `control_tenants.tenants` por SQL directo) y la ocultación
      correcta en el sitio base. Jest backend **811/811** (2 tests
      nuevos para el endpoint de contacto). Commiteado y pusheado.

  187. **Cierre del punto 182 — switch "Solamente servicios" en Inventarios,
      completo de punta a punta (2026-09-02)**: el backend ya estaba
      construido desde el punto 182 (guard de activación, guard de alta,
      bloque `servicios` en "Estado del inventario"); faltaba TODO el
      frontend (confirmado con una auditoría de código real antes de
      tocar nada, no por memoria). Protocolo completo: crítica +
      propuesta visual antes/después en Artifact + 4 preguntas de diseño
      confirmadas por el usuario (recomendado en las 4) antes de
      implementar. **Hueco real de seguridad encontrado y cerrado, no
      solo frontend**: el guard de alta (`validarCuerpoProducto()`) solo
      bloqueaba la CREACIÓN de un producto físico — reactivar uno
      archivado vía "Editar" (`estado: 'activo'`) se saltaba el guard
      por completo (`idExcluir !== null`). Fix: segundo guard, evaluado
      después de calcular `estado`, que bloquea `tipo==='producto' &&
      estado==='activo'` en CUALQUIER guardado (alta o edición) mientras
      el switch esté encendido — editar otros campos de un producto
      archivado sin tocar su estado sigue permitido. Validado real contra
      Docker/MySQL: `PUT` reactivando → 400 `INV_SOLO_SERVICIOS_ACTIVO`
      con el mensaje real; el mismo `PUT` dejando `estado:'archivado'` →
      200. **Frontend**: switch conectado
      (`cargarConfigInventario()`/`aplicarVisibilidadSoloServicios()`),
      grisado mientras "Inventario activo" esté apagado (dependencia
      confirmada por el usuario), mensaje 400 real inline junto al
      switch (no toast). Con el switch encendido: 7 tarjetas de producto
      del dashboard "Inicio" ocultas, quedan las 2 de servicio
      ("Servicios activos" ya existía, "Servicios sin ventas 90d" es
      tarjeta nueva — requirió un query nuevo, barato, en
      `GET /inventarios/dashboard`); en "Estado del inventario" se oculta
      el bloque de producto y se pinta el bloque `servicios` que el
      backend ya devolvía sin que nada lo leyera; botón "Importar
      catálogo" oculto; modal de alta pasa a "Nuevo servicio" con la
      pill "Producto" deshabilitada/tachada + hint fijo (`#inv-modal-
      tipo-fijo-hint`, ya existía en el HTML) — SOLO al dar de alta, NO
      al editar un producto físico ya existente (ese conserva su tipo
      real). Decisión confirmada: los productos ya archivados SIGUEN
      visibles en la tabla de Inventarios (el switch solo restringe alta
      nueva, no oculta el catálogo legado). Validado de punta a punta en
      navegador real (Claude in Chrome) contra el tenant `pruebaadmin`:
      bloqueo con 12 productos activos → mensaje real inline; grisado de
      "Solamente servicios" con "Inventario activo" apagado; archivado
      de los 12 productos (SQL directo, dato de prueba) → activación
      exitosa; alta de un servicio real (`SERV-TEST-01`) con el modal
      fijo en "Servicio"; dashboard con solo 2 tarjetas de servicio;
      "Estado del inventario" con solo el bloque de servicios y datos
      reales del servicio recién creado; hueco de reactivación cerrado
      confirmado por `curl` real. Datos de prueba limpiados al final
      (switch apagado, 12 productos reactivados, servicio de prueba
      borrado) — tenant `pruebaadmin` quedó igual que antes de esta
      sesión. Jest backend **813/813** (4 tests nuevos: 2 del hueco de
      reactivación, 1 del nuevo campo del dashboard actualizado). Sin
      commit/push todavía.

## Limitaciones de ESTE entorno de generación (importante)

> **Nota (2026-08-13):** esta sección describe la limitación por defecto
> de una sesión de generación de código nueva/efímera. En esta máquina
> específica, en esta sesión, Docker Desktop SÍ estaba disponible e
> instalado — se usó para levantar el stack completo, provisionar un
> tenant real, correr `verificar-mysql.js` contra MySQL real, y validar
> replicación GTID real de punta a punta (ver punto 97). No asumas que
> todas las sesiones futuras tienen este mismo acceso — verifica primero
> (`docker info`) antes de asumir que sigue disponible o que no lo está.

- **No hay acceso a internet ni a MySQL/Docker corriendo aquí.** Todo el
  código se valida con `node --check`, pruebas de lógica pura extraídas y
  ejecutadas con Node, y trazado manual cuidadoso de las consultas SQL — pero
  **nunca se ha ejecutado contra un MySQL real** desde este lado. Corre
  `backend/scripts/verificar-mysql.js` tú mismo después de cada cambio grande
  al esquema o a las consultas.
- **Tampoco se ha enviado nunca un correo real.** El módulo de SMTP
  (`backend/utils/email.js`) solo se probó en su lógica de
  guardar/leer/enmascarar configuración; `enviarCorreo()` nunca se ejecutó
  contra un servidor SMTP de verdad. Usa el botón "Enviar prueba" del panel
  de administración con credenciales reales para confirmar que funciona.
- No pude verificar visualmente ninguna pantalla en un navegador real. Toda
  la UI se construyó reutilizando cuidadosamente los patrones de diseño ya
  establecidos (`style.css` es la base compartida por todas las páginas), pero
  una revisión visual tuya antes de producción es importante.
- No pude confirmar si el bug de login en celular (cookie `secure`) quedó
  resuelto en la práctica — el diagnóstico es sólido (explica el síntoma
  exactamente) pero no hay forma de reproducirlo aquí para confirmarlo.

## Estructura y convenciones establecidas

- **Nombres de variables/funciones en español**, comentarios en español.
- Cada tabla nueva en MySQL sigue el patrón: `CREATE TABLE IF NOT EXISTS` con
  el esquema completo + un bloque que revisa `INFORMATION_SCHEMA.COLUMNS`
  antes de cualquier `ALTER TABLE ADD COLUMN`, para que sea seguro re-correr
  `ensureSchema()` en instalaciones existentes. Ver `backend/db.js`.
- Todas las fechas se guardan como objetos `Date` de JS (no strings ISO) y se
  leen con `dateStrings: true` en el pool — así el frontend siempre recibe
  `"YYYY-MM-DD HH:MM:SS"` sin zona horaria, tratado como UTC.
- Contraseñas con `crypto.scrypt` (nativo de Node) — a propósito, para no
  reintroducir una dependencia con compilación nativa como la que se quitó
  al migrar de SQLite.
- Sesión de usuario: cookie httpOnly firmada con HMAC (sin tabla de
  sesiones), separada por completo del Basic Auth del admin.
- El campo "Uso de CFDI" (constancia y tickets) comparte una sola bandera de
  "obligatorio/opcional" configurable desde el admin — no hay dos config
  distintas para lo mismo.
- Todas las páginas nuevas reutilizan `style.css` como base de diseño
  (colores, tipografía, `.field`, `.btn`, `.modal`) en vez de reinventar
  estilos — `admin.css`, `auth.css`, `portal.css` son extensiones, no
  reemplazos.
- Después de cada cambio: `node --check` en todos los `.js` tocados, balance
  de llaves en el `.css` tocado, y un script Python que cruza
  `getElementById()` del JS contra los `id="..."` del HTML (detecta refs
  rotas y duplicados). Repetir este hábito en cambios futuros.

## Pendiente / recomendado antes de producción

- **Segmento 9b (`/control` en su propio contenedor, ver punto 99)**:
  validado contra Docker real en un solo host (docker-compose). Sigue
  pendiente: probar un despliegue genuino en DOS servidores distintos
  (`CONTROL_UPSTREAM_HOST`/`BACKEND_INTERNAL_URL` apuntando a una URL de
  red real, no un nombre de servicio Docker) — el mecanismo está
  construido para eso pero nunca confirmado de punta a punta por falta de
  un segundo servidor en este entorno.
- **Segmento 9 (`/control`, ver puntos 96-97)**: el ciclo de vida
  completo (listar/suspender/reactivar/baja) ya se validó por API contra
  Docker/MySQL reales (punto 97). Sigue pendiente: probarlo desde un
  navegador real (clics, no `curl`) en escritorio y móvil, y revisión
  visual del modal de confirmación y los badges de estado.
- **Segmento 8 (MySQL HA, ver puntos 95 y 97)**: la replicación GTID
  (`configure-replica.js`/`verify-replication.js`/`promote-replica.js`,
  incluido un failover real) ya se validó contra dos contenedores MySQL
  reales (punto 97). Sigue pendiente: probar `docker-stack.yml` contra un
  clúster Docker Swarm real multi-nodo (la colocación por
  `node.labels`/orquestación de Swarm en sí, no la lógica de replicación,
  que ya se confirmó).
0. Correr `backend/scripts/verificar-mysql.js` contra MySQL real: **ya se
   corrió** (punto 97) — 255/262, las 7 fallas son bugs del propio script
   de prueba (valores de prueba más largos que la columna), no de la app;
   quedan sin corregir, documentadas en el punto 97.
2. Probar el login desde un celular real (o cualquier dispositivo sobre
   HTTP-LAN, no localhost) para confirmar que el fix de la cookie funcionó.
3. Revisión visual completa de las 6 páginas en un navegador real, en
   móvil y escritorio.
4. Configurar `SESSION_SECRET`, `COOKIE_SECURE` (solo si hay HTTPS real),
   `MYSQL_ROOT_PASSWORD`/`MYSQL_PASSWORD`, y `USO_CFDI_SYNC_URL` (con una
   fuente que tú hayas verificado) antes de desplegar — ninguno tiene un
   valor por defecto seguro para producción.
5. Si vienes de la versión SQLite anterior, correr
   `backend/scripts/migrar-sqlite-a-mysql.js` para traer esos datos.
6. **Parámetros de marca en correos — RESUELTO (ver punto 161)**: el
   diagnóstico original (2026-08 temprano) listaba 7 lugares en
   `backend/server.js`/`utils/email.js` con "ADDV"/marca genérica
   incrustada en texto plano sin diseño. Esos 7 ya se homologaron al
   diseño del ticket de venta vía `construirCorreoBase()` (marca y logo
   siempre vienen de `marcaDelTenant()`/`logoUrlDelTenant()`, nunca
   texto fijo) — ver punto 161 para el detalle completo. Los usos en
   `README.md`/`PROJECT_STATE.md` (título del documento, notas
   históricas) siguen siendo solo documentación, sin acción pendiente.

## Dónde está todo (mapa rápido)

- Lógica de negocio del backend: `backend/server.js` (todas las rutas)
- Esquema de base de datos: `backend/db.js`
- Extracción de datos del PDF: `backend/utils/pdfExtract.js`
- Auth de usuario (RFC+contraseña): `backend/utils/authUsuario.js`
- Auth de admin (Basic Auth): `backend/utils/auth.js`
- Catálogo Uso de CFDI: `backend/utils/usoCfdi.js`
- Correo SMTP: `backend/utils/email.js`
- Borrado automático de tickets: `backend/utils/ticketsCleanup.js`
- Formulario público de constancia: `frontend/csf.html` + `app.js` (renombrado de `index.html`, ver punto 22 de la cronología)
- Login/registro/cambio de contraseña forzado: `frontend/login.html` + `login.js`
- Tablero del usuario: `frontend/dashboard.html` + `dashboard.js`
- Subir ticket: `frontend/tickets.html` + `tickets.js`
- Sesión compartida (dashboard/tickets): `frontend/portal.js`
- Panel admin (constancias + tickets + usuarios): `frontend/admin.html` + `admin.js`
- Reglas de slug de tenant (multi-tenant, punto 88): `backend/utils/tenant.js`
- Aprovisionamiento de un tenant nuevo (multi-tenant, punto 88): `backend/scripts/provisionar-tenant.js`
- Registro de pools multi-tenant + `ensureSchema(db)` parametrizado (multi-tenant, punto 89): `backend/db.js`
- Middleware de resolución de tenant (multi-tenant, punto 90): `backend/utils/tenantContext.js`
- Sesión de cliente y Basic Auth de admin conscientes de tenant (multi-tenant, punto 90): `backend/utils/authUsuario.js`, `backend/utils/auth.js`
- Almacenamiento de archivos en MinIO (multi-tenant, punto 92): `backend/utils/storage.js`
- Cutover del tenant piloto (multi-tenant, punto 93): `backend/scripts/cutover-tenant-piloto.js`, `backend/scripts/lib/controlDb.js`
- App de control, contenedor propio (multi-tenant, segmento 9b, punto 99): directorio `control/` completo (`server.js`, `db.js`, `utils/`, `scripts/ensureSchema.js`) — NO vive en `backend/`
- Alta de empresa nueva desde `/control` (multi-tenant, segmento 9c, punto 101): `control/utils/tenantIntake.js` (`crearTenantIntake`, fila `estado='provisioning'`), `control/server.js` (`POST /api/control/tenants`), modal en `frontend/control.html`/`control.js`/`admin.css`, completado por `backend/scripts/provisionar-tenant.js` + `aplicarConfiguracionFiscalEnProcesoHijo` en `backend/scripts/lib/controlDb.js`
- Endpoint interno de invalidación de caché entre contenedores (punto 99): `backend/server.js`, `POST /internal/cache-tenant/invalidar`
- Identidad visual (tema) por tenant (segmento "Look & Feel", punto 105): `backend/utils/tenantTema.js` + `control/utils/tenantTema.js` (validación duplicada), columna `tema_json` en `control/scripts/ensureSchema.js`, `GET /api/tema/:slug` + `POST`/`DELETE /internal/favicon/:slug` en `backend/server.js`, `PUT /api/control/tenants/:slug/tema` en `control/server.js`, `frontend/theme.js` (pinta CSS variables en runtime)
- Documentación completa para el usuario final: `README.md` (mucho más detallado que este archivo — este es para retomar el trabajo, el README es para operar la app)
