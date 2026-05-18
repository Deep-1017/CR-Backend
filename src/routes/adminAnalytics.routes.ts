import express from "express";
import { admin, protect } from "../middleware/auth.middleware";
import {
  getCustomersAnalytics,
  getOrdersAnalytics,
  getRevenueAnalytics,
  getTopProductsAnalytics,
} from "../controllers/adminAnalytics.controller";

const router = express.Router();

router.get("/revenue", protect, admin, getRevenueAnalytics);
router.get("/orders", protect, admin, getOrdersAnalytics);
router.get("/top-products", protect, admin, getTopProductsAnalytics);
router.get("/customers", protect, admin, getCustomersAnalytics);

export default router;
