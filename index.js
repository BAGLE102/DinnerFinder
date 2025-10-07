// index.js
import * as line from '@line/bot-sdk';
import express from 'express';

// 注意：這裡用 ./config/...（沒有 src）
import connectMongoDB from './config/mongo.js';
import config from './config/config.js';
import controller from './controller/index.js';

const app = express();

/* ---- Health：放最上面，回最簡單，讓 Render 健檢穩過 ---- */
app.get('/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('text/plain').status(200).send('ok');
});
app.head('/health', (_req, res) => res.status(200).end());
/* ------------------------------------------------------------------ */

/* ---- LINE Webhook：先回 200，再背景處理，避免 Verify/Probe 逾時 ---- */
app.post(
  '/callback',
  line.middleware({
    channelAccessToken: config.line.channelAccessToken,
    channelSecret: config.line.channelSecret
  }),
  (req, res) => {
    res.status(200).end(); // 立刻回覆
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    Promise.all(events.map(handleEvent)).catch(console.error);
  }
);
/* ------------------------------------------------------------------ */

// 其餘中介層與路由在 webhook 後面再加（避免影響 LINE 驗簽）
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// DB ping（選用）
import mongoose from 'mongoose';
app.get('/db-ping', async (_req, res) => {
  try {
    const pong = await mongoose.connection.db.admin().ping(); // { ok: 1 }
    res.json({ ok: true, ping: pong });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 事件處理
function handleEvent(event) {
  switch (event?.type) {
    case 'follow':  return controller.follow(event);
    case 'message': return controller.message(event);
    case 'postback':return controller.postback(event);
    default:        return Promise.resolve(null);
  }
}

// 啟動（Render 會注入 PORT）
const PORT = process.env.PORT || config.app?.port || 3000;

connectMongoDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`listening on ${PORT}`);
    });
  })
  .catch((e) => {
    console.error('Failed to connect MongoDB:', e?.message || e);
    process.exit(1);
  });
