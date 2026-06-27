// services/pdf.js — genera un PDF bonito de un post usando pdfkit.
//
// pdfkit es JavaScript puro (no necesita un navegador). Construimos el documento
// "a mano": colocamos el título, los datos, el cuerpo y el pie, y lo enviamos
// directo a la respuesta HTTP. Es verboso a propósito: se ve cada paso.

import PDFDocument from 'pdfkit';

// Construye el PDF y lo escribe (stream) sobre "res" (la respuesta de Express).
export function streamPostPdf(post, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 56 });

  // Encabezados HTTP para que el navegador lo descargue como archivo.
  const fileName = slugify(post.title) + '.pdf';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  // Conecta el PDF con la respuesta: a medida que se genera, se envía.
  doc.pipe(res);

  // --- Título ---
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#111111');
  doc.text(post.title, { lineGap: 2 });
  doc.moveDown(0.4);

  // --- Subtítulo: categoría + tiempo de lectura + tipo ---
  const meta = [
    post.category_name || post.category_slug,
    `${post.read_minutes} min de lectura`,
    post.kind === 'real' ? 'Noticia' : 'Generado por IA',
  ]
    .filter(Boolean)
    .join('  ·  ');
  doc.font('Helvetica').fontSize(10).fillColor('#888888');
  doc.text(meta);
  doc.moveDown(1);

  // Línea separadora.
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#dddddd').stroke();
  doc.moveDown(1);

  // --- Cuerpo (párrafo a párrafo) ---
  doc.font('Helvetica').fontSize(12).fillColor('#222222');
  for (const paragraph of String(post.body).split('\n')) {
    if (paragraph.trim() === '') {
      doc.moveDown(0.6);
    } else {
      doc.text(paragraph, { align: 'left', lineGap: 4 });
      doc.moveDown(0.4);
    }
  }

  // --- Hashtags ---
  if (post.hashtags && post.hashtags.length) {
    doc.moveDown(0.6);
    doc.font('Helvetica-Oblique').fontSize(10).fillColor('#3366cc');
    doc.text(post.hashtags.map((t) => '#' + t).join('  '));
  }

  // --- Pie: fuente o aviso ---
  doc.moveDown(1.2);
  doc.font('Helvetica').fontSize(9).fillColor('#999999');
  if (post.source_url) {
    doc.text('Fuente: ' + post.source_url, { link: post.source_url, underline: true });
  } else if (post.source_note) {
    doc.text(post.source_note);
  }

  // Cierra el documento -> termina el stream -> termina la respuesta.
  doc.end();
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (marcas diacríticas)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'noticia';
}
