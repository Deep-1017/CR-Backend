import { Request, Response } from "express";
import mongoose from "mongoose";
import Review from "../models/Review";
import Product from "../models/product.model";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import { isVerifiedPurchase, calculateRatingSummary } from "../utils/reviewHelpers";
import { updateProductRatingStats } from "../services/productService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const assertObjectId = (id: string, resourceName: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${resourceName} id`, 400);
  }
};

const requireAuthUserId = (req: Request): string => {
  const user = req.user as { id?: string; role?: string } | undefined;
  if (!user?.id) throw new AppError("Unauthorized", 401);
  return user.id;
};

const getAuthUser = (req: Request): { id: string; role: string } | null => {
  const user = req.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return null;
  return { id: user.id, role: user.role ?? "user" };
};

// ─── POST /api/products/:productId/reviews ───────────────────────────────────
// Create a new review (authenticated customer)

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const { productId } = req.params;

  assertObjectId(productId, "product");

  // Verify the product exists
  const product = await Product.findById(productId).select("_id").lean();
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  // Check for duplicate review (one review per user per product)
  const existingReview = await Review.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    productId: new mongoose.Types.ObjectId(productId),
  })
    .select("_id")
    .lean();

  if (existingReview) {
    throw new AppError(
      "You have already reviewed this product. You can edit your existing review instead.",
      409
    );
  }

  // Check verified purchase status
  const verified = await isVerifiedPurchase(userId, productId);

  const review = await Review.create({
    productId: new mongoose.Types.ObjectId(productId),
    userId: new mongoose.Types.ObjectId(userId),
    rating: req.body.rating,
    title: req.body.title,
    comment: req.body.comment,
    images: req.body.images ?? [],
    isVerifiedPurchase: verified,
    status: "pending",
  });

  res.status(201).json({
    success: true,
    message: "Your review has been submitted and is pending approval.",
    review,
  });
});

// ─── GET /api/products/:productId/reviews ────────────────────────────────────
// Fetch approved reviews for a product (public)

export const getProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;

  assertObjectId(productId, "product");

  // Parse query parameters
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
  const sortBy = (req.query.sortBy as string) || "recent";
  const ratingFilter = req.query.rating as string;

  // Build filter – only approved reviews
  const filter: Record<string, unknown> = {
    productId: new mongoose.Types.ObjectId(productId),
    status: "approved",
  };

  if (ratingFilter && ratingFilter !== "all") {
    const parsedRating = parseInt(ratingFilter, 10);
    if (parsedRating >= 1 && parsedRating <= 5) {
      filter.rating = parsedRating;
    }
  }

  // Sort options
  const sortOptions: Record<string, Record<string, 1 | -1>> = {
    recent: { createdAt: -1 },
    helpful: { helpful: -1, createdAt: -1 },
    rating: { rating: -1, createdAt: -1 },
  };
  const sort = sortOptions[sortBy] ?? sortOptions.recent;

  // Execute query with pagination
  const skip = (page - 1) * limit;

  const [reviews, totalCount] = await Promise.all([
    Review.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("userId", "name avatar")
      .lean(),
    Review.countDocuments(filter),
  ]);

  // Aggregated stats – across ALL approved reviews for this product (ignoring rating filter)
  const allApprovedReviews = await Review.find({
    productId: new mongoose.Types.ObjectId(productId),
    status: "approved",
  })
    .select("rating")
    .lean();

  const aggregatedStats = calculateRatingSummary(allApprovedReviews);

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
    aggregatedStats,
  });
});

// ─── GET /api/products/:productId/reviews/:reviewId ──────────────────────────
// Fetch a single approved review (public)

export const getReviewById = asyncHandler(async (req: Request, res: Response) => {
  const { productId, reviewId } = req.params;

  assertObjectId(productId, "product");
  assertObjectId(reviewId, "review");

  const review = await Review.findOne({
    _id: reviewId,
    productId: new mongoose.Types.ObjectId(productId),
    status: "approved",
  })
    .populate("userId", "name avatar")
    .lean();

  if (!review) {
    throw new AppError("Review not found", 404);
  }

  res.json({ success: true, review });
});

// ─── PATCH /api/products/:productId/reviews/:reviewId ────────────────────────
// Update a review (author or admin only, only if not already approved)

