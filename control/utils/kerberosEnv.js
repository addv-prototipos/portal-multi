const fs = require('fs');
const path = require('path');

// Usuarios exclusivos de Kerberos (app de monitoreo, independiente de
// /control) — mismo mecanismo que adminEnv.js (usuario:pass en un .env
// dedicado), pero NUNCA el mismo archivo: ADMIN_USERS sigue siendo solo
// super admins de /control (y por diseño también entran a Kerberos, ver
// kerberos/utils/auth.js). KERBEROS_USERS es la lista de cuentas que
// SOLO pueden entrar a Kerberos, nunca a /control. Alta/edición/baja
// solo aquí, dentro de /control → Super Admins → pestaña "Usuarios
// Kerberos" — mismo criterio de gobernanza que el resto del proyecto
// (CLAUDE.md: "todo módulo se mapea en Control").
const ENV_PATH_CANDIDATOS = [
  process.env.KERBEROS_USERS_ENV_PATH,
  path.join(process.cwd(), 'kerberos-users.env'),
  path.join(__dirname, '..', 'kerberos-users.env'),
].filter(Boolean);

function resolverRutaEnv() {
  for (const p of ENV_PATH_CANDIDATOS) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return ENV_PATH_CANDIDATOS[0] || path.join(process.cwd(), 'kerberos-users.env');
}

function parsearKerberosUsers(raw) {
  const users = new Map();
  const source = (raw || '').trim();
  source.split(',').forEach((pair) => {
    const trimmed = pair.trim();
    if (!trimmed) return;
    const idx = trimmed.indexOf(':');
    if (idx === -1) return;
    const user = trimmed.slice(0, idx).trim();
    const pass = trimmed.slice(idx + 1);
    if (user) users.set(user, pass);
  });
  return users;
}

// Mismas reglas que adminEnv.js (validarUsuario/validarPassword) — se
// duplican a propósito (mismo criterio ya establecido: backend/ y
// control/ nunca comparten código entre builds de Docker).
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
  if (password.length < 8) return 'Contraseña mínimo 8 caracteres.';
  if (password.length > 128) return 'Contraseña máximo 128 caracteres.';
  if (/[,:\r\n"#]/.test(password)) {
    return 'Contraseña no puede contener "," ":" comillas, "#" ni saltos de línea.';
  }
  if (!/[0-9]/.test(password)) return 'Contraseña debe incluir al menos un número.';
  if (!/[a-z]/.test(password)) return 'Contraseña debe incluir al menos una letra minúscula.';
  if (!/[A-Z]/.test(password)) return 'Contraseña debe incluir al menos una letra mayúscula.';
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

function escribirEnvAtomico(ruta, contenido) {
  // Mismo criterio que adminEnv.js: este archivo también es un bind
  // mount de un solo archivo en Docker — write directo, no rename().
  fs.writeFileSync(ruta, contenido, 'utf8');
}

function leerKerberosUsersDeEnv(ruta) {
  const envPath = ruta || resolverRutaEnv();
  const raw = leerEnvRaw(envPath);
  const lineas = raw.split(/\r?\n/);
  let valor = null;
  for (const linea of lineas) {
    const m = linea.match(/^\s*KERBEROS_USERS\s*=\s*(.*)\s*$/);
    if (m) {
      valor = m[1].trim();
      if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
        valor = valor.slice(1, -1);
      }
    }
  }
  if (valor === null) {
    const envVar = process.env.KERBEROS_USERS && process.env.KERBEROS_USERS.trim();
    valor = envVar || '';
  }
  return { valor, envPath, raw };
}

function listarKerberosUsers() {
  const { valor } = leerKerberosUsersDeEnv();
  const map = parsearKerberosUsers(valor);
  return Array.from(map.keys()).sort();
}

function guardarKerberosUsersEnEnv(nuevoValor, ruta) {
  const envPath = ruta || resolverRutaEnv();
  let contenido = leerEnvRaw(envPath);
  const lineas = contenido ? contenido.split(/\r?\n/) : [];
  let encontrada = false;
  const nuevaLinea = `KERBEROS_USERS=${nuevoValor}`;
  const nuevasLineas = lineas.map((l) => {
    if (/^\s*KERBEROS_USERS\s*=/.test(l)) {
      encontrada = true;
      return nuevaLinea;
    }
    return l;
  });
  if (!encontrada) {
    if (nuevasLineas.length > 0 && nuevasLineas[nuevasLineas.length - 1] !== '') nuevasLineas.push('');
    if (nuevasLineas[nuevasLineas.length - 1] === '') {
      nuevasLineas.splice(nuevasLineas.length - 1, 0, nuevaLinea);
    } else {
      nuevasLineas.push(nuevaLinea);
    }
  }
  const nuevoContenido = nuevasLineas.join('\n');
  try {
    if (contenido) fs.writeFileSync(envPath + '.bak', contenido, 'utf8');
  } catch (_) {}
  escribirEnvAtomico(envPath, nuevoContenido.endsWith('\n') ? nuevoContenido : nuevoContenido + '\n');
  return { envPath, valor: nuevoValor };
}

async function notificarKerberosRecarga(nuevoValor) {
  const url = `${process.env.KERBEROS_INTERNAL_URL || 'http://kerberos:4100'}/internal/reload-kerberos-users`;
  const secreto = process.env.INTERNAL_CACHE_SECRET || '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secreto,
      },
      body: JSON.stringify({ kerberosUsers: nuevoValor }),
    });
    if (!res.ok) {
      console.error('No se pudo recargar KERBEROS_USERS en kerberos:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Error notificando recarga de KERBEROS_USERS al servicio kerberos:', err.message);
  }
}

module.exports = {
  resolverRutaEnv,
  parsearKerberosUsers,
  validarUsuario,
  validarPassword,
  leerKerberosUsersDeEnv,
  listarKerberosUsers,
  guardarKerberosUsersEnEnv,
  notificarKerberosRecarga,
};
