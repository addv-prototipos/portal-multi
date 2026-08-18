# Historias de Usuario — Portal de Facturación ADDV

Documento de historias de usuario del **Portal de Facturación ADDV** (carga de
constancia de situación fiscal, tickets de compra, facturación y administración
multi-tenant). Cada historia sigue el formato *"Como [rol], quiero [capacidad],
para [beneficio]"* e incluye criterios de aceptación verificables.

> Fuente de comportamiento: `README.md` y `PROJECT_STATE.md`. Las historias
> describen funcionalidad **ya implementada** en el proyecto (nada de esto está
> pendiente de construir, salvo donde se indica explícitamente).

## Actores

| Actor | Descripción |
|---|---|
| **Cliente** | Usuario del portal público (RFC + contraseña). Sube constancia y tickets, descarga facturas. |
| **Visitante** | Persona sin cuenta que accede al formulario público de constancia (acceso anónimo, retrocompatibilidad). |
| **Fiscal** | Perfil del panel de administración: gestiona constancias y tickets. No ve usuarios ni órdenes de compra. |
| **Administrador** | Perfil del panel: gestiona usuarios, órdenes de compra, reportes y configuraciones fiscales. |
| **Super** | Cuenta `admin` de respaldo y cuentas de `ADMIN_USERS`: acceso total al panel y a `/control`. |
| **Operador de control** | Persona con cuenta "super" que opera la app de control `/control` (ciclo de vida de empresas/tenants). |
| **Sistema** | Comportamiento automático del backend (limpiezas, notificaciones, respaldos). |

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
- La sesión dura 12 horas en una cookie httpOnly firmada con HMAC.
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
Como **cliente**, quiero ver mi tablero con accesos a "Subir constancia" y "Subir tickets de compra"
y la lista de todas mis solicitudes de tickets, para dar seguimiento a mis trámites.

**Criterios de aceptación:**
- Cada ticket muestra folio (`TK-000001`), nombre de archivo, estatus y fecha de actualización.
- Estatus con insignias de color: Pendiente, En curso, Cancelado, Listo.
- Aislamiento por RFC: cada usuario solo ve y descarga sus propios tickets.

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

## 4. Tickets de compra (Cliente)

### US-014 — Subir ticket de compra con verificación de orden
Como **cliente**, quiero subir la foto de mi ticket (JPG/PNG/WEBP) y, si "Orden de compra" está
habilitada, capturar No. Compra, Total, Fecha y Hora tal como llegaron en mi correo de confirmación,
para solicitar mi factura.

**Criterios de aceptación:**
- Los 4 campos de compra son obligatorios solo si la orden de compra está habilitada (si no, la sección desaparece).
- El backend valida contra una orden real; si no coincide → `400`, `codigo: COMPRA_NO_ENCONTRADA`, mensaje genérico "No se encuentra registrada la compra para facturar." (sin pistas de cuál campo falló).
- Si la orden ya fue facturada → `400`, `codigo: COMPRA_YA_FACTURADA`, "Esa compra ya fue facturada."
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

### US-017 — Restricción de acceso por perfil
Como **fiscal** o **administrador**, quiero ver solo las vistas y tarjetas de mi perfil en el panel,
para no acceder a áreas que no me corresponden.

**Criterios de aceptación:**
- Interfaz: los botones/tarjetas fuera de perfil se ocultan, no solo se deshabilitan.
- Backend: los 45 endpoints de `/api/admin/*` exigen `requireAdminAuth` + `requireAdminArea(...)` → 403 real.
- Matriz de acceso: Super → todo; Administrador → Órdenes, Usuarios, Reportes, Config fiscales/reportes; Fiscal → Constancias, Tickets, Campos obligatorios, Config fiscales.
- "Cuenta de respaldo admin" solo visible/editable por el usuario `admin` exacto (`requireUsuarioAdminExacto`).
- Si la vista por defecto no está permitida, se navega a la primera vista disponible.

### US-018 — Auditoría de acciones administrativas
Como **super**, quiero que cada mutación del panel y cada login queden registrados
(fire-and-forget: si falla la auditoría, no bloquea la petición), para poder auditar quién hizo qué.

---

## 6. Panel — Vista Constancias

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

## 7. Panel — Vista Tickets

### US-021 — Gestionar tickets (estatus, notas, factura)
Como **fiscal**, quiero abrir un ticket y gestionar su estatus, notas internas y factura,
para dar seguimiento y completar la facturación.

**Criterios de aceptación:**
- Panel con datos del ticket (RFC, Uso CFDI, tipo de pago, actualizado por, archivo), compra capturada (si aplica) y comentarios del cliente destacados.
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
(imagen, factura y registro) y órdenes de compra (registro), para cumplir políticas de retención.

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

## 8. Panel — Vista Orden de compra (Administrador)

### US-027 — Registrar una orden de compra
Como **administrador**, quiero registrar una compra/servicio (concepto, cantidad, correo del cliente)
para generar su factura y enviarle el comprobante por correo.