export const updateReview = asyncHandler(async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) throw new AppError("Unauthorized", 401);

  const { productId, reviewId } = req.params;

  assertObjectId(productId, "product");
  assertObjectId(reviewId, "review");

  const review = await Review.findOne({
    _id: reviewId,
    productId: new mongoose.Types.ObjectId(productId),
  });

  if (!review) {
    throw new AppError("Review not found", 404);
  }

  // Ownership check: author or admin
  const isAuthor = review.userId.toString() === authUser.id;
  const isAdmin = authUser.role === "admin";

  if (!isAuthor && !isAdmin) {
    throw new AppError("You are not authorised to edit this review", 403);
  }

  // Cannot edit an already-approved review (user must delete and submit a new one)
  if (review.status === "approved" && !isAdmin) {
    throw new AppError(
      "This review has already been approved and cannot be edited. Please delete it and submit a new review.",
      409
    );
  }

  // Apply updates
  const allowedFields = ["rating", "title", "comment", "images"] as const;
  let contentChanged = false;

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      (review as any)[field] = req.body[field];
      contentChanged = true;
    }
  }

  // Reset status to pending if content was changed (requires re-moderation)
  if (contentChanged && !isAdmin) {
    review.status = "pending";
  }

  await review.save({ validateModifiedOnly: true });

  res.json({
    success: true,
    message: contentChanged
      ? "Review updated and is pending re-approval."
      : "No changes detected.",
    review,
  });
});

// ─── DELETE /api/products/:productId/reviews/:reviewId ───────────────────────
// Delete a review (author or admin only)

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) throw new AppError("Unauthorized", 401);

  const { productId, reviewId } = req.params;

  assertObjectId(productId, "product");
  assertObjectId(reviewId, "review");

  const review = await Review.findOne({
    _id: reviewId,
    productId: new mongoose.Types.ObjectId(productId),
  })
    .select("_id userId productId status")
    .lean();

  if (!review) {
    throw new AppError("Review not found", 404);
  }

  // Ownership check: author or admin
  const isAuthor = review.userId.toString() === authUser.id;
  const isAdmin = authUser.role === "admin";

  if (!isAuthor && !isAdmin) {
    throw new AppError("You are not authorised to delete this review", 403);
  }

  await Review.deleteOne({ _id: reviewId });

  // Recalculate product rating stats if the deleted review was approved
  if (review.status === "approved") {
    await updateProductRatingStats(review.productId);
  }

  res.status(200).json({
    success: true,
    message: "Review deleted successfully.",
  });
});

// ─── POST /api/products/:productId/reviews/:reviewId/vote ────────────────────
// Vote a review as helpful or unhelpful (authenticated user)

export const voteReview = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const { productId, reviewId } = req.params;
  const { type } = req.body; // 'helpful', 'notHelpful', or null

  assertObjectId(productId, "product");
  assertObjectId(reviewId, "review");

  if (type !== "helpful" && type !== "notHelpful" && type !== null) {
    throw new AppError("Vote type must be 'helpful', 'notHelpful', or null", 400);
  }

  const review = await Review.findOne({
    _id: reviewId,
    productId: new mongoose.Types.ObjectId(productId),
    status: "approved",
  });

  if (!review) {
    throw new AppError("Review not found", 404);
  }

  // Remove existing vote by this user
  const userObjId = new mongoose.Types.ObjectId(userId);
  
  review.helpfulVotes = review.helpfulVotes.filter(
    (id) => id.toString() !== userId
  );
  review.notHelpfulVotes = review.notHelpfulVotes.filter(
    (id) => id.toString() !== userId
  );

  // Add new vote if not null
  if (type === "helpful") {
    review.helpfulVotes.push(userObjId);
  } else if (type === "notHelpful") {
    review.notHelpfulVotes.push(userObjId);
  }

  // Update counts
  review.helpful = review.helpfulVotes.length;
  review.unhelpful = review.notHelpfulVotes.length;

  await review.save({ validateModifiedOnly: true });

  res.json({
    success: true,
    message: "Vote recorded successfully.",
    review: {
      helpful: review.helpful,
      unhelpful: review.unhelpful,
      helpfulVotes: review.helpfulVotes,
      notHelpfulVotes: review.notHelpfulVotes,
    },
  });
});
