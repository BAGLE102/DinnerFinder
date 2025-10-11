import service from '../service/index.js';

export default async function onMessage(client, event) {
  const msg = event.message;

  // 位置：直接寫到 DB
  if (msg?.type === 'location') {
    const r = await service.updateUserLocation(event);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
  }

  if (msg?.type !== 'text') return null;

  const raw = (msg.text || '').trim();
  const lower = raw.toLowerCase();

  // 指令對照
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
    const r = await service.exploreRestaurant(lineUserId, radius);
    if (!r.ok) return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
    const first = r.results[0];
    const text = `試試這間：${first.name}\n${first.address || ''}`;
    return client.replyMessage(event.replyToken, { type: 'text', text });
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

  // add / 新增 店名
  if (lower.startsWith('add') || raw.startsWith('新增')) {
    const name = raw.replace(/^(add|新增)\s*/i, '').trim();
    const r = await service.addRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
  }

  // remove / 移除 店名
  if (lower.startsWith('remove') || raw.startsWith('移除')) {
    const name = raw.replace(/^(remove|移除)\s*/i, '').trim();
    const r = await service.removeRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
  }

  // 其他：簡單回覆
  return client.replyMessage(event.replyToken, { type: 'text', text: '輸入 help 看用法，或用圖文選單操作。' });
}
