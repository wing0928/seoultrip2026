import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBulkPlaces } from '../src/utils/bulkPlaceParser.js';
import { googleMapUrl } from '../src/utils/maps.js';
import { parseScreenshotText, screenshotPlacesToBulkText } from '../src/utils/screenshotPlaces.js';

test('Google Maps search uses only the resolved place name', () => {
  const url = new URL(googleMapUrl({
    nameZh: '夢炭',
    nameKo: '몽탄',
    area: '明洞'
  }));
  assert.equal(url.searchParams.get('query'), '몽탄');
  assert.equal(url.searchParams.get('query_place_id'), null);
});

test('Google Maps link uses the verified Place ID without the district', () => {
  const url = new URL(googleMapUrl({
    nameZh: '夢炭',
    nameKo: '몽탄',
    area: '明洞',
    googlePlaceId: 'ChIJ-example'
  }));
  assert.equal(url.searchParams.get('query'), '몽탄');
  assert.equal(url.searchParams.get('query_place_id'), 'ChIJ-example');
});

test('bulk parser separates Korean and Chinese names', () => {
  const [place] = parseBulkPlaces({
    text: '1. 강남 곱 江南烤腸\n女裝附近的晚餐備註',
    recommendationSource: '收藏清單'
  });
  assert.equal(place.nameKo, '강남 곱');
  assert.equal(place.nameZh, '江南烤腸');
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
