import { ExternalLink } from 'lucide-react';
import InfoCard from '../components/InfoCard.jsx';
import LinkButton from '../components/LinkButton.jsx';
import { makeDailyRoutes } from '../data/itinerary.js';
import { routeMapUrl, searchMapUrl } from '../utils/maps.js';

const mapTools = ['Naver Map', 'Kakao Map', 'T-money / WOWPASS / 交通卡'];

export default function Transport({ trip, itinerary }) {
  const scenicStops = itinerary
    .flatMap((day) => day.stops)
    .filter((stop) => ['景點', '逛街', '美食', '咖啡廳', '拍照點'].includes(stop.type));
  const dailyRoutes = makeDailyRoutes(itinerary);

  return (
    <div className="stack">
      <InfoCard title="機場到住宿">
        <p className="soft-text">住宿與航班目前先用 placeholder。等你補上飯店地址後，可以在設定頁更新，這裡就能直接開飯店地圖。</p>
        <dl className="detail-list">
          <div><dt>飯店</dt><dd>{trip.hotelName}</dd></div>
          <div><dt>地址</dt><dd>{trip.hotelAddress}</dd></div>
          <div><dt>抵達機場</dt><dd>{trip.arrivalAirport}</dd></div>
          <div><dt>飯店地圖</dt><dd><LinkButton href={trip.hotelMapUrl}>開啟</LinkButton></dd></div>
        </dl>
      </InfoCard>

      <InfoCard title="住宿到景點快速連結">
        <div className="route-grid">
          {scenicStops.slice(0, 12).map((stop) => (
            <a key={stop.id} href={routeMapUrl(trip.hotelAddress === '待補' ? '首爾' : trip.hotelAddress, `${stop.name} ${stop.area}`)} target="_blank" rel="noreferrer">
              <span>{stop.name}</span>
              <ExternalLink size={15} />
            </a>
          ))}
        </div>
      </InfoCard>

      <InfoCard title="每天主要移動路線">
        <div className="route-list">
          {dailyRoutes.map((day) => (
            <article key={day.date}>
              <strong>{day.date} · {day.title}</strong>
              <p>{day.route}</p>
            </article>
          ))}
        </div>
      </InfoCard>

      <InfoCard title="常用交通工具">
        <div className="chip-list">
          {mapTools.map((tool) => <span key={tool}>{tool}</span>)}
        </div>
        <div className="button-row">
          <LinkButton href={searchMapUrl('서울역')}>Naver Map 搜尋首爾</LinkButton>
        </div>
      </InfoCard>
    </div>
  );
}
