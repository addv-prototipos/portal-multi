const http = require('http');

// Cliente mínimo del Docker Engine API vía el socket Unix montado
// read-only (`/var/run/docker.sock:/var/run/docker.sock:ro` en
// docker-compose.yml) — sin dependencias nuevas (dockerode, etc.), solo
// http.request con socketPath. Kerberos SOLO hace GET (listar
// contenedores, stats, logs) — nunca start/stop/restart, ninguna función
// de escritura existe aquí a propósito (requisito explícito del
// usuario: "no se pueden apagar, solo es lectura").
const DOCKER_SOCKET = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
const METODOS_PERMITIDOS = new Set(['GET']);

function dockerRequest(path, { method = 'GET', timeoutMs = 5000 } = {}) {
  if (!METODOS_PERMITIDOS.has(method)) {
    return Promise.reject(new Error(`Método no permitido para Kerberos (solo lectura): ${method}`));
  }
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: DOCKER_SOCKET, path, method, timeout: timeoutMs },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(body ? JSON.parse(body) : null);
            } catch (e) {
              resolve(body);
            }
          } else {
            reject(new Error(`Docker API ${path} -> ${res.statusCode}: ${body.slice(0, 300)}`));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error(`Docker API timeout: ${path}`)));
    req.on('error', reject);
    req.end();
  });
}

// Streaming de texto plano (logs/stats con ?stream=false siguen siendo
// JSON/texto de una sola respuesta, no un stream real) — misma función,
// expuesta aparte para dejar explícito en los call sites qué endpoints
// devuelven texto (logs: multiplexed stdout/stderr frames) en vez de JSON.
function dockerRequestRaw(path, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: DOCKER_SOCKET, path, method: 'GET', timeout: timeoutMs },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(Buffer.concat(chunks));
          } else {
            reject(new Error(`Docker API ${path} -> ${res.statusCode}`));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error(`Docker API timeout: ${path}`)));
    req.on('error', reject);
    req.end();
  });
}

module.exports = { dockerRequest, dockerRequestRaw, DOCKER_SOCKET };
