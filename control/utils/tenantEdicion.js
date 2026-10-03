// Edición de los datos de una empresa existente desde /control (segmento
// "edición", ver PROJECT_STATE.md punto 104): los MISMOS campos que se
// capturan en el alta (nombre, contacto, notas, marca y logo)
// más el slug — que solo puede cambiar si el operador lo habilita
// explícitamente (switch "Cambiar slug (avanzado)" en la UI).
//
// El slug es la identidad pública del tenant (URLs /<slug>/... y prefijo
// de archivos en MinIO), así que cambiarlo dispara una migración real
// ANTES de tocar la fila: el backend principal mueve TODOS los objetos
// del tenant (`<slug_viejo>/...` y `marca/<slug_viejo>/logo`) al slug
// nuevo por su endpoint interno /internal/renombrar-slug. nginx no
// necesita nada (sus rutas de tenant son regex dinámicas); la BD física
// del tenant NO se renombra (el backend se conecta por db_name guardado
// en la fila): en tenants ya aprovisionados db_name se conserva, y solo
// en estado 'provisioning' (BD todavía no creada) se regenera con el slug
// nuevo (provisionar-tenant.js usa el db_name de la fila).

const { obtenerPool } = require('../db');
const { validarSlug, nombreDbTenant } = require('./tenant');
const { normalizarDatosBase } = require('./tenantIntake');
const { subirLogoAlBackend, borrarLogoDelBackend, MAX_MARCA_LOGO_MB } = require('./tenantMarca');
const { notificarInvalidacionCache, aplicarLimiteUsuarios } = require('./notificarBackend');
const { obtenerPlan, ErrorPlan } = require('./planes');

// Error tipado para que la capa de rutas distinga: slug inexistente (404),
// datos inválidos (400), slug nuevo duplicado (409) y migración rechazada
// por el backend (502).
class ErrorEdicionTenant extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorEdicionTenant';
    this.codigo = codigo; // 'no_encontrado' | 'validacion' | 'slug_existe' | 'backend'
  }
}

