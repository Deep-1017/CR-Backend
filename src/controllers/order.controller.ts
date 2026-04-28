import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../models/order.model";
import User from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import logger from "../utils/logger";
import { handleStockErrors, processOrderItems } from "../services/orderService";
import * as emailService from "../services/emailService";
import { GetMyOrdersQuery } from "../schemas/order.schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map sortBy query value → MongoDB sort object */
const buildSortStage = (sortBy: string): Record<string, 1 | -1> => {
  switch (sortBy) {
    case "oldest":
      return { createdAt: 1 };
    case "amount-high":
      return { totalAmount: -1 };
    case "amount-low":
      return { totalAmount: 1 };
    case "recent":
    default:
      return { createdAt: -1 };
  }
};

/** Format a numeric _id counter into "#ORD-001" style string */
const formatOrderNumber = (id: string): string => {
  // Use the last 6 hex chars of the ObjectId for a short, readable number
  const short = id.slice(-6).toUpperCase();
  return `#ORD-${short}`;
};

// ─── Controllers ──────────────────────────────────────────────────────────────

export const addOrderItems = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user as { id?: string } | undefined;
    const session = await mongoose.startSession();

    try {
      const order = await handleStockErrors(session, async () => {
        const items = await processOrderItems(req.body.items, session);
        const computedTotal = items.reduce(
          (total, item) => total + item.priceAtPurchase * item.quantity,
          0,
        );

        if (
          Number(req.body.totalAmount.toFixed(2)) !==
          Number(computedTotal.toFixed(2))
        ) {
          throw new AppError("Total amount mismatch", 400);
        }

        const [createdOrder] = await Order.create(
          [
            {
              ...req.body,
              userId: req.body.userId ?? authUser?.id,
              items,
              totalAmount: computedTotal,
            },
          ],
          { session },
        );

        return createdOrder;
      });

      res.status(201).json(order);
    } finally {
      await session.endSession();
    }
  },
);

// ─── NEW: GET /api/orders  (logged-in user sees their own orders) ─────────────

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: Get all orders for the logged-in user (admin sees all)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (must be a positive integer)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of orders per page (max 100)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, Pending, Processing, Confirmed, Completed, Cancelled]
 *           default: all
 *         description: Filter by order status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [recent, oldest, amount-high, amount-low]
 *           default: recent
 *         description: Sort orders
 *     responses:
 *       200:
 *         description: Paginated list of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrderSummary'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:       { type: integer }
 *                     limit:      { type: integer }
 *                     totalOrders:{ type: integer }
 *                     totalPages: { type: integer }
 *             example:
 *               orders:
 *                 - _id: "664f1a2b3c4d5e6f7a8b9c0d"
 *                   orderNumber: "#ORD-8B9C0D"
 *                   totalAmount: 4990
 *                   orderStatus: "Confirmed"
 *                   paymentStatus: "success"
 *                   createdAt: "2024-05-23T10:30:00.000Z"
 *                   estimatedDeliveryDate: null
 *                   itemCount: 2
 *                   items:
 *                     - productName: "Test Amplifier"
 *                       configuration: "Standard"
 *                       finish: "Natural"
 *                       quantity: 2
 *                       image: "/assets/test.jpg"
 *               pagination:
 *                 page: 1
 *                 limit: 10
 *                 totalOrders: 1
 *                 totalPages: 1
 *       400:
 *         description: Invalid query parameters (non-numeric page/limit)
 *       401:
 *         description: Unauthorized – JWT missing or invalid
 */
