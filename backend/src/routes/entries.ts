import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  listEntries,
  getEntry,
  createEntryHandler,
  updateEntryHandler,
  deleteEntryHandler,
  searchEntriesHandler,
} from '../controllers/entryController';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /v1/entries/search — must be before /:id route
router.get('/search', searchEntriesHandler);

// GET /v1/entries
router.get('/', listEntries);

// GET /v1/entries/:id
router.get('/:id', param('id').isString().notEmpty(), validate, getEntry);

// POST /v1/entries
router.post(
  '/',
  [
    body('id').isString().notEmpty().withMessage('id required'),
    body('title').isString().withMessage('title required'),
    body('createdAt').isISO8601().withMessage('createdAt must be ISO8601'),
    body('updatedAt').isISO8601().withMessage('updatedAt must be ISO8601'),
  ],
  validate,
  createEntryHandler,
);

// PUT /v1/entries/:id
router.put(
  '/:id',
  [
    param('id').isString().notEmpty(),
    body('updatedAt').isISO8601().withMessage('updatedAt must be ISO8601'),
  ],
  validate,
  updateEntryHandler,
);

// DELETE /v1/entries/:id
router.delete('/:id', param('id').isString().notEmpty(), validate, deleteEntryHandler);

export default router;
