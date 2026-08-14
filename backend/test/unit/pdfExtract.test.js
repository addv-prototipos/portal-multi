jest.mock('pdf-parse', () => jest.fn(), { virtual: true });

const {
  extraerTextoPdf,
  pareceConstanciaFiscal,
  extraerCodigoPostal,
  extraerRFC,
  extraerRegimenesFiscales,
  determinarTipoPersonaPorRegimen,
  determinarTipoPersonaPorNombre,
  determinarTipoPersonaPorCamposDocumento,
  determinarTipoPersona,
  extraerNombreRazonSocial,
} = require('../../utils/pdfExtract');

describe('pdfExtract.js', () => {
  describe('extraerTextoPdf', () => {
    afterEach(() => {
      jest.resetModules();
      jest.clearAllMocks();
    });

    test('devuelve el texto extraído cuando pdf-parse resuelve correctamente', async () => {
      const pdfParse = require('pdf-parse');
      pdfParse.mockResolvedValueOnce({ text: 'contenido del pdf' });

      const resultado = await extraerTextoPdf(Buffer.from('cualquier cosa'));
      expect(resultado).toBe('contenido del pdf');
    });

    test('devuelve cadena vacía si pdf-parse no trae texto', async () => {
      const pdfParse = require('pdf-parse');
      pdfParse.mockResolvedValueOnce({});

      const resultado = await extraerTextoPdf(Buffer.from('x'));
      expect(resultado).toBe('');
    });

    test('devuelve null si pdf-parse lanza (archivo corrupto/no es PDF)', async () => {
      const pdfParse = require('pdf-parse');
      pdfParse.mockRejectedValueOnce(new Error('no es un PDF válido'));

      const resultado = await extraerTextoPdf(Buffer.from('basura'));
      expect(resultado).toBeNull();
    });

    test('pasa un Uint8Array a pdf-parse (no un Buffer) — bug de producción con Node 20', async () => {
      // Bug real (2026-08-13, pruebas funcionales con Docker real):
      // pdf-parse 1.1.4 falla con "bad XRef entry" cuando recibe un
      // Buffer de Node 20 (el contenedor usa node:20-alpine). El fix
      // convierte el buffer a Uint8Array antes de llamar a pdf-parse.
      const pdfParse = require('pdf-parse');
      pdfParse.mockResolvedValueOnce({ text: 'texto ok' });

      const resultado = await extraerTextoPdf(Buffer.from('%PDF-1.4 dato'));
      expect(resultado).toBe('texto ok');
      expect(pdfParse).toHaveBeenCalledTimes(1);
      const argumento = pdfParse.mock.calls[0][0];
      expect(argumento).toBeInstanceOf(Uint8Array);
      expect(Buffer.isBuffer(argumento)).toBe(false);
      expect(Buffer.from(argumento).toString('latin1')).toBe('%PDF-1.4 dato');
    });
  });

  describe('pareceConstanciaFiscal', () => {
    test('reconoce el indicador "constancia de situacion fiscal" sin importar acentos/mayúsculas', () => {
      expect(pareceConstanciaFiscal('CONSTANCIA DE SITUACIÓN FISCAL emitida hoy')).toBe(true);
    });

    test('reconoce "cedula de identificacion fiscal"', () => {
      expect(pareceConstanciaFiscal('Cédula de Identificación Fiscal')).toBe(true);
    });

    test('rechaza texto que no contiene ningún indicador', () => {
      expect(pareceConstanciaFiscal('Un documento cualquiera sin relación')).toBe(false);
    });

    test('maneja texto vacío/undefined sin lanzar', () => {
      expect(pareceConstanciaFiscal('')).toBe(false);
      expect(pareceConstanciaFiscal(undefined)).toBe(false);
    });
  });

  describe('extraerCodigoPostal', () => {
    test('extrae con etiqueta "Código Postal:"', () => {
      expect(extraerCodigoPostal('Domicilio Código Postal: 64000 Colonia Centro')).toBe('64000');
    });

    test('extrae con abreviatura "C.P."', () => {
      expect(extraerCodigoPostal('C.P. 06600')).toBe('06600');
    });

    test('extrae con "CP" sin puntos', () => {
      expect(extraerCodigoPostal('CP: 45000')).toBe('45000');
    });

    test('devuelve null si no hay coincidencia', () => {
      expect(extraerCodigoPostal('Sin código postal aquí')).toBeNull();
    });

    test('maneja texto vacío/undefined', () => {
      expect(extraerCodigoPostal('')).toBeNull();
      expect(extraerCodigoPostal(undefined)).toBeNull();
    });
  });

  describe('extraerRFC', () => {
    test('extrae el RFC cerca de la etiqueta "Registro Federal de Contribuyentes"', () => {
      const texto = 'Registro Federal de Contribuyentes: GOMJ800101ABC\nOtros datos';
      expect(extraerRFC(texto)).toBe('GOMJ800101ABC');
    });

    test('respaldo: busca el patrón de RFC en todo el documento si no hay etiqueta', () => {
      const texto = 'Documento sin etiqueta pero con GOMJ800101ABC dentro';
      expect(extraerRFC(texto)).toBe('GOMJ800101ABC');
    });

    test('normaliza el resultado a mayúsculas', () => {
      const texto = 'Registro Federal de Contribuyentes: gomj800101abc';
      expect(extraerRFC(texto)).toBe('GOMJ800101ABC');
    });

    test('devuelve null si no se encuentra ningún RFC', () => {
      expect(extraerRFC('texto sin ningún rfc válido')).toBeNull();
    });

    test('devuelve null con texto vacío', () => {
      expect(extraerRFC('')).toBeNull();
      expect(extraerRFC(undefined)).toBeNull();
    });
  });

  describe('extraerRegimenesFiscales', () => {
    test('encuentra un régimen por nombre exacto en el texto', () => {
      const texto = 'El contribuyente tributa bajo Régimen de Enajenación o Adquisición de Bienes';
      const resultado = extraerRegimenesFiscales(texto);
      expect(resultado).toContain('607 - Régimen de Enajenación o Adquisición de Bienes');
    });

    test('encuentra varios regímenes si aparecen varios', () => {
      const texto = 'Sueldos y Salarios e Ingresos Asimilados a Salarios y también Sin obligaciones fiscales';
      const resultado = extraerRegimenesFiscales(texto);
      expect(resultado).toEqual(
        expect.arrayContaining(['605 - Sueldos y Salarios e Ingresos Asimilados a Salarios', '616 - Sin obligaciones fiscales'])
      );
    });

    test('devuelve arreglo vacío si no encuentra ninguno', () => {
      expect(extraerRegimenesFiscales('texto sin ningún régimen mencionado')).toEqual([]);
    });
  });

  describe('determinarTipoPersonaPorRegimen', () => {
    test('régimen exclusivo de moral (601) determina "moral"', () => {
      expect(determinarTipoPersonaPorRegimen(['601 - General de Ley Personas Morales'])).toBe('moral');
    });

    test('régimen no exclusivo de moral determina "fisica" por default', () => {
      expect(determinarTipoPersonaPorRegimen(['612 - Personas Físicas con Actividades Empresariales y Profesionales'])).toBe('fisica');
    });

    test('lista vacía o no-arreglo devuelve null', () => {
      expect(determinarTipoPersonaPorRegimen([])).toBeNull();
      expect(determinarTipoPersonaPorRegimen(null)).toBeNull();
    });
  });

  describe('determinarTipoPersonaPorNombre', () => {
    test('terminación legal "SA DE CV" determina "moral"', () => {
      expect(determinarTipoPersonaPorNombre('Comercializadora Ejemplo SA de CV')).toBe('moral');
    });

    test('palabra corporativa determina "moral"', () => {
      expect(determinarTipoPersonaPorNombre('Grupo Industrial del Norte')).toBe('moral');
    });

    test('nombre propio corto (2-5 palabras) determina "fisica"', () => {
      expect(determinarTipoPersonaPorNombre('Juan Perez Gomez')).toBe('fisica');
    });

    test('texto vacío devuelve null', () => {
      expect(determinarTipoPersonaPorNombre('')).toBeNull();
      expect(determinarTipoPersonaPorNombre(null)).toBeNull();
    });

    test('texto de una sola palabra no concluye nada (null)', () => {
      expect(determinarTipoPersonaPorNombre('Juan')).toBeNull();
    });
  });

  describe('determinarTipoPersonaPorCamposDocumento', () => {
    test('detecta "Primer Apellido" (persona física) incluso sin espacio (extracción de tabla pegada)', () => {
      expect(determinarTipoPersonaPorCamposDocumento('PrimerApellido: Gomez')).toBe('fisica');
    });

    test('detecta "Segundo Apellido"', () => {
      expect(determinarTipoPersonaPorCamposDocumento('Segundo Apellido: Ramirez')).toBe('fisica');
    });

    test('detecta "Régimen Capital" (persona moral) sin espacio', () => {
      expect(determinarTipoPersonaPorCamposDocumento('RegimenCapital: Variable')).toBe('moral');
    });

    test('detecta "Nombre Comercial"', () => {
      expect(determinarTipoPersonaPorCamposDocumento('Nombre Comercial: Ejemplo SA')).toBe('moral');
    });

    test('devuelve null si no encuentra ningún campo distintivo', () => {
      expect(determinarTipoPersonaPorCamposDocumento('texto genérico sin campos')).toBeNull();
    });
  });

  describe('determinarTipoPersona (combinación de señales)', () => {
    test('los campos del documento ganan sobre el régimen y el nombre', () => {
      // Régimen exclusivo de moral (601), pero el documento trae
      // "Primer Apellido" -> debe ganar "fisica" (señal más confiable).
      const resultado = determinarTipoPersona(
        ['601 - General de Ley Personas Morales'],
        'Cualquier Nombre',
        'Primer Apellido: Gomez'
      );
      expect(resultado).toBe('fisica');
    });

    test('sin campos concluyentes, gana el régimen exclusivo de moral', () => {
      const resultado = determinarTipoPersona(['603 - Personas Morales con Fines no Lucrativos'], '', 'texto sin campos');
      expect(resultado).toBe('moral');
    });

    test('sin campos ni régimen exclusivo, gana la razón social', () => {
      const resultado = determinarTipoPersona([], 'Constructora Ejemplo SA de CV', 'texto sin campos');
      expect(resultado).toBe('moral');
    });

    test('sin ninguna señal concluyente, cae al default del régimen general', () => {
      const resultado = determinarTipoPersona(
        ['612 - Personas Físicas con Actividades Empresariales y Profesionales'],
        '',
        'texto sin campos'
      );
      expect(resultado).toBe('fisica');
    });

    test('sin ninguna señal en absoluto, devuelve null', () => {
      expect(determinarTipoPersona([], '', '')).toBeNull();
    });
  });

  describe('extraerNombreRazonSocial', () => {
    test('extrae el nombre del bloque entre RFC y etiqueta de nombre (persona moral)', () => {
      const texto = [
        'Registro Federal de Contribuyentes: ABC800101AB1',
        'COMERCIALIZADORA EJEMPLO SA DE CV',
        'Nombre, Denominación o Razón Social:',
        'Código Postal: 64000',
      ].join('\n');
      expect(extraerNombreRazonSocial(texto)).toBe('COMERCIALIZADORA EJEMPLO SA DE CV');
    });

    test('descarta líneas de ruido conocido (IdCIF, RFC repetido) dentro del bloque', () => {
      const texto = [
        'Registro Federal de Contribuyentes: GOMJ800101ABC',
        'IdCIF12345678',
        'JUAN PEREZ GOMEZ',
        'GOMJ800101ABC',
        'Nombre, Denominación o Razón Social:',
      ].join('\n');
      expect(extraerNombreRazonSocial(texto)).toBe('JUAN PEREZ GOMEZ');
    });

    test('respaldo: junta Nombre + Primer Apellido + Segundo Apellido cuando no hay bloque RFC/nombre', () => {
      const texto = ['Nombre (s): Juan', 'Primer Apellido: Perez', 'Segundo Apellido: Gomez'].join('\n');
      expect(extraerNombreRazonSocial(texto)).toBe('Juan Perez Gomez');
    });

    test('devuelve null si el texto está vacío', () => {
      expect(extraerNombreRazonSocial('')).toBeNull();
      expect(extraerNombreRazonSocial(undefined)).toBeNull();
    });

    test('devuelve null si no hay ninguna etiqueta reconocible', () => {
      expect(extraerNombreRazonSocial('texto genérico sin ninguna etiqueta del SAT')).toBeNull();
    });
  });
});
