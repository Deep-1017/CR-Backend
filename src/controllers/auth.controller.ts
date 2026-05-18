import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../schemas/auth.schema';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from '../utils/jwt';
import { sendEmailVerificationEmail } from '../services/emailService';
import logger from '../utils/logger';

const sanitizeUser = (user: any) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || '',
  avatar: user.avatar,
  role: user.role,
  provider: user.provider,
  isEmailVerified: user.isEmailVerified,
});

/**
 * Issue an access + refresh token pair.
 * Stores the hashed refresh token in the User document and sets it as an httpOnly cookie.
 * Returns the access token string so the controller can include it in the response body.
 */
const issueTokenPair = async (res: Response, user: any): Promise<string> => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Persist hashed refresh token in DB for server-side validation
  await User.findByIdAndUpdate(user._id, {
    refreshToken: hashRefreshToken(refreshToken),
  });

  // Set refresh token as httpOnly cookie
  setRefreshTokenCookie(res, refreshToken);

  return accessToken;
};

// ─── Register ─────────────────────────────────────────────────────────────────

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

    // Generate email verification token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await User.create({
      name,
      email,
      password,
      provider: 'local',
      isEmailVerified: false,
      emailVerificationToken: hashedToken,
    });

    // Send verification email (non-blocking)
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}`;
    sendEmailVerificationEmail({ email: user.email, name: user.name }, verificationUrl).catch(
      (err) => logger.error('Failed to send verification email', { error: String(err) })
    );

    const accessToken = await issueTokenPair(res, user);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      user: sanitizeUser(user),
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────

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

    if (user.isBanned === true) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended.',
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

    // Block login for unverified users
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
      });
    }

    const accessToken = await issueTokenPair(res, user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: sanitizeUser(user),
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found.',
      });
    }

    // Verify the JWT signature and expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token.',
      });
    }

    // Validate the token against the hashed version in DB
    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || !user.refreshToken) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked.',
      });
    }

    const hashedIncoming = hashRefreshToken(token);
    if (hashedIncoming !== user.refreshToken) {
      // Possible token reuse — clear refresh token as a safety measure
      user.refreshToken = undefined;
      await user.save({ validateBeforeSave: false });
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Refresh token mismatch. Please log in again.',
      });
    }

    // Rotate: issue a brand new token pair
    const accessToken = await issueTokenPair(res, user);

    return res.status(200).json({
      success: true,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try to identify the user from the refresh token cookie
    const token = req.cookies?.refresh_token;
    if (token) {
      try {
        const decoded = verifyRefreshToken(token);
        await User.findByIdAndUpdate(decoded.id, { $unset: { refreshToken: 1 } });
      } catch {
        // Token invalid — nothing to revoke, just clear cookies
      }
    }

    clearRefreshTokenCookie(res);

    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─── Profile ──────────────────────────────────────────────────────────────────

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

export const updateProfile = async (
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

    // Only allow profile basics here. Email/password updates must use dedicated flows.
    if (typeof req.body?.name === 'string') {
      user.name = req.body.name.trim();
    }

    if (typeof req.body?.phone === 'string') {
      user.phone = req.body.phone.trim();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Forgot Password ─────────────────────────────────────────────────────────

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const authUser = req.user as { id?: string; _id?: string } | undefined;
    const userId = authUser?.id || authUser?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in.',
      });
    }

    const user = await User.findById(userId).select('+password +refreshToken');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Password changes are not available for this account.',
      });
    }

    const isMatch = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password.',
      });
    }

    const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);
    await User.findByIdAndUpdate(user._id, {
      $set: { password: hashedPassword },
      $unset: { refreshToken: 1 },
    });
    clearRefreshTokenCookie(res);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
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

// ─── Reset Password ──────────────────────────────────────────────────────────

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

    // Invalidate any existing refresh tokens (force re-login on other devices)
    const accessToken = await issueTokenPair(res, user);

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You are now logged in.',
      user: sanitizeUser(user),
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Google OAuth Callback ───────────────────────────────────────────────────

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

    const accessToken = await issueTokenPair(res, user);

    // Redirect with the access token so the frontend can store it
    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}`
    );
  } catch (err) {
    next(err);
  }
};

// ─── Email Verification ──────────────────────────────────────────────────────

export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required.',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ emailVerificationToken: hashedToken });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified.',
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (err) {
    next(err);
  }
};

// ─── Resend Verification ─────────────────────────────────────────────────────

export const resendVerification = async (
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

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified.',
      });
    }

    // Generate a new verification token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.emailVerificationToken = hashedToken;
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}`;
    const result = await sendEmailVerificationEmail(
      { email: user.email, name: user.name },
      verificationUrl
    );

    if (!result.ok) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (err) {
    next(err);
  }
};
