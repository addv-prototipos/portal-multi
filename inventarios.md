# Inventarios — Propuesta funcional para Portal de Facturación ADDV

> **Estado:** Propuesto  
> **Módulo:** Inventarios  
> **Producto:** Portal de Facturación ADDV  
> **Objetivo:** incorporar un sistema de inventarios flexible, multi-tenant y adaptable a la mayoría de tipos de productos, reutilizando la arquitectura, actores, identidad visual, almacenamiento y reglas transversales existentes.

---

# 0. Alcance de la versión 1 y decisiones cerradas

> **Estado:** Acordadas con el dueño del producto (2026-08-23).  
> **Prevalencia:** esta sección manda sobre el resto del documento. Donde una sección aspiracional entre en conflicto con este corte de alcance, prevalece esta sección y la sección en cuestión queda asignada a su fase.

## 0.1 Principio rector del corte v1

La v1 entrega un **motor de existencias mínimo útil**: catálogo simple, un almacén, entradas, salidas, kardex e integridad numérica a prueba de concurrencia. Todo lo que no contribuya a ese núcleo se difiere de forma explícita (§0.3), sin que el esquema de BD cierre las puertas de las fases siguientes.

## 0.2 Decisiones cerradas

| # | Decisión | Justificación | Consecuencia |
|---|----------|---------------|--------------|
| D1 | La unidad mínima de catálogo en v1 es el **producto simple** con SKU propio. Sin variantes ni atributos configurables. | Las variantes obligan a repensar catálogo, imágenes, existencias y reportes al mismo tiempo; recortan ~30% de la Fase 1 original sin aportar al núcleo. | En v1 ninguna tabla referencia variantes. `producto_variantes`, `atributos`, `atributo_opciones` y `producto_atributos` (§47) no se crean todavía. |
| D2 | **Multi-almacén preparado, no operativo**: `almacen_id` NOT NULL en `existencias` y `movimientos_inventario` desde el día uno; `ensureSchema()` crea automáticamente "Almacén principal" (código `ALM-1`) por tenant. | Evita una migración dolorosa de claves compuestas más adelante; hoy el negocio real opera un solo punto físico. | La UI v1 muestra el almacén como contexto de solo lectura. El ABML de almacenes (§11) y las transferencias (§17) pasan a fase 2. |
| D3 | **Ubicaciones fuera de v1** (zona/pasillo/rack/nivel/posición). | Con un solo almacén no aportan valor operativo; su modelo jerárquico de 6 niveles es costoso de construir y de mantener. | Campo opcional `ubicacion_nota` VARCHAR(255) en movimientos para apuntar libremente dónde quedó la mercancía. El modelo completo (§12) pasa a fase 2. |
| D4 | **Inventario negativo prohibido** en v1. Toda salida valida `disponible >= cantidad` dentro de la misma transacción que genera el movimiento. | Vender existencia inexistente corrompe kardex y valorización; relajar la regla después es trivial, reparar datos históricos no. | Clave `inv_permitir_negativo` prevista en `inventario_config` pero fijada a `'0'` en v1 (sin UI para cambiarla). |
| D5 | **Costeo: promedio ponderado móvil**, recalculado al registrar cada entrada (`costo_unitario DECIMAL(12,2)` en cada movimiento). El producto conserva `costo_promedio` y `ultimo_costo`. | PEPS/FIFO exige control por lotes (fase 3); el promedio ponderado es correcto contablemente y no depende de ninguna otra pieza. | §32 queda limitado a promedio ponderado en v1. Margen = precio − costo promedio. Cambios manuales de costo auditados (ya cubre §37). |
| D6 | **Granularidad de existencia**: `existencias(producto_id, almacen_id)` UNIQUE. El saldo es **derivado** del libro append-only `movimientos_inventario`. | Una sola fuente de verdad auditable; los saldos son caché recomputable y jamás editables a mano (coherente con §55). | Se incluye un mecanismo de conciliación que recomputa saldos desde movimientos y reporta divergencias (se detalla en la sección de concurrencia, bloque 3). |
| D7 | **Roles v1: perfiles existentes únicamente** (administrador / fiscal / super). | Los roles nuevos (Operador de almacén, Compras) exigen cambios en `auth.js`, UI y auditoría; su valor real aparece cuando hay personal de bodega operando el sistema. | administrador = todo Inventarios; fiscal = sin acceso al módulo; super = soporte técnico con operaciones registradas en la auditoría del tenant. §3.4 y §3.5 pasan a fase 2. |
| D8 | **Integración con Ventas — CERRADA (por tenant)**: columna nullable `producto_id` sobre `ordenes_compra` + interruptor **por tenant** `inventario_activo` en Configuraciones globales del tenant. Con el switch **ACTIVO** en ese tenant: la captura de venta gana autocompletado de producto (nombre/SKU al ir escribiendo) y lectura por código de barras (escáner HID; si falla, captura manual del código); toda venta con producto genera su salida automática validando stock (D4). Con el switch **INACTIVO** en ese tenant: el módulo Inventarios se oculta por completo y Ventas opera exactamente como hoy (captura manual del concepto, sin búsqueda ni escáner). Detalle operativo en §22 (US-INV-025). | Una tabla de partidas rediseñaría un módulo de Ventas vivo en producción sin necesidad inmediata; el switch por tenant permite a cada empresa activar inventario cuando su migración esté lista, sin afectar a las demás. Decisión actualizada a pedido del dueño: **se activa/desactiva por tenant, no global**. | El flag vive en la tabla `configuracion` **por tenant** (clave `inventario_activo`, `0`/`1`, default `0`), coherente con el resto de `configuracion` por tenant. No requiere BD de control. Limitación honesta v1: venta de línea única (1 producto por venta); carrito multi-producto queda como evolución futura con partidas. **P1 (§0.6.1) cerrada 2026-08-24: B — línea única confirmada.** D8 se mantiene sin cambios; multi-línea con inventario activo queda diferida a Fase 2 (§0.4.1). |
| D9 | **El importador masivo entra en v1** (reescrito en §34): CSV/XLSX con wizard de mapeo de cabeceras; SKU duplicado **actualiza** el producto existente (upsert, conserva lo no mapeado); existencias iniciales viajan **en el mismo archivo** y generan entradas automáticas tipo "inventario inicial". | La migración desde el sistema actual del negocio es la razón de ser del módulo; dar de alta cientos/miles de SKUs a mano es inviable y anularía la v1. | Sustituye al antiguo "importador genérico" de esta misma sección; la entrada manual tipo "inventario inicial" sigue existiendo como alternativa para altas puntuales. |
| D10 | **Imágenes por tenant en 2 capas + 3 límites + pipeline obligatorio**: capa **control** `inventario_imagenes_habilitado` por empresa (gate maestro en `control_tenants.tenants`, `0`/`1`, default `0`, mismo patrón que Marca); capa **tenant** `inv_imagenes_activo` en `configuracion` por tenant (`0`/`1`, default `0`, solo visible/editable si gate control=`1`). 3 límites por tenant en `inventario_config`: `inv_imagen_max_mb` (5 MB por archivo), `inv_imagen_max_por_producto` (20 imgs), `inv_imagen_cuota_mb` (500 MB total disco variantes optimizadas). Pipeline servidor obligatorio: validar firma → redimensionar 1200px → WebP q80 → thumb 300×300 WebP → descartar original. Spec §6. | Una foto de celular pesa ~4 MB; sin procesamiento, 2000 SKUs saturan ~8 GB en MinIO. Pedido del dueño (2026-08-24): habilitar imágenes también por tenant + límite por archivo y por disco duro, no solo gate de control. | Gate control `0` → UI sin sección imágenes y API `INV_IMAGENES_DESHABILITADAS` aunque tenant diga `1`; cualquiera de los 3 límites excedido → `INV_IMAGEN_CUOTA_EXCEDIDA` (no deja subir hasta liberar). Solo se persisten variantes optimizadas, nunca el original. |
| D11 | **Catálogo de dos tipos**: campo `tipo` en productos — `producto` (físico, inventariable) y `servicio` (no inventariable: sin existencias, sin movimientos, sin kardex; sí aparece en catálogo, búsqueda y venta). Líquidos y gramaje NO requieren campos extra: cantidades `DECIMAL(12,3)` + unidades kg/g/L/ml + conversiones (§9) los cubren; venta por peso = captura decimal manual (báscula conectada = fase futura). | Cubrir la gran mayoría de negocios (productos, servicios, líquidos, gramaje) sin abrir variantes/lotes en v1; un servicio solo necesita no tocar stock. | Los servicios participan en ventas (§22) sin generar salida aunque el switch global esté activo; "ventas de servicios no afectan stock" (§49) se vuelve regla estructural del modelo. |

## 0.3 Alcance v1

**Entra en v1:**

1. Catálogo: productos simples con campo `tipo` (**producto físico o servicio**, decisión D11 — US-INV-001 reducido — sin campos de variante, lote, serie ni caducidad; `proveedor_principal` como texto libre sin FK porque aún no existe entidad proveedores), categorías (US-INV-009 sin imagen), unidades de medida con conversiones (US-INV-008) que cubren pieza, volumen (L/ml) y peso (kg/g) para líquidos y gramaje sin campos adicionales.
2. Imágenes: principal + galería por producto (US-INV-002/003) **solo para las empresas habilitadas desde `/control`** (decisión D10) y siempre con compresión/optimización obligatoria en el servidor. Imágenes de variantes (US-INV-004) y documentos (US-INV-005) quedan fuera.
3. Almacén único auto-provisionado (D2).
4. Existencias por producto×almacén (D6) con semántica simplificada: **física = disponible** en v1; reservada/bloqueada/cuarentena aparecen en fase 2 junto con reservas.
5. Entradas: compra, devolución de cliente, ajuste positivo e **inventario inicial** (indispensable para arrancar con stock real).
6. Salidas: venta (según D8), consumo interno, merma, daño, ajuste negativo.
7. Ajustes directos del administrador con motivo obligatorio y evidencia fotográfica opcional; el flujo de aprobación US-INV-021 es fase 2.
8. Kardex inmutable (US-INV-013). Folios de documento con el patrón del proyecto (`EN-000001`, `SA-000001`, `AJU-000001`, mismo `padStart(6,'0')` que `OC-`/`TK-`).
9. Parámetros mín./máx./punto de reorden por producto (§28 sin lead time ni sugerencia automática de compra).
10. Dashboard v1: solo KPIs respaldados por datos que v1 realmente produce — valor total del inventario, productos activos, unidades disponibles, bajo mínimo, sin existencia, sin movimiento, mermas del periodo. Cada gráfica de §4 entra solo cuando su dimensión exista.
11. Alertas en pantalla (badges/lista "bajo mínimo"); notificaciones email/WhatsApp (§39) fuera.
12. Exportación CSV únicamente; XLSX/PDF (§35) requieren decidir librerías nuevas y quedan fuera.
13. Auditoría automática de mutaciones vía el middleware existente (§37) y papelera soft-delete con `eliminado_en` (§38).
14. Importador masivo de migración CSV/XLSX con wizard de mapeo de cabeceras (decisión D9, especificación completa en §34, mejorado en la auditoría 2026-08-24: mapeo en 3 niveles de confianza, perfiles de mapeo guardados por tenant, plantilla descargable, presets de sistema origen): catálogo + existencias iniciales hacia el almacén `ALM-1`.
15. Página de ayuda con el diccionario de datos del módulo (§56, US-INV-026), misma fuente que el diccionario de sinónimos del importador.

**Fuera de v1 (explícito):** variantes, atributos configurables, ubicaciones, multi-almacén operativo y transferencias, lotes, series, caducidades, kits, reservas, conteos físicos, etiquetas y códigos QR generados, notificaciones por correo, clasificación ABC, sugerencias de compra, API pública.

## 0.4 Re-mapeo del roadmap

> **Leyenda de alcance:** **v1** entra en esta versión. **Fase 2** / **Fase 3-5** = fuera de v1 (ver §0.3). Prevalece esta sección sobre la descripción aspiracional de §53.

- **v1** — el motor mínimo descrito en §0.3.
- **Fase 2** — variantes + atributos configurables, multi-almacén operativo (ABML + transferencias), ubicaciones, reservas, conteos físicos, ajustes con aprobación, roles Operador de almacén y Compras, códigos de barras/QR y etiquetas.
- **Fase 3–5** — sin cambios respecto a §53, con la nota permanente de que el costeo avanzado (PEPS/FIFO) sigue dependiendo de lotes.

