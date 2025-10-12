// service/tokenStore.js
import crypto from 'crypto';

const store = new Map(); // id -> { token, expireAt }
const TTL_MS = 5 * 60 * 1000; // 5 分鐘

function gc() {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expireAt <= now) store.delete(k);
  }
}

export async function saveToken({ userId, token }) {
  gc();
  const id = 'nx_' + crypto.randomBytes(4).toString('hex');
  store.set(id, { token, userId, expireAt: Date.now() + TTL_MS });
  return id;
}

export async function loadToken(id) {
  gc();
  const v = store.get(id);
  if (!v) return null;
  return v.token;
}
