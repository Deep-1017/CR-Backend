import { z } from 'zod';

export const createStockAlertSchema = z.object({
    productId: z.string().trim().min(1),
    variantKey: z.string().trim().min(1).max(200),
    email: z.string().trim().toLowerCase().email(),
});

export type CreateStockAlertInput = z.infer<typeof createStockAlertSchema>;
