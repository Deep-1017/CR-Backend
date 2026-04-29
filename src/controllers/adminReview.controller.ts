import { Request, Response } from "express";
import mongoose from "mongoose";
import Review from "../models/Review";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import { updateProductRatingStats } from "../services/productService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const assertObjectId = (id: string, resourceName: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${resourceName} id`, 400);
  }
};

// ─── GET /api/admin/reviews ──────────────────────────────────────────────────
// List all reviews with filters and pagination (admin only)

export const getAdminReviews = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const status = req.query.status as string | undefined;
  const productId = req.query.productId as string | undefined;
  const sortBy = (req.query.sortBy as string) || "recent";

  // Build filter
  const filter: Record<string, unknown> = {};

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    filter.status = status;
  }

  if (productId) {
    assertObjectId(productId, "product");
    filter.productId = new mongoose.Types.ObjectId(productId);
  }

  // Sort options
  const sortOptions: Record<string, Record<string, 1 | -1>> = {
    recent: { createdAt: -1 },
    rating: { rating: -1, createdAt: -1 },
    product: { productId: 1, createdAt: -1 },
  };
  const sort = sortOptions[sortBy] ?? sortOptions.recent;

  const skip = (page - 1) * limit;

  const [reviews, totalCount] = await Promise.all([
    Review.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email avatar")
      .populate("productId", "name image")
      .lean(),
    Review.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  res.json({
    success: true,
    reviews,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});

// ─── GET /api/admin/reviews/:reviewId ────────────────────────────────────────
// Get full review details for moderation (admin only)

export const getAdminReviewById = asyncHandler(async (req: Request, res: Response) => {
  const { reviewId } = req.params;

  assertObjectId(reviewId, "review");

  const review = await Review.findById(reviewId)
    .populate("userId", "name email avatar")
    .populate("productId", "name image category brand")
    .lean();

  if (!review) {
    throw new AppError("Review not found", 404);
  }

  res.json({ success: true, review });
});

// ─── PATCH /api/admin/reviews/:reviewId/approve ──────────────────────────────
// Approve a review (admin only)

export const approveReview = asyncHandler(async (req: Request, res: Response) => {
  const { reviewId } = req.params;

  assertObjectId(reviewId, "review");

  const review = await Review.findById(reviewId);

  if (!review) {
    throw new AppError("Review not found", 404);
  }

  if (review.status === "approved") {
    throw new AppError("Review is already approved", 400);
  }

  review.status = "approved";
  review.rejectionReason = undefined;
  await review.save({ validateModifiedOnly: true });

  // Recalculate product rating stats
  await updateProductRatingStats(review.productId);

  res.json({
    success: true,
    message: "Review approved successfully.",
    review,
  });
});

// ─── PATCH /api/admin/reviews/:reviewId/reject ───────────────────────────────
// Reject a review with a reason (admin only)

export const rejectReview = asyncHandler(async (req: Request, res: Response) => {
  const { reviewId } = req.params;

  assertObjectId(reviewId, "review");

  const review = await Review.findById(reviewId);

  if (!review) {
    throw new AppError("Review not found", 404);
  }

  if (review.status === "rejected") {
    throw new AppError("Review is already rejected", 400);
  }

  review.status = "rejected";
  review.rejectionReason = req.body.rejectionReason;
  await review.save({ validateModifiedOnly: true });

  // Recalculate product rating stats (previous approval removed)
  await updateProductRatingStats(review.productId);

  res.json({
    success: true,
    message: "Review rejected.",
    review,
  });
});

// ─── DELETE /api/admin/reviews/:reviewId ─────────────────────────────────────
// Hard delete a review (admin only)

export const deleteAdminReview = asyncHandler(async (req: Request, res: Response) => {
  const { reviewId } = req.params;

  assertObjectId(reviewId, "review");

  const review = await Review.findById(reviewId).select("_id productId").lean();

  if (!review) {
    throw new AppError("Review not found", 404);
  }

  await Review.deleteOne({ _id: reviewId });

  // Recalculate product rating stats
  await updateProductRatingStats(review.productId);

  res.status(200).json({
    success: true,
    message: "Review deleted successfully.",
  });
});
