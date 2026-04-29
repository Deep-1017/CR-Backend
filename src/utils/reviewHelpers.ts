import { Types } from 'mongoose';
import Order from '../models/order.model';
import type { IReview } from '../models/Review';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReviewLike = Pick<IReview, 'rating'>;

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface RatingSummary {
  average: number;
  total: number;
  distribution: RatingDistribution;
}

// ─── Average Rating ──────────────────────────────────────────────────────────

/**
 * Calculates the average rating from an array of reviews.
 * Returns 0 if the array is empty.
 *
 * @param reviews - Array of objects containing at least a `rating` field
 * @returns Average rating rounded to one decimal place (0–5)
 */
export const calculateAverageRating = (reviews: ReviewLike[]): number => {
  if (reviews.length === 0) return 0;

  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
};

// ─── Rating Distribution ─────────────────────────────────────────────────────

/**
 * Builds a distribution map of ratings (1–5) from an array of reviews.
 * Each key represents a star count, and the value is the number of reviews
 * with that rating.
 *
 * @param reviews - Array of objects containing at least a `rating` field
 * @returns Object with keys 1–5 and their respective counts
 */
export const calculateRatingDistribution = (
  reviews: ReviewLike[]
): RatingDistribution => {
  const distribution: RatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const review of reviews) {
    const star = review.rating as 1 | 2 | 3 | 4 | 5;
    if (star >= 1 && star <= 5) {
      distribution[star]++;
    }
  }

  return distribution;
};

// ─── Rating Summary ──────────────────────────────────────────────────────────

/**
 * Convenience helper that returns both the average rating and the distribution
 * in a single call.
 *
 * @param reviews - Array of objects containing at least a `rating` field
 * @returns Object with average, total review count, and per-star distribution
 */
export const calculateRatingSummary = (
  reviews: ReviewLike[]
): RatingSummary => ({
  average: calculateAverageRating(reviews),
  total: reviews.length,
  distribution: calculateRatingDistribution(reviews),
});

// ─── Verified Purchase Check ─────────────────────────────────────────────────

/**
 * Checks whether a given user has purchased a specific product by looking for
 * a completed order containing that product.
 *
 * Only orders with `paymentStatus === 'success'` are considered.
 *
 * @param userId  - The user's ObjectId (string or Types.ObjectId)
 * @param productId - The product's ObjectId (string or Types.ObjectId)
 * @returns `true` if the user has a successful order containing the product
 */
export const isVerifiedPurchase = async (
  userId: string | Types.ObjectId,
  productId: string | Types.ObjectId
): Promise<boolean> => {
  const order = await Order.findOne({
    userId: userId.toString(),
    paymentStatus: 'success',
    'items.productId': new Types.ObjectId(productId.toString()),
  })
    .select('_id')
    .lean();

  return order !== null;
};
