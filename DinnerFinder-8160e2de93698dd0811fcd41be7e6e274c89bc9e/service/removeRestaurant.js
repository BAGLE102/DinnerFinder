import Restaurant from '../model/restaurant.js';

export default async function removeRestaurant(source, name) {
  const ownerUserId = source?.groupId || source?.roomId || source?.userId;
  if (!ownerUserId) return { ok: false, text: '來源不明，請在 1:1 視窗使用。' };
  if (!name) return { ok: false, text: '請在「移除」後面加店名，例如：移除 八方雲集' };

  const ret = await Restaurant.deleteOne({ ownerUserId, name });
  if (ret.deletedCount) return { ok: true, text: `已移除：${name}` };
  return { ok: false, text: `找不到「${name}」。` };
}
