// Gestión de suscripción por tenant (punto en curso, propuesta 3
// aprobada): modo de prueba, ciclo de facturación, fecha de expiración y
// estatus de cobro. El estatus de cobro se edita A MANO por ahora — no
// hay integración real con Stripe todavía (confirmado con el usuario) —
// la columna queda lista para que un futuro webhook la actualice sola
// sin tener que tocar este archivo ni el esquema de nuevo.

const { obtenerPool } = require('../db');
const { validarSlug } = require('./tenant');

const CICLOS_VALIDOS = ['mensual', 'anual'];
const ESTATUS_VALIDOS = ['prueba', 'pagada', 'pendiente', 'vencida', 'cancelada'];

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

function validarFecha(valor, campo) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new ErrorSuscripcionTenant(`${campo} debe tener formato YYYY-MM-DD.`, 'validacion');
  }
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new ErrorSuscripcionTenant(`${campo} no es una fecha válida.`, 'validacion');
  }
  return valor;
}

// Actualiza la suscripción de un tenant existente. `datos`:
//   enPrueba: boolean
//   diasPrueba: int > 0, o null
//   pruebaIniciaEn: 'YYYY-MM-DD', o null
//   ciclo: 'mensual' | 'anual' | null
//   expiraEn: 'YYYY-MM-DD', o null
//   estatus: 'prueba' | 'pagada' | 'pendiente' | 'vencida' | 'cancelada' | null
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

  const pruebaIniciaEn = validarFecha(datos.pruebaIniciaEn, 'La fecha de inicio de prueba');
  const expiraEn = validarFecha(datos.expiraEn, 'La fecha de expiración');

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
