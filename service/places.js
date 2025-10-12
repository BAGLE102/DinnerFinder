// service/places.js
import axios from 'axios';
import { getDb } from '../config/mongo.js';

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

/** 低階 API 呼叫：附近或下一頁 */
export async function nearbySearch({ lat, lng, radius, pagetoken }) {
  if (!GOOGLE_KEY) throw new Error('GOOGLE_MAPS_API_KEY is required');

  const params = new URLSearchParams({ key: GOOGLE_KEY, language: 'zh-TW' });
  if (pagetoken) {
    params.set('pagetoken', pagetoken);
  } else {
    params.set('location', `${lat},${lng}`);
    params.set('radius', String(radius));
    params.set('type', 'restaurant');
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const { data } = await axios.get(url, { timeout: 10000 });
  return data; // {results, next_page_token, status, ...}
}

/** 幫結果加上距離（公尺） */
export function enrichWithDistance(results, origin) {
  if (!origin) return results;
  const R = 6371000; // m
  const toRad = d => (d * Math.PI) / 180;
  return (results || []).map(r => {
    const a = r.geometry?.location;
    if (!a) return r;
    const dLat = toRad(a.lat - origin.lat);
    const dLng = toRad(a.lng - origin.lng);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(origin.lat)) * Math.cos(toRad(a.lat)) * Math.sin(dLng / 2) ** 2;
    const d = 2 * R * Math.asin(Math.sqrt(x));
    return { ...r, distance_m: Math.round(d) };
  });
}

/** 把 Google Places 的單筆資料，轉成前端卡片需要的欄位 */
function mapPlace(r) {
  const placeId = r.place_id;
  const name = r.name || '未命名';
  const address = r.vicinity || r.formatted_address || '地址不詳';
  const rating = typeof r.rating === 'number' ? r.rating : undefined;

  let photoUrl;
  const ref = r.photos?.[0]?.photo_reference;
  if (ref) {
    photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(
      ref
    )}&key=${encodeURIComponent(GOOGLE_KEY)}`;
  }

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    name
  )}&query_place_id=${encodeURIComponent(placeId)}`;

  return {
    id: placeId,
    name,
    address,
    rating,
    photoUrl,
    mapUrl,
    // 你的 toBubbles 會顯示 `${p.distance} m`，所以傳數字（公尺）
    distance: typeof r.distance_m === 'number' ? r.distance_m : undefined,
  };
}

/** 把抓到的 rawResults 存 DB（可選，不影響回傳） */
export async function saveRestaurants(rawResults) {
  const db = getDb();
  const ops = (rawResults || [])
    .filter(r => r?.place_id)
    .map(r => ({
      updateOne: {
        filter: { place_id: r.place_id },
        update: {
          $set: {
            place_id: r.place_id,
            name: r.name,
            rating: r.rating ?? null,
            user_ratings_total: r.user_ratings_total ?? null,
            vicinity: r.vicinity ?? r.formatted_address ?? '',
            location: r.geometry?.location
              ? { lat: r.geometry.location.lat, lng: r.geometry.location.lng }
              : null,
            photo_reference: r.photos?.[0]?.photo_reference ?? null,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    }));

  if (!ops.length) return { ok: 1, nUpserted: 0, nModified: 0 };

  try {
    const bulk = await db.collection('restaurants').bulkWrite(ops, { ordered: false });
    // 新版 driver 直接回傳 bulk 物件，這裡給個穩定值
    return { ok: 1 };
  } catch (e) {
    if (e.code !== 11000) console.error('[saveRestaurants] bulk error', e);
    return { ok: 1 };
  }
}

/** 供 controller/message.js 使用：用座標查第一頁 */
export async function searchNearby({ lat, lng, radius }) {
  const data = await nearbySearch({ lat, lng, radius });
  // 加距離（公尺）
  const withDist = enrichWithDistance(data.results || [], { lat, lng });
  // （可選）保存資料庫
  try { await saveRestaurants(data.results || []); } catch (e) { /* 忽略失敗 */ }
  // 轉前端需要的欄位
  const places = withDist.map(mapPlace);
  return {
    places,
    nextPageToken: data.next_page_token || null,
  };
}

/** 供 controller/postback.js 使用：用 next_page_token 取下一頁 */
export async function getNextPage({ nextPageToken, origin }) {
  if (!nextPageToken) return { places: [], nextPageToken: null };

  const data = await nearbySearch({ pagetoken: nextPageToken });
  // Google 的 next_page_token 可能要等幾秒才會生效；這裡先不重試，由上層決定
  const results = data.results || [];
  const enriched = origin ? enrichWithDistance(results, origin) : results;

  try { await saveRestaurants(results); } catch (e) { /* 忽略失敗 */ }

  const places = enriched.map(mapPlace);
  return {
    places,
    nextPageToken: data.next_page_token || null,
  };
}
