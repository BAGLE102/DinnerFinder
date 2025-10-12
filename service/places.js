// service/places.js
import axios from 'axios';
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function nearbySearch({ lat, lng, radius, pagetoken }) {
  if (!GOOGLE_KEY) throw new Error('GOOGLE_MAPS_API_KEY is required');

  const params = new URLSearchParams({ key: GOOGLE_KEY, language: 'zh-TW' });

  if (pagetoken) {
    await sleep(2000); // ← 關鍵：等 token 生效
    params.set('pagetoken', pagetoken);
  } else {
    params.set('location', `${lat},${lng}`);
    params.set('radius', String(radius));
    params.set('type', 'restaurant');
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const { data } = await axios.get(url);
  return data;
}
