import { useEffect, useRef, useState } from 'react';
import { getGoogleMapLocations, googlePlacesConfigured } from '../utils/googlePlaces.js';
import {
  naverMapAndroidIntentUrl,
  naverMapAppUrl,
  naverMapRouteAndroidIntentUrl,
  naverMapRouteAppUrl,
  naverMapRouteUrl,
  placeMapUrl
} from '../utils/maps.js';

function mobilePlatform() {
  const userAgent = navigator.userAgent || '';
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  return 'desktop';
}

export default function NaverMapButton({ place, children = 'Naver Map', variant = 'ghost', route = false }) {
  const cancelFallbackRef = useRef(() => {});
  const directLocation = placeCoordinates(place);
  const webUrl = route && directLocation ? naverMapRouteUrl(place, directLocation) : placeMapUrl(place);
  const appUrl = route && directLocation ? naverMapRouteAppUrl(place, directLocation) : naverMapAppUrl(place);
  const [routeState, setRouteState] = useState('idle');

  useEffect(() => () => cancelFallbackRef.current(), []);

  function openNaverMap(event) {
    const platform = mobilePlatform();
    if (!route) {
      if (platform === 'desktop') return;
      openSearchApp(event, platform);
      return;
    }

    event.preventDefault();
    cancelFallbackRef.current();
    if (routeState === 'loading') return;

    const popup = platform === 'desktop' ? window.open('about:blank', '_blank') : null;
    setRouteState('loading');

    resolveDestinationLocation(place).then((location) => {
      const resolvedWebUrl = location ? naverMapRouteUrl(place, location) : placeMapUrl(place);
      const resolvedAppUrl = location ? naverMapRouteAppUrl(place, location) : naverMapAppUrl(place);

      if (platform === 'desktop') {
        if (popup && !popup.closed) {
          popup.location.href = resolvedWebUrl;
        } else {
          window.location.href = resolvedWebUrl;
        }
        setRouteState('idle');
        return;
      }

      cancelFallbackRef.current();
      if (platform === 'android') {
        window.location.href = location
          ? naverMapRouteAndroidIntentUrl(place, location)
          : naverMapAndroidIntentUrl(place);
        setRouteState('idle');
        return;
      }

      let fallbackTimer;
      const clickedAt = Date.now();
      const cancelFallback = () => {
        window.clearTimeout(fallbackTimer);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
      const handleVisibilityChange = () => {
        if (document.hidden) cancelFallback();
      };

      cancelFallbackRef.current = cancelFallback;
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.location.href = resolvedAppUrl;
      fallbackTimer = window.setTimeout(() => {
        cancelFallback();
        if (document.visibilityState === 'visible' && Date.now() - clickedAt < 2200) {
          window.location.href = resolvedWebUrl;
        }
      }, 1500);
      setRouteState('idle');
    }).catch(() => {
      if (popup && !popup.closed) popup.location.href = placeMapUrl(place);
      else if (platform === 'desktop') window.location.href = placeMapUrl(place);
      else if (platform === 'android') window.location.href = naverMapAndroidIntentUrl(place);
      else window.location.href = naverMapAppUrl(place);
      setRouteState('idle');
    });
  }

  function openSearchApp(event, platform) {
    event.preventDefault();
    cancelFallbackRef.current();

    if (platform === 'android') {
      window.location.href = naverMapAndroidIntentUrl(place);
      return;
    }

    let fallbackTimer;
    const clickedAt = Date.now();
    const cancelFallback = () => {
      window.clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    const handleVisibilityChange = () => {
      if (document.hidden) cancelFallback();
    };

    cancelFallbackRef.current = cancelFallback;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.location.href = appUrl;
    fallbackTimer = window.setTimeout(() => {
      cancelFallback();
      if (document.visibilityState === 'visible' && Date.now() - clickedAt < 2200) {
        window.location.href = webUrl;
      }
    }, 1500);
  }

  return (
    <a
      className={`link-button ${variant}`}
      href={webUrl}
      target="_blank"
      rel="noreferrer"
      data-mobile-app-url={appUrl}
      title={route ? '以目前位置前往目的地' : '手機直接開啟 Naver Map App'}
      aria-busy={routeState === 'loading'}
      onClick={openNaverMap}
    >
      {children}
    </a>
  );
}

function placeCoordinates(place) {
  const latitude = Number(place?.latitude ?? place?.lat);
  const longitude = Number(place?.longitude ?? place?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

async function resolveDestinationLocation(place) {
  const directLocation = placeCoordinates(place);
  if (directLocation || !googlePlacesConfigured) return directLocation;
  const locations = await getGoogleMapLocations([place]);
  return locations[0] || null;
}
