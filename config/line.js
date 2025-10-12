// config/line.js
import line from '@line/bot-sdk';

export const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

function byteLen(s) {
  try { return Buffer.byteLength(String(s)); } catch { return 0; }
}

function sanitizeBox(box) {
  if (!box || box.type !== 'box' || !Array.isArray(box.contents)) return;
  // 移除所有 filler（baseline 裡尤其會被擋）
  box.contents = box.contents.filter(c => c && c.type !== 'filler');
  // 遞迴處理內層 box
  for (const c of box.contents) {
    if (c && c.type === 'box') sanitizeBox(c);
  }
}

function sanitizeFlexContents(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'carousel' && Array.isArray(node.contents)) {
    node.contents = node.contents.slice(0, 10); // 安全上限
    node.contents.forEach(b => sanitizeFlexContents(b));
  } else if (node.type === 'bubble') {
    if (node.body) sanitizeBox(node.body);
    if (node.footer) sanitizeBox(node.footer);
    // hero 不動它
  } else if (node.type === 'box') {
    sanitizeBox(node);
  }
}

function sanitizeMessages(messages) {
  let cloned = messages;
  try { cloned = JSON.parse(JSON.stringify(messages)); } catch {}
  for (const m of cloned) {
    if (m?.type === 'flex' && m.contents) sanitizeFlexContents(m.contents);
    if (m?.quickReply?.items) {
      m.quickReply.items = m.quickReply.items.filter((it, i) => {
        const a = it?.action;
        if (a?.type === 'postback' && typeof a.data === 'string') {
          const len = byteLen(a.data);
          if (len > 280) {
            console.warn(`[san] drop oversize quickReply data=${len}B label=${a.label}`);
            return false;
          }
        }
        return true;
      });
    }
  }
  return cloned;
}

export async function reply(replyToken, messages) {
  const safe = sanitizeMessages(messages);
  try {
    console.log('[reply] bytes=', byteLen(JSON.stringify(safe)));
    await client.replyMessage(replyToken, safe);
  } catch (err) {
    const res = err?.originalError?.response;
    console.error('[LINE reply error]', {
      status: res?.status,
      data: res?.data,   // 這裡會看到 LINE 指出哪個欄位不合法
      message: err?.message,
    });
    throw err;
  }
}
