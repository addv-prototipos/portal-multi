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
    // Configuración de correo SMTP
    btnToggleSmtp: document.getElementById('btn-toggle-smtp'),
    smtpConfigBody: document.getElementById('smtp-config-body'),
    smtpConfigChevron: document.getElementById('smtp-config-chevron'),
    smtpEstadoBadge: document.getElementById('smtp-estado-badge'),
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
    // Plantillas de correo (punto 214)
    plantillasTabs: document.querySelectorAll('.plantillas-tab'),
    plantillaTriggerDesc: document.getElementById('plantilla-trigger-desc'),
    plantillaVars: document.getElementById('plantilla-vars'),
    plantillaTexto: document.getElementById('plantilla-texto'),
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
    // Vista Inicio / Constancias / Tickets / Ventas / Usuarios / Configuraciones globales
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
    // Modal "Configuraciones globales" (antes vista de página, ver
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
    inicioError: document.getElementById('inicio-error'),
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
    ordenesFiltroPeriodo: document.getElementById('ordenes-filtro-periodo'),
    btnLimpiarFiltrosOrdenes: document.getElementById('btn-limpiar-filtros-ordenes'),
    ordenesFiltroEmpty: document.getElementById('ordenes-filtro-empty'),
    // Modal "Corte del día" (punto 168)
    btnAbrirCorteModal: document.getElementById('btn-abrir-corte-modal'),
    corteModalOverlay: document.getElementById('corte-modal-overlay'),
    btnCerrarCorteModal: document.getElementById('btn-cerrar-corte-modal'),
    corteFiltroDesde: document.getElementById('corte-filtro-desde'),
    corteFiltroHasta: document.getElementById('corte-filtro-hasta'),
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
    ordenMiniResumen: document.getElementById('orden-mini-resumen'),
    ordenConcepto: document.getElementById('orden-concepto'),
    ordenConceptoContador: document.getElementById('orden-concepto-contador'),
    ordenCantidad: document.getElementById('orden-cantidad'),
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
    ordenEntregaCorreoWrap: document.getElementById('orden-entrega-correo-wrap'),
    ordenEntregaImprimirHint: document.getElementById('orden-entrega-imprimir-hint'),
    // Toggle "Cliente ya registrado" / "Cliente nuevo" de la venta
    btnOrdenClienteRegistrado: document.getElementById('btn-orden-cliente-registrado'),
    btnOrdenClienteNuevo: document.getElementById('btn-orden-cliente-nuevo'),
    ordenEmailRegistradoWrap: document.getElementById('orden-email-registrado-wrap'),
    ordenEmailNuevoWrap: document.getElementById('orden-email-nuevo-wrap'),
    ordenEmailNuevo: document.getElementById('orden-email-nuevo'),
    ordenErrorGeneral: document.getElementById('orden-error-general'),
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
    cxcKpiPorCobrar: document.getElementById('cxc-kpi-por-cobrar'),
    cxcKpiVencidas: document.getElementById('cxc-kpi-vencidas'),
    cxcKpiPorVencer: document.getElementById('cxc-kpi-por-vencer'),
    cxcKpiCobradoMes: document.getElementById('cxc-kpi-cobrado-mes'),
    cxcFiltroCliente: document.getElementById('cxc-filtro-cliente'),
    cxcFiltroVencimiento: document.getElementById('cxc-filtro-vencimiento'),
    btnLimpiarFiltrosCxc: document.getElementById('btn-limpiar-filtros-cxc'),
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
    resumenFinChartLeyendaFiltrable: document.getElementById('resumen-fin-chart-leyenda-filtrable'),
    resumenFinUtilidadValor: document.getElementById('resumen-fin-utilidad-valor'),
    resumenFinUtilidadBody: document.getElementById('resumen-fin-utilidad-body'),
    resumenFinUtilidadEmpty: document.getElementById('resumen-fin-utilidad-empty'),
    resumenFinBalanceSvg: document.getElementById('resumen-fin-balance-svg'),
    resumenFinBalanceEtiquetas: document.getElementById('resumen-fin-balance-etiquetas'),
    resumenFinBalanceEmpty: document.getElementById('resumen-fin-balance-empty'),
    resumenFinBalanceNota: document.getElementById('resumen-fin-balance-nota'),
    resumenFinProyeccionSvg: document.getElementById('resumen-fin-proyeccion-svg'),
    resumenFinProyeccionEtiquetas: document.getElementById('resumen-fin-proyeccion-etiquetas'),
    resumenFinProyeccionNota: document.getElementById('resumen-fin-proyeccion-nota'),
    resumenFinProyeccionEmpty: document.getElementById('resumen-fin-proyeccion-empty'),
    resumenFinDonutCategorias: document.getElementById('resumen-fin-donut-categorias'),
    resumenFinDonutCategoriasTotal: document.getElementById('resumen-fin-donut-categorias-total'),
    resumenFinDonutCategoriasLeyenda: document.getElementById('resumen-fin-donut-categorias-leyenda'),
    resumenFinDonutCategoriasEmpty: document.getElementById('resumen-fin-donut-categorias-empty'),
    resumenFinDonutFacturacion: document.getElementById('resumen-fin-donut-facturacion'),
    resumenFinDonutFacturacionTotal: document.getElementById('resumen-fin-donut-facturacion-total'),
    resumenFinDonutFacturacionLeyenda: document.getElementById('resumen-fin-donut-facturacion-leyenda'),
    resumenFinDonutFacturacionEmpty: document.getElementById('resumen-fin-donut-facturacion-empty'),
    resumenFinProveedoresLista: document.getElementById('resumen-fin-proveedores-lista'),
    resumenFinProveedoresEmpty: document.getElementById('resumen-fin-proveedores-empty'),
    resumenFinDetalleOverlay: document.getElementById('resumen-fin-detalle-overlay'),
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
    gastosError: document.getElementById('gastos-error'),
    gastosTableBody: document.getElementById('gastos-table-body'),
    gastosEmpty: document.getElementById('gastos-empty'),
    // ---------- Inventarios (segmento 3) ----------
    btnVistaInventarios: document.getElementById('btn-vista-inventarios'),
    vistaInventarios: document.getElementById('vista-inventarios'),
    btnVerInvActivos: document.getElementById('btn-ver-inv-activos'),
    btnVerInvPapelera: document.getElementById('btn-ver-inv-papelera'),
    invProductosCount: document.getElementById('inv-productos-count'),
    btnInvVerificarIntegridad: document.getElementById('btn-inv-verificar-integridad'),
    btnRefreshInventarios: document.getElementById('btn-refresh-inventarios'),
    btnNuevoProducto: document.getElementById('btn-nuevo-producto'),
    invKpiValor: document.getElementById('inv-kpi-valor'),
    invKpiActivos: document.getElementById('inv-kpi-activos'),
    invKpiServicios: document.getElementById('inv-kpi-servicios'),
    invKpiUnidades: document.getElementById('inv-kpi-unidades'),
    invKpiBajoMinimo: document.getElementById('inv-kpi-bajo-minimo'),
    invKpiSinExistencia: document.getElementById('inv-kpi-sin-existencia'),
    invKpiSinMovimiento: document.getElementById('inv-kpi-sin-movimiento'),
    invKpiMermas: document.getElementById('inv-kpi-mermas'),
    invKpiMermasCantidad: document.getElementById('inv-kpi-mermas-cantidad'),
    invFiltroCategoria: document.getElementById('inv-filtro-categoria'),
    invFiltroEstado: document.getElementById('inv-filtro-estado'),
    invFiltroTipo: document.getElementById('inv-filtro-tipo'),
    invBusqueda: document.getElementById('inv-busqueda'),
    btnLimpiarFiltrosInv: document.getElementById('btn-limpiar-filtros-inv'),
    invError: document.getElementById('inv-error'),
    invTableBody: document.getElementById('inv-table-body'),
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
    reportesCortesDetalleWrap: document.getElementById('reportes-cortes-detalle-wrap'),
    btnCortesVolverLista: document.getElementById('btn-cortes-volver-lista'),
    cortesDetalleRango: document.getElementById('cortes-detalle-rango'),
    cortesDetalleFecha: document.getElementById('cortes-detalle-fecha'),
    cortesDetalleVentas: document.getElementById('cortes-detalle-ventas'),
    cortesDetalleTotal: document.getElementById('cortes-detalle-total'),
    cortesDetalleConteo: document.getElementById('cortes-detalle-conteo'),
    reportesCortesDetalleTableBody: document.getElementById('reportes-cortes-detalle-table-body'),
    reportesCortesDetalleEmpty: document.getElementById('reportes-cortes-detalle-empty'),
    btnExportarCorteCsv: document.getElementById('btn-exportar-corte-csv'),
    btnExportarCorteExcel: document.getElementById('btn-exportar-corte-excel'),
    btnEliminarCorte: document.getElementById('btn-eliminar-corte'),
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
    ledgerFiltroTipo: document.getElementById('ledger-filtro-tipo'),
    ledgerFiltroEstatus: document.getElementById('ledger-filtro-estatus'),
    ledgerFiltroRfc: document.getElementById('ledger-filtro-rfc'),
    ledgerFiltroFechaDesde: document.getElementById('ledger-filtro-fecha-desde'),
    ledgerFiltroFechaHasta: document.getElementById('ledger-filtro-fecha-hasta'),
    btnLimpiarFiltrosLedger: document.getElementById('btn-limpiar-filtros-ledger'),
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
    // Cuenta de respaldo "admin"
    btnToggleAdminFallback: document.getElementById('btn-toggle-admin-fallback'),
    adminFallbackCard: document.getElementById('admin-fallback-card'),
    adminFallbackBody: document.getElementById('admin-fallback-body'),
    btnPerfilesAccesoAbrir: document.getElementById('btn-perfiles-acceso-abrir'),
    perfilesAccesoOverlay: document.getElementById('perfiles-acceso-overlay'),
    btnPerfilesAccesoCerrar: document.getElementById('btn-perfiles-acceso-cerrar'),
    ordenesToggleCard: document.getElementById('ordenes-toggle-card'),
    btnToggleOrdenesCard: document.getElementById('btn-toggle-ordenes-card'),
    ordenesToggleBody: document.getElementById('ordenes-toggle-body'),
    btnGenerarPasswordAdminFallback: document.getElementById('btn-generar-password-admin-fallback'),
    adminFallbackPassword: document.getElementById('admin-fallback-password'),
    btnToggleAdminFallbackPassword: document.getElementById('btn-toggle-admin-fallback-password'),
    btnCopiarAdminFallbackPassword: document.getElementById('btn-copiar-admin-fallback-password'),
    adminFallbackError: document.getElementById('admin-fallback-error'),
    btnGuardarAdminFallback: document.getElementById('btn-guardar-admin-fallback'),
    btnGuardarAdminFallbackLabel: document.getElementById('btn-guardar-admin-fallback-label'),
    // Modal de crear usuario
    crearUsuarioOverlay: document.getElementById('crear-usuario-overlay'),
    crearUsuarioPerfil: document.getElementById('crear-usuario-perfil'),
    crearUsuarioRfc: document.getElementById('crear-usuario-rfc'),
    crearUsuarioRfcLabel: document.getElementById('crear-usuario-rfc-label'),
    crearUsuarioRfcHint: document.getElementById('crear-usuario-rfc-hint'),
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

  inicializarTooltips();

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
        if (typeof aplicarMetodoEntregaOrden === 'function' && ordenMetodoEntregaImprimir) {
          aplicarMetodoEntregaOrden(false);
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
  };

  // Campos configurables como obligatorios/opcionales en el formulario público.
  const CAMPOS_CONFIGURABLES = ['tipo_persona', 'rfc', 'uso_cfdi', 'tipo_pago', 'comentarios'];
  // Columnas de la tabla que se pueden mostrar/ocultar.
  const COLUMNAS_TABLA = ['nombre', 'tipo', 'rfc', 'regimen', 'cp', 'correo', 'documento', 'actualizado'];
  const COLUMNAS_STORAGE_KEY = 'admin_columnas_visibles';
  const ANCHOS_STORAGE_KEY = 'admin_anchos_columnas';
  // Mismo mecanismo de columnas ajustables (mostrar/ocultar + redimensionar),
  // aplicado también a la tabla de "Ventas registradas" — claves de
  // localStorage separadas para no mezclar las preferencias de ambas tablas.
  const COLUMNAS_TABLA_ORDENES = ['numero', 'fecha', 'concepto', 'cantidad', 'iva', 'total', 'correo'];
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

  function setSession(username, password) {
    const encoded = btoa(unescape(encodeURIComponent(`${username}:${password}`)));
    sessionStorage.setItem(SESSION_KEY, encoded);
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

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
  // y dentro de "Configuraciones globales", a un subconjunto de
  // tarjetas — el resto ni siquiera se muestra, no solo se deshabilita.
  let perfilActual = null;
  let usuarioSesionActual = null;
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

  const RESTRICCIONES_PERFIL = {
    administrador: {
      vistasPermitidas: ['inicio', 'resumen-financiero', 'ordenes', 'cxc', 'gastos', 'inventarios', 'usuarios', 'lectura-reportes', 'proveedores', 'configuraciones'],
      tarjetasConfigPermitidas: ['global-config-card', 'reportes-config-card', 'ordenes-toggle-card', 'inv-toggle-card'],
    },
    fiscal: {
      vistasPermitidas: ['inicio', 'constancias', 'tickets', 'configuraciones'],
      tarjetasConfigPermitidas: ['admin-config-card', 'global-config-card'],
    },
    // Punto 190: perfil "Ventas" — solo Ventas/Cuentas por cobrar/Gastos,
    // sin entrar nunca a "Configuraciones globales" (cero tarjetas
    // permitidas, ni siquiera de solo lectura: el botón de esa vista
    // queda oculto por completo). El % de IVA/zona horaria que necesita
    // el formulario de "Registrar venta" se leen vía GET
    // /admin/config/global directamente (permitido en el backend para
    // este perfil), sin pasar por la UI de Configuraciones.
    ventas: {
      vistasPermitidas: ['ordenes', 'cxc', 'gastos'],
      tarjetasConfigPermitidas: [],
    },
  };

  function aplicarRestriccionesPerfil() {
    const restriccion = RESTRICCIONES_PERFIL[perfilActual];
    // Sin entrada en el mapa (perfil "super", o cualquier valor que no
    // se reconozca) equivale a "sin restricciones" — a propósito, para
    // que un perfil nuevo que se agregue en el futuro sin actualizar
    // este mapa no quede accidentalmente bloqueado de TODO el panel.
    const sinRestricciones = !restriccion;

    const navPorVista = {
      inicio: els.btnVistaInicio,
      constancias: els.btnVistaConstancias,
      tickets: els.btnVistaTickets,
      'resumen-financiero': els.btnVistaResumenFinanciero,
      ordenes: els.btnVistaOrdenes,
      cxc: els.btnVistaCxc,
      gastos: els.btnVistaGastos,
      inventarios: els.btnVistaInventarios,
      usuarios: els.btnVistaUsuarios,
      configuraciones: els.btnVistaConfiguraciones,
      'lectura-reportes': els.btnVistaLecturaReportes,
      proveedores: els.btnVistaProveedores,
    };
    Object.entries(navPorVista).forEach(([vista, boton]) => {
      const permitidaPorPerfil = sinRestricciones || restriccion.vistasPermitidas.includes(vista);
      // D8/§0.6: "Inventarios" además depende del switch por tenant —
      // igual patrón que "Ventas" con ventasHabilitadaGlobalmente, ver
      // cargarConfigInventario()/aplicarVisibilidadInventarios() más abajo.
      const permitidaPorConfig =
        (vista !== 'ordenes' || ventasHabilitadaGlobalmente) &&
        (vista !== 'inventarios' || inventarioActivoGlobalmente);
      const permitida = permitidaPorPerfil && permitidaPorConfig;
      boton.hidden = !permitida;
      // Mismo permiso, botón espejo en el launcher de íconos del menú
      // móvil (#admin-menu-movil) — un solo lugar decide quién ve qué,
      // no una segunda lista de restricciones que mantener sincronizada.
      const botonMovil = document.querySelector(`.admin-menu-movil-btn[data-vista="${vista}"]`);
      if (botonMovil) botonMovil.hidden = !permitida;
    });

    // Inicio para el perfil "administrador" (2026-09-04): ve el resumen de
    // tickets (dona/estadísticas), pero NO puede actuar sobre ellos — los
    // endpoints de gestión de tickets (aceptar, subir factura, etc.) siguen
    // siendo exclusivos de "fiscal" en el backend. "Ver todas" llevaría a
    // la vista Tickets completa, que este perfil tampoco tiene — se oculta
    // en vez de dejar un botón que no lleva a ningún lado.
    if (els.btnInicioVerTodas) els.btnInicioVerTodas.hidden = perfilActual === 'administrador';

    // Las 6 tarjetas de "Configuraciones globales" ("Ventas" e
    // "Inventarios" se movieron aquí desde "Usuarios").
    ['admin-config-card', 'global-config-card', 'smtp-config-card', 'reportes-config-card', 'ordenes-toggle-card', 'inv-toggle-card'].forEach((idTarjeta) => {
      const tarjeta = document.getElementById(idTarjeta);
      if (!tarjeta) return;
      tarjeta.hidden = !(sinRestricciones || (restriccion.tarjetasConfigPermitidas || []).includes(idTarjeta));
    });

    // "Cuenta de respaldo admin" y la tabla de perfiles y roles: solo
    // para el usuario "admin" EXACTO — ni siquiera para otras cuentas
    // "super" que hayan entrado por ADMIN_USERS con otro nombre. Ambas
    // viven dentro de la vista "Usuarios".
    const esUsuarioAdminExacto = usuarioSesionActual === 'admin';
    if (els.adminFallbackCard) els.adminFallbackCard.hidden = !esUsuarioAdminExacto;
    if (els.btnPerfilesAccesoAbrir) els.btnPerfilesAccesoAbrir.hidden = !esUsuarioAdminExacto;

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

  function showDashboard(username, perfil) {
    usuarioSesionActual = username;
    perfilActual = perfil;
    els.loginScreen.hidden = true;
    els.dashboard.hidden = false;
    els.adminUserLabel.textContent = `Sesión: ${username}`;
    aplicarRestriccionesPerfil();
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
    const puedeVerAreaFiscal = perfilActual !== 'administrador';
    cargarConfigGlobal({ verificarFiscalFaltante: true });
    if (puedeVerAreaFiscal) {
      cargarConfigCampos();
      cargarInfoUsoCfdi();
      revisarTicketsPendientesSinContador();
    }
    // D7: fiscal no tiene NINGÚN acceso a Inventarios — evita pedirle al
    // backend algo que le respondería 403 de fondo sin que la persona
    // hiciera nada para provocarlo (mismo criterio que puedeVerAreaFiscal
    // arriba, pero en sentido inverso).
    if (perfilActual !== 'fiscal') cargarConfigInventario();
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
        els.loginError.textContent = 'No se pudo iniciar sesión. Intenta de nuevo.';
        return;
      }

      const data = await res.json();
      setSession(usuario, contrasena);
      // Login nuevo: siempre "Inicio", sin importar qué vista haya quedado
      // guardada de una sesión anterior en esta misma pestaña — la
      // restauración de vista (ver init()) es solo para refrescar una
      // sesión que ya estaba activa, no para un login recién hecho.
      guardarVistaActual('inicio');
      showDashboard(data.usuario || usuario, data.perfil);
      // "Inicio" (la vista que se ve por defecto al iniciar sesión) usa
      // datos de tickets, que un perfil "administrador" no tiene
      // permitido ver. aplicarRestriccionesPerfil() (dentro de
      // showDashboard) ya redirige a ese perfil a una vista que sí
      // puede ver, así que tampoco haría falta el dato de Inicio.
      if (data.perfil !== 'administrador') {
        await cargarInicio();
      }
    } catch (err) {
      els.loginError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setLoginLoading(false);
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
    els.btnToggleSmtp.setAttribute('aria-expanded', 'false');
    els.smtpConfigBody.hidden = true;
    els.smtpConfigError.textContent = '';
    els.smtpPruebaError.textContent = '';
    els.btnToggleRetencion.setAttribute('aria-expanded', 'false');
    els.retencionConfigBody.hidden = true;
    els.retencionError.textContent = '';
    els.notifTicketsOverlay.hidden = true;
    els.btnToggleAdminFallback.setAttribute('aria-expanded', 'false');
    els.adminFallbackBody.hidden = true;
    els.adminFallbackError.textContent = '';
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

  function abrirCorteModal() {
    els.corteError.textContent = '';
    els.corteResultado.hidden = true;
    els.corteResultadoEmpty.hidden = true;
    corteUltimoResultado = null;
    const hoy = new Date().toISOString().slice(0, 10);
    if (!els.corteFiltroDesde.value) els.corteFiltroDesde.value = hoy;
    if (!els.corteFiltroHasta.value) els.corteFiltroHasta.value = hoy;
    els.corteModalOverlay.hidden = false;
  }
  function cerrarCorteModal() {
    els.corteModalOverlay.hidden = true;
  }
  els.btnAbrirCorteModal.addEventListener('click', abrirCorteModal);
  els.btnCerrarCorteModal.addEventListener('click', cerrarCorteModal);
  els.corteModalOverlay.addEventListener('click', (e) => {
    if (e.target === els.corteModalOverlay) cerrarCorteModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.corteModalOverlay.hidden) cerrarCorteModal();
  });

  els.btnGenerarCorte.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.corteError.textContent = '';
    const desde = els.corteFiltroDesde.value;
    const hasta = els.corteFiltroHasta.value;
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
    if ((faltaRfc || faltaClaveSat) && puedeCompletarDatosFiscales()) {
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
  // "Configuraciones globales" — con el botón oculto, no hay forma de
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
      els.ordenesHabilitadoAutoguardado.textContent = 'Guardado ✓';
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
      aplicarClaveSatCargada(config.clave_sat || '');
      cargarInfoCatalogoClaveSat();
      aplicarRegimenFiscalCompaniaBox(config.regimen_fiscal_compania);
      aplicarRazonSocialCompaniaBox(config.razon_social_compania);
      aplicarVisibilidadOrdenesCompra(config.ordenes_compra_habilitado);
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
    try {
      const res = await fetch(`${API_BASE}/admin/reportes/estadisticas`, { headers: { Authorization: authHeader } });
      if (!res.ok) return;
      const data = await res.json();
      els.reportesKpiEliminados.textContent = data.total_eliminados || 0;
      els.reportesKpiActivos.textContent = data.total_activos || 0;

      const serie = data.eliminados_por_mes || [];
      els.reportesKpiChartEmpty.hidden = serie.length > 0;
      els.reportesKpiChartBody.innerHTML = '';
      if (serie.length === 0) return;
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
    } catch (err) {
      // Las tarjetas se quedan en su valor por defecto (0 / vacío); se puede reintentar cambiando de vista.
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

  // "conOrigen" agrega la columna "Reporte de origen" — solo la usa el
  // ledger cruzado (varios reportes a la vez); dentro de un solo reporte
  // sobra, ya sabes de cuál es.
  function renderFilaReporteItem(item, conOrigen) {
    const celdaOrigen = conOrigen
      ? `<td data-label="Reporte de origen">${formatearFechaCorta(item.reporte_fecha_generacion)}</td>`
      : '';
    return `
      <tr>
        <td data-label="Tipo">${TIPO_REGISTRO_ETIQUETA[item.tipo_registro] || item.tipo_registro}</td>
        <td data-label="Identificador">
          <strong>${escapeHtml(item.identificador)}</strong>
          <button type="button" class="btn-ver-historial" data-tipo="${item.tipo_registro}" data-identificador="${escapeHtml(item.identificador)}" data-tooltip="Ver historial en todos los reportes" aria-label="Ver historial de ${escapeHtml(item.identificador)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
          </button>
        </td>
        <td data-label="RFC / Correo">${escapeHtml(item.rfc || '—')}</td>
        <td data-label="Detalle">${renderDetalleItemReporte(item)}</td>
        <td data-label="Monto">${item.monto === null ? '—' : `$${formatearMoneda(item.monto)}`}</td>
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
    try {
      const params = obtenerFiltrosLedgerActuales();
      const res = await fetch(`${API_BASE}/admin/reportes/eliminados?${params.toString()}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();
      const items = data.items || [];
      els.ledgerConteo.textContent = items.length;
      els.ledgerTableBody.innerHTML = items.map((item) => renderFilaReporteItem(item, true)).join('');
      els.ledgerEmpty.hidden = items.length > 0;
    } catch (err) {
      // La tabla se queda con lo último cargado; se puede reintentar ajustando un filtro.
    }
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

  function formatearFechaSoloDia(fechaISO) {
    if (!fechaISO) return '—';
    const fecha = new Date(fechaISO);
    if (Number.isNaN(fecha.getTime())) return '—';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

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

    try {
      const res = await fetch(`${API_BASE}/admin/reportes/${id}/items`, { headers: { Authorization: authHeader } });
      if (!res.ok) return;
      const data = await res.json();
      const items = data.items || [];
      els.cortesDetalleConteo.textContent = items.length;
      els.reportesCortesDetalleTableBody.innerHTML = items.map((item) => renderFilaReporteItem(item, false)).join('');
      els.reportesCortesDetalleEmpty.hidden = items.length > 0;
    } catch (err) {
      // La tabla se queda vacía; se puede reintentar volviendo a abrir el detalle.
    }
  }

  function volverListaCortes() {
    corteSeleccionadoId = '';
    els.reportesCortesDetalleWrap.hidden = true;
    els.reportesCortesListaWrap.hidden = false;
  }

  els.reportesCortesTableBody.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-corte-id]');
    if (boton) abrirDetalleCorte(boton.dataset.corteId);
  });
  els.btnCortesVolverLista.addEventListener('click', volverListaCortes);

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
    try {
      const params = obtenerFiltrosReporteActuales();
      const res = await fetch(`${API_BASE}/admin/reportes/${reporteSeleccionadoId}/items?${params.toString()}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();
      renderReporteItems(data.items || []);
    } catch (err) {
      // La tabla se queda con lo último cargado; se puede reintentar ajustando un filtro.
    }
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

  els.btnToggleSmtp.addEventListener('click', () => {
    const abierto = els.btnToggleSmtp.getAttribute('aria-expanded') === 'true';
    els.btnToggleSmtp.setAttribute('aria-expanded', String(!abierto));
    els.smtpConfigBody.hidden = abierto;
    if (!abierto) cargarConfigSmtp();
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
      desc: 'Se envía al dar de alta un usuario en "Usuarios" (administrador, fiscal o cliente). Asunto fijo: "Te invitamos a Portal Clarvo tu negocio en orden".',
      vars: [
        { nombre: '{perfil}', desc: 'Perfil de la cuenta creada' },
        { nombre: '{usuario}', desc: 'RFC o nombre de usuario' },
      ],
    },
    recuperacion: {
      campo: 'cuerpo_recuperacion',
      desc: 'Se envía cuando alguien pide "¿Olvidaste tu contraseña?" en el login. Asunto fijo: "Recupera tu acceso — Portal Clarvo tu negocio en orden".',
      vars: [],
    },
    aviso_contador: {
      campo: 'cuerpo_aviso_contador',
      desc: 'Se envía al "Correo de quien va a facturar" (arriba) cada vez que un cliente sube un ticket nuevo.',
      vars: [
        { nombre: '{rfc}', desc: 'RFC del cliente' },
        { nombre: '{folio}', desc: 'Folio del ticket' },
      ],
    },
    cliente: {
      campo: 'cuerpo_cliente',
      desc: 'Se envía al cliente (el correo de su constancia) en cuanto subes su factura. Asunto fijo: "Factura lista — Folio ...".',
      vars: [
        { nombre: '{folio}', desc: 'Folio del ticket' },
        { nombre: '{rfc}', desc: 'RFC del cliente' },
        { nombre: '{marca}', desc: 'Nombre de marca' },
      ],
    },
    reporte: {
      campo: 'cuerpo_reporte',
      desc: 'Se envía al correo de reportes (Configuración Reportes) cada vez que se genera o se envía un reporte manual.',
      vars: [
        { nombre: '{fecha}', desc: 'Fecha de generación' },
        { nombre: '{hora}', desc: 'Hora de generación' },
      ],
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
    els.plantillaVars.innerHTML = def.vars.length
      ? def.vars.map((v) => `<span class="var-chip" data-tooltip="${escapeHtml(v.desc)}">${escapeHtml(v.nombre)}</span>`).join('')
      : '';
    els.plantillaTexto.value = plantillasTextos[id] || '';
    actualizarPreviewPlantilla();
  }

  els.plantillasTabs.forEach((btn) => {
    btn.addEventListener('click', () => seleccionarPlantilla(btn.dataset.plantilla));
  });

  els.plantillaTexto.addEventListener('input', () => {
    plantillasTextos[plantillaActual] = els.plantillaTexto.value;
    programarPreviewPlantilla();
  });

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
      };
      seleccionarPlantilla(plantillaActual);

      els.smtpPassword.value = '';
      els.smtpPasswordHint.textContent = data.passwordConfigurada
        ? 'Ya hay una contraseña guardada. Déjala en blanco para conservarla, o escribe una nueva para reemplazarla.'
        : 'Sin contraseña guardada todavía.';

      els.smtpEstadoBadge.hidden = false;
      els.smtpEstadoBadge.textContent = data.configurado ? 'Configurado' : 'Sin configurar';
      els.smtpEstadoBadge.className = `smtp-estado-badge ${data.configurado ? 'is-ok' : 'is-pendiente'}`;
    } catch (err) {
      // Si falla la carga, el formulario se queda con los valores por
      // defecto; el administrador puede llenarlo y guardar de todas formas.
    }
  }

  function setGuardarSmtpLoading(cargando) {
    els.btnGuardarSmtp.disabled = cargando;
    els.btnGuardarSmtpLabel.textContent = cargando ? 'Guardando…' : 'Guardar configuración';
  }

  els.btnGuardarSmtp.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.smtpConfigError.textContent = '';
    const host = els.smtpHost.value.trim();
    const puerto = Number(els.smtpPuerto.value);
    const seguridad = els.smtpSeguridad.value;
    const usuario = els.smtpUsuario.value.trim();
    const password = els.smtpPassword.value;
    const nombreRemitente = els.smtpNombreRemitente.value.trim();
    const correoRemitente = els.smtpCorreoRemitente.value.trim();
    const correoContador = els.smtpCorreoContador.value.trim();

    if (!host) {
      els.smtpConfigError.textContent = 'El host SMTP es obligatorio.';
      return;
    }
    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
      els.smtpConfigError.textContent = 'El puerto debe ser un número entre 1 y 65535.';
      return;
    }
    if (!usuario) {
      els.smtpConfigError.textContent = 'El usuario (correo) es obligatorio.';
      return;
    }
    if (correoContador && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoContador)) {
      els.smtpConfigError.textContent = 'El correo de quien va a facturar no es válido.';
      return;
    }

    setGuardarSmtpLoading(true);
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.smtpConfigError.textContent = data.error || 'No se pudo guardar la configuración.';
        return;
      }
      showToast('Configuración de correo guardada.');
      els.smtpPassword.value = '';
      els.smtpPasswordHint.textContent = data.passwordConfigurada
        ? 'Ya hay una contraseña guardada. Déjala en blanco para conservarla, o escribe una nueva para reemplazarla.'
        : 'Sin contraseña guardada todavía.';
      els.smtpEstadoBadge.hidden = false;
      els.smtpEstadoBadge.textContent = data.configurado ? 'Configurado' : 'Sin configurar';
      els.smtpEstadoBadge.className = `smtp-estado-badge ${data.configurado ? 'is-ok' : 'is-pendiente'}`;
    } catch (err) {
      els.smtpConfigError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setGuardarSmtpLoading(false);
    }
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
    } catch (err) {
      els.smtpPruebaError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setEnviarPruebaLoading(false);
    }
  });

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
      if (data.total > 0) mostrarNotifTicketsPendientes(data.tickets);
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
    els.notifTicketsOverlay.hidden = false;
  }

  function cerrarNotifTicketsPendientes() {
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
        els.adminError.textContent = 'No se pudieron cargar los registros.';
        return;
      }

      const data = await res.json();
      state.registros = data.registros || [];
      aplicarFiltro();
    } catch (err) {
      els.adminError.textContent = 'No se pudo conectar con el servidor.';
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
      contenedorAcciones.className = 'admin-row-actions';

      const btnVer = document.createElement('button');
      btnVer.type = 'button';
      btnVer.className = 'btn-ver';
      btnVer.textContent = 'Ver archivo';
      btnVer.addEventListener('click', () => verArchivo(r.id, r.archivo_nombre_original));
      contenedorAcciones.appendChild(btnVer);

      if (state.vista === 'papelera') {
        const btnRestaurar = document.createElement('button');
        btnRestaurar.type = 'button';
        btnRestaurar.className = 'btn-restaurar';
        btnRestaurar.textContent = 'Restaurar';
        btnRestaurar.addEventListener('click', () => restaurarRegistro(r.id, r.nombre));
        contenedorAcciones.appendChild(btnRestaurar);

        const btnEliminarPermanente = document.createElement('button');
        btnEliminarPermanente.type = 'button';
        btnEliminarPermanente.className = 'btn-eliminar-permanente';
        btnEliminarPermanente.textContent = 'Eliminar permanentemente';
        btnEliminarPermanente.addEventListener('click', () => confirmarEliminarPermanente(r.id, r.nombre));
        contenedorAcciones.appendChild(btnEliminarPermanente);
      } else {
        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.className = 'btn-eliminar';
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.addEventListener('click', () => confirmarEliminar(r.id, r.nombre));
        contenedorAcciones.appendChild(btnEliminar);
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

  function abrirConfirmacion({ titulo, mensaje, textoBoton, onConfirmar }) {
    els.confirmModalTitle.textContent = titulo;
    els.confirmModalMensaje.textContent = mensaje;
    els.btnConfirmAceptar.textContent = textoBoton;
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

  // ---------- Modal "Configuraciones globales" ----------
  // Antes era una vista de página con 6 tarjetas plegables independientes
  // (podían quedar varias abiertas a la vez); ahora es un modal con barra
  // lateral + buscador, una sección visible a la vez (ver PROJECT_STATE.md).
  // Las 6 <section class="admin-config-card"> y todo su contenido/lógica de
  // guardado NO se tocan — solo se selecciona cuál de las 6 se muestra.

  const CONFIG_SECCIONES = [
    { id: 'admin-config-card', label: 'Campos obligatorios de los formularios' },
    { id: 'global-config-card', label: 'Configuraciones fiscales' },
    { id: 'smtp-config-card', label: 'Correo electrónico (SMTP)' },
    { id: 'reportes-config-card', label: 'Configuración Reportes' },
    { id: 'ordenes-toggle-card', label: 'Ventas' },
    { id: 'inv-toggle-card', label: 'Inventarios' },
  ];

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
    // Primeros pasos (Fase 2 UX): "revisar" tickets/Constancias/CxC cuenta
    // como paso completado con solo entrar a esa vista una vez.
    if (vista === 'tickets') marcarOnboardingVisto('tickets');
    if (vista === 'constancias') marcarOnboardingVisto('constancias');
    if (vista === 'cxc') marcarOnboardingVisto('cxc');
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
    abrirConfigModal();
  });
  els.btnVistaLecturaReportes.addEventListener('click', () => cambiarVistaPrincipal('lectura-reportes'));
  els.btnVistaProveedores.addEventListener('click', () => cambiarVistaPrincipal('proveedores'));

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
    els.vistaGastos.hidden = true;
    els.vistaUsuarios.hidden = true;
    els.vistaLecturaReportes.hidden = true;
    els.vistaProveedores.hidden = true;
    els.adminMenuMovil.hidden = false;
  }
  els.btnMenuMovil.addEventListener('click', mostrarMenuMovil);
  document.querySelectorAll('.admin-menu-movil-btn').forEach((boton) => {
    boton.addEventListener('click', () => {
      // "Configuraciones globales" ya no es una vista de página — abre el
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

  // Vista "Inicio": bienvenida + resumen de tickets, fiel al mockup de
  // stitch (dashboard_portal_addv_fiel_al_mockup). Reutiliza el mismo
  // endpoint GET /admin/tickets que ya usa la vista Tickets — sin
  // agregar un endpoint nuevo — y calcula todo (estatísticas, dona,
  // recientes) en el cliente a partir de esos mismos datos.
  async function cargarInicio() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }
    els.inicioError.textContent = '';
    els.inicioTituloBienvenida.textContent = usuarioSesionActual
      ? `¡Bienvenido, ${usuarioSesionActual}!`
      : '¡Bienvenido!';
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
        els.inicioError.textContent = 'No se pudieron cargar las solicitudes.';
        return;
      }
      const data = await res.json();
      renderInicio(data.tickets || []);
    } catch (err) {
      els.inicioError.textContent = 'No se pudo conectar con el servidor.';
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
        <td data-label="">${puedeGestionar ? '<button type="button" class="btn-ver">Gestionar</button>' : ''}</td>
      `;
      if (puedeGestionar) tr.querySelector('.btn-ver').addEventListener('click', () => abrirTicketModal(t));
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
        els.ticketsError.textContent = 'No se pudieron cargar los tickets.';
        return;
      }
      const data = await res.json();
      renderTickets(data.tickets || []);
    } catch (err) {
      els.ticketsError.textContent = 'No se pudo conectar con el servidor.';
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
      contenedorAcciones.className = 'admin-row-actions';

      if (state.vistaTickets === 'papelera') {
        const btnRestaurar = document.createElement('button');
        btnRestaurar.type = 'button';
        btnRestaurar.className = 'btn-restaurar';
        btnRestaurar.textContent = 'Restaurar';
        btnRestaurar.addEventListener('click', () => restaurarTicket(t.id, t.folio));
        contenedorAcciones.appendChild(btnRestaurar);

        const btnEliminarPermanente = document.createElement('button');
        btnEliminarPermanente.type = 'button';
        btnEliminarPermanente.className = 'btn-eliminar-permanente';
        btnEliminarPermanente.textContent = 'Eliminar permanentemente';
        btnEliminarPermanente.addEventListener('click', () => confirmarEliminarTicketPermanente(t.id, t.folio));
        contenedorAcciones.appendChild(btnEliminarPermanente);
      } else {
        const btnVer = document.createElement('button');
        btnVer.type = 'button';
        btnVer.className = 'btn-ver';
        btnVer.textContent = 'Gestionar';
        btnVer.addEventListener('click', () => abrirTicketModal(t));
        contenedorAcciones.appendChild(btnVer);

        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.className = 'btn-eliminar';
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.addEventListener('click', () => confirmarEliminarTicket(t.id, t.folio));
        contenedorAcciones.appendChild(btnEliminar);
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
        option.textContent = correo.email;
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

  // Método de entrega: correo (de siempre) o imprimir ticket (nuevo, sin
  // correo — ver PROJECT_STATE.md). Imprimir oculta Tipo de cliente +
  // Correo por completo, ya no aplican.
  let ordenMetodoEntregaImprimir = false;
  function aplicarMetodoEntregaOrden(esImprimir) {
    ordenMetodoEntregaImprimir = esImprimir;
    els.btnOrdenEntregaCorreo.classList.toggle('is-active', !esImprimir);
    els.btnOrdenEntregaCorreo.setAttribute('aria-selected', String(!esImprimir));
    els.btnOrdenEntregaImprimir.classList.toggle('is-active', esImprimir);
    els.btnOrdenEntregaImprimir.setAttribute('aria-selected', String(esImprimir));
    els.ordenEntregaCorreoWrap.hidden = esImprimir;
    els.ordenEntregaImprimirHint.hidden = !esImprimir;
    if (esImprimir) {
      setFieldError('orden-email', '');
      setFieldError('orden-email-nuevo', '');
    }
  }
  els.btnOrdenEntregaCorreo.addEventListener('click', () => aplicarMetodoEntregaOrden(false));
  els.btnOrdenEntregaImprimir.addEventListener('click', () => aplicarMetodoEntregaOrden(true));

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
    if (ordenMetodoEntregaImprimir) return true;
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

  function actualizarTotalPreviewOrden() {
    const cantidad = obtenerValorNumerico(els.ordenCantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      els.ordenTotalPreview.textContent = '$0.00 MXN';
      els.ordenMiniResumen.textContent = '';
      return;
    }
    const total = Math.round(cantidad * (1 + ivaActualParaOrden / 100) * 100) / 100;
    els.ordenTotalPreview.textContent = `$${formatearMoneda(total)} MXN`;
    // Sustituye los campos "Cantidad (MXN)"/"IVA" (ocultos, ver
    // admin.html) por un resumen chico de una línea — mismo dato, sin
    // ocupar 2 bloques completos. La resta contra el total ya redondeado
    // evita que el IVA mostrado y el total mostrado se desfasen entre sí.
    const ivaMonto = Math.round((total - cantidad) * 100) / 100;
    els.ordenMiniResumen.textContent = `Subtotal $${formatearMoneda(cantidad)} · IVA $${formatearMoneda(ivaMonto)}`;
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
      els.ordenIvaInfo.textContent = `${config.iva_porcentaje}%`;
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
        ${p.imagen_thumb_url ? '<img class="inv-thumb inv-thumb-chica" alt="" />' : ''}
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
      if (producto && producto.imagen_thumb_url) cargarImagenAutenticada(btn.querySelector('img.inv-thumb'), producto.imagen_thumb_url);
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
        ? 'Un servicio no descuenta existencia (D11).'
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
    aplicarMetodoEntregaOrden(false);
    aplicarEstadoPago('pagada');
    if (els.ordenFechaVencimiento) els.ordenFechaVencimiento.value = '';
    if (els.ordenNotasCobro) els.ordenNotasCobro.value = '';
    els.ordenErrorGeneral.textContent = '';
    setFieldError('orden-concepto', '');
    setFieldError('orden-cantidad', '');
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

  els.btnRegistrarOrden.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.ordenErrorGeneral.textContent = '';
    setFieldError('orden-concepto', '');
    setFieldError('orden-cantidad', '');
    setFieldError('orden-email', '');
    setFieldError('orden-email-nuevo', '');
    setFieldError('orden-inventario-unidades', '');

    const concepto = els.ordenConcepto.value.trim();
    const cantidad = obtenerValorNumerico(els.ordenCantidad);
    // Sin correo cuando el método de entrega es "imprimir" (ver
    // PROJECT_STATE.md — el backend acepta email vacío en ese caso).
    const email = ordenMetodoEntregaImprimir
      ? ''
      : ordenModoClienteNuevo
        ? els.ordenEmailNuevo.value.trim().toLowerCase()
        : els.ordenEmail.value;
    // Se captura ANTES de que limpiarFormularioOrden() (dentro del
    // temporizador de mostrarExitoRegistrarOrden) regrese el toggle a
    // "correo" por defecto para la siguiente venta.
    const imprimirAlGuardar = ordenMetodoEntregaImprimir;
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
        email,
        es_cliente_nuevo: ordenModoClienteNuevo,
        estado_pago: ordenEstadoPago,
        fecha_vencimiento: ordenEstadoPago === 'pendiente' ? fechaVencimiento : null,
        notas_cobro: ordenEstadoPago === 'pendiente' ? notasCobro : null,
      });
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
          email,
          es_cliente_nuevo: ordenModoClienteNuevo,
          estado_pago: ordenEstadoPago,
          fecha_vencimiento: ordenEstadoPago === 'pendiente' ? fechaVencimiento : null,
          notas_cobro: ordenEstadoPago === 'pendiente' ? notasCobro : null,
          productos_inventario:
            lineasInventarioEnLista.length > 0
              ? lineasInventarioEnLista.map((p) => ({ producto_id: p.producto_id, cantidad: p.cantidad }))
              : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.ordenErrorGeneral.textContent = data.mensaje || data.error || 'No se pudo registrar la venta.';
        return;
      }
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
                email: data.email,
                fecha_compra_formateada: data.fecha_compra,
              })
          : undefined
      );
      cargarOrdenes();
    } catch (err) {
      els.ordenErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
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
        els.ordenesError.textContent = 'No se pudieron cargar las ventas.';
        return;
      }
      const data = await res.json();
      ordenesCache = data.ordenes || [];
      aplicarFiltrosOrdenes();
    } catch (err) {
      els.ordenesError.textContent = 'No se pudo conectar con el servidor.';
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
    const totalEstimado = Math.round(cantidad * (1 + iva / 100) * 100) / 100;
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
    const hayFiltro = Boolean(concepto || fechaDesde || fechaHasta || totalMin !== null || totalMax !== null || estadoPagoFiltro);
    els.ordenesEmpty.hidden = ordenesCache.length > 0 || pendientes.length > 0;
    els.ordenesFiltroEmpty.hidden = !(hayFiltro && ordenesCache.length > 0 && filtradas.length === 0);
  }
  [els.ordenesFiltroConcepto, els.ordenesFiltroFechaDesde, els.ordenesFiltroFechaHasta, els.ordenesFiltroTotalMin, els.ordenesFiltroTotalMax].forEach((el) => {
    el.addEventListener('input', () => aplicarFiltrosOrdenes());
  });
  if (els.ordenesFiltroEstadoPago) els.ordenesFiltroEstadoPago.addEventListener('change', () => aplicarFiltrosOrdenes());
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
    const lineas = orden.concepto.split('\n').filter((linea) => linea.trim());
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

    return `
      <div class="ticket-imprimir-titulo">Ticket de venta</div>
      <div class="ticket-imprimir-separador"></div>
      <div class="ticket-imprimir-meta">Folio: ${escapeHtml(orden.numero_compra || '—')}</div>
      <div class="ticket-imprimir-meta">${escapeHtml(fecha)}</div>
      <div class="ticket-imprimir-separador"></div>
      ${filasHtml}
      <div class="ticket-imprimir-separador"></div>
      <div class="ticket-imprimir-linea"><span>Subtotal</span><span>$${formatearMoneda(orden.cantidad)}</span></div>
      <div class="ticket-imprimir-linea"><span>IVA (${Number(orden.iva_porcentaje)}%)</span><span>$${formatearMoneda(ivaMonto)}</span></div>
      <div class="ticket-imprimir-linea ticket-imprimir-total"><span>TOTAL</span><span>$${formatearMoneda(orden.total)}</span></div>
      <div class="ticket-imprimir-separador"></div>
      ${orden.email ? `<div class="ticket-imprimir-meta">Cliente: ${escapeHtml(orden.email)}</div><div class="ticket-imprimir-separador"></div>` : ''}
      <div class="ticket-imprimir-gracias">¡Gracias por su compra!</div>
    `;
  }

  // Único punto de entrada de los 3 disparadores de impresión (guardar+
  // imprimir, ícono de fila, "Ver venta") — antes cada uno llamaba a
  // window.print() directo; ahora todos abren esta vista previa primero,
  // y window.print() solo se dispara desde su botón "Imprimir".
  let ticketPreviewOrdenActual = null;
  function abrirPreviewTicket(orden) {
    ticketPreviewOrdenActual = orden;
    els.ticketPreviewRecibo.innerHTML = construirHtmlTicket(orden);
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

    els.ordenModalCantidad.textContent = `$${formatearMoneda(orden.cantidad)}`;
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
        els.usuariosError.textContent = 'No se pudieron cargar los usuarios.';
        return;
      }
      const data = await res.json();
      renderUsuarios(data.usuarios || []);
    } catch (err) {
      els.usuariosError.textContent = 'No se pudo conectar con el servidor.';
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
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="RFC / usuario" data-col="rfc"><strong>${escapeHtml(u.rfc)}</strong>${pendienteCambio ? ' <span class="estatus-badge estatus-pendiente" data-tooltip="Debe cambiar su contraseña en el siguiente inicio de sesión">Cambio pendiente</span>' : ''}</td>
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
      els.crearUsuarioRfcLabel.textContent = 'RFC';
      els.crearUsuarioRfc.placeholder = 'XAXX010101000';
      els.crearUsuarioRfcHint.textContent = 'RFC del cliente, con el que iniciará sesión en el portal.';
      els.crearUsuarioTelefonoField.hidden = false;
    } else {
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

    let valido = true;
    if (!rfc) {
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
      els.editarUsuarioRfcLabel.textContent = 'RFC';
      els.editarUsuarioRfc.placeholder = 'XAXX010101000';
      els.editarUsuarioRfcHint.textContent = 'RFC del cliente, con el que inicia sesión en el portal.';
      els.editarUsuarioTelefonoField.hidden = false;
    } else {
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

    let valido = true;
    if (!rfc) {
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

  // ---------- Cuenta de respaldo "admin" ----------

  els.btnToggleAdminFallback.addEventListener('click', () => {
    const abierto = els.btnToggleAdminFallback.getAttribute('aria-expanded') === 'true';
    els.btnToggleAdminFallback.setAttribute('aria-expanded', String(!abierto));
    els.adminFallbackBody.hidden = abierto;
  });

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

  els.btnToggleAdminFallbackPassword.addEventListener('click', () => {
    const mostrando = els.adminFallbackPassword.type === 'password';
    els.adminFallbackPassword.type = mostrando ? 'text' : 'password';
    els.btnToggleAdminFallbackPassword.setAttribute('aria-pressed', String(mostrando));
    els.btnToggleAdminFallbackPassword.classList.toggle('is-visible', mostrando);
  });

  els.adminFallbackPassword.addEventListener('input', () => {
    actualizarReglasVisuales(els.adminFallbackPassword.value, 'admin-fallback-reglas');
    els.btnCopiarAdminFallbackPassword.hidden = true;
  });

  els.btnGenerarPasswordAdminFallback.addEventListener('click', () => {
    const nueva = generarPasswordAleatoria();
    els.adminFallbackPassword.value = nueva;
    els.adminFallbackPassword.type = 'text';
    els.btnToggleAdminFallbackPassword.setAttribute('aria-pressed', 'true');
    els.btnToggleAdminFallbackPassword.classList.add('is-visible');
    actualizarReglasVisuales(nueva, 'admin-fallback-reglas');
    els.btnCopiarAdminFallbackPassword.hidden = false;
    els.btnCopiarAdminFallbackPassword.classList.remove('is-copiado');
  });

  els.btnCopiarAdminFallbackPassword.addEventListener('click', async () => {
    const valor = els.adminFallbackPassword.value;
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
      els.btnCopiarAdminFallbackPassword.classList.add('is-copiado');
    } catch (err) {
      showToast('No se pudo copiar. Selecciona y copia el texto manualmente.', true);
    }
  });

  function setGuardandoAdminFallbackLoading(cargando) {
    els.btnGuardarAdminFallback.disabled = cargando;
    els.btnGuardarAdminFallbackLabel.textContent = cargando ? 'Guardando…' : 'Guardar contraseña';
  }

  els.btnGuardarAdminFallback.addEventListener('click', async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.adminFallbackError.textContent = '';
    const password = els.adminFallbackPassword.value;
    const reglas = evaluarReglasPassword(password);
    if (!Object.values(reglas).every(Boolean)) {
      els.adminFallbackError.textContent = 'La contraseña no cumple con los requisitos de arriba.';
      return;
    }

    setGuardandoAdminFallbackLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/config/admin-password`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.adminFallbackError.textContent = data.error || 'No se pudo actualizar la contraseña.';
        return;
      }
      showToast('Contraseña de la cuenta "admin" actualizada. Úsala la próxima vez que inicies sesión con ese usuario.');
      els.adminFallbackPassword.value = '';
      els.btnCopiarAdminFallbackPassword.hidden = true;
      document.querySelectorAll('#admin-fallback-reglas li').forEach((li) => li.classList.remove('is-cumplida'));
    } catch (err) {
      els.adminFallbackError.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setGuardandoAdminFallbackLoading(false);
    }
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
      ${c.activa ? '' : `<button type="button" class="btn-categoria-accion gastos-categoria-reactivar" data-id="${c.id}">Reactivar</button>`}
      <button type="button" class="btn-icon gastos-categoria-renombrar" data-id="${c.id}" aria-label="Renombrar ${escapeHtml(c.etiqueta)}">✏️</button>
      ${c.tieneGastos ? '' : `<button type="button" class="btn-icon gastos-categoria-borrar" data-id="${c.id}" aria-label="Eliminar ${escapeHtml(c.etiqueta)}">🗑️</button>`}
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
  const DASHBOARD_TARJETAS = [
    { id: 'kpi-facturado', titulo: 'Total facturado' },
    { id: 'kpi-sin-facturar', titulo: 'Ventas sin facturar' },
    { id: 'kpi-balance', titulo: 'Balance ventas vs gastos' },
    { id: 'kpi-gastos', titulo: 'Total gastos' },
    { id: 'utilidad', titulo: 'Utilidad neta del mes' },
    { id: 'facturacion', titulo: 'Ventas facturadas vs sin facturar' },
    { id: 'gastos-categoria', titulo: 'Distribución de gastos por categoría' },
    { id: 'ventas-facturado-gastos', titulo: 'Ventas vs Facturado vs Gastos' },
    { id: 'balance-acumulado', titulo: 'Utilidad neta mensual' },
    { id: 'proyeccion', titulo: 'Proyección de ventas' },
    { id: 'proveedores', titulo: 'Top proveedores de gasto' },
  ];
  const DASHBOARD_SPAN_MIN = 3;
  const DASHBOARD_SPAN_MAX = 12;
  const DASHBOARD_SPANS_DEFECTO = {
    'kpi-facturado': 3,
    'kpi-gastos': 3,
    'kpi-balance': 3,
    'kpi-sin-facturar': 3,
    utilidad: 6,
    'ventas-facturado-gastos': 6,
    'gastos-categoria': 6,
    facturacion: 6,
    'balance-acumulado': 4,
    proyeccion: 4,
    proveedores: 4,
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

  function aplicarLayoutDashboard() {
    const tarjetas = obtenerTarjetasDashboard();
    if (!dashboardLayout) {
      tarjetas.forEach((t) => {
        t.style.order = '';
        t.style.gridColumn = '';
      });
      return;
    }
    const spansPorId = new Map(dashboardLayout.map((item) => [item.id, item.span]));
    tarjetas.forEach((t, indice) => {
      t.style.order = String(indice);
      const span = spansPorId.get(t.dataset.dashboardId);
      if (span) t.style.gridColumn = `span ${span}`;
    });
  }

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
      const layout = obtenerTarjetasDashboard().map((t) => ({
        id: t.dataset.dashboardId,
        span: parseInt(t.style.gridColumn.replace('span ', ''), 10) || DASHBOARD_SPANS_DEFECTO[t.dataset.dashboardId] || 12,
      }));
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
    boton.setAttribute('aria-label', `Cambiar ancho de tarjeta: ${titulo} (flechas izquierda/derecha con la tarjeta enfocada)`);
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
    const spanInicial =
      parseInt((tarjeta.style.gridColumn || '').replace('span ', ''), 10) ||
      DASHBOARD_SPANS_DEFECTO[tarjeta.dataset.dashboardId] ||
      12;
    let spanFinal = spanInicial;
    const alMover = (e) => {
      const anchoColumna = els.resumenFinTablero.clientWidth / 12;
      const delta = Math.round((e.clientX - xInicial) / anchoColumna);
      spanFinal = Math.min(DASHBOARD_SPAN_MAX, Math.max(DASHBOARD_SPAN_MIN, spanInicial + delta));
      tarjeta.style.gridColumn = `span ${spanFinal}`;
    };
    const alTerminar = () => {
      handle.removeEventListener('pointermove', alMover);
      handle.removeEventListener('pointerup', alTerminar);
      handle.removeEventListener('pointercancel', alTerminar);
      if (spanFinal !== spanInicial) {
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
        els.resumenFinError.textContent = 'No se pudo cargar el resumen financiero.';
        return;
      }
      const data = await res.json();
      renderResumenFinanciero(data);
    } catch (err) {
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

    renderResumenFinUtilidad(mes);
    renderResumenFinUtilidadMensual(serie);
    renderResumenFinProyeccion(serie, data.proyeccion_ventas);
    renderResumenFinGastosCategoria(data.gastos_por_categoria || []);
    renderResumenFinFacturacion(mes);
    renderResumenFinProveedores(data.top_proveedores || []);
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

    const hayDatos = ventasTotales > 0 || gastos > 0;
    els.resumenFinUtilidadEmpty.hidden = hayDatos;
    els.resumenFinUtilidadBody.hidden = !hayDatos;
    if (!hayDatos) return;

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
  function renderResumenFinUtilidadMensual(serie) {
    const svg = els.resumenFinBalanceSvg;
    svg.innerHTML = '';
    els.resumenFinBalanceEtiquetas.innerHTML = '';
    if (serie.length === 0) {
      els.resumenFinBalanceEmpty.hidden = false;
      return;
    }
    els.resumenFinBalanceEmpty.hidden = true;

    const valores = serie.map((m) => m.utilidad_neta);
    const { puntos, yCero } = construirPuntosLinea(valores, 300, 120, 22);
    const indicesClave = calcularIndicesClave(valores);

    const lineaCero = document.createElementNS(SVG_NS, 'line');
    lineaCero.setAttribute('x1', '0');
    lineaCero.setAttribute('x2', '300');
    lineaCero.setAttribute('y1', String(yCero));
    lineaCero.setAttribute('y2', String(yCero));
    lineaCero.setAttribute('class', 'resumen-fin-linea-cero');
    svg.appendChild(lineaCero);

    if (puntos.length > 1) {
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

      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(p.x));
      circle.setAttribute('cy', String(p.y));
      circle.setAttribute('r', esClave ? '3.5' : '3');
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
      texto.setAttribute('y', String(esPositiva ? p.y - 10 : p.y + 17));
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
  // sin datos suficientes.
  function renderResumenFinProyeccion(serie, proyeccion) {
    const svg = els.resumenFinProyeccionSvg;
    svg.innerHTML = '';
    els.resumenFinProyeccionEtiquetas.innerHTML = '';
    if (serie.length === 0) {
      els.resumenFinProyeccionEmpty.hidden = false;
      els.resumenFinProyeccionNota.hidden = true;
      return;
    }
    els.resumenFinProyeccionEmpty.hidden = true;

    const meses = [...serie.map((m) => m.mes), ...(proyeccion || []).map((m) => m.mes)];
    const valores = [...serie.map((m) => m.ventas), ...(proyeccion || []).map((m) => m.ventas)];
    const cantidadReal = serie.length;
    const { puntos } = construirPuntosLinea(valores, 300, 120, 22);
    const indicesClave = calcularIndicesClave(valores, cantidadReal);

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

    puntos.forEach((p, i) => {
      const esProyectado = i >= cantidadReal;
      const esClave = indicesClave.has(i);
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(p.x));
      circle.setAttribute('cy', String(p.y));
      circle.setAttribute('r', esClave ? '3.5' : '3');
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
      texto.setAttribute('y', String(p.y - 10));
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
  const RESUMEN_FIN_COLORES_CATEGORIA = {
    renta: '#8FADD9',
    nomina: '#A9C4E3',
    software: '#719FD4',
    hosting: '#C0D3EB',
    servicios: '#9BB8DE',
    combustible: '#D1DEED',
    papeleria: '#B3C9E1',
    publicidad: '#8ED6B7',
    viaticos: '#E8B592',
    otro: '#C7CAD1',
  };
  const RESUMEN_FIN_COLOR_FACTURADO = '#7FCBA8';
  const RESUMEN_FIN_COLOR_SIN_FACTURAR = '#E4A97E';

  function renderResumenFinGastosCategoria(filas) {
    if (!filas || filas.length === 0) {
      els.resumenFinDonutCategorias.innerHTML = '';
      els.resumenFinDonutCategoriasLeyenda.innerHTML = '';
      els.resumenFinDonutCategoriasTotal.textContent = '$0';
      els.resumenFinDonutCategoriasEmpty.hidden = false;
      return;
    }
    els.resumenFinDonutCategoriasEmpty.hidden = true;
    const segmentos = filas.map((f) => ({
      valor: f.monto,
      color: RESUMEN_FIN_COLORES_CATEGORIA[f.categoria] || RESUMEN_FIN_COLORES_CATEGORIA.otro,
    }));
    const total = renderDonutGenerico(els.resumenFinDonutCategorias, segmentos);
    els.resumenFinDonutCategoriasTotal.textContent = `$${formatearMoneda(total)}`;
    els.resumenFinDonutCategoriasLeyenda.innerHTML = filas
      .map((f) => {
        const color = RESUMEN_FIN_COLORES_CATEGORIA[f.categoria] || RESUMEN_FIN_COLORES_CATEGORIA.otro;
        const porcentaje = total > 0 ? Math.round((f.monto / total) * 100) : 0;
        return `<li><span class="resumen-fin-donut-dot" style="background:${color}" aria-hidden="true"></span><span>${escapeHtml(etiquetaCategoriaGasto(f.categoria))}</span><strong>$${formatearMoneda(f.monto)} (${porcentaje}%)</strong></li>`;
      })
      .join('');
  }

  function renderResumenFinFacturacion(mes) {
    const ventas = mes.ventas || 0;
    const facturado = mes.facturado || 0;
    const sinFacturar = mes.ventas_sin_facturar || 0;
    if (ventas <= 0) {
      els.resumenFinDonutFacturacion.innerHTML = '';
      els.resumenFinDonutFacturacionLeyenda.innerHTML = '';
      els.resumenFinDonutFacturacionTotal.textContent = '$0';
      els.resumenFinDonutFacturacionEmpty.hidden = false;
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
      <li><span class="resumen-fin-donut-dot" style="background:${RESUMEN_FIN_COLOR_FACTURADO}" aria-hidden="true"></span><span>Facturadas</span><strong>$${formatearMoneda(facturado)} (${pctFacturado}%)</strong></li>
      <li><span class="resumen-fin-donut-dot" style="background:${RESUMEN_FIN_COLOR_SIN_FACTURAR}" aria-hidden="true"></span><span>Sin facturar</span><strong>$${formatearMoneda(sinFacturar)} (${Math.max(0, 100 - pctFacturado)}%)</strong></li>
    `;
  }

  function renderResumenFinProveedores(filas) {
    if (!filas || filas.length === 0) {
      els.resumenFinProveedoresLista.innerHTML = '';
      els.resumenFinProveedoresEmpty.hidden = false;
      return;
    }
    els.resumenFinProveedoresEmpty.hidden = true;
    const maximo = Math.max(...filas.map((f) => f.monto), 1);
    els.resumenFinProveedoresLista.innerHTML = filas
      .map(
        (f) => `
      <li class="resumen-fin-proveedor-fila">
        <span class="resumen-fin-proveedor-nombre" data-tooltip="${escapeHtml(f.proveedor)}" tabindex="0">${escapeHtml(f.proveedor)}</span>
        <div class="resumen-fin-proveedor-barra-wrap">
          <span class="resumen-fin-proveedor-barra" style="width:${(f.monto / maximo) * 100}%"></span>
        </div>
        <span class="resumen-fin-proveedor-monto">$${formatearMoneda(f.monto)}</span>
      </li>`
      )
      .join('');
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

  async function cargarEstadoInventario() {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/reportes/estado`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const data = await res.json();
      const kpis = data.kpis || {};
      els.invEstadoKpiValor.textContent = `$${formatearMoneda(kpis.valor_total_existencia || 0)}`;
      els.invEstadoKpiRotacion.textContent = `${Number(kpis.rotacion_promedio_catalogo || 0).toFixed(1)}×`;
      els.invEstadoKpiSinMovimiento.textContent = kpis.productos_sin_movimiento_90d || 0;

      renderInvEstadoRank(data.top_ventas_90d || [], data.bottom_ventas_90d || []);
      renderInvEstadoRotacion(data.rotacion || [], kpis.rotacion_promedio_catalogo || 0);
      renderInvEstadoDonutCategoria(data.valor_por_categoria || []);
      renderInvEstadoCobertura(data.cobertura || null);
      renderInvEstadoServicios(data.servicios || null);
    } catch (err) {
      // Las 4 gráficas se quedan en su estado vacío/anterior; se puede
      // reintentar volviendo a entrar a la pestaña.
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
      .map(
        (f) => `
      <li class="resumen-fin-proveedor-fila">
        <span class="resumen-fin-proveedor-nombre" data-tooltip="${escapeHtml(f.nombre)}" tabindex="0">${escapeHtml(f.nombre)}</span>
        <div class="resumen-fin-proveedor-barra-wrap">
          <span class="resumen-fin-proveedor-barra" style="width:${(f.rotacion / maximo) * 100}%"></span>
        </div>
        <span class="resumen-fin-proveedor-monto">${f.rotacion.toFixed(1)}×</span>
      </li>`
      )
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

  function cerrarDetalleGrafica() {
    if (els.resumenFinDetalleOverlay.hidden) return;
    if (detalleGraficaOrigen) {
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
  // funciona dentro de la ventana emergente (gancho:
  // .resumen-fin-detalle-contenido-grande, la misma clase que
  // abrirDetalleGrafica() ya le pone al contenedor movido). En la
  // tarjeta chica un clic no hace nada, la leyenda se queda informativa
  // como siempre.
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
        // Fuera de la ventana emergente, la leyenda es solo informativa.
        if (!li.closest('.resumen-fin-detalle-contenido-grande')) return;
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

  document.querySelectorAll('.resumen-fin-expandir-btn').forEach((boton) => {
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
        els.gastosError.textContent = 'No se pudieron cargar los gastos.';
        return;
      }
      const data = await res.json();
      gastosActuales = data.gastos || [];
      gastosResumenActual = data.resumen || null;
      gastosTotalActual = data.total;
      await renderizarGastosConPendientes();
    } catch (err) {
      els.gastosError.textContent = 'No se pudo conectar con el servidor.';
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

  async function cargarCxc() {
    // Reusa ordenesCache si ya se cargó Ventas, si no la carga
    if (!ordenesCache || ordenesCache.length === 0) {
      await cargarOrdenes();
    }
    renderCxc();
  }

  function aplicarFiltrosCxc(lista) {
    const q = (els.cxcFiltroCliente ? els.cxcFiltroCliente.value.trim().toLowerCase() : '');
    const fVto = els.cxcFiltroVencimiento ? els.cxcFiltroVencimiento.value : '';
    return lista.filter((o) => {
      const esPendiente = (o.estado_pago || 'pagada') === 'pendiente';
      const coincideVista = cxcVista === 'pendientes' ? esPendiente : !esPendiente;
      if (!coincideVista) return false;
      if (q) {
        const hay = (o.numero_compra && o.numero_compra.toLowerCase().includes(q)) || (o.email && o.email.toLowerCase().includes(q)) || (o.concepto && o.concepto.toLowerCase().includes(q));
        if (!hay) return false;
      }
      if (fVto === 'vencidas' && !esVencida(o)) return false;
      if (fVto === 'por_vencer' && (esVencida(o) || !o.fecha_vencimiento)) return false;
      if (fVto === 'sin_fecha' && o.fecha_vencimiento) return false;
      return true;
    });
  }

  function renderCxc() {
    if (!els.cxcTableBody) return;
    const todas = ordenesCache || [];
    const pendientes = todas.filter((o) => (o.estado_pago || 'pagada') === 'pendiente');
    const cobradas = todas.filter((o) => (o.estado_pago || 'pagada') !== 'pendiente');
    // KPIs
    const porCobrar = pendientes.reduce((s, o) => s + (Number(o.total) - Number(o.monto_cobrado || 0)), 0);
    const vencidas = pendientes.filter(esVencida).length;
    const porVencer = pendientes.length - vencidas;
    const mesActual = new Date().toISOString().slice(0, 7);
    const cobradoMes = cobradas.filter((o) => o.fecha_cobro && String(o.fecha_cobro).slice(0, 7) === mesActual).reduce((s, o) => s + Number(o.monto_cobrado || o.total), 0);
    if (els.cxcKpiPorCobrar) els.cxcKpiPorCobrar.textContent = `$${formatearMoneda(porCobrar)}`;
    if (els.cxcKpiVencidas) els.cxcKpiVencidas.textContent = String(vencidas);
    if (els.cxcKpiPorVencer) els.cxcKpiPorVencer.textContent = String(porVencer);
    if (els.cxcKpiCobradoMes) els.cxcKpiCobradoMes.textContent = `$${formatearMoneda(cobradoMes)}`;
    if (els.cxcCount) els.cxcCount.textContent = cxcVista === 'pendientes' ? `${pendientes.length} por cobrar` : `${cobradas.length} cobradas`;
    // Filtros
    const filtradas = aplicarFiltrosCxc(todas);
    els.cxcTableBody.innerHTML = '';
    filtradas.forEach((orden) => {
      const saldo = Math.round((Number(orden.total) - Number(orden.monto_cobrado || 0)) * 100) / 100;
      const vencida = esVencida(orden);
      const estadoBadge = (orden.estado_pago === 'pendiente') ? (vencida ? '<span class="estatus-badge estatus-cancelado">Vencida</span>' : '<span class="estatus-badge estatus-pendiente">Pendiente</span>') : '<span class="estatus-badge estatus-listo">Pagada</span>';
      const vencimientoTxt = orden.fecha_vencimiento ? escapeHtml(orden.fecha_vencimiento) : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td data-label="No. Venta" data-col="numero">${escapeHtml(orden.numero_compra || '—')}</td><td data-label="Cliente" data-col="cliente">${escapeHtml(orden.email || 'Sin correo')}</td><td data-label="Total" data-col="total">$${formatearMoneda(orden.total)}</td><td data-label="Cobrado" data-col="cobrado">$${formatearMoneda(orden.monto_cobrado || 0)}</td><td data-label="Saldo" data-col="saldo"><strong>$${formatearMoneda(saldo)}</strong></td><td data-label="Vencimiento" data-col="vencimiento">${vencimientoTxt}</td><td data-label="Estado" data-col="estado">${estadoBadge}</td><td data-label=""></td>`;
      const tdAcciones = tr.lastElementChild;
      const wrap = document.createElement('div');
      wrap.className = 'admin-row-actions admin-row-actions-iconos';
      const btnVer = document.createElement('button'); btnVer.type='button'; btnVer.className='btn-icono-accion'; btnVer.setAttribute('data-tooltip','Ver venta'); btnVer.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'; btnVer.addEventListener('click', ()=>abrirOrdenModal(orden)); wrap.appendChild(btnVer);
      if ((orden.estado_pago || 'pagada') === 'pendiente') {
        const btnCobro = document.createElement('button'); btnCobro.type='button'; btnCobro.className='btn-icono-accion'; btnCobro.setAttribute('data-tooltip','Registrar cobro'); btnCobro.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>'; btnCobro.addEventListener('click', ()=>abrirCobroModal(orden)); wrap.appendChild(btnCobro);
      }
      const btnNotif = document.createElement('button'); btnNotif.type='button'; btnNotif.className='btn-icono-accion'; btnNotif.setAttribute('data-tooltip','Copiar recordatorio'); btnNotif.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M22 6l-10 7L2 6"/></svg>'; btnNotif.addEventListener('click', ()=>{ const txt=`Recordatorio: venta ${orden.numero_compra} por $${formatearMoneda(orden.total)} — saldo $${formatearMoneda(saldo)}${orden.fecha_vencimiento ? ' — vence '+orden.fecha_vencimiento : ''}.`; navigator.clipboard.writeText(txt); showToast('Recordatorio copiado'); }); wrap.appendChild(btnNotif);
      tdAcciones.appendChild(wrap);
      els.cxcTableBody.appendChild(tr);
    });
    if (els.cxcEmpty) els.cxcEmpty.hidden = filtradas.length > 0 || todas.length > 0;
    if (els.cxcFiltroEmpty) els.cxcFiltroEmpty.hidden = !(filtradas.length === 0 && todas.length > 0);
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
  let vistaInventarios = 'activos'; // 'activos' | 'papelera'
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
  }

  // Punto 186 (cierra el punto 182): con el switch encendido, todo lo que
  // solo aplica a inventario FÍSICO se oculta (7 tarjetas de Inicio + los
  // 2 bloques de producto en "Estado del inventario" + alta manual/carga
  // masiva de producto) — lo que aplica a servicio queda como única
  // opción visible. Las 2 tarjetas de servicio (Inicio) NO llevan la
  // clase inv-kpi-solo-producto: se quedan visibles siempre, con o sin el
  // switch, igual que ya hacía "Servicios activos" desde el punto 179.
  function aplicarVisibilidadSoloServicios(activo) {
    soloServiciosGlobalmente = activo;
    document.querySelectorAll('.inv-kpi-solo-producto').forEach((el) => { el.hidden = activo; });
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
        els.invActivoAutoguardado.textContent = 'Guardado ✓';
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
        els.invSoloServiciosAutoguardado.textContent = 'Guardado ✓';
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
      <button type="button" class="btn-icon gastos-categoria-renombrar" data-id="${c.id}" aria-label="Renombrar ${escapeHtml(c.nombre)}">✏️</button>
      ${c.tieneProductos ? '' : `<button type="button" class="btn-icon gastos-categoria-borrar" data-id="${c.id}" aria-label="Eliminar ${escapeHtml(c.nombre)}">🗑️</button>`}
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

  // Punto 179: un servicio solo admite la unidad "Hora" — se filtra el
  // desplegable a esa única opción cuando el toggle de tipo está en
  // "Servicio"; producto sigue viendo el catálogo completo.
  function renderOpcionesUnidadInv() {
    if (!els.invModalUnidad) return;
    const lista = inventarioModalTipoSeleccionado === 'servicio'
      ? unidadesInventarioActuales.filter((u) => u.nombre === 'Hora')
      : unidadesInventarioActuales;
    const valorActual = els.invModalUnidad.value;
    els.invModalUnidad.innerHTML = lista
      .map((u) => `<option value="${u.id}">${escapeHtml(u.nombre)} (${escapeHtml(u.abreviatura)})</option>`)
      .join('');
    const sigueDisponible = lista.some((u) => String(u.id) === valorActual);
    els.invModalUnidad.value = sigueDisponible ? valorActual : lista[0] ? String(lista[0].id) : '';
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
    try {
      const res = await fetch(`${API_BASE}/admin/inventarios/dashboard`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return;
      const d = await res.json();
      els.invKpiValor.textContent = `$${formatearMoneda(d.valor_total_inventario)}`;
      els.invKpiActivos.textContent = String(d.productos_activos);
      els.invKpiServicios.textContent = String(d.servicios_activos);
      if (els.invKpiServiciosSinVentas) els.invKpiServiciosSinVentas.textContent = String(d.servicios_sin_ventas_90d);
      els.invKpiUnidades.textContent = formatearCantidadInv(d.unidades_disponibles);
      els.invKpiBajoMinimo.textContent = String(d.productos_bajo_minimo);
      els.invKpiSinExistencia.textContent = String(d.productos_sin_existencia);
      els.invKpiSinMovimiento.textContent = String(d.productos_sin_movimiento);
      els.invKpiMermas.textContent = `$${formatearMoneda(d.mermas_periodo_valor)}`;
      els.invKpiMermasCantidad.textContent = `${d.mermas_periodo_cantidad} movimiento${d.mermas_periodo_cantidad === 1 ? '' : 's'} este mes`;
    } catch (err) {
      // Silencioso — las tarjetas se quedan con el último valor mostrado.
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
    try {
      const params = new URLSearchParams();
      if (vistaInventarios === 'papelera') params.set('papelera', 'true');
      if (els.invFiltroCategoria.value) params.set('categoria_id', els.invFiltroCategoria.value);
      if (els.invFiltroEstado.value) params.set('estado', els.invFiltroEstado.value);
      if (els.invFiltroTipo.value) params.set('tipo', els.invFiltroTipo.value);
      if (els.invBusqueda.value.trim()) params.set('busqueda', els.invBusqueda.value.trim());
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
        els.invError.textContent = 'El módulo de Inventarios no está activo para esta empresa.';
        return;
      }
      if (!res.ok) {
        els.invError.textContent = 'No se pudieron cargar los productos.';
        return;
      }
      const data = await res.json();
      productosInventarioActuales = data.productos || [];
      renderInvTabla(productosInventarioActuales, data.total);
    } catch (err) {
      els.invError.textContent = 'No se pudo conectar con el servidor.';
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
    els.invProductosCount.textContent = `${cuenta} producto${cuenta === 1 ? '' : 's'}`;
    els.invEmpty.hidden = productos.length > 0;
    els.invEmpty.textContent = esPapelera
      ? 'La papelera de Inventarios está vacía.'
      : 'No hay productos que coincidan con la búsqueda.';

    els.invTableBody.innerHTML = '';
    productos.forEach((p) => {
      const esServicio = p.tipo === 'servicio';
      const estadoBadgeClase = p.estado === 'activo' ? 'estatus-listo' : p.estado === 'archivado' ? 'estatus-rechazado' : 'estatus-proceso';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="" class="inv-imagen-celda">${p.imagen_thumb_url ? '<img class="inv-thumb" alt="" />' : '<span class="inv-thumb inv-thumb-vacia" aria-hidden="true"></span>'}</td>
        <td data-label="SKU" data-col="sku"><strong>${escapeHtml(p.sku)}</strong></td>
        <td data-label="Nombre" data-col="nombre">
          <button type="button" class="gasto-concepto-link inv-producto-link">${escapeHtml(p.nombre)}</button>${esServicio ? ' <span class="estatus-badge estatus-proceso">Servicio</span>' : ''}
        </td>
        <td data-label="Categoría" data-col="categoria">${escapeHtml(nombreCategoriaInv(p.categoria_id))}</td>
        <td data-label="Unidad" data-col="unidad">${escapeHtml(abreviaturaUnidadInv(p.unidad_id))}</td>
        <td data-label="Disponible" data-col="disponible" class="col-num">${esServicio ? '—' : formatearCantidadInv(p.disponible || 0)}</td>
        <td data-label="Costo prom." data-col="costo" class="col-num">$${formatearMoneda(p.costo_promedio)}</td>
        <td data-label="Precio" data-col="precio" class="col-num">${p.precio === null ? '—' : '$' + formatearMoneda(p.precio)}</td>
        <td data-label="Estado" data-col="estado"><span class="estatus-badge ${estadoBadgeClase}">${escapeHtml(p.estado)}</span></td>
        <td data-label=""></td>
      `;
      tr.querySelector('.inv-producto-link').addEventListener('click', () => abrirProductoModal(p));
      if (p.imagen_thumb_url) cargarImagenAutenticada(tr.querySelector('img.inv-thumb'), p.imagen_thumb_url);

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
    els.btnVerInvActivos.classList.toggle('is-active', !esPapelera);
    els.btnVerInvActivos.setAttribute('aria-selected', String(!esPapelera));
    els.btnVerInvPapelera.classList.toggle('is-active', esPapelera);
    els.btnVerInvPapelera.classList.toggle('is-danger-context', esPapelera);
    els.btnVerInvPapelera.setAttribute('aria-selected', String(esPapelera));
    els.btnNuevoProducto.hidden = esPapelera;
    document.getElementById('inv-kpis-wrap').hidden = esPapelera;
    document.getElementById('inv-filtros').hidden = esPapelera;
    cargarInventarios();
  }

  function limpiarFiltrosInv() {
    els.invFiltroCategoria.value = '';
    els.invFiltroEstado.value = '';
    els.invFiltroTipo.value = '';
    els.invBusqueda.value = '';
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
    // máximos/punto de reorden de existencia — se ocultan (quedan NA en
    // la base de datos) y la unidad de medida se restringe a "Hora".
    const esServicio = tipo === 'servicio';
    colapsarCampoInv(els.invModalCodigoBarrasField, esServicio, animar);
    colapsarCampoInv(els.invModalStockMinimoField, esServicio, animar);
    colapsarCampoInv(els.invModalStockMaximoField, esServicio, animar);
    colapsarCampoInv(els.invModalPuntoReordenField, esServicio, animar);
    els.invModalUnidadHintServicio.hidden = !esServicio;
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
    els.invModalMoneda.value = producto ? producto.moneda || 'MXN' : 'MXN';
    els.invModalCosto.value = producto && producto.costo !== null ? String(producto.costo) : '';
    els.invModalPrecio.value = producto && producto.precio !== null ? String(producto.precio) : '';
    els.invModalStockMinimo.value = producto && producto.stock_minimo !== null ? String(producto.stock_minimo) : '';
    els.invModalStockMaximo.value = producto && producto.stock_maximo !== null ? String(producto.stock_maximo) : '';
    els.invModalPuntoReorden.value = producto && producto.punto_reorden !== null ? String(producto.punto_reorden) : '';
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
      mensaje: `¿Eliminar "${nombre}" para siempre? Esta acción no se puede deshacer. Si el producto tiene movimientos registrados, no se podrá eliminar (§38).`,
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
  // Manual completo de /admin — mismo shell que "Configuraciones globales"
  // (config-modal-sidebar/main reusados tal cual) pero con contenido propio
  // aquí, 100% frontend, cero endpoint nuevo (mismo criterio que
  // AYUDA_VISTAS). Acceso desde un ícono fijo en el sidebar, NUNCA dentro
  // de Configuraciones globales — el perfil "Ventas" no tiene esa vista
  // (RESTRICCIONES_PERFIL más arriba), así que un manual completo ahí
  // habría quedado inalcanzable para ese perfil.
  const CONOCIMIENTO_CATEGORIAS = {
    'primeros-pasos': {
      titulo: 'Primeros pasos',
      lead: 'Lo mínimo para dejar el panel operando el primer día.',
      pasos: [
        { t: 'Completa tus datos fiscales', d: 'Configuraciones globales → Configuraciones fiscales. Sin esto, tickets y facturas no se pueden generar.' },
        { t: 'Da de alta a tu equipo', d: 'Usuarios → Crear usuario. Elige el perfil correcto (Administrador, Fiscal o Ventas) según lo que esa persona necesite hacer — cada perfil ve solo sus secciones.' },
        { t: 'Revisa el checklist de Inicio', d: 'Aparece solo ahí hasta que completes sus 3-4 pasos según tu perfil — te va guiando, no hace falta memorizar nada.' },
        { t: 'Vuelve aquí cuando lo necesites', d: 'Este manual queda siempre a un clic, en el ícono de libro junto a "Cerrar sesión" — en cualquier vista, con cualquier perfil.' },
        { t: 'Repite el recorrido guiado', d: 'La primera vez que entraste, un recorrido con globos señaló las partes clave del panel para tu perfil — si quieres volver a verlo, aquí mismo. Solo disponible en escritorio.', accion: 'reiniciar-tour', textoAccion: 'Ver el recorrido de nuevo' },
      ],
    },
    inicio: {
      titulo: 'Inicio',
      lead: 'Estado general de los tickets — perfiles Fiscal y Administrador.',
      pasos: [
        { t: 'Qué muestra', d: 'Estadísticas y una dona de tickets por estatus (pendiente, en curso, listo, cancelado) — la foto del día.' },
        { t: 'Checklist "Primeros pasos"', d: 'Se muestra solo mientras te falten pasos por completar — desaparece solo cuando terminas.' },
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
        { t: 'Retención automática', d: 'Los tickets se borran solos después de los días configurados en Configuraciones globales — es a propósito, no es un error si uno desaparece.' },
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
        { t: 'Categorías editables', d: 'Desde el mismo modal, ícono "✏️ Categorías" — renombra, crea nuevas o desactiva las que no uses. "Otro" nunca se puede borrar.' },
        { t: 'Adjuntar comprobante', d: 'PDF o ZIP opcional, se guarda junto al gasto y se puede descargar o quitar después.' },
        { t: 'Papelera', d: 'Un gasto eliminado va a la papelera — se puede restaurar o borrar en definitivo desde ahí.' },
      ],
    },
    inventarios: {
      titulo: 'Inventarios',
      lead: 'Productos, servicios y existencias — módulo opcional.',
      pasos: [
        { t: 'Actívalo primero', d: 'Configuraciones globales → interruptor "Inventario activo". Antes de eso, la sección permanece oculta para todos los perfiles.' },
        { t: 'Dar de alta un producto o servicio', d: 'Botón "Nuevo producto/servicio" — un servicio pide solo 10 de los 14 campos (sin stock ni código de barras) y su unidad siempre es "Hora".' },
        { t: 'Registrar entradas y salidas', d: 'Menú "⋮" de cada fila — cada movimiento queda en el historial permanente, nunca editable una vez guardado.' },
        { t: 'Importar catálogo', d: 'Botón "Importar catálogo" → sube un CSV/XLSX → el sistema detecta las columnas solo, con vista previa antes de confirmar. Solo para productos, no servicios.' },
        { t: 'Código de barras con la cámara', d: 'En Ventas o al dar de alta un producto, el ícono de cámara escanea el código y llena el campo solo.' },
        { t: 'Imprimir etiqueta de código de barras', d: 'Menú "⋮" de cada fila → "Imprimir etiqueta" — elige térmica (rollo, 40×30mm) o carta (24 por hoja), cuántas copias, y listo. Se genera solo a partir del código de barras del producto (o su SKU si no tiene uno capturado), sin necesidad de escribirlo a mano.' },
        { t: '"Solamente servicios"', d: 'Si tu negocio no maneja stock físico, actívalo en Configuraciones — oculta todo lo relacionado a productos y existencias.' },
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
      titulo: 'Configuraciones globales',
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
    };
    return mapa[perfilActual] || null;
  }

  function contenedorOnboarding() {
    if (perfilActual === 'fiscal') return els.vistaInicio;
    if (perfilActual === 'administrador') return els.vistaResumenFinanciero;
    if (perfilActual === 'ventas') return els.vistaOrdenes;
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
      // Verifica que la sesión guardada siga siendo válida.
      fetch(`${API_BASE}/admin/login`, { headers: { Authorization: authHeader } })
        .then((res) => {
          if (res.ok) {
            return res.json().then((data) => {
              showDashboard(data.usuario, data.perfil);
              if (data.perfil !== 'administrador') {
                cargarRegistros();
              }
              // Refresh de una sesión ya activa (no un login nuevo, ese
              // caso ya fuerza "inicio" en su propio submit): restaura la
              // última vista que se traía abierta en esta pestaña, solo
              // si sigue siendo una vista permitida para este perfil —
              // aplicarRestriccionesPerfil() (dentro de showDashboard) ya
              // ocultó el botón de cualquier vista no permitida.
              const botonesPorVista = {
                inicio: els.btnVistaInicio,
                constancias: els.btnVistaConstancias,
                tickets: els.btnVistaTickets,
                'resumen-financiero': els.btnVistaResumenFinanciero,
                ordenes: els.btnVistaOrdenes,
                cxc: els.btnVistaCxc,
                gastos: els.btnVistaGastos,
                inventarios: els.btnVistaInventarios,
                usuarios: els.btnVistaUsuarios,
                'lectura-reportes': els.btnVistaLecturaReportes,
              };
              const vistaGuardada = obtenerVistaGuardada();
              const botonGuardado = vistaGuardada && botonesPorVista[vistaGuardada];
              if (botonGuardado && !botonGuardado.hidden && !botonGuardado.classList.contains('is-active')) {
                cambiarVistaPrincipal(vistaGuardada);
              }
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
