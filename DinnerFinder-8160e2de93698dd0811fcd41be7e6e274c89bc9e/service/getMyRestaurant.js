import Restaurant from '../model/restaurant.js';

export default async function getMyRestaurant(source) {
  const ownerUserId = source?.groupId || source?.roomId || source?.userId;
  if (!ownerUserId) throw new Error('OWNER_MISSING');

  const list = await Restaurant.find({ ownerUserId }).sort({ updatedAt: -1 }).lean();
  return list;
}
