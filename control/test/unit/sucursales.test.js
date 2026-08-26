// Pruebas de utils/sucursales.js (§58) — agrupar tenants como sucursales
// del mismo negocio + usuarios de acceso compartidos. BD mockeada a mano
// (db pasado explícito a cada función, mismo patrón que
// tenantMarca.js/tenantTema.js); notificarInvalidacionCache mockeada para
// no depender de fetch real.

jest.mock('../../db', () => ({ obtenerPool: jest.fn() }));
jest.mock('../../utils/notificarBackend', () => ({
  notificarInvalidacionCache: jest.fn().mockResolvedValue(undefined),
}));

const { notificarInvalidacionCache } = require('../../utils/notificarBackend');
const {
  ErrorSucursal,
  listarGruposSucursal,
  obtenerGrupoSucursal,
  crearGrupoSucursal,
  actualizarGrupoSucursal,
  eliminarGrupoSucursal,
  crearUsuarioSucursal,
  actualizarUsuarioSucursal,
} = require('../../utils/sucursales');

function mockDb() {
  return { query: jest.fn() };
}

describe('utils/sucursales.js (§58)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('crearGrupoSucursal', () => {
    test('rechaza nombre vacío sin tocar la BD', async () => {
      const db = mockDb();
      await expect(crearGrupoSucursal({ nombre: '  ' }, { db })).rejects.toMatchObject({
        name: 'ErrorSucursal',
        codigo: 'validacion',
      });
      expect(db.query).not.toHaveBeenCalled();
    });

    test('crea el grupo sin sucursales iniciales', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([{ insertId: 5 }]) // INSERT grupos_sucursal
        .mockResolvedValueOnce([[{ id: 5, nombre: 'Grupo Norte' }]]) // obtenerGrupoSucursal: SELECT grupo
        .mockResolvedValueOnce([[]]) // SELECT tenants del grupo
        .mockResolvedValueOnce([[]]); // SELECT usuarios del grupo

      const grupo = await crearGrupoSucursal({ nombre: 'Grupo Norte' }, { db, actor: 'super' });

      expect(grupo.id).toBe(5);
      expect(db.query).toHaveBeenCalledTimes(4);
    });

    test('todo o nada: si un slug ya pertenece a OTRO grupo, no asocia ninguno y no crea filas huérfanas', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([{ insertId: 9 }]) // INSERT grupos_sucursal
        .mockResolvedValueOnce([
          [
            { id: 1, slug: 'norte', grupo_sucursal_id: null },
            { id: 2, slug: 'sur', grupo_sucursal_id: 3 }, // ya en otro grupo
          ],
        ]); // SELECT tenants por slug

      await expect(
        crearGrupoSucursal({ nombre: 'Grupo Nuevo', slugs: ['norte', 'sur'] }, { db })
      ).rejects.toMatchObject({ codigo: 'conflicto' });

      // Nunca llegó a hacer ningún UPDATE de asociación (todo o nada).
      const llamadasUpdate = db.query.mock.calls.filter(([sql]) => sql.includes('UPDATE tenants'));
      expect(llamadasUpdate).toHaveLength(0);
    });

    test('slug inexistente responde no_encontrado', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([{ insertId: 9 }])
        .mockResolvedValueOnce([[]]); // ningún tenant encontrado

      await expect(
        crearGrupoSucursal({ nombre: 'Grupo Nuevo', slugs: ['fantasma'] }, { db })
      ).rejects.toMatchObject({ codigo: 'no_encontrado' });
    });

    test('asocia sucursales válidas, registra evento e invalida caché por cada una', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([{ insertId: 10 }]) // INSERT grupo
        .mockResolvedValueOnce([
          [
            { id: 1, slug: 'norte', grupo_sucursal_id: null },
            { id: 2, slug: 'sur', grupo_sucursal_id: null },
          ],
        ]) // SELECT tenants por slug
        .mockResolvedValueOnce([{}]) // UPDATE norte
        .mockResolvedValueOnce([{}]) // registrarEvento norte
        .mockResolvedValueOnce([{}]) // UPDATE sur
        .mockResolvedValueOnce([{}]) // registrarEvento sur
        .mockResolvedValueOnce([[{ id: 10, nombre: 'Grupo Centro' }]]) // obtenerGrupoSucursal
        .mockResolvedValueOnce([[{ slug: 'norte' }, { slug: 'sur' }]])
        .mockResolvedValueOnce([[]]);

      await crearGrupoSucursal({ nombre: 'Grupo Centro', slugs: ['norte', 'sur'] }, { db, actor: 'super' });

      expect(notificarInvalidacionCache).toHaveBeenCalledWith('norte');
      expect(notificarInvalidacionCache).toHaveBeenCalledWith('sur');
      expect(notificarInvalidacionCache).toHaveBeenCalledTimes(2);
    });
  });

  describe('obtenerGrupoSucursal', () => {
    test('grupo inexistente responde no_encontrado', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[]]);
      await expect(obtenerGrupoSucursal(999, db)).rejects.toMatchObject({ codigo: 'no_encontrado' });
    });

    test('devuelve grupo + tenants + usuarios (activo convertido a booleano)', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ id: 1, nombre: 'Grupo A' }]])
        .mockResolvedValueOnce([[{ slug: 'norte', nombre_empresa: 'Norte SA' }]])
        .mockResolvedValueOnce([[{ id: 1, usuario: 'gerente', perfil: 'administrador', activo: 1 }]]);

      const grupo = await obtenerGrupoSucursal(1, db);

      expect(grupo.tenants).toEqual([{ slug: 'norte', nombre_empresa: 'Norte SA' }]);
      expect(grupo.usuarios[0].activo).toBe(true);
    });
  });

  describe('actualizarGrupoSucursal', () => {
    test('grupo inexistente responde no_encontrado', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[]]);
      await expect(actualizarGrupoSucursal(1, { nombre: 'X' }, { db })).rejects.toMatchObject({
        codigo: 'no_encontrado',
      });
    });

    test('renombra y quita una sucursal en la misma llamada', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // SELECT grupo existe
        .mockResolvedValueOnce([{}]) // UPDATE nombre
        .mockResolvedValueOnce([[{ id: 2, grupo_sucursal_id: 1 }]]) // SELECT tenant a desasociar
        .mockResolvedValueOnce([{}]) // UPDATE tenants SET grupo_sucursal_id = NULL
        .mockResolvedValueOnce([{}]) // registrarEvento
        .mockResolvedValueOnce([[{ id: 1, nombre: 'Grupo Renombrado' }]]) // obtenerGrupoSucursal
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await actualizarGrupoSucursal(1, { nombre: 'Grupo Renombrado', quitarSlugs: ['sur'] }, { db, actor: 'super' });

      expect(notificarInvalidacionCache).toHaveBeenCalledWith('sur');
    });
  });

  describe('eliminarGrupoSucursal', () => {
    test('grupo inexistente responde no_encontrado', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[]]);
      await expect(eliminarGrupoSucursal(1, { db })).rejects.toMatchObject({ codigo: 'no_encontrado' });
    });

    // Soft-delete a propósito: control_app no tiene privilegio DELETE ni
    // REFERENCES (validado contra MySQL real) — "eliminar" desactiva el
    // grupo, suelta sus tenants y desactiva sus usuarios, sin ningún
    // DELETE ni depender de un ON DELETE CASCADE que no puede existir.
    test('audita, suelta tenants, desactiva usuarios y desactiva el grupo (soft-delete, nunca DELETE)', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // SELECT grupo existe y activo
        .mockResolvedValueOnce([[{ id: 10, slug: 'norte' }]]) // SELECT tenants asociados
        .mockResolvedValueOnce([{}]) // registrarEvento norte
        .mockResolvedValueOnce([{}]) // UPDATE tenants SET grupo_sucursal_id = NULL
        .mockResolvedValueOnce([{}]) // UPDATE usuarios_sucursal SET activo = 0
        .mockResolvedValueOnce([{}]); // UPDATE grupos_sucursal SET activo = 0

      await eliminarGrupoSucursal(1, { db, actor: 'super' });

      expect(notificarInvalidacionCache).toHaveBeenCalledWith('norte');
      expect(db.query.mock.calls.some(([sql]) => sql.includes('DELETE'))).toBe(false);
      expect(db.query.mock.calls[3][0]).toMatch(/UPDATE tenants SET grupo_sucursal_id = NULL/);
      expect(db.query.mock.calls[4][0]).toMatch(/UPDATE usuarios_sucursal SET activo = 0/);
      expect(db.query.mock.calls[5][0]).toMatch(/UPDATE grupos_sucursal SET activo = 0/);
    });
  });

  describe('crearUsuarioSucursal', () => {
    test('rechaza contraseña corta sin tocar la BD más allá de confirmar el grupo', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // el grupo existe

      await expect(
        crearUsuarioSucursal(1, { usuario: 'gerente', password: '123', perfil: 'administrador' }, { db })
      ).rejects.toMatchObject({ codigo: 'validacion' });
    });

    test('rechaza perfil inválido', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 1 }]]);
      await expect(
        crearUsuarioSucursal(1, { usuario: 'gerente', password: 'Abcdefg1', perfil: 'cliente' }, { db })
      ).rejects.toMatchObject({ codigo: 'validacion' });
    });

    test('rechaza usuario duplicado dentro del mismo grupo', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // grupo existe
        .mockResolvedValueOnce([[{ id: 99 }]]); // ya existe ese usuario en el grupo

      await expect(
        crearUsuarioSucursal(1, { usuario: 'gerente', password: 'Abcdefg1', perfil: 'administrador' }, { db })
      ).rejects.toMatchObject({ codigo: 'conflicto' });
    });

    test('crea el usuario con password hasheada (nunca en texto plano)', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // grupo existe
        .mockResolvedValueOnce([[]]) // sin duplicado
        .mockResolvedValueOnce([{ insertId: 7 }]); // INSERT

      const resultado = await crearUsuarioSucursal(
        1,
        { usuario: 'gerente', password: 'Abcdefg1', perfil: 'administrador' },
        { db, actor: 'super' }
      );

      expect(resultado.id).toBe(7);
      const [, params] = db.query.mock.calls[2];
      const passwordHashGuardado = params[2];
      expect(passwordHashGuardado).not.toBe('Abcdefg1');
      expect(passwordHashGuardado).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
    });
  });

  describe('actualizarUsuarioSucursal', () => {
    test('usuario inexistente en el grupo responde no_encontrado', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[]]);
      await expect(actualizarUsuarioSucursal(1, 5, { activo: false }, { db })).rejects.toMatchObject({
        codigo: 'no_encontrado',
      });
    });

    test('sin cambios en el body responde validacion sin tocar la fila', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 5 }]]);
      await expect(actualizarUsuarioSucursal(1, 5, {}, { db })).rejects.toMatchObject({ codigo: 'validacion' });
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('desactiva al usuario', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 5 }]]).mockResolvedValueOnce([{}]);
      await actualizarUsuarioSucursal(1, 5, { activo: false }, { db });
      const [sql, params] = db.query.mock.calls[1];
      expect(sql).toMatch(/activo = \?/);
      expect(params).toContain(0);
    });
  });


  test('ErrorSucursal expone name y codigo', () => {
    const err = new ErrorSucursal('mensaje', 'validacion');
    expect(err.name).toBe('ErrorSucursal');
    expect(err.codigo).toBe('validacion');
    expect(err.message).toBe('mensaje');
  });
});
