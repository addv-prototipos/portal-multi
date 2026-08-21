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
    `fact` apuntando a `https://github.com/antonioprado-sketch/ADDVportalFact.git`
    y se publicó el historial completo (`main` → `master` del remote):
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
6. **Parámetros de marca** (pedido explícito, guardado para revisar
   después — no implementado todavía, solo el diagnóstico). "ADDV"
   aparece hoy escrito directamente en el código en 4 archivos, 11
   apariciones — ninguna en pantallas HTML, todas en documentación o en
   texto de correos salientes:

   | # | Archivo | Línea | Contexto |
   |---|---------|-------|----------|
   | 1 | `README.md` | 1 | Título del documento |
   | 2 | `README.md` | 340 | Descripción del logo parametrizado del correo |
   | 3 | `PROJECT_STATE.md` | 73 | Nota histórica sobre el nombre del proyecto |
   | 4 | `PROJECT_STATE.md` | ~1647 | Descripción del logo por defecto |
   | 5 | `backend/server.js` | ~675 | `logoTicketHtml()` — atributo `alt` de la imagen del logo |
   | 6 | `backend/server.js` | ~679 | `logoTicketHtml()` — texto visible en la caja de color del logo por defecto |
   | 7 | `backend/server.js` | ~758 | Pie de página del correo de confirmación de orden de compra |
   | 8 | `backend/server.js` | ~838 | Asunto del correo de invitación |
   | 9 | `backend/server.js` | ~841 | Cuerpo del correo de invitación |
   | 10 | `backend/server.js` | ~883–884 | Cuerpo del aviso al contador de nuevo ticket |
   | 11 | `backend/utils/email.js` | ~30 | Plantilla por defecto del correo "factura lista" |

   Dado que ya existe `logo_url` en la configuración global (parametrizado
   desde el punto 47, pero sin pantalla en el panel todavía para
   configurarlo — ver el punto 58 de este mismo archivo), lo natural
   sería extender esa MISMA configuración con un nombre de marca (ej.
   `nombre_marca`, con "ADDV" como valor por defecto para no romper nada
   existente) y usarlo en los 7 lugares que son texto de correo, en vez
   de tener el nombre incrustado directamente en el código en cada uno.
   Los 4 usos en `README.md`/`PROJECT_STATE.md` son solo documentación —
   no requieren ningún cambio de código, se editarían directamente si el
   nombre cambia. (Las líneas marcadas con "~" pueden haberse recorrido
   ligeramente si el archivo cambió desde que se hizo este diagnóstico —
   conviene volver a buscar "ADDV" antes de editar, en vez de confiar en
   el número de línea exacto.)

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
