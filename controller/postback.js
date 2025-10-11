// src/controller/postback.js
import exploreRestaurant, { resolveMoreKey } from '../service/exploreRestaurant.js';
import { reply } from '../config/line.js';

function parseKV(str) {
  const p = new URLSearchParams(str || '');
  const o = {};
  for (const [k, v] of p.entries()) o[k] = v;
  return o;
}

export default async function handlePostback(event) {
  const replyToken = event.replyToken;
  const data = parseKV(event.postback?.data || '');
  // 兼容：有人用 a=、有人用 action=
  const action = data.action || data.a;

  try {
    switch (action) {
      case 'explore_more': {
        // 短 key 換回 next_page_token
        const key = data.k || data.key;
        const rec = resolveMoreKey(key); // { token, params:{lat,lng,radius} } or null
        if (!rec) {
          await reply(replyToken, { type: 'text', text: '清單已過期，請再打一次「探索 1500/3000/5000」' });
          return;
        }
        const msg = await exploreRestaurant({
          ...rec.params,
          pageToken: rec.token,
        });
        await reply(replyToken, msg);
        break;
      }

      case 'choose': {
        const id = data.id || data.pid; // 兼容舊參數名
        await reply(replyToken, { type: 'text', text: `已選擇這間！（place_id: ${id}）` });
        break;
      }

      case 'add': {
        const id = data.id || data.pid;
        await reply(replyToken, { type: 'text', text: `已加入你的清單！（place_id: ${id}）` });
        break;
      }

      // 舊版殘留的 a=em / a=rng 如果真的還會收到，就回覆提示
      case 'em':
      case 'rng':
      default: {
        await reply(replyToken, { type: 'text', text: '操作無效或已過期，請重新探索。' });
      }
    }
  } catch (err) {
    console.error('[postback] error', err);
    await reply(replyToken, { type: 'text', text: '出錯了，我再修一下 QQ' });
  }
}
