import { itineraryDays, migrateTripItinerary, toPersistedItinerary } from '../data/itinerary.js';
import { inferPlaceType } from './bulkPlaceParser.js';
import { searchMapUrl } from './maps.js';

const DEFAULT_TRIP = {
  tripName: 'Seoul Trip 2026',
  dates: '2026/8/17–8/22',
  nights: '6 天 5 夜',
  hotelName: 'SL Hotel 明洞（SL호텔 명동）',
  hotelAddress: '50-6 Chungmuro 2(i)-ga, Jung District, Seoul, 南韓',
  hotelMapUrl: searchMapUrl('SL호텔 명동'),
  outboundFlight: '2026/8/17 長榮航空 BR172｜高雄 KHH Terminal 1 15:50 → 仁川 ICN Terminal 1 19:45｜A321・2 小時 55 分・經濟艙 Basic',
  returnFlight: '2026/8/22 長榮航空 BR145｜仁川 ICN Terminal 1 12:05 → 高雄 KHH Terminal 1 14:00｜A321・2 小時 55 分・經濟艙 Basic',
  arrivalAirport: '仁川國際機場（ICN）Terminal 1｜2026/8/17 19:45',
  departureAirport: '仁川國際機場（ICN）Terminal 1｜2026/8/22 12:05'
};

const DEFAULTED_TRIP_FIELDS = [
  'hotelName',
  'hotelAddress',
  'hotelMapUrl',
  'outboundFlight',
  'returnFlight',
  'arrivalAirport',
  'departureAirport'
];

const KEYS = {
  trip: 'seoul-trip-2026:settings',
  wishlist: 'seoul-trip-2026:wishlist',
  imports: 'seoul-trip-2026:imports',
  itinerary: 'seoul-trip-2026:itinerary',
  syncCode: 'seoul-trip-2026:sync-code'
};

export function loadTripSettings() {
  cleanupObsoleteCaches();
  const savedTrip = loadJson(KEYS.trip, {});
  const trip = { ...DEFAULT_TRIP, ...savedTrip };

  DEFAULTED_TRIP_FIELDS.forEach((field) => {
    if (!String(savedTrip[field] || '').trim() || savedTrip[field] === '待補') {
      trip[field] = DEFAULT_TRIP[field];
    }
  });

  return trip;
}

export function saveTripSettings(settings) {
  saveJson(KEYS.trip, { ...DEFAULT_TRIP, ...settings });
}

export function loadWishlist() {
  const wishlist = loadJson(KEYS.wishlist, []);
  const imports = loadJson(KEYS.imports, []);
  if (!imports.length) return migrateWishlist(wishlist);

  const knownIds = new Set(wishlist.map((item) => item.id));
  const migrated = imports
    .filter((item) => !knownIds.has(item.id))
    .map((item) => ({
      ...item,
      nameZh: item.nameZh || item.chineseName || item.name || '',
      name: '',
      priority: item.priority || '想去',
      visited: Boolean(item.visited)
  }));
  localStorage.removeItem(KEYS.imports);
  return migrateWishlist([...migrated, ...wishlist]);
}

export function migrateWishlist(items = []) {
  const preparedItems = items.map(markExistingManualType);
  return migrateWishlistAreas(preparedItems).map((item) => {
    const placeNames = `${item.nameZh || item.chineseName || item.name || ''} ${item.nameKo || item.koreanName || ''}`;
    if (/東大門綜合市場|동대문종합시장/i.test(placeNames)) return migrateLegacyWishlistDescription(item);

    const isBulkPlace = isBulkWishlistPlace(item);
    if (!isBulkPlace) return migrateLegacyWishlistDescription(item);

    const wasLegacyShop = item.type === '商店';
    const type = item.typeManuallySet
      ? item.type
      : (wasLegacyShop ? inferLegacyShopType(item) : inferPlaceType(item.note, item.nameZh || item.nameKo || item.name, item.recommendationSource));
    return migrateLegacyWishlistDescription({
      ...item,
      type,
      needsBusinessLookup: wasLegacyShop || item.needsBusinessLookup
    });
  });
}

function markExistingManualType(item) {
  if (item?.typeManuallySet || !item?.type || isBulkWishlistPlace(item)) return item;
  return { ...item, typeManuallySet: true };
}

function isBulkWishlistPlace(item) {
  return Boolean(item?.bulkImported || (
    item?.note &&
    item?.recommendationSource &&
    item?.sourceUrl &&
    (item?.naverMapUrl || item?.googleMapUrl)
  ));
}

function migrateLegacyWishlistDescription(item) {
  const description = String(item.description || '').trim();
  const note = String(item.note || '').trim();
  if (description || !note) return item;
  return { ...item, description: note, note: '' };
}

export function migrateWishlistAreas(items = []) {
  return items.map((item) => {
    const placeNames = `${item.nameZh || item.chineseName || item.name || ''} ${item.nameKo || item.koreanName || ''}`;
    const isDongdaemunMarket = /東大門綜合市場|동대문종합시장/i.test(placeNames);
    const area = (!item.area || ['其他', '待確認'].includes(item.area)) && /東大門|동대문|\bDDP\b/i.test(placeNames)
      ? '東大門'
      : item.area;
    const type = isDongdaemunMarket && item.type === '餐廳' && !item.typeManuallySet ? '景點' : item.type;
    return area === item.area && type === item.type ? item : { ...item, area, type };
  });
}

function inferLegacyShopType(item) {
  const text = `${item.nameZh || ''} ${item.nameKo || ''} ${item.note || ''}`;
  if (/選物店|選品店|選物|選品|select\s*shop|concept\s*store|편집샵|셀렉트샵/i.test(text)) return '選物店';
  if (/男裝|男士|男生|mens?\b|남성|남자|女裝|女士|女生|womens?\b|여성|여자|鞋子|shoes?\b/i.test(text)) return '服裝';
  return '其他';
}

export function saveWishlist(items) {
  saveJson(KEYS.wishlist, items);
}

export function loadItinerary() {
  return migrateTripItinerary(loadJson(KEYS.itinerary, itineraryDays));
}

export function saveItinerary(days) {
  saveJson(KEYS.itinerary, toPersistedItinerary(days));
}

export function loadSyncCode() {
  return localStorage.getItem(KEYS.syncCode) || '';
}

export function saveSyncCode(code) {
  localStorage.setItem(KEYS.syncCode, code);
}

export function clearSyncCode() {
  localStorage.removeItem(KEYS.syncCode);
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function cleanupObsoleteCaches() {
  try {
    const activeKeys = new Set([
      'seoul-trip-2026:google-places-cache-v7',
      'seoul-trip-2026:google-map-locations-v1'
    ]);
    const obsoleteKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (
        key?.startsWith('seoul-trip-2026:google-places-cache-')
        && !activeKeys.has(key)
      ) {
        obsoleteKeys.push(key);
      }
    }
    obsoleteKeys.forEach((key) => localStorage.removeItem(key));
    if (!loadJson(KEYS.imports, []).length) localStorage.removeItem(KEYS.imports);
  } catch {
    // Cache cleanup must never prevent the itinerary from loading.
  }
}
