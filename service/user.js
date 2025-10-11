// service/user.js
import { getDb } from '../config/mongo.js';

export async function upsertUser(lineUserId) {
  const db = getDb();
  const now = new Date();
  await db.collection('users').updateOne(
    { lineUserId },
    { $setOnInsert: { createdAt: now }, $set: { updatedAt: now } },
    { upsert: true }
  );
  return db.collection('users').findOne({ lineUserId });
}

export async function updateUserLocation(lineUserId, lat, lng) {
  const db = getDb();
  const res = await db.collection('users').updateOne(
    { lineUserId },
    { $set: { lineUserId, lastLocation: { lat, lng, updatedAt: new Date() } } },
    { upsert: true }
  );
  console.log('[UpdateUserLocation] db=', db.databaseName, 'coll= users', 'filter=', { lineUserId }, 'result=', res);
}

export async function getUser(lineUserId) {
  const db = getDb();
  return db.collection('users').findOne({ lineUserId });
}

export async function addRestaurantToUser(lineUserId, place_id) {
  const db = getDb();
  await db.collection('users').updateOne(
    { lineUserId },
    { $addToSet: { restaurants: place_id }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
}

export async function getMyRestaurants(lineUserId, limit = 10) {
  const db = getDb();
  const user = await db.collection('users').findOne({ lineUserId });
  if (!user?.restaurants?.length) return [];
  const docs = await db.collection('restaurants')
    .find({ place_id: { $in: user.restaurants } })
    .limit(limit)
    .toArray();
  return docs;
}
