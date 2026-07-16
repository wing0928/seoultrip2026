import { useEffect, useState } from 'react';
import { CalendarDays, Heart, Home, ListChecks, Route, Settings } from 'lucide-react';
import Dashboard from './pages/Dashboard.jsx';
import Itinerary from './pages/Itinerary.jsx';
import Overview from './pages/Overview.jsx';
import Transport from './pages/Transport.jsx';
import Wishlist from './pages/Wishlist.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { enrichItinerary } from './data/itinerary.js';
import { useTripSync } from './hooks/useTripSync.js';
import {
  loadItinerary,
  loadTripSettings,
  loadWishlist,
  saveItinerary,
  saveTripSettings,
  saveWishlist
} from './utils/storage.js';

const pages = [
  { id: 'dashboard', label: '首頁', icon: Home },
  { id: 'overview', label: '總覽', icon: ListChecks },
  { id: 'itinerary', label: '行程', icon: CalendarDays },
  { id: 'transport', label: '交通', icon: Route },
  { id: 'wishlist', label: '願望', icon: Heart },
  { id: 'settings', label: '設定', icon: Settings }
];

const bottomPages = ['dashboard', 'overview', 'itinerary', 'wishlist', 'settings'];

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [trip, setTrip] = useState(loadTripSettings);
  const [itinerary, setItinerary] = useState(() => enrichItinerary(loadItinerary()));
  const [wishlist, setWishlist] = useState(loadWishlist);
  const sync = useTripSync({ trip, itinerary, wishlist, setTrip, setItinerary, setWishlist });

  useEffect(() => saveTripSettings(trip), [trip]);
  useEffect(() => saveItinerary(itinerary), [itinerary]);
  useEffect(() => saveWishlist(wishlist), [wishlist]);

  const currentPage = pages.find((page) => page.id === activePage);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Seoul travel notebook</p>
          <h1>{trip.tripName}</h1>
          <span>{trip.dates} · {trip.nights}</span>
        </div>
      </header>

      <nav className="top-tabs" aria-label="主要分頁">
        {pages.map((page) => {
          const Icon = page.icon;
          return (
            <button key={page.id} className={activePage === page.id ? 'active' : ''} onClick={() => setActivePage(page.id)}>
              <Icon size={17} />
              {page.label}
            </button>
          );
        })}
      </nav>

      <main>
        <div className="page-title">
          {currentPage && <currentPage.icon size={20} />}
          <span>{currentPage?.label}</span>
        </div>

        {activePage === 'dashboard' && <Dashboard trip={trip} setActivePage={setActivePage} />}
        {activePage === 'overview' && <Overview itinerary={itinerary} />}
        {activePage === 'itinerary' && <Itinerary trip={trip} itinerary={itinerary} setItinerary={setItinerary} wishlist={wishlist} />}
        {activePage === 'transport' && <Transport trip={trip} itinerary={itinerary} />}
        {activePage === 'wishlist' && <Wishlist wishlist={wishlist} setWishlist={setWishlist} />}
        {activePage === 'settings' && <SettingsPage trip={trip} setTrip={setTrip} sync={sync} />}
      </main>

      <nav className="bottom-nav" aria-label="手機底部導覽">
        {pages.filter((page) => bottomPages.includes(page.id)).map((page) => {
          const Icon = page.icon;
          return (
            <button key={page.id} className={activePage === page.id ? 'active' : ''} onClick={() => setActivePage(page.id)}>
              <Icon size={20} />
              <span>{page.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
