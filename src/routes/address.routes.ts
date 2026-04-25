import express from "express";
import { protect } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import { createAddressSchema, updateAddressSchema } from "../schemas/address.schema";
import {
  createAddress,
  deleteAddress,
  getAddressById,
  getAddresses,
  setDefaultAddress,
  updateAddress,
} from "../controllers/address.controller";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Addresses
 *   description: Manage saved shipping addresses for the logged-in user
 */

/**
 * @swagger
 * /api/v1/users/addresses:
 *   post:
 *     summary: Create a new address
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label, fullName, phone, addressLine1, city, state, zipCode, country]
 *             properties:
 *               label: { type: string, example: "Home" }
 *               fullName: { type: string, example: "Deep Sharma" }
 *               phone: { type: string, example: "9876543210" }
 *               addressLine1: { type: string, example: "12 MG Road" }
 *               addressLine2: { type: string, example: "Near Metro Station" }
 *               city: { type: string, example: "Bengaluru" }
 *               state: { type: string, example: "Karnataka" }
 *               zipCode: { type: string, example: "560001" }
 *               country: { type: string, example: "India" }
 *               isDefault: { type: boolean, example: true }
 *     responses:
 *       201: { description: Address created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 */
router.route("/").post(protect, validate(createAddressSchema), createAddress);

/**
 * @swagger
 * /api/v1/users/addresses:
 *   get:
 *     summary: List all addresses for the logged-in user
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of addresses (default first)
 *       401:
 *         description: Unauthorized
 */
router.route("/").get(protect, getAddresses);

/**
 * @swagger
 * /api/v1/users/addresses/{addressId}:
 *   get:
 *     summary: Get one address by id
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Address returned }
 *       400: { description: Invalid address id }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 *   patch:
 *     summary: Update an address (owner only)
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Any subset of address fields
 *     responses:
 *       200: { description: Updated address returned }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 *   delete:
 *     summary: Delete an address (owner only)
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 */
router
  .route("/:addressId")
  .get(protect, getAddressById)
  .patch(protect, validate(updateAddressSchema), updateAddress)
  .delete(protect, deleteAddress);

/**
 * @swagger
 * /api/v1/users/addresses/{addressId}/set-default:
 *   patch:
 *     summary: Set an address as default (owner only)
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated address returned }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 */
router.patch("/:addressId/set-default", protect, setDefaultAddress);

export default router;

