import { Navigation } from 'lucide-react';
import LinkButton from './LinkButton.jsx';
import NaverMapButton from './NaverMapButton.jsx';
import { GoogleRatingStrip, PlacePhotoStrip } from './GooglePlaceDetails.jsx';
import { districtForArea } from '../data/districts.js';
import { googleMapUrl } from '../utils/maps.js';
import { supportsGoogleDetails } from '../utils/googlePlaces.js';
import { formatPlaceName, formatPlaceType } from '../utils/placePresentation.js';

export default function PlaceCard({
  place,
  compact = false,
  visited = false,
  actions = null,
  googleDetails = null,
  googleStatus = '',
  showGoogleDetails = false,
  onOpenGoogle = null,
  onAreaSelect = null
}) {
  const displayName = formatPlaceName(place);
  const district = districtForArea(place.area);
  const supportsDetails = showGoogleDetails && supportsGoogleDetails(place);
  const AreaTag = onAreaSelect ? 'button' : 'span';

  return (
    <article className={`place-card ${compact ? 'compact' : ''} ${visited ? 'visited' : ''}`}>
      <div className="place-card-body">
        <div className="place-top">
          <div>
            <p className="meta">{place.time || place.priority || place.period || place.source || '地點'}</p>
            <h3>{displayName}</h3>
          </div>
          <span className={`type-pill type-${place.type}`}>{formatPlaceType(place.type)}</span>
        </div>
        <AreaTag
          className={`place-area-tag ${onAreaSelect ? '' : 'static'}`}
          style={{ '--tag-color': district.color }}
          type={onAreaSelect ? 'button' : undefined}
          onClick={onAreaSelect ? () => onAreaSelect(district) : undefined}
        >
          #{district.name}
        </AreaTag>
        {supportsDetails && <PlacePhotoStrip details={googleDetails} status={googleStatus} onOpen={onOpenGoogle} />}
        {place.recommendationSource && <p className="recommendation-source">推薦來源：{place.recommendationSource}</p>}
        {place.note && <p>{place.note}</p>}
        {place.reason && <p>{place.reason}</p>}
        {supportsDetails && <GoogleRatingStrip details={googleDetails} status={googleStatus} />}
        <div className="button-row place-link-row">
          <NaverMapButton place={place} />
          <LinkButton href={googleMapUrl(place)}>Google Maps</LinkButton>
          {place.sourceUrl && <LinkButton href={place.sourceUrl}>來源</LinkButton>}
          {place.routeUrl && !place.transportFromPrevious && <LinkButton href={place.routeUrl}><Navigation size={16} /> Naver 路線</LinkButton>}
        </div>
        {actions && <div className="action-row">{actions}</div>}
      </div>
    </article>
  );
}
