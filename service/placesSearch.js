// src/service/placesSearch.js
import axios from 'axios';

const API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GCP_API_KEY;

if (!API_KEY) {
  throw new Error('GOOGLE_MAPS_API_KEY is required');
}

// 只留吃的相關種類
const PLACE_TYPES = new Set(['restaurant', 'food', 'cafe', 'meal_takeaway', 'meal_delivery']);

// Haversine 算距離（公尺）
function haversine(lat1, lng1, lat2, lng2) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function isFoodPlace(p) {
  if (!Array.isArray(p.types)) return false;
  return p.types.some(t => PLACE_TYPES.has(t));
}

function buildPhotoUrl(photoRef) {
  if (!photoRef) return null;
  // 注意：這會把 API key 放在 URL 裡（LINE 端可見）。
  // 若不想暴露，之後可改成走你自家 proxy 圖片端點。
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(
    photoRef
  )}&key=${API_KEY}`;
}

function normalizePlaces(results, origin) {
  const seen = new Set();
  const out = [];
  for (const r of results || []) {
    if (!r.place_id || seen.has(r.place_id)) continue;
    seen.add(r.place_id);

    // 過濾非餐廳
    if (!isFoodPlace(r)) continue;

    const loc = r.geometry?.location;
    const dist =
      loc && origin
        ? Math.round(haversine(origin.lat, origin.lng, loc.lat, loc.lng))
        : null;

    out.push({
      place_id: r.place_id,
      name: r.name,
      rating: r.rating,
      vicinity: r.vicinity || r.formatted_address || '',
      types: r.types || [],
      geometry: { location: { lat: loc?.lat, lng: loc?.lng } },
      photo_url: buildPhotoUrl(r.photos?.[0]?.photo_reference),
      distance_m: dist,
      price_level: r.price_level ?? null,
    });
  }
  return out;
}

/**
 * 依座標搜尋附近餐廳
 * @param {{lat:number,lng:number,radius:number}} params
 * @returns {Promise<{places:Array,nextPageToken:string|null}>}
 */
export async function searchNearby({ lat, lng, radius = 1500 }) {
  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  // 用 type=restaurant，結果再用 PLACE_TYPES 兜底過濾
  const params = {
    key: API_KEY,
    location: `${lat},${lng}`,
    radius,
    type: 'restaurant',
    // keyword: 'food', // 想擴散可打開，但 type 先足夠
    language: 'zh-TW',
  };

  const { data } = await axios.get(url, { params });
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS' && data.status !== 'OVER_QUERY_LIMIT' && data.status !== 'INVALID_REQUEST') {
    // 其他非致命狀態也放過，但記錄在 console
    console.warn('[placesSearch] unexpected status:', data.status, data.error_message);
  }

  const places = normalizePlaces(data.results, { lat, lng });
  return { places, nextPageToken: data.next_page_token || null };
}

/**
 * 取得下一頁
 * @param {string} nextPageToken
 * @returns {Promise<{places:Array,nextPageToken:string|null}>}
 */
export async function searchNextPage(nextPageToken) {
  if (!nextPageToken) return { places: [], nextPageToken: null };

  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  const params = {
    key: API_KEY,
    pagetoken: nextPageToken,
    language: 'zh-TW',
  };

  // Google 規定 next_page_token 需要數秒才會生效；前端是「再 10 間」點擊才打，
  // 通常已過了幾秒。如果還是 INVALID_REQUEST，就回空陣列讓你顯示已無更多。
  const { data } = await axios.get(url, { params });

  if (data.status === 'INVALID_REQUEST') {
    return { places: [], nextPageToken: null };
  }

  // 這裡沒有原始 lat/lng，因此不算距離（留空）。
  const places = normalizePlaces(data.results, null);
  return { places, nextPageToken: data.next_page_token || null };
}
