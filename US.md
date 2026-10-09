# Historias de Usuario — Clarvo

Documento de historias de usuario de **Clarvo** ("tu negocio en orden",
desarrollado por ADDV) — carga de constancia de situación fiscal, tickets de
venta, facturación, ventas, cuentas por cobrar, gastos, inventarios,
resumen financiero y administración multi-tenant. Cada historia sigue el formato
*"Como [rol], quiero [capacidad], para [beneficio]"* e incluye criterios de
aceptación verificables.

Este archivo es la **fuente de contexto completa del producto**: sirve tanto
para documentar lo ya implementado como para dar contexto a un asistente de
diseño (ChatGPT) que proponga **nuevos módulos**. Al proponer funcionalidad
nueva, respetar el formato de este documento, reutilizar los actores
existentes y marcar las historias nuevas como *propuestas*.

> Fuente de comportamiento: `README.md` y `PROJECT_STATE.md`. Las historias
> describen funcionalidad **ya implementada** en el proyecto, salvo donde se
> indica explícitamente.

---

## 0. Contexto del sistema (para diseñar nuevos módulos)

### Propósito del producto

Plataforma web B2B de facturación para que clientes y proveedores capturen su
**constancia de situación fiscal** (PDF del SAT), suban **tickets de venta** y
obtengan su **factura (CFDI)**. Un administrador registra **ventas**,
las envía por correo al cliente con diseño de ticket, y factura cada venta.
El producto es **multi-tenant**: cada empresa cliente tiene su propia base de
datos MySQL, su propio espacio de URLs (`/<slug>` y `/<slug>/admin`) y su
propia identidad visual (marca, logo, tema).

### Stack y arquitectura

| Capa | Tecnología |
|---|---|
| Backend | Node.js 20 + Express 4 (`backend/`, puerto 4000) |
| App de control | Node.js + Express propio en contenedor aparte (`control/`, puerto 4001) — cross-tenant, credencial MySQL angosta |
| Frontend | HTML + CSS + JavaScript vanilla (sin build step), servido por Nginx (`frontend/`) |
| Base de datos | MySQL 8 (`mysql2/promise`, SQL crudo, sin ORM) — una BD por tenant |
| Almacenamiento | MinIO (S3-compatible) para constancias, tickets, facturas, logos y favicons |
| Correo | Nodemailer (SMTP configurable, pensado para Gmail) |
| Contenedores | Docker + Docker Compose; `docker-stack.yml` para Swarm (MySQL primario/réplica) |

### Superficies de la app

1. **Portal de cliente** — `/<slug>/login`, `/<slug>/dashboard`,
   `/<slug>/tickets`, `/<slug>/csf` (sin prefijo para el tenant base).
2. **Panel de administración** — `/<slug>/admin`, por perfil (Super /
   Administrador / Fiscal).
3. **App de control** — `/control`, solo cuentas "super" (`ADMIN_USERS`),
   gestiona el ciclo de vida de las empresas/tenants (alta, edición, tema,
   suspensión, baja).

### Reglas transversales de negocio

- **RFC** es el identificador de cada contribuyente; los tickets quedan
  aislados por RFC de sesión.
- **Un solo archivo activo** de constancia por contribuyente (RFC primero,
  correo como respaldo).
- **Retención**: un solo número de días configurable elimina automáticamente
  tickets (imagen + factura + registro) y ventas (registro).
- **IVA** configurable globalmente, "fotografiado" al momento de cada venta.
- **Zona horaria** mexicana (catálogo IANA) para fechas/horas de ventas.
- **Ventas** puede habilitarse/deshabilitarse globalmente por tenant.
- **Marca** por tenant (nombre + logo) para los correos; fallback `"ADDV"`.
- **Identidad visual (tema)** por tenant (colores, tipografías, radio de
  esquinas, favicon) sobre el diseño base ADDV.
- **Contraseñas** con `crypto.scrypt`; sesión de cliente en cookie httpOnly
  firmada (HMAC), Basic Auth de 3 niveles para el panel.
- **Multi-tenant**: rate limits claveados por `tenant + IP`; auditoría de
  mutaciones del panel en `control_tenants.admin_auditoria`; 404 de tenant con
  costo artificial anti-enumeración.

---

## Actores

| Actor | Descripción |
|---|---|
| **Cliente** | Usuario del portal público (RFC + contraseña). Sube constancia y tickets, descarga facturas. |
| **Visitante** | Persona sin cuenta que accede al formulario público de constancia (acceso anónimo, retrocompatibilidad). |
| **Fiscal** | Perfil del panel de administración: gestiona constancias y tickets, ve Inicio. No ve usuarios ni ventas. |
| **Administrador** | Perfil del panel: gestiona usuarios, ventas, reportes y configuraciones fiscales. |
| **Super** | Cuenta `admin` de respaldo y cuentas de `ADMIN_USERS`: acceso total al panel y a `/control`. |
| **Operador de control** | Persona con cuenta "super" que opera la app de control `/control` (ciclo de vida de empresas/tenants). |
| **Sistema** | Comportamiento automático del backend (limpiezas, notificaciones, respaldos, migraciones). |

---

## 1. Cuenta e inicio de sesión (Cliente)

### US-001 — Registro de cuenta de cliente
Como **cliente**, quiero crear mi cuenta con correo, teléfono, RFC y contraseña,
para poder iniciar sesión y facturar con mi RFC.

**Criterios de aceptación:**
- El registro exige siempre un RFC real con formato válido.
- La contraseña debe cumplir 4 reglas (8+ caracteres, número, minúscula y mayúscula) con checklist en vivo.
- Al registrarse se inicia sesión automáticamente.

### US-002 — Iniciar sesión con RFC y contraseña
Como **cliente**, quiero iniciar sesión con mi RFC y contraseña, para acceder a mi tablero.

**Criterios de aceptación:**
- La sesión dura 12 horas en una cookie httpOnly firmada con HMAC (clave derivada por tenant vía HKDF).
- El error de login es genérico ("RFC o contraseña incorrectos") para no revelar RFCs registrados.
- Hay rate limiting (50 intentos / 15 min por IP).

### US-003 — Cambio de contraseña obligatorio
Como **cliente** al que el administrador le restableció la contraseña con "Forzar cambio",
quiero que se me pida crear una contraseña nueva antes de continuar, para proteger mi cuenta.

**Criterios de aceptación:**
- No se puede entrar al tablero mientras el cambio esté pendiente (ni navegando directo a `dashboard.html`/`tickets.html`).
- La bandera se apaga sola al completar el cambio.

### US-004 — Cerrar sesión
Como **cliente**, quiero cerrar sesión desde la barra de sesión compartida (tablero, tickets, CSF), para proteger mi cuenta en equipos compartidos.

---

## 2. Constancia de Situación Fiscal (Cliente / Visitante)

### US-005 — Subir constancia de situación fiscal en 3 pasos
Como **cliente**, quiero subir mi constancia de situación fiscal (PDF) siguiendo un flujo de 3 pasos
(Datos → Archivo → Confirmación), para que mi empresa tenga mis datos fiscales vigentes.

**Criterios de aceptación:**
- Paso 1: tipo de persona, RFC (opcional u obligatorio según sesión/config) y correo, con validación en tiempo real.
- Paso 2: zona de arrastrar y soltar o selección táctil, con barra de progreso de carga real.
- Paso 3: mensaje de éxito y opción de registrar otro archivo.
- Solo se acepta PDF: se valida extensión, Content-Type y firma binaria (`%PDF`).
- El contenido debe ser una constancia SAT genuina (frases "Cédula de Identificación Fiscal" / "Servicio de Administración Tributaria"); PDFs sin capa de texto se rechazan.
- Tamaño máximo configurable (`MAX_FILE_SIZE_MB`).

### US-006 — Extracción automática de datos del PDF
Como **cliente**, quiero que mi nombre/razón social, régimen fiscal y código postal se lean automáticamente
de mi constancia, para no tener que capturarlos a mano.

**Criterios de aceptación:**
- La extracción es de mejor esfuerzo: si falla, el campo queda vacío ("—") y **nunca bloquea la carga**.

### US-007 — Validación de que el RFC de la constancia coincide con la cuenta
Como **cliente**, quiero que el sistema verifique que el RFC impreso en mi constancia sea el mío,
para no dejar constancias de terceros a mi nombre.

**Criterios de aceptación:**
- Con sesión activa, la referencia es el RFC de la sesión (el campo queda bloqueado a ese RFC).
- Sin sesión, la referencia es el RFC del formulario.
- Si ambos RFC son determinables y no coinciden → se rechaza la carga con mensaje explicando ambos valores.
- Si cualquiera de los dos no se pudo determinar → no se bloquea.

### US-008 — Reemplazar constancia existente con confirmación
Como **cliente**, quiero poder reemplazar mi constancia activa previa, confirmando antes de hacerlo,
para mantener siempre un solo archivo vigente.

**Criterios de aceptación:**
- Un solo archivo activo por contribuyente (identificado por RFC, con correo como respaldo).
- Si ya existe, se muestra modal con los datos previos (nombre, tipo, RFC, nombre de archivo, fecha) antes de pedir confirmación.
- El archivo anterior solo se elimina tras confirmar.

### US-009 — Subir constancia sin sesión (acceso público)
Como **visitante**, quiero poder subir mi constancia sin iniciar sesión (RFC capturado en el formulario),
para usarla en flujos anónimos con retrocompatibilidad.

---

## 3. Tablero del cliente

### US-010 — Ver accesos directos y mis solicitudes
Como **cliente**, quiero ver mi tablero con accesos a "Subir constancia" y "Subir tickets de venta"
y la lista de todas mis solicitudes de tickets, para dar seguimiento a mis trámites.

**Criterios de aceptación:**
- Cada ticket muestra folio (`TK-000001`), nombre de archivo, estatus y fecha de actualización.
- Estatus con insignias de color: Pendiente, En curso, Cancelado, Listo.
- Aislamiento por RFC: cada usuario solo ve y descarga sus propios tickets.
- La barra superior usa la paleta navy de marca con el logo claro (`branding_bgo.png`).

### US-011 — Descargar factura cuando el ticket está listo
Como **cliente**, quiero descargar la factura de mis tickets en estatus "Listo",
para obtener mi CFDI.

**Criterios de aceptación:**
- El botón de descarga solo aparece en estatus "Listo".
- El backend solo entrega facturas de tickets propios.

### US-012 — Bloqueo por falta de constancia al subir ticket
Como **cliente** sin constancia activa, quiero que se me avise con un modal bloqueante al intentar
subir un ticket, para saber que primero debo subir mi constancia.

**Criterios de aceptación:**
- El modal no se puede cerrar sin navegar a otra página ("Subir constancia" o "Volver al tablero").
- El backend también rechaza (`400`, `codigo: SIN_CONSTANCIA`) los envíos de RFCs sin constancia activa.

### US-013 — Aviso de retiro programado de tickets
Como **cliente**, quiero ver un aviso en tablero y tickets sobre los días que faltan para que se
eliminen mis tickets automáticamente (si la retención está configurada), para respaldarlos a tiempo.

---

## 4. Tickets de venta (Cliente)

### US-014 — Subir ticket de venta con verificación de venta
Como **cliente**, quiero subir la foto de mi ticket (JPG/PNG/WEBP) y, si "Ventas" está
habilitada, capturar No. Venta, Total, Fecha y Hora tal como llegaron en mi correo de confirmación,
para solicitar mi factura.

**Criterios de aceptación:**
- Los 4 campos de la venta son obligatorios solo si la venta está habilitada (si no, la sección desaparece).
- El backend valida contra una venta real; si no coincide → `400`, `codigo: COMPRA_NO_ENCONTRADA`, mensaje genérico "No se encuentra registrada la venta para facturar." (sin pistas de cuál campo falló).
- Si la venta ya fue facturada → `400`, `codigo: COMPRA_YA_FACTURADA`, "Esa venta ya fue facturada."
- Total con separador de miles en vivo; los campos se muestran en cuadrícula de 2 columnas en pantallas anchas.
- Uso de CFDI, tipo de pago (5 opciones fijas; "Otro" exige especificar) y comentarios, obligatorios u opcionales según configuración.
- Al enviar se genera folio `TK-000001`.
- Rate limiting: 30 solicitudes / 15 min por IP.

### US-015 — Verificación en vivo del catálogo Uso de CFDI
Como **cliente**, quiero que el dropdown de Uso de CFDI refleje en vivo el catálogo vigente,
para seleccionar la clave correcta.

---

## 5. Panel de administración — acceso y perfiles

### US-016 — Acceso al panel por tres mecanismos
Como **administrador**, quiero entrar al panel con HTTP Basic Auth desde cualquiera de los tres
mecanismos (`ADMIN_USERS`, cuenta de respaldo `admin`, o cuenta con perfil Administrador/Fiscal),
para administrar la operación.

**Criterios de aceptación:**
- Un perfil "Cliente" nunca puede entrar al panel (excluido a nivel de SQL).
- Contraseñas con `scrypt` + comparación `timingSafeEqual`.
- Rate limiting en login (50/15 min) y límite separado para el resto de la API del panel (2000/15 min).
- La pantalla de acceso usa el diseño split-screen (login rediseñado, punto 106).

