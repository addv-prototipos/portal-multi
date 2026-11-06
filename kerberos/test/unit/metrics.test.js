const http = require('http');
const express = require('express');
const request = require('supertest');

jest.mock('../../utils/dockerClient', () => ({
  dockerRequest: jest.fn(),
  dockerRequestRaw: jest.fn(),
}));

const { dockerRequest, dockerRequestRaw } = require('../../utils/dockerClient');
const metricsRouter = require('../../routes/metrics');

function crearApp() {
  const app = express();
  app.use('/api/kerberos', metricsRouter());
  return app;
}

const RESUMEN_BACKEND = {
  Id: 'abc123',
  Names: ['/clrv-backend'],
  Image: 'clarvo-app-backend',
  State: 'running',
  Created: 1762300000,
  Ports: [{ PrivatePort: 4000, PublicPort: 4000, Type: 'tcp' }],
};

const RESUMEN_DETENIDO = {
  Id: 'def456',
  Names: ['/clrv-garage-init'],
  Image: 'clarvo-app-garage-init',
  State: 'exited',
  Created: 1762300500,
  Ports: [],
};

const STATS_BACKEND = {
  cpu_stats: {
    cpu_usage: { total_usage: 2000000 },
    system_cpu_usage: 100000000,
    online_cpus: 2,
  },
  precpu_stats: {
    cpu_usage: { total_usage: 1000000 },
    system_cpu_usage: 50000000,
  },
  memory_stats: { usage: 104857600, limit: 1073741824 },
};

// Arma un frame multiplexado como el que devuelve Docker sin TTY:
// 8 bytes de header (canal + largo big-endian) + payload.
function frameDocker(canal, texto) {
  const payload = Buffer.from(texto, 'utf8');
  const header = Buffer.alloc(8);
  header[0] = canal === 'stderr' ? 2 : 1;
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.BACKEND_HEALTH_URL;
  delete process.env.CONTROL_HEALTH_URL;
  delete process.env.FRONTEND_HEALTH_URL;
});

describe('GET /api/kerberos/containers', () => {
  test('devuelve métricas calculadas y deja en null las del contenedor sin stats', async () => {
    dockerRequest.mockImplementation((ruta) => {
      if (ruta === '/containers/json?all=true') {
        return Promise.resolve([RESUMEN_BACKEND, RESUMEN_DETENIDO]);
      }
      if (ruta === '/containers/abc123/stats?stream=false') return Promise.resolve(STATS_BACKEND);
      if (ruta === '/containers/abc123/json') {
        return Promise.resolve({ State: { Health: { Status: 'healthy' } } });
      }
      if (ruta === '/containers/def456/stats?stream=false') {
        return Promise.reject(new Error('Docker API -> 409'));
      }
      if (ruta === '/containers/def456/json') return Promise.resolve({ State: {} });
      return Promise.reject(new Error(`ruta inesperada: ${ruta}`));
    });

    const res = await request(crearApp()).get('/api/kerberos/containers');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.contenedores).toHaveLength(2);

    const [backend, detenido] = res.body.contenedores;
    expect(backend).toMatchObject({
      id: 'abc123',
      nombre: 'clrv-backend',
      estado: 'running',
      salud: 'healthy',
      cpuPct: 4,
      memUsadaMb: 100,
      memLimiteMb: 1024,
      puertos: [{ privado: 4000, publico: 4000, tipo: 'tcp' }],
    });
    expect(backend.memPct).toBeCloseTo(9.77, 2);
    expect(backend.creadoEn).toBe(new Date(1762300000 * 1000).toISOString());

    expect(detenido).toMatchObject({
      id: 'def456',
      nombre: 'clrv-garage-init',
      estado: 'exited',
      salud: 'sin_healthcheck',
      cpuPct: null,
      memUsadaMb: null,
      memLimiteMb: null,
      memPct: null,
      puertos: [],
    });
  });

  test('responde 503 cuando el motor de Docker no está disponible', async () => {
    dockerRequest.mockRejectedValue(new Error('connect ENOENT /var/run/docker.sock'));

    const res = await request(crearApp()).get('/api/kerberos/containers');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, error: 'No se pudo conectar con el motor de Docker.' });
  });
});

