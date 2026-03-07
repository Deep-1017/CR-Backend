import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

describe('Auth Routes', () => {
    const validUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
    };

    it('POST /api/v1/auth/register → 201 with token', async () => {
        const res = await request(app).post('/api/v1/auth/register').send(validUser);
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user.email).toBe(validUser.email);
    });

    it('POST /api/v1/auth/register with duplicate email → 400', async () => {
        await request(app).post('/api/v1/auth/register').send(validUser);
        const res = await request(app).post('/api/v1/auth/register').send(validUser);
        expect(res.status).toBe(400);
    });

    it('POST /api/v1/auth/login with correct credentials → 200 with token', async () => {
        await request(app).post('/api/v1/auth/register').send(validUser);
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: validUser.email, password: validUser.password });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
    });

    it('POST /api/v1/auth/login with wrong password → 401', async () => {
        await request(app).post('/api/v1/auth/register').send(validUser);
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: validUser.email, password: 'WrongPassword!' });
        expect(res.status).toBe(401);
    });

    it('GET /api/v1/auth/me without token → 401', async () => {
        const res = await request(app).get('/api/v1/auth/me');
        expect(res.status).toBe(401);
    });

    it('GET /api/v1/auth/me with valid token → 200', async () => {
        const regRes = await request(app).post('/api/v1/auth/register').send(validUser);
        const token = regRes.body.token;
        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.email).toBe(validUser.email);
    });
});
