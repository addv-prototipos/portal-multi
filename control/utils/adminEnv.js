const fs = require('fs');
const path = require('path');

// Bug real corregido (2026-09-10): "/app/.env" no existe en la imagen de
// control (Dockerfile usa WORKDIR /usr/src/app, sin ningún "/app") — Docker
// creaba ese directorio al montar el volumen, propiedad de root sin permiso
// de escritura para "appuser", y CUALQUIER guardado fallaba con EACCES.
// `path.join(__dirname, '..', '.env')` YA resuelve a la ruta real
// (/usr/src/app/.env, control/utils/adminEnv.js -> control/.env) — se quita
// el candidato equivocado y el que subía un nivel de más.
const ENV_PATH_CANDIDATOS = [
  process.env.ADMIN_USERS_ENV_PATH,
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '..', '.env'),
].filter(Boolean);

function resolverRutaEnv() {
  for (const p of ENV_PATH_CANDIDATOS) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  // Si ninguno existe, usa el primero configurable o el cwd
  return ENV_PATH_CANDIDATOS[0] || path.join(process.cwd(), '.env');
}

function parsearAdminUsers(raw) {
  const users = new Map();
  const source = (raw || '').trim() || 'admin:admin';
  source.split(',').forEach((pair) => {
    const trimmed = pair.trim();
    if (!trimmed) return;
    const idx = trimmed.indexOf(':');
    if (idx === -1) return;
    const user = trimmed.slice(0, idx).trim();
    const pass = trimmed.slice(idx + 1);
    if (user) users.set(user, pass);
  });
  if (users.size === 0) users.set('admin', 'admin');
  return users;
}

function validarUsuario(usuario) {
  if (!usuario || typeof usuario !== 'string') return 'Usuario requerido.';
  const u = usuario.trim();
  if (u.length < 3) return 'Usuario mínimo 3 caracteres.';
  if (u.length > 64) return 'Usuario máximo 64 caracteres.';
  if (!/^[A-Za-z0-9._-]+$/.test(u)) return 'Usuario solo letras, números, punto, guión y guión bajo.';
  return null;
}

function validarPassword(password) {
  if (!password || typeof password !== 'string') return 'Contraseña requerida.';
  if (password.length < 6) return 'Contraseña mínimo 6 caracteres.';
  if (password.length > 128) return 'Contraseña máximo 128 caracteres.';
  if (password.includes(',') || password.includes(':')) return 'Contraseña no puede contener "," ni ":".';
  return null;
}

function leerEnvRaw(ruta) {
  try {
    return fs.readFileSync(ruta, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

// Bug real corregido (2026-09-10, validado contra Docker real): el patrón
// "escribir a un temporal + rename()" —pensado para ser atómico— FALLA
// siempre con EBUSY cuando `ruta` es un bind mount de UN SOLO ARCHIVO
// (como ./.env:/usr/src/app/.env:rw en docker-compose.yml): Docker no
// permite reemplazar el inodo montado vía rename, solo escribirlo
// directamente. `fs.writeFileSync` directo SÍ funciona en ese mismo mount
// (confirmado). Se pierde la atomicidad "real" (una lectura concurrente
// podría ver el archivo a medio escribir), aceptable aquí: el `.bak` ya
// escrito ANTES de esta llamada (ver guardarAdminUsersEnEnv) seguiría
// siendo la fuente de recuperación si algo sale mal a medias.
function escribirEnvAtomico(ruta, contenido) {
  fs.writeFileSync(ruta, contenido, 'utf8');
}

function leerAdminUsersDeEnv(ruta) {
  const envPath = ruta || resolverRutaEnv();
  const raw = leerEnvRaw(envPath);
  const lineas = raw.split(/\r?\n/);
  let valor = null;
  for (const linea of lineas) {
    const m = linea.match(/^\s*ADMIN_USERS\s*=\s*(.*)\s*$/);
    if (m) {
      valor = m[1].trim();
      // Quitar comillas si las hay
      if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
        valor = valor.slice(1, -1);
      }
    }
  }
  // Si no hay línea, usa process.env o default
  if (valor === null) {
    const envVar = process.env.ADMIN_USERS && process.env.ADMIN_USERS.trim();
    valor = envVar || 'admin:admin';
  }
  return { valor, envPath, raw };
}

function listarSuperAdmins() {
  const { valor } = leerAdminUsersDeEnv();
  const map = parsearAdminUsers(valor);
  // Solo expone usuarios, nunca contraseñas
  return Array.from(map.keys()).sort();
}

function guardarAdminUsersEnEnv(nuevoValor, ruta) {
  const envPath = ruta || resolverRutaEnv();
  let contenido = leerEnvRaw(envPath);
  const lineas = contenido ? contenido.split(/\r?\n/) : [];
  let encontrada = false;
  const nuevaLinea = `ADMIN_USERS=${nuevoValor}`;
  const nuevasLineas = lineas.map((l) => {
    if (/^\s*ADMIN_USERS\s*=/.test(l)) {
      encontrada = true;
      return nuevaLinea;
    }
    return l;
  });
  if (!encontrada) {
    // Añade al final, asegurando newline
    if (nuevasLineas.length > 0 && nuevasLineas[nuevasLineas.length - 1] !== '') nuevasLineas.push('');
    // Inserta antes del último vacío si lo hay
    if (nuevasLineas[nuevasLineas.length - 1] === '') {
      nuevasLineas.splice(nuevasLineas.length - 1, 0, nuevaLinea);
    } else {
      nuevasLineas.push(nuevaLinea);
    }
  }
  const nuevoContenido = nuevasLineas.join('\n');
  // Backup opcional: .env.bak
  try {
    if (contenido) fs.writeFileSync(envPath + '.bak', contenido, 'utf8');
  } catch (_) {}
  escribirEnvAtomico(envPath, nuevoContenido.endsWith('\n') ? nuevoContenido : nuevoContenido + '\n');
  return { envPath, valor: nuevoValor };
}

async function notificarBackendRecarga(nuevoValor) {
  const url = `${process.env.BACKEND_INTERNAL_URL || 'http://backend:4000'}/internal/reload-admin-users`;
  const secreto = process.env.INTERNAL_CACHE_SECRET || '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secreto,
      },
      body: JSON.stringify({ adminUsers: nuevoValor }),
    });
    if (!res.ok) {
      console.error('No se pudo recargar ADMIN_USERS en backend:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Error notificando recarga de ADMIN_USERS al backend:', err.message);
  }
}

class ErrorAdminEnv extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

module.exports = {
  resolverRutaEnv,
  parsearAdminUsers,
  validarUsuario,
  validarPassword,
  leerAdminUsersDeEnv,
  listarSuperAdmins,
  guardarAdminUsersEnEnv,
  notificarBackendRecarga,
  ErrorAdminEnv,
};
