import { Request, Response } from 'express';
import { uploadPhoto } from '../services/storageService';
import { tagImageWithVision } from '../services/aiTaggingService';
import { getFirestore, COLLECTIONS } from '../config/firebase';
import { ApiResponse } from '../models/types';
import { logger } from '../config/logger';

/**
 * POST /v1/upload/photo
 *
 * Multipart form-data:
 *   - photo: image file
 *   - entryId: string
 *   - photoId: string (client-generated UUID)
 *
 * Flow:
 *  1. Validate file type + size
 *  2. Upload to Firebase Storage
 *  3. Call Google Vision AI for tags
 *  4. Update the photo record in Firestore (if entry exists)
 *  5. Return { remoteUrl, tags }
 */
export async function uploadPhotoHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' } as ApiResponse);
      return;
    }

    const { entryId, photoId } = req.body as { entryId: string; photoId: string };

    if (!entryId || !photoId) {
      res.status(400).json({
        success: false,
        error: 'entryId and photoId are required',
      } as ApiResponse);
      return;
    }

    // 1. Upload to Firebase Storage
    const uploadResult = await uploadPhoto({
      userId: req.user!.uid,
      entryId,
      photoId,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    // 2. AI tagging
    const tags = await tagImageWithVision(uploadResult.remoteUrl);

    // 3. Update photo record in Firestore entry (if entry already exists)
    try {
      const db = getFirestore();
      const entryRef = db.collection(COLLECTIONS.ENTRIES).doc(entryId);
      const entryDoc = await entryRef.get();

      if (entryDoc.exists) {
        const entry = entryDoc.data()!;
        const photos = (entry.photos || []).map((p: { id: string; [key: string]: unknown }) =>
          p.id === photoId
            ? { ...p, remoteUrl: uploadResult.remoteUrl, tags, taggingStatus: 'done' }
            : p,
        );
        // Merge all photo tags into entry-level tags
        const allTags = [...new Set([...(entry.tags || []), ...tags])];
        await entryRef.update({ photos, tags: allTags, updatedAt: new Date().toISOString() });
      }
    } catch (updateError) {
      // Non-critical — entry may not exist yet (created after upload)
      logger.warn('Could not update entry with photo tags', { entryId, updateError });
    }

    logger.info('Photo uploaded + tagged', {
      photoId,
      entryId,
      userId: req.user!.uid,
      tags,
    });

    res.status(201).json({
      success: true,
      data: {
        photoId,
        remoteUrl: uploadResult.remoteUrl,
        tags,
        taggingStatus: 'done',
      },
    } as ApiResponse);
  } catch (error) {
    logger.error('Photo upload failed', { error });
    res.status(500).json({ success: false, error: 'Photo upload failed' } as ApiResponse);
  }
}
