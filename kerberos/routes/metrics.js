const http = require('http');
const https = require('https');
const express = require('express');

const { dockerRequest, dockerRequestRaw } = require('../utils/dockerClient');

const TIMEOUT_HEALTH_MS = 2000;
const LINEAS_LOG_DEFAULT = 200;
const LINEAS_LOG_MAX = 1000;
const ERROR_DOCKER = 'No se pudo conectar con el motor de Docker.';

// El id llega a la ruta del socket de Docker — se valida contra un
// alfabeto cerrado para que nunca pueda inyectar otro segmento de path
// (el cliente ya bloquea cualquier método distinto de GET, esto cierra la
// otra mitad del riesgo).
const ID_CONTENEDOR_VALIDO = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

// Pedido explícito del usuario (con captura): 5 checks, uno por cada
// superficie que necesita ver arriba — sitio público, admin y portal de
// clientes se verifican de punta a punta (a través de nginx, con la URL
// pública real), control y backend se verifican internos (contra su
// propio healthcheck, dentro de la red de Docker).
const SERVICIOS_HEALTH = [
  { nombre: 'sitio', variable: 'SITE_HEALTH_URL' },
  { nombre: 'admin', variable: 'ADMIN_HEALTH_URL' },
  { nombre: 'portal', variable: 'PORTAL_HEALTH_URL' },
  { nombre: 'control', variable: 'CONTROL_HEALTH_URL' },
  { nombre: 'backend', variable: 'BACKEND_HEALTH_URL' },
];

function aMegabytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return null;
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function redondearPct(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  return Math.round(valor * 100) / 100;
}

// El % de CPU no viene como campo en el JSON de stats de Docker: se
// calcula contra el delta del snapshot anterior (precpu_stats).
function calcularCpuPct(stats) {
  const cpu = stats?.cpu_stats;
  const precpu = stats?.precpu_stats;
  if (!cpu?.cpu_usage || !precpu?.cpu_usage) return null;
  const cpuDelta = cpu.cpu_usage.total_usage - precpu.cpu_usage.total_usage;
  const systemDelta = cpu.system_cpu_usage - precpu.system_cpu_usage;
  const numCpus = cpu.online_cpus || (cpu.cpu_usage.percpu_usage || []).length || 1;
  if (!(systemDelta > 0) || !(cpuDelta > 0)) return 0;
  return redondearPct((cpuDelta / systemDelta) * numCpus * 100);
}

function calcularMemoria(stats) {
  const usada = stats?.memory_stats?.usage;
  const limite = stats?.memory_stats?.limit;
  const memUsadaMb = aMegabytes(usada);
  const memLimiteMb = aMegabytes(limite);
  const memPct = memUsadaMb !== null && memLimiteMb !== null && limite > 0
    ? redondearPct((usada / limite) * 100)
    : null;
  return { memUsadaMb, memLimiteMb, memPct };
}

function mapearPuertos(puertos) {
  if (!Array.isArray(puertos)) return [];
  return puertos.map((p) => ({
    privado: p.PrivatePort ?? null,
    publico: p.PublicPort ?? null,
    tipo: p.Type || null,
  }));
}

function resolverSalud(detalle) {
  if (!detalle) return null;
  const estadoSalud = detalle?.State?.Health?.Status;
  return estadoSalud || 'sin_healthcheck';
}

