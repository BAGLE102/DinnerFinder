// service/exploreRestaurant.js
import { buildPhotoUrl } from './placesSearch.js';

function bubbleOf(p) {
  const rating = (p.rating ?? '-').toString();
  const distance = ''; // 這版不計距離，保持簡潔
  const addr = p.vicinity || '';

  return {
    type: 'bubble',
    hero: {
      type: 'image',
      url: buildPhotoUrl(p.photo_reference),
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'text', text: p.name, weight: 'bold', size: 'lg', wrap: true },
        {
          type: 'box',
          layout: 'baseline',
          spacing: 'sm',
          contents: [
            { type: 'text', text: `⭐ ${rating}`, size: 'sm', color: '#777' },
            ...(distance ? [{ type: 'text', text: distance, size: 'sm', color: '#777' }] : []),
          ],
        },
        ...(addr ? [{ type: 'text', text: addr, size: 'sm', color: '#555', wrap: true }] : []),
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          action: { type: 'postback', label: '就吃這間', data: `a=choose&pid=${p.place_id}`, displayText: `就吃 ${p.name}` },
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: { type: 'postback', label: '加入清單', data: `a=add&pid=${p.place_id}`, displayText: `加入 ${p.name}` },
        },
        {
          type: 'button',
          style: 'link',
          height: 'sm',
          action: {
            type: 'uri',
            label: '在地圖開啟',
            uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.place_id}`,
          },
        },
      ],
    },
  };
}

export function buildExploreMessage(places) {
  const bubbles = places.slice(0, 10).map(bubbleOf);
  return {
    type: 'flex',
    altText: `找到 ${bubbles.length} 家餐廳`,
    contents: { type: 'carousel', contents: bubbles },
  };
}

export function buildRandomMessage(places) {
  if (!places.length) {
    return { type: 'text', text: '附近暫時找不到餐廳 QQ' };
  }
  const pick = places[Math.floor(Math.random() * places.length)];
  return {
    type: 'flex',
    altText: `隨機推薦：${pick.name}`,
    contents: bubbleOf(pick),
  };
}
