import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/appError';
import logger from '../utils/logger';

export const notFound = (req: Request, res: Response, next: NextFunction) => {
    next(new AppError(`Not found - ${req.originalUrl}`, 404));
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
    let error = err;

    if (!(error instanceof AppError)) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        error = new AppError(message, 500);
    }

    const appError = error as AppError;
    const statusCode = appError.statusCode || 500;

    logger.error('API error', {
        message: appError.message,
        statusCode,
        stack: appError.stack,
        path: req.originalUrl,
        method: req.method,
    });

    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        res.status(statusCode).json({ message: 'Internal server error' });
        return;
    }

    res.status(statusCode).json({
        message: appError.message,
        details: appError.details,
        stack: process.env.NODE_ENV === 'production' ? undefined : appError.stack,
    });
};

