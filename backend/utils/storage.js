// Almacenamiento de archivos subidos (constancias, imágenes de ticket,
// facturas) — segmento 5 del plan multi-tenant (ver PROJECT_STATE.md).
// Reemplaza el disco local (bind mount `./uploads`, que se rompe en
// cuanto hay más de una réplica del backend — cada una vería un disco
// distinto salvo que se comparta) por un bucket único en MinIO
// (self-hosted, compatible con S3), con un PREFIJO por tenant dentro del
// mismo bucket — decisión ya tomada en el plan: un solo par de
// credenciales para todos los tenants (prioriza que dar de alta un
// cliente nunca requiera redeploy del backend), el aislamiento entre
// tenants es lógico (por prefijo), no de infraestructura.
//
// Estructura de keys dentro del bucket, calcada de las carpetas que ya
// existían en disco: "<prefijo>/<nombre>" (constancias, antes en la raíz
// de uploads/), "<prefijo>/tickets/<nombre>" e
// "<prefijo>/facturas/<nombre>".
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} = require('@aws-sdk/client-s3');

const BUCKET = process.env.MINIO_BUCKET || 'portal-facturacion';

// Prefijo usado para cualquier operación que corra SIN un tenant resuelto
// — hoy, eso es TODO el tráfico real (nginx no manda X-Tenant-Slug
// todavía, ver el segmento 3/4) y también la limpieza automática por
// retención (utils/ticketsCleanup.js, que corre fuera de cualquier
// request HTTP — iterar sobre tenants reales ahí queda para un segmento
// futuro, ya anotado como pendiente desde el segmento 2). "_default"
// nunca puede colisionar con un slug de tenant real porque el guion bajo
// no es un carácter válido de slug (ver utils/tenant.js:SLUG_REGEX).
const PREFIJO_DEFECTO = '_default';

const client = new S3Client({
  region: process.env.MINIO_REGION || 'us-east-1', // MinIO ignora la región real, pero el SDK exige un valor
  endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'changeme_minio_password',
  },
  // Requerido por MinIO (y por cualquier bucket cuyo nombre no sea válido
  // como subdominio DNS): sin esto, el SDK arma URLs con el bucket como
  // subdominio ("bucket.minio:9000"), que MinIO no entiende.
  forcePathStyle: true,
});

// Crea el bucket compartido si todavía no existe — mismo espíritu
// idempotente que `ensureSchema()` en db.js (seguro de llamar en cada
// arranque del backend). Se llama una vez al iniciar el proceso (ver
// `iniciar()` en server.js), nunca en el camino de una request real.
async function asegurarBucket() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch (err) {
    if (esErrorNoEncontrado(err)) {
      await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
      return;
    }
    throw err;
  }
}

function prefijoTenant(req) {
  return req && req.tenant && req.tenant.slug ? req.tenant.slug : PREFIJO_DEFECTO;
}

function construirKey(prefijo, carpeta, nombreArchivo) {
  return carpeta ? `${prefijo}/${carpeta}/${nombreArchivo}` : `${prefijo}/${nombreArchivo}`;
}

async function guardarArchivo(prefijo, carpeta, nombreArchivo, buffer, contentType) {
  const key = construirKey(prefijo, carpeta, nombreArchivo);
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType })
  );
  return key;
}

function esErrorNoEncontrado(err) {
  return (
    err &&
    (err.name === 'NotFound' ||
      err.name === 'NoSuchKey' ||
      (err.$metadata && err.$metadata.httpStatusCode === 404))
  );
}

async function existeArchivo(prefijo, carpeta, nombreArchivo) {
  const key = construirKey(prefijo, carpeta, nombreArchivo);
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err) {
    if (esErrorNoEncontrado(err)) return false;
    throw err;
  }
}

