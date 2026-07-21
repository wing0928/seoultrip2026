import { useState } from 'react';
import { Navigation, Pencil, Plus, Trash2, X } from 'lucide-react';
import { GoogleReviewDialog } from '../components/GooglePlaceDetails.jsx';
import LinkButton from '../components/LinkButton.jsx';
import PlaceCard from '../components/PlaceCard.jsx';
import { enrichItinerary, periods } from '../data/itinerary.js';
import useGooglePlaceDetails from '../hooks/useGooglePlaceDetails.js';
import { hasCurrentGooglePhotoUrls, supportsGoogleDetails } from '../utils/googlePlaces.js';
import { routeMapUrl } from '../utils/maps.js';
import { formatPlaceType } from '../utils/placePresentation.js';

const emptyStop = {
  timeHours: '',
  timeMinutes: '',
  period: '上午',
  name: '',
  nameKo: '',
  nameZh: '',
  type: '景點',
  area: '',
  note: '',
  recommendationSource: '',
  sourceUrl: '',
  naverMapUrl: '',
  googleMapUrl: ''
};

const emptyDay = {
  date: '',
  title: '',
  areaFocus: '',
  note: ''
};

const emptyTransport = {
  mode: '地鐵',
  durationHours: '',
  durationMinutes: '',
  note: ''
};

const typeOptions = ['景點', '餐廳', '美食', '小吃', '咖啡廳', '商店', '購物中心', '逛街', '拍照點', '交通', '休息', '其他'];
const transportModes = ['地鐵', '公車', '步行', '計程車', 'AREX / 鐵路', '包車', '待確認'];
const periodLabels = {
  上午: '☀️ 上午',
  中午: '🍚 中午',
  下午: '🌤️ 下午',
  晚上: '🌙 晚上'
};

function shortDate(date = '') {
  const matched = String(date).match(/(\d{1,2})[/-](\d{1,2})$/);
  return matched ? `${Number(matched[1])}/${Number(matched[2])}` : date;
}

function showsGoogleDetails(place) {
  return supportsGoogleDetails(place) && Boolean(
    place.naverMapUrl || place.googleMapUrl || place.sourceUrl || place.recommendationSource
  );
}

