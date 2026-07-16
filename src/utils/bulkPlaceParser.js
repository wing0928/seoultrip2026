import { placeSearchQuery, searchMapUrl } from './maps.js';

const AREA_ALIASES = [
  ['明洞', ['明洞', '명동']],
  ['北村韓屋與景福宮', ['北村', '景福宮', '북촌', '경복궁', '三清洞']],
  ['弘大商圈', ['弘大', '홍대', '延南', '연남']],
  ['聖水洞', ['聖水', '성수', '首爾林', '서울숲']]
];

const TYPE_RULES = [
  ['餐廳', /餐廳|料理|飯|麵|湯|鍋|牛肉|豬肉|雞肉|鴨肉|牛排|燒肉|烤肉|烤腸|炸雞|煎餅|魚|蝦|蟹|披薩|義大利麵|包飯|拌飯|漢堡|pizza|pizzeria|pasta|steak|burger|restaurant|육회|곰탕|국밥|고기|갈비|곱창|보쌈|피자|파스타|맛집|식당/i],
  ['咖啡廳', /咖啡|coffee|cafe|카페/i],
  ['小吃', /小吃|點心|甜點|餅|snack|디저트|분식/i],
  ['購物中心', /百貨|商場|mall|department/i],
  ['商店', /商店|選物|服飾|品牌|shop|store|스토어/i]
];

const NUMBERED_LINE = /^\s*\d+[.)、．]\s*/;
const URL_PATTERN = /https?:\/\/[^\s]+/gi;

export function parseBulkPlaces({ text = '', sourceUrl = '', recommendationSource = '' }) {
  return splitEntries(text)
    .map((entry) => makePlace(entry, sourceUrl, recommendationSource))
    .filter(Boolean);
}

export function inferPlaceType(note = '', name = '', recommendationSource = '') {
  const isFoodList = /美食|餐廳|必吃|food|restaurant|맛집/i.test(recommendationSource);
  const hasMenuPrice = /(?:[$₩]\s*\d{3,}|\d{3,}\s*원)/i.test(note);
  if (isFoodList && hasMenuPrice) return '餐廳';
  return classifyType(note) || classifyType(name) || '其他';
}

function classifyType(text) {
  return TYPE_RULES.find(([, rule]) => rule.test(String(text)))?.[0] || '';
}

function splitEntries(text) {
  const normalized = String(text).replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const entries = [];
  let current = [];

  for (const line of lines) {
    if (NUMBERED_LINE.test(line)) {
      if (current.some((item) => item.trim())) entries.push(current.join('\n').trim());
      current = [line.replace(NUMBERED_LINE, '')];
    } else {
      current.push(line);
    }
  }

  if (current.some((item) => item.trim())) entries.push(current.join('\n').trim());
  if (entries.length > 1 || NUMBERED_LINE.test(lines[0])) return entries;

  return normalized.split(/\n\s*\n+/).map((entry) => entry.trim()).filter(Boolean);
}

function makePlace(entry, sourceUrl, recommendationSource) {
  const [rawName = '', ...detailLines] = entry.split('\n');
  const placeName = rawName.replace(URL_PATTERN, '').trim();
  if (!placeName) return null;

  const urls = [...entry.matchAll(URL_PATTERN)].map(([url]) => trimUrl(url));
  const naverMapUrl = urls.find(isNaverUrl) || '';
  const googleMapUrl = urls.find(isGoogleMapsUrl) || '';
  const detailText = detailLines.join('\n');
  const textWithoutMapUrls = detailText.replace(URL_PATTERN, (url) => {
    const cleanedUrl = trimUrl(url);
    return isNaverUrl(cleanedUrl) || isGoogleMapsUrl(cleanedUrl) ? '' : url;
  }).trim();
  const koreanMatch = placeName.match(/[가-힣][가-힣\d&'().·\- \t]*/)?.[0]?.trim() || '';
  const note = textWithoutMapUrls
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
  const area = AREA_ALIASES.find(([, aliases]) => aliases.some((alias) => entry.includes(alias)))?.[0] || '其他';
  const type = inferPlaceType(note, placeName, recommendationSource);
  const place = {
    id: crypto.randomUUID(),
    name: '',
    nameZh: placeName,
    nameKo: koreanMatch,
    type,
    area,
    sourceUrl,
    recommendationSource,
    naverMapUrl,
    googleMapUrl,
    bulkImported: true,
    note,
    priority: '想去',
    visited: false
  };

  return {
    ...place,
    mapUrl: naverMapUrl || searchMapUrl(placeSearchQuery(place))
  };
}

function trimUrl(url) {
  return url.replace(/[),.;，。；）]+$/g, '');
}

function isNaverUrl(url) {
  return /(?:naver\.com|naver\.me)/i.test(url);
}

function isGoogleMapsUrl(url) {
  return /(?:google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url);
}