### US-017 — Restricción de acceso por perfil
Como **fiscal** o **administrador**, quiero ver solo las vistas y tarjetas de mi perfil en el panel,
para no acceder a áreas que no me corresponden.

**Criterios de aceptación:**
- Interfaz: los botones/tarjetas fuera de perfil se ocultan, no solo se deshabilitan.
- Backend: todos los endpoints de `/api/admin/*` exigen `requireAdminAuth` + `requireAdminArea(...)` → 403 real.
- Matriz de acceso: Super → todo; Administrador → Resumen financiero (su vista por defecto), Ventas, Gastos, Usuarios, Reportes, Config fiscales/reportes; Fiscal → Inicio, Constancias, Tickets, Campos obligatorios, Config fiscales.
- Tabla "Perfiles y roles de acceso" solo visible para el perfil `administrador`.
- Si la vista por defecto no está permitida, se navega a la primera vista disponible (el administrador aterriza en "Resumen financiero"; fiscal en "Inicio").
- Al refrescar el navegador (F5) se restaura la última vista visitada de la sesión activa (`sessionStorage`, solo si la vista sigue permitida para el perfil); un inicio de sesión nuevo siempre aterriza en la vista por defecto.

### US-018 — Auditoría de acciones administrativas
Como **super**, quiero que cada mutación del panel y cada login queden registrados
(fire-and-forget: si falla la auditoría, no bloquea la petición), para poder auditar quién hizo qué.

---

## 6. Panel — Vista Inicio

### US-061 — Resumen de operación con estadísticas reales
Como **fiscal** (o super), quiero ver al entrar al panel una vista "Inicio" con estadísticas,
las solicitudes más recientes y una dona de estatus, para monitorear la operación de un vistazo.

**Criterios de aceptación:**
- Cuatro tarjetas: **Solicitudes totales**, **En proceso** (pendiente + en curso), **Completadas** (listo) y **Rechazadas** (cancelado), cada una con variación real contra el mes calendario anterior.
- Tabla de las **5 solicitudes más recientes** con botón "Gestionar" (abre el mismo modal de Tickets) y enlace "Ver todas" a la vista Tickets.
- Dona SVG de 3 segmentos con porcentajes reales por estatus.
- Todo se calcula en el cliente a partir del mismo endpoint `GET /api/admin/tickets` — sin endpoint nuevo.
- Visible para `super`/`fiscal` (no para `administrador`, que no ve Tickets). Es la vista por defecto al iniciar sesión (el perfil `administrador`, sin acceso a Inicio, aterriza en "Resumen financiero").
- Sidebar navy con íconos SVG (mockup `stitch/panel_admin_portal_addv_fiel_al_mockup`); "Inicio" en primera posición, "Tickets" en segunda.

---

## 7. Panel — Vista Constancias

### US-019 — Consultar constancias recibidas
Como **fiscal**, quiero ver la tabla de constancias (nombre/razón social, tipo, RFC, régimen, CP, correo,
archivo, actualizado), para validar los registros.

**Criterios de aceptación:**
- Búsqueda en tiempo real por nombre o RFC (sin distinguir mayúsculas ni acentos).
- Botón "Columnas" (preferencia en `localStorage`) y columnas redimensionables en escritorio.
- En celular, la tabla se convierte en tarjetas apiladas.
- Fechas en formato `DD/MM/AAAA HH:MM AM/PM` local.
- El nombre/razón social es hipervínculo a vista previa del PDF en ventana emergente (cierra con ✕, clic afuera o Esc).

### US-020 — Borrado lógico y físico de constancias
Como **fiscal**, quiero eliminar registros con borrado lógico (papelera, reversible) y borrado físico
(irreversible, con confirmación), para mantener la tabla limpia sin perder datos por error.

**Criterios de aceptación:**
- En "Activos": botón Eliminar → borrado lógico (no toca archivo ni fila).
- En "Papelera": Restaurar (sin confirmación) y Eliminar permanentemente (con confirmación, borra archivo y fila).
- Mientras el registro está en papelera, su RFC/correo quedan libres para una nueva captura ("revive" el registro).

---

## 8. Panel — Vista Tickets

### US-021 — Gestionar tickets (estatus, notas, factura)
Como **fiscal**, quiero abrir un ticket y gestionar su estatus, notas internas y factura,
para dar seguimiento y completar la facturación.

**Criterios de aceptación:**
- Modal ancho (820px) rediseñado en 2 columnas fiel a `stitch/detalle_de_solicitud`: información de la solicitud + ticket adjunto a la izquierda, estatus + factura en tarjetas a la derecha, con badge de estatus junto al título.
- Datos del ticket (RFC, Uso CFDI, tipo de pago, actualizado por, archivo), venta capturada (si aplica) y comentarios del cliente destacados.
- Imagen con efecto lupa + botón "Descargar imagen".
- Selector de estatus (Pendiente / En curso / Cancelado / Listo) — "Listo" deshabilitado (solo se alcanza subiendo la factura); "Cancelado" pide confirmación.
- Notas internas con botón "Guardar cambios".
- "Asignado a" y "Actualizado por" se registran automáticamente con cada cambio.

### US-022 — Subir factura (ZIP validado) y marcar ticket como listo
Como **fiscal**, quiero subir la factura de un ticket como `.zip` (PDF+XML) y que el ticket pase a
"Listo" automáticamente, para que el cliente pueda descargarla.

**Criterios de aceptación:**
- Solo `.zip` con firma binaria real (`PK`).
- Se lee el directorio central del ZIP: debe contener al menos un `.pdf` y un `.xml`; si falta alguno, se rechaza indicando cuál.
- Al subirla, el ticket queda "Listo" y el cliente puede descargarla desde su tablero.
- Si ya hay factura, el botón cambia a "Reemplazar factura" (sustituye, no suma).

### US-023 — Filtros y papelera de tickets
Como **fiscal**, quiero filtrar tickets por estatus y por usuario (combinables, más el toggle
Activos/Papelera), para encontrar rápidamente los que me corresponden.

### US-024 — Borrado automático por retención
Como **administrador**, quiero configurar después de cuántos días se eliminan automáticamente tickets
(imagen, factura y registro) y ventas (registro), para cumplir políticas de retención.

**Criterios de aceptación:**
- Un solo número de días aplica a ambos; `0`/vacío = desactivado.
- La limpieza corre dentro del backend cada hora (sin cron externo), y se informa la última corrida y cuántos eliminó.
- Antes de borrar, se genera y guarda (y se envía si hay correo de reportes) un reporte con lo que se va a eliminar.
- El cliente ve el aviso de retiro programado en su tablero.

### US-025 — Notificación de ticket nuevo al facturador
Como **fiscal**, quiero recibir correo cuando hay un ticket nuevo por facturar (folio, RFC, enlace al panel),
para facturarlo a tiempo.

**Criterios de aceptación:**
- Se envía al correo global "de quien va a facturar" (un valor, no por cliente).
- Si no está configurado: notificación emergente al iniciar sesión ("Tickets nuevos por facturar") con botón al filtro "Pendiente", recalculada en cada entrada.
- Si el envío falla, nunca bloquea la acción principal.

### US-026 — Notificación de factura lista al cliente
Como **cliente**, quiero recibir un correo ("Factura lista — Folio ...") cuando mi factura esté
disponible, para descargarla sin tener que revisar el portal a cada rato.

**Criterios de aceptación:**
- Asunto fijo; cuerpo personalizable desde SMTP con variables `{folio}` y `{rfc}` (default funcional sin configurar).
- Se envía al correo de la constancia asociada al RFC del ticket (per-cliente).

---

## 9. Panel — Vista Ventas (Administrador)

### US-027 — Registrar una venta
Como **administrador**, quiero registrar una venta/servicio para generar su factura y enviarle el
comprobante por correo al cliente.

**Criterios de aceptación:**
- No. Venta se auto-genera (`OC-000001`); fecha/hora se toman del servidor con la zona horaria configurada.
- IVA de solo lectura (porcentaje global); el total se calcula `cantidad × (1 + iva%)` con vista previa en vivo.
- Correo: desplegable solo con correos que ya tienen constancia; al elegir, se muestran RFC y razón social de solo lectura (el backend revalida).
- Todos los campos son obligatorios.
- Formulario y lista lado a lado en pantallas anchas; formulario `sticky`; "Registrar venta" expandible/colapsable con preferencia recordada.
- Envío de correo de confirmación con diseño de ticket (fire-and-forget).

### US-062 — Capturar la venta como lista de productos
Como **administrador**, quiero armar la venta agregando productos uno por uno (concepto + precio
unitario + cantidad), para que el concepto final y el monto se calculen solos sin capturarlos a mano.

**Criterios de aceptación:**
- Por cada producto: concepto (≤150), precio unitario (MXN) y cantidad de piezas (entero ≥ 1); botón "+ Agregar producto".
- Cada línea se muestra en una tabla (Concepto, P. unitario, Cant., Subtotal, quitar ✕); se puede quitar antes de guardar.
- El "Concepto de venta o servicio" (readonly) se arma uniendo las líneas con el formato `2 x Toner ($850.00 c/u)`, con contador `/255`.
- "Cantidad (MXN)" (readonly) es la suma de subtotales (`precio × cantidad`); el Total preview = cantidad + IVA.
- Se bloquea agregar una línea si el concepto final pasaría de 255 caracteres (el backend antes truncaba en silencio).
- Nada se guarda hasta "Registrar venta".
- En "Ventas registradas", un concepto con varios productos se renderiza en renglones separados con la cantidad resaltada en el acento de marca; una línea sola se ve igual que siempre.
### US-063 — Registrar venta para un cliente nuevo (sin constancia)

Como **administrador**, quiero poder registrar una venta para un correo que todavía no tiene
constancia de situación fiscal, para no bloquear la venta de clientes en trámite.

**Criterios de aceptación:**
- Toggle "Cliente ya registrado" / "Cliente nuevo" (tabs).
- "Cliente ya registrado" (default): desplegable solo con correos con constancia activa; el backend revalida.
- "Cliente nuevo": campo de texto libre para el correo (validado como email); el backend relaja la exigencia de constancia solo cuando el body trae `es_cliente_nuevo: true`.
- El resto del flujo (correo de confirmación con diseño de ticket) funciona igual en ambos modos.

### US-028 — Correo de confirmación de venta al cliente
Como **cliente**, quiero recibir un correo con diseño de ticket (datos de la venta, "TOTAL A FACTURAR"
y botón "Iniciar sesión y solicitar mi factura"), para saber qué datos usar al facturar.

**Criterios de aceptación:**
- Fecha y hora en renglones separados (coinciden con los campos del formulario de subir ticket).
- Se envía en HTML y texto plano.
- Logo parametrizado (marca del tenant) con fallback "ADDV".

### US-029 — Reenviar correo de confirmación
Como **administrador**, quiero reenviar el correo de confirmación de una venta existente,
para el cliente que lo perdió.

**Criterios de aceptación:**
- A diferencia del envío original, espera el resultado y avisa con toast éxito/fallo.
### US-073 — Registrar ventas sin conexión a internet *(IMPLEMENTADA)*
Como **administrador**, quiero poder capturar una venta aunque se caiga la conexión a internet, para
no detener la operación en punto de venta por una falla de red pasajera.

**Criterios de aceptación (diseño aprobado, ver PROJECT_STATE.md punto 132):**
- Alcance: SOLO Ventas y Gastos del panel admin. Tickets, Constancias, portal de cliente y subir
  archivos NO son capturables sin conexión (quedan como hoy, requieren conexión).
- El formulario de "Registrar venta" sigue funcionando offline; al guardar, la venta queda en la
  tabla como **"Pendiente de sincronizar"**, SIN folio (el folio lo asigna el servidor en el orden
  real en que le lleguen las peticiones al reconectar — no se reserva ni se inventa uno local).
- Con conexión, "Imprimir ticket" elegido en el paso "Entrega" sigue disparando la impresión de
  siempre. **Sin conexión, "Imprimir ticket" queda deshabilitado** (no hay folio real que imprimir
  todavía) — SÍ se puede elegir "Enviar por correo" y guardar; el correo se manda de por sí desde
  dentro del guardado real en el servidor (mismo mecanismo de hoy, fire-and-forget), así que no hace
  falta ninguna cola de correo aparte — basta con diferir el guardado completo hasta reconectar.
- La validación fiscal (correo con constancia activa) se difiere también al momento de sincronizar
  — si en ese momento ya no es válida, esa venta puntual se marca con el error para corregirla a
  mano; no bloquea ni descarta las demás.
- Ver también US-074 (mismo mecanismo para Gastos) y US-075 (indicador de conexión/sincronización).

### US-074 — Registrar gastos sin conexión a internet *(IMPLEMENTADA)*
Como **administrador**, quiero poder registrar un gasto aunque no haya internet, para no perder el
dato mientras estoy en campo.

**Criterios de aceptación (diseño aprobado, ver PROJECT_STATE.md punto 132):**
- Mismo mecanismo que US-073 (fila "Pendiente de sincronizar", folio/id real al sincronizar).
- Sin validación server-side que dependa de datos dinámicos al capturar (categoría es una lista
  cerrada ya conocida en el navegador) — menor riesgo que Ventas.
