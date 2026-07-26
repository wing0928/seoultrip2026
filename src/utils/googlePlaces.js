import { placeNameQuery, searchMapUrl } from './maps.js';

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const FUNCTION_URL = String(
  import.meta.env.VITE_GOOGLE_PLACES_FUNCTION_URL ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/google-place-details` : '')
).trim();
const CACHE_KEY = 'seoul-trip-2026:google-places-cache-v6';
const CACHE_TTL = 24 * 60 * 60 * 1000;

export const googlePlacesConfigured = Boolean(FUNCTION_URL);
export const BUSINESS_LOOKUP_VERSION = 6;

export function supportsGoogleDetails(place) {
  return place?.googleDetailsEligible === true ||
    ['餐廳', '美食', '小吃', '咖啡廳', '男裝', '女裝', '商店', '購物中心', '逛街'].includes(place?.type);
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

  const payload = await callGooglePlaces({
    action: 'details',
    query,
    placeId: place.googlePlaceId || '',
    type: place.type || '',
    note: place.note || '',
    area: place.area || ''
  });
  if (!payload.place) throw new GooglePlacesError('not_found', 'Google 找不到相符店家');

  writeCache(cacheId, payload.place);
  return payload.place;
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
    googlePlaceId: acceptedPlace ? resolution.googlePlaceId : '',
    googleMapUrl: acceptedPlace ? (resolution.googleMapsUri || '') : '',
    naverMapUrl: preservedNaverUrl(place) || searchMapUrl(lookupName),
    type: resolution.type || normalizeLegacyShopType(place),
    googleDetailsEligible: resolution.reviewEligible === true,
    businessLookupVersion: BUSINESS_LOOKUP_VERSION,
    needsBusinessLookup: false,
    businessLookupStatus: resolution.status,
    businessLookupNote: resolution.message || '',
    businessLookupAt: new Date().toISOString()
  };
}

export function needsBusinessIdentityRefresh(place) {
  if (!place || place.businessLookupVersion >= BUSINESS_LOOKUP_VERSION) return false;
  return [2, 3, 4, 5].includes(place.businessLookupVersion) || place.type === '商店' || place.needsBusinessLookup === true;
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
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
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

export function hasCurrentGooglePhotoUrls(data) {
  return !(data?.photos || []).some((photo) => {
    const url = String(photo?.url || '');
    return url && !url.includes('/functions/v1/google-place-details?photo=');
  });
}
