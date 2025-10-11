// controller/postback.js
import { loadState, deleteState } from '../model/postbackState.js';
import { sendExplore, sendRandom } from '../service/exploreRestaurant.js';
import { searchNearby, searchNextPage } from '../service/placesSearch.js'; // 你原本封裝 Google 的兩個方法
import { client as lineClient } from '../config/line.js';
import { getDb } from '../config/mongo.js';

function parseKV(str) {
  // "a=em&id=xxxx&pid=yyy" -> { a:'em', id:'xxxx', pid:'yyy' }
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
      case 'em': { // explore_more
        const st = await loadState(userId, data.id);
        if (!st) {
          await lineClient.replyMessage(replyToken, [{ type: 'text', text: '頁面已過期，請再打「探索 1500」' }]);
          return;
        }
        const { lat, lng, radius, nextPageToken } = st;
        const { places, nextPageToken: next2 } = await searchNextPage(nextPageToken);
        await sendExplore({
          replyToken, userId, lat, lng, radius,
          places, nextPageToken: next2
        });
        break;
      }
        case 'explore_more': {
          const key = data.k || data.key; // 兼容
          const rec = resolveMoreKey(key); // { token, params:{lat,lng,radius} } or null
          if (!rec) {
            await reply(replyToken, { type: 'text', text: '清單已過期，請再打一次「探索 1500/3000/5000」' });
            break;
          }
          const msg = await exploreRestaurant({
            ...rec.params,
            pageToken: rec.token,
          });
          await reply(replyToken, msg);
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
        const pid = data.pid;
        // TODO: 依 pid 寫入你「今天就吃這間」或建立 order，這裡只回個字
        await lineClient.replyMessage(replyToken, [{ type: 'text', text: '已選擇這間！' }]);
        break;
      }
      case 'add': {
        const pid = data.pid;
        // TODO: 依 pid 加入清單
        await lineClient.replyMessage(replyToken, [{ type: 'text', text: '已加入你的清單！' }]);
        break;
      }
      default:
        await lineClient.replyMessage(replyToken, [{ type: 'text', text: '操作無效或已過期，請重新探索。' }]);
    }
  } catch (err) {
    console.error('[postback] error', err);
    await lineClient.replyMessage(replyToken, [{ type: 'text', text: '出錯了，我再修一下 QQ' }]);
  }
}
