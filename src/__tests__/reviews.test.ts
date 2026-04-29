import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../app";
import User from "../models/User";
import Review from "../models/Review";
import Product from "../models/product.model";
import Order from "../models/order.model";

let replSet: MongoMemoryReplSet;

const signToken = (payload: { id: string; email: string; role: string }) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET missing in test env");
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
};

const makeAuthHeaderForUser = async (role: "user" | "admin" = "user") => {
  const user = await User.create({
    name: "Test User",
    email: `user${Date.now()}${Math.random().toString(36).slice(2)}@example.com`,
    password: "Password1",
    provider: "local",
    role,
  });
  const token = signToken({ id: user._id.toString(), email: user.email, role: user.role });
  return { user, token, authHeader: { Authorization: `Bearer ${token}` } };
};

const createTestProduct = async () => {
  return Product.create({
    name: "Test Amplifier",
    category: "Amplifier",
    basePrice: 15000,
    price: 15000,
    image: "https://example.com/amp.jpg",
    images: ["https://example.com/amp.jpg"],
    description: "A high-quality test amplifier for professional use",
    brand: "TestBrand",
    condition: "New",
    skillLevel: "Professional",
    inStock: true,
    stockCount: 10,
    variants: [],
    availableConfigurations: [],
    availableFinishes: [],
    specifications: [],
    customerReviews: [],
  });
};

const VALID_REVIEW = {
  rating: 5,
  title: "Excellent build quality and sound!",
  comment: "This amplifier exceeded all my expectations. Crystal clear output and rock solid construction.",
  images: [],
};

const API_BASE = "/api/v1/products";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.connection.close();
  await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Review.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
  ]);
});

// ─── POST /api/v1/products/:productId/reviews ────────────────────────────────

describe("POST /api/v1/products/:productId/reviews", () => {
  test("creates a review with status 'pending' and returns 201", async () => {
    const { authHeader } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    const res = await request(app)
      .post(`${API_BASE}/${product._id}/reviews`)
      .set(authHeader)
      .send(VALID_REVIEW)
      .expect(201);

    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("review");
    expect(res.body.review).toMatchObject({
      rating: VALID_REVIEW.rating,
      title: VALID_REVIEW.title,
      comment: VALID_REVIEW.comment,
      status: "pending",
    });
    expect(res.body.review).toHaveProperty("_id");
    expect(res.body.review).toHaveProperty("productId");
    expect(res.body.review).toHaveProperty("userId");
  });

  test("returns 404 if product does not exist", async () => {
    const { authHeader } = await makeAuthHeaderForUser();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`${API_BASE}/${fakeId}/reviews`)
      .set(authHeader)
      .send(VALID_REVIEW)
      .expect(404);

    expect(res.body).toHaveProperty("success", false);
    expect(res.body.message).toMatch(/not found/i);
  });

  test("returns 409 if user already reviewed this product", async () => {
    const { user, authHeader } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    // Create first review directly
    await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    const res = await request(app)
      .post(`${API_BASE}/${product._id}/reviews`)
      .set(authHeader)
      .send(VALID_REVIEW)
      .expect(409);

    expect(res.body).toHaveProperty("success", false);
    expect(res.body.message).toMatch(/already reviewed/i);
  });

  test("returns 401 if no auth token", async () => {
    const product = await createTestProduct();

    await request(app)
      .post(`${API_BASE}/${product._id}/reviews`)
      .send(VALID_REVIEW)
      .expect(401);
  });

  test("returns 400 for invalid body (short title)", async () => {
    const { authHeader } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    const res = await request(app)
      .post(`${API_BASE}/${product._id}/reviews`)
      .set(authHeader)
      .send({
        rating: 5,
        title: "Short",
        comment: "This comment is long enough to pass validation for the review.",
      })
      .expect(400);

    expect(res.body).toHaveProperty("success", false);
  });

  test("returns 400 for rating outside 1-5 range", async () => {
    const { authHeader } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    await request(app)
      .post(`${API_BASE}/${product._id}/reviews`)
      .set(authHeader)
      .send({ ...VALID_REVIEW, rating: 0 })
      .expect(400);

    await request(app)
      .post(`${API_BASE}/${product._id}/reviews`)
      .set(authHeader)
      .send({ ...VALID_REVIEW, rating: 6 })
      .expect(400);
  });

  test("sets isVerifiedPurchase to true when user has a completed order", async () => {
    const { user, authHeader } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    // Create a completed order for this user
    await Order.create({
      userId: user._id.toString(),
      customer: {
        firstName: "Test",
        lastName: "User",
        email: user.email,
        address: "123 Main St",
        city: "Bengaluru",
        zipCode: "560001",
      },
      items: [
        {
          productId: product._id,
          variantId: new mongoose.Types.ObjectId(),
          name: "Test Amplifier",
          configuration: "Standard",
          finish: "Black",
          quantity: 1,
          priceAtPurchase: 15000,
          price: 15000,
          sku: "GTR-TEST-001",
          image: "https://example.com/amp.jpg",
        },
      ],
      totalAmount: 15000,
      paymentStatus: "success",
      paymentMethod: "razorpay",
      amountPaid: 15000,
      paymentDetails: {
        provider: "razorpay",
        status: "paid",
      },
      status: "Completed",
    });

    const res = await request(app)
      .post(`${API_BASE}/${product._id}/reviews`)
      .set(authHeader)
      .send(VALID_REVIEW)
      .expect(201);

    expect(res.body.review.isVerifiedPurchase).toBe(true);
  });
});

