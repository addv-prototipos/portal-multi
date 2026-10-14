// Gestión de suscripción por tenant (punto en curso, propuesta 3
// aprobada): modo de prueba, ciclo de facturación, fecha de expiración y
// estatus de cobro. El estatus de cobro se edita A MANO por ahora — no
// hay integración real con Stripe todavía (confirmado con el usuario) —
// la columna queda lista para que un futuro webhook la actualice sola
// sin tener que tocar este archivo ni el esquema de nuevo.
//
// suscripcion_prueba_inicia_en / suscripcion_expira_en NUNCA se reciben
// del cliente (ver propuesta visual confirmada): el admin solo decide
// enPrueba + diasPrueba, estas dos fechas se calculan aquí. Al prender
// enPrueba, pruebaIniciaEn se fija en HOY la primera vez (nunca se mueve
// mientras siga prendido, aunque se edite diasPrueba después) y expiraEn
// siempre es pruebaIniciaEn + diasPrueba. Al apagar enPrueba, las 2
// fechas NO se borran — quedan congeladas con su último valor, para que
// una reactivación futura muestre el trial anterior en vez de perderlo.

const { obtenerPool } = require('../db');
const { validarSlug } = require('./tenant');

const CICLOS_VALIDOS = ['mensual', 'anual'];
const ESTATUS_VALIDOS = ['prueba', 'pagada', 'pendiente', 'vencida', 'cancelada'];

// Zona de negocio fija (HQ) para calcular "hoy" — a diferencia de las
// ventanas "hoy/mes" de backend/utils/limitesPeriodo.js, esto no es un
// corte financiero por tenant: es la fecha administrativa en que un
// operador de Control prendió el trial, así que una sola zona de
// referencia es correcta (nunca Date.UTC/toISOString a secas — mismo
// gotcha documentado en CLAUDE.md, aquí resuelto con Intl.DateTimeFormat).
const ZONA_NEGOCIO_CONTROL = 'America/Mexico_City';

function hoyYYYYMMDD() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO_CONTROL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const obj = {};
  for (const parte of partes) obj[parte.type] = parte.value;
  return `${obj.year}-${obj.month}-${obj.day}`;
}

