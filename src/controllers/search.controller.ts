import { Request, Response } from 'express';
import Product from '../models/product.model';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/appError';

/**
 * GET /api/v1/products/search?q=&category=&brand=&minPrice=&maxPrice=&page=&limit=
 *
 * Full-text search across name, description, and brand fields.
 * Results are ranked by MongoDB textScore. Additional query-param
 * filters can narrow down the results.
 */
export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
        throw new AppError('Search query "q" is required', 400);
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter object starting with $text search
    const filter: Record<string, unknown> = {
        $text: { $search: q },
    };

    // Optional category filter
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    if (category) {
        filter.category = category;
    }

    // Optional brand filter
    const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
    if (brand) {
        filter.brand = brand;
    }

    // Optional price range filter
    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);
    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
        const priceFilter: Record<string, number> = {};
        if (Number.isFinite(minPrice)) priceFilter.$gte = minPrice;
        if (Number.isFinite(maxPrice)) priceFilter.$lte = maxPrice;
        filter.price = priceFilter;
    }

    const scoreProjection = { score: { $meta: 'textScore' as const } };

    const [products, total] = await Promise.all([
        Product.find(filter, scoreProjection)
            .sort({ score: { $meta: 'textScore' as const } })
            .skip(skip)
            .limit(limit)
            .lean(),
        Product.countDocuments(filter),
    ]);

    res.json({
        products,
        total,
        page,
        pages: Math.ceil(total / limit),
    });
});

/**
 * GET /api/v1/products/autocomplete?q=
 *
 * Returns the top 5 product names and IDs matching the query,
 * sorted by text relevance. Designed for lightweight, fast
 * typeahead suggestions.
 */
export const autocompleteProducts = asyncHandler(async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
        res.json({ suggestions: [] });
        return;
    }

    const scoreProjection = { score: { $meta: 'textScore' as const } };

    const suggestions = await Product.find(
        { $text: { $search: q } },
        { name: 1, _id: 1, image: 1, brand: 1, price: 1, ...scoreProjection },
    )
        .sort({ score: { $meta: 'textScore' as const } })
        .limit(5)
        .lean();

    res.json({
        suggestions: suggestions.map((product) => ({
            id: product._id.toString(),
            name: product.name,
            image: product.image,
            brand: product.brand,
            price: product.price,
        })),
    });
});
