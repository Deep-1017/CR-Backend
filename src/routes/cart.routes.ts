import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { clearCart, getCart, removeCartItem, upsertCartItem } from '../controllers/cart.controller';

const router = Router();

router.use(protect);

router.get('/', getCart);
router.post('/', upsertCartItem);
router.delete('/', clearCart);
router.delete('/:productId', removeCartItem);

export default router;

