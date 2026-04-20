import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema';
import { generateToken, setTokenCookie, clearTokenCookie } from '../utils/jwt';

const sanitizeUser = (user: any) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  role: user.role,
  provider: user.provider,
});

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, email, password } = parsed.data;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const user = await User.create({ name, email, password, provider: 'local' });
    const token = generateToken(user);
    setTokenCookie(res, token);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: sanitizeUser(user),
      token,
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (user.provider !== 'local') {
      return res.status(401).json({
        success: false,
        message: `This account uses ${user.provider} sign-in. Please use that button instead.`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);
    setTokenCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: sanitizeUser(user),
      token,
    });
  } catch (err) {
    next(err);
  }
};

export const logout = (_req: Request, res: Response) => {
  clearTokenCookie(res);
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authUser = req.user as { id?: string; _id?: string } | undefined;
    const userId = authUser?.id || authUser?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid email.' });
    }

    const user = await User.findOne({ email: parsed.data.email });
    if (!user || user.provider !== 'local') {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a reset link has been sent.',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    (user as any).passwordResetToken = resetTokenHash;
    (user as any).passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.',
      devResetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.params;
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is invalid or has expired.',
      });
    }

    user.password = parsed.data.password;
    (user as any).passwordResetToken = undefined;
    (user as any).passwordResetExpires = undefined;
    await user.save();

    const jwtToken = generateToken(user);
    setTokenCookie(res, jwtToken);

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You are now logged in.',
      user: sanitizeUser(user),
      token: jwtToken,
    });
  } catch (err) {
    next(err);
  }
};

export const googleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
    const token = generateToken(user);
    setTokenCookie(res, token);
    return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    next(err);
  }
};
