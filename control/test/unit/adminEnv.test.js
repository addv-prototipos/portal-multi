// Punto 247 — gestión de ADMIN_USERS en el .env real desde /control.
// Nunca toca disco de verdad: fs mockeado por completo. El ciclo real
// (contra Docker/MySQL) se validó por HTTP, ver PROJECT_STATE.md punto 247.

jest.mock('fs');
const fs = require('fs');

const adminEnv = require('../../utils/adminEnv');
const {
  parsearAdminUsers,
  validarUsuario,
  validarPassword,
  leerAdminUsersDeEnv,
  listarSuperAdmins,
  guardarAdminUsersEnEnv,
  notificarBackendRecarga,
} = adminEnv;

describe('adminEnv: parsearAdminUsers', () => {
  test('parsea "usuario:pass,usuario2:pass2" en un Map', () => {
    const map = parsearAdminUsers('admin:admin,otro:Clave123');
    expect(Array.from(map.entries())).toEqual([
      ['admin', 'admin'],
      ['otro', 'Clave123'],
    ]);
  });

  test('vacío/null cae a admin:admin por defecto', () => {
    expect(Array.from(parsearAdminUsers('').keys())).toEqual(['admin']);
    expect(Array.from(parsearAdminUsers(null).keys())).toEqual(['admin']);
  });

  test('entradas sin ":" o vacías se ignoran', () => {
    const map = parsearAdminUsers('admin:admin,,sinseparador,otro:x');
    expect(Array.from(map.keys())).toEqual(['admin', 'otro']);
  });
});

describe('adminEnv: validarUsuario', () => {
  test.each([
    [undefined, 'Usuario requerido.'],
    ['', 'Usuario requerido.'],
    ['ab', 'Usuario mínimo 3 caracteres.'],
    ['a'.repeat(65), 'Usuario máximo 64 caracteres.'],
    ['usuario con espacios', 'Usuario solo letras, números, punto, guión y guión bajo.'],
  ])('%p -> %p', (valor, esperado) => {
    expect(validarUsuario(valor)).toBe(esperado);
  });

  test('usuario válido no da error', () => {
    expect(validarUsuario('admin2._-')).toBeNull();
  });
});

describe('adminEnv: validarPassword', () => {
  test.each([
    [undefined, 'Contraseña requerida.'],
    ['12345', 'Contraseña mínimo 6 caracteres.'],
    ['a'.repeat(129), 'Contraseña máximo 128 caracteres.'],
    ['tiene,coma', 'Contraseña no puede contener "," ni ":".'],
    ['tiene:dos', 'Contraseña no puede contener "," ni ":".'],
  ])('%p -> %p', (valor, esperado) => {
    expect(validarPassword(valor)).toBe(esperado);
  });

  test('contraseña válida no da error', () => {
    expect(validarPassword('ClaveValida9')).toBeNull();
  });
});

describe('adminEnv: leerAdminUsersDeEnv', () => {
  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.ADMIN_USERS;
  });

  test('archivo con línea ADMIN_USERS la usa tal cual', () => {
    fs.readFileSync.mockReturnValue('OTRA_VAR=x\nADMIN_USERS=admin:admin,otro:pass\n');
    const { valor } = leerAdminUsersDeEnv('/ruta/.env');
    expect(valor).toBe('admin:admin,otro:pass');
  });

  test('con comillas alrededor del valor, las quita', () => {
    fs.readFileSync.mockReturnValue('ADMIN_USERS="admin:admin"\n');
    const { valor } = leerAdminUsersDeEnv('/ruta/.env');
    expect(valor).toBe('admin:admin');
  });

  test('con varias líneas ADMIN_USERS, se queda con la ÚLTIMA', () => {
    fs.readFileSync.mockReturnValue('ADMIN_USERS=viejo:pass\nADMIN_USERS=nuevo:pass2\n');
    const { valor } = leerAdminUsersDeEnv('/ruta/.env');
    expect(valor).toBe('nuevo:pass2');
  });

  test('archivo inexistente (ENOENT) cae a process.env.ADMIN_USERS', () => {
    const err = new Error('no existe');
    err.code = 'ENOENT';
    fs.readFileSync.mockImplementation(() => { throw err; });
    process.env.ADMIN_USERS = 'desdeenv:pass';
    const { valor } = leerAdminUsersDeEnv('/ruta/.env');
    expect(valor).toBe('desdeenv:pass');
  });

  test('sin archivo y sin process.env.ADMIN_USERS, cae a admin:admin', () => {
    const err = new Error('no existe');
    err.code = 'ENOENT';
    fs.readFileSync.mockImplementation(() => { throw err; });
    const { valor } = leerAdminUsersDeEnv('/ruta/.env');
    expect(valor).toBe('admin:admin');
  });

  test('archivo sin la línea ADMIN_USERS (otras variables) cae a process.env', () => {
    fs.readFileSync.mockReturnValue('OTRA_VAR=x\n');
    process.env.ADMIN_USERS = 'admin:admin';
    const { valor } = leerAdminUsersDeEnv('/ruta/.env');
    expect(valor).toBe('admin:admin');
  });
});

