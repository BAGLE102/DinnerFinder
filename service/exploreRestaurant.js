// src/service/exploreRestaurant.js
import fetch from 'node-fetch';
import User from '../model/user.js';

// ===== 小工具：Haversine 距離（公尺）=====
function distMeters(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const A =
    s1 * s1 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  const C = 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
  return Math.round(R * C);
}

async function fetchJson(url) {
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// 將 Google Places result 轉成我們的結構
function normalizeResults(results, anchor) {
  return (results || []).map(p => ({
    placeId: p.place_id,
    name: p.name,
    rating: p.rating,
    address: p.vicinity || p.formatted_address || '',
    location: {
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng
    },
    distance: (anchor && p.geometry?.location)
      ? distMeters(anchor, { lat: p.geometry.location.lat, lng: p.geometry.location.lng })
      : undefined
  }));
}

/**
 * 探索附近餐廳
 * @param {string} lineUserId
 * @param {number} radiusMeters
 * @param {{debug?: boolean, limit?: number}} opts
 */
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

  // 半徑：夾在 100 ~ 50,000 公尺
  const radius = Math.max(100, Math.min(50000, Number(radiusMeters) || 1500));
  const base = { lat: last.lat, lng: last.lng };

  const tries = [];

  // 1) Nearby + type=restaurant
  const nearby1 = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  nearby1.searchParams.set('location', `${base.lat},${base.lng}`);
  nearby1.searchParams.set('radius', String(radius));
  nearby1.searchParams.set('type', 'restaurant');
  nearby1.searchParams.set('language', 'zh-TW');
  nearby1.searchParams.set('key', key);
  tries.push({ api: 'nearby', note: 'type=restaurant', url: nearby1 });

  // 2) Nearby + keyword（中文常見關鍵詞）
  const nearby2 = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  nearby2.searchParams.set('location', `${base.lat},${base.lng}`);
  nearby2.searchParams.set('radius', String(radius));
  nearby2.searchParams.set('keyword', '餐廳|小吃|早午餐|便當|麵|飯|food');
  nearby2.searchParams.set('language', 'zh-TW');
  nearby2.searchParams.set('key', key);
  tries.push({ api: 'nearby', note: 'keyword=餐廳|小吃|…', url: nearby2 });

  // 3) Text Search（有些地區 nearby 會 0 筆，用 textsearch 可補）
  const text = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  text.searchParams.set('query', '餐廳');
  text.searchParams.set('location', `${base.lat},${base.lng}`);
  text.searchParams.set('radius', String(radius));
  text.searchParams.set('language', 'zh-TW');
  text.searchParams.set('key', key);
  tries.push({ api: 'textsearch', note: 'query=餐廳', url: text });

  const debugSteps = [];
  for (const t of tries) {
    const { ok, status, data } = await fetchJson(t.url.toString());
    const gStatus = data?.status;
    const errorMessage = data?.error_message;
    const raw = Array.isArray(data?.results) ? data.results : [];
    const results = normalizeResults(raw, base)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

    debugSteps.push({
      api: t.api,
      note: t.note,
      httpStatus: status,
      googleStatus: gStatus,
      errorMessage,
      count: results.length
    });

    if (ok && gStatus === 'OK' && results.length) {
      return {
        ok: true,
        results: results.slice(0, limit),
        meta: {
          api: t.api,
          note: t.note,
          total: results.length,
          radiusUsed: radius
        },
        ...(debug ? { debug: debugSteps } : {})
      };
    }

    // ZERO_RESULTS 就換下一個策略；其他錯直接回傳
    if (ok && gStatus && gStatus !== 'ZERO_RESULTS') {
      const text =
        `Google ${t.api} 回傳：${gStatus}` +
        (errorMessage ? `\n${errorMessage}` : '');
      return { ok: false, text, ...(debug ? { debug: debugSteps } : {}) };
    }
  }

  // 全都 0 筆
  const textMsg =
    `附近暫時找不到餐廳（半徑 ${radius}m）。` +
    `\n可傳更大的數字：探索 3000、5000；或換個位置再試。`;
  return { ok: false, text: textMsg, ...(debug ? { debug: debugSteps } : {}) };
}
