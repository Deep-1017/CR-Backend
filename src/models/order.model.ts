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
        name: string;
        price: number;
        quantity: number;
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
    status: 'Pending' | 'Processing' | 'Confirmed' | 'Completed' | 'Cancelled';
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
        name: z.string().min(1, 'Product name is required'),
        price: z.number().nonnegative('Price must be a positive number'),
        quantity: z.number().int().positive('Quantity must be a positive integer'),
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
    status: z.enum(['Pending', 'Processing', 'Confirmed', 'Completed', 'Cancelled']).default('Pending'),
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
        productId: { type: String, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
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
        enum: ['Pending', 'Processing', 'Confirmed', 'Completed', 'Cancelled'],
        default: 'Pending'
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true, // exposes the virtual 'id' field (string version of _id)
        transform: (_doc, ret) => {
            const obj = ret as any;
            delete obj._id;
            delete obj.__v;
            return ret;
        }
    }
});

export default mongoose.model<IOrder>('Order', OrderSchema);
