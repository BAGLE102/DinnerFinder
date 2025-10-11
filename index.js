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
