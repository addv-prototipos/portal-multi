(() => {
  'use strict';

  // CSP (auditoría 2026-09-03, hallazgo #11): movido aquí desde un
  // <script> inline en login.html — script-src ya no necesita
  // 'unsafe-inline'.
  const authAnioEl = document.getElementById('auth-anio');
  if (authAnioEl) authAnioEl.textContent = String(new Date().getFullYear());

  // Multi-tenant (segmento 4, ver PROJECT_STATE.md): misma detección que
  // frontend/portal.js — este archivo no lo carga (login.html es la única
  // página que no lo hace), así que se repite aquí, siguiendo el mismo
  // patrón de duplicación ya usado para API_BASE en este proyecto (sin
  // build step, cada página trae sus propias constantes). Debe coincidir
  // exactamente con la detección de portal.js y con las rutas de
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
    panelLogin: document.getElementById('panel-login'),
    panelRegistro: document.getElementById('panel-registro'),
    btnIrRegistro: document.getElementById('btn-ir-registro'),
    btnIrLogin: document.getElementById('btn-ir-login'),

    formLogin: document.getElementById('form-login'),
    loginRfc: document.getElementById('login-rfc'),
    loginPassword: document.getElementById('login-password'),
    btnLogin: document.getElementById('btn-login'),
    btnLoginLabel: document.getElementById('btn-login-label'),
    loginErrorGeneral: document.getElementById('login-error-general'),

    formRegistro: document.getElementById('form-registro'),
    registroRfc: document.getElementById('registro-rfc'),
    registroEmail: document.getElementById('registro-email'),
    registroTelefono: document.getElementById('registro-telefono'),
    registroPassword: document.getElementById('registro-password'),
    registroPasswordConfirmar: document.getElementById('registro-password-confirmar'),
    btnRegistro: document.getElementById('btn-registro'),
    btnRegistroLabel: document.getElementById('btn-registro-label'),
    registroErrorGeneral: document.getElementById('registro-error-general'),

    panelCambiarPassword: document.getElementById('panel-cambiar-password'),
    formCambiarPassword: document.getElementById('form-cambiar-password'),
    cambiarPasswordNueva: document.getElementById('cambiar-password-nueva'),
    cambiarPasswordConfirmar: document.getElementById('cambiar-password-confirmar'),
    btnCambiarPassword: document.getElementById('btn-cambiar-password'),
    btnCambiarPasswordLabel: document.getElementById('btn-cambiar-password-label'),
    cambiarPasswordErrorGeneral: document.getElementById('cambiar-password-error-general'),

    panelRecuperar: document.getElementById('panel-recuperar'),
    btnIrRecuperar: document.getElementById('btn-ir-recuperar'),
    btnRecuperarVolver: document.getElementById('btn-recuperar-volver'),
    formRecuperar: document.getElementById('form-recuperar'),
    recuperarIdentificador: document.getElementById('recuperar-identificador'),
    btnRecuperar: document.getElementById('btn-recuperar'),
    btnRecuperarLabel: document.getElementById('btn-recuperar-label'),
    recuperarErrorGeneral: document.getElementById('recuperar-error-general'),
    recuperarConfirmacion: document.getElementById('recuperar-confirmacion'),

    toast: document.getElementById('toast'),
  };

  function showToast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle('is-error', isError);
    els.toast.hidden = false;
    clearTimeout(showToast._t);
    const duracion = Math.min(9000, Math.max(4000, message.length * 80));
    showToast._t = setTimeout(() => { els.toast.hidden = true; }, duracion);
  }

  function setFieldError(id, mensaje) {
    const el = document.getElementById(`error-${id}`);
    if (el) el.textContent = mensaje || '';
  }

  function validarRFC(rfc) {
    return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(String(rfc || '').trim());
  }

  // Mismo patrón ya usado en app.js (constancia) y admin.js (crear
  // usuario) — se repite aquí en vez de compartir un archivo porque cada
  // página ya se sirve de forma independiente, sin un bundler que junte
  // módulos comunes.
  function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  function validarTelefono(telefono) {
    const limpio = String(telefono || '').replace(/[\s\-()]/g, '');
    return /^\d{10}$/.test(limpio);
  }

  // ---------- Cambiar entre login / registro ----------

  function mostrarPanel(panel) {
    els.panelLogin.classList.toggle('is-active', panel === 'login');
    els.panelRegistro.classList.toggle('is-active', panel === 'registro');
    els.panelCambiarPassword.classList.toggle('is-active', panel === 'cambiar-password');
    els.panelRecuperar.classList.toggle('is-active', panel === 'recuperar');
    const foco = {
      login: els.loginRfc,
      registro: els.registroRfc,
      'cambiar-password': els.cambiarPasswordNueva,
      recuperar: els.recuperarIdentificador,
    }[panel];
    if (foco) foco.focus();
  }

  els.btnIrRegistro.addEventListener('click', () => mostrarPanel('registro'));
  els.btnIrLogin.addEventListener('click', () => mostrarPanel('login'));
  els.btnIrRecuperar.addEventListener('click', () => {
    els.recuperarErrorGeneral.textContent = '';
    els.recuperarConfirmacion.hidden = true;
    els.formRecuperar.hidden = false;
    els.formRecuperar.reset();
    mostrarPanel('recuperar');
  });
  els.btnRecuperarVolver.addEventListener('click', () => mostrarPanel('login'));

  // ---------- Mostrar/ocultar contraseña (todos los campos) ----------

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

  // ---------- Validación en vivo de la contraseña (registro) ----------

  function evaluarReglasPassword(password) {
    return {
      longitud: password.length >= 8,
      numero: /[0-9]/.test(password),
      minuscula: /[a-z]/.test(password),
      mayuscula: /[A-Z]/.test(password),
    };
  }

  els.registroPassword.addEventListener('input', () => {
    const reglas = evaluarReglasPassword(els.registroPassword.value);
    Object.entries(reglas).forEach(([clave, cumple]) => {
      const li = document.querySelector(`#registro-password-reglas [data-regla="${clave}"]`);
      if (li) li.classList.toggle('is-cumplida', cumple);
    });
  });

  els.cambiarPasswordNueva.addEventListener('input', () => {
    const reglas = evaluarReglasPassword(els.cambiarPasswordNueva.value);
    Object.entries(reglas).forEach(([clave, cumple]) => {
      const li = document.querySelector(`#cambiar-password-reglas [data-regla="${clave}"]`);
      if (li) li.classList.toggle('is-cumplida', cumple);
    });
  });

  function passwordEsValida(password) {
    const reglas = evaluarReglasPassword(password);
    return Object.values(reglas).every(Boolean);
  }

  // ---------- Login ----------

  function setLoginLoading(cargando) {
    els.btnLogin.disabled = cargando;
    els.btnLogin.setAttribute('aria-busy', String(cargando));
    els.btnLoginLabel.textContent = cargando ? 'Entrando…' : 'Entrar';
  }

  els.formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldError('login-rfc', '');
    setFieldError('login-password', '');
    els.loginErrorGeneral.textContent = '';

    const rfc = els.loginRfc.value.trim().toUpperCase();
    const password = els.loginPassword.value;

    let valido = true;
    if (!validarRFC(rfc)) {
      setFieldError('login-rfc', 'Ingresa un RFC válido.');
      valido = false;
    }
    if (!password) {
      setFieldError('login-password', 'Ingresa tu contraseña.');
      valido = false;
    }
    if (!valido) return;

    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rfc, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        els.loginErrorGeneral.textContent = data.error || 'No se pudo iniciar sesión.';
        return;
      }

      if (data.debeCambiarPassword) {
        mostrarPanel('cambiar-password');
        return;
      }

      window.location.href = urlPagina('dashboard');
    } catch (err) {
      els.loginErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setLoginLoading(false);
    }
  });

  // ---------- Registro ----------

  function setRegistroLoading(cargando) {
    els.btnRegistro.disabled = cargando;
    els.btnRegistro.setAttribute('aria-busy', String(cargando));
    els.btnRegistroLabel.textContent = cargando ? 'Creando cuenta…' : 'Crear cuenta';
  }

  els.formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    ['registro-rfc', 'registro-email', 'registro-telefono', 'registro-password', 'registro-password-confirmar'].forEach((id) =>
      setFieldError(id, '')
    );
    els.registroErrorGeneral.textContent = '';

    const rfc = els.registroRfc.value.trim().toUpperCase();
    const email = els.registroEmail.value.trim().toLowerCase();
    const telefono = els.registroTelefono.value.trim();
    const password = els.registroPassword.value;
    const passwordConfirmar = els.registroPasswordConfirmar.value;

    let valido = true;
    if (!validarRFC(rfc)) {
      setFieldError('registro-rfc', 'Ingresa un RFC válido.');
      valido = false;
    }
    if (!validarEmail(email)) {
      setFieldError('registro-email', 'Ingresa un correo electrónico válido.');
      valido = false;
    }
    if (!validarTelefono(telefono)) {
      setFieldError('registro-telefono', 'Ingresa un teléfono a 10 dígitos.');
      valido = false;
    }
    if (!passwordEsValida(password)) {
      setFieldError('registro-password', 'Tu contraseña no cumple con los requisitos de arriba.');
      valido = false;
    }
    if (password !== passwordConfirmar) {
      setFieldError('registro-password-confirmar', 'Las contraseñas no coinciden.');
      valido = false;
    }
    if (!valido) return;

    setRegistroLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rfc, email, telefono, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        els.registroErrorGeneral.textContent = data.error || 'No se pudo crear la cuenta.';
        return;
      }

      showToast('Cuenta creada correctamente.');
      window.location.href = urlPagina('dashboard');
    } catch (err) {
      els.registroErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setRegistroLoading(false);
    }
  });

  // ---------- Cambio de contraseña obligatorio ----------
  // Se usa tanto justo despues de un login con debeCambiarPassword=true,
  // como al entrar con una sesion ya activa que sigue marcada asi (ver
  // init() abajo). Una vez guardada la nueva contraseña, el servidor apaga
  // la bandera "debe_cambiar_password" (ver PUT /api/auth/password) — así
  // que esta pantalla no se vuelve a mostrar en el siguiente inicio de
  // sesión, y el checkbox "Forzar cambio" que el administrador marcó queda,
  // en los hechos, inactivo hasta que se vuelva a marcar explícitamente.

  function setCambiarPasswordLoading(cargando) {
    els.btnCambiarPassword.disabled = cargando;
    els.btnCambiarPassword.setAttribute('aria-busy', String(cargando));
    els.btnCambiarPasswordLabel.textContent = cargando ? 'Guardando…' : 'Guardar y continuar';
  }

  els.formCambiarPassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldError('cambiar-password-nueva', '');
    setFieldError('cambiar-password-confirmar', '');
    els.cambiarPasswordErrorGeneral.textContent = '';

    const password = els.cambiarPasswordNueva.value;
    const passwordConfirmar = els.cambiarPasswordConfirmar.value;

    let valido = true;
    if (!passwordEsValida(password)) {
      setFieldError('cambiar-password-nueva', 'Tu contraseña no cumple con los requisitos de arriba.');
      valido = false;
    }
    if (password !== passwordConfirmar) {
      setFieldError('cambiar-password-confirmar', 'Las contraseñas no coinciden.');
      valido = false;
    }
    if (!valido) return;

    setCambiarPasswordLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        // La sesión temporal expiró mientras llenaba el formulario: se
        // manda de vuelta al login normal en vez de dejarlo atorado aquí.
        mostrarPanel('login');
        els.loginErrorGeneral.textContent = 'Tu sesión expiró. Inicia sesión de nuevo.';
        return;
      }
      if (!res.ok) {
        els.cambiarPasswordErrorGeneral.textContent = data.error || 'No se pudo actualizar tu contraseña.';
        return;
      }

      showToast('Contraseña actualizada correctamente.');
      window.location.href = urlPagina('dashboard');
    } catch (err) {
      els.cambiarPasswordErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setCambiarPasswordLoading(false);
    }
  });

  // ---------- Recuperar acceso ----------
  function setRecuperarLoading(cargando) {
    els.btnRecuperar.disabled = cargando;
    els.btnRecuperar.setAttribute('aria-busy', String(cargando));
    els.btnRecuperarLabel.textContent = cargando ? 'Enviando…' : 'Enviar enlace de recuperación';
  }

  els.formRecuperar.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldError('recuperar-identificador', '');
    els.recuperarErrorGeneral.textContent = '';

    const identificador = els.recuperarIdentificador.value.trim();
    if (!identificador) {
      setFieldError('recuperar-identificador', 'Escribe tu correo o tu RFC.');
      return;
    }

    setRecuperarLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/recuperar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.recuperarErrorGeneral.textContent = data.error || 'No se pudo procesar la solicitud.';
        return;
      }
      // Mensaje siempre genérico (exista o no la cuenta) — se muestra tal
      // cual venga del backend, es el mismo texto sin importar el resultado.
      els.formRecuperar.hidden = true;
      els.recuperarConfirmacion.hidden = false;
    } catch (err) {
      els.recuperarErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setRecuperarLoading(false);
    }
  });

  // ---------- Tooltips (Fase 4 UX, paridad con portal.js/admin.js/control.js) ----------
  // login.html es la única página del portal de cliente que no carga
  // portal.js (ver nota de RUTAS_PAGINA_MULTITENANT arriba), así que este
  // componente se repite aquí — mismo criterio de duplicación del resto
  // del archivo. Idéntico a inicializarTooltips() de portal.js.
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

  // ---------- Inicialización ----------
  // Si ya hay una sesión activa, no tiene sentido mostrar el login: se
  // manda directo al tablero — salvo que esa cuenta todavía tenga
  // pendiente el cambio de contraseña obligatorio, en cuyo caso se
  // muestra esa pantalla directamente (sin pedir credenciales de nuevo,
  // ya que la sesión sigue siendo válida).

  (async function init() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.debeCambiarPassword) {
          mostrarPanel('cambiar-password');
          return;
        }
        window.location.href = urlPagina('dashboard');
      }
    } catch (err) {
      // Sin conexión momentánea: se deja el login visible con normalidad.
    }
  })();
})();
