import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWishlistItem {
  product: Types.ObjectId;
  variantKey?: string;
  addedAt: Date;
}

export interface IWishlist extends Document {
  user: Types.ObjectId;
  items: IWishlistItem[];
}

const WishlistItemSchema = new Schema<IWishlistItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantKey: { type: String, default: '' },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WishlistSchema = new Schema<IWishlist>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: { type: [WishlistItemSchema], default: [] },
  },
  { timestamps: true }
);

WishlistSchema.index({ user: 1, 'items.product': 1, 'items.variantKey': 1 });

const Wishlist = mongoose.model<IWishlist>('Wishlist', WishlistSchema);

export default Wishlist;
