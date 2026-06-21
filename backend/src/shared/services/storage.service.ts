import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import { env } from '../../config/env.js';

export const storageService = {
  getUploadsDir(): string {
    return env.UPLOAD_DIR;
  },

  getPhotosDir(): string {
    return env.PHOTOS_DIR;
  },

  getTemplatesDir(): string {
    return env.TEMPLATE_DIR;
  },

  ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  },

  async writeFileAsync(filePath: string, data: Buffer | string): Promise<void> {
    await fsp.writeFile(filePath, data);
  },

  writeFile(filePath: string, data: Buffer | string): void {
    fs.writeFileSync(filePath, data);
  },

  async deleteFileAsync(filePath: string): Promise<void> {
    try {
      await fsp.unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  },

  deleteFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  },

  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  },

  getFileStats(filePath: string): fs.Stats {
    return fs.statSync(filePath);
  },
};
