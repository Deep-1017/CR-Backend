import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import AppError from "../utils/appError";

/**
 * Validates req.body against the given Zod schema.
 * Used for POST / PUT / PATCH endpoints.
 */
export const validate =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new AppError("Validation failed", 400, result.error.flatten());
    }
    req.body = result.data;
    next();
  };

/**
 * Validates req.query against the given Zod schema.
 * Replaces req.query with the parsed (and coerced) values.
 * Used for GET endpoints that accept query parameters.
 */
export const validateQuery =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      throw new AppError(
        "Invalid query parameters",
        400,
        result.error.flatten(),
      );
    }
    // Overwrite req.query with the validated + coerced values
    req.query = result.data as typeof req.query;
    next();
  };
