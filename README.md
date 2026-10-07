# Clarvo — Multi-tenant (constancia fiscal, tickets, ventas, gastos, inventarios y facturación)

**Clarvo** ("tu negocio en orden", desarrollado por ADDV) es una plataforma web multi-tenant (múltiples empresas cliente, cada una con su propia base de datos, sus propias URLs `/<slug>` y `/<slug>/admin`, y su propia identidad visual) para que clientes y proveedores capturen sus datos de facturación y suban su **constancia de situación fiscal** (solo PDF; el sistema valida que sea un documento genuino del SAT y extrae automáticamente el nombre/razón social, el régimen fiscal y el código postal). Cada usuario, identificado por su correo electrónico, puede mantener **un solo archivo activo**; si ya existe uno, la app pide confirmación antes de reemplazarlo. Incluye además tickets de venta con verificación de compra, cuentas por cobrar, un panel de administración con gráficas de Business Intelligence y auditoría consultable, control de gastos de la operación, un módulo de inventarios con costeo promedio ponderado y trazabilidad completa (incluida moneda extranjera, código de barras y etiquetas de impresión), un Centro de conocimiento con manual y glosario integrados, identidad visual (marca, tema y logo) por empresa, y una app de control (`/control`) cross-tenant para gestionar el ciclo de vida de las empresas dadas de alta, incluida la asociación de empresas como sucursales del mismo negocio con usuarios de acceso compartidos.

## 🧱 Tecnologías usadas

| Capa | Tecnología |
|---|---|
| Backend | Node.js 20 + Express |
| Lectura de PDF | `pdf-parse` (extrae texto para validar el documento y leer nombre/razón social, régimen fiscal y código postal) |
| Envío de correo | `nodemailer` (SMTP configurable desde el panel de administración, pensado para Gmail) |
| Reportes | `exceljs` (genera archivos `.xlsx` reales para "Lectura de reportes"; el Markdown y el CSV se generan sin ninguna librería externa) |
| Base de datos | **MySQL 8** (`mysql2/promise`), en su propio contenedor con volumen Docker persistente |
| Frontend | HTML + CSS + JavaScript vanilla, servido con Nginx |
| Almacenamiento de archivos | **MinIO** (self-hosted, compatible con S3, vía `@aws-sdk/client-s3`) — ver `backend/utils/storage.js`. El bind mount local `./uploads` ya no se usa para guardar nada (queda vestigial, ver PROJECT_STATE.md punto 92) |
| Imágenes de producto | `sharp` (resize + conversión a WebP para la imagen principal de cada producto en Inventarios) |
| Código de barras | `bwip-js` (genera el Code128 de las etiquetas de producto en el servidor); lectura por cámara con `BarcodeDetector` nativo del navegador, con `html5-qrcode` vendorizado como respaldo |
| Tipo de cambio | API SIE de Banco de México (`BANXICO_TOKEN`, opcional) para productos de Inventarios en moneda extranjera |
| Contenedores | Docker + Docker Compose, imágenes multi-stage |

No se usa framework de frontend (React/Vite) para mantener la imagen ligera y sin paso de build; el resultado es una interfaz moderna, responsiva y accesible con JavaScript nativo.

## 📁 Estructura del proyecto

```
/app
  /backend
    server.js          # API Express (registro + carga de archivo + admin + login/tickets)
    db.js               # Pool de conexiones MySQL y creación del esquema
    utils/validate.js   # Sanitización y validaciones (RFC, email, teléfono, magic numbers)
    utils/auth.js        # Autenticación del panel de administración (Basic Auth): ADMIN_USERS + usuarios con perfil administrador/fiscal
    utils/authUsuario.js  # Login de usuario (RFC + contraseña): hash, sesión firmada, reglas de contraseña
    utils/config.js       # Configuración dinámica (campos obligatorios), persistida en MySQL
    utils/pdfExtract.js    # Valida que el PDF sea una constancia SAT y extrae nombre/razón social, régimen fiscal y código postal
    utils/usoCfdi.js       # Catálogo de Uso de CFDI: valores por defecto y sincronización con el SAT
    utils/email.js          # Configuración y envío de correo SMTP (pensado para Gmail)
    utils/ticketsCleanup.js  # Borrado automático de tickets según la retención configurada
    utils/storage.js        # Almacenamiento en MinIO (constancias/tickets/facturas), reemplaza el disco local
    utils/tenantContext.js  # Multi-tenant: resuelve el tenant a partir del encabezado X-Tenant-Slug
    utils/tenant.js          # Multi-tenant: reglas de slug (validación, nombre de BD)
    scripts/verificar-mysql.js         # Pruebas de regresión contra una instancia MySQL real
    docker-entrypoint.sh # Ajusta permisos del bind mount de uploads y baja privilegios
    package.json
    Dockerfile
  /frontend
    login.html / login.js / auth.css        # Iniciar sesión y crear cuenta (nueva página de entrada)
    dashboard.html / dashboard.js            # Tablero: accesos directos + lista de solicitudes
    tickets.html / tickets.js                # Subir foto de un ticket de venta
    portal.js / portal.css                   # Lógica y estilos compartidos entre dashboard, tickets, y la barra de sesión de csf.html
    csf.html                                  # Flujo de 3 pasos: Datos → Archivo → Confirmación (constancia fiscal; antes se llamaba index.html)
    style.css
    app.js
    admin.html            # Panel de administración (/admin)
    admin.css
    admin.js
    nginx.conf            # Sirve estáticos y reenvía /api al backend
    Dockerfile
  /uploads                # VESTIGIAL (ver PROJECT_STATE.md punto 92) — ya no se guarda nada aquí, el almacenamiento real vive en MinIO
  docker-compose.yml
  .env.example
  README.md
```

## ⚙️ Variables de entorno

Copia `.env.example` a `.env` y ajusta si lo necesitas:

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `FRONTEND_PORT` | Puerto del host donde se expone la app | `8088` |
| `MYSQL_ROOT_PASSWORD` | Contraseña de root de MySQL — **cámbiala en producción** | `changeme_root_password` |
| `MYSQL_DATABASE` | Nombre de la base de datos de la aplicación | `portal_facturacion` |
| `MYSQL_USER` | Usuario (no root) que usa el backend para conectarse | `app` |
| `MYSQL_PASSWORD` | Contraseña de ese usuario — **cámbiala en producción** | `changeme_app_password` |
| `MYSQL_PORT` | Puerto de MySQL expuesto en el host (para conectarte con un cliente externo) — publicado solo en `127.0.0.1`, no en toda la LAN/interfaz pública | `3306` |
| `MAX_FILE_SIZE_MB` | Tamaño máximo (MB) solo para archivos NO imagen (CSF PDF, comprobante de Gastos, factura ZIP, importador CSV/XLSX) — ya no gobierna imágenes (producto, foto de ticket, logo, favicon): eso se configura en vivo desde `/control` → Super Admins → "Ajustes de imágenes" (punto 370), no por variable de entorno. Dejó de declararse en `docker-compose*.yml`: agrégala tú ahí si necesitas cambiar este valor | `5` |
| `CORS_ORIGIN` | Origen permitido para CORS en el backend | `*` |
| `ADMIN_USERS` | Usuarios administradores, formato `usuario:contrasena,usuario2:contrasena2` — **cámbialo en producción** (el valor por defecto es público, da acceso a `/admin` y `/control`) | `admin:admin` |
| `USO_CFDI_SYNC_URL` | Origen desde donde se sincroniza el catálogo de Uso de CFDI | sin definir (requiere configurarse explícitamente) |
| `CLAVE_PROD_SERV_SYNC_URL` | Origen desde donde se sincroniza el catálogo "Clave de Producto o Servicio" del SAT | dump SQL real de `phpcfdi/resources-sat-catalogs` (Unlicense, verificado) |
| `SESSION_SECRET` | Clave para firmar las sesiones de usuario (login por RFC) | aleatoria al arrancar (fija esta para producción) |
| `COOKIE_SECURE` | Pon `true` **solo** si el sitio ya se sirve por HTTPS real (ver despliegue a producción) | `false` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Credenciales de MinIO (almacenamiento de archivos) — **cámbialas en producción** | `minioadmin` / `changeme_minio_password` |
| `MINIO_BUCKET` | Bucket compartido donde se guardan constancias/tickets/facturas (se crea solo si no existe) | `portal-facturacion` |
| `MINIO_CONSOLE_PORT` | Puerto del host para la consola web de administración de MinIO — publicado solo en `127.0.0.1`, no en toda la LAN/interfaz pública | `9001` |
| `BANXICO_TOKEN` | Token gratuito de la API SIE de Banco de México (para el tipo de cambio automático USD/MXN de productos de Inventarios en moneda extranjera — ver "Vista Inventarios") | sin definir (sin él, el tipo de cambio se captura a mano, sin bloquear nada) |

El backend se conecta a MySQL usando `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` — en `docker-compose.yml` ya están configuradas automáticamente a partir de las variables `MYSQL_*` de arriba (`DB_HOST` apunta al servicio `mysql` dentro de la red interna de Docker), así que normalmente no necesitas tocarlas directamente.

## 🚀 Despliegue local

**Requisitos:** Docker y Docker Compose instalados.

1. Clona el repositorio:
   ```bash
   git clone https://github.com/addv-prototipos/ADDVportalFact.git
   cd app
   ```
2. Copia el archivo de variables de entorno:
   ```bash
   cp .env.example .env
   ```
3. Levanta los contenedores:
   ```bash
   docker-compose up --build
   ```
   La primera vez, `docker-compose` levanta MySQL, espera a que su *healthcheck* pase (puede tardar unos segundos mientras MySQL inicializa la base de datos), y solo entonces arranca el backend — que además espera activamente a poder conectarse antes de aceptar tráfico, con varios reintentos con espera. No deberías ver errores de conexión durante el arranque normal.
4. Abre el navegador en:
    ```
    http://localhost:8088
    ```
    (`FRONTEND_PORT=8088` por defecto en `.env.example`/`.env`; `http://localhost` solo si lo cambias a `80`).

Los archivos subidos (constancias, tickets, facturas) se guardan en **MinIO** (bucket `MINIO_BUCKET`, volumen Docker `minio_data`) — puedes inspeccionarlos desde la consola web de MinIO en `http://localhost:9001` (o el `MINIO_CONSOLE_PORT` que hayas configurado) con las credenciales `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` de tu `.env`. La carpeta `./uploads` del proyecto ya no se usa para guardar nada (vestigial, ver PROJECT_STATE.md punto 92). La base de datos MySQL vive en el volumen Docker con nombre `mysql_data` — no es un archivo que puedas copiar directamente como con SQLite, pero puedes inspeccionarla con cualquier cliente MySQL apuntando a `localhost:3306` (o el `MYSQL_PORT` que hayas configurado) con el usuario/contraseña de tu `.env`. Tanto MinIO como la base de datos persisten entre reinicios y reconstrucciones (`docker-compose up --build`).

## 🛡️ Confiabilidad (una sola instancia, sin balanceo de carga)

Estas son mejoras específicas para que la aplicación se mantenga disponible de forma consistente en un despliegue de una sola instancia — no sustituyen tener varias instancias con balanceo de carga (eso queda fuera de este alcance a propósito), pero reducen significativamente los cortes intermitentes de un solo servidor.

- **Health check real**: `GET /api/health` ya no solo confirma "el proceso está corriendo" — hace un `SELECT 1` real contra MySQL (con timeout de 2 segundos) antes de responder. Un health check superficial le daría a Docker un falso positivo si el pool de conexiones está agotado o MySQL no responde; con esto, el contenedor se reporta como no saludable en esos casos, en vez de aparentar estar bien mientras las peticiones reales fallan.
- **Apagado ordenado (*graceful shutdown*)**: al recibir `SIGTERM` o `SIGINT` (lo que Docker manda al detener o reiniciar un contenedor), el backend deja de aceptar peticiones nuevas de inmediato, espera (hasta 10 segundos) a que las que ya estaban en curso terminen normalmente, cierra el pool de MySQL de forma limpia, y solo entonces termina el proceso — en vez de cortar de golpe cualquier petición en curso en ese momento.
- **Red de seguridad ante errores inesperados**: `uncaughtException` y `unhandledRejection` quedan capturados a nivel global, con un log claro de qué pasó, antes de cerrar el proceso de forma controlada (dejando que `restart: unless-stopped` levante una instancia nueva y limpia) — en vez de que Node se caiga en silencio o con un mensaje ambiguo.
- **`depends_on` con espera real**: el contenedor de `frontend` ahora espera a que el `backend` pase su *healthcheck* (`condition: service_healthy`), no solo a que el contenedor arranque — antes, nginx podía empezar a recibir tráfico antes de que el backend hubiera terminado de preparar el esquema de la base de datos.
- **Límites de memoria por contenedor** (`mem_limit` en `docker-compose.yml`): sin límites, un pico de memoria en cualquiera de los tres servicios puede dejar sin RAM al host completo, y el OOM killer del sistema operativo puede terminar matando el proceso equivocado — con límites, ese contenedor en particular es el que se reinicia, de forma contenida y predecible. El del backend se subió de 512m a **768m**: `exceljs` y `pdf-parse` (agregadas después de que ese límite se fijó por primera vez) pueden tener picos de memoria notables con archivos grandes o reportes con muchos registros — un límite demasiado justo causaría el mismo tipo de reinicio intermitente que este límite busca evitar, no provocarlo.
- **El arranque del backend ya no se detiene por la limpieza automática ni por el correo del reporte**: antes, `ejecutarLimpiezaAutomatica()` (que puede disparar el envío de un correo con el reporte mensual, ver "Configuración Reportes") corría ANTES de que el servidor empezara a aceptar peticiones — esto significaba que **cada** arranque o reinicio del backend (no solo el primero: cualquier reinicio por un despliegue, o porque el límite de memoria lo tumbó) se quedaba sin atender tráfico durante todo ese tiempo, y un SMTP lento o sin respuesta podía tardar minutos en agotar su propio tiempo de espera. Ahora la limpieza se dispara en segundo plano justo después de que el servidor ya está escuchando — si el correo falla o se cuelga, ya no se lleva de encuentro la disponibilidad del resto de la app.
- **Tiempos de espera explícitos en el envío de correo** (`connectionTimeout`/`greetingTimeout`/`socketTimeout` en el transportador SMTP): sin esto, nodemailer usa sus valores por defecto (varios minutos en total) — con un host SMTP que no responde, un envío se quedaría colgado mucho más tiempo del razonable antes de fallar.
- **Conexiones a MySQL con keepalive** (`enableKeepAlive`, `connectTimeout` en el pool): una conexión inactiva por un rato puede quedar "muerta" sin que el driver se entere hasta que se intenta usarla — esa consulta fallaría sin relación aparente con nada. El keepalive de TCP detecta esto antes de que un usuario real la use.
- **`stop_grace_period: 15s`** en el backend: le da tiempo suficiente al apagado ordenado de arriba antes de que Docker mande `SIGKILL` de todas formas.
- **Conexiones reutilizables entre nginx y el backend** (`upstream` con `keepalive` en `nginx.conf`): evita abrir una conexión TCP nueva en cada petición a `/api/`. Es una optimización de una sola instancia — no es balanceo de carga (eso implicaría varios `server` dentro del `upstream`, y queda fuera de este cambio a propósito, para cuando se agregue una segunda instancia).
- **Página de mantenimiento cuando el backend no responde** (`mantenimiento.html`, servida por `nginx.conf`): si nginx no logra conectar con el backend, o el backend se tarda demasiado en responder (502/504 — el contenedor reiniciándose, por ejemplo), en vez de un error crudo de nginx o del navegador, se muestra una página propia con una ilustración, el mensaje "En breve volveremos", y una verificación automática en segundo plano que recarga la página sola en cuanto el servicio vuelva a responder — sin que la persona tenga que estar refrescando a mano. Las páginas estáticas (`login.html`, `admin.html`, etc.) las sirve nginx directamente desde su propio sistema de archivos, así que siguen cargando con normalidad incluso con el backend caído — la página de mantenimiento aparece específicamente cuando una petición a la API falla, no como una pantalla que reemplaza todo el sitio a la fuerza. Ver la sección "Página de mantenimiento" más abajo para el detalle completo.
- **Límite de solicitudes del panel corregido — causa real de "el sistema deja de responder" e intentos repetidos de `docker compose up -d --build`**: el mismo límite de intentos de login (50 solicitudes / 15 minutos, pensado para frenar fuerza bruta contra la contraseña) se aplicaba también a los otros 45 endpoints del panel — es decir, a cada clic normal de una sesión YA autenticada. Solo cargar el panel al iniciar sesión ya dispara 6 peticiones en paralelo, y navegar una vez por las vistas principales agrega otras 12 — con eso, 50 solicitudes se agotan en apenas 2-3 recargas de página, devolviendo `429 Too Many Requests` para el resto de esa ventana de 15 minutos. Reconstruir el contenedor "arregla" esto de forma temporal porque reinicia el contador en memoria — no porque el contenedor de verdad se hubiera caído (el healthcheck de Docker usa `/api/health`, que nunca tuvo ningún límite). Por eso aumentar la memoria del contenedor no lo resolvía: nunca fue un problema de recursos. Se separó en dos límites — `adminLoginLimiter` (50/15 min, solo en el intento de login) y `adminApiLimiter` (2000/15 min, en los otros 57 endpoints, ya protegidos por sesión válida).
- **`trust proxy` corregido de `true` a `1`**: hallazgo adicional al revisar esto a fondo, no la causa del problema anterior, pero sí una brecha de seguridad real. `true` le dice a Express que confíe en TODA la cadena de proxies sin límite, lo que —según la propia advertencia de `express-rate-limit`— le permite a cualquiera mandar su propio encabezado `X-Forwarded-For` falso para hacerse pasar por otra IP y evadir los límites de intentos por IP (incluyendo el de fuerza bruta del login). Con `1`, Express confía exactamente en un salto — el contenedor de nginx, el único proxy real que existe delante del backend en este `docker-compose.yml` — y ya no en cualquier valor que un cliente decida mandar.

### Página de mantenimiento

Cuando el backend no responde (se está reiniciando, tumbó por el límite de memoria, etc.), las peticiones a `/api/` reciben una página propia (`mantenimiento.html`) en vez de un error crudo:

- **Diseño**: ilustración en SVG (dibujada a mano en el propio archivo, sin depender de ninguna imagen externa) de un robot con una llave de tuercas, arreglando un rack de servidor — con una animación sutil de la llave moviéndose y unas chispas parpadeando, que se desactiva sola si el sistema tiene `prefers-reduced-motion` activado. Encabezado **"En breve volveremos"**, un texto tranquilizador explicando que no hay nada que la persona tenga que hacer, y la misma paleta de colores y tipografías que ya usa el resto de la app, para que no se sienta como una pantalla de error genérica ajena al sitio.
- **Verificación automática**: un script sin dependencias consulta `/api/health` cada pocos segundos (empezando en 2s, con el intervalo creciendo hasta un tope de 20s en cada intento fallido, para no bombardear un servicio que ya está teniendo problemas) y **recarga la página sola** en cuanto vuelve a responder — además de un botón "Reintentar ahora" para quien no quiera esperar al siguiente intento automático.
- **Cómo se activa** (`nginx.conf`, dentro de `location /api/`): `proxy_intercept_errors on;` junto con `error_page 502 503 504 =503 /mantenimiento.html;` — los 502/504 los genera el propio nginx cuando no logra conectar con el backend o se tarda demasiado; `proxy_intercept_errors` además intercepta un 503 explícito que el backend mismo llegara a devolver, en vez de dejarlo pasar tal cual. El código de estado real (503) se conserva en la respuesta, así que una petición hecha con `fetch()` desde el resto de la app todavía puede detectar que algo salió mal por el status, aunque el cuerpo ya no sea el JSON que esperaba.
- **Alcance real, sin exagerar lo que hace**: esta página cubre específicamente las peticiones a la API que fallan por el backend — las páginas HTML/CSS/JS en sí las sirve nginx directamente (no dependen del backend para cargar), así que alguien que visite el sitio de cero durante una caída del backend sigue viendo la página normal (login, por ejemplo), y son las llamadas a la API dentro de esa página las que mostrarían el problema.

## 🔒 Validaciones y seguridad implementadas

- **Un solo archivo activo por contribuyente, identificado por RFC**: el RFC es el identificador único del contribuyente, así que es el primer criterio para detectar si ya existe un registro. Si el RFC no se capturó (sigue siendo un campo configurable, ver sección de administración), se usa el correo electrónico como respaldo — igual que en versiones anteriores, para mantener la retrocompatibilidad. Si ya existe un registro, la interfaz consulta los datos previos (nombre, tipo de persona, RFC, nombre del documento y fecha de última actualización) y los muestra en un modal **antes** de pedir confirmación para reemplazarlos. El archivo anterior se elimina del disco solo tras confirmar. *Nota técnica: el RFC no tiene una restricción `UNIQUE` a nivel de base de datos — la unicidad se aplica en el código de la aplicación, para poder convivir con el borrado lógico (un RFC "liberado" en la papelera no bloquea una nueva captura).*
- **Tamaño máximo configurable** vía `MAX_FILE_SIZE_MB`, validado tanto en el navegador como en el backend (Multer `limits.fileSize`).
- **Tipos de archivo permitidos**: solo PDF. Se valida la extensión, el `Content-Type` declarado **y** la firma binaria real del archivo (*magic numbers*: `%PDF`) para evitar que un archivo malicioso se disfrace con una extensión falsa.
- **Validación de contenido (que sea una constancia real del SAT)**: además de que el archivo sea un PDF válido, el backend extrae su texto y verifica que contenga frases que solo aparecen en una Cédula de Identificación Fiscal / Constancia de Situación Fiscal genuina (p. ej. "Cédula de Identificación Fiscal", "Servicio de Administración Tributaria"). Si no las encuentra, rechaza el archivo con un mensaje claro. *Nota: esta validación es sobre el texto extraíble del PDF; no analiza logotipos ni hace OCR de PDFs escaneados como imagen — si el PDF no tiene una capa de texto (por ejemplo, es una foto/escaneo sin texto seleccionable), también se rechaza, ya que no hay texto que verificar.*
- **Extracción automática de nombre/razón social, régimen fiscal y código postal**: al mismo tiempo que se valida el contenido, se extrae del texto del PDF:
  - El **nombre, denominación o razón social**: la Cédula del SAT suele extraerse con el valor real ubicado *entre* las etiquetas "Registro Federal de Contribuyentes" y "Nombre, Denominación o Razón Social" (el orden del texto extraído del PDF no siempre coincide con el orden visual del documento). La regla es la **misma para persona física y persona moral** — no hay dos rutas de código distintas: se toma todo el bloque de texto entre esas dos etiquetas (sin importar cuál aparece primero), se descarta ruido conocido línea por línea (el identificador interno "IdCIF", el propio RFC si quedó repetido ahí, líneas de puros dígitos, y encabezados/leyendas fijos del SAT como "Constancia de Situación Fiscal" o "Valida tu información fiscal"), y lo que sobrevive se une en una sola cadena **sin saltos de línea**. Si alguna de las dos etiquetas no aparece, hay respaldos: buscar hacia atrás desde la etiqueta del nombre sin el RFC como ancla, buscar justo después de la etiqueta del nombre, o (**solo si el documento es de persona física**, confirmado por la presencia real de la etiqueta "Primer Apellido" — no solo por buscar "Nombre" de forma aislada) unir "Nombre (s)" + "Primer Apellido" + "Segundo Apellido". Si el documento no sigue ninguno de estos formatos, el campo queda vacío (se muestra "—" en el panel de administración) — **esto nunca bloquea la carga**, ya que es de mejor esfuerzo, igual que régimen fiscal y código postal.

    > 🛠️ **Historial de correcciones a esta lógica** (útil si vuelve a fallar con un documento distinto):
    > 1. El respaldo de "Nombre + Apellidos" es exclusivo de persona física, pero antes se activaba para cualquier documento en cuanto las demás estrategias fallaban — en una constancia de **persona moral**, eso podía enganchar con un campo no relacionado (ej. "Nombre Comercial") y devolver el valor equivocado. Ahora exige encontrar realmente la etiqueta "Primer Apellido" antes de activarse.
    > 2. El título del documento y encabezados fijos del SAT ("Constancia de Situación Fiscal", "Lugar y Fecha de Emisión") no estaban en la lista de texto a ignorar, así que se colaban como si fueran el nombre; y los caracteres permitidos en un nombre no incluían `+` (algunas razones sociales sí lo usan), así que un nombre real con ese símbolo se descartaba por completo.
    > 3. La lógica se simplificó a la regla descrita arriba (todo lo que hay entre las dos etiquetas, unido sin saltos de línea, igual para ambos tipos de persona) — las versiones anteriores intentaban adivinar línea por línea qué "se veía como" un nombre válido, lo cual seguía fallando con documentos reales; ahora se filtra explícitamente por lo que se sabe que es ruido, no por una lista cerrada de qué caracteres son válidos.
  - El **código postal** del domicilio fiscal (con una expresión regular que reconoce variantes como "Código Postal:", "C.P." o "CP" seguidas de 5 dígitos).
  - El/los **régimen(es) fiscal(es)** vigentes, comparando contra el catálogo oficial del SAT (que incluye los de persona física y persona moral, ya que no se sabe de antemano cuál aplica).

  Los tres valores quedan disponibles en el panel de administración sin necesidad de abrir el documento, y el nombre/razón social sigue siendo un hipervínculo hacia la vista previa del archivo (ver sección de administración).

