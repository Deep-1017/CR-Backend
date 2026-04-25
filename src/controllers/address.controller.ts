import { Request, Response } from "express";
import mongoose from "mongoose";
import Address from "../models/Address";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";

const assertObjectId = (id: string, resourceName: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${resourceName} id`, 400);
  }
};

const requireAuthUserId = (req: Request): string => {
  const user = req.user as { id?: string } | undefined;
  if (!user?.id) throw new AppError("Unauthorized", 401);
  return user.id;
};

type MaybeSession = mongoose.ClientSession | null;

const withOptionalTransaction = async <T>(
  fn: (session: MaybeSession) => Promise<T>
): Promise<T> => {
  let session: MaybeSession = null;
  try {
    session = await mongoose.startSession();
  } catch {
    session = null;
  }

  if (!session) {
    return await fn(null);
  }

  try {
    return await session.withTransaction(async () => await fn(session));
  } catch (error) {
    // Local Mongo instances often run without replica sets; transactions then throw.
    // Fall back to non-transactional flow so dev environments still work.
    const message = error instanceof Error ? error.message : "";
    const isTransactionUnsupported =
      message.includes("Transaction numbers are only allowed") ||
      message.includes("replica set") ||
      message.includes("mongos");
    if (isTransactionUnsupported) {
      return await fn(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export const createAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const created = await withOptionalTransaction(async (session) => {
    if (req.body.isDefault === true) {
      await Address.updateMany(
        { userId, isDefault: true },
        { $set: { isDefault: false } },
        session ? { session } : undefined
      );
    }

    const [doc] = await Address.create(
      [{ ...req.body, userId }],
      session ? { session } : undefined
    );
    return doc;
  });

  res.status(201).json(created);
});

export const getAddresses = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);

  const addresses = await Address.find({ userId })
    .sort({ isDefault: -1, createdAt: -1 })
    .select("_id label fullName phone addressLine1 addressLine2 city state zipCode country isDefault createdAt updatedAt");

  res.json(addresses);
});

export const getDefaultAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);

  const projection =
    "_id label fullName phone addressLine1 addressLine2 city state zipCode country";

  const defaultAddress = await Address.findOne({ userId, isDefault: true })
    .sort({ createdAt: -1 })
    .select(projection)
    .lean();

  if (defaultAddress) {
    res.json(defaultAddress);
    return;
  }

  const mostRecent = await Address.findOne({ userId })
    .sort({ createdAt: -1 })
    .select(projection)
    .lean();

  if (!mostRecent) {
    throw new AppError("No address saved", 404);
  }

  res.json(mostRecent);
});

export const getAddressById = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const { addressId } = req.params;

  assertObjectId(addressId, "address");

  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) throw new AppError("Address not found", 404);

  res.json(address);
});

export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const { addressId } = req.params;

  assertObjectId(addressId, "address");

  const updated = await withOptionalTransaction(async (session) => {
    const existingQuery = Address.findOne({ _id: addressId, userId });
    const existing = session ? await existingQuery.session(session) : await existingQuery;
    if (!existing) throw new AppError("Address not found", 404);

    if (req.body.isDefault === true) {
      await Address.updateMany(
        { userId, _id: { $ne: addressId }, isDefault: true },
        { $set: { isDefault: false } },
        session ? { session } : undefined
      );
    }

    const updateQuery = Address.findOneAndUpdate(
      { _id: addressId, userId },
      { $set: req.body },
      session ? { new: true, runValidators: true, session } : { new: true, runValidators: true }
    );
    return await updateQuery;
  });

  res.json(updated);
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const { addressId } = req.params;

  assertObjectId(addressId, "address");

  await withOptionalTransaction(async (session) => {
    const addressQuery = Address.findOne({ _id: addressId, userId });
    const address = session ? await addressQuery.session(session) : await addressQuery;
    if (!address) throw new AppError("Address not found", 404);

    const wasDefault = address.isDefault === true;
    await Address.deleteOne(
      { _id: addressId, userId },
      session ? { session } : undefined
    );

    if (wasDefault) {
      const mostRecentQuery = Address.findOne({ userId }).sort({ createdAt: -1 });
      const mostRecent = session ? await mostRecentQuery.session(session) : await mostRecentQuery;

      if (mostRecent) {
        await Address.updateMany(
          { userId, isDefault: true },
          { $set: { isDefault: false } },
          session ? { session } : undefined
        );
        mostRecent.isDefault = true;
        await mostRecent.save(session ? { session } : undefined);
      }
    }
  });

  res.status(200).json({ message: "Address deleted" });
});

export const setDefaultAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthUserId(req);
  const { addressId } = req.params;

  assertObjectId(addressId, "address");

  const updated = await withOptionalTransaction(async (session) => {
    const existingQuery = Address.findOne({ _id: addressId, userId });
    const existing = session ? await existingQuery.session(session) : await existingQuery;
    if (!existing) throw new AppError("Address not found", 404);

    await Address.updateMany(
      { userId, _id: { $ne: addressId }, isDefault: true },
      { $set: { isDefault: false } },
      session ? { session } : undefined
    );

    const updateQuery = Address.findOneAndUpdate(
      { _id: addressId, userId },
      { $set: { isDefault: true } },
      session ? { new: true, runValidators: true, session } : { new: true, runValidators: true }
    );
    return await updateQuery;
  });

  res.json(updated);
});

