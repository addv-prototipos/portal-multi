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
    pendiente: { texto: 'Pendiente', clase: 'estatus-pendiente', tooltip: 'Tu ticket llegó y está en espera de revisión.' },
    en_curso: { texto: 'En curso', clase: 'estatus-en-curso', tooltip: 'Tu factura se está generando — no necesitas hacer nada.' },
    cancelado: { texto: 'Cancelado', clase: 'estatus-cancelado', tooltip: 'Esta solicitud fue cancelada. Usa "Solicitar aclaraciones" para saber por qué.' },
    listo: { texto: 'Listo', clase: 'estatus-listo', tooltip: 'Tu factura ya está lista — descárgala con el botón de esta fila.' },
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
      const info = ESTATUS_INFO[t.estatus] || { texto: t.estatus, clase: '', tooltip: '' };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Folio"><strong>${escapeHtml(t.folio)}</strong></td>
        <td data-label="Uso de CFDI">${escapeHtml(t.uso_cfdi || '—')}</td>
        <td data-label="Ticket">${escapeHtml(t.imagen_nombre_original)}</td>
        <td data-label="Estatus"><span class="estatus-badge ${info.clase}" data-tooltip="${escapeHtml(info.tooltip)}">${escapeHtml(info.texto)}</span></td>
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
    Esqueleto.aplicarEsqueletoTabla(els.tbody, 6);
    try {
      const res = await fetch(`${API_BASE}/tickets`, { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = urlPagina('login');
        return;
      }
      if (!res.ok) {
        Esqueleto.aplicarErrorTabla(els.tbody, 6, 'No se pudieron cargar tus solicitudes.', cargarTickets);
        return;
      }
      const data = await res.json();
      const tickets = data.tickets || [];
      renderTickets(tickets);
      Esqueleto.quitarEsqueletoTabla(els.tbody);
      return tickets.length;
    } catch (err) {
      Esqueleto.aplicarErrorTabla(els.tbody, 6, 'No se pudo conectar con el servidor.', cargarTickets);
      return null;
    }
  }

  els.btnRefrescar.addEventListener('click', cargarTickets);

  // Punto en curso: sin Facturación activa no hay nada que subir ni
  // ningún folio que consultar — se ocultan los 2 tiles y toda la
  // sección "Mis solicitudes" en vez de dejar que /api/tickets responda
  // 404 (requiereFeature) y se vea como un error roto.
  function aplicarGatingFacturacion(facturacionHabilitada) {
    if (facturacionHabilitada) return;
    document.getElementById('tile-csf')?.remove();
    document.getElementById('tile-tickets')?.remove();
    document.getElementById('portal-solicitudes')?.remove();
  }

  // % de perfil completado a partir de pasos reales (antes quedaba fijo
  // en "50%" en el HTML/CSS sin importar qué faltara — ver portal.css
  // .ring-progress). Decisión del usuario (punto 377, addendum): esta
  // tarjeta es solo sobre DATOS PERSONALES del cliente (lo que vive en
  // "Mi cuenta" — Datos de contacto), nunca sobre acciones operativas
  // como subir la CSF o un ticket (esas ya tienen sus propios tiles en
  // Home, no necesitan aparecer aquí también). Hoy el único campo
  // personal realmente opcional es el nombre (teléfono/correo ya son
  // obligatorios desde el registro) — la lista queda así a propósito,
  // como un array de un solo elemento, para que agregar un campo
  // personal nuevo más adelante sea solo sumar una entrada aquí, sin
  // tocar el resto de esta función.
  function calcularPerfilCompletado(nombre) {
    const pasos = [{ hecho: Boolean(nombre && nombre.trim()), texto: 'Agregar nombre', pagina: 'mi-cuenta' }];
    const hechos = pasos.filter((p) => p.hecho).length;
    const siguiente = pasos.find((p) => !p.hecho);
    return { hechos, total: pasos.length, porcentaje: Math.round((hechos / pasos.length) * 100), siguiente };
  }

  function aplicarCardPerfil(nombre) {
    const card = document.getElementById('profile-card');
    if (!card) return;
    const { hechos, total, porcentaje, siguiente } = calcularPerfilCompletado(nombre);
    if (hechos === total) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const nameEl = document.getElementById('profile-name');
    if (nameEl) nameEl.textContent = 'Usuario';
    const accionEl = document.getElementById('profile-action');
    const accionTextoEl = document.getElementById('profile-action-texto');
    if (siguiente && accionEl && accionTextoEl) {
      // urlPagina(), no el href crudo — portal.js ya reescribió el href
      // original con el slug del tenant al cargar la página
      // (reescribirEnlacesInternos); sobreescribirlo con una ruta sin
      // slug rompía la navegación en sitios con tenant (bug real,
      // encontrado al correr el E2E después de este mismo cambio).
      accionEl.setAttribute('href', urlPagina(siguiente.pagina));
      accionTextoEl.textContent = siguiente.texto;
    }
    // "Perfil incompleto" es la etiqueta ya aprobada (punto 358, ver
    // e2e/tests/dashboard-profile-card.spec.ts) — se conserva siempre;
    // el detalle "X de Y pasos" se agrega solo cuando hay más de 1 campo
    // personal que contar (hoy solo el nombre, "1 de 1 pasos" no aporta
    // nada que "Perfil incompleto" no diga ya — en cuanto se agregue un
    // 2do campo personal, este detalle aparece solo).
    const statusEl = document.getElementById('profile-status-text');
    if (statusEl) statusEl.textContent = total > 1 ? `Perfil incompleto — ${hechos} de ${total} pasos` : 'Perfil incompleto';
    const textoEl = document.getElementById('profile-completion-text');
    if (textoEl) textoEl.textContent = `${porcentaje}%`;
    const ringEl = document.getElementById('profile-ring-progress');
    if (ringEl) {
      const circunferencia = 163.36; // 2 * PI * r=26, ver portal.css
      ringEl.style.strokeDashoffset = String(circunferencia * (1 - porcentaje / 100));
    }
  }

  // Tile "Gestión de crédito": mismo candado que ya protege la sección
  // dentro de Mi cuenta (ventasHabilitado + cxcHabilitado) — se reusa la
  // misma llamada liviana solo para decidir si se muestra la entrada,
  // nunca se asume visible por defecto (ver CLAUDE.md, "backend-only no es
  // suficiente").
  async function aplicarTileCredito() {
    const tile = document.getElementById('tile-credito');
    if (!tile) return;
    try {
      const res = await fetch(`${API_BASE}/mi-cuenta/credito`, { credentials: 'include' });
      tile.hidden = !res.ok;
    } catch (err) {
      tile.hidden = true;
    }
  }

  (async function init() {
    const rfc = await requireSession();
    if (!rfc) return;
    const facturacionHabilitada = window.Portal.sesion ? window.Portal.sesion.facturacionHabilitada : true;
    aplicarGatingFacturacion(facturacionHabilitada);
    const nombre = window.Portal.sesion ? window.Portal.sesion.nombre : '';
    aplicarCardPerfil(nombre);
    if (facturacionHabilitada) await cargarTickets();
    aplicarTileCredito();
  })();
})();
