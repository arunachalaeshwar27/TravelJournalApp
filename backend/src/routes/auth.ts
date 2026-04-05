import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { login, getMe, logout } from '../controllers/authController';

const router = Router();

router.post('/login', authMiddleware, login);
router.get('/me', authMiddleware, getMe);
router.post('/logout', authMiddleware, logout);

export default router;