// Suma días de calendario a una fecha 'YYYY-MM-DD' operando en
// componentes UTC a propósito: no representa un instante real, es
// aritmética de calendario pura, así que usar Date.UTC aquí es seguro
// (evita que un DST de la zona local del proceso corra el resultado).
function sumarDias(fechaYYYYMMDD, dias) {
  const [anio, mes, dia] = fechaYYYYMMDD.split('-').map(Number);
  const base = Date.UTC(anio, mes - 1, dia);
  const resultado = new Date(base + dias * 86400000);
  const yy = resultado.getUTCFullYear();
  const mm = String(resultado.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(resultado.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function fechaSoloDia(valor) {
  return valor ? String(valor).slice(0, 10) : null;
}

// Error tipado — mismo criterio que ErrorMarcaTenant/ErrorTemaTenant: la
// capa de rutas distingue "el slug no existe" (404) de "los datos no
// pasan la validación" (400) sin tener que volver a consultar la fila.
class ErrorSuscripcionTenant extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorSuscripcionTenant';
    this.codigo = codigo; // 'no_encontrado' | 'validacion'
  }
}

async function registrarEvento(db, tenantId, tipo, detalle, actor) {
  await db.query(
    `INSERT INTO tenant_eventos (tenant_id, tipo, detalle, actor, creado_en)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, tipo, detalle, actor, new Date()]
  );
}

// Actualiza la suscripción de un tenant existente. `datos`:
//   enPrueba: boolean
//   diasPrueba: int > 0, o null
//   ciclo: 'mensual' | 'anual' | null
//   estatus: 'prueba' | 'pagada' | 'pendiente' | 'vencida' | 'cancelada' | null
// pruebaIniciaEn/expiraEn NUNCA se leen de `datos` — se calculan aquí
// (ver comentario de cabecera). Si el cliente las manda de todas formas
// (código viejo, request manual), se ignoran a propósito.
// Devuelve la fila completa del tenant después del UPDATE.
async function actualizarSuscripcionTenant(slug, datos = {}, { actor, db = obtenerPool() } = {}) {
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    throw new ErrorSuscripcionTenant(errorSlug, 'validacion');
  }

  const [filas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  const tenant = filas[0];
  if (!tenant) {
    throw new ErrorSuscripcionTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }

  const enPrueba = datos.enPrueba === true || datos.enPrueba === 1 ? 1 : 0;

  let diasPrueba = null;
  if (datos.diasPrueba !== null && datos.diasPrueba !== undefined && datos.diasPrueba !== '') {
    const n = Number(datos.diasPrueba);
    if (!Number.isInteger(n) || n <= 0) {
      throw new ErrorSuscripcionTenant('Los días de prueba deben ser un entero mayor a 0.', 'validacion');
    }
    diasPrueba = n;
  }

  let pruebaIniciaEn;
  let expiraEn;
  if (enPrueba) {
    // Se fija HOY solo la primera vez — si ya había un inicio guardado
    // (trial ya en curso), se respeta: cambiar días de prueba no debe
    // reiniciar el conteo de cuántos días ya pasaron.
    pruebaIniciaEn = fechaSoloDia(tenant.suscripcion_prueba_inicia_en) || hoyYYYYMMDD();
    expiraEn = diasPrueba ? sumarDias(pruebaIniciaEn, diasPrueba) : null;
  } else {
    // Apagado: se congelan los últimos valores conocidos, nunca se
    // borran (propuesta confirmada) — una reactivación futura los vuelve
    // a mostrar en vez de perder el rastro del trial anterior.
    pruebaIniciaEn = fechaSoloDia(tenant.suscripcion_prueba_inicia_en);
    expiraEn = fechaSoloDia(tenant.suscripcion_expira_en);
  }

  let ciclo = null;
  if (datos.ciclo !== null && datos.ciclo !== undefined && datos.ciclo !== '') {
    if (!CICLOS_VALIDOS.includes(datos.ciclo)) {
      throw new ErrorSuscripcionTenant(`El ciclo de facturación debe ser uno de: ${CICLOS_VALIDOS.join(', ')}.`, 'validacion');
    }
    ciclo = datos.ciclo;
  }

  let estatus = null;
  if (datos.estatus !== null && datos.estatus !== undefined && datos.estatus !== '') {
    if (!ESTATUS_VALIDOS.includes(datos.estatus)) {
      throw new ErrorSuscripcionTenant(`El estatus de cobro debe ser uno de: ${ESTATUS_VALIDOS.join(', ')}.`, 'validacion');
    }
    estatus = datos.estatus;
  }

  const [resultado] = await db.query(
    `UPDATE tenants SET
       suscripcion_en_prueba = ?,
       suscripcion_dias_prueba = ?,
       suscripcion_prueba_inicia_en = ?,
       suscripcion_ciclo = ?,
       suscripcion_expira_en = ?,
       suscripcion_estatus = ?
     WHERE slug = ?`,
    [enPrueba, diasPrueba, pruebaIniciaEn, ciclo, expiraEn, estatus, slug]
  );
  if (resultado.affectedRows === 0) {
    throw new ErrorSuscripcionTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }

  const [filasActualizadas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  const tenantActualizado = filasActualizadas[0];

  await registrarEvento(
    db,
    tenantActualizado.id,
    'suscripcion_actualizada',
    `slug=${slug} enPrueba=${enPrueba} diasPrueba=${diasPrueba ?? '-'} ciclo=${ciclo ?? '-'} expiraEn=${expiraEn ?? '-'} estatus=${estatus ?? '-'}`,
    actor || null
  );

  return tenantActualizado;
}

module.exports = { ErrorSuscripcionTenant, actualizarSuscripcionTenant, CICLOS_VALIDOS, ESTATUS_VALIDOS };
