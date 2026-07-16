import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MessagesSquare, Pencil, Plus, RefreshCw, Sparkles, Star, Trash2, X } from 'lucide-react';
import DistrictExplorer from '../components/DistrictExplorer.jsx';
import LinkButton from '../components/LinkButton.jsx';
import { districtForArea, districts } from '../data/districts.js';
import { parseBulkPlaces } from '../utils/bulkPlaceParser.js';
import { googleMapUrl, placeMapUrl, searchMapUrl } from '../utils/maps.js';
import { getGooglePlaceDetails, googlePlacesConfigured, hasCurrentGooglePhotoUrls, supportsGoogleDetails } from '../utils/googlePlaces.js';

const emptyForm = {
  nameKo: '',
  nameZh: '',
  type: '景點',
  area: '其他',
  sourceUrl: '',
  recommendationSource: '',
  naverMapUrl: '',
  note: '',
  priority: '想去',
  visited: false
};

const emptyBulk = { text: '', sourceUrl: '', recommendationSource: '' };
const types = ['景點', '餐廳', '美食', '小吃', '咖啡廳', '商店', '購物中心', '逛街', '拍照點', '其他'];
const priorities = ['必去', '想去', '有空再去'];

export default function Wishlist({ wishlist, setWishlist }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('全部');
  const [areaFilter, setAreaFilter] = useState('全部');
  const [selectedDistrictId, setSelectedDistrictId] = useState('myeongdong');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(emptyBulk);
  const [bulkPreview, setBulkPreview] = useState([]);
  const [googleDetails, setGoogleDetails] = useState({});
  const [googleStatus, setGoogleStatus] = useState({});
  const [googleDialogPlace, setGoogleDialogPlace] = useState(null);

  const areaOptions = useMemo(() => ['全部', ...districts.map((district) => district.name)], []);
  const filtered = wishlist.filter((item) => {
    const normalizedArea = districtForArea(item.area).name;
    return (typeFilter === '全部' || item.type === typeFilter) && (areaFilter === '全部' || normalizedArea === areaFilter);
  });
  const googleItemsKey = useMemo(() => wishlist
    .filter(supportsGoogleDetails)
    .map((item) => `${item.id}:${item.nameKo || item.nameZh || item.name}:${item.area}`)
    .join('|'), [wishlist]);

  useEffect(() => {
    if (!googlePlacesConfigured) return undefined;
    let cancelled = false;
    const eligibleItems = wishlist.filter(supportsGoogleDetails);

    async function hydrateRatings() {
      for (const item of eligibleItems) {
        if (cancelled) return;
        setGoogleStatus((current) => ({ ...current, [item.id]: 'loading' }));
        try {
          const details = await getGooglePlaceDetails(item);
          if (cancelled) return;
          setGoogleDetails((current) => ({ ...current, [item.id]: details }));
          setGoogleStatus((current) => ({ ...current, [item.id]: 'ready' }));
        } catch (error) {
          if (cancelled) return;
          setGoogleStatus((current) => ({ ...current, [item.id]: error.code || 'error' }));
        }
      }
    }

    hydrateRatings();
    return () => { cancelled = true; };
  }, [googleItemsKey]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectFormArea(district) {
    updateField('area', district.name);
    setSelectedDistrictId(district.id);
  }

  function openNewEditor() {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedDistrictId('other');
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function submit(event) {
    event.preventDefault();
    if (!form.nameKo.trim() && !form.nameZh.trim()) return;

    const item = {
      ...form,
      name: '',
      nameKo: form.nameKo.trim(),
      nameZh: form.nameZh.trim(),
      id: editingId || crypto.randomUUID(),
      mapUrl: form.naverMapUrl || searchMapUrl(`${form.nameKo || form.nameZh} ${form.area} 서울`)
    };

    setWishlist((items) => editingId ? items.map((old) => old.id === editingId ? { ...old, ...item } : old) : [item, ...items]);
    closeEditor();
  }

  function edit(item) {
    const district = districtForArea(item.area);
    setEditingId(item.id);
    setForm({
      ...emptyForm,
      ...item,
      area: district.name,
      nameKo: item.nameKo || item.koreanName || '',
      nameZh: item.nameZh || item.chineseName || item.name || '',
      naverMapUrl: /(?:naver\.com|naver\.me)/i.test(item.naverMapUrl || '') ? item.naverMapUrl : (item.mapUrl?.includes('naver.com') ? item.mapUrl : '')
    });
    setSelectedDistrictId(district.id);
    setEditorOpen(true);
  }

  function previewBulk() {
    setBulkPreview(parseBulkPlaces(bulkForm));
  }

  function addBulk() {
    if (!bulkPreview.length) return;
    setWishlist((items) => [...bulkPreview, ...items]);
    setBulkForm(emptyBulk);
    setBulkPreview([]);
    setBulkOpen(false);
  }

  function closeBulk() {
    setBulkOpen(false);
    setBulkPreview([]);
  }

  async function loadGoogleDetails(item, refresh = false) {
    if (!googlePlacesConfigured) return;
    setGoogleStatus((current) => ({ ...current, [item.id]: 'loading' }));
    try {
      const details = await getGooglePlaceDetails(item, { refresh });
      setGoogleDetails((current) => ({ ...current, [item.id]: details }));
      setGoogleStatus((current) => ({ ...current, [item.id]: 'ready' }));
    } catch (error) {
      setGoogleStatus((current) => ({ ...current, [item.id]: error.code || 'error' }));
    }
  }

  function openGoogleDialog(item) {
    setGoogleDialogPlace(item);
    const details = googleDetails[item.id];
    if ((!details || !hasCurrentGooglePhotoUrls(details)) && googleStatus[item.id] !== 'loading') {
      loadGoogleDetails(item);
    }
  }

  return (
    <div className="stack">
      <DistrictExplorer selectedId={selectedDistrictId} onSelect={setSelectedDistrictId} />

      <div className="wishlist-toolbar">
        <div>
          <p className="eyebrow">Wish list</p>
          <h2>想去的地方</h2>
        </div>
        <div className="wishlist-toolbar-actions">
          <button className="wide-button secondary toolbar-button" onClick={openNewEditor}><Plus size={18} /> 新增景點</button>
          <button className="wide-button toolbar-button" onClick={() => setBulkOpen(true)}><Sparkles size={18} /> 加入大量景點</button>
        </div>
      </div>

      <div className="filter-row">
        <select aria-label="依類型篩選" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>全部</option>{types.map((type) => <option key={type}>{type}</option>)}</select>
        <select aria-label="依地區篩選" value={areaFilter} onChange={(event) => { setAreaFilter(event.target.value); if (event.target.value !== '全部') setSelectedDistrictId(districtForArea(event.target.value).id); }}>{areaOptions.map((area) => <option key={area}>{area}</option>)}</select>
      </div>

      <div className="place-list wishlist-list">
        {filtered.map((item) => {
          const displayName = item.nameZh || item.chineseName || item.nameKo || item.koreanName || item.name;
          const district = districtForArea(item.area);
          const details = googleDetails[item.id];
          const status = googleStatus[item.id];
          const supportsDetails = supportsGoogleDetails(item);
          return (
            <article className={`place-card ${item.visited ? 'visited' : ''}`} key={item.id}>
              <div className="place-card-body">
                <div className="place-top">
                  <div>
                    <p className="meta">{item.priority}</p>
                    <h3>{displayName}</h3>
                    {item.nameKo && item.nameKo !== displayName && <p className="name-subtitle">{item.nameKo}</p>}
                  </div>
                  <span className={`type-pill type-${item.type}`}>{item.type}</span>
                </div>
                <button className="place-area-tag" style={{ '--tag-color': district.color }} onClick={() => setSelectedDistrictId(district.id)}>#{district.name}</button>
                {item.recommendationSource && <p className="recommendation-source">推薦來源：{item.recommendationSource}</p>}
                {item.note && <p>{item.note}</p>}
                {supportsDetails && (
                  <div className="google-rating-strip" aria-label="Google 星等">
                    <Star size={18} fill={details?.rating ? 'currentColor' : 'none'} />
                    <strong>{details?.rating ? details.rating.toFixed(1) : '—'}</strong>
                    <span>{details?.userRatingCount ? `${details.userRatingCount.toLocaleString()} 則 Google 評價` : (status === 'loading' ? '載入 Google 評價中' : 'Google 星等尚未取得')}</span>
                  </div>
                )}

                <div className="button-row">
                  <LinkButton href={placeMapUrl(item)}>Naver Map</LinkButton>
                  <LinkButton href={googleMapUrl(item)}>Google Maps</LinkButton>
                  {supportsDetails && <button className="link-button ghost" onClick={() => openGoogleDialog(item)}><MessagesSquare size={17} /> Google 評價</button>}
                  <LinkButton href={item.sourceUrl}>來源</LinkButton>
                </div>
                <div className="action-row">
                  <button onClick={() => setWishlist((items) => items.map((old) => old.id === item.id ? { ...old, visited: !old.visited } : old))}><CheckCircle2 size={17} /> {item.visited ? '取消已去' : '標記已去'}</button>
                  <button onClick={() => edit(item)}><Pencil size={17} /> 編輯</button>
                  <button className="danger" onClick={() => setWishlist((items) => items.filter((old) => old.id !== item.id))}><Trash2 size={17} /> 刪除</button>
                </div>
              </div>
            </article>
          );
        })}
        {!filtered.length && <p className="empty">還沒有符合條件的願望。先加一個吧。</p>}
      </div>

      {googleDialogPlace && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setGoogleDialogPlace(null)}>
          <section className="bulk-dialog google-review-dialog" role="dialog" aria-modal="true" aria-labelledby="google-review-title">
            <div className="dialog-head">
              <div><p className="eyebrow">Google Places</p><h2 id="google-review-title">{googleDialogPlace.nameZh || googleDialogPlace.nameKo || googleDialogPlace.name}</h2></div>
              <button className="icon-button" onClick={() => setGoogleDialogPlace(null)} aria-label="關閉"><X size={20} /></button>
            </div>
            {!googlePlacesConfigured ? (
              <div className="google-empty-state"><Star size={24} /><strong>尚未連接 Google Places</strong><span>完成 Supabase Edge Function 設定後即可顯示星等與照片。</span></div>
            ) : googleStatus[googleDialogPlace.id] === 'loading' ? (
              <div className="google-empty-state"><RefreshCw className="spin" size={24} /><strong>正在載入 Google 評價</strong></div>
            ) : googleDetails[googleDialogPlace.id] ? (
              <GoogleReviewContent
                details={googleDetails[googleDialogPlace.id]}
                fallbackMapUrl={googleMapUrl(googleDialogPlace)}
                onRefresh={() => loadGoogleDetails(googleDialogPlace, true)}
              />
            ) : (
              <div className="google-empty-state"><Star size={24} /><strong>找不到相符的 Google 店家資料</strong><button className="mini-button" onClick={() => loadGoogleDetails(googleDialogPlace, true)}><RefreshCw size={16} /> 再試一次</button></div>
            )}
          </section>
        </div>
      )}

      {editorOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeEditor()}>
          <section className="bulk-dialog editor-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-title">
            <div className="dialog-head">
              <div><p className="eyebrow">Wish editor</p><h2 id="editor-title">{editingId ? '編輯願望' : '新增想去的地方'}</h2></div>
              <button className="icon-button" onClick={closeEditor} aria-label="關閉"><X size={20} /></button>
            </div>
            <form className="form-grid spacious-form dialog-form" onSubmit={submit}>
              <label>中文名稱<input value={form.nameZh} onChange={(event) => updateField('nameZh', event.target.value)} placeholder="例如：滿杯阿里郎包飯本店" /></label>
              <label>韓文名稱<input value={form.nameKo} onChange={(event) => updateField('nameKo', event.target.value)} placeholder="例如：만배아리랑보쌈 본점" /></label>
              <label>類型<select value={form.type} onChange={(event) => updateField('type', event.target.value)}>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>優先度<select value={form.priority} onChange={(event) => updateField('priority', event.target.value)}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label>
              <fieldset className="area-fieldset full">
                <legend>地區</legend>
                <div className="area-tag-options">
                  {districts.map((district) => (
                    <button key={district.id} type="button" className={form.area === district.name ? 'active' : ''} style={{ '--tag-color': district.color }} onClick={() => selectFormArea(district)}>#{district.name}</button>
                  ))}
                </div>
              </fieldset>
              <label>推薦來源<input value={form.recommendationSource} onChange={(event) => updateField('recommendationSource', event.target.value)} placeholder="例如：家人、Threads 帳號、旅遊部落客" /></label>
              <label>來源連結<input value={form.sourceUrl} onChange={(event) => updateField('sourceUrl', event.target.value)} placeholder="貼上 Reels / Threads / 網頁" /></label>
              <label className="full">Naver Map 連結<input value={form.naverMapUrl} onChange={(event) => updateField('naverMapUrl', event.target.value)} placeholder="可留空，自動用韓文名稱搜尋" /></label>
              <label className="full">備註<textarea value={form.note} onChange={(event) => updateField('note', event.target.value)} placeholder="營業時間、必點、排隊提醒..." /></label>
              <button className="wide-button full" type="submit"><Plus size={18} /> {editingId ? '儲存修改' : '加入願望清單'}</button>
            </form>
          </section>
        </div>
      )}

      {bulkOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeBulk()}>
          <section className="bulk-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-title">
            <div className="dialog-head">
              <div><p className="eyebrow">Place organizer agent</p><h2 id="bulk-title">加入大量景點</h2></div>
              <button className="icon-button" onClick={closeBulk} aria-label="關閉"><X size={20} /></button>
            </div>
            <p className="soft-text">各景點間空兩行並以 1.、2.、3. 編號。整理 agent 會擷取編號後的店名、地圖連結、地區與備註。</p>
            <div className="form-grid">
              <label>推薦來源<input value={bulkForm.recommendationSource} onChange={(event) => setBulkForm((current) => ({ ...current, recommendationSource: event.target.value }))} placeholder="例如：OO 的首爾清單" /></label>
              <label>來源連結<input value={bulkForm.sourceUrl} onChange={(event) => setBulkForm((current) => ({ ...current, sourceUrl: event.target.value }))} placeholder="https://..." /></label>
              <label className="full">商店／景點清單<textarea className="bulk-textarea" value={bulkForm.text} onChange={(event) => setBulkForm((current) => ({ ...current, text: event.target.value }))} placeholder={'1. 능동미나리성수점\nhttps://naver.me/example\n餐點與其他備註\n\n\n2. Pizzeria Marione 마리오네\nhttps://maps.app.goo.gl/example\n其他備註'} /></label>
            </div>
            {bulkPreview.length > 0 && (
              <div className="bulk-preview">
                <div className="bulk-preview-head"><strong>已整理 {bulkPreview.length} 個地點</strong><span>優先度可在加入後編輯</span></div>
                <ol>{bulkPreview.map((item) => <li key={item.id}><span>{item.nameZh || item.nameKo}</span><small>{item.nameKo && item.nameKo !== item.nameZh ? `${item.nameKo} · ` : ''}#{districtForArea(item.area).name} · {item.type}{item.naverMapUrl ? ' · Naver' : ''}{item.googleMapUrl ? ' · Google' : ''}</small></li>)}</ol>
              </div>
            )}
            <div className="dialog-actions">
              <button className="wide-button secondary" onClick={previewBulk}><Sparkles size={18} /> 整理並預覽</button>
              <button className="wide-button" onClick={addBulk} disabled={!bulkPreview.length}><Plus size={18} /> 加入 {bulkPreview.length || ''} 個地點</button>
            </div>
          </section>
        </div>
      )}
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
