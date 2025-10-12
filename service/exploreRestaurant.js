// service/exploreRestaurant.js
import { reply } from '../config/line.js';
import { saveState } from '../model/postbackState.js';
import { searchNearby, photoUrl } from './placesSearch.js';

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function buildBubble(p, base) {
  const distance =
    base?.lat && base?.lng && p.lat && p.lng
      ? Math.round(haversine(base.lat, base.lng, p.lat, p.lng))
      : null;

  const bodyContents = [
    { type: 'text', text: p.name || '未命名', weight: 'bold', size: 'lg', wrap: true },
    {
      type: 'box',
      layout: 'baseline',
      spacing: 'sm',
      contents: [
        ...(p.rating ? [{ type: 'text', text: `⭐ ${p.rating}`, size: 'sm', color: '#777' }] : []),
        ...(distance != null ? [{ type: 'text', text: `${distance} m`, size: 'sm', color: '#777' }] : []),
      ],
    },
    ...(p.address ? [{ type: 'text', text: p.address, size: 'sm', color: '#555', wrap: true }] : []),
  ];

  const footer = {
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
          data: `a=choose&pid=${encodeURIComponent(p.place_id)}`,
          displayText: `就吃 ${p.name}`,
        },
      },
      {
        type: 'button',
        style: 'secondary',
        height: 'sm',
        action: {
          type: 'postback',
          label: '加入清單',
          data: `a=add&pid=${encodeURIComponent(p.place_id)}`,
          displayText: `加入 ${p.name}`,
        },
      },
      {
        type: 'button',
        style: 'link',
        height: 'sm',
        action: {
          type: 'uri',
          label: '在地圖開啟',
          uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${encodeURIComponent(p.place_id)}`,
        },
      },
    ],
  };

  const bubble = {
    type: 'bubble',
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: bodyContents },
    footer,
  };

  const img = photoUrl(p.photo_reference);
  if (img) {
    bubble.hero = {
      type: 'image',
      url: img,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
    };
  }

  return bubble;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function buildFlexMessage(bubbles, altText, quickReply) {
  const msg = {
    type: 'flex',
    altText,
    contents: { type: 'carousel', contents: bubbles.slice(0, 10) }, // 保證 <= 10
  };
  if (quickReply) msg.quickReply = quickReply;
  const bytes = Buffer.byteLength(JSON.stringify(msg));
  console.log(`[flex] bubbles=${bubbles.length} (capped to <=10), altText="${altText}", bytes=${bytes}`);
  return msg;
}

function buildMoreQuickReply(userId, params) {
  return {
    items: [
      { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
      { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
      { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } },
      { type: 'action', action: { type: 'message', label: '隨機', text: '隨機' } },
      { type: 'action', action: { type: 'message', label: '我的餐廳', text: '我的餐廳' } },
      { type: 'action', action: { type: 'location', label: '傳位置' } },
      // 「再 10 間」=> 把 nextPageToken 存 DB，postback.data 只放短 id，避免超過 300 bytes
      {
        type: 'action',
        action: {
          type: 'postback',
          label: '再 10 間',
          data: `a=em&id=${params.stateId}`, // 短
          displayText: '再 10 間',
        },
      },
    ],
  };
}

export async function sendExplore({ replyToken, userId, lat, lng, radius, places, nextPageToken }) {
  const bubbles = (places || []).map((p) => buildBubble(p, { lat, lng }));
  const groups = chunk(bubbles, 10); // 每組 <= 10

  console.log(`[explore] totalPlaces=${places?.length || 0}, groups=${groups.length}, hasNext=${!!nextPageToken}`);

  const messages = [];
  groups.slice(0, 5).forEach((group, idx) => {
    const isLast = idx === Math.min(groups.length, 5) - 1;
    let quickReply;

    if (isLast && nextPageToken) {
      // 把下一頁資訊存起來，避免把 token 放進 postback.data
      const stateId = await saveState(userId, { lat, lng, radius, nextPageToken });
      quickReply = buildMoreQuickReply(userId, { stateId });
    }

    const alt = groups.length === 1 ? `找到 ${group.length} 家餐廳` : `餐廳清單 ${idx + 1}/${groups.length}`;
    messages.push(buildFlexMessage(group, alt, quickReply));
  });

  if (groups.length > 5) {
    // 5 則訊息上限，超過就告知
    messages.push({ type: 'text', text: `一次最多顯示 50 家（已截斷）。可按「再 10 間」看更多。` });
  }

  await reply(replyToken, messages);
}

export async function sendRandom({ replyToken, userId, lat, lng, radius, places }) {
  const list = Array.isArray(places) ? places : [];
  if (!list.length) {
    await reply(replyToken, { type: 'text', text: '附近找不到餐廳耶 QQ' });
    return;
  }
  const pick = list[Math.floor(Math.random() * list.length)];
  const bubble = buildBubble(pick, { lat, lng });
  const msg = buildFlexMessage([bubble], '今天就吃這間？');
  await reply(replyToken, msg);
}

// 直接從 API 探索（當 DB 沒命中時）
export async function exploreAndSend({ replyToken, userId, lat, lng, radius }) {
  const { places, nextPageToken } = await searchNearby({ lat, lng, radius });
  await sendExplore({ replyToken, userId, lat, lng, radius, places, nextPageToken });
}
