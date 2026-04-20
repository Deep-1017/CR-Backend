import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({
      success: false,
      message: `An account with this ${field} already exists.`,
    });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e: any) => e.message);
    return res.status(400).json({
      success: false,
      message: messages[0] || 'Validation error',
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Session expired' });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  console.error('[Unhandled Error]', err);
  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again later.',
  });
};

