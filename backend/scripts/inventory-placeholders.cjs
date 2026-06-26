// Inventory all docxtemplater placeholders in original_example.docx (Docx_Template_V2).
// Task 7.3 (platform-improvements-mvp). Scans word/document.xml of the ZIP.
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const T = path.resolve(__dirname, '..', 'templates', 'original_example.docx');
const buf = fs.readFileSync(T);
const zip = new PizZip(buf);

// Collect XML from main document plus headers/footers (placeholders can live there too).
const partNames = Object.keys(zip.files).filter((n) =>
  /^word\/(document|header\d*|footer\d*)\.xml$/.test(n),
);

// docxtemplater placeholders may be split across multiple <w:t> runs in the raw
// XML. To detect them reliably, strip all XML tags first, then regex over text.
function strippedText(xml) {
  return xml.replace(/<[^>]+>/g, '');
}

const allTokens = new Map(); // token -> count
const imageTag = '{' + '%' + 'image}';

for (const name of partNames) {
  const xml = zip.file(name).asText();
  const text = strippedText(xml);
  // Match {...} tokens including loop/section/raw prefixes # / / % ^
  const re = /\{[#/%^]?[^{}]+\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const tok = m[0];
    allTokens.set(tok, (allTokens.get(tok) || 0) + 1);
  }
}

// Classify
const tokens = [...allTokens.keys()].sort();
const loopOpen = tokens.filter((t) => /^\{#/.test(t));
const loopClose = tokens.filter((t) => /^\{\//.test(t));
const rawTags = tokens.filter((t) => t.startsWith('{' + '%'));
const inverted = tokens.filter((t) => /^\{\^/.test(t));
const scalars = tokens.filter(
  (t) => !/^\{[#/%^]/.test(t),
);

const legacyPhoto = tokens.filter((t) => /photo_\d+/.test(t));

const result = {
  template: 'original_example.docx',
  sizeBytes: buf.length,
  partsScanned: partNames,
  counts: Object.fromEntries([...allTokens.entries()].sort()),
  classified: {
    loopOpen,
    loopClose,
    rawImageTags: rawTags,
    invertedSections: inverted,
    scalars,
    legacyPhotoSlots: legacyPhoto.length ? legacyPhoto : 'none',
  },
};

fs.writeFileSync(
  path.resolve(__dirname, 'inventory-out.json'),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
