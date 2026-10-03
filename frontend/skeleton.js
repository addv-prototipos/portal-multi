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
   * Reemplaza el <tbody> por una sola fila con el mensaje de error (mismo
   * texto que antes se mostraba fuera de la tabla) y un botón Reintentar
   * que vuelve a llamar a la función de carga original.
   */
  function aplicarErrorTabla(tbody, columnas, mensaje, reintentar) {
    if (!tbody) return;
    quitarEsqueletoTabla(tbody);
    tbody.innerHTML =
      '<tr><td colspan="' + columnas + '">' +
      '<div class="sk-retry-inline"><span>' + mensaje + '</span>' +
      '<button type="button" class="sk-retry-btn">Reintentar</button></div>' +
      '</td></tr>';
    if (typeof reintentar === 'function') {
      var boton = tbody.querySelector('.sk-retry-btn');
      if (boton) boton.addEventListener('click', reintentar);
    }
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
    marcarKpisCargando: marcarKpisCargando
  };
})();
