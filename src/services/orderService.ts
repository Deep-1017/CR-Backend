import mongoose, { ClientSession } from 'mongoose';
import Product, { IProduct } from '../models/product.model';
import AppError from '../utils/appError';
import logger from '../utils/logger';

export type CartItemInput = {
    productId: string;
    variantId: string;
    configuration: string;
    finish: string;
    quantity: number;
};

export type PreparedOrderItem = {
    productId: mongoose.Types.ObjectId;
    variantId: mongoose.Types.ObjectId;
    name: string;
    configuration: string;
    finish: string;
    quantity: number;
    priceAtPurchase: number;
    price: number;
    sku: string;
    image: string;
};

const assertObjectId = (id: string, label: string): void => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError(`Invalid ${label}: ${id}`, 400);
    }
};

const buildStockMessage = (
    product: Pick<IProduct, 'name'>,
    finish: string,
    configuration: string,
    stock: number
): string =>
    `Only ${stock} unit${stock === 1 ? '' : 's'} of ${product.name} - ${finish} - ${configuration} left in stock`;

export const reduceVariantStock = async (
    productId: string,
    variantId: string,
    quantity: number,
    session?: ClientSession
): Promise<IProduct> => {
    assertObjectId(productId, 'productId');
    assertObjectId(variantId, 'variantId');

    const updatedProduct = await Product.findOneAndUpdate(
        {
            _id: productId,
            variants: {
                $elemMatch: {
                    variantId: new mongoose.Types.ObjectId(variantId),
                    stock: { $gte: quantity },
                },
            },
        },
        { $inc: { 'variants.$.stock': -quantity } },
        { new: true, runValidators: true, ...(session ? { session } : {}) }
    );

    if (updatedProduct) {
        await updatedProduct.save(session ? { session } : undefined);
        return updatedProduct;
    }

    const product = session
        ? await Product.findById(productId).session(session)
        : await Product.findById(productId);
    if (!product) {
        throw new AppError('Product not found', 404);
    }

    const variant = product.variants.find((item) => item.variantId.toString() === variantId);
    if (!variant) {
        throw new AppError('Variant not found', 404);
    }

    throw new AppError(
        buildStockMessage(product, variant.finish, variant.configuration, variant.stock),
        400
    );
};

export const processOrderItems = async (
    cartItems: CartItemInput[],
    session?: ClientSession
): Promise<PreparedOrderItem[]> => {
    const preparedItems: PreparedOrderItem[] = [];

    for (const item of cartItems) {
        const product = await reduceVariantStock(
            item.productId,
            item.variantId,
            item.quantity,
            session
        );

        const variant = product.variants.find(
            (productVariant) => productVariant.variantId.toString() === item.variantId
        );

        if (!variant) {
            throw new AppError('Variant not found after stock update', 500);
        }

        if (
            variant.configuration.toLowerCase() !== item.configuration.toLowerCase() ||
            variant.finish.toLowerCase() !== item.finish.toLowerCase()
        ) {
            throw new AppError(
                `Variant selection mismatch for ${product.name}. Please refresh your cart and try again.`,
                400
            );
        }

        const priceAtPurchase = variant.price ?? product.basePrice ?? product.price;

        preparedItems.push({
            productId: product._id,
            variantId: variant.variantId,
            name: product.name,
            configuration: variant.configuration,
            finish: variant.finish,
            quantity: item.quantity,
            priceAtPurchase,
            price: priceAtPurchase,
            sku: variant.sku,
            image: variant.images?.[0] ?? product.image,
        });
    }

    return preparedItems;
};

export const handleStockErrors = async <T>(
    session: ClientSession,
    operation: (activeSession?: ClientSession) => Promise<T>
): Promise<T> => {
    try {
        return await session.withTransaction(() => operation(session));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const transactionsUnsupported =
            message.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
            message.includes('Transaction support is not available');

        if (transactionsUnsupported) {
            logger.warn('MongoDB transactions unavailable; falling back to non-transactional order processing.');
            return operation(undefined);
        }

        throw error;
    }
};
