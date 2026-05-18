import type { IProduct } from '../models/product.model';
import StockAlert from '../models/stockAlert.model';
import { sendBackInStockEmail } from './emailService';
import logger from '../utils/logger';

export const notifyBackInStockAlerts = async (
    product: IProduct,
    variantKey: string
): Promise<void> => {
    const alerts = await StockAlert.find({
        product: product._id,
        variantKey,
        notified: false,
    });

    if (alerts.length === 0) {
        return;
    }

    await Promise.all(
        alerts.map(async (alert) => {
            const result = await sendBackInStockEmail({
                to: alert.email,
                productId: product.id,
                productName: product.name,
                productImage: product.image,
            });

            if (!result.ok) {
                logger.warn('Back-in-stock email was not sent', {
                    alertId: alert.id,
                    productId: product.id,
                    variantKey,
                    error: result.error,
                });
                return;
            }

            alert.notified = true;
            await alert.save();
        })
    );
};
