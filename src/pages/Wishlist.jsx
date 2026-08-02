import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, LoaderCircle, Pencil, Plus, Search, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { GoogleReviewDialog } from '../components/GooglePlaceDetails.jsx';
import PlaceCard from '../components/PlaceCard.jsx';
import UndoToast from '../components/UndoToast.jsx';
import { districtForArea, districts } from '../data/districts.js';
import { CLOTHING_SUBTAGS, PLACE_TYPES, WISHLIST_PRIORITIES } from '../data/placeTypes.js';
import useGooglePlaceDetails from '../hooks/useGooglePlaceDetails.js';
import { parseBulkPlaces } from '../utils/bulkPlaceParser.js';
import { enrichPlaceIdentity, hasCurrentGooglePhotoUrls } from '../utils/googlePlaces.js';
import { searchMapUrl } from '../utils/maps.js';
import { formatPlaceName, formatPlaceType, normalizePlaceType, placeTypeEmoji } from '../utils/placePresentation.js';
import { matchesWishlistQuery } from '../utils/wishlistSearch.js';
import { extractPlacesFromScreenshots, screenshotPlacesToBulkText } from '../utils/screenshotPlaces.js';

const emptyForm = {
  nameKo: '',
  nameZh: '',
  type: '景點',
  area: '其他',
  sourceUrl: '',
  catchtableUrl: '',
  recommendationSource: '',
  naverMapUrl: '',
  description: '',
  note: '',
  clothingTags: [],
  priority: '想去',
  visited: false
};

const emptyBulk = { text: '', sourceUrl: '', recommendationSource: '', area: '' };
const quickFilters = [
  { id: '全部', label: '全部' },
  { id: '必去', label: '必去' },
  { id: '未去', label: '未去' },
  { id: '已去', label: '已去' }
];

