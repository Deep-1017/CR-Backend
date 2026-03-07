import app from './app';
import connectDB from './config/db';
import env from './config/env';
import mongoose from 'mongoose';
import logger from './utils/logger';

connectDB();

const server = app.listen(env.PORT, () => {
    logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

const shutdown = async (signal: string) => {
    logger.info(`${signal} received — starting graceful shutdown`);
    server.close(async () => {
        logger.info('HTTP server closed');
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
        process.exit(0);
    });
    // Force-kill if graceful shutdown takes too long
    setTimeout(() => {
        logger.error('Graceful shutdown timed out — forcing exit');
        process.exit(1);
    }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
    shutdown('unhandledRejection');
});
