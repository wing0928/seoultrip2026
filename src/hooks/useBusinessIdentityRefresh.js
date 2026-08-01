import { useEffect, useRef, useState } from 'react';
import {
  BUSINESS_LOOKUP_VERSION,
  enrichPlaceIdentity,
  needsBusinessIdentityRefresh
} from '../utils/googlePlaces.js';

export default function useBusinessIdentityRefresh(wishlist, setWishlist, { enabled = true } = {}) {
  const inFlightIdsRef = useRef(new Set());
  const [status, setStatus] = useState({ state: 'idle', completed: 0, total: 0 });
  const refreshKey = enabled ? wishlist
    .filter(needsBusinessIdentityRefresh)
    .map((item) => `${item.id}:${item.nameZh || item.name || ''}:${item.nameKo || ''}:${item.type}`)
    .join('|') : '';

  useEffect(() => {
    if (!enabled) return undefined;
    const targets = wishlist.filter((item) => (
      needsBusinessIdentityRefresh(item) && !inFlightIdsRef.current.has(item.id)
    ));
    if (!targets.length) return undefined;

    const item = targets[0];
    inFlightIdsRef.current.add(item.id);
    setStatus((current) => ({
      state: 'loading',
      completed: current.state === 'loading' ? current.completed : 0,
      total: current.state === 'loading' ? Math.max(current.total, targets.length + current.completed) : targets.length
    }));

    async function refresh() {
      let updated;
      try {
        updated = await enrichPlaceIdentity(item);
      } catch (error) {
        updated = {
          ...item,
          type: item.type === '商店' ? inferLegacyShopType(item) : item.type,
          businessLookupVersion: item.businessLookupVersion || 0,
          needsBusinessLookup: true,
          businessLookupStatus: error?.code || 'error',
          businessLookupNote: error instanceof Error ? error.message : '商家資料更新失敗',
          businessLookupAt: new Date().toISOString()
        };
      }
      inFlightIdsRef.current.delete(item.id);
      setWishlist((items) => items.map((entry) => entry.id === item.id ? updated : entry));
      setStatus((current) => {
        const completed = current.completed + 1;
        return {
          state: completed >= current.total ? 'ready' : 'loading',
          completed,
          total: current.total
        };
      });
    }

    refresh();
    return undefined;
  }, [enabled, refreshKey, setWishlist]);

  return status;
}

function inferLegacyShopType(place) {
  const text = `${place.nameZh || ''} ${place.nameKo || ''} ${place.note || ''}`;
  if (/選物店|選品店|選物|選品|select\s*shop|concept\s*store|편집샵|셀렉트샵/i.test(text)) return '選物店';
  if (/男裝|男士|男生|mens?\b|남성|남자|女裝|女士|女生|womens?\b|여성|여자|鞋子|shoes?\b/i.test(text)) return '服裝';
  return '其他';
}
