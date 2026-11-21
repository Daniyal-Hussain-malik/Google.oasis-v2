import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { badRequest } from '../utils/http.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

const types = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };

export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // The extension comes from the checked MIME type, never from the client's file name.
    filename: (req, file, done) => done(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${types[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, done) => {
    if (types[file.mimetype]) done(null, true);
    else done(badRequest('Upload a JPG, PNG, WebP or AVIF image.'));
  },
});
