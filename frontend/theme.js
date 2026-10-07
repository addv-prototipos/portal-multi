// Tema / identidad visual del tenant (segmento "Look & Feel", ver
// PROJECT_STATE.md punto 105): pinta sobre el diseño base ADDV las CSS
// variables del tema de la empresa (paleta, tipografías, radios) y
// personaliza marca/logo/favicon/título en las páginas del portal.
//
// Se carga en TODAS las páginas (login, dashboard, csf, tickets, admin,
// control) DESPUÉS de style.css — así las variables del tema ganan a las
// del diseño base sin tocar ningún CSS de componente. En páginas sin
// tenant (/login, /admin, /control) no hace nada: se usa el diseño base
// ADDV. Si el fetch falla o el tenant no tiene tema, el portal se ve con
// el diseño base — degradación elegante, nunca rompe la página.
(function () {
  'use strict';

  // CSP (auditoría 2026-09-03, hallazgo #11): reemplaza el
  // onerror="this.remove()" inline que traían las 4 páginas con hero
  // split-screen (admin/login/control/restablecer) — script-src ya no
  // necesita 'unsafe-inline'. theme.js se carga en todas, así que esto
  // corre siempre; querySelectorAll no encuentra nada en las páginas sin
  // esa imagen (dashboard/tickets/csf), sin efecto ahí.
  Array.prototype.forEach.call(document.querySelectorAll('.auth-hero-decor'), function (img) {
    // theme.js corre al final del body, después de que el navegador ya
    // empezó a cargar la imagen — si el error ya ocurrió antes de que este
    // script se ejecute, `complete` es true con `naturalWidth` en 0 (a
    // diferencia de una carga exitosa). Cubre ambos casos: ya falló, o
    // falla más tarde.
    if (img.complete && img.naturalWidth === 0) {
      img.remove();
    } else {
      img.addEventListener('error', function () {
        img.remove();
      });
    }
  });

  // Misma detección de slug que portal.js (duplicada a propósito: las
  // páginas del frontend se sirven sin bundler y cada script debe poder
  // funcionar solo; el control no tiene slug y usa el diseño base).
  // "mi-cuenta" se agrega aquí (punto 374) — ya cargaba theme.js pero
  // faltaba en esta lista, así que nunca pintaba tema ni, ahora, el aviso
  // de portal desactivado.
  var RUTAS_PAGINA_MULTITENANT = ['dashboard', 'tickets', 'login', 'csf', 'admin', 'restablecer', 'mi-cuenta'];
  // Punto 374: subconjunto de lo anterior que SÍ es portal de cliente —
  // "admin" pinta CSS variables igual (identidad de marca), pero nunca
  // debe mostrar el aviso de "portal de clientes desactivado": ese flag
  // no afecta al panel de administración, solo a la sesión del cliente.
  var RUTAS_PORTAL_CLIENTE = ['dashboard', 'tickets', 'login', 'csf', 'restablecer', 'mi-cuenta'];
  function detectarTenantSlug() {
    var segmentos = window.location.pathname.split('/').filter(Boolean);
    if (segmentos.length >= 2 && RUTAS_PAGINA_MULTITENANT.indexOf(segmentos[1]) !== -1) {
      return segmentos[0];
    }
    return null;
  }
  function paginaEsPortalCliente() {
    var segmentos = window.location.pathname.split('/').filter(Boolean);
    return segmentos.length >= 2 && RUTAS_PORTAL_CLIENTE.indexOf(segmentos[1]) !== -1;
  }

  var TENANT_SLUG = detectarTenantSlug();
  if (!TENANT_SLUG) return;

  var API_TEMA = '/' + TENANT_SLUG + '/api/tema/' + TENANT_SLUG;

  function cargarFuentesGoogle(urls) {
    // style.css ya carga las fuentes base por @import; para un tema con
    // fuentes distintas, se agregan los <link> de Google Fonts antes de
    // pintar las variables (las familias deben estar disponibles).
    urls.forEach(function (url) {
      var yaCargada = Array.prototype.some.call(document.querySelectorAll('link[rel="stylesheet"]'), function (link) {
        return link.href === url;
      });
      if (!yaCargada) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
      }
    });
  }

  function aplicarVariables(variables) {
    var root = document.documentElement;
    Object.keys(variables).forEach(function (clave) {
      root.style.setProperty(clave, variables[clave]);
    });
  }

  function personalizarIdentidad(datos) {
    // Marca: si el tenant tiene nombre de marca propio, reemplaza el
    // texto por defecto en los elementos .brand-name de la página.
    if (datos.marca) {
      Array.prototype.forEach.call(document.querySelectorAll('.brand-name'), function (el) {
        el.textContent = datos.marca;
      });
      var titulo = document.title;
      if (titulo && titulo.indexOf('|') !== -1) {
        document.title = titulo.split('|').slice(0, 1).join('|') + '| ' + datos.marca;
      }
    }

    // Logo: si el tenant tiene logo cargado, reemplaza la marca de texto
    // (.brand-mark con iniciales) por la imagen.
    if (datos.marcaLoGoUrl) {
      Array.prototype.forEach.call(document.querySelectorAll('.brand-mark'), function (el) {
        var img = document.createElement('img');
        img.src = datos.marcaLoGoUrl;
        img.alt = '';
        img.className = 'brand-mark-img';
        img.width = 34;
        img.height = 34;
        el.replaceWith(img);
      });
    }

    // Favicon: si el tenant tiene uno, reemplaza el <link rel="icon">.
    if (datos.tema && datos.tema.faviconUrl) {
      var iconActual = document.querySelector('link[rel="icon"]');
      var icon = document.createElement('link');
      icon.rel = 'icon';
      icon.href = datos.tema.faviconUrl;
      if (iconActual) iconActual.replaceWith(icon);
      else document.head.appendChild(icon);
    }
  }

  // Punto 374: "Portal de clientes desactivado" — toma control total de
  // la página (reemplaza <body>) cuando portalClientesHabilitado es
  // false, en cualquiera de las 6 páginas del portal de cliente. Única
  // responsable de este aviso en todo el sitio: así no hay que repetir
  // el mismo chequeo en login.js/dashboard.js/tickets.js/etc. Propuesta
  // visual "Aurora profunda" (navy/cian de marca, cristal Clarvo
  // girando en 3D, respeta prefers-reduced-motion) — ver el Artifact
  // aprobado por el usuario antes de este punto.
  function mostrarPortalDesactivado(contactoEmail) {
    var estilo = document.createElement('style');
    estilo.id = 'portal-desactivado-estilo';
    estilo.textContent =
      ':root{--pd-navy-950:#030C22;--pd-navy-800:#0B1F42;--pd-cyan:#05DBF2;--pd-cyan-soft:#6FE9FB;--pd-ink-soft:#AFC2DC;--pd-glass-border:rgba(255,255,255,0.14);--pd-glass-bg:rgba(255,255,255,0.055);}' +
      'html,body{height:100%;margin:0;}' +
      'body.portal-desactivado-body{font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#040B1D;color:#EAF3FB;min-height:100vh;overflow-x:hidden;}' +
      '.pd-aurora{position:fixed;inset:-10%;z-index:0;filter:blur(60px);opacity:.55;pointer-events:none;}' +
      '.pd-blob{position:absolute;border-radius:50%;mix-blend-mode:screen;}' +
      '.pd-blob.b1{width:460px;height:460px;top:-120px;left:-100px;background:radial-gradient(circle,var(--pd-cyan) 0%,transparent 70%);animation:pd-mover1 22s ease-in-out infinite;}' +
      '.pd-blob.b2{width:380px;height:380px;bottom:-140px;right:-80px;background:radial-gradient(circle,var(--pd-navy-800) 0%,transparent 70%);animation:pd-mover2 26s ease-in-out infinite;}' +
      '.pd-blob.b3{width:300px;height:300px;top:30%;right:20%;background:radial-gradient(circle,var(--pd-cyan-soft) 0%,transparent 75%);opacity:.5;animation:pd-mover1 19s ease-in-out infinite reverse;}' +
      '@keyframes pd-mover1{0%,100%{transform:translate(0,0);}50%{transform:translate(60px,40px);}}' +
      '@keyframes pd-mover2{0%,100%{transform:translate(0,0);}50%{transform:translate(-50px,-30px);}}' +
      '.pd-contenido{position:relative;z-index:3;max-width:560px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:64px 28px 48px;}' +
      '.pd-cristal-wrap{position:relative;perspective:1100px;margin-bottom:22px;}' +
      '.pd-halo{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(5,219,242,0.28) 0%,transparent 70%);animation:pd-pulso 4.5s ease-in-out infinite;}' +
      '@keyframes pd-pulso{0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(0.92);}50%{opacity:.9;transform:translate(-50%,-50%) scale(1.05);}}' +
      '.pd-cristal{position:relative;width:150px;height:150px;display:block;filter:drop-shadow(0 18px 34px rgba(3,10,25,0.55));transform-style:preserve-3d;animation:pd-girar 13s linear infinite;}' +
      '@keyframes pd-girar{0%{transform:rotateY(0deg);}100%{transform:rotateY(360deg);}}' +
      '.pd-etiqueta{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--pd-cyan-soft);background:rgba(5,219,242,0.1);border:1px solid rgba(5,219,242,0.3);padding:6px 14px;border-radius:999px;margin-bottom:28px;}' +
      '.pd-etiqueta-punto{width:6px;height:6px;border-radius:50%;background:var(--pd-cyan);box-shadow:0 0 8px var(--pd-cyan);}' +
      '.pd-contenido h1{font-size:clamp(26px,4.2vw,36px);line-height:1.18;font-weight:800;letter-spacing:-0.01em;margin:0 0 14px;color:#fff;text-wrap:balance;}' +
      '.pd-cuerpo{font-size:15.5px;line-height:1.6;color:var(--pd-ink-soft);max-width:46ch;margin:0 0 30px;}' +
      '.pd-contacto-card{display:flex;align-items:center;gap:12px;background:var(--pd-glass-bg);border:1px solid var(--pd-glass-border);border-radius:14px;padding:14px 20px;backdrop-filter:blur(8px);}' +
      '.pd-contacto-icono{width:34px;height:34px;border-radius:10px;flex:none;background:rgba(5,219,242,0.14);display:flex;align-items:center;justify-content:center;color:var(--pd-cyan);}' +
      '.pd-contacto-texto{text-align:left;}' +
      '.pd-contacto-label{display:block;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--pd-ink-soft);margin:0 0 2px;}' +
      '.pd-contacto-email{font-size:14.5px;font-weight:700;color:#fff;margin:0;word-break:break-all;}' +
      '.pd-pie{margin-top:34px;font-size:12px;color:rgba(175,194,220,0.55);letter-spacing:.02em;}' +
      '.pd-pie strong{color:rgba(234,243,251,0.75);font-weight:700;}' +
      '@media (prefers-reduced-motion:reduce){.pd-blob,.pd-halo,.pd-cristal{animation:none;}}';
    document.head.appendChild(estilo);

    var metaRobots = document.querySelector('meta[name="robots"]');
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.name = 'robots';
      document.head.appendChild(metaRobots);
    }
    metaRobots.content = 'noindex';
    document.title = 'Portal no disponible | Portal Clarvo tu negocio en orden';

    var contactoHtml = contactoEmail
      ? '<div class="pd-contacto-card">' +
        '<span class="pd-contacto-icono" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v12H4z" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 7l8 6 8-6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
        '<span class="pd-contacto-texto"><span class="pd-contacto-label">Correo de contacto</span>' +
        '<span class="pd-contacto-email">' + contactoEmail.replace(/[<>&]/g, '') + '</span></span>' +
        '</div>'
      : '';

    document.body.className = 'portal-desactivado-body';
    document.body.innerHTML =
      '<div class="pd-aurora" aria-hidden="true"><div class="pd-blob b1"></div><div class="pd-blob b2"></div><div class="pd-blob b3"></div></div>' +
      '<main class="pd-contenido" role="main">' +
      '<div class="pd-cristal-wrap"><div class="pd-halo" aria-hidden="true"></div><img class="pd-cristal" src="/assets/favicon.png" alt="" /></div>' +
      '<span class="pd-etiqueta"><span class="pd-etiqueta-punto" aria-hidden="true"></span>Portal no disponible</span>' +
      '<h1>Portal de clientes desactivado</h1>' +
      '<p class="pd-cuerpo">Este portal no está disponible en este momento. Si necesitas ayuda o tienes dudas sobre tu cuenta, contacta al administrador de tu empresa.</p>' +
      contactoHtml +
      '<p class="pd-pie"><strong>Clarvo</strong> · tu negocio en orden</p>' +
      '</main>';
  }

  fetch(API_TEMA, { headers: { Accept: 'application/json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (datos) {
      if (datos.fuentesGoogle && datos.fuentesGoogle.length > 0) {
        cargarFuentesGoogle(datos.fuentesGoogle);
      }
      if (datos.variables && Object.keys(datos.variables).length > 0) {
        aplicarVariables(datos.variables);
      }
      personalizarIdentidad(datos);
      if (paginaEsPortalCliente() && datos.portalClientesHabilitado === false) {
        mostrarPortalDesactivado(datos.contactoEmailPortalApagado || null);
      }
    })
    .catch(function (err) {
      // Degradación silenciosa al diseño base ADDV.
      if (window.console && console.warn) {
        console.warn('No se pudo aplicar el tema del tenant:', err && err.message);
      }
    });
})();