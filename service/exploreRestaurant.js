// service/exploreRestaurant.js
import fetch from 'node-fetch';
import User from '../model/user.js';

export default async function exploreRestaurant(lineUserId, radiusMeters = 1500) {
  const user = await User.findOne({ lineUserId }).lean();
  if (!user) return { ok: false, text: '找不到使用者，請先跟我說話或重新加入好友。' };

  const last = user.lastLocation;
  if (!last || typeof last.lat !== 'number' || typeof last.lng !== 'number') {
    return { ok: false, text: '還沒有你的所在位置，請先傳一則「位置訊息」。' };
  }

  const key = process.env.GOOGLE_API_KEY;
  if (!key) return { ok: false, text: '未設定 GOOGLE_API_KEY，無法探索附近餐廳。' };

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${last.lat},${last.lng}`);
  url.searchParams.set('radius', String(Number(radiusMeters) || 1500));
  url.searchParams.set('keyword', 'restaurant');
  url.searchParams.set('language', 'zh-TW');
  url.searchParams.set('key', key);

  const resp = await fetch(url);
  if (!resp.ok) return { ok: false, text: `Google API 失敗（${resp.status}）` };

  const data = await resp.json();
  const raw = data?.results || [];
  if (!raw.length) return { ok: false, text: '附近暫時找不到餐廳，換個地點或加大半徑試試。' };

  const results = raw.map(p => ({
    placeId: p.place_id,
    name: p.name,
    rating: p.rating,
    address: p.vicinity || p.formatted_address || '',
    location: { lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng }
  }));

  return { ok: true, results };
}
