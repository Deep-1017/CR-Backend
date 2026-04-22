import express from 'express';
import {
    getProducts,
    getProductById,
    deleteProduct,
    createProduct,
    updateProduct,
    getProductVariants,
    addProductVariant,
    updateProductVariant,
    deleteProductVariant,
} from '../controllers/product.controller';
import { protect, admin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
    createProductSchema,
    updateProductSchema,
    createProductVariantSchema,
    updateProductVariantSchema,
} from '../schemas';

const router = express.Router();

router.route('/')
    .get(getProducts)
    .post(protect, admin, validate(createProductSchema), createProduct);

router.route('/:productId/variants')
    .get(getProductVariants)
    .post(protect, admin, validate(createProductVariantSchema), addProductVariant);

router.route('/:productId/variants/:variantId')
    .patch(protect, admin, validate(updateProductVariantSchema), updateProductVariant)
    .delete(protect, admin, deleteProductVariant);

router.route('/:id')
    .get(getProductById)
    .put(protect, admin, validate(updateProductSchema), updateProduct)
    .delete(protect, admin, deleteProduct);

export default router;
