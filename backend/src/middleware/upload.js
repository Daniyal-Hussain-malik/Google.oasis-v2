import multer from 'multer';
import { UPLOAD_DIR } from '../services/storage.js';
import { badRequest } from '../utils/http.js';

export { UPLOAD_DIR };

const types = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

// Memory storage buffers uploads directly to Cloud Object Storage (S3 / R2 / GCS)
// without leaving stale files on ephemeral container disks.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, done) => {
    if (types[file.mimetype]) done(null, true);
    else done(badRequest('Upload a JPG, PNG, WebP or AVIF image.'));
  },
});
