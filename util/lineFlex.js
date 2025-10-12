// util/lineFlex.js
// 建 Flex Bubble / Carousel / Quick Reply（符合 LINE Flex 規格，避免 400）
// 1) 不使用 { type: 'filler' }
// 2) 評分/距離一列用 layout: 'horizontal'（baseline 不能放 filler）
// 3) 「再 10 間」改為 message action（避免 postback data > 300 bytes）

/**
 * 將單一地點轉成 Flex bubble
 * @param {Object} p
 * @param {string} p.name
 * @param {string=} p.rating    // ex: "⭐ 4.6"
 * @param {string=} p.distance  // ex: "73 m"
 * @param {string=} p.addr
 * @param {string=} p.photoUrl  // hero 圖片（可選）
 * @param {string=} p.mapUrl    // 在地圖開啟（可選）
 */
export function placeToBubble(p) {
  const {
    name,
    rating,
    distance,
    addr,
    photoUrl,
    mapUrl,
  } = p;

  const chooseData = `action=choose&name=${encodeURIComponent(name)}`;
  const addData    = `action=add&name=${encodeURIComponent(name)}`;

  const bodyContents = [
    { type: 'text', text: name || '（未命名）', weight: 'bold', size: 'lg', wrap: true },
    // 評分 / 距離（有資料才顯示；用 horizontal）
    ...((rating || distance) ? [{
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: [
        ...(rating   ? [{ type: 'text', text: rating,   size: 'sm', color: '#777' }] : []),
        ...(distance ? [{ type: 'text', text: distance, size: 'sm', color: '#777' }] : []),
      ]
    }] : []),
    // 地址（有資料才顯示）
    ...(addr ? [{ type: 'text', text: addr, size: 'sm', color: '#555', wrap: true }] : []),
  ];

  const footerButtons = [
    {
      type: 'button',
      style: 'primary',
      height: 'sm',
      action: { type: 'postback', label: '就吃這間', data: chooseData, displayText: `就吃 ${name}` }
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: { type: 'postback', label: '加入清單', data: addData, displayText: `加入 ${name}` }
    },
    // 有 mapUrl 才顯示（不要放 filler）
    ...(mapUrl ? [{
      type: 'button',
      style: 'link',
      height: 'sm',
      action: { type: 'uri', label: '在地圖開啟', uri: mapUrl }
    }] : []),
  ];

  const bubble = {
    type: 'bubble',
    ...(photoUrl ? {
      hero: { type: 'image', url: photoUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' }
    } : {}),
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: bodyContents },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons }
  };

  return bubble;
}

/**
 * 將地點清單轉成 carousel
 * @param {Array<Object>} places - 每個元素會傳給 placeToBubble
 * @returns {Object} flex contents
 */
export function placesToCarousel(places = []) {
  const bubbles = places.slice(0, 10).map(placeToBubble); // LINE carousel 上限 10
  return { type: 'carousel', contents: bubbles };
}

/**
 * Quick Reply - 全部用 message/location（不使用超長 postback）
 * @returns {Object} quickReply
 */
export function buildQuickReply() {
  return {
    items: [
      { type: 'action', action: { type: 'message',  label: '探索 1500', text: '探索 1500' } },
      { type: 'action', action: { type: 'message',  label: '探索 3000', text: '探索 3000' } },
      { type: 'action', action: { type: 'message',  label: '探索 5000', text: '探索 5000' } },
      { type: 'action', action: { type: 'message',  label: '隨機',       text: '隨機' } },
      { type: 'action', action: { type: 'message',  label: '我的餐廳',   text: '我的餐廳' } },
      { type: 'action', action: { type: 'location', label: '傳位置' } },
      // 「再 10 間」改 message（由你的文字事件處理器去抓下一頁）
      { type: 'action', action: { type: 'message',  label: '再 10 間',   text: '再 10 間' } },
    ]
  };
}

/**
 * 組成一則 Flex 訊息（含 quickReply）
 * @param {Object} opts
 * @param {Array<Object>} opts.places
 * @param {string=} opts.altText  // 可自訂；預設 "找到 N 家餐廳"
 */
export function buildFlexMessage({ places = [], altText } = {}) {
  const contents = placesToCarousel(places);
  const alt = altText || `找到 ${places.length} 家餐廳`;

  return {
    type: 'flex',
    altText: alt,
    contents,
    quickReply: buildQuickReply()
  };
}
