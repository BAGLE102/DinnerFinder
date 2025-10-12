// service/exploreRestaurant.js
import { reply } from '../config/line.js';
import { saveState } from '../model/postbackState.js';
import { searchNearby, photoUrl } from './placesSearch.js';

/** --- utils --- */
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

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** --- Flex builders (單一店家 bubble / 訊息) --- */
function buildBubble(p, base) {
  const distance =
    base?.lat && base?.lng && p.lat && p.lng
      ? Math.round(haversine(base.lat, base.lng, p.lat, p.lng))
      : null;

  const bodyContents = [
    { type: 'text', text: p.name || '未命名', weight: 'bold', size: 'lg', wrap: true },
  ];

  // 只有當真的有資料時才放 baseline，避免空 contents 造成 400
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

  // footer：有 place_id 才出 postback 按鈕，避免 pid=undefined
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

  const mapUri = p.place_id
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name || '')}&query_place_id=${encodeURIComponent(p.place_id)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name || '')}`;

  footerButtons.push({
    type: 'button',
    style: 'link',
    height: 'sm',
    action: { type: 'uri', label: '在地圖開啟', uri: mapUri },
  });

  const bubble = {
    type: 'bubble',
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: bodyContents },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons },
  };

  // hero 圖片：只有有圖才加
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

function buildFlexMessage(bubbles, altText, quickReply) {
  const msg = {
    type: 'flex',
    altText,
    contents: { type: 'carousel', contents: bubbles.slice(0, 10) }, // LINE 一則 Flex 最多 10 bubbles
  };
  if (quickReply) msg.quickReply = quickReply;
  const bytes = Buffer.byteLength(JSON.stringify(msg));
  console.log(`[flex] bubbles=${bubbles.length} (capped<=10), alt="${altText}", bytes=${bytes}`);
  return msg;
}

function buildMoreQuickReply(stateId) {
  const data = `a=em&id=${stateId}`;
  const size = Buffer.byteLength(data);
  if (size > 300) console.warn('[buildMoreQuickReply] postback data too long:', size);
  return {
    items: [
      { type: 'action', action: { type: 'postback', label: '再 10 間', data, displayText: '再 10 間' } },
      { type: 'action', action: { type: 'message', label: '隨機', text: '隨機' } },
      { type: 'action', action: { type: 'location', label: '傳位置' } },
    ],
  };
}

/** ----------------------------------------------------------------
 *  (A) Builder 版本：只回傳 messages (給 controller 自己 reply)
 *  ---------------------------------------------------------------- */
export async function buildExploreMessage({ userId, lat, lng, radius, places, nextPageToken }) {
  const safePlaces = Array.isArray(places) ? places : [];
  if (safePlaces.length === 0) {
    return [{ type: 'text', text: '附近找不到店 QQ，請換個範圍或傳位置再試。' }];
  }

  const bubbles = safePlaces.map((p) => buildBubble(p, { lat, lng }));
  const groups = chunk(bubbles, 10);
  console.log(`[buildExploreMessage] places=${safePlaces.length}, groups=${groups.length}, hasNext=${!!nextPageToken}`);

  // 產生「再 10 間」需要 stateId（儲存 nextPageToken）
  let stateId = null;
  if (nextPageToken) {
    try {
      stateId = await saveState(userId, { lat, lng, radius, nextPageToken });
    } catch (e) {
      console.error('[buildExploreMessage] saveState error:', e);
    }
  }
  console.log(`[buildExploreMessage] stateId=${stateId || '(none)'}`);

  const messages = [];
  const maxGroups = Math.min(groups.length, 5); // 一次最多 5 則訊息

  for (let i = 0; i < maxGroups; i++) {
    const group = groups[i];
    const isLast = i === maxGroups - 1;

    const quickReply = isLast && stateId ? buildMoreQuickReply(stateId) : undefined;
    const alt = (groups.length <= 1)
      ? `找到 ${group.length} 家餐廳`
      : `餐廳清單 ${i + 1}/${groups.length}`;

    const msg = buildFlexMessage(group, alt, quickReply);
    messages.push(msg);
  }

  if (groups.length > 5) {
    messages.push({ type: 'text', text: '一次最多顯示 50 家（已截斷）。點「再 10 間」看更多。' });
  }

  const payloadStr = JSON.stringify(messages);
  console.log(`[buildExploreMessage] messages=${messages.length}, bytes=${Buffer.byteLength(payloadStr)}`);
  console.log('[buildExploreMessage] firstFlexPreview=', JSON.stringify(messages[0]).slice(0, 4000));

  return messages;
}

export async function buildRandomMessage({ userId, lat, lng, radius, places }) {
  const list = Array.isArray(places) ? places : [];
  if (!list.length) {
    return [{ type: 'text', text: '附近找不到店 QQ，請換個範圍試試。' }];
  }

  const pick = list[Math.floor(Math.random() * list.length)];

  // 讓「再抽一次」可用
  let stateId = null;
  try {
    stateId = await saveState(userId, { lat, lng, radius });
  } catch (e) {
    console.error('[buildRandomMessage] saveState error:', e);
  }
  console.log(`[buildRandomMessage] stateId=${stateId || '(none)'} pick="${pick?.name}"`);

  const bubble = buildBubble(pick, { lat, lng });
  const alt = `我推薦：${pick?.name || '餐廳'}`;
  const quickReply = stateId ? {
    items: [
      { type: 'action', action: { type: 'postback', label: '再抽一次', data: `a=rng&id=${stateId}`, displayText: '再抽一次' } },
      { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
      { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
      { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } },
    ]
  } : undefined;

  const msg = buildFlexMessage([bubble], alt, quickReply);
  console.log('[buildRandomMessage] firstFlexPreview=', JSON.stringify(msg).slice(0, 4000));
  return [msg];
}

/** ----------------------------------------------------------------
 *  (B) 直接回覆版本：內部呼叫 reply()
 *  ---------------------------------------------------------------- */
export async function sendExplore(params) {
  const { replyToken } = params;
  const messages = await buildExploreMessage(params);
  try {
    await reply(replyToken, messages);
  } catch (e) {
    console.error('[sendExplore] reply error status=', e?.response?.status, 'data=', e?.response?.data);
    throw e;
  }
}

export async function sendRandom(params) {
  const { replyToken } = params;
  const messages = await buildRandomMessage(params);
  try {
    await reply(replyToken, messages);
  } catch (e) {
    console.error('[sendRandom] reply error status=', e?.response?.status, 'data=', e?.response?.data);
    throw e;
  }
}

/** 當 DB 沒命中時改走 API 的便捷函式 */
export async function exploreAndSend({ replyToken, userId, lat, lng, radius }) {
  const { places, nextPageToken } = await searchNearby({ lat, lng, radius });
  await sendExplore({ replyToken, userId, lat, lng, radius, places, nextPageToken });
}
