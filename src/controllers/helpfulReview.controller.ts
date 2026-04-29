import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review';
import HelpfulReview from '../models/HelpfulReview';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';

const assertObjectId = (id: string, resourceName: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${resourceName} id`, 400);
  }
};

const requireAuthUserId = (req: Request): string => {
  const user = req.user as { id?: string; role?: string } | undefined;
  if (!user?.id) throw new AppError('Unauthorized', 401);
  return user.id;
};

// ─── POST /api/v1/reviews/:reviewId/helpful ──────────────────────────────────
// Mark a review as helpful or unhelpful, or remove the vote.
// Expects: { isHelpful: boolean | null } in the request body.
export const toggleHelpfulStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const { reviewId } = req.params;
  const { isHelpful } = req.body;

  assertObjectId(reviewId, 'review');

  if (isHelpful !== true && isHelpful !== false && isHelpful !== null) {
    throw new AppError('isHelpful must be true, false, or null', 400);
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    throw new AppError('Review not found', 404);
  }

  const userObjId = new mongoose.Types.ObjectId(userId);
  const existingVote = await HelpfulReview.findOne({
    reviewId: review._id,
    userId: userObjId,
  });

  // Calculate changes to counts
  let helpfulChange = 0;
  let unhelpfulChange = 0;
  let userVote: 'helpful' | 'unhelpful' | null = null;

  if (existingVote) {
    // If there was an existing vote, we first 'undo' its effect
    if (existingVote.isHelpful) {
      helpfulChange -= 1;
    } else {
      unhelpfulChange -= 1;
    }

    if (isHelpful === null || existingVote.isHelpful === isHelpful) {
      // If toggling same value or explicitly passing null, remove the vote
      await HelpfulReview.deleteOne({ _id: existingVote._id });
    } else {
      // Changing vote
      existingVote.isHelpful = isHelpful;
      await existingVote.save();
      
      if (isHelpful) {
        helpfulChange += 1;
        userVote = 'helpful';
      } else {
        unhelpfulChange += 1;
        userVote = 'unhelpful';
      }
    }
  } else {
    if (isHelpful !== null) {
      // Create new vote
      await HelpfulReview.create({
        reviewId: review._id,
        userId: userObjId,
        isHelpful,
      });

      if (isHelpful) {
        helpfulChange += 1;
        userVote = 'helpful';
      } else {
        unhelpfulChange += 1;
        userVote = 'unhelpful';
      }
    }
  }

  // Update Review counts
  review.helpful = Math.max(0, (review.helpful || 0) + helpfulChange);
  review.unhelpful = Math.max(0, (review.unhelpful || 0) + unhelpfulChange);
  await review.save({ validateModifiedOnly: true });

  res.status(200).json({
    helpful: review.helpful,
    unhelpful: review.unhelpful,
    userVote,
  });
});
