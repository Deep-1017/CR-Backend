import express from 'express';
import { createStockAlert } from '../controllers/stockAlert.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createStockAlertSchema } from '../validation/stockAlertValidation';

const router = express.Router();

router.post('/', optionalAuth, validate(createStockAlertSchema), createStockAlert);

export default router;