// ─── GET /api/v1/products/:productId/reviews ─────────────────────────────────

describe("GET /api/v1/products/:productId/reviews", () => {
  test("returns only approved reviews (public, no auth)", async () => {
    const { user } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    // Create two reviews: one approved, one pending
    await Review.create({
      productId: product._id,
      userId: user._id,
      rating: 5,
      title: "Approved review title here",
      comment: "This is an approved review that should be visible to the public.",
      status: "approved",
    });

    const user2 = await User.create({
      name: "User 2",
      email: `user2${Date.now()}@example.com`,
      password: "Password1",
      provider: "local",
      role: "user",
    });

    await Review.create({
      productId: product._id,
      userId: user2._id,
      rating: 3,
      title: "Pending review title here",
      comment: "This is a pending review that should NOT be visible publicly.",
      status: "pending",
    });

    const res = await request(app)
      .get(`${API_BASE}/${product._id}/reviews`)
      .expect(200);

    expect(res.body).toHaveProperty("success", true);
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0].status).toBe("approved");
  });

  test("returns pagination info and aggregated stats", async () => {
    const product = await createTestProduct();

    // Create several approved reviews
    const users = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        User.create({
          name: `User ${i}`,
          email: `stats${i}${Date.now()}@example.com`,
          password: "Password1",
          provider: "local",
          role: "user",
        })
      )
    );

    await Promise.all(
      users.map((user, i) =>
        Review.create({
          productId: product._id,
          userId: user._id,
          rating: i + 3, // ratings 3, 4, 5
          title: `Review by user ${i} is great`,
          comment: `This is a detailed review comment by user number ${i} for testing purposes.`,
          status: "approved",
        })
      )
    );

    const res = await request(app)
      .get(`${API_BASE}/${product._id}/reviews`)
      .expect(200);

    expect(res.body.pagination).toMatchObject({
      currentPage: 1,
      totalCount: 3,
      hasNextPage: false,
      hasPrevPage: false,
    });

    expect(res.body.aggregatedStats).toHaveProperty("average");
    expect(res.body.aggregatedStats).toHaveProperty("total", 3);
    expect(res.body.aggregatedStats).toHaveProperty("distribution");
    expect(res.body.aggregatedStats.distribution).toMatchObject({
      "1": 0,
      "2": 0,
      "3": 1,
      "4": 1,
      "5": 1,
    });
  });

  test("filters by rating", async () => {
    const product = await createTestProduct();

    const [u1, u2] = await Promise.all([
      User.create({ name: "A", email: `fa${Date.now()}@example.com`, password: "Password1", provider: "local", role: "user" }),
      User.create({ name: "B", email: `fb${Date.now()}@example.com`, password: "Password1", provider: "local", role: "user" }),
    ]);

    await Review.create({ productId: product._id, userId: u1._id, rating: 5, title: "Five star review great", comment: "This is a five star review for testing filter purposes.", status: "approved" });
    await Review.create({ productId: product._id, userId: u2._id, rating: 3, title: "Three star review okay", comment: "This is a three star review for testing filter purposes.", status: "approved" });

    const res = await request(app)
      .get(`${API_BASE}/${product._id}/reviews?rating=5`)
      .expect(200);

    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0].rating).toBe(5);

    // Aggregated stats should still reflect ALL approved reviews
    expect(res.body.aggregatedStats.total).toBe(2);
  });

  test("paginates results", async () => {
    const product = await createTestProduct();

    const users = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        User.create({ name: `P${i}`, email: `p${i}${Date.now()}@example.com`, password: "Password1", provider: "local", role: "user" })
      )
    );

    await Promise.all(
      users.map((user, i) =>
        Review.create({
          productId: product._id,
          userId: user._id,
          rating: (i % 5) + 1,
          title: `Paginated review number ${i} title`,
          comment: `This is a sufficiently long review comment number ${i} for pagination testing.`,
          status: "approved",
        })
      )
    );

    const page1 = await request(app)
      .get(`${API_BASE}/${product._id}/reviews?page=1&limit=2`)
      .expect(200);

    expect(page1.body.reviews).toHaveLength(2);
    expect(page1.body.pagination).toMatchObject({
      currentPage: 1,
      totalPages: 3,
      totalCount: 5,
      limit: 2,
      hasNextPage: true,
      hasPrevPage: false,
    });

    const page2 = await request(app)
      .get(`${API_BASE}/${product._id}/reviews?page=2&limit=2`)
      .expect(200);

    expect(page2.body.reviews).toHaveLength(2);
    expect(page2.body.pagination.hasPrevPage).toBe(true);
  });
});

