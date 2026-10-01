// Pruebas de backend/utils/storage.js (segmento 5 del plan multi-tenant,
// ver PROJECT_STATE.md) — mockea @aws-sdk/client-s3 por completo (no hay
// MinIO real disponible en este entorno) para poder inspeccionar
// exactamente qué comando se envía y con qué parámetros, sin depender de
// un servidor S3-compatible corriendo.

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  class FakeCommand {
    constructor(input) {
      this.input = input;
    }
  }
  class PutObjectCommand extends FakeCommand {}
  class GetObjectCommand extends FakeCommand {}
  class DeleteObjectCommand extends FakeCommand {}
  class HeadObjectCommand extends FakeCommand {}
  class HeadBucketCommand extends FakeCommand {}
  class CreateBucketCommand extends FakeCommand {}
  class ListObjectsV2Command extends FakeCommand {}
  class CopyObjectCommand extends FakeCommand {}

  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    HeadBucketCommand,
    CreateBucketCommand,
    ListObjectsV2Command,
    CopyObjectCommand,
  };
});

const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} = require('@aws-sdk/client-s3');
const storage = require('../../utils/storage');

describe('utils/storage.js', () => {
  afterEach(() => {
    mockSend.mockReset();
  });

  describe('prefijoTenant', () => {
    test('devuelve el slug cuando req.tenant está resuelto', () => {
      expect(storage.prefijoTenant({ tenant: { slug: 'cliente1' } })).toBe('cliente1');
    });

    test('devuelve PREFIJO_DEFECTO sin req.tenant', () => {
      expect(storage.prefijoTenant({})).toBe(storage.PREFIJO_DEFECTO);
      expect(storage.prefijoTenant(undefined)).toBe(storage.PREFIJO_DEFECTO);
    });
  });

  describe('construirKey', () => {
    test('sin carpeta, la key es "<prefijo>/<archivo>" (constancias)', () => {
      expect(storage.construirKey('cliente1', null, 'abc.pdf')).toBe('cliente1/abc.pdf');
    });

    test('con carpeta, la key incluye la subcarpeta (tickets/facturas)', () => {
      expect(storage.construirKey('cliente1', 'tickets', 'abc.jpg')).toBe('cliente1/tickets/abc.jpg');
    });
  });

  describe('asegurarBucket', () => {
    test('no crea el bucket si HeadBucket ya resuelve sin error', async () => {
      mockSend.mockResolvedValueOnce({});
      await storage.asegurarBucket();

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
    });

    test('crea el bucket si HeadBucket responde 404', async () => {
      mockSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
      mockSend.mockResolvedValueOnce({});
      await storage.asegurarBucket();

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend.mock.calls[1][0]).toBeInstanceOf(CreateBucketCommand);
      expect(mockSend.mock.calls[1][0].input).toEqual({ Bucket: storage.BUCKET });
    });

    test('relanza cualquier otro error sin intentar crear el bucket', async () => {
      mockSend.mockRejectedValueOnce(new Error('credenciales inválidas'));
      await expect(storage.asegurarBucket()).rejects.toThrow('credenciales inválidas');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('guardarArchivo', () => {
    test('envía un PutObjectCommand con bucket/key/body/contentType correctos', async () => {
      const buffer = Buffer.from('contenido');
      const key = await storage.guardarArchivo('cliente1', 'tickets', 'abc.jpg', buffer, 'image/jpeg');

      expect(key).toBe('cliente1/tickets/abc.jpg');
      expect(mockSend).toHaveBeenCalledTimes(1);
      const comando = mockSend.mock.calls[0][0];
      expect(comando).toBeInstanceOf(PutObjectCommand);
      expect(comando.input).toEqual({
        Bucket: storage.BUCKET,
        Key: 'cliente1/tickets/abc.jpg',
        Body: buffer,
        ContentType: 'image/jpeg',
      });
    });
  });

  describe('existeArchivo', () => {
    test('devuelve true si HeadObject resuelve sin error', async () => {
      mockSend.mockResolvedValueOnce({});
      const existe = await storage.existeArchivo('cliente1', null, 'abc.pdf');

      expect(existe).toBe(true);
      expect(mockSend.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
      expect(mockSend.mock.calls[0][0].input).toEqual({ Bucket: storage.BUCKET, Key: 'cliente1/abc.pdf' });
    });

    test('devuelve false si el error trae httpStatusCode 404', async () => {
      mockSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
      expect(await storage.existeArchivo('cliente1', null, 'no-existe.pdf')).toBe(false);
    });

    test('devuelve false si el error tiene name "NotFound"', async () => {
      const err = new Error('not found');
      err.name = 'NotFound';
      mockSend.mockRejectedValueOnce(err);
      expect(await storage.existeArchivo('cliente1', null, 'no-existe.pdf')).toBe(false);
    });

    test('devuelve false si el error tiene name "NoSuchKey"', async () => {
      const err = new Error('no such key');
      err.name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(err);
      expect(await storage.existeArchivo('cliente1', null, 'no-existe.pdf')).toBe(false);
    });

    test('relanza cualquier otro error (ej. credenciales inválidas, red caída)', async () => {
      mockSend.mockRejectedValueOnce(new Error('conexión rechazada'));
      await expect(storage.existeArchivo('cliente1', null, 'x.pdf')).rejects.toThrow('conexión rechazada');
    });
  });

  describe('eliminarArchivo', () => {
    test('envía un DeleteObjectCommand con la key correcta', async () => {
      mockSend.mockResolvedValueOnce({});
      await storage.eliminarArchivo('cliente1', 'facturas', 'factura1.zip');

      const comando = mockSend.mock.calls[0][0];
      expect(comando).toBeInstanceOf(DeleteObjectCommand);
      expect(comando.input).toEqual({ Bucket: storage.BUCKET, Key: 'cliente1/facturas/factura1.zip' });
    });
  });

  describe('copiarPrefijo', () => {
    test('copia cada objeto listado bajo el prefijo origen al prefijo destino', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: '_default/a.pdf' }, { Key: '_default/tickets/b.jpg' }],
        IsTruncated: false,
      });
      mockSend.mockResolvedValueOnce({}); // CopyObject de a.pdf
      mockSend.mockResolvedValueOnce({}); // CopyObject de b.jpg

      const copiados = await storage.copiarPrefijo('_default', 'cliente1');

      expect(copiados).toBe(2);
      expect(mockSend.mock.calls[0][0]).toBeInstanceOf(ListObjectsV2Command);
      expect(mockSend.mock.calls[0][0].input).toMatchObject({ Bucket: storage.BUCKET, Prefix: '_default/' });

      const copia1 = mockSend.mock.calls[1][0];
      expect(copia1).toBeInstanceOf(CopyObjectCommand);
      expect(copia1.input).toEqual({
        Bucket: storage.BUCKET,
        CopySource: `/${storage.BUCKET}/_default%2Fa.pdf`,
        Key: 'cliente1/a.pdf',
      });

      const copia2 = mockSend.mock.calls[2][0];
      expect(copia2.input.Key).toBe('cliente1/tickets/b.jpg');
    });

    test('sigue paginando mientras IsTruncated sea true', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: '_default/a.pdf' }],
        IsTruncated: true,
        NextContinuationToken: 'token-pagina-2',
      });
      mockSend.mockResolvedValueOnce({}); // CopyObject de a.pdf
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: '_default/b.pdf' }],
        IsTruncated: false,
      });
      mockSend.mockResolvedValueOnce({}); // CopyObject de b.pdf

      const copiados = await storage.copiarPrefijo('_default', 'cliente1');

      expect(copiados).toBe(2);
      expect(mockSend.mock.calls[2][0].input.ContinuationToken).toBe('token-pagina-2');
    });

    test('sin objetos bajo el prefijo, no copia nada y devuelve 0', async () => {
      mockSend.mockResolvedValueOnce({ Contents: [], IsTruncated: false });
      const copiados = await storage.copiarPrefijo('_default', 'cliente1');
      expect(copiados).toBe(0);
      expect(mockSend).toHaveBeenCalledTimes(1); // solo el ListObjectsV2, ningún CopyObject
    });
  });

  describe('contarObjetosPrefijo', () => {
    test('suma los objetos de todas las páginas', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'a' }, { Key: 'b' }],
        IsTruncated: true,
        NextContinuationToken: 'token-2',
      });
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'c' }],
        IsTruncated: false,
      });

      expect(await storage.contarObjetosPrefijo('cliente1')).toBe(3);
    });
  });

  describe('calcularBytesPrefijo (punto 347)', () => {
    test('suma el tamaño (Size) de todos los objetos de todas las páginas', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'a', Size: 1000 }, { Key: 'b', Size: 2000 }],
        IsTruncated: true,
        NextContinuationToken: 'token-2',
      });
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'c', Size: 500 }],
        IsTruncated: false,
      });

      expect(await storage.calcularBytesPrefijo('cliente1')).toBe(3500);
    });

    test('objeto sin Size (caso raro) cuenta como 0, nunca NaN', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'a', Size: 1000 }, { Key: 'b' }],
        IsTruncated: false,
      });

      expect(await storage.calcularBytesPrefijo('cliente1')).toBe(1000);
    });

    test('prefijo sin objetos: 0 bytes', async () => {
      mockSend.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

      expect(await storage.calcularBytesPrefijo('cliente1')).toBe(0);
    });
  });

  describe('copiarArchivo', () => {
    test('envía un CopyObjectCommand entre las dos keys y devuelve la key destino', async () => {
      mockSend.mockResolvedValueOnce({});
      const key = await storage.copiarArchivo('marca', 'cliente1', 'logo', 'marca', 'cliente2', 'logo');

      expect(key).toBe('marca/cliente2/logo');
      expect(mockSend).toHaveBeenCalledTimes(1);
      const comando = mockSend.mock.calls[0][0];
      expect(comando).toBeInstanceOf(CopyObjectCommand);
      expect(comando.input).toEqual({
        Bucket: storage.BUCKET,
        CopySource: `/${storage.BUCKET}/marca%2Fcliente1%2Flogo`,
        Key: 'marca/cliente2/logo',
      });
    });
  });

  describe('eliminarPrefijo', () => {
    test('borra todos los objetos listados bajo "<prefijo>/" y devuelve el conteo', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'cliente1/a.pdf' }, { Key: 'cliente1/tickets/b.jpg' }],
        IsTruncated: false,
      });
      mockSend.mockResolvedValueOnce({});
      mockSend.mockResolvedValueOnce({});

      const borrados = await storage.eliminarPrefijo('cliente1');

      expect(borrados).toBe(2);
      expect(mockSend.mock.calls[0][0]).toBeInstanceOf(ListObjectsV2Command);
      expect(mockSend.mock.calls[0][0].input).toMatchObject({ Bucket: storage.BUCKET, Prefix: 'cliente1/' });

      const borrado1 = mockSend.mock.calls[1][0];
      expect(borrado1).toBeInstanceOf(DeleteObjectCommand);
      expect(borrado1.input).toEqual({ Bucket: storage.BUCKET, Key: 'cliente1/a.pdf' });
      expect(mockSend.mock.calls[2][0].input.Key).toBe('cliente1/tickets/b.jpg');
    });

    test('sigue paginando mientras IsTruncated sea true', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'cliente1/a.pdf' }],
        IsTruncated: true,
        NextContinuationToken: 'token-pagina-2',
      });
      mockSend.mockResolvedValueOnce({});
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'cliente1/b.pdf' }],
        IsTruncated: false,
      });
      mockSend.mockResolvedValueOnce({});

      const borrados = await storage.eliminarPrefijo('cliente1');

      expect(borrados).toBe(2);
      expect(mockSend.mock.calls[2][0].input.ContinuationToken).toBe('token-pagina-2');
    });

    test('sin objetos bajo el prefijo, devuelve 0 sin borrar nada', async () => {
      mockSend.mockResolvedValueOnce({ Contents: [], IsTruncated: false });
      expect(await storage.eliminarPrefijo('cliente1')).toBe(0);
      expect(mockSend).toHaveBeenCalledTimes(1); // solo el ListObjectsV2, ningún DeleteObject
    });
  });

  describe('enviarArchivoARespuesta', () => {
    test('envía un GetObjectCommand y hace pipe() del Body a la respuesta', async () => {
      const pipeMock = jest.fn();
      mockSend.mockResolvedValueOnce({ Body: { pipe: pipeMock } });
      const resFalso = {};

      await storage.enviarArchivoARespuesta('cliente1', 'tickets', 'ticket1.jpg', resFalso);

      const comando = mockSend.mock.calls[0][0];
      expect(comando).toBeInstanceOf(GetObjectCommand);
      expect(comando.input).toEqual({ Bucket: storage.BUCKET, Key: 'cliente1/tickets/ticket1.jpg' });
      expect(pipeMock).toHaveBeenCalledWith(resFalso);
    });
  });
});
