import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import razorpay from '../config/razorpay';
import env from '../config/env';
import Order from '../models/order.model';
import Cart from '../models/cart.model';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';
import logger from '../utils/logger';
import { CreatePaymentOrderInput, VerifyPaymentWebhookInput } from '../validation/paymentValidation';
import { handleStockErrors, processOrderItems } from '../services/orderService';
import { isEmailConfigured, logEmailConfigurationWarning } from '../services/email.service';
import { sendOrderConfirmationEmail } from '../services/orderEmail.service';

const buildRazorpayReceipt = (): string => {
    // Razorpay receipts must stay within 40 characters.
    return `rcpt_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
};

const deliverOrderConfirmationEmail = async (order: InstanceType<typeof Order>): Promise<void> => {
    if (!isEmailConfigured()) {
        order.confirmationEmailError = 'Email delivery is not configured on the server.';
        order.confirmationEmailSentAt = undefined;
        await order.save();
        logEmailConfigurationWarning();
        return;
    }

    try {
        await sendOrderConfirmationEmail(order);
        order.confirmationEmailSentAt = new Date();
        order.confirmationEmailError = undefined;
        await order.save();
    } catch (error) {
        order.confirmationEmailSentAt = undefined;
        order.confirmationEmailError = error instanceof Error ? error.message : 'Email delivery failed.';
        await order.save();
        logger.error('Order confirmation email failed', {
            error: error instanceof Error ? error.message : error,
            orderId: order.id,
            email: order.customer.email,
        });
    }
};

export const createRazorpayOrder = asyncHandler(async (req: Request, res: Response) => {
    const authUser = req.user as { id?: string; name?: string; email?: string } | undefined;
    const { customer, cartItems, pricing, currency } = req.body as CreatePaymentOrderInput;
    const session = await mongoose.startSession();

    try {
        const paymentOrder = await handleStockErrors(session, async (activeSession) => {
            const items = await processOrderItems(cartItems, activeSession);
            const computedSubtotal = items.reduce(
                (sum, item) => sum + item.priceAtPurchase * item.quantity,
                0
            );
            const computedTax = Number(pricing.tax.toFixed(2));
            const computedShipping = Number(pricing.shipping.toFixed(2));
            const computedTotal = Number((computedSubtotal + computedTax + computedShipping).toFixed(2));

            if (Number(pricing.subtotal.toFixed(2)) !== Number(computedSubtotal.toFixed(2))) {
                throw new AppError('Subtotal amount mismatch', 400);
            }

            if (Number(pricing.total.toFixed(2)) !== computedTotal) {
                throw new AppError('Total amount mismatch', 400);
            }

            const razorpayOrder = await razorpay.orders.create({
                amount: Math.round(computedTotal * 100),
                currency,
                receipt: buildRazorpayReceipt(),
            });

            const [order] = await Order.create([{
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
            }], activeSession ? { session: activeSession } : undefined);

            return {
                orderId: order.id,
                razorpayOrderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency,
                key: env.RAZORPAY_KEY_ID,
            };
        });

        res.status(201).json(paymentOrder);
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

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
        const providerMessage =
            razorpayError.error?.description ||
            razorpayError.error?.reason ||
            razorpayError.message;
        const publicMessage =
            env.NODE_ENV === 'development' && providerMessage
                ? `Failed to create Razorpay order: ${providerMessage}`
                : 'Failed to create Razorpay order';

        logger.error('Razorpay order creation failed', {
            error: error instanceof Error ? error.message : error,
            razorpayError: razorpayError.error,
            statusCode: razorpayError.statusCode,
            cartItems,
            pricing,
            currency,
            userId: authUser?.id,
        });
        throw new AppError(publicMessage, 500);
    } finally {
        await session.endSession();
    }
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

        await deliverOrderConfirmationEmail(order);

        res.status(200).json({ 
            message: 'Payment verified and order confirmed',
            orderId: order.id 
        });
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

export const resendOrderConfirmationEmail = asyncHandler(async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
        throw new AppError('Order not found', 404);
    }

    const user = req.user as { role?: string; email?: string } | undefined;
    if (user?.role !== 'admin' && order.customer.email !== user?.email) {
        throw new AppError('Not authorised to resend this confirmation email', 403);
    }

    if (order.paymentStatus !== 'success') {
        throw new AppError('Confirmation email can only be resent for paid orders', 400);
    }

    await deliverOrderConfirmationEmail(order);

    if (!order.confirmationEmailSentAt) {
        res.status(503).json({
            message: order.confirmationEmailError ?? 'Unable to send confirmation email right now.',
        });
        return;
    }

    res.status(200).json({
        message: `Confirmation email sent to ${order.customer.email}.`,
        confirmationEmailSentAt: order.confirmationEmailSentAt,
    });
});
