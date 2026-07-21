import { useCallback, useEffect, useMemo, useState } from 'react';
import { getGooglePlaceDetails, googlePlacesConfigured, supportsGoogleDetails } from '../utils/googlePlaces.js';

export default function useGooglePlaceDetails(items = []) {
  const [googleDetails, setGoogleDetails] = useState({});
  const [googleStatus, setGoogleStatus] = useState({});
  const eligibleItemsKey = useMemo(() => items
    .filter(supportsGoogleDetails)
    .map((item) => `${item.id}:${item.nameKo || item.nameZh || item.name}:${item.area}`)
    .join('|'), [items]);

  const loadGoogleDetails = useCallback(async (item, refresh = false) => {
    if (!googlePlacesConfigured || !supportsGoogleDetails(item)) return;
    setGoogleStatus((current) => ({ ...current, [item.id]: 'loading' }));
    try {
      const details = await getGooglePlaceDetails(item, { refresh });
      setGoogleDetails((current) => ({ ...current, [item.id]: details }));
      setGoogleStatus((current) => ({ ...current, [item.id]: 'ready' }));
    } catch (error) {
      setGoogleStatus((current) => ({ ...current, [item.id]: error.code || 'error' }));
    }
  }, []);

  useEffect(() => {
    if (!googlePlacesConfigured || !eligibleItemsKey) return undefined;
    let cancelled = false;
    const eligibleItems = items.filter(supportsGoogleDetails);

    async function hydrateRatings() {
      for (const item of eligibleItems) {
        if (cancelled) return;
        setGoogleStatus((current) => ({ ...current, [item.id]: 'loading' }));
        try {
          const details = await getGooglePlaceDetails(item);
          if (cancelled) return;
          setGoogleDetails((current) => ({ ...current, [item.id]: details }));
          setGoogleStatus((current) => ({ ...current, [item.id]: 'ready' }));
        } catch (error) {
          if (cancelled) return;
          setGoogleStatus((current) => ({ ...current, [item.id]: error.code || 'error' }));
        }
      }
    }

    hydrateRatings();
    return () => { cancelled = true; };
  }, [eligibleItemsKey]);

  return { googleDetails, googleStatus, loadGoogleDetails };
}