### 0.4.1 Resumen consolidado — todo lo diferido de v1, en una sola tabla

> Poda estructural (auditoría 2026-08-24): antes de esta tabla, cada feature diferida tenía su propia sección completa (campos, ejemplos, diagramas) mezclada entre las secciones v1, duplicando lo que esta tabla ya resume y arriesgando quedar desalineada (pasó con §15/§16, corregido en esta misma auditoría). Las secciones §7 a §41 quedan como **anexo breve** — 3-6 líneas cada una, con su US-INV-xxx y un señalamiento aquí — no como especificación completa; se desarrollan a detalle solo al iniciar la fase que les corresponde.

| Feature | Fase | Por qué se difiere |
|---|---|---|
| Atributos configurables (§7) | 2 | Depende de que existan variantes primero (D1) |
| Variantes (§8) | 2 | D1: recorta ~30% de la Fase 1 sin aportar al núcleo |
| Almacenes ABML + tipos (§11) | 2 | D2: hoy opera un solo punto físico, `ALM-1` basta |
| Ubicaciones (§12) | 2 | D3: sin valor con un solo almacén |
| Transferencias (§17) | 2 | Depende de multi-almacén operativo (§11) |
| Lotes (§18) | 3 | Costeo PEPS/FIFO y caducidad dependen de esto |
| Series (§19) | 3 | Solo aplica a electrónica/equipo, no al núcleo |
| Caducidades (§20) | 3 | Depende de lotes (§18) |
| Compras/proveedores como entidad (§21) | 2 | `proveedor_principal` texto libre cubre v1 (D1/§5) |
| Gastos↔Inventario trazable (§23) | 2 | Evita rediseñar Gastos sin necesidad inmediata |
| Devoluciones de cliente con flujo propio (§24) | 2 | v1 ya cubre devolución como tipo de entrada simple |
| Conteos físicos (§26) | 2 | Requiere ubicaciones/multi-almacén maduros primero |
| Ajustes con flujo de aprobación (§27) | 2 | v1 ya trae ajuste directo con motivo (§0.3:7); lo que se difiere es el flujo de estados borrador→aprobado |
| Códigos de barras — generación/QR/etiquetas (§29/§30) | 2 | v1 solo LEE código de barras existente (D8/§22), no lo genera |
| Kits y productos compuestos (§31) | 3 | Exige resolver descuento en cascada, no trivial |
| Reservas (§33) | 2 | Depende de checkout/pedidos con estado propio |
| Notificaciones email/WhatsApp (§39) | 2 | Canal ya existe en el proyecto; falta solo el disparador |
| Clasificación ABC (§41) | 2 | Requiere histórico de ventas/rotación acumulado |
| Roles Operador de almacén / Compras (§3.4/§3.5) | 2 | D7: solo valen cuando hay personal de bodega operando |
| Exportación XLSX/PDF (§35) | 2 | Requiere decidir librería nueva (fuera del núcleo) |
| Venta multi-línea con inventario activo (§22) | 2 | P1 cerrada 2026-08-24 = línea única en v1; tabla `venta_partidas` y descuento por línea quedan para cuando se reabra el diseño de Ventas |

## 0.5 Concurrencia, precisión numérica e integridad del libro

Reglas técnicas NO negociables para que el motor de existencias produzca datos confiables en producción. Aplican a TODAS las operaciones que alteran stock: entradas, salidas, ajustes, salidas por venta (D8) y el importador masivo (D9).

### A. Atomicidad del movimiento

Toda mutación de stock ejecuta en UNA transacción MySQL: `INSERT` del movimiento + `UPDATE` de existencias (+ documento asociado si aplica). Jamás pasos separados ni saldos editados fuera de este flujo.

### B. Anti-sobrevende con bloqueo de fila

El saldo jamás se decide con una lectura suelta: la transacción bloquea la fila de existencias antes de decidir.

```sql
BEGIN;
SELECT disponible FROM existencias
 WHERE producto_id = ? AND almacen_id = ?
   AND eliminado_en IS NULL
 FOR UPDATE;                       -- bloquea la fila
-- validar disponible >= cantidad  (D4: negativos prohibidos)
INSERT INTO movimientos_inventario (..., existencia_anterior, existencia_posterior);
UPDATE existencias SET disponible = disponible - ? WHERE ...;
COMMIT;
```

- Dos ventas simultáneas del último artículo: una confirma, la otra recibe `INV_STOCK_INSUFICIENTE` con la existencia real al momento del intento.
- `innodb_lock_wait_timeout` corto a nivel de sesión (~5 s): ante contención extrema responde `INV_CONCURRENCIA` (reintentable) — nunca cuelga la petición.

### C. Precisión decimal

| Magnitud | Tipo | Nota |
|---|---|---|
| Cantidades | `DECIMAL(12,3)` | piezas enteras y fracciones (kg, m², litros) |
| Montos (costo_unitario, precio) | `DECIMAL(12,2)` | convención del repo |
| Costo promedio | `DECIMAL(12,2)` | se recalcula por entrada; redondeo a 2 decimales solo al persistir |

- Prohibidos FLOAT/DOUBLE para cantidades o dinero.
- Las comparaciones de stock se hacen EN SQL dentro de la transacción; JS solo formatea para presentación.
- **Lock de `productos` en cada entrada (hallazgo de concurrencia, auditoría 2026-08-24)**: `costo_promedio` vive en `productos` (D5/§32), no en `existencias`. El bloqueo de fila del bloque B solo cubre `existencias` — dos entradas simultáneas del mismo producto pueden recalcular el promedio ponderado en paralelo y perder una de las dos actualizaciones (*lost update*, silencioso, sin error). Toda entrada agrega `SELECT costo_promedio FROM productos WHERE id=? FOR UPDATE` dentro de la MISMA transacción del bloque B, antes de recalcular.

### D. Invariantes del libro (append-only)

1. `movimientos_inventario` confirmado es inmutable: ningún flujo actualiza ni borra filas (coherente con §14 y §48).
2. Cada movimiento conserva `existencia_anterior` y `existencia_posterior`: el estado del inventario es reconstruible a cualquier fecha.
3. Invariante estructural garantizada por construcción: `posterior = anterior ± cantidad` se calcula dentro de la MISMA transacción del bloqueo — ninguna ruta de código puede romperla.

### E. Idempotencia en reintentos (hallazgo de seguridad, auditoría 2026-08-24)

El bloque B invita al cliente a reintentar tras `INV_CONCURRENCIA` ("reintentable"). Sin protección, un doble-click, un retry de red o un reintento automático del frontend duplica el movimiento (doble descuento/alta real, silencioso, sin error visible al usuario).

- Toda mutación de stock que se origina en una acción de usuario (venta con producto, entrada, salida, ajuste) viaja con un **`Idempotency-Key`** (UUID generado en el cliente al abrir el formulario, no al reenviar).
- El backend guarda `(tenant, idempotency_key)` con el resultado de la primera ejecución exitosa; una key repetida devuelve la MISMA respuesta guardada sin ejecutar de nuevo el movimiento — nunca `INV_IDEMPOTENCIA_DUPLICADA` como error duro al usuario, es una repetición transparente.
- TTL de la key: 24 h (suficiente para cualquier reintento razonable, evita crecer la tabla indefinidamente).
- Mismo mecanismo para el importador (D9): re-ejecutar `POST .../ejecutar` sobre una importación ya completada es no-op, no vuelve a correr las 500 filas del chunk.

### F. Conciliación saldos ↔ kardex

- Script `backend/scripts/verificar-inventario.js` (mismo patrón que `verificar-mysql.js`) + endpoint interno de administrador ("Verificar integridad" en la vista Inventarios).
- Recomputa cada saldo desde el libro y reporta divergencias: `(producto, almacén, saldo_cacheado, saldo_recalculado)`.
- Una divergencia se corrige ÚNICAMENTE con movimiento compensatorio `AJU-` generado por el administrador — nunca con `UPDATE` directo del saldo.
- Ejecución sugerida: bajo demanda y siempre después de una importación masiva (D9).

### G. Códigos de error nuevos

Mismo formato `{ error: 'CODIGO', mensaje }` del API existente:
`INV_STOCK_INSUFICIENTE`, `INV_PRODUCTO_NO_ENCONTRADO`, `INV_SKU_DUPLICADO`, `INV_UNIDAD_INVALIDA`, `INV_CONCURRENCIA`, `INV_IMPORTACION_EN_CURSO`, `INV_IMAGENES_DESHABILITADAS`, `INV_IMAGEN_CUOTA_EXCEDIDA`, `INV_IMAGEN_DIMENSION_INVALIDA`, `INV_IMAGEN_PROCESO_FALLIDO`, `INV_EXTRA_CLAVE_PROHIBIDA` (§34.4).

### H. Pruebas obligatorias (parte del DoD v1)

- Prueba de concurrencia: N escrituras simultáneas (`Promise.all`) sobre el mismo producto verifican saldo final exacto y cero sobregiro.
- Prueba de concurrencia sobre `costo_promedio`: N entradas simultáneas del mismo producto verifican que el promedio ponderado final es matemáticamente correcto (ver bloque C/§32 — detecta el *lost update* si el lock de `productos` falta).
- Prueba de idempotencia: reenviar la misma `Idempotency-Key` dos veces produce UN solo movimiento, misma respuesta ambas veces.
- Prueba de conciliación: fixture con un saldo corrupto a mano → el verificador lo detecta y reporta.

## 0.6 Configuración por tenant para Inventarios (D8)

La decisión D8 se resuelve **por tenant** (no global): cada empresa decide si su inventario está activo. Esta sección define el mecanismo.

### Dónde vive

- Clave `inventario_activo` en la tabla `configuracion` **por tenant** (misma tabla que `iva_porcentaje`, `zona_horaria`, etc.): `clave='inventario_activo'`, `valor='0'`/`'1'`.
- Default `'0'` (inactivo): hasta que la migración (importador D9) se haya ejecutado y revisado en ese tenant, no hay catálogo que descontar. Los datos ya capturados (productos, existencias, movimientos) quedan intactos aunque luego se desactive.
- No requiere BD de control ni sincronización entre tenants.

### Claves iniciales

| Clave | Valores | Default | Efecto |
|---|---|---|---|
| `inventario_activo` | `'1'` / `'0'` | `'0'` | D8 completo (§22): `1` activa Inventarios + autocompletado/barcode en Ventas y salidas automáticas; `0` oculta el módulo y deja Ventas manual |
| `inv_imagenes_activo` | `'1'` / `'0'` | `'0'` | D10 capa tenant: `1` habilita UI/API imágenes (solo si `inventario_imagenes_habilitado=1` en control); `0` oculta sección imágenes aunque el módulo esté activo |
| `inv_imagen_max_mb` | `1`–`20` | `'5'` | D10 límite por archivo (MB) — exceder → `INV_IMAGEN_CUOTA_EXCEDIDA` |
| `inv_imagen_max_por_producto` | `1`–`50` | `'20'` | D10 límite de imgs por producto (principal+galería) — exceder → `INV_IMAGEN_CUOTA_EXCEDIDA` |
| `inv_imagen_cuota_mb` | `100`–`5000` | `'500'` | D10 cuota total disco por tenant (MB, suma de variantes optimizadas en `inventarios/<slug>/productos/*`) — exceder → `INV_IMAGEN_CUOTA_EXCEDIDA` |

> **Matriz de habilitación imágenes (D10):** `control.inventario_imagenes_habilitado=0` → tenant no ve switch ni API ( `INV_IMAGENES_DESHABILITADAS` ), sin importar `inv_imagenes_activo`. Con `control=1`, el tenant edita `inv_imagenes_activo` en **Configuraciones globales** y los 3 límites son solo lectura para él (editables desde `/control`).

### Quién la edita

- **Escritura**: `administrador` del tenant (y `super` cuando opera como admin del tenant) desde **Configuraciones globales** del panel — switch `Inventario activo` con ayuda: *"Activa el módulo Inventarios para esta empresa. Con inventario activo, Ventas sugiere productos al escribir y por escáner; con inventario inactivo, la captura es manual como hoy."*
- `fiscal` no ve el switch ni el módulo (coherente con D7: fiscal sin acceso a Inventarios).
- `/control` no edita este flag (es decisión operativa del tenant, no de plataforma).

### Lectura y propagación

