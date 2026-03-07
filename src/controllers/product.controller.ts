import { Request, Response } from 'express';
import Product from '../models/product.model';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const [products, total] = await Promise.all([
        Product.find({}).skip((page - 1) * limit).limit(limit),
        Product.countDocuments({}),
    ]);
    res.json({ products, total, page, pages: Math.ceil(total / limit) });
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError('Product not found', 404);
    res.json(product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.create(req.body);
    res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );
    if (!product) throw new AppError('Product not found', 404);
    res.json(product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw new AppError('Product not found', 404);
    res.json({ message: 'Product removed' });
});
