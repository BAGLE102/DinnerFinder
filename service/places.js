// service/places.js
import axios from 'axios';
import { getDb } from '../config/mongo.js';

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function nearbySearch({ lat, lng, radius, pagetoken }) {
  if (!GOOGLE_KEY) throw new Error('GOOGLE_MAPS_API_KEY is required');

  const params = new URLSearchParams({ key: GOOGLE_KEY, language: 'zh-TW' });
  if (pagetoken) {
    params.set('pagetoken', pagetoken);
  } else {
    params.set('location', `${lat},${lng}`);
    params.set('radius', String(radius));
    params.set('type', 'restaurant'); // 保守使用一個 type；要更廣可改 keyword
    // params.set('keyword','餐廳|小吃|早午餐|咖啡|麵|飯|便當'); // 可自行打開
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const { data } = await axios.get(url);
  return data; // {results, next_page_token, status}
}

export function enrichWithDistance(results, origin) {
  if (!origin) return results;
  const R = 6371000; // m
  const toRad = d => (d * Math.PI) / 180;
  return results.map(r => {
    const a = r.geometry?.location;
    if (!a) return r;
    const dLat = toRad(a.lat - origin.lat);
    const dLng = toRad(a.lng - origin.lng);
    const x = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(origin.lat)) * Math.cos(toRad(a.lat)) * Math.sin(dLng / 2) ** 2;
    const d = 2 * R * Math.asin(Math.sqrt(x));
    return { ...r, distance_m: Math.round(d), distanceText: `${Math.round(d)} m` };
  });
}

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
      }
    }));

  if (!ops.length) return { ok: 1, nUpserted: 0, nModified: 0 };

  try {
    const bulk = await db.collection('restaurants').bulkWrite(ops, { ordered: false });
    return bulk?.result || { ok: 1 };
  } catch (e) {
    // 常見：11000 duplicate key（重複 place_id）—可以忽略
    if (e.code !== 11000) {
      console.error('[saveRestaurants] bulk error', e);
    }
    return { ok: 1 };
  }
}
