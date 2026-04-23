import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';
import Product from '../models/product.model';

let mongoServer: MongoMemoryServer;
let customerToken: string;
let adminToken: string;
let otherCustomerToken: string;
let productId: string;

const customerUser = { name: 'Customer', email: 'ordercust@example.com', password: 'CustPass123' };
const otherCustomerUser = { name: 'Other Customer', email: 'other@example.com', password: 'OtherPass123' };
const adminUser = { name: 'Admin', email: 'orderadmin@example.com', password: 'AdminPass123' };

const validOrderBody = {
    customer: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        address: '123 Main St',
        city: 'New York',
        zipCode: '10001',
    },
    items: [{
        productId: '', // will be set
        variantId: '', // will be set
        configuration: 'Standard',
        finish: 'Natural',
        quantity: 1,
    }],
    totalAmount: 499,
    paymentDetails: {
        provider: 'stripe',
        paymentIntentId: 'pi_test_123',
    },
};

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Create a test product
    const product = await Product.create({
        name: 'Test Amplifier',
        category: 'Amplifier',
        basePrice: 499,
        price: 499,
        image: '/assets/test.jpg',
        images: ['/assets/test.jpg'],
        description: 'A test amplifier',
        rating: 5,
        reviews: 0,
        brand: 'Test',
        condition: 'New',
        skillLevel: 'Beginner',
        inStock: true,
        stockCount: 10,
        variants: [{
            configuration: 'Standard',
            finish: 'Natural',
            stock: 10,
            sku: 'TEST-001',
            price: 499,
            images: ['/assets/test.jpg']
        }],
        availableConfigurations: ['Standard'],
        availableFinishes: ['Natural'],
        specifications: [],
        customerReviews: []
    });
    productId = product._id.toString();
    validOrderBody.items[0].productId = productId;
    validOrderBody.items[0].variantId = product.variants[0].variantId.toString();

    // Register customer
    const custRes = await request(app).post('/api/v1/auth/register').send(customerUser);
    customerToken = custRes.body.token;

    // Register other customer
    const otherCustRes = await request(app).post('/api/v1/auth/register').send(otherCustomerUser);
    otherCustomerToken = otherCustRes.body.token;

    // Register and promote admin
    await request(app).post('/api/v1/auth/register').send(adminUser);
    await mongoose.connection.collection('users').updateOne(
        { email: adminUser.email },
        { $set: { role: 'admin' } }
    );
    const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminUser.email, password: adminUser.password });
    adminToken = loginRes.body.token;
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    await mongoose.connection.collection('orders').deleteMany({});
});

describe('Order Routes', () => {
    it('POST /api/v1/orders without token → 401', async () => {
        const res = await request(app).post('/api/v1/orders').send(validOrderBody);
        expect(res.status).toBe(401);
    });

    it('POST /api/v1/orders with valid token + valid body → 201', async () => {
        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(validOrderBody);
        expect(res.status).toBe(201);
        expect(res.body.totalAmount).toBe(validOrderBody.totalAmount);
    });

    it('GET /api/v1/orders with customer token → 403', async () => {
        const res = await request(app)
            .get('/api/v1/orders')
            .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
    });

    it('GET /api/v1/orders with admin token → 200', async () => {
        const res = await request(app)
            .get('/api/v1/orders')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('orders');
    });

    describe('GET /api/v1/orders/:id', () => {
        let orderId: string;

        beforeEach(async () => {
            // Create an order with customerToken
            const res = await request(app)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send(validOrderBody);
            orderId = res.body.id;
        });

        it('with valid ID and owner token → 200', async () => {
            const res = await request(app)
                .get(`/api/v1/orders/${orderId}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(orderId);
        });

        it('with valid ID and admin token → 200', async () => {
            const res = await request(app)
                .get(`/api/v1/orders/${orderId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(orderId);
        });

        it('with valid ID and other customer token → 403', async () => {
            const res = await request(app)
                .get(`/api/v1/orders/${orderId}`)
                .set('Authorization', `Bearer ${otherCustomerToken}`);
            expect(res.status).toBe(403);
        });

        it('with invalid ID format → 400', async () => {
            const res = await request(app)
                .get('/api/v1/orders/invalid-id')
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(400);
        });

        it('with non-existent ID → 404', async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .get(`/api/v1/orders/${fakeId}`)
                .set('Authorization', `Bearer ${customerToken}`);
            expect(res.status).toBe(404);
        });
    });
});
