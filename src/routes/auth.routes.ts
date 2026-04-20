import { Router } from 'express';
import passport from '../config/passport';
import {
  register,
  login,
  logout,
  getProfile,
  forgotPassword,
  resetPassword,
  googleCallback,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/profile', protect, getProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
  }),
  googleCallback
);

export default router;
