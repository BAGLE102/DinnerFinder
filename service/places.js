const axios = require('axios');

const { GOOGLE_API_KEY } = process.env;
if (!GOOGLE_API_KEY) {
  console.error('Missing GOOGLE_API_KEY');
  process.exit(1);
}

async function searchNearby({ lat, lng, radius, nextPageToken }) {
  const params = nextPageToken
    ? { pagetoken: nextPageToken, key: GOOGLE_API_KEY }
    : {
        location: `${lat},${lng}`,
        radius,
        type: 'restaurant',
        language: 'zh-TW',
        key: GOOGLE_API_KEY,
      };
  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  const { data } = await axios.get(url, { params });
  // 取前 10 個即可（保守）
  const list = (data.results || []).slice(0, 10).map(normalizePlace);
  return { results: list, nextPageToken: data.next_page_token || null };
}

function normalizePlace(p) {
  if (!p) return {};
  const lat = p.geometry?.location?.lat;
  const lng = p.geometry?.location?.lng;
  return {
    place_id: p.place_id,
    name: p.name,
    rating: p.rating ? `⭐ ${p.rating}` : '',
    address: p.vicinity || p.formatted_address || '',
    photoRef: p.photos?.[0]?.photo_reference || '',
    photoUrl: p.photos?.[0]?.photo_reference
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${p.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
      : '',
    lat, lng,
    mapUrl: p.place_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.place_id}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`,
  };
}

function pickOne(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  searchNearby,
  pickOne,
  normalizePlace,
};
