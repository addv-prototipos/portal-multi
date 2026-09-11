const { pool } = require('../db');
const { isValidRFC, isValidEmail } = require('./validate');

// Campos que el administrador puede marcar como obligatorios u opcionales.
// El correo y el archivo NO son configurables: el correo es la llave única
// del registro y el archivo es el propósito central del formulario, así
// que siempre son obligatorios. El nombre/razón social tampoco es
// configurable: ya no lo captura el usuario, se extrae automáticamente
// del PDF (ver backend/utils/pdfExtract.js). "uso_cfdi", "tipo_pago" y
// "comentarios" ya NO aplican al formulario de constancia (se quitaron de
// ahí) — existen aquí únicamente porque el formulario de subir tickets
// los reutiliza (ver POST /api/tickets en server.js).
const CAMPOS_CONFIGURABLES = ['tipo_persona', 'rfc', 'uso_cfdi', 'tipo_pago', 'comentarios'];

const DEFAULTS = {
  tipo_persona: true,
  rfc: false,
  uso_cfdi: false,
  tipo_pago: false,
  comentarios: false,
};

const CLAVE = 'campos_obligatorios';

async function getCamposObligatorios() {
  const [filas] = await pool.query('SELECT valor FROM configuracion WHERE clave = ?', [CLAVE]);
  if (filas.length === 0) return { ...DEFAULTS };

  try {
    const parsed = JSON.parse(filas[0].valor);
    const resultado = { ...DEFAULTS };
    CAMPOS_CONFIGURABLES.forEach((campo) => {
      if (typeof parsed[campo] === 'boolean') {
        resultado[campo] = parsed[campo];
      }
    });
    return resultado;
  } catch (e) {
    return { ...DEFAULTS };
  }
}

async function setCamposObligatorios(cambios) {
  const actual = await getCamposObligatorios();
  const nuevo = { ...actual };

  CAMPOS_CONFIGURABLES.forEach((campo) => {
    if (typeof cambios[campo] === 'boolean') {
      nuevo[campo] = cambios[campo];
    }
  });

  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE, JSON.stringify(nuevo)]
  );

  return nuevo;
}

// ---------- Retención (borrado automático) de tickets ----------
// Numero de dias despues de subido un ticket tras los cuales se elimina
// automaticamente (imagen, factura si existe, y la fila). Si no esta
// configurado (null), no se borra nada — es una funcion que el
// administrador debe activar explicitamente.

const CLAVE_RETENCION_TICKETS = 'tickets_retencion_dias';

async function getRetencionTicketsDias() {
  const [filas] = await pool.query('SELECT valor FROM configuracion WHERE clave = ?', [CLAVE_RETENCION_TICKETS]);
  if (filas.length === 0) return null;
  const dias = Number(filas[0].valor);
  return Number.isInteger(dias) && dias > 0 ? dias : null;
}

// `dias` en null o 0 desactiva el borrado automático.
async function setRetencionTicketsDias(dias) {
  if (!Number.isInteger(dias) || dias <= 0) {
    await pool.query('DELETE FROM configuracion WHERE clave = ?', [CLAVE_RETENCION_TICKETS]);
    return null;
  }
  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_RETENCION_TICKETS, String(dias)]
  );
  return dias;
}

// ---------- Configuración global: IVA y zona horaria ----------
// Usados al registrar una orden de compra: el IVA se "fotografía" en cada
// orden al crearla (para que un cambio futuro del IVA global no altere
// órdenes ya creadas — ver ordenes_compra.iva_porcentaje en db.js), y la
// zona horaria determina cómo se auto-genera y se muestra la fecha/hora
// de compra.

// Zonas horarias válidas en México: identificadores reales de la base de
// datos de zonas horarias IANA/tz (los mismos que usa Node internamente
// para calcular la hora local correctamente, incluyendo horario de
// verano donde todavía aplica) — no un texto libre, para no terminar con
// una zona horaria inválida guardada.
const ZONAS_HORARIAS_MEXICO = [
  { id: 'America/Mexico_City', etiqueta: 'Ciudad de México (Centro)' },
  { id: 'America/Monterrey', etiqueta: 'Monterrey (Centro)' },
  { id: 'America/Matamoros', etiqueta: 'Matamoros (Centro)' },
  { id: 'America/Merida', etiqueta: 'Mérida (Sureste)' },
  { id: 'America/Cancun', etiqueta: 'Cancún (Sureste)' },
  { id: 'America/Chihuahua', etiqueta: 'Chihuahua (Pacífico)' },
  { id: 'America/Ojinaga', etiqueta: 'Ojinaga (Centro/Montaña)' },
  { id: 'America/Mazatlan', etiqueta: 'Mazatlán (Pacífico)' },
  { id: 'America/Bahia_Banderas', etiqueta: 'Bahía de Banderas (Centro)' },
  { id: 'America/Hermosillo', etiqueta: 'Hermosillo (Pacífico, sin horario de verano)' },
  { id: 'America/Tijuana', etiqueta: 'Tijuana (Noroeste)' },
];