- El backend lee `inventario_activo` del tenant en cada request (vía `pool` del tenant, sin caché global). Un cambio surte efecto al siguiente request sin reinicio.
- Con valor `'0'`: sidebar sin `Inventarios`, API ` /api/admin/inventarios/*` responde `{error:'INV_MODULO_INACTIVO'}` (o `INV_INVENTARIO_INACTIVO`), y Ventas omite autocompletado/barcode y no genera salidas; los datos quedan para reactivación.
- Con valor `'1'`: sidebar muestra `Inventarios`, Ventas gana búsqueda al escribir + escáner, y cada venta con `producto_id` genera salida `SA-` validando `D4`.

### Auditoría

Cada cambio registra en `admin_auditoria` del tenant (mismo middleware que el resto de Configuraciones globales): usuario, IP, valor anterior/nuevo, fecha/hora.

### Regla de extensión

Toda necesidad futura de configuración debe declarar su alcance explícitamente (global vs por tenant) en este documento o en el de su módulo antes de implementarse. Este caso deja claro que **la regla por defecto es por tenant**; lo global es la excepción y debe justificarse (ej. credenciales API por tenant ya es la norma).

### 0.6.1 Decisiones v1 — CERRADAS (2026-08-24)

> Las 8 filas se cerraron con el dueño del producto el 2026-08-24, todas con la opción recomendada. Tabla conservada como registro de decisión; ya no bloquea implementación.

| # | Tema | Decisión cerrada |
|---|---|---|
| P1 | Venta multi-línea | **B — línea única en v1.** D8 se mantiene tal cual, sin reabrir. Multi-línea con inventario activo queda diferida a Fase 2 (agregada a §0.4.1). |
| P2 | Costo al archivar/reactivar | **A — congelar `costo_promedio` al archivar**, reanuda el promedio ponderado normal al reactivar. |
| P3 | Cuota imágenes D10 | **Confirmado: 500 MB/tenant · 20 imgs/producto · 5 MB/archivo** (defaults ya en §0.6). |
| P4 | Entradas/Salidas v1 | **Confirmada** la lista de §15/§16: Entradas = compra, devolución de cliente, inventario inicial, ajuste positivo. Salidas = venta, consumo interno, merma, ajuste negativo. |
| P5 | Visibilidad fiscal | Confirmado por dueño 2026-08-24: por tenant (ver §0.6). |
| P6 | Valor inventario en Resumen financiero | **B — solo Dashboard Inventarios** en v1; no se agrega KPI a Resumen financiero. |
| P7 | Almacén en importador | **Confirmado: `ALM-1` fijo, sin selector** en v1 (D2). |
| P8 | Categorías con imagen | **Confirmado: fuera de v1** (coherente con §0.3:1). |

<details><summary>Tabla original de opciones consideradas (referencia histórica)</summary>

| # | Tema | Estado actual en el doc | Opciones | Recomendación |
|---|---|---|---|---|
| P1 | Venta multi-línea | D8 (§0.2) fija 1 producto/venta como decisión **cerrada**; Ventas ya es multi-producto en UI (builder suma subtotales) — tensión real sin resolver, no cosmética | A) Multi-línea vía tabla `venta_partidas` nueva, descuenta cada línea en una sola transacción B) Mantener línea única (D8 tal cual, sin tocar el builder actual para inventario) | **Pendiente — bloqueante**: elegir A **reabre y sustituye D8 por completo** (cambia el modelo de datos de Ventas, no es un matiz de UI); no implementar §22/US-INV-025 hasta cerrar esta fila explícitamente con el dueño del producto. |
| P2 | Costo al archivar/reactivar | §32 promedio ponderado + §38 papelera | A) Congelar `costo_promedio` al archivar B) Recalcular al reactivar | **A** — congela, reanuda promedio al reactivar |
| P3 | Cuota imágenes D10 | Gate por empresa + compresión obligatoria | Definir `500 MB tenant` / `20 imgs prod` / `5 MB por archivo` | **500 MB / 20 / 5 MB** |
| P4 | Entradas/Salidas v1 | §0.3:5-6 dice 4+4 sin nombrarlas | Entradas: `compra, devolucion_cliente, inventario_inicial, ajuste+`; Salidas: `venta, consumo, merma, ajuste-` | Confirmar lista |
| P5 | Visibilidad fiscal | §0.6 switch por tenant `inventario_activo` | `fiscal` no ve Inventarios ni el switch; `administrador` **edita** el switch de su tenant en Configuraciones globales; `super` edita igual cuando opera el tenant | **Confirmado por dueño 2026-08-24: por tenant** — actualizar matriz si cambia |
| P6 | Valor inventario en Resumen financiero | §42 vs §50 | A) KPI nuevo en Resumen financiero (`Valor inmovilizado`) B) Solo Dashboard Inventarios | **B** en v1 — evita mezclar valorización con flujo caja |
| P7 | Almacén en importador | D2/D9 `ALM-1` hardcodeado | `existencia_inicial` siempre a `ALM-1` en v1 (sin selector) | Confirmar |
| P8 | Categorías con imagen | US-INV-009 dice imagen opcional vs §0.3:1 sin imagen | Fuera en v1 | Confirmar fuera |

</details>

## 0.7 Definición de Hecho (DoD) v1

Checklist obligatorio antes de dar v1 por hecho (además de `addv-web-app`: Analizar→Proponer→Confirmar→Implementar y `node --check`):

- [ ] `node --check` en todo `.js` tocado
- [ ] Jest backend **≥595** sin regresiones + suites nuevas: concurrencia `Promise.all` sobre mismo producto (cero sobregiro), importador (parseo/auto-match/upsert/chunks/permisos), `verificar-inventario` con saldo corrupto
- [ ] `verificar-mysql.js` + `verificar-inventario.js` contra MySQL real (incluye tenant nuevo con `ALM-1` auto-provisionado)
- [ ] Importador validado contra MinIO real: CSV y XLSX con cabeceras desordenadas (auto-mapeo ≥80%), columnas no mapeadas en `extra`, re-import sin duplicar stock, `errores.csv` coincidente
- [ ] Flujo Ventas→Inventario (D8) con switch por tenant `inventario_activo` `0/1` validado en navegador real (autocompletado + escáner/barcode, `INV_STOCK_INSUFICIENTE` bloquea venta, `D4`) — nombre de clave corregido en esta auditoría, antes decía `ventas_afectan_inventario` (nombre viejo previo a que D8 pasara de global a por-tenant)
- [ ] Auditoría `admin_auditoria` + `tenant_eventos` para `inventario_activo` y cada `EN-/SA-/AJU-`
- [ ] Revisión visual en `http://localhost:8088/admin` (desktop + móvil 390×844) sin regresión Resumen financiero/Ventas/Gastos, sin `console.error`
- [ ] Página de ayuda (§56, US-INV-026): tarjetas del diccionario cubren el 100% de campos mapeables del wizard (misma fuente, sin duplicar a mano), deep-link `?` desde el wizard probado, buscador y navegación por teclado validados
- [ ] `PROJECT_STATE.md` + `US.md` + `cmem.md` actualizados + rebuild `frontend` con `--force-recreate` verificado por HTTP

---

## 1. Contexto y objetivo

El Portal de Facturación ADDV ya cuenta con una arquitectura B2B multi-tenant, panel administrativo por perfiles, almacenamiento S3-compatible mediante MinIO, gestión de ventas, gastos, reportes, identidad visual por tenant y auditoría de mutaciones.

El módulo de Inventarios debe integrarse de forma nativa con esa arquitectura y evitar convertirse en un sistema aislado.

La propuesta debe permitir administrar inventario para negocios muy diferentes:

- Comercio minorista.
- Distribuidoras.
- Ferreterías.
- Refacciones.
- Alimentos y bebidas.
- Ropa y calzado.
- Electrónica.
- Papelería.
- Consumibles.
- Productos con variantes.
- Productos por peso, volumen, longitud o pieza.
- Productos con lote y caducidad.
- Productos serializados.
- Kits y paquetes.
- Productos compuestos.
- Inventario de activos, cuando aplique.

### Principio de diseño

El sistema no debe crear campos específicos para cada industria. Debe utilizar:

1. Catálogo base de productos.
2. Atributos configurables.
3. Variantes.
4. Unidades de medida y conversiones.
5. Almacenes y ubicaciones.
6. Reglas de control de inventario.
7. Movimientos inmutables.
8. Imágenes y archivos asociados.
9. Integración con ventas, compras y gastos.
10. Reportes y auditoría.

---

# 2. Integración con el sistema actual

## 2.1 Multi-tenant

Inventarios pertenece al tenant activo.

Toda consulta y mutación debe quedar aislada por tenant.

No se permite que:

- Un producto de un tenant sea visible en otro.
- Un movimiento de un tenant sea consultable desde otro.
- Una imagen pueda ser reutilizada mediante manipulación de URL.
- Un usuario pueda acceder a IDs pertenecientes a otro tenant.

La resolución del tenant debe seguir el mecanismo existente basado en slug y contexto de sesión.

## 2.2 Base de datos

Se mantiene el modelo existente:

- Node.js 20.
- Express 4.
- MySQL 8.
- SQL crudo con `mysql2/promise`.
- Sin ORM.
- Una BD por tenant.

El módulo debe utilizar migraciones idempotentes.

## 2.3 Almacenamiento

Reutilizar MinIO/S3-compatible para:

- Imágenes de productos.
- Imágenes de variantes.
- Fotografías de evidencia de inventarios.
- Documentos técnicos.
- Manuales.
- Etiquetas generadas, si se almacenan.
- Evidencias de ajustes.
- Evidencias de mermas.
- Archivos asociados a lotes/series, cuando aplique.

### Estructura recomendada

```text
inventarios/<tenant-slug>/
├── productos/
│   └── <producto-id>/
│       ├── principal/
│       ├── galeria/
│       ├── variantes/
│       │   └── <variante-id>/
│       └── documentos/
├── conteos/
│   └── <conteo-id>/
├── ajustes/
│   └── <ajuste-id>/
├── lotes/
│   └── <lote-id>/
└── activos/
    └── <activo-id>/
```

El backend debe generar las rutas; nunca confiar en rutas proporcionadas por el navegador.

---

# 3. Actores y permisos

## 3.1 Administrador

Puede:

- Ver inventarios.
- Crear productos.
- Editar productos.
- Administrar categorías.
- Administrar unidades.
- Administrar almacenes.
- Registrar entradas y salidas.
- Crear transferencias.
- Realizar conteos.
- Aprobar ajustes.
- Consultar costos.
- Consultar reportes.
- Configurar mínimos/máximos.
- Administrar proveedores relacionados con inventario.
- Cargar y administrar imágenes.
- Exportar información.

## 3.2 Fiscal

Por defecto no debe administrar inventarios financieros u operativos, salvo que se habilite explícitamente un permiso específico.

Puede conservar acceso a las áreas fiscales existentes sin exposición accidental del inventario.

## 3.3 Super

Acceso total de plataforma y configuración.

Puede consultar configuración técnica y tenant, pero las operaciones de inventario deben seguir registrándose dentro del tenant correspondiente.

## 3.4 Operador de almacén

Nuevo permiso/rol propuesto.

Puede:

- Consultar productos.
- Escanear códigos.
- Registrar entradas autorizadas.
- Registrar salidas autorizadas.
- Realizar transferencias operativas.
- Realizar conteos.
- Consultar existencias.
- Ver imágenes de productos.

No puede:

- Modificar costos sin permiso.
- Eliminar productos.
- Eliminar movimientos.
- Aprobar ajustes sensibles.

## 3.5 Compras

Nuevo permiso/rol propuesto.

Puede:

- Consultar inventario.
- Consultar mínimos.
- Crear solicitudes de compra.
- Crear órdenes de compra.
- Recibir mercancía.
- Consultar proveedores.
- Consultar costos según permiso.

---

# 4. Dashboard de inventarios — 1 (KPIs solo datos v1)

Nueva vista:

`/<slug>/admin/inventarios`

El dashboard debe mostrar información real de la BD.

## KPIs

- Valor total del inventario.
- Productos activos.
- Unidades disponibles.
- Productos bajo mínimo.
- Productos sin existencia.
- Productos reservados.
- Productos en tránsito.
- Productos próximos a caducar.
- Productos sin movimiento.
- Mermas del periodo.

## Gráficas

- Valor del inventario por categoría.
- Entradas vs salidas.
- Evolución del valor del inventario.
- Productos con mayor rotación.
- Productos de baja rotación.
- Top productos por unidades.
- Top productos por valor.
- Mermas por motivo.
- Existencias por almacén.

No mostrar gráficas cuando no exista suficiente información para respaldarlas.

---

