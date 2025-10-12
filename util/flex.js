// 只產出合法 Flex：不用 baseline+filler；缺資料時用 spacer；按鈕改 message action
function buildExploreFlex(places, nextPageToken, lineUserId, isSingle = false) {
  const bubbles = places.map(p => {
    const body = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'text', text: p.name || '（未命名）', weight: 'bold', size: 'lg', wrap: true },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            p.rating ? { type: 'text', text: p.rating, size: 'sm', color: '#777' } : { type: 'spacer' },
          ].concat(p.lat && p.lng ? [{ type: 'spacer' }] : [])
        },
        p.address ? { type: 'text', text: p.address, size: 'sm', color: '#555', wrap: true } : { type: 'spacer' },
      ]
    };

    const footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          action: { type: 'message', label: '就吃這間', text: `就吃 ${p.name}` }
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: { type: 'message', label: '加入清單', text: `加入 ${p.name}` }
        },
        {
          type: 'button',
          style: 'link',
          height: 'sm',
          action: { type: 'uri', label: '在地圖開啟', uri: p.mapUrl }
        },
      ]
    };

    const bubble = { type: 'bubble' };
    if (p.photoUrl) {
      bubble.hero = {
        type: 'image',
        url: p.photoUrl,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
      };
    }
    bubble.body = body;
    bubble.footer = footer;
    return bubble;
  });

  const contents = isSingle
    ? bubbles[0]
    : { type: 'carousel', contents: bubbles };

  return contents;
}

module.exports = { buildExploreFlex };
