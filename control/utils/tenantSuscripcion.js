// Gestión de suscripción por tenant (punto en curso, propuesta 3
// aprobada): modo de prueba, ciclo de facturación, fecha de expiración y
// estatus de cobro. El estatus de cobro se edita A MANO por ahora — no
// hay integración real con Stripe todavía (confirmado con el usuario,
// punto 416: "por ahora usa solo mocks, al final integramos") — la
// columna queda lista para que un futuro webhook la actualice sola
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
//
// Punto 416 (suscripción DE PAGO, no-prueba): mismo mecanismo "se fija
// sola la primera vez" aplicado a suscripcion_ciclo_inicia_en — nunca se
// recibe del cliente tampoco. Cuando !enPrueba y hay ciclo, expiraEn =
// cicloIniciaEn + 1 mes (mensual) o +1 año (anual), recalculado en cada
// guardado desde la MISMA ancla (así que cambiar de mensual a anual
// corre la fecha de fin, pero nunca mueve el inicio ya fijado).
//
// Origen de la suscripción (suscripcion_origen): decide qué tan protegida
// está esa ancla. 'onboarding' se fuerza desde onboardingConversion.js
// (único caller que pasa origenForzado) al convertir un borrador — desde
// ahí, cicloIniciaEn ya nace con un valor, así que el primer guardado
// manual en /control NUNCA la toca (sigue el mismo "se fija sola la
// primera vez": si ya tiene valor, se respeta). Si el tenant se dio de
// alta sin onboarding (origen null/'manual'), cicloIniciaEn sigue null
// hasta el PRIMER guardado desde /control — ESE guardado es el que la
// fija, con la fecha de ese momento (regla confirmada por el usuario:
// "si se dio de alta manual sin onboarding entonces tomas la fecha que
// se usó en control al momento de darle guardar"). Es la misma mecánica
// para los 2 casos, sin bifurcar código — la diferencia la hace
// únicamente QUIÉN llegó primero a fijar el valor.

const { obtenerPool } = require('../db');
const { validarSlug } = require('./tenant');

const CICLOS_VALIDOS = ['mensual', 'anual'];
const ESTATUS_VALIDOS = ['prueba', 'pagada', 'pendiente', 'vencida', 'cancelada'];
const ORIGENES_VALIDOS = ['onboarding', 'manual'];

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

