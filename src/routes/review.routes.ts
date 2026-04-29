import express from "express";
import { protect } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import {
  createReviewSchema,
  updateReviewSchema,
} from "../validation/reviewValidation";
import {
  createReview,
  getProductReviews,
  getReviewById,
  updateReview,
  deleteReview,
  voteReview,
} from "../controllers/review.controller";

const router = express.Router({ mergeParams: true });

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Product reviews and ratings (customer-facing)
 */

/**
 * @swagger
 * /api/v1/products/{productId}/reviews:
 *   post:
 *     summary: Submit a new review for a product
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating, title, comment]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5, example: 5 }
 *               title: { type: string, example: "Excellent build quality!" }
 *               comment: { type: string, example: "This amplifier exceeded my expectations. Crystal clear output and solid construction." }
 *               images: { type: array, items: { type: string }, example: ["https://res.cloudinary.com/demo/image/upload/review1.jpg"] }
 *     responses:
 *       201: { description: Review created (pending moderation) }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       404: { description: Product not found }
 *       409: { description: User already reviewed this product }
 *   get:
 *     summary: List approved reviews for a product
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [recent, helpful, rating], default: recent }
 *       - in: query
 *         name: rating
 *         schema: { type: string, default: all }
 *         description: Filter by star rating (1-5) or "all"
 *     responses:
 *       200:
 *         description: Paginated list of approved reviews with aggregated stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 reviews: { type: array }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage: { type: integer }
 *                     totalPages: { type: integer }
 *                     totalCount: { type: integer }
 *                     limit: { type: integer }
 *                     hasNextPage: { type: boolean }
 *                     hasPrevPage: { type: boolean }
 *                 aggregatedStats:
 *                   type: object
 *                   properties:
 *                     average: { type: number }
 *                     total: { type: integer }
 *                     distribution: { type: object }
 */
router
  .route("/")
  .get(getProductReviews)
  .post(protect, validate(createReviewSchema), createReview);

/**
 * @swagger
 * /api/v1/products/{productId}/reviews/{reviewId}:
 *   get:
 *     summary: Get a single approved review
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Review returned }
 *       404: { description: Review not found or not approved }
 *   patch:
 *     summary: Update a review (author or admin)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
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
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               title: { type: string }
 *               comment: { type: string }
 *               images: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Review updated (status reset to pending) }
 *       401: { description: Unauthorized }
 *       403: { description: Not the review author }
 *       404: { description: Review not found }
 *       409: { description: Review already approved }
 *   delete:
 *     summary: Delete a review (author or admin)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Review deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Not the review author }
 *       404: { description: Review not found }
 */
router
  .route("/:reviewId")
  .get(getReviewById)
  .patch(protect, validate(updateReviewSchema), updateReview)
  .delete(protect, deleteReview);

router.post("/:reviewId/vote", protect, voteReview);

export default router;
