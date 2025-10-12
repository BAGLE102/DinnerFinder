// service/placesSearch.js
import fetch from 'node-fetch';

export async function searchNearby({ lat, lng, radius, pagetoken }) {
  const params = new URLSearchParams({
    key: process.env.GMAPS_API_KEY,
    location: `${lat},${lng}`,
    radius: String(radius),
    type: 'restaurant'
  });
  if (pagetoken) params.set('pagetoken', pagetoken);

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`;
  const res = await fetch(url);
  const json = await res.json();

  const places = (json.results || []).map(r => ({
    id: r.place_id,
    name: r.name,
    rating: r.rating,
    address: r.vicinity,
    mapUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${r.place_id}`,
    photoUrl: r.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${r.photos[0].photo_reference}&key=${process.env.GMAPS_API_KEY}`
      : undefined,
    // 你若有自行計算距離，從外部塞進來即可
  }));

  return { places, nextPageToken: json.next_page_token || null };
}
