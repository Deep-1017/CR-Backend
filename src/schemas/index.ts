import { z } from 'zod';
export {
    createProductSchema,
    updateProductSchema,
    productVariantSchema,
    createProductVariantSchema,
    updateProductVariantSchema,
} from '../validation/productValidation';

export const registerSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const addOrderSchema = z.object({
    customer: z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        address: z.string().min(1),
        city: z.string().min(1),
        state: z.string().optional(),
        zipCode: z.string().min(1),
    }),
    items: z.array(z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1, 'Variant selection is required before checkout'),
        configuration: z.string().min(1),
        finish: z.string().min(1),
        name: z.string().min(1).optional(),
        price: z.number().positive().optional(),
        priceAtPurchase: z.number().positive().optional(),
        quantity: z.number().int().positive(),
        sku: z.string().optional(),
        image: z.string().optional(),
    })).min(1, 'Order must contain at least one item'),
    totalAmount: z.number().positive(),
    paymentDetails: z.object({
        provider: z.string().min(1),
        paymentIntentId: z.string().optional(),
    }),
});

export const updateOrderStatusSchema = z.object({
    status: z.enum(['Pending', 'Processing', 'Completed', 'Cancelled']),
});

export const updateProfileSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    password: z.string().min(8).max(128).optional(),
    // NOTE: email and role must NOT be in this schema — no self-service email/role changes
});
