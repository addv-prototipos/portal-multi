/* Kerberos — lógica de la pantalla de acceso.
   Archivo aparte y no <script> inline a propósito: la CSP de
   kerberos/server.js declara scriptSrc: ["'self'"] SIN 'unsafe-inline',
   así que cualquier script embebido en el HTML queda bloqueado por el
   navegador sin ningún error visible en la página. */
(function () {
  'use strict';

  var form = document.getElementById('form-login');
  var inputUsuario = document.getElementById('usuario');
  var inputContrasena = document.getElementById('contrasena');
  var btnEntrar = document.getElementById('btn-entrar');
  var btnVer = document.getElementById('btn-ver-contrasena');
  var iconoOjo = document.getElementById('icono-ojo');
  var cajaError = document.getElementById('error-login');

  var OJO_ABIERTO =
    '<path d="M1.8 12s3.9-7 10.2-7 10.2 7 10.2 7-3.9 7-10.2 7S1.8 12 1.8 12Z"/>' +
    '<circle cx="12" cy="12" r="3"/>';
  var OJO_TACHADO =
    '<path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6.3 0 10.2 7 10.2 7a18 18 0 0 1-2.4 3.3"/>' +
    '<path d="M6.3 6.5A17.7 17.7 0 0 0 1.8 12s3.9 7 10.2 7a9.7 9.7 0 0 0 4-.8"/>' +
    '<path d="M10 10a2.8 2.8 0 0 0 4 4"/><path d="m3 3 18 18"/>';

  function mostrarError(mensaje) {
    cajaError.textContent = mensaje;
  }

  function limpiarError() {
    if (cajaError.textContent) cajaError.textContent = '';
  }

  // Si ya hay token guardado (el operador recargó el login con sesión
  // viva), no tiene por qué volver a teclear nada.
  if (window.KerberosSesion.getToken()) {
    window.location.replace('/kerberos/dashboard.html');
    return;
  }

  btnVer.addEventListener('click', function () {
    var mostrando = inputContrasena.type === 'text';
    inputContrasena.type = mostrando ? 'password' : 'text';
    btnVer.setAttribute('aria-pressed', mostrando ? 'false' : 'true');
    btnVer.setAttribute('aria-label', mostrando ? 'Mostrar contraseña' : 'Ocultar contraseña');
    iconoOjo.innerHTML = mostrando ? OJO_ABIERTO : OJO_TACHADO;
    inputContrasena.focus();
  });

  inputUsuario.addEventListener('input', limpiarError);
  inputContrasena.addEventListener('input', limpiarError);

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    limpiarError();

    var usuario = inputUsuario.value.trim();
    var contrasena = inputContrasena.value;

    if (!usuario || !contrasena) {
      mostrarError('Escribe tu usuario y tu contraseña.');
      (usuario ? inputContrasena : inputUsuario).focus();
      return;
    }

    btnEntrar.disabled = true;
    btnEntrar.textContent = 'Entrando...';

    function liberarBoton() {
      btnEntrar.disabled = false;
      btnEntrar.textContent = 'Entrar';
    }

    var encoded = window.KerberosSesion.base64Utf8(usuario + ':' + contrasena);

    fetch('/kerberos/api/me', { headers: { Authorization: 'Basic ' + encoded } })
      .then(function (res) {
        if (res.status === 401) {
          liberarBoton();
          mostrarError('Usuario o contraseña incorrectos.');
          inputContrasena.value = '';
          inputContrasena.focus();
          return null;
        }
        if (res.status === 429) {
          liberarBoton();
          mostrarError('Demasiados intentos. Espera unos minutos y vuelve a intentar.');
          return null;
        }
        if (!res.ok) {
          liberarBoton();
          mostrarError('No se pudo iniciar sesión. Intenta de nuevo.');
          return null;
        }

        // El interceptor de sesion.js ya guardó el token de esta misma
        // respuesta; se vuelve a leer aquí para no depender de ese efecto
        // secundario si el orden de carga cambiara.
        var tokenFresco = res.headers.get('X-Kerberos-Session-Token');
        if (tokenFresco) window.KerberosSesion.guardarToken(tokenFresco);

        return res.json().then(function () {
          if (!window.KerberosSesion.getToken()) {
            liberarBoton();
            mostrarError('No se pudo iniciar sesión. Intenta de nuevo.');
            return;
          }
          window.KerberosSesion.guardarUsuario(usuario);
          window.location.href = '/kerberos/dashboard.html';
        }, function () {
          liberarBoton();
          mostrarError('No se pudo iniciar sesión. Intenta de nuevo.');
        });
      })
      .catch(function () {
        liberarBoton();
        mostrarError('No se pudo conectar con el servidor.');
      });
  });
})();
