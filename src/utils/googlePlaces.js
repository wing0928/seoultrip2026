import { placeNameQuery, searchMapUrl } from './maps.js';

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const FUNCTION_URL = String(
  import.meta.env.VITE_GOOGLE_PLACES_FUNCTION_URL ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/google-place-details` : '')
).trim();
const CACHE_KEY = 'seoul-trip-2026:google-places-cache-v7';
const MAP_CACHE_KEY = 'seoul-trip-2026:google-map-locations-v1';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAP_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export const googlePlacesConfigured = Boolean(FUNCTION_URL);
export const BUSINESS_LOOKUP_VERSION = 7;

export function supportsGoogleDetails(place) {
  return place?.googleDetailsEligible === true ||
    ['餐廳', '美食', '小吃', '咖啡廳', '男裝', '女裝', '選物店', '商店', '購物中心', '逛街'].includes(place?.type);
}

export async function getGooglePlaceDetails(place, { refresh = false } = {}) {
  if (!googlePlacesConfigured) {
    throw new GooglePlacesError('not_configured', 'Google Places 尚未連線');
  }

  const query = placeNameQuery(place);
  const cacheId = place.googlePlaceId || query;
  const cached = readCache()[cacheId];
  if (!refresh && cached && Date.now() - cached.savedAt < CACHE_TTL && hasCurrentGooglePhotoUrls(cached.data)) {
    return cached.data;
  }

  const data = place.googlePlaceId
    ? (await callGooglePlaces({
        action: 'details',
        query,
        placeId: place.googlePlaceId,
        type: place.type || '',
        note: place.note || '',
        area: place.area || ''
      })).place
    : (await resolvePlaceIdentity(place)).place;
  if (!data) throw new GooglePlacesError('not_found', 'Google 找不到相符店家');

  writeCache(cacheId, data);
  return data;
}

export async function getGoogleMapLocations(places, { refresh = false } = {}) {
  if (!googlePlacesConfigured) {
    throw new GooglePlacesError('not_configured', 'Google Places 尚未連線');
  }

  const cache = readStorageCache(MAP_CACHE_KEY);
  const locations = [];
  const missing = [];
  (places || []).forEach((place) => {
    const cacheId = mapLocationCacheId(place);
    const cached = cache[cacheId];
    if (!refresh && cached && Date.now() - cached.savedAt < MAP_CACHE_TTL) {
      locations.push({ ...cached.data, id: place.id });
    } else {
      missing.push({
        id: place.id,
        placeId: place.googlePlaceId || '',
        query: placeNameQuery(place),
        area: place.area || '',
        cacheId
      });
    }
  });

  for (let offset = 0; offset < missing.length; offset += 40) {
    const batch = missing.slice(offset, offset + 40);
    const payload = await callGooglePlaces({
      action: 'locations',
      items: batch.map(({ id, placeId, query, area }) => ({ id, placeId, query, area }))
    });
    const byId = new Map(batch.map((item) => [item.id, item]));
    (payload.locations || []).forEach((location) => {
      const request = byId.get(location.id);
      if (!request) return;
      const data = {
        placeId: location.placeId || request.placeId,
        displayName: location.displayName || request.query,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        googleMapsUri: location.googleMapsUri || ''
      };
      if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) return;
      cache[request.cacheId] = { savedAt: Date.now(), data };
      locations.push({ ...data, id: request.id });
    });
  }

  writeStorageCache(MAP_CACHE_KEY, cache);
  const order = new Map((places || []).map((place, index) => [place.id, index]));
  return locations.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

export async function resolvePlaceIdentity(place) {
  if (!googlePlacesConfigured) {
    throw new GooglePlacesError('not_configured', 'Google Places 尚未連線');
  }

  const nameZh = String(place?.nameZh || place?.chineseName || place?.name || '').trim();
  const nameKo = String(place?.nameKo || place?.koreanName || '').trim();
  if (!nameZh && !nameKo) throw new GooglePlacesError('invalid_name', '缺少可查詢的店名');

  const payload = await callGooglePlaces({
    action: 'resolve',
    nameZh: nameZh || nameKo,
    nameKo,
    type: place?.type || '',
    note: place?.note || '',
    area: place?.area || ''
  });
  if (!payload.resolution) throw new GooglePlacesError('not_found', 'Google 找不到相符店家');
  return payload.resolution;
}

export async function enrichPlaceIdentity(place) {
  const resolution = await resolvePlaceIdentity(place);
  const lookupName = resolution.nameKo || resolution.nameZhSimplified || place.nameZh || place.nameKo;
  const acceptedPlace = Boolean(resolution.googlePlaceId);
  return {
    ...place,
    nameKo: resolution.nameKo || place.nameKo || '',
    nameZhSimplified: resolution.nameZhSimplified || '',
    lookupName,
    googlePlaceId: acceptedPlace ? resolution.googlePlaceId : (place.googlePlaceId || ''),
    googleMapUrl: acceptedPlace ? (resolution.googleMapsUri || '') : (place.googleMapUrl || ''),
    naverMapUrl: preservedNaverUrl(place) || searchMapUrl(lookupName),
    type: resolution.type || normalizeLegacyShopType(place),
    googleDetailsEligible: acceptedPlace ? resolution.reviewEligible === true : place.googleDetailsEligible === true,
    businessLookupVersion: acceptedPlace ? BUSINESS_LOOKUP_VERSION : (place.businessLookupVersion || 0),
    needsBusinessLookup: !acceptedPlace,
    businessLookupStatus: resolution.status,
    businessLookupNote: resolution.message || '',
    businessLookupAt: new Date().toISOString()
  };
}

export function needsBusinessIdentityRefresh(place) {
  if (!place || !supportsGoogleDetails(place)) return false;
  if (place.needsBusinessLookup === true) return true;
  return Number(place.businessLookupVersion || 0) < BUSINESS_LOOKUP_VERSION;
}

export class GooglePlacesError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GooglePlacesError';
    this.code = code;
  }
}

async function callGooglePlaces(body) {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new GooglePlacesError(payload.code || 'request_failed', payload.error || '無法取得 Google 商家資料');
  }
  return payload;
}

function normalizeLegacyShopType(place) {
  const text = `${place?.nameZh || ''} ${place?.nameKo || ''} ${place?.note || ''}`;
  if (/選物店|選品店|選物|選品|select\s*shop|concept\s*store|편집샵|셀렉트샵/i.test(text)) return '選物店';
  if (/男裝|男士|男生|mens?\b|남성|남자/i.test(text)) return '男裝';
  if (/女裝|女士|女生|womens?\b|여성|여자/i.test(text)) return '女裝';
  return place?.type === '商店' ? '其他' : (place?.type || '其他');
}

function preservedNaverUrl(place) {
  const url = String(place?.naverMapUrl || '').trim();
  if (!url) return '';
  return /naver\.me/i.test(url) || !/\/p\/search\//i.test(url) ? url : '';
}

function readCache() {
  return readStorageCache(CACHE_KEY);
}

function readStorageCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function writeCache(query, data) {
  try {
    const cache = readCache();
    cache[query] = { savedAt: Date.now(), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // A failed cache write should not hide a valid Places response.
  }
}

function writeStorageCache(key, cache) {
  try {
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // Map data can always be requested again.
  }
}

function mapLocationCacheId(place) {
  return `${place?.googlePlaceId || placeNameQuery(place)}|${place?.area || ''}`;
}

export function hasCurrentGooglePhotoUrls(data) {
  return !(data?.photos || []).some((photo) => {
    const url = String(photo?.url || '');
    return url && !url.includes('/functions/v1/google-place-details?photo=');
  });
}
