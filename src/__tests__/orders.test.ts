import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';

let mongoServer: MongoMemoryServer;
let customerToken: string;
let adminToken: string;

const customerUser = { name: 'Customer', email: 'ordercust@example.com', password: 'CustPass123' };
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
        productId: 'prod-001',
        name: 'Test Guitar',
        price: 499,
        quantity: 1,
        image: '/assets/test.jpg',
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

    // Register customer
    const custRes = await request(app).post('/api/v1/auth/register').send(customerUser);
    customerToken = custRes.body.token;

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
});
