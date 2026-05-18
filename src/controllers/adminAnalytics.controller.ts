import { Request, Response } from "express";
import Order from "../models/order.model";
import User from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";

const buildDateRange = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) {
    throw new AppError("startDate and endDate are required query params", 400);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError("Invalid startDate or endDate", 400);
  }

  if (start > end) {
    throw new AppError("startDate cannot be after endDate", 400);
  }

  const rangeStart = new Date(start);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(end);
  rangeEnd.setHours(23, 59, 59, 999);

  return { rangeStart, rangeEnd };
};

const paidOrderMatch = {
  $or: [{ paymentStatus: "success" }, { "paymentDetails.status": "paid" }],
};

export const getRevenueAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };
    const { rangeStart, rangeEnd } = buildDateRange(startDate, endDate);

    const pipeline = [
      {
        $match: {
          ...paidOrderMatch,
          createdAt: { $gte: rangeStart, $lte: rangeEnd },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          revenue: {
            $sum: {
              $cond: [
                { $gt: ["$amountPaid", 0] },
                "$amountPaid",
                { $ifNull: ["$totalAmount", 0] },
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 as const } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          revenue: { $round: ["$revenue", 2] },
        },
      },
    ];

    const dailyRevenue = await Order.aggregate(pipeline);
    const totalRevenue = dailyRevenue.reduce(
      (sum: number, row: { revenue: number }) => sum + row.revenue,
      0,
    );

    res.json({
      startDate: rangeStart.toISOString(),
      endDate: rangeEnd.toISOString(),
      totalRevenue: Number(totalRevenue.toFixed(2)),
      dailyRevenue,
      pipeline,
    });
  },
);

export const getOrdersAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };
    const { rangeStart, rangeEnd } = buildDateRange(startDate, endDate);

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: rangeStart, $lte: rangeEnd },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          Processing: {
            $sum: { $cond: [{ $eq: ["$status", "Processing"] }, 1, 0] },
          },
          Shipped: { $sum: { $cond: [{ $eq: ["$status", "Shipped"] }, 1, 0] } },
          Delivered: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$status", "Delivered"] },
                    { $eq: ["$status", "Completed"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          Cancelled: {
            $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalOrders: 1,
          byStatus: {
            Processing: "$Processing",
            Shipped: "$Shipped",
            Delivered: "$Delivered",
            Cancelled: "$Cancelled",
          },
        },
      },
    ];

    const [result] = await Order.aggregate(pipeline);

    res.json({
      startDate: rangeStart.toISOString(),
      endDate: rangeEnd.toISOString(),
      totalOrders: result?.totalOrders ?? 0,
      byStatus: result?.byStatus ?? {
        Processing: 0,
        Shipped: 0,
        Delivered: 0,
        Cancelled: 0,
      },
      pipeline,
    });
  },
);

export const getTopProductsAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const parsedLimit = Number(req.query.limit ?? 5);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5;

    const pipeline = [
      { $match: paidOrderMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            productId: "$items.productId",
            name: "$items.name",
          },
          unitsSold: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: [
                { $ifNull: ["$items.priceAtPurchase", "$items.price"] },
                "$items.quantity",
              ],
            },
          },
        },
      },
      { $sort: { unitsSold: -1 as const, totalRevenue: -1 as const } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          productId: "$_id.productId",
          name: "$_id.name",
          unitsSold: 1,
          totalRevenue: { $round: ["$totalRevenue", 2] },
        },
      },
    ];

    const topProducts = await Order.aggregate(pipeline);

    res.json({ limit, topProducts, pipeline });
  },
);

export const getCustomersAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };
    const { rangeStart, rangeEnd } = buildDateRange(startDate, endDate);

    const totalCustomersQuery = {
      role: { $nin: ["admin"] },
    };
    const newSignupsQuery = {
      ...totalCustomersQuery,
      createdAt: { $gte: rangeStart, $lte: rangeEnd },
    };

    const [totalCustomers, newSignups] = await Promise.all([
      User.countDocuments(totalCustomersQuery),
      User.countDocuments(newSignupsQuery),
    ]);

    res.json({
      startDate: rangeStart.toISOString(),
      endDate: rangeEnd.toISOString(),
      totalCustomers,
      newSignups,
      pipeline: [
        { operation: "countDocuments", filter: totalCustomersQuery },
        { operation: "countDocuments", filter: newSignupsQuery },
      ],
    });
  },
);
