import 'dotenv/config.js';
import express from 'express';
import line from '@line/bot-sdk';
import connectMongoDB from './config/mongo.js';
import controller from './controller/index.js';
import mongoose from 'mongoose';
import User from './model/user.js';
import Restaurant from './model/restaurant.js';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

const app = express();

// 健康檢查
app.get('/health', (_req, res) => res.status(200).send('OK'));

// 方便你檢查 DB 名與筆數
app.get('/db-info', async (_req, res) => {
  const admin = mongoose.connection.db.admin();
  const ping = await admin.ping();
  const users = await User.countDocuments();
  const rests = await Restaurant.countDocuments();
  res.json({ ok: true, dbName: mongoose.connection.name, counts: { users, restaurants: rests }, ping });
});

// LINE webhook
app.post('/callback', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type === 'message')  return controller.message(client, event);
  if (event.type === 'postback') return controller.postback(client, event);
  if (event.type === 'follow')   return controller.follow(client, event);
  return Promise.resolve(null);
}

// 啟動
await connectMongoDB();
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`listening on ${port}`));
// src/index.js（節錄）
import exploreRestaurant from './service/exploreRestaurant.js';
import User from './model/user.js';

// ...既有的 /health /db-info 之後，加上：
app.get('/explore-debug', async (req, res) => {
  try {
    const radius = Number(req.query.radius) || 1500;
    const limit = Number(req.query.limit) || 10;
    let lineUserId = req.query.user;

    // 若沒指定 user，就取最近一次有上傳位置的使用者
    if (!lineUserId) {
      const u = await User.findOne({ 'lastLocation.lat': { $exists: true } })
        .sort({ 'lastLocation.updatedAt': -1 })
        .lean();
      if (u) lineUserId = u.lineUserId;
    }
    if (!lineUserId) {
      return res.status(400).json({ ok: false, error: '找不到任何 lastLocation，請先在 LINE 傳一則位置訊息' });
    }

    const out = await exploreRestaurant(lineUserId, radius, { debug: true, limit });
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

