import { RefreshCw, Star, X } from 'lucide-react';
import LinkButton from './LinkButton.jsx';
import { googleMapUrl } from '../utils/maps.js';
import { googlePlacesConfigured } from '../utils/googlePlaces.js';
import { formatPlaceName } from '../utils/placePresentation.js';

export function PlacePhotoStrip({ details, status, onOpen }) {
  const photos = details?.photos?.slice(0, 2) || [];
  if (!photos.length && status !== 'loading') return null;

  return (
    <div className={`place-photo-strip ${photos.length ? '' : 'loading'}`} aria-label="Google 店家照片">
      {photos.length ? photos.map((photo, index) => (
        <button key={photo.url} type="button" onClick={onOpen} aria-label={`查看 ${details.displayName} 的 Google 評價與照片`}>
          <img src={photo.url} alt={`${details.displayName} 店家照片 ${index + 1}`} loading="lazy" />
          {photo.authors?.[0]?.name && <span>照片：{photo.authors[0].name}</span>}
        </button>
      )) : <><span /><span /></>}
    </div>
  );
}

export function GoogleRatingStrip({ details, status }) {
  return (
    <div className="google-rating-strip" aria-label="Google 星等">
      <Star size={18} fill={details?.rating ? 'currentColor' : 'none'} />
      <strong>{details?.rating ? details.rating.toFixed(1) : '—'}</strong>
      <span>{details?.userRatingCount ? `${details.userRatingCount.toLocaleString()} 則 Google 評價` : (status === 'loading' ? '載入 Google 評價中' : 'Google 星等尚未取得')}</span>
    </div>
  );
}

export function GoogleReviewDialog({ place, details, status, onClose, onRefresh }) {
  if (!place) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="bulk-dialog google-review-dialog" role="dialog" aria-modal="true" aria-labelledby="google-review-title">
        <div className="dialog-head">
          <div><p className="eyebrow">Google Places</p><h2 id="google-review-title">{formatPlaceName(place)}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="關閉"><X size={20} /></button>
        </div>
        {!googlePlacesConfigured ? (
          <div className="google-empty-state"><Star size={24} /><strong>尚未連接 Google Places</strong><span>完成 Supabase Edge Function 設定後即可顯示星等與照片。</span></div>
        ) : status === 'loading' ? (
          <div className="google-empty-state"><RefreshCw className="spin" size={24} /><strong>正在載入 Google 評價</strong></div>
        ) : details ? (
          <GoogleReviewContent details={details} fallbackMapUrl={googleMapUrl(place)} onRefresh={onRefresh} />
        ) : (
          <div className="google-empty-state"><Star size={24} /><strong>找不到相符的 Google 店家資料</strong><button className="mini-button" onClick={onRefresh}><RefreshCw size={16} /> 再試一次</button></div>
        )}
      </section>
    </div>
  );
}

function GoogleReviewContent({ details, fallbackMapUrl, onRefresh }) {
  return (
    <div className="google-review-content">
      <div className="google-review-score">
        <Star size={25} fill="currentColor" />
        <strong>{details.rating ? details.rating.toFixed(1) : '—'}</strong>
        <span>{details.userRatingCount ? `${details.userRatingCount.toLocaleString()} 則評價` : '尚無評論數'}</span>
        <button className="icon-button" onClick={onRefresh} aria-label="重新整理 Google 評價" title="重新整理 Google 評價"><RefreshCw size={17} /></button>
      </div>
      {details.address && <p className="google-place-address">{details.address}</p>}

      <div className="google-photo-grid">
        {[0, 1].map((index) => {
          const photo = details.photos?.[index];
          return photo ? (
            <figure key={photo.url}>
              <img src={photo.url} alt={`${details.displayName} 店家照片 ${index + 1}`} />
              {photo.authors?.[0]?.name && <figcaption>照片：{photo.authors[0].name}</figcaption>}
            </figure>
          ) : <div className="google-photo-placeholder" key={index}>暫無照片</div>;
        })}
      </div>

      <section className="google-ai-summary">
        <h3>Google AI 摘要</h3>
        {details.aiSummary ? <p>{details.aiSummary}</p> : <p className="soft-text">Google 目前未提供此首爾店家的 AI 摘要。</p>}
        {details.aiDisclosure && <small>{details.aiDisclosure}</small>}
      </section>

      <div className="button-row">
        <LinkButton href={details.aiReviewsUri || details.googleMapsUri || fallbackMapUrl}>查看 Google 評價</LinkButton>
        {details.aiFlagUri && <LinkButton href={details.aiFlagUri}>回報摘要</LinkButton>}
      </div>
    </div>
  );
}