export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as { id?: string; role?: string } | undefined;

  if (!user?.id) {
    throw new AppError("Unauthorized", 401);
  }

  // Query params are already validated + coerced by validateQuery middleware
  const {
    page = 1,
    limit = 10,
    status = "all",
    sortBy = "recent",
  } = req.query as unknown as GetMyOrdersQuery;

  // Clamp limit to a safe ceiling
  const safeLimit = Math.min(Number(limit), 100);
  const safePage = Math.max(Number(page), 1);
  const skip = (safePage - 1) * safeLimit;

  // ── Build filter ──────────────────────────────────────────────────────────
  const filter: Record<string, unknown> = {};

  // Regular users only see their own orders; admins can see everything
  if (user.role !== "admin") {
    filter.userId = user.id;
  }

  // Optional status filter
  if (status !== "all") {
    filter.status = status;
  }

  // ── Query ─────────────────────────────────────────────────────────────────
  const sortStage = buildSortStage(sortBy as string);

  const [rawOrders, totalOrders] = await Promise.all([
    Order.find(filter)
      .sort(sortStage)
      .skip(skip)
      .limit(safeLimit)
      .select("_id userId totalAmount status paymentStatus createdAt items"),
    Order.countDocuments(filter),
  ]);

  // ── Shape the response ────────────────────────────────────────────────────
  const orders = rawOrders.map((order) => ({
    _id: order._id,
    orderNumber: formatOrderNumber(order._id.toString()),
    totalAmount: order.totalAmount,
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    estimatedDeliveryDate: null, // extend when the field is added to the model
    itemCount: order.items.length,
    items: order.items.map((item) => ({
      productName: item.name,
      configuration: item.configuration,
      finish: item.finish,
      quantity: item.quantity,
      image: item.image,
    })),
  }));

  res.json({
    orders,
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalOrders,
      totalPages: Math.ceil(totalOrders / safeLimit),
    },
  });
});

// ─── Admin: list ALL orders (existing, unchanged logic) ───────────────────────
export const getOrders = asyncHandler(async (_req: Request, res: Response) => {
  const page = Math.max(1, Number(_req.query.page) || 1);
  const limit = Math.min(100, Number(_req.query.limit) || 20);

  const [orders, total] = await Promise.all([
    Order.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments({}),
  ]);

  const serializedOrders = orders.map((order: any) => ({
    ...order,
    id: order._id?.toString(),
    _id: undefined,
    __v: undefined,
  }));

  res.json({ orders: serializedOrders, total, page, pages: Math.ceil(total / limit) });
});

export const getOrderById = asyncHandler(
  async (req: Request, res: Response) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new AppError("Invalid order ID format", 400);
    }

    const order = await Order.findById(req.params.id).populate(
      "items.productId",
      "name image",
    );
    if (!order) throw new AppError("Order not found", 404);

    const user = req.user as { id?: string; role?: string } | undefined;
    if (user?.role !== "admin" && order.userId !== user?.id) {
      throw new AppError("Not authorised to view this order", 403);
    }

    res.json(order);
  },
);

export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true },
    );
    if (!order) throw new AppError("Order not found", 404);
    res.json(order);
  },
);

export const sendShippedEmail = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { trackingNumber, carrierName, estimatedDeliveryDate } = req.body as {
      trackingNumber?: string;
      carrierName?: string;
      estimatedDeliveryDate?: string;
    };

    if (!trackingNumber?.trim() || !carrierName?.trim() || !estimatedDeliveryDate?.trim()) {
      throw new AppError("Missing tracking info", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new AppError("Order not found", 404);
    }

    const order = await Order.findById(orderId).populate(
      "items.productId",
      "name image",
    );

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.status === "Cancelled") {
      throw new AppError("Order status does not allow shipping notification", 400);
    }

    if (order.status !== "Shipped") {
      order.status = "Shipped";
      await order.save();
    }

    const userDocument = order.userId
      ? await User.findById(order.userId).select("email name")
      : null;
    const user = {
      email: userDocument?.email ?? order.customer.email,
      name:
        userDocument?.name ??
        [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" "),
    };

    const trackingInfo = {
      trackingNumber: trackingNumber.trim(),
      carrierName: carrierName.trim(),
      estimatedDeliveryDate: estimatedDeliveryDate.trim(),
    };

    try {
      const result = await emailService.sendOrderShippedEmail(user, order, trackingInfo);
      if (!result.ok) {
        logger.error("Shipping notification email failed", {
          orderId: order.id,
          email: user.email,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Shipping notification email failed", {
        orderId: order.id,
        email: user.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    res.json({
      success: true,
      message: `Shipping notification email sent to ${user.email}`,
    });
  },
);

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) throw new AppError("Order not found", 404);
  res.json({ message: "Order removed" });
});
