// CommonJS（避免 Node 14 ESM 地獄）
const express = require('express');
const line = require('@line/bot-sdk');
const { MongoClient } = require('mongodb');

const {
  searchNearby,
  pickOne,
  normalizePlace,
} = require('./service/places');
const { buildExploreFlex } = require('./util/flex');

// ===== env =====
const {
  PORT = 10000,
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  MONGO_URI,
} = process.env;

if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_CHANNEL_SECRET) {
  console.error('Missing LINE env. Please set LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET');
  process.exit(1);
}
if (!MONGO_URI) {
  console.error('Missing MONGO_URI');
  process.exit(1);
}

// ===== LINE client =====
const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

// ===== Express =====
const app = express();
app.post('/webhook', line.middleware(config), async (req, res) => {
  Promise.all(req.body.events.map(handleEvent)).then(() => res.status(200).end());
});
app.get('/', (_, res) => res.send('OK'));

let db, colPlaces, colSaved;

// ===== state（記下一些使用者 session）=====
const userState = new Map();
// userState.set(userId, { lat, lng, last: {radius, nextPageToken, lastResults: [place] } })

// ===== handlers =====
async function handleEvent(event) {
  const userId = event.source?.userId || 'unknown';
  try {
    if (event.type === 'message' && event.message?.type === 'text') {
      return handleText(userId, event.replyToken, event.message.text.trim());
    }
    if (event.type === 'message' && event.message?.type === 'location') {
      const { latitude, longitude } = event.message;
      const state = userState.get(userId) || {};
      state.lat = latitude;
      state.lng = longitude;
      userState.set(userId, state);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '已更新你的位置囉！接著可用「探索 1500」或「隨機 3000」試試看～'
      });
    }
    // 其他事件直接忽略
    return Promise.resolve();
  } catch (e) {
    console.error('[handleEvent] error', e);
    return client.replyMessage(event.replyToken, { type: 'text', text: '抱歉，我這邊出了一點狀況 🙏' });
  }
}

