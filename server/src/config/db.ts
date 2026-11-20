import mongoose from 'mongoose';
import { createLogger, type Logger } from '../utils/logger.js';

export type DbConfig = { MONGODB_URI: string } | string;

export async function connectDb(
  config: DbConfig,
  customLogger?: Logger
): Promise<void> {
  const uri = typeof config === 'string' ? config : config.MONGODB_URI;
  const log = customLogger ?? createLogger();

  mongoose.set('sanitizeFilter', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  log.info('Database connection established');
}

export async function disconnectDb(customLogger?: Logger): Promise<void> {
  const log = customLogger ?? createLogger();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    log.info('Database connection closed');
  }
}
