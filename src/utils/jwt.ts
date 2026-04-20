import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { IUser } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

export const generateToken = (user: IUser): string => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

export const setTokenCookie = (res: Response, token: string): void => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
};

export const clearTokenCookie = (res: Response): void => {
  res.clearCookie('auth_token', { path: '/' });
};
