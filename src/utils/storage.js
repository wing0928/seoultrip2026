import { itineraryDays } from '../data/itinerary.js';
import { inferPlaceType } from './bulkPlaceParser.js';

export const DEFAULT_TRIP = {
  tripName: 'Seoul Trip 2026',
  dates: '2026/8/17–8/22',
  nights: '6 天 5 夜',
  hotelName: '待補',
  hotelAddress: '待補',
  hotelMapUrl: '',
  outboundFlight: '待補',
  returnFlight: '待補',
  arrivalAirport: '待補',
  departureAirport: '待補'
};

const KEYS = {
  trip: 'seoul-trip-2026:settings',
  wishlist: 'seoul-trip-2026:wishlist',
  imports: 'seoul-trip-2026:imports',
  itinerary: 'seoul-trip-2026:itinerary',
  syncCode: 'seoul-trip-2026:sync-code'
};

export function loadTripSettings() {
  return { ...DEFAULT_TRIP, ...loadJson(KEYS.trip, {}) };
}

export function saveTripSettings(settings) {
  saveJson(KEYS.trip, { ...DEFAULT_TRIP, ...settings });
}

export function loadWishlist() {
  const wishlist = loadJson(KEYS.wishlist, []);
  const imports = loadJson(KEYS.imports, []);
  if (!imports.length) return reclassifyBulkPlaces(wishlist);

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
  return reclassifyBulkPlaces([...migrated, ...wishlist]);
}

function reclassifyBulkPlaces(items) {
  return items.map((item) => {
    const isBulkPlace = item.bulkImported || (
      item.note &&
      item.recommendationSource &&
      item.sourceUrl &&
      (item.naverMapUrl || item.googleMapUrl)
    );
    if (!isBulkPlace) return item;

    return {
      ...item,
      type: inferPlaceType(item.note, item.nameZh || item.nameKo || item.name, item.recommendationSource)
    };
  });
}

export function saveWishlist(items) {
  saveJson(KEYS.wishlist, items);
}

export function loadImports() {
  return loadJson(KEYS.imports, []);
}

export function saveImports(items) {
  saveJson(KEYS.imports, items);
}

export function loadItinerary() {
  return loadJson(KEYS.itinerary, itineraryDays);
}

export function saveItinerary(days) {
  saveJson(KEYS.itinerary, days);
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
