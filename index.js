// index.js
import * as line from '@line/bot-sdk';
import express from 'express';
import connectMongoDB from './src/config/mongo.js';
import config from './src/config/config.js';   // 你原本的設定檔
import controller from './src/controller/index.js'; // 你原本的 controller 聚合

const app = express();

/* ---- Health FIRST：放最上面、回最簡單，避免被任何 middleware 影響 ---- */
app.get('/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('text/plain').status(200).send('ok');
});
app.head('/health', (_req, res) => res.status(200).end());
/* -------------------------------------------------------------------- */

/* ---- LINE Webhook：先回 200，再背景處理，避免 Verify/Probe 逾時 ---- */
app.post(
  '/callback',
  line.middleware({
    channelAccessToken: config.line.channelAccessToken,
    channelSecret: config.line.channelSecret
  }),
  (req, res) => {
    res.status(200).end(); // 立刻回覆，Render/LINE 不會逾時
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    Promise.all(events.map(handleEvent)).catch(console.error);
  }
);
/* -------------------------------------------------------------------- */

/* ---- 其餘中介層/路由（若需要）放在 webhook 之後 ---- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---- DB 健康檢查（可選）---- */
import mongoose from 'mongoose';
app.get('/db-ping', async (_req, res) => {
  try {
    const pong = await mongoose.connection.db.admin().ping(); // { ok: 1 }
    res.json({ ok: true, ping: pong });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ---- 事件處理 ---- */
function handleEvent(event) {
  const { type } = event || {};
  // 可視需要留下 debug：
  // console.log('[event]', type, new Date().toISOString());

  switch (type) {
    case 'follow':
      return controller.follow(event);
    case 'message':
      return controller.message(event);
    case 'postback':
      return controller.postback(event);
    default:
      return Promise.resolve(null);
  }
}

/* ---- 啟動：連 DB -> listen（用 Render 的 PORT） ---- */
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
