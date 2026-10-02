# Gobierno de funcionalidades por plan — propuesta visual (punto 347, Fase 2)

Guardado: 2026-09-30. Artifact original (no persistente) publicado en
conversación — este HTML es la copia de respaldo en repo.

- `propuesta-3-opciones.html`: mapa completo de menús/submenús/
  configuraciones del sitio base (admin + portal de clientes) + 3
  propuestas de UI para el editor de planes de /control:
  - **A** — barra lateral por categorías (mismo patrón que el modal
    Configuraciones del admin). Recomendada en la propuesta original.
  - **B** — matriz de funcionalidades (tabla densa, todo el árbol visible).
  - **C** — asistente por pasos (revelación progresiva: Datos básicos →
    Módulos → Funcionalidades dependientes → Resumen). **Elegida por el
    usuario el 2026-09-30.**

## Decisión de diseño

Opción **C (asistente por pasos)** aprobada para el editor de
planes de /control.

## Pendiente antes de implementar

3 preguntas abiertas de la propuesta original, aún sin confirmar:

1. ¿Ventas y Gastos van en una sola bandera (`ventas_y_gastos`) o
   separadas (`ventas` + `gastos`)? Las propuestas asumen separadas.
2. ¿Proveedores depende de Inventarios, de Gastos, o de cualquiera de
   los dos (visible si cualquiera está activo)? Propuesta: cualquiera.
3. ¿Finanzas (Resumen financiero + Reportes) necesita bandera propia, o
   se deriva sola cuando Ventas o Gastos está activo? Propuesta: se
   deriva sola, sin bandera nueva.

Si se retoma este trabajo más adelante y el diseño necesita cambiar,
partir de este archivo en vez de empezar de cero.

## Actualización 2026-09-30 (misma sesión) — prototipo funcional

Respuesta del usuario a las 3 preguntas: **todas bandera separada**
(`ventas`, `gastos`, `inventarios`, `auditoria`, cada una su propia
columna). Caso adicional que dio pie al catálogo de reglas: Resumen
financiero no se ve afectado por Facturación apagada (todo sería "sin
factura"), pero SÍ por Gastos y Cuentas por cobrar; Resumen financiero se
activa automático al prender Ventas o Gastos, y si se intenta activar sin
ninguno de los dos, debe bloquear con mensaje explicando por qué.

- `wizard-funcional-reglas.html`: catálogo de 9 reglas de dependencia
  (bloqueo / cascada / auto-activación / advertencia) + tabla de qué
  gráfica del Resumen financiero depende de qué módulo + el asistente de
  4 pasos (opción C) **funcional de verdad** (JS real, no mockup
  estático): toggles, bloqueos con mensaje, cascadas automáticas y toasts.

### Reglas confirmadas por el usuario
1. Resumen financiero sin Ventas ni Gastos → bloqueo con mensaje.
2. Ventas o Gastos se activa por primera vez → Resumen financiero se
   auto-activa (el admin lo puede apagar después).
3. Aviso de expiración de productos depende de Inventarios → cascada.
4. Proveedores visible automático si Inventarios o Gastos está activo
   (sin toggle propio).

### Reglas nuevas, derivadas por análisis — pendientes de confirmar
5. Se apagan Ventas y Gastos con Resumen financiero encendido → cascada
   hacia abajo (consecuencia directa de la regla 2).
6. Cuentas por cobrar depende de Ventas → cascada hacia abajo si Ventas
   se apaga.
7. Portal de clientes activado sin Facturación → **advertencia, no
   bloqueo** (el portal solo tiene 2 acciones hoy, ambas de Facturación,
   pero a futuro podría tener más). Confirmar si debe ser bloqueo total
   en vez de advertencia.
8. Editar un plan ya asignado a empresas reales → advertencia de impacto
   inmediato ("N empresas asignadas, los cambios aplican de inmediato").
   Requiere datos reales de tenants — no está en el prototipo visual, sí
   en la implementación final.
9. Bajar el máximo de usuarios por debajo de los usuarios activos reales
   de alguna empresa del plan → mismo caso que la regla 8, se valida en
   backend al guardar.

### Pendiente antes de implementar
Confirmación del usuario sobre el prototipo funcional y sobre las reglas
7-9 (especialmente la 7: ¿advertencia o bloqueo?).

## Actualización 2026-10-01 (misma sesión) — identidad de marca + regla 10

El usuario pidió mantener la identidad de marca real en las propuestas
(no una paleta genérica, aunque ya se usaban los tokens exactos de
`frontend/style.css`) y señaló que "Reportes" no estaba cubierto — en
particular el reporte "Estado del inventario".

- Se agregó el shell real del panel al prototipo funcional: sidebar
  navy (`#03285B`) + acento cian activo (`#05DBF2`) + logo real
  (`assets/logoDark.png`, copiado también a
  `stitch/gobierno-funcionalidades/assets/`), tomados tal cual de
  `frontend/admin.css`. El modal del asistente ahora flota como overlay
  real sobre una vista "Planes" simulada, igual que en producción.
- Se encontró que "Reportes" (`lectura-reportes`) no es un bloque único:
  tiene 4 pestañas (`frontend/admin.js`, `PESTANAS_REPORTES`) — "Por
  reporte", "Cortes", "Eliminados" (dependen de Ventas/Gastos, igual que
  el resto de Finanzas) y **"Estado del inventario"**, que depende de
  **Inventarios**, no de Ventas/Gastos. Si Inventarios está apagado, esa
  pestaña debe ocultarse aunque Reportes sea visible por otro lado.
