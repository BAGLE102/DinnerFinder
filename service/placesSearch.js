// service/placesSearch.js
import axios from 'axios';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) throw new Error('GOOGLE_MAPS_API_KEY is required');

const NEARBY_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

/**
 * 近距離搜尋
 * - 若帶 pagetoken 則呼叫下一頁
 * - 否則用 lat/lng/radius 打第一頁
 * 回傳：{ places, nextPageToken }
 */
// 產生 Google Places Photo URL（有 ref 才回網址，沒有就回 null）
export function photoUrl(photo_reference, maxwidth = 1200) {
  if (!photo_reference) {
    console.warn('[placesSearch] photoUrl: missing photo_reference');
    return null;
  }
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(photo_reference)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
}

export async function searchNearby({ lat, lng, radius, pagetoken } = {}) {
  try {
    let url;
    if (pagetoken) {
      url = `${NEARBY_ENDPOINT}?pagetoken=${encodeURIComponent(pagetoken)}&key=${API_KEY}`;
      console.log('[placesSearch] searchNearby(nextPage)', { pagetoken });
    } else {
      const qs = new URLSearchParams({
        location: `${lat},${lng}`,
        radius: String(radius),
        // 你要餐廳就鎖 type=restaurant；要更廣可改成 food|restaurant
        type: 'restaurant',
        key: API_KEY,
      });
      url = `${NEARBY_ENDPOINT}?${qs.toString()}`;
      console.log('[placesSearch] searchNearby(firstPage)', { lat, lng, radius });
    }

    const { data } = await axios.get(url, { timeout: 10000 });

    // Google Places 會回 status，錯誤時把原因也印出來
    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[placesSearch] Google status != OK', {
        status: data.status,
        error_message: data.error_message,
      });
    }

    const shaped = shapeNearbyResults(data);
    console.log('[placesSearch] results', {
      count: shaped.places.length,
      hasNext: Boolean(shaped.nextPageToken),
    });

    return shaped;
  } catch (err) {
    console.error('[placesSearch] ERROR', err?.response?.data || err.message);
    throw err;
  }
}

/**
 * 下一頁包一層，讓其他檔案可以直接呼叫同名
 */
export async function searchNextPage(pageToken) {
  console.log('[placesSearch] searchNextPage()', { pageToken: pageToken ? 'present' : 'missing' });
  if (!pageToken) return { places: [], nextPageToken: null };
  return searchNearby({ pagetoken: pageToken });
}

/**
 * 把 Google 的回應整理成我們要的結構
 */
function shapeNearbyResults(data) {
  const places = (data?.results || []).map(r => ({
    place_id: r.place_id,
    name: r.name,
    rating: r.rating,
    user_ratings_total: r.user_ratings_total,
    // 方便做相片 URL
    photo_reference: r.photos?.[0]?.photo_reference || null,
    // 地址/鄰里
    vicinity: r.vicinity,
    // 距離計算會用到
    geometry: r.geometry,
    // 類型，之後若要過濾用得到
    types: r.types,
    permanently_closed:
      r.permanently_closed || r.business_status === 'CLOSED_PERMANENTLY' || false,
  }));

  // 注意：Google 的下一頁 token 可能要等 1~2 秒才會生效
  const nextPageToken = data?.next_page_token || null;
  return { places, nextPageToken };
}

/** 提供舊名稱的相容別名（給 cachePlaces.js 用） */
export { searchNearby as fetchNearbyPlaces, searchNextPage as fetchNextPage };

/** 也輸出一個預設物件，看誰喜歡怎麼用都行 */
export default {
  searchNearby,
  searchNextPage,
};