# 5. Catálogo de productos — `v1` (Fase 2/3: variantes, lotes, series)

## US-INV-001 — Crear producto `v1`

> **Alcance v1 efectivo** (D1, D11, §0.3:1): producto simple con campo `tipo` (`producto`|`servicio`), sin variantes/lote/serie/caducidad. `proveedor_principal` texto libre sin FK.

Como **administrador**, quiero crear un producto, para poder controlarlo dentro del inventario.

### Campos v1 (efectivos)

| Campo | Obligatorio | Nota |
|---|---|---|
| nombre | sí | único no, pero validado no vacío |
| sku | sí | UNIQUE por tenant |
| codigo_barras | no | UNIQUE si se informa |
| categoria | no | configurable, sin imagen en v1 |
| unidad_base | sí | default `Pieza` si no se informa (`§34.3`) |
| tipo | sí | `producto` físico (inventariable) / `servicio` (no toca stock) — D11 |
| costo | no | `DECIMAL(12,2)`, alimenta promedio ponderado D5 |
| precio | no | `DECIMAL(12,2)` |
| stock_minimo / stock_maximo / punto_reorden | no | alertas §28 sin lead time v1 |
| estado | no | `activo`/`inactivo`/`archivado` (§38), default `activo` |
| proveedor_principal | no | texto libre, sin FK (entidad proveedores fase 2) |
| notas | no | texto libre |

### Criterios v1

- SKU único dentro del tenant; código de barras único cuando exista.
- Nombre obligatorio; unidad base obligatoria.
- Producto activo por defecto; `tipo=servicio` no genera existencias/movimientos/kardex.
- El backend valida todos los campos; no duplicidad lógica.

<details><summary>Anexo aspiracional — campos fuera de v1 (Fase 2/3)</summary>

- Código alternativo, Descripción corta/completa, Marca, Fabricante, Modelo, Subcategoría, Unidad de compra/venta, Stock de seguridad, Control de lote/serie/caducidad — se modelan en Fase 2/3 cuando existan variantes/lotes/series y entidad proveedores. No crear columnas en v1.

</details>

---

# 6. Imágenes y archivos de productos — 1 (principal+galería, D10) / Fase 2 (variantes, docs)

## US-INV-002 — Cargar imagen principal `v1`

Como **administrador**, quiero cargar una imagen principal del producto, para identificarlo visualmente en el catálogo y durante las operaciones.

### Formatos

- JPG / JPEG / PNG / WEBP — validar firma binaria (magic bytes)

### Pipeline servidor obligatorio (D10)

1. Validar gate `control`+tenant → si no, `INV_IMAGENES_DESHABILITADAS`.
2. Validar límites antes de procesar: `inv_imagen_max_mb` por archivo, `inv_imagen_max_por_producto` (¿cabe 1 más?), `inv_imagen_cuota_mb` (¿cabe estimado post-WebP?). Si excede → `INV_IMAGEN_CUOTA_EXCEDIDA` con `limite`/`actual`/`intentado`.
3. Redimensionar lado mayor a **1200px**, convertir a **WebP q80**, generar **miniatura 300×300** WebP, **descartar original** (solo variantes optimizadas).
4. Guardar `principal.webp` + `thumb_principal.webp` bajo `inventarios/<slug>/productos/<producto_id>/principal/` en MinIO.
5. Guardar metadata: nombre original, mime origen, tamaños, dimensiones, `subido_por`, `subido_en`.

### Límites de recursos del pipeline (hallazgo de seguridad, auditoría 2026-08-24)

Una imagen maliciosa (dimensión absurda tipo "bomba de descompresión", PNG/WebP crafteado) procesada en servidor puede tumbar el worker por memoria/CPU antes de llegar a los límites de §D10 (esos límites son de tamaño de archivo, no de dimensión ni de tiempo de proceso):

- Rechazar la imagen **antes de decodificar** si sus dimensiones declaradas (leídas del header, no decodificando el pixel completo) superan **8000×8000px** → `INV_IMAGEN_DIMENSION_INVALIDA`.
- Timeout duro de proceso por imagen (**10 s**); si se excede, aborta y responde `INV_IMAGEN_PROCESO_FALLIDO` (no deja el archivo a medio procesar en MinIO).
- El paso de redimensionar/convertir corre con límite de memoria del proceso hijo (mismo patrón que los child processes ya usados en `provisionar-tenant.js`), nunca en el proceso principal del backend.

### Reglas (límites por tenant D10)

- Por archivo: `inv_imagen_max_mb` (default `5` MB); por producto: `inv_imagen_max_por_producto` (default `20`); disco total: `inv_imagen_cuota_mb` (default `500` MB).
- Generar nombre seguro (uuid), no usar path original; permitir reemplazar/eliminar (libera cuota).
- Validar **firma binaria** (no solo extensión/`Content-Type`).

### UX

La pantalla debe permitir:

- Drag & drop.
- Selección de archivo.
- Vista previa inmediata.
- Indicador de progreso.
- Estado de carga.
- Error comprensible.
- Reintento.

---

## US-INV-003 — Galería de imágenes `v1`

Como **administrador**, quiero cargar varias imágenes del producto, para mostrar diferentes vistas del artículo.

La galería debe permitir:

- Agregar/Eliminar/Reordenar, Definir imagen principal, Vista ampliada, Miniaturas (`thumb_*.webp`), Drag & drop, Carga múltiple (mismo pipeline y mismos 3 límites por cada archivo; contador `X / inv_imagen_max_por_producto` visible). Ruta: `inventarios/<slug>/productos/<producto_id>/galeria/<uuid>.webp` + thumb.

---

## US-INV-004 — Imágenes de variantes

Como **administrador**, quiero asignar imágenes específicas a cada variante, para diferenciar visualmente productos como colores, tallas o modelos.

Ejemplo:

```text
Playera
├── Negra / S
├── Negra / M
├── Blanca / S
└── Blanca / M
```

Cada variante puede tener:

- Imagen principal.
- Galería.
- SKU propio.
- Código de barras propio.

---

## US-INV-005 — Documentos del producto

Permitir asociar:

- PDF.
- Fichas técnicas.
- Manuales.
- Garantías.
- Certificados.

Los documentos deben almacenarse en MinIO y estar protegidos por tenant.

---

# 7. Atributos configurables — Fase 2

## US-INV-006 — Crear atributos personalizados

Como **administrador**, quiero definir atributos propios (texto, número, moneda, fecha, booleano, selección única/múltiple, color), para adaptar el inventario a industrias distintas (talla/color en ropa, voltaje/potencia en electrónica, etc.) sin modificar código. Ver resumen y razón de diferimiento en §0.4.1.

---

# 8. Variantes — Fase 2

## US-INV-007 — Crear variantes

Como **administrador**, quiero crear variantes de un producto (SKU/código de barras/precio/costo/imagen propios por combinación de atributos, ej. Camisa Azul/M = `CAM-AZ-M`), para controlar inventario por combinación. Depende de que existan atributos (§7). Ver §0.4.1.

---

# 9. Unidades de medida — 1

## US-INV-008 — Administrar unidades

Unidades base:

- Pieza.
- Caja.
- Paquete.
- Bolsa.
- Kg.
- g.
- Litro.
- ml.
- Metro.
- cm.
- m².
- m³.
- Par.
- Juego.
- Rollo.
- Tarima.

## Conversiones

Ejemplo:

```text
1 caja = 12 piezas
1 tarima = 40 cajas
1 tarima = 480 piezas
```

El sistema debe permitir conversiones configurables.

---

# 10. Categorías — 1 (sin imagen)

## US-INV-009 — Administrar categorías

Permitir:

- Categorías.
- Subcategorías.
- Jerarquías.
- Estado activo/inactivo.
- Imagen de categoría opcional.

Las categorías deben ser reutilizables en filtros, reportes y dashboard.

---

# 11. Almacenes — Fase 2 (v1 solo ALM-1, D2)

## US-INV-010 — Administrar almacenes

Como **administrador**, quiero dar de alta múltiples almacenes (nombre, código, dirección, responsable, tipo: bodega/sucursal/centro de distribución/punto de venta/consignación), para operar más de un punto físico. v1 ya prepara la columna `almacen_id` en existencias/movimientos (D2) — solo falta el ABML y la UI de selección, que entran en Fase 2. Ver §0.4.1.

---

# 12. Ubicaciones — Fase 2

## US-INV-011 — Administrar ubicaciones

Como **administrador**, quiero una jerarquía Almacén→Zona→Pasillo→Rack→Nivel→Posición para saber exactamente dónde está cada producto dentro del almacén. Sin valor con un solo almacén (D3); v1 solo ofrece `ubicacion_nota` de texto libre en movimientos. Ver §0.4.1.

---

# 13. Existencias — 1 (física=disponible)

## US-INV-012 — Consultar existencia

Mostrar por producto:

- Física.
- Disponible.
- Reservada.
- Comprometida.
- En tránsito.
- Bloqueada.
- Cuarentena.
- Dañada.

### Regla

```text
Disponible =
Existencia física
− Reservada
− Bloqueada
```

La existencia no debe modificarse directamente.

Toda modificación debe generar un movimiento.

---

# 14. Kardex — 1

## US-INV-013 — Consultar Kardex

Como **administrador**, quiero consultar el historial completo de movimientos de un producto.

Cada movimiento:

- Fecha.
- Hora.
- Tipo.
- Documento origen.
- Usuario.
- Almacén.
- Ubicación.
- Cantidad.
- Costo.
- Existencia anterior.
- Existencia posterior.
- Motivo.
- Observaciones.

### Regla crítica

Los movimientos confirmados son inmutables.

No se eliminan.

Si existe un error, se genera un movimiento compensatorio.

---

# 15. Entradas — 1 (4 tipos: compra, devolución, inventario inicial, ajuste+)

> **Corrección (auditoría 2026-08-24)**: esta lista antes traía 7 tipos (incluía Producción, Traspaso recibido, Consignación) contradiciendo el encabezado "4 tipos" ya fijado por §0.3:5. Se poda a los 4 de v1; el resto queda en §0.4.1 (dependen de multi-almacén/transferencias, Fase 2).

Tipos v1: **Compra · Devolución de cliente · Inventario inicial · Ajuste positivo**.

Recepción v1: completa o parcial, con faltantes/sobrantes/daños registrados en `notas` del movimiento. Lotes/series/caducidad/ubicación estructurada quedan fuera de v1 (§0.3).

---

# 16. Salidas — 1 (4 tipos: venta D8, consumo, merma, ajuste-)

> **Corrección (auditoría 2026-08-24)**: esta lista antes traía 9 tipos (incluía Devolución a proveedor, Producción, Transferencia, Consignación) contradiciendo el encabezado "4 tipos" ya fijado por §0.3:6. Se poda a los 4 de v1; el resto queda en §0.4.1.

Tipos v1: **Venta (D8) · Consumo interno · Merma · Ajuste negativo**.

El sistema valida existencia disponible antes de permitir una salida (D4); inventario negativo queda deshabilitado en v1 sin UI para cambiarlo.

---

# 17. Transferencias — Fase 2

## US-INV-014 — Transferir inventario

Como **administrador**, quiero mover existencia entre almacenes (Solicitud→Autorización→Preparación→Enviado→En tránsito→Recibido, ej. Morelia→CDMX) registrando diferencias entre lo enviado y lo recibido. Depende de multi-almacén operativo (§11). Ver §0.4.1.

---

# 18. Lotes — Fase 3

## US-INV-015 — Control por lote

Como **administrador**, quiero marcar un producto "por lote" y capturar número de lote/fecha de fabricación/caducidad/proveedor/costo/cantidad por cada entrada, para trazabilidad de origen. Habilita costeo PEPS/FIFO y caducidades (§20). Ver §0.4.1.

---

# 19. Series — Fase 3

## US-INV-016 — Control serializado

Como **administrador**, quiero un número de serie único por unidad (equipo, maquinaria, electrónica) con historial completo Compra→Almacén→Transferencia→Venta→Cliente→Garantía→Devolución. Solo aplica a negocios con producto serializado, no al núcleo. Ver §0.4.1.

---

# 20. Caducidades — Fase 3

## US-INV-017 — Alertas de caducidad

Como **administrador**, quiero alertas configurables (180/90/60/30/15/7 días) con estados Vigente/Próximo a caducar/Caducado, filtrables y reportables. Depende de lotes (§18). Ver §0.4.1.

---

# 21. Compras — Fase 2

