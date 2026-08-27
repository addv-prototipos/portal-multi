(() => {
  'use strict';

  const { API_BASE, urlPagina, requireSession, showToast } = window.Portal;

  const els = {
    panelSubir: document.getElementById('panel-subir'),
    panelConfirmacion: document.getElementById('panel-confirmacion'),
    compraVerificacionSeccion: document.getElementById('compra-verificacion-seccion'),
    numeroCompraInput: document.getElementById('ticket-numero-compra'),
    totalCompraInput: document.getElementById('ticket-total-compra'),
    fechaCompraInput: document.getElementById('ticket-fecha-compra'),
    horaCompraInput: document.getElementById('ticket-hora-compra'),
    usoCfdiSelect: document.getElementById('ticket-uso-cfdi'),
    usoCfdiMark: document.getElementById('mark-uso-cfdi'),
    tipoPagoMark: document.getElementById('mark-tipo-pago'),
    comentariosMark: document.getElementById('mark-comentarios'),
    tipoPagoSelect: document.getElementById('ticket-tipo-pago'),
    campoTipoPagoOtro: document.getElementById('campo-tipo-pago-otro'),
    tipoPagoOtroInput: document.getElementById('ticket-tipo-pago-otro'),
    comentariosInput: document.getElementById('ticket-comentarios'),
    dropzone: document.getElementById('dropzone'),
    inputImagen: document.getElementById('input-imagen'),
    dropzoneEmpty: document.getElementById('dropzone-empty'),
    dropzonePreview: document.getElementById('dropzone-preview'),
    previewImagen: document.getElementById('preview-imagen'),
    btnQuitarImagen: document.getElementById('btn-quitar-imagen'),
    errorImagen: document.getElementById('error-imagen'),
    progressWrap: document.getElementById('progress-wrap'),
    progressBar: document.getElementById('progress-bar'),
    progressPercent: document.getElementById('progress-percent'),
    btnSubirTicket: document.getElementById('btn-subir-ticket'),
    folioGenerado: document.getElementById('folio-generado'),
    btnOtroTicket: document.getElementById('btn-otro-ticket'),
    sinConstanciaOverlay: document.getElementById('sin-constancia-overlay'),
    verificacionCompraOverlay: document.getElementById('verificacion-compra-overlay'),
    verificacionCompraTitle: document.getElementById('verificacion-compra-title'),
    verificacionCompraMensaje: document.getElementById('verificacion-compra-mensaje'),
    btnVerificacionCompraCerrar: document.getElementById('btn-verificacion-compra-cerrar'),
  };

  let usoCfdiObligatorio = false;
  let tipoPagoObligatorio = false;
  let comentariosObligatorio = false;
  // En true por defecto (mismo valor por defecto que ya usa el backend)
  // — así, si la petición de configuración tarda o falla, el formulario
  // se comporta con las reglas actuales en vez de aflojarlas de golpe.
  let ordenesCompraHabilitado = true;

  const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

  let archivoSeleccionado = null;
  let previewUrl = null;

  function goToStep(panel) {
    els.panelSubir.classList.toggle('is-active', panel === 'subir');
    els.panelConfirmacion.classList.toggle('is-active', panel === 'confirmacion');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Formato automático del campo Total (comas de miles) ----------
  // Mismo comportamiento y misma lógica que ya usa admin.js para
  // "Cantidad" en Ventas — se repite aquí en vez de compartir
  // un archivo porque cada página se sirve de forma independiente, sin
  // un bundler que junte módulos comunes entre páginas.
  function formatearNumeroConComas(valorCrudo) {
    let limpio = String(valorCrudo || '').replace(/[^\d.]/g, '');
    const primerPunto = limpio.indexOf('.');
    if (primerPunto !== -1) {
      limpio = limpio.slice(0, primerPunto + 1) + limpio.slice(primerPunto + 1).replace(/\./g, '');
    }
    let [entero, decimal] = limpio.split('.');
    entero = (entero || '').replace(/^0+(?=\d)/, '');
    const enteroConComas = entero ? Number(entero).toLocaleString('en-US') : '';
    let resultado = enteroConComas;
    if (decimal !== undefined) {
      resultado += `.${decimal.slice(0, 2)}`;
    }
    return resultado;
  }

  function obtenerValorNumerico(input) {
    return Number(String(input.value || '').replace(/,/g, ''));
  }

  function formatearCampoDinero(input) {
    input.addEventListener('input', () => {
      const cursorOriginal = input.selectionStart;
      const valorOriginal = input.value;
      const digitosAntesDelCursor = (valorOriginal.slice(0, cursorOriginal).match(/[\d.]/g) || []).length;

      const nuevoValor = formatearNumeroConComas(valorOriginal);
      input.value = nuevoValor;

      let nuevaPosicion = nuevoValor.length;
      if (digitosAntesDelCursor === 0) {
        nuevaPosicion = 0;
      } else {
        let contador = 0;
        for (let i = 0; i < nuevoValor.length; i++) {
          if (/[\d.]/.test(nuevoValor[i])) contador++;
          if (contador === digitosAntesDelCursor) {
            nuevaPosicion = i + 1;
            break;
          }
        }
      }
      input.setSelectionRange(nuevaPosicion, nuevaPosicion);
    });
  }
  formatearCampoDinero(els.totalCompraInput);

  function dropzoneDeshabilitado() {
    return els.dropzone.getAttribute('aria-disabled') === 'true';
  }

  els.dropzone.addEventListener('click', () => {
    if (dropzoneDeshabilitado()) return;
    els.inputImagen.click();
  });
  els.dropzone.addEventListener('keydown', (e) => {
    if (dropzoneDeshabilitado()) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.inputImagen.click();
    }
  });

  ['dragover', 'dragenter'].forEach((evt) => {
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      if (!dropzoneDeshabilitado()) els.dropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove('is-dragover');
    });
  });
  els.dropzone.addEventListener('drop', (e) => {
    // Arrastrar y soltar un archivo no pasa por el <input> deshabilitado —
    // es un evento aparte sobre el propio div, así que necesita su propio
    // candado explícito.
    if (dropzoneDeshabilitado()) return;
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) manejarArchivo(file);
  });

  els.inputImagen.addEventListener('change', () => {
    const file = els.inputImagen.files && els.inputImagen.files[0];
    if (file) manejarArchivo(file);
  });

  function manejarArchivo(file) {
    els.errorImagen.textContent = '';
    const ext = `.${file.name.split('.').pop().toLowerCase()}`;
    if (!ALLOWED_EXT.includes(ext) || !ALLOWED_MIME.includes(file.type)) {
      els.errorImagen.textContent = 'Formato no permitido. Solo se aceptan JPG, PNG o WEBP.';
      return;
    }
    archivoSeleccionado = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    els.previewImagen.src = previewUrl;
    els.dropzoneEmpty.hidden = true;
    els.dropzonePreview.hidden = false;
  }

  els.btnQuitarImagen.addEventListener('click', (e) => {
    e.stopPropagation();
    archivoSeleccionado = null;
    els.inputImagen.value = '';
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    els.dropzoneEmpty.hidden = false;
    els.dropzonePreview.hidden = true;
  });

  function setSubiendoLoading(cargando) {
    els.btnSubirTicket.disabled = cargando;
    els.btnSubirTicket.textContent = cargando ? 'Enviando…' : 'Enviar ticket';
  }

  // El campo para especificar solo aparece cuando se elige "Otro" — se
  // limpia al ocultarlo, para no dejar un valor viejo capturado si el
  // cliente cambia de opinión y elige otro tipo de pago después.
  els.tipoPagoSelect.addEventListener('change', () => {
    const esOtro = els.tipoPagoSelect.value === 'otro';
    els.campoTipoPagoOtro.hidden = !esOtro;
    if (!esOtro) {
      els.tipoPagoOtroInput.value = '';
      document.getElementById('error-ticket-tipo-pago-otro').textContent = '';
    }
  });

  els.btnSubirTicket.addEventListener('click', () => {
    els.errorImagen.textContent = '';
    document.getElementById('error-ticket-numero-compra').textContent = '';
    document.getElementById('error-ticket-total-compra').textContent = '';
    document.getElementById('error-ticket-fecha-compra').textContent = '';
    document.getElementById('error-ticket-hora-compra').textContent = '';
    document.getElementById('error-ticket-uso-cfdi').textContent = '';
    document.getElementById('error-ticket-tipo-pago').textContent = '';
    document.getElementById('error-ticket-tipo-pago-otro').textContent = '';
    document.getElementById('error-ticket-comentarios').textContent = '';

    if (!archivoSeleccionado) {
      els.errorImagen.textContent = 'Selecciona una imagen de tu ticket antes de continuar.';
      return;
    }

    // Mismas reglas de formato que ya usa "Ventas" del lado del
    // administrador — el cliente captura estos datos tal como le
    // llegaron en el correo de confirmación de su venta. Todo este
    // bloque se salta por completo si "Ventas" está
    // desactivada desde el panel — el ticket se puede enviar sin estos
    // cuatro campos, igual que el backend ya los ignora en ese caso.
    let numeroCompra = '';
    let totalCompra = 0;
    let fechaCompra = '';
    let horaCompra = '';

    if (ordenesCompraHabilitado) {
      numeroCompra = els.numeroCompraInput.value.trim();
      totalCompra = obtenerValorNumerico(els.totalCompraInput);
      fechaCompra = els.fechaCompraInput.value.trim();
      horaCompra = els.horaCompraInput.value.trim();

      if (!numeroCompra) {
        document.getElementById('error-ticket-numero-compra').textContent = 'El número de venta es obligatorio.';
        return;
      }
      if (!Number.isFinite(totalCompra) || totalCompra <= 0) {
        document.getElementById('error-ticket-total-compra').textContent = 'Captura el total, tal como aparece en tu correo de confirmación.';
        return;
      }
      if (!/^\d{2}\/[a-záéíóúñ]{3}\/\d{4}$/i.test(fechaCompra)) {
        document.getElementById('error-ticket-fecha-compra').textContent = 'Usa el formato dd/mmm/aaaa (ej. 24/jul/2026).';
        return;
      }
      if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(horaCompra)) {
        document.getElementById('error-ticket-hora-compra').textContent = 'Usa el formato HH:mm:ss (ej. 09:30:45).';
        return;
      }
    }

    if (usoCfdiObligatorio && !els.usoCfdiSelect.value) {
      document.getElementById('error-ticket-uso-cfdi').textContent = 'Selecciona un Uso de CFDI.';
      return;
    }
    if (tipoPagoObligatorio && !els.tipoPagoSelect.value) {
      document.getElementById('error-ticket-tipo-pago').textContent = 'Selecciona un tipo de pago.';
      return;
    }
    const tipoPagoOtro = els.tipoPagoOtroInput.value.trim();
    if (els.tipoPagoSelect.value === 'otro' && !tipoPagoOtro) {
      document.getElementById('error-ticket-tipo-pago-otro').textContent = 'Especifica el tipo de pago.';
      return;
    }
    if (comentariosObligatorio && !els.comentariosInput.value.trim()) {
      document.getElementById('error-ticket-comentarios').textContent = 'Este campo es obligatorio.';
      return;
    }

    const formData = new FormData();
    formData.append('imagen', archivoSeleccionado);
    if (ordenesCompraHabilitado) {
      formData.append('numero_compra', numeroCompra);
      formData.append('total_compra', String(totalCompra));
      formData.append('fecha_compra', fechaCompra);
      formData.append('hora_compra', horaCompra);
    }
    formData.append('uso_cfdi', els.usoCfdiSelect.value);
    formData.append('tipo_pago', els.tipoPagoSelect.value);
    formData.append('tipo_pago_otro', els.tipoPagoSelect.value === 'otro' ? tipoPagoOtro : '');
    formData.append('comentarios', els.comentariosInput.value.trim());

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/tickets`);
    xhr.withCredentials = true;

    setSubiendoLoading(true);
    els.progressWrap.hidden = false;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        els.progressBar.style.width = `${pct}%`;
        els.progressPercent.textContent = `${pct}%`;
      }
    });

    xhr.onload = () => {
      setSubiendoLoading(false);
      els.progressWrap.hidden = true;
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) { /* noop */ }

      if (xhr.status === 401) {
        window.location.href = urlPagina('login');
        return;
      }
      if (xhr.status === 201) {
        els.folioGenerado.textContent = data.folio;
        goToStep('confirmacion');
      } else if (data.codigo === 'SIN_CONSTANCIA') {
        // Mismo caso que verificarConstancia() ya cubre al cargar la
        // página, pero puede pasar también aquí (ej. si esa consulta
        // falló por una desconexión momentánea, o si el cliente borró su
        // constancia entre que cargó la página y que envió el ticket). Un
        // toast que desaparece solo, sin botón, no le da al cliente una
        // salida clara — se muestra el mismo modal bloqueante con el
        // botón "Subir constancia", en vez de solo avisar el error.
        els.sinConstanciaOverlay.hidden = false;
        bloquearFormularioTicket();
      } else if (data.codigo === 'COMPRA_NO_ENCONTRADA') {
        // Ventana emergente en vez de un texto inline: es un error que
        // detiene por completo el envío (no una corrección menor de un
        // campo), así que amerita la atención completa del cliente antes
        // de que siga intentando — mismo criterio ya usado para "sin
        // constancia".
        abrirModalVerificacionCompra(
          data.error || 'No se encuentra registrada la venta para facturar.',
          'Verifica el No. Venta, la fecha, la hora y el total, tal como te llegaron en tu correo de confirmación de venta.'
        );
      } else if (data.codigo === 'COMPRA_YA_FACTURADA') {
        abrirModalVerificacionCompra(
          data.error || 'Esa venta ya fue facturada.',
          'Cada venta solo se puede facturar una vez. Si crees que esto es un error, contacta a tu administrador.'
        );
      } else if (data.codigo === 'PAGO_PENDIENTE') {
        abrirModalVerificacionCompra(
          data.error || 'Esta venta tiene saldo pendiente por cobrar. No se puede facturar hasta liquidar el pago completo.',
          'En cuanto se registre el pago completo de esta venta, podrás subir tu ticket para facturarla.'
        );
      } else {
        showToast(data.error || 'No se pudo subir tu ticket.', true);
      }
    };

    xhr.onerror = () => {
      setSubiendoLoading(false);
      els.progressWrap.hidden = true;
      showToast('No se pudo conectar con el servidor.', true);
    };

    xhr.send(formData);
  });

  els.btnOtroTicket.addEventListener('click', () => {
    archivoSeleccionado = null;
    els.inputImagen.value = '';
    els.usoCfdiSelect.value = '';
    els.tipoPagoSelect.value = '';
    els.comentariosInput.value = '';
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    els.dropzoneEmpty.hidden = false;
    els.dropzonePreview.hidden = true;
    els.errorImagen.textContent = '';
    goToStep('subir');
  });

  function poblarUsoCfdi(usos) {
    els.usoCfdiSelect.querySelectorAll('option:not([value=""])').forEach((op) => op.remove());
    usos.forEach((uso) => {
      const option = document.createElement('option');
      option.value = uso.clave;
      option.textContent = `${uso.clave} - ${uso.descripcion}`;
      els.usoCfdiSelect.appendChild(option);
    });
  }

  // Avisa si el RFC de la sesión todavía no tiene una constancia de
  // Avisa (y bloquea) si el RFC de la sesión todavía no tiene una
  // constancia de situación fiscal subida — sin ella, no hay correo al que
  // avisarle cuando la factura de este ticket esté lista, ni datos con
  // los que facturar. El backend también rechaza el envío en este caso
  // (ver POST /api/tickets) — este aviso en el frontend es para que el
  // cliente lo sepa ANTES de llenar todo el formulario, no la única
  // barrera. El modal no tiene forma de cerrarse sin navegar a otra
  // página (ni botón "continuar", ni clic afuera) — la única salida es
  // subir la constancia o volver al tablero. También se deshabilita el
  // formulario mientras tanto, para que alguien navegando con teclado no
  // pueda "saltarse" el modal con Tab y llegar a los campos de abajo.
  async function verificarConstancia() {
    try {
      const res = await fetch(`${API_BASE}/registro/existe`, { credentials: 'include' });
      if (!res.ok) return; // si falla la consulta, no se interrumpe el flujo de subir el ticket
      const data = await res.json();
      if (!data.existe) {
        els.sinConstanciaOverlay.hidden = false;
        bloquearFormularioTicket();
      }
    } catch (err) {
      // Sin conexión momentánea: se deja pasar sin el aviso, mejor que bloquear el formulario.
    }
  }

  // ---------- Ventana emergente: venta no encontrada / ya facturada ----------
  // Un solo modal reutilizable para ambos casos (título y mensaje se
  // ajustan dinámicamente) — conceptualmente son el mismo tipo de aviso:
  // "no podemos continuar con esta venta", solo cambia el motivo.

  function abrirModalVerificacionCompra(titulo, mensaje) {
    els.verificacionCompraTitle.textContent = titulo;
    els.verificacionCompraMensaje.textContent = mensaje;
    els.verificacionCompraOverlay.hidden = false;
    els.btnVerificacionCompraCerrar.focus();
  }

  function cerrarModalVerificacionCompra() {
    els.verificacionCompraOverlay.hidden = true;
    // Devuelve el foco al primer campo de verificación, para que el
    // cliente pueda corregir de inmediato sin tener que buscarlo.
    els.numeroCompraInput.focus();
  }

  els.btnVerificacionCompraCerrar.addEventListener('click', cerrarModalVerificacionCompra);
  els.verificacionCompraOverlay.addEventListener('click', (e) => {
    if (e.target === els.verificacionCompraOverlay) cerrarModalVerificacionCompra();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.verificacionCompraOverlay.hidden) {
      cerrarModalVerificacionCompra();
    }
  });

  function bloquearFormularioTicket() {
    els.numeroCompraInput.disabled = true;
    els.totalCompraInput.disabled = true;
    els.fechaCompraInput.disabled = true;
    els.horaCompraInput.disabled = true;
    els.usoCfdiSelect.disabled = true;
    els.tipoPagoSelect.disabled = true;
    els.tipoPagoOtroInput.disabled = true;
    els.comentariosInput.disabled = true;
    els.inputImagen.disabled = true;
    els.btnSubirTicket.disabled = true;
    els.dropzone.setAttribute('aria-disabled', 'true');
    els.dropzone.tabIndex = -1;
  }

  (async function init() {
    const rfc = await requireSession();
    if (!rfc) return;

    verificarConstancia();

    try {
      const [configRes, catalogoRes] = await Promise.all([
        fetch(`${API_BASE}/config/campos-obligatorios`),
        fetch(`${API_BASE}/catalogos/uso-cfdi`),
      ]);
      if (configRes.ok) {
        const config = await configRes.json();
        ordenesCompraHabilitado = Boolean(config.ordenes_compra_habilitado);
        // Con "Ventas" desactivada desde el panel, toda la
        // sección de verificación se oculta por completo — el ticket se
        // puede enviar sin estos cuatro campos (ver el submit handler
        // más abajo, donde se saltan tanto la validación como el envío
        // de estos valores al servidor).
        els.compraVerificacionSeccion.hidden = !ordenesCompraHabilitado;
        usoCfdiObligatorio = Boolean(config.uso_cfdi);
        els.usoCfdiMark.textContent = usoCfdiObligatorio ? '*' : '(opcional)';
        els.usoCfdiMark.className = `field-mark ${usoCfdiObligatorio ? 'required' : 'optional'}`;
        tipoPagoObligatorio = Boolean(config.tipo_pago);
        els.tipoPagoMark.textContent = tipoPagoObligatorio ? '*' : '(opcional)';
        els.tipoPagoMark.className = `field-mark ${tipoPagoObligatorio ? 'required' : 'optional'}`;
        comentariosObligatorio = Boolean(config.comentarios);
        els.comentariosMark.textContent = comentariosObligatorio ? '*' : '(opcional)';
        els.comentariosMark.className = `field-mark ${comentariosObligatorio ? 'required' : 'optional'}`;
      }
      if (catalogoRes.ok) {
        const catalogo = await catalogoRes.json();
        poblarUsoCfdi(catalogo.usos || []);
      }
    } catch (err) {
      // Si falla, el campo se queda opcional y sin opciones extra; el resto
      // del formulario (imagen del ticket) sigue funcionando con normalidad.
    }
  })();
})();
