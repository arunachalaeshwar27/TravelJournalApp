import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { uploadPhotoHandler } from '../controllers/uploadController';

const router = Router();

// Store file in memory buffer (we'll stream directly to Firebase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  },
});

router.post('/photo', authMiddleware, upload.single('photo'), uploadPhotoHandler);

export default router;