Como **administrador**, quiero un flujo Solicitud→Cotización→Orden de compra→Recepción→Inventario→Factura donde una recepción confirmada genera automáticamente los movimientos de entrada. v1 cubre la migración de catálogo (importador, §34) y el registro manual de entradas (§15); la entidad Proveedores y el flujo de compras completo quedan para cuando exista esa área en el proyecto. Ver §0.4.1.

---

# 22. Ventas — `v1` (US-INV-025, D8 por tenant)

> Reescrito tras actualizar D8 a **por tenant** (§0.2/§0.6); sustituye por completo la versión global anterior.

## US-INV-025 — Venta que descuenta inventario (por tenant)

Como **administrador**, quiero que **si el inventario de mi empresa está activo**, al registrar una venta con producto seleccionado se descargue automáticamente el inventario (búsqueda al escribir + escáner), y **si está inactivo**, la captura siga manual como hoy, para no mezclar flujos.

### Interruptor por tenant

- `inventario_activo` (`0`/`1`, default `0`) en **Configuraciones globales del tenant** (§0.6, tabla `configuracion` por tenant).
- **ACTIVO (`1`) en este tenant** → flujo descrito abajo; el módulo Inventarios visible solo en este tenant.
- **INACTIVO (`0`) en este tenant** → el módulo Inventarios se oculta por completo (sidebar y API `INV_MODULO_INACTIVO`) y Ventas opera exactamente como existe hoy (captura manual del concepto, sin búsqueda ni escáner). Los datos ya capturados se conservan intactos para cuando se reactive. Otros tenants no se ven afectados.

### Captura de producto en Ventas (solo con inventario activo)

- Campo opcional de producto con **autocompletado mientras se escribe** (nombre o SKU): sugerencias con miniatura, existencia disponible y precio sugerido tomado del producto. **Solo si `inventario_activo=1`; si `0`, el campo no existe y la venta es manual.**
- **Lectura por código de barras** (solo con inventario activo): un escáner HID teclea el código + Enter → búsqueda por `codigo_barras`/SKU que llena el campo. Si la lectura falla o el código no existe, el código se puede escribir manualmente. **Con inventario inactivo, el escáner no hace nada (no hay catálogo que buscar).**
- Cantidad con default 1; valida `disponible >= cantidad` ANTES de registrar (D4 prohíbe negativos) — **solo cuando hay producto seleccionado y el módulo está activo**.

### Al guardar la venta

Transacción única:

```text
INSERT venta (con producto_id)
→ Salida SA-xxxxxx tipo 'venta' + movimiento + kardex
→ Saldo ALM-1 actualizado
```

Si la validación de stock falla, la venta NO se registra.

### Reglas v1

- La venta mantiene línea única: 1 producto por venta, cantidad libre del mismo concepto. Carrito multi-producto = evolución futura con tabla de partidas.
- Eliminar/anular una venta con producto genera movimiento compensatorio de reingreso; los movimientos nunca se borran (§14).

---

# 23. Gastos — Fase 2 (nota trazabilidad)

Los gastos existentes (módulo Gastos ya en producción) no deben convertirse automáticamente en inventario. Cuando exista una compra de mercancía formal (proveedor/orden de compra/recepción/factura), esa relación con el movimiento de inventario debe quedar trazable. v1 no toca el módulo Gastos. Ver §0.4.1.

---

# 24. Devoluciones — Fase 2

## US-INV-018 — Devolución de cliente

Como **administrador**, quiero registrar una devolución ligada a la venta original (producto, cantidad, motivo, condición, evidencia) y decidir su destino (reingresar a inventario / cuarentena / reparación / desecho). v1 cubre devolución solo como tipo de entrada simple (§15), sin este flujo de decisión por condición. Ver §0.4.1.

---

# 25. Mermas y daños — 1 (salida merma v1)

## US-INV-019 — Registrar merma

Campos:

- Producto.
- Cantidad.
- Almacén.
- Ubicación.
- Motivo.
- Evidencia.
- Usuario.
- Fecha.
- Observaciones.

Motivos:

- Daño.
- Robo.
- Caducidad.
- Error.
- Pérdida.
- Destrucción.
- Otro.

Permitir cargar fotografías como evidencia. **La evidencia fotográfica reutiliza el mismo pipeline y los mismos 3 límites de D10/§6** (firma binaria, redimensión, WebP, cuota por tenant) — no es un flujo de carga aparte; sin esto, "evidencia" sería una vía para subir archivos sin cuota ni compresión, hallazgo de la auditoría 2026-08-24.

---

# 26. Conteos físicos — Fase 2

## US-INV-020 — Crear conteo

Como **administrador**, quiero conteos físicos (general/cíclico/por categoría/por almacén/por ubicación) en modalidad ciega (el operador no ve la existencia teórica antes de contar) que comparen sistema vs. conteo y generen una propuesta de ajuste con la diferencia. Depende de ubicaciones/multi-almacén maduros (§11/§12). Ver §0.4.1.

---

# 27. Ajustes — 1 simple (Fase 2: aprobación)

## US-INV-021 — Aprobar ajuste

Los ajustes sensibles deben requerir autorización.

Estados:

- Borrador.
- Pendiente.
- Aprobado.
- Rechazado.
- Aplicado.

Debe conservar:

- Usuario creador.
- Usuario aprobador.
- Fecha.
- Motivo.
- Evidencia.
- Diferencia.
- Movimiento generado.

**Evidencia fotográfica del ajuste**: mismo pipeline y mismos 3 límites de D10/§6 que producto y mermas (§25) — regla única, sin excepción por tipo de evidencia.

---

# 28. Inventario mínimo y abastecimiento — 1 (sin lead time/sugerencia auto)

Por producto:

- Mínimo.
- Máximo.
- Punto de reorden.
- Seguridad.
- Lead time.

Alertas:

```text
Existencia <= punto de reorden
→ Producto necesita reposición
```

El sistema puede sugerir cantidad:

```text
Cantidad sugerida =
Stock máximo − existencia disponible − unidades en tránsito
```

La sugerencia no crea una compra automáticamente salvo configuración explícita.

---

# 29. Códigos de barras y QR — Fase 2

Generación de código interno/QR propio y su uso en entrada/salida/conteo/transferencia/recepción. **v1 ya LEE código de barras existente del producto** (escáner HID en Ventas, D8/§22) — lo que se difiere es que el sistema GENERE códigos/QR nuevos. Ver §0.4.1.

---

# 30. Etiquetas — Fase 2

Generación de etiquetas imprimibles con logo del tenant, nombre, SKU, código de barras/QR, precio, lote/caducidad/serie/ubicación cuando apliquen, con plantilla configurable. Depende de §29 y de que existan lotes/series/ubicaciones. Ver §0.4.1.

---

# 31. Kits y productos compuestos — Fase 3

## US-INV-022 — Crear kit

Como **administrador**, quiero armar kits (ej. "Kit computadora" = 1 laptop + 1 mouse + 1 teclado + 1 mochila, fijo o variable) donde la venta descuenta automáticamente cada componente. Exige resolver el descuento en cascada, no trivial sobre el motor de existencias v1. Ver §0.4.1.

---

# 32. Costos y valorización — 1 (promedio ponderado)

Métodos configurables:

- Promedio ponderado.
- PEPS/FIFO.
- Costo estándar.

Conservar:

- Último costo.
- Costo promedio.
- Costo histórico.
- Precio de venta.
- Margen.

Los cambios de costo deben quedar auditados.

**Concurrencia (ver §0.5.C)**: recalcular `costo_promedio` exige bloquear la fila de `productos` (`FOR UPDATE`) en la misma transacción que registra la entrada — no es opcional, evita perder actualizaciones cuando dos entradas del mismo producto llegan al mismo tiempo.

---

# 33. Reservas — Fase 2

## US-INV-023 — Reservar inventario

Como **administrador**, quiero que una venta/pedido pueda reservar producto (estados Disponible/Reservado/Liberado/Consumido) sin descontar físicamente la existencia hasta confirmar la salida. Depende de un flujo de pedido/checkout con estado propio que v1 no tiene (D6: v1 solo distingue física=disponible, §13). Ver §0.4.1.

---

# 34. Importación masiva — migración desde otro sistema

## US-INV-024 — Importar catálogo desde CSV/XLSX

Como **administrador**, quiero importar mi catálogo desde un archivo exportado de otro sistema, para poblar el inventario sin captura manual y conservar los datos que el sistema aún no tiene campo para guardar.

> **Estado en v1:** entra al alcance v1 (decisión D9 de §0.2). Es el mecanismo primario de migración; la entrada manual tipo "inventario inicial" (§15) queda como alternativa para altas puntuales.

### 34.1 Formatos y límites

- **CSV**: delimitador autodetectado entre `,` `;` tabulador `|` (por conteo fuera de comillas en la fila de encabezados), comillas dobles según RFC 4180. Encoding: se intenta UTF-8 estricto; si aparecen caracteres de reemplazo, se reintenta como Latin-1 (el wizard informa cuál se usó).
- **XLSX**: primera hoja por defecto; selector de hoja si el libro tiene varias. No se aceptan `.xls` legacy ni `.xlsm` con macros.
- **Fila de encabezados**: detectada automáticamente (fila 1); seleccionable si el archivo trae títulos/logos decorativos arriba.
- **Límites configurables por tenant** en `inventario_config`: `inv_import_max_mb` (default `5`, alineado al límite global del backend) y `inv_import_max_filas` (default `10,000`). Excederlos produce error claro ANTES de procesar.
- Dependencias nuevas (puras JS, sin compilación nativa en Alpine): parser XLSX (**exceljs**, recomendado por mantenimiento activo) y CSV (**csv-parse**). Decisión técnica final pendiente de confirmar al implementar.

### 34.2 Flujo en wizard (6 pasos)

```text
1 Subir archivo → 2 Hoja y vista previa → 3 Mapear cabeceras
→ 4 Validación → 5 Ejecutar importación → 6 Resultado
```

Reglas transversales del wizard:

- Pasos visibles con indicador de progreso; siempre cancelable; volver atrás no pierde lo capturado.
- Confirmación explícita antes del paso 5 ("Se importarán X productos nuevos y se actualizarán Y existentes").
- Accesibilidad: todo operable por teclado, focus management entre pasos, `aria-live="polite"` para progreso y errores, textos en español consistentes con el panel.
- El mapeo se recomienda en desktop/tablet horizontal; en móvil (<768px) el paso 3 muestra aviso recomendando continuar en pantalla grande.
- El preset de sistema origen (34.3.3) y el enlace a la plantilla descargable (34.3.4) viven dentro del **paso 1** (junto al botón de subir archivo) — no agregan un paso nuevo al wizard, siguen siendo 6 pasos. El perfil de mapeo guardado (34.3.2), si la firma de cabeceras calza, se aplica automáticamente al entrar al **paso 3**.

### 34.3 Paso 3 — Mapeo de cabeceras (mejorado, auditoría 2026-08-24)

El backend normaliza cada cabecera del archivo (minúsculas, sin acentos, recorte de espacios, `_`/`-`/espacio equivalentes) y propone automáticamente una columna destino en 3 niveles de confianza, de mayor a menor:

1. **Coincidencia exacta** contra el nombre de campo del sistema (`sku`, `sku`) → confianza alta, badge verde "Exacto".
2. **Diccionario de sinónimos** (tabla de abajo, ampliada) → confianza alta, badge verde "Reconocido".
3. **Coincidencia difusa** (distancia de Levenshtein normalizada, umbral ≥ 80% de similitud contra el nombre de campo o cualquiera de sus sinónimos — ej. `"Descripcion del Producto"` ≈ `descripcion` ≈ `nombre`) → confianza media, badge ámbar "Sugerido, revisa" — nunca se auto-confirma silenciosamente, siempre pide que el usuario la vea antes de continuar.

Sin coincidencia en los 3 niveles: columna sin asignar, mapeo manual por el usuario (badge gris "Sin mapear").

Campos mapeables v1 — diccionario de sinónimos ampliado (cubre exportaciones típicas de Excel genérico, CONTPAQi, Aspel SAE/COI, Bind ERP, Odoo y nombres en inglés; no es una lista cerrada, el fuzzy match de nivel 3 cubre variantes no listadas):

