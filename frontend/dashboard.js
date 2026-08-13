(() => {
  'use strict';

  const { API_BASE, urlPagina, requireSession, showToast } = window.Portal;

  const els = {
    tbody: document.getElementById('solicitudes-tbody'),
    empty: document.getElementById('solicitudes-empty'),
    error: document.getElementById('solicitudes-error'),
    btnRefrescar: document.getElementById('btn-refrescar'),
  };

  const ESTATUS_INFO = {
    pendiente: { texto: 'Pendiente', clase: 'estatus-pendiente' },
    en_curso: { texto: 'En curso', clase: 'estatus-en-curso' },
    cancelado: { texto: 'Cancelado', clase: 'estatus-cancelado' },
    listo: { texto: 'Listo', clase: 'estatus-listo' },
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

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
    return `${dia}/${mes}/${anio} ${String(horas).padStart(2, '0')}:${minutos} ${ampm}`;
  }

  async function descargarFactura(id, folio) {
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}/factura`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'No se pudo descargar la factura.', true);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${folio}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      showToast('No se pudo descargar la factura.', true);
    }
  }

  function renderTickets(tickets) {
    els.tbody.innerHTML = '';
    els.empty.hidden = tickets.length > 0;

    tickets.forEach((t) => {
      const info = ESTATUS_INFO[t.estatus] || { texto: t.estatus, clase: '' };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Folio"><strong>${escapeHtml(t.folio)}</strong></td>
        <td data-label="Uso de CFDI">${escapeHtml(t.uso_cfdi || '—')}</td>
        <td data-label="Ticket">${escapeHtml(t.imagen_nombre_original)}</td>
        <td data-label="Estatus"><span class="estatus-badge ${info.clase}">${escapeHtml(info.texto)}</span></td>
        <td data-label="Fecha">${formatFecha(t.actualizado_en)}</td>
        <td data-label=""></td>
      `;
      if (t.estatus === 'listo') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-descargar-factura';
        btn.setAttribute('data-tooltip', 'Descargar factura');
        btn.setAttribute('aria-label', `Descargar factura del ticket ${t.folio}`);
        btn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12m0 0-4-4m4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        `;
        btn.addEventListener('click', () => descargarFactura(t.id, t.folio));
        tr.lastElementChild.appendChild(btn);
      }
      els.tbody.appendChild(tr);
    });
  }

  async function cargarTickets() {
    els.error.textContent = '';
    try {
      const res = await fetch(`${API_BASE}/tickets`, { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = urlPagina('login');
        return;
      }
      if (!res.ok) {
        els.error.textContent = 'No se pudieron cargar tus solicitudes.';
        return;
      }
      const data = await res.json();
      renderTickets(data.tickets || []);
    } catch (err) {
      els.error.textContent = 'No se pudo conectar con el servidor.';
    }
  }

  els.btnRefrescar.addEventListener('click', cargarTickets);

  (async function init() {
    const rfc = await requireSession();
    if (!rfc) return;
    await cargarTickets();
  })();
})();