- **Regla 10** (nueva): "Estado del inventario" se oculta sola si
  Inventarios está apagado — sin mensaje, igual que Proveedores. No
  necesita toggle nuevo, se resuelve con la bandera `inventarios` que ya
  existe.
- Aparte, de paso: se encontró un emoji real (⚠️) en
  `frontend/control.html` línea ~1208 (aviso sobre copiar la clave API),
  que viola la regla de "cero emojis" de CLAUDE.md. No se tocó — fuera
  de alcance de esta tarea, pendiente de corregir cuando se edite esa
  pantalla.

### Pendiente antes de implementar (actualizado)
Mismas reglas 7-9 de antes, más confirmar que la Regla 10 (y el patrón
"sub-pestaña con dependencia propia distinta del contenedor") está
completa — recomendable repasar Auditoría/Gastos/CxC una vez más antes
de dar por cerrado el mapa, por si hay un caso similar no detectado.

## Actualización 2026-10-01 (misma sesión) — paleta corregida + modal más grande

**Error corregido:** el prototipo usaba el verde `#0F6E5D` de
`frontend/style.css` como acento — ESE verde es exclusivo del portal de
cliente, nunca de `/admin` ni `/control`. La paleta real de ambos
paneles vive en `frontend/admin.css`, redefinida dentro de `.admin-body`:
`--color-accent:#03285B` (navy), `--color-accent-dark:#0B1320`,
`--color-accent-soft:#E7ECF3`, `--color-bg:#F8FAFC`,
`--color-ink:#0B1320`/`--color-ink-soft:#6B7280`,
`--color-border:#E5E7EB`. Se corrigió todo el prototipo a esta paleta y
se guardó como memoria persistente
(`feedback_paleta_admin_control_navy.md`) para que no se repita en
ninguna sesión futura.

## Actualización 2026-10-01 (misma sesión) — bug del modal en blanco + chips de categoría

El modal quedó en blanco tras la reestructura anterior: al separar
Reportes se borraron por accidente `var paso = 1; var TOTAL_PASOS = 4;`,
lo que tiraba un `ReferenceError` silencioso en el primer render y dejaba
`pc-steps`/`pc-body` vacíos. Corregido y verificado ejecutando el script
extraído con un stub de `document` en Node (recorre los 4 pasos y cada
combinación de toggles/checkboxes sin excepción) antes de republicar —
mismo tipo de prueba a repetir en cualquier edición futura del inline
`<script>` de este prototipo.

