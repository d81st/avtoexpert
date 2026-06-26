// Inventory all docxtemplater placeholders in original_example.docx (Docx_Template_V2).
// Task 7.3 (platform-improvements-mvp). Scans word/document.xml of the ZIP.
//
// Extended for docx-photo-slots / B1: additionally extracts EMU-sizes of the
// 6 inline image anchors (statические фото-примеры) из word/document.xml.
// Размеры записываются в inventory-out.json#slotSizes в document-order.
// Источник: первый <wp:extent cx="..." cy="..."/> внутри каждого
// <w:drawing>…</w:drawing>, содержащего хотя бы один <a:blip …/> (image).
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

// docxtemplater placeholders may be split across multiple <w:t> runs in the raw
// XML. To detect them reliably, strip all XML tags first, then regex over text.
function strippedText(xml) {
  return xml.replace(/<[^>]+>/g, '');
}

/**
 * Extracts EMU-sizes of inline image anchors in document-order from
 * word/document.xml. Returns Array<{cx: number, cy: number}> с парами
 * целых положительных значений в порядке появления image-anchor'ов
 * сверху вниз. Один <w:drawing> может содержать ≥ 1 <wp:extent>; берём
 * первый (внешний — у <wp:inline> или <wp:anchor>). Блоки без <a:blip>
 * (text-boxes, shapes без изображения) пропускаются.
 *
 * @param {string} documentXml Raw XML of word/document.xml
 * @returns {Array<{cx: number, cy: number}>}
 */
function extractSlotSizes(documentXml) {
  const drawings = documentXml.match(/<w:drawing[\s\S]*?<\/w:drawing>/g) ?? [];
  const sizes = [];
  for (const d of drawings) {
    if (!/<a:blip\b/.test(d)) continue; // image-anchor only
    // <wp:extent> appears with attrs cx and cy as positive integers in EMU.
    // Attribute order is conventional (cx first, cy second) but allow whitespace
    // variations and self-closing forms.
    const m = d.match(/<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"\s*\/?>/);
    if (!m) continue;
    sizes.push({ cx: Number(m[1]), cy: Number(m[2]) });
  }
  return sizes;
}

/**
 * CLI entry point. Wrapped in a `require.main === module` guard so this file
 * can be `require()`'d from a unit test (task 2.3) without triggering file I/O
 * or throwing on the slot-count assert.
 */
function main() {
  const T = path.resolve(__dirname, '..', 'templates', 'original_example.docx');
  const buf = fs.readFileSync(T);
  const zip = new PizZip(buf);

  // Collect XML from main document plus headers/footers (placeholders can live there too).
  const partNames = Object.keys(zip.files).filter((n) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(n),
  );

  const allTokens = new Map(); // token -> count

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
  const scalars = tokens.filter((t) => !/^\{[#/%^]/.test(t));

  const legacyPhoto = tokens.filter((t) => /photo_\d+/.test(t));

  // Extract slot EMU sizes from word/document.xml (header/footer не содержат
  // example-images этой фичи). Если document.xml отсутствует, пустой массив.
  const documentXml = zip.file('word/document.xml')
    ? zip.file('word/document.xml').asText()
    : '';
  const slotSizes = extractSlotSizes(documentXml);

  // R2.1: при наличии image-anchor'ов их должно быть ровно 6 (V2-state).
  // Если 0 (post-V3, image-примеры уже удалены) — это допустимо, выводим warn
  // и пропускаем assert. Промежуточные значения (1..5) — реальная регрессия,
  // останавливаемся с ошибкой.
  if (slotSizes.length === 0) {
    console.warn(
      '[inventory] slotSizes is empty — assuming template is already migrated to V3 (no image anchors). Skipping length assert.',
    );
  } else if (slotSizes.length !== 6) {
    throw new Error(
      `[inventory] expected exactly 6 image-anchor <wp:extent> entries in word/document.xml, got ${slotSizes.length}. ` +
        'Этот скрипт ожидает Docx_Template_V2 с 6 фото-примерами или Docx_Template_V3 с 0 image-anchor\'ами.',
    );
  }

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
    slotSizes,
  };

  fs.writeFileSync(
    path.resolve(__dirname, 'inventory-out.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

// Exports for unit testing (task 2.3). Keep this list minimal — only pure
// helpers that have no side effects when imported.
module.exports = {
  extractSlotSizes,
  strippedText,
};
