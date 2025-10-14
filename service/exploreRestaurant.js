// src/service/exploreRestaurant.js
import axios from 'axios';
import { randomBytes } from 'crypto';

const API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  throw new Error('GOOGLE_MAPS_API_KEY is required');
}

// ---- 短期記憶：存放 next_page_token，避免 postback 超過 300 bytes ----
const tokenStore = new Map(); // id -> { token, params:{lat,lng,radius}, expire }

function saveMoreToken(token, params) {
  // 8~10字元短碼：base64url
  const id = randomBytes(6).toString('base64url');
  const expire = Date.now() + 15 * 60 * 1000; // 15 分鐘
  tokenStore.set(id, { token, params, expire });
  return id;
}

export function resolveMoreKey(id) {
  const rec = tokenStore.get(id);
  if (!rec) return null;
  if (rec.expire < Date.now()) {
    tokenStore.delete(id);
    return null;
  }
  return rec; // { token, params }
}

// ---- Google Places ----
async function nearbySearch({ lat, lng, radius, pagetoken }) {
  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  const params = {
    key: API_KEY,
    location: `${lat},${lng}`,
    radius,
    type: 'restaurant', // 只要餐廳
    // keyword: '餐廳|食物|小吃|飲料', // 有需要可開
  };
  if (pagetoken) params.pagetoken = pagetoken;

  const { data } = await axios.get(url, { params });

  // OK / ZERO_RESULTS 以外都視為錯誤
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places Nearby error: ${data.status}`);
  }
  return data;
}

// ---- Util ----
function metersBetween(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const d = 2 * R * Math.asin(Math.sqrt(x));
  return Math.round(d);
}

function photoUrl(ref) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(
    ref
  )}&key=${API_KEY}`;
}

function makeBubble(place, origin) {
  const name = place.name || '未命名餐廳';
  const rating = place.rating ? `⭐ ${place.rating}` : null;
  const distance =
    place.geometry?.location
      ? `${metersBetween(
          origin,
          { lat: place.geometry.location.lat, lng: place.geometry.location.lng }
        )} m`
      : null;
  const addr = place.vicinity || place.formatted_address || '';

  const bodyContents = [
    { type: 'text', text: name, weight: 'bold', size: 'lg', wrap: true },
  ];

  const baseline = [];
  if (rating) baseline.push({ type: 'text', text: rating, size: 'sm', color: '#777' });
  if (distance) baseline.push({ type: 'text', text: distance, size: 'sm', color: '#777' });
  if (baseline.length) {
    bodyContents.push({
      type: 'box',
      layout: 'baseline',
      spacing: 'sm',
      contents: baseline,
    });
  }
  if (addr) {
    bodyContents.push({ type: 'text', text: addr, size: 'sm', color: '#555', wrap: true });
  }

  const actions = [
    {
      type: 'button',
      style: 'primary',
      height: 'sm',
      action: {
        type: 'postback',
        label: '就吃這間',
        data: `action=choose&id=${encodeURIComponent(place.place_id)}`,
        displayText: `就吃 ${name}`,
      },
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'postback',
        label: '加入清單',
        data: `action=add&id=${encodeURIComponent(place.place_id)}`,
        displayText: `加入 ${name}`,
      },
    },
    {
      type: 'button',
      style: 'link',
      height: 'sm',
      action: {
        type: 'uri',
        label: '在地圖開啟',
        uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          name
        )}&query_place_id=${place.place_id}`,
      },
    },
  ];

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: bodyContents,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: actions,
    },
  };

  // 有照片再放 hero，避免壞圖
  const ref = place.photos?.[0]?.photo_reference;
  if (ref) {
    bubble.hero = {
      type: 'image',
      url: photoUrl(ref),
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
    };
  }

  return bubble;
}

// ---- Default：探索（回 10 間 + 再 10 間按鈕）----
export default async function exploreRestaurant({
  lat,
  lng,
  radius = 1500,
  pageToken = null,
}) {
  const res = await nearbySearch({ lat, lng, radius, pagetoken: pageToken });
  const results = Array.isArray(res.results) ? res.results : [];

  const bubbles = results.slice(0, 10).map((p) => makeBubble(p, { lat, lng }));

  // Quick Reply 基本按鈕
  const items = [
    { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
    { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
    { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } },
    { type: 'action', action: { type: 'message', label: '隨機', text: '隨機' } },
    { type: 'action', action: { type: 'message', label: '我的餐廳', text: '我的餐廳' } },
    { type: 'action', action: { type: 'location', label: '傳位置' } },
  ];

  // 有下一頁就塞「再 10 間」，用短 key 存 token，避免 postback 超長 400
  if (res.next_page_token) {
    const key = saveMoreToken(res.next_page_token, { lat, lng, radius });
    items.push({
      type: 'action',
      action: {
        type: 'postback',
        label: '再 10 間',
        data: `action=explore_more&k=${key}`,
        displayText: '再 10 間',
      },
    });
  }

  return {
    type: 'flex',
    altText: `找到 ${bubbles.length} 家餐廳`,
    contents: { type: 'carousel', contents: bubbles },
    quickReply: { items },
  };
}

// ---- 隨機（回 1 間 + 再選一間）----
export async function randomRestaurant({ lat, lng, radius = 1500 }) {
  const res = await nearbySearch({ lat, lng, radius });
  const list = Array.isArray(res.results) ? res.results : [];

  if (!list.length) {
    return { type: 'text', text: '附近找不到餐廳 QQ，換個範圍再試一次？' };
  }
  const pick = list[Math.floor(Math.random() * list.length)];
  const bubble = makeBubble(pick, { lat, lng });

  return {
    type: 'flex',
    altText: `隨機選擇：${pick.name}`,
    contents: { type: 'carousel', contents: [bubble] },
    quickReply: {
      items: [
        // 直接再發一次 "隨機" 當指令，controller 不用新增 postback handler
        { type: 'action', action: { type: 'message', label: '再選一間', text: '隨機' } },
        { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
        { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
        { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } },
      ],
    },
  };
}