Pedido del usuario: "categoriza para saber de quién es la dependencia" —
se agregó un chip de color fijo por módulo de origen
(`.dep-chip-facturacion` gris, `.dep-chip-ventas` cian, `.dep-chip-gastos`
ámbar, `.dep-chip-inventarios` violeta) junto a CADA funcionalidad
dependiente (Cuentas por cobrar, Resumen financiero, Aviso de
expiración, Proveedores) y cada checkbox de Reportes, más una leyenda
fija arriba del paso 3. Mismo color en todo el asistente y en cualquier
implementación real futura — no reinventar la paleta por pantalla.

## Actualización 2026-10-01 (misma sesión) — Reportes independiente + checkboxes

Corrección del usuario: "Reportes" **no** va amarrado a "Resumen
financiero" (hasta ahora compartían una sola bandera `finanzas`) — son
cosas distintas. Además, pidió que las 4 pestañas reales de Reportes
(`PESTANAS_REPORTES` en admin.js) se vuelvan **checkboxes** propios en
el asistente, no un bloque auto-derivado, y que los que no aplican (ej.
"Estado del inventario" sin Inventarios) salgan **inhabilitados de
verdad** (atributo `disabled`), nunca solo bloqueados al dar clic.

- `estado.finanzas` se partió en `estado.resumenFinanciero` (sigue con
  sus reglas de auto-activación/bloqueo/cascada de antes, sin tocar) +
  `estado.reportes` (objeto con 4 claves: `porReporte`, `cortes`,
  `eliminados`, `estadoInventario`), cada una con su propia función
  `habilitado()` y mensaje "Requiere X".
- Nuevo catálogo `REPORTES_DEF` como única fuente de verdad (checkbox +
  caption + cascada usan lo mismo, no 3 copias del mismo dato).
- Dependencias revisadas con más cuidado que la primera pasada: "Por
  reporte" requiere Facturación O Ventas (no solo Ventas — muestra
  conteo de tickets también); "Cortes" requiere Ventas; "Eliminados"
  requiere Ventas O Gastos (no ambos); "Estado del inventario" requiere
  Inventarios.
- **Patrón generalizado**: Cuentas por cobrar, Resumen financiero y
  Aviso de expiración también pasaron de "bloqueo al dar clic" a
  "control con atributo `disabled` real" — mismo estándar que pidió
  para Reportes, aplicado de forma consistente a todo el paso 3.