- El comprobante (PDF/ZIP) NO se puede adjuntar sin conexión — ya es una acción aparte del alta
  (`POST /gastos` primero, `POST /gastos/:id/comprobante` después) en el diseño actual, así que
  capturar el gasto offline no bloquea ni necesita ese archivo; se adjunta después, ya conectado.

### US-075 — Indicador de conexión y sincronización *(IMPLEMENTADA)*
Como **usuario del panel**, quiero ver claramente cuándo estoy sin conexión y cuándo el sistema está
sincronizando lo pendiente, para saber si es seguro seguir capturando o esperar.

**Criterios de aceptación (diseño aprobado, ver PROJECT_STATE.md punto 132):**
- Franja roja fija arriba ("Sin conexión a internet") mientras el navegador detecta que no hay red.
- Al recuperar conexión, franja verde ("Sincronizando datos…") mientras se envía todo lo pendiente
  de Ventas/Gastos, en el orden en que se creó; desaparece sola (fade-out) al terminar.
- Disparo de sincronización 100% automático al recuperar conexión (sin botón manual).
- Ventas/Gastos: la tabla sigue mostrando la última lista conocida (solo lectura) mientras no hay
  conexión, para poder seguir consultando aunque no se pueda crear nada nuevo fuera de lo ya
  descrito en US-073/US-074.
- Distinto del mecanismo ya existente de US-046 (página de mantenimiento cuando el BACKEND está
  caído) — este es para cuando el dispositivo del usuario se queda sin red, el resto del sitio
  sigue usable, no se reemplaza por una pantalla completa.

### US-030 — Marcar venta como facturada e impedir doble facturación

Como **administrador**, quiero ver un icono de factura junto a las ventas ya facturadas, para no facturar dos veces la misma venta.

**Criterios de aceptación:**
- Icono de factura SVG (`14×14`, doc con doblez) con tooltip "Venta facturada" cuando el ticket vinculado pasó a "listo" (antes ✅, retirado por pulido visual punto 141 — sin emojis, mismo estilo stroke que Resumen financiero).
- El backend rechaza otro ticket para una venta ya facturada (`COMPRA_YA_FACTURADA`).
- Tooltip de razón social al pasar el cursor sobre el correo de cada fila.

### US-076 — Cuentas por cobrar: venta a crédito y cobro *(IMPLEMENTADA)*

Como **administrador**, quiero registrar una venta como "Pagada" (default) o "Pendiente de pago" (con vencimiento/notas) y gestionarla en la vista "Cuentas por cobrar", para llevar el control de lo cobrado y lo pendiente.

**Criterios de aceptación (ver PROJECT_STATE.md puntos 138 y 141):**
- Modal "Registrar venta": toggle `Pagada` / `Pendiente de pago` (solo texto, sin emojis, punto 141) en el paso Entrega; por defecto `Pagada`. Al elegir `Pendiente` se revelan `fecha_vencimiento` (DATE, futura, opcional pero validada si se manda) y `notas_cobro` (TEXT). Filtro "Estado de pago" en Ventas (Todas/Pagada/Pendiente/Vencida) 100% client-side.
- Modelo `ordenes_compra`: `estado_pago ENUM('pagada','pendiente') DEFAULT 'pagada'`, `fecha_vencimiento DATE NULL`, `monto_cobrado DECIMAL(12,2) DEFAULT 0`, `fecha_cobro DATETIME NULL`, `notas_cobro TEXT NULL`, `saldo = total − monto_cobrado` derivado. Migración idempotente + backfill histórico verificado (212/212).
- Vista "Cuentas por cobrar" entre **Ventas** y **Gastos** (solo `administrador`+`super`): toggle `Pendientes`/`Cobradas`, 4 KPIs con icono SVG tintado (igual que Resumen financiero: Por cobrar `$` azul / Vencidas `x-circle` rojo / Por vencer `clock` ámbar / Cobrado mes `check-circle` verde, sin emojis), filtros Cliente/correo + Vencimiento, tabla No. Venta/Cliente/Total/Cobrado/Saldo/Vencimiento/Estado (badge solo texto `Pendiente`/`Vencida`/`Pagada` por `estatus-pendiente|cancelado|listo`, sin emojis).
- Acciones por fila: Ver venta, Registrar cobro (modal monto `>0 && <= saldo`, crea abono → actualiza `monto_cobrado`; si `saldo==0` pasa a `pagada` y `fecha_cobro=NOW()`), Copiar recordatorio (texto al portapapeles). Offline: `estado_pago` en la cola IndexedDB, imprimir deshabilitado para pendiente sin folio.
- API: `PUT /api/admin/ordenes-compra/:id/cobro` (`{monto, notas}`) con `requireAdminArea('administrador')` + `adminApiLimiter`; validación `monto >0 && monto <= saldo`, 401/403/404/400 según caso. Auditoría automática vía middleware (segmento 7).
- El backend rechaza otro ticket para una venta ya facturada (`COMPRA_YA_FACTURADA`).
- Tooltip de razón social al pasar el cursor sobre el correo de cada fila.

---

## 10. Panel — Vista Usuarios (Administrador)

### US-031 — Crear usuario con invitación por correo
Como **administrador**, quiero crear cuentas (Cliente / Administrador / Fiscal) con invitación por
correo que incluya credenciales temporales y el enlace correcto según perfil, para dar de alta personal.

**Criterios de aceptación:**
- Cliente: pide RFC + teléfono; Administrador/Fiscal: piden nombre de usuario (no RFC) sin teléfono.
- Correo obligatorio para cualquier perfil.
- Invitación con usuario, contraseña temporal y enlace a `/login` (cliente) o `/admin` (admin/fiscal), con URL auto-detectada de la petición.
- Envío fire-and-forget: si falla, la cuenta se crea igual.
- Solo alguien con acceso al panel puede crear perfiles admin/fiscal (no hay registro público).

### US-032 — Editar usuario
Como **administrador**, quiero editar perfil, RFC/usuario, correo y teléfono de una cuenta,
para mantener los datos al día (la contraseña se gestiona aparte, con "Restablecer contraseña").

**Criterios de aceptación:**
- No se puede bajar el propio perfil a "Cliente" con la sesión activa (rechazo en backend).
- No se puede eliminar la propia cuenta (rechazo en backend).

### US-033 — Restablecer contraseña con generación automática
Como **administrador**, quiero restablecer la contraseña de un usuario (generando una automática de
12 caracteres legibles, copiable, con "Forzar cambio"), para recuperar accesos perdidos.

**Criterios de aceptación:**
- "Generar contraseña automática" evita caracteres confundibles (`0`/`O`, `1`/`l`/`I`) y marca "Forzar cambio" por defecto (desmarcable).
- El checklist en vivo aplica a contraseñas escritas a mano.
- El cambio forzado solo aplica al login del portal de cliente (no al Basic Auth del panel).

### US-034 — Eliminar usuario
Como **administrador**, quiero eliminar cuentas (con confirmación, sin papelera),
para depurar usuarios.

**Criterios de aceptación:**
- Eliminar una cuenta no afecta constancias ni tickets ya subidos (se identifican por RFC).

### US-035 — Cambiar contraseña de la cuenta de respaldo "admin"
Como **super**, quiero cambiar la contraseña de la cuenta de respaldo `admin` (generar/copiar),
para tener una salida de emergencia segura al panel.

### US-036 — Consultar perfiles y roles de acceso
Como **admin** (usuario exacto), quiero ver la tabla de solo lectura de permisos por perfil,
para saber de un vistazo qué puede ver cada quien.

### US-037 — Activar/desactivar "Ventas"
Como **administrador**, quiero prender o apagar la funcionalidad completa de "Ventas"
(se guarda al momento), para controlar si los clientes deben verificar su venta al subir tickets.

**Criterios de aceptación:**
- Apagada: el botón "Ventas" desaparece del menú, la sección "Verifica tu venta" desaparece de `tickets.html` y el backend deja de exigir los 4 campos.
- Encendida (default): todo funciona normal.

---

## 11. Panel — Vista Configuraciones globales

### US-038 — Configurar campos obligatorios de los formularios
Como **fiscal**, quiero marcar qué campos son obligatorios al subir constancia (tipo de persona, RFC)
y al subir ticket (Uso de CFDI, tipo de pago, comentarios), para adaptar los formularios a mi operación.

**Criterios de aceptación:**
- Correo y archivo de constancia siempre obligatorios (no configurables).
- Los cambios aplican de inmediato sin reiniciar servidor (frontend `*`/`(opcional)` y validación backend).
- El backend rechaza valores no booleanos al guardar.

### US-039 — Configurar datos fiscales de la compañía (IVA, zona horaria, clave SAT, constancia de la compañía)
Como **administrador**, quiero configurar IVA (0-100%), zona horaria mexicana (catálogo IANA), clave SAT
(8 dígitos), link de códigos SAT (URL) y la constancia de situación fiscal de mi propia empresa,
para que las ventas se calculen y muestren correctamente.

**Criterios de aceptación:**
- La constancia de la compañía reutiliza la misma extracción de PDF; aquí el RFC **es obligatorio** (si no se identifica, se rechaza).
- Régimen, razón social y tipo de persona se muestran de solo lectura (tipo calculado por 3 señales en orden de confiabilidad).
- El IVA se "fotografía" en cada venta: cambios posteriores no afectan ventas ya creadas.
- RFC/Clave SAT/tipo de persona se muestran en la barra de sesión del panel; si falta el RFC y/o la clave, se recuerda completarlos en una ventana al iniciar sesión.

### US-040 — Sincronizar catálogo de Uso de CFDI
Como **fiscal**, quiero actualizar el catálogo de Uso de CFDI desde la fuente SAT configurada,
para tener siempre las claves vigentes.

**Criterios de aceptación:**
- El catálogo viene precargado (23 claves CFDI 4.0), funciona sin sincronizar.
- La actualización solo reemplaza si la respuesta es JSON/CSV reconocible con ≥5 filas válidas; si no, el catálogo actual no se modifica.
- Requiere `USO_CFDI_SYNC_URL` configurada; si no, el botón lo explica en vez de fallar.

### US-041 — Configurar SMTP (correo de quien factura, plantilla al cliente, correo de prueba)
Como **super**, quiero configurar el servidor SMTP (host, puerto, seguridad, usuario, contraseña,
remitente), el correo del facturador, la plantilla del correo al cliente y enviar correos de prueba,
para que todas las notificaciones del sistema funcionen.

**Criterios de aceptación:**
- Pensado para Gmail (587/STARTTLS por defecto; 465/SSL soportado), con aviso de "Contraseña de aplicación".
- La contraseña nunca se devuelve al frontend; se conserva si se guarda sin escribirla.
- El correo de prueba reporta errores específicos (credenciales rechazadas, sin conexión, etc.).

---

## 12. Panel — Vista Reportes (Administrador)

### US-042 — Generar y consultar reportes
Como **administrador**, quiero generar reportes (manual o automático antes de la retención) y
consultarlos (selector, resumen, filtros combinables), para dar seguimiento a la facturación del mes.

**Criterios de aceptación:**
- Reporte manual: tickets y ventas activos del mes calendario en curso; se guarda siempre; se envía por correo solo si hay correo de reportes configurado.
- Reporte de retención: se genera antes de borrar nada, con fecha/hora exacta y zona horaria configurada.
- Filtros combinables: tipo de registro, estatus, RFC/correo (parcial), rango de fechas.
- Incluye "Atendido por" (quién atendió cada ticket).

### US-043 — Exportar reportes a CSV o Excel
Como **administrador**, quiero exportar el reporte filtrado a CSV o `.xlsx` real (exceljs),
para analizarlo fuera del sistema.

**Criterios de aceptación:**
- Respeta exactamente los filtros activos.
- CSV con BOM UTF-8 para que Excel en Windows no corrompa acentos.

### US-044 — Ver Markdown completo y eliminar reportes
Como **administrador**, quiero ver el Markdown completo del reporte (descargable como `.md`) y
eliminar reportes (con confirmación, sin papelera), para consultarlos o depurarlos.

---

## 13. Panel — Vista Gastos (Administrador)

### US-066 — Registrar y consultar gastos de la operación
Como **administrador**, quiero registrar los gastos de la operación (con o sin factura) y
consultarlos con filtros y KPIs, para controlar el flujo de caja mensual.

**Criterios de aceptación:**
- Solo perfil **administrador** (ni fiscal ni super por `ADMIN_USERS`); el botón de Gastos no aparece para otros perfiles y el backend responde 403.
- Registro con: fecha, concepto, proveedor (opcional), categoría de lista **cerrada** (renta, nómina, software, hosting, servicios, papelería, combustible, viáticos, publicidad, otro), monto único, `iva_incluido` (sí/no), `tiene_factura` (sí/no), recurrente (sí/no) y notas.
- KPIs del mes en curso: total, total con factura, total sin factura y comparación "vs mes anterior" (el indicador es positivo cuando el gasto baja).
- Filtros combinables: rango de fechas, categoría, con/sin factura, recurrente, búsqueda por concepto/proveedor; paginación.
- Columnas ocultables (fecha, proveedor, categoría, factura, monto); la elección persiste en `localStorage`.
- Columna Factura: link al comprobante (PDF/ZIP) si está cargado, o badge "Con factura"/"Sin factura".

