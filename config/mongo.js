// config/mongo.js
import { MongoClient } from 'mongodb';

let client;
let db;

function inferDbNameFromUri(uri) {
  try {
    const after = uri.split('.net/')[1] || '';
    const path = after.split('?')[0] || '';
    return path || null;
  } catch { return null; }
}

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  if (!client) {
    client = new MongoClient(uri, { useUnifiedTopology: true });
    console.log('[Mongo] connecting to:', uri.replace(/\/\/.*@/,'//***@'));
    await client.connect();
    const fromUri = inferDbNameFromUri(uri);
    const dbName = process.env.MONGODB_DB || fromUri || 'line_dinner';
    db = client.db(dbName);
    console.log('[Mongo] dbName option =', fromUri ? '(from URI)' : dbName);
    await db.collection('users').createIndex({ lineUserId: 1 }, { unique: true });
    await db.collection('restaurants').createIndex({ place_id: 1 }, { unique: true, sparse: true });
  }
  return db;
}

export function getDb() {
  if (!db) throw new Error('DB not initialized. Call connectMongo() first.');
  return db;
}
