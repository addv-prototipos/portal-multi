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

  // Punto 370: máximo de imagen (MB) configurable, un solo valor global
  // de plataforma (tabla ajustes_globales) — reemplaza el hardcode
  // MARCA_LOGO_MAX_MB = 2 que vivía antes repartido entre el intake y el
  // modal de edición. Se recarga al entrar a Super Admins
  // (cargarImagenMax()); el default local es solo el valor mientras esa
  // carga no haya llegado todavía.
  let imagenMaxMbActual = 2;

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
    filtroProximosVencer: document.getElementById('control-filtro-proximos-vencer'),
    count: document.getElementById('control-count'),
    error: document.getElementById('control-error'),
    tableBody: document.getElementById('control-table-body'),
    empty: document.getElementById('control-empty'),
    filtroEmpty: document.getElementById('control-filtro-empty'),
    btnEmptyNuevaEmpresa: document.getElementById('btn-control-empty-nueva-empresa'),
    toast: document.getElementById('control-toast'),
    btnMenuMovil: document.getElementById('btn-control-menu-movil'),
    menuMovil: document.getElementById('control-menu-movil'),
    btnColapsarSidebar: document.getElementById('control-btn-colapsar-sidebar'),
    adminHeader: document.querySelector('.admin-dashboard .admin-header'),
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
    editarSlug: document.getElementById('control-editar-slug'),
    editarSlugSwitch: document.getElementById('control-editar-slug-switch'),
    editarSlugHint: document.getElementById('control-editar-slug-hint'),
  editarEmail: document.getElementById('control-editar-email'),
  editarNotas: document.getElementById('control-editar-notas'),
  editarMaxUsuarios: document.getElementById('control-editar-max-usuarios'),
  editarMarcaLookfeelSwitch: document.getElementById('control-editar-marca-lookfeel-switch'),
  temaBody: document.getElementById('control-tema-body'),
  // Punto 210: pestañas del modal + "Plan y funciones"
  editarTabs: document.querySelectorAll('.control-edit-tab'),
  editarPlanNombreActual: document.getElementById('control-editar-plan-nombre-actual'),
  editarPlanPrecioActual: document.getElementById('control-editar-plan-precio-actual'),
  btnReaplicarPlan: document.getElementById('control-btn-reaplicar-plan'),
  editarPlanSelect: document.getElementById('control-editar-plan-select'),
  editarFacturacionSwitch: document.getElementById('control-editar-facturacion-switch'),
  editarPortalSwitch: document.getElementById('control-editar-portal-switch'),
  editarSucursalesSwitch: document.getElementById('control-editar-sucursales-switch'),
  editarDiscoCuota: document.getElementById('control-editar-disco-cuota'),
  editarDiscoUsoTexto: document.getElementById('control-editar-disco-uso-texto'),
  editarDiscoUsoTrack: document.getElementById('control-editar-disco-uso-track'),
  editarDiscoUsoFill: document.getElementById('control-editar-disco-uso-fill'),
  editarImpactoBanner: document.getElementById('control-editar-impacto-banner'),
  editarImpactoBannerTexto: document.getElementById('control-editar-impacto-banner-texto'),
  btnRecalcularDisco: document.getElementById('control-btn-recalcular-disco'),
  editarGrupoInfo: document.getElementById('control-editar-grupo-info'),
  btnEditarIrSucursales: document.getElementById('control-btn-editar-ir-sucursales'),
  // Punto 381: Suscripción (prueba/ciclo/expiración/estatus de cobro)
  suscripcionEnPrueba: document.getElementById('control-suscripcion-en-prueba'),
  suscripcionDiasPrueba: document.getElementById('control-suscripcion-dias-prueba'),
  suscripcionPruebaInicia: document.getElementById('control-suscripcion-prueba-inicia'),
  suscripcionCiclo: document.getElementById('control-suscripcion-ciclo'),
  suscripcionExpira: document.getElementById('control-suscripcion-expira'),
  suscripcionEstatus: document.getElementById('control-suscripcion-estatus'),
  suscripcionError: document.getElementById('control-suscripcion-error'),
  suscripcionRing: document.getElementById('control-suscripcion-ring'),
  suscripcionRingTexto: document.getElementById('control-suscripcion-ring-texto'),
  suscripcionResumen: document.getElementById('control-suscripcion-resumen'),
  btnGuardarSuscripcion: document.getElementById('control-btn-guardar-suscripcion'),
  btnGuardarSuscripcionLabel: document.getElementById('control-btn-guardar-suscripcion-label'),
    editarError: document.getElementById('control-editar-error'),
    btnEditarCancelar: document.getElementById('control-btn-editar-cancelar'),
    btnEditarGuardar: document.getElementById('control-btn-editar-guardar'),
    btnEditarGuardarLabel: document.getElementById('control-btn-editar-guardar-label'),

    // §58: Sucursales
    btnVistaEmpresas: document.getElementById('btn-vista-control-empresas'),
    btnVistaPlanes: document.getElementById('btn-vista-control-planes'),
    btnVistaSucursales: document.getElementById('btn-vista-control-sucursales'),
    btnVistaSuper: document.getElementById('btn-vista-control-super'),
    btnVistaAuditoria: document.getElementById('btn-vista-control-auditoria'),
    vistaEmpresas: document.getElementById('vista-control-empresas'),
    vistaPlanes: document.getElementById('vista-control-planes'),
    vistaPapelera: document.getElementById('vista-control-papelera'),
    vistaSucursales: document.getElementById('vista-control-sucursales'),
    vistaSuper: document.getElementById('vista-control-super'),
    vistaAuditoria: document.getElementById('vista-control-auditoria'),
    // Punto 347: Auditoría cross-tenant
    btnAyudaVistaAuditoria: document.getElementById('btn-ayuda-vista-auditoria'),
    auditoriaFiltroActor: document.getElementById('auditoria-filtro-actor'),
    btnLimpiarAuditoriaActor: document.getElementById('btn-limpiar-auditoria-actor'),
    auditoriaFiltroTenant: document.getElementById('auditoria-filtro-tenant'),
    btnLimpiarAuditoriaTenant: document.getElementById('btn-limpiar-auditoria-tenant'),
    auditoriaFiltroDesde: document.getElementById('auditoria-filtro-desde'),
    auditoriaFiltroHasta: document.getElementById('auditoria-filtro-hasta'),
    auditoriaFiltroLimite: document.getElementById('auditoria-filtro-limite'),
    btnLimpiarFiltrosAuditoria: document.getElementById('btn-limpiar-filtros-auditoria'),
    auditoriaFiltrosChips: document.getElementById('auditoria-filtros-chips'),
    auditoriaError: document.getElementById('auditoria-error'),
    auditoriaTableBody: document.getElementById('auditoria-table-body'),
    auditoriaEmpty: document.getElementById('auditoria-empty'),
    auditoriaEmptyTitulo: document.getElementById('auditoria-empty-titulo'),
    auditoriaEmptyTexto: document.getElementById('auditoria-empty-texto'),
    // Punto 347: Planes
    planesCount: document.getElementById('planes-count'),
    planesError: document.getElementById('planes-error'),
    planesTableBody: document.getElementById('planes-table-body'),
    planesEmpty: document.getElementById('planes-empty'),
    btnPlanesNuevo: document.getElementById('btn-planes-nuevo'),
    btnPlanesEmptyNuevo: document.getElementById('btn-planes-empty-nuevo'),
    planesModalOverlay: document.getElementById('planes-modal-overlay'),
    planesModalTitle: document.getElementById('planes-modal-title'),
    btnPlanesModalCerrar: document.getElementById('btn-planes-modal-cerrar'),
    planesNombre: document.getElementById('planes-nombre'),
    planesDescripcion: document.getElementById('planes-descripcion'),
    planesPrecioMensual: document.getElementById('planes-precio-mensual'),
    planesPrecioAnual: document.getElementById('planes-precio-anual'),
    planesMaxUsuarios: document.getElementById('planes-max-usuarios'),
    planesDiscoCuota: document.getElementById('planes-disco-cuota'),
    planesModalError: document.getElementById('planes-modal-error'),
    btnPlanesCancelar: document.getElementById('btn-planes-cancelar'),
    btnPlanesGuardar: document.getElementById('btn-planes-guardar'),
    btnPlanesGuardarLabel: document.getElementById('btn-planes-guardar-label'),
    // Punto 349-350-351: asistente de 4 pasos
    btnPlanesWizardAtras: document.getElementById('btn-planes-wizard-atras'),
    planesWizardBanner: document.getElementById('planes-wizard-banner'),
    planesWizardBannerTexto: document.getElementById('planes-wizard-banner-texto'),
    planesWizardSteps: document.getElementById('planes-wizard-steps'),
    planesWizardPanel1: document.getElementById('planes-wizard-panel-1'),
    planesWizardPanel2: document.getElementById('planes-wizard-panel-2'),
    planesWizardPanel3: document.getElementById('planes-wizard-panel-3'),
    planesWizardPanel4: document.getElementById('planes-wizard-panel-4'),
    planesWizardModulos: document.getElementById('planes-wizard-modulos'),
    planesWizardDependientes: document.getElementById('planes-wizard-dependientes'),
    planesWizardResumenBody: document.getElementById('planes-wizard-resumen-body'),
    btnAyudaVistaPlanes: document.getElementById('btn-ayuda-vista-planes'),
    btnAyudaVistaPapelera: document.getElementById('btn-ayuda-vista-papelera'),
    btnVerPapelera: document.getElementById('control-btn-ver-papelera'),
    btnPapeleraVolver: document.getElementById('btn-papelera-volver-empresas'),
    papeleraCount: document.getElementById('papelera-count'),
    papeleraError: document.getElementById('papelera-error'),
    papeleraTableBody: document.getElementById('papelera-table-body'),
    papeleraEmpty: document.getElementById('papelera-empty'),
    btnPapeleraRefresh: document.getElementById('btn-papelera-refresh'),
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

    // Punto 370: ajuste global "Ajustes de imágenes"
    btnToggleImagenMax: document.getElementById('btn-toggle-imagen-max'),
    imagenMaxConfigBody: document.getElementById('imagen-max-config-body'),
    imagenMaxMbInput: document.getElementById('imagen-max-mb'),
    btnGuardarImagenMax: document.getElementById('btn-guardar-imagen-max'),
    btnGuardarImagenMaxLabel: document.getElementById('btn-guardar-imagen-max-label'),
    imagenMaxError: document.getElementById('imagen-max-error'),
    imagenMaxInfo: document.getElementById('imagen-max-info'),
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

  // Riel colapsable del sidebar — mismo comportamiento y CSS que /admin
  // (admin.css: .admin-body.sidebar-colapsado, clase sobre <body>, ya
  // presente en ambas páginas). Estado por cuenta en localStorage, mismo
  // patrón que claveColapsoSidebar() de admin.js.
  function claveColapsoSidebarControl() {
    return `sidebar_colapso_control_v1_${els.userLabel.textContent || ''}`;
  }

  function aplicarEstadoColapsoSidebarControl(colapsado) {
    document.body.classList.toggle('sidebar-colapsado', colapsado);
    if (els.btnColapsarSidebar) {
      els.btnColapsarSidebar.setAttribute('aria-pressed', String(colapsado));
      els.btnColapsarSidebar.setAttribute('aria-label', colapsado ? 'Expandir menú lateral' : 'Colapsar menú lateral');
    }
    document.querySelectorAll(
      '.admin-sidebar-nav .admin-vista-btn, .admin-sidebar-footer .admin-sidebar-logout, .admin-sidebar-footer .admin-sidebar-ayuda'
    ).forEach((btn) => {
      const span = btn.querySelector('span');
      if (!span) return;
      if (colapsado) btn.setAttribute('data-tooltip', span.textContent.trim());
      else btn.removeAttribute('data-tooltip');
    });
  }

  if (els.btnColapsarSidebar) {
    els.btnColapsarSidebar.addEventListener('click', () => {
      const colapsado = !document.body.classList.contains('sidebar-colapsado');
      aplicarEstadoColapsoSidebarControl(colapsado);
      try {
        localStorage.setItem(claveColapsoSidebarControl(), colapsado ? '1' : '0');
      } catch (_) {
        // sin acceso a localStorage: el colapso de esta sesión sigue
        // funcionando, solo no se recuerda para la próxima.
      }
    });
  }

  // Barra superior siempre visible (position:fixed vía admin.css, ya
  // compartido con /admin) — el acento cian al hacer scroll es puramente
  // de JS, mismo criterio que reubicarCampanaPorBreakpoint de admin.js.
  if (els.adminHeader) {
    window.addEventListener('scroll', () => {
      els.adminHeader.classList.toggle('is-scrolled', window.scrollY > 4);
    }, { passive: true });
  }

  function showDashboard(usuario) {
    els.loginScreen.hidden = true;
    els.dashboard.hidden = false;
    els.userLabel.textContent = usuario;
    // Punto 370: se precarga una vez por sesión (igual que otros datos de
    // arranque) — los hints de intake/editar/favicon lo necesitan desde
    // el primer modal que se abra, sin depender de haber visitado antes
    // Super Admins.
    cargarImagenMaxGlobal();
    let colapsoGuardado = false;
    try {
      colapsoGuardado = localStorage.getItem(claveColapsoSidebarControl()) === '1';
    } catch (_) {
      // sin acceso a localStorage: arranca expandido, comportamiento de
      // siempre.
    }
    aplicarEstadoColapsoSidebarControl(colapsoGuardado);
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
  if (els.filtroProximosVencer) {
    // Client-side puro: ya tenemos todos los tenants de la carga actual en
    // caché (tenantsCacheActual), no hace falta volver a pedirle nada al
    // backend solo por cambiar este filtro.
    els.filtroProximosVencer.addEventListener('change', () => renderTenants(tenantsCacheActual));
  }

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

  const ETIQUETA_ESTATUS_SUSCRIPCION = {
    prueba: 'Prueba',
    pagada: 'Pagada',
    pendiente: 'Pendiente',
    vencida: 'Vencida',
    cancelada: 'Cancelada',
  };

  // Celda "Vence" de la tabla principal (punto 381) — mismo criterio de
  // badge que "Estado": una pastilla con color semántico, nunca solo
  // texto plano, para que el riesgo de vencimiento se lea de un vistazo.
  function celdaVenceHtml(t) {
    if (!t.suscripcion_expira_en) return '<span class="estatus-badge estatus-vence-na">Sin configurar</span>';
    if (t.suscripcion_estatus === 'cancelada') {
      return '<span class="estatus-badge estatus-vence-vencido">Cancelada</span>';
    }
    const dias = diasEntreHoyY(fechaSoloDia(t.suscripcion_expira_en));
    const fechaTexto = formatFecha(t.suscripcion_expira_en);
    const etiquetaEstatus = ETIQUETA_ESTATUS_SUSCRIPCION[t.suscripcion_estatus] || '';
    const sufijo = etiquetaEstatus ? ` · ${escapeHtml(etiquetaEstatus)}` : '';
    if (dias < 0) {
      return `<span class="estatus-badge estatus-vence-vencido" data-tooltip="${escapeHtml(fechaTexto)}">Vencida${sufijo}</span>`;
    }
    if (dias <= 7) {
      return `<span class="estatus-badge estatus-vence-proximo" data-tooltip="${escapeHtml(fechaTexto)}">${dias} día${dias === 1 ? '' : 's'}${sufijo}</span>`;
    }
    return `<span class="estatus-badge estatus-vence-ok" data-tooltip="${escapeHtml(fechaTexto)}">${dias} días${sufijo}</span>`;
  }

  // Punto 381: filtro "Próximos a vencer" es client-side — listarTenants()
  // ya trae las 6 columnas de suscripción en cada fetch, así que no hace
  // falta un parámetro de query nuevo ni una segunda llamada al backend.
  function tenantProximoAVencer(t) {
    if (!t.suscripcion_expira_en || t.suscripcion_estatus === 'cancelada') return false;
    const dias = diasEntreHoyY(fechaSoloDia(t.suscripcion_expira_en));
    return dias !== null && dias <= 7;
  }

  let tenantsCacheActual = [];

  function renderTenants(tenants) {
    tenantsCacheActual = tenants;
    const filtrados = els.filtroProximosVencer && els.filtroProximosVencer.checked
      ? tenants.filter(tenantProximoAVencer)
      : tenants;
    els.count.textContent = `${filtrados.length} tenant${filtrados.length === 1 ? '' : 's'}`;
    els.tableBody.innerHTML = '';
    const hayFiltro = Boolean(els.filtroEstado.value || els.searchInput.value.trim() || (els.filtroProximosVencer && els.filtroProximosVencer.checked));
    els.empty.hidden = filtrados.length > 0 || hayFiltro;
    if (els.filtroEmpty) els.filtroEmpty.hidden = filtrados.length > 0 || !hayFiltro;

    filtrados.forEach((t) => {
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
        <td data-label="Vence">${celdaVenceHtml(t)}</td>
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
      if (els.vistaPapelera && !els.vistaPapelera.hidden) cargarPapelera();
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
        if (els.vistaPapelera && !els.vistaPapelera.hidden) cargarPapelera();
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

  // ---------- Vista "Papelera" (punto 345b) ----------
  // Vista dedicada, separada de "Empresas" — solo lista tenants en estado
  // "Baja". El botón "Vaciar papelera" SOLO vive dentro de esta vista (no
  // en "Empresas"), así nunca aparece de entrada en el listado general.
  async function obtenerTenantsBaja() {
    const authHeader = getAuthHeader();
    if (!authHeader) return [];
    try {
      const res = await fetch(`${API_BASE}/tenants?estado=baja`, { headers: { Authorization: authHeader } });
      if (!res.ok) return [];
      const data = await res.json();
      return data.tenants || [];
    } catch (err) {
      return [];
    }
  }

  async function cargarPapelera() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.papeleraError.textContent = '';
    Esqueleto.aplicarEsqueletoTabla(els.papeleraTableBody, 5);
    try {
      const res = await fetch(`${API_BASE}/tenants?estado=baja`, { headers: { Authorization: authHeader } });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.papeleraTableBody, 5, 'No se pudo cargar la papelera.', cargarPapelera);
        return;
      }
      const data = await res.json();
      renderPapelera(data.tenants || []);
      Esqueleto.quitarEsqueletoTabla(els.papeleraTableBody);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.papeleraTableBody, 5, 'No se pudo conectar con el servidor.', cargarPapelera);
    }
  }

  function renderPapelera(tenants) {
    els.papeleraCount.textContent = `${tenants.length} empresa${tenants.length === 1 ? '' : 's'}`;
    els.papeleraTableBody.innerHTML = '';
    els.papeleraEmpty.hidden = tenants.length > 0;
    els.btnVaciarPapelera.hidden = tenants.length === 0;

    tenants.forEach((t) => {
      const tr = document.createElement('tr');
      tr.dataset.slug = t.slug;
      tr.innerHTML = `
        <td data-label="Slug"><strong>${escapeHtml(t.slug)}</strong></td>
        <td data-label="Empresa">${escapeHtml(t.nombre_empresa)}</td>
        <td data-label="Contacto">${escapeHtml(t.contacto_email) || '—'}</td>
        <td data-label="Creado">${formatFecha(t.creado_en)}</td>
        <td data-label=""></td>
      `;

      const celdaAcciones = tr.lastElementChild;
      const contenedorAcciones = document.createElement('div');
      contenedorAcciones.className = 'admin-row-actions';

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
      contenedorAcciones.appendChild(
        crearBotonAccion('btn-icono-accion btn-icono-accion-peligro', 'Eliminar definitivo', 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', () =>
          abrirModalEliminarTenant(t)
        )
      );

      celdaAcciones.appendChild(contenedorAcciones);
      els.papeleraTableBody.appendChild(tr);
    });
  }

  if (els.btnPapeleraRefresh) els.btnPapeleraRefresh.addEventListener('click', () => cargarPapelera());

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
    cargarPapelera();
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

  els.btnVaciarPapelera.addEventListener('click', async () => {
    const tenantsBaja = await obtenerTenantsBaja();
    if (!tenantsBaja.length) return;
    resetModalVaciar();
    els.vaciarCantidad.textContent = `${tenantsBaja.length} ${tenantsBaja.length === 1 ? 'empresa' : 'empresas'}`;
    els.vaciarLista.innerHTML = tenantsBaja.map((t) => `<li>${escapeHtml(t.nombre_empresa)}</li>`).join('');
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
        if (archivoLogo.size > imagenMaxMbActual * 1024 * 1024) {
          setFieldErrorIntake('intake-logo', `El logo excede el tamaño máximo permitido de ${imagenMaxMbActual} MB.`);
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

  let slugActualEdicion = null;
  // Punto 347: plan_id que el tenant YA tenía al abrir el modal — solo si
  // el operador cambia la selección del <select> se manda planId al
  // guardar (ver el submit handler); si no, cada guardado reasignaría el
  // mismo plan sobre cualquier excepción ya hecha.
  let planIdOriginalEdicion = null;
  let planesCacheEdicion = null; // null = todavía no se cargó
  // Punto 350/351 (Regla 8 extendida): uso real de usuarios cuotables del
  // tenant que se está editando — null mientras no se conoce (todavía no
  // respondió el backend) o si no se pudo confirmar; el banner se oculta
  // en ambos casos, nunca advierte con un dato que no es real.
  let usoUsuariosActualEdicion = null;

  async function cargarUsoUsuariosEdicion(slug) {
    usoUsuariosActualEdicion = null;
    const authHeader = getAuthHeader();
    try {
      const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(slug)}/uso-usuarios`, {
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Number.isInteger(data.total)) {
        usoUsuariosActualEdicion = data.total;
      }
    } catch (err) {
      usoUsuariosActualEdicion = null;
    }
    renderImpactoBannerEdicion();
  }

  // Aviso de impacto ANTES de guardar (Regla 8 extendida a edición de
  // empresa, punto 350) — fijo desde que se abre la pestaña "Plan y
  // funciones", se recalcula en vivo mientras el operador cambia el plan
  // o escribe un máximo de usuarios nuevo, nunca solo al guardar.
  function renderImpactoBannerEdicion() {
    if (!els.editarImpactoBanner) return;
    const maxTexto = els.editarMaxUsuarios.value;
    const maxUsuarios = maxTexto === '' ? null : Number(maxTexto);
    if (
      usoUsuariosActualEdicion == null ||
      maxUsuarios == null ||
      !Number.isFinite(maxUsuarios) ||
      maxUsuarios >= usoUsuariosActualEdicion
    ) {
      els.editarImpactoBanner.hidden = true;
      return;
    }
    const excedente = usoUsuariosActualEdicion - maxUsuarios;
    const plural = excedente === 1 ? '' : 's';
    els.editarImpactoBanner.hidden = false;
    els.editarImpactoBannerTexto.textContent =
      `Esta empresa tiene ${usoUsuariosActualEdicion} usuario(s) activo(s) y el límite nuevo es ${maxUsuarios} — ` +
      `al guardar se suspenderán ${excedente} usuario${plural} no administrador${plural} (los más recientes primero).`;
  }

  async function asegurarPlanesCacheEdicion() {
    if (planesCacheEdicion) return planesCacheEdicion;
    const authHeader = getAuthHeader();
    try {
      const res = await fetch(`${API_BASE}/planes`, { headers: { Authorization: authHeader } });
      if (!res.ok) return [];
      const data = await res.json();
      planesCacheEdicion = data.planes || [];
    } catch (err) {
      planesCacheEdicion = [];
    }
    return planesCacheEdicion;
  }

  function poblarSelectPlanes(planIdActual) {
    els.editarPlanSelect.innerHTML = '<option value="">Sin plan (configurar a mano abajo)</option>';
    (planesCacheEdicion || []).forEach((p) => {
      const opt = document.createElement('option');
      opt.value = String(p.id);
      opt.textContent = p.nombre;
      els.editarPlanSelect.appendChild(opt);
    });
    els.editarPlanSelect.value = planIdActual ? String(planIdActual) : '';
  }

  // "del plan" si el valor actual del switch coincide con lo que trae el
  // plan seleccionado; "excepción" si no — sin plan seleccionado, no hay
  // base contra qué comparar y el badge se deja vacío.
  function actualizarBadgesOrigenPlan() {
    const plan = (planesCacheEdicion || []).find((p) => String(p.id) === els.editarPlanSelect.value);
    const campos = [
      ['badge-origen-facturacion', els.editarFacturacionSwitch, 'facturacion_habilitada'],
      ['badge-origen-portal', els.editarPortalSwitch, 'portal_clientes_habilitado'],
      ['badge-origen-sucursales', els.editarSucursalesSwitch, 'sucursales_habilitado'],
      ['badge-origen-marca', els.editarMarcaLookfeelSwitch, 'marca_lookfeel_habilitado'],
    ];
    campos.forEach(([id, switchEl, campoPlan]) => {
      const badge = document.getElementById(id);
      if (!badge) return;
      if (!plan) {
        badge.textContent = '';
        badge.className = 'planes-badge-origen';
        return;
      }
      const delPlan = switchEl.checked === Boolean(plan[campoPlan]);
      badge.textContent = delPlan ? 'del plan' : 'excepción';
      badge.className = `planes-badge-origen ${delPlan ? 'del-plan' : 'excepcion'}`;
    });
  }

  function mostrarPlanActual(plan) {
    if (!plan) {
      els.editarPlanNombreActual.textContent = 'Sin plan asignado';
      els.editarPlanPrecioActual.textContent = '';
      els.btnReaplicarPlan.hidden = true;
      return;
    }
    els.editarPlanNombreActual.textContent = plan.nombre;
    els.editarPlanPrecioActual.textContent = formatPrecioPlan(plan);
    els.btnReaplicarPlan.hidden = false;
  }

  // Punto 347: pinta el uso real de disco (caché, nunca en vivo) contra
  // la cuota configurada. "Sin calcular" hasta el primer "Recalcular".
  function mostrarUsoDisco(tenant) {
    const cuotaMb = tenant.disco_cuota_mb != null ? Number(tenant.disco_cuota_mb) : null;
    const usadoBytes = tenant.disco_bytes_usados_cache != null ? Number(tenant.disco_bytes_usados_cache) : null;

    if (usadoBytes == null) {
      els.editarDiscoUsoTexto.textContent = 'Uso de disco: sin calcular todavía.';
      els.editarDiscoUsoTrack.hidden = true;
      return;
    }

    const usadoMb = usadoBytes / (1024 * 1024);
    const usadoTexto = usadoMb >= 1024 ? `${(usadoMb / 1024).toFixed(2)} GB` : `${usadoMb.toFixed(1)} MB`;

    if (cuotaMb == null) {
      els.editarDiscoUsoTexto.textContent = `Uso de disco: ${usadoTexto} (sin cuota — sin límite).`;
      els.editarDiscoUsoTrack.hidden = true;
      return;
    }

    const porcentaje = Math.min(100, Math.round((usadoMb / cuotaMb) * 100));
    els.editarDiscoUsoTexto.textContent = `Uso de disco: ${usadoTexto} de ${cuotaMb.toLocaleString('es-MX')} MB (${porcentaje}%).`;
    els.editarDiscoUsoTrack.hidden = false;
    els.editarDiscoUsoFill.style.width = `${porcentaje}%`;
    els.editarDiscoUsoFill.classList.toggle('is-excedida', usadoMb >= cuotaMb);
    els.editarDiscoUsoFill.classList.toggle('is-advertencia', usadoMb < cuotaMb && porcentaje >= 80);
  }

  els.btnRecalcularDisco.addEventListener('click', async () => {
    if (!slugActualEdicion) return;
    const authHeader = getAuthHeader();
    els.btnRecalcularDisco.disabled = true;
    const textoOriginal = els.btnRecalcularDisco.textContent;
    els.btnRecalcularDisco.textContent = 'Calculando…';
    try {
      const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(slugActualEdicion)}/recalcular-disco`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'No se pudo calcular el uso de disco.', true);
        return;
      }
      mostrarUsoDisco(data.tenant);
      showToast('Uso de disco actualizado.');
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    } finally {
      els.btnRecalcularDisco.disabled = false;
      els.btnRecalcularDisco.textContent = textoOriginal;
    }
  });

  // Al elegir un plan distinto en el <select>, sus 6 valores se copian de
  // inmediato a los campos de abajo (vista previa editable) — el
  // operador puede ajustar una excepción puntual antes de guardar.
  els.editarPlanSelect.addEventListener('change', () => {
    const plan = (planesCacheEdicion || []).find((p) => String(p.id) === els.editarPlanSelect.value);
    mostrarPlanActual(plan);
    if (plan) {
      els.editarFacturacionSwitch.checked = Boolean(plan.facturacion_habilitada);
      els.editarPortalSwitch.checked = Boolean(plan.portal_clientes_habilitado);
      els.editarSucursalesSwitch.checked = Boolean(plan.sucursales_habilitado);
      els.editarMarcaLookfeelSwitch.checked = Boolean(plan.marca_lookfeel_habilitado);
      els.editarMaxUsuarios.value = plan.max_usuarios != null ? String(plan.max_usuarios) : '';
      els.editarDiscoCuota.value = plan.disco_cuota_mb != null ? String(plan.disco_cuota_mb) : '';
    }
    actualizarBadgesOrigenPlan();
    renderImpactoBannerEdicion();
  });

  [els.editarFacturacionSwitch, els.editarPortalSwitch, els.editarSucursalesSwitch, els.editarMarcaLookfeelSwitch].forEach((sw) => {
    sw.addEventListener('change', actualizarBadgesOrigenPlan);
  });

  els.btnReaplicarPlan.addEventListener('click', () => {
    if (!slugActualEdicion || !planIdOriginalEdicion) return;
    confirmarAccion({
      titulo: '¿Reaplicar los valores del plan?',
      mensaje: `Vuelve a copiar los 6 valores de "${els.editarPlanNombreActual.textContent}" a esta empresa — cualquier excepción que tenga se pierde.`,
      textoBoton: 'Reaplicar',
      onConfirmar: async () => {
        const authHeader = getAuthHeader();
        try {
          const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(slugActualEdicion)}`, {
            method: 'PUT',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombreEmpresa: els.editarNombre.value.trim(),
              contactoEmail: els.editarEmail.value.trim(),
              reaplicarPlan: true,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            showToast(data.error || 'No se pudo reaplicar el plan.', true);
            return;
          }
          showToast('Valores del plan reaplicados.');
          cerrarEdicion();
          cargarTenants();
        } catch (err) {
          showToast('No se pudo conectar con el servidor.', true);
        }
      },
    });
  });

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
    document.querySelectorAll('#control-form-editar .field-error').forEach((el) => {
      el.textContent = '';
    });
  }

  async function abrirEdicion(tenant) {
    slugActualEdicion = tenant.slug;
    limpiarErroresEditar();
    els.formEditar.reset();
    cerrarSeccionTema();

    els.editarEmpresa.textContent = `Editando ${tenant.nombre_empresa} (${tenant.slug})`;
    els.editarNombre.value = tenant.nombre_empresa || '';
    els.editarEmail.value = tenant.contacto_email || '';
    els.editarNotas.value = tenant.notas || '';
    els.editarMaxUsuarios.value = tenant.max_usuarios != null ? String(tenant.max_usuarios) : '';
    usoUsuariosActualEdicion = null;
    if (els.editarImpactoBanner) els.editarImpactoBanner.hidden = true;
    els.editarMarcaLookfeelSwitch.checked = tenant.marca_lookfeel_habilitado !== 0 && tenant.marca_lookfeel_habilitado !== false;
    els.editarSlug.value = tenant.slug;
    els.editarSlugSwitch.checked = false;
    bloquearSlugEdicion();

    // Punto 347: Plan y funciones — switches reflejan el valor REAL del
    // tenant (no el del plan), para que una excepción ya guardada se vea
    // tal cual al reabrir el modal.
    planIdOriginalEdicion = tenant.plan_id ?? null;
    els.editarFacturacionSwitch.checked = tenant.facturacion_habilitada !== 0 && tenant.facturacion_habilitada !== false;
    els.editarPortalSwitch.checked = tenant.portal_clientes_habilitado !== 0 && tenant.portal_clientes_habilitado !== false;
    els.editarSucursalesSwitch.checked = tenant.sucursales_habilitado === 1 || tenant.sucursales_habilitado === true;
    els.editarDiscoCuota.value = tenant.disco_cuota_mb != null ? String(tenant.disco_cuota_mb) : '';
    mostrarUsoDisco(tenant);

    // Punto 347: Grupo / sucursales — informativo, la gestión real vive
    // en la vista "Sucursales". Punto en curso: si el plan de esta
    // empresa no incluye Sucursales, el mensaje lo deja claro en vez de
    // sugerir una asociación que el backend ahora rechaza de todas formas.
    if (!els.editarSucursalesSwitch.checked) {
      els.editarGrupoInfo.textContent = 'Sucursales no está activado para esta empresa — no puede asociarse a un grupo.';
    } else {
      els.editarGrupoInfo.textContent = tenant.grupo_sucursal_id
        ? 'Esta empresa pertenece a un grupo de sucursales — gestiona sus sucursales y usuarios compartidos desde "Sucursales".'
        : 'Esta empresa no pertenece a ningún grupo de sucursales.';
    }

    els.editarOverlay.hidden = false;
    montarEditorMarcaTemaControl(tenant);
    els.editarNombre.focus();

    await asegurarPlanesCacheEdicion();
    poblarSelectPlanes(planIdOriginalEdicion);
    const planActual = (planesCacheEdicion || []).find((p) => p.id === planIdOriginalEdicion);
    mostrarPlanActual(planActual);
    actualizarBadgesOrigenPlan();
    cargarUsoUsuariosEdicion(tenant.slug);
    poblarFormularioSuscripcion(tenant);
  }

  // ---------- Punto 381: Suscripción (prueba/ciclo/expiración/estatus) ----------

  const CICLO_DIAS_SUSCRIPCION = { mensual: 30, anual: 365 };

  function fechaSoloDia(valor) {
    if (!valor) return null;
    return String(valor).slice(0, 10);
  }

  function diasEntreHoyY(fechaIso) {
    if (!fechaIso) return null;
    const hoy = new Date();
    const hoyUtc = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const [anio, mes, dia] = fechaIso.split('-').map(Number);
    const objetivoUtc = Date.UTC(anio, mes - 1, dia);
    return Math.round((objetivoUtc - hoyUtc) / 86400000);
  }

  function poblarFormularioSuscripcion(tenant) {
    if (!els.suscripcionEnPrueba) return;
    if (els.suscripcionError) els.suscripcionError.textContent = '';
    els.suscripcionEnPrueba.checked = tenant.suscripcion_en_prueba === 1 || tenant.suscripcion_en_prueba === true;
    els.suscripcionDiasPrueba.value = tenant.suscripcion_dias_prueba != null ? String(tenant.suscripcion_dias_prueba) : '';
    els.suscripcionPruebaInicia.value = fechaSoloDia(tenant.suscripcion_prueba_inicia_en) || '';
    els.suscripcionCiclo.value = tenant.suscripcion_ciclo || '';
    els.suscripcionExpira.value = fechaSoloDia(tenant.suscripcion_expira_en) || '';
    els.suscripcionEstatus.value = tenant.suscripcion_estatus || '';
    renderAnilloSuscripcion();
  }

  // El anillo es puramente informativo/en vivo (lee el formulario, no
  // pisa nada del backend): verde = vigente, ámbar = vence en ≤14 días,
  // rojo = vencida o cancelada. Base de "100%" según haya o no un dato de
  // ciclo/prueba que dé contexto de duración total; sin ese dato solo se
  // muestra el conteo de días, sin barra de progreso con sentido.
  function renderAnilloSuscripcion() {
    if (!els.suscripcionRing) return;
    const expira = els.suscripcionExpira.value || null;
    const estatus = els.suscripcionEstatus.value || null;
    const enPrueba = els.suscripcionEnPrueba.checked;
    const diasPrueba = els.suscripcionDiasPrueba.value ? Number(els.suscripcionDiasPrueba.value) : null;
    const ciclo = els.suscripcionCiclo.value || null;

    if (estatus === 'cancelada') {
      pintarAnillo(100, 'var(--color-error)');
      els.suscripcionRingTexto.textContent = '—';
      els.suscripcionResumen.textContent = 'Suscripción cancelada';
      return;
    }

    if (!expira) {
      pintarAnillo(0, 'var(--color-border)');
      els.suscripcionRingTexto.textContent = '—';
      els.suscripcionResumen.textContent = 'Sin fecha de expiración configurada';
      return;
    }

    const diasRestantes = diasEntreHoyY(expira);
    const totalDias = enPrueba && diasPrueba ? diasPrueba : CICLO_DIAS_SUSCRIPCION[ciclo] || null;
    const porcentaje = totalDias ? Math.min(100, Math.max(0, Math.round((diasRestantes / totalDias) * 100))) : 100;

    let color = 'var(--color-accent)';
    let resumen;
    if (diasRestantes < 0) {
      color = 'var(--color-error)';
      resumen = `Vencida hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) === 1 ? '' : 's'}`;
    } else if (diasRestantes <= 14) {
      color = 'var(--color-warn)';
      resumen = `Vence en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}${enPrueba ? ' (prueba)' : ''}`;
    } else {
      resumen = `Vigente — ${diasRestantes} días para vencer${enPrueba ? ' (prueba)' : ''}`;
    }

    pintarAnillo(diasRestantes < 0 ? 100 : porcentaje, color);
    els.suscripcionRingTexto.textContent = diasRestantes < 0 ? `${Math.abs(diasRestantes)}d` : `${diasRestantes}d`;
    els.suscripcionResumen.textContent = resumen;
  }

  function pintarAnillo(porcentaje, color) {
    els.suscripcionRing.style.background = `conic-gradient(${color} 0 ${porcentaje}%, var(--color-border) ${porcentaje}% 100%)`;
  }

  [
    els.suscripcionEnPrueba,
    els.suscripcionDiasPrueba,
    els.suscripcionPruebaInicia,
    els.suscripcionCiclo,
    els.suscripcionExpira,
    els.suscripcionEstatus,
  ].forEach((el) => {
    if (el) el.addEventListener('input', renderAnilloSuscripcion);
  });

  function setGuardandoSuscripcion(isLoading) {
    if (!els.btnGuardarSuscripcion) return;
    els.btnGuardarSuscripcion.disabled = isLoading;
    els.btnGuardarSuscripcion.setAttribute('aria-busy', String(isLoading));
    els.btnGuardarSuscripcionLabel.textContent = isLoading ? 'Guardando…' : 'Guardar suscripción';
  }

  if (els.btnGuardarSuscripcion) {
    els.btnGuardarSuscripcion.addEventListener('click', async () => {
      if (!slugActualEdicion) return;
      const authHeader = getAuthHeader();
      if (!authHeader) {
        showLogin();
        return;
      }
      if (els.suscripcionError) els.suscripcionError.textContent = '';

      const diasPruebaTexto = els.suscripcionDiasPrueba.value.trim();
      let diasPrueba = null;
      if (diasPruebaTexto) {
        const n = Number(diasPruebaTexto);
        if (!Number.isInteger(n) || n <= 0) {
          els.suscripcionError.textContent = 'Los días de prueba deben ser un entero mayor a 0.';
          els.suscripcionDiasPrueba.focus();
          return;
        }
        diasPrueba = n;
      }

      setGuardandoSuscripcion(true);
      try {
        const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(slugActualEdicion)}/suscripcion`, {
          method: 'PUT',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enPrueba: els.suscripcionEnPrueba.checked,
            diasPrueba,
            pruebaIniciaEn: els.suscripcionPruebaInicia.value || null,
            ciclo: els.suscripcionCiclo.value || null,
            expiraEn: els.suscripcionExpira.value || null,
            estatus: els.suscripcionEstatus.value || null,
          }),
        });
        if (res.status === 401) {
          clearSession();
          showLogin();
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          els.suscripcionError.textContent = data.error || 'No se pudo guardar la suscripción.';
          return;
        }
        showToast(`Suscripción de "${slugActualEdicion}" actualizada.`);
        cargarTenants();
      } catch (err) {
        els.suscripcionError.textContent = 'No se pudo conectar con el servidor.';
      } finally {
        setGuardandoSuscripcion(false);
      }
    });
  }

  function cerrarEdicion() {
    els.editarOverlay.hidden = true;
    slugActualEdicion = null;
    planIdOriginalEdicion = null;
    usoUsuariosActualEdicion = null;
    cerrarSeccionTema();
  }

  els.editarMaxUsuarios.addEventListener('input', renderImpactoBannerEdicion);

  if (els.btnEditarIrSucursales) {
    els.btnEditarIrSucursales.addEventListener('click', () => {
      cerrarEdicion();
      cambiarVistaPrincipalControl('sucursales');
    });
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
    const discoCuotaTexto = els.editarDiscoCuota.value.trim();
    let discoCuotaMb = null;
    if (discoCuotaTexto) {
      const n = Number(discoCuotaTexto);
      if (!Number.isInteger(n) || n < 1) {
        setFieldErrorEditar('editar-disco-cuota', 'Debe ser un número entero mayor a 0, o vacío para no limitar.');
        els.editarDiscoCuota.focus();
        return;
      }
      discoCuotaMb = n;
    }
    // Solo se manda planId si el operador REALMENTE cambió la selección —
    // si no, cada guardado (aunque sea de otro campo cualquiera)
    // reasignaría el mismo plan una y otra vez, pisando en silencio
    // cualquier excepción que el tenant ya tuviera (ver tenantEdicion.js:
    // resolverPlanYFunciones copia TODO el plan cuando planId viene en
    // el body, sea "nuevo" o no).
    const planIdSeleccionado = els.editarPlanSelect.value ? Number(els.editarPlanSelect.value) : null;
    const planCambioDeSeleccion = planIdSeleccionado !== planIdOriginalEdicion;
    setEdicionLoading(true);
    try {
      // Marca (nombre): logo/favicon/colores ya se guardan de inmediato
      // desde la pestaña "Identidad visual" (montarEditorMarcaTemaControl,
      // mismo módulo compartido que /admin) — SOLO el campo de texto
      // "marca" sigue viajando en este PUT general, leído directo del
      // input que ese módulo renderiza dentro de #control-tema-body
      // (normalizarDatosBase lo trata como obligatorio-opcional: omitirlo
      // lo pondría en null, así que siempre se manda el valor actual).
      const marcaInput = document.getElementById('met-marca-nombre');
      const marcaActual = marcaInput ? marcaInput.value.trim() || null : undefined;

      const res = await fetch(`${API_BASE}/tenants/${encodeURIComponent(slugActualEdicion)}`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreEmpresa: nombre,
          slug: els.editarSlugSwitch.checked ? slug : undefined,
          contactoEmail: email || null,
          notas: els.editarNotas.value.trim() || null,
          marca: marcaActual,
          maxUsuarios,
          marcaLookfeelHabilitado: els.editarMarcaLookfeelSwitch.checked,
          discoCuotaMb,
          facturacionHabilitada: els.editarFacturacionSwitch.checked,
          portalClientesHabilitado: els.editarPortalSwitch.checked,
          sucursalesHabilitado: els.editarSucursalesSwitch.checked,
          planId: planCambioDeSeleccion && planIdSeleccionado ? planIdSeleccionado : undefined,
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

  // ---------- Pestañas del modal "Editar empresa" ----------
  // General / Plan y funciones / Identidad visual / Grupo-sucursales. El
  // botón Guardar general vive FUERA de los paneles (siempre visible) —
  // cambiar de pestaña nunca descarta datos ya capturados en otra. La
  // pestaña "Identidad visual" ya NO comparte ese botón: se guarda sola
  // (ver montarEditorMarcaTemaControl), mismo criterio que /admin.
  function cambiarTabEditar(tab) {
    const TABS = ['general', 'plan', 'suscripcion', 'visual', 'grupo'];
    TABS.forEach((t) => {
      const panel = document.getElementById(`control-edit-tab-${t}`);
      if (panel) panel.hidden = t !== tab;
    });
    els.editarTabs.forEach((btn) => {
      const activo = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', activo);
      btn.setAttribute('aria-selected', String(activo));
    });
  }

  els.editarTabs.forEach((btn) => {
    btn.addEventListener('click', () => cambiarTabEditar(btn.dataset.tab));
  });

  function cerrarSeccionTema() {
    cambiarTabEditar('general');
  }

  // ---------- "Identidad visual" del modal de edición (Punto 210) ----------
  // Marca, logo, colores, radio y favicon — mismo módulo compartido que
  // /admin (frontend/marcaTemaEditor.js), apuntando a los endpoints YA
  // existentes de /control (PUT .../marca y .../tema, segmento "Look &
  // Feel" original). A diferencia de /admin (donde el backend ya hace
  // merge server-side), aquí el favicon/quitarFavicon deben reenviar
  // colores+radio vigentes junto con el cambio — ver el 2do argumento
  // `estadoTema` que el módulo pasa a subirFavicon/quitarFavicon
  // (PUT /tema reemplaza tema_json completo, no hace merge parcial).
  function montarEditorMarcaTemaControl(tenant) {
    if (!els.temaBody || !window.EditorMarcaTema) return;
    const leerTema = (t) => {
      if (!t || !t.tema_json) return {};
      try {
        return JSON.parse(t.tema_json) || {};
      } catch (err) {
        return {};
      }
    };
    const urlMarca = () => `${API_BASE}/tenants/${encodeURIComponent(slugActualEdicion)}/marca`;
    const urlTema = () => `${API_BASE}/tenants/${encodeURIComponent(slugActualEdicion)}/tema`;

    window.EditorMarcaTema.montar(els.temaBody, {
      showToast,
      limiteMb: () => imagenMaxMbActual,
      cargar: () => Promise.resolve({
        marca: tenant.marca || null,
        marcaLogoUrl: tenant.marca_logo_url || null,
        tema: leerTema(tenant),
      }),
      guardarMarca: async (marca) => {
        const res = await fetch(urlMarca(), {
          method: 'PUT',
          headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ marca }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo guardar la marca.');
        return data;
      },
      guardarTema: async (tema) => {
        const res = await fetch(urlTema(), {
          method: 'PUT',
          headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ tema }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo guardar la identidad visual.');
        return data;
      },
      // Única acción de esta pestaña con diálogo de confirmación: a
      // diferencia de /admin (donde el operador solo se afecta a sí
      // mismo), aquí un super está borrando la identidad visual de OTRA
      // empresa — mismo criterio que ya tenía esta pantalla antes de la
      // migración al módulo compartido. Cancelar simplemente no resuelve
      // la promesa (el botón no queda en estado de carga, no hay nada que
      // destrabar).
      restablecerTema: () => new Promise((resolve, reject) => {
        confirmarAccion({
          titulo: 'Restablecer identidad visual',
          mensaje: 'La empresa volverá al diseño base de la plataforma (colores, radio de esquinas y favicon por defecto — el logo y el nombre de marca no se tocan). Esta acción no se puede deshacer.',
          textoBoton: 'Restablecer',
          onConfirmar: async () => {
            try {
              const res = await fetch(urlTema(), {
                method: 'PUT',
                headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ restablecer: true }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                reject(new Error(data.error || 'No se pudo restablecer la identidad visual.'));
                return;
              }
              resolve(data);
            } catch (err) {
              reject(new Error('No se pudo conectar con el servidor.'));
            }
          },
        });
      }),
      subirLogo: async (archivo) => {
        const base64 = await leerArchivoComoBase64(archivo);
        const res = await fetch(urlMarca(), {
          method: 'PUT',
          headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ logoBase64: base64 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo subir el logo.');
        return { marcaLogoUrl: data.tenant ? data.tenant.marca_logo_url : null };
      },
      quitarLogo: async () => {
        const res = await fetch(urlMarca(), {
          method: 'PUT',
          headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ quitarLogo: true }),
        });
        if (!res.ok) throw new Error('No se pudo quitar el logo.');
        return res.json();
      },
      subirFavicon: async (archivo, estadoTema) => {
        const base64 = await leerArchivoComoBase64(archivo);
        const res = await fetch(urlTema(), {
          method: 'PUT',
          headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ tema: estadoTema, faviconBase64: base64 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo subir el favicon.');
        return { faviconUrl: leerTema(data.tenant).faviconUrl || null };
      },
      quitarFavicon: async (estadoTema) => {
        const res = await fetch(urlTema(), {
          method: 'PUT',
          headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ tema: estadoTema, quitarFavicon: true }),
        });
        if (!res.ok) throw new Error('No se pudo quitar el favicon.');
        return res.json();
      },
    });
  }

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

  // ---------- Punto 347: Planes (gobierno de funcionalidades) ----------
  // Catálogo independiente de cualquier tenant — se crea/nombra aquí,
  // se asigna después desde la ficha de cada empresa (Fase 3). Editar un
  // plan NUNCA toca a los tenants que ya lo tienen asignado (los valores
  // se copiaron al momento de asignar, no quedan ligados en vivo).

  let planEditandoId = null; // null = modal en modo "crear"

  function formatMoneda(valor) {
    if (valor === null || valor === undefined) return null;
    return `$${Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  function formatPrecioPlan(plan) {
    const mensual = formatMoneda(plan.precio_mensual);
    const anual = formatMoneda(plan.precio_anual);
    if (!mensual && !anual) return 'A cotizar';
    const partes = [];
    if (mensual) partes.push(`${mensual}/mes`);
    if (anual) partes.push(`${anual}/año`);
    return partes.join(' · ');
  }

  function chipsFuncionesPlan(plan) {
    const chips = [];
    chips.push({ texto: plan.max_usuarios ? `${plan.max_usuarios} usuarios` : 'Usuarios sin límite', on: true });
    chips.push({ texto: 'Facturación', on: plan.facturacion_habilitada });
    chips.push({ texto: 'Ventas', on: plan.ventas_habilitado });
    chips.push({ texto: 'Gastos', on: plan.gastos_habilitado });
    chips.push({ texto: 'Inventarios', on: plan.inventarios_habilitado });
    chips.push({ texto: 'Auditoría', on: plan.auditoria_habilitado });
    chips.push({ texto: 'Portal clientes', on: plan.portal_clientes_habilitado });
    chips.push({ texto: 'Sucursales', on: plan.sucursales_habilitado });
    chips.push({ texto: 'Marca propia', on: plan.marca_lookfeel_habilitado });
    chips.push({ texto: 'Promociones', on: plan.promociones_habilitado });
    chips.push({ texto: plan.disco_cuota_mb ? `${plan.disco_cuota_mb.toLocaleString('es-MX')} MB` : 'Disco sin límite', on: true });
    return chips
      .filter((c) => c.on)
      .map((c) => `<span class="planes-chip">${escapeHtml(c.texto)}</span>`)
      .join('');
  }

  async function cargarPlanes() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.planesError.textContent = '';
    Esqueleto.aplicarEsqueletoTabla(els.planesTableBody, 5);
    try {
      const res = await fetch(`${API_BASE}/planes?incluirArchivados=true`, { headers: { Authorization: authHeader } });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.planesTableBody, 5, 'No se pudieron cargar los planes.', cargarPlanes);
        return;
      }
      const data = await res.json();
      renderPlanes(data.planes || []);
      Esqueleto.quitarEsqueletoTabla(els.planesTableBody);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.planesTableBody, 5, 'No se pudo conectar con el servidor.', cargarPlanes);
    }
  }

  function renderPlanes(planes) {
    els.planesCount.textContent = `${planes.length} plan${planes.length === 1 ? '' : 'es'}`;
    els.planesTableBody.innerHTML = '';
    els.planesEmpty.hidden = planes.length > 0;

    planes.forEach((p) => {
      const tr = document.createElement('tr');
      const nombreHtml = p.activo
        ? `<strong>${escapeHtml(p.nombre)}</strong>`
        : `<strong>${escapeHtml(p.nombre)}</strong> <span class="planes-chip-archivado">Archivado</span>`;
      const descripcionHtml = p.descripcion ? `<br><span class="field-hint" style="margin:0">${escapeHtml(p.descripcion)}</span>` : '';
      tr.innerHTML = `
        <td data-label="Plan">${nombreHtml}${descripcionHtml}</td>
        <td data-label="Precio">${escapeHtml(formatPrecioPlan(p))}</td>
        <td data-label="Funciones incluidas"><div class="planes-chip-grupo">${chipsFuncionesPlan(p)}</div></td>
        <td data-label="Empresas" class="col-num">${p.total_tenants || 0}</td>
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
          () => abrirPlanModal(p.id)
        )
      );
      if (p.activo) {
        contenedorAcciones.appendChild(
          crearBotonAccion('btn-icono-accion', 'Archivar', 'M2 3h20v5H2zM4 8v13h16V8M10 12h4', () =>
            confirmarAccion({
              titulo: '¿Archivar este plan?',
              mensaje: `"${p.nombre}" deja de ofrecerse para asignar a empresas nuevas. Las ${p.total_tenants || 0} empresa(s) que ya lo tienen asignado siguen funcionando exactamente igual — reversible con "Reactivar".`,
              textoBoton: 'Archivar',
              onConfirmar: () => cambiarEstadoPlan(p.id, 'archivar'),
            })
          )
        );
      } else {
        contenedorAcciones.appendChild(
          crearBotonAccion('btn-icono-accion', 'Reactivar', 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5', () =>
            confirmarAccion({
              titulo: '¿Reactivar este plan?',
              mensaje: `"${p.nombre}" vuelve a ofrecerse para asignar a empresas nuevas.`,
              textoBoton: 'Reactivar',
              onConfirmar: () => cambiarEstadoPlan(p.id, 'reactivar'),
            })
          )
        );
      }
      celdaAcciones.appendChild(contenedorAcciones);
      els.planesTableBody.appendChild(tr);
    });
  }

  async function cambiarEstadoPlan(id, accion) {
    const authHeader = getAuthHeader();
    try {
      const res = await fetch(`${API_BASE}/planes/${id}/${accion}`, {
        method: 'PUT',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || `No se pudo ${accion === 'archivar' ? 'archivar' : 'reactivar'} el plan.`, true);
        return;
      }
      showToast(accion === 'archivar' ? 'Plan archivado.' : 'Plan reactivado.');
      cargarPlanes();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // ---------- Modal de plan: asistente de 4 pasos (punto 349-350-351) ----------
  // Datos básicos → Módulos → Dependientes → Resumen. Porta
  // stitch/gobierno-funcionalidades/wizard-funcional-reglas.html (ya
  // aprobado por el usuario) a producción. Las 12 reglas de dependencia
  // viven de verdad en control/utils/planes.js:validarReglasDependencia
  // (y tenantEdicion.js:validarReglasDependenciaTenant) — lo de aquí es
  // solo el REFLEJO en la UI (deshabilitar controles, auto-activar,
  // avisar) para que el super admin nunca llegue a un guardado rechazado
  // por sorpresa.

  const ICONO_CHECK_WIZARD =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  const MODULOS_WIZARD_DEF = [
    { campo: 'facturacion_habilitada', titulo: 'Facturación', desc: 'Tickets, constancias, CFDI',
      icono: '<path d="M9 14l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>' },
    { campo: 'ventas_habilitado', titulo: 'Ventas', desc: 'Vista Ventas, base de Cuentas por cobrar',
      icono: '<path d="M4 7h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 7Z" stroke-linejoin="round"/><path d="M8 7V5a4 4 0 0 1 8 0v2" stroke-linecap="round"/>' },
    { campo: 'gastos_habilitado', titulo: 'Gastos', desc: 'Vista Gastos, proveedores de gasto',
      icono: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke-linecap="round"/>' },
    { campo: 'inventarios_habilitado', titulo: 'Inventarios', desc: 'Catálogo, proveedores, expiración',
      icono: '<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke-linecap="round" stroke-linejoin="round"/>' },
    { campo: 'auditoria_habilitado', titulo: 'Auditoría', desc: 'Bitácora de cambios (por tenant, en /admin)',
      icono: '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-5 8l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>' },
    { campo: 'portal_clientes_habilitado', titulo: 'Portal de clientes', desc: 'Acceso externo para el cliente final',
      icono: '<path d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>' },
    { campo: 'sucursales_habilitado', titulo: 'Sucursales (grupo)', desc: 'Switcher entre empresas relacionadas',
      icono: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m-1 4h1m4-4h1m-1 4h1M9 21v-4h6v4" stroke-linecap="round" stroke-linejoin="round"/>' },
    { campo: 'marca_lookfeel_habilitado', titulo: 'Marca propia', desc: 'Look & feel personalizado',
      icono: '<path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h14a2 2 0 012 2v9M7 21h10a2 2 0 002-2M7 21a2 2 0 002-2v-2" stroke-linecap="round" stroke-linejoin="round"/>' },
    // Campana del portal de cliente → Promociones (punto en curso):
    // independiente, sin prerrequisito — mismo criterio que
    // auditoria_habilitado/marca_lookfeel_habilitado de arriba, nunca
    // entra en REPORTES_WIZARD_DEF ni en ninguna regla de dependencia.
    { campo: 'promociones_habilitado', titulo: 'Promociones', desc: 'Enviar promociones a clientes (campana del portal)',
      icono: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 7l9 6 9-6" stroke-linecap="round" stroke-linejoin="round"/>' },
  ];

  // Las 4 pestañas reales de la vista "Reportes" en /admin
  // (frontend/admin.js, PESTANAS_REPORTES) — independientes entre sí y de
  // resumen_financiero_habilitado (confirmado explícitamente por el
  // usuario, 2026-10-01).
  const REPORTES_WIZARD_DEF = [
    { campo: 'reportes_por_reporte_habilitado', etiqueta: 'Por reporte (automático / manual / cierre mensual)',
      modulos: ['facturacion', 'ventas'], requiere: 'Facturación o Ventas',
      habilitado: () => planWizardState.facturacion_habilitada || planWizardState.ventas_habilitado },
    { campo: 'reportes_cortes_habilitado', etiqueta: 'Cortes de ventas',
      modulos: ['ventas'], requiere: 'Ventas',
      habilitado: () => planWizardState.ventas_habilitado },
    { campo: 'reportes_eliminados_habilitado', etiqueta: 'Eliminados (ledger cruzado)',
      modulos: ['ventas', 'gastos'], requiere: 'Ventas o Gastos',
      habilitado: () => planWizardState.ventas_habilitado || planWizardState.gastos_habilitado },
    { campo: 'reportes_estado_inventario_habilitado', etiqueta: 'Estado del inventario',
      modulos: ['inventarios'], requiere: 'Inventarios',
      habilitado: () => planWizardState.inventarios_habilitado },
    { campo: 'reportes_estado_tickets_habilitado', etiqueta: 'Estado de tickets',
      modulos: ['facturacion'], requiere: 'Facturación',
      habilitado: () => planWizardState.facturacion_habilitada },
  ];

  const CHIP_DEP_NOMBRES = { facturacion: 'Facturación', ventas: 'Ventas', gastos: 'Gastos', inventarios: 'Inventarios' };

  function planWizardStateVacio() {
    return {
      facturacion_habilitada: false,
      ventas_habilitado: false,
      gastos_habilitado: false,
      inventarios_habilitado: false,
      auditoria_habilitado: false,
      portal_clientes_habilitado: true,
      sucursales_habilitado: false,
      marca_lookfeel_habilitado: false,
      cxc_habilitado: false,
      resumen_financiero_habilitado: false,
      reportes_por_reporte_habilitado: false,
      reportes_cortes_habilitado: false,
      reportes_eliminados_habilitado: false,
      reportes_estado_inventario_habilitado: false,
      reportes_estado_tickets_habilitado: false,
      promociones_habilitado: false,
    };
  }

  let planWizardState = planWizardStateVacio();
  let planWizardPaso = 1;
  let planWizardTotalTenants = 0;
  const PLANES_WIZARD_TOTAL_PASOS = 4;

  function resumenFinancieroDisponibleWizard() {
    return planWizardState.ventas_habilitado || planWizardState.gastos_habilitado;
  }
  function proveedoresVisibleWizard() {
    return planWizardState.inventarios_habilitado || planWizardState.gastos_habilitado;
  }
  function reportesVisibleWizard() {
    return REPORTES_WIZARD_DEF.some((d) => planWizardState[d.campo]);
  }

  function revisarCascadaReportesWizard() {
    REPORTES_WIZARD_DEF.forEach((def) => {
      if (!def.habilitado() && planWizardState[def.campo]) {
        planWizardState[def.campo] = false;
        showToast(`Se desmarcó "${def.etiqueta}": requiere ${def.requiere}.`);
      }
    });
  }

  function alternarModuloWizard(campo) {
    const encendiendo = !planWizardState[campo];
    planWizardState[campo] = encendiendo;

    if (campo === 'ventas_habilitado' || campo === 'gastos_habilitado') {
      const otroCampo = campo === 'ventas_habilitado' ? 'gastos_habilitado' : 'ventas_habilitado';
      const habiaDatosAntes = planWizardState[otroCampo];
      if (encendiendo && !habiaDatosAntes && !planWizardState.resumen_financiero_habilitado) {
        planWizardState.resumen_financiero_habilitado = true;
        showToast('Resumen financiero se activó automáticamente: ya hay datos de Ventas o Gastos que mostrar.');
      }
      if (!encendiendo && !resumenFinancieroDisponibleWizard() && planWizardState.resumen_financiero_habilitado) {
        planWizardState.resumen_financiero_habilitado = false;
        showToast('Se desactivó Resumen financiero: ya no hay Ventas ni Gastos activos.');
      }
      if (campo === 'ventas_habilitado' && !encendiendo && planWizardState.cxc_habilitado) {
        planWizardState.cxc_habilitado = false;
        showToast('Se desactivó Cuentas por cobrar: depende de Ventas.');
      }
    }

    if (campo === 'portal_clientes_habilitado' && encendiendo && !planWizardState.facturacion_habilitada) {
      showToast('Aviso: el portal de clientes no mostrará nada útil sin Facturación activa.');
    }
    if (campo === 'facturacion_habilitada' && !encendiendo && planWizardState.portal_clientes_habilitado) {
      showToast('Aviso: el portal de clientes sigue encendido pero sin Facturación no mostrará nada útil.');
    }

    if (['facturacion_habilitada', 'ventas_habilitado', 'gastos_habilitado', 'inventarios_habilitado'].includes(campo)) {
      revisarCascadaReportesWizard();
    }

    renderPlanWizardTodo();
  }

  function alternarDependienteWizard(campo) {
    // Los switches con "disabled" nunca disparan "change" al no poder
    // clickearse — no hace falta bloqueo de respaldo aquí.
    planWizardState[campo] = !planWizardState[campo];
    renderPlanWizardTodo();
  }

  function alternarReporteWizard(campo) {
    const def = REPORTES_WIZARD_DEF.find((d) => d.campo === campo);
    if (!def || !def.habilitado()) return; // defensivo — el checkbox ya está disabled
    planWizardState[campo] = !planWizardState[campo];
    renderPlanWizardTodo();
  }

  function renderChipsDepWizard(modulos) {
    if (!modulos || !modulos.length) return '';
    return (
      '<span class="planes-wizard-chips">' +
      modulos.map((m) => `<span class="planes-wizard-chip-dep m-${m}">${CHIP_DEP_NOMBRES[m]}</span>`).join('') +
      '</span>'
    );
  }

  function renderPlanWizardSteps() {
    const nombres = ['Datos básicos', 'Módulos', 'Dependientes', 'Resumen'];
    let html = '';
    for (let i = 1; i <= PLANES_WIZARD_TOTAL_PASOS; i++) {
      const cls = ['planes-wizard-step'];
      if (i === planWizardPaso) cls.push('is-active');
      else if (i < planWizardPaso) cls.push('is-done');
      const circ = i < planWizardPaso ? ICONO_CHECK_WIZARD : i;
      html += `<div class="${cls.join(' ')}"><span class="planes-wizard-step-circ">${circ}</span>${nombres[i - 1]}</div>`;
      if (i < PLANES_WIZARD_TOTAL_PASOS) html += '<div class="planes-wizard-line"></div>';
    }
    els.planesWizardSteps.innerHTML = html;
  }

  function renderPlanWizardBanner() {
    if (planEditandoId && planWizardTotalTenants > 0) {
      els.planesWizardBanner.hidden = false;
      const plural = planWizardTotalTenants === 1 ? '' : 's';
      els.planesWizardBannerTexto.textContent =
        `Este plan tiene ${planWizardTotalTenants} empresa${plural} asignada${plural} — cualquier cambio que guardes aplica de inmediato a todas ellas.`;
    } else {
      els.planesWizardBanner.hidden = true;
    }
  }

  function renderPlanWizardPanels() {
    [els.planesWizardPanel1, els.planesWizardPanel2, els.planesWizardPanel3, els.planesWizardPanel4].forEach((panel, idx) => {
      panel.classList.toggle('is-active', idx + 1 === planWizardPaso);
    });
    els.btnPlanesWizardAtras.hidden = planWizardPaso === 1;
    els.btnPlanesGuardarLabel.textContent =
      planWizardPaso === PLANES_WIZARD_TOTAL_PASOS ? (planEditandoId ? 'Guardar cambios' : 'Guardar plan') : 'Siguiente';
  }

  function renderPlanWizardModulos() {
    els.planesWizardModulos.innerHTML = MODULOS_WIZARD_DEF.map((def) => {
      const sel = planWizardState[def.campo] ? ' is-selected' : '';
      const check = planWizardState[def.campo] ? ICONO_CHECK_WIZARD : '';
      return `<button type="button" class="planes-wizard-modulo-card${sel}" data-modulo="${def.campo}">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${def.icono}</svg>
        <div><div class="planes-wizard-modulo-titulo">${def.titulo}</div><div class="planes-wizard-modulo-desc">${def.desc}</div></div>
        <span class="planes-wizard-modulo-check">${check}</span>
      </button>`;
    }).join('');
    els.planesWizardModulos.querySelectorAll('[data-modulo]').forEach((btn) => {
      btn.addEventListener('click', () => alternarModuloWizard(btn.getAttribute('data-modulo')));
    });
  }

  function filaDependienteWizard({ etiqueta, desc, campo, deshabilitado, requiereTxt, modulos, auto }) {
    const encendido = Boolean(planWizardState[campo]);
    const descCls = deshabilitado ? ' is-requiere' : auto ? ' is-auto' : '';
    const textoDesc = deshabilitado && requiereTxt ? `Requiere ${requiereTxt}` : desc;
    return `<div class="planes-wizard-dep-row${deshabilitado ? ' is-disabled' : ''}">
      <div><div class="planes-wizard-dep-label">${etiqueta}${renderChipsDepWizard(modulos)}</div><div class="planes-wizard-dep-desc${descCls}">${textoDesc}</div></div>
      <label class="control-switch" aria-disabled="${deshabilitado ? 'true' : 'false'}">
        <input type="checkbox" data-dep="${campo}" ${encendido ? 'checked' : ''} ${deshabilitado ? 'disabled' : ''} />
        <span class="control-switch-track" aria-hidden="true"></span>
      </label>
    </div>`;
  }

  function filaAutoWizard(etiqueta, desc, modulos) {
    return `<div class="planes-wizard-dep-row">
      <div><div class="planes-wizard-dep-label">${etiqueta}${renderChipsDepWizard(modulos)}</div><div class="planes-wizard-dep-desc is-auto">${desc}</div></div>
      <span class="planes-wizard-dep-pill">Automático</span>
    </div>`;
  }

  function casillaReporteWizard(def) {
    const on = Boolean(planWizardState[def.campo]);
    const hab = def.habilitado();
    return `<label class="planes-wizard-chk-row${hab ? '' : ' is-disabled'}">
      <input type="checkbox" data-reporte="${def.campo}" ${on ? 'checked' : ''} ${hab ? '' : 'disabled'} />
      <span class="planes-wizard-chk-texto">
        <span class="planes-wizard-chk-linea"><span class="planes-wizard-chk-label">${def.etiqueta}</span>${renderChipsDepWizard(def.modulos)}</span>
        ${hab ? '' : `<span class="planes-wizard-chk-requiere">Requiere ${def.requiere}</span>`}
      </span>
    </label>`;
  }

  function renderPlanWizardDependientes() {
    let html = '';
    html += filaDependienteWizard({
      etiqueta: 'Cuentas por cobrar',
      desc: 'Opcional — no se activa sola aunque Ventas esté encendido',
      campo: 'cxc_habilitado',
      deshabilitado: !planWizardState.ventas_habilitado,
      requiereTxt: 'Ventas',
      modulos: ['ventas'],
    });
    html += filaDependienteWizard({
      etiqueta: 'Resumen financiero',
      desc: planWizardState.resumen_financiero_habilitado
        ? 'Activo automáticamente por Ventas/Gastos — se puede apagar'
        : 'Disponible — actívalo si quieres mostrarlo',
      campo: 'resumen_financiero_habilitado',
      deshabilitado: !resumenFinancieroDisponibleWizard(),
      requiereTxt: 'Ventas o Gastos',
      modulos: ['ventas', 'gastos'],
      auto: planWizardState.resumen_financiero_habilitado,
    });
    html += filaAutoWizard(
      'Aviso de expiración de productos',
      'Visible en Configuraciones → Notificaciones del tenant solo si Inventarios está activo — sin interruptor propio aquí',
      ['inventarios']
    );
    if (proveedoresVisibleWizard()) {
      html += filaAutoWizard('Proveedores', 'Alimentado por Inventarios y/o Gastos, sin interruptor propio', ['inventarios', 'gastos']);
    }

    html += '<div class="planes-wizard-reportes">';
    html += '<div class="planes-wizard-reportes-titulo">Reportes</div>';
    html += '<div class="planes-wizard-reportes-nota">Independiente de Resumen financiero — elige qué pestañas de la vista "Reportes" incluye el plan.</div>';
    REPORTES_WIZARD_DEF.forEach((def) => { html += casillaReporteWizard(def); });
    html += '</div>';

    els.planesWizardDependientes.innerHTML = html;
    els.planesWizardDependientes.querySelectorAll('[data-dep]').forEach((input) => {
      input.addEventListener('change', () => alternarDependienteWizard(input.getAttribute('data-dep')));
    });
    els.planesWizardDependientes.querySelectorAll('[data-reporte]').forEach((input) => {
      input.addEventListener('change', () => alternarReporteWizard(input.getAttribute('data-reporte')));
    });
  }

  function renderPlanWizardResumen() {
    function fila(nombre, on) {
      return `<tr><td class="nombre">${nombre}</td><td><span class="planes-chip${on ? '' : ' is-apagado'}">${on ? 'Incluido' : 'Oculto'}</span></td></tr>`;
    }
    function filaN2(nombre, on) {
      return `<tr class="nivel2"><td class="nombre">${nombre}</td><td><span class="planes-chip${on ? '' : ' is-apagado'}">${on ? 'Incluido' : 'Oculto'}</span></td></tr>`;
    }
    let html = '';
    html += fila('Facturación', planWizardState.facturacion_habilitada);
    html += fila('Ventas', planWizardState.ventas_habilitado);
    html += filaN2('Cuentas por cobrar', planWizardState.cxc_habilitado);
    html += fila('Gastos', planWizardState.gastos_habilitado);
    html += fila('Resumen financiero', planWizardState.resumen_financiero_habilitado);
    html += fila('Reportes', reportesVisibleWizard());
    REPORTES_WIZARD_DEF.forEach((def) => { html += filaN2(def.etiqueta, planWizardState[def.campo]); });
    html += fila('Inventarios', planWizardState.inventarios_habilitado);
    html += filaN2('Proveedores', proveedoresVisibleWizard());
    html += fila('Auditoría', planWizardState.auditoria_habilitado);
    html += fila('Portal de clientes', planWizardState.portal_clientes_habilitado);
    html += fila('Sucursales', planWizardState.sucursales_habilitado);
    html += fila('Marca propia', planWizardState.marca_lookfeel_habilitado);
    html += fila('Promociones', planWizardState.promociones_habilitado);
    els.planesWizardResumenBody.innerHTML = html;
  }

  function renderPlanWizardTodo() {
    renderPlanWizardSteps();
    renderPlanWizardBanner();
    renderPlanWizardPanels();
    renderPlanWizardModulos();
    renderPlanWizardDependientes();
    renderPlanWizardResumen();
  }

  function limpiarErroresPlanModal() {
    els.planesModalError.textContent = '';
    const errorNombre = document.getElementById('error-planes-nombre');
    if (errorNombre) errorNombre.textContent = '';
  }

  async function abrirPlanModal(id) {
    planEditandoId = id;
    planWizardPaso = 1;
    planWizardTotalTenants = 0;
    planWizardState = planWizardStateVacio();
    limpiarErroresPlanModal();
    els.planesModalTitle.textContent = id ? 'Editar plan' : 'Nuevo plan';
    els.planesNombre.value = '';
    els.planesDescripcion.value = '';
    els.planesPrecioMensual.value = '';
    els.planesPrecioAnual.value = '';
    els.planesMaxUsuarios.value = '';
    els.planesDiscoCuota.value = '';
    els.planesModalOverlay.hidden = false;
    renderPlanWizardTodo();

    if (id) {
      const authHeader = getAuthHeader();
      try {
        const res = await fetch(`${API_BASE}/planes/${id}`, { headers: { Authorization: authHeader } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          els.planesModalError.textContent = data.error || 'No se pudo cargar el plan.';
          return;
        }
        const p = data.plan;
        els.planesNombre.value = p.nombre;
        els.planesDescripcion.value = p.descripcion || '';
        els.planesPrecioMensual.value = p.precio_mensual ?? '';
        els.planesPrecioAnual.value = p.precio_anual ?? '';
        els.planesMaxUsuarios.value = p.max_usuarios ?? '';
        els.planesDiscoCuota.value = p.disco_cuota_mb ?? '';
        planWizardState = {
          facturacion_habilitada: Boolean(p.facturacion_habilitada),
          ventas_habilitado: Boolean(p.ventas_habilitado),
          gastos_habilitado: Boolean(p.gastos_habilitado),
          inventarios_habilitado: Boolean(p.inventarios_habilitado),
          auditoria_habilitado: Boolean(p.auditoria_habilitado),
          portal_clientes_habilitado: Boolean(p.portal_clientes_habilitado),
          sucursales_habilitado: Boolean(p.sucursales_habilitado),
          marca_lookfeel_habilitado: Boolean(p.marca_lookfeel_habilitado),
          cxc_habilitado: Boolean(p.cxc_habilitado),
          resumen_financiero_habilitado: Boolean(p.resumen_financiero_habilitado),
          reportes_por_reporte_habilitado: Boolean(p.reportes_por_reporte_habilitado),
          reportes_cortes_habilitado: Boolean(p.reportes_cortes_habilitado),
          reportes_eliminados_habilitado: Boolean(p.reportes_eliminados_habilitado),
          reportes_estado_inventario_habilitado: Boolean(p.reportes_estado_inventario_habilitado),
          reportes_estado_tickets_habilitado: Boolean(p.reportes_estado_tickets_habilitado),
          promociones_habilitado: Boolean(p.promociones_habilitado),
        };
        planWizardTotalTenants = Number(p.total_tenants || 0);
        renderPlanWizardTodo();
      } catch (err) {
        els.planesModalError.textContent = 'No se pudo conectar con el servidor.';
      }
    }
    els.planesNombre.focus();
  }

  function cerrarPlanModal() {
    els.planesModalOverlay.hidden = true;
    planEditandoId = null;
  }

  els.btnPlanesNuevo.addEventListener('click', () => abrirPlanModal(null));
  if (els.btnPlanesEmptyNuevo) els.btnPlanesEmptyNuevo.addEventListener('click', () => abrirPlanModal(null));
  els.btnPlanesModalCerrar.addEventListener('click', cerrarPlanModal);
  els.btnPlanesCancelar.addEventListener('click', cerrarPlanModal);
  els.planesModalOverlay.addEventListener('click', (e) => {
    if (e.target === els.planesModalOverlay) cerrarPlanModal();
  });

  els.btnPlanesWizardAtras.addEventListener('click', () => {
    if (planWizardPaso > 1) {
      planWizardPaso--;
      renderPlanWizardTodo();
    }
  });

  els.btnPlanesGuardar.addEventListener('click', async () => {
    limpiarErroresPlanModal();

    if (planWizardPaso === 1) {
      const nombre = els.planesNombre.value.trim();
      if (!nombre) {
        document.getElementById('error-planes-nombre').textContent = 'El nombre del plan es obligatorio.';
        return;
      }
    }

    if (planWizardPaso < PLANES_WIZARD_TOTAL_PASOS) {
      planWizardPaso++;
      renderPlanWizardTodo();
      return;
    }

    // Paso 4: guardar de verdad.
    const nombre = els.planesNombre.value.trim();
    const cuerpo = {
      nombre,
      descripcion: els.planesDescripcion.value.trim(),
      precio_mensual: els.planesPrecioMensual.value === '' ? null : Number(els.planesPrecioMensual.value),
      precio_anual: els.planesPrecioAnual.value === '' ? null : Number(els.planesPrecioAnual.value),
      max_usuarios: els.planesMaxUsuarios.value === '' ? null : Number(els.planesMaxUsuarios.value),
      disco_cuota_mb: els.planesDiscoCuota.value === '' ? null : Number(els.planesDiscoCuota.value),
      ...planWizardState,
    };

    els.btnPlanesGuardar.disabled = true;
    els.btnPlanesGuardarLabel.textContent = 'Guardando…';
    try {
      const authHeader = getAuthHeader();
      const url = planEditandoId ? `${API_BASE}/planes/${planEditandoId}` : `${API_BASE}/planes`;
      const res = await fetch(url, {
        method: planEditandoId ? 'PUT' : 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.planesModalError.textContent = data.error || 'No se pudo guardar el plan.';
        return;
      }
      showToast(planEditandoId ? 'Plan actualizado.' : 'Plan creado.');
      cerrarPlanModal();
      cargarPlanes();
    } catch (err) {
      els.planesModalError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      els.btnPlanesGuardar.disabled = false;
      renderPlanWizardPanels();
    }
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
    if (els.btnVistaPlanes) {
      els.btnVistaPlanes.classList.toggle('is-active', vista === 'planes');
      els.btnVistaPlanes.setAttribute('aria-selected', String(vista === 'planes'));
    }
    els.btnVistaSucursales.classList.toggle('is-active', vista === 'sucursales');
    els.btnVistaSucursales.setAttribute('aria-selected', String(vista === 'sucursales'));
    if (els.btnVistaSuper) {
      els.btnVistaSuper.classList.toggle('is-active', vista === 'super');
      els.btnVistaSuper.setAttribute('aria-selected', String(vista === 'super'));
    }
    if (els.btnVistaAuditoria) {
      els.btnVistaAuditoria.classList.toggle('is-active', vista === 'auditoria');
      els.btnVistaAuditoria.setAttribute('aria-selected', String(vista === 'auditoria'));
    }
    els.vistaEmpresas.hidden = vista !== 'empresas';
    if (els.vistaPlanes) els.vistaPlanes.hidden = vista !== 'planes';
    els.vistaPapelera.hidden = vista !== 'papelera';
    els.vistaSucursales.hidden = vista !== 'sucursales';
    if (els.vistaSuper) els.vistaSuper.hidden = vista !== 'super';
    if (els.vistaAuditoria) els.vistaAuditoria.hidden = vista !== 'auditoria';
    if (vista === 'planes') cargarPlanes();
    if (vista === 'papelera') cargarPapelera();
    if (vista === 'sucursales') cargarSucursales();
    if (vista === 'super') {
      cargarSuperAdmins();
      cargarImagenMaxGlobal();
    }
    if (vista === 'auditoria') cargarAuditoria();
  }

  els.btnVistaEmpresas.addEventListener('click', () => cambiarVistaPrincipalControl('empresas'));
  if (els.btnVistaPlanes) els.btnVistaPlanes.addEventListener('click', () => cambiarVistaPrincipalControl('planes'));
  if (els.btnVerPapelera) els.btnVerPapelera.addEventListener('click', () => cambiarVistaPrincipalControl('papelera'));
  if (els.btnPapeleraVolver) els.btnPapeleraVolver.addEventListener('click', () => cambiarVistaPrincipalControl('empresas'));
  els.btnVistaSucursales.addEventListener('click', () => cambiarVistaPrincipalControl('sucursales'));
  if (els.btnVistaSuper) els.btnVistaSuper.addEventListener('click', () => cambiarVistaPrincipalControl('super'));
  if (els.btnVistaAuditoria) els.btnVistaAuditoria.addEventListener('click', () => cambiarVistaPrincipalControl('auditoria'));
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
      // Punto en curso: una empresa sin "Sucursales" en su plan no puede
      // asociarse a un grupo — ni siquiera se deja marcar aquí (defensa
      // en profundidad: el backend también lo rechaza, ver
      // control/utils/sucursales.js:asociarTenants).
      tenants.forEach((t) => {
        const yaAsociado = slugsAsociados.includes(t.slug);
        const tieneSucursales = t.sucursales_habilitado === 1 || t.sucursales_habilitado === true;
        const label = document.createElement('label');
        label.className = 'gastos-categoria-fila' + (tieneSucursales ? '' : ' is-disabled');
        if (!tieneSucursales) {
          label.title = 'Esta empresa no tiene "Sucursales" activado en su plan';
          label.setAttribute('data-tooltip', 'Esta empresa no tiene "Sucursales" activado en su plan');
        }
        label.innerHTML = `
          <input type="checkbox" value="${escapeHtml(t.slug)}" ${yaAsociado ? 'checked' : ''} ${tieneSucursales ? '' : 'disabled'} />
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
    Esqueleto.aplicarEsqueletoTabla(els.superTableBody, 2);
    try {
      const res = await fetch(`${API_BASE}/super-admins`, { headers: { Authorization: authHeader } });
      if (res.status === 401) { clearSession(); showLogin(); return; }
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.superTableBody, 2, 'No se pudieron cargar los super admins.', cargarSuperAdmins);
        return;
      }
      const data = await res.json();
      renderSuperAdmins(data.superAdmins || []);
      Esqueleto.quitarEsqueletoTabla(els.superTableBody);
    } catch (_) {
      Esqueleto.aplicarErrorTabla(els.superTableBody, 2, 'No se pudo conectar con el servidor.', cargarSuperAdmins);
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
      wrap.appendChild(crearBotonAccion('btn-icono-accion', 'Cambiar contraseña', 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4', () => abrirSuperModal(usuario)));
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

  // ---------- Punto 370: Ajustes de imágenes (ajuste global de plataforma) ----------
  // Mismo patrón de tarjeta colapsable que "Borrado automático de tickets"
  // en /admin (admin.js) — un solo campo numérico + botón Guardar.
  if (els.btnToggleImagenMax) {
    els.btnToggleImagenMax.addEventListener('click', () => {
      const abierto = els.btnToggleImagenMax.getAttribute('aria-expanded') === 'true';
      els.btnToggleImagenMax.setAttribute('aria-expanded', String(!abierto));
      els.imagenMaxConfigBody.hidden = abierto;
    });
  }

  // Hint estático "máx. X MB" del intake de empresa nueva — el de "Editar
  // empresa"/"Identidad visual" ahora lo pone el propio módulo compartido
  // (marcaTemaEditor.js, opción limiteMb) en cada montaje.
  function aplicarHintsImagenMax() {
    const spanIntake = document.getElementById('intake-logo-limite-mb');
    if (spanIntake) spanIntake.textContent = String(imagenMaxMbActual);
  }

  // Siempre refresca `imagenMaxMbActual` (lo usan las validaciones de
  // tamaño de logo/favicon de abajo), esté o no desplegada la tarjeta —
  // por eso se llama desde showDashboard() (una vez por sesión), no solo
  // desde el toggle de la tarjeta.
  async function cargarImagenMaxGlobal() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/ajustes/imagen-max-mb`, { headers: { Authorization: authHeader } });
      if (!res.ok) return;
      const data = await res.json();
      if (Number.isInteger(data.imagen_max_mb)) {
        imagenMaxMbActual = data.imagen_max_mb;
      }
      if (els.imagenMaxMbInput) els.imagenMaxMbInput.value = imagenMaxMbActual;
      aplicarHintsImagenMax();
    } catch (_) {
      // Si falla, se sigue con el último valor conocido (o el default 2)
      // — la tarjeta puede reintentar manualmente con "Actualizar".
    }
  }

  if (els.btnGuardarImagenMax) {
    els.btnGuardarImagenMax.addEventListener('click', async () => {
      const authHeader = getAuthHeader();
      if (!authHeader) { showLogin(); return; }

      els.imagenMaxError.textContent = '';
      const valor = Number(els.imagenMaxMbInput.value);
      if (!Number.isInteger(valor) || valor < 1 || valor > 20) {
        els.imagenMaxError.textContent = 'Ingresa un número entero entre 1 y 20.';
        return;
      }

      els.btnGuardarImagenMax.disabled = true;
      if (els.btnGuardarImagenMaxLabel) els.btnGuardarImagenMaxLabel.textContent = 'Guardando…';
      try {
        const res = await fetch(`${API_BASE}/ajustes/imagen-max-mb`, {
          method: 'PUT',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagen_max_mb: valor }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          els.imagenMaxError.textContent = data.error || 'No se pudo guardar.';
          return;
        }
        imagenMaxMbActual = data.imagen_max_mb;
        aplicarHintsImagenMax();
        if (els.imagenMaxInfo) {
          els.imagenMaxInfo.textContent = `Guardado — aplica de inmediato a toda la plataforma (hasta ~45 s de caché en el backend de cada empresa).`;
        }
        showToast(`Máximo de imagen actualizado a ${data.imagen_max_mb} MB.`);
      } catch (_) {
        els.imagenMaxError.textContent = 'No se pudo conectar con el servidor.';
      } finally {
        els.btnGuardarImagenMax.disabled = false;
        if (els.btnGuardarImagenMaxLabel) els.btnGuardarImagenMaxLabel.textContent = 'Guardar';
      }
    });
  }

  // ---------- Punto 347: Auditoría cross-tenant ----------
  // Replica el diseño ya aprobado de /admin (punto 244, admin.js) — mismos
  // filtros/formato/badges, duplicado tal cual (sin código compartido
  // entre admin.js y control.js, mismo criterio que el resto del sitio).
  // Diferencia real: aquí es cross-tenant (columna Empresa agregada, sin
  // el switch "Auditoría activada/desactivada" que sí tiene /admin por
  // tenant — en /control el registro nunca se apaga).
  const MECANISMO_ETIQUETA_CONTROL = {
    admin_users: 'Súper (ADMIN_USERS)',
    perfil_bd: 'Cuenta del panel',
    api_credencial: 'Credencial API',
    api_clave: 'Clave API',
    usuario_sucursal: 'Sucursal compartida',
    fallback_admin: 'Cuenta de respaldo (retirada)',
  };
  const PERFIL_CLASE_BADGE_CONTROL = {
    administrador: 'perfil-administrador',
    fiscal: 'perfil-fiscal',
    ventas: 'perfil-ventas',
    cliente: 'perfil-cliente',
    super: 'perfil-super',
  };

  function limpiarCampoFiltroControl(el) {
    if (!el) return;
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function renderFiltrosChipsControl(contenedor, definiciones) {
    if (!contenedor) return;
    const activos = definiciones.filter((d) => d.valor);
    if (!activos.length) {
      contenedor.innerHTML = '';
      contenedor.hidden = true;
      return;
    }
    contenedor.hidden = false;
    contenedor.innerHTML =
      '<span class="filtros-chips-label">Filtros activos:</span>' +
      activos
        .map(
          (d, i) => `
        <span class="filtro-chip">
          <span class="filtro-chip-etiqueta">${escapeHtml(d.etiqueta)}:</span> ${escapeHtml(d.valor)}
          <button type="button" data-chip-quitar="${i}" aria-label="Quitar filtro ${escapeHtml(d.etiqueta)}">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>
          </button>
        </span>`
        )
        .join('');
    contenedor.querySelectorAll('[data-chip-quitar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-chip-quitar'));
        activos[idx].campos.forEach(limpiarCampoFiltroControl);
      });
    });
  }

  function formatearFechaHoraAuditoriaControl(valor) {
    if (!valor) return '—';
    const [fecha, hora] = String(valor).split(' ');
    return hora ? `${fecha} ${hora.slice(0, 5)}` : fecha;
  }

  function claseEstatusHttpControl(estatus) {
    if (estatus >= 500) return 'estatus-http-error';
    if (estatus >= 400) return 'estatus-http-warn';
    return 'estatus-http-ok';
  }

  function renderAuditoriaFiltrosChips() {
    renderFiltrosChipsControl(els.auditoriaFiltrosChips, [
      { etiqueta: 'Usuario', valor: els.auditoriaFiltroActor.value.trim(), campos: [els.auditoriaFiltroActor] },
      { etiqueta: 'Empresa', valor: els.auditoriaFiltroTenant.value.trim(), campos: [els.auditoriaFiltroTenant] },
      {
        etiqueta: 'Fechas',
        valor: (els.auditoriaFiltroDesde.value || els.auditoriaFiltroHasta.value)
          ? `${els.auditoriaFiltroDesde.value || '…'} – ${els.auditoriaFiltroHasta.value || '…'}`
          : '',
        campos: [els.auditoriaFiltroDesde, els.auditoriaFiltroHasta],
      },
    ]);
  }

  async function cargarAuditoria() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.auditoriaError.textContent = '';
    els.btnLimpiarAuditoriaActor.hidden = !els.auditoriaFiltroActor.value;
    els.btnLimpiarAuditoriaTenant.hidden = !els.auditoriaFiltroTenant.value;
    renderAuditoriaFiltrosChips();
    Esqueleto.aplicarEsqueletoTabla(els.auditoriaTableBody, 7);

    const params = new URLSearchParams();
    const actor = els.auditoriaFiltroActor.value.trim();
    const tenantSlug = els.auditoriaFiltroTenant.value.trim().toLowerCase();
    if (actor) params.set('actor', actor);
    if (tenantSlug) params.set('tenantSlug', tenantSlug);
    if (els.auditoriaFiltroDesde.value) params.set('desde', els.auditoriaFiltroDesde.value);
    if (els.auditoriaFiltroHasta.value) params.set('hasta', els.auditoriaFiltroHasta.value);
    params.set('limite', els.auditoriaFiltroLimite.value || '100');

    try {
      const resp = await fetch(`${API_BASE}/auditoria?${params.toString()}`, {
        headers: { Authorization: authHeader },
      });
      if (resp.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!resp.ok) throw new Error('No se pudo cargar la auditoría.');
      const data = await resp.json();
      const registros = data.registros || [];

      els.auditoriaTableBody.innerHTML = '';
      const hayFiltros = Boolean(actor || tenantSlug || els.auditoriaFiltroDesde.value || els.auditoriaFiltroHasta.value);
      els.auditoriaEmpty.hidden = registros.length > 0;
      if (registros.length === 0) {
        els.auditoriaEmptyTitulo.textContent = hayFiltros ? 'Sin resultados para tu filtro' : 'Sin accesos registrados todavía';
        els.auditoriaEmptyTexto.textContent = hayFiltros
          ? 'Prueba con otro usuario, empresa o un rango de fechas distinto.'
          : 'En cuanto alguien entre a /control, aparecerá aquí.';
      }

      registros.forEach((r) => {
        const tr = document.createElement('tr');
        const claseBadgePerfil = PERFIL_CLASE_BADGE_CONTROL[r.perfil] || 'perfil-cliente';
        const mecanismo = MECANISMO_ETIQUETA_CONTROL[r.mecanismo] || r.mecanismo;
        tr.innerHTML = `
          <td data-label="Fecha y hora">${formatearFechaHoraAuditoriaControl(r.ocurridoEn)}</td>
          <td data-label="Empresa">${r.tenantSlug ? escapeHtml(r.tenantSlug) : '<span class="field-hint" style="margin:0">Sitio base</span>'}</td>
          <td data-label="Usuario">${escapeHtml(r.actor)}</td>
          <td data-label="Perfil"><span class="perfil-badge ${claseBadgePerfil}">${escapeHtml(r.perfil)}</span></td>
          <td data-label="Acción"><code>${escapeHtml(r.metodo)} ${escapeHtml(r.ruta)}</code></td>
          <td data-label="Estatus"><span class="estatus-badge ${claseEstatusHttpControl(r.estatus)}">${r.estatus}</span></td>
          <td data-label="IP">${escapeHtml(r.ip || '—')}</td>
        `;
        els.auditoriaTableBody.appendChild(tr);
      });
      Esqueleto.quitarEsqueletoTabla(els.auditoriaTableBody);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.auditoriaTableBody, 7, err.message || 'No se pudo cargar la auditoría.', cargarAuditoria);
    }
  }

  if (els.auditoriaFiltroActor) {
    els.auditoriaFiltroActor.addEventListener('input', cargarAuditoria);
    els.auditoriaFiltroTenant.addEventListener('input', cargarAuditoria);
    els.auditoriaFiltroDesde.addEventListener('change', cargarAuditoria);
    els.auditoriaFiltroHasta.addEventListener('change', cargarAuditoria);
    els.auditoriaFiltroLimite.addEventListener('change', cargarAuditoria);
    els.btnLimpiarAuditoriaActor.addEventListener('click', () => limpiarCampoFiltroControl(els.auditoriaFiltroActor));
    els.btnLimpiarAuditoriaTenant.addEventListener('click', () => limpiarCampoFiltroControl(els.auditoriaFiltroTenant));
    els.btnLimpiarFiltrosAuditoria.addEventListener('click', () => {
      els.auditoriaFiltroActor.value = '';
      els.auditoriaFiltroTenant.value = '';
      els.auditoriaFiltroDesde.value = '';
      els.auditoriaFiltroHasta.value = '';
      els.auditoriaFiltroLimite.value = '100';
      cargarAuditoria();
    });
  }

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
    planes: {
      titulo: 'Ayuda — Planes',
      items: [
        { titulo: '¿Qué es un plan?', texto: 'Un conjunto con nombre de funciones y límites (Facturación, portal de clientes, sucursales, marca propia, cuota de disco) — se crea sin pensar en ningún cliente todavía.' },
        { titulo: '¿Cómo se usa?', texto: 'Se asigna después, desde la ficha de cada empresa (pestaña "Plan y funciones") — al asignarlo, sus valores se copian a esa empresa.' },
        { titulo: 'Editar un plan ya asignado', texto: 'NO cambia a las empresas que ya lo tienen — cada una conserva sus valores hasta que alguien la reasigne a mano desde su ficha.' },
        { titulo: 'Archivar', texto: 'Deja de ofrecerse para asignar a empresas nuevas — las que ya lo tienen asignado siguen funcionando exactamente igual. Reversible con "Reactivar".' },
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
    papelera: {
      titulo: 'Ayuda — Papelera',
      items: [
        { titulo: '¿Qué aparece aquí?', texto: 'Solo las empresas dadas de baja desde "Empresas". Provisionando/Activo/Suspendido nunca aparecen en esta vista.' },
        { titulo: 'Reactivar', texto: 'La devuelve a operar de inmediato, exactamente igual que el botón "Reactivar" de la vista Empresas — no perdió nada mientras estuvo aquí.' },
        { titulo: 'Eliminar definitivo', texto: 'Borra para siempre la base de datos física y los archivos de ESA empresa. Pide escribir su slug exacto antes de dejar confirmar — no se puede deshacer.' },
        { titulo: 'Vaciar papelera', texto: 'Borra para siempre TODAS las empresas listadas aquí, de una sola vez. Pide escribir "ELIMINAR" antes de dejar confirmar — no se puede deshacer.' },
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
    auditoria: {
      titulo: 'Ayuda — Auditoría',
      items: [
        { titulo: '¿Qué aparece aquí?', texto: 'Cada acceso NO-GET a /control (crear plan, asignar, archivar, suspender, etc.) — quién lo hizo, cuándo, sobre qué empresa y con qué resultado.' },
        { titulo: '¿Por qué no veo lecturas (GET)?', texto: 'Igual que en /admin: solo se audita lo que cambia algo, no cada consulta de solo lectura — si no, la tabla crecería sin aportar nada útil.' },
        { titulo: '"Sitio base"', texto: 'Acciones sin ninguna empresa asociada — por ejemplo, crear o editar un plan del catálogo (los planes no pertenecen a ningún tenant).' },
        { titulo: '¿Se puede apagar?', texto: 'No — a diferencia de /admin (donde cada tenant puede apagar su propia auditoría), en /control el registro nunca se desactiva.' },
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
  if (els.btnAyudaVistaPlanes) els.btnAyudaVistaPlanes.addEventListener('click', () => abrirAyudaVista('planes'));
  if (els.btnAyudaVistaPapelera) els.btnAyudaVistaPapelera.addEventListener('click', () => abrirAyudaVista('papelera'));
  if (els.btnAyudaVistaSucursales) els.btnAyudaVistaSucursales.addEventListener('click', () => abrirAyudaVista('sucursales'));
  if (els.btnAyudaVistaSuper) els.btnAyudaVistaSuper.addEventListener('click', () => abrirAyudaVista('super'));
  if (els.btnAyudaVistaAuditoria) els.btnAyudaVistaAuditoria.addEventListener('click', () => abrirAyudaVista('auditoria'));
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
