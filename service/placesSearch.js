// service/placesSearch.js
import axios from 'axios';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) throw new Error('GOOGLE_MAPS_API_KEY is required');

export function buildPhotoUrl(photoReference) {
  if (!photoReference) return 'https://picsum.photos/1200/780?blur=2';
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(photoReference)}&key=${API_KEY}`;
}

export async function fetchNearbyPlaces({ lat, lng, radius }) {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radius),
    type: 'restaurant',
    keyword: 'restaurant|cafe|bakery|food',
    key: API_KEY,
  });

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const { data } = await axios.get(url, { timeout: 10000 });

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API error: ${data.status}`);
  }

  const places = (data.results || []).map((r) => ({
    place_id: r.place_id,
    name: r.name,
    rating: r.rating,
    vicinity: r.vicinity,
    photo_reference: r.photos?.[0]?.photo_reference || null,
    location: { lat: r.geometry?.location?.lat, lng: r.geometry?.location?.lng },
  }));

  return { places };
}
