// service/placesSearch.js
import fetch from 'node-fetch';

const API_KEY = process.env.GOOGLE_API_KEY; // 你的環境變數名稱就是這個
if (!API_KEY) throw new Error('GOOGLE_API_KEY is required');

const BASE = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

export async function searchNearby({ lat, lng, radius, pagetoken }) {
  const params = new URLSearchParams({
    key: API_KEY,
    location: `${lat},${lng}`,
    radius: String(radius || 1500),
    type: 'restaurant', // 過濾掉學院、ATM 之類
  });
  if (pagetoken) params.set('pagetoken', pagetoken);

  const url = `${BASE}?${params.toString()}`;
  const res = await fetch(url);
  const json = await res.json();

  // Google 會延遲才能用 next_page_token，邏輯交給上層決定要不要稍後再 call
  const places = (json.results || []).map((r) => ({
    place_id: r.place_id,
    name: r.name,
    rating: r.rating,
    user_ratings_total: r.user_ratings_total,
    address: r.vicinity,
    types: r.types,
    lat: r.geometry?.location?.lat,
    lng: r.geometry?.location?.lng,
    photo_reference: r.photos?.[0]?.photo_reference,
  }));

  return { places, nextPageToken: json.next_page_token || null, raw: json };
}

export function photoUrl(ref) {
  if (!ref) return null;
  const u = new URL('https://maps.googleapis.com/maps/api/place/photo');
  u.searchParams.set('maxwidth', '1200');
  u.searchParams.set('photo_reference', ref);
  u.searchParams.set('key', API_KEY);
  return u.toString();
}
