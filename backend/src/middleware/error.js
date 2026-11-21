import multer from 'multer';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message, details: error.details });
  }
  if (error?.name === 'SequelizeValidationError') {
    const details = Object.fromEntries(error.errors.map((item) => [item.path, item.message]));
    return res.status(400).json({ message: 'Some fields are not valid.', details });
  }
  if (error?.name === 'SequelizeUniqueConstraintError') {
    const field = error.errors?.[0]?.path?.replace(/^.*\./, '') || Object.keys(error.fields || {})[0] || 'value';
    return res.status(409).json({ message: `That ${field} is already in use.` });
  }
  if (error?.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({ message: 'This record is linked to other records, or points at something that does not exist.' });
  }
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Images can be up to 5 MB.' : error.message });
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'The request body is not valid JSON.' });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'The request is too large.' });
  }

  console.error(error);
  return res.status(500).json({ message: env.production ? 'Something went wrong on our side.' : error.message });
}
