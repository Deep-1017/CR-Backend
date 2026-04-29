import { z } from "zod";

/**
 * Validates the body of the PATCH /api/admin/reviews/:reviewId/reject endpoint.
 * Requires a rejectionReason between 5–500 characters.
 */
export const rejectReviewSchema = z.object({
  rejectionReason: z
    .string({ required_error: "Rejection reason is required" })
    .trim()
    .min(5, { message: "Rejection reason must be at least 5 characters" })
    .max(500, { message: "Rejection reason cannot exceed 500 characters" }),
});

export type RejectReviewInput = z.infer<typeof rejectReviewSchema>;
