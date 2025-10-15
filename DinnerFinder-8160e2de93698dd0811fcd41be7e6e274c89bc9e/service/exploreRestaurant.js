// src/service/exploreRestaurant.js (Legacy Places API 版，default export)
import fetch from 'node-fetch';
import User from '../model/user.js';

// Haversine 距離（公尺）
function distMeters(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const A = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  const C = 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
  return Math.round(R * C);
}

async function fetchJson(url) {
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// 把 legacy results 正規化（含距離/照片）
function normalizeResults(results, anchor) {
  const seen = new Set();
  const out = [];
  for (const p of (results || [])) {
    const placeId = p.place_id;
    const name = (p.name || '').trim();
    const key = placeId || name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const lat = p.geometry?.location?.lat;
    const lng = p.geometry?.location?.lng;

    out.push({
      placeId,
      name,
      rating: p.rating,
      address: p.vicinity || p.formatted_address || '',
      location: (lat!=null && lng!=null) ? { lat, lng } : undefined,
      distance: (anchor && lat!=null && lng!=null) ? distMeters(anchor, { lat, lng }) : undefined,
      photoReference: Array.isArray(p.photos) && p.photos[0]?.photo_reference
        ? p.photos[0].photo_reference : undefined
    });
  }
  out.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  return out;
}

export default async function exploreRestaurant(lineUserId, radiusMeters = 1500, opts = {}) {
  const debug = !!opts.debug;
  const limit = Number(opts.limit) || 10;

  const user = await User.findOne({ lineUserId }).lean();
  if (!user) return { ok: false, text: '找不到使用者，請先跟我說話或重新加入好友。' };

  const last = user.lastLocation;
  if (!last || typeof last.lat !== 'number' || typeof last.lng !== 'number') {
    return { ok: false, text: '還沒有你的所在位置，請先傳一則「位置訊息」。' };
  }

  const key = process.env.GOOGLE_API_KEY;
  if (!key) return { ok: false, text: '未設定 GOOGLE_API_KEY，無法探索附近餐廳。' };

  const radius = Math.max(100, Math.min(50000, Number(radiusMeters) || 1500));
  const base = { lat: last.lat, lng: last.lng };

  const tries = [];

  // 1) nearby + type=restaurant
  const u1 = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  u1.searchParams.set('location', `${base.lat},${base.lng}`);
  u1.searchParams.set('radius', String(radius));
  u1.searchParams.set('type', 'restaurant');
  u1.searchParams.set('language', 'zh-TW');
  u1.searchParams.set('key', key);
  tries.push({ api: 'nearby', note: 'type=restaurant', url: u1 });

  // 2) nearby + keyword（中文常見）
  const u2 = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  u2.searchParams.set('location', `${base.lat},${base.lng}`);
  u2.searchParams.set('radius', String(radius));
  u2.searchParams.set('keyword', '餐廳|小吃|早午餐|便當|麵|飯|food');
  u2.searchParams.set('language', 'zh-TW');
  u2.searchParams.set('key', key);
  tries.push({ api: 'nearby', note: 'keyword=餐廳|小吃|…', url: u2 });

  // 3) textsearch
  const u3 = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  u3.searchParams.set('query', '餐廳');
  u3.searchParams.set('location', `${base.lat},${base.lng}`);
  u3.searchParams.set('radius', String(radius));
  u3.searchParams.set('language', 'zh-TW');
  u3.searchParams.set('key', key);
  tries.push({ api: 'textsearch', note: 'query=餐廳', url: u3 });

  const debugSteps = [];

  for (const t of tries) {
    const { ok, status, data } = await fetchJson(t.url.toString());
    const gStatus = data?.status;
    const errorMessage = data?.error_message;
    const list = normalizeResults(data?.results, base);
    debugSteps.push({ api: t.api, note: t.note, httpStatus: status, googleStatus: gStatus, errorMessage, count: list.length });

    if (ok && gStatus === 'OK' && list.length) {
      return {
        ok: true,
        results: list.slice(0, limit),
        meta: { api: t.api, note: t.note, total: list.length, radiusUsed: radius },
        ...(debug ? { debug: debugSteps } : {})
      };
    }

    if (ok && gStatus && gStatus !== 'ZERO_RESULTS') {
      const text = `Google ${t.api} 回傳：${gStatus}` + (errorMessage ? `\n${errorMessage}` : '');
      return { ok: false, text, ...(debug ? { debug: debugSteps } : {}) };
    }
  }

  const text = `附近暫時找不到餐廳（半徑 ${radius}m）。\n可試試「探索 3000 / 5000」或換個位置。`;
  return { ok: false, text, ...(debug ? { debug: debugSteps } : {}) };
}
