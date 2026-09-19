const {
  esCatalogoValido,
  dividirLineaCsv,
  dividirTuplaSql,
  normalizarCatalogoDesdeTexto,
} = require('../../utils/catalogoTexto');

describe('catalogoTexto.js', () => {
  describe('esCatalogoValido', () => {
    const catalogoOk = [
      { clave: '01', descripcion: 'Uno' },
      { clave: '02', descripcion: 'Dos' },
      { clave: '03', descripcion: 'Tres' },
      { clave: '04', descripcion: 'Cuatro' },
      { clave: '05', descripcion: 'Cinco' },
    ];

    test('acepta un catálogo con al menos 5 filas bien formadas', () => {
      expect(esCatalogoValido(catalogoOk)).toBe(true);
    });

    test('rechaza si no es un array', () => {
      expect(esCatalogoValido(null)).toBe(false);
      expect(esCatalogoValido({})).toBe(false);
      expect(esCatalogoValido('texto')).toBe(false);
    });

    test('rechaza si tiene menos de 5 filas', () => {
      expect(esCatalogoValido(catalogoOk.slice(0, 4))).toBe(false);
    });

    test('rechaza si alguna clave excede claveMaxLen', () => {
      const conClaveLarga = [...catalogoOk.slice(0, 4), { clave: '123456789012', descripcion: 'Larga' }];
      expect(esCatalogoValido(conClaveLarga, 10)).toBe(false);
    });

    test('rechaza si alguna clave o descripción está vacía/en blanco', () => {
      const conVacio = [...catalogoOk.slice(0, 4), { clave: '   ', descripcion: 'Algo' }];
      expect(esCatalogoValido(conVacio)).toBe(false);
      const sinDescripcion = [...catalogoOk.slice(0, 4), { clave: '06', descripcion: '' }];
      expect(esCatalogoValido(sinDescripcion)).toBe(false);
    });

    test('rechaza si algún item no es objeto o le falta el campo', () => {
      const conNulo = [...catalogoOk.slice(0, 4), null];
      expect(esCatalogoValido(conNulo)).toBe(false);
      const sinClave = [...catalogoOk.slice(0, 4), { descripcion: 'Sin clave' }];
      expect(esCatalogoValido(sinClave)).toBe(false);
    });
  });

  describe('dividirLineaCsv', () => {
    test('divide una línea simple por el separador', () => {
      expect(dividirLineaCsv('a,b,c', ',')).toEqual(['a', 'b', 'c']);
    });

    test('respeta comas dentro de comillas dobles', () => {
      expect(dividirLineaCsv('01,"Computadoras, personales"', ',')).toEqual(['01', 'Computadoras, personales']);
    });

    test('soporta comillas dobles escapadas ("") dentro del campo', () => {
      expect(dividirLineaCsv('01,"Dice ""hola"" aquí"', ',')).toEqual(['01', 'Dice "hola" aquí']);
    });

    test('recorta espacios alrededor de cada columna', () => {
      expect(dividirLineaCsv('  01  ,  Descripción  ', ',')).toEqual(['01', 'Descripción']);
    });

    test('soporta separador tab', () => {
      expect(dividirLineaCsv('01\tDescripción', '\t')).toEqual(['01', 'Descripción']);
    });
  });

  describe('dividirTuplaSql', () => {
    test('separa valores entre comillas simples respetando comas internas', () => {
      expect(dividirTuplaSql("'01','Computadoras, personales'")).toEqual(['01', 'Computadoras, personales']);
    });

    test("soporta comilla simple escapada ('') dentro del valor", () => {
      expect(dividirTuplaSql("'01','Equipo de cómputo ''especial'''")).toEqual(['01', "Equipo de cómputo 'especial'"]);
    });

    test('soporta valores numéricos sin comillas', () => {
      expect(dividirTuplaSql('1,2,3')).toEqual(['1', '2', '3']);
    });

    test('mezcla comillas y numéricos', () => {
      expect(dividirTuplaSql("1,'texto',3")).toEqual(['1', 'texto', '3']);
    });
  });

  describe('normalizarCatalogoDesdeTexto', () => {
    const filasJson = [
      { clave: '01', descripcion: 'Uno' },
      { clave: '02', descripcion: 'Dos' },
      { clave: '03', descripcion: 'Tres' },
      { clave: '04', descripcion: 'Cuatro' },
      { clave: '05', descripcion: 'Cinco' },
    ];

    test('retorna null con texto vacío/blanco', () => {
      expect(normalizarCatalogoDesdeTexto('')).toBeNull();
      expect(normalizarCatalogoDesdeTexto('   ')).toBeNull();
      expect(normalizarCatalogoDesdeTexto(null)).toBeNull();
    });

    test('interpreta un array JSON directo', () => {
      const resultado = normalizarCatalogoDesdeTexto(JSON.stringify(filasJson));
      expect(resultado).toEqual(filasJson);
    });

    test('interpreta JSON envuelto en { data: [...] }', () => {
      const resultado = normalizarCatalogoDesdeTexto(JSON.stringify({ data: filasJson }));
      expect(resultado).toEqual(filasJson);
    });

    test('respeta alias de campo en JSON (ej. c_ClaveProdServ)', () => {
      const conAlias = filasJson.map((f) => ({ c_ClaveProdServ: f.clave, c_Descripcion: f.descripcion }));
      const resultado = normalizarCatalogoDesdeTexto(JSON.stringify(conAlias), {
        aliasClave: ['c_ClaveProdServ'],
        aliasDescripcion: ['c_Descripcion'],
      });
      expect(resultado).toEqual(filasJson);
    });

    test('rechaza JSON que no arma un catálogo válido (menos de 5 filas útiles)', () => {
      const resultado = normalizarCatalogoDesdeTexto(JSON.stringify([{ clave: '01', descripcion: 'Uno' }]));
      expect(resultado).toBeNull();
    });

    test('interpreta un dump SQL de INSERTs por posición', () => {
      const dump = `INSERT INTO catalogo VALUES ('01','Uno');
INSERT INTO catalogo VALUES ('02','Dos');
INSERT INTO catalogo VALUES ('03','Tres');
INSERT INTO catalogo VALUES ('04','Cuatro');
INSERT INTO catalogo VALUES ('05','Cinco');`;
      const resultado = normalizarCatalogoDesdeTexto(dump);
      expect(resultado).toEqual(filasJson);
    });

    test('dump SQL respeta sqlIndiceClave/sqlIndiceDescripcion distintos de 0/1', () => {
      const dump = `INSERT INTO catalogo VALUES (1,'01','Uno');
INSERT INTO catalogo VALUES (1,'02','Dos');
INSERT INTO catalogo VALUES (1,'03','Tres');
INSERT INTO catalogo VALUES (1,'04','Cuatro');
INSERT INTO catalogo VALUES (1,'05','Cinco');`;
      const resultado = normalizarCatalogoDesdeTexto(dump, { sqlIndiceClave: 1, sqlIndiceDescripcion: 2 });
      expect(resultado).toEqual(filasJson);
    });

    test('interpreta CSV con encabezado cuando JSON/SQL no aplican', () => {
      const csv = `clave,descripcion
01,Uno
02,Dos
03,Tres
04,Cuatro
05,Cinco`;
      const resultado = normalizarCatalogoDesdeTexto(csv);
      expect(resultado).toEqual(filasJson);
    });

    test('interpreta TSV (separador tab) cuando la primera línea trae tabs', () => {
      const tsv = 'clave\tdescripcion\n01\tUno\n02\tDos\n03\tTres\n04\tCuatro\n05\tCinco';
      const resultado = normalizarCatalogoDesdeTexto(tsv);
      expect(resultado).toEqual(filasJson);
    });

    test('retorna null si nada de lo anterior produce un catálogo válido', () => {
      expect(normalizarCatalogoDesdeTexto('esto no es ni json ni sql ni csv útil')).toBeNull();
    });

    test('respeta claveMaxLen al filtrar filas del CSV con clave demasiado larga', () => {
      const csv = `clave,descripcion
0123456789012,Muy larga
02,Dos
03,Tres
04,Cuatro
05,Cinco`;
      const resultado = normalizarCatalogoDesdeTexto(csv, { claveMaxLen: 10 });
      expect(resultado).toBeNull();
    });
  });
});
