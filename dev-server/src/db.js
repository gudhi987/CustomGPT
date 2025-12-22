import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/customgpt';
const DB_HEALTH_RETRY_INTERVAL = process.env.DB_HEALTH_RETRY_INTERVAL || 5000;

let isConnected = false;

/**
 * Connect to MongoDB using Mongoose
 */
export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('MongoDB connected successfully');
  } catch (error) {
    isConnected = false;
    console.error('MongoDB connection failed:', error.message);
    // Don't throw - let app continue without DB
  }
}

/**
 * Health check for MongoDB connection
 * Returns true if connected, false otherwise
 */
export async function checkDBHealth() {
  try {
    if (mongoose.connection.readyState !== 1) {
      // Connection not ready, try to reconnect
      if (mongoose.connection.readyState === 0) {
        // disconnected, try reconnecting
        await connectDB();
      }
      return false;
    }
    
    // Try a ping command to verify connection is truly healthy
    const result = await mongoose.connection.db.admin().ping();
    return result.ok === 1;
  } catch (error) {
    console.error('DB health check failed:', error.message);
    isConnected = false;
    return false;
  }
}

/**
 * Get MongoDB connection status
 */
export function isDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Get mongoose connection
 */
export function getConnection() {
  return mongoose.connection;
}

export default {
  connectDB,
  checkDBHealth,
  isDBConnected,
  getConnection,
};
