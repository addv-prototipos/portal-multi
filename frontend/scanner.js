// Escaneo de código de barras por cámara (Segmento A del punto 159,
// ver PROJECT_STATE.md). Un solo componente compartido entre Ventas
// (buscar/agregar producto) e Inventarios (alta/edición de producto).
//
// Decodificación progresiva: intenta primero el API nativo del
// navegador (BarcodeDetector — gratis, instantáneo, Chrome/Edge en
// Android) y solo si no está disponible carga de forma perezosa la
// librería de respaldo autohospedada (html5-qrcode, vendorizada en
// assets/vendor/ — nunca por CDN, mismo criterio que el resto del
// sitio) para cubrir iOS Safari y navegadores sin BarcodeDetector.
//
// API pública: window.ScannerCodigoBarras.abrir({ onDetectado, onCancelar })
(function () {
  'use strict';

  var FORMATOS_1D_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'codabar', 'itf'];
  // Absoluta a propósito (segmento 4 multi-tenant: assets siempre en rutas
  // absolutas, nunca relativas a /<slug>/admin).
  var RUTA_FALLBACK = '/assets/vendor/html5-qrcode.min.js';
  var ID_CONTENEDOR_FALLBACK = 'scanner-fallback-contenedor';

  var estado = {
    activo: false,
    modo: null, // 'nativo' | 'fallback'
    stream: null,
    rafId: null,
    detector: null,
    html5Qr: null,
    onDetectado: null,
    onCancelar: null,
    yaResuelto: false,
  };

  var els = null;

  function obtenerElementos() {
    if (els) return els;
    els = {
      overlay: document.getElementById('scanner-modal-overlay'),
      video: document.getElementById('scanner-video'),
      fallbackContenedor: document.getElementById(ID_CONTENEDOR_FALLBACK),
      hint: document.getElementById('scanner-hint'),
      error: document.getElementById('scanner-error'),
      btnCerrar: document.getElementById('btn-scanner-cerrar'),
      btnReintentar: document.getElementById('btn-scanner-reintentar'),
    };
    return els;
  }

  function mostrarError(mensaje) {
    var e = obtenerElementos();
    e.error.textContent = mensaje;
    e.error.hidden = false;
    e.hint.hidden = true;
    e.btnReintentar.hidden = false;
  }

  function limpiarError() {
    var e = obtenerElementos();
    e.error.hidden = true;
    e.error.textContent = '';
    e.hint.hidden = false;
    e.btnReintentar.hidden = true;
  }

  function detenerNativo() {
    if (estado.rafId) {
      cancelAnimationFrame(estado.rafId);
      estado.rafId = null;
    }
    if (estado.stream) {
      estado.stream.getTracks().forEach(function (t) { t.stop(); });
      estado.stream = null;
    }
    estado.detector = null;
  }

  function detenerFallback() {
    if (!estado.html5Qr) return;
    var instancia = estado.html5Qr;
    estado.html5Qr = null;
    try {
      instancia.stop().then(function () {
        try { instancia.clear(); } catch (e) { /* contenedor ya vacío, no bloquea el cierre */ }
      }).catch(function () { /* ya estaba detenido, no bloquea el cierre */ });
    } catch (e) { /* API de la librería no respondió, el modal se cierra igual */ }
  }

  function cerrar(disparaCancelar) {
    if (!estado.activo) return;
    var e = obtenerElementos();
    detenerNativo();
    detenerFallback();
    e.overlay.hidden = true;
    e.video.hidden = true;
    e.fallbackContenedor.hidden = true;
    e.fallbackContenedor.innerHTML = '';
    limpiarError();
    document.removeEventListener('keydown', onKeydown);
    var cb = estado.onCancelar;
    var yaResuelto = estado.yaResuelto;
    estado.activo = false;
    estado.onDetectado = null;
    estado.onCancelar = null;
    if (disparaCancelar && !yaResuelto && typeof cb === 'function') cb();
  }

  function onKeydown(ev) {
    if (ev.key === 'Escape') cerrar(true);
  }

  function resolverDetectado(valor) {
    if (estado.yaResuelto) return;
    estado.yaResuelto = true;
    var cb = estado.onDetectado;
    cerrar(false);
    if (typeof cb === 'function') cb(valor);
  }

  async function soportaNativo() {
    if (!('BarcodeDetector' in window)) return false;
    try {
      var formatos = await window.BarcodeDetector.getSupportedFormats();
      return FORMATOS_1D_NATIVOS.some(function (f) { return formatos.indexOf(f) !== -1; });
    } catch (e) {
      return false;
    }
  }

  function loopDeteccionNativa() {
    if (!estado.activo || estado.modo !== 'nativo') return;
    var e = obtenerElementos();
    estado.detector.detect(e.video).then(function (codigos) {
      if (codigos && codigos.length > 0) {
        resolverDetectado(codigos[0].rawValue);
        return;
      }
      estado.rafId = requestAnimationFrame(loopDeteccionNativa);
    }).catch(function () {
      // Un frame fallido no es fatal (puede pasar mientras la cámara
      // todavía enfoca) — se reintenta con el siguiente frame.
      estado.rafId = requestAnimationFrame(loopDeteccionNativa);
    });
  }

  async function iniciarNativo() {
    var e = obtenerElementos();
    estado.modo = 'nativo';
    estado.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    e.video.srcObject = estado.stream;
    e.video.hidden = false;
    await e.video.play();
    estado.detector = new window.BarcodeDetector({ formats: FORMATOS_1D_NATIVOS });
    loopDeteccionNativa();
  }

  function cargarScriptFallback() {
    return new Promise(function (resolve, reject) {
      if (window.Html5Qrcode) return resolve();
      var script = document.createElement('script');
      script.src = RUTA_FALLBACK;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('No se pudo cargar el lector de respaldo.')); };
      document.head.appendChild(script);
    });
  }

  async function iniciarFallback() {
    var e = obtenerElementos();
    await cargarScriptFallback();
    if (!window.Html5Qrcode) throw new Error('El lector de respaldo no se pudo inicializar.');
    estado.modo = 'fallback';
    e.fallbackContenedor.hidden = false;
    var formatos = [
      window.Html5QrcodeSupportedFormats.EAN_13,
      window.Html5QrcodeSupportedFormats.EAN_8,
      window.Html5QrcodeSupportedFormats.UPC_A,
      window.Html5QrcodeSupportedFormats.UPC_E,
      window.Html5QrcodeSupportedFormats.CODE_128,
      window.Html5QrcodeSupportedFormats.CODE_39,
      window.Html5QrcodeSupportedFormats.CODABAR,
      window.Html5QrcodeSupportedFormats.ITF,
    ];
    estado.html5Qr = new window.Html5Qrcode(ID_CONTENEDOR_FALLBACK, { formatsToSupport: formatos, verbose: false });
    await estado.html5Qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 120 } },
      function (valorDecodificado) { resolverDetectado(valorDecodificado); },
      function () { /* frame sin coincidencia todavía — normal, sigue intentando */ }
    );
  }

  async function abrir(opciones) {
    if (estado.activo) return;
    var e = obtenerElementos();
    if (!e.overlay) {
      console.error('Falta el marcado del modal de escáner en admin.html.');
      return;
    }
    estado.activo = true;
    estado.yaResuelto = false;
    estado.onDetectado = opciones && opciones.onDetectado;
    estado.onCancelar = opciones && opciones.onCancelar;
    limpiarError();
    e.overlay.hidden = false;
    document.addEventListener('keydown', onKeydown);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      mostrarError('Este navegador no puede usar la cámara. Escribe el código a mano o usa un lector físico.');
      return;
    }

    try {
      var nativo = await soportaNativo();
      if (nativo) {
        await iniciarNativo();
      } else {
        await iniciarFallback();
      }
    } catch (err) {
      if (err && err.name === 'NotAllowedError') {
        mostrarError('Permiso de cámara denegado. Actívalo en los ajustes del navegador o escribe el código a mano.');
      } else if (err && err.name === 'NotFoundError') {
        mostrarError('No se encontró ninguna cámara en este dispositivo.');
      } else {
        mostrarError('No se pudo iniciar la cámara. Escribe el código a mano o usa un lector físico.');
      }
    }
  }

  function reintentar() {
    var onDetectado = estado.onDetectado;
    var onCancelar = estado.onCancelar;
    cerrar(false);
    abrir({ onDetectado: onDetectado, onCancelar: onCancelar });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var e = obtenerElementos();
    if (!e.overlay) return;
    e.btnCerrar.addEventListener('click', function () { cerrar(true); });
    e.overlay.addEventListener('click', function (ev) {
      if (ev.target === e.overlay) cerrar(true);
    });
    e.btnReintentar.addEventListener('click', reintentar);
  });

  window.ScannerCodigoBarras = { abrir: abrir, cerrar: function () { cerrar(true); } };
})();
