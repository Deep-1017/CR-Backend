import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProductVariant {
    variantId: mongoose.Types.ObjectId;
    configuration: string;
    finish: string;
    stock: number;
    sku: string;
    price?: number;
    images?: string[];
}

export interface IProduct extends Document {
    name: string;
    category: string;
    basePrice: number;
    price: number;
    originalPrice?: number;
    onSale?: boolean;
    image: string;
    images: string[];
    description: string;
    rating: number;
    reviews: number;
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
    brand: string;
    condition: string;
    skillLevel: string;
    inStock: boolean;
    stockCount: number;
    variants: IProductVariant[];
    availableConfigurations: string[];
    availableFinishes: string[];
    specifications: { label: string; value: string }[];
    customerReviews: {
        id: string;
        author: string;
        rating: number;
        date: string;
        comment: string;
    }[];
}

const VariantSchema = new Schema<IProductVariant>({
    variantId: {
        type: Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId(),
        immutable: true,
    },
    configuration: {
        type: String,
        required: true,
        trim: true,
    },
    finish: {
        type: String,
        required: true,
        trim: true,
    },
    stock: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    sku: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
    },
    price: {
        type: Number,
        min: 0,
    },
    images: [{
        type: String,
        trim: true,
    }],
}, {
    _id: false,
});

const ProductSchema: Schema<IProduct> = new Schema({
    name: { type: String, required: true },
    category: {
        type: String,
        required: true,
        enum: [
            'Amplifier',
            'Power Amplifier',
            'Microphone',
            'Wired',
            'Wireless',
            'Mixers',
            'Portable Speakers',
            'Active Speaker',
            'Trolly Speaker',
            'Speakers',
            'Horn Speaker',
            'Unit Driver',
            'Driver Unit',
            'Reflex Horn',
            'Drivers',
            'HF Drivers',
            'Tweeters',
            'Network Drivers',
            'Crossover',
            'Digital Crossover',
            'Megaphones',
            'Conference System',
            'Audio Splitter',
            'Line Array Loudspeaker',
            'Intellection Speaker',
            'Wall Speaker',
            'Ceiling Speaker',
            'Stands',
            'Microphone Stands',
            'Speaker Stands',
        ]
    },
    basePrice: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    onSale: { type: Boolean, default: false },
    image: { type: String, required: true },
    images: [{ type: String }],
    description: { type: String, required: true },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0, min: 0 },
    ratingDistribution: {
        type: {
            1: { type: Number, default: 0 },
            2: { type: Number, default: 0 },
            3: { type: Number, default: 0 },
            4: { type: Number, default: 0 },
            5: { type: Number, default: 0 },
        },
        default: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
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
    variants: {
        type: [VariantSchema],
        default: [],
    },
    availableConfigurations: {
        type: [String],
        default: [],
        index: true,
    },
    availableFinishes: {
        type: [String],
        default: [],
        index: true,
    },
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
            obj.id = obj._id?.toString();
            delete obj._id;
            delete obj.__v;
            return ret;
        }
    }
});

ProductSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

ProductSchema.pre('validate', function syncProductDerivedFields(next) {
    if (this.basePrice == null && this.price != null) {
        this.basePrice = this.price;
    }

    if (this.price == null && this.basePrice != null) {
        this.price = this.basePrice;
    }

    const variants = this.variants ?? [];
    this.availableConfigurations = Array.from(
        new Set(variants.map((variant) => variant.configuration).filter(Boolean))
    );
    this.availableFinishes = Array.from(
        new Set(variants.map((variant) => variant.finish).filter(Boolean))
    );

    if (variants.length > 0) {
        this.stockCount = variants.reduce((total, variant) => total + variant.stock, 0);
        this.inStock = this.stockCount > 0;
    }

    const seenSkus = new Set<string>();
    const duplicateSku = variants.find((variant) => {
        const sku = variant.sku.toUpperCase();
        if (seenSkus.has(sku)) {
            return true;
        }
        seenSkus.add(sku);
        return false;
    });

    if (duplicateSku) {
        this.invalidate('variants', `Duplicate variant SKU: ${duplicateSku.sku}`);
    }

    next();
});

const Product: Model<IProduct> = mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