- **Validación: el RFC de la constancia debe ser el mismo RFC de la cuenta** — a diferencia de nombre/régimen/código postal (que son de mejor esfuerzo y nunca bloquean la carga), esta validación **sí puede rechazar la subida**, porque la relación entre un contribuyente y su constancia es 1 a 1: no debería poder subirse la constancia de una persona distinta a la propia cuenta. El backend extrae el RFC real impreso en el documento (con `extraerRFC()`, buscando el patrón `AAAA######AAA` cerca de la etiqueta "Registro Federal de Contribuyentes") y lo compara contra un **RFC de referencia**:
  - Si hay sesión activa (cliente logueado subiendo desde `csf.html`), la referencia es el **RFC de la sesión** — tiene prioridad, y coincide de todas formas con el campo del formulario, que queda bloqueado a ese mismo RFC en ese caso.
  - Si no hay sesión (acceso público/anónimo), la referencia es el **RFC capturado en el formulario**, si se dio uno.
  - Si el RFC de la constancia y el de referencia **no coinciden**, se rechaza la carga con un error explicando ambos valores, para que quede claro por qué.
  - Si **cualquiera de los dos** no se pudo determinar (no hay RFC de referencia porque el acceso es público sin RFC en el formulario, o no se pudo leer el RFC del PDF), **no se bloquea** — no hay nada con qué comparar, así que se deja pasar igual que antes de este cambio.
- **Sanitización de inputs**: todos los campos de texto se recortan, se les elimina cualquier etiqueta HTML/script y se escapan antes de guardarse.
- **Nombres de archivo aleatorios**: se generan con `crypto.randomUUID()` para evitar colisiones y ataques de *path traversal*.
- **Codificación UTF-8 en nombres de archivo**: se corrige un problema conocido de `multer`/`busboy`, que decodifican el nombre original del archivo como `latin1` en vez de `UTF-8` (causando que "COTIZACIÓN" se guarde como "COTIZACIÃN"). El servidor reinterpreta esos bytes correctamente antes de guardarlos, y las descargas desde el panel de administración usan el header `Content-Disposition` con `filename*=UTF-8''...` para que los acentos se muestren bien también al descargar. *Nota: esto corrige los archivos que se suban a partir de ahora; los que ya se guardaron con el nombre corrupto deben volver a subirse (usando el flujo de "reemplazar") para corregir su nombre.*
- **Consultas parametrizadas**: todas las consultas a MySQL usan parámetros (`?`) en vez de concatenar texto, así que no son vulnerables a inyección SQL.
- **Permisos en el bind mount de uploads**: el contenedor backend arranca como `root` únicamente para ajustar el dueño de `./uploads` a un usuario sin privilegios (`docker-entrypoint.sh`), y luego cede el control a ese usuario antes de ejecutar la aplicación (vía `su-exec`). Node.js nunca corre como `root`.
- **Retrocompatibilidad**: esta restricción a solo PDF (con validación de contenido) aplica desde una versión anterior. Si tu base de datos ya tenía archivos JPG/PNG subidos, siguen intactos, visibles y descargables desde el panel de administración — simplemente no tendrán régimen fiscal ni código postal extraídos (se muestra "—"), y no se puede volver a subir un JPG/PNG para reemplazarlos; hay que subir el PDF correspondiente. **El nombre/razón social que el usuario ya había capturado a mano en registros anteriores se conserva tal cual** — no se sobreescribe retroactivamente. Lo mismo aplica al **Uso de CFDI** y a las **indicaciones de facturación** de la constancia: se quitaron del formulario público, y sus columnas también se quitaron de la tabla y del selector de columnas del panel de administración — pero los valores que ya existían en registros anteriores no se borran ni se tocan al reemplazar un archivo, solo dejan de mostrarse en cualquier parte de la app (si algún día hace falta consultarlos, siguen ahí en la base de datos). Puedes verificar que el esquema de MySQL y todas las funciones de la aplicación se comporten correctamente con:
  ```bash
  docker-compose up -d mysql
  cd backend && npm install
  DB_HOST=localhost DB_USER=app DB_PASSWORD=<tu_contraseña> DB_NAME=portal_facturacion \
    node scripts/verificar-mysql.js
  ```
- **`index.html` se renombró a `csf.html`** (Constancia de Situación Fiscal). El `index` real de nginx nunca fue `index.html` — siempre fue `login.html` (así que `/` sigue funcionando exactamente igual, sin ningún cambio). Lo que sí cambió: los enlaces de `dashboard.html` y `tickets.html` que apuntaban a `index.html` ahora apuntan a `csf.html`; se agregó la ruta amigable `/csf` (igual que `/dashboard`, `/tickets`, `/login`, `/admin`); y si alguien tiene un enlace o marcador viejo a `/index.html`, nginx lo redirige automáticamente (301) a `/csf.html` en vez de devolver 404.
- **Retrocompatibilidad de la factura**: la restricción a solo `.zip` para la factura de un ticket (con validación de contenido real) aplica desde una versión reciente. Si ya tenías facturas subidas en otro formato (PDF, JPG o PNG, que era lo que se aceptaba antes), siguen intactas, visibles y descargables desde el tablero del cliente y el panel de administración — solo no se puede volver a subir un archivo que no sea `.zip` para reemplazarlas.
  Este script prueba primero (sin necesitar la base de datos) la extracción de nombre/razón social del PDF para persona física y persona moral con la misma regla unificada (todo el texto entre "Registro Federal de Contribuyentes" y "Nombre, Denominación o Razón Social", sin importar el orden, unido sin saltos de línea) — 14 casos en total, incluyendo los tres bugs reales reportados y corregidos en el camino (un campo "Nombre" suelto confundido con la razón social, el título del documento colándose como nombre, y un nombre real con "+" siendo rechazado), la extracción del RFC real de la constancia y la validación cruzada contra el RFC de sesión/formulario (confirma que `extraerRFC()` encuentra el RFC de ambos tipos de persona y lo normaliza a mayúsculas, que la carga se bloquea solo cuando ambos RFC están disponibles y no coinciden, que nunca se bloquea si falta uno de los dos, y que la sesión tiene prioridad sobre el campo del formulario, probado con un token de sesión real) — y luego crea el esquema si no existe (y confirma que hacerlo dos veces no falla), prueba inserciones/consultas/actualizaciones reales, valida que las restricciones `UNIQUE` (correo, RFC de usuario) y `CHECK` (tipo de persona, estatus de ticket, tipo de pago de ticket, perfil de usuario) se respeten, prueba el flujo completo de borrado lógico → restaurar → borrado físico de constancias, el flujo de un ticket con su Uso de CFDI, tipo de pago y comentarios (creación → en curso → factura subida → listo) y que los tickets queden aislados por RFC, el hash/verificación de contraseñas, el flujo completo de "forzar cambio de contraseña" (activarlo al restablecer → confirmar que sigue activo → apagarlo al cambiar la contraseña), que guardar la configuración SMTP conserve la contraseña cuando no se manda una nueva y nunca la exponga de vuelta (restaurando cualquier configuración real que ya existiera, sin dejar credenciales de prueba encima), que la plantilla del **cuerpo** del correo al cliente (con `{folio}`/`{rfc}`) traiga un valor por defecto sin personalizar y que `aplicarPlantilla()` sustituya ambas variables correctamente usando el valor ya guardado en MySQL (el asunto de ese correo ya no es configurable, así que no depende de nada guardado en la base de datos), el borrado automático de tickets (crea un ticket con fecha manipulada a 100 días atrás y confirma que `limpiarTicketsVencidos()` lo elimina sin tocar uno reciente, restaurando la retención real configurada al terminar), y la lista de "tickets pendientes por notificar" (confirma que un ticket pendiente aparece cuando el correo de quien va a facturar global no está configurado, y que la lista sale vacía en cuanto se configura), los perfiles de usuario (crea cuentas "administrador" y "fiscal", confirma que el filtro por perfil no mezcla cuentas, y reproduce exactamente la consulta que usa `requireAdminAuth()` para confirmar que un administrador/fiscal se autentica correctamente y que un "cliente" **no puede**, aunque la contraseña sea correcta, porque la consulta lo excluye a nivel SQL), y la verificación de "constancia existente" que usa el aviso emergente de `tickets.html` (confirma que un RFC con constancia activa reporta `existe=true`, uno sin ninguna reporta `existe=false`, y que una constancia con borrado lógico ya no cuenta como existente), y que **`POST /api/tickets` de verdad rechaza la subida de un ticket para un RFC sin constancia activa** (la regla que originalmente solo existía como aviso en la interfaz, sin aplicarse en el servidor), y el flujo completo de borrado lógico → papelera → restaurar → borrado físico de tickets (reutilizando un ticket con historial completo — Uso de CFDI, tipo de pago, comentarios y factura ya subida — para confirmar que el borrado funciona incluso con datos previos, y que un segundo intento de eliminar un ticket ya eliminado no tiene efecto), y el flujo de crear una cuenta con correo (confirmando que se guarda correctamente, mismo dato que usa la invitación al portal) y eliminarla (incluyendo el candado que evita que un administrador se elimine a sí mismo mientras tiene la sesión iniciada con esa cuenta), y el enlace de la invitación según el perfil (confirma que "cliente" enlaza al portal público `/login` y que "administrador"/"fiscal" enlazan al panel `/admin`, en varios contextos de despliegue: localhost con puerto, IP de red local, dominio real con HTTPS), y el mismo enlace en el aviso de "nuevo ticket para facturar" que recibe el contador (apunta a `/admin`, con el mismo mecanismo de auto-detección), que "tipo_pago" y "comentarios" (tickets) ahora también se pueden marcar como obligatorios/opcionales igual que "uso_cfdi" (confirma que se guardan, se leen, y se pueden volver a apagar), la validación de esos dos campos en `POST /api/tickets` (rechaza con el error correcto cuando falta uno marcado obligatorio, pasa cuando sí se captura, y un "tipo_pago" fuera del catálogo se rechaza sin importar la configuración), y **el bug reportado de que el login fallaba con "RFC o contraseña incorrectos" para cuentas administrador/fiscal recién creadas con contraseña autogenerada** (reproduce el bug exacto contra MySQL real con un usuario de más de 13 caracteres — antes fallaba con el límite viejo de truncamiento, ahora funciona con el límite corregido de 50 caracteres —, y confirma que una cuenta cliente normal con RFC real nunca se vio afectada), y la validación de contenido real para la factura de un ticket (`esZipValido()`: acepta las tres firmas binarias válidas de un ZIP, rechaza un PDF real aunque se le cambie la extensión a `.zip`, rechaza una imagen y texto plano, y no lanza error con un buffer corto, vacío o `null`), y que el ZIP realmente traiga un PDF y un XML adentro (`zipContienePdfYXml()`: construye ZIPs mínimos directamente en JavaScript —sin depender de ninguna herramienta externa— para probar un ZIP con ambos archivos, solo con uno de los dos, con un archivo extra que no debería afectar el resultado, con los archivos dentro de una carpeta, uno realmente vacío, uno con solo un archivo no relacionado, y uno con extensiones en mayúsculas) — limpiando todos sus datos de prueba al final; la configuración global de IVA y zona horaria (`setConfiguracionGlobal()`/`getConfiguracionGlobal()`: guarda y relee ambos valores, rechaza un IVA fuera de 0-100 y una zona horaria fuera del catálogo de México, confirma que el catálogo tiene al menos 10 entradas con id y etiqueta, que `formatearFechaHoraMexico()` da la fecha en `dd/mmm/aaaa` y la hora en `HH:mm:ss`, restaurando la configuración real al terminar); y el flujo completo de una venta (con un registro/constancia de prueba dedicado: confirma que su correo aparece en el desplegable **junto con su RFC y nombre/razón social correctos** (para el bloque de solo lectura que se muestra al seleccionarlo), que el total calculado con 16% de IVA sobre $1000 da $1160, que la orden se guarda y se puede volver a consultar, que el IVA queda guardado como una "foto" en la propia orden — de forma que un cambio posterior al IVA global **no** afecta retroactivamente órdenes ya creadas —, y que la base de datos rechaza una cantidad negativa o un IVA fuera de rango a nivel de `CHECK`), limpiando su registro y orden de prueba al terminar; y que el registro público (`POST /api/auth/registro`) ahora guarda el correo en la misma columna `usuarios.email` que usa el alta desde el panel de administración, con una cuenta creada por ese camino quedando igual con perfil "cliente" por defecto; y editar un usuario (`PUT /api/admin/usuarios/:id`): confirma que correo y teléfono se actualizan correctamente, que intentar reutilizar el RFC de otra cuenta existente se detecta, y la protección de auto-degradación de perfil (un administrador no puede bajar su propio perfil a "cliente" mientras tiene la sesión iniciada con esa cuenta, pero sí puede hacerlo con otras cuentas, y editar sus propios datos sin tocar el perfil no se bloquea); el "No. Venta" de cada orden (`generarNumeroCompra()`: confirma el formato `OC-000001` con relleno de ceros, que se guarda correctamente tras el patrón insertar→generar→actualizar — igual que el folio de tickets —, y que la base de datos rechaza un "No. Venta" repetido a nivel `UNIQUE KEY`); y el campo `logo_url` parametrizado (confirma que existe con `null` por defecto, que se puede guardar una URL válida, y que un valor vacío lo vuelve a dejar en `null`, restaurando el valor real al terminar); y la verificación de compra al subir un ticket (crea una venta real de prueba y confirma: que los datos con formato correcto pasan la validación de formato y que cada uno de los tres formatos incorrectos —sin número, fecha o hora mal formateadas— se rechaza; que la orden se encuentra por su número de compra; que con los 4 datos exactamente correctos la verificación pasa; que con el total o la fecha incorrectos falla aunque el número de compra sí exista; y que un número de compra inexistente no encuentra ninguna orden), limpiando la orden de prueba al terminar; y el ícono de "ya facturado" junto con la prevención de doble facturación (crea una orden y un ticket vinculado a ella: confirma que sin ningún ticket "listo" la orden no aparece como facturada, que un ticket vinculado pero todavía "pendiente" tampoco la marca como facturada, que en cuanto ese ticket pasa a "listo" sí aparece como facturada — ahí es donde se muestra el ícono ✅ —, y que un segundo intento de ticket para esa misma orden se detectaría y rechazaría), limpiando el ticket y la orden de prueba al terminar; y reenviar el correo de una venta (confirma que la orden se encuentra por su id, que la fecha/hora se puede volver a formatear y que el número de compra/total se leen correctamente para reconstruir el correo, y que una orden con borrado lógico ya no se encuentra para reenviar), limpiando la orden de prueba al terminar; y que la MISMA retención automática también limpia ventas vencidas (`limpiarOrdenesVencidas()`, extendiendo el mismo bloque de prueba de retención que ya existía para tickets — crea una orden vieja y una reciente, confirma que solo se elimina la vencida), restaurando la retención real al terminar; y el interruptor "Habilitar Ventas" (`ordenes_compra_habilitado`: confirma que existe como booleano con `true` por defecto, que se puede apagar y volver a encender, y que el mismo comportamiento condicional de `POST /api/tickets` —aceptar un ticket sin ningún dato de compra cuando está apagado, seguir exigiendo el número de compra cuando está encendido— se cumple), restaurando el valor real al terminar; y los datos fiscales de la compañía (`rfc_compania`, `codigo_sat`, `link_codigos_sat`: confirma que un RFC/Código SAT/link válidos se guardan correctamente, que cada uno se rechaza con un formato inválido, y la lógica de "cuándo se muestra la información en la barra de sesión" —solo con RFC y Código SAT capturados juntos, nunca con uno solo o ninguno—), restaurando los tres valores reales al terminar; y "actualizado_por" en tickets (confirma que cambiar el estatus/notas guarda quién hizo el cambio, y que subir la factura TAMBIÉN lo actualiza — no se queda con el usuario del cambio anterior), y el filtro "Usuario" (confirma que el usuario que hizo el último cambio aparece en la lista de usuarios distintos que llenaría el desplegable del filtro, que filtrar por ese usuario encuentra el ticket de prueba, y que filtrar por un usuario que nunca ha modificado nada no regresa ningún resultado); y la renombrada Clave SAT junto con los datos que ahora se extraen de la constancia de la compañía (`clave_sat`: guarda un valor válido de 8 dígitos y rechaza uno inválido, y confirma que un valor guardado con el nombre VIEJO `codigo_sat` —de antes de este cambio— se sigue leyendo correctamente por compatibilidad hacia atrás; `regimen_fiscal_compania`: guarda el texto del régimen correctamente; `determinarTipoPersonaPorRegimen()`: confirma que el régimen 612 se clasifica como Persona Física y que el 601 se clasifica como Persona Moral, ambos casos ya probados también en aislamiento contra la función real, no simulados), restaurando los valores reales de los cuatro al terminar; y la regla adicional de Persona Física/Moral por razón social, pedida específicamente para desempatar regímenes ambiguos como RESICO (`determinarTipoPersonaPorNombre()`: un nombre propio de 2-5 palabras se clasifica como Física, una razón social con terminación legal como "S.A. DE C.V." o con palabra corporativa como "GRUPO" se clasifica como Moral, y una razón social vacía no concluye nada; `determinarTipoPersona()`, la función combinada: confirma que RESICO junto con un nombre propio se resuelve como Física, que RESICO junto con una razón social con terminación legal se resuelve como Moral, y que un régimen EXCLUSIVO de Moral como 601 siempre gana sobre la razón social, incluso si esta pareciera un nombre propio); y el nuevo campo `razon_social_compania` (confirma que `setConfiguracionGlobal()` lo guarda correctamente, con el mismo texto extraído por `extraerNombreRazonSocial()`, la función ya depurada que también usa la constancia de un cliente); y la señal por campos del documento, la de mayor prioridad de las tres (`determinarTipoPersonaPorCamposDocumento()`: confirma que "Primer Apellido"/"Segundo Apellido" en el texto se detecta como Persona Física, que "Régimen Capital" y "Nombre Comercial" se detectan como Persona Moral, y que sin ninguna de esas palabras clave no concluye nada; y en la función combinada, que esta señal gana SIEMPRE sobre las otras dos incluso cuando se contradicen — "Primer Apellido" en el documento gana sobre un régimen exclusivo de moral como 601, y "Nombre Comercial" en el documento gana sobre una razón social que parece un nombre propio); y el bug real reportado y corregido de que un extractor de PDF real concatena las etiquetas de una tabla sin espacio (confirma que "RegimenCapital" y "PrimerApellido", pegados sin ningún espacio tal como los extrae `pdf-parse` de una constancia real, se siguen detectando correctamente, y reproduce el caso real completo que reportó el bug — una constancia de persona moral con régimen RESICO y una razón social que contiene un "+" — confirmando que ahora se resuelve como Persona Moral en vez del resultado incorrecto original); y "otro" como quinta opción de tipo de pago (confirma que la restricción CHECK ya la acepta —incluyendo instalaciones existentes, donde la migración se corrigió para actualizar una restricción vieja en vez de dejarla intacta— y que guarda correctamente su especificación en `tipo_pago_otro`); y el `LEFT JOIN` con `ordenes_compra` que trae los datos capturados por el cliente para cotejar contra la foto del ticket (confirma que un ticket vinculado a una orden trae el No. Venta y el Total correctos, y que uno sin ninguna orden vinculada trae esos campos en `null`, que es lo que hace que la caja de comparación se oculte en el modal); y **Reportes** (`ejecutarLimpiezaConReporte()`: confirma que SÍ genera un reporte cuando hay tickets/órdenes vencidos, que el ticket y la orden quedan guardados correctamente tanto en el Markdown como en los datos estructurados de `reporte_items`, que el borrado real ocurre DESPUÉS de que el reporte ya quedó guardado, que `ON DELETE CASCADE` limpia automáticamente los items al borrar un reporte, y que sin nada vencido no se genera ningún reporte; además de `correo_reportes` guardándose y validándose correctamente, y `generarContenidoMD()`/`generarCSV()`/`generarExcelBuffer()` probadas con datos reales, incluyendo que el CSV trae el BOM de UTF-8 y que el Excel generado es un buffer no vacío; y que `reporte_items.rfc` —ensanchado de `VARCHAR(13)` a `VARCHAR(200)` tras un bug real donde un correo de venta, más largo que 13 caracteres, tumbaba el guardado del reporte con un error de MySQL— guarda el correo completo de prueba sin truncarlo; y `aFechaSegura()` —agregada tras un segundo bug real: el pool de MySQL de este proyecto usa `dateStrings: true`, así que una fecha llega como texto plano, no como objeto `Date`, y pasarla sin convertir a `Intl.DateTimeFormat` lanzaba una excepción— probada tanto en aislamiento (texto de MySQL, Date real, `null`, texto inválido) como de extremo a extremo generando un reporte completo con fechas exactamente como las devuelve MySQL de verdad); y eliminar un reporte (confirma que un `DELETE` sobre un reporte existente reporta `affectedRows = 1`, y que repetirlo sobre uno que ya no existe reporta `affectedRows = 0` — la misma lógica que usa el endpoint real para decidir cuándo responder 404); y `atendido_por` (quién atendió el ticket, columna nueva en `reporte_items`) — confirma que se guarda correctamente al generar un reporte, que aparece en el Markdown resultante, y que las funciones de exportación a CSV/Excel también la incluyen; y el filtro "Estatus" de "Lectura de reportes" (confirma que filtrar por "listo" encuentra el ticket de prueba, que sí tiene ese estatus, y que filtrar por "cancelado" no lo encuentra); y la lógica de restricción de acceso por perfil (confirma que "super" ve todas las vistas y tarjetas, que "administrador" y "fiscal" ven exactamente el subconjunto documentado —ni una vista ni una tarjeta de más o de menos—, y que la tabla de "Perfiles y roles de acceso" solo es visible para el perfil "administrador"); y la segunda capa de autorización del backend, probando las funciones REALES importadas de `auth.js` (no una reproducción) — `requireAdminArea()` confirma que "super" pasa cualquier área, que un perfil incluido en la lista de la ruta pasa, que uno NO incluido se rechaza con 403 (no 401), y que un área compartida entre dos perfiles deja pasar a ambos; y el caso especial de campo en `PUT /api/admin/config/global` confirma que un perfil "fiscal" no puede guardar `correo_reportes` pero sí el resto de los campos de esa misma ruta — la misma verificación se extendió para `ordenes_compra_habilitado` al moverse el interruptor "Habilitar Ventas" a la vista "Usuarios". *Nota: esta prueba no envía un correo real (no importa `enviarCorreo()`), solo valida que guardar/leer la configuración funcione — usa el botón "Enviar prueba" del panel de administración para confirmar el envío real.*
