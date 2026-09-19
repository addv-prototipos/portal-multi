(() => {
  'use strict';

  // Multi-tenant (segmento 4, ver PROJECT_STATE.md): csf.html carga
  // portal.js antes que este archivo, así que se reutiliza su detección
  // de tenant en vez de duplicarla una tercera vez.
  const { API_BASE } = window.Portal;

  const state = {
    datos: null,
    archivo: null,
    confirmarReemplazo: false,
  };

  const els = {
    steps: document.querySelectorAll('.step'),
    panels: {
      1: document.getElementById('panel-1'),
      2: document.getElementById('panel-2'),
      3: document.getElementById('panel-3'),
    },
    formDatos: document.getElementById('form-datos'),
    rfcInput: document.getElementById('rfc'),
    headerSesion: document.getElementById('app-header-sesion'),
    headerRfcLabel: document.getElementById('portal-user-label'),
    dropzone: document.getElementById('dropzone'),
    inputArchivo: document.getElementById('input-archivo'),
    dropzoneEmpty: document.getElementById('dropzone-empty'),
    dropzoneFile: document.getElementById('dropzone-file'),
    fileName: document.getElementById('file-name'),
    fileSize: document.getElementById('file-size'),
    btnRemoveFile: document.getElementById('btn-remove-file'),
    errorArchivo: document.getElementById('error-archivo'),
    btnBack1: document.getElementById('btn-back-1'),
    btnSubmit: document.getElementById('btn-submit'),
    progressWrap: document.getElementById('progress-wrap'),
    progressBar: document.getElementById('progress-bar'),
    progressPercent: document.getElementById('progress-percent'),
    mensajeConfirmacion: document.getElementById('mensaje-confirmacion'),
    btnIrInicio: document.getElementById('btn-ir-inicio'),
    modalOverlay: document.getElementById('modal-overlay'),
    btnModalCancelar: document.getElementById('btn-modal-cancelar'),
    btnModalConfirmar: document.getElementById('btn-modal-confirmar'),
    previewNombre: document.getElementById('preview-nombre'),
    previewTipo: document.getElementById('preview-tipo'),
    previewRfcRow: document.getElementById('preview-rfc-row'),
    previewRfc: document.getElementById('preview-rfc'),
    previewArchivo: document.getElementById('preview-archivo'),
    previewFecha: document.getElementById('preview-fecha'),
    toast: document.getElementById('toast'),
    maxSizeLabel: document.getElementById('max-size-label'),
  };

  let maxFileSizeMb = 5;

  let redirectTimer = null;
  function irAlInicio() {
    if (redirectTimer) { clearTimeout(redirectTimer); redirectTimer = null; }
    const destino = (window.Portal && typeof window.Portal.urlPagina === 'function')
      ? window.Portal.urlPagina('dashboard')
      : 'dashboard.html';
    window.location.href = destino;
  }

  // Configuracion de campos obligatorios: se sobreescribe con lo que
  // devuelva el servidor al iniciar. Estos son los valores por defecto
  // (los mismos que usa el backend) por si la consulta inicial falla.
  let camposObligatorios = {
    tipo_persona: true,
    rfc: false,
  };

  // ---------- Utilidades ----------

  function showToast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle('is-error', isError);
    els.toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { els.toast.hidden = true; }, 4500);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function setFieldError(fieldId, message) {
    const errorEl = document.getElementById(`error-${fieldId}`);
    const fieldEl = errorEl ? errorEl.closest('.field') : null;
    if (errorEl) errorEl.textContent = message || '';
    if (fieldEl) fieldEl.classList.toggle('has-error', Boolean(message));
  }

  function clearFormErrors() {
    ['tipo_persona', 'rfc', 'email'].forEach((id) => setFieldError(id, ''));
  }

  // Aplica en el formulario que campos son obligatorios: actualiza el
  // texto "*"/"(opcional)" junto a cada etiqueta y el atributo `required`
  // nativo del input, para que coincida con la validación del backend.
  function aplicarCamposObligatorios(config) {
    camposObligatorios = { ...camposObligatorios, ...config };

    const marcaTipo = document.getElementById('mark-tipo_persona');
    marcaTipo.textContent = camposObligatorios.tipo_persona ? '*' : '(opcional)';
    marcaTipo.className = `field-mark ${camposObligatorios.tipo_persona ? 'required' : 'optional'}`;
    document.querySelectorAll('input[name="tipo_persona"]').forEach((el) => {
      el.required = camposObligatorios.tipo_persona;
    });

    const marcaRfc = document.getElementById('mark-rfc');
    marcaRfc.textContent = camposObligatorios.rfc ? '*' : '(opcional)';
    marcaRfc.className = `field-mark ${camposObligatorios.rfc ? 'required' : 'optional'}`;
    document.getElementById('rfc').required = camposObligatorios.rfc;
  }

  function goToStep(stepNumber) {
    Object.entries(els.panels).forEach(([num, panel]) => {
      panel.classList.toggle('is-active', Number(num) === stepNumber);
    });
    els.steps.forEach((step) => {
      const num = Number(step.dataset.step);
      step.classList.toggle('is-active', num === stepNumber);
      step.classList.toggle('is-done', num < stepNumber);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Paso 1: Validación de datos ----------

  function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validarRFC(rfc) {
    if (!rfc) return true;
    return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc.trim());
  }

  els.formDatos.addEventListener('submit', (e) => {
    e.preventDefault();
    clearFormErrors();

    const formData = new FormData(els.formDatos);
    // FormData omite el valor de un radio deshabilitado aunque este
    // checked (caso: tipo_persona precargado de la Constancia, punto 241)
    // — se recupera directo del DOM para no perder esa seleccion.
    const radioChecked = document.querySelector('input[name="tipo_persona"]:checked');
    const tipoPersona = String(formData.get('tipo_persona') || (radioChecked ? radioChecked.value : ''));
    const rfc = String(formData.get('rfc') || '').trim();
    const email = String(formData.get('email') || '').trim();

    let valid = true;

    if (camposObligatorios.tipo_persona && !tipoPersona) {
      setFieldError('tipo_persona', 'Selecciona una opción.');
      valid = false;
    }
    if (!email || !validarEmail(email)) {
      setFieldError('email', 'Ingresa un correo electrónico válido.');
      valid = false;
    }
    if (rfc && !validarRFC(rfc)) {
      setFieldError('rfc', 'El formato del RFC no es válido.');
      valid = false;
    } else if (camposObligatorios.rfc && !rfc) {
      setFieldError('rfc', 'El RFC es obligatorio.');
      valid = false;
    }

    if (!valid) return;

    state.datos = { tipo_persona: tipoPersona, rfc, email };
    goToStep(2);
  });

  // ---------- Paso 2: Subida de archivo ----------

  const ALLOWED_EXT = ['.pdf'];
  const ALLOWED_MIME = ['application/pdf'];

  els.dropzone.addEventListener('click', () => els.inputArchivo.click());
  els.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.inputArchivo.click();
    }
  });

  ['dragover', 'dragenter'].forEach((evt) => {
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove('is-dragover');
    });
  });
  els.dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  });

  els.inputArchivo.addEventListener('change', () => {
    const file = els.inputArchivo.files && els.inputArchivo.files[0];
    if (file) handleFileSelected(file);
  });

  function handleFileSelected(file) {
    els.errorArchivo.textContent = '';

    const ext = `.${file.name.split('.').pop().toLowerCase()}`;
    if (!ALLOWED_EXT.includes(ext) || !ALLOWED_MIME.includes(file.type)) {
      els.errorArchivo.textContent = 'Formato no permitido. Solo se acepta PDF.';
      return;
    }
    if (file.size > maxFileSizeMb * 1024 * 1024) {
      els.errorArchivo.textContent = `El archivo excede el tamaño máximo de ${maxFileSizeMb} MB.`;
      return;
    }

    state.archivo = file;
    els.fileName.textContent = file.name;
    els.fileSize.textContent = formatBytes(file.size);
    els.dropzoneEmpty.hidden = true;
    els.dropzoneFile.hidden = false;
  }

  els.btnRemoveFile.addEventListener('click', (e) => {
    e.stopPropagation();
    state.archivo = null;
    els.inputArchivo.value = '';
    els.dropzoneEmpty.hidden = false;
    els.dropzoneFile.hidden = true;
  });

  els.btnBack1.addEventListener('click', () => goToStep(1));

  els.btnSubmit.addEventListener('click', async () => {
    if (!state.archivo) {
      els.errorArchivo.textContent = 'Selecciona un archivo antes de continuar.';
      return;
    }
    await enviarRegistro(false);
  });

  function formatFecha(fechaInput) {
    if (!fechaInput) return '—';
    const texto = String(fechaInput);
    // Ver la nota equivalente en admin.js: el backend genera fechas en dos
    // formatos distintos según el punto del código, y ambos deben soportarse.
    const d = texto.endsWith('Z') ? new Date(texto) : new Date(texto.replace(' ', 'T') + 'Z');
    if (Number.isNaN(d.getTime())) return fechaInput;

    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();

    let horas = d.getHours();
    const minutos = String(d.getMinutes()).padStart(2, '0');
    const ampm = horas >= 12 ? 'PM' : 'AM';
    horas = horas % 12;
    if (horas === 0) horas = 12;
    const horasStr = String(horas).padStart(2, '0');

    return `${dia}/${mes}/${anio} ${horasStr}:${minutos} ${ampm}`;
  }

  function tipoPersonaLabel(tipo) {
    if (tipo === 'fisica') return 'Persona Física';
    if (tipo === 'moral') return 'Persona Moral';
    return '—';
  }

  async function mostrarModalConDatosPrevios(email, rfc) {
    // Antes de pedir confirmación de reemplazo, mostramos los datos y el
    // nombre del documento que ya estaban registrados con este RFC (o con
    // este correo, si no se capturó RFC). El backend busca por RFC primero
    // y cae de vuelta al correo, igual que la validación de duplicados.
    try {
      const params = new URLSearchParams();
      if (rfc) params.set('rfc', rfc);
      if (email) params.set('email', email);
      const res = await fetch(`${API_BASE}/registro/buscar?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.existe && data.registro) {
          const r = data.registro;
          els.previewNombre.textContent = r.nombre || '—';
          els.previewTipo.textContent = tipoPersonaLabel(r.tipo_persona);
          if (r.rfc) {
            els.previewRfc.textContent = r.rfc;
            els.previewRfcRow.hidden = false;
          } else {
            els.previewRfcRow.hidden = true;
          }
          els.previewArchivo.textContent = r.archivo_nombre_original || '—';
          els.previewFecha.textContent = formatFecha(r.actualizado_en);
        }
      }
    } catch (_) {
      // Si la consulta falla, igual mostramos el modal, solo sin el detalle previo.
    }
    els.modalOverlay.hidden = false;
  }

  els.btnModalCancelar.addEventListener('click', () => {
    els.modalOverlay.hidden = true;
  });
  els.btnModalConfirmar.addEventListener('click', async () => {
    els.modalOverlay.hidden = true;
    await enviarRegistro(true);
  });

  function enviarRegistro(confirmarReemplazo) {
    return new Promise((resolve) => {
      // Si por alguna razón el archivo o los datos no están disponibles
      // (por ejemplo, el usuario recargó la página o perdió el estado),
      // evitamos el crash y lo regresamos al paso 1 en vez de lanzar un error.
      if (!state.archivo) {
        showToast('Selecciona un archivo antes de enviar.', true);
        goToStep(2);
        resolve();
        return;
      }
      // Construimos el FormData directamente desde el formulario del DOM
      // (que permanece montado aunque el panel esté oculto), en lugar de
      // depender de una copia en `state.datos` que podría no existir.
      const formData = new FormData(els.formDatos);
      if (!formData.get('email')) {
        showToast('Tus datos de facturación no están disponibles. Vuelve a completarlos.', true);
        goToStep(1);
        resolve();
        return;
      }
      formData.append('archivo', state.archivo);
      formData.append('confirmar_reemplazo', String(confirmarReemplazo));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/registro`);

      els.progressWrap.hidden = false;
      els.btnSubmit.disabled = true;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          els.progressBar.style.width = `${pct}%`;
          els.progressPercent.textContent = `${pct}%`;
        }
      });

      // El envío puede terminar antes de que el servidor responda: ahora
      // valida el contenido del PDF (busca datos del SAT), lo cual toma
      // un momento extra. Este aviso evita que parezca que se congeló.
      xhr.upload.addEventListener('load', () => {
        els.progressBar.style.width = '100%';
        els.progressPercent.textContent = 'Verificando…';
      });

      xhr.onload = () => {
        els.btnSubmit.disabled = false;
        let data = {};
        try { data = JSON.parse(xhr.responseText || '{}'); } catch (_) { /* noop */ }

        if (xhr.status === 200) {
          els.mensajeConfirmacion.textContent = data.mensaje || 'Tu información fue registrada correctamente.';
          goToStep(3);
          if (redirectTimer) clearTimeout(redirectTimer);
          redirectTimer = setTimeout(irAlInicio, 1800);
        } else if (xhr.status === 409 && data.error === 'DUPLICADO') {
          const email = String(formData.get('email') || '').trim();
          const rfc = String(formData.get('rfc') || '').trim();
          mostrarModalConDatosPrevios(email, rfc);
        } else {
          showToast(data.mensaje || data.error || 'Ocurrió un error al enviar tu información.', true);
        }
        els.progressWrap.hidden = true;
        els.progressBar.style.width = '0%';
        els.progressPercent.textContent = '0%';
        resolve();
      };

      xhr.onerror = () => {
        els.btnSubmit.disabled = false;
        els.progressWrap.hidden = true;
        showToast('No se pudo conectar con el servidor. Intenta de nuevo.', true);
        resolve();
      };

      xhr.send(formData);
    });
  }

  // ---------- Paso 3: Redirección al inicio ----------
  if (els.btnIrInicio) {
    els.btnIrInicio.addEventListener('click', () => irAlInicio());
  }

  // ---------- Inicialización ----------

  async function init() {
    const health = fetch(`${API_BASE}/health`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

    const config = fetch(`${API_BASE}/config/campos-obligatorios`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

    // Si el usuario llegó aquí con una sesión activa (por ejemplo, desde el
    // tablero), se precarga y bloquea el RFC con el de su sesión — así
    // solo puede generar la constancia con el RFC con el que inició
    // sesión. Si no hay sesión, el formulario funciona exactamente igual
    // que antes (acceso público, sin RFC bloqueado), por retrocompatibilidad.
    const sesion = fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

    const [healthData, configData, sesionData] = await Promise.all([health, config, sesion]);

    if (sesionData && sesionData.rfc) {
      els.rfcInput.value = sesionData.rfc;
      els.rfcInput.readOnly = true;
      els.rfcInput.classList.add('is-bloqueado');
      els.headerSesion.hidden = false;
      els.headerRfcLabel.textContent = sesionData.rfc;
      // 241 — precargar tipo_persona de constancia existente y deshabilitar radio
      try {
        const regRes = await fetch(`${API_BASE}/registro/buscar?rfc=${encodeURIComponent(sesionData.rfc)}`);
        if (regRes.ok) {
          const regData = await regRes.json();
          if (regData.existe && regData.registro && regData.registro.tipo_persona) {
            const tipo = regData.registro.tipo_persona;
            const radio = document.querySelector(`input[name="tipo_persona"][value="${tipo}"]`);
            if (radio) radio.checked = true;
            document.querySelectorAll('input[name="tipo_persona"]').forEach((r) => { r.disabled = true; });
            const hint = document.getElementById('csf-tipo-hint');
            if (hint) hint.hidden = false;
          }
        }
      } catch (_) { /* no bloquea */ }
    }

    if (healthData && healthData.maxFileSizeMb) {
      maxFileSizeMb = healthData.maxFileSizeMb;
      els.maxSizeLabel.textContent = String(maxFileSizeMb);
    }

    // Si la consulta falla, el formulario conserva los valores por defecto
    // definidos arriba (los mismos que usa el backend).
    if (configData) {
      aplicarCamposObligatorios(configData);
    } else {
      aplicarCamposObligatorios(camposObligatorios);
    }
  }

  init();
})();
