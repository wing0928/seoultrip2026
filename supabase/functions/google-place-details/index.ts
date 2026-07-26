import OpenCC from 'npm:opencc-js@1.4.1';

const GOOGLE_PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_PLACES_DETAIL_URL = 'https://places.googleapis.com/v1/places';
const SEOUL_CENTER = { latitude: 37.5665, longitude: 126.978 };
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

const SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.primaryType',
  'places.types',
  'places.googleMapsUri'
].join(',');

const DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'addressComponents',
  'location',
  'primaryType',
  'types',
  'rating',
  'userRatingCount',
  'photos',
  'googleMapsUri',
  'generativeSummary',
  'reviewSummary'
].join(',');

type GooglePlace = Record<string, any>;

function corsHeaders(request: Request) {
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGIN') || '*').split(',').map((value) => value.trim());
  const requestOrigin = request.headers.get('origin') || '';
  const origin = configuredOrigins.includes('*') || configuredOrigins.includes(requestOrigin)
    ? (requestOrigin || '*')
    : configuredOrigins[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin'
  };
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) return json({ code: 'not_configured', error: 'Google Places API Key 尚未設定' }, 503, cors);

  try {
    const requestUrl = new URL(request.url);
    const photoName = requestUrl.searchParams.get('photo');
    if (request.method === 'GET' && photoName) return proxyPhoto(photoName, apiKey, cors);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

    const body = await request.json();
    const action = String(body?.action || 'details');
    if (action === 'resolve') return resolveIdentity(body, apiKey, request, cors);
    if (action !== 'details') return json({ code: 'invalid_action', error: '不支援的查詢操作' }, 400, cors);

    const placeId = cleanPlaceId(body?.placeId);
    const query = cleanQuery(body?.query);
    if (!placeId && !query) return json({ error: '缺少店家名稱' }, 400, cors);

    let place: GooglePlace | null = null;
    if (placeId) {
      place = await fetchPlaceDetails(placeId, 'zh-TW', apiKey);
    } else {
      const places = await searchPlaces(query, 'zh-TW', apiKey, 5);
      place = places.find((candidate) => (
        isKoreanPlace(candidate) &&
        namesMatch(query, candidate.displayName?.text) &&
        isCandidateTypeCompatible(candidate, body?.type)
      )) || null;
    }
    if (!place) return json({ code: 'not_found', error: 'Google 找不到相符店家' }, 404, cors);

    return json({ place: presentPlace(place, request) }, 200, cors);
  } catch (error) {
    if (error instanceof GoogleApiError) {
      return json({ code: error.code, error: error.message }, error.status, cors);
    }
    return json({
      code: 'server_error',
      error: error instanceof Error ? error.message : '伺服器錯誤'
    }, 500, cors);
  }
});

async function resolveIdentity(
  body: Record<string, unknown>,
  apiKey: string,
  request: Request,
  cors: Record<string, string>
) {
  const nameZh = cleanQuery(body?.nameZh);
  const providedNameKo = cleanQuery(body?.nameKo);
  const originalName = nameZh || providedNameKo;
  if (!originalName) return json({ code: 'invalid_name', error: '缺少可查詢的店名' }, 400, cors);

  const traditionalCandidates = await searchPlaces(originalName, 'zh-TW', apiKey, 5);
  const verifiedCandidate = traditionalCandidates.find((candidate) => (
    isKoreanPlace(candidate) &&
    namesMatch(originalName, candidate.displayName?.text) &&
    isCandidateTypeCompatible(candidate, body?.type)
  ));
  const simplifiedName = safeSimplified(originalName);

  if (verifiedCandidate) {
    const koreanDetails = await fetchPlaceDetails(verifiedCandidate.id, 'ko', apiKey);
    const displayDetails = await fetchPlaceDetails(verifiedCandidate.id, 'zh-TW', apiKey);
    const place = displayDetails || verifiedCandidate;
    const nameKo = hasHangul(koreanDetails?.displayName?.text)
      ? String(koreanDetails.displayName.text).trim()
      : providedNameKo;
    const inferredType = inferBusinessType(place, body?.type, body?.note);
    return json({
      resolution: {
        status: 'verified',
        verified: true,
        message: '已用同一個 Google Place ID 驗證繁體中文與韓文店名',
        inputName: originalName,
        searchName: nameKo || originalName,
        nameKo,
        nameZhSimplified: simplifiedName,
        googlePlaceId: place.id,
        googleMapsUri: place.googleMapsUri || '',
        type: inferredType,
        reviewEligible: isReviewEligible(place),
        place: presentPlace(place, request)
      }
    }, 200, cors);
  }

  const fallbackCandidates = simplifiedName
    ? await searchPlaces(simplifiedName, 'zh-CN', apiKey, 5)
    : [];
  const fallbackPlace = fallbackCandidates.find((candidate) => (
    isKoreanPlace(candidate) &&
    namesMatch(simplifiedName, candidate.displayName?.text) &&
    isCandidateTypeCompatible(candidate, body?.type)
  )) || null;
  const fallbackDetails = fallbackPlace
    ? await fetchPlaceDetails(fallbackPlace.id, 'zh-CN', apiKey)
    : null;
  const place = fallbackDetails || fallbackPlace;

  return json({
    resolution: {
      status: place ? 'simplified_verified' : 'not_found',
      verified: false,
      message: place
        ? '繁體中文結果未通過驗證，簡體中文已通過同店名稱與類型驗證'
        : '繁體與簡體中文結果都未通過同店名稱與類型驗證，未綁定 Google Place ID',
      inputName: originalName,
      searchName: simplifiedName || originalName,
      nameKo: '',
      nameZhSimplified: simplifiedName,
      googlePlaceId: place?.id || '',
      googleMapsUri: place?.googleMapsUri || '',
      type: inferBusinessType(place, body?.type, body?.note),
      reviewEligible: isReviewEligible(place),
      place: place ? presentPlace(place, request) : null
    }
  }, 200, cors);
}

