// src/service/userList.js
export async function addFavorite(userId, placeId) {
  // TODO: 之後改成把 placeId 寫進使用者收藏
  console.log('[userList] addFavorite', { userId, placeId });
}

export async function choosePlace(userId, placeId) {
  // TODO: 之後改成你要的「就吃這間」行為（記錄 / 通知等）
  console.log('[userList] choosePlace', { userId, placeId });
}
