import { Request, Response } from 'express';
import Order from '../models/order.model';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';

export const addOrderItems = asyncHandler(async (req: Request, res: Response) => {
    const order = await Order.create(req.body);
    res.status(201).json(order);
});

export const getOrders = asyncHandler(async (_req: Request, res: Response) => {
    const page = Math.max(1, Number(_req.query.page) || 1);
    const limit = Math.min(100, Number(_req.query.limit) || 20);
    const [orders, total] = await Promise.all([
        Order.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        Order.countDocuments({}),
    ]);
    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
});

export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError('Order not found', 404);
    // Ownership check — allow admin or the order's own customer email
    const user = req.user;
    if (user?.role !== 'admin' && order.customer.email !== user?.email) {
        throw new AppError('Not authorised to view this order', 403);
    }
    res.json(order);
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const order = await Order.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true, runValidators: true }
    );
    if (!order) throw new AppError('Order not found', 404);
    res.json(order);
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) throw new AppError('Order not found', 404);
    res.json({ message: 'Order removed' });
});
