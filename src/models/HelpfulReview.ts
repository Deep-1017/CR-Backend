import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IHelpfulReview extends Document {
  reviewId: Types.ObjectId;
  userId: Types.ObjectId;
  isHelpful: boolean;
}

const HelpfulReviewSchema = new Schema<IHelpfulReview>(
  {
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Review',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isHelpful: {
      type: Boolean,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce one vote per user per review
HelpfulReviewSchema.index({ reviewId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IHelpfulReview>('HelpfulReview', HelpfulReviewSchema);
