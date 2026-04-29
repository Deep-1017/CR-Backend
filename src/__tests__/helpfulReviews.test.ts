import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import User from '../models/User';
import Review from '../models/Review';
import Product from '../models/product.model';
import HelpfulReview from '../models/HelpfulReview';

describe('POST /api/v1/reviews/:reviewId/helpful', () => {
  let userToken: string;
  let userObj: any;
  let anotherUserToken: string;
  let reviewId: string;
  let productId: string;

  beforeAll(async () => {
    // Ensure connection is up
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }

    // Create main user
    const user = await User.create({
      name: 'Helpful Voter',
      email: 'helpfulvoter@example.com',
      password: 'password123',
    });
    userObj = user;

    const resAuth = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'helpfulvoter@example.com', password: 'password123' });
    userToken = resAuth.body.token;

    // Create another user
    await User.create({
      name: 'Another Voter',
      email: 'anothervoter@example.com',
      password: 'password123',
    });

    const resAuth2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'anothervoter@example.com', password: 'password123' });
    anotherUserToken = resAuth2.body.token;

    // Create product
    const product = await Product.create({
      name: 'Helpful Review Product',
      description: 'A product for testing helpful votes',
      price: 100,
      stock: 10,
      brand: 'TestBrand',
      category: 'Amplifier',
      image: 'test.jpg',
    });
    productId = product._id.toString();

    // Create review
    const review = await Review.create({
      productId: product._id,
      userId: user._id,
      rating: 5,
      title: 'Great product!',
      comment: 'This product is fantastic and I recommend it.',
      status: 'approved',
      helpful: 0,
      unhelpful: 0,
    });
    reviewId = review._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['helpfulvoter@example.com', 'anothervoter@example.com'] } });
    await Product.deleteMany({ name: 'Helpful Review Product' });
    await Review.deleteMany({ productId });
    await HelpfulReview.deleteMany({ reviewId });
    // await mongoose.connection.close(); // let jest handle connection based on global setup
  });

  afterEach(async () => {
    // Reset review counts and delete helpful reviews
    await HelpfulReview.deleteMany({ reviewId });
    await Review.findByIdAndUpdate(reviewId, { helpful: 0, unhelpful: 0 });
  });

  it('should mark a review as helpful', async () => {
    const res = await request(app)
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isHelpful: true });

    expect(res.status).toBe(200);
    expect(res.body.helpful).toBe(1);
    expect(res.body.unhelpful).toBe(0);
    expect(res.body.userVote).toBe('helpful');

    const dbVote = await HelpfulReview.findOne({ reviewId, userId: userObj._id });
    expect(dbVote).toBeTruthy();
    expect(dbVote?.isHelpful).toBe(true);
  });

  it('should mark a review as unhelpful', async () => {
    const res = await request(app)
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isHelpful: false });

    expect(res.status).toBe(200);
    expect(res.body.helpful).toBe(0);
    expect(res.body.unhelpful).toBe(1);
    expect(res.body.userVote).toBe('unhelpful');

    const dbVote = await HelpfulReview.findOne({ reviewId, userId: userObj._id });
    expect(dbVote).toBeTruthy();
    expect(dbVote?.isHelpful).toBe(false);
  });

  it('should toggle from helpful to unhelpful', async () => {
    // 1. Mark helpful
    await request(app)
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isHelpful: true });

    // 2. Mark unhelpful
    const res = await request(app)
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isHelpful: false });

    expect(res.status).toBe(200);
    expect(res.body.helpful).toBe(0); // 1 - 1 = 0
    expect(res.body.unhelpful).toBe(1); // 0 + 1 = 1
    expect(res.body.userVote).toBe('unhelpful');
  });

  it('should remove vote if user sends same vote again', async () => {
    // 1. Mark helpful
    await request(app)
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isHelpful: true });

    // 2. Send helpful again (should remove vote)
    const res = await request(app)
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isHelpful: true });

    expect(res.status).toBe(200);
    expect(res.body.helpful).toBe(0);
    expect(res.body.unhelpful).toBe(0);
    expect(res.body.userVote).toBeNull();

    const dbVote = await HelpfulReview.findOne({ reviewId, userId: userObj._id });
    expect(dbVote).toBeNull();
  });

  it('should remove vote if user explicitly sends null', async () => {
    // 1. Mark helpful
    await request(app)
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isHelpful: true });

    // 2. Send null
    const res = await request(app)
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isHelpful: null });

    expect(res.status).toBe(200);
    expect(res.body.helpful).toBe(0);
    expect(res.body.unhelpful).toBe(0);
    expect(res.body.userVote).toBeNull();

    const dbVote = await HelpfulReview.findOne({ reviewId, userId: userObj._id });
    expect(dbVote).toBeNull();
  });

  it('should return 401 if unauthorized', async () => {
    const res = await request(app)
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .send({ isHelpful: true });

    expect(res.status).toBe(401);
  });

  it('should return 404 for non-existent review', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/v1/reviews/${fakeId}/helpful`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isHelpful: true });

    expect(res.status).toBe(404);
  });

  it('multiple users can vote on the same review', async () => {
    // User 1 votes helpful
    await request(app)
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isHelpful: true });

    // User 2 votes helpful
    const res = await request(app)
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set('Authorization', `Bearer ${anotherUserToken}`)
      .send({ isHelpful: true });

    expect(res.status).toBe(200);
    expect(res.body.helpful).toBe(2);
    expect(res.body.unhelpful).toBe(0);
    expect(res.body.userVote).toBe('helpful');
  });
});
