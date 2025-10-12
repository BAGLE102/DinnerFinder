// controller/message.js
import { sendExplore, sendRandom } from '../service/exploreRestaurant.js';
import { searchNearby, getNextPage } from '../service/places.js'; // 你原本的搜尋服務
import { shortId } from '../util/id.js';
import { saveState } from '../model/postbackState.js';

export async function onTextMessage({ replyToken, user, text, lat, lng }) {
  // 解析半徑
  const m = text.match(/探索\s*(1500|3000|5000)/);
  if (m) {
    const radius = Number(m[1]);
    const { places, nextPageToken } = await searchNearby({ lat, lng, radius });
    await sendExplore({ replyToken, user, lat, lng, radius, places, nextPageToken });
    return;
  }

  if (text === '隨機') {
    const radius = 1500;
    const { places } = await searchNearby({ lat, lng, radius });
    await sendRandom({ replyToken, userId: user.id, lat, lng, radius, places });
    return;
  }

  // 其他文字……
}
