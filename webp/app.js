/**
 * app.js — Probador local del módulo compresor WebP (carpeta webp/).
 *
 * Tres estilos de aviso conmutables (línea / ficha / imagen) para comparar
 * las propuestas en vivo sobre el mismo elemento de subida de Clarvo.
 * Parámetro opcional de demostración: index.html?estado=comprimiendo|listo
 * (para revisar los estados sin elegir un archivo).
 */
(function () {
  'use strict';

  var ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp'];
  var CLAVE_ESTILO = 'webp_aviso_estilo';
  var CIRCUNFERENCIA_ANILLO = 176; // 2π·28 del anillo de avance

  var estado = {
    tipo: 'vacío',     // vacío | trabajando | listo | error
    estilo: 'linea',
    archivo: null,
    fase: '',
    pct: 0,
    resultado: null,
    demo: false
  };

  var urlOriginal = null;
  var urlResultado = null;

  var dom = {};
  var IDLE_HTML = '';

  /* ---------------- Iconos (SVG feather-like, cero emojis) ---------------- */

  var SVG = {
    upload: '<svg class="dz-icono" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    check: '<svg class="icono-ok" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    checkPequeño: '<svg class="icono-ok" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    download: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    download16: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    archivo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
    check18: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    spinner: '<svg class="spinner" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="#C7D3F0" stroke-width="3"/><path d="M21 12a9 9 0 0 0-9-9" stroke="#1E3F8F" stroke-width="3" stroke-linecap="round"/></svg>',
    alerta: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };

  /* ---------------- Utilidades ---------------- */

  function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatoTam(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  function liberarUrl(variable) {
    if (variable) URL.revokeObjectURL(variable);
    return null;
  }

  function opcionesPrueba() {
    var objetivo = parseInt(dom.ajusteObjetivo.value, 10);
    if (isNaN(objetivo)) objetivo = 200;
    objetivo = Math.min(2000, Math.max(50, objetivo));
    var calidad = parseInt(dom.ajusteCalidad.value, 10);
    if (isNaN(calidad)) calidad = 45;
    var dim = parseInt(dom.ajusteDim.value, 10);
    if (isNaN(dim)) dim = 1600;
    return { objetivoKB: objetivo, calidadMin: calidad / 100, dimMaxPx: dim };
  }

  /* ---------------- Render de estados ---------------- */

  function htmlIdle() {
    return SVG.upload +
      '<p class="dz-titulo">Arrastra una imagen o haz clic para seleccionar</p>' +
      '<p class="dz-hint">JPG, PNG o WEBP &middot; m&aacute;x. 2 MB</p>';
  }

  function htmlFichaTrabajando() {
    var r = estado;
    return '<div class="ficha">' +
      '<span class="ficha-icono">' + SVG.archivo + '</span>' +
      '<span class="ficha-texto">' +
        '<p class="ficha-nombre">' + escapar(r.archivo.name) + '</p>' +
        '<p class="ficha-fase">' + escapar(r.fase) + ' &middot; ' + formatoTam(r.archivo.size) + '</p>' +
      '</span>' +
      '<span class="ficha-pct">' + r.pct + '%</span>' +
    '</div>' +
    '<div class="barra barra--ficha" role="progressbar" aria-label="Avance de compresi&oacute;n" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + r.pct + '"><span style="transform:scaleX(' + (r.pct / 100) + ')"></span></div>';
  }

  function htmlFichaListo() {
    var r = estado.resultado;
    return '<div class="ficha">' +
      '<span class="ficha-icono ficha-icono--ok">' + SVG.check18 + '</span>' +
      '<span class="ficha-texto">' +
        '<p class="ficha-nombre">' + escapar(r.nombre) + '</p>' +
        '<p class="ficha-fase">' + formatoTam(r.bytesFinales) + ' &middot; de ' + formatoTam(r.bytesOriginales) + ' &middot; &minus;' + r.ahorroPct + '%</p>' +
      '</span>' +
      '<button class="btn btn-icono" type="button" data-descargar aria-label="Descargar ' + escapar(r.nombre) + '" title="Descargar">' + SVG.download16 + '</button>' +
    '</div>';
  }

  function htmlPreview(trabajando) {
    var pct = estado.pct;
    var url = trabajando ? urlOriginal : urlResultado;
    var html = '<div class="preview">' + (url ? '<img src="' + url + '" alt="">' : '') + '</div>';
    if (trabajando) {
      var desplazamiento = Math.round(CIRCUNFERENCIA_ANILLO * (1 - pct / 100));
      html += '<div class="velo">' +
        '<div class="anillo">' +
          '<svg width="62" height="62" viewBox="0 0 62 62" fill="none" aria-hidden="true">' +
            '<circle cx="31" cy="31" r="28" stroke="#C7D3F0" stroke-width="4"/>' +
            '<circle class="anillo-progreso" cx="31" cy="31" r="28" stroke="#1E3F8F" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + CIRCUNFERENCIA_ANILLO + '" stroke-dashoffset="' + desplazamiento + '"/>' +
          '</svg>' +
          '<span class="anillo-pct">' + pct + '%</span>' +
        '</div>' +
        '<p class="velo-titulo">Comprimiendo ' + escapar(estado.archivo.name) + '</p>' +
        '<p class="velo-sub">' + escapar(estado.fase) + ' &middot; ' + formatoTam(estado.archivo.size) + '</p>' +
      '</div>';
    } else {
      var r = estado.resultado;
      html += '<div class="pildora">' +
        SVG.checkPequeño +
        formatoTam(r.bytesFinales) + ' &middot; &minus;' + r.ahorroPct + '%' +
        '<button class="btn btn-icono" type="button" data-descargar aria-label="Descargar ' + escapar(r.nombre) + '" title="Descargar">' + SVG.download + '</button>' +
      '</div>';
    }
    return html;
  }

  function htmlLineaTrabajando() {
    return '<span class="aviso-izq">' + SVG.spinner +
      '<strong>Comprimiendo ' + escapar(estado.archivo.name) + '&hellip;</strong></span>' +
      '<span class="aviso-derecha">' + estado.pct + '%</span>';
  }

  function htmlLineaListo() {
    var r = estado.resultado;
    return '<span class="aviso-izq">' + SVG.check +
      '<strong>' + escapar(r.nombre) + ' &middot; ' + formatoTam(r.bytesFinales) + '</strong></span>' +
      '<span class="aviso-derecha">' +
        '<span class="chip-ahorro">&minus;' + r.ahorroPct + '%</span>' +
        '<button class="btn" type="button" data-descargar>' + SVG.download + 'Descargar</button>' +
      '</span>';
  }

  function textoMeta() {
    var r = estado.resultado;
    if (!r) return '';
    if (r.sinCambios) {
      return 'Ya era WebP dentro del objetivo &middot; sin recodificar';
    }
    var cumplio = r.cumplioObjetivo
      ? 'objetivo cumplido'
      : 'no se alcanz&oacute; el objetivo';
    return r.anchoOriginal + '&times;' + r.altoOriginal + ' &rarr; ' +
      r.ancho + '&times;' + r.alto +
      ' &middot; calidad ' + r.calidad.toFixed(2) +
      (r.fueRedimensionada ? ' &middot; redimensionada' : '') +
      ' &middot; ' + cumplio;
  }

  function render() {
    var trabajando = estado.tipo === 'trabajando';
    var listo = estado.tipo === 'listo';
    var conRecuadro = trabajando || listo; // estilos ficha/imagen transforman el recuadro

    // Recuadro
    dom.dropzone.classList.remove('dropzone--ficha', 'dropzone--preview', 'dropzone--ocupado', 'dropzone--listo');
    if (estado.estilo === 'ficha' && conRecuadro) {
      dom.dropzone.classList.add('dropzone--ficha');
      if (trabajando) dom.dropzone.classList.add('dropzone--ocupado');
      if (listo) dom.dropzone.classList.add('dropzone--listo');
      dom.dropzone.innerHTML = trabajando ? htmlFichaTrabajando() : htmlFichaListo();
      if (trabajando && estado.demo) {
        dom.dropzone.setAttribute('role', 'button');
        dom.dropzone.setAttribute('tabindex', '0');
      } else {
        dom.dropzone.removeAttribute('role');
        dom.dropzone.removeAttribute('tabindex');
      }
    } else if (estado.estilo === 'imagen' && conRecuadro) {
      dom.dropzone.classList.add('dropzone--preview');
      if (trabajando) dom.dropzone.classList.add('dropzone--ocupado');
      if (listo) dom.dropzone.classList.add('dropzone--listo');
      dom.dropzone.innerHTML = htmlPreview(trabajando);
      if (trabajando && estado.demo) {
        dom.dropzone.setAttribute('role', 'button');
        dom.dropzone.setAttribute('tabindex', '0');
      } else {
        dom.dropzone.removeAttribute('role');
        dom.dropzone.removeAttribute('tabindex');
      }
    } else {
      dom.dropzone.innerHTML = IDLE_HTML;
      dom.dropzone.setAttribute('role', 'button');
      dom.dropzone.setAttribute('tabindex', '0');
      dom.dropzone.title = listo ? 'Elegir otra imagen' : '';
    }

    // Aviso y barra (solo estilo "línea"): visible trabajando Y al terminar
    var esLinea = estado.estilo === 'linea';
    var avisoVisible = esLinea && (trabajando || listo);
    dom.aviso.hidden = !avisoVisible;
    dom.barra.hidden = !(esLinea && trabajando);
    if (avisoVisible) {
      dom.aviso.innerHTML = trabajando ? htmlLineaTrabajando() : htmlLineaListo();
    }
    if (esLinea && trabajando) {
      dom.barra.setAttribute('aria-valuenow', String(estado.pct));
      dom.barraRelleno.style.transform = 'scaleX(' + (estado.pct / 100) + ')';
    }

    // Meta de resultado (todos los estilos: sirve para probar)
    dom.meta.hidden = !listo;
    dom.meta.classList.remove('meta--aviso');
    if (listo) {
      dom.meta.innerHTML = textoMeta() +
        (estado.estilo !== 'linea'
          ? ' <button class="btn btn--chico" type="button" data-cambiar>Elegir otra imagen</button>'
          : '');
      if (estado.resultado && !estado.resultado.cumplioObjetivo && !estado.resultado.sinCambios) {
        dom.meta.classList.add('meta--aviso');
      }
    }

    // Región viva para lectores de pantalla
    if (trabajando) {
      dom.vivo.textContent = 'Comprimiendo ' + estado.archivo.name + ': ' + estado.fase + ', ' + estado.pct + ' por ciento';
    } else if (listo) {
      dom.vivo.textContent = 'Listo: ' + estado.resultado.nombre + ', ' +
        formatoTam(estado.resultado.bytesFinales) + ', ahorro de ' + estado.resultado.ahorroPct + ' por ciento';
    } else {
      dom.vivo.textContent = '';
    }
  }

  function mostrarError(mensaje) {
    estado.tipo = 'error';
    dom.error.innerHTML = SVG.alerta + '<span><strong>No se pudo comprimir.</strong> ' + mensaje + '</span>';
    dom.error.hidden = false;
    render();
  }

  function limpiarErrores() {
    dom.error.hidden = true;
    dom.error.innerHTML = '';
  }

  /* ---------------- Flujo de compresión ---------------- */

  async function manejarArchivo(file) {
    if (!file || (estado.tipo === 'trabajando' && !estado.demo)) return;
    limpiarErrores();

    var tipoOk = ACEPTADOS.indexOf(file.type) !== -1;
    var extOk = /\.(jpe?g|png|webp)$/i.test(file.name);
    if ((!tipoOk && file.type) || (!file.type && !extOk)) {
      estado.tipo = 'error';
      mostrarError('Formato no soportado. Usa un archivo JPG, PNG o WEBP.');
      return;
    }

    urlOriginal = liberarUrl(urlOriginal);
    urlResultado = liberarUrl(urlResultado);
    urlOriginal = URL.createObjectURL(file);

    estado.tipo = 'trabajando';
    estado.archivo = file;
    estado.fase = 'Leyendo archivo…';
    estado.pct = 0;
    estado.resultado = null;
    estado.demo = false;
    render();

    var opciones = opcionesPrueba();
    try {
      var r = await window.comprimirImagen(file, {
        objetivoKB: opciones.objetivoKB,
        calidadMin: opciones.calidadMin,
        dimMaxPx: opciones.dimMaxPx,
        onFase: function (fase, pct) {
          estado.fase = fase;
          estado.pct = pct;
          render();
        }
      });
      estado.resultado = r;
      estado.tipo = 'listo';
      urlResultado = URL.createObjectURL(r.blob);
      render();
    } catch (e) {
      var mensaje = (e && e.message === 'formato_no_respaldado')
        ? 'El navegador no sabe leer esa imagen. Usa JPG, PNG o WEBP.'
        : 'Ocurrió un error durante la compresión. Intenta con otro archivo.';
      mostrarError(mensaje);
    }
  }

  function descargar() {
    var r = estado.resultado;
    if (!r || !r.blob || estado.demo) return;
    var url = URL.createObjectURL(r.blob);
    var enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = r.nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function abrirSelector() {
    if (estado.tipo === 'trabajando' && !estado.demo) return;
    dom.entrada.click();
  }

  /* ---------------- Demostración de estados (?estado=) ---------------- */

  function cargarDemo(cual) {
    var muestras = {
      comprimiendo: {
        tipo: 'trabajando',
        archivo: { name: 'producto-azul.jpg', size: Math.round(1.9 * 1024 * 1024) },
        fase: 'Convirtiendo a WebP…',
        pct: 64
      },
      listo: {
        tipo: 'listo',
        archivo: { name: 'producto-azul.jpg', size: Math.round(1.9 * 1024 * 1024) },
        resultado: {
          blob: null,
          nombre: 'producto-azul.webp',
          bytesOriginales: Math.round(1.9 * 1024 * 1024),
          bytesFinales: 168 * 1024,
          anchoOriginal: 2400,
          altoOriginal: 1600,
          ancho: 1600,
          alto: 1067,
          calidad: 0.55,
          ahorroPct: 91,
          cumplioObjetivo: true,
          fueRedimensionada: true,
          esWebp: true
        },
        pct: 100
      }
    };
    var preset = muestras[cual];
    if (!preset) return false;
    Object.assign(estado, preset, { demo: true });
    if (cual === 'listo') {
      // Miniatura sintética para el estado "listo" de demostración.
      urlResultado = null;
    }
    render();
    return true;
  }

  /* ---------------- Arranque ---------------- */

  function iniciar() {
    dom.dropzone = document.getElementById('dropzone');
    dom.aviso = document.getElementById('aviso');
    dom.barra = document.getElementById('barra');
    dom.barraRelleno = document.getElementById('barra-relleno');
    dom.meta = document.getElementById('meta');
    dom.error = document.getElementById('error');
    dom.vivo = document.getElementById('estado-vivo');
    dom.entrada = document.getElementById('entrada-archivo');
    dom.ajusteObjetivo = document.getElementById('ajuste-objetivo');
    dom.ajusteCalidad = document.getElementById('ajuste-calidad');
    dom.ajusteDim = document.getElementById('ajuste-dim');
    dom.valorCalidad = document.getElementById('valor-calidad');

    IDLE_HTML = dom.dropzone.innerHTML;

    // Estilo preferido (persistido)
    try {
      var guardado = localStorage.getItem(CLAVE_ESTILO);
      if (guardado === 'linea' || guardado === 'ficha' || guardado === 'imagen') {
        estado.estilo = guardado;
      }
    } catch (e) { /* localStorage no disponible */ }
    pintarSegmentos();

    // Selector de estilo
    Array.prototype.forEach.call(document.querySelectorAll('.seg'), function (btn) {
      btn.addEventListener('click', function () {
        estado.estilo = btn.dataset.estilo;
        try { localStorage.setItem(CLAVE_ESTILO, estado.estilo); } catch (e) { /* opcional */ }
        pintarSegmentos();
        render();
      });
    });

    // Dropzone: clic, teclado y arrastre
    dom.dropzone.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-descargar]')) {
        ev.stopPropagation();
        descargar();
        return;
      }
      abrirSelector();
    });
    dom.dropzone.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
        ev.preventDefault();
        abrirSelector();
      }
    });
    dom.aviso.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-descargar]')) descargar();
    });
    dom.meta.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-cambiar]')) abrirSelector();
    });
    ['dragenter', 'dragover'].forEach(function (nombre) {
      dom.dropzone.addEventListener(nombre, function (ev) {
        ev.preventDefault();
        if (estado.tipo !== 'trabajando') dom.dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (nombre) {
      dom.dropzone.addEventListener(nombre, function (ev) {
        ev.preventDefault();
        dom.dropzone.classList.remove('is-dragover');
      });
    });
    dom.dropzone.addEventListener('drop', function (ev) {
      var archivo = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (archivo) manejarArchivo(archivo);
    });

    dom.entrada.addEventListener('change', function () {
      var archivo = dom.entrada.files && dom.entrada.files[0];
      if (archivo) manejarArchivo(archivo);
      dom.entrada.value = ''; // permite volver a elegir el mismo archivo
    });

    // Ajustes de prueba
    dom.ajusteCalidad.addEventListener('input', function () {
      dom.valorCalidad.textContent = (parseInt(dom.ajusteCalidad.value, 10) / 100).toFixed(2);
    });

    // Estado inicial o demostración
    var params = new URLSearchParams(location.search);
    var demo = params.get('estado');
    if (!cargarDemo(demo)) render();
  }

  function pintarSegmentos() {
    Array.prototype.forEach.call(document.querySelectorAll('.seg'), function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.estilo === estado.estilo ? 'true' : 'false');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