// Suma 1 mes o 1 año de calendario (nunca "30/365 días" — un ciclo
// mensual iniciado el 31 debe caer en el último día del mes siguiente,
// no 1-2 días después). Mismo criterio UTC-puro que sumarDias: esto es
// aritmética de calendario, no un instante real.
function sumarCiclo(fechaYYYYMMDD, ciclo) {
  const [anio, mes, dia] = fechaYYYYMMDD.split('-').map(Number);
  const mesesASumar = ciclo === 'anual' ? 12 : 1;
  const anioObjetivo = anio + Math.floor((mes - 1 + mesesASumar) / 12);
  const mesObjetivo = ((mes - 1 + mesesASumar) % 12) + 1;
  // Último día del mes objetivo (día 0 del mes siguiente) — clamp para
  // que un inicio el 31 de enero no se desborde a marzo al sumar 1 mes.
  const ultimoDiaMesObjetivo = new Date(Date.UTC(anioObjetivo, mesObjetivo, 0)).getUTCDate();
  const diaObjetivo = Math.min(dia, ultimoDiaMesObjetivo);
  const yy = anioObjetivo;
  const mm = String(mesObjetivo).padStart(2, '0');
  const dd = String(diaObjetivo).padStart(2, '0');
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
// pruebaIniciaEn/expiraEn/cicloIniciaEn NUNCA se leen de `datos` — se
// calculan aquí (ver comentario de cabecera). Si el cliente las manda de
// todas formas (código viejo, request manual), se ignoran a propósito.
// `origenForzado` ('onboarding') SOLO lo pasa onboardingConversion.js —
// la ruta HTTP de /control nunca lo expone, así que un admin no puede
// fingir que una suscripción vino de onboarding.
// Devuelve la fila completa del tenant después del UPDATE.
async function actualizarSuscripcionTenant(slug, datos = {}, { actor, db = obtenerPool(), origenForzado = null } = {}) {
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    throw new ErrorSuscripcionTenant(errorSlug, 'validacion');
  }
  if (origenForzado !== null && !ORIGENES_VALIDOS.includes(origenForzado)) {
    throw new ErrorSuscripcionTenant(`origenForzado inválido: ${origenForzado}.`, 'validacion');
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

  // "Se fija sola la primera vez" — mismo mecanismo para las 2 anclas
  // (prueba y ciclo de pago), cada una independiente de la otra: un
  // tenant puede tener ambas si pasó de prueba a pagado sin perder el
  // rastro de cuándo empezó su trial original.
  let pruebaIniciaEn;
  let expiraEn;
  if (enPrueba) {
    pruebaIniciaEn = fechaSoloDia(tenant.suscripcion_prueba_inicia_en) || hoyYYYYMMDD();
    expiraEn = diasPrueba ? sumarDias(pruebaIniciaEn, diasPrueba) : null;
  } else {
    // Apagado: se congelan los últimos valores conocidos, nunca se
    // borran (propuesta confirmada) — una reactivación futura los vuelve
    // a mostrar en vez de perder el rastro del trial anterior.
    pruebaIniciaEn = fechaSoloDia(tenant.suscripcion_prueba_inicia_en);
    expiraEn = fechaSoloDia(tenant.suscripcion_expira_en);

    // Suscripción DE PAGO (no-prueba): cicloIniciaEn se fija sola la
    // primera vez que este tenant pasa por aquí con un valor null (ya
    // sea porque onboardingConversion.js lo fijó antes, o porque este
    // es el primer guardado manual desde /control) y expiraEn se
    // recalcula siempre desde esa misma ancla + el ciclo vigente.
    if (ciclo) {
      const cicloIniciaEn = fechaSoloDia(tenant.suscripcion_ciclo_inicia_en) || hoyYYYYMMDD();
      expiraEn = sumarCiclo(cicloIniciaEn, ciclo);
      tenant.suscripcion_ciclo_inicia_en = cicloIniciaEn; // para el UPDATE de abajo
    }
  }

  const cicloIniciaEnFinal = fechaSoloDia(tenant.suscripcion_ciclo_inicia_en);
  // Se fija sola la primera vez, igual que las 2 anclas de fecha de
  // arriba: si el tenant ya tiene un origen guardado, se respeta tal
  // cual (nunca lo pisa un guardado posterior); si no, usa el forzado
  // por onboardingConversion.js o cae en 'manual' por default.
  const origen = tenant.suscripcion_origen || origenForzado || 'manual';

  const [resultado] = await db.query(
    `UPDATE tenants SET
       suscripcion_en_prueba = ?,
       suscripcion_dias_prueba = ?,
       suscripcion_prueba_inicia_en = ?,
       suscripcion_ciclo = ?,
       suscripcion_expira_en = ?,
       suscripcion_estatus = ?,
       suscripcion_ciclo_inicia_en = ?,
       suscripcion_origen = ?
     WHERE slug = ?`,
    // Orden de los primeros 6 params SIN CAMBIOS respecto a antes del
    // punto 416 (ver test/unit/tenantSuscripcion.test.js, que ya
    // indexaba por posición) — los 2 campos nuevos van al final a
    // propósito, para no romper esa indexación existente.
    [enPrueba, diasPrueba, pruebaIniciaEn, ciclo, expiraEn, estatus, cicloIniciaEnFinal, origen, slug]
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
    `slug=${slug} enPrueba=${enPrueba} diasPrueba=${diasPrueba ?? '-'} ciclo=${ciclo ?? '-'} expiraEn=${expiraEn ?? '-'} estatus=${estatus ?? '-'} origen=${origen ?? '-'}`,
    actor || null
  );

  return tenantActualizado;
}

module.exports = {
  ErrorSuscripcionTenant,
  actualizarSuscripcionTenant,
  CICLOS_VALIDOS,
  ESTATUS_VALIDOS,
  ORIGENES_VALIDOS,
  sumarCiclo,
};
