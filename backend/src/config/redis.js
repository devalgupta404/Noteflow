const redis = require('redis');

let redisClient;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('🔗 Redis Connected');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis Ready');
    });

    redisClient.on('end', () => {
      console.log('❌ Redis Connection Ended');
    });

    await redisClient.connect();
  } catch (error) {
    console.error('Redis connection failed:', error);
    // Don't exit process for Redis failures in development
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

module.exports = { connectRedis, getRedisClient };