- **Rate limiting**: 30 solicitudes / 15 min por IP en el endpoint público de envío de tickets; 50 / 15 min en el intento de login del panel de administración (protección contra fuerza bruta); 2000 / 15 min en el resto de los 57 endpoints del panel, ya autenticados — ver "Límite de solicitudes del panel corregido" en Confiabilidad, más abajo, para la historia completa de por qué este último número es tan distinto a los otros dos. En rutas con tenant, la clave de límite incluye `tenant + IP`, y los logins tienen además un límite agregado por tenant para reducir fuerza bruta distribuida.
- **Seguridad multi-tenant**: nginx limpia cualquier `X-Tenant-Slug` enviado por el cliente en la API sin prefijo (`/api/...`) y solo fija ese encabezado desde las rutas `/<slug>/api/...`; el backend aplica costo artificial al responder 404 de tenant para reducir enumeración por temporización.
- **Auditoría administrativa multi-tenant**: las mutaciones del panel (`POST`/`PUT`/`DELETE`) y `/api/admin/login` se registran en `control_tenants.admin_auditoria` con actor, mecanismo (`ADMIN_USERS` o perfil en BD), perfil, tenant, método, ruta, estatus e IP. La auditoría es fire-and-forget: si falla, no bloquea la petición real.
- **Cache de API desactivado**: todas las respuestas bajo `/api` envían `Cache-Control: no-store` como defensa adicional para despliegues futuros con proxies/CDN compartidos.
- **Cabeceras de seguridad** con `helmet` y contenedor backend ejecutado con un usuario sin privilegios.
- Mensajes de error claros y específicos devueltos al frontend (tamaño excedido, tipo no permitido, duplicado, campos inválidos).

## 🎨 Experiencia de usuario

### Tooltips personalizados

Toda la app usa un componente de tooltip propio (sin librerías externas) en vez del atributo `title` nativo del navegador — se ve con el estilo visual de la app (fondo oscuro, flechita, animación sutil de aparición), y a diferencia de un tooltip CSS puro, no queda recortado dentro de tablas con scroll horizontal (usa un poco de JavaScript para posicionarse fuera de esos contenedores). Se activa con el atributo `data-tooltip="..."` en cualquier elemento. Actualmente se usa en: el enlace "Ver vista previa" (Constancias), el ícono ✅ de "facturado" y la razón social al pasar el cursor sobre el correo (Ventas), el badge "Cambio pendiente" (Usuarios), y el botón de descargar factura (tablero del cliente).

### Esqueleto de carga

Mientras el panel admin, `/control` o el portal de cliente esperan la respuesta del servidor, en vez de una tabla en blanco o un número en `$0.00` se muestra un esqueleto animado (bloques grises con un brillo que se desliza, tipo Facebook/LinkedIn) con la misma forma que el contenido real — tablas, tarjetas de KPI, e incluso el shell completo (sidebar + KPIs) al recargar la página con una sesión ya guardada. Si la carga falla de verdad (sin conexión, error del servidor), el aviso aparece DENTRO del mismo bloque que falló, con un botón "Reintentar" — nunca un mensaje de pantalla completa. Un solo componente compartido (`frontend/skeleton.js` + estilos en `style.css`), reutilizado en las tres superficies del sitio; respeta `prefers-reduced-motion`.

### Cuenta e inicio de sesión

`login.html` es la nueva página de entrada del sitio (`/`), pensada para clientes: el "usuario" con el que se inicia sesión aquí es el **RFC** con el que se va a facturar. Las cuentas con perfil "Administrador"/"Fiscal" (creadas desde el panel, ver más abajo) entran por su propio acceso — `/admin`, con HTTP Basic Auth — no por aquí.

- **Iniciar sesión**: RFC + contraseña.
- **Crear cuenta**: pide **correo electrónico**, **teléfono** y el **RFC** con el que se va a facturar, más una contraseña. El correo es el mismo campo `usuarios.email` que también captura el administrador al crear una cuenta desde el panel (ver "Crear usuario" en la vista "Usuarios" del admin) — misma columna, misma validación de formato — así que ambos caminos para llegar a una cuenta de cliente dejan el dato en el mismo lugar. El registro público **siempre** exige un RFC real con el formato correcto.
- **Reglas de contraseña**: al menos 8 caracteres, al menos un número, al menos una minúscula y al menos una mayúscula. El formulario de registro muestra una lista con cada regla marcándose en vivo conforme se cumple.
- La sesión se guarda en una cookie firmada (HMAC, sin tabla de sesiones) que dura 12 horas.
- **Cambio de contraseña obligatorio**: si un administrador te restableció la contraseña marcando "Forzar cambio" (ver panel de administración), al iniciar sesión con esa contraseña temporal se muestra automáticamente una pantalla para crear una nueva antes de continuar — no se puede entrar al tablero mientras esto siga pendiente, ni "brincándoselo" navegando directo a `dashboard.html` o `tickets.html`. Una vez que guardas la nueva contraseña, ya no se te vuelve a pedir en el siguiente inicio de sesión.

> 🛠️ **Bug corregido**: el login (`POST /api/auth/login`) truncaba el campo de usuario a 13 caracteres — el máximo de un RFC real —, así que cualquier cuenta administrador/fiscal cuyo nombre de usuario fuera más largo que eso nunca podía iniciar sesión (el error mostrado era genérico, "RFC o contraseña incorrectos", sin importar que la contraseña fuera correcta). El límite ahora es de 50 caracteres, igual que el resto del sistema; el campo del formulario y su validación de formato también se ampliaron para aceptar nombres de usuario, no solo RFC. El registro público de clientes no se vio afectado — sigue exigiendo un RFC real, sin cambios.

### Tablero (`dashboard.html`)

Landing page después de iniciar sesión, con dos accesos directos en forma de tarjetas:

1. **Subir constancia de situación fiscal** — lleva al flujo existente de 3 pasos (Datos → Archivo → Confirmación), en el archivo `csf.html` (antes se llamaba `index.html` — ver nota de renombrado más abajo). Si llegas aquí con sesión iniciada, el campo RFC se precarga y se bloquea con el RFC de tu sesión — **solo puedes generar la constancia con el RFC con el que iniciaste sesión.** Si accedes a `csf.html` directamente sin sesión, el formulario sigue funcionando igual que antes (público, sin RFC bloqueado), por retrocompatibilidad. Con sesión activa, el encabezado muestra la **misma barra de sesión que `tickets.html`**: botón "← Volver al tablero", tu RFC, y "Cerrar sesión" — mismo componente compartido (`portal.css`/`portal.js`), no una versión aparte; sin sesión, esa barra no aparece. También se puede acceder por la ruta amigable `/csf` (sin `.html`), igual que `/dashboard`, `/tickets`, `/login` y `/admin`.
2. **Subir tickets de venta** — lleva a `tickets.html`. **Si "Ventas" está habilitada** (interruptor en "Configuraciones globales" → "Configuraciones fiscales", activado por defecto), primero se **verifica la compra**: **No. Venta**, **Total (MXN)** (con comas de separador de miles mientras se escribe), **Fecha** y **Hora**, los cuatro obligatorios, capturados tal como llegaron en el correo de confirmación de la venta (mismos formatos que usa "Ventas" del lado del administrador — `OC-000001`, `dd/mmm/aaaa`, `HH:mm:ss`). El backend busca una venta real que coincida en los cuatro datos antes de aceptar el ticket; si no la encuentra, rechaza con **"No se encuentra registrada la venta para facturar."** (mismo mensaje sin importar cuál de los cuatro datos esté mal, a propósito, para no dar pistas). Los dos campos relacionados (No. Venta + Total, Fecha + Hora) se muestran lado a lado en una cuadrícula de dos columnas en pantallas con suficiente ancho, colapsando a una sola columna en pantallas muy angostas. **Si está deshabilitada, toda esta sección desaparece del formulario** y el ticket se puede enviar sin estos cuatro campos — ni el frontend ni el backend los piden ni los validan en ese caso. Después viene la subida de la foto/imagen del ticket (JPG, PNG o WEBP) y, opcionalmente (u obligatoriamente, según la configuración del admin — ver "Campos obligatorios de los formularios" en la vista "Configuraciones globales"), el **Uso de CFDI**, el **tipo de pago** (dropdown con 5 opciones fijas: efectivo, transferencia, tarjeta de débito, tarjeta de crédito, u **"Otro"** — al elegir esta última, aparece un campo de texto obligatorio para especificar cuál, sin importar si "tipo de pago" en general está configurado como opcional) y **comentarios** libres — los tres (Uso de CFDI, tipo de pago, comentarios) se pueden marcar como obligatorios u opcionales de forma independiente. Al enviarlo, se genera un **folio** (formato `TK-000001`) para dar seguimiento o hacer una aclaración. La barra de sesión del encabezado ("Volver al tablero" + RFC + "Cerrar sesión") es el mismo componente que `csf.html` con sesión activa (ver el punto anterior).
   - **Bloqueo si falta la constancia**: al cargar la página, si el RFC de la sesión todavía no tiene una constancia de situación fiscal activa, aparece un modal que **no se puede cerrar sin navegar a otra página** (sin botón para "continuar de todas formas", sin cerrar tocando afuera) — las únicas salidas son "Subir constancia" (va a `csf.html`) o "Volver al tablero". Mientras el modal está abierto, el formulario de subir ticket queda deshabilitado. Esto **sí impide subir el ticket**, tanto en la interfaz como del lado del servidor: `POST /api/tickets` rechaza la petición con un error si el RFC no tiene una constancia activa, sin importar si la interfaz se saltó de alguna forma — el aviso en pantalla es una ayuda para que el cliente lo sepa antes de llenar el formulario, no la única barrera. Si por alguna razón el aviso no apareció al cargar la página (ej. una consulta que falló momentáneamente) y el servidor rechaza el envío al momento de subirlo, aparece el **mismo modal** en ese instante — nunca un simple mensaje de error que desaparece solo sin darle al cliente una acción concreta que tomar.

Debajo de las tarjetas, el tablero lista **todas tus solicitudes de tickets**, con su folio, el nombre del archivo, su estatus y la fecha de última actualización. El estatus puede ser uno de cuatro: **Pendiente**, **En curso**, **Cancelado** o **Listo** (con insignias de color). Cuando un ticket está en estatus **Listo**, aparece un botón de descarga para bajar la factura correspondiente.

**Regla de aislamiento por RFC**: un ticket siempre queda asociado al RFC de la sesión que lo subió — nunca se manda un RFC distinto en la petición, así que es imposible generar una solicitud a nombre de otro RFC. Cada usuario solo ve y puede descargar las facturas de sus propios tickets.

**Aclaraciones**: una burbuja flotante "Solicitar aclaraciones" (visible en tablero, tickets y csf)
abre un modal con el RFC de sesión prellenado + nombre + teléfono + detalle — el correo se manda AL
correo de contacto configurado del tenant (o del sitio base, donde el campo es opcional) y se espera
el resultado real del envío antes de confirmar al cliente (a diferencia del resto de correos de la
app, que son "fire-and-forget", aquí no hay ninguna fila de respaldo si el envío falla). Sin
persistencia en base de datos — el folio es un timestamp + el RFC.

**Extracción automática del Total del CFDI**: al subir la factura (ZIP con PDF+XML), si el ticket no
tiene una venta ligada con monto conocido (negocio "solo facturas", sin Ventas/Inventarios activos),
el sistema intenta leer el Total directo del XML del CFDI real; si la extracción falla, se pide
capturarlo a mano sin bloquear la subida. Un monto ya leído del XML nunca se deja pisar por una
captura manual, aunque se mande una.

### Constancia de situación fiscal

Flujo de 3 pasos con indicador de progreso:

1. **Datos** — tipo de persona, RFC (opcional u obligatorio según sesión) y correo, con validación en tiempo real. El nombre/razón social ya no se pide aquí: se lee automáticamente del PDF.
2. **Archivo** — zona de arrastrar y soltar o selección táctil, con barra de progreso de carga real.
3. **Confirmación** — mensaje de éxito y opción de registrar otro archivo.

Diseño mobile-first en todas las páginas, con foco visible para navegación por teclado, etiquetas asociadas a cada campo y contraste adecuado.

## 🌍 Despliegue a producción (VPS Ubuntu)

1. **Preparar el servidor**
   ```bash
   sudo apt update && sudo apt upgrade -y
   curl -fsSL https://get.docker.com | sudo sh
   sudo apt install -y docker-compose-plugin
   sudo usermod -aG docker $USER
   ```

2. **Clonar el proyecto y configurar variables**
   ```bash
   git clone https://github.com/addv-prototipos/ADDVportalFact.git
   cd app
   cp .env.example .env
   # Edita .env: define CORS_ORIGIN con tu dominio real, y cambia
   # MYSQL_ROOT_PASSWORD / MYSQL_PASSWORD por contraseñas robustas y únicas.
   # Si vas a seguir el paso 4 (Nginx del host + dominio real + HTTPS),
    # agrega también FRONTEND_PORT=8088 — el contenedor "frontend" escucha
    # en el puerto 80 del host por defecto en la imagen base, pero el mapeo
    # publicado es 8088 (ver .env.example) para evitar colisión con el Nginx
    # del host en producción — dejarlos a ambos en 80 sería un conflicto.
   ```

3. **Levantar en modo producción**
   ```bash
   docker compose up -d --build
   ```

4. **Configurar Nginx como reverse proxy del host** (frente al contenedor `frontend` — con `FRONTEND_PORT=8088` configurado en el paso 2, expone ese puerto en vez del 80 por defecto):
   ```nginx
   server {
       listen 80;
       server_name facturacion.midominio.com;

       location / {
            proxy_pass http://127.0.0.1:8088;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           client_max_body_size 20m;
       }
   }
   ```

   > ℹ️ Este paso agrega un segundo salto de proxy (cliente → este Nginx del host, donde termina el HTTPS → el Nginx dentro de Docker → backend). El `nginx.conf` del contenedor `frontend` ya está preparado para esta cadena: en vez de recalcular `X-Forwarded-Proto` con su propio `$scheme` (que sería "http", el esquema real de la conexión Nginx-del-host → contenedor), reenvía el valor que ya trae desde este Nginx del host. Así, el backend siempre sabe si el cliente original usó HTTP o HTTPS de verdad — lo usa, por ejemplo, para armar la URL correcta en el enlace del correo de invitación (ver "Crear usuario" más abajo). No hace falta ninguna configuración adicional de tu parte para que esto funcione.

5. **Habilitar HTTPS con Let's Encrypt**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d facturacion.midominio.com
   ```
   Certbot renueva automáticamente el certificado vía `systemd timer`.

6. **Respaldos y escalabilidad básica**
   - **Base de datos**: haz respaldos periódicos con `mysqldump` en vez de copiar archivos:
     ```bash
     docker compose exec mysql sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup-$(date +%F).sql
     ```
     Para restaurar un respaldo:
     ```bash
     docker compose exec -T mysql sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < backup-2026-01-01.sql
     ```
   - **Archivos**: la carpeta `./uploads` sigue siendo local; respáldala aparte con `tar czf uploads-$(date +%F).tar.gz uploads`.
   - Para más tráfico, incrementa réplicas del servicio `backend` y coloca un balanceador (por ejemplo, Nginx `upstream` con varias instancias) — MySQL, a diferencia de SQLite, sí soporta múltiples conexiones concurrentes de escritura de forma nativa, así que esto ya no requiere un cambio de motor de base de datos.
   - Considera mover `./uploads` a almacenamiento en red o un bucket compatible con S3 si se despliega en múltiples nodos, y usar un servicio MySQL administrado (Amazon RDS, Google Cloud SQL, etc.) en vez del contenedor incluido si la carga crece mucho.

## 🐘 MySQL en alta disponibilidad — Docker Swarm (segmento 8 de 9)

`docker compose up` (arriba) sigue siendo el flujo de un solo nodo, con un
solo MySQL — suficiente para desarrollo y para instalaciones pequeñas.
Para producción con tolerancia a la pérdida de un nodo, este proyecto
también incluye `docker-stack.yml`: la misma aplicación, pero con MySQL en
topología primario/réplica (replicación nativa por GTID) sobre un clúster
Docker Swarm de al menos 2 nodos. **No se ha desplegado nunca contra un
clúster Swarm real desde el entorno donde se construyó** (sin acceso a
Docker aquí) — antes de confiar esto en producción, sigue estos pasos
contra infraestructura real y confirma cada uno.

1. **Inicializar el clúster y etiquetar los nodos** (uno como primario de
   MySQL, otro como réplica — MySQL usa un volumen local por nodo, sin
   almacenamiento de red, así que estas etiquetas fijan en qué disco físico
   vive cada rol; ver el encabezado de `docker-stack.yml` para el porqué):
   ```bash
   docker swarm init                       # en el nodo manager
   docker swarm join --token ...           # en cada nodo worker (token que imprime "swarm init")
   docker node update --label-add mysql-role=primary <nodo-A>
   docker node update --label-add mysql-role=replica <nodo-B>
   ```

2. **Clonar el repositorio en cada nodo que corra un servicio de MySQL** —
   Swarm no distribuye archivos del host entre nodos: `mysql/conf/primary.cnf`
   y `mysql/conf/replica.cnf` deben existir en la misma ruta en cada nodo
   correspondiente (mismo `git clone`, misma rama).

3. **Construir y publicar las imágenes de `backend`/`frontend`** — a
   diferencia de `docker compose`, `docker stack deploy` no construye
   imágenes (`build:` no aplica en modo Swarm), necesitan existir ya
   construidas con los nombres que espera el stack (o los que definas en
   `BACKEND_IMAGE`/`FRONTEND_IMAGE`):
   ```bash
   docker build -t portalManager-backend:latest ./backend
   docker build -t portalManager-frontend:latest ./frontend
   # Si el clúster tiene más de un nodo, súbelas a un registry accesible
   # por todos (Docker Hub, GHCR, un registry privado) en vez de solo
   # construirlas localmente en el manager.
   ```

4. **Definir las variables de entorno del stack** — `docker stack deploy`
   no lee `.env` automáticamente como sí hace `docker compose`:
   ```bash
   set -a; source .env; set +a
   docker stack deploy -c docker-stack.yml facturacion
   ```

5. **Enganchar la réplica al primario** (una sola vez, después de que ambos
   contenedores de MySQL estén arriba y saludables):
   ```bash
   MYSQL_ROOT_PASSWORD=<la_de_tu_.env> \
   DB_HOST=<IP/host del nodo primario> \
   REPLICA_DB_HOST=<IP/host del nodo réplica> \
   MYSQL_REPLICATION_USER=repl MYSQL_REPLICATION_PASSWORD=<la_de_tu_.env> \
     node backend/scripts/configure-replica.js
   ```

6. **Verificar el estado de la replicación en cualquier momento** (seguro
   de correr periódicamente, incluso desde monitoreo externo — solo lee):
   ```bash
   MYSQL_ROOT_PASSWORD=<la_de_tu_.env> REPLICA_DB_HOST=<host de la réplica> \
     node backend/scripts/verify-replication.js
   ```

7. **Failover manual** (deliberadamente NO automático — ver el encabezado
   de `promote-replica.js` para el porqué): si el primario cae, promueve la
   réplica y sigue las instrucciones que imprime al final (actualizar
   `DB_HOST` del backend, evitar split-brain con el primario viejo,
   reconstruirlo después como réplica del nuevo primario):
   ```bash
   MYSQL_ROOT_PASSWORD=<la_de_tu_.env> REPLICA_DB_HOST=<host de la réplica> \
     node backend/scripts/promote-replica.js
   ```

## 👤 Panel de administración

Disponible en `http://localhost/admin` (o `https://tudominio.com/admin` en producción; usa el puerto que hayas configurado en `FRONTEND_PORT` si no es el `80` por defecto).

