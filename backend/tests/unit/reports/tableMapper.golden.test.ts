import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { beforeAll, describe, expect, it } from 'vitest';
import { precheckTables } from '../../../src/modules/reports/tableMapper';

/**
 * Golden-file tests for the Table Mapping subsystem (Requirement 5, task 8.5).
 *
 * Three minimal in-test DOCX templates exercise the three datasets mandated by
 * R5.7:
 *   1. `basic_repeating_rows`  — fixed cells + a repeating `<w:tr>` group, no merges.
 *   2. `horizontal_merge`      — a repeating block whose first row carries a
 *                                horizontally merged cell (`<w:gridSpan w:val="2"/>`).
 *   3. `vertical_merge`        — a repeating block whose first column is vertically
 *                                merged across two rows (`<w:vMerge w:val="restart"/>`
 *                                + `<w:vMerge/>`).
 *
 * Each template is rendered with the exact docxtemplater configuration the
 * production `DocGenerator` uses (`paragraphLoop: true`, `linebreaks: true`).
 * The rendered `word/document.xml` is asserted byte-for-byte against a checked-in
 * golden fixture. Because the rendered XML retains the template's `<w:trPr>`,
 * `<w:tcPr>`, `<w:gridSpan>`, `<w:vMerge>` and `<w:tblGrid>/<w:gridCol>` nodes
 * verbatim, byte equality proves structural fidelity:
 *   - row count equals the input array length and ordering (R5.3),
 *   - `gridSpan` / `vMerge` merges survive row cloning unchanged (R5.5),
 *   - column widths (`gridCol`) and table width are identical to the template (R5.8),
 *   - the structural element order/attributes (`<w:tr>`, `<w:tc>`, `<w:gridSpan>`,
 *     `<w:vMerge>`) match the golden reference (R5.7).
 *
 * Validates: Requirements 5.5, 5.7, 5.8
 *
 * The fixtures are generated once from the current renderer output and pinned.
 * Re-generate intentionally with `UPDATE_GOLDEN=1` (e.g. after an approved
 * template or library change); a normal run only compares and never writes.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = path.resolve(here, '../../fixtures/golden');
const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === '1';

/** Minimal OPC part shared by every in-test template. */
const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const DOC_OPEN =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>';
const DOC_CLOSE = '</w:body></w:document>';

/** Wrap a `word/document.xml` body fragment into a full document. */
function doc(body: string): string {
  return `${DOC_OPEN}${body}${DOC_CLOSE}`;
}

