import mongoose from 'mongoose';
import env from './env';
import logger from '../utils/logger';

const connectDB = async (retries = 5): Promise<void> => {
    try {
        await mongoose.connect(env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            autoIndex: !env.isProduction, // disable auto-indexing in production
        });
        logger.info(`MongoDB connected: ${mongoose.connection.host}`);
    } catch (err) {
        if (retries === 0) {
            logger.error('MongoDB connection failed after all retries', { err });
            process.exit(1);
        }
        logger.warn(`MongoDB connection failed — retrying in 5s (${retries} attempts left)`);
        await new Promise(r => setTimeout(r, 5000));
        return connectDB(retries - 1);
    }
};

export default connectDB;
