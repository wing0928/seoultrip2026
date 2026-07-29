import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, CircleCheck, Clock3, Copy, Navigation } from 'lucide-react';
import NaverMapButton from '../components/NaverMapButton.jsx';
import { findNextStop, getSeoulNow, selectTripDay } from '../utils/tripTime.js';

export default function Dashboard({ trip, itinerary, onOpenItinerary }) {
  const [now, setNow] = useState(() => new Date());
  const [copiedId, setCopiedId] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const seoulNow = useMemo(() => getSeoulNow(now), [now]);
  const selection = useMemo(() => selectTripDay(itinerary, now), [itinerary, now]);
  const nextStop = useMemo(
    () => findNextStop(selection.day, now, selection.phase),
    [now, selection.day, selection.phase]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!copiedId) return undefined;
    const timer = window.setTimeout(() => {
      setCopiedId('');
      setCopyMessage('');
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  async function copyKorean(stop) {
    const korean = String(stop?.nameKo || stop?.koreanName || '').trim();
    if (!korean) return;
    try {
      await navigator.clipboard.writeText(korean);
      setCopiedId(stop.id);
      setCopyMessage(`已複製 ${korean}`);
    } catch {
      setCopyMessage('無法複製，請長按韓文名稱手動複製');
    }
  }

  if (!selection.day) return <p className="empty">目前沒有可顯示的行程。</p>;

  const phaseLabel = {
    today: `今天是旅行第 ${selection.index + 1} 天`,
    upcoming: `距離出發 ${selection.daysUntil} 天 · 預覽第 ${selection.index + 1} 天`,
    finished: '旅程已結束 · 回顧最後一天'
  }[selection.phase];

  return (
    <div className="stack today-page">
      <section className="today-hero">
        <div className="today-hero-copy">
          <p className="eyebrow">韓國標準時間 KST</p>
          <h2>{seoulNow.timeLabel}</h2>
          <p>{seoulNow.dateLabel} · {seoulNow.weekday}</p>
        </div>
        <Clock3 size={34} aria-hidden="true" />
      </section>

      <section className="today-day-card" aria-labelledby="today-day-title">
        <div className="today-day-head">
          <div>
            <p className="today-phase"><CalendarClock size={16} /> {phaseLabel}</p>
            <p className="meta">{selection.day.date}</p>
            <h2 id="today-day-title">{selection.day.title}</h2>
          </div>
          <span>{selection.day.areaFocus}</span>
        </div>
        {selection.day.note && <p className="day-note">{selection.day.note}</p>}
      </section>

      <section className="next-stop-card" aria-labelledby="next-stop-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Next stop</p>
            <h2 id="next-stop-title">{nextStop ? '下一站' : '今日進度'}</h2>
          </div>
          {nextStop?.time && <time>{nextStop.time}</time>}
        </div>

        {nextStop ? (
          <>
            <h3>{nextStop.nameZh || nextStop.name}</h3>
            {nextStop.nameKo && <p className="korean-name" lang="ko">{nextStop.nameKo}</p>}
            {nextStop.note && <p className="soft-text">{nextStop.note}</p>}
            <div className="today-primary-actions">
              <NaverMapButton place={nextStop} variant="primary">
                <Navigation size={18} />
                開始導航
              </NaverMapButton>
              {nextStop.nameKo && (
                <button type="button" className={`copy-korean-button ${copiedId === nextStop.id ? 'success' : ''}`} onClick={() => copyKorean(nextStop)}>
                  {copiedId === nextStop.id ? <CircleCheck size={18} /> : <Copy size={18} />}
                  {copiedId === nextStop.id ? '已複製韓文' : '複製韓文'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="today-complete">
            <CircleCheck size={24} />
            <div>
              <strong>{selection.phase === 'finished' ? '旅程已完成' : '今天的行程已完成'}</strong>
              <p>可以到行程頁回顧或調整安排。</p>
            </div>
          </div>
        )}
        {copyMessage && <p className={`copy-status ${copiedId ? 'success' : ''}`} role="status">{copyMessage}</p>}
      </section>

      <section className="today-timeline" aria-labelledby="today-timeline-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Day plan</p>
            <h2 id="today-timeline-title">當日行程</h2>
          </div>
          <button type="button" className="text-button" onClick={() => onOpenItinerary(selection.day.id)}>
            完整行程 <ArrowRight size={17} />
          </button>
        </div>
        <ol>
          {selection.day.stops.map((stop) => {
            const isNext = nextStop?.id === stop.id;
            return (
              <li key={stop.id} className={isNext ? 'next' : ''}>
                <time>{stop.time || '--:--'}</time>
                <span className="timeline-dot" aria-hidden="true" />
                <div>
                  <strong>{stop.nameZh || stop.name}</strong>
                  {stop.nameKo && <small lang="ko">{stop.nameKo}</small>}
                  <span>{stop.period} · {stop.area}</span>
                </div>
                {stop.nameKo && (
                  <button type="button" onClick={() => copyKorean(stop)} aria-label={`複製 ${stop.nameKo}`}>
                    {copiedId === stop.id ? <CircleCheck size={18} /> : <Copy size={17} />}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
