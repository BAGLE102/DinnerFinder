// controller/postback.js
import { client as lineClient } from '../config/line.js';

export default async function handlePostback(event) {
  const replyToken = event.replyToken;
  const data = event.postback?.data || '';
  const u = Object.fromEntries(new URLSearchParams(data).entries());
  try {
    if (u.a === 'choose') {
      await lineClient.replyMessage(replyToken, [{ type: 'text', text: '已選擇這間！' }]);
    } else if (u.a === 'add') {
      await lineClient.replyMessage(replyToken, [{ type: 'text', text: '已加入你的清單！' }]);
    } else {
      await lineClient.replyMessage(replyToken, [{ type: 'text', text: '操作無效或已過期。' }]);
    }
  } catch (e) {
    console.error('[postback] error', e);
  }
}
