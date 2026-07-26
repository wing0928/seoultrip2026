export const googleMapsBrowserApiKey = String(
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY ||
  ''
).trim();

export const googleMapsMapId = String(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID').trim();

let loaderPromise;

export function loadGoogleMaps() {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (!googleMapsBrowserApiKey) {
    return Promise.reject(new Error('Google Maps JavaScript API 尚未設定'));
  }
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const callbackName = '__seoulTripGoogleMapsReady';
    const existing = document.getElementById('seoul-trip-google-maps');

    window.gm_authFailure = () => {
      window.dispatchEvent(new Event('google-maps-auth-failure'));
    };

    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };

    if (existing) {
      existing.addEventListener('error', () => reject(new Error('Google 地圖載入失敗')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'seoul-trip-google-maps';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsBrowserApiKey)}&v=weekly&libraries=marker&language=zh-TW&region=KR&loading=async&callback=${callbackName}`;
    script.addEventListener('error', () => {
      loaderPromise = undefined;
      delete window[callbackName];
      reject(new Error('Google 地圖載入失敗'));
    }, { once: true });
    document.head.appendChild(script);
  });

  return loaderPromise;
}
