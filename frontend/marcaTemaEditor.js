/* Editor reutilizable de "Marca e identidad visual" (Punto 210, ver
   PROJECT_STATE.md) — un solo componente para /admin (self-servicio del
   propio tenant) y /control (super-admin editando cualquier tenant por
   slug). Mismo criterio que skeleton.js/theme.js: archivo compartido en
   vez de duplicar esta lógica en admin.js y control.js por separado.

   Sin selector de tipografía a propósito: congelada a Inter en todo el
   sitio (ver CLAUDE.md "Tipografía unificada") — el backend la ignora
   aunque se mande, así que no se ofrece la opción.

   El caller (admin.js / control.js) es dueño de la red: este módulo solo
   pinta el DOM y valida en el cliente; toda llamada real pasa por las
   funciones que el caller inyecta en `opciones` (cada superficie tiene su
   propio API_BASE/slug/autenticación). */
(function () {
  'use strict';

  var CAMPOS_COLOR = [
    { clave: 'bg', etiqueta: 'Fondo general' },
    { clave: 'surface', etiqueta: 'Superficie (tarjetas)' },
    { clave: 'border', etiqueta: 'Bordes' },
    { clave: 'ink', etiqueta: 'Texto principal' },
    { clave: 'inkSoft', etiqueta: 'Texto secundario' },
    { clave: 'accent', etiqueta: 'Color de acción principal' },
    { clave: 'accentDark', etiqueta: 'Color de acción oscuro' },
    { clave: 'accentSoft', etiqueta: 'Fondo suave de acción' },
    { clave: 'warn', etiqueta: 'Advertencia' },
    { clave: 'warnSoft', etiqueta: 'Fondo suave de advertencia' },
    { clave: 'error', etiqueta: 'Error' },
    { clave: 'errorSoft', etiqueta: 'Fondo suave de error' }
  ];

  var RADIOS = [
    { valor: 'sm', etiqueta: 'Sutil' },
    { valor: 'md', etiqueta: 'Medio' },
    { valor: 'lg', etiqueta: 'Redondeado' }
  ];

  // Mismo diseño base ADDV que frontend/style.css — el punto de partida
  // cuando el tenant todavía no personalizó nada.
  var COLORES_BASE = {
    bg: '#F6F4EF', surface: '#FFFFFF', border: '#E3DFD4',
    ink: '#21261F', inkSoft: '#5B6158',
    accent: '#0F6E5D', accentDark: '#0B5548', accentSoft: '#E4EFEC',
    warn: '#B4530C', warnSoft: '#FBEBDC',
    error: '#B3261E', errorSoft: '#FBEAE9'
  };

  // ---------- Contraste WCAG 2.1 AA (misma fórmula que el backend) ----------

  function luminancia(hex) {
    var valores = [1, 3, 5].map(function (i) {
      var canal = parseInt(hex.slice(i, i + 2), 16) / 255;
      return canal <= 0.03928 ? canal / 12.92 : Math.pow((canal + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * valores[0] + 0.7152 * valores[1] + 0.0722 * valores[2];
  }

  // `luminancia()` lee los canales con slice(1,3)/(3,5)/(5,7) — asume el
  // '#' en la posición 0, igual que backend/utils/tenantTema.js
  // (luminanciaRelativa). Nunca quitar el '#' antes de llamarla: hacerlo
  // (como hacía esta función antes) corre los índices un lugar y calcula
  // un contraste distinto al real — bug encontrado por el E2E de punto
  // 210, confirmado comparando contra el cálculo del backend.
  function contraste(a, b) {
    var l1 = luminancia(a);
    var l2 = luminancia(b);
    var claro = Math.max(l1, l2);
    var oscuro = Math.min(l1, l2);
    return (claro + 0.05) / (oscuro + 0.05);
  }

  // Mismos 9 pares que valida el backend (backend/utils/tenantTema.js
  // validarContraste) — se revalida aquí solo para dar feedback inmediato
  // en el cliente; el backend sigue siendo la fuente de verdad real.
  function validarContrasteCliente(colores) {
    var pares = [
      ['bg', 'ink', 4.5, 'El texto principal sobre el fondo'],
      ['surface', 'ink', 4.5, 'El texto principal sobre las tarjetas'],
      ['surface', 'inkSoft', 4.5, 'El texto secundario sobre las tarjetas'],
      ['bg', 'warn', 4.5, 'El texto de advertencia'],
      ['bg', 'error', 4.5, 'El texto de error']
    ];
    var errores = [];
    pares.forEach(function (par) {
      var fondo = colores[par[0]], texto = colores[par[1]];
      if (!fondo || !texto) return;
      var ratio = contraste(fondo, texto);
      if (ratio < par[2]) errores.push(par[3] + ' no cumple AA (' + ratio.toFixed(2) + ':1, mínimo ' + par[2] + ':1).');
    });
    var pares3 = [
      ['accent', '#ffffff', 'El texto blanco sobre los botones principales'],
      ['accentDark', '#ffffff', 'El texto blanco sobre los botones oscuros'],
      ['surface', 'accent', 'Los enlaces de color de acción'],
      ['accentSoft', 'accentDark', 'El texto de acción sobre su fondo suave']
    ];
    pares3.forEach(function (par) {
      var fondo = colores[par[0]], texto = par[1] === '#ffffff' ? '#ffffff' : colores[par[1]];
      if (!fondo || !texto) return;
      var ratio = contraste(fondo, texto);
      if (ratio < 3) errores.push(par[2] + ' no cumple AA (' + ratio.toFixed(2) + ':1, mínimo 3:1).');
    });
    return errores;
  }

  // ---------- Montaje ----------

  // `contenedor`: elemento vacío donde se inyecta el formulario completo.
  // `opciones`:
  //   getAuthHeader() -> string
  //   showToast(mensaje)
  //   limiteMb() -> number (máximo de imagen vigente, para el hint)
  //   cargar() -> Promise<{ marca, marcaLogoUrl, tema } | null>
  //   guardarMarca(marca) -> Promise<{ marca }>
  //   guardarTema(temaParcial: {colores, radio}) -> Promise<{ tema }>
  //   restablecerTema() -> Promise<void>
  //   subirLogo(file) -> Promise<{ marcaLogoUrl }>
  //   quitarLogo() -> Promise<void>
  //   subirFavicon(file) -> Promise<{ faviconUrl }>
  //   quitarFavicon() -> Promise<void>
  function montar(contenedor, opciones) {
    if (!contenedor) return;
    var op = opciones || {};
    var estado = { colores: Object.assign({}, COLORES_BASE), radio: 'md', marcaLogoUrl: null, faviconUrl: null };

    contenedor.innerHTML =
      '<p class="panel-subtitle admin-config-subtitle">' +
        'Logo, favicon y paleta de colores de tu portal — correos, login y panel. Si no personalizas nada, se usa el diseño base de la plataforma.' +
      '</p>' +
      '<div class="tema-preview" id="met-preview" role="img" aria-label="Vista previa de la identidad visual">' +
        '<p class="tema-preview-label">Vista previa</p>' +
        '<div class="tema-preview-card" id="met-preview-card">' +
          '<p class="tema-preview-titulo">Tu negocio en orden</p>' +
          '<p class="tema-preview-texto">Así se ve tu portal con estos colores.</p>' +
          '<span class="tema-preview-boton" id="met-preview-boton">Registrar venta</span>' +
          '<span class="tema-preview-enlace" id="met-preview-enlace">Ir al tablero</span>' +
        '</div>' +
      '</div>' +
      '<p class="field-hint contraste-aviso" id="met-contraste-aviso"></p>' +

      '<div class="field">' +
        '<label for="met-marca-nombre">Nombre de marca (en tus correos)</label>' +
        '<input type="text" id="met-marca-nombre" maxlength="255" autocomplete="off" />' +
        '<p class="field-error" id="met-error-marca" role="alert"></p>' +
      '</div>' +

      '<div class="field">' +
        '<label>Logo del sitio</label>' +
        '<div class="ticket-logo-actual" id="met-logo-actual" hidden>' +
          '<img id="met-logo-actual-preview" alt="Logo de la marca" />' +
          '<button type="button" class="btn btn-secondary" id="met-btn-logo-quitar">Quitar logo</button>' +
        '</div>' +
        '<label class="dropzone" id="met-logo-dropzone" for="met-logo-input">' +
          '<span class="dropzone-icono" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg></span>' +
          '<span>Arrastra una imagen o haz clic para seleccionar</span>' +
          '<span class="field-hint">JPG, PNG o WEBP · máx. <span id="met-logo-limite-mb">2</span> MB</span>' +
        '</label>' +
        '<input type="file" id="met-logo-input" accept="image/jpeg,image/png,image/webp" hidden />' +
        '<p class="field-error" id="met-error-logo" role="alert"></p>' +
      '</div>' +

      '<div class="field">' +
        '<label>Favicon</label>' +
        '<div class="ticket-logo-actual" id="met-favicon-actual" hidden>' +
          '<img id="met-favicon-actual-preview" alt="Favicon" />' +
          '<button type="button" class="btn btn-secondary" id="met-btn-favicon-quitar">Quitar favicon</button>' +
        '</div>' +
        '<label class="dropzone" id="met-favicon-dropzone" for="met-favicon-input">' +
          '<span class="dropzone-icono" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg></span>' +
          '<span>Arrastra una imagen o haz clic para seleccionar</span>' +
          '<span class="field-hint">JPG, PNG o WEBP · máx. <span id="met-favicon-limite-mb">2</span> MB</span>' +
        '</label>' +
        '<input type="file" id="met-favicon-input" accept="image/jpeg,image/png,image/webp" hidden />' +
        '<p class="field-error" id="met-error-favicon" role="alert"></p>' +
      '</div>' +

      '<div class="tema-grupo">' +
        '<p class="tema-grupo-titulo">Paleta de colores (valida contraste AA al guardar)</p>' +
        '<div class="tema-grid-colores" id="met-color-grid"></div>' +
      '</div>' +

      '<div class="field">' +
        '<label>Radio de esquinas</label>' +
        '<div class="view-toggle" role="tablist" id="met-radio-toggle" aria-label="Radio de esquinas">' +
          RADIOS.map(function (r) {
            return '<button type="button" class="view-toggle-btn' + (r.valor === 'md' ? ' is-active' : '') + '" data-radio="' + r.valor + '" role="tab" aria-selected="' + (r.valor === 'md') + '">' + r.etiqueta + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<p class="field-error" id="met-error-tema" role="alert"></p>' +

      '<div class="admin-config-actions">' +
        '<button type="button" class="btn btn-secondary" id="met-btn-restablecer">Restablecer al diseño base</button>' +
        '<button type="button" class="btn btn-primary" id="met-btn-guardar"><span id="met-btn-guardar-label">Guardar cambios</span></button>' +
      '</div>';

    var el = {
      marcaNombre: contenedor.querySelector('#met-marca-nombre'),
      errorMarca: contenedor.querySelector('#met-error-marca'),
      logoActual: contenedor.querySelector('#met-logo-actual'),
      logoActualPreview: contenedor.querySelector('#met-logo-actual-preview'),
      btnLogoQuitar: contenedor.querySelector('#met-btn-logo-quitar'),
      logoDropzone: contenedor.querySelector('#met-logo-dropzone'),
      logoInput: contenedor.querySelector('#met-logo-input'),
      errorLogo: contenedor.querySelector('#met-error-logo'),
      logoLimiteMb: contenedor.querySelector('#met-logo-limite-mb'),
      faviconActual: contenedor.querySelector('#met-favicon-actual'),
      faviconActualPreview: contenedor.querySelector('#met-favicon-actual-preview'),
      btnFaviconQuitar: contenedor.querySelector('#met-btn-favicon-quitar'),
      faviconDropzone: contenedor.querySelector('#met-favicon-dropzone'),
      faviconInput: contenedor.querySelector('#met-favicon-input'),
      errorFavicon: contenedor.querySelector('#met-error-favicon'),
      faviconLimiteMb: contenedor.querySelector('#met-favicon-limite-mb'),
      colorGrid: contenedor.querySelector('#met-color-grid'),
      radioToggle: contenedor.querySelector('#met-radio-toggle'),
      errorTema: contenedor.querySelector('#met-error-tema'),
      btnRestablecer: contenedor.querySelector('#met-btn-restablecer'),
      btnGuardar: contenedor.querySelector('#met-btn-guardar'),
      btnGuardarLabel: contenedor.querySelector('#met-btn-guardar-label'),
      previewCard: contenedor.querySelector('#met-preview-card'),
      previewBoton: contenedor.querySelector('#met-preview-boton'),
      previewEnlace: contenedor.querySelector('#met-preview-enlace'),
      contrasteAviso: contenedor.querySelector('#met-contraste-aviso')
    };

    el.colorGrid.innerHTML = CAMPOS_COLOR.map(function (c) {
      return '<div class="tema-color-field">' +
        '<label for="met-color-' + c.clave + '">' + c.etiqueta + '</label>' +
        '<input type="color" id="met-color-' + c.clave + '" data-clave="' + c.clave + '" />' +
      '</div>';
    }).join('');

    var limiteMb = typeof op.limiteMb === 'function' ? op.limiteMb() : 2;
    if (el.logoLimiteMb) el.logoLimiteMb.textContent = String(limiteMb);
    if (el.faviconLimiteMb) el.faviconLimiteMb.textContent = String(limiteMb);

    function aplicarPreview() {
      el.previewCard.style.background = estado.colores.bg;
      el.previewCard.style.color = estado.colores.ink;
      el.previewBoton.style.background = estado.colores.accent;
      el.previewBoton.style.color = '#ffffff';
      el.previewEnlace.style.color = estado.colores.accentDark;

      var errores = validarContrasteCliente(estado.colores);
      if (errores.length > 0) {
        el.contrasteAviso.textContent = errores[0] + ' No se podrá guardar hasta corregirlo.';
        el.contrasteAviso.dataset.estado = 'bad';
      } else {
        el.contrasteAviso.textContent = 'Contraste AA correcto en los pares principales.';
        el.contrasteAviso.dataset.estado = 'ok';
      }
    }

    function pintarColoresEnCampos() {
      CAMPOS_COLOR.forEach(function (c) {
        var input = document.getElementById('met-color-' + c.clave);
        if (input) input.value = estado.colores[c.clave] || COLORES_BASE[c.clave];
      });
      aplicarPreview();
    }

    function pintarRadio() {
      el.radioToggle.querySelectorAll('.view-toggle-btn').forEach(function (btn) {
        var activo = btn.dataset.radio === estado.radio;
        btn.classList.toggle('is-active', activo);
        btn.setAttribute('aria-selected', String(activo));
      });
    }

    function pintarLogo() {
      var tiene = Boolean(estado.marcaLogoUrl);
      el.logoActual.hidden = !tiene;
      el.logoDropzone.hidden = tiene;
      if (tiene) el.logoActualPreview.src = estado.marcaLogoUrl;
    }

    function pintarFavicon() {
      var tiene = Boolean(estado.faviconUrl);
      el.faviconActual.hidden = !tiene;
      el.faviconDropzone.hidden = tiene;
      if (tiene) el.faviconActualPreview.src = estado.faviconUrl;
    }

    function cargarEstadoDesdeServidor() {
      if (typeof op.cargar !== 'function') return;
      Promise.resolve(op.cargar()).then(function (datos) {
        if (!datos) return;
        estado.marcaLogoUrl = datos.marcaLogoUrl || null;
        var tema = datos.tema || {};
        estado.colores = Object.assign({}, COLORES_BASE, tema.colores || {});
        estado.radio = tema.radio || 'md';
        estado.faviconUrl = tema.faviconUrl || null;
        el.marcaNombre.value = datos.marca || '';
        pintarColoresEnCampos();
        pintarRadio();
        pintarLogo();
        pintarFavicon();
      }).catch(function () {
        // Se queda con el diseño base; el administrador puede reintentar abriendo de nuevo.
      });
    }

    el.colorGrid.addEventListener('input', function (e) {
      var input = e.target.closest('input[type="color"]');
      if (!input) return;
      estado.colores[input.dataset.clave] = input.value;
      aplicarPreview();
    });

    el.radioToggle.addEventListener('click', function (e) {
      var btn = e.target.closest('.view-toggle-btn');
      if (!btn) return;
      estado.radio = btn.dataset.radio;
      pintarRadio();
    });

    el.btnGuardar.addEventListener('click', function () {
      el.errorMarca.textContent = '';
      el.errorTema.textContent = '';
      var errores = validarContrasteCliente(estado.colores);
      if (errores.length > 0) {
        el.errorTema.textContent = errores[0];
        return;
      }
      var marca = el.marcaNombre.value.trim();
      if (marca.length > 255) {
        el.errorMarca.textContent = 'La marca no puede superar los 255 caracteres.';
        return;
      }
      el.btnGuardar.disabled = true;
      el.btnGuardarLabel.textContent = 'Guardando…';
      Promise.all([
        Promise.resolve(op.guardarMarca ? op.guardarMarca(marca) : null),
        Promise.resolve(op.guardarTema ? op.guardarTema({ colores: estado.colores, radio: estado.radio }) : null)
      ]).then(function () {
        if (op.showToast) op.showToast('Guardado — se refleja de inmediato, sin esperar caché.');
      }).catch(function (err) {
        el.errorTema.textContent = (err && err.message) || 'No se pudo guardar. Revisa tu conexión.';
      }).finally(function () {
        el.btnGuardar.disabled = false;
        el.btnGuardarLabel.textContent = 'Guardar cambios';
      });
    });

    el.btnRestablecer.addEventListener('click', function () {
      if (typeof op.restablecerTema !== 'function') return;
      el.errorTema.textContent = '';
      Promise.resolve(op.restablecerTema()).then(function () {
        estado.colores = Object.assign({}, COLORES_BASE);
        estado.radio = 'md';
        estado.faviconUrl = null;
        pintarColoresEnCampos();
        pintarRadio();
        pintarFavicon();
        if (op.showToast) op.showToast('Restablecido al diseño base — logo y colores quitados.');
      }).catch(function (err) {
        el.errorTema.textContent = (err && err.message) || 'No se pudo restablecer.';
      });
    });

    // `subir(archivo, estadoTema)` — el segundo argumento ({colores, radio})
    // es el snapshot actual del tema tal como lo tiene el formulario ahora
    // mismo; lo usa /control (su PUT /tema reemplaza el tema_json completo,
    // así que una subida de favicon por separado debe reenviar los colores
    // vigentes o los perdería). /admin lo ignora: su endpoint dedicado ya
    // hace merge en el servidor.
    function manejarSubida(input, dropzone, errorEl, subir, onOk) {
      function procesar(archivo) {
        if (!archivo) return;
        errorEl.textContent = '';
        Promise.resolve(subir(archivo, { colores: estado.colores, radio: estado.radio })).then(function (resultado) {
          onOk(resultado);
        }).catch(function (err) {
          errorEl.textContent = (err && err.message) || 'No se pudo subir la imagen.';
        }).finally(function () {
          input.value = '';
        });
      }
      input.addEventListener('change', function () {
        procesar(input.files && input.files[0]);
      });
      dropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('is-dragover');
      });
      dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
        procesar(e.dataTransfer.files && e.dataTransfer.files[0]);
      });
    }

    manejarSubida(el.logoInput, el.logoDropzone, el.errorLogo, op.subirLogo, function (res) {
      estado.marcaLogoUrl = (res && res.marcaLogoUrl) || null;
      pintarLogo();
    });
    el.btnLogoQuitar.addEventListener('click', function () {
      if (typeof op.quitarLogo !== 'function') return;
      Promise.resolve(op.quitarLogo()).then(function () {
        estado.marcaLogoUrl = null;
        pintarLogo();
      }).catch(function () {
        el.errorLogo.textContent = 'No se pudo quitar el logo.';
      });
    });

    manejarSubida(el.faviconInput, el.faviconDropzone, el.errorFavicon, op.subirFavicon, function (res) {
      estado.faviconUrl = (res && res.faviconUrl) || null;
      pintarFavicon();
    });
    el.btnFaviconQuitar.addEventListener('click', function () {
      if (typeof op.quitarFavicon !== 'function') return;
      Promise.resolve(op.quitarFavicon({ colores: estado.colores, radio: estado.radio })).then(function () {
        estado.faviconUrl = null;
        pintarFavicon();
      }).catch(function () {
        el.errorFavicon.textContent = 'No se pudo quitar el favicon.';
      });
    });

    pintarColoresEnCampos();
    pintarRadio();
    pintarLogo();
    pintarFavicon();
    cargarEstadoDesdeServidor();
  }

  window.EditorMarcaTema = { montar: montar };
})();
