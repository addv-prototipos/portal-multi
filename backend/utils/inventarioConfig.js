// Configuración de Inventarios por tenant (ver inventarios.md §0.6). Las
// claves viven en la tabla `configuracion` ya existente (clave/valor,
// PRIMARY KEY clave) — MISMO mecanismo que `iva_porcentaje`/`zona_horaria`,
// no una tabla `inventario_config` aparte. `pool` ya resuelve al tenant
// activo (proxy de db.js), así que estas funciones son per-tenant sin
// ningún parámetro extra, igual que backend/utils/config.js.
//
// Nota de auditoría (2026-08-24): la versión original de inventarios.md
// mencionaba una tabla `inventario_config` en un par de sitios (D4, §34.1,
// §47) que entraba en conflicto con D8/D10, que fijan estas mismas claves
// en `configuracion`. Se resuelve aquí a favor de `configuracion` — es el
// mecanismo que YA usan Marca/Tema/CxC/Ventas, coherente con el resto del
// proyecto; una tabla paralela solo para Inventarios habría sido
// duplicación sin beneficio.
function obtenerPool() {
  return require('../db').pool;
}

const CLAVES = {
  inventario_activo: { default: '0', tipo: 'booleano01' },
  // Solo bloquea la ALTA/vista de productos físicos — un servicio nunca
  // generó existencias/movimientos de todos modos (D11). Cada empresa
  // decide por sí misma (mismo mecanismo que inventario_activo, NO es
  // config de plataforma como ventas_afectan_inventario). El guard de
  // "no encender con productos activos" vive en el endpoint PUT de
  // server.js, no aquí (necesita consultar la tabla productos).
  inv_solo_servicios: { default: '0', tipo: 'booleano01' },
  inv_imagenes_activo: { default: '0', tipo: 'booleano01' },
  inv_imagen_max_mb: { default: '5', tipo: 'entero', min: 1, max: 20 },
  inv_imagen_max_por_producto: { default: '20', tipo: 'entero', min: 1, max: 50 },
  inv_imagen_cuota_mb: { default: '500', tipo: 'entero', min: 100, max: 5000 },
  inv_import_max_mb: { default: '5', tipo: 'entero', min: 1, max: 50 },
  inv_import_max_filas: { default: '10000', tipo: 'entero', min: 100, max: 100000 },
  // D4: fijada a '0' en v1, sin UI para cambiarla — se deja como clave
  // real (no solo un comentario) para que el motor de existencias
  // (registrarMovimiento) tenga un solo lugar de dónde leerla, listo
  // para cuando una fase futura decida exponerla.
  inv_permitir_negativo: { default: '0', tipo: 'booleano01' },
};

async function obtenerValorConfig(clave) {
  const definicion = CLAVES[clave];
  if (!definicion) return null;
  const pool = obtenerPool();
  const [filas] = await pool.query('SELECT valor FROM configuracion WHERE clave = ? LIMIT 1', [clave]);
  return filas.length > 0 ? filas[0].valor : definicion.default;
}

async function obtenerConfigInventario() {
  const resultado = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const clave of Object.keys(CLAVES)) {
    // eslint-disable-next-line no-await-in-loop
    resultado[clave] = await obtenerValorConfig(clave);
  }
  return resultado;
}

async function inventarioActivo() {
  const valor = await obtenerValorConfig('inventario_activo');
  return valor === '1';
}

async function negativoPermitido() {
  const valor = await obtenerValorConfig('inv_permitir_negativo');
  return valor === '1';
}

async function soloServiciosActivo() {
  const valor = await obtenerValorConfig('inv_solo_servicios');
  return valor === '1';
}

function validarValorConfig(clave, valorCrudo) {
  const definicion = CLAVES[clave];
  if (!definicion) return { error: `Clave de configuración no reconocida: ${clave}.` };
  if (definicion.tipo === 'booleano01') {
    if (valorCrudo !== '0' && valorCrudo !== '1') {
      return { error: `${clave} debe ser '0' o '1'.` };
    }
    return { valor: valorCrudo };
  }
  if (definicion.tipo === 'entero') {
    const numero = Number(valorCrudo);
    if (!Number.isInteger(numero) || numero < definicion.min || numero > definicion.max) {
      return { error: `${clave} debe ser un entero entre ${definicion.min} y ${definicion.max}.` };
    }
    return { valor: String(numero) };
  }
  return { error: `Clave de configuración no reconocida: ${clave}.` };
}

async function setValorConfig(clave, valorCrudo) {
  const validacion = validarValorConfig(clave, valorCrudo);
  if (validacion.error) return validacion;
  const pool = obtenerPool();
  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [clave, validacion.valor]
  );
  return { clave, valor: validacion.valor };
}

module.exports = {
  CLAVES,
  obtenerConfigInventario,
  obtenerValorConfig,
  inventarioActivo,
  negativoPermitido,
  soloServiciosActivo,
  validarValorConfig,
  setValorConfig,
};
