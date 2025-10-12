// service/exploreRestaurant.js
import { client as lineClient } from '../config/line.js';
import { saveState } from '../model/postbackState.js';
import { shortId } from '../util/id.js';

const toBubbles = (places = []) => {
  return places.slice(0, 6).map(p => ({
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
          type: 'box', layout: 'baseline', spacing: 'sm',
          contents: [
            p.rating ? { type: 'text', text: `⭐ ${p.rating}`, size: 'sm', color: '#777' } : { type: 'filler' },
            p.distance ? { type: 'text', text: `${p.distance} m`, size: 'sm', color: '#777' } : { type: 'filler' },
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
    altText: `找到 ${places.length} 家餐廳`,
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

export async function sendExplore({ replyToken, user, lat, lng, radius, places = [], nextPageToken = null }) {
  // 1) Flex 內容（最多 12 個 bubble）
  const bubbles = toBubbles(places);
  if (!bubbles.length) {
    await lineClient.replyMessage(replyToken, [{ type: 'text', text: '附近暫時找不到餐廳 QQ' }]);
    return;
  }

  // 2) 如果有下一頁，先把 token 存起來，回 Quick Reply 用短 
  let moreQR = null;
  if (nextPageToken) {
    const id = shortId(8);
    await saveState(userId, id, { lat, lng, radius, nextPageToken }); // 只存必要欄位
    moreQR = {
      type: 'action',
      action: { type: 'postback', label: '再 10 間', data: `a=em&id=${id}`, displayText: '再 10 間' }
    };
  }

  // 3) 組 quickReply（保持 13 以內）
  const quickReplyItems = [
    { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
    { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
    { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } },
    { type: 'action', action: { type: 'message', label: '隨機', text: '隨機' } },
    { type: 'action', action: { type: 'message', label: '我的餐廳', text: '我的餐廳' } },
    { type: 'action', action: { type: 'location', label: '傳位置' } },
  ];
  if (moreQR) quickReplyItems.push(moreQR);

  const message = {
    type: 'flex',
    altText: `找到 ${places.length} 家餐廳`,
    contents: { type: 'carousel', contents: bubbles },
    quickReply: { items: quickReplyItems }
  };

  await lineClient.replyMessage(replyToken, [message]);
}

export async function sendRandom({ replyToken, userId, lat, lng, radius, places = [] }) {
  if (!places.length) {
    await lineClient.replyMessage(replyToken, [{ type: 'text', text: '找不到候選，請再探索一次～' }]);
    return;
  }
  const pick = places[Math.floor(Math.random() * places.length)];
  const bubble = toBubbles([pick])[0];

  // 若想支援「再抽一次」，一樣存條件 → 回短 id
  const id = nanoid(8);
  await saveState(userId, id, { lat, lng, radius });

  const msg = {
    type: 'flex',
    altText: `抽到了：${pick.name}`,
    contents: bubble,
    quickReply: {
      items: [
        { type: 'action', action: { type: 'postback', label: '再抽一次', data: `a=rng&id=${id}`, displayText: '再抽一次' } },
        { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
        { type: 'action', action: { type: 'location', label: '傳位置' } },
      ]
    }
  };
  await lineClient.replyMessage(replyToken, [msg]);
}