export default function Itinerary({ trip, itinerary, setItinerary, wishlist = [] }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyStop);
  const [dayEditingId, setDayEditingId] = useState(null);
  const [dayForm, setDayForm] = useState(emptyDay);
  const [transportEditing, setTransportEditing] = useState(null);
  const [transportForm, setTransportForm] = useState(emptyTransport);
  const [selectedDayId, setSelectedDayId] = useState(() => itinerary[0]?.id || '');
  const [periodFilter, setPeriodFilter] = useState('全部');
  const [googleDialogPlace, setGoogleDialogPlace] = useState(null);
  const googleStops = itinerary.flatMap((day) => day.stops).filter(showsGoogleDetails);
  const { googleDetails, googleStatus, loadGoogleDetails } = useGooglePlaceDetails(googleStops);

  function startAdd(dayId, period = '上午', anchor = 'day') {
    const isSameAdd = editing?.mode === 'add' && editing.dayId === dayId && editing.period === period && editing.anchor === anchor;
    if (isSameAdd) {
      cancelEdit();
      return;
    }
    setEditing({ mode: 'add', dayId, period, anchor, stopId: null });
    setForm({ ...emptyStop, period });
  }

  function startEdit(dayId, stop) {
    if (editing?.mode === 'edit' && editing.stopId === stop.id) {
      cancelEdit();
      return;
    }
    setEditing({ mode: 'edit', dayId, period: stop.period, stopId: stop.id });
    const parsedTime = parseStopTime(stop.time);
    setForm({
      timeHours: parsedTime.hours,
      timeMinutes: parsedTime.minutes,
      period: stop.period || '上午',
      name: stop.name || '',
      nameKo: stop.nameKo || stop.koreanName || '',
      nameZh: stop.nameZh || stop.chineseName || '',
      type: stop.type || '景點',
      area: stop.area || '',
      note: stop.note || '',
      recommendationSource: stop.recommendationSource || '',
      sourceUrl: stop.sourceUrl || '',
      naverMapUrl: stop.naverMapUrl || '',
      googleMapUrl: stop.googleMapUrl || ''
    });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(emptyStop);
  }

  function startDayEdit(day) {
    if (dayEditingId === day.id) {
      cancelDayEdit();
      return;
    }
    setDayEditingId(day.id);
    setDayForm({
      date: day.date || '',
      title: day.title || '',
      areaFocus: day.areaFocus || '',
      note: day.note || ''
    });
  }

  function cancelDayEdit() {
    setDayEditingId(null);
    setDayForm(emptyDay);
  }

  function startTransportEdit(dayId, stop) {
    if (transportEditing?.dayId === dayId && transportEditing?.stopId === stop.id) {
      cancelTransportEdit();
      return;
    }
    setTransportEditing({ dayId, stopId: stop.id });
    setTransportForm({ ...emptyTransport, ...normalizeTransportForForm(stop.transportFromPrevious) });
  }

  function cancelTransportEdit() {
    setTransportEditing(null);
    setTransportForm(emptyTransport);
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applyWishlistItem(itemId) {
    if (!itemId) return;
    const item = wishlist.find((entry) => entry.id === itemId);
    if (!item) return;
    setForm((current) => ({
      ...current,
      name: item.name || item.nameZh || item.nameKo || '',
      nameKo: item.nameKo || item.koreanName || '',
      nameZh: item.nameZh || item.chineseName || '',
      type: item.type || current.type,
      area: item.area || '',
      note: item.note || item.reason || current.note,
      recommendationSource: item.recommendationSource || '',
      sourceUrl: item.sourceUrl || '',
      naverMapUrl: item.naverMapUrl || '',
      googleMapUrl: item.googleMapUrl || ''
    }));
  }

  function selectDay(dayId) {
    setSelectedDayId(dayId);
    setPeriodFilter('全部');
    cancelEdit();
    cancelDayEdit();
    cancelTransportEdit();
  }

  function selectPeriod(period) {
    setPeriodFilter(period);
    cancelEdit();
    cancelTransportEdit();
  }

  function openGoogleDialog(stop) {
    setGoogleDialogPlace(stop);
    const details = googleDetails[stop.id];
    if ((!details || !hasCurrentGooglePhotoUrls(details)) && googleStatus[stop.id] !== 'loading') {
      loadGoogleDetails(stop);
    }
  }

  function updateDayField(field, value) {
    setDayForm((current) => ({ ...current, [field]: value }));
  }

  function updateTransportField(field, value) {
    setTransportForm((current) => ({ ...current, [field]: value }));
  }

  function normalizeTransportForForm(transport = {}) {
    if (transport.durationHours || transport.durationMinutes) return transport;
    const duration = transport.duration || '';
    const hourMatch = duration.match(/(\d+)\s*(?:小時|hr|hour)/i);
    const minuteMatch = duration.match(/(\d+)\s*(?:分鐘|min|minute)/i);
    return {
      ...transport,
      durationHours: hourMatch?.[1] || '',
      durationMinutes: minuteMatch?.[1] || ''
    };
  }

  function formatDuration(hours, minutes) {
    const safeHours = String(hours || '').trim();
    const safeMinutes = String(minutes || '').trim();
    const parts = [];
    if (safeHours) parts.push(`${safeHours} 小時`);
    if (safeMinutes) parts.push(`${safeMinutes} 分鐘`);
    return parts.join(' ');
  }

  function parseStopTime(time = '') {
    const matched = String(time).match(/^(\d{1,2})(?::|時)\s*(\d{1,2})/);
    return {
      hours: matched?.[1] || '',
      minutes: matched?.[2] || ''
    };
  }

  function formatStopTime(hours, minutes) {
    if (hours === '' && minutes === '') return '';
    const safeHours = Math.min(23, Math.max(0, Number(hours) || 0));
    const safeMinutes = Math.min(59, Math.max(0, Number(minutes) || 0));
    return `${String(safeHours).padStart(2, '0')}:${String(safeMinutes).padStart(2, '0')}`;
  }

  function saveDay(event) {
    event.preventDefault();
    if (!dayEditingId || !dayForm.title.trim()) return;
    const nextDays = itinerary.map((day) => (
      day.id === dayEditingId
        ? {
            ...day,
            date: dayForm.date.trim() || day.date,
            title: dayForm.title.trim(),
            areaFocus: dayForm.areaFocus.trim(),
            note: dayForm.note.trim()
          }
        : day
    ));
    setItinerary(enrichItinerary(nextDays));
    cancelDayEdit();
  }

  function saveStop(event) {
    event.preventDefault();
    if (!editing || (!form.name.trim() && !form.nameKo.trim() && !form.nameZh.trim())) return;
    const nextDays = itinerary.map((day) => {
      if (day.id !== editing.dayId) return day;
      const { timeHours, timeMinutes, ...stopFields } = form;
      const nextStop = {
        ...stopFields,
        time: formatStopTime(timeHours, timeMinutes),
        id: editing.stopId || crypto.randomUUID(),
        name: form.name.trim() || form.nameZh.trim() || form.nameKo.trim(),
        nameKo: form.nameKo.trim(),
        nameZh: form.nameZh.trim(),
        area: form.area.trim() || '待確認',
        note: form.note.trim()
      };
      if (editing.mode === 'edit') {
        return {
          ...day,
          stops: day.stops.map((stop) => (stop.id === editing.stopId ? { ...stop, ...nextStop } : stop))
        };
      }
      return { ...day, stops: [...day.stops, nextStop] };
    });
    setItinerary(enrichItinerary(nextDays));
    cancelEdit();
  }

  function saveTransport(event) {
    event.preventDefault();
    if (!transportEditing) return;
    const transport = {
      mode: transportForm.mode,
      durationHours: String(transportForm.durationHours || '').trim(),
      durationMinutes: String(transportForm.durationMinutes || '').trim(),
      duration: formatDuration(transportForm.durationHours, transportForm.durationMinutes),
      note: transportForm.note.trim()
    };
    const nextDays = itinerary.map((day) => (
      day.id === transportEditing.dayId
        ? {
            ...day,
            stops: day.stops.map((stop) => (
              stop.id === transportEditing.stopId ? { ...stop, transportFromPrevious: transport } : stop
            ))
          }
        : day
    ));
    setItinerary(enrichItinerary(nextDays));
    cancelTransportEdit();
  }

  function deleteStop(dayId, stopId) {
    const nextDays = itinerary.map((day) => (
      day.id === dayId ? { ...day, stops: day.stops.filter((stop) => stop.id !== stopId) } : day
    ));
    setItinerary(enrichItinerary(nextDays));
  }

  function deleteTransport(dayId, stopId) {
    const nextDays = itinerary.map((day) => (
      day.id === dayId
        ? {
            ...day,
            stops: day.stops.map((stop) => {
              if (stop.id !== stopId) return stop;
              const { transportFromPrevious, ...rest } = stop;
              return rest;
            })
          }
        : day
    ));
    setItinerary(enrichItinerary(nextDays));
    cancelTransportEdit();
  }

  function stopEditor(title) {
    return (
      <div className="inline-editor">
        <div className="inline-editor-head solo">
          <h4>{title}</h4>
        </div>
        <form className="form-grid" onSubmit={saveStop}>
          {editing?.mode === 'add' && (
            <label className="full">
              從願望清單帶入
              <select onChange={(event) => applyWishlistItem(event.target.value)} defaultValue="" disabled={!wishlist.length}>
                <option value="">{wishlist.length ? '選擇願望清單景點' : '願望清單目前沒有資料'}</option>
                {wishlist.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.nameZh || item.nameKo} {item.area ? `｜${item.area}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>時段<select value={form.period} onChange={(event) => updateField('period', event.target.value)}>{periods.map((period) => <option key={period}>{period}</option>)}</select></label>
          <label>時間<div className="clock-grid"><input aria-label="小時" inputMode="numeric" min="0" max="23" type="number" value={form.timeHours} onChange={(event) => updateField('timeHours', event.target.value)} placeholder="時" /><span>時</span><input aria-label="分鐘" inputMode="numeric" min="0" max="59" type="number" value={form.timeMinutes} onChange={(event) => updateField('timeMinutes', event.target.value)} placeholder="分" /><span>分</span></div></label>
          <label>主要顯示名稱<input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="例如 景福宮" /></label>
          <label>韓文名稱<input value={form.nameKo} onChange={(event) => updateField('nameKo', event.target.value)} placeholder="例如 경복궁" /></label>
          <label>中文名稱<input value={form.nameZh} onChange={(event) => updateField('nameZh', event.target.value)} placeholder="例如 景福宮" /></label>
          <label>類型<select value={form.type} onChange={(event) => updateField('type', event.target.value)}>{typeOptions.map((type) => <option key={type} value={type}>{formatPlaceType(type)}</option>)}</select></label>
          <label>地區<input value={form.area} onChange={(event) => updateField('area', event.target.value)} placeholder="例如 弘大 / 聖水 / 漢南" /></label>
          <label className="full">地點簡述<textarea value={form.note} onChange={(event) => updateField('note', event.target.value)} placeholder="寫下必吃、交通、營業時間或排隊提醒" /></label>
          <button className="wide-button" type="submit">{editing?.mode === 'add' ? '新增到行程' : '儲存行程'}</button>
        </form>
      </div>
    );
  }

  function dayEditor() {
    return (
      <div className="inline-editor day-editor">
        <div className="inline-editor-head solo"><h4>編輯大主題</h4></div>
        <form className="form-grid" onSubmit={saveDay}>
          <label>日期<input value={dayForm.date} onChange={(event) => updateDayField('date', event.target.value)} placeholder="例如 2026/8/17" /></label>
          <label>區域標籤<input value={dayForm.areaFocus} onChange={(event) => updateDayField('areaFocus', event.target.value)} placeholder="例如 機場 / 住宿附近" /></label>
          <label className="full">大主題<input value={dayForm.title} onChange={(event) => updateDayField('title', event.target.value)} placeholder="例如 抵達首爾、機場交通、入住" /></label>
          <label className="full">說明<textarea value={dayForm.note} onChange={(event) => updateDayField('note', event.target.value)} placeholder="這一天的安排重點" /></label>
          <button className="wide-button" type="submit">儲存大主題</button>
        </form>
      </div>
    );
  }

  function transportEditor() {
    return (
      <div className="inline-editor transport-editor">
        <div className="inline-editor-head solo"><h4>編輯交通方式</h4></div>
        <form className="form-grid" onSubmit={saveTransport}>
          <label>交通方式<select value={transportForm.mode} onChange={(event) => updateTransportField('mode', event.target.value)}>{transportModes.map((mode) => <option key={mode}>{mode}</option>)}</select></label>
          <label>預估時間<div className="duration-grid"><input inputMode="numeric" min="0" type="number" value={transportForm.durationHours} onChange={(event) => updateTransportField('durationHours', event.target.value)} placeholder="小時" /><input inputMode="numeric" min="0" type="number" value={transportForm.durationMinutes} onChange={(event) => updateTransportField('durationMinutes', event.target.value)} placeholder="分鐘" /></div></label>
          <label className="full">備註<textarea value={transportForm.note} onChange={(event) => updateTransportField('note', event.target.value)} placeholder="例如 2 號線直達、轉乘一次、步行 8 分鐘" /></label>
          <button className="wide-button" type="submit">儲存交通方式</button>
        </form>
      </div>
    );
  }

  function transportBlock(dayId, previous, next) {
    const transport = next.transportFromPrevious;
    const isEditingTransport = transportEditing?.dayId === dayId && transportEditing?.stopId === next.id;
    const origin = `${previous.nameKo || previous.name} ${previous.area || ''}`.trim();
    const destination = `${next.nameKo || next.name} ${next.area || ''}`.trim();
    if (!transport && !isEditingTransport) {
      return <button className="mini-button transport-add" onClick={() => startTransportEdit(dayId, next)}><Plus size={15} /> 新增交通方式</button>;
    }
    return (
      <div className="transport-wrapper">
        {transport && (
          <div className="transport-card">
            <div>
              <p className="meta">交通方式</p>
              <strong>{previous.name} → {next.name}</strong>
              <span>{transport.mode}{transport.duration ? ` · ${transport.duration}` : ''}</span>
              {transport.note && <span>{transport.note}</span>}
            </div>
            <div className="button-row"><LinkButton href={routeMapUrl(origin, destination)}><Navigation size={16} /> 查路線</LinkButton></div>
            <div className="action-row">
              <button onClick={() => startTransportEdit(dayId, next)}>{isEditingTransport ? <X size={17} /> : <Pencil size={17} />}{isEditingTransport ? '關閉' : '編輯'}</button>
              <button className="danger" onClick={() => deleteTransport(dayId, next.id)}><Trash2 size={17} /> 刪除</button>
            </div>
          </div>
        )}
        {isEditingTransport && transportEditor()}
      </div>
    );
  }

  const selectedDay = itinerary.find((day) => day.id === selectedDayId) || itinerary[0];
  const selectedDayIndex = itinerary.findIndex((day) => day.id === selectedDay?.id);
  const visiblePeriods = selectedDay
    ? (periodFilter === '全部'
        ? periods.filter((period) => (
            selectedDay.stops.some((stop) => stop.period === period)
            || (editing?.mode === 'add' && editing.dayId === selectedDay.id && editing.period === period)
          ))
        : [periodFilter])
    : [];

  if (!selectedDay) return <p className="empty">目前沒有行程資料。</p>;

  return (
    <div className="stack itinerary-page">
      <div className="wishlist-toolbar itinerary-toolbar">
        <div>
          <p className="eyebrow">Itinerary</p>
          <h2>{trip.tripName} 行程</h2>
        </div>
        <div className="wishlist-toolbar-actions">
          <button className="wide-button secondary toolbar-button" onClick={() => startDayEdit(selectedDay)}><Pencil size={18} /> 編輯主題</button>
          <button className="wide-button toolbar-button" onClick={() => startAdd(selectedDay.id, periodFilter === '全部' ? '上午' : periodFilter, 'day')}><Plus size={18} /> 新增行程</button>
        </div>
      </div>

      <div className="wishlist-filter-panel itinerary-filter-panel" aria-label="行程篩選">
        <div className="filter-scroll-track itinerary-day-track" role="tablist" aria-label="選擇日期">
          {itinerary.map((day, index) => (
            <button
              key={day.id}
              className={selectedDay.id === day.id ? 'active' : ''}
              aria-selected={selectedDay.id === day.id}
              role="tab"
              title={day.title}
              onClick={() => selectDay(day.id)}
            >
              第 {index + 1} 天 · {shortDate(day.date)}
            </button>
          ))}
        </div>
        <div className="filter-scroll-track" role="group" aria-label="依時段篩選">
          <button className={periodFilter === '全部' ? 'active' : ''} aria-pressed={periodFilter === '全部'} onClick={() => selectPeriod('全部')}>🗓️ 全部時段</button>
          {periods.map((period) => (
            <button key={period} className={periodFilter === period ? 'active' : ''} aria-pressed={periodFilter === period} onClick={() => selectPeriod(period)}>{periodLabels[period]}</button>
          ))}
        </div>
      </div>

      <section className="itinerary-day-summary" aria-labelledby={`day-title-${selectedDay.id}`}>
        <div className="day-head">
          <div><p className="meta">第 {selectedDayIndex + 1} 天 · {selectedDay.date}</p><h2 id={`day-title-${selectedDay.id}`}>{selectedDay.title}</h2></div>
          <span>{selectedDay.areaFocus}</span>
        </div>
        {selectedDay.note && <p className="day-note">{selectedDay.note}</p>}
        {dayEditingId === selectedDay.id && dayEditor()}
        {editing?.mode === 'add' && editing.dayId === selectedDay.id && editing.anchor === 'day' && stopEditor('新增行程')}
      </section>

      <div className="itinerary-period-list">
        {visiblePeriods.map((period) => {
          const stops = selectedDay.stops.filter((stop) => stop.period === period);
          const isAddingHere = editing?.mode === 'add' && editing.dayId === selectedDay.id && editing.period === period && editing.anchor === 'period';
          return (
            <section className="itinerary-period-section" key={period}>
              <div className="period-head">
                <div><p className="eyebrow">{period}</p><h3>{periodLabels[period]}行程</h3></div>
                <button className="mini-button" onClick={() => startAdd(selectedDay.id, period, 'period')}><Plus size={15} /> 新增</button>
              </div>
              {isAddingHere && stopEditor(`新增${period}行程`)}
              <div className="place-list itinerary-list">
                {stops.map((stop) => {
                  const stopIndex = selectedDay.stops.findIndex((item) => item.id === stop.id);
                  const previous = stopIndex > 0 ? selectedDay.stops[stopIndex - 1] : null;
                  const isEditingThisStop = editing?.mode === 'edit' && editing.stopId === stop.id;
                  return (
                    <div className="editable-place" key={stop.id}>
                      {previous && transportBlock(selectedDay.id, previous, stop)}
                      <PlaceCard
                        place={stop}
                        googleDetails={googleDetails[stop.id]}
                        googleStatus={googleStatus[stop.id]}
                        showGoogleDetails={showsGoogleDetails(stop)}
                        onOpenGoogle={() => openGoogleDialog(stop)}
                        actions={<><button onClick={() => startEdit(selectedDay.id, stop)}>{isEditingThisStop ? <X size={17} /> : <Pencil size={17} />}{isEditingThisStop ? '關閉' : '編輯'}</button><button className="danger" onClick={() => deleteStop(selectedDay.id, stop.id)}><Trash2 size={17} /> 刪除</button></>}
                      />
                      {isEditingThisStop && stopEditor('編輯行程')}
                    </div>
                  );
                })}
                {!stops.length && <p className="empty inline">這個時段還沒有行程。</p>}
              </div>
            </section>
          );
        })}
        {!visiblePeriods.length && <p className="empty">這一天還沒有行程。</p>}
      </div>

      <GoogleReviewDialog
        place={googleDialogPlace}
        details={googleDialogPlace ? googleDetails[googleDialogPlace.id] : null}
        status={googleDialogPlace ? googleStatus[googleDialogPlace.id] : ''}
        onClose={() => setGoogleDialogPlace(null)}
        onRefresh={() => loadGoogleDetails(googleDialogPlace, true)}
      />
    </div>
  );
}
