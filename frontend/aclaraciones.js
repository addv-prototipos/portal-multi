// Burbuja flotante "Solicitar aclaraciones" (punto 170) — se carga en las
// 3 páginas del portal de cliente ya autenticadas (dashboard, tickets,
// csf). Sin funcionalidad ninguna si el tenant no tiene correo de
// contacto configurado en /control (la burbuja simplemente no aparece) —
// mismo criterio de degradación elegante que theme.js.
(() => {
  'use strict';

  if (!window.Portal) return; // portal.js debe cargarse antes que este script
  const { API_BASE, TENANT_SLUG } = window.Portal;
  if (!TENANT_SLUG) return; // sin tenant no hay correo de contacto que ofrecer
  const API_TEMA = `/${TENANT_SLUG}/api/tema/${TENANT_SLUG}`;

  function crearBurbuja() {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'aclaraciones-burbuja';
    boton.id = 'aclaraciones-btn-abrir';
    boton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>Solicitar aclaraciones</span>`;
    document.body.appendChild(boton);
    return boton;
  }

  function crearModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'aclaraciones-modal-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="modal aclaraciones-modal" role="dialog" aria-modal="true" aria-labelledby="aclaraciones-titulo">
        <div id="aclaraciones-vista-form">
          <h2 id="aclaraciones-titulo">Solicitar aclaraciones</h2>
          <p>Cuéntanos tu duda o situación — le llega directo a quien te atiende en tu negocio.</p>
          <p class="field-error" id="aclaraciones-error" role="alert"></p>
          <form id="aclaraciones-form" novalidate>
            <div class="field">
              <label for="aclaraciones-rfc">RFC</label>
              <input type="text" id="aclaraciones-rfc" disabled />
            </div>
            <div class="field">
              <label for="aclaraciones-nombre">Nombre</label>
              <input type="text" id="aclaraciones-nombre" autocomplete="name" maxlength="150" required />
            </div>
            <div class="field">
              <label for="aclaraciones-telefono">Teléfono de contacto</label>
              <input type="tel" id="aclaraciones-telefono" autocomplete="tel" maxlength="30" required />
            </div>
            <div class="field">
              <label for="aclaraciones-detalle">Detalle del problema</label>
              <textarea id="aclaraciones-detalle" maxlength="2000" required></textarea>
            </div>
            <div class="btn-row">
              <button type="button" class="btn btn-secondary" id="aclaraciones-btn-cancelar">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="aclaraciones-btn-enviar">Enviar</button>
            </div>
          </form>
        </div>
        <div id="aclaraciones-vista-exito" hidden>
          <div class="aclaraciones-exito">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            <p>Tu solicitud se envió correctamente.</p>
            <p class="aclaraciones-folio" id="aclaraciones-folio"></p>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-primary btn-block" id="aclaraciones-btn-cerrar">Cerrar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function inicializar(rfcSesion) {
    const boton = crearBurbuja();
    const overlay = crearModal();

    const vistaForm = overlay.querySelector('#aclaraciones-vista-form');
    const vistaExito = overlay.querySelector('#aclaraciones-vista-exito');
    const form = overlay.querySelector('#aclaraciones-form');
    const errorEl = overlay.querySelector('#aclaraciones-error');
    const btnEnviar = overlay.querySelector('#aclaraciones-btn-enviar');
    const campoRfc = overlay.querySelector('#aclaraciones-rfc');
    const campoNombre = overlay.querySelector('#aclaraciones-nombre');
    const campoTelefono = overlay.querySelector('#aclaraciones-telefono');
    const campoDetalle = overlay.querySelector('#aclaraciones-detalle');

    campoRfc.value = rfcSesion;

    function abrir() {
      vistaForm.hidden = false;
      vistaExito.hidden = true;
      errorEl.textContent = '';
      overlay.hidden = false;
      campoNombre.focus();
    }
    function cerrar() {
      overlay.hidden = true;
      form.reset();
      campoRfc.value = rfcSesion;
    }

    boton.addEventListener('click', abrir);
    overlay.querySelector('#aclaraciones-btn-cancelar').addEventListener('click', cerrar);
    overlay.querySelector('#aclaraciones-btn-cerrar').addEventListener('click', cerrar);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) cerrar(); });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !overlay.hidden) cerrar();
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      errorEl.textContent = '';

      const nombre = campoNombre.value.trim();
      const telefono = campoTelefono.value.trim();
      const detalle = campoDetalle.value.trim();
      if (!nombre || !telefono || !detalle) {
        errorEl.textContent = 'Completa nombre, teléfono y el detalle de tu situación.';
        return;
      }

      btnEnviar.disabled = true;
      btnEnviar.textContent = 'Enviando…';
      try {
        const res = await fetch(`${API_BASE}/aclaraciones`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, telefono, detalle }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          errorEl.textContent = data.error || 'No se pudo enviar tu solicitud. Intenta de nuevo.';
          return;
        }
        vistaForm.hidden = true;
        vistaExito.hidden = false;
        overlay.querySelector('#aclaraciones-folio').textContent = `Folio: ${data.numero}`;
      } catch (err) {
        errorEl.textContent = 'No se pudo enviar tu solicitud. Revisa tu conexión e intenta de nuevo.';
      } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar';
      }
    });
  }

  fetch(API_TEMA, { headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((datos) => {
      if (!datos || !datos.tieneAclaraciones) return null;
      return fetch(`${API_BASE}/auth/me`, { credentials: 'include' }).then((res) => (res.ok ? res.json() : null));
    })
    .then((sesion) => {
      if (sesion && sesion.rfc) inicializar(sesion.rfc);
    })
    .catch((err) => {
      // Degradación silenciosa: sin burbuja, el resto de la página sigue igual.
      if (window.console && console.warn) {
        console.warn('No se pudo inicializar "Solicitar aclaraciones":', err && err.message);
      }
    });
})();
