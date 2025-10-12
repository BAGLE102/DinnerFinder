// config/mongo.js
import { MongoClient } from 'mongodb';

let _client = null;
let _db = null;

export async function connectMongo() {
  if (_db) return _db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  const dbName = process.env.MONGODB_DB || 'what_to_eat_today';
  _client = new MongoClient(uri, { maxPoolSize: 5 });
  await _client.connect();
  _db = _client.db(dbName);
  console.log('[mongo] connected');
  return _db;
}

export function getDb() {
  if (!_db) throw new Error('Mongo not connected yet');
  return _db;
}

// 建索引（快取 key 與 TTL）
export async function ensureIndexes() {
  const db = getDb();
  const col = db.collection('place_cache');
  await col.createIndex({ key: 1 }, { unique: true });
  // TTL：預設 3 天過期（可改）
  try {
    await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 3 });
  } catch (e) {
    // 有些託管環境用舊版，若失敗就略過，程式內還會做時間檢查
  }
}
