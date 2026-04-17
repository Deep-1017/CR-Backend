import express from 'express';
import { protect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createRazorpayOrder, verifyRazorpayWebhook } from '../controllers/payment.controller';
import { createPaymentOrderSchema, verifyPaymentWebhookSchema } from '../validation/paymentValidation';

const router = express.Router();

/**
 * @openapi
 * /api/payments/create-order:
 *   post:
 *     summary: Create a Razorpay payment order
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cartItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     price:
 *                       type: number
 *                 minItems: 1
 *               totalAmount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 enum: [INR]
 *             required: [cartItems, totalAmount, currency]
 *     responses:
 *       '201':
 *         description: Razorpay order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orderId:
 *                   type: string
 *                 razorpayOrderId:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 currency:
 *                   type: string
 *                 key:
 *                   type: string
 *       '400':
 *         description: Validation error or invalid cart items
 *       '500':
 *         description: Razorpay API error
 */
router.post('/create-order', protect, validate(createPaymentOrderSchema), createRazorpayOrder);
router.post('/verify-webhook', validate(verifyPaymentWebhookSchema), verifyRazorpayWebhook);

export default router;
