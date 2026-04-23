import type { IOrder } from '../models/order.model';
import env from '../config/env';
import { sendEmail } from './email.service';

const formatCurrency = (value: number): string =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(value);

const buildOrderConfirmationHtml = (order: IOrder): string => {
    const customerName = `${order.customer.firstName} ${order.customer.lastName}`.trim();
    const itemRows = order.items
        .map(
            (item) => `
                <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #e7e5e4;">${item.name}<br /><span style="color:#78716c;font-size:12px;">${item.finish} / ${item.configuration}</span></td>
                    <td style="padding:12px 0;border-bottom:1px solid #e7e5e4;text-align:center;">${item.quantity}</td>
                    <td style="padding:12px 0;border-bottom:1px solid #e7e5e4;text-align:right;">${formatCurrency(item.priceAtPurchase * item.quantity)}</td>
                </tr>
            `
        )
        .join('');
    const orderUrl = env.FRONTEND_URL
        ? `${env.FRONTEND_URL}/order-confirmation/${order.id}`
        : `Order ID: ${order.id}`;

    return `
        <div style="font-family:Arial,sans-serif;background:#f8f7f2;padding:32px;color:#1c1917;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #e7e5e4;">
                <p style="margin:0 0 8px;color:#059669;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;">CR Music</p>
                <h1 style="margin:0 0 12px;font-size:32px;line-height:1.15;">Order Confirmed</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#57534e;">
                    Hi ${customerName || 'there'}, your payment was successful and we're processing your order now.
                </p>

                <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:16px;padding:16px 18px;margin-bottom:24px;">
                    <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#047857;">Order ID</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#064e3b;">${order.id}</p>
                </div>

                <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                    <thead>
                        <tr>
                            <th style="text-align:left;padding-bottom:10px;color:#78716c;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;">Item</th>
                            <th style="text-align:center;padding-bottom:10px;color:#78716c;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;">Qty</th>
                            <th style="text-align:right;padding-bottom:10px;color:#78716c;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${itemRows}</tbody>
                </table>

                <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e7e5e4;padding-top:18px;margin-bottom:24px;">
                    <span style="font-size:16px;color:#44403c;">Amount paid</span>
                    <strong style="font-size:24px;color:#047857;">${formatCurrency(order.amountPaid || order.totalAmount)}</strong>
                </div>

                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#57534e;">
                    We'll email you again when your order ships. You can also review this order anytime from your account.
                </p>

                <a href="${orderUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;">
                    View Order
                </a>
            </div>
        </div>
    `;
};

const buildOrderConfirmationText = (order: IOrder): string => {
    const lines = [
        `CR Music order confirmed`,
        ``,
        `Order ID: ${order.id}`,
        `Amount paid: ${formatCurrency(order.amountPaid || order.totalAmount)}`,
        ``,
        `Items:`,
        ...order.items.map((item) => `- ${item.name} (${item.finish} / ${item.configuration}) x${item.quantity}`),
        ``,
        `View order: ${env.FRONTEND_URL ? `${env.FRONTEND_URL}/order-confirmation/${order.id}` : order.id}`,
    ];

    return lines.join('\n');
};

export const sendOrderConfirmationEmail = async (order: IOrder): Promise<void> => {
    await sendEmail({
        to: order.customer.email,
        subject: `Your CR Music order ${order.id} is confirmed`,
        html: buildOrderConfirmationHtml(order),
        text: buildOrderConfirmationText(order),
    });
};