const CLAVE_CONFIG_GLOBAL = 'configuracion_global';
const DEFAULTS_CONFIG_GLOBAL = {
  iva_porcentaje: 16, // tasa general de IVA vigente en México
  zona_horaria: 'America/Mexico_City',
  // Logo para correos con diseño de "ticket" (ver el de "orden de
  // compra" en server.js). Parametrizado a propósito, aunque todavía no
  // hay una pantalla en el panel para configurarlo — se deja el campo y
  // la lectura/escritura ya listos para cuando se agregue esa pantalla
  // (subir una imagen, o capturar la URL de un logo ya alojado en algún
  // lado). Mientras tanto, con esto en null, el correo usa un logo de
  // texto simple generado en código (ver logoTicketHtml() en server.js).
  logo_url: null,
  // Interruptor general de la funcionalidad de "Orden de compra". En
  // `true` (el valor por defecto, para no desactivar de golpe algo que
  // ya es parte central del flujo): el botón "Orden de compra" se ve en
  // el panel, y subir un ticket exige verificar la compra (No. Compra,
  // fecha, hora, total) contra una orden real. En `false`: el botón se
  // oculta del panel, y subir un ticket ya no pide ni valida esos cuatro
  // campos — se puede enviar sin ellos, como funcionaba la app antes de
  // que existiera "Orden de compra".
  ordenes_compra_habilitado: true,
  // Método de entrega con el que abre siempre el modal "Registrar venta"
  // (ver PROJECT_STATE.md) — cada venta lo puede cambiar igual, esto solo
  // decide el punto de partida. 'sinticket' por defecto a pedido
  // explícito del usuario (ni correo ni impresión, solo confirma la
  // venta) — antes solo existían 'correo'/'imprimir', ambos hardcodeados
  // a 'correo' al abrir el modal.
  entrega_venta_default: 'sinticket',
  // Punto 244 (Auditoría consultable): interruptor para mostrar/ocultar
  // el menú "Auditoría" (administrador/super) — la tabla `admin_auditoria`
  // sigue registrando todo acceso pase lo que pase (segmento 7, sin
  // relación con este switch), esto solo controla si hay una pantalla
  // para consultarla. `true` por defecto — ya era visible antes de que
  // este switch existiera, apagarlo es una decisión explícita del
  // administrador, no el estado de fábrica.
  auditoria_habilitada: true,
  // Datos fiscales de la propia compañía (no de un cliente) — se
  // muestran en la barra de sesión del panel de administrador junto a
  // "Administración", y si faltan, se avisa al iniciar sesión (ver
  // POST /api/admin/login en server.js). `rfc_compania`,
  // `razon_social_compania`, `regimen_fiscal_compania` y
  // `tipo_persona_compania` ya NO se capturan a mano — se extraen
  // automáticamente al subir la constancia de situación fiscal de la
  // propia compañía (ver POST /api/admin/config/constancia-compania en
  // server.js, que reutiliza exactamente la misma extracción de PDF que
  // ya usa la constancia de un cliente, incluyendo
  // extraerNombreRazonSocial() — la misma función, no una reimplementada
  // aparte, para no repetir los mismos bugs de lectura que ya se
  // encontraron y corrigieron ahí). Empiezan vacíos: ninguno es
  // obligatorio para que el resto de la app funcione, pero sin RFC y
  // clave SAT no se muestra nada extra en la barra de sesión.
  rfc_compania: '',
  razon_social_compania: '',
  regimen_fiscal_compania: '',
  tipo_persona_compania: null, // 'fisica' | 'moral' | null (todavía no se ha subido una constancia)
  clave_sat: '',
  // Correo al que se envían los reportes (automáticos, justo antes del
  // borrado por retención, y manuales, con el botón "Enviar reporte") —
  // ver utils/reportes.js. Vacío por defecto: sin este correo
  // configurado, el reporte igual se genera y se guarda para "Lectura de
  // reportes", pero no se envía nada por correo.
  correo_reportes: '',
  // Correo de contacto de la empresa — SOLO aplica al sitio base (sin
  // tenant): para un tenant real, este mismo dato vive en
  // control_tenants.tenants.contacto_email (editable desde /control o
  // PUT /api/admin/config/contacto-cliente con req.tenant presente) y
  // NUNCA se guarda aquí. Opcional a propósito (a diferencia del
  // tenant, donde es obligatorio) — mientras esté vacío, la burbuja
  // "Solicitar aclaraciones" del portal del sitio base simplemente no
  // aparece (ver GET /api/aclaraciones/disponible).
  contacto_email_cliente: '',
};

