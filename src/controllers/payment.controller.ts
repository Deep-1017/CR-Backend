import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import razorpay from '../config/razorpay';
import env from '../config/env';
import Order from '../models/order.model';
import Product from '../models/product.model';
import Cart from '../models/cart.model';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';
import logger from '../utils/logger';
import { CreatePaymentOrderInput, VerifyPaymentWebhookInput } from '../validation/paymentValidation';

const buildRazorpayReceipt = (): string => {
    // Razorpay receipts must stay within 40 characters.
    return `rcpt_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
};

export const createRazorpayOrder = asyncHandler(async (req: Request, res: Response) => {
    const authUser = req.user as { id?: string; name?: string; email?: string } | undefined;
    const { customer, cartItems, pricing, currency } = req.body as CreatePaymentOrderInput;

    const invalidProductIds = cartItems
        .map((item) => item.productId)
        .filter((id) => !mongoose.Types.ObjectId.isValid(id));

    if (invalidProductIds.length > 0) {
        throw new AppError(`Invalid product IDs: ${invalidProductIds.join(', ')}`, 400);
    }

    const products = await Product.find({ _id: { $in: cartItems.map((item) => item.productId) } });
    const foundProductIds = products.map((product) => product._id.toString());
    const missingProductIds = cartItems
        .filter((item) => !foundProductIds.includes(item.productId))
        .map((item) => item.productId);

    if (missingProductIds.length > 0) {
        throw new AppError(`Products not found: ${missingProductIds.join(', ')}`, 400);
    }

    const productMap = new Map(products.map((product) => [product._id.toString(), product]));

    const items = cartItems.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
            throw new AppError(`Product ${item.productId} not found`, 400);
        }

        if (product.price !== item.price) {
            throw new AppError(`Price mismatch for product ${item.productId}`, 400);
        }

        return {
            productId: item.productId,
            name: product.name,
            price: item.price,
            quantity: item.quantity,
            image: product.image,
        };
    });

    const computedSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const computedTax = Number(pricing.tax.toFixed(2));
    const computedShipping = Number(pricing.shipping.toFixed(2));
    const computedTotal = Number((computedSubtotal + computedTax + computedShipping).toFixed(2));

    if (Number(pricing.subtotal.toFixed(2)) !== Number(computedSubtotal.toFixed(2))) {
        throw new AppError('Subtotal amount mismatch', 400);
    }

    if (Number(pricing.total.toFixed(2)) !== computedTotal) {
        throw new AppError('Total amount mismatch', 400);
    }

    let razorpayOrder: any;
    try {
        razorpayOrder = await razorpay.orders.create({
            amount: Math.round(computedTotal * 100),
            currency,
            receipt: buildRazorpayReceipt(),
            payment_capture: true,
        });
    } catch (error) {
        const razorpayError = error as {
            message?: string;
            error?: {
                code?: string;
                description?: string;
                field?: string;
                source?: string;
                step?: string;
                reason?: string;
            };
            statusCode?: number;
        };

        logger.error('Razorpay order creation failed', {
            error: error instanceof Error ? error.message : error,
            razorpayError: razorpayError.error,
            statusCode: razorpayError.statusCode,
            cartItems,
            pricing,
            currency,
            userId: authUser?.id,
        });
        throw new AppError('Failed to create Razorpay order', 500);
    }

    const order = await Order.create({
        userId: authUser?.id,
        customer: {
            ...customer,
            email: authUser?.email ?? customer.email,
        },
        items,
        totalAmount: computedTotal,
        paymentId: razorpayOrder.id,
        paymentStatus: 'pending',
        paymentMethod: 'razorpay',
        amountPaid: 0,
        paymentDetails: {
            provider: 'razorpay',
            paymentIntentId: razorpayOrder.id,
            razorpayOrderId: razorpayOrder.id,
            status: 'pending',
        },
        status: 'Pending',
    });

    res.status(201).json({
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency,
        key: env.RAZORPAY_KEY_ID,
    });
});

export const verifyRazorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
    const requestId = (req as Request & { id?: string }).id ?? 'unknown';
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as VerifyPaymentWebhookInput;

    const generatedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_SECRET ?? '')
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (generatedSignature !== razorpay_signature) {
        logger.warn('Razorpay webhook signature mismatch', {
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            requestId,
        });
        throw new AppError('Invalid webhook signature', 403);
    }

    const order = await Order.findOne({
        $or: [{ paymentId: razorpay_order_id }, { 'paymentDetails.razorpayOrderId': razorpay_order_id }],
    });

    if (!order) {
        logger.warn('Razorpay webhook order not found', {
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            requestId,
        });
        throw new AppError('Order not found', 404);
    }

    const previousOrderState = {
        paymentStatus: order.paymentStatus,
        transactionId: order.transactionId,
        paymentId: order.paymentId,
        status: order.status,
        paymentDetails: order.paymentDetails,
        amountPaid: order.amountPaid,
    };

    try {
        order.paymentStatus = 'success';
        order.transactionId = razorpay_payment_id;
        order.paymentId = razorpay_order_id;
        order.status = 'Confirmed';
        order.paymentDetails = {
            ...order.paymentDetails,
            provider: 'razorpay',
            paymentIntentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            status: 'paid',
        };
        order.amountPaid = order.totalAmount;

        await order.save();

        if (order.userId) {
            await Cart.findOneAndUpdate(
                { userId: order.userId },
                { $set: { items: [] } }
            );
        }

        logger.info('Razorpay webhook verified and order updated', {
            orderId: order.id,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            userId: order.userId,
            requestId,
        });

        res.status(200).json({ message: 'Payment verified and order confirmed' });
    } catch (error) {
        await Order.updateOne(
            { _id: order._id },
            {
                $set: {
                    paymentStatus: previousOrderState.paymentStatus,
                    transactionId: previousOrderState.transactionId,
                    paymentId: previousOrderState.paymentId,
                    status: previousOrderState.status,
                    paymentDetails: previousOrderState.paymentDetails,
                    amountPaid: previousOrderState.amountPaid,
                },
            }
        );
        logger.error('Razorpay webhook database update failed', {
            error: error instanceof Error ? error.message : error,
            orderId: order.id,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            requestId,
        });
        throw new AppError('Failed to verify payment webhook', 500);
    }
});
