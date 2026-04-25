import express from "express";
import { sendShippedEmail } from "../controllers/order.controller";
import { admin, protect } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/:orderId/send-shipped-email", protect, admin, sendShippedEmail);

export default router;
