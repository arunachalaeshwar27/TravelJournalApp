import { Request, Response } from 'express';
import { getAuth } from '../config/firebase';
import { upsertUser, getUserById } from '../services/firestoreService';
import { UserProfile, ApiResponse } from '../models/types';
import { logger } from '../config/logger';

/**
 * POST /v1/auth/login
 *
 * Called after client signs in with Google on device.
 * Client sends Firebase ID token → server verifies + upserts user profile.
 *
 * This endpoint is idempotent — safe to call on every app launch.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    // req.user is already set by authMiddleware
    const { uid, email, name, picture } = req.user!;

    const profile: UserProfile = {
      id: uid,
      email: email ?? '',
      name: name ?? 'Traveler',
      photoUrl: picture,
      provider: 'google',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await upsertUser(profile);

    logger.info('User logged in', { userId: uid, email });

    res.status(200).json({
      success: true,
      data: profile,
      message: 'Login successful',
    } as ApiResponse<UserProfile>);
  } catch (error) {
    logger.error('Login failed', { error });
    res.status(500).json({
      success: false,
      error: 'Login failed',
    } as ApiResponse);
  }
}

/**
 * GET /v1/auth/me
 * Returns the current authenticated user's profile
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await getUserById(req.user!.uid);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' } as ApiResponse);
      return;
    }

    res.json({ success: true, data: user } as ApiResponse<UserProfile>);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile' } as ApiResponse);
  }
}

/**
 * POST /v1/auth/logout
 * Revokes Firebase refresh tokens (forces re-login on all devices)
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    await getAuth().revokeRefreshTokens(req.user!.uid);
    logger.info('User logged out + tokens revoked', { userId: req.user!.uid });
    res.json({ success: true, message: 'Logged out successfully' } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Logout failed' } as ApiResponse);
  }
}
