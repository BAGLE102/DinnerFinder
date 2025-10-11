import Restaurant from '../model/restaurant.js';

export default async function addRestaurant(source, name) {
  const ownerUserId = source?.groupId || source?.roomId || source?.userId;
  if (!ownerUserId) return { ok: false, text: '來源不明，請在 1:1 視窗使用。' };
  if (!name) return { ok: false, text: '請在「新增」後面加店名，例如：新增 八方雲集' };

  const ret = await Restaurant.updateOne(
    { ownerUserId, name },
    { $setOnInsert: { createdAt: new Date() }, $set: { updatedAt: new Date() } },
    { upsert: true }
  );

  if (ret.upsertedCount || ret.matchedCount) {
    return { ok: true, text: `已加入：${name}` };
  }
  return { ok: false, text: '加入失敗，稍後再試。' };
}