| Campo sistema | Obligatorio | Sinónimos para auto-match |
|---|---|---|
| sku | sí | sku, codigo, clave, cve, codigo_producto, codigo_articulo, clave_producto, clave_articulo, id_producto, product_code, product_sku, código de producto |
| nombre | sí | nombre, descripcion, producto, articulo, concepto, nombre_producto, descripcion_producto, product_name, item, item_name, nombre_articulo |
| codigo_barras | no | codigo_barras, barcode, ean, upc, gtin, cod_barras, código_de_barras, ean13 |
| descripcion_corta / descripcion_larga | no | descripcion_corta, resumen, subtitulo / descripcion_larga, detalle, notas_comerciales, descripcion_completa, ficha |
| marca / fabricante / modelo | no | marca, brand, marca_producto / fabricante, manufacturer, maker / modelo, model, referencia |
| categoria | no | categoria, familia, linea, rubro, grupo, category, departamento, clasificacion |
| unidad_base | sí* | unidad, unidad_medida, um, u_m, presentacion, unit, uom (*default Pieza si viene vacía) |
| tipo | no | tipo, tipo_producto, tipo_articulo, es_servicio (valores producto/servicio; default producto) |
| costo / precio | no | costo, cost, ultimo_costo, costo_unitario, precio_compra / precio, pvp, precio_venta, precio1, price, precio_publico |
| stock_minimo / stock_maximo / punto_reorden | no | minimo, min, stock_min, existencia_minima / maximo, max, stock_max, existencia_maxima / reorden, punto_reorden, punto_de_reorden |
| proveedor_principal | no | proveedor, distribuidor, supplier, vendor (texto libre, sin FK) |
| existencia_inicial | no | existencia, stock, cantidad, inventario, existencias, existencia_actual, cant_disponible, qty, quantity |
| estado | no | estado, estatus, activo, status (valores "activo/inactivo"; default activo) |
| notas | no | notas, observaciones, comentario, comments, nota |

Reglas de la interfaz de mapeo (patrón estándar de importadores):

1. Un campo del sistema recibe a lo más UNA columna; asignar una columna ya usada muestra conflicto inline y desasigna la anterior.
2. Debajo de cada selector se previsualizan las primeras 5 filas no vacías de esa columna — el usuario valida a simple vista que mapeó bien.
3. Contador de cobertura visible: "Obligatorios cubiertos: 2/2 · Opcionales: 9/14".
4. Las columnas NO mapeadas no se descartan: van al campo `extra` (§34.4) si la casilla "Conservar columnas no mapeadas como datos extra" está activa (default activa).
5. Cada sugerencia muestra su badge de confianza (Exacto/Reconocido/Sugerido); pasar el mouse o enfocar con teclado explica por qué se sugirió ("coincide con el sinónimo 'articulo'").

### 34.3.1 Regla inicial de compatibilidad — hacer el mapeo predecible, no adivinado

Para que el resultado del mapeo sea **consistente y auditable** (dos importaciones del mismo tipo de archivo deben mapear igual, sin sorpresas), el motor aplica siempre este orden de prioridad y nunca lo invierte:

```text
1) Perfil de mapeo guardado del tenant (34.3.2) — si la firma de cabeceras coincide, se aplica automático
2) Preset de sistema origen elegido por el usuario (34.3.3) — si lo seleccionó en el paso 1
3) Coincidencia exacta de nombre de campo
4) Diccionario de sinónimos
5) Coincidencia difusa (Levenshtein ≥80%)
6) Sin mapear (manual)
```

Un campo **obligatorio** (`sku`, `nombre`, `unidad_base`) nunca se auto-asigna con confianza "Sugerido" (nivel 5): siempre pide confirmación explícita del usuario antes de continuar al paso 4, aunque el resto de campos opcionales sí se acepten automáticamente. Esto evita que un fuzzy-match equivocado en el campo llave (`sku`) corrompa silenciosamente cientos de filas.

### 34.3.2 Perfil de mapeo guardado por tenant (mejora UX, auditoría 2026-08-24)

La migración inicial no es la única vez que un tenant importa: negocios que ya usan otro sistema en paralelo (o hacen altas masivas periódicas) reexportan el MISMO formato una y otra vez. Remapear a mano cada mes es fricción evitable.

- Al completar el paso 3 con éxito, el wizard ofrece "Guardar este mapeo para la próxima vez" (checkbox, default activado).
- Se guarda `inv_perfiles_mapeo` (tenant, nombre del perfil, firma de cabeceras normalizada — hash del set ordenado de cabeceras del archivo —, mapeo JSON, creado_por, creado_en, usado_por_ultima_vez).
- En una importación futura, si la firma de cabeceras del archivo nuevo coincide con un perfil guardado, el paso 3 llega **pre-mapeado al 100%** con un aviso "Se aplicó tu perfil «Exportación mensual Aspel» — revisa y continúa" — el usuario sigue pudiendo editar, nunca se ejecuta sin pasar por el paso 4 de validación.
- Firma de cabeceras ligeramente distinta (una columna de más/menos) → coincidencia parcial, se pre-mapean solo las cabeceras que sí calzan, el resto sigue el flujo normal (34.3.1).
- Gestión de perfiles: lista simple en Configuraciones del módulo (nombre, fecha, cuántas veces usado, eliminar).

### 34.3.3 Preset de sistema origen (opcional, acelera el primer mapeo)

Antes del paso 3, un selector opcional "¿De qué sistema exportaste este archivo?" con presets: **CONTPAQi**, **Aspel SAE/COI**, **Excel genérico / plantilla ADDV** (34.3.4), **Otro / no sé**. Elegir un preset distinto de "Otro" reordena el diccionario de sinónimos (34.3) priorizando los nombres de columna típicos de ese sistema, subiendo la tasa de auto-match inicial antes incluso de correr el fuzzy match. Es una ayuda de arranque, no una regla nueva: si el preset no calza, el flujo normal (exacto → sinónimo → difuso) sigue aplicando igual.

### 34.3.4 Plantilla descargable — la forma más rápida de llegar a 100% de mapeo

Junto al botón de subir archivo (paso 1), un enlace **"Descargar plantilla (CSV / XLSX)"**: archivo pre-formateado con las cabeceras EXACTAS del sistema (columna por columna, en el mismo orden de la tabla de 34.3), 2 filas de ejemplo con datos ficticios válidos, y comentarios/validación de celda en la versión XLSX indicando formato esperado por columna (ej. `unidad_base`: lista desplegable con las unidades de §9). Un tenant que llena la plantilla directamente llega al paso 3 con **mapeo exacto al 100%**, sin necesidad de sinónimos ni fuzzy match — es la ruta recomendada para catálogos nuevos capturados a mano; los presets de 34.3.3 son para quien ya tiene el archivo exportado de otro sistema y no puede recapturar.

### 34.4 Campo `extra` — nada de la migración se pierde

- Toda columna no mapeada se persiste por producto en `productos.extra` (columna JSON, MySQL 8) bajo su cabecera original normalizada.
- En el detalle del producto se muestra como sección colapsable "Datos migrados (extra)", editable como JSON con validación sintáctica.
- El contenido de `extra` jamás participa en lógica de negocio, validaciones ni reportes: es dato conservado para consulta y futura promoción a campo formal.
- **Guardia contra prototype pollution (hallazgo de seguridad, auditoría 2026-08-24)**: las cabeceras del archivo del cliente se vuelven claves de un objeto JSON que luego se lee/edita en JS. Una cabecera literal `__proto__`, `constructor` o `prototype` es un vector real si algún flujo posterior mezcla ese JSON con `Object.assign`/spread sin filtrar. Al normalizar cabeceras (paso 3) se **rechazan** esas 3 claves antes de escribir en `extra` → error `INV_EXTRA_CLAVE_PROHIBIDA` en el reporte de validación (fila afectada, no aborta todo el archivo en modo tolerante).

### 34.5 Paso 4 — Validación completa

- El backend valida TODAS las filas antes de importar nada: SKU vacío, SKUs duplicados dentro del archivo, unidad desconocida (no se crean unidades implícitas), número inválido, existencia inicial negativa, categoría vacía, nombre vacío.
- Errores por fila/columna/valor/motivo, visibles en tabla y descargables como `errores-importacion.csv`.
- **Modo tolerante** (default, casilla visible): importa solo filas válidas y reporta las omitidas. **Modo estricto**: un solo error aborta toda la operación.
- Números tolerantes: punto decimal estándar; si la celda usa coma decimal (sin punto), se interpreta como decimal; separadores de miles se detectan por patrón y la interpretación usada queda anotada en el reporte.

### 34.6 Duplicados contra el catálogo — upsert (decisión D9)

- Si el SKU existe: **actualizar** únicamente los campos mapeados cuyo valor en el archivo NO venga vacío (un vacío nunca borra dato existente); casilla opcional "Sobrescribir también con valores vacíos", default desactivada.
- Si el SKU existe Y trae `existencia_inicial` Y ya tiene movimientos: la existencia se ignora y se reporta en el log (impide duplicar un inventario inicial en una re-importación).
- Nunca se eliminan ni desactivan productos por ausencia en el archivo.

### 34.7 Existencias iniciales en el mismo archivo

Si la fila trae `existencia_inicial > 0`, la importación genera transaccionalmente:

```text
Producto creado/actualizado
→ Entrada EN-xxxxxx tipo 'inventario inicial' (almacén ALM-1)
   costo_unitario = costo de la fila (0 si viene vacío)
→ Movimiento + saldo de existencias actualizado
→ Kardex refleja toda la migración
```

Un fallo de la fila revierte SU producto Y SU entrada juntos (transacción por fila dentro del chunk).

### 34.8 Procesamiento y rendimiento

- ≤ 500 filas: procesamiento síncrono dentro de la petición.
- \> 500 filas: job asíncrono en chunks de 500 filas (cada chunk = 1 transacción independiente), barra de progreso vía polling de `GET /importaciones/:id` cada 2 s.
- La idempotencia por SKU (upsert + regla anti-doble-stock-inicial) permite reintentar de forma segura tras un fallo parcial.

### 34.9 Seguridad, almacenamiento y auditoría

- Validación de firma binaria obligatoria (XLSX = magic bytes `PK\x03\x04`; CSV = texto válido UTF-8/Latin-1). Nunca confiar en la extensión.
- El archivo original se archiva en MinIO bajo `inventarios/<slug>/imports/<importacion-id>/original.<ext>` (extiende la estructura de §2.3) para auditoría y reprocesamiento; protegido por tenant igual que cualquier objeto. **Retención (hallazgo de auditoría 2026-08-24, gap sin definir en la versión anterior del doc)**: el archivo original puede traer columnas/datos de otro sistema del cliente sin filtrar — no se conserva indefinidamente. Retención **365 días** (mismo criterio que el resto de retención de archivos del proyecto, punto 134 de `PROJECT_STATE.md`), borrado automático tras ese plazo; la importación en sí (`imp_importaciones`/`imp_importacion_errores`) permanece como registro histórico aunque el archivo original ya se haya purgado.
- Tabla `imp_importaciones` registra: usuario, formato, nombre original, key MinIO, hoja, fila de encabezados, mapeo aplicado (JSON), modo de errores y duplicados, contadores (total/ok/error), estado (`validando → validado → ejecutando → completada`, o `error_validacion/error`) y progreso %.
- `imp_importacion_errores` conserva cada rechazo (importación, fila, columna, valor, motivo) — respalda el CSV descargable y la consulta histórica.
- Auditoría global: la acción `IMPORTACION_MASIVA` registra quién, cuándo, IP e id de importación; cada producto creado/actualizado hereda la auditoría estándar de mutación.
- Rate limiting: máximo 1 importación activa por tenant simultánea.
- Idempotencia (§0.5.E): reintentar `POST .../ejecutar` sobre una importación ya `completada` es no-op, devuelve el mismo resultado sin volver a correr los chunks.

### 34.10 API

```text
GET  /api/admin/inventarios/importaciones/plantilla.csv    (plantilla 34.3.4, cabeceras exactas + 2 filas ejemplo)
GET  /api/admin/inventarios/importaciones/plantilla.xlsx   (idem, con validación de celda por columna)
GET  /api/admin/inventarios/perfiles-mapeo                 (perfiles guardados del tenant, 34.3.2)
DELETE /api/admin/inventarios/perfiles-mapeo/:id

POST /api/admin/inventarios/importaciones            (multipart: sube, parsea, sugiere mapeo — aplica 34.3.1: perfil guardado → preset → exacto → sinónimo → difuso)
GET  /api/admin/inventarios/importaciones/:id        (estado, progreso, contadores)
PUT  /api/admin/inventarios/importaciones/:id/mapeo  (mapeo final del usuario + revalida; guarda perfil si el checkbox de 34.3.2 está activo)
GET  /api/admin/inventarios/importaciones/:id/errores.csv
POST /api/admin/inventarios/importaciones/:id/ejecutar   (Idempotency-Key, §0.5.E)
```

