(() => {
  'use strict';

  // App de control (segmento 9, ver PROJECT_STATE.md) — NO es tenant-aware:
  // a diferencia de admin.js/portal.js, esta página nunca vive bajo
  // /<slug>/..., así que no hay detección de slug ni API_BASE variable.
  const API_BASE = '/api/control';
  // Clave de sessionStorage separada de 'admin_credenciales' (admin.js) —
  // una sesión de /control y una sesión de /<tenant>/admin son de
  // naturaleza distinta (cross-tenant super-only vs. una sola empresa) y
  // nunca deben mezclarse ni compartir almacenamiento.
  const SESSION_KEY = 'control_credenciales';
  const SESSION_USER_KEY = 'control_usuario';

  const els = {
    loginScreen: document.getElementById('control-login-screen'),
    dashboard: document.getElementById('control-dashboard'),
    formLogin: document.getElementById('control-form-login'),
    inputUser: document.getElementById('control-user'),
    inputPass: document.getElementById('control-pass'),
    btnTogglePass: document.getElementById('control-btn-toggle-pass'),
    loginError: document.getElementById('control-login-error'),
    btnLogin: document.getElementById('control-btn-login'),
    btnLoginLabel: document.getElementById('control-btn-login-label'),
    userLabel: document.getElementById('control-user-label'),
    btnLogout: document.getElementById('control-btn-logout'),
    btnRefresh: document.getElementById('control-btn-refresh'),
    searchInput: document.getElementById('control-search-input'),
    btnClearSearch: document.getElementById('control-btn-clear-search'),
    filtroEstado: document.getElementById('control-filtro-estado'),
    count: document.getElementById('control-count'),
    error: document.getElementById('control-error'),
    tableBody: document.getElementById('control-table-body'),
    empty: document.getElementById('control-empty'),
    toast: document.getElementById('control-toast'),
    confirmOverlay: document.getElementById('control-confirm-modal-overlay'),
    confirmTitle: document.getElementById('control-confirm-modal-title'),
    confirmMensaje: document.getElementById('control-confirm-modal-mensaje'),
    btnConfirmCancelar: document.getElementById('control-btn-confirm-cancelar'),
    btnConfirmAceptar: document.getElementById('control-btn-confirm-aceptar'),
    btnNuevaEmpresa: document.getElementById('control-btn-nueva-empresa'),
    intakeOverlay: document.getElementById('control-intake-modal-overlay'),
    formIntake: document.getElementById('control-form-intake'),
    intakeError: document.getElementById('control-intake-error'),
    btnIntakeCancelar: document.getElementById('control-btn-intake-cancelar'),
    btnIntakeGuardar: document.getElementById('control-btn-intake-guardar'),
    btnIntakeGuardarLabel: document.getElementById('control-btn-intake-guardar-label'),
    intakeNombre: document.getElementById('control-intake-nombre'),
    intakeSlug: document.getElementById('control-intake-slug'),
    intakeUrlPreview: document.getElementById('control-intake-url-preview'),
    intakeEmail: document.getElementById('control-intake-email'),
    intakeNotas: document.getElementById('control-intake-notas'),
    btnToggleFiscal: document.getElementById('control-btn-toggle-fiscal'),
    intakeFiscalBody: document.getElementById('control-intake-fiscal-body'),
    intakeRfc: document.getElementById('control-intake-rfc'),
    intakeRazonSocial: document.getElementById('control-intake-razon-social'),
    intakeRegimenFiscal: document.getElementById('control-intake-regimen-fiscal'),
    intakeTipoPersona: document.getElementById('control-intake-tipo-persona'),
    intakeClaveSat: document.getElementById('control-intake-clave-sat'),
    intakeLinkSat: document.getElementById('control-intake-link-sat'),
    intakeCorreoReportes: document.getElementById('control-intake-correo-reportes'),
  };

  function getAuthHeader() {
    const creds = sessionStorage.getItem(SESSION_KEY);
    return creds ? `Basic ${creds}` : null;
  }

  function setSession(username, password) {
    const encoded = btoa(unescape(encodeURIComponent(`${username}:${password}`)));
    sessionStorage.setItem(SESSION_KEY, encoded);
    sessionStorage.setItem(SESSION_USER_KEY, username);
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Mismo formato que admin.js formatFecha() — el backend siempre manda
  // "YYYY-MM-DD HH:MM:SS" en UTC (ver CLAUDE.md, convenciones de fechas).
  function formatFecha(fechaInput) {
    if (!fechaInput) return '—';
    const texto = String(fechaInput);
    const d = texto.endsWith('Z') ? new Date(texto) : new Date(texto.replace(' ', 'T') + 'Z');
    if (Number.isNaN(d.getTime())) return fechaInput;
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    let horas = d.getHours();
    const minutos = String(d.getMinutes()).padStart(2, '0');
    const ampm = horas >= 12 ? 'PM' : 'AM';
    horas = horas % 12 || 12;
    return `${dia}/${mes}/${anio} ${horas}:${minutos} ${ampm}`;
  }

  function showToast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle('is-error', isError);
    els.toast.hidden = false;
    clearTimeout(showToast._t);
    const duracion = Math.min(12000, Math.max(4500, message.length * 90));
    showToast._t = setTimeout(() => {
      els.toast.hidden = true;
    }, duracion);
  }

  function showLogin() {
    els.dashboard.hidden = true;
    els.loginScreen.hidden = false;
  }

  function showDashboard(usuario) {
    els.loginScreen.hidden = true;
    els.dashboard.hidden = false;
    els.userLabel.textContent = usuario;
  }

  // ---------- Mostrar/ocultar contraseña ----------

  els.btnTogglePass.addEventListener('click', () => {
    const isPassword = els.inputPass.type === 'password';
    els.inputPass.type = isPassword ? 'text' : 'password';
    els.btnTogglePass.setAttribute('aria-pressed', String(isPassword));
    els.btnTogglePass.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  // ---------- Login ----------
  // Sin ruta /control/login dedicada: GET /api/control/tenants ya exige
  // requireAdminAuth + requireAdminArea() (solo perfil "super") y responde
  // 401/403 correctamente, así que sirve como sonda de credenciales sin
  // agregar un quinto endpoint sin beneficio funcional.

  function setLoginLoading(isLoading) {
    els.btnLogin.disabled = isLoading;
    els.btnLogin.setAttribute('aria-busy', String(isLoading));
    els.btnLoginLabel.textContent = isLoading ? 'Entrando…' : 'Entrar';
  }

  els.formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.loginError.textContent = '';

    const usuario = els.inputUser.value.trim();
    const contrasena = els.inputPass.value;
    if (!usuario || !contrasena) {
      els.loginError.textContent = 'Ingresa usuario y contraseña.';
      return;
    }

    setLoginLoading(true);
    try {
      const encoded = btoa(unescape(encodeURIComponent(`${usuario}:${contrasena}`)));
      const res = await fetch(`${API_BASE}/tenants`, {
        headers: { Authorization: `Basic ${encoded}` },
      });

      if (res.status === 401) {
        els.loginError.textContent = 'Usuario o contraseña incorrectos.';
        return;
      }
      if (res.status === 403) {
        els.loginError.textContent = 'Tu cuenta no tiene perfil "super" — no puedes entrar a la app de control.';
        return;
      }
      if (!res.ok) {
        els.loginError.textContent = 'No se pudo iniciar sesión. Intenta de nuevo.';
        return;
      }

      const data = await res.json();
      setSession(usuario, contrasena);
      showDashboard(usuario);
      renderTenants(data.tenants || []);
    } catch (err) {
      els.loginError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setLoginLoading(false);
    }
  });

  els.btnLogout.addEventListener('click', () => {
    clearSession();
    els.inputPass.value = '';
    els.inputPass.type = 'password';
    els.btnTogglePass.setAttribute('aria-pressed', 'false');
    els.searchInput.value = '';
    els.btnClearSearch.hidden = true;
    els.filtroEstado.value = '';
    showLogin();
  });

  // ---------- Búsqueda / filtro ----------

  let debounceBusqueda = null;
  els.searchInput.addEventListener('input', () => {
    els.btnClearSearch.hidden = els.searchInput.value.length === 0;
    clearTimeout(debounceBusqueda);
    debounceBusqueda = setTimeout(() => cargarTenants(), 300);
  });

  els.btnClearSearch.addEventListener('click', () => {
    els.searchInput.value = '';
    els.btnClearSearch.hidden = true;
    cargarTenants();
  });

  els.filtroEstado.addEventListener('change', () => cargarTenants());
  els.btnRefresh.addEventListener('click', () => cargarTenants());

  // ---------- Cargar / renderizar tenants ----------

  async function cargarTenants() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.error.textContent = '';
    try {
      const parametros = new URLSearchParams();
      if (els.filtroEstado.value) parametros.set('estado', els.filtroEstado.value);
      if (els.searchInput.value.trim()) parametros.set('q', els.searchInput.value.trim());
      const query = parametros.toString() ? `?${parametros.toString()}` : '';

      const res = await fetch(`${API_BASE}/tenants${query}`, { headers: { Authorization: authHeader } });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        els.error.textContent = 'No se pudieron cargar los tenants.';
        return;
      }
      const data = await res.json();
      renderTenants(data.tenants || []);
    } catch (err) {
      els.error.textContent = 'No se pudo conectar con el servidor.';
    }
  }

  const ETIQUETA_ESTADO = {
    provisioning: 'Provisionando',
    activo: 'Activo',
    suspendido: 'Suspendido',
    baja: 'Baja',
  };

  function renderTenants(tenants) {
    els.count.textContent = `${tenants.length} tenant${tenants.length === 1 ? '' : 's'}`;
    els.tableBody.innerHTML = '';
    els.empty.hidden = tenants.length > 0;

    tenants.forEach((t) => {
      const tr = document.createElement('tr');
      const etiquetaEstado = ETIQUETA_ESTADO[t.estado] || t.estado;
      tr.innerHTML = `
        <td data-label="Slug"><strong>${escapeHtml(t.slug)}</strong></td>
        <td data-label="Empresa">${escapeHtml(t.nombre_empresa)}</td>
        <td data-label="Estado"><span class="estatus-badge estatus-${escapeHtml(t.estado)}">${escapeHtml(etiquetaEstado)}</span></td>
        <td data-label="Contacto">${escapeHtml(t.contacto_email) || '—'}</td>
        <td data-label="Creado">${formatFecha(t.creado_en)}</td>
        <td data-label=""></td>
      `;

      const celdaAcciones = tr.lastElementChild;
      const contenedorAcciones = document.createElement('div');
      contenedorAcciones.className = 'admin-row-actions';

      if (t.estado === 'activo') {
        contenedorAcciones.appendChild(
          crearBotonAccion('btn-eliminar', 'Suspender', () =>
            confirmarAccion({
              titulo: '¿Suspender este tenant?',
              mensaje: `"${t.nombre_empresa}" (${t.slug}) dejará de ser accesible hasta que lo reactives. No se borra ningún dato.`,
              textoBoton: 'Suspender',
              onConfirmar: () => ejecutarAccion(t.slug, 'suspender'),
            })
          )
        );
      }

      if (t.estado === 'suspendido' || t.estado === 'baja') {
        contenedorAcciones.appendChild(
          crearBotonAccion('btn-restaurar', 'Reactivar', () =>
            confirmarAccion({
              titulo: '¿Reactivar este tenant?',
              mensaje: `"${t.nombre_empresa}" (${t.slug}) volverá a ser accesible de inmediato.`,
              textoBoton: 'Reactivar',
              onConfirmar: () => ejecutarAccion(t.slug, 'reactivar'),
            })
          )
        );
      }

      if (t.estado === 'activo' || t.estado === 'suspendido') {
        contenedorAcciones.appendChild(
          crearBotonAccion('btn-eliminar-permanente', 'Dar de baja', () =>
            confirmarAccion({
              titulo: '¿Dar de baja este tenant?',
              mensaje: `"${t.nombre_empresa}" (${t.slug}) dejará de ser accesible. No se borra su base de datos ni sus archivos — puedes reactivarlo después desde aquí mismo.`,
              textoBoton: 'Dar de baja',
              onConfirmar: () => ejecutarAccion(t.slug, 'baja'),
            })
          )
        );
      }

      celdaAcciones.appendChild(contenedorAcciones);
      els.tableBody.appendChild(tr);
    });
  }

  function crearBotonAccion(clase, texto, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = clase;
    btn.textContent = texto;
    btn.addEventListener('click', onClick);
    return btn;
  }

  async function ejecutarAccion(slug, accion) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(slug)}/${accion}`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'No se pudo completar la acción.', true);
        return;
      }
      showToast(`Listo: ${slug} ahora está "${ETIQUETA_ESTADO[data.tenant.estado] || data.tenant.estado}".`);
      cargarTenants();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // ---------- Modal de confirmación genérico ----------

  let accionConfirmada = null;

  function confirmarAccion({ titulo, mensaje, textoBoton, onConfirmar }) {
    els.confirmTitle.textContent = titulo;
    els.confirmMensaje.textContent = mensaje;
    els.btnConfirmAceptar.textContent = textoBoton;
    accionConfirmada = onConfirmar;
    els.confirmOverlay.hidden = false;
  }

  function cerrarConfirmacion() {
    els.confirmOverlay.hidden = true;
    accionConfirmada = null;
  }

  els.btnConfirmCancelar.addEventListener('click', cerrarConfirmacion);

  els.btnConfirmAceptar.addEventListener('click', async () => {
    const accion = accionConfirmada;
    cerrarConfirmacion();
    if (accion) await accion();
  });

  // ---------- Modal de empresa nueva (segmento 9c) ----------

  function setFieldErrorIntake(id, mensaje) {
    const errorEl = document.getElementById(`error-${id}`);
    if (errorEl) errorEl.textContent = mensaje;
  }

  function limpiarErroresIntake() {
    els.intakeError.textContent = '';
    document.querySelectorAll('#control-form-intake .field-error').forEach((el) => {
      el.textContent = '';
    });
  }

  function abrirIntake() {
    limpiarErroresIntake();
    els.formIntake.reset();
    els.btnToggleFiscal.setAttribute('aria-expanded', 'false');
    els.intakeFiscalBody.hidden = true;
    actualizarPreviewUrls();
    els.intakeOverlay.hidden = false;
    els.intakeNombre.focus();
  }

  function cerrarIntake() {
    els.intakeOverlay.hidden = true;
  }

  els.btnNuevaEmpresa.addEventListener('click', abrirIntake);
  els.btnIntakeCancelar.addEventListener('click', cerrarIntake);
  els.intakeOverlay.addEventListener('click', (e) => {
    if (e.target === els.intakeOverlay) cerrarIntake();
  });

  els.btnToggleFiscal.addEventListener('click', () => {
    const abierto = els.btnToggleFiscal.getAttribute('aria-expanded') === 'true';
    els.btnToggleFiscal.setAttribute('aria-expanded', String(!abierto));
    els.intakeFiscalBody.hidden = abierto;
  });

  // Preview en vivo de las URLs que tendrá la empresa con el slug
  // capturado — normalizado igual que en el backend (minúsculas, espacios
  // convertidos a guiones), pero sin rechazar nada mientras se escribe.
  function normalizarSlugPreview(valor) {
    return valor
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  function actualizarPreviewUrls() {
    const slug = normalizarSlugPreview(els.intakeSlug.value);
    if (!slug) {
      els.intakeUrlPreview.textContent = '';
      return;
    }
    els.intakeUrlPreview.textContent = `tudominio.com/${slug}  ·  tudominio.com/${slug}/admin`;
  }

  els.intakeSlug.addEventListener('input', actualizarPreviewUrls);

  function setIntakeLoading(isLoading) {
    els.btnIntakeGuardar.disabled = isLoading;
    els.btnIntakeGuardar.setAttribute('aria-busy', String(isLoading));
    els.btnIntakeGuardarLabel.textContent = isLoading ? 'Registrando…' : 'Registrar solicitud';
  }

  els.formIntake.addEventListener('submit', async (e) => {
    e.preventDefault();
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    limpiarErroresIntake();

    // Validación del lado del cliente, con los mismos mensajes que el
    // servidor — para no mandar peticiones que de todos modos serían 400.
    const nombre = els.intakeNombre.value.trim();
    if (!nombre) {
      setFieldErrorIntake('intake-nombre', 'El nombre de la empresa es obligatorio.');
      els.intakeNombre.focus();
      return;
    }
    const slug = normalizarSlugPreview(els.intakeSlug.value);
    if (!slug) {
      setFieldErrorIntake('intake-slug', 'El slug es obligatorio.');
      els.intakeSlug.focus();
      return;
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(slug)) {
      setFieldErrorIntake('intake-slug', 'El slug debe ser minúsculas, números y guiones (1-50 caracteres), sin empezar ni terminar en guion.');
      els.intakeSlug.focus();
      return;
    }
    const SLUGS_RESERVADOS = new Set([
      'admin', 'api', 'dashboard', 'tickets', 'login', 'csf', 'mantenimiento',
      'health', 'uploads', 'static', 'assets', 'control', 'www',
      'favicon.ico', 'robots.txt',
    ]);
    if (SLUGS_RESERVADOS.has(slug)) {
      setFieldErrorIntake('intake-slug', `"${slug}" es una ruta reservada de la aplicación y no puede usarse como slug de cliente.`);
      els.intakeSlug.focus();
      return;
    }
    const email = els.intakeEmail.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrorIntake('intake-email', 'El correo de contacto no tiene un formato válido.');
      els.intakeEmail.focus();
      return;
    }
    const rfc = els.intakeRfc.value.trim().toUpperCase();
    if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
      setFieldErrorIntake('intake-rfc', 'El RFC de la compañía no tiene un formato válido.');
      els.intakeRfc.focus();
      return;
    }
    const claveSat = els.intakeClaveSat.value.trim();
    if (claveSat && !/^\d{8}$/.test(claveSat)) {
      setFieldErrorIntake('intake-clave-sat', 'La Clave SAT debe ser exactamente 8 dígitos.');
      els.intakeClaveSat.focus();
      return;
    }
    const linkSat = els.intakeLinkSat.value.trim();
    if (linkSat && !/^https?:\/\/.+/i.test(linkSat)) {
      setFieldErrorIntake('intake-link-sat', 'El link de códigos SAT debe ser una URL válida (http:// o https://).');
      els.intakeLinkSat.focus();
      return;
    }
    const correoReportes = els.intakeCorreoReportes.value.trim();
    if (correoReportes && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoReportes)) {
      setFieldErrorIntake('intake-correo-reportes', 'El correo de reportes no tiene un formato válido.');
      els.intakeCorreoReportes.focus();
      return;
    }

    setIntakeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tenants`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreEmpresa: nombre,
          slug,
          contactoEmail: email || null,
          notas: els.intakeNotas.value.trim() || null,
          rfcCompania: rfc || null,
          razonSocialCompania: els.intakeRazonSocial.value.trim() || null,
          regimenFiscalCompania: els.intakeRegimenFiscal.value.trim() || null,
          tipoPersonaCompania: els.intakeTipoPersona.value || null,
          claveSat: claveSat || null,
          linkCodigosSat: linkSat || null,
          correoReportes: correoReportes || null,
        }),
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.intakeError.textContent = data.error || 'No se pudo registrar la solicitud.';
        return;
      }
      cerrarIntake();
      showToast(`Solicitud de alta registrada: "${data.tenant.nombre_empresa}" (${data.tenant.slug}) en estado "Provisionando".`);
      cargarTenants();
    } catch (err) {
      els.intakeError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setIntakeLoading(false);
    }
  });

  // ---------- Inicialización ----------

  (function init() {
    const authHeader = getAuthHeader();
    if (authHeader) {
      fetch(`${API_BASE}/tenants`, { headers: { Authorization: authHeader } })
        .then((res) => {
          if (res.ok) {
            return res.json().then((data) => {
              showDashboard(sessionStorage.getItem(SESSION_USER_KEY) || 'Sesión activa');
              renderTenants(data.tenants || []);
            });
          }
          clearSession();
          showLogin();
        })
        .catch(() => showLogin());
    } else {
      showLogin();
    }
  })();
})();