async function registrarEvento(db, tenantId, tipo, detalle, actor) {
  await db.query(
    `INSERT INTO tenant_eventos (tenant_id, tipo, detalle, actor, creado_en)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, tipo, detalle, actor, new Date()]
  );
}

// Delega al backend la migración de todos los archivos del tenant al slug
// nuevo (prefijo + logo de marca). Lanza ErrorEdicionTenant 'backend' si
// el backend no puede alcanzarse o rechaza la migración.
async function migrarSlugEnBackend(slugAnterior, slugNuevo) {
  const url = `${process.env.BACKEND_INTERNAL_URL || 'http://backend:4000'}/internal/renombrar-slug`;
  const secreto = process.env.INTERNAL_CACHE_SECRET;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secreto || '',
      },
      body: JSON.stringify({ slugAnterior, slugNuevo }),
    });
  } catch (err) {
    throw new ErrorEdicionTenant('No se pudo conectar con el servicio de almacenamiento.', 'backend');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ErrorEdicionTenant(data.error || 'El servicio de almacenamiento rechazó el cambio de slug.', 'backend');
  }
}

// Devuelve el detalle de qué campos cambiaron (para el evento de
// auditoría), comparando la fila actual contra los valores normalizados.
function construirDetalleCambios(tenant, base, slugNuevo, logoAccion, marcaLookfeelHabilitado, maxUsuariosFinal) {
  const cambios = [];
  if (slugNuevo) cambios.push(`slug: ${tenant.slug} -> ${slugNuevo}`);
  if (base.nombreEmpresa !== tenant.nombre_empresa) cambios.push(`nombre: "${tenant.nombre_empresa}" -> "${base.nombreEmpresa}"`);
  if (base.contactoEmail !== (tenant.contacto_email || null)) cambios.push('contacto_email');
  if (base.notas !== (tenant.notas || null)) cambios.push('notas');
  if (base.marca !== (tenant.marca || null)) cambios.push('marca');
  if (logoAccion === 'subido') cambios.push('logo: subido');
  if (logoAccion === 'quitado') cambios.push('logo: quitado');
  if (marcaLookfeelHabilitado !== (tenant.marca_lookfeel_habilitado ? 1 : 0)) {
    cambios.push(`marca_lookfeel_habilitado: ${marcaLookfeelHabilitado ? 'ON' : 'OFF'}`);
  }
  if (maxUsuariosFinal !== (tenant.max_usuarios ?? null)) {
    cambios.push(`max_usuarios: ${maxUsuariosFinal ?? 'sin límite'}`);
  }
  return cambios.length > 0 ? cambios.join(', ') : 'sin cambios';
}

// Punto 244 (mapeo con CLARVO_Planes.md, 2026-09-10): valida el límite
// de usuarios — null/undefined/'' = sin límite (comportamiento de
// siempre), cualquier otro valor debe ser un entero positivo.
function normalizarMaxUsuarios(valor) {
  if (valor === undefined || valor === null || valor === '') return { ok: true, valor: null };
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, error: 'El máximo de usuarios debe ser un número entero mayor a 0, o dejarse vacío para no limitar.' };
  }
  return { ok: true, valor: n };
}

// Punto 347: misma validación que normalizarMaxUsuarios — null/vacío =
// sin límite de disco impuesto desde /control.
function normalizarDiscoCuotaMb(valor) {
  if (valor === undefined || valor === null || valor === '') return { ok: true, valor: null };
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, error: 'La cuota de disco debe ser un número entero mayor a 0, o dejarse vacío para no limitar.' };
  }
  return { ok: true, valor: n };
}

// Punto 349-350-351 (ver stitch/gobierno-funcionalidades/NOTAS.md): las
// mismas 6 reglas de dependencia que ya valida control/utils/planes.js al
// guardar un PLAN se repiten aquí sobre el estado RESUELTO de un TENANT —
// un plan ya validado no puede producir una combinación inválida, pero
// una excepción puntual por tenant sí podría (ej. prender cxcHabilitado a
// mano en un tenant cuyo plan no trae ventasHabilitado). Mismos mensajes,
// adaptados a los nombres de campo camelCase de este archivo.
function validarReglasDependenciaTenant(base) {
  const activo = (campo) => base[campo] === 1 || base[campo] === true;

  if (activo('cxcHabilitado') && !activo('ventasHabilitado')) {
    throw new ErrorEdicionTenant('Cuentas por cobrar requiere Ventas activo en esta empresa.', 'validacion');
  }
  if (activo('resumenFinancieroHabilitado') && !activo('ventasHabilitado') && !activo('gastosHabilitado')) {
    throw new ErrorEdicionTenant('Resumen financiero requiere Ventas o Gastos activo en esta empresa.', 'validacion');
  }
  if (activo('reportesPorReporteHabilitado') && !activo('facturacionHabilitada') && !activo('ventasHabilitado')) {
    throw new ErrorEdicionTenant('Reportes "Por reporte" requiere Facturación o Ventas activo en esta empresa.', 'validacion');
  }
  if (activo('reportesCortesHabilitado') && !activo('ventasHabilitado')) {
    throw new ErrorEdicionTenant('Reportes "Cortes" requiere Ventas activo en esta empresa.', 'validacion');
  }
  if (activo('reportesEliminadosHabilitado') && !activo('ventasHabilitado') && !activo('gastosHabilitado')) {
    throw new ErrorEdicionTenant('Reportes "Eliminados" requiere Ventas o Gastos activo en esta empresa.', 'validacion');
  }
  if (activo('reportesEstadoInventarioHabilitado') && !activo('inventariosHabilitado')) {
    throw new ErrorEdicionTenant('Reportes "Estado del inventario" requiere Inventarios activo en esta empresa.', 'validacion');
  }
  if (activo('reportesEstadoTicketsHabilitado') && !activo('facturacionHabilitada')) {
    throw new ErrorEdicionTenant('Reportes "Estado de tickets" requiere Facturación activo en esta empresa.', 'validacion');
  }
}

// Punto 347: resuelve los 6 valores de "plan y funciones" que van al
// UPDATE final, con esta precedencia:
//   1. Si viene `planId` (asignar un plan nuevo) o `reaplicarPlan: true`
//      (resincronizar al plan YA asignado): esos 6 valores del plan son
//      la BASE — se copian, nunca quedan ligados en vivo (editar el plan
//      después no toca a este tenant, solo "Reaplicar" lo hace, a mano).
//   2. Sin plan de por medio, la base es lo que el tenant ya tenía.
//   3. Cualquiera de los 6 campos presente EXPLÍCITAMENTE en `datos` en
//      esta misma llamada gana sobre la base — así se puede asignar un
//      plan y ajustar una excepción puntual en un solo guardado.
async function resolverPlanYFunciones(tenant, datos, db) {
  let base = {
    planId: tenant.plan_id ?? null,
    planActualizadoEn: tenant.plan_actualizado_en ?? null,
    facturacionHabilitada: tenant.facturacion_habilitada ? 1 : 0,
    portalClientesHabilitado: tenant.portal_clientes_habilitado ? 1 : 0,
    sucursalesHabilitado: tenant.sucursales_habilitado ? 1 : 0,
    marcaLookfeelHabilitado: tenant.marca_lookfeel_habilitado ? 1 : 0,
    maxUsuarios: tenant.max_usuarios ?? null,
    discoCuotaMb: tenant.disco_cuota_mb ?? null,
    // Ampliación del gobierno de funcionalidades (punto 349-350-351).
    ventasHabilitado: tenant.ventas_habilitado ? 1 : 0,
    gastosHabilitado: tenant.gastos_habilitado ? 1 : 0,
    inventariosHabilitado: tenant.inventarios_habilitado ? 1 : 0,
    auditoriaHabilitado: tenant.auditoria_habilitado ? 1 : 0,
    cxcHabilitado: tenant.cxc_habilitado ? 1 : 0,
    resumenFinancieroHabilitado: tenant.resumen_financiero_habilitado ? 1 : 0,
    reportesPorReporteHabilitado: tenant.reportes_por_reporte_habilitado ? 1 : 0,
    reportesCortesHabilitado: tenant.reportes_cortes_habilitado ? 1 : 0,
    reportesEliminadosHabilitado: tenant.reportes_eliminados_habilitado ? 1 : 0,
    reportesEstadoInventarioHabilitado: tenant.reportes_estado_inventario_habilitado ? 1 : 0,
    reportesEstadoTicketsHabilitado: tenant.reportes_estado_tickets_habilitado ? 1 : 0,
  };

  const asignandoPlanNuevo = datos.planId !== undefined && datos.planId !== null && datos.planId !== '';
  const reaplicando = datos.reaplicarPlan === true;

  if (asignandoPlanNuevo || reaplicando) {
    const planIdObjetivo = asignandoPlanNuevo ? Number(datos.planId) : tenant.plan_id;
    if (asignandoPlanNuevo && !Number.isInteger(planIdObjetivo)) {
      throw new ErrorEdicionTenant('Plan inválido.', 'validacion');
    }
    if (reaplicando && !planIdObjetivo) {
      throw new ErrorEdicionTenant('Esta empresa no tiene ningún plan asignado todavía — no hay nada que reaplicar.', 'validacion');
    }

    let plan;
    try {
      plan = await obtenerPlan(planIdObjetivo, db);
    } catch (err) {
      if (err instanceof ErrorPlan) throw new ErrorEdicionTenant('El plan seleccionado no existe.', 'validacion');
      throw err;
    }
    // Un plan archivado solo se puede REAPLICAR (sincronizar un tenant
    // que ya lo tenía) — nunca asignarse de cero a otra empresa.
    if (asignandoPlanNuevo && !plan.activo) {
      throw new ErrorEdicionTenant('Ese plan está archivado y ya no se puede asignar a empresas nuevas.', 'validacion');
    }

    base = {
      planId: plan.id,
      planActualizadoEn: new Date(),
      facturacionHabilitada: plan.facturacion_habilitada ? 1 : 0,
      portalClientesHabilitado: plan.portal_clientes_habilitado ? 1 : 0,
      sucursalesHabilitado: plan.sucursales_habilitado ? 1 : 0,
      marcaLookfeelHabilitado: plan.marca_lookfeel_habilitado ? 1 : 0,
      maxUsuarios: plan.max_usuarios,
      discoCuotaMb: plan.disco_cuota_mb,
      ventasHabilitado: plan.ventas_habilitado ? 1 : 0,
      gastosHabilitado: plan.gastos_habilitado ? 1 : 0,
      inventariosHabilitado: plan.inventarios_habilitado ? 1 : 0,
      auditoriaHabilitado: plan.auditoria_habilitado ? 1 : 0,
      cxcHabilitado: plan.cxc_habilitado ? 1 : 0,
      resumenFinancieroHabilitado: plan.resumen_financiero_habilitado ? 1 : 0,
      reportesPorReporteHabilitado: plan.reportes_por_reporte_habilitado ? 1 : 0,
      reportesCortesHabilitado: plan.reportes_cortes_habilitado ? 1 : 0,
      reportesEliminadosHabilitado: plan.reportes_eliminados_habilitado ? 1 : 0,
      reportesEstadoInventarioHabilitado: plan.reportes_estado_inventario_habilitado ? 1 : 0,
      reportesEstadoTicketsHabilitado: plan.reportes_estado_tickets_habilitado ? 1 : 0,
    };
  }

  // Excepciones explícitas por tenant — ganan sobre la base del plan (o
  // sobre lo que el tenant ya tenía, si no hay plan de por medio).
  if (typeof datos.facturacionHabilitada === 'boolean') base.facturacionHabilitada = datos.facturacionHabilitada ? 1 : 0;
  if (typeof datos.portalClientesHabilitado === 'boolean') base.portalClientesHabilitado = datos.portalClientesHabilitado ? 1 : 0;
  if (typeof datos.sucursalesHabilitado === 'boolean') base.sucursalesHabilitado = datos.sucursalesHabilitado ? 1 : 0;
  if (typeof datos.marcaLookfeelHabilitado === 'boolean') base.marcaLookfeelHabilitado = datos.marcaLookfeelHabilitado ? 1 : 0;
  if (typeof datos.ventasHabilitado === 'boolean') base.ventasHabilitado = datos.ventasHabilitado ? 1 : 0;
  if (typeof datos.gastosHabilitado === 'boolean') base.gastosHabilitado = datos.gastosHabilitado ? 1 : 0;
  if (typeof datos.inventariosHabilitado === 'boolean') base.inventariosHabilitado = datos.inventariosHabilitado ? 1 : 0;
  if (typeof datos.auditoriaHabilitado === 'boolean') base.auditoriaHabilitado = datos.auditoriaHabilitado ? 1 : 0;
  if (typeof datos.cxcHabilitado === 'boolean') base.cxcHabilitado = datos.cxcHabilitado ? 1 : 0;
  if (typeof datos.resumenFinancieroHabilitado === 'boolean') base.resumenFinancieroHabilitado = datos.resumenFinancieroHabilitado ? 1 : 0;
  if (typeof datos.reportesPorReporteHabilitado === 'boolean') base.reportesPorReporteHabilitado = datos.reportesPorReporteHabilitado ? 1 : 0;
  if (typeof datos.reportesCortesHabilitado === 'boolean') base.reportesCortesHabilitado = datos.reportesCortesHabilitado ? 1 : 0;
  if (typeof datos.reportesEliminadosHabilitado === 'boolean') base.reportesEliminadosHabilitado = datos.reportesEliminadosHabilitado ? 1 : 0;
  if (typeof datos.reportesEstadoInventarioHabilitado === 'boolean') base.reportesEstadoInventarioHabilitado = datos.reportesEstadoInventarioHabilitado ? 1 : 0;
  if (typeof datos.reportesEstadoTicketsHabilitado === 'boolean') base.reportesEstadoTicketsHabilitado = datos.reportesEstadoTicketsHabilitado ? 1 : 0;
  if (datos.maxUsuarios !== undefined) {
    const r = normalizarMaxUsuarios(datos.maxUsuarios);
    if (!r.ok) throw new ErrorEdicionTenant(r.error, 'validacion');
    base.maxUsuarios = r.valor;
  }
  if (datos.discoCuotaMb !== undefined) {
    const r = normalizarDiscoCuotaMb(datos.discoCuotaMb);
    if (!r.ok) throw new ErrorEdicionTenant(r.error, 'validacion');
    base.discoCuotaMb = r.valor;
  }

  validarReglasDependenciaTenant(base);

  return base;
}

// Actualiza los datos editables de un tenant existente.
// `datos` (todos opcionales salvo nombreEmpresa):
//   nombreEmpresa, contactoEmail, notas, marca, logoBase64?, quitarLogo?
//   slug?: solo se aplica si viene un slug distinto al actual y el
//     operador lo pidió explícitamente (validado como slug nuevo: formato
//     + no reservado + no duplicado). Dispara la migración de archivos en
//     el backend antes del UPDATE.
// Devuelve la fila completa del tenant después del UPDATE.
async function actualizarDatosTenant(slug, datos = {}, { actor, db = obtenerPool() } = {}) {
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    throw new ErrorEdicionTenant(errorSlug, 'validacion');
  }

  const [filas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  const tenant = filas[0];
  if (!tenant) {
    throw new ErrorEdicionTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }

  let base;
  try {
    base = normalizarDatosBase({ ...datos, slug: tenant.slug });
  } catch (err) {
    throw new ErrorEdicionTenant(err.message, 'validacion');
  }

  // Slug nuevo (opcional): solo si viene un valor distinto al actual.
  let slugNuevo = null;
  if (typeof datos.slug === 'string' && datos.slug.trim() && datos.slug.trim().toLowerCase() !== tenant.slug) {
    const slugPropuesto = datos.slug.trim().toLowerCase();
    const errorSlugNuevo = validarSlug(slugPropuesto);
    if (errorSlugNuevo) {
      throw new ErrorEdicionTenant(errorSlugNuevo, 'validacion');
    }
    const [duplicados] = await db.query('SELECT id FROM tenants WHERE slug = ? AND id <> ?', [slugPropuesto, tenant.id]);
    if (duplicados.length > 0) {
      throw new ErrorEdicionTenant(
        `El slug "${slugPropuesto}" ya está registrado por otra empresa. Elige otro.`,
        'slug_existe'
      );
    }
    slugNuevo = slugPropuesto;
  }

  // Logo: misma semántica que actualizarMarcaTenant — nuevo logo (se sube
  // al slug FINAL, después de la migración, para que no lo pise), o
  // quitarLogo (se borra del slug final).
  let marcaLogoUrl = tenant.marca_logo_url;
  let logoAccion = 'sin_cambios';
  const slugLogo = slugNuevo || tenant.slug;

  if (slugNuevo) {
    await migrarSlugEnBackend(tenant.slug, slugNuevo);
    // Con slug nuevo, la ruta guardada siempre apunta al slug nuevo; la
    // migración ya movió el archivo (si existía).
    marcaLogoUrl = marcaLogoUrl ? `/api/marca-logo/${slugNuevo}` : null;
  }

  if (datos.quitarLogo === true) {
    await borrarLogoDelBackend(slugLogo);
    marcaLogoUrl = null;
    logoAccion = 'quitado';
  } else if (typeof datos.logoBase64 === 'string' && datos.logoBase64.length > 0) {
    let buffer;
    try {
      buffer = Buffer.from(datos.logoBase64, 'base64');
    } catch (err) {
      throw new ErrorEdicionTenant('El contenido del logo no es un base64 válido.', 'validacion');
    }
    if (buffer.length === 0) {
      throw new ErrorEdicionTenant('El logo está vacío.', 'validacion');
    }
    if (buffer.length > MAX_MARCA_LOGO_MB * 1024 * 1024) {
      throw new ErrorEdicionTenant(`El logo excede el tamaño máximo permitido de ${MAX_MARCA_LOGO_MB} MB.`, 'validacion');
    }
    marcaLogoUrl = await subirLogoAlBackend(slugLogo, buffer);
    logoAccion = 'subido';
  }

  // La BD física del tenant NO se renombra: db_name se conserva tal cual
  // en tenants ya aprovisionados; solo en 'provisioning' (BD aún no
  // creada) se regenera con el slug nuevo para que provisionar-tenant.js
  // cree la BD con el nombre correcto.
  const dbNameFinal =
    slugNuevo && tenant.estado === 'provisioning' ? nombreDbTenant(slugNuevo) : tenant.db_name;
  const storagePrefixFinal = slugNuevo || tenant.storage_prefix;

  // Tema (segmento "Look & Feel"): con slug nuevo, la ruta del favicon
  // dentro de tema_json debe apuntar al slug nuevo (la migración de
  // /internal/renombrar-slug ya movió el archivo a marca/<nuevo>/favicon);
  // el resto del tema viaja con la fila sin cambios.
  let temaJsonFinal = tenant.tema_json;
  if (slugNuevo && typeof temaJsonFinal === 'string' && temaJsonFinal.trim()) {
    try {
      const temaParseado = JSON.parse(temaJsonFinal);
      if (temaParseado && typeof temaParseado.faviconUrl === 'string') {
        const faviconNuevo = `/api/favicon/${slugNuevo}`;
        if (temaParseado.faviconUrl !== faviconNuevo) {
          temaParseado.faviconUrl = faviconNuevo;
          temaJsonFinal = JSON.stringify(temaParseado);
        }
      }
    } catch (err) {
      // tema_json corrupto: se conserva tal cual (el backend lo degrada
      // al diseño base al leerlo y lo loguea para corregirlo).
    }
  }

  // Punto 347: plan asignado + las 6 excepciones por tenant (incluye el
  // viejo gate de marca/Look & Feel y la cuota de usuarios del punto 244,
  // ahora resueltos junto con el resto de "plan y funciones").
  const planFunciones = await resolverPlanYFunciones(tenant, datos, db);
  const marcaLookfeelHabilitado = planFunciones.marcaLookfeelHabilitado;
  const maxUsuariosFinal = planFunciones.maxUsuarios;

  const [resultado] = await db.query(
    `UPDATE tenants SET
       slug = ?, nombre_empresa = ?, contacto_email = ?, notas = ?,
       db_name = ?, storage_prefix = ?,
       marca = ?, marca_logo_url = ?, tema_json = ?,
       marca_lookfeel_habilitado = ?, max_usuarios = ?,
       plan_id = ?, plan_actualizado_en = ?,
       facturacion_habilitada = ?, portal_clientes_habilitado = ?,
       sucursales_habilitado = ?, disco_cuota_mb = ?,
       ventas_habilitado = ?, gastos_habilitado = ?, inventarios_habilitado = ?,
       auditoria_habilitado = ?, cxc_habilitado = ?, resumen_financiero_habilitado = ?,
       reportes_por_reporte_habilitado = ?, reportes_cortes_habilitado = ?,
       reportes_eliminados_habilitado = ?, reportes_estado_inventario_habilitado = ?,
       reportes_estado_tickets_habilitado = ?
     WHERE id = ?`,
    [
      slugNuevo || tenant.slug,
      base.nombreEmpresa,
      base.contactoEmail,
      base.notas,
      dbNameFinal,
      storagePrefixFinal,
      base.marca,
      marcaLogoUrl,
      temaJsonFinal,
      marcaLookfeelHabilitado,
      maxUsuariosFinal,
      planFunciones.planId,
      planFunciones.planActualizadoEn,
      planFunciones.facturacionHabilitada,
      planFunciones.portalClientesHabilitado,
      planFunciones.sucursalesHabilitado,
      planFunciones.discoCuotaMb,
      planFunciones.ventasHabilitado,
      planFunciones.gastosHabilitado,
      planFunciones.inventariosHabilitado,
      planFunciones.auditoriaHabilitado,
      planFunciones.cxcHabilitado,
      planFunciones.resumenFinancieroHabilitado,
      planFunciones.reportesPorReporteHabilitado,
      planFunciones.reportesCortesHabilitado,
      planFunciones.reportesEliminadosHabilitado,
      planFunciones.reportesEstadoInventarioHabilitado,
      planFunciones.reportesEstadoTicketsHabilitado,
      tenant.id,
    ]
  );
  if (resultado.affectedRows === 0) {
    throw new ErrorEdicionTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }

  const [filasActualizadas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slugNuevo || tenant.slug]);
  const tenantActualizado = filasActualizadas[0];

  const detalleCambiosPlan = construirDetalleCambios(tenant, base, null, logoAccion, marcaLookfeelHabilitado, maxUsuariosFinal);
  const detalleCambiosPlanExtra = [];
  if (planFunciones.planId !== (tenant.plan_id ?? null)) {
    detalleCambiosPlanExtra.push(`plan_id: ${tenant.plan_id ?? 'ninguno'} -> ${planFunciones.planId ?? 'ninguno'}`);
  }
  if (planFunciones.facturacionHabilitada !== (tenant.facturacion_habilitada ? 1 : 0)) {
    detalleCambiosPlanExtra.push(`facturacion_habilitada: ${planFunciones.facturacionHabilitada ? 'ON' : 'OFF'}`);
  }
  if (planFunciones.portalClientesHabilitado !== (tenant.portal_clientes_habilitado ? 1 : 0)) {
    detalleCambiosPlanExtra.push(`portal_clientes_habilitado: ${planFunciones.portalClientesHabilitado ? 'ON' : 'OFF'}`);
  }
  if (planFunciones.sucursalesHabilitado !== (tenant.sucursales_habilitado ? 1 : 0)) {
    detalleCambiosPlanExtra.push(`sucursales_habilitado: ${planFunciones.sucursalesHabilitado ? 'ON' : 'OFF'}`);
  }
  if (planFunciones.discoCuotaMb !== (tenant.disco_cuota_mb ?? null)) {
    detalleCambiosPlanExtra.push(`disco_cuota_mb: ${planFunciones.discoCuotaMb ?? 'sin límite'}`);
  }
  // Ampliación del gobierno de funcionalidades (punto 349-350-351) — mismo
  // criterio de diff que los 5 campos de arriba, uno por cada flag nuevo.
  const CAMPOS_GOBIERNO_AMPLIADO = [
    ['ventasHabilitado', 'ventas_habilitado'],
    ['gastosHabilitado', 'gastos_habilitado'],
    ['inventariosHabilitado', 'inventarios_habilitado'],
    ['auditoriaHabilitado', 'auditoria_habilitado'],
    ['cxcHabilitado', 'cxc_habilitado'],
    ['resumenFinancieroHabilitado', 'resumen_financiero_habilitado'],
    ['reportesPorReporteHabilitado', 'reportes_por_reporte_habilitado'],
    ['reportesCortesHabilitado', 'reportes_cortes_habilitado'],
    ['reportesEliminadosHabilitado', 'reportes_eliminados_habilitado'],
    ['reportesEstadoInventarioHabilitado', 'reportes_estado_inventario_habilitado'],
    ['reportesEstadoTicketsHabilitado', 'reportes_estado_tickets_habilitado'],
  ];
  for (const [campoCamel, campoColumna] of CAMPOS_GOBIERNO_AMPLIADO) {
    const valorAnterior = tenant[campoColumna] ? 1 : 0;
    if (planFunciones[campoCamel] !== valorAnterior) {
      detalleCambiosPlanExtra.push(`${campoColumna}: ${planFunciones[campoCamel] ? 'ON' : 'OFF'}`);
    }
  }
  // Regla 9 (punto 349-350-351, ver stitch/gobierno-funcionalidades/
  // NOTAS.md): si el max_usuarios resuelto deja a la empresa por encima
  // de su nuevo límite, el backend suspende usuarios no-administradores
  // (los más recientes primero) — nunca bloquea este guardado, que ya es
  // válido y ya se aplicó; es un efecto secundario de mejor esfuerzo (ver
  // aplicarLimiteUsuarios, nunca lanza). `null` = no se pudo confirmar
  // (reportado aparte, nunca se asume "nadie se suspendió").
  const slugFinalParaLimite = slugNuevo || tenant.slug;
  const usuariosSuspendidosPorLimite = await aplicarLimiteUsuarios(slugFinalParaLimite, planFunciones.maxUsuarios);
  if (Array.isArray(usuariosSuspendidosPorLimite) && usuariosSuspendidosPorLimite.length > 0) {
    detalleCambiosPlanExtra.push(
      `${usuariosSuspendidosPorLimite.length} usuario(s) suspendido(s) por el nuevo límite: ${usuariosSuspendidosPorLimite.map((u) => u.rfc).join(', ')}`
    );
  } else if (usuariosSuspendidosPorLimite === null) {
    detalleCambiosPlanExtra.push('no se pudo confirmar si algún usuario quedó por encima del nuevo límite (backend no disponible)');
  }
  const detalleFinal = [detalleCambiosPlan, ...detalleCambiosPlanExtra].filter((d) => d && d !== 'sin cambios').join(', ') || 'sin cambios';

  await registrarEvento(
    db,
    tenantActualizado.id,
    slugNuevo ? 'slug_cambiado' : (datos.planId !== undefined || datos.reaplicarPlan ? 'plan_asignado' : 'datos_actualizados'),
    slugNuevo ? `slug: ${tenant.slug} -> ${slugNuevo}` : detalleFinal,
    actor || null
  );

  // El backend cachea la resolución de tenant por slug: invalidar el slug
  // viejo (si cambió) y el actual para que las URLs nuevas funcionen ya.
  const slugsAInvalidar = slugNuevo ? [tenant.slug, slugNuevo] : [tenant.slug];
  for (const s of slugsAInvalidar) {
    try {
      await notificarInvalidacionCache(s);
    } catch (err) {
      console.error(`No se pudo invalidar la caché del backend para "${s}":`, err.message);
    }
  }

  return tenantActualizado;
}

module.exports = { ErrorEdicionTenant, actualizarDatosTenant };