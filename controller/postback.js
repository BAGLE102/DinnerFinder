// controller/postback.js
import { client as lineClient } from '../config/line.js';
import { loadState } from '../model/postbackState.js';
import { sendExplore, sendRandom } from '../service/exploreRestaurant.js';
import { getNextPage, searchNearby } from '../service/places.js';
import { addFavorite, choosePlace } from '../service/userList.js';

const parseData = (data = '') => Object.fromEntries(new URLSearchParams(data));

async function sendText(replyToken, text) {
  return lineClient.replyMessage(replyToken, [{ type: 'text', text }]);
}

export async function onPostback({ replyToken, user, postback }) {
  try {
    const args = parseData(postback?.data || '');
    const a = args.a;
    const id = args.id;
    if (!a) return;

    // a=choose&id=<placeId>
    if (a === 'choose' && id) {
      await choosePlace(user.id, id);
      await sendText(replyToken, '已選擇！');
      return;
    }

    // a=add&id=<placeId>
    if (a === 'add' && id) {
      await addFavorite(user.id, id);
      await sendText(replyToken, '已加入清單！');
      return;
    }

    // a=em&id=<stateId>  （Explore More）
    if (a === 'em' && id) {
      const st = await loadState(user.id, id);
      if (!st) { await sendText(replyToken, '這頁失效了，請再探索一次'); return; }
      const { lat, lng, radius, nextPageToken } = st;
      const { places, nextPageToken: npt } = await getNextPage({ nextPageToken });
      await sendExplore({ replyToken, user, lat, lng, radius, places, nextPageToken: npt });
      return;
    }

    // a=rng&id=<stateId> （Re-Random）
    if (a === 'rng' && id) {
      const st = await loadState(user.id, id);
      if (!st) { await sendText(replyToken, '候選失效了，請再探索一次'); return; }
      const { lat, lng, radius } = st;

      // 重新撈一批，再抽
      const { places } = await searchNearby({ lat, lng, radius });
      await sendRandom({ replyToken, userId: user.id, lat, lng, radius, places });
      return;
    }

    await sendText(replyToken, '不支援的操作');
  } catch (err) {
    console.error('[onPostback] error', err);
    try { await sendText(replyToken, '操作失敗，請再試一次'); } catch {}
  }
}
