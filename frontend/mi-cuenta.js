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

    creditoSection: document.getElementById('credito-section'),
    creditoKpis: document.getElementById('credito-kpis'),
    creditoKpiTotal: document.getElementById('credito-kpi-total'),
    creditoKpiPagado: document.getElementById('credito-kpi-pagado'),
    creditoKpiSaldo: document.getElementById('credito-kpi-saldo'),
    creditoVentasWrap: document.getElementById('credito-ventas-wrap'),
    creditoVentasBody: document.getElementById('credito-ventas-body'),
    creditoVentasEmpty: document.getElementById('credito-ventas-empty'),
    creditoAbonosWrap: document.getElementById('credito-abonos-wrap'),
    creditoAbonosBody: document.getElementById('credito-abonos-body'),
    creditoAbonosEmpty: document.getElementById('credito-abonos-empty'),
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

  // ---------- Gestión de crédito (Segmento 3) ----------
  // Mismo patrón de helpers sin módulo compartido que el resto del sitio
  // (sin bundler, cada página repite lo mínimo que necesita).
  function formatearMoneda(valor) {
    return Number(valor || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatearFechaCorta(fechaISO) {
    if (!fechaISO) return '—';
    const fecha = new Date(String(fechaISO).replace(' ', 'T') + (String(fechaISO).includes('Z') ? '' : 'Z'));
    if (Number.isNaN(fecha.getTime())) return '—';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto == null ? '' : String(texto);
    return div.innerHTML;
  }

  async function cargarCredito() {
    if (!els.creditoSection) return;
    // Se muestra desde ya con esqueleto (Esqueleto.*, igual que el resto
    // del sitio) — si resulta ser un 404 (módulo apagado en el plan del
    // tenant) se vuelve a ocultar abajo, sin error; cualquier OTRA falla
    // (red/servidor) se queda visible con el estado de error + reintentar
    // en el mismo bloque, nunca en silencio (antes esta función no tenía
    // ningún estado de carga/error — hallazgo de la revisión de esqueleto
    // de todo el sitio, punto 362).
    els.creditoSection.hidden = false;
    Esqueleto.marcarKpisCargando(els.creditoKpis, true);
    els.creditoVentasWrap.hidden = false;
    els.creditoVentasEmpty.hidden = true;
    els.creditoAbonosWrap.hidden = false;
    els.creditoAbonosEmpty.hidden = true;
    Esqueleto.aplicarEsqueletoTabla(els.creditoVentasBody, 4, 3);
    Esqueleto.aplicarEsqueletoTabla(els.creditoAbonosBody, 4, 3);

    try {
      const res = await fetch(`${API_BASE}/mi-cuenta/credito`, { credentials: 'include' });
      if (res.status === 404) {
        // Módulo Ventas/CxC apagado en el plan del tenant (ver
        // requiereFeature en el backend) — la sección entera se oculta,
        // mismo criterio ya aplicado en el resto del portal/admin esta
        // misma sesión (el candado del backend no basta solo, el
        // frontend también debe ocultar la entrada).
        els.creditoSection.hidden = true;
        return;
      }
      if (!res.ok) {
        Esqueleto.marcarKpisCargando(els.creditoKpis, false);
        Esqueleto.aplicarErrorTabla(els.creditoVentasBody, 4, 'No se pudo cargar tu información de crédito.', cargarCredito);
        Esqueleto.aplicarErrorTabla(els.creditoAbonosBody, 4, 'No se pudo cargar tu historial de abonos.', cargarCredito);
        return;
      }
      const data = await res.json();

      Esqueleto.marcarKpisCargando(els.creditoKpis, false);
      els.creditoKpiTotal.textContent = `$${formatearMoneda(data.resumen.totalFacturado)}`;
      els.creditoKpiPagado.textContent = `$${formatearMoneda(data.resumen.totalPagado)}`;
      els.creditoKpiSaldo.textContent = `$${formatearMoneda(data.resumen.saldoPendiente)}`;

      const ventas = data.ventasPendientes || [];
      Esqueleto.quitarEsqueletoTabla(els.creditoVentasBody);
      els.creditoVentasWrap.hidden = ventas.length === 0;
      els.creditoVentasEmpty.hidden = ventas.length > 0;
      els.creditoVentasBody.innerHTML = ventas
        .map(
          (v) => `
        <tr>
          <td data-label="Venta">${escaparHtml(v.numeroCompra)}</td>
          <td data-label="Fecha">${formatearFechaCorta(v.fechaCompra)}</td>
          <td data-label="Total">$${formatearMoneda(v.total)}</td>
          <td data-label="Saldo">$${formatearMoneda(v.saldo)}</td>
        </tr>`
        )
        .join('');

      const abonos = data.abonos || [];
      Esqueleto.quitarEsqueletoTabla(els.creditoAbonosBody);
      els.creditoAbonosWrap.hidden = abonos.length === 0;
      els.creditoAbonosEmpty.hidden = abonos.length > 0;
      els.creditoAbonosBody.innerHTML = abonos
        .map(
          (a) => `
        <tr>
          <td data-label="Fecha">${formatearFechaCorta(a.creadoEn)}</td>
          <td data-label="Venta">${escaparHtml(a.numeroCompra)}</td>
          <td data-label="Monto">$${formatearMoneda(a.monto)}</td>
          <td data-label="Notas">${escaparHtml(a.notas) || '—'}</td>
        </tr>`
        )
        .join('');
    } catch (err) {
      Esqueleto.marcarKpisCargando(els.creditoKpis, false);
      Esqueleto.aplicarErrorTabla(els.creditoVentasBody, 4, 'No se pudo conectar con el servidor.', cargarCredito);
      Esqueleto.aplicarErrorTabla(els.creditoAbonosBody, 4, 'No se pudo conectar con el servidor.', cargarCredito);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const sesionOk = await requireSession();
    if (sesionOk) {
      cargarMiCuenta();
      cargarCredito();
    }
  });
})();
