const fs = require('fs/promises');

// Lee el log estructurado que escribe VULTR/limpieza-docker.sh (una
// línea JSON por corrida, solo cuando de verdad podó algo) — Kerberos
// nunca ejecuta la limpieza ni toca el socket de Docker en modo
// escritura para esto, solo lee un archivo de texto plano, montado
// READ-ONLY (mismo criterio que el socket de Docker, ver
// utils/dockerClient.js). Si el archivo no existe todavía (servidor
// nuevo, o en local sin el timer real corriendo) regresa lista vacía —
// nunca un error, mismo patrón que el resto de "aviso-vacio" del
// tablero.
const RUTA_LOG = process.env.LIMPIEZA_LOG_PATH || '/var/log/clarvo-limpieza/limpieza.jsonl';
const MAX_CORRIDAS = 20;

async function listarCorridasLimpieza() {
  let contenido;
  try {
    contenido = await fs.readFile(RUTA_LOG, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const corridas = [];
  for (const linea of contenido.split('\n')) {
    const texto = linea.trim();
    if (!texto) continue;
    try {
      const obj = JSON.parse(texto);
      if (obj && typeof obj.ts === 'string' && Array.isArray(obj.contenedores)) {
        corridas.push(obj);
      }
    } catch (err) {
      // Línea corrupta/a medio escribir — se ignora en vez de tumbar
      // todo el endpoint (mismo criterio que el resto de Kerberos:
      // nunca dejar una sección entera sin datos por un solo renglón
      // malo).
    }
  }

  corridas.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return corridas.slice(0, MAX_CORRIDAS);
}

module.exports = { listarCorridasLimpieza, RUTA_LOG };
