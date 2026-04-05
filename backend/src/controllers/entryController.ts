import { Request, Response } from 'express';
import {
  createEntry,
  getEntryById,
  updateEntry,
  softDeleteEntry,
  getEntriesByUser,
  searchEntries,
} from '../services/firestoreService';
import { JournalEntry, ApiResponse, SearchQuery } from '../models/types';
import { logger } from '../config/logger';

// ─── GET /v1/entries ──────────────────────────────────────────────
export async function listEntries(req: Request, res: Response): Promise<void> {
  try {
    const entries = await getEntriesByUser(req.user!.uid);
    res.json({ success: true, data: entries } as ApiResponse<JournalEntry[]>);
  } catch (error) {
    logger.error('List entries failed', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch entries' } as ApiResponse);
  }
}

// ─── GET /v1/entries/:id ──────────────────────────────────────────
export async function getEntry(req: Request, res: Response): Promise<void> {
  try {
    const entry = await getEntryById(req.params.id);

    if (!entry) {
      res.status(404).json({ success: false, error: 'Entry not found' } as ApiResponse);
      return;
    }

    // Ownership check — users can only read their own entries
    if (entry.userId !== req.user!.uid) {
      res.status(403).json({ success: false, error: 'Forbidden' } as ApiResponse);
      return;
    }

    res.json({ success: true, data: entry } as ApiResponse<JournalEntry>);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch entry' } as ApiResponse);
  }
}

// ─── POST /v1/entries ─────────────────────────────────────────────
export async function createEntryHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as JournalEntry;

    // Ensure userId matches authenticated user
    const entry: JournalEntry = {
      ...body,
      userId: req.user!.uid,
      syncStatus: 'synced',
    };

    const created = await createEntry(entry);
    logger.info('Entry created', { entryId: created.id, userId: req.user!.uid });
    res.status(201).json({ success: true, data: created } as ApiResponse<JournalEntry>);
  } catch (error) {
    logger.error('Create entry failed', { error });
    res.status(500).json({ success: false, error: 'Failed to create entry' } as ApiResponse);
  }
}

// ─── PUT /v1/entries/:id ──────────────────────────────────────────
export async function updateEntryHandler(req: Request, res: Response): Promise<void> {
  try {
    const existing = await getEntryById(req.params.id);

    if (!existing) {
      res.status(404).json({ success: false, error: 'Entry not found' } as ApiResponse);
      return;
    }

    if (existing.userId !== req.user!.uid) {
      res.status(403).json({ success: false, error: 'Forbidden' } as ApiResponse);
      return;
    }

    const updated = await updateEntry(req.params.id, {
      ...req.body,
      userId: req.user!.uid, // prevent ownership override
    });

    res.json({ success: true, data: updated } as ApiResponse<JournalEntry>);
  } catch (error) {
    logger.error('Update entry failed', { error });
    res.status(500).json({ success: false, error: 'Failed to update entry' } as ApiResponse);
  }
}

// ─── DELETE /v1/entries/:id ───────────────────────────────────────
export async function deleteEntryHandler(req: Request, res: Response): Promise<void> {
  try {
    const existing = await getEntryById(req.params.id);

    if (!existing) {
      res.status(404).json({ success: false, error: 'Entry not found' } as ApiResponse);
      return;
    }

    if (existing.userId !== req.user!.uid) {
      res.status(403).json({ success: false, error: 'Forbidden' } as ApiResponse);
      return;
    }

    await softDeleteEntry(req.params.id, req.user!.uid);
    res.json({ success: true, message: 'Entry deleted' } as ApiResponse);
  } catch (error) {
    logger.error('Delete entry failed', { error });
    res.status(500).json({ success: false, error: 'Failed to delete entry' } as ApiResponse);
  }
}

// ─── GET /v1/entries/search ───────────────────────────────────────
export async function searchEntriesHandler(req: Request, res: Response): Promise<void> {
  try {
    const query: SearchQuery = {
      q: req.query.q as string | undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      lat: req.query.lat ? Number(req.query.lat) : undefined,
      lng: req.query.lng ? Number(req.query.lng) : undefined,
      radiusKm: req.query.radiusKm ? Number(req.query.radiusKm) : 10,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    };

    const results = await searchEntries(req.user!.uid, query);
    res.json({
      success: true,
      data: results,
      message: `${results.length} results found`,
    } as ApiResponse<JournalEntry[]>);
  } catch (error) {
    logger.error('Search failed', { error });
    res.status(500).json({ success: false, error: 'Search failed' } as ApiResponse);
  }
}
