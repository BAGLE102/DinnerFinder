// service/places.js
import axios from 'axios';

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function nearbySearch({ lat, lng, radius, pagetoken }) {
  if (!GOOGLE_KEY) throw new Error('GOOGLE_MAPS_API_KEY is required');

  const params = new URLSearchParams({ key: GOOGLE_KEY, language: 'zh-TW' });

  if (pagetoken) {
    // Google Places next_page_token 需要延遲 ~2 秒才會生效
    await sleep(2000);
    params.set('pagetoken', pagetoken);
  } else {
    params.set('location', `${lat},${lng}`);
    params.set('radius', String(radius));
    params.set('type', 'restaurant');
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const { data } = await axios.get(url);
  return data; // { results, next_page_token, status, ... }
}

// === 新增這兩個 named exports，讓 controller 可直接用 ===
export async function searchNearby({ lat, lng, radius }) {
  return nearbySearch({ lat, lng, radius });
}

export async function getNextPage({ pagetoken }) {
  return nearbySearch({ pagetoken });
}
