const { formatearParrafosCuerpo, escapeHtmlCorreo } = require('../../utils/correoMarca');

describe('formatearParrafosCuerpo', () => {
  test('convierte **negrita** a <strong> real', () => {
    expect(formatearParrafosCuerpo('Hola **mundo**')).toEqual(['Hola <strong>mundo</strong>']);
  });

  test('convierte *cursiva* a <em> real', () => {
    expect(formatearParrafosCuerpo('Hola *mundo*')).toEqual(['Hola <em>mundo</em>']);
  });

  test('combina negrita y cursiva en la misma línea', () => {
    expect(formatearParrafosCuerpo('**Hola** y *mundo*')).toEqual([
      '<strong>Hola</strong> y <em>mundo</em>',
    ]);
  });

  test('separa por línea, recorta y descarta líneas vacías', () => {
    expect(formatearParrafosCuerpo('  primera  \n\n  **segunda**  \n')).toEqual([
      'primera',
      '<strong>segunda</strong>',
    ]);
  });

  test('input vacío o no-string devuelve arreglo vacío', () => {
    expect(formatearParrafosCuerpo('')).toEqual([]);
    expect(formatearParrafosCuerpo(null)).toEqual([]);
    expect(formatearParrafosCuerpo(undefined)).toEqual([]);
  });

  test('nunca deja pasar HTML crudo del admin — se escapa antes del marcado', () => {
    const resultado = formatearParrafosCuerpo('<script>alert(1)</script> **bold**');
    expect(resultado).toEqual(['&lt;script&gt;alert(1)&lt;/script&gt; <strong>bold</strong>']);
    expect(resultado[0]).not.toContain('<script>');
  });

  test('un intento de escapar el marcado con HTML no produce una etiqueta real', () => {
    // Un admin que escriba literalmente "<strong>" a mano lo ve como texto,
    // nunca como una etiqueta interpretada por el cliente de correo.
    const resultado = formatearParrafosCuerpo('<strong>falso</strong>');
    expect(resultado[0]).toBe('&lt;strong&gt;falso&lt;/strong&gt;');
  });

  test('sigue coincidiendo con escapeHtmlCorreo cuando no hay marcado', () => {
    const texto = 'Correo & "cita" <> normal';
    expect(formatearParrafosCuerpo(texto)).toEqual([escapeHtmlCorreo(texto)]);
  });
});
