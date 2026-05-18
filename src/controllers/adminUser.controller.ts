import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Order from "../models/order.model";
import Review from "../models/Review";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";

const customerRoleFilter = { role: { $in: ["customer", "user"] } };

const assertObjectId = (id: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid user id", 400);
  }
};

const sanitizeUser = (user: any) => {
  const plain = typeof user.toObject === "function" ? user.toObject() : user;
  delete plain.password;
  delete plain.refreshToken;
  delete plain.emailVerificationToken;
  delete plain.passwordResetToken;
  delete plain.passwordResetExpires;
  delete plain.__v;
  return {
    ...plain,
    id: plain._id?.toString(),
  };
};

export const getAdminUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { ...customerRoleFilter };

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
    ];
  }

  const [users, total, orderCounts] = await Promise.all([
    User.find(filter)
      .select("-password -refreshToken -emailVerificationToken -passwordResetToken -passwordResetExpires")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
    Order.aggregate([
      { $group: { _id: "$userId", ordersCount: { $sum: 1 } } },
    ]),
  ]);

  const orderCountMap = new Map(
    orderCounts.map((row) => [String(row._id), row.ordersCount]),
  );

  res.json({
    success: true,
    users: users.map((user: any) => ({
      ...user,
      id: user._id?.toString(),
      ordersCount: orderCountMap.get(String(user._id)) ?? 0,
      password: undefined,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
    limit,
  });
});

export const getAdminUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  assertObjectId(id);

  const user = await User.findOne({ _id: id, ...customerRoleFilter }).select(
    "-password -refreshToken -emailVerificationToken -passwordResetToken -passwordResetExpires",
  );

  if (!user) {
    throw new AppError("Customer not found", 404);
  }

  const [orders, reviews, ordersCount] = await Promise.all([
    Order.find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Review.find({ userId: new mongoose.Types.ObjectId(id) })
      .sort({ createdAt: -1 })
      .populate("productId", "name image")
      .lean(),
    Order.countDocuments({ userId: id }),
  ]);

  res.json({
    success: true,
    user: {
      ...sanitizeUser(user),
      ordersCount,
    },
    orders: orders.map((order: any) => ({
      ...order,
      id: order._id?.toString(),
      _id: undefined,
      __v: undefined,
    })),
    reviews,
  });
});

export const toggleAdminUserBan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  assertObjectId(id);

  const user = await User.findOne({ _id: id, ...customerRoleFilter });

  if (!user) {
    throw new AppError("Customer not found", 404);
  }

  user.isBanned = !user.isBanned;
  await user.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: user.isBanned ? "Customer banned successfully." : "Customer unbanned successfully.",
    user: sanitizeUser(user),
  });
});
