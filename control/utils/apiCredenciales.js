const crypto = require('crypto');

function generarPasswordApi(longitud = 24) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const rnd = crypto.randomBytes(longitud);
  for (let i = 0; i < longitud; i++) out += chars[rnd[i] % chars.length];
  return out;
}

function generarClaveApi(longitud = 32) {
  // clave API para cookieAuth / header X-API-Key — formato sk_<slug>_<random> no necesario, solo aleatoria
  return 'sk_' + generarPasswordApi(longitud);
}

function hashPasswordApi(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasswordApi(password, hash) {
  if (!hash || !hash.includes(':')) return false;
  const [salt, expected] = hash.split(':');
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(derived, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

function obtenerPool() {
  return require('../db').obtenerPool();
}

async function listarCredencialesPorTenant(slug) {
  const [filas] = await obtenerPool().query(
    'SELECT id, tenant_slug, api_usuario, activo, creado_por, creado_en, actualizado_en, CASE WHEN api_key_hash IS NOT NULL THEN 1 ELSE 0 END as tiene_clave FROM api_credenciales WHERE tenant_slug = ? ORDER BY id DESC',
    [slug]
  );
  return filas;
}

async function obtenerCredencialActivaPorUsuario(apiUsuario) {
  const [filas] = await obtenerPool().query(
    'SELECT c.*, t.slug as tenant_slug FROM api_credenciales c JOIN tenants t ON t.slug = c.tenant_slug WHERE c.api_usuario = ? AND c.activo = 1 LIMIT 1',
    [apiUsuario]
  );
  return filas[0] || null;
}

async function obtenerCredencialActivaPorApiKey(apiKey, tenantSlug) {
  if (!apiKey || !tenantSlug) return null;
  const [filas] = await obtenerPool().query(
    'SELECT * FROM api_credenciales WHERE tenant_slug = ? AND activo = 1 LIMIT 10',
    [tenantSlug]
  );
  for (const fila of filas) {
    if (fila.api_key_hash && verifyPasswordApi(apiKey, fila.api_key_hash)) return fila;
  }
  return null;
}

async function crearCredencialApi(tenantSlug, actor) {
  const existente = await listarCredencialesPorTenant(tenantSlug);
  if (existente.length > 0 && existente.some((c) => c.activo)) {
    const err = new Error('Ya existe una credencial activa para esta empresa. Rótala o revócala primero.');
    err.codigo = 'ya_existe';
    throw err;
  }
  const apiUsuario = `${tenantSlug}_api`;
  // Si existe usuario global duplicado (reuso slug viejo), agregar sufijo
  let usuarioFinal = apiUsuario;
  let sufijo = 2;
  while (true) {
    const [existe] = await obtenerPool().query('SELECT id FROM api_credenciales WHERE api_usuario = ? LIMIT 1', [usuarioFinal]);
    if (existe.length === 0) break;
    usuarioFinal = `${apiUsuario}${sufijo}`;
    sufijo += 1;
    if (sufijo > 100) throw new Error('No se pudo generar usuario único');
  }
  const passwordPlano = generarPasswordApi(24);
  const hash = hashPasswordApi(passwordPlano);
  const clavePlana = generarClaveApi(32);
  const claveHash = hashPasswordApi(clavePlana);
  const ahora = new Date();
  const [res] = await obtenerPool().query(
    'INSERT INTO api_credenciales (tenant_slug, api_usuario, password_hash, api_key_hash, activo, creado_por, creado_en, actualizado_en) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
    [tenantSlug, usuarioFinal, hash, claveHash, actor || null, ahora, ahora]
  );
  return { id: res.insertId, tenant_slug: tenantSlug, api_usuario: usuarioFinal, password_plano: passwordPlano, clave_api: clavePlana, activo: 1 };
}

async function rotarCredencialApi(id, tenantSlug, actor) {
  const [filas] = await obtenerPool().query('SELECT * FROM api_credenciales WHERE id = ? AND tenant_slug = ? LIMIT 1', [id, tenantSlug]);
  if (filas.length === 0) {
    const err = new Error('Credencial no encontrada.');
    err.codigo = 'no_encontrado';
    throw err;
  }
  const passwordPlano = generarPasswordApi(24);
  const hash = hashPasswordApi(passwordPlano);
  const clavePlana = generarClaveApi(32);
  const claveHash = hashPasswordApi(clavePlana);
  await obtenerPool().query('UPDATE api_credenciales SET password_hash = ?, api_key_hash = ?, actualizado_en = ?, creado_por = ? WHERE id = ?', [hash, claveHash, new Date(), actor || null, id]);
  return { ...filas[0], password_plano: passwordPlano, clave_api: clavePlana };
}

async function revocarCredencialApi(id, tenantSlug) {
  const [filas] = await obtenerPool().query('SELECT * FROM api_credenciales WHERE id = ? AND tenant_slug = ? LIMIT 1', [id, tenantSlug]);
  if (filas.length === 0) {
    const err = new Error('Credencial no encontrada.');
    err.codigo = 'no_encontrado';
    throw err;
  }
  await obtenerPool().query('UPDATE api_credenciales SET activo = 0, actualizado_en = ? WHERE id = ?', [new Date(), id]);
  return { ok: true };
}

class ErrorApiCredencial extends Error {
  constructor(message, codigo) {
    super(message);
    this.codigo = codigo;
  }
}

module.exports = {
  generarPasswordApi,
  generarClaveApi,
  hashPasswordApi,
  verifyPasswordApi,
  listarCredencialesPorTenant,
  obtenerCredencialActivaPorUsuario,
  obtenerCredencialActivaPorApiKey,
  crearCredencialApi,
  rotarCredencialApi,
  revocarCredencialApi,
  ErrorApiCredencial,
};
