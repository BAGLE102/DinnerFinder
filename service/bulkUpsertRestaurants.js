// src/service/bulkUpsertRestaurants.js
import Restaurant from '../model/restaurant.js';

export default async function bulkUpsertRestaurants(ownerUserId, places = []) {
  if (!ownerUserId || !Array.isArray(places) || !places.length) {
    return { ok: true, nUpserted: 0 };
  }

  const ops = places
    .filter(p => p && (p.placeId || p.name)) // 避免空資料
    .map(p => {
      const filter = p.placeId
        ? { ownerUserId, placeId: p.placeId }
        : { ownerUserId, name: p.name };

      // ⚠️ 重點：source 只放在 $setOnInsert，$set 不再設定 source
      return {
        updateOne: {
          filter,
          update: {
            $setOnInsert: {
              createdAt: new Date(),
              source: p.source || 'places'
            },
            $set: {
              name: p.name,
              address: p.address,
              placeId: p.placeId,
              location: p.location,
              rating: p.rating,
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      };
    });

  const ret = await Restaurant.bulkWrite(ops, { ordered: false });
  const nUpserted =
    (ret.upsertedCount || 0) +
    (ret.modifiedCount || 0) +
    (ret.matchedCount || 0);

  return { ok: true, nUpserted };
}