- Regla 11 (nueva): un checkbox/switch inhabilitado por regla no es
  bloqueo ni cascada — es su propio tipo ("inhabilitado desde que
  carga"), sin toast, con el motivo a la vista en el propio control.

**Modal agrandado:** el usuario sintió el modal del asistente apretado.
Se amplió `.app-shell` (980px → 1240px, min-height 720px),
`.modal-mock` (520px → 760px), padding de `.pc-body` (18/20/20 →
28/28/24), tarjetas de módulo (grid de 2 columnas reales con más
padding), botones a 44px de alto (touch target AA), switches más
grandes (36x20 → 44x24) — siguiendo las guías de espaciado táctil de
`ui-ux-pro-max` (mínimo 44×44px, 8px+ de separación).

## Decisión final 2026-10-01 — reglas 7, 8 y 9 cerradas (punto 350)

Las 3 preguntas abiertas que quedaban desde la primera propuesta (ver
arriba, sección "Pendiente antes de implementar") quedan **resueltas y
confirmadas por el usuario**. Nada de esto está implementado todavía —
son decisiones de diseño para cuando arranque el código real.

### Regla 7 — Portal de clientes sin Facturación activa
**Decisión: advertencia, no bloqueo.** Ya era el comportamiento por
defecto del prototipo funcional (`wizard-funcional-reglas.html`) — se
confirma tal cual, sin cambios al prototipo. Mensaje: "Aviso: el portal
de clientes no mostrará nada útil sin Facturación activa." El admin
puede continuar; razón explícita del usuario: a futuro el portal puede
ganar secciones que no dependen de Facturación.

### Regla 8 — Editar un plan ya asignado a empresas reales
**Decisión: aviso ANTES de modificar, no solo al guardar.** Distinto a
las 2 opciones originales que se ofrecieron (aviso al guardar / doble
confirmación) — el usuario pidió específicamente que el aviso aparezca
**al abrir el editor** de un plan que ya tiene empresas asignadas, antes
de que el admin toque cualquier switch/checkbox, no como un paso extra
al final. Implicación de diseño: el modal "Editar plan" (a diferencia de
"Nuevo plan") necesita un banner fijo visible desde el paso 1 — algo
como "Este plan tiene N empresas asignadas — cualquier cambio que
guardes aplica de inmediato a todas ellas" — que se queda visible durante
los 4 pasos, no solo aparece como toast al final. No es parte del
prototipo visual actual (que solo modeló "Nuevo plan"); se agrega cuando
se construya el flujo real de "Editar plan".

### Regla 9 — Bajar el máximo de usuarios por debajo del uso real
**Decisión: se permite guardar, con suspensión automática y
dirigida — no bloqueo, no solo advertencia pasiva.** Comportamiento
exacto pedido por el usuario:

1. Al guardar un `max_usuarios` menor al número de usuarios activos que
   ya tiene alguna empresa en ese plan, el guardado **no se bloquea**.
2. Los usuarios con perfil **administrador siempre quedan activos** —
   nunca se suspenden automáticamente por este mecanismo, sin excepción.
3. Se suspenden usuarios **no-administradores**, uno por uno, hasta que
   la empresa quede dentro del nuevo límite.
4. **Criterio de orden de suspensión: los creados más recientemente
   primero** (`creado_en` descendente) — se conserva activa la base
   original de cuentas de la empresa, se suspende primero lo que se dio
   de alta después.
5. Cada usuario suspendido por este mecanismo queda marcado con un
   motivo explícito y visible ("suspendido por límite de usuarios del
   plan"), distinguible de una suspensión manual — tanto para el admin
   del tenant (sabe por qué ese usuario ya no puede entrar) como para
   cualquier auditoría futura.

**Implicaciones técnicas a resolver cuando se construya** (no decididas
todavía, quedan para la sesión de implementación):
- ¿Dónde vive el flag "suspendido por límite de usuarios"? Probablemente
  una razón/estado en la tabla de usuarios del tenant, no solo un booleano
  — para poder mostrar el motivo en la UI de Admin.
- ¿Qué pasa si luego se SUBE el límite otra vez? ¿Se reactivan solos los
  últimos suspendidos por este motivo (hasta el nuevo límite), o se queda
  manual? No preguntado todavía — abrir como pregunta al empezar esa
  pieza si no es obvio por el contexto en ese momento.
- Este mecanismo corre en el backend (al reasignar/editar el plan de un
  tenant, o al reducir `max_usuarios` de un plan ya asignado), no es
  parte del asistente de 4 pasos en sí — el asistente gobierna el
  CATÁLOGO de planes, esto es la consecuencia de ASIGNAR ese catálogo a
  una empresa real con datos reales.

### Estado tras esta decisión
Las 3 preguntas abiertas de `stitch/NOTAS.md` quedan cerradas. El
catálogo de reglas de dependencia pasa a **12 reglas** (11 del asistente
de 4 pasos + esta regla 9 de suspensión automática, que vive a nivel de
asignación de plan, no del catálogo). Nada implementado en código real
todavía — sigue pendiente la confirmación explícita del usuario para
empezar esa fase.