async function handleText(userId, replyToken, text) {
  const lower = text.toLowerCase();

  if (lower === '隨機') {
    // 引導選半徑
    return client.replyMessage(replyToken, withDefaultQR({
      type: 'text',
      text: '想搜尋多遠？（也可直接輸入：隨機 1500 / 隨機 3000 / 隨機 5000）'
    }));
  }
  if (lower.startsWith('隨機')) {
    const radius = pickRadiusFromText(lower);
    if (!radius) {
      return client.replyMessage(replyToken, withDefaultQR({ type: 'text', text: '請輸入「隨機 1500」或改用 quick reply 按鈕～' }));
    }
    const { lat, lng } = userState.get(userId) || {};
    if (!lat || !lng) {
      return askForLocation(replyToken, '我需要你的位置來隨機喔，點下方「傳位置」再試一次～');
    }
    const { results, nextPageToken } = await searchNearby({ lat, lng, radius });
    // 存 DB
    await upsertPlaces(results);
    if (!results.length) {
      return client.replyMessage(replyToken, withDefaultQR({ type: 'text', text: '附近找不到耶，換個半徑試試？' }));
    }
    const chosen = pickOne(results);
    const msg = withDefaultQR({
      type: 'flex',
      altText: `隨機幫你挑了：${chosen.name}`,
      contents: buildExploreFlex([chosen], null, userId, true /*isSingle*/),
    });
    // 更新 state
    userState.set(userId, { ...(userState.get(userId) || {}), last: { radius, nextPageToken, lastResults: results } });
    return client.replyMessage(replyToken, msg);
  }

  if (text === '再 10 間') {
    const st = userState.get(userId)?.last;
    const { lat, lng } = userState.get(userId) || {};
    if (!st?.radius || !lat || !lng) {
      return client.replyMessage(replyToken, withDefaultQR({ type: 'text', text: '目前沒有可以再載入的清單，先「探索 1500」看看吧！' }));
    }
    const { results, nextPageToken } = await searchNearby({ lat, lng, radius: st.radius, nextPageToken: st.nextPageToken });
    await upsertPlaces(results);

    if (!results.length) {
      return client.replyMessage(replyToken, withDefaultQR({ type: 'text', text: '沒有更多了～' }));
    }
    const msg = withDefaultQR({
      type: 'flex',
      altText: `再給你 ${Math.min(10, results.length)} 間`,
      contents: buildExploreFlex(results, nextPageToken, userId),
    });
    userState.set(userId, { ...(userState.get(userId) || {}), last: { radius: st.radius, nextPageToken, lastResults: results } });
    return client.replyMessage(replyToken, msg);
  }

  if (lower === '我的餐廳') {
    const list = await colSaved.find({ userId }).sort({ createdAt: -1 }).limit(10).toArray();
    if (!list.length) {
      return client.replyMessage(replyToken, withDefaultQR({ type: 'text', text: '你的清單目前是空的，看到喜歡的可以按「加入 XXX」～' }));
    }
    const docs = list.map(x => ({
      type: 'box', layout: 'vertical', spacing: 'sm',
      contents: [
        { type: 'text', text: x.name, weight: 'bold', wrap: true },
        x.address ? { type: 'text', text: x.address, size: 'sm', color: '#555', wrap: true } : { type: 'spacer' },
        { type: 'button', style: 'link', height: 'sm', action: { type: 'uri', label: '在地圖開啟', uri: x.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.name)}` } },
      ]
    }));
    const msg = withDefaultQR({
      type: 'flex',
      altText: `你的餐廳清單（${list.length}）`,
      contents: { type: 'carousel', contents: docs.map(toBubble) }
    });
    return client.replyMessage(replyToken, msg);
  }

  if (lower.startsWith('加入 ') || lower.startsWith('add ')) {
    const name = text.slice(text.indexOf(' ') + 1).trim();
    if (!name) return client.replyMessage(replyToken, { type: 'text', text: '請輸入「加入 店名」或「add 店名」' });

    // 先從快取結果找，找不到再從 DB places 找
    const last = userState.get(userId)?.last?.lastResults || [];
    const match = last.find(p => (p.name || '').toLowerCase() === name.toLowerCase())
      || await colPlaces.findOne({ name: new RegExp(`^${escapeRegExp(name)}$`, 'i') });

    const doc = match ? normalizePlace(match) : { name };
    await colSaved.updateOne(
      { userId, name: doc.name },
      { $set: { ...doc, userId, createdAt: new Date() } },
      { upsert: true }
    );
    return client.replyMessage(replyToken, { type: 'text', text: `已加入：${doc.name}` });
  }

  if (lower.startsWith('探索 ')) {
    const radius = parseInt(lower.split(' ')[1], 10);
    if (![1500, 3000, 5000].includes(radius)) {
      return client.replyMessage(replyToken, withDefaultQR({ type: 'text', text: '半徑只支援 1500 / 3000 / 5000 喔～' }));
    }
    const { lat, lng } = userState.get(userId) || {};
    if (!lat || !lng) {
      return askForLocation(replyToken, '我需要你的位置來探索喔，點下方「傳位置」再試一次～');
    }

    const { results, nextPageToken } = await searchNearby({ lat, lng, radius });
    await upsertPlaces(results);

    if (!results.length) {
      return client.replyMessage(replyToken, withDefaultQR({ type: 'text', text: '附近找不到耶，換個半徑試試？' }));
    }
    const msg = withDefaultQR({
      type: 'flex',
      altText: `找到 ${results.length} 家餐廳`,
      contents: buildExploreFlex(results, nextPageToken, userId),
    });
    userState.set(userId, { ...(userState.get(userId) || {}), last: { radius, nextPageToken, lastResults: results } });
    return client.replyMessage(replyToken, msg);
  }

  if (lower.startsWith('就吃 ')) {
    const name = text.slice(3).trim();
    const last = userState.get(userId)?.last?.lastResults || [];
    const match = last.find(p => (p.name || '').toLowerCase() === name.toLowerCase())
      || await colPlaces.findOne({ name: new RegExp(`^${escapeRegExp(name)}$`, 'i') }) || { name };
    const url = match.place_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.name)}&query_place_id=${match.place_id}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
    return client.replyMessage(replyToken, { type: 'text', text: `開地圖：\n${url}` });
  }

  // fallback：教學 + 快速鍵
  return client.replyMessage(replyToken, withDefaultQR({
    type: 'text',
    text: [
      '指令：',
      '・傳位置（用下方按鈕）',
      '・探索 1500 / 3000 / 5000',
      '・隨機 1500 / 3000 / 5000',
      '・我的餐廳',
      '・加入 <店名>（或 add <店名>）',
      '・就吃 <店名>',
    ].join('\n')
  }));
}

// ===== helpers =====
function pickRadiusFromText(lower) {
  const m = lower.match(/(1500|3000|5000)/);
  return m ? parseInt(m[1], 10) : null;
}
function askForLocation(replyToken, tip) {
  return client.replyMessage(replyToken, withDefaultQR({ type: 'text', text: tip }));
}
function withDefaultQR(message) {
  // 內建常用 quick reply（都用 message/ location，不用 postback）
  return {
    ...message,
    quickReply: {
      items: [
        { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
        { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
        { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } },
        { type: 'action', action: { type: 'message', label: '隨機', text: '隨機' } },
        { type: 'action', action: { type: 'message', label: '我的餐廳', text: '我的餐廳' } },
        { type: 'action', action: { type: 'location', label: '傳位置' } },
        { type: 'action', action: { type: 'message', label: '再 10 間', text: '再 10 間' } }
      ]
    }
  };
}
async function upsertPlaces(arr) {
  if (!arr?.length) return;
  const bulk = colPlaces.initializeUnorderedBulkOp();
  for (const p of arr) {
    const doc = normalizePlace(p);
    bulk.find({ place_id: doc.place_id }).upsert().update({ $set: { ...doc, updatedAt: new Date() } });
  }
  await bulk.execute();
}
function toBubble(body) {
  return { type: 'bubble', body };
}
function escapeRegExp(s = '') {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===== start =====
(async () => {
  try {
    const clientMongo = new MongoClient(MONGO_URI);
    await clientMongo.connect();
    db = clientMongo.db();
    colPlaces = db.collection('places');
    colSaved = db.collection('saved');
    console.log('[mongo] connected');

    app.listen(PORT, () => console.log('Server listening on', PORT));
  } catch (e) {
    console.error('Start error', e);
    process.exit(1);
  }
})();
