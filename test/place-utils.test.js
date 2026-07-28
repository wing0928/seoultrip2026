import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBulkPlaces } from '../src/utils/bulkPlaceParser.js';
import { googleMapEmbedUrl, googleMapUrl } from '../src/utils/maps.js';
import { parseScreenshotPlaces, parseScreenshotText, screenshotPlacesToBulkText } from '../src/utils/screenshotPlaces.js';
import { migrateWishlist, migrateWishlistAreas } from '../src/utils/storage.js';

test('Google Maps search uses only the resolved place name', () => {
  const url = new URL(googleMapUrl({
    nameZh: '夢炭',
    nameKo: '몽탄',
    area: '明洞'
  }));
  assert.equal(url.searchParams.get('query'), '몽탄');
  assert.equal(url.searchParams.get('query_place_id'), null);
});

test('Google Maps link uses the saved Place ID without the district', () => {
  const url = new URL(googleMapUrl({
    nameZh: '夢炭',
    nameKo: '몽탄',
    area: '明洞',
    googlePlaceId: 'ChIJ-example'
  }));
  assert.equal(url.searchParams.get('query'), '몽탄');
  assert.equal(url.searchParams.get('query_place_id'), 'ChIJ-example');
});

test('Google Maps embed uses Place ID and never appends the district', () => {
  const officialUrl = new URL(googleMapEmbedUrl({
    nameZh: '夢炭',
    nameKo: '몽탄',
    area: '東大門',
    googlePlaceId: 'ChIJ-example'
  }, 'browser-key'));
  assert.equal(officialUrl.searchParams.get('q'), 'place_id:ChIJ-example');
  assert.equal(officialUrl.searchParams.get('region'), 'KR');

  const fallbackUrl = new URL(googleMapEmbedUrl({
    nameZh: '夢炭',
    nameKo: '몽탄',
    area: '東大門'
  }));
  assert.equal(fallbackUrl.searchParams.get('q'), '몽탄');
  assert.doesNotMatch(fallbackUrl.searchParams.get('q'), /東大門/);
});

test('bulk parser separates Korean and Chinese names', () => {
  const [place] = parseBulkPlaces({
    text: '1. 강남 곱 江南烤腸\n女裝附近的晚餐備註',
    recommendationSource: '收藏清單'
  });
  assert.equal(place.nameKo, '강남 곱');
  assert.equal(place.nameZh, '江南烤腸');
});

test('bulk parser recognizes keycap emoji numbered bullets', () => {
  const places = parseBulkPlaces({
    text: '1️⃣ 第一間店\n第一筆備註\n\n2️⃣ 第二間店\n第二筆備註'
  });
  assert.equal(places.length, 2);
  assert.equal(places[0].nameZh, '第一間店');
  assert.equal(places[1].nameZh, '第二間店');
});

test('bulk parser applies a selected district to every place', () => {
  const places = parseBulkPlaces({
    text: '1. 첫 번째 가게\n明洞附近\n\n\n2. 두 번째 가게\n聖水洞附近',
    area: '弘大商圈'
  });

  assert.equal(places.length, 2);
  assert.deepEqual(places.map((place) => place.area), ['弘大商圈', '弘大商圈']);
});

test('bulk parser recognizes select shops before general clothing categories', () => {
  const [place] = parseBulkPlaces({
    text: '1. Getcseoul\n選品店，男女裝都很好逛'
  });

  assert.equal(place.type, '選物店');
});

test('bulk parser recognizes Dongdaemun aliases', () => {
  const [place] = parseBulkPlaces({
    text: '1. 동대문 의류 상가\nDDP 附近'
  });
  assert.equal(place.area, '東大門');
});

test('wishlist migration moves existing Dongdaemun places out of Other', () => {
  const [place] = migrateWishlistAreas([{
    id: 'dongdaemun-market',
    nameZh: '東大門綜合市場',
    nameKo: '동대문종합시장',
    area: '其他',
    type: '餐廳'
  }]);
  assert.equal(place.area, '東大門');
  assert.equal(place.type, '景點');

  const [locallyLoadedPlace] = migrateWishlist([{ ...place, bulkImported: true, note: '市場小吃' }]);
  assert.equal(locallyLoadedPlace.type, '景點');
});

test('screenshot parser prefers a labelled store name and keeps a short description', () => {
  const place = parseScreenshotText(`
    10:42
    店名：漢南選物店
    首爾必逛的女裝店，剪裁很好看
    地址在漢南洞主街附近
    讚
  `, 'post.png');
  assert.equal(place.name, '漢南選物店');
  assert.match(place.description, /女裝店/);
  assert.match(screenshotPlacesToBulkText([place]), /^1\. 漢南選物店/);
});

test('screenshot parser splits OCR-damaged emoji bullets by following addresses', () => {
  const places = parseScreenshotPlaces(`
    [安國一日路線]
    [매 *리와인드서울 (Rwnd Seoul)
    후 서울 종로구 율곡로 33
    : 33, Yulgok-ro, Jongno-gu
    @ *무구옥 (Muguok)
    후 서울 종로구 율곡로1길 7
    : 7, Yulgok-ro 1-gil, Jongno-gu
    ® *국립현대미술관 (MMCA)
    후 서울 종로구 삼청로 30
    : 30, Samcheong-ro, Jongno-gu
    fi 02-3701-9500
    빼 *오이뮤 (104)
    투 서울 종로구 윤보선길 65
    : 65 Yunboseon-gil, Jongno-gu
    fll 02-743-2245
    B® #2 (Bourbon)
    후 서울 종로구 창덕궁1길 33
    : 33, Changdeokgung 1-gil, Jongno-gu
    fii 02-745-1933
  `, '安國路線.jpg');

  assert.equal(places.length, 5);
  assert.equal(places[0].name, '리와인드서울 (Rwnd Seoul)');
  assert.equal(places[1].name, '무구옥 (Muguok)');
  assert.equal(places[2].name, '국립현대미술관 (MMCA)');
  assert.equal(places[3].name, '오이뮤');
  assert.equal(places[4].name, 'Bourbon');
  const bulkPlaces = parseBulkPlaces({ text: screenshotPlacesToBulkText(places) });
  assert.ok(bulkPlaces.every((place) => place.area === '北村韓屋與景福宮'));
});

test('screenshot parser creates one store per Instagram tag and repairs OCR at-signs', () => {
  const places = parseScreenshotPlaces(`
    從1號出口出來後
    先去漂亮咖啡廳 @folki_official
    很喜歡韓國都可以喝到無咖啡因的咖啡
    再來是選品店 Getcseoul 男女裝都很好逛
    肚子餓吃釜飯 @solsot_official
    手工針織店 @grandmaroom.seochon
    美術館 @groundseesaw
    @daelimmuseum 第二家大林美術館
    再來搜尋 @monoha_official
    這個品牌版型、材質都很實在
    這間店在的路上超多好逛的店家
    @homeofhai.seoul.store @baserange.store.seoul
    @colocynth.official 是我喜歡的品牌
    轉到小巷子有 @ofrseoul @arkisto.kr
    跟非常有質感的 @shop_amomento
    最後是文具店 @papierprost
  `, 'instagram-list.jpg');

  assert.deepEqual(places.map((place) => place.name), [
    'folki',
    'etcseoul',
    'solsot',
    'grandmaroom seochon',
    'groundseesaw',
    'daelimmuseum',
    'monoha',
    'homeofhai',
    'baserange',
    'colocynth',
    'ofrseoul',
    'arkisto',
    'amomento',
    'papierprost'
  ]);
  assert.match(places[0].description, /Instagram：@folki_official/);
});
