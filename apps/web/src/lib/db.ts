import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pageforge';

interface CachedConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Use global cache for Next.js hot reload in dev
const globalWithMongoose = globalThis as typeof globalThis & {
  _mongooseCache?: CachedConnection;
};

const cached: CachedConnection = globalWithMongoose._mongooseCache || {
  conn: null,
  promise: null,
};

globalWithMongoose._mongooseCache = cached;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