export default function Wishlist({ wishlist, setWishlist, businessRefreshStatus }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('全部');
  const [typeFilter, setTypeFilter] = useState('全部');
  const [areaFilter, setAreaFilter] = useState('全部');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(emptyBulk);
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [screenshotProgress, setScreenshotProgress] = useState(null);
  const screenshotInputRef = useRef(null);
  const undoTimerRef = useRef(null);
  const [googleDialogPlace, setGoogleDialogPlace] = useState(null);
  const [undoNotice, setUndoNotice] = useState(null);
  const { googleDetails, googleStatus, loadGoogleDetails } = useGooglePlaceDetails(wishlist);

  const filtered = wishlist.filter((item) => {
    const normalizedArea = districtForArea(item.area).name;
    const quickMatch = quickFilter === '全部'
      || (quickFilter === '必去' && item.priority === '必去')
      || (quickFilter === '未去' && !item.visited)
      || (quickFilter === '已去' && item.visited);
    return matchesWishlistQuery(item, query)
      && quickMatch
      && (typeFilter === '全部' || normalizePlaceType(item.type) === typeFilter)
      && (areaFilter === '全部' || normalizedArea === areaFilter);
  });

  useEffect(() => () => window.clearTimeout(undoTimerRef.current), []);

  const advancedFilterCount = Number(typeFilter !== '全部') + Number(areaFilter !== '全部');
  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleClothingTag(tag) {
    setForm((current) => ({
      ...current,
      clothingTags: current.clothingTags.includes(tag)
        ? current.clothingTags.filter((item) => item !== tag)
        : [...current.clothingTags, tag]
    }));
  }

  function selectFormArea(district) {
    updateField('area', district.name);
  }

  function openNewEditor() {
    setEditingId(null);
    setForm(emptyForm);
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
      type: normalizePlaceType(form.type),
      clothingTags: Array.isArray(form.clothingTags) ? form.clothingTags : [],
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
      type: normalizePlaceType(item.type),
      clothingTags: Array.isArray(item.clothingTags) ? item.clothingTags : [],
      area: district.name,
      nameKo: item.nameKo || item.koreanName || '',
      nameZh: item.nameZh || item.chineseName || item.name || '',
      naverMapUrl: /(?:naver\.com|naver\.me)/i.test(item.naverMapUrl || '') ? item.naverMapUrl : (item.mapUrl?.includes('naver.com') ? item.mapUrl : '')
    });
    setEditorOpen(true);
  }

  async function previewBulk() {
    const parsed = parseBulkPlaces(bulkForm);
    if (!parsed.length) {
      setBulkPreview([]);
      setBulkMessage('請先貼上至少一個有編號的店家或景點');
      return;
    }
    await resolveBulkPreview(parsed);
  }

  async function resolveBulkPreview(items) {
    setBulkProcessing(true);
    setBulkMessage(`正在查詢 1 / ${items.length}`);
    const resolved = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      setBulkMessage(`正在查詢 ${index + 1} / ${items.length}：${item.nameZh || item.nameKo}`);
      try {
        resolved.push(await enrichPlaceIdentity(item));
      } catch (error) {
        resolved.push({
          ...item,
          businessLookupStatus: error?.code || 'error',
          businessLookupNote: error instanceof Error ? error.message : '商家資料查詢失敗'
        });
      }
      setBulkPreview([...resolved]);
    }
    setBulkProcessing(false);
    setBulkMessage('整理完成，請確認名稱、分類與查詢結果');
  }

  async function handleScreenshotSelection(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setBulkProcessing(true);
    setBulkPreview([]);
    setBulkMessage('正在準備截圖文字辨識，第一次使用會下載語言模型');
    try {
      const extracted = await extractPlacesFromScreenshots(files, {
        onProgress(progress) {
          setScreenshotProgress(progress);
          setBulkMessage(`辨識截圖 ${progress.current} / ${progress.total}：${progress.progress}%`);
        }
      });
      if (!extracted.length) {
        setBulkMessage('截圖內沒有辨識到可用的店名，請換一張較清楚的截圖');
        return;
      }
      const screenshotText = screenshotPlacesToBulkText(extracted);
      const nextForm = {
        ...bulkForm,
        text: [bulkForm.text.trim(), screenshotText].filter(Boolean).join('\n\n\n')
      };
      setBulkForm(nextForm);
      setScreenshotProgress(null);
      await resolveBulkPreview(parseBulkPlaces(nextForm));
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : '截圖辨識失敗');
    } finally {
      setBulkProcessing(false);
    }
  }

  function addBulk() {
    if (!bulkPreview.length) return;
    setWishlist((items) => [...bulkPreview, ...items]);
    setBulkForm(emptyBulk);
    setBulkPreview([]);
    setBulkMessage('');
    setScreenshotProgress(null);
    setBulkOpen(false);
  }

  function closeBulk() {
    setBulkOpen(false);
    setBulkPreview([]);
    setBulkMessage('');
    setScreenshotProgress(null);
  }

  function clearBulkList() {
    setBulkForm((current) => ({ ...current, text: '' }));
    setBulkPreview([]);
    setBulkMessage('');
    setScreenshotProgress(null);
  }

  function openGoogleDialog(item) {
    setGoogleDialogPlace(item);
    const details = googleDetails[item.id];
    if ((!details || !hasCurrentGooglePhotoUrls(details)) && googleStatus[item.id] !== 'loading') {
      loadGoogleDetails(item);
    }
  }

  function deleteWishlistItem(item) {
    const sourceIndex = wishlist.findIndex((entry) => entry.id === item.id);
    setWishlist((items) => items.filter((entry) => entry.id !== item.id));
    showUndo(`${item.nameZh || item.nameKo || item.name} 已從願望清單刪除`, () => {
      setWishlist((items) => {
        if (items.some((entry) => entry.id === item.id)) return items;
        const next = [...items];
        next.splice(Math.min(Math.max(sourceIndex, 0), next.length), 0, item);
        return next;
      });
    });
  }

  function showUndo(message, action) {
    window.clearTimeout(undoTimerRef.current);
    setUndoNotice({ message, action });
    undoTimerRef.current = window.setTimeout(() => setUndoNotice(null), 6000);
  }

  function undoLastDelete() {
    undoNotice?.action?.();
    window.clearTimeout(undoTimerRef.current);
    setUndoNotice(null);
  }

  function clearFilters() {
    setQuery('');
    setQuickFilter('全部');
    setTypeFilter('全部');
    setAreaFilter('全部');
  }

  return (
    <div className="stack">
      <div className="wishlist-toolbar">
        <div>
          <p className="eyebrow">Wish list</p>
          <h2>想去的地方</h2>
          {businessRefreshStatus.state === 'loading' && (
            <span className="toolbar-status"><LoaderCircle className="spin" size={14} /> 正在更新既有商店 {businessRefreshStatus.completed}/{businessRefreshStatus.total}</span>
          )}
        </div>
        <div className="wishlist-toolbar-actions">
          <button className="wide-button secondary toolbar-button" onClick={openNewEditor}><Plus size={18} /> 新增景點</button>
          <button className="wide-button toolbar-button" onClick={() => setBulkOpen(true)}><Sparkles size={18} /> 加入大量景點</button>
        </div>
      </div>

      {wishlist.length > 0 && (
        <div className="wishlist-filter-panel" aria-label="願望清單篩選">
          <div className="wishlist-search-row">
            <label className="search-field">
              <Search size={18} aria-hidden="true" />
              <span className="visually-hidden">搜尋願望清單</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋中文、韓文、地區或備註"
              />
            </label>
            <button
              type="button"
              className={`filter-toggle ${filtersOpen || advancedFilterCount ? 'active' : ''}`}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal size={18} />
              篩選{advancedFilterCount ? ` ${advancedFilterCount}` : ''}
            </button>
          </div>
          <div className="scroll-row">
            <div className="filter-scroll-track quick-filter-track" role="group" aria-label="常用篩選">
              {quickFilters.map((filter) => (
                <button
                  key={filter.id}
                  className={quickFilter === filter.id ? 'active' : ''}
                  aria-pressed={quickFilter === filter.id}
                  onClick={() => setQuickFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          {filtersOpen && (
            <div className="advanced-filters">
              <div className="scroll-row">
                <div className="filter-scroll-track" role="group" aria-label="依類型篩選">
                  <button className={typeFilter === '全部' ? 'active' : ''} aria-pressed={typeFilter === '全部'} onClick={() => setTypeFilter('全部')}>🧭 全部類型</button>
                  {PLACE_TYPES.map((type) => (
                    <button key={type} className={typeFilter === type ? 'active' : ''} aria-pressed={typeFilter === type} onClick={() => setTypeFilter(type)}>
                      {placeTypeEmoji(type)} {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="scroll-row">
                <div className="filter-scroll-track district-filter-track" role="group" aria-label="依地區篩選">
                  <button className={areaFilter === '全部' ? 'active' : ''} aria-pressed={areaFilter === '全部'} onClick={() => setAreaFilter('全部')}>全部地區</button>
                  {districts.map((district) => (
                    <button
                      key={district.id}
                      className={areaFilter === district.name ? 'active' : ''}
                      style={{ '--filter-color': district.color }}
                      aria-pressed={areaFilter === district.name}
                      onClick={() => setAreaFilter(district.name)}
                    >
                      <span />#{district.name}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className="text-button clear-filter-button" onClick={clearFilters}>清除所有篩選</button>
            </div>
          )}
          <p className="filter-result-count">顯示 {filtered.length} / {wishlist.length} 個地點</p>
        </div>
      )}

      <div className="place-list wishlist-list">
        {filtered.map((item) => {
          const details = googleDetails[item.id];
          const status = googleStatus[item.id];
          return (
            <PlaceCard
              key={item.id}
              place={item}
              visited={item.visited}
              googleDetails={details}
              googleStatus={status}
              showGoogleDetails
              onOpenGoogle={() => openGoogleDialog(item)}
              onAreaSelect={(district) => setAreaFilter(district.name)}
              actions={<><button onClick={() => setWishlist((items) => items.map((old) => old.id === item.id ? { ...old, visited: !old.visited } : old))}><CheckCircle2 size={17} /> {item.visited ? '取消已去' : '標記已去'}</button><button onClick={() => edit(item)}><Pencil size={17} /> 編輯</button><button className="danger" onClick={() => deleteWishlistItem(item)}><Trash2 size={17} /> 刪除</button></>}
            />
          );
        })}
        {!filtered.length && (
          <div className="empty-state">
            <HeartEmptyIcon />
            <strong>{wishlist.length ? '沒有符合條件的願望' : '願望清單還是空的'}</strong>
            <p>{wishlist.length ? '換個搜尋字詞或清除篩選再看看。' : '先新增第一個想去的地方，之後就能搜尋與分類。'}</p>
            {wishlist.length ? (
              <button type="button" className="wide-button secondary" onClick={clearFilters}>清除篩選</button>
            ) : (
              <button type="button" className="wide-button" onClick={openNewEditor}><Plus size={18} /> 新增第一個地點</button>
            )}
          </div>
        )}
      </div>

      <GoogleReviewDialog
        place={googleDialogPlace}
        details={googleDialogPlace ? googleDetails[googleDialogPlace.id] : null}
        status={googleDialogPlace ? googleStatus[googleDialogPlace.id] : ''}
        onClose={() => setGoogleDialogPlace(null)}
        onRefresh={() => loadGoogleDetails(googleDialogPlace, true)}
      />

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
              <label>類型<select value={form.type} onChange={(event) => updateField('type', event.target.value)}>{PLACE_TYPES.map((type) => <option key={type} value={type}>{formatPlaceType(type)}</option>)}</select></label>
              <label>優先度<select value={form.priority} onChange={(event) => updateField('priority', event.target.value)}>{WISHLIST_PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></label>
              {normalizePlaceType(form.type) === '服裝' && (
                <fieldset className="area-fieldset full clothing-subtag-fieldset">
                  <legend>服裝子標籤（可複選）</legend>
                  <div className="area-tag-options">
                    {CLOTHING_SUBTAGS.map((tag) => (
                      <button key={tag} type="button" className={(form.clothingTags || []).includes(tag) ? 'active' : ''} style={{ '--tag-color': '#6f668f' }} onClick={() => toggleClothingTag(tag)}>#{tag}</button>
                    ))}
                  </div>
                  <p className="bulk-area-help">子標籤獨立儲存，不會改動你原本手動建立的地區 # 標籤。</p>
                </fieldset>
              )}
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
              <label>CATCHTABLE 連結<input value={form.catchtableUrl} onChange={(event) => updateField('catchtableUrl', event.target.value)} placeholder="https://app.catchtable.co.kr/..." /></label>
              <label className="full">Naver Map 連結<input value={form.naverMapUrl} onChange={(event) => updateField('naverMapUrl', event.target.value)} placeholder="可留空，自動用韓文名稱搜尋" /></label>
              <label className="full">景點簡介<textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="例如：適合逛街、拍照或安排在晚餐前。" /></label>
              <label className="full">景點備註（選填）<textarea value={form.note} onChange={(event) => updateField('note', event.target.value)} placeholder="想補充的營業時間、必點或排隊提醒..." /></label>
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
            <div className="screenshot-import">
              <input
                ref={screenshotInputRef}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleScreenshotSelection}
              />
              <button
                className="wide-button secondary"
                type="button"
                disabled={bulkProcessing}
                onClick={() => screenshotInputRef.current?.click()}
              >
                {bulkProcessing && screenshotProgress
                  ? <LoaderCircle className="spin" size={18} />
                  : <ImagePlus size={18} />}
                從收藏截圖整理
              </button>
              <p>可一次選擇最多 8 張；圖片只在這台裝置辨識，不會上傳保存。</p>
            </div>
            <div className="form-grid">
              <label>推薦來源<input value={bulkForm.recommendationSource} onChange={(event) => setBulkForm((current) => ({ ...current, recommendationSource: event.target.value }))} placeholder="例如：OO 的首爾清單" /></label>
              <label>來源連結<input value={bulkForm.sourceUrl} onChange={(event) => setBulkForm((current) => ({ ...current, sourceUrl: event.target.value }))} placeholder="https://..." /></label>
              <fieldset className="area-fieldset full">
                <legend>套用地區</legend>
                <div className="area-tag-options">
                  <button
                    type="button"
                    className={!bulkForm.area ? 'active' : ''}
                    style={{ '--tag-color': '#2F6F91' }}
                    onClick={() => setBulkForm((current) => ({ ...current, area: '' }))}
                  >
                    自動判斷
                  </button>
                  {districts.map((district) => (
                    <button
                      key={district.id}
                      type="button"
                      className={bulkForm.area === district.name ? 'active' : ''}
                      style={{ '--tag-color': district.color }}
                      onClick={() => setBulkForm((current) => ({ ...current, area: district.name }))}
                    >
                      #{district.name}
                    </button>
                  ))}
                </div>
                <p className="bulk-area-help">{bulkForm.area ? `本次加入的景點會統一標示為 #${bulkForm.area}` : '依店名、地址與備註自動判斷地區'}</p>
              </fieldset>
              <div className="bulk-list-field full">
                <div className="bulk-list-head">
                  <label htmlFor="bulk-place-list">商店／景點清單</label>
                  <button
                    type="button"
                    className="bulk-clear-button"
                    onClick={clearBulkList}
                    disabled={bulkProcessing || (!bulkForm.text && !bulkPreview.length)}
                  >
                    <Trash2 size={15} /> 清除
                  </button>
                </div>
                <textarea id="bulk-place-list" className="bulk-textarea" value={bulkForm.text} onChange={(event) => setBulkForm((current) => ({ ...current, text: event.target.value }))} placeholder={'1. 능동미나리성수점\nhttps://naver.me/example\n餐點與其他備註\n\n\n2. Pizzeria Marione 마리오네\nhttps://maps.app.goo.gl/example\n其他備註'} />
              </div>
            </div>
            {bulkPreview.length > 0 && (
              <div className="bulk-preview">
                <div className="bulk-preview-head"><strong>已整理 {bulkPreview.length} 個地點</strong><span>優先度可在加入後編輯</span></div>
                <ol>
                  {bulkPreview.map((item) => (
                    <li key={item.id}>
                      <span>{formatPlaceName(item)}</span>
                      <small>#{districtForArea(item.area).name} · {formatPlaceType(item.type)}{item.naverMapUrl ? ' · Naver' : ''}{item.googleMapUrl ? ' · Google' : ''}</small>
                      {['not_found', 'error', 'google_error'].includes(item.businessLookupStatus) && <small className="lookup-error">{item.businessLookupNote || 'Google 找不到商家'}</small>}
                      {item.note && <small className="lookup-description">{item.note}</small>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {bulkMessage && <p className={`bulk-status ${bulkProcessing ? 'loading' : ''}`}>{bulkProcessing && <LoaderCircle className="spin" size={15} />}{bulkMessage}</p>}
            <div className="dialog-actions">
              <button className="wide-button secondary" onClick={previewBulk} disabled={bulkProcessing}><Sparkles size={18} /> 整理並預覽</button>
              <button className="wide-button" onClick={addBulk} disabled={!bulkPreview.length || bulkProcessing}><Plus size={18} /> 加入 {bulkPreview.length || ''} 個地點</button>
            </div>
          </section>
        </div>
      )}
      <UndoToast
        message={undoNotice?.message}
        onUndo={undoLastDelete}
        onClose={() => setUndoNotice(null)}
      />
    </div>
  );
}

function HeartEmptyIcon() {
  return <span className="empty-state-icon" aria-hidden="true">♡</span>;
}
