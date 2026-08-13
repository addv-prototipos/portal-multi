# Brief para Google Stitch — Portal de Facturación ADDV

## 1. Qué es la app

Portal web donde clientes y proveedores capturan sus datos de facturación y suben su **Constancia de Situación Fiscal** (PDF del SAT, México). El sistema valida que el PDF sea un documento genuino del SAT, extrae automáticamente nombre/razón social, régimen fiscal y código postal, y evita subir un archivo distinto al RFC de la cuenta. Cada usuario mantiene un solo archivo activo; si ya existe uno, se pide confirmación antes de reemplazarlo.

Audiencia: proveedores/clientes de una empresa mexicana (no técnicos, deben poder completar el flujo sin ayuda) y un equipo administrativo/fiscal interno que revisa y gestiona las solicitudes desde un panel.

## 2. Pantallas existentes (mapa de la app)

| Pantalla | Archivo | Función |
|---|---|---|
| Login / crear cuenta | `login.html` | Entrada por RFC + contraseña, o registro nuevo |
| Dashboard | `dashboard.html` | Accesos directos + lista de solicitudes del usuario |
| Flujo constancia fiscal | `csf.html` | 3 pasos: **Datos → Archivo → Confirmación** |
| Tickets | `tickets.html` | Subir foto de un ticket de compra |
| Panel admin | `admin.html` | Gestión de solicitudes, usuarios, configuración, reportes (uso interno) |
| Mantenimiento | `mantenimiento.html` | Pantalla de "en breve volveremos" cuando el backend no responde |

## 3. Paleta de color actual (design tokens, `style.css`)

```css
--color-bg:           #F6F4EF   /* fondo general, tono papel cálido */
--color-surface:      #FFFFFF   /* tarjetas, formularios */
--color-border:       #E3DFD4
--color-ink:          #21261F   /* texto principal, verde-negro */
--color-ink-soft:     #5B6158   /* texto secundario */
--color-accent:       #0F6E5D   /* verde esmeralda — acción principal */
--color-accent-dark:  #0B5548
--color-accent-soft:  #E4EFEC   /* fondos de estado "activo/éxito" */
--color-warn:         #B4530C   /* naranja quemado — estado pendiente */
--color-warn-soft:    #FBEBDC
--color-error:        #B3261E   /* rojo — estado cancelado/error */
--color-error-soft:   #FBEAE9
```

Estética: cálida, tipo "papel", profesional pero no corporativa fría. Verde esmeralda como color de marca/acción.

## 4. Tipografía

- **Display / títulos**: `Source Serif 4` (serif, con Georgia como fallback) — usada en encabezados de sección y títulos de tarjetas.
- **Cuerpo / UI**: `Inter` (sans-serif, con system fonts de respaldo) — usada en texto de formularios, tablas, botones.

Combinación serif+sans: da un tono editorial/confiable, no genérico de SaaS.

## 5. Componentes clave a diseñar

- Formulario de captura de datos fiscales (RFC, razón social, régimen, CP, etc.) con validación en línea.
- Dropzone / input de carga de archivo PDF con estado de progreso y feedback de validación (éxito / error de formato / error de contenido).
- Modal de confirmación de reemplazo (muestra datos previos: nombre, tipo de persona, RFC, nombre de archivo, fecha de última actualización).
- Stepper de 3 pasos (Datos → Archivo → Confirmación) con indicador de progreso.
- Tabla de solicitudes con badges de estatus: **pendiente** (naranja), **en curso** (verde suave), **cancelado** (rojo).
- Tarjetas de acceso directo (dashboard) tipo "tile" con hover.
- Barra de sesión / header con navegación entre dashboard, csf, tickets.
- Toggle de autoguardado con 3 estados visuales (guardando / guardado / error).
- Login/registro con RFC como identificador, botón mostrar/ocultar contraseña.
- Panel admin: tablas densas de datos, filtros, exportación de reportes.

## 6. Restricciones / lineamientos

- **Responsivo**: debe funcionar bien en móvil (proveedores subiendo su constancia desde el celular es un caso de uso real).
- **Accesible**: formularios claros, estados de error legibles, contraste adecuado (paleta ya pensada con soft-backgrounds para no depender solo del color).
- **Sin dependencias pesadas de frontend**: la implementación actual es HTML/CSS/JS vanilla (sin React/Vite) — el diseño debe poder traducirse a maquetación simple, sin patrones que requieran un framework de componentes.
- **Idioma**: todo el copy en español (México), terminología fiscal mexicana (RFC, régimen fiscal, SAT, CFDI).
- **Tono**: confiable y tranquilizador — el usuario está subiendo un documento fiscal sensible, no debe sentirse un trámite burocrático hostil.

## 7. Qué pedirle a Stitch

Generar (o mejorar) las pantallas de la lista de la sección 2, respetando la paleta y tipografía de las secciones 3-4, priorizando:
1. El flujo de carga de constancia (`csf.html`) — es el corazón de la app.
2. El dashboard con lista de solicitudes.
3. Login/registro.

Referencia de estilo: cálido tipo "papel" + acento verde esmeralda + serif para títulos — evitar el look genérico "SaaS azul/morado con Inter en todo".
