import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';
import env from '../config/env';
import User from '../models/user.model';

interface DecodedToken extends JwtPayload {
    userId: string;
    role: 'customer' | 'admin';
}

export const protect = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new AppError('Not authorized, no token', 401);
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as DecodedToken;

        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            throw new AppError('User not found', 401);
        }

        // FIX-18: req.user is now properly typed via src/types/express.d.ts
        req.user = {
            id: user._id.toString(),
            role: user.role,
            email: user.email,
            name: user.name,
        };

        next();
    } catch (err) {
        // FIX-13: Differentiate between expired and invalid tokens
        if (err instanceof jwt.TokenExpiredError) {
            throw new AppError('Session expired, please log in again', 401);
        }
        throw new AppError('Not authorized, invalid token', 401);
    }
});

export const admin = (req: Request, _res: Response, next: NextFunction) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        throw new AppError('Not authorized as admin', 403);
    }
};
