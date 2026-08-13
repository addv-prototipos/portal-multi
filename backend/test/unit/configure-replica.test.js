// Pruebas de la lógica pura de backend/scripts/configure-replica.js
// (segmento 8 del plan multi-tenant, ver PROJECT_STATE.md) -- el script
// completo requiere dos instancias de MySQL reales (no disponibles en
// este entorno), así que aquí solo se prueban las piezas que pueden
// aislarse: construcción de queries con una conexión mockeada a mano
// (mismo patrón que cutover-tenant-piloto.test.js) y la interpretación
// pura de SHOW REPLICA STATUS.

const {
  asegurarUsuarioReplicacion,
  verificarGtidActivoEnPrimario,
  configurarFuenteReplica,
  activarSoloLecturaPersistente,
  verificarReplicaCorriendo,
} = require('../../scripts/configure-replica');

function mockConexion() {
  return { query: jest.fn() };
}

describe('scripts/configure-replica.js', () => {
  describe('asegurarUsuarioReplicacion', () => {
    test('crea el usuario, rota la contraseña y otorga solo REPLICATION SLAVE', async () => {
      const primario = mockConexion();
      primario.query.mockResolvedValue([{}]);

      await asegurarUsuarioReplicacion(primario, { usuario: 'repl', password: 'clave-larga' });

      expect(primario.query).toHaveBeenNthCalledWith(1, expect.stringContaining('CREATE USER IF NOT EXISTS'), ['clave-larga']);
      expect(primario.query).toHaveBeenNthCalledWith(2, expect.stringContaining('ALTER USER'), ['clave-larga']);
      expect(primario.query).toHaveBeenNthCalledWith(3, expect.stringContaining('GRANT REPLICATION SLAVE ON *.*'));
      expect(primario.query).toHaveBeenNthCalledWith(4, 'FLUSH PRIVILEGES');
    });
  });

  describe('verificarGtidActivoEnPrimario', () => {
    test('no lanza error si gtid_mode es ON', async () => {
      const primario = mockConexion();
      primario.query.mockResolvedValueOnce([[{ Variable_name: 'gtid_mode', Value: 'ON' }]]);

      await expect(verificarGtidActivoEnPrimario(primario)).resolves.toBeUndefined();
    });

    test('lanza un error claro si gtid_mode no es ON', async () => {
      const primario = mockConexion();
      primario.query.mockResolvedValueOnce([[{ Variable_name: 'gtid_mode', Value: 'OFF' }]]);

      await expect(verificarGtidActivoEnPrimario(primario)).rejects.toThrow(/gtid_mode del primario es "OFF"/);
    });
  });

  describe('configurarFuenteReplica', () => {
    test('detiene replicación previa, configura la fuente por GTID y arranca', async () => {
      const replica = mockConexion();
      replica.query.mockResolvedValue([{}]);

      await configurarFuenteReplica(replica, { host: 'primario.local', port: 3306, usuario: 'repl', password: 'clave' });

      expect(replica.query).toHaveBeenNthCalledWith(1, 'STOP REPLICA');
      expect(replica.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('SOURCE_AUTO_POSITION = 1'),
        ['primario.local', 3306, 'repl', 'clave']
      );
      expect(replica.query).toHaveBeenNthCalledWith(3, 'START REPLICA');
    });

    test('ignora el error 3084 de STOP REPLICA (sin replicación previa configurada)', async () => {
      const replica = mockConexion();
      const errorSinReplicacion = Object.assign(new Error('no configurada'), { errno: 3084 });
      replica.query
        .mockRejectedValueOnce(errorSinReplicacion)
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]);

      await expect(
        configurarFuenteReplica(replica, { host: 'primario.local', port: 3306, usuario: 'repl', password: 'clave' })
      ).resolves.toBeUndefined();
    });

    test('re-lanza cualquier otro error de STOP REPLICA', async () => {
      const replica = mockConexion();
      const otroError = Object.assign(new Error('conexión rechazada'), { errno: 2003 });
      replica.query.mockRejectedValueOnce(otroError);

      await expect(
        configurarFuenteReplica(replica, { host: 'primario.local', port: 3306, usuario: 'repl', password: 'clave' })
      ).rejects.toThrow('conexión rechazada');
    });
  });

  describe('activarSoloLecturaPersistente', () => {
    test('usa SET PERSIST (no SET GLOBAL) para read_only y super_read_only', async () => {
      const replica = mockConexion();
      replica.query.mockResolvedValue([{}]);

      await activarSoloLecturaPersistente(replica);

      expect(replica.query).toHaveBeenNthCalledWith(1, 'SET PERSIST read_only = ON');
      expect(replica.query).toHaveBeenNthCalledWith(2, 'SET PERSIST super_read_only = ON');
    });
  });

  describe('verificarReplicaCorriendo', () => {
    test('ok=true cuando ambos hilos están corriendo', () => {
      const resultado = verificarReplicaCorriendo({ Replica_IO_Running: 'Yes', Replica_SQL_Running: 'Yes' });
      expect(resultado).toEqual({ ok: true, motivo: null });
    });

    test('ok=false si no hay fila (replicación nunca configurada)', () => {
      const resultado = verificarReplicaCorriendo(undefined);
      expect(resultado.ok).toBe(false);
      expect(resultado.motivo).toMatch(/no devolvió ninguna fila/);
    });

    test('ok=false si el hilo de I/O no está corriendo, incluye el último error', () => {
      const resultado = verificarReplicaCorriendo({
        Replica_IO_Running: 'No',
        Replica_SQL_Running: 'Yes',
        Last_IO_Error: 'Access denied',
      });
      expect(resultado.ok).toBe(false);
      expect(resultado.motivo).toMatch(/hilo de I\/O no está corriendo/);
      expect(resultado.motivo).toMatch(/Access denied/);
    });

    test('ok=false si el hilo SQL no está corriendo, incluye el último error', () => {
      const resultado = verificarReplicaCorriendo({
        Replica_IO_Running: 'Yes',
        Replica_SQL_Running: 'No',
        Last_SQL_Error: 'Duplicate entry',
      });
      expect(resultado.ok).toBe(false);
      expect(resultado.motivo).toMatch(/hilo SQL no está corriendo/);
      expect(resultado.motivo).toMatch(/Duplicate entry/);
    });
  });
});
