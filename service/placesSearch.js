// service/placesSearch.js
import axios from 'axios';

function getApiKey() {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.MAPS_API_KEY ||
    null
  );
}

/** 安全組 photo URL；沒 key 或沒 photo_reference 就回 null，避免無效 URL 造成 400 */
export function photoUrl(photo_reference, maxwidth = 1200) {
  const key = getApiKey();
  if (!photo_reference || !key) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(
    photo_reference
  )}&key=${key}`;
}

function mapPlace(p) {
  const loc = p.geometry?.location || {};
  return {
    name: p.name || '',
    rating: p.rating,
    place_id: p.place_id,
    address: p.vicinity || p.formatted_address || '',
    lat: typeof loc.lat === 'number' ? loc.lat : undefined,
    lng: typeof loc.lng === 'number' ? loc.lng : undefined,
    photo_reference: Array.isArray(p.photos) && p.photos[0]?.photo_reference ? p.photos[0].photo_reference : undefined,
  };
}

/**
 * 近搜尋 (或用 next page token)
 * - 沒 key：不丟錯，回空陣列並印出清楚的 log
 */
export async function searchNearby({ lat, lng, radius = 1500, pageToken } = {}) {
  const key = getApiKey();
  if (!key) {
    console.warn('[placesSearch] GOOGLE_MAPS_API_KEY is missing. Will return empty results (DB-first flow will still work).');
    return { places: [], nextPageToken: null, error: 'NO_GOOGLE_KEY' };
  }

  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  const params = pageToken
    ? { key, pagetoken: pageToken }
    : {
        key,
        location: `${lat},${lng}`,
        radius: Math.min(Number(radius) || 1500, 50000),
        // 不改你原本的語意太多；保守用 keyword，避免抓到奇怪 POI
        keyword: 'restaurant',
      };

  try {
    const { data } = await axios.get(url, { params, timeout: 10000 });
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[placesSearch] API status=', data.status, 'message=', data.error_message);
      return { places: [], nextPageToken: null, error: data.status || 'API_ERROR' };
    }

    const places = (data.results || []).map(mapPlace);
    const nextPageToken = data.next_page_token || null;

    console.log(
      `[placesSearch] ok: count=${places.length}, hasNext=${!!nextPageToken}, status=${data.status}`
    );

    return { places, nextPageToken };
  } catch (e) {
    console.error('[placesSearch] request error:', e?.response?.status, e?.response?.data || e.message);
    return { places: [], nextPageToken: null, error: 'REQUEST_FAILED' };
  }
}

/** 取下一頁，包一層讓你沿用舊名稱 */
export async function searchNextPage(nextPageToken) {
  if (!nextPageToken) return { places: [], nextPageToken: null };
  return searchNearby({ pageToken: nextPageToken });
}

/** 兼容之前你在別檔 import 的別名 */
export { searchNearby as fetchNearbyPlaces, searchNextPage as fetchNextPage };
