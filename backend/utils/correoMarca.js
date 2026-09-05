const fs = require('fs');
const path = require('path');

// Piezas compartidas del "cascarón" de marca CLARVO para correos HTML
// (auditoría de correos de salida, ver PROJECT_STATE.md punto 161) —
// extraídas de backend/server.js para que también las use
// utils/reportes.js (el reporte automático/manual, que originalmente se
// dejó en texto plano por ser tráfico interno, ahora también se
// homologa a pedido del usuario). Única fuente de verdad: server.js y
// reportes.js importan de aquí, nunca duplican este HTML.

const MARCA_DEFECTO = 'ADDV';

function escapeHtmlCorreo(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Logo real de CLARVO para el correo, INCRUSTADO como adjunto CID en vez
// de una <img src="URL">: una URL absoluta depende de que el servidor sea
// alcanzable públicamente desde donde esté el cliente de correo — en
// desarrollo (localhost) o detrás de un proxy no expuesto, la imagen sale
// rota. Incrustado como CID viaja DENTRO del correo, funciona siempre
// (confirmado: se probó primero con URL absoluta y llegó rota en un
// correo real, ver PROJECT_STATE.md punto 133). Copias propias de los
// archivos en backend/assets/ — el backend no tiene acceso al filesystem
// del contenedor frontend, así que se duplican a propósito, mismo
// criterio ya usado para otro código pequeño compartido entre ambos.
//
// 2 variantes (punto 211, 2026-09-05, cambio de logo de marca): "nuevo"
// es el default para todo correo con MARCA_DEFECTO; "legacy" (el logo
// viejo, `branding.png`, el mismo que sigue viendo el portal del cliente
// en login/dashboard/tickets/csf) se usa SOLO en la invitación al portal
// cuando el perfil es "cliente" — su primera impresión debe coincidir
// con el logo que va a ver en cuanto entre a esa página, no con el nuevo
// logo de plataforma que ve el resto del sitio.
const LOGO_CLARVO_CID_NUEVO = 'logo-clarvo-nuevo';
const LOGO_CLARVO_CID_LEGACY = 'logo-clarvo-legacy';
const logoClarvoBufferCache = {};
function obtenerLogoClarvoBuffer(variante) {
  if (!(variante in logoClarvoBufferCache)) {
    const archivo = variante === 'legacy' ? 'branding.png' : 'logo-nuevo.png';
    try {
      logoClarvoBufferCache[variante] = fs.readFileSync(path.join(__dirname, '..', 'assets', archivo));
    } catch (err) {
      logoClarvoBufferCache[variante] = undefined; // no se pudo leer: se cae al texto de respaldo, nunca truena el correo
    }
  }
  return logoClarvoBufferCache[variante] || null;
}

// Sin logo de tenant configurado: si la marca es la de por defecto
// (ningún tenant la sobreescribió), se usa el logo REAL de CLARVO en vez
// de una caja de texto genérica. Un tenant con su propio nombre de marca
// (pero sin logo todavía) sigue viendo su propio texto — nunca el logo de
// CLARVO, que no le pertenece. Devuelve también el adjunto CID que hay
// que mandar junto con el correo (null si no aplica). `usarLogoLegacy`
// (ver comentario arriba) fuerza el logo viejo en vez del nuevo default.
function logoTicketHtml(logoUrl, marca, usarLogoLegacy) {
  if (logoUrl) {
    return {
      html: `<img src="${logoUrl}" alt="Portal de Facturación ${escapeHtmlCorreo(marca)}" style="max-width:180px; max-height:60px; display:block; margin:0 auto;" />`,
      adjunto: null,
    };
  }
  const variante = usarLogoLegacy ? 'legacy' : 'nuevo';
  const cid = usarLogoLegacy ? LOGO_CLARVO_CID_LEGACY : LOGO_CLARVO_CID_NUEVO;
  const bufferLogo = marca === MARCA_DEFECTO ? obtenerLogoClarvoBuffer(variante) : null;
  if (bufferLogo) {
    return {
      html: `<img src="cid:${cid}" alt="CLARVO — Tu negocio bajo control by ADDV" style="max-width:170px; height:auto; display:block; margin:0 auto;" />`,
      adjunto: { filename: 'clarvo-logo.png', content: bufferLogo, cid },
    };
  }
  return {
    html: `
    <div style="display:inline-block; background:#03285B; color:#ffffff; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-weight:bold; font-size:20px; letter-spacing:0.06em; padding:10px 18px; border-radius:6px;">
      ${escapeHtmlCorreo(marca)}
    </div>`,
    adjunto: null,
  };
}

// Una fila de la "tabla tipo ticket" (etiqueta a la izquierda, valor a la
// derecha, con una variante "destacado" para el total) — compartida entre
// el ticket de venta y el resto de correos homologados (construirCorreoBase),
// para que ambos rendericen exactamente igual sin duplicar el markup.
function filaCorreoTabla(etiqueta, valor, destacado) {
  return `
    <tr>
      <td style="padding:${destacado ? '9px 10px' : '6px 0'}; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; color:${destacado ? '#03285B' : '#5B6472'}; ${destacado ? 'font-weight:bold; background:#E7ECF3; border-radius:8px 0 0 8px;' : ''}">${etiqueta}</td>
      <td style="padding:${destacado ? '9px 10px' : '6px 0'}; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:${destacado ? '15px' : '13px'}; color:${destacado ? '#03285B' : '#0B1320'}; text-align:right; ${destacado ? 'font-weight:bold; background:#E7ECF3; border-radius:0 8px 8px 0;' : ''}">${valor}</td>
    </tr>`;
}

// Cascarón compartido de correo (auditoría de correos de salida, ver
// PROJECT_STATE.md): mismo lenguaje visual del ticket de venta — logo,
// franja degradada, tarjeta punteada, botón — para cualquier correo que
// deba llevar la marca (de cara a cliente/tercero externo, o interno como
// el reporte automático). `colorPrimario`/`colorAccent` parametrizan SOLO
// la franja y el botón (los dos elementos que Look & Feel ya valida con
// contraste AA para texto blanco) — el resto de la tarjeta se queda con
// los mismos tonos neutros del ticket, para no arriesgar contraste con un
// color de tenant arbitrario en texto pequeño.
function construirCorreoBase({
  marca,
  logoUrl,
  colorPrimario,
  colorAccent,
  eyebrow,
  titulo,
  filas = [],
  parrafos = [],
  cta,
  piePersonalizado,
  usarLogoLegacy,
}) {
  const marcaMostrada = marca === MARCA_DEFECTO ? 'CLARVO by ADDV' : marca;
  const logo = logoTicketHtml(logoUrl, marca, usarLogoLegacy);
  const primario = colorPrimario || '#03285B';
  const acento = colorAccent || '#05DBF2';

  const filasHtml = filas.map((f) => filaCorreoTabla(f.etiqueta, f.valor, f.destacado)).join('');
  const parrafosHtml = parrafos
    .map((p) => `<p style="margin:0 0 14px; font-size:14.5px; line-height:1.55; color:#2A3342;">${p}</p>`)
    .join('');
  const ctaHtml =
    cta && cta.href
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto;">
          <tr>
            <td style="border-radius:8px; background:${primario};">
              <a href="${cta.href}" style="display:inline-block; padding:12px 28px; font-size:14.5px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:8px;">${escapeHtmlCorreo(cta.texto)}</a>
            </td>
          </tr>
        </table>`
      : '';

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:24px 12px; background:#F4F6FA; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto;">
    <tr>
      <td style="text-align:center; padding-bottom:18px;">
        ${logo.html}
      </td>
    </tr>
    <tr>
      <td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff; border:1px dashed #C7CDD9; border-radius:12px; box-shadow:0 2px 14px rgba(11,19,32,0.10);">
          <tr>
            <td style="height:4px; line-height:4px; font-size:0; background:${primario}; background:linear-gradient(90deg,${primario} 0%,${acento} 100%); border-radius:11px 11px 0 0;">&nbsp;</td>
          </tr>
          ${
            eyebrow || titulo
              ? `
          <tr>
            <td style="padding:24px 28px 6px; text-align:center;">
              ${eyebrow ? `<p style="margin:0; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#5B6472;">${escapeHtmlCorreo(eyebrow)}</p>` : ''}
              ${titulo ? `<p style="margin:6px 0 0; font-size:20px; font-weight:bold; color:#0B1320;">${escapeHtmlCorreo(titulo)}</p>` : ''}
            </td>
          </tr>`
              : ''
          }
          ${
            filas.length
              ? `
          <tr><td style="padding:14px 28px 0;"><div style="border-top:1px dashed #DCE2EC;"></div></td></tr>
          <tr>
            <td style="padding:16px 28px ${parrafos.length ? '4px' : '24px'};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filasHtml}</table>
            </td>
          </tr>`
              : ''
          }
          ${
            parrafos.length
              ? `<tr><td style="padding:${filas.length ? '4px' : '20px'} 28px 20px;">${parrafosHtml}</td></tr>`
              : ''
          }
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 10px 0;">
        ${ctaHtml}
        <p style="margin:18px 0 0; font-size:12.5px; line-height:1.5; color:#8A93A3; text-align:center;">${piePersonalizado ? `${escapeHtmlCorreo(piePersonalizado)} ` : ''}Portal de Facturación ${escapeHtmlCorreo(marcaMostrada)}.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const texto = [
    eyebrow ? eyebrow.toUpperCase() : null,
    titulo,
    filas.length ? filas.map((f) => `${f.etiqueta}: ${f.valor}`).join('\n') : null,
    parrafos.length ? parrafos.map((p) => p.replace(/<[^>]+>/g, '')).join('\n\n') : null,
    cta && cta.href ? `${cta.texto}: ${cta.href}` : null,
    piePersonalizado || null,
    `Portal de Facturación ${marcaMostrada}.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return { html, texto, adjuntos: logo.adjunto ? [logo.adjunto] : [] };
}

module.exports = {
  MARCA_DEFECTO,
  escapeHtmlCorreo,
  logoTicketHtml,
  filaCorreoTabla,
  construirCorreoBase,
};
