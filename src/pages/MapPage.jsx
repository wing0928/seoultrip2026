import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, MapPin } from 'lucide-react';
import DistrictExplorer from '../components/DistrictExplorer.jsx';
import { districtForArea, districts } from '../data/districts.js';
import { PLACE_TYPES } from '../data/placeTypes.js';
import { getGoogleMapLocations } from '../utils/googlePlaces.js';
import {
  googleMapsBrowserApiKey,
  googleMapsMapId,
  loadGoogleMaps
} from '../utils/googleMapsLoader.js';
import { googleMapEmbedUrl, googleMapUrl, placeMapUrl } from '../utils/maps.js';
import { formatPlaceName, formatPlaceType, placeTypeEmoji } from '../utils/placePresentation.js';

const TYPE_ORDER = PLACE_TYPES;
const PLACE_FOCUS_ZOOM = 19;

export default function MapPage({ wishlist = [] }) {
  const [selectedDistrictId, setSelectedDistrictId] = useState('myeongdong');
  const [typeFilter, setTypeFilter] = useState('全部');
  const [selectedId, setSelectedId] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [mapStatus, setMapStatus] = useState({ state: 'idle', markerCount: 0, message: '' });
  const mapNodeRef = useRef(null);
  const placeListRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const markerElementsRef = useRef(new Map());
  const locationByIdRef = useRef(new Map());

  const selectedDistrict = districts.find((district) => district.id === selectedDistrictId) || districts[0];
  const districtCounts = useMemo(() => Object.fromEntries(
    districts.map((district) => [
      district.id,
      wishlist.filter((place) => districtForArea(place.area).id === district.id).length
    ])
  ), [wishlist]);
  const districtPlaces = useMemo(() => (
    wishlist.filter((place) => districtForArea(place.area).id === selectedDistrict.id)
  ), [selectedDistrict.id, wishlist]);
  const availableTypes = useMemo(() => {
    const present = new Set(districtPlaces.map((place) => place.type || '其他'));
    return [
      ...TYPE_ORDER.filter((type) => present.has(type)),
      ...Array.from(present).filter((type) => !TYPE_ORDER.includes(type))
    ];
  }, [districtPlaces]);
  const visiblePlaces = useMemo(() => (
    districtPlaces.filter((place) => typeFilter === '全部' || (place.type || '其他') === typeFilter)
  ), [districtPlaces, typeFilter]);
  const orderedVisiblePlaces = useMemo(() => {
    const selectedIndex = visiblePlaces.findIndex((place) => place.id === selectedId);
    if (selectedIndex <= 0) return visiblePlaces;
    return [
      visiblePlaces[selectedIndex],
      ...visiblePlaces.slice(0, selectedIndex),
      ...visiblePlaces.slice(selectedIndex + 1)
    ];
  }, [selectedId, visiblePlaces]);

  useEffect(() => {
    if (typeFilter !== '全部' && !availableTypes.includes(typeFilter)) setTypeFilter('全部');
  }, [availableTypes, typeFilter]);

  useEffect(() => {
    if (!visiblePlaces.some((place) => place.id === selectedId)) {
      setSelectedId(visiblePlaces[0]?.id || '');
    }
  }, [selectedId, visiblePlaces]);

  useEffect(() => {
    const handleAuthFailure = () => {
      clearMarkers(markersRef);
      setMapStatus({
        state: 'error',
        markerCount: 0,
        message: 'Google 多景點地圖尚未啟用，已改用單點地圖'
      });
    };
    window.addEventListener('google-maps-auth-failure', handleAuthFailure);
    return () => window.removeEventListener('google-maps-auth-failure', handleAuthFailure);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function drawMap() {
      clearMarkers(markersRef);
      markerElementsRef.current = new Map();
      locationByIdRef.current = new Map();

      if (!visiblePlaces.length) {
        setMapStatus({ state: 'empty', markerCount: 0, message: '' });
        return;
      }
      if (!googleMapsBrowserApiKey || !mapNodeRef.current) {
        setMapStatus({ state: 'fallback', markerCount: 0, message: '' });
        return;
      }

      setMapStatus({ state: 'loading', markerCount: 0, message: '正在載入地圖景點' });
      try {
        const [maps, locations] = await Promise.all([
          loadGoogleMaps(),
          getGoogleMapLocations(visiblePlaces)
        ]);
        const [{ Map: GoogleMap }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
          maps.importLibrary('maps'),
          maps.importLibrary('marker')
        ]);
        if (cancelled || !mapNodeRef.current) return;

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new GoogleMap(mapNodeRef.current, {
            center: selectedDistrict.center,
            zoom: 13,
            mapId: googleMapsMapId,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            clickableIcons: false
          });
        }

        const map = mapInstanceRef.current;
        const bounds = new maps.LatLngBounds();
        const placeById = new Map(visiblePlaces.map((place) => [place.id, place]));
        const nextLocations = new Map();
        const nextMarkerElements = new Map();
        const markers = locations.map((location) => {
          const place = placeById.get(location.id);
          if (!place) return null;
          const position = { lat: location.latitude, lng: location.longitude };
          const pin = new PinElement({
            background: selectedDistrict.color,
            borderColor: selectedDistrict.activeColor,
            glyphText: placeTypeEmoji(place.type),
            scale: 0.92
          });
          const marker = new AdvancedMarkerElement({
            map,
            position,
            title: formatPlaceName(place),
            content: pin,
            gmpClickable: true
          });
          marker.addEventListener('gmp-click', () => focusPlace(place.id));
          bounds.extend(position);
          nextLocations.set(place.id, position);
          nextMarkerElements.set(place.id, pin);
          return marker;
        }).filter(Boolean);

        markersRef.current = markers;
        markerElementsRef.current = nextMarkerElements;
        locationByIdRef.current = nextLocations;
        if (markers.length === 1) {
          map.setCenter({ lat: locations[0].latitude, lng: locations[0].longitude });
          map.setZoom(16);
        } else if (markers.length > 1) {
          map.fitBounds(bounds, 54);
        } else {
          map.setCenter(selectedDistrict.center);
          map.setZoom(13);
        }
        setMapStatus({
          state: 'ready',
          markerCount: markers.length,
          message: markers.length < visiblePlaces.length ? `${markers.length} / ${visiblePlaces.length} 個地點已定位` : ''
        });
      } catch (error) {
        if (!cancelled) {
          setMapStatus({
            state: 'error',
            markerCount: 0,
            message: error instanceof Error ? error.message : 'Google 地圖載入失敗'
          });
        }
      }
    }

    drawMap();
    return () => {
      cancelled = true;
    };
  }, [selectedDistrict, visiblePlaces]);

  useEffect(() => {
    markerElementsRef.current.forEach((element, id) => {
      element.classList.toggle('selected-map-marker', id === selectedId);
    });
    const position = locationByIdRef.current.get(selectedId);
    if (position && mapInstanceRef.current) mapInstanceRef.current.panTo(position);
    if (selectedId && placeListRef.current) placeListRef.current.scrollTop = 0;
  }, [mapStatus.state, selectedId]);

  const selectedPlace = visiblePlaces.find((place) => place.id === selectedId) || visiblePlaces[0] || null;

  function selectDistrict(id) {
    setSelectedDistrictId(id);
    setTypeFilter('全部');
    setSelectedId('');
    setExpandedId('');
  }

  function focusPlace(id) {
    setSelectedId(id);
    const position = locationByIdRef.current.get(id);
    if (position && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(position);
      mapInstanceRef.current.setZoom(PLACE_FOCUS_ZOOM);
    }
    if (placeListRef.current) placeListRef.current.scrollTop = 0;
  }

  return (
    <div className="stack map-page">
      <DistrictExplorer
        selectedId={selectedDistrictId}
        onSelect={selectDistrict}
        showDetails={false}
        counts={districtCounts}
      />

      <section className="map-toolbar" aria-labelledby="wishlist-map-title">
        <div>
          <p className="eyebrow">Google Maps</p>
          <h2 id="wishlist-map-title">#{selectedDistrict.name}願望地圖</h2>
          <p>{visiblePlaces.length} 個地點</p>
        </div>
        <div className="map-type-picker">
          <strong>選取景點類型</strong>
          <div className="scroll-row">
            <div className="filter-scroll-track" role="group" aria-label="依景點類型篩選地圖">
              <button type="button" className={typeFilter === '全部' ? 'active' : ''} aria-pressed={typeFilter === '全部'} onClick={() => setTypeFilter('全部')}>
                🧭 全部
              </button>
              {availableTypes.map((type) => (
                <button key={type} type="button" className={typeFilter === type ? 'active' : ''} aria-pressed={typeFilter === type} onClick={() => setTypeFilter(type)}>
                  {placeTypeEmoji(type)} {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="map-workspace">
        <div className="google-map-panel">
          <div className="map-selected-head">
            <div>
              <p className="eyebrow">Google Maps</p>
              <h2>{selectedPlace ? formatPlaceName(selectedPlace) : `#${selectedDistrict.name}`}</h2>
              <span style={{ '--tag-color': selectedDistrict.color }}>#{selectedDistrict.name}</span>
            </div>
            {selectedPlace && (
              <a className="map-external-link" href={googleMapUrl(selectedPlace)} target="_blank" rel="noreferrer">
                <ExternalLink size={17} /> 開啟
              </a>
            )}
          </div>

          {visiblePlaces.length ? (
            <div className="google-map-stage">
              <div
                ref={mapNodeRef}
                className={`google-map-frame ${['fallback', 'error'].includes(mapStatus.state) ? 'map-base-hidden' : ''}`}
                aria-label={`${selectedDistrict.name}願望景點 Google 地圖`}
                aria-hidden={['fallback', 'error'].includes(mapStatus.state)}
              />
              {['fallback', 'error'].includes(mapStatus.state) && selectedPlace && (
                <iframe
                  key={selectedPlace.id}
                  className="google-map-frame google-map-fallback"
                  title={`${formatPlaceName(selectedPlace)} Google Maps`}
                  src={googleMapEmbedUrl(selectedPlace)}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              )}
              {['loading', 'error'].includes(mapStatus.state) && (
                <div className={`map-status-overlay ${mapStatus.state}`}>
                  <MapPin size={22} />
                  <span>{mapStatus.message}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="map-empty-state">
              <MapPin size={28} />
              <strong>這個條件還沒有願望景點</strong>
              <span>可改選其他地區或景點類型。</span>
            </div>
          )}
          {mapStatus.state === 'ready' && mapStatus.message && <p className="map-location-summary">{mapStatus.message}</p>}
        </div>

        <aside className="map-place-panel" aria-label={`${selectedDistrict.name}願望景點`}>
          <div className="map-place-panel-head">
            <strong>{typeFilter === '全部' ? `#${selectedDistrict.name}景點` : formatPlaceType(typeFilter)}</strong>
            <span>{visiblePlaces.length}</span>
          </div>
          <div ref={placeListRef} className="map-place-list">
            {orderedVisiblePlaces.map((place) => {
              const active = place.id === selectedPlace?.id;
              const expanded = place.id === expandedId;
              return (
                <article
                  key={place.id}
                  className={`map-place-item ${active ? 'active' : ''} ${expanded ? 'expanded' : ''}`}
                  style={{ '--place-color': selectedDistrict.color }}
                >
                  <button
                    type="button"
                    className="map-place-select"
                    aria-pressed={active}
                    onClick={() => focusPlace(place.id)}
                  >
                    <MapPin size={18} />
                    <span>
                      <strong>{formatPlaceName(place)}</strong>
                      <small>{formatPlaceType(place.type)}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="map-place-toggle"
                    aria-label={`查看 ${formatPlaceName(place)} 景點資訊`}
                    aria-expanded={expanded}
                    title="查看景點資訊"
                    onClick={() => {
                      focusPlace(place.id);
                      setExpandedId(expanded ? '' : place.id);
                    }}
                  >
                    <ChevronDown size={19} />
                  </button>
                  {expanded && (
                    <div className="map-place-details">
                      <dl>
                        <div><dt>優先度</dt><dd>{place.priority || '想去'}</dd></div>
                        <div><dt>地區</dt><dd>#{selectedDistrict.name}</dd></div>
                      </dl>
                      {place.recommendationSource && <p><strong>推薦來源</strong>{place.recommendationSource}</p>}
                      {place.note && <p><strong>備註</strong>{place.note}</p>}
                      <div className="map-place-links">
                        <a href={placeMapUrl(place)} target="_blank" rel="noreferrer">Naver Map</a>
                        <a href={googleMapUrl(place)} target="_blank" rel="noreferrer">Google Maps</a>
                        {place.sourceUrl && <a href={place.sourceUrl} target="_blank" rel="noreferrer">來源</a>}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
            {!visiblePlaces.length && <p className="empty">沒有符合條件的景點。</p>}
          </div>
        </aside>
      </section>
    </div>
  );
}

function clearMarkers(markersRef) {
  markersRef.current.forEach((marker) => {
    marker.map = null;
  });
  markersRef.current = [];
}
