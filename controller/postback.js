// controller/postback.js
import service from '../service/index.js';

export default async function onPostback(client, event) {
  const raw = event?.postback?.data || '';
  let data = {};
  try { data = JSON.parse(raw); }
  catch { try { data = Object.fromEntries(new URLSearchParams(raw).entries()); } catch { data = { raw }; } }

  const action = (data.action || '').toLowerCase();
  const name = data.name ? decodeURIComponent(data.name) : '';

  if (action === 'add') {
    const r = await service.addRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
  }
  if (action === 'choose') {
    const r = await service.chooseRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text });
  }

  return client.replyMessage(event.replyToken, { type: 'text', text: `postback: ${JSON.stringify(data)}` });
}
