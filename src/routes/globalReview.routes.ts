import express from 'express';
import { protect } from '../middleware/auth.middleware';
import { toggleHelpfulStatus } from '../controllers/helpfulReview.controller';

const router = express.Router();

/**
 * @swagger
 * /api/v1/reviews/{reviewId}/helpful:
 *   post:
 *     summary: Mark a review as helpful or unhelpful
 *     tags: [Reviews]
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
 *             properties:
 *               isHelpful: { type: boolean, nullable: true }
 *     responses:
 *       200:
 *         description: Successfully toggled vote
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 */
router.post('/:reviewId/helpful', protect, toggleHelpfulStatus);

export default router;
