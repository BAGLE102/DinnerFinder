// src/util/lineFlex.js
export function restaurantBubble(r) {
  const name = r.name || '餐廳';
  const rating = (r.rating != null) ? `⭐ ${r.rating}` : '';
  const distance = (r.distance != null)
    ? (r.distance >= 1000 ? `${(r.distance / 1000).toFixed(1)} km` : `${r.distance} m`) : '';
  const addr = r.address || '';
  const placeId = r.placeId;
  const lat = r.location?.lat;
  const lng = r.location?.lng;

  const mapUrl = placeId
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${placeId}`
    : (lat!=null&&lng!=null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : undefined);

  let heroImageUrl;
  if (r.photoReference && process.env.GOOGLE_API_KEY) {
    const maxWidth = 1200;
    heroImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${r.photoReference}&key=${process.env.GOOGLE_API_KEY}`;
  } else if (r.photoUrl) {
    heroImageUrl = r.photoUrl;
  }

  const addData = `action=add&name=${encodeURIComponent(name)}`; // 用 add 當觸發詞
  const chooseData = `action=choose&name=${encodeURIComponent(name)}`;

  return {
    type: 'bubble',
    hero: heroImageUrl ? { type: 'image', url: heroImageUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } : undefined,
    body: {
      type: 'box', layout: 'vertical', spacing: 'sm',
      contents: [
        { type: 'text', text: name, weight: 'bold', size: 'lg', wrap: true },
        { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
          rating ? { type: 'text', text: rating, size: 'sm', color: '#777' } : { type: 'filler' },
          distance ? { type: 'text', text: distance, size: 'sm', color: '#777' } : { type: 'filler' }
        ]},
        addr ? { type: 'text', text: addr, size: 'sm', color: '#555', wrap: true } : { type: 'filler' }
      ].filter(Boolean)
    },
    footer: {
      type: 'box', layout: 'vertical', spacing: 'sm',
      contents: [
        { type: 'button', style: 'primary', height: 'sm',
          action: { type: 'postback', label: '就吃這間', data: chooseData, displayText: `就吃 ${name}` } },
        { type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'postback', label: '加入清單', data: addData, displayText: `加入 ${name}` } },
        mapUrl ? { type: 'button', style: 'link', height: 'sm',
          action: { type: 'uri', label: '在地圖開啟', uri: mapUrl } } : { type: 'filler' }
      ]
    }
  };
}

export function restaurantsCarousel(list) {
  const bubbles = list.map(restaurantBubble).slice(0, 10);
  return { type: 'carousel', contents: bubbles };
}

// 基礎 Quick Reply（可加 extra）
export function quickReply(extraItems = []) {
  const base = [
    { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
    { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
    { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } },
    { type: 'action', action: { type: 'message', label: '隨機', text: '隨機' } },
    { type: 'action', action: { type: 'message', label: '我的餐廳', text: '我的餐廳' } },
    { type: 'action', action: { type: 'location', label: '傳位置' } }
  ];
  return { items: [...base, ...extraItems] };
}

// explore 的「再 10 間」
export function moreQuickItem(nextToken, lineUserId) {
  return {
    type: 'action',
    action: {
      type: 'postback',
      label: '再 10 間',
      data: `action=explore_more&token=${encodeURIComponent(nextToken)}&user=${encodeURIComponent(lineUserId)}`,
      displayText: '再 10 間'
    }
  };
}

// random 的「再選一間」
export function randomMoreQuickItem(radius) {
  return {
    type: 'action',
    action: {
      type: 'postback',
      label: '再選一間',
      data: `action=random_more&radius=${encodeURIComponent(radius)}`,
      displayText: '再選一間'
    }
  };
}
