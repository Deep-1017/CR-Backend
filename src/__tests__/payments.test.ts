import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import crypto from 'crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app';
import Product from '../models/product.model';
import Order from '../models/order.model';
import Cart from '../models/cart.model';
import razorpay from '../config/razorpay';
import env from '../config/env';

jest.mock('../services/orderEmail.service', () => ({
    sendOrderConfirmationEmail: jest.fn(),
}));

jest.mock('../services/email.service', () => ({
    isEmailConfigured: jest.fn(() => true),
    logEmailConfigurationWarning: jest.fn(),
}));

import { sendOrderConfirmationEmail } from '../services/orderEmail.service';

jest.setTimeout(30000);

let mongoServer: MongoMemoryReplSet;
let customerToken: string;

const customerUser = { name: 'Payment User', email: 'payuser@example.com', password: 'PayPass123' };

beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
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
            basePrice: 750,
            price: 750,
            image: '/assets/test.jpg',
            description: 'A test product',
            brand: 'TestBrand',
            condition: 'New',
            skillLevel: 'Beginner',
            inStock: true,
            stockCount: 10,
            variants: [{
                configuration: 'Right-Handed',
                finish: 'Sunburst',
                stock: 10,
                sku: 'GTR-PAY-SUNBST-RH',
                price: 750,
            }],
            specifications: [],
            customerReviews: [],
        });
        const variant = product.variants[0];

        jest.spyOn(razorpay.orders as any, 'create').mockResolvedValueOnce({
            id: 'order_test_razorpay_123',
            amount: 82500,
            currency: 'INR',
        });

        const res = await request(app)
            .post('/api/v1/payments/create-order')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                customer: {
                    firstName: 'Payment',
                    lastName: 'User',
                    email: customerUser.email,
                    phone: '9999999999',
                    address: '123 Test Street',
                    city: 'Mumbai',
                    state: 'MH',
                    zipCode: '400001',
                },
                cartItems: [{
                    productId: product._id.toString(),
                    variantId: variant.variantId.toString(),
                    configuration: variant.configuration,
                    finish: variant.finish,
                    quantity: 1,
                    price: 750,
                }],
                pricing: {
                    subtotal: 750,
                    tax: 75,
                    shipping: 0,
                    total: 825,
                },
                currency: 'INR',
            });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            amount: 82500,
            currency: 'INR',
            razorpayOrderId: 'order_test_razorpay_123',
            key: expect.any(String),
        });
        const razorpayCreatePayload = (razorpay.orders.create as jest.Mock).mock.calls[0][0] as {
            amount: number;
            currency: string;
            receipt: string;
        };

        expect(razorpayCreatePayload).toEqual(
            expect.objectContaining({
                amount: 82500,
                currency: 'INR',
                receipt: expect.any(String),
            })
        );
        expect(razorpayCreatePayload.receipt.length).toBeLessThanOrEqual(40);

        const savedOrder = await Order.findById(res.body.orderId);
        expect(savedOrder).not.toBeNull();
        expect(savedOrder?.customer.firstName).toBe('Payment');
        expect(savedOrder?.customer.city).toBe('Mumbai');
        expect(savedOrder?.totalAmount).toBe(825);
        expect(savedOrder?.items[0].sku).toBe('GTR-PAY-SUNBST-RH');

        const updatedProduct = await Product.findById(product.id);
        expect(updatedProduct?.variants[0].stock).toBe(9);
    });

    it('returns 400 when required fields are missing', async () => {
        const res = await request(app)
            .post('/api/v1/payments/create-order')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ pricing: { subtotal: 750, tax: 75, shipping: 0, total: 825 }, currency: 'INR' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
    });

    it('returns 500 when Razorpay API fails', async () => {
        const product = await Product.create({
            name: 'Failure Product',
            category: 'Speakers',
            basePrice: 900,
            price: 900,
            image: '/assets/fail.jpg',
            description: 'A failing product',
            brand: 'FailBrand',
            condition: 'New',
            skillLevel: 'Beginner',
            inStock: true,
            stockCount: 5,
            variants: [{
                configuration: 'Right-Handed',
                finish: 'Natural',
                stock: 5,
                sku: 'GTR-FAIL-NAT-RH',
                price: 900,
            }],
            specifications: [],
            customerReviews: [],
        });
        const variant = product.variants[0];

        jest.spyOn(razorpay.orders as any, 'create').mockRejectedValueOnce(new Error('Rate limit exceeded'));

        const res = await request(app)
            .post('/api/v1/payments/create-order')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                customer: {
                    firstName: 'Failure',
                    lastName: 'User',
                    email: customerUser.email,
                    address: '123 Test Street',
                    city: 'Delhi',
                    zipCode: '110001',
                },
                cartItems: [{
                    productId: product._id.toString(),
                    variantId: variant.variantId.toString(),
                    configuration: variant.configuration,
                    finish: variant.finish,
                    quantity: 1,
                    price: 900,
                }],
                pricing: {
                    subtotal: 900,
                    tax: 90,
                    shipping: 0,
                    total: 990,
                },
                currency: 'INR',
            });

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Failed to create Razorpay order');
    });

    it('returns 400 when subtotal and total do not match the cart pricing', async () => {
        const product = await Product.create({
            name: 'Mismatch Product',
            category: 'Speakers',
            basePrice: 1000,
            price: 1000,
            image: '/assets/mismatch.jpg',
            description: 'A mismatch product',
            brand: 'MismatchBrand',
            condition: 'New',
            skillLevel: 'Beginner',
            inStock: true,
            stockCount: 5,
            variants: [{
                configuration: 'Right-Handed',
                finish: 'Gloss Black',
                stock: 5,
                sku: 'GTR-MIS-GLBLK-RH',
                price: 1000,
            }],
            specifications: [],
            customerReviews: [],
        });
        const variant = product.variants[0];

        const res = await request(app)
            .post('/api/v1/payments/create-order')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                customer: {
                    firstName: 'Mismatch',
                    lastName: 'User',
                    email: customerUser.email,
                    address: '123 Test Street',
                    city: 'Pune',
                    zipCode: '411001',
                },
                cartItems: [{
                    productId: product._id.toString(),
                    variantId: variant.variantId.toString(),
                    configuration: variant.configuration,
                    finish: variant.finish,
                    quantity: 1,
                    price: 1000,
                }],
                pricing: {
                    subtotal: 1000,
                    tax: 99,
                    shipping: 0,
                    total: 1000,
                },
                currency: 'INR',
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Total amount mismatch');
    });
});

describe('Payment webhook verification', () => {
    it('verifies signature and updates order successfully', async () => {
        const mockedSendOrderConfirmationEmail =
            sendOrderConfirmationEmail as unknown as jest.MockedFunction<typeof sendOrderConfirmationEmail>;
        mockedSendOrderConfirmationEmail.mockResolvedValueOnce({ ok: true } as any);
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
                    variantId: new mongoose.Types.ObjectId().toString(),
                    name: 'Item',
                    configuration: 'Right-Handed',
                    finish: 'Sunburst',
                    price: 1200,
                    priceAtPurchase: 1200,
                    sku: 'GTR-WEBHOOK-SUNBST-RH',
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
            .post('/api/v1/payments/verify-webhook')
            .send({ razorpay_order_id, razorpay_payment_id, razorpay_signature });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Payment verified and order confirmed');
        expect(res.body.orderId).toBeDefined();

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

        // fire-and-forget email should still be kicked off
        await new Promise((resolve) => setImmediate(resolve));
        expect(sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
    });

    it('rejects tampered signature', async () => {
        const res = await request(app).post('/api/v1/payments/verify-webhook').send({
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

        const res = await request(app).post('/api/v1/payments/verify-webhook').send({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Order not found');
    });
});
