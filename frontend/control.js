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
    btnMenuMovil: document.getElementById('btn-control-menu-movil'),
    menuMovil: document.getElementById('control-menu-movil'),
    authAnio: document.getElementById('auth-anio-control'),
    credOverlay: document.getElementById('control-cred-modal-overlay'),
    credSubtitulo: document.getElementById('control-cred-modal-subtitulo'),
    credLista: document.getElementById('control-cred-lista'),
    credNuevaWrap: document.getElementById('control-cred-nueva-wrap'),
    credUsuario: document.getElementById('control-cred-usuario'),
    credPassword: document.getElementById('control-cred-password'),
    credClave: document.getElementById('control-cred-clave'),
    credCurl: document.getElementById('control-cred-curl'),
    credCurlClave: document.getElementById('control-cred-curl-clave'),
    credSwaggerUrl: document.getElementById('control-cred-swagger-url'),
    credSwaggerLink: document.getElementById('control-cred-swagger-link'),
    credSwaggerControlLink: document.getElementById('control-cred-swagger-control-link'),
    credError: document.getElementById('control-cred-error'),
    credBtnGenerar: document.getElementById('control-cred-btn-generar'),
    credBtnRotar: document.getElementById('control-cred-btn-rotar'),
    credBtnRevocar: document.getElementById('control-cred-btn-revocar'),
    credBtnCerrar: document.getElementById('control-cred-btn-cerrar'),
    credBtnCopiarUsuario: document.getElementById('control-cred-btn-copiar-usuario'),
    credBtnCopiarPass: document.getElementById('control-cred-btn-copiar-pass'),
    credBtnCopiarClave: document.getElementById('control-cred-btn-copiar-clave'),
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
    intakeMarca: document.getElementById('control-intake-marca'),
    intakeLogo: document.getElementById('control-intake-logo'),
    editarOverlay: document.getElementById('control-editar-modal-overlay'),
    formEditar: document.getElementById('control-form-editar'),
    editarEmpresa: document.getElementById('control-editar-modal-empresa'),
    editarNombre: document.getElementById('control-editar-nombre'),
    editarMarca: document.getElementById('control-editar-marca'),
    editarLogo: document.getElementById('control-editar-logo'),
    editarLogoActual: document.getElementById('control-editar-logo-actual'),
    editarSlug: document.getElementById('control-editar-slug'),
    editarSlugSwitch: document.getElementById('control-editar-slug-switch'),
    editarSlugHint: document.getElementById('control-editar-slug-hint'),
  editarEmail: document.getElementById('control-editar-email'),
  editarNotas: document.getElementById('control-editar-notas'),
  btnToggleFiscalEditar: document.getElementById('control-btn-toggle-fiscal-editar'),
  editarFiscalBody: document.getElementById('control-editar-fiscal-body'),
  btnToggleTemaEditar: document.getElementById('control-btn-toggle-tema-editar'),
  temaBody: document.getElementById('control-tema-body'),
  temaPreview: document.getElementById('control-tema-preview'),
  temaFavicon: document.getElementById('control-tema-favicon'),
  temaFaviconActual: document.getElementById('control-tema-favicon-actual'),
  temaError: document.getElementById('error-control-tema'),
  btnTemaRestablecer: document.getElementById('control-btn-tema-restablecer'),
  editarRfc: document.getElementById('control-editar-rfc'),
    editarRazonSocial: document.getElementById('control-editar-razon-social'),
    editarRegimenFiscal: document.getElementById('control-editar-regimen-fiscal'),
    editarTipoPersona: document.getElementById('control-editar-tipo-persona'),
    editarClaveSat: document.getElementById('control-editar-clave-sat'),
    editarLinkSat: document.getElementById('control-editar-link-sat'),
    editarCorreoReportes: document.getElementById('control-editar-correo-reportes'),
    editarError: document.getElementById('control-editar-error'),
    btnEditarCancelar: document.getElementById('control-btn-editar-cancelar'),
    btnEditarGuardar: document.getElementById('control-btn-editar-guardar'),
    btnEditarGuardarLabel: document.getElementById('control-btn-editar-guardar-label'),
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

      // Iconos compactos 30×30 con tooltip (mismo patrón que admin Usuarios — PROJECT_STATE.md:78)
      if (t.estado === 'activo') {
        contenedorAcciones.appendChild(
          crearBotonAccion('btn-icono-accion', 'Suspender', 'M19 14v-4M5 14v-4M12 3v18', () =>
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
          crearBotonAccion('btn-icono-accion', 'Reactivar', 'M5 12h14M12 5l7 7-7 7', () =>
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
          crearBotonAccion('btn-icono-accion btn-icono-accion-peligro', 'Dar de baja', 'M19 7l-8.5 8.5-5-5', () =>
            confirmarAccion({
              titulo: '¿Dar de baja este tenant?',
              mensaje: `"${t.nombre_empresa}" (${t.slug}) dejará de ser accesible. No se borra su base de datos ni sus archivos — puedes reactivarlo después desde aquí mismo.`,
              textoBoton: 'Dar de baja',
              onConfirmar: () => ejecutarAccion(t.slug, 'baja'),
            })
          )
        );
      }

      contenedorAcciones.appendChild(
        crearBotonAccion('btn-icono-accion', 'Editar', 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z', () => abrirEdicion(t))
      );

      // Credenciales API (para uso en Swagger y consumo directo) — especifica para uso de las APIs por empresa
      contenedorAcciones.appendChild(
        crearBotonAccion('btn-icono-accion', 'Credenciales API', 'M12 11V9a3 3 0 00-6 0v2m-3 0h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zM12 15v2', () => abrirCredenciales(t))
      );

      celdaAcciones.appendChild(contenedorAcciones);
      els.tableBody.appendChild(tr);
    });
  }

  function crearBotonAccion(clase, texto, iconoPath, onClick) {
    // Soporte dual: crearBotonAccion('btn-editar','Editar',fn) viejo → icono fallback
    if (typeof iconoPath === 'function') { onClick = iconoPath; iconoPath = 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z'; }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = clase;
    btn.setAttribute('data-tooltip', texto);
    btn.setAttribute('aria-label', texto);
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconoPath}"/></svg>`;
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
      // Logo de marca (opcional): se lee como base64 y se manda junto con
      // el alta; el backend de control lo reenvía al almacenamiento y
      // guarda la ruta pública (ver control/utils/tenantIntake.js).
      let logoBase64 = null;
      const archivoLogo = els.intakeLogo.files && els.intakeLogo.files[0];
      if (archivoLogo) {
        if (archivoLogo.size > MARCA_LOGO_MAX_MB * 1024 * 1024) {
          setFieldErrorIntake('intake-logo', `El logo excede el tamaño máximo permitido de ${MARCA_LOGO_MAX_MB} MB.`);
          els.intakeLogo.focus();
          return;
        }
        try {
          logoBase64 = await leerArchivoComoBase64(archivoLogo);
        } catch (err) {
          setFieldErrorIntake('intake-logo', err.message);
          return;
        }
      }

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
          marca: els.intakeMarca.value.trim() || null,
          logoBase64,
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

  // ---------- Modal de edición de empresa (segmento "edición") ----------

  const MARCA_LOGO_MAX_MB = 2;
  let slugActualEdicion = null;

  function leerArchivoComoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }

  function setFieldErrorEditar(id, mensaje) {
    const errorEl = document.getElementById(`error-${id}`);
    if (errorEl) errorEl.textContent = mensaje;
  }

  function limpiarErroresEditar() {
    els.editarError.textContent = '';
    els.temaError.textContent = '';
    document.querySelectorAll('#control-form-editar .field-error').forEach((el) => {
      el.textContent = '';
    });
  }

  function abrirEdicion(tenant) {
    slugActualEdicion = tenant.slug;
    limpiarErroresEditar();
    els.formEditar.reset();
    els.btnToggleFiscalEditar.setAttribute('aria-expanded', 'false');
    els.editarFiscalBody.hidden = true;
    cerrarSeccionTema();

    els.editarEmpresa.textContent = `Editando ${tenant.nombre_empresa} (${tenant.slug})`;
    els.editarNombre.value = tenant.nombre_empresa || '';
    els.editarMarca.value = tenant.marca || '';
    els.editarEmail.value = tenant.contacto_email || '';
    els.editarNotas.value = tenant.notas || '';
    els.editarRfc.value = tenant.rfc_compania || '';
    els.editarRazonSocial.value = tenant.razon_social_compania || '';
    els.editarRegimenFiscal.value = tenant.regimen_fiscal_compania || '';
    els.editarTipoPersona.value = tenant.tipo_persona_compania || '';
    els.editarClaveSat.value = tenant.clave_sat || '';
    els.editarLinkSat.value = tenant.link_codigos_sat || '';
    els.editarCorreoReportes.value = tenant.correo_reportes || '';
    els.editarSlug.value = tenant.slug;
    els.editarSlugSwitch.checked = false;
    bloquearSlugEdicion();

    els.editarLogo.value = '';
    if (tenant.marca_logo_url) {
      els.editarLogoActual.textContent = 'Este tenant ya tiene un logo cargado. Elige un archivo para reemplazarlo, o guarda sin elegir para quitarlo.';
      els.editarLogoActual.hidden = false;
    } else {
      els.editarLogoActual.textContent = '';
      els.editarLogoActual.hidden = true;
    }

    els.editarOverlay.hidden = false;
    cargarTemaEnFormulario(tenant);
    els.editarNombre.focus();
  }

  function cerrarEdicion() {
    els.editarOverlay.hidden = true;
    slugActualEdicion = null;
    cerrarSeccionTema();
  }

  // El slug se edita solo si el operador lo habilita explícitamente: al
  // activar el switch queda escribible y se muestra una advertencia
  // (migración de archivos y URLs nuevas). Al guardar, el backend migra
  // el almacenamiento y las rutas /<slug>/... y /<slug>/admin pasan a
  // responder por el slug nuevo de inmediato (nginx no necesita nada:
  // sus rutas de tenant son regex dinámicas).
  function bloquearSlugEdicion() {
    els.editarSlug.readOnly = true;
    els.editarSlugHint.textContent =
      'Define las URLs de la empresa. Solo puede cambiarse activando el switch; al guardar, los archivos se migran al slug nuevo.';
  }

  function desbloquearSlugEdicion() {
    els.editarSlug.readOnly = false;
    els.editarSlugHint.textContent =
      'Al guardar, TODOS los archivos de la empresa se migrarán al slug nuevo, el slug actual dejará de responder y las URLs cambiarán. Este cambio es irreversible.';
  }

  els.editarSlugSwitch.addEventListener('change', () => {
    if (els.editarSlugSwitch.checked) {
      desbloquearSlugEdicion();
      els.editarSlug.focus();
    } else {
      // Al desactivarlo se revierte al slug actual.
      els.editarSlug.value = slugActualEdicion || '';
      bloquearSlugEdicion();
    }
  });

  els.btnEditarCancelar.addEventListener('click', cerrarEdicion);
  els.editarOverlay.addEventListener('click', (e) => {
    if (e.target === els.editarOverlay) cerrarEdicion();
  });

  els.btnToggleFiscalEditar.addEventListener('click', () => {
    const abierto = els.btnToggleFiscalEditar.getAttribute('aria-expanded') === 'true';
    els.btnToggleFiscalEditar.setAttribute('aria-expanded', String(!abierto));
    els.editarFiscalBody.hidden = abierto;
  });

  function setEdicionLoading(isLoading) {
    els.btnEditarGuardar.disabled = isLoading;
    els.btnEditarGuardar.setAttribute('aria-busy', String(isLoading));
    els.btnEditarGuardarLabel.textContent = isLoading ? 'Guardando…' : 'Guardar cambios';
  }

  els.formEditar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    if (!slugActualEdicion) return;

    limpiarErroresEditar();

    // Misma validación del lado del cliente que el alta.
    const nombre = els.editarNombre.value.trim();
    if (!nombre) {
      setFieldErrorEditar('editar-nombre', 'El nombre de la empresa es obligatorio.');
      els.editarNombre.focus();
      return;
    }
    let slug = els.editarSlug.value.trim().toLowerCase();
    if (els.editarSlugSwitch.checked) {
      if (!slug) {
        setFieldErrorEditar('editar-slug', 'El slug es obligatorio.');
        els.editarSlug.focus();
        return;
      }
      if (!/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(slug)) {
        setFieldErrorEditar('editar-slug', 'El slug debe ser minúsculas, números y guiones (1-50 caracteres), sin empezar ni terminar en guion.');
        els.editarSlug.focus();
        return;
      }
      const SLUGS_RESERVADOS = new Set([
        'admin', 'api', 'dashboard', 'tickets', 'login', 'csf', 'mantenimiento',
        'health', 'uploads', 'static', 'assets', 'control', 'www',
        'favicon.ico', 'robots.txt',
      ]);
      if (SLUGS_RESERVADOS.has(slug)) {
        setFieldErrorEditar('editar-slug', `"${slug}" es una ruta reservada de la aplicación y no puede usarse como slug de cliente.`);
        els.editarSlug.focus();
        return;
      }
    }
    const email = els.editarEmail.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrorEditar('editar-email', 'El correo de contacto no tiene un formato válido.');
      els.editarEmail.focus();
      return;
    }
    const rfc = els.editarRfc.value.trim().toUpperCase();
    if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
      setFieldErrorEditar('editar-rfc', 'El RFC de la compañía no tiene un formato válido.');
      els.editarRfc.focus();
      return;
    }
    const claveSat = els.editarClaveSat.value.trim();
    if (claveSat && !/^\d{8}$/.test(claveSat)) {
      setFieldErrorEditar('editar-clave-sat', 'La Clave SAT debe ser exactamente 8 dígitos.');
      els.editarClaveSat.focus();
      return;
    }
    const linkSat = els.editarLinkSat.value.trim();
    if (linkSat && !/^https?:\/\/.+/i.test(linkSat)) {
      setFieldErrorEditar('editar-link-sat', 'El link de códigos SAT debe ser una URL válida (http:// o https://).');
      els.editarLinkSat.focus();
      return;
    }
    const correoReportes = els.editarCorreoReportes.value.trim();
    if (correoReportes && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoReportes)) {
      setFieldErrorEditar('editar-correo-reportes', 'El correo de reportes no tiene un formato válido.');
      els.editarCorreoReportes.focus();
      return;
    }

    setEdicionLoading(true);
    try {
      let logoBase64 = null;
      const archivoLogo = els.editarLogo.files && els.editarLogo.files[0];
      if (archivoLogo) {
        if (archivoLogo.size > MARCA_LOGO_MAX_MB * 1024 * 1024) {
          setFieldErrorEditar('editar-logo', `El logo excede el tamaño máximo permitido de ${MARCA_LOGO_MAX_MB} MB.`);
          els.editarLogo.focus();
          return;
        }
        try {
          logoBase64 = await leerArchivoComoBase64(archivoLogo);
        } catch (err) {
          setFieldErrorEditar('editar-logo', err.message);
          return;
        }
      }

      const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(slugActualEdicion)}`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreEmpresa: nombre,
          slug: els.editarSlugSwitch.checked ? slug : undefined,
          contactoEmail: email || null,
          notas: els.editarNotas.value.trim() || null,
          rfcCompania: rfc || null,
          razonSocialCompania: els.editarRazonSocial.value.trim() || null,
          regimenFiscalCompania: els.editarRegimenFiscal.value.trim() || null,
          tipoPersonaCompania: els.editarTipoPersona.value || null,
          claveSat: claveSat || null,
          linkCodigosSat: linkSat || null,
          correoReportes: correoReportes || null,
          marca: els.editarMarca.value.trim() || null,
          logoBase64: logoBase64 || null,
          quitarLogo: logoBase64 ? false : !els.editarLogoActual.hidden,
        }),
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.editarError.textContent = data.error || 'No se pudieron guardar los cambios.';
        return;
      }
      const slugFinal = data.tenant.slug;

      // Identidad visual: si el operador modificó el tema, se guarda al
      // slug FINAL (si el slug cambió, la migración del backend ya movió
      // archivos y el tema de la fila viajó con el UPDATE de edición).
      if (temaModificado) {
        const temaEnvio = construirTemaDesdeFormulario();
        const errorContraste = validarContrasteTema(temaEnvio.colores);
        if (errorContraste) {
          setFieldErrorTema(errorContraste);
          return;
        }
        let faviconBase64 = null;
        const archivoFavicon = els.temaFavicon.files && els.temaFavicon.files[0];
        if (archivoFavicon) {
          if (archivoFavicon.size > MARCA_LOGO_MAX_MB * 1024 * 1024) {
            setFieldErrorTema(`El favicon excede el tamaño máximo permitido de ${MARCA_LOGO_MAX_MB} MB.`);
            return;
          }
          try {
            faviconBase64 = await leerArchivoComoBase64(archivoFavicon);
          } catch (err) {
            setFieldErrorTema(err.message);
            return;
          }
        }
        const resTema = await fetch(
          `${API_BASE}/tenants/${encodeURIComponent(slugFinal)}/tema`,
          {
            method: 'PUT',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tema: temaEnvio,
              faviconBase64: faviconBase64 || null,
            }),
          }
        );
        if (resTema.status === 401) {
          clearSession();
          showLogin();
          return;
        }
        const dataTema = await resTema.json().catch(() => ({}));
        if (!resTema.ok) {
          setFieldErrorTema(dataTema.error || 'No se pudo guardar la identidad visual.');
          return;
        }
      }

      const slugAnterior = slugActualEdicion;
      cerrarEdicion();
      const mensaje =
        slugFinal !== slugAnterior
          ? `Empresa actualizada: el slug cambió a "${slugFinal}". Las URLs antiguas ya no responden.`
          : `Datos de "${slugFinal}" guardados.`;
      showToast(mensaje);
      cargarTenants();
    } catch (err) {
      els.editarError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setEdicionLoading(false);
    }
  });

  // ---------- Sección "Identidad visual" del modal de edición ----------
  // (segmento "Look & Feel", ver PROJECT_STATE.md punto 105): colores,
  // tipografías del catálogo, radio de esquinas y favicon del portal de
  // la empresa, guardados como tema_json en la fila del tenant. Si no se
  // toca nada, el tenant sigue con el diseño base ADDV (tema_json NULL).

  const TEMA_DEFAULT_ADDV = {
    colores: {
      bg: '#F6F4EF',
      surface: '#FFFFFF',
      border: '#E3DFD4',
      ink: '#21261F',
      inkSoft: '#5B6158',
      accent: '#0F6E5D',
      accentDark: '#0B5548',
      accentSoft: '#E4EFEC',
      warn: '#B4530C',
      warnSoft: '#FBEBDC',
      error: '#B3261E',
      errorSoft: '#FBEAE9',
    },
    tipografia: { display: 'source-serif-4', cuerpo: 'inter' },
    radio: 'md',
  };

  // clave del tema -> id del <input type="color"> en control.html
  const TEMA_INPUTS_COLOR = [
    ['bg', 'control-tema-bg'],
    ['surface', 'control-tema-surface'],
    ['border', 'control-tema-border'],
    ['ink', 'control-tema-ink'],
    ['inkSoft', 'control-tema-ink-soft'],
    ['accent', 'control-tema-accent'],
    ['accentDark', 'control-tema-accent-dark'],
    ['accentSoft', 'control-tema-accent-soft'],
    ['warn', 'control-tema-warn'],
    ['warnSoft', 'control-tema-warn-soft'],
    ['error', 'control-tema-error'],
    ['errorSoft', 'control-tema-error-soft'],
  ];

  // Familias reales (solo para el preview; el catálogo completo vive en
  // backend/utils/tenantTema.js y control/utils/tenantTema.js).
  const TEMA_FUENTES = {
    'source-serif-4': 'Source Serif 4',
    inter: 'Inter',
    lora: 'Lora',
    'playfair-display': 'Playfair Display',
    merriweather: 'Merriweather',
    'open-sans': 'Open Sans',
    roboto: 'Roboto',
    'source-sans-3': 'Source Sans 3',
  };

  // Radios por nivel (sm/md/lg), iguales a los del catálogo del backend.
  const TEMA_RADIOS = {
    sm: { sm: '4px', md: '8px', lg: '12px' },
    md: { sm: '6px', md: '10px', lg: '16px' },
    lg: { sm: '10px', md: '14px', lg: '20px' },
  };

  let temaModificado = false;

  function setFieldErrorTema(mensaje) {
    els.temaError.textContent = mensaje;
    if (mensaje) abrirSeccionTema();
  }

  function abrirSeccionTema() {
    els.btnToggleTemaEditar.setAttribute('aria-expanded', 'true');
    els.temaBody.hidden = false;
  }

  function cerrarSeccionTema() {
    els.btnToggleTemaEditar.setAttribute('aria-expanded', 'false');
    els.temaBody.hidden = true;
  }

  els.btnToggleTemaEditar.addEventListener('click', () => {
    const abierto = els.btnToggleTemaEditar.getAttribute('aria-expanded') === 'true';
    if (abierto) {
      cerrarSeccionTema();
    } else {
      abrirSeccionTema();
    }
  });

  // ---------- Contraste WCAG 2.1 AA (misma fórmula que el backend) ----------

  function luminanciaRelativa(hex) {
    const valores = [1, 3, 5].map((i) => {
      const canal = parseInt(hex.slice(i, i + 2), 16) / 255;
      return canal <= 0.03928 ? canal / 12.92 : Math.pow((canal + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * valores[0] + 0.7152 * valores[1] + 0.0722 * valores[2];
  }

  function ratioContraste(hexA, hexB) {
    const l1 = luminanciaRelativa(hexA);
    const l2 = luminanciaRelativa(hexB);
    const masClaro = Math.max(l1, l2);
    const masOscuro = Math.min(l1, l2);
    return (masClaro + 0.05) / (masOscuro + 0.05);
  }

  // Devuelve un mensaje de error si algún par de la paleta no cumple
  // contraste AA (mismos pares y umbrales que el backend), o null.
  function validarContrasteTema(colores) {
    const exige = (fondo, texto, minimo, descripcion) => {
      if (!colores[fondo] || !colores[texto]) return null;
      const ratio = ratioContraste(colores[fondo], colores[texto]);
      return ratio < minimo
        ? `${descripcion} no cumple contraste AA (${ratio.toFixed(2)}:1, mínimo ${minimo}:1).`
        : null;
    };
    return (
      exige('bg', 'ink', 4.5, 'El texto principal sobre el fondo') ||
      exige('surface', 'ink', 4.5, 'El texto principal sobre las tarjetas') ||
      exige('surface', 'inkSoft', 4.5, 'El texto secundario sobre las tarjetas') ||
      exige('bg', 'warn', 4.5, 'El texto de advertencia') ||
      exige('bg', 'error', 4.5, 'El texto de error') ||
      exige('accent', '#FFFFFF', 3, 'El texto blanco sobre los botones principales') ||
      exige('accentDark', '#FFFFFF', 3, 'El texto blanco sobre los botones oscuros') ||
      exige('surface', 'accent', 3, 'Los enlaces de color de acción') ||
      exige('accentSoft', 'accentDark', 3, 'El texto de acción sobre su fondo suave') ||
      null
    );
  }

  // ---------- Preview en vivo ----------

  function construirTemaDesdeFormulario() {
    const colores = {};
    TEMA_INPUTS_COLOR.forEach(([clave, id]) => {
      const input = document.getElementById(id);
      colores[clave] = (input && input.value) || TEMA_DEFAULT_ADDV.colores[clave];
    });
    return {
      colores,
      tipografia: {
        display: document.getElementById('control-tema-font-display').value,
        cuerpo: document.getElementById('control-tema-font-cuerpo').value,
      },
      radio: document.getElementById('control-tema-radio').value,
    };
  }

  function aplicarPreviewTema() {
    const tema = construirTemaDesdeFormulario();
    const radios = TEMA_RADIOS[tema.radio] || TEMA_RADIOS.md;
    const variables = {
      '--color-bg': tema.colores.bg,
      '--color-surface': tema.colores.surface,
      '--color-border': tema.colores.border,
      '--color-ink': tema.colores.ink,
      '--color-ink-soft': tema.colores.inkSoft,
      '--color-accent': tema.colores.accent,
      '--color-accent-dark': tema.colores.accentDark,
      '--color-accent-soft': tema.colores.accentSoft,
      '--color-warn': tema.colores.warn,
      '--color-warn-soft': tema.colores.warnSoft,
      '--color-error': tema.colores.error,
      '--color-error-soft': tema.colores.errorSoft,
      '--radius-sm': radios.sm,
      '--radius-md': radios.md,
      '--radius-lg': radios.lg,
      '--font-display': `'${TEMA_FUENTES[tema.tipografia.display] || 'Source Serif 4'}', Georgia, serif`,
      '--font-body': `'${TEMA_FUENTES[tema.tipografia.cuerpo] || 'Inter'}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
    };
    Object.entries(variables).forEach(([clave, valor]) => {
      els.temaPreview.style.setProperty(clave, valor);
    });
  }

  // ---------- Carga del tema del tenant en el formulario ----------

  function cargarTemaEnFormulario(tenant) {
    let tema = null;
    if (tenant && tenant.tema_json) {
      try {
        tema = JSON.parse(tenant.tema_json);
      } catch (err) {
        tema = null;
      }
    }
    const colores = Object.assign({}, TEMA_DEFAULT_ADDV.colores, (tema && tema.colores) || {});
    TEMA_INPUTS_COLOR.forEach(([clave, id]) => {
      const input = document.getElementById(id);
      if (input) input.value = colores[clave] || TEMA_DEFAULT_ADDV.colores[clave];
    });
    const tipografia = (tema && tema.tipografia) || {};
    document.getElementById('control-tema-font-display').value = tipografia.display || 'source-serif-4';
    document.getElementById('control-tema-font-cuerpo').value = tipografia.cuerpo || 'inter';
    document.getElementById('control-tema-radio').value = (tema && tema.radio) || 'md';
    els.temaFavicon.value = '';
    if (tema && tema.faviconUrl) {
      els.temaFaviconActual.textContent = 'Este tenant ya tiene un favicon cargado. Elige un archivo para reemplazarlo.';
      els.temaFaviconActual.hidden = false;
    } else {
      els.temaFaviconActual.textContent = '';
      els.temaFaviconActual.hidden = true;
    }
    temaModificado = false;
    aplicarPreviewTema();
  }

  // ---------- Listeners de modificación del tema ----------

  TEMA_INPUTS_COLOR.forEach(([, id]) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', () => {
      temaModificado = true;
      aplicarPreviewTema();
    });
  });

  ['control-tema-font-display', 'control-tema-font-cuerpo', 'control-tema-radio'].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('change', () => {
      temaModificado = true;
      aplicarPreviewTema();
    });
  });

  els.temaFavicon.addEventListener('change', () => {
    temaModificado = true;
  });

  // ---------- Restablecer al diseño ADDV ----------

  els.btnTemaRestablecer.addEventListener('click', () => {
    const authHeader = getAuthHeader();
    if (!authHeader || !slugActualEdicion) return;
    confirmarAccion({
      titulo: 'Restablecer identidad visual',
      mensaje:
        'La empresa volverá al diseño base de la plataforma (colores, tipografías y favicon por defecto). Esta acción no se puede deshacer.',
      textoBoton: 'Restablecer',
      onConfirmar: async () => {
        setEdicionLoading(true);
        try {
          const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(slugActualEdicion)}/tema`, {
            method: 'PUT',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ restablecer: true }),
          });
          if (res.status === 401) {
            clearSession();
            showLogin();
            return;
          }
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setFieldErrorTema(data.error || 'No se pudo restablecer la identidad visual.');
            return;
          }
          cargarTemaEnFormulario(data.tenant);
          showToast('Identidad visual restablecida al diseño base.');
        } catch (err) {
          setFieldErrorTema('No se pudo conectar con el servidor.');
        } finally {
          setEdicionLoading(false);
        }
      },
    });
  });

  // ---------- Menú móvil (mismo patrón que admin) ----------
  if (els.btnMenuMovil && els.menuMovil) {
    els.btnMenuMovil.addEventListener('click', () => {
      els.menuMovil.hidden = !els.menuMovil.hidden;
    });
    els.menuMovil.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-vista]');
      if (btn) els.menuMovil.hidden = true;
    });
  }
  if (els.authAnio) els.authAnio.textContent = String(new Date().getFullYear());

  // ---------- Credenciales API por empresa (para uso en Swagger y consumo directo) ----------
  let credTenantActual = null;
  let credActualLista = [];

  function actualizarCredCurl(usuario, password, slug, clave) {
    const base = window.location.origin;
    const url = `${base}/${slug}/api/admin/registros`;
    const curl = `curl -u "${usuario}:${password}" "${url}"`;
    if (els.credCurl) els.credCurl.textContent = curl;
    if (clave && els.credCurlClave) {
      els.credCurlClave.textContent = `curl -H "X-API-Key: ${clave}" "${url}"\n# o como cookie: curl -b "api_key=${clave}" "${url}"`;
    }
    if (els.credSwaggerUrl) els.credSwaggerUrl.textContent = `${base}/${slug}/api/...`;
    if (els.credSwaggerLink) els.credSwaggerLink.href = `${base}/api/docs/`;
    if (els.credSwaggerControlLink) els.credSwaggerControlLink.href = `${base}/api/control/docs/`;
  }

  async function cargarCredenciales() {
    if (!credTenantActual) return;
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    els.credError.textContent = '';
    try {
      const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(credTenantActual.slug)}/credenciales`, { headers: { Authorization: authHeader } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { els.credError.textContent = data.error || 'No se pudo cargar.'; return; }
      credActualLista = data.credenciales || [];
      renderCredLista();
    } catch (_) { els.credError.textContent = 'No se pudo conectar.'; }
  }

  function renderCredLista() {
    if (!els.credLista) return;
    if (credActualLista.length === 0) {
      els.credLista.innerHTML = '<p class="admin-empty" style="display:block">Sin credencial activa. Genera una para uso en Swagger/APIs.</p>';
      els.credBtnGenerar.hidden = false;
      els.credBtnRotar.hidden = true;
      els.credBtnRevocar.hidden = true;
      return;
    }
    const c = credActualLista[0];
    els.credLista.innerHTML = `<table class="admin-table" style="min-width:0"><thead><tr><th>Usuario API</th><th>Estado</th><th>Creado</th></tr></thead><tbody><tr><td><code>${escapeHtml(c.api_usuario)}</code></td><td>${c.activo ? 'Activa' : 'Revocada'}</td><td>${escapeHtml(formatFecha(c.creado_en))}</td></tr></tbody></table><p class="field-hint">Usa este usuario/password en <b>Swagger → Authorize (basicAuth)</b> o en <code>curl -u usuario:password</code> contra <code>/${escapeHtml(credTenantActual.slug)}/api/*</code>. Valida solo para esa empresa.</p>`;
    els.credBtnGenerar.hidden = true;
    els.credBtnRotar.hidden = false;
    els.credBtnRevocar.hidden = false;
  }

  function abrirCredenciales(tenant) {
    credTenantActual = tenant;
    credActualLista = [];
    els.credSubtitulo.textContent = `${tenant.nombre_empresa} (${tenant.slug}) — credencial para uso de las APIs (Basic + clave API)`;
    els.credNuevaWrap.hidden = true;
    els.credUsuario.value = '';
    els.credPassword.value = '';
    if (els.credClave) els.credClave.value = '';
    els.credError.textContent = '';
    els.credOverlay.hidden = false;
    cargarCredenciales();
  }
  function cerrarCredenciales() { els.credOverlay.hidden = true; credTenantActual = null; }
  if (els.credBtnCerrar) els.credBtnCerrar.addEventListener('click', cerrarCredenciales);
  if (els.credOverlay) els.credOverlay.addEventListener('click', (e) => { if (e.target === els.credOverlay) cerrarCredenciales(); });
  if (els.credBtnCopiarUsuario) els.credBtnCopiarUsuario.addEventListener('click', () => { if (els.credUsuario.value) { navigator.clipboard.writeText(els.credUsuario.value); showToast('Usuario copiado'); } });
  if (els.credBtnCopiarPass) els.credBtnCopiarPass.addEventListener('click', () => { if (els.credPassword.value) { navigator.clipboard.writeText(els.credPassword.value); showToast('Contraseña copiada'); } });
  if (els.credBtnCopiarClave) els.credBtnCopiarClave.addEventListener('click', () => { if (els.credClave && els.credClave.value) { navigator.clipboard.writeText(els.credClave.value); showToast('Clave API copiada'); } });

  if (els.credBtnGenerar) els.credBtnGenerar.addEventListener('click', async () => {
    const authHeader = getAuthHeader(); if (!authHeader || !credTenantActual) return;
    els.credError.textContent = '';
    try {
      const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(credTenantActual.slug)}/credenciales`, { method: 'POST', headers: { Authorization: authHeader } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { els.credError.textContent = data.error || 'No se pudo generar.'; return; }
      const c = data.credencial;
      els.credUsuario.value = c.api_usuario;
      els.credPassword.value = c.password_plano;
      if (els.credClave) els.credClave.value = c.clave_api || '';
      els.credNuevaWrap.hidden = false;
      actualizarCredCurl(c.api_usuario, c.password_plano, credTenantActual.slug, c.clave_api);
      showToast('Credencial API generada — copia la contraseña y clave ahora');
      await cargarCredenciales();
    } catch (_) { els.credError.textContent = 'No se pudo conectar.'; }
  });

  if (els.credBtnRotar) els.credBtnRotar.addEventListener('click', async () => {
    if (!credActualLista[0] || !credTenantActual) return;
    const authHeader = getAuthHeader();
    try {
      const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(credTenantActual.slug)}/credenciales/${credActualLista[0].id}/rotar`, { method: 'POST', headers: { Authorization: authHeader } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { els.credError.textContent = data.error || 'No se pudo rotar.'; return; }
      const c = data.credencial;
      els.credUsuario.value = c.api_usuario || credActualLista[0].api_usuario;
      els.credPassword.value = c.password_plano;
      if (els.credClave) els.credClave.value = c.clave_api || '';
      els.credNuevaWrap.hidden = false;
      actualizarCredCurl(els.credUsuario.value, c.password_plano, credTenantActual.slug, c.clave_api);
      showToast('Contraseña y clave rotadas — copia las nuevas');
      await cargarCredenciales();
    } catch (_) { els.credError.textContent = 'No se pudo conectar.'; }
  });

  if (els.credBtnRevocar) els.credBtnRevocar.addEventListener('click', async () => {
    if (!credActualLista[0] || !credTenantActual) return;
    if (!confirm('¿Revocar esta credencial API? Dejará de funcionar inmediatamente.')) return;
    const authHeader = getAuthHeader();
    try {
      const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(credTenantActual.slug)}/credenciales/${credActualLista[0].id}`, { method: 'DELETE', headers: { Authorization: authHeader } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { els.credError.textContent = data.error || 'No se pudo revocar.'; return; }
      showToast('Credencial revocada');
      els.credNuevaWrap.hidden = true;
      await cargarCredenciales();
    } catch (_) { els.credError.textContent = 'No se pudo conectar.'; }
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
