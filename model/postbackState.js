// model/postbackState.js
import { getDb } from '../config/mongo.js';
import { randomBytes } from 'crypto';

const COLL = 'postback_states';

// 建一次 TTL index（2 小時過期）
async function ensureIndex() {
  const db = getDb();
  try {
    await db.collection(COLL).createIndex({ createdAt: 1 }, { expireAfterSeconds: 7200 });
  } catch (_) {}
}

export async function saveState(userId, payload) {
  await ensureIndex();
  const db = getDb();
  const id = randomBytes(6).toString('base64url'); // 短、好傳
  await db.collection(COLL).insertOne({
    _id: id,
    userId,
    payload,
    createdAt: new Date(),
  });
  return id;
}

export async function loadState(userId, id) {
  if (!id) return null;
  const db = getDb();
  const doc = await db.collection(COLL).findOne({ _id: id, userId });
  return doc?.payload || null;
}

export async function deleteState(userId, id) {
  const db = getDb();
  await db.collection(COLL).deleteOne({ _id: id, userId });
}
