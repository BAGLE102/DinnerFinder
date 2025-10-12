// controller/postback.js
import { loadState, deleteState } from '../model/postbackState.js';
import { sendExplore, sendRandom } from '../service/exploreRestaurant.js';
import { searchNearby } from '../service/placesSearch.js';
import { client as lineClient } from '../config/line.js';

function parseKV(str) {
  const p = new URLSearchParams(str || '');
  const o = {};
  for (const [k, v] of p.entries()) o[k] = v;
  return o;
}

export default async function handlePostback(event) {
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  const data = parseKV(event.postback?.data || '');

  try {
    switch (data.a) {
      case 'em': { // explore more（用短 id 換 token）
        const st = await loadState(userId, data.id);
        if (!st) {
          await lineClient.replyMessage(replyToken, [{ type: 'text', text: '清單已過期，請再打「探索 1500」' }]);
          return;
        }
        const { lat, lng, radius, nextPageToken } = st;
        const { places, nextPageToken: next2 } = await searchNearby({ lat, lng, radius, pagetoken: nextPageToken });
        await sendExplore({ replyToken, userId, lat, lng, radius, places, nextPageToken: next2 });
        await deleteState(userId, data.id); // 用一次就丟
        break;
      }
      case 'rng': { // random again
        const st = await loadState(userId, data.id);
        if (!st) {
          await lineClient.replyMessage(replyToken, [{ type: 'text', text: '抽選條件已過期，請再打「隨機」' }]);
          return;
        }
        const { lat, lng, radius } = st;
        const { places } = await searchNearby({ lat, lng, radius });
        await sendRandom({ replyToken, userId, lat, lng, radius, places });
        break;
      }
      case 'choose': {
        await lineClient.replyMessage(replyToken, [{ type: 'text', text: '已選擇這間！' }]);
        break;
      }
      case 'add': {
        await lineClient.replyMessage(replyToken, [{ type: 'text', text: '已加入你的清單！' }]);
        break;
      }
      default:
        await lineClient.replyMessage(replyToken, [{ type: 'text', text: '操作無效或已過期，請重新探索。' }]);
    }
  } catch (err) {
    const body = err?.originalError?.response?.data || err?.response?.data || err?.message;
    console.error('[postback] error', body);
    await lineClient.replyMessage(replyToken, [{ type: 'text', text: '出錯了，我再修一下 QQ' }]);
  }
}
