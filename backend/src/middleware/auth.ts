/**
 * Firebase Auth Middleware
 *
 * Flow:
 *  1. Client sends   Authorization: Bearer <firebase_id_token>
 *  2. Middleware calls admin.auth().verifyIdToken(token)
 *  3. Firebase validates signature + expiry with Google's public keys
 *  4. Decoded UID + email attached to req.user
 *  5. Every protected route can trust req.user without touching DB
 *
 * Security notes:
 *  - ID tokens expire after 1 hour (Firebase auto-refreshes on client)
 *  - Admin SDK caches Google's public keys — no network call per request
 *  - No JWT secret management needed (Firebase handles it)
 */

import { Request, Response, NextFunction } from 'express';
import { getAuth } from '../config/firebase';
import { ApiResponse } from '../models/types';
import { logger } from '../config/logger';

// Extend Express Request to include decoded user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        name?: string;
        picture?: string;
      };
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid Authorization header',
      } as ApiResponse);
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await getAuth().verifyIdToken(idToken);

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    };

    next();
  } catch (error) {
    logger.warn('Auth failed', { error });
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    } as ApiResponse);
  }
}
