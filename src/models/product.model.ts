import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
    name: string;
    category: string;
    price: number;
    originalPrice?: number;
    onSale?: boolean;
    image: string;
    images: string[];
    description: string;
    rating: number;
    reviews: number;
    brand: string;
    condition: string;
    skillLevel: string;
    inStock: boolean;
    stockCount: number;
    specifications: { label: string; value: string }[];
    customerReviews: {
        id: string;
        author: string;
        rating: number;
        date: string;
        comment: string;
    }[];
}

const ProductSchema: Schema = new Schema({
    name: { type: String, required: true },
    category: {
        type: String,
        required: true,
        enum: [
            'Guitars',
            'Bass',
            'Drums & Percussion',
            'Keyboards & Pianos',
            'Wind Instruments',
            'String Instruments',
            'DJ & Electronics',
            'Studio & Recording',
            'Accessories'
        ]
    },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    onSale: { type: Boolean, default: false },
    image: { type: String, required: true },
    images: [{ type: String }],
    description: { type: String, required: true },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    brand: { type: String, required: true },
    condition: {
        type: String,
        required: true,
        enum: ['New', 'Used - Like New', 'Used - Good', 'Used - Fair'],
        default: 'New'
    },
    skillLevel: {
        type: String,
        required: true,
        enum: ['Beginner', 'Intermediate', 'Professional'],
        default: 'Beginner'
    },
    inStock: { type: Boolean, default: true },
    stockCount: { type: Number, default: 0 },
    specifications: [{
        label: { type: String, required: true },
        value: { type: String, required: true }
    }],
    customerReviews: [{
        id: { type: String, required: true },
        author: { type: String, required: true },
        rating: { type: Number, required: true },
        date: { type: String, required: true },
        comment: { type: String, required: true }
    }]
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,     // exposes the virtual 'id' field (string version of _id)
        transform: (_doc, ret) => {
            const obj = ret as any;
            delete obj._id;
            delete obj.__v;
            return ret;
        }
    }
});

export default mongoose.model<IProduct>('Product', ProductSchema);
