import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { Express } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import Product from '../models/product.model';

let app: Express;
let mongoServer: MongoMemoryServer;

const JWT_SECRET = 'variant-test-secret';
const adminToken = jwt.sign(
    { id: new mongoose.Types.ObjectId().toString(), email: 'admin@example.com', role: 'admin' },
    JWT_SECRET
);
const customerToken = jwt.sign(
    { id: new mongoose.Types.ObjectId().toString(), email: 'customer@example.com', role: 'customer' },
    JWT_SECRET
);

const createProduct = async (overrides: Record<string, unknown> = {}) =>
    Product.create({
        name: 'Test Guitar',
        category: 'Speakers',
        basePrice: 499,
        image: '/assets/test-guitar.jpg',
        description: 'A test guitar',
        brand: 'TestBrand',
        ...overrides,
    });

beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

    app = (await import('../app')).default;
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    await Product.deleteMany({});
});

describe('Product variant endpoints', () => {
    it('GET /api/products/:productId/variants returns variants with stock metadata', async () => {
        const product = await createProduct({
            variants: [
                {
                    configuration: 'Right-Handed',
                    finish: 'Sunburst',
                    stock: 3,
                    sku: 'GTR-001-SUNBST-RH',
                },
                {
                    configuration: 'Left-Handed',
                    finish: 'Natural',
                    stock: 0,
                    sku: 'GTR-001-NAT-LH',
                    price: 549,
                    images: ['/assets/natural-left.jpg'],
                },
            ],
        });

        const res = await request(app).get(`/api/v1/products/${product.id}/variants`);

        expect(res.status).toBe(200);
        expect(res.body.totalStock).toBe(3);
        expect(res.body.availableConfigurations).toEqual(['Right-Handed', 'Left-Handed']);
        expect(res.body.availableFinishes).toEqual(['Sunburst', 'Natural']);
        expect(res.body.variants).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    sku: 'GTR-001-SUNBST-RH',
                    stock: 3,
                    inStock: true,
                }),
                expect.objectContaining({
                    sku: 'GTR-001-NAT-LH',
                    stock: 0,
                    price: 549,
                    images: ['/assets/natural-left.jpg'],
                    inStock: false,
                }),
            ])
        );
    });

    it('POST /api/products/:productId/variants requires admin auth and creates a variant', async () => {
        const product = await createProduct();
        const variantBody = {
            configuration: 'Right-Handed',
            finish: 'Sunburst',
            stock: 4,
            sku: 'GTR-002-SUNBST-RH',
        };

        const unauthenticated = await request(app)
            .post(`/api/v1/products/${product.id}/variants`)
            .send(variantBody);
        expect(unauthenticated.status).toBe(401);

        const forbidden = await request(app)
            .post(`/api/v1/products/${product.id}/variants`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send(variantBody);
        expect(forbidden.status).toBe(403);

        const res = await request(app)
            .post(`/api/v1/products/${product.id}/variants`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(variantBody);

        expect(res.status).toBe(201);
        expect(res.body.variants).toHaveLength(1);
        expect(res.body.variants[0]).toEqual(expect.objectContaining(variantBody));
        expect(res.body.stockCount).toBe(4);
        expect(res.body.inStock).toBe(true);
        expect(res.body.availableConfigurations).toEqual(['Right-Handed']);
        expect(res.body.availableFinishes).toEqual(['Sunburst']);
    });

    it('POST rejects duplicate SKUs across all products', async () => {
        await createProduct({
            name: 'Existing Product',
            variants: [{
                configuration: 'Right-Handed',
                finish: 'Sunburst',
                stock: 2,
                sku: 'GTR-003-SUNBST-RH',
            }],
        });
        const product = await createProduct({ name: 'Target Product' });

        const res = await request(app)
            .post(`/api/v1/products/${product.id}/variants`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                configuration: 'Left-Handed',
                finish: 'Natural',
                stock: 1,
                sku: 'GTR-003-SUNBST-RH',
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Variant SKU already exists');
    });

    it('PATCH /api/products/:productId/variants/:variantId updates provided fields and stock totals', async () => {
        const product = await createProduct({
            variants: [
                {
                    configuration: 'Right-Handed',
                    finish: 'Sunburst',
                    stock: 3,
                    sku: 'GTR-004-SUNBST-RH',
                },
                {
                    configuration: 'Left-Handed',
                    finish: 'Natural',
                    stock: 2,
                    sku: 'GTR-004-NAT-LH',
                },
            ],
        });
        const variantId = product.variants[0].variantId.toString();

        const res = await request(app)
            .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                finish: 'Gloss Black',
                stock: 7,
                sku: 'GTR-004-GLBLK-RH',
            });

        expect(res.status).toBe(200);
        expect(res.body.stockCount).toBe(9);
        expect(res.body.availableFinishes).toEqual(['Gloss Black', 'Natural']);
        expect(res.body.variants).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    variantId,
                    configuration: 'Right-Handed',
                    finish: 'Gloss Black',
                    stock: 7,
                    sku: 'GTR-004-GLBLK-RH',
                }),
            ])
        );
    });

    it('PATCH rejects SKU conflicts except for the current variant', async () => {
        await createProduct({
            name: 'Other Product',
            variants: [{
                configuration: 'Right-Handed',
                finish: 'Cherry Red',
                stock: 2,
                sku: 'GTR-005-CHRRED-RH',
            }],
        });
        const product = await createProduct({
            name: 'Target Product',
            variants: [{
                configuration: 'Left-Handed',
                finish: 'Natural',
                stock: 1,
                sku: 'GTR-005-NAT-LH',
            }],
        });
        const variantId = product.variants[0].variantId.toString();

        const sameSkuRes = await request(app)
            .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ sku: 'GTR-005-NAT-LH', stock: 3 });
        expect(sameSkuRes.status).toBe(200);

        const conflictRes = await request(app)
            .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ sku: 'GTR-005-CHRRED-RH' });
        expect(conflictRes.status).toBe(409);
        expect(conflictRes.body.message).toBe('Variant SKU already exists');
    });

    it('returns 404 when updating or deleting a missing variant', async () => {
        const product = await createProduct();
        const missingVariantId = new mongoose.Types.ObjectId().toString();

        const patchRes = await request(app)
            .patch(`/api/v1/products/${product.id}/variants/${missingVariantId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ stock: 1 });
        expect(patchRes.status).toBe(404);
        expect(patchRes.body.message).toBe('Variant not found');

        const deleteRes = await request(app)
            .delete(`/api/v1/products/${product.id}/variants/${missingVariantId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(deleteRes.status).toBe(404);
        expect(deleteRes.body.message).toBe('Variant not found');
    });

    it('DELETE /api/products/:productId/variants/:variantId removes variant and recalculates filters', async () => {
        const product = await createProduct({
            variants: [
                {
                    configuration: 'Right-Handed',
                    finish: 'Sunburst',
                    stock: 4,
                    sku: 'GTR-006-SUNBST-RH',
                },
                {
                    configuration: 'Left-Handed',
                    finish: 'Natural',
                    stock: 5,
                    sku: 'GTR-006-NAT-LH',
                },
            ],
        });
        const variantId = product.variants[0].variantId.toString();

        const res = await request(app)
            .delete(`/api/v1/products/${product.id}/variants/${variantId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.variants).toHaveLength(1);
        expect(res.body.stockCount).toBe(5);
        expect(res.body.availableConfigurations).toEqual(['Left-Handed']);
        expect(res.body.availableFinishes).toEqual(['Natural']);
    });
});