async function describirContenedor(resumen) {
  const id = resumen.Id;
  // Un contenedor detenido hace que Docker rechace /stats — eso nunca
  // debe tumbar la respuesta completa, solo deja sus métricas en null.
  const [stats, detalle] = await Promise.all([
    dockerRequest(`/containers/${encodeURIComponent(id)}/stats?stream=false`).catch(() => null),
    dockerRequest(`/containers/${encodeURIComponent(id)}/json`).catch(() => null),
  ]);

  const memoria = stats ? calcularMemoria(stats) : { memUsadaMb: null, memLimiteMb: null, memPct: null };

  return {
    id,
    nombre: (resumen.Names?.[0] || '').replace(/^\//, '') || null,
    imagen: resumen.Image || null,
    estado: resumen.State || null,
    salud: resolverSalud(detalle),
    creadoEn: typeof resumen.Created === 'number'
      ? new Date(resumen.Created * 1000).toISOString()
      : null,
    cpuPct: stats ? calcularCpuPct(stats) : null,
    memUsadaMb: memoria.memUsadaMb,
    memLimiteMb: memoria.memLimiteMb,
    memPct: memoria.memPct,
    puertos: mapearPuertos(resumen.Ports),
  };
}

async function listarContenedores() {
  const lista = await dockerRequest('/containers/json?all=true');
  if (!Array.isArray(lista)) return [];
  return Promise.all(lista.map(describirContenedor));
}

function clasificarNivel(texto) {
  if (/error|ERROR|Error:|FATAL|Exception/.test(texto)) return 'error';
  if (/warn|WARN|WARNING/.test(texto)) return 'warn';
  return 'info';
}

function separarTimestamp(lineaCruda) {
  const coincidencia = /^(\d{4}-\d{2}-\d{2}T\S+)\s?([\s\S]*)$/.exec(lineaCruda);
  if (!coincidencia) return { timestamp: null, texto: lineaCruda };
  return { timestamp: coincidencia[1], texto: coincidencia[2] };
}

function construirLinea(lineaCruda, canal) {
  const { timestamp, texto } = separarTimestamp(lineaCruda);
  return { timestamp, canal, nivel: clasificarNivel(texto), texto };
}

function partirEnLineas(bloque, canal, acumulador) {
  for (const cruda of bloque.split('\n')) {
    if (!cruda.trim()) continue;
    acumulador.push(construirLinea(cruda.replace(/\r$/, ''), canal));
  }
}

// Sin TTY, Docker devuelve los logs multiplexados: 8 bytes de header
// (byte 0 = canal, bytes 4-7 = largo big-endian del payload) + payload.
// Con TTY el stream es texto plano sin headers, de ahí el reconocimiento
// del primer byte antes de intentar desmultiplexar.
function parsearLogsDocker(buffer) {
  const lineas = [];
  if (!buffer || buffer.length === 0) return lineas;

  if (buffer[0] !== 0 && buffer[0] !== 1 && buffer[0] !== 2) {
    partirEnLineas(buffer.toString('utf8'), 'stdout', lineas);
    return lineas;
  }

  let posicion = 0;
  while (posicion + 8 <= buffer.length) {
    const canal = buffer[posicion] === 2 ? 'stderr' : 'stdout';
    const largo = buffer.readUInt32BE(posicion + 4);
    const inicio = posicion + 8;
    const fin = inicio + largo;
    if (fin > buffer.length) break;
    partirEnLineas(buffer.slice(inicio, fin).toString('utf8'), canal, lineas);
    posicion = fin;
  }
  return lineas;
}

function revisarServicio(nombre, url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve({ nombre, url: null, disponible: false, statusCode: null, latenciaMs: null, error: 'URL no configurada' });
      return;
    }

    let destino;
    try {
      destino = new URL(url);
    } catch (e) {
      resolve({ nombre, url, disponible: false, statusCode: null, latenciaMs: null, error: 'URL inválida' });
      return;
    }

    // Sitio/admin/portal viajan como https://clarvo.mx/... (verificación
    // de punta a punta, por la URL pública real) — control/backend siguen
    // como http:// internos (nombre de servicio de Docker). El módulo y
    // el puerto por default se eligen según el protocolo de la URL, nunca
    // asumidos como http:80.
    const cliente = destino.protocol === 'https:' ? https : http;
    const puertoDefault = destino.protocol === 'https:' ? 443 : 80;
    const inicio = Date.now();
    const peticion = cliente.request(
      {
        hostname: destino.hostname,
        port: destino.port || puertoDefault,
        path: `${destino.pathname}${destino.search}`,
        method: 'GET',
        timeout: TIMEOUT_HEALTH_MS,
      },
      (respuesta) => {
        respuesta.resume();
        respuesta.on('end', () => {
          resolve({
            nombre,
            url,
            disponible: respuesta.statusCode >= 200 && respuesta.statusCode < 400,
            statusCode: respuesta.statusCode,
            latenciaMs: Date.now() - inicio,
          });
        });
      }
    );
    peticion.on('timeout', () => peticion.destroy(new Error('Tiempo de espera agotado')));
    peticion.on('error', (err) => {
      resolve({
        nombre,
        url,
        disponible: false,
        statusCode: null,
        latenciaMs: Date.now() - inicio,
        error: err.message,
      });
    });
    peticion.end();
  });
}