### US-067 — Editar, papelera y comprobante de un gasto
Como **administrador**, quiero editar gastos, moverlos a papelera (con restaurar y eliminar
permanente) y cargar/ver/quitar su comprobante, para mantener el registro correcto.

**Criterios de aceptación:**
- Edición con los mismos campos del alta; cambiar un gasto a "sin factura" borra su comprobante del almacenamiento.
- Papelera: borrado lógico, restaurar y eliminar permanente (con confirmación); en papelera no se muestran KPIs.
- Comprobante opcional: PDF (factura) o ZIP (par PDF+XML de CFDI), máx. 5 MB; la verificación es por firma binaria real (un archivo renombrado se rechaza).
- Descarga del comprobante con su nombre original; quitarlo borra el archivo y limpia los campos.
- Auditoría de acceso admin (`admin_auditoria`) aplica a las rutas de gastos como al resto del panel.

---

## 14. Panel — Vista Resumen financiero (Administrador)

> Vista propia del perfil **administrador** (+ super implícito); el perfil
> fiscal no la ve. Botón en el sidebar justo antes de "Ventas". Todos los
> datos salen del endpoint `GET /api/admin/resumen-financiero`, que solo
> devuelve **agregados SQL** (nunca filas sueltas de ventas o gastos).
> Todas las gráficas son SVG/CSS puro sin librerías ni CDN externos.

### US-068 — Ver los KPIs financieros del mes
Como **administrador**, quiero ver al entrar 4 tarjetas KPI del mes en curso
(Total facturado, Total gastos, Balance ventas vs gastos y Ventas sin facturar),
para conocer la salud económica de la operación sin cruzar reportes a mano.

**Criterios de aceptación:**
- "Balance ventas vs gastos" = Facturado − Gastos ("facturado" = venta con ticket vinculado en estatus `listo`).
- "Ventas sin facturar" = Ventas totales − Facturado.
- Tendencia % real contra el mes calendario anterior en Total facturado y Total gastos; si el mes anterior fue $0, no se inventa tendencia.

### US-069 — Gráfica mensual "Ventas vs Facturado vs Gastos"
Como **administrador**, quiero una gráfica de barras por mes que compare ventas
totales, facturado, sin facturar y gastos, para ver la evolución y detectar
venta no facturada.

**Criterios de aceptación:**
- Barras CSS puro agrupadas por mes en SQL (`DATE_FORMAT(…, '%Y-%m')`).
- Solo aparecen meses con actividad real en ventas o gastos: no se rellenan meses en cero.
- Orden final de barras dentro de cada mes: Ventas, Gastos, Facturado, Sin facturar.
- La barra "Sin facturar" se deriva en el cliente (`ventas − facturado`, piso 0) — cero cambios de backend para calcularla; comparte color con la dona de facturadas vs sin facturar.
- Cada tarjeta de gráfica tiene botón expandir que abre un modal de detalle (la misma gráfica ampliada) reutilizando el contenido ya renderizado.

### US-070 — Tarjeta "Utilidad neta del mes (ventas totales vs gastos)"
Como **administrador**, quiero ver la utilidad neta del mes comparando TODAS las
ventas del período (facturadas o no) contra los gastos, para saber cuánto
dinero quedó realmente este mes.

**Criterios de aceptación:**
- `utilidad_neta = subtotal_ventas − gastos_del_mes`; cuenta todas las ventas del mes aunque no estén facturadas (a diferencia del KPI "Balance", que es Facturado − Gastos — son dos preguntas distintas y complementarias).
- Subtotal e IVA provienen de los datos ya guardados de cada venta (`cantidad`, `iva_porcentaje`, `total`), sin cambio de esquema.
- Número grande verde (positivo) / rojo (negativo) / neutro (cero).
- Gráfica comparativa de 2 columnas CSS puro: "Ventas totales" apilada (Subtotal + IVA cobrado) junto a columna sólida "Gastos"; leyenda de 4 filas; empty state si no hay actividad.
- Nota visible en la tarjeta: "El IVA mostrado es el cobrado en ventas, no una cifra fiscal" (los gastos no desglosan su propio IVA, solo `iva_incluido` sí/no).

### US-071 — Gráficas BI complementarias sobre datos reales
Como **administrador**, quiero gráficas adicionales construidas solo con métricas
que la base de datos respalda (sin inventar indicadores), para analizar la
operación de un vistazo.

**Criterios de aceptación:**
- Dona "Distribución de gastos por categoría" (mes actual): `GROUP BY categoria` con color fijo por categoría (lista cerrada de 10).
- Dona "Ventas facturadas vs sin facturar": proporción visual del mismo dato del KPI.
- Línea "Balance acumulado": Facturado − Gastos acumulado mes a mes sobre la serie mensual.
- Línea "Proyección de ventas": estimación simple (promedio del delta de los últimos 3 meses reales extendido 2 meses hacia adelante, piso en 0); nunca se muestra con menos de 3 meses de histórico; etiquetada explícitamente como estimación, no pronóstico financiero.
- Barras horizontales "Top 5 proveedores de gasto" (mes actual; excluye proveedor vacío/nulo).
- Todas con modal de detalle (expandir) y accesibles (leyenda + tooltip + `aria-label`).

### US-072 — Modo dashboard personalizable con layout por usuario
Como **administrador**, quiero arrastrar y redimensionar las tarjetas de Resumen
financiero y que mi layout se guarde en el servidor, para armar mi tablero a mi
manera y encontrarlo igual cada vez que entre.

**Criterios de aceptación:**
- Botón "Modo dashboard" (con estado `aria-pressed`), botón "Restablecer" (visible solo si hay layout guardado) y ayuda contextual.
- Handles de arrastre (⠿) y resize (◢); alternativa completa de teclado (↑/↓ posición, ←/→ ancho, Esc sale del modo) — WCAG 2.1 AA.
- Tablero CSS Grid de 12 columnas; el drag NUNCA mueve nodos del DOM (solo cambia `order`/`grid-column`) para no romper el modal de detalle; vanilla sin librerías externas.
- Persistencia SERVIDOR por usuario: tabla `preferencias_dashboard` (UNIQUE usuario+vista, JSON, SIN FK a usuarios — las cuentas super no existen en la tabla `usuarios`); endpoints `GET/PUT/DELETE /api/admin/preferencias-dashboard/:vista`.
- Validación backend en bloque: whitelist cerrada de IDs conocidos + span entero 3..12; layouts parciales/inválidos se rechazan completos (400) sin escribir BD; PUT hace upsert; DELETE vuelve al layout por defecto; auditoría automática cubierta por el middleware global.
- Guardado automático con debounce (~800 ms) + toast "Layout guardado."; restauración al entrar a la vista.
- Móvil (<900 px): se ignora el ANCHO personalizado pero se conserva el ORDEN.

---

## 15. Experiencia general y confiabilidad

### US-045 — Experiencia consistente y accesible
Como **cliente**, quiero que todas las páginas sean mobile-first, con foco visible por teclado,
etiquetas asociadas a campos, contraste adecuado y tooltips propios del sistema, para usarlas desde
cualquier dispositivo.

**Criterios de aceptación:**
- Identidad ADDV consistente: login split-screen, sidebar navy en el panel, barra superior navy en el portal, logo `branding_bgo.png` sobre fondos oscuros.
- Los modales y tablas reutilizan el diseño y el sistema de tooltips propios.
- `theme.js` pinta la identidad del tenant (si existe) sobre todas las páginas sin romper el diseño base.

### US-046 — Página de mantenimiento automática
Como **usuario**, quiero ver una página de mantenimiento propia ("En breve volveremos") cuando el
backend no responda, con recarga automática al recuperarse, para no quedarme sin saber qué pasa.

**Criterios de aceptación:**
- Aplica a peticiones `/api/` con 502/503/504 (interceptadas por nginx).
- El 503 se conserva para que `fetch()` detecte el fallo.
- Verificación automática con intervalo creciente (2s → tope 20s) + botón "Reintentar ahora".
- Animación respeta `prefers-reduced-motion`.

### US-047 — Operación confiable del sistema
Como **administrador**, quiero que el sistema tenga health check real contra MySQL, apagado ordenado,
captura de excepciones globales, límites de memoria por contenedor y límites de rate correctamente
separados (login vs. API autenticada), para evitar caídas intermitentes.

---

## 16. Multi-tenant — App de control `/control` (Super / Operador)

### US-048 — Listar empresas (tenants)
Como **super**, quiero ver la lista de empresas del catálogo de control (con estado, slug y contacto),
para administrar la plataforma multi-tenant.

### US-049 — Alta de empresa nueva (solicitud)
Como **operador de control**, quiero capturar una solicitud de alta (nombre, slug, contacto, notas,
marca, logo opcional y datos fiscales opcionales) desde `/control`, para iniciar el proceso de aprovisionamiento.

**Criterios de aceptación:**
- La fila queda en estado `provisioning`; el alta física (CREATE DATABASE + GRANT) la hace solo
  `backend/scripts/provisionar-tenant.js` (root de MySQL, nunca montado en contenedores).
- El script completa la fila (activo) y pre-llena la configuración fiscal si se capturó.
- El modal de alta incluye marca (`marca`) y logo opcional (JPG/PNG/WEBP, máx 2 MB, base64).

### US-050 — Suspender / reactivar / dar de baja una empresa
Como **super**, quiero suspender, reactivar o dar de baja una empresa, para controlar su acceso sin
perder datos.

**Criterios de aceptación:**
- Suspender/baja son reversibles y no borran BD ni archivos (solo cambian el estado).
- El cambio se refleja de inmediato (invalidación de caché entre contenedores, no hasta 45 s después).
- Cada acción queda en `tenant_eventos` y en la auditoría admin.

### US-051 — Editar empresa y cambiar slug
Como **super**, quiero editar los datos de una empresa (mismos campos que el alta, slug en solo
lectura activable con switch "Cambiar slug"), para corregir información.

**Criterios de aceptación:**
- Cambiar slug migra TODOS los archivos del tenant en MinIO (verificado por conteo; 502 sin borrar nada si no cuadra).
- `db_name` se conserva (la BD física no se renombra); `storage_prefix` sí cambia.
- nginx no necesita recarga (rutas regex); el control invalida la caché de ambos slugs.
- Auditoría `datos_actualizados`/`slug_cambiado`.

### US-052 — Editar marca y logo de una empresa
Como **super**, quiero editar el nombre de marca y subir/reemplazar/quitar el logo de una empresa
(botón "Editar marca" por fila), para que sus correos lleven su identidad.

**Criterios de aceptación:**
- El logo se guarda en MinIO (`marca/<slug>/logo`) vía endpoint interno protegido por `X-Internal-Secret` (no expuesto por nginx).
- Se sirve público en `GET /api/marca-logo/:slug` con cache de 24 h.
- Sin logo, los correos usan el nombre de marca en texto; sin marca, fallback "ADDV".

### US-053 — Aislamiento y seguridad del control
Como **super**, quiero que `/control` use una credencial de MySQL propia y angosta (solo
`control_tenants`, sin acceso a BDs de tenants), para que un compromiso de un contenedor no
comprometa al otro.

### US-064 — Definir identidad visual (tema) de una empresa
Como **operador de control**, quiero configurar colores y radio de esquinas de una empresa
desde `/control`, para que su portal tenga identidad propia sin tocar el diseño base.

**Criterios de aceptación:**
- Pestaña "Identidad visual" dentro del modal "Editar empresa": nombre de marca, logo, 12
  selectores de color (lista cerrada de claves), radio de esquinas, campo de favicon (máx. 2 MB)
  y botón "Restablecer al diseño ADDV". Sin selector de tipografía — congelada a Inter en todo el
  sitio (ver US-109: el selector de 8 fuentes que existía antes quedaba muerto, el backend ya
  ignoraba la selección; se quitó al migrar al componente compartido).
- El formulario lo renderiza `frontend/marcaTemaEditor.js` (componente compartido con `/admin`,
  ver US-109) — misma interfaz, misma validación, en las dos superficies.
- Vista previa en vivo (tarjeta de ejemplo se repinta con cada cambio, sin esperar el guardado).
- Contraste **WCAG 2.1 AA real** calculado sobre 9 pares fondo/texto (4.5:1 texto normal, 3:1 botones) — si un par no cumple, se rechaza con 400 (validado también en el frontend antes de guardar).
- Cada acción (colores, logo, favicon, restablecer) se aplica de inmediato vía su propio endpoint (`PUT .../marca`, `PUT .../tema`) — ya no depende del botón general "Guardar cambios" del modal completo. "Restablecer" pide confirmación (afecta la identidad de otra empresa).
- El tema se guarda vía `PUT /api/control/tenants/:slug/tema`; cada cambio queda en `tenant_eventos` (`tema_actualizado`) e invalida la caché del backend.
- `GET /api/tema/:slug` (público, cache 5 min) devuelve `{marca, marcaLoGoUrl, tema, variables, fuentesGoogle}`; `frontend/theme.js` pinta las variables CSS y carga las fuentes en las 6 páginas del portal.
- "Restablecer al diseño ADDV" vuelve `tema_json` a `NULL` (diseño base) y borra el favicon — el logo y el nombre de marca no se tocan.

### US-065 — Favicon por empresa
Como **operador de control**, quiero subir o quitar el favicon de una empresa, para que el navegador
muestre su icono.

