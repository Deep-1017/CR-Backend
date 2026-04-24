import { z } from "zod";

// ─── Existing schemas (unchanged) ────────────────────────────────────────────

export const addOrderSchema = z.object({
  userId: z.string().optional(),
  customer: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().optional(),
    zipCode: z.string().min(1, "Zip code is required"),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product ID is required"),
        variantId: z.string().min(1, "Variant ID is required"),
        name: z.string().optional(),
        configuration: z.string().min(1, "Configuration is required"),
        finish: z.string().min(1, "Finish is required"),
        quantity: z
          .number()
          .int()
          .positive("Quantity must be a positive integer"),
        priceAtPurchase: z.number().nonnegative().optional(),
        price: z.number().nonnegative().optional(),
        sku: z.string().optional(),
        image: z.string().optional(),
      }),
    )
    .min(1, "At least one item is required"),
  totalAmount: z
    .number()
    .nonnegative("Total amount must be a non-negative number"),
  paymentId: z.string().optional(),
  paymentStatus: z.enum(["pending", "success", "failed"]).default("pending"),
  transactionId: z.string().optional(),
  paymentMethod: z.enum(["razorpay", "upi", "card"]).optional(),
  amountPaid: z.number().nonnegative().default(0),
  paymentDetails: z.object({
    provider: z.string().min(1, "Payment provider is required"),
    paymentIntentId: z.string().optional(),
    razorpayOrderId: z.string().optional(),
    status: z
      .enum(["pending", "paid", "failed", "refunded"])
      .default("pending"),
  }),
  status: z
    .enum(["Pending", "Processing", "Confirmed", "Completed", "Cancelled"])
    .default("Pending"),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "Pending",
    "Processing",
    "Confirmed",
    "Completed",
    "Cancelled",
  ]),
});

// ─── NEW: Query params schema for GET /api/orders (user) ─────────────────────

export const getMyOrdersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .refine((v) => /^\d+$/.test(v ?? ""), {
      message: "page must be a positive integer",
    })
    .transform(Number),

  limit: z
    .string()
    .optional()
    .default("10")
    .refine((v) => /^\d+$/.test(v ?? ""), {
      message: "limit must be a positive integer",
    })
    .transform(Number),

  status: z
    .enum([
      "all",
      "Pending",
      "Processing",
      "Confirmed",
      "Completed",
      "Cancelled",
    ])
    .optional()
    .default("all"),

  sortBy: z
    .enum(["recent", "oldest", "amount-high", "amount-low"])
    .optional()
    .default("recent"),
});

export type GetMyOrdersQuery = z.infer<typeof getMyOrdersQuerySchema>;
export type AddOrderInput = z.infer<typeof addOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
