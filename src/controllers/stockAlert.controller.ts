import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/product.model';
import StockAlert from '../models/stockAlert.model';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';
import { sendStockAlertConfirmationEmail } from '../services/emailService';
import logger from '../utils/logger';

export const createStockAlert = asyncHandler(async (req: Request, res: Response) => {
    const { productId, variantKey, email } = req.body as {
        productId: string;
        variantKey: string;
        email: string;
    };
    const authUser = req.user as { id?: string } | undefined;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new AppError('Invalid product id', 400);
    }

    const product = await Product.findById(productId).select('name image variants');
    if (!product) {
        throw new AppError('Product not found', 404);
    }

    const variant = product.variants.find(
        (item) => item.variantId.toString() === variantKey || item.sku === variantKey
    );

    if (!variant) {
        throw new AppError('Variant not found', 404);
    }

    const normalizedVariantKey = variant.variantId.toString();
    const normalizedEmail = email.trim().toLowerCase();
    const sendConfirmation = async (alertId?: string) => {
        const confirmationResult = await sendStockAlertConfirmationEmail({
            to: normalizedEmail,
            productId: product.id,
            productName: product.name,
            productImage: product.image,
            variantLabel: [variant.configuration, variant.finish].filter(Boolean).join(' / '),
        });

        if (!confirmationResult.ok) {
            logger.warn('Stock alert confirmation email was not sent', {
                alertId,
                productId: product.id,
                variantKey: normalizedVariantKey,
                email: normalizedEmail,
                error: confirmationResult.error,
            });
        }

        return confirmationResult;
    };

    const existingAlert = await StockAlert.findOne({
        email: normalizedEmail,
        product: product._id,
        variantKey: normalizedVariantKey,
    });

    if (existingAlert) {
        const confirmationResult = await sendConfirmation(existingAlert.id);

        res.status(200).json({
            success: true,
            message: confirmationResult.ok
                ? "You're already on the list, and we've sent you a confirmation email."
                : 'You are already on the back-in-stock list for this variant.',
            alert: existingAlert,
            emailSent: confirmationResult.ok,
        });
        return;
    }

    const alert = await StockAlert.create({
        user: authUser?.id ? new mongoose.Types.ObjectId(authUser.id) : null,
        email: normalizedEmail,
        product: product._id,
        variantKey: normalizedVariantKey,
    });

    const confirmationResult = await sendConfirmation(alert.id);

    res.status(201).json({
        success: true,
        message: confirmationResult.ok
            ? "You'll be notified when this variant is back in stock. We've sent you a confirmation email."
            : "You'll be notified when this variant is back in stock.",
        alert,
        emailSent: confirmationResult.ok,
    });
});
