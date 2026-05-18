import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Response } from 'express';
import { IUser } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}-refresh`;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

// ─── Access Token ─────────────────────────────────────────────────────────────

export const generateAccessToken = (user: IUser): string => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

export const generateRefreshToken = (user: IUser): string => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  );
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
};

/**
 * Hash a refresh token for storage in the database.
 * We store the hash so a DB leak doesn't expose valid refresh tokens.
 */
export const hashRefreshToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Set the refresh token as an httpOnly cookie.
 * Access tokens are NOT stored in cookies — they live in memory / localStorage on the client.
 */
export const setRefreshTokenCookie = (res: Response, refreshToken: string): void => {
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth', // scope cookie to auth routes only
  });
};

export const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
};

// ─── Legacy aliases (used by existing code during migration) ──────────────────

/** @deprecated Use generateAccessToken instead */
export const generateToken = generateAccessToken;

/** @deprecated Use verifyAccessToken instead */
export const verifyToken = verifyAccessToken;

/** @deprecated Use setRefreshTokenCookie instead */
export const setTokenCookie = (res: Response, token: string): void => {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
};

/** @deprecated Use clearRefreshTokenCookie instead */
export const clearTokenCookie = (res: Response): void => {
  res.clearCookie('auth_token', { path: '/' });
};
