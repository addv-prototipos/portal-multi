// Pruebas de utils/accesoSmtp.js (punto en curso: "Accesos — SMTP",
// copia del SMTP del sitio base para que control/ pueda mandar correo).
// Mismo molde que accesoMinio.test.js — CRUD sobre `ajustes_globales`,
// cifrado delegado a cifrado.js (ya probado aparte).

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const { ErrorAccesoSmtp, getAccesoSmtp, setAccesoSmtp } = require('../../utils/accesoSmtp');
const { ErrorCifrado, cifrar } = require('../../utils/cifrado');

const CLAVE_VALIDA = 'a'.repeat(64);

function mockPool(filasSelect = []) {
  const pool = {
    query: jest.fn((sql) => {
      if (String(sql).trim().startsWith('SELECT')) {
        return Promise.resolve([filasSelect]);
      }
      return Promise.resolve([{ affectedRows: 1 }]);
    }),
  };
  obtenerPool.mockReturnValue(pool);
  return pool;
}

describe('utils/accesoSmtp.js', () => {
  const envOriginal = process.env.CONTROL_VAULT_KEY;

  afterEach(() => {
    process.env.CONTROL_VAULT_KEY = envOriginal;
    jest.clearAllMocks();
  });

  describe('getAccesoSmtp', () => {
    test('nada guardado: devuelve los 7 campos vacíos/null, sin necesitar la clave', async () => {
      delete process.env.CONTROL_VAULT_KEY;
      mockPool([]);
      const resultado = await getAccesoSmtp();
      expect(resultado).toEqual({
        host: '',
        puerto: null,
        seguridad: '',
        usuario: '',
        password: '',
        nombreRemitente: '',
        correoRemitente: '',
        verificadoEn: null,
      });
    });

    test('con datos guardados, descifra el password, el puerto vuelve numérico', async () => {
      process.env.CONTROL_VAULT_KEY = CLAVE_VALIDA;
      const passwordCifrado = cifrar('AppPass123');
      mockPool([
        { clave: 'smtp_host', valor: 'smtp.gmail.com' },
        { clave: 'smtp_puerto', valor: '587' },
        { clave: 'smtp_seguridad', valor: 'starttls' },
        { clave: 'smtp_usuario', valor: 'notificaciones@addv.mx' },
        { clave: 'smtp_password_cifrado', valor: passwordCifrado },
        { clave: 'smtp_nombre_remitente', valor: 'Clarvo - Tu negocio en orden' },
        { clave: 'smtp_correo_remitente', valor: 'info@addv.mx' },
      ]);
      const resultado = await getAccesoSmtp();
      expect(resultado).toEqual({
        host: 'smtp.gmail.com',
        puerto: 587,
        seguridad: 'starttls',
        usuario: 'notificaciones@addv.mx',
        password: 'AppPass123',
        nombreRemitente: 'Clarvo - Tu negocio en orden',
        correoRemitente: 'info@addv.mx',
        verificadoEn: null,
      });
    });

    test('con un password guardado pero CONTROL_VAULT_KEY faltante, propaga ErrorCifrado("config")', async () => {
      process.env.CONTROL_VAULT_KEY = CLAVE_VALIDA;
      const passwordCifrado = cifrar('algo-real');
      delete process.env.CONTROL_VAULT_KEY;
      mockPool([{ clave: 'smtp_password_cifrado', valor: passwordCifrado }]);
      await expect(getAccesoSmtp()).rejects.toBeInstanceOf(ErrorCifrado);
    });
  });

  describe('setAccesoSmtp', () => {
    test('guarda host/puerto/seguridad/usuario/remitentes y cifra el password, upsert de las 8 claves (incluye invalidar verificadoEn)', async () => {
      process.env.CONTROL_VAULT_KEY = CLAVE_VALIDA;
      const pool = mockPool([]);

      await setAccesoSmtp({
        host: 'smtp.gmail.com',
        puerto: 587,
        seguridad: 'starttls',
        usuario: 'notificaciones@addv.mx',
        password: 'clave-real',
        nombreRemitente: 'Clarvo',
        correoRemitente: 'info@addv.mx',
      });

      const llamadasUpsert = pool.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO ajustes_globales'));
      expect(llamadasUpsert).toHaveLength(8);
      const filaPassword = llamadasUpsert.find(([, params]) => params[0] === 'smtp_password_cifrado');
      expect(filaPassword[1][1]).not.toBe('clave-real');
      expect(filaPassword[1][1].split(':')).toHaveLength(3);
      const filaPuerto = llamadasUpsert.find(([, params]) => params[0] === 'smtp_puerto');
      expect(filaPuerto[1][1]).toBe('587');
    });

    test('password === undefined NO toca el password ya guardado', async () => {
      const pool = mockPool([]);
      await setAccesoSmtp({ host: 'smtp.gmail.com', usuario: 'a@b.com', correoRemitente: 'c@d.com' });
      const llamadasUpsert = pool.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO ajustes_globales'));
      expect(llamadasUpsert).toHaveLength(7); // 6 campos + invalidar verificadoEn, sin password
      expect(llamadasUpsert.some(([, params]) => params[0] === 'smtp_password_cifrado')).toBe(false);
    });

    test('password === "" (el operador lo borró a propósito) SÍ lo limpia', async () => {
      const pool = mockPool([]);
      await setAccesoSmtp({ password: '' });
      const filaPassword = pool.query.mock.calls.find(([sql, params]) => params && params[0] === 'smtp_password_cifrado');
      expect(filaPassword[1][1]).toBe('');
    });

    test('rechaza un usuario que no es correo válido', async () => {
      mockPool([]);
      await expect(setAccesoSmtp({ usuario: 'no-es-correo' })).rejects.toThrow(/correo válido/);
    });

    test('rechaza un correo remitente inválido', async () => {
      mockPool([]);
      await expect(setAccesoSmtp({ correoRemitente: 'no-es-correo' })).rejects.toThrow(/correo válido/);
    });

    test('rechaza un puerto fuera de rango (0, negativo, >65535, no entero)', async () => {
      for (const puerto of [0, -1, 70000, 2.5]) {
        mockPool([]);
        // eslint-disable-next-line no-await-in-loop
        await expect(setAccesoSmtp({ puerto })).rejects.toThrow(/entre 1 y 65535/);
      }
    });

    test('rechaza una seguridad fuera de "starttls"/"ssl"', async () => {
      mockPool([]);
      await expect(setAccesoSmtp({ seguridad: 'tls-legacy' })).rejects.toThrow(/starttls, ssl/);
    });

    test('campos vacíos/omitidos son válidos (todo opcional salvo formato)', async () => {
      mockPool([]);
      await expect(setAccesoSmtp({})).resolves.toBeDefined();
    });

    test('guardar un password real sin CONTROL_VAULT_KEY configurada propaga ErrorCifrado("config")', async () => {
      delete process.env.CONTROL_VAULT_KEY;
      mockPool([]);
      const error = await setAccesoSmtp({ password: 'algo-real' }).catch((e) => e);
      expect(error).toBeInstanceOf(ErrorCifrado);
      expect(error.codigo).toBe('config');
    });
  });

  test('ErrorAccesoSmtp sigue siendo la clase que lanzan las validaciones propias', async () => {
    mockPool([]);
    const error = await setAccesoSmtp({ usuario: 'no-es-correo' }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorAccesoSmtp);
  });
});
