import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { districtForArea, districts } from '../data/districts.js';
import { googleMapEmbedUrl, googleMapUrl } from '../utils/maps.js';
import { formatPlaceName, formatPlaceType } from '../utils/placePresentation.js';

const embedApiKey = String(import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY || '').trim();

export default function MapPage({ wishlist = [] }) {
  const [areaFilter, setAreaFilter] = useState('全部');
  const [selectedId, setSelectedId] = useState('');
  const visiblePlaces = useMemo(() => (
    wishlist.filter((place) => (
      areaFilter === '全部' || districtForArea(place.area).name === areaFilter
    ))
  ), [areaFilter, wishlist]);

  useEffect(() => {
    if (!visiblePlaces.some((place) => place.id === selectedId)) {
      setSelectedId(visiblePlaces[0]?.id || '');
    }
  }, [selectedId, visiblePlaces]);

  const selectedPlace = visiblePlaces.find((place) => place.id === selectedId) || visiblePlaces[0] || null;
  const selectedDistrict = selectedPlace ? districtForArea(selectedPlace.area) : null;

  return (
    <div className="stack map-page">
      <section className="map-toolbar" aria-labelledby="wishlist-map-title">
        <div>
          <p className="eyebrow">Wishlist map</p>
          <h2 id="wishlist-map-title">願望清單地圖</h2>
          <p>{visiblePlaces.length} 個地點</p>
        </div>
        <div className="filter-scroll-track district-filter-track" role="group" aria-label="依地區篩選地圖景點">
          <button type="button" className={areaFilter === '全部' ? 'active' : ''} onClick={() => setAreaFilter('全部')}>
            全部地區
          </button>
          {districts.map((district) => (
            <button
              key={district.id}
              type="button"
              className={areaFilter === district.name ? 'active' : ''}
              style={{ '--filter-color': district.color }}
              aria-pressed={areaFilter === district.name}
              onClick={() => setAreaFilter(district.name)}
            >
              <span />#{district.name}
            </button>
          ))}
        </div>
      </section>

      <section className="map-workspace">
        <div className="google-map-panel">
          {selectedPlace ? (
            <>
              <div className="map-selected-head">
                <div>
                  <p className="eyebrow">Google Maps</p>
                  <h2>{formatPlaceName(selectedPlace)}</h2>
                  <span style={{ '--tag-color': selectedDistrict.color }}>#{selectedDistrict.name}</span>
                </div>
                <a className="map-external-link" href={googleMapUrl(selectedPlace)} target="_blank" rel="noreferrer">
                  <ExternalLink size={17} /> 開啟
                </a>
              </div>
              <iframe
                key={selectedPlace.id}
                className="google-map-frame"
                title={`${formatPlaceName(selectedPlace)} Google Maps`}
                src={googleMapEmbedUrl(selectedPlace, embedApiKey)}
                loading="lazy"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </>
          ) : (
            <div className="map-empty-state">
              <MapPin size={28} />
              <strong>這個地區還沒有願望景點</strong>
              <span>新增景點後會自動顯示在這裡。</span>
            </div>
          )}
        </div>

        <aside className="map-place-panel" aria-label="願望清單景點">
          <div className="map-place-panel-head">
            <strong>{areaFilter === '全部' ? '全部願望' : `#${areaFilter}`}</strong>
            <span>{visiblePlaces.length}</span>
          </div>
          <div className="map-place-list">
            {visiblePlaces.map((place) => {
              const district = districtForArea(place.area);
              const active = place.id === selectedPlace?.id;
              return (
                <button
                  key={place.id}
                  type="button"
                  className={active ? 'active' : ''}
                  style={{ '--place-color': district.color }}
                  aria-pressed={active}
                  onClick={() => setSelectedId(place.id)}
                >
                  <MapPin size={18} />
                  <span>
                    <strong>{formatPlaceName(place)}</strong>
                    <small>{formatPlaceType(place.type)} · #{district.name}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </section>
    </div>
  );
}
