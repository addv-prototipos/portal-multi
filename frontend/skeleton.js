/* Esqueleto de carga (shimmer) reutilizable en admin.html, control.html,
   dashboard.html y tickets.html — mismo criterio que theme.js: un solo
   archivo compartido en vez de duplicar esta lógica en cada *.js de página.
   Cero dependencia de admin.js/control.js/portal.js: solo manipula el DOM
   que le pasan, así puede cargarse antes que cualquiera de ellos. */
(function () {
  'use strict';

  var ANCHOS_BASE = [82, 58, 70, 46, 64, 52, 74, 42];

  function filaEsqueleto(columnas) {
    var celdas = '';
    for (var i = 0; i < columnas; i++) {
      var ancho = ANCHOS_BASE[i % ANCHOS_BASE.length];
      celdas += '<td><span class="sk sk-line" style="width:' + ancho + '%"></span></td>';
    }
    return '<tr class="sk-fila" aria-hidden="true">' + celdas + '</tr>';
  }

  function filasEsqueleto(columnas, filas) {
    var n = filas || 5;
    var html = '';
    for (var i = 0; i < n; i++) html += filaEsqueleto(columnas);
    return html;
  }

  /**
   * Reemplaza el contenido de un <tbody> con filas de esqueleto mientras
   * se espera la respuesta real. Marca la tabla como ocupada para
   * lectores de pantalla (aria-busy) sin duplicar el aviso visualmente.
   */
  function aplicarEsqueletoTabla(tbody, columnas, filas) {
    if (!tbody) return;
    var tabla = tbody.closest('table');
    if (tabla) tabla.setAttribute('aria-busy', 'true');
    tbody.innerHTML = filasEsqueleto(columnas, filas);
  }

  /**
   * Quita el estado "ocupado" de la tabla. Las filas reales las escribe
   * quien llama (render*), esta función solo limpia el atributo.
   */
  function quitarEsqueletoTabla(tbody) {
    var tabla = tbody && tbody.closest('table');
    if (tabla) tabla.removeAttribute('aria-busy');
  }

  /**
   * Botón "Reportar problema" (propuesta C, punto 528) — solo se arma si
   * viene un `modulo` (si no, ninguna llamada sabe a qué endpoint
   * reportar, así que se omite en vez de mandar un reporte vacío).
   * `data-sk-*` lleva el diagnóstico, nunca el mensaje completo (puede
   * tener comillas/HTML si algún caller cambia el texto a futuro).
   */
  function botonReportar(modulo, codigo) {
    if (!modulo) return '';
    return (
      '<button type="button" class="sk-reportar-btn" data-sk-modulo="' + modulo + '" data-sk-codigo="' + (codigo || '') + '">' +
      'Reportar problema</button>'
    );
  }

  /**
   * El clic en "Reportar problema" nunca llama directo a admin.js (esta
   * librería se carga ANTES y sin depender de ningún *.js de página,
   * ver cabecera del archivo) — dispara un CustomEvent en `document` y
   * quien quiera escucharlo (el modal de diagnóstico de admin.js) decide
   * qué hacer. Sin listener registrado, el botón simplemente no hace
   * nada — nunca un error en consola.
   */
  function vincularBotonReportar(contenedor, mensaje, reintentar) {
    var btn = contenedor.querySelector('.sk-reportar-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      document.dispatchEvent(
        new CustomEvent('sk:reportar-error', {
          detail: {
            modulo: btn.getAttribute('data-sk-modulo'),
            codigo: btn.getAttribute('data-sk-codigo') || '',
            mensaje: mensaje,
            reintentar: typeof reintentar === 'function' ? reintentar : null,
          },
        })
      );
    });
  }

  /**
   * Reemplaza el <tbody> por una sola fila con el mensaje de error (mismo
   * texto que antes se mostraba fuera de la tabla), un botón Reintentar
   * que vuelve a llamar a la función de carga original, y opcionalmente
   * "Reportar problema" si `opciones.modulo` viene definido.
   */
  function aplicarErrorTabla(tbody, columnas, mensaje, reintentar, opciones) {
    if (!tbody) return;
    var opts = opciones || {};
    quitarEsqueletoTabla(tbody);
    tbody.innerHTML =
      '<tr><td colspan="' + columnas + '">' +
      '<div class="sk-retry-inline"><span>' + mensaje + '</span>' +
      '<div class="sk-retry-acciones">' +
      '<button type="button" class="sk-retry-btn">Reintentar</button>' +
      botonReportar(opts.modulo, opts.codigo) +
      '</div></div>' +
      '</td></tr>';
    if (typeof reintentar === 'function') {
      var boton = tbody.querySelector('.sk-retry-btn');
      if (boton) boton.addEventListener('click', reintentar);
    }
    vincularBotonReportar(tbody, mensaje, reintentar);
  }

  /**
   * Misma pieza que aplicarErrorTabla() pero para un contenedor que NO es
   * un <tbody> (ej. el <p>/<div> de error de una vista que no es tabla,
   * como Pedidos o CRM) — mismo HTML interno, mismo evento de reporte.
   */
  function aplicarErrorInline(contenedor, mensaje, reintentar, opciones) {
    if (!contenedor) return;
    var opts = opciones || {};
    contenedor.innerHTML =
      '<div class="sk-retry-inline sk-retry-inline-bloque"><span>' + mensaje + '</span>' +
      '<div class="sk-retry-acciones">' +
      '<button type="button" class="sk-retry-btn">Reintentar</button>' +
      botonReportar(opts.modulo, opts.codigo) +
      '</div></div>';
    if (typeof reintentar === 'function') {
      var boton = contenedor.querySelector('.sk-retry-btn');
      if (boton) boton.addEventListener('click', reintentar);
    }
    vincularBotonReportar(contenedor, mensaje, reintentar);
  }

  /**
   * Prende/apaga el shimmer sobre los números KPI (.inicio-stat-numero o
   * .credito-kpi-valor) dentro de un contenedor — el texto real sigue
   * detrás sin tocarse, el render normal de cada vista lo actualiza
   * igual que siempre.
   */
  function marcarKpisCargando(contenedor, cargando) {
    if (!contenedor) return;
    contenedor.classList.toggle('sk-cargando', !!cargando);
  }

  window.Esqueleto = {
    filasEsqueleto: filasEsqueleto,
    aplicarEsqueletoTabla: aplicarEsqueletoTabla,
    quitarEsqueletoTabla: quitarEsqueletoTabla,
    aplicarErrorTabla: aplicarErrorTabla,
    aplicarErrorInline: aplicarErrorInline,
    marcarKpisCargando: marcarKpisCargando
  };
})();
