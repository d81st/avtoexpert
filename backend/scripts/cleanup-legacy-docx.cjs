#!/usr/bin/env node
'use strict';

// Storage_Cleanup_Script — one-shot cleanup of legacy Report_Docx_File
// artefacts left over from the pre-ephemeral-storage flow. Deletes every
// top-level file in <UPLOAD_DIR> whose name matches /^report_.*\.docx$/.
//
// Standalone CommonJS Node script: no TypeScript transpilation, no imports
// from src/db/** or src/config/env.ts, no DB access. Mirrors the UPLOAD_DIR
// resolution rule from backend/src/config/env.ts:20 (UPLOAD_DIR env var,
// falling back to <cwd>/uploads). Feature: ephemeral-docx-storage,
// requirements R4.1–R4.8.

const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const REPORT_DOCX_RE = /^report_.*\.docx$/;

function resolveUploadDir() {
  // Mirrors backend/src/config/env.ts:20.
  return process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
}

function main() {
  const uploadDir = resolveUploadDir();

  let entries;
  try {
    entries = fs.readdirSync(uploadDir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      // Directory does not exist — nothing to clean up. Emit the standard
      // summary line (R4.5) and exit gracefully.
      console.log(`cleanup-legacy-docx: removed 0 file(s) from ${uploadDir}`);
      return;
    }
    throw err;
  }

  let removed = 0;
  for (const entry of entries) {
    // R4.6: only top-level files; subdirectories (incl. photos/) are skipped.
    if (!entry.isFile()) continue;
    if (!REPORT_DOCX_RE.test(entry.name)) continue;

    const full = path.join(uploadDir, entry.name);
    try {
      fs.unlinkSync(full);
      removed += 1;
    } catch (err) {
      // R4.8: log per-file failure to stderr and keep going.
      const code = err && err.code ? err.code : err;
      console.error(
        `cleanup-legacy-docx: failed to remove ${entry.name}: ${code}`,
      );
    }
  }

  console.log(`cleanup-legacy-docx: removed ${removed} file(s) from ${uploadDir}`);
}

main();
