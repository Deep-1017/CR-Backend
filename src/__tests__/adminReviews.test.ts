import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../app";
import User from "../models/User";
import Review from "../models/Review";
import Product from "../models/product.model";

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
  comment:
    "This amplifier exceeded all my expectations. Crystal clear output and rock solid construction.",
  images: [],
};

const API_BASE = "/api/admin/reviews";

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
  ]);
});

// ─── Auth guard tests ────────────────────────────────────────────────────────

describe("Admin auth guard", () => {
  test("returns 401 if no auth token is provided", async () => {
    await request(app).get(API_BASE).expect(401);
  });

  test("returns 403 if user is not admin", async () => {
    const { authHeader } = await makeAuthHeaderForUser("user");

    await request(app)
      .get(API_BASE)
      .set(authHeader)
      .expect(403);
  });
});

// ─── GET /api/admin/reviews ──────────────────────────────────────────────────

describe("GET /api/admin/reviews", () => {
  test("returns paginated reviews with product and user data", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    const res = await request(app)
      .get(API_BASE)
      .set(adminHeader)
      .expect(200);

    expect(res.body).toHaveProperty("success", true);
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({
      currentPage: 1,
      totalCount: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });

    // Should populate user and product data
    const review = res.body.reviews[0];
    expect(review).toHaveProperty("userId");
    expect(review).toHaveProperty("productId");
  });

  test("filters by status=pending", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const product = await createTestProduct();

    const [u1, u2] = await Promise.all([
      User.create({
        name: "U1",
        email: `u1${Date.now()}@example.com`,
        password: "Password1",
        provider: "local",
        role: "user",
      }),
      User.create({
        name: "U2",
        email: `u2${Date.now()}@example.com`,
        password: "Password1",
        provider: "local",
        role: "user",
      }),
    ]);

    await Review.create({
      productId: product._id,
      userId: u1._id,
      ...VALID_REVIEW,
      status: "pending",
    });
    await Review.create({
      productId: product._id,
      userId: u2._id,
      rating: 4,
      title: "Another great product here!",
      comment: "Solid construction and amazing sound quality for the price.",
      status: "approved",
    });

    const res = await request(app)
      .get(`${API_BASE}?status=pending`)
      .set(adminHeader)
      .expect(200);

    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0].status).toBe("pending");
    expect(res.body.pagination.totalCount).toBe(1);
  });

  test("filters by productId", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product1 = await createTestProduct();
    const product2 = await createTestProduct();

    await Review.create({
      productId: product1._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    const user2 = await User.create({
      name: "User2",
      email: `u2p${Date.now()}@example.com`,
      password: "Password1",
      provider: "local",
      role: "user",
    });

    await Review.create({
      productId: product2._id,
      userId: user2._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    const res = await request(app)
      .get(`${API_BASE}?productId=${product1._id}`)
      .set(adminHeader)
      .expect(200);

    expect(res.body.reviews).toHaveLength(1);
  });

  test("paginates results correctly", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const product = await createTestProduct();

    // Create 5 reviews from different users
    const users = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        User.create({
          name: `P${i}`,
          email: `p${i}${Date.now()}@example.com`,
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
          rating: (i % 5) + 1,
          title: `Paginated admin review number ${i}`,
          comment: `This is a sufficiently long comment number ${i} for testing admin pagination.`,
          status: "pending",
        })
      )
    );

    const page1 = await request(app)
      .get(`${API_BASE}?page=1&limit=2`)
      .set(adminHeader)
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
      .get(`${API_BASE}?page=2&limit=2`)
      .set(adminHeader)
      .expect(200);

    expect(page2.body.reviews).toHaveLength(2);
    expect(page2.body.pagination.hasPrevPage).toBe(true);
  });
});

// ─── GET /api/admin/reviews/:reviewId ────────────────────────────────────────

describe("GET /api/admin/reviews/:reviewId", () => {
  test("returns full review details including pending reviews", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    const res = await request(app)
      .get(`${API_BASE}/${review._id}`)
      .set(adminHeader)
      .expect(200);

    expect(res.body).toHaveProperty("success", true);
    expect(res.body.review).toHaveProperty("_id");
    expect(res.body.review.status).toBe("pending");
    expect(res.body.review.rating).toBe(VALID_REVIEW.rating);
  });

  test("returns 404 for non-existent review", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const fakeId = new mongoose.Types.ObjectId();

    await request(app)
      .get(`${API_BASE}/${fakeId}`)
      .set(adminHeader)
      .expect(404);
  });

  test("returns 400 for invalid review id", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");

    await request(app)
      .get(`${API_BASE}/invalid-id`)
      .set(adminHeader)
      .expect(400);
  });
});

// ─── PATCH /api/admin/reviews/:reviewId/approve ──────────────────────────────

