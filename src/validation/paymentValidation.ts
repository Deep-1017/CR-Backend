import { z } from 'zod';

const customerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  zipCode: z.string().min(1, 'Zip code is required'),
});

const pricingSchema = z.object({
  subtotal: z.number().nonnegative('Subtotal must be zero or more'),
  tax: z.number().nonnegative('Tax must be zero or more').default(0),
  shipping: z.number().nonnegative('Shipping must be zero or more').default(0),
  total: z.number().positive('Total amount must be greater than zero'),
});

export const createPaymentOrderSchema = z.object({
  customer: customerSchema,
  cartItems: z.array(z.object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z.number().int().positive('Quantity must be a positive integer'),
    price: z.number().nonnegative('Price must be a non-negative number'),
  })).min(1, 'Cart must contain at least one item'),
  pricing: pricingSchema,
  currency: z.literal('INR'),
});

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;

export const verifyPaymentWebhookSchema = z.object({
  razorpay_order_id: z.string().min(1, 'razorpay_order_id is required'),
  razorpay_payment_id: z.string().min(1, 'razorpay_payment_id is required'),
  razorpay_signature: z.string().min(1, 'razorpay_signature is required'),
});

export type VerifyPaymentWebhookInput = z.infer<typeof verifyPaymentWebhookSchema>;
