// 只貼「normalizeResults」這段，放回你的 exploreRestaurant.js 裡替換原本的 normalize
function normalizeResults(results, anchor) {
  const seen = new Set();
  const out = [];
  for (const p of (results || [])) {
    const placeId = p.place_id;
    const name = p.name?.trim() || '';
    // 以 placeId → name 作為 key 去重
    const key = placeId || name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const lat = p.geometry?.location?.lat;
    const lng = p.geometry?.location?.lng;

    out.push({
      placeId,
      name,
      rating: p.rating,
      address: p.vicinity || p.formatted_address || '',
      location: (lat!=null && lng!=null) ? { lat, lng } : undefined,
      distance: (anchor && lat!=null && lng!=null)
        ? distMeters(anchor, { lat, lng }) : undefined,
      // 新增：照片參考
      photoReference: Array.isArray(p.photos) && p.photos[0]?.photo_reference
        ? p.photos[0].photo_reference
        : undefined
    });
  }
  // 依距離排序
  out.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  return out;
}