describe("PATCH /api/admin/reviews/:reviewId/approve", () => {
  test("approves a pending review", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    const res = await request(app)
      .patch(`${API_BASE}/${review._id}/approve`)
      .set(adminHeader)
      .expect(200);

    expect(res.body).toHaveProperty("success", true);
    expect(res.body.review.status).toBe("approved");

    // Verify in database
    const updated = await Review.findById(review._id).lean();
    expect(updated?.status).toBe("approved");
  });

  test("approves a previously rejected review", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "rejected",
      rejectionReason: "Initial rejection for test purposes",
    });

    const res = await request(app)
      .patch(`${API_BASE}/${review._id}/approve`)
      .set(adminHeader)
      .expect(200);

    expect(res.body.review.status).toBe("approved");

    // rejectionReason should be cleared
    const updated = await Review.findById(review._id).lean();
    expect(updated?.rejectionReason).toBeUndefined();
  });

  test("returns 400 if review is already approved", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "approved",
    });

    const res = await request(app)
      .patch(`${API_BASE}/${review._id}/approve`)
      .set(adminHeader)
      .expect(400);

    expect(res.body).toHaveProperty("success", false);
  });

  test("returns 404 for non-existent review", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const fakeId = new mongoose.Types.ObjectId();

    await request(app)
      .patch(`${API_BASE}/${fakeId}/approve`)
      .set(adminHeader)
      .expect(404);
  });
});

// ─── PATCH /api/admin/reviews/:reviewId/reject ───────────────────────────────

describe("PATCH /api/admin/reviews/:reviewId/reject", () => {
  test("rejects a pending review with a reason", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    const res = await request(app)
      .patch(`${API_BASE}/${review._id}/reject`)
      .set(adminHeader)
      .send({ rejectionReason: "Contains inappropriate language and spam content" })
      .expect(200);

    expect(res.body).toHaveProperty("success", true);
    expect(res.body.review.status).toBe("rejected");
    expect(res.body.review.rejectionReason).toBe(
      "Contains inappropriate language and spam content"
    );

    // Verify in database
    const updated = await Review.findById(review._id).lean();
    expect(updated?.status).toBe("rejected");
    expect(updated?.rejectionReason).toBe(
      "Contains inappropriate language and spam content"
    );
  });

  test("returns 400 if rejectionReason is missing", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    await request(app)
      .patch(`${API_BASE}/${review._id}/reject`)
      .set(adminHeader)
      .send({})
      .expect(400);
  });

  test("returns 400 if rejectionReason is too short", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    await request(app)
      .patch(`${API_BASE}/${review._id}/reject`)
      .set(adminHeader)
      .send({ rejectionReason: "Bad" })
      .expect(400);
  });

  test("returns 400 if review is already rejected", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "rejected",
      rejectionReason: "Already rejected for prior violation",
    });

    const res = await request(app)
      .patch(`${API_BASE}/${review._id}/reject`)
      .set(adminHeader)
      .send({ rejectionReason: "Duplicate rejection attempt for testing" })
      .expect(400);

    expect(res.body).toHaveProperty("success", false);
  });

  test("returns 404 for non-existent review", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const fakeId = new mongoose.Types.ObjectId();

    await request(app)
      .patch(`${API_BASE}/${fakeId}/reject`)
      .set(adminHeader)
      .send({ rejectionReason: "This review does not even exist in our database" })
      .expect(404);
  });
});

// ─── DELETE /api/admin/reviews/:reviewId ─────────────────────────────────────

describe("DELETE /api/admin/reviews/:reviewId", () => {
  test("hard deletes a review from the database", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "pending",
    });

    const res = await request(app)
      .delete(`${API_BASE}/${review._id}`)
      .set(adminHeader)
      .expect(200);

    expect(res.body).toHaveProperty("success", true);

    // Verify it's actually gone
    const deleted = await Review.findById(review._id);
    expect(deleted).toBeNull();
  });

  test("can delete approved reviews", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      ...VALID_REVIEW,
      status: "approved",
    });

    await request(app)
      .delete(`${API_BASE}/${review._id}`)
      .set(adminHeader)
      .expect(200);

    const deleted = await Review.findById(review._id);
    expect(deleted).toBeNull();
  });

  test("returns 404 for non-existent review", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const fakeId = new mongoose.Types.ObjectId();

    await request(app)
      .delete(`${API_BASE}/${fakeId}`)
      .set(adminHeader)
      .expect(404);
  });

  test("returns 400 for invalid review id", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");

    await request(app)
      .delete(`${API_BASE}/invalid-id`)
      .set(adminHeader)
      .expect(400);
  });
});

// ─── Product Rating Stats Recalculation ──────────────────────────────────────

