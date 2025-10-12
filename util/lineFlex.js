// util/lineFlex.js
// - 不用 { type: 'filler' }
// - 評分/距離列用 layout: 'horizontal'
// - 「再 10 間」改成 message action（避免超長 postback）
// - carousel 每則最多 10 個 bubble

export function placeToBubble(p) {
  const { name, rating, distance, addr, photoUrl, mapUrl } = p || {};
  const safeName = name || '（未命名）';

  const chooseData = `action=choose&name=${encodeURIComponent(safeName)}`;
  const addData    = `action=add&name=${encodeURIComponent(safeName)}`;

  const bodyContents = [
    { type: 'text', text: safeName, weight: 'bold', size: 'lg', wrap: true },
  ];

  if (rating || distance) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: [
        ...(rating   ? [{ type: 'text', text: `${rating}`,   size: 'sm', color: '#777' }] : []),
        ...(distance ? [{ type: 'text', text: `${distance}`, size: 'sm', color: '#777' }] : []),
      ]
    });
  }

  if (addr) {
    bodyContents.push({ type: 'text', text: addr, size: 'sm', color: '#555', wrap: true });
  }

  const footerButtons = [
    {
      type: 'button',
      style: 'primary',
      height: 'sm',
      action: { type: 'postback', label: '就吃這間', data: chooseData, displayText: `就吃 ${safeName}` }
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: { type: 'postback', label: '加入清單', data: addData, displayText: `加入 ${safeName}` }
    }
  ];

  if (mapUrl) {
    footerButtons.push({
      type: 'button',
      style: 'link',
      height: 'sm',
      action: { type: 'uri', label: '在地圖開啟', uri: mapUrl }
    });
  }

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
  const bubbles = (places || []).slice(0, 10).map(placeToBubble);
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
      // 重要：這顆改成 message action，避免攜帶巨大 postback data 觸發 400
      { type: 'action', action: { type: 'message',  label: '再 10 間',   text: '再 10 間' } },
    ]
  };
}

export function buildFlexMessage({ places = [], altText } = {}) {
  const contents = placesToCarousel(places);
  const alt = altText || `找到 ${places.length} 家餐廳`;
  return { type: 'flex', altText: alt, contents, quickReply: buildQuickReply() };
}
