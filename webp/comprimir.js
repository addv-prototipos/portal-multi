/**
 * comprimir.js — Módulo de compresión de imágenes a WebP (100% en el navegador).
 *
 * Aislado en la carpeta webp/ del repo portalFac: sin dependencias, sin build,
 * sin red. El archivo NUNCA sale del equipo (cero fetch/XHR).
 *
 * Uso:
 *   const r = await comprimirImagen(file, {
 *     objetivoKB: 200,      // tamaño objetivo del resultado
 *     calidadMin: 0.45,     // piso de calidad (no bajar de aquí)
 *     calidadMax: 0.80,     // techo de la escalera de calidad
 *     dimMaxPx: 1600,       // lado máximo; si el original lo excede, se redimensiona
 *     dimMinPx: 800,        // suelo del redimensionado de emergencia
 *     onFase: (fase, pct) => {}  // progreso para la UI
 *   });
 *
 * r = {
 *   blob, nombre, bytesOriginales, bytesFinales, anchoOriginal, altoOriginal,
 *   ancho, alto, calidad, ahorroPct, cumplioObjetivo, fueRedimensionada, esWebp
 * }
 */
(function () {
  'use strict';

  var PASO_CALIDAD = 0.05;

  var FASE = {
    leer: 8,
    redimensionar: 25,
    convertir: 45,
    reducirLado: 88
  };

  function notificar(onFase, fase, pct) {
    if (typeof onFase === 'function') onFase(fase, Math.max(0, Math.min(100, Math.round(pct))));
  }

  function cederTurno() {
    // Deja pintar la UI entre pasos de la escalera de calidad.
    return new Promise(function (resolver) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () { resolver(); });
      } else {
        setTimeout(resolver, 0);
      }
    });
  }

  /** Decodifica el archivo respetando la orientación EXIF cuando es posible. */
  async function decodificar(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (e) {
        try {
          return await createImageBitmap(file);
        } catch (e2) { /* cae al fallback por <img> */ }
      }
    }
    // Fallback: objectURL + <img>. Rechaza si el navegador no sabe leerlo (p. ej. HEIC).
    var url = URL.createObjectURL(file);
    try {
      return await new Promise(function (resolver, rechazar) {
        var el = new Image();
        el.onload = function () { resolver(el); };
        el.onerror = function () { rechazar(new Error('formato_no_respaldado')); };
        el.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Dimensiones finales: respeta proporción, recorta solo el lado que excede. */
  function dimensiones(ancho, alto, dimMaxPx) {
    var ladoMax = Math.max(ancho, alto);
    if (ladoMax > dimMaxPx) {
      var factor = dimMaxPx / ladoMax;
      ancho = Math.round(ancho * factor);
      alto = Math.round(alto * factor);
    }
    return { ancho: Math.max(1, ancho), alto: Math.max(1, alto) };
  }

  function pintar(fuente, ancho, alto) {
    var canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(fuente, 0, 0, ancho, alto);
    return canvas;
  }

  function codificar(canvas, calidad) {
    return new Promise(function (resolver) {
      canvas.toBlob(function (blob) { resolver(blob); }, 'image/webp', calidad);
    });
  }

  /**
   * Escalera de calidad: baja de calidadMax a calidadMin en pasos de 0.05.
   * Devuelve el primer blob que cumple el objetivo, o el más pequeño visto.
   */
  async function escaleraCalidad(canvas, opciones, onFase, estado) {
    var mejor = null;
    for (var q = opciones.calidadMax; q >= opciones.calidadMin - 1e-6; q -= PASO_CALIDAD) {
      q = Math.round(q * 100) / 100;
      estado.paso += 1;
      notificar(
        onFase,
        estado.paso <= 1 ? 'Convirtiendo a WebP…' : 'Ajustando calidad…',
        FASE.convertir + estado.paso * 6
      );
      await cederTurno();
      var blob = await codificar(canvas, q);
      if (!blob) continue;
      if (!mejor || blob.size < mejor.blob.size) mejor = { blob: blob, calidad: q };
      if (blob.size <= opciones.objetivoBytes) return mejor;
    }
    return mejor;
  }

  async function comprimirImagen(file, opciones) {
    opciones = Object.assign({
      objetivoKB: 200,
      calidadMin: 0.45,
      calidadMax: 0.80,
      dimMaxPx: 1600,
      dimMinPx: 800,
      onFase: null
    }, opciones || {});

    var onFase = opciones.onFase;
    opciones.objetivoBytes = Math.max(1, Math.round(opciones.objetivoKB * 1024));

    if (!file || !file.size) throw new Error('archivo_vacio');

    notificar(onFase, 'Leyendo archivo…', FASE.leer);
    var fuente = await decodificar(file); // lanza formato_no_respaldado si no se puede leer
    var anchoOriginal = fuente.width;
    var altoOriginal = fuente.height;

    // Caso trivial: ya es WebP pequeño — re-codificar solo empeoraría el resultado.
    if (file.type === 'image/webp' && file.size <= opciones.objetivoBytes) {
      if (fuente.close) fuente.close();
      notificar(onFase, 'Listo', 100);
      return {
        blob: file,
        nombre: file.name.replace(/\.[^.]+$/, '') + '.webp',
        bytesOriginales: file.size,
        bytesFinales: file.size,
        anchoOriginal: anchoOriginal,
        altoOriginal: altoOriginal,
        ancho: anchoOriginal,
        alto: altoOriginal,
        calidad: 1,
        ahorroPct: 0,
        cumplioObjetivo: true,
        fueRedimensionada: false,
        esWebp: true,
        sinCambios: true
      };
    }

    var estado = { paso: 0 };
    var dim = dimensiones(anchoOriginal, altoOriginal, opciones.dimMaxPx);
    var fueRedimensionada = dim.ancho !== anchoOriginal || dim.alto !== altoOriginal;
    if (fueRedimensionada) {
      notificar(onFase, 'Redimensionando…', FASE.redimensionar);
      await cederTurno();
    }

    var canvas = pintar(fuente, dim.ancho, dim.alto);
    var mejor = await escaleraCalidad(canvas, opciones, onFase, estado);

    // Emergencia: si con calidad mínima no cabe, reduce el lado un 15% por vuelta
    // hasta dimMinPx (o hasta que ya no quepa seguir bajando).
    while (mejor && mejor.blob.size > opciones.objetivoBytes &&
           Math.max(dim.ancho, dim.alto) > opciones.dimMinPx) {
      notificar(onFase, 'Reduciendo dimensiones…', FASE.reducirLado);
      await cederTurno();
      dim.ancho = Math.max(1, Math.round(dim.ancho * 0.85));
      dim.alto = Math.max(1, Math.round(dim.alto * 0.85));
      fueRedimensionada = true;
      canvas = pintar(fuente, dim.ancho, dim.alto);
      var intento = await escaleraCalidad(canvas, opciones, onFase, estado);
      if (intento && intento.blob && (!mejor || intento.blob.size < mejor.blob.size)) {
        mejor = intento;
      }
    }

    if (fuente.close) fuente.close();
    if (!mejor || !mejor.blob) throw new Error('codificacion_fallida');

    notificar(onFase, 'Listo', 100);
    return {
      blob: mejor.blob,
      nombre: file.name.replace(/\.[^.]+$/, '') + '.webp',
      bytesOriginales: file.size,
      bytesFinales: mejor.blob.size,
      anchoOriginal: anchoOriginal,
      altoOriginal: altoOriginal,
      ancho: canvas.width,
      alto: canvas.height,
      calidad: mejor.calidad,
      ahorroPct: Math.round((1 - mejor.blob.size / file.size) * 100),
      cumplioObjetivo: mejor.blob.size <= opciones.objetivoBytes,
      fueRedimensionada: fueRedimensionada,
      esWebp: mejor.blob.type === 'image/webp'
    };
  }

  window.comprimirImagen = comprimirImagen;
})();
