import express from "express";
import { protect, admin } from "../middleware/auth.middleware";
import {
  getAdminUsers,
  getAdminUserById,
  toggleAdminUserBan,
} from "../controllers/adminUser.controller";

const router = express.Router();

router.use(protect, admin);

router.get("/", getAdminUsers);
router.get("/:id", getAdminUserById);
router.patch("/:id/ban", toggleAdminUserBan);

export default router;
