const sharp = require('sharp');
const storage = require('../../utils/storage');
const {
  ErrorImagenProducto,
  procesarImagenProducto,
  guardarImagenProducto,
  eliminarImagenProducto,
  DIMENSION_MAXIMA_PX,
} = require('../../utils/inventarioImagen');

jest.mock('../../utils/storage', () => ({
  guardarArchivo: jest.fn().mockResolvedValue(undefined),
  eliminarArchivo: jest.fn().mockResolvedValue(undefined),
}));

// Sharp real (no mockeado): es determinístico y rápido, y `create()` con
// pixeles sintéticos permite fabricar imágenes de dimensión exacta sin
// decodificar nada pesado — la misma cobertura que un mock, pero
// ejercitando el pipeline de verdad (magic bytes reales, WebP real).
async function imagenValidaJPEG(ancho = 40, alto = 30) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 10, g: 120, b: 200 } } })
    .jpeg()
    .toBuffer();
}

describe('inventarioImagen — procesarImagenProducto (punto 159, Segmento B)', () => {
  test('rechaza un buffer que no es una imagen real (firma binaria)', async () => {
    await expect(procesarImagenProducto(Buffer.from('esto no es una imagen'))).rejects.toMatchObject({
      codigo: 'INV_IMAGEN_TIPO_INVALIDO',
    });
  });

  test('rechaza una imagen que excede la dimensión máxima', async () => {
    // Ancho > límite, alto mínimo — pixeles totales chicos, sigue siendo rápido.
    const buffer = await imagenValidaJPEG(DIMENSION_MAXIMA_PX + 1, 5);
    await expect(procesarImagenProducto(buffer)).rejects.toMatchObject({
      codigo: 'INV_IMAGEN_DIMENSION_INVALIDA',
    });
  });

  test('acepta una imagen válida y devuelve WebP real: principal 1200px y thumb 300×300', async () => {
    const buffer = await imagenValidaJPEG(2000, 1000);
    const resultado = await procesarImagenProducto(buffer);

    expect(resultado.ancho).toBe(2000);
    expect(resultado.alto).toBe(1000);

    const metaPrincipal = await sharp(resultado.principalBuffer).metadata();
    expect(metaPrincipal.format).toBe('webp');
    expect(metaPrincipal.width).toBe(1200); // lado mayor a 1200, "inside" sin recortar
    expect(metaPrincipal.height).toBe(600);

    const metaThumb = await sharp(resultado.thumbBuffer).metadata();
    expect(metaThumb.format).toBe('webp');
    expect(metaThumb.width).toBe(300);
    expect(metaThumb.height).toBe(300); // "cover" siempre da el cuadrado exacto
  });

  test('nunca agranda una imagen más chica que 1200px (withoutEnlargement)', async () => {
    const buffer = await imagenValidaJPEG(400, 300);
    const resultado = await procesarImagenProducto(buffer);
    const metaPrincipal = await sharp(resultado.principalBuffer).metadata();
    expect(metaPrincipal.width).toBe(400);
    expect(metaPrincipal.height).toBe(300);
  });
});

describe('inventarioImagen — guardarImagenProducto / eliminarImagenProducto', () => {
  beforeEach(() => {
    storage.guardarArchivo.mockClear();
    storage.eliminarArchivo.mockClear();
  });

  test('guarda las 2 variantes bajo productos/<id>/ con nombre fijo (reemplazar = sobreescribir, sin huérfanos)', async () => {
    const buffer = await imagenValidaJPEG(1500, 900);
    storage.guardarArchivo
      .mockResolvedValueOnce('tenant/productos/7/principal.webp')
      .mockResolvedValueOnce('tenant/productos/7/thumb_principal.webp');

    const resultado = await guardarImagenProducto('tenant', 7, buffer);

    expect(storage.guardarArchivo).toHaveBeenNthCalledWith(1, 'tenant', 'productos/7', 'principal.webp', expect.any(Buffer), 'image/webp');
    expect(storage.guardarArchivo).toHaveBeenNthCalledWith(2, 'tenant', 'productos/7', 'thumb_principal.webp', expect.any(Buffer), 'image/webp');
    expect(resultado.imagenKey).toBe('tenant/productos/7/principal.webp');
    expect(resultado.thumbKey).toBe('tenant/productos/7/thumb_principal.webp');
  });

  test('propaga el ErrorImagenProducto sin guardar nada si la imagen es inválida', async () => {
    await expect(guardarImagenProducto('tenant', 7, Buffer.from('no es imagen'))).rejects.toBeInstanceOf(ErrorImagenProducto);
    expect(storage.guardarArchivo).not.toHaveBeenCalled();
  });

  test('elimina ambas variantes (idempotente por diseño de storage.eliminarArchivo)', async () => {
    await eliminarImagenProducto('tenant', 7);
    expect(storage.eliminarArchivo).toHaveBeenCalledWith('tenant', 'productos/7', 'principal.webp');
    expect(storage.eliminarArchivo).toHaveBeenCalledWith('tenant', 'productos/7', 'thumb_principal.webp');
  });
});