**Criterios de aceptación:**
- Se sube junto con el tema (campo de favicon en "Identidad visual") o en la edición de tema.
- El archivo vive en MinIO bajo `marca/<slug>/favicon`, subido vía `POST/DELETE /internal/favicon/:slug` (protegido con `X-Internal-Secret`, no expuesto por nginx).
- Se sirve público en `GET /api/favicon/:slug` con cache de 24 h.
- El renombrado de slug (segmento Edición) migra también el favicon si existe.

### US-109 — Autoservicio de marca e identidad visual desde `/admin`
Como **administrador** de mi propia empresa, quiero editar el nombre de marca, logo, favicon,
colores y radio de esquinas de mi portal desde Configuraciones, sin depender de un operador de
`/control`, para personalizar mi identidad visual yo mismo.

**Criterios de aceptación:**
- Tarjeta "Marca e identidad visual" en Configuraciones de `/admin`, oculta si el plan del tenant
  tiene "Marca propia / Look & Feel" apagado (`marcaLookfeelHabilitado=false`, switch que solo
  `/control` prende/apaga) — mismo criterio que "Ticket de impresión".
- Mismo formulario y misma validación de contraste AA que US-064 — lo renderiza el mismo
  componente compartido `frontend/marcaTemaEditor.js`, para que `/admin` y `/control` nunca
  diverjan en comportamiento.
- Endpoints propios, tenant-only (`GET/PUT /api/admin/marca-tema`, `/marca`, `/tema`,
  `/tema/restablecer`, `/marca-logo`, `/favicon`), gateados por `marcaLookfeelHabilitado` antes de
  la autenticación (404, nunca 403) y por el mismo `control_tenants.tenants` que ya editaba
  `/control` — un tenant editado desde cualquiera de las dos superficies cae en el mismo dato y el
  mismo archivo en MinIO.
- Logo y favicon se guardan de inmediato al seleccionarlos (sin esperar un botón "Guardar"
  general); el nombre de marca y los colores se guardan con el botón "Guardar cambios" propio de
  la tarjeta.
- *(Resuelve la idea pendiente "Autoservicio de marca/tema" listada en la sección 25 desde antes
  de esta implementación, y completa US-059 — la pantalla de logo en el panel que faltaba.)*

---

## 17. Multi-tenant — Infraestructura (Operador / DevOps)

### US-054 — Aprovisionar la base de datos de un tenant nuevo
Como **operador**, quiero correr `provisionar-tenant.js` con root de MySQL para materializar la BD
de un tenant nuevo, de forma idempotente y segura.

**Criterios de aceptación:**
- Rechaza slugs ya activos (no sobreescribe), salvo filas en `provisioning` (las completa).
- Reglas de slug en `backend/utils/tenant.js` (minúsculas/números/guiones, nombres reservados).
- Se corre desde la máquina del operador, nunca desde el contenedor (root nunca montado).

### US-055 — Convertir la instalación actual en el primer tenant real
Como **operador**, quiero correr `cutover-tenant-piloto.js` (no destructivo, paso a paso, corte de
tráfico manual), para migrar la instalación single-tenant al modelo multi-tenant.

**Criterios de aceptación:**
- Nunca modifica la BD ni archivos originales; debe probarse contra una copia primero.
- Al terminar imprime el snippet de redirecciones 301 para nginx.

### US-056 — URLs con slug por empresa
Como **cliente**, quiero acceder a mi portal bajo `midominio.com/<slug>` (login, dashboard, tickets,
csf) y el panel bajo `/<slug>/admin`, para que cada empresa tenga su propio espacio.

**Criterios de aceptación:**
- nginx resuelve las rutas regex y solo fija `X-Tenant-Slug` desde `/<slug>/api/*` (limpia cualquier valor enviado por el cliente en `/api/*`).
- El frontend construye sus llamadas y enlaces con el slug.
- 404 de tenant con costo artificial para reducir enumeración por temporización.
- Endpoints con tenant: rate limit claveado por `tenant + IP`.

### US-057 — Alta disponibilidad de MySQL (Swarm)
Como **operador**, quiero desplegar el stack en Docker Swarm con MySQL primario/réplica (replicación
GTID) y failover manual, para tolerar la pérdida de un nodo.

**Criterios de aceptación:**
- `docker-stack.yml` con colocación por etiquetas `mysql-role`; réplica enganchada con
  `configure-replica.js`; verificación con `verify-replication.js`.
- Failover deliberadamente manual (`promote-replica.js`) para evitar split-brain.
- **Pendiente de validación real**: nunca desplegado contra un clúster Swarm multi-nodo real.

### US-058 — Almacenamiento de archivos en MinIO
Como **operador**, quiero que constancias, tickets y facturas se guarden en MinIO (S3-compatible),
para no depender del disco local y poder escalar a múltiples nodos.

**Criterios de aceptación:**
- Bucket `MINIO_BUCKET` auto-creado; consola en `MINIO_CONSOLE_PORT` (9001).
- Validado contra MinIO real en Docker (punto 97): subir/bajar/borrar archivos funciona.

---

## 18. Panel — Vista Inventarios (Administrador)

> Módulo de catálogo y existencias, exclusivo del perfil `administrador`
> (D7: `fiscal` no tiene ningún acceso), con interruptor global
> "Inventario activo" en Configuraciones globales. Detalle completo de
> las decisiones de diseño (D1-D11, §0-§58) en `inventarios.md`.

### US-082 — Catálogo de productos y servicios con existencias derivadas del kardex
Como **administrador**, quiero un catálogo simple (sin variantes/lote/serie) con SKU, código de
barras opcional, categoría, unidad de medida y tipo (producto/servicio), cuya existencia solo
cambie registrando movimientos, para tener un inventario confiable sin poder "forzar" un saldo a mano.

**Criterios de aceptación:**
- La existencia disponible nunca se edita directamente: sube o baja únicamente por una **entrada**
  (compra, devolución de cliente, inventario inicial, ajuste positivo) o una **salida** (venta,
  consumo interno, merma, ajuste negativo).
- Un producto con movimientos históricos nunca se borra físicamente; papelera con restaurar.
- El motor (`registrarMovimiento()`) es atómico y a prueba de concurrencia (bloqueo de fila +
  reintento), con idempotencia real vía `Idempotency-Key`.
- Un servicio (`tipo=servicio`) nunca genera existencia ni movimientos de almacén.

### US-083 — Costeo promedio ponderado y trazabilidad completa de movimientos
Como **administrador**, quiero que cada entrada con costo recalcule sola el costo promedio ponderado
del producto, y poder consultar el historial completo de movimientos de cada uno, para saber cuánto
vale mi inventario en todo momento.

**Criterios de aceptación:**
- El costo promedio nunca se edita directamente — solo lo mueve una entrada con costo.
- Botón "Verificar integridad": recalcula cada existencia desde cero contra el libro de movimientos
  y reporta cualquier divergencia; nunca corrige sola (la corrección siempre es un ajuste explícito).
- Ícono "?" en cada campo del formulario con explicación en lenguaje simple, ejemplo válido y error
  común (ayuda contextual y diccionario de datos, §56).

### US-084 — Integración de inventario con Ventas
Como **administrador**, quiero que "Registrar venta" pueda vincular productos del catálogo y descuente
existencia automáticamente, para no llevar dos registros separados de lo mismo.

**Criterios de aceptación:**
- Con "Inventario activo" encendido, la venta valida stock disponible antes de guardar.
- Varias líneas de producto por venta; todo o nada (si una línea falla, se revierte la venta completa).
- Si la venta se cancela o falla a medio camino, se revierte con una devolución de cliente automática.
- Sin "Inventario activo", "Registrar venta" funciona exactamente como sin este módulo.

### US-085 — Importador masivo de productos (CSV/XLSX)
Como **administrador**, quiero subir un catálogo completo desde un CSV/XLSX exportado de otro sistema
(CONTPAQi, Aspel, etc.), para no capturar producto por producto.

**Criterios de aceptación:**
- Wizard de 6 pasos con auto-mapeo de columnas por sinónimos; perfiles de mapeo guardables.
- Upsert por SKU: reimportar el mismo catálogo no duplica stock (crea entradas de "inventario inicial"
  solo para lo nuevo).
- Modo asíncrono para archivos grandes (>500 filas): responde de inmediato y procesa en segundo plano.
- Una fila `tipo=servicio` se rechaza completa — la carga masiva es solo para productos; un servicio
  siempre se da de alta a mano.
- Columnas no reconocidas se guardan en un campo `extra` (JSON) en vez de perderse.

### US-086 — Producto en moneda extranjera con tipo de cambio automático
Como **administrador**, quiero marcar un producto en USD y que el tipo de cambio del día se traiga
automáticamente (Banco de México), para no calcular a mano la conversión a pesos.

**Criterios de aceptación:**
- El tipo de cambio se precarga vía la API SIE de Banxico (`BANXICO_TOKEN`); sin token o si el
  servicio no responde, se puede capturar a mano sin bloquear el alta.
- Cada entrada conserva moneda original, tipo de cambio y costo original en el historial de
  movimientos, para siempre.
- El costo en pesos (`costoOriginal × tipoCambio`) es lo único que alimenta el costeo promedio
  ponderado — sin cambios en esa lógica para productos en MXN.

### US-087 — Código de barras: lectura por cámara y etiquetas de impresión
Como **administrador**, quiero escanear el código de barras de un producto con la cámara del
dispositivo (en Ventas o en Inventarios) e imprimir etiquetas nuevas para los que no tienen, para
agilizar la captura en mostrador.

**Criterios de aceptación:**
- Lectura por cámara: `BarcodeDetector` nativo del navegador, con `html5-qrcode` vendorizado (nunca
  CDN) como respaldo en dispositivos sin esa API — requiere un contexto seguro (HTTPS o localhost).
- Generador de etiquetas por producto: código Code128 generado en el servidor (`bwip-js`), nombre y
  precio; formato térmica 40×30mm o carta (24 etiquetas por hoja).
- Sin código de barras propio, la etiqueta usa el SKU como respaldo.

### US-088 — Imagen principal de producto
Como **administrador**, quiero subir una foto de cada producto, para identificarlo visualmente en
Inventarios y en el buscador de Ventas.

**Criterios de aceptación:**
- La imagen se redimensiona y convierte a WebP en el servidor; nombre fijo por producto en el
  almacenamiento (reemplazar sobreescribe, sin dejar huérfanos).
- Efecto lupa al pasar el cursor sobre la miniatura, en la tabla de Inventarios y en las sugerencias
  de producto de Ventas; sin foto, se muestra una imagen de marcador de posición.

### US-089 — Fecha de expiración y switch "Solamente servicios"
Como **administrador**, quiero capturar una fecha de expiración opcional por producto y, si mi
negocio solo vende servicios, poder restringir el catálogo a solo eso, para adaptar el módulo a mi
tipo de operación.

**Criterios de aceptación:**
- Fecha de expiración es solo un aviso (nunca bloquea una venta); tarjeta "Por vencer" en el tablero
  cuenta vencidos + próximos 30 días, con lista filtrable.
- Con "Solamente servicios" encendido, dar de alta o reactivar un producto físico se rechaza (guardia
  también server-side, no solo oculto en la interfaz); el catálogo se restringe a un solo cobro por
  hora o por paquete de precio fijo.

### US-090 — Estado del inventario (reportes y KPIs)
Como **administrador**, quiero un tablero de KPIs y gráficas del inventario (más vendido, rotación,
valor por categoría, cobertura, capital inmovilizado), para tomar decisiones de compra sin exportar
nada.

**Criterios de aceptación:**
- Pestaña "Estado del inventario" dentro de "Lectura de reportes": KPIs reales (nunca inventados —
  sin conciliación SAT/CFDI ni benchmarks externos), tabs Top5/Bottom5, matriz de riesgo con acceso
  directo a "Gestionar", exportar CSV.
- Costeo mostrado siempre como promedio ponderado (nunca PEPS/FIFO, que el sistema no implementa).

---

## 19. Panel — Vista Ventas y Reportes (extensiones)

### US-091 — Descuento por porcentaje en una venta
Como **administrador**, quiero aplicar un descuento por porcentaje a una venta antes del IVA, para
reflejar promociones sin editar el precio de cada producto.

**Criterios de aceptación:**
- El descuento se aplica sobre el subtotal, antes del IVA; el ticket/correo/detalle muestran
  Subtotal, Descuento, IVA y Total por separado.
- Rango válido: mayor a 0% y menor a 100% (100% violaría el invariante de que una venta tiene un
  monto positivo).
- Botones de descuento rápido (0/5/10/15%) además de captura manual del porcentaje.

### US-092 — Corte del día (reporte bajo demanda de Ventas)
Como **administrador**, quiero generar un corte de ventas de un rango de fechas libre, para pantalla
o impresión, sin esperar al cierre del mes.

**Criterios de aceptación:**
- Solo ventas (no gastos ni tickets); rango desde-hasta libre, con chips de atajo (Hoy/Ayer/Esta
  semana/Este mes/Mes anterior).
- Se puede consultar en pantalla e imprimir (formato ticket térmico); no se envía por correo.
- El corte queda guardado y consultable después en la pestaña "Cortes" de "Lectura de reportes",
  con su propio detalle simplificado y exportación a CSV.