- **Acceso**: usuario y contraseña por HTTP Basic Auth. Por defecto `admin` / `admin` (ver "Administración de cuentas y contraseñas" más abajo para los dos mecanismos que aceptan credenciales — variable de entorno, o usuarios con perfil administrador/fiscal). Es un sistema **separado** del login de RFC + contraseña de los usuarios del portal (`login.html`) — un cliente no puede iniciar sesión en el panel, y un administrador no inicia sesión como cliente.
- El panel tiene un menú lateral agrupado por categorías plegables, en este orden (punto 365): **Inicio** (suelta, fuera de categoría) → **Ventas y gastos** (Ventas, Cuentas por cobrar, Gastos) → **Catálogo** (Inventarios, Proveedores) → **Finanzas** (Resumen financiero, Reportes) → **Facturación** (Tickets, Constancias) → **Administración** (Usuarios, Auditoría) → **Cuenta** (Mi Cuenta, Configuraciones globales). "Inicio" es la vista que se ve al iniciar sesión para los perfiles que la tienen disponible; el perfil `administrador` aterriza en "Resumen financiero" (ver abajo), su primera vista disponible. Un botón de libro en la barra de sesión (y otro fijo en el sidebar en escritorio; en móvil se reubica como primer tile del menú "Menú") abre el **Centro de conocimiento**, el manual del sistema integrado en la propia app (ver más abajo). Junto a la campana de notificaciones de la barra de sesión vive un atajo fijo **"Registrar venta"** (perfiles `administrador`/`ventas`/`super`, visible en cualquier vista — en móvil es un ícono junto a la campana, que ahí también se muestra) — abre el mismo modal que el de la vista Ventas, sin necesidad de entrar a esa vista primero.

### Vista "Inicio"

Resumen de tickets al estilo tablero de control: un saludo, cuatro tarjetas de estatísticas (**Solicitudes totales**, **En proceso** —pendiente + en curso—, **Completadas** —listo— y **Rechazadas** —cancelado—, cada una con su variación real contra el mes calendario anterior), una tabla de las **5 solicitudes más recientes** (con un botón **"Gestionar"** que abre el mismo panel de gestión que la vista Tickets, y un enlace **"Ver todas"** que salta directo a esa vista) y una gráfica de dona con el porcentaje real de tickets en cada estatus. Todo se calcula a partir de los mismos tickets que ya ves en la vista "Tickets" — no hay datos ni endpoint aparte. Visible para el perfil `super` y `fiscal` (el perfil `administrador` no la ve, porque tampoco ve la vista Tickets de la que se deriva).

### Vista "Constancias"

- **Qué muestra**: una tabla con todos los registros recibidos — nombre o razón social, tipo de persona, RFC, régimen fiscal, código postal, correo, nombre del archivo subido y fecha de última actualización — con un botón **"Ver archivo"** para abrir o descargar cada documento directamente. En pantallas angostas (celular), la tabla se convierte automáticamente en tarjetas apiladas en vez de requerir scroll horizontal.
- **Vista previa rápida**: el nombre/razón social de cada fila es un hipervínculo — al hacer clic, abre una ventana emergente con el PDF (o imagen, en registros antiguos) mostrado directamente, sin descargarlo. Útil para validar un dato puntual sin salir de la tabla. Dentro del popup también hay un botón para descargarlo si hace falta. Se cierra con la "✕", haciendo clic afuera, o con la tecla `Esc`.
- **Búsqueda**: un buscador filtra en tiempo real por nombre/razón social o por RFC, sin distinguir mayúsculas ni acentos (por ejemplo, "gonzalez" encuentra "González").
- **Columnas visibles**: el botón **"Columnas"** abre un menú con casillas para mostrar u ocultar cada columna de la tabla (Nombre, Tipo, RFC, Régimen fiscal, Código postal, Correo, Documento, Actualizado), útil para reducir el ancho de la tabla y trabajar en ventanas más pequeñas. La preferencia se guarda en el navegador (`localStorage`) y se recuerda la próxima vez que abras el panel. El menú se posiciona dinámicamente para quedar siempre dentro de la pantalla, incluso en celular.
- **Columnas redimensionables**: en pantallas de escritorio, cada encabezado de columna tiene un borde arrastrable (pasa el mouse sobre el límite derecho del encabezado — el cursor cambia a ↔). Esto permite ajustar el ancho para que el contenido largo (nombres de archivo, régimen fiscal) no se desborde encima de la columna vecina. El ancho ajustado se guarda en el navegador y se recuerda la próxima vez. En celular la tabla se muestra como tarjetas apiladas (ver arriba), donde este ajuste no aplica.
- **Fecha de actualización**: se muestra en formato `DD/MM/AAAA HH:MM AM/PM` (por ejemplo, `12/07/2026 03:45 PM`), en la hora local de tu navegador.
- **Eliminar registros (borrado lógico y físico)**: el toggle **"Activos" / "Papelera"** arriba de la tabla cambia entre las dos vistas.
  - En **Activos**, cada fila tiene un botón **"Eliminar"** que hace un *borrado lógico*: el registro se marca como eliminado y desaparece de la vista de activos, pero el archivo y la fila en la base de datos **no se tocan** — se puede deshacer.
  - En **Papelera**, cada fila tiene **"Restaurar"** (deshace el borrado lógico, sin necesidad de confirmación por no ser destructivo) y **"Eliminar permanentemente"** (*borrado físico*: pide confirmación explícita, y luego borra el archivo del disco y la fila de la base de datos de forma irreversible).
  - Mientras un registro está en la papelera, su RFC y correo quedan libres para una nueva captura en el formulario público (el sistema lo detecta y "revive" el registro con los datos nuevos, en vez de bloquear el envío).

### Vista "Tickets"

Arriba de la tabla hay una sección plegable **"Borrado automático de tickets y ventas"**: define después de cuántos días se elimina automáticamente un ticket (imagen, factura si ya la tiene, y su registro) — **con el mismo número de días, también una venta** (solo su registro; a diferencia de un ticket, no tiene archivos en disco que limpiar). Se aplica a ambos sin importar su estatus. En `0` (o vacío) el borrado automático queda desactivado para los dos. Muestra por separado cuándo corrió la última limpieza de tickets y de ventas, y cuántos eliminó cada una, para que quede claro que sí está funcionando. La limpieza corre automáticamente cada hora dentro del propio backend (una vez al arrancar, y luego cada hora — no depende de un cron externo). Mientras esté activado, el tablero del cliente (`dashboard.html`) y la página de subir ticket (`tickets.html`) muestran un aviso indicando cuántos días tienen antes de que su ticket se elimine.

Debajo, un toggle **"Activos" / "Papelera"** (idéntico al de la vista Constancias) cambia entre los tickets activos y los que están en la papelera. La tabla lista **todos** los tickets de **todos** los usuarios (a diferencia del tablero del usuario, que solo muestra los propios), con folio, RFC, Uso de CFDI, nombre del archivo, estatus, **asignado a**, **notas** y fecha, con dos filtros desplegables — **por estatus** y **por usuario** — que se pueden combinar entre sí y con el toggle de papelera.

- **Columna "Asignado a"** (junto a "Estatus"): el nombre de quien hizo el último cambio, para poder identificarlo de un vistazo al escanear la tabla y, sobre todo, para poder **filtrar** por él con el desplegable "Todos los usuarios" de la barra de herramientas — se llena solo con cuentas que de verdad han modificado algún ticket (no con la lista completa de administradores), para no mostrar opciones que nunca regresarían resultados.
- **Columna "Notas"**: solo muestra un ícono (📝) cuando el ticket tiene algo capturado en sus notas internas — al hacer clic, abre el mismo panel que el botón "Gestionar" (ver abajo), donde ya se puede leer y copiar el texto completo, en vez de duplicar esa interfaz en una ventana aparte.
- **Columna "Actualizado"**: además de la fecha, muestra en una segunda línea **quién hizo el último cambio** ("por [usuario]") — el mismo dato que "Asignado a", repetido aquí a propósito, **por temas de auditoría** (que quede junto a la fecha exacta del cambio, como un registro de cuándo y quién, en vez de solo quién). El valor se guarda automáticamente cada vez que se cambia el estatus, las notas, o se sube una factura.

En la vista "Activos", cada fila tiene un botón **"Gestionar"** que abre un panel con:

- **RFC, Uso de CFDI, tipo de pago, última actualización por y nombre del archivo** en una cuadrícula de datos (etiqueta arriba, valor abajo, en vez de una sola línea corrida) para poder leerlos de un vistazo. Si el tipo de pago es "Otro", se muestra directamente lo que el cliente escribió (ej. "Vale de despensa"), no solo la palabra genérica "Otro". Si el cliente dejó comentarios al subir el ticket, aparecen en un recuadro destacado (borde de color, ícono y etiqueta en mayúsculas) — pensado a propósito para que no se pierdan entre el resto de la información; solo se muestra si el ticket tiene algún comentario.
- **Venta capturada por el cliente**, justo arriba de la foto del ticket: muestra No. Venta, Fecha, Hora y Total — los mismos datos que el cliente capturó en "Verifica tu venta" al subir el ticket — para poder **cotejarlos visualmente contra la foto real** sin tener que ir a buscar la venta por separado. Solo aparece si el ticket quedó vinculado a una venta real (con "Ventas" habilitada al momento de subirlo); si no, la caja no se muestra.
- **La imagen del ticket**, con **efecto lupa**: al pasar el cursor por encima, la imagen se amplía siguiendo la posición del mouse, para poder leer los detalles de un ticket fotografiado en baja calidad sin salir del panel. También hay un botón **"Descargar imagen"** para bajarla y verla a tamaño completo (útil sobre todo en celular, donde no hay "cursor" para el efecto lupa).
- Un **selector de estatus** (Pendiente / En curso / Cancelado / Listo) y un campo de notas internas, con un botón **"Guardar cambios"**. La opción "Listo" aparece deshabilitada en el selector — no se puede elegir directamente, porque siempre debe ir acompañada del archivo real de la factura (ver el punto siguiente). Elegir "Cancelado" pide confirmación antes de guardar. **Cualquiera de estos cambios (guardar estatus/notas, o subir la factura) actualiza automáticamente "quién hizo el último cambio"**, con el usuario de la sesión actual — no hay forma de guardar un cambio sin que quede registrado quién lo hizo.
- Un selector de archivo para **subir la factura ya generada** — al subirla, el ticket se marca automáticamente como **"Listo"**, y a partir de ese momento el usuario puede descargarla desde su tablero. **Solo se acepta un archivo `.zip`**: un CFDI real siempre se entrega como el par PDF + XML juntos, y como un campo de subir archivo no permite adjuntar dos por separado, se piden comprimidos en un solo ZIP. Igual que con la constancia y los tickets, no basta con que el archivo termine en `.zip` — se verifica el contenido real (la firma binaria `PK`) antes de aceptarlo, así que renombrar otro archivo con esa extensión no lo hace pasar la validación. Además, **se revisa lo que hay dentro del ZIP**: se lee su directorio central (sin descomprimir nada, sin depender de ninguna librería externa de ZIP) para confirmar que traiga al menos un archivo `.pdf` y al menos un archivo `.xml` — si falta cualquiera de los dos, se rechaza con un mensaje que indica exactamente cuál falta.
- Si el ticket ya tiene una factura subida, el modal de gestión muestra una sección **"Factura actual"** con su nombre y un botón para **descargarla de nuevo** (útil para verificarla, o simplemente volver a tenerla a la mano) — y el campo/botón para subir un nuevo ZIP cambia automáticamente a **"Reemplazar factura"**, dejando claro que un nuevo archivo sustituye al anterior en caso de haberse equivocado, en vez de sumarse a él.

**Eliminar tickets (borrado lógico y físico)** funciona igual que en la vista Constancias:

- En "Activos", el botón **"Eliminar"** mueve el ticket a la papelera (borrado lógico) — no toca la imagen ni la factura en disco, se puede deshacer.
- En "Papelera", cada fila tiene **"Restaurar"** (lo regresa a "Activos" tal cual estaba) y **"Eliminar permanentemente"** (con confirmación, porque no se puede deshacer) — esta última sí borra la imagen y la factura (si ya la tenía) del servidor, además de la fila de la base de datos.
- Un ticket eliminado (lógicamente) deja de aparecer en el tablero del cliente y en la notificación de "tickets pendientes por notificar" del administrador, aunque siga en estatus "pendiente".

#### Notificaciones automáticas por correo

- **Al subir un ticket**: si el administrador configuró el **correo de quien va a facturar** (dentro de "Correo electrónico (SMTP)", en la vista "Configuraciones globales"), se le envía automáticamente un correo avisando que hay un ticket nuevo para facturar (folio, RFC del cliente, y un **enlace directo al panel de administración** — `/admin` — armado con el mismo mecanismo de auto-detección de URL que usa la invitación al crear un usuario: se detecta de la propia petición que subió el ticket, funciona igual en cualquier contexto de despliegue, y si no se pudo detectar el dominio, el correo se envía de todas formas sin esa línea). Como ese correo es un solo valor global (no uno por cliente), **todos** los tickets nuevos se notifican ahí. Si ese correo no está configurado, no se envía nada — en su lugar, los tickets pendientes aparecen en la **notificación emergente que ve el administrador al iniciar sesión** ("Tickets nuevos por facturar"), con folio, RFC y fecha, y un botón para saltar directo a la vista de Tickets filtrada por "Pendiente". Esa notificación se recalcula en vivo cada vez que el administrador entra (no es un aviso de "una sola vez"): mientras el correo de quien va a facturar siga sin configurarse, se le sigue avisando de los tickets pendientes.
- **Al subir la factura**: se envía un correo automático al **correo electrónico para recibir facturas** (el de la constancia asociada al RFC del ticket — este sí sigue siendo por cliente/RFC, es el mismo campo de siempre en el formulario público) avisando que la factura ya está lista para descargar desde el portal. El asunto siempre es el mensaje fijo **"Factura lista — Folio ..."** (no es configurable); el **cuerpo sí es personalizable** desde la tarjeta SMTP en "Configuraciones globales" ("Correo que recibe el cliente"), con `{folio}` y `{rfc}` disponibles como variables — si nunca se personaliza, se usa un texto por defecto que ya funciona sin configurar nada.
- Ambos envíos usan la configuración SMTP de "Configuraciones globales". Si el correo no se pudo enviar (SMTP no configurado, credenciales incorrectas, etc.), **nunca bloquea la acción principal** — el ticket o la factura se guardan de todas formas; el error solo se registra en los logs del backend.

### Vista "Resumen financiero"

Tablero financiero para el perfil `administrador` (visible también para `super`; el perfil `fiscal` no la ve ni tiene acceso a su API) — combina datos de "Ventas" y "Gastos" en un solo lugar, ya que hasta ahora el perfil `administrador` no tenía una vista de aterrizaje propia (quedaba redirigido directo a "Ventas" al iniciar sesión; ahora aterriza aquí).

- **Cuatro tarjetas del mes en curso**, cada una con su variación % contra el mes calendario anterior donde aplica:
  - **Total facturado**: suma de las ventas que ya tienen su factura subida (mismo criterio que el ✅ "ya facturado" de la tabla de Ventas — existe un ticket vinculado en estatus "listo").
  - **Total gastos**: suma de los gastos del mes (vista "Gastos", no incluye los que están en la papelera).
  - **Balance ventas vs gastos**: Total facturado − Total gastos. **No es un cálculo de IVA neto** — la tabla de gastos no guarda el desglose de IVA (solo si el monto ya lo incluye o no), así que no hay forma de calcular una cifra fiscal real con los datos actuales.
  - **Ventas sin facturar**: ventas del mes que todavía no tienen su factura subida (Ventas totales − Total facturado).
- **Gráfica "Ventas vs Facturado vs Gastos"**: barras por mes (Ventas, Facturado y Gastos, un color cada una), empezando en el mes en curso **hacia adelante** — nunca muestra meses pasados, y **omite cualquier mes sin ninguna venta ni gasto registrado** en vez de mostrarlo en $0, para no ensuciar la gráfica con meses de antes de que el negocio empezara a usar el sistema. Un mes con actividad en solo una de las dos tablas (por ejemplo, un gasto sin ninguna venta) sí aparece.
- **Tarjeta "Utilidad neta del mes (ventas totales vs gastos)"**: número grande (verde si la utilidad es positiva, rojo si es negativa) acompañado de una gráfica de dos columnas — "Ventas totales" como barra apilada (Subtotal sin IVA abajo + IVA cobrado arriba) junto a una barra sólida de "Gastos", ambas a la misma escala. A diferencia del KPI "Balance ventas vs gastos" (que solo cuenta ventas ya facturadas y resta sobre montos con IVA incluido), esta tarjeta cuenta **todas** las ventas del mes — facturadas o no — y compara el ingreso **neto de IVA** contra los gastos. El IVA mostrado es el **cobrado en ventas**, no una cifra fiscal de "IVA neto": los gastos no guardan el desglose de su propio IVA.
- Los datos se calculan agregados en SQL — nunca se manda al navegador una lista de ventas o gastos sueltos, solo los totales ya sumados.
- **Modo dashboard personalizable**: el botón **"Modo dashboard"** (encabezado de la vista) activa la edición del layout — cada tarjeta muestra un handle ⠿ para arrastrarla a otra posición y un handle ◢ en su esquina para redimensionar su ancho (de 1/4 de fila hasta fila completa). El layout se guarda **por usuario** en el servidor automáticamente (con confirmación visual "Layout guardado") y se restaura en cada ingreso; el botón **"Restablecer"** vuelve al layout original. Hay alternativa completa de teclado: con una tarjeta enfocada, ↑/↓ cambian su posición, ←/→ ajustan su ancho y Esc sale del modo. En pantallas angostas (<900px) se ignora el ancho personalizado (las tarjetas se apilan como siempre), pero el orden personalizado sí se respeta.

### Vista "Ventas"

Segmento para registrar una venta o servicio y generar su factura. Todos los campos son obligatorios:

- **No. Venta**: **se auto-genera al guardar**, con el formato `OC-000001` (mismo patrón que el folio de tickets, `TK-000001`) — es el identificador único de la orden, el que el cliente usa como referencia en el correo de confirmación (ver abajo) y el que aparece primero en la tabla de ventas registradas.
- **Fecha de venta**: **se auto-genera al guardar** — no la captura el administrador. Se toma la hora del servidor y se le da formato con la zona horaria configurada en "Configuraciones globales" (ver arriba), en formato `dd/mmm/aaaa` (ej. `24/jul/2026`) y `HH:mm:ss` en 24 horas (ej. `09:30:45`).
- **Concepto de venta o servicio**: texto libre, hasta 255 caracteres, con contador en vivo.
- **Cantidad**: en pesos mexicanos (MXN), debe ser un número mayor a cero.
- **IVA**: **no se captura** — se muestra de solo lectura, tomado directamente del porcentaje configurado en "Configuraciones globales". Al guardar la orden, se toma una "foto" de ese porcentaje junto con la orden — si el IVA global cambia después, las órdenes ya creadas **no cambian retroactivamente**.
- **Total**: se calcula como Cantidad + IVA (`cantidad × (1 + iva% / 100)`, redondeado a centavos), con una vista previa en vivo mientras se captura la cantidad, y una nota aclarando que **esta es la cantidad que se va a facturar**.
- **Correo electrónico**: un desplegable — no un campo de texto libre — que solo ofrece correos que ya tienen una constancia de situación fiscal subida (los mismos valores de `registros.email`). El backend revalida esto también del lado del servidor, por si acaso, aunque el desplegable ya solo ofrezca opciones válidas. **Al seleccionar un correo, aparecen debajo el RFC y el nombre/razón social asociados a ese correo, de solo lectura** (no se pueden editar) — es una medida de confirmación visual, para que el administrador verifique que son los datos correctos antes de registrar la orden.

El formulario y la lista de órdenes ya registradas (No. Venta, fecha, concepto, cantidad, IVA, total y correo) se muestran **lado a lado** en pantallas anchas — no hay que desplazarse hasta abajo para ver la lista después de llenar el formulario. El formulario queda fijo en su lugar (`sticky`) mientras se recorre una lista larga, para poder registrar varias órdenes seguidas sin tener que volver a subir. Por debajo de los 900px de ancho, se acomodan en una sola columna (formulario primero, ya que es la acción principal de la pantalla) — una tabla de 7 columnas no cabe razonablemente al lado del formulario en una pantalla angosta. Un botón **"Actualizar"** recarga la lista junto con el correo/IVA/zona horaria vigentes.

**"Registrar venta" es expandible/colapsable** — empieza abierto, pero se puede cerrar con un clic en su título (mismo componente ya usado en las tarjetas de "Configuraciones globales", con la flecha que rota). Es especialmente útil en celular, donde el formulario completo ocupa mucho espacio vertical antes de poder ver la lista de abajo. La preferencia (abierto/cerrado) se recuerda entre sesiones.

Al ensanchar columnas de la tabla (ver "Cabeceras ajustables" abajo), el conjunto **formulario + lista se mantiene contenido y centrado** dentro del panel — la tabla gana su propia barra de desplazamiento horizontal si hace falta, en vez de empujar toda la composición hacia la derecha.

**Ícono de "ya facturado"**: cuando una orden ya tiene su factura subida (el ticket vinculado a ella pasó a estatus "listo"), aparece un ✅ **a la izquierda** del No. Venta en la tabla, con un tooltip nativo del navegador ("Venta facturada") al pasar el mouse por encima. Una vez facturada, **no se puede volver a facturar la misma orden** — si un cliente intenta subir otro ticket para un No. Venta que ya tiene su factura, `POST /api/tickets` lo rechaza con el mensaje **"Esa venta ya fue facturada."**

**Tooltip de razón social en "Correo"**: al pasar el cursor sobre el correo de cada orden en la tabla, aparece un tooltip con la razón social/nombre asociado a ese correo (los mismos datos ya usados para el bloque de solo lectura del formulario) — útil para identificar de un vistazo a qué cliente corresponde cada fila sin tener que abrir el registro completo.

**Reenviar correo**: cada fila tiene un botón **"Reenviar correo"** que vuelve a mandar el mismo correo de confirmación (el "ticket") al correo asociado a esa orden — útil si el cliente lo perdió, no le llegó, o lo borró por accidente. A diferencia del envío original al crear la orden (que es "fire-and-forget"), este botón sí espera la respuesta y avisa con un toast si el envío tuvo éxito o falló, ya que reenviar el correo es la razón de ser de esta acción.

**Formato automático de dinero**: el campo **"Cantidad"** se auto-formatea mientras se escribe, agregando comas de separador de miles (ej. escribir `1000` se convierte en `1,000` al instante) — igual que el campo **"Total"** de la verificación de compra en `tickets.html` (ver más abajo). La posición del cursor se conserva correctamente incluso al editar un número por en medio (no solo al escribir al final), y el valor real que se guarda y se envía al servidor siempre se calcula despojando las comas — el formato con comas es puramente visual. La misma regla de comas de miles también se aplica a los montos que solo se **muestran** (no se escriben): la vista previa del total al registrar la orden, y la columna "Total" de la tabla de ventas registradas.

**Cabeceras ajustables**: la tabla de ventas registradas tiene el mismo botón **"Columnas"** (mostrar/ocultar cada una: No. Venta, Fecha, Concepto, Cantidad, IVA, Total, Correo) y las mismas **columnas redimensionables** (arrastrando el borde derecho de cada encabezado) que ya tiene "Registros recibidos" — ver la explicación completa en la vista "Constancias" más arriba. Ambas preferencias (qué columnas se muestran, y con qué ancho) se guardan por separado de las de la tabla de Constancias, así que ajustar una no afecta a la otra.

