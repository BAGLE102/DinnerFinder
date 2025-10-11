// 使用 native Mongo Driver 的 getDb()；如果你用的是 mongoose，就改成相同概念的 Model 即可
import crypto from 'crypto';
import { getDb } from '../config/mongo.js';

function genKey(len = 10) {
  // Node 14 沒有 'base64url'，手動轉
  return crypto.randomBytes(8).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'').slice(0, len);
}

export async function ensurePostbackIndexes() {
  const db = await getDb();
  await db.collection('postbacks').createIndex({ key: 1 }, { unique: true });
  // TTL：10 分鐘自動清
  await db.collection('postbacks').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

export async function savePostback(payload, { userId, ttlSec = 600 } = {}) {
  const db = await getDb();
  const key = genKey();
  const doc = {
    key,
    userId: userId || null,
    payload,                      // 這裡放 { type, nextPageToken, radius, keyword ... }
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + ttlSec * 1000)
  };
  await db.collection('postbacks').insertOne(doc);
  return key;
}

export async function loadPostback(key) {
  const db = await getDb();
  const doc = await db.collection('postbacks').findOne({ key });
  return doc ? doc.payload : null;
}
