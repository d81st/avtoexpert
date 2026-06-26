/*
 * Task 19.10 — insert the Photo_Insertion_Block into Docx_Template_V2.
 *
 * Programmatically edits backend/templates/original_example.docx (a binary
 * DOCX/ZIP) so that word/document.xml contains exactly one docxtemplater
 * photo loop block per design §3.8:
 *
 *   {#photos}
 *       {%image}
 *       Фото: {caption}
 *   {/photos}
 *
 * The block is inserted just before the final body-level <w:sectPr> so it
 * remains valid OOXML. The DOCX is then re-zipped preserving structure.
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const TEMPLATE = path.resolve(__dirname, '..', 'templates', 'original_example.docx');

function buildPhotoBlockXml() {
  // Each docxtemplater tag lives in a single <w:r>/<w:t> run so it is never
  // split across runs. xml:space="preserve" keeps the literal caption spacing.
  const p = (inner) =>
    `<w:p><w:r><w:t xml:space="preserve">${inner}</w:t></w:r></w:p>`;
  return (
    p('{#photos}') +
    p('{%image}') +
    p('Фото: {caption}') +
    p('{/photos}')
  );
}

function main() {
  const buf = fs.readFileSync(TEMPLATE);
  const zip = new PizZip(buf);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('word/document.xml not found in template');
  let xml = docXmlFile.asText();

  // Guard: do not double-insert.
  if (xml.includes('{#photos}')) {
    console.log('Photo_Insertion_Block already present; nothing to do.');
    return;
  }

  const block = buildPhotoBlockXml();

  // Insert before the LAST body-level <w:sectPr ...> so sectPr stays last.
  const sectPrIdx = xml.lastIndexOf('<w:sectPr');
  if (sectPrIdx !== -1) {
    xml = xml.slice(0, sectPrIdx) + block + xml.slice(sectPrIdx);
  } else {
    // No sectPr: insert before closing body tag.
    const bodyClose = xml.lastIndexOf('</w:body>');
    if (bodyClose === -1) throw new Error('No </w:body> found in document.xml');
    xml = xml.slice(0, bodyClose) + block + xml.slice(bodyClose);
  }

  zip.file('word/document.xml', xml);

  const out = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  fs.writeFileSync(TEMPLATE, out);
  console.log('Inserted Photo_Insertion_Block. New size:', out.length);
}

main();
