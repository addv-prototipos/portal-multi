// Punto 416: evalúa si la suscripción de un tenant bloquea el acceso a
// /admin (nunca al portal de clientes — ver requireAdminAuth en auth.js,
// único consumidor real). Función pura, sin I/O, para poder probarla con
// Jest sin mocks de BD.
//
// Reglas (confirmadas por el usuario):
// - estatus null/undefined ("sin configurar"): NUNCA bloquea. Todo tenant
//   existente antes de este punto tiene este valor — tratarlo como
//   bloqueo sería apagar la administración de cada cliente activo el día
//   que esto se despliega. Bloquear es siempre opt-in, nunca retroactivo
//   por default.
// - estatus 'pagada': nunca bloquea.
// - estatus 'prueba': bloquea SOLO si ya pasó suscripcion_expira_en. Sin
//   fecha de expiración (trial recién prendido, sin días capturados
//   todavía), tampoco bloquea — un trial a medio configurar no debe
//   tumbar el acceso de quien lo está configurando.
// - estatus 'pendiente' | 'vencida' | 'cancelada': bloquea siempre,
//   sin importar fechas.
//
// El super admin (ADMIN_USERS, mecanismo 'admin_users') NUNCA pasa por
// aquí — ver auth.js, se filtra antes de llamar a esta función.
function hoyYYYYMMDD(zonaHoraria) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const obj = {};
  for (const parte of partes) obj[parte.type] = parte.value;
  return `${obj.year}-${obj.month}-${obj.day}`;
}

// Mismo criterio de zona fija que control/utils/tenantSuscripcion.js —
// esto es administrativo (cuándo vence un trial/ciclo), no un corte
// financiero por tenant.
const ZONA_NEGOCIO_CONTROL = 'America/Mexico_City';

const MOTIVOS = {
  prueba_vencida: {
    titulo: 'Tu periodo de prueba terminó',
    mensaje: (detalle) =>
      `Tu periodo de prueba venció el ${detalle.expiraEn}. Activa tu plan para seguir usando la administración sin interrupciones.`,
  },
  pendiente: {
    titulo: 'Tu pago está pendiente',
    mensaje: () => 'Aún no confirmamos tu pago de este ciclo. Actualiza tu método de pago para seguir usando la administración.',
  },
  vencida: {
    titulo: 'Tu suscripción venció',
    mensaje: (detalle) =>
      `El pago de tu ciclo de facturación (vencía el ${detalle.expiraEn}) no se completó a tiempo. Actualiza tu método de pago para reactivar el acceso.`,
  },
  cancelada: {
    titulo: 'Tu suscripción está cancelada',
    mensaje: () => 'Esta empresa canceló su suscripción. Contacta a tu administrador o reactiva el plan para volver a tener acceso.',
  },
};

// `tenant` acepta tanto la fila cruda (suscripcion_estatus) como el
// req.tenant ya construido por tenantContext.js (suscripcionEstatus) —
// ver el fallback de cada lectura abajo.
function evaluarBloqueoSuscripcion(tenant, { hoy = null } = {}) {
  if (!tenant) return { bloqueada: false };

  const estatus = tenant.suscripcionEstatus ?? tenant.suscripcion_estatus ?? null;
  const expiraEn = tenant.suscripcionExpiraEn ?? tenant.suscripcion_expira_en ?? null;
  const expiraEnSoloDia = expiraEn ? String(expiraEn).slice(0, 10) : null;

  if (!estatus || estatus === 'pagada') {
    return { bloqueada: false };
  }

  if (estatus === 'prueba') {
    if (!expiraEnSoloDia) return { bloqueada: false };
    const hoyStr = hoy || hoyYYYYMMDD(ZONA_NEGOCIO_CONTROL);
    if (hoyStr <= expiraEnSoloDia) return { bloqueada: false };
    const m = MOTIVOS.prueba_vencida;
    return {
      bloqueada: true,
      motivo: 'prueba_vencida',
      titulo: m.titulo,
      mensaje: m.mensaje({ expiraEn: expiraEnSoloDia }),
      expiraEn: expiraEnSoloDia,
      portalClientesActivo: true,
    };
  }

  if (estatus === 'pendiente' || estatus === 'vencida' || estatus === 'cancelada') {
    const m = MOTIVOS[estatus];
    return {
      bloqueada: true,
      motivo: estatus,
      titulo: m.titulo,
      mensaje: m.mensaje({ expiraEn: expiraEnSoloDia }),
      expiraEn: expiraEnSoloDia,
      portalClientesActivo: true,
    };
  }

  // Valor de enum inesperado (no debería pasar, ESTATUS_VALIDOS lo
  // impide en origen) — fail-open a propósito: un valor desconocido
  // nunca debe tumbar el acceso de un cliente real.
  return { bloqueada: false };
}

module.exports = { evaluarBloqueoSuscripcion };