async function getConfiguracionGlobal() {
  const [filas] = await pool.query('SELECT valor FROM configuracion WHERE clave = ?', [CLAVE_CONFIG_GLOBAL]);
  if (filas.length === 0) return { ...DEFAULTS_CONFIG_GLOBAL };

  try {
    const parsed = JSON.parse(filas[0].valor);
    const resultado = { ...DEFAULTS_CONFIG_GLOBAL };
    if (typeof parsed.iva_porcentaje === 'number' && parsed.iva_porcentaje >= 0 && parsed.iva_porcentaje <= 100) {
      resultado.iva_porcentaje = parsed.iva_porcentaje;
    }
    if (typeof parsed.zona_horaria === 'string' && ZONAS_HORARIAS_MEXICO.some((z) => z.id === parsed.zona_horaria)) {
      resultado.zona_horaria = parsed.zona_horaria;
    }
    if (typeof parsed.logo_url === 'string' && parsed.logo_url.trim()) {
      resultado.logo_url = parsed.logo_url.trim();
    }
    if (typeof parsed.ordenes_compra_habilitado === 'boolean') {
      resultado.ordenes_compra_habilitado = parsed.ordenes_compra_habilitado;
    }
    if (['correo', 'imprimir', 'sinticket'].includes(parsed.entrega_venta_default)) {
      resultado.entrega_venta_default = parsed.entrega_venta_default;
    }
    if (typeof parsed.auditoria_habilitada === 'boolean') {
      resultado.auditoria_habilitada = parsed.auditoria_habilitada;
    }
    if (typeof parsed.rfc_compania === 'string') {
      resultado.rfc_compania = parsed.rfc_compania.trim().toUpperCase();
    }
    if (typeof parsed.razon_social_compania === 'string') {
      resultado.razon_social_compania = parsed.razon_social_compania.trim();
    }
    if (typeof parsed.regimen_fiscal_compania === 'string') {
      resultado.regimen_fiscal_compania = parsed.regimen_fiscal_compania.trim();
    }
    if (parsed.tipo_persona_compania === 'fisica' || parsed.tipo_persona_compania === 'moral') {
      resultado.tipo_persona_compania = parsed.tipo_persona_compania;
    }
    // "clave_sat" reemplaza al nombre anterior "codigo_sat" — se lee el
    // nombre nuevo si ya existe, y si no, se cae de vuelta al nombre
    // viejo (para no perder un valor ya guardado antes de este cambio).
    if (typeof parsed.clave_sat === 'string') {
      resultado.clave_sat = parsed.clave_sat.trim();
    } else if (typeof parsed.codigo_sat === 'string') {
      resultado.clave_sat = parsed.codigo_sat.trim();
    }
    if (typeof parsed.correo_reportes === 'string') {
      resultado.correo_reportes = parsed.correo_reportes.trim().toLowerCase();
    }
    if (typeof parsed.contacto_email_cliente === 'string') {
      resultado.contacto_email_cliente = parsed.contacto_email_cliente.trim().toLowerCase();
    }
    return resultado;
  } catch (e) {
    return { ...DEFAULTS_CONFIG_GLOBAL };
  }
}

