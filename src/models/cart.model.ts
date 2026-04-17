import mongoose, { Document, Schema } from 'mongoose';

export interface ICartItem {
    productId: string;
    quantity: number;
    price: number;
}

export interface ICart extends Document {
    userId: string;
    items: ICartItem[];
}

const CartSchema = new Schema<ICart>(
    {
        userId: { type: String, required: true, unique: true, index: true },
        items: [
            {
                productId: { type: String, required: true },
                quantity: { type: Number, required: true, min: 1 },
                price: { type: Number, required: true, min: 0 },
            },
        ],
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<ICart>('Cart', CartSchema);
