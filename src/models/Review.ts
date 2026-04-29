import mongoose, { Document, Schema, Types } from 'mongoose';

// ─── Review Status Enum ──────────────────────────────────────────────────────
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// ─── Interface ───────────────────────────────────────────────────────────────
export interface IReview extends Document {
  productId: Types.ObjectId;
  userId: Types.ObjectId;
  rating: number;
  title: string;
  comment: string;
  images: string[];
  isVerifiedPurchase: boolean;
  helpful: number;
  unhelpful: number;
  helpfulVotes: Types.ObjectId[];
  notHelpfulVotes: Types.ObjectId[];
  status: ReviewStatus;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────────
const ReviewSchema = new Schema<IReview>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number',
      },
    },
    title: {
      type: String,
      required: [true, 'Review title is required'],
      trim: true,
      minlength: [10, 'Title must be at least 10 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      minlength: [20, 'Comment must be at least 20 characters'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length <= 10,
        message: 'A review can have at most 10 images',
      },
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    helpful: {
      type: Number,
      default: 0,
      min: [0, 'Helpful count cannot be negative'],
    },
    unhelpful: {
      type: Number,
      default: 0,
      min: [0, 'Unhelpful count cannot be negative'],
    },
    helpfulVotes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    notHelpfulVotes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      required: true,
      enum: {
        values: REVIEW_STATUSES as unknown as string[],
        message: '{VALUE} is not a valid review status',
      },
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const obj = ret as any;
        delete obj.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────

// Fetch approved reviews for a specific product efficiently
ReviewSchema.index({ productId: 1, status: 1 });

// Enforce one review per user per product
ReviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Sort reviews by most recent
ReviewSchema.index({ createdAt: -1 });

// ─── Pre-save Hook ───────────────────────────────────────────────────────────
// Filter out empty/whitespace-only image URLs
ReviewSchema.pre('save', function (next) {
  if (this.isModified('images')) {
    this.images = this.images.filter((url) => url.trim().length > 0);
  }
  next();
});

export default mongoose.model<IReview>('Review', ReviewSchema);
