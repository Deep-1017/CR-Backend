import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import swaggerUi from 'swagger-ui-express';
import productRoutes from './routes/product.routes';
import orderRoutes from './routes/order.routes';
import authRoutes from './routes/auth.routes';
import uploadRoutes from './routes/upload.routes';
import paymentRoutes from './routes/payment.routes';
import { notFound, errorHandler } from './middleware/error.middleware';
import env from './config/env';
import { morganStream } from './utils/logger';
import { swaggerSpec } from './config/swagger';

const app = express();

// Request ID
app.use((req, _res, next) => {
    req.id = uuidv4();
    next();
});

// Security & parsing middleware
const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(
    cors({
        origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : undefined,
        credentials: true,
    })
);
app.use(helmet());

// Morgan flows through Winston in all environments
app.use(morgan(env.isProduction ? 'combined' : 'dev', {
    stream: env.isProduction ? morganStream : undefined,
}));

// Body size limits
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', apiLimiter);
app.use('/api/v1/auth', authLimiter);

// Health endpoint
app.get('/health', (_req, res) => {
    const dbState = mongoose.connection.readyState;
    const status = dbState === 1 ? 'ok' : 'degraded';
    res.status(dbState === 1 ? 200 : 503).json({
        status,
        db: dbState === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Swagger / OpenAPI docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/payments', paymentRoutes);

// 404 and error handlers
app.use(notFound);
app.use(errorHandler);

export default app;