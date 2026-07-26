import OpenCC from 'npm:opencc-js@1.4.1';

const GOOGLE_PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_PLACES_DETAIL_URL = 'https://places.googleapis.com/v1/places';
const SEOUL_CENTER = { latitude: 37.5665, longitude: 126.978 };
const AREA_CENTERS = [
  { pattern: /弘大|延南|hongdae|yeonnam/i, center: { latitude: 37.5563, longitude: 126.922 } },
  { pattern: /北村|景福宮|三清洞|安國|bukchon|gyeongbokgung|samcheong|anguk/i, center: { latitude: 37.5796, longitude: 126.977 } },
  { pattern: /明洞|myeongdong/i, center: { latitude: 37.5636, longitude: 126.9869 } },
  { pattern: /東大門|동대문|dongdaemun|DDP/i, center: { latitude: 37.567, longitude: 127.0095 } },
  { pattern: /聖水|首爾林|seongsu|seoul forest/i, center: { latitude: 37.5445, longitude: 127.056 } }
];
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

const MAP_LOCATION_FIELDS = [
  'id',
  'displayName',
  'location',
  'googleMapsUri'
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
    if (action === 'locations') return mapLocations(body, apiKey, cors);
    if (action !== 'details') return json({ code: 'invalid_action', error: '不支援的查詢操作' }, 400, cors);

    const placeId = cleanPlaceId(body?.placeId);
    const query = cleanQuery(body?.query);
    if (!placeId && !query) return json({ error: '缺少店家名稱' }, 400, cors);

    let place: GooglePlace | null = null;
    if (placeId) {
      place = await fetchPlaceDetails(placeId, 'zh-TW', apiKey);
    } else {
      const places = await searchPlaces(query, 'zh-TW', apiKey, 1, body?.area);
      place = places[0] || null;
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

async function mapLocations(
  body: Record<string, unknown>,
  apiKey: string,
  cors: Record<string, string>
) {
  const rawItems = Array.isArray(body?.items) ? body.items.slice(0, 50) : [];
  const items = rawItems.map((item: Record<string, unknown>) => ({
    id: cleanQuery(item?.id),
    placeId: cleanPlaceId(item?.placeId),
    query: cleanQuery(item?.query),
    area: cleanQuery(item?.area)
  })).filter((item) => item.id && (item.placeId || item.query));

  if (!items.length) {
    return json({ code: 'invalid_items', error: '缺少可查詢的地點' }, 400, cors);
  }

  const locations: Record<string, unknown>[] = [];
  const errors: Record<string, string>[] = [];
  for (let offset = 0; offset < items.length; offset += 5) {
    const batch = items.slice(offset, offset + 5);
    const results = await Promise.all(batch.map(async (item) => {
      try {
        let place: GooglePlace | null = null;
        if (item.placeId) {
          try {
            place = await fetchPlaceMapLocation(item.placeId, 'zh-TW', apiKey);
          } catch (error) {
            if (!(error instanceof GoogleApiError) || error.code !== 'not_found') throw error;
          }
        }
        if (!place && item.query) {
          place = (await searchPlaces(item.query, 'zh-TW', apiKey, 1, item.area))[0] || null;
        }

        const latitude = Number(place?.location?.latitude);
        const longitude = Number(place?.location?.longitude);
        if (!place || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return { error: { id: item.id, code: 'not_found' } };
        }
        return {
          location: {
            id: item.id,
            placeId: place.id || item.placeId,
            displayName: place.displayName?.text || item.query,
            latitude,
            longitude,
            googleMapsUri: place.googleMapsUri || ''
          }
        };
      } catch (error) {
        return {
          error: {
            id: item.id,
            code: error instanceof GoogleApiError ? error.code : 'request_failed'
          }
        };
      }
    }));

    results.forEach((result) => {
      if (result.location) locations.push(result.location);
      if (result.error) errors.push(result.error);
    });
  }

  return json({ locations, errors }, 200, cors);
}

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

  const simplifiedName = nameZh ? safeSimplified(nameZh) : '';
  let koreanSearchName = providedNameKo;
  if (nameZh) {
    const traditionalCandidates = await searchPlaces(nameZh, 'zh-TW', apiKey, 1, body?.area);
    if (!koreanSearchName && traditionalCandidates[0]) {
      const koreanDetails = await fetchPlaceDetails(traditionalCandidates[0].id, 'ko', apiKey);
      koreanSearchName = cleanKoreanDisplayName(koreanDetails?.displayName?.text, '');
    }
  }

  if (koreanSearchName) {
    const koreanCandidates = await searchPlaces(koreanSearchName, 'ko', apiKey, 1, body?.area);
    const koreanCandidate = koreanCandidates[0] || null;
    if (koreanCandidate) {
      const koreanDetails = await fetchPlaceDetails(koreanCandidate.id, 'ko', apiKey);
      const displayDetails = await fetchPlaceDetails(koreanCandidate.id, 'zh-TW', apiKey);
      const place = displayDetails || koreanDetails || koreanCandidate;
      const nameKo = cleanKoreanDisplayName(koreanDetails?.displayName?.text, koreanSearchName);
      return json({
        resolution: {
          status: 'korean_match',
          message: '已依繁體中文與韓文名稱順序取得 Google 商家資料',
          inputName: originalName,
          searchName: nameKo || koreanSearchName,
          nameKo,
          nameZhSimplified: simplifiedName,
          googlePlaceId: place.id,
          googleMapsUri: place.googleMapsUri || '',
          type: inferBusinessType(place, body?.type, body?.note),
          reviewEligible: isReviewEligible(place),
          place: presentPlace(place, request)
        }
      }, 200, cors);
    }
  }

  if (simplifiedName) {
    const simplifiedCandidates = await searchPlaces(simplifiedName, 'zh-CN', apiKey, 1, body?.area);
    const simplifiedCandidate = simplifiedCandidates[0] || null;
    if (simplifiedCandidate) {
      const koreanDetails = await fetchPlaceDetails(simplifiedCandidate.id, 'ko', apiKey);
      const displayDetails = await fetchPlaceDetails(simplifiedCandidate.id, 'zh-CN', apiKey);
      const place = displayDetails || koreanDetails || simplifiedCandidate;
      const nameKo = cleanKoreanDisplayName(koreanDetails?.displayName?.text, koreanSearchName);
      return json({
        resolution: {
          status: 'simplified_fallback',
          message: '繁體中文與韓文沒有結果，已改用簡體中文名稱取得 Google 商家資料',
          inputName: originalName,
          searchName: nameKo || simplifiedName,
          nameKo,
          nameZhSimplified: simplifiedName,
          googlePlaceId: place.id,
          googleMapsUri: place.googleMapsUri || '',
          type: inferBusinessType(place, body?.type, body?.note),
          reviewEligible: isReviewEligible(place),
          place: presentPlace(place, request)
        }
      }, 200, cors);
    }
  }

  return json({
    resolution: {
      status: 'not_found',
      message: '繁體中文、韓文與簡體中文名稱都找不到 Google 商家',
      inputName: originalName,
      searchName: simplifiedName || koreanSearchName || originalName,
      nameKo: koreanSearchName,
      nameZhSimplified: simplifiedName,
      googlePlaceId: '',
      googleMapsUri: '',
      type: inferBusinessType(null, body?.type, body?.note),
      reviewEligible: false,
      place: null
    }
  }, 200, cors);
}

async function searchPlaces(
  query: string,
  languageCode: string,
  apiKey: string,
  pageSize: number,
  area: unknown = ''
) {
  const center = areaCenter(area);
  const radius = center === SEOUL_CENTER ? 50000 : 9000;
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
          center,
          radius
        }
      }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw googleError(payload, response.status);
  return Array.isArray(payload?.places) ? payload.places : [];
}

function areaCenter(area: unknown) {
  const text = String(area || '');
  return AREA_CENTERS.find((item) => item.pattern.test(text))?.center || SEOUL_CENTER;
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

async function fetchPlaceMapLocation(placeId: string, languageCode: string, apiKey: string) {
  const url = new URL(`${GOOGLE_PLACES_DETAIL_URL}/${encodeURIComponent(placeId)}`);
  url.searchParams.set('languageCode', languageCode);
  url.searchParams.set('regionCode', 'KR');
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': MAP_LOCATION_FIELDS
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

function cleanKoreanDisplayName(value: unknown, fallback: string) {
  const leadingName = String(value || '').split(/[|ㅣ]/, 1)[0].trim();
  return hasHangul(leadingName) ? leadingName : fallback;
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
