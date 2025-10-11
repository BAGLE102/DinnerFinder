// src/controller/message.js
import service from '../service/index.js';

export default async function onMessage(client, event) {
  const msg = event.message;

  // 位置：寫入 DB
  if (msg?.type === 'location') {
    const r = await service.updateUserLocation(event);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
  }

  if (msg?.type !== 'text') return null;

  const raw = (msg.text || '').trim();
  const lower = raw.toLowerCase();
  const is = (...keys) => keys.some(k => lower === k || raw === k);

  // get / 我的餐廳
  if (is('get', '我的餐廳')) {
    try {
      const list = await service.getMyRestaurant(event.source);
      const text = list.length
        ? list.map(r => `• ${r.name}${r.address ? ' - ' + r.address : ''}`).join('\n')
        : '目前清單是空的，用「新增 店名」先加幾家吧～';
      return client.replyMessage(event.replyToken, { type: 'text', text });
    } catch (e) {
      console.error(e);
      return client.replyMessage(event.replyToken, { type: 'text', text: '讀取清單失敗。' });
    }
  }

  // random / 隨機
  if (is('random', '隨機')) {
    const r = await service.randomRestaurant(event.source);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
  }

  // explore / 探索 半徑
  if (lower.startsWith('explore') || raw.startsWith('探索')) {
    const parts = raw.split(/\s+/);
    const radius = Number(parts[1]) || 1500;
    const lineUserId = event.source.userId;

    const r = await service.exploreRestaurant(lineUserId, radius, { limit: 10 });
    if (!r.ok) {
      return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
    }

    const items = r.results.map((x, i) => {
      const km = x.distance != null ? (x.distance >= 1000
        ? `${(x.distance / 1000).toFixed(1)}km`
        : `${x.distance}m`) : '';
      const star = x.rating ? ` ⭐${x.rating}` : '';
      const addr = x.address ? `\n   ${x.address}` : '';
      return `${i + 1}. ${x.name}${star}${km ? ' · ' + km : ''}${addr}`;
    }).join('\n');

    const head = `找到了 ${r.meta?.total ?? r.results.length} 家（列前 ${r.results.length}，半徑 ${r.meta?.radiusUsed ?? radius}m）`;
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `${head}\n${items}`
    });
  }

  // choose / 選擇 店名
  if (lower.startsWith('choose') || raw.startsWith('選擇')) {
    const name = raw.replace(/^(choose|選擇)\s*/i, '').trim();
    if (!name) {
      return client.replyMessage(event.replyToken, { type: 'text', text: '請在「選擇」後面加店名，例如：選擇 八方雲集' });
    }
    const r = await service.chooseRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
  }

  // add / 新增
  if (lower.startsWith('add') || raw.startsWith('新增')) {
    const name = raw.replace(/^(add|新增)\s*/i, '').trim();
    const r = await service.addRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
  }

  // remove / 移除
  if (lower.startsWith('remove') || raw.startsWith('移除')) {
    const name = raw.replace(/^(remove|移除)\s*/i, '').trim();
    const r = await service.removeRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
  }

  return client.replyMessage(event.replyToken, { type: 'text', text: '輸入：探索 1500 / 隨機 / 我的餐廳 / 新增 店名' });
}
