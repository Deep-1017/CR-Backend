import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { addWishlistItem, getWishlist, removeWishlistItem } from '../controllers/wishlist.controller';

const router = Router();

router.use(protect);

router.get('/', getWishlist);
router.post('/', addWishlistItem);
router.delete('/:productId', removeWishlistItem);

export default router;
