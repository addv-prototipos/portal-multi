// Pruebas de utils/accesoMinio.js (punto en curso: "Accesos — MinIO",
// bloc de notas cifrado, NO sincronizado con .env/MinIO real). El cifrado
// en sí (AES-256-GCM, primero reversible del repo) se prueba aparte en
// cifrado.test.js — aquí solo el CRUD sobre `ajustes_globales` y que el
// error de config (CONTROL_VAULT_KEY faltante) se propague tal cual.

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const { ErrorAccesoMinio, getAccesoMinio, setAccesoMinio } = require('../../utils/accesoMinio');
const { ErrorCifrado, cifrar } = require('../../utils/cifrado');

const CLAVE_VALIDA = 'a'.repeat(64); // 32 bytes en hex

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

describe('utils/accesoMinio.js', () => {
  const envOriginal = process.env.CONTROL_VAULT_KEY;

  afterEach(() => {
    process.env.CONTROL_VAULT_KEY = envOriginal;
    jest.clearAllMocks();
  });

  describe('getAccesoMinio', () => {
    test('nada guardado: devuelve los 4 campos vacíos, sin necesitar la clave', async () => {
      delete process.env.CONTROL_VAULT_KEY;
      mockPool([]);
      const resultado = await getAccesoMinio();
      expect(resultado).toEqual({ url: '', usuario: '', password: '', notas: '' });
    });

    test('con datos guardados, descifra el password y regresa los demás campos tal cual', async () => {
      process.env.CONTROL_VAULT_KEY = CLAVE_VALIDA;
      const passwordCifrado = cifrar('MinioPass!');
      mockPool([
        { clave: 'minio_url', valor: 'https://minio.ejemplo.com:9001' },
        { clave: 'minio_usuario', valor: 'minioadmin' },
        { clave: 'minio_password_cifrado', valor: passwordCifrado },
        { clave: 'minio_notas', valor: 'rotada hace poco' },
      ]);
      const resultado = await getAccesoMinio();
      expect(resultado).toEqual({
        url: 'https://minio.ejemplo.com:9001',
        usuario: 'minioadmin',
        password: 'MinioPass!',
        notas: 'rotada hace poco',
      });
    });

    test('con un password guardado pero CONTROL_VAULT_KEY faltante, propaga ErrorCifrado("config") — nunca lo esconde', async () => {
      process.env.CONTROL_VAULT_KEY = CLAVE_VALIDA;
      const passwordCifrado = cifrar('algo-real');
      delete process.env.CONTROL_VAULT_KEY;
      mockPool([{ clave: 'minio_password_cifrado', valor: passwordCifrado }]);
      await expect(getAccesoMinio()).rejects.toBeInstanceOf(ErrorCifrado);
    });
  });

  describe('setAccesoMinio', () => {
    test('guarda url/usuario/notas y cifra el password, upsert de las 4 claves', async () => {
      process.env.CONTROL_VAULT_KEY = CLAVE_VALIDA;
      const pool = mockPool([
        { clave: 'minio_url', valor: 'https://minio.ejemplo.com' },
        { clave: 'minio_usuario', valor: 'root' },
        { clave: 'minio_notas', valor: 'nota' },
      ]);

      await setAccesoMinio({ url: 'https://minio.ejemplo.com', usuario: 'root', password: 'clave-real', notas: 'nota' });

      const llamadasUpsert = pool.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO ajustes_globales'));
      expect(llamadasUpsert).toHaveLength(4);
      const claves = llamadasUpsert.map(([, params]) => params[0]);
      expect(claves).toEqual(expect.arrayContaining(['minio_url', 'minio_usuario', 'minio_notas', 'minio_password_cifrado']));
      const filaPassword = llamadasUpsert.find(([, params]) => params[0] === 'minio_password_cifrado');
      expect(filaPassword[1][1]).not.toBe('clave-real'); // nunca se guarda en texto plano
      expect(filaPassword[1][1].split(':')).toHaveLength(3);
    });

    test('password === undefined (campo no enviado) NO toca el password ya guardado', async () => {
      const pool = mockPool([]);
      await setAccesoMinio({ url: 'https://minio.ejemplo.com', usuario: 'root', notas: 'x' });
      const llamadasUpsert = pool.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO ajustes_globales'));
      expect(llamadasUpsert).toHaveLength(3); // url, usuario, notas — sin password
      expect(llamadasUpsert.some(([, params]) => params[0] === 'minio_password_cifrado')).toBe(false);
    });

    test('password === "" (el operador lo borró a propósito) SÍ lo limpia', async () => {
      const pool = mockPool([]);
      await setAccesoMinio({ url: '', usuario: '', password: '', notas: '' });
      const filaPassword = pool.query.mock.calls.find(([sql, params]) => params && params[0] === 'minio_password_cifrado');
      expect(filaPassword[1][1]).toBe('');
    });

    test('rechaza una URL sin http:// o https://', async () => {
      mockPool([]);
      await expect(setAccesoMinio({ url: 'minio.ejemplo.com' })).rejects.toThrow(/http/);
    });

    test('URL vacía es válida (campo opcional, nada que validar)', async () => {
      mockPool([]);
      await expect(setAccesoMinio({ url: '' })).resolves.toBeDefined();
    });

    test('rechaza un password mayor a 2000 caracteres', async () => {
      mockPool([]);
      await expect(setAccesoMinio({ password: 'x'.repeat(2001) })).rejects.toThrow(/2000 caracteres/);
    });

    test('guardar un password real sin CONTROL_VAULT_KEY configurada propaga ErrorCifrado("config")', async () => {
      delete process.env.CONTROL_VAULT_KEY;
      mockPool([]);
      const error = await setAccesoMinio({ password: 'algo-real' }).catch((e) => e);
      expect(error).toBeInstanceOf(ErrorCifrado);
      expect(error.codigo).toBe('config');
    });
  });

  // ErrorAccesoMinio sigue viva — usada por la validación propia de este
  // módulo (URL/longitud), distinta de ErrorCifrado (config del cifrado).
  test('ErrorAccesoMinio sigue siendo la clase que lanzan las validaciones propias', async () => {
    mockPool([]);
    const error = await setAccesoMinio({ url: 'sin-protocolo' }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorAccesoMinio);
  });
});