describe('GET /api/kerberos/containers/:id/logs', () => {
  test('desmultiplexa los frames, separa el timestamp y clasifica el nivel', async () => {
    dockerRequestRaw.mockResolvedValue(
      Buffer.concat([
        frameDocker('stdout', '2026-11-05T13:00:00.123456789Z Servidor escuchando\n'),
        frameDocker('stderr', '2026-11-05T13:00:01.000000000Z Error: conexión rechazada\n'),
        frameDocker('stdout', '2026-11-05T13:00:02.000000000Z WARN cuota casi llena\n'),
      ])
    );

    const res = await request(crearApp()).get('/api/kerberos/containers/abc123/logs?lines=3');

    expect(res.status).toBe(200);
    expect(dockerRequestRaw).toHaveBeenCalledWith(
      '/containers/abc123/logs?stdout=1&stderr=1&tail=3&timestamps=1'
    );
    expect(res.body).toEqual({
      ok: true,
      contenedorId: 'abc123',
      lineas: [
        { timestamp: '2026-11-05T13:00:00.123456789Z', canal: 'stdout', nivel: 'info', texto: 'Servidor escuchando' },
        { timestamp: '2026-11-05T13:00:01.000000000Z', canal: 'stderr', nivel: 'error', texto: 'Error: conexión rechazada' },
        { timestamp: '2026-11-05T13:00:02.000000000Z', canal: 'stdout', nivel: 'warn', texto: 'WARN cuota casi llena' },
      ],
    });
  });

  test('tope de 1000 líneas y default de 200', async () => {
    dockerRequestRaw.mockResolvedValue(Buffer.alloc(0));
    const app = crearApp();

    await request(app).get('/api/kerberos/containers/abc123/logs?lines=99999');
    expect(dockerRequestRaw).toHaveBeenLastCalledWith(
      '/containers/abc123/logs?stdout=1&stderr=1&tail=1000&timestamps=1'
    );

    await request(app).get('/api/kerberos/containers/abc123/logs');
    expect(dockerRequestRaw).toHaveBeenLastCalledWith(
      '/containers/abc123/logs?stdout=1&stderr=1&tail=200&timestamps=1'
    );
  });

  test('rechaza un identificador con caracteres de ruta', async () => {
    const res = await request(crearApp()).get('/api/kerberos/containers/..%2Fetc/logs');

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(dockerRequestRaw).not.toHaveBeenCalled();
  });

  test('traduce el 404 de Docker a contenedor no encontrado', async () => {
    dockerRequestRaw.mockRejectedValue(new Error('Docker API /containers/zzz/logs -> 404'));

    const res = await request(crearApp()).get('/api/kerberos/containers/zzz/logs');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'Contenedor no encontrado.' });
  });
});

describe('GET /api/kerberos/health', () => {
  test('marca como no disponible cada servicio sin URL configurada', async () => {
    const res = await request(crearApp()).get('/api/kerberos/health');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.checks.map((c) => c.nombre)).toEqual(['backend', 'control', 'frontend']);
    for (const check of res.body.checks) {
      expect(check).toMatchObject({ disponible: false, statusCode: null, latenciaMs: null, error: 'URL no configurada' });
    }
  });

  test('mide latencia real contra un servicio que sí responde', async () => {
    const servidor = crearServidorDePrueba();
    await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    process.env.BACKEND_HEALTH_URL = `http://127.0.0.1:${servidor.address().port}/api/health`;

    try {
      const res = await request(crearApp()).get('/api/kerberos/health');
      const backend = res.body.checks.find((c) => c.nombre === 'backend');
      expect(backend.disponible).toBe(true);
      expect(backend.statusCode).toBe(200);
      expect(typeof backend.latenciaMs).toBe('number');
    } finally {
      await new Promise((resolve) => servidor.close(resolve));
    }
  });
});

describe('GET /api/kerberos/overview', () => {
  test('agrega conteos reales y deja en null los datos del host si /info falla', async () => {
    dockerRequest.mockImplementation((ruta) => {
      if (ruta === '/containers/json?all=true') {
        return Promise.resolve([RESUMEN_BACKEND, RESUMEN_DETENIDO]);
      }
      if (ruta === '/info') return Promise.reject(new Error('Docker API /info -> 500'));
      if (ruta.endsWith('/stats?stream=false')) return Promise.resolve(STATS_BACKEND);
      if (ruta === '/containers/abc123/json') {
        return Promise.resolve({ State: { Health: { Status: 'unhealthy' } } });
      }
      return Promise.resolve({ State: {} });
    });

    const res = await request(crearApp()).get('/api/kerberos/overview');

    expect(res.status).toBe(200);
    expect(res.body.resumen).toMatchObject({
      contenedoresTotal: 2,
      contenedoresCorriendo: 1,
      contenedoresDetenidos: 1,
      contenedoresConProblema: 1,
      cpuHostNucleos: null,
      memHostTotalMb: null,
    });
    expect(res.body.resumen.healthChecks).toHaveLength(3);
  });

  test('toma núcleos y memoria del host desde /info', async () => {
    dockerRequest.mockImplementation((ruta) => {
      if (ruta === '/containers/json?all=true') return Promise.resolve([]);
      if (ruta === '/info') return Promise.resolve({ NCPU: 8, MemTotal: 16 * 1024 * 1024 * 1024 });
      return Promise.resolve(null);
    });

    const res = await request(crearApp()).get('/api/kerberos/overview');

    expect(res.body.resumen.cpuHostNucleos).toBe(8);
    expect(res.body.resumen.memHostTotalMb).toBe(16384);
  });

  test('responde 503 si no se puede listar contenedores', async () => {
    dockerRequest.mockRejectedValue(new Error('connect ENOENT /var/run/docker.sock'));

    const res = await request(crearApp()).get('/api/kerberos/overview');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, error: 'No se pudo conectar con el motor de Docker.' });
  });
});

function crearServidorDePrueba() {
  return require('http').createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
}
