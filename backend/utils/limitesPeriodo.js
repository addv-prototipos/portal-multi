// Límites de período (día / mes) calculados en la zona horaria que eligió
// el administrador (`configuracion_global.zona_horaria`), expuestos SIEMPRE
// en dos formas a la vez, porque las columnas del esquema no guardan la
// fecha igual:
//
//  * `instantes` — objetos `Date` en UTC que marcan el INICIO/FIN REAL del
//    período en esa zona horaria. Son los que van como parámetro de
//    columnas DATETIME guardadas en UTC (ordenes_compra.fecha_compra,
//    movimientos_inventario.creado_en, tickets.creado_en,
//    gastos.creado_en). Ej.: el 5/oct en America/Mexico_City (UTC−6) es
//    [2026-10-05T06:00Z, 2026-10-06T06:00Z).
//
//  * `fechas` — strings "YYYY-MM-DD" del calendario local. Son los que van
//    como parámetro de columnas DATE que guardan la fecha de calendario
//    elegida por el usuario (gastos.fecha). Ej.: '2026-10-05'.
//
// Confundir ambas familias es el bug de las tarjetas "Ventas hoy" /
// "Movs. de inventario" en $0 (ver PROJECT_STATE.md): anclar el día local
// a MEDIANOCHE UTC corre la ventana 6 horas (México está en UTC−6) y deja
// fuera de "hoy" todo lo ocurrido a partir de las 18:00 hora local. Peor
// todavía: pasarle un `Date` de medianoche UTC a una columna DATE "funciona"
// por accidente, así que el error pasa inadvertido en Gastos y se nota en
// Ventas/Inventarios — exactamente el síntoma que se reportó.
//
// Nota sobre DST: se usa un cálculo de dos pasadas del offset para que el
// cambio de horario (solo America/Tijuana sigue atado a EE. UU.; el resto
// de México abolió el horario de verano en 2022) no corra la medianoche.

const OPCIONES_HORA_COMPLETA = {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

function valorDePartes(partes, tipo) {
  const parte = partes.find((p) => p.type === tipo);
  return parte ? Number(parte.value) : 0;
}

/**
 * Desplazamiento de `zonaHoraria` respecto a UTC (en ms, = hora local −
 * hora UTC) para el instante dado. Ej.: America/Mexico_City → -21600000.
 */
function desplazamientoZona(zonaHoraria, instante) {
  const partes = new Intl.DateTimeFormat('en-US', { ...OPCIONES_HORA_COMPLETA, timeZone: zonaHoraria }).formatToParts(
    instante
  );
  // Algunas versiones de ICU devuelven "24" como hora de medianoche con
  // hour12:false — el módulo 24 lo normaliza sin afectar a las demás.
  const comoUtc = Date.UTC(
    valorDePartes(partes, 'year'),
    valorDePartes(partes, 'month') - 1,
    valorDePartes(partes, 'day'),
    valorDePartes(partes, 'hour') % 24,
    valorDePartes(partes, 'minute'),
    valorDePartes(partes, 'second')
  );
  return comoUtc - instante.getTime();
}

/** Fecha de calendario { anio, mes, dia } de `instante` en `zonaHoraria`. */
function fechaLocalZona(zonaHoraria, instante = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);
  return {
    anio: valorDePartes(partes, 'year'),
    mes: valorDePartes(partes, 'month'),
    dia: valorDePartes(partes, 'day'),
  };
}

/**
 * Instante UTC de la MEDIANOCHE LOCAL del calendario (anio, mes, dia) en
 * `zonaHoraria`. `mes`/`dia` se normalizan como en Date.UTC (13 = enero
 * siguiente, 0 = último día del mes anterior), así que servir tanto para
 * "día siguiente" como para "hace 7 días".
 */
function medianocheLocal(anio, mes, dia, zonaHoraria) {
  const pared = Date.UTC(anio, mes - 1, dia);
  const primera = new Date(pared - desplazamientoZona(zonaHoraria, new Date(pared)));
  // Segunda pasada: cerca de un cambio de horario el offset calculado en
  // la primera puede no ser el vigente en la medianoche resultante.
  return new Date(pared - desplazamientoZona(zonaHoraria, primera));
}

/** "YYYY-MM-DD" del calendario (anio, mes, dia), normalizado como Date.UTC. */
function cadenaFecha(anio, mes, dia) {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  const rellenar = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${rellenar(d.getUTCMonth() + 1)}-${rellenar(d.getUTCDate())}`;
}

/**
 * "Hoy" y "los 7 días anteriores a hoy" (excluyendo hoy, para no
 * comparar el día contra sí mismo) en la zona horaria configurada.
 * Punto 362 — tarjetas de la vista "Inicio".
 */
function limitesDia(zonaHoraria, ahora = new Date()) {
  const { anio, mes, dia } = fechaLocalZona(zonaHoraria, ahora);
  return {
    instantes: {
      inicioHoy: medianocheLocal(anio, mes, dia, zonaHoraria),
      finHoy: medianocheLocal(anio, mes, dia + 1, zonaHoraria), // exclusivo
      inicio7d: medianocheLocal(anio, mes, dia - 7, zonaHoraria),
    },
    fechas: {
      hoy: cadenaFecha(anio, mes, dia),
      manana: cadenaFecha(anio, mes, dia + 1), // exclusivo
      hace7d: cadenaFecha(anio, mes, dia - 7),
    },
  };
}

/**
 * Mes actual y mes anterior en la zona horaria configurada.
 * Gastos usa columna DATE (fechas), el resumen financiero mezcla DATE con
 * DATETIME (instantes) — por eso salen las dos familias.
 */
function limitesMes(zonaHoraria, ahora = new Date()) {
  const { anio, mes } = fechaLocalZona(zonaHoraria, ahora);
  return {
    instantes: {
      inicio: medianocheLocal(anio, mes, 1, zonaHoraria),
      fin: medianocheLocal(anio, mes + 1, 1, zonaHoraria), // exclusivo
      inicioAnterior: medianocheLocal(anio, mes - 1, 1, zonaHoraria),
      finAnterior: medianocheLocal(anio, mes, 1, zonaHoraria), // exclusivo
    },
    fechas: {
      inicio: cadenaFecha(anio, mes, 1),
      fin: cadenaFecha(anio, mes + 1, 1), // exclusivo
      inicioAnterior: cadenaFecha(anio, mes - 1, 1),
      finAnterior: cadenaFecha(anio, mes, 1), // exclusivo
    },
  };
}

module.exports = { limitesDia, limitesMes, medianocheLocal, fechaLocalZona, cadenaFecha };
