import * as fs from 'node:fs';
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

  writeFile(filePath: string, data: Buffer | string): void {
    fs.writeFileSync(filePath, data);
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
