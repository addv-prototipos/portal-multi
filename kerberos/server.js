const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { requireKerberosAuth, recargarAdminUsers, recargarKerberosUsers } = require('./utils/auth');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '256kb' }));

// Rate limit de login (Basic Auth contra el "probe" de abajo) — mismo
// criterio que adminApiLimiter de control/, ventana generosa pero
// acotada, solo para este servicio.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});
// El dashboard refresca varios endpoints cada pocos segundos (polling
// corto) — balde holgado calculado contra eso, nunca el límite pensado
// para tráfico de escritura (mismo gotcha ya documentado en CLAUDE.md,
// punto 441: nunca compartir limiter de escritura/uso general con
// polling de intervalo corto). ~4 endpoints x cada 5s x 1 sesión activa
// = fracción de este balde incluso con varios operadores a la vez.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
});

function secretoInternoValido(req) {
  const secretoEsperado = process.env.INTERNAL_CACHE_SECRET;
  const recibido = req.get('X-Internal-Secret') || '';
  if (!secretoEsperado) return false;
  const bufEsperado = Buffer.from(secretoEsperado);
  const bufRecibido = Buffer.from(recibido);
  if (bufEsperado.length !== bufRecibido.length) {
    crypto.timingSafeEqual(bufEsperado, bufEsperado);
    return false;
  }
  return crypto.timingSafeEqual(bufEsperado, bufRecibido);
}

// Health check del propio contenedor (usado por Docker HEALTHCHECK) —
// nunca pasa por auth, mismo criterio que /api/health en backend/control.
app.get('/health', (req, res) => res.json({ ok: true }));

// ---------- Recarga en caliente, llamadas internas desde /control ----------
app.post('/internal/reload-admin-users', (req, res) => {
  if (!secretoInternoValido(req)) return res.status(403).json({ error: 'No autorizado.' });
  const nuevoValor = typeof req.body?.adminUsers === 'string' ? req.body.adminUsers : null;
  recargarAdminUsers(nuevoValor === null ? undefined : nuevoValor);
  res.json({ ok: true });
});

app.post('/internal/reload-kerberos-users', (req, res) => {
  if (!secretoInternoValido(req)) return res.status(403).json({ error: 'No autorizado.' });
  const nuevoValor = typeof req.body?.kerberosUsers === 'string' ? req.body.kerberosUsers : null;
  recargarKerberosUsers(nuevoValor === null ? undefined : nuevoValor);
  res.json({ ok: true });
});

// ---------- Login ----------
// Mismo patrón que /control (frontend/control.js): sin ruta /login
// dedicada — el formulario manda Basic Auth contra un endpoint protegido
// ligero ("probe") y el token de sesión sale en la cabecera
// X-Kerberos-Session-Token de esa misma respuesta.
app.get('/kerberos/api/me', loginLimiter, requireKerberosAuth, (req, res) => {
  res.json({ usuario: req.kerberosUser, perfil: req.kerberosPerfil });
});

// ---------- Rutas de datos reales (contenedores/health/logs/metrics) ----------
// Implementadas en routes/metrics.js — todas de solo lectura, todas
// detrás de requireKerberosAuth. Se montan aquí para que server.js sea
// el único lugar que conoce el orden auth -> rutas.
app.use('/kerberos/api', apiLimiter, requireKerberosAuth, require('./routes/metrics')());

// ---------- Estáticos (login + dashboard) ----------
// Montado bajo /kerberos (nunca en la raíz): nginx reenvía la URL
// COMPLETA sin recortar el prefijo (location /kerberos/ { proxy_pass
// http://kerberos_upstream; }, sin "/" final en el destino) — así las
// rutas internas de este archivo y las absolutas que ya traen los HTML
// (/kerberos/assets/..., /kerberos/login.css, etc.) coinciden exacto,
// sin pisar ningún /assets/* real del sitio principal.
// Express no usa "strict routing" por defecto: esta ruta matchea TANTO
// "/kerberos" como "/kerberos/" — sin el chequeo de abajo, la petición
// CON diagonal también se redirige a sí misma, loop infinito (reproducido
// real al probar). Solo redirige cuando de verdad falta la diagonal.
app.get('/kerberos', (req, res, next) => {
  if (req.path === '/kerberos') return res.redirect(301, '/kerberos/');
  next();
});
app.use('/kerberos', express.static(path.join(__dirname, 'public'), { index: 'login.html', maxAge: 0 }));

app.use((req, res) => {
  res.status(404).json({ error: 'No encontrado.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error no manejado en Kerberos:', err);
  res.status(500).json({ error: 'Error interno.' });
});

const PORT = process.env.PORT || 4100;
app.listen(PORT, () => {
  console.log(`Kerberos escuchando en puerto ${PORT}`);
});
