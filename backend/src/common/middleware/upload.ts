import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_PER_REPORT,
  PHOTO_MIME_WHITELIST,
  type ValidationResult,
  validatePhoto,
} from '../../modules/reports/photoValidator.js';
import {
  badRequest,
  payloadTooLarge,
  unsupportedMediaType,
} from '../errors/httpError.js';

const uploadsDir = env.PHOTOS_DIR;

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `photo-${uniqueSuffix}${ext}`);
  },
});

/**
 * Photo MIME whitelist tightened to the canonical set fixed by design §3.4
 * (R4.2, R6.8): only PNG, JPEG and WebP are accepted. The accepted file
 * extensions mirror those MIME types one-to-one.
 */
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    ALLOWED_EXTENSIONS.has(ext) &&
    (PHOTO_MIME_WHITELIST as readonly string[]).includes(file.mimetype)
  ) {
    cb(null, true);
    return;
  }

  cb(
    unsupportedMediaType(
      'Invalid file format. Allowed formats: PNG, JPEG, WebP',
    ),
  );
};

/**
 * Number of leading bytes read from each persisted upload for magic-byte
 * sniffing. The longest signature (WebP `RIFF…WEBP`) spans 12 bytes; 16 leaves
 * headroom without reading the whole file.
 */
const HEADER_BYTES = 16;

const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: PHOTO_MAX_BYTES,
    files: PHOTO_MAX_PER_REPORT,
  },
}).array('photos', PHOTO_MAX_PER_REPORT);

async function readHeaderBytes(filePath: string): Promise<Buffer> {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(HEADER_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEADER_BYTES, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Removes a persisted upload, swallowing the "already gone" case (R4.12). */
async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function rejectionFor(result: ValidationResult): Error {
  const reason = result.reason ?? 'corrupt';
  if (result.status === 413) {
    return payloadTooLarge(`Photo rejected: ${reason}`, { reason });
  }
  return unsupportedMediaType(`Photo rejected: ${reason}`, { reason });
}

/**
 * Runs each multer-parsed upload through `validatePhoto` (MIME → magic bytes →
 * size, per design §3.4 / R6.8). On the first failure every file written by
 * multer for this request is unlinked so no orphaned temp data survives a
 * rejection, then the matching 413/415 error is surfaced.
 */
async function validateUploadedPhotos(
  files: Express.Multer.File[],
): Promise<void> {
  for (const file of files) {
    const header = await readHeaderBytes(file.path);
    const result = validatePhoto(file, header);
    if (!result.ok) {
      await Promise.all(files.map((f) => safeUnlink(f.path)));
      throw rejectionFor(result);
    }
  }
}

/**
 * Composed photo-upload middleware: multer parses the multipart body to disk,
 * then `validatePhoto` re-checks every file post-multer. Multer's own limit
 * errors are mapped to the contract status codes (413 size, 400 count).
 */
export const uploadPhotos: RequestHandler = (req, res, next) => {
  multerUpload(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          next(
            payloadTooLarge('Photo rejected: too_large', {
              reason: 'too_large',
            }),
          );
          return;
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          next(
            badRequest(
              `Maximum of ${PHOTO_MAX_PER_REPORT} photos per report exceeded`,
            ),
          );
          return;
        }
      }
      next(err);
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    validateUploadedPhotos(files)
      .then(() => next())
      .catch(next);
  });
};
