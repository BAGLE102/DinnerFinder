// controller/postback.js
export default async function onPostback(client, event) {
  const raw = event.postback?.data || '';
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch {
    try { data = Object.fromEntries(new URLSearchParams(raw).entries()); }
    catch { data = { raw }; }
  }

  // TODO: 依 data.action 做事；先回個字串避免崩潰
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `postback: ${JSON.stringify(data)}`
  });
}