### US-093 — Cierre mensual archivado de Ventas y Gastos
Como **administrador**, quiero que Ventas y Gastos se archiven automáticamente el día 1 de cada mes
(en vez de borrarse), para conservar el historial completo aunque la retención automática de tickets
siga limpiando imágenes/facturas.

**Criterios de aceptación:**
- La retención automática configurable (días) sigue aplicando solo a tickets; Ventas y Gastos se
  archivan (`archivado_en`, `periodo_archivado`), nunca se eliminan por retención.
- **El archivado es reportería, nunca ocultamiento** (punto 380, 8 oct 2026): las listas de
  Ventas/Gastos y el histórico de Cuentas por cobrar arrancan en "Todos los periodos" y muestran
  **todo** el histórico con paginación real server-side (`pagina`/`por_pagina`, tope 100);
  `?periodo=YYYY-MM` queda como filtro opcional de conveniencia, jamás como filtro por defecto
  que esconda filas.
- Resumen financiero SIEMPRE incluye los meses archivados en sus gráficas y KPIs históricos.
- El cierre corre para el sitio base y para cada tenant activo, respetando la zona horaria configurada
  de cada uno.

### US-094 — Lectura de reportes: pestañas por tipo y ledger de eliminados
Como **administrador**, quiero consultar los reportes organizados por pestañas (Por reporte / Cortes /
Todo lo eliminado / Estado del inventario / Estado de tickets), con un ledger cruzado de todo lo que se
ha eliminado, para auditar sin mezclar conceptos distintos en una sola tabla.

**Criterios de aceptación:**
- **Navegación** (8 oct 2026): en escritorio (≥901px) las 5 vistas viven en un **submenú anidado
  dentro del ítem "Reportes" del sidebar** (mismo mecanismo `grid-template-rows` que los grupos
  FINANZAS/CATÁLOGO) y la fila horizontal de pestañas queda oculta; en móvil (<901px) el sidebar se
  oculta y la fila horizontal sigue siendo el único camino. Un solo lugar
  (`activarPestanaReportes()`) sincroniza ambos juegos de botones; el submenú se abre solo al entrar
  a la vista (incluido el restore de sesión en refresh) y se cierra al salir. El perfil **fiscal**
  sigue viendo solo "Estado de tickets" en el submenú nuevo.
- "Todo lo eliminado": ledger de todos los reportes con columna "Reporte de origen" y KPIs de
  auditoría (histórico + tendencia mensual).
- Cada registro muestra "Generado por" (cruzando `admin_auditoria` por ruta+ventana de tiempo, mejor
  esfuerzo, nunca bloquea) y botón "Ver historial" con el timeline completo de un identificador.
- Movimientos y eliminados se muestran en tablas separadas (acento rojo en eliminados).

---

## 20. Cuenta y seguridad

### US-095 — Recuperar contraseña por correo
Como **cliente** o **administrador/fiscal**, quiero poder recuperar mi contraseña por correo si la
olvido, sin depender de que alguien más me la restablezca.

**Criterios de aceptación:**
- Token de un solo uso (30 minutos de vigencia) enviado por correo, con página propia para
  establecer la contraseña nueva.
- Alcance real: solo cuentas de la tabla `usuarios` (cliente, administrador, fiscal) — la cuenta de
  respaldo, `ADMIN_USERS`, `/control` y los usuarios de sucursal compartidos no tienen recuperación
  por correo (no tienen fila propia en esa tabla).
- El enlace de recuperación respeta el slug del tenant que lo solicitó.

### US-096 — Mi Cuenta: perfil propio y cambio de contraseña
Como **usuario del panel**, quiero ver y editar mi propio nombre/teléfono/correo y cambiar mi
contraseña (verificando la actual), para no depender de otro administrador para algo tan básico.

**Criterios de aceptación:**
- Todos los perfiles ven su perfil básico; identidad de empresa y conteo de operadores solo para
  administrador/super.
- Cambiar la contraseña exige la contraseña ACTUAL correcta (a diferencia del restablecimiento con
  privilegio que hace otro administrador).
- Cuentas sin fila real en `usuarios` (`ADMIN_USERS`, credenciales API, usuario de sucursal
  compartido) ven sus datos como no editables.
- Zona horaria se muestra como espejo de solo lectura, con enlace a Configuraciones globales (vive a
  nivel tenant, no por usuario).

### US-097 — Suspender / reactivar cuentas del panel
Como **administrador**, quiero suspender una cuenta (de cualquier perfil) sin borrar su historial, y
que el corte de acceso sea inmediato aunque ya tenga una sesión abierta, para reaccionar rápido ante
un riesgo de seguridad.

**Criterios de aceptación:**
- Badge "Activo"/"Suspendido" siempre visible junto a cada cuenta; nadie puede suspender su propia
  cuenta con la sesión activa (sí puede reactivarse a sí mismo).
- Una cuenta administrador/fiscal/ventas con sesión abierta se desconecta en la siguiente petición al
  panel (sin esperar a un refresh manual) — no solo al volver a cargar la página.
- Una cuenta cliente no puede volver a iniciar sesión; si ya tenía una sesión abierta, se cierra sola
  en cuanto esa pestaña cargue cualquier página, con un aviso explicando por qué.
- Una cuenta suspendida sigue contando contra la cuota de usuarios de panel del tenant.

---

## 21. Comunicación

### US-098 — Plantillas de correo editables con vista previa
Como **super**, quiero editar el texto de los correos que envía el sistema (invitación, recuperar
contraseña, aviso al contador, factura lista, reporte) y ver una vista previa real antes de guardar,
para personalizar la comunicación sin tocar código.

**Criterios de aceptación:**
- 5 pestañas, una por plantilla, cada una con botón "Restablecer esta plantilla" independiente.
- Vista previa real: renderiza el mismo cascarón de correo (`construirCorreoBase()`) que se usa al
  enviar de verdad, no una simulación aparte.
- El diseño (logo, colores, estructura) nunca es editable desde aquí — solo el texto; los asuntos
  quedan fijos a propósito.
- Marcado simple real (negrita/cursiva) disponible en el cuerpo, escapado primero contra HTML/inyección
  antes de aplicar el marcado — el remitente nunca puede inyectar HTML arbitrario.
- El correo de venta y el de "Solicitar aclaraciones" quedan fuera a propósito (cascarón/contenido
  propios, no plantillas genéricas).

### US-099 — Aclaraciones: burbuja de contacto en el portal de cliente
Como **cliente**, quiero poder mandar una aclaración directo desde el portal (sin salir a mi correo),
para resolver dudas sobre mi factura o mi ticket.

**Criterios de aceptación:**
- Burbuja flotante "Solicitar aclaraciones" en dashboard/tickets/csf; modal con RFC de sesión
  prellenado, nombre, teléfono y detalle.
- El correo se manda AL correo de contacto configurado del tenant (o del sitio base, donde el campo
  es opcional) y se espera el resultado real del envío (no fire-and-forget, al no haber tabla de
  respaldo si el envío falla).
- Sin persistencia en base de datos — el folio es el timestamp + RFC.

---

## 22. Facturación — extracción y catálogos

### US-100 — Extracción automática del Total del CFDI
Como **administrador** de un negocio "solo facturas" (sin inventario ni Ventas activo), quiero que el
sistema lea el Total directo del XML dentro del ZIP de la factura, para no capturarlo a mano en cada
ticket.

**Criterios de aceptación:**
- Extracción por regex sobre el XML del CFDI real (con zlib nativo, sin dependencia nueva); tolera la
  declaración `<?xml ...?>`/BOM antes de la etiqueta raíz.
- Si la extracción falla, se pide captura manual sin bloquear (400 explicando qué falta); un XML leído
  correctamente nunca se deja pisar por un valor manual, aunque se mande uno.
- Columna `monto_factura_origen` distingue `xml` de `manual` para trazabilidad.

### US-101 — Catálogo real del SAT — Clave de Producto o Servicio
Como **fiscal/administrador**, quiero buscar la "Clave de Producto o Servicio" del SAT por texto o
clave directo en Configuraciones fiscales, para no salir del portal a buscarla en el sitio del SAT.

**Criterios de aceptación:**
- Catálogo local (52,000+ claves reales) sincronizable manualmente desde una fuente verificada
  (`CLAVE_PROD_SERV_SYNC_URL`); combobox con búsqueda en vivo, con enlace de respaldo al sitio del SAT
  si no hay resultados.
- Escribir los 8 dígitos a mano sigue funcionando siempre como captura manual directa.

---

## 23. Aprendizaje y soporte en producto

### US-102 — Centro de conocimiento (manual in-app)
Como **cualquier perfil del panel**, quiero un manual dentro de `/admin` y `/control` (con buscador y
glosario de términos), para aprender a usar el sistema sin llamar a soporte.

**Criterios de aceptación:**
- Categorías reales por vista del sidebar (todas las de `/admin`; en `/control`, Empresas/Sucursales/
  Super Admins), con buscador que resalta coincidencias en vivo.
- Categoría "Glosario" con términos reales del negocio (RFC, CFDI, kardex, costo promedio ponderado,
  rotación, folio, etc.), orden alfabético.
- Atajo de acceso directo en la barra de sesión, además del botón del menú lateral.
- Contenido 100% texto/HTML estático (cero componente/dependencia nueva), oculto para el perfil que no
  tiene acceso a una vista determinada.

### US-103 — Auditoría consultable en el panel
Como **administrador**, quiero una pantalla dentro de `/admin` para consultar la auditoría de mi
propio tenant, para revisar quién hizo qué sin pedirle el acceso a `/control`.

**Criterios de aceptación:**
- Vista "Auditoría" siempre acotada al tenant de la sesión — nunca cross-tenant.
- Switch "Mostrar Auditoría" en Configuraciones globales (encendido por defecto) oculta el botón del
  sidebar Y bloquea el endpoint del lado del servidor si está apagado — pegarle directo a la API no
  evita el switch.
- El registro de auditoría en sí (`admin_auditoria`) sigue corriendo pase lo que pase; el switch solo
  controla la pantalla de consulta.

### US-104 — Checklist "Primeros pasos" y recorrido guiado
Como **usuario nuevo** de una cuenta, quiero un checklist de primeros pasos y un recorrido guiado con
spotlight sobre los elementos reales de la pantalla, para entender el sistema sin leer documentación.

**Criterios de aceptación:**
- 3-4 pasos por perfil (fiscal/administrador/ventas), derivados de datos ya cargados — sin endpoint
  nuevo; banderas de evento en `localStorage` por cuenta (no por sesión).
