const NAVER_MAP_SEARCH = 'https://map.naver.com/p/search/';
const GOOGLE_MAP_SEARCH = 'https://www.google.com/maps/search/?api=1&query=';
const NAVER_MAP_SCHEME = 'nmap://search';
const NAVER_MAP_ANDROID_INTENT = 'intent://search';
const NAVER_MAP_ANDROID_PACKAGE = 'com.nhn.android.nmap';
const NAVER_WEB_APP_NAME = 'https://wing0928.github.io/seoultrip2026/';
const NAVER_LINK_SEARCH_ALIASES = {
  IMyG5Odj: '문츠바베큐',
  '5eGT08VK': '몽탄',
  '5AmfnBTN': '풍천장어 연남점'
};

function withoutEnglishSeoul(query = '') {
  return String(query).replace(/\bSeoul\b/gi, ' ').replace(/\s+/g, ' ').trim();
}

export function searchMapUrl(query) {
  return `${NAVER_MAP_SEARCH}${encodeURIComponent(withoutEnglishSeoul(query) || '首爾')}`;
}

export function routeMapUrl(origin, destination) {
  if (!origin || !destination) return searchMapUrl(destination || origin || '首爾');
  return searchMapUrl(`${origin} 到 ${destination} 大眾交通`);
}

export function placeMapUrl(place) {
  if (!place) return searchMapUrl('首爾');
  if (/(?:naver\.com|naver\.me)/i.test(place.naverMapUrl || '')) return cleanNaverSearchUrl(place.naverMapUrl);
  if (place.googleMapUrl?.includes('naver.com')) return cleanNaverSearchUrl(place.googleMapUrl);
  if (place.mapUrl?.includes('naver.com')) return cleanNaverSearchUrl(place.mapUrl);
  return searchMapUrl(placeSearchQuery(place));
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

function naverAppSearchQuery(place) {
  const naverUrl = String(place?.naverMapUrl || place?.mapUrl || '');
  const aliasKey = Object.keys(NAVER_LINK_SEARCH_ALIASES).find((key) => naverUrl.includes(key));
  if (aliasKey) return NAVER_LINK_SEARCH_ALIASES[aliasKey];

  const koreanName = String(place?.nameKo || place?.koreanName || '').trim();
  return koreanName || placeSearchQuery(place) || '서울';
}

export function googleMapUrl(place) {
  if (/(?:google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(place?.googleMapUrl || '')) {
    return cleanGoogleMapUrl(place.googleMapUrl);
  }
  return `${GOOGLE_MAP_SEARCH}${encodeURIComponent(placeSearchQuery(place) || '首爾')}`;
}

export function placeSearchQuery(place) {
  const name = place?.nameKo || place?.koreanName || place?.name || place?.nameZh || place?.title || '首爾';
  const area = place?.area && !['待確認', '其他'].includes(place.area) ? ` ${place.area}` : '';
  return withoutEnglishSeoul(`${name}${area}`);
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

function cleanGoogleMapUrl(url) {
  try {
    const parsed = new URL(url);
    const query = parsed.searchParams.get('query');
    if (!query) return url;
    parsed.searchParams.set('query', withoutEnglishSeoul(query) || '首爾');
    return parsed.toString();
  } catch {
    return url.replace(/(?:%2520|%20|\+|\s)*Seoul/gi, '');
  }
}
