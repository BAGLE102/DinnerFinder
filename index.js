// index.js
import express from 'express';
import line from '@line/bot-sdk';
import { connectMongo } from './config/mongo.js';
import messageController from './controller/message.js';
import postbackController from './controller/postback.js';

const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  PORT = 10000,
} = process.env;

if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_CHANNEL_SECRET) {
  console.error('[ENV] Missing LINE credentials');
  process.exit(1);
}

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};

const app = express();
const client = new line.Client(config);

app.get('/', (_, res) => res.send('OK'));

app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events || [];
  await Promise.all(events.map(e => handleEvent(e)));
  res.sendStatus(200);
});

async function handleEvent(event) {
  try {
    if (event.type === 'message') {
      return messageController(event, client);
    }
    if (event.type === 'postback') {
      return postbackController(event, client);
    }
  } catch (e) {
    console.error('[handleEvent error]', e);
  }
}

connectMongo()
  .then(() => app.listen(PORT, () => console.log('listening on', PORT)))
  .catch(err => {
    console.error('[Mongo connect error]', err);
    process.exit(1);
  });
