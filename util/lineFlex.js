// util/lineFlex.js
// - 不使用 { type: 'filler' }
// - 評分/距離列改用 layout: 'horizontal'
// - 「再 10 間」改成 message action（避免超長 postback）

export function placeToBubble(p) {
  const { name, rating, distance, addr, photoUrl, mapUrl } = p;

  const chooseData = `action=choose&name=${encodeURIComponent(name)}`;
  const addData    = `action=add&name=${encodeURIComponent(name)}`;

  const bodyContents = [
    { type: 'text', text: name || '（未命名）', weight: 'bold', size: 'lg', wrap: true },
    ...((rating || distance) ? [{
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: [
        ...(rating   ? [{ type: 'text', text: rating,   size: 'sm', color: '#777' }] : []),
        ...(distance ? [{ type: 'text', text: distance, size: 'sm', color: '#777' }] : []),
      ]
    }] : []),
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
    ...(mapUrl ? [{
      type: 'button',
      style: 'link',
      height: 'sm',
      action: { type: 'uri', label: '在地圖開啟', uri: mapUrl }
    }] : []),
  ];

  return {
    type: 'bubble',
    ...(photoUrl ? {
      hero: { type: 'image', url: photoUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' }
    } : {}),
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: bodyContents },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons }
  };
}

export function placesToCarousel(places = []) {
  const bubbles = places.slice(0, 10).map(placeToBubble); // carousel 上限 10
  return { type: 'carousel', contents: bubbles };
}

export function buildQuickReply() {
  return {
    items: [
      { type: 'action', action: { type: 'message',  label: '探索 1500', text: '探索 1500' } },
      { type: 'action', action: { type: 'message',  label: '探索 3000', text: '探索 3000' } },
      { type: 'action', action: { type: 'message',  label: '探索 5000', text: '探索 5000' } },
      { type: 'action', action: { type: 'message',  label: '隨機',       text: '隨機' } },
      { type: 'action', action: { type: 'message',  label: '我的餐廳',   text: '我的餐廳' } },
      { type: 'action', action: { type: 'location', label: '傳位置' } },
      { type: 'action', action: { type: 'message',  label: '再 10 間',   text: '再 10 間' } },
    ]
  };
}

export function buildFlexMessage({ places = [], altText } = {}) {
  const contents = placesToCarousel(places);
  const alt = altText || `找到 ${places.length} 家餐廳`;
  return { type: 'flex', altText: alt, contents, quickReply: buildQuickReply() };
}
