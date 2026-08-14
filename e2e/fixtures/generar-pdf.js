// Genera un PDF mínimo pero VÁLIDO (con tabla xref correcta) que
// pdf-parse del contenedor backend puede leer. Contiene los indicadores
// SAT de Constancia de Situación Fiscal + el RFC del cliente de prueba.
const fs = require('fs');

const lineas = [
  'Servicio de Administracion Tributaria',
  'Constancia de Situacion Fiscal',
  'Registro Federal de Contribuyentes: AAMA850101HDF',
  'Cedula de Identificacion Fiscal',
  'Domicilio: Calle 123, Codigo Postal: 06600, Ciudad de Mexico',
  'Regimen: Sueldos y Salarios',
];

const contenido = lineas.join(') Tj 0 -18 Td (');

const objetos = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  '',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];

const stream = `BT /F1 12 Tf 72 720 Td (${contenido}) Tj ET`;
objetos[3] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;

let pdf = '%PDF-1.4\n';
const offsets = [0];
for (let i = 0; i < 5; i++) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${objetos[i]}\nendobj\n`;
}

const xrefOffset = Buffer.byteLength(pdf);
pdf += `xref\n0 6\n0000000000 65535 f \n`;
for (let i = 1; i <= 5; i++) {
  pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

fs.writeFileSync(process.argv[2], pdf, 'latin1');
console.log(`PDF válido escrito: ${process.argv[2]} (${Buffer.byteLength(pdf)} bytes)`);