**Más espacio para las tablas**: el panel de administración se ensanchó de 1100px a 1400px de ancho máximo, en todas las vistas — así hay más espacio para ver columnas y botones de acción sin tener que recurrir a mucho scroll horizontal. La columna de acciones (los botones "Ver archivo", "Reenviar correo", etc.) se desplaza junto con el resto de la tabla al hacer scroll horizontal, igual que las demás columnas — no queda fija en su lugar.

**Descuento por porcentaje**: el modal "Registrar venta" acepta un descuento opcional (botones rápidos 0/5/10/15% o captura manual, mayor a 0% y menor a 100%), aplicado sobre el subtotal antes del IVA — la caja de desglose muestra Subtotal, Descuento, IVA y Total por separado.

**Estado de pago (Pagada / Pendiente de pago)**: toggle en el modal de registro — ver la vista "Cuentas por cobrar" arriba para el seguimiento completo de saldos pendientes.

**Método de pago + folio de conciliación (ver PROJECT_STATE.md punto 342)**: el modal "Registrar venta" pide el método de pago (Efectivo, Transferencia, Tarjeta de crédito o Tarjeta de débito) — con "Transferencia" se genera al instante un folio corto (ej. `CV0001`, prefijo de 2 letras configurable en "Configuraciones globales" → Ventas) para que el cajero se lo dé al cliente como "Concepto" al pagar; se reusa el mismo folio si el cajero cambia de método y vuelve a "Transferencia" sin cerrar el modal. El folio aparece en el ticket impreso, en el correo de confirmación, y en la columna "Pago" de la tabla de ventas (ícono por método + folio con botón de copiar, sin abrir el detalle de la venta). El método y el prefijo con los que abre el modal por defecto se ajustan en "Configuraciones globales" → Ventas (ver esa sección más abajo).

**Vista previa del ticket antes de imprimir**: al guardar con "imprimir", al abrir "Ver venta", o desde el ícono de la fila, se muestra un preview del ticket (mismo diseño que se imprime) antes de disparar la impresión real — evita imprimir por accidente.

**Corte del día**: botón del toolbar de Ventas (punto 364, acción destacada — "Registrar venta" se movió al atajo fijo del header, ver "Panel de administración" arriba) que genera un reporte de ventas de un rango de fechas libre (con chips de atajo Hoy/Ayer/Esta semana/Este mes/Mes anterior), consultable en pantalla o imprimible como ticket — el corte queda guardado y disponible después en la pestaña "Cortes" de "Lectura de reportes".

**Borrador local**: si se cierra el modal a medias, el progreso se guarda en el navegador (por tenant y usuario) y se ofrece restaurarlo la próxima vez que se abra "Registrar venta".

#### Correo de confirmación de la venta

Al registrar una orden, se le envía automáticamente al correo del cliente un mensaje con **diseño de ticket/recibo** (no un correo de texto plano): bordes punteados, montos en fuente monoespaciada, y el total destacado — pensado para que se identifique de un vistazo como un comprobante, igual que un ticket físico.

- Incluye todos los datos de la venta: No. Venta, **Fecha y Hora en renglones separados** (a propósito — coinciden exactamente con los campos "Fecha" y "Hora" que se piden por separado en el formulario de "Subir tickets de venta", para que el cliente pueda copiar cada valor directamente sin tener que separar una fecha y hora combinadas), concepto, cantidad, IVA y total (marcado como "TOTAL A FACTURAR").
- Un mensaje cordial explica los siguientes pasos: que con esos datos ya puede solicitar su factura, que **guarde el correo — con una foto o captura de pantalla** —, y que **además de estos datos, al solicitar la factura en el portal también se le pedirá la imagen de su ticket de venta** (el que sube en la vista "Tickets" del portal de cliente).
- Un botón de **"Iniciar sesión y solicitar mi factura"** enlaza directo al portal (`/login`), con la misma auto-detección de URL (protocolo + dominio, según el contexto de la petición) que ya usan la invitación al crear un usuario y el aviso de nuevo ticket al contador — funciona igual en desarrollo local, por IP de red local, o en producción con HTTPS.
- **Logo parametrizado**: por ahora, el correo usa un logo de texto simple generado en código ("ADDV") — no hay todavía una pantalla en el panel para subir/configurar un logo real, pero el campo (`logo_url` en la configuración global) y la lógica para usarlo ya existen, listos para cuando se agregue esa función.
- Como con cualquier otro correo de esta app, el envío es "fire-and-forget": si el SMTP no está configurado o el envío falla, la orden se guarda correctamente de todas formas — el error solo se registra en los logs del backend.
- Se manda tanto en HTML (el ticket) como en texto plano equivalente — buena práctica de entregabilidad y accesibilidad, por si el cliente de correo del destinatario no renderiza HTML.

### Vista "Cuentas por cobrar"

Entre "Ventas" y "Gastos" en el sidebar — visible para `administrador` + `super`. Una venta puede
registrarse como **"Pagada"** (default) o **"Pendiente de pago"** (con fecha de vencimiento y notas
opcionales) desde el mismo modal "Registrar venta"; esta vista concentra el seguimiento de lo pendiente.

- **4 KPIs** con ícono SVG tintado (mismo lenguaje visual que Resumen financiero): Por cobrar, Vencidas,
  Por vencer y Cobrado del mes.
- **Tarjeta "Cobranza del mes"** con dona real (Cobrado / Por cobrar, sin meta inventada) y **Aging
  Report** (antigüedad de saldos en 4 rangos).
- **Tabla** con Cliente/RFC (vía `JOIN` con la constancia), Total, Cobrado, Saldo, Vencimiento, Estado
  (badge solo texto `Pendiente`/`Vencida`/`Pagada`) y columna "Facturada".
- **Registrar cobro** (modal, monto `>0` y `<= saldo`, crea un abono que actualiza `monto_cobrado`; si
  el saldo llega a $0 la venta pasa a `pagada` automáticamente), **recordatorio por correo** real desde
  la propia fila (una venta vencida puede recordarse al cliente sin salir del panel), y exportación CSV.
- **Regla de negocio**: una venta con saldo pendiente **no se puede facturar** — `POST /api/tickets`
  rechaza (`codigo: PAGO_PENDIENTE`) la solicitud de factura ligada a una orden `pendiente`.
- Filtros combinables: cliente/correo, vencimiento; toggle Pendientes/Cobradas.

### Vista "Gastos"

Control administrativo de los gastos de la operación — **exclusivo del perfil "Administrador"** (el perfil Fiscal no ve el botón ni puede llamar a la API; el backend responde `403`). Es una herramienta de control financiero operativo, **no** un sistema contable.

- **Registro de un gasto** (modal de alta): fecha, concepto, proveedor (opcional), categoría, monto único, `iva_incluido` (sí/no), `tiene_factura` (sí/no), recurrente (sí/no) y notas. Cambiar un gasto a "sin factura" borra su comprobante del almacenamiento.
- **Categorías editables** desde el propio popup (botón "✏️ Categorías" junto al selector): renombrar en línea, agregar nuevas y eliminar/desactivar — 10 categorías de fábrica (renta, nómina, software, hosting, servicios, papelería, combustible, viáticos, publicidad, **otro**), ya no es una lista cerrada en código. Una categoría con gastos asociados solo se **desactiva** (deja de ofrecerse para altas nuevas, pero los gastos que ya la usan conservan su etiqueta; se puede reactivar); solo se borra de verdad si no tiene ningún gasto. "**Otro**" es la categoría protegida del sistema (respaldo de color en la gráfica de "Distribución de gastos" de Resumen financiero) y no se puede renombrar ni eliminar. Detalle en `PROJECT_STATE.md` punto 135.
- **KPIs del mes en curso** (4 tarjetas): total, total con factura, total sin factura y comparación "vs mes anterior" — el indicador se marca positivo cuando el gasto **baja** (un gasto menor es buena señal). En la vista de papelera no se muestran KPIs.
- **Filtros combinables**: rango de fechas (desde/hasta), categoría, con/sin factura, recurrente y búsqueda por concepto/proveedor; con paginación.
- **Tabla con columnas ocultables** (fecha, proveedor, categoría, factura, monto) — la elección persiste en `localStorage`. La columna Factura muestra un enlace al comprobante (PDF/ZIP) si está cargado, o el badge "Con factura"/"Sin factura".
- **Comprobante opcional** por gasto: PDF (factura) o ZIP (par PDF+XML de CFDI), máximo 5 MB — la verificación es por **firma binaria real** (un archivo renombrado se rechaza con 400 aunque la extensión sea válida). Se sube, descarga (con su nombre original) y quita desde el modal de detalle; vive en MinIO bajo la carpeta `comprobantes`.
- **Papelera**: borrado lógico (el gasto deja de contarse en KPIs/filtros pero no se pierde), con restaurar y eliminar permanente — el permanente pide confirmación y borra la fila **y** el archivo de comprobante.
- **Auditoría**: todas las rutas de gastos pasan por `requireAdminAuth` + `requireAdminArea('administrador')` y quedan registradas en `admin_auditoria` como el resto del panel.
- Detalle en `PROJECT_STATE.md` punto 109 y en `US.md` (US-066/US-067).

### Vista "Inventarios"

Módulo de catálogo y existencias — **exclusivo del perfil "Administrador"** (D7: el perfil Fiscal no tiene ningún acceso, ni siquiera de lectura), con un interruptor global (**"Inventario activo"**, en Configuraciones globales) que lo prende/apaga por completo, incluida su integración opcional con Ventas. Detalle completo, decisiones de diseño y toda la bitácora de implementación en `inventarios.md`.

- **Catálogo simple** (D1, sin variantes/lote/serie/caducidad): SKU, código de barras opcional, nombre, categoría (editable igual que Gastos), unidad de medida, tipo (`producto`/`servicio` — un servicio nunca genera existencia ni movimientos, D11), costo de referencia, precio, mínimos/máximo/punto de reorden, proveedor y notas. Papelera con restaurar/eliminar permanente (un producto con movimientos históricos nunca se borra físicamente).
- **Existencias derivadas del kardex** (D6): el saldo disponible nunca se edita a mano — sube o baja únicamente registrando una **entrada** (compra, devolución de cliente, inventario inicial, ajuste positivo) o una **salida** (venta, consumo interno, merma, ajuste negativo). El motor (`registrarMovimiento()`) es atómico y a prueba de concurrencia (bloqueo de fila + reintento), con idempotencia real vía `Idempotency-Key`.
- **Costeo promedio ponderado** (D5): cada entrada con costo recalcula sola el costo promedio del producto — nunca se edita directamente.
- **Moneda extranjera por producto** (§57): un producto puede marcarse en USD; sus entradas capturan el costo en dólares + tipo de cambio (precargado automáticamente del día vía la API SIE de Banco de México — ver `BANXICO_TOKEN` arriba, con captura manual como respaldo si no hay token o el servicio no responde) y el sistema calcula el costo en pesos que alimenta el costeo promedio. El historial de movimientos conserva el desglose completo (moneda, tipo de cambio, costo original) para siempre.
- **Integración opcional con Ventas** (D8): con "Inventario activo" encendido, "Registrar venta" permite vincular productos del catálogo — la venta descuenta existencia automáticamente (todo o nada si hay varias líneas), valida stock disponible y revierte con una devolución de cliente si la venta se cancela o falla a medio camino.
- **Importador masivo CSV/XLSX** (§34, D9): wizard de 6 pasos con auto-mapeo de columnas por sinónimos (reconoce exportaciones de sistemas como CONTPAQi/Aspel sin configuración manual), perfiles de mapeo guardables, upsert por SKU (no duplica stock al reimportar el mismo catálogo), y modo asíncrono para archivos grandes (>500 filas).
- **Ayuda contextual y diccionario de datos** (§56): ícono "?" en cada campo del formulario y del wizard de importación, con explicación en lenguaje simple, ejemplo válido y error común — sin salir de donde estás capturando.
- **Verificar integridad**: botón que recalcula cada existencia desde cero contra el libro de movimientos y reporta cualquier divergencia (nunca corrige sola — la corrección siempre es un ajuste explícito hecho por el administrador).
- **Código de barras por cámara**: al capturar en Ventas o dar de alta en Inventarios, un botón de escáner usa `BarcodeDetector` nativo del navegador (con `html5-qrcode` vendorizado como respaldo, nunca CDN) para leer el código de barras con la cámara del dispositivo — requiere contexto seguro (HTTPS o `localhost`; no funciona sobre HTTP plano en una IP de red local).
- **Imagen principal de producto**: foto opcional por producto (redimensionada y convertida a WebP en el servidor), con efecto lupa en la tabla de Inventarios y en las sugerencias de producto de Ventas; sin foto, se muestra un marcador de posición.
- **Generador de etiquetas de código de barras**: desde el menú "⋮" de un producto, imprime una etiqueta (código Code128 real generado en el servidor + nombre + precio) en formato térmica 40×30mm o carta (24 por hoja).
- **Fecha de expiración opcional** (por producto, no por lote — el esquema no tiene concepto de lotes): solo es un aviso — nunca bloquea una venta. La tarjeta "Por vencer" del tablero cuenta vencidos + próximos 30 días, con lista filtrable.
- **Switch "Solamente servicios"** (Configuraciones globales): restringe el catálogo a solo servicios cuando el negocio no vende productos físicos — dar de alta o reactivar un producto físico se rechaza también del lado del servidor mientras está encendido. Un servicio se cobra **por hora** o con **precio fijo (paquete de servicio)** — nunca genera existencia ni movimientos de almacén.
- **Estado del inventario** (dentro de "Lectura de reportes", ver esa vista más abajo): KPIs de salud del catálogo, top/bottom 5 por rotación, valor por categoría, capital inmovilizado y matriz de riesgo.

### Vista "Usuarios"

"Habilitar Ventas" e "Inventario activo" viven ahora dentro de "Configuraciones globales" (ver esa sección más abajo), no en esta vista. Lo único que esta vista trae aparte de la tabla de cuentas es el ícono **"Perfiles y roles de acceso"** junto al contador, que abre en una ventana emergente la tabla de referencia de qué puede ver cada perfil — visible para los perfiles `administrador` y `super` (ver "Tabla 'Perfiles y roles de acceso'" más abajo).

Lista todas las cuentas de la app — no solo clientes. Cada cuenta tiene un **perfil**, visible como insignia de color en la tabla:

| Perfil | Insignia | Para qué sirve |
|---|---|---|
| **Cliente** | gris | Entra al portal público (`login.html` → tablero → subir constancia/tickets). No puede entrar al panel de administración — la consulta que verifica las credenciales del panel excluye este perfil a nivel de SQL, no solo visualmente. |
| **Administrador** | verde | Puede entrar al panel de administración (`admin.html`) con su RFC/usuario y contraseña. Ve Resumen financiero (su vista de aterrizaje), Ventas, Gastos, Usuarios (incluyendo el interruptor de "Habilitar Ventas"), Reportes y Configuraciones globales (dentro de esta última, solo "Configuraciones fiscales" y "Configuración Reportes") — ver "Restricción de acceso por perfil" más abajo para el detalle completo. |
| **Fiscal** | naranja | También puede entrar al panel de administración, pero con un subconjunto de vistas distinto al de "Administrador": Constancias, Tickets y Configuraciones globales (dentro de esta última, solo "Configuraciones fiscales" y "Campos obligatorios de los formularios"). No ve "Usuarios" en absoluto, así que tampoco ve ni puede activar/desactivar "Ventas". |

Un filtro desplegable arriba de la tabla permite ver solo un perfil a la vez. La tabla tiene 5 columnas — RFC/usuario, Perfil, **Contacto** (correo y teléfono combinados en una sola celda, uno debajo del otro, con el teléfono en un tono más apagado ya que el correo es el dato de contacto principal), Registrado, y acciones — con la insignia **"Cambio pendiente"** junto al identificador si esa cuenta todavía tiene una contraseña temporal sin cambiar.

