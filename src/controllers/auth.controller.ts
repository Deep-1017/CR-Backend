import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';
import User from '../models/user.model';
import env from '../config/env';

const generateToken = (userId: string, role: string) => {
    return jwt.sign({ userId, role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as any,
    });
};

export const register = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new AppError('User already exists', 400);
    }

    const user = await User.create({
        name,
        email,
        password,
    });

    const token = generateToken(user._id.toString(), user.role);

    res.status(201).json({
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        throw new AppError('Invalid email or password', 401);
    }

    const token = generateToken(user._id.toString(), user.role);

    res.json({
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
    // FIX-18: req.user is now properly typed via src/types/express.d.ts
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Not authorized', 401);
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    res.json({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
    });
});

// FIX-17: Only allow name and password updates — never email or role
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
    // FIX-18: req.user is now properly typed via src/types/express.d.ts
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authorized', 401);

    const user = await User.findById(userId).select('+password');
    if (!user) throw new AppError('User not found', 404);

    const { name, password } = req.body; // ONLY these two — never email or role

    if (name) user.name = name;
    if (password) user.password = password; // pre-save hook will re-hash

    await user.save();

    res.json({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
    });
});
