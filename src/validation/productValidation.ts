import { z } from 'zod';

const imagePathSchema = z.string().url().or(z.string().startsWith('/'));
const skuSchema = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,10}-[A-Z0-9]{1,20}(?:-[A-Z0-9]{2,12}){2,5}$/, {
        message: 'SKU must match a format like GTR-001-SUNBST-RH',
    });

export const productVariantSchema = z.object({
    variantId: z.string().optional(),
    configuration: z.string().trim().min(1).max(100),
    finish: z.string().trim().min(1).max(100),
    stock: z.number().int().nonnegative().default(0),
    sku: skuSchema,
    price: z.number().nonnegative().optional(),
    images: z.array(imagePathSchema).optional().default([]),
});

export const createProductVariantSchema = productVariantSchema.omit({ variantId: true });

export const updateProductVariantSchema = createProductVariantSchema
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
        message: 'At least one variant field is required',
    });

const productBaseSchema = z.object({
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1),
    basePrice: z.number().positive().optional(),
    price: z.number().positive().optional(),
    originalPrice: z.number().positive().optional(),
    onSale: z.boolean().optional(),
    image: imagePathSchema,
    images: z.array(imagePathSchema).optional().default([]),
    description: z.string().trim().min(1),
    brand: z.string().trim().min(1),
    condition: z.enum(['New', 'Used - Like New', 'Used - Good', 'Used - Fair']).optional(),
    skillLevel: z.enum(['Beginner', 'Intermediate', 'Professional']).optional(),
    inStock: z.boolean().optional(),
    stockCount: z.number().int().nonnegative().optional(),
    variants: z.array(productVariantSchema).optional().default([]),
    specifications: z.array(z.object({
        label: z.string().trim().min(1),
        value: z.string().trim().min(1),
    })).optional().default([]),
});

const withPriceInvariant = <T extends z.ZodTypeAny>(schema: T) =>
    schema.superRefine((data, ctx) => {
        const product = data as { basePrice?: number; price?: number; variants?: Array<{ sku: string }> };

        if (product.basePrice === undefined && product.price === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['basePrice'],
                message: 'Either basePrice or price is required',
            });
        }

        const skus = product.variants?.map((variant) => variant.sku) ?? [];
        const duplicateSku = skus.find((sku, index) => skus.indexOf(sku) !== index);
        if (duplicateSku) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['variants'],
                message: `Duplicate variant SKU: ${duplicateSku}`,
            });
        }
    });

export const createProductSchema = withPriceInvariant(productBaseSchema);

export const updateProductSchema = productBaseSchema
    .partial()
    .superRefine((data, ctx) => {
        const skus = data.variants?.map((variant) => variant.sku) ?? [];
        const duplicateSku = skus.find((sku, index) => skus.indexOf(sku) !== index);
        if (duplicateSku) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['variants'],
                message: `Duplicate variant SKU: ${duplicateSku}`,
            });
        }
    });

export type ProductVariantInput = z.infer<typeof productVariantSchema>;
export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>;
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
