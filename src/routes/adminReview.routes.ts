import express from "express";
import { protect, admin } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import { rejectReviewSchema } from "../validation/adminReviewValidation";
import {
  getAdminReviews,
  getAdminReviewById,
  approveReview,
  rejectReview,
  deleteAdminReview,
} from "../controllers/adminReview.controller";

const router = express.Router();

// All routes require admin authentication
router.use(protect, admin);

/**
 * @swagger
 * tags:
 *   name: Admin Reviews
 *   description: Review moderation endpoints (admin only)
 */

/**
 * @swagger
 * /api/admin/reviews:
 *   get:
 *     summary: List all reviews with optional filters and pagination
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected] }
 *       - in: query
 *         name: productId
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [recent, rating, product], default: recent }
 *     responses:
 *       200:
 *         description: Paginated list of reviews
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden – admin only }
 */
router.get("/", getAdminReviews);

/**
 * @swagger
 * /api/admin/reviews/{reviewId}:
 *   get:
 *     summary: Get full review details for moderation
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Full review details }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Review not found }
 */
router.get("/:reviewId", getAdminReviewById);

/**
 * @swagger
 * /api/admin/reviews/{reviewId}/approve:
 *   patch:
 *     summary: Approve a review
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Review approved }
 *       400: { description: Review is already approved }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Review not found }
 */
router.patch("/:reviewId/approve", approveReview);

/**
 * @swagger
 * /api/admin/reviews/{reviewId}/reject:
 *   patch:
 *     summary: Reject a review
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rejectionReason]
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 example: "Contains inappropriate language"
 *     responses:
 *       200: { description: Review rejected }
 *       400: { description: Review is already rejected or validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Review not found }
 */
router.patch("/:reviewId/reject", validate(rejectReviewSchema), rejectReview);

/**
 * @swagger
 * /api/admin/reviews/{reviewId}:
 *   delete:
 *     summary: Hard delete a review
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Review deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Review not found }
 */
router.delete("/:reviewId", deleteAdminReview);

export default router;
