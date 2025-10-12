// service/cachePlaces.js
import { getDb } from '../config/mongo.js';
import { fetchNearbyPlaces } from './placesSearch.js';

const GRID_STEP = 0.01; // ~1.1km
const STALE_MS = 1000 * 60 * 60 * 12; // 12 小時視為舊資料

function keyOf(lat, lng, radius) {
  const latQ = (Math.floor(lat / GRID_STEP) * GRID_STEP).toFixed(2);
  const lngQ = (Math.floor(lng / GRID_STEP) * GRID_STEP).toFixed(2);
  const radQ = Math.round(radius / 100) * 100;
  return `${latQ},${lngQ}@${radQ}`;
}

export async function getPlacesCached({ lat, lng, radius }) {
  const db = getDb();
  const col = db.collection('place_cache');
  const key = keyOf(lat, lng, radius);

  const doc = await col.findOne({ key });
  if (doc && doc.places?.length) {
    const age = Date.now() - new Date(doc.createdAt).getTime();
    if (age <= STALE_MS) {
      return { places: doc.places, source: 'db' };
    }
  }

  // 打 API
  const { places } = await fetchNearbyPlaces({ lat, lng, radius });

  // 寫回快取
  await col.updateOne(
    { key },
    {
      $set: {
        key,
        lat, lng, radius,
        places,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return { places, source: 'api' };
}
