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

// ─── Transaction support detection ────────────────────────────────────────────
// Cached after first probe so we never attempt (and fail) a transaction on a
// standalone MongoDB instance again. This removes ~200-500ms of wasted latency
// from every order/payment request.

let _transactionsSupported: boolean | null = null;

const probeTransactionSupport = async (): Promise<boolean> => {
    if (_transactionsSupported !== null) return _transactionsSupported;

    try {
        const admin = mongoose.connection.db?.admin();
        if (!admin) {
            _transactionsSupported = false;
            return false;
        }

        const info = await admin.command({ hello: 1 });

        // Transactions require a replica set (setName present) or a sharded
        // cluster (msg === 'isdbgrid').
        const isReplicaSet = typeof info.setName === 'string' && info.setName.length > 0;
        const isSharded = info.msg === 'isdbgrid';
        _transactionsSupported = isReplicaSet || isSharded;
    } catch {
        _transactionsSupported = false;
    }

    if (!_transactionsSupported) {
        logger.warn(
            'MongoDB transactions unavailable (standalone instance detected). ' +
            'Order processing will run without transactional guarantees.',
            { timestamp: new Date().toISOString() }
        );
    } else {
        logger.info('MongoDB transaction support confirmed (replica set / sharded cluster).');
    }

    return _transactionsSupported;
};

/**
 * Starts a MongoDB session only if the server supports transactions.
 * Returns `null` for standalone instances — callers should skip
 * session-related logic when the return value is null.
 */
export const maybeStartSession = async (): Promise<ClientSession | null> => {
    const supported = await probeTransactionSupport();
    return supported ? await mongoose.startSession() : null;
};

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

export const restoreVariantStock = async (
    productId: string,
    variantId: string,
    quantity: number,
    session?: ClientSession
): Promise<void> => {
    assertObjectId(productId, 'productId');
    assertObjectId(variantId, 'variantId');

    await Product.findOneAndUpdate(
        {
            _id: productId,
            variants: { $elemMatch: { variantId: new mongoose.Types.ObjectId(variantId) } },
        },
        { $inc: { 'variants.$.stock': quantity } },
        { new: true, runValidators: true, ...(session ? { session } : {}) }
    );
};

export const restoreOrderStock = async (
    items: Array<{ productId: mongoose.Types.ObjectId | string; variantId: mongoose.Types.ObjectId | string; quantity: number }>,
    session?: ClientSession
): Promise<void> => {
    for (const item of items) {
        try {
            await restoreVariantStock(item.productId.toString(), item.variantId.toString(), item.quantity, session);
        } catch (err) {
            logger.error('Failed to restore variant stock', {
                productId: item.productId.toString(),
                variantId: item.variantId.toString(),
                quantity: item.quantity,
                error: err instanceof Error ? err.message : err,
            });
        }
    }
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

/**
 * Wraps an order-processing operation in a MongoDB transaction when available.
 * On standalone instances (no replica set), runs the operation directly without
 * a session — no failed transaction attempt, no wasted latency.
 */
export const handleStockErrors = async <T>(
    session: ClientSession | null,
    operation: (activeSession?: ClientSession) => Promise<T>
): Promise<T> => {
    // No session → standalone mode, run directly
    if (!session) {
        return operation(undefined);
    }

    try {
        return await session.withTransaction(() => operation(session));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const transactionsUnsupported =
            message.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
            message.includes('Transaction support is not available');

        if (transactionsUnsupported) {
            // Update the cache so future calls skip sessions entirely
            _transactionsSupported = false;
            logger.warn('MongoDB transactions unavailable; falling back to non-transactional order processing.');
            return operation(undefined);
        }

        throw error;
    }
};
