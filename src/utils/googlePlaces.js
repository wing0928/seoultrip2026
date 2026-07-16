import { placeSearchQuery } from './maps.js';

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const FUNCTION_URL = String(
  import.meta.env.VITE_GOOGLE_PLACES_FUNCTION_URL ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/google-place-details` : '')
).trim();
const CACHE_KEY = 'seoul-trip-2026:google-places-cache';
const CACHE_TTL = 24 * 60 * 60 * 1000;

export const googlePlacesConfigured = Boolean(FUNCTION_URL);

export function supportsGoogleDetails(place) {
  return ['餐廳', '美食', '小吃', '咖啡廳', '商店', '購物中心', '逛街'].includes(place?.type);
}

export async function getGooglePlaceDetails(place, { refresh = false } = {}) {
  if (!googlePlacesConfigured) {
    throw new GooglePlacesError('not_configured', 'Google Places 尚未連線');
  }

  const query = `${placeSearchQuery(place)} 대한민국`.trim();
  const cached = readCache()[query];
  if (!refresh && cached && Date.now() - cached.savedAt < CACHE_TTL && hasCurrentPhotoUrls(cached.data)) {
    return cached.data;
  }

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new GooglePlacesError(payload.code || 'request_failed', payload.error || '無法取得 Google 評價');
  }
  if (!payload.place) throw new GooglePlacesError('not_found', 'Google 找不到相符店家');

  writeCache(query, payload.place);
  return payload.place;
}

export class GooglePlacesError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GooglePlacesError';
    this.code = code;
  }
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

function hasCurrentPhotoUrls(data) {
  return !(data?.photos || []).some((photo) => {
    const url = String(photo?.url || '');
    return url && !url.includes('/functions/v1/google-place-details?photo=');
  });
}