// ─── GET /api/v1/products/:productId/reviews/:reviewId ───────────────────────

describe("GET /api/v1/products/:productId/reviews/:reviewId", () => {
  test("returns a single approved review", async () => {
    const { user } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "approved",
    });

    const res = await request(app)
      .get(`${API_BASE}/${product._id}/reviews/${review._id}`)
      .expect(200);

    expect(res.body).toHaveProperty("success", true);
    expect(res.body.review).toHaveProperty("_id");
    expect(res.body.review.rating).toBe(VALID_REVIEW.rating);
  });

  test("returns 404 for a pending review (not visible publicly)", async () => {
    const { user } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    await request(app)
      .get(`${API_BASE}/${product._id}/reviews/${review._id}`)
      .expect(404);
  });

  test("returns 404 for non-existent review", async () => {
    const product = await createTestProduct();
    const fakeId = new mongoose.Types.ObjectId();

    await request(app)
      .get(`${API_BASE}/${product._id}/reviews/${fakeId}`)
      .expect(404);
  });
});

// ─── PATCH /api/v1/products/:productId/reviews/:reviewId ─────────────────────

describe("PATCH /api/v1/products/:productId/reviews/:reviewId", () => {
  test("author can update their pending review", async () => {
    const { user, authHeader } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    const res = await request(app)
      .patch(`${API_BASE}/${product._id}/reviews/${review._id}`)
      .set(authHeader)
      .send({ rating: 4 })
      .expect(200);

    expect(res.body).toHaveProperty("success", true);
    expect(res.body.review.rating).toBe(4);
    expect(res.body.review.status).toBe("pending");
  });

  test("returns 409 when non-admin tries to edit an approved review", async () => {
    const { user, authHeader } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "approved",
    });

    const res = await request(app)
      .patch(`${API_BASE}/${product._id}/reviews/${review._id}`)
      .set(authHeader)
      .send({ rating: 3 })
      .expect(409);

    expect(res.body).toHaveProperty("success", false);
  });

  test("admin can edit an approved review", async () => {
    const { user } = await makeAuthHeaderForUser();
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "approved",
    });

    const res = await request(app)
      .patch(`${API_BASE}/${product._id}/reviews/${review._id}`)
      .set(adminHeader)
      .send({ rating: 2 })
      .expect(200);

    expect(res.body.review.rating).toBe(2);
  });

  test("returns 403 if user is not the review author", async () => {
    const { user } = await makeAuthHeaderForUser();
    const { authHeader: otherHeader } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    await request(app)
      .patch(`${API_BASE}/${product._id}/reviews/${review._id}`)
      .set(otherHeader)
      .send({ rating: 1 })
      .expect(403);
  });
});

// ─── DELETE /api/v1/products/:productId/reviews/:reviewId ────────────────────

describe("DELETE /api/v1/products/:productId/reviews/:reviewId", () => {
  test("author can delete their own review", async () => {
    const { user, authHeader } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    const res = await request(app)
      .delete(`${API_BASE}/${product._id}/reviews/${review._id}`)
      .set(authHeader)
      .expect(200);

    expect(res.body).toHaveProperty("success", true);

    // Verify it's gone
    const deleted = await Review.findById(review._id);
    expect(deleted).toBeNull();
  });

  test("admin can delete any review", async () => {
    const { user } = await makeAuthHeaderForUser();
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "approved",
    });

    await request(app)
      .delete(`${API_BASE}/${product._id}/reviews/${review._id}`)
      .set(adminHeader)
      .expect(200);
  });

  test("returns 403 if user is not the author", async () => {
    const { user } = await makeAuthHeaderForUser();
    const { authHeader: otherHeader } = await makeAuthHeaderForUser();
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    await request(app)
      .delete(`${API_BASE}/${product._id}/reviews/${review._id}`)
      .set(otherHeader)
      .expect(403);
  });

  test("returns 404 for non-existent review", async () => {
    const { authHeader } = await makeAuthHeaderForUser();
    const product = await createTestProduct();
    const fakeId = new mongoose.Types.ObjectId();

    await request(app)
      .delete(`${API_BASE}/${product._id}/reviews/${fakeId}`)
      .set(authHeader)
      .expect(404);
  });
});
