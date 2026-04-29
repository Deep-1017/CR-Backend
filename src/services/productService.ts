import mongoose from "mongoose";
import Review from "../models/Review";
import Product from "../models/product.model";

/**
 * Recalculates and atomically updates a product's rating stats
 * (averageRating, totalReviews, ratingDistribution) based on all
 * currently approved reviews.
 *
 * Uses a MongoDB aggregation pipeline for accuracy and a single
 * `findOneAndUpdate` call for atomicity.
 *
 * Should be called after any review status change (approve, reject)
 * or deletion that could affect the product's aggregated scores.
 */
export const updateProductRatingStats = async (
  productId: string | mongoose.Types.ObjectId
): Promise<void> => {
  const pid = new mongoose.Types.ObjectId(productId.toString());

  // Aggregate approved reviews for this product
  const [stats] = await Review.aggregate([
    { $match: { productId: pid, status: "approved" } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        sumRating: { $sum: "$rating" },
        star1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
        star2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
        star3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
        star4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
        star5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
      },
    },
  ]);

  // Default values when no approved reviews exist
  const totalReviews = stats?.totalReviews ?? 0;
  const averageRating =
    totalReviews > 0
      ? Math.round((stats.sumRating / totalReviews) * 10) / 10
      : 0;
  const ratingDistribution = {
    1: stats?.star1 ?? 0,
    2: stats?.star2 ?? 0,
    3: stats?.star3 ?? 0,
    4: stats?.star4 ?? 0,
    5: stats?.star5 ?? 0,
  };

  // Atomic update – single write operation
  await Product.findOneAndUpdate(
    { _id: pid },
    {
      $set: {
        averageRating,
        totalReviews,
        ratingDistribution,
        // Keep legacy fields in sync
        rating: averageRating,
        reviews: totalReviews,
      },
    },
    { new: true }
  );
};
