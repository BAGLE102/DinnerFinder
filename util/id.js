// utils/id.js
import crypto from 'crypto';

export function shortId(len = 8) {
  // 產生隨機位元 + base64url，裁成 len 長度（Node 14 可用）
  return crypto.randomBytes(12).toString('base64')  // 標準 base64
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'') // 轉成 base64url
    .slice(0, len);
}