// DeleteObject de S3/MinIO es idempotente por diseño (borrar una key que
// ya no existe no falla) — a diferencia de `fs.unlinkSync`, que antes
// requería comprobar `existsSync` primero para no lanzar ENOENT. Por eso
// aquí no hace falta un `existeArchivo()` previo: llamar a esta función
// sobre un archivo que ya no está es, correctamente, un no-op.
async function eliminarArchivo(prefijo, carpeta, nombreArchivo) {
  const key = construirKey(prefijo, carpeta, nombreArchivo);
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Envía el archivo directo a la respuesta HTTP — reemplaza el patrón
// `fs.createReadStream(filePath).pipe(res)` de siempre. El SDK v3 de AWS
// devuelve `Body` como un stream de Node (en runtime Node.js, no en
// browser/edge), así que se puede hacer `.pipe()` igual que un stream de
// `fs`. El llamador es responsable de fijar `Content-Type`/
// `Content-Disposition` en `res` ANTES de llamar a esta función (mismo
// orden que el código anterior).
async function enviarArchivoARespuesta(prefijo, carpeta, nombreArchivo, res) {
  const key = construirKey(prefijo, carpeta, nombreArchivo);
  const resultado = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  resultado.Body.pipe(res);
}

// Lee un archivo completo y devuelve su stream junto con el Content-Type
// con el que se guardó — usado por el logo de marca del tenant (segmento
// "marca"): como la key no lleva extensión, el GET público necesita el
// MIME guardado para responder con el Content-Type correcto.
async function obtenerArchivo(prefijo, carpeta, nombreArchivo) {
  const key = construirKey(prefijo, carpeta, nombreArchivo);
  const resultado = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return { stream: resultado.Body, contentType: resultado.ContentType || 'application/octet-stream' };
}

// Copia TODOS los objetos bajo "<prefijoOrigen>/" a "<prefijoDestino>/"
// (mismo bucket) usando CopyObject del lado del servidor — no descarga ni
// vuelve a subir nada. Usada por el cutover del tenant piloto (segmento 6
// del plan) para mover los uploads de hoy, guardados bajo
// PREFIJO_DEFECTO ("_default"), al prefijo del tenant real. Pagina con
// ListObjectsV2 (1000 objetos por página) para no asumir que todo cabe en
// una sola respuesta. Devuelve cuántos objetos se copiaron, para que el
// llamador pueda comparar ese número contra lo esperado antes de
// considerar la migración exitosa.
async function copiarPrefijo(prefijoOrigen, prefijoDestino) {
  let continuationToken;
  let copiados = 0;
  do {
    const listado = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: `${prefijoOrigen}/`,
        ContinuationToken: continuationToken,
      })
    );
    for (const objeto of listado.Contents || []) {
      const keyDestino = prefijoDestino + objeto.Key.slice(prefijoOrigen.length);
      await client.send(
        new CopyObjectCommand({
          Bucket: BUCKET,
          CopySource: `/${BUCKET}/${encodeURIComponent(objeto.Key)}`,
          Key: keyDestino,
        })
      );
      copiados += 1;
    }
    continuationToken = listado.IsTruncated ? listado.NextContinuationToken : undefined;
  } while (continuationToken);
  return copiados;
}

// Cuenta cuántos objetos hay bajo un prefijo — usado para verificar, antes
// y después de `copiarPrefijo`, que no se perdió ningún archivo en la copia.
async function contarObjetosPrefijo(prefijo) {
  let continuationToken;
  let total = 0;
  do {
    const listado = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: `${prefijo}/`,
        ContinuationToken: continuationToken,
      })
    );
    total += (listado.Contents || []).length;
    continuationToken = listado.IsTruncated ? listado.NextContinuationToken : undefined;
  } while (continuationToken);
  return total;
}

// Punto 347 (gobierno de funcionalidades): suma los bytes REALES de todos
// los objetos bajo un prefijo — a diferencia de contarObjetosPrefijo
// (cuenta objetos, no tamaño), esto es lo que /control necesita para
// comparar contra disco_cuota_mb. Nunca se llama en el camino de una
// request normal (demasiado lento con muchos archivos) — solo desde el
// botón "Recalcular" de /control, vía POST /internal/disco-uso/:slug.
async function calcularBytesPrefijo(prefijo) {
  let continuationToken;
  let bytes = 0;
  do {
    const listado = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: `${prefijo}/`,
        ContinuationToken: continuationToken,
      })
    );
    for (const objeto of listado.Contents || []) {
      bytes += objeto.Size || 0;
    }
    continuationToken = listado.IsTruncated ? listado.NextContinuationToken : undefined;
  } while (continuationToken);
  return bytes;
}

// Copia un solo archivo de una key a otra dentro del bucket (CopyObject
// del lado del servidor) — usado por el renombrado de slug de un tenant
// (cambio de slug: mover el logo de `marca/<slug_viejo>/logo` a
// `marca/<slug_nuevo>/logo`). Lanza si la key origen no existe.
async function copiarArchivo(prefijo, carpeta, nombreArchivo, prefijoDestino, carpetaDestino, nombreDestino) {
  const keyOrigen = construirKey(prefijo, carpeta, nombreArchivo);
  const keyDestino = construirKey(prefijoDestino, carpetaDestino, nombreDestino);
  await client.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `/${BUCKET}/${encodeURIComponent(keyOrigen)}`,
      Key: keyDestino,
    })
  );
  return keyDestino;
}

// Borra TODOS los objetos bajo "<prefijo>/" (listado paginado + un
// DeleteObject por objeto) — usado por el renombrado de slug para limpiar
// el prefijo viejo después de copiarlo al nuevo. Un prefijo que no existe
// no es un error (no hay nada que borrar).
async function eliminarPrefijo(prefijo) {
  let continuationToken;
  let borrados = 0;
  do {
    const listado = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: `${prefijo}/`,
        ContinuationToken: continuationToken,
      })
    );
    for (const objeto of listado.Contents || []) {
      await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objeto.Key }));
      borrados += 1;
    }
    continuationToken = listado.IsTruncated ? listado.NextContinuationToken : undefined;
  } while (continuationToken);
  return borrados;
}

module.exports = {
  BUCKET,
  PREFIJO_DEFECTO,
  asegurarBucket,
  prefijoTenant,
  construirKey,
  guardarArchivo,
  existeArchivo,
  eliminarArchivo,
  enviarArchivoARespuesta,
  obtenerArchivo,
  copiarPrefijo,
  contarObjetosPrefijo,
  calcularBytesPrefijo,
  copiarArchivo,
  eliminarPrefijo,
};
