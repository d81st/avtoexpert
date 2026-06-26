import Docxtemplater from 'docxtemplater';
import fc from 'fast-check';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import { precheckTables } from './tableMapper';

/**
 * Property 16: Table_Mapper structural fidelity.
 *
 * For any repeating-group input array A of length N ∈ [0, 10000] mapped to a
 * template group G, the rendered `word/document.xml` MUST satisfy:
 *   1. The count of `<w:tr>` elements descended from G equals N (zero if N = 0),
 *   2. The ordered sequence of cell text values per row matches A
 *      element-by-element,
 *   3. For each cloned row, the `<w:trPr>`, `<w:tcPr>`, `<w:gridSpan>`,
 *      `<w:vMerge>` attribute values equal those of the template row
 *      byte-for-byte,
 *   4. The `<w:tblGrid>/<w:gridCol w:w="…">` width values are unchanged from
 *      the template.
 *
 * The test renders through docxtemplater with the same options used by
 * `DocGenerator.generateDocument` (`paragraphLoop: true`, `linebreaks: true`,
 * `nullGetter -> ''`) and runs `precheckTables` immediately before render,
 * mirroring the production pipeline.
 *
 * **Validates: Requirements 5.3, 5.5, 5.6, 5.8**
 */

// --- Minimal DOCX template authored for the test -------------------------

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/**
 * A table that models a real report table: a static header row (which keeps the
 * table alive even when the loop is empty) followed by the `repair_works` loop
 * body. The loop row's cells carry distinct styling — `gridSpan` on cell 1 and
 * `vMerge` on cell 2 — plus a `trPr` row-height and per-cell `tcW` widths, so
 * the byte-for-byte structural assertions (Property 3/4) have non-trivial
 * content to preserve. The loop rows are uniquely identifiable by their
 * `vMerge` cell, distinguishing them from the static header row.
 */
const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:tbl>
<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>
<w:tblGrid><w:gridCol w:w="2111"/><w:gridCol w:w="2222"/><w:gridCol w:w="2333"/><w:gridCol w:w="2444"/></w:tblGrid>
<w:tr><w:trPr><w:tblHeader/></w:trPr>` +
  `<w:tc><w:tcPr><w:tcW w:w="2111" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>h1</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="2222" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>h2</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="2333" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>h3</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="2444" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>h4</w:t></w:r></w:p></w:tc>` +
  `</w:tr>
<w:tr><w:trPr><w:trHeight w:val="397"/></w:trPr>` +
  `<w:tc><w:tcPr><w:tcW w:w="2111" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">{#repair_works}{part_name}</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="2222" w:type="dxa"/><w:vMerge w:val="restart"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">{part_type}</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="2333" w:type="dxa"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">{complexity}</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="2444" w:type="dxa"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">{price}{/repair_works}</w:t></w:r></w:p></w:tc>` +
  `</w:tr>
