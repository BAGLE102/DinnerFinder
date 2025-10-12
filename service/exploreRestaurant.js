// service/exploreRestaurant.js
import { client as lineClient } from '../config/line.js';
import { saveState } from '../model/postbackState.js';
import { shortId } from '../util/id.js';

const MAX_BUBBLES = 10;   // LINE Flex carousel 最多 10
const MAX_ALT = 400;      // 安全上限（實務上 300~400 內較穩）

const safeText = (s, fallback = '') =>
  (typeof s === 'string' && s.trim().length ? s.trim() : fallback);

const safeKmOrM = (m) => {
  if (m === null || m === undefined || Number.isNaN(Number(m))) return '距離未知';
  const n = Number(m);
  return n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${Math.round(n)} m`;
};

const validHttps = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
};

const ellipsis = (s = '', max = 60) => {
  const t = String(s);
  return t.length > max ? t.slice(0, max) + '…' : t;
};

const toBubbles = (places = []) => {
  return places.slice(0, MAX_BUBBLES).map((p) => {
    // 1) 確保 postback data 不為空（LINE 規格 1~300 bytes）
    const id = safeText(p.id) || `p_${shortId(8)}`;

    const rawName = safeText(p.name, '未命名');
    const safeName = ellipsis(rawName, 50);

    const rawAddr = safeText(p.address, '地址不詳');
    const safeAddress = ellipsis(rawAddr, 60);

    const safeDistance = safeKmOrM(p.distance);

    // 2) 顯示分數（可為 0）
    const ratingText = (p.rating || p.rating === 0) ? `⭐ ${p.rating}` : null;

    // 3) URL 僅接收 https（避免 400）
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
          data: `a=choose&id=${encodeURIComponent(id)}`,
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
          data: `a=add&id=${encodeURIComponent(id)}`,
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

  // 「再 10 間」：把長 token 存 state，用短碼放入 postback data
  let moreQR = null;
  if (nextPageToken) {
    const id = shortId(8); // 短碼
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
    altText: clampAlt(`找到 ${bubbles.length} 家餐廳`), // 不再顯示 20，與實際送出的 10 對齊
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
    contents: bubble, // LINE Flex 支援直接放單一 bubble
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
