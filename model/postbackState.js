// src/model/postbackState.js
import crypto from 'crypto';
import mongoose from 'mongoose';

function col() {
  const db = mongoose.connection?.db;
  if (!db) throw new Error('[postbacks] MongoDB not connected yet');
  return db.collection('postbacks');
}

// 產生短 key（URL-safe）
function genKey(len = 10) {
  return crypto
    .randomBytes(8)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/,'')
    .slice(0, len);
}

export async function ensurePostbackIndexes() {
  const c = col();
  await c.createIndex({ key: 1 }, { unique: true, name: 'key_unique' });
  // TTL：10 分鐘自動過期
  await c.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expiresAt' });
}

export async function savePostback(payload, { userId, ttlSec = 600 } = {}) {
  const c = col();
  const key = genKey();
  const doc = {
    key,
    userId: userId || null,
    payload,                        // { type, nextPageToken, radius, ... }
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + ttlSec * 1000),
  };
  await c.insertOne(doc);
  return key;
}

export async function loadPostback(key) {
  const c = col();
  const doc = await c.findOne({ key });
  return doc ? doc.payload : null;
}
