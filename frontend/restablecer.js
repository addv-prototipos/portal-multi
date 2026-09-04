(() => {
  'use strict';

  // CSP (auditoría 2026-09-03, hallazgo #11): movido aquí desde un
  // <script> inline en restablecer.html — script-src ya no necesita
  // 'unsafe-inline'.
  const authAnioEl = document.getElementById('auth-anio');
  if (authAnioEl) authAnioEl.textContent = String(new Date().getFullYear());

  // Multi-tenant (segmento 4, ver PROJECT_STATE.md): misma detección que
  // login.js/portal.js, duplicada aquí a propósito (sin build step, cada
  // página trae sus propias constantes). Debe coincidir exactamente con
  // frontend/nginx.conf.
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

  function urlPagina(pagina) {
    return TENANT_SLUG ? `/${TENANT_SLUG}/${pagina}` : `/${pagina}`;
  }

  const els = {
    panelRestablecer: document.getElementById('panel-restablecer'),
    panelInvalido: document.getElementById('panel-restablecer-invalido'),
    panelExito: document.getElementById('panel-restablecer-exito'),
    formRestablecer: document.getElementById('form-restablecer'),
    password: document.getElementById('restablecer-password'),
    passwordConfirmar: document.getElementById('restablecer-password-confirmar'),
    btnRestablecer: document.getElementById('btn-restablecer'),
    btnRestablecerLabel: document.getElementById('btn-restablecer-label'),
    errorGeneral: document.getElementById('restablecer-error-general'),
    linkInvalidoLogin: document.getElementById('link-restablecer-invalido-login'),
    linkExitoLogin: document.getElementById('link-restablecer-exito-login'),
  };

  function mostrarPanel(panel) {
    els.panelRestablecer.classList.toggle('is-active', panel === 'restablecer');
    els.panelInvalido.classList.toggle('is-active', panel === 'invalido');
    els.panelExito.classList.toggle('is-active', panel === 'exito');
  }

  function setFieldError(id, mensaje) {
    const el = document.getElementById(`error-${id}`);
    if (el) el.textContent = mensaje || '';
  }

  // ---------- Mostrar/ocultar contraseña ----------
  document.querySelectorAll('.btn-toggle-pass').forEach((boton) => {
    boton.addEventListener('click', () => {
      const input = document.getElementById(boton.dataset.target);
      const mostrando = input.type === 'password';
      input.type = mostrando ? 'text' : 'password';
      boton.setAttribute('aria-pressed', String(mostrando));
      boton.setAttribute('aria-label', mostrando ? 'Ocultar contraseña' : 'Mostrar contraseña');
      boton.classList.toggle('is-visible', mostrando);
    });
  });

  // ---------- Validación en vivo de la contraseña ----------
  function evaluarReglasPassword(password) {
    return {
      longitud: password.length >= 8,
      numero: /[0-9]/.test(password),
      minuscula: /[a-z]/.test(password),
      mayuscula: /[A-Z]/.test(password),
    };
  }

  els.password.addEventListener('input', () => {
    const reglas = evaluarReglasPassword(els.password.value);
    Object.entries(reglas).forEach(([clave, cumple]) => {
      const li = document.querySelector(`#restablecer-password-reglas [data-regla="${clave}"]`);
      if (li) li.classList.toggle('is-cumplida', cumple);
    });
  });

  function passwordEsValida(password) {
    const reglas = evaluarReglasPassword(password);
    return Object.values(reglas).every(Boolean);
  }

  function setRestablecerLoading(cargando) {
    els.btnRestablecer.disabled = cargando;
    els.btnRestablecer.setAttribute('aria-busy', String(cargando));
    els.btnRestablecerLabel.textContent = cargando ? 'Guardando…' : 'Guardar y continuar';
  }

  const token = new URLSearchParams(window.location.search).get('token') || '';

  els.formRestablecer.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldError('restablecer-password', '');
    setFieldError('restablecer-password-confirmar', '');
    els.errorGeneral.textContent = '';

    const password = els.password.value;
    const passwordConfirmar = els.passwordConfirmar.value;

    let valido = true;
    if (!passwordEsValida(password)) {
      setFieldError('restablecer-password', 'Tu contraseña no cumple con los requisitos de arriba.');
      valido = false;
    }
    if (password !== passwordConfirmar) {
      setFieldError('restablecer-password-confirmar', 'Las contraseñas no coinciden.');
      valido = false;
    }
    if (!valido) return;

    setRestablecerLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/restablecer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.codigo === 'TOKEN_INVALIDO') {
          mostrarPanel('invalido');
          return;
        }
        els.errorGeneral.textContent = data.error || 'No se pudo actualizar tu contraseña.';
        return;
      }

      // El destino de "Ir a iniciar sesión" depende del perfil de la
      // cuenta que se acaba de recuperar: cliente entra por /login,
      // administrador/fiscal por /admin — mismo criterio que ya usa
      // enviarInvitacionPortal en el backend.
      const destino = data.perfil === 'cliente' ? urlPagina('login') : urlPagina('admin');
      els.linkExitoLogin.setAttribute('href', destino);
      mostrarPanel('exito');
    } catch (err) {
      els.errorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setRestablecerLoading(false);
    }
  });

  (function init() {
    els.linkInvalidoLogin.setAttribute('href', urlPagina('login'));
    els.linkExitoLogin.setAttribute('href', urlPagina('login'));
    if (!token) {
      mostrarPanel('invalido');
      return;
    }
    mostrarPanel('restablecer');
  })();
})();
