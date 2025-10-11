import mongoose from 'mongoose';
import User from '../model/user.js';

export default async function updateUserLocation(event) {
  if (event.message?.type !== 'location') {
    return { ok: false, text: '請傳送 LINE 內建的「位置訊息」。' };
  }
  const lineUserId = event.source?.userId;
  const lat = event.message.latitude;
  const lng = event.message.longitude;

  const ret = await User.updateOne(
    { lineUserId },
    { $set: { lastLocation: { lat, lng, updatedAt: new Date() } } },
    { upsert: true }
  );

  console.log('[UpdateUserLocation] db=', mongoose.connection.name,
              'coll=', User.collection.name,
              'filter=', { lineUserId },
              'result=', ret);

  return { ok: true, text: 'Update user location successfully' };
}
