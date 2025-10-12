// service/exploreRestaurant.js
import { client as lineClient } from '../config/line.js';
import { saveState } from '../model/postbackState.js';
import { shortId } from '../util/id.js';

const MAX_BUBBLES = 10;

const toBubbles = (places = []) => {
  return places.slice(0, MAX_BUBBLES).map(p => ({
    type: 'bubble',
    ...(p.photoUrl ? {
      hero: {
        type: 'image',
        url: p.photoUrl,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      }
    } : {}),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'text', text: p.name || '未命名', weight: 'bold', size: 'lg', wrap: true },
        {
          type: 'box',
          layout: 'baseline',
          spacing: 'sm',
          contents: [
            p.rating ? { type: 'text', text: `⭐ ${p.rating}`, size: 'sm', color: '#777' } : { type: 'filler' },
            p.distance ? { type: 'text', text: `${p.distance} m`, size: 'sm', color: '#777' } : { type: 'filler' }
          ]
        },
        p.address ? { type: 'text', text: p.address, size: 'sm', color: '#555', wrap: true } : { type: 'filler' }
      ]
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
          action: {
            type: 'postback',
            label: '就吃這間',
            data: `a=choose&id=${p.id}`,
            displayText: `就吃 ${p.name}`
          }
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: '加入清單',
            data: `a=add&id=${p.id}`,
            displayText: `加入 ${p.name}`
          }
        },
        ...(p.mapUrl ? [{
          type: 'button',
          style: 'link',
          height: 'sm',
          action: { type: 'uri', label: '在地圖開啟', uri: p.mapUrl }
        }] : [])
      ]
    }
  }));
};

export function buildExploreMessage(places) {
  const bubbles = toBubbles(places);
  return {
    type: 'flex',
    altText: `找到 ${bubbles.length} 家餐廳`,
    contents: { type: 'carousel', contents: bubbles }
  };
}

export function buildRandomMessage(pick) {
  const bubble = toBubbles([pick])[0];
  return {
    type: 'flex',
    altText: `抽到了：${pick.name}`,
    contents: bubble
  };
}
