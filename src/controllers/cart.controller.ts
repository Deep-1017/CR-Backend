import { Request, Response } from 'express';
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';
import Cart from '../models/cart.model';

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

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);

  const cart = await Cart.findOne({ user: userId }).populate('items.product').lean();

  res.json({
    success: true,
    cart: cart ?? { user: userId, items: [] },
  });
});

export const upsertCartItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const { productId, variantKey = '', quantity } = req.body as {
    productId?: string;
    variantKey?: string;
    quantity?: number;
  };

  if (!productId) {
    throw new AppError('productId is required', 400);
  }
  assertObjectId(productId, 'product');

  const qty = Number(quantity);
  if (!Number.isFinite(qty)) {
    throw new AppError('quantity is required', 400);
  }

  const productObjectId = new mongoose.Types.ObjectId(productId);

  // quantity <= 0 acts as "remove"
  if (qty <= 0) {
    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $pull: { items: { product: productObjectId, variantKey } } },
      { new: true }
    )
      .populate('items.product')
      .lean();

    res.json({ success: true, cart: cart ?? { user: userId, items: [] } });
    return;
  }

  // Try update existing item first
  const updated = await Cart.findOneAndUpdate(
    { user: userId, items: { $elemMatch: { product: productObjectId, variantKey } } },
    { $set: { 'items.$.quantity': qty } },
    { new: true }
  )
    .populate('items.product')
    .lean();

  if (updated) {
    res.status(200).json({ success: true, cart: updated });
    return;
  }

  // Otherwise push a new item (and upsert cart document)
  const createdOrPushed = await Cart.findOneAndUpdate(
    { user: userId },
    {
      $push: {
        items: {
          product: productObjectId,
          variantKey,
          quantity: qty,
          addedAt: new Date(),
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .populate('items.product')
    .lean();

  res.status(201).json({ success: true, cart: createdOrPushed });
});

export const removeCartItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const { productId } = req.params as { productId: string };
  const variantKey =
    typeof req.query.variantKey === 'string' ? (req.query.variantKey as string) : '';

  assertObjectId(productId, 'product');
  const productObjectId = new mongoose.Types.ObjectId(productId);

  const pullCondition = variantKey
    ? { product: productObjectId, variantKey }
    : { product: productObjectId };

  const cart = await Cart.findOneAndUpdate(
    { user: userId },
    { $pull: { items: pullCondition } },
    { new: true }
  )
    .populate('items.product')
    .lean();

  res.json({ success: true, cart: cart ?? { user: userId, items: [] } });
});

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);

  const cart = await Cart.findOneAndUpdate(
    { user: userId },
    { $set: { items: [] } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .populate('items.product')
    .lean();

  res.json({ success: true, cart });
});