function revisarServiciosDelStack() {
  return Promise.all(
    SERVICIOS_HEALTH.map(({ nombre, variable }) => revisarServicio(nombre, process.env[variable] || ''))
  );
}

module.exports = function metricsRouter() {
  const router = express.Router();

  router.get('/containers', async (req, res) => {
    try {
      const contenedores = await listarContenedores();
      res.json({ ok: true, contenedores });
    } catch (err) {
      console.error('Kerberos /containers:', err.message);
      res.status(503).json({ ok: false, error: ERROR_DOCKER });
    }
  });

  router.get('/containers/:id/logs', async (req, res) => {
    const { id } = req.params;
    if (!ID_CONTENEDOR_VALIDO.test(id)) {
      res.status(400).json({ ok: false, error: 'Identificador de contenedor inválido.' });
      return;
    }

    const solicitadas = Number.parseInt(req.query.lines, 10);
    const lineasPedidas = Number.isFinite(solicitadas) && solicitadas > 0
      ? Math.min(solicitadas, LINEAS_LOG_MAX)
      : LINEAS_LOG_DEFAULT;

    try {
      const crudo = await dockerRequestRaw(
        `/containers/${encodeURIComponent(id)}/logs?stdout=1&stderr=1&tail=${lineasPedidas}&timestamps=1`
      );
      res.json({ ok: true, contenedorId: id, lineas: parsearLogsDocker(crudo) });
    } catch (err) {
      console.error('Kerberos /containers/:id/logs:', err.message);
      if (/-> 404/.test(err.message)) {
        res.status(404).json({ ok: false, error: 'Contenedor no encontrado.' });
        return;
      }
      res.status(503).json({ ok: false, error: ERROR_DOCKER });
    }
  });

  router.get('/health', async (req, res) => {
    try {
      const checks = await revisarServiciosDelStack();
      res.json({ ok: true, checks });
    } catch (err) {
      console.error('Kerberos /health:', err.message);
      res.status(500).json({ ok: false, error: 'No se pudieron revisar los servicios del stack.' });
    }
  });

  router.get('/overview', async (req, res) => {
    try {
      const [contenedores, info, checks] = await Promise.all([
        listarContenedores(),
        dockerRequest('/info').catch(() => null),
        revisarServiciosDelStack(),
      ]);

      res.json({
        ok: true,
        resumen: {
          contenedoresTotal: contenedores.length,
          contenedoresCorriendo: contenedores.filter((c) => c.estado === 'running').length,
          contenedoresDetenidos: contenedores.filter((c) => c.estado !== 'running').length,
          // Bug real encontrado en producción (punto 473, addendum):
          // Docker conserva el ÚLTIMO healthcheck conocido de un
          // contenedor incluso después de que se detiene — sin filtrar
          // por "running" primero, una tarea VIEJA de Swarm (dejada por
          // un `docker service update --force` anterior, nunca borrada
          // sola) que haya fallado su healthcheck justo antes de
          // apagarse se contaba como "con problema" para siempre,
          // aunque ya ni siquiera exista de verdad. Solo cuenta
          // problemas de contenedores que SÍ están corriendo ahora.
          contenedoresConProblema: contenedores.filter((c) => c.estado === 'running' && c.salud === 'unhealthy').length,
          cpuHostNucleos: typeof info?.NCPU === 'number' ? info.NCPU : null,
          memHostTotalMb: aMegabytes(info?.MemTotal),
          healthChecks: checks,
        },
      });
    } catch (err) {
      console.error('Kerberos /overview:', err.message);
      res.status(503).json({ ok: false, error: ERROR_DOCKER });
    }
  });

  return router;
};
