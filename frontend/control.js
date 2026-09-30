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
    shellEsqueleto: document.getElementById('control-shell-esqueleto'),
    shellEsqueletoEspera: document.getElementById('control-shell-esqueleto-espera'),
    shellEsqueletoError: document.getElementById('control-shell-esqueleto-error'),
    btnShellReintentar: document.getElementById('control-btn-shell-reintentar'),
    dashboard: document.getElementById('control-dashboard'),
    btnAbrirConocimiento: document.getElementById('btn-abrir-conocimiento'),
    btnAbrirConocimientoTopbar: document.getElementById('btn-abrir-conocimiento-topbar'),
    btnCerrarConocimiento: document.getElementById('btn-cerrar-conocimiento-modal'),
    conocimientoOverlay: document.getElementById('conocimiento-modal-overlay'),
    conocimientoSidebar: document.getElementById('conocimiento-modal-sidebar'),
    conocimientoMain: document.getElementById('conocimiento-modal-main'),
    conocimientoMainBody: document.getElementById('conocimiento-modal-main-body'),
    conocimientoBtnVolver: document.getElementById('conocimiento-modal-btn-volver'),
    conocimientoBuscar: document.getElementById('conocimiento-modal-buscar'),
    conocimientoNav: document.getElementById('conocimiento-modal-nav'),
    conocimientoNavEmpty: document.getElementById('conocimiento-modal-nav-empty'),
    conocimientoTitle: document.getElementById('conocimiento-modal-title'),
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
    filtroEmpty: document.getElementById('control-filtro-empty'),
    btnEmptyNuevaEmpresa: document.getElementById('btn-control-empty-nueva-empresa'),
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
    activandoOverlay: document.getElementById('control-activando-modal-overlay'),
    activandoBarra: document.getElementById('control-activando-barra'),
    activandoSpinner: document.getElementById('control-activando-spinner'),
    activandoIconoExito: document.getElementById('control-activando-icono-exito'),
    activandoIconoFalla: document.getElementById('control-activando-icono-falla'),
    activandoTitulo: document.getElementById('control-activando-titulo'),
    activandoSub: document.getElementById('control-activando-sub'),
    activandoPaso1: document.getElementById('control-activando-paso1'),
    activandoPaso2: document.getElementById('control-activando-paso2'),
    activandoFooter: document.getElementById('control-activando-footer'),
    btnActivandoCerrar: document.getElementById('control-btn-activando-cerrar'),
    eliminarOverlay: document.getElementById('control-eliminar-modal-overlay'),
    eliminarBarra: document.getElementById('control-eliminar-barra'),
    eliminarPasoConfirmar: document.getElementById('control-eliminar-paso-confirmar'),
    eliminarNombre: document.getElementById('control-eliminar-nombre'),
    eliminarSlugEsperado: document.getElementById('control-eliminar-slug-esperado'),
    eliminarInput: document.getElementById('control-eliminar-input'),
    btnEliminarCancelar: document.getElementById('control-btn-eliminar-cancelar'),
    btnEliminarConfirmar: document.getElementById('control-btn-eliminar-confirmar'),
    eliminarProgresoHead: document.getElementById('control-eliminar-progreso-head'),
    eliminarSpinner: document.getElementById('control-eliminar-spinner'),
    eliminarIconoExito: document.getElementById('control-eliminar-icono-exito'),
    eliminarIconoFalla: document.getElementById('control-eliminar-icono-falla'),
    eliminarProgresoTitulo: document.getElementById('control-eliminar-progreso-titulo'),
    eliminarPasos: document.getElementById('control-eliminar-pasos'),
    eliminarPaso1: document.getElementById('control-eliminar-paso1'),
    eliminarPaso2: document.getElementById('control-eliminar-paso2'),
    eliminarPaso3: document.getElementById('control-eliminar-paso3'),
    eliminarPaso4: document.getElementById('control-eliminar-paso4'),
    eliminarFooter: document.getElementById('control-eliminar-footer'),
    btnEliminarCerrar: document.getElementById('control-btn-eliminar-cerrar'),
    btnVaciarPapelera: document.getElementById('control-btn-vaciar-papelera'),
    vaciarOverlay: document.getElementById('control-vaciar-modal-overlay'),
    vaciarBarra: document.getElementById('control-vaciar-barra'),
    vaciarPasoConfirmar: document.getElementById('control-vaciar-paso-confirmar'),
    vaciarCantidad: document.getElementById('control-vaciar-cantidad'),
    vaciarLista: document.getElementById('control-vaciar-lista'),
    vaciarInput: document.getElementById('control-vaciar-input'),
    btnVaciarCancelar: document.getElementById('control-btn-vaciar-cancelar'),
    btnVaciarConfirmar: document.getElementById('control-btn-vaciar-confirmar'),
    vaciarProgresoHead: document.getElementById('control-vaciar-progreso-head'),
    vaciarSpinner: document.getElementById('control-vaciar-spinner'),
    vaciarIconoExito: document.getElementById('control-vaciar-icono-exito'),
    vaciarProgresoTitulo: document.getElementById('control-vaciar-progreso-titulo'),
    vaciarFooter: document.getElementById('control-vaciar-footer'),
    btnVaciarCerrar: document.getElementById('control-btn-vaciar-cerrar'),
    btnNuevaEmpresa: document.getElementById('control-btn-nueva-empresa'),
    btnAyudaVistaEmpresas: document.getElementById('btn-ayuda-vista-empresas'),
    btnAyudaVistaSucursales: document.getElementById('btn-ayuda-vista-sucursales'),
    ayudaVistaModalOverlay: document.getElementById('ayuda-vista-modal-overlay'),
    ayudaVistaModalTitle: document.getElementById('ayuda-vista-modal-title'),
    ayudaVistaContenido: document.getElementById('ayuda-vista-contenido'),
    btnAyudaVistaCerrar: document.getElementById('btn-ayuda-vista-cerrar'),
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
  editarMaxUsuarios: document.getElementById('control-editar-max-usuarios'),
  editarMarcaLookfeelSwitch: document.getElementById('control-editar-marca-lookfeel-switch'),
  btnToggleTemaEditar: document.getElementById('control-btn-toggle-tema-editar'),
  temaBody: document.getElementById('control-tema-body'),
  temaPreview: document.getElementById('control-tema-preview'),
  temaFavicon: document.getElementById('control-tema-favicon'),
  temaFaviconActual: document.getElementById('control-tema-favicon-actual'),
  temaError: document.getElementById('error-control-tema'),
  btnTemaRestablecer: document.getElementById('control-btn-tema-restablecer'),
    editarError: document.getElementById('control-editar-error'),
    btnEditarCancelar: document.getElementById('control-btn-editar-cancelar'),
    btnEditarGuardar: document.getElementById('control-btn-editar-guardar'),
    btnEditarGuardarLabel: document.getElementById('control-btn-editar-guardar-label'),

    // §58: Sucursales
    btnVistaEmpresas: document.getElementById('btn-vista-control-empresas'),
    btnVistaSucursales: document.getElementById('btn-vista-control-sucursales'),
    btnVistaSuper: document.getElementById('btn-vista-control-super'),
    vistaEmpresas: document.getElementById('vista-control-empresas'),
    vistaSucursales: document.getElementById('vista-control-sucursales'),
    vistaSuper: document.getElementById('vista-control-super'),
    sucursalesCount: document.getElementById('sucursales-count'),
    sucursalesError: document.getElementById('sucursales-error'),
    sucursalesTableBody: document.getElementById('sucursales-table-body'),
    sucursalesEmpty: document.getElementById('sucursales-empty'),
    btnSucursalesNuevoGrupo: document.getElementById('btn-sucursales-nuevo-grupo'),
    btnSucursalesEmptyNuevoGrupo: document.getElementById('btn-sucursales-empty-nuevo-grupo'),
    sucursalesGrupoOverlay: document.getElementById('sucursales-grupo-modal-overlay'),
    sucursalesGrupoModalTitle: document.getElementById('sucursales-grupo-modal-title'),
    btnSucursalesGrupoModalCerrar: document.getElementById('btn-sucursales-grupo-modal-cerrar'),
    sucursalesGrupoNombre: document.getElementById('sucursales-grupo-nombre'),
    sucursalesGrupoTenantsLista: document.getElementById('sucursales-grupo-tenants-lista'),
    sucursalesGrupoError: document.getElementById('sucursales-grupo-error'),
    btnSucursalesGrupoCancelar: document.getElementById('btn-sucursales-grupo-cancelar'),
    btnSucursalesGrupoGuardar: document.getElementById('btn-sucursales-grupo-guardar'),
    btnSucursalesGrupoGuardarLabel: document.getElementById('btn-sucursales-grupo-guardar-label'),
    sucursalesGrupoUsuariosWrap: document.getElementById('sucursales-grupo-usuarios-wrap'),
    sucursalesUsuariosTableBody: document.getElementById('sucursales-usuarios-table-body'),
    sucursalesUsuariosEmpty: document.getElementById('sucursales-usuarios-empty'),
    sucursalesUsuarioNuevo: document.getElementById('sucursales-usuario-nuevo'),
    sucursalesUsuarioNuevoPassword: document.getElementById('sucursales-usuario-nuevo-password'),
    sucursalesUsuarioNuevoPerfil: document.getElementById('sucursales-usuario-nuevo-perfil'),
    sucursalesUsuarioNuevoError: document.getElementById('sucursales-usuario-nuevo-error'),
    btnSucursalesUsuarioAgregar: document.getElementById('btn-sucursales-usuario-agregar'),

    // Punto 247: Super Admins (.env)
    superCount: document.getElementById('super-count'),
    superError: document.getElementById('super-error'),
    superTableBody: document.getElementById('super-table-body'),
    superEmpty: document.getElementById('super-empty'),
    btnSuperNuevo: document.getElementById('btn-super-nuevo'),
    btnSuperRefresh: document.getElementById('btn-super-refresh'),
    superModalOverlay: document.getElementById('super-modal-overlay'),
    superForm: document.getElementById('super-form'),
    superUsuario: document.getElementById('super-usuario'),
    superPassword: document.getElementById('super-password'),
    superModalError: document.getElementById('super-modal-error'),
    superBtnCancelar: document.getElementById('super-btn-cancelar'),
    superBtnGuardar: document.getElementById('super-btn-guardar'),
    superBtnGuardarLabel: document.getElementById('super-btn-guardar-label'),
    superModalTitle: document.getElementById('super-modal-title'),
    btnAyudaVistaSuper: document.getElementById('btn-ayuda-vista-super'),
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
    Esqueleto.aplicarEsqueletoTabla(els.tableBody, 6);
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
        Esqueleto.aplicarErrorTabla(els.tableBody, 6, 'No se pudieron cargar los tenants.', cargarTenants);
        return;
      }
      const data = await res.json();
      renderTenants(data.tenants || []);
      Esqueleto.quitarEsqueletoTabla(els.tableBody);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.tableBody, 6, 'No se pudo conectar con el servidor.', cargarTenants);
    }
  }

  const ETIQUETA_ESTADO = {
    provisioning: 'Provisionando',
    activo: 'Activo',
    suspendido: 'Suspendido',
    baja: 'Baja',
  };

  // Tooltip por estado (Fase 5 UX, punto 194) — "Provisionando" en
  // particular no tenía ninguna explicación visible salvo el hint de
  // texto de la parte de arriba de la vista, fácil de pasar por alto.
  const TOOLTIP_ESTADO = {
    provisioning: 'La solicitud ya se guardó, falta crear su base de datos — usa el botón "Activar" de esta fila.',
    activo: 'La empresa opera con normalidad, accesible para sus usuarios.',
    suspendido: 'Pausa temporal — la empresa no es accesible. Reversible con "Reactivar".',
    baja: 'Dada de baja — la empresa no es accesible. No se borró ningún dato; reversible con "Reactivar".',
  };

  function renderTenants(tenants) {
    els.count.textContent = `${tenants.length} tenant${tenants.length === 1 ? '' : 's'}`;
    els.tableBody.innerHTML = '';
    const hayFiltro = Boolean(els.filtroEstado.value || els.searchInput.value.trim());
    els.empty.hidden = tenants.length > 0 || hayFiltro;
    if (els.filtroEmpty) els.filtroEmpty.hidden = tenants.length > 0 || !hayFiltro;

    tenants.forEach((t) => {
      const tr = document.createElement('tr');
      tr.dataset.slug = t.slug;
      const etiquetaEstado = ETIQUETA_ESTADO[t.estado] || t.estado;
      const tooltipEstado = TOOLTIP_ESTADO[t.estado] || '';
      // Slug clicable directo a /<slug>/admin — solo si el tenant está
      // "activo" (Provisionando/Suspendido/Baja no tienen un /admin
      // realmente accesible, un link ahí prometería algo que falla).
      // El dominio se detecta solo con window.location.origin — nunca se
      // hardcodea, así que en dev resuelve a la IP/puerto real y en
      // producción al dominio real sin ningún cambio de código. Funciona
      // para cualquier super usuario (ADMIN_USERS del .env o la cuenta
      // de respaldo "admin" gestionada desde /control) — ambos ya entran
      // a cualquier /<slug>/admin (ver punto 185), este link no agrega
      // acceso nuevo, solo un atajo.
      const urlAdminTenant = `${window.location.origin}/${t.slug}/admin`;
      const slugCelda = t.estado === 'activo'
        ? `<a href="${escapeHtml(urlAdminTenant)}" target="_blank" rel="noopener noreferrer" class="control-slug-link" data-tooltip="${escapeHtml(urlAdminTenant)}"><strong>${escapeHtml(t.slug)}</strong></a>`
        : `<strong>${escapeHtml(t.slug)}</strong>`;
      tr.innerHTML = `
        <td data-label="Slug">${slugCelda}</td>
        <td data-label="Empresa">${escapeHtml(t.nombre_empresa)}</td>
        <td data-label="Estado"><span class="estatus-badge estatus-${escapeHtml(t.estado)}" data-tooltip="${escapeHtml(tooltipEstado)}">${escapeHtml(etiquetaEstado)}</span></td>
        <td data-label="Contacto">${escapeHtml(t.contacto_email) || '—'}</td>
        <td data-label="Creado">${formatFecha(t.creado_en)}</td>
        <td data-label=""></td>
      `;

      const celdaAcciones = tr.lastElementChild;
      const contenedorAcciones = document.createElement('div');
      contenedorAcciones.className = 'admin-row-actions';

      // Iconos compactos 30×30 con tooltip (mismo patrón que admin Usuarios —
      // PROJECT_STATE.md:78). Orden e íconos revisados (punto 189): acciones
      // frecuentes/seguras primero (Editar, Credenciales API), separador, y
      // cambios de estado al final (Suspender/Reactivar, Dar de baja) — la
      // más delicada queda al final para reducir el riesgo de clic accidental.
      // Íconos con forma semánticamente correcta: pausa (Suspender), llave
      // (Credenciales API) y X (Dar de baja) en vez del ecualizador/candado/
      // palomita anteriores, que no comunicaban la acción sin pasar el mouse.
      contenedorAcciones.appendChild(
        crearBotonAccion('btn-icono-accion', 'Editar', 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z', () => abrirEdicion(t))
      );

      // Credenciales API (para uso en Swagger y consumo directo) — específica para uso de las APIs por empresa
      contenedorAcciones.appendChild(
        crearBotonAccion('btn-icono-accion', 'Credenciales API', 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4', () => abrirCredenciales(t))
      );

      const hayAccionesDeEstado =
        t.estado === 'activo' || t.estado === 'suspendido' || t.estado === 'baja' || t.estado === 'provisioning';
      if (hayAccionesDeEstado) {
        const divisor = document.createElement('div');
        divisor.className = 'admin-row-actions-divisor';
        contenedorAcciones.appendChild(divisor);
      }

      if (t.estado === 'provisioning') {
        contenedorAcciones.appendChild(
          crearBotonAccion('btn-icono-accion', 'Activar', 'M5 12l5 5L20 7', () =>
            confirmarAccion({
              titulo: '¿Activar este tenant?',
              mensaje: `Se creará la base de datos de "${t.nombre_empresa}" (${t.slug}) y quedará accesible en /${t.slug}/admin. Puede tardar unos segundos.`,
              textoBoton: 'Activar',
              onConfirmar: () => activarTenantConAnimacion(t),
            })
          )
        );
      }

      if (t.estado === 'activo') {
        contenedorAcciones.appendChild(
          crearBotonAccion('btn-icono-accion', 'Suspender', 'M8 4v16M16 4v16', () =>
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

      if (t.estado === 'baja') {
        contenedorAcciones.appendChild(
          crearBotonAccion('btn-icono-accion btn-icono-accion-peligro', 'Eliminar definitivo', 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', () =>
            abrirModalEliminarTenant(t)
          )
        );
      }

      if (t.estado === 'activo' || t.estado === 'suspendido') {
        contenedorAcciones.appendChild(
          crearBotonAccion('btn-icono-accion btn-icono-accion-peligro', 'Dar de baja', 'M18 6L6 18M6 6l12 12', () =>
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

  // ---------- Modal "Activando" (Provisionando → Activo) ----------
  // Solo para "activar": es la ÚNICA transición que ejecuta un paso
  // físico real (crear la base de datos del tenant, ver
  // control/utils/tenantLifecycle.js) que puede tardar varios segundos —
  // antes disparaba el fetch sin ningún indicador, parecía congelado.
  // Suspender/Reactivar/Baja siguen con el toast simple de ejecutarAccion
  // de arriba: son un solo UPDATE atómico, prácticamente instantáneo.
  // Es UNA sola petición HTTP (sin eventos intermedios reales del
  // servidor), así que la barra y el anillo son deliberadamente
  // indeterminados — nunca se finge un porcentaje exacto. Los 2 "pasos"
  // con nombre sí son los 2 pasos reales del backend, pero se marcan
  // "listos" hasta que llega la respuesta real, nunca antes de tiempo.
  function resetModalActivando() {
    els.activandoSpinner.style.display = '';
    els.activandoIconoExito.classList.remove('is-visible');
    els.activandoIconoFalla.classList.remove('is-visible');
    els.activandoPaso1.className = 'esta-en-curso';
    els.activandoPaso2.className = '';
    els.activandoBarra.classList.remove('es-completa');
    els.activandoBarra.querySelector('span').style.background = '';
    els.activandoFooter.textContent = 'Puede tardar unos segundos…';
    els.btnActivandoCerrar.classList.remove('is-visible');
  }

  function abrirModalActivando(t) {
    resetModalActivando();
    els.activandoTitulo.textContent = `Activando "${t.nombre_empresa}"`;
    els.activandoSub.textContent = `${t.slug} · /${t.slug}/admin`;
    els.activandoOverlay.hidden = false;
  }

  function cerrarModalActivando() {
    els.activandoOverlay.hidden = true;
  }

  function flashFilaTenant(slug) {
    const fila = els.tableBody.querySelector(`tr[data-slug="${CSS.escape(slug)}"]`);
    if (!fila) return;
    fila.classList.add('es-flash');
    setTimeout(() => fila.classList.remove('es-flash'), 1200);
  }

  function mostrarExitoActivando(slug) {
    els.activandoPaso1.className = 'esta-lista';
    setTimeout(() => {
      els.activandoPaso2.className = 'esta-lista';
      els.activandoSpinner.style.display = 'none';
      els.activandoIconoExito.classList.add('is-visible');
      els.activandoBarra.classList.add('es-completa');
      els.activandoTitulo.textContent = 'Activo';
      els.activandoFooter.textContent = `Ya está en /${slug}/admin`;
      setTimeout(() => {
        cerrarModalActivando();
        cargarTenants().then(() => flashFilaTenant(slug));
      }, 900);
    }, 350);
  }

  function mostrarFallaActivando(mensaje) {
    els.activandoSpinner.style.display = 'none';
    els.activandoIconoFalla.classList.add('is-visible');
    els.activandoBarra.querySelector('span').style.background = 'var(--color-error)';
    els.activandoTitulo.textContent = 'No se pudo activar';
    els.activandoFooter.textContent = mensaje;
    els.btnActivandoCerrar.classList.add('is-visible');
  }

  async function activarTenantConAnimacion(t) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    abrirModalActivando(t);
    try {
      const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(t.slug)}/activar`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        cerrarModalActivando();
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        mostrarFallaActivando(data.error || 'No se pudo completar la activación.');
        return;
      }
      mostrarExitoActivando(t.slug);
    } catch (err) {
      mostrarFallaActivando('No se pudo conectar con el servidor.');
    }
  }

  els.btnActivandoCerrar.addEventListener('click', cerrarModalActivando);

  // ---------- Modal "Eliminar definitivo" (punto 345, "papelera") ----------
  // Solo alcanzable desde "Baja" (candado ya aplicado del lado del
  // botón, ver renderTenants). Exige escribir el slug exacto — no un
  // simple Sí/No — antes de dejar confirmar algo irreversible (DROP
  // DATABASE + archivos reales). Misma barra/anillo/pasos que el modal
  // "Activando": indeterminados porque es UNA sola petición HTTP, los
  // pasos solo se marcan "listos" cuando llega la respuesta real.
  let tenantAEliminar = null;

  function resetModalEliminar() {
    els.eliminarPasoConfirmar.hidden = false;
    els.eliminarProgresoHead.hidden = true;
    els.eliminarPasos.hidden = true;
    els.eliminarFooter.hidden = true;
    els.eliminarFooter.textContent = '';
    els.eliminarBarra.classList.remove('es-completa');
    els.eliminarBarra.querySelector('span').style.background = '';
    els.eliminarSpinner.style.display = '';
    els.eliminarIconoExito.classList.remove('is-visible');
    els.eliminarIconoFalla.classList.remove('is-visible');
    els.btnEliminarCerrar.classList.remove('is-visible');
    els.eliminarInput.value = '';
    els.btnEliminarConfirmar.disabled = true;
    [els.eliminarPaso1, els.eliminarPaso2, els.eliminarPaso3, els.eliminarPaso4].forEach((p) => { p.className = ''; });
  }

  function abrirModalEliminarTenant(t) {
    resetModalEliminar();
    tenantAEliminar = t;
    els.eliminarNombre.textContent = t.nombre_empresa;
    els.eliminarSlugEsperado.textContent = t.slug;
    els.eliminarOverlay.hidden = false;
    setTimeout(() => els.eliminarInput.focus(), 50);
  }

  function cerrarModalEliminar() {
    els.eliminarOverlay.hidden = true;
    tenantAEliminar = null;
  }

  function mostrarExitoEliminar() {
    const pasos = [els.eliminarPaso1, els.eliminarPaso2, els.eliminarPaso3, els.eliminarPaso4];
    let i = 0;
    function tick() {
      if (i > 0) pasos[i - 1].className = 'esta-lista';
      if (i < pasos.length) { i++; setTimeout(tick, 350); return; }
      els.eliminarSpinner.style.display = 'none';
      els.eliminarIconoExito.classList.add('is-visible');
      els.eliminarBarra.classList.add('es-completa');
      els.eliminarProgresoTitulo.textContent = 'Eliminada';
      setTimeout(() => {
        cerrarModalEliminar();
        cargarTenants();
      }, 900);
    }
    tick();
  }

  function mostrarFallaEliminar(mensaje) {
    els.eliminarSpinner.style.display = 'none';
    els.eliminarIconoFalla.classList.add('is-visible');
    els.eliminarBarra.querySelector('span').style.background = 'var(--color-error)';
    els.eliminarProgresoTitulo.textContent = 'No se pudo eliminar';
    els.eliminarFooter.hidden = false;
    els.eliminarFooter.textContent = mensaje;
    els.btnEliminarCerrar.classList.add('is-visible');
  }

  els.eliminarInput.addEventListener('input', () => {
    els.btnEliminarConfirmar.disabled = !tenantAEliminar || els.eliminarInput.value.trim() !== tenantAEliminar.slug;
  });
  els.btnEliminarCancelar.addEventListener('click', cerrarModalEliminar);
  els.btnEliminarCerrar.addEventListener('click', cerrarModalEliminar);

  els.btnEliminarConfirmar.addEventListener('click', async () => {
    const t = tenantAEliminar;
    if (!t) return;
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.eliminarPasoConfirmar.hidden = true;
    els.eliminarProgresoHead.hidden = false;
    els.eliminarPasos.hidden = false;

    try {
      const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(t.slug)}/eliminar`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        mostrarFallaEliminar(data.error || 'No se pudo eliminar el tenant.');
        return;
      }
      mostrarExitoEliminar();
    } catch (err) {
      mostrarFallaEliminar('No se pudo conectar con el servidor.');
    }
  });

  // ---------- Modal "Vaciar papelera" ----------
  // Solo visible mientras el filtro activo es "Baja" — es literalmente
  // la vista de la papelera. Exige escribir "ELIMINAR" (no un slug único,
  // son varios tenants a la vez) y muestra la lista completa de nombres
  // antes de dejar confirmar.
  function actualizarBotonVaciarPapelera() {
    els.btnVaciarPapelera.hidden = els.filtroEstado.value !== 'baja';
  }
  els.filtroEstado.addEventListener('change', actualizarBotonVaciarPapelera);
  actualizarBotonVaciarPapelera();

  function resetModalVaciar() {
    els.vaciarPasoConfirmar.hidden = false;
    els.vaciarProgresoHead.hidden = true;
    els.vaciarFooter.hidden = true;
    els.vaciarFooter.textContent = '';
    els.vaciarBarra.classList.remove('es-completa');
    els.vaciarBarra.querySelector('span').style.background = '';
    els.vaciarSpinner.style.display = '';
    els.vaciarIconoExito.classList.remove('is-visible');
    els.btnVaciarCerrar.classList.remove('is-visible');
    els.vaciarInput.value = '';
    els.btnVaciarConfirmar.disabled = true;
  }

  function cerrarModalVaciar() {
    els.vaciarOverlay.hidden = true;
  }

  function mostrarExitoVaciar(eliminados, fallidos) {
    els.vaciarSpinner.style.display = 'none';
    els.vaciarIconoExito.classList.add('is-visible');
    els.vaciarBarra.classList.add('es-completa');
    cargarTenants();
    if (fallidos.length) {
      els.vaciarProgresoTitulo.textContent = `${eliminados.length} eliminada(s), ${fallidos.length} con error`;
      els.vaciarFooter.hidden = false;
      els.vaciarFooter.textContent = fallidos.map((f) => `${f.slug}: ${f.error}`).join(' · ');
      els.btnVaciarCerrar.classList.add('is-visible');
      return;
    }
    els.vaciarProgresoTitulo.textContent = `${eliminados.length} ${eliminados.length === 1 ? 'empresa eliminada' : 'empresas eliminadas'}`;
    setTimeout(cerrarModalVaciar, 1200);
  }

  function mostrarFallaVaciar(mensaje) {
    els.vaciarSpinner.style.display = 'none';
    els.vaciarBarra.querySelector('span').style.background = 'var(--color-error)';
    els.vaciarProgresoTitulo.textContent = 'No se pudo vaciar la papelera';
    els.vaciarFooter.hidden = false;
    els.vaciarFooter.textContent = mensaje;
    els.btnVaciarCerrar.classList.add('is-visible');
  }

  els.btnVaciarPapelera.addEventListener('click', () => {
    const filas = Array.from(els.tableBody.querySelectorAll('tr'));
    if (!filas.length) return;
    resetModalVaciar();
    els.vaciarCantidad.textContent = `${filas.length} ${filas.length === 1 ? 'empresa' : 'empresas'}`;
    els.vaciarLista.innerHTML = filas
      .map((tr) => {
        const nombre = tr.querySelector('td strong');
        return `<li>${nombre ? escapeHtml(nombre.textContent) : ''}</li>`;
      })
      .join('');
    els.vaciarOverlay.hidden = false;
    setTimeout(() => els.vaciarInput.focus(), 50);
  });
  els.vaciarInput.addEventListener('input', () => {
    els.btnVaciarConfirmar.disabled = els.vaciarInput.value.trim() !== 'ELIMINAR';
  });
  els.btnVaciarCancelar.addEventListener('click', cerrarModalVaciar);
  els.btnVaciarCerrar.addEventListener('click', cerrarModalVaciar);

  els.btnVaciarConfirmar.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.vaciarPasoConfirmar.hidden = true;
    els.vaciarProgresoHead.hidden = false;

    try {
      const res = await fetch(`${API_BASE}/tenants/papelera/vaciar`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        mostrarFallaVaciar(data.error || 'No se pudo vaciar la papelera.');
        return;
      }
      mostrarExitoVaciar(data.eliminados || [], data.fallidos || []);
    } catch (err) {
      mostrarFallaVaciar('No se pudo conectar con el servidor.');
    }
  });

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
  els.confirmOverlay.addEventListener('click', (e) => {
    if (e.target === els.confirmOverlay) cerrarConfirmacion();
  });

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
    actualizarPreviewUrls();
    els.intakeOverlay.hidden = false;
    els.intakeNombre.focus();
  }

  function cerrarIntake() {
    els.intakeOverlay.hidden = true;
  }

  els.btnNuevaEmpresa.addEventListener('click', abrirIntake);
  if (els.btnEmptyNuevaEmpresa) els.btnEmptyNuevaEmpresa.addEventListener('click', abrirIntake);
  els.btnIntakeCancelar.addEventListener('click', cerrarIntake);
  els.intakeOverlay.addEventListener('click', (e) => {
    if (e.target === els.intakeOverlay) cerrarIntake();
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
    if (!email) {
      setFieldErrorIntake('intake-email', 'El correo de contacto de la empresa es obligatorio.');
      els.intakeEmail.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrorIntake('intake-email', 'El correo de contacto no tiene un formato válido.');
      els.intakeEmail.focus();
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
    cerrarSeccionTema();

    els.editarEmpresa.textContent = `Editando ${tenant.nombre_empresa} (${tenant.slug})`;
    els.editarNombre.value = tenant.nombre_empresa || '';
    els.editarMarca.value = tenant.marca || '';
    els.editarEmail.value = tenant.contacto_email || '';
    els.editarNotas.value = tenant.notas || '';
    els.editarMaxUsuarios.value = tenant.max_usuarios != null ? String(tenant.max_usuarios) : '';
    els.editarMarcaLookfeelSwitch.checked = tenant.marca_lookfeel_habilitado !== 0 && tenant.marca_lookfeel_habilitado !== false;
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
    if (!email) {
      setFieldErrorEditar('editar-email', 'El correo de contacto de la empresa es obligatorio.');
      els.editarEmail.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrorEditar('editar-email', 'El correo de contacto no tiene un formato válido.');
      els.editarEmail.focus();
      return;
    }
    const maxUsuariosTexto = els.editarMaxUsuarios.value.trim();
    let maxUsuarios = null;
    if (maxUsuariosTexto) {
      const n = Number(maxUsuariosTexto);
      if (!Number.isInteger(n) || n < 1) {
        setFieldErrorEditar('editar-max-usuarios', 'Debe ser un número entero mayor a 0, o vacío para no limitar.');
        els.editarMaxUsuarios.focus();
        return;
      }
      maxUsuarios = n;
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
          marca: els.editarMarca.value.trim() || null,
          logoBase64: logoBase64 || null,
          quitarLogo: logoBase64 ? false : !els.editarLogoActual.hidden,
          maxUsuarios,
          marcaLookfeelHabilitado: els.editarMarcaLookfeelSwitch.checked,
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
    // Tipografía congelada a Inter (regla 2026-08-24) — preview también
    // usa la misma sans que menú/botones/reportes, aunque el formulario
    // aún conserve el selector histórico.
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
      '--font-display': `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
      '--font-body': `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
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
      els.credCurlClave.textContent = `curl -H "X-API-Key: ${clave}" "${url}"`;
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
    els.credSubtitulo.textContent = `${tenant.nombre_empresa} (${tenant.slug}) — para integraciones externas (Swagger, sistemas propios de la empresa), no es el login de operadores de /admin. Basic + clave API.`;
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

  // ---------- §58: Sucursales (grupos + usuarios compartidos) ----------
  // Decisión cerrada (ver inventarios.md §58): lo único que comparten los
  // tenants asociados es el LOGIN — sus BD/inventario/ventas siguen 100%
  // separados. Este panel solo administra el grupo y sus usuarios; el
  // backend verifica la credencial en vivo (no hay nada que sincronizar).

  let grupoSucursalEditandoId = null; // null = modal en modo "crear"
  let grupoSucursalTenantsOriginales = []; // slugs ya asociados al abrir el modal, para calcular el diff al guardar

  function cambiarVistaPrincipalControl(vista) {
    els.menuMovil.hidden = true;
    els.btnVistaEmpresas.classList.toggle('is-active', vista === 'empresas');
    els.btnVistaEmpresas.setAttribute('aria-selected', String(vista === 'empresas'));
    els.btnVistaSucursales.classList.toggle('is-active', vista === 'sucursales');
    els.btnVistaSucursales.setAttribute('aria-selected', String(vista === 'sucursales'));
    if (els.btnVistaSuper) {
      els.btnVistaSuper.classList.toggle('is-active', vista === 'super');
      els.btnVistaSuper.setAttribute('aria-selected', String(vista === 'super'));
    }
    els.vistaEmpresas.hidden = vista !== 'empresas';
    els.vistaSucursales.hidden = vista !== 'sucursales';
    if (els.vistaSuper) els.vistaSuper.hidden = vista !== 'super';
    if (vista === 'sucursales') cargarSucursales();
    if (vista === 'super') cargarSuperAdmins();
  }

  els.btnVistaEmpresas.addEventListener('click', () => cambiarVistaPrincipalControl('empresas'));
  els.btnVistaSucursales.addEventListener('click', () => cambiarVistaPrincipalControl('sucursales'));
  if (els.btnVistaSuper) els.btnVistaSuper.addEventListener('click', () => cambiarVistaPrincipalControl('super'));
  els.menuMovil.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-vista]');
    if (btn) cambiarVistaPrincipalControl(btn.dataset.vista);
  });

  async function cargarSucursales() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.sucursalesError.textContent = '';
    Esqueleto.aplicarEsqueletoTabla(els.sucursalesTableBody, 4);
    try {
      const res = await fetch(`${API_BASE}/grupos-sucursal`, { headers: { Authorization: authHeader } });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.sucursalesTableBody, 4, 'No se pudieron cargar los grupos de sucursales.', cargarSucursales);
        return;
      }
      const data = await res.json();
      renderGruposSucursal(data.grupos || []);
      Esqueleto.quitarEsqueletoTabla(els.sucursalesTableBody);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.sucursalesTableBody, 4, 'No se pudo conectar con el servidor.', cargarSucursales);
    }
  }

  function renderGruposSucursal(grupos) {
    els.sucursalesCount.textContent = `${grupos.length} grupo${grupos.length === 1 ? '' : 's'}`;
    els.sucursalesTableBody.innerHTML = '';
    els.sucursalesEmpty.hidden = grupos.length > 0;

    grupos.forEach((g) => {
      const tr = document.createElement('tr');
      const listaSucursales = g.tenants.length > 0
        ? g.tenants.map((t) => escapeHtml(t.nombre_empresa)).join(', ')
        : '—';
      tr.innerHTML = `
        <td data-label="Grupo"><strong>${escapeHtml(g.nombre)}</strong></td>
        <td data-label="Sucursales asociadas">${listaSucursales}</td>
        <td data-label="Usuarios" class="col-num">${g.total_usuarios}</td>
        <td data-label=""></td>
      `;
      const celdaAcciones = tr.lastElementChild;
      const contenedorAcciones = document.createElement('div');
      contenedorAcciones.className = 'admin-row-actions';
      contenedorAcciones.appendChild(
        crearBotonAccion(
          'btn-icono-accion',
          'Editar',
          'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
          () => abrirGrupoModal(g.id)
        )
      );
      contenedorAcciones.appendChild(
        crearBotonAccion('btn-icono-accion btn-icono-accion-peligro', 'Eliminar grupo', 'M19 7l-8.5 8.5-5-5', () =>
          confirmarAccion({
            titulo: '¿Eliminar este grupo de sucursales?',
            mensaje: `"${g.nombre}" deja de asociar sus ${g.tenants.length} sucursal(es) y se pierden sus ${g.total_usuarios} usuario(s) compartido(s). Ningún tenant ni su información se borra — solo dejan de compartir el login.`,
            textoBoton: 'Eliminar grupo',
            onConfirmar: () => eliminarGrupoSucursal(g.id),
          })
        )
      );
      celdaAcciones.appendChild(contenedorAcciones);
      els.sucursalesTableBody.appendChild(tr);
    });
  }

  async function eliminarGrupoSucursal(id) {
    const authHeader = getAuthHeader();
    try {
      const res = await fetch(`${API_BASE}/grupos-sucursal/${id}`, { method: 'DELETE', headers: { Authorization: authHeader } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'No se pudo eliminar el grupo.', true);
        return;
      }
      showToast('Grupo de sucursales eliminado.');
      cargarSucursales();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // ---------- Modal de grupo (crear/editar) ----------

  function limpiarErroresGrupoModal() {
    els.sucursalesGrupoError.textContent = '';
    document.getElementById('error-sucursales-grupo-nombre').textContent = '';
  }

  async function poblarChecklistTenants(slugsAsociados) {
    els.sucursalesGrupoTenantsLista.innerHTML = '<p class="field-hint">Cargando empresas…</p>';
    const authHeader = getAuthHeader();
    try {
      const res = await fetch(`${API_BASE}/tenants`, { headers: { Authorization: authHeader } });
      const data = await res.json().catch(() => ({}));
      const tenants = (data.tenants || []).filter((t) => t.estado === 'activo');
      els.sucursalesGrupoTenantsLista.innerHTML = '';
      if (tenants.length === 0) {
        els.sucursalesGrupoTenantsLista.innerHTML = '<p class="field-hint">No hay empresas activas para asociar.</p>';
        return;
      }
      tenants.forEach((t) => {
        const yaAsociado = slugsAsociados.includes(t.slug);
        const label = document.createElement('label');
        label.className = 'gastos-categoria-fila';
        label.innerHTML = `
          <input type="checkbox" value="${escapeHtml(t.slug)}" ${yaAsociado ? 'checked' : ''} />
          <span class="gastos-categoria-nombre">${escapeHtml(t.nombre_empresa)} (${escapeHtml(t.slug)})</span>
        `;
        els.sucursalesGrupoTenantsLista.appendChild(label);
      });
    } catch (err) {
      els.sucursalesGrupoTenantsLista.innerHTML = '<p class="field-error">No se pudo cargar la lista de empresas.</p>';
    }
  }

  function tenantsSeleccionadosEnModal() {
    return Array.from(els.sucursalesGrupoTenantsLista.querySelectorAll('input[type="checkbox"]:checked')).map(
      (input) => input.value
    );
  }

  async function abrirGrupoModal(grupoId) {
    grupoSucursalEditandoId = grupoId || null;
    limpiarErroresGrupoModal();
    els.sucursalesGrupoModalTitle.textContent = grupoId ? 'Editar grupo de sucursales' : 'Nuevo grupo de sucursales';
    els.btnSucursalesGrupoGuardarLabel.textContent = grupoId ? 'Guardar cambios' : 'Guardar grupo';
    els.sucursalesGrupoNombre.value = '';
    els.sucursalesGrupoUsuariosWrap.hidden = !grupoId; // un grupo nuevo no existe todavía — no hay a quién agregar usuarios
    els.sucursalesUsuarioNuevo.value = '';
    els.sucursalesUsuarioNuevoPassword.value = '';
    els.sucursalesUsuarioNuevoError.textContent = '';
    grupoSucursalTenantsOriginales = [];

    els.sucursalesGrupoOverlay.hidden = false;

    if (grupoId) {
      const authHeader = getAuthHeader();
      try {
        const res = await fetch(`${API_BASE}/grupos-sucursal/${grupoId}`, { headers: { Authorization: authHeader } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          els.sucursalesGrupoError.textContent = data.error || 'No se pudo cargar el grupo.';
          return;
        }
        els.sucursalesGrupoNombre.value = data.grupo.nombre;
        grupoSucursalTenantsOriginales = data.grupo.tenants.map((t) => t.slug);
        renderUsuariosSucursalModal(data.grupo.usuarios || []);
        await poblarChecklistTenants(grupoSucursalTenantsOriginales);
      } catch (err) {
        els.sucursalesGrupoError.textContent = 'No se pudo conectar con el servidor.';
      }
    } else {
      await poblarChecklistTenants([]);
    }
    els.sucursalesGrupoNombre.focus();
  }

  function cerrarGrupoModal() {
    els.sucursalesGrupoOverlay.hidden = true;
    grupoSucursalEditandoId = null;
  }

  els.btnSucursalesNuevoGrupo.addEventListener('click', () => abrirGrupoModal(null));
  if (els.btnSucursalesEmptyNuevoGrupo) els.btnSucursalesEmptyNuevoGrupo.addEventListener('click', () => abrirGrupoModal(null));
  els.btnSucursalesGrupoModalCerrar.addEventListener('click', cerrarGrupoModal);
  els.btnSucursalesGrupoCancelar.addEventListener('click', cerrarGrupoModal);
  els.sucursalesGrupoOverlay.addEventListener('click', (e) => {
    if (e.target === els.sucursalesGrupoOverlay) cerrarGrupoModal();
  });

  els.btnSucursalesGrupoGuardar.addEventListener('click', async () => {
    limpiarErroresGrupoModal();
    const nombre = els.sucursalesGrupoNombre.value.trim();
    if (!nombre) {
      document.getElementById('error-sucursales-grupo-nombre').textContent = 'El nombre del grupo es obligatorio.';
      return;
    }

    const authHeader = getAuthHeader();
    els.btnSucursalesGrupoGuardar.disabled = true;
    els.btnSucursalesGrupoGuardarLabel.textContent = 'Guardando…';
    try {
      const seleccionados = tenantsSeleccionadosEnModal();
      let res;
      if (grupoSucursalEditandoId) {
        const agregarSlugs = seleccionados.filter((s) => !grupoSucursalTenantsOriginales.includes(s));
        const quitarSlugs = grupoSucursalTenantsOriginales.filter((s) => !seleccionados.includes(s));
        res = await fetch(`${API_BASE}/grupos-sucursal/${grupoSucursalEditandoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({ nombre, agregarSlugs, quitarSlugs }),
        });
      } else {
        res = await fetch(`${API_BASE}/grupos-sucursal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({ nombre, slugs: seleccionados }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.sucursalesGrupoError.textContent = data.error || 'No se pudo guardar el grupo.';
        return;
      }
      showToast(grupoSucursalEditandoId ? 'Grupo actualizado.' : 'Grupo creado.');
      const idParaReabrir = grupoSucursalEditandoId || data.grupo.id;
      cargarSucursales();
      // Se reabre en modo edición para poder agregar usuarios de inmediato
      // tras crear el grupo, sin un paso intermedio de "buscar el grupo en
      // la tabla y volver a entrar".
      await abrirGrupoModal(idParaReabrir);
    } catch (err) {
      els.sucursalesGrupoError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      els.btnSucursalesGrupoGuardar.disabled = false;
      els.btnSucursalesGrupoGuardarLabel.textContent = grupoSucursalEditandoId ? 'Guardar cambios' : 'Guardar grupo';
    }
  });

  // ---------- Usuarios compartidos (dentro del modal de grupo) ----------

  const ETIQUETA_PERFIL_SUCURSAL = { administrador: 'Administrador', fiscal: 'Fiscal' };

  function renderUsuariosSucursalModal(usuarios) {
    els.sucursalesUsuariosTableBody.innerHTML = '';
    els.sucursalesUsuariosEmpty.hidden = usuarios.length > 0;
    usuarios.forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Usuario"><strong>${escapeHtml(u.usuario)}</strong></td>
        <td data-label="Perfil">${ETIQUETA_PERFIL_SUCURSAL[u.perfil] || escapeHtml(u.perfil)}</td>
        <td data-label="Estado"><span class="estatus-badge estatus-${u.activo ? 'activo' : 'suspendido'}">${u.activo ? 'Activo' : 'Desactivado'}</span></td>
        <td data-label=""></td>
      `;
      const celdaAcciones = tr.lastElementChild;
      const contenedorAcciones = document.createElement('div');
      contenedorAcciones.className = 'admin-row-actions';
      contenedorAcciones.appendChild(
        crearBotonAccion(
          'btn-icono-accion',
          u.activo ? 'Desactivar' : 'Reactivar',
          u.activo ? 'M19 14v-4M5 14v-4M12 3v18' : 'M5 12h14M12 5l7 7-7 7',
          () => cambiarActivoUsuarioSucursal(u.id, !u.activo)
        )
      );
      celdaAcciones.appendChild(contenedorAcciones);
      els.sucursalesUsuariosTableBody.appendChild(tr);
    });
  }

  async function recargarUsuariosSucursalModal() {
    const authHeader = getAuthHeader();
    const res = await fetch(`${API_BASE}/grupos-sucursal/${grupoSucursalEditandoId}`, { headers: { Authorization: authHeader } });
    const data = await res.json().catch(() => ({}));
    if (res.ok) renderUsuariosSucursalModal(data.grupo.usuarios || []);
  }

  async function cambiarActivoUsuarioSucursal(usuarioId, activo) {
    const authHeader = getAuthHeader();
    try {
      const res = await fetch(`${API_BASE}/grupos-sucursal/${grupoSucursalEditandoId}/usuarios/${usuarioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ activo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'No se pudo actualizar el usuario.', true);
        return;
      }
      showToast(activo ? 'Usuario reactivado.' : 'Usuario desactivado.');
      await recargarUsuariosSucursalModal();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  els.btnSucursalesUsuarioAgregar.addEventListener('click', async () => {
    els.sucursalesUsuarioNuevoError.textContent = '';
    const usuario = els.sucursalesUsuarioNuevo.value.trim();
    const password = els.sucursalesUsuarioNuevoPassword.value;
    const perfil = els.sucursalesUsuarioNuevoPerfil.value;
    if (!usuario) {
      els.sucursalesUsuarioNuevoError.textContent = 'El usuario es obligatorio.';
      return;
    }
    if (password.length < 8) {
      els.sucursalesUsuarioNuevoError.textContent = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }

    const authHeader = getAuthHeader();
    try {
      const res = await fetch(`${API_BASE}/grupos-sucursal/${grupoSucursalEditandoId}/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ usuario, password, perfil }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.sucursalesUsuarioNuevoError.textContent = data.error || 'No se pudo agregar el usuario.';
        return;
      }
      showToast(`Usuario "${usuario}" agregado.`);
      els.sucursalesUsuarioNuevo.value = '';
      els.sucursalesUsuarioNuevoPassword.value = '';
      await recargarUsuariosSucursalModal();
      cargarSucursales();
    } catch (err) {
      els.sucursalesUsuarioNuevoError.textContent = 'No se pudo conectar con el servidor.';
    }
  });

  // ---------- Punto 247: Super Admins (.env) ----------
  let superEditando = null;

  async function cargarSuperAdmins() {
    const authHeader = getAuthHeader();
    if (!authHeader) { showLogin(); return; }
    if (!els.superTableBody) return;
    els.superError.textContent = '';
    try {
      const res = await fetch(`${API_BASE}/super-admins`, { headers: { Authorization: authHeader } });
      if (res.status === 401) { clearSession(); showLogin(); return; }
      if (!res.ok) { els.superError.textContent = 'No se pudieron cargar los super admins.'; return; }
      const data = await res.json();
      renderSuperAdmins(data.superAdmins || []);
    } catch (_) {
      els.superError.textContent = 'No se pudo conectar con el servidor.';
    }
  }

  function renderSuperAdmins(lista) {
    if (!els.superTableBody) return;
    els.superCount.textContent = `${lista.length} super`;
    els.superTableBody.innerHTML = '';
    els.superEmpty.hidden = lista.length > 0;
    lista.forEach((usuario) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td data-label="Usuario"><strong>${escapeHtml(usuario)}</strong></td><td data-label=""></td>`;
      const celda = tr.lastElementChild;
      const wrap = document.createElement('div');
      wrap.className = 'admin-row-actions';
      wrap.appendChild(crearBotonAccion('btn-icono-accion', 'Cambiar contraseña', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z', () => abrirSuperModal(usuario)));
      wrap.appendChild(crearBotonAccion('btn-icono-accion btn-icono-accion-peligro', 'Eliminar', 'M18 6L6 18M6 6l12 12', () => confirmarAccion({
        titulo: '¿Eliminar super admin?',
        mensaje: `"${usuario}" ya no podrá entrar a /control ni a /<slug>/admin como super. Debe quedar al menos uno.`,
        textoBoton: 'Eliminar',
        onConfirmar: () => eliminarSuperAdmin(usuario),
      })));
      celda.appendChild(wrap);
      els.superTableBody.appendChild(tr);
    });
  }

  async function eliminarSuperAdmin(usuario) {
    const authHeader = getAuthHeader();
    try {
      const res = await fetch(`${API_BASE}/super-admins/${encodeURIComponent(usuario)}`, { method: 'DELETE', headers: { Authorization: authHeader } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data.error || 'No se pudo eliminar.', true); return; }
      showToast(`Super "${usuario}" eliminado. .env actualizado.`);
      cargarSuperAdmins();
    } catch (_) { showToast('No se pudo conectar.', true); }
  }

  function abrirSuperModal(usuario) {
    superEditando = usuario || null;
    if (els.superModalTitle) els.superModalTitle.textContent = usuario ? `Cambiar contraseña — ${usuario}` : 'Nuevo super admin';
    if (els.superUsuario) { els.superUsuario.value = usuario || ''; els.superUsuario.readOnly = !!usuario; }
    if (els.superPassword) els.superPassword.value = '';
    if (els.superModalError) els.superModalError.textContent = '';
    document.getElementById('error-super-usuario').textContent = '';
    document.getElementById('error-super-password').textContent = '';
    if (els.superBtnGuardarLabel) els.superBtnGuardarLabel.textContent = usuario ? 'Actualizar' : 'Crear';
    els.superModalOverlay.hidden = false;
    (usuario ? els.superPassword : els.superUsuario).focus();
  }

  function cerrarSuperModal() {
    els.superModalOverlay.hidden = true;
    superEditando = null;
  }

  if (els.btnSuperNuevo) els.btnSuperNuevo.addEventListener('click', () => abrirSuperModal(null));
  if (els.btnSuperRefresh) els.btnSuperRefresh.addEventListener('click', cargarSuperAdmins);
  if (els.superBtnCancelar) els.superBtnCancelar.addEventListener('click', cerrarSuperModal);
  if (els.superModalOverlay) els.superModalOverlay.addEventListener('click', (e) => { if (e.target === els.superModalOverlay) cerrarSuperModal(); });
  if (els.superForm) els.superForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = els.superUsuario.value.trim();
    const password = els.superPassword.value;
    let ok = true;
    document.getElementById('error-super-usuario').textContent = '';
    document.getElementById('error-super-password').textContent = '';
    if (!usuario) { document.getElementById('error-super-usuario').textContent = 'Usuario requerido.'; ok = false; }
    if (!password || password.length < 6) { document.getElementById('error-super-password').textContent = 'Contraseña mínimo 6 caracteres.'; ok = false; }
    if (!ok) return;
    const authHeader = getAuthHeader();
    els.superBtnGuardar.disabled = true;
    if (els.superBtnGuardarLabel) els.superBtnGuardarLabel.textContent = 'Guardando…';
    try {
      let res;
      if (superEditando) {
        res = await fetch(`${API_BASE}/super-admins/${encodeURIComponent(superEditando)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: authHeader }, body: JSON.stringify({ password }) });
      } else {
        res = await fetch(`${API_BASE}/super-admins`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authHeader }, body: JSON.stringify({ usuario, password }) });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { els.superModalError.textContent = data.error || 'No se pudo guardar.'; return; }
      showToast(superEditando ? `Contraseña de "${superEditando}" actualizada.` : `Super "${usuario}" creado.`);
      cerrarSuperModal();
      cargarSuperAdmins();
    } catch (_) { els.superModalError.textContent = 'No se pudo conectar.'; }
    finally { els.superBtnGuardar.disabled = false; if (els.superBtnGuardarLabel) els.superBtnGuardarLabel.textContent = superEditando ? 'Actualizar' : 'Crear'; }
  });

  // ---------- Cierre con Escape (todos los modales) ----------
  // Mismo estándar que admin.js (un listener por overlay comprobando
  // !overlay.hidden): aquí se agrupan los 6 overlays de /control en uno
  // solo porque ninguno tenía esta tecla implementada todavía.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.confirmOverlay.hidden) cerrarConfirmacion();
    else if (!els.intakeOverlay.hidden) cerrarIntake();
    else if (!els.editarOverlay.hidden) cerrarEdicion();
    else if (els.credOverlay && !els.credOverlay.hidden) cerrarCredenciales();
    else if (els.sucursalesGrupoOverlay && !els.sucursalesGrupoOverlay.hidden) cerrarGrupoModal();
    else if (els.superModalOverlay && !els.superModalOverlay.hidden) cerrarSuperModal();
    else if (els.ayudaVistaModalOverlay && !els.ayudaVistaModalOverlay.hidden) cerrarAyudaVista();
  });

  // ---------- Ayuda por vista (Fase 5 UX, paridad con admin.js punto 191) ----------
  // Mismo componente que AYUDA_VISTAS/renderTarjetaAyudaVista de admin.js
  // (.inv-ayuda-tarjeta, ya en admin.css), duplicado tal cual — /control es
  // un contenedor/build de Docker aparte, sin código compartido con /admin.
  const AYUDA_VISTAS = {
    empresas: {
      titulo: 'Ayuda — Empresas',
      items: [
        { titulo: 'Provisionando', texto: 'La solicitud de alta ya se registró, pero la base de datos física del tenant todavía no existe — dale clic a "Activar" en esa fila para crearla. Si falla, queda como respaldo el script de aprovisionamiento (acceso root de MySQL).' },
        { titulo: 'Activar', texto: 'Crea la base de datos física de la empresa y le aplica el esquema completo — solo visible mientras está "Provisionando". Puede tardar unos segundos.' },
        { titulo: 'Suspender', texto: 'Pausa temporal y reversible — la empresa deja de ser accesible hasta que la reactives. Útil para intermitencias o falta de pago, sin perder ningún dato.' },
        { titulo: 'Dar de baja', texto: 'Fin de la relación comercial. Igual de reversible que Suspender (el botón "Reactivar" la revive) — no borra la base de datos ni los archivos del tenant.' },
        { titulo: 'Credenciales API', texto: 'Son para integraciones externas (Swagger, sistemas propios de la empresa) — nunca son el usuario/contraseña que un operador usa para entrar a /admin.' },
        { titulo: 'Slug', texto: 'Define las URLs de la empresa (/<slug>/admin, etc.). Se puede cambiar después desde "Editar", pero migra todos sus archivos — mejor no cambiarlo seguido.' },
      ],
    },
    sucursales: {
      titulo: 'Ayuda — Sucursales',
      items: [
        { titulo: '¿Qué es un grupo?', texto: 'Asocia varias empresas (tenants) del mismo negocio. Cada una conserva su propia base de datos, inventario y ventas 100% aislados.' },
        { titulo: '¿Qué se comparte?', texto: 'Solo el inicio de sesión — los usuarios que des de alta en un grupo pueden entrar a /admin de CUALQUIER sucursal asociada con la misma contraseña.' },
        { titulo: 'Perfil de un usuario compartido', texto: 'Administrador entra a todas las secciones habilitadas de la sucursal; Fiscal solo ve Inicio, Tickets y Constancias.' },
        { titulo: 'Quitar el grupo', texto: 'Revoca el acceso compartido de inmediato — cada tenant sigue funcionando normal por su cuenta, con su propio login si ya tenía uno.' },
      ],
    },
    super: {
      titulo: 'Ayuda — Super Admins',
      items: [
        { titulo: '¿Qué es un super?', texto: 'Cuenta ADDV con acceso a /control y a cualquier /<slug>/admin (perfil "super" sin restricciones). Vive en ADMIN_USERS del .env del host, no en la BD.' },
        { titulo: '¿Dónde se gestiona?', texto: 'Solo aquí, en /control → Super Admins. No se puede crear/editar desde /admin (tenants) — 247 híbrido: .env + usuarios super en BD, pero alta solo aquí.' },
        { titulo: '¿Por qué en .env?', texto: 'El .env es la fuente de verdad en disco si la UI falla — el servidor puede leerlo directo por SSH. Se escribe en /app/.env (volumen) y se recarga sin reiniciar vía POST /internal/reload-admin-users.' },
        { titulo: '¿Qué pasa al guardar?', texto: 'Escribe .env (con backup .env.bak), recarga el Map en memoria de control y backend, y audita. Debe quedar al menos uno.' },
      ],
    },
  };

  function renderTarjetaAyudaVista(item) {
    return `
      <article class="inv-ayuda-tarjeta">
        <div class="inv-ayuda-tarjeta-header">
          <h4 class="inv-ayuda-tarjeta-titulo">${escapeHtml(item.titulo)}</h4>
        </div>
        <p class="inv-ayuda-tarjeta-explicacion">${escapeHtml(item.texto)}</p>
      </article>`;
  }

  function abrirAyudaVista(vista) {
    const datos = AYUDA_VISTAS[vista];
    if (!datos || !els.ayudaVistaModalOverlay) return;
    els.ayudaVistaModalTitle.textContent = datos.titulo;
    els.ayudaVistaContenido.innerHTML = datos.items.map(renderTarjetaAyudaVista).join('');
    els.ayudaVistaModalOverlay.hidden = false;
  }

  function cerrarAyudaVista() {
    els.ayudaVistaModalOverlay.hidden = true;
  }

  if (els.btnAyudaVistaEmpresas) els.btnAyudaVistaEmpresas.addEventListener('click', () => abrirAyudaVista('empresas'));
  if (els.btnAyudaVistaSucursales) els.btnAyudaVistaSucursales.addEventListener('click', () => abrirAyudaVista('sucursales'));
  if (els.btnAyudaVistaSuper) els.btnAyudaVistaSuper.addEventListener('click', () => abrirAyudaVista('super'));
  if (els.btnAyudaVistaCerrar) els.btnAyudaVistaCerrar.addEventListener('click', cerrarAyudaVista);
  if (els.ayudaVistaModalOverlay) {
    els.ayudaVistaModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.ayudaVistaModalOverlay) cerrarAyudaVista();
    });
  }

  // ---------- Tooltips (Fase 3 UX, paridad con admin.js — punto 191/193) ----------
  // Idéntico a inicializarTooltips() de admin.js: mismo componente
  // [data-tooltip]/.tooltip-personalizado, ya definido en style.css
  // (compartido por /admin y /control) — aquí solo faltaba el JS que lo
  // activa, /control nunca lo tuvo.
  function inicializarTooltips() {
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'tooltip-personalizado';
    tooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipEl);

    function posicionar(target) {
      const margen = 8;
      const targetRect = target.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();

      let top = targetRect.top - tooltipRect.height - margen;
      let flechaArriba = false;
      if (top < margen) {
        top = targetRect.bottom + margen;
        flechaArriba = true;
      }

      let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
      left = Math.max(margen, Math.min(left, window.innerWidth - tooltipRect.width - margen));

      tooltipEl.style.top = `${top}px`;
      tooltipEl.style.left = `${left}px`;
      tooltipEl.classList.toggle('tooltip-flecha-arriba', flechaArriba);
    }

    function mostrar(target) {
      const texto = target.getAttribute('data-tooltip');
      if (!texto) return;
      tooltipEl.textContent = texto;
      tooltipEl.classList.remove('is-visible');
      posicionar(target);
      requestAnimationFrame(() => {
        posicionar(target);
        requestAnimationFrame(() => tooltipEl.classList.add('is-visible'));
      });
    }

    function ocultar() {
      tooltipEl.classList.remove('is-visible');
    }

    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) mostrar(target);
    });
    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) ocultar();
    });
    document.addEventListener('focusin', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) mostrar(target);
    });
    document.addEventListener('focusout', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) ocultar();
    });
    document.addEventListener('scroll', ocultar, true);
  }

  // ---------- Inicialización ----------

  // ---------- Centro de conocimiento (mismo patrón que /admin) ----------

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  const CONOCIMIENTO_CATEGORIAS = {
    empresas: {
      titulo: 'Empresas',
      lead: 'Alta, edición y ciclo de vida de cada tenant.',
      pasos: [
        { t: 'Dar de alta una empresa', d: '"Nueva empresa" solo registra la solicitud (queda en estado "Provisionando") — todavía no crea nada físico.' },
        { t: 'Activar', d: 'Botón "Activar" en una fila "Provisionando" crea la base de datos real del tenant y la deja accesible en /‹slug›/admin. Puede tardar unos segundos.' },
        { t: 'Editar', d: 'Cambia los datos base o, con el switch "Cambiar slug (avanzado)", el slug mismo — esto migra todos sus archivos (logo, facturas, etc.) antes de completar el cambio.' },
        { t: 'Suspender / Reactivar / Dar de baja', d: 'Ninguna de las tres borra datos: solo cambian si el tenant es accesible. "Dar de baja" y "Suspender" son igual de reversibles con "Reactivar".' },
        { t: 'Eliminar definitivo / Vaciar papelera', d: 'Solo alcanzable desde "Baja" (candado extra). A diferencia de las 3 acciones de arriba, esto SÍ borra todo — base de datos y archivos — para siempre, no se puede deshacer. Pide escribir el slug exacto (o "ELIMINAR" para vaciar toda la papelera de una vez) antes de dejar confirmar. El historial de auditoría se conserva aunque la empresa ya no exista.' },
        { t: 'Credenciales API', d: 'Para integraciones externas (Swagger, consumo directo) — no son la contraseña de inicio de sesión del operador del tenant.' },
        { t: 'Identidad visual y cuota', d: 'Al editar una empresa: colores/tipografía/logo propios (si el switch de marca está activo) y el máximo de cuentas de panel que puede tener.' },
        { t: 'Entrar directo al panel del tenant', d: 'El slug de la tabla es un enlace — abre /‹slug›/admin en una pestaña nueva, solo si el tenant está activo.' },
      ],
    },
    sucursales: {
      titulo: 'Sucursales',
      lead: 'Agrupa varios tenants del mismo negocio con acceso compartido.',
      pasos: [
        { t: 'Qué resuelve', d: 'Un negocio con varias tiendas (cada una su propio tenant, su propio inventario y ventas) que quiere que su personal entre a cualquiera con la misma cuenta.' },
        { t: 'Usuarios compartidos', d: 'Se crean aparte de los usuarios normales de cada tenant — la misma contraseña abre el panel de cualquier sucursal del grupo, pero cada una sigue viendo solo sus propios datos.' },
        { t: 'Revocar acceso', d: 'Eliminar el grupo (o al usuario compartido) corta el acceso de inmediato a todas las sucursales a la vez.' },
      ],
    },
    'super-admins': {
      titulo: 'Super Admins',
      lead: 'Quién tiene acceso total a /admin de cualquier tenant y a /control.',
      pasos: [
        { t: 'Qué es un Super Admin', d: 'Una credencial de ADMIN_USERS — entra a /control y al /admin de CUALQUIER tenant o del sitio base, sin restricción de vistas.' },
        { t: 'Alta, cambio de contraseña, baja', d: 'Se gestiona desde aquí mismo, sin tocar el servidor ni reiniciar ningún contenedor — el cambio aplica de inmediato.' },
        { t: 'No confundir con un usuario de panel', d: 'Las cuentas administrador/fiscal/ventas de un tenant (vista "Usuarios" de su /admin) solo entran a SU propio tenant — un Super Admin es un nivel aparte, por encima de todos.' },
      ],
    },
  };

  function renderPasoTarjetaConocimiento(p, i, termino, reducido) {
    let t = escapeHtml(p.t);
    let d = escapeHtml(p.d);
    let esMatch = false;
    if (termino) {
      const re = new RegExp(`(${termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
      if (re.test(t) || re.test(d)) {
        esMatch = true;
        t = t.replace(re, '<mark>$1</mark>');
        d = d.replace(re, '<mark>$1</mark>');
      }
    }
    return `
      <div class="conocimiento-paso" style="transition-delay:${reducido ? 0 : i * 55}ms">
        <div class="conocimiento-paso-rail"><div class="conocimiento-paso-num">${i + 1}</div><div class="conocimiento-paso-linea"></div></div>
        <div class="conocimiento-paso-tarjeta${esMatch ? ' is-match' : ''}"><b>${t}</b><p>${d}</p></div>
      </div>`;
  }

  function renderCategoriaConocimiento(catKey, termino) {
    const datos = CONOCIMIENTO_CATEGORIAS[catKey];
    if (!datos || !els.conocimientoMainBody) return;
    const reducido = prefersReducedMotion();
    let html = `<h3 class="conocimiento-cat-titulo">${escapeHtml(datos.titulo)}</h3><p class="conocimiento-cat-lead">${escapeHtml(datos.lead)}</p>`;
    datos.pasos.forEach((p, i) => { html += renderPasoTarjetaConocimiento(p, i, termino, reducido); });
    els.conocimientoMainBody.innerHTML = html;
    els.conocimientoTitle.textContent = datos.titulo;
    els.conocimientoMainBody.scrollTop = 0;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        els.conocimientoMainBody.querySelectorAll('.conocimiento-paso').forEach((el) => el.classList.add('is-in'));
      });
    });
  }

  let conocimientoCatActual = 'empresas';

  function seleccionarCategoriaConocimiento(catKey) {
    if (!CONOCIMIENTO_CATEGORIAS[catKey]) return;
    conocimientoCatActual = catKey;
    els.conocimientoNav.querySelectorAll('.conocimiento-nav-item').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.cat === catKey);
    });
    renderCategoriaConocimiento(catKey, els.conocimientoBuscar.value.trim());
  }

  function mostrarCategoriaMovilConocimiento() {
    els.conocimientoSidebar.classList.add('is-oculta-movil');
    els.conocimientoMain.classList.remove('is-oculta-movil');
  }
  function mostrarListaMovilConocimiento() {
    els.conocimientoSidebar.classList.remove('is-oculta-movil');
    els.conocimientoMain.classList.add('is-oculta-movil');
  }

  function filtrarConocimiento() {
    const q = els.conocimientoBuscar.value.trim().toLowerCase();
    if (!q) {
      els.conocimientoNav.querySelectorAll('.conocimiento-nav-item').forEach((btn) => { btn.hidden = false; });
      els.conocimientoNavEmpty.hidden = true;
      renderCategoriaConocimiento(conocimientoCatActual, '');
      return;
    }
    const coincidencias = new Set();
    Object.entries(CONOCIMIENTO_CATEGORIAS).forEach(([key, datos]) => {
      const texto = (datos.titulo + ' ' + datos.pasos.map((p) => `${p.t} ${p.d}`).join(' ')).toLowerCase();
      if (texto.includes(q)) coincidencias.add(key);
    });
    let algunaVisible = false;
    els.conocimientoNav.querySelectorAll('.conocimiento-nav-item').forEach((btn) => {
      const visible = coincidencias.has(btn.dataset.cat);
      btn.hidden = !visible;
      if (visible) algunaVisible = true;
    });
    els.conocimientoNavEmpty.hidden = algunaVisible;
    if (coincidencias.size && !coincidencias.has(conocimientoCatActual)) {
      conocimientoCatActual = coincidencias.values().next().value;
      els.conocimientoNav.querySelectorAll('.conocimiento-nav-item').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.cat === conocimientoCatActual);
      });
    }
    renderCategoriaConocimiento(conocimientoCatActual, q);
  }

  function abrirConocimiento(enfocarBuscador) {
    els.conocimientoBuscar.value = '';
    els.conocimientoNav.querySelectorAll('.conocimiento-nav-item').forEach((btn) => { btn.hidden = false; });
    els.conocimientoNavEmpty.hidden = true;
    seleccionarCategoriaConocimiento('empresas');
    mostrarListaMovilConocimiento();
    els.conocimientoOverlay.hidden = false;
    if (enfocarBuscador) els.conocimientoBuscar.focus();
  }
  function cerrarConocimiento() {
    els.conocimientoOverlay.hidden = true;
  }

  if (els.btnAbrirConocimiento) els.btnAbrirConocimiento.addEventListener('click', () => abrirConocimiento(false));
  if (els.btnAbrirConocimientoTopbar) els.btnAbrirConocimientoTopbar.addEventListener('click', () => abrirConocimiento(true));
  if (els.btnCerrarConocimiento) els.btnCerrarConocimiento.addEventListener('click', cerrarConocimiento);
  if (els.conocimientoOverlay) {
    els.conocimientoOverlay.addEventListener('click', (e) => {
      if (e.target === els.conocimientoOverlay) cerrarConocimiento();
    });
  }
  if (els.conocimientoBtnVolver) els.conocimientoBtnVolver.addEventListener('click', mostrarListaMovilConocimiento);
  if (els.conocimientoBuscar) els.conocimientoBuscar.addEventListener('input', filtrarConocimiento);
  if (els.conocimientoNav) {
    els.conocimientoNav.querySelectorAll('.conocimiento-nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        seleccionarCategoriaConocimiento(btn.dataset.cat);
        mostrarCategoriaMovilConocimiento();
      });
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.conocimientoOverlay && !els.conocimientoOverlay.hidden) cerrarConocimiento();
  });

  // Verificación de sesión guardada al abrir /control — antes, un fetch
  // colgado (servidor lento de verdad, no solo tardado) dejaba el
  // shimmer encendido para siempre, y uno que fallaba de plano
  // (servidor caído/sin red) caía en silencio a la pantalla de login,
  // indistinguible de "no hay sesión guardada". Ahora: a los 5s reales
  // sin respuesta aparece un aviso de espera (sin mínimo artificial —
  // una respuesta normal nunca lo alcanza a ver, mismo criterio del
  // esqueleto de carga); a los 15s se cancela con AbortController y se
  // muestra el error real + "Reintentar", en vez de asumir que fue un
  // 401.
  const UMBRAL_ESPERA_SESION_MS = 5000;
  const TOPE_DURO_SESION_MS = 15000;

  function verificarSesionGuardada() {
    if (els.shellEsqueletoEspera) els.shellEsqueletoEspera.classList.remove('is-visible');
    if (els.shellEsqueletoError) els.shellEsqueletoError.classList.remove('is-visible');
    if (els.shellEsqueleto) els.shellEsqueleto.classList.remove('is-error');

    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    // Mismo criterio que /admin: esqueleto del shell en vez del login
    // parpadeando mientras se verifica la sesión guardada.
    els.loginScreen.hidden = true;
    if (els.shellEsqueleto) els.shellEsqueleto.hidden = false;

    function mostrarErrorShell() {
      if (els.shellEsqueletoEspera) els.shellEsqueletoEspera.classList.remove('is-visible');
      if (els.shellEsqueletoError) els.shellEsqueletoError.classList.add('is-visible');
      if (els.shellEsqueleto) els.shellEsqueleto.classList.add('is-error');
    }

    const controlador = new AbortController();
    const timeoutEspera = setTimeout(() => {
      if (els.shellEsqueletoEspera) els.shellEsqueletoEspera.classList.add('is-visible');
    }, UMBRAL_ESPERA_SESION_MS);
    const timeoutDuro = setTimeout(() => controlador.abort(), TOPE_DURO_SESION_MS);

    fetch(`${API_BASE}/tenants`, { headers: { Authorization: authHeader }, signal: controlador.signal })
      .then((res) => {
        clearTimeout(timeoutEspera);
        clearTimeout(timeoutDuro);
        if (res.ok) {
          return res.json().then((data) => {
            if (els.shellEsqueleto) els.shellEsqueleto.hidden = true;
            showDashboard(sessionStorage.getItem(SESSION_USER_KEY) || 'Sesión activa');
            renderTenants(data.tenants || []);
          });
        }
        // 502/503/504 (nginx sin upstream vivo) / 500 real: el servidor
        // está caído o fallando, no la sesión — mismo error que un fetch
        // rechazado. Antes esto caía en el mismo "clearSession+showLogin"
        // de abajo, indistinguible de una sesión vencida de verdad.
        if (res.status >= 500) {
          mostrarErrorShell();
          return;
        }
        if (els.shellEsqueleto) els.shellEsqueleto.hidden = true;
        clearSession();
        showLogin();
      })
      .catch(() => {
        clearTimeout(timeoutEspera);
        clearTimeout(timeoutDuro);
        mostrarErrorShell();
      });
  }

  if (els.btnShellReintentar) els.btnShellReintentar.addEventListener('click', verificarSesionGuardada);

  (function init() {
    inicializarTooltips();
    verificarSesionGuardada();
  })();
})();
