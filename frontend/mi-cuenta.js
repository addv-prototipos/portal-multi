(() => {
  'use strict';

  const { API_BASE, showToast, requireSession } = window.Portal;

  const els = {
    formDatos: document.getElementById('form-datos'),
    datosNombre: document.getElementById('datos-nombre'),
    datosTelefono: document.getElementById('datos-telefono'),
    datosEmail: document.getElementById('datos-email'),
    hintDatosEmail: document.getElementById('hint-datos-email'),
    btnDatos: document.getElementById('btn-datos'),
    btnDatosLabel: document.getElementById('btn-datos-label'),
    datosErrorGeneral: document.getElementById('datos-error-general'),

    formPassword: document.getElementById('form-password'),
    passwordActual: document.getElementById('password-actual'),
    passwordNueva: document.getElementById('password-nueva'),
    passwordConfirmar: document.getElementById('password-confirmar'),
    btnPassword: document.getElementById('btn-password'),
    btnPasswordLabel: document.getElementById('btn-password-label'),
    passwordErrorGeneral: document.getElementById('password-error-general'),
  };

  function setFieldError(id, mensaje) {
    const el = document.getElementById(`error-${id}`);
    if (el) el.textContent = mensaje || '';
  }

  // Mismo patrón ya usado en login.js/app.js/admin.js — sin bundler, cada
  // página repite sus propios validadores en vez de compartir un módulo.
  function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  function validarTelefono(telefono) {
    const limpio = String(telefono || '').replace(/[\s\-()]/g, '');
    return /^\d{10}$/.test(limpio);
  }

  function evaluarReglasPassword(password) {
    return {
      longitud: password.length >= 8,
      numero: /[0-9]/.test(password),
      minuscula: /[a-z]/.test(password),
      mayuscula: /[A-Z]/.test(password),
    };
  }

  function passwordEsValida(password) {
    const reglas = evaluarReglasPassword(password);
    return Object.values(reglas).every(Boolean);
  }

  els.passwordNueva.addEventListener('input', () => {
    const reglas = evaluarReglasPassword(els.passwordNueva.value);
    Object.entries(reglas).forEach(([clave, cumple]) => {
      const li = document.querySelector(`#password-reglas [data-regla="${clave}"]`);
      if (li) li.classList.toggle('is-cumplida', cumple);
    });
  });

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

  // ---------- Cargar datos actuales ----------
  let emailOriginal = '';

  async function cargarMiCuenta() {
    try {
      const res = await fetch(`${API_BASE}/mi-cuenta`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      els.datosNombre.value = data.nombre || '';
      els.datosTelefono.value = data.telefono || '';
      els.datosEmail.value = data.email || '';
      emailOriginal = data.email || '';
      // El aviso de impacto en Gestión de crédito solo aplica si ya hay un
      // correo capturado — un cliente sin correo aún no tiene nada que
      // pudiera verse afectado.
      if (els.hintDatosEmail) els.hintDatosEmail.hidden = !emailOriginal;
    } catch (err) {
      els.datosErrorGeneral.textContent = 'No se pudieron cargar tus datos.';
    }
  }

  if (els.datosEmail && els.hintDatosEmail) {
    els.datosEmail.addEventListener('input', () => {
      els.hintDatosEmail.hidden = !(emailOriginal && els.datosEmail.value.trim().toLowerCase() !== emailOriginal.toLowerCase());
    });
  }

  // ---------- Guardar datos de contacto ----------
  function setDatosLoading(cargando) {
    els.btnDatos.disabled = cargando;
    els.btnDatos.setAttribute('aria-busy', String(cargando));
    els.btnDatosLabel.textContent = cargando ? 'Guardando…' : 'Guardar cambios';
  }

  els.formDatos.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldError('datos-nombre', '');
    setFieldError('datos-telefono', '');
    setFieldError('datos-email', '');
    els.datosErrorGeneral.textContent = '';

    const nombre = els.datosNombre.value.trim();
    const telefono = els.datosTelefono.value.trim();
    const email = els.datosEmail.value.trim();

    let valido = true;
    if (!telefono || !validarTelefono(telefono)) {
      setFieldError('datos-telefono', 'Ingresa un teléfono válido a 10 dígitos.');
      valido = false;
    }
    if (!email || !validarEmail(email)) {
      setFieldError('datos-email', 'Ingresa un correo válido.');
      valido = false;
    }
    if (!valido) return;

    setDatosLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mi-cuenta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nombre, telefono, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) setFieldError('datos-email', data.error || 'Ese correo ya está en uso.');
        else els.datosErrorGeneral.textContent = data.error || 'No se pudieron guardar tus datos.';
        return;
      }
      emailOriginal = email;
      if (els.hintDatosEmail) els.hintDatosEmail.hidden = true;
      showToast('Tus datos se actualizaron correctamente.');
    } catch (err) {
      els.datosErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setDatosLoading(false);
    }
  });

  // ---------- Cambiar contraseña ----------
  function setPasswordLoading(cargando) {
    els.btnPassword.disabled = cargando;
    els.btnPassword.setAttribute('aria-busy', String(cargando));
    els.btnPasswordLabel.textContent = cargando ? 'Actualizando…' : 'Actualizar contraseña';
  }

  els.formPassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldError('password-actual', '');
    setFieldError('password-nueva', '');
    setFieldError('password-confirmar', '');
    els.passwordErrorGeneral.textContent = '';

    const passwordActual = els.passwordActual.value;
    const passwordNueva = els.passwordNueva.value;
    const passwordConfirmar = els.passwordConfirmar.value;

    let valido = true;
    if (!passwordActual) {
      setFieldError('password-actual', 'Ingresa tu contraseña actual.');
      valido = false;
    }
    if (!passwordEsValida(passwordNueva)) {
      setFieldError('password-nueva', 'Tu contraseña no cumple con los requisitos de arriba.');
      valido = false;
    }
    if (passwordNueva !== passwordConfirmar) {
      setFieldError('password-confirmar', 'Las contraseñas no coinciden.');
      valido = false;
    }
    if (!valido) return;

    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mi-cuenta/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password_actual: passwordActual, password_nueva: passwordNueva }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400 && /actual/i.test(data.error || '')) setFieldError('password-actual', data.error);
        else els.passwordErrorGeneral.textContent = data.error || 'No se pudo actualizar tu contraseña.';
        return;
      }
      els.formPassword.reset();
      document.querySelectorAll('#password-reglas li').forEach((li) => li.classList.remove('is-cumplida'));
      showToast('Contraseña actualizada correctamente.');
    } catch (err) {
      els.passwordErrorGeneral.textContent = 'No se pudo conectar con el servidor.';
    } finally {
      setPasswordLoading(false);
    }
  });

  document.addEventListener('DOMContentLoaded', async () => {
    const sesionOk = await requireSession();
    if (sesionOk) cargarMiCuenta();
  });
})();
