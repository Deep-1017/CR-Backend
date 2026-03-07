import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';

let mongoServer: MongoMemoryServer;
let adminToken: string;
let customerToken: string;

const adminUser = { name: 'Admin', email: 'admin@example.com', password: 'AdminPass123' };
const customerUser = { name: 'Customer', email: 'customer@example.com', password: 'CustPass123' };

const sampleProduct = {
    name: 'Test Guitar',
    category: 'Electric Guitar',
    price: 499,
    image: '/assets/test-guitar.jpg',
    description: 'A test guitar',
    brand: 'TestBrand',
};

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Register customer (default role)
    const custRes = await request(app).post('/api/v1/auth/register').send(customerUser);
    customerToken = custRes.body.token;

    // Register admin and manually set role in DB
    const adminRes = await request(app).post('/api/v1/auth/register').send(adminUser);
    adminToken = adminRes.body.token;
    // Directly set role to admin in DB
    await mongoose.connection.collection('users').updateOne(
        { email: adminUser.email },
        { $set: { role: 'admin' } }
    );
    // Re-login to get a fresh token with admin role
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
    await mongoose.connection.collection('products').deleteMany({});
});

describe('Product Routes', () => {
    it('POST /api/v1/products without token → 401', async () => {
        const res = await request(app).post('/api/v1/products').send(sampleProduct);
        expect(res.status).toBe(401);
    });

    it('POST /api/v1/products with customer token → 403', async () => {
        const res = await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(sampleProduct);
        expect(res.status).toBe(403);
    });

    it('POST /api/v1/products with admin token → 201', async () => {
        const res = await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(sampleProduct);
        expect(res.status).toBe(201);
        expect(res.body.name).toBe(sampleProduct.name);
    });

    it('DELETE /api/v1/products/:id without token → 401', async () => {
        // Create a product first
        const createRes = await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(sampleProduct);
        const productId = createRes.body.id || createRes.body._id;

        const res = await request(app).delete(`/api/v1/products/${productId}`);
        expect(res.status).toBe(401);
    });
});
