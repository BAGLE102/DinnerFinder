// controller/postback.js
import { URLSearchParams } from 'url';
import { addRestaurantToUser } from '../service/user.js';
import { exploreByNextToken } from '../service/exploreRestaurant.js';
import randomRestaurant from '../service/randomRestaurant.js';

export default async function onPostback(event, client) {
  const replyToken = event.replyToken;
  const userId = event.source?.userId;

  // data 是 querystring 形式：action=add&place_id=xxx&name=yyy
  const dataQs = new URLSearchParams(event.postback?.data || '');
  const action = dataQs.get('action');

  try {
    switch (action) {
      case 'explore_more': {
        const token = dataQs.get('token') || dataQs.get('key');
        const uid = dataQs.get('user') || userId;
        if (!token) {
          return client.replyMessage(replyToken, { type: 'text', text: '沒有下一頁 token，可再探索一次～' });
        }
        return exploreByNextToken(client, replyToken, uid, token);
      }

      case 'add': {
        const placeId = dataQs.get('place_id');
        const name = dataQs.get('name') ? decodeURIComponent(dataQs.get('name')) : '這間';
        if (!placeId) {
          return client.replyMessage(replyToken, { type: 'text', text: '找不到這間的 place_id，無法加入。' });
        }
        await addRestaurantToUser(userId, placeId);
        return client.replyMessage(replyToken, { type: 'text', text: `已加入清單：${name}` });
      }

      case 'choose': {
        const name = dataQs.get('name') ? decodeURIComponent(dataQs.get('name')) : '這間';
        return client.replyMessage(replyToken, { type: 'text', text: `今天就吃：${name} 🎉` });
      }

      case 'random_again': {
        const radius = parseInt(dataQs.get('radius') || '1500', 10);
        return randomRestaurant(client, replyToken, userId, radius);
      }

      default:
        return client.replyMessage(replyToken, { type: 'text', text: '我不太懂這個按鈕的意思 😅' });
    }
  } catch (e) {
    console.error('[Postback error]', e);
    return client.replyMessage(replyToken, { type: 'text', text: '操作失敗了，等一下再試一次！' });
  }
}
