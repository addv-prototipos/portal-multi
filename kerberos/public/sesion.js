/* Kerberos — sesión compartida entre login.html y dashboard.html.
   Mismo patrón que frontend/control.js: no hay cookie ni ruta /login
   dedicada; el formulario manda Basic Auth contra GET /api/kerberos/me y
   el token de sesión (Bearer, 30 min deslizante) viaja en la cabecera
   X-Kerberos-Session-Token de esa misma respuesta. Sin bundler: este
   archivo se carga con <script src> en ambas páginas y publica un solo
   objeto global. */
(function () {
  'use strict';

  var API_BASE = '/kerberos/api';
  var CLAVE_TOKEN = 'kerberos_session_token';
  var CLAVE_USUARIO = 'kerberos_session_usuario';
  var CABECERA_TOKEN = 'X-Kerberos-Session-Token';

  function leer(clave) {
    try {
      return sessionStorage.getItem(clave);
    } catch (_) {
      // Navegador con almacenamiento bloqueado: la sesión sigue
      // funcionando dentro de la página, solo no sobrevive una recarga.
      return null;
    }
  }

  function guardar(clave, valor) {
    try {
      sessionStorage.setItem(clave, valor);
    } catch (_) {
      // Mismo criterio que arriba.
    }
  }

  function borrar(clave) {
    try {
      sessionStorage.removeItem(clave);
    } catch (_) {
      // Mismo criterio que arriba.
    }
  }

  // Reemplazo moderno de unescape() para codificar UTF-8 a base64 sin
  // perder bytes (duplicado de control.js/admin.js — sin bundler, se
  // duplica a propósito).
  function base64Utf8(texto) {
    var bytes = new TextEncoder().encode(texto);
    var binario = '';
    bytes.forEach(function (b) { binario += String.fromCharCode(b); });
    return btoa(binario);
  }

  // Interceptor global de fetch(): CUALQUIER respuesta de /api/kerberos/*
  // puede traer un token fresco (sesión deslizante), no solo la del
  // login — sin esto la sesión caduca a los 30 min aunque el operador
  // esté mirando el tablero. Mismo patrón que control.js.
  var fetchOriginal = window.fetch.bind(window);
  window.fetch = function fetchConRenovacionDeToken(recurso, opciones) {
    return fetchOriginal(recurso, opciones).then(function (res) {
      var url = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
      if (url.indexOf(API_BASE) === 0) {
        var tokenFresco = res.headers.get(CABECERA_TOKEN);
        if (tokenFresco) guardar(CLAVE_TOKEN, tokenFresco);
      }
      return res;
    });
  };

  function getToken() { return leer(CLAVE_TOKEN); }
  function getUsuario() { return leer(CLAVE_USUARIO); }

  function getAuthHeader() {
    var token = getToken();
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  function limpiarSesion() {
    borrar(CLAVE_TOKEN);
    borrar(CLAVE_USUARIO);
  }

  // Error tipado para que quien llame distinga "la sesión caducó" (hay
  // que volver al login) de "no se pudo leer este dato" (se muestra un
  // estado vacío y el polling sigue).
  function ErrorSesion() {
    this.name = 'ErrorSesion';
    this.message = 'Sesión expirada.';
  }
  ErrorSesion.prototype = Object.create(Error.prototype);

  // GET autenticado a /api/kerberos/*. Devuelve el cuerpo ya parseado y
  // lanza ErrorSesion en 401 para que el llamador vuelva al login.
  function pedir(ruta) {
    return fetch(API_BASE + ruta, { headers: getAuthHeader() }).then(function (res) {
      if (res.status === 401) {
        limpiarSesion();
        throw new ErrorSesion();
      }
      return res.json().then(function (cuerpo) {
        if (!res.ok || cuerpo.ok === false) {
          throw new Error((cuerpo && cuerpo.error) || 'No se pudo leer el dato.');
        }
        return cuerpo;
      }, function () {
        throw new Error('El servidor respondió algo que no se pudo leer.');
      });
    });
  }

  window.KerberosSesion = {
    API_BASE: API_BASE,
    base64Utf8: base64Utf8,
    guardarToken: function (token) { guardar(CLAVE_TOKEN, token); },
    guardarUsuario: function (usuario) { guardar(CLAVE_USUARIO, usuario); },
    getToken: getToken,
    getUsuario: getUsuario,
    getAuthHeader: getAuthHeader,
    limpiarSesion: limpiarSesion,
    pedir: pedir,
    ErrorSesion: ErrorSesion,
  };
})();
