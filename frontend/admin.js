(() => {
  'use strict';

  // Multi-tenant (segmento 4, ver PROJECT_STATE.md): misma detección que
  // frontend/portal.js — admin.html no lo carga (panel independiente del
  // portal de cliente), así que se repite aquí, siguiendo el mismo patrón
  // de duplicación ya usado para API_BASE en este proyecto. Debe
  // coincidir exactamente con la detección de portal.js/login.js y con
  // las rutas de frontend/nginx.conf.
  const RUTAS_PAGINA_MULTITENANT = ['admin', 'dashboard', 'tickets', 'login', 'csf', 'restablecer'];

  function detectarTenantSlug() {
    const segmentos = window.location.pathname.split('/').filter(Boolean);
    if (segmentos.length >= 2 && RUTAS_PAGINA_MULTITENANT.includes(segmentos[1])) {
      return segmentos[0];
    }
    return null;
  }

  const TENANT_SLUG = detectarTenantSlug();
  const API_BASE = TENANT_SLUG ? `/${TENANT_SLUG}/api` : '/api';
  const SESSION_KEY = 'admin_credenciales';

  const els = {
    loginScreen: document.getElementById('admin-login-screen'),
    shellEsqueleto: document.getElementById('admin-shell-esqueleto'),
    dashboard: document.getElementById('admin-dashboard'),
    formLogin: document.getElementById('form-login'),
    inputUser: document.getElementById('admin-user'),
    inputPass: document.getElementById('admin-pass'),
    btnTogglePass: document.getElementById('btn-toggle-pass'),
    loginError: document.getElementById('login-error'),
    btnLogin: document.getElementById('btn-login'),
    btnLoginLabel: document.getElementById('btn-login-label'),
    adminLoginNormal: document.getElementById('admin-login-normal'),
    adminRecuperarPanel: document.getElementById('admin-recuperar-panel'),
    btnAdminIrRecuperar: document.getElementById('btn-admin-ir-recuperar'),
    btnAdminRecuperarVolver: document.getElementById('btn-admin-recuperar-volver'),
    formAdminRecuperar: document.getElementById('form-admin-recuperar'),
    adminRecuperarIdentificador: document.getElementById('admin-recuperar-identificador'),
    btnAdminRecuperar: document.getElementById('btn-admin-recuperar'),
    btnAdminRecuperarLabel: document.getElementById('btn-admin-recuperar-label'),
    adminRecuperarErrorGeneral: document.getElementById('admin-recuperar-error-general'),
    adminRecuperarConfirmacion: document.getElementById('admin-recuperar-confirmacion'),
    // Cambio de contraseña obligatorio al login (punto 321 addendum)
    adminForzarPasswordPanel: document.getElementById('admin-forzar-password-panel'),
    formAdminForzarPassword: document.getElementById('form-admin-forzar-password'),
    adminForzarPasswordNueva: document.getElementById('admin-forzar-password-nueva'),
    btnToggleForzarPassword: document.getElementById('btn-toggle-forzar-password'),
    adminForzarPasswordReglas: document.getElementById('admin-forzar-password-reglas'),
    adminForzarPasswordError: document.getElementById('admin-forzar-password-error'),
    btnAdminForzarPassword: document.getElementById('btn-admin-forzar-password'),
    btnAdminForzarPasswordLabel: document.getElementById('btn-admin-forzar-password-label'),
    btnLogout: document.getElementById('btn-logout'),
    sucursalesSwitcher: document.getElementById('admin-sucursales-switcher'),
    sucursalesSwitcherLista: document.getElementById('admin-sucursales-switcher-lista'),
    btnRefresh: document.getElementById('btn-refresh'),
    adminUserLabel: document.getElementById('admin-user-label'),
    adminCount: document.getElementById('admin-count'),
    adminError: document.getElementById('admin-error'),
    searchInput: document.getElementById('admin-search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    tableWrap: document.getElementById('admin-table-wrap'),
    tableBody: document.getElementById('admin-table-body'),
    tableEmpty: document.getElementById('admin-empty'),
    toast: document.getElementById('toast'),
    // Configuración de campos obligatorios
    btnToggleConfig: document.getElementById('btn-toggle-config'),
    adminConfigBody: document.getElementById('admin-config-body'),
    btnGuardarConfig: document.getElementById('btn-guardar-config'),
    btnGuardarConfigLabel: document.getElementById('btn-guardar-config-label'),
    usoCfdiInfo: document.getElementById('uso-cfdi-info'),
    btnActualizarUsoCfdi: document.getElementById('btn-actualizar-uso-cfdi'),
    btnActualizarUsoCfdiLabel: document.getElementById('btn-actualizar-uso-cfdi-label'),
    // Configuración de correo SMTP — acordeón estricto de 3 subsecciones
    // (Correo electrónico/Plantillas/Prueba, ver aplicarAcordeonSmtp)
    smtpConfigBody: document.getElementById('smtp-config-body'),
    smtpAutosaveTag: document.getElementById('smtp-autosave-tag'),
    smtpEstadoBadge: document.getElementById('smtp-estado-badge'),
    configSidebarSmtpEstado: document.getElementById('config-sidebar-smtp-estado'),
    configSidebarSmtpEstadoTexto: document.getElementById('config-sidebar-smtp-estado-texto'),
    smtpHost: document.getElementById('smtp-host'),
    smtpPuerto: document.getElementById('smtp-puerto'),
    smtpSeguridad: document.getElementById('smtp-seguridad'),
    smtpUsuario: document.getElementById('smtp-usuario'),
    smtpPassword: document.getElementById('smtp-password'),
    btnToggleSmtpPassword: document.getElementById('btn-toggle-smtp-password'),
    smtpPasswordHint: document.getElementById('smtp-password-hint'),
    smtpNombreRemitente: document.getElementById('smtp-nombre-remitente'),
    smtpCorreoRemitente: document.getElementById('smtp-correo-remitente'),
    smtpCorreoContador: document.getElementById('smtp-correo-contador'),
    // Franja "Verificar conexión ahora" (restyle "confGlo")
    smtpVerificarTexto: document.getElementById('smtp-verificar-texto'),
    btnVerificarSmtp: document.getElementById('btn-verificar-smtp'),
    btnVerificarSmtpLabel: document.getElementById('btn-verificar-smtp-label'),
    smtpVerificarError: document.getElementById('smtp-verificar-error'),
    // Plantillas de correo (punto 214)
    plantillasTabs: document.querySelectorAll('.plantillas-tab'),
    plantillaTriggerDesc: document.getElementById('plantilla-trigger-desc'),
    plantillaVars: document.getElementById('plantilla-vars'),
    plantillaTexto: document.getElementById('plantilla-texto'),
    btnPlantillaNegrita: document.getElementById('btn-plantilla-negrita'),
    btnPlantillaCursiva: document.getElementById('btn-plantilla-cursiva'),
    btnRestablecerPlantilla: document.getElementById('btn-restablecer-plantilla'),
    plantillaPreviewFrame: document.getElementById('plantilla-preview-frame'),
    btnGuiaSmtpGmail: document.getElementById('btn-guia-smtp-gmail'),
    guiaSmtpGmailCuerpo: document.getElementById('guia-smtp-gmail-cuerpo'),
    smtpConfigError: document.getElementById('smtp-config-error'),
    btnGuardarSmtp: document.getElementById('btn-guardar-smtp'),
    btnGuardarSmtpLabel: document.getElementById('btn-guardar-smtp-label'),
    smtpPruebaDestinatario: document.getElementById('smtp-prueba-destinatario'),
    smtpPruebaAsunto: document.getElementById('smtp-prueba-asunto'),
    smtpPruebaCuerpo: document.getElementById('smtp-prueba-cuerpo'),
    smtpPruebaError: document.getElementById('smtp-prueba-error'),
    btnEnviarPruebaSmtp: document.getElementById('btn-enviar-prueba-smtp'),
    btnEnviarPruebaSmtpLabel: document.getElementById('btn-enviar-prueba-smtp-label'),
    // Retención (borrado automático) de tickets
    btnToggleRetencion: document.getElementById('btn-toggle-retencion'),
    retencionConfigBody: document.getElementById('retencion-config-body'),
    retencionEstadoBadge: document.getElementById('retencion-estado-badge'),
    retencionDias: document.getElementById('retencion-dias'),
    retencionError: document.getElementById('retencion-error'),
    retencionInfo: document.getElementById('retencion-info'),
    retencionInfoOrdenes: document.getElementById('retencion-info-ordenes'),
    btnGuardarRetencion: document.getElementById('btn-guardar-retencion'),
    btnGuardarRetencionLabel: document.getElementById('btn-guardar-retencion-label'),
    // Notificación de tickets pendientes sin contador
    notifTicketsOverlay: document.getElementById('notif-tickets-overlay'),
    notifTicketsSubtitulo: document.getElementById('notif-tickets-subtitulo'),
    notifTicketsLista: document.getElementById('notif-tickets-lista'),
    notifTicketsOcultarWrap: document.getElementById('notif-tickets-ocultar-wrap'),
    notifTicketsOcultarCheckbox: document.getElementById('notif-tickets-ocultar-checkbox'),
    btnNotifTicketsCerrar: document.getElementById('btn-notif-tickets-cerrar'),
    btnNotifTicketsVer: document.getElementById('btn-notif-tickets-ver'),
    // Selector de columnas visibles
    btnColumns: document.getElementById('btn-columns'),
    columnTogglePanel: document.getElementById('column-toggle-panel'),
    // Vista Activos / Papelera
    tablaTitulo: document.getElementById('admin-tabla-titulo'),
    btnVerActivos: document.getElementById('btn-ver-activos'),
    btnVerPapelera: document.getElementById('btn-ver-papelera'),
    // Modal de confirmación genérico
    confirmModalOverlay: document.getElementById('confirm-modal-overlay'),
    confirmModalTitle: document.getElementById('confirm-modal-title'),
    confirmModalMensaje: document.getElementById('confirm-modal-mensaje'),
    btnConfirmCancelar: document.getElementById('btn-confirm-cancelar'),
    btnConfirmAceptar: document.getElementById('btn-confirm-aceptar'),
    // Vista previa del documento
    previewOverlay: document.getElementById('preview-overlay'),
    previewTitle: document.getElementById('preview-title'),
    previewSubtitle: document.getElementById('preview-subtitle'),
    previewStatus: document.getElementById('preview-status'),
    previewFrame: document.getElementById('preview-frame'),
    previewImage: document.getElementById('preview-image'),
    btnPreviewDescargar: document.getElementById('btn-preview-descargar'),
    btnPreviewCerrar: document.getElementById('btn-preview-cerrar'),
    // Vista Inicio / Constancias / Tickets / Ventas / Usuarios / Configuraciones
    btnVistaInicio: document.getElementById('btn-vista-inicio'),
    btnVistaConstancias: document.getElementById('btn-vista-constancias'),
    btnVistaTickets: document.getElementById('btn-vista-tickets'),
    btnVistaResumenFinanciero: document.getElementById('btn-vista-resumen-financiero'),
    btnVistaOrdenes: document.getElementById('btn-vista-ordenes'),
    btnVistaGastos: document.getElementById('btn-vista-gastos'),
    btnVistaUsuarios: document.getElementById('btn-vista-usuarios'),
    btnVistaConfiguraciones: document.getElementById('btn-vista-configuraciones'),
    btnVistaLecturaReportes: document.getElementById('btn-vista-lectura-reportes'),
    btnVistaProveedores: document.getElementById('btn-vista-proveedores'),
    btnVistaMiCuenta: document.getElementById('btn-vista-mi-cuenta'),
    // Riel colapsable del sidebar (punto 329, solo escritorio)
    btnColapsarSidebar: document.getElementById('btn-colapsar-sidebar'),
    // Campana de notificaciones (punto 337, solo escritorio)
    notifWrap: document.getElementById('notif-wrap'),
    btnNotificaciones: document.getElementById('btn-notificaciones'),
    notifDot: document.getElementById('notif-dot'),
    notifPanel: document.getElementById('notif-panel'),
    notifList: document.getElementById('notif-list'),
    notifEmpty: document.getElementById('notif-empty'),
    btnNotifMarcarTodo: document.getElementById('btn-notif-marcar-todo'),
    notifLinkTickets: document.getElementById('notif-link-tickets'),
    notifLinkInventarios: document.getElementById('notif-link-inventarios'),
    // Menú móvil (launcher de íconos, reemplaza el nav de fila en <900px)
    btnMenuMovil: document.getElementById('btn-menu-movil'),
    adminMenuMovil: document.getElementById('admin-menu-movil'),
    vistaInicio: document.getElementById('vista-inicio'),
    vistaConstancias: document.getElementById('vista-constancias'),
    vistaTickets: document.getElementById('vista-tickets'),
    vistaResumenFinanciero: document.getElementById('vista-resumen-financiero'),
    vistaOrdenes: document.getElementById('vista-ordenes'),
    vistaGastos: document.getElementById('vista-gastos'),
    vistaUsuarios: document.getElementById('vista-usuarios'),
    vistaConfiguraciones: document.getElementById('config-modal-overlay'),
    vistaLecturaReportes: document.getElementById('vista-lectura-reportes'),
    vistaProveedores: document.getElementById('vista-proveedores'),
    vistaMiCuenta: document.getElementById('vista-mi-cuenta'),
    btnVistaAuditoria: document.getElementById('btn-vista-auditoria'),
    vistaAuditoria: document.getElementById('vista-auditoria'),
    auditoriaFiltroActor: document.getElementById('auditoria-filtro-actor'),
    btnLimpiarAuditoriaActor: document.getElementById('btn-limpiar-auditoria-actor'),
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
    // Mi Cuenta
    micuentaDatosForm: document.getElementById('micuenta-datos-form'),
    micuentaSinDatosNota: document.getElementById('micuenta-sin-datos-nota'),
    micuentaNombre: document.getElementById('micuenta-nombre'),
    micuentaTelefono: document.getElementById('micuenta-telefono'),
    micuentaEmail: document.getElementById('micuenta-email'),
    micuentaUsuarioLabel: document.getElementById('micuenta-usuario-label'),
    micuentaPerfilLabel: document.getElementById('micuenta-perfil-label'),
    btnGuardarMiCuenta: document.getElementById('btn-guardar-micuenta'),
    micuentaPasswordCard: document.getElementById('micuenta-password-card'),
    micuentaPasswordActual: document.getElementById('micuenta-password-actual'),
    micuentaPasswordNueva: document.getElementById('micuenta-password-nueva'),
    btnCambiarMiCuentaPassword: document.getElementById('btn-cambiar-micuenta-password'),
    micuentaEmpresaCard: document.getElementById('micuenta-empresa-card'),
    micuentaRazonSocial: document.getElementById('micuenta-razon-social'),
    micuentaRfc: document.getElementById('micuenta-rfc'),
    micuentaRegimen: document.getElementById('micuenta-regimen'),
    micuentaClaveSat: document.getElementById('micuenta-clave-sat'),
    micuentaZonaHoraria: document.getElementById('micuenta-zona-horaria'),
    micuentaTotalOperadores: document.getElementById('micuenta-total-operadores'),
    micuentaUrlBar: document.getElementById('micuenta-url-bar'),
    micuentaUrlTenant: document.getElementById('micuenta-url-tenant'),
    btnCopiarUrlMiCuenta: document.getElementById('btn-copiar-url-micuenta'),
    btnMiCuentaIrConfiguraciones: document.getElementById('btn-micuenta-ir-configuraciones'),
    // Mi Cuenta — piezas visuales "Próximamente" (2FA/sesiones/
    // notificaciones/Clarvo Site Market), ver PROJECT_STATE.md punto 283.
    micuentaBannerMarket: document.getElementById('micuenta-banner-market'),
    micuenta2faCard: document.getElementById('micuenta-2fa-card'),
    micuentaSesionesCard: document.getElementById('micuenta-sesiones-card'),
    micuentaSesionUsuario: document.getElementById('micuenta-sesion-usuario'),
    micuentaSesionPerfil: document.getElementById('micuenta-sesion-perfil'),
    micuentaNotifCard: document.getElementById('micuenta-notif-card'),
    micuentaSuscripcionCard: document.getElementById('micuenta-suscripcion-card'),
    micuentaFacturacionCard: document.getElementById('micuenta-facturacion-card'),
    micuentaFooterMarket: document.getElementById('micuenta-footer-market'),
    // Modal "Configuraciones" (antes vista de página, ver
    // PROJECT_STATE.md): barra lateral + buscador + panel de contenido.
    configModalSidebar: document.getElementById('config-modal-sidebar'),
    configModalMain: document.getElementById('config-modal-main'),
    configModalBuscar: document.getElementById('config-modal-buscar'),
    configModalNavEmpty: document.getElementById('config-modal-nav-empty'),
    configModalMainBody: document.getElementById('config-modal-main-body'),
    configModalTitle: document.getElementById('config-modal-title'),
    configModalBtnVolver: document.getElementById('config-modal-btn-volver'),
    btnCerrarConfigModal: document.getElementById('btn-cerrar-config-modal'),
    // Vista Inicio: bienvenida, tarjetas de estatísticas, recientes y dona
    inicioTituloBienvenida: document.getElementById('inicio-titulo-bienvenida'),
    inicioSubtitulo: document.getElementById('inicio-subtitulo'),
    inicioInventarioSlot: document.getElementById('inicio-inventario-slot'),
    inicioMainGrid: document.getElementById('inicio-main-grid'),
    inicioError: document.getElementById('inicio-error'),
    inicioStatsGrid: document.getElementById('inicio-stats-grid'),
    inicioStatTotal: document.getElementById('inicio-stat-total'),
    inicioStatTotalTendencia: document.getElementById('inicio-stat-total-tendencia'),
    inicioStatProceso: document.getElementById('inicio-stat-proceso'),
    inicioStatProcesoTendencia: document.getElementById('inicio-stat-proceso-tendencia'),
    inicioStatCompletadas: document.getElementById('inicio-stat-completadas'),
    inicioStatCompletadasTendencia: document.getElementById('inicio-stat-completadas-tendencia'),
    inicioStatRechazadas: document.getElementById('inicio-stat-rechazadas'),
    inicioStatRechazadasTendencia: document.getElementById('inicio-stat-rechazadas-tendencia'),
    btnInicioVerTodas: document.getElementById('btn-inicio-ver-todas'),
    inicioRecientesBody: document.getElementById('inicio-recientes-body'),
    inicioRecientesEmpty: document.getElementById('inicio-recientes-empty'),
    inicioDonutTotal: document.getElementById('inicio-donut-total'),
    inicioDonutProceso: document.getElementById('inicio-donut-proceso'),
    inicioDonutCompletadas: document.getElementById('inicio-donut-completadas'),
    inicioDonutRechazadas: document.getElementById('inicio-donut-rechazadas'),
    inicioLeyendaProceso: document.getElementById('inicio-leyenda-proceso'),
    inicioLeyendaCompletadas: document.getElementById('inicio-leyenda-completadas'),
    inicioLeyendaRechazadas: document.getElementById('inicio-leyenda-rechazadas'),
    // Tabla de tickets
    ticketsTablaTitulo: document.getElementById('tickets-tabla-titulo'),
    btnVerTicketsActivos: document.getElementById('btn-ver-tickets-activos'),
    btnVerTicketsPapelera: document.getElementById('btn-ver-tickets-papelera'),
    ticketsCount: document.getElementById('tickets-count'),
    ticketsFiltroEstatus: document.getElementById('tickets-filtro-estatus'),
    ticketsFiltroUsuario: document.getElementById('tickets-filtro-usuario'),
    btnRefreshTickets: document.getElementById('btn-refresh-tickets'),
    ticketsError: document.getElementById('tickets-error'),
    ticketsTableBody: document.getElementById('tickets-table-body'),
    btnTicketsColumns: document.getElementById('btn-tickets-columns'),
    ticketsColumnTogglePanel: document.getElementById('tickets-column-toggle-panel'),
    ticketsEmpty: document.getElementById('tickets-empty'),
    // Modal de gestión de ticket
    ticketModalOverlay: document.getElementById('ticket-modal-overlay'),
    ticketModalTitle: document.getElementById('ticket-modal-title'),
    ticketModalEstatusBadge: document.getElementById('ticket-modal-estatus-badge'),
    ticketModalInfoRfc: document.getElementById('ticket-modal-info-rfc'),
    ticketModalInfoUsoCfdi: document.getElementById('ticket-modal-info-uso-cfdi'),
    ticketModalInfoTipoPago: document.getElementById('ticket-modal-info-tipo-pago'),
    ticketModalInfoActualizadoPor: document.getElementById('ticket-modal-info-actualizado-por'),
    ticketModalCompraBox: document.getElementById('ticket-modal-compra-box'),
    ticketModalCompraNumero: document.getElementById('ticket-modal-compra-numero'),
    ticketModalCompraFecha: document.getElementById('ticket-modal-compra-fecha'),
    ticketModalCompraHora: document.getElementById('ticket-modal-compra-hora'),
    ticketModalCompraTotal: document.getElementById('ticket-modal-compra-total'),
    ticketModalInfoDocumento: document.getElementById('ticket-modal-info-documento'),
    ticketModalComentariosBox: document.getElementById('ticket-modal-comentarios-box'),
    ticketModalComentariosTexto: document.getElementById('ticket-modal-comentarios-texto'),
    ticketModalImagenWrap: document.getElementById('ticket-modal-imagen-wrap'),
    ticketModalImagenStatus: document.getElementById('ticket-modal-imagen-status'),
    ticketModalImagen: document.getElementById('ticket-modal-imagen'),
    btnTicketDescargarImagen: document.getElementById('btn-ticket-descargar-imagen'),
    ticketModalEstatusSelect: document.getElementById('ticket-modal-estatus-select'),
    ticketModalNotas: document.getElementById('ticket-modal-notas'),
    btnTicketModalCerrar: document.getElementById('btn-ticket-modal-cerrar'),
    btnTicketGuardarEstatus: document.getElementById('btn-ticket-guardar-estatus'),
    btnTicketGuardarEstatusLabel: document.getElementById('btn-ticket-guardar-estatus-label'),
    ticketModalFacturaActual: document.getElementById('ticket-modal-factura-actual'),
    ticketModalFacturaActualNombre: document.getElementById('ticket-modal-factura-actual-nombre'),
    btnTicketDescargarFactura: document.getElementById('btn-ticket-descargar-factura'),
    labelTicketModalFacturaInput: document.getElementById('label-ticket-modal-factura-input'),
    ticketModalFacturaInput: document.getElementById('ticket-modal-factura-input'),
    btnTicketSubirFactura: document.getElementById('btn-ticket-subir-factura'),
    btnTicketSubirFacturaLabel: document.getElementById('btn-ticket-subir-factura-label'),
    ticketModalMontoFactura: document.getElementById('ticket-modal-monto-factura'),
    ticketModalMontoFacturaValor: document.getElementById('ticket-modal-monto-factura-valor'),
    ticketModalMontoFacturaFuente: document.getElementById('ticket-modal-monto-factura-fuente'),
    ticketModalFacturaAviso: document.getElementById('ticket-modal-factura-aviso'),
    ticketModalMontoManualWrap: document.getElementById('ticket-modal-monto-manual-wrap'),
    ticketModalMontoManual: document.getElementById('ticket-modal-monto-manual'),
    // Ventas
    ordenesCount: document.getElementById('ordenes-count'),
    ordenesTableWrap: document.getElementById('ordenes-table-wrap'),
    btnOrdenesColumns: document.getElementById('btn-ordenes-columns'),
    ordenesColumnTogglePanel: document.getElementById('ordenes-column-toggle-panel'),
    btnRefreshOrdenes: document.getElementById('btn-refresh-ordenes'),
    // Filtros de la lista (concepto/fechas/total) — 100% client-side
    ordenesFiltroConcepto: document.getElementById('ordenes-filtro-concepto'),
    ordenesFiltroFechaDesde: document.getElementById('ordenes-filtro-fecha-desde'),
    ordenesFiltroFechaHasta: document.getElementById('ordenes-filtro-fecha-hasta'),
    ordenesFiltroTotalMin: document.getElementById('ordenes-filtro-total-min'),
    ordenesFiltroTotalMax: document.getElementById('ordenes-filtro-total-max'),
    ordenesFiltroEstadoPago: document.getElementById('ordenes-filtro-estado-pago'),
    ordenesFiltroFacturacion: document.getElementById('ordenes-filtro-facturacion'),
    ordenesFiltroPeriodo: document.getElementById('ordenes-filtro-periodo'),
    btnLimpiarFiltrosOrdenes: document.getElementById('btn-limpiar-filtros-ordenes'),
    ordenesFiltroEmpty: document.getElementById('ordenes-filtro-empty'),
    ordenesFiltrosChips: document.getElementById('ordenes-filtros-chips'),
    btnLimpiarOrdenesFiltroConcepto: document.getElementById('btn-limpiar-ordenes-filtro-concepto'),
    // Modal "Corte del día" (punto 168, restyle punto 320)
    btnAbrirCorteModal: document.getElementById('btn-abrir-corte-modal'),
    btnAbrirCorteRangoModal: document.getElementById('btn-abrir-corte-rango-modal'),
    cortesToolbar: document.getElementById('cortes-toolbar'),
    corteModalOverlay: document.getElementById('corte-modal-overlay'),
    corteModalTitle: document.getElementById('corte-modal-title'),
    corteFiltrosRow: document.getElementById('corte-filtros-row'),
    btnCerrarCorteModal: document.getElementById('btn-cerrar-corte-modal'),
    corteChipRow: document.getElementById('corte-chip-row'),
    corteFiltroDesde: document.getElementById('corte-filtro-desde'),
    corteFiltroHasta: document.getElementById('corte-filtro-hasta'),
    btnExportarCorteActualCsv: document.getElementById('btn-exportar-corte-actual-csv'),
    corteError: document.getElementById('corte-error'),
    btnGenerarCorte: document.getElementById('btn-generar-corte'),
    btnGenerarCorteLabel: document.getElementById('btn-generar-corte-label'),
    corteResultado: document.getElementById('corte-resultado'),
    corteResultadoEmpty: document.getElementById('corte-resultado-empty'),
    corteResultadoVentas: document.getElementById('corte-resultado-ventas'),
    corteResultadoSubtotal: document.getElementById('corte-resultado-subtotal'),
    corteResultadoIva: document.getElementById('corte-resultado-iva'),
    corteResultadoTotal: document.getElementById('corte-resultado-total'),
    corteResultadoFacturado: document.getElementById('corte-resultado-facturado'),
    corteResultadoSinFacturar: document.getElementById('corte-resultado-sin-facturar'),
    corteResultadoCobrado: document.getElementById('corte-resultado-cobrado'),
    corteResultadoPendiente: document.getElementById('corte-resultado-pendiente'),
    btnImprimirCorte: document.getElementById('btn-imprimir-corte'),
    corteImprimir: document.getElementById('corte-imprimir'),
    // Modal "Registrar venta" (antes formulario sticky)
    btnAbrirOrdenModal: document.getElementById('btn-abrir-orden-modal'),
    ordenRegistrarModalOverlay: document.getElementById('orden-registrar-modal-overlay'),
    btnCerrarOrdenModal: document.getElementById('btn-cerrar-orden-modal'),
    ordenFormExito: document.getElementById('orden-form-exito'),
    ordenFormExitoTexto: document.getElementById('orden-form-exito-texto'),
    ordenFechaAuto: document.getElementById('orden-fecha-auto'),
    // Wizard de 3 pasos (solo activo en móvil, <900px)
    ordenWizardSteps: document.getElementById('orden-wizard-steps'),
    ordenWizardPasos: document.querySelectorAll('.orden-wizard-paso'),
    ordenWizardNav: document.getElementById('orden-wizard-nav'),
    btnOrdenPasoAtras: document.getElementById('btn-orden-paso-atras'),
    btnOrdenPasoSiguiente: document.getElementById('btn-orden-paso-siguiente'),
    ordenRegistrarBtnRow: document.getElementById('orden-registrar-btn-row'),
    ordenInfoBannerIva: document.getElementById('orden-info-banner-iva'),
    btnOrdenInfoBannerConfig: document.getElementById('btn-orden-info-banner-config'),
    ordenDescuentoRapido: document.getElementById('orden-descuento-rapido'),
    ordenResumenSubtotal: document.getElementById('orden-resumen-subtotal'),
    ordenResumenFilaDescuento: document.getElementById('orden-resumen-fila-descuento'),
    ordenResumenDescuentoLabel: document.getElementById('orden-resumen-descuento-label'),
    ordenResumenDescuento: document.getElementById('orden-resumen-descuento'),
    ordenResumenIvaLabel: document.getElementById('orden-resumen-iva-label'),
    ordenResumenIva: document.getElementById('orden-resumen-iva'),
    btnOrdenVistaPrevia: document.getElementById('btn-orden-vista-previa'),
    btnOrdenGuardarBorrador: document.getElementById('btn-orden-guardar-borrador'),
    ticketPreviewAvisoBorrador: document.getElementById('ticket-preview-aviso-borrador'),
    ordenConcepto: document.getElementById('orden-concepto'),
    ordenConceptoContador: document.getElementById('orden-concepto-contador'),
    ordenCantidad: document.getElementById('orden-cantidad'),
    ordenDescuento: document.getElementById('orden-descuento'),
    // Captura de productos de una venta (arman concepto + cantidad)
    ordenProductoConcepto: document.getElementById('orden-producto-concepto'),
    ordenProductoPrecio: document.getElementById('orden-producto-precio'),
    ordenProductoCantidad: document.getElementById('orden-producto-cantidad'),
    btnAgregarProductoOrden: document.getElementById('btn-agregar-producto-orden'),
    ordenProductosListaWrap: document.getElementById('orden-productos-lista-wrap'),
    ordenProductosListaBody: document.getElementById('orden-productos-lista-body'),
    ordenProductosListaMovil: document.getElementById('orden-productos-lista-movil'),
    // D8 (Inventarios, §22): vincular producto de inventario en Ventas
    ordenProductosCapturaManual: document.getElementById('orden-productos-captura-manual'),
    ordenInventarioVincular: document.getElementById('orden-inventario-vincular'),
    ordenInventarioBuscarWrap: document.getElementById('orden-inventario-buscar-wrap'),
    ordenInventarioBuscar: document.getElementById('orden-inventario-buscar'),
    btnOrdenInventarioEscanear: document.getElementById('btn-orden-inventario-escanear'),
    ordenInventarioSugerencias: document.getElementById('orden-inventario-sugerencias'),
    ordenInventarioSeleccionado: document.getElementById('orden-inventario-seleccionado'),
    ordenInventarioSeleccionadoNombre: document.getElementById('orden-inventario-seleccionado-nombre'),
    ordenInventarioSeleccionadoDetalle: document.getElementById('orden-inventario-seleccionado-detalle'),
    btnOrdenInventarioQuitar: document.getElementById('btn-orden-inventario-quitar'),
    ordenInventarioUnidadesField: document.getElementById('orden-inventario-unidades-field'),
    ordenInventarioPrecio: document.getElementById('orden-inventario-precio'),
    ordenInventarioUnidades: document.getElementById('orden-inventario-unidades'),
    ordenInventarioUnidadesLabel: document.getElementById('orden-inventario-unidades-label'),
    ordenInventarioDisponibleHint: document.getElementById('orden-inventario-disponible-hint'),
    btnAgregarProductoInventarioOrden: document.getElementById('btn-agregar-producto-inventario-orden'),
    ordenIvaInfo: document.getElementById('orden-iva-info'),
    ordenTotalPreview: document.getElementById('orden-total-preview'),
    ordenEmail: document.getElementById('orden-email'),
    ordenDatosCliente: document.getElementById('orden-datos-cliente'),
    ordenRfcInfo: document.getElementById('orden-rfc-info'),
    ordenNombreInfo: document.getElementById('orden-nombre-info'),
    // Método de entrega (correo / imprimir), paso final del wizard
    btnOrdenEntregaCorreo: document.getElementById('btn-orden-entrega-correo'),
    btnOrdenEntregaImprimir: document.getElementById('btn-orden-entrega-imprimir'),
    btnOrdenEntregaSinTicket: document.getElementById('btn-orden-entrega-sinticket'),
    ordenEntregaCorreoWrap: document.getElementById('orden-entrega-correo-wrap'),
    ordenEntregaImprimirHint: document.getElementById('orden-entrega-imprimir-hint'),
    ordenEntregaSinTicketHint: document.getElementById('orden-entrega-sinticket-hint'),
    // Toggle "Cliente ya registrado" / "Cliente nuevo" de la venta
    btnOrdenClienteRegistrado: document.getElementById('btn-orden-cliente-registrado'),
    btnOrdenClienteNuevo: document.getElementById('btn-orden-cliente-nuevo'),
    ordenEmailRegistradoWrap: document.getElementById('orden-email-registrado-wrap'),
    ordenEmailNuevoWrap: document.getElementById('orden-email-nuevo-wrap'),
    ordenEmailNuevo: document.getElementById('orden-email-nuevo'),
    ordenErrorGeneral: document.getElementById('orden-error-general'),
    ordenErrorModalOverlay: document.getElementById('orden-error-modal-overlay'),
    ordenErrorModalTitle: document.getElementById('orden-error-modal-title'),
    ordenErrorModalMensaje: document.getElementById('orden-error-modal-mensaje'),
    ordenErrorModalStock: document.getElementById('orden-error-modal-stock'),
    ordenErrorModalProducto: document.getElementById('orden-error-modal-producto'),
    ordenErrorModalDisponible: document.getElementById('orden-error-modal-disponible'),
    ordenErrorModalSolicitado: document.getElementById('orden-error-modal-solicitado'),
    btnOrdenErrorModalCerrar: document.getElementById('btn-orden-error-modal-cerrar'),
    // Método de pago + folio de conciliación de transferencia — punto 342
    btnOrdenMetodoEfectivo: document.getElementById('btn-orden-metodo-efectivo'),
    btnOrdenMetodoTransferencia: document.getElementById('btn-orden-metodo-transferencia'),
    btnOrdenMetodoTarjetaCredito: document.getElementById('btn-orden-metodo-tarjeta-credito'),
    btnOrdenMetodoTarjetaDebito: document.getElementById('btn-orden-metodo-tarjeta-debito'),
    ordenFolioConciliacionWrap: document.getElementById('orden-folio-conciliacion-wrap'),
    ordenFolioConciliacionValor: document.getElementById('orden-folio-conciliacion-valor'),
    btnOrdenCopiarFolio: document.getElementById('btn-orden-copiar-folio'),
    txtOrdenCopiarFolio: document.getElementById('txt-orden-copiar-folio'),
    // Estado de pago (CxC) — punto 138
    btnOrdenPagoPagada: document.getElementById('btn-orden-pago-pagada'),
    btnOrdenPagoPendiente: document.getElementById('btn-orden-pago-pendiente'),
    ordenPagoPendienteWrap: document.getElementById('orden-pago-pendiente-wrap'),
    ordenFechaVencimiento: document.getElementById('orden-fecha-vencimiento'),
    ordenNotasCobro: document.getElementById('orden-notas-cobro'),
    // Ticket de impresión + asignar correo a una venta sin uno
    ticketImprimir: document.getElementById('ticket-imprimir'),
    ticketPreviewModalOverlay: document.getElementById('ticket-preview-modal-overlay'),
    ticketPreviewRecibo: document.getElementById('ticket-preview-recibo'),
    btnTicketPreviewCerrar: document.getElementById('btn-ticket-preview-cerrar'),
    btnTicketPreviewImprimir: document.getElementById('btn-ticket-preview-imprimir'),
    btnOrdenModalImprimir: document.getElementById('btn-orden-modal-imprimir'),
    ordenAsignarCorreoOverlay: document.getElementById('orden-asignar-correo-overlay'),
    ordenAsignarCorreoInput: document.getElementById('orden-asignar-correo-input'),
    btnOrdenAsignarCorreoCancelar: document.getElementById('btn-orden-asignar-correo-cancelar'),
    btnOrdenAsignarCorreoEnviar: document.getElementById('btn-orden-asignar-correo-enviar'),
    btnRegistrarOrden: document.getElementById('btn-registrar-orden'),
    btnRegistrarOrdenLabel: document.getElementById('btn-registrar-orden-label'),
    ordenesError: document.getElementById('ordenes-error'),
    ordenesTableBody: document.getElementById('ordenes-table-body'),
    ordenesEmpty: document.getElementById('ordenes-empty'),
    // CxC — punto 138
    btnVistaCxc: document.getElementById('btn-vista-cxc'),
    vistaCxc: document.getElementById('vista-cxc'),
    btnVerCxcPendientes: document.getElementById('btn-ver-cxc-pendientes'),
    btnVerCxcCobradas: document.getElementById('btn-ver-cxc-cobradas'),
    cxcCount: document.getElementById('cxc-count'),
    btnRefreshCxc: document.getElementById('btn-refresh-cxc'),
    cxcKpis: document.getElementById('cxc-kpis'),
    cxcKpiPorCobrar: document.getElementById('cxc-kpi-por-cobrar'),
    cxcKpiPorCobrarNota: document.getElementById('cxc-kpi-por-cobrar-nota'),
    cxcKpiVencidas: document.getElementById('cxc-kpi-vencidas'),
    cxcKpiVencidasNota: document.getElementById('cxc-kpi-vencidas-nota'),
    cxcKpiPorVencer: document.getElementById('cxc-kpi-por-vencer'),
    cxcKpiPorVencerNota: document.getElementById('cxc-kpi-por-vencer-nota'),
    cxcKpiCobradoMes: document.getElementById('cxc-kpi-cobrado-mes'),
    cxcKpiCobradoMesNota: document.getElementById('cxc-kpi-cobrado-mes-nota'),
    cxcAlertaVencidas: document.getElementById('cxc-alerta-vencidas'),
    cxcAlertaVencidasTexto: document.getElementById('cxc-alerta-vencidas-texto'),
    btnCxcAlertaVer: document.getElementById('btn-cxc-alerta-ver'),
    btnCxcRecordatorioMasivo: document.getElementById('btn-cxc-recordatorio-masivo'),
    cxcAnalyticsGrid: document.getElementById('cxc-analytics-grid'),
    cxcAgingCard: document.getElementById('cxc-aging-card'),
    cxcAgingTotal: document.getElementById('cxc-aging-total'),
    cxcAgingBars: document.getElementById('cxc-aging-bars'),
    cxcAgingMora: document.getElementById('cxc-aging-mora'),
    cxcAgingPromedio: document.getElementById('cxc-aging-promedio'),
    cxcGaugeDonut: document.getElementById('cxc-gauge-donut'),
    cxcGaugeTotal: document.getElementById('cxc-gauge-total'),
    cxcGaugeCobrado: document.getElementById('cxc-gauge-cobrado'),
    cxcGaugePorcobrar: document.getElementById('cxc-gauge-porcobrar'),
    cxcGaugeTotalCartera: document.getElementById('cxc-gauge-total-cartera'),
    btnCxcExportar: document.getElementById('btn-cxc-exportar'),
    cxcFiltroCliente: document.getElementById('cxc-filtro-cliente'),
    cxcFiltroVencimiento: document.getElementById('cxc-filtro-vencimiento'),
    btnLimpiarFiltrosCxc: document.getElementById('btn-limpiar-filtros-cxc'),
    cxcFiltrosChips: document.getElementById('cxc-filtros-chips'),
    btnLimpiarCxcFiltroCliente: document.getElementById('btn-limpiar-cxc-filtro-cliente'),
    cxcTableBody: document.getElementById('cxc-table-body'),
    btnCxcColumns: document.getElementById('btn-cxc-columns'),
    cxcColumnTogglePanel: document.getElementById('cxc-column-toggle-panel'),
    cxcEmpty: document.getElementById('cxc-empty'),
    cxcFiltroEmpty: document.getElementById('cxc-filtro-empty'),
    cxcCobroModalOverlay: document.getElementById('cxc-cobro-modal-overlay'),
    cxcCobroModalSubtitulo: document.getElementById('cxc-cobro-modal-subtitulo'),
    cxcCobroSaldo: document.getElementById('cxc-cobro-saldo'),
    cxcCobroMonto: document.getElementById('cxc-cobro-monto'),
    cxcCobroNotas: document.getElementById('cxc-cobro-notas'),
    btnCxcCobroCancelar: document.getElementById('btn-cxc-cobro-cancelar'),
    btnCxcCobroGuardar: document.getElementById('btn-cxc-cobro-guardar'),
    btnCxcCobroGuardarLabel: document.getElementById('btn-cxc-cobro-guardar-label'),
    btnCxcCobroTotal: document.getElementById('btn-cxc-cobro-total'),
    errorCxcCobroMonto: document.getElementById('error-cxc-cobro-monto'),
    // Modal de detalle de una venta
    ordenModalOverlay: document.getElementById('orden-modal-overlay'),
    ordenModalTitle: document.getElementById('orden-modal-title'),
    ordenModalBadge: document.getElementById('orden-modal-badge'),
    ordenModalFecha: document.getElementById('orden-modal-fecha'),
    ordenModalCorreo: document.getElementById('orden-modal-correo'),
    ordenModalRfcItem: document.getElementById('orden-modal-rfc-item'),
    ordenModalRfc: document.getElementById('orden-modal-rfc'),
    ordenModalRazonItem: document.getElementById('orden-modal-razon-item'),
    ordenModalRazon: document.getElementById('orden-modal-razon'),
    ordenModalProductosTablaWrap: document.getElementById('orden-modal-productos-tabla-wrap'),
    ordenModalProductosBody: document.getElementById('orden-modal-productos-body'),
    ordenModalConceptoSimple: document.getElementById('orden-modal-concepto-simple'),
    ordenModalCantidad: document.getElementById('orden-modal-cantidad'),
    ordenModalDescuentoWrap: document.getElementById('orden-modal-descuento-wrap'),
    ordenModalDescuento: document.getElementById('orden-modal-descuento'),
    ordenModalIva: document.getElementById('orden-modal-iva'),
    ordenModalTotal: document.getElementById('orden-modal-total'),
    btnOrdenModalCerrar: document.getElementById('btn-orden-modal-cerrar'),
    btnOrdenModalReenviar: document.getElementById('btn-orden-modal-reenviar'),
    btnOrdenModalEliminar: document.getElementById('btn-orden-modal-eliminar'),
    ordenesEmpty: document.getElementById('ordenes-empty'),
    // Gastos
    gastosCount: document.getElementById('gastos-count'),
    btnGastosColumns: document.getElementById('btn-gastos-columns'),
    gastosColumnTogglePanel: document.getElementById('gastos-column-toggle-panel'),
    btnRefreshGastos: document.getElementById('btn-refresh-gastos'),
    btnNuevoGasto: document.getElementById('btn-nuevo-gasto'),
    btnVerGastosActivos: document.getElementById('btn-ver-gastos-activos'),
    btnVerGastosPapelera: document.getElementById('btn-ver-gastos-papelera'),
    gastosResumenWrap: document.getElementById('gastos-resumen-wrap'),
    gastosKpiMes: document.getElementById('gastos-kpi-mes'),
    gastosKpiMesTendencia: document.getElementById('gastos-kpi-mes-tendencia'),
    gastosKpiConFactura: document.getElementById('gastos-kpi-con-factura'),
    gastosKpiConFacturaTendencia: document.getElementById('gastos-kpi-con-factura-tendencia'),
    gastosKpiSinFactura: document.getElementById('gastos-kpi-sin-factura'),
    gastosKpiSinFacturaTendencia: document.getElementById('gastos-kpi-sin-factura-tendencia'),
    gastosKpiVs: document.getElementById('gastos-kpi-vs'),
    gastosKpiVsTendencia: document.getElementById('gastos-kpi-vs-tendencia'),
    // Vista Resumen financiero
    resumenFinError: document.getElementById('resumen-fin-error'),
    resumenFinKpiFacturado: document.getElementById('resumen-fin-kpi-facturado'),
    resumenFinKpiFacturadoTendencia: document.getElementById('resumen-fin-kpi-facturado-tendencia'),
    resumenFinKpiGastos: document.getElementById('resumen-fin-kpi-gastos'),
    resumenFinKpiGastosTendencia: document.getElementById('resumen-fin-kpi-gastos-tendencia'),
    resumenFinKpiBalance: document.getElementById('resumen-fin-kpi-balance'),
    resumenFinKpiSinFacturar: document.getElementById('resumen-fin-kpi-sin-facturar'),
    resumenFinChartBody: document.getElementById('resumen-fin-chart-body'),
    resumenFinChartEmpty: document.getElementById('resumen-fin-chart-empty'),
    chartVfgTagQ: document.getElementById('chart-vfg-tag-q'),
    chartVfgTagN: document.getElementById('chart-vfg-tag-n'),
    chartVfgKpis: document.getElementById('chart-vfg-kpis'),
    chartVfgKpiVentas: document.getElementById('chart-vfg-kpi-ventas'),
    chartVfgKpiPct: document.getElementById('chart-vfg-kpi-pct'),
    chartVfgKpiSinfact: document.getElementById('chart-vfg-kpi-sinfact'),
    chartVfgAlerta: document.getElementById('chart-vfg-alerta'),
    chartVfgAlertaTexto: document.getElementById('chart-vfg-alerta-texto'),
    chartVfgBtnIrVentas: document.getElementById('chart-vfg-btn-ir-ventas'),
    resumenFinChartLeyendaFiltrable: document.getElementById('resumen-fin-chart-leyenda-filtrable'),
    resumenFinUtilidadValor: document.getElementById('resumen-fin-utilidad-valor'),
    resumenFinUtilidadBody: document.getElementById('resumen-fin-utilidad-body'),
    resumenFinUtilidadEmpty: document.getElementById('resumen-fin-utilidad-empty'),
    unmMiniTagQ: document.getElementById('unm-mini-tag-q'),
    unmMiniBadge: document.getElementById('unm-mini-badge'),
    unmMiniKpis: document.getElementById('unm-mini-kpis'),
    unmMiniKpiVentas: document.getElementById('unm-mini-kpi-ventas'),
    unmMiniKpiVentasNota: document.getElementById('unm-mini-kpi-ventas-nota'),
    unmMiniKpiGastos: document.getElementById('unm-mini-kpi-gastos'),
    unmMiniKpiGastosNota: document.getElementById('unm-mini-kpi-gastos-nota'),
    unmMiniAlerta: document.getElementById('unm-mini-alerta'),
    unmMiniAlertaTexto: document.getElementById('unm-mini-alerta-texto'),
    unmMiniBtnAnalizar: document.getElementById('unm-mini-btn-analizar'),
    unmMiniCierreTexto: document.getElementById('unm-mini-cierre-texto'),
    resumenFinBalanceSvg: document.getElementById('resumen-fin-balance-svg'),
    resumenFinBalanceEtiquetas: document.getElementById('resumen-fin-balance-etiquetas'),
    resumenFinBalanceEmpty: document.getElementById('resumen-fin-balance-empty'),
    resumenFinBalanceNota: document.getElementById('resumen-fin-balance-nota'),
    resumenFinBalanceKpis: document.getElementById('resumen-fin-balance-kpis'),
    resumenFinBalanceKpiAcum: document.getElementById('resumen-fin-balance-kpi-acum'),
    resumenFinBalanceKpiMax: document.getElementById('resumen-fin-balance-kpi-max'),
    resumenFinBalanceKpiMaxMes: document.getElementById('resumen-fin-balance-kpi-max-mes'),
    resumenFinProyeccionSvg: document.getElementById('resumen-fin-proyeccion-svg'),
    resumenFinProyeccionEtiquetas: document.getElementById('resumen-fin-proyeccion-etiquetas'),
    resumenFinProyeccionNota: document.getElementById('resumen-fin-proyeccion-nota'),
    resumenFinProyeccionEmpty: document.getElementById('resumen-fin-proyeccion-empty'),
    resumenFinProyeccionKpis: document.getElementById('resumen-fin-proyeccion-kpis'),
    resumenFinProyeccionKpiAcum: document.getElementById('resumen-fin-proyeccion-kpi-acum'),
    resumenFinProyeccionKpiProyCard: document.getElementById('resumen-fin-proyeccion-kpi-proy-card'),
    resumenFinProyeccionKpiProyMes: document.getElementById('resumen-fin-proyeccion-kpi-proy-mes'),
    resumenFinProyeccionKpiProy: document.getElementById('resumen-fin-proyeccion-kpi-proy'),
    resumenFinDonutCategorias: document.getElementById('resumen-fin-donut-categorias'),
    resumenFinDonutCategoriasTotal: document.getElementById('resumen-fin-donut-categorias-total'),
    resumenFinDonutCategoriasLeyenda: document.getElementById('resumen-fin-donut-categorias-leyenda'),
    resumenFinDonutCategoriasEmpty: document.getElementById('resumen-fin-donut-categorias-empty'),
    gastosCatTagQ: document.getElementById('gastos-cat-tag-q'),
    gastosCatKpis: document.getElementById('gastos-cat-kpis'),
    gastosCatKpiNcats: document.getElementById('gastos-cat-kpi-ncats'),
    gastosCatKpiTotal: document.getElementById('gastos-cat-kpi-total'),
    gastosCatKpiMayorPct: document.getElementById('gastos-cat-kpi-mayor-pct'),
    gastosCatKpiMayorMonto: document.getElementById('gastos-cat-kpi-mayor-monto'),
    gastosCatKpiMayorNombre: document.getElementById('gastos-cat-kpi-mayor-nombre'),
    gastosCatAlerta: document.getElementById('gastos-cat-alerta'),
    gastosCatAlertaTexto: document.getElementById('gastos-cat-alerta-texto'),
    gastosCatBtnVerDetalle: document.getElementById('gastos-cat-btn-ver-detalle'),
    gastosCatBtnIrGastos: document.getElementById('gastos-cat-btn-ir-gastos'),
    resumenFinDonutFacturacion: document.getElementById('resumen-fin-donut-facturacion'),
    resumenFinDonutFacturacionTotal: document.getElementById('resumen-fin-donut-facturacion-total'),
    resumenFinDonutFacturacionLeyenda: document.getElementById('resumen-fin-donut-facturacion-leyenda'),
    resumenFinDonutFacturacionEmpty: document.getElementById('resumen-fin-donut-facturacion-empty'),
    resumenFinDonutFacturacionKpis: document.getElementById('resumen-fin-donut-facturacion-kpis'),
    resumenFinDonutFacturacionKpiFacturado: document.getElementById('resumen-fin-donut-facturacion-kpi-facturado'),
    resumenFinDonutFacturacionKpiSinFacturar: document.getElementById('resumen-fin-donut-facturacion-kpi-sin-facturar'),
    resumenFinDonutFacturacionKpiOps: document.getElementById('resumen-fin-donut-facturacion-kpi-ops'),
    resumenFinDonutFacturacionKpiPct: document.getElementById('resumen-fin-donut-facturacion-kpi-pct'),
    resumenFinDonutFacturacionTagQ: document.getElementById('resumen-fin-donut-facturacion-tag-q'),
    resumenFinDonutFacturacionBadge: document.getElementById('resumen-fin-donut-facturacion-badge'),
    resumenFinCierreBanner: document.getElementById('resumen-fin-cierre-banner'),
    resumenFinCierreBannerTexto: document.getElementById('resumen-fin-cierre-banner-texto'),
    resumenFinDonutFacturacionNota: document.getElementById('resumen-fin-donut-facturacion-nota'),
    resumenFinProveedoresLista: document.getElementById('resumen-fin-proveedores-lista'),
    resumenFinProveedoresEmpty: document.getElementById('resumen-fin-proveedores-empty'),
    proveedoresTagQ: document.getElementById('proveedores-tag-q'),
    proveedoresTagN: document.getElementById('proveedores-tag-n'),
    proveedoresKpis: document.getElementById('proveedores-kpis'),
    proveedoresKpiTop5Total: document.getElementById('proveedores-kpi-top5-total'),
    proveedoresKpiTop5Pct: document.getElementById('proveedores-kpi-top5-pct'),
    proveedoresKpiMayorPct: document.getElementById('proveedores-kpi-mayor-pct'),
    proveedoresKpiMayorMonto: document.getElementById('proveedores-kpi-mayor-monto'),
    proveedoresKpiMayorNombre: document.getElementById('proveedores-kpi-mayor-nombre'),
    proveedoresAlerta: document.getElementById('proveedores-alerta'),
    proveedoresAlertaTexto: document.getElementById('proveedores-alerta-texto'),
    proveedoresBtnIrGastos: document.getElementById('proveedores-btn-ir-gastos'),
    // "Cobranza del mes" — mini tarjeta homologada con stitch/cxc
    cobranzaKpis: document.getElementById('cobranza-kpis'),
    cobranzaKpiCobrado: document.getElementById('cobranza-kpi-cobrado'),
    cobranzaKpiCobradoPct: document.getElementById('cobranza-kpi-cobrado-pct'),
    cobranzaKpiPorcobrar: document.getElementById('cobranza-kpi-porcobrar'),
    cobranzaKpiPorcobrarPct: document.getElementById('cobranza-kpi-porcobrar-pct'),
    cobranzaKpiPorcobrarNota: document.getElementById('cobranza-kpi-porcobrar-nota'),
    resumenFinDonutCobranza: document.getElementById('resumen-fin-donut-cobranza'),
    resumenFinDonutCobranzaTotal: document.getElementById('resumen-fin-donut-cobranza-total'),
    resumenFinDonutCobranzaBadge: document.getElementById('resumen-fin-donut-cobranza-badge'),
    resumenFinDonutCobranzaLeyenda: document.getElementById('resumen-fin-donut-cobranza-leyenda'),
    resumenFinDonutCobranzaEmpty: document.getElementById('resumen-fin-donut-cobranza-empty'),
    cobranzaAlerta: document.getElementById('cobranza-alerta'),
    cobranzaAlertaTexto: document.getElementById('cobranza-alerta-texto'),
    cobranzaAlertaBtn: document.getElementById('cobranza-alerta-btn'),
    cobranzaBtnIrCxc: document.getElementById('cobranza-btn-ir-cxc'),
    resumenFinDetalleOverlay: document.getElementById('resumen-fin-detalle-overlay'),
    resumenFinDetalleModal: document.querySelector('.resumen-fin-detalle-modal'),
    resumenFinDetalleBody: document.getElementById('resumen-fin-detalle-body'),
    resumenFinDetalleTitulo: document.getElementById('resumen-fin-detalle-titulo'),
    resumenFinDetalleIcono: document.getElementById('resumen-fin-detalle-icono'),
    btnResumenFinDetalleCerrar: document.getElementById('btn-resumen-fin-detalle-cerrar'),
    // Modo dashboard (punto 119)
    btnModoDashboard: document.getElementById('btn-modo-dashboard'),
    btnRestablecerDashboard: document.getElementById('btn-restablecer-dashboard'),
    resumenFinDashboardAyuda: document.getElementById('resumen-fin-dashboard-ayuda'),
    resumenFinTablero: document.getElementById('resumen-fin-tablero'),
    gastosFiltroPeriodo: document.getElementById('gastos-filtro-periodo'),
    gastosFiltroCategoria: document.getElementById('gastos-filtro-categoria'),
    gastosFiltroFactura: document.getElementById('gastos-filtro-factura'),
    gastosFiltroRecurrente: document.getElementById('gastos-filtro-recurrente'),
    gastosFiltroDesde: document.getElementById('gastos-filtro-desde'),
    gastosFiltroHasta: document.getElementById('gastos-filtro-hasta'),
    gastosBusqueda: document.getElementById('gastos-busqueda'),
    btnLimpiarFiltrosGastos: document.getElementById('btn-limpiar-filtros-gastos'),
    gastosFiltrosChips: document.getElementById('gastos-filtros-chips'),
    btnLimpiarGastosBusqueda: document.getElementById('btn-limpiar-gastos-busqueda'),
    gastosError: document.getElementById('gastos-error'),
    gastosTableBody: document.getElementById('gastos-table-body'),
    gastosEmpty: document.getElementById('gastos-empty'),
    // ---------- Inventarios (segmento 3) ----------
    btnVistaInventarios: document.getElementById('btn-vista-inventarios'),
    vistaInventarios: document.getElementById('vista-inventarios'),
    btnVerInvActivos: document.getElementById('btn-ver-inv-activos'),
    btnVerInvPapelera: document.getElementById('btn-ver-inv-papelera'),
    btnVerInvServicios: document.getElementById('btn-ver-inv-servicios'),
    invTabPillActivos: document.getElementById('inv-tab-pill-activos'),
    invTabPillPapelera: document.getElementById('inv-tab-pill-papelera'),
    invTabPillServicios: document.getElementById('inv-tab-pill-servicios'),
    btnInvServiciosAdministrar: document.getElementById('btn-inv-servicios-administrar'),
    invKpiCostoProm: document.getElementById('inv-kpi-costo-prom'),
    invKpiPiezasTotal: document.getElementById('inv-kpi-piezas-total'),
    invKpiSinMovimientoNota: document.getElementById('inv-kpi-sin-movimiento-nota'),
    btnInvVerificarIntegridad: document.getElementById('btn-inv-verificar-integridad'),
    btnRefreshInventarios: document.getElementById('btn-refresh-inventarios'),
    btnInvExportarKardex: document.getElementById('btn-inv-exportar-kardex'),
    btnNuevoProducto: document.getElementById('btn-nuevo-producto'),
    invKpiBajoMinimoCard: document.getElementById('inv-kpi-bajo-minimo-card'),
    invKpiSinExistenciaCard: document.getElementById('inv-kpi-sin-existencia-card'),
    invChipsStock: document.getElementById('inv-chips-stock'),
    btnInvChipTodos: document.getElementById('btn-inv-chip-todos'),
    btnInvChipBajoMinimo: document.getElementById('btn-inv-chip-bajo-minimo'),
    btnInvChipSinExistencia: document.getElementById('btn-inv-chip-sin-existencia'),
    btnInvChipOptimo: document.getElementById('btn-inv-chip-optimo'),
    invTableTfoot: document.getElementById('inv-table-tfoot'),
    invTfootUnidades: document.getElementById('inv-tfoot-unidades'),
    invTfootValor: document.getElementById('inv-tfoot-valor'),
    invTfootAlertas: document.getElementById('inv-tfoot-alertas'),
    invKpiValor: document.getElementById('inv-kpi-valor'),
    invKpiActivos: document.getElementById('inv-kpi-activos'),
    invKpiServicios: document.getElementById('inv-kpi-servicios'),
    invKpiUnidades: document.getElementById('inv-kpi-unidades'),
    invKpiBajoMinimo: document.getElementById('inv-kpi-bajo-minimo'),
    invKpiSinExistencia: document.getElementById('inv-kpi-sin-existencia'),
    invKpiSinMovimiento: document.getElementById('inv-kpi-sin-movimiento'),
    invKpiMermas: document.getElementById('inv-kpi-mermas'),
    invKpiMermasCantidad: document.getElementById('inv-kpi-mermas-cantidad'),
    invKpiPorVencer: document.getElementById('inv-kpi-por-vencer'),
    invKpiPorVencerCard: document.getElementById('inv-kpi-por-vencer-card'),
    invPorVencerModalOverlay: document.getElementById('inv-por-vencer-modal-overlay'),
    invPorVencerTableBody: document.getElementById('inv-por-vencer-table-body'),
    invPorVencerEmpty: document.getElementById('inv-por-vencer-empty'),
    btnInvPorVencerCerrar: document.getElementById('btn-inv-por-vencer-cerrar'),
    invFiltroCategoria: document.getElementById('inv-filtro-categoria'),
    invFiltroEstado: document.getElementById('inv-filtro-estado'),
    invFiltroTipo: document.getElementById('inv-filtro-tipo'),
    invBusqueda: document.getElementById('inv-busqueda'),
    btnLimpiarFiltrosInv: document.getElementById('btn-limpiar-filtros-inv'),
    invFiltrosChips: document.getElementById('inv-filtros-chips'),
    btnLimpiarInvBusqueda: document.getElementById('btn-limpiar-inv-busqueda'),
    invError: document.getElementById('inv-error'),
    invKpiGridPrincipal: document.getElementById('inv-kpi-grid-principal'),
    invTableBody: document.getElementById('inv-table-body'),
    invTableWrap: document.getElementById('inv-table-wrap'),
    btnInvColumns: document.getElementById('btn-inv-columns'),
    invColumnTogglePanel: document.getElementById('inv-column-toggle-panel'),
    invEmpty: document.getElementById('inv-empty'),
    // Modal de crear/editar producto
    invProductoModalOverlay: document.getElementById('inv-producto-modal-overlay'),
    invProductoModalTitle: document.getElementById('inv-producto-modal-title'),
    btnInvProductoModalCerrar: document.getElementById('btn-inv-producto-modal-cerrar'),
    btnInvTipoProducto: document.getElementById('btn-inv-tipo-producto'),
    btnInvTipoServicio: document.getElementById('btn-inv-tipo-servicio'),
    invModalTipoHint: document.getElementById('inv-modal-tipo-hint'),
    invModalNombre: document.getElementById('inv-modal-nombre'),
    invModalSku: document.getElementById('inv-modal-sku'),
    invModalCodigoBarras: document.getElementById('inv-modal-codigo-barras'),
    invModalCodigoBarrasField: document.getElementById('inv-modal-codigo-barras-field'),
    btnInvModalEscanear: document.getElementById('btn-inv-modal-escanear'),
    invModalImagenField: document.getElementById('inv-modal-imagen-field'),
    invImagenActual: document.getElementById('inv-imagen-actual'),
    invImagenActualPreview: document.getElementById('inv-imagen-actual-preview'),
    btnInvImagenQuitar: document.getElementById('btn-inv-imagen-quitar'),
    invImagenDropzone: document.getElementById('inv-imagen-dropzone'),
    invImagenInput: document.getElementById('inv-imagen-input'),
    errorInvModalImagen: document.getElementById('error-inv-modal-imagen'),
    invModalCategoria: document.getElementById('inv-modal-categoria'),
    btnInvCategoriasToggle: document.getElementById('btn-inv-categorias-toggle'),
    invCategoriasPanel: document.getElementById('inv-categorias-panel'),
    invCategoriasLista: document.getElementById('inv-categorias-lista'),
    invCategoriaNuevaInput: document.getElementById('inv-categoria-nueva-input'),
    btnInvCategoriaAgregar: document.getElementById('btn-inv-categoria-agregar'),
    errorInvCategoriaNueva: document.getElementById('error-inv-categoria-nueva'),
    invModalUnidad: document.getElementById('inv-modal-unidad'),
    invModalUnidadLabelTexto: document.getElementById('inv-modal-unidad-label-texto'),
    invModalUnidadHintServicio: document.getElementById('inv-modal-unidad-hint-servicio'),
    invModalMoneda: document.getElementById('inv-modal-moneda'),
    invModalCosto: document.getElementById('inv-modal-costo'),
    invModalPrecio: document.getElementById('inv-modal-precio'),
    invModalStockMinimo: document.getElementById('inv-modal-stock-minimo'),
    invModalStockMinimoField: document.getElementById('inv-modal-stock-minimo-field'),
    invModalStockMaximo: document.getElementById('inv-modal-stock-maximo'),
    invModalStockMaximoField: document.getElementById('inv-modal-stock-maximo-field'),
    invModalPuntoReorden: document.getElementById('inv-modal-punto-reorden'),
    invModalPuntoReordenField: document.getElementById('inv-modal-punto-reorden-field'),
    invModalFechaExpiracion: document.getElementById('inv-modal-fecha-expiracion'),
    invModalFechaExpiracionField: document.getElementById('inv-modal-fecha-expiracion-field'),
    invModalEstado: document.getElementById('inv-modal-estado'),
    invModalProveedor: document.getElementById('inv-modal-proveedor'),
    invModalNotas: document.getElementById('inv-modal-notas'),
    invModalErrorGeneral: document.getElementById('inv-modal-error-general'),
    btnInvModalCancelar: document.getElementById('btn-inv-modal-cancelar'),
    btnInvModalGuardar: document.getElementById('btn-inv-modal-guardar'),
    btnInvModalGuardarLabel: document.getElementById('btn-inv-modal-guardar-label'),
    // Modal de movimiento (entrada/salida)
    invMovimientoModalOverlay: document.getElementById('inv-movimiento-modal-overlay'),
    invMovimientoModalSubtitulo: document.getElementById('inv-movimiento-modal-subtitulo'),
    btnInvMovEntrada: document.getElementById('btn-inv-mov-entrada'),
    btnInvMovSalida: document.getElementById('btn-inv-mov-salida'),
    invMovTipo: document.getElementById('inv-mov-tipo'),
    invMovCantidad: document.getElementById('inv-mov-cantidad'),
    invMovCostoWrap: document.getElementById('inv-mov-costo-wrap'),
    invMovCosto: document.getElementById('inv-mov-costo'),
    invMovCostoUsdWrap: document.getElementById('inv-mov-costo-usd-wrap'),
    invMovCostoOriginal: document.getElementById('inv-mov-costo-original'),
    invMovTipoCambio: document.getElementById('inv-mov-tipo-cambio'),
    invMovTipoCambioFuente: document.getElementById('inv-mov-tipo-cambio-fuente'),
    invMovCostoMxnPreview: document.getElementById('inv-mov-costo-mxn-preview'),
    invMovMotivo: document.getElementById('inv-mov-motivo'),
    invMovNotas: document.getElementById('inv-mov-notas'),
    invMovErrorGeneral: document.getElementById('inv-mov-error-general'),
    btnInvMovCancelar: document.getElementById('btn-inv-mov-cancelar'),
    btnInvMovGuardar: document.getElementById('btn-inv-mov-guardar'),
    btnInvMovGuardarLabel: document.getElementById('btn-inv-mov-guardar-label'),
    // Modal de kardex
    invKardexModalOverlay: document.getElementById('inv-kardex-modal-overlay'),
    btnInvKardexCerrar: document.getElementById('btn-inv-kardex-cerrar'),
    invKardexSubtitulo: document.getElementById('inv-kardex-subtitulo'),
    invKardexTableBody: document.getElementById('inv-kardex-table-body'),
    invKardexEmpty: document.getElementById('inv-kardex-empty'),
    // Etiqueta de código de barras imprimible (punto 167)
    invEtiquetaModalOverlay: document.getElementById('inv-etiqueta-modal-overlay'),
    btnInvEtiquetaCerrar: document.getElementById('btn-inv-etiqueta-cerrar'),
    btnInvEtiquetaCancelar: document.getElementById('btn-inv-etiqueta-cancelar'),
    btnInvEtiquetaImprimir: document.getElementById('btn-inv-etiqueta-imprimir'),
    invEtiquetaProductoNombre: document.getElementById('inv-etiqueta-producto-nombre'),
    invEtiquetaFormato: document.getElementById('inv-etiqueta-formato'),
    invEtiquetaCantidad: document.getElementById('inv-etiqueta-cantidad'),
    invEtiquetaPreview: document.getElementById('inv-etiqueta-preview'),
    invEtiquetaPreviewBarra: document.getElementById('inv-etiqueta-preview-barra'),
    invEtiquetaPreviewNombre: document.getElementById('inv-etiqueta-preview-nombre'),
    invEtiquetaPreviewPrecio: document.getElementById('inv-etiqueta-preview-precio'),
    invEtiquetaPreviewCodigo: document.getElementById('inv-etiqueta-preview-codigo'),
    invEtiquetaErrorGeneral: document.getElementById('inv-etiqueta-error-general'),
    invEtiquetaImprimirContenedor: document.getElementById('inv-etiqueta-imprimir'),
    // Importador masivo CSV/XLSX (§34, segmento 6)
    btnInvImportar: document.getElementById('btn-inv-importar'),
    invImportacionModalOverlay: document.getElementById('inv-importacion-modal-overlay'),
    btnInvImportacionCerrar: document.getElementById('btn-inv-importacion-cerrar'),
    invImportErrorGeneral: document.getElementById('inv-import-error-general'),
    btnInvImportPlantillaCsv: document.getElementById('btn-inv-import-plantilla-csv'),
    btnInvImportPlantillaXlsx: document.getElementById('btn-inv-import-plantilla-xlsx'),
    invImportPreset: document.getElementById('inv-import-preset'),
    invImportArchivo: document.getElementById('inv-import-archivo'),
    invImportHojaField: document.getElementById('inv-import-hoja-field'),
    invImportHojaSelect: document.getElementById('inv-import-hoja-select'),
    invImportInfoArchivo: document.getElementById('inv-import-info-archivo'),
    invImportPreviewThead: document.getElementById('inv-import-preview-thead'),
    invImportPreviewTbody: document.getElementById('inv-import-preview-tbody'),
    invImportPerfilAviso: document.getElementById('inv-import-perfil-aviso'),
    invImportCobertura: document.getElementById('inv-import-cobertura'),
    invImportMapeoBody: document.getElementById('inv-import-mapeo-body'),
    invImportConservarExtra: document.getElementById('inv-import-conservar-extra'),
    invImportGuardarPerfil: document.getElementById('inv-import-guardar-perfil'),
    invImportNombrePerfilField: document.getElementById('inv-import-nombre-perfil-field'),
    invImportNombrePerfil: document.getElementById('inv-import-nombre-perfil'),
    invImportSobrescribirVacios: document.getElementById('inv-import-sobrescribir-vacios'),
    invImportResultadoValidacion: document.getElementById('inv-import-resultado-validacion'),
    invImportValidacionResumen: document.getElementById('inv-import-validacion-resumen'),
    invImportErroresBody: document.getElementById('inv-import-errores-body'),
    btnInvImportDescargarErrores: document.getElementById('btn-inv-import-descargar-errores'),
    invImportConfirmacionEjecutar: document.getElementById('inv-import-confirmacion-ejecutar'),
    invImportProgresoEjecucion: document.getElementById('inv-import-progreso-ejecucion'),
    invImportProgresoTexto: document.getElementById('inv-import-progreso-texto'),
    invImportResultadoTexto: document.getElementById('inv-import-resultado-texto'),
    btnInvImportOtra: document.getElementById('btn-inv-import-otra'),
    btnInvImportTerminar: document.getElementById('btn-inv-import-terminar'),
    invImportNav: document.getElementById('inv-import-nav'),
    btnInvImportCancelar: document.getElementById('btn-inv-import-cancelar'),
    btnInvImportAtras: document.getElementById('btn-inv-import-atras'),
    btnInvImportSiguiente: document.getElementById('btn-inv-import-siguiente'),
    // Ayuda y diccionario de datos (§56, segmento 8)
    btnInvAyudaAbrir: document.getElementById('btn-inv-ayuda-abrir'),
    invAyudaModalOverlay: document.getElementById('inv-ayuda-modal-overlay'),
    btnInvAyudaCerrar: document.getElementById('btn-inv-ayuda-cerrar'),
    invAyudaBuscar: document.getElementById('inv-ayuda-buscar'),
    invAyudaResultadosTexto: document.getElementById('inv-ayuda-resultados-texto'),
    invAyudaSalto: document.getElementById('inv-ayuda-salto'),
    invAyudaCuerpo: document.getElementById('inv-ayuda-cuerpo'),
    invAyudaContenido: document.getElementById('inv-ayuda-contenido'),
    // Ayuda por vista (punto 191, Fase 1 UX) — Ventas/Cuentas por cobrar/Gastos
    btnAyudaVistaOrdenes: document.getElementById('btn-ayuda-vista-ordenes'),
    btnAyudaVistaCxc: document.getElementById('btn-ayuda-vista-cxc'),
    btnAyudaVistaGastos: document.getElementById('btn-ayuda-vista-gastos'),
    ayudaVistaModalOverlay: document.getElementById('ayuda-vista-modal-overlay'),
    ayudaVistaModalTitle: document.getElementById('ayuda-vista-modal-title'),
    ayudaVistaContenido: document.getElementById('ayuda-vista-contenido'),
    btnAyudaVistaCerrar: document.getElementById('btn-ayuda-vista-cerrar'),
    // Centro de conocimiento (Fase 6 UX) — manual completo de /admin
    btnAbrirConocimiento: document.getElementById('btn-abrir-conocimiento'),
    btnAbrirConocimientoTopbar: document.getElementById('btn-abrir-conocimiento-topbar'),
    conocimientoOverlay: document.getElementById('conocimiento-modal-overlay'),
    conocimientoSidebar: document.getElementById('conocimiento-modal-sidebar'),
    conocimientoBuscar: document.getElementById('conocimiento-modal-buscar'),
    conocimientoNav: document.getElementById('conocimiento-modal-nav'),
    conocimientoNavEmpty: document.getElementById('conocimiento-modal-nav-empty'),
    conocimientoMain: document.getElementById('conocimiento-modal-main'),
    conocimientoTitle: document.getElementById('conocimiento-modal-title'),
    conocimientoMainBody: document.getElementById('conocimiento-modal-main-body'),
    conocimientoBtnVolver: document.getElementById('conocimiento-modal-btn-volver'),
    btnCerrarConocimiento: document.getElementById('btn-cerrar-conocimiento-modal'),
    btnOrdenesEmptyRegistrar: document.getElementById('btn-ordenes-empty-registrar'),
    btnCxcEmptyRegistrar: document.getElementById('btn-cxc-empty-registrar'),
    btnGastosEmptyRegistrar: document.getElementById('btn-gastos-empty-registrar'),
    gastosFiltroEmpty: document.getElementById('gastos-filtro-empty'),
    gastosPapeleraEmpty: document.getElementById('gastos-papelera-empty'),
    // Recorrido de bienvenida (Fase 2 UX, punto 191)
    onboardingTourOverlay: document.getElementById('onboarding-tour-overlay'),
    onboardingTourHueco: document.getElementById('onboarding-tour-hueco'),
    onboardingTourGlobo: document.getElementById('onboarding-tour-globo'),
    onboardingTourContador: document.getElementById('onboarding-tour-contador'),
    onboardingTourTitulo: document.getElementById('onboarding-tour-titulo'),
    onboardingTourDesc: document.getElementById('onboarding-tour-desc'),
    btnOnboardingTourSaltar: document.getElementById('btn-onboarding-tour-saltar'),
    btnOnboardingTourSiguiente: document.getElementById('btn-onboarding-tour-siguiente'),
    // Toggle "Inventario activo" (vista Usuarios)
    btnToggleInvCard: document.getElementById('btn-toggle-inv-card'),
    invToggleChevron: document.getElementById('inv-toggle-chevron'),
    invToggleBody: document.getElementById('inv-toggle-body'),
    configInventarioActivo: document.getElementById('config-inventario-activo'),
    invActivoAutoguardado: document.getElementById('inv-activo-autoguardado'),
    // Punto 186 (cierra el punto 182): switch "Solamente servicios"
    configInvSoloServicios: document.getElementById('config-inv-solo-servicios'),
    invSoloServiciosAutoguardado: document.getElementById('inv-solo-servicios-autoguardado'),
    invSoloServiciosError: document.getElementById('inv-solo-servicios-error'),
    invModalTipoFijoHint: document.getElementById('inv-modal-tipo-fijo-hint'),
    invKpiServiciosSinVentas: document.getElementById('inv-kpi-servicios-sin-ventas'),
    invEstadoServiciosKpiGrid: document.getElementById('inv-estado-servicios-kpi-grid'),
    invEstadoServKpiTotal: document.getElementById('inv-estado-serv-kpi-total'),
    invEstadoServKpiSinVentas: document.getElementById('inv-estado-serv-kpi-sin-ventas'),
    invEstadoServiciosGrid: document.getElementById('inv-estado-servicios-grid'),
    invEstadoServTopLista: document.getElementById('inv-estado-serv-top-lista'),
    invEstadoServBottomLista: document.getElementById('inv-estado-serv-bottom-lista'),
    invEstadoServRankEmpty: document.getElementById('inv-estado-serv-rank-empty'),
    // Modal de registro/edición de gasto
    gastosModalOverlay: document.getElementById('gastos-modal-overlay'),
    gastosModalTitle: document.getElementById('gastos-modal-title'),
    gastosModalFecha: document.getElementById('gastos-modal-fecha'),
    gastosModalConcepto: document.getElementById('gastos-modal-concepto'),
    gastosModalConceptoContador: document.getElementById('gastos-modal-concepto-contador'),
    gastosModalProveedor: document.getElementById('gastos-modal-proveedor'),
    gastosModalCategoria: document.getElementById('gastos-modal-categoria'),
    gastosModalCategoriaField: document.getElementById('gastos-modal-categoria-field'),
    btnGastosCategoriasToggle: document.getElementById('btn-gastos-categorias-toggle'),
    gastosCategoriasPanel: document.getElementById('gastos-categorias-panel'),
    gastosCategoriasLista: document.getElementById('gastos-categorias-lista'),
    gastosCategoriaNuevaInput: document.getElementById('gastos-categoria-nueva-input'),
    btnGastosCategoriaAgregar: document.getElementById('btn-gastos-categoria-agregar'),
    errorGastosCategoriaNueva: document.getElementById('error-gastos-categoria-nueva'),
    gastosModalMonto: document.getElementById('gastos-modal-monto'),
    gastosModalIvaIncluido: document.getElementById('gastos-modal-iva-incluido'),
    btnGastosModalConFactura: document.getElementById('btn-gastos-modal-con-factura'),
    btnGastosModalSinFactura: document.getElementById('btn-gastos-modal-sin-factura'),
    gastosModalFacturaHint: document.getElementById('gastos-modal-factura-hint'),
    gastosModalComprobanteWrap: document.getElementById('gastos-modal-comprobante-wrap'),
    gastosModalComprobante: document.getElementById('gastos-modal-comprobante'),
    gastosModalRecurrente: document.getElementById('gastos-modal-recurrente'),
    gastosModalNotas: document.getElementById('gastos-modal-notas'),
    gastosModalErrorGeneral: document.getElementById('gastos-modal-error-general'),
    btnGastosModalCerrar: document.getElementById('btn-gastos-modal-cerrar'),
    btnGastosModalCancelar: document.getElementById('btn-gastos-modal-cancelar'),
    btnGastosModalGuardar: document.getElementById('btn-gastos-modal-guardar'),
    btnGastosModalGuardarLabel: document.getElementById('btn-gastos-modal-guardar-label'),
    errorGastosModalFecha: document.getElementById('error-gastos-modal-fecha'),
    errorGastosModalConcepto: document.getElementById('error-gastos-modal-concepto'),
    errorGastosModalProveedor: document.getElementById('error-gastos-modal-proveedor'),
    errorGastosModalCategoria: document.getElementById('error-gastos-modal-categoria'),
    errorGastosModalMonto: document.getElementById('error-gastos-modal-monto'),
    errorGastosModalComprobante: document.getElementById('error-gastos-modal-comprobante'),
    errorGastosModalNotas: document.getElementById('error-gastos-modal-notas'),
    // Modal de detalle de gasto
    gastosDetalleOverlay: document.getElementById('gastos-detalle-modal-overlay'),
    gastosDetalleTitle: document.getElementById('gastos-detalle-modal-title'),
    gastosDetalleBadge: document.getElementById('gastos-detalle-badge'),
    gastosDetalleFecha: document.getElementById('gastos-detalle-fecha'),
    gastosDetalleConcepto: document.getElementById('gastos-detalle-concepto'),
    gastosDetalleProveedorItem: document.getElementById('gastos-detalle-proveedor-item'),
    gastosDetalleProveedor: document.getElementById('gastos-detalle-proveedor'),
    gastosDetalleCategoria: document.getElementById('gastos-detalle-categoria'),
    gastosDetalleMonto: document.getElementById('gastos-detalle-monto'),
    gastosDetalleIva: document.getElementById('gastos-detalle-iva'),
    gastosDetalleRecurrente: document.getElementById('gastos-detalle-recurrente'),
    gastosDetalleNotasItem: document.getElementById('gastos-detalle-notas-item'),
    gastosDetalleNotas: document.getElementById('gastos-detalle-notas'),
    gastosDetalleFacturaBadge: document.getElementById('gastos-detalle-factura-badge'),
    gastosDetalleComprobanteWrap: document.getElementById('gastos-detalle-comprobante-wrap'),
    gastosDetalleComprobanteNombre: document.getElementById('gastos-detalle-comprobante-nombre'),
    btnGastosDetalleDescargar: document.getElementById('btn-gastos-detalle-descargar'),
    btnGastosDetalleDescargarLabel: document.getElementById('btn-gastos-detalle-descargar-label'),
    btnGastosDetalleQuitarComprobante: document.getElementById('btn-gastos-detalle-quitar-comprobante'),
    btnGastosDetalleCerrar: document.getElementById('btn-gastos-detalle-cerrar'),
    btnGastosDetalleEditar: document.getElementById('btn-gastos-detalle-editar'),
    btnGastosDetalleEliminar: document.getElementById('btn-gastos-detalle-eliminar'),
    // Configuración global (IVA y zona horaria)
    btnToggleGlobalConfig: document.getElementById('btn-toggle-global-config'),
    ordenFormBody: document.getElementById('orden-form-body'),
    globalConfigBody: document.getElementById('global-config-body'),
    configIva: document.getElementById('config-iva'),
    configZonaHoraria: document.getElementById('config-zona-horaria'),
    configOrdenesHabilitado: document.getElementById('config-ordenes-habilitado'),
    ordenesHabilitadoAutoguardado: document.getElementById('ordenes-habilitado-autoguardado'),
    configEntregaDefaultRadios: document.querySelectorAll('input[name="entrega-venta-default"]'),
    entregaDefaultAutoguardado: document.getElementById('entrega-default-autoguardado'),
    configMetodoPagoDefaultRadios: document.querySelectorAll('input[name="metodo-pago-venta-default"]'),
    metodoPagoDefaultAutoguardado: document.getElementById('metodo-pago-default-autoguardado'),
    configFolioConciliacionPrefijo: document.getElementById('config-folio-conciliacion-prefijo'),
    configFolioPreviewValor: document.getElementById('config-folio-preview-valor'),
    folioConciliacionPrefijoAutoguardado: document.getElementById('folio-conciliacion-prefijo-autoguardado'),
    errorFolioConciliacionPrefijo: document.getElementById('error-folio-conciliacion-prefijo'),
    btnToggleAuditoriaCard: document.getElementById('btn-toggle-auditoria-card'),
    auditoriaToggleBody: document.getElementById('auditoria-toggle-body'),
    configAuditoriaHabilitada: document.getElementById('config-auditoria-habilitada'),
    auditoriaHabilitadaAutoguardado: document.getElementById('auditoria-habilitada-autoguardado'),
    btnToggleNotifCard: document.getElementById('btn-toggle-notif-card'),
    notifToggleBody: document.getElementById('notif-toggle-body'),
    configNotifTicketsPermiteOcultar: document.getElementById('config-notif-tickets-permite-ocultar'),
    notifTicketsPermiteOcultarAutoguardado: document.getElementById('notif-tickets-permite-ocultar-autoguardado'),
    configNotifExpNumero: document.getElementById('config-notif-exp-numero'),
    configNotifExpUnidad: document.getElementById('config-notif-exp-unidad'),
    btnConfigNotifExpAgregar: document.getElementById('btn-config-notif-exp-agregar'),
    errorConfigNotifExp: document.getElementById('error-config-notif-exp'),
    configNotifExpLista: document.getElementById('config-notif-exp-lista'),
    configNotifExpVacio: document.getElementById('config-notif-exp-vacio'),
    notifExpAutoguardado: document.getElementById('notif-exp-autoguardado'),
    configClaveSat: document.getElementById('config-clave-sat'),
    configClaveSatBuscador: document.getElementById('config-clave-sat-buscador'),
    configClaveSatSugerencias: document.getElementById('config-clave-sat-sugerencias'),
    configClaveSatHint: document.getElementById('config-clave-sat-hint'),
    configClaveSatSinResultados: document.getElementById('config-clave-sat-sin-resultados'),
    claveSatCatalogoInfo: document.getElementById('clave-sat-catalogo-info'),
    btnActualizarClaveSat: document.getElementById('btn-actualizar-clave-sat'),
    btnActualizarClaveSatLabel: document.getElementById('btn-actualizar-clave-sat-label'),
    constanciaCompaniaInput: document.getElementById('constancia-compania-input'),
    btnSubirConstanciaCompania: document.getElementById('btn-subir-constancia-compania'),
    btnSubirConstanciaCompaniaLabel: document.getElementById('btn-subir-constancia-compania-label'),
    errorConstanciaCompania: document.getElementById('error-constancia-compania'),
    regimenFiscalCompaniaBox: document.getElementById('regimen-fiscal-compania-box'),
    razonSocialCompaniaBox: document.getElementById('razon-social-compania-box'),
    brandFiscalInfo: document.getElementById('brand-fiscal-info'),
    configFiscalFaltanteOverlay: document.getElementById('config-fiscal-faltante-overlay'),
    btnConfigFiscalFaltanteCerrar: document.getElementById('btn-config-fiscal-faltante-cerrar'),
    globalConfigError: document.getElementById('global-config-error'),
    btnGuardarConfigGlobal: document.getElementById('btn-guardar-config-global'),
    // Configuración Reportes
    btnToggleReportesConfig: document.getElementById('btn-toggle-reportes-config'),
    reportesConfigBody: document.getElementById('reportes-config-body'),
    configCorreoReportes: document.getElementById('config-correo-reportes'),
    reportesConfigError: document.getElementById('reportes-config-error'),
    btnGuardarConfigReportes: document.getElementById('btn-guardar-config-reportes'),
    btnGuardarConfigReportesLabel: document.getElementById('btn-guardar-config-reportes-label'),
    contactoClienteBloque: document.getElementById('contacto-cliente-bloque'),
    contactoClienteHint: document.getElementById('contacto-cliente-hint'),
    configContactoCliente: document.getElementById('config-contacto-cliente'),
    contactoClienteError: document.getElementById('contacto-cliente-error'),
    btnGuardarContactoCliente: document.getElementById('btn-guardar-contacto-cliente'),
    btnGuardarContactoClienteLabel: document.getElementById('btn-guardar-contacto-cliente-label'),
    btnEnviarReporteManual: document.getElementById('btn-enviar-reporte-manual'),
    btnEnviarReporteManualLabel: document.getElementById('btn-enviar-reporte-manual-label'),
    errorEnviarReporteManual: document.getElementById('error-enviar-reporte-manual'),
    // Lectura de reportes
    reportesKpiGrid: document.getElementById('reportes-kpi-grid'),
    reportesKpiEliminados: document.getElementById('reportes-kpi-eliminados'),
    reportesKpiActivos: document.getElementById('reportes-kpi-activos'),
    reportesKpiChartBody: document.getElementById('reportes-kpi-chart-body'),
    reportesKpiChartEmpty: document.getElementById('reportes-kpi-chart-empty'),
    reportesSelector: document.getElementById('reportes-selector'),
    btnEliminarReporte: document.getElementById('btn-eliminar-reporte'),
    btnVerMdReporte: document.getElementById('btn-ver-md-reporte'),
    lecturaReportesResumen: document.getElementById('lectura-reportes-resumen'),
    resumenReporteTipo: document.getElementById('resumen-reporte-tipo'),
    resumenReporteFecha: document.getElementById('resumen-reporte-fecha'),
    resumenReporteTickets: document.getElementById('resumen-reporte-tickets'),
    resumenReporteOrdenes: document.getElementById('resumen-reporte-ordenes'),
    resumenReporteCorreo: document.getElementById('resumen-reporte-correo'),
    resumenReporteGeneradoPor: document.getElementById('resumen-reporte-generado-por'),
    lecturaReportesFiltros: document.getElementById('lectura-reportes-filtros'),
    filtroReporteTipo: document.getElementById('filtro-reporte-tipo'),
    filtroReporteEstatus: document.getElementById('filtro-reporte-estatus'),
    filtroReporteRfc: document.getElementById('filtro-reporte-rfc'),
    filtroReporteFechaDesde: document.getElementById('filtro-reporte-fecha-desde'),
    filtroReporteFechaHasta: document.getElementById('filtro-reporte-fecha-hasta'),
    btnLimpiarFiltrosReporte: document.getElementById('btn-limpiar-filtros-reporte'),
    reporteFiltrosChips: document.getElementById('reporte-filtros-chips'),
    btnLimpiarFiltroReporteRfc: document.getElementById('btn-limpiar-filtro-reporte-rfc'),
    reportesMovimientosWrap: document.getElementById('reportes-movimientos-wrap'),
    reportesMovimientosConteo: document.getElementById('reportes-movimientos-conteo'),
    reportesMovimientosTableBody: document.getElementById('reportes-movimientos-table-body'),
    reportesMovimientosEmpty: document.getElementById('reportes-movimientos-empty'),
    btnExportarMovimientosCsv: document.getElementById('btn-exportar-movimientos-csv'),
    btnExportarMovimientosExcel: document.getElementById('btn-exportar-movimientos-excel'),
    reportesEliminadosWrap: document.getElementById('reportes-eliminados-wrap'),
    reportesEliminadosConteo: document.getElementById('reportes-eliminados-conteo'),
    reportesEliminadosTableBody: document.getElementById('reportes-eliminados-table-body'),
    reportesEliminadosEmpty: document.getElementById('reportes-eliminados-empty'),
    btnExportarEliminadosCsv: document.getElementById('btn-exportar-eliminados-csv'),
    btnExportarEliminadosExcel: document.getElementById('btn-exportar-eliminados-excel'),
    reportesEliminadosTotalMonto: document.getElementById('reportes-eliminados-total-monto'),
    lecturaReportesSinSeleccion: document.getElementById('lectura-reportes-sin-seleccion'),
    reportesTabCaption: document.getElementById('reportes-tab-caption'),
    btnReportesVistaPorReporte: document.getElementById('btn-reportes-vista-por-reporte'),
    btnReportesVistaLedger: document.getElementById('btn-reportes-vista-ledger'),
    reportesVistaPorReporte: document.getElementById('reportes-vista-por-reporte'),
    reportesVistaLedger: document.getElementById('reportes-vista-ledger'),
    btnReportesVistaEstadoInventario: document.getElementById('btn-reportes-vista-estado-inventario'),
    reportesVistaEstadoInventario: document.getElementById('reportes-vista-estado-inventario'),
    // Pestaña "Cortes" (punto 169)
    btnReportesVistaCortes: document.getElementById('btn-reportes-vista-cortes'),
    reportesVistaCortes: document.getElementById('reportes-vista-cortes'),
    reportesCortesListaWrap: document.getElementById('reportes-cortes-lista-wrap'),
    reportesCortesTableBody: document.getElementById('reportes-cortes-table-body'),
    reportesCortesEmpty: document.getElementById('reportes-cortes-empty'),
    btnCortesIrVentas: document.getElementById('btn-cortes-ir-ventas'),
    reportesCortesDetalleWrap: document.getElementById('reportes-cortes-detalle-wrap'),
    btnCortesVolverLista: document.getElementById('btn-cortes-volver-lista'),
    cortesDetalleRango: document.getElementById('cortes-detalle-rango'),
    cortesDetalleFecha: document.getElementById('cortes-detalle-fecha'),
    cortesDetalleVentas: document.getElementById('cortes-detalle-ventas'),
    cortesDetalleTotal: document.getElementById('cortes-detalle-total'),
    cortesDetalleConteo: document.getElementById('cortes-detalle-conteo'),
    cortesDetalleBuscar: document.getElementById('cortes-detalle-buscar'),
    cortesDetallePaginacion: document.getElementById('cortes-detalle-paginacion'),
    reportesCortesDetalleTableBody: document.getElementById('reportes-cortes-detalle-table-body'),
    reportesCortesDetalleEmpty: document.getElementById('reportes-cortes-detalle-empty'),
    reportesCortesDetalleSinResultados: document.getElementById('reportes-cortes-detalle-sin-resultados'),
    btnImprimirCorteHistorico: document.getElementById('btn-imprimir-corte-historico'),
    btnExportarCorteCsv: document.getElementById('btn-exportar-corte-csv'),
    btnExportarCorteExcel: document.getElementById('btn-exportar-corte-excel'),
    btnEliminarCorte: document.getElementById('btn-eliminar-corte'),
    invEstadoKpiGrid: document.getElementById('inv-estado-kpi-grid'),
    invEstadoKpiValor: document.getElementById('inv-estado-kpi-valor'),
    invEstadoKpiRotacion: document.getElementById('inv-estado-kpi-rotacion'),
    invEstadoKpiSinMovimiento: document.getElementById('inv-estado-kpi-sin-movimiento'),
    invEstadoTopLista: document.getElementById('inv-estado-top-lista'),
    invEstadoBottomLista: document.getElementById('inv-estado-bottom-lista'),
    invEstadoRankEmpty: document.getElementById('inv-estado-rank-empty'),
    invEstadoRotacionLista: document.getElementById('inv-estado-rotacion-lista'),
    invEstadoRotacionLinea: document.getElementById('inv-estado-rotacion-linea'),
    invEstadoRotacionCaption: document.getElementById('inv-estado-rotacion-caption'),
    invEstadoRotacionEmpty: document.getElementById('inv-estado-rotacion-empty'),
    invEstadoDonutCategoria: document.getElementById('inv-estado-donut-categoria'),
    invEstadoDonutCategoriaTotal: document.getElementById('inv-estado-donut-categoria-total'),
    invEstadoDonutCategoriaLeyenda: document.getElementById('inv-estado-donut-categoria-leyenda'),
    invEstadoDonutCategoriaEmpty: document.getElementById('inv-estado-donut-categoria-empty'),
    invEstadoCoberturaBarra: document.getElementById('inv-estado-cobertura-barra'),
    invEstadoCoberturaLeyenda: document.getElementById('inv-estado-cobertura-leyenda'),
    invEstadoCoberturaEmpty: document.getElementById('inv-estado-cobertura-empty'),
    invEstadoToolbar: document.getElementById('inv-estado-toolbar'),
    btnInvEstadoImprimir: document.getElementById('btn-inv-estado-imprimir'),
    btnInvEstadoExportar: document.getElementById('btn-inv-estado-exportar'),
    invEstadoAlertaInmovilizado: document.getElementById('inv-estado-alerta-inmovilizado'),
    invEstadoAlertaInmovilizadoTexto: document.getElementById('inv-estado-alerta-inmovilizado-texto'),
    invEstadoAlertaInmovilizadoBtn: document.getElementById('inv-estado-alerta-inmovilizado-btn'),
    invEstadoKpiCostoProm: document.getElementById('inv-estado-kpi-costo-prom'),
    invEstadoKpiPiezasTotal: document.getElementById('inv-estado-kpi-piezas-total'),
    invEstadoKpiMontoInmovilizadoWrap: document.getElementById('inv-estado-kpi-monto-inmovilizado-wrap'),
    invEstadoKpiMontoInmovilizado: document.getElementById('inv-estado-kpi-monto-inmovilizado'),
    invEstadoKpiSalud: document.getElementById('inv-estado-kpi-salud'),
    invEstadoSaludGaugeValor: document.getElementById('inv-estado-salud-gauge-valor'),
    btnInvEstadoRankTop: document.getElementById('btn-inv-estado-rank-top'),
    btnInvEstadoRankBottom: document.getElementById('btn-inv-estado-rank-bottom'),
    invEstadoMatrizBody: document.getElementById('inv-estado-matriz-body'),
    invEstadoMatrizEmpty: document.getElementById('inv-estado-matriz-empty'),
    invEstadoImprimir: document.getElementById('inv-estado-imprimir'),
    ledgerFiltroTipo: document.getElementById('ledger-filtro-tipo'),
    ledgerFiltroEstatus: document.getElementById('ledger-filtro-estatus'),
    ledgerFiltroRfc: document.getElementById('ledger-filtro-rfc'),
    ledgerFiltroFechaDesde: document.getElementById('ledger-filtro-fecha-desde'),
    ledgerFiltroFechaHasta: document.getElementById('ledger-filtro-fecha-hasta'),
    btnLimpiarFiltrosLedger: document.getElementById('btn-limpiar-filtros-ledger'),
    ledgerFiltrosChips: document.getElementById('ledger-filtros-chips'),
    btnLimpiarLedgerFiltroRfc: document.getElementById('btn-limpiar-ledger-filtro-rfc'),
    ledgerConteo: document.getElementById('ledger-conteo'),
    ledgerTableBody: document.getElementById('ledger-table-body'),
    ledgerEmpty: document.getElementById('ledger-empty'),
    btnExportarLedgerCsv: document.getElementById('btn-exportar-ledger-csv'),
    btnExportarLedgerExcel: document.getElementById('btn-exportar-ledger-excel'),
    reportesTimelineOverlay: document.getElementById('reportes-timeline-overlay'),
    reportesTimelineSubtitulo: document.getElementById('reportes-timeline-subtitulo'),
    reportesTimelineLista: document.getElementById('reportes-timeline-lista'),
    reportesTimelineEmpty: document.getElementById('reportes-timeline-empty'),
    btnCerrarReportesTimeline: document.getElementById('btn-cerrar-reportes-timeline'),
    verMdOverlay: document.getElementById('ver-md-overlay'),
    verMdTitle: document.getElementById('ver-md-title'),
    verMdContenido: document.getElementById('ver-md-contenido'),
    btnDescargarMd: document.getElementById('btn-descargar-md'),
    btnCerrarVerMd: document.getElementById('btn-cerrar-ver-md'),
    btnGuardarConfigGlobalLabel: document.getElementById('btn-guardar-config-global-label'),
    // Tabla de usuarios
    usuariosCount: document.getElementById('usuarios-count'),
    usuariosFiltroPerfil: document.getElementById('usuarios-filtro-perfil'),
    btnRefreshUsuarios: document.getElementById('btn-refresh-usuarios'),
    btnCrearUsuario: document.getElementById('btn-crear-usuario'),
    usuariosError: document.getElementById('usuarios-error'),
    usuariosTableBody: document.getElementById('usuarios-table-body'),
    btnUsuariosColumns: document.getElementById('btn-usuarios-columns'),
    usuariosColumnTogglePanel: document.getElementById('usuarios-column-toggle-panel'),
    usuariosEmpty: document.getElementById('usuarios-empty'),
    btnPerfilesAccesoAbrir: document.getElementById('btn-perfiles-acceso-abrir'),
    perfilesAccesoOverlay: document.getElementById('perfiles-acceso-overlay'),
    btnPerfilesAccesoCerrar: document.getElementById('btn-perfiles-acceso-cerrar'),
    ordenesToggleCard: document.getElementById('ordenes-toggle-card'),
    btnToggleOrdenesCard: document.getElementById('btn-toggle-ordenes-card'),
    ordenesToggleBody: document.getElementById('ordenes-toggle-body'),
    // Modal de crear usuario
    crearUsuarioOverlay: document.getElementById('crear-usuario-overlay'),
    crearUsuarioPerfil: document.getElementById('crear-usuario-perfil'),
    crearUsuarioRfc: document.getElementById('crear-usuario-rfc'),
    crearUsuarioRfcLabel: document.getElementById('crear-usuario-rfc-label'),
    crearUsuarioRfcHint: document.getElementById('crear-usuario-rfc-hint'),
    crearUsuarioRfcField: document.getElementById('crear-usuario-rfc-field'),
    crearUsuarioTelefonoField: document.getElementById('crear-usuario-telefono-field'),
    crearUsuarioEmail: document.getElementById('crear-usuario-email'),
    crearUsuarioTelefono: document.getElementById('crear-usuario-telefono'),
    btnGenerarPasswordCrearUsuario: document.getElementById('btn-generar-password-crear-usuario'),
    crearUsuarioPassword: document.getElementById('crear-usuario-password'),
    btnToggleCrearUsuarioPassword: document.getElementById('btn-toggle-crear-usuario-password'),
    btnCopiarCrearUsuarioPassword: document.getElementById('btn-copiar-crear-usuario-password'),
    crearUsuarioForzarCambio: document.getElementById('crear-usuario-forzar-cambio'),
    crearUsuarioErrorGeneral: document.getElementById('crear-usuario-error-general'),
    btnCrearUsuarioCancelar: document.getElementById('btn-crear-usuario-cancelar'),
    btnCrearUsuarioCerrar: document.getElementById('btn-crear-usuario-cerrar'),
    // Editar usuario
    editarUsuarioOverlay: document.getElementById('editar-usuario-overlay'),
    editarUsuarioPerfil: document.getElementById('editar-usuario-perfil'),
    editarUsuarioRfcField: document.getElementById('editar-usuario-rfc-field'),
    editarUsuarioRfc: document.getElementById('editar-usuario-rfc'),
    editarUsuarioRfcLabel: document.getElementById('editar-usuario-rfc-label'),
    editarUsuarioRfcHint: document.getElementById('editar-usuario-rfc-hint'),
    editarUsuarioEmail: document.getElementById('editar-usuario-email'),
    editarUsuarioTelefonoField: document.getElementById('editar-usuario-telefono-field'),
    editarUsuarioTelefono: document.getElementById('editar-usuario-telefono'),
    editarUsuarioErrorGeneral: document.getElementById('editar-usuario-error-general'),
    btnEditarUsuarioCancelar: document.getElementById('btn-editar-usuario-cancelar'),
    btnEditarUsuarioGuardar: document.getElementById('btn-editar-usuario-guardar'),
    btnEditarUsuarioGuardarLabel: document.getElementById('btn-editar-usuario-guardar-label'),
    btnCrearUsuarioGuardar: document.getElementById('btn-crear-usuario-guardar'),
    btnCrearUsuarioGuardarLabel: document.getElementById('btn-crear-usuario-guardar-label'),
    // Modal de restablecer contraseña
    passwordModalOverlay: document.getElementById('password-modal-overlay'),
    passwordModalRfc: document.getElementById('password-modal-rfc'),
    btnGenerarPassword: document.getElementById('btn-generar-password'),
    passwordModalNueva: document.getElementById('password-modal-nueva'),
    btnTogglePasswordModal: document.getElementById('btn-toggle-password-modal'),
    btnCopiarPassword: document.getElementById('btn-copiar-password'),
    passwordModalError: document.getElementById('password-modal-error'),
    passwordModalForzarCambio: document.getElementById('password-modal-forzar-cambio'),
    btnPasswordModalCancelar: document.getElementById('btn-password-modal-cancelar'),
    btnPasswordModalGuardar: document.getElementById('btn-password-modal-guardar'),
    btnPasswordModalGuardarLabel: document.getElementById('btn-password-modal-guardar-label'),
    // Franja de estado de conexión (Ventas/Gastos offline)
    conexionBanner: document.getElementById('conexion-banner'),
    conexionBannerTexto: document.getElementById('conexion-banner-texto'),
  };

  // Cuenta suspendida a MEDIO USO (punto 290) — requireAdminAuth() ya
  // revalida en cada petición, pero cada llamada de este archivo solo
  // reaccionaba a 401, nunca a 403 — una cuenta suspendida por otro
  // operador seguía "adentro" hasta que el usuario refrescara la página
  // a mano. Interceptor global: cualquier 403 con codigo
  // 'CUENTA_SUSPENDIDA' (auth.js) fuerza logout al instante, sin tocar
  // los 60+ call sites que ya checan 401 uno por uno. Se excluye
  // `${API_BASE}/admin/login`: esa ruta ya maneja su propio 403 de
  // suspensión inline (submit de login e init(), que cierra sesión ante
  // cualquier !res.ok) — interceptarla aquí duplicaría el efecto.
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = function fetchConDeteccionDeSuspension(recurso, opciones) {
    return fetchOriginal(recurso, opciones).then((res) => {
      const url = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
      const esRutaAdmin = url.startsWith(`${API_BASE}/admin`) && !url.startsWith(`${API_BASE}/admin/login`);
      if (res.status === 403 && esRutaAdmin) {
        res.clone().json().then((data) => {
          if (data && data.codigo === 'CUENTA_SUSPENDIDA') {
            clearSession();
            showLogin();
            els.loginError.textContent = data.error || 'Tu cuenta está suspendida. Contacta a un administrador.';
          }
        }).catch(() => {});
      }
      return res;
    });
  };

  inicializarTooltips();
  inicializarScrollArrastrableTablas();

  // Copiar el folio de conciliación directo desde la columna "Pago" de
  // la tabla de Ventas, sin abrir el detalle de la venta (punto 342,
  // celdaPagoOrden más abajo) — un solo listener delegado, cubre tanto
  // las filas confirmadas como las de la cola offline, ambas se
  // repueblan dentro del mismo tbody.
  if (els.ordenesTableBody) {
    els.ordenesTableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.folio-copiable');
      if (!btn) return;
      const folio = btn.getAttribute('data-folio');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(folio).catch(() => {});
      }
      const span = btn.querySelector('span');
      const original = span.textContent;
      btn.classList.add('is-copiado');
      span.textContent = 'Copiado';
      setTimeout(() => {
        btn.classList.remove('is-copiado');
        span.textContent = original;
      }, 1200);
    });
  }

  // ---------- Modo fuera de línea: Ventas y Gastos (ver PROJECT_STATE.md
  // punto 132, US-073/074/075) — el módulo genérico vive en offline.js;
  // aquí solo se conecta la franja visual y los manejadores concretos de
  // sincronización de cada tipo. ----------
  if (window.OfflineQueue) {
    OfflineQueue.onCambioEstado((estado) => {
      if (estado === 'offline') {
        els.conexionBanner.hidden = false;
        els.conexionBanner.classList.remove('es-syncing', 'se-oculta');
        els.conexionBanner.classList.add('es-offline');
        els.conexionBannerTexto.textContent = 'Sin conexión a internet';
        document.body.classList.add('tiene-banner-conexion');
        // "Imprimir ticket" necesita un folio real, que no existe sin
        // conexión — se fuerza de vuelta a "Enviar por correo".
        if (typeof aplicarMetodoEntregaOrden === 'function' && ordenMetodoEntrega === 'imprimir') {
          aplicarMetodoEntregaOrden('correo');
        }
        if (els.btnOrdenEntregaImprimir) {
          els.btnOrdenEntregaImprimir.disabled = true;
          els.btnOrdenEntregaImprimir.setAttribute(
            'data-tooltip',
            'No disponible sin conexión — no hay folio para imprimir todavía'
          );
        }
      } else if (estado === 'syncing') {
        els.conexionBanner.hidden = false;
        els.conexionBanner.classList.remove('es-offline', 'se-oculta');
        els.conexionBanner.classList.add('es-syncing');
        els.conexionBannerTexto.textContent = 'Sincronizando datos…';
        document.body.classList.add('tiene-banner-conexion');
      } else {
        document.body.classList.remove('tiene-banner-conexion');
        if (els.btnOrdenEntregaImprimir) {
          els.btnOrdenEntregaImprimir.disabled = false;
          els.btnOrdenEntregaImprimir.removeAttribute('data-tooltip');
        }
        if (!els.conexionBanner.hidden) {
          els.conexionBanner.classList.add('se-oculta');
          setTimeout(() => {
            els.conexionBanner.hidden = true;
            els.conexionBanner.classList.remove('es-syncing', 'es-offline', 'se-oculta');
          }, 300);
        }
      }
    });

    OfflineQueue.registrarManejadorSync('ordenes', async (datos) => {
      const authHeader = getAuthHeader();
      if (!authHeader) return { ok: false, error: 'Sesión expirada — inicia sesión de nuevo.' };
      try {
        const res = await fetch(`${API_BASE}/admin/ordenes-compra`, {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error || 'No se pudo registrar la venta.' };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: 'No se pudo conectar con el servidor.' };
      }
    });

    OfflineQueue.registrarManejadorSync('gastos', async (datos) => {
      const authHeader = getAuthHeader();
      if (!authHeader) return { ok: false, error: 'Sesión expirada — inicia sesión de nuevo.' };
      try {
        const res = await fetch(`${API_BASE}/admin/gastos`, {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error || 'No se pudo registrar el gasto.' };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: 'No se pudo conectar con el servidor.' };
      }
    });

    OfflineQueue.onSincronizacionCompleta('ordenes', () => {
      if (typeof cargarOrdenes === 'function' && els.ordenesTableBody) cargarOrdenes();
    });
    OfflineQueue.onSincronizacionCompleta('gastos', () => {
      if (typeof cargarGastos === 'function' && els.gastosTableBody) cargarGastos();
    });
    OfflineQueue.onCambioCola('ordenes', () => {
      if (typeof aplicarFiltrosOrdenes === 'function') aplicarFiltrosOrdenes();
    });
    OfflineQueue.onCambioCola('gastos', () => {
      if (typeof renderizarGastosConPendientes === 'function') renderizarGastosConPendientes();
    });
  }

  const ESTATUS_INFO = {
    pendiente: { texto: 'Pendiente', clase: 'estatus-pendiente' },
    en_curso: { texto: 'En curso', clase: 'estatus-en-curso' },
    cancelado: { texto: 'Cancelado', clase: 'estatus-cancelado' },
    listo: { texto: 'Listo', clase: 'estatus-listo' },
  };

  // Etiquetas del "Tipo de pago" del ticket, para mostrar en el modal de
  // gestión — mismos slugs que valida el backend (ver TIPOS_PAGO en server.js).
  const TIPOS_PAGO_INFO = {
    efectivo: 'Pago en efectivo',
    transferencia: 'Pago con transferencia',
    tarjeta_debito: 'Pago con tarjeta de débito',
    tarjeta_credito: 'Pago con tarjeta de crédito',
    otro: 'Otro',
  };

  // Etiquetas y clases visuales del "Perfil" de cada usuario.
  const PERFIL_INFO = {
    cliente: { texto: 'Cliente', clase: 'perfil-cliente' },
    administrador: { texto: 'Administrador', clase: 'perfil-administrador' },
    fiscal: { texto: 'Fiscal', clase: 'perfil-fiscal' },
    ventas: { texto: 'Ventas', clase: 'perfil-ventas' },
    // Punto 321 ya traía el CSS (.perfil-inventario, admin.css) pero nunca
    // se conectó aquí — la tabla de Usuarios caía al fallback de texto
    // plano sin badge (Auditoría UX 2026-09-29, hallazgo 2).
    inventario: { texto: 'Inventario', clase: 'perfil-inventario' },
  };

  // Ícono de check en línea (SVG feather-like) — reemplaza el carácter
  // Unicode "✓" en los ~8 indicadores "Guardado" de autoguardado del
  // panel; único lugar que lo define, para no repetir el string en cada
  // sitio (Auditoría UX 2026-09-29, hallazgo 3). Va con `.innerHTML`,
  // nunca `.textContent` — el resto de los estados (Guardando…/error)
  // siguen usando `.textContent`, ya que su texto puede incluir mensajes
  // dinámicos del backend.
  const HTML_GUARDADO_OK =
    'Guardado <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="vertical-align:-1px"><path d="M4 12l5 5L20 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // Campos configurables como obligatorios/opcionales en el formulario público.
  const CAMPOS_CONFIGURABLES = ['tipo_persona', 'rfc', 'uso_cfdi', 'tipo_pago', 'comentarios'];
  // Columnas de la tabla que se pueden mostrar/ocultar.
  const COLUMNAS_TABLA = ['nombre', 'tipo', 'rfc', 'regimen', 'cp', 'correo', 'documento', 'actualizado'];
  const COLUMNAS_STORAGE_KEY = 'admin_columnas_visibles';
  const ANCHOS_STORAGE_KEY = 'admin_anchos_columnas';
  // Mismo mecanismo de columnas ajustables (mostrar/ocultar + redimensionar),
  // aplicado también a la tabla de "Ventas registradas" — claves de
  // localStorage separadas para no mezclar las preferencias de ambas tablas.
  const COLUMNAS_TABLA_ORDENES = ['numero', 'fecha', 'concepto', 'cantidad', 'iva', 'total', 'correo', 'pago'];
  const COLUMNAS_ORDENES_STORAGE_KEY = 'admin_ordenes_columnas_visibles';
  const ANCHOS_ORDENES_STORAGE_KEY = 'admin_ordenes_anchos_columnas';
  // Mismo mecanismo de columnas ajustables, aplicado a la tabla de
  // "Gastos" — claves de localStorage propias para no mezclar preferencias.
  const COLUMNAS_TABLA_GASTOS = ['fecha', 'concepto', 'proveedor', 'categoria', 'factura', 'monto'];
  const COLUMNAS_GASTOS_STORAGE_KEY = 'admin_gastos_columnas_visibles';
  const ANCHOS_GASTOS_STORAGE_KEY = 'admin_gastos_anchos_columnas';
  // Mismo mecanismo, generalizado a las 4 tablas que todavía no lo tenían
  // (Tickets, Cuentas por cobrar, Usuarios, Inventarios) — pedido explícito
  // del usuario para que todas las tablas del panel se comporten igual.
  const COLUMNAS_TABLA_TICKETS = ['folio', 'rfc', 'uso', 'ticket', 'estatus', 'asignado', 'notas', 'actualizado'];
  const COLUMNAS_TICKETS_STORAGE_KEY = 'admin_tickets_columnas_visibles';
  const ANCHOS_TICKETS_STORAGE_KEY = 'admin_tickets_anchos_columnas';
  const COLUMNAS_TABLA_CXC = ['numero', 'cliente', 'total', 'cobrado', 'saldo', 'vencimiento', 'estado'];
  const COLUMNAS_CXC_STORAGE_KEY = 'admin_cxc_columnas_visibles';
  const ANCHOS_CXC_STORAGE_KEY = 'admin_cxc_anchos_columnas';
  const COLUMNAS_TABLA_USUARIOS = ['rfc', 'perfil', 'contacto', 'registrado'];
  const COLUMNAS_USUARIOS_STORAGE_KEY = 'admin_usuarios_columnas_visibles';
  const ANCHOS_USUARIOS_STORAGE_KEY = 'admin_usuarios_anchos_columnas';
  // "imagen" no entra aquí a propósito: es una columna fija de 48px, sin
  // texto que ocultar ni ancho que negociar (ver punto 159, Segmento B).
  const COLUMNAS_TABLA_INVENTARIOS = ['sku', 'nombre', 'categoria', 'unidad', 'disponible', 'costo', 'precio', 'estado'];
  const COLUMNAS_INVENTARIOS_STORAGE_KEY = 'admin_inventarios_columnas_visibles';
  const ANCHOS_INVENTARIOS_STORAGE_KEY = 'admin_inventarios_anchos_columnas';

  // Categorías de gasto — EDITABLES desde el propio popup de "Registrar
  // gasto" (ver PROJECT_STATE.md, segmento "Categorías editables"); ya no
  // es una lista cerrada en código, vive en `state.categoriasGastos`
  // (cargada de GET /api/admin/gastos/categorias). "Otro" llega marcada
  // `protegida` desde el servidor y no se puede renombrar ni borrar.
  let categoriaGastoEditandoId = null;

  // Guarda todos los registros cargados del servidor para poder filtrarlos
  // en el cliente sin volver a pedirlos cada vez que el usuario escribe.
  const state = {
    registros: [],
    vista: 'activos', // 'activos' | 'papelera' (constancias)
    vistaTickets: 'activos', // 'activos' | 'papelera' (tickets) — estado separado, es otra tabla
    vistaGastos: 'activos', // 'activos' | 'papelera' (gastos) — estado separado, es otra tabla
    categoriasGastos: [], // { id, slug, etiqueta, activa, protegida, tieneGastos }
  };

  function showToast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle('is-error', isError);
    els.toast.hidden = false;
    clearTimeout(showToast._t);
    // Mensajes largos (sobre todo errores con pasos a seguir) necesitan más
    // tiempo en pantalla que un aviso corto de "listo".
    const duracion = Math.min(12000, Math.max(4500, message.length * 90));
    showToast._t = setTimeout(() => { els.toast.hidden = true; }, duracion);
  }

  function getAuthHeader() {
    const creds = sessionStorage.getItem(SESSION_KEY);
    return creds ? `Basic ${creds}` : null;
  }

  // Imágenes de producto (punto 159, Segmento B): son endpoints admin
  // protegidos por Basic Auth manual (sin diálogo nativo del navegador),
  // así que un <img src="..."> normal nunca manda el header
  // Authorization y siempre recibe 401 — hay que traer el archivo con
  // fetch() (que sí lleva el header) y convertirlo a blob URL. Cache por
  // URL exacta (incluye "?t=" de cache-busting) para no re-descargar la
  // misma miniatura en cada render de la tabla.
  const cacheImagenesAutenticadas = new Map();
  async function cargarImagenAutenticada(imgEl, url) {
    if (!imgEl || !url) return;
    if (cacheImagenesAutenticadas.has(url)) {
      imgEl.src = cacheImagenesAutenticadas.get(url);
      return;
    }
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(url, { headers: { Authorization: authHeader } });
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      cacheImagenesAutenticadas.set(url, blobUrl);
      imgEl.src = blobUrl;
    } catch (err) {
      // Sin imagen visible, la tabla/lista sigue funcionando igual.
    }
  }

  // Efecto lupa (Inventarios + sugerencias de producto en Ventas): un solo
  // elemento flotante compartido, posicionado con getBoundingClientRect()
  // y anclado a <body> — nunca dentro de la miniatura, para no quedar
  // recortado por el overflow:auto de la tabla/dropdown que la contiene.
  const elLupaProducto = document.getElementById('lupa-producto-flotante');
  function mostrarLupaProducto(wrapEl, imgEl) {
    if (!elLupaProducto || !imgEl || !imgEl.src) return;
    elLupaProducto.src = imgEl.src;
    const rect = wrapEl.getBoundingClientRect();
    const tamano = 180;
    const margen = 10;
    let left = rect.right + margen;
    if (left + tamano > window.innerWidth) left = Math.max(margen, rect.left - tamano - margen);
    let top = rect.top + rect.height / 2 - tamano / 2;
    top = Math.max(margen, Math.min(top, window.innerHeight - tamano - margen));
    elLupaProducto.style.left = `${left}px`;
    elLupaProducto.style.top = `${top}px`;
    elLupaProducto.hidden = false;
  }
  function ocultarLupaProducto() {
    if (elLupaProducto) elLupaProducto.hidden = true;
  }
  function activarLupaProducto(wrapEl, imgEl) {
    if (!wrapEl || !imgEl) return;
    wrapEl.addEventListener('mouseenter', () => mostrarLupaProducto(wrapEl, imgEl));
    wrapEl.addEventListener('mouseleave', ocultarLupaProducto);
    wrapEl.addEventListener('focusin', () => mostrarLupaProducto(wrapEl, imgEl));
    wrapEl.addEventListener('focusout', ocultarLupaProducto);
  }

  function setSession(username, password) {
    const encoded = btoa(unescape(encodeURIComponent(`${username}:${password}`)));
    sessionStorage.setItem(SESSION_KEY, encoded);
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    // Campana de notificaciones (punto 337): único choke-point de
    // logout/401 real — corta el sondeo de 60s aquí para no seguir
    // pegándole a la API con credenciales que ya no sirven.
    detenerSondeoNotificaciones();
  }

  // Recuerda la última vista del panel dentro de esta MISMA sesión de
  // pestaña (sessionStorage, no localStorage — se descarta sola al
  // cerrar la pestaña, igual que SESSION_KEY) para que un refresh del
  // navegador te deje donde estabas, en vez de mandarte siempre a
  // "Inicio". Un login nuevo sí resetea esto a "inicio" explícitamente
  // (ver el submit de #form-login) — la restauración es solo para
  // refrescar una sesión que ya estaba activa.
  const CLAVE_VISTA_ACTUAL = 'admin_vista_actual';
  function guardarVistaActual(vista) {
    sessionStorage.setItem(CLAVE_VISTA_ACTUAL, vista);
  }
  function obtenerVistaGuardada() {
    return sessionStorage.getItem(CLAVE_VISTA_ACTUAL);
  }

  function formatFecha(fechaInput) {
    if (!fechaInput) return '—';
    const texto = String(fechaInput);
    // El backend guarda fechas como "YYYY-MM-DD HH:MM:SS" en UTC (formato
    // DATETIME de MySQL, sin zona horaria en el texto). Registros muy
    // antiguos (de cuando la base de datos era SQLite) pueden tener el
    // formato ISO "YYYY-MM-DDTHH:MM:SS.sssZ" en su lugar; si ya trae "Z" se
    // parsea tal cual, si no, se asume UTC y se le agrega. Ambos casos se
    // soportan para que fechas de registros antiguos y nuevos se muestren
    // igual de bien.
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

  function formatBytes(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // ---------- Tooltip personalizado (sin librerías externas) ----------
  // Reemplaza el atributo "title" nativo en toda la app — se activa con
  // cualquier elemento que tenga el atributo "data-tooltip". El elemento
  // del tooltip se crea una sola vez y se reutiliza (no uno nuevo por
  // cada hover), y se agrega a document.body (no como hijo del elemento
  // que lo activa) para que no quede recortado dentro de las tablas con
  // scroll horizontal del panel — ver la nota completa en style.css.
  // Usa delegación de eventos sobre document, así que funciona igual con
  // filas de tabla agregadas dinámicamente después de esta llamada, sin
  // tener que volver a conectar nada.
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
      // Doble rAF: la primera confirma que el navegador ya calculó el
      // tamaño real del tooltip con el texto nuevo (para que
      // getBoundingClientRect en posicionar() sea correcto), la segunda
      // aplica la clase que dispara la transición de aparición.
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
    // Si la página hace scroll mientras un tooltip está abierto (ej.
    // dentro de una tabla con scroll horizontal), se oculta en vez de
    // quedar flotando en una posición que ya no corresponde a nada.
    document.addEventListener('scroll', ocultar, true);
  }

  // Arrastrar con clic izquierdo sostenido para hacer scroll horizontal
  // en TODAS las tablas del panel (.admin-table-wrap) + aviso flotante
  // "Desliza para ver más" mientras queden columnas ocultas a la
  // derecha — mismo componente reutilizable en cada tabla, igual que
  // inicializarTooltips(). Se corre una sola vez al arrancar: los
  // <tbody> se repueblan después con datos, pero el contenedor
  // .admin-table-wrap ya existe en el HTML desde el principio. En móvil
  // no hace nada útil (la tabla pasa a tarjetas apiladas,
  // overflow-x:visible, ver @media en admin.css) — ahí simplemente no
  // hay overflow que detectar, así que el aviso nunca se muestra.
  function inicializarScrollArrastrableTablas() {
    const SELECTOR_INTERACTIVO_SCROLL = 'button, a, input, select, textarea, .col-resizer';
    const UMBRAL_ARRASTRE = 4;

    document.querySelectorAll('.admin-table-wrap').forEach((wrap) => {
      const shell = document.createElement('div');
      shell.className = 'table-scroll-shell';
      wrap.parentNode.insertBefore(shell, wrap);
      shell.appendChild(wrap);

      const fade = document.createElement('div');
      fade.className = 'scroll-fade-edge';
      const pill = document.createElement('div');
      pill.className = 'scroll-hint-pill';
      pill.innerHTML = '<span>Desliza para ver más</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      shell.appendChild(fade);
      shell.appendChild(pill);

      function actualizarAviso() {
        const hayOverflow = wrap.scrollWidth > wrap.clientWidth + 1;
        const alFinal = wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 2;
        const mostrar = hayOverflow && !alFinal;
        pill.classList.toggle('is-visible', mostrar);
        fade.classList.toggle('is-visible', mostrar);
      }

      let isDown = false;
      let dragging = false;
      let startX = 0;
      let startScroll = 0;

      wrap.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest(SELECTOR_INTERACTIVO_SCROLL)) return;
        isDown = true;
        dragging = false;
        startX = e.pageX;
        startScroll = wrap.scrollLeft;
      });
      window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        const dx = e.pageX - startX;
        if (!dragging) {
          if (Math.abs(dx) <= UMBRAL_ARRASTRE) return;
          // El navegador ya empezó una selección de texto nativa (ej. el
          // usuario arrastra sobre un correo/folio para copiarlo) — se
          // respeta esa selección, no se convierte en scroll horizontal.
          const seleccion = window.getSelection();
          if (seleccion && seleccion.toString().length > 0) {
            isDown = false;
            return;
          }
          dragging = true;
          wrap.classList.add('is-dragging');
        }
        e.preventDefault();
        wrap.scrollLeft = startScroll - dx;
        actualizarAviso();
      });
      window.addEventListener('mouseup', () => {
        if (dragging) {
          // El mismo gesto que arrastró no debe además disparar el clic
          // de lo que haya bajo el cursor al soltar.
          wrap.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
        }
        isDown = false;
        dragging = false;
        wrap.classList.remove('is-dragging');
        actualizarAviso();
      });

      wrap.addEventListener('scroll', actualizarAviso);
      window.addEventListener('resize', actualizarAviso);
      actualizarAviso();
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // ---------- Homologación de filtros y búsqueda (ver PROJECT_STATE.md) ----------
  // 2 helpers compartidos por las 6 vistas con filtros (Ventas, Cuentas
  // por cobrar, Gastos, Inventarios, Lectura de reportes, Todo lo
  // eliminado) — evita reimplementar la misma lógica de "chip de filtro
  // activo" y "botón x dentro del buscador" 6 veces.

  // Limpia un campo de filtro y dispara los eventos que su propio
  // listener ya escucha (algunos usan 'input', otros 'change' según el
  // tipo de control) — así "quitar" un chip reusa el mismo camino de
  // recarga/re-render que ya tenía el campo, sin tener que saber si esa
  // vista filtra en cliente o vuelve a pedir datos al servidor.
  function limpiarCampoFiltro(el) {
    if (!el) return;
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Pinta la fila de chips "Filtros activos: X, Y, Z" a partir de una
  // lista de descriptores {etiqueta, valor, campos}. Solo se pintan los
  // que traen "valor" (los filtros en su estado por defecto no generan
  // chip). Cada chip trae su propio botón "×" que limpia el/los campos
  // asociados (un rango como "Fechas" limpia 2 campos a la vez).
  function renderFiltrosChips(contenedor, definiciones) {
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
        activos[idx].campos.forEach(limpiarCampoFiltro);
      });
    });
  }

  // Texto de una opción seleccionada de un <select> (o '' si no hay
  // selección) — para que el chip muestre "Pendiente" en vez de
  // "pendiente" (el value crudo).
  function textoOpcionSeleccionada(select) {
    if (!select || !select.value) return '';
    const opt = select.options[select.selectedIndex];
    return opt ? opt.text : select.value;
  }

  // Conecta el botón "×" dentro de un campo de búsqueda con ícono
  // (.filtro-busqueda): aparece solo con texto, y al hacer clic limpia
  // el campo y reaplica el filtro (mismo camino que limpiarCampoFiltro).
  function activarLimpiezaBusqueda(inputEl, btnEl) {
    if (!inputEl || !btnEl) return;
    const actualizar = () => { btnEl.hidden = inputEl.value.trim().length === 0; };
    inputEl.addEventListener('input', actualizar);
    btnEl.addEventListener('click', () => limpiarCampoFiltro(inputEl));
    actualizar();
  }
  activarLimpiezaBusqueda(els.ordenesFiltroConcepto, els.btnLimpiarOrdenesFiltroConcepto);
  activarLimpiezaBusqueda(els.cxcFiltroCliente, els.btnLimpiarCxcFiltroCliente);
  activarLimpiezaBusqueda(els.gastosBusqueda, els.btnLimpiarGastosBusqueda);
  activarLimpiezaBusqueda(els.invBusqueda, els.btnLimpiarInvBusqueda);
  activarLimpiezaBusqueda(els.filtroReporteRfc, els.btnLimpiarFiltroReporteRfc);
  activarLimpiezaBusqueda(els.ledgerFiltroRfc, els.btnLimpiarLedgerFiltroRfc);

  // ---------- Formato automático de campos de dinero (comas de miles) ----------
  // Los campos de dinero son <input type="text"> (no "number", que no
  // acepta comas) con auto-formato mientras se escribe — ej. "1000" se
  // convierte en "1,000" en cuanto se teclea. Puramente de presentación:
  // el valor numérico real siempre se obtiene despojando las comas antes
  // de usarlo (ver obtenerValorNumerico), nunca se hace ningún cálculo
  // sobre el texto formateado directamente.

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

  // Convierte el valor mostrado (con comas) de vuelta a un número real —
  // usar SIEMPRE esta función (nunca Number(input.value) directo) para
  // leer un campo de dinero formateado.
  function obtenerValorNumerico(input) {
    return Number(String(input.value || '').replace(/,/g, ''));
  }

  // Misma regla de comas de miles, pero para MOSTRAR un monto ya
  // calculado (no un <input> que se está escribiendo) — la vista previa
  // del total al registrar una orden, y la columna "Total" de la tabla
  // de órdenes registradas.
  function formatearMoneda(valor) {
    return Number(valor).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Cifra compacta ($12.4k / $1.2M) para las etiquetas dentro de las
  // gráficas de línea de Resumen financiero (Utilidad neta mensual /
  // Proyección de ventas) — el monto completo con 2 decimales no cabe
  // arriba de cada punto cuando hay hasta 6 meses en pantalla.
  function formatearMonedaCompacta(valor) {
    const signo = valor < 0 ? '-' : '';
    const abs = Math.abs(Number(valor));
    if (abs >= 1e6) return `${signo}$${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${signo}$${(abs / 1e3).toFixed(1)}k`;
    return `${signo}$${Math.round(abs)}`;
  }

  // Conecta el auto-formato a un <input>, preservando la posición del
  // cursor — sin esto, el cursor saltaría al final del campo en cada
  // tecla, haciendo imposible editar un número por en medio.
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

  // Muestra/limpia el error de un campo, buscando el elemento "error-<id>"
  // y agregando/quitando la clase "has-error" en su contenedor ".field"
  // (mismo patrón que ya usan app.js y login.js).
  function setFieldError(fieldId, message) {
    const errorEl = document.getElementById(`error-${fieldId}`);
    const fieldEl = errorEl ? errorEl.closest('.field') : null;
    if (errorEl) errorEl.textContent = message || '';
    if (fieldEl) fieldEl.classList.toggle('has-error', Boolean(message));
  }

  // Normaliza texto para comparaciones de búsqueda: minúsculas y sin acentos,
  // así "gonzalez" encuentra "González" y "Gonzalez" indistintamente.
  function normalizar(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function debounce(fn, delayMs) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delayMs);
    };
  }

  // ---------- Restricción de acceso por perfil ----------
  // "super" (la cuenta de respaldo "admin" y cualquier cuenta de
  // ADMIN_USERS) no aparece en este mapa a propósito — significa "sin
  // restricciones", ver aplicarRestriccionesPerfil() más abajo. Los
  // otros dos perfiles (creados desde "Crear usuario", con acceso al
  // panel vía Basic Auth) sí quedan acotados a un subconjunto de vistas,
  // y dentro de "Configuraciones", a un subconjunto de
  // tarjetas — el resto ni siquiera se muestra, no solo se deshabilita.
  let perfilActual = null;
  let usuarioSesionActual = null;
  // Campana de notificaciones (punto 337) — retención de tickets
  // "vistos" y de la instancia de sondeo en curso.
  const RETENCION_NOTIF_TICKETS_DIAS = 15;
  const RETENCION_NOTIF_TICKETS_MAX = 20;
  let notifPollingId = null;
  // IDs de ticket del sondeo ANTERIOR (solo en memoria, nunca
  // localStorage) — comparar contra esto es lo único que decide si
  // suena la campana; sin este valor (primera carga de la sesión) NUNCA
  // suena, para no sorprender al usuario apenas inicia sesión.
  let notifIdsTicketsSondeoAnterior = null;
  // Primeros pasos (Fase 2 UX, punto 191): null mientras no se sabe todavía
  // (recién entrando, antes de que cargarConfigGlobal resuelva).
  let datosFiscalesCompletos = null;
  // Si "Ventas" está deshabilitada globalmente (interruptor "Habilitar
  // Ventas" en Configuraciones) — combinado con la restricción de perfil
  // dentro de aplicarRestriccionesPerfil() para que ninguna de las dos
  // condiciones pueda pisar a la otra (ver aplicarVisibilidadOrdenesCompra).
  let ventasHabilitadaGlobalmente = true;
  // Homologación sitio base/tenant de "Contacto con clientes": con tenant
  // el correo es obligatorio (mismo dato que /control); sin tenant (sitio
  // base) es opcional. Se guarda al cargar la config para que el handler
  // de guardado sepa qué regla aplicar sin volver a pedirla.
  let contactoClienteTenantActivo = false;
  // D8/§0.6: Inventarios se activa/desactiva por tenant, default '0'
  // (inactivo) hasta que el administrador lo prenda desde "Usuarios" —
  // ver cargarConfigInventario() más abajo.
  let inventarioActivoGlobalmente = false;
  // Punto 186: "Solamente servicios" — negocio sin catálogo físico,
  // default '0' hasta que el administrador lo prenda (ver
  // cargarConfigInventario()/aplicarVisibilidadSoloServicios() más abajo).
  let soloServiciosGlobalmente = false;
  // Punto 187/188: último valor REAL guardado de "Solamente servicios" —
  // con Inventario inactivo el switch se muestra apagado (cosmético, no se
  // manda al backend) sin perder la preferencia; al reactivar Inventario se
  // restaura este valor tal cual estaba, sin resurrección sorpresa ni
  // pérdida silenciosa.
  let ultimoValorSoloServiciosGuardado = false;
  // Punto 244: switch "Mostrar Auditoría" en Configuraciones —
  // mismo patrón que ventasHabilitadaGlobalmente/inventarioActivoGlobalmente,
  // combinado dentro de aplicarRestriccionesPerfil() para que ni el perfil
  // ni este switch puedan pisar al otro.
  let auditoriaHabilitadaGlobalmente = true;
  // Punto 349-350-351 (Fase 5, ver stitch/gobierno-funcionalidades/
  // NOTAS.md): "funciones" que llega de GET /api/admin/login — qué trae
  // el PLAN del tenant (gobierno de funcionalidades desde /control), capa
  // DISTINTA de los interruptores de arriba (ventasHabilitadaGlobalmente,
  // inventarioActivoGlobalmente, auditoriaHabilitadaGlobalmente: esos son
  // el autoservicio del propio tenant). Las dos capas se combinan con AND
  // dentro de aplicarRestriccionesPerfil() — igual que el backend, que ya
  // las valida ambas por separado (requiereFeature() + requireInventarioActivo).
  // null = sin contexto multi-tenant (sitio base) o instalación vieja sin
  // X-Tenant-Slug — nunca oculta nada en ese caso, mismo criterio
  // "ausente nunca bloquea" que requiereFeature() en el backend.
  let tenantFuncionesPlan = null;

  // Único punto de lectura de un flag del plan — ausente/null siempre
  // "permite" (ver comentario de tenantFuncionesPlan arriba). Null-safe a
  // propósito: un flag que todavía no viaja desde el backend (versión
  // vieja desplegada a medias) nunca oculta nada por accidente.
  function planPermite(flag) {
    return !tenantFuncionesPlan || tenantFuncionesPlan[flag] !== false;
  }
  // Reportes (4 pestañas independientes, punto 350): la vista completa se
  // oculta solo si LAS 4 están apagadas — igual que
  // frontend/admin.js replica el criterio ya usado en
  // control/utils/planes.js:validarReglasDependencia.
  function reportesPlanVisible() {
    if (!tenantFuncionesPlan) return true;
    return ['reportesPorReporteHabilitado', 'reportesCortesHabilitado', 'reportesEliminadosHabilitado', 'reportesEstadoInventarioHabilitado']
      .some((campo) => tenantFuncionesPlan[campo]);
  }
  // Proveedores: automático, sin bandera propia — visible si Inventarios
  // O Gastos está activo (mismo criterio que proveedoresVisible() del
  // asistente de planes en control.js).
  function proveedoresPlanVisible() {
    if (!tenantFuncionesPlan) return true;
    return Boolean(tenantFuncionesPlan.inventariosHabilitado || tenantFuncionesPlan.gastosHabilitado);
  }
  // Interruptor maestro (Configuraciones → Notificaciones): si
  // está en `false`, el checkbox "No volver a mostrar" del popup de
  // tickets sin contador no se pinta y cualquier silenciado guardado
  // en localStorage se ignora (ver revisarTicketsPendientesSinContador
  // más abajo). No controla la visibilidad de ninguna vista del sidebar
  // (a diferencia de auditoriaHabilitadaGlobalmente) — no se combina en
  // aplicarRestriccionesPerfil().
  let notifTicketsPermiteOcultarGlobalmente = true;
  // Punto 339: reglas escalonadas de aviso de expiración de productos
  // (ver backend/utils/config.js) — cada elemento es "<número><unidad>"
  // con unidad 'd'/'s'/'m'. Se usa también para el texto dinámico del
  // item de campana "productos por vencer" (actualizarNotificaciones()).
  let reglasExpiracionProductos = ['30d'];

  const RESTRICCIONES_PERFIL = {
    administrador: {
      vistasPermitidas: ['inicio', 'resumen-financiero', 'ordenes', 'cxc', 'gastos', 'inventarios', 'usuarios', 'lectura-reportes', 'proveedores', 'mi-cuenta', 'auditoria', 'configuraciones'],
      tarjetasConfigPermitidas: ['global-config-card', 'reportes-config-card', 'ordenes-toggle-card', 'inv-toggle-card', 'auditoria-toggle-card', 'notif-toggle-card'],
    },
    fiscal: {
      vistasPermitidas: ['inicio', 'constancias', 'tickets', 'mi-cuenta', 'configuraciones'],
      tarjetasConfigPermitidas: ['admin-config-card', 'global-config-card'],
    },
    // Punto 190: perfil "Ventas" — solo Ventas/Cuentas por cobrar/Gastos,
    // sin entrar nunca a "Configuraciones" (cero tarjetas
    // permitidas, ni siquiera de solo lectura: el botón de esa vista
    // queda oculto por completo). El % de IVA/zona horaria que necesita
    // el formulario de "Registrar venta" se leen vía GET
    // /admin/config/global directamente (permitido en el backend para
    // este perfil), sin pasar por la UI de Configuraciones. "Mi Cuenta"
    // SÍ se permite (punto "Mi Cuenta", 2026-09-10): perfil/datos propios
    // y cambio de contraseña, no depende de Configuraciones.
    ventas: {
      vistasPermitidas: ['ordenes', 'cxc', 'gastos', 'mi-cuenta'],
      tarjetasConfigPermitidas: [],
    },
    // punto 321: perfil "Inventario" — un solo módulo, nada de negocio
    // fuera de eso. "Inicio" no es el resumen de tickets aquí: muestra
    // "Estado del inventario" (ver cargarInicioInventario()). "mi-cuenta"
    // sí se agregó (pedido explícito del usuario, corrige el alcance
    // inicial que la había dejado fuera).
    inventario: {
      vistasPermitidas: ['inicio', 'inventarios', 'mi-cuenta'],
      tarjetasConfigPermitidas: [],
    },
  };

  // Única fuente de verdad "nombre de vista -> botón del sidebar" —
  // antes vivía duplicada dentro de aplicarRestriccionesPerfil() Y en el
  // restore de F5 de init() más abajo; la segunda copia se quedó
  // desactualizada (le faltaban "configuraciones"/"proveedores") y por
  // eso refrescar en Proveedores mandaba de vuelta a Inicio en silencio
  // — bug real reportado por el usuario. Con un solo mapa, una vista
  // nueva que se agregue aquí queda cubierta en ambos lugares sin nada
  // más que tocar.
  // Mismo orden que el sidebar real (arquitectura de información revisada,
  // 2026-09-13: Inicio → Facturación → Ventas y gastos → Finanzas →
  // Catálogo → Administración → Cuenta) — el orden de este objeto decide
  // cuál vista gana como fallback cuando la activa se oculta (ver
  // aplicarRestriccionesPerfil más abajo), así que importa que coincida.
  function mapaNavPorVista() {
    return {
      inicio: els.btnVistaInicio,
      tickets: els.btnVistaTickets,
      constancias: els.btnVistaConstancias,
      ordenes: els.btnVistaOrdenes,
      cxc: els.btnVistaCxc,
      gastos: els.btnVistaGastos,
      'resumen-financiero': els.btnVistaResumenFinanciero,
      'lectura-reportes': els.btnVistaLecturaReportes,
      inventarios: els.btnVistaInventarios,
      proveedores: els.btnVistaProveedores,
      usuarios: els.btnVistaUsuarios,
      auditoria: els.btnVistaAuditoria,
      'mi-cuenta': els.btnVistaMiCuenta,
      configuraciones: els.btnVistaConfiguraciones,
    };
  }

  // Grupos del menú lateral — mismas fronteras que RESTRICCIONES_PERFIL
  // (Facturación≈fiscal, Ventas y gastos≈ventas), usadas solo para
  // ocultar/mostrar el título de cada grupo según si algún botón suyo
  // quedó visible (ver aplicarRestriccionesPerfil).
  const GRUPOS_SIDEBAR_NAV = {
    facturacion: ['tickets', 'constancias'],
    'ventas-gastos': ['ordenes', 'cxc', 'gastos'],
    finanzas: ['resumen-financiero', 'lectura-reportes'],
    catalogo: ['inventarios', 'proveedores'],
    administracion: ['usuarios', 'auditoria'],
    cuenta: ['mi-cuenta', 'configuraciones'],
  };

  // Punto 296: a qué grupo pertenece una vista — para saber cuál abrir
  // solo cuando esa vista se vuelve la activa (ver aplicarEstadoGruposSidebar).
  function grupoDeVistaSidebar(vista) {
    const entrada = Object.entries(GRUPOS_SIDEBAR_NAV).find(([, vistas]) => vistas.includes(vista));
    return entrada ? entrada[0] : null;
  }

  // Colapso de grupos del sidebar — se guarda por cuenta (mismo patrón
  // que claveOnboarding), pero SOLO la excepción manual: si el usuario
  // nunca tocó un grupo, su estado sigue siendo "abierto solo si es el
  // grupo de la vista activa", automático, sin nada que recordar.
  function claveGruposSidebar() {
    return `sidebar_grupos_v1_${TENANT_SLUG || 'base'}_${usuarioSesionActual || ''}`;
  }
  function leerOverridesGruposSidebar() {
    try {
      const crudo = localStorage.getItem(claveGruposSidebar());
      return crudo ? JSON.parse(crudo) : {};
    } catch (_) {
      return {};
    }
  }
  function guardarOverridesGruposSidebar(overrides) {
    try {
      localStorage.setItem(claveGruposSidebar(), JSON.stringify(overrides));
    } catch (_) {
      // localStorage lleno o bloqueado (modo privado): se pierde el
      // recuerdo entre sesiones, el colapso de esta sesión sigue normal.
    }
  }

  // Aplica qué grupos se ven abiertos/cerrados: el de la vista activa,
  // más cualquier grupo que el usuario haya abierto/cerrado a mano
  // (guardado en overrides, gana siempre sobre el automático).
  function aplicarEstadoGruposSidebar(vistaActiva) {
    const overrides = leerOverridesGruposSidebar();
    const grupoActivo = grupoDeVistaSidebar(vistaActiva);
    Object.keys(GRUPOS_SIDEBAR_NAV).forEach((grupo) => {
      const header = document.querySelector(`.admin-sidebar-group-header[data-grupo="${grupo}"]`);
      const body = document.querySelector(`.admin-sidebar-group-body[data-grupo="${grupo}"]`);
      if (!header || !body) return;
      const expandido = Object.prototype.hasOwnProperty.call(overrides, grupo) ? overrides[grupo] : grupo === grupoActivo;
      header.setAttribute('aria-expanded', String(expandido));
      body.dataset.colapsado = String(!expandido);
    });
  }

  document.querySelectorAll('.admin-sidebar-group-header').forEach((header) => {
    header.addEventListener('click', () => {
      const grupo = header.dataset.grupo;
      const nuevoExpandido = header.getAttribute('aria-expanded') !== 'true';
      const overrides = leerOverridesGruposSidebar();
      overrides[grupo] = nuevoExpandido;
      guardarOverridesGruposSidebar(overrides);
      header.setAttribute('aria-expanded', String(nuevoExpandido));
      const body = document.querySelector(`.admin-sidebar-group-body[data-grupo="${grupo}"]`);
      if (body) body.dataset.colapsado = String(!nuevoExpandido);
    });
  });

  // Riel colapsable del sidebar (punto 329) — 256px expandido / 72px
  // solo íconos, exclusivo de escritorio (>900px, ver admin.css). Estado
  // por cuenta en localStorage, mismo patrón que claveGruposSidebar. El
  // listener del botón se ata una sola vez aquí; el ESTADO inicial se
  // aplica desde showDashboard(), cuando ya se conoce la cuenta/tenant.
  function claveColapsoSidebar() {
    return `sidebar_colapso_v1_${TENANT_SLUG || 'base'}_${usuarioSesionActual || ''}`;
  }
  function aplicarEstadoColapsoSidebar(colapsado) {
    document.body.classList.toggle('sidebar-colapsado', colapsado);
    if (els.btnColapsarSidebar) {
      els.btnColapsarSidebar.setAttribute('aria-pressed', String(colapsado));
      els.btnColapsarSidebar.setAttribute('aria-label', colapsado ? 'Expandir menú lateral' : 'Colapsar menú lateral');
    }
    // Tooltip por ícono: reusa [data-tooltip]/inicializarTooltips ya
    // existente en todo el sitio, cero componente nuevo. Solo tiene
    // sentido cuando el texto está oculto (riel colapsado) — expandido,
    // el nombre ya se lee junto al ícono, un tooltip ahí sería
    // redundante.
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
      aplicarEstadoColapsoSidebar(colapsado);
      try {
        localStorage.setItem(claveColapsoSidebar(), colapsado ? '1' : '0');
      } catch (_) {
        // localStorage lleno o bloqueado: el colapso de esta sesión
        // sigue funcionando, solo no se recuerda para la próxima.
      }
    });
  }

  function aplicarRestriccionesPerfil() {
    const restriccion = RESTRICCIONES_PERFIL[perfilActual];
    // Sin entrada en el mapa (perfil "super", o cualquier valor que no
    // se reconozca) equivale a "sin restricciones" — a propósito, para
    // que un perfil nuevo que se agregue en el futuro sin actualizar
    // este mapa no quede accidentalmente bloqueado de TODO el panel.
    const sinRestricciones = !restriccion;

    const navPorVista = mapaNavPorVista();
    Object.entries(navPorVista).forEach(([vista, boton]) => {
      const permitidaPorPerfil = sinRestricciones || restriccion.vistasPermitidas.includes(vista);
      // D8/§0.6: "Inventarios" además depende del switch por tenant —
      // igual patrón que "Ventas" con ventasHabilitadaGlobalmente, ver
      // cargarConfigInventario()/aplicarVisibilidadInventarios() más abajo.
      // Punto 349-350-351 (Fase 5): cada vista además se cruza con lo que
      // el PLAN del tenant trae (tenantFuncionesPlan) — capa aparte del
      // autoservicio de arriba (ventasHabilitadaGlobalmente/
      // inventarioActivoGlobalmente/auditoriaHabilitadaGlobalmente), con
      // AND entre ambas, mismo criterio que el backend (requiereFeature()
      // + requireInventarioActivo encadenados en la misma ruta).
      const permitidaPorConfig =
        (vista !== 'tickets' || planPermite('facturacionHabilitada')) &&
        (vista !== 'constancias' || planPermite('facturacionHabilitada')) &&
        (vista !== 'ordenes' || (ventasHabilitadaGlobalmente && planPermite('ventasHabilitado'))) &&
        (vista !== 'cxc' || planPermite('cxcHabilitado')) &&
        (vista !== 'gastos' || planPermite('gastosHabilitado')) &&
        (vista !== 'resumen-financiero' || planPermite('resumenFinancieroHabilitado')) &&
        (vista !== 'lectura-reportes' || reportesPlanVisible()) &&
        (vista !== 'inventarios' || (inventarioActivoGlobalmente && planPermite('inventariosHabilitado'))) &&
        (vista !== 'proveedores' || proveedoresPlanVisible()) &&
        (vista !== 'auditoria' || (auditoriaHabilitadaGlobalmente && planPermite('auditoriaHabilitado')));
      const permitida = permitidaPorPerfil && permitidaPorConfig;
      boton.hidden = !permitida;
      // Mismo permiso, botón espejo en el launcher de íconos del menú
      // móvil (#admin-menu-movil) — un solo lugar decide quién ve qué,
      // no una segunda lista de restricciones que mantener sincronizada.
      const botonMovil = document.querySelector(`.admin-menu-movil-btn[data-vista="${vista}"]`);
      if (botonMovil) botonMovil.hidden = !permitida;
    });

    // Título de cada grupo del sidebar: se oculta solo si NINGÚN botón de
    // ese grupo quedó visible para este perfil — nunca deja un
    // encabezado sin nada debajo.
    Object.entries(GRUPOS_SIDEBAR_NAV).forEach(([grupo, vistas]) => {
      const encabezado = document.querySelector(`.admin-sidebar-group-header[data-grupo="${grupo}"]`);
      const cuerpo = document.querySelector(`.admin-sidebar-group-body[data-grupo="${grupo}"]`);
      const algunaVisible = vistas.some((v) => navPorVista[v] && !navPorVista[v].hidden);
      if (encabezado) encabezado.hidden = !algunaVisible;
      if (cuerpo) cuerpo.hidden = !algunaVisible;
    });

    // Inicio para el perfil "administrador" (2026-09-04): ve el resumen de
    // tickets (dona/estadísticas), pero NO puede actuar sobre ellos — los
    // endpoints de gestión de tickets (aceptar, subir factura, etc.) siguen
    // siendo exclusivos de "fiscal" en el backend. "Ver todas" llevaría a
    // la vista Tickets completa, que este perfil tampoco tiene — se oculta
    // en vez de dejar un botón que no lleva a ningún lado.
    if (els.btnInicioVerTodas) els.btnInicioVerTodas.hidden = perfilActual === 'administrador';

    // Las 6 tarjetas de "Configuraciones" ("Ventas" e
    // "Inventarios" se movieron aquí desde "Usuarios").
    // Punto 349-350-351 (Fase 5): cada tarjeta además se cruza con el plan
    // del tenant — "smtp-config-card" y "notif-toggle-card" se quedan sin
    // gate propio (core: SMTP siempre hace falta para recuperar
    // contraseña; Notificaciones trae ADEMÁS secciones con su propio gate
    // más fino, ver más abajo).
    const PLAN_GATE_TARJETA_CONFIG = {
      'admin-config-card': () => planPermite('facturacionHabilitada'),
      'global-config-card': () => planPermite('facturacionHabilitada'),
      'reportes-config-card': () => planPermite('resumenFinancieroHabilitado') || reportesPlanVisible(),
      'ordenes-toggle-card': () => planPermite('ventasHabilitado'),
      'inv-toggle-card': () => planPermite('inventariosHabilitado'),
      'auditoria-toggle-card': () => planPermite('auditoriaHabilitado'),
    };
    ['admin-config-card', 'global-config-card', 'smtp-config-card', 'reportes-config-card', 'notif-toggle-card', 'ordenes-toggle-card', 'inv-toggle-card', 'auditoria-toggle-card'].forEach((idTarjeta) => {
      const tarjeta = document.getElementById(idTarjeta);
      if (!tarjeta) return;
      const permitidaPorPerfilTarjeta = sinRestricciones || (restriccion.tarjetasConfigPermitidas || []).includes(idTarjeta);
      const gatePlan = PLAN_GATE_TARJETA_CONFIG[idTarjeta];
      const permitidaPorPlanTarjeta = !gatePlan || gatePlan();
      tarjeta.hidden = !(permitidaPorPerfilTarjeta && permitidaPorPlanTarjeta);
    });

    // Dentro de "Notificaciones" (notif-toggle-card, sin gate propio —
    // arriba): dos secciones con dependencia más fina que la tarjeta
    // completa. El ejemplo que originó esta fase: sin Inventarios, el
    // aviso de expiración de productos no tiene nada que avisar.
    const bloqueAvisoExpiracion = document.querySelector('.regla-exp-config');
    if (bloqueAvisoExpiracion) bloqueAvisoExpiracion.hidden = !planPermite('inventariosHabilitado');
    const bloqueTicketsSinContador = document.querySelector('.notif-tickets-sin-contador-config');
    if (bloqueTicketsSinContador) bloqueTicketsSinContador.hidden = !planPermite('facturacionHabilitada');

    // Tabla de "Perfiles y roles de acceso": pedido explícito del
    // usuario — visible para "administrador" y "super" (ADMIN_USERS,
    // sin restricciones) — antes dependía de la cuenta de respaldo
    // "admin", eliminada.
    if (els.btnPerfilesAccesoAbrir) els.btnPerfilesAccesoAbrir.hidden = perfilActual !== 'administrador' && perfilActual !== 'super';

    // Si el botón de la vista actualmente activa (por defecto,
    // "Constancias" — ver el HTML) quedó oculto por la restricción de
    // este perfil, se navega a la primera vista que sí tenga permitida,
    // en vez de dejarlo viendo una pantalla en blanco o a la que ya no
    // puede volver por el menú.
    const botonActivo = Object.values(navPorVista).find((b) => b.classList.contains('is-active'));
    if (botonActivo && botonActivo.hidden) {
      const primeraVistaPermitida = Object.keys(navPorVista).find((v) => !navPorVista[v].hidden);
      if (primeraVistaPermitida) cambiarVistaPrincipal(primeraVistaPermitida);
    }
  }

  function showDashboard(username, perfil, funciones) {
    usuarioSesionActual = username;
    perfilActual = perfil;
    // Punto 349-350-351 (Fase 5): `funciones` llega de GET
    // /api/admin/login — undefined en cualquier llamada vieja a
    // showDashboard que todavía no lo pase (ninguna debería quedar, pero
    // `undefined` cae a `null` aquí = "sin restricciones", nunca al
    // revés, el fallo seguro es mostrar de más, no ocultar de más).
    tenantFuncionesPlan = funciones || null;
    els.loginScreen.hidden = true;
    els.dashboard.hidden = false;
    els.adminUserLabel.textContent = `Sesión: ${username}`;
    anclarHistorialMovil();
    aplicarRestriccionesPerfil();
    // "Inicio" es siempre la vista activa en este punto (la restauración
    // de una vista guardada, si aplica, pasa por cambiarVistaPrincipal()
    // más abajo en init() — que ya vuelve a llamar a esto con la vista
    // real). Cubre el caso de una cuenta que sí abrió un grupo a mano:
    // ese override se respeta desde el primer render, no hasta navegar.
    aplicarEstadoGruposSidebar('inicio');
    let colapsoSidebarGuardado = false;
    try {
      colapsoSidebarGuardado = localStorage.getItem(claveColapsoSidebar()) === '1';
    } catch (_) {
      // sin acceso a localStorage: arranca expandido, comportamiento
      // de siempre.
    }
    aplicarEstadoColapsoSidebar(colapsoSidebarGuardado);
    controladorColumnasConstancias.aplicarColumnasVisibles(controladorColumnasConstancias.cargarColumnasGuardadas());
    controladorColumnasConstancias.aplicarAnchosGuardados();
    controladorColumnasOrdenes.aplicarColumnasVisibles(controladorColumnasOrdenes.cargarColumnasGuardadas());
    controladorColumnasOrdenes.aplicarAnchosGuardados();
    controladorColumnasGastos.aplicarColumnasVisibles(controladorColumnasGastos.cargarColumnasGuardadas());
    controladorColumnasGastos.aplicarAnchosGuardados();
    controladorColumnasTickets.aplicarColumnasVisibles(controladorColumnasTickets.cargarColumnasGuardadas());
    controladorColumnasTickets.aplicarAnchosGuardados();
    controladorColumnasCxc.aplicarColumnasVisibles(controladorColumnasCxc.cargarColumnasGuardadas());
    controladorColumnasCxc.aplicarAnchosGuardados();
    controladorColumnasUsuarios.aplicarColumnasVisibles(controladorColumnasUsuarios.cargarColumnasGuardadas());
    controladorColumnasUsuarios.aplicarAnchosGuardados();
    controladorColumnasInventarios.aplicarColumnasVisibles(controladorColumnasInventarios.cargarColumnasGuardadas());
    controladorColumnasInventarios.aplicarAnchosGuardados();
    // "Configuraciones fiscales" (cargarConfigGlobal) la puede ver
    // cualquier perfil que entra al panel (super/administrador/fiscal),
    // así que se precarga siempre. Los otros tres son específicamente
    // del área "fiscal" en el backend (Campos obligatorios, catálogo de
    // Uso de CFDI, y notificación de tickets pendientes) — precargarlos
    // sin condición le pediría al backend algo que un perfil
    // "administrador" ya no tiene permitido, devolviendo un 403 de
    // fondo sin que la persona haga nada para provocarlo. Se limitan a
    // los perfiles que sí tienen esa área (o "super", sin restricción).
    // Punto en curso: estas 2 llamadas son del área fiscal (Campos
    // obligatorios, catálogo de Uso de CFDI) — sin Facturación activa en
    // el plan, el backend las bloquea igual (requiereFeature), así que
    // precargarlas sin ese check también le pide al backend algo que
    // 404 de fondo sin que la persona haga nada para provocarlo.
    const puedeVerAreaFiscal = perfilActual !== 'administrador' && planPermite('facturacionHabilitada');
    cargarConfigGlobal({ verificarFiscalFaltante: true });
    if (puedeVerAreaFiscal) {
      cargarConfigCampos();
      cargarInfoUsoCfdi();
    }
    // El popup emergente de "tickets sin correo de contador" solo tiene
    // sentido para el perfil "fiscal" (quien de verdad da seguimiento
    // ticket por ticket). Administrador/super ya lo ven reflejado en la
    // campana de notificaciones (actualizarNotificaciones/ticketsAplican
    // más abajo) — mostrarles además el modal era ruido duplicado.
    // Punto en curso: sin Facturación activa en el plan, este popup
    // consultaba igual /admin/tickets/pendientes-sin-contador (404 por
    // requiereFeature) sin mostrar nada útil — se le agrega el mismo
    // planPermite() que ya usa la campana.
    if (perfilActual === 'fiscal' && planPermite('facturacionHabilitada')) {
      revisarTicketsPendientesSinContador();
    }
    // D7: fiscal no tiene NINGÚN acceso a Inventarios — evita pedirle al
    // backend algo que le respondería 403 de fondo sin que la persona
    // hiciera nada para provocarlo (mismo criterio que puedeVerAreaFiscal
    // arriba, pero en sentido inverso).
    if (perfilActual !== 'fiscal') cargarConfigInventario();
    // Campana de notificaciones (punto 337) — primera carga sin sonido
    // (sondeo:false, ver actualizarNotificaciones), después sondeo cada
    // 60s. Se corrige sola en cuanto cargarConfigInventario() resuelva
    // (ver aplicarVisibilidadInventarios), así que no hace falta
    // esperarla aquí.
    actualizarNotificaciones();
    iniciarSondeoNotificaciones();
    cargarSucursalesHermanas();
    // Primeros pasos (Fase 2 UX): la vista "Inicio" de fiscal no siempre
    // dispara cambiarVistaPrincipal() al iniciar sesión (ya es la vista
    // activa por defecto, sin necesidad de redirigir) — se llama aquí
    // también para no depender de eso. verificarDatosFiscalesFaltantes()
    // la vuelve a llamar en cuanto ese dato esté listo.
    renderOnboardingChecklist();
  }

  // §58: switcher de sucursales — solo se muestra si este tenant pertenece
  // a un grupo de sucursales asociadas (mismo login en todas). Silencioso
  // si falla o no aplica: nunca bloquea el resto del panel por esto.
  async function cargarSucursalesHermanas() {
    if (!els.sucursalesSwitcher) return;
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/sucursales-hermanas`, { headers: { Authorization: authHeader } });
      if (!res.ok) return;
      const data = await res.json();
      const sucursales = data.sucursales || [];
      if (sucursales.length <= 1) {
        els.sucursalesSwitcher.hidden = true;
        return;
      }
      els.sucursalesSwitcherLista.innerHTML = sucursales
        .map((s) =>
          s.actual
            ? `<span class="admin-sucursal-link es-actual" aria-current="page">${escapeHtml(s.nombre_empresa)}</span>`
            : `<a class="admin-sucursal-link" href="/${encodeURIComponent(s.slug)}/admin">${escapeHtml(s.nombre_empresa)}</a>`
        )
        .join('');
      els.sucursalesSwitcher.hidden = false;
    } catch (err) {
      // Silencioso a propósito — el switcher es una comodidad, no algo
      // crítico para poder usar el panel.
    }
  }

  function showLogin() {
    els.dashboard.hidden = true;
    els.loginScreen.hidden = false;
    // Siempre se regresa al formulario normal (nunca a "recuperar" ni al
    // cambio de contraseña obligatorio de un intento anterior) — cubre
    // logout, sesión inválida, y cualquier otro camino que traiga de
    // vuelta a esta pantalla.
    els.adminLoginNormal.hidden = false;
    els.adminRecuperarPanel.hidden = true;
    els.adminForzarPasswordPanel.hidden = true;
  }

  // ---------- Mostrar/ocultar contraseña ----------

  els.btnTogglePass.addEventListener('click', () => {
    const isPassword = els.inputPass.type === 'password';
    els.inputPass.type = isPassword ? 'text' : 'password';
    els.btnTogglePass.setAttribute('aria-pressed', String(isPassword));
    els.btnTogglePass.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
    els.btnTogglePass.classList.toggle('is-visible', isPassword);
  });

  // ---------- Login ----------

  function setLoginLoading(isLoading) {
    els.btnLogin.disabled = isLoading;
    els.btnLogin.setAttribute('aria-busy', String(isLoading));
    els.btnLoginLabel.textContent = isLoading ? 'Entrando…' : 'Entrar';
  }

  // Cola común de "credenciales ya verificadas, entra al panel" — la usa
  // tanto el login normal como el flujo de cambio de contraseña
  // obligatorio (punto 321 addendum), que primero cambia la contraseña y
  // LUEGO entra con la nueva.
  async function entrarAlPanel(usuario, contrasena, perfil, funciones) {
    setSession(usuario, contrasena);
    // Login nuevo: siempre "Inicio", sin importar qué vista haya quedado
    // guardada de una sesión anterior en esta misma pestaña — la
    // restauración de vista (ver init()) es solo para refrescar una
    // sesión que ya estaba activa, no para un login recién hecho.
    guardarVistaActual('inicio');
    showDashboard(usuario, perfil, funciones);
    // "Inicio" (la vista que se ve por defecto al iniciar sesión) usa
    // datos de tickets, que un perfil "administrador" no tiene
    // permitido ver. aplicarRestriccionesPerfil() (dentro de
    // showDashboard) ya redirige a ese perfil a una vista que sí
    // puede ver, así que tampoco haría falta el dato de Inicio.
    if (perfil !== 'administrador') {
      await cargarInicio();
    }
  }

  // Credenciales del intento de login en curso — solo viven en memoria
  // mientras se resuelve un cambio de contraseña obligatorio (punto 321
  // addendum); se limpian apenas se entra al panel o se cancela.
  let loginPendiente = null;

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
      const res = await fetch(`${API_BASE}/admin/login`, {
        headers: { Authorization: `Basic ${encoded}` },
      });

      if (res.status === 401) {
        els.loginError.textContent = 'Usuario o contraseña incorrectos.';
        return;
      }
      if (!res.ok) {
        // 403 "cuenta suspendida" (ver PUT /admin/usuarios/:id/estado) trae
        // su propio mensaje específico — se muestra tal cual en vez del
        // genérico, igual que cualquier otro error con `error` real.
        const dataError = await res.json().catch(() => ({}));
        els.loginError.textContent = dataError.error || 'No se pudo iniciar sesión. Intenta de nuevo.';
        return;
      }

      const data = await res.json();

      // Bug real (punto 321 addendum): "Forzar cambio de contraseña" al
      // crear la cuenta nunca se cumplía para /admin — se intercepta el
      // login aquí, ANTES de entrar al panel, con la contraseña ya
      // verificada disponible en memoria (no hace falta pedirla otra vez).
      if (data.debeCambiarPassword) {
        loginPendiente = { usuario: data.usuario || usuario, contrasena, perfil: data.perfil, funciones: data.funciones };
        els.adminForzarPasswordError.textContent = '';
        els.adminForzarPasswordNueva.value = '';
        actualizarReglasVisuales('', 'admin-forzar-password-reglas');
        els.adminLoginNormal.hidden = true;
        els.adminForzarPasswordPanel.hidden = false;
        return;
      }

      await entrarAlPanel(data.usuario || usuario, contrasena, data.perfil, data.funciones);
    } catch (err) {
      els.loginError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setLoginLoading(false);
    }
  });

  // ---------- Cambio de contraseña obligatorio al login (punto 321 addendum) ----------
  els.btnToggleForzarPassword.addEventListener('click', () => {
    const isPassword = els.adminForzarPasswordNueva.type === 'password';
    els.adminForzarPasswordNueva.type = isPassword ? 'text' : 'password';
    els.btnToggleForzarPassword.setAttribute('aria-pressed', String(isPassword));
    els.btnToggleForzarPassword.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
    els.btnToggleForzarPassword.classList.toggle('is-visible', isPassword);
  });
  els.adminForzarPasswordNueva.addEventListener('input', () => {
    actualizarReglasVisuales(els.adminForzarPasswordNueva.value, 'admin-forzar-password-reglas');
  });

  function setAdminForzarPasswordLoading(cargando) {
    els.btnAdminForzarPassword.disabled = cargando;
    els.btnAdminForzarPassword.setAttribute('aria-busy', String(cargando));
    els.btnAdminForzarPasswordLabel.textContent = cargando ? 'Guardando…' : 'Guardar y continuar';
  }

  els.formAdminForzarPassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.adminForzarPasswordError.textContent = '';
    if (!loginPendiente) {
      // No debería poder llegar aquí sin un login previo — defensivo.
      els.adminForzarPasswordPanel.hidden = true;
      els.adminLoginNormal.hidden = false;
      return;
    }

    const passwordNueva = els.adminForzarPasswordNueva.value;
    const reglas = evaluarReglasPassword(passwordNueva);
    if (!Object.values(reglas).every(Boolean)) {
      els.adminForzarPasswordError.textContent = 'La contraseña no cumple con los requisitos de arriba.';
      return;
    }

    setAdminForzarPasswordLoading(true);
    try {
      const encoded = btoa(unescape(encodeURIComponent(`${loginPendiente.usuario}:${loginPendiente.contrasena}`)));
      const res = await fetch(`${API_BASE}/admin/mi-cuenta/password`, {
        method: 'PUT',
        headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_actual: loginPendiente.contrasena, password_nueva: passwordNueva }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.adminForzarPasswordError.textContent = data.error || 'No se pudo actualizar la contraseña.';
        return;
      }
      const { usuario, perfil, funciones } = loginPendiente;
      loginPendiente = null;
      els.adminForzarPasswordPanel.hidden = true;
      els.adminLoginNormal.hidden = false;
      await entrarAlPanel(usuario, passwordNueva, perfil, funciones);
    } catch (err) {
      els.adminForzarPasswordError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setAdminForzarPasswordLoading(false);
    }
  });

  // ---------- Recuperar acceso (solo cuentas creadas en "Usuarios") ----------
  els.btnAdminIrRecuperar.addEventListener('click', () => {
    els.adminRecuperarErrorGeneral.textContent = '';
    els.adminRecuperarConfirmacion.hidden = true;
    els.formAdminRecuperar.hidden = false;
    els.formAdminRecuperar.reset();
    els.adminLoginNormal.hidden = true;
    els.adminRecuperarPanel.hidden = false;
    els.adminRecuperarIdentificador.focus();
  });
  els.btnAdminRecuperarVolver.addEventListener('click', () => {
    els.adminRecuperarPanel.hidden = true;
    els.adminLoginNormal.hidden = false;
  });

  function setAdminRecuperarLoading(cargando) {
    els.btnAdminRecuperar.disabled = cargando;
    els.btnAdminRecuperar.setAttribute('aria-busy', String(cargando));
    els.btnAdminRecuperarLabel.textContent = cargando ? 'Enviando…' : 'Enviar enlace de recuperación';
  }

  els.formAdminRecuperar.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.adminRecuperarErrorGeneral.textContent = '';

    const identificador = els.adminRecuperarIdentificador.value.trim();
    if (!identificador) {
      els.adminRecuperarErrorGeneral.textContent = 'Escribe tu correo o tu usuario.';
      return;
    }

    setAdminRecuperarLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/recuperar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.adminRecuperarErrorGeneral.textContent = data.error || 'No se pudo procesar la solicitud.';
        return;
      }
      els.formAdminRecuperar.hidden = true;
      els.adminRecuperarConfirmacion.hidden = false;
    } catch (err) {
      els.adminRecuperarErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setAdminRecuperarLoading(false);
    }
  });

  els.btnLogout.addEventListener('click', async () => {
    // La cola offline (Ventas/Gastos pendientes de sincronizar, ver
    // PROJECT_STATE.md punto 132) se limpia al cerrar sesión — si hay
    // algo sin sincronizar todavía, se avisa antes en vez de perderlo en
    // silencio.
    if (window.OfflineQueue) {
      const [pendOrdenes, pendGastos] = await Promise.all([
        OfflineQueue.listarPendientes('ordenes').catch(() => []),
        OfflineQueue.listarPendientes('gastos').catch(() => []),
      ]);
      const totalPendientes = pendOrdenes.length + pendGastos.length;
      if (totalPendientes > 0) {
        const confirmado = window.confirm(
          `Tienes ${totalPendientes} registro(s) de Ventas/Gastos sin sincronizar todavía. Si cierras sesión se pierden. ¿Cerrar sesión de todas formas?`
        );
        if (!confirmado) return;
      }
      await OfflineQueue.limpiarTodo();
    }
    clearSession();
    els.inputPass.value = '';
    els.inputPass.type = 'password';
    els.btnTogglePass.setAttribute('aria-pressed', 'false');
    els.btnTogglePass.setAttribute('aria-label', 'Mostrar contraseña');
    els.btnTogglePass.classList.remove('is-visible');
    els.searchInput.value = '';
    els.btnClearSearch.hidden = true;
    els.btnToggleConfig.setAttribute('aria-expanded', 'false');
    els.adminConfigBody.hidden = true;
    els.btnToggleGlobalConfig.setAttribute('aria-expanded', 'false');
    els.globalConfigBody.hidden = true;
    els.globalConfigError.textContent = '';
    els.smtpConfigBody.hidden = true;
    els.smtpConfigError.textContent = '';
    els.smtpPruebaError.textContent = '';
    smtpAccSeccionAbierta = 'conexion';
    els.btnToggleRetencion.setAttribute('aria-expanded', 'false');
    els.retencionConfigBody.hidden = true;
    els.retencionError.textContent = '';
    els.notifTicketsOverlay.hidden = true;
    els.crearUsuarioOverlay.hidden = true;
    els.editarUsuarioOverlay.hidden = true;
    els.usuariosFiltroPerfil.value = '';
    limpiarFormularioOrden();
    els.ordenesError.textContent = '';
    els.btnColumns.setAttribute('aria-expanded', 'false');
    els.columnTogglePanel.hidden = true;
    els.confirmModalOverlay.hidden = true;
    cerrarPreview();
    cerrarTicketModal();
    cerrarPasswordModal();
    // Primeros pasos (Fase 2 UX): si otra cuenta inicia sesión en esta
    // misma pestaña, debe poder ver su propio checklist/tour desde cero
    // (cada uno tiene su propia clave en localStorage, pero el "ya se
    // disparó" del tour y el dato fiscal viven en memoria de esta pestaña).
    datosFiscalesCompletos = null;
    tourDisparadoEnEstaSesion = false;
    cerrarTourBienvenida();
    cambiarVistaPrincipal('inicio');
    state.vista = 'activos';
    els.btnVerActivos.classList.add('is-active');
    els.btnVerActivos.setAttribute('aria-selected', 'true');
    els.btnVerPapelera.classList.remove('is-active', 'is-danger-context');
    els.btnVerPapelera.setAttribute('aria-selected', 'false');
    els.tablaTitulo.textContent = 'Registros recibidos';
    state.vistaTickets = 'activos';
    els.btnVerTicketsActivos.classList.add('is-active');
    els.btnVerTicketsActivos.setAttribute('aria-selected', 'true');
    els.btnVerTicketsPapelera.classList.remove('is-active', 'is-danger-context');
    els.btnVerTicketsPapelera.setAttribute('aria-selected', 'false');
    els.ticketsTablaTitulo.textContent = 'Tickets para facturar';
    state.registros = [];
    showLogin();
  });

  els.btnRefresh.addEventListener('click', () => cargarRegistros());

  // ---------- Configuración de campos obligatorios ----------

  els.btnToggleConfig.addEventListener('click', () => {
    const abierto = els.btnToggleConfig.getAttribute('aria-expanded') === 'true';
    els.btnToggleConfig.setAttribute('aria-expanded', String(!abierto));
    els.adminConfigBody.hidden = abierto;
  });

  async function cargarConfigCampos() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/config/campos-obligatorios`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const config = await res.json();
      CAMPOS_CONFIGURABLES.forEach((campo) => {
        const checkbox = document.getElementById(`config-${campo}`);
        if (checkbox) checkbox.checked = Boolean(config[campo]);
      });
    } catch (err) {
      // Si falla, los checkboxes simplemente quedan sin marcar; el usuario
      // puede reintentar reabriendo el panel o actualizando la página.
    }
  }

  function setGuardarConfigLoading(isLoading) {
    els.btnGuardarConfig.disabled = isLoading;
    els.btnGuardarConfig.setAttribute('aria-busy', String(isLoading));
    els.btnGuardarConfigLabel.textContent = isLoading ? 'Guardando…' : 'Guardar cambios';
  }

  // ---------- Catálogo de Uso de CFDI ----------

  function formatearInfoCatalogo(total, actualizadoEn, origen) {
    const partes = [`${total} usos cargados`];
    if (actualizadoEn) {
      partes.push(`sincronizado el ${formatFecha(actualizadoEn)}`);
    } else {
      partes.push('usando el catálogo incluido por defecto (nunca se ha sincronizado)');
    }
    return partes.join(' · ');
  }

  async function cargarInfoUsoCfdi() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/catalogos/uso-cfdi`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        els.usoCfdiInfo.textContent = 'No se pudo cargar la información del catálogo.';
        return;
      }
      const data = await res.json();
      const total = Array.isArray(data.usos) ? data.usos.length : 0;
      els.usoCfdiInfo.textContent = formatearInfoCatalogo(total, data.actualizadoEn, data.origen);
    } catch (err) {
      els.usoCfdiInfo.textContent = 'No se pudo cargar la información del catálogo.';
    }
  }

  function setActualizarCatalogoLoading(isLoading) {
    els.btnActualizarUsoCfdi.disabled = isLoading;
    els.btnActualizarUsoCfdi.setAttribute('aria-busy', String(isLoading));
    els.btnActualizarUsoCfdiLabel.textContent = isLoading ? 'Actualizando…' : 'Actualizar catálogo SAT';
  }

  els.btnActualizarUsoCfdi.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    setActualizarCatalogoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/catalogos/uso-cfdi/actualizar`, {
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
        showToast(data.error || 'No se pudo actualizar el catálogo.', true);
        return;
      }
      showToast(data.mensaje || 'Catálogo actualizado.');
      const total = Array.isArray(data.usos) ? data.usos.length : 0;
      els.usoCfdiInfo.textContent = formatearInfoCatalogo(total, data.actualizadoEn, data.origen);
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    } finally {
      setActualizarCatalogoLoading(false);
    }
  });

  // ---------- Clave de Producto o Servicio (SAT) — combobox con búsqueda ----------
  // El input visible (#config-clave-sat-buscador) es solo de búsqueda/lectura
  // amigable; el valor real que se guarda vive en el input oculto
  // #config-clave-sat (mismo id de siempre, para no tocar la validación ni
  // el PUT de abajo). Escribir 8 dígitos exactos siempre funciona como
  // captura manual (alternativa "3" ya aprobada), aunque no haya match en
  // el catálogo local — el buscador es una ayuda, no un candado.

  let claveSatSugerenciasActuales = [];
  let claveSatIndiceActivo = -1;
  let claveSatTimeoutBusqueda = null;
  let claveSatControladorBusqueda = null;

  function formatearInfoCatalogoClaveSat(info) {
    const partes = [`${info.total} claves cargadas`];
    if (info.esEjemplo) {
      partes.push('catálogo de ejemplo — usa "Actualizar catálogo SAT" para traer el real');
    } else if (info.actualizadoEn) {
      partes.push(`sincronizado el ${formatFecha(info.actualizadoEn)}`);
    }
    return partes.join(' · ');
  }

  async function cargarInfoCatalogoClaveSat() {
    const authHeader = getAuthHeader();
    if (!authHeader || !els.claveSatCatalogoInfo) return;
    try {
      const res = await fetch(`${API_BASE}/admin/catalogo-clave-sat/info`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        els.claveSatCatalogoInfo.textContent = 'No se pudo cargar la información del catálogo.';
        return;
      }
      const info = await res.json();
      els.claveSatCatalogoInfo.textContent = formatearInfoCatalogoClaveSat(info);
    } catch (err) {
      els.claveSatCatalogoInfo.textContent = 'No se pudo cargar la información del catálogo.';
    }
  }

  function setActualizarClaveSatLoading(isLoading) {
    if (!els.btnActualizarClaveSat) return;
    els.btnActualizarClaveSat.disabled = isLoading;
    els.btnActualizarClaveSat.setAttribute('aria-busy', String(isLoading));
    els.btnActualizarClaveSatLabel.textContent = isLoading ? 'Actualizando…' : 'Actualizar catálogo SAT';
  }

  if (els.btnActualizarClaveSat) {
    els.btnActualizarClaveSat.addEventListener('click', async () => {
      const authHeader = getAuthHeader();
      if (!authHeader) {
        showLogin();
        return;
      }
      setActualizarClaveSatLoading(true);
      try {
        const res = await fetch(`${API_BASE}/admin/catalogo-clave-sat/actualizar`, {
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
          showToast(data.error || 'No se pudo actualizar el catálogo.', true);
          return;
        }
        showToast(data.mensaje || 'Catálogo actualizado.');
        els.claveSatCatalogoInfo.textContent = formatearInfoCatalogoClaveSat(data);
      } catch (err) {
        showToast('No se pudo conectar con el servidor.', true);
      } finally {
        setActualizarClaveSatLoading(false);
      }
    });
  }

  function ocultarSugerenciasClaveSat() {
    claveSatSugerenciasActuales = [];
    claveSatIndiceActivo = -1;
    if (!els.configClaveSatSugerencias) return;
    els.configClaveSatSugerencias.hidden = true;
    els.configClaveSatSugerencias.innerHTML = '';
    els.configClaveSatBuscador.setAttribute('aria-expanded', 'false');
    els.configClaveSatBuscador.removeAttribute('aria-activedescendant');
  }

  function marcarSugerenciaActivaClaveSat() {
    if (!els.configClaveSatSugerencias) return;
    els.configClaveSatSugerencias.querySelectorAll('.clave-sat-sugerencia').forEach((btn, i) => {
      const activa = i === claveSatIndiceActivo;
      btn.classList.toggle('is-activa', activa);
      if (activa) {
        btn.id = 'clave-sat-sugerencia-activa';
        btn.scrollIntoView({ block: 'nearest' });
        els.configClaveSatBuscador.setAttribute('aria-activedescendant', btn.id);
      }
    });
  }

  function seleccionarClaveSat(item) {
    els.configClaveSat.value = item.clave;
    els.configClaveSatBuscador.value = `${item.clave} — ${item.descripcion}`;
    if (els.configClaveSatHint) {
      els.configClaveSatHint.textContent = 'Clave seleccionada del catálogo del SAT.';
    }
    if (els.configClaveSatSinResultados) els.configClaveSatSinResultados.hidden = true;
    setFieldError('config-clave-sat', '');
    ocultarSugerenciasClaveSat();
  }

  function renderSugerenciasClaveSat(resultados, termino) {
    claveSatSugerenciasActuales = resultados;
    claveSatIndiceActivo = -1;
    if (!els.configClaveSatSugerencias) return;
    if (!resultados.length) {
      els.configClaveSatSugerencias.hidden = true;
      els.configClaveSatSugerencias.innerHTML = '';
      els.configClaveSatBuscador.setAttribute('aria-expanded', 'false');
      if (els.configClaveSatSinResultados) {
        els.configClaveSatSinResultados.hidden = !(termino && termino.trim().length >= 2);
      }
      return;
    }
    if (els.configClaveSatSinResultados) els.configClaveSatSinResultados.hidden = true;
    els.configClaveSatSugerencias.innerHTML = resultados
      .map(
        (item, i) => `
      <button type="button" class="clave-sat-sugerencia" role="option" id="clave-sat-sugerencia-${i}" data-indice="${i}">
        <span class="clave-sat-sugerencia-clave">${escapeHtml(item.clave)}</span>
        <span class="clave-sat-sugerencia-descripcion">${escapeHtml(item.descripcion)}</span>
      </button>`
      )
      .join('');
    els.configClaveSatSugerencias.hidden = false;
    els.configClaveSatBuscador.setAttribute('aria-expanded', 'true');
    els.configClaveSatSugerencias.querySelectorAll('.clave-sat-sugerencia').forEach((btn) => {
      btn.addEventListener('mousedown', (ev) => {
        // mousedown (no click) para adelantarse al blur del input y no
        // perder la selección antes de que el handler de clic corra.
        ev.preventDefault();
        const item = claveSatSugerenciasActuales[Number(btn.dataset.indice)];
        if (item) seleccionarClaveSat(item);
      });
    });
  }

  async function buscarClaveSat(termino) {
    const authHeader = getAuthHeader();
    if (!authHeader || !termino || termino.trim().length < 2) {
      renderSugerenciasClaveSat([], termino);
      return;
    }
    if (claveSatControladorBusqueda) claveSatControladorBusqueda.abort();
    claveSatControladorBusqueda = new AbortController();
    try {
      const res = await fetch(`${API_BASE}/admin/catalogo-clave-sat/buscar?q=${encodeURIComponent(termino.trim())}`, {
        headers: { Authorization: authHeader },
        signal: claveSatControladorBusqueda.signal,
      });
      if (!res.ok) {
        renderSugerenciasClaveSat([], termino);
        return;
      }
      const data = await res.json();
      renderSugerenciasClaveSat(data.resultados || [], termino);
    } catch (err) {
      if (err.name !== 'AbortError') renderSugerenciasClaveSat([], termino);
    }
  }

  if (els.configClaveSatBuscador) {
    els.configClaveSatBuscador.addEventListener('input', () => {
      const texto = els.configClaveSatBuscador.value;
      setFieldError('config-clave-sat', '');
      // 8 dígitos exactos: captura manual directa (alternativa "3"), sin
      // esperar a que se elija una sugerencia — el catálogo local puede no
      // tener una clave real todavía, o el usuario ya la trae anotada.
      const soloDigitos = texto.trim();
      if (/^\d{8}$/.test(soloDigitos)) {
        els.configClaveSat.value = soloDigitos;
        if (els.configClaveSatHint) els.configClaveSatHint.textContent = 'Clave capturada manualmente (8 dígitos).';
      } else {
        els.configClaveSat.value = '';
      }
      clearTimeout(claveSatTimeoutBusqueda);
      claveSatTimeoutBusqueda = setTimeout(() => buscarClaveSat(texto), 300);
    });

    els.configClaveSatBuscador.addEventListener('keydown', (ev) => {
      if (els.configClaveSatSugerencias.hidden) return;
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        claveSatIndiceActivo = Math.min(claveSatIndiceActivo + 1, claveSatSugerenciasActuales.length - 1);
        marcarSugerenciaActivaClaveSat();
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        claveSatIndiceActivo = Math.max(claveSatIndiceActivo - 1, 0);
        marcarSugerenciaActivaClaveSat();
      } else if (ev.key === 'Enter') {
        if (claveSatIndiceActivo >= 0 && claveSatSugerenciasActuales[claveSatIndiceActivo]) {
          ev.preventDefault();
          seleccionarClaveSat(claveSatSugerenciasActuales[claveSatIndiceActivo]);
        }
      } else if (ev.key === 'Escape') {
        ocultarSugerenciasClaveSat();
      }
    });

    els.configClaveSatBuscador.addEventListener('blur', () => {
      // Pequeño margen para que el mousedown de una sugerencia corra antes.
      setTimeout(ocultarSugerenciasClaveSat, 150);
    });
  }

  // Prefill al cargar: si ya hay una clave guardada, se busca por coincidencia
  // exacta para mostrar "clave — descripción"; si no está en el catálogo
  // local (valor histórico o catálogo desactualizado), se muestra solo la
  // clave cruda, igual que antes de este cambio.
  async function aplicarClaveSatCargada(clave) {
    els.configClaveSat.value = clave || '';
    if (!els.configClaveSatBuscador) return;
    if (!clave) {
      els.configClaveSatBuscador.value = '';
      if (els.configClaveSatHint) els.configClaveSatHint.textContent = 'Elige un resultado de la lista o captura los 8 dígitos si ya los conoces.';
      return;
    }
    els.configClaveSatBuscador.value = clave;
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/catalogo-clave-sat/buscar?q=${encodeURIComponent(clave)}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();
      const match = (data.resultados || []).find((item) => item.clave === clave);
      if (match) {
        els.configClaveSatBuscador.value = `${match.clave} — ${match.descripcion}`;
        if (els.configClaveSatHint) els.configClaveSatHint.textContent = 'Clave seleccionada del catálogo del SAT.';
      }
    } catch (err) {
      // Se queda mostrando solo la clave cruda — no es un error bloqueante.
    }
  }

  // ---------- Configuración global (IVA y zona horaria) ----------

  els.btnToggleGlobalConfig.addEventListener('click', () => {
    const abierto = els.btnToggleGlobalConfig.getAttribute('aria-expanded') === 'true';
    els.btnToggleGlobalConfig.setAttribute('aria-expanded', String(!abierto));
    els.globalConfigBody.hidden = abierto;
  });

  // "Registrar venta" (rediseño 2026-08-21, PROJECT_STATE.md punto 126):
  // ya no es un panel sticky que se colapsa — es un modal (mismo patrón
  // "Gestionar" que Tickets). Se abre limpio cada vez (una venta nueva
  // parte de cero) y NO se cierra solo al guardar — ver el handler de
  // "Registrar" más abajo, que lo deja abierto y listo para la
  // siguiente venta a propósito, para no romper el flujo de capturar
  // varias ventas seguidas que sí tenía el formulario sticky anterior.
  function abrirOrdenRegistrarModal() {
    limpiarFormularioOrden();
    els.ordenFormExito.hidden = true;
    els.ordenFormBody.hidden = false;
    els.ordenRegistrarModalOverlay.hidden = false;
    const borrador = obtenerOrdenBorradorGuardado();
    if (borrador) {
      abrirConfirmacion({
        titulo: 'Tienes un borrador guardado',
        mensaje: `Guardaste ${borrador.productos.length} producto${borrador.productos.length === 1 ? '' : 's'} sin terminar de registrar. ¿Quieres continuarlo?`,
        textoBoton: 'Continuar borrador',
        onConfirmar: () => restaurarOrdenBorrador(borrador),
        variante: 'primario',
      });
    }
  }
  function cerrarOrdenRegistrarModal() {
    els.ordenRegistrarModalOverlay.hidden = true;
  }
  els.btnAbrirOrdenModal.addEventListener('click', abrirOrdenRegistrarModal);
  els.btnCerrarOrdenModal.addEventListener('click', cerrarOrdenRegistrarModal);
  els.ordenRegistrarModalOverlay.addEventListener('click', (e) => {
    if (e.target === els.ordenRegistrarModalOverlay) cerrarOrdenRegistrarModal();
  });

  // "Corte del día" (Ventas, PROJECT_STATE.md punto 168): reporte de
  // consulta bajo demanda, rango de fechas libre, SOLO ventas — pantalla
  // + imprimir, sin correo. No marca ni excluye ventas a propósito
  // (Opción A de la propuesta aprobada: se puede repetir el mismo rango
  // las veces que sea, sin doble-conteo real de caja).
  let corteUltimoResultado = null;

  // Rangos rápidos de "Corte del día" (punto 320) — 1 clic llena
  // Desde/Hasta con el rango más común; los campos se quedan editables
  // después, un chip solo les asigna un valor de partida.
  function fechaISO(d) {
    return d.toISOString().slice(0, 10);
  }
  function calcularRangoRapidoCorte(tipo) {
    const hoy = new Date();
    const hoyStr = fechaISO(hoy);
    if (tipo === 'hoy') return { desde: hoyStr, hasta: hoyStr };
    if (tipo === 'ayer') {
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);
      const s = fechaISO(ayer);
      return { desde: s, hasta: s };
    }
    if (tipo === 'semana') {
      const diaSemana = hoy.getDay(); // 0=domingo..6=sábado
      const diffALunes = diaSemana === 0 ? 6 : diaSemana - 1;
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - diffALunes);
      return { desde: fechaISO(lunes), hasta: hoyStr };
    }
    if (tipo === 'mes') {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: fechaISO(primero), hasta: hoyStr };
    }
    if (tipo === 'mes_anterior') {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return { desde: fechaISO(primero), hasta: fechaISO(ultimo) };
    }
    return null;
  }
  function sincronizarChipActivoCorte() {
    const desde = els.corteFiltroDesde.value;
    const hasta = els.corteFiltroHasta.value;
    els.corteChipRow.querySelectorAll('.corte-chip').forEach((chip) => {
      const rango = calcularRangoRapidoCorte(chip.dataset.rango);
      chip.classList.toggle('is-active', !!rango && rango.desde === desde && rango.hasta === hasta);
    });
  }
  els.corteChipRow.addEventListener('click', (e) => {
    const chip = e.target.closest('.corte-chip');
    if (!chip) return;
    const rango = calcularRangoRapidoCorte(chip.dataset.rango);
    if (!rango) return;
    els.corteFiltroDesde.value = rango.desde;
    els.corteFiltroHasta.value = rango.hasta;
    sincronizarChipActivoCorte();
  });
  els.corteFiltroDesde.addEventListener('input', sincronizarChipActivoCorte);
  els.corteFiltroHasta.addEventListener('input', sincronizarChipActivoCorte);

  // Punto 350: "Corte del día" (Ventas) deja de pedir fechas — siempre
  // hoy, un clic. El selector de rango libre que antes vivía aquí se
  // movió a Lectura de reportes → pestaña Cortes, como "Reporte por
  // rango" (abrirCorteModal('rango')), mismo modal/endpoint, solo
  // reubicado. corteModalModo decide si se ve .corte-filtros-row y si
  // se auto-genera al abrir.
  let corteModalModo = 'hoy';

  function fechaLegibleCorta(iso) {
    const fecha = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function generarCorte(desde, hasta) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.corteError.textContent = '';
    if (!desde || !hasta) {
      els.corteError.textContent = 'Elige la fecha "desde" y "hasta".';
      return;
    }
    if (desde > hasta) {
      els.corteError.textContent = 'La fecha "desde" debe ser anterior o igual a "hasta".';
      return;
    }
    els.btnGenerarCorte.disabled = true;
    els.btnGenerarCorteLabel.textContent = 'Generando…';
    try {
      const res = await fetch(`${API_BASE}/admin/reportes/corte`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ desde, hasta }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.corteError.textContent = data.error || 'No se pudo generar el corte.';
        return;
      }
      corteUltimoResultado = data;
      const r = data.resumen;
      els.corteResultadoVentas.textContent = r.ventas;
      els.corteResultadoSubtotal.textContent = `$${formatearMoneda(r.subtotal)}`;
      els.corteResultadoIva.textContent = `$${formatearMoneda(r.iva)}`;
      els.corteResultadoTotal.textContent = `$${formatearMoneda(r.total)}`;
      els.corteResultadoFacturado.textContent = `$${formatearMoneda(r.facturado)}`;
      els.corteResultadoSinFacturar.textContent = `$${formatearMoneda(r.sin_facturar)}`;
      els.corteResultadoCobrado.textContent = `$${formatearMoneda(r.cobrado)}`;
      els.corteResultadoPendiente.textContent = `$${formatearMoneda(r.pendiente_cobro)}`;
      els.corteResultado.hidden = false;
      els.corteResultadoEmpty.hidden = r.ventas > 0;
    } catch (err) {
      els.corteError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      els.btnGenerarCorte.disabled = false;
      els.btnGenerarCorteLabel.textContent = 'Generar corte';
    }
  }

  function abrirCorteModal(modo) {
    corteModalModo = modo;
    els.corteError.textContent = '';
    els.corteResultado.hidden = true;
    els.corteResultadoEmpty.hidden = true;
    corteUltimoResultado = null;
    const hoy = new Date().toISOString().slice(0, 10);
    if (modo === 'hoy') {
      els.corteModalTitle.textContent = `Corte del día — ${fechaLegibleCorta(hoy)}`;
      els.corteFiltrosRow.hidden = true;
      els.corteFiltroDesde.value = hoy;
      els.corteFiltroHasta.value = hoy;
      els.corteModalOverlay.hidden = false;
      generarCorte(hoy, hoy);
      return;
    }
    els.corteModalTitle.textContent = 'Reporte por rango';
    els.corteFiltrosRow.hidden = false;
    if (!els.corteFiltroDesde.value) els.corteFiltroDesde.value = hoy;
    if (!els.corteFiltroHasta.value) els.corteFiltroHasta.value = hoy;
    sincronizarChipActivoCorte();
    els.corteModalOverlay.hidden = false;
  }
  function cerrarCorteModal() {
    els.corteModalOverlay.hidden = true;
  }
  els.btnAbrirCorteModal.addEventListener('click', () => abrirCorteModal('hoy'));
  els.btnAbrirCorteRangoModal.addEventListener('click', () => abrirCorteModal('rango'));
  els.btnCerrarCorteModal.addEventListener('click', cerrarCorteModal);
  els.corteModalOverlay.addEventListener('click', (e) => {
    if (e.target === els.corteModalOverlay) cerrarCorteModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.corteModalOverlay.hidden) cerrarCorteModal();
  });

  els.btnGenerarCorte.addEventListener('click', () => {
    generarCorte(els.corteFiltroDesde.value, els.corteFiltroHasta.value);
  });

  // Arma el corte imprimible (ancho de hoja, no recibo) del último
  // resultado ya generado — mismo criterio que #ticket-imprimir: llenar
  // un contenedor oculto y llamar a window.print() en la misma página, sin
  // ventana nueva (los popups se bloquean seguido tras un fetch async). El
  // corte no pasa por el preview del ticket (es otro documento, otro flujo).
  els.btnImprimirCorte.addEventListener('click', () => {
    if (!corteUltimoResultado) return;
    const { desde, hasta, resumen, ordenes } = corteUltimoResultado;
    const filasHtml = ordenes.length
      ? ordenes
          .map(
            (o) => `
              <tr>
                <td>${escapeHtml(o.numero_compra)}</td>
                <td>${escapeHtml(o.fecha_compra_formateada.fecha)}</td>
                <td>${o.email ? escapeHtml(o.email) : 'Sin correo'}</td>
                <td>${o.facturado ? 'Facturado' : 'Sin facturar'}</td>
                <td>$${formatearMoneda(o.total)}</td>
              </tr>`
          )
          .join('')
      : '<tr><td colspan="5">Sin ventas en este rango.</td></tr>';
    els.corteImprimir.innerHTML = `
      <div class="corte-imprimir-titulo">Corte de ventas</div>
      <div class="corte-imprimir-rango">${escapeHtml(desde)} — ${escapeHtml(hasta)}</div>
      <div class="corte-imprimir-resumen">
        <div><span>Ventas</span><span>${resumen.ventas}</span></div>
        <div><span>Subtotal</span><span>$${formatearMoneda(resumen.subtotal)}</span></div>
        <div><span>IVA</span><span>$${formatearMoneda(resumen.iva)}</span></div>
        <div><span>Total</span><span>$${formatearMoneda(resumen.total)}</span></div>
        <div><span>Facturado</span><span>$${formatearMoneda(resumen.facturado)}</span></div>
        <div><span>Sin facturar</span><span>$${formatearMoneda(resumen.sin_facturar)}</span></div>
        <div><span>Cobrado</span><span>$${formatearMoneda(resumen.cobrado)}</span></div>
        <div><span>Pendiente de cobro</span><span>$${formatearMoneda(resumen.pendiente_cobro)}</span></div>
      </div>
      <table class="corte-imprimir-tabla">
        <thead><tr><th>No. Venta</th><th>Fecha</th><th>Correo</th><th>Facturación</th><th>Total</th></tr></thead>
        <tbody>${filasHtml}</tbody>
      </table>
    `;
    window.print();
  });

  // Descarga en CSV el corte recién generado (punto 320) — mismos datos
  // que ya trae corteUltimoResultado, sin pedir nada nuevo al backend.
  els.btnExportarCorteActualCsv.addEventListener('click', () => {
    if (!corteUltimoResultado) return;
    const { desde, hasta, ordenes } = corteUltimoResultado;
    if (!ordenes.length) {
      showToast('No hay ventas en este rango para exportar', 'error');
      return;
    }
    const csvCelda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const encabezado = ['No. Venta', 'Fecha', 'Correo', 'Facturación', 'Total'];
    const lineas = ordenes.map((o) =>
      [
        o.numero_compra,
        o.fecha_compra_formateada.fecha,
        o.email || 'Sin correo',
        o.facturado ? 'Facturado' : 'Sin facturar',
        Number(o.total).toFixed(2),
      ]
        .map(csvCelda)
        .join(',')
    );
    const csv = [encabezado.map(csvCelda).join(','), ...lineas].join('\r\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corte-${desde}_a_${hasta}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Las zonas horarias son un catálogo fijo (no cambia entre peticiones),
  // así que se piden una sola vez y se reutilizan tanto aquí como en la
  // vista de Ventas.
  let zonasHorariasCache = null;

  async function obtenerZonasHorarias() {
    if (zonasHorariasCache) return zonasHorariasCache;
    const authHeader = getAuthHeader();
    if (!authHeader) return [];
    try {
      const res = await fetch(`${API_BASE}/admin/config/zonas-horarias`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return [];
      const data = await res.json();
      zonasHorariasCache = data.zonas || [];
      return zonasHorariasCache;
    } catch (err) {
      return [];
    }
  }

  function poblarSelectZonasHorarias(select, zonas, seleccionActual) {
    select.innerHTML = '';
    zonas.forEach((zona) => {
      const option = document.createElement('option');
      option.value = zona.id;
      option.textContent = zona.etiqueta;
      select.appendChild(option);
    });
    if (seleccionActual) select.value = seleccionActual;
  }

  // Muestra "RFC - Código SAT" junto a "Administración" en la barra de
  // sesión — SOLO si los dos están capturados. Con cualquiera de los dos
  // vacío, no se muestra nada extra (ni un "RFC -" ni un "- Código SAT"
  // a medias), para no dejar un texto incompleto en el encabezado.
  // Convierte 'fisica'/'moral' al texto que se muestra en la barra de
  // sesión — no se usa en ningún otro lugar, así que no hace falta un
  // catálogo compartido para esto.
  function textoTipoPersona(tipo) {
    if (tipo === 'fisica') return 'Persona Física';
    if (tipo === 'moral') return 'Persona Moral';
    return '';
  }

  function aplicarInfoFiscalBarra(config) {
    const rfc = (config.rfc_compania || '').trim();
    const claveSat = (config.clave_sat || '').trim();
    const tipoPersonaTexto = textoTipoPersona(config.tipo_persona_compania);
    if (rfc && claveSat) {
      // El tipo de persona es un tercer segmento opcional — solo se
      // agrega si ya se pudo calcular (requiere que la constancia haya
      // traído al menos un régimen fiscal reconocido); sin él, la barra
      // se queda en "RFC - Clave SAT" nada más, en vez de un segundo
      // guión colgando sin nada después.
      els.brandFiscalInfo.textContent = tipoPersonaTexto
        ? `${rfc} - ${claveSat} - ${tipoPersonaTexto}`
        : `${rfc} - ${claveSat}`;
      els.brandFiscalInfo.hidden = false;
    } else {
      els.brandFiscalInfo.hidden = true;
      els.brandFiscalInfo.textContent = '';
    }
  }

  // Llena la caja de solo lectura de "Régimen fiscal" con lo que se haya
  // extraído de la constancia — cada régimen en su propia línea (un
  // contribuyente puede tener más de uno activo a la vez).
  function aplicarRegimenFiscalCompaniaBox(regimenFiscalTexto) {
    const texto = (regimenFiscalTexto || '').trim();
    if (texto) {
      els.regimenFiscalCompaniaBox.textContent = texto;
      els.regimenFiscalCompaniaBox.classList.remove('admin-config-readonly-vacio');
    } else {
      els.regimenFiscalCompaniaBox.innerHTML = '<span class="admin-config-readonly-vacio">Todavía no se ha subido ninguna constancia.</span>';
    }
  }

  // Misma lógica que aplicarRegimenFiscalCompaniaBox — la razón social
  // se lee con extraerNombreRazonSocial(), la MISMA función ya usada
  // (y ya depurada) en la constancia de un cliente, para no repetir los
  // mismos bugs de lectura que ya se encontraron y corrigieron ahí.
  function aplicarRazonSocialCompaniaBox(razonSocialTexto) {
    const texto = (razonSocialTexto || '').trim();
    if (texto) {
      els.razonSocialCompaniaBox.textContent = texto;
      els.razonSocialCompaniaBox.classList.remove('admin-config-readonly-vacio');
    } else {
      els.razonSocialCompaniaBox.innerHTML = '<span class="admin-config-readonly-vacio">Todavía no se ha subido ninguna constancia.</span>';
    }
  }

  // El aviso solo tiene sentido para quien puede ACTUAR sobre él — un
  // perfil sin acceso a la tarjeta "Configuraciones fiscales" (hoy solo
  // "ventas") no tiene forma de completar esos datos, así que mostrarle
  // un aviso sin salida (y, peor, intentar navegarlo a una vista que ni
  // siquiera puede ver) es puro ruido. Mismo mapa que
  // aplicarRestriccionesPerfil(): sin entrada en RESTRICCIONES_PERFIL
  // ("super") equivale a sin restricciones.
  function puedeCompletarDatosFiscales() {
    const restriccion = RESTRICCIONES_PERFIL[perfilActual];
    return !restriccion || (restriccion.tarjetasConfigPermitidas || []).includes('global-config-card');
  }

  // Ventana emergente al iniciar sesión si falta el RFC de la compañía
  // y/o el Código SAT — ver dónde se llama (solo con
  // { verificarFiscalFaltante: true }, no en cada apertura de la
  // tarjeta de configuración). Reaparece en cada login mientras falten
  // datos (igual que el checklist "Primeros pasos" — no se calla hasta
  // completarse), pero solo para quien puede completarlos.
  function verificarDatosFiscalesFaltantes(config) {
    const faltaRfc = !(config.rfc_compania || '').trim();
    const faltaClaveSat = !(config.clave_sat || '').trim();
    datosFiscalesCompletos = !(faltaRfc || faltaClaveSat);
    // Mismo criterio de "Falta configurar..." punto en curso: con
    // Facturación apagada, el RFC/Clave SAT de la compañía no tiene para
    // qué completarse (nadie va a facturar) — mismo flag que ya oculta
    // la tarjeta "Configuraciones fiscales" (global-config-card) a la que
    // este aviso manda; mostrarlo sin Facturación activa llevaría a un
    // destino que tampoco está disponible.
    if ((faltaRfc || faltaClaveSat) && puedeCompletarDatosFiscales() && planPermite('facturacionHabilitada')) {
      els.configFiscalFaltanteOverlay.hidden = false;
    }
    renderOnboardingChecklist();
  }

  // El único botón del aviso YA es la acción, no un simple "cerrar": lleva
  // directo a la tarjeta "Configuraciones fiscales" con el foco en el
  // control de subida de la constancia — el mismo destino que el texto
  // del aviso ya describía en palabras, ahora es un solo clic.
  els.btnConfigFiscalFaltanteCerrar.addEventListener('click', () => {
    els.configFiscalFaltanteOverlay.hidden = true;
    abrirConfigModal();
    seleccionarSeccionConfig('global-config-card');
    mostrarSeccionMovilConfig();
    els.btnSubirConstanciaCompania?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    els.btnSubirConstanciaCompania?.focus();
  });
  els.configFiscalFaltanteOverlay.addEventListener('click', (e) => {
    if (e.target === els.configFiscalFaltanteOverlay) {
      els.configFiscalFaltanteOverlay.hidden = true;
    }
  });

  // Muestra/oculta el botón "Ventas" del menú según el interruptor de
  // "Configuraciones" — con el botón oculto, no hay forma de
  // llegar a esa vista desde el menú (este panel no usa rutas de URL para
  // cada pestaña, así que ocultar el botón ya basta para "quitar" la
  // funcionalidad de la navegación). Delega en aplicarRestriccionesPerfil()
  // en vez de tocar els.btnVistaOrdenes.hidden directamente: esa función ya
  // combina esto con la restricción de perfil (ventasHabilitadaGlobalmente
  // && permitida para el perfil) y ya trae la lógica de "si estaba viendo
  // la vista que se acaba de ocultar, navegar a la primera disponible" —
  // duplicarla aquí permitía que esta función reactivara "Ventas" para un
  // perfil "fiscal" que aplicarRestriccionesPerfil() ya había ocultado.
  function aplicarVisibilidadOrdenesCompra(habilitado) {
    ventasHabilitadaGlobalmente = habilitado;
    aplicarRestriccionesPerfil();
  }

  // Mismo criterio para el switch "Mostrar Auditoría" (punto 244) — el
  // botón/entrada del menú se oculta, la tabla admin_auditoria sigue
  // registrando accesos sin importar este switch.
  function aplicarVisibilidadAuditoria(habilitado) {
    auditoriaHabilitadaGlobalmente = habilitado;
    aplicarRestriccionesPerfil();
  }

  // El interruptor "Habilitar Ventas" se guarda SOLO al
  // cambiarlo, sin depender del botón "Guardar cambios" general de esta
  // tarjeta (que sigue guardando IVA/zona horaria/Clave SAT/link como
  // siempre) — a diferencia de esos campos de texto, un interruptor es
  // una acción ya deliberada y completa en sí misma al hacer clic, así
  // que esperar a un segundo paso (presionar Guardar) solo agrega
  // fricción innecesaria.
  let timeoutAutoguardadoOrdenes = null;
  els.configOrdenesHabilitado.addEventListener('change', async () => {
    const nuevoValor = els.configOrdenesHabilitado.checked;
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    clearTimeout(timeoutAutoguardadoOrdenes);
    els.configOrdenesHabilitado.disabled = true;
    els.ordenesHabilitadoAutoguardado.textContent = 'Guardando…';
    els.ordenesHabilitadoAutoguardado.setAttribute('data-estado', 'guardando');

    try {
      const res = await fetch(`${API_BASE}/admin/config/global`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordenes_compra_habilitado: nuevoValor }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo guardar.');
      }

      aplicarVisibilidadOrdenesCompra(nuevoValor);
      els.ordenesHabilitadoAutoguardado.innerHTML = HTML_GUARDADO_OK;
      els.ordenesHabilitadoAutoguardado.setAttribute('data-estado', 'guardado');
      // El mensaje de éxito se desvanece solo después de un momento — a
      // diferencia del de error, que se queda visible hasta el próximo
      // intento, ya que ese sí necesita que alguien lo note y actúe.
      timeoutAutoguardadoOrdenes = setTimeout(() => {
        els.ordenesHabilitadoAutoguardado.textContent = '';
        els.ordenesHabilitadoAutoguardado.removeAttribute('data-estado');
      }, 2500);
    } catch (err) {
      // El cambio no se guardó de verdad — el checkbox no debe quedarse
      // mostrando un estado que no está persistido en el servidor, o la
      // próxima vez que se cargue la configuración real se vería como si
      // "se hubiera revertido solo", sin que quede claro por qué.
      els.configOrdenesHabilitado.checked = !nuevoValor;
      els.ordenesHabilitadoAutoguardado.textContent = 'No se pudo guardar — inténtalo de nuevo.';
      els.ordenesHabilitadoAutoguardado.setAttribute('data-estado', 'error');
    } finally {
      els.configOrdenesHabilitado.disabled = false;
    }
  });

  // "Método de entrega por defecto" — mismo criterio de autoguardado que
  // "Habilitar Ventas" arriba: una elección ya deliberada y completa al
  // marcar el radio, sin esperar al botón "Guardar cambios" general.
  let timeoutAutoguardadoEntregaDefault = null;
  els.configEntregaDefaultRadios.forEach((radio) => {
    radio.addEventListener('change', async () => {
      if (!radio.checked) return;
      const valorAnterior = ordenEntregaDefault;
      const nuevoValor = radio.value;
      const authHeader = getAuthHeader();
      if (!authHeader) {
        showLogin();
        return;
      }

      clearTimeout(timeoutAutoguardadoEntregaDefault);
      els.configEntregaDefaultRadios.forEach((r) => { r.disabled = true; });
      els.entregaDefaultAutoguardado.textContent = 'Guardando…';
      els.entregaDefaultAutoguardado.setAttribute('data-estado', 'guardando');

      try {
        const res = await fetch(`${API_BASE}/admin/config/global`, {
          method: 'PUT',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entrega_venta_default: nuevoValor }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'No se pudo guardar.');
        }

        ordenEntregaDefault = nuevoValor;
        els.entregaDefaultAutoguardado.innerHTML = HTML_GUARDADO_OK;
        els.entregaDefaultAutoguardado.setAttribute('data-estado', 'guardado');
        timeoutAutoguardadoEntregaDefault = setTimeout(() => {
          els.entregaDefaultAutoguardado.textContent = '';
          els.entregaDefaultAutoguardado.removeAttribute('data-estado');
        }, 2500);
      } catch (err) {
        els.configEntregaDefaultRadios.forEach((r) => {
          r.checked = r.value === valorAnterior;
        });
        els.entregaDefaultAutoguardado.textContent = 'No se pudo guardar — inténtalo de nuevo.';
        els.entregaDefaultAutoguardado.setAttribute('data-estado', 'error');
      } finally {
        els.configEntregaDefaultRadios.forEach((r) => { r.disabled = false; });
      }
    });
  });

  // Punto 342: "Método de pago por defecto" — mismo patrón exacto que
  // "Método de entrega por defecto" de arriba.
  let timeoutAutoguardadoMetodoPagoDefault = null;
  els.configMetodoPagoDefaultRadios.forEach((radio) => {
    radio.addEventListener('change', async () => {
      if (!radio.checked) return;
      const valorAnterior = ordenMetodoPagoDefault;
      const nuevoValor = radio.value;
      const authHeader = getAuthHeader();
      if (!authHeader) {
        showLogin();
        return;
      }

      clearTimeout(timeoutAutoguardadoMetodoPagoDefault);
      els.configMetodoPagoDefaultRadios.forEach((r) => { r.disabled = true; });
      els.metodoPagoDefaultAutoguardado.textContent = 'Guardando…';
      els.metodoPagoDefaultAutoguardado.setAttribute('data-estado', 'guardando');

      try {
        const res = await fetch(`${API_BASE}/admin/config/global`, {
          method: 'PUT',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ metodo_pago_venta_default: nuevoValor }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'No se pudo guardar.');
        }

        ordenMetodoPagoDefault = nuevoValor;
        els.metodoPagoDefaultAutoguardado.innerHTML = HTML_GUARDADO_OK;
        els.metodoPagoDefaultAutoguardado.setAttribute('data-estado', 'guardado');
        timeoutAutoguardadoMetodoPagoDefault = setTimeout(() => {
          els.metodoPagoDefaultAutoguardado.textContent = '';
          els.metodoPagoDefaultAutoguardado.removeAttribute('data-estado');
        }, 2500);
      } catch (err) {
        els.configMetodoPagoDefaultRadios.forEach((r) => {
          r.checked = r.value === valorAnterior;
        });
        els.metodoPagoDefaultAutoguardado.textContent = 'No se pudo guardar — inténtalo de nuevo.';
        els.metodoPagoDefaultAutoguardado.setAttribute('data-estado', 'error');
      } finally {
        els.configMetodoPagoDefaultRadios.forEach((r) => { r.disabled = false; });
      }
    });
  });

  // Punto 342: prefijo del folio de conciliación — autoguardado en
  // blur/change (no en cada tecla), mismo criterio que otros campos de
  // texto de Configuraciones.
  // Rediseño (fiel a stitch/modVentas): chip "Ejemplo: CV0001" se
  // actualiza EN VIVO con cada tecla — solo visual, no dispara ningún
  // guardado (eso lo sigue haciendo únicamente el listener de "change"
  // de abajo). Con un prefijo inválido (no 2 letras), muestra el
  // ejemplo con el último prefijo válido en vez de un valor a medio
  // escribir.
  if (els.configFolioConciliacionPrefijo && els.configFolioPreviewValor) {
    els.configFolioConciliacionPrefijo.addEventListener('input', () => {
      const valor = els.configFolioConciliacionPrefijo.value.trim().toUpperCase();
      els.configFolioPreviewValor.textContent = `${/^[A-Z]{2}$/.test(valor) ? valor : 'CV'}0001`;
    });
  }

  let timeoutAutoguardadoFolioPrefijo = null;
  if (els.configFolioConciliacionPrefijo) {
    els.configFolioConciliacionPrefijo.addEventListener('change', async () => {
      els.errorFolioConciliacionPrefijo.textContent = '';
      const nuevoValor = els.configFolioConciliacionPrefijo.value.trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(nuevoValor)) {
        els.errorFolioConciliacionPrefijo.textContent = 'Captura exactamente 2 letras (A-Z).';
        return;
      }
      const authHeader = getAuthHeader();
      if (!authHeader) {
        showLogin();
        return;
      }

      clearTimeout(timeoutAutoguardadoFolioPrefijo);
      els.configFolioConciliacionPrefijo.disabled = true;
      els.folioConciliacionPrefijoAutoguardado.textContent = 'Guardando…';
      els.folioConciliacionPrefijoAutoguardado.setAttribute('data-estado', 'guardando');

      try {
        const res = await fetch(`${API_BASE}/admin/config/global`, {
          method: 'PUT',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ folio_conciliacion_prefijo: nuevoValor }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo guardar.');
        els.configFolioConciliacionPrefijo.value = nuevoValor;
        els.folioConciliacionPrefijoAutoguardado.innerHTML = HTML_GUARDADO_OK;
        els.folioConciliacionPrefijoAutoguardado.setAttribute('data-estado', 'guardado');
        timeoutAutoguardadoFolioPrefijo = setTimeout(() => {
          els.folioConciliacionPrefijoAutoguardado.textContent = '';
          els.folioConciliacionPrefijoAutoguardado.removeAttribute('data-estado');
        }, 2500);
      } catch (err) {
        els.folioConciliacionPrefijoAutoguardado.textContent = '';
        els.folioConciliacionPrefijoAutoguardado.removeAttribute('data-estado');
        els.errorFolioConciliacionPrefijo.textContent = err.message;
      } finally {
        els.configFolioConciliacionPrefijo.disabled = false;
      }
    });
  }

  // "Mostrar Auditoría" — mismo autoguardado que "Habilitar Ventas".
  let timeoutAutoguardadoAuditoria = null;
  els.configAuditoriaHabilitada.addEventListener('change', async () => {
    const nuevoValor = els.configAuditoriaHabilitada.checked;
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    clearTimeout(timeoutAutoguardadoAuditoria);
    els.configAuditoriaHabilitada.disabled = true;
    els.auditoriaHabilitadaAutoguardado.textContent = 'Guardando…';
    els.auditoriaHabilitadaAutoguardado.setAttribute('data-estado', 'guardando');

    try {
      const res = await fetch(`${API_BASE}/admin/config/global`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditoria_habilitada: nuevoValor }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo guardar.');
      }

      aplicarVisibilidadAuditoria(nuevoValor);
      els.auditoriaHabilitadaAutoguardado.innerHTML = HTML_GUARDADO_OK;
      els.auditoriaHabilitadaAutoguardado.setAttribute('data-estado', 'guardado');
      timeoutAutoguardadoAuditoria = setTimeout(() => {
        els.auditoriaHabilitadaAutoguardado.textContent = '';
        els.auditoriaHabilitadaAutoguardado.removeAttribute('data-estado');
      }, 2500);
    } catch (err) {
      els.configAuditoriaHabilitada.checked = !nuevoValor;
      els.auditoriaHabilitadaAutoguardado.textContent = 'No se pudo guardar — inténtalo de nuevo.';
      els.auditoriaHabilitadaAutoguardado.setAttribute('data-estado', 'error');
    } finally {
      els.configAuditoriaHabilitada.disabled = false;
    }
  });

  if (els.btnToggleAuditoriaCard) {
    els.btnToggleAuditoriaCard.addEventListener('click', () => {
      const abierto = els.btnToggleAuditoriaCard.getAttribute('aria-expanded') === 'true';
      els.btnToggleAuditoriaCard.setAttribute('aria-expanded', String(!abierto));
      els.auditoriaToggleBody.hidden = abierto;
    });
  }

  if (els.btnToggleNotifCard) {
    els.btnToggleNotifCard.addEventListener('click', () => {
      const abierto = els.btnToggleNotifCard.getAttribute('aria-expanded') === 'true';
      els.btnToggleNotifCard.setAttribute('aria-expanded', String(!abierto));
      els.notifToggleBody.hidden = abierto;
    });
  }

  let timeoutAutoguardadoNotifTickets = null;
  els.configNotifTicketsPermiteOcultar.addEventListener('change', async () => {
    const nuevoValor = els.configNotifTicketsPermiteOcultar.checked;
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    clearTimeout(timeoutAutoguardadoNotifTickets);
    els.configNotifTicketsPermiteOcultar.disabled = true;
    els.notifTicketsPermiteOcultarAutoguardado.textContent = 'Guardando…';
    els.notifTicketsPermiteOcultarAutoguardado.setAttribute('data-estado', 'guardando');

    try {
      const res = await fetch(`${API_BASE}/admin/config/global`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notif_tickets_permite_ocultar: nuevoValor }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo guardar.');
      }

      notifTicketsPermiteOcultarGlobalmente = nuevoValor;
      els.notifTicketsPermiteOcultarAutoguardado.innerHTML = HTML_GUARDADO_OK;
      els.notifTicketsPermiteOcultarAutoguardado.setAttribute('data-estado', 'guardado');
      timeoutAutoguardadoNotifTickets = setTimeout(() => {
        els.notifTicketsPermiteOcultarAutoguardado.textContent = '';
        els.notifTicketsPermiteOcultarAutoguardado.removeAttribute('data-estado');
      }, 2500);
    } catch (err) {
      els.configNotifTicketsPermiteOcultar.checked = !nuevoValor;
      els.notifTicketsPermiteOcultarAutoguardado.textContent = 'No se pudo guardar — inténtalo de nuevo.';
      els.notifTicketsPermiteOcultarAutoguardado.setAttribute('data-estado', 'error');
    } finally {
      els.configNotifTicketsPermiteOcultar.disabled = false;
    }
  });

  // ---------- Punto 339: reglas escalonadas de aviso de expiración ----------

  const UNIDAD_REGLA_EXP_TEXTO = { d: 'día', s: 'semana', m: 'mes' };
  const DIAS_POR_UNIDAD_REGLA_EXP = { d: 1, s: 7, m: 30 };

  function diasDeReglaExpiracion(regla) {
    const match = /^([1-9][0-9]{0,3})([dsm])$/.exec(regla);
    if (!match) return 0;
    return Number(match[1]) * DIAS_POR_UNIDAD_REGLA_EXP[match[2]];
  }

  function diasMaximoAvisoExpiracionActual() {
    const dias = reglasExpiracionProductos.map(diasDeReglaExpiracion);
    return dias.length > 0 ? Math.max(...dias) : 30;
  }

  function humanizarReglaExpiracion(regla) {
    const match = /^([1-9][0-9]{0,3})([dsm])$/.exec(regla);
    if (!match) return regla;
    const numero = Number(match[1]);
    const base = UNIDAD_REGLA_EXP_TEXTO[match[2]];
    const unidadTexto = numero === 1 ? base : `${base}s`;
    return `${numero} ${unidadTexto} antes`;
  }

  function renderReglasExpiracionChips() {
    const ordenadas = [...reglasExpiracionProductos].sort((a, b) => diasDeReglaExpiracion(b) - diasDeReglaExpiracion(a));
    els.configNotifExpLista.innerHTML = '';
    ordenadas.forEach((regla) => {
      const li = document.createElement('li');
      li.className = 'regla-exp-chip';
      li.dataset.regla = regla;
      const texto = document.createElement('span');
      texto.textContent = humanizarReglaExpiracion(regla);
      const btnQuitar = document.createElement('button');
      btnQuitar.type = 'button';
      btnQuitar.className = 'regla-exp-chip-quitar';
      btnQuitar.setAttribute('aria-label', `Quitar regla: ${humanizarReglaExpiracion(regla)}`);
      btnQuitar.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
      li.appendChild(texto);
      li.appendChild(btnQuitar);
      els.configNotifExpLista.appendChild(li);
    });
    els.configNotifExpVacio.hidden = ordenadas.length > 0;
  }

  let timeoutAutoguardadoNotifExp = null;
  async function guardarReglasExpiracion(nuevaLista) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return false;
    }
    const anterior = reglasExpiracionProductos;
    clearTimeout(timeoutAutoguardadoNotifExp);
    els.notifExpAutoguardado.textContent = 'Guardando…';
    els.notifExpAutoguardado.setAttribute('data-estado', 'guardando');
    try {
      const res = await fetch(`${API_BASE}/admin/config/global`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notif_reglas_expiracion_productos: nuevaLista }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar.');
      reglasExpiracionProductos = data.notif_reglas_expiracion_productos || nuevaLista;
      renderReglasExpiracionChips();
      els.notifExpAutoguardado.innerHTML = HTML_GUARDADO_OK;
      els.notifExpAutoguardado.setAttribute('data-estado', 'guardado');
      timeoutAutoguardadoNotifExp = setTimeout(() => {
        els.notifExpAutoguardado.textContent = '';
        els.notifExpAutoguardado.removeAttribute('data-estado');
      }, 2500);
      return true;
    } catch (err) {
      reglasExpiracionProductos = anterior;
      els.errorConfigNotifExp.textContent = err.message || 'No se pudo guardar — inténtalo de nuevo.';
      els.notifExpAutoguardado.textContent = '';
      els.notifExpAutoguardado.removeAttribute('data-estado');
      return false;
    }
  }

  els.btnConfigNotifExpAgregar.addEventListener('click', async () => {
    els.errorConfigNotifExp.textContent = '';
    const numero = Number(els.configNotifExpNumero.value);
    const unidad = els.configNotifExpUnidad.value;
    if (!Number.isInteger(numero) || numero < 1 || numero > 9999) {
      els.errorConfigNotifExp.textContent = 'Captura una cantidad válida (mínimo 1).';
      els.configNotifExpNumero.focus();
      return;
    }
    const regla = `${numero}${unidad}`;
    if (reglasExpiracionProductos.includes(regla)) {
      els.errorConfigNotifExp.textContent = `Ya existe una regla para ${humanizarReglaExpiracion(regla)}.`;
      return;
    }
    if (reglasExpiracionProductos.length >= 5) {
      els.errorConfigNotifExp.textContent = 'Máximo 5 reglas de aviso.';
      return;
    }
    const guardado = await guardarReglasExpiracion([...reglasExpiracionProductos, regla]);
    if (guardado) els.configNotifExpNumero.value = '1';
  });

  els.configNotifExpLista.addEventListener('click', (e) => {
    const btn = e.target.closest('.regla-exp-chip-quitar');
    if (!btn) return;
    const li = btn.closest('.regla-exp-chip');
    const regla = li && li.dataset.regla;
    if (!regla) return;
    els.errorConfigNotifExp.textContent = '';
    const restante = reglasExpiracionProductos.filter((r) => r !== regla);
    if (restante.length === 0) {
      els.errorConfigNotifExp.textContent = 'Agrega al menos una regla — no se puede dejar la lista vacía.';
      return;
    }
    guardarReglasExpiracion(restante);
  });

  // Clave de localStorage por cuenta+tenant (mismo patrón que
  // claveOnboarding()/claveBorradorOrden()) — las cuentas ADMIN_USERS
  // (perfil super) no tienen fila en la tabla `usuarios`, así que no hay
  // dónde guardar esto en el servidor sin una tabla nueva.
  function claveNotifTicketsOcultar() {
    return `notif_tickets_ocultar_v1_${TENANT_SLUG || 'base'}_${usuarioSesionActual || ''}`;
  }

  async function cargarConfigGlobal(opciones = {}) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const zonas = await obtenerZonasHorarias();
      const res = await fetch(`${API_BASE}/admin/config/global`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const config = await res.json();
      els.configIva.value = config.iva_porcentaje;
      els.configOrdenesHabilitado.checked = config.ordenes_compra_habilitado;
      els.configEntregaDefaultRadios.forEach((radio) => {
        radio.checked = radio.value === (config.entrega_venta_default || 'sinticket');
      });
      ordenMetodoPagoDefault = ['efectivo', 'transferencia', 'tarjeta_credito', 'tarjeta_debito'].includes(config.metodo_pago_venta_default)
        ? config.metodo_pago_venta_default
        : 'efectivo';
      els.configMetodoPagoDefaultRadios.forEach((radio) => {
        radio.checked = radio.value === ordenMetodoPagoDefault;
      });
      if (els.configFolioConciliacionPrefijo && !els.configFolioConciliacionPrefijo.matches(':focus')) {
        els.configFolioConciliacionPrefijo.value = config.folio_conciliacion_prefijo || 'CV';
        if (els.configFolioPreviewValor) els.configFolioPreviewValor.textContent = `${config.folio_conciliacion_prefijo || 'CV'}0001`;
      }
      els.configAuditoriaHabilitada.checked = config.auditoria_habilitada !== false;
      els.configNotifTicketsPermiteOcultar.checked = config.notif_tickets_permite_ocultar !== false;
      notifTicketsPermiteOcultarGlobalmente = config.notif_tickets_permite_ocultar !== false;
      reglasExpiracionProductos = Array.isArray(config.notif_reglas_expiracion_productos) && config.notif_reglas_expiracion_productos.length > 0
        ? config.notif_reglas_expiracion_productos
        : ['30d'];
      renderReglasExpiracionChips();
      aplicarClaveSatCargada(config.clave_sat || '');
      cargarInfoCatalogoClaveSat();
      aplicarRegimenFiscalCompaniaBox(config.regimen_fiscal_compania);
      aplicarRazonSocialCompaniaBox(config.razon_social_compania);
      aplicarVisibilidadOrdenesCompra(config.ordenes_compra_habilitado);
      aplicarVisibilidadAuditoria(config.auditoria_habilitada !== false);
      aplicarInfoFiscalBarra(config);
      // Solo se revisa (y se muestra la ventana emergente si hace falta)
      // justo al iniciar sesión — no cada vez que se abre esta misma
      // tarjeta de configuración, donde ya estarían viendo los campos a
      // la vista para corregirlos; repetir el aviso ahí sería redundante.
      if (opciones.verificarFiscalFaltante) {
        verificarDatosFiscalesFaltantes(config);
      }
      poblarSelectZonasHorarias(els.configZonaHoraria, zonas, config.zona_horaria);
    } catch (err) {
      // El formulario se queda con lo que ya tenia; el administrador puede reintentar.
    }
  }

  function setGuardarConfigGlobalLoading(isLoading) {
    els.btnGuardarConfigGlobal.disabled = isLoading;
    els.btnGuardarConfigGlobalLabel.textContent = isLoading ? 'Guardando…' : 'Guardar cambios';
  }

  els.btnGuardarConfigGlobal.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.globalConfigError.textContent = '';
    setFieldError('config-iva', '');
    setFieldError('config-clave-sat', '');

    const iva = Number(els.configIva.value);
    if (!Number.isFinite(iva) || iva < 0 || iva > 100) {
      setFieldError('config-iva', 'El IVA debe ser un número entre 0 y 100.');
      return;
    }

    // El RFC de la compañía y el régimen fiscal ya NO se validan/mandan
    // aquí — se leen automáticamente de la constancia (ver el botón
    // "Subir constancia de situación fiscal" más arriba). Este botón
    // "Guardar cambios" solo sigue siendo responsable de IVA, zona
    // horaria, el interruptor de Ventas y la Clave SAT.
    const claveSat = els.configClaveSat.value.trim();
    if (claveSat && !/^\d{8}$/.test(claveSat)) {
      setFieldError('config-clave-sat', 'La Clave SAT debe ser exactamente 8 dígitos.');
      return;
    }

    setGuardarConfigGlobalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/config/global`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iva_porcentaje: iva,
          zona_horaria: els.configZonaHoraria.value,
          ordenes_compra_habilitado: els.configOrdenesHabilitado.checked,
          clave_sat: claveSat,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.globalConfigError.textContent = data.error || 'No se pudo guardar la configuración.';
        return;
      }
      showToast('Configuración guardada.');
      aplicarVisibilidadOrdenesCompra(els.configOrdenesHabilitado.checked);
      // Se usa la respuesta completa del servidor (no solo lo que se
      // acaba de mandar) porque también trae rfc_compania/
      // tipo_persona_compania — datos que este formulario ya no toca,
      // pero que la barra de sesión sigue necesitando para mostrarse
      // completa.
      aplicarInfoFiscalBarra(data);
    } catch (err) {
      els.globalConfigError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setGuardarConfigGlobalLoading(false);
    }
  });

  // ---------- Subir constancia de situación fiscal de la compañía ----------
  // Reutiliza el mismo endpoint de extracción de PDF que ya usa la
  // constancia de un cliente — aquí solo cambia a dónde van a parar los
  // datos extraídos (la configuración global, no un registro de
  // cliente).
  els.btnSubirConstanciaCompania.addEventListener('click', () => {
    els.constanciaCompaniaInput.click();
  });

  els.constanciaCompaniaInput.addEventListener('change', async () => {
    const archivo = els.constanciaCompaniaInput.files[0];
    if (!archivo) return;

    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.errorConstanciaCompania.textContent = '';
    els.btnSubirConstanciaCompania.disabled = true;
    els.btnSubirConstanciaCompaniaLabel.textContent = 'Leyendo constancia…';

    const formData = new FormData();
    formData.append('archivo', archivo);

    try {
      const res = await fetch(`${API_BASE}/admin/config/constancia-compania`, {
        method: 'POST',
        headers: { Authorization: authHeader },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.errorConstanciaCompania.textContent = data.error || 'No se pudo procesar la constancia.';
        return;
      }

      // La respuesta ya trae la configuración completa actualizada
      // (rfc_compania, regimen_fiscal_compania, tipo_persona_compania,
      // y el resto sin cambios) — se aplica de inmediato a la barra de
      // sesión y a la caja de régimen fiscal, sin esperar a que se
      // vuelva a abrir esta tarjeta.
      aplicarInfoFiscalBarra(data);
      aplicarRegimenFiscalCompaniaBox(data.regimen_fiscal_compania);
      aplicarRazonSocialCompaniaBox(data.razon_social_compania);

      const tipoPersonaTexto = textoTipoPersona(data.tipo_persona_compania);
      showToast(
        `Constancia leída correctamente — RFC ${data.rfc_compania}${tipoPersonaTexto ? ` (${tipoPersonaTexto})` : ''}.`
      );
    } catch (err) {
      els.errorConstanciaCompania.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      els.btnSubirConstanciaCompania.disabled = false;
      els.btnSubirConstanciaCompaniaLabel.textContent = 'Subir constancia de situación fiscal';
      els.constanciaCompaniaInput.value = ''; // permite volver a seleccionar el mismo archivo si hace falta
    }
  });

  // ---------- Configuración Reportes ----------

  els.btnToggleReportesConfig.addEventListener('click', () => {
    const abierto = els.btnToggleReportesConfig.getAttribute('aria-expanded') === 'true';
    els.btnToggleReportesConfig.setAttribute('aria-expanded', String(!abierto));
    els.reportesConfigBody.hidden = abierto;
  });

  async function cargarConfigReportes() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/config/global`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const config = await res.json();
      els.configCorreoReportes.value = config.correo_reportes || '';
      // Punto 186 (+ homologación sitio base): "Contacto con clientes" ya
      // se muestra siempre — con tenant es obligatorio y viaja a
      // control_tenants; sin tenant (sitio base) es opcional y viaja a la
      // config local. El texto de ayuda y la regla de guardado cambian
      // según cuál sea.
      contactoClienteTenantActivo = !!config.tenant_activo;
      els.configContactoCliente.value = config.contacto_email_cliente || '';
      els.contactoClienteHint.textContent = contactoClienteTenantActivo
        ? 'A este correo llegan las aclaraciones que un cliente manda desde el portal sobre sus movimientos con la empresa ("Solicitar aclaraciones"). Es el mismo dato que se edita en /control — cambiarlo aquí o allá actualiza lo mismo. No se puede dejar vacío.'
        : 'A este correo llegan las aclaraciones que un cliente del sitio base manda desde el portal ("Solicitar aclaraciones"). Es opcional — mientras esté vacío, esa opción no aparece en el portal.';
    } catch (err) {
      // El formulario se queda con lo que ya tenía; se puede reintentar guardando de nuevo.
    }
  }

  els.btnGuardarConfigReportes.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.reportesConfigError.textContent = '';
    setFieldError('config-correo-reportes', '');

    const correoReportes = els.configCorreoReportes.value.trim();
    if (correoReportes && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoReportes)) {
      setFieldError('config-correo-reportes', 'Captura un correo válido.');
      return;
    }

    els.btnGuardarConfigReportes.disabled = true;
    els.btnGuardarConfigReportesLabel.textContent = 'Guardando…';
    try {
      const res = await fetch(`${API_BASE}/admin/config/global`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo_reportes: correoReportes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.reportesConfigError.textContent = data.error || 'No se pudo guardar la configuración.';
        return;
      }
      showToast('Configuración de reportes guardada.');
    } catch (err) {
      els.reportesConfigError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      els.btnGuardarConfigReportes.disabled = false;
      els.btnGuardarConfigReportesLabel.textContent = 'Guardar cambios';
    }
  });

  // Punto 186: "Correo de contacto de la empresa" — con tenant, mismo dato
  // que control_tenants.tenants.contacto_email (el que edita /control),
  // endpoint propio porque escribe en otra base, obligatorio; sin tenant
  // (sitio base) escribe en la config local de este mismo tenant, opcional
  // (ver contactoClienteTenantActivo).
  els.btnGuardarContactoCliente.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.contactoClienteError.textContent = '';
    setFieldError('config-contacto-cliente', '');

    const contactoCliente = els.configContactoCliente.value.trim();
    if (!contactoCliente && contactoClienteTenantActivo) {
      setFieldError('config-contacto-cliente', 'El correo de contacto es obligatorio.');
      return;
    }
    if (contactoCliente && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactoCliente)) {
      setFieldError('config-contacto-cliente', 'Captura un correo válido.');
      return;
    }

    els.btnGuardarContactoCliente.disabled = true;
    els.btnGuardarContactoClienteLabel.textContent = 'Guardando…';
    try {
      const res = await fetch(`${API_BASE}/admin/config/contacto-cliente`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacto_email: contactoCliente }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.contactoClienteError.textContent = data.error || 'No se pudo guardar el correo de contacto.';
        return;
      }
      els.configContactoCliente.value = data.contacto_email || contactoCliente;
      showToast('Correo de contacto guardado.');
    } catch (err) {
      els.contactoClienteError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      els.btnGuardarContactoCliente.disabled = false;
      els.btnGuardarContactoClienteLabel.textContent = 'Guardar correo de contacto';
    }
  });

  els.btnEnviarReporteManual.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.errorEnviarReporteManual.textContent = '';
    els.btnEnviarReporteManual.disabled = true;
    els.btnEnviarReporteManualLabel.textContent = 'Enviando…';
    try {
      const res = await fetch(`${API_BASE}/admin/reportes/enviar`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.errorEnviarReporteManual.textContent = data.error || 'No se pudo enviar el reporte.';
        return;
      }
      // El reporte SIEMPRE se genera y se guarda con éxito en este punto
      // (un error real de envío ya se habría cortado arriba, en el
      // "if (!res.ok)") — lo único que puede variar es si además se
      // mandó por correo o no, según haya un correo de reportes
      // configurado. Ninguno de los dos casos es un error.
      if (data.correoEnviado) {
        showToast(`Reporte generado y enviado a ${data.correoDestino}.`);
      } else {
        showToast('Reporte generado y guardado — configura un correo de reportes arriba para también enviarlo por correo.');
      }
    } catch (err) {
      els.errorEnviarReporteManual.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      els.btnEnviarReporteManual.disabled = false;
      els.btnEnviarReporteManualLabel.textContent = 'Enviar reporte';
    }
  });

  // ---------- Lectura de reportes ----------

  let reportesDisponibles = [];
  let reporteSeleccionadoId = '';

  function formatearFechaCorta(fechaISO) {
    if (!fechaISO) return '—';
    const fecha = new Date(fechaISO);
    if (Number.isNaN(fecha.getTime())) return '—';
    return fecha.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function cargarListaReportes() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/reportes`, { headers: { Authorization: authHeader } });
      if (!res.ok) return;
      const data = await res.json();
      reportesDisponibles = data.reportes || [];

      // Punto 169: los cortes de ventas ya no aparecen en este selector —
      // tienen su propia pestaña ("Cortes"), para no mezclar 4 tipos
      // distintos en una sola lista plana que solo crece.
      els.reportesSelector.innerHTML = '<option value="">Selecciona un reporte…</option>';
      reportesDisponibles
        .filter((r) => r.tipo !== 'corte')
        .forEach((r) => {
          const option = document.createElement('option');
          option.value = r.id;
          const tipoTexto = r.tipo === 'automatico' ? 'Automático' : r.tipo === 'cierre_mensual' ? 'Cierre mensual' : 'Manual';
          option.textContent = `${formatearFechaCorta(r.fecha_generacion)} — ${tipoTexto} (${r.total_tickets} tickets, ${r.total_ordenes} ventas, ${r.total_gastos} gastos)`;
          els.reportesSelector.appendChild(option);
        });

      renderListaCortes();
    } catch (err) {
      // El selector se queda vacío; se puede reintentar cambiando de vista.
    }
  }

  // Solo administrador/super pueden borrar un reporte (ya lo exige el
  // backend en las 5 rutas de /admin/reportes con
  // requireAdminArea('administrador')) — este chequeo en frontend es
  // defensa en profundidad: oculta el botón directamente en vez de
  // dejar que alguien lo vea deshabilitado o lo intente y reciba un 403.
  function puedeEliminarReporte() {
    return perfilActual === 'administrador' || !RESTRICCIONES_PERFIL[perfilActual];
  }

  // KPIs de auditoría (histórico completo, no de un reporte en
  // particular) — tarjetas arriba de la vista, se cargan una sola vez al
  // entrar. Serie mensual en CSS puro, mismo patrón de barras que
  // Resumen financiero; una sola serie no necesita leyenda (el título de
  // la tarjeta ya la nombra).
  async function cargarEstadisticasReportes() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    Esqueleto.marcarKpisCargando(els.reportesKpiGrid, true);
    try {
      const res = await fetch(`${API_BASE}/admin/reportes/estadisticas`, { headers: { Authorization: authHeader } });
      if (!res.ok) {
        Esqueleto.marcarKpisCargando(els.reportesKpiGrid, false);
        return;
      }
      const data = await res.json();
      els.reportesKpiEliminados.textContent = data.total_eliminados || 0;
      els.reportesKpiActivos.textContent = data.total_activos || 0;

      const serie = data.eliminados_por_mes || [];
      els.reportesKpiChartEmpty.hidden = serie.length > 0;
      els.reportesKpiChartBody.innerHTML = '';
      if (serie.length === 0) {
        Esqueleto.marcarKpisCargando(els.reportesKpiGrid, false);
        return;
      }
      const maximo = Math.max(1, ...serie.map((m) => m.total));
      serie.forEach((m) => {
        const columna = document.createElement('div');
        columna.className = 'resumen-fin-chart-columna';
        columna.innerHTML = `
          <div class="resumen-fin-chart-barras" role="img" aria-label="${escapeHtml(m.mes)}: ${m.total} eliminados">
            <span class="resumen-fin-chart-barra resumen-fin-chart-barra-eliminado-reportes" style="height:${(m.total / maximo) * 100}%" data-tooltip="${escapeHtml(m.mes)}: ${m.total} eliminados"></span>
          </div>
          <span class="resumen-fin-chart-etiqueta">${escapeHtml(m.mes)}</span>
        `;
        els.reportesKpiChartBody.appendChild(columna);
      });
      Esqueleto.marcarKpisCargando(els.reportesKpiGrid, false);
    } catch (err) {
      // Las tarjetas se quedan en su valor por defecto (0 / vacío); se puede reintentar cambiando de vista.
      Esqueleto.marcarKpisCargando(els.reportesKpiGrid, false);
    }
  }

  function limpiarVistaLecturaReportes() {
    els.lecturaReportesResumen.hidden = true;
    els.lecturaReportesFiltros.hidden = true;
    els.reportesMovimientosWrap.hidden = true;
    els.reportesEliminadosWrap.hidden = true;
    els.lecturaReportesSinSeleccion.hidden = false;
    els.btnVerMdReporte.disabled = true;
    els.btnEliminarReporte.disabled = true;
  }

  function obtenerFiltrosReporteActuales() {
    const params = new URLSearchParams();
    if (els.filtroReporteTipo.value) params.set('tipo_registro', els.filtroReporteTipo.value);
    if (els.filtroReporteEstatus.value) params.set('estatus', els.filtroReporteEstatus.value);
    if (els.filtroReporteRfc.value.trim()) params.set('rfc', els.filtroReporteRfc.value.trim());
    if (els.filtroReporteFechaDesde.value) params.set('fecha_desde', els.filtroReporteFechaDesde.value);
    if (els.filtroReporteFechaHasta.value) params.set('fecha_hasta', els.filtroReporteFechaHasta.value);
    return params;
  }

  // Fila de una tabla de reporte — "Detalle" (antes "Estatus") usa el
  // mismo sistema de badges de color que Tickets/Ventas para un ticket
  // (estatus real, enum cerrado); una venta guarda "concepto" ahí, texto
  // libre sin enum, así que se muestra tal cual.
  const ESTATUS_BADGE_CLASE = {
    pendiente: 'estatus-pendiente',
    en_curso: 'estatus-en-curso',
    cancelado: 'estatus-cancelado',
    listo: 'estatus-listo',
  };
  const TIPO_REGISTRO_ETIQUETA = {
    ticket: 'Ticket',
    orden_compra: 'Ventas',
    gasto: 'Gasto',
  };
  function renderDetalleItemReporte(item) {
    if (item.tipo_registro === 'ticket' && ESTATUS_BADGE_CLASE[item.estatus_o_concepto]) {
      return `<span class="estatus-badge ${ESTATUS_BADGE_CLASE[item.estatus_o_concepto]}">${escapeHtml(item.estatus_o_concepto)}</span>`;
    }
    return escapeHtml(item.estatus_o_concepto || '—');
  }

  // Tipo de reporte de origen (solo real: viene del JOIN a "reportes" que
  // ya hace el backend en el ledger cruzado) — nunca inventar un motivo de
  // baja que el sistema no registra de verdad.
  const REPORTE_TIPO_ETIQUETA = {
    automatico: 'Automático',
    manual: 'Manual',
    cierre_mensual: 'Cierre mensual',
    corte: 'Corte de ventas',
  };

  // "conOrigen" agrega la columna "Reporte de origen" — solo la usa el
  // ledger cruzado (varios reportes a la vez); dentro de un solo reporte
  // sobra, ya sabes de cuál es.
  function renderFilaReporteItem(item, conOrigen) {
    const tipoOrigenEtiqueta = REPORTE_TIPO_ETIQUETA[item.reporte_tipo];
    const celdaOrigen = conOrigen
      ? `<td data-label="Reporte de origen">
          ${formatearFechaCorta(item.reporte_fecha_generacion)}
          ${tipoOrigenEtiqueta ? `<span class="reportes-origen-badge">${escapeHtml(tipoOrigenEtiqueta)}</span>` : ''}
        </td>`
      : '';
    return `
      <tr>
        <td data-label="Tipo">${TIPO_REGISTRO_ETIQUETA[item.tipo_registro] || item.tipo_registro}</td>
        <td data-label="Identificador">
          <span class="reportes-id-pill">${escapeHtml(item.identificador)}</span>
          <button type="button" class="btn-ver-historial" data-tipo="${item.tipo_registro}" data-identificador="${escapeHtml(item.identificador)}" data-tooltip="Ver historial en todos los reportes" aria-label="Ver historial de ${escapeHtml(item.identificador)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
          </button>
        </td>
        <td data-label="RFC / Correo">${escapeHtml(item.rfc || '—')}</td>
        <td data-label="Detalle">${renderDetalleItemReporte(item)}</td>
        <td data-label="Monto">${item.monto === null ? '—' : `<span class="reportes-monto-valor">$${formatearMoneda(item.monto)}</span><span class="reportes-monto-sub">MXN</span>`}</td>
        <td data-label="Atendido por">${escapeHtml(item.atendido_por || '—')}</td>
        <td data-label="Fecha de registro">${formatearFechaCorta(item.fecha_registro)}</td>
        ${celdaOrigen}
      </tr>
    `;
  }

  // Divide los items ya cargados (una sola petición, sin filtrar por
  // "accion" del lado del servidor) en 2 tablas separadas — pedido
  // explícito del usuario para auditoría: un "Eliminado" no debe leerse
  // mezclado entre registros que siguen activos, aunque ambos vengan del
  // mismo reporte.
  function renderReporteItems(items) {
    const movimientos = items.filter((i) => i.accion !== 'eliminado');
    const eliminados = items.filter((i) => i.accion === 'eliminado');

    els.reportesMovimientosWrap.hidden = false;
    els.reportesMovimientosConteo.textContent = movimientos.length;
    els.reportesMovimientosTableBody.innerHTML = movimientos.map((item) => renderFilaReporteItem(item, false)).join('');
    els.reportesMovimientosEmpty.hidden = movimientos.length > 0;

    els.reportesEliminadosWrap.hidden = false;
    els.reportesEliminadosConteo.textContent = eliminados.length;
    els.reportesEliminadosTableBody.innerHTML = eliminados.map((item) => renderFilaReporteItem(item, false)).join('');
    els.reportesEliminadosEmpty.hidden = eliminados.length > 0;

    const totalEliminadosMonto = eliminados.reduce((acc, item) => acc + (Number(item.monto) || 0), 0);
    els.reportesEliminadosTotalMonto.hidden = eliminados.length === 0;
    els.reportesEliminadosTotalMonto.textContent = `Total eliminados: ${eliminados.length} registro${eliminados.length === 1 ? '' : 's'} ($${formatearMoneda(totalEliminadosMonto)})`;
  }

  // "Generado por" (idea C de auditoría) — no viene en la lista de
  // reportes (GET /reportes), se resuelve aparte, solo al seleccionar
  // uno, cruzando con admin_auditoria en el backend. Un reporte
  // automático nunca tiene actor (cron sin sesión), así que ni se pide.
  async function cargarGeneradoPorReporte(id, tipoReporte) {
    if (tipoReporte === 'automatico') {
      els.resumenReporteGeneradoPor.textContent = 'Automático (retención, sin sesión de un admin)';
      return;
    }
    els.resumenReporteGeneradoPor.textContent = '—';
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/reportes/${id}/generado-por`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();
      // Puede llegar tarde si la persona ya cambió de reporte mientras
      // esta petición seguía en vuelo — no pisar el resumen equivocado.
      if (reporteSeleccionadoId !== String(id)) return;
      els.resumenReporteGeneradoPor.textContent = data.actor
        ? `${data.actor}${data.perfil ? ` (${data.perfil})` : ''}`
        : 'Sin coincidencia en la auditoría';
    } catch (err) {
      els.resumenReporteGeneradoPor.textContent = '—';
    }
  }

  // ---------- Ledger cruzado de eliminados (idea B) ----------
  // A diferencia de "Por reporte" (arriba), esta pestaña no depende de
  // seleccionar un reporte — junta los eliminados de TODOS los reportes
  // en una sola tabla filtrable, con su reporte de origen visible.

  function obtenerFiltrosLedgerActuales() {
    const params = new URLSearchParams();
    if (els.ledgerFiltroTipo.value) params.set('tipo_registro', els.ledgerFiltroTipo.value);
    if (els.ledgerFiltroEstatus.value) params.set('estatus', els.ledgerFiltroEstatus.value);
    if (els.ledgerFiltroRfc.value.trim()) params.set('rfc', els.ledgerFiltroRfc.value.trim());
    if (els.ledgerFiltroFechaDesde.value) params.set('fecha_desde', els.ledgerFiltroFechaDesde.value);
    if (els.ledgerFiltroFechaHasta.value) params.set('fecha_hasta', els.ledgerFiltroFechaHasta.value);
    return params;
  }

  async function cargarLedgerEliminados() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    Esqueleto.aplicarEsqueletoTabla(els.ledgerTableBody, 8);
    try {
      const params = obtenerFiltrosLedgerActuales();
      const res = await fetch(`${API_BASE}/admin/reportes/eliminados?${params.toString()}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.ledgerTableBody, 8, 'No se pudo cargar "Todo lo eliminado".', cargarLedgerEliminados);
        return;
      }
      const data = await res.json();
      const items = data.items || [];
      els.ledgerConteo.textContent = items.length;
      els.ledgerTableBody.innerHTML = items.map((item) => renderFilaReporteItem(item, true)).join('');
      els.ledgerEmpty.hidden = items.length > 0;
      Esqueleto.quitarEsqueletoTabla(els.ledgerTableBody);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.ledgerTableBody, 8, 'No se pudo conectar con el servidor.', cargarLedgerEliminados);
    }
    renderFiltrosChips(els.ledgerFiltrosChips, [
      { etiqueta: 'Tipo', valor: textoOpcionSeleccionada(els.ledgerFiltroTipo), campos: [els.ledgerFiltroTipo] },
      { etiqueta: 'Estatus', valor: textoOpcionSeleccionada(els.ledgerFiltroEstatus), campos: [els.ledgerFiltroEstatus] },
      { etiqueta: 'RFC / correo', valor: els.ledgerFiltroRfc.value.trim(), campos: [els.ledgerFiltroRfc] },
      { etiqueta: 'Fechas', valor: (els.ledgerFiltroFechaDesde.value || els.ledgerFiltroFechaHasta.value) ? `${els.ledgerFiltroFechaDesde.value || '…'} – ${els.ledgerFiltroFechaHasta.value || '…'}` : '', campos: [els.ledgerFiltroFechaDesde, els.ledgerFiltroFechaHasta] },
    ]);
  }

  [els.ledgerFiltroTipo, els.ledgerFiltroEstatus, els.ledgerFiltroFechaDesde, els.ledgerFiltroFechaHasta].forEach((el) => {
    el.addEventListener('change', () => cargarLedgerEliminados());
  });
  let timeoutFiltroRfcLedger = null;
  els.ledgerFiltroRfc.addEventListener('input', () => {
    clearTimeout(timeoutFiltroRfcLedger);
    timeoutFiltroRfcLedger = setTimeout(() => cargarLedgerEliminados(), 350);
  });
  els.btnLimpiarFiltrosLedger.addEventListener('click', () => {
    els.ledgerFiltroTipo.value = '';
    els.ledgerFiltroEstatus.value = '';
    els.ledgerFiltroRfc.value = '';
    els.ledgerFiltroFechaDesde.value = '';
    els.ledgerFiltroFechaHasta.value = '';
    cargarLedgerEliminados();
  });

  async function exportarLedger(formato) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const params = obtenerFiltrosLedgerActuales();
      params.set('formato', formato);
      const res = await fetch(`${API_BASE}/admin/reportes/eliminados-exportar?${params.toString()}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        showToast('No se pudo exportar.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eliminados-historico.${formato === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('No se pudo exportar.');
    }
  }
  els.btnExportarLedgerCsv.addEventListener('click', () => exportarLedger('csv'));
  els.btnExportarLedgerExcel.addEventListener('click', () => exportarLedger('excel'));

  // ---------- Cortes de ventas (punto 169) ----------
  // Pestaña propia, separada de "Por reporte" — un corte nunca borra
  // nada, así que su detalle es más simple que el genérico (una sola
  // tabla de ventas, sin split Movimientos/Eliminados). "renderFilaReporteItem"
  // se reusa tal cual (misma forma de item que cualquier otro reporte), y
  // el botón "Ver historial" de cada fila ya funciona solo — está
  // delegado a nivel documento (ver más abajo), no hace falta engancharlo
  // de nuevo aquí.

  let corteSeleccionadoId = '';
  let corteDetalleItems = [];
  let corteDetallePagina = 1;
  const CORTE_DETALLE_POR_PAGINA = 12;

  function formatearFechaSoloDia(fechaISO) {
    if (!fechaISO) return '—';
    const fecha = new Date(fechaISO);
    if (Number.isNaN(fecha.getTime())) return '—';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Búsqueda 100% client-side (mismo criterio que los filtros de
  // Ventas/Constancias) — un corte ya trae todos sus items en una sola
  // petición, sin paginar del lado del servidor.
  function corteDetalleItemsFiltrados() {
    const texto = (els.cortesDetalleBuscar.value || '').trim().toLowerCase();
    if (!texto) return corteDetalleItems;
    return corteDetalleItems.filter((item) => {
      const campos = [item.identificador, item.rfc, item.estatus_o_concepto, item.atendido_por];
      return campos.some((campo) => String(campo || '').toLowerCase().includes(texto));
    });
  }

  function renderPaginacionCorteDetalle(totalPaginas) {
    if (totalPaginas <= 1) {
      els.cortesDetallePaginacion.hidden = true;
      els.cortesDetallePaginacion.innerHTML = '';
      return;
    }
    els.cortesDetallePaginacion.hidden = false;
    const botones = [];
    botones.push(
      `<button type="button" class="btn btn-secondary" data-pagina="${corteDetallePagina - 1}" ${corteDetallePagina <= 1 ? 'disabled' : ''}>← Anterior</button>`
    );
    for (let p = 1; p <= totalPaginas; p += 1) {
      botones.push(
        `<button type="button" class="lectura-reportes-pagina-btn${p === corteDetallePagina ? ' is-active' : ''}" data-pagina="${p}">${p}</button>`
      );
    }
    botones.push(
      `<button type="button" class="btn btn-secondary" data-pagina="${corteDetallePagina + 1}" ${corteDetallePagina >= totalPaginas ? 'disabled' : ''}>Siguiente →</button>`
    );
    els.cortesDetallePaginacion.innerHTML = botones.join('');
  }

  function renderCorteDetalleTabla() {
    const filtrados = corteDetalleItemsFiltrados();
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / CORTE_DETALLE_POR_PAGINA));
    corteDetallePagina = Math.min(corteDetallePagina, totalPaginas);
    const inicio = (corteDetallePagina - 1) * CORTE_DETALLE_POR_PAGINA;
    const pagina = filtrados.slice(inicio, inicio + CORTE_DETALLE_POR_PAGINA);

    els.reportesCortesDetalleTableBody.innerHTML = pagina.map((item) => renderFilaReporteItem(item, false)).join('');
    els.reportesCortesDetalleEmpty.hidden = corteDetalleItems.length > 0;
    els.reportesCortesDetalleSinResultados.hidden = !(corteDetalleItems.length > 0 && filtrados.length === 0);
    renderPaginacionCorteDetalle(totalPaginas);
  }

  els.cortesDetalleBuscar.addEventListener('input', () => {
    corteDetallePagina = 1;
    renderCorteDetalleTabla();
  });
  els.cortesDetallePaginacion.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-pagina]');
    if (!boton || boton.disabled) return;
    const pagina = Number(boton.dataset.pagina);
    if (!Number.isFinite(pagina) || pagina < 1) return;
    corteDetallePagina = pagina;
    renderCorteDetalleTabla();
  });

  els.btnCortesIrVentas.addEventListener('click', () => cambiarVistaPrincipal('ordenes'));

  function renderListaCortes() {
    const cortes = reportesDisponibles.filter((r) => r.tipo === 'corte');
    els.reportesCortesEmpty.hidden = cortes.length > 0;
    els.reportesCortesTableBody.innerHTML = cortes
      .map(
        (r) => `
        <tr>
          <td data-label="Generado">
            <button type="button" class="orden-numero-link" data-corte-id="${r.id}">${formatearFechaCorta(r.fecha_generacion)}</button>
          </td>
          <td data-label="Rango cubierto">${formatearFechaSoloDia(r.rango_inicio)} – ${formatearFechaSoloDia(r.rango_fin)}</td>
          <td data-label="Ventas">${r.total_ordenes}</td>
          <td data-label="Total">${r.total_monto === null || r.total_monto === undefined ? '—' : `$${formatearMoneda(r.total_monto)}`}</td>
        </tr>`
      )
      .join('');
  }

  async function abrirDetalleCorte(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    const reporte = reportesDisponibles.find((r) => String(r.id) === String(id));
    if (!reporte) return;

    corteSeleccionadoId = String(id);
    els.cortesDetalleRango.textContent = `${formatearFechaSoloDia(reporte.rango_inicio)} – ${formatearFechaSoloDia(reporte.rango_fin)}`;
    els.cortesDetalleFecha.textContent = formatearFechaCorta(reporte.fecha_generacion);
    els.cortesDetalleVentas.textContent = reporte.total_ordenes;
    els.cortesDetalleTotal.textContent =
      reporte.total_monto === null || reporte.total_monto === undefined ? '—' : `$${formatearMoneda(reporte.total_monto)}`;
    els.btnEliminarCorte.hidden = !puedeEliminarReporte();

    els.reportesCortesListaWrap.hidden = true;
    els.reportesCortesDetalleWrap.hidden = false;
    els.cortesDetalleBuscar.value = '';
    corteDetallePagina = 1;

    try {
      const res = await fetch(`${API_BASE}/admin/reportes/${id}/items`, { headers: { Authorization: authHeader } });
      if (!res.ok) return;
      const data = await res.json();
      corteDetalleItems = data.items || [];
      els.cortesDetalleConteo.textContent = corteDetalleItems.length;
      renderCorteDetalleTabla();
    } catch (err) {
      // La tabla se queda vacía; se puede reintentar volviendo a abrir el detalle.
    }
  }

  function volverListaCortes() {
    corteSeleccionadoId = '';
    corteDetalleItems = [];
    els.reportesCortesDetalleWrap.hidden = true;
    els.reportesCortesListaWrap.hidden = false;
  }

  els.reportesCortesTableBody.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-corte-id]');
    if (boton) abrirDetalleCorte(boton.dataset.corteId);
  });
  els.btnCortesVolverLista.addEventListener('click', volverListaCortes);

  // Imprime un corte YA GUARDADO (historial de "Cortes"), a diferencia de
  // #btn-imprimir-corte (Ventas) que imprime el corte recién generado —
  // reusa el mismo elemento #corte-imprimir/CSS de impresión, con los
  // únicos datos que un corte histórico sí conserva (rango, total,
  // conteo y sus items) — sin el desglose de IVA/facturado/cobrado, que
  // no se guarda por corte.
  els.btnImprimirCorteHistorico.addEventListener('click', () => {
    if (!corteDetalleItems.length && els.cortesDetalleConteo.textContent === '0') {
      const filasVacias = '<tr><td colspan="5">Sin ventas en este rango.</td></tr>';
      els.corteImprimir.innerHTML = `
        <div class="corte-imprimir-titulo">Corte de ventas</div>
        <div class="corte-imprimir-rango">${escapeHtml(els.cortesDetalleRango.textContent)}</div>
        <table class="corte-imprimir-tabla"><thead><tr><th>No.</th><th>Fecha</th><th>Correo</th><th>Detalle</th><th>Total</th></tr></thead><tbody>${filasVacias}</tbody></table>
      `;
      window.print();
      return;
    }
    const filasHtml = corteDetalleItems
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.identificador)}</td>
            <td>${formatearFechaCorta(item.fecha_registro)}</td>
            <td>${escapeHtml(item.rfc || 'Sin correo')}</td>
            <td>${renderDetalleItemReporte(item)}</td>
            <td>${item.monto === null ? '—' : `$${formatearMoneda(item.monto)}`}</td>
          </tr>`
      )
      .join('');
    els.corteImprimir.innerHTML = `
      <div class="corte-imprimir-titulo">Corte de ventas</div>
      <div class="corte-imprimir-rango">${escapeHtml(els.cortesDetalleRango.textContent)}</div>
      <div class="corte-imprimir-resumen">
        <div><span>Generado el</span><span>${escapeHtml(els.cortesDetalleFecha.textContent)}</span></div>
        <div><span>Ventas</span><span>${escapeHtml(els.cortesDetalleVentas.textContent)}</span></div>
        <div><span>Total</span><span>${escapeHtml(els.cortesDetalleTotal.textContent)}</span></div>
      </div>
      <table class="corte-imprimir-tabla">
        <thead><tr><th>No. Venta</th><th>Fecha</th><th>RFC / Correo</th><th>Detalle</th><th>Total</th></tr></thead>
        <tbody>${filasHtml}</tbody>
      </table>
    `;
    window.print();
  });

  async function exportarCorte(formato) {
    if (!corteSeleccionadoId) return;
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const params = new URLSearchParams({ formato });
      const res = await fetch(`${API_BASE}/admin/reportes/${corteSeleccionadoId}/exportar?${params.toString()}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        showToast('No se pudo exportar el corte.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `corte-${corteSeleccionadoId}.${formato === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('No se pudo exportar el corte.');
    }
  }
  els.btnExportarCorteCsv.addEventListener('click', () => exportarCorte('csv'));
  els.btnExportarCorteExcel.addEventListener('click', () => exportarCorte('excel'));

  // Punto 271: "Estado del inventario" — toolbar (imprimir/CSV), tabs
  // Top/Bottom y el botón del banner de capital inmovilizado.
  if (els.btnInvEstadoImprimir) els.btnInvEstadoImprimir.addEventListener('click', imprimirEstadoInventario);
  if (els.btnInvEstadoExportar) els.btnInvEstadoExportar.addEventListener('click', exportarEstadoInventarioCsv);
  if (els.btnInvEstadoRankTop && els.btnInvEstadoRankBottom) {
    els.btnInvEstadoRankTop.addEventListener('click', () => {
      els.btnInvEstadoRankTop.classList.add('is-active'); els.btnInvEstadoRankTop.setAttribute('aria-selected', 'true');
      els.btnInvEstadoRankBottom.classList.remove('is-active'); els.btnInvEstadoRankBottom.setAttribute('aria-selected', 'false');
      els.invEstadoTopLista.hidden = false; els.invEstadoBottomLista.hidden = true;
    });
    els.btnInvEstadoRankBottom.addEventListener('click', () => {
      els.btnInvEstadoRankBottom.classList.add('is-active'); els.btnInvEstadoRankBottom.setAttribute('aria-selected', 'true');
      els.btnInvEstadoRankTop.classList.remove('is-active'); els.btnInvEstadoRankTop.setAttribute('aria-selected', 'false');
      els.invEstadoBottomLista.hidden = false; els.invEstadoTopLista.hidden = true;
    });
  }
  if (els.invEstadoAlertaInmovilizadoBtn) {
    els.invEstadoAlertaInmovilizadoBtn.addEventListener('click', () => {
      const el = document.getElementById('inv-estado-matriz-riesgo');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  els.btnEliminarCorte.addEventListener('click', () => {
    if (!corteSeleccionadoId) return;
    const reporte = reportesDisponibles.find((r) => String(r.id) === String(corteSeleccionadoId));
    const etiqueta = reporte ? `del ${formatearFechaCorta(reporte.fecha_generacion)}` : '';
    abrirConfirmacion({
      titulo: '¿Eliminar este corte?',
      mensaje: `Se eliminará el corte ${etiqueta} de forma permanente, junto con todas sus ventas registradas en él. Esta acción no se puede deshacer.`,
      textoBoton: 'Eliminar',
      onConfirmar: async () => {
        const authHeader = getAuthHeader();
        if (!authHeader) {
          showLogin();
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/admin/reportes/${corteSeleccionadoId}`, {
            method: 'DELETE',
            headers: { Authorization: authHeader },
          });
          if (!res.ok) {
            showToast('No se pudo eliminar el corte.');
            return;
          }
          showToast('Corte eliminado.');
          reportesDisponibles = reportesDisponibles.filter((r) => String(r.id) !== String(corteSeleccionadoId));
          volverListaCortes();
          renderListaCortes();
        } catch (err) {
          showToast('No se pudo eliminar el corte.');
        }
      },
    });
  });

  // Punto 169: las 4 pestañas de "Lectura de reportes" comparten el mismo
  // mecanismo (activar botón + mostrar su contenedor + ocultar los otros
  // 3 + letrero de una línea) — un solo switcher genérico en vez de 4
  // handlers casi idénticos, y cada pestaña se encarga de su propia carga
  // perezosa (las estadísticas de auditoría y el estado del inventario no
  // se piden hasta que alguien de verdad entra a esa pestaña).
  const PESTANAS_REPORTES = {
    'por-reporte': {
      boton: 'btnReportesVistaPorReporte',
      vista: 'reportesVistaPorReporte',
      caption: 'Elige un reporte automático, manual o de cierre mensual para ver su contenido completo.',
    },
    cortes: {
      boton: 'btnReportesVistaCortes',
      vista: 'reportesVistaCortes',
      caption: 'Historial de cortes de ventas que has generado — consulta o imprime cualquiera de nuevo.',
      alEntrar: () => renderListaCortes(),
    },
    ledger: {
      boton: 'btnReportesVistaLedger',
      vista: 'reportesVistaLedger',
      caption: 'Todo lo que se ha borrado del sistema, cruzando todos los reportes — tu evidencia de auditoría.',
      alEntrar: () => {
        cargarLedgerEliminados();
        if (!reportesEstadisticasCargadas) {
          reportesEstadisticasCargadas = true;
          cargarEstadisticasReportes();
        }
      },
    },
    'estado-inventario': {
      boton: 'btnReportesVistaEstadoInventario',
      vista: 'reportesVistaEstadoInventario',
      caption: 'Salud de tu inventario ahora mismo: qué se vende, qué no se mueve y cuánto vale.',
      alEntrar: () => {
        if (!invEstadoCargado) {
          invEstadoCargado = true;
          cargarEstadoInventario();
        }
      },
    },
  };
  let invEstadoCargado = false;
  let reportesEstadisticasCargadas = false;

  function activarPestanaReportes(nombre) {
    const activa = PESTANAS_REPORTES[nombre];
    Object.entries(PESTANAS_REPORTES).forEach(([clave, def]) => {
      const esActiva = clave === nombre;
      els[def.boton].classList.toggle('is-active', esActiva);
      els[def.boton].setAttribute('aria-selected', String(esActiva));
      els[def.vista].hidden = !esActiva;
    });
    els.reportesTabCaption.textContent = activa.caption;
    // Punto 271: Imprimir/Descargar CSV viven junto a las pestañas (no
    // dentro del contenedor de "Estado del inventario"), así que su
    // visibilidad ya no la resuelve el hidden del contenedor padre.
    if (els.invEstadoToolbar) els.invEstadoToolbar.hidden = nombre !== 'estado-inventario';
    if (els.cortesToolbar) els.cortesToolbar.hidden = nombre !== 'cortes';
    if (activa.alEntrar) activa.alEntrar();
  }

  els.btnReportesVistaPorReporte.addEventListener('click', () => activarPestanaReportes('por-reporte'));
  els.btnReportesVistaCortes.addEventListener('click', () => activarPestanaReportes('cortes'));
  els.btnReportesVistaLedger.addEventListener('click', () => activarPestanaReportes('ledger'));
  els.btnReportesVistaEstadoInventario.addEventListener('click', () => activarPestanaReportes('estado-inventario'));

  // ---------- Historial por identificador (idea D) ----------
  // Delegado en document: el botón "Ver historial" vive en 3 tablas
  // distintas (Movimientos, Eliminados, ledger cruzado), generadas y
  // regeneradas dinámicamente — un solo listener delegado cubre las 3
  // sin tener que re-engancharlo cada vez que se re-renderiza una tabla.
  document.addEventListener('click', (e) => {
    const boton = e.target.closest('.btn-ver-historial');
    if (!boton) return;
    abrirTimelineItem(boton.dataset.tipo, boton.dataset.identificador);
  });

  function renderEntradaTimeline(entrada) {
    const esEliminado = entrada.accion === 'eliminado';
    const badge = esEliminado
      ? '<span class="estatus-badge estatus-cancelado">Eliminado</span>'
      : '<span class="estatus-badge estatus-listo">Activo</span>';
    return `
      <li class="reportes-timeline-item">
        <span class="reportes-timeline-fecha">${formatearFechaCorta(entrada.reporte_fecha_generacion)}</span>
        ${badge}
        <span class="reportes-timeline-detalle">${renderDetalleItemReporte(entrada)}</span>
      </li>
    `;
  }

  async function abrirTimelineItem(tipo, identificador) {
    els.reportesTimelineSubtitulo.textContent = `${TIPO_REGISTRO_ETIQUETA[tipo] || tipo} ${identificador} — en todos los reportes donde apareció, del más antiguo al más reciente.`;
    els.reportesTimelineLista.innerHTML = '';
    els.reportesTimelineEmpty.hidden = true;
    els.reportesTimelineOverlay.hidden = false;
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/reportes/timeline/${tipo}/${encodeURIComponent(identificador)}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();
      const entradas = data.entradas || [];
      els.reportesTimelineLista.innerHTML = entradas.map(renderEntradaTimeline).join('');
      els.reportesTimelineEmpty.hidden = entradas.length > 0;
    } catch (err) {
      els.reportesTimelineEmpty.hidden = false;
    }
  }

  els.btnCerrarReportesTimeline.addEventListener('click', () => {
    els.reportesTimelineOverlay.hidden = true;
  });
  els.reportesTimelineOverlay.addEventListener('click', (e) => {
    if (e.target === els.reportesTimelineOverlay) els.reportesTimelineOverlay.hidden = true;
  });

  async function cargarItemsReporteSeleccionado() {
    if (!reporteSeleccionadoId) return;
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    Esqueleto.aplicarEsqueletoTabla(els.reportesMovimientosTableBody, 7);
    Esqueleto.aplicarEsqueletoTabla(els.reportesEliminadosTableBody, 7);
    try {
      const params = obtenerFiltrosReporteActuales();
      const res = await fetch(`${API_BASE}/admin/reportes/${reporteSeleccionadoId}/items?${params.toString()}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.reportesMovimientosTableBody, 7, 'No se pudo cargar el reporte.', cargarItemsReporteSeleccionado);
        Esqueleto.aplicarErrorTabla(els.reportesEliminadosTableBody, 7, 'No se pudo cargar el reporte.', cargarItemsReporteSeleccionado);
        return;
      }
      const data = await res.json();
      renderReporteItems(data.items || []);
      Esqueleto.quitarEsqueletoTabla(els.reportesMovimientosTableBody);
      Esqueleto.quitarEsqueletoTabla(els.reportesEliminadosTableBody);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.reportesMovimientosTableBody, 7, 'No se pudo conectar con el servidor.', cargarItemsReporteSeleccionado);
      Esqueleto.aplicarErrorTabla(els.reportesEliminadosTableBody, 7, 'No se pudo conectar con el servidor.', cargarItemsReporteSeleccionado);
    }
    renderFiltrosChips(els.reporteFiltrosChips, [
      { etiqueta: 'Tipo', valor: textoOpcionSeleccionada(els.filtroReporteTipo), campos: [els.filtroReporteTipo] },
      { etiqueta: 'Estatus', valor: textoOpcionSeleccionada(els.filtroReporteEstatus), campos: [els.filtroReporteEstatus] },
      { etiqueta: 'RFC / correo', valor: els.filtroReporteRfc.value.trim(), campos: [els.filtroReporteRfc] },
      { etiqueta: 'Fechas', valor: (els.filtroReporteFechaDesde.value || els.filtroReporteFechaHasta.value) ? `${els.filtroReporteFechaDesde.value || '…'} – ${els.filtroReporteFechaHasta.value || '…'}` : '', campos: [els.filtroReporteFechaDesde, els.filtroReporteFechaHasta] },
    ]);
  }

  els.reportesSelector.addEventListener('change', async () => {
    reporteSeleccionadoId = els.reportesSelector.value;
    if (!reporteSeleccionadoId) {
      limpiarVistaLecturaReportes();
      return;
    }

    const reporte = reportesDisponibles.find((r) => String(r.id) === String(reporteSeleccionadoId));
    if (reporte) {
      els.resumenReporteTipo.textContent =
        reporte.tipo === 'automatico'
          ? 'Automático (antes de borrado)'
          : reporte.tipo === 'cierre_mensual'
          ? 'Cierre mensual'
          : reporte.tipo === 'corte'
          ? 'Corte de ventas'
          : 'Manual';
      els.resumenReporteFecha.textContent = formatearFechaCorta(reporte.fecha_generacion);
      els.resumenReporteTickets.textContent = reporte.total_tickets;
      els.resumenReporteOrdenes.textContent = reporte.total_ordenes;
      els.resumenReporteCorreo.textContent = reporte.correo_enviado
        ? `Enviado a ${reporte.correo_enviado_a}`
        : 'No se envió por correo';
      cargarGeneradoPorReporte(reporte.id, reporte.tipo);
    }

    els.lecturaReportesResumen.hidden = false;
    els.lecturaReportesFiltros.hidden = false;
    els.lecturaReportesSinSeleccion.hidden = true;
    els.btnVerMdReporte.disabled = false;
    els.btnEliminarReporte.hidden = !puedeEliminarReporte();
    els.btnEliminarReporte.disabled = false;

    // Los filtros se reinician al cambiar de reporte — un filtro de RFC
    // capturado para un reporte no tendría por qué seguir aplicando al
    // siguiente que se seleccione.
    els.filtroReporteTipo.value = '';
    els.filtroReporteEstatus.value = '';
    els.filtroReporteRfc.value = '';
    els.filtroReporteFechaDesde.value = '';
    els.filtroReporteFechaHasta.value = '';

    cargarItemsReporteSeleccionado();
  });

  [els.filtroReporteTipo, els.filtroReporteEstatus, els.filtroReporteFechaDesde, els.filtroReporteFechaHasta].forEach((el) => {
    el.addEventListener('change', () => cargarItemsReporteSeleccionado());
  });
  // El filtro de texto (RFC/correo) espera una pequeña pausa después de
  // que la persona deja de escribir, en vez de recargar en cada tecla —
  // mismo criterio de "debounce" ya usado en otros filtros de texto de
  // este panel.
  let timeoutFiltroRfcReporte = null;
  els.filtroReporteRfc.addEventListener('input', () => {
    clearTimeout(timeoutFiltroRfcReporte);
    timeoutFiltroRfcReporte = setTimeout(() => cargarItemsReporteSeleccionado(), 350);
  });

  els.btnLimpiarFiltrosReporte.addEventListener('click', () => {
    els.filtroReporteTipo.value = '';
    els.filtroReporteEstatus.value = '';
    els.filtroReporteRfc.value = '';
    els.filtroReporteFechaDesde.value = '';
    els.filtroReporteFechaHasta.value = '';
    cargarItemsReporteSeleccionado();
  });

  // Las exportaciones necesitan el header de autenticación (no son un
  // <a href> simple), así que se piden con fetch() y el archivo se
  // "descarga" creando una URL temporal a partir del blob de la
  // respuesta — mismo patrón ya usado para descargar la factura/imagen
  // de un ticket en este mismo archivo.
  // "accionFiltro" ('activo' | 'eliminado') scopea la exportación a
  // exactamente la tabla que la disparó — nunca mezcla Movimientos con
  // Eliminados en un mismo archivo, mismo criterio que la pantalla.
  async function exportarReporte(formato, accionFiltro) {
    if (!reporteSeleccionadoId) return;
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const params = obtenerFiltrosReporteActuales();
      params.set('formato', formato);
      params.set('accion', accionFiltro);
      const res = await fetch(`${API_BASE}/admin/reportes/${reporteSeleccionadoId}/exportar?${params.toString()}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        showToast('No se pudo exportar el reporte.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${reporteSeleccionadoId}-${accionFiltro}.${formato === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('No se pudo exportar el reporte.');
    }
  }
  els.btnExportarMovimientosCsv.addEventListener('click', () => exportarReporte('csv', 'activo'));
  els.btnExportarMovimientosExcel.addEventListener('click', () => exportarReporte('excel', 'activo'));
  els.btnExportarEliminadosCsv.addEventListener('click', () => exportarReporte('csv', 'eliminado'));
  els.btnExportarEliminadosExcel.addEventListener('click', () => exportarReporte('excel', 'eliminado'));

  let mdContenidoActual = '';
  let nombreArchivoMdActual = '';
  els.btnVerMdReporte.addEventListener('click', async () => {
    if (!reporteSeleccionadoId) return;
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/reportes/${reporteSeleccionadoId}/md`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        showToast('No se pudo cargar el reporte en Markdown.');
        return;
      }
      const data = await res.json();
      mdContenidoActual = data.mdContenido;
      nombreArchivoMdActual = `reporte-${reporteSeleccionadoId}.md`;
      els.verMdTitle.textContent = 'Reporte en Markdown';
      els.verMdContenido.textContent = mdContenidoActual;
      els.verMdOverlay.hidden = false;
    } catch (err) {
      showToast('No se pudo cargar el reporte en Markdown.');
    }
  });

  // Elimina un reporte por completo (Markdown + todos sus items) — pide
  // confirmación primero con el mismo modal genérico ya usado en el
  // resto del panel, ya que es un borrado permanente (a diferencia de
  // constancias/tickets, "Reportes" no tiene papelera).
  els.btnEliminarReporte.addEventListener('click', () => {
    if (!reporteSeleccionadoId) return;
    const reporte = reportesDisponibles.find((r) => String(r.id) === String(reporteSeleccionadoId));
    const etiqueta = reporte ? `del ${formatearFechaCorta(reporte.fecha_generacion)}` : '';
    abrirConfirmacion({
      titulo: '¿Eliminar este reporte?',
      mensaje: `Se eliminará el reporte ${etiqueta} de forma permanente, junto con todos sus registros. Esta acción no se puede deshacer.`,
      textoBoton: 'Eliminar',
      onConfirmar: async () => {
        const authHeader = getAuthHeader();
        if (!authHeader) {
          showLogin();
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/admin/reportes/${reporteSeleccionadoId}`, {
            method: 'DELETE',
            headers: { Authorization: authHeader },
          });
          if (!res.ok) {
            showToast('No se pudo eliminar el reporte.');
            return;
          }
          showToast('Reporte eliminado.');
          reporteSeleccionadoId = '';
          limpiarVistaLecturaReportes();
          await cargarListaReportes();
        } catch (err) {
          showToast('No se pudo eliminar el reporte.');
        }
      },
    });
  });

  els.btnDescargarMd.addEventListener('click', () => {
    const blob = new Blob([mdContenidoActual], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivoMdActual || `reporte-${reporteSeleccionadoId || 'sin-titulo'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  els.btnCerrarVerMd.addEventListener('click', () => {
    els.verMdOverlay.hidden = true;
  });
  els.verMdOverlay.addEventListener('click', (e) => {
    if (e.target === els.verMdOverlay) els.verMdOverlay.hidden = true;
  });

  // ---------- Configuración de correo SMTP ----------
  // Acordeón estricto de 3 subsecciones (Correo electrónico/Plantillas/
  // Prueba) — solo 1 abierta a la vez, la anterior se cierra sola. Misma
  // técnica que los grupos del sidebar (punto 296), sin persistencia:
  // siempre arranca en "conexion" al entrar a esta tarjeta (ver
  // seleccionarSeccionConfig más abajo).
  let smtpAccSeccionAbierta = 'conexion';

  function aplicarAcordeonSmtp() {
    document.querySelectorAll('.smtp-acc-header').forEach((btn) => {
      btn.setAttribute('aria-expanded', String(btn.dataset.seccion === smtpAccSeccionAbierta));
    });
    document.querySelectorAll('.smtp-acc-body').forEach((body) => {
      body.dataset.colapsado = String(body.dataset.seccion !== smtpAccSeccionAbierta);
    });
  }

  document.querySelectorAll('.smtp-acc-header').forEach((btn) => {
    btn.addEventListener('click', () => {
      smtpAccSeccionAbierta = btn.dataset.seccion === smtpAccSeccionAbierta ? null : btn.dataset.seccion;
      aplicarAcordeonSmtp();
    });
  });

  // Guía Gmail paso a paso, inline en la tarjeta (Fase 7 UX, 2026-09-04) —
  // mismo contenido y misma animación que el Centro de conocimiento
  // (GUIA_SMTP_GMAIL/renderPasoTarjeta, definidos más abajo en este
  // archivo — funciones hoisted, se puede llamar desde aquí sin problema).
  if (els.btnGuiaSmtpGmail) {
    els.btnGuiaSmtpGmail.addEventListener('click', () => {
      const abierta = els.btnGuiaSmtpGmail.classList.toggle('is-open');
      els.btnGuiaSmtpGmail.setAttribute('aria-expanded', String(abierta));
      els.guiaSmtpGmailCuerpo.classList.toggle('is-open', abierta);
      if (abierta && !els.guiaSmtpGmailCuerpo.dataset.render) {
        const reducido = prefersReducedMotion();
        els.guiaSmtpGmailCuerpo.innerHTML = GUIA_SMTP_GMAIL.map((p, i) => renderPasoTarjeta(p, i, '', reducido)).join('');
        els.guiaSmtpGmailCuerpo.dataset.render = '1';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            els.guiaSmtpGmailCuerpo.querySelectorAll('.conocimiento-paso').forEach((el) => el.classList.add('is-in'));
          });
        });
      }
    });
  }

  els.btnToggleSmtpPassword.addEventListener('click', () => {
    const mostrando = els.smtpPassword.type === 'password';
    els.smtpPassword.type = mostrando ? 'text' : 'password';
    els.btnToggleSmtpPassword.setAttribute('aria-pressed', String(mostrando));
    els.btnToggleSmtpPassword.classList.toggle('is-visible', mostrando);
  });

  // ---------- Plantillas de correo (punto 214) ----------
  // 5 correos que comparten el mismo cascarón de marca (construirCorreoBase
  // en el backend) — el admin solo edita texto, nunca branding. Ticket de
  // venta y aclaraciones quedan fuera (ver PROJECT_STATE.md punto 214: el
  // primero tiene su propio diseño + instrucciones funcionales de las que
  // depende el flujo de solicitar factura; el segundo es el mensaje del
  // cliente, no una plantilla).
  const PLANTILLAS_CORREO = {
    invitacion: {
      campo: 'cuerpo_invitacion',
      desc: 'Se envía al dar de alta un usuario en "Usuarios" (administrador, fiscal o cliente).',
      asunto: 'Te invitamos a Portal Clarvo tu negocio en orden',
      vars: [
        { nombre: '{perfil}', desc: 'Perfil de la cuenta creada' },
        { nombre: '{usuario}', desc: 'RFC o nombre de usuario' },
      ],
    },
    recuperacion: {
      campo: 'cuerpo_recuperacion',
      desc: 'Se envía cuando alguien pide "¿Olvidaste tu contraseña?" en el login.',
      asunto: 'Recupera tu acceso — Portal Clarvo tu negocio en orden',
      vars: [],
    },
    aviso_contador: {
      campo: 'cuerpo_aviso_contador',
      desc: 'Se envía al "Correo de quien va a facturar" (arriba) cada vez que un cliente sube un ticket nuevo.',
      asunto: 'Nuevo ticket para facturar — Folio {folio}',
      vars: [
        { nombre: '{rfc}', desc: 'RFC del cliente' },
        { nombre: '{folio}', desc: 'Folio del ticket' },
      ],
    },
    cliente: {
      campo: 'cuerpo_cliente',
      desc: 'Se envía al cliente (el correo de su constancia) en cuanto subes su factura.',
      asunto: 'Factura lista — Folio {folio}',
      vars: [
        { nombre: '{folio}', desc: 'Folio del ticket' },
        { nombre: '{rfc}', desc: 'RFC del cliente' },
        { nombre: '{marca}', desc: 'Nombre de marca' },
      ],
    },
    reporte: {
      campo: 'cuerpo_reporte',
      desc: 'Se envía al correo de reportes (Configuración Reportes) cada vez que se genera o se envía un reporte manual.',
      asunto: 'Reporte Clarvo — {fecha}',
      vars: [
        { nombre: '{fecha}', desc: 'Fecha de generación' },
        { nombre: '{hora}', desc: 'Hora de generación' },
      ],
    },
    // Punto 335: a diferencia de las otras 5, este correo tiene su propio
    // diseño de recibo (no pasa por el cascarón genérico) — solo estos
    // párrafos son editables, la tabla de datos y el diseño se quedan
    // fijos. El preview real llama a construirCorreoOrdenCompra() en el
    // backend (ver POST /config/smtp/preview), no el cascarón genérico.
    venta: {
      campo: 'cuerpo_venta',
      desc: 'Se envía al cliente al registrar una venta con correo — confirma los datos que necesitará para pedir su factura.',
      asunto: 'Confirmación de venta — {numero_venta}',
      vars: [{ nombre: '{numero_venta}', desc: 'Folio de la venta (ej. OC-000123)' }],
    },
  };

  let plantillaActual = 'invitacion';
  let plantillasTextos = {};
  let plantillasDefaults = {};
  let plantillaPreviewTimer = null;

  async function actualizarPreviewPlantilla() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/config/smtp/preview`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: plantillaActual, texto: els.plantillaTexto.value }),
      });
      if (!res.ok) return;
      const data = await res.json();
      els.plantillaPreviewFrame.srcdoc = data.html || '';
    } catch (err) {
      // Sin vista previa, el textarea sigue siendo editable con normalidad.
    }
  }

  function programarPreviewPlantilla() {
    clearTimeout(plantillaPreviewTimer);
    plantillaPreviewTimer = setTimeout(actualizarPreviewPlantilla, 400);
  }

  function seleccionarPlantilla(id) {
    plantillaActual = id;
    els.plantillasTabs.forEach((btn) => {
      const activo = btn.dataset.plantilla === id;
      btn.classList.toggle('is-active', activo);
      btn.setAttribute('aria-selected', activo ? 'true' : 'false');
    });
    const def = PLANTILLAS_CORREO[id];
    els.plantillaTriggerDesc.textContent = def.desc;
    const asuntoEl = document.getElementById('plantilla-asunto-fijo');
    if (asuntoEl) asuntoEl.textContent = '"' + def.asunto + '"';
    els.plantillaVars.innerHTML = def.vars.length
      ? def.vars.map((v) => `<span class="var-chip" data-tooltip="${escapeHtml(v.desc)}">${escapeHtml(v.nombre)}</span>`).join('')
      : '<span style="font-size:11px;color:#94A3B8">Sin variables para esta plantilla.</span>';
    els.plantillaTexto.value = plantillasTextos[id] || '';
    const contador = document.getElementById('plantilla-texto-contador');
    if (contador) contador.textContent = els.plantillaTexto.value.length + ' / 5000';
    actualizarPreviewPlantilla();
  }

  els.plantillasTabs.forEach((btn) => {
    btn.addEventListener('click', () => seleccionarPlantilla(btn.dataset.plantilla));
  });

  els.plantillaTexto.addEventListener('input', () => {
    plantillasTextos[plantillaActual] = els.plantillaTexto.value;
    const contador = document.getElementById('plantilla-texto-contador');
    if (contador) contador.textContent = els.plantillaTexto.value.length + ' / 5000';
    programarPreviewPlantilla();
  });

  // Negrita/cursiva reales (**texto**/*texto*, ver formatearParrafosCuerpo
  // en backend/utils/correoMarca.js) — envuelve la selección del textarea
  // con el marcador; sin selección, inserta el par y deja el cursor en
  // medio para que el admin escriba ahí mismo. Dispara 'input' para
  // reusar el mismo camino de guardado/preview/contador de siempre.
  function envolverSeleccionPlantilla(marcador) {
    const el = els.plantillaTexto;
    const inicio = el.selectionStart;
    const fin = el.selectionEnd;
    const valor = el.value;
    const seleccion = valor.slice(inicio, fin);
    const nuevoValor = valor.slice(0, inicio) + marcador + seleccion + marcador + valor.slice(fin);
    el.value = nuevoValor;
    const cursor = seleccion ? inicio + marcador.length + seleccion.length + marcador.length : inicio + marcador.length;
    el.focus();
    el.setSelectionRange(cursor, cursor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (els.btnPlantillaNegrita) {
    els.btnPlantillaNegrita.addEventListener('click', () => envolverSeleccionPlantilla('**'));
  }
  if (els.btnPlantillaCursiva) {
    els.btnPlantillaCursiva.addEventListener('click', () => envolverSeleccionPlantilla('*'));
  }

  els.btnRestablecerPlantilla.addEventListener('click', () => {
    const campo = PLANTILLAS_CORREO[plantillaActual].campo;
    const textoDefault = plantillasDefaults[campo] || '';
    els.plantillaTexto.value = textoDefault;
    plantillasTextos[plantillaActual] = textoDefault;
    actualizarPreviewPlantilla();
  });

  async function cargarConfigSmtp() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/config/smtp`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();

      els.smtpHost.value = data.host || 'smtp.gmail.com';
      els.smtpPuerto.value = data.puerto || 587;
      els.smtpSeguridad.value = data.seguridad || 'starttls';
      els.smtpUsuario.value = data.usuario || '';
      els.smtpNombreRemitente.value = data.nombreRemitente || data.nombre_remitente || '';
      els.smtpCorreoRemitente.value = data.correoRemitente || data.correo_remitente || '';
      els.smtpCorreoContador.value = data.correo_contador || '';

      plantillasDefaults = data.defaultsPlantillas || {};
      plantillasTextos = {
        invitacion: data.cuerpo_invitacion || '',
        recuperacion: data.cuerpo_recuperacion || '',
        aviso_contador: data.cuerpo_aviso_contador || '',
        cliente: data.cuerpo_cliente || '',
        reporte: data.cuerpo_reporte || '',
        venta: data.cuerpo_venta || '',
      };
      seleccionarPlantilla(plantillaActual);

      els.smtpPassword.value = '';
      els.smtpPasswordHint.textContent = data.passwordConfigurada
        ? 'Ya hay una contraseña guardada. Déjala en blanco para conservarla, o escribe una nueva para reemplazarla.'
        : 'Sin contraseña guardada todavía.';

      els.smtpEstadoBadge.hidden = false;
      els.smtpEstadoBadge.textContent = data.configurado ? 'Configurado' : 'Sin configurar';
      els.smtpEstadoBadge.className = `smtp-estado-badge ${data.configurado ? 'is-ok' : 'is-pendiente'}`;
      actualizarBadgeSidebarSmtp(data.configurado);
      renderSmtpVerificado(data.ultima_verificacion_en);
    } catch (err) {
      // Si falla la carga, el formulario se queda con los valores por
      // defecto; el administrador puede llenarlo y guardar de todas formas.
    }
  }

  // Timestamp ISO (new Date().toISOString(), siempre UTC) — se muestra tal
  // cual, sin reinterpretar zona horaria (mismo criterio que el resto del
  // panel), con sufijo "UTC" explícito por ser el único timestamp del sitio
  // en este formato (el resto usa dateStrings de MySQL sin sufijo).
  function formatearVerificadoEn(valor) {
    if (!valor || typeof valor !== 'string') return null;
    const fecha = valor.slice(0, 10);
    const hora = valor.slice(11, 16);
    return fecha && hora ? `${fecha} ${hora} UTC` : null;
  }

  // Badge real del pie del sidebar de Configuraciones — refleja el mismo
  // dato (data.configurado) que ya usa #smtp-estado-badge, nunca un
  // "Conectado" fijo. Oculto hasta la primera carga real.
  function actualizarBadgeSidebarSmtp(configurado) {
    if (!els.configSidebarSmtpEstado || !els.configSidebarSmtpEstadoTexto) return;
    els.configSidebarSmtpEstado.hidden = false;
    els.configSidebarSmtpEstado.className = `config-sidebar-smtp-estado ${configurado ? 'is-ok' : 'is-pendiente'}`;
    els.configSidebarSmtpEstadoTexto.textContent = configurado
      ? 'Servidor SMTP configurado'
      : 'SMTP sin configurar';
  }

  function renderSmtpVerificado(valor) {
    if (!els.smtpVerificarTexto) return;
    const formateada = formatearVerificadoEn(valor);
    if (formateada) {
      els.smtpVerificarTexto.textContent = `Última verificación exitosa: ${formateada}`;
      els.smtpVerificarTexto.classList.add('is-ok');
    } else {
      els.smtpVerificarTexto.textContent = 'Aún no se ha verificado la conexión.';
      els.smtpVerificarTexto.classList.remove('is-ok');
    }
  }

  function setGuardarSmtpLoading(cargando) {
    els.btnGuardarSmtp.disabled = cargando;
    els.btnGuardarSmtpLabel.textContent = cargando ? 'Guardando…' : 'Guardar plantilla';
  }

  // Valida los mismos 4 campos que el backend exige (host/puerto/usuario
  // obligatorios, correo del contador con formato si viene lleno) — usada
  // tanto por el botón "Guardar plantilla" como por el autoguardado de
  // "Correo electrónico (SMTP)", para que ambos caminos rechacen lo mismo.
  function validarCamposSmtp({ host, puerto, usuario, correoContador }) {
    if (!host) return 'El host SMTP es obligatorio.';
    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) return 'El puerto debe ser un número entre 1 y 65535.';
    if (!usuario) return 'El usuario (correo) es obligatorio.';
    if (correoContador && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoContador)) return 'El correo de quien va a facturar no es válido.';
    return '';
  }

  let smtpAutosaveTagTimer = null;
  function setSmtpAutosaveEstado(estado, mensaje) {
    if (!els.smtpAutosaveTag) return;
    clearTimeout(smtpAutosaveTagTimer);
    els.smtpAutosaveTag.className = 'smtp-autosave-tag' + (estado ? ` is-${estado}` : '');
    if (estado === 'guardado') {
      // Único estado con HTML (el ícono de check) — los demás son texto
      // plano, posiblemente con un mensaje de error del backend, así que
      // siguen usando `.textContent` (nunca `.innerHTML` con texto que no
      // controlamos nosotros).
      els.smtpAutosaveTag.innerHTML = HTML_GUARDADO_OK;
    } else {
      els.smtpAutosaveTag.textContent =
        estado === 'guardando' ? 'Guardando…' : estado === 'error' ? (mensaje || 'No se pudo guardar') : '';
    }
    if (estado === 'guardado') {
      smtpAutosaveTagTimer = setTimeout(() => {
        els.smtpAutosaveTag.className = 'smtp-autosave-tag';
        els.smtpAutosaveTag.textContent = '';
      }, 2500);
    }
  }

  // Único punto que llama a PUT /admin/config/smtp — el endpoint no admite
  // guardado parcial (siempre espera los 13 campos, conexión + 5
  // plantillas juntos: ver PROJECT_STATE.md, análisis SMTP acordeón), así
  // que tanto el botón "Guardar plantilla" (modo 'boton') como el
  // autoguardado de "Correo electrónico (SMTP)" (modo 'autosave') mandan
  // siempre la foto completa del formulario — nunca un campo aislado.
  async function guardarConfigSmtpCompleta(modo) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return false;
    }

    const host = els.smtpHost.value.trim();
    const puerto = Number(els.smtpPuerto.value);
    const seguridad = els.smtpSeguridad.value;
    const usuario = els.smtpUsuario.value.trim();
    const password = els.smtpPassword.value;
    const nombreRemitente = els.smtpNombreRemitente.value.trim();
    const correoRemitente = els.smtpCorreoRemitente.value.trim();
    const correoContador = els.smtpCorreoContador.value.trim();

    const errorValidacion = validarCamposSmtp({ host, puerto, usuario, correoContador });
    if (errorValidacion) {
      if (modo === 'boton') els.smtpConfigError.textContent = errorValidacion;
      return false;
    }

    if (modo === 'boton') {
      els.smtpConfigError.textContent = '';
      setGuardarSmtpLoading(true);
    } else {
      setSmtpAutosaveEstado('guardando');
    }

    try {
      const res = await fetch(`${API_BASE}/admin/config/smtp`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          puerto,
          seguridad,
          usuario,
          password,
          nombre_remitente: nombreRemitente,
          correo_remitente: correoRemitente,
          correo_contador: correoContador,
          cuerpo_invitacion: plantillasTextos.invitacion,
          cuerpo_recuperacion: plantillasTextos.recuperacion,
          cuerpo_aviso_contador: plantillasTextos.aviso_contador,
          cuerpo_cliente: plantillasTextos.cliente,
          cuerpo_reporte: plantillasTextos.reporte,
          cuerpo_venta: plantillasTextos.venta,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const mensaje = data.error || 'No se pudo guardar la configuración.';
        if (modo === 'boton') els.smtpConfigError.textContent = mensaje;
        else setSmtpAutosaveEstado('error', mensaje);
        return false;
      }
      if (modo === 'boton') showToast('Configuración de correo guardada.');
      else setSmtpAutosaveEstado('guardado');
      els.smtpPassword.value = '';
      els.smtpPasswordHint.textContent = data.passwordConfigurada
        ? 'Ya hay una contraseña guardada. Déjala en blanco para conservarla, o escribe una nueva para reemplazarla.'
        : 'Sin contraseña guardada todavía.';
      els.smtpEstadoBadge.hidden = false;
      els.smtpEstadoBadge.textContent = data.configurado ? 'Configurado' : 'Sin configurar';
      els.smtpEstadoBadge.className = `smtp-estado-badge ${data.configurado ? 'is-ok' : 'is-pendiente'}`;
      actualizarBadgeSidebarSmtp(data.configurado);
      renderSmtpVerificado(data.ultima_verificacion_en);
      return true;
    } catch (err) {
      const mensaje = 'No se pudo conectar con el servidor.';
      if (modo === 'boton') els.smtpConfigError.textContent = mensaje;
      else setSmtpAutosaveEstado('error', mensaje);
      return false;
    } finally {
      if (modo === 'boton') setGuardarSmtpLoading(false);
    }
  }

  els.btnGuardarSmtp.addEventListener('click', () => guardarConfigSmtpCompleta('boton'));

  // Autoguardado de "Correo electrónico (SMTP)": dispara en 'change' (blur
  // con valor distinto, o selección nueva en el <select>), nunca por
  // tecla — solo intenta guardar si los campos obligatorios ya son
  // válidos (mismo validarCamposSmtp de arriba), así nunca manda al
  // backend algo que sabemos que va a rechazar.
  [els.smtpHost, els.smtpPuerto, els.smtpSeguridad, els.smtpUsuario, els.smtpPassword, els.smtpNombreRemitente, els.smtpCorreoRemitente, els.smtpCorreoContador].forEach((campo) => {
    if (!campo) return;
    campo.addEventListener('change', () => {
      const errorValidacion = validarCamposSmtp({
        host: els.smtpHost.value.trim(),
        puerto: Number(els.smtpPuerto.value),
        usuario: els.smtpUsuario.value.trim(),
        correoContador: els.smtpCorreoContador.value.trim(),
      });
      if (errorValidacion) return;
      guardarConfigSmtpCompleta('autosave');
    });
  });

  function setEnviarPruebaLoading(cargando) {
    els.btnEnviarPruebaSmtp.disabled = cargando;
    els.btnEnviarPruebaSmtpLabel.textContent = cargando ? 'Enviando…' : 'Enviar prueba';
  }

  els.btnEnviarPruebaSmtp.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.smtpPruebaError.textContent = '';
    const destinatario = els.smtpPruebaDestinatario.value.trim();
    const asunto = els.smtpPruebaAsunto.value.trim();
    const cuerpo = els.smtpPruebaCuerpo.value.trim();

    if (!destinatario) {
      els.smtpPruebaError.textContent = 'Ingresa un correo destinatario.';
      return;
    }
    if (!asunto) {
      els.smtpPruebaError.textContent = 'Ingresa un asunto.';
      return;
    }
    if (!cuerpo) {
      els.smtpPruebaError.textContent = 'Ingresa el cuerpo del correo.';
      return;
    }

    setEnviarPruebaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/config/smtp/prueba`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinatario, asunto, cuerpo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.smtpPruebaError.textContent = data.error || 'No se pudo enviar el correo de prueba.';
        return;
      }
      showToast(data.mensaje || 'Correo de prueba enviado.');
      renderSmtpVerificado(data.verificadoEn);
    } catch (err) {
      els.smtpPruebaError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setEnviarPruebaLoading(false);
    }
  });

  // Franja "Verificar conexión ahora" — handshake ligero (sin enviar
  // correo) contra la config YA GUARDADA (restyle "confGlo").
  function setVerificarSmtpLoading(cargando) {
    if (!els.btnVerificarSmtp) return;
    els.btnVerificarSmtp.disabled = cargando;
    els.btnVerificarSmtpLabel.textContent = cargando ? 'Verificando…' : 'Verificar conexión ahora';
  }

  if (els.btnVerificarSmtp) {
    els.btnVerificarSmtp.addEventListener('click', async () => {
      const authHeader = getAuthHeader();
      if (!authHeader) {
        showLogin();
        return;
      }
      els.smtpVerificarError.textContent = '';
      setVerificarSmtpLoading(true);
      try {
        const res = await fetch(`${API_BASE}/admin/config/smtp/verificar`, {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          els.smtpVerificarError.textContent = data.error || 'No se pudo verificar la conexión.';
          return;
        }
        renderSmtpVerificado(data.verificadoEn);
        showToast('Conexión SMTP verificada.');
      } catch (err) {
        els.smtpVerificarError.textContent = 'No se pudo conectar con el servidor.';
      } finally {
        setVerificarSmtpLoading(false);
      }
    });
  }

  // ---------- Retención (borrado automático) de tickets ----------

  els.btnToggleRetencion.addEventListener('click', () => {
    const abierto = els.btnToggleRetencion.getAttribute('aria-expanded') === 'true';
    els.btnToggleRetencion.setAttribute('aria-expanded', String(!abierto));
    els.retencionConfigBody.hidden = abierto;
    if (!abierto) cargarConfigRetencion();
  });

  function formatearInfoUltimaLimpieza(ultimaLimpieza, etiqueta) {
    if (!ultimaLimpieza || !ultimaLimpieza.fecha) return `Aún no se ha ejecutado ninguna limpieza automática de ${etiqueta}.`;
    return `Última limpieza de ${etiqueta}: ${formatFecha(ultimaLimpieza.fecha)} · ${ultimaLimpieza.cantidadEliminados} eliminado(s).`;
  }

  async function cargarConfigRetencion() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/config/tickets-retencion`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();

      els.retencionDias.value = data.dias || '';
      els.retencionInfo.textContent = formatearInfoUltimaLimpieza(data.ultimaLimpieza, 'tickets');
      // Desde punto 158 ventas ya no se limpia por retención (se archiva a Reportes)
      if (els.retencionInfoOrdenes) {
        els.retencionInfoOrdenes.textContent = '';
        els.retencionInfoOrdenes.hidden = true;
      }
      els.retencionEstadoBadge.hidden = false;
      els.retencionEstadoBadge.textContent = data.dias ? `Activo: ${data.dias} días` : 'Desactivado';
      els.retencionEstadoBadge.className = `smtp-estado-badge ${data.dias ? 'is-ok' : 'is-pendiente'}`;
    } catch (err) {
      // Si falla, el formulario se queda con lo último cargado; el
      // administrador puede intentar guardar de todas formas.
    }
  }

  function setGuardarRetencionLoading(cargando) {
    els.btnGuardarRetencion.disabled = cargando;
    els.btnGuardarRetencionLabel.textContent = cargando ? 'Guardando…' : 'Guardar';
  }

  els.btnGuardarRetencion.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.retencionError.textContent = '';
    const valorCrudo = els.retencionDias.value.trim();
    const dias = valorCrudo === '' ? 0 : Number(valorCrudo);

    if (!Number.isInteger(dias) || dias < 0 || dias > 3650) {
      els.retencionError.textContent = 'Ingresa un número entero entre 0 (desactivado) y 3650.';
      return;
    }

    setGuardarRetencionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/config/tickets-retencion`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.retencionError.textContent = data.error || 'No se pudo guardar la configuración.';
        return;
      }
      showToast(
        data.dias
          ? `Los tickets se eliminarán automáticamente después de ${data.dias} días.`
          : 'Borrado automático de tickets desactivado.'
      );
      els.retencionEstadoBadge.hidden = false;
      els.retencionEstadoBadge.textContent = data.dias ? `Activo: ${data.dias} días` : 'Desactivado';
      els.retencionEstadoBadge.className = `smtp-estado-badge ${data.dias ? 'is-ok' : 'is-pendiente'}`;
    } catch (err) {
      els.retencionError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setGuardarRetencionLoading(false);
    }
  });

  // ---------- Notificación: tickets pendientes sin correo de contador ----------
  // Se consulta justo después de iniciar sesión (no es un aviso "leído una
  // vez": refleja el estado real de la base de datos cada vez que se
  // pregunta), así que si el administrador cierra el modal y vuelve a
  // entrar más tarde, y esos tickets siguen pendientes, se le sigue
  // avisando — a propósito, para que no se pierdan de vista.

  async function revisarTicketsPendientesSinContador() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/pendientes-sin-contador`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.permiteOcultar === 'boolean') {
        notifTicketsPermiteOcultarGlobalmente = data.permiteOcultar;
      }
      // Solo perfil "super" puede haberlo silenciado (el checkbox del
      // popup no se le muestra a nadie más) — y solo cuenta mientras el
      // interruptor maestro (Configuraciones → Notificaciones)
      // lo siga permitiendo; si se apagó después de que este super ya
      // lo había silenciado, el aviso vuelve a salirle sin que nadie
      // borre el localStorage.
      const yaLoSilencio =
        perfilActual === 'super' &&
        notifTicketsPermiteOcultarGlobalmente &&
        localStorage.getItem(claveNotifTicketsOcultar()) === '1';
      if (data.total > 0 && !yaLoSilencio) mostrarNotifTicketsPendientes(data.tickets);
    } catch (err) {
      // Si falla la consulta, simplemente no se muestra la notificación;
      // no es motivo para interrumpir el resto del panel.
    }
  }

  function mostrarNotifTicketsPendientes(tickets) {
    els.notifTicketsSubtitulo.textContent =
      `Tienes ${tickets.length} ticket${tickets.length === 1 ? '' : 's'} pendiente${tickets.length === 1 ? '' : 's'} de facturar ` +
      `sin un correo de contador asignado para avisar automáticamente.`;
    els.notifTicketsLista.innerHTML = '';
    tickets.slice(0, 8).forEach((t) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${escapeHtml(t.folio)}</strong> · RFC ${escapeHtml(t.rfc)} · ${formatFecha(t.creado_en)}`;
      els.notifTicketsLista.appendChild(li);
    });
    if (tickets.length > 8) {
      const li = document.createElement('li');
      li.className = 'notif-tickets-mas';
      li.textContent = `y ${tickets.length - 8} más…`;
      els.notifTicketsLista.appendChild(li);
    }
    const mostrarCheckboxOcultar = perfilActual === 'super' && notifTicketsPermiteOcultarGlobalmente;
    els.notifTicketsOcultarWrap.hidden = !mostrarCheckboxOcultar;
    els.notifTicketsOcultarCheckbox.checked = false;
    els.notifTicketsOverlay.hidden = false;
  }

  function cerrarNotifTicketsPendientes() {
    if (!els.notifTicketsOcultarWrap.hidden && els.notifTicketsOcultarCheckbox.checked) {
      localStorage.setItem(claveNotifTicketsOcultar(), '1');
    }
    els.notifTicketsOverlay.hidden = true;
  }

  els.btnNotifTicketsCerrar.addEventListener('click', cerrarNotifTicketsPendientes);
  els.notifTicketsOverlay.addEventListener('click', (e) => {
    if (e.target === els.notifTicketsOverlay) cerrarNotifTicketsPendientes();
  });
  els.btnNotifTicketsVer.addEventListener('click', () => {
    cerrarNotifTicketsPendientes();
    cambiarVistaPrincipal('tickets');
    els.ticketsFiltroEstatus.value = 'pendiente';
    cargarTickets();
  });

  // ---------- Campana de notificaciones (punto 337) ----------
  // 3 familias, cada una con su propia semántica de "leído":
  //   - Tickets nuevos (evento puntual): leído = ese id específico ya
  //     se vio, se guarda en localStorage y no vuelve a marcarse.
  //   - Inventario / Configuración (condición viva, no evento): leído =
  //     "vi que el número era N" — el punto rojo solo reaparece si el
  //     número SUBE respecto a ese snapshot, nunca por el simple paso
  //     del tiempo (así no es invasivo con algo que puede durar
  //     semanas igual). Coexiste con el popup de "tickets sin
  //     contador" de arriba, sin tocarlo — la campana solo agrega una
  //     copia silenciosa del mismo aviso.
  // Cero endpoint nuevo: reusa GET /admin/tickets, GET
  // /admin/inventarios/dashboard y GET /admin/tickets/pendientes-sin-contador,
  // los 3 ya usados en otras vistas del panel.

  function claveNotifTicketsLeidos() {
    return `notif_tickets_leidos_v1_${TENANT_SLUG || 'base'}_${usuarioSesionActual || ''}`;
  }
  function claveNotifSnapshot() {
    return `notif_snapshot_v1_${TENANT_SLUG || 'base'}_${usuarioSesionActual || ''}`;
  }
  function leerTicketsLeidos() {
    try {
      const crudo = localStorage.getItem(claveNotifTicketsLeidos());
      return crudo ? new Set(JSON.parse(crudo)) : new Set();
    } catch (_) {
      return new Set();
    }
  }
  function guardarTicketsLeidos(set) {
    try {
      localStorage.setItem(claveNotifTicketsLeidos(), JSON.stringify([...set]));
    } catch (_) {
      // localStorage lleno/bloqueado: la sesión sigue funcionando, solo
      // no se recuerda para la próxima.
    }
  }
  function leerSnapshotNotif() {
    try {
      const crudo = localStorage.getItem(claveNotifSnapshot());
      return crudo ? JSON.parse(crudo) : {};
    } catch (_) {
      return {};
    }
  }
  function guardarSnapshotNotif(obj) {
    try {
      localStorage.setItem(claveNotifSnapshot(), JSON.stringify(obj));
    } catch (_) {
      // ver arriba.
    }
  }

  // Últimos 15 días, tope de 20 — lo que sea MENOR (pedido explícito
  // del usuario). Se aplica sobre la lista completa que ya trae GET
  // /admin/tickets (sin paginar), ordenada por creado_en DESC.
  function ticketsRecientesParaNotif(tickets) {
    const corte = Date.now() - RETENCION_NOTIF_TICKETS_DIAS * 24 * 60 * 60 * 1000;
    return tickets
      .filter((t) => {
        const fecha = new Date(String(t.creado_en).replace(' ', 'T') + 'Z');
        return !Number.isNaN(fecha.getTime()) && fecha.getTime() >= corte;
      })
      .slice(0, RETENCION_NOTIF_TICKETS_MAX);
  }

  function tiempoRelativoNotif(fechaTexto) {
    const fecha = new Date(String(fechaTexto).replace(' ', 'T') + 'Z');
    if (Number.isNaN(fecha.getTime())) return '';
    const minutos = Math.round((Date.now() - fecha.getTime()) / 60000);
    if (minutos < 1) return 'ahora';
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.round(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.round(horas / 24);
    if (dias === 1) return 'ayer';
    return `hace ${dias} días`;
  }

  const ICONO_NOTIF_TICKET =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONO_NOTIF_INVENTARIO =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONO_NOTIF_VENCER =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONO_NOTIF_CONFIG =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4l16 16M4 20L20 4" stroke-linecap="round"/></svg>';

  // Estado en memoria del último render — cada <button> del panel guarda
  // su propio tipo/id en dataset para que el click delegado sepa qué
  // marcar leído sin tener que reconstruir el render entero.
  let notifDatosActuales = { ticketsLeidos: new Set(), snapshot: {} };

  function renderNotifPanel(grupos) {
    els.notifList.innerHTML = '';
    const hayAlgo = grupos.some((g) => g.items.length > 0);
    els.notifEmpty.hidden = hayAlgo;
    grupos.forEach((grupo) => {
      if (grupo.items.length === 0) return;
      const label = document.createElement('div');
      label.className = 'admin-notif-group-label';
      label.textContent = grupo.label;
      els.notifList.appendChild(label);
      grupo.items.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-notif-item' + (item.leido ? ' is-read' : '');
        btn.dataset.tipo = item.tipo;
        btn.dataset.id = item.id;
        btn.innerHTML = `
          <div class="admin-notif-item-icon${item.warn ? ' warn' : ''}">${item.icono}</div>
          <div class="admin-notif-item-body">
            <p class="admin-notif-item-title">${escapeHtml(item.titulo)}</p>
            <p class="admin-notif-item-sub">${escapeHtml(item.sub)}</p>
          </div>
          ${item.tiempo ? `<span class="admin-notif-item-time">${escapeHtml(item.tiempo)}</span>` : ''}
          <span class="admin-notif-item-dotwrap"><span class="admin-notif-item-dot"></span></span>`;
        els.notifList.appendChild(btn);
      });
    });
  }

  function actualizarBadgeNotif(grupos) {
    const hayNoLeido = grupos.some((g) => g.items.some((i) => !i.leido));
    els.notifDot.hidden = !hayNoLeido;
  }

  // sondeo=true: llamada del setInterval de 60s (puede sonar/sacudir si
  // encuentra tickets genuinamente nuevos). sondeo=false: primera carga
  // de la sesión, nunca suena (sin punto de comparación todavía).
  async function actualizarNotificaciones({ sondeo = false } = {}) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;

    // Punto en curso (consistencia de gating — extendido de Facturación a
    // cualquier módulo con aviso propio en la campana): el filtro por
    // perfil ya existía, pero faltaba el mismo AND con planPermite() que
    // el sidebar ya aplica (ver aplicarRestriccionesPerfil()) — sin esto,
    // apagar un módulo desde /control seguía mostrando (y sondeando) sus
    // avisos en la campana.
    const ticketsAplican = ['fiscal', 'administrador', 'super'].includes(perfilActual) && planPermite('facturacionHabilitada');
    const inventarioAplica =
      ['administrador', 'inventario', 'super'].includes(perfilActual) && inventarioActivoGlobalmente && planPermite('inventariosHabilitado');
    const configAplica = ['fiscal', 'super'].includes(perfilActual) && planPermite('facturacionHabilitada');

    if (!ticketsAplican && !inventarioAplica && !configAplica) {
      els.btnNotificaciones.hidden = true;
      detenerSondeoNotificaciones();
      return;
    }
    els.btnNotificaciones.hidden = false;

    const ticketsLeidos = leerTicketsLeidos();
    const snapshot = leerSnapshotNotif();
    const grupos = [];

    if (ticketsAplican) {
      try {
        const res = await fetch(`${API_BASE}/admin/tickets`, { headers: { Authorization: authHeader } });
        if (res.status === 401) {
          clearSession();
          showLogin();
          return;
        }
        if (res.ok) {
          const data = await res.json();
          const recientes = ticketsRecientesParaNotif(data.tickets || []);
          const idsActuales = recientes.map((t) => t.id);

          // Suena/sacude SOLO si es un sondeo en segundo plano (nunca la
          // primera carga) y aparecieron ids que no estaban en el
          // sondeo anterior — no basta con "no leídos" (eso incluiría
          // tickets viejos que el usuario simplemente nunca abrió).
          if (sondeo && notifIdsTicketsSondeoAnterior) {
            const nuevos = idsActuales.filter((id) => !notifIdsTicketsSondeoAnterior.has(id));
            if (nuevos.length > 0) {
              reproducirCampanadaNotif();
              sacudirCampanaNotif();
            }
          }
          notifIdsTicketsSondeoAnterior = new Set(idsActuales);

          // Poda el set de leídos a solo los ids todavía visibles en la
          // ventana de retención — evita que crezca indefinidamente en
          // localStorage con ids de tickets que ya salieron de vista.
          const idsVisibles = new Set(idsActuales);
          const leidosPodados = new Set([...ticketsLeidos].filter((id) => idsVisibles.has(id)));
          if (leidosPodados.size !== ticketsLeidos.size) guardarTicketsLeidos(leidosPodados);

          grupos.push({
            label: 'Solicitudes nuevas',
            items: recientes.map((t) => ({
              tipo: 'ticket',
              id: t.id,
              icono: ICONO_NOTIF_TICKET,
              titulo: `Ticket ${t.folio}`,
              sub: `RFC ${t.rfc} · nueva solicitud`,
              tiempo: tiempoRelativoNotif(t.creado_en),
              leido: leidosPodados.has(t.id),
            })),
          });
          notifDatosActuales.ticketsLeidos = leidosPodados;
        }
      } catch (_) {
        // Sin conexión: la campana simplemente no actualiza este
        // sondeo, no interrumpe el resto del panel.
      }
    }

    if (inventarioAplica) {
      try {
        const res = await fetch(`${API_BASE}/admin/inventarios/dashboard`, { headers: { Authorization: authHeader } });
        if (res.ok) {
          const data = await res.json();
          const items = [];
          const bajoMinimo = data.productos_bajo_minimo || 0;
          const porVencer = data.productos_por_vencer || 0;
          if (bajoMinimo > 0) {
            items.push({
              tipo: 'inv_bajo_minimo',
              id: 'inv_bajo_minimo',
              icono: ICONO_NOTIF_INVENTARIO,
              warn: true,
              titulo: `${bajoMinimo} producto${bajoMinimo === 1 ? '' : 's'} bajo mínimo`,
              sub: 'Revisa el punto de reorden en Inventarios',
              tiempo: '',
              leido: (snapshot.inv_bajo_minimo || 0) >= bajoMinimo,
            });
          }
          if (porVencer > 0) {
            items.push({
              tipo: 'inv_por_vencer',
              id: 'inv_por_vencer',
              icono: ICONO_NOTIF_VENCER,
              warn: true,
              titulo: `${porVencer} producto${porVencer === 1 ? '' : 's'} por vencer`,
              sub: `Dentro de los próximos ${diasMaximoAvisoExpiracionActual()} días`,
              tiempo: '',
              leido: (snapshot.inv_por_vencer || 0) >= porVencer,
            });
          }
          grupos.push({ label: 'Inventario', items });
        }
      } catch (_) {
        // ver arriba.
      }
    }

    if (configAplica) {
      try {
        const res = await fetch(`${API_BASE}/admin/tickets/pendientes-sin-contador`, { headers: { Authorization: authHeader } });
        if (res.ok) {
          const data = await res.json();
          const items = [];
          if (data.total > 0) {
            items.push({
              tipo: 'cfg_sin_contador',
              id: 'cfg_sin_contador',
              icono: ICONO_NOTIF_CONFIG,
              warn: true,
              titulo: `${data.total} ticket${data.total === 1 ? '' : 's'} sin correo de contador`,
              sub: 'Configura el correo en SMTP para notificar solo',
              tiempo: '',
              leido: (snapshot.cfg_sin_contador || 0) >= data.total,
            });
          }
          grupos.push({ label: 'Configuración', items });
        }
      } catch (_) {
        // ver arriba.
      }
    }

    notifDatosActuales.snapshot = snapshot;
    els.notifLinkTickets.hidden = !ticketsAplican;
    els.notifLinkInventarios.hidden = !inventarioAplica;
    renderNotifPanel(grupos);
    actualizarBadgeNotif(grupos);
  }

  function marcarNotifItemLeido(tipo, id) {
    if (tipo === 'ticket') {
      const leidos = leerTicketsLeidos();
      leidos.add(Number(id));
      guardarTicketsLeidos(leidos);
    } else {
      // Condición viva (inventario/config): el snapshot guarda el
      // número que se acaba de ver, para que el punto rojo solo vuelva
      // si más adelante ese número sube.
      const snapshot = leerSnapshotNotif();
      const item = els.notifList.querySelector(`[data-tipo="${tipo}"]`);
      const titulo = item ? item.querySelector('.admin-notif-item-title').textContent : '';
      const numero = parseInt(titulo, 10);
      snapshot[tipo] = Number.isFinite(numero) ? numero : (snapshot[tipo] || 0) + 1;
      guardarSnapshotNotif(snapshot);
    }
    const el = els.notifList.querySelector(`[data-tipo="${tipo}"][data-id="${id}"]`);
    if (el) el.classList.add('is-read');
    els.notifDot.hidden = !els.notifList.querySelector('.admin-notif-item:not(.is-read)');
  }

  // Punto 339: al hacer clic en un item de la campana, además de marcarlo
  // leído, lleva directo al elemento que contiene — un ticket abre su
  // modal "Gestionar", "por vencer"/"bajo mínimo" abren Inventarios ya
  // filtrado, y "sin correo de contador" abre Configuraciones → SMTP.
  async function abrirTicketPorId(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    els.ticketsFiltroEstatus.value = '';
    cambiarVistaPrincipal('tickets');
    cargarTickets();
    try {
      const res = await fetch(`${API_BASE}/admin/tickets`, { headers: { Authorization: authHeader } });
      if (!res.ok) return;
      const data = await res.json();
      const ticket = (data.tickets || []).find((t) => t.id === Number(id));
      if (ticket) abrirTicketModal(ticket);
    } catch (err) {
      // Sin conexión: se queda en la lista de tickets, sin el modal abierto.
    }
  }

  function abrirDestinoNotif(tipo, id) {
    if (tipo === 'ticket') {
      abrirTicketPorId(id);
    } else if (tipo === 'inv_bajo_minimo') {
      cambiarVistaPrincipal('inventarios');
      cambiarVistaInventarios('activos');
      activarChipStockInv('bajo_minimo');
    } else if (tipo === 'inv_por_vencer') {
      cambiarVistaPrincipal('inventarios');
      abrirPorVencerModal();
    } else if (tipo === 'cfg_sin_contador') {
      abrirConfigModal();
      seleccionarSeccionConfig('smtp-config-card');
    }
  }

  // ---------- Sonido: campanada sintetizada, sin archivo nuevo ----------
  // Web Audio API, 2 notas cortas — nada que descargar ni mantener como
  // asset. Solo para tickets nuevos (confirmado con el usuario) — nunca
  // para inventario/configuración. El AudioContext se crea perezoso, en
  // el primer sondeo que de verdad encuentra algo, nunca al cargar la
  // página (política de autoplay de los navegadores).
  let notifAudioCtx = null;
  function tonoCampanaNotif(freq, inicio, duracion, volumen) {
    const osc = notifAudioCtx.createOscillator();
    const gain = notifAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, notifAudioCtx.currentTime + inicio);
    gain.gain.linearRampToValueAtTime(volumen, notifAudioCtx.currentTime + inicio + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, notifAudioCtx.currentTime + inicio + duracion);
    osc.connect(gain).connect(notifAudioCtx.destination);
    osc.start(notifAudioCtx.currentTime + inicio);
    osc.stop(notifAudioCtx.currentTime + inicio + duracion + 0.05);
  }
  function reproducirCampanadaNotif() {
    try {
      if (!notifAudioCtx) notifAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (notifAudioCtx.state === 'suspended') notifAudioCtx.resume();
      tonoCampanaNotif(1318.51, 0, 0.32, 0.09);
      tonoCampanaNotif(1567.98, 0.09, 0.34, 0.08);
    } catch (_) {
      // Audio bloqueado por el navegador: la notificación visual sigue
      // funcionando igual, el sonido es un extra.
    }
  }
  function sacudirCampanaNotif() {
    els.btnNotificaciones.classList.remove('is-ringing');
    void els.btnNotificaciones.offsetWidth;
    els.btnNotificaciones.classList.add('is-ringing');
  }

  function detenerSondeoNotificaciones() {
    if (notifPollingId) {
      clearInterval(notifPollingId);
      notifPollingId = null;
    }
  }
  function iniciarSondeoNotificaciones() {
    detenerSondeoNotificaciones();
    notifPollingId = setInterval(() => actualizarNotificaciones({ sondeo: true }), 60000);
  }
  // Pausa el sondeo con la pestaña en segundo plano (cero peticiones
  // desperdiciadas) y refresca de inmediato al volver, en vez de
  // esperar hasta el siguiente tick de 60s.
  document.addEventListener('visibilitychange', () => {
    if (!els.btnNotificaciones || els.btnNotificaciones.hidden) return;
    if (document.visibilityState === 'hidden') {
      detenerSondeoNotificaciones();
    } else {
      actualizarNotificaciones({ sondeo: false });
      iniciarSondeoNotificaciones();
    }
  });

  els.btnNotificaciones.addEventListener('click', (e) => {
    // Mismo bug encontrado en la propuesta visual: sin stopPropagation
    // aquí, este clic burbujea hasta el listener de document de abajo
    // (que cierra el panel al hacer clic FUERA) y se cierra en el
    // mismo evento — la animación nunca llega a verse.
    e.stopPropagation();
    const abriendo = !els.notifPanel.classList.contains('is-open');
    els.notifPanel.classList.toggle('is-open');
    els.btnNotificaciones.setAttribute('aria-expanded', String(abriendo));
  });
  els.notifPanel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => els.notifPanel.classList.remove('is-open'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') els.notifPanel.classList.remove('is-open');
  });
  els.notifList.addEventListener('click', (e) => {
    const item = e.target.closest('.admin-notif-item');
    if (!item) return;
    if (!item.classList.contains('is-read')) {
      marcarNotifItemLeido(item.dataset.tipo, item.dataset.id);
    }
    els.notifPanel.classList.remove('is-open');
    abrirDestinoNotif(item.dataset.tipo, item.dataset.id);
  });
  els.btnNotifMarcarTodo.addEventListener('click', (e) => {
    e.stopPropagation();
    els.notifList.querySelectorAll('.admin-notif-item:not(.is-read)').forEach((item) => {
      marcarNotifItemLeido(item.dataset.tipo, item.dataset.id);
    });
  });
  els.notifLinkTickets.addEventListener('click', (e) => {
    e.stopPropagation();
    els.notifPanel.classList.remove('is-open');
    cambiarVistaPrincipal('tickets');
  });
  els.notifLinkInventarios.addEventListener('click', (e) => {
    e.stopPropagation();
    els.notifPanel.classList.remove('is-open');
    cambiarVistaPrincipal('inventarios');
  });

  els.btnGuardarConfig.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    const cambios = {};
    CAMPOS_CONFIGURABLES.forEach((campo) => {
      const checkbox = document.getElementById(`config-${campo}`);
      if (checkbox) cambios[campo] = checkbox.checked;
    });

    setGuardarConfigLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/config/campos-obligatorios`, {
        method: 'PUT',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cambios),
      });

      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast('No se pudieron guardar los cambios.', true);
        return;
      }

      showToast('Configuración guardada. Ya aplica en el formulario público.');
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    } finally {
      setGuardarConfigLoading(false);
    }
  });

  // ---------- Columnas ajustables (mostrar/ocultar + redimensionar) ----------
  // Función reutilizable: antes esto solo existía para la tabla de
  // Constancias, escrito directamente contra sus elementos. Se generalizó
  // para poder ofrecer la misma funcionalidad también en "Ventas
  // registradas", sin duplicar los ~90 líneas de lógica dos veces — cada
  // tabla solo pasa sus propios elementos, lista de columnas y claves de
  // localStorage, y el comportamiento (mostrar/ocultar columnas,
  // arrastrar para cambiar el ancho, con soporte táctil) es idéntico.
  const ANCHO_MIN_COLUMNA = 70;

  function crearControladorColumnas({ tableWrap, columnas, storageKeyVisibles, storageKeyAnchos, btnColumnas, panel }) {
    function cargarColumnasGuardadas() {
      try {
        const raw = localStorage.getItem(storageKeyVisibles);
        return raw ? JSON.parse(raw) : {};
      } catch (err) {
        return {};
      }
    }

    function aplicarColumnasVisibles(visibles) {
      columnas.forEach((col) => {
        const esVisible = visibles[col] !== false; // por defecto, visible
        tableWrap.classList.toggle(`hide-${col}`, !esVisible);
        const checkbox = panel.querySelector(`input[data-col="${col}"]`);
        if (checkbox) checkbox.checked = esVisible;
      });
    }

    function guardarColumnasVisibles() {
      const visibles = {};
      columnas.forEach((col) => {
        const checkbox = panel.querySelector(`input[data-col="${col}"]`);
        visibles[col] = checkbox ? checkbox.checked : true;
      });
      try {
        localStorage.setItem(storageKeyVisibles, JSON.stringify(visibles));
      } catch (err) {
        // Si localStorage no está disponible, la preferencia simplemente no persiste.
      }
      aplicarColumnasVisibles(visibles);
    }

    // Calcula top/left del panel en cada apertura para que quede siempre
    // dentro de la pantalla, sin importar dónde haya quedado el botón
    // "Columnas" tras envolver en pantallas angostas.
    function posicionarPanelColumnas() {
      const margen = 12;
      const botonRect = btnColumnas.getBoundingClientRect();
      const panelWidth = panel.offsetWidth || 220;

      let left = botonRect.right - panelWidth;
      left = Math.max(margen, Math.min(left, window.innerWidth - panelWidth - margen));

      let top = botonRect.bottom + 6;
      const panelHeight = panel.offsetHeight || 0;
      if (panelHeight && top + panelHeight > window.innerHeight - margen) {
        top = Math.max(margen, botonRect.top - panelHeight - 6);
      }

      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    }

    function reposicionarSiAbierto() {
      if (btnColumnas.getAttribute('aria-expanded') === 'true') {
        posicionarPanelColumnas();
      }
    }
    window.addEventListener('resize', reposicionarSiAbierto);
    window.addEventListener('orientationchange', reposicionarSiAbierto);

    panel.addEventListener('change', (e) => {
      if (e.target.matches('input[data-col]')) {
        guardarColumnasVisibles();
      }
    });

    btnColumnas.addEventListener('click', () => {
      const abierto = btnColumnas.getAttribute('aria-expanded') === 'true';
      btnColumnas.setAttribute('aria-expanded', String(!abierto));
      panel.hidden = abierto;
      if (!abierto) {
        // Primero se hace visible (sin posición aún) para poder medir su
        // tamaño real, y luego se coloca dentro de los límites de pantalla.
        posicionarPanelColumnas();
      }
    });

    document.addEventListener('click', (e) => {
      const dentroDelSelector = btnColumnas.contains(e.target) || panel.contains(e.target);
      if (!dentroDelSelector && btnColumnas.getAttribute('aria-expanded') === 'true') {
        btnColumnas.setAttribute('aria-expanded', 'false');
        panel.hidden = true;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && btnColumnas.getAttribute('aria-expanded') === 'true') {
        btnColumnas.setAttribute('aria-expanded', 'false');
        panel.hidden = true;
        btnColumnas.focus();
      }
    });

    // ---- Redimensionar columnas con el mouse ----

    function cargarAnchosGuardados() {
      try {
        const raw = localStorage.getItem(storageKeyAnchos);
        return raw ? JSON.parse(raw) : {};
      } catch (err) {
        return {};
      }
    }

    function guardarAnchoColumna(col, anchoPx) {
      const anchos = cargarAnchosGuardados();
      anchos[col] = anchoPx;
      try {
        localStorage.setItem(storageKeyAnchos, JSON.stringify(anchos));
      } catch (err) {
        // Si localStorage no está disponible, el ancho simplemente no persiste.
      }
    }

    function aplicarAnchosGuardados() {
      const anchos = cargarAnchosGuardados();
      Object.entries(anchos).forEach(([col, anchoPx]) => {
        const th = tableWrap.querySelector(`th[data-col="${col}"]`);
        if (th && anchoPx >= ANCHO_MIN_COLUMNA) {
          th.style.width = `${anchoPx}px`;
        }
      });
    }

    let resizerActivo = null;
    let resizerThInicial = 0;
    let resizerXInicial = 0;

    function iniciarResize(e) {
      const col = e.target.dataset.resizer;
      const th = tableWrap.querySelector(`th[data-col="${col}"]`);
      if (!th) return;

      resizerActivo = { col, th, handle: e.target };
      resizerXInicial = e.clientX;
      resizerThInicial = th.getBoundingClientRect().width;

      e.target.classList.add('is-resizing');
      document.body.classList.add('is-resizing-column');
      e.preventDefault();
    }

    function moverResize(e) {
      if (!resizerActivo) return;
      const delta = e.clientX - resizerXInicial;
      const nuevoAncho = Math.max(ANCHO_MIN_COLUMNA, Math.round(resizerThInicial + delta));
      resizerActivo.th.style.width = `${nuevoAncho}px`;
    }

    function terminarResize() {
      if (!resizerActivo) return;
      const anchoFinal = resizerActivo.th.getBoundingClientRect().width;
      guardarAnchoColumna(resizerActivo.col, Math.round(anchoFinal));
      resizerActivo.handle.classList.remove('is-resizing');
      document.body.classList.remove('is-resizing-column');
      resizerActivo = null;
    }

    tableWrap.addEventListener('mousedown', (e) => {
      if (e.target.matches('.col-resizer')) {
        iniciarResize(e);
      }
    });
    document.addEventListener('mousemove', moverResize);
    document.addEventListener('mouseup', terminarResize);

    // Soporte táctil básico (tablets), equivalente al mouse.
    tableWrap.addEventListener('touchstart', (e) => {
      if (e.target.matches('.col-resizer')) {
        const touch = e.touches[0];
        iniciarResize({ target: e.target, clientX: touch.clientX, preventDefault: () => {} });
      }
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (resizerActivo && e.touches[0]) {
        moverResize({ clientX: e.touches[0].clientX });
      }
    }, { passive: true });
    document.addEventListener('touchend', terminarResize);

    return { cargarColumnasGuardadas, aplicarColumnasVisibles, aplicarAnchosGuardados };
  }

  const controladorColumnasConstancias = crearControladorColumnas({
    tableWrap: els.tableWrap,
    columnas: COLUMNAS_TABLA,
    storageKeyVisibles: COLUMNAS_STORAGE_KEY,
    storageKeyAnchos: ANCHOS_STORAGE_KEY,
    btnColumnas: els.btnColumns,
    panel: els.columnTogglePanel,
  });

  const controladorColumnasOrdenes = crearControladorColumnas({
    tableWrap: els.ordenesTableWrap,
    columnas: COLUMNAS_TABLA_ORDENES,
    storageKeyVisibles: COLUMNAS_ORDENES_STORAGE_KEY,
    storageKeyAnchos: ANCHOS_ORDENES_STORAGE_KEY,
    btnColumnas: els.btnOrdenesColumns,
    panel: els.ordenesColumnTogglePanel,
  });

  const controladorColumnasGastos = crearControladorColumnas({
    tableWrap: els.gastosTableBody ? els.gastosTableBody.closest('.admin-table-wrap') : null,
    columnas: COLUMNAS_TABLA_GASTOS,
    storageKeyVisibles: COLUMNAS_GASTOS_STORAGE_KEY,
    storageKeyAnchos: ANCHOS_GASTOS_STORAGE_KEY,
    btnColumnas: els.btnGastosColumns,
    panel: els.gastosColumnTogglePanel,
  });

  const controladorColumnasTickets = crearControladorColumnas({
    tableWrap: els.ticketsTableBody ? els.ticketsTableBody.closest('.admin-table-wrap') : null,
    columnas: COLUMNAS_TABLA_TICKETS,
    storageKeyVisibles: COLUMNAS_TICKETS_STORAGE_KEY,
    storageKeyAnchos: ANCHOS_TICKETS_STORAGE_KEY,
    btnColumnas: els.btnTicketsColumns,
    panel: els.ticketsColumnTogglePanel,
  });

  const controladorColumnasCxc = crearControladorColumnas({
    tableWrap: els.cxcTableBody ? els.cxcTableBody.closest('.admin-table-wrap') : null,
    columnas: COLUMNAS_TABLA_CXC,
    storageKeyVisibles: COLUMNAS_CXC_STORAGE_KEY,
    storageKeyAnchos: ANCHOS_CXC_STORAGE_KEY,
    btnColumnas: els.btnCxcColumns,
    panel: els.cxcColumnTogglePanel,
  });

  const controladorColumnasUsuarios = crearControladorColumnas({
    tableWrap: els.usuariosTableBody ? els.usuariosTableBody.closest('.admin-table-wrap') : null,
    columnas: COLUMNAS_TABLA_USUARIOS,
    storageKeyVisibles: COLUMNAS_USUARIOS_STORAGE_KEY,
    storageKeyAnchos: ANCHOS_USUARIOS_STORAGE_KEY,
    btnColumnas: els.btnUsuariosColumns,
    panel: els.usuariosColumnTogglePanel,
  });

  const controladorColumnasInventarios = crearControladorColumnas({
    tableWrap: els.invTableBody ? els.invTableBody.closest('.admin-table-wrap') : null,
    columnas: COLUMNAS_TABLA_INVENTARIOS,
    storageKeyVisibles: COLUMNAS_INVENTARIOS_STORAGE_KEY,
    storageKeyAnchos: ANCHOS_INVENTARIOS_STORAGE_KEY,
    btnColumnas: els.btnInvColumns,
    panel: els.invColumnTogglePanel,
  });

  // ---------- Carga de registros ----------

  async function cargarRegistros() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.adminError.textContent = '';
    Esqueleto.aplicarEsqueletoTabla(els.tableBody, 8);
    try {
      const query = state.vista === 'papelera' ? '?papelera=true' : '';
      const res = await fetch(`${API_BASE}/admin/registros${query}`, {
        headers: { Authorization: authHeader },
      });

      if (res.status === 401) {
        clearSession();
        showLogin();
        els.loginError.textContent = 'Tu sesión expiró. Inicia sesión de nuevo.';
        return;
      }
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.tableBody, 8, 'No se pudieron cargar los registros.', cargarRegistros);
        return;
      }

      const data = await res.json();
      state.registros = data.registros || [];
      aplicarFiltro();
      Esqueleto.quitarEsqueletoTabla(els.tableBody);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.tableBody, 8, 'No se pudo conectar con el servidor.', cargarRegistros);
    }
  }

  // ---------- Búsqueda / filtro ----------

  function registrosFiltrados() {
    const query = normalizar(els.searchInput.value.trim());
    if (!query) return state.registros;
    return state.registros.filter((r) => {
      const nombre = normalizar(r.nombre);
      const rfc = normalizar(r.rfc);
      return nombre.includes(query) || rfc.includes(query);
    });
  }

  function aplicarFiltro() {
    const filtrados = registrosFiltrados();
    renderTabla(filtrados, state.registros.length);
  }

  const aplicarFiltroDebounced = debounce(aplicarFiltro, 150);

  els.searchInput.addEventListener('input', () => {
    els.btnClearSearch.hidden = els.searchInput.value.length === 0;
    aplicarFiltroDebounced();
  });

  els.btnClearSearch.addEventListener('click', () => {
    els.searchInput.value = '';
    els.btnClearSearch.hidden = true;
    els.searchInput.focus();
    aplicarFiltro();
  });

  function renderTabla(registros, totalSinFiltrar) {
    const hayFiltro = els.searchInput.value.trim().length > 0;
    els.adminCount.textContent = hayFiltro
      ? `${registros.length} de ${totalSinFiltrar} registro${totalSinFiltrar === 1 ? '' : 's'}`
      : `${registros.length} registro${registros.length === 1 ? '' : 's'}`;

    els.tableBody.innerHTML = '';
    els.tableEmpty.hidden = registros.length > 0;
    if (hayFiltro) {
      els.tableEmpty.textContent = 'No hay registros que coincidan con tu búsqueda.';
    } else {
      els.tableEmpty.textContent =
        state.vista === 'papelera' ? 'La papelera está vacía.' : 'Aún no hay registros.';
    }

    registros.forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-nombre" data-label="Nombre / razón social" data-col="nombre"></td>
        <td data-label="Tipo" data-col="tipo">${escapeHtml(tipoPersonaLabel(r.tipo_persona))}</td>
        <td data-label="RFC" data-col="rfc">${escapeHtml(r.rfc || '—')}</td>
        <td class="col-regimen" data-label="Régimen fiscal" data-col="regimen">${escapeHtml(r.regimen_fiscal || '—')}</td>
        <td data-label="Código postal" data-col="cp">${escapeHtml(r.codigo_postal || '—')}</td>
        <td data-label="Correo" data-col="correo">${escapeHtml(r.email)}</td>
        <td class="col-documento" data-label="Documento" data-col="documento">
          ${escapeHtml(r.archivo_nombre_original)}<br/>
          <small>${formatBytes(r.archivo_tamano_bytes)}</small>
        </td>
        <td data-label="Actualizado" data-col="actualizado">${formatFecha(r.actualizado_en)}</td>
        <td data-label=""></td>
      `;

      // El nombre/razón social funciona como hipervínculo hacia la vista
      // previa del documento: así se puede validar un dato rápido sin
      // descargar el archivo ni agregar otro botón a la fila.
      const celdaNombre = tr.querySelector('.col-nombre');
      const nombreTexto = r.nombre || '—';
      const enlaceNombre = document.createElement('a');
      enlaceNombre.href = '#';
      enlaceNombre.className = 'nombre-preview-link';
      enlaceNombre.textContent = nombreTexto;
      enlaceNombre.setAttribute('data-tooltip', 'Ver vista previa del documento');
      enlaceNombre.addEventListener('click', (e) => {
        e.preventDefault();
        abrirPreviewArchivo(r);
      });
      celdaNombre.appendChild(enlaceNombre);

      const celdaAcciones = tr.lastElementChild;
      const contenedorAcciones = document.createElement('div');
      contenedorAcciones.className = 'admin-row-actions admin-row-actions-iconos';

      contenedorAcciones.appendChild(botonAccionInv({ tooltip: 'Ver archivo', icono: ICONO_OJO, onClick: () => verArchivo(r.id, r.archivo_nombre_original) }));

      if (state.vista === 'papelera') {
        contenedorAcciones.appendChild(botonAccionInv({ tooltip: 'Restaurar', icono: ICONO_RESTAURAR, onClick: () => restaurarRegistro(r.id, r.nombre) }));
        contenedorAcciones.appendChild(botonAccionInv({ tooltip: 'Eliminar permanentemente', peligro: true, icono: ICONO_PAPELERA, onClick: () => confirmarEliminarPermanente(r.id, r.nombre) }));
      } else {
        contenedorAcciones.appendChild(botonAccionInv({ tooltip: 'Eliminar', peligro: true, icono: ICONO_PAPELERA, onClick: () => confirmarEliminar(r.id, r.nombre) }));
      }

      celdaAcciones.appendChild(contenedorAcciones);
      els.tableBody.appendChild(tr);
    });
  }

  async function verArchivo(id, nombreOriginal) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/archivo/${id}`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast('No se pudo abrir el archivo.', true);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        // Si el navegador bloquea la ventana emergente, se ofrece descarga directa.
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreOriginal || 'archivo';
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      showToast('No se pudo abrir el archivo.', true);
    }
  }

  // ---------- Vista previa del documento (sin descargarlo) ----------

  let previewUrlActual = null;
  let previewDescargaNombre = '';

  function limpiarPreview() {
    if (previewUrlActual) {
      URL.revokeObjectURL(previewUrlActual);
      previewUrlActual = null;
    }
    els.previewFrame.hidden = true;
    els.previewFrame.src = 'about:blank';
    els.previewImage.hidden = true;
    els.previewImage.src = '';
    els.previewStatus.hidden = false;
    els.previewStatus.textContent = 'Cargando documento…';
  }

  function cerrarPreview() {
    els.previewOverlay.hidden = true;
    limpiarPreview();
  }

  els.btnPreviewCerrar.addEventListener('click', cerrarPreview);
  els.previewOverlay.addEventListener('click', (e) => {
    if (e.target === els.previewOverlay) cerrarPreview();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.previewOverlay.hidden) cerrarPreview();
  });

  els.btnPreviewDescargar.addEventListener('click', () => {
    if (!previewUrlActual) return;
    const a = document.createElement('a');
    a.href = previewUrlActual;
    a.download = previewDescargaNombre || 'archivo';
    a.click();
  });

  async function abrirPreviewArchivo(registro) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.previewTitle.textContent = registro.nombre || 'Vista previa';
    els.previewSubtitle.textContent = registro.archivo_nombre_original || '';
    previewDescargaNombre = registro.archivo_nombre_original || 'archivo';
    limpiarPreview();
    els.previewOverlay.hidden = false;

    try {
      const res = await fetch(`${API_BASE}/admin/archivo/${registro.id}`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        cerrarPreview();
        showLogin();
        return;
      }
      if (!res.ok) {
        els.previewStatus.textContent = 'No se pudo cargar la vista previa. Intenta descargar el archivo.';
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      previewUrlActual = url;

      const esImagen = (registro.archivo_mime || '').startsWith('image/');
      if (esImagen) {
        // Retrocompatibilidad: registros subidos antes de que el sitio
        // exigiera solo PDF pueden tener una imagen en vez de un PDF.
        els.previewImage.hidden = false;
        els.previewImage.src = url;
      } else {
        els.previewFrame.hidden = false;
        els.previewFrame.src = url;
      }
      els.previewStatus.hidden = true;
    } catch (err) {
      els.previewStatus.textContent = 'No se pudo cargar la vista previa. Intenta descargar el archivo.';
    }
  }

  // ---------- Vista Activos / Papelera ----------

  function cambiarVista(nuevaVista) {
    if (state.vista === nuevaVista) return;
    state.vista = nuevaVista;

    const esPapelera = nuevaVista === 'papelera';
    els.btnVerActivos.classList.toggle('is-active', !esPapelera);
    els.btnVerActivos.setAttribute('aria-selected', String(!esPapelera));
    els.btnVerPapelera.classList.toggle('is-active', esPapelera);
    els.btnVerPapelera.classList.toggle('is-danger-context', esPapelera);
    els.btnVerPapelera.setAttribute('aria-selected', String(esPapelera));
    els.tablaTitulo.textContent = esPapelera ? 'Papelera' : 'Registros recibidos';

    // La búsqueda se reinicia al cambiar de vista, para evitar confusión
    // sobre en cuál lista se está filtrando.
    els.searchInput.value = '';
    els.btnClearSearch.hidden = true;

    cargarRegistros();
  }

  els.btnVerActivos.addEventListener('click', () => cambiarVista('activos'));
  els.btnVerPapelera.addEventListener('click', () => cambiarVista('papelera'));

  // ---------- Modal de confirmación genérico ----------

  let accionConfirmada = null;

  // `variante` ('danger' por defecto, sin cambiar ningún llamador
  // existente): "primario" pinta el botón de aceptar en azul en vez de
  // rojo — para confirmaciones NO destructivas (ej. "Continuar
  // borrador" de Registrar venta) donde un botón rojo leería como
  // acción peligrosa sin serlo.
  function abrirConfirmacion({ titulo, mensaje, textoBoton, onConfirmar, variante }) {
    els.confirmModalTitle.textContent = titulo;
    els.confirmModalMensaje.textContent = mensaje;
    els.btnConfirmAceptar.textContent = textoBoton;
    els.btnConfirmAceptar.classList.toggle('btn-danger', variante !== 'primario');
    els.btnConfirmAceptar.classList.toggle('btn-primary', variante === 'primario');
    accionConfirmada = onConfirmar;
    els.confirmModalOverlay.hidden = false;
  }

  function cerrarConfirmacion() {
    els.confirmModalOverlay.hidden = true;
    accionConfirmada = null;
  }

  els.btnConfirmCancelar.addEventListener('click', cerrarConfirmacion);

  els.btnConfirmAceptar.addEventListener('click', async () => {
    const accion = accionConfirmada;
    cerrarConfirmacion();
    if (accion) await accion();
  });

  // ---------- Eliminar (borrado lógico) ----------

  function confirmarEliminar(id, nombre) {
    const etiqueta = nombre ? `"${nombre}"` : 'este registro';
    abrirConfirmacion({
      titulo: '¿Eliminar registro?',
      mensaje: `${etiqueta} se moverá a la papelera. Podrás restaurarlo o eliminarlo permanentemente después.`,
      textoBoton: 'Eliminar',
      onConfirmar: () => eliminarRegistro(id),
    });
  }

  async function eliminarRegistro(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/registros/${id}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'No se pudo eliminar el registro.', true);
        return;
      }
      showToast('Registro movido a la papelera.');
      cargarRegistros();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // ---------- Restaurar ----------

  async function restaurarRegistro(id, nombre) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/registros/${id}/restaurar`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'No se pudo restaurar el registro.', true);
        return;
      }
      showToast(nombre ? `"${nombre}" fue restaurado.` : 'Registro restaurado.');
      cargarRegistros();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // ---------- Eliminar permanentemente (borrado físico) ----------

  function confirmarEliminarPermanente(id, nombre) {
    const etiqueta = nombre ? `"${nombre}"` : 'este registro';
    abrirConfirmacion({
      titulo: 'Eliminar permanentemente',
      mensaje: `Esta acción no se puede deshacer. Se eliminarán ${etiqueta} y su archivo del servidor de forma permanente.`,
      textoBoton: 'Eliminar permanentemente',
      onConfirmar: () => eliminarRegistroPermanente(id),
    });
  }

  async function eliminarRegistroPermanente(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/registros/${id}/permanente`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'No se pudo eliminar el registro.', true);
        return;
      }
      showToast('Registro eliminado permanentemente.');
      cargarRegistros();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // ---------- Modal "Configuraciones" ----------
  // Antes era una vista de página con 6 tarjetas plegables independientes
  // (podían quedar varias abiertas a la vez); ahora es un modal con barra
  // lateral + buscador, una sección visible a la vez (ver PROJECT_STATE.md).
  // Las 6 <section class="admin-config-card"> y todo su contenido/lógica de
  // guardado NO se tocan — solo se selecciona cuál de las 6 se muestra.

  const CONFIG_SECCIONES = [
    { id: 'admin-config-card', label: 'Campos obligatorios de los formularios' },
    { id: 'global-config-card', label: 'Configuraciones fiscales' },
    { id: 'smtp-config-card', label: 'Correo electrónico (SMTP)' },
    { id: 'reportes-config-card', label: 'Notificación de reportes' },
    { id: 'notif-toggle-card', label: 'Notificaciones' },
    { id: 'ordenes-toggle-card', label: 'Módulo Ventas' },
    { id: 'inv-toggle-card', label: 'Módulo Inventarios' },
    { id: 'auditoria-toggle-card', label: 'Módulo Auditoría' },
  ];

  // Grupos de Configuraciones — mismo criterio que
  // GRUPOS_SIDEBAR_NAV: solo deciden cuándo ocultar el título del grupo
  // (0 tarjetas visibles, ya sea por permiso de perfil o por el
  // buscador), nunca cuáles tarjetas existen.
  const GRUPOS_CONFIG_NAV = {
    fiscal: ['admin-config-card', 'global-config-card'],
    comunicacion: ['smtp-config-card', 'reportes-config-card', 'notif-toggle-card'],
    modulos: ['ordenes-toggle-card', 'inv-toggle-card', 'auditoria-toggle-card'],
  };

  function actualizarGruposConfigNav() {
    Object.entries(GRUPOS_CONFIG_NAV).forEach(([grupo, tarjetas]) => {
      const etiqueta = document.querySelector(`.config-modal-nav-group-label[data-grupo="${grupo}"]`);
      if (!etiqueta) return;
      const algunaVisible = tarjetas.some((idTarjeta) => {
        const boton = document.querySelector(`.config-modal-nav-item[data-tarjeta="${idTarjeta}"]`);
        return boton && !boton.hidden;
      });
      etiqueta.hidden = !algunaVisible;
    });
  }

  function mostrarSeccionMovilConfig() {
    els.configModalSidebar.classList.add('is-oculta-movil');
    els.configModalMain.classList.remove('is-oculta-movil');
  }
  function mostrarListaMovilConfig() {
    els.configModalSidebar.classList.remove('is-oculta-movil');
    els.configModalMain.classList.add('is-oculta-movil');
  }

  function seleccionarSeccionConfig(idTarjeta) {
    const seccion = CONFIG_SECCIONES.find((s) => s.id === idTarjeta);
    if (!seccion) return;
    document.querySelectorAll('#config-modal-main-body .admin-config-card').forEach((el) => {
      const activo = el.id === idTarjeta;
      el.classList.toggle('is-active-config-section', activo);
      // El acordeón viejo (ahora inerte, ver admin.css) era quien le
      // quitaba/ponía `hidden` a esta caja al hacer clic — sin eso, se
      // quedaba oculta para siempre (el atributo `hidden` gana con
      // `!important` sin importar el CSS de la sección activa) y ningún
      // campo era visible ni interactuable. Se maneja aquí, igual que
      // antes.
      const body = el.querySelector('.admin-config-body');
      if (body) body.hidden = !activo;
    });
    document.querySelectorAll('.config-modal-nav-item').forEach((btn) => {
      const activo = btn.dataset.tarjeta === idTarjeta;
      btn.classList.toggle('is-active', activo);
      btn.setAttribute('aria-current', activo ? 'true' : 'false');
    });
    els.configModalTitle.textContent = seccion.label;
    if (els.configModalMainBody) els.configModalMainBody.scrollTop = 0;
    if (idTarjeta === 'smtp-config-card') {
      smtpAccSeccionAbierta = 'conexion';
      aplicarAcordeonSmtp();
    }
  }

  function primeraSeccionConfigVisible() {
    const primera = CONFIG_SECCIONES.find((s) => {
      const el = document.getElementById(s.id);
      return el && !el.hidden;
    });
    return primera ? primera.id : null;
  }

  function filtrarNavConfig() {
    const q = els.configModalBuscar.value.trim().toLowerCase();
    let algunaVisible = false;
    document.querySelectorAll('.config-modal-nav-item').forEach((btn) => {
      const tarjeta = document.getElementById(btn.dataset.tarjeta);
      if (!tarjeta || tarjeta.hidden) {
        btn.hidden = true;
        return;
      }
      const coincide = !q || btn.textContent.trim().toLowerCase().includes(q);
      btn.hidden = !coincide;
      if (coincide) algunaVisible = true;
    });
    els.configModalNavEmpty.hidden = algunaVisible;
    actualizarGruposConfigNav();
  }
  els.configModalBuscar.addEventListener('input', filtrarNavConfig);

  document.querySelectorAll('.config-modal-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      seleccionarSeccionConfig(btn.dataset.tarjeta);
      mostrarSeccionMovilConfig();
    });
  });

  function abrirConfigModal() {
    // Los 4 "cargar" de abajo son los mismos que antes se disparaban al
    // entrar a la vista "configuraciones"; cargarConfigSmtp() antes solo
    // se disparaba al abrir su acordeón (ya no existe ese gesto), así que
    // se agrega aquí para no perder el precargado de sus campos.
    cargarConfigCampos();
    cargarInfoUsoCfdi();
    cargarConfigGlobal();
    cargarConfigReportes();
    cargarConfigSmtp();
    els.configModalBuscar.value = '';
    filtrarNavConfig();
    const primera = primeraSeccionConfigVisible();
    if (primera) seleccionarSeccionConfig(primera);
    mostrarListaMovilConfig();
    els.vistaConfiguraciones.hidden = false;
  }

  function cerrarConfigModal() {
    els.vistaConfiguraciones.hidden = true;
  }

  els.btnCerrarConfigModal.addEventListener('click', cerrarConfigModal);
  els.configModalBtnVolver.addEventListener('click', mostrarListaMovilConfig);
  els.vistaConfiguraciones.addEventListener('click', (e) => {
    if (e.target === els.vistaConfiguraciones) cerrarConfigModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.vistaConfiguraciones.hidden) cerrarConfigModal();
  });

  // ---------- Vista Constancias / Tickets / Usuarios ----------

  function cambiarVistaPrincipal(vista) {
    guardarVistaActual(vista);
    aplicarEstadoGruposSidebar(vista);
    // Seleccionar cualquier vista de negocio real cierra el launcher de
    // íconos del menú móvil, si estaba abierto.
    els.adminMenuMovil.hidden = true;
    els.btnVistaInicio.classList.toggle('is-active', vista === 'inicio');
    els.btnVistaInicio.setAttribute('aria-selected', String(vista === 'inicio'));
    els.btnVistaConstancias.classList.toggle('is-active', vista === 'constancias');
    els.btnVistaConstancias.setAttribute('aria-selected', String(vista === 'constancias'));
    els.btnVistaTickets.classList.toggle('is-active', vista === 'tickets');
    els.btnVistaTickets.setAttribute('aria-selected', String(vista === 'tickets'));
    els.btnVistaResumenFinanciero.classList.toggle('is-active', vista === 'resumen-financiero');
    els.btnVistaResumenFinanciero.setAttribute('aria-selected', String(vista === 'resumen-financiero'));
    els.btnVistaOrdenes.classList.toggle('is-active', vista === 'ordenes');
    els.btnVistaOrdenes.setAttribute('aria-selected', String(vista === 'ordenes'));
    els.btnVistaCxc.classList.toggle('is-active', vista === 'cxc');
    els.btnVistaCxc.setAttribute('aria-selected', String(vista === 'cxc'));
    els.btnVistaGastos.classList.toggle('is-active', vista === 'gastos');
    els.btnVistaGastos.setAttribute('aria-selected', String(vista === 'gastos'));
    els.btnVistaInventarios.classList.toggle('is-active', vista === 'inventarios');
    els.btnVistaInventarios.setAttribute('aria-selected', String(vista === 'inventarios'));
    els.btnVistaUsuarios.classList.toggle('is-active', vista === 'usuarios');
    els.btnVistaUsuarios.setAttribute('aria-selected', String(vista === 'usuarios'));
    els.btnVistaLecturaReportes.classList.toggle('is-active', vista === 'lectura-reportes');
    els.btnVistaLecturaReportes.setAttribute('aria-selected', String(vista === 'lectura-reportes'));
    els.btnVistaProveedores.classList.toggle('is-active', vista === 'proveedores');
    els.btnVistaProveedores.setAttribute('aria-selected', String(vista === 'proveedores'));
    els.btnVistaMiCuenta.classList.toggle('is-active', vista === 'mi-cuenta');
    els.btnVistaMiCuenta.setAttribute('aria-selected', String(vista === 'mi-cuenta'));
    els.btnVistaAuditoria.classList.toggle('is-active', vista === 'auditoria');
    els.btnVistaAuditoria.setAttribute('aria-selected', String(vista === 'auditoria'));
    els.vistaInicio.hidden = vista !== 'inicio';
    els.vistaConstancias.hidden = vista !== 'constancias';
    els.vistaTickets.hidden = vista !== 'tickets';
    els.vistaResumenFinanciero.hidden = vista !== 'resumen-financiero';
    els.vistaOrdenes.hidden = vista !== 'ordenes';
    els.vistaCxc.hidden = vista !== 'cxc';
    els.vistaGastos.hidden = vista !== 'gastos';
    els.vistaInventarios.hidden = vista !== 'inventarios';
    els.vistaUsuarios.hidden = vista !== 'usuarios';
    els.vistaLecturaReportes.hidden = vista !== 'lectura-reportes';
    els.vistaProveedores.hidden = vista !== 'proveedores';
    els.vistaMiCuenta.hidden = vista !== 'mi-cuenta';
    els.vistaAuditoria.hidden = vista !== 'auditoria';
    if (vista === 'inicio') cargarInicio();
    if (vista === 'constancias') cargarRegistros();
    if (vista === 'tickets') {
      cargarUsuariosFiltroTickets();
      cargarTickets();
    }
    if (vista === 'ordenes') {
      cargarConfigGlobalParaOrden();
      cargarPeriodosArchivados();
      // Se espera a que la caché de correos (con su razón social) esté
      // lista ANTES de cargar/renderizar la tabla, para que el tooltip
      // de "Correo" tenga los datos disponibles desde el primer render
      // — si se dispararan en paralelo sin esperar, la tabla podría
      // pintarse antes de que la caché tuviera algo que mostrar.
      (async () => {
        await cargarCorreosRegistrados();
        cargarOrdenes();
      })();
    }
    if (vista === 'resumen-financiero') {
    cargarResumenFinanciero();
    // Modo dashboard (punto 119): el layout personalizado del usuario se
    // aplica ANTES de que las tarjetas sean visibles para evitar saltos
    // (CLS) — por eso va en paralelo a la carga de datos, no después.
    cargarPreferenciasDashboard();
  }
    if (vista === 'cxc') cargarCxc();
    if (vista === 'gastos') {
      cargarPeriodosArchivados();
      (async () => {
        await cargarCategoriasGastos();
        cargarGastos();
      })();
    }
    if (vista === 'inventarios') {
      (async () => {
        await Promise.all([cargarCategoriasInventario(), cargarUnidadesInventario()]);
        cargarInventarios();
        cargarDashboardInventario();
      })();
    }
    if (vista === 'usuarios') cargarUsuarios();
    if (vista === 'lectura-reportes') {
      cargarListaReportes();
    }
    if (vista === 'mi-cuenta') cargarMiCuenta();
    if (vista === 'auditoria') cargarAuditoria();
    // Primeros pasos (Fase 2 UX): "revisar" tickets/Constancias/CxC cuenta
    // como paso completado con solo entrar a esa vista una vez.
    if (vista === 'tickets') marcarOnboardingVisto('tickets');
    if (vista === 'constancias') marcarOnboardingVisto('constancias');
    if (vista === 'cxc') marcarOnboardingVisto('cxc');
    if (vista === 'mi-cuenta') marcarOnboardingVisto('mi-cuenta');
    renderOnboardingChecklist();
  }

  els.btnVistaInicio.addEventListener('click', () => cambiarVistaPrincipal('inicio'));
  els.btnVistaConstancias.addEventListener('click', () => cambiarVistaPrincipal('constancias'));
  els.btnVistaTickets.addEventListener('click', () => cambiarVistaPrincipal('tickets'));
  els.btnVistaResumenFinanciero.addEventListener('click', () => cambiarVistaPrincipal('resumen-financiero'));
  els.btnVistaOrdenes.addEventListener('click', () => cambiarVistaPrincipal('ordenes'));
  els.btnVistaCxc.addEventListener('click', () => cambiarVistaPrincipal('cxc'));
  els.btnVistaGastos.addEventListener('click', () => cambiarVistaPrincipal('gastos'));
  els.btnVistaInventarios.addEventListener('click', () => cambiarVistaPrincipal('inventarios'));
  els.btnVistaUsuarios.addEventListener('click', () => cambiarVistaPrincipal('usuarios'));
  els.btnVistaConfiguraciones.addEventListener('click', () => {
    els.adminMenuMovil.hidden = true;
    aplicarEstadoGruposSidebar('configuraciones');
    abrirConfigModal();
  });
  els.btnVistaLecturaReportes.addEventListener('click', () => cambiarVistaPrincipal('lectura-reportes'));
  els.btnVistaProveedores.addEventListener('click', () => cambiarVistaPrincipal('proveedores'));
  els.btnVistaMiCuenta.addEventListener('click', () => cambiarVistaPrincipal('mi-cuenta'));
  els.btnVistaAuditoria.addEventListener('click', () => cambiarVistaPrincipal('auditoria'));

  // ---------- Mi Cuenta ----------
  // Autoservicio de la sesión actual: cualquier perfil ve/edita su propio
  // nombre/teléfono/correo y cambia su contraseña; la identidad de la
  // empresa (razón social/RFC/zona horaria/URL/conteo de operadores) solo
  // se muestra a administrador/super (mismo backend, ver
  // GET /api/admin/mi-cuenta en server.js). Solo datos 100% reales — sin
  // 2FA/bitácora de sesiones/suscripción todavía (ver PROJECT_STATE.md
  // puntos 272/274), a propósito, no fabricados.
  async function cargarMiCuenta() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/admin/mi-cuenta`, { headers: { Authorization: authHeader } });
      if (resp.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!resp.ok) throw new Error('No se pudo cargar tu cuenta.');
      const data = await resp.json();

      els.micuentaUsuarioLabel.textContent = data.usuario || '—';
      els.micuentaPerfilLabel.textContent = data.perfil || '—';

      if (data.editable && data.datos) {
        els.micuentaDatosForm.hidden = false;
        els.micuentaSinDatosNota.hidden = true;
        els.micuentaNombre.value = data.datos.nombre || '';
        els.micuentaTelefono.value = data.datos.telefono || '';
        els.micuentaEmail.value = data.datos.email || '';
        els.micuentaPasswordCard.hidden = false;
        // 2FA/Sesiones/Notificaciones son 100% visuales todavía (ver
        // PROJECT_STATE.md punto 283) — solo se muestran donde hay una
        // cuenta real de por medio (mismo criterio que "editable").
        els.micuenta2faCard.hidden = false;
        els.micuentaSesionesCard.hidden = false;
        els.micuentaSesionUsuario.textContent = data.usuario || '—';
        els.micuentaSesionPerfil.textContent = data.perfil || '—';
        els.micuentaNotifCard.hidden = false;
      } else {
        els.micuentaDatosForm.hidden = true;
        els.micuentaSinDatosNota.hidden = false;
        els.micuentaPasswordCard.hidden = true;
        els.micuenta2faCard.hidden = true;
        els.micuentaSesionesCard.hidden = true;
        els.micuentaNotifCard.hidden = true;
      }

      if (data.empresa) {
        els.micuentaEmpresaCard.hidden = false;
        // Banner/Suscripción/Facturación/Footer de Clarvo Site Market son
        // 100% visuales (punto 272, sin construir) — mismo alcance que la
        // tarjeta de identidad de la empresa (administrador/super).
        els.micuentaBannerMarket.hidden = false;
        els.micuentaSuscripcionCard.hidden = false;
        els.micuentaFacturacionCard.hidden = false;
        els.micuentaFooterMarket.hidden = false;
        els.micuentaRazonSocial.textContent = data.empresa.razonSocial || 'Sin capturar';
        els.micuentaRfc.textContent = data.empresa.rfc || 'Sin capturar';
        els.micuentaRegimen.textContent = data.empresa.regimenFiscal || 'Sin capturar';
        els.micuentaClaveSat.textContent = data.empresa.claveSat || 'Sin capturar';
        els.micuentaZonaHoraria.textContent = data.empresa.zonaHorariaEtiqueta || 'Sin definir';
        els.micuentaTotalOperadores.textContent = String(data.empresa.totalOperadores);
        if (data.empresa.tenantSlug && data.empresa.urlPortal) {
          els.micuentaUrlBar.hidden = false;
          els.micuentaUrlTenant.textContent = data.empresa.urlPortal;
          els.micuentaUrlTenant.href = data.empresa.urlPortal;
        } else {
          els.micuentaUrlBar.hidden = true;
        }
      } else {
        els.micuentaEmpresaCard.hidden = true;
        els.micuentaBannerMarket.hidden = true;
        els.micuentaSuscripcionCard.hidden = true;
        els.micuentaFacturacionCard.hidden = true;
        els.micuentaFooterMarket.hidden = true;
      }
    } catch (err) {
      showToast(err.message || 'No se pudo cargar Mi Cuenta.', true);
    }
  }

  els.btnGuardarMiCuenta.addEventListener('click', async () => {
    setFieldError('micuenta-nombre', '');
    setFieldError('micuenta-telefono', '');
    setFieldError('micuenta-email', '');

    const body = {
      nombre: els.micuentaNombre.value.trim(),
      telefono: els.micuentaTelefono.value.trim(),
      email: els.micuentaEmail.value.trim(),
    };

    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/admin/mi-cuenta`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setFieldError('micuenta-email', data.error || 'No se pudieron guardar tus datos.');
        return;
      }
      showToast(data.mensaje || 'Tus datos se actualizaron correctamente.');
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  });

  els.btnCambiarMiCuentaPassword.addEventListener('click', async () => {
    setFieldError('micuenta-password-actual', '');
    setFieldError('micuenta-password-nueva', '');

    const passwordActual = els.micuentaPasswordActual.value;
    const passwordNueva = els.micuentaPasswordNueva.value;
    if (!passwordActual) {
      setFieldError('micuenta-password-actual', 'Captura tu contraseña actual.');
      return;
    }

    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/admin/mi-cuenta/password`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_actual: passwordActual, password_nueva: passwordNueva }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const enActual = /actual/i.test(data.error || '');
        setFieldError(enActual ? 'micuenta-password-actual' : 'micuenta-password-nueva', data.error || 'No se pudo cambiar la contraseña.');
        return;
      }
      els.micuentaPasswordActual.value = '';
      els.micuentaPasswordNueva.value = '';
      showToast(data.mensaje || 'Contraseña actualizada correctamente.');
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  });

  if (els.btnCopiarUrlMiCuenta) {
    els.btnCopiarUrlMiCuenta.addEventListener('click', async () => {
      const valor = els.micuentaUrlTenant.textContent;
      if (!valor) return;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(valor);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = valor;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        showToast('Enlace copiado al portapapeles.');
      } catch (err) {
        showToast('No se pudo copiar. Selecciona y copia el texto manualmente.', true);
      }
    });
  }

  if (els.btnMiCuentaIrConfiguraciones) {
    els.btnMiCuentaIrConfiguraciones.addEventListener('click', () => {
      abrirConfigModal();
      seleccionarSeccionConfig('global-config-card');
    });
  }

  // ---------- Auditoría (punto 244, mapeo con CLARVO_Planes.md) ----------
  // Consulta real de admin_auditoria (GET /api/admin/auditoria) — nunca
  // cross-tenant (el backend ya acota por tenant_slug del propio
  // req.tenant). Filtrado en el SERVIDOR (no cliente): la tabla puede
  // crecer sin límite práctico, a diferencia de Ventas/Gastos que sí
  // traen todo de un jalón.
  const MECANISMO_ETIQUETA = {
    admin_users: 'Súper (ADMIN_USERS)',
    perfil_bd: 'Cuenta del panel',
    api_credencial: 'Credencial API',
    api_clave: 'Clave API',
    usuario_sucursal: 'Sucursal compartida',
    fallback_admin: 'Cuenta de respaldo (retirada)',
  };
  const PERFIL_CLASE_BADGE = {
    administrador: 'perfil-administrador',
    fiscal: 'perfil-fiscal',
    ventas: 'perfil-ventas',
    cliente: 'perfil-cliente',
    super: 'perfil-super',
  };

  function formatearFechaHoraAuditoria(valor) {
    if (!valor) return '—';
    // El backend manda "YYYY-MM-DD HH:MM:SS" (dateStrings:true) — se
    // muestra tal cual, sin reinterpretar zona horaria (mismo criterio
    // que el resto del panel).
    const [fecha, hora] = String(valor).split(' ');
    return hora ? `${fecha} ${hora.slice(0, 5)}` : fecha;
  }

  function claseEstatusHttp(estatus) {
    if (estatus >= 500) return 'estatus-http-error';
    if (estatus >= 400) return 'estatus-http-warn';
    return 'estatus-http-ok';
  }

  function renderAuditoriaFiltrosChips() {
    renderFiltrosChips(els.auditoriaFiltrosChips, [
      { etiqueta: 'Usuario', valor: els.auditoriaFiltroActor.value.trim(), campos: [els.auditoriaFiltroActor] },
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
    renderAuditoriaFiltrosChips();
    Esqueleto.aplicarEsqueletoTabla(els.auditoriaTableBody, 7);

    const params = new URLSearchParams();
    const actor = els.auditoriaFiltroActor.value.trim();
    if (actor) params.set('actor', actor);
    if (els.auditoriaFiltroDesde.value) params.set('desde', els.auditoriaFiltroDesde.value);
    if (els.auditoriaFiltroHasta.value) params.set('hasta', els.auditoriaFiltroHasta.value);
    params.set('limite', els.auditoriaFiltroLimite.value || '100');

    try {
      const resp = await fetch(`${API_BASE}/admin/auditoria?${params.toString()}`, {
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
      const hayFiltros = Boolean(actor || els.auditoriaFiltroDesde.value || els.auditoriaFiltroHasta.value);
      els.auditoriaEmpty.hidden = registros.length > 0;
      if (registros.length === 0) {
        els.auditoriaEmptyTitulo.textContent = hayFiltros ? 'Sin resultados para tu filtro' : 'Sin accesos registrados todavía';
        els.auditoriaEmptyTexto.textContent = hayFiltros
          ? 'Prueba con otro usuario o un rango de fechas distinto.'
          : 'En cuanto alguien entre al panel, aparecerá aquí.';
      }

      registros.forEach((r) => {
        const tr = document.createElement('tr');
        const claseBadgePerfil = PERFIL_CLASE_BADGE[r.perfil] || 'perfil-cliente';
        const mecanismo = MECANISMO_ETIQUETA[r.mecanismo] || r.mecanismo;
        tr.innerHTML = `
          <td data-label="Fecha y hora">${formatearFechaHoraAuditoria(r.ocurridoEn)}</td>
          <td data-label="Usuario">${escapeHtml(r.actor)}</td>
          <td data-label="Perfil"><span class="perfil-badge ${claseBadgePerfil}">${escapeHtml(r.perfil)}</span></td>
          <td data-label="Acceso">${escapeHtml(mecanismo)}</td>
          <td data-label="Acción"><code>${escapeHtml(r.metodo)} ${escapeHtml(r.ruta)}</code></td>
          <td data-label="Estatus"><span class="estatus-badge ${claseEstatusHttp(r.estatus)}">${r.estatus}</span></td>
          <td data-label="IP">${escapeHtml(r.ip || '—')}</td>
        `;
        els.auditoriaTableBody.appendChild(tr);
      });
      Esqueleto.quitarEsqueletoTabla(els.auditoriaTableBody);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.auditoriaTableBody, 7, err.message || 'No se pudo cargar la auditoría.', cargarAuditoria);
    }
  }

  els.auditoriaFiltroActor.addEventListener('input', cargarAuditoria);
  els.auditoriaFiltroDesde.addEventListener('change', cargarAuditoria);
  els.auditoriaFiltroHasta.addEventListener('change', cargarAuditoria);
  els.auditoriaFiltroLimite.addEventListener('change', cargarAuditoria);
  els.btnLimpiarAuditoriaActor.addEventListener('click', () => limpiarCampoFiltro(els.auditoriaFiltroActor));
  els.btnLimpiarFiltrosAuditoria.addEventListener('click', () => {
    els.auditoriaFiltroActor.value = '';
    els.auditoriaFiltroDesde.value = '';
    els.auditoriaFiltroHasta.value = '';
    els.auditoriaFiltroLimite.value = '100';
    cargarAuditoria();
  });

  // Menú móvil (launcher de íconos) — "Menú" en la barra superior
  // siempre regresa aquí, sin importar el perfil ni qué vista estaba
  // abierta (a propósito: no es "Inicio", que el perfil administrador
  // ni siquiera tiene — ver PROJECT_STATE.md, segmento de rediseño de
  // Ventas/navegación móvil). Oculta las 9 vistas de negocio y muestra
  // el grid; cada botón del grid simplemente llama a
  // cambiarVistaPrincipal(), igual que el sidebar de escritorio.
  function mostrarMenuMovil() {
    els.vistaInicio.hidden = true;
    els.vistaConstancias.hidden = true;
    els.vistaTickets.hidden = true;
    els.vistaResumenFinanciero.hidden = true;
    els.vistaOrdenes.hidden = true;
    els.vistaCxc.hidden = true;
    els.vistaGastos.hidden = true;
    els.vistaInventarios.hidden = true;
    els.vistaUsuarios.hidden = true;
    els.vistaLecturaReportes.hidden = true;
    els.vistaProveedores.hidden = true;
    els.vistaMiCuenta.hidden = true;
    els.vistaAuditoria.hidden = true;
    els.adminMenuMovil.hidden = false;
  }
  // Punto: back físico del celular = mismo efecto que tocar "Menú"
  // (pedido explícito del usuario). Técnica estándar de SPA sin router:
  // se empuja un estado "ancla" al entrar al panel; el `popstate` que
  // dispara el back del sistema operativo se consume abriendo el menú
  // en vez de dejar salir de la página, y se repone el ancla para que
  // el siguiente back quede atrapado igual. Solo aplica en el
  // breakpoint móvil — en escritorio el back del navegador se comporta
  // normal.
  function esMovilMenu() {
    return window.matchMedia('(max-width: 900px)').matches;
  }
  function anclarHistorialMovil() {
    if (esMovilMenu()) history.pushState({ adminMenuAncla: true }, '', location.href);
  }
  window.addEventListener('popstate', () => {
    if (!esMovilMenu()) return;
    mostrarMenuMovil();
    anclarHistorialMovil();
  });

  els.btnMenuMovil.addEventListener('click', mostrarMenuMovil);
  document.querySelectorAll('.admin-menu-movil-btn').forEach((boton) => {
    boton.addEventListener('click', () => {
      // "Configuraciones" ya no es una vista de página — abre el
      // modal en vez de intentar cambiarVistaPrincipal('configuraciones'),
      // que ya no existe como caso válido.
      if (boton.dataset.vista === 'configuraciones') {
        els.adminMenuMovil.hidden = true;
        abrirConfigModal();
        return;
      }
      cambiarVistaPrincipal(boton.dataset.vista);
    });
  });
  els.ticketsFiltroEstatus.addEventListener('change', () => cargarTickets());
  els.ticketsFiltroUsuario.addEventListener('change', () => cargarTickets());
  els.btnRefreshTickets.addEventListener('click', () => cargarTickets());

  // ---------- Cargar y mostrar tickets ----------

  // Llena el filtro "Usuario" con las cuentas que de verdad han quedado
  // registradas en "actualizado_por" — no con la lista completa de
  // cuentas administrativas, para no mostrar opciones que nunca
  // devolverían ningún resultado. Conserva la selección actual si sigue
  // siendo una opción válida (para no perder el filtro activo si se
  // vuelve a llamar esta función).
  async function cargarUsuariosFiltroTickets() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/usuarios-actualizado-por`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();
      const seleccionActual = els.ticketsFiltroUsuario.value;
      els.ticketsFiltroUsuario.innerHTML = '<option value="">Todos los usuarios</option>';
      (data.usuarios || []).forEach((usuario) => {
        const option = document.createElement('option');
        option.value = usuario;
        option.textContent = usuario;
        els.ticketsFiltroUsuario.appendChild(option);
      });
      if ((data.usuarios || []).includes(seleccionActual)) {
        els.ticketsFiltroUsuario.value = seleccionActual;
      }
    } catch (err) {
      // Si falla, el filtro se queda solo con "Todos los usuarios" — no bloquea el resto de la vista.
    }
  }

  // punto 321: "Inicio" del perfil "Inventario" — reutiliza EN VIVO (nunca
  // duplica) el mismo nodo #reportes-vista-estado-inventario + su toolbar
  // (Imprimir/CSV) que ya vive dentro de Reportes → "Estado del
  // inventario" — mismo patrón de reparentado ya usado en el sitio (ej.
  // el modal "ampliar" de las gráficas de Resumen financiero). El nodo
  // solo se mueve una vez (idempotente: si ya está en el slot, no vuelve
  // a moverse) y se queda ahí para el resto de la sesión.
  function cargarInicioInventario() {
    if (els.invEstadoToolbar.parentElement !== els.inicioInventarioSlot) {
      els.inicioInventarioSlot.appendChild(els.invEstadoToolbar);
      els.inicioInventarioSlot.appendChild(els.reportesVistaEstadoInventario);
    }
    els.inicioSubtitulo.textContent = 'Salud de tu inventario ahora mismo: qué se vende, qué no se mueve y cuánto vale.';
    els.inicioInventarioSlot.hidden = false;
    els.invEstadoToolbar.hidden = false;
    els.reportesVistaEstadoInventario.hidden = false;
    els.inicioStatsGrid.hidden = true;
    els.inicioMainGrid.hidden = true;
    els.inicioError.textContent = '';
    cargarEstadoInventario();
  }

  // Vista "Inicio": bienvenida + resumen de tickets, fiel al mockup de
  // stitch (dashboard_portal_addv_fiel_al_mockup). Reutiliza el mismo
  // endpoint GET /admin/tickets que ya usa la vista Tickets — sin
  // agregar un endpoint nuevo — y calcula todo (estatísticas, dona,
  // recientes) en el cliente a partir de esos mismos datos. Para el
  // perfil "Inventario" (punto 321), "Inicio" es un contenido
  // completamente distinto — ver cargarInicioInventario().
  // Punto en curso (gating Facturación): sin Facturación activa,
  // /api/admin/tickets 404 (requiereFeature) — en vez de un error roto,
  // bienvenida + accesos directos a lo que sí está activo. Sin cifras
  // financieras a propósito (pedido explícito: "que no sean datos
  // sensibles") — son enlaces de navegación, no KPIs en vivo.
  const INICIO_SINFACT_MODULOS = [
    { flag: 'ventasHabilitado', vista: 'ordenes', titulo: 'Ventas' },
    { flag: 'gastosHabilitado', vista: 'gastos', titulo: 'Gastos' },
    { flag: 'cxcHabilitado', vista: 'cxc', titulo: 'Cuentas por cobrar' },
    { flag: 'inventariosHabilitado', vista: 'inventarios', titulo: 'Inventarios' },
    { flag: 'resumenFinancieroHabilitado', vista: 'resumen-financiero', titulo: 'Resumen financiero' },
  ];

  function cargarInicioSinFacturacion() {
    els.inicioStatsGrid.hidden = true;
    els.inicioMainGrid.hidden = true;
    els.inicioError.textContent = '';
    const slot = document.getElementById('inicio-sin-facturacion');
    const links = document.getElementById('inicio-sinfact-links');
    slot.hidden = false;
    links.innerHTML = '';
    const activos = INICIO_SINFACT_MODULOS.filter((m) => planPermite(m.flag));
    if (activos.length === 0) {
      links.innerHTML = '<p class="field-hint">Activa un módulo desde /control para ver aquí tus accesos directos.</p>';
      return;
    }
    activos.forEach((m) => {
      const a = document.createElement('a');
      a.href = '#';
      a.className = 'inicio-sinfact-link';
      a.innerHTML = `<span class="dot" aria-hidden="true"></span>${escapeHtml(m.titulo)}`;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        cambiarVistaPrincipal(m.vista);
      });
      links.appendChild(a);
    });
  }

  async function cargarInicio() {
    if (perfilActual === 'inventario') {
      cargarInicioInventario();
      return;
    }
    document.getElementById('inicio-sin-facturacion').hidden = true;
    els.inicioStatsGrid.hidden = false;
    els.inicioMainGrid.hidden = false;
    if (!planPermite('facturacionHabilitada')) {
      els.inicioTituloBienvenida.textContent = usuarioSesionActual ? `¡Bienvenido, ${usuarioSesionActual}!` : '¡Bienvenido!';
      cargarInicioSinFacturacion();
      return;
    }
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.inicioError.textContent = '';
    els.inicioTituloBienvenida.textContent = usuarioSesionActual
      ? `¡Bienvenido, ${usuarioSesionActual}!`
      : '¡Bienvenido!';
    Esqueleto.marcarKpisCargando(els.inicioStatsGrid, true);
    Esqueleto.aplicarEsqueletoTabla(els.inicioRecientesBody, 5);
    try {
      const res = await fetch(`${API_BASE}/admin/tickets`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        Esqueleto.marcarKpisCargando(els.inicioStatsGrid, false);
        Esqueleto.aplicarErrorTabla(els.inicioRecientesBody, 5, 'No se pudieron cargar las solicitudes.', cargarInicio);
        return;
      }
      const data = await res.json();
      renderInicio(data.tickets || []);
      Esqueleto.quitarEsqueletoTabla(els.inicioRecientesBody);
      Esqueleto.marcarKpisCargando(els.inicioStatsGrid, false);
    } catch (err) {
      Esqueleto.marcarKpisCargando(els.inicioStatsGrid, false);
      Esqueleto.aplicarErrorTabla(els.inicioRecientesBody, 5, 'No se pudo conectar con el servidor.', cargarInicio);
    }
  }

  // Compara cuántos tickets de "lista" se crearon en el mes calendario
  // actual (a la fecha) contra el mes calendario anterior completo. Sin
  // datos del mes anterior no se inventa una tendencia — se muestra el
  // conteo del mes en curso en su lugar.
  function aplicarTendencia(elemento, lista) {
    const ahora = new Date();
    const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const contarEnRango = (desde, hasta) =>
      lista.filter((t) => {
        const fecha = new Date(t.creado_en);
        return fecha >= desde && fecha < hasta;
      }).length;

    const actual = contarEnRango(inicioMesActual, ahora);
    const anterior = contarEnRango(inicioMesAnterior, inicioMesActual);

    elemento.classList.remove('es-positiva', 'es-negativa');
    if (anterior === 0) {
      elemento.textContent = actual > 0 ? `${actual} nuevas este mes` : 'Sin cambios este mes';
      return;
    }
    const cambio = Math.round(((actual - anterior) / anterior) * 100);
    elemento.textContent = `${cambio > 0 ? '+' : ''}${cambio}% vs mes anterior`;
    if (cambio > 0) elemento.classList.add('es-positiva');
    if (cambio < 0) elemento.classList.add('es-negativa');
  }

  function renderInicio(tickets) {
    const enProceso = tickets.filter((t) => t.estatus === 'pendiente' || t.estatus === 'en_curso');
    const completadas = tickets.filter((t) => t.estatus === 'listo');
    const rechazadas = tickets.filter((t) => t.estatus === 'cancelado');
    const total = tickets.length;

    els.inicioStatTotal.textContent = total;
    els.inicioStatProceso.textContent = enProceso.length;
    els.inicioStatCompletadas.textContent = completadas.length;
    els.inicioStatRechazadas.textContent = rechazadas.length;
    aplicarTendencia(els.inicioStatTotalTendencia, tickets);
    aplicarTendencia(els.inicioStatProcesoTendencia, enProceso);
    aplicarTendencia(els.inicioStatCompletadasTendencia, completadas);
    aplicarTendencia(els.inicioStatRechazadasTendencia, rechazadas);

    // Dona de 3 segmentos (en proceso / completadas / rechazadas) sobre
    // el total de tickets — el arco vacío del fondo ya representa el resto.
    const circunferencia = 2 * Math.PI * 40;
    els.inicioDonutTotal.textContent = total;
    let acumulado = 0;
    [
      { el: els.inicioDonutProceso, cantidad: enProceso.length, leyenda: els.inicioLeyendaProceso },
      { el: els.inicioDonutCompletadas, cantidad: completadas.length, leyenda: els.inicioLeyendaCompletadas },
      { el: els.inicioDonutRechazadas, cantidad: rechazadas.length, leyenda: els.inicioLeyendaRechazadas },
    ].forEach(({ el, cantidad, leyenda }) => {
      const porcentaje = total > 0 ? (cantidad / total) * 100 : 0;
      const largo = (porcentaje / 100) * circunferencia;
      el.setAttribute('stroke-dasharray', `${largo} ${circunferencia - largo}`);
      el.setAttribute('stroke-dashoffset', String(-acumulado));
      acumulado += largo;
      leyenda.textContent = total > 0 ? `${cantidad} (${Math.round(porcentaje)}%)` : `${cantidad}`;
    });

    // Solicitudes recientes: últimos 5 tickets por fecha de creación —
    // el botón "Gestionar" abre el mismo modal que la vista Tickets.
    const recientes = [...tickets].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en)).slice(0, 5);
    els.inicioRecientesBody.innerHTML = '';
    els.inicioRecientesEmpty.hidden = recientes.length > 0;
    // Perfil "administrador" (2026-09-04): ve el resumen, pero gestionar
    // un ticket (aceptar, subir factura) sigue siendo exclusivo de
    // "fiscal" en el backend — sin botón "Gestionar" para no ofrecer una
    // acción que el servidor rechazaría con 403.
    const puedeGestionar = perfilActual !== 'administrador';
    recientes.forEach((t) => {
      const info = ESTATUS_INFO[t.estatus] || { texto: t.estatus, clase: '' };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Folio"><strong>${escapeHtml(t.folio)}</strong></td>
        <td data-label="Cliente (RFC)">${escapeHtml(t.rfc)}</td>
        <td data-label="Fecha de solicitud">${formatFecha(t.creado_en)}</td>
        <td data-label="Estatus"><span class="estatus-badge ${info.clase}">${escapeHtml(info.texto)}</span></td>
        <td data-label=""></td>
      `;
      if (puedeGestionar) {
        tr.lastElementChild.appendChild(botonAccionInv({ tooltip: 'Gestionar', icono: ICONO_EDITAR, onClick: () => abrirTicketModal(t) }));
      }
      els.inicioRecientesBody.appendChild(tr);
    });
  }

  els.btnInicioVerTodas.addEventListener('click', () => els.btnVistaTickets.click());

  async function cargarTickets() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.ticketsError.textContent = '';
    Esqueleto.aplicarEsqueletoTabla(els.ticketsTableBody, 9);
    try {
      const estatus = els.ticketsFiltroEstatus.value;
      const actualizadoPor = els.ticketsFiltroUsuario.value;
      const params = new URLSearchParams();
      if (estatus) params.set('estatus', estatus);
      if (actualizadoPor) params.set('actualizado_por', actualizadoPor);
      if (state.vistaTickets === 'papelera') params.set('papelera', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/admin/tickets${query}`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.ticketsTableBody, 9, 'No se pudieron cargar los tickets.', cargarTickets);
        return;
      }
      const data = await res.json();
      renderTickets(data.tickets || []);
      Esqueleto.quitarEsqueletoTabla(els.ticketsTableBody);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.ticketsTableBody, 9, 'No se pudo conectar con el servidor.', cargarTickets);
    }
  }

  function renderTickets(tickets) {
    els.ticketsCount.textContent = `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`;
    els.ticketsTableBody.innerHTML = '';
    els.ticketsEmpty.hidden = tickets.length > 0;
    els.ticketsEmpty.textContent =
      state.vistaTickets === 'papelera' ? 'La papelera de tickets está vacía.' : 'No hay tickets todavía.';

    tickets.forEach((t) => {
      const info = ESTATUS_INFO[t.estatus] || { texto: t.estatus, clase: '' };
      const tieneNota = Boolean(t.notas_admin && t.notas_admin.trim());
      const actualizadoPorTexto = t.actualizado_por
        ? `<span class="ticket-actualizado-por">por ${escapeHtml(t.actualizado_por)}</span>`
        : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Folio" data-col="folio"><strong>${escapeHtml(t.folio)}</strong></td>
        <td data-label="RFC" data-col="rfc">${escapeHtml(t.rfc)}</td>
        <td data-label="Uso de CFDI" data-col="uso">${escapeHtml(t.uso_cfdi || '—')}</td>
        <td data-label="Ticket" data-col="ticket">${escapeHtml(t.imagen_nombre_original)}</td>
        <td data-label="Estatus" data-col="estatus"><span class="estatus-badge ${info.clase}">${escapeHtml(info.texto)}</span></td>
        <td data-label="Asignado a" data-col="asignado">${t.actualizado_por ? escapeHtml(t.actualizado_por) : '—'}</td>
        <td data-label="Notas" data-col="notas">${tieneNota ? '<button type="button" class="btn-nota-icono" data-tooltip="Ver nota interna" aria-label="Ver nota interna"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M7 3h8l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M15 3v5h5M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>' : '—'}</td>
        <td data-label="Actualizado" data-col="actualizado">${formatFecha(t.actualizado_en)}${actualizadoPorTexto}</td>
        <td data-label=""></td>
      `;

      // El ícono de nota abre el mismo modal que "Gestionar" — ahí ya se
      // puede leer/copiar el texto completo de la nota, sin duplicar esa
      // interfaz en una segunda ventana emergente aparte.
      if (tieneNota) {
        tr.querySelector('.btn-nota-icono').addEventListener('click', () => abrirTicketModal(t));
      }

      const celdaAcciones = tr.lastElementChild;
      const contenedorAcciones = document.createElement('div');
      contenedorAcciones.className = 'admin-row-actions admin-row-actions-iconos';

      if (state.vistaTickets === 'papelera') {
        contenedorAcciones.appendChild(botonAccionInv({ tooltip: 'Restaurar', icono: ICONO_RESTAURAR, onClick: () => restaurarTicket(t.id, t.folio) }));
        contenedorAcciones.appendChild(botonAccionInv({ tooltip: 'Eliminar permanentemente', peligro: true, icono: ICONO_PAPELERA, onClick: () => confirmarEliminarTicketPermanente(t.id, t.folio) }));
      } else {
        contenedorAcciones.appendChild(botonAccionInv({ tooltip: 'Gestionar', icono: ICONO_EDITAR, onClick: () => abrirTicketModal(t) }));
        contenedorAcciones.appendChild(botonAccionInv({ tooltip: 'Eliminar', peligro: true, icono: ICONO_PAPELERA, onClick: () => confirmarEliminarTicket(t.id, t.folio) }));
      }

      celdaAcciones.appendChild(contenedorAcciones);
      els.ticketsTableBody.appendChild(tr);
    });
  }

  function cambiarVistaTickets(nuevaVista) {
    if (state.vistaTickets === nuevaVista) return;
    state.vistaTickets = nuevaVista;

    const esPapelera = nuevaVista === 'papelera';
    els.btnVerTicketsActivos.classList.toggle('is-active', !esPapelera);
    els.btnVerTicketsActivos.setAttribute('aria-selected', String(!esPapelera));
    els.btnVerTicketsPapelera.classList.toggle('is-active', esPapelera);
    els.btnVerTicketsPapelera.classList.toggle('is-danger-context', esPapelera);
    els.btnVerTicketsPapelera.setAttribute('aria-selected', String(esPapelera));
    els.ticketsTablaTitulo.textContent = esPapelera ? 'Papelera de tickets' : 'Tickets para facturar';

    cargarTickets();
  }

  els.btnVerTicketsActivos.addEventListener('click', () => cambiarVistaTickets('activos'));
  els.btnVerTicketsPapelera.addEventListener('click', () => cambiarVistaTickets('papelera'));

  function confirmarEliminarTicket(id, folio) {
    const etiqueta = folio ? `el ticket "${folio}"` : 'este ticket';
    abrirConfirmacion({
      titulo: '¿Eliminar ticket?',
      mensaje: `${etiqueta} se moverá a la papelera. Podrás restaurarlo o eliminarlo permanentemente después.`,
      textoBoton: 'Eliminar',
      onConfirmar: () => eliminarTicket(id),
    });
  }

  async function eliminarTicket(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'No se pudo eliminar el ticket.', true);
        return;
      }
      showToast(data.mensaje || 'Ticket movido a la papelera.');
      cargarTickets();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  async function restaurarTicket(id, folio) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/${id}/restaurar`, {
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
        showToast(data.error || 'No se pudo restaurar el ticket.', true);
        return;
      }
      showToast(folio ? `El ticket "${folio}" fue restaurado.` : 'Ticket restaurado.');
      cargarTickets();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  function confirmarEliminarTicketPermanente(id, folio) {
    const etiqueta = folio ? `el ticket "${folio}"` : 'este ticket';
    abrirConfirmacion({
      titulo: 'Eliminar permanentemente',
      mensaje: `Esta acción no se puede deshacer. Se eliminarán ${etiqueta}, su imagen y su factura (si ya la tenía) del servidor de forma permanente.`,
      textoBoton: 'Eliminar permanentemente',
      onConfirmar: () => eliminarTicketPermanente(id),
    });
  }

  async function eliminarTicketPermanente(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/${id}/permanente`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'No se pudo eliminar el ticket permanentemente.', true);
        return;
      }
      showToast(data.mensaje || 'Ticket eliminado permanentemente.');
      cargarTickets();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // ---------- Modal de gestión de ticket ----------

  let ticketActual = null;
  let ticketImagenUrlActual = null;

  async function abrirTicketModal(ticket) {
    ticketActual = ticket;
    // Si el tipo de pago es "otro", se muestra directamente lo que el
    // cliente escribió (ej. "Vale de despensa") en vez de solo la
    // palabra genérica "Otro" — es la parte que de verdad le sirve al
    // administrador.
    const tipoPagoTexto =
      ticket.tipo_pago === 'otro'
        ? ticket.tipo_pago_otro || 'Otro (sin especificar)'
        : ticket.tipo_pago
        ? TIPOS_PAGO_INFO[ticket.tipo_pago] || ticket.tipo_pago
        : '—';
    els.ticketModalTitle.textContent = `Ticket ${ticket.folio}`;
    const estatusInfo = ESTATUS_INFO[ticket.estatus] || { texto: ticket.estatus, clase: '' };
    els.ticketModalEstatusBadge.textContent = estatusInfo.texto;
    els.ticketModalEstatusBadge.className = `estatus-badge ${estatusInfo.clase}`;
    els.ticketModalInfoRfc.textContent = ticket.rfc;
    els.ticketModalInfoUsoCfdi.textContent = ticket.uso_cfdi || '—';
    els.ticketModalInfoTipoPago.textContent = tipoPagoTexto;
    els.ticketModalInfoActualizadoPor.textContent = ticket.actualizado_por || '— (todavía nadie le ha cambiado el estatus)';
    els.ticketModalInfoDocumento.textContent = ticket.imagen_nombre_original;

    // Datos que el cliente capturó en "Verifica tu venta" al subir el
    // ticket — justo arriba de la foto, para poder cotejarlos contra lo
    // que dice el ticket real. Solo hay algo que mostrar si el ticket
    // quedó vinculado a una orden real (con "Ventas"
    // habilitada al momento de subirlo) — si no, se oculta la caja
    // completa en vez de mostrarla vacía.
    if (ticket.orden_numero_compra && ticket.orden_fecha_compra_formateada) {
      els.ticketModalCompraNumero.textContent = ticket.orden_numero_compra;
      els.ticketModalCompraFecha.textContent = ticket.orden_fecha_compra_formateada.fecha;
      els.ticketModalCompraHora.textContent = ticket.orden_fecha_compra_formateada.hora;
      els.ticketModalCompraTotal.textContent = `$${formatearMoneda(ticket.orden_total)} MXN`;
      els.ticketModalCompraBox.hidden = false;
    } else {
      els.ticketModalCompraBox.hidden = true;
    }

    if (ticket.comentarios) {
      els.ticketModalComentariosTexto.textContent = ticket.comentarios;
      els.ticketModalComentariosBox.hidden = false;
    } else {
      els.ticketModalComentariosTexto.textContent = '';
      els.ticketModalComentariosBox.hidden = true;
    }
    els.ticketModalNotas.value = ticket.notas_admin || '';
    els.ticketModalEstatusSelect.value = ticket.estatus === 'listo' ? 'listo' : ticket.estatus;
    els.ticketModalFacturaInput.value = '';

    // Monto facturado (punto: negocios "solo facturas", sin venta que
    // verificar) — leído del XML al subir la factura, o capturado a mano
    // si el XML no traía un Total legible. El aviso/campo manual siempre
    // arrancan ocultos: solo se revelan si una subida real los necesita.
    if (ticket.monto_factura !== null && ticket.monto_factura !== undefined) {
      els.ticketModalMontoFacturaValor.textContent = `$${formatearMoneda(ticket.monto_factura)} MXN`;
      els.ticketModalMontoFacturaFuente.textContent =
        ticket.monto_factura_origen === 'manual' ? 'Capturado manualmente' : 'Leído automáticamente del XML';
      els.ticketModalMontoFactura.hidden = false;
    } else {
      els.ticketModalMontoFactura.hidden = true;
    }
    els.ticketModalFacturaAviso.hidden = true;
    els.ticketModalMontoManualWrap.hidden = true;
    els.ticketModalMontoManual.value = '';
    setFieldError('ticket-modal-monto-manual', '');

    // Si el ticket ya tiene una factura subida, se ofrece descargarla, y
    // el botón/label de subir deja claro que un nuevo archivo la
    // REEMPLAZA — no que se está subiendo una factura por primera vez.
    if (ticket.factura_nombre_original) {
      els.ticketModalFacturaActual.hidden = false;
      els.ticketModalFacturaActualNombre.textContent = ticket.factura_nombre_original;
      els.labelTicketModalFacturaInput.textContent = 'Reemplazar factura';
      els.btnTicketSubirFacturaLabel.textContent = 'Reemplazar factura y marcar como listo';
    } else {
      els.ticketModalFacturaActual.hidden = true;
      els.ticketModalFacturaActualNombre.textContent = '';
      els.labelTicketModalFacturaInput.textContent = 'Subir factura';
      els.btnTicketSubirFacturaLabel.textContent = 'Subir factura y marcar como listo';
    }

    els.ticketModalImagen.hidden = true;
    els.ticketModalImagen.removeAttribute('src');
    els.ticketModalImagenStatus.hidden = false;
    els.ticketModalImagenStatus.textContent = 'Cargando imagen…';
    els.ticketModalOverlay.hidden = false;

    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/${ticket.id}/imagen`, {
        headers: { Authorization: authHeader },
      });
      if (res.ok) {
        const blob = await res.blob();
        if (ticketImagenUrlActual) URL.revokeObjectURL(ticketImagenUrlActual);
        ticketImagenUrlActual = URL.createObjectURL(blob);
        els.ticketModalImagen.src = ticketImagenUrlActual;
        els.ticketModalImagen.hidden = false;
        els.ticketModalImagenStatus.hidden = true;
      } else {
        els.ticketModalImagenStatus.textContent = 'No se pudo cargar la imagen.';
      }
    } catch (err) {
      els.ticketModalImagenStatus.textContent = 'No se pudo cargar la imagen.';
    }
  }

  function cerrarTicketModal() {
    els.ticketModalOverlay.hidden = true;
    if (ticketImagenUrlActual) {
      URL.revokeObjectURL(ticketImagenUrlActual);
      ticketImagenUrlActual = null;
    }
    ticketActual = null;
  }

  els.btnTicketModalCerrar.addEventListener('click', cerrarTicketModal);
  els.ticketModalOverlay.addEventListener('click', (e) => {
    if (e.target === els.ticketModalOverlay) cerrarTicketModal();
  });

  // Efecto lupa: la imagen se agranda al pasar el cursor, siguiendo la
  // posición del mouse dentro del contenedor (en vez de un zoom fijo al
  // centro), para poder recorrer el ticket y leer los detalles.
  els.ticketModalImagenWrap.addEventListener('mousemove', (e) => {
    if (els.ticketModalImagen.hidden) return;
    const rect = els.ticketModalImagenWrap.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    els.ticketModalImagen.style.transformOrigin = `${x}% ${y}%`;
  });

  els.btnTicketDescargarImagen.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader || !ticketActual) return;
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/${ticketActual.id}/imagen`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        showToast('No se pudo descargar la imagen.', true);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ticketActual.imagen_nombre_original || `ticket-${ticketActual.folio}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      showToast('No se pudo descargar la imagen.', true);
    }
  });

  function setGuardandoEstatusLoading(cargando) {
    els.btnTicketGuardarEstatus.disabled = cargando;
    els.btnTicketGuardarEstatusLabel.textContent = cargando ? 'Guardando…' : 'Guardar cambios';
  }

  els.btnTicketGuardarEstatus.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader || !ticketActual) return;

    const nuevoEstatus = els.ticketModalEstatusSelect.value;
    if (nuevoEstatus === 'cancelado') {
      const ticketACancelar = ticketActual;
      cerrarTicketModal(); // se vuelve a abrir el modal de confirmacion aparte
      abrirConfirmacion({
        titulo: '¿Cancelar este ticket?',
        mensaje: `El ticket ${ticketACancelar ? ticketACancelar.folio : ''} se marcará como cancelado.`,
        textoBoton: 'Cancelar ticket',
        onConfirmar: () => guardarEstatusTicket(ticketACancelar, nuevoEstatus),
      });
      return;
    }

    await guardarEstatusTicket(ticketActual, nuevoEstatus);
  });

  async function guardarEstatusTicket(ticket, estatus) {
    const authHeader = getAuthHeader();
    if (!authHeader || !ticket) return;
    setGuardandoEstatusLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/${ticket.id}/estatus`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estatus, notas_admin: els.ticketModalNotas.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'No se pudo actualizar el ticket.', true);
        return;
      }
      showToast('Ticket actualizado.');
      cerrarTicketModal();
      cargarTickets();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    } finally {
      setGuardandoEstatusLoading(false);
    }
  }

  function setSubiendoFacturaLoading(cargando) {
    els.btnTicketSubirFactura.disabled = cargando;
    if (cargando) {
      els.btnTicketSubirFacturaLabel.textContent = 'Subiendo…';
    } else {
      const yaTeniaFactura = ticketActual && ticketActual.factura_nombre_original;
      els.btnTicketSubirFacturaLabel.textContent = yaTeniaFactura
        ? 'Reemplazar factura y marcar como listo'
        : 'Subir factura y marcar como listo';
    }
  }

  async function descargarFacturaTicket() {
    if (!ticketActual) return;
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.btnTicketDescargarFactura.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/${ticketActual.id}/factura`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast('No se pudo descargar la factura.', true);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ticketActual.factura_nombre_original || `factura-${ticketActual.folio}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    } finally {
      els.btnTicketDescargarFactura.disabled = false;
    }
  }

  els.btnTicketDescargarFactura.addEventListener('click', descargarFacturaTicket);

  els.btnTicketSubirFactura.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader || !ticketActual) return;

    const archivo = els.ticketModalFacturaInput.files[0];
    if (!archivo) {
      showToast('Selecciona el archivo de la factura primero.', true);
      return;
    }
    if (!archivo.name.toLowerCase().endsWith('.zip')) {
      showToast('Solo se acepta un archivo .zip (con el PDF y el XML de la factura comprimidos juntos).', true);
      return;
    }

    // El campo de monto manual solo se manda si ya está visible (una
    // subida anterior de este mismo archivo avisó que el XML no traía un
    // Total legible) — mientras no se necesite, no se manda nada, y el
    // servidor intenta leerlo del XML primero siempre.
    let montoManual = null;
    if (!els.ticketModalMontoManualWrap.hidden) {
      const valor = Number(els.ticketModalMontoManual.value);
      if (!els.ticketModalMontoManual.value || !Number.isFinite(valor) || valor <= 0) {
        setFieldError('ticket-modal-monto-manual', 'Captura el monto de la factura (mayor a $0).');
        els.ticketModalMontoManual.focus();
        return;
      }
      montoManual = valor;
      setFieldError('ticket-modal-monto-manual', '');
    }

    const formData = new FormData();
    formData.append('factura', archivo);
    if (montoManual !== null) {
      formData.append('montoFacturaManual', String(montoManual));
    }

    setSubiendoFacturaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/${ticketActual.id}/factura`, {
        method: 'POST',
        headers: { Authorization: authHeader },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // El sistema no pudo leer el Total del XML: en vez de solo un
        // toast que desaparece, se revela un aviso persistente + el
        // campo para capturarlo a mano, sin cerrar el modal ni perder el
        // archivo ya seleccionado — el operador solo tiene que llenar el
        // monto y volver a dar clic en el mismo botón.
        if (data.codigo === 'FACTURA_MONTO_REQUERIDO') {
          els.ticketModalFacturaAviso.hidden = false;
          els.ticketModalMontoManualWrap.hidden = false;
          els.ticketModalMontoManual.focus();
          return;
        }
        showToast(data.error || 'No se pudo subir la factura.', true);
        return;
      }
      showToast(data.mensaje || 'Factura cargada.');
      cerrarTicketModal();
      cargarTickets();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    } finally {
      setSubiendoFacturaLoading(false);
    }
  });

  // ---------- Ventas ----------

  let ivaActualParaOrden = 16; // se sobreescribe al cargar la configuración real
  // Productos capturados para la venta en curso — {concepto, precio, cantidad} —
  // arman #orden-concepto y #orden-cantidad (ambos de solo lectura); solo viven en el
  // navegador, nada se guarda hasta presionar "Registrar venta".
  let productosOrdenActual = [];
  // Toggle de la venta: false = elegir un correo ya registrado
  // (con constancia activa, como siempre); true = capturar el correo de
  // un cliente nuevo a mano — ver btnOrdenClienteRegistrado/Nuevo abajo.
  let ordenModoClienteNuevo = false;

  // Cache de los correos ya cargados (con su RFC y nombre/razón social),
  // para no tener que pedirle al servidor los datos de nuevo cada vez que
  // el administrador cambia la selección del desplegable.
  let correosRegistradosCache = [];

  async function cargarCorreosRegistrados() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/correos-registrados`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();
      correosRegistradosCache = data.correos || [];
      const seleccionPrevia = els.ordenEmail.value;
      els.ordenEmail.innerHTML = '<option value="">Selecciona un correo</option>';
      correosRegistradosCache.forEach((correo) => {
        const option = document.createElement('option');
        option.value = correo.email;
        // Homologado con stitch/: correo + razón social en la misma
        // línea, cuando el registro trae nombre — antes solo el correo,
        // había que abrir el detalle de solo lectura de abajo para ver
        // a quién correspondía.
        option.textContent = correo.nombre ? `${correo.email} — ${correo.nombre}` : correo.email;
        els.ordenEmail.appendChild(option);
      });
      if (seleccionPrevia) els.ordenEmail.value = seleccionPrevia;
      actualizarDatosClienteOrden();
    } catch (err) {
      // El desplegable se queda vacío (solo con "Selecciona un correo"); el
      // administrador puede reintentar actualizando la vista.
    }
  }

  // Muestra el RFC y el nombre/razón social asociados al correo
  // seleccionado, de solo lectura — es una medida de confirmación visual
  // para que el administrador verifique que son los datos correctos
  // antes de registrar la orden, no un campo que se pueda editar.
  function actualizarDatosClienteOrden() {
    const correo = correosRegistradosCache.find((c) => c.email === els.ordenEmail.value);
    if (!correo) {
      els.ordenDatosCliente.hidden = true;
      els.ordenRfcInfo.textContent = '—';
      els.ordenNombreInfo.textContent = '—';
      return;
    }
    els.ordenRfcInfo.textContent = `RFC: ${correo.rfc || '—'}`;
    els.ordenNombreInfo.textContent = `Nombre / Razón social: ${correo.nombre || '—'}`;
    els.ordenDatosCliente.hidden = false;
  }

  els.ordenEmail.addEventListener('change', actualizarDatosClienteOrden);

  function aplicarModoClienteOrden(esNuevo) {
    ordenModoClienteNuevo = esNuevo;
    els.btnOrdenClienteRegistrado.classList.toggle('is-active', !esNuevo);
    els.btnOrdenClienteRegistrado.setAttribute('aria-selected', String(!esNuevo));
    els.btnOrdenClienteNuevo.classList.toggle('is-active', esNuevo);
    els.btnOrdenClienteNuevo.setAttribute('aria-selected', String(esNuevo));
    els.ordenEmailRegistradoWrap.hidden = esNuevo;
    els.ordenEmailNuevoWrap.hidden = !esNuevo;
    // Limpia el campo del modo que se deja de usar, para no mandar por
    // error un correo capturado antes de cambiar de modo.
    if (esNuevo) {
      els.ordenEmail.value = '';
      setFieldError('orden-email', '');
      actualizarDatosClienteOrden();
    } else {
      els.ordenEmailNuevo.value = '';
      setFieldError('orden-email-nuevo', '');
    }
  }
  els.btnOrdenClienteRegistrado.addEventListener('click', () => aplicarModoClienteOrden(false));
  els.btnOrdenClienteNuevo.addEventListener('click', () => aplicarModoClienteOrden(true));

  // Wizard de 3 pasos (Productos → Confirmar → Entrega), solo activo en
  // móvil (<900px, ver admin.css) — en escritorio los 3 ".orden-wizard-paso"
  // ya se muestran todos juntos vía CSS, así que aquí solo hace falta
  // ocultar/mostrar el botón "Registrar venta" según el ancho real de
  // pantalla (en escritorio siempre visible, nunca gateado por paso). El
  // correo se pide hasta el último paso ("Entrega"), junto con la
  // elección de método — antes vivía en el primer paso.
  let ordenPasoActual = 1;
  function esVistaMovilOrden() {
    return window.matchMedia('(max-width: 900px)').matches;
  }
  function irAPasoOrdenWizard(numero) {
    ordenPasoActual = numero;
    els.ordenWizardPasos.forEach((paso) => {
      paso.classList.toggle('is-active', Number(paso.dataset.paso) === numero);
    });
    els.ordenWizardSteps.querySelectorAll('.step').forEach((step) => {
      const num = Number(step.dataset.step);
      step.classList.toggle('is-active', num === numero);
      step.classList.toggle('is-done', num < numero);
    });
    const movil = esVistaMovilOrden();
    els.btnOrdenPasoAtras.hidden = !movil || numero === 1;
    els.btnOrdenPasoSiguiente.hidden = !movil || numero === 3;
    els.ordenRegistrarBtnRow.hidden = movil && numero !== 3;
    const dialogo = els.ordenRegistrarModalOverlay.querySelector('.ticket-modal');
    if (dialogo) dialogo.scrollTop = 0;
  }

  // Método de entrega: 'correo' (de siempre), 'imprimir' (sin correo,
  // abre el ticket para imprimir) o 'sinticket' (sin correo, sin
  // imprimir — solo confirma la venta, ver PROJECT_STATE.md). Los 3
  // ocultan Tipo de cliente + Correo salvo "correo". El punto de
  // partida al abrir el modal lo decide "Configuraciones" →
  // Ventas → "Método de entrega por defecto" (ordenEntregaDefault,
  // cargado en cargarConfigGlobalParaOrden()).
  let ordenMetodoEntrega = 'sinticket';
  let ordenEntregaDefault = 'sinticket';
  function aplicarMetodoEntregaOrden(modo) {
    ordenMetodoEntrega = modo;
    const esCorreo = modo === 'correo';
    const esImprimir = modo === 'imprimir';
    const esSinTicket = modo === 'sinticket';
    els.btnOrdenEntregaCorreo.classList.toggle('is-active', esCorreo);
    els.btnOrdenEntregaCorreo.setAttribute('aria-selected', String(esCorreo));
    els.btnOrdenEntregaImprimir.classList.toggle('is-active', esImprimir);
    els.btnOrdenEntregaImprimir.setAttribute('aria-selected', String(esImprimir));
    els.btnOrdenEntregaSinTicket.classList.toggle('is-active', esSinTicket);
    els.btnOrdenEntregaSinTicket.setAttribute('aria-selected', String(esSinTicket));
    els.ordenEntregaCorreoWrap.hidden = !esCorreo;
    els.ordenEntregaImprimirHint.hidden = !esImprimir;
    els.ordenEntregaSinTicketHint.hidden = !esSinTicket;
    if (!esCorreo) {
      setFieldError('orden-email', '');
      setFieldError('orden-email-nuevo', '');
    }
  }
  els.btnOrdenEntregaCorreo.addEventListener('click', () => aplicarMetodoEntregaOrden('correo'));
  els.btnOrdenEntregaImprimir.addEventListener('click', () => aplicarMetodoEntregaOrden('imprimir'));
  els.btnOrdenEntregaSinTicket.addEventListener('click', () => aplicarMetodoEntregaOrden('sinticket'));

  // Método de pago (punto 342): 'efectivo'/'transferencia'/
  // 'tarjeta_credito'/'tarjeta_debito'. Con "transferencia" se genera y
  // persiste un folio de conciliación EN CUANTO se hace clic
  // (POST /admin/folios-conciliacion, antes de que la venta exista) —
  // solo una vez por apertura del modal: si el cajero cambia de método y
  // regresa a "transferencia" sin cerrar el modal, se reusa el mismo
  // folio (evita generar varios folios sin usar por clics indecisos). El
  // punto de partida al abrir el modal lo decide "Configuraciones" →
  // Ventas → "Método de pago por defecto" (ordenMetodoPagoDefault,
  // cargado en cargarConfigGlobalParaOrden()).
  let ordenMetodoPago = 'efectivo';
  let ordenMetodoPagoDefault = 'efectivo';
  let ordenFolioConciliacion = null;
  let ordenGenerandoFolio = false;
  const BOTONES_METODO_PAGO_ORDEN = [
    ['efectivo', () => els.btnOrdenMetodoEfectivo],
    ['transferencia', () => els.btnOrdenMetodoTransferencia],
    ['tarjeta_credito', () => els.btnOrdenMetodoTarjetaCredito],
    ['tarjeta_debito', () => els.btnOrdenMetodoTarjetaDebito],
  ];

  function aplicarMetodoPagoOrden(modo) {
    ordenMetodoPago = modo;
    BOTONES_METODO_PAGO_ORDEN.forEach(([val, obtenerBtn]) => {
      const btn = obtenerBtn();
      if (!btn) return;
      const activo = val === modo;
      btn.classList.toggle('is-active', activo);
      btn.setAttribute('aria-selected', String(activo));
    });
    setFieldError('orden-metodo-pago', '');
    if (modo === 'transferencia') {
      generarFolioConciliacionSiHaceFalta();
    } else if (els.ordenFolioConciliacionWrap) {
      els.ordenFolioConciliacionWrap.hidden = true;
    }
  }

  async function generarFolioConciliacionSiHaceFalta() {
    // Ya se generó uno en esta misma apertura del modal — se reusa, no se
    // pide otro (ver comentario de arriba).
    if (ordenFolioConciliacion) {
      if (els.ordenFolioConciliacionWrap) els.ordenFolioConciliacionWrap.hidden = false;
      return;
    }
    if (ordenGenerandoFolio) return;
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    ordenGenerandoFolio = true;
    setFieldError('orden-metodo-pago', '');
    try {
      const res = await fetch(`${API_BASE}/admin/folios-conciliacion`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo generar el folio de conciliación.');
      ordenFolioConciliacion = data.folio;
      if (els.ordenFolioConciliacionValor) els.ordenFolioConciliacionValor.textContent = data.folio;
      if (els.ordenFolioConciliacionWrap) els.ordenFolioConciliacionWrap.hidden = false;
    } catch (err) {
      // Sin el folio no se puede dejar "Transferencia" seleccionado — se
      // regresa a "Efectivo" y se explica por qué (ej. sin conexión).
      setFieldError('orden-metodo-pago', err.message || 'No se pudo generar el folio de conciliación. Inténtalo de nuevo.');
      aplicarMetodoPagoOrden('efectivo');
    } finally {
      ordenGenerandoFolio = false;
    }
  }

  BOTONES_METODO_PAGO_ORDEN.forEach(([val, obtenerBtn]) => {
    const btn = obtenerBtn();
    if (btn) btn.addEventListener('click', () => aplicarMetodoPagoOrden(val));
  });

  if (els.btnOrdenCopiarFolio) {
    els.btnOrdenCopiarFolio.addEventListener('click', async () => {
      if (!ordenFolioConciliacion) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(ordenFolioConciliacion);
        }
        els.btnOrdenCopiarFolio.classList.add('is-copiado');
        els.txtOrdenCopiarFolio.textContent = 'Copiado';
        setTimeout(() => {
          els.btnOrdenCopiarFolio.classList.remove('is-copiado');
          els.txtOrdenCopiarFolio.textContent = 'Copiar';
        }, 1600);
      } catch (err) {
        // Sin permiso de portapapeles: el folio ya está visible en
        // pantalla (grande, ver .orden-folio-callout-valor) — no hace
        // falta más que eso.
      }
    });
  }

  // Estado de pago (CxC punto 138): pagada (default verde) / pendiente (ámbar)
  let ordenEstadoPago = 'pagada';
  function aplicarEstadoPago(estado) {
    ordenEstadoPago = estado;
    const esPendiente = estado === 'pendiente';
    if (els.btnOrdenPagoPagada) {
      els.btnOrdenPagoPagada.classList.toggle('is-active', !esPendiente);
      els.btnOrdenPagoPagada.setAttribute('aria-selected', String(!esPendiente));
    }
    if (els.btnOrdenPagoPendiente) {
      els.btnOrdenPagoPendiente.classList.toggle('is-active', esPendiente);
      els.btnOrdenPagoPendiente.setAttribute('aria-selected', String(esPendiente));
    }
    if (els.ordenPagoPendienteWrap) els.ordenPagoPendienteWrap.hidden = !esPendiente;
  }
  if (els.btnOrdenPagoPagada) els.btnOrdenPagoPagada.addEventListener('click', () => aplicarEstadoPago('pagada'));
  if (els.btnOrdenPagoPendiente) els.btnOrdenPagoPendiente.addEventListener('click', () => aplicarEstadoPago('pendiente'));

  // Correo es obligatorio SOLO si el método de entrega es "correo" — con
  // "imprimir" no hay nada que validar aquí (ver POST /ordenes-compra,
  // acepta email vacío).
  function validarPasoClienteOrden() {
    if (ordenMetodoEntrega !== 'correo') return true;
    setFieldError('orden-email', '');
    setFieldError('orden-email-nuevo', '');
    const email = ordenModoClienteNuevo
      ? els.ordenEmailNuevo.value.trim().toLowerCase()
      : els.ordenEmail.value;
    if (ordenModoClienteNuevo) {
      if (!email || !els.ordenEmailNuevo.checkValidity()) {
        setFieldError('orden-email-nuevo', 'Captura un correo electrónico válido.');
        return false;
      }
    } else if (!email) {
      setFieldError('orden-email', 'Selecciona un correo electrónico.');
      return false;
    }
    return true;
  }

  els.btnOrdenPasoSiguiente.addEventListener('click', () => {
    if (ordenPasoActual === 1) {
      document.getElementById('error-orden-producto-general').textContent =
        productosOrdenActual.length === 0 ? 'Agrega al menos un producto para continuar.' : '';
      if (productosOrdenActual.length === 0) return;
      irAPasoOrdenWizard(2);
    } else if (ordenPasoActual === 2) {
      irAPasoOrdenWizard(3);
    }
  });
  els.btnOrdenPasoAtras.addEventListener('click', () => {
    irAPasoOrdenWizard(Math.max(1, ordenPasoActual - 1));
  });

  // Punto 227: lee el % de descuento capturado (opcional, sobre el
  // subtotal ANTES del IVA) — mismo redondeo a centavos que el resto de
  // los montos de la orden. Devuelve null si el campo está vacío o no es
  // un número válido (el guardado real lo revalida aparte).
  function obtenerDescuentoPorcentajeOrden() {
    const texto = els.ordenDescuento.value.trim();
    if (!texto) return null;
    const pct = Number(texto);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return null;
    return pct;
  }

  function actualizarTotalPreviewOrden() {
    const cantidad = obtenerValorNumerico(els.ordenCantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      els.ordenTotalPreview.textContent = '$0.00 MXN';
      if (els.ordenResumenSubtotal) els.ordenResumenSubtotal.textContent = '$0.00 MXN';
      if (els.ordenResumenIva) els.ordenResumenIva.textContent = '$0.00 MXN';
      if (els.ordenResumenFilaDescuento) els.ordenResumenFilaDescuento.hidden = true;
      return;
    }
    const descuentoPct = obtenerDescuentoPorcentajeOrden();
    const descuentoMonto = descuentoPct ? Math.round(cantidad * (descuentoPct / 100) * 100) / 100 : 0;
    const cantidadNeta = Math.round((cantidad - descuentoMonto) * 100) / 100;
    const total = Math.round(cantidadNeta * (1 + ivaActualParaOrden / 100) * 100) / 100;
    els.ordenTotalPreview.textContent = `$${formatearMoneda(total)} MXN`;
    // Desglose (homologado con stitch/): Subtotal/Descuento/IVA por
    // separado en vez del resumen de una sola línea de antes. La resta
    // contra el total ya redondeado evita que el IVA mostrado y el total
    // mostrado se desfasen entre sí.
    const ivaMonto = Math.round((total - cantidadNeta) * 100) / 100;
    if (els.ordenResumenSubtotal) els.ordenResumenSubtotal.textContent = `$${formatearMoneda(cantidad)} MXN`;
    if (els.ordenResumenFilaDescuento) {
      els.ordenResumenFilaDescuento.hidden = !descuentoPct;
      if (descuentoPct) {
        if (els.ordenResumenDescuentoLabel) els.ordenResumenDescuentoLabel.textContent = `Descuento aplicado (-${descuentoPct}%)`;
        if (els.ordenResumenDescuento) els.ordenResumenDescuento.textContent = `-$${formatearMoneda(descuentoMonto)} MXN`;
      }
    }
    if (els.ordenResumenIvaLabel) els.ordenResumenIvaLabel.textContent = `IVA trasladado (${ivaActualParaOrden}%)`;
    if (els.ordenResumenIva) els.ordenResumenIva.textContent = `$${formatearMoneda(ivaMonto)} MXN`;
  }

  async function cargarConfigGlobalParaOrden() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const zonas = await obtenerZonasHorarias();
      const res = await fetch(`${API_BASE}/admin/config/global`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const config = await res.json();
      ivaActualParaOrden = config.iva_porcentaje;
      if (['correo', 'imprimir', 'sinticket'].includes(config.entrega_venta_default)) {
        ordenEntregaDefault = config.entrega_venta_default;
      }
      if (['efectivo', 'transferencia', 'tarjeta_credito', 'tarjeta_debito'].includes(config.metodo_pago_venta_default)) {
        ordenMetodoPagoDefault = config.metodo_pago_venta_default;
      }
      els.ordenIvaInfo.textContent = `${config.iva_porcentaje}%`;
      if (els.ordenInfoBannerIva) els.ordenInfoBannerIva.textContent = `${config.iva_porcentaje}%`;
      const zonaInfo = zonas.find((z) => z.id === config.zona_horaria);
      els.ordenFechaAuto.textContent = zonaInfo
        ? `Se genera automáticamente al guardar, con la zona horaria "${zonaInfo.etiqueta}".`
        : 'Se genera automáticamente al guardar, con la zona horaria configurada.';
      actualizarTotalPreviewOrden();
    } catch (err) {
      // Se deja el valor por defecto (16%) hasta que se pueda recargar.
    }
  }

  formatearCampoDinero(els.ordenProductoPrecio);

  // Punto 227: recalcula el preview en vivo al teclear el % de descuento.
  els.ordenDescuento.addEventListener('input', () => {
    setFieldError('orden-descuento', '');
    sincronizarBotonesDescuentoRapido();
    actualizarTotalPreviewOrden();
  });

  // Descuento rápido (homologado con stitch/) — mismo input de siempre,
  // solo un atajo para no teclear el % a mano. "0%" limpia el campo (el
  // backend interpreta vacío = sin descuento, no "0% de descuento").
  function sincronizarBotonesDescuentoRapido() {
    if (!els.ordenDescuentoRapido) return;
    const actual = els.ordenDescuento.value.trim();
    els.ordenDescuentoRapido.querySelectorAll('.orden-descuento-rapido-btn').forEach((btn) => {
      const esCero = btn.dataset.pct === '0';
      btn.classList.toggle('is-active', esCero ? actual === '' : actual === btn.dataset.pct);
    });
  }
  if (els.ordenDescuentoRapido) {
    els.ordenDescuentoRapido.querySelectorAll('.orden-descuento-rapido-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        els.ordenDescuento.value = btn.dataset.pct === '0' ? '' : btn.dataset.pct;
        setFieldError('orden-descuento', '');
        sincronizarBotonesDescuentoRapido();
        actualizarTotalPreviewOrden();
      });
    });
  }

  // Banner informativo: el link solo lleva a Configuraciones
  // (mismo criterio que el resto del sitio — cierra este modal primero,
  // igual que "Ver en Gastos →"/"Ver cuentas por cobrar →" en otras
  // vistas). Perfiles sin acceso a esa vista (ej. "ventas") no ven el
  // botón "Configuraciones" en el sidebar, pero el link aquí no
  // rompe nada — simplemente no hace nada visible si la vista no existe
  // para ese perfil.
  if (els.btnOrdenInfoBannerConfig) {
    els.btnOrdenInfoBannerConfig.addEventListener('click', () => {
      cerrarOrdenRegistrarModal();
      if (els.btnVistaConfiguraciones) els.btnVistaConfiguraciones.click();
    });
  }

  // Texto de un producto tal como aparece en la lista y en el concepto
  // final que se manda al backend — "2 x Toner ($850.00 c/u)".
  function textoProductoOrden(producto) {
    return `${producto.cantidad} x ${producto.concepto} ($${formatearMoneda(producto.precio)} c/u)`;
  }

  function subtotalProductoOrden(producto) {
    return Math.round(producto.precio * producto.cantidad * 100) / 100;
  }

  // Reconstruye #orden-concepto (texto armado + contador), #orden-cantidad
  // (suma de subtotales) y la lista visible, a partir de productosOrdenActual
  // — se llama después de agregar o quitar un producto.
  function recalcularOrdenDesdeProductos() {
    const textoConcepto = productosOrdenActual.map(textoProductoOrden).join('\n');
    els.ordenConcepto.value = textoConcepto;
    els.ordenConceptoContador.textContent = `${textoConcepto.length} / 255`;

    const suma = productosOrdenActual.reduce((acc, p) => acc + subtotalProductoOrden(p), 0);
    els.ordenCantidad.value = suma > 0 ? formatearMoneda(suma) : '';
    actualizarTotalPreviewOrden();

    els.ordenProductosListaWrap.hidden = productosOrdenActual.length === 0;
    els.ordenProductosListaBody.innerHTML = '';
    els.ordenProductosListaMovil.innerHTML = '';
    productosOrdenActual.forEach((producto, indice) => {
      const quitar = () => {
        productosOrdenActual.splice(indice, 1);
        recalcularOrdenDesdeProductos();
      };

      // Segmento A: badge "Inventario" en las líneas que vienen del
      // catálogo (producto_id presente) — las manuales no lo llevan.
      const badgeInv = producto.producto_id ? ' <span class="line-badge-inv">Inventario</span>' : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(producto.concepto)}${badgeInv}</td>
        <td>$${formatearMoneda(producto.precio)}</td>
        <td>${producto.cantidad}</td>
        <td>$${formatearMoneda(subtotalProductoOrden(producto))}</td>
        <td><button type="button" class="btn-quitar-producto-orden" aria-label="Quitar ${escapeHtml(producto.concepto)}">✕</button></td>
      `;
      tr.querySelector('.btn-quitar-producto-orden').addEventListener('click', quitar);
      els.ordenProductosListaBody.appendChild(tr);

      // Solo móvil (<760px, ver admin.css): tarjeta compacta de 2 líneas
      // en vez de la tabla apilada sin etiquetas — reusa el mismo texto
      // ya armado por textoProductoOrden() ("N x Concepto ($X c/u)").
      const li = document.createElement('li');
      li.className = 'orden-productos-lista-movil-item';
      li.innerHTML = `
        <p class="orden-productos-lista-movil-concepto">${escapeHtml(textoProductoOrden(producto))}${badgeInv}</p>
        <div class="orden-productos-lista-movil-fila">
          <span class="orden-productos-lista-movil-precio">${producto.cantidad} pza${producto.cantidad === 1 ? '' : 's'}</span>
          <div class="orden-productos-lista-movil-derecha">
            <span class="orden-productos-lista-movil-subtotal">$${formatearMoneda(subtotalProductoOrden(producto))}</span>
            <button type="button" class="btn-quitar-producto-orden" aria-label="Quitar ${escapeHtml(producto.concepto)}">✕</button>
          </div>
        </div>
      `;
      li.querySelector('.btn-quitar-producto-orden').addEventListener('click', quitar);
      els.ordenProductosListaMovil.appendChild(li);
    });
  }

  els.btnAgregarProductoOrden.addEventListener('click', () => {
    setFieldError('orden-producto-concepto', '');
    setFieldError('orden-producto-precio', '');
    setFieldError('orden-producto-cantidad', '');
    document.getElementById('error-orden-producto-general').textContent = '';

    const concepto = els.ordenProductoConcepto.value.trim();
    const precio = obtenerValorNumerico(els.ordenProductoPrecio);
    const cantidad = Number(els.ordenProductoCantidad.value);

    let valido = true;
    if (!concepto) {
      setFieldError('orden-producto-concepto', 'Captura el concepto de este producto.');
      valido = false;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      setFieldError('orden-producto-precio', 'Captura un precio unitario mayor a cero.');
      valido = false;
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setFieldError('orden-producto-cantidad', 'Captura una cantidad de piezas mayor a cero.');
      valido = false;
    }
    if (!valido) return;

    const productoNuevo = { concepto, precio, cantidad };
    const textoConCandidato = [...productosOrdenActual, productoNuevo].map(textoProductoOrden).join('\n');
    if (textoConCandidato.length > 255) {
      document.getElementById('error-orden-producto-general').textContent =
        'No cabe: el concepto final se pasaría de 255 caracteres. Acorta el concepto de este producto o quita alguno de la lista.';
      return;
    }

    productosOrdenActual.push(productoNuevo);
    els.ordenProductoConcepto.value = '';
    els.ordenProductoPrecio.value = '';
    els.ordenProductoCantidad.value = '';
    recalcularOrdenDesdeProductos();
    els.ordenProductoConcepto.focus();
  });

  // ---------- D8 (Inventarios, §22): vincular producto en Ventas ----------
  // Independiente del builder de conceptos de texto de arriba — este
  // campo vincula UN producto real del catálogo de Inventarios (línea
  // única, P1 cerrada 2026-08-24) para que la venta descuente existencia
  // automáticamente. Solo visible/activo si inventarioActivoGlobalmente
  // es true (D8/§0.6, ver aplicarVisibilidadInventarios() arriba).

  let ordenInventarioProductoSeleccionado = null; // {id, sku, nombre, precio, disponible, tipo} | null — selección EN CURSO, todavía sin agregar a la lista
  let ordenInventarioBusquedaTimeout = null;

  // Segmento A ("Ventas con inventario activo v2"): con inventario activo
  // el bloque manual desaparece por completo (nunca coexisten) y el
  // buscador de inventario queda como única forma de agregar productos —
  // ya admite varias líneas (P1 reabierta), cada una cae en la misma
  // tabla/lista que antes solo recibía líneas manuales.
  function aplicarVisibilidadInventarioEnVentas() {
    if (els.ordenInventarioVincular) els.ordenInventarioVincular.hidden = !inventarioActivoGlobalmente;
    if (els.ordenProductosCapturaManual) els.ordenProductosCapturaManual.hidden = inventarioActivoGlobalmente;
  }

  function formatearCantidadOrdenInv(valor) {
    return formatearMoneda(valor).replace(/\.00$/, '');
  }

  function renderSugerenciasInventarioOrden(productos) {
    if (!els.ordenInventarioSugerencias) return;
    if (!productos.length) {
      els.ordenInventarioSugerencias.hidden = true;
      els.ordenInventarioSugerencias.innerHTML = '';
      return;
    }
    els.ordenInventarioSugerencias.innerHTML = productos
      .map(
        (p) => `
      <button type="button" class="orden-inventario-sugerencia" data-id="${p.id}">
        <span class="inv-thumb-zoom-wrap">
          ${p.imagen_thumb_url ? '<img class="inv-thumb inv-thumb-chica" alt="" />' : '<img class="inv-thumb inv-thumb-chica" src="/assets/producto-placeholder.png" alt="" />'}
        </span>
        <span class="orden-inventario-sugerencia-texto">
          <span class="orden-inventario-sugerencia-nombre">${escapeHtml(p.nombre)}</span>
          <span class="orden-inventario-sugerencia-detalle">${escapeHtml(p.sku)} · ${p.tipo === 'servicio' ? 'Servicio' : `Disponible: ${formatearCantidadOrdenInv(p.disponible)}`}${p.precio !== null ? ' · $' + formatearMoneda(p.precio) : ''}</span>
        </span>
      </button>`
      )
      .join('');
    els.ordenInventarioSugerencias.hidden = false;
    els.ordenInventarioSugerencias.querySelectorAll('.orden-inventario-sugerencia').forEach((btn) => {
      btn.addEventListener('click', () => {
        const producto = productos.find((p) => p.id === Number(btn.dataset.id));
        if (producto) seleccionarProductoInventarioOrden(producto);
      });
      const producto = productos.find((p) => p.id === Number(btn.dataset.id));
      const imgThumb = btn.querySelector('img.inv-thumb');
      if (producto && producto.imagen_thumb_url) cargarImagenAutenticada(imgThumb, producto.imagen_thumb_url);
      activarLupaProducto(btn.querySelector('.inv-thumb-zoom-wrap'), imgThumb);
    });
  }

  async function buscarProductosInventarioOrden(termino) {
    const authHeader = getAuthHeader();
    if (!authHeader || !termino) {
      renderSugerenciasInventarioOrden([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/productos/buscar?q=${encodeURIComponent(termino)}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        renderSugerenciasInventarioOrden([]);
        return;
      }
      const data = await res.json();
      const productos = data.productos || [];
      // Escáner de código de barras (HID, código + Enter): coincidencia
      // EXACTA y única se selecciona sola, sin esperar un clic.
      if (productos.length === 1 && productos[0].codigo_barras && productos[0].codigo_barras === termino) {
        seleccionarProductoInventarioOrden(productos[0]);
        return;
      }
      renderSugerenciasInventarioOrden(productos);
    } catch (err) {
      renderSugerenciasInventarioOrden([]);
    }
  }

  function actualizarHintDisponibleOrdenInv() {
    if (!ordenInventarioProductoSeleccionado || !els.ordenInventarioDisponibleHint) return;
    els.ordenInventarioDisponibleHint.textContent =
      ordenInventarioProductoSeleccionado.tipo === 'servicio'
        ? 'Los servicios no afectan tu inventario.'
        : `Disponible: ${formatearCantidadOrdenInv(ordenInventarioProductoSeleccionado.disponible)}`;
  }

  function seleccionarProductoInventarioOrden(producto) {
    ordenInventarioProductoSeleccionado = producto;
    renderSugerenciasInventarioOrden([]);
    els.ordenInventarioBuscarWrap.hidden = true;
    els.ordenInventarioSeleccionado.hidden = false;
    els.ordenInventarioSeleccionadoNombre.textContent = producto.nombre;
    els.ordenInventarioSeleccionadoDetalle.textContent =
      producto.tipo === 'servicio' ? `${producto.sku} · Servicio` : `${producto.sku} · Disponible: ${formatearCantidadOrdenInv(producto.disponible)}`;
    els.ordenInventarioUnidadesField.hidden = false;
    // Precio autocompletado desde el catálogo (editable, ver propuesta
    // "Ventas con inventario activo v2") — si el producto no tiene precio
    // capturado en Inventarios, se deja vacío para que el usuario lo escriba.
    if (els.ordenInventarioPrecio) {
      els.ordenInventarioPrecio.value = producto.precio !== null && producto.precio !== undefined ? formatearMoneda(producto.precio) : '';
    }
    // Punto 175: la cantidad respeta la unidad de medida del producto —
    // de conteo (pieza, caja, bulto, costal...) exige entero, de medida
    // continua (litro, gramo, kilo...) admite decimales. El campo se
    // ajusta al seleccionar el producto, no queda fijo en "piezas".
    const permiteDecimales = producto.permite_decimales !== false;
    if (els.ordenInventarioUnidadesLabel) {
      const etiquetaUnidad = producto.unidad_abreviatura || producto.unidad_nombre || 'piezas';
      els.ordenInventarioUnidadesLabel.innerHTML = `Cantidad (${escapeHtml(etiquetaUnidad)}) <span class="required">*</span>`;
    }
    els.ordenInventarioUnidades.step = permiteDecimales ? '0.001' : '1';
    els.ordenInventarioUnidades.min = permiteDecimales ? '0.001' : '1';
    els.ordenInventarioUnidades.value = '1';
    setFieldError('orden-inventario-unidades', '');
    document.getElementById('error-orden-inventario-general').textContent = '';
    if (els.btnAgregarProductoInventarioOrden) els.btnAgregarProductoInventarioOrden.hidden = false;
    actualizarHintDisponibleOrdenInv();
  }

  function quitarProductoInventarioOrden() {
    ordenInventarioProductoSeleccionado = null;
    els.ordenInventarioBuscarWrap.hidden = false;
    els.ordenInventarioBuscar.value = '';
    els.ordenInventarioSeleccionado.hidden = true;
    els.ordenInventarioUnidadesField.hidden = true;
    if (els.btnAgregarProductoInventarioOrden) els.btnAgregarProductoInventarioOrden.hidden = true;
    setFieldError('orden-inventario-unidades', '');
    document.getElementById('error-orden-inventario-general').textContent = '';
    renderSugerenciasInventarioOrden([]);
  }

  // Segmento A: agrega la selección en curso a productosOrdenActual —
  // misma lista/tabla que ya usaban las líneas manuales (reusa
  // recalcularOrdenDesdeProductos()/textoProductoOrden() sin cambios).
  // Un mismo producto no se agrega 2 veces (mismo criterio que valida el
  // backend) — para cambiar la cantidad hay que quitar la línea y
  // agregarla de nuevo.
  function agregarProductoInventarioOrden() {
    const errorGeneral = document.getElementById('error-orden-inventario-general');
    errorGeneral.textContent = '';
    if (!ordenInventarioProductoSeleccionado) return;

    const yaAgregado = productosOrdenActual.some((p) => p.producto_id === ordenInventarioProductoSeleccionado.id);
    if (yaAgregado) {
      errorGeneral.textContent = 'Ya agregaste este producto — quítalo de la lista de abajo para cambiar la cantidad.';
      return;
    }

    const precio = obtenerValorNumerico(els.ordenInventarioPrecio);
    if (!Number.isFinite(precio) || precio < 0) {
      errorGeneral.textContent = 'Captura un precio unitario válido.';
      return;
    }
    const unidades = Number(els.ordenInventarioUnidades.value);
    if (!Number.isFinite(unidades) || unidades <= 0) {
      setFieldError('orden-inventario-unidades', 'Captura cuántas unidades se vendieron.');
      return;
    }
    // Punto 175: mismo criterio que valida el backend (registrarMovimiento) —
    // se revisa también aquí para no esperar el viaje de ida y vuelta al
    // servidor con un error evitable.
    if (ordenInventarioProductoSeleccionado.permite_decimales === false && !Number.isInteger(unidades)) {
      const etiquetaUnidad = ordenInventarioProductoSeleccionado.unidad_nombre || 'esta unidad';
      setFieldError('orden-inventario-unidades', `"${etiquetaUnidad}" es una unidad de conteo — captura un número entero, sin decimales.`);
      return;
    }
    setFieldError('orden-inventario-unidades', '');

    productosOrdenActual.push({
      concepto: ordenInventarioProductoSeleccionado.nombre,
      precio,
      cantidad: unidades,
      producto_id: ordenInventarioProductoSeleccionado.id,
    });
    recalcularOrdenDesdeProductos();
    quitarProductoInventarioOrden();
    els.ordenInventarioBuscar.focus();
  }

  if (els.btnAgregarProductoInventarioOrden) {
    els.btnAgregarProductoInventarioOrden.addEventListener('click', agregarProductoInventarioOrden);
  }

  // Punto 176: el `step` que ajusta seleccionarProductoInventarioOrden()
  // solo cambia el incremento de las flechitas del input — un
  // <input type="number"> NUNCA bloquea escribir o pegar un "." a mano,
  // sin importar `step`/`min` (eso solo lo checa el navegador al hacer
  // submit de un <form>, que este modal no usa). Bug real reportado por
  // el usuario con captura: un producto de unidad de conteo (Pieza)
  // seguía mostrando un valor con decimales en el campo. Se corta en
  // vivo mientras se teclea, además de la validación que ya existía al
  // presionar "+ Agregar producto" (que sigue ahí, defensa en
  // profundidad) — así el campo nunca deja ver un decimal para empezar.
  if (els.ordenInventarioUnidades) {
    els.ordenInventarioUnidades.setAttribute('autocomplete', 'off');
    els.ordenInventarioUnidades.addEventListener('input', () => {
      if (!ordenInventarioProductoSeleccionado || ordenInventarioProductoSeleccionado.permite_decimales !== false) return;
      const soloEntero = els.ordenInventarioUnidades.value.split('.')[0];
      if (soloEntero !== els.ordenInventarioUnidades.value) {
        els.ordenInventarioUnidades.value = soloEntero;
      }
    });
  }

  if (els.ordenInventarioBuscar) {
    els.ordenInventarioBuscar.addEventListener('input', () => {
      clearTimeout(ordenInventarioBusquedaTimeout);
      const termino = els.ordenInventarioBuscar.value.trim();
      if (!termino) {
        renderSugerenciasInventarioOrden([]);
        return;
      }
      ordenInventarioBusquedaTimeout = setTimeout(() => buscarProductosInventarioOrden(termino), 300);
    });
    els.ordenInventarioBuscar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(ordenInventarioBusquedaTimeout);
        buscarProductosInventarioOrden(els.ordenInventarioBuscar.value.trim());
      }
    });
  }
  if (els.btnOrdenInventarioQuitar) els.btnOrdenInventarioQuitar.addEventListener('click', quitarProductoInventarioOrden);

  // Punto 159 (Segmento A): el valor leído por cámara se trata igual que
  // si se hubiera tecleado o venido de un lector físico USB/Bluetooth —
  // reusa buscarProductosInventarioOrden() tal cual, mismo auto-select
  // por coincidencia exacta que ya existe para el lector físico.
  if (els.btnOrdenInventarioEscanear && window.ScannerCodigoBarras) {
    els.btnOrdenInventarioEscanear.addEventListener('click', () => {
      window.ScannerCodigoBarras.abrir({
        onDetectado: (valor) => {
          els.ordenInventarioBuscar.value = valor;
          clearTimeout(ordenInventarioBusquedaTimeout);
          buscarProductosInventarioOrden(valor);
        },
      });
    });
  }

  function limpiarFormularioOrden() {
    productosOrdenActual = [];
    els.ordenProductoConcepto.value = '';
    els.ordenProductoPrecio.value = '';
    els.ordenProductoCantidad.value = '';
    setFieldError('orden-producto-concepto', '');
    setFieldError('orden-producto-precio', '');
    setFieldError('orden-producto-cantidad', '');
    document.getElementById('error-orden-producto-general').textContent = '';
    recalcularOrdenDesdeProductos();
    els.ordenEmail.value = '';
    els.ordenEmailNuevo.value = '';
    aplicarModoClienteOrden(false);
    aplicarMetodoEntregaOrden(ordenEntregaDefault);
    ordenFolioConciliacion = null;
    setFieldError('orden-metodo-pago', '');
    aplicarMetodoPagoOrden(ordenMetodoPagoDefault);
    aplicarEstadoPago('pagada');
    if (els.ordenFechaVencimiento) els.ordenFechaVencimiento.value = '';
    if (els.ordenNotasCobro) els.ordenNotasCobro.value = '';
    els.ordenDescuento.value = '';
    sincronizarBotonesDescuentoRapido();
    els.ordenErrorGeneral.textContent = '';
    setFieldError('orden-concepto', '');
    setFieldError('orden-cantidad', '');
    setFieldError('orden-descuento', '');
    setFieldError('orden-email', '');
    setFieldError('orden-email-nuevo', '');
    actualizarDatosClienteOrden();
    quitarProductoInventarioOrden();
    irAPasoOrdenWizard(1);
  }

  function setRegistrarOrdenLoading(isLoading) {
    els.btnRegistrarOrden.disabled = isLoading;
    els.btnRegistrarOrdenLabel.textContent = isLoading ? 'Registrando…' : 'Registrar venta';
  }

  // "Guardar borrador" (homologado con stitch/, pedido explícito del
  // usuario — quedaba como idea sin decidir en el punto 126). Guarda EN
  // EL NAVEGADOR (localStorage, por cuenta — mismo criterio que
  // onboarding_v1_) lo capturado hasta ahora, SIN crear ninguna venta
  // todavía. Un solo borrador a la vez (guardar uno nuevo sobrescribe al
  // anterior) — no es un historial, solo "no perder lo que llevaba".
  function claveOrdenBorrador() {
    return `orden_borrador_v1_${TENANT_SLUG || 'base'}_${usuarioSesionActual || ''}`;
  }

  function guardarOrdenBorrador() {
    if (productosOrdenActual.length === 0) {
      showToast('Agrega al menos un producto antes de guardar el borrador', true);
      return;
    }
    const borrador = {
      productos: productosOrdenActual,
      descuento: els.ordenDescuento.value,
      estadoPago: ordenEstadoPago,
      fechaVencimiento: els.ordenFechaVencimiento ? els.ordenFechaVencimiento.value : '',
      notasCobro: els.ordenNotasCobro ? els.ordenNotasCobro.value : '',
      metodoEntrega: ordenMetodoEntrega,
      modoClienteNuevo: ordenModoClienteNuevo,
      email: els.ordenEmail.value,
      emailNuevo: els.ordenEmailNuevo.value,
      guardadoEn: new Date().toISOString(),
    };
    try {
      localStorage.setItem(claveOrdenBorrador(), JSON.stringify(borrador));
      showToast('Borrador guardado — lo verás la próxima vez que abras "Registrar venta"');
    } catch (err) {
      showToast('No se pudo guardar el borrador en este navegador', true);
    }
  }

  function obtenerOrdenBorradorGuardado() {
    try {
      const crudo = localStorage.getItem(claveOrdenBorrador());
      if (!crudo) return null;
      const borrador = JSON.parse(crudo);
      if (!borrador || !Array.isArray(borrador.productos) || borrador.productos.length === 0) return null;
      return borrador;
    } catch (err) {
      return null;
    }
  }

  function borrarOrdenBorradorGuardado() {
    try {
      localStorage.removeItem(claveOrdenBorrador());
    } catch (err) {
      // Sin localStorage disponible: no hay nada que borrar.
    }
  }

  function restaurarOrdenBorrador(borrador) {
    productosOrdenActual = borrador.productos;
    recalcularOrdenDesdeProductos();
    els.ordenDescuento.value = borrador.descuento || '';
    sincronizarBotonesDescuentoRapido();
    aplicarEstadoPago(borrador.estadoPago === 'pendiente' ? 'pendiente' : 'pagada');
    if (els.ordenFechaVencimiento) els.ordenFechaVencimiento.value = borrador.fechaVencimiento || '';
    if (els.ordenNotasCobro) els.ordenNotasCobro.value = borrador.notasCobro || '';
    // "metodoEntrega" es el formato nuevo (3 estados); "metodoEntregaImprimir"
    // es el formato viejo (booleano) — un borrador guardado en localStorage
    // ANTES de este cambio sigue restaurándose sin romperse.
    const modoEntregaBorrador =
      borrador.metodoEntrega || (borrador.metodoEntregaImprimir ? 'imprimir' : 'correo');
    aplicarMetodoEntregaOrden(modoEntregaBorrador);
    aplicarModoClienteOrden(Boolean(borrador.modoClienteNuevo));
    if (borrador.modoClienteNuevo) {
      els.ordenEmailNuevo.value = borrador.emailNuevo || '';
    } else {
      els.ordenEmail.value = borrador.email || '';
      actualizarDatosClienteOrden();
    }
    actualizarTotalPreviewOrden();
  }

  if (els.btnOrdenGuardarBorrador) els.btnOrdenGuardarBorrador.addEventListener('click', guardarOrdenBorrador);

  // "Vista previa" (homologado con stitch/, reemplaza el fantasma "Vista
  // previa del CFDI" — aquí no se timbra nada, no existe esa integración).
  // Arma un ticket de vista previa con lo capturado HASTA AHORA, sin
  // folio real (se asigna hasta guardar de verdad) — reusa el mismo
  // render de ticket ya construido (punto 209), con el aviso/botón
  // "Imprimir" ajustados por abrirPreviewTicket(orden, esBorrador=true).
  function construirOrdenPreviaDesdeFormulario() {
    const cantidad = obtenerValorNumerico(els.ordenCantidad);
    const descuentoPct = obtenerDescuentoPorcentajeOrden();
    const descuentoMonto = descuentoPct ? Math.round(cantidad * (descuentoPct / 100) * 100) / 100 : 0;
    const cantidadNeta = Math.round((cantidad - descuentoMonto) * 100) / 100;
    const total = Math.round(cantidadNeta * (1 + ivaActualParaOrden / 100) * 100) / 100;
    const email = ordenMetodoEntrega !== 'correo'
      ? ''
      : ordenModoClienteNuevo
        ? els.ordenEmailNuevo.value.trim()
        : els.ordenEmail.value;
    return {
      numero_compra: 'Pendiente de guardar',
      concepto: els.ordenConcepto.value || 'Sin productos capturados',
      cantidad: cantidadNeta,
      total,
      iva_porcentaje: ivaActualParaOrden,
      descuento_porcentaje: descuentoPct,
      descuento_monto: descuentoMonto,
      email,
      fecha_compra_formateada: null,
      metodo_pago: ordenMetodoPago,
      folio_conciliacion: ordenFolioConciliacion,
    };
  }

  if (els.btnOrdenVistaPrevia) {
    els.btnOrdenVistaPrevia.addEventListener('click', () => {
      if (productosOrdenActual.length === 0) {
        els.ordenErrorGeneral.textContent = 'Agrega al menos un producto para ver la vista previa.';
        return;
      }
      abrirPreviewTicket(construirOrdenPreviaDesdeFormulario(), true);
    });
  }

  // Modal de error al registrar una venta (punto 261) — reemplaza el
  // texto chico casi invisible que quedaba al fondo del wizard/formulario
  // ("Existencia insuficiente..." pasaba inadvertido). Aplica a
  // CUALQUIER error de guardado: con INV_STOCK_INSUFICIENTE muestra la
  // comparación Disponible/Solicitaste (datos que server.js agrega a
  // propósito a esta respuesta); para el resto, el mensaje normal. El
  // formulario NO se limpia ni se cierra — la venta se queda tal cual la
  // estaba capturando.
  function mostrarErrorRegistrarOrden(data) {
    const esStock = data && data.error === 'INV_STOCK_INSUFICIENTE';
    els.ordenErrorModalTitle.textContent = esStock ? 'Existencia insuficiente' : 'No se pudo registrar la venta';
    els.ordenErrorModalMensaje.hidden = esStock;
    els.ordenErrorModalStock.hidden = !esStock;
    if (esStock) {
      els.ordenErrorModalProducto.textContent = (data && data.producto_nombre) || 'este producto';
      els.ordenErrorModalDisponible.textContent = formatearCantidadInv((data && data.disponible) || 0);
      els.ordenErrorModalSolicitado.textContent = formatearCantidadInv((data && data.solicitado) || 0);
    } else {
      els.ordenErrorModalMensaje.textContent = (data && (data.mensaje || data.error)) || 'No se pudo registrar la venta.';
    }
    els.ordenErrorModalOverlay.hidden = false;
  }
  function cerrarErrorRegistrarOrden() {
    els.ordenErrorModalOverlay.hidden = true;
  }
  if (els.btnOrdenErrorModalCerrar) els.btnOrdenErrorModalCerrar.addEventListener('click', cerrarErrorRegistrarOrden);
  if (els.ordenErrorModalOverlay) {
    els.ordenErrorModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.ordenErrorModalOverlay) cerrarErrorRegistrarOrden();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.ordenErrorModalOverlay.hidden) cerrarErrorRegistrarOrden();
    });
  }

  els.btnRegistrarOrden.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.ordenErrorGeneral.textContent = '';
    setFieldError('orden-concepto', '');
    setFieldError('orden-cantidad', '');
    setFieldError('orden-descuento', '');
    setFieldError('orden-email', '');
    setFieldError('orden-email-nuevo', '');
    setFieldError('orden-inventario-unidades', '');

    const concepto = els.ordenConcepto.value.trim();
    const cantidad = obtenerValorNumerico(els.ordenCantidad);
    const descuentoTexto = els.ordenDescuento.value.trim();
    let descuentoPorcentaje = null;
    // Sin correo cuando el método de entrega es "imprimir"/"sinticket"
    // (ver PROJECT_STATE.md — el backend acepta email vacío en ambos).
    const email = ordenMetodoEntrega !== 'correo'
      ? ''
      : ordenModoClienteNuevo
        ? els.ordenEmailNuevo.value.trim().toLowerCase()
        : els.ordenEmail.value;
    // Se captura ANTES de que limpiarFormularioOrden() (dentro del
    // temporizador de mostrarExitoRegistrarOrden) regrese el toggle al
    // método por defecto para la siguiente venta.
    const imprimirAlGuardar = ordenMetodoEntrega === 'imprimir';
    const fechaVencimiento = els.ordenFechaVencimiento ? els.ordenFechaVencimiento.value : '';
    const notasCobro = els.ordenNotasCobro ? els.ordenNotasCobro.value.trim() : '';

    let valido = true;
    if (!concepto) {
      setFieldError('orden-concepto', 'El concepto de venta o servicio es obligatorio.');
      valido = false;
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setFieldError('orden-cantidad', 'Captura una cantidad mayor a cero.');
      valido = false;
    }
    if (descuentoTexto) {
      const pct = Number(descuentoTexto);
      if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
        setFieldError('orden-descuento', 'El descuento debe ser un porcentaje mayor a 0 y menor a 100.');
        valido = false;
      } else {
        descuentoPorcentaje = pct;
      }
    }
    if (!validarPasoClienteOrden()) valido = false;
    if (!valido) return;

    // Segmento A: líneas de inventario ya validadas y comprometidas al
    // presionar "+ Agregar producto" (agregarProductoInventarioOrden) —
    // aquí solo se extraen de la lista ya armada, misma que las manuales.
    const lineasInventarioEnLista = productosOrdenActual.filter((p) => p.producto_id);

    // Sin conexión: se encola en IndexedDB en vez de intentar guardar
    // (fallaría de todas formas) — ver PROJECT_STATE.md punto 132. Una
    // venta con producto de inventario vinculado NO se encola: la
    // validación de existencia (D4) necesita conexión real, y encolar sin
    // validar arriesgaría un descuento de stock incorrecto al sincronizar
    // más tarde sin que el administrador lo supiera en el momento.
    // "Imprimir" no aplica sin folio real, así que si de alguna forma
    // llegó hasta aquí en ese estado (no debería, el botón se deshabilita
    // al quedarse sin conexión) se bloquea aquí también, por seguridad.
    if (window.OfflineQueue && OfflineQueue.isOffline()) {
      if (imprimirAlGuardar) {
        els.ordenErrorGeneral.textContent =
          'No se puede imprimir sin conexión. Cambia a "Enviar por correo" o espera a recuperar internet.';
        return;
      }
      if (lineasInventarioEnLista.length > 0) {
        els.ordenErrorGeneral.textContent =
          'No se puede vincular producto de inventario sin conexión. Quita los productos de inventario de la lista o espera a recuperar internet.';
        return;
      }
      await OfflineQueue.agregarPendiente('ordenes', {
        concepto,
        cantidad,
        descuento_porcentaje: descuentoPorcentaje,
        email,
        es_cliente_nuevo: ordenModoClienteNuevo,
        estado_pago: ordenEstadoPago,
        fecha_vencimiento: ordenEstadoPago === 'pendiente' ? fechaVencimiento : null,
        notas_cobro: ordenEstadoPago === 'pendiente' ? notasCobro : null,
        metodo_pago: ordenMetodoPago,
        folio_conciliacion: ordenMetodoPago === 'transferencia' ? ordenFolioConciliacion : undefined,
      });
      borrarOrdenBorradorGuardado();
      mostrarExitoRegistrarOrden('Guardado — se enviará al recuperar conexión');
      aplicarFiltrosOrdenes();
      return;
    }

    setRegistrarOrdenLoading(true);
    try {
      const idempotencyKeyOrden =
        window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(`${API_BASE}/admin/ordenes-compra`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKeyOrden },
        body: JSON.stringify({
          concepto,
          cantidad,
          descuento_porcentaje: descuentoPorcentaje,
          email,
          es_cliente_nuevo: ordenModoClienteNuevo,
          estado_pago: ordenEstadoPago,
          fecha_vencimiento: ordenEstadoPago === 'pendiente' ? fechaVencimiento : null,
          notas_cobro: ordenEstadoPago === 'pendiente' ? notasCobro : null,
          metodo_pago: ordenMetodoPago,
          folio_conciliacion: ordenMetodoPago === 'transferencia' ? ordenFolioConciliacion : undefined,
          productos_inventario:
            lineasInventarioEnLista.length > 0
              ? lineasInventarioEnLista.map((p) => ({ producto_id: p.producto_id, cantidad: p.cantidad }))
              : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        mostrarErrorRegistrarOrden(data);
        return;
      }
      borrarOrdenBorradorGuardado();
      mostrarExitoRegistrarOrden(
        undefined,
        imprimirAlGuardar
          ? () =>
              abrirPreviewTicket({
                numero_compra: data.numero_compra,
                concepto: data.concepto,
                cantidad: data.cantidad,
                iva_porcentaje: data.iva_porcentaje,
                total: data.total,
                descuento_porcentaje: data.descuento_porcentaje,
                descuento_monto: data.descuento_monto,
                email: data.email,
                fecha_compra_formateada: data.fecha_compra,
                metodo_pago: data.metodo_pago,
                folio_conciliacion: data.folio_conciliacion,
              })
          : undefined
      );
      cargarOrdenes();
    } catch (err) {
      mostrarErrorRegistrarOrden({ error: 'SIN_CONEXION', mensaje: 'No se pudo conectar con el servidor.' });
    } finally {
      setRegistrarOrdenLoading(false);
    }
  });

  // Confirmación INLINE dentro del modal (no toast — "muchas veces no se
  // nota", pedido explícito del usuario) — palomita animada + texto,
  // dura ~1.3s en total, y el modal se queda abierto y se limpia solo,
  // listo para la siguiente venta (no hay que volver a abrirlo).
  // `alTerminar` (opcional) corre DESPUÉS de que la palomita termina y se
  // oculta sola — nunca al mismo tiempo que ella. Antes, "guardar+imprimir"
  // disparaba window.print() en paralelo con la animación (el diálogo de
  // impresión competía con/tapaba la palomita); ahora la secuencia es
  // estrictamente palomita completa → preview del ticket.
  function mostrarExitoRegistrarOrden(mensaje, alTerminar) {
    // Primeros pasos (Fase 2 UX): además de ordenesCache (que ya refleja la
    // venta real cuando hay conexión), esta bandera cubre el caso offline
    // encolado — se guarda para siempre por cuenta, no hace falta un fetch.
    guardarEstadoOnboarding({ ventaCreada: true });
    renderOnboardingChecklist();
    els.ordenFormExitoTexto.textContent = mensaje || 'Guardado con éxito';
    els.ordenFormBody.hidden = true;
    els.ordenFormExito.hidden = false;
    setTimeout(() => {
      els.ordenFormExito.hidden = true;
      els.ordenFormBody.hidden = false;
      limpiarFormularioOrden();
      els.ordenProductoConcepto.focus();
      if (typeof alTerminar === 'function') alTerminar();
    }, 1300);
  }

  els.btnRefreshOrdenes.addEventListener('click', async () => {
    cargarConfigGlobalParaOrden();
    await cargarCorreosRegistrados();
    cargarOrdenes();
  });

  async function cargarOrdenes() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    // Sin conexión: se sigue mostrando la última lista ya cargada
    // (ordenesCache en memoria) + lo pendiente de sincronizar, sin
    // intentar la petición (fallaría de todas formas) — ver
    // PROJECT_STATE.md punto 132.
    if (window.OfflineQueue && OfflineQueue.isOffline()) {
      aplicarFiltrosOrdenes();
      return;
    }

    els.ordenesError.textContent = '';
    Esqueleto.aplicarEsqueletoTabla(els.ordenesTableBody, 6);
    try {
      const params = new URLSearchParams();
      if (els.ordenesFiltroPeriodo && els.ordenesFiltroPeriodo.value) params.set('periodo', els.ordenesFiltroPeriodo.value);
      const res = await fetch(`${API_BASE}/admin/ordenes-compra?${params.toString()}`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.ordenesTableBody, 6, 'No se pudieron cargar las ventas.', cargarOrdenes);
        return false;
      }
      const data = await res.json();
      ordenesCache = data.ordenes || [];
      aplicarFiltrosOrdenes();
      Esqueleto.quitarEsqueletoTabla(els.ordenesTableBody);
      return true;
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.ordenesTableBody, 6, 'No se pudo conectar con el servidor.', cargarOrdenes);
      return false;
    }
  }

  // Filtros de "Ventas registradas" (concepto/rango de fechas/rango de
  // total) — 100% en el cliente: la lista ya se trae completa de una
  // sola vez sin paginar (GET /ordenes-compra), así que filtrar aquí es
  // instantáneo y no necesita ningún cambio de backend. Mismo criterio
  // que el buscador ya existente de Constancias.
  let ordenesCache = [];

  // Convierte una fila de la cola offline (ver offline.js) en un objeto
  // con la misma forma que ya espera renderOrdenes/filaOrdenPendiente —
  // el total es un ESTIMADO client-side (mismo % de IVA ya cargado antes
  // de perder conexión), nunca el total real hasta que el servidor lo
  // confirme al sincronizar.
  function ordenPendienteAVista(item) {
    const cantidad = Number(item.datos.cantidad) || 0;
    const iva = typeof ivaActualParaOrden === 'number' ? ivaActualParaOrden : 16;
    const descuentoPct = Number(item.datos.descuento_porcentaje) || 0;
    const descuentoMonto = descuentoPct ? Math.round(cantidad * (descuentoPct / 100) * 100) / 100 : 0;
    const cantidadNeta = Math.round((cantidad - descuentoMonto) * 100) / 100;
    const totalEstimado = Math.round(cantidadNeta * (1 + iva / 100) * 100) / 100;
    const fecha = new Date(item.creadoEn);
    return {
      __pendiente: true,
      __localId: item.localId,
      __error: item.error,
      concepto: item.datos.concepto,
      total: totalEstimado,
      email: item.datos.email || null,
      fecha_compra: fecha.toISOString().slice(0, 10),
      fecha_compra_formateada: {
        fecha: fecha.toLocaleDateString('es-MX'),
        hora: fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      },
    };
  }

  async function aplicarFiltrosOrdenes() {
    const concepto = normalizar(els.ordenesFiltroConcepto.value.trim());
    const fechaDesde = els.ordenesFiltroFechaDesde.value;
    const fechaHasta = els.ordenesFiltroFechaHasta.value;
    const totalMin = els.ordenesFiltroTotalMin.value ? Number(els.ordenesFiltroTotalMin.value) : null;
    const totalMax = els.ordenesFiltroTotalMax.value ? Number(els.ordenesFiltroTotalMax.value) : null;
    const estadoPagoFiltro = els.ordenesFiltroEstadoPago ? els.ordenesFiltroEstadoPago.value : '';
    const facturacionFiltro = els.ordenesFiltroFacturacion ? els.ordenesFiltroFacturacion.value : '';

    const filtradas = ordenesCache.filter((orden) => {
      if (concepto && !normalizar(orden.concepto).includes(concepto)) return false;
      const fechaOrden = String(orden.fecha_compra || '').slice(0, 10);
      if (fechaDesde && fechaOrden < fechaDesde) return false;
      if (fechaHasta && fechaOrden > fechaHasta) return false;
      const total = Number(orden.total);
      if (totalMin !== null && total < totalMin) return false;
      if (totalMax !== null && total > totalMax) return false;
      if (estadoPagoFiltro) {
        const esPendiente = (orden.estado_pago || 'pagada') === 'pendiente';
        if (estadoPagoFiltro === 'pagada' && esPendiente) return false;
        if (estadoPagoFiltro === 'pendiente' && !esPendiente) return false;
        if (estadoPagoFiltro === 'vencida' && !(esPendiente && esVencida(orden))) return false;
      }
      if (facturacionFiltro === 'facturada' && !orden.facturado) return false;
      if (facturacionFiltro === 'sin_facturar' && orden.facturado) return false;
      return true;
    });

    // Las pendientes de sincronizar SIEMPRE se muestran arriba, sin pasar
    // por los filtros (todavía no tienen folio/fecha real del servidor
    // con los que comparar de forma confiable).
    let pendientes = [];
    if (window.OfflineQueue) {
      try {
        const crudas = await OfflineQueue.listarPendientes('ordenes');
        pendientes = crudas.map(ordenPendienteAVista);
      } catch (err) {
        pendientes = [];
      }
    }

    renderOrdenes([...pendientes, ...filtradas]);
    const hayFiltro = Boolean(concepto || fechaDesde || fechaHasta || totalMin !== null || totalMax !== null || estadoPagoFiltro || facturacionFiltro);
    els.ordenesEmpty.hidden = ordenesCache.length > 0 || pendientes.length > 0;
    els.ordenesFiltroEmpty.hidden = !(hayFiltro && ordenesCache.length > 0 && filtradas.length === 0);
    renderFiltrosChips(els.ordenesFiltrosChips, [
      { etiqueta: 'Buscar', valor: els.ordenesFiltroConcepto.value.trim(), campos: [els.ordenesFiltroConcepto] },
      { etiqueta: 'Fechas', valor: (fechaDesde || fechaHasta) ? `${fechaDesde || '…'} – ${fechaHasta || '…'}` : '', campos: [els.ordenesFiltroFechaDesde, els.ordenesFiltroFechaHasta] },
      { etiqueta: 'Total', valor: (totalMin !== null || totalMax !== null) ? `$${totalMin ?? 0} – $${totalMax ?? '∞'}` : '', campos: [els.ordenesFiltroTotalMin, els.ordenesFiltroTotalMax] },
      { etiqueta: 'Estado de pago', valor: textoOpcionSeleccionada(els.ordenesFiltroEstadoPago), campos: [els.ordenesFiltroEstadoPago] },
      { etiqueta: 'Facturación', valor: textoOpcionSeleccionada(els.ordenesFiltroFacturacion), campos: [els.ordenesFiltroFacturacion] },
    ]);
  }
  [els.ordenesFiltroConcepto, els.ordenesFiltroFechaDesde, els.ordenesFiltroFechaHasta, els.ordenesFiltroTotalMin, els.ordenesFiltroTotalMax].forEach((el) => {
    el.addEventListener('input', () => aplicarFiltrosOrdenes());
  });
  if (els.ordenesFiltroEstadoPago) els.ordenesFiltroEstadoPago.addEventListener('change', () => aplicarFiltrosOrdenes());
  if (els.ordenesFiltroFacturacion) els.ordenesFiltroFacturacion.addEventListener('change', () => aplicarFiltrosOrdenes());
  if (els.ordenesFiltroPeriodo) {
    els.ordenesFiltroPeriodo.addEventListener('change', () => {
      // Periodo archivado vive en el servidor — hay que volver a pedir la lista
      cargarOrdenes();
      // Refresca también el selector de gastos por si el cierre creó un periodo nuevo
      cargarPeriodosArchivados();
    });
  }
  els.btnLimpiarFiltrosOrdenes.addEventListener('click', () => {
    els.ordenesFiltroConcepto.value = '';
    els.ordenesFiltroFechaDesde.value = '';
    els.ordenesFiltroFechaHasta.value = '';
    els.ordenesFiltroTotalMin.value = '';
    els.ordenesFiltroTotalMax.value = '';
    if (els.ordenesFiltroEstadoPago) els.ordenesFiltroEstadoPago.value = '';
    if (els.ordenesFiltroFacturacion) els.ordenesFiltroFacturacion.value = '';
    if (els.ordenesFiltroPeriodo) els.ordenesFiltroPeriodo.value = '';
    if (els.ordenesFiltroPeriodo) cargarOrdenes();
    else aplicarFiltrosOrdenes();
  });

  // Intenta leer una línea "N x Concepto ($X.XX c/u)" (el formato exacto
  // que arma btnAgregarProductoOrden) de vuelta a sus 3 valores — usado
  // por el modal de detalle para reconstruir la tabla de productos con
  // su subtotal. Si la línea no sigue ese formato (concepto capturado a
  // mano), regresa null.
  function parsearProductoDeLinea(linea) {
    const match = linea.match(/^(\d+)\s*x\s*(.+?)\s*\(\$([\d,]+\.\d{2})\s*c\/u\)$/i);
    if (!match) return null;
    const [, cantidadTexto, concepto, precioTexto] = match;
    const cantidad = Number(cantidadTexto);
    const precio = Number(precioTexto.replace(/,/g, ''));
    return { cantidad, concepto, precio, subtotal: Math.round(cantidad * precio * 100) / 100 };
  }

  // Arma el ticket de impresión (diseño angosto tipo recibo físico, ver
  // admin.css) a partir de los datos YA guardados de una venta — reutiliza
  // el mismo parser de #orden-modal-productos-body, cero datos nuevos del
  // backend. Se llama desde 3 lugares: justo después de guardar (si el
  // método de entrega fue "imprimir"), el ícono de la fila, y el botón
  // "Imprimir ticket" del modal "Ver venta" — mismo componente, 3 entradas.
  function construirHtmlTicket(orden) {
    const fecha = orden.fecha_compra_formateada
      ? `${orden.fecha_compra_formateada.fecha} ${orden.fecha_compra_formateada.hora}`
      : '';
    const conceptoLimpio = String(orden.concepto || '').replace(/\r/g, '').trim();
    const lineas = conceptoLimpio.split('\n').map((l) => l.trim()).filter(Boolean);
    const productos = lineas.map(parsearProductoDeLinea);
    const todosParsearon = productos.length > 0 && productos.every((p) => p !== null);
    const filasHtml = todosParsearon
      ? productos
          .map(
            (p) => `
              <div class="ticket-imprimir-linea">
                <span>${p.cantidad} x ${escapeHtml(p.concepto)}</span>
                <span>$${formatearMoneda(p.subtotal)}</span>
              </div>`
          )
          .join('')
      : `<div class="ticket-imprimir-linea"><span>${escapeHtml(orden.concepto)}</span></div>`;
    const ivaMonto = Math.round((Number(orden.total) - Number(orden.cantidad)) * 100) / 100;
    // Punto 227: `orden.cantidad` ya es el subtotal NETO (con descuento
    // aplicado, si hubo uno) — se reconstruye el bruto sumando de vuelta
    // `descuento_monto` (exacto, sin dividir entre nada) solo para
    // mostrar la línea "Subtotal" tal como se vio antes del descuento.
    const tieneDescuento = Boolean(orden.descuento_porcentaje);
    const descuentoMonto = tieneDescuento ? Number(orden.descuento_monto) : 0;
    const subtotalBruto = tieneDescuento
      ? Math.round((Number(orden.cantidad) + descuentoMonto) * 100) / 100
      : Number(orden.cantidad);
    const filaDescuentoHtml = tieneDescuento
      ? `<div class="ticket-imprimir-linea"><span>Descuento (${Number(orden.descuento_porcentaje)}%)</span><span>-$${formatearMoneda(descuentoMonto)}</span></div>`
      : '';

    return `
      <img class="ticket-imprimir-logo" src="/assets/logoImpresora.png" alt="CLARVO" />
      <div class="ticket-imprimir-titulo">Ticket de venta</div>
      <div class="ticket-imprimir-separador"></div>
      <div class="ticket-imprimir-meta">Folio: ${escapeHtml(orden.numero_compra || '—')}</div>
      <div class="ticket-imprimir-meta">${escapeHtml(fecha)}</div>
      <div class="ticket-imprimir-separador"></div>
      ${filasHtml}
      <div class="ticket-imprimir-separador"></div>
      <div class="ticket-imprimir-linea"><span>Subtotal</span><span>$${formatearMoneda(subtotalBruto)}</span></div>
      ${filaDescuentoHtml}
      <div class="ticket-imprimir-linea"><span>IVA (${Number(orden.iva_porcentaje)}%)</span><span>$${formatearMoneda(ivaMonto)}</span></div>
      <div class="ticket-imprimir-linea ticket-imprimir-total"><span>TOTAL</span><span>$${formatearMoneda(orden.total)}</span></div>
      ${orden.metodo_pago === 'transferencia' && orden.folio_conciliacion ? `
      <div class="ticket-imprimir-concepto">
        <div class="ticket-imprimir-concepto-label">Concepto para transferencia</div>
        <div class="ticket-imprimir-concepto-valor">${escapeHtml(orden.folio_conciliacion)}</div>
      </div>` : ''}
      <div class="ticket-imprimir-separador"></div>
      ${orden.email ? `<div class="ticket-imprimir-meta">Cliente: ${escapeHtml(orden.email)}</div><div class="ticket-imprimir-separador"></div>` : ''}
      <div class="ticket-imprimir-gracias">¡Gracias por su compra!</div>
      <div class="ticket-imprimir-sitio">Visítanos https://clarvo.mx</div>
    `;
  }

  // Único punto de entrada de los 3 disparadores de impresión (guardar+
  // imprimir, ícono de fila, "Ver venta") — antes cada uno llamaba a
  // window.print() directo; ahora todos abren esta vista previa primero,
  // y window.print() solo se dispara desde su botón "Imprimir".
  let ticketPreviewOrdenActual = null;
  // `esBorrador` (punto "Vista previa" de Registrar venta, homologado con
  // stitch/): vista previa ANTES de guardar, con los datos capturados
  // hasta ahora — sin folio real todavía, así que se avisa y se oculta
  // "Imprimir" (imprimir un folio inventado confundiría más que ayudar).
  // Los 4 disparadores normales (después de guardar de verdad) no pasan
  // este parámetro, se quedan exactamente igual que siempre.
  function abrirPreviewTicket(orden, esBorrador) {
    ticketPreviewOrdenActual = orden;
    els.ticketPreviewRecibo.innerHTML = construirHtmlTicket(orden);
    if (els.ticketPreviewAvisoBorrador) els.ticketPreviewAvisoBorrador.hidden = !esBorrador;
    if (els.btnTicketPreviewImprimir) els.btnTicketPreviewImprimir.hidden = Boolean(esBorrador);
    els.ticketPreviewModalOverlay.hidden = false;
  }
  function cerrarPreviewTicket() {
    els.ticketPreviewModalOverlay.hidden = true;
    ticketPreviewOrdenActual = null;
  }
  els.btnTicketPreviewCerrar.addEventListener('click', cerrarPreviewTicket);
  els.ticketPreviewModalOverlay.addEventListener('click', (e) => {
    if (e.target === els.ticketPreviewModalOverlay) cerrarPreviewTicket();
  });
  els.btnTicketPreviewImprimir.addEventListener('click', () => {
    if (!ticketPreviewOrdenActual) return;
    els.ticketImprimir.innerHTML = construirHtmlTicket(ticketPreviewOrdenActual);
    // Ajuste dinámico del alto de página para rollo 58mm continuo:
    // el ticket está oculto (display:none) en pantalla, así que lo hacemos
    // visible fuera de pantalla solo para medir su alto real y fijar @page
    // a esa altura exacta — sin esto queda 1 hoja enorme en blanco (A4).
    // Bug real corregido 2026-09-11 (reportado con impresora térmica
    // física): el ancho/tipografía de 58mm que definen este alto vivían
    // SOLO dentro de @media print (admin.css) — la medición de aquí
    // ocurría a un ancho de pantalla mucho más amplio y letra más grande,
    // así que envolvía muchas menos líneas y calculaba un alto muy por
    // debajo del real; la impresora/driver rechazaba ese tamaño de
    // página tan chico y caía a su papel por default (mucho más largo
    // que el ticket) — de ahí el rollo en blanco. Fix real: esas reglas
    // de ancho/tipografía se movieron a `#ticket-imprimir` sin depender
    // de @media print (ver admin.css), así esta medición ya usa el mismo
    // layout compacto de 58mm que realmente se imprime.
    try {
      const prevHidden = els.ticketImprimir.hidden;
      const prevDisplay = els.ticketImprimir.style.display;
      const prevPos = els.ticketImprimir.style.position;
      const prevLeft = els.ticketImprimir.style.left;
      const prevVis = els.ticketImprimir.style.visibility;
      els.ticketImprimir.hidden = false;
      els.ticketImprimir.style.display = 'block';
      els.ticketImprimir.style.position = 'absolute';
      els.ticketImprimir.style.left = '-9999px';
      els.ticketImprimir.style.visibility = 'hidden';
      const hPx = els.ticketImprimir.scrollHeight || els.ticketImprimir.offsetHeight || 200;
      els.ticketImprimir.hidden = prevHidden;
      els.ticketImprimir.style.display = prevDisplay;
      els.ticketImprimir.style.position = prevPos;
      els.ticketImprimir.style.left = prevLeft;
      els.ticketImprimir.style.visibility = prevVis;
      const hMm = Math.max(32, Math.ceil(hPx * 0.264583 + 8));
      let estilo = document.getElementById('print-page-size');
      if (!estilo) { estilo = document.createElement('style'); estilo.id = 'print-page-size'; document.head.appendChild(estilo); }
      estilo.textContent = `@page { size: 58mm ${hMm}mm; margin: 0; } @media print { @page { size: 58mm ${hMm}mm; margin: 0; } html, body { height: ${hMm}mm !important; } #ticket-imprimir { height: ${hMm}mm !important; max-height: ${hMm}mm !important; } }`;
    } catch (_) {}
    cerrarPreviewTicket();
    window.print();
  });

  // Vista previa del concepto para la tabla (resumida): un concepto de
  // varios productos solo muestra el primero + "+N más" — el detalle
  // completo vive en el modal, que abre el link de "No. Venta".
  function renderConceptoPreviewOrden(concepto) {
    const lineas = concepto.split('\n').filter((linea) => linea.trim());
    if (lineas.length <= 1) return escapeHtml(concepto);
    const primerProducto = parsearProductoDeLinea(lineas[0]);
    const textoPrimera = primerProducto
      ? `${primerProducto.cantidad}× ${primerProducto.concepto}`
      : lineas[0];
    return `${escapeHtml(textoPrimera)} <span class="orden-concepto-mas">+${lineas.length - 1} más</span>`;
  }

  // Fila de una venta capturada sin conexión, todavía sin folio real (ver
  // PROJECT_STATE.md punto 132). Sin "No. Venta" clicable (no hay id de
  // servidor todavía) y sin Reenviar/Imprimir/Eliminar — nada de eso
  // aplica hasta que exista de verdad en el servidor. "Descartar" quita
  // la fila de la cola local; "Reintentar" solo aparece si ya falló una
  // vez al sincronizar.
  // Punto 342 (fusionado a pedido del usuario tras ver la tabla real:
  // "Método de pago"/"Folio conciliación" por separado dejaba casi
  // siempre la 2da columna en "—"): una sola columna "Pago" — ícono por
  // método + el folio, cuando existe, con su propio botón de copiar
  // directo desde la tabla (sin abrir el detalle de la venta). Ventas de
  // antes de este punto no tienen el dato (NULL, ver db.js) y se
  // muestran como "—", no como un valor inventado.
  const ETIQUETAS_METODO_PAGO_ORDEN = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta_credito: 'T. crédito',
    tarjeta_debito: 'T. débito',
  };
  const ICONOS_METODO_PAGO_ORDEN = {
    efectivo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 8h20M2 8v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    transferencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 10l5-5 5 5M7 14l5 5 5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tarjeta_credito: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    tarjeta_debito: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4" stroke-linecap="round"/></svg>',
  };
  const ICONO_COPIAR_FOLIO_TABLA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  function celdaPagoOrden(metodo, folio) {
    if (!metodo || !ETIQUETAS_METODO_PAGO_ORDEN[metodo]) return '—';
    const esTransferencia = metodo === 'transferencia';
    const folioHtml = folio
      ? `<button type="button" class="folio-copiable" data-folio="${escapeHtml(folio)}">${ICONO_COPIAR_FOLIO_TABLA}<span>${escapeHtml(folio)}</span></button>`
      : '';
    return `<div class="pago-icono-fila">
      <span class="pago-icono-swatch${esTransferencia ? ' is-transferencia' : ''}">${ICONOS_METODO_PAGO_ORDEN[metodo]}</span>
      <div class="pago-icono-texto"><span class="metodo-label">${escapeHtml(ETIQUETAS_METODO_PAGO_ORDEN[metodo])}</span>${folioHtml}</div>
    </div>`;
  }

  function filaOrdenPendiente(orden) {
    const tr = document.createElement('tr');
    tr.className = `fila-pendiente-sync${orden.__error ? ' tiene-error' : ''}`;
    const badgeTexto = orden.__error ? '⚠ No se pudo sincronizar' : '⏳ Pendiente de sincronizar';
    const errorHtml = orden.__error
      ? `<span class="pendiente-sync-error">${escapeHtml(orden.__error)}</span>`
      : '';
    tr.innerHTML = `
      <td data-label="No. Venta" data-col="numero"><span class="pendiente-sync-badge">${badgeTexto}</span>${errorHtml}</td>
      <td data-label="Fecha" data-col="fecha">${escapeHtml(orden.fecha_compra_formateada.fecha)}<div class="admin-fecha-hora">${escapeHtml(orden.fecha_compra_formateada.hora)}</div></td>
      <td data-label="Concepto" data-col="concepto">${renderConceptoPreviewOrden(orden.concepto)}</td>
      <td data-label="Total" data-col="total"><strong>~$${formatearMoneda(orden.total)}</strong></td>
      <td data-label="Correo" data-col="correo">${orden.email ? escapeHtml(orden.email) : 'Sin correo'}</td>
      <td data-label="Pago" data-col="pago">${celdaPagoOrden(orden.metodo_pago, orden.folio_conciliacion)}</td>
      <td data-label=""></td>
    `;
    const celdaAcciones = tr.lastElementChild;
    const contenedor = document.createElement('div');
    contenedor.className = 'pendiente-sync-acciones';

    if (orden.__error) {
      const btnReintentar = document.createElement('button');
      btnReintentar.type = 'button';
      btnReintentar.className = 'btn btn-secondary';
      btnReintentar.textContent = 'Reintentar';
      btnReintentar.addEventListener('click', async () => {
        btnReintentar.disabled = true;
        await OfflineQueue.reintentarUno('ordenes', orden.__localId);
      });
      contenedor.appendChild(btnReintentar);
    }

    const btnDescartar = document.createElement('button');
    btnDescartar.type = 'button';
    btnDescartar.className = 'btn btn-secondary';
    btnDescartar.textContent = 'Descartar';
    btnDescartar.addEventListener('click', () => {
      abrirConfirmacion({
        titulo: '¿Descartar esta venta pendiente?',
        mensaje: 'Se borra de la cola local sin registrarse en el servidor — no se puede deshacer.',
        textoBoton: 'Descartar',
        onConfirmar: () => OfflineQueue.eliminarPendiente('ordenes', orden.__localId),
      });
    });
    contenedor.appendChild(btnDescartar);

    celdaAcciones.appendChild(contenedor);
    return tr;
  }

  function renderOrdenes(ordenes) {
    els.ordenesCount.textContent = `${ordenes.length} venta${ordenes.length === 1 ? '' : 's'}`;
    els.ordenesTableBody.innerHTML = '';
    els.ordenesEmpty.hidden = ordenes.length > 0;

    ordenes.forEach((orden) => {
      if (orden.__pendiente) {
        els.ordenesTableBody.appendChild(filaOrdenPendiente(orden));
        return;
      }
      // Fecha y hora en 2 líneas (antes iban juntas en una sola línea que
      // no cabía en el ancho de la columna y quedaba cortada a la mitad
      // entre filas) — mismo patrón ya usado en "Actualizado" (Tickets).
      const fechaCeldaHtml = orden.fecha_compra_formateada
        ? `<div>${escapeHtml(orden.fecha_compra_formateada.fecha)}</div><div class="admin-fecha-hora">${escapeHtml(orden.fecha_compra_formateada.hora)}</div>`
        : '—';
      const iconoFacturado = orden.facturado
        ? '<span class="orden-facturado-icono" data-tooltip="Venta facturada" aria-label="Venta facturada"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8z" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2v6h6M9 13h6M9 17h6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
        : '';
      const estadoPago = orden.estado_pago || 'pagada';
      const esPendiente = estadoPago === 'pendiente';
      const vencida = esPendiente && orden.fecha_vencimiento && new Date(orden.fecha_vencimiento + 'T00:00:00') < new Date(new Date().toISOString().slice(0,10)+'T00:00:00');
      const badgeEstadoPago = esPendiente
        ? `<span class="estatus-badge ${vencida ? 'estatus-cancelado' : 'estatus-pendiente'}" style="margin-left:6px">${vencida ? 'Vencida' : 'Pendiente'}</span>`
        : '<span class="estatus-badge estatus-listo" style="margin-left:6px">Pagada</span>';
      // Razón social asociada al correo, para el tooltip — se busca en
      // la misma caché ya cargada para el desplegable del formulario
      // (ver cargarCorreosRegistrados), no hace falta pedirla de nuevo.
      const registroDelCorreo = correosRegistradosCache.find((c) => c.email === orden.email);
      const tituloCorreo = !orden.email
        ? 'Venta registrada sin correo (se imprimió el ticket)'
        : registroDelCorreo && registroDelCorreo.nombre
          ? `Razón social: ${registroDelCorreo.nombre}`
          : 'Razón social no disponible';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="No. Venta" data-col="numero">${iconoFacturado}<button type="button" class="orden-numero-link">${escapeHtml(orden.numero_compra || '—')}</button>${badgeEstadoPago}</td>
        <td data-label="Fecha" data-col="fecha">${fechaCeldaHtml}</td>
        <td data-label="Concepto" data-col="concepto">${renderConceptoPreviewOrden(orden.concepto)}</td>
        <td data-label="Total" data-col="total"><strong>$${formatearMoneda(orden.total)}</strong></td>
        <td data-label="Correo" data-col="correo" class="orden-correo-con-tooltip" data-tooltip="${escapeHtml(tituloCorreo)}">${orden.email ? escapeHtml(orden.email) : 'Sin correo'}</td>
        <td data-label="Pago" data-col="pago">${celdaPagoOrden(orden.metodo_pago, orden.folio_conciliacion)}</td>
        <td data-label=""></td>
      `;

      tr.querySelector('.orden-numero-link').addEventListener('click', () => abrirOrdenModal(orden));

      const celdaAccionesOrden = tr.lastElementChild;
      const contenedorAccionesOrden = document.createElement('div');
      contenedorAccionesOrden.className = 'admin-row-actions admin-row-actions-iconos';

      const btnReenviar = document.createElement('button');
      btnReenviar.type = 'button';
      btnReenviar.className = 'btn-icono-accion';
      const tituloReenviar = orden.email ? 'Reenviar correo de confirmación' : 'Asignar correo y enviar';
      btnReenviar.setAttribute('data-tooltip', tituloReenviar);
      btnReenviar.setAttribute('aria-label', tituloReenviar);
      btnReenviar.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m3.5 6 8.5 7 8.5-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btnReenviar.addEventListener('click', () => iniciarReenvioOrden(orden, btnReenviar));
      contenedorAccionesOrden.appendChild(btnReenviar);

      const btnImprimirOrden = document.createElement('button');
      btnImprimirOrden.type = 'button';
      btnImprimirOrden.className = 'btn-icono-accion';
      btnImprimirOrden.setAttribute('data-tooltip', 'Imprimir ticket');
      btnImprimirOrden.setAttribute('aria-label', 'Imprimir ticket');
      btnImprimirOrden.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="4" y="9" width="16" height="8" rx="1.2" stroke="currentColor" stroke-width="1.6"/><path d="M6 14h12v7H6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      btnImprimirOrden.addEventListener('click', () => abrirPreviewTicket(orden));
      contenedorAccionesOrden.appendChild(btnImprimirOrden);

      const btnEliminarOrden = document.createElement('button');
      btnEliminarOrden.type = 'button';
      btnEliminarOrden.className = 'btn-icono-accion btn-icono-accion-peligro';
      btnEliminarOrden.setAttribute('data-tooltip', 'Eliminar venta');
      btnEliminarOrden.setAttribute('aria-label', 'Eliminar venta');
      btnEliminarOrden.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btnEliminarOrden.addEventListener('click', () => confirmarEliminarOrden(orden.id, orden.numero_compra));
      contenedorAccionesOrden.appendChild(btnEliminarOrden);

      celdaAccionesOrden.appendChild(contenedorAccionesOrden);
      els.ordenesTableBody.appendChild(tr);
    });
  }

  // Modal de detalle de una venta — abre al hacer clic en el
  // "No. Venta" de la tabla (ahora resumida); mismo lenguaje visual que
  // "Gestionar" de tickets, con los mismos datos de siempre, solo
  // reordenados en 2 columnas.
  let ordenModalActual = null;

  function abrirOrdenModal(orden) {
    ordenModalActual = orden;
    els.ordenModalTitle.textContent = `Venta ${orden.numero_compra}`;
    els.ordenModalBadge.hidden = !orden.facturado;

    const fecha = orden.fecha_compra_formateada;
    els.ordenModalFecha.textContent = fecha ? `${fecha.fecha} ${fecha.hora}` : '—';
    els.ordenModalCorreo.textContent = orden.email || 'Sin correo';

    const registroDelCorreo = correosRegistradosCache.find((c) => c.email === orden.email);
    els.ordenModalRfcItem.hidden = !registroDelCorreo;
    els.ordenModalRazonItem.hidden = !(registroDelCorreo && registroDelCorreo.nombre);
    if (registroDelCorreo) {
      els.ordenModalRfc.textContent = registroDelCorreo.rfc || '—';
      els.ordenModalRazon.textContent = registroDelCorreo.nombre || '—';
    }

    // Productos: si TODAS las líneas del concepto siguen el formato del
    // armador ("N x Concepto ($X.XX c/u)"), se arma la misma tabla que ya
    // se ve al capturar la orden (Concepto/P. Unitario/Cant./Subtotal).
    // Si no (concepto capturado a mano, de antes de este cambio), se
    // muestra como texto simple.
    const lineas = orden.concepto.split('\n').filter((linea) => linea.trim());
    const productos = lineas.map(parsearProductoDeLinea);
    const todosParsearon = productos.length > 0 && productos.every((p) => p !== null);

    els.ordenModalProductosTablaWrap.hidden = !todosParsearon;
    els.ordenModalConceptoSimple.hidden = todosParsearon;
    if (todosParsearon) {
      els.ordenModalProductosBody.innerHTML = productos
        .map(
          (p) => `
            <tr>
              <td>${escapeHtml(p.concepto)}</td>
              <td>$${formatearMoneda(p.precio)}</td>
              <td>${p.cantidad}</td>
              <td>$${formatearMoneda(p.subtotal)}</td>
            </tr>`
        )
        .join('');
    } else {
      els.ordenModalConceptoSimple.textContent = orden.concepto;
    }

    // Punto 227: "Cantidad" muestra el subtotal BRUTO (antes del
    // descuento) para que la línea "Descuento" de abajo tenga sentido —
    // `orden.cantidad` guardado ya es el neto, se reconstruye sumando de
    // vuelta `descuento_monto` (exacto, mismo criterio que el ticket).
    const tieneDescuentoModal = Boolean(orden.descuento_porcentaje);
    const subtotalBrutoModal = tieneDescuentoModal
      ? Math.round((Number(orden.cantidad) + Number(orden.descuento_monto)) * 100) / 100
      : Number(orden.cantidad);
    els.ordenModalCantidad.textContent = `$${formatearMoneda(subtotalBrutoModal)}`;
    els.ordenModalDescuentoWrap.hidden = !tieneDescuentoModal;
    if (tieneDescuentoModal) {
      els.ordenModalDescuento.textContent = `-$${formatearMoneda(Number(orden.descuento_monto))} (${Number(orden.descuento_porcentaje)}%)`;
    }
    els.ordenModalIva.textContent = `${Number(orden.iva_porcentaje)}%`;
    els.ordenModalTotal.textContent = `$${formatearMoneda(orden.total)} MXN`;

    els.ordenModalOverlay.hidden = false;
  }

  function cerrarOrdenModal() {
    els.ordenModalOverlay.hidden = true;
    ordenModalActual = null;
  }

  els.btnOrdenModalCerrar.addEventListener('click', cerrarOrdenModal);
  els.ordenModalOverlay.addEventListener('click', (e) => {
    if (e.target === els.ordenModalOverlay) cerrarOrdenModal();
  });
  els.btnOrdenModalReenviar.addEventListener('click', () => {
    if (!ordenModalActual) return;
    iniciarReenvioOrden(ordenModalActual, els.btnOrdenModalReenviar);
  });
  els.btnOrdenModalImprimir.addEventListener('click', () => {
    if (!ordenModalActual) return;
    abrirPreviewTicket(ordenModalActual);
  });
  els.btnOrdenModalEliminar.addEventListener('click', () => {
    if (!ordenModalActual) return;
    confirmarEliminarOrden(ordenModalActual.id, ordenModalActual.numero_compra);
  });

  function confirmarEliminarOrden(id, numeroCompra) {
    abrirConfirmacion({
      titulo: '¿Eliminar venta?',
      mensaje: `Se eliminará la venta ${numeroCompra} permanentemente. Antes de borrarla, se genera un reporte con su información y se envía al correo de reportes configurado (si hay uno) — esta acción no se puede deshacer.`,
      textoBoton: 'Eliminar',
      onConfirmar: () => eliminarOrden(id),
    });
  }

  async function eliminarOrden(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/ordenes-compra/${id}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'No se pudo eliminar la venta.', true);
        return;
      }
      showToast(data.mensaje || 'Venta eliminada.');
      els.ordenModalOverlay.hidden = true;
      cargarOrdenes();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // Punto de entrada único para el ícono/botón "Reenviar correo": si la
  // venta todavía no tiene uno (se registró con "Imprimir ticket"), pide
  // primero uno nuevo en vez de intentar reenviar a nada.
  function iniciarReenvioOrden(orden, boton) {
    if (!orden.email) {
      abrirAsignarCorreoOrden(orden, boton);
      return;
    }
    reenviarCorreoOrden(orden.id, orden.numero_compra, orden.email, boton);
  }

  // `emailNuevo` solo se manda cuando la venta no tenía correo — el
  // backend lo guarda ahí antes de enviar (ver POST .../reenviar-correo).
  async function reenviarCorreoOrden(id, numeroCompra, email, boton, emailNuevo) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    boton.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/admin/ordenes-compra/${id}/reenviar-correo`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          ...(emailNuevo ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(emailNuevo ? { body: JSON.stringify({ email: emailNuevo }) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || `No se pudo reenviar el correo de ${numeroCompra}.`, true);
        return;
      }
      const correoFinal = data.email || email;
      const notaConstancia =
        data.tiene_constancia === true
          ? ' (sí tiene constancia fiscal asignada)'
          : data.tiene_constancia === false
            ? ' (todavía sin constancia fiscal asignada)'
            : '';
      showToast(`Correo de ${numeroCompra} enviado a ${correoFinal}.${notaConstancia}`);
      if (ordenModalActual && ordenModalActual.id === id) {
        ordenModalActual.email = correoFinal;
        abrirOrdenModal(ordenModalActual);
      }
      cargarOrdenes();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    } finally {
      boton.disabled = false;
    }
  }

  // Modal chico "Asignar correo" — se abre cuando "Reenviar correo" se
  // usa sobre una venta que todavía no tiene uno guardado.
  let ordenAsignarCorreoActual = null;
  function abrirAsignarCorreoOrden(orden, boton) {
    ordenAsignarCorreoActual = { id: orden.id, numeroCompra: orden.numero_compra, boton };
    els.ordenAsignarCorreoInput.value = '';
    setFieldError('orden-asignar-correo', '');
    els.ordenAsignarCorreoOverlay.hidden = false;
    els.ordenAsignarCorreoInput.focus();
  }
  function cerrarAsignarCorreoOrden() {
    els.ordenAsignarCorreoOverlay.hidden = true;
    ordenAsignarCorreoActual = null;
  }
  els.btnOrdenAsignarCorreoCancelar.addEventListener('click', cerrarAsignarCorreoOrden);
  els.ordenAsignarCorreoOverlay.addEventListener('click', (e) => {
    if (e.target === els.ordenAsignarCorreoOverlay) cerrarAsignarCorreoOrden();
  });
  els.btnOrdenAsignarCorreoEnviar.addEventListener('click', async () => {
    if (!ordenAsignarCorreoActual) return;
    const email = els.ordenAsignarCorreoInput.value.trim().toLowerCase();
    if (!email || !els.ordenAsignarCorreoInput.checkValidity()) {
      setFieldError('orden-asignar-correo', 'Captura un correo electrónico válido.');
      return;
    }
    const { id, numeroCompra, boton } = ordenAsignarCorreoActual;
    cerrarAsignarCorreoOrden();
    await reenviarCorreoOrden(id, numeroCompra, email, boton, email);
  });

  // ---------- Usuarios registrados ----------

  els.btnRefreshUsuarios.addEventListener('click', () => cargarUsuarios());
  els.usuariosFiltroPerfil.addEventListener('change', () => cargarUsuarios());

  async function cargarUsuarios() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.usuariosError.textContent = '';
    Esqueleto.aplicarEsqueletoTabla(els.usuariosTableBody, 5);
    try {
      const perfil = els.usuariosFiltroPerfil.value;
      const query = perfil ? `?perfil=${encodeURIComponent(perfil)}` : '';
      const res = await fetch(`${API_BASE}/admin/usuarios${query}`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.usuariosTableBody, 5, 'No se pudieron cargar los usuarios.', cargarUsuarios);
        return;
      }
      const data = await res.json();
      renderUsuarios(data.usuarios || []);
      Esqueleto.quitarEsqueletoTabla(els.usuariosTableBody);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.usuariosTableBody, 5, 'No se pudo conectar con el servidor.', cargarUsuarios);
    }
  }

  function renderUsuarios(usuarios) {
    els.usuariosCount.textContent = `${usuarios.length} usuario${usuarios.length === 1 ? '' : 's'}`;
    els.usuariosTableBody.innerHTML = '';
    els.usuariosEmpty.hidden = usuarios.length > 0;

    usuarios.forEach((u) => {
      const pendienteCambio = Boolean(u.debe_cambiar_password);
      const perfilInfo = PERFIL_INFO[u.perfil] || { texto: u.perfil, clase: '' };
      // Correo y teléfono se combinan en una sola celda "Contacto" (uno
      // debajo del otro) — reduce la tabla de 6 a 5 columnas, y evita
      // dos columnas casi siempre parcialmente vacías (no todo usuario
      // captura teléfono) ocupando su propio espacio fijo cada una.
      const contactoHtml = [
        u.email ? `<span class="usuario-contacto-linea">${escapeHtml(u.email)}</span>` : '',
        u.telefono ? `<span class="usuario-contacto-linea usuario-contacto-secundario">${escapeHtml(u.telefono)}</span>` : '',
      ]
        .filter(Boolean)
        .join('') || '—';
      const activo = u.activo === undefined ? true : Boolean(u.activo);
      // Punto 349-350-351 (regla 9): una cuenta suspendida por el límite
      // de usuarios del plan (no por un administrador) lleva su propio
      // motivo visible — el admin del tenant necesita distinguir "la
      // suspendió el sistema" de "la suspendí yo".
      const suspendidaPorLimite = !activo && u.suspendido_motivo === 'limite_usuarios_plan';
      const badgeEstado = activo
        ? '<span class="estatus-badge estatus-activo">Activo</span>'
        : suspendidaPorLimite
        ? '<span class="estatus-badge estatus-suspendido" data-tooltip="Suspendido automáticamente: se superó el límite de usuarios del plan">Suspendido (límite de plan)</span>'
        : '<span class="estatus-badge estatus-suspendido">Suspendido</span>';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="RFC / usuario" data-col="rfc"><strong>${escapeHtml(u.rfc)}</strong> ${badgeEstado}${pendienteCambio ? ' <span class="estatus-badge estatus-pendiente" data-tooltip="Debe cambiar su contraseña en el siguiente inicio de sesión">Cambio pendiente</span>' : ''}</td>
        <td data-label="Perfil" data-col="perfil"><span class="perfil-badge ${perfilInfo.clase}">${escapeHtml(perfilInfo.texto)}</span></td>
        <td data-label="Contacto" data-col="contacto">${contactoHtml}</td>
        <td data-label="Registrado" data-col="registrado">${formatFecha(u.creado_en)}</td>
        <td data-label=""></td>
      `;

      const celdaAcciones = tr.lastElementChild;
      const contenedorAcciones = document.createElement('div');
      contenedorAcciones.className = 'admin-row-actions admin-row-actions-iconos';

      // Los tres botones de acción pasaron de texto completo (el de
      // "Restablecer contraseña" por sí solo ya hacía la columna más
      // ancha que cualquier otra) a íconos compactos con tooltip — el
      // mismo patrón ya usado para el ícono de nota en la lista de
      // tickets, aquí aplicado a las tres acciones de esta tabla.
      const btnEditar = document.createElement('button');
      btnEditar.type = 'button';
      btnEditar.className = 'btn-icono-accion';
      btnEditar.setAttribute('data-tooltip', 'Editar usuario');
      btnEditar.setAttribute('aria-label', 'Editar usuario');
      btnEditar.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
      btnEditar.addEventListener('click', () => abrirEditarUsuarioModal(u));
      contenedorAcciones.appendChild(btnEditar);

      const btnReset = document.createElement('button');
      btnReset.type = 'button';
      btnReset.className = 'btn-icono-accion';
      btnReset.setAttribute('data-tooltip', 'Restablecer contraseña');
      btnReset.setAttribute('aria-label', 'Restablecer contraseña');
      btnReset.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="15" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M11 12l9-9M16 3l3 3M13 6l2.5 2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btnReset.addEventListener('click', () => abrirPasswordModal(u));
      contenedorAcciones.appendChild(btnReset);

      const divisorEstado = document.createElement('div');
      divisorEstado.className = 'admin-row-actions-divisor';
      contenedorAcciones.appendChild(divisorEstado);

      // Mismos 2 SVG ya usados para suspender/reactivar un tenant en
      // /control (pausa / check) — reutilizados aquí para el mismo
      // concepto, sin inventar íconos nuevos.
      const btnEstado = document.createElement('button');
      btnEstado.type = 'button';
      btnEstado.className = 'btn-icono-accion';
      btnEstado.setAttribute('data-tooltip', activo ? 'Suspender usuario' : 'Reactivar usuario');
      btnEstado.setAttribute('aria-label', activo ? 'Suspender usuario' : 'Reactivar usuario');
      btnEstado.innerHTML = activo
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M8 4v16M16 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btnEstado.addEventListener('click', () => confirmarCambiarEstadoUsuario(u, activo));
      contenedorAcciones.appendChild(btnEstado);

      const btnEliminar = document.createElement('button');
      btnEliminar.type = 'button';
      btnEliminar.className = 'btn-icono-accion btn-icono-accion-peligro';
      btnEliminar.setAttribute('data-tooltip', 'Eliminar usuario');
      btnEliminar.setAttribute('aria-label', 'Eliminar usuario');
      btnEliminar.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btnEliminar.addEventListener('click', () => confirmarEliminarUsuario(u.id, u.rfc));
      contenedorAcciones.appendChild(btnEliminar);

      celdaAcciones.appendChild(contenedorAcciones);
      els.usuariosTableBody.appendChild(tr);
    });
  }

  function confirmarCambiarEstadoUsuario(u, activo) {
    if (activo) {
      abrirConfirmacion({
        titulo: '¿Suspender este usuario?',
        mensaje: `"${u.rfc}" no podrá iniciar sesión hasta que lo reactives. No se borra ningún dato ni su historial.`,
        textoBoton: 'Suspender',
        onConfirmar: () => cambiarEstadoUsuario(u.id, false),
      });
    } else {
      abrirConfirmacion({
        titulo: '¿Reactivar este usuario?',
        mensaje: `"${u.rfc}" volverá a poder iniciar sesión de inmediato.`,
        textoBoton: 'Reactivar',
        onConfirmar: () => cambiarEstadoUsuario(u.id, true),
      });
    }
  }

  async function cambiarEstadoUsuario(id, activo) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/usuarios/${id}/estado`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'No se pudo cambiar el estado del usuario.', true);
        return;
      }
      showToast(data.mensaje || 'Estado actualizado.');
      cargarUsuarios();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  function confirmarEliminarUsuario(id, rfc) {
    abrirConfirmacion({
      titulo: '¿Eliminar usuario?',
      mensaje: `Se eliminará la cuenta "${rfc}" de forma permanente — no hay papelera para usuarios. Sus constancias y tickets ya subidos no se ven afectados, ya que se identifican por RFC, no por esta cuenta.`,
      textoBoton: 'Eliminar',
      onConfirmar: () => eliminarUsuario(id),
    });
  }

  async function eliminarUsuario(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/usuarios/${id}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'No se pudo eliminar el usuario.', true);
        return;
      }
      showToast(data.mensaje || 'Usuario eliminado.');
      cargarUsuarios();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // ---------- Modal de crear usuario ----------

  function actualizarCamposSegunPerfil() {
    const perfil = els.crearUsuarioPerfil.value;
    if (perfil === 'cliente') {
      // Punto en curso: sin Facturación activa, el RFC no tiene para qué
      // pedirse (nadie va a facturar) — el campo desaparece entero, el
      // backend genera un identificador interno (ver
      // generarIdentificadorSinFiscal en server.js).
      els.crearUsuarioRfcField.hidden = !planPermite('facturacionHabilitada');
      els.crearUsuarioRfcLabel.textContent = 'RFC';
      els.crearUsuarioRfc.placeholder = 'XAXX010101000';
      els.crearUsuarioRfcHint.textContent = 'RFC del cliente, con el que iniciará sesión en el portal.';
      els.crearUsuarioTelefonoField.hidden = false;
    } else {
      els.crearUsuarioRfcField.hidden = false;
      els.crearUsuarioRfcLabel.textContent = 'Nombre de usuario';
      els.crearUsuarioRfc.placeholder = 'ej. jperez';
      els.crearUsuarioRfcHint.textContent = 'No necesita ser un RFC real — es el nombre con el que iniciará sesión en el panel de administración.';
      els.crearUsuarioTelefonoField.hidden = true;
    }
  }

  els.crearUsuarioPerfil.addEventListener('change', actualizarCamposSegunPerfil);

  function abrirCrearUsuarioModal() {
    els.crearUsuarioPerfil.value = 'cliente';
    els.crearUsuarioRfc.value = '';
    els.crearUsuarioEmail.value = '';
    els.crearUsuarioTelefono.value = '';
    els.crearUsuarioPassword.value = '';
    els.crearUsuarioPassword.type = 'password';
    els.btnToggleCrearUsuarioPassword.setAttribute('aria-pressed', 'false');
    els.btnToggleCrearUsuarioPassword.classList.remove('is-visible');
    els.btnCopiarCrearUsuarioPassword.hidden = true;
    els.crearUsuarioForzarCambio.checked = false;
    els.crearUsuarioErrorGeneral.textContent = '';
    setFieldError('crear-usuario-rfc', '');
    setFieldError('crear-usuario-email', '');
    setFieldError('crear-usuario-telefono', '');
    setFieldError('crear-usuario-password', '');
    document.querySelectorAll('#crear-usuario-reglas li').forEach((li) => li.classList.remove('is-cumplida'));
    actualizarCamposSegunPerfil();
    els.crearUsuarioOverlay.hidden = false;
    els.crearUsuarioRfc.focus();
  }

  function cerrarCrearUsuarioModal() {
    els.crearUsuarioOverlay.hidden = true;
  }

  els.btnCrearUsuario.addEventListener('click', abrirCrearUsuarioModal);
  els.btnCrearUsuarioCancelar.addEventListener('click', cerrarCrearUsuarioModal);
  els.btnCrearUsuarioCerrar.addEventListener('click', cerrarCrearUsuarioModal);
  els.crearUsuarioOverlay.addEventListener('click', (e) => {
    if (e.target === els.crearUsuarioOverlay) cerrarCrearUsuarioModal();
  });

  els.btnToggleCrearUsuarioPassword.addEventListener('click', () => {
    const mostrando = els.crearUsuarioPassword.type === 'password';
    els.crearUsuarioPassword.type = mostrando ? 'text' : 'password';
    els.btnToggleCrearUsuarioPassword.setAttribute('aria-pressed', String(mostrando));
    els.btnToggleCrearUsuarioPassword.classList.toggle('is-visible', mostrando);
  });

  els.crearUsuarioPassword.addEventListener('input', () => {
    actualizarReglasVisuales(els.crearUsuarioPassword.value, 'crear-usuario-reglas');
    els.btnCopiarCrearUsuarioPassword.hidden = true;
  });

  els.btnGenerarPasswordCrearUsuario.addEventListener('click', () => {
    const nueva = generarPasswordAleatoria();
    els.crearUsuarioPassword.value = nueva;
    els.crearUsuarioPassword.type = 'text';
    els.btnToggleCrearUsuarioPassword.setAttribute('aria-pressed', 'true');
    els.btnToggleCrearUsuarioPassword.classList.add('is-visible');
    actualizarReglasVisuales(nueva, 'crear-usuario-reglas');
    els.btnCopiarCrearUsuarioPassword.hidden = false;
    els.btnCopiarCrearUsuarioPassword.classList.remove('is-copiado');
    // Una contraseña generada automáticamente es temporal por definición.
    els.crearUsuarioForzarCambio.checked = true;
  });

  els.btnCopiarCrearUsuarioPassword.addEventListener('click', async () => {
    const valor = els.crearUsuarioPassword.value;
    if (!valor) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(valor);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = valor;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast('Contraseña copiada al portapapeles.');
      els.btnCopiarCrearUsuarioPassword.classList.add('is-copiado');
    } catch (err) {
      showToast('No se pudo copiar. Selecciona y copia el texto manualmente.', true);
    }
  });

  function setGuardandoCrearUsuarioLoading(cargando) {
    els.btnCrearUsuarioGuardar.disabled = cargando;
    els.btnCrearUsuarioGuardarLabel.textContent = cargando ? 'Creando…' : 'Crear usuario';
  }

  els.btnCrearUsuarioGuardar.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.crearUsuarioErrorGeneral.textContent = '';
    setFieldError('crear-usuario-rfc', '');
    setFieldError('crear-usuario-email', '');
    setFieldError('crear-usuario-telefono', '');
    setFieldError('crear-usuario-password', '');

    const perfil = els.crearUsuarioPerfil.value;
    const rfc = els.crearUsuarioRfc.value.trim();
    const email = els.crearUsuarioEmail.value.trim();
    const telefono = els.crearUsuarioTelefono.value.trim();
    const password = els.crearUsuarioPassword.value;
    const forzarCambio = els.crearUsuarioForzarCambio.checked;

    const rfcObligatorio = perfil !== 'cliente' || planPermite('facturacionHabilitada');
    let valido = true;
    if (rfcObligatorio && !rfc) {
      setFieldError('crear-usuario-rfc', perfil === 'cliente' ? 'El RFC es obligatorio.' : 'El nombre de usuario es obligatorio.');
      valido = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('crear-usuario-email', 'Ingresa un correo electrónico válido.');
      valido = false;
    }
    if (perfil === 'cliente' && !telefono) {
      setFieldError('crear-usuario-telefono', 'El teléfono es obligatorio.');
      valido = false;
    }
    const reglas = evaluarReglasPassword(password);
    if (!Object.values(reglas).every(Boolean)) {
      setFieldError('crear-usuario-password', 'La contraseña no cumple con los requisitos de arriba.');
      valido = false;
    }
    if (!valido) return;

    setGuardandoCrearUsuarioLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/usuarios`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil, rfc, email, telefono, password, forzar_cambio: forzarCambio }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.crearUsuarioErrorGeneral.textContent = data.error || 'No se pudo crear el usuario.';
        return;
      }
      showToast(`Usuario ${data.rfc} creado correctamente. Se envió una invitación a ${email}.`);
      cerrarCrearUsuarioModal();
      cargarUsuarios();
      // Primeros pasos (Fase 2 UX): "invita a tu primer usuario".
      guardarEstadoOnboarding({ usuarioCreado: true });
      renderOnboardingChecklist();
    } catch (err) {
      els.crearUsuarioErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setGuardandoCrearUsuarioLoading(false);
    }
  });

  // ---------- Editar usuario ----------

  let idUsuarioEnEdicion = null;

  function actualizarCamposSegunPerfilEditar() {
    const perfil = els.editarUsuarioPerfil.value;
    if (perfil === 'cliente') {
      // Punto en curso: mismo criterio que Crear usuario — sin
      // Facturación activa, el RFC no se edita (el backend conserva el
      // identificador que ya tenga, ver PUT /api/admin/usuarios/:id).
      els.editarUsuarioRfcField.hidden = !planPermite('facturacionHabilitada');
      els.editarUsuarioRfcLabel.textContent = 'RFC';
      els.editarUsuarioRfc.placeholder = 'XAXX010101000';
      els.editarUsuarioRfcHint.textContent = 'RFC del cliente, con el que inicia sesión en el portal.';
      els.editarUsuarioTelefonoField.hidden = false;
    } else {
      els.editarUsuarioRfcField.hidden = false;
      els.editarUsuarioRfcLabel.textContent = 'Nombre de usuario';
      els.editarUsuarioRfc.placeholder = 'ej. jperez';
      els.editarUsuarioRfcHint.textContent = 'No necesita ser un RFC real — es el nombre con el que inicia sesión en el panel de administración.';
      els.editarUsuarioTelefonoField.hidden = true;
    }
  }

  els.editarUsuarioPerfil.addEventListener('change', actualizarCamposSegunPerfilEditar);

  function abrirEditarUsuarioModal(usuario) {
    idUsuarioEnEdicion = usuario.id;
    els.editarUsuarioPerfil.value = usuario.perfil;
    els.editarUsuarioRfc.value = usuario.rfc;
    els.editarUsuarioEmail.value = usuario.email || '';
    els.editarUsuarioTelefono.value = usuario.telefono || '';
    els.editarUsuarioErrorGeneral.textContent = '';
    setFieldError('editar-usuario-rfc', '');
    setFieldError('editar-usuario-email', '');
    setFieldError('editar-usuario-telefono', '');
    actualizarCamposSegunPerfilEditar();
    els.editarUsuarioOverlay.hidden = false;
    els.editarUsuarioRfc.focus();
  }

  function cerrarEditarUsuarioModal() {
    els.editarUsuarioOverlay.hidden = true;
    idUsuarioEnEdicion = null;
  }

  els.btnEditarUsuarioCancelar.addEventListener('click', cerrarEditarUsuarioModal);
  els.editarUsuarioOverlay.addEventListener('click', (e) => {
    if (e.target === els.editarUsuarioOverlay) cerrarEditarUsuarioModal();
  });

  function setGuardandoEditarUsuarioLoading(isLoading) {
    els.btnEditarUsuarioGuardar.disabled = isLoading;
    els.btnEditarUsuarioGuardarLabel.textContent = isLoading ? 'Guardando…' : 'Guardar cambios';
  }

  els.btnEditarUsuarioGuardar.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    if (!idUsuarioEnEdicion) return;

    els.editarUsuarioErrorGeneral.textContent = '';
    setFieldError('editar-usuario-rfc', '');
    setFieldError('editar-usuario-email', '');
    setFieldError('editar-usuario-telefono', '');

    const perfil = els.editarUsuarioPerfil.value;
    const rfc = els.editarUsuarioRfc.value.trim();
    const email = els.editarUsuarioEmail.value.trim();
    const telefono = els.editarUsuarioTelefono.value.trim();

    const rfcObligatorio = perfil !== 'cliente' || planPermite('facturacionHabilitada');
    let valido = true;
    if (rfcObligatorio && !rfc) {
      setFieldError('editar-usuario-rfc', perfil === 'cliente' ? 'El RFC es obligatorio.' : 'El nombre de usuario es obligatorio.');
      valido = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('editar-usuario-email', 'Ingresa un correo electrónico válido.');
      valido = false;
    }
    if (perfil === 'cliente' && !telefono) {
      setFieldError('editar-usuario-telefono', 'El teléfono es obligatorio.');
      valido = false;
    }
    if (!valido) return;

    setGuardandoEditarUsuarioLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/usuarios/${idUsuarioEnEdicion}`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil, rfc, email, telefono }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.editarUsuarioErrorGeneral.textContent = data.error || 'No se pudo actualizar el usuario.';
        return;
      }
      showToast(`Usuario ${data.rfc} actualizado correctamente.`);
      cerrarEditarUsuarioModal();
      cargarUsuarios();
    } catch (err) {
      els.editarUsuarioErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setGuardandoEditarUsuarioLoading(false);
    }
  });

  // ---------- Tabla "Perfiles y roles de acceso" ----------

  els.btnPerfilesAccesoAbrir.addEventListener('click', () => {
    els.perfilesAccesoOverlay.hidden = false;
  });
  els.btnPerfilesAccesoCerrar.addEventListener('click', () => {
    els.perfilesAccesoOverlay.hidden = true;
  });
  els.perfilesAccesoOverlay.addEventListener('click', (e) => {
    if (e.target === els.perfilesAccesoOverlay) els.perfilesAccesoOverlay.hidden = true;
  });

  els.btnToggleOrdenesCard.addEventListener('click', () => {
    const abierto = els.btnToggleOrdenesCard.getAttribute('aria-expanded') === 'true';
    els.btnToggleOrdenesCard.setAttribute('aria-expanded', String(!abierto));
    els.ordenesToggleBody.hidden = abierto;
  });

  // ---------- Modal de restablecer contraseña ----------

  let usuarioActual = null;

  function abrirPasswordModal(usuario) {
    usuarioActual = usuario;
    els.passwordModalRfc.textContent = `RFC: ${usuario.rfc}`;
    els.passwordModalNueva.value = '';
    els.passwordModalNueva.type = 'password';
    els.btnTogglePasswordModal.setAttribute('aria-pressed', 'false');
    els.btnTogglePasswordModal.classList.remove('is-visible');
    els.btnCopiarPassword.hidden = true;
    els.btnCopiarPassword.classList.remove('is-copiado');
    els.passwordModalForzarCambio.checked = false;
    els.passwordModalError.textContent = '';
    document.querySelectorAll('#password-modal-reglas li').forEach((li) => li.classList.remove('is-cumplida'));
    els.passwordModalOverlay.hidden = false;
    els.passwordModalNueva.focus();
  }

  function cerrarPasswordModal() {
    els.passwordModalOverlay.hidden = true;
    usuarioActual = null;
  }

  els.btnPasswordModalCancelar.addEventListener('click', cerrarPasswordModal);
  els.passwordModalOverlay.addEventListener('click', (e) => {
    if (e.target === els.passwordModalOverlay) cerrarPasswordModal();
  });

  els.btnTogglePasswordModal.addEventListener('click', () => {
    const mostrando = els.passwordModalNueva.type === 'password';
    els.passwordModalNueva.type = mostrando ? 'text' : 'password';
    els.btnTogglePasswordModal.setAttribute('aria-pressed', String(mostrando));
    els.btnTogglePasswordModal.classList.toggle('is-visible', mostrando);
  });

  function evaluarReglasPassword(password) {
    return {
      longitud: password.length >= 8,
      numero: /[0-9]/.test(password),
      minuscula: /[a-z]/.test(password),
      mayuscula: /[A-Z]/.test(password),
    };
  }

  function actualizarReglasVisuales(password, contenedorId = 'password-modal-reglas') {
    const reglas = evaluarReglasPassword(password);
    Object.entries(reglas).forEach(([clave, cumple]) => {
      const li = document.querySelector(`#${contenedorId} [data-regla="${clave}"]`);
      if (li) li.classList.toggle('is-cumplida', cumple);
    });
    return reglas;
  }

  els.passwordModalNueva.addEventListener('input', () => {
    actualizarReglasVisuales(els.passwordModalNueva.value);
    // Si el administrador edita manualmente el campo, ya no es la
    // contraseña generada automáticamente que se acaba de copiar.
    els.btnCopiarPassword.hidden = true;
  });

  // Genera una contraseña que siempre cumple las 4 reglas (longitud,
  // número, minúscula, mayúscula), evitando caracteres fácilmente
  // confundibles entre sí (0/O, 1/l/I) para que sea más fácil de transcribir
  // a mano si hace falta. Usa crypto.getRandomValues para aleatoriedad de
  // calidad criptográfica.
  function generarPasswordAleatoria(longitud = 12) {
    const minusculas = 'abcdefghjkmnpqrstuvwxyz';
    const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numeros = '23456789';
    const todos = minusculas + mayusculas + numeros;

    function caracterAleatorio(charset) {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return charset[arr[0] % charset.length];
    }

    const caracteres = [
      caracterAleatorio(minusculas),
      caracterAleatorio(mayusculas),
      caracterAleatorio(numeros),
    ];
    for (let i = caracteres.length; i < longitud; i += 1) {
      caracteres.push(caracterAleatorio(todos));
    }
    // Baraja el orden (Fisher-Yates) para que los primeros 3 caracteres no
    // sigan siempre el mismo patrón "minúscula, mayúscula, número".
    for (let i = caracteres.length - 1; i > 0; i -= 1) {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      const j = arr[0] % (i + 1);
      [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
    }
    return caracteres.join('');
  }

  els.btnGenerarPassword.addEventListener('click', () => {
    const nueva = generarPasswordAleatoria();
    els.passwordModalNueva.value = nueva;
    els.passwordModalNueva.type = 'text'; // se muestra en claro para poder verificarla/copiarla
    els.btnTogglePasswordModal.setAttribute('aria-pressed', 'true');
    els.btnTogglePasswordModal.classList.add('is-visible');
    actualizarReglasVisuales(nueva);
    els.btnCopiarPassword.hidden = false;
    els.btnCopiarPassword.classList.remove('is-copiado');
    // Una contraseña generada automáticamente es, por definición, temporal:
    // se marca "forzar cambio" por defecto (el administrador puede
    // desmarcarla si de verdad no lo necesita).
    els.passwordModalForzarCambio.checked = true;
  });

  els.btnCopiarPassword.addEventListener('click', async () => {
    const valor = els.passwordModalNueva.value;
    if (!valor) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(valor);
      } else {
        // Respaldo para navegadores/contextos sin Clipboard API (ej. HTTP
        // sin TLS): un textarea temporal + el comando de copiar clásico.
        const textarea = document.createElement('textarea');
        textarea.value = valor;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast('Contraseña copiada al portapapeles.');
      els.btnCopiarPassword.classList.add('is-copiado');
    } catch (err) {
      showToast('No se pudo copiar. Selecciona y copia el texto manualmente.', true);
    }
  });

  function setGuardandoPasswordLoading(cargando) {
    els.btnPasswordModalGuardar.disabled = cargando;
    els.btnPasswordModalGuardarLabel.textContent = cargando ? 'Guardando…' : 'Guardar';
  }

  els.btnPasswordModalGuardar.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader || !usuarioActual) return;

    const password = els.passwordModalNueva.value;
    const reglas = evaluarReglasPassword(password);
    if (!Object.values(reglas).every(Boolean)) {
      els.passwordModalError.textContent = 'La contraseña no cumple con los requisitos de arriba.';
      return;
    }
    els.passwordModalError.textContent = '';

    setGuardandoPasswordLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/usuarios/${usuarioActual.id}/password`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, forzar_cambio: els.passwordModalForzarCambio.checked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.passwordModalError.textContent = data.error || 'No se pudo actualizar la contraseña.';
        return;
      }
      showToast(`Contraseña de ${usuarioActual.rfc} actualizada.`);
      cerrarPasswordModal();
      cargarUsuarios();
    } catch (err) {
      els.passwordModalError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setGuardandoPasswordLoading(false);
    }
  });

  // ---------- Gastos ----------

  // Gastos de la vista actual (activos o papelera) tal como los devolvió
  // el servidor — se conservan para abrir el modal de detalle sin volver
  // a pedirlos.
  let gastosActuales = [];
  // Gasto en edición dentro de #gastos-modal-overlay; null = alta nueva.
  let gastoModalEditando = null;
  // Gasto mostrado en #gastos-detalle-modal-overlay.
  let gastoDetalleActual = null;
  // Valor actual del toggle "Con factura / Sin factura" del modal.
  let gastoModalConFactura = true;
  // Límite de subida del comprobante en el cliente — el servidor impone
  // el definitivo (MAX_FILE_SIZE_MB en server.js, 5 MB por defecto) y
  // devuelve su propio error si se excede; aquí solo se evita subir un
  // archivo enorme que de todos modos sería rechazado.
  const MAX_COMPROBANTE_MB = 5;

  // La fecha de un gasto es solo "YYYY-MM-DD" (columna DATE), así que no
  // pasa por formatFecha() (que espera un DATETIME) — se formatea aquí.
  function formatoFechaGasto(fecha) {
    if (!fecha) return '—';
    const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(fecha);
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  // Fecha de hoy en "YYYY-MM-DD" (lo que espera un <input type="date">).
  function hoyParaGasto() {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  function etiquetaCategoriaGasto(slug) {
    const cat = state.categoriasGastos.find((c) => c.slug === slug);
    return (cat && cat.etiqueta) || slug || '—';
  }

  // Llena el filtro de categoría de la tabla con TODAS las categorías
  // (activas e inactivas — un gasto viejo puede seguir usando una ya
  // desactivada y el filtro debe poder encontrarlo), sin pisar la
  // selección que el usuario ya tenga hecha.
  function llenarSelectsCategoriaGasto() {
    const opciones = state.categoriasGastos
      .map((c) => `<option value="${c.slug}">${escapeHtml(c.etiqueta)}${c.activa ? '' : ' (inactiva)'}</option>`)
      .join('');
    const seleccionFiltro = els.gastosFiltroCategoria.value;
    els.gastosFiltroCategoria.innerHTML = `<option value="">Todas</option>${opciones}`;
    els.gastosFiltroCategoria.value = seleccionFiltro;
  }

  // El <select> de ALTA del modal solo ofrece categorías activas — salvo
  // que se esté editando un gasto cuya categoría ya se desactivó, en cuyo
  // caso se agrega igual para no perder/cambiar el valor guardado.
  function poblarSelectModalCategoria(categoriaActual) {
    const lista = state.categoriasGastos.filter((c) => c.activa || c.slug === categoriaActual);
    els.gastosModalCategoria.innerHTML = lista
      .map((c) => `<option value="${c.slug}">${escapeHtml(c.etiqueta)}${c.activa ? '' : ' (inactiva)'}</option>`)
      .join('');
  }

  // Punto 158 — Periodos archivados (Ventas+Gastos). Pobla los <select>
  // de periodo en ambas vistas con los YYYY-MM distintos que ya tienen
  // al menos una fila archivada. Mes actual = sin periodo.
  function formatearPeriodoEtiqueta(periodo) {
    const [y, m] = periodo.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const idx = Number(m) - 1;
    return idx >= 0 && idx < 12 ? `${meses[idx]} ${y}` : periodo;
  }
  async function cargarPeriodosArchivados() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/periodos-archivados`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();
      const periodos = data.periodos || [];
      const selV = els.ordenesFiltroPeriodo ? els.ordenesFiltroPeriodo.value : '';
      const selG = els.gastosFiltroPeriodo ? els.gastosFiltroPeriodo.value : '';
      const opciones = periodos.map((p) => `<option value="${p}">${formatearPeriodoEtiqueta(p)}</option>`).join('');
      if (els.ordenesFiltroPeriodo) {
        els.ordenesFiltroPeriodo.innerHTML = `<option value="">Mes actual</option>${opciones}`;
        els.ordenesFiltroPeriodo.value = selV;
      }
      if (els.gastosFiltroPeriodo) {
        els.gastosFiltroPeriodo.innerHTML = `<option value="">Mes actual</option>${opciones}`;
        els.gastosFiltroPeriodo.value = selG;
      }
    } catch (err) {
      // Silencioso: si falla, el usuario sigue viendo Mes actual.
    }
  }

  async function cargarCategoriasGastos() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/gastos/categorias`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.categorias)) {
        state.categoriasGastos = data.categorias;
        llenarSelectsCategoriaGasto();
        poblarSelectModalCategoria(gastoModalEditando ? gastoModalEditando.categoria : null);
        renderPanelCategoriasGastos();
      }
    } catch (err) {
      // Silencioso: los selects se quedan con la última lista cargada.
    }
  }

  function filaCategoriaGastoPanel(c) {
    if (c.protegida) {
      return `<div class="gastos-categoria-fila gastos-categoria-fila-protegida" data-id="${c.id}">
        <span class="gastos-categoria-nombre">${escapeHtml(c.etiqueta)}</span>
        <span class="gastos-categoria-tag">Protegida</span>
      </div>`;
    }
    if (categoriaGastoEditandoId === c.id) {
      return `<div class="gastos-categoria-fila" data-id="${c.id}">
        <input type="text" class="gastos-categoria-input-editar" value="${escapeHtml(c.etiqueta)}" maxlength="100" />
        <button type="button" class="btn-categoria-accion btn-categoria-guardar" data-id="${c.id}">Guardar</button>
        <button type="button" class="btn-categoria-accion gastos-categoria-cancelar">Cancelar</button>
      </div>`;
    }
    return `<div class="gastos-categoria-fila" data-id="${c.id}">
      <span class="gastos-categoria-nombre">${escapeHtml(c.etiqueta)}${c.activa ? '' : ' <em>(inactiva)</em>'}</span>
      <select class="gastos-categoria-tipo" data-id="${c.id}" aria-label="Tipo de gasto de ${escapeHtml(c.etiqueta)}" data-tooltip="Fijo/variable — usado en Resumen financiero (KPI \'Gastos Variables/Flexibles\')">
        <option value="fijo" ${c.tipo === 'fijo' ? 'selected' : ''}>Fijo</option>
        <option value="variable" ${c.tipo === 'variable' ? 'selected' : ''}>Variable</option>
      </select>
      ${c.activa ? '' : `<button type="button" class="btn-categoria-accion gastos-categoria-reactivar" data-id="${c.id}">Reactivar</button>`}
      <button type="button" class="btn-icono-accion gastos-categoria-renombrar" data-id="${c.id}" data-tooltip="Renombrar ${escapeHtml(c.etiqueta)}" aria-label="Renombrar ${escapeHtml(c.etiqueta)}">${ICONO_EDITAR}</button>
      ${c.tieneGastos ? '' : `<button type="button" class="btn-icono-accion btn-icono-accion-peligro gastos-categoria-borrar" data-id="${c.id}" data-tooltip="Eliminar ${escapeHtml(c.etiqueta)}" aria-label="Eliminar ${escapeHtml(c.etiqueta)}">${ICONO_PAPELERA}</button>`}
    </div>`;
  }

  function renderPanelCategoriasGastos() {
    if (!els.gastosCategoriasLista) return;
    els.gastosCategoriasLista.innerHTML = state.categoriasGastos.map(filaCategoriaGastoPanel).join('')
      || '<p class="field-hint">Sin categorías.</p>';
  }

  function toggleCategoriasPanel() {
    const abierto = els.gastosCategoriasPanel.hidden;
    els.gastosCategoriasPanel.hidden = !abierto;
    els.gastosModalCategoriaField.classList.toggle('is-categorias-abierto', abierto);
    els.btnGastosCategoriasToggle.setAttribute('aria-expanded', String(abierto));
    categoriaGastoEditandoId = null;
    if (abierto) renderPanelCategoriasGastos();
  }

  async function renombrarCategoriaGastoPanel(id, etiqueta) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/gastos/categorias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ etiqueta }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo renombrar la categoría.', true);
        return;
      }
      categoriaGastoEditandoId = null;
      await cargarCategoriasGastos();
      cargarGastos();
      showToast(data.mensaje || 'Categoría actualizada.');
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  async function reactivarCategoriaGastoPanel(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/gastos/categorias/${id}/reactivar`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo reactivar la categoría.', true);
        return;
      }
      await cargarCategoriasGastos();
      showToast(data.mensaje || 'Categoría reactivada.');
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  async function actualizarTipoCategoriaGastoPanel(id, tipo) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/gastos/categorias/${id}/tipo`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo actualizar el tipo.', true);
        await cargarCategoriasGastos();
        return;
      }
      await cargarCategoriasGastos();
      showToast('Tipo actualizado.');
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  async function eliminarCategoriaGastoPanel(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/gastos/categorias/${id}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo eliminar la categoría.', true);
        return;
      }
      await cargarCategoriasGastos();
      showToast(data.mensaje || 'Categoría eliminada.');
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  async function agregarCategoriaGastoPanel() {
    const etiqueta = els.gastosCategoriaNuevaInput.value.trim();
    els.errorGastosCategoriaNueva.textContent = '';
    if (!etiqueta) {
      els.errorGastosCategoriaNueva.textContent = 'El nombre de la categoría es obligatorio.';
      return;
    }
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/gastos/categorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ etiqueta }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        els.errorGastosCategoriaNueva.textContent = data.error || 'No se pudo crear la categoría.';
        return;
      }
      els.gastosCategoriaNuevaInput.value = '';
      await cargarCategoriasGastos();
      showToast('Categoría creada.');
    } catch (err) {
      els.errorGastosCategoriaNueva.textContent = 'No se pudo conectar con el servidor.';
    }
  }

  function confirmarEliminarCategoriaGasto(id, nombre) {
    abrirConfirmacion({
      titulo: 'Eliminar categoría',
      mensaje: `¿Eliminar la categoría "${nombre}"? Esta acción no se puede deshacer.`,
      textoBoton: 'Eliminar',
      onConfirmar: () => eliminarCategoriaGastoPanel(id),
    });
  }

  // ---------- Vista Resumen financiero ----------

  function aplicarTendenciaMoneda(elemento, porcentaje) {
    elemento.classList.remove('es-positiva', 'es-negativa');
    if (porcentaje === null || porcentaje === undefined) {
      elemento.textContent = 'Sin datos del mes anterior';
      return;
    }
    elemento.textContent = `${porcentaje > 0 ? '+' : ''}${porcentaje}% vs mes anterior`;
    if (porcentaje > 0) elemento.classList.add('es-positiva');
    if (porcentaje < 0) elemento.classList.add('es-negativa');
  }

  // ---------- Modo dashboard del Resumen financiero (punto 119) ----------
  //
  // Permite reordenar y redimensionar las tarjetas de la vista y guarda
  // el layout POR USUARIO en el servidor (preferencias_dashboard vía
  // GET/PUT/DELETE /api/admin/preferencias-dashboard/resumen-financiero),
  // para restaurarse en cada ingreso. Decisiones clave:
  //  - El arrastre NUNCA mueve nodos del DOM: solo cambia style.order y
  //    style.gridColumn de los hijos del tablero. Mover nodos rompería
  //    abrirDetalleGrafica(), que devuelve cada contenido a su padre
  //    original al cerrar el modal.
  //  - El movimiento visual durante el arrastre usa transform (compositor)
  //    con transiciones desactivadas en la tarjeta arrastrada.
  //  - Accesibilidad: cada tarjeta es enfocable con el modo activo y se
  //    puede reordenar/redimensionar solo con teclado (↑/↓ posición,
  //    ←/→ ancho, Esc sale) — mismo resultado que el puntero.
  // Orden por defecto (punto 262, 2026-09-09): reemplaza al orden
  // original de fábrica por el acomodo que el usuario ya tenía armado a
  // mano — pedido explícito ("que sea la de por defecto cuando se de
  // restablecer"). El ORDEN de este arreglo es el orden visual real
  // (coincide con el orden real del DOM en admin.html, que es lo que
  // aplicarLayoutDashboard() usa cuando no hay layout guardado). Los
  // altos NO se congelan aquí a propósito — ver
  // igualarAlturaFilasDashboard() más abajo (punto 1 del mismo pedido):
  // con eso, las filas se auto-igualan solas sin depender de píxeles
  // guardados que dejarían de ser válidos en cuanto cambie el contenido.
  const DASHBOARD_TARJETAS = [
    { id: 'kpi-facturado', titulo: 'Total facturado' },
    { id: 'kpi-sin-facturar', titulo: 'Ventas sin facturar' },
    { id: 'kpi-balance', titulo: 'Balance ventas vs gastos' },
    { id: 'kpi-gastos', titulo: 'Total gastos' },
    { id: 'balance-acumulado', titulo: 'Utilidad neta mensual' },
    { id: 'proyeccion', titulo: 'Proyección de ventas' },
    { id: 'facturacion', titulo: 'Ventas facturadas vs sin facturar' },
    { id: 'cobranza', titulo: 'Cobranza del mes' },
    { id: 'proveedores', titulo: 'Top proveedores de gasto' },
    { id: 'ventas-facturado-gastos', titulo: 'Ventas vs Facturado vs Gastos' },
    { id: 'utilidad', titulo: 'Utilidad neta del mes' },
    { id: 'gastos-categoria', titulo: 'Distribución de gastos por categoría' },
  ];
  const DASHBOARD_SPAN_MIN = 3;
  const DASHBOARD_SPAN_MAX = 12;
  // Resize vertical (pedido junto al de ancho ya existente) — mismos
  // límites que valida el backend (VISTAS_DASHBOARD.heightMin/heightMax).
  // Sin altura guardada = alto automático (comportamiento de siempre).
  const DASHBOARD_HEIGHT_MIN = 160;
  const DASHBOARD_HEIGHT_MAX = 900;
  const DASHBOARD_HEIGHT_PASO_TECLADO = 24;
  const DASHBOARD_SPANS_DEFECTO = {
    'kpi-facturado': 3,
    'kpi-gastos': 3,
    'kpi-balance': 3,
    'kpi-sin-facturar': 3,
    'balance-acumulado': 6,
    proyeccion: 6,
    facturacion: 4,
    cobranza: 4,
    proveedores: 4,
    'ventas-facturado-gastos': 12,
    utilidad: 6,
    'gastos-categoria': 6,
  };
  const DASHBOARD_VISTA = 'resumen-financiero';
  const DASHBOARD_GUARDADO_DEBOUNCE_MS = 800;

  let dashboardModoActivo = false;
  let dashboardLayout = null; // null = layout por defecto; [{id, span}] = personalizado
  let dashboardGuardadoTimer = null;

  function obtenerTarjetasDashboard() {
    return Array.from(els.resumenFinTablero.querySelectorAll('[data-dashboard-id]')).sort(
      (a, b) => Number(getComputedStyle(a).order) - Number(getComputedStyle(b).order)
    );
  }

  // Alto libre en px — con altura explícita se recorta lo que no quepa
  // (overflow:hidden, no scroll interno): el handle ◢ vive como hijo
  // directo de la tarjeta (position:absolute) y con scroll quedaría
  // atrapado dentro del área que se desplaza, imposible de recuperar
  // agrandando de nuevo. Recortar es menos vistoso pero deja el handle
  // siempre alcanzable.
  function aplicarAlturaTarjeta(tarjeta, alturaPx) {
    if (alturaPx) {
      tarjeta.style.height = `${alturaPx}px`;
      tarjeta.style.overflow = 'hidden';
    } else {
      tarjeta.style.height = '';
      tarjeta.style.overflow = '';
    }
  }

  function aplicarLayoutDashboard() {
    const tarjetas = obtenerTarjetasDashboard();
    if (!dashboardLayout) {
      tarjetas.forEach((t) => {
        t.style.order = '';
        t.style.gridColumn = '';
        aplicarAlturaTarjeta(t, null);
      });
      return;
    }
    // Bug real reportado por el usuario (capturas de celular, todo
    // encimado): un ancho/alto guardado en escritorio se aplicaba aquí
    // como estilo EN LÍNEA sin importar el viewport — un estilo en línea
    // le gana a cualquier regla de @media de la hoja de estilos (el
    // `@media (max-width:900px){ grid-column: span 12 }` de admin.css
    // nunca tenía oportunidad de aplicarse). El ORDEN sí se conserva en
    // móvil (mismo criterio ya documentado en el comentario del punto
    // 911 de admin.css); ancho/alto personalizados solo aplican ≥900px.
    const esMovil = window.innerWidth <= 900;
    const itemsPorId = new Map(dashboardLayout.map((item) => [item.id, item]));
    tarjetas.forEach((t, indice) => {
      t.style.order = String(indice);
      if (esMovil) {
        t.style.gridColumn = '';
        aplicarAlturaTarjeta(t, null);
        return;
      }
      const item = itemsPorId.get(t.dataset.dashboardId);
      if (item && item.span) t.style.gridColumn = `span ${item.span}`;
      aplicarAlturaTarjeta(t, item && item.height ? item.height : null);
    });
  }

  // Ancho actual de una tarjeta (span de 12), mismo cálculo que ya usan
  // guardarPreferenciasDashboard()/iniciarRedimensionDashboard() —
  // extraído aquí para no repetirlo una 4ta vez.
  function obtenerSpanActualTarjeta(t) {
    return (
      parseInt((t.style.gridColumn || '').replace('span ', ''), 10) ||
      DASHBOARD_SPANS_DEFECTO[t.dataset.dashboardId] ||
      12
    );
  }

  // Iguala el alto de las tarjetas que comparten fila (punto 262,
  // 2026-09-09 — "no me deja alinearlas, busca que siempre queden
  // alineadas"): hoy cada tarjeta guarda SU PROPIO alto (explícito o
  // natural) sin relación con sus vecinas — si una tiene más contenido
  // que otra, la fila se ve despareja aunque los anchos sean idénticos.
  // Agrupa las tarjetas por fila simulando el auto-wrap de CSS Grid (suma
  // de span en el orden VISUAL, nueva fila en cuanto se pasaría de 12) y
  // sube las más bajas de cada fila al alto de la más alta vía
  // `min-height` — nunca recorta la más alta ni toca su `height`
  // explícito (el resize manual de una tarjeta se respeta tal cual,
  // sigue pudiendo dejarla más corta que su contenido si el usuario así
  // lo quiere; solo sus VECINAS se levantan para emparejar). Por debajo
  // del breakpoint de 900px todo es una sola columna (sin filas que
  // igualar). Se llama al cargar datos, al terminar cualquier arrastre/
  // atajo de teclado del Modo dashboard, y al cambiar el tamaño de la
  // ventana (debounced) — nunca se persiste el resultado, se recalcula
  // solo con el contenido real de cada momento.
  function igualarAlturaFilasDashboard() {
    if (!els.resumenFinTablero) return;
    const tarjetas = obtenerTarjetasDashboard();
    tarjetas.forEach((t) => {
      t.style.minHeight = '';
    });
    if (tarjetas.length === 0 || window.innerWidth <= 900) return;

    const filas = [];
    let filaActual = [];
    let acumulado = 0;
    tarjetas.forEach((t) => {
      const span = obtenerSpanActualTarjeta(t);
      if (acumulado + span > 12 && filaActual.length > 0) {
        filas.push(filaActual);
        filaActual = [];
        acumulado = 0;
      }
      filaActual.push(t);
      acumulado += span;
    });
    if (filaActual.length > 0) filas.push(filaActual);

    filas.forEach((fila) => {
      // `scrollHeight` (no `getBoundingClientRect().height`): mide el alto
      // que el CONTENIDO real necesita, sin importar si ahora mismo está
      // recortado por un `height` explícito + overflow:hidden de un resize
      // manual viejo. Sin esto, una tarjeta con un alto guardado demasiado
      // chico (de antes de que se le agregaran avisos/banners nuevos)
      // nunca entraba en el cálculo del máximo con su tamaño REAL — el
      // recorte pasaba inadvertido en vez de corregirse. Se aplica también
      // a una tarjeta sola en su fila (sin vecinas) para que nunca se
      // esconda información propia por un resize viejo.
      const maxAltura = Math.max(...fila.map((t) => t.scrollHeight));
      fila.forEach((t) => {
        t.style.minHeight = `${Math.ceil(maxAltura)}px`;
      });
    });
  }
  let igualarAlturaFilasTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(igualarAlturaFilasTimer);
    igualarAlturaFilasTimer = setTimeout(() => {
      // Recalcula también ancho/alto del layout guardado — cruzar el
      // breakpoint de 900px (rotar el celular, achicar la ventana) debe
      // limpiar/restaurar el estilo en línea de inmediato, no solo el
      // día que se recargue la página.
      aplicarLayoutDashboard();
      igualarAlturaFilasDashboard();
    }, 200);
  });

  function sincronizarBotonRestablecerDashboard() {
    els.btnRestablecerDashboard.hidden = !dashboardLayout;
  }

  async function cargarPreferenciasDashboard() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/preferencias-dashboard/${DASHBOARD_VISTA}`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) return; // sin preferencia o fallo no bloqueante: layout por defecto
      const data = await res.json();
      if (Array.isArray(data.layout) && data.layout.length > 0) {
        dashboardLayout = data.layout;
        aplicarLayoutDashboard();
        sincronizarBotonRestablecerDashboard();
        // Esta carga (fetch de preferencias) y cargarResumenFinanciero()
        // arrancan por separado sin orden garantizado — si esta termina
        // DESPUÉS de que el contenido ya se pintó y el corrector de filas
        // ya corrió, aplicarLayoutDashboard() reintroduce los altos
        // explícitos guardados (potencialmente demasiado chicos para el
        // contenido actual) sin que nadie los vuelva a corregir. Se repite
        // aquí también — es idempotente, no pasa nada por llamarla dos
        // veces.
        requestAnimationFrame(igualarAlturaFilasDashboard);
      }
    } catch (err) {
      // Fallo de red: la vista funciona igual con el layout por defecto.
    }
  }

  function guardarPreferenciasDashboard() {
    clearTimeout(dashboardGuardadoTimer);
    dashboardGuardadoTimer = setTimeout(async () => {
      const authHeader = getAuthHeader();
      if (!authHeader) return;
      const layout = obtenerTarjetasDashboard().map((t) => {
        const item = {
          id: t.dataset.dashboardId,
          span: parseInt(t.style.gridColumn.replace('span ', ''), 10) || DASHBOARD_SPANS_DEFECTO[t.dataset.dashboardId] || 12,
        };
        const altura = parseInt(t.style.height, 10);
        if (Number.isFinite(altura)) item.height = altura;
        return item;
      });
      try {
        const res = await fetch(`${API_BASE}/admin/preferencias-dashboard/${DASHBOARD_VISTA}`, {
          method: 'PUT',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout }),
        });
        if (res.status === 401) {
          clearSession();
          showLogin();
          return;
        }
        if (!res.ok) {
          showToast('No se pudo guardar el layout.', true);
          return;
        }
        dashboardLayout = layout;
        sincronizarBotonRestablecerDashboard();
        showToast('Layout guardado.');
      } catch (err) {
        showToast('No se pudo guardar el layout.', true);
      }
    }, DASHBOARD_GUARDADO_DEBOUNCE_MS);
  }

  async function restablecerDashboard() {
    clearTimeout(dashboardGuardadoTimer);
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/preferencias-dashboard/${DASHBOARD_VISTA}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast('No se pudo restablecer el layout.', true);
        return;
      }
      dashboardLayout = null;
      aplicarLayoutDashboard();
      sincronizarBotonRestablecerDashboard();
      requestAnimationFrame(igualarAlturaFilasDashboard);
      showToast('Layout restablecido.');
    } catch (err) {
      showToast('No se pudo restablecer el layout.', true);
    }
  }

  function crearHandleMover(tarjeta, titulo) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'dashboard-handle-mover';
    boton.setAttribute('aria-label', `Mover tarjeta: ${titulo}`);
    boton.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.7"/><circle cx="15" cy="5" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="19" r="1.7"/><circle cx="15" cy="19" r="1.7"/></svg>';
    boton.addEventListener('pointerdown', (e) => iniciarArrastreDashboard(e, tarjeta));
    return boton;
  }

  function crearHandleRedimensionar(tarjeta, titulo) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'dashboard-handle-redimensionar';
    boton.setAttribute('aria-label', `Cambiar tamaño de tarjeta: ${titulo} — arrastra en diagonal, o con la tarjeta enfocada: flechas izquierda/derecha para ancho, Mayús+arriba/abajo para alto`);
    boton.tabIndex = -1;
    boton.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M20 4v16H4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/></svg>';
    boton.addEventListener('pointerdown', (e) => iniciarRedimensionDashboard(e, tarjeta));
    return boton;
  }

  function activarModoDashboard() {
    if (dashboardModoActivo) return;
    dashboardModoActivo = true;
    els.resumenFinTablero.classList.add('dashboard-activo');
    els.btnModoDashboard.setAttribute('aria-pressed', 'true');
    els.btnModoDashboard.textContent = 'Salir del modo dashboard';
    els.resumenFinDashboardAyuda.hidden = false;
    sincronizarBotonRestablecerDashboard();
    const titulosPorId = new Map(DASHBOARD_TARJETAS.map((t) => [t.id, t.titulo]));
    obtenerTarjetasDashboard().forEach((tarjeta) => {
      const titulo = titulosPorId.get(tarjeta.dataset.dashboardId) || 'tarjeta';
      tarjeta.tabIndex = 0;
      tarjeta.addEventListener('keydown', manejadorTecladoDashboard);
      const header =
        tarjeta.querySelector('.resumen-fin-card-header') || tarjeta.querySelector('.inicio-stat-header');
      if (header) {
        const expandir = header.querySelector('.resumen-fin-expandir-btn');
        const mover = crearHandleMover(tarjeta, titulo);
        if (expandir) header.insertBefore(mover, expandir);
        else header.appendChild(mover);
      }
      tarjeta.appendChild(crearHandleRedimensionar(tarjeta, titulo));
    });
  }

  function desactivarModoDashboard() {
    if (!dashboardModoActivo) return;
    dashboardModoActivo = false;
    els.resumenFinTablero.classList.remove('dashboard-activo');
    els.btnModoDashboard.setAttribute('aria-pressed', 'false');
    els.btnModoDashboard.textContent = 'Modo dashboard';
    els.resumenFinDashboardAyuda.hidden = true;
    els.btnRestablecerDashboard.hidden = true;
    obtenerTarjetasDashboard().forEach((tarjeta) => {
      tarjeta.tabIndex = -1;
      tarjeta.removeEventListener('keydown', manejadorTecladoDashboard);
      tarjeta.style.transform = '';
      tarjeta.querySelectorAll('.dashboard-handle-mover, .dashboard-handle-redimensionar').forEach((h) => h.remove());
    });
  }

  function alternarModoDashboard() {
    if (dashboardModoActivo) desactivarModoDashboard();
    else activarModoDashboard();
  }

  // Reordena en vivo: cuenta cuántas tarjetas están "antes" del puntero
  // (por centro vertical, o por centro horizontal dentro de la misma fila)
  // y mueve la tarjeta arrastrada a ese índice. Solo cambian valores de
  // style.order — ningún nodo se mueve del DOM.
  function reordenarDuranteArrastre(tarjetaArrastrada, punto) {
    const tarjetas = obtenerTarjetasDashboard();
    const otras = tarjetas.filter((t) => t !== tarjetaArrastrada);
    let indice = 0;
    for (const otra of otras) {
      const r = otra.getBoundingClientRect();
      const centroY = r.top + r.height / 2;
      const centroX = r.left + r.width / 2;
      if (centroY < punto.y || (Math.abs(punto.y - centroY) <= r.height / 2 && centroX < punto.x)) {
        indice += 1;
      }
    }
    const nuevoOrden = [...otras.slice(0, indice), tarjetaArrastrada, ...otras.slice(indice)];
    nuevoOrden.forEach((t, i) => {
      t.style.order = String(i);
    });
  }

  function iniciarArrastreDashboard(evento, tarjeta) {
    evento.preventDefault();
    const handle = evento.currentTarget;
    handle.setPointerCapture(evento.pointerId);
    const rectInicial = tarjeta.getBoundingClientRect();
    const offsetDentro = { x: evento.clientX - rectInicial.left, y: evento.clientY - rectInicial.top };
    tarjeta.classList.add('tarjeta-arrastrando');
    let ordenInicial = Number(getComputedStyle(tarjeta).order);
    let transformVigente = { x: 0, y: 0 };
    let cuadroPendiente = false;
    let ultimoPunto = { x: evento.clientX, y: evento.clientY };

    const alMover = (e) => {
      ultimoPunto = { x: e.clientX, y: e.clientY };
      if (cuadroPendiente) return;
      cuadroPendiente = true;
      requestAnimationFrame(() => {
        cuadroPendiente = false;
        // La posición ESTÁTICA de la tarjeta cambia cuando el reorden
        // mueve su slot en la cuadrícula; para que siga pegada al puntero
        // sin saltos, el nuevo transform se calcula contra esa posición
        // estática (rect actual − transform ya aplicado).
        const r = tarjeta.getBoundingClientRect();
        const estaticaX = r.left - transformVigente.x;
        const estaticaY = r.top - transformVigente.y;
        transformVigente = {
          x: ultimoPunto.x - offsetDentro.x - estaticaX,
          y: ultimoPunto.y - offsetDentro.y - estaticaY,
        };
        tarjeta.style.transform = `translate(${transformVigente.x}px, ${transformVigente.y}px)`;
        reordenarDuranteArrastre(tarjeta, ultimoPunto);
      });
    };
    const alTerminar = () => {
      handle.removeEventListener('pointermove', alMover);
      handle.removeEventListener('pointerup', alTerminar);
      handle.removeEventListener('pointercancel', alTerminar);
      tarjeta.classList.remove('tarjeta-arrastrando');
      tarjeta.style.transform = '';
      const ordenFinal = Number(getComputedStyle(tarjeta).order);
      if (ordenFinal !== ordenInicial) {
        igualarAlturaFilasDashboard();
        guardarPreferenciasDashboard();
      }
    };
    handle.addEventListener('pointermove', alMover);
    handle.addEventListener('pointerup', alTerminar);
    handle.addEventListener('pointercancel', alTerminar);
  }

  function iniciarRedimensionDashboard(evento, tarjeta) {
    evento.preventDefault();
    const handle = evento.currentTarget;
    handle.setPointerCapture(evento.pointerId);
    const xInicial = evento.clientX;
    const yInicial = evento.clientY;
    const spanInicial =
      parseInt((tarjeta.style.gridColumn || '').replace('span ', ''), 10) ||
      DASHBOARD_SPANS_DEFECTO[tarjeta.dataset.dashboardId] ||
      12;
    // Alto inicial: el explícito si ya había uno, si no el alto real
    // renderizado ahora mismo (arranca el arrastre desde donde se ve la
    // tarjeta, no desde 0).
    const alturaInicial = parseInt(tarjeta.style.height, 10) || tarjeta.getBoundingClientRect().height;
    let spanFinal = spanInicial;
    let alturaFinal = alturaInicial;
    const alMover = (e) => {
      const anchoColumna = els.resumenFinTablero.clientWidth / 12;
      const deltaSpan = Math.round((e.clientX - xInicial) / anchoColumna);
      spanFinal = Math.min(DASHBOARD_SPAN_MAX, Math.max(DASHBOARD_SPAN_MIN, spanInicial + deltaSpan));
      tarjeta.style.gridColumn = `span ${spanFinal}`;
      const deltaAltura = e.clientY - yInicial;
      alturaFinal = Math.min(DASHBOARD_HEIGHT_MAX, Math.max(DASHBOARD_HEIGHT_MIN, Math.round(alturaInicial + deltaAltura)));
      aplicarAlturaTarjeta(tarjeta, alturaFinal);
    };
    const alTerminar = () => {
      handle.removeEventListener('pointermove', alMover);
      handle.removeEventListener('pointerup', alTerminar);
      handle.removeEventListener('pointercancel', alTerminar);
      if (spanFinal !== spanInicial || alturaFinal !== alturaInicial) {
        igualarAlturaFilasDashboard();
        guardarPreferenciasDashboard();
      }
    };
    handle.addEventListener('pointermove', alMover);
    handle.addEventListener('pointerup', alTerminar);
    handle.addEventListener('pointercancel', alTerminar);
  }

  function manejadorTecladoDashboard(evento) {
    const tarjeta = evento.currentTarget;
    if (evento.key === 'Escape') {
      desactivarModoDashboard();
      return;
    }
    if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') {
      evento.preventDefault();
      const actual =
        parseInt((tarjeta.style.gridColumn || '').replace('span ', ''), 10) ||
        DASHBOARD_SPANS_DEFECTO[tarjeta.dataset.dashboardId] ||
        12;
      const delta = evento.key === 'ArrowRight' ? 1 : -1;
      tarjeta.style.gridColumn = `span ${Math.min(DASHBOARD_SPAN_MAX, Math.max(DASHBOARD_SPAN_MIN, actual + delta))}`;
      igualarAlturaFilasDashboard();
      guardarPreferenciasDashboard();
      return;
    }
    if (evento.shiftKey && (evento.key === 'ArrowUp' || evento.key === 'ArrowDown')) {
      evento.preventDefault();
      const alturaActual = parseInt(tarjeta.style.height, 10) || tarjeta.getBoundingClientRect().height;
      const delta = evento.key === 'ArrowDown' ? DASHBOARD_HEIGHT_PASO_TECLADO : -DASHBOARD_HEIGHT_PASO_TECLADO;
      const alturaNueva = Math.min(DASHBOARD_HEIGHT_MAX, Math.max(DASHBOARD_HEIGHT_MIN, Math.round(alturaActual + delta)));
      aplicarAlturaTarjeta(tarjeta, alturaNueva);
      igualarAlturaFilasDashboard();
      guardarPreferenciasDashboard();
      return;
    }
    if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
      evento.preventDefault();
      const tarjetas = obtenerTarjetasDashboard();
      const indiceActual = tarjetas.indexOf(tarjeta);
      const indiceDestino = evento.key === 'ArrowUp' ? indiceActual - 1 : indiceActual + 1;
      if (indiceDestino < 0 || indiceDestino >= tarjetas.length) return;
      const nuevaSecuencia = [...tarjetas];
      nuevaSecuencia.splice(indiceActual, 1);
      nuevaSecuencia.splice(indiceDestino, 0, tarjeta);
      nuevaSecuencia.forEach((t, i) => {
        t.style.order = String(i);
      });
      igualarAlturaFilasDashboard();
      guardarPreferenciasDashboard();
    }
  }

  els.btnModoDashboard.addEventListener('click', alternarModoDashboard);
  els.btnRestablecerDashboard.addEventListener('click', restablecerDashboard);

  async function cargarResumenFinanciero() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.resumenFinError.textContent = '';
    Esqueleto.marcarKpisCargando(els.resumenFinTablero, true);
    try {
      const res = await fetch(`${API_BASE}/admin/resumen-financiero`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        Esqueleto.marcarKpisCargando(els.resumenFinTablero, false);
        els.resumenFinError.textContent = 'No se pudo cargar el resumen financiero.';
        return;
      }
      const data = await res.json();
      renderResumenFinanciero(data);
      Esqueleto.marcarKpisCargando(els.resumenFinTablero, false);
      // "Cobranza del mes" (mini tarjeta) reusa ordenesCache — se carga
      // aparte si Ventas aún no se ha visitado esta sesión. Si el perfil
      // no tiene acceso a Ventas o el módulo está deshabilitado, se
      // degrada a la tarjeta vacía sin romper el resto del resumen.
      try {
        if (!ordenesCache || ordenesCache.length === 0) await cargarOrdenes();
        renderResumenFinCobranza(ordenesCache);
      } catch (_) {
        renderResumenFinCobranza([]);
      }
      // Con todo el contenido ya renderizado (KPIs, donas, gráficas,
      // cobranza), se igualan las filas — un frame después, para medir
      // alturas ya pintadas de verdad (punto 262).
      requestAnimationFrame(igualarAlturaFilasDashboard);
    } catch (err) {
      Esqueleto.marcarKpisCargando(els.resumenFinTablero, false);
      els.resumenFinError.textContent = 'No se pudo conectar con el servidor.';
    }
  }

  function renderResumenFinanciero(data) {
    const mes = data.mes_actual || {};
    els.resumenFinKpiFacturado.textContent = `$${formatearMoneda(mes.facturado || 0)}`;
    els.resumenFinKpiGastos.textContent = `$${formatearMoneda(mes.gastos || 0)}`;
    els.resumenFinKpiBalance.textContent = `$${formatearMoneda(mes.balance || 0)}`;
    els.resumenFinKpiSinFacturar.textContent = `$${formatearMoneda(mes.ventas_sin_facturar || 0)}`;
    aplicarTendenciaMoneda(els.resumenFinKpiFacturadoTendencia, data.tendencia && data.tendencia.facturado);
    aplicarTendenciaMoneda(els.resumenFinKpiGastosTendencia, data.tendencia && data.tendencia.gastos);

    // Gráfica de barras (Ventas / Facturado / Gastos) por mes, en CSS
    // puro — misma altura relativa al valor máximo de toda la serie,
    // sin librería externa (mismo criterio que el resto del frontend
    // sin build step).
    const serie = data.serie_mensual || [];
    const maximo = Math.max(1, ...serie.flatMap((m) => [m.ventas, m.facturado, m.gastos]));
    els.resumenFinChartBody.innerHTML = '';
    els.resumenFinChartEmpty.hidden = serie.some((m) => m.ventas || m.facturado || m.gastos);
    serie.forEach((m) => {
      const sinFacturar = Math.max(0, m.ventas - m.facturado);
      const columna = document.createElement('div');
      columna.className = 'resumen-fin-chart-columna resumen-fin-chart-columna--4';
      columna.innerHTML = `
        <div class="resumen-fin-chart-barras" role="img" aria-label="${escapeHtml(m.mes)}: ventas $${formatearMoneda(m.ventas)}, gastos $${formatearMoneda(m.gastos)}, facturado $${formatearMoneda(m.facturado)}, sin facturar $${formatearMoneda(sinFacturar)}">
          <span class="resumen-fin-chart-barra resumen-fin-chart-barra-ventas" style="height:${(m.ventas / maximo) * 100}%" data-tooltip="Ventas: $${formatearMoneda(m.ventas)}"></span>
          <span class="resumen-fin-chart-barra resumen-fin-chart-barra-gastos" style="height:${(m.gastos / maximo) * 100}%" data-tooltip="Gastos: $${formatearMoneda(m.gastos)}"></span>
          <span class="resumen-fin-chart-barra resumen-fin-chart-barra-facturado" style="height:${(m.facturado / maximo) * 100}%" data-tooltip="Facturado: $${formatearMoneda(m.facturado)}"></span>
          <span class="resumen-fin-chart-barra resumen-fin-chart-barra-sin-facturar" style="height:${(sinFacturar / maximo) * 100}%" data-tooltip="Sin facturar: $${formatearMoneda(sinFacturar)}"></span>
        </div>
        <span class="resumen-fin-chart-etiqueta">${escapeHtml(m.mes)}</span>
      `;
      els.resumenFinChartBody.appendChild(columna);
    });

    actualizarTagQGenerico(els.chartVfgTagQ);
    if (els.chartVfgTagN) els.chartVfgTagN.textContent = `${serie.length} mes${serie.length === 1 ? '' : 'es'}`;
    if (els.chartVfgKpis) {
      if (serie.length > 0) {
        const ventasTotales = serie.reduce((acc, m) => acc + m.ventas, 0);
        const sinFacturarTotales = serie.reduce((acc, m) => acc + Math.max(0, m.ventas - m.facturado), 0);
        els.chartVfgKpiVentas.textContent = `$${formatearMoneda(ventasTotales)}`;
        els.chartVfgKpiPct.textContent = ventasTotales > 0 ? `${Math.round((sinFacturarTotales / ventasTotales) * 100)}%` : '0%';
        els.chartVfgKpiSinfact.textContent = `$${formatearMoneda(sinFacturarTotales)}`;
        els.chartVfgKpis.hidden = false;
      } else {
        els.chartVfgKpis.hidden = true;
      }
    }
    if (els.chartVfgAlerta) {
      const sinFacturarMes = mes.ventas_sin_facturar || 0;
      if (sinFacturarMes > 0) {
        els.chartVfgAlertaTexto.innerHTML = `<strong>Este mes:</strong> $${formatearMoneda(sinFacturarMes)} pendientes de timbrado`;
        els.chartVfgAlerta.hidden = false;
      } else {
        els.chartVfgAlerta.hidden = true;
      }
    }
    if (els.chartVfgBtnIrVentas) {
      els.chartVfgBtnIrVentas.onclick = () => {
        if (els.ordenesFiltroFacturacion) els.ordenesFiltroFacturacion.value = 'sin_facturar';
        cambiarVistaPrincipal('ordenes');
      };
    }

    renderResumenFinUtilidad(mes);
    cacheMesActualUtilidadNeta = typeof mes.utilidad_neta === 'number' ? mes.utilidad_neta : null;
    renderResumenFinUtilidadMensual(serie);
    cacheMesActualVentasTotal = typeof mes.ventas === 'number' ? mes.ventas : null;
    renderResumenFinProyeccion(serie, data.proyeccion_ventas);
    renderResumenFinGastosCategoria(data.gastos_por_categoria || []);
    renderResumenFinFacturacion(mes);
    renderResumenFinProveedores(data.top_proveedores || [], mes);
  }

  // Tarjeta "Utilidad neta del mes (ventas totales vs gastos)" (punto
  // 118 de PROJECT_STATE.md): número grande + dos columnas de barras en
  // CSS puro — "Ventas totales" apilada (Subtotal abajo + IVA cobrado
  // arriba) junto a "Gastos" sólida, misma escala relativa al máximo.
  // El IVA aquí es el cobrado en ventas; los gastos no desglosan el suyo,
  // así que la cifra NO pretende ser un IVA neto fiscal (nota visible en
  // la tarjeta).
  function renderResumenFinUtilidad(mes) {
    const subtotal = mes.subtotal_ventas || 0;
    const iva = mes.iva_ventas || 0;
    const ventasTotales = mes.ventas || 0;
    const gastos = mes.gastos || 0;
    const utilidad =
      typeof mes.utilidad_neta === 'number' ? mes.utilidad_neta : subtotal - gastos;

    els.resumenFinUtilidadValor.textContent = `$${formatearMoneda(utilidad)}`;
    els.resumenFinUtilidadValor.classList.toggle('es-positiva', utilidad > 0);
    els.resumenFinUtilidadValor.classList.toggle('es-negativa', utilidad < 0);

    actualizarTagQGenerico(els.unmMiniTagQ);
    if (els.unmMiniCierreTexto) {
      const { diasRestantes, nombreMes } = calcularCierreMensual();
      els.unmMiniCierreTexto.textContent = diasRestantes === 0
        ? `Hoy cierra el mes — mañana se archivan Ventas y Gastos de ${nombreMes}.`
        : `Faltan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} para el cierre de ${nombreMes}.`;
    }
    if (els.unmMiniBtnAnalizar) {
      els.unmMiniBtnAnalizar.onclick = () => {
        const boton = document.querySelector('[data-detalle-contenido="resumen-fin-balance-contenido"]');
        if (boton) boton.click();
      };
    }

    const hayDatos = ventasTotales > 0 || gastos > 0;
    els.resumenFinUtilidadEmpty.hidden = hayDatos;
    els.resumenFinUtilidadBody.hidden = !hayDatos;
    if (els.unmMiniBadge) els.unmMiniBadge.hidden = !hayDatos;
    if (els.unmMiniKpis) els.unmMiniKpis.hidden = !hayDatos;
    if (els.unmMiniAlerta) els.unmMiniAlerta.hidden = !hayDatos || gastos <= 0;
    if (!hayDatos) return;

    if (els.unmMiniBadge) {
      els.unmMiniBadge.textContent = utilidad >= 0 ? 'Superávit operativo' : 'Déficit operativo';
      els.unmMiniBadge.classList.toggle('es-positiva', utilidad >= 0);
      els.unmMiniBadge.classList.toggle('es-negativa', utilidad < 0);
    }
    if (els.unmMiniKpis) {
      els.unmMiniKpiVentas.textContent = `$${formatearMoneda(subtotal)}`;
      els.unmMiniKpiVentasNota.textContent = `+$${formatearMoneda(iva)} IVA incl.`;
      els.unmMiniKpiGastos.textContent = `$${formatearMoneda(gastos)}`;
      els.unmMiniKpiGastosNota.textContent = subtotal > 0
        ? `${(gastos / subtotal).toFixed(1)}x sobre ventas`
        : (gastos > 0 ? 'Sin ventas este mes' : '');
    }
    if (els.unmMiniAlerta && gastos > 0) {
      if (subtotal > 0 && gastos > subtotal) {
        els.unmMiniAlertaTexto.innerHTML = `Los gastos superan los ingresos en <strong>${(gastos / subtotal).toFixed(1)}x</strong> este mes.`;
        els.unmMiniAlerta.hidden = false;
      } else if (subtotal > 0 && utilidad > 0) {
        const margen = Math.round((utilidad / subtotal) * 100);
        els.unmMiniAlertaTexto.innerHTML = `Margen neto del <strong>${margen}%</strong> este mes.`;
        els.unmMiniAlerta.hidden = false;
      } else {
        els.unmMiniAlerta.hidden = true;
      }
    }

    const maximo = Math.max(ventasTotales, gastos, 1);
    // Mínimo 1% para valores > 0: que un monto chico siga siendo visible
    // junto a uno grande (mismo criterio que min-height:2px de las barras
    // de la gráfica principal).
    const alturaPct = (valor) => (valor > 0 ? Math.max((valor / maximo) * 100, 1) : 0);
    els.resumenFinUtilidadBody.innerHTML = `
      <div class="resumen-fin-chart-columna">
        <div class="resumen-fin-utilidad-apilada" role="img" aria-label="Ventas totales $${formatearMoneda(ventasTotales)}: subtotal $${formatearMoneda(subtotal)} más IVA $${formatearMoneda(iva)}">
          <span class="resumen-fin-utilidad-segmento-iva" style="height:${alturaPct(iva)}%" data-tooltip="IVA cobrado: $${formatearMoneda(iva)}"></span>
          <span class="resumen-fin-utilidad-segmento-subtotal" style="height:${alturaPct(subtotal)}%" data-tooltip="Subtotal (neto): $${formatearMoneda(subtotal)}"></span>
        </div>
        <span class="resumen-fin-chart-etiqueta">Ventas totales</span>
      </div>
      <div class="resumen-fin-chart-columna">
        <div class="resumen-fin-utilidad-apilada" role="img" aria-label="Gastos $${formatearMoneda(gastos)}">
          <span class="resumen-fin-utilidad-segmento-gastos" style="height:${alturaPct(gastos)}%" data-tooltip="Gastos: $${formatearMoneda(gastos)}"></span>
        </div>
        <span class="resumen-fin-chart-etiqueta">Gastos</span>
      </div>
    `;
  }

  // Convierte una serie de valores en puntos (x,y) dentro de un viewBox
  // SVG de "ancho" x "alto" con margen "pad" — reutilizado por las
  // gráficas de línea de Balance acumulado y Proyección de ventas. El
  // dominio vertical SIEMPRE incluye el 0, para que la línea de
  // referencia en cero sea comparable entre ambas gráficas.
  function construirPuntosLinea(valores, ancho = 300, alto = 120, pad = 14) {
    const dominio = [0, ...valores];
    const minimo = Math.min(...dominio);
    const maximo = Math.max(...dominio);
    const rango = maximo - minimo || 1;
    const pasoX = valores.length > 1 ? (ancho - pad * 2) / (valores.length - 1) : 0;
    const escalaY = (valor) => alto - pad - ((valor - minimo) / rango) * (alto - pad * 2);
    return {
      puntos: valores.map((v, i) => ({ x: pad + pasoX * i, y: escalaY(v) })),
      yCero: escalaY(0),
    };
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Qué puntos de una serie se etiquetan directo en la gráfica — ver
  // PROJECT_STATE.md: etiquetar CADA punto (lo que había antes) se veía
  // "tosco" y chocaba en series de 6-8 meses sin garantía de arreglo
  // permanente (el primer/último punto usan alineación de texto
  // distinta a los del medio, así que ni el cálculo de colisión por
  // ancho de texto los cubría bien). Ahora solo se etiquetan los puntos
  // que cuentan una historia — primero, último (+ último REAL si hay
  // proyección, para no perder el punto donde el pronóstico arranca),
  // el más alto y el más bajo — máximo 4-5 cifras por tarjeta sin
  // importar cuántos meses traiga la serie. El resto son puntos
  // normales: sin cifra pegada, pero con su <title> (tooltip nativo del
  // navegador al pasar el mouse) intacto — nada se pierde, solo deja de
  // competir por espacio.
  function calcularIndicesClave(valores, cantidadReal) {
    const claves = new Set([0, valores.length - 1]);
    if (cantidadReal && cantidadReal < valores.length) claves.add(cantidadReal - 1);
    let iMax = 0;
    let iMin = 0;
    valores.forEach((v, i) => {
      if (v > valores[iMax]) iMax = i;
      if (v < valores[iMin]) iMin = i;
    });
    claves.add(iMax);
    claves.add(iMin);
    return claves;
  }

  // Utilidad neta mensual (ver PROJECT_STATE.md) — cada mes por separado,
  // NO acumulado (antes esta tarjeta era "Balance acumulado", suma
  // corrida de Facturado-Gastos). Usa serie[i].utilidad_neta, calculado
  // en el backend con la MISMA fórmula que la tarjeta "Utilidad neta del
  // mes" (subtotal de ventas sin IVA - gastos), para que el último punto
  // de esta gráfica siempre coincida con ese KPI. IDs internos
  // (resumen-fin-balance-*, data-dashboard-id="balance-acumulado") se
  // quedan igual a propósito, para no invalidar el layout ya guardado
  // por un usuario en el modo dashboard personalizable (punto 119).
  //
  // cacheSerieUtilidadNeta: la tarjeta chica se queda simple a propósito
  // (pedido explícito del usuario, "no quiero perder la versión dashboard
  // rápida") — esta copia es solo para que abrirDetalleUtilidadNetaRica()
  // arme la vista rica del modal sin volver a pedir el endpoint.
  let cacheSerieUtilidadNeta = [];

  function renderResumenFinUtilidadMensual(serie) {
    cacheSerieUtilidadNeta = serie;
    const svg = els.resumenFinBalanceSvg;
    svg.innerHTML = '';
    els.resumenFinBalanceEtiquetas.innerHTML = '';
    if (serie.length === 0) {
      els.resumenFinBalanceEmpty.hidden = false;
      if (els.resumenFinBalanceKpis) els.resumenFinBalanceKpis.hidden = true;
      return;
    }
    els.resumenFinBalanceEmpty.hidden = true;

    // 420x180: mismo viewBox del mockup homologado (stitch/mini) — antes
    // era 300x120 con preserveAspectRatio="none", que ESTIRABA el SVG al
    // ancho real de la tarjeta (~2x más ancho que el viewBox) y dejaba los
    // puntos ovalados en vez de circulares. Ahora el contenedor fija
    // aspect-ratio:420/180 en CSS (.resumen-fin-balance-svg-ancha) igual
    // al viewBox, así que no hace falta preserveAspectRatio="none" ni se
    // distorsiona nada.
    const ANCHO = 420, ALTO = 180, PAD = 34;
    const valores = serie.map((m) => m.utilidad_neta);
    const { puntos, yCero } = construirPuntosLinea(valores, ANCHO, ALTO, PAD);
    const indicesClave = calcularIndicesClave(valores);
    let indiceMax = 0;
    valores.forEach((v, i) => { if (v > valores[indiceMax]) indiceMax = i; });
    const indiceUltimo = puntos.length - 1;

    // ---- 2 KPI chicas (Acumulado / Máximo) — mismo criterio de "sin
    // inventar comparativos" que la vista rica del modal: solo el monto,
    // sin un % contra una meta que no existe. ----
    if (els.resumenFinBalanceKpis) {
      const acumulado = valores.reduce((a, b) => a + b, 0);
      els.resumenFinBalanceKpiAcum.textContent = `$${formatearMoneda(acumulado)}`;
      els.resumenFinBalanceKpiMax.textContent = `$${formatearMoneda(valores[indiceMax])}`;
      els.resumenFinBalanceKpiMaxMes.textContent = serie[indiceMax].mes;
      els.resumenFinBalanceKpis.hidden = false;
    }

    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = `
      <linearGradient id="resumenFinBalanceAreaGrad" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#03285B" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#03285B" stop-opacity="0"/>
      </linearGradient>
    `;
    svg.appendChild(defs);

    const lineaCero = document.createElementNS(SVG_NS, 'line');
    lineaCero.setAttribute('x1', '0');
    lineaCero.setAttribute('x2', String(ANCHO));
    lineaCero.setAttribute('y1', String(yCero));
    lineaCero.setAttribute('y2', String(yCero));
    lineaCero.setAttribute('class', 'resumen-fin-linea-cero');
    svg.appendChild(lineaCero);

    if (puntos.length > 1) {
      const area = document.createElementNS(SVG_NS, 'polygon');
      const areaPts = `${puntos.map((p) => `${p.x},${p.y}`).join(' ')} ${puntos[puntos.length - 1].x},${yCero} ${puntos[0].x},${yCero}`;
      area.setAttribute('points', areaPts);
      area.setAttribute('fill', 'url(#resumenFinBalanceAreaGrad)');
      svg.appendChild(area);

      const polyline = document.createElementNS(SVG_NS, 'polyline');
      polyline.setAttribute('points', puntos.map((p) => `${p.x},${p.y}`).join(' '));
      polyline.setAttribute('class', 'resumen-fin-linea-trazo resumen-fin-linea-balance');
      svg.appendChild(polyline);
    }

    puntos.forEach((p, i) => {
      // Punto y cifra en verde/rojo según el signo del mes — mismo
      // criterio que el número grande de "Utilidad neta del mes"
      // (.resumen-fin-utilidad-valor.es-positiva/es-negativa).
      const esPositiva = valores[i] >= 0;
      const esClave = indicesClave.has(i);
      const claseSigno = esPositiva ? 'es-positiva' : 'es-negativa';
      // Halo + pulso SOLO en máximo y último punto (mismos 2 que resalta
      // el mockup) — nunca en el primero, para no saturar una tarjeta que
      // debe seguir leyéndose rápido.
      const esDestacado = i === indiceMax || i === indiceUltimo;

      if (esDestacado) {
        const halo = document.createElementNS(SVG_NS, 'circle');
        halo.setAttribute('cx', String(p.x));
        halo.setAttribute('cy', String(p.y));
        halo.setAttribute('r', '9');
        halo.setAttribute(
          'class',
          `resumen-fin-linea-halo resumen-fin-linea-halo-${esPositiva ? 'positiva' : 'negativa'}`
        );
        svg.appendChild(halo);
      }

      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(p.x));
      circle.setAttribute('cy', String(p.y));
      circle.setAttribute('r', esClave ? '4' : '3');
      circle.setAttribute(
        'class',
        esClave
          ? `resumen-fin-linea-punto resumen-fin-linea-punto-${esPositiva ? 'positiva' : 'negativa'}`
          : 'resumen-fin-linea-punto resumen-fin-linea-punto-fantasma'
      );
      // data-tooltip (no <title> nativo) para usar el tooltip estilizado
      // del panel (mismo componente de Tickets/Constancias, ver
      // inicializarTooltips() en admin.js) en vez del globo gris sin
      // estilo del navegador.
      circle.setAttribute('data-tooltip', `${serie[i].mes}: $${formatearMoneda(valores[i])}`);
      svg.appendChild(circle);

      // Cifra compacta SOLO en los puntos clave (primero/último/máximo/
      // mínimo, ver calcularIndicesClave) — el resto se consulta pasando
      // el mouse sobre su punto (title de arriba). Arriba del punto, o
      // abajo si es negativo, para no encimarse con la línea de cero.
      if (!esClave) return;
      const anclaje = i === 0 ? 'start' : i === puntos.length - 1 ? 'end' : 'middle';
      const texto = document.createElementNS(SVG_NS, 'text');
      texto.setAttribute('x', String(p.x));
      texto.setAttribute('y', String(esPositiva ? p.y - 13 : p.y + 20));
      texto.setAttribute('text-anchor', anclaje);
      texto.setAttribute('class', `resumen-fin-linea-etiqueta-valor ${claseSigno}`);
      texto.textContent = formatearMonedaCompacta(valores[i]);
      svg.appendChild(texto);
    });

    els.resumenFinBalanceEtiquetas.innerHTML = serie.map((m) => `<span>${escapeHtml(m.mes)}</span>`).join('');
    // Con un solo mes no hay trazo que dibujar (un punto solo no es una
    // tendencia) — se avisa en vez de dejar el punto flotando sin
    // contexto, mismo espíritu que la nota de "Proyección de ventas".
    els.resumenFinBalanceNota.hidden = puntos.length > 1;
  }

  // Proyección de ventas: línea sólida con los meses reales + línea
  // punteada con la estimación de los próximos 2 meses (si el backend la
  // calculó — necesita al menos 3 meses reales, ver
  // GET /api/admin/resumen-financiero). Nunca se inventa una proyección
  // sin datos suficientes. Homologada con el mockup stitch/mini (mismo
  // tratamiento visual que "Utilidad neta mensual", punto 255): 2 KPIs
  // chicas + degradado bajo cada tramo (navy real / naranja proyectado)
  // + halo en el último punto real y en el máximo proyectado. 420x180
  // sin preserveAspectRatio="none" (antes 300x120 con ese atributo
  // ESTIRABA el SVG y ovalaba los puntos — mismo bug ya corregido en el
  // punto 255, aplicado aquí desde el inicio).
  function renderResumenFinProyeccion(serie, proyeccion) {
    cacheSerieProyeccionReal = serie;
    cacheProyeccionVentas = proyeccion || null;
    const svg = els.resumenFinProyeccionSvg;
    svg.innerHTML = '';
    els.resumenFinProyeccionEtiquetas.innerHTML = '';
    if (serie.length === 0) {
      els.resumenFinProyeccionEmpty.hidden = false;
      els.resumenFinProyeccionNota.hidden = true;
      if (els.resumenFinProyeccionKpis) els.resumenFinProyeccionKpis.hidden = true;
      return;
    }
    els.resumenFinProyeccionEmpty.hidden = true;

    const ANCHO = 420, ALTO = 180, PAD = 34;
    const meses = [...serie.map((m) => m.mes), ...(proyeccion || []).map((m) => m.mes)];
    const valores = [...serie.map((m) => m.ventas), ...(proyeccion || []).map((m) => m.ventas)];
    const cantidadReal = serie.length;
    const { puntos, yCero } = construirPuntosLinea(valores, ANCHO, ALTO, PAD);
    const indicesClave = calcularIndicesClave(valores, cantidadReal);

    // ---- 2 KPI chicas (Ventas acumuladas / Máx. proyectado) — mismo
    // criterio de "sin inventar comparativos" que el resto del panel:
    // solo montos reales o directamente derivados de la proyección ya
    // calculada, nunca un % de crecimiento inventado. ----
    if (els.resumenFinProyeccionKpis) {
      const acumulado = serie.reduce((a, m) => a + m.ventas, 0);
      els.resumenFinProyeccionKpiAcum.textContent = `$${formatearMoneda(acumulado)}`;
      if (proyeccion && proyeccion.length && els.resumenFinProyeccionKpiProyCard) {
        let iMax = 0;
        proyeccion.forEach((m, i) => { if (m.ventas > proyeccion[iMax].ventas) iMax = i; });
        els.resumenFinProyeccionKpiProyMes.textContent = proyeccion[iMax].mes;
        els.resumenFinProyeccionKpiProy.textContent = `$${formatearMoneda(proyeccion[iMax].ventas)}`;
        els.resumenFinProyeccionKpiProyCard.hidden = false;
      } else if (els.resumenFinProyeccionKpiProyCard) {
        els.resumenFinProyeccionKpiProyCard.hidden = true;
      }
      els.resumenFinProyeccionKpis.hidden = false;
    }

    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = `
      <linearGradient id="resumenFinProyeccionAreaVentas" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#03285B" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#03285B" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="resumenFinProyeccionAreaProy" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#B4530C" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#B4530C" stop-opacity="0"/>
      </linearGradient>
    `;
    svg.appendChild(defs);

    const lineaCero = document.createElementNS(SVG_NS, 'line');
    lineaCero.setAttribute('x1', '0');
    lineaCero.setAttribute('x2', String(ANCHO));
    lineaCero.setAttribute('y1', String(yCero));
    lineaCero.setAttribute('y2', String(yCero));
    lineaCero.setAttribute('class', 'resumen-fin-linea-cero');
    svg.appendChild(lineaCero);

    const areaPoligono = (desde, hasta) => {
      const sub = puntos.slice(desde, hasta + 1);
      if (sub.length < 2) return null;
      return `${sub.map((p) => `${p.x},${p.y}`).join(' ')} ${sub[sub.length - 1].x},${yCero} ${sub[0].x},${yCero}`;
    };
    const areaReal = areaPoligono(0, cantidadReal - 1);
    if (areaReal) {
      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', areaReal);
      poly.setAttribute('fill', 'url(#resumenFinProyeccionAreaVentas)');
      svg.appendChild(poly);
    }
    if (proyeccion && proyeccion.length) {
      const areaProy = areaPoligono(cantidadReal - 1, puntos.length - 1);
      if (areaProy) {
        const poly = document.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute('points', areaProy);
        poly.setAttribute('fill', 'url(#resumenFinProyeccionAreaProy)');
        svg.appendChild(poly);
      }
    }

    const trazarSegmento = (desde, hasta, clase) => {
      const sub = puntos.slice(desde, hasta + 1);
      if (sub.length < 2) return;
      const polyline = document.createElementNS(SVG_NS, 'polyline');
      polyline.setAttribute('points', sub.map((p) => `${p.x},${p.y}`).join(' '));
      polyline.setAttribute('class', clase);
      svg.appendChild(polyline);
    };

    trazarSegmento(0, cantidadReal - 1, 'resumen-fin-linea-trazo resumen-fin-linea-ventas');
    if (proyeccion && proyeccion.length) {
      trazarSegmento(cantidadReal - 1, puntos.length - 1, 'resumen-fin-linea-trazo resumen-fin-linea-proyeccion');
    }

    // Halo solo en 2 puntos (mismo criterio del punto 255: nunca más de
    // 2 para que la tarjeta chica siga leyéndose rápido) — el último mes
    // real (donde arranca la proyección) y el máximo proyectado, si hay
    // proyección. Sin proyección, ninguno lleva halo.
    let indiceMaxProy = -1;
    if (proyeccion && proyeccion.length) {
      indiceMaxProy = cantidadReal;
      for (let i = cantidadReal; i < valores.length; i++) {
        if (valores[i] > valores[indiceMaxProy]) indiceMaxProy = i;
      }
    }
    const indiceUltimoReal = cantidadReal - 1;

    puntos.forEach((p, i) => {
      const esProyectado = i >= cantidadReal;
      const esClave = indicesClave.has(i);
      const esDestacado = proyeccion && proyeccion.length && (i === indiceUltimoReal || i === indiceMaxProy);

      if (esDestacado) {
        const halo = document.createElementNS(SVG_NS, 'circle');
        halo.setAttribute('cx', String(p.x));
        halo.setAttribute('cy', String(p.y));
        halo.setAttribute('r', '9');
        halo.setAttribute(
          'class',
          `resumen-fin-linea-halo ${esProyectado ? 'resumen-fin-linea-halo-proyeccion' : 'resumen-fin-linea-halo-ventas'}`
        );
        svg.appendChild(halo);
      }

      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(p.x));
      circle.setAttribute('cy', String(p.y));
      circle.setAttribute('r', esClave ? '4' : '3');
      circle.setAttribute(
        'class',
        esClave
          ? `resumen-fin-linea-punto ${esProyectado ? 'resumen-fin-linea-punto-proyeccion' : 'resumen-fin-linea-punto-ventas'}`
          : 'resumen-fin-linea-punto resumen-fin-linea-punto-fantasma'
      );
      // data-tooltip (no <title> nativo) — mismo motivo que el punto de
      // "Balance acumulado" arriba: tooltip estilizado del panel en vez
      // del globo gris sin estilo del navegador.
      circle.setAttribute('data-tooltip', `${meses[i]}${esProyectado ? ' (proyectado)' : ''}: $${formatearMoneda(valores[i])}`);
      svg.appendChild(circle);

      // Cifra compacta SOLO en los puntos clave (primero/último real/
      // último proyectado/máximo/mínimo, ver calcularIndicesClave) —
      // siempre arriba del punto, mismo color que el punto (navy real /
      // naranja proyectado); nunca negativas, así que no hay variante
      // "abajo". El resto se consulta con el mouse sobre su punto.
      if (!esClave) return;
      const anclaje = i === 0 ? 'start' : i === puntos.length - 1 ? 'end' : 'middle';
      const texto = document.createElementNS(SVG_NS, 'text');
      texto.setAttribute('x', String(p.x));
      texto.setAttribute('y', String(p.y - 13));
      texto.setAttribute('text-anchor', anclaje);
      texto.setAttribute('class', `resumen-fin-linea-etiqueta-valor ${esProyectado ? 'es-proyectado' : 'es-real'}`);
      texto.textContent = formatearMonedaCompacta(valores[i]);
      svg.appendChild(texto);
    });

    els.resumenFinProyeccionEtiquetas.innerHTML = meses
      .map((m, i) => `<span class="${i >= cantidadReal ? 'es-proyectado' : ''}">${escapeHtml(m)}</span>`)
      .join('');
    els.resumenFinProyeccionNota.hidden = !(proyeccion && proyeccion.length);
  }

  // Genera una dona SVG de N segmentos dinámicos (a diferencia de la
  // dona de "Inicio", que tiene 3 círculos fijos en el HTML) — reutilizado
  // por "Distribución de gastos" y "Facturadas vs sin facturar". Deja un
  // pequeño espacio entre segmentos (a pedido del usuario, tonos
  // pasteles): sin él, dos tonos pastel contiguos se funden entre sí
  // porque su contraste mutuo es bajo — el hueco los separa visualmente
  // sin depender de que el color por sí solo marque el límite.
  function renderDonutGenerico(svgEl, segmentos) {
    const circunferencia = 2 * Math.PI * 40;
    const total = segmentos.reduce((acc, s) => acc + s.valor, 0);
    const espacio = segmentos.length > 1 ? 2 : 0;
    svgEl.innerHTML = '';
    let acumulado = 0;
    segmentos.forEach((s) => {
      const porcentaje = total > 0 ? (s.valor / total) * 100 : 0;
      const largoTotal = (porcentaje / 100) * circunferencia;
      const largo = Math.max(0, largoTotal - espacio);
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', '50');
      circle.setAttribute('cy', '50');
      circle.setAttribute('r', '40');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke-width', '16');
      circle.setAttribute('stroke', s.color);
      circle.setAttribute('stroke-linecap', 'round');
      circle.setAttribute('stroke-dasharray', `${largo} ${circunferencia - largo}`);
      circle.setAttribute('stroke-dashoffset', String(-acumulado));
      circle.setAttribute('class', 'resumen-fin-donut-segmento');
      svgEl.appendChild(circle);
      acumulado += largoTotal;
    });
    return total;
  }

  // El color de cada categoría de gasto es fijo (no depende de cuáles
  // aparezcan este mes) para que el mismo color siempre represente la
  // misma categoría entre una carga y otra de la vista. Tonos PASTEL (a
  // pedido explícito del usuario) pero derivados de la misma familia de
  // matices que la identidad del panel (azul de --color-accent #03285B,
  // verde de "facturado" #1FAE6B, terracota de "warn"/"sin facturar"
  // #B4530C) en vez de una paleta arcoíris sin relación con la marca —
  // mismo criterio que pidió el usuario tras revisar la vista en
  // producción (ver PROJECT_STATE.md, segmento de rediseño de esta
  // vista).
  // Paleta categórica de 8 tonos, orden fijo, validada con el validador
  // oficial de la skill dataviz (lightness band/chroma floor/separación
  // CVD/piso de visión normal — las 4 fallas duras — todas en PASS; el
  // único WARN, contraste vs. superficie, ya está mitigado porque la
  // leyenda SIEMPRE muestra nombre+monto+% en texto junto al punto de
  // color, nunca solo el color). Reemplaza la paleta pastel anterior
  // (7 de sus 10 tonos eran variaciones de un mismo azul casi
  // indistinguibles entre sí — confirmado con
  // `validate_palette.js`, FAIL en las 4 comprobaciones duras en cuanto
  // el mes tiene actividad en más de 3-4 categorías a la vez, algo que
  // ningún demo anterior había probado). Con más de 8 categorías con
  // gasto el mismo mes (posible — las categorías son editables, punto
  // 135), las de menor monto se agrupan en un renglón "Otros" con un
  // gris neutro — mismo criterio que ya usa "Top proveedores de gasto"
  // (limitado a 5) en vez de forzar un 9no/10mo tono que ya no se puede
  // distinguir de los 8 anteriores.
  const RESUMEN_FIN_PALETA_CATEGORICA = [
    '#4488db', // azul
    '#ed7a4c', // naranja
    '#36b98a', // aqua
    '#eda305', // amarillo
    '#eb8baf', // magenta
    '#1f921f', // verde
    '#6052b2', // violeta
    '#e65f5e', // rojo
  ];
  const RESUMEN_FIN_COLOR_OTROS_CATEGORIA = '#9AA0AC';
  // Facturado/Sin facturar (donut de 2 segmentos): el par pastel anterior
  // (#7FCBA8/#E4A97E) fallaba el piso de visión normal del validador
  // (ΔE 14.5, bajo el mínimo 15 — de verdad cuesta distinguirlos incluso
  // con visión de color completa) y el piso CVD quedaba en el rango
  // "solo aceptable con codificación secundaria". Este par sí pasa las
  // 4 comprobaciones duras (`validate_palette.js "#ed7a4c,#36b98a"
  // --pairs all`) — mismos slots 2 y 3 (adyacentes) de la paleta
  // categórica de gastos de arriba, reutilizados aquí para no inventar
  // un tercer set de colores en la misma vista.
  const RESUMEN_FIN_COLOR_FACTURADO = '#36b98a';
  const RESUMEN_FIN_COLOR_SIN_FACTURAR = '#ed7a4c';

  let cacheGastosPorCategoria = [];

  function actualizarTagQGenerico(el) {
    if (!el) return;
    const hoy = new Date();
    const trimestre = Math.floor(hoy.getMonth() / 3) + 1;
    el.textContent = `Q${trimestre} ${hoy.getFullYear()}`;
  }

  function irAGastosSinComprobante() {
    if (els.gastosFiltroFactura) els.gastosFiltroFactura.value = '0';
    cambiarVistaPrincipal('gastos');
    cerrarDetalleGrafica();
  }

  function renderResumenFinGastosCategoria(filasEntrada) {
    actualizarTagQGenerico(els.gastosCatTagQ);
    const filas = filasEntrada || [];
    cacheGastosPorCategoria = filas;
    if (els.gastosCatBtnIrGastos) {
      els.gastosCatBtnIrGastos.onclick = () => {
        if (els.gastosFiltroFactura) els.gastosFiltroFactura.value = '';
        cambiarVistaPrincipal('gastos');
      };
    }
    if (filas.length === 0) {
      els.resumenFinDonutCategorias.innerHTML = '';
      els.resumenFinDonutCategoriasLeyenda.innerHTML = '';
      els.resumenFinDonutCategoriasTotal.textContent = '$0';
      els.resumenFinDonutCategoriasEmpty.hidden = false;
      if (els.gastosCatKpis) els.gastosCatKpis.hidden = true;
      if (els.gastosCatAlerta) els.gastosCatAlerta.hidden = true;
      return;
    }
    els.resumenFinDonutCategoriasEmpty.hidden = true;

    const totalGeneral = filas.reduce((acc, f) => acc + f.monto, 0);
    if (els.gastosCatKpis) {
      els.gastosCatKpiNcats.textContent = `${filas.length} cat${filas.length === 1 ? '' : 's'}`;
      els.gastosCatKpiTotal.textContent = `$${formatearMoneda(totalGeneral)}`;
      const mayor = filas[0];
      const pctMayor = totalGeneral > 0 ? Math.round((mayor.monto / totalGeneral) * 100) : 0;
      els.gastosCatKpiMayorPct.textContent = `${pctMayor}%`;
      els.gastosCatKpiMayorMonto.textContent = `$${formatearMoneda(mayor.monto)}`;
      els.gastosCatKpiMayorNombre.textContent = etiquetaCategoriaGasto(mayor.categoria);
      els.gastosCatKpis.hidden = false;
    }
    if (els.gastosCatAlerta && els.gastosCatAlertaTexto) {
      if (filas.length >= 2 && totalGeneral > 0) {
        const top2 = filas[0].monto + filas[1].monto;
        const pctTop2 = Math.round((top2 / totalGeneral) * 100);
        els.gastosCatAlertaTexto.innerHTML = `${escapeHtml(etiquetaCategoriaGasto(filas[0].categoria))} y ${escapeHtml(etiquetaCategoriaGasto(filas[1].categoria))} representan el <strong>${pctTop2}%</strong> del gasto`;
        els.gastosCatAlerta.hidden = false;
        if (els.gastosCatBtnVerDetalle) els.gastosCatBtnVerDetalle.onclick = abrirDetalleGastosCategoriaRica;
      } else {
        els.gastosCatAlerta.hidden = true;
      }
    }

    // El backend ya manda las filas ordenadas por monto DESC — las
    // primeras 8 (más grandes) ganan un tono propio y distinguible; el
    // resto (la "cola larga", normalmente montos chicos) se suma en un
    // solo renglón "Otros" en vez de repetir/reciclar un tono ya usado.
    const principales = filas.slice(0, RESUMEN_FIN_PALETA_CATEGORICA.length);
    const resto = filas.slice(RESUMEN_FIN_PALETA_CATEGORICA.length);
    const totalResto = resto.reduce((acc, f) => acc + f.monto, 0);

    const segmentos = principales.map((f, i) => ({ valor: f.monto, color: RESUMEN_FIN_PALETA_CATEGORICA[i] }));
    if (totalResto > 0) segmentos.push({ valor: totalResto, color: RESUMEN_FIN_COLOR_OTROS_CATEGORIA });

    const total = renderDonutGenerico(els.resumenFinDonutCategorias, segmentos);
    els.resumenFinDonutCategoriasTotal.textContent = `$${formatearMoneda(total)}`;

    const filasLeyenda = principales
      .map((f, i) => {
        const porcentaje = total > 0 ? Math.round((f.monto / total) * 100) : 0;
        return `<li><span class="resumen-fin-donut-dot" style="background:${RESUMEN_FIN_PALETA_CATEGORICA[i]}" aria-hidden="true"></span><span>${escapeHtml(etiquetaCategoriaGasto(f.categoria))}</span><strong>$${formatearMoneda(f.monto)} (${porcentaje}%)</strong></li>`;
      })
      .join('');
    const filaOtros = totalResto > 0
      ? (() => {
          const porcentaje = total > 0 ? Math.round((totalResto / total) * 100) : 0;
          return `<li><span class="resumen-fin-donut-dot" style="background:${RESUMEN_FIN_COLOR_OTROS_CATEGORIA}" aria-hidden="true"></span><span>Otros (${resto.length} categoría${resto.length === 1 ? '' : 's'})</span><strong>$${formatearMoneda(totalResto)} (${porcentaje}%)</strong></li>`;
        })()
      : '';
    els.resumenFinDonutCategoriasLeyenda.innerHTML = filasLeyenda + filaOtros;
  }

  // Trimestre real (Q1 ene-mar ... Q4 oct-dic) del mes en curso — solo
  // informativo, no dispara ninguna lógica de negocio (no existe concepto
  // de "cierre por trimestre" en la app). Banner: cuenta regresiva real al
  // último día del mes, mismo día en que corre el cierre mensual real
  // (archiva Ventas/Gastos, ver cierreMensual.js) — sin botón de acción
  // porque ese archivado ya es automático, no hay nada que "resolver".
  function calcularCierreMensual() {
    const hoy = new Date();
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const diasRestantes = Math.max(0, Math.ceil((ultimoDiaMes - hoy) / 86400000));
    const nombreMes = hoy.toLocaleDateString('es-MX', { month: 'long' });
    return { diasRestantes, nombreMes };
  }

  function actualizarTagsFacturacion() {
    const hoy = new Date();
    const trimestre = Math.floor(hoy.getMonth() / 3) + 1;
    if (els.resumenFinDonutFacturacionTagQ) {
      els.resumenFinDonutFacturacionTagQ.textContent = `Q${trimestre} ${hoy.getFullYear()}`;
    }
    if (els.resumenFinCierreBanner && els.resumenFinCierreBannerTexto) {
      const { diasRestantes, nombreMes } = calcularCierreMensual();
      els.resumenFinCierreBannerTexto.textContent = diasRestantes === 0
        ? `Hoy cierra el mes — mañana se archivan Ventas y Gastos de ${nombreMes}.`
        : `Faltan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} para el cierre de ${nombreMes} — Ventas y Gastos se archivan automáticamente el día 1.`;
    }
  }

  let cacheMesActualFacturacion = null;

  function renderResumenFinFacturacion(mes) {
    actualizarTagsFacturacion();
    cacheMesActualFacturacion = mes;
    const ventas = mes.ventas || 0;
    const facturado = mes.facturado || 0;
    const sinFacturar = mes.ventas_sin_facturar || 0;
    const opsTotales = mes.ops_totales || 0;
    const opsFacturadas = mes.ops_facturadas || 0;
    const opsSinFacturar = mes.ops_sin_facturar || 0;
    if (els.resumenFinDonutFacturacionBadge) els.resumenFinDonutFacturacionBadge.hidden = true;
    if (ventas <= 0) {
      els.resumenFinDonutFacturacion.innerHTML = '';
      els.resumenFinDonutFacturacionLeyenda.innerHTML = '';
      els.resumenFinDonutFacturacionTotal.textContent = '$0';
      els.resumenFinDonutFacturacionEmpty.hidden = false;
      if (els.resumenFinDonutFacturacionKpis) els.resumenFinDonutFacturacionKpis.hidden = true;
      if (els.resumenFinDonutFacturacionNota) els.resumenFinDonutFacturacionNota.hidden = true;
      return;
    }
    els.resumenFinDonutFacturacionEmpty.hidden = true;
    renderDonutGenerico(els.resumenFinDonutFacturacion, [
      { valor: facturado, color: RESUMEN_FIN_COLOR_FACTURADO },
      { valor: sinFacturar, color: RESUMEN_FIN_COLOR_SIN_FACTURAR },
    ]);
    els.resumenFinDonutFacturacionTotal.textContent = `$${formatearMoneda(ventas)}`;
    const pctFacturado = Math.round((facturado / ventas) * 100);
    els.resumenFinDonutFacturacionLeyenda.innerHTML = `
      <li><span class="resumen-fin-donut-dot" style="background:${RESUMEN_FIN_COLOR_FACTURADO}" aria-hidden="true"></span><span>Facturadas <small>(${opsFacturadas} comprobante${opsFacturadas === 1 ? '' : 's'})</small></span><strong>$${formatearMoneda(facturado)} (${pctFacturado}%)</strong></li>
      <li><span class="resumen-fin-donut-dot" style="background:${RESUMEN_FIN_COLOR_SIN_FACTURAR}" aria-hidden="true"></span><span>Sin facturar <small>(${opsSinFacturar} por timbrar)</small></span><strong>$${formatearMoneda(sinFacturar)} (${Math.max(0, 100 - pctFacturado)}%)</strong></li>
    `;
    // 2 KPIs chicas (mismo tratamiento que Utilidad neta mensual/
    // Proyección de ventas) + conteo real de operaciones como badge
    // (ops_totales/ops_facturadas, expuestos por el backend desde este
    // mismo punto — antes el endpoint no los mandaba).
    if (els.resumenFinDonutFacturacionKpis) {
      // KPI "Total ventas" muestra el monto FACTURADO (mismo dato que ya
      // mostraba, sin cambiar su significado) + conteo real de
      // operaciones del mes como badge — antes solo la dona lo tenía.
      els.resumenFinDonutFacturacionKpiFacturado.textContent = `$${formatearMoneda(facturado)}`;
      els.resumenFinDonutFacturacionKpiSinFacturar.textContent = `$${formatearMoneda(sinFacturar)}`;
      if (els.resumenFinDonutFacturacionKpiOps) {
        els.resumenFinDonutFacturacionKpiOps.textContent = `${opsFacturadas} de ${opsTotales} ops`;
      }
      if (els.resumenFinDonutFacturacionKpiPct) {
        els.resumenFinDonutFacturacionKpiPct.textContent = `${Math.max(0, 100 - pctFacturado)}%`;
      }
      els.resumenFinDonutFacturacionKpis.hidden = false;
    }
    if (els.resumenFinDonutFacturacionBadge) {
      els.resumenFinDonutFacturacionBadge.textContent = `${Math.max(0, 100 - pctFacturado)}% pendiente (${opsSinFacturar} por timbrar)`;
      els.resumenFinDonutFacturacionBadge.hidden = false;
    }
    if (els.resumenFinDonutFacturacionNota) els.resumenFinDonutFacturacionNota.hidden = false;
  }

  function renderResumenFinProveedores(filas, mes) {
    actualizarTagQGenerico(els.proveedoresTagQ);
    if (els.proveedoresBtnIrGastos) els.proveedoresBtnIrGastos.onclick = () => cambiarVistaPrincipal('gastos');
    if (!filas || filas.length === 0) {
      els.resumenFinProveedoresLista.innerHTML = '';
      els.resumenFinProveedoresEmpty.hidden = false;
      if (els.proveedoresKpis) els.proveedoresKpis.hidden = true;
      if (els.proveedoresAlerta) els.proveedoresAlerta.hidden = true;
      if (els.proveedoresTagN) els.proveedoresTagN.textContent = '0 proveedores';
      return;
    }
    els.resumenFinProveedoresEmpty.hidden = true;
    if (els.proveedoresTagN) els.proveedoresTagN.textContent = `${filas.length} principal${filas.length === 1 ? '' : 'es'}`;
    const maximo = Math.max(...filas.map((f) => f.monto), 1);
    els.resumenFinProveedoresLista.innerHTML = filas
      .map(
        (f) => `
      <li class="resumen-fin-proveedor-fila">
        <span class="resumen-fin-proveedor-nombre" data-tooltip="${escapeHtml(f.proveedor)}" tabindex="0">${escapeHtml(f.proveedor)}${f.categoria ? ` <small>· ${escapeHtml(etiquetaCategoriaGasto(f.categoria))}</small>` : ''}</span>
        <div class="resumen-fin-proveedor-barra-wrap">
          <span class="resumen-fin-proveedor-barra" style="width:${(f.monto / maximo) * 100}%"></span>
        </div>
        <span class="resumen-fin-proveedor-monto">$${formatearMoneda(f.monto)}</span>
      </li>`
      )
      .join('');

    const totalTop = filas.reduce((acc, f) => acc + f.monto, 0);
    const totalGastosMes = (mes && mes.gastos) || 0;
    if (els.proveedoresKpis) {
      els.proveedoresKpiTop5Total.textContent = `$${formatearMoneda(totalTop)}`;
      els.proveedoresKpiTop5Pct.textContent = totalGastosMes > 0 ? `${Math.round((totalTop / totalGastosMes) * 100)}% del egreso total` : '';
      const mayor = filas[0];
      const pctMayor = totalTop > 0 ? Math.round((mayor.monto / totalTop) * 100) : 0;
      els.proveedoresKpiMayorPct.textContent = `${pctMayor}%`;
      els.proveedoresKpiMayorMonto.textContent = `$${formatearMoneda(mayor.monto)}`;
      els.proveedoresKpiMayorNombre.textContent = mayor.proveedor;
      els.proveedoresKpis.hidden = false;
    }
    if (els.proveedoresAlerta) {
      if (filas.length >= 2 && totalTop > 0) {
        const top2 = filas[0].monto + filas[1].monto;
        const pctTop2 = Math.round((top2 / totalTop) * 100);
        els.proveedoresAlertaTexto.innerHTML = `Top 2 proveedores concentran el <strong>${pctTop2}%</strong> de este ranking`;
        els.proveedoresAlerta.hidden = false;
      } else {
        els.proveedoresAlerta.hidden = true;
      }
    }
  }

  // Mismo verde/navy que ya usa el resto del panel para "cobrado"/"por
  // cobrar" (accent + ink-soft oscuro) — homologado con stitch/cxc pero
  // sin los hex sueltos del mockup (#059669/#0a2540), reusando tokens ya
  // validados en el resto de esta vista.
  const RESUMEN_FIN_COLOR_COBRADO = '#1FAE6B';
  const RESUMEN_FIN_COLOR_PORCOBRAR = '#FBEAE9';

  // "Cobranza del mes" (mini tarjeta homologada con stitch/cxc) — misma
  // fuente de datos que la vista completa de Cuentas por cobrar
  // (calcularMetricasCxc sobre ordenesCache), sin pedir nada al backend
  // aparte. El "avance" del centro de la dona es Cobrado/(Cobrado+Por
  // cobrar) — un dato 100% real, a diferencia de la "Meta del mes" del
  // mockup original (esa parte se descartó, no hay meta capturable hoy).
  function renderResumenFinCobranza(ordenes) {
    if (!els.resumenFinDonutCobranza) return;
    const m = calcularMetricasCxc(ordenes || []);
    const totalCartera = Math.round((m.cobradoMes + m.porCobrar) * 100) / 100;
    if (totalCartera <= 0) {
      els.resumenFinDonutCobranza.innerHTML = '';
      if (els.resumenFinDonutCobranzaLeyenda) els.resumenFinDonutCobranzaLeyenda.innerHTML = '';
      if (els.resumenFinDonutCobranzaTotal) els.resumenFinDonutCobranzaTotal.textContent = '0%';
      if (els.resumenFinDonutCobranzaEmpty) els.resumenFinDonutCobranzaEmpty.hidden = false;
      if (els.cobranzaKpis) els.cobranzaKpis.hidden = true;
      if (els.cobranzaAlerta) els.cobranzaAlerta.hidden = true;
      if (els.resumenFinDonutCobranzaBadge) els.resumenFinDonutCobranzaBadge.hidden = true;
      return;
    }
    if (els.resumenFinDonutCobranzaEmpty) els.resumenFinDonutCobranzaEmpty.hidden = true;
    renderDonutGenerico(els.resumenFinDonutCobranza, [
      // Gris/rosado primero (se pinta abajo), verde al final (encima) —
      // con "por cobrar" siendo casi todo el círculo, su remate quedaba
      // arriba tapando el arranque del verde; invertido, el remate visible
      // en el punto más prominente del donut es el del verde (lo cobrado).
      { valor: m.porCobrar, color: RESUMEN_FIN_COLOR_PORCOBRAR },
      { valor: m.cobradoMes, color: RESUMEN_FIN_COLOR_COBRADO },
    ]);
    const pctCobrado = Math.round((m.cobradoMes / totalCartera) * 100);
    const pctPorCobrar = Math.max(0, 100 - pctCobrado);
    if (els.resumenFinDonutCobranzaTotal) els.resumenFinDonutCobranzaTotal.textContent = `${pctCobrado}%`;
    if (els.resumenFinDonutCobranzaBadge) { els.resumenFinDonutCobranzaBadge.textContent = 'Cobrado'; els.resumenFinDonutCobranzaBadge.hidden = false; }
    if (els.resumenFinDonutCobranzaLeyenda) {
      els.resumenFinDonutCobranzaLeyenda.innerHTML = `
        <li><span class="resumen-fin-donut-dot" style="background:${RESUMEN_FIN_COLOR_COBRADO}" aria-hidden="true"></span><span>Cobrado este mes</span><strong>$${formatearMoneda(m.cobradoMes)} (${pctCobrado}%)</strong></li>
        <li><span class="resumen-fin-donut-dot" style="background:${RESUMEN_FIN_COLOR_PORCOBRAR}" aria-hidden="true"></span><span>Por cobrar <small>(${m.pendientes.length} venta${m.pendientes.length === 1 ? '' : 's'})</small></span><strong>$${formatearMoneda(m.porCobrar)} (${pctPorCobrar}%)</strong></li>
      `;
    }
    if (els.cobranzaKpis) {
      if (els.cobranzaKpiCobrado) els.cobranzaKpiCobrado.textContent = `$${formatearMoneda(m.cobradoMes)}`;
      if (els.cobranzaKpiCobradoPct) els.cobranzaKpiCobradoPct.textContent = `${pctCobrado}%`;
      if (els.cobranzaKpiPorcobrar) els.cobranzaKpiPorcobrar.textContent = `$${formatearMoneda(m.porCobrar)}`;
      if (els.cobranzaKpiPorcobrarPct) els.cobranzaKpiPorcobrarPct.textContent = `${pctPorCobrar}%`;
      if (els.cobranzaKpiPorcobrarNota) els.cobranzaKpiPorcobrarNota.textContent = `${m.pendientes.length} venta${m.pendientes.length === 1 ? '' : 's'} pendiente${m.pendientes.length === 1 ? '' : 's'}`;
      els.cobranzaKpis.hidden = false;
    }
    if (els.cobranzaAlerta) {
      if (m.vencidasList.length > 0) {
        if (els.cobranzaAlertaTexto) els.cobranzaAlertaTexto.textContent = `${m.vencidasList.length} venta${m.vencidasList.length === 1 ? '' : 's'} vencida${m.vencidasList.length === 1 ? '' : 's'} requiere${m.vencidasList.length === 1 ? '' : 'n'} gestión`;
        els.cobranzaAlerta.hidden = false;
        if (els.cobranzaAlertaBtn) {
          els.cobranzaAlertaBtn.onclick = () => {
            cambiarVistaPrincipal('cxc');
            if (els.cxcFiltroVencimiento) els.cxcFiltroVencimiento.value = 'vencidas';
            renderCxc();
          };
        }
      } else {
        els.cobranzaAlerta.hidden = true;
      }
    }
    if (els.cobranzaBtnIrCxc) els.cobranzaBtnIrCxc.onclick = () => cambiarVistaPrincipal('cxc');
  }

  // ---------- Reportes: "Estado del inventario" (3ra pestaña) ----------
  const INV_ESTADO_COLOR_TOP = '#3D6FB4';
  const INV_ESTADO_COLOR_BOTTOM = '#C97A2E';
  const INV_ESTADO_COLOR_RIESGO = '#C97A2E';
  const INV_ESTADO_COLOR_SALUDABLE = '#1FAE6B'; // mismo verde "positivo" ya usado en Utilidad neta/donut de facturación
  const INV_ESTADO_COLOR_SOBRESTOCK = '#3D6FB4';
  // Categorías de INVENTARIO no tienen color propio en el esquema (a
  // diferencia de RESUMEN_FIN_COLORES_CATEGORIA, que es de gastos) —
  // se asigna por índice sobre la lista ya ordenada por categoria_id que
  // manda el backend, reusando los mismos tonos pastel ya validados (no
  // se inventan hexadecimales nuevos).
  const INV_ESTADO_COLORES_DONUT = ['#8FADD9', '#A9C4E3', '#719FD4', '#C0D3EB', '#9BB8DE'];

  // Punto 271: última respuesta cruda del endpoint — la usan el export
  // CSV y la impresión, para no volver a pedirle nada al servidor.
  let estadoInventarioCache = null;

  async function cargarEstadoInventario() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    Esqueleto.marcarKpisCargando(els.invEstadoKpiGrid, true);
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/reportes/estado`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        Esqueleto.marcarKpisCargando(els.invEstadoKpiGrid, false);
        return;
      }
      const data = await res.json();
      estadoInventarioCache = data;
      const kpis = data.kpis || {};
      els.invEstadoKpiValor.textContent = `$${formatearMoneda(kpis.valor_total_existencia || 0)}`;
      els.invEstadoKpiRotacion.textContent = `${Number(kpis.rotacion_promedio_catalogo || 0).toFixed(1)}×`;
      els.invEstadoKpiSinMovimiento.textContent = kpis.productos_sin_movimiento_90d || 0;
      if (els.invEstadoKpiCostoProm) els.invEstadoKpiCostoProm.textContent = `$${formatearMoneda(kpis.costo_promedio_ponderado || 0)}`;
      if (els.invEstadoKpiPiezasTotal) els.invEstadoKpiPiezasTotal.textContent = `${kpis.unidades_totales || 0} pz`;
      renderInvEstadoSalud(kpis.salud_catalogo_pct || 0);
      renderInvEstadoMontoInmovilizado(kpis.monto_inmovilizado || 0);
      renderInvEstadoAlerta(data.alerta_inmovilizado || null);

      renderInvEstadoRank(data.top_ventas_90d || [], data.bottom_ventas_90d || []);
      renderInvEstadoRotacion(data.rotacion || [], kpis.rotacion_promedio_catalogo || 0);
      renderInvEstadoDonutCategoria(data.valor_por_categoria || []);
      renderInvEstadoCobertura(data.cobertura || null);
      renderInvEstadoMatriz(data.valuacion_detalle || []);
      renderInvEstadoServicios(data.servicios || null);
      Esqueleto.marcarKpisCargando(els.invEstadoKpiGrid, false);
      // Primeros pasos (perfil Inventario): el paso 1 lee estadoInventarioCache,
      // que llega async — sin este refresco quedaría con el estado viejo
      // hasta la siguiente interacción (mismo bug ya corregido en el punto
      // 192 para el checklist de Fiscal/Inventarios).
      renderOnboardingChecklist();
    } catch (err) {
      // Las 4 gráficas se quedan en su estado vacío/anterior; se puede
      // reintentar volviendo a entrar a la pestaña.
      Esqueleto.marcarKpisCargando(els.invEstadoKpiGrid, false);
    }
  }

  function renderInvEstadoSalud(pct) {
    if (els.invEstadoKpiSalud) els.invEstadoKpiSalud.textContent = `${Number(pct).toFixed(1)}%`;
    if (els.invEstadoSaludGaugeValor) els.invEstadoSaludGaugeValor.setAttribute('stroke-dasharray', `${Number(pct)}, 100`);
  }

  function renderInvEstadoMontoInmovilizado(monto) {
    if (!els.invEstadoKpiMontoInmovilizadoWrap) return;
    els.invEstadoKpiMontoInmovilizadoWrap.hidden = !(monto > 0);
    if (els.invEstadoKpiMontoInmovilizado) els.invEstadoKpiMontoInmovilizado.textContent = `$${formatearMoneda(monto)}`;
  }

  // Banner real (sin acciones inventadas): solo el producto con más $
  // inmovilizado, con link a su fila real en la matriz de abajo.
  function renderInvEstadoAlerta(alerta) {
    if (!els.invEstadoAlertaInmovilizado) return;
    if (!alerta) {
      els.invEstadoAlertaInmovilizado.hidden = true;
      return;
    }
    els.invEstadoAlertaInmovilizado.hidden = false;
    if (els.invEstadoAlertaInmovilizadoTexto) {
      els.invEstadoAlertaInmovilizadoTexto.innerHTML = `<strong>${escapeHtml(alerta.nombre)}</strong> sin movimiento en 90 días representa <strong>$${formatearMoneda(alerta.monto)} MXN</strong> en existencia.`;
    }
  }

  // Punto 186 (cierra el punto 182): bloque "servicios" que el backend ya
  // devolvía sin que nada de esto lo leyera — visibilidad de este bloque
  // vs. el de producto la decide aplicarVisibilidadSoloServicios(), esta
  // función solo rellena los números, sin importar cuál esté oculto.
  function renderInvEstadoServicios(servicios) {
    const kpis = (servicios && servicios.kpis) || {};
    if (els.invEstadoServKpiTotal) els.invEstadoServKpiTotal.textContent = kpis.total_servicios || 0;
    if (els.invEstadoServKpiSinVentas) els.invEstadoServKpiSinVentas.textContent = kpis.servicios_sin_ventas_90d || 0;

    const top = (servicios && servicios.top_ventas_90d) || [];
    const bottom = (servicios && servicios.bottom_ventas_90d) || [];
    if (top.length === 0 && bottom.length === 0) {
      if (els.invEstadoServTopLista) els.invEstadoServTopLista.innerHTML = '';
      if (els.invEstadoServBottomLista) els.invEstadoServBottomLista.innerHTML = '';
      if (els.invEstadoServRankEmpty) els.invEstadoServRankEmpty.hidden = false;
      return;
    }
    if (els.invEstadoServRankEmpty) els.invEstadoServRankEmpty.hidden = true;
    renderInvEstadoServRankLista(els.invEstadoServTopLista, top, INV_ESTADO_COLOR_TOP);
    renderInvEstadoServRankLista(els.invEstadoServBottomLista, bottom, INV_ESTADO_COLOR_BOTTOM);
  }

  function renderInvEstadoServRankLista(el, filas, color) {
    if (!el) return;
    if (!filas || filas.length === 0) {
      el.innerHTML = '';
      return;
    }
    const maximo = Math.max(...filas.map((f) => f.cantidad_vendida_90d), 1);
    el.innerHTML = filas
      .map(
        (f) => `
      <li class="resumen-fin-proveedor-fila">
        <span class="resumen-fin-proveedor-nombre" data-tooltip="${escapeHtml(f.nombre)}" tabindex="0">${escapeHtml(f.nombre)}</span>
        <div class="resumen-fin-proveedor-barra-wrap">
          <span class="resumen-fin-proveedor-barra" style="width:${(f.cantidad_vendida_90d / maximo) * 100}%;background:${color}"></span>
        </div>
        <span class="resumen-fin-proveedor-monto">${f.cantidad_vendida_90d} venta${f.cantidad_vendida_90d === 1 ? '' : 's'}</span>
      </li>`
      )
      .join('');
  }

  function renderInvEstadoRankLista(el, filas, color) {
    if (!filas || filas.length === 0) {
      el.innerHTML = '';
      return;
    }
    const maximo = Math.max(...filas.map((f) => f.unidades_vendidas_90d), 1);
    el.innerHTML = filas
      .map(
        (f) => `
      <li class="resumen-fin-proveedor-fila">
        <span class="resumen-fin-proveedor-nombre" data-tooltip="${escapeHtml(f.nombre)}" tabindex="0">${escapeHtml(f.nombre)}</span>
        <div class="resumen-fin-proveedor-barra-wrap">
          <span class="resumen-fin-proveedor-barra" style="width:${(f.unidades_vendidas_90d / maximo) * 100}%;background:${color}"></span>
        </div>
        <span class="resumen-fin-proveedor-monto">${f.unidades_vendidas_90d} pz</span>
      </li>`
      )
      .join('');
  }

  function renderInvEstadoRank(top, bottom) {
    if (top.length === 0 && bottom.length === 0) {
      els.invEstadoTopLista.innerHTML = '';
      els.invEstadoBottomLista.innerHTML = '';
      els.invEstadoRankEmpty.hidden = false;
      return;
    }
    els.invEstadoRankEmpty.hidden = true;
    renderInvEstadoRankLista(els.invEstadoTopLista, top, INV_ESTADO_COLOR_TOP);
    renderInvEstadoRankLista(els.invEstadoBottomLista, bottom, INV_ESTADO_COLOR_BOTTOM);
  }

  function renderInvEstadoRotacion(filas, promedioCatalogo) {
    if (!filas || filas.length === 0) {
      els.invEstadoRotacionLista.innerHTML = '';
      els.invEstadoRotacionLinea.hidden = true;
      els.invEstadoRotacionCaption.textContent = '';
      els.invEstadoRotacionEmpty.hidden = false;
      return;
    }
    els.invEstadoRotacionEmpty.hidden = true;
    const maximo = Math.max(...filas.map((f) => f.rotacion), promedioCatalogo, 1);
    els.invEstadoRotacionLista.innerHTML = filas
      .map((f) => {
        // Agotamiento estimado: existencia ÷ ritmo diario de venta
        // (unidades_vendidas_90d/90) — misma aproximación honesta que ya
        // usa esta gráfica, no rotación contable real.
        const diasAgotamiento = f.unidades_vendidas_90d > 0 ? Math.round(f.existencia_actual / (f.unidades_vendidas_90d / 90)) : null;
        return `
      <li class="resumen-fin-proveedor-fila">
        <span class="resumen-fin-proveedor-nombre" data-tooltip="${escapeHtml(f.nombre)}${diasAgotamiento !== null ? ` — agotamiento ~${diasAgotamiento}d` : ''}" tabindex="0">${escapeHtml(f.nombre)}</span>
        <div class="resumen-fin-proveedor-barra-wrap">
          <span class="resumen-fin-proveedor-barra" style="width:${(f.rotacion / maximo) * 100}%"></span>
        </div>
        <span class="resumen-fin-proveedor-monto">${f.rotacion.toFixed(1)}×</span>
      </li>`;
      })
      .join('');
    // Track de la barra: arranca en 140px (columna de nombre) + 12px
    // (gap), y termina 56px + 12px antes del borde derecho (columna de
    // valor) — mismo layout fijo que la regla CSS
    // "#inv-estado-rotacion-lista .resumen-fin-proveedor-fila". Evita
    // medir el DOM (getBoundingClientRect) para algo que ya es fijo por
    // CSS.
    const fraccion = Math.min(promedioCatalogo / maximo, 1);
    els.invEstadoRotacionLinea.hidden = false;
    els.invEstadoRotacionLinea.style.left = `calc(152px + ${fraccion} * (100% - 220px))`;
    els.invEstadoRotacionCaption.textContent = `Promedio del catálogo: ${promedioCatalogo.toFixed(1)}×`;
  }

  function renderInvEstadoDonutCategoria(filas) {
    if (!filas || filas.length === 0) {
      els.invEstadoDonutCategoria.innerHTML = '';
      els.invEstadoDonutCategoriaLeyenda.innerHTML = '';
      els.invEstadoDonutCategoriaTotal.textContent = '$0';
      els.invEstadoDonutCategoriaEmpty.hidden = false;
      return;
    }
    els.invEstadoDonutCategoriaEmpty.hidden = true;
    const segmentos = filas.map((f, i) => ({
      valor: f.valor,
      color: INV_ESTADO_COLORES_DONUT[i % INV_ESTADO_COLORES_DONUT.length],
    }));
    const total = renderDonutGenerico(els.invEstadoDonutCategoria, segmentos);
    els.invEstadoDonutCategoriaTotal.textContent = `$${formatearMoneda(total)}`;
    els.invEstadoDonutCategoriaLeyenda.innerHTML = filas
      .map((f, i) => {
        const color = INV_ESTADO_COLORES_DONUT[i % INV_ESTADO_COLORES_DONUT.length];
        const porcentaje = total > 0 ? Math.round((f.valor / total) * 100) : 0;
        return `<li><span class="resumen-fin-donut-dot" style="background:${color}" aria-hidden="true"></span><span>${escapeHtml(f.categoria_nombre)}</span><strong>$${formatearMoneda(f.valor)} (${porcentaje}%)</strong></li>`;
      })
      .join('');
  }

  function renderInvEstadoCobertura(cobertura) {
    if (!cobertura || cobertura.total_productos === 0) {
      els.invEstadoCoberturaBarra.innerHTML = '';
      els.invEstadoCoberturaLeyenda.innerHTML = '';
      els.invEstadoCoberturaEmpty.hidden = false;
      return;
    }
    els.invEstadoCoberturaEmpty.hidden = true;
    const segmentos = [
      { etiqueta: 'En riesgo (<7 días)', color: INV_ESTADO_COLOR_RIESGO, dato: cobertura.riesgo },
      { etiqueta: 'Saludable (7-60 días)', color: INV_ESTADO_COLOR_SALUDABLE, dato: cobertura.saludable },
      { etiqueta: 'Sobrestock (>60 días o sin ventas)', color: INV_ESTADO_COLOR_SOBRESTOCK, dato: cobertura.sobrestock },
    ];
    els.invEstadoCoberturaBarra.innerHTML = segmentos
      .filter((s) => s.dato.porcentaje > 0)
      .map((s) => `<span style="width:${s.dato.porcentaje}%;background:${s.color}" data-tooltip="${escapeHtml(s.etiqueta)}: ${s.dato.porcentaje}%"></span>`)
      .join('');
    els.invEstadoCoberturaLeyenda.innerHTML = segmentos
      .map(
        (s) =>
          `<li><span class="resumen-fin-donut-dot" style="background:${s.color}" aria-hidden="true"></span><span>${escapeHtml(s.etiqueta)}</span><strong>${s.dato.productos} (${s.dato.porcentaje}%)</strong></li>`
      )
      .join('');
  }

  const INV_ESTADO_CLASIFICACION_TEXTO = {
    riesgo: 'En riesgo (<7 días)',
    saludable: 'Saludable (7-60 días)',
    sobrestock: 'Sobrestock (>60 días o sin ventas)',
  };
  // Reusa las 3 insignias de estatus ya existentes en el sitio (mismo
  // criterio de colores que la barra de Cobertura de arriba) en vez de
  // inventar una paleta nueva para esta tabla.
  const INV_ESTADO_CLASIFICACION_CLASE = {
    riesgo: 'estatus-pendiente',
    saludable: 'estatus-listo',
    sobrestock: 'estatus-en-curso',
  };

  // Punto 271: muestra de auditoría — primeros 10 productos del catálogo
  // valorizado (ya viene ordenado por valor desc desde el backend), con
  // "Gestionar" abriendo el modal real de edición de producto.
  function renderInvEstadoMatriz(filas) {
    if (!els.invEstadoMatrizBody) return;
    if (!filas || filas.length === 0) {
      els.invEstadoMatrizBody.innerHTML = '';
      if (els.invEstadoMatrizEmpty) els.invEstadoMatrizEmpty.hidden = false;
      return;
    }
    if (els.invEstadoMatrizEmpty) els.invEstadoMatrizEmpty.hidden = true;
    els.invEstadoMatrizBody.innerHTML = filas
      .slice(0, 10)
      .map(
        (f) => `
      <tr>
        <td>${escapeHtml(f.nombre)}</td>
        <td>${f.existencia_actual} pz</td>
        <td><span class="estatus-badge ${INV_ESTADO_CLASIFICACION_CLASE[f.clasificacion] || ''}">${escapeHtml(INV_ESTADO_CLASIFICACION_TEXTO[f.clasificacion] || f.clasificacion)}</span></td>
        <td data-producto-id="${f.producto_id}"></td>
      </tr>`
      )
      .join('');
    els.invEstadoMatrizBody.querySelectorAll('td[data-producto-id]').forEach((celda) => {
      const productoId = Number(celda.dataset.productoId);
      celda.appendChild(botonAccionInv({ tooltip: 'Gestionar', icono: ICONO_EDITAR, onClick: () => gestionarProductoDesdeMatriz(productoId) }));
    });
  }

  async function gestionarProductoDesdeMatriz(productoId) {
    const authHeader = getAuthHeader();
    if (!authHeader || !productoId) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/productos/${productoId}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) { showToast('No se pudo abrir el producto', 'error'); return; }
      const data = await res.json();
      abrirProductoModal(data.producto);
    } catch (err) {
      showToast('No se pudo abrir el producto', 'error');
    }
  }

  function exportarEstadoInventarioCsv() {
    const filas = (estadoInventarioCache && estadoInventarioCache.valuacion_detalle) || [];
    if (filas.length === 0) { showToast('No hay datos para exportar', 'error'); return; }
    const csvCelda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const encabezado = ['Producto', 'SKU', 'Categoría', 'Existencia', 'Costo promedio', 'Valor', 'Vendidas (90d)', 'Días de cobertura', 'Clasificación'];
    const lineas = filas.map((f) =>
      [
        f.nombre, f.sku || '', f.categoria_nombre || '', f.existencia_actual,
        Number(f.costo_promedio).toFixed(2), Number(f.valor).toFixed(2), f.unidades_vendidas_90d,
        f.dias_cobertura === null ? '' : f.dias_cobertura,
        INV_ESTADO_CLASIFICACION_TEXTO[f.clasificacion] || f.clasificacion,
      ]
        .map(csvCelda)
        .join(',')
    );
    const csv = [encabezado.map(csvCelda).join(','), ...lineas].join('\r\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estado-inventario-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Imprimir: mismo criterio que #corte-imprimir (JS llena el contenedor
  // justo antes de window.print(), único visible dentro de @media print).
  function imprimirEstadoInventario() {
    if (!els.invEstadoImprimir || !estadoInventarioCache) { showToast('Espera a que cargue el reporte', 'error'); return; }
    const kpis = estadoInventarioCache.kpis || {};
    const filas = (estadoInventarioCache.valuacion_detalle || []).slice(0, 10);
    els.invEstadoImprimir.innerHTML = `
      <div class="corte-imprimir-titulo">Estado del inventario</div>
      <div class="corte-imprimir-rango">Generado el ${new Date().toLocaleString('es-MX')}</div>
      <div class="corte-imprimir-resumen">
        <div><span>Valor total en existencia</span><span>$${formatearMoneda(kpis.valor_total_existencia || 0)}</span></div>
        <div><span>Rotación promedio</span><span>${Number(kpis.rotacion_promedio_catalogo || 0).toFixed(1)}×</span></div>
        <div><span>Sin movimiento (90d)</span><span>${kpis.productos_sin_movimiento_90d || 0}</span></div>
        <div><span>Salud del catálogo</span><span>${Number(kpis.salud_catalogo_pct || 0).toFixed(1)}%</span></div>
      </div>
      <table class="corte-imprimir-tabla">
        <thead><tr><th>Producto</th><th>Existencia</th><th>Valor</th><th>Clasificación</th></tr></thead>
        <tbody>${filas
          .map(
            (f) => `<tr><td>${escapeHtml(f.nombre)}</td><td>${f.existencia_actual}</td><td>$${formatearMoneda(f.valor)}</td><td>${escapeHtml(INV_ESTADO_CLASIFICACION_TEXTO[f.clasificacion] || f.clasificacion)}</td></tr>`
          )
          .join('')}</tbody>
      </table>`;
    window.print();
  }

  // Detalle grande de una gráfica de "Resumen financiero": en vez de
  // duplicar la lógica de render para una versión "grande", se reubica
  // el MISMO contenedor ya renderizado (con sus datos reales) dentro del
  // modal, y se regresa a su lugar original al cerrar — mismo criterio
  // que ya usa el modal "Gestionar" de tickets (btn-icon + modal-overlay
  // + cierre por click fuera/Escape/botón), pero sin necesidad de volver
  // a pintar nada: el tamaño más grande lo da la clase
  // resumen-fin-detalle-contenido-grande en admin.css.
  let detalleGraficaOrigen = null;

  function abrirDetalleGrafica(boton) {
    const contenedor = document.getElementById(boton.dataset.detalleContenido || '');
    if (!contenedor) return;
    const header = boton.closest('.resumen-fin-card-header');
    const iconoOrigen = header ? header.querySelector('.inicio-stat-icono') : null;

    detalleGraficaOrigen = {
      contenedor,
      padre: contenedor.parentNode,
      siguiente: contenedor.nextSibling,
    };

    els.resumenFinDetalleTitulo.textContent = boton.dataset.detalleTitulo || 'Detalle';
    els.resumenFinDetalleIcono.className = iconoOrigen ? iconoOrigen.className : 'inicio-stat-icono';
    els.resumenFinDetalleIcono.innerHTML = iconoOrigen ? iconoOrigen.innerHTML : '';

    contenedor.classList.add('resumen-fin-detalle-contenido-grande');
    els.resumenFinDetalleBody.appendChild(contenedor);
    els.resumenFinDetalleOverlay.hidden = false;
    els.btnResumenFinDetalleCerrar.focus();
  }

  // "Utilidad neta mensual" es la única tarjeta con una vista de detalle
  // DISTINTA a la chica (a pedido explícito del usuario) — las demás
  // reparentan el mismo nodo (abrirDetalleGrafica de arriba); esta arma
  // HTML nuevo cada vez que se abre, así que al cerrar no hay nodo que
  // devolver, solo vaciar y quitar el modificador de ancho.
  let detalleEsRico = false;

  function cerrarDetalleGrafica() {
    if (els.resumenFinDetalleOverlay.hidden) return;
    if (detalleEsRico) {
      els.resumenFinDetalleBody.innerHTML = '';
      if (els.resumenFinDetalleModal) els.resumenFinDetalleModal.classList.remove('resumen-fin-detalle-modal-ancha');
      detalleEsRico = false;
    } else if (detalleGraficaOrigen) {
      const { contenedor, padre, siguiente } = detalleGraficaOrigen;
      contenedor.classList.remove('resumen-fin-detalle-contenido-grande');
      if (siguiente) {
        padre.insertBefore(contenedor, siguiente);
      } else {
        padre.appendChild(contenedor);
      }
      detalleGraficaOrigen = null;
    }
    els.resumenFinDetalleOverlay.hidden = true;
    // La leyenda-filtro no guarda estado entre aperturas — siempre arranca
    // con las 4 series visibles la próxima vez que se abra el modal.
    resetearLeyendaFiltroChart();
  }

  // Leyenda de "Ventas vs Facturado vs Gastos" como filtro — SOLO
  // funciona en la tarjeta chica Y en la ventana emergente (mismo nodo del
  // DOM en ambas — homologado con stitch/VentasVsMini, que trae los
  // filtros interactivos directo en la mini). Se resetea a las 4 series
  // visibles cada vez que se abre/cierra el modal, para no dejar una
  // combinación rara oculta entre sesiones.
  function resetearLeyendaFiltroChart() {
    if (!els.resumenFinChartLeyendaFiltrable) return;
    els.resumenFinChartLeyendaFiltrable.querySelectorAll('li').forEach((li) => {
      li.classList.remove('resumen-fin-serie-apagada');
      li.setAttribute('aria-pressed', 'false');
    });
    els.resumenFinChartBody.querySelectorAll('.resumen-fin-chart-barra').forEach((barra) => {
      barra.classList.remove('resumen-fin-barra-oculta');
    });
  }

  if (els.resumenFinChartLeyendaFiltrable) {
    const itemsLeyendaChart = els.resumenFinChartLeyendaFiltrable.querySelectorAll('li');
    itemsLeyendaChart.forEach((li) => {
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-pressed', 'false');
      const alternarSerie = () => {
        const serie = li.dataset.serie;
        const apagada = li.classList.toggle('resumen-fin-serie-apagada');
        li.setAttribute('aria-pressed', String(apagada));
        els.resumenFinChartBody.querySelectorAll(`.resumen-fin-chart-barra-${serie}`).forEach((barra) => {
          barra.classList.toggle('resumen-fin-barra-oculta', apagada);
        });
      };
      li.addEventListener('click', alternarSerie);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          alternarSerie();
        }
      });
    });
  }

  // ---------- Vista rica de "Utilidad neta mensual" (solo el modal) ----------
  // La tarjeta chica (renderResumenFinUtilidadMensual, arriba) se queda
  // simple a propósito. Esta sección arma, SOLO al abrir el modal, la
  // versión con KPIs/tooltip rico/tabla/toggle línea-barras/exportar CSV
  // — con datos 100% reales de cacheSerieUtilidadNeta, sin re-pedir el
  // endpoint. Nada de lo que muestra es inventado: cada número sale de
  // serie_mensual (mismo que ya usa la tarjeta chica).
  let cacheMesActualUtilidadNeta = null;
  // "Proyección de ventas" rica (solo el modal, ver más abajo) — mismos
  // 3 caches que utilidad neta arriba, con su propio nombre para no
  // acoplar ambas tarjetas aunque compartan la misma serie_mensual.
  let cacheSerieProyeccionReal = null;
  let cacheProyeccionVentas = null;
  let cacheMesActualVentasTotal = null;

  function unmEscalaMaxima(valor) {
    if (!(valor > 0)) return 100;
    const magnitud = Math.pow(10, Math.floor(Math.log10(valor)));
    const pasos = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (const p of pasos) {
      if (valor <= magnitud * p) return magnitud * p;
    }
    return magnitud * 10;
  }

  function unmMediana(valores) {
    if (!valores.length) return null;
    const ordenado = [...valores].sort((a, b) => a - b);
    const mitad = Math.floor(ordenado.length / 2);
    return ordenado.length % 2 !== 0 ? ordenado[mitad] : (ordenado[mitad - 1] + ordenado[mitad]) / 2;
  }

  function unmConstruirHTML() {
    return `
      <div class="unm-kpis">
        <div class="unm-kpi">
          <div class="unm-kpi-top"><span id="unm-kpi-acumulado-titulo">Acumulado</span></div>
          <div class="unm-kpi-val" id="unm-kpi-acumulado">—</div>
          <p class="unm-kpi-note" id="unm-kpi-acumulado-nota"></p>
        </div>
        <div class="unm-kpi">
          <div class="unm-kpi-top"><span>Promedio mensual</span><span class="unm-kpi-top-note" id="unm-kpi-mediana-nota"></span></div>
          <div class="unm-kpi-val" id="unm-kpi-promedio">—</div>
          <p class="unm-kpi-note" id="unm-kpi-margen-promedio-nota"></p>
        </div>
        <div class="unm-kpi unm-kpi-pos">
          <div class="unm-kpi-top"><span id="unm-kpi-max-titulo">Máximo del periodo</span><span class="unm-badge unm-badge-pos">Récord</span></div>
          <div class="unm-kpi-val unm-c-pos" id="unm-kpi-max">—</div>
          <p class="unm-kpi-note unm-c-pos" id="unm-kpi-max-margen-nota"></p>
        </div>
        <div class="unm-kpi" id="unm-kpi-actual-card">
          <div class="unm-kpi-top"><span id="unm-kpi-actual-titulo">Cierre del último mes</span><span class="unm-badge" id="unm-kpi-actual-mom"></span></div>
          <div class="unm-kpi-val" id="unm-kpi-actual">—</div>
          <p class="unm-kpi-note" id="unm-kpi-actual-nota"></p>
        </div>
      </div>
      <div class="unm-stage">
        <p class="unm-banner" id="unm-banner-parcial" hidden><span class="unm-banner-ic">i</span><span id="unm-banner-texto"></span></p>
        <div class="unm-toolbar">
          <div class="unm-seg" role="tablist" aria-label="Tipo de gráfica">
            <button type="button" class="is-active" id="unm-btn-linea" role="tab" aria-selected="true">Línea</button>
            <button type="button" id="unm-btn-barras" role="tab" aria-selected="false">Barras</button>
          </div>
          <button type="button" class="unm-btn-export" id="unm-btn-exportar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v13m0 0l-4-4m4 4l4-4M4 21h16" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Exportar CSV
          </button>
        </div>
        <div class="unm-chart-wrap" id="unm-chart-wrap">
          <svg class="unm-svg" id="unm-svg" viewBox="0 0 1000 400" preserveAspectRatio="none" role="img" aria-label="Utilidad neta mensual, vista detallada"></svg>
          <div class="unm-tooltip" id="unm-tooltip" hidden></div>
        </div>
        <p class="admin-empty" id="unm-empty" hidden>Aún no hay suficientes datos para esta gráfica.</p>
      </div>
      <div class="unm-tabla-wrap" id="unm-tabla-wrap">
        <div class="unm-tabla-head">
          <h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/></svg> Desglose mensual</h3>
          <span class="unm-tabla-nota">Ingresos = ventas sin IVA (mismo criterio que "Utilidad neta del mes")</span>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table unm-tabla">
            <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Utilidad neta</th><th>Margen %</th><th>Variación</th></tr></thead>
            <tbody id="unm-tabla-body"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  function abrirDetalleUtilidadNetaRica() {
    const origenBoton = document.querySelector('[data-detalle-contenido="resumen-fin-balance-contenido"]');
    const header = origenBoton ? origenBoton.closest('.resumen-fin-card-header') : null;
    const iconoOrigen = header ? header.querySelector('.inicio-stat-icono') : null;
    els.resumenFinDetalleTitulo.textContent = 'Utilidad neta mensual';
    els.resumenFinDetalleIcono.className = iconoOrigen ? iconoOrigen.className : 'inicio-stat-icono';
    els.resumenFinDetalleIcono.innerHTML = iconoOrigen ? iconoOrigen.innerHTML : '';

    detalleEsRico = true;
    if (els.resumenFinDetalleModal) els.resumenFinDetalleModal.classList.add('resumen-fin-detalle-modal-ancha');
    els.resumenFinDetalleBody.innerHTML = unmConstruirHTML();
    els.resumenFinDetalleOverlay.hidden = false;
    unmPintar(cacheSerieUtilidadNeta);
    els.btnResumenFinDetalleCerrar.focus();
  }

  function unmPintar(serieOriginal) {
    const serie = serieOriginal || [];
    const svg = document.getElementById('unm-svg');
    const chartWrap = document.getElementById('unm-chart-wrap');
    const tooltip = document.getElementById('unm-tooltip');
    const empty = document.getElementById('unm-empty');
    const tablaBody = document.getElementById('unm-tabla-body');
    const tablaWrap = document.getElementById('unm-tabla-wrap');
    const banner = document.getElementById('unm-banner-parcial');

    if (!serie.length) {
      empty.hidden = false;
      document.getElementById('unm-chart-wrap').hidden = true;
      tablaWrap.hidden = true;
      document.querySelector('.unm-toolbar').hidden = true;
      return;
    }

    // ¿El último mes de la serie es el mes en curso (parcial)? Se detecta
    // comparando contra mes_actual.utilidad_neta (fuente autoritativa de
    // "este mes real ahora mismo") en vez de comparar etiquetas de mes —
    // ambos usan la MISMA fórmula/ventana en el backend, así que coinciden
    // exactamente cuando de verdad es el mismo mes.
    const ultimo = serie[serie.length - 1];
    const esMesEnCursoElUltimo =
      cacheMesActualUtilidadNeta !== null &&
      Math.abs(ultimo.utilidad_neta - cacheMesActualUtilidadNeta) < 0.005;
    const mesesCerrados = esMesEnCursoElUltimo ? serie.slice(0, -1) : serie.slice();

    // ---- KPIs ----
    const valores = serie.map((m) => m.utilidad_neta);
    const acumulado = valores.reduce((a, b) => a + b, 0);
    document.getElementById('unm-kpi-acumulado-titulo').textContent = `Acumulado (${serie.length} ${serie.length === 1 ? 'mes' : 'meses'})`;
    document.getElementById('unm-kpi-acumulado').textContent = `$${formatearMoneda(acumulado)}`;
    document.getElementById('unm-kpi-acumulado-nota').textContent = esMesEnCursoElUltimo
      ? `Incluye ${ultimo.mes} (parcial)`
      : 'Suma de los meses mostrados';

    const valoresCerrados = mesesCerrados.map((m) => m.utilidad_neta);
    if (valoresCerrados.length) {
      const promedio = valoresCerrados.reduce((a, b) => a + b, 0) / valoresCerrados.length;
      const mediana = unmMediana(valoresCerrados);
      document.getElementById('unm-kpi-promedio').textContent = `$${formatearMoneda(promedio)}`;
      document.getElementById('unm-kpi-mediana-nota').textContent = `Mediana: ${formatearMonedaCompacta(mediana)}`;
      const margenesCerrados = mesesCerrados
        .filter((m) => m.subtotal > 0)
        .map((m) => (m.utilidad_neta / m.subtotal) * 100);
      const margenProm = margenesCerrados.length ? margenesCerrados.reduce((a, b) => a + b, 0) / margenesCerrados.length : null;
      document.getElementById('unm-kpi-margen-promedio-nota').textContent =
        margenProm !== null ? `Margen promedio: ${margenProm.toFixed(1)}% · solo meses cerrados` : 'Solo meses cerrados';
    } else {
      document.getElementById('unm-kpi-promedio').textContent = '—';
      document.getElementById('unm-kpi-mediana-nota').textContent = '';
      document.getElementById('unm-kpi-margen-promedio-nota').textContent = 'Sin meses cerrados todavía';
    }

    let indiceMax = 0;
    valores.forEach((v, i) => { if (v > valores[indiceMax]) indiceMax = i; });
    const mesMax = serie[indiceMax];
    const margenMax = mesMax.subtotal > 0 ? (mesMax.utilidad_neta / mesMax.subtotal) * 100 : null;
    document.getElementById('unm-kpi-max-titulo').textContent = `Máximo del periodo (${mesMax.mes})`;
    document.getElementById('unm-kpi-max').textContent = `$${formatearMoneda(mesMax.utilidad_neta)}`;
    document.getElementById('unm-kpi-max-margen-nota').textContent =
      margenMax !== null ? `Margen neto ese mes: ${margenMax.toFixed(1)}%` : 'Sin ventas ese mes para calcular margen';

    const anterior = serie.length > 1 ? serie[serie.length - 2] : null;
    const momActual = anterior && anterior.utilidad_neta !== 0
      ? ((ultimo.utilidad_neta - anterior.utilidad_neta) / Math.abs(anterior.utilidad_neta)) * 100
      : null;
    document.getElementById('unm-kpi-actual-titulo').textContent = esMesEnCursoElUltimo ? `Cierre actual (${ultimo.mes})` : `Último mes (${ultimo.mes})`;
    document.getElementById('unm-kpi-actual').textContent = `$${formatearMoneda(ultimo.utilidad_neta)}`;
    const badgeActual = document.getElementById('unm-kpi-actual-mom');
    const cardActual = document.getElementById('unm-kpi-actual-card');
    const notaActual = document.getElementById('unm-kpi-actual-nota');
    if (momActual !== null) {
      badgeActual.textContent = `${momActual >= 0 ? '+' : ''}${momActual.toFixed(1)}% MoM`;
      badgeActual.className = `unm-badge ${momActual >= 0 ? 'unm-badge-pos' : 'unm-badge-neg'}`;
    } else {
      badgeActual.textContent = '';
      badgeActual.className = 'unm-badge';
    }
    cardActual.classList.toggle('unm-kpi-neg', esMesEnCursoElUltimo || (momActual !== null && momActual < 0));
    document.getElementById('unm-kpi-actual').className = `unm-kpi-val ${cardActual.classList.contains('unm-kpi-neg') ? 'unm-c-neg' : ''}`;
    notaActual.className = `unm-kpi-note ${cardActual.classList.contains('unm-kpi-neg') ? 'unm-c-neg' : ''}`;
    notaActual.textContent = esMesEnCursoElUltimo ? 'Cierre preliminar en curso' : '';

    // ---- Aviso honesto (reemplaza la "anomalía" inventada del mockup) ----
    if (esMesEnCursoElUltimo) {
      banner.hidden = false;
      document.getElementById('unm-banner-texto').innerHTML =
        `<b>${escapeHtml(ultimo.mes)} es el mes en curso:</b> la cifra (${formatearMonedaCompacta(ultimo.utilidad_neta)}) es parcial — se actualiza a diario conforme se registran ventas y gastos, no es un cierre final.`;
    } else {
      banner.hidden = true;
    }

    // ---- Gráfica ----
    document.getElementById('unm-chart-wrap').hidden = false;
    tablaWrap.hidden = false;
    document.querySelector('.unm-toolbar').hidden = false;
    empty.hidden = true;
    unmPintarSVG(svg, tooltip, chartWrap, serie, indiceMax, esMesEnCursoElUltimo, valoresCerrados);

    // ---- Tabla ----
    tablaBody.innerHTML = serie.map((m, i) => {
      const margen = m.subtotal > 0 ? (m.utilidad_neta / m.subtotal) * 100 : null;
      const prev = i > 0 ? serie[i - 1] : null;
      const variacion = prev && prev.utilidad_neta !== 0
        ? ((m.utilidad_neta - prev.utilidad_neta) / Math.abs(prev.utilidad_neta)) * 100
        : null;
      const esUltimoParcial = esMesEnCursoElUltimo && i === serie.length - 1;
      const esMaxRow = i === indiceMax;
      const claseFila = esUltimoParcial ? 'unm-row-actual' : esMaxRow ? 'unm-row-max' : '';
      const variacionTxt = i === 0 ? '— (Base)' : variacion === null ? '—' : `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}%`;
      const variacionClase = variacion === null ? '' : variacion >= 0 ? 'unm-c-pos' : 'unm-c-neg';
      return `<tr class="${claseFila}">
        <td class="unm-mes-cell">${esMaxRow ? '<span class="unm-mes-dot" style="background:#1FAE6B"></span>' : ''}${esUltimoParcial ? '<span class="unm-mes-dot" style="background:#B3261E"></span>' : ''}${escapeHtml(m.mes)}${esUltimoParcial ? '*' : ''}</td>
        <td>$${formatearMoneda(m.subtotal)}</td>
        <td>$${formatearMoneda(m.gastos)}</td>
        <td style="font-weight:700;">$${formatearMoneda(m.utilidad_neta)}</td>
        <td>${margen === null ? '—' : margen.toFixed(1) + '%'}</td>
        <td class="${variacionClase}" style="font-weight:600;">${variacionTxt}</td>
      </tr>`;
    }).join('');

    // ---- Toggle línea/barras ----
    const btnLinea = document.getElementById('unm-btn-linea');
    const btnBarras = document.getElementById('unm-btn-barras');
    btnLinea.onclick = () => {
      btnLinea.classList.add('is-active'); btnLinea.setAttribute('aria-selected', 'true');
      btnBarras.classList.remove('is-active'); btnBarras.setAttribute('aria-selected', 'false');
      svg.classList.remove('unm-modo-barras');
    };
    btnBarras.onclick = () => {
      btnBarras.classList.add('is-active'); btnBarras.setAttribute('aria-selected', 'true');
      btnLinea.classList.remove('is-active'); btnLinea.setAttribute('aria-selected', 'false');
      svg.classList.add('unm-modo-barras');
    };

    // ---- Exportar CSV (100% client-side, mismos datos ya en pantalla) ----
    document.getElementById('unm-btn-exportar').onclick = () => {
      const encabezados = ['Mes', 'Ingresos (sin IVA)', 'Gastos', 'Utilidad neta', 'Margen %', 'Variación MoM %'];
      const filas = serie.map((m, i) => {
        const margen = m.subtotal > 0 ? ((m.utilidad_neta / m.subtotal) * 100).toFixed(1) : '';
        const prev = i > 0 ? serie[i - 1] : null;
        const variacion = prev && prev.utilidad_neta !== 0
          ? (((m.utilidad_neta - prev.utilidad_neta) / Math.abs(prev.utilidad_neta)) * 100).toFixed(1)
          : '';
        return [m.mes, m.subtotal.toFixed(2), m.gastos.toFixed(2), m.utilidad_neta.toFixed(2), margen, variacion];
      });
      const csv = [encabezados, ...filas]
        .map((fila) => fila.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'utilidad-neta-mensual.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
  }

  function unmPosicionEnPantalla(svg, contenedor, x, y) {
    const punto = svg.createSVGPoint();
    punto.x = x;
    punto.y = y;
    const enPantalla = punto.matrixTransform(svg.getScreenCTM());
    const rectContenedor = contenedor.getBoundingClientRect();
    return { left: enPantalla.x - rectContenedor.left, top: enPantalla.y - rectContenedor.top };
  }

  function unmPintarSVG(svg, tooltip, chartWrap, serie, indiceMax, esMesEnCursoElUltimo, valoresCerrados) {
    svg.innerHTML = '';
    svg.classList.remove('unm-modo-barras');
    document.getElementById('unm-btn-linea').classList.add('is-active');
    document.getElementById('unm-btn-linea').setAttribute('aria-selected', 'true');
    document.getElementById('unm-btn-barras').classList.remove('is-active');
    document.getElementById('unm-btn-barras').setAttribute('aria-selected', 'false');

    const valores = serie.map((m) => m.utilidad_neta);
    const maxAbs = Math.max(1, ...valores.map((v) => Math.abs(v)));
    const yMax = unmEscalaMaxima(maxAbs);
    const X0 = 70, X1 = 960, Y0 = 40, Y1 = 365, ALTO = Y1 - Y0;
    const yFor = (v) => Y1 - (v / yMax) * ALTO;
    const n = serie.length;
    const xFor = (i) => (n <= 1 ? (X0 + X1) / 2 : X0 + 40 + ((X1 - X0 - 80) * i) / (n - 1));

    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = `
      <linearGradient id="unmAreaFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#03285B" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#03285B" stop-opacity="0"/>
      </linearGradient>
      <filter id="unmGlowP" height="160%" width="160%" x="-30%" y="-30%">
        <feDropShadow dx="0" dy="3" flood-color="#1FAE6B" flood-opacity="0.45" stdDeviation="4"/>
      </filter>
      <filter id="unmGlowN" height="160%" width="160%" x="-30%" y="-30%">
        <feDropShadow dx="0" dy="3" flood-color="#B3261E" flood-opacity="0.4" stdDeviation="4"/>
      </filter>
    `;
    svg.appendChild(defs);

    // Gridlines (5 franjas desde 0 hasta yMax, redondeado a un número
    // "bonito" por unmEscalaMaxima) + línea $0 remarcada.
    for (let i = 0; i <= 5; i++) {
      const val = (yMax * i) / 5;
      const y = yFor(val);
      const linea = document.createElementNS(SVG_NS, 'line');
      linea.setAttribute('x1', X0); linea.setAttribute('x2', X1);
      linea.setAttribute('y1', y); linea.setAttribute('y2', y);
      linea.setAttribute('class', i === 0 ? 'unm-linea-base' : 'unm-linea-grid');
      svg.appendChild(linea);
      const texto = document.createElementNS(SVG_NS, 'text');
      texto.setAttribute('x', X0 - 10); texto.setAttribute('y', y + 4);
      texto.setAttribute('text-anchor', 'end');
      texto.setAttribute('class', i === 0 ? 'unm-texto-base' : 'unm-texto-grid');
      texto.textContent = i === 0 ? '$0' : `${formatearMonedaCompacta(val)}`;
      svg.appendChild(texto);
    }

    // Línea de promedio de meses cerrados (referencia, mismo dato del KPI).
    if (valoresCerrados.length) {
      const promedio = valoresCerrados.reduce((a, b) => a + b, 0) / valoresCerrados.length;
      const yProm = yFor(promedio);
      const lineaProm = document.createElementNS(SVG_NS, 'line');
      lineaProm.setAttribute('x1', X0); lineaProm.setAttribute('x2', X1);
      lineaProm.setAttribute('y1', yProm); lineaProm.setAttribute('y2', yProm);
      lineaProm.setAttribute('class', 'unm-linea-promedio');
      svg.appendChild(lineaProm);
      const textoProm = document.createElementNS(SVG_NS, 'text');
      textoProm.setAttribute('x', X1); textoProm.setAttribute('y', yProm - 6);
      textoProm.setAttribute('text-anchor', 'end');
      textoProm.setAttribute('class', 'unm-texto-promedio');
      textoProm.textContent = `Promedio (cerrados): ${formatearMonedaCompacta(promedio)}`;
      svg.appendChild(textoProm);
    }

    const puntos = serie.map((m, i) => ({ x: xFor(i), y: yFor(m.utilidad_neta) }));

    // ---- Grupo LÍNEA (área + trazo + guías) ----
    const gLinea = document.createElementNS(SVG_NS, 'g');
    gLinea.setAttribute('class', 'unm-g-linea');
    if (puntos.length > 1) {
      const areaPts = `${puntos.map((p) => `${p.x},${p.y}`).join(' ')} ${puntos[puntos.length - 1].x},${Y1} ${puntos[0].x},${Y1}`;
      const area = document.createElementNS(SVG_NS, 'polygon');
      area.setAttribute('points', areaPts);
      area.setAttribute('fill', 'url(#unmAreaFill)');
      gLinea.appendChild(area);

      const trazo = document.createElementNS(SVG_NS, 'polyline');
      trazo.setAttribute('points', puntos.map((p) => `${p.x},${p.y}`).join(' '));
      trazo.setAttribute('class', 'unm-trazo');
      gLinea.appendChild(trazo);
    }
    // Guías verticales punteadas al máximo y al mes actual (si aplica).
    [indiceMax, esMesEnCursoElUltimo ? puntos.length - 1 : -1].forEach((idx, k) => {
      if (idx < 0 || (k === 1 && idx === indiceMax)) return;
      const guia = document.createElementNS(SVG_NS, 'line');
      guia.setAttribute('x1', puntos[idx].x); guia.setAttribute('x2', puntos[idx].x);
      guia.setAttribute('y1', puntos[idx].y); guia.setAttribute('y2', Y1);
      guia.setAttribute('class', k === 0 ? 'unm-guia-max' : 'unm-guia-actual');
      gLinea.appendChild(guia);
    });
    svg.appendChild(gLinea);

    // ---- Grupo BARRAS (oculto por defecto vía CSS .unm-modo-barras) ----
    const gBarras = document.createElementNS(SVG_NS, 'g');
    gBarras.setAttribute('class', 'unm-g-barras');
    const anchoBarra = Math.min(46, ((X1 - X0 - 80) / Math.max(1, n)) * 0.55);
    puntos.forEach((p, i) => {
      const esPositiva = serie[i].utilidad_neta >= 0;
      const yCero = yFor(0);
      const barra = document.createElementNS(SVG_NS, 'rect');
      barra.setAttribute('x', p.x - anchoBarra / 2);
      barra.setAttribute('y', esPositiva ? p.y : yCero);
      barra.setAttribute('width', anchoBarra);
      barra.setAttribute('height', Math.max(1, Math.abs(p.y - yCero)));
      barra.setAttribute('rx', 4);
      barra.setAttribute('class', `unm-barra ${esPositiva ? 'unm-barra-pos' : 'unm-barra-neg'} ${i === indiceMax ? 'unm-barra-max' : ''}`);
      gBarras.appendChild(barra);
    });
    svg.appendChild(gBarras);

    // ---- Puntos + tooltip rico (aplica a ambos modos) ----
    puntos.forEach((p, i) => {
      const m = serie[i];
      const esMax = i === indiceMax;
      const esActualParcial = esMesEnCursoElUltimo && i === puntos.length - 1;
      const margen = m.subtotal > 0 ? (m.utilidad_neta / m.subtotal) * 100 : null;

      if (esMax || esActualParcial) {
        const halo = document.createElementNS(SVG_NS, 'circle');
        halo.setAttribute('cx', p.x); halo.setAttribute('cy', p.y); halo.setAttribute('r', 13);
        halo.setAttribute('class', `unm-halo ${esMax ? 'unm-halo-pos' : 'unm-halo-neg'}`);
        svg.appendChild(halo);
      }
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
      circle.setAttribute('r', esMax || esActualParcial ? 7 : 5.5);
      circle.setAttribute('tabindex', '0');
      circle.setAttribute(
        'class',
        `unm-punto ${esMax ? 'unm-punto-max' : esActualParcial ? 'unm-punto-actual' : 'unm-punto-normal'}`
      );
      if (esMax) circle.setAttribute('filter', 'url(#unmGlowP)');
      if (esActualParcial) circle.setAttribute('filter', 'url(#unmGlowN)');

      const mostrarTooltip = () => {
        const pos = unmPosicionEnPantalla(svg, chartWrap, p.x, p.y);
        tooltip.innerHTML = `
          <div class="unm-tt-head">
            <span class="unm-tt-mes">${escapeHtml(m.mes)}${esActualParcial ? ' (parcial)' : ''}</span>
            ${esMax ? '<span class="unm-tt-badge">Máximo</span>' : ''}
          </div>
          <div class="unm-tt-val ${esActualParcial ? 'unm-tt-val-neg' : ''}">$${formatearMoneda(m.utilidad_neta)}</div>
          <div class="unm-tt-row"><span>Ingresos (sin IVA):</span><span>$${formatearMoneda(m.subtotal)}</span></div>
          <div class="unm-tt-row"><span>Gastos:</span><span>$${formatearMoneda(m.gastos)}</span></div>
          <div class="unm-tt-row unm-tt-margen"><span>Margen neto:</span><span>${margen === null ? '—' : margen.toFixed(1) + '%'}</span></div>
        `;
        tooltip.hidden = false;
        const anchoTooltip = 190;
        let left = pos.left - anchoTooltip / 2;
        left = Math.max(4, Math.min(left, chartWrap.clientWidth - anchoTooltip - 4));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${Math.max(4, pos.top - 128)}px`;
      };
      const ocultarTooltip = () => { tooltip.hidden = true; };
      circle.addEventListener('mouseenter', mostrarTooltip);
      circle.addEventListener('focus', mostrarTooltip);
      circle.addEventListener('mouseleave', ocultarTooltip);
      circle.addEventListener('blur', ocultarTooltip);
      svg.appendChild(circle);
    });

    // ---- Callouts flotantes (primero y último) ----
    document.querySelectorAll('.unm-callout').forEach((n) => n.remove());
    const primero = puntos[0];
    const posPrimero = unmPosicionEnPantalla(svg, chartWrap, primero.x, primero.y);
    const calloutPrimero = document.createElement('div');
    calloutPrimero.className = 'unm-callout';
    calloutPrimero.style.left = `${posPrimero.left}px`;
    calloutPrimero.style.top = `${posPrimero.top - 34}px`;
    calloutPrimero.innerHTML = `<span class="unm-callout-dot" style="background:${serie[0].utilidad_neta >= 0 ? '#1FAE6B' : '#B3261E'}"></span>${formatearMonedaCompacta(serie[0].utilidad_neta)}`;
    chartWrap.appendChild(calloutPrimero);

    if (puntos.length > 1) {
      const ultimoPt = puntos[puntos.length - 1];
      const posUltimo = unmPosicionEnPantalla(svg, chartWrap, ultimoPt.x, ultimoPt.y);
      const ultimoMes = serie[serie.length - 1];
      const penultimo = serie[serie.length - 2];
      const momUlt = penultimo && penultimo.utilidad_neta !== 0
        ? ((ultimoMes.utilidad_neta - penultimo.utilidad_neta) / Math.abs(penultimo.utilidad_neta)) * 100
        : null;
      const calloutUltimo = document.createElement('div');
      calloutUltimo.className = `unm-callout ${esMesEnCursoElUltimo ? 'unm-callout-neg' : ''}`;
      calloutUltimo.style.left = `${posUltimo.left}px`;
      calloutUltimo.style.top = `${posUltimo.top + (ultimoMes.utilidad_neta >= 0 ? -34 : 14)}px`;
      calloutUltimo.innerHTML = `<span class="unm-callout-dot" style="background:${esMesEnCursoElUltimo ? '#B3261E' : '#1FAE6B'}"></span>${formatearMonedaCompacta(ultimoMes.utilidad_neta)}${momUlt !== null ? ` <span class="unm-callout-pct ${momUlt >= 0 ? 'unm-c-pos' : 'unm-c-neg'}">${momUlt >= 0 ? '+' : ''}${momUlt.toFixed(1)}%</span>` : ''}`;
      chartWrap.appendChild(calloutUltimo);
    }

    // X-axis
    serie.forEach((m, i) => {
      const texto = document.createElementNS(SVG_NS, 'text');
      texto.setAttribute('x', puntos[i].x); texto.setAttribute('y', '388');
      texto.setAttribute('text-anchor', 'middle');
      texto.setAttribute(
        'class',
        `unm-eje-mes ${i === indiceMax ? 'unm-eje-mes-max' : ''} ${esMesEnCursoElUltimo && i === serie.length - 1 ? 'unm-eje-mes-actual' : ''}`
      );
      texto.textContent = m.mes + (esMesEnCursoElUltimo && i === serie.length - 1 ? '*' : '');
      svg.appendChild(texto);
    });
  }

  // ---------- Vista rica de "Proyección de ventas" (solo el modal) ----------
  // Reutiliza al 100% el shell/CSS del modal de "Utilidad neta mensual"
  // (clases unm-*, punto 254/255) — solo agrega variantes "-proy" para el
  // tramo naranja proyectado, en vez de duplicar toolbar/tabla/tooltip/
  // export CSV. Datos 100% reales de cacheSerieProyeccionReal +
  // cacheProyeccionVentas (mismo endpoint ya cargado, sin re-pedir nada).
  function proyConstruirHTML() {
    return `
      <div class="unm-kpis">
        <div class="unm-kpi">
          <div class="unm-kpi-top"><span id="proy-kpi-acum-titulo">Ventas acumuladas</span></div>
          <div class="unm-kpi-val" id="proy-kpi-acum">—</div>
          <p class="unm-kpi-note" id="proy-kpi-acum-nota"></p>
        </div>
        <div class="unm-kpi" id="proy-kpi-ultimo-card">
          <div class="unm-kpi-top"><span id="proy-kpi-ultimo-titulo">Último mes real</span><span class="unm-badge" id="proy-kpi-ultimo-mom"></span></div>
          <div class="unm-kpi-val" id="proy-kpi-ultimo">—</div>
          <p class="unm-kpi-note" id="proy-kpi-ultimo-nota"></p>
        </div>
        <div class="unm-kpi" id="proy-kpi-m1-card" hidden>
          <div class="unm-kpi-top"><span id="proy-kpi-m1-titulo">Proyección</span><span class="unm-badge unm-badge-proy">Estimado</span></div>
          <div class="unm-kpi-val unm-c-proy" id="proy-kpi-m1">—</div>
          <p class="unm-kpi-note" id="proy-kpi-m1-nota"></p>
        </div>
        <div class="unm-kpi" id="proy-kpi-m2-card" hidden>
          <div class="unm-kpi-top"><span id="proy-kpi-m2-titulo">Proyección</span><span class="unm-badge unm-badge-proy">Estimado</span></div>
          <div class="unm-kpi-val unm-c-proy" id="proy-kpi-m2">—</div>
          <p class="unm-kpi-note" id="proy-kpi-m2-nota"></p>
        </div>
      </div>
      <div class="unm-stage">
        <p class="unm-banner" id="proy-banner-parcial" hidden><span class="unm-banner-ic">i</span><span id="proy-banner-texto"></span></p>
        <div class="unm-toolbar">
          <div class="unm-seg" role="tablist" aria-label="Tipo de gráfica">
            <button type="button" class="is-active" id="proy-btn-linea" role="tab" aria-selected="true">Línea</button>
            <button type="button" id="proy-btn-barras" role="tab" aria-selected="false">Barras</button>
          </div>
          <button type="button" class="unm-btn-export" id="proy-btn-exportar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v13m0 0l-4-4m4 4l4-4M4 21h16" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Exportar CSV
          </button>
        </div>
        <div class="unm-chart-wrap" id="proy-chart-wrap">
          <svg class="unm-svg" id="proy-svg" viewBox="0 0 1000 400" preserveAspectRatio="none" role="img" aria-label="Proyección de ventas, vista detallada"></svg>
          <div class="unm-tooltip" id="proy-tooltip" hidden></div>
        </div>
        <p class="admin-empty" id="proy-empty" hidden>Aún no hay suficientes datos para esta gráfica.</p>
        <p class="unm-tabla-nota" id="proy-metodo-nota" style="margin-top:10px;"></p>
      </div>
      <div class="unm-tabla-wrap" id="proy-tabla-wrap">
        <div class="unm-tabla-head">
          <h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/></svg> Desglose mensual</h3>
          <span class="unm-tabla-nota">Valores en pesos, con IVA incluido</span>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table unm-tabla">
            <thead><tr><th>Mes</th><th>Ventas</th><th>Variación</th><th>Estado</th></tr></thead>
            <tbody id="proy-tabla-body"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  function abrirDetalleProyeccionRica() {
    const origenBoton = document.querySelector('[data-detalle-contenido="resumen-fin-proyeccion-contenido"]');
    const header = origenBoton ? origenBoton.closest('.resumen-fin-card-header') : null;
    const iconoOrigen = header ? header.querySelector('.inicio-stat-icono') : null;
    els.resumenFinDetalleTitulo.textContent = 'Proyección de ventas';
    els.resumenFinDetalleIcono.className = iconoOrigen ? iconoOrigen.className : 'inicio-stat-icono';
    els.resumenFinDetalleIcono.innerHTML = iconoOrigen ? iconoOrigen.innerHTML : '';

    detalleEsRico = true;
    if (els.resumenFinDetalleModal) els.resumenFinDetalleModal.classList.add('resumen-fin-detalle-modal-ancha');
    els.resumenFinDetalleBody.innerHTML = proyConstruirHTML();
    els.resumenFinDetalleOverlay.hidden = false;
    proyPintar(cacheSerieProyeccionReal, cacheProyeccionVentas);
    els.btnResumenFinDetalleCerrar.focus();
  }

  function proyPintar(serieRealInput, proyeccionInput) {
    const serieReal = serieRealInput || [];
    const proyeccion = proyeccionInput || [];
    const svg = document.getElementById('proy-svg');
    const chartWrap = document.getElementById('proy-chart-wrap');
    const tooltip = document.getElementById('proy-tooltip');
    const empty = document.getElementById('proy-empty');
    const tablaBody = document.getElementById('proy-tabla-body');
    const tablaWrap = document.getElementById('proy-tabla-wrap');
    const banner = document.getElementById('proy-banner-parcial');
    const metodoNota = document.getElementById('proy-metodo-nota');

    if (!serieReal.length) {
      empty.hidden = false;
      chartWrap.hidden = true;
      tablaWrap.hidden = true;
      document.querySelector('.unm-toolbar').hidden = true;
      document.querySelector('.unm-kpis').hidden = true;
      metodoNota.textContent = '';
      return;
    }
    document.querySelector('.unm-kpis').hidden = false;

    // ¿El último mes real es el mes en curso (parcial)? Mismo criterio
    // que unmPintar(): comparar contra mes_actual.ventas (fuente
    // autoritativa), no contra la etiqueta del mes.
    const ultimo = serieReal[serieReal.length - 1];
    const esMesEnCursoElUltimo =
      cacheMesActualVentasTotal !== null &&
      Math.abs(ultimo.ventas - cacheMesActualVentasTotal) < 0.005;

    // ---- KPIs ----
    const acumulado = serieReal.reduce((a, m) => a + m.ventas, 0);
    document.getElementById('proy-kpi-acum-titulo').textContent = `Ventas acumuladas (${serieReal.length} ${serieReal.length === 1 ? 'mes' : 'meses'})`;
    document.getElementById('proy-kpi-acum').textContent = `$${formatearMoneda(acumulado)}`;
    document.getElementById('proy-kpi-acum-nota').textContent = esMesEnCursoElUltimo
      ? `Incluye ${ultimo.mes} (parcial)`
      : 'Suma de los meses mostrados';

    const anterior = serieReal.length > 1 ? serieReal[serieReal.length - 2] : null;
    const momUltimo = anterior && anterior.ventas !== 0
      ? ((ultimo.ventas - anterior.ventas) / Math.abs(anterior.ventas)) * 100
      : null;
    document.getElementById('proy-kpi-ultimo-titulo').textContent = esMesEnCursoElUltimo ? `Mes en curso (${ultimo.mes})` : `Último mes real (${ultimo.mes})`;
    document.getElementById('proy-kpi-ultimo').textContent = `$${formatearMoneda(ultimo.ventas)}`;
    const badgeUltimo = document.getElementById('proy-kpi-ultimo-mom');
    if (momUltimo !== null) {
      badgeUltimo.textContent = `${momUltimo >= 0 ? '+' : ''}${momUltimo.toFixed(1)}% MoM`;
      badgeUltimo.className = `unm-badge ${momUltimo >= 0 ? 'unm-badge-pos' : 'unm-badge-neg'}`;
    } else {
      badgeUltimo.textContent = '';
      badgeUltimo.className = 'unm-badge';
    }
    document.getElementById('proy-kpi-ultimo-nota').textContent = esMesEnCursoElUltimo ? 'Cierre preliminar en curso' : '';

    const m1Card = document.getElementById('proy-kpi-m1-card');
    const m2Card = document.getElementById('proy-kpi-m2-card');
    if (proyeccion.length >= 1) {
      document.getElementById('proy-kpi-m1-titulo').textContent = `Proyección ${proyeccion[0].mes}`;
      document.getElementById('proy-kpi-m1').textContent = `$${formatearMoneda(proyeccion[0].ventas)}`;
      document.getElementById('proy-kpi-m1-nota').textContent = 'Estimado, aún no ocurre';
      m1Card.hidden = false;
    } else {
      m1Card.hidden = true;
    }
    if (proyeccion.length >= 2) {
      document.getElementById('proy-kpi-m2-titulo').textContent = `Proyección ${proyeccion[1].mes}`;
      document.getElementById('proy-kpi-m2').textContent = `$${formatearMoneda(proyeccion[1].ventas)}`;
      document.getElementById('proy-kpi-m2-nota').textContent = 'Estimado, aún no ocurre';
      m2Card.hidden = false;
    } else {
      m2Card.hidden = true;
    }

    // ---- Aviso honesto (nada de "anomalía"/IA inventada del mockup) ----
    if (esMesEnCursoElUltimo) {
      banner.hidden = false;
      document.getElementById('proy-banner-texto').innerHTML =
        `<b>${escapeHtml(ultimo.mes)} es el mes en curso:</b> la cifra (${formatearMonedaCompacta(ultimo.ventas)}) es parcial y no se usa para calcular la tendencia de la proyección.`;
    } else {
      banner.hidden = true;
    }

    metodoNota.textContent = proyeccion.length
      ? 'Método: promedio del cambio mensual de los últimos 3 meses cerrados, extendido hacia adelante — no es un modelo predictivo ni usa IA.'
      : 'Necesitas al menos 3 meses cerrados con ventas para calcular una proyección.';

    // ---- Gráfica ----
    chartWrap.hidden = false;
    tablaWrap.hidden = false;
    document.querySelector('.unm-toolbar').hidden = false;
    empty.hidden = true;
    proyPintarSVG(svg, tooltip, chartWrap, serieReal, proyeccion, esMesEnCursoElUltimo);

    // ---- Tabla ----
    const todas = [...serieReal.map((m) => ({ ...m, esProy: false })), ...proyeccion.map((m) => ({ ...m, esProy: true }))];
    tablaBody.innerHTML = todas.map((m, i) => {
      const prev = i > 0 ? todas[i - 1] : null;
      const variacion = prev && prev.ventas !== 0
        ? ((m.ventas - prev.ventas) / Math.abs(prev.ventas)) * 100
        : null;
      const esUltimoParcial = esMesEnCursoElUltimo && !m.esProy && i === serieReal.length - 1;
      const variacionTxt = i === 0 ? '— (Base)' : variacion === null ? '—' : `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}%`;
      const variacionClase = variacion === null ? '' : variacion >= 0 ? 'unm-c-pos' : 'unm-c-neg';
      const estado = m.esProy
        ? '<span class="unm-badge unm-badge-proy">Proyectado</span>'
        : esUltimoParcial
          ? '<span class="unm-badge unm-badge-neg">Cierre parcial</span>'
          : '<span class="unm-badge unm-badge-pos">Real</span>';
      return `<tr class="${m.esProy ? 'unm-row-proy' : ''}">
        <td class="unm-mes-cell">${escapeHtml(m.mes)}${esUltimoParcial ? '*' : ''}</td>
        <td>$${formatearMoneda(m.ventas)}</td>
        <td class="${variacionClase}" style="font-weight:600;">${variacionTxt}</td>
        <td>${estado}</td>
      </tr>`;
    }).join('');

    // ---- Toggle línea/barras ----
    const btnLinea = document.getElementById('proy-btn-linea');
    const btnBarras = document.getElementById('proy-btn-barras');
    btnLinea.onclick = () => {
      btnLinea.classList.add('is-active'); btnLinea.setAttribute('aria-selected', 'true');
      btnBarras.classList.remove('is-active'); btnBarras.setAttribute('aria-selected', 'false');
      svg.classList.remove('unm-modo-barras');
    };
    btnBarras.onclick = () => {
      btnBarras.classList.add('is-active'); btnBarras.setAttribute('aria-selected', 'true');
      btnLinea.classList.remove('is-active'); btnLinea.setAttribute('aria-selected', 'false');
      svg.classList.add('unm-modo-barras');
    };

    // ---- Exportar CSV (100% client-side, mismos datos ya en pantalla) ----
    document.getElementById('proy-btn-exportar').onclick = () => {
      const encabezados = ['Mes', 'Ventas', 'Variación MoM %', 'Estado'];
      const filas = todas.map((m, i) => {
        const prev = i > 0 ? todas[i - 1] : null;
        const variacion = prev && prev.ventas !== 0
          ? (((m.ventas - prev.ventas) / Math.abs(prev.ventas)) * 100).toFixed(1)
          : '';
        const esUltimoParcial = esMesEnCursoElUltimo && !m.esProy && i === serieReal.length - 1;
        const estado = m.esProy ? 'Proyectado' : esUltimoParcial ? 'Cierre parcial' : 'Real';
        return [m.mes, m.ventas.toFixed(2), variacion, estado];
      });
      const csv = [encabezados, ...filas]
        .map((fila) => fila.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'proyeccion-ventas.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
  }

  function proyPintarSVG(svg, tooltip, chartWrap, serieReal, proyeccion, esMesEnCursoElUltimo) {
    svg.innerHTML = '';
    svg.classList.remove('unm-modo-barras');
    document.getElementById('proy-btn-linea').classList.add('is-active');
    document.getElementById('proy-btn-linea').setAttribute('aria-selected', 'true');
    document.getElementById('proy-btn-barras').classList.remove('is-active');
    document.getElementById('proy-btn-barras').setAttribute('aria-selected', 'false');

    const todos = [...serieReal, ...proyeccion];
    const cantidadReal = serieReal.length;
    const valores = todos.map((m) => m.ventas);
    const maxAbs = Math.max(1, ...valores);
    const yMax = unmEscalaMaxima(maxAbs);
    const X0 = 70, X1 = 960, Y0 = 40, Y1 = 365, ALTO = Y1 - Y0;
    const yFor = (v) => Y1 - (v / yMax) * ALTO;
    const n = todos.length;
    const xFor = (i) => (n <= 1 ? (X0 + X1) / 2 : X0 + 40 + ((X1 - X0 - 80) * i) / (n - 1));

    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = `
      <linearGradient id="proyAreaVentas" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#03285B" stop-opacity="0.20"/>
        <stop offset="100%" stop-color="#03285B" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="proyAreaProy" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#B4530C" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#B4530C" stop-opacity="0"/>
      </linearGradient>
      <filter id="proyGlowVentas" height="160%" width="160%" x="-30%" y="-30%">
        <feDropShadow dx="0" dy="3" flood-color="#03285B" flood-opacity="0.35" stdDeviation="4"/>
      </filter>
      <filter id="proyGlowProy" height="160%" width="160%" x="-30%" y="-30%">
        <feDropShadow dx="0" dy="3" flood-color="#B4530C" flood-opacity="0.4" stdDeviation="4"/>
      </filter>
    `;
    svg.appendChild(defs);

    // Gridlines 0..yMax (ventas siempre >= 0, sin necesidad de línea $0
    // especial más que la de la base).
    for (let i = 0; i <= 5; i++) {
      const val = (yMax * i) / 5;
      const y = yFor(val);
      const linea = document.createElementNS(SVG_NS, 'line');
      linea.setAttribute('x1', X0); linea.setAttribute('x2', X1);
      linea.setAttribute('y1', y); linea.setAttribute('y2', y);
      linea.setAttribute('class', i === 0 ? 'unm-linea-base' : 'unm-linea-grid');
      svg.appendChild(linea);
      const texto = document.createElementNS(SVG_NS, 'text');
      texto.setAttribute('x', X0 - 10); texto.setAttribute('y', y + 4);
      texto.setAttribute('text-anchor', 'end');
      texto.setAttribute('class', i === 0 ? 'unm-texto-base' : 'unm-texto-grid');
      texto.textContent = i === 0 ? '$0' : `${formatearMonedaCompacta(val)}`;
      svg.appendChild(texto);
    }

    // Línea de promedio — SOLO de los meses reales mostrados (nunca
    // mezcla la proyección en su propio promedio de referencia).
    const promedioReal = serieReal.reduce((a, m) => a + m.ventas, 0) / serieReal.length;
    const yProm = yFor(promedioReal);
    const lineaProm = document.createElementNS(SVG_NS, 'line');
    lineaProm.setAttribute('x1', X0); lineaProm.setAttribute('x2', X1);
    lineaProm.setAttribute('y1', yProm); lineaProm.setAttribute('y2', yProm);
    lineaProm.setAttribute('class', 'unm-linea-promedio');
    svg.appendChild(lineaProm);
    const textoProm = document.createElementNS(SVG_NS, 'text');
    textoProm.setAttribute('x', X1); textoProm.setAttribute('y', yProm - 6);
    textoProm.setAttribute('text-anchor', 'end');
    textoProm.setAttribute('class', 'unm-texto-promedio');
    textoProm.textContent = `Media histórica: ${formatearMonedaCompacta(promedioReal)}`;
    svg.appendChild(textoProm);

    const puntos = todos.map((m, i) => ({ x: xFor(i), y: yFor(m.ventas) }));

    // ---- Grupo LÍNEA (2 tramos: real navy sólido + proyectado naranja
    // punteado, cada uno con su propia área degradada) ----
    const gLinea = document.createElementNS(SVG_NS, 'g');
    gLinea.setAttribute('class', 'unm-g-linea');
    const puntosReales = puntos.slice(0, cantidadReal);
    const puntosProy = puntos.slice(cantidadReal - 1); // incluye el último real como ancla del tramo punteado

    if (puntosReales.length > 1) {
      const areaPts = `${puntosReales.map((p) => `${p.x},${p.y}`).join(' ')} ${puntosReales[puntosReales.length - 1].x},${Y1} ${puntosReales[0].x},${Y1}`;
      const area = document.createElementNS(SVG_NS, 'polygon');
      area.setAttribute('points', areaPts);
      area.setAttribute('fill', 'url(#proyAreaVentas)');
      gLinea.appendChild(area);

      const trazo = document.createElementNS(SVG_NS, 'polyline');
      trazo.setAttribute('points', puntosReales.map((p) => `${p.x},${p.y}`).join(' '));
      trazo.setAttribute('class', 'unm-trazo');
      gLinea.appendChild(trazo);
    }
    if (puntosProy.length > 1) {
      const areaPts = `${puntosProy.map((p) => `${p.x},${p.y}`).join(' ')} ${puntosProy[puntosProy.length - 1].x},${Y1} ${puntosProy[0].x},${Y1}`;
      const area = document.createElementNS(SVG_NS, 'polygon');
      area.setAttribute('points', areaPts);
      area.setAttribute('fill', 'url(#proyAreaProy)');
      gLinea.appendChild(area);

      const trazo = document.createElementNS(SVG_NS, 'polyline');
      trazo.setAttribute('points', puntosProy.map((p) => `${p.x},${p.y}`).join(' '));
      trazo.setAttribute('class', 'unm-trazo unm-trazo-proy');
      gLinea.appendChild(trazo);
    }
    svg.appendChild(gLinea);

    // ---- Grupo BARRAS (oculto por defecto vía CSS .unm-modo-barras) ----
    const gBarras = document.createElementNS(SVG_NS, 'g');
    gBarras.setAttribute('class', 'unm-g-barras');
    const anchoBarra = Math.min(46, ((X1 - X0 - 80) / Math.max(1, n)) * 0.55);
    const yCero = yFor(0);
    puntos.forEach((p, i) => {
      const esProy = i >= cantidadReal;
      const barra = document.createElementNS(SVG_NS, 'rect');
      barra.setAttribute('x', p.x - anchoBarra / 2);
      barra.setAttribute('y', p.y);
      barra.setAttribute('width', anchoBarra);
      barra.setAttribute('height', Math.max(1, yCero - p.y));
      barra.setAttribute('rx', 4);
      barra.setAttribute('class', `unm-barra ${esProy ? 'unm-barra-proy' : 'unm-barra-pos'}`);
      gBarras.appendChild(barra);
    });
    svg.appendChild(gBarras);

    // ---- Puntos + tooltip rico (aplica a ambos modos) — halo solo en el
    // último punto real y en el máximo proyectado, mismo criterio que la
    // tarjeta chica. ----
    let indiceMaxProy = -1;
    if (proyeccion.length) {
      indiceMaxProy = cantidadReal;
      for (let i = cantidadReal; i < todos.length; i++) {
        if (todos[i].ventas > todos[indiceMaxProy].ventas) indiceMaxProy = i;
      }
    }
    const indiceUltimoReal = cantidadReal - 1;

    puntos.forEach((p, i) => {
      const m = todos[i];
      const esProy = i >= cantidadReal;
      const esDestacado = i === indiceUltimoReal || i === indiceMaxProy;
      const esUltimoRealParcial = esMesEnCursoElUltimo && i === indiceUltimoReal;

      if (esDestacado) {
        const halo = document.createElementNS(SVG_NS, 'circle');
        halo.setAttribute('cx', p.x); halo.setAttribute('cy', p.y); halo.setAttribute('r', 13);
        halo.setAttribute('class', `unm-halo ${esProy ? 'unm-halo-proy' : 'unm-halo-ventas'}`);
        svg.appendChild(halo);
      }
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
      circle.setAttribute('r', esDestacado ? 7 : 5.5);
      circle.setAttribute('tabindex', '0');
      circle.setAttribute('class', `unm-punto ${esProy ? 'unm-punto-proy' : ''}`);
      if (esDestacado) circle.setAttribute('filter', esProy ? 'url(#proyGlowProy)' : 'url(#proyGlowVentas)');

      const mostrarTooltip = () => {
        const pos = unmPosicionEnPantalla(svg, chartWrap, p.x, p.y);
        const prev = i > 0 ? todos[i - 1] : null;
        const variacion = prev && prev.ventas !== 0 ? ((m.ventas - prev.ventas) / Math.abs(prev.ventas)) * 100 : null;
        tooltip.innerHTML = `
          <div class="unm-tt-head">
            <span class="unm-tt-mes">${escapeHtml(m.mes)}${esUltimoRealParcial ? ' (parcial)' : esProy ? ' (proyectado)' : ''}</span>
            ${i === indiceMaxProy ? '<span class="unm-tt-badge" style="background:var(--color-warn-soft);color:var(--color-warn);">Máx. proyectado</span>' : ''}
          </div>
          <div class="unm-tt-val ${esProy ? 'unm-tt-val-proy' : ''}">$${formatearMoneda(m.ventas)}</div>
          ${variacion !== null ? `<div class="unm-tt-row"><span>Variación vs mes anterior:</span><span>${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}%</span></div>` : ''}
        `;
        tooltip.hidden = false;
        const anchoTooltip = 190;
        let left = pos.left - anchoTooltip / 2;
        left = Math.max(4, Math.min(left, chartWrap.clientWidth - anchoTooltip - 4));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${Math.max(4, pos.top - 110)}px`;
      };
      const ocultarTooltip = () => { tooltip.hidden = true; };
      circle.addEventListener('mouseenter', mostrarTooltip);
      circle.addEventListener('focus', mostrarTooltip);
      circle.addEventListener('mouseleave', ocultarTooltip);
      circle.addEventListener('blur', ocultarTooltip);
      svg.appendChild(circle);
    });

    // ---- Callouts flotantes (primero y último) ----
    document.querySelectorAll('.unm-callout').forEach((n) => n.remove());
    const primero = puntos[0];
    const posPrimero = unmPosicionEnPantalla(svg, chartWrap, primero.x, primero.y);
    const calloutPrimero = document.createElement('div');
    calloutPrimero.className = 'unm-callout';
    calloutPrimero.style.left = `${posPrimero.left}px`;
    calloutPrimero.style.top = `${posPrimero.top - 34}px`;
    calloutPrimero.innerHTML = `<span class="unm-callout-dot" style="background:var(--color-accent)"></span>${formatearMonedaCompacta(todos[0].ventas)}`;
    chartWrap.appendChild(calloutPrimero);

    if (puntos.length > 1) {
      const ultimoPt = puntos[puntos.length - 1];
      const posUltimo = unmPosicionEnPantalla(svg, chartWrap, ultimoPt.x, ultimoPt.y);
      const esUltimoProy = todos.length > cantidadReal;
      const calloutUltimo = document.createElement('div');
      calloutUltimo.className = `unm-callout ${esUltimoProy ? 'unm-callout-proy' : ''}`;
      calloutUltimo.style.left = `${posUltimo.left}px`;
      calloutUltimo.style.top = `${posUltimo.top - 34}px`;
      calloutUltimo.innerHTML = `<span class="unm-callout-dot" style="background:${esUltimoProy ? 'var(--color-warn)' : 'var(--color-accent)'}"></span>${formatearMonedaCompacta(todos[todos.length - 1].ventas)}`;
      chartWrap.appendChild(calloutUltimo);
    }

    // X-axis
    todos.forEach((m, i) => {
      const esProy = i >= cantidadReal;
      const texto = document.createElementNS(SVG_NS, 'text');
      texto.setAttribute('x', puntos[i].x); texto.setAttribute('y', '388');
      texto.setAttribute('text-anchor', 'middle');
      texto.setAttribute('class', `unm-eje-mes ${esProy ? 'unm-eje-mes-proy' : ''}`);
      texto.textContent = m.mes + (esMesEnCursoElUltimo && i === indiceUltimoReal ? '*' : '');
      svg.appendChild(texto);
    });
  }

  // Modal rico de "Ventas facturadas vs sin facturar" — homologado con
  // stitch/ventas_facturadas_vs_sin_facturar_ux_redesign a partir de una
  // auditoría dato-real-vs-inventado con el usuario (3 rondas de
  // AskUserQuestion): se quitó selector de rango 1T/6M/YTD/1A, "Tiempo
  // Real", "Riesgo fiscal"/"Objetivo ≥90% facturado" (sin respaldo), el
  // pipeline de 3 etapas se colapsó a 2 barras reales (el sistema solo
  // tiene 2 estados: facturado_en NULL o no — no existe "solicitud
  // recibida, datos por validar"), "PAC Conectado"/"Generar factura
  // global"/"Configuración de timbrado masivo" se quitaron (no hay
  // integración PAC ni facturación en lote real), y la tabla de 5
  // operaciones ficticias (empresas/RFC/método de pago inventados) se
  // reemplazó por una tabla real de ventas sin facturar del mes (fecha,
  // concepto, correo, monto — sin RFC/empresa/método de pago porque
  // `ordenes_compra` no los guarda, sin botones de acción por fila
  // porque no hay timbrado en 1 clic). La caja "Resolución automatizada
  // sugerida" se volvió honesta: monto real de ventas sin facturar (no
  // el $8,450 fijo del mockup), sin "clientes con datos faltantes"
  // inventado, botón real que navega a Ventas con el filtro
  // "Facturación: Sin facturar" ya aplicado (filtro nuevo, mismo patrón
  // que "Estado de pago").
  function facturacionConstruirHTML() {
    return `
      <div class="resumen-fin-header-tags">
        <span class="resumen-fin-header-tag" id="fact-rica-tag-q">—</span>
        <span class="resumen-fin-header-tag resumen-fin-header-tag-pendiente" data-tooltip="Buscar transferencias en tus estados de cuenta (PDF) y conciliarlas contra tus ventas — función planeada, todavía no está construida.">Conciliación de pagos · Próximamente</span>
      </div>
      <div class="unm-kpis">
        <div class="unm-kpi">
          <div class="unm-kpi-top"><span>Total ventas</span><span class="unm-badge" id="fact-rica-kpi-ops">—</span></div>
          <div class="unm-kpi-val" id="fact-rica-kpi-ventas">—</div>
          <p class="unm-kpi-note" id="fact-rica-kpi-ventas-nota">Corte del mes en curso</p>
        </div>
        <div class="unm-kpi unm-kpi-pos">
          <div class="unm-kpi-top"><span>Facturadas</span><span class="unm-badge unm-badge-pos" id="fact-rica-kpi-pct-fact">—</span></div>
          <div class="unm-kpi-val unm-c-pos" id="fact-rica-kpi-facturado">—</div>
          <p class="unm-kpi-note" id="fact-rica-kpi-facturado-nota"></p>
        </div>
        <div class="unm-kpi" id="fact-rica-kpi-sinfact-card">
          <div class="unm-kpi-top"><span>Sin facturar</span><span class="unm-badge unm-badge-neg" id="fact-rica-kpi-pct-sinfact">—</span></div>
          <div class="unm-kpi-val unm-c-neg" id="fact-rica-kpi-sinfacturado">—</div>
          <p class="unm-kpi-note" id="fact-rica-kpi-sinfacturado-nota"></p>
        </div>
        <div class="unm-kpi">
          <div class="unm-kpi-top"><span>Cierre mensual</span></div>
          <div class="unm-kpi-val" id="fact-rica-kpi-cierre">—</div>
          <p class="unm-kpi-note">Ventas y Gastos se archivan automáticamente el día 1</p>
        </div>
      </div>

      <div class="fact-rica-grid">
        <div class="fact-rica-donut-col">
          <div class="resumen-fin-donut-body">
            <div class="resumen-fin-donut-wrap">
              <svg class="resumen-fin-donut" id="fact-rica-donut" viewBox="0 0 100 100" width="140" height="140" aria-hidden="true"></svg>
              <div class="resumen-fin-donut-centro">
                <span class="resumen-fin-donut-total" id="fact-rica-donut-total">$0</span>
                <span class="resumen-fin-donut-total-label">Ventas</span>
              </div>
            </div>
          </div>
        </div>
        <div class="fact-rica-barras-col">
          <div class="fact-rica-barra">
            <div class="fact-rica-barra-head">
              <span><span class="fact-rica-barra-dot" style="background:${RESUMEN_FIN_COLOR_FACTURADO}"></span>Facturadas</span>
              <strong id="fact-rica-barra-fact-val">$0 (0%)</strong>
            </div>
            <div class="fact-rica-barra-track"><div class="fact-rica-barra-fill" id="fact-rica-barra-fact-fill" style="background:${RESUMEN_FIN_COLOR_FACTURADO}"></div></div>
            <p class="fact-rica-barra-nota">Comprobante fiscal ya subido</p>
          </div>
          <div class="fact-rica-barra">
            <div class="fact-rica-barra-head">
              <span><span class="fact-rica-barra-dot" style="background:${RESUMEN_FIN_COLOR_SIN_FACTURAR}"></span>Sin facturar</span>
              <strong id="fact-rica-barra-sinfact-val">$0 (0%)</strong>
            </div>
            <div class="fact-rica-barra-track"><div class="fact-rica-barra-fill" id="fact-rica-barra-sinfact-fill" style="background:${RESUMEN_FIN_COLOR_SIN_FACTURAR}"></div></div>
            <p class="fact-rica-barra-nota">Falta subir el ZIP de la factura</p>
          </div>

          <div class="fact-rica-sugerencia" id="fact-rica-sugerencia" hidden>
            <span class="fact-rica-sugerencia-ic" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
            <div class="fact-rica-sugerencia-texto">
              <div class="fact-rica-sugerencia-titulo">Ventas sin facturar este mes</div>
              <div id="fact-rica-sugerencia-desc">—</div>
            </div>
            <button type="button" class="btn btn-secondary fact-rica-sugerencia-btn" id="fact-rica-btn-ir-ventas">Ver en Ventas</button>
          </div>
        </div>
      </div>

      <div class="unm-tabla-wrap">
        <div class="unm-tabla-head">
          <h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/></svg> Ventas sin facturar (más recientes)</h3>
          <span class="unm-tabla-nota">Máximo 10 — para el resto, ve a Ventas</span>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table unm-tabla">
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Correo</th><th>Monto</th></tr></thead>
            <tbody id="fact-rica-tabla-body"></tbody>
          </table>
        </div>
        <p class="admin-empty" id="fact-rica-tabla-empty" hidden>No hay ventas sin facturar este mes.</p>
      </div>

      <p class="resumen-fin-proyeccion-nota">Una venta cuenta como "Facturada" en cuanto se sube el ZIP de su factura — para el detalle completo por venta, ve a Ventas.</p>
    `;
  }

  function irAVentasSinFacturar() {
    if (els.ordenesFiltroFacturacion) els.ordenesFiltroFacturacion.value = 'sin_facturar';
    cambiarVistaPrincipal('ordenes');
    cerrarDetalleGrafica();
  }

  async function facturacionCargarTablaSinFacturar() {
    const tbody = document.getElementById('fact-rica-tabla-body');
    const empty = document.getElementById('fact-rica-tabla-empty');
    if (!tbody) return;
    try {
      const authHeader = getAuthHeader();
      if (!authHeader) return;
      const res = await fetch(`${API_BASE}/admin/ordenes-compra`, { headers: { Authorization: authHeader } });
      if (!res.ok) return;
      const data = await res.json();
      const ahora = new Date();
      const inicioMes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
      const filas = (data.ordenes || [])
        .filter((o) => !o.facturado && String(o.fecha_compra || '').slice(0, 7) === inicioMes)
        .sort((a, b) => String(b.fecha_compra).localeCompare(String(a.fecha_compra)))
        .slice(0, 10);
      empty.hidden = filas.length > 0;
      tbody.innerHTML = filas.map((o) => `
        <tr>
          <td>${escapeHtml(o.fecha_compra_formateada || o.fecha_compra || '—')}</td>
          <td>${escapeHtml(o.concepto || '—')}</td>
          <td>${escapeHtml(o.email || '—')}</td>
          <td>$${formatearMoneda(o.total)}</td>
        </tr>
      `).join('');
    } catch (err) {
      empty.hidden = false;
    }
  }

  function facturacionPintarRica(mes) {
    const ventas = mes.ventas || 0;
    const facturado = mes.facturado || 0;
    const sinFacturar = mes.ventas_sin_facturar || 0;
    const opsTotales = mes.ops_totales || 0;
    const opsFacturadas = mes.ops_facturadas || 0;
    const opsSinFacturar = mes.ops_sin_facturar || 0;
    const pctFacturado = ventas > 0 ? Math.round((facturado / ventas) * 100) : 0;
    const pctSinFacturar = Math.max(0, 100 - pctFacturado);

    const hoy = new Date();
    const trimestre = Math.floor(hoy.getMonth() / 3) + 1;
    document.getElementById('fact-rica-tag-q').textContent = `Q${trimestre} ${hoy.getFullYear()}`;

    document.getElementById('fact-rica-kpi-ops').textContent = `${opsTotales} ops`;
    document.getElementById('fact-rica-kpi-ventas').textContent = `$${formatearMoneda(ventas)}`;
    document.getElementById('fact-rica-kpi-pct-fact').textContent = `${pctFacturado}% cubierto`;
    document.getElementById('fact-rica-kpi-facturado').textContent = `$${formatearMoneda(facturado)}`;
    document.getElementById('fact-rica-kpi-facturado-nota').textContent = `${opsFacturadas} comprobante${opsFacturadas === 1 ? '' : 's'}`;
    document.getElementById('fact-rica-kpi-pct-sinfact').textContent = `${pctSinFacturar}% pendiente`;
    document.getElementById('fact-rica-kpi-sinfacturado').textContent = `$${formatearMoneda(sinFacturar)}`;
    document.getElementById('fact-rica-kpi-sinfacturado-nota').textContent = `${opsSinFacturar} por timbrar`;
    document.getElementById('fact-rica-kpi-sinfact-card').classList.toggle('unm-kpi-neg', sinFacturar > 0);

    const { diasRestantes } = calcularCierreMensual();
    document.getElementById('fact-rica-kpi-cierre').textContent = `${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`;

    if (ventas > 0) {
      renderDonutGenerico(document.getElementById('fact-rica-donut'), [
        { valor: facturado, color: RESUMEN_FIN_COLOR_FACTURADO },
        { valor: sinFacturar, color: RESUMEN_FIN_COLOR_SIN_FACTURAR },
      ]);
    }
    document.getElementById('fact-rica-donut-total').textContent = `$${formatearMoneda(ventas)}`;

    document.getElementById('fact-rica-barra-fact-val').textContent = `$${formatearMoneda(facturado)} (${pctFacturado}%)`;
    document.getElementById('fact-rica-barra-fact-fill').style.width = `${pctFacturado}%`;
    document.getElementById('fact-rica-barra-sinfact-val').textContent = `$${formatearMoneda(sinFacturar)} (${pctSinFacturar}%)`;
    document.getElementById('fact-rica-barra-sinfact-fill').style.width = `${pctSinFacturar}%`;

    const sugerencia = document.getElementById('fact-rica-sugerencia');
    if (sugerencia) {
      sugerencia.hidden = sinFacturar <= 0;
      if (sinFacturar > 0) {
        document.getElementById('fact-rica-sugerencia-desc').textContent =
          `$${formatearMoneda(sinFacturar)} en ${opsSinFacturar} venta${opsSinFacturar === 1 ? '' : 's'} todavía sin comprobante fiscal.`;
      }
    }
    const btnIrVentas = document.getElementById('fact-rica-btn-ir-ventas');
    if (btnIrVentas) btnIrVentas.onclick = irAVentasSinFacturar;

    facturacionCargarTablaSinFacturar();
  }

  function abrirDetalleFacturacionRica() {
    const origenBoton = document.querySelector('[data-detalle-contenido="resumen-fin-donut-facturacion-contenido"]');
    const header = origenBoton ? origenBoton.closest('.resumen-fin-card-header') : null;
    const iconoOrigen = header ? header.querySelector('.inicio-stat-icono') : null;
    els.resumenFinDetalleTitulo.textContent = 'Ventas facturadas vs sin facturar';
    els.resumenFinDetalleIcono.className = iconoOrigen ? iconoOrigen.className : 'inicio-stat-icono';
    els.resumenFinDetalleIcono.innerHTML = iconoOrigen ? iconoOrigen.innerHTML : '';

    detalleEsRico = true;
    if (els.resumenFinDetalleModal) els.resumenFinDetalleModal.classList.add('resumen-fin-detalle-modal-ancha');
    els.resumenFinDetalleBody.innerHTML = facturacionConstruirHTML();
    els.resumenFinDetalleOverlay.hidden = false;
    facturacionPintarRica(cacheMesActualFacturacion || {});
    els.btnResumenFinDetalleCerrar.focus();
  }

  // Modal rico de "Distribución de gastos por categoría" — homologado con
  // stitch/distribución_de_gastos_por_categoría_ux_redesign a partir de
  // otra ronda de AskUserQuestion: "Desviación vs Presupuesto"/"Estado
  // Presupuestal"/"Configurar límites presupuestales" se QUITARON (no
  // existe concepto de presupuesto en la app — pendiente para una etapa
  // futura junto con PAC/timbrado, ver PROJECT_STATE.md); el KPI "Gastos
  // Variables/Flexibles" SÍ se construyó (columna real `tipo` fijo/
  // variable en categorias_gastos, editable desde el panel
  // "Categorías"); "Estado Presupuestal" de la tabla se reemplazó por "%
  // con comprobante" real (`tiene_factura`, mismo campo que ya usa el
  // filtro de Gastos); "Módulo Bancario Conectado"/"Conciliación
  // automática... 10 complementos XML" se quitaron (no existe, mismo
  // criterio que "PAC Conectado" en Ventas); la sugerencia se volvió
  // honesta: gastos sin comprobante REALES del mes, botón real a Gastos
  // filtrado.
  function gastosCatConstruirHTML() {
    return `
      <div class="resumen-fin-header-tags">
        <span class="resumen-fin-header-tag" id="gastos-cat-rica-tag-q">—</span>
        <span class="resumen-fin-header-tag resumen-fin-header-tag-pendiente" data-tooltip="Buscar transferencias en tus estados de cuenta (PDF) y conciliarlas contra tus gastos — función planeada, todavía no está construida.">Conciliación de pagos · Próximamente</span>
      </div>
      <div class="unm-kpis">
        <div class="unm-kpi">
          <div class="unm-kpi-top"><span>Total gastos</span><span class="unm-badge" id="gastos-cat-rica-kpi-ncats">—</span></div>
          <div class="unm-kpi-val" id="gastos-cat-rica-kpi-total">—</div>
          <p class="unm-kpi-note">Corte del mes en curso</p>
        </div>
        <div class="unm-kpi unm-kpi-neg">
          <div class="unm-kpi-top"><span>Mayor centro de costo</span><span class="unm-badge unm-badge-neg" id="gastos-cat-rica-kpi-mayor-pct">—</span></div>
          <div class="unm-kpi-val unm-c-neg" id="gastos-cat-rica-kpi-mayor-monto">—</div>
          <p class="unm-kpi-note" id="gastos-cat-rica-kpi-mayor-nombre"></p>
        </div>
        <div class="unm-kpi">
          <div class="unm-kpi-top"><span>Gastos variables</span><span class="unm-badge" id="gastos-cat-rica-kpi-var-pct">—</span></div>
          <div class="unm-kpi-val" id="gastos-cat-rica-kpi-var-monto">—</div>
          <p class="unm-kpi-note">Categorías marcadas "Variable" en Categorías</p>
        </div>
        <div class="unm-kpi">
          <div class="unm-kpi-top"><span>Cierre mensual</span></div>
          <div class="unm-kpi-val" id="gastos-cat-rica-kpi-cierre">—</div>
          <p class="unm-kpi-note">Ventas y Gastos se archivan automáticamente el día 1</p>
        </div>
      </div>

      <div class="fact-rica-grid">
        <div class="fact-rica-donut-col">
          <div class="resumen-fin-donut-body">
            <div class="resumen-fin-donut-wrap">
              <svg class="resumen-fin-donut" id="gastos-cat-rica-donut" viewBox="0 0 100 100" width="140" height="140" aria-hidden="true"></svg>
              <div class="resumen-fin-donut-centro">
                <span class="resumen-fin-donut-total" id="gastos-cat-rica-donut-total">$0</span>
                <span class="resumen-fin-donut-total-label">Gastos</span>
              </div>
            </div>
          </div>
        </div>
        <div class="fact-rica-barras-col" id="gastos-cat-rica-barras"></div>
      </div>

      <div class="fact-rica-sugerencia" id="gastos-cat-rica-sugerencia" hidden>
        <span class="fact-rica-sugerencia-ic" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <div class="fact-rica-sugerencia-texto">
          <div class="fact-rica-sugerencia-titulo">Gastos sin comprobante este mes</div>
          <div id="gastos-cat-rica-sugerencia-desc">—</div>
        </div>
        <button type="button" class="btn btn-secondary fact-rica-sugerencia-btn" id="gastos-cat-rica-btn-ir-gastos">Ver en Gastos</button>
      </div>

      <div class="unm-tabla-wrap">
        <div class="unm-tabla-head">
          <h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/></svg> Detalle por categoría</h3>
          <span class="unm-tabla-nota">Variación vs. el mes anterior</span>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table unm-tabla">
            <thead><tr><th>Categoría</th><th>Monto</th><th>%</th><th>Variación MoM</th><th>Con comprobante</th><th>Acción</th></tr></thead>
            <tbody id="gastos-cat-rica-tabla-body"></tbody>
          </table>
        </div>
      </div>

      <p class="resumen-fin-proyeccion-nota">"Variable" o "Fijo" se asigna por categoría desde "Categorías" en Gastos — no es un cálculo automático.</p>
    `;
  }

  function irACategoriaGasto(slug) {
    if (els.gastosFiltroCategoria) els.gastosFiltroCategoria.value = slug;
    if (els.gastosFiltroFactura) els.gastosFiltroFactura.value = '';
    cambiarVistaPrincipal('gastos');
    cerrarDetalleGrafica();
  }

  function gastosCatPintarRica(mes, filas) {
    const totalGeneral = filas.reduce((acc, f) => acc + f.monto, 0);
    const hoy = new Date();
    const trimestre = Math.floor(hoy.getMonth() / 3) + 1;
    document.getElementById('gastos-cat-rica-tag-q').textContent = `Q${trimestre} ${hoy.getFullYear()}`;

    document.getElementById('gastos-cat-rica-kpi-ncats').textContent = `${filas.length} cat${filas.length === 1 ? '' : 's'}`;
    document.getElementById('gastos-cat-rica-kpi-total').textContent = `$${formatearMoneda(totalGeneral)}`;

    if (filas.length > 0) {
      const mayor = filas[0];
      const pctMayor = totalGeneral > 0 ? Math.round((mayor.monto / totalGeneral) * 100) : 0;
      document.getElementById('gastos-cat-rica-kpi-mayor-pct').textContent = `${pctMayor}%`;
      document.getElementById('gastos-cat-rica-kpi-mayor-monto').textContent = `$${formatearMoneda(mayor.monto)}`;
      document.getElementById('gastos-cat-rica-kpi-mayor-nombre').textContent = etiquetaCategoriaGasto(mayor.categoria);
    }

    const gastosVariables = mes.gastos_variables || 0;
    const pctVariables = totalGeneral > 0 ? Math.round((gastosVariables / totalGeneral) * 100) : 0;
    document.getElementById('gastos-cat-rica-kpi-var-pct').textContent = `${pctVariables}%`;
    document.getElementById('gastos-cat-rica-kpi-var-monto').textContent = `$${formatearMoneda(gastosVariables)}`;

    const { diasRestantes } = calcularCierreMensual();
    document.getElementById('gastos-cat-rica-kpi-cierre').textContent = `${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`;

    const principales = filas.slice(0, RESUMEN_FIN_PALETA_CATEGORICA.length);
    const resto = filas.slice(RESUMEN_FIN_PALETA_CATEGORICA.length);
    const totalResto = resto.reduce((acc, f) => acc + f.monto, 0);
    const segmentos = principales.map((f, i) => ({ valor: f.monto, color: RESUMEN_FIN_PALETA_CATEGORICA[i] }));
    if (totalResto > 0) segmentos.push({ valor: totalResto, color: RESUMEN_FIN_COLOR_OTROS_CATEGORIA });
    if (segmentos.length > 0) renderDonutGenerico(document.getElementById('gastos-cat-rica-donut'), segmentos);
    document.getElementById('gastos-cat-rica-donut-total').textContent = `$${formatearMoneda(totalGeneral)}`;

    const barrasCol = document.getElementById('gastos-cat-rica-barras');
    barrasCol.innerHTML = principales.map((f, i) => {
      const pct = totalGeneral > 0 ? Math.round((f.monto / totalGeneral) * 100) : 0;
      const pctComprobante = f.cantidad > 0 ? Math.round((f.con_comprobante / f.cantidad) * 100) : 0;
      return `
        <div class="fact-rica-barra">
          <div class="fact-rica-barra-head">
            <span><span class="fact-rica-barra-dot" style="background:${RESUMEN_FIN_PALETA_CATEGORICA[i]}"></span>${escapeHtml(etiquetaCategoriaGasto(f.categoria))}</span>
            <strong>$${formatearMoneda(f.monto)} (${pct}%)</strong>
          </div>
          <div class="fact-rica-barra-track"><div class="fact-rica-barra-fill" style="width:${pct}%;background:${RESUMEN_FIN_PALETA_CATEGORICA[i]}"></div></div>
          <p class="fact-rica-barra-nota">${pctComprobante}% con comprobante (${f.con_comprobante} de ${f.cantidad})</p>
        </div>
      `;
    }).join('') + (totalResto > 0 ? (() => {
      const pctResto = totalGeneral > 0 ? Math.round((totalResto / totalGeneral) * 100) : 0;
      return `
        <div class="fact-rica-barra">
          <div class="fact-rica-barra-head">
            <span><span class="fact-rica-barra-dot" style="background:${RESUMEN_FIN_COLOR_OTROS_CATEGORIA}"></span>Otros (${resto.length} categoría${resto.length === 1 ? '' : 's'})</span>
            <strong>$${formatearMoneda(totalResto)} (${pctResto}%)</strong>
          </div>
          <div class="fact-rica-barra-track"><div class="fact-rica-barra-fill" style="width:${pctResto}%;background:${RESUMEN_FIN_COLOR_OTROS_CATEGORIA}"></div></div>
        </div>
      `;
    })() : '');

    const sinComprobante = mes.gastos_sin_comprobante || 0;
    const sinComprobanteCant = mes.gastos_sin_comprobante_cantidad || 0;
    const sugerencia = document.getElementById('gastos-cat-rica-sugerencia');
    sugerencia.hidden = sinComprobante <= 0;
    if (sinComprobante > 0) {
      document.getElementById('gastos-cat-rica-sugerencia-desc').textContent =
        `$${formatearMoneda(sinComprobante)} en ${sinComprobanteCant} gasto${sinComprobanteCant === 1 ? '' : 's'} todavía sin comprobante fiscal.`;
    }
    document.getElementById('gastos-cat-rica-btn-ir-gastos').onclick = irAGastosSinComprobante;

    document.getElementById('gastos-cat-rica-tabla-body').innerHTML = filas.map((f) => {
      const pct = totalGeneral > 0 ? Math.round((f.monto / totalGeneral) * 100) : 0;
      const pctComprobante = f.cantidad > 0 ? Math.round((f.con_comprobante / f.cantidad) * 100) : 0;
      const mom = f.variacion_mom;
      const momTexto = mom === null ? '—' : `${mom >= 0 ? '+' : ''}${mom}%`;
      const momClase = mom === null ? '' : mom >= 0 ? 'unm-c-neg' : 'unm-c-pos';
      return `
        <tr>
          <td>${escapeHtml(etiquetaCategoriaGasto(f.categoria))}</td>
          <td>$${formatearMoneda(f.monto)}</td>
          <td>${pct}%</td>
          <td class="${momClase}">${momTexto}</td>
          <td>${pctComprobante}% (${f.con_comprobante}/${f.cantidad})</td>
          <td><button type="button" class="unm-btn-export" data-categoria="${escapeHtml(f.categoria)}">Ver en Gastos</button></td>
        </tr>
      `;
    }).join('');
    document.getElementById('gastos-cat-rica-tabla-body').querySelectorAll('button[data-categoria]').forEach((btn) => {
      btn.addEventListener('click', () => irACategoriaGasto(btn.dataset.categoria));
    });
  }

  function abrirDetalleGastosCategoriaRica() {
    const origenBoton = document.querySelector('[data-detalle-contenido="resumen-fin-donut-categorias-contenido"]');
    const header = origenBoton ? origenBoton.closest('.resumen-fin-card-header') : null;
    const iconoOrigen = header ? header.querySelector('.inicio-stat-icono') : null;
    els.resumenFinDetalleTitulo.textContent = 'Distribución de gastos por categoría';
    els.resumenFinDetalleIcono.className = iconoOrigen ? iconoOrigen.className : 'inicio-stat-icono';
    els.resumenFinDetalleIcono.innerHTML = iconoOrigen ? iconoOrigen.innerHTML : '';

    detalleEsRico = true;
    if (els.resumenFinDetalleModal) els.resumenFinDetalleModal.classList.add('resumen-fin-detalle-modal-ancha');
    els.resumenFinDetalleBody.innerHTML = gastosCatConstruirHTML();
    els.resumenFinDetalleOverlay.hidden = false;
    gastosCatPintarRica(cacheMesActualFacturacion || {}, cacheGastosPorCategoria);
    els.btnResumenFinDetalleCerrar.focus();
  }

  document.querySelectorAll('.resumen-fin-expandir-btn').forEach((boton) => {
    if (boton.dataset.detalleContenido === 'resumen-fin-donut-categorias-contenido') {
      boton.addEventListener('click', abrirDetalleGastosCategoriaRica);
      return;
    }
    if (boton.dataset.detalleContenido === 'resumen-fin-balance-contenido') {
      boton.addEventListener('click', abrirDetalleUtilidadNetaRica);
      return;
    }
    if (boton.dataset.detalleContenido === 'resumen-fin-proyeccion-contenido') {
      boton.addEventListener('click', abrirDetalleProyeccionRica);
      return;
    }
    if (boton.dataset.detalleContenido === 'resumen-fin-donut-facturacion-contenido') {
      boton.addEventListener('click', abrirDetalleFacturacionRica);
      return;
    }
    boton.addEventListener('click', () => abrirDetalleGrafica(boton));
  });
  els.btnResumenFinDetalleCerrar.addEventListener('click', cerrarDetalleGrafica);
  els.resumenFinDetalleOverlay.addEventListener('click', (e) => {
    if (e.target === els.resumenFinDetalleOverlay) cerrarDetalleGrafica();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.resumenFinDetalleOverlay.hidden) cerrarDetalleGrafica();
  });

  // Se cachean junto con gastosActuales para poder re-renderizar (al
  // cambiar la cola offline) sin tener que repetir la petición — ver
  // renderizarGastosConPendientes().
  let gastosResumenActual = null;
  let gastosTotalActual = 0;

  async function cargarGastos() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    // Sin conexión: se sigue mostrando la última lista ya cargada +
    // lo pendiente de sincronizar, sin intentar la petición — ver
    // PROJECT_STATE.md punto 132.
    if (window.OfflineQueue && OfflineQueue.isOffline()) {
      renderizarGastosConPendientes();
      return;
    }

    els.gastosError.textContent = '';
    Esqueleto.marcarKpisCargando(els.gastosResumenWrap, true);
    Esqueleto.aplicarEsqueletoTabla(els.gastosTableBody, 7);
    try {
      const params = new URLSearchParams();
      if (state.vistaGastos === 'papelera') params.set('papelera', 'true');
      if (els.gastosFiltroPeriodo && els.gastosFiltroPeriodo.value) params.set('periodo', els.gastosFiltroPeriodo.value);
      if (els.gastosFiltroCategoria.value) params.set('categoria', els.gastosFiltroCategoria.value);
      if (els.gastosFiltroFactura.value !== '') params.set('tiene_factura', els.gastosFiltroFactura.value);
      if (els.gastosFiltroRecurrente.value !== '') params.set('recurrente', els.gastosFiltroRecurrente.value);
      if (els.gastosFiltroDesde.value) params.set('fecha_desde', els.gastosFiltroDesde.value);
      if (els.gastosFiltroHasta.value) params.set('fecha_hasta', els.gastosFiltroHasta.value);
      if (els.gastosBusqueda.value.trim()) params.set('busqueda', els.gastosBusqueda.value.trim());

      const res = await fetch(`${API_BASE}/admin/gastos?${params.toString()}`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        Esqueleto.marcarKpisCargando(els.gastosResumenWrap, false);
        Esqueleto.aplicarErrorTabla(els.gastosTableBody, 7, 'No se pudieron cargar los gastos.', cargarGastos);
        return;
      }
      const data = await res.json();
      gastosActuales = data.gastos || [];
      gastosResumenActual = data.resumen || null;
      gastosTotalActual = data.total;
      await renderizarGastosConPendientes();
      Esqueleto.quitarEsqueletoTabla(els.gastosTableBody);
      Esqueleto.marcarKpisCargando(els.gastosResumenWrap, false);
    } catch (err) {
      Esqueleto.marcarKpisCargando(els.gastosResumenWrap, false);
      Esqueleto.aplicarErrorTabla(els.gastosTableBody, 7, 'No se pudo conectar con el servidor.', cargarGastos);
    }
  }

  // Convierte una fila de la cola offline en un objeto con la misma forma
  // que ya espera renderGastos/filaGastoPendiente.
  function gastoPendienteAVista(item) {
    const fecha = new Date(item.creadoEn);
    return {
      __pendiente: true,
      __localId: item.localId,
      __error: item.error,
      fecha: fecha.toISOString().slice(0, 10),
      concepto: item.datos.concepto,
      proveedor: item.datos.proveedor,
      categoria: item.datos.categoria,
      monto: item.datos.monto,
    };
  }

  // Re-renderiza Gastos con lo pendiente de sincronizar mezclado arriba —
  // se usa tanto al cargar offline como cuando cambia la cola (agregar,
  // descartar, reintentar), sin volver a pedirle nada al servidor.
  async function renderizarGastosConPendientes() {
    let pendientes = [];
    if (window.OfflineQueue && state.vistaGastos !== 'papelera') {
      try {
        const crudas = await OfflineQueue.listarPendientes('gastos');
        pendientes = crudas.map(gastoPendienteAVista);
      } catch (err) {
        pendientes = [];
      }
    }
    renderGastos([...pendientes, ...gastosActuales], gastosResumenActual, gastosTotalActual + pendientes.length);
  }

  // Fila de un gasto capturado sin conexión, todavía sin id real (ver
  // PROJECT_STATE.md punto 132) — sin comprobante (esa parte siempre
  // requiere conexión, se adjunta después) ni acciones de
  // editar/papelera, que solo aplican a un gasto que ya existe de
  // verdad en el servidor.
  function filaGastoPendiente(g) {
    const tr = document.createElement('tr');
    tr.className = `fila-pendiente-sync${g.__error ? ' tiene-error' : ''}`;
    const badgeTexto = g.__error ? '⚠ No se pudo sincronizar' : '⏳ Pendiente de sincronizar';
    const errorHtml = g.__error ? `<span class="pendiente-sync-error">${escapeHtml(g.__error)}</span>` : '';
    tr.innerHTML = `
      <td data-label="Fecha" data-col="fecha">${formatoFechaGasto(g.fecha)}</td>
      <td data-label="Concepto" data-col="concepto"><span class="pendiente-sync-badge">${badgeTexto}</span>${errorHtml}<div>${escapeHtml(g.concepto)}</div></td>
      <td data-label="Proveedor" data-col="proveedor">${escapeHtml(g.proveedor || '—')}</td>
      <td data-label="Categoría" data-col="categoria"><span class="gasto-categoria">${escapeHtml(etiquetaCategoriaGasto(g.categoria))}</span></td>
      <td data-label="Factura" data-col="factura">—</td>
      <td data-label="Monto" data-col="monto"><strong>$${formatearMoneda(g.monto)}</strong></td>
      <td data-label=""></td>
    `;
    const celdaAcciones = tr.lastElementChild;
    const contenedor = document.createElement('div');
    contenedor.className = 'pendiente-sync-acciones';

    if (g.__error) {
      const btnReintentar = document.createElement('button');
      btnReintentar.type = 'button';
      btnReintentar.className = 'btn btn-secondary';
      btnReintentar.textContent = 'Reintentar';
      btnReintentar.addEventListener('click', async () => {
        btnReintentar.disabled = true;
        await OfflineQueue.reintentarUno('gastos', g.__localId);
      });
      contenedor.appendChild(btnReintentar);
    }

    const btnDescartar = document.createElement('button');
    btnDescartar.type = 'button';
    btnDescartar.className = 'btn btn-secondary';
    btnDescartar.textContent = 'Descartar';
    btnDescartar.addEventListener('click', () => {
      abrirConfirmacion({
        titulo: '¿Descartar este gasto pendiente?',
        mensaje: 'Se borra de la cola local sin registrarse en el servidor — no se puede deshacer.',
        textoBoton: 'Descartar',
        onConfirmar: () => OfflineQueue.eliminarPendiente('gastos', g.__localId),
      });
    });
    contenedor.appendChild(btnDescartar);

    celdaAcciones.appendChild(contenedor);
    return tr;
  }

  // Punto 191 (Fase 1 UX): distingue "nunca has registrado un gasto" (con
  // guía + botón) de "tus filtros no encontraron nada" (mensaje simple) —
  // mismo criterio que ya usaban Ventas/Cuentas por cobrar
  // (ordenes-filtro-empty/cxc-filtro-empty), que Gastos no tenía.
  function hayFiltrosGastosActivos() {
    return Boolean(
      els.gastosFiltroCategoria.value ||
      els.gastosFiltroFactura.value !== '' ||
      els.gastosFiltroRecurrente.value !== '' ||
      els.gastosFiltroDesde.value ||
      els.gastosFiltroHasta.value ||
      els.gastosBusqueda.value.trim()
    );
  }

  function renderGastos(gastos, resumen, total) {
    const esPapelera = state.vistaGastos === 'papelera';
    const cuenta = Number.isFinite(total) ? total : gastos.length;
    els.gastosResumenWrap.hidden = esPapelera;
    els.gastosCount.textContent = `${cuenta} gasto${cuenta === 1 ? '' : 's'}`;

    const vacio = gastos.length === 0;
    const hayFiltro = hayFiltrosGastosActivos();
    els.gastosEmpty.hidden = !(vacio && !esPapelera && !hayFiltro);
    els.gastosFiltroEmpty.hidden = !(vacio && !esPapelera && hayFiltro);
    els.gastosPapeleraEmpty.hidden = !(vacio && esPapelera);
    renderFiltrosChips(els.gastosFiltrosChips, [
      { etiqueta: 'Categoría', valor: textoOpcionSeleccionada(els.gastosFiltroCategoria), campos: [els.gastosFiltroCategoria] },
      { etiqueta: 'Factura', valor: els.gastosFiltroFactura.value !== '' ? textoOpcionSeleccionada(els.gastosFiltroFactura) : '', campos: [els.gastosFiltroFactura] },
      { etiqueta: 'Recurrente', valor: els.gastosFiltroRecurrente.value !== '' ? textoOpcionSeleccionada(els.gastosFiltroRecurrente) : '', campos: [els.gastosFiltroRecurrente] },
      { etiqueta: 'Fechas', valor: (els.gastosFiltroDesde.value || els.gastosFiltroHasta.value) ? `${els.gastosFiltroDesde.value || '…'} – ${els.gastosFiltroHasta.value || '…'}` : '', campos: [els.gastosFiltroDesde, els.gastosFiltroHasta] },
      { etiqueta: 'Buscar', valor: els.gastosBusqueda.value.trim(), campos: [els.gastosBusqueda] },
    ]);

    if (!esPapelera && resumen) {
      const { mes_actual, con_factura, sin_factura, mes_anterior, cantidad } = resumen;
      els.gastosKpiMes.textContent = `$${formatearMoneda(mes_actual)}`;
      els.gastosKpiMesTendencia.textContent = `${cantidad} gasto${cantidad === 1 ? '' : 's'} este mes`;
      els.gastosKpiConFactura.textContent = `$${formatearMoneda(con_factura)}`;
      const pctCon = mes_actual > 0 ? Math.round((con_factura / mes_actual) * 100) : 0;
      els.gastosKpiConFacturaTendencia.textContent = `${pctCon}% del mes`;
      els.gastosKpiSinFactura.textContent = `$${formatearMoneda(sin_factura)}`;
      const pctSin = mes_actual > 0 ? Math.round((sin_factura / mes_actual) * 100) : 0;
      els.gastosKpiSinFacturaTendencia.textContent = `${pctSin}% del mes`;
      const variacion = mes_anterior > 0 ? ((mes_actual - mes_anterior) / mes_anterior) * 100 : null;
      els.gastosKpiVs.classList.remove('es-positiva', 'es-negativa');
      if (variacion === null) {
        els.gastosKpiVs.textContent = '—';
        els.gastosKpiVsTendencia.textContent = 'Sin gastos registrados el mes anterior';
      } else {
        // En gastos, que el número suba es una mala noticia: subir =
        // "es-negativa", bajar = "es-positiva" (el color lo decide la
        // clase, no el signo del texto).
        const esAumento = variacion > 0;
        els.gastosKpiVs.textContent = `${esAumento ? '+' : '−'}${Math.abs(variacion).toFixed(1)}%`;
        els.gastosKpiVs.classList.add(esAumento ? 'es-negativa' : 'es-positiva');
        els.gastosKpiVsTendencia.textContent = `Mes anterior: $${formatearMoneda(mes_anterior)}`;
      }
    }

    els.gastosTableBody.innerHTML = '';
    gastos.forEach((g) => {
      if (g.__pendiente) {
        els.gastosTableBody.appendChild(filaGastoPendiente(g));
        return;
      }
      const badgeFactura = g.tiene_factura
        ? g.comprobante_nombre_guardado
          ? `<button type="button" class="gasto-factura-link" data-tooltip="Descargar comprobante" aria-label="Descargar comprobante">${g.comprobante_mime === 'application/zip' ? 'ZIP' : 'PDF'}</button>`
          : '<span class="estatus-badge estatus-listo">Con factura</span>'
        : '<span class="estatus-badge estatus-rechazado">Sin factura</span>';
      const recurrenteBadge = g.recurrente
        ? '<span class="estatus-badge estatus-proceso" data-tooltip="Gasto recurrente" aria-label="Gasto recurrente">⟳</span>'
        : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Fecha" data-col="fecha">${formatoFechaGasto(g.fecha)}</td>
        <td data-label="Concepto" data-col="concepto">${recurrenteBadge}<button type="button" class="gasto-concepto-link">${escapeHtml(g.concepto)}</button></td>
        <td data-label="Proveedor" data-col="proveedor">${escapeHtml(g.proveedor || '—')}</td>
        <td data-label="Categoría" data-col="categoria"><span class="gasto-categoria">${escapeHtml(etiquetaCategoriaGasto(g.categoria))}</span></td>
        <td data-label="Factura" data-col="factura">${badgeFactura}</td>
        <td data-label="Monto" data-col="monto"><strong>$${formatearMoneda(g.monto)}</strong></td>
        <td data-label=""></td>
      `;

      tr.querySelector('.gasto-concepto-link').addEventListener('click', () => abrirDetalleGasto(g));

      const linkComprobante = tr.querySelector('.gasto-factura-link');
      if (linkComprobante) {
        linkComprobante.addEventListener('click', () =>
          descargarComprobante(g.id, g.comprobante_nombre_original)
        );
      }

      const celdaAcciones = tr.lastElementChild;
      const contenedorAcciones = document.createElement('div');
      contenedorAcciones.className = 'admin-row-actions admin-row-actions-iconos';

      if (esPapelera) {
        const btnRestaurar = document.createElement('button');
        btnRestaurar.type = 'button';
        btnRestaurar.className = 'btn-icono-accion';
        btnRestaurar.setAttribute('data-tooltip', 'Restaurar gasto');
        btnRestaurar.setAttribute('aria-label', 'Restaurar gasto');
        btnRestaurar.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        btnRestaurar.addEventListener('click', () => confirmarRestaurarGasto(g.id, g.concepto));
        contenedorAcciones.appendChild(btnRestaurar);

        const btnEliminarPermanente = document.createElement('button');
        btnEliminarPermanente.type = 'button';
        btnEliminarPermanente.className = 'btn-icono-accion btn-icono-accion-peligro';
        btnEliminarPermanente.setAttribute('data-tooltip', 'Eliminar permanentemente');
        btnEliminarPermanente.setAttribute('aria-label', 'Eliminar permanentemente');
        btnEliminarPermanente.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        btnEliminarPermanente.addEventListener('click', () => confirmarEliminarGastoPermanente(g.id, g.concepto));
        contenedorAcciones.appendChild(btnEliminarPermanente);
      } else {
        const btnEditar = document.createElement('button');
        btnEditar.type = 'button';
        btnEditar.className = 'btn-icono-accion';
        btnEditar.setAttribute('data-tooltip', 'Editar gasto');
        btnEditar.setAttribute('aria-label', 'Editar gasto');
        btnEditar.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
        btnEditar.addEventListener('click', () => abrirGastoModal(g));
        contenedorAcciones.appendChild(btnEditar);

        const btnPapelera = document.createElement('button');
        btnPapelera.type = 'button';
        btnPapelera.className = 'btn-icono-accion btn-icono-accion-peligro';
        btnPapelera.setAttribute('data-tooltip', 'Mover a papelera');
        btnPapelera.setAttribute('aria-label', 'Mover a papelera');
        btnPapelera.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        btnPapelera.addEventListener('click', () => confirmarMoverGastoAPapelera(g.id, g.concepto));
        contenedorAcciones.appendChild(btnPapelera);
      }

      celdaAcciones.appendChild(contenedorAcciones);
      els.gastosTableBody.appendChild(tr);
    });
  }

  function cambiarVistaGastos(nuevaVista) {
    if (state.vistaGastos === nuevaVista) return;
    state.vistaGastos = nuevaVista;

    const esPapelera = nuevaVista === 'papelera';
    els.btnVerGastosActivos.classList.toggle('is-active', !esPapelera);
    els.btnVerGastosActivos.setAttribute('aria-selected', String(!esPapelera));
    els.btnVerGastosPapelera.classList.toggle('is-active', esPapelera);
    els.btnVerGastosPapelera.classList.toggle('is-danger-context', esPapelera);
    els.btnVerGastosPapelera.setAttribute('aria-selected', String(esPapelera));
    els.btnNuevoGasto.hidden = esPapelera;
    els.gastosResumenWrap.hidden = esPapelera;
    if (els.gastosFiltroPeriodo) els.gastosFiltroPeriodo.disabled = esPapelera;

    cargarGastos();
  }

  function limpiarFiltrosGastos() {
    if (els.gastosFiltroPeriodo) els.gastosFiltroPeriodo.value = '';
    els.gastosFiltroCategoria.value = '';
    els.gastosFiltroFactura.value = '';
    els.gastosFiltroRecurrente.value = '';
    els.gastosFiltroDesde.value = '';
    els.gastosFiltroHasta.value = '';
    els.gastosBusqueda.value = '';
    cargarGastos();
  }

  // ---------- Modal de registro/edición de gasto ----------

  function abrirGastoModal(gasto) {
    gastoModalEditando = gasto || null;
    els.gastosModalTitle.textContent = gasto ? 'Editar gasto' : 'Registrar gasto';
    els.btnGastosModalGuardarLabel.textContent = gasto ? 'Guardar cambios' : 'Guardar gasto';

    els.gastosModalFecha.value = gasto ? gasto.fecha : hoyParaGasto();
    els.gastosModalConcepto.value = gasto ? gasto.concepto : '';
    els.gastosModalConceptoContador.textContent = `${els.gastosModalConcepto.value.length} / 200`;
    els.gastosModalProveedor.value = gasto ? gasto.proveedor || '' : '';
    poblarSelectModalCategoria(gasto ? gasto.categoria : null);
    els.gastosModalCategoria.value = gasto ? gasto.categoria : '';
    els.gastosModalMonto.value = gasto ? gasto.monto.toFixed(2) : '';
    els.gastosModalIvaIncluido.checked = gasto ? gasto.iva_incluido : false;
    els.gastosModalRecurrente.checked = gasto ? gasto.recurrente : false;
    els.gastosModalNotas.value = gasto ? gasto.notas || '' : '';
    els.gastosModalComprobante.value = '';
    setGastoModalFactura(gasto ? gasto.tiene_factura : true);

    setFieldError('gastos-modal-fecha', '');
    setFieldError('gastos-modal-concepto', '');
    setFieldError('gastos-modal-proveedor', '');
    setFieldError('gastos-modal-categoria', '');
    setFieldError('gastos-modal-monto', '');
    setFieldError('gastos-modal-comprobante', '');
    setFieldError('gastos-modal-notas', '');
    els.gastosModalErrorGeneral.textContent = '';

    els.gastosCategoriasPanel.hidden = true;
    els.gastosModalCategoriaField.classList.remove('is-categorias-abierto');
    els.btnGastosCategoriasToggle.setAttribute('aria-expanded', 'false');
    categoriaGastoEditandoId = null;

    els.gastosModalOverlay.hidden = false;
    els.gastosModalFecha.focus();
  }

  function cerrarGastoModal() {
    els.gastosModalOverlay.hidden = true;
    gastoModalEditando = null;
    els.gastosModalComprobante.value = '';
  }

  function setGastoModalFactura(con) {
    gastoModalConFactura = Boolean(con);
    els.btnGastosModalConFactura.classList.toggle('is-active', gastoModalConFactura);
    els.btnGastosModalConFactura.setAttribute('aria-selected', String(gastoModalConFactura));
    els.btnGastosModalSinFactura.classList.toggle('is-active', !gastoModalConFactura);
    els.btnGastosModalSinFactura.setAttribute('aria-selected', String(!gastoModalConFactura));
    els.gastosModalComprobanteWrap.hidden = !gastoModalConFactura;
  }

  function setGuardarGastoLoading(cargando) {
    els.btnGastosModalGuardar.disabled = cargando;
    els.btnGastosModalGuardarLabel.textContent = cargando ? 'Guardando…' : gastoModalEditando ? 'Guardar cambios' : 'Guardar gasto';
  }

  async function guardarGasto() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    // Primeros pasos (Fase 2 UX): solo un gasto NUEVO cuenta como el paso
    // "registra tu primer gasto" — capturado antes del guardado porque
    // gastoModalEditando se limpia al cerrar el modal más abajo.
    const esGastoNuevoParaOnboarding = !gastoModalEditando;

    setFieldError('gastos-modal-fecha', '');
    setFieldError('gastos-modal-concepto', '');
    setFieldError('gastos-modal-proveedor', '');
    setFieldError('gastos-modal-categoria', '');
    setFieldError('gastos-modal-monto', '');
    setFieldError('gastos-modal-comprobante', '');
    setFieldError('gastos-modal-notas', '');
    els.gastosModalErrorGeneral.textContent = '';

    const fecha = els.gastosModalFecha.value;
    if (!fecha) {
      setFieldError('gastos-modal-fecha', 'Selecciona la fecha del gasto.');
      return;
    }
    const concepto = els.gastosModalConcepto.value.trim();
    if (!concepto) {
      setFieldError('gastos-modal-concepto', 'El concepto es obligatorio.');
      return;
    }
    const categoria = els.gastosModalCategoria.value;
    if (!categoria) {
      setFieldError('gastos-modal-categoria', 'Selecciona una categoría.');
      return;
    }
    const montoTexto = els.gastosModalMonto.value.trim().replace(/,/g, '');
    const monto = Number(montoTexto);
    if (!Number.isFinite(monto) || monto <= 0) {
      setFieldError('gastos-modal-monto', 'El monto debe ser un número mayor a cero.');
      return;
    }

    const archivo = els.gastosModalComprobante.files[0];
    if (archivo) {
      const ext = archivo.name.split('.').pop().toLowerCase();
      if (!['pdf', 'zip'].includes(ext)) {
        setFieldError('gastos-modal-comprobante', 'Solo se acepta un PDF (la factura) o un ZIP (con el PDF y el XML).');
        return;
      }
      if (archivo.size > MAX_COMPROBANTE_MB * 1024 * 1024) {
        setFieldError('gastos-modal-comprobante', `El archivo excede el tamaño máximo permitido de ${MAX_COMPROBANTE_MB} MB.`);
        return;
      }
    }

    const cuerpo = {
      fecha,
      concepto,
      proveedor: els.gastosModalProveedor.value.trim(),
      categoria,
      monto,
      iva_incluido: els.gastosModalIvaIncluido.checked,
      tiene_factura: gastoModalConFactura,
      recurrente: els.gastosModalRecurrente.checked,
      notas: els.gastosModalNotas.value.trim(),
    };

    // Sin conexión: solo se puede CREAR (no editar) — se encola en
    // IndexedDB, sin comprobante (esa parte siempre requiere conexión,
    // ver PROJECT_STATE.md punto 132; se adjunta después desde el
    // detalle, igual que ya se hace hoy si la subida falla).
    if (!gastoModalEditando && window.OfflineQueue && OfflineQueue.isOffline()) {
      await OfflineQueue.agregarPendiente('gastos', cuerpo);
      showToast(
        archivo
          ? 'Gasto guardado sin conexión — se registrará al recuperar internet. El comprobante se debe adjuntar después, ya conectado.'
          : 'Gasto guardado sin conexión — se registrará al recuperar internet.'
      );
      cerrarGastoModal();
      renderizarGastosConPendientes();
      return;
    }

    setGuardarGastoLoading(true);
    try {
      let idGasto;
      if (gastoModalEditando) {
        const res = await fetch(`${API_BASE}/admin/gastos/${gastoModalEditando.id}`, {
          method: 'PUT',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          clearSession();
          showLogin();
          return;
        }
        if (!res.ok) {
          els.gastosModalErrorGeneral.textContent = data.error || 'No se pudo actualizar el gasto.';
          return;
        }
        idGasto = gastoModalEditando.id;
        showToast(data.mensaje || 'Gasto actualizado.');
      } else {
        const res = await fetch(`${API_BASE}/admin/gastos`, {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          clearSession();
          showLogin();
          return;
        }
        if (!res.ok) {
          els.gastosModalErrorGeneral.textContent = data.error || 'No se pudo registrar el gasto.';
          return;
        }
        idGasto = data.id;
        showToast(data.mensaje || 'Gasto registrado.');
      }

      if (gastoModalConFactura && archivo) {
        const formData = new FormData();
        formData.append('comprobante', archivo);
        const resSubida = await fetch(`${API_BASE}/admin/gastos/${idGasto}/comprobante`, {
          method: 'POST',
          headers: { Authorization: authHeader },
          body: formData,
        });
        const dataSubida = await resSubida.json().catch(() => ({}));
        if (!resSubida.ok) {
          // El gasto ya quedó guardado; solo falló el comprobante, y se
          // avisa para que se adjunte después desde el detalle.
          showToast(
            `${dataSubida.error || 'No se pudo subir el comprobante.'} El gasto ya quedó guardado; adjunta el comprobante desde el detalle.`,
            true
          );
        }
      }

      cerrarGastoModal();
      cargarGastos();
      if (esGastoNuevoParaOnboarding) {
        guardarEstadoOnboarding({ gastoCreado: true });
        renderOnboardingChecklist();
      }
    } catch (err) {
      els.gastosModalErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setGuardarGastoLoading(false);
    }
  }

  // ---------- Modal de detalle de gasto ----------

  function abrirDetalleGasto(g) {
    gastoDetalleActual = g;
    els.gastosDetalleTitle.textContent = 'Detalle del gasto';
    els.gastosDetalleBadge.hidden = !g.recurrente;

    els.gastosDetalleFecha.textContent = formatoFechaGasto(g.fecha);
    els.gastosDetalleConcepto.textContent = g.concepto;
    els.gastosDetalleProveedorItem.hidden = !g.proveedor;
    els.gastosDetalleProveedor.textContent = g.proveedor || '—';
    els.gastosDetalleCategoria.textContent = etiquetaCategoriaGasto(g.categoria);
    els.gastosDetalleMonto.textContent = `$${formatearMoneda(g.monto)} MXN`;
    els.gastosDetalleIva.textContent = g.iva_incluido ? 'Sí' : 'No';
    els.gastosDetalleRecurrente.textContent = g.recurrente ? 'Sí' : 'No';
    els.gastosDetalleNotasItem.hidden = !g.notas;
    els.gastosDetalleNotas.textContent = g.notas || '—';

    els.gastosDetalleFacturaBadge.textContent = g.tiene_factura ? 'Con factura' : 'Sin factura';
    els.gastosDetalleFacturaBadge.classList.toggle('estatus-listo', g.tiene_factura);
    els.gastosDetalleFacturaBadge.classList.toggle('estatus-rechazado', !g.tiene_factura);

    const tieneComprobante = Boolean(g.comprobante_nombre_guardado);
    els.gastosDetalleComprobanteWrap.hidden = !tieneComprobante;
    if (tieneComprobante) {
      els.gastosDetalleComprobanteNombre.textContent =
        g.comprobante_nombre_original || (g.comprobante_mime === 'application/zip' ? 'comprobante.zip' : 'comprobante.pdf');
      els.btnGastosDetalleDescargarLabel.textContent =
        g.comprobante_mime === 'application/zip' ? 'Descargar ZIP' : 'Descargar PDF';
    }

    els.gastosDetalleOverlay.hidden = false;
  }

  function cerrarDetalleGasto() {
    els.gastosDetalleOverlay.hidden = true;
    gastoDetalleActual = null;
  }

  async function descargarComprobante(id, nombreOriginal) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/gastos/${id}/comprobante`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'No se pudo descargar el comprobante.', true);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreOriginal || `comprobante-${id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  function confirmarQuitarComprobante() {
    if (!gastoDetalleActual) return;
    abrirConfirmacion({
      titulo: '¿Quitar comprobante?',
      mensaje:
        'Se eliminará el archivo del comprobante de forma permanente. El gasto se mantendrá marcado como "con factura".',
      textoBoton: 'Quitar',
      onConfirmar: () => quitarComprobante(gastoDetalleActual.id),
    });
  }

  async function quitarComprobante(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/gastos/${id}/comprobante`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo quitar el comprobante.', true);
        return;
      }
      showToast(data.mensaje || 'Comprobante eliminado.');
      cerrarDetalleGasto();
      cargarGastos();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  function confirmarMoverGastoAPapelera(id, concepto) {
    abrirConfirmacion({
      titulo: '¿Mover a la papelera?',
      mensaje: `El gasto "${concepto}" se moverá a la papelera. Podrás restaurarlo o eliminarlo permanentemente después.`,
      textoBoton: 'Mover a papelera',
      onConfirmar: () => moverGastoAPapelera(id),
    });
  }

  async function moverGastoAPapelera(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/gastos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo mover el gasto a la papelera.', true);
        return;
      }
      showToast(data.mensaje || 'Gasto movido a la papelera.');
      if (gastoDetalleActual && gastoDetalleActual.id === id) cerrarDetalleGasto();
      cargarGastos();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  function confirmarRestaurarGasto(id, concepto) {
    abrirConfirmacion({
      titulo: '¿Restaurar gasto?',
      mensaje: `El gasto "${concepto}" volverá a la lista de gastos activos.`,
      textoBoton: 'Restaurar',
      onConfirmar: () => restaurarGasto(id),
    });
  }

  async function restaurarGasto(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/gastos/${id}/restaurar`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo restaurar el gasto.', true);
        return;
      }
      showToast(data.mensaje || 'Gasto restaurado.');
      cargarGastos();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  function confirmarEliminarGastoPermanente(id, concepto) {
    abrirConfirmacion({
      titulo: '¿Eliminar permanentemente?',
      mensaje: `El gasto "${concepto}" y su comprobante (si tiene) se eliminarán de forma permanente. Esta acción no se puede deshacer.`,
      textoBoton: 'Eliminar',
      onConfirmar: () => eliminarGastoPermanente(id),
    });
  }

  async function eliminarGastoPermanente(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/gastos/${id}/permanente`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo eliminar el gasto.', true);
        return;
      }
      showToast(data.mensaje || 'Gasto eliminado permanentemente.');
      cargarGastos();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  llenarSelectsCategoriaGasto();
  formatearCampoDinero(els.gastosModalMonto);

  els.btnVerGastosActivos.addEventListener('click', () => cambiarVistaGastos('activos'));
  els.btnVerGastosPapelera.addEventListener('click', () => cambiarVistaGastos('papelera'));
  els.btnRefreshGastos.addEventListener('click', cargarGastos);
  els.btnNuevoGasto.addEventListener('click', () => abrirGastoModal(null));
  els.btnLimpiarFiltrosGastos.addEventListener('click', limpiarFiltrosGastos);
  if (els.gastosFiltroPeriodo) els.gastosFiltroPeriodo.addEventListener('change', cargarGastos);
  els.gastosFiltroCategoria.addEventListener('change', cargarGastos);
  els.gastosFiltroFactura.addEventListener('change', cargarGastos);
  els.gastosFiltroRecurrente.addEventListener('change', cargarGastos);
  els.gastosFiltroDesde.addEventListener('change', cargarGastos);
  els.gastosFiltroHasta.addEventListener('change', cargarGastos);
  els.gastosBusqueda.addEventListener('input', debounce(() => cargarGastos(), 350));
  els.gastosModalConcepto.addEventListener('input', () => {
    els.gastosModalConceptoContador.textContent = `${els.gastosModalConcepto.value.length} / 200`;
  });

  els.btnGastosCategoriasToggle.addEventListener('click', toggleCategoriasPanel);
  els.btnGastosCategoriaAgregar.addEventListener('click', agregarCategoriaGastoPanel);
  els.gastosCategoriaNuevaInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      agregarCategoriaGastoPanel();
    }
  });
  els.gastosCategoriasLista.addEventListener('click', (ev) => {
    const btnRenombrar = ev.target.closest('.gastos-categoria-renombrar');
    const btnGuardar = ev.target.closest('.btn-categoria-guardar');
    const btnCancelar = ev.target.closest('.gastos-categoria-cancelar');
    const btnBorrar = ev.target.closest('.gastos-categoria-borrar');
    const btnReactivar = ev.target.closest('.gastos-categoria-reactivar');
    if (btnReactivar) {
      reactivarCategoriaGastoPanel(Number(btnReactivar.dataset.id));
      return;
    }
    if (btnRenombrar) {
      categoriaGastoEditandoId = Number(btnRenombrar.dataset.id);
      renderPanelCategoriasGastos();
      const input = els.gastosCategoriasLista.querySelector('.gastos-categoria-input-editar');
      if (input) { input.focus(); input.select(); }
      return;
    }
    if (btnCancelar) {
      categoriaGastoEditandoId = null;
      renderPanelCategoriasGastos();
      return;
    }
    if (btnGuardar) {
      const id = Number(btnGuardar.dataset.id);
      const input = els.gastosCategoriasLista.querySelector('.gastos-categoria-input-editar');
      const etiqueta = input ? input.value.trim() : '';
      if (!etiqueta) {
        showToast('El nombre de la categoría es obligatorio.', true);
        return;
      }
      renombrarCategoriaGastoPanel(id, etiqueta);
      return;
    }
    if (btnBorrar) {
      const id = Number(btnBorrar.dataset.id);
      const cat = state.categoriasGastos.find((c) => c.id === id);
      confirmarEliminarCategoriaGasto(id, cat ? cat.etiqueta : 'esta categoría');
    }
  });
  els.gastosCategoriasLista.addEventListener('change', (ev) => {
    const select = ev.target.closest('.gastos-categoria-tipo');
    if (!select) return;
    actualizarTipoCategoriaGastoPanel(Number(select.dataset.id), select.value);
  });
  els.btnGastosModalConFactura.addEventListener('click', () => setGastoModalFactura(true));
  els.btnGastosModalSinFactura.addEventListener('click', () => setGastoModalFactura(false));
  els.btnGastosModalCerrar.addEventListener('click', cerrarGastoModal);
  els.btnGastosModalCancelar.addEventListener('click', cerrarGastoModal);
  els.gastosModalOverlay.addEventListener('click', (e) => {
    if (e.target === els.gastosModalOverlay) cerrarGastoModal();
  });
  els.btnGastosModalGuardar.addEventListener('click', guardarGasto);
  els.btnGastosDetalleCerrar.addEventListener('click', cerrarDetalleGasto);
  els.gastosDetalleOverlay.addEventListener('click', (e) => {
    if (e.target === els.gastosDetalleOverlay) cerrarDetalleGasto();
  });
  els.btnGastosDetalleDescargar.addEventListener('click', () => {
    if (gastoDetalleActual) descargarComprobante(gastoDetalleActual.id, gastoDetalleActual.comprobante_nombre_original);
  });
  els.btnGastosDetalleQuitarComprobante.addEventListener('click', confirmarQuitarComprobante);
  els.btnGastosDetalleEditar.addEventListener('click', () => {
    if (!gastoDetalleActual) return;
    const gasto = gastoDetalleActual;
    cerrarDetalleGasto();
    abrirGastoModal(gasto);
  });
  els.btnGastosDetalleEliminar.addEventListener('click', () => {
    if (!gastoDetalleActual) return;
    confirmarMoverGastoAPapelera(gastoDetalleActual.id, gastoDetalleActual.concepto);
  });

  // ---------- Cuentas por cobrar (punto 138) — nueva vista entre Ventas y Gastos ----------
  let cxcVista = 'pendientes'; // 'pendientes' | 'cobradas'
  let cxcOrdenActualCobro = null;

  function esVencida(orden) {
    if (!orden.fecha_vencimiento) return false;
    const hoy = new Date().toISOString().slice(0, 10);
    return orden.fecha_vencimiento < hoy;
  }

  // Días de mora (vencida) o días para vencer (sin vencer todavía) — base
  // de la antigüedad de saldos. Ambos en días de calendario, comparando
  // solo la parte de fecha (sin hora) para no depender de a qué hora del
  // día se cargó la vista.
  function diasDesdeVencimiento(orden) {
    if (!orden.fecha_vencimiento) return null;
    const hoy = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const vto = new Date(orden.fecha_vencimiento + 'T00:00:00Z');
    return Math.round((hoy - vto) / 86400000);
  }

  async function cargarCxc() {
    Esqueleto.marcarKpisCargando(els.cxcKpis, true);
    Esqueleto.aplicarEsqueletoTabla(els.cxcTableBody, 9);
    // Reusa ordenesCache si ya se cargó Ventas, si no la carga
    let ok = true;
    if (!ordenesCache || ordenesCache.length === 0) {
      ok = await cargarOrdenes();
    }
    if (ok === false) {
      Esqueleto.marcarKpisCargando(els.cxcKpis, false);
      Esqueleto.aplicarErrorTabla(els.cxcTableBody, 9, 'No se pudieron cargar las cuentas por cobrar.', cargarCxc);
      return;
    }
    renderCxc();
    Esqueleto.quitarEsqueletoTabla(els.cxcTableBody);
    Esqueleto.marcarKpisCargando(els.cxcKpis, false);
  }

  function aplicarFiltrosCxc(lista) {
    const q = (els.cxcFiltroCliente ? els.cxcFiltroCliente.value.trim().toLowerCase() : '');
    const fVto = els.cxcFiltroVencimiento ? els.cxcFiltroVencimiento.value : '';
    return lista.filter((o) => {
      const esPendiente = (o.estado_pago || 'pagada') === 'pendiente';
      const coincideVista = cxcVista === 'pendientes' ? esPendiente : !esPendiente;
      if (!coincideVista) return false;
      if (q) {
        const hay = (o.numero_compra && o.numero_compra.toLowerCase().includes(q)) || (o.email && o.email.toLowerCase().includes(q)) || (o.concepto && o.concepto.toLowerCase().includes(q)) || (o.cliente_nombre && o.cliente_nombre.toLowerCase().includes(q)) || (o.cliente_rfc && o.cliente_rfc.toLowerCase().includes(q));
        if (!hay) return false;
      }
      if (fVto === 'vencidas' && !esVencida(o)) return false;
      if (fVto === 'por_vencer' && (esVencida(o) || !o.fecha_vencimiento)) return false;
      if (fVto === 'sin_fecha' && o.fecha_vencimiento) return false;
      return true;
    });
  }

  // Métricas compartidas de Cuentas por cobrar — una sola fuente de
  // verdad usada tanto por la vista completa como por la tarjeta mini
  // "Cobranza del mes" de Resumen financiero, para no calcular lo mismo
  // dos veces con criterios que puedan divergir. 4 rangos de antigüedad
  // (no 5, a diferencia del mockup original) — colores reutilizados de
  // los ya validados en el resto del panel (accent/warn/error), sin
  // inventar tonos nuevos. "Índice de recuperación" y "DSO" del mockup se
  // dejaron fuera a propósito: no hay una fórmula de negocio acordada
  // para ninguno de los dos.
  function calcularMetricasCxc(ordenes) {
    const todas = ordenes || [];
    const pendientes = todas.filter((o) => (o.estado_pago || 'pagada') === 'pendiente');
    const cobradas = todas.filter((o) => (o.estado_pago || 'pagada') !== 'pendiente');
    const saldoDe = (o) => Math.round((Number(o.total) - Number(o.monto_cobrado || 0)) * 100) / 100;

    const porCobrar = Math.round(pendientes.reduce((s, o) => s + saldoDe(o), 0) * 100) / 100;
    const vencidasList = pendientes.filter(esVencida);
    const vencidasMonto = Math.round(vencidasList.reduce((s, o) => s + saldoDe(o), 0) * 100) / 100;
    const porVencer = pendientes.length - vencidasList.length;
    const porVencerMonto = Math.round((porCobrar - vencidasMonto) * 100) / 100;

    const mesActual = new Date().toISOString().slice(0, 7);
    const cobradoMes = Math.round(
      cobradas
        .filter((o) => o.fecha_cobro && String(o.fecha_cobro).slice(0, 7) === mesActual)
        .reduce((s, o) => s + Number(o.monto_cobrado || o.total), 0) * 100
    ) / 100;

    const sinFecha = pendientes.filter((o) => !o.fecha_vencimiento);
    const sinFechaMonto = Math.round(sinFecha.reduce((s, o) => s + saldoDe(o), 0) * 100) / 100;
    const sinVencer = pendientes.filter((o) => o.fecha_vencimiento && !esVencida(o));
    const sinVencerMonto = Math.round(sinVencer.reduce((s, o) => s + saldoDe(o), 0) * 100) / 100;
    const vencido30 = vencidasList.filter((o) => diasDesdeVencimiento(o) <= 30);
    const vencido30Monto = Math.round(vencido30.reduce((s, o) => s + saldoDe(o), 0) * 100) / 100;
    const vencidoMas30 = vencidasList.filter((o) => diasDesdeVencimiento(o) > 30);
    const vencidoMas30Monto = Math.round(vencidoMas30.reduce((s, o) => s + saldoDe(o), 0) * 100) / 100;

    const moraPromedio = vencidasList.length > 0
      ? Math.round(vencidasList.reduce((s, o) => s + diasDesdeVencimiento(o), 0) / vencidasList.length)
      : null;
    const saldoPromedio = pendientes.length > 0 ? Math.round((porCobrar / pendientes.length) * 100) / 100 : 0;

    return {
      pendientes, cobradas, vencidasList, sinVencer, sinFecha, vencido30, vencidoMas30,
      porCobrar, vencidasMonto, porVencer, porVencerMonto, cobradoMes,
      sinFechaMonto, sinVencerMonto, vencido30Monto, vencidoMas30Monto,
      moraPromedio, saldoPromedio,
    };
  }

  const CXC_AGING_BUCKETS = [
    { key: 'sinFecha', label: 'Sin fecha de vencimiento', color: 'var(--color-ink-soft)' },
    { key: 'sinVencer', label: 'Sin vencer', color: 'var(--color-accent)' },
    { key: 'vencido30', label: 'Vencido ≤ 30 días', color: 'var(--color-warn)' },
    { key: 'vencidoMas30', label: 'Vencido > 30 días', color: 'var(--color-error)' },
  ];

  function renderCxcAging(m) {
    if (!els.cxcAgingCard || !els.cxcAgingBars) return;
    const totalCartera = Math.round((m.cobradoMes + m.porCobrar) * 100) / 100;
    if (cxcVista !== 'pendientes' || totalCartera <= 0) {
      if (els.cxcAnalyticsGrid) els.cxcAnalyticsGrid.hidden = true;
      return;
    }
    if (els.cxcAnalyticsGrid) els.cxcAnalyticsGrid.hidden = false;
    els.cxcAgingCard.hidden = m.porCobrar <= 0;
    if (m.porCobrar > 0) {
      if (els.cxcAgingTotal) els.cxcAgingTotal.textContent = `Total: $${formatearMoneda(m.porCobrar)}`;
      const montoPorBucket = { sinFecha: m.sinFechaMonto, sinVencer: m.sinVencerMonto, vencido30: m.vencido30Monto, vencidoMas30: m.vencidoMas30Monto };
      const nPorBucket = { sinFecha: m.sinFecha.length, sinVencer: m.sinVencer.length, vencido30: m.vencido30.length, vencidoMas30: m.vencidoMas30.length };
      els.cxcAgingBars.innerHTML = CXC_AGING_BUCKETS
        .filter((b) => nPorBucket[b.key] > 0)
        .map((b) => {
          const monto = montoPorBucket[b.key];
          const n = nPorBucket[b.key];
          const pct = m.porCobrar > 0 ? Math.round((monto / m.porCobrar) * 1000) / 10 : 0;
          return `
            <div class="cxc-aging-bar">
              <div class="cxc-aging-bar-top">
                <span class="cxc-aging-bar-label"><span class="cxc-aging-bar-dot" style="background:${b.color}"></span>${b.label} — ${n} venta${n === 1 ? '' : 's'}</span>
                <span class="cxc-aging-bar-valor"><strong>$${formatearMoneda(monto)}</strong> (${pct}%)</span>
              </div>
              <div class="cxc-aging-track"><div class="cxc-aging-fill" style="width:${pct}%;background:${b.color}"></div></div>
            </div>`;
        })
        .join('');
      if (els.cxcAgingMora) els.cxcAgingMora.textContent = m.moraPromedio === null ? '—' : `${m.moraPromedio} día${m.moraPromedio === 1 ? '' : 's'}`;
      if (els.cxcAgingPromedio) els.cxcAgingPromedio.textContent = `$${formatearMoneda(m.saldoPromedio)}`;
    }
    renderCxcGauge(m, totalCartera);
  }

  // Gauge "Cobranza del mes" DENTRO de la vista completa de Cuentas por
  // cobrar — misma fórmula/datos que la mini tarjeta de Resumen
  // financiero (renderResumenFinCobranza), IDs propios porque un mismo
  // <svg> no puede vivir en 2 lugares del DOM a la vez.
  function renderCxcGauge(m, totalCartera) {
    if (!els.cxcGaugeDonut) return;
    renderDonutGenerico(els.cxcGaugeDonut, [
      { valor: m.porCobrar, color: '#FBEAE9' },
      { valor: m.cobradoMes, color: '#1FAE6B' },
    ]);
    const pctCobrado = totalCartera > 0 ? Math.round((m.cobradoMes / totalCartera) * 100) : 0;
    if (els.cxcGaugeTotal) els.cxcGaugeTotal.textContent = `${pctCobrado}%`;
    if (els.cxcGaugeCobrado) els.cxcGaugeCobrado.textContent = `$${formatearMoneda(m.cobradoMes)}`;
    if (els.cxcGaugePorcobrar) els.cxcGaugePorcobrar.textContent = `$${formatearMoneda(m.porCobrar)}`;
    if (els.cxcGaugeTotalCartera) els.cxcGaugeTotalCartera.textContent = `$${formatearMoneda(totalCartera)}`;
  }

  function renderCxcAlertaVencidas(m) {
    if (!els.cxcAlertaVencidas) return;
    if (cxcVista !== 'pendientes' || m.vencidasList.length === 0) {
      els.cxcAlertaVencidas.hidden = true;
      return;
    }
    els.cxcAlertaVencidas.hidden = false;
    const pct = m.porCobrar > 0 ? Math.round((m.vencidasMonto / m.porCobrar) * 100) : 0;
    if (els.cxcAlertaVencidasTexto) {
      els.cxcAlertaVencidasTexto.innerHTML = `<strong>${m.vencidasList.length} venta${m.vencidasList.length === 1 ? '' : 's'} vencida${m.vencidasList.length === 1 ? '' : 's'}</strong> representan el <strong>${pct}% ($${formatearMoneda(m.vencidasMonto)})</strong> de tus saldos pendientes.`;
    }
    if (els.btnCxcAlertaVer) {
      els.btnCxcAlertaVer.onclick = () => {
        if (els.cxcFiltroVencimiento) els.cxcFiltroVencimiento.value = 'vencidas';
        renderCxc();
      };
    }
    if (els.btnCxcRecordatorioMasivo) {
      els.btnCxcRecordatorioMasivo.onclick = () => enviarRecordatorioMasivo(m.vencidasList);
    }
  }

  async function enviarRecordatorioEmail(orden, boton) {
    const authHeader = getAuthHeader();
    if (!authHeader) { showLogin(); return false; }
    if (boton) boton.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/admin/ordenes-compra/${orden.id}/recordatorio`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'No se pudo enviar el recordatorio', 'error');
        return false;
      }
      return true;
    } catch (_) {
      showToast('No se pudo conectar con el servidor', 'error');
      return false;
    } finally {
      if (boton) boton.disabled = false;
    }
  }

  async function enviarRecordatorioMasivo(lista) {
    const conCorreo = lista.filter((o) => o.email);
    if (conCorreo.length === 0) { showToast('Ninguna de estas ventas tiene correo registrado', 'error'); return; }
    if (els.btnCxcRecordatorioMasivo) { els.btnCxcRecordatorioMasivo.disabled = true; els.btnCxcRecordatorioMasivo.textContent = 'Enviando…'; }
    let enviados = 0;
    for (const orden of conCorreo) {
      const ok = await enviarRecordatorioEmail(orden);
      if (ok) enviados += 1;
    }
    if (els.btnCxcRecordatorioMasivo) { els.btnCxcRecordatorioMasivo.disabled = false; els.btnCxcRecordatorioMasivo.textContent = 'Enviar recordatorio'; }
    const sinCorreo = lista.length - conCorreo.length;
    showToast(`Recordatorio enviado a ${enviados} de ${conCorreo.length}${sinCorreo > 0 ? ` (${sinCorreo} sin correo)` : ''}`);
  }

  function exportarCxcCsv(filas) {
    const csvCelda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const encabezado = ['No. Venta', 'Cliente', 'RFC', 'Total', 'Cobrado', 'Saldo', 'Vencimiento', 'Estado', 'Facturada'];
    const lineas = filas.map((o) => {
      const saldo = Math.round((Number(o.total) - Number(o.monto_cobrado || 0)) * 100) / 100;
      const vencida = esVencida(o);
      const estado = (o.estado_pago === 'pendiente') ? (vencida ? 'Vencida' : 'Pendiente') : 'Pagada';
      return [
        o.numero_compra || '', o.cliente_nombre || o.email || '', o.cliente_rfc || '',
        Number(o.total).toFixed(2), Number(o.monto_cobrado || 0).toFixed(2), saldo.toFixed(2),
        o.fecha_vencimiento || '', estado, o.facturado ? 'Sí' : 'No',
      ].map(csvCelda).join(',');
    });
    const csv = [encabezado.map(csvCelda).join(','), ...lineas].join('\r\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuentas-por-cobrar-${cxcVista}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderCxc() {
    if (!els.cxcTableBody) return;
    const todas = ordenesCache || [];
    const m = calcularMetricasCxc(todas);
    if (els.cxcKpiPorCobrar) els.cxcKpiPorCobrar.textContent = `$${formatearMoneda(m.porCobrar)}`;
    if (els.cxcKpiPorCobrarNota) els.cxcKpiPorCobrarNota.textContent = `${m.pendientes.length} venta${m.pendientes.length === 1 ? '' : 's'} pendiente${m.pendientes.length === 1 ? '' : 's'}`;
    if (els.cxcKpiVencidas) els.cxcKpiVencidas.textContent = String(m.vencidasList.length);
    if (els.cxcKpiVencidasNota) {
      const pctVenc = m.porCobrar > 0 ? Math.round((m.vencidasMonto / m.porCobrar) * 100) : 0;
      els.cxcKpiVencidasNota.textContent = m.vencidasList.length > 0 ? `${pctVenc}% de la cartera` : 'Pendientes vencidas';
    }
    if (els.cxcKpiPorVencer) els.cxcKpiPorVencer.textContent = String(m.porVencer);
    if (els.cxcKpiPorVencerNota) els.cxcKpiPorVencerNota.textContent = m.porVencer > 0 ? `$${formatearMoneda(m.porVencerMonto)}` : 'Sin vencer';
    if (els.cxcKpiCobradoMes) els.cxcKpiCobradoMes.textContent = `$${formatearMoneda(m.cobradoMes)}`;
    if (els.cxcCount) els.cxcCount.textContent = cxcVista === 'pendientes' ? `${m.pendientes.length} por cobrar` : `${m.cobradas.length} cobradas`;
    renderCxcAging(m);
    renderCxcAlertaVencidas(m);
    // Filtros
    const filtradas = aplicarFiltrosCxc(todas);
    els.cxcTableBody.innerHTML = '';
    filtradas.forEach((orden) => {
      const saldo = Math.round((Number(orden.total) - Number(orden.monto_cobrado || 0)) * 100) / 100;
      const vencida = esVencida(orden);
      const estadoBadge = (orden.estado_pago === 'pendiente') ? (vencida ? '<span class="estatus-badge estatus-cancelado">Vencida</span>' : '<span class="estatus-badge estatus-pendiente">Pendiente</span>') : '<span class="estatus-badge estatus-listo">Pagada</span>';
      const vencimientoTxt = orden.fecha_vencimiento ? escapeHtml(orden.fecha_vencimiento) : '—';
      const clienteHtml = orden.cliente_nombre
        ? `<span class="cxc-cliente-nombre">${escapeHtml(orden.cliente_nombre)}</span><small class="cxc-cliente-sub">${orden.cliente_rfc ? `RFC ${escapeHtml(orden.cliente_rfc)} · ` : ''}${escapeHtml(orden.email || '')}</small>`
        : `${escapeHtml(orden.email || 'Sin correo')}<small class="cxc-cliente-sub">Sin constancia registrada</small>`;
      const facturadaBadge = orden.facturado ? '<span class="estatus-badge cxc-fact-si">Sí</span>' : '<span class="estatus-badge cxc-fact-no">No</span>';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td data-label="No. Venta" data-col="numero">${escapeHtml(orden.numero_compra || '—')}</td><td data-label="Cliente" data-col="cliente">${clienteHtml}</td><td data-label="Total" data-col="total">$${formatearMoneda(orden.total)}</td><td data-label="Cobrado" data-col="cobrado">$${formatearMoneda(orden.monto_cobrado || 0)}</td><td data-label="Saldo" data-col="saldo"><strong>$${formatearMoneda(saldo)}</strong></td><td data-label="Vencimiento" data-col="vencimiento">${vencimientoTxt}</td><td data-label="Estado" data-col="estado">${estadoBadge}</td><td data-label="Facturada" data-col="facturada">${facturadaBadge}</td><td data-label=""></td>`;
      const tdAcciones = tr.lastElementChild;
      const wrap = document.createElement('div');
      wrap.className = 'admin-row-actions admin-row-actions-iconos';
      const btnVer = document.createElement('button'); btnVer.type='button'; btnVer.className='btn-icono-accion'; btnVer.setAttribute('data-tooltip','Ver venta'); btnVer.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'; btnVer.addEventListener('click', ()=>abrirOrdenModal(orden)); wrap.appendChild(btnVer);
      if ((orden.estado_pago || 'pagada') === 'pendiente') {
        const btnCobro = document.createElement('button'); btnCobro.type='button'; btnCobro.className='btn-icono-accion'; btnCobro.setAttribute('data-tooltip','Registrar cobro'); btnCobro.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>'; btnCobro.addEventListener('click', ()=>abrirCobroModal(orden)); wrap.appendChild(btnCobro);
        if (orden.email) {
          const btnEnviar = document.createElement('button'); btnEnviar.type='button'; btnEnviar.className='btn-icono-accion'; btnEnviar.setAttribute('data-tooltip','Enviar recordatorio por correo'); btnEnviar.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          btnEnviar.addEventListener('click', async () => { const ok = await enviarRecordatorioEmail(orden, btnEnviar); if (ok) showToast('Recordatorio enviado por correo'); });
          wrap.appendChild(btnEnviar);
        }
      }
      const btnNotif = document.createElement('button'); btnNotif.type='button'; btnNotif.className='btn-icono-accion'; btnNotif.setAttribute('data-tooltip','Copiar recordatorio'); btnNotif.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M22 6l-10 7L2 6"/></svg>'; btnNotif.addEventListener('click', ()=>{ const txt=`Recordatorio: venta ${orden.numero_compra} por $${formatearMoneda(orden.total)} — saldo $${formatearMoneda(saldo)}${orden.fecha_vencimiento ? ' — vence '+orden.fecha_vencimiento : ''}.`; navigator.clipboard.writeText(txt); showToast('Recordatorio copiado'); }); wrap.appendChild(btnNotif);
      tdAcciones.appendChild(wrap);
      els.cxcTableBody.appendChild(tr);
    });
    if (els.cxcEmpty) els.cxcEmpty.hidden = filtradas.length > 0 || todas.length > 0;
    if (els.cxcFiltroEmpty) els.cxcFiltroEmpty.hidden = !(filtradas.length === 0 && todas.length > 0);
    if (els.btnCxcExportar) els.btnCxcExportar.onclick = () => exportarCxcCsv(filtradas);
    renderResumenFinCobranza(todas);
    renderFiltrosChips(els.cxcFiltrosChips, [
      { etiqueta: 'Buscar', valor: els.cxcFiltroCliente ? els.cxcFiltroCliente.value.trim() : '', campos: [els.cxcFiltroCliente] },
      { etiqueta: 'Vencimiento', valor: textoOpcionSeleccionada(els.cxcFiltroVencimiento), campos: [els.cxcFiltroVencimiento] },
    ]);
  }

  function abrirCobroModal(orden) {
    cxcOrdenActualCobro = orden;
    const saldo = Math.round((Number(orden.total) - Number(orden.monto_cobrado || 0)) * 100) / 100;
    if (els.cxcCobroModalSubtitulo) els.cxcCobroModalSubtitulo.textContent = `${orden.numero_compra} — ${orden.email || 'Sin correo'} — Total $${formatearMoneda(orden.total)}`;
    if (els.cxcCobroSaldo) els.cxcCobroSaldo.textContent = `$${formatearMoneda(saldo)}`;
    if (els.cxcCobroMonto) { els.cxcCobroMonto.value = ''; els.cxcCobroMonto.focus(); }
    if (els.cxcCobroNotas) els.cxcCobroNotas.value = '';
    if (els.errorCxcCobroMonto) els.errorCxcCobroMonto.textContent = '';
    els.cxcCobroModalOverlay.hidden = false;
  }
  function cerrarCobroModal() { if (els.cxcCobroModalOverlay) els.cxcCobroModalOverlay.hidden = true; cxcOrdenActualCobro = null; }
  if (els.btnCxcCobroCancelar) els.btnCxcCobroCancelar.addEventListener('click', cerrarCobroModal);
  if (els.cxcCobroModalOverlay) els.cxcCobroModalOverlay.addEventListener('click', (e)=>{ if(e.target===els.cxcCobroModalOverlay) cerrarCobroModal(); });
  if (els.btnCxcCobroTotal) els.btnCxcCobroTotal.addEventListener('click', ()=>{ if(!cxcOrdenActualCobro) return; const saldo = Math.round((Number(cxcOrdenActualCobro.total) - Number(cxcOrdenActualCobro.monto_cobrado||0))*100)/100; if(els.cxcCobroMonto) els.cxcCobroMonto.value = String(saldo); });
  if (els.btnCxcCobroGuardar) els.btnCxcCobroGuardar.addEventListener('click', async ()=>{
    if (!cxcOrdenActualCobro) return;
    const authHeader = getAuthHeader(); if (!authHeader) { showLogin(); return; }
    const monto = Number(String(els.cxcCobroMonto.value).replace(/,/g,''));
    if (!Number.isFinite(monto) || monto <=0) { if(els.errorCxcCobroMonto) els.errorCxcCobroMonto.textContent='Monto inválido'; return; }
    const saldo = Math.round((Number(cxcOrdenActualCobro.total) - Number(cxcOrdenActualCobro.monto_cobrado||0))*100)/100;
    if (monto - saldo > 0.01) { if(els.errorCxcCobroMonto) els.errorCxcCobroMonto.textContent=`Excede saldo $${formatearMoneda(saldo)}`; return; }
    els.btnCxcCobroGuardar.disabled=true; if(els.btnCxcCobroGuardarLabel) els.btnCxcCobroGuardarLabel.textContent='Guardando…';
    try {
      const res = await fetch(`${API_BASE}/admin/ordenes-compra/${cxcOrdenActualCobro.id}/cobro`, { method:'PUT', headers:{ Authorization: authHeader, 'Content-Type':'application/json' }, body: JSON.stringify({ monto, notas_cobro: els.cxcCobroNotas.value.trim() || null }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) { if(els.errorCxcCobroMonto) els.errorCxcCobroMonto.textContent = data.error || 'No se pudo registrar'; return; }
      showToast(`Cobro registrado — saldo $${formatearMoneda(data.saldo)}`);
      cerrarCobroModal();
      await cargarOrdenes();
      renderCxc();
    } catch(_) { if(els.errorCxcCobroMonto) els.errorCxcCobroMonto.textContent='No se pudo conectar'; }
    finally { els.btnCxcCobroGuardar.disabled=false; if(els.btnCxcCobroGuardarLabel) els.btnCxcCobroGuardarLabel.textContent='Guardar cobro'; }
  });
  // Filtros y toggle CxC
  if (els.btnVerCxcPendientes) els.btnVerCxcPendientes.addEventListener('click', ()=>{ cxcVista='pendientes'; els.btnVerCxcPendientes.classList.add('is-active'); els.btnVerCxcCobradas.classList.remove('is-active'); renderCxc(); });
  if (els.btnVerCxcCobradas) els.btnVerCxcCobradas.addEventListener('click', ()=>{ cxcVista='cobradas'; els.btnVerCxcCobradas.classList.add('is-active'); els.btnVerCxcPendientes.classList.remove('is-active'); renderCxc(); });
  if (els.btnRefreshCxc) els.btnRefreshCxc.addEventListener('click', ()=>cargarCxc());
  if (els.cxcFiltroCliente) els.cxcFiltroCliente.addEventListener('input', ()=>renderCxc());
  if (els.cxcFiltroVencimiento) els.cxcFiltroVencimiento.addEventListener('change', ()=>renderCxc());
  if (els.btnLimpiarFiltrosCxc) els.btnLimpiarFiltrosCxc.addEventListener('click', ()=>{ if(els.cxcFiltroCliente) els.cxcFiltroCliente.value=''; if(els.cxcFiltroVencimiento) els.cxcFiltroVencimiento.value=''; renderCxc(); });
  // Recargar CxC cuando se registra una venta nueva: monkey-patch de
  // cargarOrdenes para que la vista CxC se refresque sola si está
  // visible en ese momento (sin duplicar la lógica de fetch de Ventas).
  if (typeof cargarOrdenes === 'function') {
    const cargarOrdenesOriginal = cargarOrdenes;
    cargarOrdenes = async function () {
      const res = await cargarOrdenesOriginal.apply(this, arguments);
      try {
        if (els.vistaCxc && !els.vistaCxc.hidden) renderCxc();
        else if (els.vistaResumenFinanciero && !els.vistaResumenFinanciero.hidden) renderResumenFinCobranza(ordenesCache);
      } catch (_) {}
      return res;
    };
  }

  // ---------- Inventarios (segmento 3) ----------
  // Mismo patrón que Gastos (panel de categorías, tabla activos/papelera,
  // modal de alta/edición) — ver inventarios.md §0.3/§0.6. El motor de
  // existencias real vive en el backend (segmento 1/2); esta capa solo
  // captura, valida en el cliente y muestra lo que el servidor calcula.

  let categoriasInventarioActuales = [];
  let productosInventarioActuales = [];
  let unidadesInventarioActuales = [];
  let vistaInventarios = 'activos'; // 'activos' | 'papelera' | 'servicios'
  // Punto 278: pill de conteo dentro de cada pestaña — se llena solo con
  // la vista que ya se visitó (sin pedir nada nuevo al servidor), las
  // otras 2 se quedan en "—" hasta que el usuario las abra.
  const invConteoPorVista = { activos: null, papelera: null, servicios: null };
  let invFiltroStock = ''; // '' | 'bajo_minimo' | 'sin_existencia' | 'optimo' — chips de stock
  let categoriaInvEditandoId = null;
  let inventarioModalEditando = null; // producto en edición, o null = crear
  let inventarioModalTipoSeleccionado = 'producto'; // 'producto' | 'servicio'
  let inventarioMovimientoProducto = null;
  let inventarioMovimientoDireccion = 'entrada'; // 'entrada' | 'salida'

  // 4+4 tipos de v1 (P4 cerrada 2026-08-24, §0.6.1) — "venta" NO aparece
  // aquí porque esa salida solo la genera D8 (Ventas con inventario
  // activo), nunca a mano desde este modal.
  const TIPOS_MOV_ENTRADA = [
    { valor: 'compra', etiqueta: 'Compra' },
    { valor: 'devolucion_cliente', etiqueta: 'Devolución de cliente' },
    { valor: 'inventario_inicial', etiqueta: 'Inventario inicial' },
    { valor: 'ajuste_positivo', etiqueta: 'Ajuste positivo' },
  ];
  const TIPOS_MOV_SALIDA = [
    { valor: 'consumo_interno', etiqueta: 'Consumo interno' },
    { valor: 'merma', etiqueta: 'Merma' },
    { valor: 'ajuste_negativo', etiqueta: 'Ajuste negativo' },
  ];
  const ETIQUETAS_TIPO_MOV = Object.fromEntries(
    [...TIPOS_MOV_ENTRADA, ...TIPOS_MOV_SALIDA, { valor: 'venta', etiqueta: 'Venta' }].map((t) => [t.valor, t.etiqueta])
  );
  function etiquetaTipoMovimiento(tipo) {
    return ETIQUETAS_TIPO_MOV[tipo] || tipo;
  }
  // Quita el ".00" de una cantidad de existencia (no es dinero, no
  // siempre tiene sentido mostrar 2 decimales fijos — 5 piezas se ve
  // mejor que "5.00" — pero si trae fracción real (kg/L) sí se conserva).
  function formatearCantidadInv(valor) {
    return formatearMoneda(valor).replace(/\.00$/, '');
  }

  // ---------- Config por tenant (D8/§0.6) ----------

  async function cargarConfigInventario() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/configuracion`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();
      const activo = Boolean(data.configuracion && data.configuracion.inventario_activo === '1');
      const soloServicios = Boolean(data.configuracion && data.configuracion.inv_solo_servicios === '1');
      ultimoValorSoloServiciosGuardado = soloServicios;
      if (els.configInventarioActivo) els.configInventarioActivo.checked = activo;
      aplicarVisibilidadInventarios(activo);
    } catch (err) {
      // Silencioso — el botón del sidebar simplemente se queda oculto
      // hasta el próximo intento (mismo criterio que cargarConfigGlobal).
    }
  }

  // Mismo patrón que aplicarVisibilidadOrdenesCompra(): delega en
  // aplicarRestriccionesPerfil() en vez de tocar els.btnVistaInventarios
  // directamente, para no reactivar el botón para un perfil que ya lo
  // tenía oculto por D7.
  function aplicarVisibilidadInventarios(activo) {
    inventarioActivoGlobalmente = activo;
    aplicarRestriccionesPerfil();
    // Primeros pasos (Fase 2 UX): este valor llega async (cargarConfigInventario)
    // después del primer render del checklist — se corrige aquí en cuanto
    // se sabe, mismo patrón que verificarDatosFiscalesFaltantes().
    renderOnboardingChecklist();
    // D8/§22: el campo de "vincular producto" en Ventas sigue el mismo
    // interruptor — función declarada más abajo, junto al resto del
    // código de Ventas (hoisted, se puede llamar aquí sin problema).
    aplicarVisibilidadInventarioEnVentas();
    // Punto 187/188: "Solamente servicios" depende de "Inventario activo".
    // Sin inventario activo se muestra APAGADO (cosmético, no se persiste)
    // para no leerse como "algo sigue activo" — al reactivar Inventario se
    // restaura el último valor REAL guardado, sin perder la preferencia.
    if (els.configInvSoloServicios) {
      els.configInvSoloServicios.disabled = !activo;
      const envoltorio = els.configInvSoloServicios.closest('.switch-toggle');
      if (envoltorio) envoltorio.classList.toggle('is-disabled', !activo);
      const valorMostrado = activo && ultimoValorSoloServiciosGuardado;
      els.configInvSoloServicios.checked = valorMostrado;
      aplicarVisibilidadSoloServicios(valorMostrado);
    }
    // Campana de notificaciones (punto 337): su grupo "Inventario"
    // depende de este mismo valor, que llega async — se re-verifica
    // aquí en cuanto se sabe, mismo criterio que el resto de esta
    // función. Sin cuenta activa todavía (primer render antes de
    // cualquier login) simplemente no hace nada.
    if (usuarioSesionActual) actualizarNotificaciones();
  }

  // Punto 186 (cierra el punto 182): con el switch encendido, todo lo que
  // solo aplica a inventario FÍSICO se oculta (7 tarjetas de Inicio + los
  // 2 bloques de producto en "Estado del inventario" + alta manual/carga
  // masiva de producto) — lo que aplica a servicio queda como única
  // opción visible. Las 2 tarjetas de servicio (Inicio) NO llevan la
  // clase inv-kpi-solo-producto: se quedan visibles siempre, con o sin el
  // switch, igual que ya hacía "Servicios activos" desde el punto 179.
  // Punto: `.inv-kpi-solo-producto` se oculta por 2 razones independientes
  // — el tenant es "Solamente servicios" (global, soloServiciosGlobalmente)
  // o el admin está parado en la pestaña "Servicios" de Inventarios (local,
  // vistaInventarios). Una sola función combina ambas para que no se
  // pisen entre sí al cambiar de pestaña o de configuración.
  function actualizarVisibilidadProductoInv() {
    const ocultar = soloServiciosGlobalmente || vistaInventarios === 'servicios';
    document.querySelectorAll('.inv-kpi-solo-producto').forEach((el) => { el.hidden = ocultar; });
  }

  function aplicarVisibilidadSoloServicios(activo) {
    soloServiciosGlobalmente = activo;
    actualizarVisibilidadProductoInv();
    document.querySelectorAll('.inv-estado-solo-producto').forEach((el) => { el.hidden = activo; });
    if (els.invEstadoServiciosKpiGrid) els.invEstadoServiciosKpiGrid.hidden = !activo;
    if (els.invEstadoServiciosGrid) els.invEstadoServiciosGrid.hidden = !activo;
    if (els.btnInvImportar) els.btnInvImportar.hidden = activo;
    if (els.btnNuevoProducto) els.btnNuevoProducto.textContent = activo ? '+ Nuevo servicio' : '+ Nuevo producto';
  }

  let timeoutAutoguardadoInv = null;
  if (els.configInventarioActivo) {
    els.configInventarioActivo.addEventListener('change', async () => {
      const nuevoValor = els.configInventarioActivo.checked;
      const authHeader = getAuthHeader();
      if (!authHeader) {
        showLogin();
        return;
      }

      clearTimeout(timeoutAutoguardadoInv);
      els.configInventarioActivo.disabled = true;
      els.invActivoAutoguardado.textContent = 'Guardando…';
      els.invActivoAutoguardado.setAttribute('data-estado', 'guardando');

      try {
        const res = await fetch(`${API_BASE}/admin/inventarios/configuracion/inventario_activo`, {
          method: 'PUT',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor: nuevoValor ? '1' : '0' }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'No se pudo guardar.');
        }
        aplicarVisibilidadInventarios(nuevoValor);
        els.invActivoAutoguardado.innerHTML = HTML_GUARDADO_OK;
        els.invActivoAutoguardado.setAttribute('data-estado', 'guardado');
        timeoutAutoguardadoInv = setTimeout(() => {
          els.invActivoAutoguardado.textContent = '';
          els.invActivoAutoguardado.removeAttribute('data-estado');
        }, 2500);
      } catch (err) {
        els.configInventarioActivo.checked = !nuevoValor;
        els.invActivoAutoguardado.textContent = 'No se pudo guardar — inténtalo de nuevo.';
        els.invActivoAutoguardado.setAttribute('data-estado', 'error');
      } finally {
        els.configInventarioActivo.disabled = false;
      }
    });
  }

  // Punto 186 (cierra el punto 182): el 400 real del backend
  // (INV_HAY_PRODUCTOS_ACTIVOS) se muestra inline, junto al switch — un
  // toast se pierde apenas se cierra, y este mensaje explica exactamente
  // qué hacer (archivar productos) antes de reintentar.
  let timeoutAutoguardadoInvSolo = null;
  if (els.configInvSoloServicios) {
    els.configInvSoloServicios.addEventListener('change', async () => {
      const nuevoValor = els.configInvSoloServicios.checked;
      const authHeader = getAuthHeader();
      if (!authHeader) {
        showLogin();
        return;
      }

      clearTimeout(timeoutAutoguardadoInvSolo);
      els.invSoloServiciosError.textContent = '';
      els.configInvSoloServicios.disabled = true;
      els.invSoloServiciosAutoguardado.textContent = 'Guardando…';
      els.invSoloServiciosAutoguardado.setAttribute('data-estado', 'guardando');

      try {
        const res = await fetch(`${API_BASE}/admin/inventarios/configuracion/inv_solo_servicios`, {
          method: 'PUT',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor: nuevoValor ? '1' : '0' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.mensaje || data.error || 'No se pudo guardar.');
        ultimoValorSoloServiciosGuardado = nuevoValor;
        aplicarVisibilidadSoloServicios(nuevoValor);
        els.invSoloServiciosAutoguardado.innerHTML = HTML_GUARDADO_OK;
        els.invSoloServiciosAutoguardado.setAttribute('data-estado', 'guardado');
        timeoutAutoguardadoInvSolo = setTimeout(() => {
          els.invSoloServiciosAutoguardado.textContent = '';
          els.invSoloServiciosAutoguardado.removeAttribute('data-estado');
        }, 2500);
      } catch (err) {
        els.configInvSoloServicios.checked = !nuevoValor;
        els.invSoloServiciosAutoguardado.textContent = '';
        els.invSoloServiciosAutoguardado.removeAttribute('data-estado');
        els.invSoloServiciosError.textContent = err.message;
      } finally {
        els.configInvSoloServicios.disabled = !inventarioActivoGlobalmente;
      }
    });
  }

  if (els.btnToggleInvCard) {
    els.btnToggleInvCard.addEventListener('click', () => {
      const abierto = els.btnToggleInvCard.getAttribute('aria-expanded') === 'true';
      els.btnToggleInvCard.setAttribute('aria-expanded', String(!abierto));
      els.invToggleBody.hidden = abierto;
    });
  }

  // ---------- Categorías (mismo patrón que Gastos, sin "protegida") ----------

  async function cargarCategoriasInventario() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/categorias`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.categorias)) {
        categoriasInventarioActuales = data.categorias;
        poblarSelectsCategoriaInventario();
        renderPanelCategoriasInventario();
      }
    } catch (err) {
      // Silencioso: los selects se quedan con la última lista cargada.
    }
  }

  function poblarSelectsCategoriaInventario() {
    const opciones = categoriasInventarioActuales
      .filter((c) => c.activa)
      .map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`)
      .join('');
    if (els.invFiltroCategoria) {
      const valorActual = els.invFiltroCategoria.value;
      els.invFiltroCategoria.innerHTML = '<option value="">Todas</option>' + opciones;
      els.invFiltroCategoria.value = valorActual;
    }
    if (els.invModalCategoria) {
      const valorActual = els.invModalCategoria.value;
      els.invModalCategoria.innerHTML = '<option value="">Sin categoría</option>' + opciones;
      els.invModalCategoria.value = valorActual;
    }
  }

  function filaCategoriaInvPanel(c) {
    if (categoriaInvEditandoId === c.id) {
      return `<div class="gastos-categoria-fila" data-id="${c.id}">
        <input type="text" class="gastos-categoria-input-editar" value="${escapeHtml(c.nombre)}" maxlength="100" />
        <button type="button" class="btn-categoria-accion btn-categoria-guardar" data-id="${c.id}">Guardar</button>
        <button type="button" class="btn-categoria-accion gastos-categoria-cancelar">Cancelar</button>
      </div>`;
    }
    return `<div class="gastos-categoria-fila" data-id="${c.id}">
      <span class="gastos-categoria-nombre">${escapeHtml(c.nombre)}${c.activa ? '' : ' <em>(inactiva)</em>'}</span>
      ${c.activa ? '' : `<button type="button" class="btn-categoria-accion gastos-categoria-reactivar" data-id="${c.id}">Reactivar</button>`}
      <button type="button" class="btn-icono-accion gastos-categoria-renombrar" data-id="${c.id}" data-tooltip="Renombrar ${escapeHtml(c.nombre)}" aria-label="Renombrar ${escapeHtml(c.nombre)}">${ICONO_EDITAR}</button>
      ${c.tieneProductos ? '' : `<button type="button" class="btn-icono-accion btn-icono-accion-peligro gastos-categoria-borrar" data-id="${c.id}" data-tooltip="Eliminar ${escapeHtml(c.nombre)}" aria-label="Eliminar ${escapeHtml(c.nombre)}">${ICONO_PAPELERA}</button>`}
    </div>`;
  }

  function renderPanelCategoriasInventario() {
    if (!els.invCategoriasLista) return;
    els.invCategoriasLista.innerHTML =
      categoriasInventarioActuales.map(filaCategoriaInvPanel).join('') || '<p class="field-hint">Sin categorías.</p>';
  }

  function toggleCategoriasInvPanel() {
    const abierto = els.invCategoriasPanel.hidden;
    els.invCategoriasPanel.hidden = !abierto;
    els.btnInvCategoriasToggle.setAttribute('aria-expanded', String(abierto));
    categoriaInvEditandoId = null;
    if (abierto) renderPanelCategoriasInventario();
  }

  async function renombrarCategoriaInvPanel(id, nombre) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/categorias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ nombre }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo renombrar la categoría.', true);
        return;
      }
      categoriaInvEditandoId = null;
      await cargarCategoriasInventario();
      cargarInventarios();
      showToast(data.mensaje || 'Categoría actualizada.');
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  async function reactivarCategoriaInvPanel(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/categorias/${id}/reactivar`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo reactivar la categoría.', true);
        return;
      }
      await cargarCategoriasInventario();
      showToast(data.mensaje || 'Categoría reactivada.');
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  async function eliminarCategoriaInvPanel(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/categorias/${id}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo eliminar la categoría.', true);
        return;
      }
      await cargarCategoriasInventario();
      showToast(data.mensaje || 'Categoría eliminada.');
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  async function agregarCategoriaInvPanel() {
    const nombre = els.invCategoriaNuevaInput.value.trim();
    els.errorInvCategoriaNueva.textContent = '';
    if (!nombre) {
      els.errorInvCategoriaNueva.textContent = 'El nombre de la categoría es obligatorio.';
      return;
    }
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/categorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ nombre }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        els.errorInvCategoriaNueva.textContent = data.error || 'No se pudo crear la categoría.';
        return;
      }
      els.invCategoriaNuevaInput.value = '';
      await cargarCategoriasInventario();
      showToast('Categoría creada.');
    } catch (err) {
      els.errorInvCategoriaNueva.textContent = 'No se pudo conectar con el servidor.';
    }
  }

  function confirmarEliminarCategoriaInv(id, nombre) {
    abrirConfirmacion({
      titulo: 'Eliminar categoría',
      mensaje: `¿Eliminar la categoría "${nombre}"? Esta acción no se puede deshacer.`,
      textoBoton: 'Eliminar',
      onConfirmar: () => eliminarCategoriaInvPanel(id),
    });
  }

  // ---------- Unidades de medida (§9, solo lectura + alta en v1) ----------

  async function cargarUnidadesInventario() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/unidades`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.unidades)) {
        unidadesInventarioActuales = data.unidades;
        renderOpcionesUnidadInv();
      }
    } catch (err) {
      // Silencioso.
    }
  }

  // Punto 179 + [Servicio en paquete]: un servicio solo admite 2
  // unidades — "Hora" (cobro por tiempo) o "Paquete" (precio fijo por
  // todo el servicio) — se filtra el desplegable a esas 2 cuando el
  // toggle de tipo está en "Servicio"; producto sigue viendo el
  // catálogo completo. En contexto servicio se usan etiquetas propias
  // (no "Paquete (paq)" a secas, que se confundiría con la unidad física
  // que un producto puede usar con el mismo nombre).
  const ETIQUETAS_UNIDAD_SERVICIO = {
    Hora: 'Por hora',
    Paquete: 'Precio fijo (paquete de servicio)',
  };
  const HINT_UNIDAD_SERVICIO = {
    Hora: 'Los servicios cobrados por hora se miden en horas enteras — la cantidad en la venta no admite decimales.',
    Paquete: 'Se cobra una sola vez por todo el servicio, sin importar las horas que tome. No es un producto físico — ej. "Paquete de mantenimiento", "Consultoría integral".',
  };

  function renderOpcionesUnidadInv() {
    if (!els.invModalUnidad) return;
    const esServicio = inventarioModalTipoSeleccionado === 'servicio';
    const lista = esServicio
      ? unidadesInventarioActuales.filter((u) => u.nombre === 'Hora' || u.nombre === 'Paquete')
      : unidadesInventarioActuales;
    const valorActual = els.invModalUnidad.value;
    els.invModalUnidad.innerHTML = lista
      .map((u) => `<option value="${u.id}">${escapeHtml(esServicio ? (ETIQUETAS_UNIDAD_SERVICIO[u.nombre] || u.nombre) : `${u.nombre} (${u.abreviatura})`)}</option>`)
      .join('');
    const sigueDisponible = lista.some((u) => String(u.id) === valorActual);
    els.invModalUnidad.value = sigueDisponible ? valorActual : lista[0] ? String(lista[0].id) : '';
    if (esServicio) actualizarHintUnidadServicio();
  }

  // Texto del field-hint bajo el selector cambia según "Por hora" vs
  // "Precio fijo (paquete de servicio)" — antes era un texto fijo
  // porque solo existía una opción.
  function actualizarHintUnidadServicio() {
    if (!els.invModalUnidadHintServicio || !els.invModalUnidad.value) return;
    const unidad = unidadesInventarioActuales.find((u) => String(u.id) === els.invModalUnidad.value);
    els.invModalUnidadHintServicio.textContent = unidad && HINT_UNIDAD_SERVICIO[unidad.nombre]
      ? HINT_UNIDAD_SERVICIO[unidad.nombre]
      : HINT_UNIDAD_SERVICIO.Hora;
  }

  function nombreCategoriaInv(id) {
    if (!id) return '—';
    const c = categoriasInventarioActuales.find((x) => x.id === id);
    return c ? c.nombre : '—';
  }
  function abreviaturaUnidadInv(id) {
    const u = unidadesInventarioActuales.find((x) => x.id === id);
    return u ? u.abreviatura : '—';
  }

  // ---------- Dashboard (7 KPIs de v1, §0.3:10) ----------

  async function cargarDashboardInventario() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    Esqueleto.marcarKpisCargando(els.invKpiGridPrincipal, true);
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/dashboard`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        Esqueleto.marcarKpisCargando(els.invKpiGridPrincipal, false);
        return;
      }
      const d = await res.json();
      els.invKpiValor.textContent = `$${formatearMoneda(d.valor_total_inventario)}`;
      if (els.invKpiCostoProm) els.invKpiCostoProm.textContent = `$${formatearMoneda(d.costo_promedio_ponderado || 0)}`;
      if (els.invKpiPiezasTotal) els.invKpiPiezasTotal.textContent = `${formatearCantidadInv(d.unidades_disponibles)} pz`;
      els.invKpiActivos.textContent = String(d.productos_activos);
      els.invKpiServicios.textContent = String(d.servicios_activos);
      if (els.invKpiServiciosSinVentas) els.invKpiServiciosSinVentas.textContent = String(d.servicios_sin_ventas_90d);
      els.invKpiUnidades.textContent = formatearCantidadInv(d.unidades_disponibles);
      els.invKpiBajoMinimo.textContent = String(d.productos_bajo_minimo);
      els.invKpiSinExistencia.textContent = String(d.productos_sin_existencia);
      els.invKpiSinMovimiento.textContent = String(d.productos_sin_movimiento);
      // Punto 278: "Catálogo con alta rotación" es una lectura honesta de
      // un conteo real en 0 — no inventa ningún dato nuevo.
      if (els.invKpiSinMovimientoNota) {
        els.invKpiSinMovimientoNota.textContent = Number(d.productos_sin_movimiento) === 0
          ? 'Catálogo con alta rotación'
          : 'Nunca tuvo un movimiento';
      }
      els.invKpiMermas.textContent = `$${formatearMoneda(d.mermas_periodo_valor)}`;
      els.invKpiMermasCantidad.textContent = Number(d.mermas_periodo_cantidad) === 0
        ? 'Sin mermas registradas este mes'
        : `${d.mermas_periodo_cantidad} movimiento${d.mermas_periodo_cantidad === 1 ? '' : 's'} este mes`;
      els.invKpiPorVencer.textContent = String(d.productos_por_vencer);
      // Fila de totales de la tabla — mismos números de las tarjetas de
      // arriba, sin pedirle nada nuevo al servidor.
      if (els.invTfootUnidades) els.invTfootUnidades.textContent = `${formatearCantidadInv(d.unidades_disponibles)} pz`;
      if (els.invTfootValor) els.invTfootValor.textContent = `$${formatearMoneda(d.valor_total_inventario)}`;
      if (els.invTfootAlertas) {
        const alertas = Number(d.productos_bajo_minimo) + Number(d.productos_sin_existencia);
        els.invTfootAlertas.textContent = `${alertas} alerta${alertas === 1 ? '' : 's'}`;
      }
      Esqueleto.marcarKpisCargando(els.invKpiGridPrincipal, false);
    } catch (err) {
      // Silencioso — las tarjetas se quedan con el último valor mostrado.
      Esqueleto.marcarKpisCargando(els.invKpiGridPrincipal, false);
    }
  }

  // ---------- Lista de productos (tabla activos/papelera) ----------

  async function cargarInventarios() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.invError.textContent = '';
    Esqueleto.aplicarEsqueletoTabla(els.invTableBody, 12);
    try {
      const params = new URLSearchParams();
      if (vistaInventarios === 'papelera') params.set('papelera', 'true');
      if (els.invFiltroCategoria.value) params.set('categoria_id', els.invFiltroCategoria.value);
      if (els.invFiltroEstado.value) params.set('estado', els.invFiltroEstado.value);
      // Punto: la pestaña "Servicios" fuerza tipo=servicio (no depende del
      // select, que además queda deshabilitado mientras esta pestaña esté
      // activa — ver cambiarVistaInventarios()).
      const tipoEfectivo = vistaInventarios === 'servicios' ? 'servicio' : els.invFiltroTipo.value;
      if (tipoEfectivo) params.set('tipo', tipoEfectivo);
      if (els.invBusqueda.value.trim()) params.set('busqueda', els.invBusqueda.value.trim());
      // Chips de stock: solo aplican a la pestaña de productos activos
      // (un servicio no tiene existencia, y la papelera no expone esta
      // clasificación).
      if (vistaInventarios === 'activos' && invFiltroStock) params.set('stock', invFiltroStock);
      params.set('por_pagina', '200');

      const res = await fetch(`${API_BASE}/admin/inventarios/productos?${params.toString()}`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (res.status === 403) {
        // El interruptor pudo apagarse desde otra pestaña/sesión mientras
        // esta seguía abierta — el sidebar ya debería haberse ocultado,
        // esto es solo la red de seguridad del lado del servidor.
        Esqueleto.aplicarErrorTabla(els.invTableBody, 12, 'El módulo de Inventarios no está activo para esta empresa.', cargarInventarios);
        return;
      }
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.invTableBody, 12, 'No se pudieron cargar los productos.', cargarInventarios);
        return;
      }
      const data = await res.json();
      productosInventarioActuales = data.productos || [];
      renderInvTabla(productosInventarioActuales, data.total);
      Esqueleto.quitarEsqueletoTabla(els.invTableBody);
      renderFiltrosChips(els.invFiltrosChips, [
        { etiqueta: 'Categoría', valor: textoOpcionSeleccionada(els.invFiltroCategoria), campos: [els.invFiltroCategoria] },
        { etiqueta: 'Estado', valor: textoOpcionSeleccionada(els.invFiltroEstado), campos: [els.invFiltroEstado] },
        { etiqueta: 'Tipo', valor: textoOpcionSeleccionada(els.invFiltroTipo), campos: [els.invFiltroTipo] },
        { etiqueta: 'Buscar', valor: els.invBusqueda.value.trim(), campos: [els.invBusqueda] },
      ]);
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.invTableBody, 12, 'No se pudo conectar con el servidor.', cargarInventarios);
    }
  }

  function botonAccionInv({ tooltip, peligro, icono, onClick }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = peligro ? 'btn-icono-accion btn-icono-accion-peligro' : 'btn-icono-accion';
    btn.setAttribute('data-tooltip', tooltip);
    btn.setAttribute('aria-label', tooltip);
    btn.innerHTML = icono;
    btn.addEventListener('click', onClick);
    return btn;
  }

  const ICONO_ENTRADA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONO_SALIDA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14m0 0l-6-6m6 6l6-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONO_KARDEX = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 17V9m3 8V5m3 12v-5M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONO_EDITAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  const ICONO_PAPELERA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONO_RESTAURAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONO_KEBAB = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
  // Mismo ícono de impresora ya usado en Ventas (btnImprimirOrden).
  const ICONO_IMPRIMIR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="4" y="9" width="16" height="8" rx="1.2" stroke="currentColor" stroke-width="1.6"/><path d="M6 14h12v7H6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  // Ícono "ver" (ojo) reutilizado en Documentos/Tickets — mismo criterio
  // de botonAccionInv, sin acoplarse solo a Inventarios pese al nombre.
  const ICONO_OJO = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>';

  // Menú "⋮" reutilizable para acciones secundarias (punto: 2026-08-30,
  // acomodo de espacio en Inventarios) — deja visibles solo las 2
  // acciones de uso diario (Entrada/Salida) y agrupa el resto, en vez de
  // 5 botones sueltos peleando por el mismo ancho de columna.
  function cerrarMenusAccionesInv() {
    document.querySelectorAll('.inv-acciones-menu:not([hidden])').forEach((m) => { m.hidden = true; });
    document.querySelectorAll('.inv-acciones-menu-trigger[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
  document.addEventListener('click', cerrarMenusAccionesInv);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenusAccionesInv(); });

  function crearMenuAccionesInv(items) {
    const wrap = document.createElement('div');
    wrap.className = 'inv-acciones-menu-wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-icono-accion inv-acciones-menu-trigger';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Más acciones');
    btn.setAttribute('data-tooltip', 'Más acciones');
    btn.innerHTML = ICONO_KEBAB;

    const menu = document.createElement('div');
    menu.className = 'inv-acciones-menu';
    menu.hidden = true;
    items.forEach((item) => {
      const opcion = document.createElement('button');
      opcion.type = 'button';
      opcion.className = item.peligro ? 'inv-acciones-menu-item inv-acciones-menu-item-peligro' : 'inv-acciones-menu-item';
      opcion.innerHTML = `${item.icono}<span>${item.texto}</span>`;
      opcion.addEventListener('click', (e) => {
        e.stopPropagation();
        cerrarMenusAccionesInv();
        item.onClick();
      });
      menu.appendChild(opcion);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const yaAbierto = !menu.hidden;
      cerrarMenusAccionesInv();
      if (!yaAbierto) {
        menu.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    return wrap;
  }

  function renderInvTabla(productos, total) {
    const esPapelera = vistaInventarios === 'papelera';
    const cuenta = Number.isFinite(total) ? total : productos.length;
    invConteoPorVista[vistaInventarios] = cuenta;
    const pillPorVista = { activos: els.invTabPillActivos, papelera: els.invTabPillPapelera, servicios: els.invTabPillServicios };
    const pillActiva = pillPorVista[vistaInventarios];
    if (pillActiva) pillActiva.textContent = String(cuenta);
    els.invEmpty.hidden = productos.length > 0;
    els.invEmpty.textContent = esPapelera
      ? 'La papelera de Inventarios está vacía.'
      : 'No hay productos que coincidan con la búsqueda.';

    els.invTableBody.innerHTML = '';
    productos.forEach((p) => {
      const esServicio = p.tipo === 'servicio';
      const disponible = Number(p.disponible || 0);
      const esBajoMinimo = !esServicio && p.stock_minimo !== null && disponible < p.stock_minimo;
      const esSinExistencia = !esServicio && disponible === 0;
      const estadoBadgeClase = p.estado === 'activo' ? 'estatus-listo' : p.estado === 'archivado' ? 'estatus-rechazado' : 'estatus-proceso';

      // Nivel de stock: solo si el producto define stock_maximo — sin esa
      // referencia un % no significa nada (¿óptimo respecto a qué?).
      let nivelStockHtml = '—';
      if (!esServicio && p.stock_maximo) {
        const pct = Math.max(0, Math.min(100, Math.round((disponible / p.stock_maximo) * 100)));
        const color = esSinExistencia ? 'var(--color-error)' : esBajoMinimo ? 'var(--color-warn)' : 'var(--color-positivo, #1FAE6B)';
        nivelStockHtml = `<div class="inv-nivel-stock-wrap"><div class="inv-nivel-stock-barra"><span style="width:${pct}%;background:${color}"></span></div><span class="inv-nivel-stock-pct">${pct}%</span></div>`;
      }
      if (esBajoMinimo || esSinExistencia) {
        nivelStockHtml += '<button type="button" class="inv-reordenar-link">Reordenar</button>';
      }

      const valuacion = esServicio ? '—' : `$${formatearMoneda(disponible * Number(p.costo_promedio || 0))}`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="" class="inv-imagen-celda"><span class="inv-thumb-zoom-wrap">${p.imagen_thumb_url ? '<img class="inv-thumb" alt="" />' : '<img class="inv-thumb" src="/assets/producto-placeholder.png" alt="" />'}</span></td>
        <td data-label="SKU" data-col="sku"><strong>${escapeHtml(p.sku)}</strong></td>
        <td data-label="Nombre" data-col="nombre">
          <button type="button" class="gasto-concepto-link inv-producto-link">${escapeHtml(p.nombre)}</button>${esServicio ? ' <span class="estatus-badge estatus-proceso">Servicio</span>' : ''}
        </td>
        <td data-label="Categoría" data-col="categoria">${escapeHtml(nombreCategoriaInv(p.categoria_id))}</td>
        <td data-label="Unidad" data-col="unidad">${escapeHtml(abreviaturaUnidadInv(p.unidad_id))}</td>
        <td data-label="Disponible" data-col="disponible" class="col-num">${esServicio ? '—' : formatearCantidadInv(disponible)}</td>
        <td data-label="Costo prom." data-col="costo" class="col-num">$${formatearMoneda(p.costo_promedio)}</td>
        <td data-label="Precio" data-col="precio" class="col-num">${p.precio === null ? '—' : '$' + formatearMoneda(p.precio)}</td>
        <td data-label="Nivel de stock" data-col="nivel_stock">${nivelStockHtml}</td>
        <td data-label="Valuación" data-col="valuacion" class="col-num">${valuacion}</td>
        <td data-label="Estado" data-col="estado"><span class="estatus-badge ${estadoBadgeClase}">${escapeHtml(p.estado)}</span></td>
        <td data-label=""></td>
      `;
      tr.querySelector('.inv-producto-link').addEventListener('click', () => abrirProductoModal(p));
      const btnReordenar = tr.querySelector('.inv-reordenar-link');
      if (btnReordenar) btnReordenar.addEventListener('click', () => abrirMovimientoModal(p, 'entrada'));
      const imgThumbFila = tr.querySelector('img.inv-thumb');
      if (p.imagen_thumb_url) cargarImagenAutenticada(imgThumbFila, p.imagen_thumb_url);
      activarLupaProducto(tr.querySelector('.inv-thumb-zoom-wrap'), imgThumbFila);

      const celdaAcciones = tr.lastElementChild;
      const contenedor = document.createElement('div');
      contenedor.className = 'admin-row-actions admin-row-actions-iconos';

      if (esPapelera) {
        contenedor.appendChild(botonAccionInv({ tooltip: 'Restaurar producto', icono: ICONO_RESTAURAR, onClick: () => restaurarProductoInv(p.id, p.nombre) }));
        contenedor.appendChild(botonAccionInv({ tooltip: 'Eliminar permanentemente', peligro: true, icono: ICONO_PAPELERA, onClick: () => confirmarEliminarProductoPermanente(p.id, p.nombre) }));
      } else if (!esServicio) {
        contenedor.appendChild(botonAccionInv({ tooltip: 'Registrar entrada', icono: ICONO_ENTRADA, onClick: () => abrirMovimientoModal(p, 'entrada') }));
        contenedor.appendChild(botonAccionInv({ tooltip: 'Registrar salida', icono: ICONO_SALIDA, onClick: () => abrirMovimientoModal(p, 'salida') }));
        contenedor.appendChild(crearMenuAccionesInv([
          { texto: 'Ver historial', icono: ICONO_KARDEX, onClick: () => abrirKardexModal(p) },
          { texto: 'Editar producto', icono: ICONO_EDITAR, onClick: () => abrirProductoModal(p) },
          { texto: 'Imprimir etiqueta', icono: ICONO_IMPRIMIR, onClick: () => abrirEtiquetaModal(p) },
          { texto: 'Mover a papelera', icono: ICONO_PAPELERA, peligro: true, onClick: () => confirmarEliminarProducto(p.id, p.nombre) },
        ]));
      } else {
        contenedor.appendChild(botonAccionInv({ tooltip: 'Editar producto', icono: ICONO_EDITAR, onClick: () => abrirProductoModal(p) }));
        contenedor.appendChild(botonAccionInv({ tooltip: 'Mover a papelera', peligro: true, icono: ICONO_PAPELERA, onClick: () => confirmarEliminarProducto(p.id, p.nombre) }));
      }
      celdaAcciones.appendChild(contenedor);
      els.invTableBody.appendChild(tr);
    });
  }

  function cambiarVistaInventarios(nuevaVista) {
    if (vistaInventarios === nuevaVista) return;
    vistaInventarios = nuevaVista;
    const esPapelera = nuevaVista === 'papelera';
    const esServicios = nuevaVista === 'servicios';
    els.btnVerInvActivos.classList.toggle('is-active', nuevaVista === 'activos');
    els.btnVerInvActivos.setAttribute('aria-selected', String(nuevaVista === 'activos'));
    els.btnVerInvPapelera.classList.toggle('is-active', esPapelera);
    els.btnVerInvPapelera.classList.toggle('is-danger-context', esPapelera);
    els.btnVerInvPapelera.setAttribute('aria-selected', String(esPapelera));
    if (els.btnVerInvServicios) {
      els.btnVerInvServicios.classList.toggle('is-active', esServicios);
      els.btnVerInvServicios.setAttribute('aria-selected', String(esServicios));
    }
    els.btnNuevoProducto.hidden = esPapelera;
    document.getElementById('inv-kpis-wrap').hidden = esPapelera;
    document.getElementById('inv-filtros').hidden = esPapelera;
    // Chips de stock solo tienen sentido en "Activos" (existencia real).
    if (els.invChipsStock) els.invChipsStock.hidden = esPapelera || esServicios;
    // Tipo queda fijo/deshabilitado dentro de la pestaña Servicios — el
    // filtro real lo pone cargarInventarios() por su cuenta.
    if (els.invFiltroTipo) {
      els.invFiltroTipo.disabled = esServicios;
      if (esServicios) els.invFiltroTipo.value = '';
    }
    actualizarVisibilidadProductoInv();
    cargarInventarios();
  }

  function activarChipStockInv(valor) {
    invFiltroStock = valor;
    const mapa = [
      [els.btnInvChipTodos, ''],
      [els.btnInvChipBajoMinimo, 'bajo_minimo'],
      [els.btnInvChipSinExistencia, 'sin_existencia'],
      [els.btnInvChipOptimo, 'optimo'],
    ];
    mapa.forEach(([btn, val]) => { if (btn) btn.classList.toggle('is-active', val === valor); });
    cargarInventarios();
  }

  // Kardex consolidado: todos los movimientos reales del catálogo activo
  // en un solo CSV (a diferencia del historial por producto, que solo
  // muestra uno a la vez). El backend arma el CSV directo (puede ser
  // grande), aquí solo se descarga como blob autenticado.
  async function exportarKardexConsolidadoInv() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    if (els.btnInvExportarKardex) { els.btnInvExportarKardex.disabled = true; }
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/kardex-exportar`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) { showToast('No se pudo exportar el Kardex.', 'error'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kardex-inventarios-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('No se pudo exportar el Kardex.', 'error');
    } finally {
      if (els.btnInvExportarKardex) { els.btnInvExportarKardex.disabled = false; }
    }
  }

  function limpiarFiltrosInv() {
    els.invFiltroCategoria.value = '';
    els.invFiltroEstado.value = '';
    if (!els.invFiltroTipo.disabled) els.invFiltroTipo.value = '';
    els.invBusqueda.value = '';
    invFiltroStock = '';
    if (els.btnInvChipTodos) {
      [els.btnInvChipTodos, els.btnInvChipBajoMinimo, els.btnInvChipSinExistencia, els.btnInvChipOptimo].forEach((btn, i) => {
        if (btn) btn.classList.toggle('is-active', i === 0);
      });
    }
    cargarInventarios();
  }

  // ---------- Modal de crear/editar producto ----------

  // Punto 179: oculta/muestra un campo del modal con un fundido corto en
  // vez de un salto instantáneo — `animar=false` (default) lo aplica de
  // golpe, sin transición (para cuando el modal apenas se está abriendo,
  // donde una animación se vería como parpadeo). `hidden` real se
  // pone/quita JUSTO antes/después del fundido, nunca junto con él.
  function colapsarCampoInv(el, ocultar, animar) {
    if (!el || el.hidden === ocultar) return;
    const reducida = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animar || reducida) {
      el.hidden = ocultar;
      el.classList.remove('inv-campo-saliendo');
      return;
    }
    if (ocultar) {
      el.classList.add('inv-campo-saliendo');
      window.setTimeout(() => {
        el.hidden = true;
      }, 150);
    } else {
      el.hidden = false;
      el.classList.add('inv-campo-saliendo');
      void el.offsetWidth; // fuerza el reflow para que el navegador registre el estado inicial (opacidad 0) antes de animar
      requestAnimationFrame(() => el.classList.remove('inv-campo-saliendo'));
    }
  }

  function setInvModalTipo(tipo, animar) {
    inventarioModalTipoSeleccionado = tipo;
    els.btnInvTipoProducto.classList.toggle('is-active', tipo === 'producto');
    els.btnInvTipoProducto.setAttribute('aria-selected', String(tipo === 'producto'));
    els.btnInvTipoServicio.classList.toggle('is-active', tipo === 'servicio');
    els.btnInvTipoServicio.setAttribute('aria-selected', String(tipo === 'servicio'));

    // Punto 179: un servicio no tiene código de barras ni mínimos/
    // máximos/punto de reorden de existencia (y punto 213: tampoco fecha
    // de expiración, no hay stock físico que caduque) — se ocultan (quedan NA en
    // la base de datos) y la unidad de medida se restringe a "Hora".
    const esServicio = tipo === 'servicio';
    colapsarCampoInv(els.invModalCodigoBarrasField, esServicio, animar);
    colapsarCampoInv(els.invModalStockMinimoField, esServicio, animar);
    colapsarCampoInv(els.invModalStockMaximoField, esServicio, animar);
    colapsarCampoInv(els.invModalPuntoReordenField, esServicio, animar);
    colapsarCampoInv(els.invModalFechaExpiracionField, esServicio, animar);
    els.invModalUnidadHintServicio.hidden = !esServicio;
    if (els.invModalUnidadLabelTexto) {
      els.invModalUnidadLabelTexto.textContent = esServicio ? '¿Cómo se cobra este servicio?' : 'Unidad de medida';
    }
    renderOpcionesUnidadInv();

    // Leyenda corta bajo el toggle — el detalle completo ya vive en el
    // ícono "?" de al lado, así que aquí solo va lo mínimo por tipo.
    els.invModalTipoHint.textContent = esServicio
      ? 'Alta manual — no aplica en carga masiva.'
      : 'Un servicio no genera existencias ni historial de movimientos.';

    // Ejemplos de placeholder acordes al tipo elegido.
    els.invModalNombre.placeholder = esServicio ? 'Ej. Consultoría fiscal' : 'Ej. Tornillo M6 25mm';
    els.invModalSku.placeholder = esServicio ? 'Ej. SERV-CONS-01' : 'Ej. TORN-M6-25MM';
  }

  function abrirProductoModal(producto) {
    inventarioModalEditando = producto || null;
    // Punto 186: solo se fija el tipo al DAR DE ALTA (producto === null)
    // — editar un producto físico que ya existiera de antes (archivado)
    // sigue mostrando su tipo real, el backend ya cierra por su cuenta el
    // hueco de reactivarlo (ver validarCuerpoProducto()).
    const tipoFijoServicio = !producto && soloServiciosGlobalmente;
    els.invProductoModalTitle.textContent = producto ? 'Editar producto' : (tipoFijoServicio ? 'Nuevo servicio' : 'Nuevo producto');
    els.btnInvModalGuardarLabel.textContent = producto ? 'Guardar cambios' : 'Guardar';
    aplicarTooltipsCampoAyuda(els.invProductoModalOverlay);

    setInvModalTipo(producto ? producto.tipo : (tipoFijoServicio ? 'servicio' : 'producto'));
    if (els.btnInvTipoProducto) els.btnInvTipoProducto.disabled = tipoFijoServicio;
    if (els.invModalTipoFijoHint) els.invModalTipoFijoHint.hidden = !tipoFijoServicio;
    if (els.invModalTipoHint) els.invModalTipoHint.hidden = tipoFijoServicio;
    els.invModalNombre.value = producto ? producto.nombre : '';
    els.invModalSku.value = producto ? producto.sku : '';
    els.invModalCodigoBarras.value = producto ? producto.codigo_barras || '' : '';
    poblarSelectsCategoriaInventario();
    els.invModalCategoria.value = producto && producto.categoria_id ? String(producto.categoria_id) : '';
    if (unidadesInventarioActuales.length === 0) cargarUnidadesInventario();
    els.invModalUnidad.value = producto
      ? String(producto.unidad_id)
      : els.invModalUnidad.options[0]
        ? els.invModalUnidad.options[0].value
        : '';
    // setInvModalTipo() de arriba ya calculó el hint para la opción por
    // defecto — al editar un servicio existente el value real puede ser
    // otro (ej. "Paquete" en vez de "Hora"), hay que refrescarlo.
    if (inventarioModalTipoSeleccionado === 'servicio') actualizarHintUnidadServicio();
    els.invModalMoneda.value = producto ? producto.moneda || 'MXN' : 'MXN';
    els.invModalCosto.value = producto && producto.costo !== null ? String(producto.costo) : '';
    els.invModalPrecio.value = producto && producto.precio !== null ? String(producto.precio) : '';
    els.invModalStockMinimo.value = producto && producto.stock_minimo !== null ? String(producto.stock_minimo) : '';
    els.invModalStockMaximo.value = producto && producto.stock_maximo !== null ? String(producto.stock_maximo) : '';
    els.invModalPuntoReorden.value = producto && producto.punto_reorden !== null ? String(producto.punto_reorden) : '';
    els.invModalFechaExpiracion.value = producto && producto.fecha_expiracion ? producto.fecha_expiracion : '';
    els.invModalEstado.value = producto ? producto.estado : 'activo';
    els.invModalProveedor.value = producto ? producto.proveedor_principal || '' : '';
    els.invModalNotas.value = producto ? producto.notas || '' : '';

    // Punto 159 (Segmento B): la imagen se asocia por id — igual que el
    // comprobante de Gastos, solo aplica editando un producto que ya
    // existe, nunca al dar de alta uno nuevo.
    els.invModalImagenField.hidden = !producto;
    if (producto) mostrarEstadoImagenProducto(producto);

    ['inv-modal-nombre', 'inv-modal-sku', 'inv-modal-codigo-barras', 'inv-modal-unidad', 'inv-modal-costo', 'inv-modal-precio'].forEach((id) =>
      setFieldError(id, '')
    );
    els.invModalErrorGeneral.textContent = '';
    els.errorInvModalImagen.textContent = '';
    els.invCategoriasPanel.hidden = true;
    els.btnInvCategoriasToggle.setAttribute('aria-expanded', 'false');
    categoriaInvEditandoId = null;

    els.invProductoModalOverlay.hidden = false;
    els.invModalNombre.focus();
  }

  function cerrarProductoModal() {
    els.invProductoModalOverlay.hidden = true;
    inventarioModalEditando = null;
  }

  // Punto 159 (Segmento B): alterna entre "ya tiene imagen" (preview +
  // Quitar) y "sin imagen todavía" (dropzone) — mismo elemento del modal,
  // sin reabrir nada, para que subir/quitar se sienta inmediato.
  function mostrarEstadoImagenProducto(producto) {
    const tieneImagen = Boolean(producto && producto.imagen_thumb_url);
    els.invImagenActual.hidden = !tieneImagen;
    els.invImagenDropzone.hidden = tieneImagen;
    if (tieneImagen) cargarImagenAutenticada(els.invImagenActualPreview, producto.imagen_thumb_url);
  }

  async function subirImagenProducto(archivo) {
    if (!inventarioModalEditando) return;
    els.errorInvModalImagen.textContent = '';
    const authHeader = getAuthHeader();
    if (!authHeader) return;

    const formData = new FormData();
    formData.append('imagen', archivo);
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/productos/${inventarioModalEditando.id}/imagen`, {
        method: 'POST',
        headers: { Authorization: authHeader },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.errorInvModalImagen.textContent = data.mensaje || data.error || 'No se pudo subir la imagen.';
        return;
      }
      inventarioModalEditando.imagen_url = data.imagen_url;
      inventarioModalEditando.imagen_thumb_url = data.imagen_thumb_url;
      mostrarEstadoImagenProducto(inventarioModalEditando);
      cargarInventarios();
    } catch (err) {
      els.errorInvModalImagen.textContent = 'No se pudo subir la imagen. Revisa tu conexión.';
    } finally {
      els.invImagenInput.value = '';
    }
  }

  async function quitarImagenProducto() {
    if (!inventarioModalEditando) return;
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/productos/${inventarioModalEditando.id}/imagen`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        els.errorInvModalImagen.textContent = 'No se pudo quitar la imagen.';
        return;
      }
      inventarioModalEditando.imagen_url = null;
      inventarioModalEditando.imagen_thumb_url = null;
      mostrarEstadoImagenProducto(inventarioModalEditando);
      cargarInventarios();
    } catch (err) {
      els.errorInvModalImagen.textContent = 'No se pudo quitar la imagen. Revisa tu conexión.';
    }
  }

  if (els.invImagenInput) {
    els.invImagenInput.addEventListener('change', () => {
      const archivo = els.invImagenInput.files && els.invImagenInput.files[0];
      if (archivo) subirImagenProducto(archivo);
    });
  }
  if (els.invImagenDropzone) {
    els.invImagenDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      els.invImagenDropzone.classList.add('is-dragover');
    });
    els.invImagenDropzone.addEventListener('dragleave', () => els.invImagenDropzone.classList.remove('is-dragover'));
    els.invImagenDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      els.invImagenDropzone.classList.remove('is-dragover');
      const archivo = e.dataTransfer.files && e.dataTransfer.files[0];
      if (archivo) subirImagenProducto(archivo);
    });
  }
  if (els.btnInvImagenQuitar) els.btnInvImagenQuitar.addEventListener('click', quitarImagenProducto);

  function setGuardarProductoLoading(cargando) {
    els.btnInvModalGuardar.disabled = cargando;
    els.btnInvModalGuardarLabel.textContent = cargando ? 'Guardando…' : inventarioModalEditando ? 'Guardar cambios' : 'Guardar';
  }

  async function guardarProductoInv() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    ['inv-modal-nombre', 'inv-modal-sku', 'inv-modal-codigo-barras', 'inv-modal-unidad', 'inv-modal-costo', 'inv-modal-precio'].forEach((id) =>
      setFieldError(id, '')
    );
    els.invModalErrorGeneral.textContent = '';

    const nombre = els.invModalNombre.value.trim();
    if (!nombre) {
      setFieldError('inv-modal-nombre', 'El nombre es obligatorio.');
      return;
    }
    const sku = els.invModalSku.value.trim();
    if (!sku) {
      setFieldError('inv-modal-sku', 'El SKU es obligatorio.');
      return;
    }
    if (!els.invModalUnidad.value) {
      setFieldError('inv-modal-unidad', 'Selecciona una unidad.');
      return;
    }

    const payload = {
      nombre,
      sku,
      codigo_barras: els.invModalCodigoBarras.value.trim() || null,
      categoria_id: els.invModalCategoria.value || null,
      unidad_id: Number(els.invModalUnidad.value),
      tipo: inventarioModalTipoSeleccionado,
      moneda: els.invModalMoneda.value,
      costo: els.invModalCosto.value.trim() || null,
      precio: els.invModalPrecio.value.trim() || null,
      stock_minimo: els.invModalStockMinimo.value.trim() || null,
      stock_maximo: els.invModalStockMaximo.value.trim() || null,
      punto_reorden: els.invModalPuntoReorden.value.trim() || null,
      fecha_expiracion: els.invModalFechaExpiracion.value || null,
      estado: els.invModalEstado.value,
      proveedor_principal: els.invModalProveedor.value.trim() || null,
      notas: els.invModalNotas.value.trim() || null,
    };

    setGuardarProductoLoading(true);
    try {
      const url = inventarioModalEditando
        ? `${API_BASE}/admin/inventarios/productos/${inventarioModalEditando.id}`
        : `${API_BASE}/admin/inventarios/productos`;
      const res = await fetch(url, {
        method: inventarioModalEditando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        if (data.error === 'INV_SKU_DUPLICADO') setFieldError('inv-modal-sku', data.mensaje || 'Ya existe un producto con ese SKU.');
        else if (data.error === 'INV_UNIDAD_INVALIDA') setFieldError('inv-modal-unidad', data.mensaje || 'Unidad inválida.');
        else els.invModalErrorGeneral.textContent = data.mensaje || data.error || 'No se pudo guardar el producto.';
        return;
      }
      showToast(data.mensaje || 'Producto guardado.');
      cerrarProductoModal();
      await cargarInventarios();
      cargarDashboardInventario();
    } catch (err) {
      els.invModalErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setGuardarProductoLoading(false);
    }
  }

  // ---------- Papelera de productos ----------

  function confirmarEliminarProducto(id, nombre) {
    abrirConfirmacion({
      titulo: 'Mover a papelera',
      mensaje: `¿Mover "${nombre}" a la papelera? Se puede restaurar después.`,
      textoBoton: 'Mover a papelera',
      onConfirmar: () => eliminarProductoInv(id),
    });
  }
  async function eliminarProductoInv(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/productos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo mover a la papelera.', true);
        return;
      }
      showToast(data.mensaje || 'Producto movido a la papelera.');
      await cargarInventarios();
      cargarDashboardInventario();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }
  async function restaurarProductoInv(id, nombre) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/productos/${id}/restaurar`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo restaurar.', true);
        return;
      }
      showToast(data.mensaje || `"${nombre}" restaurado.`);
      await cargarInventarios();
      cargarDashboardInventario();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }
  function confirmarEliminarProductoPermanente(id, nombre) {
    abrirConfirmacion({
      titulo: 'Eliminar permanentemente',
      mensaje: `¿Eliminar "${nombre}" para siempre? Esta acción no se puede deshacer. Si el producto tiene movimientos registrados, no se podrá eliminar.`,
      textoBoton: 'Eliminar permanentemente',
      onConfirmar: () => eliminarProductoPermanenteInv(id),
    });
  }
  async function eliminarProductoPermanenteInv(id) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/productos/${id}/permanente`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.mensaje || data.error || 'No se pudo eliminar.', true);
        return;
      }
      showToast(data.mensaje || 'Producto eliminado permanentemente.');
      await cargarInventarios();
      cargarDashboardInventario();
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // ---------- Modal de movimiento (entrada/salida) ----------

  function poblarSelectTipoMov() {
    const opciones = inventarioMovimientoDireccion === 'entrada' ? TIPOS_MOV_ENTRADA : TIPOS_MOV_SALIDA;
    els.invMovTipo.innerHTML = opciones.map((t) => `<option value="${t.valor}">${t.etiqueta}</option>`).join('');
    const esEntrada = inventarioMovimientoDireccion === 'entrada';
    // §57: un producto en USD captura el costo en su moneda original +
    // tipo de cambio en vez del costo unitario directo en pesos.
    const monedaUsd = Boolean(inventarioMovimientoProducto && inventarioMovimientoProducto.moneda === 'USD');
    els.invMovCostoWrap.hidden = !esEntrada || monedaUsd;
    els.invMovCostoUsdWrap.hidden = !esEntrada || !monedaUsd;
  }

  function actualizarPreviewCostoUsdMovimiento() {
    const co = Number(String(els.invMovCostoOriginal.value).replace(/,/g, ''));
    const tc = Number(String(els.invMovTipoCambio.value).replace(/,/g, ''));
    if (Number.isFinite(co) && co >= 0 && Number.isFinite(tc) && tc > 0) {
      els.invMovCostoMxnPreview.textContent = `= $${formatearMoneda(Math.round(co * tc * 100) / 100)} MXN por unidad`;
    } else {
      els.invMovCostoMxnPreview.textContent = '';
    }
  }

  // Precarga el tipo de cambio del día (Banxico), editable siempre —
  // degrada a captura manual sin bloquear el flujo si no hay dato
  // automático disponible (§57).
  async function precargarTipoCambioMovimiento() {
    els.invMovTipoCambioFuente.textContent = 'Consultando tipo de cambio del día…';
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/tipo-cambio/usd`, { headers: { Authorization: authHeader } });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.valor) {
        els.invMovTipoCambio.value = data.valor;
        els.invMovTipoCambioFuente.textContent =
          data.fuente === 'banxico'
            ? `Tipo de cambio del día (Banxico, ${data.fecha}) — puedes corregirlo.`
            : `Último tipo de cambio conocido (${data.fecha}) — verifica que siga vigente.`;
      } else {
        els.invMovTipoCambioFuente.textContent = 'No se pudo obtener el tipo de cambio automático — captúralo a mano.';
      }
      actualizarPreviewCostoUsdMovimiento();
    } catch (err) {
      els.invMovTipoCambioFuente.textContent = 'No se pudo obtener el tipo de cambio automático — captúralo a mano.';
    }
  }

  function setMovimientoDireccion(direccion) {
    inventarioMovimientoDireccion = direccion;
    els.btnInvMovEntrada.classList.toggle('is-active', direccion === 'entrada');
    els.btnInvMovEntrada.setAttribute('aria-selected', String(direccion === 'entrada'));
    els.btnInvMovSalida.classList.toggle('is-active', direccion === 'salida');
    els.btnInvMovSalida.setAttribute('aria-selected', String(direccion === 'salida'));
    poblarSelectTipoMov();
  }

  function abrirMovimientoModal(producto, direccion) {
    inventarioMovimientoProducto = producto;
    setMovimientoDireccion(direccion || 'entrada');
    els.invMovimientoModalSubtitulo.textContent = `${producto.nombre} (${producto.sku}) — disponible: ${formatearCantidadInv(producto.disponible || 0)}`;
    els.invMovCantidad.value = '';
    els.invMovCosto.value = '';
    els.invMovCostoOriginal.value = '';
    els.invMovTipoCambio.value = '';
    els.invMovTipoCambioFuente.textContent = '';
    els.invMovCostoMxnPreview.textContent = '';
    els.invMovMotivo.value = '';
    els.invMovNotas.value = '';
    setFieldError('inv-mov-cantidad', '');
    setFieldError('inv-mov-costo-usd', '');
    els.invMovErrorGeneral.textContent = '';
    aplicarTooltipsCampoAyuda(els.invMovimientoModalOverlay);
    els.invMovimientoModalOverlay.hidden = false;
    els.invMovCantidad.focus();
    if (producto.moneda === 'USD') precargarTipoCambioMovimiento();
  }

  function cerrarMovimientoModal() {
    els.invMovimientoModalOverlay.hidden = true;
    inventarioMovimientoProducto = null;
  }

  async function guardarMovimientoInv() {
    if (!inventarioMovimientoProducto) return;
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    setFieldError('inv-mov-cantidad', '');
    setFieldError('inv-mov-costo-usd', '');
    els.invMovErrorGeneral.textContent = '';

    const cantidad = Number(String(els.invMovCantidad.value).replace(/,/g, ''));
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setFieldError('inv-mov-cantidad', 'La cantidad debe ser mayor a cero.');
      return;
    }

    // §57: producto en USD — costo en la moneda original + tipo de cambio,
    // en vez del costo unitario directo en pesos. Ambos opcionales (una
    // entrada puede no traer costo), pero si se captura uno, el otro se
    // vuelve obligatorio para poder convertir.
    const monedaUsd = inventarioMovimientoDireccion === 'entrada' && inventarioMovimientoProducto.moneda === 'USD';
    let costoOriginal = null;
    let tipoCambio = null;
    if (monedaUsd) {
      const coTexto = els.invMovCostoOriginal.value.trim();
      const tcTexto = els.invMovTipoCambio.value.trim();
      if (coTexto) {
        const co = Number(coTexto);
        const tc = Number(tcTexto);
        if (!Number.isFinite(co) || co < 0) {
          setFieldError('inv-mov-costo-usd', 'El costo en USD debe ser un número mayor o igual a cero.');
          return;
        }
        if (!tcTexto || !Number.isFinite(tc) || tc <= 0) {
          setFieldError('inv-mov-costo-usd', 'Captura un tipo de cambio válido (mayor a cero).');
          return;
        }
        costoOriginal = co;
        tipoCambio = tc;
      }
    }

    const payload = {
      producto_id: inventarioMovimientoProducto.id,
      tipo: els.invMovTipo.value,
      cantidad,
      costo_unitario: !monedaUsd && inventarioMovimientoDireccion === 'entrada' && els.invMovCosto.value.trim() ? Number(els.invMovCosto.value) : null,
      costo_original: costoOriginal,
      tipo_cambio: tipoCambio,
      motivo: els.invMovMotivo.value.trim() || null,
      notas: els.invMovNotas.value.trim() || null,
    };

    els.btnInvMovGuardar.disabled = true;
    els.btnInvMovGuardarLabel.textContent = 'Guardando…';
    try {
      const ruta = inventarioMovimientoDireccion === 'entrada' ? 'entradas' : 'salidas';
      // Idempotency-Key (§0.5.E): generada UNA vez al abrir el modal se
      // quedaría igual entre reintentos reales, pero como este flujo no
      // guarda la key entre aperturas, un doble clic dentro de la misma
      // llamada queda cubierto igual por deshabilitar el botón arriba —
      // la key sirve sobre todo contra un reintento de RED (mismo clic,
      // la petición se reenvía sola), no contra un segundo clic humano.
      const idempotencyKey =
        window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(`${API_BASE}/admin/inventarios/${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader, 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        els.invMovErrorGeneral.textContent = data.mensaje || data.error || 'No se pudo registrar el movimiento.';
        return;
      }
      showToast(`${data.folio} registrado — existencia: ${formatearCantidadInv(data.existenciaPosterior)}`);
      // Primeros pasos (perfil Inventario): la primera entrada real marca
      // el paso 2 del checklist listo, sin esperar a la siguiente vez que
      // se visite "Inicio".
      if (inventarioMovimientoDireccion === 'entrada') {
        guardarEstadoOnboarding({ entradaInventarioRegistrada: true });
        renderOnboardingChecklist();
      }
      cerrarMovimientoModal();
      await cargarInventarios();
      cargarDashboardInventario();
    } catch (err) {
      els.invMovErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      els.btnInvMovGuardar.disabled = false;
      els.btnInvMovGuardarLabel.textContent = 'Registrar';
    }
  }

  // ---------- Modal de kardex ----------

  async function abrirKardexModal(producto) {
    els.invKardexModalOverlay.hidden = false;
    els.invKardexSubtitulo.textContent = `${producto.nombre} (${producto.sku})`;
    els.invKardexTableBody.innerHTML = '';
    els.invKardexEmpty.hidden = true;

    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/kardex?producto_id=${producto.id}&por_pagina=100`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.invKardexEmpty.hidden = false;
        els.invKardexEmpty.textContent = 'No se pudo cargar el historial de movimientos.';
        return;
      }
      const movimientos = data.movimientos || [];
      els.invKardexEmpty.hidden = movimientos.length > 0;
      movimientos.forEach((m) => {
        const tr = document.createElement('tr');
        // §57: si la entrada trae tipo_cambio, el costo se muestra con el
        // desglose USD × TC = MXN en el mismo tooltip unificado del sitio
        // (punto 148) en vez de un texto largo fijo en la celda.
        const costoCelda =
          m.costo_unitario === null
            ? '—'
            : m.tipo_cambio
              ? `<span data-tooltip="${escapeHtml(`$${formatearMoneda(m.costo_original)} USD × ${formatearMoneda(m.tipo_cambio)} = $${formatearMoneda(m.costo_unitario)} MXN`)}">$${formatearMoneda(m.costo_unitario)}</span>`
              : `$${formatearMoneda(m.costo_unitario)}`;
        tr.innerHTML = `
          <td data-label="Folio">${escapeHtml(m.folio || '—')}</td>
          <td data-label="Tipo">${escapeHtml(etiquetaTipoMovimiento(m.tipo))}</td>
          <td data-label="Cantidad" class="col-num">${formatearCantidadInv(m.cantidad)}</td>
          <td data-label="Costo" class="col-num">${costoCelda}</td>
          <td data-label="Anterior" class="col-num">${formatearCantidadInv(m.existencia_anterior)}</td>
          <td data-label="Posterior" class="col-num">${formatearCantidadInv(m.existencia_posterior)}</td>
          <td data-label="Motivo">${escapeHtml(m.motivo || '—')}</td>
          <td data-label="Usuario">${escapeHtml(m.usuario || '—')}</td>
          <td data-label="Fecha">${escapeHtml(m.creado_en || '—')}</td>
        `;
        els.invKardexTableBody.appendChild(tr);
      });
    } catch (err) {
      els.invKardexEmpty.hidden = false;
      els.invKardexEmpty.textContent = 'No se pudo conectar con el servidor.';
    }
  }
  function cerrarKardexModal() {
    els.invKardexModalOverlay.hidden = true;
  }

  // ---------- Modal "Productos por vencer" (punto 213) ----------
  // Reusa GET /productos con el filtro ?vencimiento=por_vencer — mismo
  // dato exacto que ya alimenta la cuenta de la tarjeta (UMBRAL_POR_
  // VENCER_DIAS en server.js), así que nunca puede desincronizarse.
  // "YYYY-MM-DD" se reordena a mano (sin pasar por Date) — es una fecha
  // sin hora, formatFecha() está pensada para DATETIME y le agregaría una
  // "Z" a un texto sin hora, produciendo una fecha inválida.
  function formatFechaSolo(fechaTexto) {
    if (!fechaTexto) return '—';
    const [anio, mes, dia] = String(fechaTexto).split('-');
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : fechaTexto;
  }

  async function abrirPorVencerModal() {
    els.invPorVencerModalOverlay.hidden = false;
    els.invPorVencerTableBody.innerHTML = '';
    els.invPorVencerEmpty.hidden = true;

    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/productos?vencimiento=por_vencer&por_pagina=200`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.invPorVencerEmpty.hidden = false;
        els.invPorVencerEmpty.textContent = 'No se pudo cargar la lista.';
        return;
      }
      const productos = data.productos || [];
      els.invPorVencerEmpty.hidden = productos.length > 0;
      const hoyTexto = new Date().toISOString().slice(0, 10);
      productos.forEach((p) => {
        const vencido = p.fecha_expiracion && p.fecha_expiracion < hoyTexto;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td data-label="Producto">${escapeHtml(p.nombre)}</td>
          <td data-label="SKU">${escapeHtml(p.sku)}</td>
          <td data-label="Vence">${formatFechaSolo(p.fecha_expiracion)}</td>
          <td data-label="Estado"><span class="estatus-badge ${vencido ? 'estatus-cancelado' : 'estatus-pendiente'}">${vencido ? 'Vencido' : 'Por vencer'}</span></td>
        `;
        els.invPorVencerTableBody.appendChild(tr);
      });
    } catch (err) {
      els.invPorVencerEmpty.hidden = false;
      els.invPorVencerEmpty.textContent = 'No se pudo conectar con el servidor.';
    }
  }
  function cerrarPorVencerModal() {
    els.invPorVencerModalOverlay.hidden = true;
  }

  // ---------- Etiqueta de código de barras imprimible (punto 167) ----------
  // Code128 (backend, bwip-js) — el único formato del set que ya lee
  // scanner.js (punto 159) capaz de codificar el texto libre de
  // `codigo_barras`, no solo dígitos. Sin `codigo_barras`, se usa el `sku`
  // (siempre único y obligatorio). 1 producto a la vez — mismo patrón que
  // el resto del menú "⋮" de la fila, sin selección múltiple nueva.
  let etiquetaProductoActual = null;
  let etiquetaBarraBlobUrl = null;

  async function abrirEtiquetaModal(producto) {
    etiquetaProductoActual = producto;
    els.invEtiquetaProductoNombre.textContent = `${producto.nombre} · SKU ${producto.sku}`;
    els.invEtiquetaFormato.value = 'termica';
    els.invEtiquetaCantidad.value = '1';
    setFieldError('inv-etiqueta-cantidad', '');
    els.invEtiquetaErrorGeneral.textContent = '';
    els.invEtiquetaPreviewNombre.textContent = producto.nombre;
    els.invEtiquetaPreviewPrecio.textContent =
      producto.precio === null || producto.precio === undefined ? '' : `$${formatearMoneda(producto.precio)}`;
    const codigo = (producto.codigo_barras || producto.sku || '').trim();
    els.invEtiquetaPreviewCodigo.textContent = codigo;
    els.invEtiquetaPreviewBarra.removeAttribute('src');
    els.invEtiquetaModalOverlay.hidden = false;
    await cargarBarraEtiqueta(producto.id);
  }

  async function cargarBarraEtiqueta(productoId) {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/productos/${productoId}/codigo-barras.svg`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        els.invEtiquetaErrorGeneral.textContent = data.error || 'No se pudo generar el código de barras.';
        return;
      }
      const blob = await res.blob();
      if (etiquetaBarraBlobUrl) URL.revokeObjectURL(etiquetaBarraBlobUrl);
      etiquetaBarraBlobUrl = URL.createObjectURL(blob);
      els.invEtiquetaPreviewBarra.src = etiquetaBarraBlobUrl;
    } catch (err) {
      els.invEtiquetaErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    }
  }

  function cerrarEtiquetaModal() {
    els.invEtiquetaModalOverlay.hidden = true;
    etiquetaProductoActual = null;
  }

  els.btnInvEtiquetaCerrar.addEventListener('click', cerrarEtiquetaModal);
  els.btnInvEtiquetaCancelar.addEventListener('click', cerrarEtiquetaModal);
  els.invEtiquetaModalOverlay.addEventListener('click', (e) => {
    if (e.target === els.invEtiquetaModalOverlay) cerrarEtiquetaModal();
  });

  // Misma tarjeta que la vista previa del modal, reutilizada N veces en el
  // contenedor imprimible — un solo lugar arma el marcado de una etiqueta.
  function celdaEtiquetaHtml(producto, barraBlobUrl, codigo) {
    const precioHtml =
      producto.precio === null || producto.precio === undefined
        ? ''
        : `<div class="inv-etiqueta-precio">$${formatearMoneda(producto.precio)}</div>`;
    return `
      <div class="inv-etiqueta-celda">
        <img class="inv-etiqueta-barra" src="${barraBlobUrl}" alt="" />
        <div class="inv-etiqueta-nombre">${escapeHtml(producto.nombre)}</div>
        ${precioHtml}
        <div class="inv-etiqueta-codigo">${escapeHtml(codigo)}</div>
      </div>`;
  }

  const ETIQUETAS_CARTA_POR_HOJA = 24;

  function imprimirEtiquetas(producto, formato, cantidad, barraBlobUrl) {
    const codigo = (producto.codigo_barras || producto.sku || '').trim();
    const contenedor = els.invEtiquetaImprimirContenedor;
    if (formato === 'termica') {
      contenedor.innerHTML = Array.from(
        { length: cantidad },
        () => `<div class="inv-etiqueta-hoja-termica">${celdaEtiquetaHtml(producto, barraBlobUrl, codigo)}</div>`
      ).join('');
    } else {
      const hojas = Math.ceil(cantidad / ETIQUETAS_CARTA_POR_HOJA);
      let html = '';
      for (let h = 0; h < hojas; h += 1) {
        const enEstaHoja = Math.min(ETIQUETAS_CARTA_POR_HOJA, cantidad - h * ETIQUETAS_CARTA_POR_HOJA);
        html += `<div class="inv-etiqueta-hoja-carta">${Array.from({ length: enEstaHoja }, () =>
          celdaEtiquetaHtml(producto, barraBlobUrl, codigo)
        ).join('')}</div>`;
      }
      contenedor.innerHTML = html;
    }
    contenedor.className = `inv-etiqueta-imprimir formato-${formato}`;
    cerrarEtiquetaModal();
    window.print();
  }

  els.btnInvEtiquetaImprimir.addEventListener('click', () => {
    const cantidad = Number(els.invEtiquetaCantidad.value);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 200) {
      setFieldError('inv-etiqueta-cantidad', 'Captura un número entero entre 1 y 200.');
      return;
    }
    setFieldError('inv-etiqueta-cantidad', '');
    if (!etiquetaBarraBlobUrl || !etiquetaProductoActual) {
      els.invEtiquetaErrorGeneral.textContent = 'Todavía no se pudo generar el código de barras.';
      return;
    }
    imprimirEtiquetas(etiquetaProductoActual, els.invEtiquetaFormato.value, cantidad, etiquetaBarraBlobUrl);
  });

  // ---------- Verificar integridad (§0.5.F) ----------

  async function verificarIntegridadInv() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.btnInvVerificarIntegridad.disabled = true;
    const textoOriginal = els.btnInvVerificarIntegridad.textContent;
    els.btnInvVerificarIntegridad.textContent = 'Verificando…';
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/verificar-integridad`, {
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'No se pudo verificar.', true);
        return;
      }
      if (data.ok) {
        showToast('Integridad verificada — sin divergencias.');
      } else {
        showToast(`${data.divergencias.length} divergencia(s) encontrada(s) — revisa la consola para el detalle.`, true);
        console.warn('Divergencias de inventario (§0.5.F):', data.divergencias);
      }
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    } finally {
      els.btnInvVerificarIntegridad.disabled = false;
      els.btnInvVerificarIntegridad.textContent = textoOriginal;
    }
  }

  // ---------- Importador masivo CSV/XLSX (§34, segmento 6) ----------
  // Duplicación intencional del catálogo de campos de
  // backend/utils/inventarioCampos.js — mismo criterio que el diccionario
  // de categorías de Gastos (código pequeño compartido se duplica a
  // propósito en vez de importar entre backend/ y frontend/, que no
  // comparten build).
  const INV_IMPORT_CAMPOS = [
    { campo: 'sku', etiqueta: 'SKU / Clave', obligatorio: true },
    { campo: 'nombre', etiqueta: 'Nombre', obligatorio: true },
    { campo: 'codigo_barras', etiqueta: 'Código de barras', obligatorio: false },
    { campo: 'descripcion_corta', etiqueta: 'Descripción corta', obligatorio: false },
    { campo: 'descripcion_larga', etiqueta: 'Descripción larga', obligatorio: false },
    { campo: 'marca', etiqueta: 'Marca', obligatorio: false },
    { campo: 'fabricante', etiqueta: 'Fabricante', obligatorio: false },
    { campo: 'modelo', etiqueta: 'Modelo', obligatorio: false },
    { campo: 'categoria', etiqueta: 'Categoría', obligatorio: false },
    { campo: 'unidad_base', etiqueta: 'Unidad de medida', obligatorio: true },
    { campo: 'tipo', etiqueta: 'Tipo (producto/servicio)', obligatorio: false },
    { campo: 'costo', etiqueta: 'Costo', obligatorio: false },
    { campo: 'precio', etiqueta: 'Precio', obligatorio: false },
    { campo: 'stock_minimo', etiqueta: 'Stock mínimo', obligatorio: false },
    { campo: 'stock_maximo', etiqueta: 'Stock máximo', obligatorio: false },
    { campo: 'punto_reorden', etiqueta: 'Punto de reorden', obligatorio: false },
    { campo: 'proveedor_principal', etiqueta: 'Proveedor principal', obligatorio: false },
    { campo: 'existencia_inicial', etiqueta: 'Existencia inicial', obligatorio: false },
    { campo: 'estado', etiqueta: 'Estado (activo/inactivo)', obligatorio: false },
    { campo: 'notas', etiqueta: 'Notas', obligatorio: false },
  ];

  const INV_IMPORT_CONFIANZA = {
    perfil: { texto: 'Desde tu perfil', clase: 'estatus-listo' },
    exacto: { texto: 'Exacto', clase: 'estatus-listo' },
    reconocido: { texto: 'Reconocido', clase: 'estatus-listo' },
    sugerido: { texto: 'Sugerido, revisa', clase: 'estatus-pendiente' },
    manual: { texto: 'Asignado a mano', clase: 'estatus-listo' },
  };

  let estadoImport = null;

  function estadoImportInicial() {
    return {
      paso: 1,
      archivo: null,
      importacionId: null,
      formato: null,
      hojas: null,
      hojaSeleccionada: null,
      cabeceras: [],
      vistaPrevia: [],
      totalFilas: 0,
      mapeo: {},
      modo: 'tolerante',
      validado: false,
      validacionAbortada: false,
      polling: null,
    };
  }

  function mostrarErrorImport(mensaje) {
    els.invImportErrorGeneral.textContent = mensaje;
    els.invImportErrorGeneral.hidden = false;
  }

  function limpiarErrorImport() {
    els.invImportErrorGeneral.hidden = true;
    els.invImportErrorGeneral.textContent = '';
  }

  function abrirImportacionModal() {
    if (estadoImport && estadoImport.polling) clearInterval(estadoImport.polling);
    estadoImport = estadoImportInicial();
    els.invImportArchivo.value = '';
    els.invImportPreset.value = 'otro';
    els.invImportGuardarPerfil.checked = true;
    els.invImportConservarExtra.checked = true;
    els.invImportNombrePerfil.value = '';
    els.invImportSobrescribirVacios.checked = false;
    els.invImportResultadoValidacion.hidden = true;
    els.invImportProgresoEjecucion.hidden = true;
    els.invImportPerfilAviso.hidden = true;
    const radioTolerante = document.querySelector('input[name="inv-import-modo"][value="tolerante"]');
    if (radioTolerante) radioTolerante.checked = true;
    limpiarErrorImport();
    irAPasoImport(1);
    els.invImportacionModalOverlay.hidden = false;
    setTimeout(() => els.invImportArchivo && els.invImportArchivo.focus(), 30);
  }

  function cerrarImportacionModal() {
    if (estadoImport && estadoImport.polling) clearInterval(estadoImport.polling);
    els.invImportacionModalOverlay.hidden = true;
    estadoImport = null;
  }

  function irAPasoImport(n) {
    estadoImport.paso = n;
    document.querySelectorAll('.inv-import-paso').forEach((el) => {
      el.classList.toggle('is-active', Number(el.dataset.paso) === n);
    });
    document.querySelectorAll('#inv-import-progreso li').forEach((li) => {
      const p = Number(li.dataset.paso);
      li.classList.toggle('is-active', p === n);
      li.classList.toggle('is-done', p < n);
    });
    limpiarErrorImport();
    els.invImportNav.hidden = n === 6;
    els.btnInvImportAtras.hidden = n === 1 || n === 6;
    actualizarBotonSiguienteImport();
    const titulo = document.getElementById(`inv-import-paso-${n}-titulo`);
    if (titulo) titulo.focus();
  }

  function actualizarBotonSiguienteImport() {
    const btn = els.btnInvImportSiguiente;
    btn.disabled = false;
    switch (estadoImport.paso) {
      case 1:
        btn.textContent = 'Subir y continuar';
        break;
      case 2:
        btn.textContent = 'Continuar al mapeo';
        break;
      case 3:
        btn.textContent = 'Continuar a validación';
        btn.disabled = !mapeoListoParaSiguienteImport();
        break;
      case 4:
        btn.textContent = estadoImport.validado ? 'Continuar' : 'Validar archivo';
        btn.disabled = estadoImport.validado && estadoImport.validacionAbortada;
        break;
      case 5:
        btn.textContent = 'Ejecutar importación';
        break;
      default:
        break;
    }
  }

  function mapeoListoParaSiguienteImport() {
    const obligatorios = INV_IMPORT_CAMPOS.filter((c) => c.obligatorio);
    for (const c of obligatorios) {
      const a = estadoImport.mapeo[c.campo];
      if (!a) return false;
      if (a.requiereConfirmacion && !a.confirmado) return false;
    }
    return true;
  }

  // ---------- Paso 1: subir archivo ----------

  async function avanzarDesdePasoImport1() {
    const archivo = els.invImportArchivo.files[0];
    if (!archivo) {
      mostrarErrorImport('Selecciona un archivo CSV o XLSX.');
      return;
    }
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    await subirArchivoImport(archivo, null);
  }

  async function subirArchivoImport(archivo, hojaElegida) {
    const authHeader = getAuthHeader();
    const formData = new FormData();
    formData.append('archivo', archivo);
    const preset = els.invImportPreset.value;
    if (preset && preset !== 'otro') formData.append('preset_sistema', preset);
    if (hojaElegida) formData.append('hoja', hojaElegida);

    els.btnInvImportSiguiente.disabled = true;
    els.btnInvImportSiguiente.textContent = 'Subiendo…';
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/importaciones`, {
        method: 'POST',
        headers: { Authorization: authHeader },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        mostrarErrorImport(data.mensaje || data.error || 'No se pudo subir el archivo.');
        return;
      }
      estadoImport.archivo = archivo;
      estadoImport.importacionId = data.importacionId;
      estadoImport.formato = data.formato;
      estadoImport.hojas = data.hojas;
      estadoImport.hojaSeleccionada = data.hojaSeleccionada;
      estadoImport.cabeceras = data.cabeceras;
      estadoImport.vistaPrevia = data.vistaPrevia;
      estadoImport.totalFilas = data.totalFilas;
      estadoImport.mapeo = {};
      Object.entries(data.mapeoSugerido || {}).forEach(([campo, info]) => {
        estadoImport.mapeo[campo] = { ...info, confirmado: false };
      });
      estadoImport.validado = false;
      estadoImport.validacionAbortada = false;
      renderPasoImport2();
      renderMapeoTablaImport(data.perfilAplicado);
      irAPasoImport(2);
    } catch (err) {
      mostrarErrorImport('No se pudo conectar con el servidor.');
    } finally {
      // actualizarBotonSiguienteImport() (llamado dentro de irAPasoImport en
      // el camino feliz) ya deja la etiqueta correcta para el paso actual —
      // restaurar aquí un texto fijo la pisaría de vuelta al label viejo
      // ("Subir y continuar") justo después de avanzar de paso. Bug real
      // encontrado en la validación visual (2026-08-25).
      actualizarBotonSiguienteImport();
    }
  }

  // ---------- Paso 2: hoja y vista previa ----------

  function renderPasoImport2() {
    const multiHoja = Array.isArray(estadoImport.hojas) && estadoImport.hojas.length > 1;
    els.invImportHojaField.hidden = !multiHoja;
    if (multiHoja) {
      els.invImportHojaSelect.innerHTML = estadoImport.hojas
        .map((h) => `<option value="${escapeHtml(h)}" ${h === estadoImport.hojaSeleccionada ? 'selected' : ''}>${escapeHtml(h)}</option>`)
        .join('');
    }
    els.invImportInfoArchivo.textContent = `${estadoImport.archivo ? estadoImport.archivo.name : 'Archivo'} — ${estadoImport.totalFilas} fila(s) de datos, ${estadoImport.cabeceras.length} columna(s).`;
    els.invImportPreviewThead.innerHTML = `<tr>${estadoImport.cabeceras.map((c) => `<th>${escapeHtml(String(c))}</th>`).join('')}</tr>`;
    els.invImportPreviewTbody.innerHTML = estadoImport.vistaPrevia
      .map((fila) => `<tr>${estadoImport.cabeceras.map((_, idx) => `<td>${escapeHtml(fila[idx] === undefined ? '' : String(fila[idx]))}</td>`).join('')}</tr>`)
      .join('') || `<tr><td colspan="${estadoImport.cabeceras.length || 1}">Sin filas de datos.</td></tr>`;
  }

  async function cambiarHojaImport() {
    if (!estadoImport.archivo) return;
    await subirArchivoImport(estadoImport.archivo, els.invImportHojaSelect.value);
  }

  // ---------- Paso 3: mapear cabeceras ----------

  function renderMapeoTablaImport(perfilAplicado) {
    if (perfilAplicado) {
      els.invImportPerfilAviso.hidden = false;
      els.invImportPerfilAviso.textContent = perfilAplicado.coincidenciaCompleta
        ? `Se aplicó tu perfil «${perfilAplicado.nombre}» — revisa y continúa.`
        : `Se aplicó parcialmente tu perfil «${perfilAplicado.nombre}» (algunas columnas no coinciden) — revisa el resto.`;
    } else {
      els.invImportPerfilAviso.hidden = true;
    }

    const filasHtml = INV_IMPORT_CAMPOS.map((c) => {
      const asignacion = estadoImport.mapeo[c.campo];
      const columnaIdx = asignacion ? asignacion.columnaIndice : '';
      const opciones = ['<option value="">— Sin mapear —</option>']
        .concat(
          estadoImport.cabeceras.map(
            (cab, idx) => `<option value="${idx}" ${idx === columnaIdx ? 'selected' : ''}>${escapeHtml(String(cab))}</option>`
          )
        )
        .join('');
      const previewValores = columnaIdx !== '' && estadoImport.vistaPrevia.length > 0
        ? estadoImport.vistaPrevia
          .slice(0, 3)
          .map((fila) => fila[columnaIdx])
          .filter((v) => v !== undefined && v !== '')
          .join(', ')
        : '—';
      const badge = asignacion ? (INV_IMPORT_CONFIANZA[asignacion.confianza] || INV_IMPORT_CONFIANZA.manual) : { texto: 'Sin mapear', clase: 'estatus-neutro' };
      const necesitaConfirmar = asignacion && asignacion.requiereConfirmacion && !asignacion.confirmado;
      return `
        <tr>
          <td>${escapeHtml(c.etiqueta)}${c.obligatorio ? ' <span class="required">*</span>' : ''}<button type="button" class="campo-ayuda" data-campo="${c.campo}" aria-label="Ver ayuda de ${escapeHtml(c.etiqueta)}">?</button></td>
          <td><select class="inv-import-mapeo-select" data-campo="${c.campo}" aria-label="Columna para ${escapeHtml(c.etiqueta)}">${opciones}</select></td>
          <td class="inv-import-mapeo-preview" data-tooltip="${escapeHtml(previewValores)}">${escapeHtml(previewValores)}</td>
          <td>
            <span class="estatus-badge ${badge.clase}">${escapeHtml(badge.texto)}</span>
            ${necesitaConfirmar ? `<label class="inv-import-confirmar"><input type="checkbox" class="inv-import-confirmar-check" data-campo="${c.campo}" /> Confirmo</label>` : ''}
          </td>
        </tr>`;
    }).join('');
    els.invImportMapeoBody.innerHTML = filasHtml;
    aplicarTooltipsCampoAyuda(els.invImportMapeoBody);
    actualizarCoberturaImport();
  }

  function actualizarCoberturaImport() {
    const obligatorios = INV_IMPORT_CAMPOS.filter((c) => c.obligatorio);
    const opcionales = INV_IMPORT_CAMPOS.filter((c) => !c.obligatorio);
    const cubiertosObligatorios = obligatorios.filter((c) => estadoImport.mapeo[c.campo]).length;
    const cubiertosOpcionales = opcionales.filter((c) => estadoImport.mapeo[c.campo]).length;
    els.invImportCobertura.textContent = `Obligatorios cubiertos: ${cubiertosObligatorios}/${obligatorios.length} · Opcionales: ${cubiertosOpcionales}/${opcionales.length}`;
    actualizarBotonSiguienteImport();
  }

  function manejarCambioMapeoImport(e) {
    if (e.target.classList.contains('inv-import-mapeo-select')) {
      const campo = e.target.dataset.campo;
      const val = e.target.value;
      if (val !== '') {
        const idx = Number(val);
        // Un campo recibe a lo más una columna (34.3 regla 1) — si otro
        // campo ya usaba esta columna, se desasigna.
        Object.keys(estadoImport.mapeo).forEach((otroCampo) => {
          if (otroCampo !== campo && estadoImport.mapeo[otroCampo] && estadoImport.mapeo[otroCampo].columnaIndice === idx) {
            delete estadoImport.mapeo[otroCampo];
          }
        });
        const def = INV_IMPORT_CAMPOS.find((c) => c.campo === campo);
        estadoImport.mapeo[campo] = {
          columnaIndice: idx,
          confianza: 'manual',
          esObligatorio: def ? def.obligatorio : false,
          requiereConfirmacion: false,
          confirmado: true,
        };
      } else {
        delete estadoImport.mapeo[campo];
      }
      estadoImport.validado = false;
      renderMapeoTablaImport(null);
    } else if (e.target.classList.contains('inv-import-confirmar-check')) {
      const campo = e.target.dataset.campo;
      if (estadoImport.mapeo[campo]) estadoImport.mapeo[campo].confirmado = e.target.checked;
      actualizarCoberturaImport();
    }
  }

  function avanzarDesdePasoImport3() {
    els.invImportNombrePerfilField.hidden = !els.invImportGuardarPerfil.checked;
    irAPasoImport(4);
  }

  // ---------- Paso 4: validación ----------

  function mapeoFinalParaEnviar() {
    const mapeoFinal = {};
    Object.entries(estadoImport.mapeo).forEach(([campo, info]) => {
      mapeoFinal[campo] = info.columnaIndice;
    });
    return mapeoFinal;
  }

  async function validarImportacion() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    const modoInput = document.querySelector('input[name="inv-import-modo"]:checked');
    estadoImport.modo = modoInput ? modoInput.value : 'tolerante';
    const body = {
      mapeo: mapeoFinalParaEnviar(),
      modo: estadoImport.modo,
      sobrescribirVacios: els.invImportSobrescribirVacios.checked,
      conservarExtra: els.invImportConservarExtra.checked,
      guardarPerfil: els.invImportGuardarPerfil.checked,
      nombrePerfil: els.invImportNombrePerfil.value,
    };
    els.btnInvImportSiguiente.disabled = true;
    els.btnInvImportSiguiente.textContent = 'Validando…';
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/importaciones/${estadoImport.importacionId}/mapeo`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok && !data.estado) {
        mostrarErrorImport(data.error || 'No se pudo validar el archivo.');
        return;
      }
      estadoImport.validado = true;
      estadoImport.validacionAbortada = Boolean(data.abortado);
      estadoImport.productosNuevosEstimado = data.productosNuevosEstimado;
      estadoImport.productosActualizarEstimado = data.productosActualizarEstimado;
      renderResultadoValidacionImport(data);
      actualizarBotonSiguienteImport();
    } catch (err) {
      mostrarErrorImport('No se pudo conectar con el servidor.');
    } finally {
      if (!estadoImport.validado) {
        els.btnInvImportSiguiente.disabled = false;
        els.btnInvImportSiguiente.textContent = 'Validar archivo';
      }
    }
  }

  function renderResultadoValidacionImport(data) {
    els.invImportResultadoValidacion.hidden = false;
    if (data.abortado) {
      els.invImportValidacionResumen.textContent = `Se abortó la validación (modo estricto): ${data.motivoAborto || 'error en una fila'}. Corrige el archivo o cambia a modo tolerante.`;
    } else {
      els.invImportValidacionResumen.textContent = `${data.filasOk} de ${data.totalFilas} fila(s) válida(s)${data.filasError > 0 ? `, ${data.filasError} con error` : ''}.`;
    }
    const errores = data.erroresPreview || [];
    els.invImportErroresBody.innerHTML = errores.length > 0
      ? errores.map((e) => `<tr><td>${e.fila}</td><td>${escapeHtml(e.columna || '')}</td><td>${escapeHtml(e.valor || '')}</td><td>${escapeHtml(e.motivo)}</td></tr>`).join('')
      : '<tr><td colspan="4">Sin errores.</td></tr>';
    els.btnInvImportDescargarErrores.hidden = data.filasError === 0;
  }

  async function descargarErroresImport() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/importaciones/${estadoImport.importacionId}/errores.csv`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        showToast('No se pudo descargar el archivo de errores.', true);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `errores-importacion-${estadoImport.importacionId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // ---------- Paso 5: ejecutar ----------

  function avanzarDesdePasoImport4() {
    if (estadoImport.validacionAbortada) return;
    els.invImportConfirmacionEjecutar.textContent =
      `Se importarán ${estadoImport.productosNuevosEstimado} producto(s) nuevo(s) y se actualizarán ${estadoImport.productosActualizarEstimado} existente(s).`;
    els.invImportProgresoEjecucion.hidden = true;
    irAPasoImport(5);
  }

  async function ejecutarImportacionUI() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.btnInvImportSiguiente.disabled = true;
    els.btnInvImportAtras.hidden = true;
    els.btnInvImportSiguiente.textContent = 'Ejecutando…';
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/importaciones/${estadoImport.importacionId}/ejecutar`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Idempotency-Key': `imp-${estadoImport.importacionId}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession();
        showLogin();
        return;
      }
      if (!res.ok) {
        mostrarErrorImport(data.mensaje || data.error || 'No se pudo ejecutar la importación.');
        els.btnInvImportSiguiente.disabled = false;
        els.btnInvImportSiguiente.textContent = 'Ejecutar importación';
        return;
      }
      if (data.estado === 'completada') {
        mostrarResultadoFinalImport(data);
        return;
      }
      // >500 filas: job en segundo plano — poll cada 2s (§34.8).
      els.invImportProgresoEjecucion.hidden = false;
      els.invImportProgresoTexto.textContent = `Procesando… ${data.totalFilas || ''} fila(s) en curso.`;
      estadoImport.polling = setInterval(() => pollImportacionEjecucion(authHeader), 2000);
    } catch (err) {
      mostrarErrorImport('No se pudo conectar con el servidor.');
      els.btnInvImportSiguiente.disabled = false;
      els.btnInvImportSiguiente.textContent = 'Ejecutar importación';
    }
  }

  async function pollImportacionEjecucion(authHeader) {
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/importaciones/${estadoImport.importacionId}`, {
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      if (data.estado === 'ejecutando') {
        els.invImportProgresoTexto.textContent = `Procesando… ${data.progreso || 0}%`;
        return;
      }
      clearInterval(estadoImport.polling);
      estadoImport.polling = null;
      if (data.estado === 'completada') {
        mostrarResultadoFinalImport(data);
      } else {
        mostrarErrorImport('La importación terminó con un error inesperado. Revisa el registro del servidor.');
        els.btnInvImportSiguiente.disabled = false;
        els.btnInvImportSiguiente.textContent = 'Ejecutar importación';
      }
    } catch (err) {
      // Un fallo transitorio de red al hacer polling no cancela el job en
      // el servidor — simplemente se reintenta en el siguiente tick.
    }
  }

  // ---------- Paso 6: resultado ----------

  function mostrarResultadoFinalImport(data) {
    els.invImportResultadoTexto.textContent =
      `Importación completada: ${data.productos_creados} producto(s) nuevo(s), ${data.productos_actualizados} actualizado(s)` +
      (data.existencias_iniciales_ignoradas ? `, ${data.existencias_iniciales_ignoradas} existencia(s) inicial(es) ignorada(s) por re-importación` : '') +
      (data.errores_ejecucion ? `, ${data.errores_ejecucion} error(es) durante la ejecución` : '') +
      '.';
    irAPasoImport(6);
    cargarInventarios();
    cargarDashboardInventario();
  }

  // ---------- Descargar plantilla ----------

  async function descargarPlantillaImport(formato) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/importaciones/plantilla.${formato}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        showToast('No se pudo descargar la plantilla.', true);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla-inventarios.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    }
  }

  // ---------- Navegación del wizard ----------

  function manejarSiguienteImport() {
    switch (estadoImport.paso) {
      case 1:
        avanzarDesdePasoImport1();
        break;
      case 2:
        irAPasoImport(3);
        break;
      case 3:
        avanzarDesdePasoImport3();
        break;
      case 4:
        if (estadoImport.validado && !estadoImport.validacionAbortada) {
          avanzarDesdePasoImport4();
        } else {
          validarImportacion();
        }
        break;
      case 5:
        ejecutarImportacionUI();
        break;
      default:
        break;
    }
  }

  function manejarAtrasImport() {
    if (estadoImport.paso > 1) irAPasoImport(estadoImport.paso - 1);
  }

  // ---------- Ayuda y diccionario de datos (§56, segmento 8) ----------
  // Modal (no una página/ruta propia — este panel es un SPA de un solo
  // HTML sin ruteo real) para poder abrirse desde el sidebar Y desde el
  // wizard de importación sin cerrar lo que esté en curso (56.4).

  const INV_AYUDA_GRUPOS = [
    { grupo: 'catalogo', titulo: 'Catálogo' },
    { grupo: 'moneda_extranjera', titulo: 'Moneda extranjera' },
    { grupo: 'existencias', titulo: 'Existencias y movimientos' },
    { grupo: 'importacion', titulo: 'Importación masiva' },
  ];

  let inventarioDiccionarioCache = null;

  async function obtenerDiccionarioInv() {
    if (inventarioDiccionarioCache) return inventarioDiccionarioCache;
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return [];
    }
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/diccionario`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        clearSession();
        showLogin();
        return [];
      }
      const data = await res.json().catch(() => ({}));
      inventarioDiccionarioCache = data.diccionario || [];
      return inventarioDiccionarioCache;
    } catch (err) {
      return [];
    }
  }

  function renderTarjetaAyuda(d) {
    return `
      <article class="inv-ayuda-tarjeta" id="campo-${d.id}" tabindex="-1" aria-labelledby="campo-${d.id}-titulo" data-buscable="${escapeHtml(`${d.etiqueta} ${d.explicacion_simple} ${(d.sinonimos || []).join(' ')}`.toLowerCase())}">
        <div class="inv-ayuda-tarjeta-header">
          <h4 class="inv-ayuda-tarjeta-titulo" id="campo-${d.id}-titulo">${escapeHtml(d.etiqueta)}</h4>
          ${d.obligatorio === true ? '<span class="estatus-badge estatus-cancelado">Obligatorio</span>' : d.obligatorio === false ? '<span class="estatus-badge estatus-neutro">Opcional</span>' : ''}
        </div>
        <p class="inv-ayuda-tarjeta-explicacion">${escapeHtml(d.explicacion_simple)}</p>
        <p class="inv-ayuda-ejemplo inv-ayuda-ejemplo-ok"><strong>✓ Correcto:</strong> ${escapeHtml(d.ejemplo_valido)}</p>
        <p class="inv-ayuda-ejemplo inv-ayuda-ejemplo-mal"><strong>✗ Común:</strong> ${escapeHtml(d.ejemplo_invalido_comun)}</p>
        ${d.sinonimos && d.sinonimos.length > 0 ? `<p class="inv-ayuda-tarjeta-sinonimos">En tu archivo de importación, estas columnas se reconocen solas: ${escapeHtml(d.sinonimos.join(', '))}…</p>` : ''}
      </article>`;
  }

  // Aplica el hover corto (explicacion_simple) a cualquier ícono
  // .campo-ayuda[data-campo] dentro de `raiz` — usado tanto por el
  // wizard de importación (entrada 2, §56.2.2) como por el formulario
  // "Crear producto" (entrada 3, §56.2.3). El click de ambos abre la
  // ayuda completa en esa ancla (delegado por separado en cada
  // contenedor, ver "Enlaces de eventos").
  async function aplicarTooltipsCampoAyuda(raiz) {
    const diccionario = await obtenerDiccionarioInv();
    raiz.querySelectorAll('.campo-ayuda[data-campo]').forEach((btn) => {
      const entrada = diccionario.find((d) => d.id === btn.dataset.campo);
      if (entrada) btn.setAttribute('data-tooltip', entrada.explicacion_simple);
    });
  }

  async function renderAyudaInventario() {
    const diccionario = await obtenerDiccionarioInv();
    const html = INV_AYUDA_GRUPOS.map((g) => {
      const items = diccionario.filter((d) => d.grupo === g.grupo);
      if (items.length === 0) return '';
      return `
        <h3 class="inv-ayuda-grupo-titulo" id="inv-ayuda-grupo-${g.grupo}">${escapeHtml(g.titulo)}</h3>
        ${items.map(renderTarjetaAyuda).join('')}`;
    }).join('');
    els.invAyudaContenido.innerHTML = html || '<p class="inv-ayuda-empty">No se pudo cargar el diccionario.</p>';
    els.invAyudaResultadosTexto.textContent = '';
  }

  function filtrarAyudaInventario(termino) {
    const normalizado = termino.trim().toLowerCase();
    const tarjetas = els.invAyudaContenido.querySelectorAll('.inv-ayuda-tarjeta');
    let visibles = 0;
    tarjetas.forEach((tarjeta) => {
      const coincide = !normalizado || tarjeta.dataset.buscable.includes(normalizado);
      tarjeta.hidden = !coincide;
      if (coincide) visibles += 1;
    });
    // Un grupo sin ninguna tarjeta visible también se oculta, para no
    // dejar un título de grupo huérfano en los resultados de búsqueda.
    els.invAyudaContenido.querySelectorAll('.inv-ayuda-grupo-titulo').forEach((titulo) => {
      let siguiente = titulo.nextElementSibling;
      let algunaVisible = false;
      while (siguiente && !siguiente.classList.contains('inv-ayuda-grupo-titulo')) {
        if (!siguiente.hidden) algunaVisible = true;
        siguiente = siguiente.nextElementSibling;
      }
      titulo.hidden = !algunaVisible;
    });
    if (!normalizado) {
      els.invAyudaResultadosTexto.textContent = '';
    } else if (visibles === 0) {
      els.invAyudaResultadosTexto.textContent = `Sin resultados para "${termino}". Prueba con otra palabra o revisa cómo se llama el campo en el sistema.`;
    } else {
      els.invAyudaResultadosTexto.textContent = `${visibles} resultado(s) para "${termino}".`;
    }
  }

  async function abrirAyudaInventario(anclaId) {
    if (els.invAyudaContenido.innerHTML.trim() === '') {
      await renderAyudaInventario();
    }
    els.invAyudaBuscar.value = '';
    filtrarAyudaInventario('');
    els.invAyudaModalOverlay.hidden = false;
    if (anclaId) {
      setTimeout(() => {
        const tarjeta = document.getElementById(`campo-${anclaId}`);
        if (tarjeta) {
          tarjeta.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
          tarjeta.classList.add('inv-ayuda-resaltada');
          tarjeta.focus();
          setTimeout(() => tarjeta.classList.remove('inv-ayuda-resaltada'), 2000);
        }
      }, 50);
    } else {
      setTimeout(() => els.invAyudaBuscar.focus(), 30);
    }
  }

  function cerrarAyudaInventario() {
    els.invAyudaModalOverlay.hidden = true;
  }

  // Ayuda por vista (punto 191, Fase 1 UX) — mismo lenguaje visual que la
  // ayuda de Inventarios (reusa .inv-ayuda-tarjeta/-titulo/-explicacion),
  // pero con contenido fijo en el frontend: 3-5 conceptos por vista, sin
  // buscador ni backend propio — a diferencia de Inventarios, estos
  // conceptos no cambian por tenant.
  const AYUDA_VISTAS = {
    ordenes: {
      titulo: 'Ayuda — Ventas',
      items: [
        { titulo: 'No. de venta (OC-000001)', texto: 'Es el folio interno de este sistema, para que tú identifiques cada venta — no es tu folio fiscal del SAT (ese lo genera la factura, aparte).' },
        { titulo: 'Estado de pago: Pagada', texto: 'El cliente ya te pagó por completo. Es el estado por defecto de toda venta nueva.' },
        { titulo: 'Estado de pago: Pendiente', texto: 'Todavía falta que te paguen. La venta aparece en "Cuentas por cobrar" hasta que registres el cobro — y no se puede facturar mientras siga pendiente.' },
        { titulo: 'Facturar', texto: 'El ícono de documento junto al folio abre el formulario para subir la factura ya generada de esa venta.' },
        { titulo: 'Corte del día', texto: 'Genera un resumen de tus ventas en un rango de fechas, listo para imprimir — no envía nada por correo.' },
      ],
    },
    cxc: {
      titulo: 'Ayuda — Cuentas por cobrar',
      items: [
        { titulo: 'Por cobrar', texto: 'La suma de lo que todos tus clientes con ventas "Pendientes" todavía te deben.' },
        { titulo: 'Vencida', texto: 'Ya pasó la fecha de vencimiento que le pusiste a esa venta y sigue sin cobrarse.' },
        { titulo: 'Por vencer', texto: 'Todavía está a tiempo — se acerca su fecha de vencimiento pero no ha pasado.' },
        { titulo: '¿Cómo marco algo como cobrado?', texto: 'Abre la venta desde la tabla y registra el cobro (total o parcial) — el saldo se actualiza solo.' },
      ],
    },
    gastos: {
      titulo: 'Ayuda — Gastos',
      items: [
        { titulo: 'Con factura / Sin factura', texto: 'Indica si ese gasto tiene un comprobante fiscal (factura) adjunto o no — te sirve para saber qué gastos podrías deducir.' },
        { titulo: 'IVA incluido', texto: 'Marca si el monto que capturaste ya trae el IVA sumado, o si es el monto antes de impuestos.' },
        { titulo: 'Recurrente', texto: 'Gastos que se repiten cada mes (renta, luz, internet) — es solo para tu referencia, no genera el gasto automáticamente.' },
        { titulo: 'Categoría', texto: 'Cómo clasificas tus gastos, para ver después en qué se te va más el dinero — puedes crear las tuyas desde "Registrar gasto".' },
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

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Guía Gmail paso a paso (Fase 7 UX, 2026-09-04) — fuente ÚNICA reusada
  // en 2 lugares: el Centro de conocimiento (categoría "configuraciones")
  // y el toggle inline de la tarjeta SMTP. `enlace` es opcional y SIEMPRE
  // un dato fijo escrito aquí (nunca texto de usuario/tenant) — se arma
  // como <a href> directo en el render, no hay riesgo de inyección porque
  // no hay ningún dato dinámico entrando a esa URL.
  // soporte@addv.mx: canal TEMPORAL confirmado por el usuario — cuando
  // exista el canal definitivo, cambiar solo esta constante.
  const CORREO_SOPORTE_TEMPORAL = 'soporte@addv.mx';
  const GUIA_SMTP_GMAIL = [
    {
      t: 'Activa la verificación en 2 pasos',
      d: 'En la cuenta de Google que vas a usar (personal o de tu empresa) — sin esto, Google no deja crear una contraseña de aplicación.',
      enlace: { texto: 'Activar verificación en 2 pasos', url: 'https://myaccount.google.com/security' },
    },
    {
      t: 'Genera una contraseña de aplicación',
      d: 'Con la verificación ya activa, genera una — Google te da 16 caracteres. Esa es la que va en el campo "Contraseña" de este formulario, NUNCA la contraseña normal de tu cuenta.',
      enlace: { texto: 'Generar contraseña de aplicación', url: 'https://myaccount.google.com/apppasswords' },
    },
    {
      t: 'Llena estos 5 campos',
      d: 'Host: smtp.gmail.com · Puerto: 587 · Seguridad: STARTTLS · Usuario: tu correo completo · Contraseña: la de 16 caracteres del paso anterior.',
    },
    {
      t: '¿No usas Gmail?',
      d: 'Outlook, hosting propio u otro proveedor — pide host, puerto, usuario y contraseña a quien administre ese correo. Los mismos 5 campos de arriba aplican igual.',
    },
    {
      t: '¿Sigues sin poder configurarlo?',
      d: 'Escríbenos y te ayudamos a dejarlo funcionando.',
      enlace: { texto: CORREO_SOPORTE_TEMPORAL, url: `mailto:${CORREO_SOPORTE_TEMPORAL}` },
    },
  ];

  // ---------- Centro de conocimiento (Fase 6 UX) ----------
  // Manual completo de /admin — mismo shell que "Configuraciones"
  // (config-modal-sidebar/main reusados tal cual) pero con contenido propio
  // aquí, 100% frontend, cero endpoint nuevo (mismo criterio que
  // AYUDA_VISTAS). Acceso desde un ícono fijo en el sidebar, NUNCA dentro
  // de Configuraciones — el perfil "Ventas" no tiene esa vista
  // (RESTRICCIONES_PERFIL más arriba), así que un manual completo ahí
  // habría quedado inalcanzable para ese perfil.
  const CONOCIMIENTO_CATEGORIAS = {
    'primeros-pasos': {
      titulo: 'Primeros pasos',
      lead: 'Lo mínimo para dejar el panel operando el primer día.',
      pasos: [
        { t: 'Completa tus datos fiscales', d: 'Configuraciones → Configuraciones fiscales. Sin esto, tickets y facturas no se pueden generar.' },
        { t: 'Da de alta a tu equipo', d: 'Usuarios → Crear usuario. Elige el perfil correcto (Administrador, Fiscal o Ventas) según lo que esa persona necesite hacer — cada perfil ve solo sus secciones.' },
        { t: 'Revisa el checklist de Inicio', d: 'Aparece solo ahí hasta que completes sus 3-4 pasos según tu perfil — te va guiando, no hace falta memorizar nada.' },
        { t: 'Vuelve aquí cuando lo necesites', d: 'Este manual queda siempre a un clic, en el ícono de libro junto a "Cerrar sesión" — en cualquier vista, con cualquier perfil.' },
        { t: 'Repite el recorrido guiado', d: 'La primera vez que entraste, un recorrido con globos señaló las partes clave del panel para tu perfil — si quieres volver a verlo, aquí mismo. Solo disponible en escritorio.', accion: 'reiniciar-tour', textoAccion: 'Ver el recorrido de nuevo' },
      ],
    },
    glosario: {
      titulo: 'Glosario',
      lead: 'Qué significa cada palabra que ves en el panel, en español simple — sin necesitar experiencia previa en contabilidad ni en manejo de inventarios.',
      pasos: [
        { t: 'Balance (ventas vs gastos)', d: 'Lo que entra menos lo que sale, de un vistazo. Ejemplo: si en el mes vendiste $50,000 y gastaste $30,000, tu balance es $20,000 a favor.' },
        { t: 'CFDI', d: 'Es el nombre técnico de una factura electrónica en México (Comprobante Fiscal Digital por Internet). Cuando "facturas" un ticket, en realidad estás generando un CFDI.' },
        { t: 'Código de barras', d: 'El número que identifica a un producto — lo puedes escanear con la cámara del celular en vez de teclearlo a mano cada vez que lo vendes o das de alta.' },
        { t: 'Constancia de Situación Fiscal (CSF)', d: 'El documento oficial del SAT que dice quién es fiscalmente tu cliente (nombre, RFC, régimen). Se sube una vez y el sistema saca esos datos solo para armar la factura.' },
        { t: 'Corte del día', d: 'Un resumen de todo lo que vendiste en un rango de fechas que tú eliges — para cuadrar caja o cerrar el turno, se puede imprimir.' },
        { t: 'Costo promedio (ponderado)', d: 'Lo que en promedio te ha costado comprar un producto, aunque lo hayas comprado a precios distintos en cada entrega. Ejemplo: compraste 10 piezas a $10 y luego 10 más a $14 — tu costo promedio ahora es $12.' },
        { t: 'Cuentas por cobrar', d: 'Ventas que ya hiciste pero el cliente todavía no te paga — quedan marcadas como "Pendiente" hasta que registras el cobro.' },
        { t: 'Días de cobertura', d: 'Con lo que tienes en existencia ahorita, para cuántos días de venta te alcanza al ritmo que vendes normalmente.' },
        { t: 'Existencia', d: 'Cuánto tienes disponible de un producto en este momento — sube cuando registras una entrada, baja cuando lo vendes.' },
        { t: 'Facturado / Sin facturar', d: 'Una venta "facturada" ya tiene su CFDI generado y el cliente puede descargarla. "Sin facturar" significa que la venta ya se hizo, pero todavía nadie pidió la factura.' },
        { t: 'Fecha de expiración', d: 'Opcional, para productos que caducan — el sistema te avisa cuando se acerca o ya pasó, pero no te impide venderlo.' },
        { t: 'Folio', d: 'El número único que identifica cada solicitud de factura (ticket) — te sirve para dar seguimiento o buscarla después.' },
        { t: 'Kardex', d: 'El historial completo de entradas, salidas y ajustes de un producto — como una libreta donde queda registrado cada movimiento, nunca se puede editar después de guardado.' },
        { t: 'RFC', d: 'Registro Federal de Contribuyentes — el identificador fiscal único de tu cliente ante el SAT, como su "número de cuenta" para efectos de impuestos.' },
        { t: 'Rotación (de inventario)', d: 'Qué tan rápido se está moviendo un producto — uno con rotación alta se vende seguido, uno con rotación baja lleva tiempo quieto en el estante.' },
        { t: 'SKU', d: 'La clave interna que tú le pones a cada producto para identificarlo — como un código de referencia propio, distinto del código de barras.' },
        { t: 'Stock mínimo', d: 'La cantidad más baja que quieres tener de un producto antes de que se te acabe — si bajas de ese número, la tarjeta "Bajo mínimo" te avisa.' },
        { t: 'Ticket', d: 'La solicitud que hace un cliente para que le generes su factura — sube su comprobante de pago y tú la conviertes en CFDI.' },
        { t: 'Utilidad neta', d: 'Lo que de verdad ganaste: tus ventas totales, menos el IVA que cobraste, menos tus gastos del mes.' },
        { t: 'Valuación del inventario', d: 'Cuánto dinero tienes invertido en todo lo que guardas — se calcula multiplicando lo que tienes de cada producto por su costo promedio, y sumando todo.' },
      ],
    },
    inicio: {
      titulo: 'Inicio',
      lead: 'Estado general de los tickets (Fiscal/Administrador) o del inventario (perfil Inventario).',
      pasos: [
        { t: 'Qué muestra (Fiscal/Administrador)', d: 'Estadísticas y una dona de tickets por estatus (pendiente, en curso, listo, cancelado) — la foto del día.' },
        { t: 'Qué muestra (perfil Inventario)', d: 'Es el mismo tablero de "Estado del inventario" que Administrador ve dentro de Reportes — para este perfil vive directo en "Inicio", ya que es su única vista de aterrizaje.' },
        { t: 'Checklist "Primeros pasos"', d: 'Se muestra solo mientras te falten pasos por completar — desaparece solo cuando terminas. Cada perfil (Fiscal, Administrador, Ventas, Inventario) tiene sus propios pasos.' },
        { t: 'Accesos rápidos (solo Fiscal)', d: 'Los botones "Ver todas" y "Gestionar" abren Tickets completo — Administrador ve la misma foto general, pero de solo lectura, sin esos 2 botones.' },
      ],
    },
    tickets: {
      titulo: 'Tickets',
      lead: 'Revisar solicitudes de factura y generar la factura final.',
      pasos: [
        { t: 'Revisar una solicitud', d: 'Ábrela desde la tabla — verás la venta ligada, la imagen del ticket y los datos que capturó el cliente.' },
        { t: 'Generar la factura', d: 'Sube el ZIP con XML+PDF ya generados en tu sistema de facturación — el cliente recibe el correo y puede descargarla desde su portal.' },
        { t: 'Monto facturado', d: 'El sistema lo lee solo del XML dentro del ZIP en cuanto lo subes — no captures nada a mano. Solo si no lo pudo leer, te pide el monto y avisa "Capturado manualmente"; si sí lo leyó, dice "Leído automáticamente del XML" y ya no se puede corregir a mano.' },
        { t: 'Pago pendiente bloquea la factura', d: 'Si la venta ligada sigue "Pendiente" de cobro (Cuentas por cobrar), no se puede facturar hasta registrar el pago.' },
        { t: 'Retención automática', d: 'Los tickets se borran solos después de los días configurados en Configuraciones — es a propósito, no es un error si uno desaparece.' },
      ],
    },
    constancias: {
      titulo: 'Constancias',
      lead: 'Registros de clientes con su Constancia de Situación Fiscal.',
      pasos: [
        { t: 'Buscar una constancia', d: 'Por RFC, nombre o correo — el buscador filtra al instante.' },
        { t: 'Verificar los datos extraídos', d: 'El sistema lee el PDF automáticamente (RFC, régimen, razón social) — revisa que coincidan antes de generar una factura con esos datos.' },
        { t: 'Reenviar invitación al portal', d: 'Si el cliente perdió su acceso, desde aquí se reenvía el correo con el enlace de nuevo.' },
      ],
    },
    ventas: {
      titulo: 'Ventas',
      lead: 'Registrar, cobrar y hacer el corte del día.',
      pasos: [
        { t: 'Registrar una venta', d: 'Botón "+ Registrar venta" → Productos → Confirmar → Entrega (correo o imprimir). El modal se limpia y se queda abierto para varias ventas seguidas.' },
        { t: 'Elegir método de pago', d: 'En el paso de Confirmar: Efectivo, Transferencia, Tarjeta de crédito o Tarjeta de débito. Con "Transferencia" se genera un folio corto (ej. "CV0001") para dárselo al cliente como "Concepto" al pagar — sale en el ticket y en el correo de confirmación, y queda visible en la columna "Pago" de la tabla con un botón para copiarlo sin abrir la venta. El método y el prefijo del folio con los que abre el modal se ajustan en Configuraciones → Ventas.' },
        { t: 'Aplicar un descuento', d: 'En el paso de Confirmar, campo opcional "Descuento" — un porcentaje sobre el subtotal, antes del IVA. Se refleja en el Total, en el ticket impreso y en el correo de confirmación.' },
        { t: 'Marcar como pendiente de cobro', d: 'En el paso de Confirmar, cambia el toggle a "Pendiente" y define fecha de vencimiento — aparecerá en Cuentas por cobrar hasta que la cobres.' },
        { t: 'Generar el corte del día', d: 'Botón "Corte del día" junto a Registrar venta → elige el rango de fechas → imprime o consulta en pantalla. Queda guardado en Reportes → pestaña Cortes.' },
        { t: 'Filtrar y buscar', d: 'Filtros de concepto, fecha, total y estado de pago arriba de la tabla — funcionan al instante, sin recargar la página.' },
        { t: 'Modo sin conexión', d: 'Si se va el internet, la venta se guarda localmente y se sincroniza sola al reconectar — la franja de arriba avisa cuándo pasa cada cosa.' },
      ],
    },
    cxc: {
      titulo: 'Cuentas por cobrar',
      lead: 'Ventas pendientes de cobro y su seguimiento.',
      pasos: [
        { t: 'Los 4 indicadores', d: 'Por cobrar (total pendiente), Vencidas (ya pasó la fecha), Por vencer (a tiempo) y Cobrado del mes.' },
        { t: 'Registrar un cobro', d: 'Abre la venta desde la tabla y captura el pago — total o parcial, el saldo se actualiza solo.' },
        { t: 'No se puede facturar mientras esté pendiente', d: 'Una venta con saldo por cobrar no se puede facturar en Tickets hasta que se registre el cobro completo.' },
      ],
    },
    gastos: {
      titulo: 'Gastos',
      lead: 'Control administrativo de los gastos de la operación.',
      pasos: [
        { t: 'Registrar un gasto', d: 'Botón "Registrar gasto" — categoría, monto, si el IVA ya está incluido, y si es recurrente (solo para tu referencia, no se genera automático).' },
        { t: 'Categorías editables', d: 'Desde el mismo modal, botón "Categorías" — renombra, crea nuevas o desactiva las que no uses. "Otro" nunca se puede borrar.' },
        { t: 'Adjuntar comprobante', d: 'PDF o ZIP opcional, se guarda junto al gasto y se puede descargar o quitar después.' },
        { t: 'Papelera', d: 'Un gasto eliminado va a la papelera — se puede restaurar o borrar en definitivo desde ahí.' },
      ],
    },
    inventarios: {
      titulo: 'Inventarios',
      lead: 'Productos, servicios y existencias — módulo opcional.',
      pasos: [
        { t: 'Actívalo primero', d: 'Configuraciones → interruptor "Inventario activo". Antes de eso, la sección permanece oculta para todos los perfiles.' },
        { t: 'Dar de alta un producto o servicio', d: 'Botón "Nuevo producto/servicio" — un servicio pide solo 10 de los 14 campos (sin stock ni código de barras) y se cobra "Por hora" o "Precio fijo (paquete de servicio)" — nunca por las demás unidades del catálogo.' },
        { t: 'Registrar entradas y salidas', d: 'Menú "⋮" de cada fila — cada movimiento queda en el historial permanente, nunca editable una vez guardado.' },
        { t: 'Importar catálogo', d: 'Botón "Importar catálogo" → sube un CSV/XLSX → el sistema detecta las columnas solo, con vista previa antes de confirmar. Solo para productos, no servicios.' },
        { t: 'Código de barras con la cámara', d: 'En Ventas o al dar de alta un producto, el ícono de cámara escanea el código y llena el campo solo.' },
        { t: 'Imprimir etiqueta de código de barras', d: 'Menú "⋮" de cada fila → "Imprimir etiqueta" — elige térmica (rollo, 40×30mm) o carta (24 por hoja), cuántas copias, y listo. Se genera solo a partir del código de barras del producto (o su SKU si no tiene uno capturado), sin necesidad de escribirlo a mano.' },
        { t: '"Solamente servicios"', d: 'Si tu negocio no maneja stock físico, actívalo en Configuraciones — oculta todo lo relacionado a productos y existencias.' },
        { t: 'Fecha de expiración', d: 'Opcional, solo para productos físicos (no aplica a servicios) — déjala vacía si no caduca. La tarjeta "Por vencer" del tablero cuenta juntos los vencidos y los que vencen dentro de 30 días; clic ahí abre la lista completa. Solo es un aviso — no bloquea vender el producto.' },
        { t: 'Perfil "Inventario"', d: 'Un perfil dedicado que solo ve "Inicio" (Estado del inventario), "Inventarios" y "Mi Cuenta" — con su propio checklist de "Primeros pasos" y recorrido guiado, igual que Fiscal/Administrador/Ventas.' },
      ],
    },
    proveedores: {
      titulo: 'Proveedores',
      lead: 'Sección en construcción.',
      pasos: [
        { t: 'Disponible próximamente', d: 'Por ahora es solo un aviso — los proveedores de un gasto se siguen capturando como texto libre dentro de Gastos.' },
      ],
    },
    reportes: {
      titulo: 'Reportes',
      lead: '"Lectura de reportes" — todo lo que se archivó o eliminó, con auditoría.',
      pasos: [
        { t: 'Las 4 pestañas', d: 'Por reporte (mensuales), Cortes (Corte del día de Ventas), Todo lo eliminado (ledger cruzado) y Estado del inventario.' },
        { t: 'Corte del día vs. cierre mensual', d: 'El corte es una consulta bajo demanda que tú generas; el cierre mensual es automático, el día 1 de cada mes, y archiva Ventas/Gastos del mes anterior.' },
        { t: 'Exportar', d: 'Cada tabla (Movimientos/Eliminados) tiene su propio botón de exportar a CSV o Excel.' },
        { t: 'Ver quién generó un reporte', d: 'Botón "Ver historial" cruza contra la auditoría del sistema — mejor esfuerzo, no siempre hay dato disponible.' },
      ],
    },
    usuarios: {
      titulo: 'Usuarios y perfiles',
      lead: 'Quién entra al panel y qué puede hacer.',
      pasos: [
        { t: 'Los 3 perfiles', d: 'Administrador (todo salvo Tickets/Constancias), Fiscal (solo Inicio/Tickets/Constancias/Configuraciones limitadas), Ventas (solo Ventas/Cuentas por cobrar/Gastos).' },
        { t: 'Crear un usuario', d: 'Botón "Crear usuario" — usuario, contraseña y perfil. El acceso es inmediato, sin correo de confirmación.' },
        { t: 'Restablecer contraseña', d: 'El propio usuario puede pedirlo desde la pantalla de login con "¿Olvidaste tu contraseña?" — llega un enlace de un solo uso, válido 30 minutos.' },
        { t: 'Suspender o reactivar una cuenta', d: 'Ícono de pausa junto a "Eliminar" — a diferencia de eliminar, no se borra nada: la cuenta simplemente no puede volver a iniciar sesión hasta que la reactives con el mismo botón (ahora en forma de check). No puedes suspender tu propia cuenta mientras la tienes iniciada.' },
        { t: 'Cuenta suspendida sigue ocupando tu cuota', d: 'Si tu plan limita cuántas cuentas de panel puedes tener, una cuenta suspendida sigue contando — para liberar el espacio de verdad hay que eliminarla.' },
      ],
    },
    'mi-cuenta': {
      titulo: 'Mi Cuenta',
      lead: 'Tus propios datos de sesión — disponible para los 4 perfiles.',
      pasos: [
        { t: 'Editar tu perfil básico', d: 'Nombre, teléfono y correo — cualquier perfil puede ver y editar los suyos, además de cambiar su propia contraseña (pide la actual antes de guardar la nueva).' },
        { t: 'Identidad de la empresa', d: 'Solo Administrador y Super ven el nombre de la empresa y cuántas cuentas de panel hay dadas de alta contra la cuota del plan.' },
        { t: 'Zona horaria', d: 'Se muestra de solo lectura aquí — para cambiarla, ve a Configuraciones → Configuraciones fiscales.' },
        { t: 'Secciones "Próximamente"', d: 'Verificación en 2 pasos, sesiones activas, notificaciones y suscripción se muestran atenuadas a propósito — todavía no existen, no son un botón roto.' },
      ],
    },
    auditoria: {
      titulo: 'Auditoría',
      lead: 'Quién entró al panel, cuándo y qué hizo — perfiles Administrador y Super.',
      pasos: [
        { t: 'Qué queda registrado', d: 'Cada acción que cambia algo (crear, editar, eliminar) queda con fecha, usuario, perfil y de dónde entró — acotado siempre a tu propia empresa, nunca ves accesos de otro tenant.' },
        { t: 'Filtrar', d: 'Por usuario o por rango de fechas, arriba de la tabla.' },
        { t: 'Ocultar esta sección', d: 'Configuraciones → tarjeta "Auditoría" → apaga el switch si no la necesitas en el menú — el registro interno sigue funcionando igual, apagarlo solo oculta la pantalla de consulta.' },
      ],
    },
    'resumen-financiero': {
      titulo: 'Resumen financiero',
      lead: 'La foto completa del mes, con gráficas — perfil Administrador.',
      pasos: [
        { t: 'Los 4 KPIs del mes', d: 'Total facturado, total gastos, balance ventas vs. gastos y ventas sin facturar.' },
        { t: '"Utilidad neta del mes"', d: 'La cifra más completa: ventas totales (con y sin facturar) menos gastos — separa el IVA cobrado antes de restar.' },
        { t: 'Gráficas y su detalle', d: 'Cada tarjeta tiene un ícono de expandir que la abre en grande, con más contexto y la leyenda como filtro clicable.' },
        { t: 'Personalizar tu tablero', d: 'Arrastra cualquier tarjeta para moverla o cambiar su ancho — se guarda automático, por usuario. Botón "Restablecer" regresa al orden original.' },
      ],
    },
    configuraciones: {
      titulo: 'Configuraciones',
      lead: 'Ajustes que cambian el comportamiento de todo el panel.',
      pasos: [
        { t: 'Las 6 secciones', d: 'Campos obligatorios, Configuraciones fiscales, SMTP, Configuración de reportes, Ventas e Inventarios — un buscador arriba filtra entre ellas.' },
        { t: 'Clave SAT con buscador', d: 'En Configuraciones fiscales, el campo "Clave de Producto o Servicio" busca por texto o número contra el catálogo real del SAT (52,513 claves) — ya no hace falta memorizar el número de 8 dígitos.' },
        { t: 'Interruptores globales', d: '"Habilitar Ventas" y "Inventario activo" — apagados, esas secciones se ocultan por completo para todos los perfiles, sin excepción.' },
        { t: 'Correo (SMTP)', d: 'De aquí sale cada correo automático de la app — confirmaciones de venta, factura lista, invitaciones. Sin configurarlo, esos correos no se envían.' },
        ...GUIA_SMTP_GMAIL,
      ],
    },
  };

  // Compartido entre el Centro de conocimiento y el toggle inline de la
  // tarjeta SMTP (`renderGuiaSmtpGmail`, ver más abajo) — un solo lugar
  // que arma el HTML de un "paso" numerado con su línea conectora, con
  // resaltado de búsqueda opcional y enlace opcional. `p.enlace.url`
  // SIEMPRE viene de una constante fija del propio código (nunca de
  // input del usuario/tenant), así que interpolarla es seguro.
  function renderPasoTarjeta(p, i, termino, reducido) {
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
    const enlaceHtml = p.enlace
      ? `<a href="${p.enlace.url}" target="_blank" rel="noopener">${escapeHtml(p.enlace.texto)} ↗</a>`
      : '';
    // `accion` es un botón real (no un link) — dispara una función de JS
    // por `data-accion`, resuelta por delegación de eventos (ver el
    // listener de `els.conocimientoMainBody` más abajo). Nunca un
    // `onclick` inline, para no reabrir la necesidad de 'unsafe-inline'
    // en script-src que la CSP del punto 197 cerró a propósito.
    const accionHtml = p.accion
      ? `<button type="button" class="conocimiento-paso-boton" data-accion="${escapeHtml(p.accion)}">${escapeHtml(p.textoAccion || 'Repetir')}</button>`
      : '';
    return `
      <div class="conocimiento-paso" style="transition-delay:${reducido ? 0 : i * 55}ms">
        <div class="conocimiento-paso-rail"><div class="conocimiento-paso-num">${i + 1}</div><div class="conocimiento-paso-linea"></div></div>
        <div class="conocimiento-paso-tarjeta${esMatch ? ' is-match' : ''}"><b>${t}</b><p>${d}</p>${enlaceHtml}${accionHtml}</div>
      </div>`;
  }

  function renderCategoriaConocimiento(catKey, termino) {
    const datos = CONOCIMIENTO_CATEGORIAS[catKey];
    if (!datos || !els.conocimientoMainBody) return;
    const reducido = prefersReducedMotion();
    let html = `<h3 class="conocimiento-cat-titulo">${escapeHtml(datos.titulo)}</h3><p class="conocimiento-cat-lead">${escapeHtml(datos.lead)}</p>`;
    datos.pasos.forEach((p, i) => {
      html += renderPasoTarjeta(p, i, termino, reducido);
    });
    els.conocimientoMainBody.innerHTML = html;
    els.conocimientoTitle.textContent = datos.titulo;
    els.conocimientoMainBody.scrollTop = 0;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        els.conocimientoMainBody.querySelectorAll('.conocimiento-paso').forEach((el) => el.classList.add('is-in'));
      });
    });
  }

  let conocimientoCatActual = 'primeros-pasos';

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

  // `enfocarBuscador` (atajo de la barra de sesión, ver
  // #btn-abrir-conocimiento-topbar): deja el cursor listo en el buscador
  // del modal — un clic para llegar, cero clics extra para empezar a
  // buscar. El botón del menú lateral no lo pide (abre siempre en
  // "Primeros pasos", como antes).
  function abrirConocimiento(enfocarBuscador) {
    els.conocimientoBuscar.value = '';
    els.conocimientoNav.querySelectorAll('.conocimiento-nav-item').forEach((btn) => { btn.hidden = false; });
    els.conocimientoNavEmpty.hidden = true;
    seleccionarCategoriaConocimiento('primeros-pasos');
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

  // Botones de acción dentro de un "paso" del Centro de conocimiento
  // (`p.accion`, ver renderPasoTarjeta) — delegado en el contenedor en
  // vez de re-atar un listener cada vez que se renderiza una categoría.
  // `reiniciarTourBienvenidaManual` está definida más abajo en este
  // archivo (function declaration, hoisted — se puede referenciar aquí).
  const ACCIONES_CONOCIMIENTO = {
    'reiniciar-tour': () => reiniciarTourBienvenidaManual(),
  };
  if (els.conocimientoMainBody) {
    els.conocimientoMainBody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-accion]');
      if (!btn) return;
      const accion = ACCIONES_CONOCIMIENTO[btn.dataset.accion];
      if (accion) accion();
    });
  }

  // ---------- Primeros pasos + recorrido de bienvenida (Fase 2 UX, punto 191) ----------
  // Todo 100% frontend, cero endpoint nuevo: los pasos se derivan de datos que
  // el panel ya carga (datosFiscalesCompletos, ordenesCache,
  // inventarioActivoGlobalmente) más banderas de eventos ("ya creaste tu
  // primer X") guardadas en localStorage — nunca se pide nada extra al
  // backend solo para pintar esta tarjeta. "Por cuenta" (no por sesión):
  // la clave incluye el tenant y el usuario, así que ocultar/terminar el
  // tour no vuelve a molestar aunque cierre e inicie sesión de nuevo, y no
  // se mezcla entre dos cuentas "admin" de tenants distintos.
  function claveOnboarding() {
    return `onboarding_v1_${TENANT_SLUG || 'base'}_${usuarioSesionActual || ''}`;
  }
  function leerEstadoOnboarding() {
    try {
      const raw = localStorage.getItem(claveOnboarding());
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }
  function guardarEstadoOnboarding(parcial) {
    try {
      const actual = leerEstadoOnboarding();
      localStorage.setItem(claveOnboarding(), JSON.stringify({ ...actual, ...parcial }));
    } catch (err) {
      // localStorage lleno o bloqueado: la tarjeta se sigue mostrando, sin
      // recordar el "Ocultar" — no es crítico para poder usar el panel.
    }
  }
  function marcarOnboardingVisto(clave) {
    const estado = leerEstadoOnboarding();
    const vistos = estado.vistos || {};
    if (vistos[clave]) return;
    guardarEstadoOnboarding({ vistos: { ...vistos, [clave]: true } });
  }

  function definirPasosOnboarding() {
    const estado = leerEstadoOnboarding();
    const vistos = estado.vistos || {};
    const ventaHecha = ordenesCache.length > 0 || !!estado.ventaCreada;
    const mapa = {
      fiscal: [
        { texto: 'Completa tus datos fiscales', vista: 'configuraciones', hecho: datosFiscalesCompletos === true },
        { texto: 'Revisa tu primer ticket', vista: 'tickets', hecho: !!vistos.tickets },
        { texto: 'Consulta el catálogo de Constancias', vista: 'constancias', hecho: !!vistos.constancias },
      ],
      administrador: [
        { texto: 'Completa tus datos fiscales', vista: 'configuraciones', hecho: datosFiscalesCompletos === true },
        { texto: 'Registra tu primera venta', vista: 'ordenes', hecho: ventaHecha },
        { texto: 'Invita a tu primer usuario', vista: 'usuarios', hecho: !!estado.usuarioCreado },
        { texto: 'Activa Inventarios si vendes producto físico', vista: 'configuraciones', hecho: inventarioActivoGlobalmente === true, opcional: true },
      ],
      ventas: [
        { texto: 'Registra tu primera venta', vista: 'ordenes', hecho: ventaHecha },
        { texto: 'Revisa Cuentas por cobrar', vista: 'cxc', hecho: !!vistos.cxc },
        { texto: 'Registra tu primer gasto', vista: 'gastos', hecho: !!estado.gastoCreado },
      ],
      // punto 321/recorrido inventario: "hecho" del paso 1 se lee de
      // estadoInventarioCache (la misma respuesta que ya carga su propio
      // "Inicio" — ver cargarInicioInventario()/cargarEstadoInventario()),
      // nunca de la tabla de Inventarios (esa vista puede no haberse
      // visitado todavía). El paso 2 depende de la bandera de evento
      // `entradaInventarioRegistrada` (guardarMovimientoInventario()).
      inventario: [
        {
          texto: 'Da de alta tu primer producto o servicio',
          vista: 'inventarios',
          hecho:
            (estadoInventarioCache && Array.isArray(estadoInventarioCache.valuacion_detalle) && estadoInventarioCache.valuacion_detalle.length > 0) ||
            !!(estadoInventarioCache && estadoInventarioCache.servicios && Number(estadoInventarioCache.servicios.kpis && estadoInventarioCache.servicios.kpis.total_servicios) > 0),
        },
        { texto: 'Registra tu primera entrada de inventario', vista: 'inventarios', hecho: !!estado.entradaInventarioRegistrada },
        { texto: 'Revisa tu perfil en Mi Cuenta', vista: 'mi-cuenta', hecho: !!vistos['mi-cuenta'] },
      ],
    };
    return mapa[perfilActual] || null;
  }

  function contenedorOnboarding() {
    if (perfilActual === 'fiscal') return els.vistaInicio;
    if (perfilActual === 'administrador') return els.vistaResumenFinanciero;
    if (perfilActual === 'ventas') return els.vistaOrdenes;
    if (perfilActual === 'inventario') return els.vistaInicio; // su "Inicio" reusa el mismo nodo (cargarInicioInventario())
    return null; // "super": sin checklist propio, es una cuenta de operación/depuración
  }

  function renderOnboardingChecklist() {
    const contenedor = contenedorOnboarding();
    let tarjeta = document.getElementById('onboarding-checklist-card');
    if (!contenedor) {
      if (tarjeta) tarjeta.hidden = true;
      return;
    }
    const pasos = definirPasosOnboarding();
    const estado = leerEstadoOnboarding();
    const pasosObligatorios = pasos ? pasos.filter((p) => !p.opcional) : [];
    const todoListo = pasosObligatorios.length > 0 && pasosObligatorios.every((p) => p.hecho);
    const debeMostrarse = !!pasos && !estado.checklistOculto && !todoListo;

    if (!debeMostrarse) {
      if (tarjeta) tarjeta.hidden = true;
      iniciarTourBienvenidaSiAplica();
      return;
    }

    // Si otra cuenta con OTRO perfil inició sesión en esta misma pestaña
    // (encontrado probando en navegador real: admin → logout → fiscal), la
    // tarjeta puede seguir viviendo dentro del contenedor de la sesión
    // anterior, ahora oculto — se reubica en el contenedor correcto.
    if (tarjeta && tarjeta.parentElement !== contenedor) {
      contenedor.insertBefore(tarjeta, contenedor.firstChild);
    }

    const completados = pasos.filter((p) => p.hecho).length;
    const porcentaje = Math.round((completados / pasos.length) * 100);
    const contenidoHtml = `
      <div class="onboarding-checklist-head">
        <span class="onboarding-checklist-titulo">Primeros pasos</span>
        <button type="button" class="onboarding-checklist-ocultar" id="btn-onboarding-ocultar">Ocultar</button>
      </div>
      <p class="onboarding-checklist-sub">${completados} de ${pasos.length} completados</p>
      <div class="onboarding-checklist-progreso"><i style="width:${porcentaje}%"></i></div>
      ${pasos
        .map(
          (p) => `
        <div class="onboarding-paso">
          <span class="onboarding-paso-dot${p.hecho ? ' is-done' : ''}" aria-hidden="true">${p.hecho ? '✓' : ''}</span>
          <div class="onboarding-paso-body">
            <span class="onboarding-paso-titulo${p.hecho ? ' is-done' : ''}">${escapeHtml(p.texto)}</span>
            ${p.hecho ? '' : `<button type="button" class="onboarding-paso-link" data-onboarding-ir="${p.vista}">Ir →</button>`}
          </div>
        </div>`
        )
        .join('')}
    `;

    if (!tarjeta) {
      tarjeta = document.createElement('div');
      tarjeta.id = 'onboarding-checklist-card';
      tarjeta.className = 'onboarding-checklist';
      contenedor.insertBefore(tarjeta, contenedor.firstChild);
      tarjeta.addEventListener('click', (e) => {
        if (e.target.id === 'btn-onboarding-ocultar') {
          guardarEstadoOnboarding({ checklistOculto: true });
          renderOnboardingChecklist();
          return;
        }
        const irVista = e.target.closest('[data-onboarding-ir]');
        if (irVista) cambiarVistaPrincipal(irVista.dataset.onboardingIr);
      });
    }
    tarjeta.hidden = false;
    tarjeta.innerHTML = contenidoHtml;
    iniciarTourBienvenidaSiAplica();
  }

  // ---------- Recorrido de bienvenida: spotlight sobre elementos reales ----------
  // El paso "Ayuda a la mano" es el mismo texto/selector en los 3
  // perfiles (punto 210: el ícono es idéntico y visible para los 4
  // perfiles, sin distinción) — evita repetirlo 3 veces a mano.
  const TOUR_PASO_AYUDA = {
    selector: '#btn-abrir-conocimiento-topbar',
    titulo: 'Ayuda a la mano',
    desc: 'Este ícono abre el Centro de conocimiento — el manual completo del panel, con buscador. Siempre está aquí, sin importar en qué sección estés.',
  };
  const ONBOARDING_TOUR_PASOS = {
    fiscal: [
      { selector: '.admin-sidebar-nav', titulo: 'Aquí navegas todo el panel', desc: 'Cada botón te lleva a una sección — Constancias, Tickets, y más según tu perfil.' },
      { selector: '#btn-vista-tickets', titulo: 'Tickets de facturación', desc: 'Aquí llegan las solicitudes de tus clientes para generarles su factura.' },
      { selector: '#onboarding-checklist-card', titulo: 'Tus primeros pasos', desc: 'Esta tarjeta te va guiando — se oculta sola cuando terminas.' },
      TOUR_PASO_AYUDA,
    ],
    administrador: [
      { selector: '.admin-sidebar-nav', titulo: 'Aquí navegas todo el panel', desc: 'Cada botón te lleva a una sección — Ventas, Cuentas por cobrar, Gastos, y más.' },
      { selector: '#btn-vista-ordenes', titulo: 'Registra tus ventas aquí', desc: 'Desde "Ventas" registras cada venta y controlas si ya se facturó.' },
      { selector: '#onboarding-checklist-card', titulo: 'Tus primeros pasos', desc: 'Esta tarjeta te va guiando — se oculta sola cuando terminas.' },
      TOUR_PASO_AYUDA,
    ],
    ventas: [
      { selector: '.admin-sidebar-nav', titulo: 'Tus 3 secciones', desc: 'Ventas, Cuentas por cobrar y Gastos — todo lo que necesitas para tu día a día.' },
      { selector: '#btn-abrir-orden-modal', titulo: 'Registra una venta nueva', desc: 'Este botón abre el formulario para capturar cada venta.' },
      { selector: '#onboarding-checklist-card', titulo: 'Tus primeros pasos', desc: 'Esta tarjeta te va guiando — se oculta sola cuando terminas.' },
      TOUR_PASO_AYUDA,
    ],
    inventario: [
      { selector: '.admin-sidebar-nav', titulo: 'Tus 2 secciones', desc: 'Inicio con el estado de tu catálogo, e Inventarios para dar de alta y mover producto.' },
      { selector: '#btn-vista-inventarios', titulo: 'Tu catálogo de productos y servicios', desc: 'Aquí das de alta, registras entradas/salidas y consultas existencias.' },
      { selector: '#onboarding-checklist-card', titulo: 'Tus primeros pasos', desc: 'Esta tarjeta te va guiando — se oculta sola cuando terminas.' },
      TOUR_PASO_AYUDA,
    ],
  };

  let tourDisparadoEnEstaSesion = false;
  let tourPasosActuales = [];
  let tourIndiceActual = 0;

  // Construye la lista real de pasos del tour para el perfil actual
  // (filtra selectores que no existan/estén ocultos en este momento) y
  // los muestra — compartido entre el disparo automático (una vez en la
  // vida de la cuenta) y el botón manual "Ver el recorrido de nuevo" del
  // Centro de conocimiento (Fase 7 UX, 2026-09-04).
  function construirYMostrarTour() {
    const pasos = ONBOARDING_TOUR_PASOS[perfilActual]
      .map((p) => ({ ...p, el: document.querySelector(p.selector) }))
      .filter((p) => p.el && !p.el.hidden && p.el.offsetParent !== null);
    if (pasos.length === 0) return false;
    mostrarPasoTour(pasos, 0);
    return true;
  }

  function iniciarTourBienvenidaSiAplica() {
    if (tourDisparadoEnEstaSesion) return;
    if (!perfilActual || !ONBOARDING_TOUR_PASOS[perfilActual]) return;
    // Solo escritorio: en móvil no existe .admin-sidebar-nav (reemplazada
    // por el launcher de íconos, punto 127) y el globo no cabría bien.
    if (window.matchMedia && !window.matchMedia('(min-width: 900px)').matches) return;
    const estado = leerEstadoOnboarding();
    if (estado.tourVisto) return;
    tourDisparadoEnEstaSesion = true;
    // Se marca ANTES de mostrar el primer frame: "una sola vez en la vida
    // de la cuenta", con o sin terminarlo — un reload a medio tour no debe
    // volver a dispararlo.
    guardarEstadoOnboarding({ tourVisto: true });
    construirYMostrarTour();
  }

  // Disparo manual desde el Centro de conocimiento — a diferencia del
  // automático, ignora a propósito "ya visto" (es justo el botón para
  // volver a verlo) pero conserva la misma restricción de escritorio: el
  // spotlight no tiene sentido sobre el launcher de íconos móvil.
  function reiniciarTourBienvenidaManual() {
    if (!perfilActual || !ONBOARDING_TOUR_PASOS[perfilActual]) {
      showToast('El recorrido guiado no está disponible para tu perfil.', true);
      return;
    }
    if (window.matchMedia && !window.matchMedia('(min-width: 900px)').matches) {
      showToast('El recorrido guiado solo está disponible en escritorio.', true);
      return;
    }
    cerrarConocimiento();
    tourDisparadoEnEstaSesion = true;
    const mostrado = construirYMostrarTour();
    if (!mostrado) showToast('No se pudo mostrar el recorrido — vuelve a intentarlo desde Inicio.', true);
  }

  function mostrarPasoTour(pasos, indice) {
    tourPasosActuales = pasos;
    tourIndiceActual = indice;
    const paso = pasos[indice];
    const rect = paso.el.getBoundingClientRect();

    els.onboardingTourHueco.style.left = `${rect.left - 6}px`;
    els.onboardingTourHueco.style.top = `${rect.top - 6}px`;
    els.onboardingTourHueco.style.width = `${rect.width + 12}px`;
    els.onboardingTourHueco.style.height = `${rect.height + 12}px`;

    const globo = els.onboardingTourGlobo;
    const anchoGlobo = 300;
    const altoGloboEstimado = 170;
    // Objetivos altos (ej. el sidebar completo, .admin-sidebar-nav) no
    // tienen un "arriba/abajo" sensato — el globo se pondría fuera de
    // pantalla (encontrado probando en navegador real). Para esos se
    // coloca al lado en vez de arriba/abajo.
    const cabeALaDerecha = rect.right + 12 + anchoGlobo <= window.innerWidth;
    if (rect.height > 120 && cabeALaDerecha) {
      globo.style.left = `${rect.right + 12}px`;
      globo.style.top = `${Math.min(Math.max(12, rect.top), window.innerHeight - altoGloboEstimado - 12)}px`;
      globo.style.transform = 'none';
    } else {
      const espacioDebajo = window.innerHeight - rect.bottom;
      const vaArriba = espacioDebajo < 220 && rect.top > 220;
      globo.style.top = vaArriba ? `${Math.max(12, rect.top - 12)}px` : `${rect.bottom + 12}px`;
      globo.style.transform = vaArriba ? 'translateY(-100%)' : 'none';
      globo.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - anchoGlobo - 12)}px`;
    }

    els.onboardingTourContador.textContent = `Paso ${indice + 1} de ${pasos.length}`;
    els.onboardingTourTitulo.textContent = paso.titulo;
    els.onboardingTourDesc.textContent = paso.desc;
    els.btnOnboardingTourSiguiente.textContent = indice === pasos.length - 1 ? 'Entendido' : 'Siguiente →';

    els.onboardingTourOverlay.hidden = false;
    paso.el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function cerrarTourBienvenida() {
    els.onboardingTourOverlay.hidden = true;
  }

  els.btnOnboardingTourSaltar.addEventListener('click', cerrarTourBienvenida);
  els.btnOnboardingTourSiguiente.addEventListener('click', () => {
    if (tourIndiceActual >= tourPasosActuales.length - 1) {
      cerrarTourBienvenida();
      return;
    }
    mostrarPasoTour(tourPasosActuales, tourIndiceActual + 1);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.onboardingTourOverlay.hidden) cerrarTourBienvenida();
  });

  // ---------- Enlaces de eventos ----------

  if (els.btnVerInvActivos) els.btnVerInvActivos.addEventListener('click', () => cambiarVistaInventarios('activos'));
  if (els.btnVerInvPapelera) els.btnVerInvPapelera.addEventListener('click', () => cambiarVistaInventarios('papelera'));
  if (els.btnVerInvServicios) els.btnVerInvServicios.addEventListener('click', () => cambiarVistaInventarios('servicios'));
  if (els.btnInvServiciosAdministrar) els.btnInvServiciosAdministrar.addEventListener('click', () => cambiarVistaInventarios('servicios'));
  if (els.btnInvChipTodos) els.btnInvChipTodos.addEventListener('click', () => activarChipStockInv(''));
  if (els.btnInvChipBajoMinimo) els.btnInvChipBajoMinimo.addEventListener('click', () => activarChipStockInv('bajo_minimo'));
  if (els.btnInvChipSinExistencia) els.btnInvChipSinExistencia.addEventListener('click', () => activarChipStockInv('sin_existencia'));
  if (els.btnInvChipOptimo) els.btnInvChipOptimo.addEventListener('click', () => activarChipStockInv('optimo'));
  // Tarjetas KPI clicables (mismo patrón que "Por vencer"): filtran la
  // tabla con el chip real equivalente y la traen a la vista.
  if (els.invKpiBajoMinimoCard) {
    els.invKpiBajoMinimoCard.addEventListener('click', () => {
      activarChipStockInv('bajo_minimo');
      els.invTableWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  if (els.invKpiSinExistenciaCard) {
    els.invKpiSinExistenciaCard.addEventListener('click', () => {
      activarChipStockInv('sin_existencia');
      els.invTableWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  if (els.btnInvExportarKardex) els.btnInvExportarKardex.addEventListener('click', exportarKardexConsolidadoInv);
  if (els.btnRefreshInventarios)
    els.btnRefreshInventarios.addEventListener('click', () => {
      cargarInventarios();
      cargarDashboardInventario();
    });
  if (els.btnInvVerificarIntegridad) els.btnInvVerificarIntegridad.addEventListener('click', verificarIntegridadInv);
  if (els.btnNuevoProducto) els.btnNuevoProducto.addEventListener('click', () => abrirProductoModal(null));
  if (els.btnInvImportar) els.btnInvImportar.addEventListener('click', abrirImportacionModal);
  if (els.btnInvImportacionCerrar) els.btnInvImportacionCerrar.addEventListener('click', cerrarImportacionModal);
  if (els.btnInvImportCancelar) els.btnInvImportCancelar.addEventListener('click', cerrarImportacionModal);
  if (els.btnInvImportOtra) els.btnInvImportOtra.addEventListener('click', abrirImportacionModal);
  if (els.btnInvImportTerminar) els.btnInvImportTerminar.addEventListener('click', cerrarImportacionModal);
  if (els.btnInvImportSiguiente) els.btnInvImportSiguiente.addEventListener('click', manejarSiguienteImport);
  if (els.btnInvImportAtras) els.btnInvImportAtras.addEventListener('click', manejarAtrasImport);
  if (els.btnInvImportPlantillaCsv) els.btnInvImportPlantillaCsv.addEventListener('click', () => descargarPlantillaImport('csv'));
  if (els.btnInvImportPlantillaXlsx) els.btnInvImportPlantillaXlsx.addEventListener('click', () => descargarPlantillaImport('xlsx'));
  if (els.invImportHojaSelect) els.invImportHojaSelect.addEventListener('change', cambiarHojaImport);
  if (els.invImportMapeoBody) els.invImportMapeoBody.addEventListener('change', manejarCambioMapeoImport);
  if (els.invImportMapeoBody)
    els.invImportMapeoBody.addEventListener('click', (e) => {
      if (e.target.classList.contains('campo-ayuda')) {
        abrirAyudaInventario(e.target.dataset.campo);
      }
    });
  if (els.btnInvAyudaAbrir) els.btnInvAyudaAbrir.addEventListener('click', () => abrirAyudaInventario(null));
  if (els.btnInvAyudaCerrar) els.btnInvAyudaCerrar.addEventListener('click', cerrarAyudaInventario);
  if (els.btnAyudaVistaOrdenes) els.btnAyudaVistaOrdenes.addEventListener('click', () => abrirAyudaVista('ordenes'));
  if (els.btnAyudaVistaCxc) els.btnAyudaVistaCxc.addEventListener('click', () => abrirAyudaVista('cxc'));
  if (els.btnAyudaVistaGastos) els.btnAyudaVistaGastos.addEventListener('click', () => abrirAyudaVista('gastos'));
  if (els.btnAyudaVistaCerrar) els.btnAyudaVistaCerrar.addEventListener('click', cerrarAyudaVista);
  if (els.ayudaVistaModalOverlay) {
    els.ayudaVistaModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.ayudaVistaModalOverlay) cerrarAyudaVista();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.ayudaVistaModalOverlay && !els.ayudaVistaModalOverlay.hidden) cerrarAyudaVista();
  });
  // Estados vacíos "de verdad" (punto 191): el botón de la tarjeta abre
  // directo el modal de alta correspondiente, mismo mecanismo que el
  // botón "+ Registrar..." del toolbar.
  if (els.btnOrdenesEmptyRegistrar) els.btnOrdenesEmptyRegistrar.addEventListener('click', abrirOrdenRegistrarModal);
  if (els.btnCxcEmptyRegistrar) els.btnCxcEmptyRegistrar.addEventListener('click', abrirOrdenRegistrarModal);
  if (els.btnGastosEmptyRegistrar) els.btnGastosEmptyRegistrar.addEventListener('click', () => abrirGastoModal(null));
  if (els.invAyudaBuscar)
    els.invAyudaBuscar.addEventListener('input', debounce((e) => filtrarAyudaInventario(e.target.value), 200));
  if (els.invAyudaSalto)
    els.invAyudaSalto.addEventListener('change', (e) => {
      const destino = document.getElementById(e.target.value);
      if (destino) destino.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
  if (els.invImportGuardarPerfil)
    els.invImportGuardarPerfil.addEventListener('change', () => {
      els.invImportNombrePerfilField.hidden = !els.invImportGuardarPerfil.checked;
    });
  if (els.btnInvImportDescargarErrores) els.btnInvImportDescargarErrores.addEventListener('click', descargarErroresImport);
  if (els.invFiltroCategoria) els.invFiltroCategoria.addEventListener('change', () => cargarInventarios());
  if (els.invFiltroEstado) els.invFiltroEstado.addEventListener('change', () => cargarInventarios());
  if (els.invFiltroTipo) els.invFiltroTipo.addEventListener('change', () => cargarInventarios());
  if (els.invBusqueda) els.invBusqueda.addEventListener('input', debounce(() => cargarInventarios(), 350));
  if (els.btnLimpiarFiltrosInv) els.btnLimpiarFiltrosInv.addEventListener('click', limpiarFiltrosInv);

  if (els.btnInvTipoProducto) els.btnInvTipoProducto.addEventListener('click', () => setInvModalTipo('producto', true));
  if (els.btnInvTipoServicio) els.btnInvTipoServicio.addEventListener('click', () => setInvModalTipo('servicio', true));
  // [Servicio en paquete]: elegir "Por hora" vs "Precio fijo (paquete de
  // servicio)" cambia el field-hint en vivo (antes era texto fijo, solo
  // existía una opción de unidad para servicio).
  if (els.invModalUnidad) els.invModalUnidad.addEventListener('change', () => {
    if (inventarioModalTipoSeleccionado === 'servicio') actualizarHintUnidadServicio();
  });
  if (els.btnInvCategoriasToggle) els.btnInvCategoriasToggle.addEventListener('click', toggleCategoriasInvPanel);
  if (els.btnInvCategoriaAgregar) els.btnInvCategoriaAgregar.addEventListener('click', agregarCategoriaInvPanel);
  if (els.invCategoriasLista)
    els.invCategoriasLista.addEventListener('click', (ev) => {
      const btnRenombrar = ev.target.closest('.gastos-categoria-renombrar');
      const btnGuardar = ev.target.closest('.btn-categoria-guardar');
      const btnCancelar = ev.target.closest('.gastos-categoria-cancelar');
      const btnBorrar = ev.target.closest('.gastos-categoria-borrar');
      const btnReactivar = ev.target.closest('.gastos-categoria-reactivar');
      if (btnReactivar) {
        reactivarCategoriaInvPanel(Number(btnReactivar.dataset.id));
        return;
      }
      if (btnRenombrar) {
        categoriaInvEditandoId = Number(btnRenombrar.dataset.id);
        renderPanelCategoriasInventario();
        const input = els.invCategoriasLista.querySelector('.gastos-categoria-input-editar');
        if (input) {
          input.focus();
          input.select();
        }
        return;
      }
      if (btnCancelar) {
        categoriaInvEditandoId = null;
        renderPanelCategoriasInventario();
        return;
      }
      if (btnGuardar) {
        const id = Number(btnGuardar.dataset.id);
        const input = els.invCategoriasLista.querySelector('.gastos-categoria-input-editar');
        const nombre = input ? input.value.trim() : '';
        if (!nombre) {
          showToast('El nombre de la categoría es obligatorio.', true);
          return;
        }
        renombrarCategoriaInvPanel(id, nombre);
        return;
      }
      if (btnBorrar) {
        const id = Number(btnBorrar.dataset.id);
        const cat = categoriasInventarioActuales.find((c) => c.id === id);
        confirmarEliminarCategoriaInv(id, cat ? cat.nombre : 'esta categoría');
      }
    });

  // Punto 159 (Segmento A): llena el campo igual que si se hubiera
  // tecleado o venido de un lector físico — el input sigue siendo la
  // única fuente de verdad al guardar.
  if (els.btnInvModalEscanear && window.ScannerCodigoBarras) {
    els.btnInvModalEscanear.addEventListener('click', () => {
      window.ScannerCodigoBarras.abrir({
        onDetectado: (valor) => { els.invModalCodigoBarras.value = valor; },
      });
    });
  }

  if (els.btnInvProductoModalCerrar) els.btnInvProductoModalCerrar.addEventListener('click', cerrarProductoModal);
  if (els.btnInvModalCancelar) els.btnInvModalCancelar.addEventListener('click', cerrarProductoModal);
  if (els.invProductoModalOverlay)
    els.invProductoModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.invProductoModalOverlay) cerrarProductoModal();
      if (e.target.classList.contains('campo-ayuda')) abrirAyudaInventario(e.target.dataset.campo);
    });
  if (els.btnInvModalGuardar) els.btnInvModalGuardar.addEventListener('click', guardarProductoInv);

  if (els.btnInvMovEntrada) els.btnInvMovEntrada.addEventListener('click', () => setMovimientoDireccion('entrada'));
  if (els.btnInvMovSalida) els.btnInvMovSalida.addEventListener('click', () => setMovimientoDireccion('salida'));
  if (els.btnInvMovCancelar) els.btnInvMovCancelar.addEventListener('click', cerrarMovimientoModal);
  if (els.invMovimientoModalOverlay)
    els.invMovimientoModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.invMovimientoModalOverlay) cerrarMovimientoModal();
      if (e.target.classList.contains('campo-ayuda')) abrirAyudaInventario(e.target.dataset.campo);
    });
  if (els.btnInvMovGuardar) els.btnInvMovGuardar.addEventListener('click', guardarMovimientoInv);
  if (els.invMovCostoOriginal) els.invMovCostoOriginal.addEventListener('input', actualizarPreviewCostoUsdMovimiento);
  if (els.invMovTipoCambio) els.invMovTipoCambio.addEventListener('input', actualizarPreviewCostoUsdMovimiento);

  if (els.btnInvKardexCerrar) els.btnInvKardexCerrar.addEventListener('click', cerrarKardexModal);
  if (els.invKardexModalOverlay)
    els.invKardexModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.invKardexModalOverlay) cerrarKardexModal();
    });

  if (els.invKpiPorVencerCard) els.invKpiPorVencerCard.addEventListener('click', abrirPorVencerModal);
  if (els.btnInvPorVencerCerrar) els.btnInvPorVencerCerrar.addEventListener('click', cerrarPorVencerModal);
  if (els.invPorVencerModalOverlay)
    els.invPorVencerModalOverlay.addEventListener('click', (e) => {
      if (e.target === els.invPorVencerModalOverlay) cerrarPorVencerModal();
    });

  // Auto-formato de comas de miles, mismo componente que ya usa Gastos/Ventas.
  [
    els.invModalCosto,
    els.invModalPrecio,
    els.invModalStockMinimo,
    els.invModalStockMaximo,
    els.invModalPuntoReorden,
    els.invMovCantidad,
    els.invMovCosto,
  ].forEach((input) => {
    if (input) formatearCampoDinero(input);
  });

  // ---------- Inicialización ----------

  (function init() {
    // CSP (auditoría 2026-09-03, hallazgo #11): movido aquí desde un
    // <script> inline en admin.html — script-src ya no necesita
    // 'unsafe-inline'.
    const authAnioEl = document.getElementById('auth-anio');
    if (authAnioEl) authAnioEl.textContent = String(new Date().getFullYear());

    const authHeader = getAuthHeader();
    if (authHeader) {
      // Esqueleto del shell en vez del login parpadeando (ver punto
      // "Esqueleto de carga" — nunca un salto brusco ni un $0.00 real
      // mientras se verifica que la sesión guardada siga siendo válida).
      els.loginScreen.hidden = true;
      if (els.shellEsqueleto) els.shellEsqueleto.hidden = false;
      // Verifica que la sesión guardada siga siendo válida.
      fetch(`${API_BASE}/admin/login`, { headers: { Authorization: authHeader } })
        .then((res) => {
          if (res.ok) {
            return res.json().then((data) => {
              if (els.shellEsqueleto) els.shellEsqueleto.hidden = true;
              showDashboard(data.usuario, data.perfil, data.funciones);
              // Punto en curso: precarga de "Constancias" en cada refresh —
              // sin Facturación activa esa vista ni siquiera es alcanzable
              // (botón oculto), así que pedirla igual solo generaba un 404
              // de fondo sin que la persona hiciera nada para provocarlo.
              if (data.perfil !== 'administrador' && planPermite('facturacionHabilitada')) {
                cargarRegistros();
              }
              // Refresh de una sesión ya activa (no un login nuevo, ese
              // caso ya fuerza "inicio" en su propio submit): restaura la
              // última vista que se traía abierta en esta pestaña, solo
              // si sigue siendo una vista permitida para este perfil —
              // aplicarRestriccionesPerfil() (dentro de showDashboard) ya
              // ocultó el botón de cualquier vista no permitida.
              const botonesPorVista = mapaNavPorVista();
              const vistaGuardada = obtenerVistaGuardada();
              const botonGuardado = vistaGuardada && botonesPorVista[vistaGuardada];
              if (botonGuardado && !botonGuardado.hidden && !botonGuardado.classList.contains('is-active')) {
                cambiarVistaPrincipal(vistaGuardada);
              } else {
                // "Inicio" es la vista activa por defecto en el HTML — si
                // se queda así (sin vista guardada, o la guardada es la
                // misma "inicio"), nunca pasa por cambiarVistaPrincipal()
                // y sus datos (cargarInicio()) nunca se piden: el refresh
                // deja el tablero en 0 hasta el primer clic de navegación.
                const vistaActivaId = Object.keys(botonesPorVista).find(
                  (v) => botonesPorVista[v] && botonesPorVista[v].classList.contains('is-active')
                );
                if (vistaActivaId === 'inicio') cargarInicio();
              }
            });
          }
          if (els.shellEsqueleto) els.shellEsqueleto.hidden = true;
          clearSession();
          showLogin();
        })
        .catch(() => {
          if (els.shellEsqueleto) els.shellEsqueleto.hidden = true;
          showLogin();
        });
    } else {
      showLogin();
    }
  })();
})();
