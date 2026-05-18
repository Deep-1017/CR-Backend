import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStockAlert extends Document {
    user: mongoose.Types.ObjectId | null;
    email: string;
    product: mongoose.Types.ObjectId;
    variantKey: string;
    notified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const StockAlertSchema = new Schema<IStockAlert>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        variantKey: {
            type: String,
            required: true,
            trim: true,
        },
        notified: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

StockAlertSchema.index(
    { email: 1, product: 1, variantKey: 1 },
    { unique: true }
);
StockAlertSchema.index({ product: 1, variantKey: 1, notified: 1 });

const StockAlert: Model<IStockAlert> = mongoose.model<IStockAlert>(
    'StockAlert',
    StockAlertSchema
);

export default StockAlert;
