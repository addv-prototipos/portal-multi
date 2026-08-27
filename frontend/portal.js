// Compartido entre dashboard.html y tickets.html: verifica que haya una
// sesión de usuario válida (si no, manda a login.html) y conecta el botón
// de "Cerrar sesión" del encabezado. Expone window.Portal para que cada
// página use lo que necesite.
(() => {
  'use strict';

  // Multi-tenant (segmento 4, ver PROJECT_STATE.md): si la URL actual
  // tiene la forma "/<slug>/<pagina>" (ej. "/cliente1/dashboard"), el
  // primer segmento es el slug del tenant — nginx solo agrega el
  // encabezado X-Tenant-Slug cuando ve ese mismo patrón (ver
  // frontend/nginx.conf), así que esta detección debe coincidir
  // exactamente con la de ahí. Sin ese patrón (todas las URLs de hoy,
  // ej. "/dashboard" a secas), TENANT_SLUG es null y todo se comporta
  // IDÉNTICO a antes de este segmento.
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

  // Construye la URL de otra página del portal ("dashboard", "csf",
  // "tickets", "login", sin ".html") respetando el tenant actual, si lo
  // hay — así una redirección o un enlace nunca saca al usuario de su
  // tenant.
  function urlPagina(pagina) {
    return TENANT_SLUG ? `/${TENANT_SLUG}/${pagina}` : `/${pagina}`;
  }

  // Los HTML de este proyecto referencian otras páginas del portal como
  // "dashboard.html", "csf.html", etc. (así se escriben más simple a
  // mano) — se reescriben en tiempo de carga para respetar el tenant
  // actual, en vez de tener que mantener esa lógica duplicada en cada
  // archivo HTML.
  function reescribirEnlacesInternos() {
    document.querySelectorAll('a[href$=".html"]').forEach((enlace) => {
      const nombre = enlace.getAttribute('href').replace(/\.html$/, '');
      if (RUTAS_PAGINA_MULTITENANT.includes(nombre)) {
        enlace.setAttribute('href', urlPagina(nombre));
      }
    });
  }

  function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('is-error', isError);
    toast.hidden = false;
    clearTimeout(showToast._t);
    const duracion = Math.min(9000, Math.max(4000, message.length * 80));
    showToast._t = setTimeout(() => { toast.hidden = true; }, duracion);
  }

  async function requireSession() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      if (!res.ok) {
        window.location.href = urlPagina('login');
        return null;
      }
      const data = await res.json();
      // Si la cuenta todavia tiene pendiente el cambio de contraseña
      // obligatorio (ej. el administrador restableció una temporal), se
      // manda al login — que, con la sesión ya válida, muestra esa
      // pantalla directamente en vez de pedir credenciales de nuevo. Esto
      // evita que se pueda "brincar" el cambio obligatorio entrando
      // directo a esta página.
      if (data.debeCambiarPassword) {
        window.location.href = urlPagina('login');
        return null;
      }
      const label = document.getElementById('portal-user-label');
      if (label) label.textContent = data.rfc;
      return data.rfc;
    } catch (err) {
      window.location.href = urlPagina('login');
      return null;
    }
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {
      // Si falla la llamada, igual mandamos al login: la cookie expira sola.
    }
    window.location.href = urlPagina('login');
  }

  // Muestra el aviso de "los tickets se eliminan después de X días" en
  // cualquier página que tenga el elemento #aviso-retencion (dashboard y
  // tickets). Si el borrado automático no está activado, no se muestra
  // nada — no hay necesidad de avisar sobre algo que no está pasando.
  async function mostrarAvisoRetencion() {
    const aviso = document.getElementById('aviso-retencion');
    if (!aviso) return;
    try {
      const res = await fetch(`${API_BASE}/config/tickets-retencion`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.dias) {
        aviso.textContent = `⏳ Los tickets se eliminan automáticamente ${data.dias} día${data.dias === 1 ? '' : 's'} después de haberse subido. Descarga tu factura antes de que esto ocurra.`;
        aviso.hidden = false;
      }
    } catch (err) {
      // Si falla, simplemente no se muestra el aviso; no bloquea el resto de la página.
    }
  }

  // ---------- Tooltip personalizado (sin librerías externas) ----------
  // Misma implementación que ya usa admin.js — se repite aquí en vez de
  // compartir un archivo entre el panel de administración y el portal
  // de cliente porque son aplicaciones separadas, cada una con su propio
  // conjunto de páginas HTML/JS independiente. Reemplaza el atributo
  // "title" nativo en cualquier elemento con "data-tooltip".
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
  inicializarTooltips();

  document.addEventListener('DOMContentLoaded', () => {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', logout);
    mostrarAvisoRetencion();
    reescribirEnlacesInternos();
  });

  window.Portal = { API_BASE, TENANT_SLUG, urlPagina, requireSession, logout, showToast };
})();
