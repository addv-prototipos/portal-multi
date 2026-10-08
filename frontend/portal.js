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
  const RUTAS_PAGINA_MULTITENANT = ['admin', 'dashboard', 'tickets', 'login', 'csf', 'restablecer', 'mi-cuenta', 'credito'];

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
    // Acepta un "#ancla" opcional al final (ej. "mi-cuenta.html#credito-section",
    // ver el tile de Home que abre directo en esa sección) — antes el
    // selector exigía que el href terminara exactamente en ".html", así que
    // cualquier enlace con ancla se quedaba sin reescribir en una URL con
    // slug de tenant (/<slug>/mi-cuenta.html#... en vez de /<slug>/mi-cuenta#...).
    document.querySelectorAll('a[href]').forEach((enlace) => {
      const hrefOriginal = enlace.getAttribute('href');
      const match = hrefOriginal.match(/^([a-z0-9-]+)\.html(#.*)?$/i);
      if (!match) return;
      const nombre = match[1];
      const hash = match[2] || '';
      if (RUTAS_PAGINA_MULTITENANT.includes(nombre)) {
        enlace.setAttribute('href', urlPagina(nombre) + hash);
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
      // Cuenta suspendida (ver /api/admin/usuarios/:id/estado) — se
      // consulta en vivo igual que debeCambiarPassword, así que corta el
      // acceso aunque la sesión ya estuviera abierta desde antes de
      // suspenderla. sessionStorage (no la URL) lleva el motivo a login.js
      // para mostrar el aviso justo después de la redirección.
      if (data.suspendido) {
        try { sessionStorage.setItem('login_aviso', 'suspendida'); } catch (_) { /* modo privado: sin aviso, igual se redirige */ }
        await logout();
        return null;
      }
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
      // Identificador interno sin RFC real (punto en curso, ver
      // generarIdentificadorSinFiscal en el backend): nunca se muestra
      // como "tu RFC" — se prefiere el nombre si ya lo capturó en Mi
      // Cuenta, y si no, un label genérico en vez del valor interno.
      const label = document.getElementById('portal-user-label');
      if (label) label.textContent = data.tieneRfc ? data.rfc : data.nombre || 'Mi cuenta';
      window.Portal.sesion = {
        rfc: data.tieneRfc ? data.rfc : null,
        nombre: data.nombre || '',
        facturacionHabilitada: data.facturacionHabilitada !== false,
      };
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
        // Sin emojis (regla del sitio) — mismo lenguaje de ícono SVG
        // feather-like que usa el resto de la app, nunca un carácter Unicode.
        const texto = `Los tickets se eliminan automáticamente ${data.dias} día${data.dias === 1 ? '' : 's'} después de haberse subido. Descarga tu factura antes de que esto ocurra.`;
        aviso.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg><span>${texto}</span>`;
        aviso.hidden = false;
      }
    } catch (err) {
      // Si falla, simplemente no se muestra el aviso; no bloquea el resto de la página.
    }
  }

  // ---------- Campana de notificaciones del portal de cliente (punto en
  // curso) ----------
  // Une "promoción" (broadcast, enviada desde /admin) y "pago registrado"
  // (al confirmar un abono en Cuentas por cobrar) en un solo panel —
  // mismo criterio de unión y el mismo patrón de sondeo/sonido/lectura
  // en localStorage que ya usa la campana de /admin (punto 337,
  // frontend/admin.js), centralizado AQUÍ en vez de duplicado en cada
  // página de cliente porque este archivo ya es el único punto
  // compartido entre dashboard/tickets/csf/mi-cuenta/credito.
  //
  // No hay endpoint para "¿aplica este módulo?" aparte — se decide
  // probando GET /api/notificaciones con la sesión real: 404 = ni CxC ni
  // Promociones están activos en el plan de este tenant (requiereFeature
  // con arreglo = OR, ver backend/utils/requiereFeature.js), la campana
  // se queda oculta por completo y no se vuelve a intentar en este
  // sondeo. 200 = al menos uno de los dos aplica, se muestra y se arma
  // el panel con lo que haya (puede incluir solo un tipo).
  function claveNotifClienteLeidas(rfc) {
    return `notif_cliente_leidas_v1_${TENANT_SLUG || 'base'}_${rfc || ''}`;
  }
  function leerNotifClienteLeidas(rfc) {
    try {
      return new Set(JSON.parse(localStorage.getItem(claveNotifClienteLeidas(rfc)) || '[]'));
    } catch (_) {
      return new Set();
    }
  }
  function guardarNotifClienteLeidas(rfc, idsLeidos) {
    try {
      localStorage.setItem(claveNotifClienteLeidas(rfc), JSON.stringify([...idsLeidos]));
    } catch (_) {
      // Modo privado / cuota llena: la campana sigue funcionando, solo
      // sin recordar lo ya leído entre sesiones.
    }
  }

  // Sonido: campanada sintetizada (Web Audio, sin archivo nuevo — mismo
  // criterio que admin.js) pero con un tono PROPIO (dos notas
  // descendentes) distinto del de /admin (dos notas ascendentes), para
  // que una cuenta que alguna vez escuche ambas no las confunda.
  let notifAudioCtxCliente = null;
  function tonoCampanaNotifCliente(ctx, frecuencia, inicio, duracion, volumen) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frecuencia;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, ctx.currentTime + inicio);
    gain.gain.linearRampToValueAtTime(volumen, ctx.currentTime + inicio + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracion);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + inicio);
    osc.stop(ctx.currentTime + inicio + duracion + 0.05);
  }
  function reproducirCampanadaNotifCliente() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    // Se crea hasta el primer uso real (política de autoplay de los
    // navegadores exige un gesto del usuario antes de poder sonar).
    if (!notifAudioCtxCliente) notifAudioCtxCliente = new AudioCtx();
    tonoCampanaNotifCliente(notifAudioCtxCliente, 1760.0, 0, 0.16, 0.14);
    tonoCampanaNotifCliente(notifAudioCtxCliente, 1396.91, 0.1, 0.22, 0.14);
  }

  const ICONOS_NOTIF_CLIENTE = {
    pago_registrado:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    promocion:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 7l9 6 9-6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const TITULOS_NOTIF_CLIENTE = { pago_registrado: 'pago', promocion: 'promo' };

  function construirCampanaNotifCliente() {
    const contenedor = document.querySelector('.portal-header-actions');
    if (!contenedor || document.getElementById('portal-notif-wrap')) return contenedor ? document.getElementById('portal-notif-wrap') : null;
    const wrap = document.createElement('span');
    wrap.className = 'portal-notif-wrap';
    wrap.id = 'portal-notif-wrap';
    wrap.hidden = true;
    wrap.innerHTML = `
      <button type="button" class="portal-notif-btn" id="portal-notif-btn" aria-label="Notificaciones" aria-haspopup="true" aria-expanded="false">
        <svg class="portal-notif-bell" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.73 21a2 2 0 01-3.46 0" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="portal-notif-dot" id="portal-notif-dot" hidden></span>
      </button>
      <div class="portal-notif-panel" id="portal-notif-panel" role="menu" aria-label="Notificaciones" hidden>
        <div class="portal-notif-head">
          <h3>Notificaciones</h3>
          <button type="button" id="portal-notif-marcar-todo">Marcar todo leído</button>
        </div>
        <div class="portal-notif-list" id="portal-notif-list"></div>
        <div class="portal-notif-empty" id="portal-notif-empty" hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.73 21a2 2 0 01-3.46 0" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <p>Sin notificaciones</p>
        </div>
      </div>
    `;
    contenedor.insertBefore(wrap, contenedor.firstChild);
    return wrap;
  }

  // Independiente de requireSession() a propósito: csf.html usa su propio
  // flujo de auth (frontend/app.js, con sesión opcional — hay un camino
  // anónimo ahí) en vez de llamar a requireSession() de este archivo, así
  // que esta función resuelve su propia sesión con /api/auth/me en vez de
  // depender de que la página que la invoque ya haya confirmado una. Una
  // página sin sesión (401) simplemente nunca muestra la campana, igual
  // que un tenant sin el módulo (404) — ambos casos se tratan igual.
  async function iniciarCampanaNotificacionesCliente() {
    const wrap = construirCampanaNotifCliente();
    if (!wrap) return; // Página sin header de portal (no debería pasar en las páginas protegidas).

    let rfcSesion = null;
    try {
      const resSesion = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      if (!resSesion.ok) {
        wrap.remove();
        return;
      }
      rfcSesion = (await resSesion.json()).rfc;
    } catch (err) {
      wrap.remove();
      return;
    }

    const btn = document.getElementById('portal-notif-btn');
    const panel = document.getElementById('portal-notif-panel');
    const dot = document.getElementById('portal-notif-dot');
    const lista = document.getElementById('portal-notif-list');
    const vacio = document.getElementById('portal-notif-empty');
    const btnMarcarTodo = document.getElementById('portal-notif-marcar-todo');

    let idsSondeoAnterior = null; // null = primer sondeo (sin sonido, sin baseline).
    let itemsActuales = [];

    function leido(id) {
      return leerNotifClienteLeidas(rfcSesion).has(id);
    }
    function marcarLeido(id) {
      const set = leerNotifClienteLeidas(rfcSesion);
      set.add(id);
      guardarNotifClienteLeidas(rfcSesion, set);
    }
    function marcarTodoLeido() {
      const set = leerNotifClienteLeidas(rfcSesion);
      itemsActuales.forEach((it) => set.add(it.id));
      guardarNotifClienteLeidas(rfcSesion, set);
      render();
    }

    function abrirDestino(item) {
      marcarLeido(item.id);
      if (item.tipo === 'pago_registrado') {
        window.location.href = urlPagina('credito');
      }
      render();
    }

    function render() {
      const hayPendientes = itemsActuales.some((it) => !leido(it.id));
      dot.hidden = !hayPendientes;
      if (itemsActuales.length === 0) {
        lista.innerHTML = '';
        vacio.hidden = false;
        return;
      }
      vacio.hidden = true;
      lista.innerHTML = itemsActuales
        .map((it) => {
          const fecha = new Date(`${String(it.creadoEn).replace(' ', 'T')}Z`);
          const fechaTexto = Number.isNaN(fecha.getTime())
            ? ''
            : fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
          return `<button type="button" class="portal-notif-item${leido(it.id) ? '' : ' is-nueva'}" data-id="${it.id}" data-tipo="${it.tipo}">
            <span class="portal-notif-icon portal-notif-icon-${it.tipo === 'pago_registrado' ? 'pago' : 'promo'}">${ICONOS_NOTIF_CLIENTE[it.tipo] || ''}</span>
            <span class="portal-notif-texto">
              <strong>${it.titulo}</strong>
              <span>${it.mensaje}</span>
              <time>${fechaTexto}</time>
            </span>
          </button>`;
        })
        .join('');
      lista.querySelectorAll('[data-id]').forEach((el) => {
        el.addEventListener('click', () => {
          const item = itemsActuales.find((it) => String(it.id) === el.getAttribute('data-id'));
          if (item) abrirDestino(item);
        });
      });
    }

    async function sondear({ sondeo }) {
      try {
        const res = await fetch(`${API_BASE}/notificaciones`, { credentials: 'include' });
        if (res.status === 404) {
          // Ni CxC ni Promociones aplican en el plan de este tenant —
          // la campana es chrome del sistema, se oculta por completo
          // (mismo criterio que la de /admin) y no vuelve a sondearse.
          wrap.remove();
          return false;
        }
        if (!res.ok) return true; // Error transitorio — se reintenta en el próximo sondeo.
        wrap.hidden = false;
        const data = await res.json();
        itemsActuales = Array.isArray(data.notificaciones) ? data.notificaciones : [];

        if (sondeo && idsSondeoAnterior) {
          const idsNuevos = itemsActuales
            .map((it) => it.id)
            .filter((id) => !idsSondeoAnterior.has(id));
          if (idsNuevos.length > 0) {
            reproducirCampanadaNotifCliente();
            btn.classList.add('is-ringing');
            setTimeout(() => btn.classList.remove('is-ringing'), 600);
          }
        }
        idsSondeoAnterior = new Set(itemsActuales.map((it) => it.id));
        render();
        return true;
      } catch (err) {
        return true; // Sin red — no se oculta la campana por un fallo puntual.
      }
    }

    btn.addEventListener('click', () => {
      const abierto = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!abierto));
      panel.hidden = abierto;
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        panel.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    btnMarcarTodo.addEventListener('click', marcarTodoLeido);

    let intervaloId = null;
    function detenerSondeo() {
      if (intervaloId) {
        clearInterval(intervaloId);
        intervaloId = null;
      }
    }
    function iniciarSondeo() {
      detenerSondeo();
      intervaloId = setInterval(() => sondear({ sondeo: true }), 60000);
    }

    sondear({ sondeo: false }).then((activo) => {
      if (activo) iniciarSondeo();
    });
    // Pausa el sondeo con la pestaña en segundo plano (cero peticiones
    // desperdiciadas) y refresca de inmediato al volver, sin sonido
    // (sondeo:false — "algo nuevo llegó mientras no veías la pestaña" no
    // es lo mismo que "algo nuevo llegó ahora"), mismo criterio que la
    // campana de /admin.
    document.addEventListener('visibilitychange', () => {
      if (!document.body.contains(wrap) || wrap.hidden) return;
      if (document.visibilityState === 'hidden') {
        detenerSondeo();
      } else {
        sondear({ sondeo: false }).then((activo) => {
          if (activo) iniciarSondeo();
        });
      }
    });
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
    iniciarCampanaNotificacionesCliente();
  });

  window.Portal = { API_BASE, TENANT_SLUG, urlPagina, requireSession, logout, showToast };
})();
