import { MapPin, Navigation } from 'lucide-react';
import LinkButton from './LinkButton.jsx';
import { googleMapUrl, placeMapUrl } from '../utils/maps.js';
import { formatPlaceName, formatPlaceType } from '../utils/placePresentation.js';

export default function PlaceCard({ place, compact = false, actions = null }) {
  const displayName = formatPlaceName(place);

  return (
    <article className={`place-card ${compact ? 'compact' : ''}`}>
      <div className="place-top">
        <div>
          <p className="meta">{place.time || place.period || place.source || '地點'}</p>
          <h3>{displayName}</h3>
        </div>
        <span className={`type-pill type-${place.type}`}>{formatPlaceType(place.type)}</span>
      </div>
      <p className="area"><MapPin size={15} /> {place.area || '待確認'}</p>
      {place.note && <p>{place.note}</p>}
      {place.reason && <p>{place.reason}</p>}
      <div className="button-row">
        <LinkButton href={placeMapUrl(place)}>Naver Map</LinkButton>
        <LinkButton href={googleMapUrl(place)}>Google Maps</LinkButton>
        {place.routeUrl && !place.transportFromPrevious && <LinkButton href={place.routeUrl}><Navigation size={16} /> Naver 路線</LinkButton>}
      </div>
      {actions && <div className="action-row">{actions}</div>}
    </article>
  );
}
