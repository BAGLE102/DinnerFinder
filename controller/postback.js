// controller/postback.js
import { loadState, deleteState } from '../model/postbackState.js';
import { sendExplore, sendRandom } from '../service/exploreRestaurant.js';
import { getNextPage } from '../service/places.js';
import { addFavorite, choosePlace } from '../service/userList.js'; // 你原本的業務

const parseData = (data) => Object.fromEntries(new URLSearchParams(data));

export async function onPostback({ replyToken, user, postback }) {
  const args = parseData(postback.data);
  const a = args.a;
  if (!a) return;

  if (a === 'choose' && args.id) {
    await choosePlace(user.id, args.id);
    await sendText(replyToken, '已選擇！');
    return;
  }

  if (a === 'add' && args.id) {
    await addFavorite(user.id, args.id);
    await sendText(replyToken, '已加入清單！');
    return;
  }

  // explore more
  if (a === 'em' && args.id) {
    const st = await loadState(user.id, args.id);
    if (!st) { await sendText(replyToken, '這頁失效了，請再探索一次'); return; }
    const { lat, lng, radius, nextPageToken } = st;
    const { places, nextPageToken: npt } = await getNextPage({ nextPageToken });
    await sendExplore({ replyToken, user, lat, lng, radius, places, nextPageToken: npt });
    return;
  }

  // random again
  if (a === 'rng' && args.id) {
    const st = await loadState(user.id, args.id);
    if (!st) { await sendText(replyToken, '候選失效了，請再探索一次'); return; }
    const { lat, lng, radius } = st;
    // 你可以在 state 裡也存 places，或重撈：
    const { places } = await searchNearby({ lat, lng, radius });
    await sendRandom({ replyToken, userId: user.id, lat, lng, radius, places });
    return;
  }
}