async function searchPlaces(query: string, languageCode: string, apiKey: string, pageSize: number) {
  const response = await fetch(GOOGLE_PLACES_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': SEARCH_FIELDS
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode,
      regionCode: 'KR',
      pageSize,
      locationBias: {
        circle: {
          center: SEOUL_CENTER,
          radius: 50000
        }
      }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw googleError(payload, response.status);
  return Array.isArray(payload?.places) ? payload.places : [];
}

async function fetchPlaceDetails(placeId: string, languageCode: string, apiKey: string) {
  const url = new URL(`${GOOGLE_PLACES_DETAIL_URL}/${encodeURIComponent(placeId)}`);
  url.searchParams.set('languageCode', languageCode);
  url.searchParams.set('regionCode', 'KR');
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': DETAIL_FIELDS
    }
  });
  const payload = await response.json();
  if (!response.ok) throw googleError(payload, response.status);
  return payload || null;
}

function presentPlace(place: GooglePlace, request: Request) {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const endpoint = supabaseUrl
    ? new URL(`${supabaseUrl}/functions/v1/google-place-details`)
    : new URL(request.url);
  endpoint.search = '';
  const photos = (place.photos || []).slice(0, 2).map((photo: Record<string, unknown>) => {
    const photoUrl = new URL(endpoint);
    photoUrl.searchParams.set('photo', String(photo.name || ''));
    return {
      url: photoUrl.toString(),
      width: photo.widthPx,
      height: photo.heightPx,
      authors: Array.isArray(photo.authorAttributions)
        ? photo.authorAttributions.map((author: Record<string, unknown>) => ({
            name: author.displayName,
            uri: author.uri,
            photoUri: author.photoUri
          }))
        : []
    };
  });
  const summary = place.reviewSummary || place.generativeSummary;
  const summaryKind = place.reviewSummary ? 'review' : (place.generativeSummary ? 'place' : '');

  return {
    id: place.id,
    displayName: place.displayName?.text || '',
    address: place.formattedAddress || '',
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    googleMapsUri: place.googleMapsUri || '',
    primaryType: place.primaryType || '',
    types: place.types || [],
    photos,
    aiSummary: summaryKind === 'review' ? summary?.text?.text : summary?.overview?.text,
    aiSummaryKind: summaryKind,
    aiDisclosure: summary?.disclosureText?.text || summary?.disclaimerText?.text || '',
    aiReviewsUri: summary?.reviewsUri || '',
    aiFlagUri: summary?.flagContentUri || summary?.overviewFlagContentUri || ''
  };
}

function namesMatch(input: unknown, candidate: unknown) {
  const left = normalizeName(input);
  const right = normalizeName(candidate);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  return shorter.length >= 3 && longer.includes(shorter) && (shorter.length / longer.length) >= 0.58;
}

