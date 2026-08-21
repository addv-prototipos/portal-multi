(() => {
  'use strict';

  // Multi-tenant (segmento 4, ver PROJECT_STATE.md): misma detección que
  // frontend/portal.js — admin.html no lo carga (panel independiente del
  // portal de cliente), así que se repite aquí, siguiendo el mismo patrón
  // de duplicación ya usado para API_BASE en este proyecto. Debe
  // coincidir exactamente con la detección de portal.js/login.js y con
  // las rutas de frontend/nginx.conf.
  const RUTAS_PAGINA_MULTITENANT = ['admin', 'dashboard', 'tickets', 'login', 'csf'];

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
    btnLogout: document.getElementById('btn-logout'),
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
    smtpCuerpoCliente: document.getElementById('smtp-cuerpo-cliente'),
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
    vistaInicio: document.getElementById('vista-inicio'),
    vistaConstancias: document.getElementById('vista-constancias'),
    vistaTickets: document.getElementById('vista-tickets'),
    vistaResumenFinanciero: document.getElementById('vista-resumen-financiero'),
    vistaOrdenes: document.getElementById('vista-ordenes'),
    vistaGastos: document.getElementById('vista-gastos'),
    vistaUsuarios: document.getElementById('vista-usuarios'),
    vistaConfiguraciones: document.getElementById('vista-configuraciones'),
    vistaLecturaReportes: document.getElementById('vista-lectura-reportes'),
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
    // Ventas
    ordenesCount: document.getElementById('ordenes-count'),
    ordenesTableWrap: document.getElementById('ordenes-table-wrap'),
    btnOrdenesColumns: document.getElementById('btn-ordenes-columns'),
    ordenesColumnTogglePanel: document.getElementById('ordenes-column-toggle-panel'),
    btnRefreshOrdenes: document.getElementById('btn-refresh-ordenes'),
    ordenFechaAuto: document.getElementById('orden-fecha-auto'),
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
    ordenIvaInfo: document.getElementById('orden-iva-info'),
    ordenTotalPreview: document.getElementById('orden-total-preview'),
    ordenEmail: document.getElementById('orden-email'),
    ordenDatosCliente: document.getElementById('orden-datos-cliente'),
    ordenRfcInfo: document.getElementById('orden-rfc-info'),
    ordenNombreInfo: document.getElementById('orden-nombre-info'),
    // Toggle "Cliente ya registrado" / "Cliente nuevo" de la venta
    btnOrdenClienteRegistrado: document.getElementById('btn-orden-cliente-registrado'),
    btnOrdenClienteNuevo: document.getElementById('btn-orden-cliente-nuevo'),
    ordenEmailRegistradoWrap: document.getElementById('orden-email-registrado-wrap'),
    ordenEmailNuevoWrap: document.getElementById('orden-email-nuevo-wrap'),
    ordenEmailNuevo: document.getElementById('orden-email-nuevo'),
    ordenErrorGeneral: document.getElementById('orden-error-general'),
    btnRegistrarOrden: document.getElementById('btn-registrar-orden'),
    btnRegistrarOrdenLabel: document.getElementById('btn-registrar-orden-label'),
    ordenesError: document.getElementById('ordenes-error'),
    ordenesTableBody: document.getElementById('ordenes-table-body'),
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
    // Modal de registro/edición de gasto
    gastosModalOverlay: document.getElementById('gastos-modal-overlay'),
    gastosModalTitle: document.getElementById('gastos-modal-title'),
    gastosModalFecha: document.getElementById('gastos-modal-fecha'),
    gastosModalConcepto: document.getElementById('gastos-modal-concepto'),
    gastosModalConceptoContador: document.getElementById('gastos-modal-concepto-contador'),
    gastosModalProveedor: document.getElementById('gastos-modal-proveedor'),
    gastosModalCategoria: document.getElementById('gastos-modal-categoria'),
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
    btnToggleOrdenForm: document.getElementById('btn-toggle-orden-form'),
    ordenFormBody: document.getElementById('orden-form-body'),
    globalConfigBody: document.getElementById('global-config-body'),
    configIva: document.getElementById('config-iva'),
    configZonaHoraria: document.getElementById('config-zona-horaria'),
    configOrdenesHabilitado: document.getElementById('config-ordenes-habilitado'),
    ordenesHabilitadoAutoguardado: document.getElementById('ordenes-habilitado-autoguardado'),
    configClaveSat: document.getElementById('config-clave-sat'),
    constanciaCompaniaInput: document.getElementById('constancia-compania-input'),
    btnSubirConstanciaCompania: document.getElementById('btn-subir-constancia-compania'),
    btnSubirConstanciaCompaniaLabel: document.getElementById('btn-subir-constancia-compania-label'),
    errorConstanciaCompania: document.getElementById('error-constancia-compania'),
    regimenFiscalCompaniaBox: document.getElementById('regimen-fiscal-compania-box'),
    razonSocialCompaniaBox: document.getElementById('razon-social-compania-box'),
    configLinkCodigosSat: document.getElementById('config-link-codigos-sat'),
    linkCodigosSatVista: document.getElementById('link-codigos-sat-vista'),
    linkCodigosSatHref: document.getElementById('link-codigos-sat-href'),
    btnEditarLinkCodigosSat: document.getElementById('btn-editar-link-codigos-sat'),
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
    btnEnviarReporteManual: document.getElementById('btn-enviar-reporte-manual'),
    btnEnviarReporteManualLabel: document.getElementById('btn-enviar-reporte-manual-label'),
    errorEnviarReporteManual: document.getElementById('error-enviar-reporte-manual'),
    // Lectura de reportes
    reportesSelector: document.getElementById('reportes-selector'),
    btnEliminarReporte: document.getElementById('btn-eliminar-reporte'),
    btnVerMdReporte: document.getElementById('btn-ver-md-reporte'),
    lecturaReportesResumen: document.getElementById('lectura-reportes-resumen'),
    resumenReporteTipo: document.getElementById('resumen-reporte-tipo'),
    resumenReporteFecha: document.getElementById('resumen-reporte-fecha'),
    resumenReporteTickets: document.getElementById('resumen-reporte-tickets'),
    resumenReporteOrdenes: document.getElementById('resumen-reporte-ordenes'),
    resumenReporteCorreo: document.getElementById('resumen-reporte-correo'),
    lecturaReportesFiltros: document.getElementById('lectura-reportes-filtros'),
    filtroReporteTipo: document.getElementById('filtro-reporte-tipo'),
    filtroReporteEstatus: document.getElementById('filtro-reporte-estatus'),
    filtroReporteRfc: document.getElementById('filtro-reporte-rfc'),
    filtroReporteFechaDesde: document.getElementById('filtro-reporte-fecha-desde'),
    filtroReporteFechaHasta: document.getElementById('filtro-reporte-fecha-hasta'),
    btnLimpiarFiltrosReporte: document.getElementById('btn-limpiar-filtros-reporte'),
    btnExportarCsv: document.getElementById('btn-exportar-csv'),
    btnExportarExcel: document.getElementById('btn-exportar-excel'),
    lecturaReportesTablaWrap: document.getElementById('lectura-reportes-tabla-wrap'),
    reportesItemsTableBody: document.getElementById('reportes-items-table-body'),
    reportesItemsEmpty: document.getElementById('reportes-items-empty'),
    lecturaReportesSinSeleccion: document.getElementById('lectura-reportes-sin-seleccion'),
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
    usuariosEmpty: document.getElementById('usuarios-empty'),
    // Cuenta de respaldo "admin"
    btnToggleAdminFallback: document.getElementById('btn-toggle-admin-fallback'),
    adminFallbackCard: document.getElementById('admin-fallback-card'),
    adminFallbackBody: document.getElementById('admin-fallback-body'),
    perfilesAccesoCard: document.getElementById('perfiles-acceso-card'),
    btnTogglePerfilesAcceso: document.getElementById('btn-toggle-perfiles-acceso'),
    perfilesAccesoBody: document.getElementById('perfiles-acceso-body'),
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
  };

  inicializarTooltips();

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

  // Categorías de gasto — lista cerrada, mapea el slug (lo que guarda la
  // base de datos) a la etiqueta que se muestra en la interfaz.
  const CATEGORIAS_GASTOS = {
    renta: 'Renta',
    nomina: 'Nómina',
    software: 'Software',
    hosting: 'Hosting y dominio',
    servicios: 'Servicios',
    papeleria: 'Papelería',
    combustible: 'Combustible',
    viaticos: 'Viáticos',
    publicidad: 'Publicidad',
    otro: 'Otro',
  };

  // Guarda todos los registros cargados del servidor para poder filtrarlos
  // en el cliente sin volver a pedirlos cada vez que el usuario escribe.
  const state = {
    registros: [],
    vista: 'activos', // 'activos' | 'papelera' (constancias)
    vistaTickets: 'activos', // 'activos' | 'papelera' (tickets) — estado separado, es otra tabla
    vistaGastos: 'activos', // 'activos' | 'papelera' (gastos) — estado separado, es otra tabla
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

  function setSession(username, password) {
    const encoded = btoa(unescape(encodeURIComponent(`${username}:${password}`)));
    sessionStorage.setItem(SESSION_KEY, encoded);
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
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
  // Si "Ventas" está deshabilitada globalmente (interruptor "Habilitar
  // Ventas" en Configuraciones) — combinado con la restricción de perfil
  // dentro de aplicarRestriccionesPerfil() para que ninguna de las dos
  // condiciones pueda pisar a la otra (ver aplicarVisibilidadOrdenesCompra).
  let ventasHabilitadaGlobalmente = true;

  const RESTRICCIONES_PERFIL = {
    administrador: {
      vistasPermitidas: ['resumen-financiero', 'ordenes', 'gastos', 'usuarios', 'lectura-reportes', 'configuraciones'],
      tarjetasConfigPermitidas: ['global-config-card', 'reportes-config-card'],
    },
    fiscal: {
      vistasPermitidas: ['inicio', 'constancias', 'tickets', 'configuraciones'],
      tarjetasConfigPermitidas: ['admin-config-card', 'global-config-card'],
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
      gastos: els.btnVistaGastos,
      usuarios: els.btnVistaUsuarios,
      configuraciones: els.btnVistaConfiguraciones,
      'lectura-reportes': els.btnVistaLecturaReportes,
    };
    Object.entries(navPorVista).forEach(([vista, boton]) => {
      const permitidaPorPerfil = sinRestricciones || restriccion.vistasPermitidas.includes(vista);
      const permitidaPorConfig = vista !== 'ordenes' || ventasHabilitadaGlobalmente;
      boton.hidden = !(permitidaPorPerfil && permitidaPorConfig);
    });

    // Las 4 tarjetas de "Configuraciones globales".
    ['admin-config-card', 'global-config-card', 'smtp-config-card', 'reportes-config-card'].forEach((idTarjeta) => {
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
    if (els.perfilesAccesoCard) els.perfilesAccesoCard.hidden = !esUsuarioAdminExacto;

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

  els.btnLogout.addEventListener('click', () => {
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

  // ---------- Configuración global (IVA y zona horaria) ----------

  els.btnToggleGlobalConfig.addEventListener('click', () => {
    const abierto = els.btnToggleGlobalConfig.getAttribute('aria-expanded') === 'true';
    els.btnToggleGlobalConfig.setAttribute('aria-expanded', String(!abierto));
    els.globalConfigBody.hidden = abierto;
  });

  // "Registrar venta" empieza expandido (es la acción
  // principal de esa pantalla), pero se puede colapsar — sobre todo útil
  // en celular, donde el formulario completo ocupa mucho espacio antes
  // de poder ver la lista de abajo. La preferencia se recuerda entre
  // sesiones con localStorage, mismo criterio ya usado para columnas
  // visibles/anchos de las tablas.
  const CLAVE_ORDEN_FORM_EXPANDIDO = 'admin_orden_form_expandido';
  try {
    const preferenciaGuardada = localStorage.getItem(CLAVE_ORDEN_FORM_EXPANDIDO);
    if (preferenciaGuardada === 'false') {
      els.btnToggleOrdenForm.setAttribute('aria-expanded', 'false');
      els.ordenFormBody.hidden = true;
    }
  } catch (err) {
    // Sin localStorage disponible (modo privado, etc.), se queda expandido por defecto.
  }
  els.btnToggleOrdenForm.addEventListener('click', () => {
    const abierto = els.btnToggleOrdenForm.getAttribute('aria-expanded') === 'true';
    els.btnToggleOrdenForm.setAttribute('aria-expanded', String(!abierto));
    els.ordenFormBody.hidden = abierto;
    try {
      localStorage.setItem(CLAVE_ORDEN_FORM_EXPANDIDO, String(!abierto));
    } catch (err) {
      // Sin localStorage disponible, simplemente no se recuerda la próxima vez.
    }
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

  // Alterna entre mostrar el link de códigos SAT como hipervínculo
  // (modo vista, con botón "Editar") o como campo de texto (modo
  // edición). Sin ningún valor guardado, no hay nada que mostrar como
  // enlace — se deja directamente el campo de texto visible.
  function aplicarVistaLinkCodigosSat(link) {
    if (link) {
      els.linkCodigosSatHref.href = link;
      els.linkCodigosSatHref.textContent = link;
      els.linkCodigosSatVista.hidden = false;
      els.configLinkCodigosSat.hidden = true;
    } else {
      els.linkCodigosSatVista.hidden = true;
      els.configLinkCodigosSat.hidden = false;
    }
  }

  els.btnEditarLinkCodigosSat.addEventListener('click', () => {
    els.linkCodigosSatVista.hidden = true;
    els.configLinkCodigosSat.hidden = false;
    els.configLinkCodigosSat.focus();
  });

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

  // Ventana emergente al iniciar sesión si falta el RFC de la compañía
  // y/o el Código SAT — ver dónde se llama (solo con
  // { verificarFiscalFaltante: true }, no en cada apertura de la
  // tarjeta de configuración).
  function verificarDatosFiscalesFaltantes(config) {
    const faltaRfc = !(config.rfc_compania || '').trim();
    const faltaClaveSat = !(config.clave_sat || '').trim();
    if (faltaRfc || faltaClaveSat) {
      els.configFiscalFaltanteOverlay.hidden = false;
    }
  }

  els.btnConfigFiscalFaltanteCerrar.addEventListener('click', () => {
    els.configFiscalFaltanteOverlay.hidden = true;
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
      els.configClaveSat.value = config.clave_sat || '';
      els.configLinkCodigosSat.value = config.link_codigos_sat || '';
      aplicarVistaLinkCodigosSat(config.link_codigos_sat);
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
    setFieldError('config-link-codigos-sat', '');

    const iva = Number(els.configIva.value);
    if (!Number.isFinite(iva) || iva < 0 || iva > 100) {
      setFieldError('config-iva', 'El IVA debe ser un número entre 0 y 100.');
      return;
    }

    // El RFC de la compañía y el régimen fiscal ya NO se validan/mandan
    // aquí — se leen automáticamente de la constancia (ver el botón
    // "Subir constancia de situación fiscal" más arriba). Este botón
    // "Guardar cambios" solo sigue siendo responsable de IVA, zona
    // horaria, el interruptor de Ventas, la Clave SAT y el link.
    const claveSat = els.configClaveSat.value.trim();
    if (claveSat && !/^\d{8}$/.test(claveSat)) {
      setFieldError('config-clave-sat', 'La Clave SAT debe ser exactamente 8 dígitos.');
      return;
    }
    const linkCodigosSat = els.configLinkCodigosSat.value.trim();
    if (linkCodigosSat && !/^https?:\/\/.+/i.test(linkCodigosSat)) {
      setFieldError('config-link-codigos-sat', 'Captura una URL válida (debe empezar con http:// o https://).');
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
          link_codigos_sat: linkCodigosSat,
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
      aplicarVistaLinkCodigosSat(linkCodigosSat);
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

      els.reportesSelector.innerHTML = '<option value="">Selecciona un reporte…</option>';
      reportesDisponibles.forEach((r) => {
        const option = document.createElement('option');
        option.value = r.id;
        const tipoTexto = r.tipo === 'automatico' ? 'Automático' : 'Manual';
        option.textContent = `${formatearFechaCorta(r.fecha_generacion)} — ${tipoTexto} (${r.total_tickets} tickets, ${r.total_ordenes} ventas)`;
        els.reportesSelector.appendChild(option);
      });
    } catch (err) {
      // El selector se queda vacío; se puede reintentar cambiando de vista.
    }
  }

  function limpiarVistaLecturaReportes() {
    els.lecturaReportesResumen.hidden = true;
    els.lecturaReportesFiltros.hidden = true;
    els.lecturaReportesTablaWrap.hidden = true;
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

  function renderReporteItems(items) {
    els.reportesItemsTableBody.innerHTML = '';
    els.reportesItemsEmpty.hidden = items.length > 0;
    els.lecturaReportesTablaWrap.hidden = false;

    items.forEach((item) => {
      // "Eliminado": el registro ya no existe (se borró por retención
      // automática, o a mano con el botón "Eliminar") — a diferencia de
      // un item que solo aparece en una fotografía manual ("Enviar
      // reporte"), que sigue existiendo tal cual. El tooltip explica la
      // diferencia al pasar el cursor, sin tener que adivinarla.
      const badgeEliminado =
        item.accion === 'eliminado'
          ? '<span class="estatus-badge estatus-cancelado reportes-badge-eliminado" data-tooltip="Este registro ya no existe: se eliminó de la base de datos. Esta es su información de respaldo, guardada justo antes de borrarse.">Eliminado</span>'
          : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Tipo">${item.tipo_registro === 'ticket' ? 'Ticket' : 'Ventas'}</td>
        <td data-label="Identificador"><strong>${escapeHtml(item.identificador)}</strong>${badgeEliminado}</td>
        <td data-label="RFC / Correo">${escapeHtml(item.rfc || '—')}</td>
        <td data-label="Estatus">${escapeHtml(item.estatus_o_concepto || '—')}</td>
        <td data-label="Monto">${item.monto === null ? '—' : `$${formatearMoneda(item.monto)}`}</td>
        <td data-label="Atendido por">${escapeHtml(item.atendido_por || '—')}</td>
        <td data-label="Fecha de registro">${formatearFechaCorta(item.fecha_registro)}</td>
      `;
      els.reportesItemsTableBody.appendChild(tr);
    });
  }

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
      els.resumenReporteTipo.textContent = reporte.tipo === 'automatico' ? 'Automático (antes de borrado)' : 'Manual';
      els.resumenReporteFecha.textContent = formatearFechaCorta(reporte.fecha_generacion);
      els.resumenReporteTickets.textContent = reporte.total_tickets;
      els.resumenReporteOrdenes.textContent = reporte.total_ordenes;
      els.resumenReporteCorreo.textContent = reporte.correo_enviado
        ? `Enviado a ${reporte.correo_enviado_a}`
        : 'No se envió por correo';
    }

    els.lecturaReportesResumen.hidden = false;
    els.lecturaReportesFiltros.hidden = false;
    els.lecturaReportesSinSeleccion.hidden = true;
    els.btnVerMdReporte.disabled = false;
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
  async function exportarReporte(formato) {
    if (!reporteSeleccionadoId) return;
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    try {
      const params = obtenerFiltrosReporteActuales();
      params.set('formato', formato);
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
      a.download = `reporte-${reporteSeleccionadoId}.${formato === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('No se pudo exportar el reporte.');
    }
  }
  els.btnExportarCsv.addEventListener('click', () => exportarReporte('csv'));
  els.btnExportarExcel.addEventListener('click', () => exportarReporte('excel'));

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

  els.btnToggleSmtpPassword.addEventListener('click', () => {
    const mostrando = els.smtpPassword.type === 'password';
    els.smtpPassword.type = mostrando ? 'text' : 'password';
    els.btnToggleSmtpPassword.setAttribute('aria-pressed', String(mostrando));
    els.btnToggleSmtpPassword.classList.toggle('is-visible', mostrando);
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
      els.smtpCuerpoCliente.value = data.cuerpo_cliente || '';
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
    const cuerpoCliente = els.smtpCuerpoCliente.value.trim();

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
          cuerpo_cliente: cuerpoCliente,
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

  // ---------- Tooltip informativo (correo de quien va a facturar) ----------
  // En escritorio ya funciona con :hover/:focus-visible via CSS (definido
  // en style.css, que admin.html también carga); esto solo agrega soporte
  // de "tocar para mostrar/ocultar" en celular, donde no existe hover.

  const tooltipCorreoContador = document.getElementById('tooltip-correo-contador');
  if (tooltipCorreoContador) {
    tooltipCorreoContador.addEventListener('click', (e) => {
      e.stopPropagation();
      tooltipCorreoContador.classList.toggle('is-active');
    });
    document.addEventListener('click', () => {
      tooltipCorreoContador.classList.remove('is-active');
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
      els.retencionInfoOrdenes.textContent = formatearInfoUltimaLimpieza(data.ultimaLimpiezaOrdenes, 'ventas');
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

  // ---------- Vista Constancias / Tickets / Usuarios ----------

  function cambiarVistaPrincipal(vista) {
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
    els.btnVistaGastos.classList.toggle('is-active', vista === 'gastos');
    els.btnVistaGastos.setAttribute('aria-selected', String(vista === 'gastos'));
    els.btnVistaUsuarios.classList.toggle('is-active', vista === 'usuarios');
    els.btnVistaUsuarios.setAttribute('aria-selected', String(vista === 'usuarios'));
    els.btnVistaConfiguraciones.classList.toggle('is-active', vista === 'configuraciones');
    els.btnVistaConfiguraciones.setAttribute('aria-selected', String(vista === 'configuraciones'));
    els.btnVistaLecturaReportes.classList.toggle('is-active', vista === 'lectura-reportes');
    els.btnVistaLecturaReportes.setAttribute('aria-selected', String(vista === 'lectura-reportes'));
    els.vistaInicio.hidden = vista !== 'inicio';
    els.vistaConstancias.hidden = vista !== 'constancias';
    els.vistaTickets.hidden = vista !== 'tickets';
    els.vistaResumenFinanciero.hidden = vista !== 'resumen-financiero';
    els.vistaOrdenes.hidden = vista !== 'ordenes';
    els.vistaGastos.hidden = vista !== 'gastos';
    els.vistaUsuarios.hidden = vista !== 'usuarios';
    els.vistaConfiguraciones.hidden = vista !== 'configuraciones';
    els.vistaLecturaReportes.hidden = vista !== 'lectura-reportes';
    if (vista === 'inicio') cargarInicio();
    if (vista === 'constancias') cargarRegistros();
    if (vista === 'tickets') {
      cargarUsuariosFiltroTickets();
      cargarTickets();
    }
    if (vista === 'ordenes') {
      cargarConfigGlobalParaOrden();
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
    if (vista === 'resumen-financiero') cargarResumenFinanciero();
    if (vista === 'gastos') cargarGastos();
    if (vista === 'usuarios') cargarUsuarios();
    if (vista === 'configuraciones') {
      cargarConfigCampos();
      cargarInfoUsoCfdi();
      cargarConfigGlobal();
      // "Configuración Reportes" ahora vive como una tarjeta más dentro
      // de "Configuraciones globales" (junto a "Correo electrónico"),
      // así que se carga al mismo tiempo que el resto de esta vista.
      cargarConfigReportes();
    }
    if (vista === 'lectura-reportes') cargarListaReportes();
  }

  els.btnVistaInicio.addEventListener('click', () => cambiarVistaPrincipal('inicio'));
  els.btnVistaConstancias.addEventListener('click', () => cambiarVistaPrincipal('constancias'));
  els.btnVistaTickets.addEventListener('click', () => cambiarVistaPrincipal('tickets'));
  els.btnVistaResumenFinanciero.addEventListener('click', () => cambiarVistaPrincipal('resumen-financiero'));
  els.btnVistaOrdenes.addEventListener('click', () => cambiarVistaPrincipal('ordenes'));
  els.btnVistaGastos.addEventListener('click', () => cambiarVistaPrincipal('gastos'));
  els.btnVistaUsuarios.addEventListener('click', () => cambiarVistaPrincipal('usuarios'));
  els.btnVistaConfiguraciones.addEventListener('click', () => cambiarVistaPrincipal('configuraciones'));
  els.btnVistaLecturaReportes.addEventListener('click', () => cambiarVistaPrincipal('lectura-reportes'));
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
    recientes.forEach((t) => {
      const info = ESTATUS_INFO[t.estatus] || { texto: t.estatus, clase: '' };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Folio"><strong>${escapeHtml(t.folio)}</strong></td>
        <td data-label="Cliente (RFC)">${escapeHtml(t.rfc)}</td>
        <td data-label="Fecha de solicitud">${formatFecha(t.creado_en)}</td>
        <td data-label="Estatus"><span class="estatus-badge ${info.clase}">${escapeHtml(info.texto)}</span></td>
        <td data-label=""><button type="button" class="btn-ver">Gestionar</button></td>
      `;
      tr.querySelector('.btn-ver').addEventListener('click', () => abrirTicketModal(t));
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
        <td data-label="Folio"><strong>${escapeHtml(t.folio)}</strong></td>
        <td data-label="RFC">${escapeHtml(t.rfc)}</td>
        <td data-label="Uso de CFDI">${escapeHtml(t.uso_cfdi || '—')}</td>
        <td data-label="Ticket">${escapeHtml(t.imagen_nombre_original)}</td>
        <td data-label="Estatus"><span class="estatus-badge ${info.clase}">${escapeHtml(info.texto)}</span></td>
        <td data-label="Asignado a">${t.actualizado_por ? escapeHtml(t.actualizado_por) : '—'}</td>
        <td data-label="Notas">${tieneNota ? '<button type="button" class="btn-nota-icono" data-tooltip="Ver nota interna" aria-label="Ver nota interna"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M7 3h8l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M15 3v5h5M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>' : '—'}</td>
        <td data-label="Actualizado">${formatFecha(t.actualizado_en)}${actualizadoPorTexto}</td>
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

    const formData = new FormData();
    formData.append('factura', archivo);

    setSubiendoFacturaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/${ticketActual.id}/factura`, {
        method: 'POST',
        headers: { Authorization: authHeader },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
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

  function actualizarTotalPreviewOrden() {
    const cantidad = obtenerValorNumerico(els.ordenCantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      els.ordenTotalPreview.textContent = '$0.00 MXN';
      return;
    }
    const total = Math.round(cantidad * (1 + ivaActualParaOrden / 100) * 100) / 100;
    els.ordenTotalPreview.textContent = `$${formatearMoneda(total)} MXN`;
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
    productosOrdenActual.forEach((producto, indice) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(producto.concepto)}</td>
        <td>$${formatearMoneda(producto.precio)}</td>
        <td>${producto.cantidad}</td>
        <td>$${formatearMoneda(subtotalProductoOrden(producto))}</td>
        <td><button type="button" class="btn-quitar-producto-orden" aria-label="Quitar ${escapeHtml(producto.concepto)}">✕</button></td>
      `;
      tr.querySelector('.btn-quitar-producto-orden').addEventListener('click', () => {
        productosOrdenActual.splice(indice, 1);
        recalcularOrdenDesdeProductos();
      });
      els.ordenProductosListaBody.appendChild(tr);
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
    els.ordenErrorGeneral.textContent = '';
    setFieldError('orden-concepto', '');
    setFieldError('orden-cantidad', '');
    setFieldError('orden-email', '');
    setFieldError('orden-email-nuevo', '');
    actualizarDatosClienteOrden();
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

    const concepto = els.ordenConcepto.value.trim();
    const cantidad = obtenerValorNumerico(els.ordenCantidad);
    const email = ordenModoClienteNuevo
      ? els.ordenEmailNuevo.value.trim().toLowerCase()
      : els.ordenEmail.value;

    let valido = true;
    if (!concepto) {
      setFieldError('orden-concepto', 'El concepto de venta o servicio es obligatorio.');
      valido = false;
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setFieldError('orden-cantidad', 'Captura una cantidad mayor a cero.');
      valido = false;
    }
    if (ordenModoClienteNuevo) {
      if (!email || !els.ordenEmailNuevo.checkValidity()) {
        setFieldError('orden-email-nuevo', 'Captura un correo electrónico válido.');
        valido = false;
      }
    } else if (!email) {
      setFieldError('orden-email', 'Selecciona un correo electrónico.');
      valido = false;
    }
    if (!valido) return;

    setRegistrarOrdenLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/ordenes-compra`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ concepto, cantidad, email, es_cliente_nuevo: ordenModoClienteNuevo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.ordenErrorGeneral.textContent = data.error || 'No se pudo registrar la venta.';
        return;
      }
      showToast(`Venta ${data.numero_compra} registrada correctamente. Se envió la confirmación a ${email}.`);
      limpiarFormularioOrden();
      cargarOrdenes();
    } catch (err) {
      els.ordenErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setRegistrarOrdenLoading(false);
    }
  });

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

    els.ordenesError.textContent = '';
    try {
      const res = await fetch(`${API_BASE}/admin/ordenes-compra`, {
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
      renderOrdenes(data.ordenes || []);
    } catch (err) {
      els.ordenesError.textContent = 'No se pudo conectar con el servidor.';
    }
  }

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

  function renderOrdenes(ordenes) {
    els.ordenesCount.textContent = `${ordenes.length} venta${ordenes.length === 1 ? '' : 's'}`;
    els.ordenesTableBody.innerHTML = '';
    els.ordenesEmpty.hidden = ordenes.length > 0;

    ordenes.forEach((orden) => {
      // Fecha y hora en 2 líneas (antes iban juntas en una sola línea que
      // no cabía en el ancho de la columna y quedaba cortada a la mitad
      // entre filas) — mismo patrón ya usado en "Actualizado" (Tickets).
      const fechaCeldaHtml = orden.fecha_compra_formateada
        ? `<div>${escapeHtml(orden.fecha_compra_formateada.fecha)}</div><div class="admin-fecha-hora">${escapeHtml(orden.fecha_compra_formateada.hora)}</div>`
        : '—';
      const iconoFacturado = orden.facturado
        ? '<span class="orden-facturado-icono" data-tooltip="Venta facturada" aria-label="Venta facturada">✅</span>'
        : '';
      // Razón social asociada al correo, para el tooltip — se busca en
      // la misma caché ya cargada para el desplegable del formulario
      // (ver cargarCorreosRegistrados), no hace falta pedirla de nuevo.
      const registroDelCorreo = correosRegistradosCache.find((c) => c.email === orden.email);
      const tituloCorreo = registroDelCorreo && registroDelCorreo.nombre
        ? `Razón social: ${registroDelCorreo.nombre}`
        : 'Razón social no disponible';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="No. Venta" data-col="numero">${iconoFacturado}<button type="button" class="orden-numero-link">${escapeHtml(orden.numero_compra || '—')}</button></td>
        <td data-label="Fecha" data-col="fecha">${fechaCeldaHtml}</td>
        <td data-label="Concepto" data-col="concepto">${renderConceptoPreviewOrden(orden.concepto)}</td>
        <td data-label="Total" data-col="total"><strong>$${formatearMoneda(orden.total)}</strong></td>
        <td data-label="Correo" data-col="correo" class="orden-correo-con-tooltip" data-tooltip="${escapeHtml(tituloCorreo)}">${escapeHtml(orden.email)}</td>
        <td data-label=""></td>
      `;

      tr.querySelector('.orden-numero-link').addEventListener('click', () => abrirOrdenModal(orden));

      const celdaAccionesOrden = tr.lastElementChild;
      const contenedorAccionesOrden = document.createElement('div');
      contenedorAccionesOrden.className = 'admin-row-actions admin-row-actions-iconos';

      const btnReenviar = document.createElement('button');
      btnReenviar.type = 'button';
      btnReenviar.className = 'btn-icono-accion';
      btnReenviar.setAttribute('data-tooltip', 'Reenviar correo de confirmación');
      btnReenviar.setAttribute('aria-label', 'Reenviar correo de confirmación');
      btnReenviar.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m3.5 6 8.5 7 8.5-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btnReenviar.addEventListener('click', () => reenviarCorreoOrden(orden.id, orden.numero_compra, orden.email, btnReenviar));
      contenedorAccionesOrden.appendChild(btnReenviar);

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
    els.ordenModalCorreo.textContent = orden.email;

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
    reenviarCorreoOrden(ordenModalActual.id, ordenModalActual.numero_compra, ordenModalActual.email, els.btnOrdenModalReenviar);
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

  async function reenviarCorreoOrden(id, numeroCompra, email, boton) {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    boton.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/admin/ordenes-compra/${id}/reenviar-correo`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || `No se pudo reenviar el correo de ${numeroCompra}.`, true);
        return;
      }
      showToast(`Correo de ${numeroCompra} reenviado a ${email}.`);
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', true);
    } finally {
      boton.disabled = false;
    }
  }

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
        <td data-label="RFC / usuario"><strong>${escapeHtml(u.rfc)}</strong>${pendienteCambio ? ' <span class="estatus-badge estatus-pendiente" data-tooltip="Debe cambiar su contraseña en el siguiente inicio de sesión">Cambio pendiente</span>' : ''}</td>
        <td data-label="Perfil"><span class="perfil-badge ${perfilInfo.clase}">${escapeHtml(perfilInfo.texto)}</span></td>
        <td data-label="Contacto">${contactoHtml}</td>
        <td data-label="Registrado">${formatFecha(u.creado_en)}</td>
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

  els.btnTogglePerfilesAcceso.addEventListener('click', () => {
    const abierto = els.btnTogglePerfilesAcceso.getAttribute('aria-expanded') === 'true';
    els.btnTogglePerfilesAcceso.setAttribute('aria-expanded', String(!abierto));
    els.perfilesAccesoBody.hidden = abierto;
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
    return CATEGORIAS_GASTOS[slug] || slug || '—';
  }

  // Llena los dos desplegables de categorías (filtro de la tabla y
  // selector del modal) con la lista cerrada definida arriba, sin pisar
  // la selección que el usuario ya tenga hecha en el filtro.
  function llenarSelectsCategoriaGasto() {
    const opciones = Object.entries(CATEGORIAS_GASTOS)
      .map(([slug, etiqueta]) => `<option value="${slug}">${escapeHtml(etiqueta)}</option>`)
      .join('');
    const seleccionFiltro = els.gastosFiltroCategoria.value;
    els.gastosFiltroCategoria.innerHTML = `<option value="">Todas</option>${opciones}`;
    els.gastosFiltroCategoria.value = seleccionFiltro;
    els.gastosModalCategoria.innerHTML = opciones;
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
      const columna = document.createElement('div');
      columna.className = 'resumen-fin-chart-columna';
      columna.innerHTML = `
        <div class="resumen-fin-chart-barras" role="img" aria-label="${escapeHtml(m.mes)}: ventas $${formatearMoneda(m.ventas)}, facturado $${formatearMoneda(m.facturado)}, gastos $${formatearMoneda(m.gastos)}">
          <span class="resumen-fin-chart-barra resumen-fin-chart-barra-ventas" style="height:${(m.ventas / maximo) * 100}%" title="Ventas: $${formatearMoneda(m.ventas)}"></span>
          <span class="resumen-fin-chart-barra resumen-fin-chart-barra-facturado" style="height:${(m.facturado / maximo) * 100}%" title="Facturado: $${formatearMoneda(m.facturado)}"></span>
          <span class="resumen-fin-chart-barra resumen-fin-chart-barra-gastos" style="height:${(m.gastos / maximo) * 100}%" title="Gastos: $${formatearMoneda(m.gastos)}"></span>
        </div>
        <span class="resumen-fin-chart-etiqueta">${escapeHtml(m.mes)}</span>
      `;
      els.resumenFinChartBody.appendChild(columna);
    });

    renderResumenFinBalanceAcumulado(serie);
    renderResumenFinProyeccion(serie, data.proyeccion_ventas);
    renderResumenFinGastosCategoria(data.gastos_por_categoria || []);
    renderResumenFinFacturacion(mes);
    renderResumenFinProveedores(data.top_proveedores || []);
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

  // Balance acumulado (Facturado − Gastos, mes a mes, sumado sobre la
  // serie) — muestra si la tendencia del negocio es positiva o negativa
  // en el tiempo, no solo el corte del mes actual.
  function renderResumenFinBalanceAcumulado(serie) {
    const svg = els.resumenFinBalanceSvg;
    svg.innerHTML = '';
    els.resumenFinBalanceEtiquetas.innerHTML = '';
    if (serie.length === 0) {
      els.resumenFinBalanceEmpty.hidden = false;
      return;
    }
    els.resumenFinBalanceEmpty.hidden = true;

    let acumulado = 0;
    const valores = serie.map((m) => (acumulado += m.facturado - m.gastos));
    const { puntos, yCero } = construirPuntosLinea(valores);

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
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(p.x));
      circle.setAttribute('cy', String(p.y));
      circle.setAttribute('r', '3.5');
      circle.setAttribute('class', 'resumen-fin-linea-punto resumen-fin-linea-punto-balance');
      const titulo = document.createElementNS(SVG_NS, 'title');
      titulo.textContent = `${serie[i].mes}: $${formatearMoneda(valores[i])}`;
      circle.appendChild(titulo);
      svg.appendChild(circle);
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
    const { puntos } = construirPuntosLinea(valores);

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
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(p.x));
      circle.setAttribute('cy', String(p.y));
      circle.setAttribute('r', '3.5');
      circle.setAttribute(
        'class',
        `resumen-fin-linea-punto ${esProyectado ? 'resumen-fin-linea-punto-proyeccion' : 'resumen-fin-linea-punto-ventas'}`
      );
      const titulo = document.createElementNS(SVG_NS, 'title');
      titulo.textContent = `${meses[i]}${esProyectado ? ' (proyectado)' : ''}: $${formatearMoneda(valores[i])}`;
      circle.appendChild(titulo);
      svg.appendChild(circle);
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
        <span class="resumen-fin-proveedor-nombre" title="${escapeHtml(f.proveedor)}">${escapeHtml(f.proveedor)}</span>
        <div class="resumen-fin-proveedor-barra-wrap">
          <span class="resumen-fin-proveedor-barra" style="width:${(f.monto / maximo) * 100}%"></span>
        </div>
        <span class="resumen-fin-proveedor-monto">$${formatearMoneda(f.monto)}</span>
      </li>`
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

  async function cargarGastos() {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      showLogin();
      return;
    }

    els.gastosError.textContent = '';
    try {
      const params = new URLSearchParams();
      if (state.vistaGastos === 'papelera') params.set('papelera', 'true');
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
      renderGastos(gastosActuales, data.resumen || null, data.total);
    } catch (err) {
      els.gastosError.textContent = 'No se pudo conectar con el servidor.';
    }
  }

  function renderGastos(gastos, resumen, total) {
    const esPapelera = state.vistaGastos === 'papelera';
    const cuenta = Number.isFinite(total) ? total : gastos.length;
    els.gastosResumenWrap.hidden = esPapelera;
    els.gastosCount.textContent = `${cuenta} gasto${cuenta === 1 ? '' : 's'}`;
    els.gastosEmpty.hidden = gastos.length > 0;
    els.gastosEmpty.textContent = esPapelera
      ? 'La papelera de gastos está vacía.'
      : 'No hay gastos que coincidan con la búsqueda.';

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

    cargarGastos();
  }

  function limpiarFiltrosGastos() {
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
  els.gastosFiltroCategoria.addEventListener('change', cargarGastos);
  els.gastosFiltroFactura.addEventListener('change', cargarGastos);
  els.gastosFiltroRecurrente.addEventListener('change', cargarGastos);
  els.gastosFiltroDesde.addEventListener('change', cargarGastos);
  els.gastosFiltroHasta.addEventListener('change', cargarGastos);
  els.gastosBusqueda.addEventListener('input', debounce(() => cargarGastos(), 350));
  els.gastosModalConcepto.addEventListener('input', () => {
    els.gastosModalConceptoContador.textContent = `${els.gastosModalConcepto.value.length} / 200`;
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

  // ---------- Inicialización ----------

  (function init() {
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
