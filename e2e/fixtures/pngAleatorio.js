// Generador de un PNG válido real (RGB de ruido aleatorio, sin
// dependencias externas) para probar subidas de imagen grandes — el
// backend de /control valida el formato real del archivo (no basta un
// buffer de bytes crudos con extensión .png, ver hallazgo N-01,
// sonar_1.1.html). `compress_level` bajo a propósito: ruido aleatorio no
// comprime, así que el tamaño de salida es predecible (~ancho*alto*3
// bytes) para poder apuntar a un tamaño exacto en MB.

const zlib = require('zlib');

function crc32(buf) {
  let c;
  const tabla = crc32.tabla || (crc32.tabla = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = tabla[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length, 0);
  const tipoBuf = Buffer.from(tipo, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tipoBuf, datos])), 0);
  return Buffer.concat([longitud, tipoBuf, datos, crcBuf]);
}

function crearPngAleatorio(ancho, alto) {
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // profundidad de bit
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Cada scanline lleva un byte de filtro (0 = ninguno) + ancho*3 bytes RGB.
  const bytesPorFila = 1 + ancho * 3;
  const raw = Buffer.alloc(bytesPorFila * alto);
  for (let y = 0; y < alto; y++) {
    const inicio = y * bytesPorFila;
    raw[inicio] = 0;
    const pixeles = require('crypto').randomBytes(ancho * 3);
    pixeles.copy(raw, inicio + 1);
  }
  const idatDatos = zlib.deflateSync(raw, { level: 0 });

  return Buffer.concat([
    firma,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatDatos),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { crearPngAleatorio };
