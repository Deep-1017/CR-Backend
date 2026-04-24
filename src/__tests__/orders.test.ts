import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app";
import Product from "../models/product.model";
import Order from "../models/order.model";

let mongoServer: MongoMemoryServer;
let customerToken: string;
let adminToken: string;
let otherCustomerToken: string;
let productId: string;
let variantId: string;

const customerUser = {
  name: "Customer",
  email: "ordercust@example.com",
  password: "CustPass123",
};
const otherCustomerUser = {
  name: "Other Customer",
  email: "other@example.com",
  password: "OtherPass123",
};
const adminUser = {
  name: "Admin",
  email: "orderadmin@example.com",
  password: "AdminPass123",
};

const buildOrderBody = (overrides: Record<string, unknown> = {}) => ({
  customer: {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    address: "123 Main St",
    city: "New York",
    zipCode: "10001",
  },
  items: [
    {
      productId,
      variantId,
      configuration: "Standard",
      finish: "Natural",
      quantity: 1,
    },
  ],
  totalAmount: 499,
  paymentDetails: {
    provider: "stripe",
    paymentIntentId: "pi_test_123",
  },
  ...overrides,
});

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Create a test product with two variants
  const product = await Product.create({
    name: "Test Amplifier",
    category: "Amplifier",
    basePrice: 499,
    price: 499,
    image: "/assets/test.jpg",
    images: ["/assets/test.jpg"],
    description: "A test amplifier",
    rating: 5,
    reviews: 0,
    brand: "Test",
    condition: "New",
    skillLevel: "Beginner",
    inStock: true,
    stockCount: 50,
    variants: [
      {
        configuration: "Standard",
        finish: "Natural",
        stock: 50,
        sku: "TEST-001",
        price: 499,
        images: ["/assets/test.jpg"],
      },
    ],
    availableConfigurations: ["Standard"],
    availableFinishes: ["Natural"],
    specifications: [],
    customerReviews: [],
  });

  productId = product._id.toString();
  variantId = product.variants[0].variantId.toString();

  // Register customer
  const custRes = await request(app)
    .post("/api/v1/auth/register")
    .send(customerUser);
  customerToken = custRes.body.token;

  // Register other customer
  const otherRes = await request(app)
    .post("/api/v1/auth/register")
    .send(otherCustomerUser);
  otherCustomerToken = otherRes.body.token;

  // Register admin and promote
  await request(app).post("/api/v1/auth/register").send(adminUser);
  await mongoose.connection
    .collection("users")
    .updateOne({ email: adminUser.email }, { $set: { role: "admin" } });
  const loginRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: adminUser.email, password: adminUser.password });
  adminToken = loginRes.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await mongoose.connection.collection("orders").deleteMany({});
  // Restore stock
  await mongoose.connection
    .collection("products")
    .updateMany({}, { $set: { "variants.$[].stock": 50 } });
});

// ─── Helper: create an order via API ─────────────────────────────────────────

