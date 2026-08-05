import { MoreHorizontal, Navigation } from 'lucide-react';
import LinkButton from './LinkButton.jsx';
import CatchtableButton from './CatchtableButton.jsx';
import NaverMapButton from './NaverMapButton.jsx';
import { GoogleRatingStrip, PlacePhotoStrip } from './GooglePlaceDetails.jsx';
import { districtForArea } from '../data/districts.js';
import { catchtableUrlForPlace, googleMapUrl } from '../utils/maps.js';
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
  onRefreshGoogle = null,
  onAreaSelect = null,
  collapseSummary = false,
  showNote = true
}) {
  const displayName = formatPlaceName(place);
  const district = districtForArea(place.area);
  const supportsDetails = showGoogleDetails && supportsGoogleDetails(place);
  const AreaTag = onAreaSelect ? 'button' : 'span';
  const hasRoute = Boolean(place.routeUrl && !place.transportFromPrevious);
  const placeType = normalizePlaceType(place.type);
  const note = showNote ? String(place.note || '').trim() : '';
  const description = [place.description, place.reason]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('\n');
  const catchtableUrl = catchtableUrlForPlace(place);

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
        {collapseSummary ? (
          <>
            {note && (
              <div className="place-note-content">
                <strong>行程備註</strong>
                {note.split('\n').map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
              </div>
            )}
            {description && (
              <details className="place-summary-menu">
                <summary>顯示景點簡介</summary>
                <div className="place-summary-content">{description.split('\n').map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>
              </details>
            )}
          </>
        ) : (
          [note, description].filter(Boolean).flatMap((text) => text.split('\n')).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)
        )}
        {supportsDetails && <GoogleRatingStrip details={googleDetails} status={googleStatus} onRefresh={onRefreshGoogle} />}
        <div className="button-row place-link-row">
          {hasRoute ? (
            <NaverMapButton place={place} route variant="primary"><Navigation size={17} /> 開始導航</NaverMapButton>
          ) : (
            <NaverMapButton place={place} variant="primary"><Navigation size={17} /> 開啟 Naver Map</NaverMapButton>
          )}
          {place.sourceUrl && <LinkButton href={place.sourceUrl}>來源</LinkButton>}
          {catchtableUrl && <CatchtableButton place={place} />}
          <LinkButton href={googleMapUrl(place)}>Google Maps</LinkButton>
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