**Criterios de aceptación:**
- No. Compra se auto-genera (`OC-000001`); fecha/hora se toman del servidor con la zona horaria configurada.
- IVA de solo lectura (porcentaje global); el total se calcula `cantidad × (1 + iva%)` con vista previa en vivo.
- Correo: desplegable solo con correos que ya tienen constancia; al elegir, se muestran RFC y razón social de solo lectura (el backend revalida).
- Todos los campos son obligatorios.
- Formulario y lista lado a lado en pantallas anchas; formulario `sticky`; "Registrar orden" expandible/colapsable con preferencia recordada.
- Envío de correo de confirmación con diseño de ticket (fire-and-forget).

### US-028 — Correo de confirmación de compra al cliente
Como **cliente**, quiero recibir un correo con diseño de ticket (datos de la compra, "TOTAL A FACTURAR"
y botón "Iniciar sesión y solicitar mi factura"), para saber qué datos usar al facturar.

**Criterios de aceptación:**
- Fecha y hora en renglones separados (coinciden con los campos del formulario de subir ticket).
- Se envía en HTML y texto plano.
- Logo parametrizado (marca del tenant) con fallback "ADDV".

### US-029 — Reenviar correo de confirmación
Como **administrador**, quiero reenviar el correo de confirmación de una orden existente,
para el cliente que lo perdió.

**Criterios de aceptación:**
- A diferencia del envío original, espera el resultado y avisa con toast éxito/fallo.

### US-030 — Marcar orden como facturada e impedir doble facturación
Como **administrador**, quiero ver un ✅ en las órdenes ya facturadas, para no facturar dos veces la misma compra.

**Criterios de aceptación:**
- ✅ con tooltip cuando el ticket vinculado pasó a "listo".
- El backend rechaza otro ticket para una orden ya facturada (`COMPRA_YA_FACTURADA`).
- Tooltip de razón social al pasar el cursor sobre el correo de cada fila.

---

## 9. Panel — Vista Usuarios (Administrador)

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

### US-037 — Activar/desactivar "Orden de compra"
Como **administrador**, quiero prender o apagar la funcionalidad completa de "Orden de compra"
(se guarda al momento), para controlar si los clientes deben verificar su compra al subir tickets.

**Criterios de aceptación:**
- Apagada: el botón "Orden de compra" desaparece del menú, la sección "Verifica tu compra" desaparece de `tickets.html` y el backend deja de exigir los 4 campos.
- Encendida (default): todo funciona normal.

---

## 10. Panel — Vista Configuraciones globales

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
para que las órdenes de compra se calculen y muestren correctamente.

**Criterios de aceptación:**
- La constancia de la compañía reutiliza la misma extracción de PDF; aquí el RFC **es obligatorio** (si no se identifica, se rechaza).
- Régimen, razón social y tipo de persona se muestran de solo lectura (tipo calculado por 3 señales en orden de confiabilidad).
- El IVA se "fotografía" en cada orden: cambios posteriores no afectan órdenes ya creadas.
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

## 11. Panel — Vista Reportes (Administrador)

### US-042 — Generar y consultar reportes
Como **administrador**, quiero generar reportes (manual o automático antes de la retención) y
consultarlos (selector, resumen, filtros combinables), para dar seguimiento a la facturación del mes.

**Criterios de aceptación:**
- Reporte manual: tickets y órdenes de compra activos del mes calendario en curso; se guarda siempre; se envía por correo solo si hay correo de reportes configurado.
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

## 12. Experiencia general y confiabilidad

### US-045 — Experiencia consistente y accesible
Como **cliente**, quiero que todas las páginas sean mobile-first, con foco visible por teclado,
etiquetas asociadas a campos, contraste adecuado y tooltips propios del sistema, para usarlas desde
cualquier dispositivo.

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

## 13. Multi-tenant — App de control `/control` (Super / Operador)

### US-048 — Listar empresas (tenants)
Como **super**, quiero ver la lista de empresas del catálogo de control (con estado, slug y contacto),
para administrar la plataforma multi-tenant.

### US-049 — Alta de empresa nueva (solicitud)
Como **operador de control**, quiero capturar una solicitud de alta (nombre, slug, contacto, notas y
datos fiscales opcionales) desde `/control`, para iniciar el proceso de aprovisionamiento.

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

---

## 14. Multi-tenant — Infraestructura (Operador / DevOps)

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
- **Pendiente de validación real** (recomendado antes de producción): probar subir/bajar/borrar
  contra MinIO real en el stack levantado.

---

## 15. Historial / pendientes a futuro

### US-059 — Subir logo real de la empresa en el panel
Como **administrador**, quiero una pantalla en el panel para subir/configurar el logo real de mi
empresa (hoy el correo usa logo de texto "ADDV" o la marca del tenant), para personalizar los correos.
*(Campo `logo_url` y lógica ya existen; falta la pantalla — ver PROJECT_STATE.md.)*

### US-060 — Navegación móvil del panel / control verificada en navegador real
Como **usuario**, quiero que el ciclo de vida de `/control` y las 6 páginas del sitio se prueben en
un navegador real en móvil y escritorio, para garantizar la experiencia.
*(Pendiente de validación manual, ver PROJECT_STATE.md — el ciclo de vida de control se validó por API.)*