Todos bajo `/api/admin/inventarios` con sesión, permiso administrador, tenant resuelto y payload validado (reglas de §46).

### 34.11 Modelo de datos nuevo

```text
productos.extra                JSON NULL          -- datos migrados no mapeados
imp_importaciones              -- encabezado de cada importación (ver §34.9)
imp_importacion_errores        -- detalle de rechazos (índice por importacion_id)
inv_perfiles_mapeo             -- perfiles de mapeo guardados por tenant (ver §34.3.2):
                                --   tenant, nombre, firma_cabeceras (hash), mapeo_json,
                                --   creado_por, creado_en, usado_ultima_vez
```

### 34.12 Criterios de aceptación

- Un CSV y un XLSX con cabeceras renombradas/desordenadas logran auto-mapeo ≥ 80% de campos reconocidos (exacto+sinónimo+difuso combinados) y completarse manualmente hasta 100% de los obligatorios.
- La plantilla descargable (34.3.4), llenada tal cual, logra auto-mapeo del 100% sin intervención manual.
- Un segundo archivo con la MISMA firma de cabeceras que uno ya mapeado antes llega al paso 3 pre-mapeado al 100% vía perfil guardado (34.3.2), sin repetir el trabajo de mapeo.
- Un campo obligatorio (`sku`/`nombre`/`unidad_base`) resuelto solo por coincidencia difusa (nivel 3) SIEMPRE pide confirmación explícita antes de avanzar — nunca se auto-acepta en silencio (34.3.1).
- Columnas no mapeadas quedan íntegras y consultables en `extra` de cada producto; cabeceras `__proto__`/`constructor`/`prototype` se rechazan (`INV_EXTRA_CLAVE_PROHIBIDA`, §34.4).
- Re-importar el mismo archivo dos veces no duplica productos (upsert) ni duplica stock inicial.
- Un fallo a mitad de archivo no deja saldos parciales: los chunks completados quedan consistentes y el reintento completa lo faltante.
- El reporte de errores descargable coincide exactamente con las filas omitidas.
- Suite Jest del importador (parseo, auto-match en sus 3 niveles, perfiles de mapeo, upsert, chunks, permisos, idempotencia) + prueba E2E del wizard completo contra Docker real.

---

# 35. Exportación — 1 CSV / Fase 2 XLSX/PDF

**Protección obligatoria contra inyección de fórmulas CSV (hallazgo de seguridad, auditoría 2026-08-24)**: cualquier valor exportado que empiece con `=`, `+`, `-`, `@`, tab o CR (fórmula de Excel/Sheets — ej. un `nombre` de producto capturado o migrado como `=cmd|'/c calc'!A1`) se antepone con un apóstrofo (`'`) antes de escribir la celda. Aplica a TODAS las columnas exportables de este módulo (§35/§40), no solo a `nombre`/`notas` — un dato migrado vía `extra` (§34.4) también puede traer el patrón. Sin esto, abrir el CSV exportado en Excel ejecuta la fórmula con los permisos del usuario que lo abre (OWASP CSV Injection).

Permitir:

- CSV.
- XLSX.
- PDF.

Reportes exportables:

- Inventario.
- Kardex.
- Productos.
- Existencias.
- Movimientos.
- Conteos.
- Ajustes.
- Mermas.
- Lotes.
- Series.
- Caducidades.
- Valorización.

---

# 36. Búsqueda y filtros

Búsqueda global por:

- Nombre.
- SKU.
- Código de barras.
- Código alternativo.
- Marca.
- Modelo.
- Categoría.
- Lote.
- Serie.

Filtros combinables:

- Almacén.
- Ubicación.
- Estado.
- Stock.
- Categoría.
- Proveedor.
- Lote.
- Caducidad.
- Serie.

---

# 37. Auditoría — 1

Todas las mutaciones deben integrarse con la auditoría existente.

Registrar:

- Usuario.
- Acción.
- Fecha/hora.
- IP.
- Entidad.
- ID.
- Valores anteriores.
- Valores nuevos.
- Motivo.

Acciones críticas:

- Crear producto.
- Editar producto.
- Eliminar producto.
- Ajustar existencia.
- Aprobar ajuste.
- Registrar merma.
- Transferir.
- Modificar costo.
- Cambiar configuración.
- Eliminar imagen.

---

# 38. Papelera — 1

Los productos no deben eliminarse físicamente si tienen movimientos históricos.

Estados:

- Activo.
- Inactivo.
- Archivado.

Un producto con movimientos debe conservarse para mantener la integridad histórica.

---

# 39. Notificaciones — Fase 2

Alertas configurables (stock bajo, agotado, caducidad próxima/vencida, transferencia/conteo/ajuste pendiente, compra recomendada, diferencia de inventario) enviadas por email/WhatsApp/push, además de la notificación interna. v1 solo muestra badges/lista en pantalla (§0.3:11) — el canal de email/WhatsApp ya existe en el proyecto, falta solo el disparador de este módulo. Ver §0.4.1.

---

# 40. Reportes — 1 parcial

## Inventario

- Existencias actuales.
- Valor total.
- Por almacén.
- Por categoría.
- Por producto.

## Movimientos

- Entradas.
- Salidas.
- Transferencias.
- Ajustes.

## Rotación

- Alta rotación.
- Baja rotación.
- Sin movimiento.

## Valorización

- Costo.
- Precio.
- Margen.
- Capital inmovilizado.

## Auditoría

- Ajustes.
- Mermas.
- Diferencias.
- Acciones de usuarios.

---

# 41. Clasificación ABC — Fase 2

Clasificar productos en A (alta importancia económica) / B (media) / C (baja), con criterio configurable por valor, ventas, margen o unidades. Requiere histórico de ventas/rotación acumulado que v1 recién empieza a generar. Ver §0.4.1.

---

# 42. Indicadores de inventario — 1 parcial (solo datos v1)

Mostrar únicamente indicadores respaldados por datos reales:

- Rotación.
- Cobertura.
- Días de inventario.
- Valor inventariado.
- Unidades disponibles.
- Porcentaje bajo mínimo.
- Porcentaje sin movimiento.
- Mermas.
- Diferencias de conteo.

---

# 43. Experiencia de usuario

El módulo debe respetar la experiencia ADDV existente:

- Sidebar navy.
- Tema personalizado por tenant.
- Tipografías configuradas.
- Componentes reutilizables.
- Tablas responsive.
- Tarjetas en móvil.
- Modales existentes.
- Tooltips propios.
- Toasts.
- Empty states.
- Skeleton loading.
- Confirmaciones antes de acciones destructivas.
- Accesibilidad WCAG 2.1 AA.
- Navegación por teclado.
- `prefers-reduced-motion`.

---

# 44. Diseño de catálogo — 1

La tabla de productos debe mostrar:

| Producto | SKU | Categoría | Stock | Disponible | Costo | Precio | Estado |
|---|---|---|---:|---:|---:|---:|---|

Cada fila debe mostrar miniatura del producto.

Al abrir el detalle:

```text
┌─────────────────────────────────────────┐
│ Imagen      Producto                    │
│             SKU                         │
│             Categoría                   │
│             Stock                       │
│             Precio                      │
├─────────────────────────────────────────┤
│ Información | Inventario | Movimientos │
├─────────────────────────────────────────┤
│ Variantes / lotes / series              │
├─────────────────────────────────────────┤
│ Galería de imágenes                     │
└─────────────────────────────────────────┘
```

---

# 45. Carga de imágenes — UX detallada

El componente de imágenes debe ser reutilizable en todo el módulo.

### Estados

```text
Vacío
↓
Seleccionando
↓
Subiendo
↓
Procesando
↓
Listo
↓
Error
```

### Drag & drop

Texto:

> Arrastra tus imágenes aquí o selecciona archivos

Mostrar:

- Formatos permitidos.
- Tamaño máximo.
- Cantidad máxima.
- Progreso.

### Optimización

Cuando sea posible:

- Generar thumbnail.
- Mantener original.
- Optimizar peso.
- Conservar relación de aspecto.
- No deformar producto.

### Accesibilidad

- Alt configurable.
- Navegación por teclado.
- Botones etiquetados.
- Feedback de éxito/error.

---

# 46. API propuesta — 1

Prefijo:

```text
/api/admin/inventarios
```

Endpoints conceptuales:

```text
GET    /productos
POST   /productos
GET    /productos/:id
PUT    /productos/:id
DELETE /productos/:id

POST   /productos/:id/imagenes
DELETE /productos/:id/imagenes/:imagenId
PUT    /productos/:id/imagenes/:imagenId/principal

GET    /categorias
POST   /categorias
PUT    /categorias/:id

GET    /atributos
POST   /atributos
PUT    /atributos/:id

GET    /almacenes
POST   /almacenes
PUT    /almacenes/:id

GET    /ubicaciones
POST   /ubicaciones
PUT    /ubicaciones/:id

GET    /existencias
GET    /kardex

POST   /entradas
POST   /salidas
POST   /transferencias
POST   /conteos
POST   /ajustes

GET    /lotes
GET    /series
GET    /caducidades

GET    /dashboard
GET    /reportes
GET    /reportes/export
```

Todos los endpoints deben:

- Resolver tenant.
- Validar sesión.
- Validar permiso.
- Validar payload.
- Aplicar rate limiting.
- Registrar auditoría cuando corresponda.
- Nunca confiar en IDs enviados por el cliente sin verificar pertenencia al tenant.

---

# 47. Modelo de datos conceptual — 1 (Fase 2/3 tablas en anexo)

Tablas principales:

```text
productos
producto_variantes
producto_atributos
atributos
atributo_opciones
categorias
unidades_medida
conversiones_unidad

almacenes
ubicaciones
existencias

movimientos_inventario
movimiento_detalles

lotes
series

reservas
transferencias
transferencia_detalles

conteos
conteo_detalles

ajustes
ajuste_detalles

mermas

producto_imagenes
producto_documentos

proveedores
ordenes_compra
orden_compra_detalles
recepciones
recepcion_detalles

kits
kit_componentes

inventario_config
```

---

# 48. Reglas de integridad

1. Nunca modificar existencia sin movimiento.
2. Nunca eliminar movimientos confirmados.
3. No permitir SKU duplicado.
4. No permitir serie duplicada.
5. Validar lote cuando el producto lo requiera.
6. Validar caducidad cuando esté habilitada.
7. Validar ubicación perteneciente al almacén.
8. Validar almacén perteneciente al tenant.
9. Validar producto perteneciente al tenant.
10. Toda transferencia debe generar salida y entrada relacionadas.
11. Toda corrección histórica debe generar movimiento compensatorio.
12. Toda operación crítica debe quedar auditada.
13. Las imágenes deben pertenecer al producto y tenant.
14. Los archivos nunca deben exponerse mediante paths predecibles sin autorización.
15. Los costos deben respetar permisos.

---

# 49. Integración con ventas existentes

> **Corregido**: la premisa original de este apartado — "la historia actual de ventas permite capturar múltiples productos por venta" — era FALSA: `ordenes_compra` es de línea única (concepto texto libre + cantidad). El diseño definitivo de la integración vive en §22 (US-INV-025) y en la decisión D8 de §0.2.

Este apartado queda como referencia de evolución futura (fase posterior, con tabla de partidas):

Cuando una partida de venta tenga:

```text
producto_id
cantidad
precio_unitario
```

el sistema podrá:

1. Validar existencia.
2. Reservar inventario.
3. Confirmar salida.
4. Generar movimiento.
5. Actualizar existencia.
6. Mantener vínculo con la venta.

Las ventas de servicios o conceptos no inventariables no modificarán stock.

---

# 50. Dashboard financiero + inventario

La vista de Resumen financiero existente puede evolucionar posteriormente para incluir:

- Valor de inventario.
- Costo de mercancía.
- Margen estimado.
- Capital inmovilizado.
- Ventas vs costo de mercancía.

No deben mezclarse indicadores contables con indicadores operativos sin una definición clara.

---

# 51. Seguridad de archivos

Todas las cargas deben validar:

- Extensión.
- Content-Type.
- Firma binaria.
- Tamaño.
- Tenant.
- Entidad propietaria.

No confiar únicamente en la extensión.

Los archivos eliminados deben seguir el comportamiento definido por la política de retención y almacenamiento.

---

# 52. Responsive

### Desktop

Optimizar para:

- Tablas.
- Dashboard.
- Operación simultánea.
- Atajos de teclado.
- Escáner.

