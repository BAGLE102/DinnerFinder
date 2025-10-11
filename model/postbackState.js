// model/postbackState.js
import crypto from 'crypto';
import { getDb } from '../config/mongo.js';

const COLL = 'postback_state';

async function ensureIndexes(db) {
  await db.collection(COLL).createIndex({ userId: 1, sid: 1 }, { unique: true });
  await db.collection(COLL).createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
}

function makeSid(len = 10) {
  // 短、小於 20 bytes，URL 安全
  return crypto.randomBytes(Math.ceil(len * 0.75)).toString('base64url').slice(0, len);
}

export async function saveState(userId, payload, ttlSec = 900) {
  const db = getDb();
  await ensureIndexes(db);
  const sid = makeSid(12);
  const doc = {
    userId,
    sid,
    payload,                     // 任何你想存的東西（token / 查詢條件 / 隨機條件）
    expireAt: new Date(Date.now() + ttlSec * 1000),
    createdAt: new Date(),
  };
  await db.collection(COLL).insertOne(doc);
  return sid;
}

export async function loadState(userId, sid) {
  const db = getDb();
  const doc = await db.collection(COLL).findOne({ userId, sid });
  return doc?.payload || null;
}

export async function deleteState(userId, sid) {
  const db = getDb();
  await db.collection(COLL).deleteOne({ userId, sid });
}
