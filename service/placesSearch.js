// service/placesSearch.js
import axios from 'axios';
import config from '../config/config.js';


export async function searchNearby({ lat, lng, radius }) {
  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  const params = {
    location: `${lat},${lng}`,
    radius,
    type: 'restaurant',
    key: config.GOOGLE_API_KEY
  };

  const res = await axios.get(url, { params });
  const results = res.data.results || [];

  return results.slice(0, 20).map(r => ({
    id: r.place_id,
    name: r.name,
    rating: r.rating,
    address: r.vicinity,
    photoUrl: r.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${r.photos[0].photo_reference}&key=${config.GOOGLE_API_KEY}`
      : null,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.place_id}`,
    distance: r.distance_meters || 0
  }));
}
