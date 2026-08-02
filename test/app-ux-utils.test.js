import assert from 'node:assert/strict';
import test from 'node:test';
import { itineraryDays, toPersistedItinerary } from '../src/data/itinerary.js';
import { backupSummary, parseBackup, serializeBackup } from '../src/utils/backup.js';
import { naverMapRouteAppUrl, naverMapRouteUrl, routeMapUrl } from '../src/utils/maps.js';
import { distanceInMeters, formatDistance } from '../src/utils/geo.js';
import { deriveTripDuration, findNextStop, getSeoulNow, selectTripDay } from '../src/utils/tripTime.js';

test('Seoul clock uses Asia/Seoul instead of the device timezone', () => {
  const seoul = getSeoulNow(new Date('2026-08-17T14:30:45Z'));
  assert.equal(seoul.isoDate, '2026-08-17');
  assert.equal(seoul.timeLabel, '23:30:45');
});

test('today selection and next stop follow the Seoul date and time', () => {
  const now = new Date('2026-08-18T01:00:00Z');
  const selection = selectTripDay(itineraryDays, now);
  assert.equal(selection.day.id, 'day-2');
  assert.equal(selection.phase, 'today');
  assert.equal(findNextStop(selection.day, now, selection.phase).id, 'd2-2');
});

test('trip duration is derived from the configured date range', () => {
  assert.equal(deriveTripDuration('2026/8/17–8/22'), '6 天 5 夜');
});

test('persisted itinerary removes generated map URLs without removing places', () => {
  const persisted = toPersistedItinerary(itineraryDays);
  assert.equal(persisted.length, itineraryDays.length);
  assert.equal(persisted[0].stops.length, itineraryDays[0].stops.length);
  assert.equal('mapUrl' in persisted[0].stops[0], false);
  assert.equal('routeUrl' in persisted[0].stops[0], false);
});

test('consecutive entries at the same place do not offer a route to themselves', () => {
  assert.equal(itineraryDays[0].stops[3].routeUrl, '');
  assert.ok(itineraryDays[0].stops[3].mapUrl);
});

test('backup round trip restores trip, itinerary and wishlist with a preview summary', () => {
  const wishlist = [{
    id: 'wish-1',
    nameZh: '測試景點',
    nameKo: '테스트 장소',
    type: '景點',
    area: '明洞'
  }];
  const serialized = serializeBackup({
    trip: { tripName: 'Seoul Trip 2026', dates: '2026/8/17–8/22', nights: '6 天 5 夜' },
    itinerary: itineraryDays,
    wishlist
  }, new Date('2026-07-29T00:00:00Z'));
  const restored = parseBackup(serialized);
  const summary = backupSummary(restored);

  assert.equal(summary.tripName, 'Seoul Trip 2026');
  assert.equal(summary.days, 6);
  assert.equal(summary.wishlist, 1);
  assert.ok(restored.itinerary[0].stops[0].mapUrl);
});

test('Naver route cleanup removes the duplicate comma left by English Seoul', () => {
  const url = decodeURIComponent(routeMapUrl(
    '50-6 Chungmuro 2(i)-ga, Jung District, Seoul, 南韓',
    '景福宮'
  ));
  assert.equal(url.includes(', ,'), false);
});

test('Naver route links use the current location as origin and a clean Korean destination', () => {
  const place = { nameKo: '명동성당', nameZh: '明洞聖堂' };
  const location = { latitude: 37.5636, longitude: 126.9869 };
  const appUrl = new URL(naverMapRouteAppUrl(place, location));
  assert.equal(appUrl.protocol, 'nmap:');
  assert.equal(`${appUrl.hostname}${appUrl.pathname}`, 'route/public');
  assert.equal(appUrl.searchParams.get('dlat'), '37.5636');
  assert.equal(appUrl.searchParams.get('dlng'), '126.9869');
  assert.equal(appUrl.searchParams.get('dname'), '명동성당');
  assert.equal(appUrl.searchParams.get('slat'), null);
  assert.ok(naverMapRouteUrl(place, location).startsWith('https://map.naver.com/p/directions/-/'));
  assert.doesNotMatch(naverMapRouteUrl(place, location), /大眾交通/);
});

test('distance formatting keeps short distances readable', () => {
  assert.equal(Math.round(distanceInMeters({ latitude: 37.5636, longitude: 126.9869 }, { latitude: 37.5636, longitude: 126.997 })), 890);
  assert.equal(formatDistance(850), '850 公尺');
  assert.equal(formatDistance(1320), '1.3 公里');
});