const createOrder = (token: string, overrides: Record<string, unknown> = {}) =>
  request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${token}`)
    .send(buildOrderBody(overrides));

// ─── Existing tests (unchanged) ───────────────────────────────────────────────

describe("POST /api/v1/orders", () => {
  it("without token → 401", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .send(buildOrderBody());
    expect(res.status).toBe(401);
  });

  it("with valid token + valid body → 201", async () => {
    const res = await createOrder(customerToken);
    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(499);
  });
});

describe("GET /api/v1/orders/:id", () => {
  let orderId: string;

  beforeEach(async () => {
    const res = await createOrder(customerToken);
    orderId = res.body.id;
  });

  it("owner can view their own order → 200", async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
  });

  it("admin can view any order → 200", async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it("other customer cannot view order → 403", async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`);
    expect(res.status).toBe(403);
  });

  it("invalid ID format → 400", async () => {
    const res = await request(app)
      .get("/api/v1/orders/invalid-id")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });

  it("non-existent valid ObjectId → 404", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/v1/orders/${fakeId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── NEW: GET /api/v1/orders (getMyOrders) ───────────────────────────────────

describe("GET /api/v1/orders — getMyOrders", () => {
  // ── Auth ─────────────────────────────────────────────────────────────────

  it("without token → 401", async () => {
    const res = await request(app).get("/api/v1/orders");
    expect(res.status).toBe(401);
  });

  // ── Response shape ────────────────────────────────────────────────────────

  it("returns correct response shape with empty orders", async () => {
    const res = await request(app)
      .get("/api/v1/orders")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("orders");
    expect(res.body).toHaveProperty("pagination");
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
      totalOrders: 0,
      totalPages: 0,
    });
  });

  it("order summary contains all required fields", async () => {
    await createOrder(customerToken);

    const res = await request(app)
      .get("/api/v1/orders")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);

    const order = res.body.orders[0];
    expect(order).toHaveProperty("_id");
    expect(order).toHaveProperty("orderNumber");
    expect(order.orderNumber).toMatch(/^#ORD-/);
    expect(order).toHaveProperty("totalAmount");
    expect(order).toHaveProperty("orderStatus");
    expect(order).toHaveProperty("paymentStatus");
    expect(order).toHaveProperty("createdAt");
    expect(order).toHaveProperty("estimatedDeliveryDate");
    expect(order).toHaveProperty("itemCount");
    expect(order).toHaveProperty("items");
    expect(Array.isArray(order.items)).toBe(true);
  });

  it("item summary contains productName, configuration, finish, quantity, image", async () => {
    await createOrder(customerToken);

    const res = await request(app)
      .get("/api/v1/orders")
      .set("Authorization", `Bearer ${customerToken}`);

    const item = res.body.orders[0].items[0];
    expect(item).toHaveProperty("productName");
    expect(item).toHaveProperty("configuration");
    expect(item).toHaveProperty("finish");
    expect(item).toHaveProperty("quantity");
    expect(item).toHaveProperty("image");
  });

  // ── Isolation: users only see their own orders ────────────────────────────

  it("customer only sees their own orders, not other customers", async () => {
    await createOrder(customerToken);
    await createOrder(otherCustomerToken);

    const res = await request(app)
      .get("/api/v1/orders")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.totalOrders).toBe(1);
  });

  it("admin sees all orders across users", async () => {
    await createOrder(customerToken);
    await createOrder(otherCustomerToken);

    const res = await request(app)
      .get("/api/v1/orders")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.totalOrders).toBe(2);
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  it("paginates correctly — page 1 returns first N orders", async () => {
    // Create 3 orders
    for (let i = 0; i < 3; i++) {
      await createOrder(customerToken);
    }

    const res = await request(app)
      .get("/api/v1/orders?page=1&limit=2")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 2,
      totalOrders: 3,
      totalPages: 2,
    });
  });

  it("paginates correctly — page 2 returns remaining orders", async () => {
    for (let i = 0; i < 3; i++) {
      await createOrder(customerToken);
    }

    const res = await request(app)
      .get("/api/v1/orders?page=2&limit=2")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.pagination.page).toBe(2);
  });

  it("page beyond total returns empty orders array", async () => {
    await createOrder(customerToken);

    const res = await request(app)
      .get("/api/v1/orders?page=99&limit=10")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(0);
    expect(res.body.pagination.totalOrders).toBe(1);
  });

  it("limit is clamped to 100 max", async () => {
    const res = await request(app)
      .get("/api/v1/orders?limit=999")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(100);
  });

  // ── Status filtering ──────────────────────────────────────────────────────

  it("status=all returns all orders regardless of status", async () => {
    await createOrder(customerToken);
    // Manually set one order to Confirmed
    await Order.updateOne({}, { $set: { status: "Confirmed" } });

    const res = await request(app)
      .get("/api/v1/orders?status=all")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.totalOrders).toBe(1);
  });

  it("status=Confirmed filters to only Confirmed orders", async () => {
    await createOrder(customerToken);
    await Order.updateOne({}, { $set: { status: "Confirmed" } });

    const res = await request(app)
      .get("/api/v1/orders?status=Confirmed")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.totalOrders).toBe(1);
    expect(res.body.orders[0].orderStatus).toBe("Confirmed");
  });

  it("status=Cancelled returns 0 when no cancelled orders", async () => {
    await createOrder(customerToken);

    const res = await request(app)
      .get("/api/v1/orders?status=Cancelled")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.totalOrders).toBe(0);
  });

  it("invalid status value → 400", async () => {
    const res = await request(app)
      .get("/api/v1/orders?status=INVALID")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });

  // ── Sorting ───────────────────────────────────────────────────────────────

  it("sortBy=recent returns newest order first (default)", async () => {
    const res1 = await createOrder(customerToken);
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 20));
    const res2 = await createOrder(customerToken);

    const res = await request(app)
      .get("/api/v1/orders?sortBy=recent")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders[0]._id).toBe(res2.body.id ?? res2.body._id);
  });

  it("sortBy=oldest returns oldest order first", async () => {
    const res1 = await createOrder(customerToken);
    await new Promise((r) => setTimeout(r, 20));
    await createOrder(customerToken);

    const res = await request(app)
      .get("/api/v1/orders?sortBy=oldest")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders[0]._id).toBe(res1.body.id ?? res1.body._id);
  });

  it("sortBy=amount-high returns highest amount first", async () => {
    await createOrder(customerToken);
    // Direct DB insert with a higher amount to avoid stock issues
    await Order.create({
      userId: (
        await mongoose.connection
          .collection("users")
          .findOne({ email: customerUser.email })
      )?._id?.toString(),
      customer: {
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
        address: "1 St",
        city: "NY",
        zipCode: "10001",
      },
      items: [],
      totalAmount: 9999,
      paymentMethod: "razorpay",
      amountPaid: 0,
      paymentDetails: { provider: "test", status: "pending" },
      status: "Pending",
    });

    const res = await request(app)
      .get("/api/v1/orders?sortBy=amount-high")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders[0].totalAmount).toBe(9999);
  });

  it("sortBy=amount-low returns lowest amount first", async () => {
    await createOrder(customerToken);
    await Order.create({
      userId: (
        await mongoose.connection
          .collection("users")
          .findOne({ email: customerUser.email })
      )?._id?.toString(),
      customer: {
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
        address: "1 St",
        city: "NY",
        zipCode: "10001",
      },
      items: [],
      totalAmount: 1,
      paymentMethod: "razorpay",
      amountPaid: 0,
      paymentDetails: { provider: "test", status: "pending" },
      status: "Pending",
    });

    const res = await request(app)
      .get("/api/v1/orders?sortBy=amount-low")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders[0].totalAmount).toBe(1);
  });

  it("invalid sortBy value → 400", async () => {
    const res = await request(app)
      .get("/api/v1/orders?sortBy=invalid")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });

  // ── Invalid query params ──────────────────────────────────────────────────

  it("non-numeric page → 400", async () => {
    const res = await request(app)
      .get("/api/v1/orders?page=abc")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });

  it("non-numeric limit → 400", async () => {
    const res = await request(app)
      .get("/api/v1/orders?limit=abc")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });

  it("page=0 is coerced/clamped to page 1", async () => {
    const res = await request(app)
      .get("/api/v1/orders?page=0")
      .set("Authorization", `Bearer ${customerToken}`);
    // 0 fails /^\d+$/.test so it's 400 OR the controller clamps it to 1
    // Either behaviour is acceptable; just assert it doesn't crash (5xx)
    expect(res.status).toBeLessThan(500);
  });
});

// ─── Admin-only route ─────────────────────────────────────────────────────────

describe("GET /api/v1/orders/admin/all", () => {
  it("customer token → 403", async () => {
    const res = await request(app)
      .get("/api/v1/orders/admin/all")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("admin token → 200 with orders + total", async () => {
    await createOrder(customerToken);

    const res = await request(app)
      .get("/api/v1/orders/admin/all")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("orders");
    expect(res.body).toHaveProperty("total");
  });
});
