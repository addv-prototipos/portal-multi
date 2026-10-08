(() => {
  'use strict';

  const { API_BASE, requireSession } = window.Portal;

  const els = {
    creditoSection: document.getElementById('credito-section'),
    creditoKpis: document.getElementById('credito-kpis'),
    creditoKpiCreditos: document.getElementById('credito-kpi-creditos'),
    creditoKpiPagado: document.getElementById('credito-kpi-pagado'),
    creditoKpiSaldo: document.getElementById('credito-kpi-saldo'),
    donaGeneral: document.getElementById('credito-dona-general'),
    donaGeneralPagado: document.getElementById('dona-general-pagado'),
    donaGeneralPendiente: document.getElementById('dona-general-pendiente'),
    donaGeneralPct: document.getElementById('credito-dona-pct'),
    donaLeyendaPagado: document.getElementById('credito-dona-leyenda-pagado'),
    donaLeyendaPendiente: document.getElementById('credito-dona-leyenda-pendiente'),
    listaCreditos: document.getElementById('credito-lista-creditos'),
    creditoVentasEmpty: document.getElementById('credito-ventas-empty'),
    creditoAbonosWrap: document.getElementById('credito-abonos-wrap'),
    creditoAbonosBody: document.getElementById('credito-abonos-body'),
    creditoAbonosEmpty: document.getElementById('credito-abonos-empty'),
  };

  // Mismo patrón ya usado en login.js/app.js/admin.js — sin bundler, cada
  // página repite lo mínimo que necesita.
  function formatearMoneda(valor) {
    return Number(valor || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatearFechaCorta(fechaISO) {
    if (!fechaISO) return '—';
    const fecha = new Date(String(fechaISO).replace(' ', 'T') + (String(fechaISO).includes('Z') ? '' : 'Z'));
    if (Number.isNaN(fecha.getTime())) return '—';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto == null ? '' : String(texto);
    return div.innerHTML;
  }

  // r=44, mismo radio que el SVG estático de credito.html — la
  // circunferencia se calcula una sola vez aquí en vez de hardcodearla.
  const RADIO_DONA_GENERAL = 44;
  const CIRC_DONA_GENERAL = 2 * Math.PI * RADIO_DONA_GENERAL;
  // r=26, mismo radio que el anillo de "% completado" del Home
  // (dashboard.html/portal.css) — reusa el mismo lenguaje visual.
  const RADIO_ITEM = 26;
  const CIRC_ITEM = 2 * Math.PI * RADIO_ITEM;

  // Dona general (pagado vs. pendiente, sobre el TOTAL facturado) — sin
  // ventas no hay nada que proporcionar, se oculta en vez de mostrar un
  // círculo vacío sin sentido.
  function renderDonaGeneral(totalFacturado, totalPagado) {
    if (!els.donaGeneral) return;
    if (!totalFacturado || totalFacturado <= 0) {
      els.donaGeneral.hidden = true;
      return;
    }
    const pctPagado = Math.max(0, Math.min(1, totalPagado / totalFacturado));
    const largoPagado = CIRC_DONA_GENERAL * pctPagado;
    const largoPendiente = CIRC_DONA_GENERAL - largoPagado;
    els.donaGeneralPagado.style.strokeDasharray = `${largoPagado} ${CIRC_DONA_GENERAL}`;
    els.donaGeneralPagado.style.strokeDashoffset = '0';
    els.donaGeneralPendiente.style.strokeDasharray = `${largoPendiente} ${CIRC_DONA_GENERAL}`;
    els.donaGeneralPendiente.style.strokeDashoffset = String(-largoPagado);
    els.donaGeneralPct.textContent = `${Math.round(pctPagado * 100)}%`;
    els.donaGeneral.hidden = false;
  }

  // Un anillo por crédito activo — el arco en ámbar representa lo que
  // AÚN se debe de esa venta (no lo ya pagado), mismo criterio que el
  // color de "pendiente" en toda la app.
  function construirItemCredito(venta) {
    const pctPendiente = venta.total > 0 ? Math.max(0, Math.min(1, venta.saldo / venta.total)) : 0;
    const largoPendiente = CIRC_ITEM * pctPendiente;
    const item = document.createElement('div');
    item.className = 'credito-item';
    item.innerHTML = `
      <svg class="credito-item-anillo" width="58" height="58" viewBox="0 0 70 70" aria-hidden="true">
        <circle cx="35" cy="35" r="${RADIO_ITEM}" fill="none" stroke-width="9" class="dona-pista"/>
        <circle cx="35" cy="35" r="${RADIO_ITEM}" fill="none" stroke-width="9" class="dona-pendiente"
          stroke-dasharray="${largoPendiente} ${CIRC_ITEM}" transform="rotate(-90 35 35)"/>
      </svg>
      <div class="credito-item-info">
        <span class="credito-item-numero">${escaparHtml(venta.numeroCompra)}</span>
        <span class="credito-item-detalle">$${formatearMoneda(venta.total - venta.saldo)} pagado de $${formatearMoneda(venta.total)} · ${formatearFechaCorta(venta.fechaCompra)}</span>
      </div>
      <div class="credito-item-pct">${Math.round(pctPendiente * 100)}% pendiente</div>
    `;
    return item;
  }

  function aplicarEsqueletoLista() {
    if (!els.listaCreditos) return;
    els.listaCreditos.innerHTML = [0, 1]
      .map(
        () => `
      <div class="credito-item" aria-hidden="true">
        <span class="sk" style="width:58px;height:58px;border-radius:50%;flex-shrink:0"></span>
        <div class="credito-item-info" style="flex:1">
          <span class="sk sk-line" style="width:40%;display:block;margin-bottom:6px"></span>
          <span class="sk sk-line" style="width:70%;display:block"></span>
        </div>
      </div>`
      )
      .join('');
  }

  function aplicarErrorLista(mensaje, reintentar) {
    if (!els.listaCreditos) return;
    els.listaCreditos.innerHTML = `<div class="sk-retry-inline"><span>${escaparHtml(mensaje)}</span><button type="button" class="sk-retry-btn">Reintentar</button></div>`;
    const boton = els.listaCreditos.querySelector('.sk-retry-btn');
    if (boton && typeof reintentar === 'function') boton.addEventListener('click', reintentar);
  }

  async function cargarCredito() {
    if (!els.creditoSection) return;
    // Se muestra desde ya con esqueleto (Esqueleto.*, igual que el resto
    // del sitio) — si resulta ser un 404 (módulo apagado en el plan del
    // tenant) se vuelve a ocultar abajo, sin error; cualquier OTRA falla
    // (red/servidor) se queda visible con el estado de error + reintentar
    // en el mismo bloque, nunca en silencio.
    els.creditoSection.hidden = false;
    Esqueleto.marcarKpisCargando(els.creditoKpis, true);
    els.donaGeneral.hidden = true;
    els.creditoVentasEmpty.hidden = true;
    aplicarEsqueletoLista();
    els.creditoAbonosWrap.hidden = false;
    els.creditoAbonosEmpty.hidden = true;
    Esqueleto.aplicarEsqueletoTabla(els.creditoAbonosBody, 4, 3);

    try {
      const res = await fetch(`${API_BASE}/mi-cuenta/credito`, { credentials: 'include' });
      if (res.status === 404) {
        // Módulo Ventas/CxC apagado en el plan del tenant (ver
        // requiereFeature en el backend) — la sección entera se oculta,
        // mismo criterio ya aplicado en el resto del portal/admin (el
        // candado del backend no basta solo, el frontend también debe
        // ocultar la entrada).
        els.creditoSection.hidden = true;
        return;
      }
      if (!res.ok) {
        Esqueleto.marcarKpisCargando(els.creditoKpis, false);
        aplicarErrorLista('No se pudo cargar tu información de crédito.', cargarCredito);
        Esqueleto.aplicarErrorTabla(els.creditoAbonosBody, 4, 'No se pudo cargar tu historial de abonos.', cargarCredito);
        return;
      }
      const data = await res.json();
      const ventas = data.ventasPendientes || [];

      Esqueleto.marcarKpisCargando(els.creditoKpis, false);
      els.creditoKpiCreditos.textContent = String(ventas.length);
      els.creditoKpiPagado.textContent = `$${formatearMoneda(data.resumen.totalPagado)}`;
      els.creditoKpiSaldo.textContent = `$${formatearMoneda(data.resumen.saldoPendiente)}`;

      renderDonaGeneral(data.resumen.totalFacturado, data.resumen.totalPagado);
      els.donaLeyendaPagado.textContent = `$${formatearMoneda(data.resumen.totalPagado)}`;
      els.donaLeyendaPendiente.textContent = `$${formatearMoneda(data.resumen.saldoPendiente)}`;

      els.creditoVentasEmpty.hidden = ventas.length > 0;
      els.listaCreditos.innerHTML = '';
      ventas.forEach((venta) => els.listaCreditos.appendChild(construirItemCredito(venta)));

      const abonos = data.abonos || [];
      Esqueleto.quitarEsqueletoTabla(els.creditoAbonosBody);
      els.creditoAbonosWrap.hidden = abonos.length === 0;
      els.creditoAbonosEmpty.hidden = abonos.length > 0;
      els.creditoAbonosBody.innerHTML = abonos
        .map(
          (a) => `
        <tr>
          <td data-label="Fecha">${formatearFechaCorta(a.creadoEn)}</td>
          <td data-label="Venta">${escaparHtml(a.numeroCompra)}</td>
          <td data-label="Monto">$${formatearMoneda(a.monto)}</td>
          <td data-label="Notas">${escaparHtml(a.notas) || '—'}</td>
        </tr>`
        )
        .join('');
    } catch (err) {
      Esqueleto.marcarKpisCargando(els.creditoKpis, false);
      aplicarErrorLista('No se pudo conectar con el servidor.', cargarCredito);
      Esqueleto.aplicarErrorTabla(els.creditoAbonosBody, 4, 'No se pudo conectar con el servidor.', cargarCredito);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const sesionOk = await requireSession();
    if (sesionOk) cargarCredito();
  });
})();
