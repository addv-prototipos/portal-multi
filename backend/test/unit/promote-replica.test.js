// Pruebas de la lógica pura de backend/scripts/promote-replica.js
// (segmento 8 del plan multi-tenant, ver PROJECT_STATE.md).

const { verificarListaParaPromover } = require('../../scripts/promote-replica');

describe('scripts/promote-replica.js', () => {
  describe('verificarListaParaPromover', () => {
    test('ok=true si no hay fila (nunca fue réplica o ya fue promovida)', () => {
      expect(verificarListaParaPromover(undefined)).toEqual({ ok: true, motivo: null });
    });

    test('ok=true si no hay retraso ni errores pendientes', () => {
      const resultado = verificarListaParaPromover({
        Seconds_Behind_Source: 0,
        Last_IO_Error: '',
        Last_SQL_Error: '',
      });
      expect(resultado).toEqual({ ok: true, motivo: null });
    });

    test('ok=false si hay retraso pendiente y no se forzó', () => {
      const resultado = verificarListaParaPromover({ Seconds_Behind_Source: 12, Last_IO_Error: '', Last_SQL_Error: '' });
      expect(resultado.ok).toBe(false);
      expect(resultado.motivo).toMatch(/12s de retraso pendiente/);
      expect(resultado.motivo).toMatch(/--force/);
    });

    test('ok=true con retraso pendiente si se forzó', () => {
      const resultado = verificarListaParaPromover(
        { Seconds_Behind_Source: 12, Last_IO_Error: '', Last_SQL_Error: '' },
        { forzar: true }
      );
      expect(resultado.ok).toBe(true);
    });

    test('ok=false si hay un error de replicación pendiente sin resolver, sin forzar', () => {
      const resultado = verificarListaParaPromover({
        Seconds_Behind_Source: 0,
        Last_IO_Error: 'Access denied',
        Last_SQL_Error: '',
      });
      expect(resultado.ok).toBe(false);
      expect(resultado.motivo).toMatch(/Access denied/);
    });

    test('ok=true con error pendiente si se forzó', () => {
      const resultado = verificarListaParaPromover(
        { Seconds_Behind_Source: 0, Last_IO_Error: 'Access denied', Last_SQL_Error: '' },
        { forzar: true }
      );
      expect(resultado.ok).toBe(true);
    });

    test('Seconds_Behind_Source null (I/O detenido) no bloquea la promoción por sí solo', () => {
      const resultado = verificarListaParaPromover({ Seconds_Behind_Source: null, Last_IO_Error: '', Last_SQL_Error: '' });
      expect(resultado.ok).toBe(true);
    });
  });
});
