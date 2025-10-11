// service/randomRestaurant.js
import fetch from 'node-fetch';
import User from '../model/user.js';             // 依你的實際路徑；若是 models/User.js 就改路徑
import Restaurant from '../model/restaurant.js'; // 同上

const USE_PLACES_FALLBACK_WHEN_EMPTY = true; // 若 DB 沒資料，是否改用 Google Places 臨時抽店

async function getOneRandomFromDb(ownerKey) {
  const docs = await Restaurant.aggregate([
    { $match: { ownerUserId: ownerKey } },
    { $sample: { size: 1 } }
  ]);
  return docs[0]; // 可能為 undefined
}

async function pickOneFromPlaces(last, radius = 1500) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('缺少 GOOGLE_API_KEY');

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${last.lat},${last.lng}`);
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('keyword', 'restaurant');
  url.searchParams.set('language', 'zh-TW');
  url.searchParams.set('key', key);

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Google API HTTP ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data.results) || data.results.length === 0) return null;

  const idx = Math.floor(Math.random() * data.results.length);
  const p = data.results[idx];
  return {
    _id: null,
    name: p.name,
    address: p.vicinity || p.formatted_address || '',
    placeId: p.place_id,
    rating: p.rating,
    location: { lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng },
    source: 'places'
  };
}

/**
 * 隨機餐廳主流程
 * @param {object} source  - LINE event.source（含 userId / groupId）
 * @returns {object} { ok, text, restaurant }
 */
export async function randomRestaurant(source) {
  // 1) 決定 ownerKey（1:1 用 userId；群組建議用 groupId）
  const ownerUserId = source?.groupId || source?.roomId || source?.userId;
  if (!ownerUserId) {
    return { ok: false, text: '無法辨識對話來源，請在與機器人的 1:1 聊天視窗使用。' };
  }

  // 2) 找使用者資料，拿 lastLocation（for 提示 or Places fallback）
  const lineUserId = source.userId || ownerUserId; // 盡量用 userId 找個人設定
  const user = await User.findOne({ lineUserId }).lean();
  if (!user) {
    return { ok: false, text: '找不到你的使用者資料，請先跟我說個話或重新加入我。' };
  }

  // 3) 從 DB 隨機抽
  const picked = await getOneRandomFromDb(ownerUserId);
  if (picked) {
    // 避免存不存在 location 還去讀屬性
    const name = picked.name || '(未命名)';
    const addr = picked.address ? `\n📍 ${picked.address}` : '';
    return { ok: true, text: `今天就吃：${name}${addr}`, restaurant: picked };
  }

  // 4) DB 沒資料 → 視設定用 Places Fallback 或提示先新增
  if (!USE_PLACES_FALLBACK_WHEN_EMPTY) {
    return { ok: false, text: '你的清單目前沒有餐廳，先用「新增 店名」加入幾家吧～' };
  }

  if (!user.lastLocation || typeof user.lastLocation.lat !== 'number') {
    return { ok: false, text: '你的清單沒有餐廳；若要幫你從附近找，請先傳「位置訊息」更新所在地。' };
  }

  const nearby = await pickOneFromPlaces(user.lastLocation, 1500);
  if (!nearby) {
    return { ok: false, text: '附近暫時找不到餐廳，換個地點或加大半徑試試。' };
  }

  const hint = `（清單空白，先幫你從附近挑一間）`;
  const addr = nearby.address ? `\n📍 ${nearby.address}` : '';
  const star = nearby.rating ? `（⭐️${nearby.rating}）` : '';
  return { ok: true, text: `今天就吃：${nearby.name}${star}${addr}\n${hint}`, restaurant: nearby };
}

export default { randomRestaurant };
