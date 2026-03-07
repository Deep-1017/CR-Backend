import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import AppError from '../utils/appError';

export const validate = (schema: ZodSchema) =>
    (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            throw new AppError('Validation failed', 400, result.error.flatten());
        }
        req.body = result.data;
        next();
    };
