// Ubicación aproximada a partir de la IP ya guardada en `admin_auditoria`
// (punto 452) — pedido explícito del usuario: saber desde qué parte de la
// república se conectan los operadores del panel, y poder rastrear la
// ubicación de un acceso sospechoso si alguien roba una contraseña.
//
// `geoip-lite` (base MaxMind GeoLite2 embebida, sin llamadas a terceros —
// decisión explícita del usuario sobre privacidad/costo/dependencias) solo
// devuelve el código ISO 3166-2 de la subdivisión (ej. "MIC" para
// Michoacán), no el nombre — este mapa lo traduce para México, el caso que
// de verdad importa aquí. Fuera de México se muestra ciudad + país, sin
// intentar traducir subdivisiones de otros 250 países.
const ESTADOS_MX = {
  AGU: 'Aguascalientes', BCN: 'Baja California', BCS: 'Baja California Sur',
  CAM: 'Campeche', CHP: 'Chiapas', CHH: 'Chihuahua', CMX: 'Ciudad de México',
  COA: 'Coahuila', COL: 'Colima', DUR: 'Durango', GUA: 'Guanajuato',
  GRO: 'Guerrero', HID: 'Hidalgo', JAL: 'Jalisco', MEX: 'Estado de México',
  MIC: 'Michoacán', MOR: 'Morelos', NAY: 'Nayarit', NLE: 'Nuevo León',
  OAX: 'Oaxaca', PUE: 'Puebla', QUE: 'Querétaro', ROO: 'Quintana Roo',
  SLP: 'San Luis Potosí', SIN: 'Sinaloa', SON: 'Sonora', TAB: 'Tabasco',
  TAM: 'Tamaulipas', TLA: 'Tlaxcala', VER: 'Veracruz', YUC: 'Yucatán',
  ZAC: 'Zacatecas',
};

const geoip = require('geoip-lite');

// IPs internas/privadas (docker, loopback) ya devuelven null en geoip-lite
// — aquí solo se normaliza el prefijo IPv4-mapped-IPv6 que a veces trae
// `req.ip` ("::ffff:189.243.163.85") antes de buscar.
function ubicacionDesdeIp(ip) {
  if (!ip) return null;
  const limpio = ip.replace(/^::ffff:/, '');
  const geo = geoip.lookup(limpio);
  if (!geo || !geo.country) return null;

  if (geo.country === 'MX') {
    const estado = ESTADOS_MX[geo.region] || null;
    return [geo.city, estado].filter(Boolean).join(', ') || 'México';
  }
  return [geo.city, geo.country].filter(Boolean).join(', ') || geo.country;
}

module.exports = { ubicacionDesdeIp };