### Tablet

Optimizar para:

- Conteos.
- Recepción.
- Transferencias.
- Picking.

### Mobile

Optimizar para:

- Consulta.
- Escaneo.
- Conteo.
- Entrada rápida.
- Salida rápida.
- Evidencias fotográficas.

La cámara del dispositivo puede utilizarse como futura fuente para escaneo QR/código de barras.

---

# 53. Roadmap de implementación

> **Corrección (auditoría 2026-08-24)**: la "Fase 1" de esta sección quedó obsoleta el día que se cerró §0 — incluía Variantes/Almacenes/Ubicaciones como si fueran v1, cuando D1/D2/D3 los difirieron explícitamente a Fase 2. §0.4 ya es la fuente vigente de qué entra en v1; esta sección se corrige para no contradecirla. El roadmap real de v1 es la lista de §0.3, no la de abajo.

## v1 — Motor mínimo de existencias (ver §0.3 para el detalle completo)

Productos (simple + tipo producto/servicio), categorías, unidades con conversiones, imágenes (gate por tenant), almacén único `ALM-1`, existencias física=disponible, entradas/salidas (4 tipos c/u), kardex, ajustes simples, mín./máx./reorden, importador masivo con wizard mejorado (§34), página de ayuda (§56).

## Fase 2 — Control operativo (incluye lo antes mal-etiquetado como "Fase 1": variantes, almacenes, ubicaciones)

- Variantes y atributos configurables.
- Almacenes (ABML) operativo y ubicaciones.
- Transferencias.
- Conteos.
- Ajustes con flujo de aprobación.
- Reservas.
- Generación de código de barras/QR y etiquetas.
- Notificaciones (email/WhatsApp/push).
- Clasificación ABC.
- Roles Operador de almacén y Compras.
- Exportación XLSX/PDF.

## Fase 3 — Control avanzado

- Lotes.
- Series.
- Caducidades.
- Costeo avanzado (PEPS/FIFO, depende de lotes).
- Kits y productos compuestos.

> Compras/proveedores como entidad, recepciones formales y devoluciones con flujo de decisión por condición se movieron a **Fase 2** (§0.4.1) en esta auditoría — no dependen de lotes/series, solo de que exista la entidad Proveedores en el proyecto.

## Fase 4 — Inteligencia

- ABC.
- Rotación.
- Cobertura.
- Reorden.
- Sugerencias de compra.
- Dashboard avanzado.
- Alertas.

## Fase 5 — Ecosistema

- Integración profunda con ventas.
- E-commerce.
- API pública.
- PWA.
- Escaneo móvil.
- WhatsApp.
- Automatizaciones.
- IA.

---

# 54. Criterios generales de aceptación

El módulo se considera funcional cuando:

- Un tenant puede crear productos sin afectar otros tenants.
- Un producto puede tener imagen y galería.
- Un producto puede tener variantes.
- Se pueden definir atributos nuevos sin modificar código.
- Se pueden administrar unidades y conversiones.
- Se pueden crear múltiples almacenes.
- Se pueden crear ubicaciones.
- Las entradas aumentan existencias mediante movimientos.
- Las salidas disminuyen existencias mediante movimientos.
- El Kardex refleja cada operación.
- Los movimientos confirmados no pueden eliminarse.
- Las transferencias conservan trazabilidad.
- Los conteos generan diferencias.
- Los ajustes requieren autorización cuando corresponda.
- Las imágenes se almacenan en MinIO.
- Los archivos están aislados por tenant.
- Las ventas inventariables pueden afectar stock.
- Las ventas no inventariables no afectan stock.
- Los reportes utilizan datos reales.
- Las acciones críticas quedan auditadas.
- El módulo funciona en escritorio, tablet y móvil.
- Se respeta la identidad visual configurada por tenant.
- Los permisos se validan tanto en frontend como backend.

---

# 55. Principio final de arquitectura

Inventarios no debe construirse como una colección de pantallas independientes.

Debe funcionar como un **motor central de existencias** que conecta:

```text
                    ┌───────────────┐
                    │   PRODUCTOS   │
                    └───────┬───────┘
                            │
             ┌──────────────┼──────────────┐
             ↓              ↓              ↓
         Variantes       Atributos      Imágenes
             │
             ↓
       ┌───────────────┐
       │  INVENTARIO   │
       └───────┬───────┘
               │
       ┌───────┼────────┬─────────┐
       ↓       ↓        ↓         ↓
    Almacén  Lotes   Series   Ubicaciones
       │
       ↓
   MOVIMIENTOS
       │
 ┌─────┼──────┬───────┬────────┐
 ↓     ↓      ↓       ↓        ↓
Compra Venta Conteo Transfer  Ajuste
       │
       ↓
   REPORTES / BI
       │
       ↓
    DECISIONES
```

La existencia es consecuencia de los movimientos; no debe ser un número editable manualmente.

La imagen debe considerarse parte del catálogo del producto, no un accesorio. Esto permite que el mismo componente visual sea utilizado en catálogo, ventas, recepción, conteos, picking, reportes y futuras experiencias móviles.

**Resultado esperado:** un módulo de inventarios suficientemente flexible para cubrir la mayoría de negocios sin perder simplicidad de uso, integrado nativamente con el Portal de Facturación ADDV y preparado para evolucionar hacia compras, ventas, e-commerce, BI, automatizaciones e IA.

---

# 56. Página de ayuda — Diccionario de datos de Inventarios `v1`

> Agregado en la auditoría 2026-08-24, entra a **§0.3 alcance v1** (punto 15). Objetivo: que una persona sin vocabulario técnico entienda cada campo del módulo antes de capturarlo o de armar su archivo de importación, sin depender de que alguien de soporte se lo explique.

## US-INV-026 — Consultar el diccionario de datos

Como **cualquier usuario con acceso al módulo Inventarios** (administrador, super), quiero una página de ayuda que explique en español simple qué es cada campo, qué formato espera y un ejemplo correcto e incorrecto, para capturar o importar mi catálogo sin adivinar ni llamar a soporte.

### 56.1 Principio: una sola fuente de verdad, no una página aparte que se desactualiza

El riesgo real de un diccionario de datos escrito a mano es que se desalinee del sistema real (un campo cambia y nadie actualiza la página). Para evitarlo:

- Los metadatos de cada campo (nombre, obligatoriedad, tipo, sinónimos, ejemplos) viven en **un único módulo fuente** `backend/utils/inventarioCampos.js` (o `.json`), el MISMO que alimenta el diccionario de sinónimos del wizard de importación (§34.3).
- La página de ayuda **renderiza** ese catálogo (vía `GET /api/admin/inventarios/diccionario`, público solo dentro de sesión admin, sin mutación) — no es texto estático copiado en el frontend. Un campo nuevo agregado al sistema aparece automáticamente en la página de ayuda y en los sinónimos del wizard el mismo día, sin tocar dos lugares.
- Cada entrada agrega, sobre los metadatos técnicos ya existentes en §34.3, 3 campos exclusivos de la ayuda (no usados por el wizard): `explicacion_simple` (1-2 frases sin jerga), `ejemplo_valido`, `ejemplo_invalido_comun` (el error que la gente comete seguido con ese campo).

### 56.2 Dónde vive y cómo se llega

- Ruta: `/<slug>/admin/inventarios/ayuda`.
- **3 puntos de entrada**, todos al mismo contenido:
  1. Sidebar del módulo Inventarios → ítem "Ayuda y diccionario de datos" (icono `?`, mismo patrón visual que el resto del sidebar navy).
  2. Dentro del wizard de importación (§34.3), un ícono `?` junto a CADA campo del paso "Mapear cabeceras" abre la página de ayuda **directo en el ancla de ese campo** (`/ayuda#campo-sku`), en panel lateral o pestaña nueva según el tamaño de pantalla — nunca interrumpe el wizard en curso.
  3. Tooltip corto (`title`/`aria-describedby`) en cada campo del formulario "Crear producto" (§5) con la `explicacion_simple` + enlace "Ver más" que abre la ayuda en esa ancla.

### 56.3 Estructura de contenido

Organizada por las mismas 3 agrupaciones que ya usa el módulo, para que el mapa mental coincida con lo que el usuario ya ve en la UI:

```text
1. Catálogo (nombre, sku, código de barras, categoría, unidad, tipo, costo, precio, mínimos...)
2. Existencias y movimientos (existencia, disponible, kardex, entradas, salidas...)
3. Importación masiva (qué es la fila de encabezados, qué es "extra", cómo funciona el mapeo)
```

Cada campo se presenta como una tarjeta compacta:

```text
┌───────────────────────────────────────────────┐
│ SKU                            [Obligatorio]   │
│ Código único que usas para identificar este    │
│ producto. Tú lo eliges — no lo genera el       │
│ sistema. No se puede repetir.                  │
│                                                 │
│ ✓ Correcto:  TORN-M6-25MM                      │
│ ✗ Común:     dejarlo igual que "nombre"        │
│                                                 │
│ En tu archivo de importación, estas columnas   │
│ se reconocen solas: sku, codigo, clave, cve…   │
└───────────────────────────────────────────────┘
```

### 56.4 UX / UI / CX — decisiones aplicadas (no genéricas, resueltas para esta página)

- **Lenguaje llano primero, término técnico después**: cada tarjeta abre con la explicación en palabras de dueño de negocio ("el código que TÚ usas para identificar el producto"), nunca con la definición de columna de base de datos. El nombre técnico (`sku`) queda como etiqueta pequeña, no como titular.
- **Ejemplo correcto + error común, siempre los dos juntos**: mostrar solo el caso válido no previene el error típico; el "✗ Común" nombra el error real que la gente comete con ESE campo (no un genérico "no lo dejes vacío").
- **Buscador client-side** arriba de la página (el catálogo de v1 es corto, filtra en memoria sin ir al servidor) con `aria-live="polite"` anunciando "3 resultados para 'costo'"; estado vacío con sugerencia ("¿Buscabas 'costo_promedio'? Prueba con 'costo'").
- **Navegación**: tabla de contenido pegajosa (sticky) a la izquierda en escritorio (>900px, mismo breakpoint que el resto del panel — lección de los puntos 128/131 de `PROJECT_STATE.md`); en móvil colapsa a un `<select>` de salto rápido debajo del buscador, no un menú lateral que compite por espacio.
- **Reutiliza componentes existentes**, cero CSS nuevo de fondo: tarjetas con el mismo patrón que "Datos migrados (extra)" (§34.4, colapsable), hints con `.field-hint` ya establecido (punto 129), badges Obligatorio/Opcional/Condicional con la misma semántica de color que los badges de estado de Ventas/Tickets (nunca un color inventado).
- **Accesibilidad WCAG 2.1 AA**: cada tarjeta es una región navegable por teclado (`tabindex`, `aria-labelledby`), contraste verificado en los 2 ejemplos (✓/✗ nunca dependen solo del color verde/rojo — llevan el símbolo ✓/✗ como refuerzo no-cromático), `prefers-reduced-motion` respetado si el scroll a un ancla anima.
- **Deep-linking real**: cada tarjeta tiene un ancla estable (`#campo-sku`) para que el ícono `?` del wizard (56.2.2) y cualquier mensaje de error futuro puedan apuntar directo al campo relevante, no a la página genérica.
- **Nunca bloquea el flujo de trabajo**: abrir la ayuda desde el wizard no pierde el progreso del import en curso (panel lateral/pestaña nueva, nunca navegación que abandona el wizard a medio llenar).

### 56.5 API

```text
GET /api/admin/inventarios/diccionario     (catálogo completo, JSON — misma fuente que §34.3)
```

Sesión + permiso administrador + tenant resuelto (reglas de §46); contenido no depende del tenant (es el mismo diccionario del sistema para todos), así que es cacheable en el cliente sin invalidación especial.

### 56.6 Criterios de aceptación

- Todo campo mapeable del wizard (§34.3) tiene su tarjeta correspondiente en el diccionario — verificado por una prueba que compara ambas listas contra la misma fuente (`inventarioCampos.js`), no a mano.
- El ícono `?` de cada campo del wizard abre la ayuda exactamente en la tarjeta de ese campo.
- Buscar "costo" encuentra `costo`, `costo_unitario`, `costo_promedio` y `ultimo_costo` (coincidencia parcial, no exacta).
- Navegación completa por teclado sin mouse, verificada con lector de pantalla en la revisión visual.
- Página funcional en escritorio y móvil (390×844), sin `console.error`, sin regresión al resto del panel.
