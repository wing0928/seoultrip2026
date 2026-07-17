import { useState } from 'react';
import { Navigation, Pencil, Plus, Trash2, X } from 'lucide-react';
import InfoCard from '../components/InfoCard.jsx';
import LinkButton from '../components/LinkButton.jsx';
import PlaceCard from '../components/PlaceCard.jsx';
import { enrichItinerary, periods } from '../data/itinerary.js';
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
  note: ''
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

const typeOptions = ['景點', '美食', '咖啡廳', '逛街', '拍照點', '交通', '休息', '其他'];
const transportModes = ['地鐵', '公車', '步行', '計程車', 'AREX / 鐵路', '包車', '待確認'];

export default function Itinerary({ trip, itinerary, setItinerary, wishlist = [] }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyStop);
  const [dayEditingId, setDayEditingId] = useState(null);
  const [dayForm, setDayForm] = useState(emptyDay);
  const [transportEditing, setTransportEditing] = useState(null);
  const [transportForm, setTransportForm] = useState(emptyTransport);

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
      note: stop.note || ''
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
      note: item.note || item.reason || current.note
    }));
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

  return (
    <div className="stack">
      <InfoCard title={`${trip.tripName} 行程草稿`}>
        <p className="soft-text">行程頁與總覽頁共用同一份資料；新增、修改行程或名稱後，總覽頁會同步更新。</p>
      </InfoCard>
      {itinerary.map((day) => (
        <section className="day-section" key={day.id}>
          <div className="day-head"><div><p className="meta">{day.date}</p><h2>{day.title}</h2></div><span>{day.areaFocus}</span></div>
          <p className="day-note">{day.note}</p>
          <div className="day-actions">
            <button className="wide-button secondary" onClick={() => startAdd(day.id)}><Plus size={18} /> 新增這天的行程</button>
            <button className="wide-button secondary" onClick={() => startDayEdit(day)}><Pencil size={18} /> {dayEditingId === day.id ? '關閉大主題編輯' : '編輯大主題'}</button>
          </div>
          {dayEditingId === day.id && dayEditor()}
          {editing?.mode === 'add' && editing.dayId === day.id && editing.anchor === 'day' && stopEditor('新增行程')}
          {periods.map((period) => {
            const stops = day.stops.filter((stop) => stop.period === period);
            const isAddingHere = editing?.mode === 'add' && editing.dayId === day.id && editing.period === period && editing.anchor === 'period';
            return (
              <div className="period-block" key={period}>
                <div className="period-head"><h3>{period}</h3><button className="mini-button" onClick={() => startAdd(day.id, period, 'period')}><Plus size={15} /> 新增</button></div>
                {isAddingHere && stopEditor(`新增${period}行程`)}
                <div className="place-list">
                  {stops.map((stop) => {
                    const stopIndex = day.stops.findIndex((item) => item.id === stop.id);
                    const previous = stopIndex > 0 ? day.stops[stopIndex - 1] : null;
                    const isEditingThisStop = editing?.mode === 'edit' && editing.stopId === stop.id;
                    return (
                      <div className="editable-place" key={stop.id}>
                        {previous && transportBlock(day.id, previous, stop)}
                        <PlaceCard
                          place={stop}
                          actions={<><button onClick={() => startEdit(day.id, stop)}>{isEditingThisStop ? <X size={17} /> : <Pencil size={17} />}{isEditingThisStop ? '關閉' : '編輯'}</button><button className="danger" onClick={() => deleteStop(day.id, stop.id)}><Trash2 size={17} /> 刪除</button></>}
                        />
                        {isEditingThisStop && stopEditor('編輯行程')}
                      </div>
                    );
                  })}
                  {!stops.length && <p className="empty inline">這個時段還沒有行程。</p>}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
