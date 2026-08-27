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

  // Misma detección de slug que portal.js (duplicada a propósito: las
  // páginas del frontend se sirven sin bundler y cada script debe poder
  // funcionar solo; el control no tiene slug y usa el diseño base).
  var RUTAS_PAGINA_MULTITENANT = ['dashboard', 'tickets', 'login', 'csf', 'admin', 'restablecer'];
  function detectarTenantSlug() {
    var segmentos = window.location.pathname.split('/').filter(Boolean);
    if (segmentos.length >= 2 && RUTAS_PAGINA_MULTITENANT.indexOf(segmentos[1]) !== -1) {
      return segmentos[0];
    }
    return null;
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
    })
    .catch(function (err) {
      // Degradación silenciosa al diseño base ADDV.
      if (window.console && console.warn) {
        console.warn('No se pudo aplicar el tema del tenant:', err && err.message);
      }
    });
})();