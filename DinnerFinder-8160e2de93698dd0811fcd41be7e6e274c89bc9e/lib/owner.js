// 決定這次操作用哪個 owner key（清單歸屬）
export function getOwnerKey(source) {
  return source?.groupId || source?.roomId || source?.userId || null;
}
