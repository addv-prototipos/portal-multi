/* Kerberos — tablero de monitoreo con datos reales del servidor.
   Archivo aparte y no <script> inline a propósito: la CSP de
   kerberos/server.js declara scriptSrc: ["'self'"] SIN 'unsafe-inline',
   así que un script embebido en el HTML quedaría bloqueado por el
   navegador sin ningún error visible en la página.

   Vista 100% de solo lectura: no existe ninguna acción que detenga,
   reinicie o elimine un contenedor — ni deshabilitada. Lo único
   interactivo es abrir la bitácora de un contenedor. */
(function () {
  'use strict';

  var Sesion = window.KerberosSesion;

  // Sin token no hay nada que mostrar: se sale antes de pintar o pedir
  // cualquier cosa.
  if (!Sesion || !Sesion.getToken()) {
    window.location.replace('/kerberos/login.html');
    return;
  }

  var MS_ENTRE_POLLS = 6000;
  var MAX_PUNTOS_SERIE = 30;
  var LINEAS_LOG = 200;

  var els = {
    kpis: document.getElementById('kpis'),
    charts: document.getElementById('charts'),
    listaSalud: document.getElementById('lista-salud'),
    estadoGeneralTop: document.getElementById('estado-general-top'),
    estadoGeneralTexto: document.getElementById('estado-general-texto'),
    tbody: document.getElementById('tbody-contenedores'),
    ctrSummary: document.getElementById('ctr-summary'),
    ctrConteo: document.getElementById('contenedores-conteo'),
    hintServicios: document.getElementById('hint-servicios'),
    statusChip: document.getElementById('status-chip'),
    statusTexto: document.getElementById('status-texto'),
    usuarioChip: document.getElementById('usuario-chip'),
    btnSalir: document.getElementById('btn-salir'),
    avisoResumen: document.getElementById('aviso-resumen'),
    avisoResumenTexto: document.getElementById('aviso-resumen-texto'),
    avisoSalud: document.getElementById('aviso-salud'),
    avisoSaludTexto: document.getElementById('aviso-salud-texto'),
    avisoContenedores: document.getElementById('aviso-contenedores'),
    avisoContenedoresTexto: document.getElementById('aviso-contenedores-texto'),
    mapWrap: document.getElementById('map-wrap'),
    mapSvg: document.getElementById('map-svg'),
    modalOverlay: document.getElementById('modal-logs-overlay'),
    modalTitulo: document.getElementById('modal-logs-titulo'),
    modalSub: document.getElementById('modal-logs-sub'),
    modalBody: document.getElementById('modal-logs-body'),
    btnCerrarLogs: document.getElementById('btn-cerrar-logs'),
  };

  var estado = {
    memHostTotalMb: null,
    latenciaPromedio: null,
    serie: [],
    firmaContenedores: '',
    timer: null,
    filaConFoco: null,
  };

  // ---------- Utilidades ----------

  function escaparHtml(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function esNumero(valor) {
    return typeof valor === 'number' && isFinite(valor);
  }

  // Un dato no disponible se muestra como raya, nunca como 0 ni como un
  // valor de relleno (el backend manda null a propósito cuando Docker no
  // pudo reportar la métrica, p. ej. en un contenedor detenido).
  function fmtPct(valor) {
    return esNumero(valor) ? valor.toFixed(1) + '%' : '—';
  }

  function fmtMb(valor) {
    if (!esNumero(valor)) return '—';
    if (valor >= 1024) return (valor / 1024).toFixed(1) + ' GB';
    return Math.round(valor) + ' MB';
  }

  function fmtEntero(valor) {
    return esNumero(valor) ? String(valor) : '—';
  }

  function horaCorta(fecha) {
    return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function mostrarAviso(caja, texto, mensaje) {
    texto.textContent = mensaje;
    caja.hidden = false;
  }

  function ocultarAviso(caja) {
    caja.hidden = true;
  }

  function cerrarSesionPorExpiracion() {
    Sesion.limpiarSesion();
    window.location.replace('/kerberos/login.html');
  }

  // ---------- Resumen (KPIs) ----------

  function tarjetaKpi(etiqueta, numero, sub, clase) {
    return '<div class="card kpi">' +
      '<div class="l">' + escaparHtml(etiqueta) + '</div>' +
      '<div class="n tabular' + (clase ? ' ' + clase : '') + '">' + escaparHtml(numero) + '</div>' +
      '<div class="sub">' + escaparHtml(sub) + '</div>' +
      '</div>';
  }

  function pintarResumen(resumen) {
    var checks = Array.isArray(resumen.healthChecks) ? resumen.healthChecks : [];
    var disponibles = checks.filter(function (c) { return c.disponible; }).length;

    var memTotalTexto = esNumero(resumen.memHostTotalMb)
      ? (resumen.memHostTotalMb / 1024).toFixed(1) + ' GB'
      : '—';

    var claseProblema = resumen.contenedoresConProblema > 0 ? 'es-crit' : 'es-ok';
    var claseServicios = checks.length === 0
      ? ''
      : (disponibles === checks.length ? 'es-ok' : 'es-crit');

    els.kpis.innerHTML =
      tarjetaKpi('En ejecución', fmtEntero(resumen.contenedoresCorriendo),
        'de ' + fmtEntero(resumen.contenedoresTotal) + ' contenedores', 'es-ok') +
      tarjetaKpi('Detenidos', fmtEntero(resumen.contenedoresDetenidos),
        'sin ejecutarse en este momento') +
      tarjetaKpi('Con problema', fmtEntero(resumen.contenedoresConProblema),
        'healthcheck reportando falla', claseProblema) +
      tarjetaKpi('CPU del servidor', fmtEntero(resumen.cpuHostNucleos),
        'núcleos disponibles') +
      tarjetaKpi('Memoria del servidor', memTotalTexto,
        'capacidad total instalada') +
      tarjetaKpi('Servicios arriba',
        checks.length ? disponibles + ' de ' + checks.length : '—',
        'revisados en cada actualización', claseServicios);
  }

  // ---------- Rendimiento (gráficas canvas) ----------

  var GRAFICAS = [
    { clave: 'cpu', etiqueta: 'CPU de contenedores', color: '#3FC7E0', sufijo: '%' },
    { clave: 'mem', etiqueta: 'Memoria en uso', color: '#2FBE80', sufijo: '%' },
    { clave: 'lat', etiqueta: 'Latencia de servicios', color: '#E0A23F', sufijo: ' ms' },
  ];

  function construirGraficas() {
    els.charts.innerHTML = GRAFICAS.map(function (g) {
      return '<div class="card chart-card">' +
        '<div class="ch-head">' +
          '<span class="l">' + escaparHtml(g.etiqueta) + '</span>' +
          '<span class="n tabular" id="ch-valor-' + g.clave + '" style="color:' + g.color + '">—</span>' +
        '</div>' +
        '<canvas id="ch-cv-' + g.clave + '" role="img" aria-label="Tendencia de ' +
          escaparHtml(g.etiqueta.toLowerCase()) + '"></canvas>' +
        '<div class="ch-pie" id="ch-pie-' + g.clave + '">Acumulando lecturas...</div>' +
        '</div>';
    }).join('');
  }

  function dibujarSerie(canvasId, datos, color) {
    var cv = document.getElementById(canvasId);
    if (!cv) return;
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth;
    var h = cv.clientHeight;
    if (!w || !h) return;
    cv.width = w * dpr;
    cv.height = h * dpr;
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Rejilla de fondo: se dibuja siempre, incluso sin suficientes
    // lecturas, para que la tarjeta no se vea como un hueco vacío.
    ctx.strokeStyle = 'rgba(131,146,172,0.14)';
    ctx.lineWidth = 1;
    for (var g = 1; g < 3; g++) {
      var gy = (h / 3) * g;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
    if (datos.length < 2) return;

    var min = Math.min.apply(null, datos);
    var max = Math.max.apply(null, datos);
    var pad = (max - min) * 0.18 || 1;
    min -= pad;
    max += pad;
    var stepX = w / (datos.length - 1);
    function yFor(v) { return h - ((v - min) / (max - min)) * h; }

    ctx.beginPath();
    ctx.moveTo(0, yFor(datos[0]));
    datos.forEach(function (v, i) { ctx.lineTo(i * stepX, yFor(v)); });
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '4D');
    grad.addColorStop(1, color + '03');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, yFor(datos[0]));
    datos.forEach(function (v, i) { ctx.lineTo(i * stepX, yFor(v)); });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    var lastX = (datos.length - 1) * stepX;
    var lastY = yFor(datos[datos.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function pintarGraficas() {
    GRAFICAS.forEach(function (g) {
      var datos = estado.serie
        .map(function (punto) { return punto[g.clave]; })
        .filter(esNumero);

      var elValor = document.getElementById('ch-valor-' + g.clave);
      var elPie = document.getElementById('ch-pie-' + g.clave);
      if (elValor) {
        elValor.textContent = datos.length
          ? datos[datos.length - 1].toFixed(1) + g.sufijo
          : '—';
      }
      if (elPie) {
        if (datos.length < 2) {
          elPie.textContent = 'Acumulando lecturas... (' + datos.length + ')';
        } else {
          var min = Math.min.apply(null, datos);
          var max = Math.max.apply(null, datos);
          elPie.textContent = datos.length + ' lecturas · mínimo ' + min.toFixed(1) +
            ' · máximo ' + max.toFixed(1);
        }
      }
      dibujarSerie('ch-cv-' + g.clave, datos, g.color);
    });
  }

  // ---------- Estado general + salud de los servicios ----------

  // El backend real de Kerberos solo conoce 3 procesos distintos
  // (backend/control/frontend, ver SERVICIOS_HEALTH en
  // kerberos/routes/metrics.js) — el panel de administración (/admin) Y
  // el portal de clientes se sirven del MISMO proceso "backend", así que
  // no hay (ni tendría sentido fabricar) un cuarto check separado para
  // "clientes": si "backend" está arriba, ambos lo están. La etiqueta
  // deja eso explícito en vez de fingir una separación que no existe.
  var NOMBRE_SERVICIO = {
    backend: 'Backend — admin y clientes',
    control: 'Control',
    frontend: 'Sitio (frontend)',
  };

  function pintarEstadoGeneral(checks) {
    if (!checks.length) {
      els.estadoGeneralTop.className = 'estado-general-top es-neutro';
      els.estadoGeneralTexto.textContent = 'Sin datos todavía';
      return;
    }
    var caidos = checks.filter(function (c) { return !c.disponible; });
    if (!caidos.length) {
      els.estadoGeneralTop.className = 'estado-general-top';
      els.estadoGeneralTexto.textContent = 'Operativo — control, admin y clientes respondiendo';
      return;
    }
    var nombresCaidos = caidos.map(function (c) { return NOMBRE_SERVICIO[c.nombre] || c.nombre; }).join(', ');
    var clase = caidos.length === checks.length ? 'es-crit' : 'es-warn';
    els.estadoGeneralTop.className = 'estado-general-top ' + clase;
    els.estadoGeneralTexto.textContent = (caidos.length === checks.length ? 'Caído — ' : 'Con problemas — ') + nombresCaidos;
  }

  function pintarSalud(checks) {
    pintarEstadoGeneral(checks);

    if (!checks.length) {
      els.listaSalud.innerHTML = '<p class="log-estado">No hay servicios configurados para revisar.</p>';
      return;
    }

    els.listaSalud.innerHTML = checks.map(function (c) {
      var clasePill = c.disponible ? 'pill-ok' : 'pill-crit';
      var textoPill = c.disponible ? 'Disponible' : 'Sin respuesta';
      var colorDot = c.disponible ? 'var(--ok)' : 'var(--crit)';
      var nombre = NOMBRE_SERVICIO[c.nombre] || c.nombre;

      var detalles = [];
      if (esNumero(c.statusCode)) detalles.push('HTTP ' + c.statusCode);
      if (esNumero(c.latenciaMs)) detalles.push(c.latenciaMs + ' ms');
      if (c.error) detalles.push(c.error);
      if (c.url) detalles.push(c.url);

      return '<div class="servicio">' +
        '<div class="servicio-top">' +
          '<span class="t"><span class="dot" style="background:' + colorDot + '" aria-hidden="true"></span>' +
            escaparHtml(nombre) + '</span>' +
          '<span class="pill ' + clasePill + '">' + textoPill + '</span>' +
        '</div>' +
        (detalles.length ? '<div class="d">' + escaparHtml(detalles.join(' · ')) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  // ---------- Contenedores ----------

  // Traduce el estado crudo de Docker a algo que un operador entienda sin
  // conocer la nomenclatura del motor. `salud` manda sobre `estado`: un
  // contenedor corriendo pero con healthcheck en unhealthy es un problema,
  // no un "en ejecución" normal.
  function describirEstado(contenedor) {
    if (contenedor.salud === 'unhealthy') {
      return { texto: 'Con problema', color: 'var(--crit)' };
    }
    if (contenedor.salud === 'starting') {
      return { texto: 'Iniciando', color: 'var(--warn)' };
    }
    switch (contenedor.estado) {
      case 'running': return { texto: 'En ejecución', color: 'var(--ok)' };
      case 'restarting': return { texto: 'Reiniciando', color: 'var(--warn)' };
      case 'paused': return { texto: 'En pausa', color: 'var(--warn)' };
      case 'removing': return { texto: 'Eliminándose', color: 'var(--warn)' };
      case 'exited': return { texto: 'Detenido', color: '#404C63' };
      case 'created': return { texto: 'Creado', color: '#404C63' };
      case 'dead': return { texto: 'Caído', color: 'var(--crit)' };
      default: return { texto: contenedor.estado || 'Desconocido', color: '#404C63' };
    }
  }

  var ICONO_BITACORA =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h11l5 5v11H4Z"/>' +
    '<path d="M8 13h8"/><path d="M8 17h5"/></svg>';

  function filaContenedor(c) {
    var est = describirEstado(c);
    var idCorto = (c.id || '').slice(0, 12);
    return '<tr tabindex="0" data-id="' + escaparHtml(c.id) + '" data-nombre="' + escaparHtml(c.nombre || idCorto) + '"' +
        ' aria-label="Ver bitácora de ' + escaparHtml(c.nombre || idCorto) + '">' +
      '<td><span class="dot" style="background:' + est.color + '" aria-hidden="true"></span></td>' +
      '<td class="name">' + escaparHtml(c.nombre || '—') + '</td>' +
      '<td class="id">' + escaparHtml(idCorto) + '</td>' +
      '<td class="img">' + escaparHtml(c.imagen || '—') + '</td>' +
      '<td class="tabular">' + fmtPct(c.cpuPct) + '</td>' +
      '<td class="tabular">' + fmtMb(c.memUsadaMb) + '</td>' +
      '<td><span class="ctr-estado">' + escaparHtml(est.texto) + '</span></td>' +
      '<td><span class="ctr-ver-logs">' + ICONO_BITACORA + 'Ver</span></td>' +
      '</tr>';
  }

  function pintarContenedores(contenedores) {
    els.ctrConteo.textContent = contenedores.length ? '— ' + contenedores.length : '';

    var cpuTotal = 0;
    var memTotal = 0;
    var hayCpu = false;
    var hayMem = false;
    contenedores.forEach(function (c) {
      if (esNumero(c.cpuPct)) { cpuTotal += c.cpuPct; hayCpu = true; }
      if (esNumero(c.memUsadaMb)) { memTotal += c.memUsadaMb; hayMem = true; }
    });

    var memHostTexto = esNumero(estado.memHostTotalMb)
      ? ' de ' + (estado.memHostTotalMb / 1024).toFixed(1) + ' GB'
      : '';

    els.ctrSummary.innerHTML =
      '<div class="item"><div class="l">CPU sumada de contenedores</div>' +
        '<div class="n tabular">' + (hayCpu ? cpuTotal.toFixed(1) + '%' : '—') + '</div></div>' +
      '<div class="item"><div class="l">Memoria sumada de contenedores</div>' +
        '<div class="n tabular">' + (hayMem ? fmtMb(memTotal) + memHostTexto : '—') + '</div></div>';

    // Solo se reconstruye el cuerpo de la tabla si de verdad cambió algo:
    // con polling cada 6 s, un innerHTML incondicional tiraría el foco del
    // teclado y el hover del operador en medio de una lectura.
    var firma = JSON.stringify(contenedores.map(function (c) {
      return [c.id, c.nombre, c.imagen, c.estado, c.salud, c.cpuPct, c.memUsadaMb];
    }));
    if (firma === estado.firmaContenedores) return;
    estado.firmaContenedores = firma;

    if (!contenedores.length) {
      els.tbody.innerHTML = '<tr class="es-vacio"><td class="vacio" colspan="8">' +
        'Docker no reportó ningún contenedor.</td></tr>';
      return;
    }

    // "Mejor orden" (pedido explícito del usuario, con captura): antes
    // el orden era el que Docker devolviera (sin criterio claro,
    // corriendo y detenido mezclados). Ahora: en ejecución primero (con
    // problema antes que sano dentro de ese grupo, es lo que de verdad
    // necesita atención), detenidos al final — alfabético como
    // desempate dentro de cada grupo.
    var filas = contenedores.slice().sort(function (a, b) {
      var aCorriendo = a.estado === 'running' ? 0 : 1;
      var bCorriendo = b.estado === 'running' ? 0 : 1;
      if (aCorriendo !== bCorriendo) return aCorriendo - bCorriendo;
      var aProblema = a.salud === 'unhealthy' ? 0 : 1;
      var bProblema = b.salud === 'unhealthy' ? 0 : 1;
      if (aProblema !== bProblema) return aProblema - bProblema;
      return String(a.nombre || '').localeCompare(String(b.nombre || ''));
    });

    els.tbody.innerHTML = filas.map(filaContenedor).join('');

    // Devuelve el foco a la misma fila si el operador estaba navegando con
    // teclado cuando llegó la actualización.
    if (estado.filaConFoco) {
      var filas = els.tbody.querySelectorAll('tr[data-id]');
      for (var i = 0; i < filas.length; i++) {
        if (filas[i].getAttribute('data-id') === estado.filaConFoco) {
          filas[i].focus();
          break;
        }
      }
    }
  }

  function vaciarContenedores() {
    estado.firmaContenedores = '';
    els.tbody.innerHTML = '<tr class="es-vacio"><td class="vacio" colspan="8">' +
      'Sin datos de contenedores por ahora.</td></tr>';
    els.ctrSummary.innerHTML = '';
    els.ctrConteo.textContent = '';
  }

  // ---------- Bitácoras ----------

  var elementoPrevioAlModal = null;

  function pintarLineasLog(lineas) {
    if (!lineas.length) {
      els.modalBody.innerHTML = '<p class="log-estado">Este contenedor no tiene nada escrito en su bitácora.</p>';
      return;
    }
    els.modalBody.innerHTML = lineas.map(function (l) {
      var clases = 'log-linea nivel-' + (l.nivel || 'info') +
        (l.canal === 'stderr' ? ' es-stderr' : '');
      return '<div class="' + clases + '">' +
        '<span class="ts">' + escaparHtml(l.timestamp || '') + '</span>' +
        '<span class="tx">' + escaparHtml(l.texto || '') + '</span>' +
        '</div>';
    }).join('');
    els.modalBody.scrollTop = els.modalBody.scrollHeight;
  }

  function abrirLogs(id, nombre) {
    elementoPrevioAlModal = document.activeElement;
    els.modalTitulo.textContent = 'Bitácora de ' + (nombre || id);
    els.modalSub.textContent = 'Últimas ' + LINEAS_LOG + ' líneas · ' + id;
    els.modalBody.innerHTML = '<p class="log-estado">Cargando bitácora...</p>';
    els.modalOverlay.hidden = false;
    els.btnCerrarLogs.focus();

    Sesion.pedir('/containers/' + encodeURIComponent(id) + '/logs?lines=' + LINEAS_LOG)
      .then(function (cuerpo) {
        pintarLineasLog(Array.isArray(cuerpo.lineas) ? cuerpo.lineas : []);
      })
      .catch(function (err) {
        if (err instanceof Sesion.ErrorSesion) {
          cerrarSesionPorExpiracion();
          return;
        }
        els.modalBody.innerHTML = '<p class="log-estado">No se pudo leer la bitácora de este contenedor. ' +
          escaparHtml(err.message || '') + '</p>';
      });
  }

  function cerrarLogs() {
    els.modalOverlay.hidden = true;
    els.modalBody.innerHTML = '';
    if (elementoPrevioAlModal && typeof elementoPrevioAlModal.focus === 'function') {
      elementoPrevioAlModal.focus();
    }
    elementoPrevioAlModal = null;
  }

  // La delegación va por .closest() y nunca por e.target: una fila puede
  // ganar hijos (íconos, badges) y un check sobre e.target directo dejaría
  // de reconocer el clic (mismo gotcha ya documentado del proyecto).
  els.tbody.addEventListener('click', function (e) {
    var fila = e.target.closest('tr[data-id]');
    if (!fila) return;
    abrirLogs(fila.getAttribute('data-id'), fila.getAttribute('data-nombre'));
  });

  els.tbody.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var fila = e.target.closest('tr[data-id]');
    if (!fila) return;
    e.preventDefault();
    abrirLogs(fila.getAttribute('data-id'), fila.getAttribute('data-nombre'));
  });

  els.tbody.addEventListener('focusin', function (e) {
    var fila = e.target.closest('tr[data-id]');
    estado.filaConFoco = fila ? fila.getAttribute('data-id') : null;
  });

  els.btnCerrarLogs.addEventListener('click', cerrarLogs);
  els.modalOverlay.addEventListener('click', function (e) {
    if (e.target === els.modalOverlay) cerrarLogs();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !els.modalOverlay.hidden) cerrarLogs();
  });

  // ---------- Mapa de arquitectura (topología fija del stack) ----------

  // Es topología, no telemetría: los nodos y sus textos son hechos
  // estáticos del stack (quién llama a quién, en qué puerto), no valores
  // en vivo — por eso no se piden al backend ni se refrescan.
  // Se nombran por SERVICIO (docker-compose.yml), no por contenedor: el
  // prefijo real cambia según el entorno (clrv-* en Compose local,
  // clarvo_* en Swarm), el nombre del servicio no.
  var NODOS_MAPA = [
    { id: 'nginx', n: 'nginx (host)', r: 'entrada HTTPS · certbot', met: 'puertos 80 / 443', col: 1, row: 0 },
    { id: 'frontend', n: 'frontend', r: 'nginx en contenedor', met: 'estático · reenvía /api/*', col: 1, row: 1 },
    { id: 'backend', n: 'backend', r: 'API de tenant y /admin', met: 'puerto interno 4000', col: 0, row: 2 },
    { id: 'control', n: 'control', r: 'API cross-tenant (/control)', met: 'puerto interno 4001', col: 2, row: 2 },
    { id: 'primary', n: 'mysql', r: 'bases de cada tenant', met: 'tenant_* · portal_facturacion', col: 0, row: 3 },
    { id: 'garage', n: 'garage', r: 'almacenamiento S3', met: 'puertos 3900 / 3903', col: 1, row: 3 },
    { id: 'mcontrol', n: 'mysql-control', r: 'base de /control', met: 'control_tenants', col: 2, row: 3 },
  ];
  var ARISTAS_MAPA = [
    { a: 'nginx', b: 'frontend' },
    { a: 'frontend', b: 'backend' },
    { a: 'frontend', b: 'control' },
    { a: 'backend', b: 'primary' },
    { a: 'backend', b: 'garage' },
    { a: 'control', b: 'garage' },
    { a: 'control', b: 'mcontrol' },
  ];

  var ICONO_NODO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2 8 4-16 2 8h6"/></svg>';
  var ANCHO_COL = 320;
  var ALTO_FILA = 150;
  var ANCHO_NODO = 186;

  function construirMapa() {
    NODOS_MAPA.forEach(function (n) {
      var div = document.createElement('div');
      div.className = 'map-node';
      div.id = 'node-' + n.id;
      div.style.left = (n.col * ANCHO_COL) + 'px';
      div.style.top = (n.row * ALTO_FILA) + 'px';
      div.innerHTML = '<div class="n">' + ICONO_NODO + escaparHtml(n.n) + '</div>' +
        '<div class="r">' + escaparHtml(n.r) + '</div>' +
        '<div class="met">' + escaparHtml(n.met) + '</div>';
      els.mapWrap.appendChild(div);
    });
    var maxFila = Math.max.apply(null, NODOS_MAPA.map(function (n) { return n.row; }));
    var maxCol = Math.max.apply(null, NODOS_MAPA.map(function (n) { return n.col; }));
    els.mapWrap.style.height = ((maxFila + 1) * ALTO_FILA + 70) + 'px';
    els.mapWrap.style.width = ((maxCol + 1) * ANCHO_COL - (ANCHO_COL - ANCHO_NODO)) + 'px';
  }

  // Mide posiciones REALES del DOM (no asume altura fija de tarjeta) y
  // dibuja cada flecha desde el borde inferior real del nodo origen hasta
  // el borde superior real del destino.
  function dibujarFlechas() {
    var rectWrap = els.mapWrap.getBoundingClientRect();
    var paths = ARISTAS_MAPA.map(function (e) {
      var elA = document.getElementById('node-' + e.a);
      var elB = document.getElementById('node-' + e.b);
      if (!elA || !elB) return '';
      var ra = elA.getBoundingClientRect();
      var rb = elB.getBoundingClientRect();
      var x1 = ra.left + ra.width / 2 - rectWrap.left;
      var y1 = ra.bottom - rectWrap.top;
      var x2 = rb.left + rb.width / 2 - rectWrap.left;
      var y2 = rb.top - rectWrap.top;
      var midY = (y1 + y2) / 2;
      return '<path class="edge" d="M' + x1 + ',' + y1 + ' C' + x1 + ',' + midY +
        ' ' + x2 + ',' + midY + ' ' + x2 + ',' + y2 + '"/>';
    }).join('');

    els.mapSvg.innerHTML = '<defs><marker id="map-arrow" markerWidth="9" markerHeight="9" ' +
      'refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#35455F"/></marker></defs>' + paths;
  }

  // ---------- Carga de datos ----------

  function registrarPunto(contenedores) {
    var cpuTotal = null;
    var memTotal = null;
    contenedores.forEach(function (c) {
      if (esNumero(c.cpuPct)) cpuTotal = (cpuTotal || 0) + c.cpuPct;
      if (esNumero(c.memUsadaMb)) memTotal = (memTotal || 0) + c.memUsadaMb;
    });

    var memPct = esNumero(memTotal) && esNumero(estado.memHostTotalMb) && estado.memHostTotalMb > 0
      ? (memTotal / estado.memHostTotalMb) * 100
      : null;

    estado.serie.push({ cpu: cpuTotal, mem: memPct, lat: estado.latenciaPromedio });
    if (estado.serie.length > MAX_PUNTOS_SERIE) estado.serie.shift();
  }

  // Cada sección maneja su propio fallo: que Docker esté caído no debe
  // dejar la página entera en blanco, solo esa tarjeta con su aviso.
  function cargarOverview() {
    return Sesion.pedir('/overview').then(function (cuerpo) {
      var resumen = cuerpo.resumen || {};
      estado.memHostTotalMb = esNumero(resumen.memHostTotalMb) ? resumen.memHostTotalMb : null;
      pintarResumen(resumen);
      ocultarAviso(els.avisoResumen);
      return true;
    }).catch(function (err) {
      if (err instanceof Sesion.ErrorSesion) throw err;
      els.kpis.innerHTML = '';
      mostrarAviso(els.avisoResumen, els.avisoResumenTexto,
        'No se pudo conectar con Docker — verifica que el daemon esté corriendo.');
      return false;
    });
  }

  function cargarContenedores() {
    return Sesion.pedir('/containers').then(function (cuerpo) {
      var contenedores = Array.isArray(cuerpo.contenedores) ? cuerpo.contenedores : [];
      pintarContenedores(contenedores);
      registrarPunto(contenedores);
      ocultarAviso(els.avisoContenedores);
      return true;
    }).catch(function (err) {
      if (err instanceof Sesion.ErrorSesion) throw err;
      vaciarContenedores();
      mostrarAviso(els.avisoContenedores, els.avisoContenedoresTexto,
        'No se pudo conectar con Docker — verifica que el daemon esté corriendo.');
      return false;
    });
  }

  function cargarSalud() {
    return Sesion.pedir('/health').then(function (cuerpo) {
      var checks = Array.isArray(cuerpo.checks) ? cuerpo.checks : [];
      // Solo promedia los servicios que SÍ respondieron: la "latencia" de
      // uno caído es el tiempo de espera agotado (2 s fijos), que no mide
      // nada y arrastraría el promedio hasta volverlo inservible.
      var latencias = checks
        .filter(function (c) { return c.disponible; })
        .map(function (c) { return c.latenciaMs; })
        .filter(esNumero);
      estado.latenciaPromedio = latencias.length
        ? latencias.reduce(function (a, b) { return a + b; }, 0) / latencias.length
        : null;

      pintarSalud(checks);
      var arriba = checks.filter(function (c) { return c.disponible; }).length;
      els.hintServicios.textContent = checks.length
        ? arriba + ' de ' + checks.length + ' servicios respondiendo'
        : '';
      ocultarAviso(els.avisoSalud);
      return true;
    }).catch(function (err) {
      if (err instanceof Sesion.ErrorSesion) throw err;
      estado.latenciaPromedio = null;
      els.listaSalud.innerHTML = '';
      els.hintServicios.textContent = '';
      els.estadoGeneralTop.className = 'estado-general-top es-neutro';
      els.estadoGeneralTexto.textContent = 'No se pudo revisar';
      mostrarAviso(els.avisoSalud, els.avisoSaludTexto,
        'No se pudo revisar la salud de los servicios en este momento.');
      return false;
    });
  }

  function actualizarChip(resultados) {
    var fallas = resultados.filter(function (ok) { return ok === false; }).length;
    els.statusChip.classList.remove('es-error', 'es-pausa');
    if (fallas === resultados.length) {
      els.statusChip.classList.add('es-error');
      els.statusTexto.textContent = 'Sin datos · ' + horaCorta(new Date());
      return;
    }
    if (fallas > 0) els.statusChip.classList.add('es-error');
    els.statusTexto.textContent = (fallas > 0 ? 'Datos parciales · ' : 'Operativo · ') +
      'actualizado ' + horaCorta(new Date());
  }

  function cargarTodo() {
    return Promise.all([cargarOverview(), cargarContenedores(), cargarSalud()])
      .then(function (resultados) {
        actualizarChip(resultados);
        pintarGraficas();
      })
      .catch(function (err) {
        if (err instanceof Sesion.ErrorSesion) {
          cerrarSesionPorExpiracion();
          return;
        }
        els.statusChip.classList.add('es-error');
        els.statusTexto.textContent = 'Error al actualizar';
      });
  }

  // ---------- Polling con pausa en pestaña oculta ----------

  function arrancarPolling() {
    detenerPolling();
    estado.timer = setInterval(cargarTodo, MS_ENTRE_POLLS);
  }

  function detenerPolling() {
    if (estado.timer) {
      clearInterval(estado.timer);
      estado.timer = null;
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      detenerPolling();
      els.statusChip.classList.add('es-pausa');
      els.statusTexto.textContent = 'En pausa (pestaña oculta)';
      return;
    }
    els.statusChip.classList.remove('es-pausa');
    cargarTodo();
    arrancarPolling();
  });

  // ---------- Reveal al hacer scroll y navegación activa ----------

  function montarReveal() {
    var elementos = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      elementos.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    elementos.forEach(function (el) { io.observe(el); });
  }

  function montarNavActiva() {
    var enlaces = Array.prototype.slice.call(document.querySelectorAll('#pagenav a'));
    var secciones = enlaces.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    function actualizar() {
      var y = window.scrollY + 90;
      var idx = 0;
      secciones.forEach(function (s, i) { if (s && s.offsetTop <= y) idx = i; });
      enlaces.forEach(function (a, i) { a.classList.toggle('is-current', i === idx); });
    }
    window.addEventListener('scroll', actualizar, { passive: true });
    actualizar();
  }

  // ---------- Arranque ----------

  var usuario = Sesion.getUsuario();
  if (usuario) {
    els.usuarioChip.innerHTML = 'Sesión de <strong>' + escaparHtml(usuario) + '</strong>';
  }

  els.btnSalir.addEventListener('click', function () {
    Sesion.limpiarSesion();
    window.location.replace('/kerberos/login.html');
  });

  construirGraficas();
  construirMapa();
  vaciarContenedores();
  pintarGraficas();
  dibujarFlechas();
  montarReveal();
  montarNavActiva();

  var temporizadorResize = null;
  window.addEventListener('resize', function () {
    clearTimeout(temporizadorResize);
    temporizadorResize = setTimeout(function () {
      pintarGraficas();
      dibujarFlechas();
    }, 120);
  });
  window.addEventListener('load', function () {
    pintarGraficas();
    dibujarFlechas();
  });

  cargarTodo();
  arrancarPolling();
})();
