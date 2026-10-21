// Protección OWASP CSV/Formula Injection (§35, hallazgo M-10 sonar.html
// 2026-10-13) — módulo único, reutilizado por todos los exportadores de
// CSV/XLSX del backend. Antes vivía solo dentro de
// backend/utils/inventarioImportacion.js (§34.3.4); se extrajo aquí para
// que los otros 3 exportadores que construían su CSV a mano
// (backend/utils/reportes.js, backend/server.js:kardex-exportar) dejen
// de hacerlo sin esta protección.
//
// Una celda que empiece con = + - @ tab o CR se abre como fórmula en
// Excel/Sheets/LibreOffice con los permisos de quien la abre — un valor
// controlado por un cliente (p. ej. "número de venta" del portal
// público) puede ejecutar código en la máquina del administrador que
// exporta y abre el archivo. Se antepone un apóstrofo: Excel lo muestra
// como texto literal, nunca lo evalúa.
function protegerCeldaCSV(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) return `'${texto}`;
  return texto;
}

// Fila completa a una línea CSV: protege cada celda contra fórmula
// (arriba) y, aparte, envuelve en comillas cualquier celda que traiga
// coma, comilla o salto de línea (regla estándar de CSV — la comilla
// doble que ya traiga el texto se duplica, escape estándar).
function filaACSV(valores) {
  return valores
    .map((v) => {
      const protegido = protegerCeldaCSV(v);
      return /[",\n]/.test(protegido) ? `"${protegido.replace(/"/g, '""')}"` : protegido;
    })
    .join(',');
}

module.exports = { protegerCeldaCSV, filaACSV };
