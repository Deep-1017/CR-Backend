import type { IOrder } from '../models/order.model';
import type { EmailSendResult } from './email.service';
import { sendOrderConfirmationEmail as sendOrderConfirmationEmailWithUser } from './emailService';

export const sendOrderConfirmationEmail = async (order: IOrder): Promise<EmailSendResult> => {
    return sendOrderConfirmationEmailWithUser(
        { email: order.customer.email, name: `${order.customer.firstName} ${order.customer.lastName}`.trim() },
        order
    );
};
