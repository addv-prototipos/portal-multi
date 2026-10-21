// Hallazgo M-10 (sonar.html, 2026-10-13) — módulo compartido de
// protección CSV/Formula Injection. Extraído de inventarioImportacion.js
// para que reportes.js y server.js (kardex-exportar) lo reutilicen en
// vez de duplicar la lógica (o, peor, exportar sin protección).
const { protegerCeldaCSV, filaACSV } = require('../../utils/csvSeguro');

describe('protegerCeldaCSV — OWASP CSV Injection', () => {
  test('antepone apóstrofo a celdas que empiezan con = + - @ tab o CR', () => {
    expect(protegerCeldaCSV('=cmd|"/c calc"!A1')).toBe("'=cmd|\"/c calc\"!A1");
    expect(protegerCeldaCSV('+1234')).toBe("'+1234");
    expect(protegerCeldaCSV('-1234')).toBe("'-1234");
    expect(protegerCeldaCSV('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(protegerCeldaCSV('\tmalicioso')).toBe("'\tmalicioso");
  });

  test('deja intacto texto normal', () => {
    expect(protegerCeldaCSV('Producto normal')).toBe('Producto normal');
    expect(protegerCeldaCSV('')).toBe('');
  });

  test('null/undefined se convierten en cadena vacía', () => {
    expect(protegerCeldaCSV(null)).toBe('');
    expect(protegerCeldaCSV(undefined)).toBe('');
  });

  test('números se convierten a texto sin protección (nunca empiezan con los caracteres peligrosos como texto normal)', () => {
    expect(protegerCeldaCSV(1234)).toBe('1234');
  });
});

describe('filaACSV — fila completa a CSV', () => {
  test('protege fórmulas y envuelve en comillas celdas con coma/comilla/salto de línea', () => {
    expect(filaACSV(['=mal', 'normal', 'con,coma'])).toBe('\'=mal,normal,"con,coma"');
  });

  test('duplica comillas internas', () => {
    expect(filaACSV(['dice "hola"'])).toBe('"dice ""hola"""');
  });
});
