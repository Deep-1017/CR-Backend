import { z } from 'zod';

export const createPaymentOrderSchema = z.object({
  cartItems: z.array(z.object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z.number().int().positive('Quantity must be a positive integer'),
    price: z.number().nonnegative('Price must be a non-negative number'),
  })).min(1, 'Cart must contain at least one item'),
  totalAmount: z.number().positive('Total amount must be greater than zero'),
  currency: z.literal('INR'),
});

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;

export const verifyPaymentWebhookSchema = z.object({
  razorpay_order_id: z.string().min(1, 'razorpay_order_id is required'),
  razorpay_payment_id: z.string().min(1, 'razorpay_payment_id is required'),
  razorpay_signature: z.string().min(1, 'razorpay_signature is required'),
});

export type VerifyPaymentWebhookInput = z.infer<typeof verifyPaymentWebhookSchema>;
