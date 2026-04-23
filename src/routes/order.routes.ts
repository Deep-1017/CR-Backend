import express from 'express';
import {
    addOrderItems, getOrders, getOrderById, updateOrderStatus, deleteOrder
} from '../controllers/order.controller';
import { protect, admin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { addOrderSchema, updateOrderStatusSchema } from '../schemas';

const router = express.Router();

router.route('/')
    .post(protect, validate(addOrderSchema), addOrderItems)
    .get(protect, admin, getOrders);                               // admin only — list all orders

router.route('/:id')
    /**
     * @swagger
     * /api/v1/orders/{id}:
     *   get:
     *     summary: Get order by ID
     *     tags: [Orders]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Order ID
     *     responses:
     *       200:
     *         description: Order retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Order'
     *       400:
     *         description: Invalid order ID format
     *       403:
     *         description: Not authorized to view this order
     *       404:
     *         description: Order not found
     */
    .get(protect, getOrderById)                                    // logged-in user (ownership check in controller)
    .put(protect, admin, validate(updateOrderStatusSchema), updateOrderStatus) // admin only
    .delete(protect, admin, deleteOrder);                          // admin only

export default router;