- Tour con spotlight real sobre los elementos de la pantalla (coordenadas calculadas en vivo, no fijas),
  solo escritorio, una vez en la vida de la cuenta salvo que se pida repetir ("Ver el recorrido de
  nuevo" en el Centro de conocimiento).

---

## 24. Multi-tenant — control avanzado

### US-105 — Sucursales: usuarios compartidos entre empresas del mismo negocio
Como **operador de control**, quiero agrupar varios tenants del mismo negocio como "sucursales" y dar
de alta usuarios que entren a cualquiera con la misma contraseña, para no duplicar cuentas de personal
que trabaja en varias.

**Criterios de aceptación:**
- Lo único compartido es el login — cada tenant conserva su base de datos, inventario y ventas 100%
  aislados, sin excepción.
- La credencial vive solo en la BD de control (nunca en la tabla `usuarios` de cada tenant); un tenant
  vive en máximo un grupo a la vez.
- "Eliminar" un grupo es baja lógica (sin `DELETE`/`REFERENCES` — credencial de control angosta):
  suelta sus sucursales y desactiva sus usuarios compartidos, sin borrar ninguna fila.
- Con más de una sucursal en el grupo, `/admin` muestra un switcher en el sidebar para saltar entre
  ellas sin volver a iniciar sesión.

### US-106 — Super Admins gestionados desde /control sin reiniciar
Como **super**, quiero dar de alta o quitar cuentas "super" (`ADMIN_USERS`) desde `/control`, sin
editar el `.env` ni reiniciar ningún contenedor, para reaccionar rápido sin depender de un operador con
acceso al servidor.

**Criterios de aceptación:**
- Cambios se reflejan de inmediato (el backend recarga la lista sin reinicio).
- Escritura atómica sobre el `.env` real con respaldo (`.env.bak`) antes de sobreescribir.
- Alta/baja/cambio de contraseña validados contra duplicados (409) e inexistentes (404).

### US-107 — Activar tenant sin root de MySQL
Como **operador de control**, quiero poder completar el aprovisionamiento físico de un tenant en
estado "Provisionando" con un botón desde `/control`, sin necesitar la contraseña de root de MySQL en
el momento.

**Criterios de aceptación:**
- Usa un privilegio ya otorgado una sola vez al usuario de aplicación (`GRANT ALL ... ON tenant\_%.*`)
  para crear la base de datos del tenant y aplicarle el esquema completo.
- Verifica el estado ANTES del paso físico, para nunca marcar "activo" si la creación de la base de
  datos falla.
- El script CLI (`provisionar-tenant.js`, con root) sigue existiendo como respaldo si el privilegio
  llegara a faltar.

### US-108 — Cuota de usuarios de panel por tenant
Como **operador de control**, quiero definir cuántas cuentas de panel (administrador/fiscal/ventas)
puede tener un tenant, para que el límite de un plan se cumpla de verdad.

**Criterios de aceptación:**
- Campo editable desde el modal "Editar empresa" en `/control` (`max_usuarios`).
- `POST`/`PUT /api/admin/usuarios` rechazan (400, `CUOTA_USUARIOS_EXCEDIDA`) crear o reactivar una
  cuenta que exceda la cuota; nunca aplica a cuentas perfil `cliente`.
- Una cuenta suspendida sigue contando contra la cuota (no libera el "asiento").

### US-110 — Aviso de "Portal de clientes desactivado" en vez de un error genérico
Como **cliente** de una empresa cuyo plan no incluye el portal (o que lo apagó temporalmente), quiero
ver una pantalla clara que me diga que el portal no está disponible y cómo contactar a la empresa, en
vez de un error de inicio de sesión genérico indistinguible de una contraseña equivocada.

**Criterios de aceptación:**
- Con `portalClientesHabilitado` apagado, las 6 páginas del portal de cliente
  (login/dashboard/tickets/csf/restablecer/mi-cuenta) muestran el aviso — nunca `/admin`, que sigue
  funcionando normal (el flag solo gobierna la sesión del cliente).
- Diseño "Aurora profunda": fondo navy con blobs de luz cian moviéndose lento, cristal Clarvo girando
  en 3D real (no una animación plana), tarjeta con el correo de contacto REAL de la empresa (solo se
  expone cuando el portal está apagado; con el portal activo el dato sigue sin exponerse, mismo
  criterio de privacidad de siempre). Toda animación respeta `prefers-reduced-motion`.
- `GET /api/tema/:slug` (endpoint público que ya consume `theme.js` en las 6 páginas) expone
  `portalClientesHabilitado` y `contactoEmailPortalApagado`; `theme.js` es el único punto que decide
  sustituir la página — no hay que repetir el chequeo en cada script de página.
- Si el tenant no tiene correo de contacto configurado, la tarjeta de contacto simplemente no aparece
  (degradación elegante, igual que la burbuja "Solicitar aclaraciones").

### US-111 — "Portal de clientes" en Mi Cuenta: pausa real de autoservicio (tenant y sitio base)
Como **administrador** (de un tenant o del sitio base), quiero poder pausar/reanudar yo mismo el
portal de clientes desde Mi Cuenta, sin depender de `/control`, para atender un mantenimiento o
incidente puntual sin esperar a que alguien con acceso a `/control` lo apague por mí.

**Criterios de aceptación:**
- El switch "Portal de clientes" de Mi Cuenta (antes decorativo, con etiqueta "Próximamente") ahora
  es real: al apagarlo, el cliente ve de inmediato el aviso "Portal de clientes desactivado" (US-110)
  en el lugar de siempre, sin cambiar ninguna URL.
- Dos capas independientes: el *ceiling* de plan desde `/control` (`portal_clientes_habilitado`) sigue
  siendo la única forma de reactivar un portal apagado a nivel plan — el switch de Mi Cuenta nunca
  puede saltarse eso, y se bloquea (deshabilitado, con explicación) cuando el plan ya lo tiene apagado.
- Aplica igual a un tenant (`/<slug>/admin`) y al sitio base (`/admin` sin slug) — el sitio base no
  tiene plan que lo gobierne, así que ahí el switch de Mi Cuenta es la única capa.
- La raíz pelada (`http://dominio/`, sin ruta) muestra el aviso igual que `/login` cuando el portal
  está pausado — ambas rutas sirven la misma página de login por debajo.

---

## 25. Historial / pendientes a futuro

### US-059 — Subir logo real de la empresa en el panel *(IMPLEMENTADA — ver US-109)*
Como **administrador**, quiero una pantalla en el panel para subir/configurar el logo real de mi
empresa (antes el correo usaba la marca del tenant y el logo solo se gestionaba desde `/control`),
para personalizar los correos. *(Resuelta por la tarjeta "Marca e identidad visual" en
Configuraciones — ver US-109, PROJECT_STATE.md punto 373.)*

### US-060 — Navegación móvil del panel / control verificada en navegador real
Como **usuario**, quiero que el ciclo de vida de `/control` y las 6 páginas del sitio se prueben en
un navegador real en móvil y escritorio, para garantizar la experiencia.
*(Pendiente de validación manual — el ciclo de vida de control y el rediseño se validaron por API/E2E; la cobertura móvil en navegador real sigue pendiente.)*

### Ideas/áreas posibles para nuevos módulos (no implementadas)

Estas son áreas donde la arquitectura ya tiene bases listas para evolucionar
(a confirmar requisitos antes de implementar, protocolo `addv-web-app`):

- **Recuperación de contraseña** (flujo de email con enlace, hoy solo existe el reset desde el panel).
- **CFDI completo**: timbrado real, cancelación de facturas, estatus del SAT.
- **Portal de pagos / pasarela** y conciliación con las ventas.
- **Notificaciones y reportería avanzada** (filtros por tenant, exportación masiva, programación).
- **UI de consulta de auditoría** (los datos ya se registran en `control_tenants.admin_auditoria`).
- **Multi-idioma / multi-moneda** para expansión del producto.
- **App móvil / PWA** del portal de cliente — pedida y CANCELADA explícitamente por el usuario
  antes de implementar (ver PROJECT_STATE.md punto 132); en su lugar se implementó el modo fuera
  de línea de Ventas/Gastos (US-073/US-074/US-075, ya implementadas).

---

## 26. Pendientes documentados en esta sesión (271-274 + filtro por app) — *propuestas, sin implementar*

> Todo lo aquí listado está en `PROJECT_STATE.md:271-274` y `pendientes.html` (secciones Cotizador & Marketplace, Centro de conocimiento / Recorrido, Inicio de sesión / Seguridad). Estado: **propuesta, sin analizar a fondo**. No implementar sin responder las preguntas documentadas en cada punto.

### US-077 — Cotizador "Clarvo a la medida" con inventario de costos en Clarvo base *(PROPUESTA — punto 271)*
Como **operador de control**, quiero un cotizador que permita armar un Clarvo a la medida seleccionando funciones/módulos, para que el cliente pague solo por lo que necesita y su tenant se aprovisione con el costo correcto.

**Criterios de aceptación (por definir, ver PROJECT_STATE.md:271):**
- El **Clarvo base sin tenant** (`portal_facturacion` sin slug) lleva el inventario de costos (`clarvo_funciones`/`clarvo_costos` — nombre, costo, categoría, dependencias).
- Wizard: selección de funciones → cotización en vivo → pedido → `provisionar-tenant.js` (mismo que `tenantIntake.js`/`provisionar-tenant.js` del punto 101).
- La venta se registra en BD base (`ordenes_compra` base vs. tabla nueva `clarvo_ventas`/`cotizaciones` + link a `control_tenants.tenants`) — por definir.
- "Dar de alta las funciones" = alta en catálogo base vs. activar flags por tenant del punto 244 — por definir.

### US-078 — Clarvo Site Market: marketplace de addons por cuenta *(PROPUESTA — punto 272, requiere brainstorming)*
Como **cliente/administrador**, quiero comprar addons desde un Site Market asociados a mi cuenta Clarvo, para activar nuevas capacidades sin migrar.

**Criterios de aceptación (por definir, ver PROJECT_STATE.md:272):**
- Dónde vive: en `/admin` del tenant vs. `market.clarvo.mx` vs. sitio base — por decidir.
- Catálogo: qué addons (módulos Inventarios/Reportes/Facturación, integraciones, almacenamiento extra del punto 250), precio, vigencia.
- Modelo: `market_addons`/`market_compras` por `tenant_id`/`slug` (o `usuarios`), asociación a cuenta.
- Flujo de pago: Stripe/MercadoPago, suscripción, prueba gratis — por decidir. La compra activa flag en `control_tenants.tenants`.
- **Nota:** requiere sesión de brainstorming antes de diseñar.

### US-079 — Actualizar centros de conocimiento + recorrido guiado *(PROPUESTA — punto 273)*
Como **usuario nuevo**, quiero que el Centro de conocimiento esté actualizado con todos los cambios y un recorrido guiado, para aprender el sistema sin llamar a soporte.

**Criterios de aceptación (por definir, ver PROJECT_STATE.md:273):**
- Actualizar `frontend/admin.html`/`admin.js` `CONOCIMIENTO_CATEGORIAS` y vista "Centro de conocimiento" (y `control` si aplica) con todos los cambios recientes (271/272, 269/270, 256-260, 242/243 YouTube).
- "Recorrido" = tour guiado/onboarding paso a paso por `/admin`, `/control`, portal cliente — librería `intro.js`/`shepherd` vs. implementación propia — por decidir.
- Cobertura: alta en `/control`, Ventas, Gastos, Inventarios, Reportes, Centro mismo — por decidir.
- Formato: tooltips anclados + checklist de progreso vs. documentación estática por categorías con fichas/links — por decidir.

### US-080 — Doble factor por correo solo para Administrador, toggle en admin *(PROPUESTA — punto 274, 10 preguntas documentadas)*
Como **administrador**, quiero que el registro de un perfil **Administrador** exija 2FA por correo (habilitable/inhabilitable desde la plataforma admin), para proteger altas sensibles.

**Criterios de aceptación (por definir, ver PROJECT_STATE.md:274 — no implementar sin responder):**
- Solo perfil `administrador` (no `fiscal`/`cliente`) — por confirmar. ¿Alta desde `POST /api/admin/usuarios` (panel) o también `POST /api/auth/registro` público?
- Qué correo recibe OTP: `usuarios.email` del nuevo admin vs. del creador vs. `ADMIN_USERS` — por decidir.
- OTP 6 dígitos con expiración (ej. 10 min) vs. link mágico; tabla `usuarios_2fa_codigos` temporal; reenvío y límite de intentos — por decidir.
- Toggle: global `configuracion.admin_2fa_habilitado` vs. por tenant `control_tenants.tenants.admin_2fa`, default ON/OFF — por decidir.
- UI: tarjeta "Seguridad" en `frontend/admin.html` junto al cambio de contraseña de `admin` (punto 17) o en "Usuarios" — por decidir. ¿Quién puede togglear: solo `super`/`ADMIN_USERS` vs. cualquier `administrador`?
- Guard: `POST /api/admin/usuarios` genera código + `POST /api/admin/usuarios/verificar-2fa` para confirmar, o bloquea creación hasta verificar — por decidir.
- Si SMTP no configurado o falla: bloquear registro o degradar a sin-2FA con aviso — por decidir.
- ¿Solo registro o también cada login? — por decidir.

### US-081 — Filtrar pendientes por app (Cliente / Admin / Control) *(IMPLEMENTADA — pendientes.html)*
Como **operador/product owner**, quiero filtrar `pendientes.html` por app (Cliente / Admin / Control), para separar qué toca a cada superficie.

**Criterios de aceptación (implementado 10 sep 2026):**
- Barra "Filtrar por app:" con pills Todos/Cliente/Admin/Control, conteos automáticos, `aria-pressed`, y `?app=` en URL combinable con `?q=` del buscador.
- Cada `<tr>` lleva `data-app="cliente"` / `"admin"` / `"control"` o combinaciones (`cliente,admin,control`); el filtro respeta búsqueda por texto y oculta secciones vacías.

## 27. Facturación y campana de notificaciones del portal de cliente (8 oct 2026)

> Numeración: estas 3 historias se publicaron originalmente como
> US-082/083/084 y se **renumeraron a US-112/113/114** el 9 oct 2026 al
> detectarse que Inventarios (sección 18) ya ocupaba US-082/083/084.
> Si algún documento viejo cita "US-082 = pausa de Facturación", es esta.

### US-112 — Pausar/reanudar Facturación desde Configuraciones, tenant y sitio base *(IMPLEMENTADA — punto 378)*
Como **administrador**, quiero un switch en Configuraciones para pausar/reanudar Facturación yo mismo, sin pasar por `/control`, para desactivarla temporalmente sin perder la capacidad de reactivarla.

**Criterios de aceptación (implementado 8 oct 2026):**
- Dos capas: el *ceiling* de plan desde `/control` (`facturacion_habilitada`, solo `/control` lo reactiva) y la pausa de autoservicio nueva (`facturacion_pausada`, tenant y sitio base) — efectivo = ambas en `true`.
- Tarjeta "Módulo Facturación" en Configuraciones, con gate de perfil (administrador/super) pero **sin** gate de plan propio — evita que se esconda a sí misma al apagarse (mismo motivo que Portal de clientes vive en Mi Cuenta).
- Pausar Facturación apaga RFC obligatorio, Tickets/CSF y oculta el menú correspondiente para el cliente; Cuentas por cobrar del portal de clientes NO se ve afectada (Portal de clientes gobierna a Facturación, nunca al revés — decisión explícita del usuario).
- Verificado: Jest 1200/1200, E2E real `facturacion-pausa-admin.spec.ts`.

### US-113 — Campana de notificaciones del portal de cliente: promociones + pago registrado *(IMPLEMENTADA — punto 379)*
Como **cliente**, quiero una campana de notificaciones (con sonido) en mi portal, para enterarme de promociones del negocio y de que mis pagos en Cuentas por cobrar ya quedaron registrados.

**Criterios de aceptación (implementado 8 oct 2026):**
- Campana centralizada en `frontend/portal.js` (inyectada por JS en las 5 páginas del portal de cliente, sin HTML duplicado), con sondeo de 60s y campanada sintetizada (tono propio, Web Audio, sin archivo de audio).
- Se oculta sola si ni Cuentas por cobrar ni Promociones aplican en el plan del tenant (`GET /api/notificaciones` 404) — mismo criterio que la campana de `/admin`.
- "Pago registrado": automática, al confirmar un cobro real en Cuentas por cobrar (vinculada por correo), con clic-through a la página de Crédito.
- Gobernanza completa en `/control` (flag nuevo `promocionesHabilitado`, propio — no reutiliza el de Ventas/CxC porque enviar promociones es una capacidad nueva).
- Verificado: Jest 1216/1216, E2E real `notificaciones-cliente.spec.ts`.

### US-114 — Promociones: componer, vigencia, archivar, relanzar, eliminar *(IMPLEMENTADA — punto 379 + addendum)*
Como **administrador**, quiero enviar una promoción a todos mis clientes con vigencia opcional, y poder archivarla/relanzarla/eliminarla después, para no tener que mandar un mensaje nuevo cada vez que quiero repetir o retirar una oferta.

**Criterios de aceptación (implementado 8 oct 2026, propuesta visual 3 de 6 presentadas vía Artifact):**
- Solo administrador/super (nunca ventas/fiscal), broadcast únicamente — sin segmentar por cliente.
- Vigencia opcional: "Sin vigencia" (hasta eliminarla a mano) o "Hasta" un día de calendario — se guarda respetando la zona horaria del tenant (reutiliza `backend/utils/limitesPeriodo.js`, mismo criterio que "ventas hoy" del punto 371), para que "hasta el 31 de octubre" cubra el día completo en hora de México.
- Estado (Activa/Vencida/Archivada) se calcula al leer, nunca se guarda — `archivada_en` (manual) gana sobre `vigencia_hasta` (automático).
- Tarjetas con barra de progreso de vigencia; acciones por ícono: Archivar/Eliminar en una Activa, Relanzar/Eliminar en una Archivada o Vencida — Eliminar pide confirmación (modal genérico del sitio), es borrado físico y terminal.
- Relanzar reactiva la MISMA promoción (no duplica), vigencia nueva opcional — limitación conocida: un cliente que ya la había marcado leída antes de archivarse no vuelve a sonar al relanzarla (aceptado a propósito en v1).
- Centro de conocimiento (`CONOCIMIENTO_CATEGORIAS.promociones`) y recorrido guiado del perfil Administrador (`ONBOARDING_TOUR_PASOS.administrador`) actualizados con el nuevo botón del sidebar.
- Verificado: Jest 1228/1228, E2E real (ciclo completo enviar→archivar→relanzar→eliminar).
- 24 filas etiquetadas (Ventas→admin, Infra→control, Seguridad 274→admin,control, 271/272→cliente,admin,control, etc.).

---

## 28. Panel y control — trabajos del 8 y 9 de octubre de 2026

> Cubre lo implementado DESPUÉS de la sección 27: puntos 380, 381, 382 y
> 384 de `PROJECT_STATE.md`, más el bloque de navegación del panel del
> 8 oct (commits `e583d46`…`0f6546b`, que no tiene número de punto propio).

### US-115 — Histórico siempre visible con paginación real en Ventas, Gastos y Cuentas por cobrar *(IMPLEMENTADA — punto 380)*

Como **administrador**, quiero que el histórico completo de mis ventas,
gastos y cobros siempre esté a la mano — navegable por páginas reales y
filtros del servidor —, para que archivar el mes nunca se convierta en
"¿dónde quedó esa venta?".

**Criterios de aceptación (implementado 8 oct 2026):**
- `GET /api/admin/ordenes-compra` paginado de verdad: `pagina`/`por_pagina`
  (default 25, tope 100, mínimo 5) + filtros **server-side**
  (`busqueda`, `fecha_desde/hasta`, `total_min/max`, `estado_pago`,
  `vencimiento`, `facturacion`, `periodo`) con `COUNT(*)` + `LIMIT/OFFSET`.
- Selector de periodo por defecto **"Todos los periodos"** en Ventas y
  Gastos: el histórico archivado por el cierre mensual (punto 158) deja de
  ocultarse — `archivado_en` ya no filtra por defecto en ningún endpoint
  (`GET /api/admin/gastos` perdió ese bloque; `?periodo=` quedó como
  atajo opcional).
- Cuentas por cobrar con **dos fuentes** (decisión de diseño documentada en
  el punto 380): `cxcBaseCache` (máx. 500 pendientes + 500 cobradas
  recientes) alimenta los KPIs/aging/recordatorio masivo sin cambios, y
  la pestaña "Cobradas" pagina en el servidor sin tope. Nuevo campo
  `resumenCxc` en la respuesta para que los KPIs no bajen el histórico.
- Helper genérico `renderPaginacionServidor()` (con elipsis) reutiliza las
  clases de la paginación de Reportes→Cortes — un solo lenguaje visual.
- `ordenesCache` ya **NO** es "todas las ventas": es solo la página actual
  (ver regla persistente en `CLAUDE.md`).
- Verificado: Jest 1229/1229, E2E real `ventas-cxc-paginacion.spec.ts`
  ("1-25 de 212 cobradas" contra datos reales).

### US-116 — Candado de traslape en el cierre mensual automático *(IMPLEMENTADA — punto 380)*

Como **sistema**, quiero que la tarea horaria de cierre mensual nunca corra
dos veces en paralelo contra la misma base, para que el archivado y su
reporte-snapshot no se pisen.

**Criterios de aceptación (implementado 8 oct 2026):**
- Candado **en memoria** (`corridaEnProgreso`): si la corrida anterior sigue
  viva al llegar la siguiente, esta se omite con
  `{ omitido: true, motivo: 'corrida_anterior_en_progreso' }` en vez de
  ejecutarse en paralelo (aislamiento de error por tenant ya existía,
  dentro de su propio `try/catch` — no se tocó).
- Pausa de 500 ms entre lotes de 5 tenants (`PAUSA_ENTRE_LOTES_MS`).
- El reporte-snapshot y el orden "reporte guardado antes de archivar" NO
  cambian.

### US-117 — Barra superior siempre visible y submenú anidado de Reportes en el panel *(IMPLEMENTADA — 8 oct 2026, sin número de punto)*

Como **administrador**, quiero que la barra superior del panel (libro de
conocimiento, razón social, "+ Registrar venta", campana, sesión) no se
vaya con el scroll y que las 5 vistas de Reportes se naveguen desde el
sidebar, para llegar a cualquier cosa sin volver arriba ni buscar una fila
de pestañas.

**Criterios de aceptación (implementado 8 oct 2026):**
- Barra superior `position: fixed` en escritorio (≥901px) — `sticky` no
  funcionó en este layout anidado (verificado con `getComputedStyle`:
  `rectTop` en espejo exacto de `scrollY`), mismo motivo por el que el
  sidebar ya era `fixed`. `left: var(--sidebar-w)` para seguir alineada
  cuando el riel colapsa; acento cian de marca al hacer scroll.
- Submenú anidado de Reportes en el sidebar de escritorio: mismos 5 íconos
  del contenido, ids propios (`btn-sidebar-reportes-*`), sincronizados con
  la fila horizontal por `activarPestanaReportes()`; la fila horizontal
  queda solo en móvil (<901px), donde el sidebar no existe.
- Cierre de 2 bugs propios de este cambio: íconos + `<span>` faltantes en
  los 5 hijos (texto crudo en riel de 72px) y línea cian visible con el
  submenú "cerrado" (padding del interno contaba como mínimo intrínseco de
  `grid-template-rows: 0fr` → 4px reales).
- **Menú móvil sincronizado**: "Promociones" se agregó al grid de íconos
  `#admin-menu-movil` (registro HTML aparte del sidebar — el gotcha de
  "vista nueva" otra vez), y el stepper de inventario dejó de mostrar las
  flechitas nativas del navegador en "Cantidad".
- Verificado en vivo con viewport real 1440px y 390px (chrome-devtools);
  E2E `reportes-estado-tickets.spec.ts` migrado a los botones nuevos.

### US-118 — Suscripción de cada empresa (prueba, ciclo, expiración, estatus de cobro) *(IMPLEMENTADA — punto 381)*

Como **operador de control**, quiero registrar por empresa si está en
prueba, su ciclo de facturación, cuándo expira y cómo va su cobro, para
ver de un vistazo qué empresas están por vencer.

**Criterios de aceptación (implementado 9 oct 2026):**
- 6 columnas nuevas en `control_tenants.tenants` (todas opcionales, el
  concepto es nuevo): `suscripcion_en_prueba`, `suscripcion_dias_prueba`,
  `suscripcion_prueba_inicia_en`, `suscripcion_ciclo`
  (`mensual`/`anual`), `suscripcion_expira_en`, `suscripcion_estatus`
  (`prueba`/`pagada`/`pendiente`/`vencida`/`cancelada`).
- **El estatus de cobro es manual** — todavía no hay integración con
  Stripe; la propia UI lo dice.
- Pestaña "Suscripción" en el modal de edición (5ª, entre "Plan y funciones"
  e "Identidad visual"), con **botón de guardar propio** (`PUT
  /api/control/tenants/:slug/suscripcion`) — patrón independiente del
  "Guardar cambios" general.
- Panel dividido: anillo de progreso `conic-gradient` 100% cliente que se
  recalcula en vivo (verde/ámbar/rojo por días restantes) + los 6 campos.
- Columna "Vence" en la tabla principal (badge semántico) + checkbox
  "Próximos a vencer (≤ 7 días)", filtro 100% client-side sobre la última
  carga (sin endpoint nuevo).
- Auditoría de la operación en `tenant_eventos` (mismo patrón que
  `tenantTema.js`/`tenantMarca.js`).
- *Desviación anotada*: la propuesta aprobada mostraba "Próximos a vencer"
  como pestaña dedicada; se implementó como checkbox de filtro — pendiente
  de confirmar con el usuario.

### US-119 — Riel colapsable y barra fija también en `/control`, sin títulos redundantes *(IMPLEMENTADA — punto 382)*

Como **operador de control**, quiero que `/control` se navegue igual que
`/admin` (riel colapsable, barra superior pegada) y que las vistas no
repitan en un `<h1>` el nombre que el sidebar ya está resaltando.

**Criterios de aceptación (implementado 9 oct 2026):**
- Mismo CSS reutilizado de `admin.css` (`/control` ya lo usa); solo se
  agregó el HTML/JS propio: monograma mini, botón `#control-btn-colapsar-
  sidebar`, estado en `localStorage` con clave **separada**
  (`sidebar_colapso_control_v1_<usuario>` — nunca compartir estado con
  `/admin`), listener de scroll para `.admin-header.is-scrolled`.
- Sin lógica de grupos anidados: el nav de `/control` no tiene submenús
  tipo Reportes, no aplica.
- `<h1>` eliminado de las 5 vistas que mapean 1:1 con un tab del sidebar
  (Empresas, Planes, Sucursales, Super Admins, Auditoría); **se conserva el
  de "Papelera"** a propósito (es sub-vista alcanzada desde Empresas y el
  sidebar se queda en "Empresas"). El botón de ayuda "?" de cada vista se
  conserva.
- Verificado con clics reales contra Docker: colapso a 72px, header
  `fixed` con `left:72px`, títulos ausentes/presentes donde corresponde.

### US-120 — Venta mínima / punto de equilibrio en "Utilidad neta del mes" *(IMPLEMENTADA — punto 384; extiende US-070)*

Como **administrador**, quiero ver en la tarjeta de utilidad cuánto tengo
que vender al mes y al día para llegar a $0, con la visualización que más
me guste, para tener una meta concreta en vez de solo un saldo.

**Criterios de aceptación (implementado 9 oct 2026):**
- Definición: venta mínima **mensual** = gastos del mes (mismo subtotal que
  la fórmula de utilidad resta para llegar a $0); venta mínima **diaria** =
  mensual ÷ días del mes (`mes_actual.dias_mes` nuevo en
  `GET /api/admin/resumen-financiero`, diff de fechas de calendario local,
  nunca `Date.UTC()` sobre "ahora").
- Selector de 4 tipos de gráfica dentro de la tarjeta: **línea de
  equilibrio** (por defecto), velocímetro, bullet chart y termómetro —
  preferencia en `localStorage` (`vm_tipo_grafica_v1_<tenant>_<usuario>`),
  nunca en BD (es cosmético).
- Animación 10% más lenta **solo** en esta tarjeta (`--anim-speed: 1.1`
  scoped, con `@media (prefers-reduced-motion: reduce)` también scoped).
- Dos bugs reales corregidos en el camino: `--color-positive` **nunca
  existió** como variable CSS en este proyecto (verde invisible en
  velocímetro/bullet → hex directo `#1FAE6B`), y el termómetro recortaba
  su propia etiqueta (`overflow:hidden` del tubo sobre una etiqueta fuera
  de su ancho → wrapper nuevo sin overflow).
- Verificado: Jest 1229/1229 y clics reales con datos del tenant (gastos
  $75,959.48 → equilibrio diario $2,450.31), preferencia persistente entre
  recargas.
