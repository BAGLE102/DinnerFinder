import fetch from 'node-fetch';
import User from '../model/user.js';

export async function exploreRestaurant(lineUserId, radiusMeters = 1500) {
  const user = await User.findOne({ lineUserId }).lean();
  if (!user) throw new Error('NO_USER');
  if (!user.lastLocation || typeof user.lastLocation.lat !== 'number') throw new Error('NO_LOCATION');

  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('NO_GOOGLE_KEY');

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${user.lastLocation.lat},${user.lastLocation.lng}`);
  url.searchParams.set('radius', String(Number(radiusMeters) || 1500));
  url.searchParams.set('keyword', 'restaurant');
  url.searchParams.set('language', 'zh-TW');
  url.searchParams.set('key', key);

  const r = await fetch(url);
  const data = await r.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`PLACES_${data.status}`);
  }
  return (data.results || []).map(p => ({
    placeId: p.place_id,
    name: p.name,
    rating: p.rating,
    address: p.vicinity || p.formatted_address || '',
    location: { lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng }
  }));
}
