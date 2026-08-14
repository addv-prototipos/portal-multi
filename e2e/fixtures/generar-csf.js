// Genera la Constancia de Situación Fiscal de prueba (AAMA850101HDF)
// con pdfkit — PDF real con tabla xref correcta que pdf-parse del
// contenedor backend puede leer. Contiene los indicadores SAT que
// busca pdfExtract.js y el RFC del cliente de prueba en el formato
// "Registro Federal de Contribuyentes: <RFC>".

const PDFDocument = require('pdfkit');
const fs = require('fs');

const salida = process.argv[2] || 'constancia.pdf';

const doc = new PDFDocument({ size: 'LETTER', margin: 60 });
const stream = fs.createWriteStream(salida);
doc.pipe(stream);

doc.fontSize(14).text('Servicio de Administracion Tributaria', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(12).text('Constancia de Situacion Fiscal', { align: 'center' });
doc.moveDown(1);
doc.fontSize(10);
doc.text('Cedula de Identificacion Fiscal');
doc.moveDown(0.5);
doc.text('Registro Federal de Contribuyentes: AAMA850101HDF');
doc.moveDown(0.5);
doc.text('Curp: AAMA850101HDFXXX00');
doc.moveDown(0.5);
doc.text('Domicilio: Calle 123, Codigo Postal: 06600, Ciudad de Mexico');
doc.moveDown(0.5);
doc.text('Regimen: Sueldos y Salarios');
doc.moveDown(0.5);
doc.text('Fecha de emision: 13/08/2026');

doc.end();
stream.on('finish', () => {
  console.log(`PDF generado: ${salida} (${fs.statSync(salida).size} bytes)`);
});