import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { CalendarDays, Heart, Home, ListChecks, MapPinned, MoreHorizontal, Settings, X } from 'lucide-react';
import Dashboard from './pages/Dashboard.jsx';
import { enrichItinerary } from './data/itinerary.js';
import useBusinessIdentityRefresh from './hooks/useBusinessIdentityRefresh.js';
import { useTripSync } from './hooks/useTripSync.js';
import {
  loadItinerary,
  loadTripSettings,
  loadWishlist,
  saveItinerary,
  saveTripSettings,
  saveWishlist
} from './utils/storage.js';

const Overview = lazy(() => import('./pages/Overview.jsx'));
const Itinerary = lazy(() => import('./pages/Itinerary.jsx'));
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'));
const MapPage = lazy(() => import('./pages/MapPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));

const pages = [
  { id: 'dashboard', slug: 'today', label: '今日', icon: Home },
  { id: 'overview', slug: 'overview', label: '總覽', icon: ListChecks },
  { id: 'itinerary', slug: 'itinerary', label: '行程', icon: CalendarDays },
  { id: 'wishlist', slug: 'wishlist', label: '願望', icon: Heart },
  { id: 'map', slug: 'map', label: '地圖', icon: MapPinned },
  { id: 'settings', slug: 'settings', label: '設定', icon: Settings }
];

const bottomPageIds = ['dashboard', 'itinerary', 'wishlist', 'map'];
const morePageIds = ['overview', 'settings'];

function pageFromHash() {
  const slug = window.location.hash.replace(/^#/, '').split('/')[0];
  return pages.find((page) => page.slug === slug || page.id === slug)?.id || 'dashboard';
}

export default function App() {
  const [activePage, setActivePage] = useState(pageFromHash);
  const [moreOpen, setMoreOpen] = useState(false);
  const [trip, setTrip] = useState(loadTripSettings);
  const [itinerary, setItinerary] = useState(() => enrichItinerary(loadItinerary()));
  const [wishlist, setWishlist] = useState(loadWishlist);
  const mainRef = useRef(null);
  const sync = useTripSync({ trip, itinerary, wishlist, setTrip, setItinerary, setWishlist });
  const businessRefreshStatus = useBusinessIdentityRefresh(wishlist, setWishlist, {
    enabled: !['connecting', 'saving'].includes(sync.status)
  });

  useEffect(() => saveTripSettings(trip), [trip]);
  useEffect(() => saveItinerary(itinerary), [itinerary]);
  useEffect(() => saveWishlist(wishlist), [wishlist]);

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#today`);
    }
    const handleHashChange = () => setActivePage(pageFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    mainRef.current?.focus({ preventScroll: true });
  }, [activePage]);

  const currentPage = pages.find((page) => page.id === activePage) || pages[0];
  const CurrentPageIcon = currentPage.icon;

  function navigateTo(pageId, detail = '') {
    const page = pages.find((item) => item.id === pageId) || pages[0];
    const nextHash = `${page.slug}${detail ? `/${detail}` : ''}`;
    setMoreOpen(false);
    if (window.location.hash === `#${nextHash}`) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return;
    }
    window.location.hash = nextHash;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Seoul Trip 2026</p>
          <h1>{trip.tripName}</h1>
          <span>{trip.dates} · {trip.nights}</span>
        </div>
      </header>

      <nav className="top-tabs" aria-label="主要分頁">
        {pages.map((page) => {
          const Icon = page.icon;
          return (
            <button
              key={page.id}
              type="button"
              className={activePage === page.id ? 'active' : ''}
              onClick={() => navigateTo(page.id)}
            >
              <Icon size={17} />
              {page.label}
            </button>
          );
        })}
      </nav>

      <main ref={mainRef} tabIndex="-1">
        <div className="page-title" aria-live="polite">
          <CurrentPageIcon size={20} />
          <span>{currentPage.label}</span>
        </div>

        {activePage === 'dashboard' && (
          <Dashboard
            trip={trip}
            itinerary={itinerary}
            onOpenItinerary={(dayId) => navigateTo('itinerary', dayId)}
          />
        )}
        <Suspense fallback={<div className="page-loading" role="status"><span />正在準備頁面…</div>}>
          {activePage === 'overview' && <Overview itinerary={itinerary} />}
          {activePage === 'itinerary' && (
            <Itinerary
              trip={trip}
              itinerary={itinerary}
              setItinerary={setItinerary}
              wishlist={wishlist}
            />
          )}
          {activePage === 'wishlist' && (
            <Wishlist
              wishlist={wishlist}
              setWishlist={setWishlist}
              businessRefreshStatus={businessRefreshStatus}
            />
          )}
          {activePage === 'map' && <MapPage wishlist={wishlist} />}
          {activePage === 'settings' && (
            <SettingsPage
              trip={trip}
              setTrip={setTrip}
              itinerary={itinerary}
              setItinerary={setItinerary}
              wishlist={wishlist}
              setWishlist={setWishlist}
              sync={sync}
            />
          )}
        </Suspense>
      </main>

      <nav className="bottom-nav" aria-label="手機底部導覽">
        {pages.filter((page) => bottomPageIds.includes(page.id)).map((page) => {
          const Icon = page.icon;
          return (
            <button
              key={page.id}
              type="button"
              className={activePage === page.id ? 'active' : ''}
              onClick={() => navigateTo(page.id)}
            >
              <Icon size={21} />
              <span>{page.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={morePageIds.includes(activePage) || moreOpen ? 'active' : ''}
          aria-expanded={moreOpen}
          aria-controls="mobile-more-menu"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <MoreHorizontal size={21} />
          <span>更多</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="mobile-sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setMoreOpen(false)}>
          <section className="mobile-sheet" id="mobile-more-menu" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title">
            <div className="mobile-sheet-head">
              <div>
                <p className="eyebrow">更多功能</p>
                <h2 id="mobile-more-title">旅行工具</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setMoreOpen(false)} aria-label="關閉更多功能">
                <X size={20} />
              </button>
            </div>
            <div className="mobile-sheet-links">
              {pages.filter((page) => morePageIds.includes(page.id)).map((page) => {
                const Icon = page.icon;
                return (
                  <button key={page.id} type="button" onClick={() => navigateTo(page.id)}>
                    <Icon size={21} />
                    <span>
                      <strong>{page.label}</strong>
                      <small>{page.id === 'overview' ? '六天行程快速瀏覽' : '住宿、航班、同步與備份'}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
