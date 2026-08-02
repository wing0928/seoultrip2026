import { normalizePlaceType } from './placePresentation.js';

const NAVER_MAP_SEARCH = 'https://map.naver.com/p/search/';
const NAVER_MAP_DIRECTIONS = 'https://map.naver.com/p/directions/-/';
const GOOGLE_MAP_SEARCH = 'https://www.google.com/maps/search/?api=1&query=';
const CATCHTABLE_GLOBAL_HOME = 'https://www.catchtable.net/';
const NAVER_MAP_SCHEME = 'nmap://search';
const NAVER_MAP_ROUTE_SCHEME = 'nmap://route/public';
const NAVER_MAP_NAVIGATION_SCHEME = 'nmap://navigation';
const NAVER_MAP_ANDROID_INTENT = 'intent://search';
const NAVER_MAP_ROUTE_ANDROID_INTENT = 'intent://route/public';
const NAVER_MAP_NAVIGATION_ANDROID_INTENT = 'intent://navigation';
const NAVER_MAP_ANDROID_PACKAGE = 'com.nhn.android.nmap';
const NAVER_WEB_APP_NAME = 'https://wing0928.github.io/seoultrip2026/';
const NAVER_LINK_SEARCH_ALIASES = {
  IMyG5Odj: '문츠바베큐',
  '5eGT08VK': '몽탄',
  '5AmfnBTN': '풍천장어 연남점'
};

const CATCHTABLE_PLACE_TYPES = new Set(['餐廳', '咖啡廳']);

// CATCHTABLE's public search API only accepts requests from its own origin,
// so a GitHub Pages PWA cannot resolve shop refs at runtime without a proxy.
// Keep only refs that were verified against the public Global search results;
// unknown names stay blank instead of opening a misleading home/search page.
const VERIFIED_CATCHTABLE_SHOP_REFS = {
  '명동교자 본점': 'PE2BfEBiOKSE4q7WFdiTnQ',
  '리정원 명동점': 'VPnO7nDjLTfNHTQtXjWeFQ',
  '조조칼국수 성수점': 'SQyTeZtEuRPp6TcJXG3Vxg',
  '갈릭보이 광장시장': 'CrnI4nFED2w5ShhfFLYInQ',
  '태초갈비 명동점': 'RlsUuwDX15ReptKeHGljFQ',
  '무구옥': 'OILMXEC-HmIFsdWWGvg_1g',
  '무구옥 성수점': 'YzmoeJ4mYjyGV_iBuHoNTw',
  '해옫 연남': 'eGWflDGvzenF8-p_6GXP1w',
  '스케줄성수': 'XGZ4Ldt3lvBgj3V-4rxIsQ',
  '스케줄 성수': 'XGZ4Ldt3lvBgj3V-4rxIsQ',
  '해정집 합정점': 'sMj4wR9dKng2KPbsi6UBbg',
  '문츠바베큐': 'Zfq9Z-4ktXjebSlg3Iza0g',
  '마리오네': 'KrLJIrsbt3LHyEAH0H5UAQ',
  '몽탄': 'yh0PkP8ptvWlr62IVdqkxQ',
  '꿉당 성수점': 'S76IxuEqzmOuMiZuvz_b1w',
  '안주마을 통인점': 'b7wfUjvGX7AJ6Ipt2cCv9Q',
  // Yeonnam's Jo&Dawson Tearoom matches the existing wishlist cafe.
  '조앤도슨': 'sVwsMyhx1Tt0oOTUgvWYyg'
};

