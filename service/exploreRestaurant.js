// service/exploreRestaurant.js
import axios from 'axios';
import { client as lineClient } from '../config/line.js';
import { saveState } from '../model/postbackState.js';
import { getDb } from '../config/mongo.js';

const MAX_BUBBLES = 10;

// 幫你過濾非餐廳（避免大學/ATM混進來）
const PLACE_TYPES = ['restaurant', 'food', 'cafe', 'meal_takeaway', 'meal_delivery'];

function isFoodPlace(p) {
  if (!p.types) return false;
  return p.types.some(t => PLACE_TYPES.includes(t));
}

function toKm(m) {
  if (m == null) return '';
  if (m < 1000) return `${m} m`;
  return `${(m/1000).toFixed(1)} km`;
}

function bubbleOf(place) {
  const name = place.name || '未命名';
  const addr = place.vicinity || place.formatted_address || '';
  const rating = place.rating ? `⭐ ${place.rating}` : null;
  const dist = place.distance_m != null ? toKm(place.distance_m) : null;
  const img = place.photo_url || null; // 你應該已經在前面組好 photo_url（不要放超長參數）；真的要放 photo_reference 也 OK，但 URL 別爆長

  const pid = place.place_id; // 只把 place_id 放進 data

  const header = img ? { type: 'image', url: img, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } : undefined;

  const bodyContents = [{ type: 'text', text: name, weight: 'bold', size: 'lg', wrap: true }];

  const metrics = [];
  if (rating) metrics.push({ type: 'text', text: rating, size: 'sm', color: '#777' });
  if (dist)   metrics.push({ type: 'text', text: dist,   size: 'sm', color: '#777' });
  if (metrics.length) bodyContents.push({ type: 'box', layout: 'baseline', spacing: 'sm', contents: metrics });

  if (addr) bodyContents.push({ type: 'text', text: addr, size: 'sm', color: '#555', wrap: true });

  return {
    type: 'bubble',
    ...(header ? { hero: header } : {}),
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: bodyContents },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          action: {
            type: 'postback',
            label: '就吃這間',
            data: `a=choose&pid=${pid}`,              // <= 極短，OK
            displayText: `就吃 ${name}`
          }
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: '加入清單',
            data: `a=add&pid=${pid}`,                 // <= 極短，OK
            displayText: `加入 ${name}`
          }
        },
        ...(place.place_id ? [{
          type: 'button',
          style: 'link',
          height: 'sm',
          action: {
            type: 'uri',
            label: '在地圖開啟',
            uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${place.place_id}`
          }
        }] : [])
      ]
    }
  };
}

export async function sendExplore({ replyToken, userId, lat, lng, radius, places, nextPageToken }) {
  // 過濾非餐廳 + 有 place_id 才保留，避免 place_id:null 造成 DB duplicate
  const filtered = (places || []).filter(p => p.place_id && isFoodPlace(p)).slice(0, MAX_BUBBLES);
  const bubbles = filtered.map(bubbleOf);

  // 做下一頁 sid（不要把 token 直接放 data）
  let moreItem = null;
  if (nextPageToken) {
    const sid = await saveState(userId, { kind: 'explore', lat, lng, radius, nextPageToken }, 600);
    moreItem = {
      type: 'action',
      action: { type: 'postback', label: '再 10 間', data: `a=em&id=${sid}`, displayText: '再 10 間' }
    };
  }

  const quickReply = {
    items: [
      { type: 'action', action: { type: 'message', label: `探索 ${radius}`, text: `探索 ${radius}` } },
      { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
      { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } },
      { type: 'action', action: { type: 'message', label: '隨機', text: '隨機' } },
      { type: 'action', action: { type: 'message', label: '我的餐廳', text: '我的餐廳' } },
      { type: 'action', action: { type: 'location', label: '傳位置' } },
      ...(moreItem ? [moreItem] : [])
    ]
  };

  const flex = {
    type: 'flex',
    altText: `找到 ${filtered.length} 家餐廳`,
    contents: { type: 'carousel', contents: bubbles },
    quickReply
  };

  await lineClient.replyMessage(replyToken, [flex]);
}

export async function sendRandom({ replyToken, userId, lat, lng, radius, places }) {
  const filtered = (places || []).filter(p => p.place_id && isFoodPlace(p));
  if (!filtered.length) {
    return lineClient.replyMessage(replyToken, [{ type: 'text', text: '附近沒找到餐廳，換個範圍試試～' }]);
  }
  const pick = filtered[Math.floor(Math.random() * filtered.length)];
  const bubble = bubbleOf(pick);

  // 做「再選一間」按鈕（存條件，server 再抽）
  const sid = await saveState(userId, { kind: 'random', lat, lng, radius }, 600);

  const flex = {
    type: 'flex',
    altText: `幫你抽到：${pick.name}`,
    contents: {
      type: 'carousel',
      contents: [bubble]
    },
    quickReply: {
      items: [
        { type: 'action', action: { type: 'postback', label: '再選一間', data: `a=rng&id=${sid}`, displayText: '再選一間' } },
        { type: 'action', action: { type: 'message', label: `探索 ${radius}`, text: `探索 ${radius}` } },
        { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
        { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } }
      ]
    }
  };

  await lineClient.replyMessage(replyToken, [flex]);
}
