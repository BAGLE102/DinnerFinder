// index.js
import express from 'express';
import bodyParser from 'body-parser';
import { client as lineClient } from './config/line.js';
import handleMessage from './controller/message.js';
import handlePostback from './controller/postback.js';
import { connectMongo, ensureIndexes } from './config/mongo.js';

const app = express();
app.use(bodyParser.json());

// 啟動前連線 DB、建立索引（不會重覆建立，安全）
await connectMongo();
await ensureIndexes();

app.post('/webhook', async (req, res) => {
  const events = req.body?.events || [];
  for (const ev of events) {
    try {
      if (ev.type === 'message') {
        await handleMessage(ev);
      } else if (ev.type === 'postback') {
        await handlePostback(ev);
      }
    } catch (err) {
      console.error('[webhook] handler error', err);
      if (ev.replyToken) {
        try { await lineClient.replyMessage(ev.replyToken, [{ type: 'text', text: '出錯了，我稍後再處理 🙏' }]); } catch {}
      }
    }
  }
  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server listening on ' + port));
