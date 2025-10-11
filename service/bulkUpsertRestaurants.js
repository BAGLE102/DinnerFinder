// src/service/bulkUpsertRestaurants.js
import Restaurant from '../model/restaurant.js';

// 產生 namespaced place_id（避免跨使用者衝突、避免 null）
function buildNamespacedPlaceId(ownerUserId, p) {
  if (p.placeId) return `${ownerUserId}:${p.placeId}`;
  const namePart = (p.name || 'unknown').trim().toLowerCase();
  const coordPart = (p.location && typeof p.location.lat === 'number' && typeof p.location.lng === 'number')
    ? `${p.location.lat.toFixed(6)},${p.location.lng.toFixed(6)}`
    : 'no-coord';
  return `${ownerUserId}:${namePart}@${coordPart}`;
}

export default async function bulkUpsertRestaurants(ownerUserId, places = []) {
  if (!ownerUserId || !Array.isArray(places) || !places.length) {
    return { ok: true, nUpserted: 0 };
  }

  const ops = places
    .filter(p => p && (p.placeId || p.name)) // 避免空資料
    .map(p => {
      const pidNs = buildNamespacedPlaceId(ownerUserId, p);
      // 仍用「有 placeId 就以 placeId，否則用 name」來找舊資料
      const filter = p.placeId
        ? { ownerUserId, placeId: p.placeId }
        : { ownerUserId, name: p.name };

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
              placeId: p.placeId || null,   // 保留原始 Google placeId（可為 null）
              place_id: pidNs,              // 🔴 一定帶非空值，符合現有唯一索引
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
