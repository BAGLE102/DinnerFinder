import Restaurant from '../model/restaurant.js';

export default async function chooseRestaurant(source, name) {
  const ownerUserId = source?.groupId || source?.roomId || source?.userId;
  if (!ownerUserId) return { ok: false, text: '來源不明，請在 1:1 視窗使用。' };
  if (!name) return { ok: false, text: '請在「選擇」後面加店名，例如：選擇 八方雲集' };

  const r = await Restaurant.findOne({ ownerUserId, name }).lean();
  if (!r) return { ok: false, text: `找不到「${name}」，先用「新增 ${name}」加入清單吧～` };

  await Restaurant.updateOne({ _id: r._id }, { $inc: { timesChosen: 1 }, $set: { lastChosenAt: new Date() } });

  const addr = r.address ? `\n📍 ${r.address}` : '';
  return { ok: true, text: `就決定是：${r.name}${addr}` };
}