function withoutEnglishSeoul(query = '') {
  return String(query)
    .replace(/\bSeoul\b/gi, ' ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/,\s*(到|$)/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchMapUrl(query) {
  return `${NAVER_MAP_SEARCH}${encodeURIComponent(withoutEnglishSeoul(query) || '首爾')}`;
}

export function routeMapUrl(origin, destination) {
  if (!origin || !destination) return searchMapUrl(destination || origin || '首爾');
  // Keep generated itinerary data useful without turning a route into a
  // literal search query (for example, "A 到 B 大眾交通"). The interactive
  // route buttons resolve the destination coordinates and use the Naver route
  // URL scheme below.
  return searchMapUrl(destination);
}

export function placeMapUrl(place) {
  if (!place) return searchMapUrl('首爾');
  if (/(?:naver\.com|naver\.me)/i.test(place.naverMapUrl || '')) return cleanNaverSearchUrl(place.naverMapUrl);
  if (place.googleMapUrl?.includes('naver.com')) return cleanNaverSearchUrl(place.googleMapUrl);
  if (place.mapUrl?.includes('naver.com')) return cleanNaverSearchUrl(place.mapUrl);
  return searchMapUrl(naverSearchName(place));
}

export function naverMapAppUrl(place) {
  const query = encodeURIComponent(naverAppSearchQuery(place));
  const appName = encodeURIComponent(NAVER_WEB_APP_NAME);
  return `${NAVER_MAP_SCHEME}?query=${query}&appname=${appName}`;
}

export function naverMapAndroidIntentUrl(place) {
  const query = encodeURIComponent(naverAppSearchQuery(place));
  const appName = encodeURIComponent(NAVER_WEB_APP_NAME);
  return `${NAVER_MAP_ANDROID_INTENT}?query=${query}&appname=${appName}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${NAVER_MAP_ANDROID_PACKAGE};end`;
}

export function naverMapRouteUrl(place, location) {
  const coordinates = normalizeCoordinates(location || place);
  if (!coordinates) return placeMapUrl(place);

  const destination = encodeURIComponent(naverSearchName(place) || placeNameQuery(place) || '首爾');
  const { x, y } = toNaverWebCoordinates(coordinates);
  return `${NAVER_MAP_DIRECTIONS}${x},${y},${destination},,PLACE_POI/-/transit`;
}

export function naverMapRouteAppUrl(place, location) {
  const coordinates = normalizeCoordinates(location || place);
  if (!coordinates) return naverMapAppUrl(place);

  const params = new URLSearchParams({
    dlat: String(coordinates.latitude),
    dlng: String(coordinates.longitude),
    dname: naverSearchName(place) || placeNameQuery(place) || '首爾',
    appname: NAVER_WEB_APP_NAME
  });
  return `${NAVER_MAP_ROUTE_SCHEME}?${params.toString()}`;
}

export function naverMapNavigationAppUrl(place, location) {
  const coordinates = normalizeCoordinates(location || place);
  if (!coordinates) return naverMapAppUrl(place);

  const params = new URLSearchParams({
    dlat: String(coordinates.latitude),
    dlng: String(coordinates.longitude),
    dname: naverSearchName(place) || placeNameQuery(place) || '首爾',
    appname: NAVER_WEB_APP_NAME
  });
  return `${NAVER_MAP_NAVIGATION_SCHEME}?${params.toString()}`;
}

export function naverMapRouteAndroidIntentUrl(place, location) {
  return toNaverAndroidIntentUrl(naverMapRouteAppUrl(place, location), NAVER_MAP_ROUTE_ANDROID_INTENT);
}

export function naverMapNavigationAndroidIntentUrl(place, location) {
  return toNaverAndroidIntentUrl(naverMapNavigationAppUrl(place, location), NAVER_MAP_NAVIGATION_ANDROID_INTENT);
}

function naverAppSearchQuery(place) {
  const naverUrl = String(place?.naverMapUrl || place?.mapUrl || '');
  const aliasKey = Object.keys(NAVER_LINK_SEARCH_ALIASES).find((key) => naverUrl.includes(key));
  if (aliasKey) return NAVER_LINK_SEARCH_ALIASES[aliasKey];

  return naverSearchName(place) || '서울';
}

function toNaverAndroidIntentUrl(appUrl, intentPath) {
  const parsed = new URL(appUrl);
  const appName = parsed.searchParams.get('appname') || NAVER_WEB_APP_NAME;
  const query = new URLSearchParams(parsed.searchParams);
  query.set('appname', appName);
  return `${intentPath}?${query.toString()}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${NAVER_MAP_ANDROID_PACKAGE};end`;
}

function normalizeCoordinates(value) {
  const latitude = Number(value?.latitude ?? value?.lat);
  const longitude = Number(value?.longitude ?? value?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function toNaverWebCoordinates({ latitude, longitude }) {
  const earthRadius = 20037508.34;
  const x = longitude * earthRadius / 180;
  const y = Math.log(Math.tan((90 + latitude) * Math.PI / 360)) / (Math.PI / 180) * earthRadius / 180;
  return { x: x.toFixed(7), y: y.toFixed(7) };
}

export function googleMapUrl(place) {
  const name = placeNameQuery(place);
  if (place?.googlePlaceId) {
    return `${GOOGLE_MAP_SEARCH}${encodeURIComponent(name || '首爾')}&query_place_id=${encodeURIComponent(place.googlePlaceId)}`;
  }
  if (/(?:google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(place?.googleMapUrl || '')) {
    return cleanGoogleMapUrl(place.googleMapUrl, place);
  }
  return `${GOOGLE_MAP_SEARCH}${encodeURIComponent(name || '首爾')}`;
}

export function googleMapEmbedUrl(place, apiKey = '') {
  const name = placeNameQuery(place) || '首爾';
  if (apiKey) {
    const query = place?.googlePlaceId ? `place_id:${place.googlePlaceId}` : name;
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&language=zh-TW&region=KR`;
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(name)}&z=15&output=embed&hl=zh-TW`;
}

export function placeNameQuery(place) {
  return withoutEnglishSeoul(
    place?.lookupName ||
    place?.nameKo ||
    place?.koreanName ||
    place?.nameZhSimplified ||
    place?.name ||
    place?.nameZh ||
    place?.title ||
    '首爾'
  );
}

export function placeSearchQuery(place) {
  const name = placeNameQuery(place);
  const area = place?.area && !['待確認', '其他'].includes(place.area) ? ` ${place.area}` : '';
  return withoutEnglishSeoul(`${name}${area}`);
}

/**
 * Use a saved CATCHTABLE listing when available. For generated links, only
 * return a verified shop route; unknown names stay blank instead of opening
 * the CATCHTABLE home page.
 */
export function catchtableUrlForPlace(place) {
  const directUrl = String(place?.catchtableUrl || '').trim();
  if (directUrl) return directUrl;

  const type = normalizePlaceType(place?.type);
  if (!CATCHTABLE_PLACE_TYPES.has(type)) return '';

  const query = catchtableSearchQuery(place);
  if (!query) return '';

  const shopRef = VERIFIED_CATCHTABLE_SHOP_REFS[query];
  if (shopRef) return `${CATCHTABLE_GLOBAL_HOME}shop/${encodeURIComponent(shopRef)}`;

  return '';
}

/**
 * Resolve a food place to CATCHTABLE Global's in-app shop route. This uses a
 * checked local allowlist because CATCHTABLE's public endpoint rejects browser
 * requests from GitHub Pages (CORS); unknown places intentionally return blank.
 */
export async function resolveCatchtableUrlForPlace(place) {
  const directUrl = String(place?.catchtableUrl || '').trim();
  if (directUrl) return directUrl;

  const type = normalizePlaceType(place?.type);
  if (!CATCHTABLE_PLACE_TYPES.has(type)) return '';

  const query = catchtableSearchQuery(place);
  if (!query) return '';
  const shopRef = VERIFIED_CATCHTABLE_SHOP_REFS[query];
  return shopRef ? `${CATCHTABLE_GLOBAL_HOME}shop/${encodeURIComponent(shopRef)}` : '';
}

function catchtableSearchQuery(place) {
  const candidates = [place?.nameKo, place?.koreanName, place?.lookupName, place?.name, place?.title];
  return candidates
    .map((value) => withoutEnglishSeoul(value || ''))
    .find((value) => value && !/[\u3400-\u9fff]/.test(value)) || '';
}

function naverSearchName(place) {
  return withoutEnglishSeoul(
    place?.nameKo ||
    place?.koreanName ||
    place?.nameZhSimplified ||
    place?.lookupName ||
    placeNameQuery(place)
  );
}

function cleanNaverSearchUrl(url) {
  if (/naver\.me/i.test(url)) return url;
  const marker = '/p/search/';
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return url;

  const queryStart = markerIndex + marker.length;
  const suffixIndex = url.indexOf('?', queryStart);
  const encodedQuery = suffixIndex < 0 ? url.slice(queryStart) : url.slice(queryStart, suffixIndex);
  const suffix = suffixIndex < 0 ? '' : url.slice(suffixIndex);
  try {
    const cleanedQuery = withoutEnglishSeoul(decodeURIComponent(encodedQuery));
    return `${url.slice(0, queryStart)}${encodeURIComponent(cleanedQuery || '首爾')}${suffix}`;
  } catch {
    return url.replace(/(?:%2520|%20|\+|\s)*Seoul/gi, '');
  }
}

function cleanGoogleMapUrl(url, place) {
  try {
    const parsed = new URL(url);
    const query = parsed.searchParams.get('query');
    if (!query) return url;
    let cleanedQuery = withoutEnglishSeoul(query);
    const area = String(place?.area || '').trim();
    if (area && !['待確認', '其他'].includes(area)) {
      cleanedQuery = cleanedQuery.replace(new RegExp(`\\s*${escapeRegExp(area)}\\s*$`), '').trim();
    }
    parsed.searchParams.set('query', cleanedQuery || placeNameQuery(place) || '首爾');
    return parsed.toString();
  } catch {
    return url.replace(/(?:%2520|%20|\+|\s)*Seoul/gi, '');
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
