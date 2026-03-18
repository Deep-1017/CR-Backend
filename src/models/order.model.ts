import mongoose, { Schema, Document } from 'mongoose';

export interface IOrder extends Document {
    customer: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        address: string;
        city: string;
        state?: string;
        zipCode: string;
    };
    items: {
        productId: string;
        name: string;
        price: number;
        quantity: number;
        image: string;
    }[];
    totalAmount: number;
    paymentDetails: {
        provider: string;
        paymentIntentId?: string;
        status: 'pending' | 'paid' | 'failed' | 'refunded';
    };
    status: 'Pending' | 'Processing' | 'Completed' | 'Cancelled';
}

const OrderSchema: Schema = new Schema({
    customer: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String },
        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String },
        zipCode: { type: String, required: true }
    },
    items: [{
        productId: { type: String, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        image: { type: String, required: true }
    }],
    totalAmount: { type: Number, required: true },
    paymentDetails: {
        provider: { type: String, required: true },   // e.g. 'stripe', 'razorpay'
        paymentIntentId: { type: String },                    // provider-issued reference ID
        status: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending'
        }
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Completed', 'Cancelled'],
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
