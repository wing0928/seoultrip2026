const TYPE_EMOJIS = {
  景點: '📍',
  餐廳: '🍽️',
  美食: '🍜',
  小吃: '🥟',
  咖啡廳: '☕',
  商店: '🛍️',
  購物中心: '🏬',
  逛街: '🚶',
  拍照點: '📷',
  其他: '✨'
};

const KNOWN_TRANSLATIONS = {
  능동미나리성수점: '陵洞水芹菜 聖水店',
  '강남 곱': '江南烤腸',
  각시보쌈: '新娘菜包肉',
  마리오네: 'Marione 披薩店',
  '꿉당 성수점': '烤堂 聖水店',
  안주마을: '海味居酒屋',
  초원: '草原',
  아소토: 'Aalto 居酒屋',
  '만배아리랑보쌈 본점': '滿杯阿里郎菜包肉本店'
};

export function placeTypeEmoji(type) {
  return TYPE_EMOJIS[type] || '✨';
}

export function formatPlaceType(type) {
  const label = type || '其他';
  return `${placeTypeEmoji(label)} ${label}`;
}

export function formatPlaceName(place) {
  const korean = String(place?.nameKo || place?.koreanName || '').trim();
  const rawChinese = String(place?.nameZh || place?.chineseName || place?.name || '').trim();
  const fallbackTranslation = KNOWN_TRANSLATIONS[korean] || '';
  const cleanedChinese = cleanTranslation(rawChinese, korean);
  const chinese = containsHan(cleanedChinese) ? cleanedChinese : (fallbackTranslation || cleanedChinese);

  if (korean && chinese && korean !== chinese) return `${korean} | ${chinese}`;
  return korean || chinese || '未命名地點';
}

function cleanTranslation(value, korean) {
  if (!value || value === korean) return '';
  if (!korean) return value;
  return value.replace(korean, '').replace(/^\s*[|｜/·-]+\s*/, '').trim();
}

function containsHan(value) {
  return /[\u3400-\u9fff]/.test(value);
}
