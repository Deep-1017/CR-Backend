import { z } from 'zod';

export const registerSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const createProductSchema = z.object({
    name: z.string().min(1).max(200),
    category: z.string().min(1),
    price: z.number().positive(),
    originalPrice: z.number().positive().optional(),
    onSale: z.boolean().optional(),
    image: z.string().url().or(z.string().startsWith('/')),
    images: z.array(z.string()).optional().default([]),
    description: z.string().min(1),
    brand: z.string().min(1),
    specifications: z.array(z.object({
        label: z.string(),
        value: z.string(),
    })).optional().default([]),
});

export const updateProductSchema = createProductSchema.partial();

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
        name: z.string().min(1),
        price: z.number().positive(),
        quantity: z.number().int().positive(),
        image: z.string(),
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
