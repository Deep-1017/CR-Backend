import express from "express";
import {
  addOrderItems,
  getMyOrders,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} from "../controllers/order.controller";
import { protect, admin } from "../middleware/auth.middleware";
import { validate, validateQuery } from "../middleware/validate";
import {
  addOrderSchema,
  updateOrderStatusSchema,
  getMyOrdersQuerySchema,
} from "../schemas/order.schema";

const router = express.Router();

// ─── POST /api/v1/orders ── Create a new order (any logged-in user) ──────────
// ─── GET  /api/v1/orders ── Get MY orders (logged-in user) ───────────────────

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderInput'
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Validation error or total amount mismatch
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: Get all orders for the logged-in user (admin sees all orders)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, Pending, Processing, Confirmed, Completed, Cancelled]
 *           default: all
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [recent, oldest, amount-high, amount-low]
 *           default: recent
 *     responses:
 *       200:
 *         description: Paginated list of orders
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 */
router
  .route("/")
  .post(protect, validate(addOrderSchema), addOrderItems)
  .get(protect, validateQuery(getMyOrdersQuerySchema), getMyOrders);

// ─── Admin-only: GET /api/v1/orders/admin/all ─────────────────────────────────
// Kept separate so the user-facing GET / doesn't require admin role

/**
 * @swagger
 * /api/v1/orders/admin/all:
 *   get:
 *     summary: Admin — list ALL orders with basic pagination
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: All orders returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – admin only
 */
router.get("/admin/all", protect, admin, getOrders);

// ─── /api/v1/orders/:id ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   get:
 *     summary: Get a single order by ID (owner or admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Order ObjectId
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
 *   put:
 *     summary: Update order status (admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Pending, Processing, Confirmed, Completed, Cancelled]
 *     responses:
 *       200:
 *         description: Order status updated
 *       404:
 *         description: Order not found
 *   delete:
 *     summary: Delete an order (admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order removed
 *       404:
 *         description: Order not found
 */
router
  .route("/:id")
  .get(protect, getOrderById)
  .put(protect, admin, validate(updateOrderStatusSchema), updateOrderStatus)
  .delete(protect, admin, deleteOrder);

export default router;
