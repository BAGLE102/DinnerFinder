// util/flex.js
const KEY = process.env.GOOGLE_MAPS_API_KEY;

export function toBubble(r) {
  const name = (r.name || '未命名').slice(0, 40);
  const distance = r.distanceText ?? (r.distance_m != null ? `${r.distance_m} m` : null);
  const address = r.vicinity || r.formatted_address || '';

  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    contents: [
      { type: 'text', text: name, weight: 'bold', size: 'lg', wrap: true },
    ]
  };

  const metrics = [];
  if (r.rating) metrics.push({ type: 'text', text: `⭐ ${r.rating}`, size: 'sm', color: '#777' });
  if (distance) metrics.push({ type: 'text', text: distance, size: 'sm', color: '#777' });
  if (metrics.length) body.contents.push({ type: 'box', layout: 'baseline', spacing: 'sm', contents: metrics });
  if (address) body.contents.push({ type: 'text', text: address, size: 'sm', color: '#555', wrap: true });

  const footer = {
    type: 'box', layout: 'vertical', spacing: 'sm', contents: [
      {
        type: 'button', style: 'primary', height: 'sm',
        action: { type: 'postback', label: '就吃這間',
          data: `action=choose&place_id=${encodeURIComponent(r.place_id)}&name=${encodeURIComponent(name)}`,
          displayText: `就吃 ${name}` }
      },
      {
        type: 'button', style: 'secondary', height: 'sm',
        action: { type: 'postback', label: '加入清單',
          data: `action=add&place_id=${encodeURIComponent(r.place_id)}&name=${encodeURIComponent(name)}`,
          displayText: `加入 ${name}` }
      },
      {
        type: 'button', style: 'link', height: 'sm',
        action: { type: 'uri', label: '在地圖開啟',
          uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${r.place_id}` }
      }
    ]
  };

  const bubble = { type: 'bubble', body, footer };
  if (r.photo_reference && KEY) {
    bubble.hero = {
      type: 'image',
      url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${r.photo_reference}&key=${KEY}`,
      size: 'full', aspectRatio: '20:13', aspectMode: 'cover'
    };
  }
  return bubble;
}

export function toCarouselMessage(alt, restaurants, quickReply) {
  const bubbles = restaurants.slice(0, 10).map(toBubble); // <= LINE 限制
  const msg = {
    type: 'flex',
    altText: alt,
    contents: { type: 'carousel', contents: bubbles },
  };
  if (quickReply) msg.quickReply = quickReply;
  return msg;
}