</w:tbl>
<w:p><w:r><w:t>end</w:t></w:r></w:p>
</w:body>
</w:document>`;

function buildTemplateZip(): PizZip {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/document.xml', DOCUMENT_XML);
  return zip;
}

/** Render `data` against the template, returning the rendered `document.xml`. */
function renderDocumentXml(data: Record<string, unknown>): string {
  const doc = new Docxtemplater(buildTemplateZip(), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter(): string {
      return '';
    },
  });
  doc.render(data);
  return doc.getZip().file('word/document.xml')?.asText() ?? '';
}

// --- XML extraction helpers ---------------------------------------------

function extractRows(xml: string): string[] {
  return xml.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g) ?? [];
}

/**
 * Loop-body rows for group G, identified by the `vMerge` cell unique to the
 * template loop row. This excludes the static header `<w:tr>`, so the count is
 * exactly N (Property 1).
 */
function extractGroupRows(xml: string): string[] {
  return extractRows(xml).filter((row) =>
    row.includes('<w:vMerge w:val="restart"/>'),
  );
}

function extractCellTexts(rowXml: string): string[] {
  const texts: string[] = [];
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null = re.exec(rowXml);
  while (m !== null) {
    texts.push(m[1]);
    m = re.exec(rowXml);
  }
  return texts;
}

function extractTrPr(rowXml: string): string {
  return rowXml.match(/<w:trPr>[\s\S]*?<\/w:trPr>/)?.[0] ?? '';
}

function extractTcPrs(rowXml: string): string[] {
  return rowXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/g) ?? [];
}

function extractTblGrid(xml: string): string {
  return xml.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '';
}

// Structural fragments captured from the template loop row, used as the
// byte-for-byte reference for Properties 3 and 4.
const TEMPLATE_ROW = extractGroupRows(DOCUMENT_XML)[0];
const TEMPLATE_TRPR = extractTrPr(TEMPLATE_ROW);
const TEMPLATE_TCPRS = extractTcPrs(TEMPLATE_ROW);
const TEMPLATE_TBLGRID = extractTblGrid(DOCUMENT_XML);

const GROUP_NAMES = ['repair_works', 'paint_works', 'spare_parts', 'materials'];

interface RepairWork {
  part_name: string;
  part_type: string;
  complexity: string;
  price: number;
}

/** Expected ordered cell text for a row, matching the template column order. */
function expectedCells(row: RepairWork): string[] {
  return [row.part_name, row.part_type, row.complexity, String(row.price)];
}

/** Assert all four structural-fidelity properties for a given input array. */
function assertStructuralFidelity(rows: RepairWork[]): void {
  // Mirror the production pipeline: precheck runs immediately before render.
  precheckTables({ repair_works: rows }, GROUP_NAMES);

  const xml = renderDocumentXml({ repair_works: rows });
  const renderedRows = extractGroupRows(xml);

  // (1) Group row count equals N (the static header row is excluded).
  expect(renderedRows.length).toBe(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const rowXml = renderedRows[i];

    // (2) Ordered cell text matches the input element-by-element.
    expect(extractCellTexts(rowXml)).toEqual(expectedCells(rows[i]));

    // (3) trPr / tcPr / gridSpan / vMerge preserved byte-for-byte.
    expect(extractTrPr(rowXml)).toBe(TEMPLATE_TRPR);
    expect(extractTcPrs(rowXml)).toEqual(TEMPLATE_TCPRS);
    expect(rowXml).toContain('<w:gridSpan w:val="2"/>');
    expect(rowXml).toContain('<w:vMerge w:val="restart"/>');
  }

  // (4) tblGrid column widths unchanged from the template.
  expect(extractTblGrid(xml)).toBe(TEMPLATE_TBLGRID);
}

// --- Arbitraries ---------------------------------------------------------

// Safe cell text: non-empty alphanumerics (plus `_`/`-`) so no XML escaping or
// whitespace-trimming ambiguity affects the text comparison.
const SAFE_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('');

const safeText = fc
  .array(fc.constantFrom(...SAFE_CHARS), { minLength: 1, maxLength: 8 })
  .map((chars) => chars.join(''));

const repairWorkArb: fc.Arbitrary<RepairWork> = fc.record({
  part_name: safeText,
  part_type: safeText,
  complexity: safeText,
  price: fc.integer({ min: 0, max: 999_999 }),
});

describe('Property 16: Table_Mapper structural fidelity (R5.3, R5.5, R5.6, R5.8)', () => {
  it('preserves row count, cell text, row/cell styling, and grid widths for arbitrary groups', () => {
    fc.assert(
      fc.property(
        fc.array(repairWorkArb, { minLength: 0, maxLength: 40 }),
        (rows) => {
          assertStructuralFidelity(rows);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('removes all loop rows but keeps the table when N = 0 (R5.6)', () => {
    const xml = renderDocumentXml({ repair_works: [] });
    expect(extractGroupRows(xml)).toHaveLength(0);
    // The table shell and grid survive (the static header row keeps them).
    expect(extractTblGrid(xml)).toBe(TEMPLATE_TBLGRID);
  });

  it('renders exactly one faithful row when N = 1', () => {
    assertStructuralFidelity([
      { part_name: 'bumper', part_type: 'plastic', complexity: 'high', price: 4200 },
    ]);
  });

  it('renders 10000 faithful rows at the upper bound (R5.4)', () => {
    const rows: RepairWork[] = Array.from({ length: 10_000 }, (_, i) => ({
      part_name: `p${i}`,
      part_type: 't',
      complexity: 'c',
      price: i,
    }));
    assertStructuralFidelity(rows);
  });
});
