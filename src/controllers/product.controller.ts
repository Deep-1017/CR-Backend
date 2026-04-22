import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/product.model';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';
import { getTotalStock, isVariantAvailable } from '../utils/productHelpers';

type VariantUpdate = {
    configuration?: string;
    finish?: string;
    stock?: number;
    sku?: string;
    price?: number;
    images?: string[];
};

const assertObjectId = (id: string, resourceName: string): void => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError(`Invalid ${resourceName} id`, 400);
    }
};

const findVariantSkuConflict = async (
    sku: string,
    currentProductId?: string,
    currentVariantId?: string
) => {
    const normalizedSku = sku.toUpperCase();
    const productWithSku = await Product.findOne({ 'variants.sku': normalizedSku }).select('variants');
    if (!productWithSku) {
        return null;
    }

    const conflictingVariant = productWithSku.variants.find((variant) =>
        variant.sku.toUpperCase() === normalizedSku &&
        !(
            currentProductId &&
            currentVariantId &&
            productWithSku.id === currentProductId &&
            variant.variantId.toString() === currentVariantId
        )
    );

    return conflictingVariant ? productWithSku : null;
};

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const [products, total] = await Promise.all([
        Product.find({}).skip((page - 1) * limit).limit(limit),
        Product.countDocuments({}),
    ]);
    res.json({ products, total, page, pages: Math.ceil(total / limit) });
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError('Product not found', 404);
    res.json(product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.create(req.body);
    res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError('Product not found', 404);

    product.set(req.body);
    await product.save();

    res.json(product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw new AppError('Product not found', 404);
    res.json({ message: 'Product removed' });
});

export const getProductVariants = asyncHandler(async (req: Request, res: Response) => {
    assertObjectId(req.params.productId, 'product');

    const product = await Product.findById(req.params.productId);
    if (!product) throw new AppError('Product not found', 404);

    res.json({
        variants: product.variants.map((variant) => ({
            variantId: variant.variantId,
            sku: variant.sku,
            configuration: variant.configuration,
            finish: variant.finish,
            stock: variant.stock,
            price: variant.price,
            images: variant.images ?? [],
            inStock: isVariantAvailable(variant),
        })),
        totalStock: getTotalStock(product),
        availableConfigurations: product.availableConfigurations,
        availableFinishes: product.availableFinishes,
    });
});

export const addProductVariant = asyncHandler(async (req: Request, res: Response) => {
    assertObjectId(req.params.productId, 'product');

    const product = await Product.findById(req.params.productId);
    if (!product) throw new AppError('Product not found', 404);

    const skuConflict = await findVariantSkuConflict(req.body.sku);
    if (skuConflict) {
        throw new AppError('Variant SKU already exists', 400);
    }

    product.variants.push({
        variantId: new mongoose.Types.ObjectId(),
        configuration: req.body.configuration,
        finish: req.body.finish,
        stock: req.body.stock,
        sku: req.body.sku,
        price: req.body.price,
        images: req.body.images ?? [],
    });

    await product.save();
    res.status(201).json(product);
});

export const updateProductVariant = asyncHandler(async (req: Request, res: Response) => {
    assertObjectId(req.params.productId, 'product');
    assertObjectId(req.params.variantId, 'variant');

    const product = await Product.findById(req.params.productId);
    if (!product) throw new AppError('Product not found', 404);

    const variant = product.variants.find(
        (item) => item.variantId.toString() === req.params.variantId
    );
    if (!variant) throw new AppError('Variant not found', 404);

    if (req.body.sku) {
        const skuConflict = await findVariantSkuConflict(
            req.body.sku,
            product.id,
            req.params.variantId
        );
        if (skuConflict) {
            throw new AppError('Variant SKU already exists', 409);
        }
    }

    const updates = req.body as VariantUpdate;
    if (updates.configuration !== undefined) variant.configuration = updates.configuration;
    if (updates.finish !== undefined) variant.finish = updates.finish;
    if (updates.stock !== undefined) variant.stock = updates.stock;
    if (updates.sku !== undefined) variant.sku = updates.sku;
    if (updates.price !== undefined) variant.price = updates.price;
    if (updates.images !== undefined) variant.images = updates.images;

    await product.save();
    res.json(product);
});

export const deleteProductVariant = asyncHandler(async (req: Request, res: Response) => {
    assertObjectId(req.params.productId, 'product');
    assertObjectId(req.params.variantId, 'variant');

    const product = await Product.findById(req.params.productId);
    if (!product) throw new AppError('Product not found', 404);

    const variantIndex = product.variants.findIndex(
        (item) => item.variantId.toString() === req.params.variantId
    );
    if (variantIndex === -1) throw new AppError('Variant not found', 404);

    product.variants.splice(variantIndex, 1);

    await product.save();
    res.json(product);
});
