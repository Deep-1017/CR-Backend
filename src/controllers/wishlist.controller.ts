import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Wishlist from '../models/wishlist.model';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';

const requireAuthUserId = (req: Request): string => {
  const user = req.user as { id?: string } | undefined;
  if (!user?.id) {
    throw new AppError('Unauthorized', 401);
  }
  return user.id;
};

const assertObjectId = (id: string, resource: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${resource} id`, 400);
  }
};

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const wishlist = await Wishlist.findOne({ user: userId })
    .populate('items.product')
    .lean();

  res.json({
    success: true,
    wishlist: wishlist ?? { user: userId, items: [] },
  });
});

export const addWishlistItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const { productId, variantKey = '' } = req.body as { productId?: string; variantKey?: string };

  if (!productId) {
    throw new AppError('productId is required', 400);
  }
  assertObjectId(productId, 'product');

  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    {
      $addToSet: {
        items: {
          product: new mongoose.Types.ObjectId(productId),
          variantKey,
          addedAt: new Date(),
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .populate('items.product')
    .lean();

  res.status(201).json({ success: true, wishlist });
});

export const removeWishlistItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const { productId } = req.params;

  assertObjectId(productId, 'product');

  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $pull: { items: { product: new mongoose.Types.ObjectId(productId) } } },
    { new: true }
  )
    .populate('items.product')
    .lean();

  res.json({ success: true, wishlist: wishlist ?? { user: userId, items: [] } });
});