async function setConfiguracionGlobal(cambios) {
  const actual = await getConfiguracionGlobal();
  const nuevo = { ...actual };

  if (cambios.iva_porcentaje !== undefined) {
    const iva = Number(cambios.iva_porcentaje);
    if (!Number.isFinite(iva) || iva < 0 || iva > 100) {
      throw new Error('El IVA debe ser un porcentaje entre 0 y 100.');
    }
    nuevo.iva_porcentaje = iva;
  }

  if (cambios.zona_horaria !== undefined) {
    if (!ZONAS_HORARIAS_MEXICO.some((z) => z.id === cambios.zona_horaria)) {
      throw new Error('Selecciona una zona horaria válida.');
    }
    nuevo.zona_horaria = cambios.zona_horaria;
  }

  if (cambios.logo_url !== undefined) {
    const logo = typeof cambios.logo_url === 'string' ? cambios.logo_url.trim() : '';
    nuevo.logo_url = logo || null;
  }

  if (cambios.ordenes_compra_habilitado !== undefined) {
    nuevo.ordenes_compra_habilitado = Boolean(cambios.ordenes_compra_habilitado);
  }

  if (cambios.entrega_venta_default !== undefined) {
    if (!['correo', 'imprimir', 'sinticket'].includes(cambios.entrega_venta_default)) {
      throw new Error('Selecciona un método de entrega por defecto válido.');
    }
    nuevo.entrega_venta_default = cambios.entrega_venta_default;
  }

  if (cambios.auditoria_habilitada !== undefined) {
    nuevo.auditoria_habilitada = Boolean(cambios.auditoria_habilitada);
  }

  // rfc_compania / regimen_fiscal_compania / tipo_persona_compania ya no
  // se mandan desde el formulario general de "Configuraciones fiscales"
  // (se quitó ese campo de ahí) — solo los escribe
  // POST /api/admin/config/constancia-compania, los tres juntos, después
  // de extraerlos de la constancia real. Se deja la validación aquí de
  // todas formas, como red de seguridad, sin importar quién los mande.
  if (cambios.rfc_compania !== undefined) {
    const rfc = typeof cambios.rfc_compania === 'string' ? cambios.rfc_compania.trim().toUpperCase() : '';
    if (!isValidRFC(rfc)) {
      throw new Error('El RFC de la compañía no tiene un formato válido.');
    }
    nuevo.rfc_compania = rfc;
  }
  if (cambios.razon_social_compania !== undefined) {
    nuevo.razon_social_compania = typeof cambios.razon_social_compania === 'string' ? cambios.razon_social_compania.trim() : '';
  }
  if (cambios.regimen_fiscal_compania !== undefined) {
    nuevo.regimen_fiscal_compania = typeof cambios.regimen_fiscal_compania === 'string' ? cambios.regimen_fiscal_compania.trim() : '';
  }
  if (cambios.tipo_persona_compania !== undefined) {
    nuevo.tipo_persona_compania =
      cambios.tipo_persona_compania === 'fisica' || cambios.tipo_persona_compania === 'moral'
        ? cambios.tipo_persona_compania
        : null;
  }

  if (cambios.clave_sat !== undefined) {
    const clave = typeof cambios.clave_sat === 'string' ? cambios.clave_sat.trim() : '';
    if (clave && !/^\d{8}$/.test(clave)) {
      throw new Error('La Clave SAT debe ser exactamente 8 dígitos.');
    }
    nuevo.clave_sat = clave;
  }

  if (cambios.correo_reportes !== undefined) {
    const correo = typeof cambios.correo_reportes === 'string' ? cambios.correo_reportes.trim().toLowerCase() : '';
    if (correo && !isValidEmail(correo)) {
      throw new Error('El correo de reportes no tiene un formato válido.');
    }
    nuevo.correo_reportes = correo;
  }

  if (cambios.contacto_email_cliente !== undefined) {
    const contacto = typeof cambios.contacto_email_cliente === 'string' ? cambios.contacto_email_cliente.trim().toLowerCase() : '';
    if (contacto && !isValidEmail(contacto)) {
      throw new Error('El correo de contacto no tiene un formato válido.');
    }
    nuevo.contacto_email_cliente = contacto;
  }

  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_CONFIG_GLOBAL, JSON.stringify(nuevo)]
  );

  return nuevo;
}

/**
 * Formatea una fecha en la zona horaria configurada, con el formato
 * pedido: fecha "dd/mmm/aaaa" (mes abreviado en español, sin punto) y
 * hora "HH:mm:ss" (24 horas). Usa `Intl.DateTimeFormat`, integrado en
 * Node — no se agregó ninguna librería nueva de fechas/zonas horarias
 * solo para esto.
 */
function formatearFechaHoraMexico(fecha, zonaHoraria) {
  const zona = ZONAS_HORARIAS_MEXICO.some((z) => z.id === zonaHoraria)
    ? zonaHoraria
    : DEFAULTS_CONFIG_GLOBAL.zona_horaria;

  const formateadorFecha = new Intl.DateTimeFormat('es-MX', {
    timeZone: zona,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formateadorHora = new Intl.DateTimeFormat('es-MX', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23', // 00-23, en vez de "hour12: false" (que en algunos
    // motores ICU puede devolver "24" para la medianoche en vez de "00")
  });

  const partesFecha = formateadorFecha.formatToParts(fecha);
  const dia = partesFecha.find((p) => p.type === 'day').value;
  // El mes abreviado en es-MX suele traer un punto (ej. "jul."); se quita
  // para que el resultado sea "24/jul/2026", tal como se pidió.
  const mes = partesFecha.find((p) => p.type === 'month').value.replace(/\./g, '');
  const anio = partesFecha.find((p) => p.type === 'year').value;

  return {
    fecha: `${dia}/${mes}/${anio}`,
    hora: formateadorHora.format(fecha),
  };
}

module.exports = {
  CAMPOS_CONFIGURABLES,
  getCamposObligatorios,
  setCamposObligatorios,
  getRetencionTicketsDias,
  setRetencionTicketsDias,
  ZONAS_HORARIAS_MEXICO,
  getConfiguracionGlobal,
  setConfiguracionGlobal,
  formatearFechaHoraMexico,
};
