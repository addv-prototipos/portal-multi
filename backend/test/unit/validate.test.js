const {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_ZIP_MIME_TYPES,
  detectRealMimeType,
  detectRealImageMimeType,
  esZipValido,
  zipContienePdfYXml,
  sanitizeText,
  sanitizeTextoLibre,
  isValidEmail,
  isValidRFC,
  isValidRFCRequerido,
  isValidTelefono,
  isValidTipoPersona,
} = require('../../utils/validate');

describe('validate.js', () => {
  describe('constantes de tipos permitidos', () => {
    test('solo PDF para constancia fiscal', () => {
      expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true);
      expect(ALLOWED_EXTENSIONS.has('.pdf')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(false);
    });

    test('imágenes permitidas para tickets', () => {
      expect(ALLOWED_IMAGE_MIME_TYPES.has('image/jpeg')).toBe(true);
      expect(ALLOWED_IMAGE_MIME_TYPES.has('image/png')).toBe(true);
      expect(ALLOWED_IMAGE_MIME_TYPES.has('image/webp')).toBe(true);
    });

    test('MIME types de zip permisivos incluyen octet-stream', () => {
      expect(ALLOWED_ZIP_MIME_TYPES.has('application/octet-stream')).toBe(true);
    });
  });

  describe('detectRealMimeType', () => {
    test('detecta PDF por firma binaria %PDF', () => {
      const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      expect(detectRealMimeType(buffer)).toBe('application/pdf');
    });

    test('devuelve null si la firma no coincide', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(detectRealMimeType(buffer)).toBeNull();
    });

    test('devuelve null con buffer más corto que la firma', () => {
      const buffer = Buffer.from([0x25, 0x50]);
      expect(detectRealMimeType(buffer)).toBeNull();
    });
  });

  describe('detectRealImageMimeType', () => {
    test('detecta JPEG por firma binaria', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(detectRealImageMimeType(buffer)).toBe('image/jpeg');
    });

    test('detecta PNG por firma binaria', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(detectRealImageMimeType(buffer)).toBe('image/png');
    });

    test('detecta WEBP por RIFF....WEBP', () => {
      const buffer = Buffer.concat([
        Buffer.from('RIFF', 'ascii'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from('WEBP', 'ascii'),
      ]);
      expect(detectRealImageMimeType(buffer)).toBe('image/webp');
    });

    test('devuelve null para un buffer que no coincide con ninguna firma', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(detectRealImageMimeType(buffer)).toBeNull();
    });
  });

  describe('esZipValido', () => {
    test('acepta firma normal PK\\x03\\x04', () => {
      expect(esZipValido(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    });

    test('acepta firma de zip vacío PK\\x05\\x06', () => {
      expect(esZipValido(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
    });

    test('acepta firma de zip dividido PK\\x07\\x08', () => {
      expect(esZipValido(Buffer.from([0x50, 0x4b, 0x07, 0x08]))).toBe(true);
    });

    test('rechaza buffer nulo o demasiado corto', () => {
      expect(esZipValido(null)).toBe(false);
      expect(esZipValido(Buffer.from([0x50, 0x4b]))).toBe(false);
    });

    test('rechaza firma que no es de zip', () => {
      expect(esZipValido(Buffer.from([0x25, 0x50, 0x44, 0x46]))).toBe(false);
    });
  });

  describe('zipContienePdfYXml', () => {
    // Construye un ZIP mínimo válido con entradas de directorio central
    // apuntando a nombres de archivo dados, suficiente para que
    // listarArchivosEnZip() (función interna) los pueda leer.
    function construirZipConNombres(nombres) {
      const entradasCentral = [];
      nombres.forEach((nombre) => {
        const nombreBuf = Buffer.from(nombre, 'utf8');
        const encabezado = Buffer.alloc(46);
        encabezado.write('PK\x01\x02', 0, 'binary');
        encabezado.writeUInt16LE(nombreBuf.length, 28); // longitud nombre
        entradasCentral.push(Buffer.concat([encabezado, nombreBuf]));
      });
      const central = Buffer.concat(entradasCentral);

      const eocd = Buffer.alloc(22);
      eocd.write('PK\x05\x06', 0, 'binary');
      eocd.writeUInt16LE(nombres.length, 10); // total de entradas
      eocd.writeUInt32LE(0, 16); // offset del directorio central (0: empieza al inicio del buffer)

      return Buffer.concat([central, eocd]);
    }

    test('detecta que trae PDF y XML', () => {
      const zip = construirZipConNombres(['factura.pdf', 'factura.xml']);
      const resultado = zipContienePdfYXml(zip);
      expect(resultado).toEqual({ tienePdf: true, tieneXml: true, valido: true });
    });

    test('detecta que falta el XML', () => {
      const zip = construirZipConNombres(['factura.pdf']);
      const resultado = zipContienePdfYXml(zip);
      expect(resultado).toEqual({ tienePdf: true, tieneXml: false, valido: false });
    });

    test('zip corrupto no lanza error y devuelve ambos en false', () => {
      const resultado = zipContienePdfYXml(Buffer.from([0x00, 0x01, 0x02]));
      expect(resultado).toEqual({ tienePdf: false, tieneXml: false, valido: false });
    });
  });

  describe('sanitizeText', () => {
    test('quita etiquetas HTML', () => {
      expect(sanitizeText('<script>alert(1)</script>hola')).toBe('alert(1)hola');
    });

    test('recorta a la longitud máxima', () => {
      expect(sanitizeText('a'.repeat(10), 5)).toBe('aaaaa');
    });

    test('escapa caracteres especiales HTML restantes', () => {
      expect(sanitizeText('5 > 3 & 2 < 4')).toBe('5 &gt; 3 &amp; 2 &lt; 4');
    });

    test('quita caracteres de control', () => {
      expect(sanitizeText('hola\x00mundo')).toBe('holamundo');
    });

    test('devuelve cadena vacía si no es string', () => {
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
      expect(sanitizeText(123)).toBe('');
    });
  });

  describe('sanitizeTextoLibre', () => {
    test('NO escapa "&" a diferencia de sanitizeText (va dentro de un correo, no HTML)', () => {
      expect(sanitizeTextoLibre('Pedro & Asociados')).toBe('Pedro & Asociados');
    });

    test('quita caracteres de control (mitiga inyección de cabeceras SMTP)', () => {
      expect(sanitizeTextoLibre('asunto\x00malicioso')).toBe('asuntomalicioso');
    });

    test('recorta a la longitud máxima por defecto', () => {
      expect(sanitizeTextoLibre('a'.repeat(2100)).length).toBe(2000);
    });

    test('devuelve cadena vacía si no es string', () => {
      expect(sanitizeTextoLibre(42)).toBe('');
    });
  });

  describe('isValidEmail', () => {
    test('acepta correo válido', () => {
      expect(isValidEmail('usuario@dominio.com')).toBe(true);
    });

    test('rechaza correo sin arroba', () => {
      expect(isValidEmail('usuario-dominio.com')).toBe(false);
    });

    test('rechaza valores no-string', () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });
  });

  describe('isValidRFC', () => {
    test('es opcional: vacío/null se considera válido', () => {
      expect(isValidRFC(null)).toBe(true);
      expect(isValidRFC('')).toBe(true);
    });

    test('acepta RFC de persona física (4 letras + 6 dígitos + 3 alfanum)', () => {
      expect(isValidRFC('GOMJ800101ABC')).toBe(true);
    });

    test('acepta RFC de persona moral (3 letras + 6 dígitos + 3 alfanum)', () => {
      expect(isValidRFC('ABC800101AB1')).toBe(true);
    });

    test('rechaza formato inválido', () => {
      expect(isValidRFC('123')).toBe(false);
      expect(isValidRFC('GOMJ800101')).toBe(false);
    });
  });

  describe('isValidRFCRequerido', () => {
    test('rechaza vacío (a diferencia de isValidRFC, aquí es obligatorio)', () => {
      expect(isValidRFCRequerido('')).toBe(false);
      expect(isValidRFCRequerido('   ')).toBe(false);
      expect(isValidRFCRequerido(null)).toBe(false);
    });

    test('acepta RFC válido no vacío', () => {
      expect(isValidRFCRequerido('GOMJ800101ABC')).toBe(true);
    });
  });

  describe('isValidTelefono', () => {
    test('acepta 10 dígitos limpios', () => {
      expect(isValidTelefono('5512345678')).toBe(true);
    });

    test('acepta con espacios y guiones, los limpia antes de validar', () => {
      expect(isValidTelefono('55 1234-5678')).toBe(true);
      expect(isValidTelefono('(55) 1234 5678')).toBe(true);
    });

    test('rechaza menos o más de 10 dígitos', () => {
      expect(isValidTelefono('123')).toBe(false);
      expect(isValidTelefono('55123456789')).toBe(false);
    });

    test('rechaza no-string', () => {
      expect(isValidTelefono(5512345678)).toBe(false);
    });
  });

  describe('isValidTipoPersona', () => {
    test('acepta "fisica" y "moral"', () => {
      expect(isValidTipoPersona('fisica')).toBe(true);
      expect(isValidTipoPersona('moral')).toBe(true);
    });

    test('rechaza cualquier otro valor', () => {
      expect(isValidTipoPersona('otro')).toBe(false);
      expect(isValidTipoPersona('')).toBe(false);
      expect(isValidTipoPersona(null)).toBe(false);
    });
  });
});
