import express from 'express';
import {
    addOrderItems, getOrders, getOrderById, updateOrderStatus, deleteOrder
} from '../controllers/order.controller';
import { protect, admin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { addOrderSchema, updateOrderStatusSchema } from '../schemas';

const router = express.Router();

router.route('/')
    .post(protect, validate(addOrderSchema), addOrderItems)        // any logged-in user can place an order
    .get(protect, admin, getOrders);                               // admin only — list all orders

router.route('/:id')
    .get(protect, getOrderById)                                    // logged-in user (ownership check in controller)
    .put(protect, admin, validate(updateOrderStatusSchema), updateOrderStatus) // admin only
    .delete(protect, admin, deleteOrder);                          // admin only

export default router;
