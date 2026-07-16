import { CalendarDays, Heart, ListChecks, Plane, Route } from 'lucide-react';
import InfoCard from '../components/InfoCard.jsx';
import LinkButton from '../components/LinkButton.jsx';

const quickLinks = [
  { id: 'itinerary', label: '每日行程', icon: CalendarDays },
  { id: 'wishlist', label: '願望清單', icon: Heart },
  { id: 'overview', label: '行程總覽', icon: ListChecks },
  { id: 'transport', label: '交通資訊', icon: Route }
];

export default function Dashboard({ trip, setActivePage }) {
  return (
    <div className="stack">
      <section className="hero-card">
        <p className="eyebrow">Seoul Trip 2026</p>
        <h2>{trip.tripName}</h2>
        <p>{trip.dates} · {trip.nights}</p>
        <div className="hero-tags">
          <span>首爾自由行</span>
          <span>手機導航版</span>
          <span>旅行手帳</span>
        </div>
      </section>

      <div className="quick-grid">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className="quick-card" onClick={() => setActivePage(item.id)}>
              <Icon size={22} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <InfoCard title="住宿資訊">
        <dl className="detail-list">
          <div><dt>飯店名稱</dt><dd>{trip.hotelName}</dd></div>
          <div><dt>地址</dt><dd>{trip.hotelAddress}</dd></div>
          <div><dt>Naver Map</dt><dd><LinkButton href={trip.hotelMapUrl}>開啟飯店地圖</LinkButton></dd></div>
        </dl>
      </InfoCard>

      <InfoCard title="航班資訊" action={<Plane size={20} />}>
        <dl className="detail-list">
          <div><dt>去程航班</dt><dd>{trip.outboundFlight}</dd></div>
          <div><dt>回程航班</dt><dd>{trip.returnFlight}</dd></div>
          <div><dt>抵達機場</dt><dd>{trip.arrivalAirport}</dd></div>
          <div><dt>離開機場</dt><dd>{trip.departureAirport}</dd></div>
        </dl>
      </InfoCard>
    </div>
  );
}
