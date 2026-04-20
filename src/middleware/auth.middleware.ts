import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export const protect = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.cookies?.auth_token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in.',
      });
    }

    const decoded = verifyToken(token);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: '',
    };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please sign in again.',
    });
  }
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authUser = req.user as { role?: string } | undefined;
  if (authUser?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }
  next();
};

export const admin = requireAdmin;
