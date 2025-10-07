'use strict'

import line from '@line/bot-sdk'
import express from 'express'
import config from './config/config.js'
import connectMongoDB from './config/mongo.js'
import controller from './controller/index.js'



const app = express()

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/callback', line.middleware(config.line), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err)
      res.status(500).end()
    })
})
connectMongoDB()
// 放在 src/app.js 其他路由下面即可
import mongoose from 'mongoose';

app.get('/db-ping', async (_req, res) => {
  try {
    // 方式A：MongoDB 原生 ping
    const admin = mongoose.connection.db.admin();
    const pong = await admin.ping();   // { ok: 1 }
    res.json({ ok: true, ping: pong });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// event handler
function handleEvent (event) {
  const eventType = event.type
  // TODO: remove later
  console.log(event)

  switch (eventType) {
    case 'follow':
      return controller.follow(event)
    case 'message':
      return controller.message(event)
    case 'postback':
      return controller.postback(event)
    default:
      console.log(`Unregistered event type: ${eventType}`)
      return Promise.resolve(null)
  }
}

// listen on port
app.listen(config.app.port, () => {
  console.log(`listening on ${config.app.port}`)
})