Cada fila muestra además una insignia **"Activo"**/**"Suspendido"** junto al identificador (siempre visible, no solo cuando algo está mal). Las cuatro acciones por fila (**Editar**, **Restablecer contraseña**, **Suspender/Reactivar**, **Eliminar**) se muestran como **íconos compactos con tooltip** en vez de botones de texto completo — antes, "Restablecer contraseña" por sí solo hacía la columna de acciones más ancha que cualquier otra de la tabla, dándole a toda la vista una sensación de estar desacomodada. El de Eliminar se distingue con un tono rojo desde antes de pasar el cursor, para que su naturaleza destructiva sea evidente de un vistazo.

**Suspender/activar una cuenta** (aplica a los 4 perfiles, en el sitio base y en cualquier tenant) la deja sin poder iniciar sesión sin borrar ningún dato ni su historial — a diferencia de "Eliminar", que es permanente. Nadie puede suspender su propia cuenta mientras tiene la sesión iniciada con ella (sí puede reactivarse a sí mismo). El corte de acceso es real, no solo cosmético: una cuenta administrador/fiscal/ventas se corta en la siguiente petición al panel; una cuenta cliente no puede volver a iniciar sesión y, si ya tenía una sesión abierta en el portal, se cierra sola la próxima vez que esa pestaña cargue una página (con un aviso explicando por qué). Una cuenta suspendida sigue contando contra la cuota de usuarios de panel del plan del tenant, si aplica.

#### Restricción de acceso por perfil

A partir de qué perfil inició sesión, el panel oculta botones de navegación y tarjetas enteras — no solo los deshabilita:

| | Constancias | Tickets | Resumen financiero | Ventas | Gastos | Usuarios | Reportes | Configuraciones globales |
|---|---|---|---|---|---|---|---|---|
| **Super** (cuentas de `ADMIN_USERS`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — todas las tarjetas |
| **Administrador** | — | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — solo "Configuraciones fiscales" y "Configuración Reportes" |
| **Fiscal** | ✓ | ✓ | — | — | — | — | — | ✓ — solo "Campos obligatorios" y "Configuraciones fiscales" |
| **Cliente** | — | — | — | — | — | — | — | — (sin acceso al panel en absoluto) |

- **"Super"** es un perfil nuevo, interno del panel (no aparece como opción de perfil al crear un usuario) — se le asigna automáticamente a cualquier cuenta de `ADMIN_USERS`, precisamente porque no es parte del sistema de perfiles granular (`administrador`/`fiscal`) que se creó después — restringirla de la misma forma habría roto el mecanismo original de acceso para cualquier despliegue que ya dependiera de ella. Tiene acceso total, sin ninguna restricción de vistas ni de tarjetas.
- **La tabla "Perfiles y roles de acceso"** (dentro de la vista "Usuarios", ver más abajo) es visible para los perfiles **`administrador`** y **`super`** (este último sin restricciones, así que no tendría sentido excluirlo).
- **Si la vista por defecto del panel (Constancias) no está permitida para el perfil que inició sesión** (ej. un "Administrador"), el panel navega automáticamente a la primera vista que sí tenga disponible, en vez de dejarlo viendo una pantalla a la que no debería tener acceso — para "Administrador" esa primera vista es "Resumen financiero".

> ✅ **Alcance real de esta restricción — actualizado**: la restricción de la interfaz (ocultar botones y tarjetas) va acompañada de una **segunda capa real en el backend** — cada uno de los endpoints de `/api/admin/*` (todos excepto el propio `GET /api/admin/login`, que es el chequeo de sesión en sí) exige, además de `requireAdminAuth` (¿la sesión es válida?), `requireAdminArea(...)` (¿el perfil de esa sesión tiene permiso sobre ESTA área en particular?). Un perfil "Administrador" o "Fiscal" que conociera la URL exacta de un endpoint fuera de su alcance ahora recibe un `403` real del servidor, no solo un botón oculto en la pantalla. Ver "Autorización por perfil en el backend" más abajo para el detalle completo, incluyendo el caso especial de `PUT /api/admin/config/global` (un mismo endpoint que guarda campos de dos tarjetas con permisos distintos).


#### Tabla "Perfiles y roles de acceso"

Dentro de la vista "Usuarios" — visible para los perfiles `administrador` y `super` (este último sin ninguna restricción, así que también puede consultarla). Es de solo lectura (no un formulario: los permisos están definidos en el código del panel, no se editan desde aquí), pensada para consultar de un vistazo qué puede ver cada perfil: una fila por perfil, una columna por área del panel, con un ✓ o un — indicando acceso — y, en la columna de "Configuraciones globales" (donde el acceso es parcial, no todo-o-nada), una nota más pequeña debajo del símbolo aclarando exactamente cuáles tarjetas. La fila "Super" no se muestra en esta tabla (pedido explícito — ese nivel de acceso vive en `ADMIN_USERS`, no aporta nada nuevo consultarlo aquí ya que no tiene restricciones que documentar).

#### Autorización por perfil en el backend (segunda capa, además de la interfaz)

Cada uno de los endpoints de `/api/admin/*` (todos excepto `GET /api/admin/login`, que es el chequeo de sesión en sí — no tendría sentido "autorizar" algo antes de saber quién es) pasa por dos verificaciones encadenadas, no solo una:

1. **`requireAdminAuth`** — ¿la sesión (Basic Auth) es válida? Determina también `req.adminUser` (el nombre de usuario real) y `req.adminPerfil` (`super` | `administrador` | `fiscal`).
2. **`requireAdminArea(...perfilesPermitidos)`** — dado ese perfil, ¿tiene permiso sobre el área específica de ESTE endpoint? `super` pasa siempre, sin importar qué área se le pida — el resto se compara contra la lista de perfiles permitidos de la ruta. Si no tiene permiso, responde **403** (no 401: la sesión ya es válida, lo que falta es autorización sobre esa área en particular).

**Áreas y qué endpoints caen en cada una** (mismo agrupamiento que ya usa la interfaz):

| Área | Perfiles permitidos (además de `super`, que siempre pasa) | Endpoints |
|---|---|---|
| Constancias | `fiscal` | `registros` (listar/eliminar/restaurar/eliminar permanente), `archivo/:id` |
| Tickets | `fiscal` | `tickets` (listar/estatus/eliminar/restaurar/eliminar permanente/factura/imagen), `tickets/pendientes-sin-contador`, `tickets/usuarios-actualizado-por`, `config/tickets-retencion` (el borrado automático vive dentro de la vista Tickets) |
| Resumen financiero | `administrador` | `resumen-financiero` (KPIs del mes + serie mensual, solo lectura), `preferencias-dashboard/:vista` (layout personalizado del "Modo dashboard": GET/PUT/DELETE por usuario) |
| Ventas | `administrador` | `ordenes-compra` (listar/crear/reenviar correo), `correos-registrados`, y el campo `ordenes_compra_habilitado` dentro de `PUT /api/admin/config/global` (ver el caso especial abajo) |
| Usuarios | `administrador` | `usuarios` (listar/crear/editar/eliminar/cambiar contraseña) |
| Reportes | `administrador` | `reportes` (enviar/listar/md/items/exportar/eliminar) |
| Configuraciones fiscales | `administrador`, `fiscal` | `config/global` (lectura y escritura, salvo `correo_reportes` — ver abajo), `config/constancia-compania`, `config/zonas-horarias` |
| Campos obligatorios | `fiscal` | `config/campos-obligatorios`, `catalogos/uso-cfdi` (lectura y "Actualizar catálogo SAT") |
| Configuración Reportes | `administrador` | el campo `correo_reportes` dentro de `PUT /api/admin/config/global` — ver el caso especial abajo |
| Correo electrónico (SMTP) | *(ninguno — solo `super`)* | `config/smtp` (lectura y escritura), `config/smtp/prueba` |

**Caso especial: `PUT /api/admin/config/global` guarda campos de tres controles distintos, con permisos distintos entre sí.** La mayoría de sus campos (`iva_porcentaje`, `zona_horaria`, `clave_sat`, `link_codigos_sat`) pertenecen a "Configuraciones fiscales" (`administrador` + `fiscal`), pero `correo_reportes` pertenece a "Configuración Reportes" (solo `administrador`) y `ordenes_compra_habilitado` (el interruptor "Habilitar Ventas", ahora en la vista "Usuarios" — ver más abajo) también es exclusivo de `administrador` — el mismo endpoint sirve a los tres porque todos usan el mismo objeto de configuración global. `requireAdminArea('administrador', 'fiscal')` cubre el caso común, y el propio handler agrega una verificación adicional, a nivel de campo, para cada uno de los otros dos: si el cuerpo de la petición incluye `correo_reportes` u `ordenes_compra_habilitado`, se exige además que el perfil sea `administrador` o `super` — un perfil `fiscal` puede seguir guardando el resto de los campos de esta misma ruta sin problema, pero no esos dos en particular.

#### Crear usuario

El botón **"+ Crear usuario"** abre un modal para dar de alta una cuenta directamente desde el panel — es la **única forma** de crear cuentas con perfil "Administrador" o "Fiscal" (no hay registro público para esos perfiles, a propósito: solo alguien que ya es administrador puede otorgar ese nivel de acceso). El formulario cambia según el perfil elegido:

- **Cliente**: pide RFC (validado con el mismo formato que en toda la app) y teléfono (obligatorio).
- **Administrador / Fiscal**: el campo se convierte en **"Nombre de usuario"** — no necesita ser un RFC real, solo un identificador único (letras, números, puntos, guiones y guiones bajos, mínimo 3 caracteres) con el que esa persona inicia sesión en el panel. El teléfono no se pide.

El **correo electrónico es obligatorio para cualquier perfil** — a diferencia del teléfono, que solo se pide para clientes. Al crear la cuenta, se le envía automáticamente una **invitación al portal** a ese correo, con su usuario (RFC o nombre de usuario), la contraseña temporal que se haya capturado, y un **enlace directo al lugar correcto según su perfil**:

- **Cliente** → enlaza al portal público (`/login`), donde inicia sesión con RFC + contraseña.
- **Administrador / Fiscal** → enlaza al **panel de administración** (`/admin`), donde inicia sesión con su usuario + contraseña por el formulario de acceso del panel — no tendría sentido mandarle a un fiscal el enlace del portal de clientes, ya que no es por ahí donde entra.

En ambos casos, la URL base (protocolo + dominio) se arma automáticamente a partir de la propia petición del administrador (con la que llegó al panel) — funciona igual en desarrollo local (`http://localhost`, o `http://localhost:8088` si cambiaste `FRONTEND_PORT`), accediendo por la IP de tu red local, o en un dominio real con HTTPS en producción, sin necesidad de configurar una URL fija en ningún lado. Si por alguna razón no se pudo detectar el dominio, el correo se envía de todas formas, solo que sin esa línea del enlace. El envío es "fire-and-forget": si el correo SMTP no está configurado (ver "Configuraciones globales") o el envío falla por cualquier motivo, **la cuenta se crea de todas formas** — el administrador puede darle las credenciales por otro medio; el error solo se registra en los logs del backend, nunca bloquea la creación de la cuenta.

En ambos casos hay que capturar una contraseña — con el mismo botón de **"Generar contraseña automática"** + copiar al portapapeles + casilla de "forzar cambio en el siguiente inicio de sesión" que ya existía para restablecer contraseñas (ver más abajo).

Restablecer contraseña sigue funcionando igual para cualquier perfil: botón **"Restablecer contraseña"** en cada fila, con:

- **"Generar contraseña automática"**: crea una contraseña aleatoria de 12 caracteres que siempre cumple las 4 reglas, evitando caracteres fácilmente confundibles al transcribirlos a mano (`0`/`O`, `1`/`l`/`I`). Al generarla, aparece un botón para **copiarla al portapapeles** junto al campo.
- El campo de contraseña también se puede llenar a mano, con el mismo checklist en vivo que el registro (8+ caracteres, número, minúscula, mayúscula).
- **"Forzar cambio de contraseña en el siguiente inicio de sesión"**: casilla que se marca automáticamente al generar una contraseña automática (por ser temporal por definición), pero se puede desmarcar si no hace falta. Para perfil "Cliente", si queda marcada, la próxima vez que inicie sesión se le pedirá crear una contraseña propia antes de poder usar el resto del sitio (ver "Cambio de contraseña obligatorio" más arriba). *Para "Administrador"/"Fiscal", esta casilla se guarda pero no tiene ningún efecto todavía — ese flujo de cambio obligatorio solo está implementado para el login del portal de cliente (cookie de sesión), no para el login del panel (HTTP Basic Auth); si un administrador olvida su contraseña, otro administrador se la restablece aquí normalmente.*

#### Editar usuario

Cada fila tiene un botón **"Editar"** que abre un modal con el perfil, RFC/nombre de usuario, correo y teléfono actuales, ya prellenados — mismos campos y mismas reglas de validación que "Crear usuario" (el campo cambia entre "RFC" y "Nombre de usuario" según el perfil elegido, igual que al crear). **La contraseña no se toca desde aquí** — para eso sigue existiendo el botón "Restablecer contraseña" por separado, para no mezclar dos flujos distintos en un mismo formulario.

Por seguridad, un administrador **no puede bajar su propio perfil a "Cliente"** mientras tiene la sesión iniciada con esa cuenta (el backend lo rechaza explícitamente) — perdería el acceso al panel a mitad de la sesión. Sí puede editar sus propios datos (correo, teléfono, RFC/usuario) sin cambiar el perfil, y sí puede cambiar el perfil de **otras** cuentas administrador/fiscal libremente.

#### Eliminar usuario

Cada fila tiene un botón **"Eliminar"** (con confirmación, ya que no se puede deshacer). A diferencia de constancias y tickets, **las cuentas de usuario no tienen papelera** — se eliminan de forma permanente de inmediato. La razón: no hay ningún archivo que preservar (a diferencia de una constancia o la imagen de un ticket), y si el administrador se equivoca, siempre puede volver a crear la cuenta. Importante: **eliminar una cuenta no afecta las constancias ni los tickets que esa persona ya haya subido** — esos se identifican por RFC, no por el id de la cuenta, así que quedan intactos aunque la cuenta se elimine.

Por seguridad, **un administrador no puede eliminar su propia cuenta** mientras tiene la sesión iniciada con ella (el backend lo rechaza explícitamente) — evita quedarte fuera del panel por accidente. Si necesitas eliminar tu propia cuenta, pídele a otro administrador que lo haga, o usa una cuenta de `ADMIN_USERS`.

### Vista "Configuraciones globales"

Agrupa, en un solo lugar, la configuración que no es específica de una tabla en particular (a diferencia de "Borrado automático de tickets y ventas", que sigue viviendo dentro de la vista "Tickets" por ser específica de ahí). Es un cambio puramente de organización visual — nada de esto cambió de comportamiento, solo de dónde vive en el panel.

**Layout tipo dashboard**: las 4 tarjetas ("Campos obligatorios de los formularios", "Configuraciones fiscales", "Correo electrónico (SMTP)" y "Configuración Reportes") se acomodan en una **cuadrícula uniforme de 2x2** en pantallas anchas — las 4 empiezan **colapsadas** por defecto (mismo alto de entrada, el de solo su encabezado), así que se ven parejas de inicio sin importar cuánto contenido tenga cada una una vez expandida; antes, "Correo electrónico" ocupaba el ancho completo en su propia fila y "Configuración Reportes" era la única que empezaba expandida, lo que desacomodaba visualmente el resto de la cuadrícula. Por debajo de los 760px de ancho, las 4 se acomodan en una sola columna apilada — a esa anchura, dos columnas dejarían muy poco espacio para las etiquetas más largas de los checkboxes (como "Uso de CFDI (al subir tickets)").

- **Campos obligatorios de los formularios**: la sección plegable **"Campos obligatorios de los formularios"** permite marcar cuáles campos son obligatorios, tanto al subir la constancia como al subir un ticket. Del formulario de constancia: **tipo de persona** y **RFC**. Del formulario de subir tickets: **Uso de CFDI**, **tipo de pago** y **comentarios** — los tres son exclusivos de tickets, ninguno aplica a la constancia (los checkboxes lo aclaran con la etiqueta "(al subir tickets)"). El correo electrónico y el archivo de la constancia siempre son obligatorios (no son configurables, ya que el correo identifica al registro y el archivo es el propósito del formulario). El nombre/razón social tampoco es configurable aquí: ya no lo captura el usuario, se extrae automáticamente al leer el PDF. Los cambios se guardan en la base de datos y se aplican de inmediato — **sin reiniciar el servidor** — tanto en la marca visual (`*` / `(opcional)`) como en la validación del backend. Esta validación aplica de forma consistente tanto al guardar la configuración (el backend rechaza valores que no sean verdadero/falso) como al recibir cada envío del formulario correspondiente (el backend siempre revalida en vivo, nunca confía solo en la validación del navegador).
- **Configuraciones fiscales**: sección plegable con los datos fiscales de la propia compañía, y los dos valores que usa "Ventas" cuando está activa (IVA y zona horaria). El interruptor que activa o desactiva "Ventas" en sí ya no vive aquí — se movió a la vista "Usuarios", ver más abajo.
  - **Subir constancia de situación fiscal** (de la compañía, no de un cliente): reutiliza la misma extracción de PDF que ya usa la constancia de un cliente — mismo validador de contenido real, misma detección de "¿esto es en verdad una constancia del SAT?". A diferencia de la constancia de un cliente (donde el RFC es "de mejor esfuerzo"), aquí **si no se pudo identificar el RFC, se rechaza** con un error claro, ya que ese es justo el dato que se busca.
    - **RFC**: se extrae del PDF y se guarda automáticamente — ya no se captura a mano (el campo manual "RFC Compañía" se quitó).
    - **Régimen fiscal**: se muestra en una caja de solo lectura, con todos los regímenes que traiga la constancia (un contribuyente puede tener más de uno activo a la vez), cada uno con su clave — ej. `612 - Personas Físicas con Actividades Empresariales y Profesionales`.
    - **Razón Social**: también en una caja de solo lectura, debajo de "Régimen fiscal" — se lee con `extraerNombreRazonSocial()`, la misma función ya usada (y ya depurada, con los mismos bugs de lectura corregidos) en la constancia de un cliente.
    - **Persona Física o Persona Moral**: se calcula combinando TRES señales, en orden de confiabilidad. **Primero** (la más confiable, agregada porque las otras dos señales seguían fallando en la práctica): los propios **campos que trae el documento** — una constancia de Persona Física siempre tiene los campos "Primer Apellido" y/o "Segundo Apellido" (una persona moral no tiene apellidos), y una de Persona Moral trae campos como "Régimen Capital" y/o "Nombre Comercial" (una persona física no los tiene) — esto lee la estructura real del formulario del SAT en vez de adivinar, así que si es concluyente, gana siempre sobre las otras dos señales. *(Esta búsqueda tolera que las etiquetas vengan pegadas sin espacio, ej. "RegimenCapital" — un extractor de PDF real con frecuencia concatena así el contenido de celdas de tabla adyacentes, y buscar la frase con un espacio fijo de por medio no la encontraba, causando un bug real ya corregido.)* **Segundo**, si los campos del documento no dijeron nada: el/los régimen(es) fiscal(es) encontrado(s) — los códigos `601`, `603`, `609`, `620`, `623` y `628` del catálogo oficial del SAT son exclusivos de Persona Moral. **Tercero**, si tampoco eso fue concluyente (regímenes que aplican a ambos tipos de contribuyente, como `626` RESICO, `610`, `622`, `624`, `629` y `630`): la **razón social como desempate** — terminación legal de persona moral (`S.A. DE C.V.`, `S. DE R.L. DE C.V.`, `S.C.`, `A.C.`, `S.A.P.I. DE C.V.`, `S.A.B. DE C.V.`, `S.A.S.`, entre otras) o palabra corporativa (`GRUPO`, `CORPORATIVO`, `COMERCIALIZADORA`, `CONSTRUCTORA`, `CONSULTORES`, `INMOBILIARIA`, `FUNDACIÓN`, `ASOCIACIÓN`, entre otras) → Persona Moral; nombre propio corto (2 a 5 palabras, sin nada de lo anterior) → Persona Física. Si ninguna de las tres señales es concluyente, se asume Persona Física por ser el caso más común. **Nota importante**: sigue siendo una simplificación práctica útil para la gran mayoría de los casos reales, no una determinación legal exacta garantizada para el 100% de los casos posibles.
  - **Clave SAT**: opcional, pero si se captura debe ser exactamente 8 dígitos (`^\d{8}$`) — se captura a mano, este campo sí sigue siendo editable directamente (antes se llamaba "Código SAT").
  - **Link de códigos SAT**: opcional; un enlace de referencia a la página del SAT donde se consultan esos códigos — si se captura, debe ser una URL válida (`http://` o `https://`). Una vez guardado, se muestra como **hipervínculo clicable** (abre en pestaña nueva) con un botón **"Editar"** al lado — el campo de texto queda oculto hasta que se presiona ese botón, para no dejarlo siempre editable de entrada.
  - **RFC, Clave SAT y (si ya se pudo calcular) el tipo de persona se muestran en la barra de sesión del panel**, junto al texto "Administración", con el formato `RFC - ClaveSAT - Persona Física/Moral` — el tercer segmento es opcional y solo aparece si ya se subió una constancia con al menos un régimen reconocido; con RFC y Clave SAT capturados pero sin ese tercer dato, se muestra `RFC - ClaveSAT` nada más. Si falta el RFC y/o la Clave SAT, no se muestra nada extra ahí (no se deja un texto a medias).
  - **Si falta el RFC (subir la constancia) y/o la Clave SAT, aparece una ventana emergente al iniciar sesión** recordando completarlos — solo al iniciar sesión, no cada vez que se abre esta misma tarjeta de configuración (ahí ya estarían viendo los campos para corregirlos).
  - El **IVA** es un porcentaje entre 0 y 100 (por ejemplo, 16 para la tasa general, u 8 para la tasa fronteriza) — se valida tanto en el formulario como en el backend. La **zona horaria** se elige de un catálogo fijo de zonas horarias válidas en México (Ciudad de México, Monterrey, Cancún, Mérida, Chihuahua, Mazatlán, Hermosillo, Tijuana, entre otras — identificadores reales de la base de datos de zonas horarias IANA, no texto libre) y determina cómo se genera y se muestra la fecha/hora de cada compra registrada.
  - **Con el interruptor "Habilitar Ventas" apagado**: el botón "Ventas" desaparece del menú del panel (se aplica de inmediato al guardar, y también al iniciar sesión), y el formulario de "Subir tickets de venta" (`tickets.html`) ya no muestra la sección "Verifica tu venta" — el ticket se puede enviar sin capturar No. Venta, fecha, hora ni total, exactamente como funcionaba la app antes de que existiera esa funcionalidad. El servidor también deja de exigir y validar esos cuatro campos (no es solo una cosa visual del lado del cliente).
  - **Con el interruptor encendido** (el valor por defecto): todo funciona exactamente igual que se documenta en la vista "Ventas" más abajo, sin ningún cambio.
- **Catálogo de Uso de CFDI**: en la misma sección de configuración, debajo de los campos obligatorios, se muestra cuántos usos de CFDI están cargados y cuándo se sincronizaron por última vez. El botón **"Actualizar catálogo SAT"** vuelve a descargar el catálogo desde el origen configurado (`USO_CFDI_SYNC_URL`) y lo reemplaza — pero solo si la respuesta tiene un formato reconocible (JSON o CSV con al menos 5 filas válidas); si la sincronización falla o el formato es irreconocible, **el catálogo actual no se modifica**. El formulario de tickets lee este catálogo en vivo cada vez que carga, así que una actualización aparece de inmediato sin reiniciar el servidor.
- **Correo electrónico (SMTP)**: sección plegable independiente, debajo de la anterior, para configurar el servidor SMTP que la app usará para enviar correos. Pensada principalmente para **Gmail** (`smtp.gmail.com`, puerto `587` con STARTTLS por defecto), pero funciona con cualquier proveedor SMTP estándar (puerto `465` con SSL también soportado). Campos: host, puerto, tipo de seguridad, usuario, contraseña, nombre/correo del remitente (opcionales, para personalizar el "De:" de los correos enviados), y **correo de quien va a facturar** (ver el siguiente punto).
  - **La contraseña nunca se muestra de vuelta** una vez guardada — el formulario solo indica si ya hay una configurada. Si guardas cambios sin volver a escribir la contraseña, se conserva la que ya estaba guardada (no hace falta capturarla cada vez que ajustas otro campo).
  - **Nota sobre Gmail**: Google rechaza la contraseña normal de la cuenta para SMTP. Hace falta activar la verificación en dos pasos y generar una **"Contraseña de aplicación"** desde la configuración de seguridad de la cuenta de Google — esa es la que va en este formulario. El panel incluye este mismo aviso.
  - **Correo de quien va a facturar**: campo opcional dentro de esta misma sección, con un ícono ⓘ junto a la etiqueta (funciona con hover en escritorio y con toque en celular) que explica que debe ser el **correo del contador** — la persona que efectivamente genera la factura. Es un solo valor **global** que configura el administrador aquí, y se usa como destinatario fijo de la notificación automática de "nuevo ticket para facturar" (ver la vista "Tickets"). Si se deja vacío, esa notificación no se envía por correo — en su lugar, el administrador la ve como una notificación emergente al iniciar sesión.
  - **Correo que recibe el cliente (factura lista)**: campo de **cuerpo** dentro de la misma tarjeta SMTP, para personalizar el mensaje del correo automático que se le envía al cliente cuando su factura queda lista. Admite las variables `{folio}` y `{rfc}` en cualquier parte del texto — se reemplazan por el folio y RFC reales de cada ticket al momento de enviarse. Si se deja vacío, se usa un texto por defecto razonable (funciona desde el primer arranque sin configurar nada). El **asunto no es configurable a propósito**: siempre es el mensaje fijo "Factura lista — Folio ...".
  - **Enviar correo de prueba**: dentro de la misma sección, con campos de **destinatario**, **asunto** y **cuerpo del correo** (texto plano) — sirve para confirmar que las credenciales y el host/puerto configurados funcionan de verdad antes de depender de ellos. Si el envío falla, el mensaje de error intenta ser específico (credenciales rechazadas, no se pudo conectar al host, etc.) en vez de mostrar el error técnico crudo de la librería.
  - La configuración se guarda en la base de datos (no en variables de entorno), reutilizando la misma tabla de configuración que ya usan los campos obligatorios y el catálogo de Uso de CFDI.
  - **Verificar conexión**: además de "Enviar correo de prueba" (que manda un correo real), un botón de verificación hace un *handshake* SMTP ligero (`.verify()`, sin enviar nada) y guarda el timestamp de la última verificación exitosa, visible en la propia tarjeta.
  - **Plantillas de correo** (solo `super`): pestaña independiente con las 5 plantillas que comparten el mismo cascarón visual (invitación, recuperar contraseña, aviso al contador, factura lista, reporte) — texto editable por plantilla, vista previa real en `<iframe>` (renderiza el mismo cascarón que se usa al enviar de verdad, no una simulación aparte), botón "Restablecer esta plantilla", y marcado simple real de negrita/cursiva en el cuerpo (el texto se escapa primero contra HTML/inyección, el marcado se aplica después — un administrador nunca puede inyectar HTML arbitrario). El diseño (logo, colores, estructura) y los asuntos nunca son editables desde aquí. El correo de venta (ticket) y el de "Solicitar aclaraciones" quedan fuera a propósito, con cascarón/contenido propios.
  - **Catálogo real del SAT — Clave de Producto o Servicio**: en "Configuraciones fiscales", el campo "Clave SAT" del producto/servicio se completa con un combobox que busca por texto o clave contra un catálogo local sincronizable (52,000+ claves reales, fuente verificada por `CLAVE_PROD_SERV_SYNC_URL`) — escribir los 8 dígitos a mano sigue funcionando siempre como respaldo, con enlace directo al sitio del SAT si no hay resultados.
- **Configuración Reportes**: tarjeta plegable, justo después de "Correo electrónico (SMTP)".
  - **Configurar correo de reportes**: un correo opcional al que se envía el reporte en Markdown — tanto el generado automáticamente (ver abajo) como el manual. Si se deja vacío, el reporte igual se genera y se guarda para poder verlo después en "Reportes", solo que no se manda nada por correo.
  - **Enviar reporte** (botón, envío manual): genera y envía, bajo demanda, un reporte con los tickets y ventas **activos creados en lo que va del mes calendario actual** — sin esperar a que algo esté por vencerse por la retención configurada. **El reporte se genera y se guarda siempre**, incluso si no hay un correo de reportes configurado — en ese caso, el botón avisa que no se envió nada por correo (sin mostrarlo como un error, ya que el reporte sí quedó disponible para consultarse en "Reportes"). Solo se marca como error real cuando SÍ hay un correo configurado pero el envío en sí falla (ej. el SMTP configurado dejó de funcionar).
  - **El reporte automático — generado antes de que se borre cualquier cosa por retención**: cuando el borrado automático (configurado en "Borrado automático de tickets y ventas", dentro de la vista "Tickets") está a punto de eliminar tickets y/o órdenes vencidos, **antes de borrar nada**, se genera un reporte combinado con toda esa información — un archivo en Markdown con el resumen, una tabla de los tickets y otra de las ventas que están a punto de eliminarse, y la fecha y hora exacta en que se generó (con la zona horaria configurada). Ese reporte se guarda (Markdown completo + los datos de cada registro por separado, para poder filtrarlos después) y, si hay un correo de reportes configurado, se envía como archivo adjunto `.md` — **solo después de que el reporte ya quedó guardado** se procede con el borrado real. Si el envío del correo falla, el reporte de todas formas ya quedó guardado, y el borrado sigue adelante de todas formas. Sin nada vencido en una corrida, no se genera ningún reporte.
  - **La tabla de tickets del reporte incluye quién lo atendió** (columna "Atendido por") — el mismo usuario de la sesión que quedó guardado en `tickets.actualizado_por` la última vez que se le cambió el estatus o las notas. Este dato no aplica a las ventas (esa tabla no tiene esa columna).

  > ⚠️ **Requiere configuración antes de usarse**: el catálogo viene precargado con los usos de CFDI vigentes para CFDI 4.0 (23 claves, de `G01` a `CN01`), así que el formulario funciona correctamente desde el primer arranque sin necesidad de sincronizar nada. El botón **"Actualizar catálogo SAT" no asume ninguna URL por defecto** — debes configurar `USO_CFDI_SYNC_URL` con una fuente que tú hayas verificado tú mismo antes de usarlo (debe responder JSON o CSV con columnas `clave,descripcion`); si no está configurada, el botón muestra un mensaje explicándolo en vez de fallar contra una URL adivinada. El SAT publica el catálogo oficial como parte del Anexo 20 del CFDI; también existen proyectos de código abierto de la comunidad que lo mantienen en formatos más fáciles de consumir, pero verifica cualquier fuente antes de apuntar `USO_CFDI_SYNC_URL` a ella.

### Vista "Reportes" (Lectura de reportes)

Botón propio en el menú del panel, organizado en **4 pestañas**: "Por reporte" (lo de siempre),
"Cortes", "Todo lo eliminado" y "Estado del inventario" (ver "Vista Inventarios" arriba) — un letrero
bajo las pestañas explica qué muestra cada segmento.

**Pestaña "Por reporte"** — consulta cualquier reporte automático o manual ya generado:

- Un **selector** lista todos los reportes generados, con fecha, tipo y totales, del más reciente al más antiguo.
- Al elegir uno, se muestra un **resumen** (tipo, fecha y hora de generación, cuántos tickets y órdenes trae, y si se envió por correo y a quién).
- **Filtros** (se pueden combinar entre sí), en una cuadrícula de 4 campos parejos: tipo de registro (tickets / ventas / gastos / todos), **estatus** (pendiente / en curso / cancelado / listo / todos — filtra sobre la columna "Estatus", que en la práctica solo empareja tickets, ya que el concepto libre de una orden no coincidiría con uno de esos valores exactos), RFC o correo (búsqueda parcial), y un **rango de fechas** (desde/hasta, agrupados en un solo campo con dos entradas lado a lado, en vez de dos campos sueltos) sobre la fecha original del ticket u orden capturado en el reporte.
- **Exportar a CSV o a Excel** (`.xlsx` real, generado con la librería `exceljs` — no un CSV disfrazado de Excel), respetando exactamente los mismos filtros que se estén viendo en la tabla en ese momento — incluye la columna "Atendido por". El CSV incluye el BOM de UTF-8 al inicio, para que Excel en Windows no corrompa acentos y eñes al abrirlo directamente.
- **"Ver Markdown completo"**: abre el reporte completo tal como se generó (o se envió por correo) en una ventana emergente, con su propio botón para descargarlo como archivo `.md`.
- **Eliminar reporte**: borra el reporte seleccionado de forma permanente (Markdown y todos sus registros) — pide confirmación primero, con el mismo modal genérico ya usado en el resto del panel. A diferencia de constancias/tickets, "Reportes" no tiene papelera — es un borrado directo.

**Pestaña "Cortes"** — lista los cortes de ventas generados desde la vista "Ventas" (ver "Corte del
día" arriba), con buscador, paginación, detalle con el total destacado, botón "Imprimir" (con los
campos que un corte guardado conserva: rango, total, conteo, ítems) y exportación CSV.

**Pestaña "Todo lo eliminado"** — ledger cruzado de todo lo que se ha eliminado a través de cualquier
reporte, con columna "Reporte de origen" (tipo del reporte que registró cada baja) y 3 KPIs de
auditoría (histórico + tendencia mensual). Cada fila muestra quién generó el reporte de origen
("Generado por", cruzado contra `admin_auditoria` por ruta+ventana de tiempo, mejor esfuerzo) y un
botón "Ver historial" con el timeline completo de ese identificador.

**Cierre mensual archivado**: el día 1 de cada mes, Ventas y Gastos del mes recién cerrado se archivan
automáticamente (nunca se borran) — la retención automática configurable (ver "Vista Tickets") sigue
aplicando solo a tickets. Las vistas de Ventas/Gastos filtran por defecto lo no archivado, con un
selector "Periodo" para consultar meses ya cerrados; Resumen financiero siempre incluye los meses
archivados en sus gráficas y KPIs históricos.

### Vista "Auditoría"

Consulta, dentro del propio tenant, la bitácora de mutaciones y logins del panel (la misma tabla
`admin_auditoria` que ya alimenta la auditoría cross-tenant de `/control`) — nunca muestra datos de
otro tenant. Opcional: un switch **"Mostrar Auditoría"** en Configuraciones globales (encendido por
defecto) oculta el botón del sidebar y bloquea el endpoint también del lado del servidor cuando está
apagado — el registro en sí (`admin_auditoria`) sigue corriendo pase lo que pase, el switch solo
controla la pantalla de consulta.

### Vista "Proveedores"

Botón nuevo en el sidebar (entre Inventarios y Reportes) — hoy es un **marcador de posición** ("en
construcción"), sin CRUD ni endpoint todavía; visible para el mismo perfil que Gastos
(`administrador` + super).

### Vista "Mi Cuenta"

Perfil propio del usuario que tiene la sesión abierta — nombre, teléfono, correo y cambio de
contraseña (verificando la actual, a diferencia del restablecimiento con privilegio que hace otro
administrador sobre una cuenta ajena).

- Todos los perfiles ven su perfil básico; identidad de la empresa y conteo de operadores (con la
  cuota `max_usuarios` del tenant, si aplica) solo para `administrador`/`super`.
- Cuentas sin fila real en la tabla `usuarios` (`ADMIN_USERS`, credenciales API, usuario de sucursal
  compartido) muestran sus datos como no editables — no hay dónde guardar un cambio.
- Zona horaria se muestra como espejo de solo lectura con enlace a "Configuraciones fiscales" (vive a
  nivel tenant, no por usuario).

### Centro de conocimiento

Manual del sistema integrado en la propia app, sin salir del panel — botón de libro en la barra de
sesión (foco directo en el buscador al abrir desde ahí) y en el pie del sidebar, disponible en
`/admin` y en `/control`.

- **Categorías reales**, una por vista del sidebar de cada app (en `/admin`, las 14 vistas reales,
  incluido "Glosario" con ~20 términos del negocio en orden alfabético — RFC, CFDI, kardex, costo
  promedio ponderado, rotación, folio, etc.; en `/control`, Empresas/Sucursales/Super Admins).
- **Buscador** que filtra y resalta coincidencias en vivo entre todas las categorías a la vez.
- Contenido 100% texto/HTML estático (sin dependencia ni servicio nuevo), oculto por perfil según qué
  vista tenga acceso cada quien.
- Botón **"Ver el recorrido de nuevo"** (dentro de "Primeros pasos") relanza el tour guiado a demanda.

### Checklist "Primeros pasos" y recorrido guiado

Al primer ingreso de una cuenta nueva, un checklist de 3-4 pasos (según el perfil) y un recorrido con
spotlight real sobre los elementos de la pantalla (posición calculada en vivo, no coordenadas fijas)
ayudan a entender el sistema sin documentación externa.

- Banderas de "ya visto" en `localStorage`, por cuenta — no por sesión ni a nivel servidor.
- Solo escritorio; se muestra una vez en la vida de la cuenta, salvo que se pida repetir desde el
  Centro de conocimiento.

### Recuperar contraseña

Enlace **"¿Olvidaste tu contraseña?"** en el login del portal de cliente y en el del panel
(`/admin`) — token de un solo uso (30 minutos de vigencia) enviado por correo, con página propia
(`restablecer.html`) para capturar la contraseña nueva.

- **Alcance real**: solo cuentas con fila propia en la tabla `usuarios` (cliente, administrador,
  fiscal) pueden recuperarla por este medio. La cuenta de respaldo `admin`, las cuentas de
  `ADMIN_USERS`, `/control` y los usuarios de sucursal compartidos **no** tienen este flujo — no
  tienen ni correo propio ni fila en esa tabla.
- El enlace respeta el slug del tenant que lo solicitó.

### Administración de cuentas y contraseñas

El panel de administración acepta credenciales de **tres mecanismos independientes**, evaluados en este orden — basta con que uno de ellos acepte las credenciales para entrar:

**1. `ADMIN_USERS` (variable de entorno) — el mecanismo original, sin ningún cambio.**

Se sigue configurando exactamente igual que siempre, sin tocar código. Edita la variable `ADMIN_USERS` en tu `.env` (o directamente en `docker-compose.yml`):

  ```env
  # Un solo administrador
  ADMIN_USERS=admin:MiClaveSegura123

  # Varios administradores, separados por comas
  ADMIN_USERS=admin:MiClaveSegura123,maria:OtraClave456
  ```

  Después de editar `.env`, reinicia el backend para aplicar el cambio:
  ```bash
  docker-compose up -d --build backend
  ```
  Las credenciales de `ADMIN_USERS` se comparan con `crypto.timingSafeEqual` para evitar ataques de temporización.

**2. Usuarios con perfil "Administrador" o "Fiscal" (tabla `usuarios`, creados desde el panel).**

Cualquier cuenta creada con el botón "Crear usuario" (ver arriba) con uno de estos dos perfiles puede entrar al panel usando su nombre de usuario y contraseña normal. Un perfil "Cliente" **nunca** puede entrar al panel, aunque adivinara credenciales correctas de otra cuenta — la consulta que verifica el acceso excluye ese perfil a nivel de base de datos, no solo en la interfaz. Si alguna de estas cuentas pierde su contraseña, cualquier otro administrador se la restablece desde la vista "Usuarios", como a cualquier cuenta.

Las contraseñas guardadas en MySQL (mecanismo #2) usan el mismo hash `scrypt` + `crypto.timingSafeEqual` que el resto de la app — nunca se guardan en texto plano.

> ⚠️ En producción usa contraseñas robustas para los dos mecanismos y sirve el sitio siempre por HTTPS (ver sección de despliegue), ya que HTTP Basic Auth viaja codificada en base64, no cifrada, dentro de la conexión.

- **Seguridad del login de usuario (RFC + contraseña)**: las contraseñas se guardan con `scrypt` (integrado en Node.js — no se agregó ninguna dependencia nueva con compilación nativa) más una sal aleatoria por cuenta, nunca en texto plano. La sesión es una cookie **httpOnly** (no accesible desde JavaScript, mitiga robo por XSS) firmada con HMAC-SHA256 y con expiración de 12 horas; no se guarda en una tabla de sesiones. El login y el registro también tienen rate limiting. El mensaje de error de login es genérico ("RFC o contraseña incorrectos") para no revelar si un RFC ya está registrado.

  > ⚠️ **Sobre `COOKIE_SECURE`**: por defecto es `false`. Si el sitio se sirve por HTTP plano (como en un despliegue local o accediendo desde el celular a una IP de la red local, ej. `http://192.168.x.x:8080`), déjalo así — si lo pones en `true` sin HTTPS real, el navegador **rechaza guardar la cookie de sesión por completo**, y el login parece "solo recargar la pantalla" sin iniciar sesión (esto pasaba en una versión anterior porque la bandera dependía de `NODE_ENV`, que `docker-compose.yml` siempre pone en `production` sin importar si hay HTTPS o no). Solo actívalo cuando de verdad hayas configurado HTTPS (ver despliegue a producción).

## 🧪 Verificación rápida de la API

```bash
curl http://localhost/api/health   # o :8088 si cambiaste FRONTEND_PORT
# {"status":"ok","maxFileSizeMb":5}
```

Para confirmar que MySQL está sano:
```bash
docker compose exec mysql mysqladmin ping -u root -p"$MYSQL_ROOT_PASSWORD"
# mysqld is alive
```

## 🏢 Multi-tenant (arquitectura — 9 de 9 segmentos completos)

Este proyecto pasó de servir a una sola empresa a poder servir a muchas
empresas cliente independientes, cada una en su propia base de datos, con
URLs tipo `midominio.com/<slug>` (portal del cliente) y
`midominio.com/<slug>/admin` (panel admin de esa empresa). El plan completo
(9 segmentos, decisiones de arquitectura y justificación) está documentado
en los puntos 88-96 de `PROJECT_STATE.md` — léelos ahí antes de tocar
cualquier cosa relacionada.

**Estado actual: los 9 segmentos del plan están construidos** (7 =
endurecimiento de seguridad multi-tenant; 8 = MySQL en alta disponibilidad,
ver la sección "MySQL en alta disponibilidad — Docker Swarm" arriba; 9 =
app de control `/control` para gestionar el ciclo de vida de tenants ya
existentes, ver la sección siguiente). Cualquier trabajo nuevo sobre esta
arquitectura es evolución posterior, no un segmento pendiente. A partir del segmento 4,
`nginx.conf` ya sabe reconocer URLs con forma `/<slug>/admin`,
`/<slug>/dashboard`, `/<slug>/tickets`, `/<slug>/login`, `/<slug>/csf` y
`/<slug>/api/*`, y el frontend ya sabe construir sus llamadas a la API y
sus enlaces internos respetando ese slug. El segmento 5 migró el
almacenamiento de archivos de disco local a MinIO — validado contra
Docker real (PROJECT_STATE.md punto 97), igual que la replicación GTID
del segmento 8 y el ciclo de vida de `/control`. El segmento 9c
(2026-08-13) sumó el alta de empresas nuevas desde `/control` con estado
`provisioning` y pre-llenado fiscal al aprovisionar, validado contra
Docker/MySQL reales de punta a punta (intake → script → tenant activo
con config fiscal). Sigue sin existir ningún tenant real dado de alta
(la BD de control solo tiene lo que se haya probado a mano con
`backend/scripts/provisionar-tenant.js`), así que nadie visita las URLs
con prefijo — las rutas de siempre (`/admin`, `/login`, `/dashboard`,
etc., sin prefijo) siguen siendo las únicas con tráfico real.

**Para convertir tu instalación actual en el primer tenant real**
(cuando estés listo, con el stack ya levantado y probado): corre
`backend/scripts/cutover-tenant-piloto.js` (ver el encabezado del
archivo para el uso completo y las variables de entorno necesarias). No
es destructivo — nunca modifica la base de datos ni los archivos
originales — pero pruébalo primero contra una copia/backup, no contra
producción directamente. Al terminar, imprime el snippet exacto de
redirecciones 301 que agregar a mano en `frontend/nginx.conf` para esa
transición.

**Dar de alta la base de datos de un tenant nuevo** (no lo hace accesible
por URL todavía, ver arriba):

```bash
MYSQL_ROOT_PASSWORD=<la_de_tu_.env> \
DB_HOST=localhost DB_PORT=3306 \
DB_USER=app DB_PASSWORD=<la_de_tu_.env> \
  node backend/scripts/provisionar-tenant.js cliente1 "Empresa Uno S.A. de C.V." \
  --contacto-email=contacto@empresauno.com
```

Requiere el puerto de MySQL expuesto al host (ya lo está por defecto, ver
`MYSQL_PORT` arriba) y la contraseña de **root** de MySQL — a propósito el
contenedor `backend` nunca tiene esa contraseña montada, así que este
script se corre desde tu máquina, nunca desde dentro de un contenedor.

El script es seguro de correr varias veces: crea/asegura la base de datos
de control (`control_tenants`, catálogo de tenants) y el permiso amplio del
usuario `app` sobre cualquier base `tenant_*` de forma idempotente en cada
corrida. Dar de alta un slug que ya existe se rechaza explícitamente (no
sobreescribe nada), **salvo que la fila esté en estado `provisioning`** —
es decir, que la solicitud se haya capturado desde `/control` (segmento
9c, ver sección siguiente): en ese caso el script la COMPLETA, el nombre
de la empresa es opcional (se toma el capturado en la UI) y los datos
fiscales capturados pre-llenan la configuración del tenant. Reglas de slug
(minúsculas/números/guiones, nombres reservados como `admin`/`api`/
`login`, etc.) en `backend/utils/tenant.js`.

## 🕹️ App de control (`/control`, contenedor propio — segmento 9b)

Pantalla cross-tenant para gestionar el ciclo de vida de empresas **ya
provisionadas**: listar, suspender, reactivar y dar de baja. Vive en su
**propio contenedor** (`control/`, no dentro de `backend`), separado a
propósito por seguridad y portabilidad:

- **Credencial de MySQL propia y angosta** (`control_app`): solo lectura/
  escritura sobre `control_tenants` (ni siquiera `DELETE`) — **sin ningún
  acceso** a la base de datos de ninguna empresa (`tenant_*`). Si el
  backend principal (expuesto a más superficie: subida de archivos,
  parseo de PDFs, endpoint público) se viera comprometido, ese
  compromiso no da acceso automático a `/control`, y viceversa.
- **Auth propia, solo `ADMIN_USERS`**: nada de usuarios administrador/
  fiscal (esos viven en la BD de un tenant específico) — `/control` solo
  acepta las cuentas "super" de la variable de entorno, compartida entre
  `backend` y `control`.
- **Se puede desplegar en otro servidor**: nginx reenvía `/api/control/*`
  según las variables `CONTROL_UPSTREAM_HOST`/`CONTROL_UPSTREAM_PORT`
  (por defecto, el contenedor `control` de este mismo
  `docker-compose.yml`) — cambia esas dos variables para apuntar a un
  host/IP/dominio distinto sin reconstruir la imagen del frontend.
- **BD dedicada, mismo host (Fase 1, ver PROJECT_STATE.md punto 305)**:
  `control_tenants` vive en su propio contenedor MySQL
  (`mysql-control`, servicio aparte en `docker-compose.yml`) — aísla el
  proceso/credenciales, no solo la base lógica, del MySQL que usa el
  backend de tenants. Fase 2 (servidor físico separado) queda pendiente
  de que exista esa infraestructura. Solo en el stack de desarrollo
  local por ahora — `prod/` (VPS único nodo) no incluye este servicio.

**Sí captura altas nuevas (segmento 9c)**: el botón **"Nueva empresa"**
del `/control` guarda la solicitud con estado `provisioning` (nombre,
slug, contacto, notas y datos fiscales opcionales) — pero **el alta
física sigue siendo manual y exclusiva del script CLI**
(`provisionar-tenant.js`), que requiere `CREATE DATABASE` + privilegios
de root de MySQL que NINGÚN contenedor tiene montados (mismo límite de
seguridad del segmento 1). El script detecta las filas `provisioning`
y las completa (pasa a `activo`, y si traían datos fiscales, el tenant
nace con su configuración fiscal pre-llenada en vez de vacía). En
resumen: la UI captura la solicitud; un operador con acceso root corre
el script para materializarla:

```bash
MYSQL_ROOT_PASSWORD=<la_de_tu_.env> \
DB_HOST=localhost DB_PORT=3306 \
DB_USER=app DB_PASSWORD=<la_de_tu_.env> \
  node backend/scripts/provisionar-tenant.js piloto9c
```

(sin segundo argumento: el nombre y el contacto se toman de la
solicitud capturada; el script avisa si la fila no existe y hace falta
pasar todo por el CLI). Las variables `TENANT_DB_HOST`/`TENANT_DB_USER`
(opcionales, ver `.env.example`) sirven solo si los tenants vivirán en
una instancia de MySQL distinta a la del contenedor de control — por
defecto heredan la del control y el usuario `app`.

**Marca por empresa (segmento "Marca", ver PROJECT_STATE.md punto 103)**:
cada empresa define el **nombre de su marca** (campo `marca` en
`control_tenants.tenants`) con el que quiere ser reconocida en los
correos del portal (en vez del nombre genérico "ADDV"), y opcionalmente
un **logo** (JPG/PNG/WEBP, máx 2 MB). Sin logo, los correos usan el
nombre en texto (el operador puede generar el logo después). El logo se
guarda en MinIO bajo `marca/<slug>/logo` (el contenedor `control` no
tiene SDK de MinIO: se reenvía al backend por su endpoint interno
`POST/DELETE /internal/marca-logo/:slug`, protegido con el mismo
`INTERNAL_CACHE_SECRET` que la invalidación de caché y NO expuesto por
nginx) y se sirve en `GET /api/marca-logo/:slug` (público a propósito —
el logo viaja en los correos —, con cache de 24 h). Se edita desde el
campo "Marca" + el logo en el modal de **"Nueva empresa"**, y desde la
pestaña "Identidad visual" del modal **"Editar empresa"** de `/control`
(super, cualquier tenant) o la tarjeta "Marca e identidad visual" en
Configuraciones de `/admin` (el propio tenant — ver más abajo, punto
373). El backend usa `req.tenant.marca` (con
fallback `'ADDV'`) en los 7 correos que antes tenían "ADDV" incrustado:
ticket nuevo, venta, invitación al portal, ticket nuevo al
contador, factura lista y la plantilla de correo por defecto.

**Identidad visual (tema) por empresa (segmento "Look & Feel", ver
`inventarios.md`/PROJECT_STATE.md puntos 105 y 373)**: nombre de marca, logo, colores (12
selectores de una lista cerrada de claves), radio de esquinas y favicon propio — con vista previa
en vivo y botón "Restablecer al diseño ADDV". Editable desde **dos superficies con la misma
interfaz** (componente compartido `frontend/marcaTemaEditor.js`): la pestaña "Identidad visual" del
modal "Editar empresa" en `/control` (cualquier tenant, operador super) y la tarjeta "Marca e
identidad visual" en Configuraciones de `/admin` (el propio tenant, autoservicio — oculta si el
plan tiene "Marca propia / Look & Feel" apagado). Tipografía congelada a Inter en todo el sitio, sin
selector. El contraste se valida en servidor con **WCAG 2.1 AA real** (9 pares fondo/texto), con el
mismo cálculo repetido en el cliente para feedback inmediato; un valor que no cumple se rechaza.
`frontend/theme.js` pinta las variables CSS resultantes sobre las 6 páginas del portal de cada
tenant, sin tocar el diseño base cuando el tenant no tiene tema propio.

**Cuota de usuarios de panel por tenant (`max_usuarios`)**: campo editable en "Editar empresa" que
limita cuántas cuentas administrador/fiscal/ventas puede tener ese tenant — `POST`/`PUT
/api/admin/usuarios` rechazan (400, `CUOTA_USUARIOS_EXCEDIDA`) exceder el límite; nunca aplica a
cuentas perfil cliente. Una cuenta suspendida sigue contando contra la cuota (no libera el "asiento").

**Activar tenant sin root de MySQL**: un tenant en estado "Provisionando" (alta capturada desde
"Nueva empresa" pero sin materializar todavía) puede completarse con el botón **"Activar"** de su
fila, sin necesitar la contraseña de root de MySQL en el momento — usa un privilegio ya otorgado una
sola vez al usuario de aplicación (`GRANT ALL ... ON tenant\_%.*`) para crear la base de datos del
tenant y aplicarle el esquema completo. Verifica el estado ANTES del paso físico (nunca marca
"activo" si la creación de la base de datos falla). El script CLI (`provisionar-tenant.js`, con root)
sigue existiendo como respaldo si el privilegio llegara a faltar.

**Super Admins desde `/control`**: vista propia en el sidebar para dar de alta, editar contraseña o
quitar cuentas "super" (`ADMIN_USERS`) **sin editar el `.env` ni reiniciar ningún contenedor** — el
backend recarga la lista de inmediato. La escritura sobre el `.env` real es atómica, con respaldo
(`.env.bak`) antes de sobreescribir (necesario porque el patrón habitual de "temporal + rename" falla
con `EBUSY` sobre un bind mount de un solo archivo, una limitación real de Docker).

**Sucursales — usuarios de acceso compartidos entre empresas del mismo
negocio (§58, ver `inventarios.md`)**: `/control` puede agrupar varios
tenants como "sucursales" del mismo negocio (vista "Sucursales" en el
sidebar) y dar de alta usuarios compartidos que entran a `/admin` de
CUALQUIER sucursal del grupo con la misma contraseña. Lo único que se
comparte es el login — cada tenant conserva su propia base de datos,
inventario y ventas 100% aislados, sin excepción. La credencial vive
SOLO en la BD de control (tabla `usuarios_sucursal`, nunca en la tabla
`usuarios` de cada tenant) y `backend` la verifica en vivo reutilizando
la misma conexión que ya usa para resolver cualquier tenant por slug —
sin llamada nueva entre servicios, sin duplicar la credencial. Un tenant
vive en máximo un grupo a la vez. "Eliminar" un grupo es una baja lógica
(el usuario `control_app` no tiene privilegio `DELETE` ni `REFERENCES`
en MySQL, a propósito — credencial angosta): suelta sus sucursales y
desactiva sus usuarios compartidos, sin borrar ninguna fila. Cuando un
tenant pertenece a un grupo con más de una sucursal, `/admin` muestra un
switcher en el sidebar para saltar entre ellas sin volver a iniciar
sesión.

**Antes de la primera vez que uses `/control`**: el usuario MySQL
`control_app` no existe hasta que corras (una vez)
`provisionar-tenant.js` o `cutover-tenant-piloto.js` con
`CONTROL_APP_PASSWORD` definido en el entorno — ese script es quien lo
crea (con privilegios root). También define `INTERNAL_CACHE_SECRET` (el
mismo valor en `backend` y `control` — ver `.env.example`) para que la
invalidación de caché entre contenedores funcione.

- Entra en `http://localhost/control` (o tu dominio, con HTTPS en
  producción) con una cuenta `"super"` (`ADMIN_USERS`).
- **Suspender**: la empresa deja de ser accesible hasta reactivarla — no
  borra ningún dato.
- **Dar de baja**: igual de reversible — nunca borra la base de datos
  `tenant_<slug>` ni sus archivos en MinIO, solo cambia el estado.
- **Reactivar**: funciona igual desde "suspendido" o desde "baja" —
  vuelve a ser accesible de inmediato.
- **Eliminar definitivo / Vaciar papelera (ver PROJECT_STATE.md punto
  345)**: a diferencia de las 3 acciones de arriba, esta SÍ borra todo
  para siempre — base de datos física (`DROP DATABASE`), archivos en
  MinIO y las filas de `control_tenants` — y solo es alcanzable desde
  "Baja" (candado extra deliberado: 2 pasos antes de algo irreversible).
  Pide escribir el slug exacto (o `ELIMINAR` para vaciar toda la
  papelera de una vez) antes de confirmar. `control_app` no tiene
  privilegio `DELETE` — el borrado completo se delega a un endpoint
  interno del backend (`POST /internal/eliminar-tenant/:slug`, mismo
  patrón de secreto compartido que el resto de `/internal/*`), que sí
  tiene los privilegios necesarios sobre `control_tenants`.
  `admin_auditoria` nunca se toca — se conserva como rastro histórico
  aunque la empresa ya no exista.
- Cada acción se ve reflejada **de inmediato** en `/admin` y en el
  portal del cliente de esa empresa (no hasta 45 segundos después): al
  completarse, `control` le avisa a `backend` por una llamada interna
  para que invalide su caché de tenant al instante.
- Cada acción queda registrada en `control_tenants.tenant_eventos` y en
  la auditoría de acceso admin (`admin_auditoria`, segmento 7) — escrita
  ahora por `control` con su propia credencial angosta.
- **Gobierno de funcionalidades por tenant (ver PROJECT_STATE.md punto
  347)**: además del estado del tenant, `/control` gobierna QUÉ PUEDE
  USAR cada empresa (Facturación, portal de clientes, sucursales, marca
  propia, cuota de disco) mediante un catálogo de **planes** — pestaña
  "Planes" propia: se crean y nombran primero, sin ningún cliente en
  mente (nombre, precio, qué funciones/límites trae), y se asignan
  después al editar una empresa, en la pestaña "Plan y funciones" de su
  ficha (antes un solo modal largo, ahora dividido en pestañas: General /
  Plan y funciones / Identidad visual / Grupo-sucursales). Al asignar un
  plan sus valores se COPIAN al tenant — editar el plan después nunca
  toca a quien ya lo tiene asignado; cada función muestra una etiqueta
  "del plan" o "excepción" según coincida o no con lo que el plan trae
  hoy, y existe un botón "Reaplicar valores del plan" para resincronizar
  a mano. El backend respeta estos flags de verdad: **404, nunca 403**,
  si el módulo está apagado — un tenant sin Facturación o sin portal de
  clientes se comporta como si esas rutas no existieran.
  - **Cuota de disco**: botón "Recalcular" (suma los bytes reales en
    MinIO bajo el prefijo del tenant — nunca se mide en vivo por
    request) + barra de uso con su color según cercanía al límite. La
    cuota se hace cumplir (`413 DISCO_CUOTA_EXCEDIDA` si el último
    cálculo ya la superó) en las tres subidas de archivo de mayor
    volumen: imagen de producto (Inventarios), constancia de situación
    fiscal del cliente y foto del ticket. Logo/favicon de marca quedan
    fuera a propósito — son rutas internas sin contexto de tenant
    resuelto, de un solo archivo pequeño (≤2 MB) por empresa.
  - **Auditoría**: pestaña "Auditoría" en /control — quién entró, qué
    hizo (crear plan, asignar, archivar, suspender, etc.) y sobre qué
    empresa, con filtros por usuario/empresa/fecha. Mismo diseño ya
    aprobado en la Auditoría de `/admin`, con una columna "Empresa" para
    que sea cross-tenant. A diferencia de `/admin`, nunca se puede
    apagar — es el panel de control mismo.

### Desplegar `/control` en un servidor distinto

1. Construye y corre la imagen de `control/` en ese servidor, con
   `CONTROL_DB_HOST`/`PORT` apuntando al MySQL real (el puerto 3306 ya
   está expuesto al host por `MYSQL_PORT`) y `BACKEND_INTERNAL_URL`
   apuntando a una URL donde ese servidor SÍ pueda alcanzar al backend
   principal (ej. su dominio público, no `http://backend:4000` —  ese
   nombre solo resuelve dentro de la red Docker del `docker-compose.yml`
   original).
2. En el `docker-compose.yml`/`docker-stack.yml` original, cambia
   `CONTROL_UPSTREAM_HOST`/`CONTROL_UPSTREAM_PORT` del servicio
   `frontend` al host/IP/puerto público de ese nuevo servidor, y
   redespliega solo `frontend` (`docker compose up -d frontend`).
3. `INTERNAL_CACHE_SECRET` debe ser el mismo valor en ambos servidores.

## 🧠 Arquitectura (resumen)

```
                                  /api/*          [Express backend:4000] ─┐
[Navegador] → [Nginx (frontend:80)] ─┤                                    ├→ [MySQL (mysql:3306)]
                                  /api/control/*  [Express control:4001] ─┘
```

Uploads en carpeta local (bind mount) solo para `backend`; `control` no
maneja archivos. `control` puede vivir en otro servidor (ver sección "App
de control" arriba) — el diagrama muestra el despliegue por defecto,
mismo host.

- **Frontend**: contenedor Nginx que sirve los archivos estáticos y actúa como reverse proxy interno hacia el backend en `/api` y hacia `control` en `/api/control`, evitando problemas de CORS y exponiendo un solo puerto al usuario.
- **Control**: contenedor aparte (segmento 9b) — app cross-tenant `/control`, credencial de MySQL propia y angosta, sin acceso a datos de ningún tenant. Ver la sección "App de control" arriba para el detalle completo.
- **Backend**: API REST con estos endpoints:
  - `POST /api/auth/registro` — crea una cuenta (RFC + correo + teléfono + contraseña) e inicia sesión.
  - `POST /api/auth/login` — inicia sesión con RFC (o nombre de usuario, para cuentas administrador/fiscal) + contraseña.
  - `POST /api/auth/logout` — cierra la sesión.
  - `GET /api/auth/me` — confirma si la sesión sigue siendo válida, y si la cuenta tiene pendiente un cambio de contraseña obligatorio (protegido con cookie de usuario).
  - `PUT /api/auth/password` — cambia la contraseña del usuario en sesión; también apaga la bandera de cambio obligatorio (protegido con cookie de usuario).
  - `POST /api/tickets` — sube la imagen de un ticket y genera su folio (protegido con cookie de usuario; multipart/form-data). Rechaza la petición (400, con `codigo: "SIN_CONSTANCIA"`) si el RFC de la sesión no tiene una constancia de situación fiscal activa — el frontend usa ese código para mostrar el mismo modal bloqueante, no un texto de error genérico. También exige y verifica `numero_compra`, `fecha_compra`, `hora_compra` y `total_compra` contra una venta real en `ordenes_compra`; si no coincide, rechaza (400, con `codigo: "COMPRA_NO_ENCONTRADA"`) con el mensaje "No se encuentra registrada la venta para facturar." — el mismo mensaje sin importar cuál de los cuatro datos esté mal, a propósito. Si la orden ya tiene un ticket facturado (estatus "listo") vinculado, rechaza (400, con `codigo: "COMPRA_YA_FACTURADA"`) con "Esa venta ya fue facturada." — no se puede volver a facturar la misma orden. **Ambos casos se muestran en el frontend como una ventana emergente** (no un texto inline ni un toast que desaparece solo), con un mensaje de orientación adicional sobre qué revisar, cerrable con el botón "Entendido", la tecla Escape, o haciendo clic fuera del recuadro — al cerrarse, el foco vuelve al campo "No. Venta" para que el cliente pueda corregir de inmediato.
  - `GET /api/tickets` — lista los tickets del RFC de la sesión actual, excluyendo los eliminados lógicamente (protegido con cookie de usuario).
  - `GET /api/tickets/:id/factura` — descarga la factura de un ticket propio, solo si ya está "listo" (protegido con cookie de usuario).
  - `GET /api/registro/buscar?rfc=...&email=...` — busca un registro existente (RFC primero, correo como respaldo); usado por la vista previa antes de reemplazar.
  - `GET /api/registro/:email` — variante solo por correo, conservada por retrocompatibilidad.
  - `GET /api/registro/existe` — informa (sin exponer datos) si el RFC de la sesión actual ya tiene una constancia activa; usado por el aviso emergente de `tickets.html` (protegido con cookie de usuario).
  - `POST /api/registro` — valida, sanitiza y guarda los datos y el archivo (multipart/form-data). Rechaza la petición (400) si el RFC real impreso en la constancia no coincide con el RFC de la sesión o del formulario, cuando ambos se pudieron determinar.
  - `GET /api/config/campos-obligatorios` — pública; indica qué campos son obligatorios actualmente (para que el formulario los marque en vivo) y si "Ventas" está habilitada (`ordenes_compra_habilitado`) — `tickets.html` usa esto para mostrar/ocultar la sección "Verifica tu venta".
  - `GET /api/catalogos/uso-cfdi` — pública; catálogo de Uso de CFDI para el dropdown del formulario de subir ticket (`tickets.html`).
  - `GET /api/admin/login` — valida credenciales de administrador (Basic Auth); devuelve `usuario` y `perfil` (`super` | `administrador` | `fiscal`), usado por el frontend para aplicar la restricción de acceso por perfil.
  - `GET /api/admin/config/campos-obligatorios` / `PUT /api/admin/config/campos-obligatorios` — consulta y actualiza qué campos son obligatorios (protegido).
  - `GET /api/admin/config/global` / `PUT /api/admin/config/global` — consulta y actualiza el IVA (0-100%), la zona horaria, si "Ventas" está habilitada (`ordenes_compra_habilitado`), `clave_sat` (8 dígitos, antes se llamaba `codigo_sat` — se sigue leyendo un valor guardado con el nombre viejo por compatibilidad) y `link_codigos_sat` (URL) — los dos últimos opcionales pero validados si se capturan. `rfc_compania`, `regimen_fiscal_compania` y `tipo_persona_compania` también se pueden leer aquí, pero ya no se escriben desde este endpoint — solo desde el siguiente (protegido).
  - `POST /api/admin/config/constancia-compania` — sube la constancia de situación fiscal de la propia compañía (multipart/form-data, campo `archivo`); reutiliza la misma extracción de PDF que la constancia de un cliente, y escribe `rfc_compania`, `razon_social_compania`, `regimen_fiscal_compania` y `tipo_persona_compania` (calculado a partir del régimen y, si hace falta, de la razón social) en la configuración global. A diferencia de la constancia de un cliente, aquí el RFC es obligatorio de encontrar — si no se pudo identificar, se rechaza (protegido).
  - `GET /api/admin/config/zonas-horarias` — catálogo fijo de zonas horarias válidas en México, para el selector (protegido).
  - `GET /api/admin/correos-registrados` — lista los correos de constancias activas junto con su RFC y nombre/razón social, para el desplegable de la venta y su bloque de confirmación de solo lectura (protegido).
  - `POST /api/admin/ordenes-compra` — registra una venta; el "No. Venta" y la fecha se auto-generan, el IVA se toma de la configuración global, y se envía un correo de confirmación con diseño de ticket al cliente (protegido).
  - `GET /api/admin/ordenes-compra` — lista las ventas activas, con la fecha formateada según la zona horaria actualmente configurada y un booleano `facturado` (según si ya tiene un ticket vinculado con estatus "listo") para el ícono ✅ en la tabla (protegido).
  - `POST /api/admin/ordenes-compra/:id/reenviar-correo` — reenvía el correo de confirmación (el "ticket") de una orden ya registrada, al mismo correo asociado; a diferencia del envío original, este SÍ espera el resultado y lo reporta de vuelta (protegido).
  - `GET /api/admin/catalogos/uso-cfdi` — consulta el catálogo y cuándo se sincronizó por última vez (protegido).
  - `POST /api/admin/catalogos/uso-cfdi/actualizar` — sincroniza el catálogo desde `USO_CFDI_SYNC_URL` (protegido).
  - `GET /api/admin/catalogo-clave-sat/buscar?q=...` — busca en el catálogo "Clave de Producto o Servicio" del SAT por clave o descripción, hasta 20 resultados (protegido, administrador/fiscal).
  - `GET /api/admin/catalogo-clave-sat/info` — consulta el total de claves cargadas y cuándo se sincronizó por última vez (protegido, administrador/fiscal).
  - `POST /api/admin/catalogo-clave-sat/actualizar` — sincroniza el catálogo desde `CLAVE_PROD_SERV_SYNC_URL` (por defecto, el dump real de `phpcfdi/resources-sat-catalogs`) (protegido, administrador/fiscal).
  - `GET /api/admin/config/smtp` — consulta la configuración de correo SMTP (sin exponer la contraseña) (protegido).
  - `PUT /api/admin/config/smtp` — guarda/actualiza la configuración de correo SMTP (protegido).
  - `POST /api/admin/config/smtp/prueba` — envía un correo de prueba con asunto y cuerpo capturados (protegido).
  - `GET /api/config/tickets-retencion` — pública; días configurados para el borrado automático de tickets (o `null` si está desactivado), usado para el aviso en el tablero del cliente.
  - `GET /api/marca-logo/:slug` — pública; sirve el logo de marca de un tenant (almacenado en MinIO bajo `marca/<slug>/logo`), con `Cache-Control` de 24 h — usado por los correos y por la app de control (ver sección "App de control").
  - `GET /api/admin/config/tickets-retencion` / `PUT /api/admin/config/tickets-retencion` — consulta y actualiza los días de retención (aplican tanto a tickets como a ventas), e informa la última limpieza ejecutada de cada uno por separado (protegido).
  - `POST /api/admin/reportes/enviar` — genera y guarda un reporte manual con los tickets y ventas activos del mes calendario en curso (siempre, sin importar la configuración), y además lo envía por correo si hay uno configurado. Solo responde con error si SÍ había un correo configurado pero el envío en sí falló (protegido).
  - `GET /api/admin/reportes` — lista todos los reportes generados (solo metadatos: tipo, fecha, totales, si se envió por correo), del más reciente al más antiguo (protegido).
  - `GET /api/admin/reportes/:id/md` — el contenido completo en Markdown de un reporte específico (protegido).
  - `GET /api/admin/reportes/:id/items[?tipo_registro=][?estatus=][?rfc=][?fecha_desde=][?fecha_hasta=]` — los registros estructurados de un reporte (incluyendo `atendido_por`, quién atendió cada ticket), con los cinco filtros opcionales combinables entre sí — `estatus` acepta `pendiente`/`en_curso`/`cancelado`/`listo` (protegido).
  - `GET /api/admin/reportes/:id/exportar?formato=csv|excel[&mismos filtros que .../items]` — exporta los registros de un reporte (con los mismos filtros que se estén aplicando) a CSV o a un `.xlsx` real (protegido).
  - `DELETE /api/admin/reportes/:id` — elimina un reporte de forma permanente; sus registros en `reporte_items` se borran automáticamente por el `ON DELETE CASCADE` ya definido en la base de datos (protegido).
  - `GET /api/admin/tickets/pendientes-sin-contador` — tickets pendientes que no pudieron notificarse porque el correo de quien va a facturar (configuración global, dentro de SMTP) no está configurado; sale vacía en cuanto se configura (protegido).
  - `GET /api/admin/registros[?papelera=true]` — lista los registros activos (o los de la papelera) (protegido).
  - `DELETE /api/admin/registros/:id` — borrado lógico, envía a la papelera (protegido).
  - `POST /api/admin/registros/:id/restaurar` — deshace el borrado lógico (protegido).
  - `DELETE /api/admin/registros/:id/permanente` — borrado físico irreversible (protegido).
  - `GET /api/admin/archivo/:id` — sirve el archivo original de un registro (protegido).
  - `GET /api/admin/usuarios[?perfil=cliente|administrador|fiscal]` — lista cuentas, opcionalmente filtradas por perfil (protegido).
  - `POST /api/admin/usuarios` — crea una cuenta con perfil cliente/administrador/fiscal; el correo es obligatorio y se le envía una invitación al portal (protegido).
  - `PUT /api/admin/usuarios/:id` — edita perfil, RFC/usuario, correo y teléfono de una cuenta existente (no toca la contraseña); rechaza que un administrador baje su propio perfil a "cliente" mientras tiene la sesión iniciada con esa cuenta (protegido).
  - `PUT /api/admin/usuarios/:id/password` — restablece la contraseña de un usuario (protegido).
  - `DELETE /api/admin/usuarios/:id` — elimina una cuenta de forma permanente; rechaza la petición si es la misma cuenta con la que el administrador tiene la sesión iniciada (protegido).
  - `GET /api/admin/tickets[?estatus=...][?actualizado_por=...][?papelera=true]` — lista tickets, opcionalmente filtrados por estatus, por quién hizo el último cambio, y/o por papelera (por defecto solo activos) — los tres filtros se pueden combinar. Cada ticket incluye, si quedó vinculado a una venta, el No. Venta, la fecha/hora (con la zona horaria actualmente configurada) y el total que el cliente capturó al subirlo — para mostrarlos junto a la foto del ticket en el panel (protegido).
  - `GET /api/admin/tickets/usuarios-actualizado-por` — lista los usuarios distintos que aparecen en `actualizado_por` entre los tickets activos, para llenar el desplegable del filtro "Usuario" (protegido).
  - `PUT /api/admin/tickets/:id/estatus` — cambia el estatus de un ticket a "en_curso" o "cancelado" (protegido).
  - `POST /api/admin/tickets/:id/factura` — sube la factura de un ticket y lo marca como "listo" (protegido; multipart/form-data). Solo acepta un archivo `.zip`, verificado por contenido real (firma binaria), no solo por extensión — y que contenga adentro al menos un `.pdf` y un `.xml`, verificado leyendo el directorio central del ZIP.
  - `DELETE /api/admin/tickets/:id` — borrado lógico (mueve el ticket a la papelera, protegido).
  - `POST /api/admin/tickets/:id/restaurar` — restaura un ticket de la papelera (protegido).
  - `DELETE /api/admin/tickets/:id/permanente` — borrado físico: elimina la imagen y la factura del disco, y la fila de la base de datos, de forma permanente (protegido).
  - `GET /api/admin/tickets/:id/imagen` — muestra la imagen original de un ticket (protegido).
  - `GET /api/admin/tickets/:id/factura` — descarga la factura (el ZIP) ya subida a un ticket, para que el administrador la verifique o la vuelva a tener a la mano (protegido).
- **Base de datos**: MySQL 8 en su propio contenedor (`docker-compose.yml`), con un volumen Docker nombrado (`mysql_data`) para persistencia. El backend espera activamente a que MySQL esté listo antes de aceptar tráfico (con reintentos), y `docker-compose` además usa un *healthcheck* de MySQL para no arrancar el backend hasta que la base de datos esté sana. Todas las consultas usan el driver `mysql2/promise` (asíncrono) con un *pool* de conexiones.
- **Tarea periódica de limpieza**: el borrado automático de tickets vencidos corre dentro del propio proceso de Node (`setInterval`, una vez al arrancar y luego cada hora) — no depende de un cron externo ni de un contenedor adicional. Si el proceso se reinicia (ej. `docker-compose restart backend`), la limpieza simplemente vuelve a correr al arrancar, así que no se pierde ninguna ejecución de forma permanente.
- **Persistencia**: MySQL para los datos estructurados, y almacenamiento de archivos en disco mapeado como *bind mount* local (`./uploads`) para poder inspeccionarlo directamente y que sobreviva a reconstrucciones de contenedores.

## 🗂️ Repositorio y ramas (git)

- Repositorio público de este trabajo: `https://github.com/addv-prototipos/ADDVportalFact.git`
  (remote `fact`, rama destino `master`).
- `origin` apunta a `https://github.com/antonioprado-sketch/portal-multi.git` (repo previo, ya no es el destino de publicación).
- La rama local por defecto es `main`; publicar = `git push fact main:master`.
- El `master` remoto fue reemplazado por force push el 2026-08-18 (el historial anterior quedó huérfano; la rama `prototipo` del remote sigue intacta). Ver `PROJECT_STATE.md` punto 107.
