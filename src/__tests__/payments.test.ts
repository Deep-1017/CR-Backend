import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import crypto from 'crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';
import Product from '../models/product.model';
import Order from '../models/order.model';
import Cart from '../models/cart.model';
import razorpay from '../config/razorpay';
import env from '../config/env';

jest.setTimeout(30000);

let mongoServer: MongoMemoryServer;
let customerToken: string;

const customerUser = { name: 'Payment User', email: 'payuser@example.com', password: 'PayPass123' };

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const res = await request(app).post('/api/v1/auth/register').send(customerUser);
    customerToken = res.body.token;
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    await mongoose.connection.collection('orders').deleteMany({});
    await mongoose.connection.collection('carts').deleteMany({});
    await mongoose.connection.collection('products').deleteMany({});
    jest.restoreAllMocks();
});

describe('Payment order creation', () => {
    it('creates a Razorpay order when request is valid', async () => {
        const product = await Product.create({
            name: 'Test Product',
            category: 'Speakers',
            price: 750,
            image: '/assets/test.jpg',
            description: 'A test product',
            brand: 'TestBrand',
            condition: 'New',
            skillLevel: 'Beginner',
            inStock: true,
            stockCount: 10,
            specifications: [],
            customerReviews: [],
        });

        jest.spyOn(razorpay.orders as any, 'create').mockResolvedValueOnce({
            id: 'order_test_razorpay_123',
            amount: 75000,
            currency: 'INR',
        });

        const res = await request(app)
            .post('/api/payments/create-order')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                cartItems: [{ productId: product._id.toString(), quantity: 1, price: 750 }],
                totalAmount: 750,
                currency: 'INR',
            });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            amount: 750,
            currency: 'INR',
            razorpayOrderId: 'order_test_razorpay_123',
            key: expect.any(String),
        });
    });

    it('returns 400 when required fields are missing', async () => {
        const res = await request(app)
            .post('/api/payments/create-order')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ totalAmount: 750, currency: 'INR' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
    });

    it('returns 500 when Razorpay API fails', async () => {
        const product = await Product.create({
            name: 'Failure Product',
            category: 'Speakers',
            price: 900,
            image: '/assets/fail.jpg',
            description: 'A failing product',
            brand: 'FailBrand',
            condition: 'New',
            skillLevel: 'Beginner',
            inStock: true,
            stockCount: 5,
            specifications: [],
            customerReviews: [],
        });

        jest.spyOn(razorpay.orders as any, 'create').mockRejectedValueOnce(new Error('Rate limit exceeded'));

        const res = await request(app)
            .post('/api/payments/create-order')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                cartItems: [{ productId: product._id.toString(), quantity: 1, price: 900 }],
                totalAmount: 900,
                currency: 'INR',
            });

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Failed to create Razorpay order');
    });
});

describe('Payment webhook verification', () => {
    it('verifies signature and updates order successfully', async () => {
        const user = await mongoose.connection.collection('users').findOne({ email: customerUser.email });
        const userId = user?._id.toString();

        await Order.create({
            userId,
            customer: {
                firstName: 'Payment',
                lastName: 'User',
                email: customerUser.email,
                address: 'Street',
                city: 'City',
                zipCode: '123456',
            },
            items: [
                {
                    productId: new mongoose.Types.ObjectId().toString(),
                    name: 'Item',
                    price: 1200,
                    quantity: 1,
                    image: '/img.jpg',
                },
            ],
            totalAmount: 1200,
            paymentId: 'order_webhook_123',
            paymentStatus: 'pending',
            paymentMethod: 'razorpay',
            amountPaid: 0,
            paymentDetails: {
                provider: 'razorpay',
                paymentIntentId: 'order_webhook_123',
                razorpayOrderId: 'order_webhook_123',
                status: 'pending',
            },
            status: 'Pending',
        });

        if (userId) {
            await Cart.create({
                userId,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId().toString(),
                        quantity: 2,
                        price: 600,
                    },
                ],
            });
        }

        const razorpay_order_id = 'order_webhook_123';
        const razorpay_payment_id = 'pay_webhook_456';
        const razorpay_signature = crypto
            .createHmac('sha256', env.RAZORPAY_SECRET ?? '')
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        const res = await request(app)
            .post('/api/payments/verify-webhook')
            .send({ razorpay_order_id, razorpay_payment_id, razorpay_signature });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Payment verified and order confirmed');

        const updatedOrder = await Order.findOne({ paymentId: razorpay_order_id });
        expect(updatedOrder).not.toBeNull();
        expect(updatedOrder?.paymentStatus).toBe('success');
        expect(updatedOrder?.transactionId).toBe(razorpay_payment_id);
        expect(updatedOrder?.status).toBe('Confirmed');
        expect(updatedOrder?.paymentDetails.status).toBe('paid');

        if (userId) {
            const updatedCart = await Cart.findOne({ userId });
            expect(updatedCart?.items ?? []).toHaveLength(0);
        }
    });

    it('rejects tampered signature', async () => {
        const res = await request(app).post('/api/payments/verify-webhook').send({
            razorpay_order_id: 'order_webhook_invalid',
            razorpay_payment_id: 'pay_webhook_invalid',
            razorpay_signature: 'invalid_signature',
        });

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Invalid webhook signature');
    });

    it('returns 404 when order is not found', async () => {
        const razorpay_order_id = 'order_webhook_missing';
        const razorpay_payment_id = 'pay_webhook_missing';
        const razorpay_signature = crypto
            .createHmac('sha256', env.RAZORPAY_SECRET ?? '')
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        const res = await request(app).post('/api/payments/verify-webhook').send({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Order not found');
    });
});
