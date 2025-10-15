export default async function onFollow(client, event) {
  const text =
    '哈囉！\n\n常用指令：\n' +
    '• 新增 店名\n' +
    '• 移除 店名\n' +
    '• 我的餐廳 / get\n' +
    '• 隨機 / random\n' +
    '• 探索 / explore 1500\n' +
    '• 傳一則「位置訊息」給我，我才能用附近餐廳當候補喔！';
  return client.replyMessage(event.replyToken, { type: 'text', text });
}
