// Pruebas de la lógica pura de backend/scripts/verify-replication.js
// (segmento 8 del plan multi-tenant, ver PROJECT_STATE.md).

const { evaluarEstadoReplica, leerMaxRetrasoSeg, MAX_RETRASO_SEG_DEFAULT } = require('../../scripts/verify-replication');

describe('scripts/verify-replication.js', () => {
  describe('evaluarEstadoReplica', () => {
    test('ok=true cuando ambos hilos corren y el retraso está bajo el máximo', () => {
      const resultado = evaluarEstadoReplica({
        Replica_IO_Running: 'Yes',
        Replica_SQL_Running: 'Yes',
        Seconds_Behind_Source: 3,
      });
      expect(resultado).toEqual({ ok: true, problemas: [] });
    });

    test('ok=false sin fila (nodo no configurado como réplica)', () => {
      const resultado = evaluarEstadoReplica(undefined);
      expect(resultado.ok).toBe(false);
      expect(resultado.problemas[0]).toMatch(/no está configurado como réplica/);
    });

    test('reporta el hilo de I/O detenido', () => {
      const resultado = evaluarEstadoReplica({
        Replica_IO_Running: 'No',
        Replica_SQL_Running: 'Yes',
        Seconds_Behind_Source: null,
        Last_IO_Error: 'Access denied',
      });
      expect(resultado.ok).toBe(false);
      expect(resultado.problemas.some((p) => p.includes('Hilo de I/O detenido'))).toBe(true);
      expect(resultado.problemas.some((p) => p.includes('Access denied'))).toBe(true);
    });

    test('reporta el hilo SQL detenido', () => {
      const resultado = evaluarEstadoReplica({
        Replica_IO_Running: 'Yes',
        Replica_SQL_Running: 'No',
        Seconds_Behind_Source: 0,
        Last_SQL_Error: 'Duplicate entry',
      });
      expect(resultado.ok).toBe(false);
      expect(resultado.problemas.some((p) => p.includes('Hilo SQL detenido'))).toBe(true);
    });

    test('reporta retraso NULL como problema aparte (no puede medirse)', () => {
      const resultado = evaluarEstadoReplica({
        Replica_IO_Running: 'No',
        Replica_SQL_Running: 'Yes',
        Seconds_Behind_Source: null,
      });
      expect(resultado.problemas.some((p) => p.includes('Seconds_Behind_Source es NULL'))).toBe(true);
    });

    test('reporta retraso por encima del máximo configurado', () => {
      const resultado = evaluarEstadoReplica(
        { Replica_IO_Running: 'Yes', Replica_SQL_Running: 'Yes', Seconds_Behind_Source: 120 },
        { maxRetrasoSeg: 60 }
      );
      expect(resultado.ok).toBe(false);
      expect(resultado.problemas[0]).toMatch(/120s.*máximo aceptado \(60s\)/);
    });

    test('usa MAX_RETRASO_SEG_DEFAULT cuando no se pasa maxRetrasoSeg', () => {
      const resultado = evaluarEstadoReplica({
        Replica_IO_Running: 'Yes',
        Replica_SQL_Running: 'Yes',
        Seconds_Behind_Source: MAX_RETRASO_SEG_DEFAULT + 1,
      });
      expect(resultado.ok).toBe(false);
    });
  });

  describe('leerMaxRetrasoSeg', () => {
    test('usa el default sin el flag', () => {
      expect(leerMaxRetrasoSeg(['node', 'verify-replication.js'])).toBe(MAX_RETRASO_SEG_DEFAULT);
    });

    test('parsea el flag --max-retraso-seg=', () => {
      expect(leerMaxRetrasoSeg(['node', 'verify-replication.js', '--max-retraso-seg=15'])).toBe(15);
    });

    test('usa el default si el flag trae un valor no numérico', () => {
      expect(leerMaxRetrasoSeg(['node', 'verify-replication.js', '--max-retraso-seg=abc'])).toBe(MAX_RETRASO_SEG_DEFAULT);
    });

    test('usa el default si el flag trae un valor negativo', () => {
      expect(leerMaxRetrasoSeg(['node', 'verify-replication.js', '--max-retraso-seg=-5'])).toBe(MAX_RETRASO_SEG_DEFAULT);
    });
  });
});
