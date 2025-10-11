// src/service/exploreRestaurant.js
import axios from 'axios';
import User from '../model/user.js';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// 粗略距離（公尺）
function haversine(lat1, lng1, lat2, lng2) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function normalizePlace(p, baseLat, baseLng) {
  const placeId = p.place_id;
  const name = p.name || '餐廳';
  const address = p.vicinity || p.formatted_address || '';
  const rating = p.rating;
  const lat = p.geometry?.location?.lat;
  const lng = p.geometry?.location?.lng;
  const distance = (typeof lat === 'number' && typeof lng === 'number')
    ? haversine(baseLat, baseLng, lat, lng)
    : undefined;
  const photoReference = p.photos?.[0]?.photo_reference;

  return {
    placeId,
    name,
    address,
    rating,
    location: (typeof lat === 'number' && typeof lng === 'number') ? { lat, lng } : undefined,
    distance,
    photoReference,
    source: 'google',
  };
}

// 呼叫舊版 Places Nearby Search（legacy）
async function callNearby({ lat, lng, radius, pagetoken }) {
  if (!GOOGLE_API_KEY) {
    return { ok: false, text: '缺少 GOOGLE_API_KEY', results: [] };
  }
  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  const params = pagetoken
    ? { pagetoken, key: GOOGLE_API_KEY }
    : {
        location: `${lat},${lng}`,
        radius,
        // 不限 type，讓食物相關的通通進來（想限縮可加 keyword 或 types）
        key: GOOGLE_API_KEY,
      };

  const { data } = await axios.get(url, { params, timeout: 10000 });
  // 常見錯誤訊息輔助
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    // NEXT_PAGE_TOKEN 需要數秒才會變可用；先讓使用者再按一次
    if (data.status === 'INVALID_REQUEST' && pagetoken) {
      return { ok: false, text: '還在準備下一頁，請再按一次「再 10 間」', results: [] };
    }
    const msg = data.error_message ? `${data.status} - ${data.error_message}` : data.status;
    return { ok: false, text: `Google API 錯誤：${msg}`, results: [] };
  }

  return {
    ok: true,
    results: data.results || [],
    nextPageToken: data.next_page_token || null,
    total: (data.results || []).length,
  };
}

/**
 * 主要：依使用者最後定位做附近搜尋
 * @param {string} lineUserId
 * @param {number} radius  (公尺)
 * @param {{limit?: number}} options
 * @returns {Promise<{ok:boolean, text?:string, results:Array, nextPageToken?:string, meta?:object}>}
 */
export default async function exploreRestaurant(lineUserId, radius = 1500, options = {}) {
  try {
    const user = await User.findOne({ lineUserId }).lean();
    const loc = user?.lastLocation;
    if (!loc?.lat || !loc?.lng) {
      return { ok: false, text: '請先傳送一次「位置資訊」再探索喔！' };
    }

    const api = await callNearby({ lat: loc.lat, lng: loc.lng, radius });
    if (!api.ok) return api;

    const results = api.results
      .map(p => normalizePlace(p, loc.lat, loc.lng))
      // 過濾掉沒有 placeId 的，避免之後寫 DB 觸發 unique index 衝突
      .filter(x => !!x.placeId);

    // 依距離排序一下（近→遠）
    results.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

    const limit = options.limit ?? 10;

    return {
      ok: true,
      results: results.slice(0, limit),     // 給前端/回覆顯示
      nextPageToken: api.nextPageToken,     // 讓 postback 再拿下一頁
      meta: { total: results.length, radius },
    };
  } catch (e) {
    console.error('[exploreRestaurant]', e.message);
    return { ok: false, text: '探索餐廳失敗，稍後再試' };
  }
}

/**
 * 用 next_page_token 取下一頁；距離計算仍用使用者最後定位
 * @param {string} lineUserId
 * @param {string} nextToken
 * @param {number} limit
 */
export async function exploreByNextToken(lineUserId, nextToken, limit = 10) {
  try {
    const user = await User.findOne({ lineUserId }).lean();
    const loc = user?.lastLocation;
    if (!loc?.lat || !loc?.lng) {
      return { ok: false, text: '定位遺失，請重新傳位置後再探索' };
    }

    const api = await callNearby({ lat: loc.lat, lng: loc.lng, pagetoken: nextToken });
    if (!api.ok) return api;

    const results = api.results
      .map(p => normalizePlace(p, loc.lat, loc.lng))
      .filter(x => !!x.placeId)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

    return {
      ok: true,
      results: results.slice(0, limit),
      nextPageToken: api.nextPageToken || null,
      meta: { total: results.length },
    };
  } catch (e) {
    console.error('[exploreByNextToken]', e.message);
    return { ok: false, text: '取得下一頁失敗，請再試一次' };
  }
}