describe("Product rating stats after moderation", () => {
  test("updates product stats after approving a review", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const product = await createTestProduct();

    // Create two reviews with different ratings
    const [u1, u2] = await Promise.all([
      User.create({ name: "U1", email: `s1${Date.now()}@example.com`, password: "Password1", provider: "local", role: "user" }),
      User.create({ name: "U2", email: `s2${Date.now()}@example.com`, password: "Password1", provider: "local", role: "user" }),
    ]);

    const review1 = await Review.create({
      productId: product._id, userId: u1._id, rating: 5,
      title: "Absolutely amazing product!", comment: "Best amplifier I have ever used in my professional career.",
      status: "pending",
    });
    await Review.create({
      productId: product._id, userId: u2._id, rating: 3,
      title: "Decent product overall!", comment: "This amplifier is okay but could be improved in a few areas.",
      status: "approved",
    });

    // Approve the first review
    await request(app)
      .patch(`${API_BASE}/${review1._id}/approve`)
      .set(adminHeader)
      .expect(200);

    // Verify product stats
    const updated = await Product.findById(product._id).lean();
    expect(updated?.averageRating).toBe(4); // (5+3)/2
    expect(updated?.totalReviews).toBe(2);
    expect(updated?.ratingDistribution).toMatchObject({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 });
    // Legacy fields synced
    expect(updated?.rating).toBe(4);
    expect(updated?.reviews).toBe(2);
  });

  test("updates product stats after rejecting a previously approved review", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const product = await createTestProduct();

    const [u1, u2] = await Promise.all([
      User.create({ name: "U1", email: `r1${Date.now()}@example.com`, password: "Password1", provider: "local", role: "user" }),
      User.create({ name: "U2", email: `r2${Date.now()}@example.com`, password: "Password1", provider: "local", role: "user" }),
    ]);

    const review1 = await Review.create({
      productId: product._id, userId: u1._id, rating: 5,
      title: "Absolutely amazing product!", comment: "Best amplifier I have ever used in my professional career.",
      status: "approved",
    });
    await Review.create({
      productId: product._id, userId: u2._id, rating: 3,
      title: "Decent product overall here!", comment: "This amplifier is okay but could be improved in several areas.",
      status: "approved",
    });

    // Reject the 5-star review
    await request(app)
      .patch(`${API_BASE}/${review1._id}/reject`)
      .set(adminHeader)
      .send({ rejectionReason: "This review contains promotional content and links" })
      .expect(200);

    const updated = await Product.findById(product._id).lean();
    expect(updated?.averageRating).toBe(3); // only the 3-star remains
    expect(updated?.totalReviews).toBe(1);
    expect(updated?.ratingDistribution).toMatchObject({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 0 });
  });

  test("updates product stats after deleting an approved review", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const product = await createTestProduct();

    const [u1, u2] = await Promise.all([
      User.create({ name: "U1", email: `d1${Date.now()}@example.com`, password: "Password1", provider: "local", role: "user" }),
      User.create({ name: "U2", email: `d2${Date.now()}@example.com`, password: "Password1", provider: "local", role: "user" }),
    ]);

    const review1 = await Review.create({
      productId: product._id, userId: u1._id, rating: 5,
      title: "Absolutely amazing product!", comment: "Best amplifier I have ever used in my professional career.",
      status: "approved",
    });
    await Review.create({
      productId: product._id, userId: u2._id, rating: 1,
      title: "Very disappointing product!", comment: "This amplifier broke within a week of purchase. Very unhappy.",
      status: "approved",
    });

    // Delete the 5-star review
    await request(app)
      .delete(`${API_BASE}/${review1._id}`)
      .set(adminHeader)
      .expect(200);

    const updated = await Product.findById(product._id).lean();
    expect(updated?.averageRating).toBe(1); // only 1-star remains
    expect(updated?.totalReviews).toBe(1);
    expect(updated?.ratingDistribution).toMatchObject({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  test("resets product stats to zero when all reviews are removed", async () => {
    const { authHeader: adminHeader } = await makeAuthHeaderForUser("admin");
    const { user } = await makeAuthHeaderForUser("user");
    const product = await createTestProduct();

    const review = await Review.create({
      productId: product._id, userId: user._id, rating: 4,
      title: "Good quality solid product!", comment: "This amplifier meets expectations and delivers clear sound output.",
      status: "approved",
    });

    // Delete the only review
    await request(app)
      .delete(`${API_BASE}/${review._id}`)
      .set(adminHeader)
      .expect(200);

    const updated = await Product.findById(product._id).lean();
    expect(updated?.averageRating).toBe(0);
    expect(updated?.totalReviews).toBe(0);
    expect(updated?.ratingDistribution).toMatchObject({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });
});