describe('adminEnv: listarSuperAdmins', () => {
  afterEach(() => jest.resetAllMocks());

  test('devuelve solo los usuarios, ordenados, sin contraseñas', () => {
    fs.readFileSync.mockReturnValue('ADMIN_USERS=zeta:pass1,alfa:pass2\n');
    expect(listarSuperAdmins()).toEqual(['alfa', 'zeta']);
  });
});

describe('adminEnv: guardarAdminUsersEnEnv', () => {
  afterEach(() => jest.resetAllMocks());

  test('reemplaza la línea ADMIN_USERS existente, conserva el resto del archivo', () => {
    fs.readFileSync.mockReturnValue('PORT=4001\nADMIN_USERS=viejo:pass\nOTRA=y\n');
    const escritos = [];
    fs.writeFileSync.mockImplementation((ruta, contenido) => escritos.push({ ruta, contenido }));

    guardarAdminUsersEnEnv('nuevo:pass,otro:pass2', '/ruta/.env');

    // El backup se escribe con el contenido ANTERIOR, antes que el archivo real.
    expect(escritos[0].ruta).toBe('/ruta/.env.bak');
    expect(escritos[0].contenido).toBe('PORT=4001\nADMIN_USERS=viejo:pass\nOTRA=y\n');
    expect(escritos[1].ruta).toBe('/ruta/.env');
    expect(escritos[1].contenido).toBe('PORT=4001\nADMIN_USERS=nuevo:pass,otro:pass2\nOTRA=y\n');
  });

  test('sin línea ADMIN_USERS previa, la agrega al final', () => {
    fs.readFileSync.mockReturnValue('PORT=4001\n');
    const escritos = [];
    fs.writeFileSync.mockImplementation((ruta, contenido) => escritos.push({ ruta, contenido }));

    guardarAdminUsersEnEnv('admin:admin', '/ruta/.env');

    const escritoReal = escritos.find((e) => e.ruta === '/ruta/.env');
    expect(escritoReal.contenido).toBe('PORT=4001\nADMIN_USERS=admin:admin\n');
  });

  test('archivo vacío/inexistente: no intenta escribir .bak, solo el .env real', () => {
    const err = new Error('no existe');
    err.code = 'ENOENT';
    fs.readFileSync.mockImplementation(() => { throw err; });
    const escritos = [];
    fs.writeFileSync.mockImplementation((ruta, contenido) => escritos.push({ ruta, contenido }));

    guardarAdminUsersEnEnv('admin:admin', '/ruta/.env');

    expect(escritos).toHaveLength(1);
    expect(escritos[0]).toEqual({ ruta: '/ruta/.env', contenido: 'ADMIN_USERS=admin:admin\n' });
  });

  test('escribe directo con writeFileSync, SIN pasar por rename (bug real del bind mount, ver comentario en adminEnv.js)', () => {
    fs.readFileSync.mockReturnValue('ADMIN_USERS=admin:admin\n');
    fs.writeFileSync.mockImplementation(() => {});
    guardarAdminUsersEnEnv('admin:admin,otro:pass', '/ruta/.env');
    expect(fs.renameSync).not.toHaveBeenCalled();
  });
});

describe('adminEnv: notificarBackendRecarga', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
    delete process.env.BACKEND_INTERNAL_URL;
    delete process.env.INTERNAL_CACHE_SECRET;
  });

  test('llama al backend con el secreto interno y el valor nuevo, sin lanzar si responde bien', async () => {
    process.env.INTERNAL_CACHE_SECRET = 'secreto-test';
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    await notificarBackendRecarga('admin:admin,otro:pass');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend:4000/internal/reload-admin-users',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Internal-Secret': 'secreto-test' }),
        body: JSON.stringify({ adminUsers: 'admin:admin,otro:pass' }),
      })
    );
  });

  test('si el backend responde con error, NO lanza (solo loguea)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    await expect(notificarBackendRecarga('admin:admin')).resolves.toBeUndefined();
  });

  test('si fetch rechaza (backend caído), NO lanza (solo loguea)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(notificarBackendRecarga('admin:admin')).resolves.toBeUndefined();
  });
});
