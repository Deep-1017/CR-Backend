import mongoose, { Schema, Document } from 'mongoose';
import { z } from 'zod';

export interface IOrder extends Document {
    userId?: string;
    customer: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        address?: string;
        city?: string;
        state?: string;
        zipCode?: string;
    };
    items: {
        productId: string;
        variantId: string;
        name: string;
        configuration: string;
        finish: string;
        quantity: number;
        priceAtPurchase: number;
        price: number;
        sku: string;
        image: string;
    }[];
    totalAmount: number;
    paymentId?: string;
    paymentStatus: 'pending' | 'success' | 'failed';
    transactionId?: string;
    paymentMethod: 'razorpay' | 'upi' | 'card';
    amountPaid: number;
    paymentDetails: {
        provider: string;
        paymentIntentId?: string;
        razorpayOrderId?: string;
        status: 'pending' | 'paid' | 'failed' | 'refunded';
    };
    status: 'Pending' | 'Processing' | 'Confirmed' | 'Shipped' | 'Completed' | 'Cancelled';
    confirmationEmailSentAt?: Date;
    confirmationEmailError?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export const orderValidationSchema = z.object({
    userId: z.string().optional(),
    customer: z.object({
        firstName: z.string().min(1, 'First name is required'),
        lastName: z.string().min(1, 'Last name is required'),
        email: z.string().email('Valid email is required'),
        phone: z.string().optional(),
        address: z.string().min(1, 'Address is required'),
        city: z.string().min(1, 'City is required'),
        state: z.string().optional(),
        zipCode: z.string().min(1, 'Zip code is required'),
    }),
    items: z.array(z.object({
        productId: z.string().min(1, 'Product ID is required'),
        variantId: z.string().min(1, 'Variant ID is required'),
        name: z.string().min(1, 'Product name is required'),
        configuration: z.string().min(1, 'Configuration is required'),
        finish: z.string().min(1, 'Finish is required'),
        quantity: z.number().int().positive('Quantity must be a positive integer'),
        priceAtPurchase: z.number().nonnegative('Price at purchase must be a positive number'),
        price: z.number().nonnegative('Price must be a positive number'),
        sku: z.string().min(1, 'SKU is required'),
        image: z.string().min(1, 'Product image is required'),
    })).min(1, 'At least one item is required'),
    totalAmount: z.number().nonnegative('Total amount must be a non-negative number'),
    paymentId: z.string().optional(),
    paymentStatus: z.enum(['pending', 'success', 'failed']).default('pending'),
    transactionId: z.string().optional(),
    paymentMethod: z.enum(['razorpay', 'upi', 'card']),
    amountPaid: z.number().nonnegative('Amount paid must be zero or more').default(0),
    paymentDetails: z.object({
        provider: z.string().min(1, 'Payment provider is required'),
        paymentIntentId: z.string().optional(),
        status: z.enum(['pending', 'paid', 'failed', 'refunded']).default('pending'),
    }),
    status: z.enum(['Pending', 'Processing', 'Confirmed', 'Shipped', 'Completed', 'Cancelled']).default('Pending'),
    confirmationEmailSentAt: z.date().optional(),
    confirmationEmailError: z.string().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export type OrderValidationInput = z.infer<typeof orderValidationSchema>;

const OrderSchema: Schema = new Schema({
    userId: { type: String, index: true },
    customer: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String },
        address: { type: String },
        city: { type: String },
        state: { type: String },
        zipCode: { type: String }
    },
    items: [{
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        variantId: { type: Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        configuration: { type: String, required: true },
        finish: { type: String, required: true },
        quantity: { type: Number, required: true },
        priceAtPurchase: { type: Number, required: true },
        price: { type: Number, required: true },
        sku: { type: String, required: true },
        image: { type: String, required: true }
    }],
    totalAmount: { type: Number, required: true },
    paymentId: { type: String },
    paymentStatus: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending',
    },
    paymentMethod: {
        type: String,
        enum: ['razorpay', 'upi', 'card'],
        default: 'razorpay',
    },
    amountPaid: { type: Number, default: 0 },
    transactionId: { type: String },
    paymentDetails: {
        provider: { type: String, required: true },   // e.g. 'stripe', 'razorpay'
        paymentIntentId: { type: String },                    // provider-issued reference ID
        razorpayOrderId: { type: String },
        status: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending'
        }
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Confirmed', 'Shipped', 'Completed', 'Cancelled'],
        default: 'Pending'
    },
    confirmationEmailSentAt: { type: Date },
    confirmationEmailError: { type: String }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true, // exposes the virtual 'id' field (string version of _id)
        transform: (_doc, ret) => {
            const obj = ret as any;
            obj.id = obj._id?.toString();
            delete obj._id;
            delete obj.__v;
            return ret;
        }
    }
});

export default mongoose.model<IOrder>('Order', OrderSchema);
