import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { Express } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import Order from '../models/order.model';
import Product from '../models/product.model';

let app: Express;
let replSet: MongoMemoryReplSet;

const JWT_SECRET = 'order-variant-test-secret';
const customerToken = jwt.sign(
    { id: new mongoose.Types.ObjectId().toString(), email: 'customer@example.com', role: 'customer' },
    JWT_SECRET
);

const createProduct = async (overrides: Record<string, unknown> = {}) =>
    Product.create({
        name: 'Fender Strat',
        category: 'Speakers',
        basePrice: 499,
        image: '/assets/fender-strat.jpg',
        description: 'A test guitar',
        brand: 'Fender',
        ...overrides,
    });

const buildOrderBody = (
    productId: string,
    variantId: string,
    overrides: Record<string, unknown> = {}
) => ({
    customer: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        address: '123 Main St',
        city: 'New York',
        zipCode: '10001',
    },
    items: [{
        productId,
        variantId,
        configuration: 'Right-Handed',
        finish: 'Sunburst',
        quantity: 1,
    }],
    totalAmount: 549,
    paymentDetails: {
        provider: 'razorpay',
        paymentIntentId: 'order_test_123',
    },
    ...overrides,
});

beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

    app = (await import('../app')).default;
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
});

afterEach(async () => {
    await Order.deleteMany({});
    await Product.deleteMany({});
});

describe('Variant-aware order creation', () => {
    it('creates order items with variant details and deducts variant stock transactionally', async () => {
        const product = await createProduct({
            variants: [{
                configuration: 'Right-Handed',
                finish: 'Sunburst',
                stock: 2,
                sku: 'GTR-101-SUNBST-RH',
                price: 549,
                images: ['/assets/sunburst-rh.jpg'],
            }],
        });
        const variantId = product.variants[0].variantId.toString();

        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(buildOrderBody(product.id, variantId));

        expect(res.status).toBe(201);
        expect(res.body.items[0]).toEqual(expect.objectContaining({
            productId: product.id,
            variantId,
            name: 'Fender Strat',
            configuration: 'Right-Handed',
            finish: 'Sunburst',
            quantity: 1,
            priceAtPurchase: 549,
            price: 549,
            sku: 'GTR-101-SUNBST-RH',
            image: '/assets/sunburst-rh.jpg',
        }));

        const updatedProduct = await Product.findById(product.id);
        expect(updatedProduct?.variants[0].stock).toBe(1);
        expect(updatedProduct?.stockCount).toBe(1);
        expect(updatedProduct?.inStock).toBe(true);
    });

    it('rejects insufficient stock with a meaningful message', async () => {
        const product = await createProduct({
            variants: [{
                configuration: 'Right-Handed',
                finish: 'Sunburst',
                stock: 1,
                sku: 'GTR-102-SUNBST-RH',
                price: 549,
            }],
        });
        const variantId = product.variants[0].variantId.toString();

        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(buildOrderBody(product.id, variantId, {
                items: [{
                    productId: product.id,
                    variantId,
                    configuration: 'Right-Handed',
                    finish: 'Sunburst',
                    quantity: 2,
                }],
                totalAmount: 1098,
            }));

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Only 1 unit of Fender Strat - Sunburst - Right-Handed left in stock');
        expect(await Order.countDocuments()).toBe(0);

        const unchangedProduct = await Product.findById(product.id);
        expect(unchangedProduct?.variants[0].stock).toBe(1);
    });

    it('rolls back earlier stock deductions when a later cart item fails', async () => {
        const firstProduct = await createProduct({
            name: 'First Guitar',
            variants: [{
                configuration: 'Right-Handed',
                finish: 'Sunburst',
                stock: 3,
                sku: 'GTR-103-SUNBST-RH',
                price: 500,
            }],
        });
        const secondProduct = await createProduct({
            name: 'Second Guitar',
            variants: [{
                configuration: 'Right-Handed',
                finish: 'Sunburst',
                stock: 1,
                sku: 'GTR-104-SUNBST-RH',
                price: 300,
            }],
        });

        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(buildOrderBody(
                firstProduct.id,
                firstProduct.variants[0].variantId.toString(),
                {
                    items: [
                        {
                            productId: firstProduct.id,
                            variantId: firstProduct.variants[0].variantId.toString(),
                            configuration: 'Right-Handed',
                            finish: 'Sunburst',
                            quantity: 1,
                        },
                        {
                            productId: secondProduct.id,
                            variantId: secondProduct.variants[0].variantId.toString(),
                            configuration: 'Right-Handed',
                            finish: 'Sunburst',
                            quantity: 2,
                        },
                    ],
                    totalAmount: 1100,
                }
            ));

        expect(res.status).toBe(400);
        expect(await Order.countDocuments()).toBe(0);

        const unchangedFirstProduct = await Product.findById(firstProduct.id);
        const unchangedSecondProduct = await Product.findById(secondProduct.id);
        expect(unchangedFirstProduct?.variants[0].stock).toBe(3);
        expect(unchangedSecondProduct?.variants[0].stock).toBe(1);
    });

    it('requires variantId before checkout', async () => {
        const product = await createProduct({
            variants: [{
                configuration: 'Right-Handed',
                finish: 'Sunburst',
                stock: 2,
                sku: 'GTR-105-SUNBST-RH',
                price: 549,
            }],
        });

        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                ...buildOrderBody(product.id, product.variants[0].variantId.toString()),
                items: [{
                    productId: product.id,
                    configuration: 'Right-Handed',
                    finish: 'Sunburst',
                    quantity: 1,
                }],
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
    });

    it('rejects cart items when selected configuration or finish no longer matches the variant', async () => {
        const product = await createProduct({
            variants: [{
                configuration: 'Right-Handed',
                finish: 'Sunburst',
                stock: 2,
                sku: 'GTR-106-SUNBST-RH',
                price: 549,
            }],
        });
        const variantId = product.variants[0].variantId.toString();

        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(buildOrderBody(product.id, variantId, {
                items: [{
                    productId: product.id,
                    variantId,
                    configuration: 'Left-Handed',
                    finish: 'Sunburst',
                    quantity: 1,
                }],
            }));

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Variant selection mismatch for Fender Strat. Please refresh your cart and try again.');

        const unchangedProduct = await Product.findById(product.id);
        expect(unchangedProduct?.variants[0].stock).toBe(2);
    });
});
