import { useEffect, useRef } from 'react';
import { naverMapAndroidIntentUrl, naverMapAppUrl, placeMapUrl } from '../utils/maps.js';

function mobilePlatform() {
  const userAgent = navigator.userAgent || '';
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  return 'desktop';
}

export default function NaverMapButton({ place, children = 'Naver Map', variant = 'ghost' }) {
  const cancelFallbackRef = useRef(() => {});
  const webUrl = placeMapUrl(place);
  const appUrl = naverMapAppUrl(place);

  useEffect(() => () => cancelFallbackRef.current(), []);

  function openNaverMap(event) {
    const platform = mobilePlatform();
    if (platform === 'desktop') return;

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
      title="手機直接開啟 Naver Map App"
      onClick={openNaverMap}
    >
      {children}
    </a>
  );
}
