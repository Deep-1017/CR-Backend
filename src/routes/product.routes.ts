import express from 'express';
import {
    getProducts, getProductById, deleteProduct, createProduct, updateProduct
} from '../controllers/product.controller';
import { protect, admin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createProductSchema, updateProductSchema } from '../schemas';

const router = express.Router();

router.route('/')
    .get(getProducts)                                              // public — anyone can browse
    .post(protect, admin, validate(createProductSchema), createProduct); // admin only

router.route('/:id')
    .get(getProductById)                                           // public
    .put(protect, admin, validate(updateProductSchema), updateProduct)   // admin only
    .delete(protect, admin, deleteProduct);                        // admin only

export default router;
