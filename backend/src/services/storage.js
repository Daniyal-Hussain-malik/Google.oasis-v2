import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { badRequest, notFound } from '../utils/http.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

export function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  // AVIF / HEIF: ....ftypavif or ....ftypavis
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return null;
}

let cachedClient = null;

export function isCloudStorageConfigured() {
  const s = env.storage;
  return Boolean(s.provider !== 'local' && s.bucket && s.accessKeyId && s.secretAccessKey);
}

function resolveEndpoint() {
  const s = env.storage;
  if (s.endpoint) return s.endpoint;
  if (s.provider === 'r2' && s.r2AccountId) {
    return `https://${s.r2AccountId}.r2.cloudflarestorage.com`;
  }
  if (s.provider === 'gcs') {
    return 'https://storage.googleapis.com';
  }
  return undefined;
}

function getS3Client() {
  if (cachedClient) return cachedClient;
  const s = env.storage;
  const endpoint = resolveEndpoint();
  cachedClient = new S3Client({
    region: s.region || (s.provider === 'r2' ? 'auto' : 'us-east-1'),
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: s.provider === 'gcs' || Boolean(process.env.STORAGE_FORCE_PATH_STYLE === 'true'),
    credentials: {
      accessKeyId: s.accessKeyId,
      secretAccessKey: s.secretAccessKey,
    },
  });
  return cachedClient;
}

function cleanFolder(folder) {
  const safe = String(folder || 'media').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
  return safe || 'media';
}

function sanitizeObjectKey(rawKey) {
  const cleaned = String(rawKey || '')
    .replace(/^\/+/, '')
    .replace(/\.\.+/g, '')
    .replace(/[^a-zA-Z0-9/_.-]/g, '');
  if (!cleaned || cleaned.includes('..')) return '';
  return cleaned;
}

function buildPublicUrl(key) {
  if (env.storage.publicUrl) {
    return `${env.storage.publicUrl}/${key}`;
  }
  return `/api/public/media/${key}`;
}

export function extractObjectKeyFromUrl(urlOrKey) {
  const raw = String(urlOrKey || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/api/public/media/')) {
    return sanitizeObjectKey(decodeURIComponent(raw.slice('/api/public/media/'.length)));
  }
  if (raw.startsWith('/uploads/')) {
    return sanitizeObjectKey(decodeURIComponent(raw.slice('/uploads/'.length)));
  }
  if (env.storage.publicUrl && raw.startsWith(env.storage.publicUrl)) {
    return sanitizeObjectKey(decodeURIComponent(raw.slice(env.storage.publicUrl.length)));
  }
  return sanitizeObjectKey(raw);
}

export async function uploadImageObject({ buffer, mimeType, folder = 'media' }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw badRequest('Upload an image file.');
  }

  const detectedMime = detectImageMime(buffer);
  const effectiveMime = detectedMime && EXT_BY_MIME[detectedMime] ? detectedMime : null;
  if (!effectiveMime || (mimeType && EXT_BY_MIME[mimeType] && detectedMime !== mimeType)) {
    throw badRequest('Upload a valid JPG, PNG, WebP or AVIF image.');
  }

  const ext = EXT_BY_MIME[effectiveMime];
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  const folderName = cleanFolder(folder);
  const keyParts = [env.storage.prefix, folderName, fileName].filter(Boolean);
  const objectKey = keyParts.join('/');

  if (isCloudStorageConfigured()) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: env.storage.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: effectiveMime,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return {
      key: objectKey,
      url: buildPublicUrl(objectKey),
      provider: env.storage.provider,
      persistent: true,
    };
  }

  if (env.production && process.env.ALLOW_LOCAL_UPLOADS !== 'true') {
    throw badRequest('Cloud object storage (S3, R2, or GCS) is not configured for production uploads.');
  }

  const targetDir = path.resolve(UPLOAD_DIR, folderName);
  if (!targetDir.startsWith(UPLOAD_DIR + path.sep) && targetDir !== UPLOAD_DIR) {
    throw badRequest('Invalid upload target directory.');
  }
  await fs.mkdir(targetDir, { recursive: true });
  const targetFile = path.resolve(targetDir, fileName);
  if (!targetFile.startsWith(targetDir + path.sep)) {
    throw badRequest('Invalid upload file path.');
  }
  await fs.writeFile(targetFile, buffer);

  return {
    key: `${folderName}/${fileName}`,
    url: `/uploads/${folderName}/${fileName}`,
    provider: 'local',
    persistent: false,
  };
}

export async function deleteMediaObject(urlOrKey) {
  const key = extractObjectKeyFromUrl(urlOrKey);
  if (!key) throw badRequest('Invalid media reference.');

  if (isCloudStorageConfigured()) {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.storage.bucket,
        Key: key,
      }),
    );
    return;
  }

  const resolved = path.resolve(UPLOAD_DIR, key);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep)) {
    throw badRequest('Invalid local file path.');
  }
  try {
    await fs.unlink(resolved);
  } catch (error) {
    if (error.code === 'ENOENT') throw notFound('File not found.');
    throw error;
  }
}

export async function getCloudMediaStream(rawKey) {
  const key = sanitizeObjectKey(rawKey);
  if (!key) throw notFound('Media object not found.');

  if (isCloudStorageConfigured()) {
    const client = getS3Client();
    try {
      const obj = await client.send(
        new GetObjectCommand({
          Bucket: env.storage.bucket,
          Key: key,
        }),
      );
      const ext = path.extname(key).toLowerCase();
      return {
        body: obj.Body,
        contentType: obj.ContentType || MIME_BY_EXT[ext] || 'application/octet-stream',
        cacheControl: obj.CacheControl || 'public, max-age=31536000, immutable',
      };
    } catch (err) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
        throw notFound('Media object not found.');
      }
      throw err;
    }
  }

  const resolved = path.resolve(UPLOAD_DIR, key);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep)) {
    throw notFound('Media object not found.');
  }
  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    return {
      buffer: data,
      contentType: MIME_BY_EXT[ext] || 'application/octet-stream',
      cacheControl: 'public, max-age=2592000',
    };
  } catch (err) {
    if (err.code === 'ENOENT') throw notFound('Media object not found.');
    throw err;
  }
}

export async function createSignedDownloadUrl(rawKey, expiresIn = 300) {
  const key = extractObjectKeyFromUrl(rawKey);
  if (!key || !isCloudStorageConfigured()) return buildPublicUrl(key);
  const client = getS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: env.storage.bucket, Key: key }),
    { expiresIn },
  );
}

export function getStorageStatus() {
  return {
    provider: env.storage.provider,
    bucket: env.storage.bucket || null,
    configured: isCloudStorageConfigured(),
    persistent: isCloudStorageConfigured(),
  };
}

export async function uploadBackupObject({ filename, buffer, contentType = 'application/gzip' }) {
  if (!isCloudStorageConfigured()) return null;
  const safeName = sanitizeObjectKey(filename).split('/').pop();
  if (!safeName) throw badRequest('Invalid backup object name.');
  const keyParts = [env.storage.prefix, 'backups', safeName].filter(Boolean);
  const objectKey = keyParts.join('/');
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.storage.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'private, max-age=0, no-store',
    }),
  );
  return { key: objectKey, provider: env.storage.provider, bucket: env.storage.bucket };
}

