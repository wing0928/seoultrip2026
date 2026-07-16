const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

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
    const query = String(body?.query || '').trim().slice(0, 240);
    if (!query) return json({ error: '缺少店家名稱' }, 400, cors);

    const googleResponse = await fetch(GOOGLE_PLACES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.rating',
          'places.userRatingCount',
          'places.photos',
          'places.googleMapsUri',
          'places.generativeSummary',
          'places.reviewSummary'
        ].join(',')
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'zh-TW', maxResultCount: 1 })
    });

    const googlePayload = await googleResponse.json();
    if (!googleResponse.ok) {
      const message = googlePayload?.error?.message || 'Google Places 請求失敗';
      return json({ code: 'google_error', error: message }, googleResponse.status, cors);
    }

    const place = googlePayload?.places?.[0];
    if (!place) return json({ code: 'not_found', error: 'Google 找不到相符店家' }, 404, cors);

    const endpoint = new URL(request.url);
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

    return json({
      place: {
        id: place.id,
        displayName: place.displayName?.text || query,
        address: place.formattedAddress || '',
        rating: place.rating ?? null,
        userRatingCount: place.userRatingCount ?? null,
        googleMapsUri: place.googleMapsUri || '',
        photos,
        aiSummary: summaryKind === 'review' ? summary?.text?.text : summary?.overview?.text,
        aiSummaryKind: summaryKind,
        aiDisclosure: summary?.disclosureText?.text || summary?.disclaimerText?.text || '',
        aiReviewsUri: summary?.reviewsUri || '',
        aiFlagUri: summary?.flagContentUri || summary?.overviewFlagContentUri || ''
      }
    }, 200, cors);
  } catch (error) {
    return json({ code: 'server_error', error: error instanceof Error ? error.message : '伺服器錯誤' }, 500, cors);
  }
});

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
