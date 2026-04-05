/**
 * Firebase Storage Service
 *
 * Upload flow:
 *  1. Client sends multipart POST with image buffer
 *  2. Server uploads to Firebase Storage bucket
 *  3. Server generates a signed URL (public for 10 years)
 *  4. Returns { remoteUrl, photoId }
 *  5. AI tagging service is called with the URL
 *
 * Storage path structure:
 *  /users/{userId}/entries/{entryId}/photos/{photoId}.jpg
 *
 * WHY not upload directly from client?
 *  - Server-side upload lets us:
 *    a) validate file type + size before storing
 *    b) trigger AI tagging in the same request
 *    c) enforce userId scoping in the storage path
 */

import { getStorage } from '../config/firebase';
import { logger } from '../config/logger';
import * as path from 'path';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface UploadResult {
  photoId: string;
  remoteUrl: string;
  storagePath: string;
}

export async function uploadPhoto(opts: {
  userId: string;
  entryId: string;
  photoId: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}): Promise<UploadResult> {
  const { userId, entryId, photoId, buffer, mimeType, originalName } = opts;

  // Validate
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error(`File too large: ${buffer.length} bytes. Max: ${MAX_SIZE_BYTES}`);
  }

  const ext = path.extname(originalName) || '.jpg';
  const storagePath = `users/${userId}/entries/${entryId}/photos/${photoId}${ext}`;

  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        userId,
        entryId,
        photoId,
      },
    },
  });

  // Make file publicly readable & get permanent URL
  await file.makePublic();
  const remoteUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  logger.debug('Photo uploaded to Firebase Storage', { storagePath, remoteUrl });

  return { photoId, remoteUrl, storagePath };
}

export async function deletePhoto(storagePath: string): Promise<void> {
  try {
    const bucket = getStorage().bucket();
    await bucket.file(storagePath).delete();
    logger.debug('Photo deleted from storage', { storagePath });
  } catch (err) {
    logger.warn('Failed to delete photo (may not exist)', { storagePath, err });
  }
}