function normalizeName(value: unknown) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\b(?:seoul|korea)\b/gi, '')
    .replace(/(?:首爾|서울|韓國|韩国|대한민국|南韓|南韩)/g, '')
    .replace(/[\s'"`~!@#$%^&*()_+\-=[\]{};:,.<>/?\\|，。；：！？、（）【】《》「」『』·]/g, '');
}

function isKoreanPlace(place: GooglePlace) {
  const country = (place?.addressComponents || []).find((component: GooglePlace) => (
    Array.isArray(component.types) && component.types.includes('country')
  ));
  const countryText = `${country?.shortText || ''} ${country?.longText || ''} ${place?.formattedAddress || ''}`;
  return /\bKR\b|대한민국|한국|South Korea|Republic of Korea|韓國|韩国|南韓|南韩/i.test(countryText);
}

function inferBusinessType(place: GooglePlace | null, currentType: unknown, note: unknown) {
  const types = new Set([place?.primaryType, ...(place?.types || [])].filter(Boolean));
  const text = `${String(note || '')} ${String(currentType || '')}`;
  if (types.has('mens_clothing_store') || /男裝|男士|男生|mens?\b|남성|남자/i.test(text)) return '男裝';
  if (types.has('womens_clothing_store') || /女裝|女士|女生|womens?\b|여성|여자/i.test(text)) return '女裝';
  if (types.has('shopping_mall') || types.has('department_store')) return '購物中心';
  if (currentType === '商店' || types.has('clothing_store')) return '其他';
  return String(currentType || '其他');
}

function isCandidateTypeCompatible(place: GooglePlace | null, requestedType: unknown) {
  if (!place) return false;
  const type = String(requestedType || '');
  const types = new Set([place.primaryType, ...(place.types || [])].filter(Boolean));
  const hasAny = (values: string[]) => values.some((value) => types.has(value));
  const foodTypes = [
    'restaurant',
    'cafe',
    'bakery',
    'bar',
    'food',
    'meal_delivery',
    'meal_takeaway'
  ];
  const shopTypes = [
    'store',
    'clothing_store',
    'mens_clothing_store',
    'womens_clothing_store',
    'shopping_mall',
    'department_store'
  ];

  if (['餐廳', '美食', '小吃'].includes(type)) return hasAny(foodTypes);
  if (type === '咖啡廳') return hasAny(['cafe', 'bakery', 'food']);
  if (['男裝', '女裝', '商店', '購物中心', '逛街'].includes(type)) return hasAny(shopTypes);
  if (type === '景點') return !hasAny(foodTypes) && !hasAny(shopTypes);
  if (!type || type === '其他') return isReviewEligible(place);
  return true;
}

function isReviewEligible(place: GooglePlace | null) {
  if (!place) return false;
  const types = new Set([place.primaryType, ...(place.types || [])].filter(Boolean));
  const excluded = ['airport', 'lodging', 'hotel', 'tourist_attraction', 'historical_landmark', 'museum'];
  if (excluded.some((type) => types.has(type))) return false;
  const included = [
    'restaurant',
    'cafe',
    'bakery',
    'bar',
    'food',
    'store',
    'clothing_store',
    'mens_clothing_store',
    'womens_clothing_store',
    'shopping_mall',
    'department_store'
  ];
  return included.some((type) => types.has(type));
}

function hasHangul(value: unknown) {
  return /[가-힣]/.test(String(value || ''));
}

function safeSimplified(value: string) {
  try {
    return String(toSimplified(value) || value).trim();
  } catch {
    return value;
  }
}

function cleanQuery(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 240);
}

function cleanPlaceId(value: unknown) {
  const placeId = String(value || '').trim();
  return /^[A-Za-z0-9_-]{5,400}$/.test(placeId) ? placeId : '';
}

class GoogleApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'GoogleApiError';
    this.code = code;
    this.status = status;
  }
}

function googleError(payload: GooglePlace, status: number) {
  const message = payload?.error?.message || 'Google Places 請求失敗';
  const apiStatus = String(payload?.error?.status || '');
  const code = status === 404 || apiStatus === 'NOT_FOUND' ? 'not_found' : 'google_error';
  return new GoogleApiError(code, message, status);
}

async function proxyPhoto(photoName: string, apiKey: string, cors: Record<string, string>) {
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(photoName)) return json({ error: '無效的照片代碼' }, 400, cors);
  const photoUrl = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
  photoUrl.searchParams.set('maxWidthPx', '1200');
  photoUrl.searchParams.set('maxHeightPx', '900');
  photoUrl.searchParams.set('key', apiKey);

  const response = await fetch(photoUrl, { redirect: 'follow' });
  if (!response.ok) return json({ error: '照片讀取失敗' }, response.status, cors);
  return new Response(response.body, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': response.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
