// Pruebas unitarias de backend/utils/tenantTema.js (segmento "Look &
// Feel", ver PROJECT_STATE.md punto 105): validación del tema del tenant
// (paleta, tipografías del catálogo, radios), cálculo de contraste
// WCAG 2.1 AA y degradación ante tema_json corrupto.

const {
  normalizarTema,
  temaAVariables,
  fuentesAUrlGoogle,
  parsearTemaDesdeFila,
  ratioContraste,
} = require('../../utils/tenantTema');

describe('utils/tenantTema.js', () => {
  describe('ratioContraste', () => {
    test('el contraste del par negro/blanco es el máximo (21:1)', () => {
      expect(ratioContraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    });

    test('un par de mismo color tiene contraste 1:1', () => {
      expect(ratioContraste('#0F6E5D', '#0F6E5D')).toBeCloseTo(1, 1);
    });

    test('el default de texto sobre fondo de ADDV cumple AA', () => {
      // ink #21261F sobre bg #F6F4EF — el diseño base cumple 4.5:1.
      expect(ratioContraste('#21261F', '#F6F4EF')).toBeGreaterThan(4.5);
    });
  });

  describe('normalizarTema', () => {
    test('acepta un tema completo válido y lo normaliza a minúsculas', () => {
      const tema = normalizarTema({
        colores: {
          bg: '#F6F4EF',
          surface: '#FFFFFF',
          border: '#E3DFD4',
          ink: '#21261F',
          inkSoft: '#5B6158',
          accent: '#0F6E5D',
          accentDark: '#0B5548',
          accentSoft: '#E4EFEC',
          warn: '#B4530C',
          warnSoft: '#FBEBDC',
          error: '#B3261E',
          errorSoft: '#FBEAE9',
        },
        tipografia: { display: 'lora', cuerpo: 'open-sans' },
        radio: 'lg',
        faviconUrl: '/api/favicon/mi-empresa',
      });

      expect(tema.colores.accent).toBe('#0f6e5d');
      expect(tema.tipografia).toEqual({ display: 'lora', cuerpo: 'open-sans' });
      expect(tema.radio).toBe('lg');
      expect(tema.faviconUrl).toBe('/api/favicon/mi-empresa');
    });

    test('un tema vacío devuelve objeto vacío (todo del diseño base)', () => {
      expect(normalizarTema({})).toEqual({});
    });

    test('rechaza un tema que no es objeto', () => {
      expect(() => normalizarTema(null)).toThrow(/objeto/);
      expect(() => normalizarTema('tema')).toThrow(/objeto/);
    });

    test('rechaza un color que no es hex de 6 dígitos', () => {
      expect(() => normalizarTema({ colores: { accent: 'verde' } })).toThrow(/hexadecimal/);
      expect(() => normalizarTema({ colores: { accent: '#0F6E' } })).toThrow(/hexadecimal/);
    });

    test('rechaza una tipografía fuera del catálogo', () => {
      expect(() => normalizarTema({ tipografia: { display: 'comic-sans' } })).toThrow(/catálogo/);
      // Una fuente de cuerpo no sirve como display.
      expect(() => normalizarTema({ tipografia: { display: 'inter' } })).toThrow(/catálogo/);
    });

    test('rechaza un radio fuera del catálogo', () => {
      expect(() => normalizarTema({ radio: 'xl' })).toThrow(/sm.*md.*lg/);
    });

    test('rechaza un faviconUrl que no es la ruta pública del tenant', () => {
      expect(() => normalizarTema({ faviconUrl: 'https://evil.com/favicon.ico' })).toThrow(/ruta pública/);
    });

    test('rechaza con error de contraste AA si el texto no se lee sobre el fondo', () => {
      expect(() =>
        normalizarTema({ colores: { bg: '#FFFFFF', ink: '#FFFFFF' } })
      ).toThrow(/contraste AA/);
    });

    test('ignora claves de color vacías (no personalizan ese token)', () => {
      const tema = normalizarTema({ colores: { accent: '', bg: null } });
      expect(tema.colores).toBeUndefined();
    });
  });

  describe('temaAVariables', () => {
    test('mapea colores, fuentes y radios a las CSS variables', () => {
      const variables = temaAVariables(
        normalizarTema({
          colores: { accent: '#0F6E5D', ink: '#21261F' },
          tipografia: { display: 'lora', cuerpo: 'open-sans' },
          radio: 'lg',
        })
      );

      expect(variables['--color-accent']).toBe('#0f6e5d');
      expect(variables['--color-ink']).toBe('#21261f');
      // Tipografía congelada a Inter (2026-08-24) — ambos mapean a Inter
      expect(variables['--font-display']).toContain('Inter');
      expect(variables['--font-body']).toContain('Inter');
      expect(variables['--radius-lg']).toBe('20px');
    });

    test('tema vacío no pinta ninguna variable', () => {
      expect(temaAVariables({})).toEqual({});
    });
  });

  describe('fuentesAUrlGoogle', () => {
    test('devuelve las URLs de Google Fonts solo de las fuentes del tema', () => {
      const urls = fuentesAUrlGoogle(
        normalizarTema({ tipografia: { display: 'lora', cuerpo: 'roboto' } })
      );
      expect(urls).toHaveLength(2);
      expect(urls[0]).toContain('Lora');
      expect(urls[1]).toContain('Roboto');
    });

    test('sin tipografía no devuelve URLs', () => {
      expect(fuentesAUrlGoogle({})).toEqual([]);
    });
  });

  describe('parsearTemaDesdeFila', () => {
    test('devuelve null si el tenant no tiene tema', () => {
      expect(parsearTemaDesdeFila({ slug: 'cliente1', tema_json: null })).toBeNull();
      expect(parsearTemaDesdeFila({ slug: 'cliente1' })).toBeNull();
    });

    test('parsea y re-valida un tema_json válido', () => {
      const tema = parsearTemaDesdeFila({
        slug: 'cliente1',
        tema_json: JSON.stringify({ colores: { accent: '#0F6E5D' }, radio: 'md' }),
      });
      expect(tema).not.toBeNull();
      expect(tema.colores.accent).toBe('#0f6e5d');
      expect(tema.radio).toBe('md');
    });

    test('degradación elegante ante JSON corrupto (no lanza, devuelve null)', () => {
      const logEspia = jest.spyOn(console, 'error').mockImplementation(() => {});
      const tema = parsearTemaDesdeFila({ slug: 'cliente1', tema_json: '{no es json' });
      expect(tema).toBeNull();
      logEspia.mockRestore();
    });
  });
});