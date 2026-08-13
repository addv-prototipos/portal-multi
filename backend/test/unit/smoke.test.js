// Verifica que el harness de Jest está correctamente configurado.
// Las pruebas unitarias reales de backend/utils/*.js van en el Segmento B.
describe('smoke: harness de unit tests', () => {
  test('Jest corre en este proyecto', () => {
    expect(1 + 1).toBe(2);
  });
});
