// service/placesSearch.js
import axios from 'axios';
import config from '../config/config.js';


export async function searchNearby({ lat, lng, radius }) {
  const params = {
    location: `${lat},${lng}`,
    radius,
    type: 'restaurant',
    key: config.GOOGLE_API_KEY
  };

  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', { params });
    const rawResults = res.data.results || [];

    // 過濾出 restaurant/food 類型，避免學校、ATM 等誤入
    const filtered = rawResults.filter(place =>
      (place.types?.includes('restaurant') || place.types?.includes('food')) &&
      place.name && place.place_id
    );

    // 整理成你要的格式
    return filtered.map(p => ({
      id: p.place_id,
      name: p.name,
      rating: p.rating || null,
      address: p.vicinity || p.formatted_address || null,
      distance: p.distance_meters || null,
      photoUrl: (p.photos?.[0]?.photo_reference?.length < 200)
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${p.photos[0].photo_reference}&key=${config.GOOGLE_API_KEY}`
        : null,
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.place_id}`
    }));
  } catch (err) {
    console.error('❌ fetchNearbyPlaces error:', err.message);
    return [];
  }
}
