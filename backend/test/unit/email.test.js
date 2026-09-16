const { pool } = require('../../db');
const nodemailer = require('nodemailer');
const {
  getConfigSmtp,
  setConfigSmtp,
  configSmtpParaMostrar,
  enviarCorreo,
  aplicarPlantilla,
  DEFAULTS_SMTP,
  marcarSmtpVerificado,
  verificarConexionSmtp,
} = require('../../utils/email');

jest.mock('../../db', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('email.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfigSmtp', () => {
    test('devuelve null si no hay configuración guardada', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      expect(await getConfigSmtp()).toBeNull();
    });

    test('devuelve la configuración combinada con los defaults', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ host: 'smtp.custom.com', usuario: 'x@x.com' }) }]]);
      const resultado = await getConfigSmtp();
      expect(resultado.host).toBe('smtp.custom.com');
      expect(resultado.puerto).toBe(DEFAULTS_SMTP.puerto); // no sobreescrito, mantiene default
    });

    test('devuelve null si el JSON guardado está corrupto', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: 'no-json{{{' }]]);
      expect(await getConfigSmtp()).toBeNull();
    });
  });

  describe('setConfigSmtp', () => {
    test('guarda cambios parciales sobre defaults si no había configuración previa', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfigSmtp interno
      pool.query.mockResolvedValueOnce([{}]); // INSERT/UPDATE

      const resultado = await setConfigSmtp({ host: 'smtp.gmail.com', usuario: 'a@a.com', password: 'clave1' });

      expect(resultado.host).toBe('smtp.gmail.com');
      expect(resultado.usuario).toBe('a@a.com');
      expect(resultado.password).toBe('clave1');
    });

    test('NO sobreescribe la contraseña si se manda vacía (permite editar otros campos sin recapturarla)', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ ...DEFAULTS_SMTP, password: 'claveExistente' }) }]]);
      pool.query.mockResolvedValueOnce([{}]);

      const resultado = await setConfigSmtp({ host: 'smtp.otro.com', password: '' });

      expect(resultado.password).toBe('claveExistente');
      expect(resultado.host).toBe('smtp.otro.com');
    });

    test('ignora "seguridad" con un valor que no sea starttls/ssl', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      pool.query.mockResolvedValueOnce([{}]);

      const resultado = await setConfigSmtp({ seguridad: 'valor-invalido' });
      expect(resultado.seguridad).toBe(DEFAULTS_SMTP.seguridad);
    });

    test('solo acepta puerto si es un entero', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      pool.query.mockResolvedValueOnce([{}]);

      const resultado = await setConfigSmtp({ puerto: 465 });
      expect(resultado.puerto).toBe(465);
    });

    test('limpia ultima_verificacion_en al guardar (los datos de conexión pudieron cambiar)', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ ...DEFAULTS_SMTP, ultima_verificacion_en: '2026-09-01T10:00:00.000Z' }) }],
      ]);
      pool.query.mockResolvedValueOnce([{}]);

      const resultado = await setConfigSmtp({ host: 'smtp.otro.com' });
      expect(resultado.ultima_verificacion_en).toBeNull();
    });
  });

  describe('marcarSmtpVerificado', () => {
    test('registra un timestamp ISO nuevo sin tocar el resto de la config', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ ...DEFAULTS_SMTP, host: 'smtp.gmail.com', usuario: 'a@a.com' }) }],
      ]);
      pool.query.mockResolvedValueOnce([{}]);

      const verificadoEn = await marcarSmtpVerificado();
      expect(verificadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      const payloadGuardado = JSON.parse(pool.query.mock.calls[1][1][1]);
      expect(payloadGuardado.host).toBe('smtp.gmail.com');
      expect(payloadGuardado.ultima_verificacion_en).toBe(verificadoEn);
    });
  });

  describe('verificarConexionSmtp', () => {
    test('lanza error claro si no hay configuración SMTP completa', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfigSmtp -> null
      await expect(verificarConexionSmtp()).rejects.toThrow(/no está configurado todavía/);
    });

    test('éxito: hace verify() sin enviar correo y registra el timestamp', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ ...DEFAULTS_SMTP, host: 'smtp.gmail.com', usuario: 'a@a.com', password: 'clave' }) }],
      ]);
      const verify = jest.fn().mockResolvedValue(true);
      const sendMail = jest.fn();
      nodemailer.createTransport.mockReturnValue({ verify, sendMail });
      // marcarSmtpVerificado() vuelve a leer la config guardada antes de escribir.
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ ...DEFAULTS_SMTP, host: 'smtp.gmail.com', usuario: 'a@a.com', password: 'clave' }) }],
      ]);
      pool.query.mockResolvedValueOnce([{}]);

      const verificadoEn = await verificarConexionSmtp();
      expect(verify).toHaveBeenCalled();
      expect(sendMail).not.toHaveBeenCalled();
      expect(verificadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('traduce error EAUTH del handshake igual que enviarCorreo', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ ...DEFAULTS_SMTP, host: 'smtp.gmail.com', usuario: 'a@a.com', password: 'clave' }) }],
      ]);
      const err = Object.assign(new Error('auth failed'), { code: 'EAUTH' });
      const verify = jest.fn().mockRejectedValue(err);
      nodemailer.createTransport.mockReturnValue({ verify, sendMail: jest.fn() });

      await expect(verificarConexionSmtp()).rejects.toThrow(/Contraseña de aplicación/);
    });
  });

  describe('configSmtpParaMostrar', () => {
    test('sin configuración, indica configurado:false y passwordConfigurada:false', () => {
      const resultado = configSmtpParaMostrar(null);
      expect(resultado.configurado).toBe(false);
      expect(resultado.passwordConfigurada).toBe(false);
      expect(resultado.password).toBeUndefined();
    });

    test('nunca expone la contraseña real, pero sí indica que está configurada', () => {
      const resultado = configSmtpParaMostrar({ ...DEFAULTS_SMTP, host: 'smtp.gmail.com', usuario: 'a@a.com', password: 'secreta' });
      expect(resultado.password).toBeUndefined();
      expect(resultado.passwordConfigurada).toBe(true);
      expect(resultado.configurado).toBe(true);
    });

    test('configurado:false si falta host, usuario o password', () => {
      const resultado = configSmtpParaMostrar({ ...DEFAULTS_SMTP, host: '', usuario: 'a@a.com', password: 'x' });
      expect(resultado.configurado).toBe(false);
    });
  });

  describe('aplicarPlantilla', () => {
    test('sustituye variables presentes', () => {
      expect(aplicarPlantilla('Hola {nombre}, folio {folio}', { nombre: 'Juan', folio: '123' })).toBe('Hola Juan, folio 123');
    });

    test('deja el marcador tal cual si la variable no viene en los valores', () => {
      expect(aplicarPlantilla('Hola {nombre}', {})).toBe('Hola {nombre}');
    });

    test('devuelve cadena vacía si el texto no es string', () => {
      expect(aplicarPlantilla(null, {})).toBe('');
      expect(aplicarPlantilla(undefined, {})).toBe('');
    });

    test('sustituye múltiples ocurrencias de la misma variable', () => {
      expect(aplicarPlantilla('{x} y otra vez {x}', { x: 'valor' })).toBe('valor y otra vez valor');
    });
  });

  describe('enviarCorreo', () => {
    test('lanza error claro si no hay configuración SMTP completa', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfigSmtp -> null
      await expect(enviarCorreo({ destinatario: 'x@x.com', asunto: 'a', cuerpo: 'b' })).rejects.toThrow(
        /no está configurado todavía/
      );
    });

    test('envía correctamente con configuración completa', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ ...DEFAULTS_SMTP, host: 'smtp.gmail.com', usuario: 'a@a.com', password: 'clave', nombre_remitente: 'ADDV' }) }],
      ]);
      const sendMail = jest.fn().mockResolvedValue({});
      nodemailer.createTransport.mockReturnValue({ sendMail });

      await enviarCorreo({ destinatario: 'cliente@x.com', asunto: 'Asunto', cuerpo: 'Cuerpo' });

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"ADDV" <a@a.com>',
          to: 'cliente@x.com',
          subject: 'Asunto',
          text: 'Cuerpo',
        })
      );
    });

    test('incluye html solo si se pasa explícitamente', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ ...DEFAULTS_SMTP, host: 'smtp.gmail.com', usuario: 'a@a.com', password: 'clave' }) }],
      ]);
      const sendMail = jest.fn().mockResolvedValue({});
      nodemailer.createTransport.mockReturnValue({ sendMail });

      await enviarCorreo({ destinatario: 'x@x.com', asunto: 'a', cuerpo: 'b', html: '<p>b</p>' });

      expect(sendMail.mock.calls[0][0].html).toBe('<p>b</p>');
    });

    test('traduce error EAUTH a mensaje entendible sobre "Contraseña de aplicación"', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ ...DEFAULTS_SMTP, host: 'smtp.gmail.com', usuario: 'a@a.com', password: 'clave' }) }],
      ]);
      const err = Object.assign(new Error('auth failed'), { code: 'EAUTH' });
      const sendMail = jest.fn().mockRejectedValue(err);
      nodemailer.createTransport.mockReturnValue({ sendMail });

      await expect(enviarCorreo({ destinatario: 'x@x.com', asunto: 'a', cuerpo: 'b' })).rejects.toThrow(
        /Contraseña de aplicación/
      );
    });

    test('traduce error de conexión (ECONNECTION/ETIMEDOUT/ESOCKET) a mensaje entendible', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ ...DEFAULTS_SMTP, host: 'smtp.gmail.com', puerto: 587, usuario: 'a@a.com', password: 'clave' }) }],
      ]);
      const err = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
      const sendMail = jest.fn().mockRejectedValue(err);
      nodemailer.createTransport.mockReturnValue({ sendMail });

      await expect(enviarCorreo({ destinatario: 'x@x.com', asunto: 'a', cuerpo: 'b' })).rejects.toThrow(
        /No se pudo conectar con "smtp.gmail.com:587"/
      );
    });

    test('otros errores conservan su mensaje original', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ ...DEFAULTS_SMTP, host: 'smtp.gmail.com', usuario: 'a@a.com', password: 'clave' }) }],
      ]);
      const sendMail = jest.fn().mockRejectedValue(new Error('mensaje de error muy específico'));
      nodemailer.createTransport.mockReturnValue({ sendMail });

      await expect(enviarCorreo({ destinatario: 'x@x.com', asunto: 'a', cuerpo: 'b' })).rejects.toThrow(
        'mensaje de error muy específico'
      );
    });

    test('correo_remitente usa el usuario SMTP si no se configuró uno explícito', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ ...DEFAULTS_SMTP, host: 'smtp.gmail.com', usuario: 'usuario@gmail.com', password: 'clave', nombre_remitente: '', correo_remitente: '' }) }],
      ]);
      const sendMail = jest.fn().mockResolvedValue({});
      nodemailer.createTransport.mockReturnValue({ sendMail });

      await enviarCorreo({ destinatario: 'x@x.com', asunto: 'a', cuerpo: 'b' });

      expect(sendMail.mock.calls[0][0].from).toBe('usuario@gmail.com');
    });
  });
});
