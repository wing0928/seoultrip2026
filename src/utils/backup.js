import { enrichItinerary, migrateTripItinerary, toPersistedItinerary } from '../data/itinerary.js';
import { migrateWishlist } from './storage.js';

const BACKUP_VERSION = 1;

function createBackupPayload({ trip, itinerary, wishlist }, createdAt = new Date()) {
  return {
    app: 'seoul-trip-2026',
    version: BACKUP_VERSION,
    createdAt: createdAt.toISOString(),
    data: {
      trip: { ...trip },
      itinerary: toPersistedItinerary(itinerary),
      wishlist: wishlist.map((item) => ({ ...item }))
    }
  };
}

export function serializeBackup(state, createdAt) {
  return JSON.stringify(createBackupPayload(state, createdAt), null, 2);
}

export function parseBackup(value) {
  let payload;
  try {
    payload = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw new Error('備份檔不是有效的 JSON');
  }

  if (
    payload?.app !== 'seoul-trip-2026'
    || !payload.data?.trip
    || !Array.isArray(payload.data?.itinerary)
    || !Array.isArray(payload.data?.wishlist)
  ) {
    throw new Error('這不是 Seoul Trip 2026 的備份檔');
  }

  return {
    trip: { ...payload.data.trip },
    itinerary: enrichItinerary(migrateTripItinerary(payload.data.itinerary)),
    wishlist: migrateWishlist(payload.data.wishlist),
    createdAt: payload.createdAt || '',
    version: Number(payload.version || 0)
  };
}

export function backupSummary(backup) {
  return {
    tripName: backup.trip.tripName || '未命名旅行',
    dates: backup.trip.dates || '未設定日期',
    days: backup.itinerary.length,
    stops: backup.itinerary.reduce((total, day) => total + day.stops.length, 0),
    wishlist: backup.wishlist.length
  };
}