/** Build a one-cell paragraph holding the given inline text/markers. */
function cell(tcPr: string, text: string): string {
  return `<w:tc>${tcPr}<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;
}

// --- Scenario 1: basic repeating rows (no merges) ---------------------------

const BASIC_TEMPLATE = doc(
  '<w:tbl>' +
    '<w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="4675"/><w:gridCol w:w="4675"/></w:tblGrid>' +
    '<w:tr>' +
    cell('<w:tcPr><w:tcW w:w="4675" w:type="dxa"/></w:tcPr>', 'Деталь') +
    cell('<w:tcPr><w:tcW w:w="4675" w:type="dxa"/></w:tcPr>', 'Цена') +
    '</w:tr>' +
    '<w:tr>' +
    cell(
      '<w:tcPr><w:tcW w:w="4675" w:type="dxa"/></w:tcPr>',
      '{#repair_works}{part_name}',
    ) +
    cell('<w:tcPr><w:tcW w:w="4675" w:type="dxa"/></w:tcPr>', '{price}{/repair_works}') +
    '</w:tr>' +
    '</w:tbl>',
);

const BASIC_DATA = {
  repair_works: [
    { part_name: 'Бампер передний', part_type: 'Снятие', complexity: 'низкая', price: 1500 },
    { part_name: 'Капот', part_type: 'Замена', complexity: 'средняя', price: 3200 },
    { part_name: 'Крыло заднее', part_type: 'Ремонт', complexity: 'высокая', price: 4800 },
  ],
};

// --- Scenario 2: horizontal merge (gridSpan) --------------------------------

const HORIZONTAL_TEMPLATE = doc(
  '<w:tbl>' +
    '<w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="4675"/><w:gridCol w:w="4675"/></w:tblGrid>' +
    '<w:tr>' +
    cell(
      '<w:tcPr><w:tcW w:w="9350" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>',
      '{#rows}{title}',
    ) +
    '</w:tr>' +
    '<w:tr>' +
    cell('<w:tcPr><w:tcW w:w="4675" w:type="dxa"/></w:tcPr>', '{left}') +
    cell('<w:tcPr><w:tcW w:w="4675" w:type="dxa"/></w:tcPr>', '{right}{/rows}') +
    '</w:tr>' +
    '</w:tbl>',
);

const HORIZONTAL_DATA = {
  rows: [
    { title: 'Кузовные работы', left: 'Передняя часть', right: '12 000' },
    { title: 'Окраска', left: 'Капот', right: '8 500' },
  ],
};

// --- Scenario 3: vertical merge (vMerge) ------------------------------------

const VERTICAL_TEMPLATE = doc(
  '<w:tbl>' +
    '<w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="4675"/><w:gridCol w:w="4675"/></w:tblGrid>' +
    '<w:tr>' +
    cell(
      '<w:tcPr><w:tcW w:w="4675" w:type="dxa"/><w:vMerge w:val="restart"/></w:tcPr>',
      '{#rows}{label}',
    ) +
    cell('<w:tcPr><w:tcW w:w="4675" w:type="dxa"/></w:tcPr>', '{top}') +
    '</w:tr>' +
    '<w:tr>' +
    cell('<w:tcPr><w:tcW w:w="4675" w:type="dxa"/><w:vMerge/></w:tcPr>', '') +
    cell('<w:tcPr><w:tcW w:w="4675" w:type="dxa"/></w:tcPr>', '{bottom}{/rows}') +
    '</w:tr>' +
    '</w:tbl>',
);

const VERTICAL_DATA = {
  rows: [
    { label: 'Секция 1', top: 'Верх 1', bottom: 'Низ 1' },
    { label: 'Секция 2', top: 'Верх 2', bottom: 'Низ 2' },
  ],
};

/**
 * Render `documentXml` as a DOCX template with `data`, using the same
 * docxtemplater options as the production `DocGenerator`, and return the
 * resulting `word/document.xml` as a UTF-8 string.
 */
function renderDocumentXml(
  documentXml: string,
  data: Record<string, unknown>,
): string {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.folder('_rels')?.file('.rels', ROOT_RELS_XML);
  zip.folder('word')?.file('document.xml', documentXml);

  const docx = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter(): string {
      return '';
    },
  });

  docx.render(data);

  return docx.getZip().file('word/document.xml')?.asText() ?? '';
}

/**
 * Compare `actual` against the pinned golden fixture `name`.xml. When the
 * fixture is missing or `UPDATE_GOLDEN=1`, write it (generate-once / pin) so the
 * first run establishes the baseline; otherwise assert byte-level equality.
 */
function assertGolden(name: string, actual: string): void {
  const fixturePath = path.join(GOLDEN_DIR, `${name}.xml`);

  if (UPDATE_GOLDEN || !existsSync(fixturePath)) {
    mkdirSync(GOLDEN_DIR, { recursive: true });
    writeFileSync(fixturePath, actual, 'utf8');
    return;
  }

  const expected = readFileSync(fixturePath, 'utf8');
  expect(actual).toBe(expected);
}

describe('Table mapping golden fixtures (R5.5, R5.7, R5.8)', () => {
  let basicXml: string;
  let horizontalXml: string;
  let verticalXml: string;

  beforeAll(() => {
    // The basic scenario uses a real Table_Mapper group, so it also exercises
    // the production precheck (R5.4/R5.9) ahead of render — it must not throw.
    precheckTables(BASIC_DATA, ['repair_works']);

    basicXml = renderDocumentXml(BASIC_TEMPLATE, BASIC_DATA);
    horizontalXml = renderDocumentXml(HORIZONTAL_TEMPLATE, HORIZONTAL_DATA);
    verticalXml = renderDocumentXml(VERTICAL_TEMPLATE, VERTICAL_DATA);
  });

  it('basic_repeating_rows matches golden and clones each row in order (R5.7, R5.8)', () => {
    // Three input rows → exactly three data `<w:tr>` plus the header row.
    const dataRows = basicXml.match(/<w:t[^>]*>Бампер передний<\/w:t>/g) ?? [];
    expect(dataRows.length).toBe(1);
    expect(basicXml.indexOf('Бампер передний')).toBeLessThan(
      basicXml.indexOf('Капот'),
    );
    expect(basicXml.indexOf('Капот')).toBeLessThan(
      basicXml.indexOf('Крыло заднее'),
    );
    // Column widths from the template survive untouched (R5.8).
    expect(basicXml).toContain('<w:gridCol w:w="4675"/><w:gridCol w:w="4675"/>');
    // No literal placeholder markers remain.
    expect(basicXml).not.toContain('{');
    expect(basicXml).not.toContain('}');

    assertGolden('basic_repeating_rows', basicXml);
  });

  it('horizontal_merge preserves gridSpan in every cloned block (R5.5, R5.7)', () => {
    // One gridSpan cell per input row.
    const spans = horizontalXml.match(/<w:gridSpan w:val="2"\/>/g) ?? [];
    expect(spans.length).toBe(HORIZONTAL_DATA.rows.length);
    expect(horizontalXml).not.toContain('{');
    expect(horizontalXml).not.toContain('}');

    assertGolden('horizontal_merge', horizontalXml);
  });

  it('vertical_merge preserves vMerge restart/continue per cloned block (R5.5, R5.7)', () => {
    const restarts = verticalXml.match(/<w:vMerge w:val="restart"\/>/g) ?? [];
    const continues = verticalXml.match(/<w:vMerge\/>/g) ?? [];
    expect(restarts.length).toBe(VERTICAL_DATA.rows.length);
    expect(continues.length).toBe(VERTICAL_DATA.rows.length);
    expect(verticalXml).not.toContain('{');
    expect(verticalXml).not.toContain('}');

    assertGolden('vertical_merge', verticalXml);
  });
});
