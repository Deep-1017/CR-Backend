import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app';

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI!;

if (!process.env.JWT_SECRET) {
  console.error('[Fatal] JWT_SECRET is not defined. Exiting.');
  process.exit(1);
}

const connectDB = async (retries = 5): Promise<void> => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] MongoDB connected');
  } catch (err) {
    if (retries > 0) {
      console.warn(`[DB] Retrying in 3s... (${retries} attempts left)`);
      await new Promise((r) => setTimeout(r, 3000));
      return connectDB(retries - 1);
    }
    console.error('[DB] Failed to connect:', err);
    process.exit(1);
  }
};

const start = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`[Server] http://localhost:${PORT}  (${process.env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n[Server] ${signal} — shutting down gracefully...`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start();
