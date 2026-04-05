import { Router } from 'express';
import { body } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { syncHandler } from '../controllers/syncController';

const router = Router();

router.post(
  '/',
  authMiddleware,
  [
    body('lastSyncAt').isISO8601().withMessage('lastSyncAt must be ISO8601 timestamp'),
    body('entries').isArray().withMessage('entries must be an array'),
  ],
  validate,
  syncHandler,
);

export default router;
