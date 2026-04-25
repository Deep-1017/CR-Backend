import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../app";
import User from "../models/User";
import Address from "../models/Address";

let replSet: MongoMemoryReplSet;

const signToken = (payload: { id: string; email: string; role: string }) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET missing in test env");
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
};

const makeAuthHeaderForUser = async () => {
  const user = await User.create({
    name: "Test User",
    email: `user${Date.now()}@example.com`,
    password: "Password1",
    provider: "local",
    role: "user",
  });
  const token = signToken({ id: user._id.toString(), email: user.email, role: user.role });
  return { user, token, authHeader: { Authorization: `Bearer ${token}` } };
};

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
  await Promise.all([User.deleteMany({}), Address.deleteMany({})]);
});

describe("Addresses API", () => {
  test("POST /api/v1/users/addresses creates an address and returns _id", async () => {
    const { authHeader } = await makeAuthHeaderForUser();

    const res = await request(app)
      .post("/api/v1/users/addresses")
      .set(authHeader)
      .send({
        label: "Home",
        fullName: "Deep Sharma",
        phone: "9876543210",
        addressLine1: "12 MG Road",
        addressLine2: "Near Metro",
        city: "Bengaluru",
        state: "Karnataka",
        zipCode: "560001",
        country: "India",
        isDefault: true,
      })
      .expect(201);

    expect(res.body).toHaveProperty("_id");
    expect(res.body.isDefault).toBe(true);
  });

  test("POST validates phone and zipCode", async () => {
    const { authHeader } = await makeAuthHeaderForUser();

    const bad = await request(app)
      .post("/api/v1/users/addresses")
      .set(authHeader)
      .send({
        label: "Home",
        fullName: "Deep Sharma",
        phone: "123",
        addressLine1: "12 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        zipCode: "12",
        country: "India",
        isDefault: false,
      })
      .expect(400);

    expect(bad.body).toHaveProperty("success", false);
  });

  test("GET /api/v1/users/addresses sorts default first then createdAt desc", async () => {
    const { user, authHeader } = await makeAuthHeaderForUser();

    const a1 = await Address.create({
      userId: user._id,
      label: "Old",
      fullName: "A",
      phone: "9876543210",
      addressLine1: "x",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: false,
    });

    const a2 = await Address.create({
      userId: user._id,
      label: "Default",
      fullName: "B",
      phone: "9876543211",
      addressLine1: "y",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: true,
    });

    const a3 = await Address.create({
      userId: user._id,
      label: "New",
      fullName: "C",
      phone: "9876543212",
      addressLine1: "z",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: false,
    });

    // Ensure createdAt ordering is deterministic if needed
    await Address.updateOne({ _id: a1._id }, { $set: { createdAt: new Date(Date.now() - 30000) } });
    await Address.updateOne({ _id: a2._id }, { $set: { createdAt: new Date(Date.now() - 20000) } });
    await Address.updateOne({ _id: a3._id }, { $set: { createdAt: new Date(Date.now() - 10000) } });

    const res = await request(app).get("/api/v1/users/addresses").set(authHeader).expect(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]._id.toString()).toBe(a2._id.toString());
  });

  test("PATCH /api/v1/users/addresses/:id updates fields and can set default", async () => {
    const { user, authHeader } = await makeAuthHeaderForUser();

    const a1 = await Address.create({
      userId: user._id,
      label: "A1",
      fullName: "A",
      phone: "9876543210",
      addressLine1: "x",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: true,
    });

    const a2 = await Address.create({
      userId: user._id,
      label: "A2",
      fullName: "B",
      phone: "9876543211",
      addressLine1: "y",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: false,
    });

    const res = await request(app)
      .patch(`/api/v1/users/addresses/${a2._id.toString()}`)
      .set(authHeader)
      .send({ label: "Updated", isDefault: true })
      .expect(200);

    expect(res.body.label).toBe("Updated");
    expect(res.body.isDefault).toBe(true);

    const refreshedA1 = await Address.findById(a1._id);
    expect(refreshedA1?.isDefault).toBe(false);
  });

  test("PATCH /set-default switches default", async () => {
    const { user, authHeader } = await makeAuthHeaderForUser();

    const a1 = await Address.create({
      userId: user._id,
      label: "A1",
      fullName: "A",
      phone: "9876543210",
      addressLine1: "x",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: true,
    });
    const a2 = await Address.create({
      userId: user._id,
      label: "A2",
      fullName: "B",
      phone: "9876543211",
      addressLine1: "y",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: false,
    });

    await request(app)
      .patch(`/api/v1/users/addresses/${a2._id.toString()}/set-default`)
      .set(authHeader)
      .expect(200);

    const [ra1, ra2] = await Promise.all([Address.findById(a1._id), Address.findById(a2._id)]);
    expect(ra1?.isDefault).toBe(false);
    expect(ra2?.isDefault).toBe(true);
  });

  test("DELETE default address sets most recent remaining as default", async () => {
    const { user, authHeader } = await makeAuthHeaderForUser();

    const defaultAddr = await Address.create({
      userId: user._id,
      label: "Default",
      fullName: "A",
      phone: "9876543210",
      addressLine1: "x",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: true,
    });

    const recent = await Address.create({
      userId: user._id,
      label: "Recent",
      fullName: "B",
      phone: "9876543211",
      addressLine1: "y",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: false,
    });

    await request(app)
      .delete(`/api/v1/users/addresses/${defaultAddr._id.toString()}`)
      .set(authHeader)
      .expect(200);

    const remaining = await Address.findById(recent._id);
    expect(remaining?.isDefault).toBe(true);
  });

  test("Ownership: user cannot read another user's address (404)", async () => {
    const { user } = await makeAuthHeaderForUser();
    const { authHeader: otherHeader } = await makeAuthHeaderForUser();

    const address = await Address.create({
      userId: user._id,
      label: "Private",
      fullName: "A",
      phone: "9876543210",
      addressLine1: "x",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: false,
    });

    await request(app)
      .get(`/api/v1/users/addresses/${address._id.toString()}`)
      .set(otherHeader)
      .expect(404);
  });

  test("GET /api/v1/users/default-address returns the default address", async () => {
    const { user, authHeader } = await makeAuthHeaderForUser();

    const nonDefault = await Address.create({
      userId: user._id,
      label: "Other",
      fullName: "A",
      phone: "9876543210",
      addressLine1: "x",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: false,
    });

    const def = await Address.create({
      userId: user._id,
      label: "Default",
      fullName: "B",
      phone: "9876543211",
      addressLine1: "y",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: true,
    });

    // Make ordering deterministic if multiple defaults ever existed (shouldn't).
    await Address.updateOne({ _id: nonDefault._id }, { $set: { createdAt: new Date(Date.now() - 20000) } });
    await Address.updateOne({ _id: def._id }, { $set: { createdAt: new Date(Date.now() - 10000) } });

    const res = await request(app)
      .get("/api/v1/users/default-address")
      .set(authHeader)
      .expect(200);

    expect(res.body._id.toString()).toBe(def._id.toString());
    expect(res.body).toHaveProperty("label", "Default");
    expect(res.body).not.toHaveProperty("isDefault");
  });

  test("GET /api/v1/users/default-address falls back to most recent when no default exists", async () => {
    const { user, authHeader } = await makeAuthHeaderForUser();

    const older = await Address.create({
      userId: user._id,
      label: "Older",
      fullName: "A",
      phone: "9876543210",
      addressLine1: "x",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: false,
    });

    const newer = await Address.create({
      userId: user._id,
      label: "Newer",
      fullName: "B",
      phone: "9876543211",
      addressLine1: "y",
      city: "c",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
      isDefault: false,
    });

    await Address.updateOne({ _id: older._id }, { $set: { createdAt: new Date(Date.now() - 20000) } });
    await Address.updateOne({ _id: newer._id }, { $set: { createdAt: new Date(Date.now() - 10000) } });

    const res = await request(app)
      .get("/api/v1/users/default-address")
      .set(authHeader)
      .expect(200);

    expect(res.body._id.toString()).toBe(newer._id.toString());
    expect(res.body).not.toHaveProperty("isDefault");
  });

  test("GET /api/v1/users/default-address returns 404 when user has no addresses", async () => {
    const { authHeader } = await makeAuthHeaderForUser();

    const res = await request(app)
      .get("/api/v1/users/default-address")
      .set(authHeader)
      .expect(404);

    expect(res.body).toHaveProperty("success", false);
    expect(res.body.message).toMatch(/No address/i);
  });
});

