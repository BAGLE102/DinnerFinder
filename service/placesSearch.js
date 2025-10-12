// service/placesSearch.js
import axios from 'axios';

// ✅ 相容你的命名：GOOGLE_API_KEY 優先，其次 GOOGLE_MAPS_API_KEY
const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

export function hasPlacesApiKey() {
  return !!API_KEY;
}

// 只打印用到哪個變數名稱，不泄露 key
if (process.env.NODE_ENV !== 'production') {
  const which = process.env.GOOGLE_API_KEY
    ? 'GOOGLE_API_KEY'
    : (process.env.GOOGLE_MAPS_API_KEY ? 'GOOGLE_MAPS_API_KEY' : 'NONE');
  console.log(`[places] using key from: ${which}`);
}

export function buildPhotoUrl(photoReference) {
  if (!photoReference || !API_KEY) {
    return 'https://picsum.photos/1200/780?blur=2';
  }
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(photoReference)}&key=${API_KEY}`;
}

export async function fetchNearbyPlaces({ lat, lng, radius }) {
  // ❌ 不要再 throw：沒 key 就回空，讓上層用 DB 或回文字
  if (!API_KEY) {
    return { places: [], status: 'NO_API_KEY' };
  }

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radius),
    type: 'restaurant',
    keyword: 'restaurant|cafe|bakery|food',
    key: API_KEY,
  });

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const { data } = await axios.get(url, { timeout: 10000 });

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API error: ${data.status}`);
  }

  const places = (data.results || []).map((r) => ({
    place_id: r.place_id,
    name: r.name,
    rating: r.rating,
    vicinity: r.vicinity,
    photo_reference: r.photos?.[0]?.photo_reference || null,
    location: {
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
    },
  }));

  return { places, status: data.status };
}
