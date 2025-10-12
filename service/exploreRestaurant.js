// service/exploreRestaurant.js
import { client as lineClient } from '../config/line.js';
import { saveState } from '../model/postbackState.js';
import { shortId } from '../util/id.js';

const MAX_BUBBLES = 10;
const MAX_ALT = 400;

const safeText = (s, fallback = '') =>
  (typeof s === 'string' && s.trim().length ? s.trim() : fallback);

const safeKmOrM = (m) => {
  if (!m || Number.isNaN(Number(m))) return '距離未知';
  const n = Number(m);
  return n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${Math.round(n)} m`;
};

const validHttps = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
};

const toBubbles = (places = []) => {
  return places.slice(0, MAX_BUBBLES).map((p) => {
    const id = safeText(p.id, '');
    const safeName = safeText(p.name, '未命名');
    const safeAddress = safeText(p.address, '地址不詳');
    const safeDistance = safeKmOrM(p.distance);
    const ratingText = (p.rating || p.rating === 0) ? `⭐ ${p.rating}` : null;
    const photoUrl = p.photoUrl ? validHttps(p.photoUrl) : null;
    const mapUrl = p.mapUrl ? validHttps(p.mapUrl) : null;

    const bodyContents = [
      { type: 'text', text: safeName, weight: 'bold', size: 'lg', wrap: true },
      {
        type: 'box',
        layout: 'baseline',
        spacing: 'sm',
        contents: [
          ...(ratingText ? [{ type: 'text', text: ratingText, size: 'sm', color: '#777' }] : []),
          { type: 'text', text: safeDistance, size: 'sm', color: '#777' }
        ]
      },
      { type: 'text', text: safeAddress, size: 'sm', color: '#555', wrap: true }
    ];

    const footerButtons = [
      {
        type: 'button',
        style: 'primary',
        height: 'sm',
        action: {
          type: 'postback',
          label: '就吃這間',
          data: `a=choose&id=${id}`,
          displayText: `就吃 ${safeName}`
        }
      },
      {
        type: 'button',
        style: 'secondary',
        height: 'sm',
        action: {
          type: 'postback',
          label: '加入清單',
          data: `a=add&id=${id}`,
          displayText: `加入 ${safeName}`
        }
      },
      ...(mapUrl ? [{
        type: 'button',
        style: 'link',
        height: 'sm',
        action: { type: 'uri', label: '在地圖開啟', uri: mapUrl }
      }] : [])
    ];

    const bubble = {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: bodyContents },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons }
    };

    if (photoUrl) {
      bubble.hero = {
        type: 'image',
        url: photoUrl,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      };
    }

    return bubble;
  });
};

const clampAlt = (text) => {
  const t = safeText(text, '');
  return t.length <= MAX_ALT ? t : `${t.slice(0, MAX_ALT - 1)}…`;
};

// ========== Explore ==========
export async function sendExplore({
  replyToken, user, lat, lng, radius, places = [], nextPageToken = null
}) {
  const bubbles = toBubbles(places);

  if (!bubbles.length) {
    await lineClient.replyMessage(replyToken, [{ type: 'text', text: '附近暫時找不到餐廳 QQ' }]);
    return;
  }

  let moreQR = null;
  if (nextPageToken) {
    const id = shortId(8);
    await saveState(user.id, id, { lat, lng, radius, nextPageToken });
    moreQR = {
      type: 'action',
      action: { type: 'postback', label: '再 10 間', data: `a=em&id=${id}`, displayText: '再 10 間' }
    };
  }

  const quickReplyItems = [
    { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
    { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
    { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } },
    { type: 'action', action: { type: 'message', label: '隨機', text: '隨機' } },
    { type: 'action', action: { type: 'message', label: '我的餐廳', text: '我的餐廳' } },
    { type: 'action', action: { type: 'location', label: '傳位置' } },
    ...(moreQR ? [moreQR] : [])
  ];

  const message = {
    type: 'flex',
    altText: clampAlt(`找到 ${bubbles.length} 家餐廳`),
    contents: { type: 'carousel', contents: bubbles },
    quickReply: { items: quickReplyItems }
  };

  await lineClient.replyMessage(replyToken, [message]);
}

// ========== Random ==========
export async function sendRandom({ replyToken, userId, lat, lng, radius, places = [] }) {
  if (!places.length) {
    await lineClient.replyMessage(replyToken, [{ type: 'text', text: '找不到候選，請再探索一次～' }]);
    return;
  }

  const pick = places[Math.floor(Math.random() * places.length)];
  const bubble = toBubbles([pick])[0];

  const id = shortId(8);
  await saveState(userId, id, { lat, lng, radius });

  const msg = {
    type: 'flex',
    altText: clampAlt(`抽到了：${safeText(pick.name, '未命名')}`),
    contents: bubble,
    quickReply: {
      items: [
        { type: 'action', action: { type: 'postback', label: '再抽一次', data: `a=rng&id=${id}`, displayText: '再抽一次' } },
        { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
        { type: 'action', action: { type: 'location', label: '傳位置' } }
      ]
    }
  };

  await lineClient.replyMessage(replyToken, [msg]);
}
