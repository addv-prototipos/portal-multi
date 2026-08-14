const fs = require('fs');
const PDFDocument = require('pdfkit');
const salida = 'e2e/fixtures/constancia-grande.pdf';

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
doc.moveDown(0.5);
// Replica de bloques de texto de una constancia real (para superar el
// umbral de 8 KB del pool interno de Buffers de Node)
for (let i = 0; i < 12; i++) {
  doc.text(
    'Regimen Fiscal: Sueldos y Salarios | Actividad Economica: Servicios profesionales y tecnicos | ' +
      'Domicilio Registral: CALLE 123, COLONIA CENTRO, ALCALDIA CUAUHTEMOC, CIUDAD DE MEXICO, 06600 | ' +
      'Fecha de inicio de operaciones: 01/01/2020 | Obligaciones: Presentar declaracion anual'
  );
  doc.moveDown(0.3);
}

doc.end();
stream.on('finish', () => {
  console.log(`PDF grande: ${fs.statSync(salida).size} bytes`);
});