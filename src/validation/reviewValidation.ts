import { z } from 'zod';
import { REVIEW_STATUSES } from '../models/Review';

// ─── Reusable Field Schemas ──────────────────────────────────────────────────

export const ratingSchema = z
  .number()
  .int({ message: 'Rating must be a whole number' })
  .min(1, { message: 'Rating must be at least 1 star' })
  .max(5, { message: 'Rating cannot exceed 5 stars' });

export const reviewTitleSchema = z
  .string()
  .trim()
  .min(10, { message: 'Title must be at least 10 characters' })
  .max(200, { message: 'Title cannot exceed 200 characters' });

export const reviewCommentSchema = z
  .string()
  .trim()
  .min(20, { message: 'Comment must be at least 20 characters' })
  .max(2000, { message: 'Comment cannot exceed 2000 characters' });

export const reviewImageSchema = z
  .string()
  .trim()
  .url({ message: 'Each image must be a valid URL' });

export const reviewStatusSchema = z.enum(REVIEW_STATUSES, {
  errorMap: () => ({ message: 'Status must be one of: pending, approved, rejected' }),
});

// ─── Create Review Schema ────────────────────────────────────────────────────
// Used when a customer submits a new review

export const createReviewSchema = z.object({
  rating: ratingSchema,
  title: reviewTitleSchema,
  comment: reviewCommentSchema,
  images: z
    .array(reviewImageSchema)
    .max(10, { message: 'A review can have at most 10 images' })
    .optional()
    .default([]),
});

// ─── Update Review Schema ────────────────────────────────────────────────────
// Used when a customer edits their own review (only while status is 'pending')

export const updateReviewSchema = z
  .object({
    rating: ratingSchema,
    title: reviewTitleSchema,
    comment: reviewCommentSchema,
    images: z
      .array(reviewImageSchema)
      .max(10, { message: 'A review can have at most 10 images' }),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update a review',
  });

// ─── Admin Moderate Review Schema ────────────────────────────────────────────
// Used by admins to approve or reject a review

export const moderateReviewSchema = z
  .object({
    status: z.enum(['approved', 'rejected'], {
      errorMap: () => ({
        message: 'Moderation status must be either approved or rejected',
      }),
    }),
    rejectionReason: z
      .string()
      .trim()
      .min(5, { message: 'Rejection reason must be at least 5 characters' })
      .max(500, { message: 'Rejection reason cannot exceed 500 characters' })
      .optional(),
  })
  .refine(
    (data) => {
      // Rejection reason is required when rejecting a review
      if (data.status === 'rejected' && !data.rejectionReason) {
        return false;
      }
      return true;
    },
    {
      message: 'Rejection reason is required when rejecting a review',
      path: ['rejectionReason'],
    }
  );

// ─── Helpful Vote Schema ────────────────────────────────────────────────────
// Used when a user votes a review as helpful/unhelpful

export const reviewVoteSchema = z.object({
  vote: z.enum(['helpful', 'unhelpful'], {
    errorMap: () => ({
      message: 'Vote must be either helpful or unhelpful',
    }),
  }),
});

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
export type ReviewVoteInput = z.infer<typeof reviewVoteSchema>;
