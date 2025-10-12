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
  ];

  // 只有有評分/距離時才加入 baseline box，避免空 contents 觸發 400
  const detailItems = [];
  if (p.rating) detailItems.push({ type: 'text', text: `⭐ ${p.rating}`, size: 'sm', color: '#777' });
  if (distance != null) detailItems.push({ type: 'text', text: `${distance} m`, size: 'sm', color: '#777' });
  if (detailItems.length > 0) {
    bodyContents.push({
      type: 'box',
      layout: 'baseline',
      spacing: 'sm',
      contents: detailItems,
    });
  }

  if (p.address) {
    bodyContents.push({ type: 'text', text: p.address, size: 'sm', color: '#555', wrap: true });
  }

  // footer：有 place_id 才放 postback 按鈕
  const footerButtons = [];
  if (p.place_id) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      height: 'sm',
      action: {
        type: 'postback',
        label: '就吃這間',
        data: `a=choose&pid=${encodeURIComponent(p.place_id)}`,
        displayText: `就吃 ${p.name || ''}`,
      },
    });
    footerButtons.push({
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'postback',
        label: '加入清單',
        data: `a=add&pid=${encodeURIComponent(p.place_id)}`,
        displayText: `加入 ${p.name || ''}`,
      },
    });
  }

  // 地圖按鈕：有 pid 用 query_place_id，沒有就只用 query
  const mapUri = p.place_id
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name || '')}&query_place_id=${encodeURIComponent(p.place_id)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name || '')}`;

  footerButtons.push({
    type: 'button',
    style: 'link',
    height: 'sm',
    action: {
      type: 'uri',
      label: '在地圖開啟',
      uri: mapUri,
    },
  });

  const footer = { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons };

  const bubble = {
    type: 'bubble',
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: bodyContents },
    footer,
  };

  // hero：只有有圖才加，避免 url:null/undefined 造成 400
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

function buildMoreQuickReply(stateId) {
  const data = `a=em&id=${stateId}`; // controller/postback 解析的 key
  // 安全檢查：LINE postback.data 限制 ~300 bytes
  const size = Buffer.byteLength(data);
  if (size > 300) {
    console.warn('[buildMoreQuickReply] postback data too long:', size);
  }
  return {
    items: [
      {
        type: 'action',
        action: {
          type: 'postback',
          label: '再 10 間',
          data,
          displayText: '再 10 間'
        }
      },
      { type: 'action', action: { type: 'message', label: '隨機', text: '隨機' } },
      { type: 'action', action: { type: 'location', label: '傳位置' } },
    ]
  };
}

export async function sendExplore({ replyToken, userId, lat, lng, radius, places, nextPageToken }) {
  const safePlaces = Array.isArray(places) ? places : [];
  const bubbles = safePlaces.map((p) => buildBubble(p, { lat, lng }));
  const groups = chunk(bubbles, 10); // 1 則 Flex 最多 10 個 bubble

  console.log(`[sendExplore] places=${safePlaces.length}, groups=${groups.length}, hasNext=${!!nextPageToken}`);

  // 先存下一頁 token
  let stateId = null;
  if (nextPageToken) {
    try {
      stateId = await saveState(userId, { lat, lng, radius, nextPageToken });
    } catch (e) {
      console.error('[sendExplore] saveState error:', e);
    }
  }
  console.log(`[sendExplore] stateId=${stateId || '(none)'}`);

  const messages = [];
  const maxGroups = Math.min(groups.length || 1, 5); // 至少要回一則

  for (let i = 0; i < maxGroups; i++) {
    const group = groups[i] || []; // 若完全沒有結果，group 可能是 undefined
    const isLast = i === maxGroups - 1;

    let quickReply;
    if (isLast && stateId) {
      quickReply = buildMoreQuickReply(stateId); // a=em&id=STATEID
      const bytes = Buffer.byteLength(JSON.stringify(quickReply));
      console.log(`[sendExplore] quickReply bytes=${bytes}`);
    }

    const alt = (groups.length <= 1)
      ? `找到 ${group.length} 家餐廳`
      : `餐廳清單 ${i + 1}/${groups.length}`;

    const msg = buildFlexMessage(group, alt, quickReply);
    messages.push(msg);
  }

  if ((groups.length || 0) > 5) {
    messages.push({ type: 'text', text: '一次最多顯示 50 家（已截斷）。點「再 10 間」看更多。' });
  }

  // 送出前做體積檢查，並把第一則 Flex 打 log（最多 4KB，避免爆 log）
  const payloadStr = JSON.stringify(messages);
  console.log(`[sendExplore] reply messages count=${messages.length}, bytes=${Buffer.byteLength(payloadStr)}`);
  console.log('[sendExplore] firstFlexPreview=', JSON.stringify(messages[0]).slice(0, 4000));

  try {
    await reply(replyToken, messages);
  } catch (e) {
    console.error('[sendExplore] reply error status=', e?.response?.status, 'data=', e?.response?.data);
    throw e;
  }
}

export async function sendRandom({ replyToken, userId, lat, lng, radius, places }) {
  console.log(`[sendRandom] places=${places?.length || 0} at lat=${lat}, lng=${lng}, radius=${radius}`);
  const list = Array.isArray(places) ? places : [];
  const pick = list.length ? list[Math.floor(Math.random() * list.length)] : null;

  if (!pick) {
    await reply(replyToken, [{ type: 'text', text: '附近找不到店 QQ，請換個範圍試試。' }]);
    return;
  }

  let stateId = null;
  try {
    // 只存抽籤條件，之後「再抽一次」會重抓 DB 或 API
    stateId = await saveState(userId, { lat, lng, radius });
  } catch (e) {
    console.error('[sendRandom] saveState error:', e);
  }
  console.log(`[sendRandom] stateId=${stateId || '(none)'}`);

  const bubble = buildBubble(pick, { lat, lng });
  const alt = `我推薦：${pick.name || '餐廳'}`;

  const quickReply = stateId ? {
    items: [
      { type: 'action', action: { type: 'postback', label: '再抽一次', data: `a=rng&id=${stateId}`, displayText: '再抽一次' } },
      { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
      { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
      { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } },
    ]
  } : undefined;

  const msg = buildFlexMessage([bubble], alt, quickReply);

  console.log('[sendRandom] firstFlexPreview=', JSON.stringify(msg).slice(0, 4000));

  try {
    await reply(replyToken, [msg]);
  } catch (e) {
    console.error('[sendRandom] reply error status=', e?.response?.status, 'data=', e?.response?.data);
    throw e;
  }
}

// 直接從 API 探索（當 DB 沒命中時）
export async function exploreAndSend({ replyToken, userId, lat, lng, radius }) {
  const { places, nextPageToken } = await searchNearby({ lat, lng, radius });
  await sendExplore({ replyToken, userId, lat, lng, radius, places, nextPageToken });
}
