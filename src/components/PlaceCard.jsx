import { MoreHorizontal, Navigation } from 'lucide-react';
import LinkButton from './LinkButton.jsx';
import NaverMapButton from './NaverMapButton.jsx';
import { GoogleRatingStrip, PlacePhotoStrip } from './GooglePlaceDetails.jsx';
import { districtForArea } from '../data/districts.js';
import { googleMapUrl } from '../utils/maps.js';
import { supportsGoogleDetails } from '../utils/googlePlaces.js';
import { formatPlaceName, formatPlaceType, normalizePlaceType } from '../utils/placePresentation.js';

export default function PlaceCard({
  place,
  compact = false,
  visited = false,
  actions = null,
  googleDetails = null,
  googleStatus = '',
  showGoogleDetails = false,
  onOpenGoogle = null,
  onAreaSelect = null,
  collapseSummary = false
}) {
  const displayName = formatPlaceName(place);
  const district = districtForArea(place.area);
  const supportsDetails = showGoogleDetails && supportsGoogleDetails(place);
  const AreaTag = onAreaSelect ? 'button' : 'span';
  const hasRoute = Boolean(place.routeUrl && !place.transportFromPrevious);
  const placeType = normalizePlaceType(place.type);
  const summary = [place.note, place.reason].filter(Boolean).join('\n');

  return (
    <article className={`place-card ${compact ? 'compact' : ''} ${visited ? 'visited' : ''}`}>
      <div className="place-card-body">
        <div className="place-top">
          <div>
            <p className="meta">{place.time || place.priority || place.period || place.source || '地點'}</p>
            <h3>{displayName}</h3>
          </div>
          <span className={`type-pill type-${placeType}`}>{formatPlaceType(placeType)}</span>
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
        {place.clothingTags?.length > 0 && placeType === '服裝' && (
          <div className="place-subtags" aria-label="服裝子標籤">
            {place.clothingTags.map((tag) => <span key={tag}>#{tag}</span>)}
          </div>
        )}
        {place.recommendationSource && <p className="recommendation-source">推薦來源：{place.recommendationSource}</p>}
        {summary && (collapseSummary ? (
          <details className="place-summary-menu">
            <summary>顯示簡介</summary>
            <div className="place-summary-content">{summary.split('\n').map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>
          </details>
        ) : summary.split('\n').map((line, index) => <p key={`${line}-${index}`}>{line}</p>))}
        {supportsDetails && <GoogleRatingStrip details={googleDetails} status={googleStatus} />}
        <div className="button-row place-link-row">
          {hasRoute ? (
            <NaverMapButton place={place} route variant="primary"><Navigation size={17} /> 開始導航</NaverMapButton>
          ) : (
            <NaverMapButton place={place} variant="primary"><Navigation size={17} /> 開啟 Naver Map</NaverMapButton>
          )}
          <details className="place-links-menu">
            <summary>其他連結</summary>
            <div>
              {hasRoute && <NaverMapButton place={place} />}
              <LinkButton href={googleMapUrl(place)}>Google Maps</LinkButton>
              {place.catchtableUrl && <LinkButton href={place.catchtableUrl}>CATCHTABLE</LinkButton>}
              {place.sourceUrl && <LinkButton href={place.sourceUrl}>來源</LinkButton>}
            </div>
          </details>
        </div>
        {actions && (
          <details className="card-actions-menu">
            <summary><MoreHorizontal size={18} /> 更多操作</summary>
            <div className="action-row">{actions}</div>
          </details>
        )}
      </div>
    </article>
  );
}
